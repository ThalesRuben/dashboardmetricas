# Histórico de desenvolvimento — Backoffice The Blonde Concept

Registro do que foi construído na plataforma, em ordem cronológica.
Projeto: dashboard de métricas de Meta Ads, Google Ads e redes sociais orgânicas para salão de beleza.
Stack: React 18 + Vite · Supabase (Postgres + Auth + Edge Functions) · Chart.js · deploy Vercel.

---

## 1. Conclusão da base do projeto

O projeto já tinha estrutura inicial. Foi completado o que faltava:

- `public/favicon.svg` — ícone que estava referenciado mas não existia
- `useMetrics` — adicionados os mocks de período **semana** e **mês** (antes só existia "hoje"); exposto `refresh()` e `saveDailyMetrics()`
- `useGoals` e `useAlerts` — hooks novos, leem `goals` e `alerts` do Supabase com fallback
- **AlertsPage** — passou a consumir os hooks reais (metas persistem no Supabase)
- **IntegrationPage** — botão "Salvar no dashboard" grava entrada manual em `daily_metrics`
- **ReportsPage** — exportação real: HTML imprimível (PDF) e CSV com BOM (Excel)

## 2. Login de desenvolvimento

- Login local (`thalesruben27@gmail.com`) que funciona sem Supabase configurado
- Depois movido para variáveis de ambiente — só funciona em modo dev (`npm run dev`), nunca no build de produção
- Senha atualizada para credenciais do usuário

## 3. Tema escuro

- Sistema de variáveis CSS semânticas (`--bg`, `--text`, `--border`...) com sobrescrita em `[data-theme="dark"]`
- `ThemeContext` com persistência em localStorage + detecção de preferência do SO
- Botão de alternância na sidebar (sol/lua)
- Todas as 11 folhas `.module.css` migradas para as variáveis
- Gráficos Chart.js reagem ao tema (cores de linha, grid, tooltip)

## 4. Agente de IA nativo + relatórios automáticos por e-mail

**IA:**
- `src/lib/aiInsights.js` — motor de regras que analisa métricas e gera recomendações (sem API externa)
- `AiAssistant` — chat flutuante disponível em qualquer tela
- `InsightsPanel` — painel de insights automáticos no Dashboard

**Relatórios por e-mail:**
- `useReportSchedules` — CRUD de agendamentos (com fallback localStorage)
- Aba "Agendamentos automáticos" em /relatorios
- Edge Function `send-report` — monta HTML e envia via Resend
- `cron-setup.sql` — agendamento via pg_cron a cada 15 min
- Tabelas `report_schedules` e `report_sends`

## 5. Instagram orgânico

- Rota /instagram + `useInstagramMetrics` (mock + fallback Supabase)
- KPIs: seguidores, alcance, impressões, visitas ao perfil, cliques, engajamento
- Gráficos: crescimento de seguidores, engajamento semanal, alcance por dia
- `IgTopPosts` — grid de posts com filtro e ordenação
- Edge Function `instagram-sync` — chama a Meta Graph API
- Tabelas `instagram_account_metrics` e `instagram_posts`
- Insights de IA específicos de Instagram

## 6. Navegação por datas

- `DateRangePicker` — componente reutilizável com presets + intervalo personalizado
- `useDailyMetrics` — gerador de métricas dia-a-dia + agregador
- **Calendário** — visão mensal com heatmap de métricas por dia
- **Comparar períodos** — comparação lado a lado com variação %
- **Timeline do Instagram** — linha do tempo cronológica de posts
- Abas de visão no Dashboard (Resumo / Calendário / Comparar)

## 7. Detector de "hype" (viralização)

- `src/lib/hypeDetector.js` — detecta conteúdo performando acima da média do perfil
- 3 níveis: 📈 Subindo · 🔥 No hype · 🚀 Viralizando
- `HypeBanner` — alerta animado quando há viral
- Aparece em 5 lugares: sidebar (bolinha), Dashboard (banner compacto), página do Instagram (banner completo), badges nos posts e na timeline
- Integrado aos insights de IA e ao chat

## 8. Revisão de código e melhorias estruturais

Após uma revisão crítica, foram implementadas:

