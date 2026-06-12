import type { DB, EtapaId, Orden } from './types'
import { etapaDef } from './types'
import { claveSemana } from './format'

// ── Motor de productividad ──────────────────────────────────────────────
// Porcentajes del Formulario de procesos, sobre el monto de VENTA del área:
//   Hojalatería A 9% · B 20% · C 6%   |   Pintura A 13% · B 13% · C 9%
//   Mecánica (única) 20%
// El corte es semanal (sábado). Aquí el corte se calcula automáticamente a
// partir del log de etapas, eliminando el reporte manual de los lunes.

export interface LineaProductividad {
  tecnicoId: string
  ordenFolio: number
  ordenId: string
  etapa: EtapaId
  fecha: string
  base: number
  pct: number
  monto: number
}

function ventaArea(o: Orden, area: 'HOJALATERIA' | 'PINTURA' | 'MECANICA'): number {
  return o.presupuesto
    .filter((l) => l.area === area && l.autorizada !== 'RECHAZADA')
    .reduce((s, l) => s + l.venta, 0)
}

/** % de productividad de una etapa: override de parámetros o el default de ETAPAS. */
export function pctDeEtapa(db: DB, etapa: EtapaId): number | undefined {
  const ov = db.parametros?.pctEtapa?.[etapa]
  return ov ?? etapaDef(etapa).pct
}

export function lineasDeSemana(db: DB, semana: string): LineaProductividad[] {
  const out: LineaProductividad[] = []
  for (const o of db.ordenes) {
    for (const log of o.etapasLog) {
      const def = etapaDef(log.etapa)
      const pct = pctDeEtapa(db, log.etapa)
      if (!pct || !log.tecnicoId) continue
      if (claveSemana(new Date(log.fecha)) !== semana) continue
      const base = ventaArea(o, def.area as 'HOJALATERIA' | 'PINTURA' | 'MECANICA')
      out.push({
        tecnicoId: log.tecnicoId,
        ordenFolio: o.folio,
        ordenId: o.id,
        etapa: log.etapa,
        fecha: log.fecha,
        base,
        pct,
        monto: Math.round((base * pct) / 100),
      })
    }
  }
  return out
}

export function semanasDisponibles(db: DB): string[] {
  const set = new Set<string>()
  for (const o of db.ordenes)
    for (const log of o.etapasLog)
      if (pctDeEtapa(db, log.etapa) && log.tecnicoId) set.add(claveSemana(new Date(log.fecha)))
  return [...set].sort().reverse()
}

/** Carga de trabajo actual por técnico (órdenes activas asignadas). */
export function cargaTecnico(db: DB, tecnicoId: string): number {
  return db.ordenes.filter(
    (o) =>
      ['EN_PROCESO', 'GARANTIA'].includes(o.status) &&
      (o.hojalateroId === tecnicoId || o.pintorId === tecnicoId || o.mecanicoId === tecnicoId),
  ).length
}
