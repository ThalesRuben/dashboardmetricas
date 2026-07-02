// Seed das metas reais de 2026 (faturamento + tráfego), por trimestre e mês,
// com cenários mín / base / máx. Os meses já realizados (Q1 fechado, Abr/Mai
// do Q2) vêm com `valor_realizado` preenchido.
//
// Disparado via botão em /settings ("Aplicar metas 2026"). Idempotente: o
// upsert do repo grava por chave (kpi, periodo, periodo_ref).

import { metasRepo } from '../api/metasRepo'
import type { MetaUpsertInput } from '../api/types'

interface Cenarios { min: number; base: number; max: number }
interface MetaMensal { ref: string; faturamento: Cenarios; trafego: Cenarios; faturamentoReal?: number; trafegoReal?: number }
interface MetaTrim {
  ref: string
  faturamento: Cenarios
  trafego: Cenarios
  faturamentoReal?: number
  trafegoReal?: number
  meses: MetaMensal[]
}

// ---------- Dados ----------

const Q1: MetaTrim = {
  ref: '2026-Q1',
  // Q1 fechado: usa o real como meta também pra contagem do "no plano"
  faturamento: { min: 980926.05, base: 980926.05, max: 980926.05 },
  trafego:     { min: 31_163.15, base: 31_163.15, max: 31_163.15 },
  faturamentoReal: 980926.05,
  trafegoReal: 31_163.15,
  meses: [
    { ref: '2026-01', faturamento: { min: 315559.55, base: 315559.55, max: 315559.55 }, trafego: { min:  8_300.00, base:  8_300.00, max:  8_300.00 }, faturamentoReal: 315559.55, trafegoReal:  8_300.00 },
    { ref: '2026-02', faturamento: { min: 294542.23, base: 294542.23, max: 294542.23 }, trafego: { min:  5_844.54, base:  5_844.54, max:  5_844.54 }, faturamentoReal: 294542.23, trafegoReal:  5_844.54 },
    { ref: '2026-03', faturamento: { min: 370824.27, base: 370824.27, max: 370824.27 }, trafego: { min: 17_018.61, base: 17_018.61, max: 17_018.61 }, faturamentoReal: 370824.27, trafegoReal: 17_018.61 },
  ],
}

const Q2: MetaTrim = {
  ref: '2026-Q2',
  faturamento: { min: 1_300_000, base: 1_380_000, max: 1_440_000 },
  trafego:     { min: 82_000,    base: 90_000,    max: 98_000 },
  faturamentoReal: 1_208_573.20,
  trafegoReal: 63_535.12,
  meses: [
    { ref: '2026-04', faturamento: { min: 400_000, base: 420_000, max: 430_000 }, trafego: { min: 25_000, base: 27_000, max: 30_000 }, faturamentoReal: 372_926.64, trafegoReal: 18_854.49 },
    { ref: '2026-05', faturamento: { min: 430_000, base: 460_000, max: 480_000 }, trafego: { min: 27_000, base: 30_000, max: 33_000 }, faturamentoReal: 428_256.98, trafegoReal: 21_130.88 },
    { ref: '2026-06', faturamento: { min: 470_000, base: 500_000, max: 530_000 }, trafego: { min: 30_000, base: 33_000, max: 35_000 }, faturamentoReal: 407_389.58, trafegoReal: 23_549.75 },
  ],
}

const Q3: MetaTrim = {
  ref: '2026-Q3',
  faturamento: { min: 1_760_000, base: 1_870_000, max: 1_950_000 },
  trafego:     { min: 150_000,   base: 165_000,   max: 180_000 },
  meses: [
    { ref: '2026-07', faturamento: { min: 560_000, base: 600_000, max: 620_000 }, trafego: { min: 50_000, base: 55_000, max: 60_000 } },
    { ref: '2026-08', faturamento: { min: 590_000, base: 620_000, max: 650_000 }, trafego: { min: 50_000, base: 55_000, max: 60_000 } },
    { ref: '2026-09', faturamento: { min: 610_000, base: 650_000, max: 680_000 }, trafego: { min: 50_000, base: 55_000, max: 60_000 } },
  ],
}