- **Segurança:** `DEV_LOGIN` protegido por env var; Edge Functions exigem `x-internal-key`; `dangerouslySetInnerHTML` substituído por renderer seguro
- **Arquitetura:** `MetricsProvider` (contexto único — elimina fetch duplicado); `ErrorBoundary`; hooks viraram wrappers finos
- **Qualidade:** `lib/config.js` (centraliza thresholds/cores); `lib/format.js` (formatadores compartilhados); inline styles convertidos para CSS modules
- **UX:** `useToast` (notificações); DateRangePicker do Dashboard agora calcula de verdade qualquer intervalo; deltas dos KPIs calculados de verdade; botões "Salvar" não-funcionais marcados como "(em breve)"
- **Feature nova:** `GoalTracker` — barras de progresso de metas no Dashboard

## 9. Análise de concorrentes

- Rota /concorrentes + `useCompetitors` (CRUD com fallback localStorage)
- `CompetitorCard` — cards com seguidores, engajamento, frequência
- `CompetitorComparisonChart` — gráfico de crescimento comparado
- `BenchmarkPanel` — você vs. mercado, ranking e share of voice
- Registro por snapshots manuais (APIs não expõem dados de concorrentes)
- Insights de IA sobre posição competitiva
- Tabelas `competitors` e `competitor_snapshots`

## 10. Biblioteca de conteúdos validados

- Registro dos posts de concorrentes que performaram bem
- `ValidatedContent` — biblioteca com filtros e análise de padrões
- Tabela `competitor_content`

## 11. Insumos das reuniões (transcrições Plaud)

Cruzamento das reuniões gravadas com a plataforma. Implementado o que fazia sentido no contexto:

- **Taxonomia rica de conteúdo** — cada conteúdo validado classificado em gancho, emoção, áudio e ritmo de edição; painel "🧬 DNA do conteúdo vencedor" que extrai a fórmula que mais converte
- **WhatsApp como canal de entrega** — agendamentos de relatório agora enviam por e-mail e/ou WhatsApp (WhatsApp Cloud API na Edge Function)
- **Motores de distribuição** — painel estratégico que enquadra cada canal com seu papel

Ficou de fora (acordado): sistema financeiro/ERP, influenciadores virtuais, recrutamento.

## 12. Renomeação + TikTok e YouTube

- Plataforma renomeada para **Backoffice The Blonde Concept** em todos os arquivos
- **TikTok** (/tiktok) e **YouTube** (/youtube) como redes completas: KPIs, gráficos de crescimento, ranking de vídeos
- Hooks `useTikTokMetrics` e `useYouTubeMetrics` (mock + fallback)
- Componentes compartilhados `SocialLineChart` e `SocialVideoList`
- 4 tabelas novas + rotas + itens na sidebar

## 13. Repaginação "Command Center"

Redesign visual completo inspirado em um painel de controle / terminal:

- **Tema único escuro** — `global.css` reescrito; tema claro removido (`ThemeContext` fixo em escuro). Paleta near-black com acentos ciano-teal, magenta e âmbar; malha de fundo sutil; fontes Inter + JetBrains Mono.
- **Barra de status** (`StatusTicker`) — ticker fixo no topo com KPIs do dia (ROAS, ROI, investido, CTR, mensagens, agendamentos, vendas), relógio SYNC e indicador SYSTEM ONLINE.
- **Cabeçalhos numerados** (`SectionHeader`) — cada tela abre com `NN // CATEGORIA · SEÇÃO`, título caixa-alta pesado e faixa de acento. Aplicado nas 9 telas.
- **Paleta de comandos** (`CommandPalette`) — ⌘K / Ctrl+K abre busca de navegação rápida com teclado.
- **Botões estilo terminal** — utilitários globais `.cc-btn` (monoespaçado, caixa-alta, glow no hover).
- **Molduras de canto** — utilitário `.cc-frame` (cantos tipo mira); `KpiCard` restilizado com valores monoespaçados em ciano.
- **Sidebar** — marca em losango, itens numerados com ícone + rótulo, estado ativo com glow ciano, rodapé de status do sistema.

## 16. Redesign v2 — peso visual redistribuído (PLANO_REDESIGN)

Refatoração visual seguindo plano próprio. Mantém a identidade (preto, ciano-teal, mono em números, `NN //`) mas para de aplicar a estética "command center" como textura.

