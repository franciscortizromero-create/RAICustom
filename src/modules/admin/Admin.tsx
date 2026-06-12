import { useState } from 'react'
import { useDB, update, setSesion } from '../../core/store'
import { MODULES } from '../../core/registry'
import { CAMPOS_PROTEGIDOS } from '../../core/permisos'
import { ETAPAS } from '../../core/types'
import {
  ROL_LABEL, ROLES_GLOBALES, ACCESO_LABEL, type Rol, type Acceso, type Usuario,
  type Proveedor, type Aseguradora,
} from '../../core/types'
import { Icon, Modal, Field, PageHeader, Empty } from '../../core/ui'
import { mxn, fechaCorta, uid, hoyISO } from '../../core/format'

type Tab = 'personal' | 'modulos' | 'campos' | 'parametros' | 'productividad' | 'catalogos'

const ROLES: Rol[] = ['ADMIN', 'GERENTE', 'SUBGERENTE', 'JEFE_TALLER', 'VALUADOR', 'ASESOR', 'ALMACENISTA', 'RH', 'CONTADORA']
const ROLES_EDITABLES = ROLES.filter((r) => !ROLES_GLOBALES.includes(r))
// Módulos cuyo acceso se puede configurar (los soloGlobal no aplican a otros roles).
// Se calcula vía función (no const a nivel módulo) para evitar el TDZ del import
// circular registry → Admin → registry.
const modulosConfig = () => MODULES.filter((m) => !m.soloGlobal)

