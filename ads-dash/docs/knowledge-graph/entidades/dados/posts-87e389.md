---
entity: "posts"
entity_type: "data"
tipo_pt: "Dado"
community: 5
degree: 3
---

# posts

## Tipo

**Dado**  (data)

## Descricao

- A collection of Instagram posts used as input for the IgTimeline component.
- The data structure that contains the Instagram posts being managed and displayed within the IgTopPosts component, including various attributes for engagement metrics and post types.
- An array containing the details of social media posts, which include attributes such as id, date, time, type, title, status, and engagement rate for various posts.

## Conexoes (3)

### generates (1)
- [[buildposts]]

### manages (1)
- [[igtopposts]]

### renders (1)
- [[igtimeline]]

## Aparece em

- `IgTimeline.jsx`
- `IgTopPosts.jsx`
- `ContentCalendar.jsx`

## Comunidade

Faz parte de [[comunidade-005-contentcalendar|Comunidade 5]].
