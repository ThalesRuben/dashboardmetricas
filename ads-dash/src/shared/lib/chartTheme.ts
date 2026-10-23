// Paleta de gráficos — Blonde Signature (light + warm).
// Hook compartilhado entre charts de ads + organic + competitors.
//
// Mantém cores oficiais de plataformas (Meta azul, Google azul) pra
// brand recognition. Funil interno (convMsg/Agend/Vendas) usa tons
// warm da paleta Blonde: marrom principal, dourado, terracotta.

export interface ChartTheme {
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipFg: string;
  metaSolid: string;
  metaFaded: string;
  googleSolid: string;
  googleFaded: string;
  convMsg: string;
  convAgend: string;
  convVendas: string;
}

export function useChartTheme(): ChartTheme {
  return {
    grid: 'rgba(139, 69, 19, 0.08)',
    tick: '#7A6E64',
    tooltipBg: '#FFFFFF',
    tooltipFg: '#1A1613',
    metaSolid: '#1877F2',                           // Meta azul oficial
    metaFaded: 'rgba(24, 119, 242, 0.25)',
    googleSolid: '#4285F4',                         // Google azul oficial
    googleFaded: 'rgba(66, 133, 244, 0.25)',
    convMsg: '#C68F1E',                             // dourado quente
    convAgend: '#8B4513',                           // marrom luxo
    convVendas: '#B04A3B',                          // terracotta
  };
}
