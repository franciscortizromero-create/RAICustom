import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB, useScope } from '../core/store'
import { modulosPara } from '../core/registry'
import { Icon } from '../core/ui'
import { STATUS_LABEL } from '../core/types'
import { mxn, fechaCorta } from '../core/format'

interface Hit {
  id: string
  grupo: string
  icon: string
  titulo: string
  sub: string
  path: string
}

// Busca en todos los registros del sistema, respetando el patio de la sesión
// y los módulos visibles para el rol. Cada resultado lleva a su pantalla.
function buscar(
  db: ReturnType<typeof useDB>,
  enScope: (p?: string) => boolean,
  modIds: Set<string>,
  termRaw: string,
): Hit[] {
  const term = termRaw.trim().toLowerCase()
  if (term.length < 2) return []
  const match = (...campos: (string | number | undefined)[]) =>
    campos.filter(Boolean).join(' ').toLowerCase().includes(term)
  const out: Hit[] = []
  const cap = 6

  if (modIds.has('ordenes')) {
    for (const o of db.ordenes) {
      if (!enScope(o.patio)) continue
      if (match(o.folio, o.torre, o.vehiculo.marca, o.vehiculo.tipo, o.vehiculo.placas, o.cliente.nombre, o.numSiniestro)) {
        out.push({
          id: 'o' + o.id, grupo: 'Órdenes de trabajo', icon: 'clipboard',
          titulo: `OT ${o.folio} · ${o.torre}`,
          sub: `${o.vehiculo.marca} ${o.vehiculo.tipo} · ${o.vehiculo.placas} · ${o.cliente.nombre} · ${STATUS_LABEL[o.status]}`,
          path: `/ordenes/${o.id}`,
        })
      }
      if (out.filter((h) => h.grupo === 'Órdenes de trabajo').length >= cap) break
    }
  }
  if (modIds.has('vales')) {
    for (const v of db.vales) {
      const o = db.ordenes.find((x) => x.id === v.ordenId)
      if (!enScope(o?.patio ?? v.patio)) continue
      const prov = db.proveedores.find((p) => p.id === v.proveedorId)
      if (match(v.folio, v.descripcion, v.detalle, prov?.nombre, o?.folio)) {
        out.push({
          id: 'v' + v.id, grupo: 'Vales', icon: 'ticket',
          titulo: `Vale #${v.folio} · ${mxn(v.monto)}`,
          sub: `${v.descripcion} · ${prov?.nombre ?? ''}${o ? ` · OT ${o.folio}` : ''}`,
          path: '/vales',
        })
      }
      if (out.filter((h) => h.grupo === 'Vales').length >= cap) break
    }
  }
  if (modIds.has('almacen')) {
    for (const m of db.materiales) {
      if (!enScope(m.almacen)) continue
      if (match(m.nombre, m.almacen)) {
        out.push({
          id: 'm' + m.id, grupo: 'Almacén', icon: 'box',
          titulo: m.nombre,
          sub: `${m.existencia} ${m.unidad} · ${m.almacen}${m.existencia < m.minimo ? ' · bajo mínimo' : ''}`,
          path: '/almacen',
        })
      }
    }
  }
  if (modIds.has('citas')) {
    for (const c of db.citas) {
      const o = db.ordenes.find((x) => x.id === c.ordenId)
      if (!enScope(o?.patio)) continue
      if (match(o?.folio, o?.vehiculo.marca, o?.vehiculo.tipo, o?.cliente.nombre, c.fecha)) {
        out.push({
          id: 'c' + c.id, grupo: 'Citas', icon: 'calendar',
          titulo: `${fechaCorta(c.fecha)} ${c.hora} · OT ${o?.folio ?? ''}`,
          sub: `${o?.vehiculo.marca ?? ''} ${o?.vehiculo.tipo ?? ''} · ${o?.cliente.nombre ?? ''}`,
          path: '/citas',
        })
      }
    }
  }
  if (modIds.has('facturacion')) {
    for (const f of db.facturas) {
      const o = db.ordenes.find((x) => x.id === f.ordenId)
      if (!enScope(o?.patio)) continue
      if (match(f.folio, f.cliente, o?.folio)) {
        out.push({
          id: 'f' + f.id, grupo: 'Facturas', icon: 'invoice',
          titulo: `${f.folio} · ${mxn(f.monto)}`,
          sub: `${f.cliente}${o ? ` · OT ${o.folio}` : ''}`,
          path: '/facturacion',
        })
      }
    }
  }
  if (modIds.has('cxp')) {
    for (const cr of db.contraRecibos) {
      const prov = db.proveedores.find((p) => p.id === cr.proveedorId)
      if (match(cr.folio, prov?.nombre, ...cr.facturas.map((x) => x.numFactura))) {
        out.push({
          id: 'cr' + cr.id, grupo: 'Cuentas por pagar', icon: 'bank',
          titulo: `CR-${cr.folio} · ${prov?.nombre ?? ''}`,
          sub: cr.facturas.map((x) => x.numFactura).join(', '),
          path: '/cuentas-por-pagar',
        })
      }
    }
  }
  if (modIds.has('admin')) {
    for (const u of db.usuarios) {
      if (match(u.nombre, u.email, u.rol)) {
        out.push({
          id: 'u' + u.id, grupo: 'Personal', icon: 'user',
          titulo: u.nombre, sub: `${u.rol}${u.patio ? ` · ${u.patio}` : ' · 3 patios'}`,
          path: '/admin',
        })
      }
    }
  }
  if (modIds.has('catalogos') || modIds.has('admin')) {
    const destino = modIds.has('admin') ? '/admin' : '/catalogos'
    for (const p of db.proveedores) {
      if (match(p.nombre, p.giro, p.telefono)) {
        out.push({ id: 'p' + p.id, grupo: 'Proveedores', icon: 'truck', titulo: p.nombre, sub: `${p.giro} · ${p.diasCredito} días crédito`, path: destino })
      }
    }
  }
  return out
}

