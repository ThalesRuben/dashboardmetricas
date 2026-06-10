---
entity: "Resend"
entity_type: "organization"
tipo_pt: "Organizacao"
community: 3
degree: 5
---

# Resend

## Tipo

**Organizacao**  (organization)

## Descricao

- RESEND_API_KEY is utilized for sending emails through the Resend service.
- A service that provides APIs for sending emails and SMS messages.
- A service that allows for sending emails and managing email deliveries, often integrated with applications to provide email functionalities.

## Conexoes (5)

### api,integrates (1)
- [[supabase]]

### authentication,requires (1)
- [[long_lived_access_token]]

### integrates with (1)
- [[backoffice]]

### integrates,messaging,notifications,supports (1)
- [[whatsapp]]

### used for (1)
- [[resend_api_key]]

## Aparece em

- `.env.example`
- `README.md`

## Comunidade

Faz parte de [[comunidade-003-instagram|Comunidade 3]].
