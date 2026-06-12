import { useMemo, useState } from 'react'
import { useDB, update, useRol, useScope, puedeAutorizarVale, patioDeVale } from '../../core/store'
import { VALE_TIPO_LABEL, ROL_LABEL, type Vale, type ValeTipo } from '../../core/types'
import { Icon, Modal, Field, PageHeader, ValeBadge, Empty } from '../../core/ui'
import { mxn, fechaCorta, hoyISO, uid } from '../../core/format'

export default function Vales() {
  const db = useDB()
  const rol = useRol()
  const [tipo, setTipo] = useState<string>('')
  const [estado, setEstado] = useState<string>('')
  const [nuevo, setNuevo] = useState(false)

  const { patio, enScope } = useScope()
  const rows = useMemo(
    () =>
      [...db.vales]
        .sort((a, b) => b.folio - a.folio)
        .filter((v) => enScope(patioDeVale(db, v)))
        .filter((v) => !tipo || v.tipo === tipo)
        .filter((v) => !estado || v.status === estado),
    [db, tipo, estado, patio],
  )

  const autorizar = (v: Vale) =>
    update((d) => {
      const x = d.vales.find((y) => y.id === v.id)!
      x.status = 'AUTORIZADO'
      x.autorizadoPor = ROL_LABEL[rol]
      x.autorizadoRol = rol
    })

  const rechazar = (v: Vale) =>
    update((d) => { d.vales.find((y) => y.id === v.id)!.status = 'RECHAZADO' })

  const surtir = (v: Vale) =>
    update((d) => {
      const x = d.vales.find((y) => y.id === v.id)!
      x.status = 'SURTIDO'
      x.firmaProveedor = true
    })

  return (
    <>
      <PageHeader
        title="Vales y Compras"
        sub="Folio automático, copia digital para el proveedor y reglas de autorización del taller"
        actions={<button className="btn btn-accent" onClick={() => setNuevo(true)}><Icon name="plus" size={18} /> Nuevo vale</button>}
      />
      <div className="card card-pad mb-6" style={{ marginBottom: 'var(--sp-6)', background: 'var(--rai-blue-50)', border: 'none' }}>
        <p style={{ fontSize: 'var(--fs-sm)' }}>
          <strong>Regla de autorización:</strong> compras mayores a {mxn(2000)} solo las autoriza el <strong>Gerente</strong>;
          hasta {mxn(2000)} pueden autorizar Subgerente o Jefe de Taller en cascada. Rol activo:{' '}
          <span className="badge badge-navy">{ROL_LABEL[rol]}</span>
        </p>
      </div>
      <div className="toolbar">
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(VALE_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {['PENDIENTE', 'AUTORIZADO', 'RECHAZADO', 'SURTIDO', 'EN_REVISION', 'PAGADO'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Vale</th><th>Tipo</th><th>OT / Torre</th><th>Proveedor</th><th>Descripción</th>
              <th>Solicita</th><th>Fecha</th><th>Monto</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const o = db.ordenes.find((x) => x.id === v.ordenId)
              const prov = db.proveedores.find((p) => p.id === v.proveedorId)
              return (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700, color: 'var(--rai-blue-700)' }}>#{v.folio}</td>
                  <td><span className="badge badge-gray">{VALE_TIPO_LABEL[v.tipo]}</span></td>
                  <td>{o ? `${o.folio} · ${o.torre}` : '— almacén —'}</td>
                  <td>{prov?.nombre}</td>
                  <td>
                    {v.descripcion}
                    {v.detalle && <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{v.detalle}</div>}
                  </td>
                  <td>{v.solicita}</td>
                  <td>{fechaCorta(v.fecha)}</td>
                  <td style={{ fontWeight: 700 }}>{mxn(v.monto)}</td>
                  <td>
                    <ValeBadge s={v.status} />
                    {v.autorizadoPor && <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>aut. {v.autorizadoPor}</div>}
                  </td>
                  <td>
                    {v.status === 'PENDIENTE' && (
                      puedeAutorizarVale(rol, v.monto) ? (
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => autorizar(v)}><Icon name="check" size={14} /> Autorizar</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => rechazar(v)} aria-label={`Rechazar vale ${v.folio}`}><Icon name="x" size={14} /></button>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {v.monto > 2000 ? 'Requiere Gerente' : 'Requiere Subgte./Jefe Taller'}
                        </span>
                      )
                    )}
                    {v.status === 'AUTORIZADO' && (
                      <button className="btn btn-outline btn-sm" onClick={() => surtir(v)}>
                        <Icon name="truck" size={14} /> Surtido + firma
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty msg="Sin vales con ese filtro." />}
      </div>
      {nuevo && <ModalNuevo onClose={() => setNuevo(false)} />}
    </>
  )
}

function ModalNuevo({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const rol = useRol()
  const { patio: patioSesion, enScope } = useScope()
  const [f, setF] = useState({
    tipo: 'PINTURA' as ValeTipo, ordenId: '', proveedorId: '', solicita: '',
    descripcion: '', detalle: '', monto: 0,
  })
  const necesitaOrden = f.tipo !== 'MATERIAL'
  const provs = db.proveedores.filter((p) =>
    f.tipo === 'PINTURA' ? p.giro === 'PINTURA'
    : f.tipo === 'REFACCION' ? p.giro === 'REFACCIONES'
    : f.tipo === 'TOT' ? p.giro === 'TOT'
    : p.giro === 'MATERIALES',
  )
  const valido = f.proveedorId && f.solicita && f.descripcion && f.monto > 0 && (!necesitaOrden || f.ordenId)
  const autoAutoriza = puedeAutorizarVale(rol, f.monto)

  const guardar = () => {
    const patioVale = db.ordenes.find((o) => o.id === f.ordenId)?.patio ?? patioSesion ?? undefined
    update((d) => {
      d.vales.push({
        id: uid(), folio: d.config.siguienteFolioVale++,
        tipo: f.tipo, ordenId: f.ordenId || undefined, patio: patioVale || undefined, proveedorId: f.proveedorId,
        solicita: f.solicita, descripcion: f.descripcion, detalle: f.detalle || undefined,
        monto: f.monto, fecha: hoyISO(),
        status: autoAutoriza ? 'AUTORIZADO' : 'PENDIENTE',
        autorizadoPor: autoAutoriza ? ROL_LABEL[rol] : undefined,
        autorizadoRol: autoAutoriza ? rol : undefined,
      })
    })
    onClose()
  }

  return (
    <Modal title={`Nuevo vale (folio #${db.config.siguienteFolioVale})`} onClose={onClose}>
      <div className="grid-2">
        <Field label="Tipo de vale">
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as ValeTipo, proveedorId: '' })}>
            {Object.entries(VALE_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {necesitaOrden && (
          <Field label="Orden de trabajo (vehículo, torre, color y placas se toman del expediente)">
            <select value={f.ordenId} onChange={(e) => setF({ ...f, ordenId: e.target.value })}>
              <option value="">— Selecciona OT —</option>
              {db.ordenes
                .filter((o) => enScope(o.patio) && !['ENTREGADO', 'FACTURADO', 'PAGADO', 'CANCELADO', 'PAGO_DANOS'].includes(o.status))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.folio} · {o.torre} · {o.vehiculo.marca} {o.vehiculo.tipo} {o.vehiculo.color} · {o.vehiculo.placas}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Proveedor">
          <select value={f.proveedorId} onChange={(e) => setF({ ...f, proveedorId: e.target.value })}>
            <option value="">— Selecciona —</option>
            {provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Solicita (técnico / valuador)">
          <input value={f.solicita} onChange={(e) => setF({ ...f, solicita: e.target.value })} />
        </Field>
        <Field label="Descripción general">
          <input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Igualación blanco perlado" />
        </Field>
        <Field label={f.tipo === 'PINTURA' ? 'Detalle (ml, tipo de pintura, piezas)' : 'Detalle'}>
          <input value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} placeholder="750 ml · 2 piezas · base agua" />
        </Field>
        <Field label="Monto (+IVA)">
          <input type="number" min={0} value={f.monto || ''} onChange={(e) => setF({ ...f, monto: +e.target.value })} />
        </Field>
      </div>
      <p className="muted mt-4" style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>
        {f.monto > 0 && (autoAutoriza
          ? `Tu rol (${ROL_LABEL[rol]}) puede autorizar este monto: el vale nace autorizado.`
          : `Este monto ${f.monto > 2000 ? `excede ${mxn(2000)}: requerirá autorización del Gerente` : 'requerirá autorización de Subgerente o Jefe de Taller'}.`)}
      </p>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!valido} onClick={guardar}>
          <Icon name="check" size={16} /> Generar vale
        </button>
      </div>
    </Modal>
  )
}
