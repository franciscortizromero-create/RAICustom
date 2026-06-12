import type { DB, Rol, Acceso } from './types'
import { ROLES_GLOBALES } from './types'
import { useDB, useRol } from './store'

// ── Permisos por campo ──────────────────────────────────────────────────
// Catálogo de campos/secciones protegibles dentro de cada módulo. El módulo
// de Administración deja editar, por rol, el acceso a cada uno de estos
// campos (Editar / Solo ver / Oculto). ADMIN y GERENTE siempre ven todo.

export interface CampoProtegido {
  id: string
  modulo: string // id del módulo en registry
  nombre: string
  descripcion?: string
  porDefecto: Acceso // acceso cuando no hay override para el rol
}

export const CAMPOS_PROTEGIDOS: CampoProtegido[] = [
  {
    id: 'ordenes.margen', modulo: 'ordenes', nombre: 'Margen de utilidad de la orden',
    descripcion: 'Porcentaje de utilidad calculado del presupuesto.', porDefecto: 'VER',
  },
  {
    id: 'ordenes.costos', modulo: 'ordenes', nombre: 'Costos del presupuesto',
    descripcion: 'Columna de costo (precio de compra del taller) y totales de costo.', porDefecto: 'EDITAR',
  },
  {
    id: 'ordenes.presupuesto', modulo: 'ordenes', nombre: 'Editar / autorizar presupuesto',
    descripcion: 'Agregar conceptos y registrar la autorización del cliente o la CIA.', porDefecto: 'EDITAR',
  },
  {
    id: 'ordenes.cliente', modulo: 'ordenes', nombre: 'Datos de contacto del cliente',
    descripcion: 'Teléfono y correo del propietario.', porDefecto: 'VER',
  },
  {
    id: 'reportes.financiero', modulo: 'reportes', nombre: 'Indicadores financieros',
    descripcion: 'Venta por área y margen presupuestado en Reportes.', porDefecto: 'VER',
  },
]

export const camposDeModulo = (moduloId: string) => CAMPOS_PROTEGIDOS.filter((c) => c.modulo === moduloId)

/** Acceso efectivo de un rol a un campo protegido. */
export function accesoCampo(db: DB, rol: Rol, campoId: string): Acceso {
  if (ROLES_GLOBALES.includes(rol)) return 'EDITAR'
  const override = db.permisos?.campos?.[rol]?.[campoId]
  if (override) return override
  return CAMPOS_PROTEGIDOS.find((c) => c.id === campoId)?.porDefecto ?? 'EDITAR'
}

/** Hook: devuelve una función acc(campoId) con el acceso del rol activo. */
export function useAcceso() {
  const db = useDB()
  const rol = useRol()
  return (campoId: string): Acceso => accesoCampo(db, rol, campoId)
}
