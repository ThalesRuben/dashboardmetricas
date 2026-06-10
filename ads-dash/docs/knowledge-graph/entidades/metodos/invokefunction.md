---
entity: "invokeFunction"
entity_type: "method"
tipo_pt: "Metodo"
community: 4
degree: 4
---

# invokeFunction

## Tipo

**Metodo**  (method)

## Descricao

- A method used to call serverless functions, specifically for triggering the sending of reports in the context of the provided code.
- invokeFunction is a method that asynchronously invokes a specified Edge Function on the Supabase platform, optionally including a body and headers for the request.

## Conexoes (4)

### uses (2)
- [[internalapikey]]
- [[usereportschedules]]

### employs (1)
- [[supabase]]

### invokes (1)
- [[sendnow]]

## Aparece em

- `useReportSchedules.js`
- `supabase.js`

## Comunidade

Faz parte de [[comunidade-004-dashboardpage|Comunidade 4]].
