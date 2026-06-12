import { useState } from 'react'
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { MODULES, puedeVerModulo, modulosPara } from './core/registry'
import { useSesion, setSesion, useDB, esRolGlobal } from './core/store'
import { ROL_LABEL, type Rol } from './core/types'
import { Icon, Empty } from './core/ui'
import GlobalSearch from './shell/GlobalSearch'
import Home from './modules/home/Home'

function SinAcceso({ nombre }: { nombre: string }) {
  return (
    <>
      <h1 className="page-title" style={{ marginBottom: 'var(--sp-4)' }}>{nombre}</h1>
      <Empty msg="Tu rol no tiene acceso a este módulo. Pide al Administrador que ajuste tu asignación." />
    </>
  )
}

function SessionControls({ compact }: { compact?: boolean }) {
  const sesion = useSesion()
  const db = useDB()
  const global = esRolGlobal(sesion.rol)
  return (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: compact ? 1 : undefined }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, opacity: compact ? 0.7 : 0.8, color: compact ? 'var(--gray-700)' : undefined }}>Rol</span>
        <select
          className="rol-select" value={sesion.rol} style={compact ? { flex: 1, color: 'var(--gray-900)', background: '#fff', borderColor: 'var(--gray-300)' } : undefined}
          onChange={(e) => setSesion({ rol: e.target.value as Rol })} aria-label="Rol activo (demo de permisos)"
        >
          {Object.entries(ROL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: compact ? 1 : undefined }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, opacity: compact ? 0.7 : 0.8, color: compact ? 'var(--gray-700)' : undefined }}>Patio</span>
        <select
          className="rol-select" value={sesion.patio} style={compact ? { flex: 1, color: 'var(--gray-900)', background: '#fff', borderColor: 'var(--gray-300)' } : undefined}
          onChange={(e) => setSesion({ patio: e.target.value })} aria-label="Patio asignado"
        >
          {global && <option value="">Todos los patios</option>}
          {db.config.patios.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
    </>
  )
}

function Drawer({ onClose }: { onClose: () => void }) {
  const sesion = useSesion()
  const db = useDB()
  const visibles = modulosPara(sesion.rol, db.permisos)
  const loc = useLocation()
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label="Menú de módulos">
        <div className="drawer-head">
          <span style={{ fontWeight: 800 }}>Módulos</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar menú" style={{ color: '#fff' }}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <nav className="drawer-nav">
          <NavLink to="/" end className={loc.pathname === '/' ? 'active' : ''} onClick={onClose}>
            <span className="di"><Icon name="home" size={20} /></span> Inicio
          </NavLink>
          {visibles.map((m) => (
            <NavLink key={m.id} to={m.path} className={({ isActive }) => (isActive ? 'active' : '')} onClick={onClose}>
              <span className="di"><Icon name={m.icon as never} size={20} /></span> {m.nombre}
            </NavLink>
          ))}
        </nav>
        <div className="drawer-session">
          <SessionControls compact />
        </div>
      </aside>
    </>
  )
}

export default function App() {
  const sesion = useSesion()
  const db = useDB()
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="hamburger" onClick={() => setDrawer(true)} aria-label="Abrir menú de módulos">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link to="/" className="brand" aria-label="Inicio RAI Taller 360" style={{ textDecoration: 'none' }}>
            <span className="brand-logo">RAI</span>
            <span>Taller&nbsp;360</span>
          </Link>
          <GlobalSearch />
          <div className="topbar-session">
            <SessionControls />
          </div>
        </div>
      </header>

      {drawer && <Drawer onClose={() => setDrawer(false)} />}

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
