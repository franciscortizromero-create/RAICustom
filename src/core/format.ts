export const mxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export const mxn2 = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n)

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const hoyISO = () => new Date().toISOString()

export const diasDesde = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

/** Sábado de corte de la semana de una fecha (la semana de productividad corre Dom→Sáb). */
export function sabadoDeCorte(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() + ((6 - r.getDay() + 7) % 7))
  return r
}

export const claveSemana = (d: Date) => sabadoDeCorte(d).toISOString().slice(0, 10)

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
