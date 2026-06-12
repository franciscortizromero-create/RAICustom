import { useMemo, useState } from 'react'
import { useDB, update, useRol, useScope, puedeAutorizarSalida } from '../../core/store'
import { ROL_LABEL } from '../../core/types'
import { Icon, Modal, Field, PageHeader, Stat, Empty } from '../../core/ui'
import { mxn, fechaHora, hoyISO, uid } from '../../core/format'

export default function Almacen() {
  const db = useDB()
  const rol = useRol()
  const { patio, global, enScope } = useScope()
  const [almacenFiltro, setAlmacenFiltro] = useState('')
  const [salida, setSalida] = useState<string | null>(null) // materialId
  const [entrada, setEntrada] = useState<string | null>(null)

  const enAlcance = db.materiales.filter((m) => enScope(m.almacen))
  const mats = useMemo(
    () => enAlcance.filter((m) => !almacenFiltro || m.almacen === almacenFiltro),
    [db.materiales, almacenFiltro, patio],
  )
  const bajoMinimo = enAlcance.filter((m) => m.existencia < m.minimo)
  const valorInventario = enAlcance.reduce((s, m) => s + m.existencia * m.costo, 0)
  const movimientos = db.movimientos.filter((mv) =>
    enScope(db.materiales.find((m) => m.id === mv.materialId)?.almacen),
  )

  const generarReorden = (matId: string) => {
    const m = db.materiales.find((x) => x.id === matId)!
    const cantidad = m.maximo - m.existencia
    update((d) => {
      d.vales.push({
        id: uid(), folio: d.config.siguienteFolioVale++,
        tipo: 'MATERIAL', patio: m.almacen, proveedorId: m.proveedorId ?? 'mat1',
        solicita: 'Almacenista', descripcion: `${m.nombre} x ${cantidad} ${m.unidad}`,
        detalle: `Reorden: existencia ${m.existencia} < mínimo ${m.minimo}`,
        monto: Math.round(cantidad * m.costo), fecha: hoyISO(), status: 'PENDIENTE',
      })
    })
  }

  return (
    <>
      <PageHeader
        title="Almacén e Inventario"
        sub={`Existencias en línea, puntos de reorden y salidas autorizadas${patio ? ` — almacén ${patio}` : ' — los 3 almacenes'}`}
      />
      <div className="stat-grid mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <Stat label="Materiales registrados" value={enAlcance.length} />
        <Stat label="Bajo punto de reorden" value={bajoMinimo.length} tone={bajoMinimo.length ? 'warn' : 'ok'} hint={bajoMinimo.length ? 'Generar requisición con vale' : 'Stock saludable'} />
        <Stat label="Valor del inventario" value={mxn(valorInventario)} tone="accent" hint="existencia × costo" />
        <Stat label="Movimientos registrados" value={movimientos.length} />
      </div>

      {global && !patio && (
        <div className="toolbar">
          <Field label="Almacén / patio">
            <select value={almacenFiltro} onChange={(e) => setAlmacenFiltro(e.target.value)}>
              <option value="">Todos</option>
              {db.config.patios.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
      )}

      <div className="card table-wrap mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <table className="data">
          <thead>
            <tr>
              <th>Material</th><th>Almacén</th><th>Existencia</th><th>Mín / Máx</th>
              <th>Costo unit.</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mats.map((m) => {
              const bajo = m.existencia < m.minimo
              const pct = Math.min(100, Math.round((m.existencia / m.maximo) * 100))
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                  <td>{m.almacen}</td>
                  <td>
                    {m.existencia} {m.unidad}
                    <div className="progress mt-2" style={{ width: 110 }} aria-hidden="true">
                      <div style={{ width: `${pct}%`, background: bajo ? 'var(--danger-600)' : 'var(--rai-blue-600)' }} />
                    </div>
                  </td>
                  <td>{m.minimo} / {m.maximo}</td>
                  <td>{mxn(m.costo)}</td>
                  <td>
                    {bajo
                      ? <span className="badge badge-red"><Icon name="alert" size={12} /> Reordenar</span>
                      : <span className="badge badge-green">OK</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      {bajo && (
                        <button className="btn btn-accent btn-sm" onClick={() => generarReorden(m.id)}>
                          <Icon name="ticket" size={14} /> Vale reorden
                        </button>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => setSalida(m.id)}>Salida</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEntrada(m.id)}>Entrada</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card card-pad">
        <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Últimos movimientos</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Fecha</th><th>Material</th><th>Tipo</th><th>Cantidad</th><th>OT</th><th>Técnico</th><th>Autorizó</th></tr>
            </thead>
            <tbody>
              {[...movimientos].reverse().slice(0, 12).map((mv) => {
                const m = db.materiales.find((x) => x.id === mv.materialId)
                const o = db.ordenes.find((x) => x.id === mv.ordenId)
                return (
                  <tr key={mv.id}>
                    <td>{fechaHora(mv.fecha)}</td>
                    <td>{m?.nombre}</td>
                    <td>
                      <span className={`badge ${mv.tipo === 'ENTRADA' ? 'badge-green' : mv.tipo.startsWith('AJUSTE') ? 'badge-yellow' : 'badge-blue'}`}>
                        {mv.tipo.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{mv.cantidad} {m?.unidad}</td>
                    <td>{o?.folio ?? '—'}</td>
                    <td>{db.tecnicos.find((t) => t.id === mv.tecnicoId)?.nombre ?? '—'}</td>
                    <td>{mv.autorizadoPor ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {movimientos.length === 0 && <Empty msg="Sin movimientos." />}
        </div>
      </div>

      {salida && <ModalSalida matId={salida} onClose={() => setSalida(null)} />}
      {entrada && <ModalEntrada matId={entrada} onClose={() => setEntrada(null)} />}
    </>
  )
}

function ModalSalida({ matId, onClose }: { matId: string; onClose: () => void }) {
  const db = useDB()
  const rol = useRol()
  const { enScope } = useScope()
  const m = db.materiales.find((x) => x.id === matId)!
  const [f, setF] = useState({ cantidad: 1, ordenId: '', tecnicoId: '' })
  const autorizado = puedeAutorizarSalida(rol)

  return (
    <Modal title={`Salida de almacén · ${m.nombre}`} onClose={onClose}>
      {!autorizado && (
        <p role="alert" style={{ color: 'var(--warn-700)', fontWeight: 600, marginBottom: 'var(--sp-4)' }}>
          Las salidas autoriza Gerente, Valuador, Subgerente o Jefe de Taller. Tu rol actual ({ROL_LABEL[rol]}) no puede autorizar.
        </p>
      )}
      <div className="grid-2">
        <Field label={`Cantidad (${m.unidad}) — existencia: ${m.existencia}`}>
          <input type="number" min={1} max={m.existencia} value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: +e.target.value })} />
        </Field>
        <Field label="Orden de trabajo destino">
          <select value={f.ordenId} onChange={(e) => setF({ ...f, ordenId: e.target.value })}>
            <option value="">Almacén interno (sin OT)</option>
            {db.ordenes
              .filter((o) => enScope(o.patio) && ['EN_PROCESO', 'GARANTIA'].includes(o.status))
              .map((o) => <option key={o.id} value={o.id}>{o.folio} · {o.vehiculo.marca} {o.vehiculo.tipo}</option>)}
          </select>
        </Field>
        <Field label="Técnico que solicita">
          <select value={f.tecnicoId} onChange={(e) => setF({ ...f, tecnicoId: e.target.value })}>
            <option value="">— Selecciona —</option>
            {db.tecnicos.filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!autorizado || !f.tecnicoId || f.cantidad < 1 || f.cantidad > m.existencia}
          onClick={() => {
            update((d) => {
              d.materiales.find((x) => x.id === matId)!.existencia -= f.cantidad
              d.movimientos.push({
                id: uid(), fecha: hoyISO(), materialId: matId,
                tipo: f.ordenId ? 'SALIDA_ORDEN' : 'SALIDA_ALMACEN',
                cantidad: f.cantidad, ordenId: f.ordenId || undefined,
                tecnicoId: f.tecnicoId, autorizadoPor: ROL_LABEL[rol],
              })
            })
            onClose()
          }}
        >
          <Icon name="check" size={16} /> Autorizar salida
        </button>
      </div>
    </Modal>
  )
}

function ModalEntrada({ matId, onClose }: { matId: string; onClose: () => void }) {
  const db = useDB()
  const m = db.materiales.find((x) => x.id === matId)!
  const [cantidad, setCantidad] = useState(1)
  const [notas, setNotas] = useState('')
  return (
    <Modal title={`Entrada a inventario · ${m.nombre}`} onClose={onClose}>
      <div className="grid-2">
        <Field label={`Cantidad recibida (${m.unidad})`}>
          <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(+e.target.value)} />
        </Field>
        <Field label="Referencia (vale / factura)">
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Vale 4104 · F-1122" />
        </Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={cantidad < 1}
          onClick={() => {
            update((d) => {
              d.materiales.find((x) => x.id === matId)!.existencia += cantidad
              d.movimientos.push({
                id: uid(), fecha: hoyISO(), materialId: matId, tipo: 'ENTRADA', cantidad, notas: notas || undefined,
              })
            })
            onClose()
          }}
        >
          <Icon name="check" size={16} /> Registrar entrada
        </button>
      </div>
    </Modal>
  )
}
