import { useSyncExternalStore } from 'react'
import type { DB, Rol, Vale } from './types'
import { ROLES_GLOBALES } from './types'
import { seedDB } from './seed'

// ── Capa de datos (patrón repositorio) ─────────────────────────────────
// Hoy persiste en localStorage; la interfaz StorageAdapter permite migrar
// a un backend (Supabase / REST API) sin tocar los módulos de UI.

export interface StorageAdapter {
  load(): DB | null
  save(db: DB): void
}

const KEY = 'rai-taller-360-db-v1'

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
let state: DB = adapter.load() ?? seedDB()
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

/**
 * Alcance de datos de la sesión: devuelve el patio que limita la vista
 * ('' = sin límite) y un predicado para filtrar por patio.
 */
export function useScope() {
  const s = useSesion()
  const patio = esRolGlobal(s.rol) ? s.patio : s.patio || state.config.patios[0]
  const limite = esRolGlobal(s.rol) ? s.patio : patio
  return {
    rol: s.rol,
    patio: limite,
    global: esRolGlobal(s.rol),
    enScope: (p?: string) => !limite || !p || p === limite,
  }
}

/** Patio efectivo de un vale: el de su expediente, o el capturado en el vale. */
export const patioDeVale = (db: DB, v: Vale): string | undefined =>
  db.ordenes.find((o) => o.id === v.ordenId)?.patio ?? v.patio

// ── Reglas de negocio (del Formulario de procesos) ─────────────────────

/** Compras con vale: >$2,000 autoriza solo Gerente; ≤$2,000 en cascada. */
export function puedeAutorizarVale(rol: Rol, monto: number): boolean {
  if (rol === 'GERENTE') return true
  if (monto <= 2000) return rol === 'SUBGERENTE' || rol === 'JEFE_TALLER'
  return false
}

/** Salidas de almacén: autoriza Gerente, Valuador, Subgerente o Jefe de Taller. */
export function puedeAutorizarSalida(rol: Rol): boolean {
  return ['GERENTE', 'SUBGERENTE', 'JEFE_TALLER', 'VALUADOR'].includes(rol)
}

/** Particulares: refacciones >$1,000 requieren anticipo para levantar pedido. */
export function requiereAnticipo(tipoCliente: 'SEGURO' | 'PARTICULAR', montoRefacciones: number): boolean {
  return tipoCliente === 'PARTICULAR' && montoRefacciones > 1000
}
