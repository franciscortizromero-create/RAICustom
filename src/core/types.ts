// ── Dominio RAI Taller 360 ──────────────────────────────────────────────
// Modelo derivado del "Formulario de procesos RAI.xlsx" y de los registros
// históricos (Registro de Vehiculos.xlsx, Vales Control.xlsx).

export type Rol =
  | 'ADMIN'
  | 'GERENTE'
  | 'SUBGERENTE'
  | 'JEFE_TALLER'
  | 'VALUADOR'
  | 'ASESOR'
  | 'ALMACENISTA'
  | 'RH'
  | 'CONTADORA'

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  SUBGERENTE: 'Subgerente',
  JEFE_TALLER: 'Jefe de Taller',
  VALUADOR: 'Valuador',
  ASESOR: 'Asesor de Servicio',
  ALMACENISTA: 'Almacenista',
  RH: 'Encargado de RH',
  CONTADORA: 'Contadora',
}

/** Solo ADMIN y GERENTE ven los 3 patios; el resto se asigna a un patio. */
export const ROLES_GLOBALES: Rol[] = ['ADMIN', 'GERENTE']

/** Niveles de acceso a un campo/sección protegida dentro de un módulo. */
export type Acceso = 'EDITAR' | 'VER' | 'OCULTO'

export const ACCESO_LABEL: Record<Acceso, string> = {
  EDITAR: 'Editar',
  VER: 'Solo ver',
  OCULTO: 'Oculto',
}

/** Empleado con acceso al sistema (cuenta de usuario). */
export interface Usuario {
  id: string
  nombre: string
  email?: string
  telefono?: string
  rol: Rol
  patio: string // '' = todos los patios (solo roles globales)
  activo: boolean
  ingreso: string // fecha de alta
}

/**
 * Configuración de permisos editable desde el módulo de Administración.
 * - `modulos`: lista de ids de módulos accesibles por rol (override del default).
 * - `campos`: acceso por campo protegido (rol → campoId → Acceso).
 * ADMIN y GERENTE siempre ven y editan todo (no se limitan).
 */
export interface PermisosConfig {
  modulos: Partial<Record<Rol, string[]>>
  campos: Partial<Record<Rol, Record<string, Acceso>>>
}

// Etapas de producción (flujo del taller). Las etapas con % generan
// productividad para el técnico sobre el monto de venta del área.
export type EtapaId =
  | 'PATIO'
  | 'HOJ_A' // Desarmado        9% venta hojalatería
  | 'HOJ_B' // Laminado        20% venta hojalatería
  | 'HOJ_C' // Armado           6% venta hojalatería
  | 'INSP_HOJ'
  | 'PINT_A' // Preparación    13% venta pintura
  | 'PINT_B' // Pintura        13% venta pintura
  | 'PINT_C' // Pulido          9% venta pintura
  | 'INSP_PINT'
  | 'MEC_A' // Mecánica (única) 20% venta mecánica
  | 'INSP_MEC'
  | 'TOT' // Trabajos en Otro Taller
  | 'LAVADO'
  | 'INSP_FINAL'
  | 'ENTREGA'

export interface EtapaDef {
  id: EtapaId
  nombre: string
  area: 'HOJALATERIA' | 'PINTURA' | 'MECANICA' | 'TOT' | 'GENERAL'
  pct?: number // % de productividad sobre venta del área
  rolTecnico?: 'HOJALATERO' | 'PINTOR' | 'MECANICO' | 'LAVADOR'
  esInspeccion?: boolean
}

export const ETAPAS: EtapaDef[] = [
  { id: 'PATIO', nombre: 'Patio / Espera', area: 'GENERAL' },
  { id: 'HOJ_A', nombre: 'Hojalatería A · Desarmado', area: 'HOJALATERIA', pct: 9, rolTecnico: 'HOJALATERO' },
  { id: 'HOJ_B', nombre: 'Hojalatería B · Laminado', area: 'HOJALATERIA', pct: 20, rolTecnico: 'HOJALATERO' },
  { id: 'HOJ_C', nombre: 'Hojalatería C · Armado', area: 'HOJALATERIA', pct: 6, rolTecnico: 'HOJALATERO' },
  { id: 'INSP_HOJ', nombre: 'Inspección Hojalatería', area: 'HOJALATERIA', esInspeccion: true },
  { id: 'PINT_A', nombre: 'Pintura A · Preparación', area: 'PINTURA', pct: 13, rolTecnico: 'PINTOR' },
  { id: 'PINT_B', nombre: 'Pintura B · Aplicación', area: 'PINTURA', pct: 13, rolTecnico: 'PINTOR' },
  { id: 'PINT_C', nombre: 'Pintura C · Pulido', area: 'PINTURA', pct: 9, rolTecnico: 'PINTOR' },
  { id: 'INSP_PINT', nombre: 'Inspección Pintura', area: 'PINTURA', esInspeccion: true },
  { id: 'MEC_A', nombre: 'Mecánica (única)', area: 'MECANICA', pct: 20, rolTecnico: 'MECANICO' },
  { id: 'INSP_MEC', nombre: 'Inspección Mecánica', area: 'MECANICA', esInspeccion: true },
  { id: 'TOT', nombre: 'Trabajos en Otro Taller', area: 'TOT' },
  { id: 'LAVADO', nombre: 'Lavado y Detallado', area: 'GENERAL', rolTecnico: 'LAVADOR' },
  { id: 'INSP_FINAL', nombre: 'Inspección Final', area: 'GENERAL', esInspeccion: true },
  { id: 'ENTREGA', nombre: 'Lista para Entrega', area: 'GENERAL' },
]

