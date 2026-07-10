---
title: Sessão ads-dash — resumo do dia — 2026-07-10
data: 2026-07-10
tipo: evento
tags: [sessao, resumo, demandas, kanban, auth, supabase, encerramento]
---

# Sessão ads-dash — resumo do dia — 2026-07-10

Fecha um dia denso no ads-dash: três iterações no kanban de demandas, migração de arquitetura de auth, e validação end-to-end em prod. Deixado esse resumo pra facilitar retomar a operação nas próximas sessões.

## O que foi feito hoje

### Manhã — fix do "Salvar" quebrado em prod

O kanban entregue em 2026-07-09 travava no `Salvar` — o modal ficava aberto e nada acontecia. Investigação revelou dois bugs empilhados:

1. **Login estático × RLS por tenant** — o repo tentava resolver o tenant via RPC `current_user_tenants()`, mas o `AuthProvider` usa login estático (`DEV_LOGIN`/`static-user`), então `auth.uid()` era `null` e a chamada voltava vazia. Corrigido com `0023_demandas_anon.sql` (policy anon + default `paciente_1_tenant_id()`).
2. **`ordem` int estourando** — só apareceu depois do fix acima: `Date.now()` (~1.75e12) estourava int32. Corrigido com `0024_demandas_ordem_bigint.sql`.

Detalhe cheio em [[demandas-kanban-fix-anon-2026-07-10]].

### Tarde — kanban vira multi-user com login real

Pedido novo: "várias pessoas da equipe vão usar, precisa ter login por pessoa e as demandas não podem ficar bagunçadas". Migração completa:

- **`0025_demandas_multiuser.sql`** — remove policy anon, adiciona `criado_por`/`responsavel_id`, cria RPC `demandas_team_members()`
- **`AuthProvider`** — aposenta `DEV_LOGIN`/`VITE_ALLOW_STATIC_LOGIN`, exige `signInWithPassword` real
- **5 contas criadas** no Supabase Auth (Ana Clara, Ana Flavia, Fabio Oliver, Rodrigo Miguel, Thales Ruben)
- **Signup público desativado** em Auth → Providers → Email
- **UI ganha** dropdown de responsável no modal, avatar/nome no card, filtros `Todas | Minhas | Por pessoa` na toolbar do board

Detalhe cheio em [[demandas-kanban-multiuser-2026-07-10]].

### Validação final

Testado em prod pelo Thales e batido via anon curl daqui: RLS bloqueia INSERT/SELECT sem sessão real (`42501 row-level security policy`), RPC de membros retorna vazio pra anon, login page carrega, bundle novo (`index-vCUbQ8et.js`) está no ar.

## Estado do repo no fim do dia

- **`main`** em `946f09b` (limpo, tudo pushado)
- **6 commits novos hoje**: `7133541` fix anon, `6d1283f` chore graph, `e3284fa` fix bigint, `7cc06b4` doc fix, `a8672c3` multi-user, `946f09b` doc multi-user
- **3 migrations aplicadas**: `0023`, `0024`, `0025` (todas rodadas manualmente no SQL Editor)
- **Vercel**: deploy automático a partir do `main`, bundle atual `index-vCUbQ8et.js`
- **Supabase**: 5 usuários ativos em `the-blonde-concept`, signup fechado, RLS de demandas restaurada

## Envs mortas (limpar quando quiser)

Ficaram inertes depois da aposentadoria do login estático, podem sair da Vercel:

- `VITE_DEV_LOGIN_EMAIL`
- `VITE_DEV_LOGIN_PASSWORD`
- `VITE_DEV_LOGIN_NAME`
- `VITE_ALLOW_STATIC_LOGIN`

Não urgente — não estão fazendo nada.

## Pontos abertos / próximas sessões

- **Roles reais** — hoje `role` é só rótulo cosmético (front não gateia, RLS é 100% por tenant). Se quiser diferenciar poderes (ex.: só `owner` pode deletar demanda), precisa policy por role.
- **Extensões possíveis do kanban** — data limite, reordenação dentro da coluna (troca DnD nativo por `@dnd-kit`), comentários no card, integração com Inbox/Metas.
- **Padrão paciente-1** — marcado como aposentado no memory. Próximas features do ads-dash devem nascer já com Supabase Auth real e RLS por tenant, sem passar pelo ciclo "anon → migra depois".

## Lição registrada

Ver [[demandas-kanban-multiuser-2026-07-10#Nota pra futuro]]: features novas multi-usuário devem já nascer com auth real em vez de nascer anon e migrar depois. O ciclo de 3 iterações num dia foi sintomático dessa tensão.

## Links

- [[demandas-kanban-2026-07-09]] — entrega inicial
- [[demandas-kanban-fix-anon-2026-07-10]] — fix da manhã
- [[demandas-kanban-multiuser-2026-07-10]] — multi-user da tarde
- [[supabase]]
- [[dashboardmetricas]]
- [[the-blonde-concept]]
