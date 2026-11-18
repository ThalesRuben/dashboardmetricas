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

### Métricas pelas mensagens

O frontend consulta `get_whatsapp_message_summary(inbox, from, to)`.
A migration `20261117234606_whatsapp_message_metrics.sql` deve ser aplicada
antes de publicar esse frontend. A função anterior `get_whatsapp_summary`
permanece disponível para compatibilidade e reversão.

- **Conversas recebidas:** um contato normalizado por linha, com mensagem
  recebida no período. Clientes antigos que voltam a escrever entram na
  contagem. Arquivar uma conversa não apaga sua atividade passada.
- **Respondidas:** mensagem válida do atendente posterior à mensagem do
  cliente, na mesma linha e no mesmo período. Mensagens com erro e
  simulações são excluídas.
- **Tempos:** medianas em minutos corridos. Mensagens consecutivas do
  cliente formam um turno; respostas após 24 horas continuam na amostra.
  Ausência de amostra retorna `null`, exibido como `—`.
- **Agendamentos detectados:** contatos recebidos com confirmação explícita
  do atendente no período e sem cancelamento posterior detectado. São
  estimativas pelas mensagens, sem integração com a agenda. Não representam
  número de horários, serviços ou comparecimentos. A classificação não
  modifica o status das conversas.
- **Conversão estimada:** conversas com confirmação detectada / conversas
  recebidas, usando a mesma base e período.
- **Vendas e receita:** registros do CRM, com datas no fuso de São Paulo.

A função usa permissões do chamador e o tenant do usuário autenticado.
O painel atualiza a consulta a cada minuto enquanto a aba está visível e ao
voltar à aba. Falhas iniciais exibem erro e opção de tentar novamente. Na
atualização em segundo plano, a tela e os últimos dados reais são preservados
com aviso de atualização indisponível. Dados de demonstração só aparecem no
modo explicitamente configurado como mock.

Regressão em PostgreSQL isolado, com dados fictícios e sem acesso à rede:

```bash
npm install --prefix .vercel/whatsapp-metrics-tests --no-save --package-lock=false @electric-sql/pglite@0.5.16
node --test scripts/verify-whatsapp-metrics.mjs
```

Três edge functions trabalham juntas:

| function          | quem chama        | função                                              |
| ----------------- | ----------------- | --------------------------------------------------- |
| `inbox-ingest`    | n8n (servidor DO) | recebe msg do cliente e grava em `whatsapp_msgs`    |
| `inbox-reply`    | front (composer)  | envia resposta do atendente via Cloud API           |
| `whatsapp-send`   | front (disparo)   | dispara template HSM em massa                       |

A operação usa **Z-API** (WhatsApp Web via BSP) — não Cloud API da Meta.
Por isso **não há janela de 24h** nem templates HSM: o envio é sempre texto
livre, e o disparo em massa só precisa de mensagem + variáveis.

### Secrets necessários (Supabase → Functions → Secrets)

```
ZAPI_INSTANCE_ID            # id da instância Z-API legada/principal
ZAPI_TOKEN                  # token apenas dessa instância
ZAPI_CLIENT_TOKEN           # Account Security Token (vai no header Client-Token)
ZAPI_INSTANCE_TOKENS        # JSON { "id-da-outra-instancia": "token-dessa-instancia" }
INTERNAL_API_KEY            # secret arbitrário; n8n manda no header
DEFAULT_TENANT_SLUG         # opcional; default = 'the-blonde-concept'
```

### Remetente por linha de atendimento

`inbox-reply` usa `whatsapp_threads.inbox_phone` como remetente. Cadastre cada
linha na aba **Números**, com `provider=zapi`, número correto, instância própria
e cadastro ativo. Os tokens das instâncias adicionais ficam apenas no secret
`ZAPI_INSTANCE_TOKENS`; o token global nunca é reutilizado em outra instância.
O `ZAPI_CLIENT_TOKEN` é o token de segurança da conta Z-API dessas instâncias.

Antes de enviar, o servidor consulta `GET /device` da instância e confere se
o telefone conectado corresponde ao número de atendimento. Sem cadastro,
a instância global continua disponível somente se essa mesma verificação
confirmar a linha. Linha inativa, credenciais ausentes, número divergente ou
conversa sem `inbox_phone` bloqueiam o envio; não há simulação automática
marcada como mensagem enviada.

