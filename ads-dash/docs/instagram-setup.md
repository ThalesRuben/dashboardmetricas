# Instagram orgânico — setup pra dados reais

Guia pra ligar o painel `/instagram` do ads-dash a dados reais da conta @theblondeconcept via Meta Graph API. Depois disso, o cron do Supabase mantém tudo atualizado dia após dia.

**Status em 2026-07-22:**
- Edge function `instagram-sync` já existe no repo (`supabase/functions/instagram-sync/index.ts`).
- Ajustes de UI feitos: `OrganicAccountBar` reconhece "conectado" automaticamente quando os dados vêm reais (não dependem mais só de `localStorage`); botão de sync grava timestamp local pra exibir "última sync há X min".
- Falta o usuário: gerar tokens no Meta → colocar Secrets no Supabase → deploy da function → ligar cron.

---

## Passo 1 — Requisitos da conta @theblondeconcept

- Precisa ser conta **Business** ou **Creator** (não pessoal). Alternar em Instagram → Configurações → Conta → Alternar tipo de conta.
- Precisa estar **vinculada a uma Página do Facebook**. Instagram → Configurações → Conta → Compartilhar em outras redes → Facebook.
- Você tem que ter acesso a essa Página no Meta Business Suite (business.facebook.com).

## Passo 2 — Gerar o token long-lived (5–10 min)

1. Abre [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Escolhe um app tipo "Business" (ou cria em [developers.facebook.com/apps](https://developers.facebook.com/apps)).
3. "User or Page" → **Get User Access Token**.
4. Adiciona as permissões:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
5. **Generate Access Token** → faz login com a conta que administra a Página.
6. Copia o token curto (vale 1h).
7. Converte pra long-lived (60 dias) — cola no navegador:
   ```
   https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=SEU_APP_ID&client_secret=SEU_APP_SECRET&fb_exchange_token=TOKEN_CURTO
   ```
   `App ID`/`App Secret` estão em Meta for Developers → seu app → Settings → Basic.
8. O `access_token` retornado é o **IG_ACCESS_TOKEN**.

## Passo 3 — Pegar o IG_BUSINESS_ACCOUNT_ID

Com o token long-lived em mãos:

```
https://graph.facebook.com/v19.0/me/accounts?access_token=TOKEN_LONG_LIVED
```

Isso lista as Páginas. Pega o `id` da Página vinculada ao Instagram. Depois:

```
https://graph.facebook.com/v19.0/PAGE_ID?fields=instagram_business_account&access_token=TOKEN_LONG_LIVED
```

Retorna `{ "instagram_business_account": { "id": "17841401234567890" } }`. Esse é o **IG_BUSINESS_ACCOUNT_ID**.

## Passo 4 — Configurar Secrets no Supabase

Projeto DASH-TBC (`wvygpfeaifhkzxyrfzte`) → Edge Functions → Manage secrets. Adiciona:

- `IG_ACCESS_TOKEN` = token long-lived do passo 2
- `IG_BUSINESS_ACCOUNT_ID` = id do passo 3

## Passo 5 — Deploy da edge function

Se ainda não foi deployada:

```bash
cd C:\Users\thale\OneDrive\Desktop\ads-dash
supabase functions deploy instagram-sync --no-verify-jwt
```

## Passo 6 — Sync manual pra testar

No app `/instagram`, clica em **↻ Sincronizar**. Deve retornar toast "Sincronização concluída". Se der erro:

- 400 "IG_ACCESS_TOKEN ou IG_BUSINESS_ACCOUNT_ID não configurados" → volta ao passo 4.
- 500 com mensagem Graph API → provavelmente token expirado, permissão faltando ou a conta não é Business/Creator. Reabre o Passo 2.

Se der certo, confirma no Supabase Table Editor que `instagram_account_metrics` e `instagram_posts` têm linhas.

## Passo 7 — Ligar o cron diário

SQL Editor do Supabase:

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'instagram-sync-diario',
  '0 6 * * *',  -- 6h UTC = 3h em Brasília; ajuste se preferir outro horário
  $$
  select net.http_post(
    url := 'https://wvygpfeaifhkzxyrfzte.supabase.co/functions/v1/instagram-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'SUA_SERVICE_ROLE_KEY_AQUI'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Troca `SUA_SERVICE_ROLE_KEY_AQUI` pela **service_role** (Settings → API → service_role, NÃO a anon).

Pra verificar: `select * from cron.job;` — deve aparecer `instagram-sync-diario`.

## Renovação do token

Long-lived vale **60 dias**. Anote uma lembrete pra:

- Refazer o Passo 2 antes do vencimento, OU
- Migrar pra system user (token permanente do Business Manager) — recomendado se quiser esquecer disso pra sempre.

## Referência dos arquivos afetados

- `supabase/functions/instagram-sync/index.ts` — a function em si (lê Graph API v19, upsert em `instagram_account_metrics` + `instagram_posts`).
- `src/app/providers/MetricsContext.tsx` — `loadIg()` lê das tabelas, cai no `IG_MOCK` se vazio.
- `src/components/social/OrganicAccountBar.tsx` — barra de status "conectado / DEMO".
- `src/pages/InstagramPage.tsx` — botão manual de sync + grava timestamp em `localStorage["ads-dash:connections"].instagram`.
