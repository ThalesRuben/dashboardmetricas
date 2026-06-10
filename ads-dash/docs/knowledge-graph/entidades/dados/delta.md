---
entity: "Delta"
entity_type: "data"
tipo_pt: "Dado"
community: 7
degree: 4
---

# Delta

## Tipo

**Dado**  (data)

## Descricao

- A percentage that indicates the change in value, used to assess the magnitude of anomalies detected.
- A CSS class designed for displaying delta values (change indicators) with specific font attributes for clear user interpretation.
- A related indicator in the KpiCard showing the change or trend of the KPI value.
- The change in value of the metric compared to a previous period, which determines whether the trend is upward or downward and is displayed with corresponding symbols in the Metric Explainer.

## Conexoes (4)

### depicts (1)
- [[kpicard]]

### indicates (1)
- [[metric-explainer]]

### presents (1)
- [[valuerow]]

### uses (1)
- [[detect-anomalies]]

## Aparece em

- `anomalies.js`
- `MetricExplainer.module.css`
- `KpiCard.module.css`
- `MetricExplainer.jsx`

## Comunidade

Faz parte de [[comunidade-007-kpicard|Comunidade 7]].
