import React, { useMemo, useState } from 'react'
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'
import { useDB, update, useRol, useScope } from '../../core/store'
import {
  ETAPAS, etapaDef, STATUS_LABEL, type Orden, type OrdenStatus, type LineaPresupuesto,
} from '../../core/types'
import { Icon, Modal, Field, PageHeader, StatusBadge, Empty } from '../../core/ui'
import { useAcceso } from '../../core/permisos'
import { mxn, fechaCorta, fechaHora, hoyISO, diasDesde, uid } from '../../core/format'

export default function Ordenes() {
  return (
    <Routes>
      <Route index element={<Lista />} />
      <Route path="nueva" element={<NuevaOrden />} />
      <Route path=":id" element={<Detalle />} />
    </Routes>
  )
}

// ── Lista ────────────────────────────────────────────────────────────────
function Lista() {
  const db = useDB()
  const nav = useNavigate()
  const { patio, enScope } = useScope()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('')
  const [cia, setCia] = useState<string>('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return [...db.ordenes]
      .sort((a, b) => b.folio - a.folio)
      .filter((o) => enScope(o.patio))
      .filter((o) => !status || o.status === status)
      .filter((o) => !cia || o.aseguradoraId === cia || (cia === 'PART' && o.tipoCliente === 'PARTICULAR'))
      .filter((o) => {
        if (!term) return true
        return [String(o.folio), o.torre, o.vehiculo.marca, o.vehiculo.tipo, o.vehiculo.placas, o.cliente.nombre]
          .join(' ').toLowerCase().includes(term)
      })
  }, [db.ordenes, q, status, cia, patio])

  return (
    <>
      <PageHeader
        title="Órdenes de Trabajo"
        sub={`Expediente digital de cada unidad${patio ? ` — patio ${patio}` : ' — los 3 patios'}`}
        actions={
          <Link to="nueva" className="btn btn-accent"><Icon name="plus" size={18} />Nueva orden</Link>
        }
      />
      <div className="toolbar">
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="buscar">Buscar</label>
          <input id="buscar" placeholder="Folio, torre, placas, cliente, vehículo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Field label="Estatus">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Compañía">
          <select value={cia} onChange={(e) => setCia(e.target.value)}>
            <option value="">Todas</option>
            {db.aseguradoras.map((a) => <option key={a.id} value={a.id}>{a.clave}</option>)}
            <option value="PART">Particular</option>
          </select>
        </Field>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Folio</th><th>Torre</th><th>Vehículo</th><th>Placas</th><th>Cía</th>
              <th>Cliente</th><th>Valuador</th><th>Ingreso</th><th>Días</th><th>Etapa</th><th>Estatus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="clickable" onClick={() => nav(o.id)}>
                <td style={{ fontWeight: 700, color: 'var(--rai-blue-700)' }}>{o.folio}</td>
                <td>{o.torre}</td>
                <td>{o.vehiculo.marca} {o.vehiculo.tipo} {o.vehiculo.modelo} · {o.vehiculo.color}</td>
                <td>{o.vehiculo.placas}</td>
                <td>{o.tipoCliente === 'PARTICULAR' ? 'PART' : db.aseguradoras.find((a) => a.id === o.aseguradoraId)?.clave}</td>
                <td>{o.cliente.nombre}</td>
                <td>{o.valuador}</td>
                <td>{fechaCorta(o.fechaIngreso)}</td>
                <td>{diasDesde(o.fechaIngreso)}</td>
                <td><span className="badge badge-gray">{etapaDef(o.etapa).nombre}</span></td>
                <td><StatusBadge s={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty msg="Sin órdenes que coincidan con el filtro." />}
      </div>
    </>
  )
}

