-- 0006_whatsapp_disparos.sql
-- Histórico de disparos em massa via WhatsApp Cloud API.
-- Cada linha representa um lote enviado para N destinatários com um template HSM.

create table public.whatsapp_disparos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  template_name   text not null,
  template_lang   text not null default 'pt_BR',
  variables       jsonb not null default '[]'::jsonb,
  total           int  not null default 0,
  enviados        int  not null default 0,
  falhas          int  not null default 0,
  status          text not null default 'concluido' check (status in ('em_andamento','concluido','erro')),
  detalhes        jsonb,
  criado_por      uuid references auth.users(id) on delete set null,
  criado_em       timestamptz not null default now()
);

create index whatsapp_disparos_tenant_data_idx
  on public.whatsapp_disparos(tenant_id, criado_em desc);

alter table public.whatsapp_disparos enable row level security;

create policy "whatsapp_disparos_tenant_isolation" on public.whatsapp_disparos
  for all using (tenant_id in (select public.current_user_tenants()));
