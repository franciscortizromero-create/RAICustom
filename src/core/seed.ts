import type { DB, Orden, Vale, Tecnico, Material, Proveedor, Aseguradora, EtapaId } from './types'
import { uid } from './format'

const dAgo = (n: number, h = 10) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}

// Aseguradoras según el registro real (QLTS, ABA, ATLAS, BBVA, SURA, WIBE) + nota
// del formulario: patios AQUILES (QLTS/SURA/PART), P26 (QLTS/PART), GPE P (CHUBB/BBVA/ATLAS/WIBE/PART)
const aseguradoras: Aseguradora[] = [
  { id: 'qlts', nombre: 'Qualitas', clave: 'QLTS' },
  { id: 'aba', nombre: 'ABA Seguros', clave: 'ABA' },
  { id: 'atlas', nombre: 'Seguros Atlas', clave: 'ATLAS' },
  { id: 'bbva', nombre: 'BBVA Seguros', clave: 'BBVA' },
  { id: 'sura', nombre: 'SURA', clave: 'SURA' },
  { id: 'wibe', nombre: 'WIBE', clave: 'WIBE' },
  { id: 'chubb', nombre: 'CHUBB', clave: 'CHUBB' },
]

const tecnicos: Tecnico[] = [
  { id: 'mz', nombre: 'Marco Zamarripa', rol: 'PINTOR', patio: 'AQUILES', activo: true },
  { id: 'rr', nombre: 'Ricardo Rodríguez', rol: 'PINTOR', patio: 'P26', activo: true },
  { id: 'gm', nombre: 'Gabriel Murillo', rol: 'PINTOR', patio: 'GPE P', activo: true },
  { id: 'jh', nombre: 'Javier Herrera', rol: 'HOJALATERO', patio: 'AQUILES', activo: true },
  { id: 'lc', nombre: 'Luis Casillas', rol: 'HOJALATERO', patio: 'AQUILES', activo: true },
  { id: 'pd', nombre: 'Pedro Delgado', rol: 'HOJALATERO', patio: 'P26', activo: true },
  { id: 'am', nombre: 'Arturo Macías', rol: 'HOJALATERO', patio: 'GPE P', activo: true },
  { id: 'fv', nombre: 'Felipe Valdez', rol: 'MECANICO', patio: 'AQUILES', activo: true },
  { id: 'jl', nombre: 'José Luna', rol: 'LAVADOR', patio: 'AQUILES', activo: true },
]

const proveedores: Proveedor[] = [
  { id: 'igualado1', nombre: 'Centro de Igualado ColorMatch', giro: 'PINTURA', telefono: '449 912 4455', diasCredito: 15 },
  { id: 'igualado2', nombre: 'Pinturas Automotrices del Centro', giro: 'PINTURA', telefono: '449 918 7733', diasCredito: 15 },
  { id: 'refa1', nombre: 'Refaccionaria El Camino', giro: 'REFACCIONES', telefono: '449 915 2210', diasCredito: 30 },
  { id: 'refa2', nombre: 'AutoPartes Hidalgo', giro: 'REFACCIONES', telefono: '449 994 8821', diasCredito: 30 },
  { id: 'tot1', nombre: 'Alineaciones y Suspensiones AGS', giro: 'TOT', telefono: '449 970 1010', diasCredito: 15 },
  { id: 'tot2', nombre: 'Cristales y Climas García', giro: 'TOT', telefono: '449 153 8092', diasCredito: 15 },
  { id: 'mat1', nombre: 'Abrasivos y Materiales de AGS', giro: 'MATERIALES', telefono: '449 916 4040', diasCredito: 30 },
]

