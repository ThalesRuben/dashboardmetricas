import type { AdsPayload, Goal } from '@/features/ads/api/types'
import type { IgData } from '@/app/providers/MetricsContext'

export type InsightTone = 'success' | 'warning' | 'danger' | 'info'

export interface Insight {
  tone: InsightTone
  title: string
  body: string
}

const BRL = (v: number | string): string =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const THRESHOLDS = {
  roasGood: 4.0,
  roasMin:  3.0,
  ctrGood:  4.0,
  ctrMin:   2.5,
  budgetWarn: 0.85,
  conversionMin: 0.10,
}

export function generateInsights(data: AdsPayload | null | undefined, goals: Goal[] = []): Insight[] {
  if (!data) return []
  const out: Insight[] = []
  const goal = (key: string): Goal | undefined => goals.find(g => g.key === key && g.enabled)

  const roasGoal = goal('roas')?.value ?? THRESHOLDS.roasMin
  if (data.roas >= THRESHOLDS.roasGood) {
    out.push({
      tone: 'success',
      title: `ROAS forte: ${data.roas}x`,
      body: `Acima do teto histórico (${THRESHOLDS.roasGood}x). Considere aumentar o orçamento das campanhas com melhor desempenho em 20–30%.`,
    })
  } else if (data.roas < roasGoal) {
    out.push({
      tone: 'danger',
      title: `ROAS abaixo da meta (${data.roas}x < ${roasGoal}x)`,
      body: `Reveja criativos com baixo CTR e pause campanhas com ROAS < 2x. A receita atual (${BRL(data.receita)}) está sub-utilizando o investimento.`,
    })
  }

  const ctrGoal = goal('ctr')?.value ?? THRESHOLDS.ctrMin
  if (data.ctrMeta < ctrGoal) {
    out.push({
      tone: 'warning',
      title: `CTR Meta abaixo da meta (${data.ctrMeta}%)`,
      body: `O criativo provavelmente está cansado. Teste 2 novas variações com hook diferente nas próximas 48h.`,
    })
  }
  if (data.ctrGoogle < ctrGoal) {
    out.push({
      tone: 'warning',
      title: `CTR Google em queda (${data.ctrGoogle}%)`,
      body: `Refine palavras-chave negativas e teste novos títulos. CPCs tendem a subir quando o CTR cai.`,
    })
  }

  if (data.campanhas?.length) {
    const piores = [...data.campanhas]
      .filter(c => c.investido > 50)
      .sort((a, b) => a.roas - b.roas)
      .slice(0, 1)
    if (piores[0] && piores[0].roas < 3) {
      const c = piores[0]
      out.push({
        tone: 'danger',
        title: `Pausar "${c.nome}"?`,
        body: `ROAS ${c.roas}x e ${BRL(c.investido)} investidos. Está consumindo verba sem retorno proporcional. Pause ou reduza 50% do budget.`,
      })
    }

    const melhores = [...data.campanhas]
      .filter(c => c.investido > 50)
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 1)
    if (melhores[0] && melhores[0].roas >= 4.5) {
      const c = melhores[0]
      out.push({
        tone: 'success',
        title: `Escalar "${c.nome}"`,
        body: `ROAS de ${c.roas}x indica espaço pra escalar. Aumente o budget em 30–50% e monitore por 3 dias.`,
      })
    }
  }

  if (data.funil) {
    const f = data.funil
    const clkRate = f.impressoes > 0 ? f.cliques / f.impressoes : 0
    const msgRate = f.cliques > 0 ? f.mensagens / f.cliques : 0
    const agendRate = f.mensagens > 0 ? f.agendamentos / f.mensagens : 0
    const closeRate = f.agendamentos > 0 ? f.vendas / f.agendamentos : 0

    if (msgRate > 0 && msgRate < 0.20) {
      out.push({
        tone: 'warning',
        title: 'Conversão clique→mensagem baixa',
        body: `Apenas ${(msgRate*100).toFixed(0)}% dos cliques viram mensagem. Reveja a copy do anúncio e o primeiro contato no WhatsApp.`,
      })
    }
    if (agendRate > 0 && agendRate < 0.40) {
      out.push({
        tone: 'warning',
        title: 'Conversão mensagem→agendamento abaixo do esperado',
        body: `${(agendRate*100).toFixed(0)}% das mensagens viraram agendamento. Treine o atendimento ou use mensagens de qualificação rápida.`,
      })
    }
    if (closeRate > 0 && closeRate < 0.50) {
      out.push({
        tone: 'warning',
        title: 'Taxa de fechamento (agendamento→venda) baixa',
        body: `${(closeRate*100).toFixed(0)}% dos agendamentos fecharam. Reveja o processo de confirmação e lembrete antes do horário.`,
      })
    }
    if (clkRate > 0 && clkRate < 0.02) {
      out.push({
        tone: 'warning',
        title: 'CTR geral muito baixo',
        body: `Menos de 2% dos impactados clicaram. Indica problema de criativo ou segmentação ampla demais.`,
      })
    }
  }

  if (data.budget) {
    const total = data.budget.meta + data.budget.google
    if (total > 0) {
      const metaPct = data.budget.meta / total
      if (metaPct > 0.80) {
        out.push({
          tone: 'info',
          title: 'Concentração no Meta Ads',
          body: `${Math.round(metaPct*100)}% do budget está no Meta. Diversificar parte para Google (Pesquisa) reduz risco e captura demanda quente.`,
        })
      } else if (metaPct < 0.20) {
        out.push({
          tone: 'info',
          title: 'Pouco investimento em Meta Ads',
          body: `Apenas ${Math.round(metaPct*100)}% do budget no Meta. Para serviços locais (salão, clínica), CTWA costuma ter ROAS superior — vale testar.`,
        })
      }
    }
  }

  if (out.length === 0) {
    out.push({
      tone: 'success',
      title: 'Tudo dentro da meta',
      body: 'Nenhum alerta crítico no momento. Continue monitorando e teste novos criativos a cada 7 dias para evitar fadiga.',
    })
  }

  return out.slice(0, 6)
}

