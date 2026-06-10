---
entity: "videos"
entity_type: "data"
tipo_pt: "Dado"
community: 0
degree: 3
---

# videos

## Tipo

**Dado**  (data)

## Descricao

- Represents a collection of video data retrieved from a resource, which may include various attributes and states.
- An array of objects representing video content, which includes fields such as 'caption', 'thumbnail_url', and 'publicado_em'.
- An array of video objects fetched from TikTok, each containing metrics and captions used in the SocialVideoList component.

## Conexoes (3)

### contains (1)
- [[data]]

### provides (1)
- [[fetchall]]

### uses (1)
- [[socialvideolist]]

## Aparece em

- `useTikTokMetrics.js`
- `SocialVideoList.jsx`
- `TikTokPage.jsx`

## Comunidade

Faz parte de [[comunidade-000-instagram-page|Comunidade 0]].