const materiales: Material[] = [
  { id: 'm1', nombre: 'Lija 320 (hoja)', unidad: 'pza', costo: 14, existencia: 180, minimo: 100, maximo: 500, almacen: 'AQUILES', proveedorId: 'mat1' },
  { id: 'm2', nombre: 'Lija 600 (hoja)', unidad: 'pza', costo: 16, existencia: 64, minimo: 80, maximo: 400, almacen: 'AQUILES', proveedorId: 'mat1' },
  { id: 'm3', nombre: 'Masking tape 3/4"', unidad: 'rollo', costo: 28, existencia: 45, minimo: 30, maximo: 120, almacen: 'AQUILES', proveedorId: 'mat1' },
  { id: 'm4', nombre: 'Primer gris 1L', unidad: 'lt', costo: 240, existencia: 12, minimo: 8, maximo: 40, almacen: 'AQUILES', proveedorId: 'mat1' },
  { id: 'm5', nombre: 'Thinner estándar', unidad: 'lt', costo: 65, existencia: 6, minimo: 20, maximo: 80, almacen: 'P26', proveedorId: 'mat1' },
  { id: 'm6', nombre: 'Pasta para pulir', unidad: 'kg', costo: 310, existencia: 9, minimo: 4, maximo: 20, almacen: 'AQUILES', proveedorId: 'mat1' },
  { id: 'm7', nombre: 'Soldadura MIG 0.9mm', unidad: 'kg', costo: 520, existencia: 11, minimo: 5, maximo: 25, almacen: 'GPE P', proveedorId: 'mat1' },
  { id: 'm8', nombre: 'Plástico para enmascarar', unidad: 'rollo', costo: 180, existencia: 3, minimo: 4, maximo: 15, almacen: 'P26', proveedorId: 'mat1' },
]

type POrden = Partial<Orden> & { folio: number }

const checklistBase = {
  'Espejos laterales': true, 'Tapones de rueda': true, 'Antena': true, 'Gato y llave': true,
  'Llanta refacción': true, 'Estéreo': true, 'Tapetes': true, 'Documentos en guantera': false,
}

function orden(p: POrden): Orden {
  return {
    id: uid(),
    torre: 'T-00',
    fechaIngreso: dAgo(10),
    tipoCliente: 'SEGURO',
    vehiculo: { marca: '', tipo: '', modelo: '', color: '', placas: '' },
    cliente: { nombre: '', telefono: '' },
    valuador: 'OR',
    status: 'EN_PROCESO',
    etapa: 'PATIO',
    patio: 'AQUILES',
    inventarios: [
      { fecha: dAgo(10), tipo: 'INGRESO', checklist: checklistBase, combustible: 50, firmaCliente: true, firmaInventario: true, fotos: 12 },
    ],
    asignacionLog: [],
    etapasLog: [],
    presupuesto: [],
    refacciones: [],
    ...p,
  } as Orden
}

