// Paleta de gráficos — alinhada ao tema Command Center (escuro).
// Hook compartilhado entre charts de ads + organic + competitors.

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
    grid: 'rgba(255,255,255,0.05)',
    tick: '#7a8a99',
    tooltipBg: '#0d1219',
    tooltipFg: '#d4dde6',
    metaSolid: '#4d8df0',
    metaFaded: 'rgba(77,141,240,0.30)',
    googleSolid: '#6fcf4f',
    googleFaded: 'rgba(111,207,79,0.30)',
    convMsg: '#8b7dff',
    convAgend: '#2ee6c8',
    convVendas: '#ff3d71',
  };
}
