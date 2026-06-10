# supabase/

Configuração e migrations do backend (Supabase).

## Estrutura

```
supabase/
├── config.toml                    # config do projeto local
├── migrations/                    # SQL versionado (timestamp prefix)
│   └── 0001_init_tenants.sql      # multi-tenancy foundation
├── functions/                     # edge functions (a criar)
├── seed.sql                       # dados de dev/local
└── README.md
```

## Convenções de schema

- **Toda tabela de domínio** referencia `tenants(id)`:
  ```sql
  tenant_id uuid not null references public.tenants(id) on delete cascade
  ```
- **RLS ativado em tudo:**
  ```sql
  alter table <nome> enable row level security;
  create policy "tenant_isolation" on <nome>
    for all using (tenant_id in (select public.current_user_tenants()));
  ```
- **Prefixo por domínio:** `ads_*`, `organic_*`, `competitors_*`, `ai_*`, `reports_*`, `alerts_*`, `seo_*`, `ambassadors_*`, `settings_*`.

## Comandos

```bash
# instalar CLI (uma vez)
npm i -g supabase

# iniciar local stack (Docker required)
supabase start

# criar nova migration
supabase migration new <nome>

# aplicar migrations
supabase db reset           # reseta + roda migrations + seed
supabase db push            # aplica em projeto remoto

# gerar tipos TS pro front
supabase gen types typescript --local > ../src/shared/lib/supabase/types.gen.ts
```
