# Backoffice — The Blonde Concept

Backoffice de marketing para análise de métricas de Meta Ads, Google Ads e redes sociais orgânicas (Instagram, TikTok, YouTube) — com ROAS, ROI, CTR, mensagens (CTWA), agendamentos, vendas aprovadas, análise de concorrentes e agente de IA.

## Stack
- **Frontend:** React 18 + Vite
- **Backend/Auth:** Supabase (PostgreSQL + Auth)
- **Deploy:** Vercel
- **Charts:** Chart.js + react-chartjs-2

## Estrutura de telas
| Tela | Rota | Descrição |
|------|------|-----------|
| Login | `/login` | Autenticação com bloqueio por tentativas |
| Dashboard | `/` | KPIs, funil, gráficos, tabela de campanhas |
| Integrações | `/integrations` | API nativa, conector externo ou entrada manual |
| Relatórios | `/reports` | Exportação PDF e Excel |
| Alertas | `/alerts` | Metas, limites e notificações |
| Configurações | `/settings` | Usuários, perfis e segurança |

## Como rodar localmente

### 1. Clone e instale
```bash
git clone <seu-repo>
cd ads-dashboard
npm install
```

### 2. Configure o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No SQL Editor, execute o arquivo `supabase-schema.sql`
3. Em **Authentication → Settings**, ative o provider de e-mail

### 3. Variáveis de ambiente
```bash
cp .env.example .env
```
Preencha `.env` com as credenciais do seu projeto Supabase:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...
```

### 4. Crie o primeiro usuário admin
No painel do Supabase → **Authentication → Users → Invite user**, adicione seu e-mail.
Depois, no SQL Editor, atualize o perfil para admin:
```sql
update public.profiles
set role = 'admin', full_name = 'Seu Nome'
where id = (select id from auth.users where email = 'seu@email.com');
```

### 5. Inicie o servidor
```bash
npm run dev
```
Acesse: `http://localhost:5173`

---

## Deploy na Vercel