export const etapaDef = (id: EtapaId): EtapaDef => ETAPAS.find((e) => e.id === id)!

export type OrdenStatus =
  | 'COTIZACION' // particular: esperando autorización del cliente
  | 'VALUACION' // seguro: en valuación / espera autorización CIA
  | 'ESPERA_REFACCIONES'
  | 'CITADO' // vehículo en tránsito, con cita de reingreso
  | 'EN_PROCESO' // en piso de taller
  | 'ENTREGADO'
  | 'FACTURADO'
  | 'PAGADO'
  | 'GARANTIA'
  | 'PAGO_DANOS' // terceros: se paga daño, no se repara
  | 'CANCELADO'

export const STATUS_LABEL: Record<OrdenStatus, string> = {
  COTIZACION: 'Cotización',
  VALUACION: 'Valuación',
  ESPERA_REFACCIONES: 'Espera refacciones',
  CITADO: 'Citado',
  EN_PROCESO: 'En proceso',
  ENTREGADO: 'Entregado',
  FACTURADO: 'Facturado',
  PAGADO: 'Pagado',
  GARANTIA: 'Garantía',
  PAGO_DANOS: 'Pago de daños',
  CANCELADO: 'Cancelado',
}

export interface InventarioIngreso {
  fecha: string
  tipo: 'INGRESO' | 'REINGRESO' | 'GARANTIA'
  checklist: Record<string, boolean> // interiores, exteriores, herramienta...
  combustible: number // 0-100
  km?: string
  firmaCliente: boolean
  firmaInventario: boolean
  fotos: number // contador de fotos de la carpeta de ingreso
  notas?: string
}

export interface LogAsignacion {
  fecha: string
  rol: 'HOJALATERO' | 'PINTOR' | 'MECANICO'
  deId?: string
  aId: string
  motivo: string
  usuario: string
}

export interface LogEtapa {
  etapa: EtapaId
  fecha: string
  usuario: string
  tecnicoId?: string // técnico que completó la etapa (para productividad)
}

export interface LineaPresupuesto {
  concepto: string
  area: 'HOJALATERIA' | 'PINTURA' | 'MECANICA' | 'TOT' | 'REFACCION'
  operacion: 'REPARACION' | 'CAMBIO'
  costo: number // costo del taller
  venta: number // precio de venta
  autorizada: 'PENDIENTE' | 'AUTORIZADA' | 'RECHAZADA' | 'COMPLEMENTO'
}

export interface Refaccion {
  descripcion: string
  proveedorId?: string
  costo: number
  origen: 'ORIGINAL' | 'GENERICA' | 'USADA'
  fechaPromesa?: string
  recibida: boolean
  estadoOk?: boolean
}

export interface Orden {
  id: string
  folio: number
  torre: string
  fechaIngreso: string
  tipoCliente: 'SEGURO' | 'PARTICULAR'
  aseguradoraId?: string
  numSiniestro?: string
  ajustador?: string
  caracterCliente?: 'ASEGURADO' | 'TERCERO'
  tipoValuacion?: 'REPARACION' | 'TRANSITAR' | 'DANOS_SE_QUEDA' | 'SOLO_VALUACION'
  vehiculo: { marca: string; tipo: string; modelo: string; color: string; placas: string }
  cliente: { nombre: string; telefono: string; email?: string }
  valuador: string // iniciales, como en el registro actual (OR, JZ, RR...)
  status: OrdenStatus
  etapa: EtapaId
  hojalateroId?: string
  pintorId?: string
  mecanicoId?: string
  patio: string
  inventarios: InventarioIngreso[]
  asignacionLog: LogAsignacion[]
  etapasLog: LogEtapa[]
  presupuesto: LineaPresupuesto[]
  refacciones: Refaccion[]
  deducible?: number
  anticipo?: number
  formaPago?: string
  autorizacionCliente?: { fecha: string; medio: 'FISICO' | 'WHATSAPP' | 'EMAIL' | 'PORTAL' }
  finiquitoFirmado?: boolean
  encuestaLlena?: boolean
  facturaId?: string
  garantiaDe?: number // folio de la orden original si es garantía
  comentarios?: string
}