import { detectHype, HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'

export function generateInstagramInsights(ig: IgData | null | undefined): Insight[] {
  if (!ig?.account) return []
  const out = []
  const a = ig.account
  const posts = ig.posts || []

  const { topHype, hypePosts } = detectHype(posts, a)
  if (topHype) {
    const conf = HYPE_LEVELS[topHype.level]
    out.push({
      tone: topHype.level === 'blazing' ? 'danger' : 'success',
      title: `${conf.icon} ${conf.label}: "${(topHype.post.caption || '').slice(0, 50)}..."`,
      body: `${topHype.reasons.slice(0, 2).map(r => r.label).join(' · ')}. ${hypePosts.length > 1 ? `Você tem ${hypePosts.length} conteúdos no hype.` : ''} Aproveite agora — em 48h o algoritmo desacelera.`,
    })
  }

  if (a.engajamento_taxa >= 5) {
    out.push({
      tone: 'success',
      title: `Engajamento forte: ${a.engajamento_taxa}%`,
      body: `Acima da média do setor (3-4%). Continue com o formato atual e aumente a frequência de postagens em 30%.`,
    })
  } else if (a.engajamento_taxa < 2) {
    out.push({
      tone: 'warning',
      title: `Engajamento baixo: ${a.engajamento_taxa}%`,
      body: `Setor de beleza/serviços roda em 3-5%. Teste mais Reels com bastidores e antes/depois — costumam dobrar o engajamento.`,
    })
  }

  if (a.seguidores_delta_30d <= 0) {
    out.push({
      tone: 'danger',
      title: 'Sem crescimento de seguidores em 30d',
      body: `Provável: pouca exposição em Reels ou conta sem hashtag estratégica. Faça pelo menos 3 Reels/semana com áudio em alta.`,
    })
  } else if (a.seguidores_delta_30d > 200) {
    out.push({
      tone: 'success',
      title: `+${a.seguidores_delta_30d} seguidores em 30d`,
      body: `Crescimento saudável. Aproveita o momento e lança um lead magnet (ex: "guia de cuidados com o cabelo") pra capturar e-mail/WhatsApp.`,
    })
  }

  const reels = posts.filter(p => p.tipo === 'REEL')
  const imgs  = posts.filter(p => p.tipo === 'IMAGE')
  const reelsAvg = reels.length ? reels.reduce((s,p) => s + p.engajamento_taxa, 0) / reels.length : 0
  const imgsAvg  = imgs.length  ? imgs.reduce((s,p) => s + p.engajamento_taxa, 0) / imgs.length  : 0

  if (reelsAvg > imgsAvg * 1.5 && reels.length >= 2) {
    out.push({
      tone: 'info',
      title: 'Reels rendem 1.5x mais que fotos',
      body: `Engajamento médio: Reels ${reelsAvg.toFixed(1)}% vs Fotos ${imgsAvg.toFixed(1)}%. Reduza posts estáticos e dobre a frequência de Reels.`,
    })
  }

  const top = [...posts].sort((a, b) => b.engajamento_taxa - a.engajamento_taxa)[0]
  if (top && top.engajamento_taxa >= 7) {
    out.push({
      tone: 'success',
      title: `Replicar: "${(top.caption || '').slice(0, 40)}..."`,
      body: `Esse ${top.tipo === 'REEL' ? 'Reel' : 'post'} bombou (${top.engajamento_taxa}% engajamento, ${top.alcance.toLocaleString('pt-BR')} de alcance). Reproduza o formato/tema nos próximos 2 conteúdos.`,
    })
  }

  if (a.cliques_site > 0 && a.visitas_perfil > 0) {
    const ctaRate = (a.cliques_site / a.visitas_perfil * 100).toFixed(1)
    if (parseFloat(ctaRate) < 5) {
      out.push({
        tone: 'warning',
        title: `Apenas ${ctaRate}% das visitas clicam no link`,
        body: `Bio fraca ou link confuso. Use Linktree/Beacons com no máximo 3 botões: WhatsApp, Agendar, Site.`,
      })
    }
  }

  if (out.length === 0) {
    out.push({
      tone: 'info',
      title: 'Conta saudável',
      body: 'Sem alertas. Mantenha frequência de pelo menos 4 posts/semana sendo 60% Reels.',
    })
  }

  return out.slice(0, 5)
}

const QA_RULES = [
  {
    match: /(roas|retorno).*(caiu|baixo|ruim|piorou|despencou)/i,
    answer: (d) => {
      const piores = (d?.campanhas || []).filter(c => c.roas < 3 && c.investido > 50)
      if (piores.length) {
        const lista = piores.map(c => `• ${c.nome} (ROAS ${c.roas}x)`).join('\n')
        return `Provavelmente é fadiga de criativo ou segmentação ampla demais. Hoje você tem ${piores.length} campanha(s) puxando o ROAS pra baixo:\n\n${lista}\n\n**Plano de 48h:**\n1. Pause as 2 piores ou corte budget em 50%\n2. Lance 3 variações de criativo nas que ainda têm ROAS > 3\n3. Reveja segmentação — públicos amplos pioram com o tempo`
      }
      return `O ROAS médio agora é ${d?.roas}x. Causas mais comuns:\n\n1. **Fadiga de criativo** — anúncios rodando há mais de 7 dias\n2. **Segmentação ampla demais** — testes muitas vezes\n3. **Página de destino lenta ou confusa** — checa Lighthouse\n4. **Atendimento no WhatsApp lento** — mata a conversão CTWA\n\nSugestão: comece testando 2 novos criativos esta semana.`
    }
  },
  {
    match: /(qual|que).*(campanha|anuncio).*(pausar|desativar|matar|parar)/i,
    answer: (d) => {
      const piores = [...(d?.campanhas || [])]
        .filter(c => c.investido > 50)
        .sort((a, b) => a.roas - b.roas)
        .slice(0, 2)
      if (!piores.length) return 'Não tenho campanhas com investimento relevante pra avaliar agora.'
      const lista = piores.map(c => `• **${c.nome}** — ROAS ${c.roas}x · ${BRL(c.investido)} investidos · status: ${c.status}`).join('\n')
      return `Pelas métricas atuais, as candidatas a pausar são:\n\n${lista}\n\n**Critério:** ROAS abaixo de 3x e investimento já significativo. Antes de pausar de vez, tente cortar 50% do budget por 48h — se o ROAS não reagir, mate.`
    }
  },
  {
    match: /(escalar|aumentar.*budget|aumentar.*verba)/i,
    answer: (d) => {
      const melhores = [...(d?.campanhas || [])]
        .filter(c => c.investido > 50 && c.roas >= 4)
        .sort((a, b) => b.roas - a.roas)
        .slice(0, 2)
      if (!melhores.length) return 'No momento, nenhuma campanha tem ROAS alto o suficiente (>=4x) pra recomendar escala segura. Espere consolidar resultado.'
      const lista = melhores.map(c => `• **${c.nome}** — ROAS ${c.roas}x · ${BRL(c.investido)} atual · sugiro +${Math.round(c.investido*0.4)} (40%)`).join('\n')
      return `Candidatas a escalar:\n\n${lista}\n\n**Regra de ouro:** aumente máximo 30–50% do budget por dia. Acima disso, o algoritmo reentra em aprendizado e o ROAS pode cair temporariamente.`
    }
  },
  {
    match: /(ctr|clique).*(baixo|caiu|ruim)/i,
    answer: (d) => {
      const partes = []
      if (d?.ctrMeta < 2.5) partes.push(`Meta: ${d.ctrMeta}% (baixo)`)
      if (d?.ctrGoogle < 2.5) partes.push(`Google: ${d.ctrGoogle}% (baixo)`)
      const head = partes.length ? partes.join(' · ') + '\n\n' : ''
      return `${head}**Causas comuns de CTR baixo:**\n\n• Criativo cansado (>7 dias rodando)\n• Hook fraco nos primeiros 3 segundos\n• Imagem genérica de banco\n• Público amplo ou mal segmentado\n• Cópia muito longa pra mobile\n\n**Ação rápida:** lance 2 variações com hook diferente, foco no benefício (não na empresa) e CTA explícito.`
    }
  },
  {
    match: /(mensag|whatsapp|ctwa|atendimento).*(baixo|melhor|conversão|conversao)/i,
    answer: (d) => {
      const f = d?.funil
      if (!f) return 'Sem dados de funil pra avaliar agora.'
      const msgRate = f.cliques > 0 ? (f.mensagens / f.cliques * 100).toFixed(0) : '—'
      return `Hoje a conversão clique→mensagem é **${msgRate}%**.\n\n**Pra subir esse número:**\n\n1. **Mensagem inicial automática** que filtra: "Olá! Pra agendar, me confirma seu bairro e o serviço que procura"\n2. **Atendimento em até 5 min** — depois disso, conversão cai 60%\n3. **Anúncio honesto** — se promete preço, mostra preço\n4. **Botão "Mensagem" claro** — não esconde no rodapé do criativo\n5. **Ofereça horário no primeiro retorno** — não pergunte "como posso ajudar?"`
    }
  },
  {
    match: /(hype|viral|bombou|bomba|estourou|estourando|viralizou|viralizando|no momento|agora)/i,
    answer: (d, goals, ig) => {
      if (!ig?.account) return 'Os dados do Instagram ainda não carregaram. Confere em /instagram.'
      const { topHype, hypePosts } = detectHype(ig.posts, ig.account)
      if (!topHype) {
        return 'Nenhum conteúdo no hype no momento. Pra forçar viralização: posta um Reel curto (até 15s) com áudio em alta, hook nos primeiros 2 segundos e CTA claro no final.'
      }
      const conf = HYPE_LEVELS[topHype.level]
      const p = topHype.post
      const reasons = topHype.reasons.map(r => `• ${r.label}`).join('\n')
      return `${conf.icon} **${conf.label}!** ${hypePosts.length > 1 ? `Você tem ${hypePosts.length} conteúdos no hype.\n\n` : ''}**Mais quente:** "${(p.caption || '').slice(0, 60)}..."\n\n${reasons}\n\n**Faça AGORA:**\n• Sobe o conteúdo nos stories\n• Responde TODOS os comentários nas próximas 2h\n• Já planeja um Reel de continuação no mesmo formato\n• ${topHype.level === 'blazing' ? 'Considera impulsionar — orgânico vai cair em 48h' : 'Monitora a próxima 1h, se continuar subindo, considera impulsionar'}`
    }
  },
  {
    match: /(instagram|insta|reel|post|seguidor|engajamento|stories?)/i,
    answer: (d, goals, ig) => {
      if (!ig?.account) return 'Os dados do Instagram orgânico ainda não estão carregados. Vai em /instagram pra ver.'
      const a = ig.account
      const posts = ig.posts || []
      const top = [...posts].sort((a,b) => b.engajamento_taxa - a.engajamento_taxa)[0]
      const reels = posts.filter(p => p.tipo === 'REEL')
      const reelsAvg = reels.length ? (reels.reduce((s,p) => s + p.engajamento_taxa, 0) / reels.length).toFixed(1) : '—'
      return `**Resumo do Instagram (${a.username}):**\n\n• Seguidores: ${a.seguidores.toLocaleString('pt-BR')} (${a.seguidores_delta_30d>0?'+':''}${a.seguidores_delta_30d} em 30d)\n• Engajamento médio: ${a.engajamento_taxa}%\n• Reels (engajamento médio): ${reelsAvg}%\n• Alcance hoje: ${a.alcance_dia.toLocaleString('pt-BR')}\n\n**Top post:** ${top ? `"${(top.caption||'').slice(0,50)}..." — ${top.engajamento_taxa}%` : '—'}\n\n**Recomendação:** ${reels.length < 4 ? 'Aumente frequência de Reels (mínimo 4/semana).' : 'Mantenha frequência atual e teste novos formatos a cada 7 dias.'}`
    }
  },
  {
    match: /(insights?|análise|analise|resumo|status|como (estamos|esta))/i,
    answer: (d, goals) => {
      const ins = generateInsights(d, goals)
      if (!ins.length) return 'Sem insights gerados.'
      return ins.slice(0, 4).map((i, idx) => `${idx+1}. **${i.title}**\n   ${i.body}`).join('\n\n')
    }
  },
  {
    match: /(ola|olá|oi|hey|hello|bom dia|boa tarde|boa noite)/i,
    answer: () => 'Olá! Sou seu assistente de mídia paga. Posso analisar suas métricas e sugerir o que ajustar.\n\n**Tente perguntar:**\n• "Por que meu ROAS caiu?"\n• "Qual campanha pausar?"\n• "Como melhorar a conversão de mensagens?"\n• "Me dá um resumo de hoje"',
  },
  {
    match: /(ajuda|help|o que.*pode|consegue|sabe fazer)/i,
    answer: () => 'Eu analiso suas métricas em tempo real e te ajudo a decidir.\n\n**O que sei responder:**\n• Diagnóstico de ROAS, CTR, conversão\n• Quais campanhas pausar / escalar\n• Como melhorar atendimento CTWA\n• Distribuição de budget Meta vs Google\n• Resumo executivo de qualquer período\n\nQuanto mais específica a pergunta, melhor a resposta.',
  },
]

const TAG_LABELS = {
  'antes-depois': 'Antes e depois',
  'tutorial':     'Tutorial / passo a passo',
  'promo':        'Promoção / oferta',
  'bastidor':     'Bastidor',
  'depoimento':   'Depoimento de cliente',
  'tendencia':    'Tendência',
  'dica':         'Dica / educativo',
}
const TYPE_LABELS = { REEL: 'Reels', IMAGE: 'Imagens', CAROUSEL: 'Carrosséis', STORY: 'Stories' }

const DIM_META = {
  gancho:       { label: 'Gancho', values: { resultado:'mostra o resultado primeiro', pergunta:'abre com pergunta', choque:'afirmação de impacto', 'antes-depois':'antes e depois imediato', storytelling:'história/narrativa', polemica:'opinião polêmica', bastidor:'puxa pra dentro' } },
  emocao:       { label: 'Emoção', values: { surpresa:'surpresa', inspiracao:'inspiração', identificacao:'identificação', urgencia:'urgência', humor:'humor', curiosidade:'curiosidade', confianca:'confiança/prova social' } },
  audio:        { label: 'Áudio', values: { trend:'áudio em alta', original:'áudio original', musica:'música licenciada', 'voz-off':'narração', 'sem-audio':'sem áudio' } },
  ritmo_edicao: { label: 'Ritmo de edição', values: { 'cortes-rapidos':'cortes rápidos', 'ritmo-medio':'ritmo médio', 'plano-unico':'plano único', slideshow:'slideshow' } },
}

// Encontra a dimensão/valor com maior engajamento médio entre os conteúdos validados.
function topContentDimension(content) {
  let best = null
  for (const dim of Object.keys(DIM_META)) {
    const stats: Record<string, { sum: number; n: number }> = {}
    content.forEach(c => {
      const v = c[dim]
      if (!v) return
      if (!stats[v]) stats[v] = { sum: 0, n: 0 }
      stats[v].sum += c.engajamento_taxa
      stats[v].n += 1
    })
    Object.entries(stats).forEach(([value, s]) => {
      if (s.n < 1) return
      const avg = s.sum / s.n
      if (!best || avg > best.avgEng) {
        best = {
          dim,
          dimLabel: DIM_META[dim].label,
          value,
          valueLabel: DIM_META[dim].values[value] || value,
          avgEng: avg,
        }
      }
    })
  }
  return best
}

// Insights comparando você com concorrentes.
// you: { seguidores, engajamento_taxa, posts_semana }
// rivals: [{ nome, seguidores, engajamento_taxa, posts_semana, growth30d }]
// content (opcional): [{ tipo, tag, tema, engajamento_taxa, competitorNome }]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateCompetitorInsights(you: any, rivals: any[], content: any[] = []): Insight[] {
  if (!you || !rivals?.length) return []
  const out = []
  const all = [you, ...rivals]

  // Análise de conteúdos validados
  if (content.length >= 2) {
    // tema com maior engajamento médio
    const tagStats: Record<string, { sum: number; n: number }> = {}
    content.forEach(c => {
      if (!tagStats[c.tag]) tagStats[c.tag] = { sum: 0, n: 0 }
      tagStats[c.tag].sum += c.engajamento_taxa
      tagStats[c.tag].n += 1
    })
    let bestTag: { tag: string; avg: number } | null = null
    Object.entries(tagStats).forEach(([tag, s]) => {
      const avg = s.sum / s.n
      if (!bestTag || avg > bestTag.avg) bestTag = { tag, avg }
    })
    // formato dominante
    const typeCounts = {}
    content.forEach(c => { typeCounts[c.tipo] = (typeCounts[c.tipo] || 0) + 1 })
    const topType = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0]
    const best = [...content].sort((a, b) => b.engajamento_taxa - a.engajamento_taxa)[0]

    if (bestTag) {
      out.push({
        tone: 'info',
        title: `Conteúdo de "${TAG_LABELS[bestTag.tag] || bestTag.tag}" domina no nicho`,
        body: `É o tema com maior engajamento entre os conteúdos validados dos concorrentes (${bestTag.avg.toFixed(1)}% médio). Adicione ao seu calendário de conteúdo esta semana.`,
      })
    }
    if (best) {
      out.push({
        tone: 'success',
        title: `Replicar: "${best.tema}"`,
        body: `Melhor conteúdo validado (${best.engajamento_taxa}% de ${best.competitorNome}). ${best.formato_nota || 'Recrie o formato adaptando para a sua marca.'}`,
      })
    }
    if (topType) {
      out.push({
        tone: 'info',
        title: `Concorrentes apostam em ${TYPE_LABELS[topType] || topType}`,
        body: `É o formato mais frequente entre os conteúdos validados. Se você ainda não produz ${TYPE_LABELS[topType] || topType} com regularidade, está perdendo terreno.`,
      })
    }

    // DNA: dimensão dominante (gancho/emoção/áudio/ritmo) ponderada por engajamento
    const dnaInsight = topContentDimension(content)
    if (dnaInsight) {
      out.push({
        tone: 'success',
        title: `Padrão vencedor: ${dnaInsight.dimLabel.toLowerCase()} "${dnaInsight.valueLabel}"`,
        body: `Os conteúdos validados que usam esse padrão têm ${dnaInsight.avgEng.toFixed(1)}% de engajamento médio. Aplique esse elemento nos seus próximos posts.`,
      })
    }
  }

  // ranking de seguidores
  const byFollowers = [...all].sort((a, b) => b.seguidores - a.seguidores)
  const followerRank = byFollowers.findIndex(p => p === you) + 1
  const leader = byFollowers[0]
  if (followerRank === 1) {
    out.push({
      tone: 'success',
      title: 'Você lidera em seguidores',
      body: `Está em 1º entre ${all.length} perfis monitorados. Mantenha a frequência de Reels — liderança se perde rápido.`,
    })
  } else {
    const gap = leader.seguidores - you.seguidores
    out.push({
      tone: 'info',
      title: `Você está em ${followerRank}º de ${all.length} em seguidores`,
      body: `O líder (${leader.nome}) tem ${gap.toLocaleString('pt-BR')} seguidores a mais. Foque em conteúdo de alcance (Reels com áudios em alta) pra fechar o gap.`,
    })
  }

  // engajamento
  const avgEng = all.reduce((s, p) => s + (p.engajamento_taxa || 0), 0) / all.length
  if (you.engajamento_taxa > avgEng * 1.15) {
    out.push({
      tone: 'success',
      title: 'Seu engajamento bate o mercado',
      body: `Sua taxa (${you.engajamento_taxa}%) está acima da média dos concorrentes (${avgEng.toFixed(1)}%). Audiência menor mas mais quente — ótimo pra conversão.`,
    })
  } else if (you.engajamento_taxa < avgEng * 0.85) {
    const best = [...rivals].sort((a, b) => b.engajamento_taxa - a.engajamento_taxa)[0]
    out.push({
      tone: 'warning',
      title: 'Engajamento abaixo dos concorrentes',
      body: `Sua taxa (${you.engajamento_taxa}%) está abaixo da média (${avgEng.toFixed(1)}%). ${best ? `${best.nome} performa ${best.engajamento_taxa}% — vale analisar o formato de conteúdo deles.` : ''}`,
    })
  }

  // frequência de posts
  const avgFreq = all.reduce((s, p) => s + (p.posts_semana || 0), 0) / all.length
  if (you.posts_semana < avgFreq * 0.7) {
    out.push({
      tone: 'warning',
      title: 'Você posta menos que o mercado',
      body: `Sua frequência (${you.posts_semana}/sem) está abaixo da média dos concorrentes (${avgFreq.toFixed(1)}/sem). Consistência é o que mais move o algoritmo — suba pra pelo menos ${Math.ceil(avgFreq)}.`,
    })
  }

  // reputação (Reclame Aqui)
  const comRep = rivals.filter(r => (r.reclame_aqui_nota || 0) > 0)
  if (comRep.length) {
    const fraco = [...comRep].sort((a, b) => a.reclame_aqui_nota - b.reclame_aqui_nota)[0]
    const forte = [...comRep].sort((a, b) => b.reclame_aqui_nota - a.reclame_aqui_nota)[0]
    if (fraco.reclame_aqui_nota < 7) {
      out.push({
        tone: 'info',
        title: `Brecha de reputação: ${fraco.nome}`,
        body: `${fraco.nome} tem nota ${fraco.reclame_aqui_nota.toFixed(1)}/10 no Reclame Aqui. Reputação fraca do concorrente é oportunidade — destaque atendimento e prova social nos seus anúncios.`,
      })
    } else if (forte.reclame_aqui_nota >= 8.5) {
      out.push({
        tone: 'warning',
        title: `${forte.nome} tem reputação forte`,
        body: `Nota ${forte.reclame_aqui_nota.toFixed(1)}/10 no Reclame Aqui. Concorrente sólido — para ganhar dele, foque em diferencial de experiência, não em preço.`,
      })
    }
  }

  if (out.length === 0) {
    out.push({
      tone: 'info',
      title: 'Posição competitiva equilibrada',
      body: 'Você está na média do mercado nas principais métricas. Pra se destacar, aposte em um formato que os concorrentes não exploram.',
    })
  }

  return out.slice(0, 5)
}

