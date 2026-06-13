import type { ComponentType } from 'react'
import type { DB, Rol, PermisosConfig, RolCustom } from './types'
import { ROLES_GLOBALES } from './types'
import { patioDeVale } from './store'
import { diasDesde } from './format'
import Admin from '../modules/admin/Admin'
import Ordenes from '../modules/ordenes/Ordenes'
import Taller from '../modules/taller/Taller'
import Citas from '../modules/citas/Citas'
import Vales from '../modules/vales/Vales'
import Almacen from '../modules/almacen/Almacen'
import CuentasPorPagar from '../modules/cxp/CuentasPorPagar'
import Productividad from '../modules/productividad/Productividad'
import Facturacion from '../modules/facturacion/Facturacion'
import Garantias from '../modules/garantias/Garantias'
import Reportes from '../modules/reportes/Reportes'
import Catalogos from '../modules/catalogos/Catalogos'

// ── Registro de módulos ─────────────────────────────────────────────────
// Cada módulo se registra aquí y el shell (rutas, navegación y homepage
// springboard) se genera solo. Para añadir un módulo nuevo basta con
// agregar su carpeta en src/modules y una entrada en esta lista.
// `roles` define qué puestos entran al módulo; el patio de la sesión
// limita además QUÉ datos ven (ADMIN y GERENTE ven los 3 patios).

const en = (patio: string, p?: string) => !patio || !p || p === patio

export interface ModuleDef {
  id: string
  path: string
  nombre: string
  corto: string // etiqueta corta para la barra de navegación
  descripcion: string
  icon: string
  component: ComponentType
  /** Roles con acceso al módulo. ADMIN y GERENTE siempre entran. */
  roles?: Rol[]
  /** Solo visible para roles globales (ADMIN/GERENTE); no asignable a otros. */
  soloGlobal?: boolean
  /** Solo visible y editable por ADMIN (gobernanza del sistema). */
  soloAdmin?: boolean
  kpi?: (db: DB, patio: string) => { text: string; tone: 'blue' | 'green' | 'yellow' | 'red' | 'gray' } | null
}

/**
 * ¿El rol puede entrar al módulo? ADMIN y GERENTE ven todo.
 * Con rol personalizado manda su lista de módulos; si no, el override del
 * rol en `permisos` y por último la lista `roles` por defecto del módulo.
 */
export function puedeVerModulo(rol: Rol, m: ModuleDef, permisos?: PermisosConfig, custom?: RolCustom | null): boolean {
  if (m.soloAdmin) return !custom && rol === 'ADMIN'
  if (custom) {
    if (m.soloGlobal && !ROLES_GLOBALES.includes(custom.base)) return false
    return custom.modulos.includes(m.id)
  }
  if (ROLES_GLOBALES.includes(rol)) return true
  if (m.soloGlobal) return false
  const override = permisos?.modulos?.[rol]
  if (override) return override.includes(m.id)
  return !m.roles || m.roles.includes(rol)
}

export const modulosPara = (rol: Rol, permisos?: PermisosConfig, custom?: RolCustom | null) =>
  MODULES.filter((m) => puedeVerModulo(rol, m, permisos, custom))

