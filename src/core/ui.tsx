import React from 'react'
import type { OrdenStatus, ValeStatus } from './types'
import { STATUS_LABEL } from './types'

// ── Iconos SVG (stroke 1.8, 24px) ───────────────────────────────────────
type IconName =
  | 'home' | 'clipboard' | 'wrench' | 'ticket' | 'box' | 'bank' | 'chart'
  | 'invoice' | 'calendar' | 'shield' | 'gauge' | 'settings' | 'car'
  | 'user' | 'check' | 'x' | 'plus' | 'alert' | 'search' | 'arrow-right'
  | 'camera' | 'pen' | 'truck' | 'spray' | 'history' | 'money' | 'back'

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8" />,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 9.5h7M8.5 13h7M8.5 16.5h4.5" /></>,
  wrench: <path d="M14.2 6.3a4 4 0 0 0-5.5 4.9L3.6 16.3a2 2 0 1 0 2.8 2.8l5.1-5.1a4 4 0 0 0 4.9-5.5l-2.6 2.6-2.3-2.3 2.7-2.5Z" />,
  ticket: <><path d="M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 6v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-6Z" /><path d="M14 6v12" strokeDasharray="2.4 2.6" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
  bank: <><path d="M3 9.5 12 4l9 5.5M5 10v7m4.7-7v7m4.6-7v7M19 10v7M3.5 20.5h17" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M8 16v-5m4 5V8m4 8v-3" /></>,
  invoice: <><path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3Z" /><path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v4m8-4v4" /></>,
  shield: <path d="M12 3 5 5.8v5.4c0 4.4 3 8.4 7 9.8 4-1.4 7-5.4 7-9.8V5.8L12 3Zm-3 8.6 2.2 2.2 4-4.2" />,
  gauge: <><path d="M5 18a8 8 0 1 1 14 0" /><path d="M12 14l3.5-4.5" /><circle cx="12" cy="14.5" r="1.6" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v3m0 12.4v3M4.6 6.5l2.1 2.1m10.6 10.6 2.1-2.1M2.8 12h3m12.4 0h3M4.6 17.5l2.1-2.1M17.3 8.6l2.1-2.1" /></>,
  car: <><path d="M5 13 6.7 7.6A2 2 0 0 1 8.6 6h6.8a2 2 0 0 1 1.9 1.6L19 13M5 13h14a1.5 1.5 0 0 1 1.5 1.5V18H18m-12.5 0H3.5v-3.5A1.5 1.5 0 0 1 5 13Zm.5 5a2 2 0 1 0 4 0m5 0a2 2 0 1 0 4 0m-13 0h9" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20.4c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  alert: <><path d="M12 4 2.8 19.6h18.4L12 4Z" /><path d="M12 10v4.4m0 2.6v.4" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 5 5" /></>,
  'arrow-right': <path d="M4.5 12h15m-6-6 6 6-6 6" />,
  camera: <><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.4" /></>,
  pen: <path d="m4 20 1-4.5L16.5 4a1.8 1.8 0 0 1 2.6 0l.9.9a1.8 1.8 0 0 1 0 2.6L8.5 19 4 20Z" />,
  truck: <><path d="M2.5 6h12v10h-12zM14.5 9.5h4l2.5 3.5v3h-6.5" /><circle cx="6.5" cy="17.5" r="1.9" /><circle cx="17" cy="17.5" r="1.9" /></>,
  spray: <><path d="M9 8h6l1.5 12.5h-9L9 8Z" /><path d="M10.5 8V5.5h3V8M15 3.5h.01M17.5 5h.01M17.5 2.5h.01" /></>,
  history: <><path d="M4.5 5.5v4h4" /><path d="M5 13a7.5 7.5 0 1 0 1.5-6L4.5 9.5M12 8.5V13l3 2" /></>,
  money: <><rect x="2.5" y="6.5" width="19" height="11" rx="1.5" /><circle cx="12" cy="12" r="2.8" /><path d="M5.8 9.5h.01m12.4 5h.01" /></>,
  back: <path d="M19.5 12h-15m6 6-6-6 6-6" />,
}

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

// ── Badges de estatus ────────────────────────────────────────────────────
const STATUS_TONE: Record<OrdenStatus, string> = {
  COTIZACION: 'badge-yellow',
  VALUACION: 'badge-blue',
  ESPERA_REFACCIONES: 'badge-yellow',
  CITADO: 'badge-blue',
  EN_PROCESO: 'badge-navy',
  ENTREGADO: 'badge-green',
  FACTURADO: 'badge-green',
  PAGADO: 'badge-green',
  GARANTIA: 'badge-red',
  PAGO_DANOS: 'badge-gray',
  CANCELADO: 'badge-gray',
}

export const StatusBadge = ({ s }: { s: OrdenStatus }) => (
  <span className={`badge ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>
)

const VALE_TONE: Record<ValeStatus, [string, string]> = {
  PENDIENTE: ['badge-yellow', 'Pendiente autorización'],
  AUTORIZADO: ['badge-blue', 'Autorizado'],
  RECHAZADO: ['badge-red', 'Rechazado'],
  SURTIDO: ['badge-navy', 'Surtido'],
  EN_REVISION: ['badge-yellow', 'En revisión CxP'],
  PAGADO: ['badge-green', 'Pagado'],
}

export const ValeBadge = ({ s }: { s: ValeStatus }) => (
  <span className={`badge ${VALE_TONE[s][0]}`}>{VALE_TONE[s][1]}</span>
)

// ── Modal accesible ──────────────────────────────────────────────────────
export function Modal({
  title, onClose, children, wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--gray-200)' }}>
          <h3 className="section-title">{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div style={{ padding: 'var(--sp-6)' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Campos de formulario ────────────────────────────────────────────────
export function Field({
  label, children, error,
}: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  )
}

export function Stat({
  label, value, hint, tone,
}: { label: string; value: React.ReactNode; hint?: string; tone?: 'accent' | 'ok' | 'warn' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function PageHeader({
  title, sub, actions,
}: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="row-between mb-6">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export const Empty = ({ msg }: { msg: string }) => <div className="empty">{msg}</div>
