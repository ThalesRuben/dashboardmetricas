---
entity: "MetricsContext"
entity_type: "other"
tipo_pt: "Diverso"
community: 4
degree: 14
---

# MetricsContext

## Tipo

**Diverso**  (other)

## Descricao

- A context provider in a React application that serves as a single source of truth for managing metrics-related data.
- A context provider that manages the state of metrics, specifically for Instagram.
- A context provider in a React application that supplies metrics-related data, such as goals and their loading state.
- A React context designed to manage and share metrics related to ads performance and related data updates.
- A context provider used to share metrics-related state and functions across components in a React application.

## Conexoes (14)

### provides (5)
- [[goals-48d8c6]]
- [[ig]]
- [[igloading]]
- [[igusingmock]]
- [[refreshgoals]]

### uses (3)
- [[timeouts-a9b830]]
- [[usegoals]]
- [[useinstagrammetrics]]

### contains,manages (1)
- [[ads_mock]]

### creates (1)
- [[usememo]]

### holds (1)
- [[goals]]

### includes (1)
- [[updategoal]]

### indicates (1)
- [[goalsloading]]

### interacts with (1)
- [[usemetrics]]

## Aparece em

- `useMetrics.js`
- `useInstagramMetrics.js`
- `useGoals.js`
- `MetricsContext.jsx`

## Comunidade

Faz parte de [[comunidade-004-dashboardpage|Comunidade 4]].
