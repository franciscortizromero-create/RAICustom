// Exportación a CSV (compatible con Excel: BOM UTF-8 y separador coma).
export function exportarCSV(nombre: string, filas: Record<string, unknown>[]) {
  if (filas.length === 0) return
  const cols = Object.keys(filas[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}
