# Rank Math — Setup do The Blonde Concept

Passo-a-passo pronto pra você aplicar no WordPress. Tempo total: ~15 min.
Resolve os dois itens em vermelho do audit (meta descriptions + sitemap).

---

## 1. Instalar

**WP Admin → Plugins → Adicionar novo → "Rank Math SEO" → Instalar → Ativar.**

Se o painel oferecer "Rank Math SEO PRO", **recuse** — o grátis já faz tudo que precisamos.

---

## 2. Wizard inicial (Setup Wizard)

Quando ativar, o wizard abre sozinho. Respostas:

| Passo | Escolha |
|---|---|
| Connect account | **Skip** (pode conectar depois, não precisa agora) |
| Your Site | Role: **Personal Blog / Small Business**. Business Type: **LocalBusiness → HairSalon** |
| Site name | `The Blonde Concept` |
| Alternate name | `TBC` |
| Site logo | reutilize o favicon/logo já no site |
| Search Console | **Skip** por enquanto (reconectamos no passo 7) |
| Analytics | **Skip** |
| Sitemaps | **Enable Sitemaps** → ON |
| Include images | ON |
| Noindex empty category/tag | ON |
| Role Manager | padrão |
| 404 + Redirections | ON (ligar os dois, não custa) |

Clica **Save and Continue** até o final.

---

## 3. Titles & Meta → Homepage

**Rank Math → Titles & Meta → Homepage.**

- **Homepage Title**: `The Blonde Concept — Salão de cabelos loiros em BH`
- **Homepage Description**:

```
Salão em Belo Horizonte especializado em cabelos loiros: mechas, iluminado, platinado e correção de cor com técnica e cuidado. Agende sua consultoria.
```

(149 caracteres — dentro do limite do Google de ~155).

---

## 4. Titles & Meta → Pages (template global)

Mesmo lugar, clica em **Pages** na barra lateral:

- **Single Page Title**: `%title% %sep% %sitename%`
- **Single Page Description**: deixe em branco (vamos definir por página no passo 5).
- **Robots Meta**: Index.
- **Schema Type**: WebPage.

---

## 5. Meta por página (edite cada uma)

Em cada página, abre no editor do WP → rola até o fim → aparece o box **"Rank Math SEO"**. Clica em **Edit Snippet** → preenche **SEO Description**.

### `/quem-somos`
- Title: `Quem somos — The Blonde Concept`
- Description:
```
Conheça o salão The Blonde Concept em BH: equipe formada em loiros, consultoria personalizada e padrão técnico que respeita a saúde do seu cabelo.
```

### `/loiras-morenas-corte`  (página mais importante do site)
- Title: `Mechas, loiros e visagismo — The Blonde Concept BH`
- Description:
```
Mechas iluminadas, platinado, correção de cor, corte e visagismo feminino em Belo Horizonte. Técnica para cabelos loiros sem comprometer a fibra.
```

### `/estetica`
- Title: `Estética facial e corporal — The Blonde Concept`
- Description:
```
Serviços de estética facial e corporal no The Blonde Concept em BH. Protocolos profissionais que complementam o cuidado com o seu visual completo.
```

### `/nail-design`
- Title: `Nail Design — The Blonde Concept BH`
- Description:
```
Nail design no The Blonde Concept: manicure, pedicure e esmaltação em gel com acabamento profissional em Belo Horizonte. Agende seu horário.
```

### `/tbcacademy`
- Title: `TBC Academy — Cursos para cabeleireiros`
- Description:
```
TBC Academy: cursos técnicos para cabeleireiros especializados em loiros. Aprenda na prática as técnicas da equipe do The Blonde Concept.
```

### `/blog`
- Title: `Blog — Cuidados com cabelos loiros e tendências`
- Description:
```
Dicas de cuidado para cabelos loiros, mechas, progressiva e tendências de beleza pela equipe técnica do The Blonde Concept.
```

### `/contato`
- Title: `Contato e endereço — The Blonde Concept BH`
- Description:
```
Fale com o The Blonde Concept, agende sua consultoria ou visite nosso salão em Belo Horizonte. Endereço, horário e WhatsApp para atendimento.
```

Em cada página, depois de preencher → **Update**.

---

## 6. Sitemap — confirmar que ativou

Rank Math → **Sitemap Settings** → confirma:

- **General → Links Per Sitemap**: 200
- **General → Images in Sitemap**: ON
- **Posts**: ON (depois que tiver post publicado; por enquanto o próprio Rank Math não lista types vazios)
- **Pages**: ON
- **Authors**: OFF (não ajuda SEO)
- **Categories/Tags**: OFF por enquanto (só ativa quando tiver conteúdo)

Depois abre em outra aba: **https://theblondeconcept.com.br/sitemap_index.xml** — deve mostrar um XML com links pra `/page-sitemap.xml`. Se mostrar, tá feito.

**Problema conhecido:** o sitemap nativo do WP hoje tá 404 em `/wp-sitemap.xml`. Isso sugere que alguém filtrou com `add_filter('wp_sitemaps_enabled', '__return_false')` no `functions.php` do tema (Hello Elementor). Rank Math não depende disso — tem rota própria. Mas se quiser limpar: edita o `functions.php` do tema e remove a linha.

---

## 7. Reconectar Google Search Console

Depois que o `sitemap_index.xml` responder 200:

1. **Search Console** → propriedade `theblondeconcept.com.br` → **Sitemaps** → "Adicionar sitemap" → cole `sitemap_index.xml` → Enviar.
2. Aguarde 24-48h pro GSC rastrear.
3. Rank Math **Dashboard → Analytics → Connect Google Services** se quiser ver impressões dentro do WP (opcional — você já tem o `gsc-sync` puxando pro dashboard).

---

## 8. Validar no ads-dash

Depois de salvar as metas e confirmar o sitemap no browser, invoque o audit sem esperar o cron:

```bash
curl -X POST https://wvygpfeaifhkzxyrfzte.supabase.co/functions/v1/seo-audit \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" -d "{\"extraPaths\":[\"/quem-somos\",\"/loiras-morenas-corte\",\"/estetica\",\"/nail-design\",\"/tbcacademy\",\"/blog\",\"/contato\"]}"
```

(O `extraPaths` força o audit a checar as 7 páginas além da home, pra pegar as metas novas de todas.)

Depois recarregue `/seo` no dashboard — "Meta descriptions" e "Sitemap e indexação" viram 🟢.

---

## 9. Bônus (opcional, vale a pena)

- **Rank Math → Titles & Meta → Local SEO** → preenche nome, endereço, telefone, horário, coordenadas. Isso gera Schema LocalBusiness/HairSalon — ajuda muito em "salão perto de mim" e aparição no pacote local do Google Maps.
- **Rank Math → General Settings → Breadcrumbs** → Enable. Ajuda navegação e aparece no SERP.
- **Rank Math → Titles & Meta → Social Meta** → faz upload de uma imagem OG 1200x630 do salão. Melhora compartilhamento no WhatsApp/IG.

---

## Checklist final

- [ ] Rank Math instalado e ativado
- [ ] Wizard concluído
- [ ] Meta da home preenchida
- [ ] Meta das 7 páginas internas preenchidas
- [ ] `/sitemap_index.xml` retornando 200
- [ ] Sitemap submetido no Search Console
- [ ] `curl` do seo-audit rodou e retornou status "ok"
- [ ] Dashboard `/seo` mostra os 2 itens antes vermelhos como OK
