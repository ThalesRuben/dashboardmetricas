// Bíblia do Marketing — The Blonde Concept.
// Diretrizes oficiais de conteúdo, por canal + cronograma narrativo de stories
// + diretriz de percepção de marca. Fonte única, exibida em /biblia e
// disponível como contexto pra IA.

export interface BibleRef { nome: string; nota?: string }
export interface BibleFormula { pct: number; label: string; desc: string }
export interface BiblePillar { titulo: string; texto: string }
export interface BibleLink { to: string; label: string; desc: string }
export interface BibleMusicGroup { nome: string; faixas: string[] }
export interface BibleDay {
  dia: string
  nome: string
  transmite: string
  narrativa: string
  sensacao: string
  ritmo: string
  estetica: string
  aparece: string[]
}
export interface BibleDont { titulo: string; evitar: string[]; regra: string }

export type BibleBlock =
  | { t: 'lead'; text: string }
  | { t: 'callout'; text: string }
  | { t: 'list'; title?: string; items: string[] }
  | { t: 'tags'; title?: string; items: string[] }
  | { t: 'refs'; title?: string; items: BibleRef[] }
  | { t: 'formula'; items: BibleFormula[] }
  | { t: 'pillars'; items: BiblePillar[] }
  | { t: 'links'; title?: string; items: BibleLink[] }
  | { t: 'music'; title?: string; groups: BibleMusicGroup[] }
  | { t: 'days'; items: BibleDay[] }
  | { t: 'dont'; items: BibleDont[] }

export interface BibleSection {
  id: string
  label: string
  tag?: string
  blocks: BibleBlock[]
}