export type ValeTipo = 'PINTURA' | 'REFACCION' | 'TOT' | 'MATERIAL'

export const VALE_TIPO_LABEL: Record<ValeTipo, string> = {
  PINTURA: 'Igualación de pintura',
  REFACCION: 'Refacciones',
  TOT: 'Servicio TOT',
  MATERIAL: 'Material de almacén',
}

export type ValeStatus = 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO' | 'SURTIDO' | 'EN_REVISION' | 'PAGADO'

export interface Vale {
  id: string
  folio: number
  tipo: ValeTipo
  ordenId?: string // PINTURA/REFACCION/TOT requieren orden; MATERIAL no
  patio?: string // patio del expediente o del almacén que origina el vale
  proveedorId: string
  solicita: string
  descripcion: string
  detalle?: string // ml de pintura, piezas, tarea TOT...
  monto: number
  fecha: string
  status: ValeStatus
  autorizadoPor?: string
  autorizadoRol?: Rol
  facturaProveedor?: string
  contraReciboId?: string
  firmaProveedor?: boolean
}

export interface Material {
  id: string
  nombre: string
  unidad: string
  costo: number
  existencia: number
  minimo: number
  maximo: number
  almacen: string
  proveedorId?: string
}

export interface MovimientoInventario {
  id: string
  fecha: string
  materialId: string
  tipo: 'ENTRADA' | 'SALIDA_ORDEN' | 'SALIDA_ALMACEN' | 'AJUSTE_MERMA' | 'AJUSTE_SOBRANTE'
  cantidad: number
  ordenId?: string
  tecnicoId?: string
  autorizadoPor?: string
  notas?: string
}

export interface Tecnico {
  id: string
  nombre: string
  rol: 'HOJALATERO' | 'PINTOR' | 'MECANICO' | 'LAVADOR'
  patio: string
  activo: boolean
}

export interface Prestamo {
  id: string
  tecnicoId: string
  montoOriginal: number
  saldo: number
  abonoSemanal: number
}

export interface Proveedor {
  id: string
  nombre: string
  giro: 'PINTURA' | 'REFACCIONES' | 'TOT' | 'MATERIALES'
  telefono?: string
  diasCredito: number
}

export interface Aseguradora {
  id: string
  nombre: string
  clave: string // QLTS, ABA, ATLAS...
  valuadoresAsignados?: string
}

export interface Cita {
  id: string
  ordenId: string
  fecha: string
  hora: string
  motivo: 'REINGRESO_REPARACION' | 'VALUACION' | 'ENTREGA' | 'GARANTIA'
  estado: 'PROGRAMADA' | 'CUMPLIDA' | 'NO_ASISTIO' | 'REAGENDADA'
  notas?: string
}

export interface ContraRecibo {
  id: string
  folio: number
  proveedorId: string
  fecha: string
  facturas: { numFactura: string; valesFolios: number[]; monto: number }[]
  estado: 'REVISION' | 'AUTORIZADO' | 'PAGADO' | 'CON_DIFERENCIAS'
  fechaVencimiento: string
  fechaPago?: string
  notas?: string
}

export interface Factura {
  id: string
  folio: string
  ordenId: string
  cliente: string
  monto: number
  fecha: string
  estado: 'EMITIDA' | 'SUBIDA_PORTAL' | 'PAGADA'
  fechaPago?: string
  formaPago?: string
}

export interface PagoProductividad {
  id: string
  semana: string // ISO del sábado de corte
  tecnicoId: string
  detalle: { ordenFolio: number; etapa: EtapaId; base: number; pct: number; monto: number }[]
  ajustes: { concepto: string; monto: number }[]
  descuentoPrestamo: number
  total: number
  estado: 'BORRADOR' | 'REVISADO' | 'PAGADO'
  firmaTecnico?: boolean
}

export interface DB {
  ordenes: Orden[]
  vales: Vale[]
  materiales: Material[]
  movimientos: MovimientoInventario[]
  tecnicos: Tecnico[]
  prestamos: Prestamo[]
  proveedores: Proveedor[]
  aseguradoras: Aseguradora[]
  citas: Cita[]
  contraRecibos: ContraRecibo[]
  facturas: Factura[]
  pagosProductividad: PagoProductividad[]
  usuarios: Usuario[]
  permisos: PermisosConfig
  config: { siguienteFolioOrden: number; siguienteFolioVale: number; siguienteFolioCR: number; torres: string[]; patios: string[] }
}
