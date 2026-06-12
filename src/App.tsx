import { Routes, Route, NavLink, Link } from 'react-router-dom'
import { MODULES, puedeVerModulo, modulosPara } from './core/registry'
import { useSesion, setSesion, useDB, esRolGlobal } from './core/store'
import { ROL_LABEL, type Rol } from './core/types'
import { Empty } from './core/ui'
import Home from './modules/home/Home'

function SinAcceso({ nombre }: { nombre: string }) {
  return (
    <>
      <h1 className="page-title" style={{ marginBottom: 'var(--sp-4)' }}>{nombre}</h1>
      <Empty msg="Tu rol no tiene acceso a este módulo. Pide al Administrador o Gerente que ajuste tu asignación." />
    </>
  )
}

export default function App() {
  const sesion = useSesion()
  const db = useDB()
  const global = esRolGlobal(sesion.rol)
  const visibles = modulosPara(sesion.rol, db.permisos)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Inicio RAI Taller 360" style={{ textDecoration: 'none' }}>
            <span className="brand-logo">RAI</span>
            <span>Taller&nbsp;360</span>
          </Link>
          <nav aria-label="Módulos">
            {visibles.map((m) => (
              <NavLink key={m.id} to={m.path} className={({ isActive }) => (isActive ? 'active' : '')}>
                {m.corto}
              </NavLink>
            ))}
          </nav>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, opacity: 0.8 }}>Rol</span>
            <select
              className="rol-select"
              value={sesion.rol}
              onChange={(e) => setSesion({ rol: e.target.value as Rol })}
              aria-label="Rol activo (demo de permisos)"
            >
              {Object.entries(ROL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, opacity: 0.8 }}>Patio</span>
            <select
              className="rol-select"
              value={sesion.patio}
              onChange={(e) => setSesion({ patio: e.target.value })}
              aria-label="Patio asignado"
            >
              {global && <option value="">Todos los patios</option>}
              {db.config.patios.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          {MODULES.map((m) => (
            <Route
              key={m.id}
              path={`${m.path}/*`}
              element={puedeVerModulo(sesion.rol, m, db.permisos) ? <m.component /> : <SinAcceso nombre={m.nombre} />}
            />
          ))}
        </Routes>
      </main>
    </div>
  )
}
