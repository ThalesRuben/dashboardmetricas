---
entity: "Alert"
entity_type: "other"
tipo_pt: "Diverso"
community: 8
degree: 6
---

# Alert

## Tipo

**Diverso**  (other)

## Descricao

- An object that represents the notifications being managed, containing properties like ID, type, message, and creation timestamp.
- A UI component that appears to list recent alerts, with conditions to handle loading states and empty states, displaying alert messages along with their respective times.

## Conexoes (6)

### contains (1)
- [[alert-log]]

### displays (1)
- [[statusrow]]

### handles (1)
- [[loading]]

### indicates (1)
- [[empty-3159fe]]

### manages (1)
- [[usealerts-hook]]

### updates (1)
- [[fetchalerts-function]]

## Aparece em

- `useAlerts.js`
- `AlertsPage.jsx`

## Comunidade

Faz parte de [[comunidade-008-supabase|Comunidade 8]].
