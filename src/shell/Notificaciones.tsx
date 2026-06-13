import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDB, useScope } from '../core/store'
import { alertas } from '../core/registry'
import { Icon } from '../core/ui'

export default function Notificaciones() {
  const db = useDB()
  const { patio } = useScope()
  const nav = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const avisos = alertas(db, patio) ?? []
  const rojos = avisos.filter((a) => a.tone === 'red').length

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button className="hamburger" onClick={() => setAbierto((v) => !v)} aria-label={`Notificaciones (${avisos.length})`} style={{ position: 'relative' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.2 6 1.8 6.6a.6.6 0 0 1-.4 1H4.6a.6.6 0 0 1-.4-1C4.8 15 6 13.5 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {avisos.length > 0 && (
          <span aria-hidden="true" style={{
            position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, padding: '0 4px',
            borderRadius: 999, background: rojos ? 'var(--danger-600)' : 'var(--rai-yellow-500)',
            color: rojos ? '#fff' : 'var(--rai-blue-900)', fontSize: 11, fontWeight: 800,
            display: 'grid', placeItems: 'center', lineHeight: 1,
          }}>{avisos.length}</span>
        )}
      </button>
      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, maxWidth: '90vw',
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--gray-200)', zIndex: 80, overflow: 'hidden',
        }}>
          <div className="row-between" style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--gray-200)' }}>
            <strong style={{ color: 'var(--text-strong)' }}>Atención{patio ? ` · ${patio}` : ''}</strong>
            <span className="badge badge-gray">{avisos.length}</span>
          </div>
          {avisos.length === 0 && (
            <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
              <Icon name="check" size={22} /><div>Todo en orden, sin pendientes.</div>
            </div>
          )}
          {avisos.map((a) => (
            <button
              key={a.texto}
              onClick={() => { nav(a.path); setAbierto(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', width: '100%', textAlign: 'left',
                padding: 'var(--sp-3) var(--sp-4)', border: 0, borderBottom: '1px solid var(--gray-100)',
                background: 'transparent', cursor: 'pointer', font: 'inherit',
              }}
            >
              <span style={{ color: a.tone === 'red' ? 'var(--danger-600)' : 'var(--warn-700)', flexShrink: 0 }}>
                <Icon name="alert" size={18} />
              </span>
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--gray-900)' }}>{a.texto}</span>
              <Icon name="arrow-right" size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
