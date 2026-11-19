import type { AiBrain } from '../api/types'

export interface BrainField {
  key: keyof AiBrain
  label: string
  hint: string
  rows?: number
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
  equipe: `EQUIPE THE BLONDE CONCEPT
Todos treinados pelo Fábio Oliver, método The Blonde Concept.
Mesma técnica, mesma qualidade - variação é tempo de carreira e disponibilidade.

=== FÁBIO OLIVER - DIRETOR CRIATIVO ===
Visagista, hair designer e consultor de imagem.
- Combo mechas ter-qui: R$ 1.997 / 2.247 / 2.547
- Combo mechas sex-sáb: R$ 2.227 / 2.447 / 2.647
- Corte (qualquer modelo): R$ 497. Corte+trat+finalização: R$ 849
- Multi Blondor Wella: R$ 1.697-1.897. Mechas Contour: R$ 997
- Técnica Inverse (correção): R$ 1.997

=== TIER INTERMEDIÁRIO (Combos R$ 1.197 / 1.297 / 1.497) ===
* Rafael Martuchello - hair stylist 7 anos, corte+mechas, consultoria personalizada. Corte: R$ 390
* Jonne Rizzardi - mechas, ruivos, colorimetria avançada. Responsável pelo mega hair em fitas (adesivado TBC). Corte: R$ 360

=== TIER EQUIPE (Combos R$ 1.097 / 1.247 / 1.397 - corte R$ 345) ===
* Wislan Cristian - abertura de fundo pra loiros.
* Italo Ribeiro - hairstylist 7 anos, abertura de fundo pra loiros.
* Waleria Silva - iluminação pra morenas e loiras. Também faz maquiagem (R$ 250 express / R$ 300 social).
* Izabela Reis - mechas, coloração, corte, visagismo.
* Rafaela Scognamillo - mechas, valorização da identidade da cliente.
* Thais Silva - visagismo, design de mechas, cortes personalizados (5 anos).
* Brenda Rocha - ESPECIALISTA em cabelos cacheados, crespos e ondulados + colorimetria.

MATCH DE PERFIL (usar quando ajudar a fechar):
- Cacheado/crespo/ondulado -> Brenda Rocha
- Mega hair / alongamento -> Jonne Rizzardi
- Visagismo + corte autoral premium -> Fábio Oliver (ou Thais Silva no tier equipe)
- Abertura de fundo loiro -> Wislan, Italo
- Morena iluminada com menor investimento -> qualquer tier equipe (R$ 1.097)
- Noivas / data especial -> Fábio Oliver (diretor criativo)

SERVIÇOS COMUNS A TODO TIER EQUIPE (preço idêntico):
Coloração Wella a partir de R$ 326. Coloração Keune a partir de R$ 350. Coloração global R$ 350-950. Selagem Global R$ 699. Selagem Contorno R$ 399. Spa Days (Keune/Wella/Joico/Kérastase) R$ 300-360. Detox Spa R$ 600. Kérastase Fusion/Premiere R$ 490. Hidrolipídica R$ 980. Harmonização de cor a partir de R$ 850. Consultoria visagismo R$ 700. Lavagem R$ 80. Escova lisa R$ 150. Escova babyliss R$ 180`,
  reativacao_auto_ativa: true,
}

export const BRAIN_FIELDS: BrainField[] = [
  { key: 'norte',          label: 'Norte estratégico',     hint: 'O objetivo central que tudo deve servir.' },
  { key: 'publico_alvo',   label: 'Público-alvo',          hint: 'Quem é o cliente ideal.' },
  { key: 'tom_de_voz',     label: 'Tom de voz',            hint: 'Como a marca fala.' },
  { key: 'ofertas_atuais', label: 'Ofertas atuais',        hint: 'Serviços/pacotes em destaque agora.' },
  { key: 'diferenciais',   label: 'Diferenciais',          hint: 'Por que escolher este salão.' },
  { key: 'evitar',         label: 'O que evitar',          hint: 'Limites — o que a IA nunca deve fazer.' },
  { key: 'palavras_chave', label: 'Palavras-chave da marca', hint: 'Termos que devem aparecer no conteúdo.' },
  { key: 'equipe',         label: 'Equipe & preços',        hint: 'Lista dos profissionais com faixa de preço e especialidade — o coach cita daqui quando faz sentido.', rows: 20 },
]
