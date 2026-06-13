import { useMemo, useState } from 'react'
import { useDB, useRol, useScope } from '../../core/store'
import { etapaDef } from '../../core/types'
import { lineasDeSemana, semanasDisponibles } from '../../core/productividad'
import { Icon, Field, PageHeader, Stat, Empty, Modal } from '../../core/ui'
import { exportarCSV } from '../../core/export'
import { imprimir } from '../../core/print'
import { mxn, fechaCorta } from '../../core/format'

export default function Productividad() {
  const db = useDB()
  const rol = useRol()
  const { patio: patioSesion, global } = useScope()
  const semanas = semanasDisponibles(db)
  const [semana, setSemana] = useState(semanas[0] ?? '')
  const [patioFiltro, setPatioFiltro] = useState('')
  const [recibo, setRecibo] = useState<string | null>(null)
  // Roles no globales solo ven la productividad de su patio
  const patio = global ? patioSesion || patioFiltro : patioSesion

  const lineas = useMemo(() => (semana ? lineasDeSemana(db, semana) : []), [db, semana])

  const porTecnico = useMemo(() => {
    const map = new Map<string, { bruto: number; lineas: typeof lineas }>()
    for (const l of lineas) {
      const t = db.tecnicos.find((x) => x.id === l.tecnicoId)
      if (patio && t?.patio !== patio) continue
      const e = map.get(l.tecnicoId) ?? { bruto: 0, lineas: [] }
      e.bruto += l.monto
      e.lineas.push(l)
      map.set(l.tecnicoId, e)
    }
    return [...map.entries()].sort((a, b) => b[1].bruto - a[1].bruto)
  }, [lineas, patio, db.tecnicos])

  const totalBruto = porTecnico.reduce((s, [, v]) => s + v.bruto, 0)
  const totalDescuentos = porTecnico.reduce((s, [tid, v]) => {
    const p = db.prestamos.find((x) => x.tecnicoId === tid && x.saldo > 0)
    return s + (p ? Math.min(p.abonoSemanal, p.saldo, v.bruto) : 0)
  }, 0)

  return (
    <>
      <PageHeader
        title="Productividad"
        sub="Corte semanal automático desde la bitácora de etapas — sin reportes manuales de los lunes"
        actions={
          <button
            className="btn btn-outline"
            disabled={porTecnico.length === 0}
            onClick={() => exportarCSV(`productividad-${semana}`, porTecnico.flatMap(([tid, v]) => {
              const t = db.tecnicos.find((x) => x.id === tid)
              return v.lineas.map((l) => ({
                Tecnico: t?.nombre ?? '', Rol: t?.rol ?? '', Patio: t?.patio ?? '',
                OT: l.ordenFolio, Etapa: etapaDef(l.etapa).nombre, Base: l.base, Pct: l.pct, Monto: l.monto,
              }))
            }))}
          >
            <Icon name="invoice" size={18} /> Exportar CSV
          </button>
        }
      />
      <div className="card card-pad mb-6" style={{ marginBottom: 'var(--sp-6)', background: 'var(--rai-blue-50)', border: 'none' }}>
        <p style={{ fontSize: 'var(--fs-sm)' }}>
          <strong>Porcentajes por etapa (sobre la venta del área):</strong>{' '}
          Hojalatería A 9% · B 20% · C 6% &nbsp;|&nbsp; Pintura A 13% · B 13% · C 9% &nbsp;|&nbsp; Mecánica 20%.
          El corte cierra cada <strong>sábado</strong> y los montos salen de las etapas completadas en el tablero de taller.
        </p>
      </div>

      <div className="toolbar">
        <Field label="Semana (corte sábado)">
          <select value={semana} onChange={(e) => setSemana(e.target.value)}>
            {semanas.map((s) => <option key={s} value={s}>Corte {fechaCorta(s)}</option>)}
          </select>
        </Field>
        {global && !patioSesion ? (
          <Field label="Patio">
            <select value={patioFiltro} onChange={(e) => setPatioFiltro(e.target.value)}>
              <option value="">Todos</option>
              {db.config.patios.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Patio">
            <input value={patio} disabled aria-label="Patio asignado a tu sesión" />
          </Field>
        )}
      </div>

      <div className="stat-grid mb-6" style={{ marginBottom: 'var(--sp-6)' }}>
        <Stat label="Técnicos con producción" value={porTecnico.length} />
        <Stat label="Productividad bruta" value={mxn(totalBruto)} tone="accent" />
        <Stat label="Descuentos de préstamos" value={mxn(totalDescuentos)} tone="warn" />
        <Stat label="Neto a pagar" value={mxn(totalBruto - totalDescuentos)} tone="ok" />
      </div>

      {porTecnico.length === 0 && <Empty msg="Sin etapas completadas en esta semana / patio." />}

      <div className="grid-2">
        {porTecnico.map(([tid, v]) => {
          const t = db.tecnicos.find((x) => x.id === tid)
          const prestamo = db.prestamos.find((x) => x.tecnicoId === tid && x.saldo > 0)
          const descuento = prestamo ? Math.min(prestamo.abonoSemanal, prestamo.saldo, v.bruto) : 0
          return (
            <div key={tid} className="card card-pad">
              <div className="row-between">
                <div>
                  <h3 className="section-title">{t?.nombre}</h3>
                  <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t?.rol} · patio {t?.patio}</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setRecibo(tid)}>
                  <Icon name="invoice" size={14} /> Recibo
                </button>
              </div>
              <div className="table-wrap mt-4">
                <table className="data">
                  <thead>
                    <tr><th>OT</th><th>Etapa</th><th>Base venta</th><th>%</th><th>Monto</th></tr>
                  </thead>
                  <tbody>
                    {v.lineas.map((l, i) => (
                      <tr key={i}>
                        <td>{l.ordenFolio}</td>
                        <td>{etapaDef(l.etapa).nombre}</td>
                        <td>{mxn(l.base)}</td>
                        <td>{l.pct}%</td>
                        <td style={{ fontWeight: 600 }}>{mxn(l.monto)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={4}>Bruto</td><td>{mxn(v.bruto)}</td>
                    </tr>
                    {descuento > 0 && (
                      <tr style={{ color: 'var(--danger-600)' }}>
                        <td colSpan={4}>Descuento préstamo (saldo {mxn(prestamo!.saldo)})</td>
                        <td>-{mxn(descuento)}</td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 800, color: 'var(--ink-brand)' }}>
                      <td colSpan={4}>Neto a pagar</td><td>{mxn(v.bruto - descuento)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {recibo && (
        <ReciboModal
          tecnicoId={recibo}
          semana={semana}
          lineas={porTecnico.find(([tid]) => tid === recibo)?.[1].lineas ?? []}
          onClose={() => setRecibo(null)}
        />
      )}
    </>
  )
}

function ReciboModal({
  tecnicoId, semana, lineas, onClose,
}: {
  tecnicoId: string
  semana: string
  lineas: { ordenFolio: number; etapa: string; base: number; pct: number; monto: number }[]
  onClose: () => void
}) {
  const db = useDB()
  const t = db.tecnicos.find((x) => x.id === tecnicoId)
  const bruto = lineas.reduce((s, l) => s + l.monto, 0)
  const prestamo = db.prestamos.find((x) => x.tecnicoId === tecnicoId && x.saldo > 0)
  const descuento = prestamo ? Math.min(prestamo.abonoSemanal, prestamo.saldo, bruto) : 0
  return (
    <Modal title={`Recibo de productividad · ${t?.nombre}`} onClose={onClose}>
      <div style={{ fontFamily: 'inherit', fontSize: 'var(--fs-sm)' }}>
        <p className="muted">Semana con corte {fechaCorta(semana)} · RAI Hojalatería y Pintura, Aguascalientes</p>
        <table className="data mt-4" style={{ marginTop: 'var(--sp-4)' }}>
          <thead><tr><th>OT</th><th>Etapa</th><th>%</th><th>Monto</th></tr></thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td>{l.ordenFolio}</td>
                <td>{etapaDef(l.etapa as never).nombre}</td>
                <td>{l.pct}%</td>
                <td>{mxn(l.monto)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}><td colSpan={3}>Bruto</td><td>{mxn(bruto)}</td></tr>
            {descuento > 0 && <tr><td colSpan={3}>Descuento préstamo</td><td>-{mxn(descuento)}</td></tr>}
            <tr style={{ fontWeight: 800 }}><td colSpan={3}>Neto</td><td>{mxn(bruto - descuento)}</td></tr>
          </tbody>
        </table>
        <div className="row mt-6" style={{ marginTop: 'var(--sp-6)', justifyContent: 'space-between' }}>
          <span className="muted">Firma del técnico: ______________________</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() =>
              imprimir(
                `Recibo de productividad · ${t?.nombre}`,
                `
                <div class="grid">
                  <div><div class="lbl">Técnico</div><div class="val">${t?.nombre ?? ''}</div></div>
                  <div><div class="lbl">Puesto / Patio</div><div class="val">${t?.rol ?? ''} · ${t?.patio ?? ''}</div></div>
                  <div><div class="lbl">Semana</div><div class="val">Corte ${fechaCorta(semana)}</div></div>
                  <div><div class="lbl">Etapas pagadas</div><div class="val">${lineas.length}</div></div>
                </div>
                <table>
                  <thead><tr><th>OT</th><th>Etapa</th><th style="text-align:right">Base venta</th><th style="text-align:right">%</th><th style="text-align:right">Monto</th></tr></thead>
                  <tbody>
                    ${lineas.map((l) => `<tr><td>${l.ordenFolio}</td><td>${etapaDef(l.etapa as never).nombre}</td><td style="text-align:right">${mxn(l.base)}</td><td style="text-align:right">${l.pct}%</td><td style="text-align:right">${mxn(l.monto)}</td></tr>`).join('')}
                    <tr><td colspan="4" style="font-weight:700">Bruto</td><td style="text-align:right;font-weight:700">${mxn(bruto)}</td></tr>
                    ${descuento > 0 ? `<tr><td colspan="4">Descuento de préstamo (saldo ${mxn(prestamo!.saldo)})</td><td style="text-align:right">-${mxn(descuento)}</td></tr>` : ''}
                  </tbody>
                </table>
                <div class="total">Neto a pagar: ${mxn(bruto - descuento)}</div>
                <div class="firmas">
                  <div>Firma del técnico</div>
                  <div>Firma de RH / Gerencia</div>
                </div>
                `,
                'Recibo de productividad',
                fechaCorta(semana),
              )
            }
          >
            <Icon name="invoice" size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>
    </Modal>
  )
}
