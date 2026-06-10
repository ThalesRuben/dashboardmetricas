// Formatadores compartilhados — toda formatação numérica/data passa por aqui.

const numberFmt = new Intl.NumberFormat('pt-BR');
const numberFmt2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const currencyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const currencyFmt2 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

type Num = number | string | null | undefined;
type DateLike = Date | string | number | null | undefined;

const toNum = (n: Num): number => Number(n) || 0;

export const fmtNumber = (n: Num): string => numberFmt.format(toNum(n));
export const fmtNumber2 = (n: Num): string => numberFmt2.format(toNum(n));
export const fmtBRL = (n: Num): string => currencyFmt.format(toNum(n));
export const fmtBRL2 = (n: Num): string => currencyFmt2.format(toNum(n));
export const fmtPct = (n: Num, digits = 1): string => `${toNum(n).toFixed(digits)}%`;
export const fmtRoas = (n: Num): string => `${toNum(n).toFixed(2)}x`;

export const fmtCompact = (n: Num): string => {
  const v = Math.abs(toNum(n));
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace('.0', '') + 'k';
  return String(Math.round(v));
};

export const fmtDelta = (n: Num, suffix = '%'): string => {
  const v = toNum(n);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}${suffix}`;
};

const toDate = (d: DateLike): Date | null => {
  if (!d) return null;
  return d instanceof Date ? d : new Date(d);
};

export const fmtDate = (d: DateLike): string => {
  const date = toDate(d);
  if (!date) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateShort = (d: DateLike): string => {
  const date = toDate(d);
  if (!date) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const fmtDateTime = (d: DateLike): string => {
  const date = toDate(d);
  if (!date) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const fmtTimeAgo = (d: DateLike): string => {
  const date = toDate(d);
  if (!date) return '';
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'agora há pouco';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
};
