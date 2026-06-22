// Normaliza telefones brasileiros pra formato canônico E.164 sem o "+".
//
// Existe pra resolver um problema concreto: o n8n entrega o phone do
// WhatsApp em formatos diferentes (com/sem DDI, com/sem o "9" do celular,
// com formatação), e o inbox-ingest faz upsert em `whatsapp_contatos`
// por `(tenant_id, phone)`. Sem normalizar, o mesmo cliente vira N
// contatos distintos e as msgs se espalham por threads que nunca se
// encontram. Esse util é a fonte única — usar tanto no front (pra
// agrupar visualmente) quanto na edge function (pra consolidar no banco).
//
// Regra:
//   - Remove tudo que não é dígito.
//   - Tira "0" inicial (DDD com 0).
//   - Adiciona DDI 55 se faltar.
//   - Se ficou com 12 dígitos começando em 55 (celular sem o "9"),
//     insere o "9" entre DDD e número. WhatsApp só roda em celular,
//     então a heurística é segura.
//   - Retorna formato canônico: `55DDXXXXXXXXX` (13 dígitos).

export function normalizarPhoneBR(raw: string | null | undefined): string {
  let n = (raw || '').replace(/\D/g, '')
  if (!n) return ''
  if (n.length >= 11 && n[0] === '0') n = n.slice(1)
  if (n.length === 10 || n.length === 11) n = '55' + n
  if (n.length === 12 && n.startsWith('55')) {
    n = n.slice(0, 4) + '9' + n.slice(4)
  }
  return n
}
