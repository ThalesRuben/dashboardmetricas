-- 0038_whatsapp_numbers.sql
-- Cadastro de números WhatsApp operados pelo tenant.
-- Suporta provider Z-API (WhatsApp Web não-oficial, atual) e Meta Cloud API
-- (oficial, novo). Cada linha tem os identificadores específicos do provider
-- e um rótulo interno (ex: "Ana - atendimento", "Marketing oficial").
--
-- A partir desse ponto, disparos e inbox consultam essa tabela pra decidir
-- qual provider usar por número; até então, tudo vinha de env vars.

create table public.whatsapp_numbers (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,

  rotulo             text not null,
  -- E.164 sem "+", ex: 5531990842381 (padrão canônico já usado no resto do WA).
  display_number     text not null,

  provider           text not null check (provider in ('zapi','meta_official')),

  -- Só quando provider = 'meta_official'
  phone_number_id    text,
  -- Se null, cai no META_WABA_ID global dos secrets. Deixa aqui pra permitir
  -- múltiplas WABAs por tenant no futuro.
  waba_id            text,

  -- Só quando provider = 'zapi'
  zapi_instance_id   text,
  -- Tokens ficam nos secrets do projeto por segurança — não guardar aqui.

  ativo              boolean not null default true,

  criado_por         uuid references auth.users(id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  -- Garante os campos específicos por provider.
  constraint whatsapp_numbers_provider_fields check (
    (provider = 'meta_official' and phone_number_id is not null)
    or
    (provider = 'zapi' and zapi_instance_id is not null)
  ),
  -- Um mesmo número não pode ser cadastrado duas vezes no mesmo tenant.
  unique (tenant_id, display_number)
);

create index whatsapp_numbers_tenant_idx
  on public.whatsapp_numbers(tenant_id, ativo);

alter table public.whatsapp_numbers enable row level security;

create policy "whatsapp_numbers_tenant_isolation" on public.whatsapp_numbers
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.whatsapp_numbers
  alter column tenant_id set default public.current_user_first_tenant(),
  alter column criado_por set default auth.uid();

-- Trigger pra manter atualizado_em em sync.
create or replace function public.whatsapp_numbers_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger whatsapp_numbers_touch_trg
  before update on public.whatsapp_numbers
  for each row execute function public.whatsapp_numbers_touch();

notify pgrst, 'reload schema';
