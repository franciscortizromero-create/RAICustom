import { useSyncExternalStore } from 'react'
import type { DB, Rol, Vale } from './types'
import { ROLES_GLOBALES, ROL_LABEL as ROL_LABEL_LOCAL } from './types'
import { seedDB } from './seed'

// ── Capa de datos (patrón repositorio) ─────────────────────────────────
// Hoy persiste en localStorage; la interfaz StorageAdapter permite migrar
// a un backend (Supabase / REST API) sin tocar los módulos de UI.

export interface StorageAdapter {
  load(): DB | null
  save(db: DB): void
}

const KEY = 'rai-taller-360-db-v4'

const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as DB) : null
    } catch {
      return null
    }
  },
  save(db) {
    localStorage.setItem(KEY, JSON.stringify(db))
  },
}

let adapter: StorageAdapter = localAdapter

// Migración defensiva: si se carga un estado de una versión previa al que le
// falten claves nuevas (p.ej. `auditoria`), se completan desde la semilla.
function migrar(db: DB): DB {
  const base = seedDB()
  for (const k of Object.keys(base) as (keyof DB)[]) {
    if (db[k] === undefined) (db as unknown as Record<string, unknown>)[k] = base[k]
  }
  return db
}

let state: DB = migrar(adapter.load() ?? seedDB())
adapter.save(state)

const listeners = new Set<() => void>()

export function getDB(): DB {
  return state
}

/** Mutación inmutable: produce un nuevo estado, persiste y notifica. */
export function update(fn: (draft: DB) => void) {
  const next: DB = JSON.parse(JSON.stringify(state))
  fn(next)
  state = next
  adapter.save(state)
  listeners.forEach((l) => l())
}

export function resetDemo() {
  state = seedDB()
  adapter.save(state)
  listeners.forEach((l) => l())
}

export function useDB(): DB {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

// ── Sesión (rol + patio asignado) ───────────────────────────────────────
// Regla del cliente: solo ADMIN y GERENTE ven los 3 patios; los demás
// empleados se asignan a un patio y solo ven la información de ese patio.

export interface Sesion {
  rol: Rol
  /** Rol personalizado activo (sus permisos mandan sobre los del rol base). */
  rolCustomId?: string
  /** Patio asignado. Cadena vacía = todos los patios (solo roles globales). */
  patio: string
}

export const esRolGlobal = (rol: Rol) => ROLES_GLOBALES.includes(rol)

function cargarSesion(): Sesion {
  try {
    const raw = localStorage.getItem('rai-sesion')
    if (raw) return JSON.parse(raw) as Sesion
  } catch { /* sesión nueva */ }
  return { rol: 'GERENTE', patio: '' }
}

let sesion: Sesion = cargarSesion()
const rolListeners = new Set<() => void>()

export function setSesion(cambio: Partial<Sesion>) {
  let next = { ...sesion, ...cambio }
  // Si se cambia el rol base directamente, se suelta el rol personalizado
  if (cambio.rol && cambio.rolCustomId === undefined) next = { ...next, rolCustomId: undefined }
  // Un rol no global siempre debe tener un patio asignado
  if (!esRolGlobal(next.rol) && !next.patio) next = { ...next, patio: state.config.patios[0] }
  sesion = next
  localStorage.setItem('rai-sesion', JSON.stringify(sesion))
  rolListeners.forEach((l) => l())
}

export function useSesion(): Sesion {
  return useSyncExternalStore(
    (cb) => {
      rolListeners.add(cb)
      return () => rolListeners.delete(cb)
    },
    () => sesion,
  )
}

export function useRol(): Rol {
  return useSesion().rol
}

/** Resuelve el rol personalizado activo en la sesión, si existe. */
export function rolCustomActivo(db: DB, s: Sesion) {
  return s.rolCustomId ? db.rolesCustom?.find((r) => r.id === s.rolCustomId) ?? null : null
}

/**
 * Alcance de datos de la sesión: devuelve el patio que limita la vista
 * ('' = sin límite), un predicado para filtrar por patio, el rol custom
 * activo y la etiqueta visible del puesto.
 */
export function useScope() {
  const s = useSesion()
  const db = useDB()
  const custom = rolCustomActivo(db, s)
  const patio = esRolGlobal(s.rol) ? s.patio : s.patio || state.config.patios[0]
  const limite = esRolGlobal(s.rol) ? s.patio : patio
  return {
    rol: s.rol,
    custom,
    label: custom?.nombre ?? ROL_LABEL_LOCAL[s.rol],
    patio: limite,
    global: esRolGlobal(s.rol),
    enScope: (p?: string) => !limite || !p || p === limite,
  }
}

/** Patio efectivo de un vale: el de su expediente, o el capturado en el vale. */
export const patioDeVale = (db: DB, v: Vale): string | undefined =>
  db.ordenes.find((o) => o.id === v.ordenId)?.patio ?? v.patio

/**
 * Registra un evento en la bitácora de auditoría. Se llama dentro de un
 * `update(d => { ...; auditar(d, ...) })`, tomando el rol/patio de la sesión.
 */
export function auditar(d: DB, modulo: string, accion: string, detalle: string) {
  if (!d.auditoria) d.auditoria = []
  d.auditoria.unshift({
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    fecha: new Date().toISOString(),
    usuarioRol: sesion.rol,
    patio: sesion.patio,
    modulo,
    accion,
    detalle,
  })
  if (d.auditoria.length > 800) d.auditoria.length = 800
}

// ── Tema (claro / oscuro) ───────────────────────────────────────────────
type Tema = 'light' | 'dark'
let tema: Tema = (localStorage.getItem('rai-tema') as Tema) || 'light'
document.documentElement.dataset.theme = tema
const temaListeners = new Set<() => void>()

export function setTema(t: Tema) {
  tema = t
  localStorage.setItem('rai-tema', t)
  document.documentElement.dataset.theme = t
  temaListeners.forEach((l) => l())
}

export function useTema(): Tema {
  return useSyncExternalStore(
    (cb) => {
      temaListeners.add(cb)
      return () => temaListeners.delete(cb)
    },
    () => tema,
  )
}

// ── Reglas de negocio (del Formulario de procesos) ─────────────────────

/** Compras con vale: por encima del umbral autoriza solo Gerente; debajo, en cascada. */
export function puedeAutorizarVale(rol: Rol, monto: number, umbral = 2000): boolean {
  if (rol === 'ADMIN' || rol === 'GERENTE') return true
  if (monto <= umbral) return rol === 'SUBGERENTE' || rol === 'JEFE_TALLER'
  return false
}

/** Salidas de almacén: autoriza Gerente, Valuador, Subgerente o Jefe de Taller. */
export function puedeAutorizarSalida(rol: Rol): boolean {
  return ['GERENTE', 'SUBGERENTE', 'JEFE_TALLER', 'VALUADOR'].includes(rol)
}

/** Particulares: refacciones por encima del umbral requieren anticipo para levantar pedido. */
export function requiereAnticipo(tipoCliente: 'SEGURO' | 'PARTICULAR', montoRefacciones: number, umbral = 1000): boolean {
  return tipoCliente === 'PARTICULAR' && montoRefacciones > umbral
}
