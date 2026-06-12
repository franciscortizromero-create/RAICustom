import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB, update, useRol, useScope } from '../../core/store'
import { ETAPAS, etapaDef, type EtapaId, type Orden } from '../../core/types'
import { cargaTecnico, pctDeEtapa } from '../../core/productividad'
import { Icon, Modal, Field, PageHeader } from '../../core/ui'
import { hoyISO, diasDesde, fechaCorta } from '../../core/format'

const PUEDE_INSPECCIONAR = ['GERENTE', 'SUBGERENTE', 'JEFE_TALLER']

export default function Taller() {
  const db = useDB()
  const rol = useRol()
  const { patio: patioSesion, global } = useScope()
  const [patioFiltro, setPatioFiltro] = useState('')
  const [sel, setSel] = useState<string | null>(null)

  // Roles no globales solo ven su patio; los globales pueden filtrar
  const patio = global ? patioSesion || patioFiltro : patioSesion

  const activas = useMemo(
    () =>
      db.ordenes.filter(
        (o) => ['EN_PROCESO', 'GARANTIA', 'ESPERA_REFACCIONES', 'CITADO'].includes(o.status) && (!patio || o.patio === patio),
      ),
    [db.ordenes, patio],
  )

  const orden = sel ? db.ordenes.find((o) => o.id === sel) : null

  return (
    <>
      <PageHeader
        title="Piso de Taller"
        sub={`Avance de etapas en tiempo real${patio ? ` — patio ${patio}` : ' — los 3 patios'}`}
        actions={
          global && !patioSesion ? (
            <Field label="Patio">
              <select value={patioFiltro} onChange={(e) => setPatioFiltro(e.target.value)}>
                <option value="">Todos</option>
                {db.config.patios.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          ) : undefined
        }
      />
      <div className="kanban" role="list" aria-label="Etapas del taller">
        {ETAPAS.map((et) => {
          const cards = activas.filter((o) => o.etapa === et.id)
          return (
            <div key={et.id} className="kanban-col" role="listitem">
              <header>
                <span>{et.nombre}{pctDeEtapa(db, et.id) ? ` · ${pctDeEtapa(db, et.id)}%` : ''}</span>
                <span className="badge badge-navy">{cards.length}</span>
              </header>
              {cards.map((o) => {
                const dias = diasDesde(o.fechaIngreso)
                const cls = dias > 15 ? 'late' : dias > 8 ? 'warn' : ''
                return (
                  <button
                    key={o.id}
                    className={`kanban-card ${cls}`}
                    style={{ width: '100%', textAlign: 'left', font: 'inherit' }}
                    onClick={() => setSel(o.id)}
                  >
                    <div className="row-between">
                      <strong style={{ color: 'var(--rai-blue-700)' }}>{o.folio}</strong>
                      <span className="badge badge-gray">{o.torre}</span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                      {o.vehiculo.marca} {o.vehiculo.tipo} · {o.vehiculo.color}
                    </div>
                    <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                      {o.patio} · {dias} días en taller
                      {o.status === 'GARANTIA' && ' · GARANTÍA'}
                      {o.status === 'ESPERA_REFACCIONES' && ' · espera refacciones'}
                      {o.status === 'CITADO' && ' · citado'}
                    </div>
                  </button>
                )
              })}
              {cards.length === 0 && <p className="muted" style={{ fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 'var(--sp-2)' }}>—</p>}
            </div>
          )
        })}
      </div>
      <p className="muted mt-2">
        Semáforo: borde azul al corriente · amarillo &gt;8 días · rojo &gt;15 días en taller.
      </p>
      {orden && <ModalOrden o={orden} onClose={() => setSel(null)} rol={rol} />}
    </>
  )
}

function ModalOrden({ o, onClose, rol }: { o: Orden; onClose: () => void; rol: string }) {
  const db = useDB()
  const idx = ETAPAS.findIndex((e) => e.id === o.etapa)
  const actual = etapaDef(o.etapa)
  const siguientes = ETAPAS.slice(idx + 1)
  const [destino, setDestino] = useState<EtapaId>(siguientes[0]?.id ?? 'ENTREGA')
  const [reasignando, setReasignando] = useState<null | 'HOJALATERO' | 'PINTOR' | 'MECANICO'>(null)
  const [nuevoTec, setNuevoTec] = useState('')
  const [motivo, setMotivo] = useState('')

  const keyDe = (r: string) => (r === 'HOJALATERO' ? 'hojalateroId' : r === 'PINTOR' ? 'pintorId' : 'mecanicoId') as
    | 'hojalateroId' | 'pintorId' | 'mecanicoId'

  // El técnico responsable de la etapa actual (cobra la productividad al completarla)
  const tecnicoEtapa =
    actual.rolTecnico === 'HOJALATERO' ? o.hojalateroId
    : actual.rolTecnico === 'PINTOR' ? o.pintorId
    : actual.rolTecnico === 'MECANICO' ? o.mecanicoId
    : actual.rolTecnico === 'LAVADOR' ? db.tecnicos.find((t) => t.rol === 'LAVADOR')?.id
    : undefined

  const esInspeccion = !!actual.esInspeccion
  const bloqueadoPorRol = esInspeccion && !PUEDE_INSPECCIONAR.includes(rol)
  const faltaTecnico = !!actual.rolTecnico && !tecnicoEtapa

  const avanzar = () => {
    update((d) => {
      const ord = d.ordenes.find((x) => x.id === o.id)!
      ord.etapasLog.push({ etapa: o.etapa, fecha: hoyISO(), usuario: rol, tecnicoId: tecnicoEtapa })
      ord.etapa = destino
      if (ord.status === 'CITADO' || ord.status === 'ESPERA_REFACCIONES') ord.status = 'EN_PROCESO'
    })
    onClose()
  }

  const guardarAsignacion = () => {
    if (!nuevoTec || !reasignando) return
    const key = keyDe(reasignando)
    const anterior = o[key]
    if (anterior && !motivo.trim()) return
    update((d) => {
      const ord = d.ordenes.find((x) => x.id === o.id)!
      ord[key] = nuevoTec
      if (anterior) {
        ord.asignacionLog.push({ fecha: hoyISO(), rol: reasignando, deId: anterior, aId: nuevoTec, motivo, usuario: rol })
      }
    })
    setReasignando(null)
    setNuevoTec('')
    setMotivo('')
  }

  return (
    <Modal title={`OT ${o.folio} · ${o.vehiculo.marca} ${o.vehiculo.tipo} · ${o.torre}`} onClose={onClose} wide>
      <div className="grid-2">
        <div>
          <h4 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>Avanzar etapa</h4>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Etapa actual: <strong>{actual.nombre}</strong>
            {pctDeEtapa(db, actual.id) ? ` (genera ${pctDeEtapa(db, actual.id)}% de productividad al completarse)` : ''}
          </p>
          {faltaTecnico && (
            <p style={{ color: 'var(--danger-600)', fontWeight: 600, fontSize: 'var(--fs-sm)' }} role="alert">
              Asigna primero el {actual.rolTecnico?.toLowerCase()} para poder completar esta etapa.
            </p>
          )}
          {bloqueadoPorRol && (
            <p style={{ color: 'var(--warn-700)', fontWeight: 600, fontSize: 'var(--fs-sm)' }} role="alert">
              Las inspecciones de calidad solo las aprueba Gerente, Subgerente o Jefe de Taller. Cambia el rol activo para aprobar.
            </p>
          )}
          <div className="row mt-4" style={{ alignItems: 'end' }}>
            <Field label="Pasar a">
              <select value={destino} onChange={(e) => setDestino(e.target.value as EtapaId)}>
                {siguientes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <button className="btn btn-primary" disabled={bloqueadoPorRol || faltaTecnico} onClick={avanzar}>
              <Icon name="arrow-right" size={16} /> Completar y avanzar
            </button>
          </div>
          <p className="muted mt-2" style={{ fontSize: 'var(--fs-xs)' }}>
            Las áreas que no apliquen (mecánica, TOT) pueden saltarse eligiendo la etapa destino.
          </p>

          <h4 className="section-title mt-6" style={{ fontSize: 'var(--fs-md)', marginTop: 'var(--sp-6)' }}>Bitácora reciente</h4>
          {[...o.etapasLog].slice(-5).reverse().map((l, i) => (
            <p key={i} style={{ fontSize: 'var(--fs-xs)', padding: '2px 0', color: 'var(--gray-700)' }}>
              <strong>{etapaDef(l.etapa).nombre}</strong> · {fechaCorta(l.fecha)}
              {l.tecnicoId ? ` · ${db.tecnicos.find((t) => t.id === l.tecnicoId)?.nombre}` : ''}
            </p>
          ))}
          <Link to={`/ordenes/${o.id}`} className="btn btn-ghost btn-sm mt-2">Ver expediente completo</Link>
        </div>

        <div>
          <h4 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>Técnicos</h4>
          {(['HOJALATERO', 'PINTOR', 'MECANICO'] as const).map((r) => {
            const key = keyDe(r)
            const t = db.tecnicos.find((x) => x.id === o[key])
            return (
              <div key={r} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', fontWeight: 700 }}>{r}</div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                    {t ? `${t.nombre} · carga: ${cargaTecnico(db, t.id)} unidades` : '— sin asignar —'}
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => { setReasignando(r); setNuevoTec('') }}>
                  {t ? 'Reasignar' : 'Asignar'}
                </button>
              </div>
            )
          })}

          {reasignando && (
            <div className="mt-4" style={{ background: 'var(--rai-blue-50)', borderRadius: 'var(--radius)', padding: 'var(--sp-4)' }}>
              <Field label={`Nuevo ${reasignando.toLowerCase()} (se muestra su carga actual)`}>
                <select value={nuevoTec} onChange={(e) => setNuevoTec(e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {db.tecnicos
                    .filter((t) => t.rol === reasignando && t.activo)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} · {t.patio} · {cargaTecnico(db, t.id)} en proceso
                      </option>
                    ))}
                </select>
              </Field>
              {o[keyDe(reasignando)] && (
                <div className="mt-2">
                  <Field label="Motivo de la reasignación (obligatorio, queda en bitácora)">
                    <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Carga de trabajo, ausencia…" />
                  </Field>
                </div>
              )}
              <div className="row mt-4">
                <button className="btn btn-primary btn-sm" disabled={!nuevoTec || (!!o[keyDe(reasignando)] && !motivo.trim())} onClick={guardarAsignacion}>
                  <Icon name="check" size={14} /> Guardar
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setReasignando(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