No **Disparo em massa**, selecione uma linha no filtro de números. O front
envia `tenant_id` e `inbox_phone`; o servidor verifica o remetente antes de
enviar ao primeiro destinatário. O histórico guarda número e instância em
`detalhes`, sem tokens. `dry_run: true` é uma simulação explícita e não grava
histórico de mensagens enviadas.

Verificação local sem rede nem mensagens reais:

```bash
node --test scripts/verify-whatsapp-routing.mjs
```

### Deploy das functions

```bash
supabase functions deploy inbox-ingest  --no-verify-jwt
supabase functions deploy inbox-reply   --no-verify-jwt
supabase functions deploy whatsapp-send --no-verify-jwt
```

### Configurando o n8n (servidor DO)

No fluxo que recebe webhook do WhatsApp, adicione **um nó "HTTP Request"**
em paralelo ao restante do flow (não atrás dele — assim toda msg é espelhada,
tenha vindo de anúncio CTWA ou orgânico):

- **Method:** `POST`
- **URL:** `https://<seu-projeto>.supabase.co/functions/v1/inbox-ingest`
- **Headers:**
  - `Content-Type: application/json`
  - `x-internal-key: <mesmo valor de INTERNAL_API_KEY>`
- **Body (JSON) — shape esperado pela function:**
  ```json
  {
    "phone":       "5531999999999",
    "texto":       "Oi, queria agendar",
    "nome":        "Marina Alves",
    "msg_id":      "id externo do provedor",
    "hora":        "2026-08-12T14:32:00Z",
    "direction":   "in",
    "origem":      "whatsapp",
    "tenant_slug": "the-blonde-concept",
    "inbox_phone": "5531990842381"
  }
  ```

  | campo         | obrigatório | notas                                                                    |
  | ------------- | ----------- | ------------------------------------------------------------------------ |
  | `phone`       | sim         | telefone do cliente. Normalizado pra `55DDXXXXXXXXX` (12 ou 13 dígitos). |
  | `texto`       | sim         | conteúdo da mensagem.                                                    |
  | `nome`        | não         | nome do contato (WhatsApp profile). Só grava se ainda for null.          |
  | `msg_id`      | não         | id externo pra dedup. Se já existir, function volta `{deduped: true}`.   |
  | `hora`        | não         | ISO 8601. Default = `now()`.                                             |
  | `direction`   | não         | `"in"` (cliente, default) ou `"out"` (atendente).                        |
  | `origem`      | não         | default `"whatsapp"`.                                                    |
  | `tenant_slug` | não         | default = env `DEFAULT_TENANT_SLUG`.                                     |
  | `inbox_phone` | não\*       | número WhatsApp Business que recebeu a msg. Aliases aceitos: `connected_phone`, `connectedPhone`. |

  \* `inbox_phone` é opcional pra retrocompat, mas **necessário em ambiente
  multi-linha** (ex.: TBC atende 2 números em paralelo). Sem ele, msgs de linhas
  diferentes caem na mesma thread.

  **Rejeições silenciosas a conhecer** — function devolve 400 com `ignored: true`
  quando o `phone` normalizado não tem 12 ou 13 dígitos. Isso bloqueia JID de
  grupo (`123@g.us`), identificadores anônimos `@lid` da Meta e IDs sintéticos
  do n8n antes que contaminem KPIs. Não é bug — é gate proposital.

  **Provedor Z-API:** os caminhos `$json.*` do n8n dependem do shape do webhook
  do seu provedor. Pra Z-API, o payload vem em `$json.body.*` — algo como
  `{{ $json.body.phone }}`, `{{ $json.body.text.message }}`,
  `{{ $json.body.senderName }}`, `{{ $json.body.connectedPhone }}` — mas
  confirme com um webhook real no seu flow, já que Z-API mudou shape entre
  versões. Você continua gravando no Postgres da DigitalOcean normalmente;
  esse nó só espelha pro Supabase pra alimentar o ads-dash.

### Disparo em massa

A função `whatsapp-send` aceita uma mensagem com placeholders `{{1}}`, `{{2}}`,
e substitui por `recipient.params` (ou `variables` como fallback). Cada envio
é uma chamada `send-text` da Z-API. O resultado consolidado é gravado em
`whatsapp_disparos`.
