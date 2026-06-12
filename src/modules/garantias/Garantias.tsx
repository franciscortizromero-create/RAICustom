import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB, update, useScope } from '../../core/store'
import { Icon, Modal, Field, PageHeader, Empty } from '../../core/ui'
import { fechaCorta, hoyISO, uid } from '../../core/format'

export default function Garantias() {
  const db = useDB()
  const { enScope } = useScope()
  const [nueva, setNueva] = useState(false)
  const activas = db.ordenes.filter((o) => enScope(o.patio) && o.status === 'GARANTIA')

  return (
    <>
      <PageHeader
        title="Garantías"
        sub="Reapertura con inventario nuevo, diagnóstico de procedencia y reproceso con los mismos técnicos"
        actions={<button className="btn btn-accent" onClick={() => setNueva(true)}><Icon name="plus" size={18} /> Recibir garantía</button>}
      />
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>OT garantía</th><th>OT original</th><th>Vehículo</th><th>Cliente</th><th>Ingreso</th><th>Diagnóstico</th><th></th></tr>
          </thead>
          <tbody>
            {activas.map((o) => (
              <tr key={o.id}>
                <td style={{ fontWeight: 700, color: 'var(--rai-blue-700)' }}>{o.folio}</td>
                <td>{o.garantiaDe ?? '—'}</td>
                <td>{o.vehiculo.marca} {o.vehiculo.tipo} · {o.vehiculo.placas}</td>
                <td>{o.cliente.nombre}</td>
                <td>{fechaCorta(o.fechaIngreso)}</td>
                <td style={{ maxWidth: 320 }}>{o.comentarios}</td>
                <td><Link className="btn btn-outline btn-sm" to={`/ordenes/${o.id}`}>Expediente</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {activas.length === 0 && <Empty msg="Sin garantías activas. Las garantías procedentes reprocesan la orden con los mismos técnicos; si requieren refacciones se solicita un A1 a la CIA." />}
      </div>
      {nueva && <ModalGarantia onClose={() => setNueva(false)} />}
    </>
  )
}

function ModalGarantia({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const { enScope } = useScope()
  const [origenId, setOrigenId] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [procedente, setProcedente] = useState(true)
  const entregadas = db.ordenes.filter((o) => enScope(o.patio) && ['ENTREGADO', 'FACTURADO', 'PAGADO'].includes(o.status))
  const origen = db.ordenes.find((o) => o.id === origenId)

  return (
    <Modal title="Recibir reclamo de garantía" onClose={onClose}>
      <div className="grid-2">
        <Field label="Orden original (entregada)">
          <select value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {entregadas.map((o) => (
              <option key={o.id} value={o.id}>{o.folio} · {o.vehiculo.marca} {o.vehiculo.tipo} · {o.cliente.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label="¿El daño reclamado es procedente?">
          <select value={procedente ? 'SI' : 'NO'} onChange={(e) => setProcedente(e.target.value === 'SI')}>
            <option value="SI">Sí — del trabajo realizado</option>
            <option value="NO">No procede</option>
          </select>
        </Field>
      </div>
      <div className="field mt-4" style={{ marginTop: 'var(--sp-4)' }}>
        <label>Diagnóstico de los daños reclamados</label>
        <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} placeholder="Detalle de brillo en portón…" />
      </div>
      <p className="muted mt-2" style={{ fontSize: 'var(--fs-sm)' }}>
        Si procede, se reabre la orden con un inventario nuevo y los mismos técnicos. El material adicional se registra normalmente.
      </p>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!origen || !diagnostico}
          onClick={() => {
            if (!procedente) { onClose(); return }
            update((d) => {
              const og = d.ordenes.find((x) => x.id === origenId)!
              d.ordenes.push({
                ...JSON.parse(JSON.stringify(og)),
                id: uid(),
                folio: d.config.siguienteFolioOrden++,
                fechaIngreso: hoyISO(),
                status: 'GARANTIA',
                etapa: 'PATIO',
                garantiaDe: og.folio,
                comentarios: `Garantía de OT ${og.folio}: ${diagnostico}`,
                presupuesto: [],
                refacciones: [],
                etapasLog: [],
                asignacionLog: [],
                facturaId: undefined,
                inventarios: [{
                  fecha: hoyISO(), tipo: 'GARANTIA',
                  checklist: og.inventarios[0]?.checklist ?? {}, combustible: 50,
                  firmaCliente: true, firmaInventario: true, fotos: 0,
                }],
              })
            })
            onClose()
          }}
        >
          <Icon name="check" size={16} /> {procedente ? 'Reabrir como garantía' : 'Registrar como no procedente'}
        </button>
      </div>
    </Modal>
  )
}
