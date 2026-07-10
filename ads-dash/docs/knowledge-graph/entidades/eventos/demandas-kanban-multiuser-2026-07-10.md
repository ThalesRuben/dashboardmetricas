---
title: Kanban de demandas — multi-user com login real — 2026-07-10
data: 2026-07-10
tipo: evento
tags: [demandas, kanban, auth, supabase-auth, multi-user, rls, equipe]
---

# Kanban de demandas — multi-user com login real — 2026-07-10

Terceira iteração do `/demandas` no mesmo dia (2026-07-10). Depois do fix anon + `ordem bigint` de manhã, o pedido virou: **"várias pessoas da equipe vão usar, precisa ter login por pessoa e as demandas não podem ficar bagunçadas"**. Migração completa do padrão paciente-1 (login estático) pra Supabase Auth real, com autoria por card e filtros por responsável.

## Decisões antes de codar

Quatro perguntas guiaram o escopo:

1. **Escopo do login** — só `/demandas` ou app inteiro? → **app inteiro**, aposenta o `DEV_LOGIN` de vez
2. **Como as pessoas entram** — signup aberto ou admin cria manual? → **manual pelo Dashboard** (mais seguro pra 5 pessoas, sem risco de cadastro externo)
3. **O que "bagunçadas" significa** — falta de dono, filtro, ou race na ordem? → **filtro** (quero ver só as minhas / da fulana)
4. **Roles** — hierarquia (owner/admin/member) ou plano? → **plano, todo mundo igual** (5 pessoas do salão, sem necessidade de gate)

## O que foi para produção

### `0025_demandas_multiuser.sql`

- **Remove** policy `demandas_anon_all` (0023 aposentada) — demandas volta ao isolamento por tenant via `current_user_tenants()`
- **Troca** default do `tenant_id` de `paciente_1_tenant_id()` pra `current_user_first_tenant()` — resolve via `auth.uid()` real
- **Adiciona** `criado_por uuid references auth.users(id)` com default `auth.uid()` (autoria automática no INSERT)
- **Adiciona** `responsavel_id uuid references auth.users(id)` (opcional, definido no modal)
- **Cria RPC** `demandas_team_members()` (security definer) — retorna `(id, full_name)` dos membros do tenant do usuário autenticado, pra popular dropdowns no front

### Refactor do cliente (commit `a8672c3`)

- **`AuthProvider.tsx`** — remove `DEV_LOGIN`, `VITE_ALLOW_STATIC_LOGIN`, `VITE_DEV_LOGIN_*`. Só sessão real via `signInWithPassword`
- **`demandasRepo.supabase.ts`** — `criar` não envia mais `tenant_id`/`criado_por` (defaults do banco preenchem); `atualizar` aceita `responsavel_id`; nova função `listarEquipe()` chamando o RPC
- **`useDemandas`** — expõe `equipe: TeamMember[]` junto com `porStatus`
- **`KanbanCard`** — mostra avatar de iniciais + nome do responsável
- **`KanbanBoard`** — nova toolbar com filtros `Todas | Minhas | dropdown por pessoa`
- **`DemandaModal`** — dropdown "Responsável" com opção "sem responsável"

### Bootstrap dos 5 usuários

Criados manualmente em Auth → Users com "Auto Confirm User" marcado (pula email de confirmação):

| Nome | Email | membership | profile |
|---|---|---|---|
| Ana Clara | annacllara2010@gmail.com | admin | admin |
| Ana Flavia | anaferrevier@gmail.com | admin | admin |
| Fabio Oliver | faabio.olivercouto@gmail.com | owner | admin |
| Rodrigo Miguel | contato.rodrigomiguel@gmail.com | admin | admin |
| Thales Ruben | thalesruben27@gmail.com | owner | admin |

Detalhe do schema: `profiles_role_check` só aceita `'admin' | 'editor' | 'viewer'` — por isso `profile.role` ficou `admin` mesmo pros dois "owners" do memberships. Como o front usa `role` só como rótulo (não gateia nada — RLS é 100% por tenant), sem impacto funcional.

Signup público desativado em **Auth → Providers → Email → Enable Sign Ups: OFF**.

## Validação

Testado em prod pelo Thales depois do deploy: login funciona, `/demandas` carrega, criação com responsável funciona, filtros `Minhas` e `Por pessoa` funcionam, DnD entre colunas funciona.

## Impacto colateral

- Todo mundo que estava usando o dashboard com o login estático foi deslogado no próximo carregamento — precisa logar com email/senha real agora
- `VITE_DEV_LOGIN_*` e `VITE_ALLOW_STATIC_LOGIN` viraram variáveis mortas — podem sair da Vercel na próxima limpeza
- Padrão de escrita anon do paciente-1 fica marcado como **aposentado** — features novas devem usar RLS por tenant real desde o início

## Commit

- `a8672c3` — `feat(ads-dash): kanban de demandas multi-usuário com login real`

## Nota pra futuro

O ciclo de 3 iterações no mesmo dia é sintomático da tensão MVP↔escala do "paciente 1": features nascem pra funcionar sob login estático (rápido de fazer), mas a primeira feature colaborativa força a migração pra auth real. Vale considerar antecipar isso pras próximas features multi-usuário, já entregando com Supabase Auth desde a v1 em vez de nascer anon e migrar depois.

Ver também [[demandas-kanban-2026-07-09]] (entrega inicial) e [[demandas-kanban-fix-anon-2026-07-10]] (fix anon + bigint da manhã) pro contexto anterior.

## Links

- [[demandas-kanban-2026-07-09]]
- [[demandas-kanban-fix-anon-2026-07-10]]
- [[supabase]]
- [[dashboardmetricas]]
- [[the-blonde-concept]]