1. Faça push do projeto para o GitHub
2. No [vercel.com](https://vercel.com), importe o repositório
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy! O `vercel.json` já cuida do roteamento SPA.

---

## Integrando dados reais

### Opção A — Supabase Edge Function (API direta)
Crie uma Edge Function `sync-metrics` que chama a Meta Graph API e Google Ads API e grava na tabela `daily_metrics`. Configure um cron job com `pg_cron`.

### Opção B — Supermetrics / Funnel.io
Configure o webhook apontando para sua Edge Function. Os dados chegam automaticamente no intervalo escolhido.

### Opção C — Entrada manual
Use a tela de Integrações para inserir os dados diretamente. O hook `useMetrics` prioriza dados do Supabase e usa mock como fallback.

---

## Telas planejadas
- [ ] Exportação real de PDF (usando `jsPDF`)
- [ ] Exportação real de Excel (usando `xlsx`)
- [ ] Envio de alertas via WhatsApp (API Cloud)
- [x] Notificações por e-mail (Supabase Edge Function + Resend)
- [x] Agente de IA nativo (modo local de regras + gancho para LLM)

---

## Agente de IA nativo

A plataforma traz um assistente que analisa as métricas em tempo real:

- **Insights automáticos** no Dashboard (painel acima do funil) — gera 3 a 6 recomendações por carga
- **Chat flutuante** disponível em qualquer tela (botão azul no canto inferior direito) — responde perguntas como "qual campanha pausar?", "por que meu ROAS caiu?", "como melhorar mensagens?"
- Lógica em [src/lib/aiInsights.js](src/lib/aiInsights.js) — motor de regras, **sem chave de API**, roda 100% no navegador
- Para conectar Claude/OpenAI no futuro: substituir `answerQuestion()` por uma chamada a uma Edge Function

---

## Relatórios automáticos por e-mail

A aba **Relatórios → Agendamentos automáticos** permite agendar envios diários, semanais ou mensais.

### Stack
- **Edge Function** [supabase/functions/send-report/index.ts](supabase/functions/send-report/index.ts) — monta o HTML e envia via [Resend](https://resend.com)
- **Cron** definido em [supabase/cron-setup.sql](supabase/cron-setup.sql) — chama a função a cada 15 min via `pg_cron` + `pg_net`
- **Tabelas** `report_schedules` e `report_sends` (já no `supabase-schema.sql`)

### Deploy passo a passo

1. **Crie conta no Resend** em [resend.com](https://resend.com) e gere uma API key
2. **Verifique seu domínio** no Resend (ou use `onboarding@resend.dev` em teste)
3. **Configure os secrets** em Supabase → Project Settings → Edge Functions → Secrets:
   ```
   RESEND_API_KEY = re_xxxxxxxxxxxx
   RESEND_FROM    = The Blonde Concept <relatorios@seudominio.com>
   ```
4. **Deploy da função** (precisa do [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJETO_REF
   supabase functions deploy send-report --no-verify-jwt
   ```
5. **Agende o cron** — abra o SQL Editor, edite [supabase/cron-setup.sql](supabase/cron-setup.sql) com sua URL e service key, e execute
6. **Teste** — crie um agendamento na UI e clique em "✉ Enviar" para disparar imediatamente

### Modo local (sem deploy)
Se a tabela `report_schedules` não existir, a UI cai em modo localStorage automaticamente — você consegue criar/listar agendamentos para conferir o fluxo, mas o **envio real** exige a Edge Function deployada.

### Envio por WhatsApp (opcional)
Além de e-mail, os agendamentos suportam **WhatsApp** via WhatsApp Cloud API (Meta). Configure nos secrets da Edge Function:
```
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890
```
Como obter: crie um app no [Meta for Developers](https://developers.facebook.com/apps) → adicione o produto **WhatsApp** → pegue o token permanente e o Phone Number ID.

> ⚠️ **Limitação da API:** mensagem de texto livre só é entregue se o número **iniciou conversa com o negócio nas últimas 24h**. Para envio proativo garantido (relatório diário sem o cliente ter mandado mensagem antes), é preciso criar e aprovar um **template de mensagem** no Meta Business — a função `send-report` hoje envia texto livre; trocar para template é uma alteração pontual em `sendViaWhatsApp`.

---

## Análise de conteúdo dos concorrentes (taxonomia rica)

A página **/concorrentes → Conteúdos validados** vai além de "tema + curtidas": cada conteúdo registrado é classificado em 4 dimensões de formato:

- **Gancho** — o que prende nos primeiros segundos (resultado primeiro, pergunta, choque, storytelling…)
- **Emoção** — o que o conteúdo desperta (surpresa, inspiração, identificação, urgência…)
- **Áudio** — estratégia sonora (áudio em alta, original, narração…)
- **Ritmo de edição** — cortes rápidos, plano único, slideshow…

A IA cruza tudo e gera o **"DNA do conteúdo vencedor"** — a fórmula ponderada por engajamento que mais funciona no seu nicho, pronta para replicar. Lógica em [src/components/competitors/ValidatedContent.jsx](src/components/competitors/ValidatedContent.jsx) e [src/lib/aiInsights.js](src/lib/aiInsights.js).

---

## Instagram orgânico

A rota **/instagram** mostra métricas orgânicas: seguidores, alcance, engajamento, top posts (Reels/Imagens/Carrosséis/Stories) e crescimento.

### Stack
- **Edge Function** [supabase/functions/instagram-sync/index.ts](supabase/functions/instagram-sync/index.ts) — chama a Meta Graph API e popula as tabelas
- **Tabelas** `instagram_account_metrics` (snapshot diário) e `instagram_posts` (já no `supabase-schema.sql`)
- **Hook** [src/hooks/useInstagramMetrics.js](src/hooks/useInstagramMetrics.js) — lê do Supabase com fallback para mock

### Pré-requisitos no Meta
1. Sua conta do Instagram precisa ser **Business** ou **Creator** (Settings → Account → Switch to Professional)
2. Conectar essa conta a uma **Página do Facebook** (Business Settings → Accounts → Instagram Accounts)
3. Criar um **App Business** em [developers.facebook.com/apps](https://developers.facebook.com/apps)
4. Adicionar os produtos: **Instagram Graph API** + **Facebook Login for Business**
5. Pedir as permissões: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`
6. Gerar um **Long-Lived Access Token** (60 dias) via Graph API Explorer + endpoint `/oauth/access_token`
7. Pegar o **Instagram Business Account ID** (chame `/me/accounts` → `/{page_id}?fields=instagram_business_account`)

### Deploy da função
```bash
supabase functions deploy instagram-sync --no-verify-jwt
```

Configure os secrets em **Supabase → Edge Functions → Secrets**:
```
IG_ACCESS_TOKEN          = EAAxxxxxxxxxxxxxxxxxxxxxx...
IG_BUSINESS_ACCOUNT_ID   = 17841401234567890
```

Para sincronizar manualmente, abra a página /instagram e clique em **"Sincronizar agora"** (chama a Edge Function via `supabase.functions.invoke`).

### Cron (1x por hora)
Adicione ao [supabase/cron-setup.sql](supabase/cron-setup.sql) (depois do bloco do `send-report`):
```sql
select cron.schedule(
  'ads-dashboard-instagram-sync',
  '0 * * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/instagram-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

### Limitações da Graph API
- Métricas como `reach`, `impressions`, `profile_views` precisam que a conta seja Business há **ao menos 24h** com dados disponíveis
- Long-lived tokens expiram em **60 dias** — renove antes; a Edge Function não faz auto-refresh
- Posts antigos (mais de 2 anos) podem retornar `insights` vazio
- Stories ficam disponíveis na API por **24h**, então a sincronização precisa rodar pelo menos a cada 1h pra capturar tudo