// ── Wizard de recepción (digitaliza la orden + inventario + firmas) ─────
function NuevaOrden() {
  const db = useDB()
  const nav = useNavigate()
  const { patio: patioSesion, global } = useScope()
  const CHECKLIST_ITEMS = db.parametros.checklistInventario
  const [paso, setPaso] = useState(0)
  const [f, setF] = useState({
    tipoCliente: 'SEGURO' as 'SEGURO' | 'PARTICULAR',
    aseguradoraId: 'qlts', numSiniestro: '', ajustador: '',
    caracterCliente: 'ASEGURADO' as 'ASEGURADO' | 'TERCERO',
    tipoValuacion: 'REPARACION' as Orden['tipoValuacion'],
    marca: '', tipo: '', modelo: '', color: '', placas: '',
    nombre: '', telefono: '', email: '',
    combustible: 50, km: '',
    checklist: Object.fromEntries(CHECKLIST_ITEMS.map((c) => [c, true])) as Record<string, boolean>,
    firmaCliente: false, firmaInventario: false, fotos: 0, notas: '',
    torre: '', patio: patioSesion || db.config.patios[0], valuador: '',
  })
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))
  const [err, setErr] = useState('')

  const torresOcupadas = new Set(
    db.ordenes.filter((o) => !['ENTREGADO', 'FACTURADO', 'PAGADO', 'CANCELADO', 'PAGO_DANOS'].includes(o.status)).map((o) => o.torre),
  )

  const valida = (): boolean => {
    setErr('')
    if (paso === 0 && f.tipoCliente === 'SEGURO' && !f.numSiniestro.trim()) {
      setErr('Captura el número de reporte / siniestro de la ODA.')
      return false
    }
    if (paso === 1) {
      if (!f.marca || !f.tipo || !f.placas) { setErr('Marca, tipo y placas son obligatorios.'); return false }
      if (!f.nombre || !f.telefono) { setErr('Nombre y teléfono del propietario son obligatorios.'); return false }
    }
    if (paso === 2 && (!f.firmaCliente || !f.firmaInventario)) {
      setErr('Se requieren las 2 firmas del propietario (autorización + inventario).')
      return false
    }
    if (paso === 3 && (!f.torre || !f.valuador)) {
      setErr('Asigna torre y valuador.')
      return false
    }
    return true
  }

  const guardar = () => {
    if (!valida()) return
    let folio = 0
    update((d) => {
      folio = d.config.siguienteFolioOrden++
      const esTercero = f.tipoCliente === 'SEGURO' && f.caracterCliente === 'TERCERO'
      d.ordenes.push({
        id: uid(), folio, torre: f.torre, fechaIngreso: hoyISO(),
        tipoCliente: f.tipoCliente,
        aseguradoraId: f.tipoCliente === 'SEGURO' ? f.aseguradoraId : undefined,
        numSiniestro: f.numSiniestro || undefined, ajustador: f.ajustador || undefined,
        caracterCliente: f.tipoCliente === 'SEGURO' ? f.caracterCliente : undefined,
        tipoValuacion: esTercero ? 'SOLO_VALUACION' : f.tipoValuacion,
        vehiculo: { marca: f.marca.toUpperCase(), tipo: f.tipo.toUpperCase(), modelo: f.modelo, color: f.color.toUpperCase(), placas: f.placas.toUpperCase() },
        cliente: { nombre: f.nombre, telefono: f.telefono, email: f.email || undefined },
        valuador: f.valuador.toUpperCase(),
        status: esTercero ? 'PAGO_DANOS' : f.tipoCliente === 'SEGURO' ? 'VALUACION' : 'COTIZACION',
        etapa: 'PATIO', patio: f.patio,
        inventarios: [{
          fecha: hoyISO(), tipo: 'INGRESO', checklist: f.checklist, combustible: f.combustible,
          km: f.km || undefined, firmaCliente: f.firmaCliente, firmaInventario: f.firmaInventario,
          fotos: f.fotos, notas: f.notas || undefined,
        }],
        asignacionLog: [], etapasLog: [], presupuesto: [], refacciones: [],
      })
    })
    nav('/ordenes')
  }

  const pasos = ['Origen', 'Vehículo y propietario', 'Inventario y firmas', 'Registro']
  return (
    <>
      <PageHeader title="Nueva Orden de Trabajo" sub="Recepción digital: al guardar, el folio y el registro se generan automáticamente" />
      <div className="row mb-6" role="list" aria-label="Pasos">
        {pasos.map((p, i) => (
          <div key={p} role="listitem" className="row" style={{ gap: 8 }}>
            <span
              aria-current={i === paso ? 'step' : undefined}
              style={{
                width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontWeight: 700, fontSize: 'var(--fs-xs)',
                background: i <= paso ? 'var(--rai-blue-700)' : 'var(--gray-200)',
                color: i <= paso ? '#fff' : 'var(--gray-700)',
              }}
            >
              {i < paso ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <span style={{ fontWeight: i === paso ? 700 : 400, fontSize: 'var(--fs-sm)' }}>{p}</span>
            {i < pasos.length - 1 && <span style={{ color: 'var(--gray-300)' }}>—</span>}
          </div>
        ))}
      </div>

      <div className="card card-pad">
        {paso === 0 && (
          <div className="grid-2">
            <Field label="¿El auto viene por compañía de seguros o particular?">
              <select value={f.tipoCliente} onChange={(e) => set('tipoCliente', e.target.value)}>
                <option value="SEGURO">Compañía de seguros</option>
                <option value="PARTICULAR">Particular</option>
              </select>
            </Field>
            {f.tipoCliente === 'SEGURO' && (
              <>
                <Field label="Compañía de seguros">
                  <select value={f.aseguradoraId} onChange={(e) => set('aseguradoraId', e.target.value)}>
                    {db.aseguradoras.map((a) => <option key={a.id} value={a.id}>{a.nombre} ({a.clave})</option>)}
                  </select>
                </Field>
                <Field label="No. de reporte / siniestro (ODA)">
                  <input value={f.numSiniestro} onChange={(e) => set('numSiniestro', e.target.value)} placeholder="Ej. 226114532" />
                </Field>
                <Field label="Ajustador">
                  <input value={f.ajustador} onChange={(e) => set('ajustador', e.target.value)} />
                </Field>
                <Field label="¿Asegurado o tercero?">
                  <select value={f.caracterCliente} onChange={(e) => set('caracterCliente', e.target.value)}>
                    <option value="ASEGURADO">Asegurado (se repara)</option>
                    <option value="TERCERO">Tercero (pago de daños — solo valuación)</option>
                  </select>
                </Field>
                {f.caracterCliente === 'ASEGURADO' && (
                  <Field label="Tipo de valuación">
                    <select value={f.tipoValuacion} onChange={(e) => set('tipoValuacion', e.target.value)}>
                      <option value="REPARACION">Valuación p/ reparación</option>
                      <option value="TRANSITAR">Valuación p/ transitar (se cita después)</option>
                      <option value="DANOS_SE_QUEDA">Valuación por daños, se queda (llegó en grúa)</option>
                    </select>
                  </Field>
                )}
              </>
            )}
          </div>
        )}

        {paso === 1 && (
          <div className="grid-3">
            <Field label="Marca"><input value={f.marca} onChange={(e) => set('marca', e.target.value)} placeholder="NISSAN" /></Field>
            <Field label="Tipo / submarca"><input value={f.tipo} onChange={(e) => set('tipo', e.target.value)} placeholder="VERSA" /></Field>
            <Field label="Modelo (año)"><input value={f.modelo} onChange={(e) => set('modelo', e.target.value)} placeholder="2022" /></Field>
            <Field label="Color"><input value={f.color} onChange={(e) => set('color', e.target.value)} placeholder="BLANCO" /></Field>
            <Field label="Placas"><input value={f.placas} onChange={(e) => set('placas', e.target.value)} placeholder="AHM-201C" /></Field>
            <Field label="Kilometraje"><input value={f.km} onChange={(e) => set('km', e.target.value)} placeholder="45,200" /></Field>
            <Field label="Nombre del propietario"><input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} /></Field>
            <Field label="Teléfono(s)"><input value={f.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="449 …" /></Field>
            <Field label="Correo electrónico"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          </div>
        )}

        {paso === 2 && (
          <>
            <p className="muted mb-4" style={{ marginBottom: 'var(--sp-4)' }}>
              Checklist de interiores, exteriores y herramienta. Las firmas se capturan en pantalla
              (tableta o pluma touch) y la copia se envía por correo o WhatsApp — ya no se fotocopia.
            </p>
            <div className="grid-3">
              {CHECKLIST_ITEMS.map((c) => (
                <label key={c} className="row" style={{ gap: 8, minHeight: 44, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={f.checklist[c]}
                    onChange={(e) => set('checklist', { ...f.checklist, [c]: e.target.checked })}
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{ fontSize: 'var(--fs-sm)' }}>{c}</span>
                </label>
              ))}
            </div>
            <div className="grid-3 mt-4">
              <Field label={`Combustible: ${f.combustible}%`}>
                <input type="range" min={0} max={100} step={5} value={f.combustible} onChange={(e) => set('combustible', +e.target.value)} />
              </Field>
              <Field label="Fotos de ingreso (carpeta)">
                <div className="row">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => set('fotos', f.fotos + 1)}>
                    <Icon name="camera" size={16} /> Tomar foto
                  </button>
                  <span className="badge badge-blue">{f.fotos} fotos</span>
                </div>
              </Field>
              <Field label="Notas del inventario">
                <input value={f.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Rayón previo en fascia…" />
              </Field>
            </div>
            <div className="row mt-4">
              {[
                ['firmaCliente', 'Firma de autorización de reparación'],
                ['firmaInventario', 'Firma de aceptación del inventario'],
              ].map(([k, label]) => (
                <button
                  key={k} type="button"
                  className={`btn ${f[k as 'firmaCliente'] ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => set(k, !f[k as 'firmaCliente'])}
                >
                  <Icon name="pen" size={16} />
                  {label} {f[k as 'firmaCliente'] ? '· Capturada' : ''}
                </button>
              ))}
            </div>
          </>
        )}

        {paso === 3 && (
          <div className="grid-3">
            <Field label="Torre (control de patio)">
              <select value={f.torre} onChange={(e) => set('torre', e.target.value)}>
                <option value="">— Selecciona —</option>
                {db.config.torres.map((t) => (
                  <option key={t} value={t} disabled={torresOcupadas.has(t)}>
                    {t}{torresOcupadas.has(t) ? ' (ocupada)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={global ? 'Patio de trabajo' : `Patio de trabajo (asignado a tu sesión)`}>
              <select value={f.patio} onChange={(e) => set('patio', e.target.value)} disabled={!global}>
                {db.config.patios.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Valuador (iniciales)">
              <input value={f.valuador} onChange={(e) => set('valuador', e.target.value)} placeholder="OR / JZ / RR" />
            </Field>
            <div style={{ gridColumn: '1 / -1' }} className="muted">
              El folio de orden se asigna automáticamente (siguiente: <strong>{db.config.siguienteFolioOrden}</strong>).
              La hoja de control de parabrisas se imprime desde el expediente, ya con torre y código QR.
            </div>
          </div>
        )}

        {err && <p className="error mt-4" role="alert" style={{ color: 'var(--danger-600)', fontWeight: 600 }}>{err}</p>}

        <div className="row-between mt-6">
          <button className="btn btn-ghost" onClick={() => (paso === 0 ? nav('/ordenes') : setPaso(paso - 1))}>
            <Icon name="back" size={16} /> {paso === 0 ? 'Cancelar' : 'Anterior'}
          </button>
          {paso < 3 ? (
            <button className="btn btn-primary" onClick={() => valida() && setPaso(paso + 1)}>
              Siguiente <Icon name="arrow-right" size={16} />
            </button>
          ) : (
            <button className="btn btn-accent" onClick={guardar}>
              <Icon name="check" size={18} /> Registrar orden
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Detalle / Expediente ────────────────────────────────────────────────
function Detalle() {
  const { id } = useParams()
  const db = useDB()
  const rol = useRol()
  const { enScope } = useScope()
  const nav = useNavigate()
  const acc = useAcceso()
  const o = db.ordenes.find((x) => x.id === id)
  const [modalLinea, setModalLinea] = useState(false)

  if (!o) return <Empty msg="Orden no encontrada." />
  if (!enScope(o.patio))
    return <Empty msg={`Esta orden pertenece al patio ${o.patio}. Tu sesión solo tiene acceso a su patio asignado.`} />

  // Permisos por campo (configurables en Administración)
  const verCostos = acc('ordenes.costos') !== 'OCULTO'
  const verMargen = acc('ordenes.margen') !== 'OCULTO'
  const editarPpto = acc('ordenes.presupuesto') === 'EDITAR'
  const verCliente = acc('ordenes.cliente') !== 'OCULTO'
  const cia = db.aseguradoras.find((a) => a.id === o.aseguradoraId)
  const valesOrden = db.vales.filter((v) => v.ordenId === o.id)
  const totalVenta = o.presupuesto.filter((l) => l.autorizada !== 'RECHAZADA').reduce((s, l) => s + l.venta, 0)
  const totalCosto = o.presupuesto.filter((l) => l.autorizada !== 'RECHAZADA').reduce((s, l) => s + l.costo, 0)

  const setStatus = (s: OrdenStatus) => update((d) => { d.ordenes.find((x) => x.id === o.id)!.status = s })

  const autorizarLineas = () =>
    update((d) => {
      d.ordenes.find((x) => x.id === o.id)!.presupuesto.forEach((l) => {
        if (l.autorizada === 'PENDIENTE') l.autorizada = 'AUTORIZADA'
      })
      const ord = d.ordenes.find((x) => x.id === o.id)!
      if (ord.status === 'COTIZACION' || ord.status === 'VALUACION') {
        ord.status = ord.refacciones.some((r) => !r.recibida) ? 'ESPERA_REFACCIONES' : 'EN_PROCESO'
        ord.autorizacionCliente = { fecha: hoyISO(), medio: ord.tipoCliente === 'SEGURO' ? 'PORTAL' : 'WHATSAPP' }
      }
    })

  const marcarRefaccion = (i: number) =>
    update((d) => {
      const ord = d.ordenes.find((x) => x.id === o.id)!
      ord.refacciones[i].recibida = true
      ord.refacciones[i].estadoOk = true
      if (ord.refacciones.every((r) => r.recibida) && ord.status === 'ESPERA_REFACCIONES') ord.status = 'EN_PROCESO'
    })

  const entregar = () =>
    update((d) => {
      const ord = d.ordenes.find((x) => x.id === o.id)!
      ord.status = 'ENTREGADO'
      ord.finiquitoFirmado = true
      ord.etapasLog.push({ etapa: 'ENTREGA', fecha: hoyISO(), usuario: rol })
      ord.etapa = 'ENTREGA'
    })

  return (
    <>
      <PageHeader
        title={`OT ${o.folio} · ${o.torre}`}
        sub={`${o.vehiculo.marca} ${o.vehiculo.tipo} ${o.vehiculo.modelo} ${o.vehiculo.color} · ${o.vehiculo.placas}`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => nav('/ordenes')}><Icon name="back" size={16} /> Órdenes</button>
            {o.status === 'EN_PROCESO' && o.etapa === 'ENTREGA' && (
              <button className="btn btn-accent" onClick={entregar}><Icon name="check" size={16} /> Entregar y firmar finiquito</button>
            )}
            {o.status === 'ENTREGADO' && (
              <button className="btn btn-primary" onClick={() => nav('/facturacion')}>Enviar a facturación</button>
            )}
          </>
        }
      />

      <div className="grid-3 mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card card-pad">
          <h3 className="section-title">Expediente</h3>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 'var(--fs-sm)' }}>
            <dt className="muted">Estatus</dt><dd style={{ margin: 0 }}><StatusBadge s={o.status} /></dd>
            <dt className="muted">Etapa</dt><dd style={{ margin: 0 }}>{etapaDef(o.etapa).nombre}</dd>
            <dt className="muted">Ingreso</dt><dd style={{ margin: 0 }}>{fechaCorta(o.fechaIngreso)} · {diasDesde(o.fechaIngreso)} días</dd>
            <dt className="muted">Origen</dt>
            <dd style={{ margin: 0 }}>
              {o.tipoCliente === 'SEGURO' ? `${cia?.nombre ?? ''} · ${o.caracterCliente ?? ''}` : 'Particular'}
            </dd>
            {o.numSiniestro && (<><dt className="muted">Siniestro</dt><dd style={{ margin: 0 }}>{o.numSiniestro}</dd></>)}
            {o.ajustador && (<><dt className="muted">Ajustador</dt><dd style={{ margin: 0 }}>{o.ajustador}</dd></>)}
            <dt className="muted">Patio</dt><dd style={{ margin: 0 }}>{o.patio} · Valuador {o.valuador}</dd>
            {o.garantiaDe && (<><dt className="muted">Garantía de</dt><dd style={{ margin: 0 }}>OT {o.garantiaDe}</dd></>)}
          </dl>
          {o.comentarios && <p className="muted mt-2" style={{ marginTop: 'var(--sp-2)' }}>{o.comentarios}</p>}
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Propietario</h3>
          <p style={{ fontWeight: 700 }}>{o.cliente.nombre}</p>
          {verCliente ? (
            <p className="muted">{o.cliente.telefono}{o.cliente.email ? ` · ${o.cliente.email}` : ''}</p>
          ) : (
            <p className="muted" style={{ fontStyle: 'italic' }}>Datos de contacto ocultos para tu rol</p>
          )}
          {verCliente && (
            <div className="row mt-4">
              <button className="btn btn-outline btn-sm" onClick={() => alert(`Demo: se enviaría la copia de la orden y avisos de avance a ${o.cliente.telefono} por WhatsApp.`)}>
                Enviar copia por WhatsApp
              </button>
            </div>
          )}
          <h3 className="section-title mt-4" style={{ marginTop: 'var(--sp-4)' }}>Inventarios</h3>
          {o.inventarios.map((inv, i) => (
            <div key={i} className="row-between" style={{ fontSize: 'var(--fs-sm)', padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>{inv.tipo} · {fechaCorta(inv.fecha)}</span>
              <span className="row" style={{ gap: 6 }}>
                <span className="badge badge-blue"><Icon name="camera" size={12} /> {inv.fotos}</span>
                <span className={`badge ${inv.firmaCliente && inv.firmaInventario ? 'badge-green' : 'badge-red'}`}>
                  {inv.firmaCliente && inv.firmaInventario ? '2 firmas' : 'Faltan firmas'}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <h3 className="section-title">Técnicos asignados</h3>
          {(['hojalateroId', 'pintorId', 'mecanicoId'] as const).map((k) => {
            const t = db.tecnicos.find((x) => x.id === o[k])
            const label = k === 'hojalateroId' ? 'Hojalatero' : k === 'pintorId' ? 'Pintor' : 'Mecánico'
            return (
              <div key={k} className="row-between" style={{ padding: '6px 0', fontSize: 'var(--fs-sm)' }}>
                <span className="muted">{label}</span>
                <span style={{ fontWeight: 600 }}>{t?.nombre ?? '— sin asignar —'}</span>
              </div>
            )
          })}
          {o.asignacionLog.length > 0 && (
            <>
              <h4 style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', color: 'var(--gray-500)', marginTop: 'var(--sp-3)' }}>
                <Icon name="history" size={13} /> Log de reasignaciones
              </h4>
              {o.asignacionLog.map((l, i) => (
                <p key={i} className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                  {fechaCorta(l.fecha)} · {l.rol}: {db.tecnicos.find((t) => t.id === l.deId)?.nombre ?? '—'} → {db.tecnicos.find((t) => t.id === l.aId)?.nombre}. {l.motivo} ({l.usuario})
                </p>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="card card-pad mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="row-between mb-4" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3 className="section-title">Presupuesto / Valuación</h3>
          {editarPpto && (
            <div className="row">
              {o.presupuesto.some((l) => l.autorizada === 'PENDIENTE') && (
                <button className="btn btn-primary btn-sm" onClick={autorizarLineas}>
                  <Icon name="check" size={16} /> Registrar autorización {o.tipoCliente === 'SEGURO' ? 'de la CIA' : 'del cliente'}
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setModalLinea(true)}>
                <Icon name="plus" size={16} /> Agregar concepto
              </button>
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Concepto</th><th>Área</th><th>Operación</th>
                {verCostos && <th>Costo</th>}<th>Venta</th><th>Autorización</th>
              </tr>
            </thead>
            <tbody>
              {o.presupuesto.map((l, i) => (
                <tr key={i}>
                  <td>{l.concepto}</td>
                  <td><span className="badge badge-gray">{l.area}</span></td>
                  <td>{l.operacion}</td>
                  {verCostos && <td>{mxn(l.costo)}</td>}
                  <td style={{ fontWeight: 600 }}>{mxn(l.venta)}</td>
                  <td>
                    <span className={`badge ${l.autorizada === 'AUTORIZADA' ? 'badge-green' : l.autorizada === 'RECHAZADA' ? 'badge-red' : l.autorizada === 'COMPLEMENTO' ? 'badge-blue' : 'badge-yellow'}`}>
                      {l.autorizada}
                    </span>
                  </td>
                </tr>
              ))}
              {o.presupuesto.length > 0 && (
                <tr style={{ fontWeight: 800 }}>
                  <td colSpan={3}>Totales (sin rechazadas)</td>
                  {verCostos && <td>{mxn(totalCosto)}</td>}
                  <td style={{ color: 'var(--rai-blue-700)' }}>{mxn(totalVenta)}</td>
                  <td>{verMargen && totalVenta > 0 && <span className="muted">margen {Math.round(((totalVenta - totalCosto) / totalVenta) * 100)}%</span>}</td>
                </tr>
              )}
            </tbody>
          </table>
          {o.presupuesto.length === 0 && <Empty msg="Aún no hay conceptos. El valuador captura aquí los daños de la ODA con fotos de peritaje." />}
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Refacciones</h3>
          {o.refacciones.length === 0 && <p className="muted">Sin refacciones para esta orden.</p>}
          {o.refacciones.map((r, i) => (
            <div key={i} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{r.descripcion}</div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                  {db.proveedores.find((p) => p.id === r.proveedorId)?.nombre ?? 'Proveedor por asignar'} · {r.origen}{verCostos ? ` · ${mxn(r.costo)}` : ''}
                  {r.fechaPromesa && !r.recibida && ` · promesa ${fechaCorta(r.fechaPromesa)}`}
                </div>
              </div>
              {r.recibida ? (
                <span className="badge badge-green">Recibida</span>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={() => marcarRefaccion(i)}>
                  <Icon name="truck" size={14} /> Recibir
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <h3 className="section-title mb-4" style={{ marginBottom: 'var(--sp-4)' }}>Vales de esta orden</h3>
          {valesOrden.length === 0 && <p className="muted">Sin vales ligados. Se crean desde el módulo Vales.</p>}
          {valesOrden.map((v) => (
            <div key={v.id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 'var(--fs-sm)' }}>
              <span><strong>#{v.folio}</strong> · {v.descripcion}</span>
              <span style={{ fontWeight: 600 }}>{mxn(v.monto)}</span>
            </div>
          ))}
          <h3 className="section-title mt-6" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-2)' }}>Bitácora de etapas</h3>
          {o.etapasLog.length === 0 && <p className="muted">Sin avances registrados.</p>}
          {[...o.etapasLog].reverse().map((l, i) => (
            <p key={i} style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-700)', padding: '3px 0' }}>
              <strong>{etapaDef(l.etapa).nombre}</strong> · {fechaHora(l.fecha)}
              {l.tecnicoId && ` · ${db.tecnicos.find((t) => t.id === l.tecnicoId)?.nombre}`} · {l.usuario}
            </p>
          ))}
        </div>
      </div>

      {modalLinea && <ModalLinea ordenId={o.id} onClose={() => setModalLinea(false)} />}
    </>
  )
}

function ModalLinea({ ordenId, onClose }: { ordenId: string; onClose: () => void }) {
  const [l, setL] = useState<LineaPresupuesto>({
    concepto: '', area: 'HOJALATERIA', operacion: 'REPARACION', costo: 0, venta: 0, autorizada: 'PENDIENTE',
  })
  return (
    <Modal title="Agregar concepto al presupuesto" onClose={onClose}>
      <div className="grid-2">
        <Field label="Concepto">
          <input value={l.concepto} onChange={(e) => setL({ ...l, concepto: e.target.value })} placeholder="Laminado puerta del. izq." />
        </Field>
        <Field label="Área">
          <select value={l.area} onChange={(e) => setL({ ...l, area: e.target.value as LineaPresupuesto['area'] })}>
            {['HOJALATERIA', 'PINTURA', 'MECANICA', 'TOT', 'REFACCION'].map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Operación">
          <select value={l.operacion} onChange={(e) => setL({ ...l, operacion: e.target.value as 'REPARACION' | 'CAMBIO' })}>
            <option value="REPARACION">Reparación</option>
            <option value="CAMBIO">Cambio</option>
          </select>
        </Field>
        <Field label="Costo (taller)">
          <input type="number" min={0} value={l.costo || ''} onChange={(e) => setL({ ...l, costo: +e.target.value })} />
        </Field>
        <Field label="Precio de venta">
          <input type="number" min={0} value={l.venta || ''} onChange={(e) => setL({ ...l, venta: +e.target.value })} />
        </Field>
      </div>
      <div className="row-between mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!l.concepto || l.venta <= 0}
          onClick={() => {
            update((d) => d.ordenes.find((x) => x.id === ordenId)!.presupuesto.push(l))
            onClose()
          }}
        >
          <Icon name="plus" size={16} /> Agregar
        </button>
      </div>
    </Modal>
  )
}
