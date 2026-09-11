// src/helpers/sidebarOrder.ts
//
// Ordem personalizada do menu lateral (agência/supermercado): uma lista de hrefs na
// ordem escolhida pelo dono. `null` = ordem padrão do sistema (definida no front).

const MAX_ITEMS = 40

/** Valida/normaliza o payload recebido de `PUT .../sidebar-order` (ou de settings). */
export function sanitizeSidebarOrder(raw: unknown): string[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw)) throw new Error('Ordem do menu inválida.')

  const seen = new Set<string>()
  const out: string[] = []
  for (const value of raw) {
    const href = String(value ?? '').trim()
    if (!href || seen.has(href)) continue
    seen.add(href)
    out.push(href)
    if (out.length >= MAX_ITEMS) break
  }
  return out.length ? out : null
}
