import { useState } from 'react'
import { useDB, update, useScope } from '../../core/store'
import { Icon, Modal, Field, PageHeader, Empty } from '../../core/ui'
import { fechaCorta, diasDesde, hoyISO, uid } from '../../core/format'

const MOTIVO_LABEL: Record<string, string> = {
  REINGRESO_REPARACION: 'Reingreso a reparación',
  VALUACION: 'Valuación',
  ENTREGA: 'Entrega',
  GARANTIA: 'Garantía',
}

export default function Citas() {
  const db = useDB()
  const { enScope } = useScope()
  const [nueva, setNueva] = useState(false)

  const deMiPatio = (ordenId: string) => enScope(db.ordenes.find((o) => o.id === ordenId)?.patio)
  const programadas = [...db.citas]
    .filter((c) => c.estado === 'PROGRAMADA' && deMiPatio(c.ordenId))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
  const historial = db.citas.filter((c) => c.estado !== 'PROGRAMADA' && deMiPatio(c.ordenId))

  // Mejora: prioridad sugerida por antigüedad de valuación (FIFO),
  // como pide el formulario de procesos.
  const esperandoCita = db.ordenes.filter(
    (o) => enScope(o.patio) && o.status === 'ESPERA_REFACCIONES' && o.refacciones.every((r) => r.recibida === true),
  )

  const marcar = (id: string, estado: 'CUMPLIDA' | 'NO_ASISTIO') =>
    update((d) => { d.citas.find((c) => c.id === id)!.estado = estado })

  return (
    <>
      <PageHeader
        title="Agenda de Citas"
        sub="Reingresos priorizados por antigüedad de valuación, espacio en taller y carga de técnicos"
        actions={<button className="btn btn-accent" onClick={() => setNueva(true)}><Icon name="plus" size={18} /> Nueva cita</button>}
      />

      {esperandoCita.length > 0 && (
        <div className="card card-pad mb-6" style={{ marginBottom: 'var(--sp-6)', borderLeft: '4px solid var(--rai-yellow-500)' }}>
          <h3 className="section-title">Listas para citar (refacciones completas)</h3>
          {esperandoCita.map((o) => (
            <p key={o.id} style={{ fontSize: 'var(--fs-sm)', padding: '4px 0' }}>
              OT <strong>{o.folio}</strong> · {o.vehiculo.marca} {o.vehiculo.tipo} · valuación con {diasDesde(o.fechaIngreso)} días de antigüedad
            </p>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Próximas citas</h3>
          {programadas.length === 0 && <Empty msg="Sin citas programadas." />}
          {programadas.map((c) => {
            const o = db.ordenes.find((x) => x.id === c.ordenId)
            return (
              <div key={c.id} className="row-between" style={{ padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{fechaCorta(c.fecha)} · {c.hora}</div>
                  <div style={{ fontSize: 'var(--fs-sm)' }}>
                    OT {o?.folio} · {o?.vehiculo.marca} {o?.vehiculo.tipo} · {o?.cliente.nombre}
                  </div>
                  <span className="badge badge-blue">{MOTIVO_LABEL[c.motivo]}</span>
                  {c.notas && <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{c.notas}</div>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => marcar(c.id, 'CUMPLIDA')}><Icon name="check" size={14} /> Llegó</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => marcar(c.id, 'NO_ASISTIO')}>No asistió</button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Historial</h3>
          {historial.length === 0 && <p className="muted">Sin historial.</p>}
          {historial.map((c) => {
            const o = db.ordenes.find((x) => x.id === c.ordenId)
            return (
              <div key={c.id} className="row-between" style={{ padding: '6px 0', fontSize: 'var(--fs-sm)', borderBottom: '1px solid var(--gray-100)' }}>
                <span>{fechaCorta(c.fecha)} · OT {o?.folio} · {MOTIVO_LABEL[c.motivo]}</span>
                <span className={`badge ${c.estado === 'CUMPLIDA' ? 'badge-green' : 'badge-red'}`}>
                  {c.estado === 'CUMPLIDA' ? 'Cumplida' : c.estado === 'NO_ASISTIO' ? 'No asistió' : 'Reagendada'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      {nueva && <ModalCita onClose={() => setNueva(false)} />}
    </>
  )
}

function ModalCita({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const { enScope } = useScope()
  const [f, setF] = useState({ ordenId: '', fecha: '', hora: '09:00', motivo: 'REINGRESO_REPARACION', notas: '' })
  return (
    <Modal title="Programar cita" onClose={onClose}>
      <div className="grid-2">
        <Field label="Orden de trabajo">
          <select value={f.ordenId} onChange={(e) => setF({ ...f, ordenId: e.target.value })}>
            <option value="">— Selecciona —</option>
            {db.ordenes
              .filter((o) => enScope(o.patio) && !['ENTREGADO', 'FACTURADO', 'PAGADO', 'CANCELADO'].includes(o.status))
              .map((o) => <option key={o.id} value={o.id}>{o.folio} · {o.vehiculo.marca} {o.vehiculo.tipo} · {o.cliente.nombre}</option>)}
          </select>
        </Field>
        <Field label="Motivo">
          <select value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}>
            {Object.entries(MOTIVO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </Field>
        <Field label="Hora">
          <input type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
        </Field>
        <Field label="Notas">
          <input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
        </Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!f.ordenId || !f.fecha}
          onClick={() => {
            update((d) => {
              d.citas.push({ id: uid(), ordenId: f.ordenId, fecha: f.fecha, hora: f.hora, motivo: f.motivo as never, estado: 'PROGRAMADA', notas: f.notas || undefined })
              const o = d.ordenes.find((x) => x.id === f.ordenId)!
              if (o.status === 'ESPERA_REFACCIONES') o.status = 'CITADO'
            })
            onClose()
          }}
        >
          <Icon name="check" size={16} /> Agendar
        </button>
      </div>
    </Modal>
  )
}