// === Gerador de roteiro a partir do "DNA do conteúdo vencedor" ===

// Extrai o valor dominante (ponderado por engajamento) de cada dimensão.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractContentDNA(content: any[]): Record<string, string | null> {
  if (!content?.length) return null
  const pick = (dim) => {
    const stats: Record<string, { sum: number; n: number }> = {}
    content.forEach(c => {
      const v = c[dim]
      if (!v) return
      if (!stats[v]) stats[v] = { sum: 0, n: 0 }
      stats[v].sum += c.engajamento_taxa
      stats[v].n += 1
    })
    let best: { value: string; avg: number } | null = null
    Object.entries(stats).forEach(([value, s]) => {
      const avg = s.sum / s.n
      if (!best || avg > best.avg) best = { value, avg }
    })
    return best ? (best as { value: string; avg: number }).value : null
  }
  const typeCounts = {}
  content.forEach(c => { typeCounts[c.tipo] = (typeCounts[c.tipo] || 0) + 1 })
  const topType = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] || 'REEL'
  return {
    gancho: pick('gancho'),
    emocao: pick('emocao'),
    audio: pick('audio'),
    ritmo_edicao: pick('ritmo_edicao'),
    topType,
  }
}

const GANCHO_TEMPLATES = {
  resultado:     (t) => `Abra JÁ mostrando o resultado final de "${t}" — sem introdução, direto no impacto visual. Os 2 primeiros segundos decidem tudo.`,
  pergunta:      (t) => `Abra com uma pergunta que o público faz pra si mesmo sobre "${t}". Ex: "Sabe por que [problema relacionado a ${t}] acontece?"`,
  choque:        (t) => `Abra com uma afirmação forte que quebre o senso comum sobre "${t}". Algo que faça a pessoa parar de rolar o feed.`,
  'antes-depois':(t) => `Mostre o "antes" por ~1 segundo e corte direto pro "depois" de "${t}". O contraste é o gancho.`,
  storytelling:  (t) => `Comece contando uma situação real ligada a "${t}" — uma cliente, um problema, um pedido. Crie identificação imediata.`,
  polemica:      (t) => `Abra com uma opinião que divide sobre "${t}". Posicionamento gera comentário, e comentário gera alcance.`,
  bastidor:      (t) => `Comece já dentro da cena, mostrando os bastidores de "${t}". Sem cartela de abertura — puxe pra dentro.`,
}

