import { useDB, useScope } from '../../core/store'
import { ETAPAS } from '../../core/types'
import { PageHeader, Stat } from '../../core/ui'
import { mxn, diasDesde } from '../../core/format'

function Barra({ label, value, max, money }: { label: string; value: number; max: number; money?: boolean }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <div className="row-between" style={{ fontSize: 'var(--fs-sm)', marginBottom: 4 }}>
        <span>{label}</span>
        <strong>{money ? mxn(value) : value}</strong>
      </div>
      <div className="progress" role="img" aria-label={`${label}: ${money ? mxn(value) : value}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Reportes() {
  const db = useDB()
  const { patio, enScope } = useScope()

  const ordenes = db.ordenes.filter((o) => enScope(o.patio))
  const activas = ordenes.filter((o) => !['ENTREGADO', 'FACTURADO', 'PAGADO', 'CANCELADO', 'PAGO_DANOS'].includes(o.status))
  const entregadas = ordenes.filter((o) => ['ENTREGADO', 'FACTURADO', 'PAGADO'].includes(o.status))

  // Mezcla por aseguradora
  const porCia = new Map<string, number>()
  for (const o of ordenes) {
    const k = o.tipoCliente === 'PARTICULAR' ? 'Particular' : db.aseguradoras.find((a) => a.id === o.aseguradoraId)?.nombre ?? 'Otra'
    porCia.set(k, (porCia.get(k) ?? 0) + 1)
  }
  const ciaMax = Math.max(...porCia.values(), 1)

  // Cuellos de botella: unidades por etapa
  const porEtapa = ETAPAS.map((e) => ({
    nombre: e.nombre,
    n: activas.filter((o) => o.etapa === e.id).length,
  })).filter((x) => x.n > 0)
  const etapaMax = Math.max(...porEtapa.map((x) => x.n), 1)

  // Venta por área
  const areas = ['HOJALATERIA', 'PINTURA', 'MECANICA', 'TOT', 'REFACCION'] as const
  const ventaArea = areas.map((a) => ({
    area: a,
    venta: ordenes.flatMap((o) => o.presupuesto).filter((l) => l.area === a && l.autorizada !== 'RECHAZADA').reduce((s, l) => s + l.venta, 0),
  }))
  const ventaMax = Math.max(...ventaArea.map((x) => x.venta), 1)

  const cicloPromedio = entregadas.length
    ? Math.round(
        entregadas.reduce((s, o) => {
          const fin = o.etapasLog.find((l) => l.etapa === 'ENTREGA')?.fecha
          return s + (fin ? Math.max(0, (new Date(fin).getTime() - new Date(o.fechaIngreso).getTime()) / 86_400_000) : 0)
        }, 0) / entregadas.length,
      )
    : 0

  const masAntiguas = [...activas].sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime()).slice(0, 5)

  return (
    <>
      <PageHeader title="Reportes y KPIs" sub={`Indicadores en vivo a partir de la operación${patio ? ` — patio ${patio}` : " — los 3 patios"}`} />
      <div className="stat-grid mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <Stat label="Órdenes activas" value={activas.length} />
        <Stat label="Entregadas (histórico)" value={entregadas.length} tone="ok" />
        <Stat label="Ciclo promedio de reparación" value={`${cicloPromedio} días`} tone="accent" hint="ingreso → entrega" />
        <Stat
          label="Margen presupuestado"
          value={(() => {
            const ls = ordenes.flatMap((o) => o.presupuesto).filter((l) => l.autorizada !== 'RECHAZADA')
            const v = ls.reduce((s, l) => s + l.venta, 0)
            const c = ls.reduce((s, l) => s + l.costo, 0)
            return v ? `${Math.round(((v - c) / v) * 100)}%` : '—'
          })()}
          hint="venta vs costo de todas las órdenes"
        />
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Mezcla de clientes (unidades)</h3>
          {[...porCia.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <Barra key={k} label={k} value={v} max={ciaMax} />
          ))}
        </div>
        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Unidades por etapa (cuellos de botella)</h3>
          {porEtapa.map((x) => <Barra key={x.nombre} label={x.nombre} value={x.n} max={etapaMax} />)}
          {porEtapa.length === 0 && <p className="muted">Sin unidades activas.</p>}
        </div>
        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Venta presupuestada por área</h3>
          {ventaArea.map((x) => <Barra key={x.area} label={x.area} value={x.venta} max={ventaMax} money />)}
        </div>
        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Órdenes más antiguas en taller</h3>
          {masAntiguas.map((o) => (
            <div key={o.id} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 'var(--fs-sm)' }}>
              <span><strong>{o.folio}</strong> · {o.vehiculo.marca} {o.vehiculo.tipo}</span>
              <span className={`badge ${diasDesde(o.fechaIngreso) > 15 ? 'badge-red' : 'badge-yellow'}`}>{diasDesde(o.fechaIngreso)} días</span>
            </div>
          ))}
          {masAntiguas.length === 0 && <p className="muted">Sin órdenes activas.</p>}
        </div>
      </div>
    </>
  )
}
