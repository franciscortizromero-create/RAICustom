import { useState } from 'react'
import { useDB, update } from '../../core/store'
import { Icon, Modal, Field, PageHeader, Stat, Empty } from '../../core/ui'
import { mxn, fechaCorta, hoyISO, uid } from '../../core/format'

export default function CuentasPorPagar() {
  const db = useDB()
  const [nuevo, setNuevo] = useState(false)

  const pendientes = db.contraRecibos.filter((c) => c.estado !== 'PAGADO')
  const totalPorPagar = pendientes.reduce((s, c) => s + c.facturas.reduce((a, f) => a + f.monto, 0), 0)
  const vencidos = pendientes.filter((c) => new Date(c.fechaVencimiento) < new Date())

  // Cotejo automático factura-vale: mejora sobre la revisión manual
  const coteja = (crId: string) => {
    const cr = db.contraRecibos.find((c) => c.id === crId)!
    const difs: string[] = []
    for (const f of cr.facturas) {
      for (const folio of f.valesFolios) {
        const vale = db.vales.find((v) => v.folio === folio)
        if (!vale) difs.push(`Vale #${folio} no existe en el sistema`)
        else if (vale.proveedorId !== cr.proveedorId) difs.push(`Vale #${folio} es de otro proveedor`)
      }
      const suma = f.valesFolios.reduce((s, folio) => s + (db.vales.find((v) => v.folio === folio)?.monto ?? 0), 0)
      if (Math.abs(suma - f.monto) > 1) difs.push(`Factura ${f.numFactura}: vales suman ${mxn(suma)} vs factura ${mxn(f.monto)}`)
    }
    update((d) => {
      const x = d.contraRecibos.find((c) => c.id === crId)!
      x.estado = difs.length ? 'CON_DIFERENCIAS' : 'AUTORIZADO'
      x.notas = difs.length ? difs.join(' · ') : 'Cotejo automático correcto: conceptos cobrados en expediente.'
      if (!difs.length) {
        x.facturas.forEach((f) =>
          f.valesFolios.forEach((folio) => {
            const v = d.vales.find((y) => y.folio === folio)
            if (v) { v.status = 'EN_REVISION'; v.contraReciboId = crId; v.facturaProveedor = f.numFactura }
          }),
        )
      }
    })
  }

  const pagar = (crId: string) =>
    update((d) => {
      const x = d.contraRecibos.find((c) => c.id === crId)!
      x.estado = 'PAGADO'
      x.fechaPago = hoyISO()
      x.facturas.forEach((f) =>
        f.valesFolios.forEach((folio) => {
          const v = d.vales.find((y) => y.folio === folio)
          if (v) v.status = 'PAGADO'
        }),
      )
    })

  return (
    <>
      <PageHeader
        title="Cuentas por Pagar"
        sub="Contrarecibos con cotejo automático de facturas contra vales del expediente"
        actions={<button className="btn btn-accent" onClick={() => setNuevo(true)}><Icon name="plus" size={18} /> Contrarecibo</button>}
      />
      <div className="stat-grid mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <Stat label="Contrarecibos abiertos" value={pendientes.length} />
        <Stat label="Total por pagar" value={mxn(totalPorPagar)} tone="accent" />
        <Stat label="Vencidos" value={vencidos.length} tone={vencidos.length ? 'warn' : 'ok'} hint="según días de crédito del proveedor" />
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Folio CR</th><th>Proveedor</th><th>Recepción</th><th>Facturas (vales)</th>
              <th>Monto</th><th>Vence</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[...db.contraRecibos].sort((a, b) => b.folio - a.folio).map((c) => {
              const prov = db.proveedores.find((p) => p.id === c.proveedorId)
              const monto = c.facturas.reduce((s, f) => s + f.monto, 0)
              const vencido = c.estado !== 'PAGADO' && new Date(c.fechaVencimiento) < new Date()
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700, color: 'var(--rai-blue-700)' }}>CR-{c.folio}</td>
                  <td>{prov?.nombre}<div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{prov?.diasCredito} días crédito</div></td>
                  <td>{fechaCorta(c.fecha)}</td>
                  <td>
                    {c.facturas.map((f) => (
                      <div key={f.numFactura} style={{ fontSize: 'var(--fs-xs)' }}>
                        {f.numFactura} <span className="muted">(vales {f.valesFolios.map((x) => `#${x}`).join(', ')})</span>
                      </div>
                    ))}
                    {c.notas && <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>{c.notas}</div>}
                  </td>
                  <td style={{ fontWeight: 700 }}>{mxn(monto)}</td>
                  <td style={{ color: vencido ? 'var(--danger-600)' : undefined, fontWeight: vencido ? 700 : 400 }}>
                    {fechaCorta(c.fechaVencimiento)}
                  </td>
                  <td>
                    <span className={`badge ${c.estado === 'PAGADO' ? 'badge-green' : c.estado === 'AUTORIZADO' ? 'badge-blue' : c.estado === 'CON_DIFERENCIAS' ? 'badge-red' : 'badge-yellow'}`}>
                      {c.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {(c.estado === 'REVISION' || c.estado === 'CON_DIFERENCIAS') && (
                      <button className="btn btn-outline btn-sm" onClick={() => coteja(c.id)}>
                        <Icon name="search" size={14} /> Cotejar
                      </button>
                    )}
                    {c.estado === 'AUTORIZADO' && (
                      <button className="btn btn-primary btn-sm" onClick={() => pagar(c.id)}>
                        <Icon name="money" size={14} /> Pagar (banca)
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {db.contraRecibos.length === 0 && <Empty msg="Sin contrarecibos." />}
      </div>
      {nuevo && <ModalCR onClose={() => setNuevo(false)} />}
    </>
  )
}

function ModalCR({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const [proveedorId, setProveedorId] = useState('')
  const [numFactura, setNumFactura] = useState('')
  const [valesSel, setValesSel] = useState<number[]>([])

  const valesProveedor = db.vales.filter(
    (v) => v.proveedorId === proveedorId && ['SURTIDO', 'AUTORIZADO'].includes(v.status) && !v.contraReciboId,
  )
  const monto = valesSel.reduce((s, folio) => s + (db.vales.find((v) => v.folio === folio)?.monto ?? 0), 0)

  return (
    <Modal title={`Nuevo contrarecibo (CR-${db.config.siguienteFolioCR})`} onClose={onClose}>
      <div className="grid-2">
        <Field label="Proveedor que presenta facturas">
          <select value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setValesSel([]) }}>
            <option value="">— Selecciona —</option>
            {db.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="No. de factura">
          <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)} placeholder="F-2231" />
        </Field>
      </div>
      {proveedorId && (
        <>
          <p className="muted mt-4" style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>
            Vales surtidos de este proveedor pendientes de engrapar a una factura:
          </p>
          {valesProveedor.length === 0 && <p className="muted">No hay vales disponibles.</p>}
          {valesProveedor.map((v) => (
            <label key={v.id} className="row" style={{ gap: 8, minHeight: 40, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={valesSel.includes(v.folio)}
                onChange={(e) =>
                  setValesSel(e.target.checked ? [...valesSel, v.folio] : valesSel.filter((x) => x !== v.folio))
                }
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 'var(--fs-sm)' }}>#{v.folio} · {v.descripcion} · <strong>{mxn(v.monto)}</strong></span>
            </label>
          ))}
          {valesSel.length > 0 && <p style={{ fontWeight: 700 }}>Total esperado de factura: {mxn(monto)}</p>}
        </>
      )}
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!proveedorId || !numFactura || valesSel.length === 0}
          onClick={() => {
            update((d) => {
              const prov = d.proveedores.find((p) => p.id === proveedorId)!
              const vence = new Date()
              vence.setDate(vence.getDate() + prov.diasCredito)
              d.contraRecibos.push({
                id: uid(), folio: d.config.siguienteFolioCR++,
                proveedorId, fecha: hoyISO(),
                facturas: [{ numFactura, valesFolios: valesSel, monto }],
                estado: 'REVISION', fechaVencimiento: vence.toISOString().slice(0, 10),
              })
            })
            onClose()
          }}
        >
          <Icon name="check" size={16} /> Generar contrarecibo
        </button>
      </div>
    </Modal>
  )
}
