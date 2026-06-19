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

## WhatsApp — inbox + disparo

Três edge functions trabalham juntas:

| function          | quem chama        | função                                              |
| ----------------- | ----------------- | --------------------------------------------------- |
| `inbox-ingest`    | n8n (servidor DO) | recebe msg do cliente e grava em `whatsapp_msgs`    |
| `inbox-reply`    | front (composer)  | envia resposta do atendente via Cloud API           |
| `whatsapp-send`   | front (disparo)   | dispara template HSM em massa                       |

### Secrets necessários (Supabase → Functions → Secrets)

```
WHATSAPP_TOKEN              # System User token (não expira)
WHATSAPP_PHONE_NUMBER_ID    # id do número na Meta
INTERNAL_API_KEY            # secret arbitrário; n8n manda no header
DEFAULT_TENANT_SLUG         # opcional; default = 'the-blonde-concept'
```

### Deploy das functions

```bash
supabase functions deploy inbox-ingest  --no-verify-jwt
supabase functions deploy inbox-reply   --no-verify-jwt
supabase functions deploy whatsapp-send --no-verify-jwt
```

### Configurando o n8n (servidor DO)

No fluxo que recebe webhook do WhatsApp, adicione **um nó "HTTP Request"** no final:

- **Method:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/inbox-ingest`
- **Headers:**
  - `Content-Type: application/json`
  - `x-internal-key: <mesmo valor de INTERNAL_API_KEY>`
- **Body (JSON):**
  ```json
  {
    "phone":     "{{ $json.from }}",
    "nome":      "{{ $json.profile.name }}",
    "texto":     "{{ $json.text.body }}",
    "msg_id":    "{{ $json.id }}",
    "hora":      "{{ $now.toISO() }}",
    "direction": "in"
  }
  ```

  Ajuste os caminhos `$json.*` conforme o payload exato que o seu fluxo já tem.
  Você continua gravando no Postgres da DigitalOcean normalmente — esse nó só
  espelha pro Supabase pra alimentar o ads-dash.

### Janela de 24h

A Cloud API só permite texto livre dentro de 24h da última msg do cliente.
O `inbox-reply` valida isso e retorna `409` se a janela fechou.
Pra reabrir conversa fora da janela, use a aba **Disparo em massa** com um
template HSM aprovado.