export default function GlobalSearch() {
  const db = useDB()
  const { rol, custom, enScope } = useScope()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const modIds = useMemo(() => new Set(modulosPara(rol, db.permisos, custom).map((m) => m.id)), [rol, db.permisos, custom])
  const hits = useMemo(() => buscar(db, enScope, modIds, q), [db, q, modIds])

  // Ctrl/Cmd+K enfoca el buscador
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setAbierto(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => setSel(0), [q])

  const ir = (h: Hit) => {
    nav(h.path)
    setQ('')
    setAbierto(false)
    inputRef.current?.blur()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setAbierto(false); inputRef.current?.blur() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && hits[sel]) ir(hits[sel])
  }

  // Agrupar manteniendo el orden e índices para la selección con teclado
  const grupos: { nombre: string; items: { hit: Hit; idx: number }[] }[] = []
  hits.forEach((hit, idx) => {
    let g = grupos.find((x) => x.nombre === hit.grupo)
    if (!g) { g = { nombre: hit.grupo, items: [] }; grupos.push(g) }
    g.items.push({ hit, idx })
  })

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-input">
        <span style={{ color: 'var(--gray-500)' }}><Icon name="search" size={20} /></span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onKeyDown={onKey}
          placeholder="Buscar órdenes, vales, materiales, personal…"
          aria-label="Buscador global"
          role="combobox" aria-expanded={abierto} aria-controls="search-panel"
        />
        <span className="kbd">Ctrl K</span>
      </div>
      {abierto && q.trim().length >= 2 && (
        <div className="search-panel" id="search-panel" role="listbox">
          {hits.length === 0 && <div className="search-empty">Sin resultados para “{q}”.</div>}
          {grupos.map((g) => (
            <div key={g.nombre}>
              <div className="search-group-label">{g.nombre}</div>
              {g.items.map(({ hit, idx }) => (
                <button
                  key={hit.id}
                  className={`search-item ${idx === sel ? 'sel' : ''}`}
                  role="option" aria-selected={idx === sel}
                  onMouseEnter={() => setSel(idx)}
                  onClick={() => ir(hit)}
                >
                  <span className="si"><Icon name={hit.icon as never} size={18} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="st" style={{ display: 'block' }}>{hit.titulo}</span>
                    <span className="ss" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hit.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