const Q4: MetaTrim = {
  ref: '2026-Q4',
  faturamento: { min: 2_180_000, base: 2_250_000, max: 2_400_000 },
  trafego:     { min: 210_000,   base: 225_000,   max: 240_000 },
  meses: [
    { ref: '2026-10', faturamento: { min: 700_000, base: 750_000, max: 770_000 }, trafego: { min: 70_000, base: 75_000, max: 80_000 } },
    { ref: '2026-11', faturamento: { min: 730_000, base: 750_000, max: 800_000 }, trafego: { min: 70_000, base: 75_000, max: 80_000 } },
    { ref: '2026-12', faturamento: { min: 750_000, base: 750_000, max: 830_000 }, trafego: { min: 70_000, base: 75_000, max: 80_000 } },
  ],
}

const TRIMESTRES: MetaTrim[] = [Q1, Q2, Q3, Q4]

// Soma de Q1..Q4 (já real onde fechado) — usado pro periodo='ano'.
const ANO_2026 = {
  ref: '2026',
  faturamento: {
    min:  Q1.faturamento.min  + Q2.faturamento.min  + Q3.faturamento.min  + Q4.faturamento.min,
    base: Q1.faturamento.base + Q2.faturamento.base + Q3.faturamento.base + Q4.faturamento.base,
    max:  Q1.faturamento.max  + Q2.faturamento.max  + Q3.faturamento.max  + Q4.faturamento.max,
  },
  trafego: {
    min:  Q1.trafego.min  + Q2.trafego.min  + Q3.trafego.min  + Q4.trafego.min,
    base: Q1.trafego.base + Q2.trafego.base + Q3.trafego.base + Q4.trafego.base,
    max:  Q1.trafego.max  + Q2.trafego.max  + Q3.trafego.max  + Q4.trafego.max,
  },
  // Realizado faturamento = Q1 fechado + Q2 fechado (Jun 407.389,58).
  faturamentoReal: (Q1.faturamentoReal ?? 0) + (Q2.faturamentoReal ?? 0),
  // Realizado tráfego = Q1 fechado + Q2 fechado (Jun já entrou 2026-07-02).
  trafegoReal: (Q1.trafegoReal ?? 0) + (Q2.trafegoReal ?? 0),
}

// ---------- Upserts ----------

function inputFaturamento(periodo: MetaUpsertInput['periodo'], ref: string, c: Cenarios, real?: number): MetaUpsertInput {
  return {
    kpi: 'faturamento',
    periodo,
    periodo_ref: ref,
    valor_meta: c.base,
    valor_meta_min: c.min,
    valor_meta_max: c.max,
    valor_realizado: real,
    unidade: 'BRL',
    label: 'Faturamento',
    ordem: 1,
  }
}

function inputTrafego(periodo: MetaUpsertInput['periodo'], ref: string, c: Cenarios, real?: number): MetaUpsertInput {
  return {
    kpi: 'investimento_ads',
    periodo,
    periodo_ref: ref,
    valor_meta: c.base,
    valor_meta_min: c.min,
    valor_meta_max: c.max,
    valor_realizado: real,
    unidade: 'BRL',
    label: 'Investimento em Ads',
    ordem: 6,
  }
}

export interface SeedSummary {
  trimestres: number
  meses: number
  ano: number
}

export async function seedMetas2026(): Promise<SeedSummary> {
  const out: SeedSummary = { trimestres: 0, meses: 0, ano: 0 }

  for (const t of TRIMESTRES) {
    await metasRepo.upsert(inputFaturamento('trimestre', t.ref, t.faturamento, t.faturamentoReal))
    await metasRepo.upsert(inputTrafego('trimestre', t.ref, t.trafego, t.trafegoReal))
    out.trimestres++

    for (const m of t.meses) {
      await metasRepo.upsert(inputFaturamento('mes', m.ref, m.faturamento, m.faturamentoReal))
      await metasRepo.upsert(inputTrafego('mes', m.ref, m.trafego, m.trafegoReal))
      out.meses++
    }
  }

  await metasRepo.upsert(inputFaturamento('ano', ANO_2026.ref, ANO_2026.faturamento, ANO_2026.faturamentoReal))
  await metasRepo.upsert(inputTrafego('ano', ANO_2026.ref, ANO_2026.trafego, ANO_2026.trafegoReal))
  out.ano++

  return out
}