const ordenes: Orden[] = [
  orden({
    folio: 24215, torre: 'T-08', fechaIngreso: dAgo(18), tipoCliente: 'SEGURO', aseguradoraId: 'qlts',
    numSiniestro: '226114532', ajustador: 'Juan C. Morales', caracterCliente: 'ASEGURADO', tipoValuacion: 'REPARACION',
    vehiculo: { marca: 'NISSAN', tipo: 'VERSA', modelo: '2022', color: 'BLANCO', placas: 'AHM-201C' },
    cliente: { nombre: 'Laura Esparza', telefono: '449 110 2233', email: 'laura.e@mail.com' },
    valuador: 'JZ', status: 'EN_PROCESO', etapa: 'PINT_B', patio: 'AQUILES',
    hojalateroId: 'jh', pintorId: 'mz',
    presupuesto: [
      { concepto: 'Laminado puerta del. izq.', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 1800, venta: 4200, autorizada: 'AUTORIZADA' },
      { concepto: 'Laminado salpicadera izq.', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 1500, venta: 3400, autorizada: 'AUTORIZADA' },
      { concepto: 'Pintura puerta y salpicadera', area: 'PINTURA', operacion: 'REPARACION', costo: 2300, venta: 5600, autorizada: 'AUTORIZADA' },
      { concepto: 'Espejo lateral izq.', area: 'REFACCION', operacion: 'CAMBIO', costo: 1450, venta: 1950, autorizada: 'AUTORIZADA' },
    ],
    refacciones: [{ descripcion: 'Espejo lateral izq. Versa 22', proveedorId: 'refa1', costo: 1450, origen: 'ORIGINAL', recibida: true, estadoOk: true }],
    etapasLog: [
      { etapa: 'HOJ_A', fecha: dAgo(8, 12), usuario: 'Jefe de Taller', tecnicoId: 'jh' },
      { etapa: 'HOJ_B', fecha: dAgo(5, 16), usuario: 'Jefe de Taller', tecnicoId: 'jh' },
      { etapa: 'HOJ_C', fecha: dAgo(3, 11), usuario: 'Jefe de Taller', tecnicoId: 'jh' },
      { etapa: 'INSP_HOJ', fecha: dAgo(3, 17), usuario: 'Subgerente' },
      { etapa: 'PINT_A', fecha: dAgo(1, 13), usuario: 'Jefe de Taller', tecnicoId: 'mz' },
    ],
  }),
  orden({
    folio: 24216, torre: 'T-21', fechaIngreso: dAgo(15), tipoCliente: 'PARTICULAR',
    vehiculo: { marca: 'VW', tipo: 'JETTA', modelo: '2019', color: 'GRIS', placas: 'AKD-118B' },
    cliente: { nombre: 'Mario Rentería', telefono: '449 206 6370' },
    valuador: 'RR', status: 'EN_PROCESO', etapa: 'HOJ_B', patio: 'P26',
    hojalateroId: 'pd', pintorId: 'rr',
    autorizacionCliente: { fecha: dAgo(13), medio: 'WHATSAPP' }, anticipo: 2000,
    presupuesto: [
      { concepto: 'Laminado cofre', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 1300, venta: 3000, autorizada: 'AUTORIZADA' },
      { concepto: 'Pintura cofre y fascia', area: 'PINTURA', operacion: 'REPARACION', costo: 1900, venta: 4300, autorizada: 'AUTORIZADA' },
    ],
    etapasLog: [{ etapa: 'HOJ_A', fecha: dAgo(2, 10), usuario: 'Jefe de Taller', tecnicoId: 'pd' }],
  }),
  orden({
    folio: 24217, torre: 'T-35', fechaIngreso: dAgo(12), tipoCliente: 'SEGURO', aseguradoraId: 'sura',
    numSiniestro: '20264411', caracterCliente: 'ASEGURADO', tipoValuacion: 'TRANSITAR',
    vehiculo: { marca: 'KIA', tipo: 'RIO', modelo: '2021', color: 'ROJO', placas: 'ALM-905A' },
    cliente: { nombre: 'Sofía Martín del Campo', telefono: '449 100 0370' },
    valuador: 'OR', status: 'ESPERA_REFACCIONES', etapa: 'PATIO', patio: 'AQUILES',
    presupuesto: [
      { concepto: 'Cambio fascia trasera', area: 'HOJALATERIA', operacion: 'CAMBIO', costo: 900, venta: 2100, autorizada: 'AUTORIZADA' },
      { concepto: 'Pintura fascia', area: 'PINTURA', operacion: 'REPARACION', costo: 1100, venta: 2600, autorizada: 'AUTORIZADA' },
      { concepto: 'Sensor de reversa', area: 'REFACCION', operacion: 'CAMBIO', costo: 800, venta: 1200, autorizada: 'COMPLEMENTO' },
    ],
    refacciones: [
      { descripcion: 'Fascia trasera Rio 21', proveedorId: 'refa2', costo: 3850, origen: 'ORIGINAL', fechaPromesa: dAgo(-3), recibida: false },
      { descripcion: 'Sensor reversa', proveedorId: 'refa2', costo: 800, origen: 'GENERICA', fechaPromesa: dAgo(-1), recibida: false },
    ],
  }),
  orden({
    folio: 24218, torre: 'T-09', fechaIngreso: dAgo(9), tipoCliente: 'SEGURO', aseguradoraId: 'bbva',
    numSiniestro: 'BB-887123', caracterCliente: 'TERCERO', tipoValuacion: 'SOLO_VALUACION',
    vehiculo: { marca: 'CHEVROLET', tipo: 'AVEO', modelo: '2018', color: 'PLATA', placas: 'AGS-441B' },
    cliente: { nombre: 'Hugo Padilla', telefono: '449 769 2285' },
    valuador: 'JZ', status: 'PAGO_DANOS', etapa: 'ENTREGA', patio: 'GPE P',
    comentarios: 'Tercero — la CIA paga daños, no se repara en taller.',
  }),
  orden({
    folio: 24219, torre: 'T-52', fechaIngreso: dAgo(8), tipoCliente: 'SEGURO', aseguradoraId: 'atlas',
    numSiniestro: 'ATL-99021', caracterCliente: 'ASEGURADO', tipoValuacion: 'REPARACION',
    vehiculo: { marca: 'TOYOTA', tipo: 'HILUX', modelo: '2023', color: 'BLANCO', placas: 'AJP-733C' },
    cliente: { nombre: 'Transportes Bajío SA', telefono: '449 994 1122' },
    valuador: 'RR', status: 'EN_PROCESO', etapa: 'MEC_A', patio: 'GPE P',
    hojalateroId: 'am', pintorId: 'gm', mecanicoId: 'fv',
    presupuesto: [
      { concepto: 'Laminado caja y puerta tras.', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 2600, venta: 6100, autorizada: 'AUTORIZADA' },
      { concepto: 'Pintura caja completa', area: 'PINTURA', operacion: 'REPARACION', costo: 2800, venta: 6900, autorizada: 'AUTORIZADA' },
      { concepto: 'Cambio amortiguadores tras.', area: 'MECANICA', operacion: 'CAMBIO', costo: 1500, venta: 3800, autorizada: 'AUTORIZADA' },
      { concepto: 'Alineación y balanceo', area: 'TOT', operacion: 'REPARACION', costo: 650, venta: 1100, autorizada: 'AUTORIZADA' },
    ],
    refacciones: [{ descripcion: 'Par amortiguadores Hilux', proveedorId: 'refa1', costo: 2900, origen: 'ORIGINAL', recibida: true, estadoOk: true }],
    etapasLog: [
      { etapa: 'HOJ_A', fecha: dAgo(6, 9), usuario: 'Jefe de Taller', tecnicoId: 'am' },
      { etapa: 'HOJ_B', fecha: dAgo(4, 15), usuario: 'Jefe de Taller', tecnicoId: 'am' },
      { etapa: 'HOJ_C', fecha: dAgo(3, 12), usuario: 'Jefe de Taller', tecnicoId: 'am' },
      { etapa: 'INSP_HOJ', fecha: dAgo(3, 16), usuario: 'Gerente' },
      { etapa: 'PINT_A', fecha: dAgo(2, 10), usuario: 'Jefe de Taller', tecnicoId: 'gm' },
      { etapa: 'PINT_B', fecha: dAgo(1, 14), usuario: 'Jefe de Taller', tecnicoId: 'gm' },
      { etapa: 'PINT_C', fecha: dAgo(0, 9), usuario: 'Jefe de Taller', tecnicoId: 'gm' },
      { etapa: 'INSP_PINT', fecha: dAgo(0, 12), usuario: 'Subgerente' },
    ],
    asignacionLog: [
      { fecha: dAgo(4), rol: 'PINTOR', deId: 'rr', aId: 'gm', motivo: 'Carga de trabajo: RR con 3 unidades en proceso', usuario: 'Jefe de Taller' },
    ],
  }),
  orden({
    folio: 24220, torre: 'T-14', fechaIngreso: dAgo(30), tipoCliente: 'SEGURO', aseguradoraId: 'qlts',
    numSiniestro: '226099812', caracterCliente: 'ASEGURADO', tipoValuacion: 'REPARACION',
    vehiculo: { marca: 'MAZDA', tipo: 'CX-5', modelo: '2020', color: 'AZUL', placas: 'AFW-773B' },
    cliente: { nombre: 'Fabián Andrade', telefono: '449 400 5711' },
    valuador: 'JZ', status: 'ENTREGADO', etapa: 'ENTREGA', patio: 'AQUILES',
    hojalateroId: 'lc', pintorId: 'mz', deducible: 7500, finiquitoFirmado: true, encuestaLlena: true,
    presupuesto: [
      { concepto: 'Laminado portón trasero', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 2100, venta: 5000, autorizada: 'AUTORIZADA' },
      { concepto: 'Pintura portón y fascia', area: 'PINTURA', operacion: 'REPARACION', costo: 2400, venta: 5800, autorizada: 'AUTORIZADA' },
    ],
    etapasLog: [
      { etapa: 'HOJ_A', fecha: dAgo(20, 10), usuario: 'Jefe de Taller', tecnicoId: 'lc' },
      { etapa: 'HOJ_B', fecha: dAgo(16, 10), usuario: 'Jefe de Taller', tecnicoId: 'lc' },
      { etapa: 'HOJ_C', fecha: dAgo(13, 10), usuario: 'Jefe de Taller', tecnicoId: 'lc' },
      { etapa: 'INSP_HOJ', fecha: dAgo(13, 10), usuario: 'Gerente' },
      { etapa: 'PINT_A', fecha: dAgo(11, 10), usuario: 'Jefe de Taller', tecnicoId: 'mz' },
      { etapa: 'PINT_B', fecha: dAgo(9, 10), usuario: 'Jefe de Taller', tecnicoId: 'mz' },
      { etapa: 'PINT_C', fecha: dAgo(6, 10), usuario: 'Jefe de Taller', tecnicoId: 'mz' },
      { etapa: 'INSP_PINT', fecha: dAgo(6, 10), usuario: 'Gerente' },
      { etapa: 'LAVADO', fecha: dAgo(5, 10), usuario: 'Jefe de Taller', tecnicoId: 'jl' },
      { etapa: 'INSP_FINAL', fecha: dAgo(5, 10), usuario: 'Gerente' },
      { etapa: 'ENTREGA', fecha: dAgo(4, 10), usuario: 'Asesor' },
    ],
  }),
  orden({
    folio: 24221, torre: 'T-61', fechaIngreso: dAgo(6), tipoCliente: 'PARTICULAR',
    vehiculo: { marca: 'HONDA', tipo: 'CIVIC', modelo: '2017', color: 'NEGRO', placas: 'ACE-592B' },
    cliente: { nombre: 'Karla Soto', telefono: '449 197 3109' },
    valuador: 'OR', status: 'COTIZACION', etapa: 'PATIO', patio: 'P26',
    presupuesto: [
      { concepto: 'Laminado defensa y cajuela', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 1600, venta: 3700, autorizada: 'PENDIENTE' },
      { concepto: 'Pintura defensa y cajuela', area: 'PINTURA', operacion: 'REPARACION', costo: 1700, venta: 4100, autorizada: 'PENDIENTE' },
    ],
    comentarios: 'Cotización enviada por WhatsApp, pendiente autorización por escrito.',
  }),
  orden({
    folio: 24222, torre: 'T-72', fechaIngreso: dAgo(4), tipoCliente: 'SEGURO', aseguradoraId: 'wibe',
    numSiniestro: 'WB-50412', caracterCliente: 'ASEGURADO', tipoValuacion: 'DANOS_SE_QUEDA',
    vehiculo: { marca: 'NISSAN', tipo: 'MARCH', modelo: '2016', color: 'AMARILLO', placas: 'AAC-655B' },
    cliente: { nombre: 'Diego Campos', telefono: '449 769 4411' },
    valuador: 'JZ', status: 'VALUACION', etapa: 'PATIO', patio: 'GPE P',
    comentarios: 'Llegó en grúa. Valuación enviada a la CIA, esperando autorización.',
  }),
  orden({
    folio: 24223, torre: 'T-44', fechaIngreso: dAgo(40), tipoCliente: 'SEGURO', aseguradoraId: 'qlts',
    numSiniestro: '226071230', caracterCliente: 'ASEGURADO', tipoValuacion: 'REPARACION',
    vehiculo: { marca: 'SEAT', tipo: 'IBIZA', modelo: '2019', color: 'BLANCO', placas: 'AHZ-300B' },
    cliente: { nombre: 'Rocío Llamas', telefono: '449 215 7941' },
    valuador: 'RR', status: 'FACTURADO', etapa: 'ENTREGA', patio: 'AQUILES',
    hojalateroId: 'jh', pintorId: 'mz', deducible: 5000, finiquitoFirmado: true, facturaId: 'f1',
    presupuesto: [
      { concepto: 'Laminado costado der.', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 2900, venta: 6800, autorizada: 'AUTORIZADA' },
      { concepto: 'Pintura costado der.', area: 'PINTURA', operacion: 'REPARACION', costo: 2700, venta: 6300, autorizada: 'AUTORIZADA' },
    ],
    etapasLog: [
      { etapa: 'ENTREGA', fecha: dAgo(22, 13), usuario: 'Asesor' },
    ],
  }),
  orden({
    folio: 24224, torre: 'T-17', fechaIngreso: dAgo(2), tipoCliente: 'SEGURO', aseguradoraId: 'qlts',
    numSiniestro: '226120077', caracterCliente: 'ASEGURADO', tipoValuacion: 'TRANSITAR',
    vehiculo: { marca: 'VW', tipo: 'VENTO', modelo: '2020', color: 'NEGRO', placas: 'ALR-220C' },
    cliente: { nombre: 'Norma Ibarra', telefono: '449 332 1098' },
    valuador: 'OR', status: 'CITADO', etapa: 'PATIO', patio: 'AQUILES',
    presupuesto: [
      { concepto: 'Cambio puerta tras. der.', area: 'HOJALATERIA', operacion: 'CAMBIO', costo: 1400, venta: 3200, autorizada: 'AUTORIZADA' },
      { concepto: 'Pintura puerta', area: 'PINTURA', operacion: 'REPARACION', costo: 1300, venta: 3100, autorizada: 'AUTORIZADA' },
    ],
    refacciones: [{ descripcion: 'Puerta tras. der. Vento 20', proveedorId: 'refa1', costo: 5200, origen: 'ORIGINAL', fechaPromesa: dAgo(-2), recibida: false }],
  }),
  orden({
    folio: 24225, torre: 'T-29', fechaIngreso: dAgo(1), tipoCliente: 'SEGURO', aseguradoraId: 'qlts',
    garantiaDe: 24220,
    vehiculo: { marca: 'MAZDA', tipo: 'CX-5', modelo: '2020', color: 'AZUL', placas: 'AFW-773B' },
    cliente: { nombre: 'Fabián Andrade', telefono: '449 400 5711' },
    valuador: 'JZ', status: 'GARANTIA', etapa: 'PINT_A', patio: 'AQUILES', pintorId: 'mz',
    comentarios: 'Garantía de OT 24220: detalle de brillo en portón. Procedente, solo mano de obra.',
    inventarios: [
      { fecha: dAgo(1), tipo: 'GARANTIA', checklist: checklistBase, combustible: 70, firmaCliente: true, firmaInventario: true, fotos: 8 },
    ],
    etapasLog: [],
  }),
]

