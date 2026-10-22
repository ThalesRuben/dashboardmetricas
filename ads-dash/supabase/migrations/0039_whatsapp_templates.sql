-- 0039_whatsapp_templates.sql
-- Templates HSM (WhatsApp Cloud API oficial) do tenant.
--
-- Templates são escopados por WABA na Meta; aqui escopamos por tenant
-- (assume-se 1 tenant = 1 WABA). Se um tenant ganhar múltiplas WABAs no
-- futuro, adicionar coluna waba_id + trocar o unique index.
--
-- Fluxo:
--   1. Usuário cria localmente → status = 'draft'.
--   2. Ao submeter, edge function `whatsapp-templates` chama
--      POST /{WABA_ID}/message_templates → grava meta_template_id + status='pending'.
--   3. Meta aprova/rejeita → cron/webhook chama sync e atualiza status.

create table public.whatsapp_templates (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,

  -- Nome canônico do template. Slug minúsculo com underscore
  -- (regra da Meta: [a-z0-9_], até 512 chars).
  name               text not null,
  language           text not null default 'pt_BR',
  category           text not null check (category in ('MARKETING','UTILITY','AUTHENTICATION')),

  -- Payload no formato aceito pela Graph API — array de components:
  -- HEADER (TEXT/IMAGE/VIDEO/DOCUMENT), BODY (com {{n}} + example),
  -- FOOTER, BUTTONS (QUICK_REPLY / URL / PHONE_NUMBER).
  components         jsonb not null default '[]'::jsonb,

  -- ID retornado pela Meta após submissão. Null até submeter.
  meta_template_id   text,

  -- 'draft'    = criado localmente, não submetido
  -- 'pending'  = submetido, aguardando revisão da Meta
  -- 'approved' = aprovado, pode ser usado em disparo
  -- 'rejected' = rejeitado pela Meta (ver motivo_rejeicao)
  -- 'paused'   = pausado por baixo engajamento
  -- 'disabled' = desabilitado permanentemente
  status             text not null default 'draft'
                     check (status in ('draft','pending','approved','rejected','paused','disabled')),
  motivo_rejeicao    text,

  criado_por         uuid references auth.users(id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  -- Última vez que o status foi conferido contra a Graph API.
  sincronizado_em    timestamptz,

  -- Meta exige unicidade (name, language) por WABA. Como escopamos por
  -- tenant, replicamos a mesma regra.
  unique (tenant_id, name, language)
);

create index whatsapp_templates_tenant_idx
  on public.whatsapp_templates(tenant_id, status, atualizado_em desc);

alter table public.whatsapp_templates enable row level security;

create policy "whatsapp_templates_tenant_isolation" on public.whatsapp_templates
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.whatsapp_templates
  alter column tenant_id set default public.current_user_first_tenant(),
  alter column criado_por set default auth.uid();

create trigger whatsapp_templates_touch_trg
  before update on public.whatsapp_templates
  for each row execute function public.whatsapp_numbers_touch();

notify pgrst, 'reload schema';
