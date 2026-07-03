---
title: Reapply do RPC de cenários min/base/max — 2026-07-03
data: 2026-07-03
tipo: evento
tags: [metas, faturamento, trafego, supabase, rpc, cenarios]
---

# Reapply do RPC de cenários min/base/max — 2026-07-03

Sessão em 2026-07-03: fechamento do fix que a nota [[fechamento-h1-2026]] apontou como pendente — o RPC `get_metas_periodo` em prod ainda estava com a assinatura antiga do `0012`, sem `valor_meta_min`/`valor_meta_max`. Sem isso, o painel só via `valor_meta` base — os 3 cenários de faturamento e tráfego de Q2/Q3/Q4 não chegavam ao frontend.

## Diagnóstico

- `curl` no RPC anon confirmou: resposta para `trimestre 2026-Q3` só trazia `valor_meta` (base) — `valor_meta_min`/`valor_meta_max` **não estavam nas colunas retornadas** (assinatura antiga do `0012`).
- Dados na tabela `metas_kpi` estavam ok (base batia com os valores planejados), mas o RPC filtrava as colunas.
- Os arquivos `_reapply_rpc_cenarios.sql` e `_diag_ads_h1.sql` (criados em 2026-07-02) tinham o fix, mas não foram executados no SQL Editor — só ficaram como arquivos no repo.

## O que rodou

Bloco único no SQL Editor combinando:

1. `ALTER TABLE metas_kpi ADD COLUMN IF NOT EXISTS valor_meta_min/max` + constraint de `periodo`.
2. `DROP + CREATE FUNCTION get_metas_periodo` com a nova assinatura de `0013` (retornando min/base/max).
3. Seed idempotente do `0014_seed_metas_2026.sql` (faturamento + tráfego, todos os períodos, cenários min/base/max), preservando `valor_realizado` já fechado (Q1, Abr, Mai, Jun).
4. `NOTIFY pgrst, 'reload schema'` pra recarregar o cache do PostgREST.

## Estado final (verificado via RPC anon após o reapply)

### Faturamento

| Período | min | base | max | realizado |
|---|---|---|---|---|
| 2026-Q2 | 1.300.000 | 1.380.000 | 1.440.000 | 1.208.573,20 |
| 2026-Q3 | 1.760.000 | 1.870.000 | 1.950.000 | 0 |
| 2026-Q4 | 2.180.000 | 2.250.000 | 2.400.000 | 0 |
| Ano 2026 | 6.220.926,05 | 6.480.926,05 | 6.770.926,05 | 2.189.499,25 |

### Investimento em ads (tráfego)

| Período | min | base | max | realizado |
|---|---|---|---|---|
| 2026-Q2 | 82.000 | 90.000 | 98.000 | 63.535,12 |
| 2026-Q3 | 150.000 | 165.000 | 180.000 | 0 |
| 2026-Q4 | 210.000 | 225.000 | 240.000 | 0 |
| Ano 2026 | 473.163,15 | 511.163,15 | 549.163,15 | 94.698,27 |

Meses futuros (Jul-Dez) também confirmados com min/base/max preenchidos para os dois KPIs.

## Detalhe pego durante execução

O SELECT de verificação do script original listava `periodo_ref` como coluna, mas o `RETURNS TABLE` do RPC não expõe essa coluna — só `id, kpi, label, unidade, ordem, valor_meta, valor_meta_min, valor_meta_max, valor_realizado`. Deu `ERROR 42703: column "periodo_ref" does not exist`. User corrigiu na hora usando literal (`'2026-Q3' as periodo_ref`).

## Commits envolvidos

- `dec9247` — `chore(ads-dash): SQL de diag/reapply do realizado H1 e RPC cenários` (arquivos SQL versionados)
- Reapply propriamente aplicado no banco em 2026-07-03; não gerou migration nova (o `_reapply_rpc_cenarios.sql` já cobria o fix).

## Nota pra futuro

Reforça o padrão da [[fechamento-h1-2026]]: **sempre validar seed/RPC via `curl` no endpoint anon depois de rodar no SQL Editor**. "Rodou" no editor não garante que a assinatura do RPC foi atualizada (cache do PostgREST, ordem dos statements, ou simplesmente o arquivo esqueceu de ser executado). Um `curl` num período conhecido revela em segundos se o retorno tem as colunas esperadas.

## Links

- [[fechamento-h1-2026]]
- [[supabase]]
- [[dashboardmetricas]]
