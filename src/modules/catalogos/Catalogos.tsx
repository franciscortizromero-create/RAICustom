import { useState } from 'react'
import { useDB, update, resetDemo } from '../../core/store'
import { cargaTecnico } from '../../core/productividad'
import { Icon, Field, PageHeader, Modal } from '../../core/ui'
import { mxn, uid } from '../../core/format'

type Tab = 'tecnicos' | 'proveedores' | 'aseguradoras' | 'prestamos' | 'sistema'

export default function Catalogos() {
  const db = useDB()
  const [tab, setTab] = useState<Tab>('tecnicos')
  const [nuevoTec, setNuevoTec] = useState(false)

  const tabs: [Tab, string][] = [
    ['tecnicos', 'Técnicos'], ['proveedores', 'Proveedores'], ['aseguradoras', 'Aseguradoras'],
    ['prestamos', 'Préstamos'], ['sistema', 'Sistema'],
  ]

  return (
    <>
      <PageHeader title="Catálogos y Configuración" sub="Datos maestros que alimentan a todos los módulos" />
      <div className="row mb-6" style={{ marginBottom: 'var(--sp-6)' }} role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k} role="tab" aria-selected={tab === k}
            className={`btn ${tab === k ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'tecnicos' && (
        <div className="card table-wrap">
          <div className="row-between" style={{ padding: 'var(--sp-4)' }}>
            <h3 className="section-title">Técnicos</h3>
            <button className="btn btn-accent btn-sm" onClick={() => setNuevoTec(true)}><Icon name="plus" size={14} /> Agregar</button>
          </div>
          <table className="data">
            <thead><tr><th>Nombre</th><th>Rol</th><th>Patio</th><th>Carga actual</th><th>Activo</th></tr></thead>
            <tbody>
              {db.tecnicos.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                  <td><span className="badge badge-gray">{t.rol}</span></td>
                  <td>{t.patio}</td>
                  <td>{cargaTecnico(db, t.id)} unidades</td>
                  <td>
                    <button
                      className={`btn btn-sm ${t.activo ? 'btn-outline' : 'btn-ghost'}`}
                      onClick={() => update((d) => { const x = d.tecnicos.find((y) => y.id === t.id)!; x.activo = !x.activo })}
                    >
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'proveedores' && (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>Proveedor</th><th>Giro</th><th>Teléfono</th><th>Días de crédito</th></tr></thead>
            <tbody>
              {db.proveedores.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td><span className="badge badge-gray">{p.giro}</span></td>
                  <td>{p.telefono}</td>
                  <td>{p.diasCredito} días</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'aseguradoras' && (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>Aseguradora</th><th>Clave</th><th>Órdenes históricas</th></tr></thead>
            <tbody>
              {db.aseguradoras.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                  <td><span className="badge badge-navy">{a.clave}</span></td>
                  <td>{db.ordenes.filter((o) => o.aseguradoraId === a.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'prestamos' && (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>Técnico</th><th>Monto original</th><th>Saldo</th><th>Abono semanal</th></tr></thead>
            <tbody>
              {db.prestamos.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{db.tecnicos.find((t) => t.id === p.tecnicoId)?.nombre}</td>
                  <td>{mxn(p.montoOriginal)}</td>
                  <td style={{ fontWeight: 700, color: p.saldo > 0 ? 'var(--warn-700)' : 'var(--ok-600)' }}>{mxn(p.saldo)}</td>
                  <td>{mxn(p.abonoSemanal)} <span className="muted">(se descuenta en el corte)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sistema' && (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <h3 className="section-title">Sistema</h3>
          <p className="muted mt-2" style={{ marginTop: 'var(--sp-2)' }}>
            Folios siguientes — Orden: <strong>{db.config.siguienteFolioOrden}</strong> ·
            Vale: <strong>{db.config.siguienteFolioVale}</strong> ·
            Contrarecibo: <strong>CR-{db.config.siguienteFolioCR}</strong>
          </p>
          <p className="muted mt-2" style={{ marginTop: 'var(--sp-2)' }}>
            Los datos de esta demo viven en el navegador (localStorage). La capa de datos usa un
            adaptador intercambiable para migrar a un servidor central (Supabase/PostgreSQL) sin
            cambiar los módulos.
          </p>
          <button className="btn btn-danger mt-4" style={{ marginTop: 'var(--sp-4)' }} onClick={() => { if (confirm('¿Restaurar los datos de demostración? Se perderán los cambios capturados.')) resetDemo() }}>
            Restaurar datos de demostración
          </button>
        </div>
      )}

      {nuevoTec && <ModalTecnico onClose={() => setNuevoTec(false)} />}
    </>
  )
}

function ModalTecnico({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const [f, setF] = useState({ nombre: '', rol: 'HOJALATERO', patio: db.config.patios[0] })
  return (
    <Modal title="Agregar técnico" onClose={onClose}>
      <div className="grid-2">
        <Field label="Nombre completo">
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </Field>
        <Field label="Especialidad">
          <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
            {['HOJALATERO', 'PINTOR', 'MECANICO', 'LAVADOR'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Patio">
          <select value={f.patio} onChange={(e) => setF({ ...f, patio: e.target.value })}>
            {db.config.patios.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!f.nombre}
          onClick={() => {
            update((d) => d.tecnicos.push({ id: uid(), nombre: f.nombre, rol: f.rol as never, patio: f.patio, activo: true }))
            onClose()
          }}
        >
          <Icon name="check" size={16} /> Guardar
        </button>
      </div>
    </Modal>
  )
}