const vales: Vale[] = [
  { id: 'v1', folio: 4101, tipo: 'PINTURA', ordenId: ordenes[0].id, proveedorId: 'igualado1', solicita: 'Marco Zamarripa', descripcion: 'Igualación blanco perlado', detalle: '750 ml · 2 piezas · base agua', monto: 1340, fecha: dAgo(1, 12), status: 'SURTIDO', autorizadoPor: 'Jefe de Taller', autorizadoRol: 'JEFE_TALLER', firmaProveedor: true },
  { id: 'v2', folio: 4102, tipo: 'REFACCION', ordenId: ordenes[0].id, proveedorId: 'refa1', solicita: 'JZ', descripcion: 'Espejo lateral izq. Versa 22', monto: 1450, fecha: dAgo(7, 11), status: 'EN_REVISION', autorizadoPor: 'Gerente', autorizadoRol: 'GERENTE', facturaProveedor: 'F-2231', firmaProveedor: true },
  { id: 'v3', folio: 4103, tipo: 'TOT', ordenId: ordenes[4].id, proveedorId: 'tot1', solicita: 'RR', descripcion: 'Alineación y balanceo Hilux', monto: 650, fecha: dAgo(2, 13), status: 'AUTORIZADO', autorizadoPor: 'Subgerente', autorizadoRol: 'SUBGERENTE' },
  { id: 'v4', folio: 4104, tipo: 'MATERIAL', patio: 'P26', proveedorId: 'mat1', solicita: 'Almacenista', descripcion: 'Thinner estándar x 30 lt', detalle: 'Reorden: existencia 6 < mínimo 20', monto: 1950, fecha: dAgo(0, 9), status: 'PENDIENTE' },
  { id: 'v5', folio: 4105, tipo: 'PINTURA', ordenId: ordenes[4].id, proveedorId: 'igualado2', solicita: 'Gabriel Murillo', descripcion: 'Igualación blanco Hilux', detalle: '1000 ml · caja completa', monto: 1680, fecha: dAgo(2, 10), status: 'SURTIDO', autorizadoPor: 'Jefe de Taller', autorizadoRol: 'JEFE_TALLER', facturaProveedor: 'PC-0907', firmaProveedor: true },
  { id: 'v6', folio: 4106, tipo: 'REFACCION', ordenId: ordenes[2].id, proveedorId: 'refa2', solicita: 'OR', descripcion: 'Fascia tras. + sensor Rio 21', monto: 4650, fecha: dAgo(4, 12), status: 'AUTORIZADO', autorizadoPor: 'Gerente', autorizadoRol: 'GERENTE' },
]

