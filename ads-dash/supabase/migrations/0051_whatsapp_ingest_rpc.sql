-- 0051_whatsapp_ingest_rpc.sql
-- Consolida todo o fluxo do inbox-ingest numa única RPC plpgsql.
-- Motivação: o edge function fazia 7-9 chamadas sequenciais ao banco
-- (tenant, dedup, contato lookup, insert, lid update, merge, threads
-- lookup, thread update, msg insert). Cada roundtrip Edge→DB custa
-- 200-300ms de rede, totalizando ~2s por msg em dias calmos e >10s
-- em pico (fila do pool compartilhado Free tier). Operador diagnosticou
-- em 2026-10-23: tempo não vinha do banco (queries <1ms, índices ok)
-- mas da latência da conversa.
--
-- Com a RPC: 1 roundtrip. Tudo numa transação atômica. Race do
-- caminho A some via `on conflict` nativo. Fix #1 (nome preservado)
-- vira expressão SQL curta.
--
-- Edge function fica dumb: valida auth, chama RPC, devolve resultado.

-- ============================================================
-- Helpers reutilizáveis
-- ============================================================

create or replace function public.pg_normalizar_phone_br(p_raw text)
returns text
language sql
immutable
as $$
  with n0 as (
    select regexp_replace(coalesce(p_raw, ''), '\D', '', 'g') as n
  ),
  n1 as (
    -- Remove leading 0 (ex.: 031...) se length >= 11
    select case
      when char_length(n) >= 11 and left(n, 1) = '0' then substring(n from 2)
      else n
    end as n
    from n0
  ),
  n2 as (
    -- Adiciona DDI 55 se vier só DDD+número (10 ou 11 dígitos)
    select case
      when char_length(n) in (10, 11) then '55' || n
      else n
    end as n
    from n1
  ),
  n3 as (
    -- Insere "9" entre DDD e número quando falta (12 dígitos começando com 55)
    select case
      when char_length(n) = 12 and left(n, 2) = '55'
        then substring(n from 1 for 4) || '9' || substring(n from 5)
      else n
    end as n
    from n2
  )
  select n from n3;
$$;

create or replace function public.pg_extract_lid_digits(p_raw text)
returns text
language sql
immutable
as $$
  select case
    when p_raw is null then null
    when p_raw !~ '@lid$' then null
    else nullif(regexp_replace(regexp_replace(p_raw, '@lid$', ''), '\D', '', 'g'), '')
  end;
$$;

-- ============================================================
-- RPC principal
-- ============================================================