export const MODULES: ModuleDef[] = [
  {
    id: 'ordenes', path: '/ordenes', nombre: 'Órdenes de Trabajo', corto: 'Órdenes',
    descripcion: 'Recepción, inventario de ingreso, expediente digital y seguimiento de cada unidad.',
    icon: 'clipboard', component: Ordenes,
    roles: ['SUBGERENTE', 'JEFE_TALLER', 'VALUADOR', 'ASESOR', 'CONTADORA'],
    kpi: (db, patio) => {
      const abiertas = db.ordenes.filter(
        (o) => en(patio, o.patio) && !['ENTREGADO', 'FACTURADO', 'PAGADO', 'CANCELADO', 'PAGO_DANOS'].includes(o.status),
      ).length
      return { text: `${abiertas} abiertas`, tone: 'blue' }
    },
  },
  {
    id: 'taller', path: '/taller', nombre: 'Piso de Taller', corto: 'Taller',
    descripcion: 'Tablero de etapas en tiempo real: hojalatería, pintura, mecánica, TOT e inspecciones.',
    icon: 'wrench', component: Taller,
    roles: ['SUBGERENTE', 'JEFE_TALLER', 'VALUADOR', 'ASESOR'],
    kpi: (db, patio) => {
      const n = db.ordenes.filter((o) => en(patio, o.patio) && ['EN_PROCESO', 'GARANTIA'].includes(o.status)).length
      return { text: `${n} en piso`, tone: 'blue' }
    },
  },
  {
    id: 'citas', path: '/citas', nombre: 'Agenda de Citas', corto: 'Citas',
    descripcion: 'Citas de reingreso, valuación y entrega, priorizadas por antigüedad y carga del taller.',
    icon: 'calendar', component: Citas,
    roles: ['SUBGERENTE', 'VALUADOR', 'ASESOR'],
    kpi: (db, patio) => {
      const n = db.citas.filter(
        (c) => c.estado === 'PROGRAMADA' && en(patio, db.ordenes.find((o) => o.id === c.ordenId)?.patio),
      ).length
      return n ? { text: `${n} programadas`, tone: 'yellow' } : null
    },
  },
  {
    id: 'vales', path: '/vales', nombre: 'Vales y Compras', corto: 'Vales',
    descripcion: 'Vales de pintura, refacciones, TOT y materiales con folios y autorización en cascada.',
    icon: 'ticket', component: Vales,
    roles: ['SUBGERENTE', 'JEFE_TALLER', 'VALUADOR', 'ALMACENISTA'],
    kpi: (db, patio) => {
      const n = db.vales.filter((v) => v.status === 'PENDIENTE' && en(patio, patioDeVale(db, v))).length
      return n ? { text: `${n} por autorizar`, tone: 'red' } : { text: 'Al día', tone: 'green' }
    },
  },
  {
    id: 'almacen', path: '/almacen', nombre: 'Almacén e Inventario', corto: 'Almacén',
    descripcion: 'Existencias, mínimos y máximos, puntos de reorden, salidas por orden y mermas.',
    icon: 'box', component: Almacen,
    roles: ['SUBGERENTE', 'JEFE_TALLER', 'ALMACENISTA'],
    kpi: (db, patio) => {
      const n = db.materiales.filter((m) => en(patio, m.almacen) && m.existencia < m.minimo).length
      return n ? { text: `${n} bajo mínimo`, tone: 'red' } : { text: 'Stock OK', tone: 'green' }
    },
  },
  {
    id: 'cxp', path: '/cuentas-por-pagar', nombre: 'Cuentas por Pagar', corto: 'CxP',
    descripcion: 'Contrarecibos, cotejo automático factura-vale y programación de pagos a proveedores.',
    icon: 'bank', component: CuentasPorPagar,
    roles: ['CONTADORA'],
    kpi: (db) => {
      const n = db.contraRecibos.filter((c) => c.estado !== 'PAGADO').length
      return n ? { text: `${n} por pagar`, tone: 'yellow' } : null
    },
  },
  {
    id: 'productividad', path: '/productividad', nombre: 'Productividad', corto: 'Productividad',
    descripcion: 'Corte semanal automático por etapas, resúmenes por técnico, préstamos y recibos.',
    icon: 'gauge', component: Productividad,
    roles: ['SUBGERENTE', 'RH'],
  },
  {
    id: 'facturacion', path: '/facturacion', nombre: 'Facturación y Cobranza', corto: 'Facturación',
    descripcion: 'Facturas por orden, carga al portal de la aseguradora y registro de pagos.',
    icon: 'invoice', component: Facturacion,
    roles: ['CONTADORA'],
    kpi: (db, patio) => {
      const n = db.facturas.filter(
        (f) => f.estado !== 'PAGADA' && en(patio, db.ordenes.find((o) => o.id === f.ordenId)?.patio),
      ).length
      return n ? { text: `${n} por cobrar`, tone: 'yellow' } : null
    },
  },
  {
    id: 'garantias', path: '/garantias', nombre: 'Garantías', corto: 'Garantías',
    descripcion: 'Reapertura de órdenes, diagnóstico de procedencia y reproceso con mismos técnicos.',
    icon: 'shield', component: Garantias,
    roles: ['SUBGERENTE', 'VALUADOR', 'ASESOR'],
    kpi: (db, patio) => {
      const n = db.ordenes.filter((o) => en(patio, o.patio) && o.status === 'GARANTIA').length
      return n ? { text: `${n} activas`, tone: 'red' } : null
    },
  },
  {
    id: 'reportes', path: '/reportes', nombre: 'Reportes y KPIs', corto: 'Reportes',
    descripcion: 'Indicadores del taller: ciclo de reparación, mezcla de aseguradoras, ventas y cuellos.',
    icon: 'chart', component: Reportes,
    roles: ['SUBGERENTE'],
  },
  {
    id: 'catalogos', path: '/catalogos', nombre: 'Catálogos', corto: 'Catálogos',
    descripcion: 'Aseguradoras, técnicos, proveedores, torres, patios y configuración del sistema.',
    icon: 'settings', component: Catalogos,
    roles: [],
  },
  {
    id: 'admin', path: '/admin', nombre: 'Administración', corto: 'Admin',
    descripcion: 'Personal, roles, permisos, parámetros de negocio y catálogos. Solo Administrador.',
    icon: 'user', component: Admin, soloAdmin: true,
    kpi: (db) => ({ text: `${db.usuarios.filter((u) => u.activo).length} usuarios`, tone: 'gray' }),
  },
]

/** Alertas operativas para la homepage, acotadas al patio de la sesión. */
export function alertas(db: DB, patio: string) {
  const out: { texto: string; tone: 'red' | 'yellow'; path: string }[] = []
  const valesPend = db.vales.filter((v) => v.status === 'PENDIENTE' && en(patio, patioDeVale(db, v)))
  if (valesPend.length)
    out.push({ texto: `${valesPend.length} vale(s) esperando autorización`, tone: 'red', path: '/vales' })
  const bajoMin = db.materiales.filter((m) => en(patio, m.almacen) && m.existencia < m.minimo)
  if (bajoMin.length)
    out.push({ texto: `${bajoMin.length} material(es) bajo punto de reorden`, tone: 'red', path: '/almacen' })
  const refTarde = db.ordenes.filter(
    (o) => en(patio, o.patio) && o.refacciones.some((r) => !r.recibida && r.fechaPromesa && new Date(r.fechaPromesa) < new Date()),
  )
  if (refTarde.length)
    out.push({ texto: `${refTarde.length} orden(es) con refacciones vencidas de fecha promesa`, tone: 'yellow', path: '/ordenes' })
  const estancadas = db.ordenes.filter((o) => en(patio, o.patio) && o.status === 'EN_PROCESO' && diasDesde(o.fechaIngreso) > 15)
  if (estancadas.length)
    out.push({ texto: `${estancadas.length} orden(es) con más de 15 días en taller`, tone: 'yellow', path: '/taller' })
  const garantias = db.ordenes.filter((o) => en(patio, o.patio) && o.status === 'GARANTIA')
  if (garantias.length)
    out.push({ texto: `${garantias.length} garantía(s) en proceso`, tone: 'yellow', path: '/garantias' })
  return out
}
