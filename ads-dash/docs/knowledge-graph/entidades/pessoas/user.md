---
entity: "user"
entity_type: "person"
tipo_pt: "Pessoa"
community: 11
degree: 3
---

# user

## Tipo

**Pessoa**  (person)

## Descricao

- user represents an individual interacting with the interface, whose email is split to derive the username.
- The user currently logged into the application, whose state is managed through authentication context.

## Conexoes (3)

### manages (1)
- [[authcontext]]

### provides (1)
- [[dev_login]]

### retrieves (1)
- [[session]]

## Aparece em

- `Layout.jsx`
- `AuthContext.jsx`

## Comunidade

Faz parte de [[comunidade-011-settingspage|Comunidade 11]].