create or replace function public.ingest_whatsapp_msg(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone_raw         text;
  v_lid_from_phone    text;
  v_lid_from_chat     text;
  v_lid               text;
  v_is_lid_only       boolean;
  v_texto             text;
  v_phone             text;
  v_direction         text;
  v_hora              timestamptz;
  v_origem            text;
  v_inbox_raw         text;
  v_inbox_phone       text;
  v_tenant_slug       text;
  v_tenant_id         uuid;
  v_msg_id            text;
  v_nome              text;
  v_contato_id        uuid;
  v_contato_nome      text;
  v_contato_lid       text;
  v_dedup_id          uuid;
  v_dedup_thread      uuid;
  v_thread_id         uuid;
  v_thread_nao_lidas  int;
  v_thread_inbox      text;
  v_msg_pk            uuid;
  v_merged            int;
begin
  -- 1. Parse payload
  v_phone_raw   := coalesce(p_body->>'phone', '');
  v_texto       := trim(both from coalesce(p_body->>'texto', ''));
  v_msg_id      := p_body->>'msg_id';
  v_direction   := case when p_body->>'direction' = 'out' then 'out' else 'in' end;
  v_hora        := coalesce((p_body->>'hora')::timestamptz, now());
  v_origem      := coalesce(p_body->>'origem', 'whatsapp');
  v_tenant_slug := coalesce(p_body->>'tenant_slug', 'the-blonde-concept');
  v_nome        := nullif(trim(both from coalesce(p_body->>'nome', '')), '');
  v_inbox_raw   := coalesce(
                     p_body->>'inbox_phone',
                     p_body->>'connected_phone',
                     p_body->>'connectedPhone',
                     ''
                   );

  -- 2. Detect LID (fonte: phone OU chat_lid)
  v_lid_from_phone := public.pg_extract_lid_digits(v_phone_raw);
  v_lid_from_chat  := public.pg_extract_lid_digits(
                        coalesce(p_body->>'chat_lid', p_body->>'chatLid')
                      );
  v_lid            := coalesce(v_lid_from_phone, v_lid_from_chat);
  v_is_lid_only    := v_lid_from_phone is not null;

  -- 3. Texto vazio → placeholder (reações, stickers sem caption, etc.)
  if v_texto = '' then v_texto := '[sem texto]'; end if;

  -- 4. Phone real só valida/normaliza quando NÃO é LID-only
  if not v_is_lid_only then
    v_phone := public.pg_normalizar_phone_br(v_phone_raw);
    if v_phone is null or char_length(v_phone) = 0 then
      return jsonb_build_object('error', 'phone é obrigatório', 'ignored', true);
    end if;
    if char_length(v_phone) not in (12, 13) then
      raise notice 'ingest-reject phone_length_invalido raw=% norm=% len=%',
        v_phone_raw, v_phone, char_length(v_phone);
      return jsonb_build_object(
        'error', format('phone com %s dígitos rejeitado (esperado 12 ou 13)', char_length(v_phone)),
        'ignored', true
      );
    end if;
  elsif v_lid is null then
    return jsonb_build_object('error', 'phone @lid sem dígitos válidos', 'ignored', true);
  end if;

  -- 5. Inbox phone
  if v_inbox_raw <> '' then
    v_inbox_phone := public.pg_normalizar_phone_br(v_inbox_raw);
    if char_length(v_inbox_phone) not in (12, 13) then
      raise notice 'ingest-reject inbox_phone_length_invalido raw=% norm=% len=%',
        v_inbox_raw, v_inbox_phone, char_length(v_inbox_phone);
      return jsonb_build_object(
        'error', format('inbox_phone com %s dígitos rejeitado', char_length(v_inbox_phone)),
        'ignored', true
      );
    end if;
  end if;

  raise notice 'ingest-recv phone=% lid=% is_lid_only=% inbox=% direction=%',
    v_phone, v_lid, v_is_lid_only, v_inbox_phone, v_direction;

  -- 6. Resolve tenant
  select id into v_tenant_id from public.tenants where slug = v_tenant_slug;
  if v_tenant_id is null then
    return jsonb_build_object('error', format('tenant %L não encontrado', v_tenant_slug));
  end if;

  -- 7. Dedup por msg_id_externo (early return se já tem)
  if v_msg_id is not null then
    select id, thread_id into v_dedup_id, v_dedup_thread
      from public.whatsapp_msgs
     where tenant_id = v_tenant_id and msg_id_externo = v_msg_id
     limit 1;
    if v_dedup_id is not null then
      return jsonb_build_object(
        'ok', true, 'deduped', true,
        'msg_id', v_dedup_id, 'thread_id', v_dedup_thread
      );
    end if;
  end if;

  -- 8. Resolve contato
  if v_is_lid_only then
    -- Caminho A: só temos LID. Lookup por lid, fallback por phone=lid, upsert.
    select id, nome into v_contato_id, v_contato_nome
      from public.whatsapp_contatos
     where tenant_id = v_tenant_id and lid = v_lid
     limit 1;

    if v_contato_id is null then
      -- Fix #4: phone pré-existente com valor = LID (edge case)
      select id, nome into v_contato_id, v_contato_nome
        from public.whatsapp_contatos
       where tenant_id = v_tenant_id and phone = v_lid
       limit 1;

      if v_contato_id is not null then
        update public.whatsapp_contatos
           set lid = v_lid, atualizado_em = now()
         where id = v_contato_id and lid is null;
      else
        -- Insert provisional com ON CONFLICT no índice único parcial
        -- (tenant_id, lid). Resolve race se caminho B inbound chegar
        -- entre nosso lookup e insert.
        insert into public.whatsapp_contatos (tenant_id, phone, lid, nome, atualizado_em)
          values (v_tenant_id, v_lid, v_lid, v_nome, now())
          on conflict (tenant_id, lid) where lid is not null
          do update set atualizado_em = now()
          returning id, nome into v_contato_id, v_contato_nome;
      end if;
    end if;
  else
    -- Caminho B: phone real. Upsert preservando nome (fix #1).
    insert into public.whatsapp_contatos (tenant_id, phone, nome, atualizado_em)
      values (v_tenant_id, v_phone, v_nome, now())
      on conflict (tenant_id, phone) do update
        set atualizado_em = now(),
            nome = coalesce(excluded.nome, whatsapp_contatos.nome)
      returning id, nome, lid into v_contato_id, v_contato_nome, v_contato_lid;

    -- Se chat_lid veio e contato ainda não tem lid: funde antes, grava depois
    if v_lid is not null and v_contato_lid is null then
      v_merged := public.whatsapp_merge_lid(v_tenant_id, v_contato_id, v_lid);
      if v_merged > 0 then
        raise notice 'ingest-merge contato_id=% lid=% threads_fused=%',
          v_contato_id, v_lid, v_merged;
      end if;
      update public.whatsapp_contatos
         set lid = v_lid, atualizado_em = now()
       where id = v_contato_id;
    end if;
  end if;

  -- 9. Resolve/create thread
  --    Prioridade: thread com inbox_phone igual → thread legacy (null) → nova
  if v_inbox_phone is not null then
    select id, nao_lidas, inbox_phone into v_thread_id, v_thread_nao_lidas, v_thread_inbox
      from public.whatsapp_threads
     where tenant_id = v_tenant_id
       and contato_id = v_contato_id
       and status <> 'arquivada'
       and inbox_phone = v_inbox_phone
     order by ultima_atividade desc
     limit 1;

    if v_thread_id is null then
      -- Fallback legacy: thread sem inbox_phone → backfilla
      select id, nao_lidas into v_thread_id, v_thread_nao_lidas
        from public.whatsapp_threads
       where tenant_id = v_tenant_id
         and contato_id = v_contato_id
         and status <> 'arquivada'
         and inbox_phone is null
       order by ultima_atividade desc
       limit 1;

      if v_thread_id is not null then
        update public.whatsapp_threads
           set inbox_phone = v_inbox_phone
         where id = v_thread_id;
      end if;
    end if;
  else
    -- Sem inbox_phone no body: pega qualquer thread aberta
    select id, nao_lidas into v_thread_id, v_thread_nao_lidas
      from public.whatsapp_threads
     where tenant_id = v_tenant_id
       and contato_id = v_contato_id
       and status <> 'arquivada'
     order by ultima_atividade desc
     limit 1;
  end if;

  if v_thread_id is null then
    insert into public.whatsapp_threads (
      tenant_id, contato_id, origem, status, inbox_phone,
      ultima_atividade, ultima_msg_cliente_em, nao_lidas
    ) values (
      v_tenant_id, v_contato_id, v_origem, 'aberta', v_inbox_phone,
      v_hora,
      case when v_direction = 'in' then v_hora else null end,
      case when v_direction = 'in' then 1 else 0 end
    )
    returning id into v_thread_id;
  else
    update public.whatsapp_threads
       set ultima_atividade = v_hora,
           ultima_msg_cliente_em = case
             when v_direction = 'in' then v_hora
             else ultima_msg_cliente_em
           end,
           nao_lidas = case
             when v_direction = 'in' then coalesce(nao_lidas, 0) + 1
             else nao_lidas
           end
     where id = v_thread_id;
  end if;

  -- 10. Insert msg (triggers auto_lead + auto_agendado rodam normal)
  insert into public.whatsapp_msgs (
    tenant_id, thread_id, autor, texto, msg_id_externo, hora, status
  ) values (
    v_tenant_id, v_thread_id,
    (case when v_direction = 'in' then 'cliente' else 'atendente' end)::whatsapp_msg_autor,
    v_texto, v_msg_id, v_hora, 'enviada'
  )
  returning id into v_msg_pk;

  return jsonb_build_object(
    'ok', true,
    'tenant_id', v_tenant_id,
    'contato_id', v_contato_id,
    'thread_id', v_thread_id,
    'msg_id', v_msg_pk
  );
end;
$$;

-- SEGURANÇA: só service_role pode chamar.
--
-- security definer sem GRANT explícito é callable por PUBLIC por default.
-- Como a function escreve em qualquer tenant, se anon tivesse acesso,
-- qualquer um com a chave pública (que fica no front) escreveria msgs
-- em qualquer tenant. REVOKE de PUBLIC + GRANT só pra service_role
-- fecha a porta — Edge Function usa service_role key, segue funcionando.
-- (Catch do operador 2026-10-23.)
revoke all on function public.ingest_whatsapp_msg(jsonb) from public;
revoke all on function public.ingest_whatsapp_msg(jsonb) from anon;
revoke all on function public.ingest_whatsapp_msg(jsonb) from authenticated;
grant execute on function public.ingest_whatsapp_msg(jsonb) to service_role;

notify pgrst, 'reload schema';
