import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

process.env.TZ = 'America/Sao_Paulo'
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/shared/ui/DateRangePicker.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled + '\nmodule.exports.formatDateInput = toInput;')(
  name => name.endsWith('.css') ? {} : require(name), module, module.exports,
)
const { fromPreset, formatDateInput } = module.exports
const whatsappPresets = [
  { key: 'hoje', days: 1 }, { key: 'ontem', days: 1, offset: 1 },
  { key: '7', days: 7 }, { key: '15', days: 15 }, { key: '30', days: 30 },
]

test('WhatsApp 15-day preset returns fifteen full days instead of removing the date filter', () => {
  const range = fromPreset('15', whatsappPresets)
  assert.ok(range, '15-day preset must not fall back to an unbounded report')
  assert.equal(range.presetKey, '15')
  assert.equal((range.to.getTime() - range.from.getTime() + 1) / 86_400_000, 15)
})

test('custom preset definitions control the actual dates', () => {
  const range = fromPreset('7', [{ key: '7', days: 3, offset: 2 }])
  assert.equal((range.to.getTime() - range.from.getTime() + 1) / 86_400_000, 3)
  const expected = new Date(); expected.setDate(expected.getDate() - 2)
  assert.equal(range.to.getDate(), expected.getDate())
})

test('editing a Brazilian full-day range preserves both displayed dates', () => {
  assert.equal(formatDateInput(new Date('2026-11-17T00:00:00-03:00')), '2026-11-17')
  assert.equal(formatDateInput(new Date('2026-11-17T23:59:59.999-03:00')), '2026-11-17')
})

test('default presets remain available to other pages', () => {
  const range = fromPreset('7')
  assert.equal((range.to.getTime() - range.from.getTime() + 1) / 86_400_000, 7)
  assert.equal(range.from.getHours(), 0)
  assert.equal(range.to.getHours(), 23)
  assert.equal(fromPreset('custom'), null)
})
