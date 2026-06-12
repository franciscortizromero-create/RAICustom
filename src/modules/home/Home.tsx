import { Link } from 'react-router-dom'
import { modulosPara, alertas } from '../../core/registry'
import { useDB, useScope } from '../../core/store'
import { ROL_LABEL } from '../../core/types'
import { Icon } from '../../core/ui'
import { mxn } from '../../core/format'

const TONE_CLASS: Record<string, string> = {
  blue: 'badge-blue', green: 'badge-green', yellow: 'badge-yellow', red: 'badge-red', gray: 'badge-gray',
}

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Home() {
  const db = useDB()
  const { rol, patio, global, enScope } = useScope()
  const avisos = alertas(db, patio)
  const visibles = modulosPara(rol, db.permisos)

  const misOrdenes = db.ordenes.filter((o) => enScope(o.patio))
  const enPiso = misOrdenes.filter((o) => ['EN_PROCESO', 'GARANTIA'].includes(o.status)).length
  const porEntregar = misOrdenes.filter((o) => o.etapa === 'ENTREGA' && o.status === 'EN_PROCESO').length
  const ventaActiva = misOrdenes
    .filter((o) => !['ENTREGADO', 'FACTURADO', 'PAGADO', 'CANCELADO', 'PAGO_DANOS'].includes(o.status))
    .reduce((s, o) => s + o.presupuesto.filter((l) => l.autorizada !== 'RECHAZADA').reduce((a, l) => a + l.venta, 0), 0)
  const porCobrar = db.facturas
    .filter((f) => f.estado !== 'PAGADA' && enScope(db.ordenes.find((o) => o.id === f.ordenId)?.patio))
    .reduce((s, f) => s + f.monto, 0)

  return (
    <>
      <section className="hero">
        <p style={{ fontWeight: 700, color: 'var(--rai-yellow-400)', letterSpacing: '0.08em', fontSize: 'var(--fs-xs)', textTransform: 'uppercase' }}>
          Hojalatería y Pintura · Aguascalientes
        </p>
        <h1>{saludo()}, {ROL_LABEL[rol]}</h1>
        <p>
          {patio
            ? <>Estás viendo la operación del patio <strong style={{ color: 'var(--rai-yellow-400)' }}>{patio}</strong>.</>
            : 'Vista global: operación de los 3 patios (AQUILES, P26 y GPE P).'}
          {' '}Recepción, valuación, piso de taller, vales, almacén, productividad y administración en un solo lugar.
        </p>
        <div className="row mt-6" role="group" aria-label="Indicadores generales">
          {[
            { v: String(enPiso), l: 'unidades en piso' },
            { v: String(porEntregar), l: 'listas para entrega' },
            { v: mxn(ventaActiva), l: 'venta en proceso' },
            { v: mxn(porCobrar), l: 'por cobrar' },
          ].map((k) => (
            <div key={k.l} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius)', padding: '10px 18px', minWidth: 150 }}>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>{k.v}</div>
              <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.85 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </section>

      {avisos.length > 0 && (
        <section className="card card-pad mb-6" aria-label="Alertas operativas">
          <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
            <span style={{ color: 'var(--warn-700)' }}><Icon name="alert" /></span>
            <h2 className="section-title">Requiere atención hoy{patio ? ` · ${patio}` : ''}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {avisos.map((a) => (
              <Link
                key={a.texto}
                to={a.path}
                className="row-between"
                style={{
                  padding: 'var(--sp-3) var(--sp-4)',
                  background: a.tone === 'red' ? 'var(--danger-100)' : 'var(--rai-yellow-100)',
                  color: a.tone === 'red' ? 'var(--danger-600)' : 'var(--warn-700)',
                  borderRadius: 'var(--radius)',
                  fontWeight: 600,
                  fontSize: 'var(--fs-sm)',
                }}
              >
                <span>{a.texto}</span>
                <Icon name="arrow-right" size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
        <h2 className="section-title">Módulos</h2>
        {!global && (
          <span className="badge badge-navy">Acceso: {ROL_LABEL[rol]} · patio {patio}</span>
        )}
      </div>
      <div className="springboard">
        {visibles.map((m) => {
          const kpi = m.kpi?.(db, patio)
          return (
            <Link key={m.id} to={m.path} className="tile">
              <span className="tile-icon"><Icon name={m.icon as never} size={26} /></span>
              {kpi && <span className={`badge ${TONE_CLASS[kpi.tone]} tile-kpi`}>{kpi.text}</span>}
              <div>
                <div className="tile-name">{m.nombre}</div>
                <p className="tile-desc">{m.descripcion}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