export const BIBLE: BibleSection[] = [
  // ───────────────────────── CONCEITO DA MARCA ─────────────────────────
  {
    id: 'conceito',
    label: 'Conceito da marca',
    tag: 'O DNA — a raiz de tudo',
    blocks: [
      { t: 'lead', text: 'O The Blonde Concept é um salão de alto padrão. O conceito é LUXO e EXPERIÊNCIA: especialista em mechas de alto nível, localizado em uma das principais regiões de Belo Horizonte. Toda estratégia, criativo, campanha, dashboard e até a espionagem de concorrentes nasce daqui — pra que o direcionamento da marca nunca seja distorcido.' },
      { t: 'callout', text: 'A essência: não vendemos um serviço de cabelo. Vendemos a experiência de estar em um lugar de luxo, com resultado de mechas em nível de referência. A cliente entra por um cabelo e fica pela sensação.' },
      { t: 'pillars', items: [
        { titulo: 'Luxo', texto: 'Percepção premium em cada detalhe — ambiente, atendimento, estética de capa de revista. Nada amador entra.' },
        { titulo: 'Experiência', texto: 'A cliente SENTE algo, não só "faz o cabelo". Café, acolhimento, cuidado, exclusividade.' },
        { titulo: 'Alto nível técnico', texto: 'Referência em loiro e mechas. O resultado é o produto — e ele precisa ser impecável.' },
        { titulo: 'Localização nobre', texto: 'Uma das principais regiões de BH. Status, conveniência e pertencimento.' },
      ]},
      { t: 'list', title: 'Posicionamento', items: [
        'O que somos: a referência em loiro e mechas de alto padrão de BH — um salão-experiência.',
        'O que NÃO somos: salão de volume, de preço, "mais um". Não competimos por barato.',
        'Promessa: transformação com resultado de capa de revista + uma experiência memorável.',
        'Público-alvo: mulheres que valorizam autocuidado e investem em qualidade e exclusividade.',
        'Sensação que a marca vende: desejo, sofisticação, autoridade e pertencimento.',
      ]},
      { t: 'callout', text: 'REGRA-MÃE — antes de qualquer criativo, campanha ou post, pergunte: "isso reforça luxo, experiência e alto nível?" Se não reforça, está distorcendo a marca. Não vai.' },
      { t: 'list', title: 'Como o conceito rege cada área', items: [
        'Criativos e conteúdo: estética premium, gancho forte, percepção de marca (ver "Diretriz de percepção").',
        'Campanhas/Ads: comunicação de alto padrão, oferta sem apelar pra preço; público qualificado.',
        'Dashboards: as métricas existem para validar o que sustenta o conceito (ROAS, agenda, reputação).',
        'Espionagem de concorrentes: copiar o que funciona no mercado, mas sempre filtrado pelo nosso padrão.',
        'Embaixadores: só perfis que elevam a marca (alto padrão, estética alinhada).',
      ]},
      { t: 'links', title: 'Onde isso vive na plataforma', items: [
        { to: '/', label: 'Dashboard', desc: 'Métricas que validam o conceito' },
        { to: '/competitors', label: 'Concorrentes', desc: 'Espionagem filtrada pelo padrão' },
        { to: '/ia', label: 'Central de IA', desc: 'Cérebro com a diretriz da marca' },
        { to: '/ambassadors', label: 'Embaixadores', desc: 'Scout que respeita o conceito' },
      ]},
    ],
  },

  // ───────────────────────── PADRÃO GERAL ─────────────────────────
  {
    id: 'geral',
    label: 'Padrão geral',
    tag: 'O que rege tudo',
    blocks: [
      { t: 'callout', text: 'Padrão The Blonde Concept: muito alto, capa de revista. Conteúdo (foto ou vídeo) com edição/qualidade abaixo de 85% NÃO é postado — independente do profissional.' },
      { t: 'list', title: 'Regras-base', items: [
        'Mínimo de 85% de qualidade em foto e vídeo. Abaixo disso, não entra.',
        'Sem bom conteúdo dos profissionais, usar fotos e vídeos do Samir.',
        'Sempre seguir o cronograma. Só fugir dele para complementação ou quando for conteúdo hype.',
      ]},
      { t: 'list', title: 'Combos (usar os nomes dos cabelos do combo)', items: [
        '3 fotos — Combo 1',
        '3 fotos — Combo 2',
        '3 fotos — Combo 3',
        'Inspiração de cor: 1 morena · 2 dourado · 3 loiros. Sempre usar os nomes do PDF.',
      ]},
    ],
  },

  // ───────────────────────── INSTAGRAM ─────────────────────────
  {
    id: 'instagram',
    label: 'Instagram',
    tag: 'Feed · Stories · Reels',
    blocks: [
      { t: 'list', title: 'Stories', items: [
        'Na dúvida sobre um story, olhar nos arquivados (setembro a março).',
        'Os stories das 10:15 já têm que estar postados.',
        'Story de cabelo: nada de música muito feminina. Referências: Mario Henrique, Danilo Hebert, Romeu Filipe. Finais bem chiques e elegantes.',
      ]},
      { t: 'list', title: 'Harmonia do feed', items: [
        'Sempre estética impecável, como capa de revista.',
        'Foto feia, desenquadrada, qualidade baixa ou final ruim NÃO entra no feed.',
        'Fotos inspiradas nos combos: 1 morena · 2 dourado · 3 loiros. Sempre os nomes do PDF.',
      ]},
      { t: 'callout', text: 'Vídeo sem capa: tire um print de um ângulo bom do vídeo, passe FaceApp 2, volume 1 ou 2, e aumente a nitidez de 15 a 30%. Depois passe a capa na IA.' },
      { t: 'tags', title: 'Hashtags do salão (máx. 3 a 4)', items: ['#salaobh', '#mechasbh', '#loirosbh', '#bh', '#belohorizonte'] },
      { t: 'tags', title: 'Hashtags por público (máx. 3 a 4)', items: ['#morenailuminadabh', '#cabelosloirosbh', '#cabeloscacheados', '#theblondeconcept', '#transformacao'] },
      { t: 'list', title: 'Por que usar hashtag', items: [
        'A # do salão mantém o conteúdo aparecendo no explorar como 1ª opção de salão em BH.',
        'Sem hashtag, o conteúdo não fica nichado para um público.',
        'A melhor opção é sempre mirar o nicho do público-alvo.',
      ]},
      { t: 'list', title: 'Guia de criação (Creator Search Insights)', items: [
        'Use o site Creator Search Insights — tem os conteúdos virais com músicas virais de vários nichos.',
        'Faça a adaptação para o nosso nicho.',
        'Copie os vídeos virais que mais engajaram e adapte — aumenta alcance e traz público novo.',
        'Buscar referências dos vídeos mais viralizados dos grandes players do YT do nosso nicho: analisar thumbs, título e subtítulo; usar sempre métricas de maior alcance.',
      ]},
    ],
  },

  // ───────────────────────── COMO VIRALIZAR (fórmula) ─────────────────────────
  {
    id: 'viralizar',
    label: 'Como viralizar',
    tag: 'A fórmula do vídeo',
    blocks: [
      { t: 'lead', text: 'A composição de um vídeo que viraliza — peso de cada fator:' },
      { t: 'formula', items: [
        { pct: 30, label: 'Gancho', desc: 'A chamada inicial dos 3 primeiros segundos. Despertar curiosidade e quebrar padrão. Ex.: começar com o cabelo no fundo de clareamento + "você não vai acreditar neste resultado?"; passar o pó descolorante; cortar muito o cabelo.' },
        { pct: 20, label: 'Timing', desc: 'As viradas e os cortes. Não podem ser demorados e têm que prender a atenção. O encaixe da música é crucial para trabalhar a senoide audiovisual.' },
        { pct: 20, label: 'Tema', desc: 'O que vai acontecer? Como vai ficar? Será que vai dar certo? Ex.: "ela me procurou porque queria uma super transformação", "ela teve corte químico".' },
        { pct: 10, label: 'Música', desc: 'A música atrai o que você é. Use o arquétipo predominante da marca.' },
        { pct: 10, label: 'Edição', desc: 'Cortes rápidos, com ganchos de 3 a 6 segundos. Lembrar do curso: 6s · 10s · 15s · 30s.' },
        { pct: 10, label: 'Descrição + #', desc: 'Legenda e hashtags relacionadas ao público (3 a 4).' },
      ]},
      { t: 'callout', text: 'Se o vídeo bater uma média de 15 a 30 segundos de retenção, ele viraliza.' },
      { t: 'callout', text: 'O ego é inimigo do lucro. Enquanto você não se posicionar, outras pessoas farão isso por você.' },
    ],
  },

  // ───────────────────────── TIKTOK ─────────────────────────
  {
    id: 'tiktok',
    label: 'TikTok',
    tag: 'FY · cortes · trends',
    blocks: [
      { t: 'refs', title: 'Referências', items: [
        { nome: 'Higor Giuseppe', nota: 'Capas de IA correspondentes ao corte e sempre realistas.' },
        { nome: 'Eren Avsar', nota: 'Estilos de edição e músicas em alta.' },
      ]},
      { t: 'list', title: 'CTA no início (p/ vídeos sem gancho forte, corte de franja, corte grande)', items: [
        '"Teria coragem?"',
        '"Alerta de gatilho"',
        '"As camadas mais sexy de Minas Gerais"',
        '"Qual franja você faria?"',
      ]},
      { t: 'callout', text: 'Top 1 para aumento de visualização e engajamento: quadros de rua.' },
      { t: 'tags', title: 'Hashtags', items: ['#fy', '#fyp', '#bh', '#belohorizonte', '#bluntbob', '#longbob', '#camadasinvisiveis', '#camadas'] },
      { t: 'list', title: 'Operação', items: [
        'Vídeo de cor: pegar inspirações no Pinterest e usar como capa.',
        'Sempre que postar, deixar o app aberto e engajar nos comentários.',
      ]},
    ],
  },

  // ───────────────────────── YOUTUBE ─────────────────────────
  {
    id: 'youtube',
    label: 'YouTube',
    tag: 'Shorts · longos · retrô',
    blocks: [
      { t: 'list', title: 'Cadência', items: [
        '2 postagens de Shorts por dia, intervalo de no mínimo 6 horas.',
        'Ao postar vídeo longo, substituir o Shorts — não postar os dois no mesmo horário.',
        'Sempre que postar, deixar o app aberto e engajar nos comentários.',
      ]},
      { t: 'callout', text: 'Headline vermelha com gancho ou CTA. Ex.: "o corte mais pedido de 2026", "teria coragem", "alerta de gatilho".' },
      { t: 'list', title: 'Música', items: [
        'Mais românticas, anos 90, releituras (buscar músicas do Thiago Ximenes).',
        'Regra: usar músicas retrô SOMENTE em Shorts (referência Thiago Ximenes).',
      ]},
    ],
  },

  // ───────────────────────── ACADEMY ─────────────────────────
  {
    id: 'academy',
    label: 'Academy',
    tag: 'Educação · autoridade',
    blocks: [
      { t: 'refs', title: 'Top players de referência', items: [
        { nome: 'Seven Academy', nota: '' },
        { nome: 'O Nicolas Ensina', nota: '' },
        { nome: 'Creative Academy', nota: '' },
        { nome: 'B. Beauty Academy', nota: '' },
      ]},
      { t: 'list', title: 'Linha editorial', items: [
        'Roteirizar no chat (IA). Trabalhar dores, dúvidas e desejos do público.',
        'O simples escala. Trabalhar conteúdo TACCOH.',
        'Mínimo de 3 posts por semana. Perto de evento (30 dias), empilhar pressão.',
        'Cortes de reuniões e palestras. Continuar elevando o nível de consciência (pesquisar os 5 níveis).',
        'Responder direct do Academy e retroalimentar a base.',
      ]},
      { t: 'list', title: 'TACCOH', items: [
        'Técnica', 'Autoridade', 'Conexão', 'Crescimento', 'Objeção', 'Hype',
      ]},
      { t: 'list', title: 'Sequência de posts', items: [
        'Post de conexão',
        'Post de crescimento',
        'Post com maior compartilhamento',
        'Post com quebra de objeção',
        'Post hype',
      ]},
      { t: 'list', title: 'Branding & narrativa', items: [
        'Primal Branding: significado, repetição, memória. Histórias, letra, música, branding.',
        'Pessoas compram histórias — contar sempre as mesmas, com emoção.',
        'Trabalhar prova social: o que os alunos dizem sobre nós.',
        'Antes e depois do Fábio (início e agora). Benefícios de andar comigo (mentor acelera resultado). O que o dinheiro me proporcionou (lista de troféus).',
        'Banco de dados: planilha com criativos de melhor performance, horário e formato.',
        'Kaizen contínuo. Trazer estudos semanais de YouTube/TikTok/Instagram (horários, melhor dia, formato).',
      ]},
    ],
  },

  // ───────────────────────── STORIES — CRONOGRAMA NARRATIVO ─────────────────────────
  {
    id: 'stories',
    label: 'Cronograma de Stories',
    tag: 'A narrativa de 4 dias',
    blocks: [
      { t: 'lead', text: 'Os stories seguem uma construção narrativa diária. Cada dia tem uma emoção, uma sensação, uma estética, uma narrativa e uma intenção. As cenas podem repetir — o que muda é o ritmo, a intenção, a música, a edição e a emoção transmitida.' },
      { t: 'days', items: [
        { dia: 'Dia 1', nome: 'Vibes', narrativa: 'Mostrar a atmosfera do salão.', sensacao: 'Leveza, aconchego e lifestyle.', transmite: '"Eu queria estar aí agora."', ritmo: 'Mais lento e sensorial.', estetica: 'Elegante, leve e sofisticada.',
          aparece: ['Café, chá, bolo ou drinks', 'Bastidores leves', 'Luz bonita', 'Ambiente aconchegante', 'Música sofisticada', 'Cenas lentas', 'Detalhes da decoração', 'Risadas e momentos espontâneos', 'Sensação de conforto'] },
        { dia: 'Dia 2', nome: 'Experience', narrativa: 'Mostrar como a cliente é tratada e cuidada.', sensacao: 'Exclusividade e acolhimento.', transmite: '"Não é só um salão. É uma experiência."', ritmo: 'Mais emocional e próximo.', estetica: 'Refinada, humana e rica em detalhes.',
          aparece: ['Recepção da cliente', 'Sorrisos', 'Atendimento humanizado', 'Massagem no lavatório', 'Café sendo servido', 'Profissional ouvindo a cliente', 'Cuidado nos detalhes', 'Reação emocional da cliente', 'Encantamento no resultado final'] },
        { dia: 'Dia 3', nome: 'Action', narrativa: 'Mostrar intensidade, movimento e autoridade.', sensacao: 'Energia e alto nível técnico.', transmite: '"Aqui acontece."', ritmo: 'Mais rápido e dinâmico.', estetica: 'Movimento, energia e performance.',
          aparece: ['Profissionais trabalhando', 'Movimento do salão', 'Técnicas sendo executadas', 'Escovas, pincéis, lavatórios', 'Clientes chegando', 'Antes e depois', 'Finalizações', 'Bastidores acelerados', 'Equipe em ação'] },
        { dia: 'Dia 4', nome: 'Tour', narrativa: 'Apresentar o salão como um espaço desejado.', sensacao: 'Desejo e pertencimento.', transmite: '"Eu preciso conhecer esse lugar."', ritmo: 'Mais contemplativo e elegante.', estetica: 'Luxo acessível, revista e arquitetura sensorial.',
          aparece: ['Story 1: "Você já conhece o The Blonde Concept?" (enquete Sim/Ainda não)', 'Story 2: "Então deixa a gente te mostrar a nossa casinha hoje…"', 'Story 3+: tour visual', 'Fachada, entrada, recepção', 'Espaço do café, lavatórios', 'Decoração, espelhos, produtos premium', 'Luz natural, ambiente sofisticado'] },
      ]},
      { t: 'callout', text: 'Regra mais importante: os stories NÃO são sobre "mostrar o salão" — são sobre TRANSMITIR SENSAÇÃO. Toda gravação carrega emoção, intenção e percepção de marca.' },
      { t: 'music', title: 'Músicas dos Stories', groups: [
        { nome: 'Vibes', faixas: ['Real Time Only', 'Flowers — Mimi', 'El Dorado — Farshid', 'Sip of You', 'Saturday Mood'] },
        { nome: 'Experience', faixas: ['Fool for U — Coulou', 'Vitrine — DJ Ph', "God's Creation", "Don't Worry", 'The Signs — Tash'] },
        { nome: 'Action', faixas: ['Vougue — JAB215', 'A la Vie — Petite Fleur', 'Timeless', 'Vibe — Slomow'] },
      ]},
    ],
  },

  // ───────────────────────── DIRETRIZ OFICIAL DE CONTEÚDO ─────────────────────────
  {
    id: 'diretriz',
    label: 'Diretriz de percepção',
    tag: 'O filtro premium',
    blocks: [
      { t: 'lead', text: 'Vale para stories, feed, reels, conteúdos patrocinados, bastidores e produções. O The Blonde Concept é uma marca de alto padrão: tudo postado precisa fortalecer percepção premium, desejo, sofisticação, autoridade, experiência e elegância. Se o conteúdo não fortalece a marca, não deve ser postado.' },
      { t: 'callout', text: 'Antes de postar, pergunte: Isso parece uma marca premium? Gera desejo? Transmite sofisticação? Tem intenção? Prende atenção? Se a resposta for não — não posta.' },
      { t: 'dont', items: [
        { titulo: 'Conteúdos sem gancho', evitar: ['Vídeos que começam fracos', 'Sem impacto inicial', 'Que não prendem nos primeiros segundos', 'Sem construção emocional'], regra: 'Todo conteúdo precisa gerar curiosidade, desejo ou impacto.' },
        { titulo: 'Conteúdos sem storytelling', evitar: ['Vídeos aleatórios', 'Cenas sem narrativa', 'Gravações sem intenção', 'Que apenas mostram procedimento'], regra: 'Todo conteúdo precisa contar uma história, mesmo que curta.' },
        { titulo: 'Conteúdos sem hype ou percepção', evitar: ['Vídeos comuns / "mais do mesmo"', 'Sem estética', 'Sem emoção', 'Que não parecem de marca premium'], regra: 'O conteúdo precisa parecer desejável, atual e sofisticado.' },
        { titulo: 'Takes longos e sem dinâmica', evitar: ['Vídeos cansativos', 'Cenas demoradas', 'Excesso de escova/secador', 'Takes repetitivos', 'Ritmo lento sem intenção'], regra: 'Em conteúdo dinâmico, o ritmo precisa manter retenção.' },
        { titulo: 'Movimentos sem elegância', evitar: ['Puxar cabelo', 'Movimentos agressivos', 'Pressa visual', 'Cenas desconfortáveis'], regra: 'Mesmo nos conteúdos intensos, a sofisticação permanece.' },
        { titulo: 'Estética amadora', evitar: ['Iluminação ruim', 'Câmera tremida', 'Enquadramento ruim', 'Excesso de zoom', 'Vídeos desfocados', 'Gravação desorganizada'], regra: 'Tudo precisa parecer limpo, sofisticado e intencional.' },
        { titulo: 'Poluição visual', evitar: ['Excesso de texto', 'Muitos emojis/gifs', 'Música que não conversa com a marca', 'Excesso de elementos'], regra: 'Menos informação, mais sensação.' },
      ]},
      { t: 'callout', text: 'Regra final: o The Blonde Concept não posta quantidade — posta percepção. Cada conteúdo gera desejo, fortalece autoridade, transmite experiência e eleva a marca. Se não for elegante, sofisticado, chique, premium, intencional e desejável: não posta.' },
    ],
  },
]

// resumo curto pra alimentar o contexto da IA (Cérebro / Scout / análise de virais)
export function bibleSummary(): string {
  return [
    'Conceito da marca: LUXO + EXPERIÊNCIA. Salão de alto padrão em região nobre de BH, referência em mechas/loiro de alto nível. Vende sensação e percepção premium, nunca preço.',
    'Padrão capa de revista (mín. 85% de qualidade). Não posta quantidade, posta percepção premium.',
    'Viralização: 30% gancho · 20% timing · 20% tema · 10% música · 10% edição · 10% descrição. Reter 15–30s.',
    'Stories em ciclo de 4 dias: Vibes · Experience · Action · Tour — transmitir sensação, não só mostrar o salão.',
    'Hashtags (3–4): salão (#salaobh #mechasbh #loirosbh) + público (#morenailuminadabh #theblondeconcept).',
    'Combos de cor: 1 morena · 2 dourado · 3 loiros.',
  ].join(' ')
}