**Fase 1 — tokens** (`global.css`): nova paleta (`--bg #0a0d12`, texto `#e6e9ef`), cores por seção (`--section-*`), escala de espaçamento (`--space-*`), raios maiores (6/8/10px). Fundo limpo (malha removida). Botões `.btn`/`.btn--primary` em Inter ao lado dos `.cc-btn` técnicos.

**Fase 2 — 6 componentes compartilhados** (`src/components/ui/`):
- `PageHeader` — kicker `NN // SEÇÃO` em mono + título humano em Inter (sem caps). Lê cor/número de `lib/sectionColors.js`.
- `KpiCard` — reescrito: sem moldura de mira, sem label mono-caps; número mono, delta com seta colorida, sparkline embaixo.
- `Tabs` — abas em texto com underline na cor da seção (substitui pílulas mono).
- `HeroBlock` — grid 2 colunas pro par hero (briefing + score).
- `ContentCard` — card estilo Ad Library (preview 9:16, hype badge, métricas, tags, CTA, contorno viral).
- `EmptyState` — estado vazio com barras de progresso + dados parciais.

**Fase 3 — telas:**
- **Dashboard** reestruturado: saudação por hora, abas (Atenção agora / Jornada / Metas / Calendário / Comparar / Campanhas), HeroBlock (briefing + health), 4 KPIs com sparkline, lista única "Atenção agora" (anomalias + hype).
- **Instagram**: 4 KPIs, abas (Visão / Conteúdo / Calendário / Timeline), aba Conteúdo = grid `ContentCard` 3 col com filtros + ordenação + badge de hype real.
- **WhatsApp**: hero é a fila "Precisam de você" (badge), KPIs + abas (Precisam / Todas / Funil / Origem), "● Conectado".
- **Demais telas** (Concorrentes, IA, Embaixadores, SEO, Integrações, Relatórios, Alertas, Settings, TikTok, YouTube): `PageHeader` + `KpiCard` novo + `Tabs` onde já havia abas. TikTok/YouTube ganham `EmptyState` por threshold (≥10 vídeos e ≥500 seguidores).

**Fase 4 — cleanup:** removidos `StatusTicker`, `SectionHeader` e `AnomalyAlerts` (órfãos). `cc-frame` restrito a hero/health (Health Score, WeeklyBriefing, MetricExplainer, CommandPalette).

**Fase 5 — sidebar:** renumeração 01–13 (Dashboard 01, Integrações 02, Relatórios 03, Instagram 04…), WhatsApp no grupo Performance, glow do losango reduzido.

> Observação: as telas de "intelligence/sistema" receberam o refresh dos componentes + tokens, mas não a reorganização profunda de arquitetura de informação descrita no checklist (ex.: "Você vs mercado" em Concorrentes, análise de virais full-screen, ranking com opacity em Embaixadores). Ficam como próximo passo.

---

## 15. Camada de insight — 14 melhorias inspiradas em Stripe, Posthog, Apple Health, Linear

Foco: tirar o usuário do "olhar pra muitos números" e levar pra "entender e agir".

- **Resumo narrativo da semana** (`WeeklyBriefing`) — parágrafo automático no topo do Dashboard com o que mudou + próxima ação sugerida. Motor: `lib/narrativeBriefing.js`.
- **Health Score 0–100** (`HealthScore`) — número único + ring decomposto em 4 dimensões (verba/conteúdo/atendimento/reputação). Motor: `lib/healthScore.js`. Estilo Apple Health/Whoop.
- **Alertas proativos** (`AnomalyAlerts`) — detecção de anomalias (z-score sobre o histórico diário). Motor: `lib/anomalies.js`. Estilo Datadog.
- **Sparkline em todo KPI** — `Sparkline` SVG embutido em `KpiCard`; cada número mostra tendência de 7d sem custo de espaço. Estilo Vercel/Plausible.
- **"Why this metric?"** (`MetricExplainer` + `lib/metricDefinitions.js`) — clique em qualquer KPI abre drawer com definição, fórmula, meta, drivers atuais e drill-down dos itens por trás do número. Estilo Stripe + Mixpanel.
- **Jornada do cliente** (`JourneyTimeline`) — nova aba no Dashboard mostrando cada cliente com todos os toques cronológicos entre canais (Meta → IG → TikTok → WhatsApp → venda). O elo perdido que conectava os silos.
- **Calendário editorial** (`ContentCalendar`) — nova aba no Instagram: publicado + agendado + slots sugeridos pela DNA do vencedor.
- **Briefing "1 página pra reunião"** (`BriefingModal`) — botão no Dashboard que abre layout printable (A4) com resumo + KPIs + saúde + anomalias; `window.print()` salva como PDF.
- **Comparativo de períodos com narrativa** — frase pronta no topo do `PeriodComparison`: "Você gastou +X, faturou +Y, eficiência subiu Z pontos".
- **Sidebar agrupada em 4 seções colapsáveis** — Performance / Redes / Inteligência / Sistema. Reduz cognitive load.
- **Hambúrguer mobile** — sidebar vira drawer off-canvas no celular. PWA-pronto.
- **⌘K executa comandos** — paleta ganhou ações além de navegar: atualizar, imprimir, copiar link, abrir Meta Ad Library, abrir Google Trends, encerrar sessão. Estilo Linear/Cursor.
- **AI Assistant com memória** — chat persiste o histórico em localStorage (últimas 80 mensagens) + botão de limpar.
- **PWA** — `manifest.webmanifest` + `sw.js` (network-first com fallback offline) + meta tags Apple. Instalável no celular, abre em modo standalone, theme-color preta.