const db: DB = {
  ordenes,
  vales,
  materiales,
  movimientos: [
    { id: uid(), fecha: dAgo(2, 9), materialId: 'm1', tipo: 'SALIDA_ORDEN', cantidad: 12, ordenId: ordenes[0].id, tecnicoId: 'jh', autorizadoPor: 'Jefe de Taller' },
    { id: uid(), fecha: dAgo(2, 9), materialId: 'm3', tipo: 'SALIDA_ORDEN', cantidad: 2, ordenId: ordenes[0].id, tecnicoId: 'mz', autorizadoPor: 'Valuador' },
    { id: uid(), fecha: dAgo(1, 10), materialId: 'm5', tipo: 'SALIDA_ORDEN', cantidad: 4, ordenId: ordenes[4].id, tecnicoId: 'gm', autorizadoPor: 'Jefe de Taller' },
    { id: uid(), fecha: dAgo(6, 9), materialId: 'm4', tipo: 'ENTRADA', cantidad: 8, notas: 'Compra vale 4099' },
  ],
  tecnicos,
  prestamos: [
    { id: 'p1', tecnicoId: 'jh', montoOriginal: 6000, saldo: 3200, abonoSemanal: 400 },
    { id: 'p2', tecnicoId: 'gm', montoOriginal: 3000, saldo: 1000, abonoSemanal: 500 },
  ],
  proveedores,
  aseguradoras,
  citas: [
    { id: uid(), ordenId: ordenes[9].id, fecha: dAgo(-2).slice(0, 10), hora: '09:00', motivo: 'REINGRESO_REPARACION', estado: 'PROGRAMADA', notas: 'Reingresa al llegar refacciones' },
    { id: uid(), ordenId: ordenes[6].id, fecha: dAgo(-1).slice(0, 10), hora: '12:30', motivo: 'VALUACION', estado: 'PROGRAMADA' },
    { id: uid(), ordenId: ordenes[0].id, fecha: dAgo(-4).slice(0, 10), hora: '17:00', motivo: 'ENTREGA', estado: 'PROGRAMADA' },
  ],
  contraRecibos: [
    {
      id: 'cr1', folio: 901, proveedorId: 'refa1', fecha: dAgo(3),
      facturas: [{ numFactura: 'F-2231', valesFolios: [4102], monto: 1450 }],
      estado: 'REVISION', fechaVencimiento: dAgo(-27).slice(0, 10),
    },
    {
      id: 'cr2', folio: 902, proveedorId: 'igualado2', fecha: dAgo(1),
      facturas: [{ numFactura: 'PC-0907', valesFolios: [4105], monto: 1680 }],
      estado: 'AUTORIZADO', fechaVencimiento: dAgo(-14).slice(0, 10),
    },
  ],
  facturas: [
    { id: 'f1', folio: 'B-10412', ordenId: ordenes[8].id, cliente: 'Qualitas Cía. de Seguros', monto: 13100, fecha: dAgo(20), estado: 'SUBIDA_PORTAL' },
    { id: 'f2', folio: 'B-10398', ordenId: ordenes[5].id, cliente: 'Qualitas Cía. de Seguros', monto: 10800, fecha: dAgo(3), estado: 'PAGADA', fechaPago: dAgo(1), formaPago: 'Transferencia' },
  ],
  pagosProductividad: [],
  config: {
    siguienteFolioOrden: 24226,
    siguienteFolioVale: 4107,
    siguienteFolioCR: 903,
    torres: Array.from({ length: 99 }, (_, i) => `T-${String(i + 1).padStart(2, '0')}`),
    patios: ['AQUILES', 'P26', 'GPE P'],
  },
}

export const seedDB = (): DB => JSON.parse(JSON.stringify(db))