const EMOCAO_HINT = {
  surpresa:      'Construa pra um momento de "uau" — guarde o melhor pro fim.',
  inspiracao:    'Conecte o conteúdo a uma transformação maior — autoestima, confiança.',
  identificacao: 'Fale a dor real da cliente nas palavras dela. Ela tem que pensar "sou eu".',
  urgencia:      'Deixe claro o custo de não agir agora (vaga, promoção, época do ano).',
  humor:         'Use um tom leve e bem-humorado — sem perder a credibilidade técnica.',
  curiosidade:   'Segure a informação principal — entregue só no final pra manter até o fim.',
  confianca:     'Mostre prova: resultado real, depoimento, número de clientes atendidas.',
}

const CTA_BY_TAG = {
  'antes-depois': 'Quer esse resultado? Agenda pelo link da bio.',
  tutorial:       'Salva esse post pra não esquecer — e me conta nos comentários se vai testar.',
  promo:          'Vagas limitadas: comenta "EU QUERO" que te mando os detalhes no direct.',
  bastidor:       'É assim que cuidamos de cada cliente. Marca quem precisa conhecer o salão.',
  depoimento:     'Quer fazer parte dessas histórias? Agenda sua avaliação pelo link da bio.',
  tendencia:      'Curtiu a tendência? Manda pra aquela amiga que ia amar fazer.',
  dica:           'Segue o perfil pra mais dicas como essa toda semana.',
}