---

## 14. Insumos das anotações (caderno) — 8 features novas

A partir de anotações manuais do usuário, foram construídas (padrão mock + fallback):

- **WhatsApp** (`/whatsapp`) — painel do canal de atendimento/CTWA: KPIs (conversas, leads, agendamentos, taxa de resposta/conversão), funil de atendimento, motivos de contato, origem das conversas, conversas recentes. Hook `useWhatsAppMetrics`.
- **Metas trimestrais** — nova aba "Metas trimestrais" no Dashboard: acompanha Q1–Q4 contra metas estabelecidas, com veredito por ritmo (adiantado / no ritmo / atrasado) calculado pelo tempo decorrido do trimestre. Hook `useQuarterlyGoals` + componente `QuarterlyGoals`.
- **Central de IA** (`/ia`) — três abas: **Análise de virais** (motor `lib/viralAnalysis.js` que pontua fatores de viralização, explica o porquê e gera ganchos/legenda/CTAs/roteiro), **Cérebro da IA** (diretriz de marketing persistida — contexto de toda geração) e **Prompt do Gemini** (prompt de sistema montado a partir do cérebro). Hook `useAiBrain`.
- **Edge Function `gemini-analyze`** — scaffold da API do Gemini; com `GEMINI_API_KEY` configurada usa IA real, senão o app cai para o motor local.
- **Embaixadores** (`/ambassadors`) — painel de embaixadores e influenciadores da marca: alcance somado, cupons, vendas e receita atribuídas, comissão; CRUD com fallback localStorage. Hook `useAmbassadors`.
- **Agente de SEO** (`/seo`) — SEO Score, palavras-chave monitoradas (posição + variação), sugestões de conteúdo priorizadas e auditoria on-page. Hook `useSeoAgent`.
- **Concorrentes** — segmentação por produto/empresa (filtro por segmento) + aba **Radar de mercado** (`MarketRadar`): feed de movimentos, tendências, oportunidades e alertas do setor.

Sidebar passou a 13 itens; a numeração das seções (`NN //`) é um código fixo de cada tela.

---

## Estado atual da plataforma

**Telas:** Login · Dashboard (Resumo/Calendário/Comparar) · Instagram · TikTok · YouTube · Concorrentes · Integrações · Relatórios · Alertas · Configurações

**Recursos transversais:** tema claro/escuro · agente de IA (chat + insights) · detector de hype · relatórios agendados (e-mail/WhatsApp) · navegação por datas

**Edge Functions:** `send-report`, `instagram-sync`

**Importante:** tudo roda com dados de demonstração (mock) sem precisar de Supabase. Para dados reais é preciso rodar o `supabase-schema.sql`, configurar o `.env` e deployar as Edge Functions — instruções no `README.md`.

---

> Observação: este histórico foi gerado a partir do trabalho feito no Claude Code (extensão do VSCode).
> As conversas do Claude Code ficam salvas localmente em `C:\Users\thale\.claude\projects\` e podem ser
> retomadas com o comando `/resume` dentro do Claude Code.
