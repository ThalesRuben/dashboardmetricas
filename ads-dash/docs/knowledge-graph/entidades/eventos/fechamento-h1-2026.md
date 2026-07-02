---
title: Fechamento H1/2026 — metas do ads-dash
data: 2026-07-02
tipo: evento
tags: [metas, faturamento, trafego, seed, supabase]
---

# Fechamento H1/2026 — metas do ads-dash

Sessão em 2026-07-02: gravação do realizado H1/2026 (faturamento + tráfego) na tabela `metas_kpi` do Supabase e ajuste do seed [[seed2026]] pra ficar consistente.

## Faturamento realizado

| Mês | Realizado |
|---|---|
| Jan/26 | R$ 315.559,55 |
| Fev/26 | R$ 294.542,23 |
| Mar/26 | R$ 370.824,27 |
| **Q1/26** | **R$ 980.926,05** |
| Abr/26 | R$ 372.926,64 |
| Mai/26 | R$ 428.256,98 |
| Jun/26 | R$ 407.389,58 |
| **Q2/26** | **R$ 1.208.573,20** |
| **H1/26 total** | **R$ 2.189.499,25** |

## Tráfego (investimento_ads) realizado

| Mês | Realizado |
|---|---|
| Jan/26 | R$ 8.300,00 |
| Fev/26 | R$ 5.844,54 |
| Mar/26 | R$ 17.018,61 |
| **Q1/26** | **R$ 31.163,15** |
| Abr/26 | R$ 18.854,49 |
| Mai/26 | R$ 21.130,88 |
| Jun/26 | R$ 23.549,75 |
| **Q2/26** | **R$ 63.535,12** |
| **H1/26 total** | **R$ 94.698,27** |

## Regra de seed adotada

- **Q1** (sem plano prévio de tráfego) foi tratado como "fechado real": `min=base=max=realizado`. Mesmo padrão que o faturamento Q1 já usava.
- **Q2** manteve o plano original (min/base/max) e só atualizou `valor_realizado`. Mesmo padrão que Abr/Mai já usavam.
- **Ano 2026 (tráfego)** recompôs base/mín/máx no padrão "Q1 real + Q2/Q3/Q4 planejados": base R$ 511.163,15 / mín R$ 473.163,15 / máx R$ 549.163,15.

## Migrations aplicadas

- `0016_seed_metas_h1_ads_real.sql` — realizado de tráfego H1.
- `0017_seed_junho_faturamento_real.sql` — fechamento Jun/2026 no faturamento e propagação pra Q2 e ano.
- Reapply de `get_metas_periodo` (RPC do `0013`) — a versão em prod estava sem `valor_meta_min`/`valor_meta_max` nas colunas retornadas.

## Commits

- `9db2238` — `chore(ads-dash): seed do realizado de tráfego H1/2026`
- `6749afa` — `chore(ads-dash): fechamento de Jun/2026 no faturamento`

## Nota pra futuro

O SQL Editor da Supabase pode dar impressão de sucesso mesmo quando `RAISE NOTICE` fica escondido pelo painel de resultado do último `SELECT`. Nesta sessão a `0016` originalmente não pegou em prod (inserts do Q1 tráfego sumiram, updates do Q2 não zeraram). Só descobri quando o usuário reclamou que "investimento em ads não aparece" na `/metas`. Padrão a adotar: sempre validar via `curl` no RPC `get_metas_periodo` depois de aplicar seed. Preferir `INSERT ... ON CONFLICT DO UPDATE` em vez de `UPDATE` puro (cria row se sumida).

## Links

- [[supabase]]
- [[dashboardmetricas]]
- [[the-blonde-concept]]
