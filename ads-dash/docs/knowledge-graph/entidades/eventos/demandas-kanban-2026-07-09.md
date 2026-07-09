---
title: Kanban de demandas — entrega inicial — 2026-07-09
data: 2026-07-09
tipo: evento
tags: [demandas, kanban, feature, ui, drag-and-drop]
---

# Kanban de demandas — entrega inicial — 2026-07-09

Adição de uma rota `/demandas` no ads-dash pra organizar as demandas internas do salão (estilo Trello/ClickUp) sem depender de ferramenta externa. Escolha do padrão nativo dentro do dash (em vez de embed de terceiro) foi motivada por manter tudo sob o mesmo login e abrir espaço pra futura integração com Inbox/Metas.

## Escopo do MVP

- 3 colunas fixas: **Backlog / Fazendo / Feito**.
- Card: título, descrição opcional, prioridade (baixa/média/alta) exibida como barra colorida na esquerda.
- Drag-and-drop entre colunas (HTML5 nativo, sem lib nova — decisão pra manter bundle enxuto).
- Modal pra criar/editar/remover, aberto pelo botão `+` da coluna ou clique no card.
- Sem responsável, sem data limite, sem reordenação dentro da coluna nessa versão.

## O que foi para produção

- **`0022_demandas.sql`** — tabela `demandas` (id, tenant_id, titulo, descricao, status, prioridade, ordem, criado_em, atualizado_em) com RLS por tenant e trigger de `atualizado_em`. Pendente aplicar no Supabase.
- **`src/features/demandas/`** — feature completa seguindo o padrão do projeto: `api/types.ts`, `api/demandasRepo.ts` (interface) + `demandasRepo.supabase.ts` + `demandasRepo.mock.ts` (com seed de 3 demandas pra funcionar sem banco), `hooks/useDemandas.ts` (CRUD + `moverPara` com update otimista), componentes `KanbanBoard`, `KanbanColumn`, `KanbanCard`, `DemandaModal`.
- **`src/pages/DemandasPage.tsx`** — página com `PageHeader` padrão e board.
- **Nav**: item `17 // DEMANDAS` no grupo SISTEMA do `Layout.tsx` + `--section-demandas` em `global.css` + entrada em `sectionColors.ts`.

## Decisões

- **DnD HTML5 nativo em vez de `@dnd-kit`**: MVP não precisa de reordenação intra-coluna com animação; se depois virar caso de uso, troca por dnd-kit sem quebrar interface do `KanbanColumn` (o handler `onDrop` já isola o transporte).
- **`ordem = Date.now()` ao criar/mover**: solução simples que garante ordem monotônica sem lock; suficiente pra volume esperado (dezenas de demandas). Se precisar de reordenação fina, troca por RPC de reordenamento em lote.
- **Sem RPC no repo Supabase, só `.from()` direto**: as operações são CRUD triviais e a RLS por tenant já filtra tudo. `current_user_tenants` é chamado só no `criar` pra preencher `tenant_id`.

## Passos pendentes

1. **Rodar `0022_demandas.sql`** no Supabase Dashboard (SQL Editor) — a migration não roda sozinha em produção, esse projeto aplica manualmente.
2. **Trocar `VITE_DATA_SOURCE` pra `supabase`** no Vercel se ainda estiver em `mock` na produção.
3. **Validar em prod** depois do deploy da Vercel: abrir `/demandas`, criar 1 card, arrastar entre colunas, editar, remover.

## Commit

- `5eaa0f8` — `feat(ads-dash): kanban de demandas com drag-and-drop nativo`

## Links

- [[supabase]]
- [[dashboardmetricas]]
- [[the-blonde-concept]]