export interface ScriptBlock {
  titulo: string
  texto: string
}

export interface Script {
  baseadoEm: number
  formato: string
  audioLabel: string
  ritmoLabel: string
  duracao: string
  blocos: ScriptBlock[]
}

// Gera um roteiro estruturado seguindo o padrão vencedor extraído dos conteúdos validados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateScript(content: any[], tema: string, tag = 'antes-depois'): Script {
  const dna = extractContentDNA(content)
  const t = (tema || 'seu serviço').trim()

  const gancho = dna?.gancho || 'resultado'
  const emocao = dna?.emocao || 'surpresa'
  const audio = dna?.audio || 'trend'
  const ritmo = dna?.ritmo_edicao || 'cortes-rapidos'
  const formato = dna?.topType || 'REEL'

  const audioLabel = {
    trend: 'áudio em alta (trend do momento)', original: 'áudio original / sua própria fala',
    musica: 'música licenciada', 'voz-off': 'narração em voz off', 'sem-audio': 'sem áudio (texto na tela)',
  }[audio] || audio
  const ritmoLabel = {
    'cortes-rapidos': 'cortes rápidos e dinâmicos', 'ritmo-medio': 'ritmo médio',
    'plano-unico': 'plano único contínuo', slideshow: 'slideshow de fotos',
  }[ritmo] || ritmo

  return {
    baseadoEm: dna ? content.length : 0,
    formato,
    audioLabel,
    ritmoLabel,
    duracao: formato === 'REEL' ? '15 a 30 segundos' : 'curto e objetivo',
    blocos: [
      {
        titulo: 'Gancho (0–3s)',
        texto: (GANCHO_TEMPLATES[gancho] || GANCHO_TEMPLATES.resultado)(t),
      },
      {
        titulo: 'Desenvolvimento',
        texto: `Entregue o conteúdo de "${t}" no formato de ${tagLabelPt(tag)}. ${EMOCAO_HINT[emocao] || ''} Mantenha ${ritmoLabel} pra não perder a retenção.`,
      },
      {
        titulo: 'CTA (chamada para ação)',
        texto: CTA_BY_TAG[tag] || CTA_BY_TAG['antes-depois'],
      },
    ],
  }
}

