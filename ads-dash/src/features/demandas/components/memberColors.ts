// Paleta determinística por membro — mesma pessoa mantém a mesma cor em todo lugar
// (avatar no card, série no gráfico, badge na tabela).

const PALETTE = [
  '#5dcaa5', // teal
  '#7f77dd', // roxo
  '#ef9f27', // âmbar
  '#d4537e', // magenta
  '#3fb0d8', // ciano claro
  '#c69c47', // ocre
  '#8bb96b', // verde-oliva
  '#e57373', // coral
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorForMember(id: string | null | undefined): string {
  if (!id) return '#556170';
  return PALETTE[hash(id) % PALETTE.length];
}

export function initialsForMember(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
