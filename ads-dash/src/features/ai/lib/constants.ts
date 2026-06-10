import type { AiBrain } from '../api/types'

export interface BrainField {
  key: keyof AiBrain
  label: string
  hint: string
}

// "Cérebro" padrão da IA — armazena a diretriz de marketing que dá contexto a
// toda geração de copy, análise de virais e prompts do Gemini.
export const DEFAULT_BRAIN: AiBrain = {
  norte: 'Ser a referência nº 1 em loiro e mechas de alto padrão de Belo Horizonte. Conceito: LUXO + EXPERIÊNCIA — salão-experiência de alto nível em região nobre. Vender percepção premium e sensação, nunca preço.',
  publico_alvo: 'Mulheres de 25 a 45 anos, classe média-alta e alta, que valorizam autocuidado, exclusividade e estão dispostas a investir em qualidade e numa experiência memorável.',
  tom_de_voz: 'Sofisticado, acolhedor e especialista — alto padrão sem arrogância. Elegante, desejável, celebra a autoestima da cliente. Estética de capa de revista.',
  ofertas_atuais: 'Mechas iluminadas, loiro de referência, pacote noiva, transformação capilar de alto nível.',
  diferenciais: 'Localização nobre em BH, ambiente de luxo, experiência sensorial (café, acolhimento), equipe especialista em loiro, resultado impecável de capa de revista.',
  evitar: 'Preço como argumento, promessas exageradas, estética amadora, conteúdo "mais do mesmo", qualquer coisa que tire a percepção premium da marca.',
  palavras_chave: 'luxo, experiência, loiro de referência, mechas, alto padrão, transformação, autoestima, sofisticação, BH',
}

export const BRAIN_FIELDS: BrainField[] = [
  { key: 'norte',          label: 'Norte estratégico',     hint: 'O objetivo central que tudo deve servir.' },
  { key: 'publico_alvo',   label: 'Público-alvo',          hint: 'Quem é o cliente ideal.' },
  { key: 'tom_de_voz',     label: 'Tom de voz',            hint: 'Como a marca fala.' },
  { key: 'ofertas_atuais', label: 'Ofertas atuais',        hint: 'Serviços/pacotes em destaque agora.' },
  { key: 'diferenciais',   label: 'Diferenciais',          hint: 'Por que escolher este salão.' },
  { key: 'evitar',         label: 'O que evitar',          hint: 'Limites — o que a IA nunca deve fazer.' },
  { key: 'palavras_chave', label: 'Palavras-chave da marca', hint: 'Termos que devem aparecer no conteúdo.' },
]
