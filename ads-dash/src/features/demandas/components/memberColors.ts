// Paleta determinística por membro — mesma pessoa mantém a mesma cor em todo lugar
// (avatar no card, série no gráfico, badge na tabela).
//
// 12 hues bem espaçadas no círculo cromático pra minimizar colisão visual
// entre pessoas diferentes (com 5 membros, dá pra cair em 5 cores distintas
// e evidentemente diferentes na maioria dos casos).

const PALETTE = [
  '#ef4444', // vermelho
  '#f97316', // laranja
  '#eab308', // amarelo
  '#84cc16', // lima
  '#22c55e', // verde
  '#14b8a6', // teal
  '#06b6d4', // ciano
  '#3b82f6', // azul
  '#8b5cf6', // violeta
  '#d946ef', // fúcsia
  '#ec4899', // rosa
  '#f43f5e', // vermelho-rosa
];

// FNV-1a — distribuição melhor que polinomial simples pra strings similares
// (UUIDs de Supabase começam com prefixos parecidos entre si).
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function colorForMember(id: string | null | undefined): string {
  if (!id) return '#556170';
  return PALETTE[hash(id) % PALETTE.length];
}

// Distribui as cores da paleta pelos membros do time garantindo
// espaçamento máximo — evita que 3 UUIDs "sem sorte" caiam em hues
// vizinhos. Usar quando o time inteiro estiver disponível
// (EquipeRendimento, KanbanCard com prop `equipe`, etc.).
export function colorMapForTeam(ids: (string | null | undefined)[]): Map<string, string> {
  const unicos = Array.from(new Set(ids.filter((x): x is string => !!x)));
  // Ordem determinística por hash pra que a atribuição não flutue entre renders.
  unicos.sort((a, b) => hash(a) - hash(b));
  const passo = unicos.length > 0 ? Math.max(1, Math.floor(PALETTE.length / unicos.length)) : 1;
  const mapa = new Map<string, string>();
  unicos.forEach((id, i) => {
    mapa.set(id, PALETTE[(i * passo) % PALETTE.length]);
  });
  return mapa;
}

export function initialsForMember(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
