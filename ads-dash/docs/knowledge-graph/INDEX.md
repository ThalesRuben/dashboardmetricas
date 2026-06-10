# Indice do Knowledge Graph

Mapa do grafo de conhecimento extraido de **ads-dash** (The Blonde Concept). Cada entidade vira um arquivo; conexoes viram wikilinks; comunidades viram MOCs.

> **Comece por aqui:** as secoes **Entidades centrais** e **Comunidades principais** logo abaixo concentram o sinal. As demais sao referencia / apendice.

## Resumo

- **Entidades:** 2,093
- **Relacoes:** 2,185
- **Conexoes medias por entidade:** 2.09  _(grafos de codigo costumam ficar entre 1 e 2; densos ficam > 3)_
- **Comunidades grandes (>= 3):** 66
- **Comunidades minusculas (< 3):** 404 (somando 441 entidades) -> [[_comunidades-minusculas|ver apendice]]

## Qualidade do grafo (distribuicao de degree)

- **Bem conectadas (degree >= 10):** 80  _(3.8%)_
- **Conectadas (degree >= 5):** 209  _(10.0%)_
- **Razoaveis (degree >= 3):** 375  _(17.9%)_
- **Pelo menos uma conexao (degree >= 1):** 1726  _(82.5%)_
- **Isoladas (degree = 0):** 367  _(17.5%)_  _(geralmente ruido extraido pelo LLM)_

## Entidades centrais (Top 30 por degree)

- [[page]] - 69 conexoes _(Diverso)_
- [[contentcalendar]] - 42 conexoes _(Metodo)_
- [[settingspage]] - 39 conexoes _(Conteudo)_
- [[card]] - 37 conexoes _(Artefato)_
- [[kpicard]] - 36 conexoes _(Artefato)_
- [[instagram]] - 36 conexoes _(Conteudo)_
- [[instagram-page]] - 36 conexoes _(Conteudo)_
- [[igtimeline]] - 33 conexoes _(Artefato)_
- [[supabase]] - 32 conexoes _(Organizacao)_
- [[styles-bf6228]] - 28 conexoes _(Artefato)_
- [[socialvideolist]] - 28 conexoes _(Artefato)_
- [[item]] - 27 conexoes _(Diverso)_
- [[the-blonde-concept]] - 24 conexoes _(Diverso)_
- [[data]] - 24 conexoes _(Diverso)_
- [[marketradar]] - 23 conexoes _(Componente)_
- [[scriptgeneratormodulecss]] - 23 conexoes _(Artefato)_
- [[pageheader]] - 22 conexoes _(Artefato)_
- [[mock-3bba2a]] - 22 conexoes _(Dado)_
- [[field]] - 21 conexoes _(Diverso)_
- [[campaigntable]] - 21 conexoes _(Conteudo)_
- [[tabs]] - 19 conexoes _(Conteudo)_
- [[dashboardpage]] - 19 conexoes _(Conteudo)_
- [[backoffice]] - 19 conexoes _(Conceito)_
- [[historicomd]] - 18 conexoes _(Conteudo)_
- [[competitors-855bd2]] - 18 conexoes _(Diverso)_
- [[sociallinechart]] - 17 conexoes _(Conteudo)_
- [[dashboard]] - 17 conexoes _(Diverso)_
- [[periodcomparison]] - 16 conexoes _(Artefato)_
- [[seopage]] - 16 conexoes _(Conteudo)_
- [[competitorspage]] - 16 conexoes _(Conteudo)_

## Comunidades principais (size >= 5)

- [[comunidade-000-instagram-page|Comunidade 0]] - **134** entidades, centrada em [[instagram-page]]
- [[comunidade-001-page|Comunidade 1]] - **124** entidades, centrada em [[page]]
- [[comunidade-002-competitors-855bd2|Comunidade 2]] - **106** entidades, centrada em [[competitors-855bd2]]
- [[comunidade-003-instagram|Comunidade 3]] - **87** entidades, centrada em [[instagram]]
- [[comunidade-004-dashboardpage|Comunidade 4]] - **82** entidades, centrada em [[dashboardpage]]
- [[comunidade-005-contentcalendar|Comunidade 5]] - **79** entidades, centrada em [[contentcalendar]]
- [[comunidade-006-campaigntable|Comunidade 6]] - **78** entidades, centrada em [[campaigntable]]
- [[comunidade-007-kpicard|Comunidade 7]] - **76** entidades, centrada em [[kpicard]]
- [[comunidade-008-supabase|Comunidade 8]] - **74** entidades, centrada em [[supabase]]
- [[comunidade-009-field|Comunidade 9]] - **69** entidades, centrada em [[field]]
- [[comunidade-010-sociallinechart|Comunidade 10]] - **61** entidades, centrada em [[sociallinechart]]
- [[comunidade-011-settingspage|Comunidade 11]] - **61** entidades, centrada em [[settingspage]]
- [[comunidade-012-periodcomparison|Comunidade 12]] - **54** entidades, centrada em [[periodcomparison]]
- [[comunidade-013-account-85dfa3|Comunidade 13]] - **52** entidades, centrada em [[account-85dfa3]]
- [[comunidade-014-tabs|Comunidade 14]] - **42** entidades, centrada em [[tabs]]
- [[comunidade-015-seopage|Comunidade 15]] - **41** entidades, centrada em [[seopage]]
- [[comunidade-016-the-blonde-concept|Comunidade 16]] - **39** entidades, centrada em [[the-blonde-concept]]
- [[comunidade-017-health-score|Comunidade 17]] - **35** entidades, centrada em [[health-score]]
- [[comunidade-018-result|Comunidade 18]] - **29** entidades, centrada em [[result]]
- [[comunidade-019-supabase-5b2fb3|Comunidade 19]] - **29** entidades, centrada em [[supabase-5b2fb3]]
- [[comunidade-020-item|Comunidade 20]] - **26** entidades, centrada em [[item]]
- [[comunidade-021-errorboundary|Comunidade 21]] - **21** entidades, centrada em [[errorboundary]]
- [[comunidade-022-g|Comunidade 22]] - **15** entidades, centrada em [[g]]
- [[comunidade-023-usecharttheme-52ac0e|Comunidade 23]] - **13** entidades, centrada em [[usecharttheme-52ac0e]]
- [[comunidade-024-label|Comunidade 24]] - **13** entidades, centrada em [[label]]
- _... mais 19 comunidades de tamanho 5+ em_ `mocs/`
- _comunidades de 3-4 membros: 22 (ver_ `mocs/` _)_

## Navegar por tipo de entidade

- **Conceito** (264) -> `entidades/conceitos/`
- **Metodo** (240) -> `entidades/metodos/`
- **Dado** (240) -> `entidades/dados/`
- **Conteudo** (203) -> `entidades/conteudo/`
- **Artefato** (174) -> `entidades/artefatos/`
- **Pessoa** (57) -> `entidades/pessoas/`
- **Organizacao** (22) -> `entidades/organizacoes/`
- **Evento** (16) -> `entidades/eventos/`
- **Componente** (4) -> `entidades/componentes/`
- **Metrica** (2) -> `entidades/metricas/`
- **Lugar** (2) -> `entidades/lugares/`
- **Fonte** (2) -> `entidades/diversos/`
- **Diverso** (831) -> `entidades/diversos/`  _(maioria e ruido / entidades sem categoria; navegue com cuidado)_
- **Nao classificado** (36) -> `entidades/diversos/`  _(maioria e ruido / entidades sem categoria; navegue com cuidado)_
