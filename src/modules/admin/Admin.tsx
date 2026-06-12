import { useState } from 'react'
import { useDB, update, setSesion } from '../../core/store'
import { MODULES } from '../../core/registry'
import { CAMPOS_PROTEGIDOS } from '../../core/permisos'
import {
  ROL_LABEL, ROLES_GLOBALES, ACCESO_LABEL, type Rol, type Acceso, type Usuario,
} from '../../core/types'
import { Icon, Modal, Field, PageHeader, Empty } from '../../core/ui'
import { fechaCorta, uid, hoyISO } from '../../core/format'

type Tab = 'personal' | 'modulos' | 'campos'

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
