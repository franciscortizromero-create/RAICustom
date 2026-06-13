import { useState } from 'react'
import { useDB, update, useScope } from '../../core/store'
import { Icon, Modal, Field, PageHeader, Stat, Empty } from '../../core/ui'
import { mxn, fechaCorta, hoyISO, uid } from '../../core/format'

export default function Facturacion() {
  const db = useDB()
  const { enScope } = useScope()
  const [nueva, setNueva] = useState(false)

  const facturas = db.facturas.filter((f) => enScope(db.ordenes.find((o) => o.id === f.ordenId)?.patio))
  const porCobrar = facturas.filter((f) => f.estado !== 'PAGADA').reduce((s, f) => s + f.monto, 0)
  const cobrado = facturas.filter((f) => f.estado === 'PAGADA').reduce((s, f) => s + f.monto, 0)
  // Órdenes entregadas con finiquito y sin factura: la administradora ya no
  // espera el expediente físico, lo toma directo de la base de datos.
  const listasParaFacturar = db.ordenes.filter((o) => enScope(o.patio) && o.status === 'ENTREGADO' && !o.facturaId)

  const avanzar = (id: string) =>
    update((d) => {
      const f = d.facturas.find((x) => x.id === id)!
      if (f.estado === 'EMITIDA') f.estado = 'SUBIDA_PORTAL'
      else if (f.estado === 'SUBIDA_PORTAL') {
        f.estado = 'PAGADA'
        f.fechaPago = hoyISO()
        f.formaPago = 'Transferencia'
        const o = d.ordenes.find((x) => x.id === f.ordenId)
        if (o) o.status = 'PAGADO'
      }
    })

  return (
    <>
      <PageHeader
        title="Facturación y Cobranza"
        sub="La contadora factura desde el expediente digital y da seguimiento al pago de cada CIA"
        actions={<button className="btn btn-accent" onClick={() => setNueva(true)}><Icon name="plus" size={18} /> Facturar orden</button>}
      />
      <div className="stat-grid mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <Stat label="Órdenes listas para facturar" value={listasParaFacturar.length} tone={listasParaFacturar.length ? 'warn' : 'ok'} />
        <Stat label="Por cobrar" value={mxn(porCobrar)} tone="accent" />
        <Stat label="Cobrado" value={mxn(cobrado)} tone="ok" />
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Factura</th><th>OT</th><th>Cliente / CIA</th><th>Fecha</th><th>Monto</th><th>Estado</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {[...facturas].reverse().map((f) => {
              const o = db.ordenes.find((x) => x.id === f.ordenId)
              return (
                <tr key={f.id}>
                  <td style={{ fontWeight: 700, color: 'var(--ink-brand)' }}>{f.folio}</td>
                  <td>{o?.folio}</td>
                  <td>{f.cliente}</td>
                  <td>{fechaCorta(f.fecha)}</td>
                  <td style={{ fontWeight: 700 }}>{mxn(f.monto)}</td>
                  <td>
                    <span className={`badge ${f.estado === 'PAGADA' ? 'badge-green' : f.estado === 'SUBIDA_PORTAL' ? 'badge-blue' : 'badge-yellow'}`}>
                      {f.estado === 'EMITIDA' ? 'Emitida' : f.estado === 'SUBIDA_PORTAL' ? 'En portal CIA' : `Pagada ${f.fechaPago ? fechaCorta(f.fechaPago) : ''}`}
                    </span>
                  </td>
                  <td>
                    {f.estado !== 'PAGADA' && (
                      <button className="btn btn-outline btn-sm" onClick={() => avanzar(f.id)}>
                        {f.estado === 'EMITIDA' ? 'Subir a portal' : 'Registrar pago'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {facturas.length === 0 && <Empty msg="Sin facturas." />}
      </div>
      {nueva && <ModalFactura onClose={() => setNueva(false)} />}
    </>
  )
}

function ModalFactura({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const { enScope } = useScope()
  const [ordenId, setOrdenId] = useState('')
  const [folio, setFolio] = useState('')
  const candidatas = db.ordenes.filter((o) => enScope(o.patio) && o.status === 'ENTREGADO' && !o.facturaId)
  const o = db.ordenes.find((x) => x.id === ordenId)
  const monto = o ? o.presupuesto.filter((l) => l.autorizada !== 'RECHAZADA').reduce((s, l) => s + l.venta, 0) : 0
  const cia = o?.aseguradoraId ? db.aseguradoras.find((a) => a.id === o.aseguradoraId) : null

  return (
    <Modal title="Facturar orden de trabajo" onClose={onClose}>
      <div className="grid-2">
        <Field label="Orden entregada con finiquito firmado">
          <select value={ordenId} onChange={(e) => setOrdenId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {candidatas.map((c) => (
              <option key={c.id} value={c.id}>{c.folio} · {c.vehiculo.marca} {c.vehiculo.tipo} · {c.cliente.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label="Folio fiscal / serie">
          <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="B-10413" />
        </Field>
      </div>
      {o && (
        <p className="mt-4" style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>
          Se facturará a <strong>{cia ? cia.nombre : o.cliente.nombre}</strong> por <strong>{mxn(monto)}</strong>
          {o.deducible ? ` (deducible cobrado al cliente: ${mxn(o.deducible)})` : ''}.
        </p>
      )}
      {candidatas.length === 0 && <p className="muted mt-4" style={{ marginTop: 'var(--sp-4)' }}>No hay órdenes entregadas pendientes de factura.</p>}
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!o || !folio}
          onClick={() => {
            update((d) => {
              const id = uid()
              const ord = d.ordenes.find((x) => x.id === ordenId)!
              d.facturas.push({
                id, folio, ordenId,
                cliente: cia ? `${cia.nombre} Cía. de Seguros` : ord.cliente.nombre,
                monto, fecha: hoyISO(), estado: 'EMITIDA',
              })
              ord.facturaId = id
              ord.status = 'FACTURADO'
            })
            onClose()
          }}
        >
          <Icon name="check" size={16} /> Emitir factura
        </button>
      </div>
    </Modal>
  )
}
