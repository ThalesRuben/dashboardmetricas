-- 0046_whatsapp_lid.sql
-- Adiciona `lid` em whatsapp_contatos e função pra fundir órfãos LID
-- no contato real quando a correspondência LID→telefone for descoberta.
--
-- Contexto: Z-API entrega outbound (fromMe=true) com `phone` no formato
-- `<digitos>@lid` em vez do telefone real. Inbound traz phone real +
-- chatLid. Sem resolução, cada envio criava contato órfão. Esta
-- migration + patch do inbox-ingest + 0047 (backfill) corrigem o fluxo.
--
-- Também adiciona a função `whatsapp_merge_lid` que o inbox-ingest usa
-- em runtime: quando um inbound chega com chat_lid e o contato real
-- ainda não tem lid gravado, a função varre órfãos com esse mesmo LID
-- e refaz as threads/msgs apontando pro contato real. Deleta o órfão.

-- ============================================================
-- 1) Coluna + índice único parcial
-- ============================================================
alter table public.whatsapp_contatos
  add column if not exists lid text;

create unique index if not exists whatsapp_contatos_tenant_lid_uidx
  on public.whatsapp_contatos(tenant_id, lid)
  where lid is not null;

comment on column public.whatsapp_contatos.lid is
  'LID (identificador interno WhatsApp/Meta) sem o sufixo @lid. Resolve outbound Z-API cujo `phone` chega como LID em vez de telefone real. Único por tenant.';

-- ============================================================
-- 2) Marca órfãos existentes — phone fora de ^55\d{10,11}$ virou
--    LID por acidente da ingest antiga. Guarda em `lid` o próprio
--    valor; o merge subsequente (via 0047 ou runtime) resolve.
-- ============================================================
do $$
declare v_count int;
begin
  update public.whatsapp_contatos
     set lid = phone
   where lid is null
     and phone !~ '^55[0-9]{10,11}$'
     and char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 15;
  get diagnostics v_count = row_count;
  raise notice 'Órfãos marcados com lid: %', v_count;
end $$;

-- ============================================================
-- 3) Função de merge — chamada pelo ingest em runtime OU pela 0047
--
-- Dado o contato real (recém-identificado com `lid=X`), procura por
-- um órfão (contato distinto, mesmo tenant, mesmo LID), move suas
-- threads/msgs e deleta o órfão. Threads são FUNDIDAS por
-- `inbox_phone`: se o real já tem thread no mesmo inbox, as msgs do
-- órfão migram pra ela e a thread órfã é apagada. Senão a thread
-- órfã só é reaproveitada apontando pro contato real.
-- ============================================================
create or replace function public.whatsapp_merge_lid(
  p_tenant_id uuid,
  p_real_contato_id uuid,
  p_lid text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orphan_id uuid;
  v_orphan_thread record;
  v_target_thread_id uuid;
  v_fused int := 0;
begin
  if p_lid is null then return 0; end if;

  -- Encontra órfão com esse LID (distinto do contato real)
  select id into v_orphan_id
    from public.whatsapp_contatos
    where tenant_id = p_tenant_id
      and lid = p_lid
      and id <> p_real_contato_id
    limit 1;
  if v_orphan_id is null then return 0; end if;

  -- Pra cada thread do órfão, procura thread "irmã" no contato real
  -- com mesmo inbox_phone. Se existir, funde. Senão, reatribui.
  for v_orphan_thread in
    select id, inbox_phone, nao_lidas, ultima_atividade, ultima_msg_cliente_em, status
      from public.whatsapp_threads
      where contato_id = v_orphan_id
  loop
    select id into v_target_thread_id
      from public.whatsapp_threads
      where contato_id = p_real_contato_id
        and (
          (inbox_phone is null and v_orphan_thread.inbox_phone is null)
          or inbox_phone = v_orphan_thread.inbox_phone
        )
      limit 1;

    if v_target_thread_id is not null then
      -- Thread existe no real → move msgs e deleta órfã
      update public.whatsapp_msgs
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      update public.crm_notas
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      update public.crm_followups
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      update public.crm_vendas
         set thread_id = v_target_thread_id
       where thread_id = v_orphan_thread.id;
      -- Tags: só move as que o destino ainda NÃO tem. Alias t_src/t_dst
      -- impede auto-referência da subquery contra o UPDATE (sem alias, o
      -- `crm_thread_tags.tag_id` dentro do not exists amarra à própria
      -- subquery e o not exists vira sempre falso — bug observado em
      -- backfill: as tags do órfão eram apagadas sem migrar).
      update public.crm_thread_tags t_src
         set thread_id = v_target_thread_id
       where t_src.thread_id = v_orphan_thread.id
         and not exists (
           select 1 from public.crm_thread_tags t_dst
            where t_dst.thread_id = v_target_thread_id
              and t_dst.tag_id = t_src.tag_id
         );
      delete from public.crm_thread_tags where thread_id = v_orphan_thread.id;
      -- Atualiza ultima_atividade/não-lidas na thread alvo
      update public.whatsapp_threads
         set nao_lidas = nao_lidas + v_orphan_thread.nao_lidas,
             ultima_atividade = greatest(ultima_atividade, v_orphan_thread.ultima_atividade),
             -- nullif evita gravar '-infinity' quando as duas threads
             -- têm ultima_msg_cliente_em = NULL.
             ultima_msg_cliente_em = nullif(
               greatest(
                 coalesce(ultima_msg_cliente_em, '-infinity'::timestamptz),
                 coalesce(v_orphan_thread.ultima_msg_cliente_em, '-infinity'::timestamptz)
               ),
               '-infinity'::timestamptz
             )
       where id = v_target_thread_id;
      delete from public.whatsapp_threads where id = v_orphan_thread.id;
    else
      -- Sem thread irmã → reatribui contato. Se estava arquivada pela
      -- 0045 (phone era LID antes), reabre: agora pertence a contato
      -- legítimo e precisa aparecer no kanban/inbox.
      update public.whatsapp_threads
         set contato_id = p_real_contato_id,
             status = case when status = 'arquivada' then 'aberta' else status end
       where id = v_orphan_thread.id;
    end if;
    v_fused := v_fused + 1;
  end loop;

  -- Órfão sem mais threads: deleta
  delete from public.whatsapp_contatos where id = v_orphan_id;

  return v_fused;
end;
$$;

grant execute on function public.whatsapp_merge_lid(uuid, uuid, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
