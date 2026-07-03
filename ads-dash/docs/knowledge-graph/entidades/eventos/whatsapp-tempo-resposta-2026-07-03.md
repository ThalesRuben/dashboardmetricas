---
title: Tempo de resposta do WhatsApp — investigação e fix — 2026-07-03
data: 2026-07-03
tipo: evento
tags: [whatsapp, kpi, tempo-resposta, sla, n8n, inbox-ingest, lid]
---

# Tempo de resposta do WhatsApp — investigação e fix — 2026-07-03

Sessão em 2026-07-03: a coluna "T. RESPOSTA" do `InboxReportCard` estava mostrando 8570m/9083m (~6 dias) no painel. Investigação virou uma cebola de 4 camadas — cada uma matando a hipótese anterior — e terminou revelando um bug do workflow n8n envolvendo o identificador `@lid` do WhatsApp Cloud API. Fix parcial em produção; causa raiz ficou como próximo passo no Termius.

## Cebola de hipóteses

### Camada 1 — Média inflada por outliers ✅ resolvido

O cálculo era `avg(primeira_resposta - primeira_msg_cliente)`. Threads com resposta tardia contaminavam a média. **Fix**: `0020_whatsapp_response_time_median.sql` — trocou `avg` por `percentile_cont(0.5)` (mediana) e adicionou `pct_sla_resposta` (% respondidas em ≤10min). Frontend passou a mostrar "X% em ≤10min" no delta do KpiCard.

Resultado: mediana caiu de 8570 → **10025min (~7 dias)**. Sinal claro de que o problema não era só cauda longa.

### Camada 2 — Mirror do n8n dropando outbound ❌ descartada

Hipótese: `taxa_resposta = 12.6%` era baixa demais, provavelmente mirror só ingeria inbound.

Descartada por 2 sinais:
- Timestamps do atendente têm 98% de unicidade por segundo (idêntica a cliente) — não é batch com `now()`
- Query cross-check: **34/34 threads que viraram `agendado` têm ao menos uma msg do atendente**. Se o mirror dropasse outbound, alguns agendamentos teriam 0 respostas — nenhum tinha.

### Camada 3 — Threads fantasma com autor invertido ✅ diagnosticado

Query encontrou **966 threads em 30 dias** com ≥3 msgs de cliente e 0 do atendente. Anatomia:

- **5 threads** com JID de grupo (>15 dígitos, cliente_nome = "The Blonde Concept" — grupo interno da equipe ingerido como se fosse conversa)
- **437 threads** com `phone` de 14-15 dígitos (prefixos exóticos tipo 103, 227, 146 — nenhum código de país válido)
- **524 threads** com telefone BR normal (12-13 dígitos)

Query 3 foi a smoking gun: as "primeiras msgs de cliente" das 437 são **scripts do próprio salão** — "Como posso te ajudar?" (44x), "Me chamo Thaynara, sou assessora do Fábio Oliver 💛" (11x), cotações de corte. Ou seja: mensagens **outbound do atendente** sendo gravadas com `autor = 'cliente'`.

Cross-check: 100% dessas 3107 msgs têm `msg_id_externo` preenchido → não são geradas internamente, vieram do webhook do Cloud API mas com `direction` invertido no caminho.

### Camada 4 — `@lid` no payload ⚠️ causa raiz confirmada

Depois de deployar o filtro por comprimento no `inbox-ingest`, os logs `ingest-reject` mostraram: **os phones bloqueados vêm com sufixo `@lid`** — `213825685053525@lid`, `254309442785532@lid`.

`@lid` é o **Linked ID** anônimo da Meta/WhatsApp, usado em contextos onde o Cloud API não expõe o MSISDN real (feature de privacidade). O n8n estava passando essa string bruta no campo `phone`, e o `normalizarPhoneBR` só tirava `@lid` por regex, deixando 14-15 dígitos que passavam pelo filtro anterior (só `!phone`).

## O que foi para produção

- **`0020_whatsapp_response_time_median.sql`** — mediana + `pct_sla_resposta`. Aplicado no banco.
- **`0021_whatsapp_response_time_new_leads.sql`** — restringe cálculo a threads criadas no período (SLA de primeira resposta pra leads novos, em vez de misturar com replique em conversa continuada). Aplicado no banco.
- **`supabase/functions/inbox-ingest/index.ts`** — rejeita payloads com `phone` ou `inbox_phone` de comprimento ≠ 12-13. Loga `tag: 'ingest-reject'` com o motivo. Deploy manual pelo Supabase Dashboard (edge function não é publicada por push).
- **Frontend**: `WhatsAppPage.tsx` e `InboxReportCard.tsx` mostram mediana + "X% ≤10m" (delta do KpiCard e sub-linha do card). Types + mock atualizados.

## Estado atual (2026-07-03)

- **Torneira fechada**: `@lid` novo não entra mais no banco.
- **Painel**: KPI ainda mostra mediana ~7 dias e SLA 0% — não vai melhorar até (a) o n8n corrigir o `direction` para as msgs `@lid` legítimas e (b) as 437 threads existentes serem reparadas/deletadas.
- **Tradeoff aceito temporariamente**: mensagens de clientes reais que aparecem via `@lid` também são bloqueadas — o atendente vê no app do WhatsApp, mas KPI perde visibilidade. Fix definitivo é resolver `@lid → MSISDN` no workflow n8n via lookup do Cloud API.

## Passos pendentes

1. **n8n workflow** — abrir Termius, achar o node que decide `direction` no payload pro `inbox-ingest`. Alta suspeita: campo do envelope da Meta sendo lido errado, misclassificando outbound como inbound quando o recipient tem `@lid`.
2. **Reparo dos 437** — decidir entre flip de autor (se são atendimento real com direction invertido) ou delete (se são artefato puro). Depende do que o n8n revelar.
3. **Purge dos 5 JIDs de grupo** — script one-shot pequeno.
4. **Long-term `@lid` handling** — resolver via Cloud API contact lookup no n8n.

## Commits

- `4a956a2` — `feat(ads-dash): tempo de resposta WhatsApp usa mediana + SLA 10min`
- `b5a30a2` — `feat(ads-dash): inbox-ingest rejeita phones fora do formato BR`
- `4b0f1f8` — `feat(ads-dash): SLA de primeira resposta restrito a threads novas`

## Nota pra futuro

Padrão de investigação que funcionou nessa sessão: cada hipótese foi testada com uma query SQL discreta antes de propor código. As 4 camadas caíram uma a uma sem prejulgar — o `@lid` só apareceu porque a torneira foi fechada primeiro (filtro por length) e depois lida no log do gate. Se tivéssemos ido direto pro n8n antes de blindar, teríamos ficado no escuro sem saber o quê procurar.

Ver também [[fechamento-h1-2026]] pro precedente do mesmo padrão (validar via `curl` no RPC anon depois de rodar SQL).

## Links

- [[supabase]]
- [[dashboardmetricas]]
- [[the-blonde-concept]]