function tagLabelPt(tag) {
  return {
    'antes-depois': 'antes e depois', tutorial: 'tutorial / passo a passo',
    promo: 'oferta', bastidor: 'bastidor', depoimento: 'depoimento de cliente',
    tendencia: 'tendência', dica: 'dica educativa',
  }[tag] || tag
}

export function answerQuestion(question: string, data: AdsPayload | null, goals: Goal[] = [], ig: IgData | null = null): string {
  const q = (question || '').trim()
  if (!q) return 'Faz uma pergunta sobre suas métricas. Ex: "Qual campanha pausar?"'

  for (const rule of QA_RULES) {
    if (rule.match.test(q)) return rule.answer(data, goals, ig)
  }

  return `Não tenho regra exata pra essa pergunta ainda, mas com base nos dados atuais:\n\n• ROAS: ${data?.roas}x\n• CTR Meta: ${data?.ctrMeta}% · Google: ${data?.ctrGoogle}%\n• Mensagens: ${data?.mensagens} · Vendas: ${data?.vendas}\n• Investimento: ${BRL(data?.investimento || 0)}\n${ig?.account ? `• Instagram: ${ig.account.seguidores.toLocaleString('pt-BR')} seguidores · ${ig.account.engajamento_taxa}% engajamento\n` : ''}\nTenta reformular ou pergunte sobre **ROAS, CTR, campanhas, Instagram, conversão ou budget**. Ou digite "resumo" pra ver os principais alertas.`
}

export function suggestionChips(ig: IgData | null | undefined): string[] {
  const base = [
    'Por que meu ROAS caiu?',
    'Qual campanha pausar?',
    'Como melhorar mensagens?',
    'Me dá um resumo',
  ]
  if (ig?.posts?.length) {
    const { topHype } = detectHype(ig.posts, ig.account)
    if (topHype) {
      return ['🔥 Tem algo no hype?', ...base.slice(0, 3)]
    }
  }
  return base
}
