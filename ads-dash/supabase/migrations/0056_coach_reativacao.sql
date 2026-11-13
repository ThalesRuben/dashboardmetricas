-- 0056_coach_reativacao.sql
-- Fila de rascunhos de reativação gerados pela IA.
-- A IA nunca envia automaticamente — ela enfileira sugestões e uma
-- recepcionista aprova (ou edita / descarta) antes da mensagem sair.

-- ============================================================
-- Enum de status do rascunho
-- ============================================================
do $$ begin
  create type public.coach_rascunho_status as enum (
    'pending',    -- esperando revisão humana
    'approved',   -- aprovada, aguardando envio (estado transitório)
    'sent',       -- enviada com sucesso via Z-API
    'discarded',  -- recepcionista descartou
    'failed'      -- tentativa de envio falhou
  );
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- coach_rascunhos — uma linha por rascunho gerado pela IA
-- ============================================================
create table if not exists public.coach_rascunhos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  thread_id       uuid not null references public.whatsapp_threads(id) on delete cascade,

  -- Snapshot da análise que gerou o rascunho
  score_lead      smallint not null check (score_lead between 0 and 100),
  tag_sugerida    text not null check (tag_sugerida in ('quente','morno','frio')),
  primeiro_nome   text,
  resumo_ia       text,
  mensagem_sugerida text not null,
  analise_json    jsonb,                      -- payload bruto do coach pra debugging

  -- Fluxo de aprovação
  status          public.coach_rascunho_status not null default 'pending',
  aprovado_por    uuid references auth.users(id) on delete set null,
  aprovado_em     timestamptz,
  texto_enviado   text,                        -- texto efetivamente enviado (pode ter sido editado)
  enviado_em      timestamptz,
  enviado_erro    text,
  msg_id          uuid references public.whatsapp_msgs(id) on delete set null,

  gerado_em       timestamptz not null default now()
);

create index if not exists coach_rascunhos_pendentes_idx
  on public.coach_rascunhos(tenant_id, gerado_em desc)
  where status = 'pending';

create index if not exists coach_rascunhos_thread_recentes_idx
  on public.coach_rascunhos(thread_id, gerado_em desc);

alter table public.coach_rascunhos enable row level security;

create policy "coach_rascunhos_tenant_isolation" on public.coach_rascunhos
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.coach_rascunhos
  alter column tenant_id set default public.current_user_first_tenant();

-- ============================================================
-- whatsapp_no_auto — telefones que NUNCA recebem rascunho automático
-- (clientes VIP, pessoais, com problema, etc.)
-- ============================================================
create table if not exists public.whatsapp_no_auto (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  phone       text not null,
  motivo      text,
  criado_por  uuid references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now(),
  unique (tenant_id, phone)
);

create index if not exists whatsapp_no_auto_tenant_idx
  on public.whatsapp_no_auto(tenant_id, phone);

alter table public.whatsapp_no_auto enable row level security;

create policy "whatsapp_no_auto_tenant_isolation" on public.whatsapp_no_auto
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.whatsapp_no_auto
  alter column tenant_id set default public.current_user_first_tenant(),
  alter column criado_por set default auth.uid();

-- ============================================================
-- RPC: seleciona threads candidatas à reativação
-- Usado pela edge function cron.
-- ============================================================
create or replace function public.coach_reativacao_candidatas(
  p_tenant_id     uuid,
  p_min_horas     int default 24,             -- minimo de inatividade (≥ 24h sem resposta)
  p_max_horas     int default 24 * 7,         -- maximo (não ressuscitar > 7d — vira retrabalho)
  p_dedup_horas   int default 48,             -- não gera 2 rascunhos no mesmo thread em 48h
  p_limit         int default 50
) returns table (
  thread_id       uuid,
  contato_nome    text,
  contato_phone   text,
  status          text,
  origem          text,
  ultima_atividade timestamptz,
  inbox_phone     text
) language sql stable security invoker as $$
  select
    t.id as thread_id,
    c.nome as contato_nome,
    c.phone as contato_phone,
    t.status::text as status,
    t.origem::text as origem,
    t.ultima_atividade,
    t.inbox_phone
  from public.whatsapp_threads t
  join public.whatsapp_contatos c on c.id = t.contato_id
  where t.tenant_id = p_tenant_id
    and t.status in ('lead','aberta')
    and t.ultima_atividade < now() - make_interval(hours => p_min_horas)
    and t.ultima_atividade > now() - make_interval(hours => p_max_horas)
    and not exists (
      select 1 from public.whatsapp_no_auto na
       where na.tenant_id = t.tenant_id and na.phone = c.phone
    )
    and not exists (
      select 1 from public.coach_rascunhos r
       where r.thread_id = t.id
         and r.gerado_em > now() - make_interval(hours => p_dedup_horas)
    )
  order by t.ultima_atividade desc    -- mais recentes primeiro (leads mais quentes)
  limit p_limit;
$$;

grant execute on function public.coach_reativacao_candidatas(uuid,int,int,int,int) to authenticated, service_role;

-- ============================================================
-- RPC: aprovar e marcar rascunho como enviado
-- Chamado pelo front depois do inbox-reply confirmar o envio.
-- ============================================================
create or replace function public.coach_rascunho_marcar_enviado(
  p_id      uuid,
  p_texto   text,
  p_msg_id  uuid default null
) returns void language plpgsql security invoker as $$
begin
  update public.coach_rascunhos
     set status = 'sent',
         aprovado_por = coalesce(aprovado_por, auth.uid()),
         aprovado_em  = coalesce(aprovado_em, now()),
         texto_enviado = p_texto,
         enviado_em = now(),
         msg_id = p_msg_id
   where id = p_id;
end;
$$;

grant execute on function public.coach_rascunho_marcar_enviado(uuid,text,uuid) to authenticated;

-- ============================================================
-- RPC: marcar como descartado
-- ============================================================
create or replace function public.coach_rascunho_descartar(
  p_id uuid
) returns void language plpgsql security invoker as $$
begin
  update public.coach_rascunhos
     set status = 'discarded',
         aprovado_por = auth.uid(),
         aprovado_em  = now()
   where id = p_id;
end;
$$;

grant execute on function public.coach_rascunho_descartar(uuid) to authenticated;

-- ============================================================
-- RPC: marcar como falho (quando inbox-reply dá erro no envio)
-- ============================================================
create or replace function public.coach_rascunho_marcar_falho(
  p_id uuid,
  p_erro text
) returns void language plpgsql security invoker as $$
begin
  update public.coach_rascunhos
     set status = 'failed',
         enviado_erro = p_erro
   where id = p_id;
end;
$$;

grant execute on function public.coach_rascunho_marcar_falho(uuid,text) to authenticated;