export default function Admin() {
  const [tab, setTab] = useState<Tab>('personal')
  const tabs: [Tab, string, string][] = [
    ['personal', 'Personal', 'user'],
    ['modulos', 'Roles y módulos', 'settings'],
    ['campos', 'Permisos por campo', 'shield'],
    ['parametros', 'Parámetros', 'gauge'],
    ['productividad', 'Productividad %', 'chart'],
    ['catalogos', 'Catálogos', 'box'],
  ]
  return (
    <>
      <PageHeader
        title="Administración"
        sub="Alta de personal, asignación de roles y patios, y control de acceso por módulo y por campo"
      />
      <div className="row mb-6" style={{ marginBottom: 'var(--sp-6)' }} role="tablist">
        {tabs.map(([k, label, icon]) => (
          <button
            key={k} role="tab" aria-selected={tab === k}
            className={`btn ${tab === k ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(k)}
          >
            <Icon name={icon as never} size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === 'personal' && <Personal />}
      {tab === 'modulos' && <RolesModulos />}
      {tab === 'campos' && <PermisosCampo />}
      {tab === 'parametros' && <Parametros />}
      {tab === 'productividad' && <ProductividadPct />}
      {tab === 'catalogos' && <Catalogos />}
    </>
  )
}

// ── 1. Personal (usuarios) ──────────────────────────────────────────────
function Personal() {
  const db = useDB()
  const [editar, setEditar] = useState<Usuario | 'nuevo' | null>(null)

  return (
    <>
      <div className="row-between mb-4" style={{ marginBottom: 'var(--sp-4)' }}>
        <p className="muted">
          Da de alta a quien entra a trabajar y asígnale rol y patio. Los técnicos de producción
          (hojalateros, pintores, mecánicos) se administran en <strong>Catálogos</strong>.
        </p>
        <button className="btn btn-accent" onClick={() => setEditar('nuevo')}>
          <Icon name="plus" size={18} /> Alta de personal
        </button>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Nombre</th><th>Contacto</th><th>Rol</th><th>Patio</th><th>Ingreso</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {db.usuarios.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{u.email ?? '—'}{u.telefono ? ` · ${u.telefono}` : ''}</td>
                <td><span className="badge badge-navy">{ROL_LABEL[u.rol]}</span></td>
                <td>{ROLES_GLOBALES.includes(u.rol) ? <span className="badge badge-yellow">3 patios</span> : u.patio}</td>
                <td>{fechaCorta(u.ingreso)}</td>
                <td>
                  <span className={`badge ${u.activo ? 'badge-green' : 'badge-gray'}`}>{u.activo ? 'Activo' : 'Baja'}</span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditar(u)}>
                      <Icon name="pen" size={14} /> Editar
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSesion({ rol: u.rol, patio: u.patio })}
                      title="Ver el sistema como lo vería este usuario"
                    >
                      Entrar como
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {db.usuarios.length === 0 && <Empty msg="Sin personal dado de alta." />}
      </div>
      {editar && <ModalUsuario usuario={editar === 'nuevo' ? null : editar} onClose={() => setEditar(null)} />}
    </>
  )
}

function ModalUsuario({ usuario, onClose }: { usuario: Usuario | null; onClose: () => void }) {
  const db = useDB()
  const [f, setF] = useState({
    nombre: usuario?.nombre ?? '', email: usuario?.email ?? '', telefono: usuario?.telefono ?? '',
    rol: usuario?.rol ?? ('ASESOR' as Rol), patio: usuario?.patio ?? db.config.patios[0],
    activo: usuario?.activo ?? true,
  })
  const global = ROLES_GLOBALES.includes(f.rol)
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  const guardar = () => {
    const patio = global ? '' : f.patio
    update((d) => {
      if (usuario) {
        const u = d.usuarios.find((x) => x.id === usuario.id)!
        Object.assign(u, { nombre: f.nombre, email: f.email || undefined, telefono: f.telefono || undefined, rol: f.rol, patio, activo: f.activo })
      } else {
        d.usuarios.push({
          id: uid(), nombre: f.nombre, email: f.email || undefined, telefono: f.telefono || undefined,
          rol: f.rol, patio, activo: f.activo, ingreso: hoyISO(),
        })
      }
    })
    onClose()
  }

  return (
    <Modal title={usuario ? `Editar · ${usuario.nombre}` : 'Alta de personal'} onClose={onClose}>
      <div className="grid-2">
        <Field label="Nombre completo">
          <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
        </Field>
        <Field label="Correo">
          <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Teléfono">
          <input value={f.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="449 …" />
        </Field>
        <Field label="Rol">
          <select value={f.rol} onChange={(e) => set('rol', e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label={global ? 'Patio (rol global: ve los 3 patios)' : 'Patio asignado'}>
          <select value={global ? '' : f.patio} onChange={(e) => set('patio', e.target.value)} disabled={global}>
            {global && <option value="">Todos los patios</option>}
            {db.config.patios.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={f.activo ? '1' : '0'} onChange={(e) => set('activo', e.target.value === '1')}>
            <option value="1">Activo</option>
            <option value="0">Baja</option>
          </select>
        </Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nombre} onClick={guardar}>
          <Icon name="check" size={16} /> {usuario ? 'Guardar cambios' : 'Dar de alta'}
        </button>
      </div>
    </Modal>
  )
}

// ── 2. Roles y módulos ──────────────────────────────────────────────────
function RolesModulos() {
  const db = useDB()
  const MODULOS_CONFIG = modulosConfig()

  // Acceso efectivo actual de un rol a un módulo
  const tiene = (rol: Rol, modId: string): boolean => {
    const override = db.permisos.modulos[rol]
    if (override) return override.includes(modId)
    const m = MODULOS_CONFIG.find((x) => x.id === modId)!
    return !m.roles || m.roles.includes(rol)
  }

  const toggle = (rol: Rol, modId: string) => {
    update((d) => {
      // materializar la lista actual y alternar
      const actual = MODULOS_CONFIG.filter((m) => tiene(rol, m.id)).map((m) => m.id)
      const next = actual.includes(modId) ? actual.filter((x) => x !== modId) : [...actual, modId]
      d.permisos.modulos[rol] = next
    })
  }

  const restablecer = (rol: Rol) => update((d) => { delete d.permisos.modulos[rol] })

  return (
    <>
      <div className="card card-pad mb-6" style={{ marginBottom: 'var(--sp-6)', background: 'var(--rai-blue-50)', border: 'none' }}>
        <p style={{ fontSize: 'var(--fs-sm)' }}>
          Marca a qué módulos entra cada rol. <strong>Administrador</strong> y <strong>Gerente</strong> ven
          todo y no se limitan. El módulo de Administración es exclusivo de ellos.
        </p>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Rol</th>
              {MODULOS_CONFIG.map((m) => <th key={m.id} style={{ textAlign: 'center' }}>{m.corto}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ROLES_EDITABLES.map((rol) => (
              <tr key={rol}>
                <td style={{ fontWeight: 700 }}>{ROL_LABEL[rol]}</td>
                {MODULOS_CONFIG.map((m) => (
                  <td key={m.id} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={tiene(rol, m.id)}
                      onChange={() => toggle(rol, m.id)}
                      aria-label={`${ROL_LABEL[rol]} accede a ${m.nombre}`}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </td>
                ))}
                <td>
                  {db.permisos.modulos[rol] && (
                    <button className="btn btn-ghost btn-sm" onClick={() => restablecer(rol)}>Predeterminado</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── 3. Permisos por campo ───────────────────────────────────────────────
const ACCESOS: Acceso[] = ['EDITAR', 'VER', 'OCULTO']
const ACCESO_TONE: Record<Acceso, string> = { EDITAR: 'badge-green', VER: 'badge-yellow', OCULTO: 'badge-red' }

function PermisosCampo() {
  const db = useDB()
  const MODULOS_CONFIG = modulosConfig()
  const [rol, setRol] = useState<Rol>('VALUADOR')

  const accesoActual = (campoId: string, porDefecto: Acceso): Acceso =>
    db.permisos.campos[rol]?.[campoId] ?? porDefecto

  const setAcceso = (campoId: string, valor: Acceso) =>
    update((d) => {
      d.permisos.campos[rol] = { ...(d.permisos.campos[rol] ?? {}), [campoId]: valor }
    })

  // Agrupar campos por módulo
  const porModulo = MODULOS_CONFIG
    .map((m) => ({ modulo: m, campos: CAMPOS_PROTEGIDOS.filter((c) => c.modulo === m.id) }))
    .filter((g) => g.campos.length > 0)

  return (
    <>
      <div className="card card-pad mb-6" style={{ marginBottom: 'var(--sp-6)', background: 'var(--rai-blue-50)', border: 'none' }}>
        <p style={{ fontSize: 'var(--fs-sm)' }}>
          Define, por rol, qué puede <strong>Editar</strong>, ver <strong>Solo ver</strong> u <strong>Ocultar</strong> en
          cada campo sensible. Ejemplo configurado: el <strong>Valuador</strong> tiene oculto el <em>margen de utilidad</em> de
          la orden. Administrador y Gerente siempre ven y editan todo.
        </p>
      </div>

      <div className="toolbar">
        <Field label="Rol a configurar">
          <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES_EDITABLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </select>
        </Field>
      </div>

      {porModulo.map(({ modulo, campos }) => (
        <div key={modulo.id} className="card card-pad mb-4" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>
            <Icon name={modulo.icon as never} size={18} /> {modulo.nombre}
          </h3>
          {campos.map((c) => {
            const valor = accesoActual(c.id, c.porDefecto)
            return (
              <div key={c.id} className="row-between" style={{ padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--gray-100)', gap: 'var(--sp-4)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{c.nombre}</div>
                  {c.descripcion && <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{c.descripcion}</div>}
                </div>
                <div className="row" style={{ gap: 4 }} role="group" aria-label={`Acceso a ${c.nombre}`}>
                  {ACCESOS.map((a) => (
                    <button
                      key={a}
                      className={`btn btn-sm ${valor === a ? '' : 'btn-ghost'}`}
                      style={valor === a
                        ? { background: a === 'EDITAR' ? 'var(--ok-600)' : a === 'VER' ? 'var(--warn-700)' : 'var(--danger-600)', color: '#fff' }
                        : undefined}
                      onClick={() => setAcceso(c.id, a)}
                    >
                      {ACCESO_LABEL[a]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
      <p className="muted">
        Vista previa del rol seleccionado:{' '}
        {porModulo.flatMap((g) => g.campos).map((c) => (
          <span key={c.id} className={`badge ${ACCESO_TONE[accesoActual(c.id, c.porDefecto)]}`} style={{ marginRight: 6 }}>
            {c.nombre}: {ACCESO_LABEL[accesoActual(c.id, c.porDefecto)]}
          </span>
        ))}
      </p>
    </>
  )
}

// ── 4. Parámetros de negocio ────────────────────────────────────────────
function Parametros() {
  const db = useDB()
  const p = db.parametros
  const [nuevoItem, setNuevoItem] = useState('')

  const setNum = (k: 'umbralAutorizacionVale' | 'umbralAnticipoParticular', v: number) =>
    update((d) => { d.parametros[k] = v })

  return (
    <>
      <div className="grid-2 mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card card-pad">
          <h3 className="section-title">Autorización de vales</h3>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)' }}>
            Compras por encima de este monto solo las autoriza el Gerente; por debajo, Subgerente o Jefe de Taller.
          </p>
          <Field label="Umbral de autorización (MXN)">
            <input type="number" min={0} step={100} value={p.umbralAutorizacionVale}
              onChange={(e) => setNum('umbralAutorizacionVale', +e.target.value)} />
          </Field>
          <p className="muted mt-2" style={{ fontSize: 'var(--fs-xs)' }}>Actual: {mxn(p.umbralAutorizacionVale)}</p>
        </div>
        <div className="card card-pad">
          <h3 className="section-title">Anticipo de particulares</h3>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)' }}>
            En clientes particulares, refacciones por encima de este monto requieren anticipo para levantar el pedido.
          </p>
          <Field label="Umbral de anticipo (MXN)">
            <input type="number" min={0} step={100} value={p.umbralAnticipoParticular}
              onChange={(e) => setNum('umbralAnticipoParticular', +e.target.value)} />
          </Field>
          <p className="muted mt-2" style={{ fontSize: 'var(--fs-xs)' }}>Actual: {mxn(p.umbralAnticipoParticular)}</p>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Checklist de inventario de ingreso</h3>
        <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)' }}>
          Ítems que se revisan al recibir el vehículo (módulo Órdenes → nueva orden).
        </p>
        <div className="grid-3">
          {p.checklistInventario.map((item, i) => (
            <div key={i} className="row-between" style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: '6px 12px' }}>
              <span style={{ fontSize: 'var(--fs-sm)' }}>{item}</span>
              <button className="btn btn-ghost btn-sm" aria-label={`Quitar ${item}`}
                onClick={() => update((d) => { d.parametros.checklistInventario.splice(i, 1) })}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="row mt-4" style={{ marginTop: 'var(--sp-4)' }}>
          <input
            placeholder="Nuevo ítem del checklist…" value={nuevoItem}
            onChange={(e) => setNuevoItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nuevoItem.trim()) { update((d) => d.parametros.checklistInventario.push(nuevoItem.trim())); setNuevoItem('') } }}
            style={{ minHeight: 44, padding: '0 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', minWidth: 260 }}
          />
          <button className="btn btn-accent" disabled={!nuevoItem.trim()}
            onClick={() => { update((d) => d.parametros.checklistInventario.push(nuevoItem.trim())); setNuevoItem('') }}>
            <Icon name="plus" size={16} /> Agregar ítem
          </button>
        </div>
      </div>

      <div className="card card-pad mt-6" style={{ marginTop: 'var(--sp-6)' }}>
        <h3 className="section-title">Folios y patios</h3>
        <div className="grid-3 mt-4">
          <Field label="Siguiente folio de orden">
            <input type="number" value={db.config.siguienteFolioOrden}
              onChange={(e) => update((d) => { d.config.siguienteFolioOrden = +e.target.value })} />
          </Field>
          <Field label="Siguiente folio de vale">
            <input type="number" value={db.config.siguienteFolioVale}
              onChange={(e) => update((d) => { d.config.siguienteFolioVale = +e.target.value })} />
          </Field>
          <Field label="Siguiente folio de contrarecibo">
            <input type="number" value={db.config.siguienteFolioCR}
              onChange={(e) => update((d) => { d.config.siguienteFolioCR = +e.target.value })} />
          </Field>
        </div>
      </div>
    </>
  )
}

// ── 5. Porcentajes de productividad por etapa ───────────────────────────
function ProductividadPct() {
  const db = useDB()
  const etapasConPct = ETAPAS.filter((e) => e.pct !== undefined)
  const valor = (id: string, def?: number) => db.parametros.pctEtapa[id as never] ?? def ?? 0

  return (
    <>
      <div className="card card-pad mb-6" style={{ marginBottom: 'var(--sp-6)', background: 'var(--rai-blue-50)', border: 'none' }}>
        <p style={{ fontSize: 'var(--fs-sm)' }}>
          Porcentaje que se paga al técnico sobre la <strong>venta del área</strong> al completar cada etapa.
          Afecta el corte semanal de Productividad. Deja en blanco para usar el valor por defecto.
        </p>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Etapa</th><th>Área</th><th>% por defecto</th><th>% vigente</th></tr>
          </thead>
          <tbody>
            {etapasConPct.map((e) => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600 }}>{e.nombre}</td>
                <td><span className="badge badge-gray">{e.area}</span></td>
                <td className="muted">{e.pct}%</td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      type="number" min={0} max={100} step={1}
                      value={db.parametros.pctEtapa[e.id] ?? ''}
                      placeholder={String(e.pct)}
                      onChange={(ev) => update((d) => {
                        const v = ev.target.value
                        if (v === '') delete d.parametros.pctEtapa[e.id]
                        else d.parametros.pctEtapa[e.id] = +v
                      })}
                      style={{ width: 90, minHeight: 40, padding: '0 10px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)' }}
                    />
                    <span style={{ fontWeight: 700 }}>{valor(e.id, e.pct)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── 6. Catálogos editables (aseguradoras, proveedores, patios) ──────────
function Catalogos() {
  const db = useDB()
  const [aseg, setAseg] = useState<Aseguradora | 'nuevo' | null>(null)
  const [prov, setProv] = useState<Proveedor | 'nuevo' | null>(null)
  const [nuevoPatio, setNuevoPatio] = useState('')

  return (
    <>
      <div className="grid-2 mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card card-pad">
          <h3 className="section-title">Patios de trabajo</h3>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)' }}>
            Cada empleado no-global se asigna a uno de estos patios.
          </p>
          {db.config.patios.map((p) => (
            <div key={p} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span style={{ fontWeight: 600 }}>{p}</span>
              <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                {db.usuarios.filter((u) => u.patio === p).length} usuarios · {db.ordenes.filter((o) => o.patio === p).length} órdenes
              </span>
            </div>
          ))}
          <div className="row mt-4" style={{ marginTop: 'var(--sp-4)' }}>
            <input placeholder="Nuevo patio…" value={nuevoPatio} onChange={(e) => setNuevoPatio(e.target.value)}
              style={{ minHeight: 44, padding: '0 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', flex: 1 }} />
            <button className="btn btn-accent" disabled={!nuevoPatio.trim() || db.config.patios.includes(nuevoPatio.trim())}
              onClick={() => { update((d) => d.config.patios.push(nuevoPatio.trim())); setNuevoPatio('') }}>
              <Icon name="plus" size={16} /> Agregar
            </button>
          </div>
        </div>

        <div className="card card-pad">
          <div className="row-between mb-4" style={{ marginBottom: 'var(--sp-4)' }}>
            <h3 className="section-title">Aseguradoras</h3>
            <button className="btn btn-outline btn-sm" onClick={() => setAseg('nuevo')}><Icon name="plus" size={14} /> Agregar</button>
          </div>
          {db.aseguradoras.map((a) => (
            <div key={a.id} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span><strong>{a.clave}</strong> · {a.nombre}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setAseg(a)}><Icon name="pen" size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="row-between mb-4" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3 className="section-title">Proveedores</h3>
          <button className="btn btn-accent btn-sm" onClick={() => setProv('nuevo')}><Icon name="plus" size={14} /> Agregar proveedor</button>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Proveedor</th><th>Giro</th><th>Teléfono</th><th>Días crédito</th><th></th></tr></thead>
            <tbody>
              {db.proveedores.map((pr) => (
                <tr key={pr.id}>
                  <td style={{ fontWeight: 600 }}>{pr.nombre}</td>
                  <td><span className="badge badge-gray">{pr.giro}</span></td>
                  <td>{pr.telefono ?? '—'}</td>
                  <td>{pr.diasCredito} días</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setProv(pr)}><Icon name="pen" size={13} /> Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {aseg && <ModalAseguradora aseg={aseg === 'nuevo' ? null : aseg} onClose={() => setAseg(null)} />}
      {prov && <ModalProveedor prov={prov === 'nuevo' ? null : prov} onClose={() => setProv(null)} />}
    </>
  )
}

function ModalAseguradora({ aseg, onClose }: { aseg: Aseguradora | null; onClose: () => void }) {
  const [f, setF] = useState({ nombre: aseg?.nombre ?? '', clave: aseg?.clave ?? '' })
  return (
    <Modal title={aseg ? `Editar · ${aseg.clave}` : 'Nueva aseguradora'} onClose={onClose}>
      <div className="grid-2">
        <Field label="Nombre"><input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Clave (corta)"><input value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value.toUpperCase() })} placeholder="QLTS" /></Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nombre || !f.clave} onClick={() => {
          update((d) => {
            if (aseg) Object.assign(d.aseguradoras.find((x) => x.id === aseg.id)!, f)
            else d.aseguradoras.push({ id: uid(), nombre: f.nombre, clave: f.clave })
          })
          onClose()
        }}><Icon name="check" size={16} /> Guardar</button>
      </div>
    </Modal>
  )
}

function ModalProveedor({ prov, onClose }: { prov: Proveedor | null; onClose: () => void }) {
  const [f, setF] = useState({
    nombre: prov?.nombre ?? '', giro: prov?.giro ?? ('MATERIALES' as Proveedor['giro']),
    telefono: prov?.telefono ?? '', diasCredito: prov?.diasCredito ?? 30,
  })
  return (
    <Modal title={prov ? `Editar · ${prov.nombre}` : 'Nuevo proveedor'} onClose={onClose}>
      <div className="grid-2">
        <Field label="Nombre"><input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Giro">
          <select value={f.giro} onChange={(e) => setF({ ...f, giro: e.target.value as Proveedor['giro'] })}>
            {['PINTURA', 'REFACCIONES', 'TOT', 'MATERIALES'].map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Teléfono"><input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></Field>
        <Field label="Días de crédito"><input type="number" min={0} value={f.diasCredito} onChange={(e) => setF({ ...f, diasCredito: +e.target.value })} /></Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nombre} onClick={() => {
          update((d) => {
            if (prov) Object.assign(d.proveedores.find((x) => x.id === prov.id)!, { ...f, telefono: f.telefono || undefined })
            else d.proveedores.push({ id: uid(), nombre: f.nombre, giro: f.giro, telefono: f.telefono || undefined, diasCredito: f.diasCredito })
          })
          onClose()
        }}><Icon name="check" size={16} /> Guardar</button>
      </div>
    </Modal>
  )
}
