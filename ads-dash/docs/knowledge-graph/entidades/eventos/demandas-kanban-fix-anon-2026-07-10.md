---
title: Kanban de demandas — fix anon + ordem bigint — 2026-07-10
data: 2026-07-10
tipo: evento
tags: [demandas, kanban, rls, anon, tenant, supabase, paciente-1]
---

# Kanban de demandas — fix anon + ordem bigint — 2026-07-10

Follow-up da entrega de 2026-07-09. Ao testar o `/demandas` em prod, o botão **Salvar** não gravava — o modal ficava aberto, nada aparecia no board, nada era escrito no Supabase. Investigação mostrou dois bugs empilhados; ambos corrigidos e validados end-to-end.

## Bug 1 — `criar` incompatível com login estático ✅ corrigido

O repo `demandasRepo.supabase.ts` resolvia o tenant via RPC `current_user_tenants()` antes do INSERT. Mas o ads-dash roda com **login estático** (`AuthProvider` → `DEV_LOGIN`/`static-user`), sem sessão Supabase real. Consequência:

- `auth.uid()` é `null` no browser
- `current_user_tenants()` retorna `setof uuid` vazio
- `currentTenantId()` devolve `null`
- `criar` joga `Error('Tenant não encontrado.')`, o `handleSubmit` do modal cai no `finally` mas o `setModalOpen(false)` do `KanbanBoard` nunca roda — daí a impressão de "clicou mas nada aconteceu"

E mesmo se hardcodássemos o `tenant_id` no cliente, a policy `demandas_tenant_isolation` de `0022` (`for all using (tenant_id in (select current_user_tenants()))`) rejeitaria o INSERT pelo mesmo motivo.

**Fix** — `0023_demandas_anon.sql`:

- Nova função `paciente_1_tenant_id()` (security definer) que resolve o UUID do tenant `the-blonde-concept` bypassing RLS
- `alter table public.demandas alter column tenant_id set default public.paciente_1_tenant_id()` — cliente não envia mais `tenant_id`, o server preenche
- Policy permissiva `demandas_anon_all for all using (true) with check (true)` — libera CRUD anon (permissivas são OR'd, convive com a policy de tenant original)
- Repo simplificado: `criar` deixa de chamar RPC, só faz `.from('demandas').insert({ titulo, descricao, status, prioridade, ordem })`

## Bug 2 — `ordem` estourando int32 ✅ corrigido

Só apareceu depois que o Bug 1 destravou o INSERT. `0022` criou a coluna como `int`, mas o cliente grava `ordem = Date.now()` (~1.75e12) em `criar`/`moverPara`. PostgREST devolvia:

```
{"code":"22003","message":"value \"1752163200000\" is out of range for type integer"}
```

**Fix** — `0024_demandas_ordem_bigint.sql`: `alter column ordem type bigint`. Sem migração de dados (tabela zerada em prod).

## Validação end-to-end

Simulei o UI via anon key contra o Supabase remoto — CREATE → LIST → PATCH (mover coluna) → PATCH (editar título/prio) → DELETE. Resultados:

| passo | esperado | observado |
|---|---|---|
| POST sem `tenant_id` | 201 + row com `tenant_id` preenchido | ✅ `tenant_id=31cc6350-…` |
| GET anon | 200 + array | ✅ retornou o row |
| PATCH `status`+`ordem` | 204 | ✅ |
| PATCH `titulo`+`prioridade` | 204 + `atualizado_em` novo | ✅ trigger `demandas_touch` disparou |
| DELETE | 204 + GET vazio | ✅ |

Depois do deploy Vercel do commit `e3284fa`, testado no UI em prod pelo Thales: **funcionou**.

## O que foi para produção

- **`0023_demandas_anon.sql`** — policy anon + default de tenant. Aplicado no Supabase.
- **`0024_demandas_ordem_bigint.sql`** — `ordem` int → bigint. Aplicado no Supabase.
- **`src/features/demandas/api/demandasRepo.supabase.ts`** — remove `currentTenantId()`, insert não manda `tenant_id`.

## Commits

- `7133541` — `fix(ads-dash): kanban de demandas grava sob login estático`
- `e3284fa` — `fix(ads-dash): demandas.ordem passa a bigint`

## Padrão pra próximas features

Registrei em memória (`ads-dash-paciente1-write-pattern.md`): **toda tabela nova que o front escrever direto precisa entrar já com policy anon + default de tenant via `paciente_1_tenant_id()`**. Cliente nunca setando `tenant_id`. Se a escrita for via edge function com service role (padrão WhatsApp), essa regra não se aplica.

Quando o app virar multi-tenant com Supabase Auth real, remover as policies anon e voltar ao isolamento por `current_user_tenants()`.

## Nota pra futuro

Bug 2 (int vs bigint) só apareceu depois de destravar o Bug 1 — clássico do "descasca a cebola". A entrega original de 2026-07-09 marcava a feature como validada em prod, mas a nota registrava só "passos pendentes: aplicar migration e trocar VITE_DATA_SOURCE" — a validação real do fluxo write nunca tinha rodado. Lição: pra features CRUD, o "validado em prod" só vale depois de bater CREATE + UPDATE + DELETE via curl anon (não só o SELECT).

Ver também [[fechamento-h1-2026]] e [[whatsapp-tempo-resposta-2026-07-03]] pra o mesmo padrão de `curl` no PostgREST anon como truth source depois de rodar SQL.

## Links

- [[demandas-kanban-2026-07-09]]
- [[supabase]]
- [[dashboardmetricas]]
- [[the-blonde-concept]]
