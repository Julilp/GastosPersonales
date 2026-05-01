import { useState, useEffect } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import {
  getPresupuestos,
  getGastosPorCategoria,
  getResumenMes,
  getMetaAhorro,
  upsertPresupuesto,
  upsertMetaAhorro,
  getCategorias,
  getMesAnioActual,
  navegarMes,
  labelMes,
} from '../lib/finanzas'
import { ChevronLeft, ChevronRight, X, Pencil, Target, Plus } from 'lucide-react'

function ModalPresupuesto({ categorias, presupuestoExistente, mes, anio, moneda, onClose, onSaved }) {
  const [categoriaId, setCategoriaId] = useState(presupuestoExistente?.categoria_id ?? '')
  const [limite, setLimite] = useState(presupuestoExistente?.monto_limite ? String(presupuestoExistente.monto_limite) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const opciones = categorias.flatMap(cat => {
    const items = [{ id: cat.id, label: `${cat.icono} ${cat.nombre}` }]
    if (cat.subcategorias?.length) {
      cat.subcategorias.forEach(sub => {
        items.push({ id: sub.id, label: `  ${sub.icono ?? ''} ${sub.nombre}` })
      })
    }
    return items
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const limiteNum = parseFloat(limite)
    if (!categoriaId) { setError('Seleccioná una categoría'); return }
    if (!limite || isNaN(limiteNum) || limiteNum <= 0) { setError('El límite debe ser mayor a 0'); return }
    setSaving(true)
    try {
      await upsertPresupuesto({ categoria_id: categoriaId, monto_limite: limiteNum, mes, anio, moneda })
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetHeader}>
          <h2 style={s.sheetTitle}>{presupuestoExistente ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
          <button onClick={onClose} style={s.closeBtn} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Categoría</label>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={s.select} disabled={Boolean(presupuestoExistente)}>
              <option value="">Seleccioná una categoría</option>
              {opciones.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Límite ({moneda})</label>
            <input type="number" min="0" step="0.01" value={limite} onChange={e => setLimite(e.target.value)} placeholder="0.00" style={s.input} inputMode="decimal" />
          </div>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn}>Cancelar</button>
            <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalMeta({ meta, mes, anio, moneda, onClose, onSaved }) {
  const [monto, setMonto] = useState(meta?.monto_objetivo ? String(meta.monto_objetivo) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const montoNum = parseFloat(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) { setError('La meta debe ser mayor a 0'); return }
    setSaving(true)
    try {
      await upsertMetaAhorro({ monto_objetivo: montoNum, mes, anio, moneda })
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetHeader}>
          <h2 style={s.sheetTitle}>Meta de ahorro</h2>
          <button onClick={onClose} style={s.closeBtn} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Meta de ahorro para {labelMes(mes, anio)} ({moneda})</label>
            <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" style={s.input} inputMode="decimal" />
          </div>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn}>Cancelar</button>
            <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Presupuestos() {
  const inicial = getMesAnioActual()
  const [mes, setMes] = useState(inicial.mes)
  const [anio, setAnio] = useState(inicial.anio)
  const [moneda, setMoneda] = useState(APP_CONFIG.defaultCurrency)

  const [presupuestos, setPresupuestos] = useState([])
  const [gastos, setGastos] = useState([])
  const [resumen, setResumen] = useState([])
  const [meta, setMeta] = useState(null)
  const [categorias, setCategorias] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalPresup, setModalPresup] = useState(null)
  const [modalPresupAbierto, setModalPresupAbierto] = useState(false)
  const [modalMetaAbierto, setModalMetaAbierto] = useState(false)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => { fetchData() }, [mes, anio, moneda])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [p, g, r, m, cats] = await Promise.all([
        getPresupuestos(mes, anio),
        getGastosPorCategoria(mes, anio, moneda),
        getResumenMes(mes, anio),
        getMetaAhorro(mes, anio),
        getCategorias(),
      ])
      setPresupuestos(p)
      setGastos(g)
      setResumen(r)
      setMeta(m?.find(x => x.moneda === moneda) ?? null)
      setCategorias(cats)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function irMes(delta) {
    const n = navegarMes(mes, anio, delta)
    setMes(n.mes)
    setAnio(n.anio)
  }

  const presupuestosFiltrados = presupuestos.filter(p => p.moneda === moneda)
  const presupuestosConGasto = presupuestosFiltrados.map(p => {
    const gastosCat = gastos.find(g => g.categoria_id === p.categoria_id)
    return { ...p, gastado: gastosCat ? Number(gastosCat.total_egresos) : 0 }
  })

  const filaMoneda = resumen.filter(r => r.moneda === moneda)
  const totalIngresos = filaMoneda.reduce((a, r) => a + Number(r.total_ingresos ?? 0), 0)
  const totalEgresos = filaMoneda.reduce((a, r) => a + Number(r.total_egresos ?? 0), 0)
  const balanceMes = totalIngresos - totalEgresos

  const metaMonto = meta ? Number(meta.monto_objetivo) : 0
  const metaPct = metaMonto > 0 ? Math.min((balanceMes / metaMonto) * 100, 100) : 0
  const metaSuperada = balanceMes >= metaMonto && metaMonto > 0

  return (
    <div style={{ ...s.root, padding: isMobile ? '16px' : '28px 32px 32px' }}>
      {/* Header: MonthNav + CurrToggle */}
      <div style={{ ...s.headerRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '16px' : '0' }}>
        <div style={{ ...s.monthNav, justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
          <button onClick={() => irMes(-1)} style={s.navBtn}><ChevronLeft size={18} /></button>
          <span style={s.mesLabel}>{labelMes(mes, anio)}</span>
          <button onClick={() => irMes(1)} style={s.navBtn}><ChevronRight size={18} /></button>
        </div>
        <div style={{ ...s.currToggle, justifyContent: isMobile ? 'center' : 'flex-end' }}>
          {Object.keys(APP_CONFIG.currencies).map(c => (
            <button
              key={c}
              onClick={() => setMoneda(c)}
              style={{
                ...s.currBtn,
                background: moneda === c ? THEME.colors.accent : 'transparent',
                color: moneda === c ? '#fff' : THEME.colors.textMuted,
                fontWeight: moneda === c ? '600' : '400',
                border: `1px solid ${moneda === c ? THEME.colors.accent : THEME.colors.cardBorder}`,
                flex: isMobile ? 1 : 'none',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={s.errorMsg}>{error}</div>}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : (
        <div style={s.body}>
          {/* Card Meta de ahorro */}
          <div style={s.metaCard}>
            <div style={s.cardHeaderRow}>
              <span style={s.cardTitle}>Meta de ahorro</span>
              <button onClick={() => setModalMetaAbierto(true)} style={s.configBtn}>
                {meta ? 'Editar' : 'Configurar'}
              </button>
            </div>
            {meta ? (
              <>
                <div style={s.metaBarTrack}>
                  <div style={{
                    ...s.metaBarFill,
                    width: `${metaPct}%`,
                    background: `linear-gradient(90deg,${THEME.colors.accent},${THEME.colors.success})`,
                  }} />
                </div>
                <div style={s.metaFooterRow}>
                  <span style={s.metaFooterText}>{formatMoney(balanceMes < 0 ? 0 : balanceMes, moneda)} ahorrado</span>
                  <span style={s.metaFooterText}>Meta: {formatMoney(metaMonto, moneda)}</span>
                </div>
                {metaSuperada && (
                  <span style={s.metaAlcanzada}>Meta alcanzada</span>
                )}
              </>
            ) : (
              <p style={s.sinMetaText}>No hay meta configurada para este mes.</p>
            )}
          </div>

          {/* Card Presupuestos */}
          <div style={s.presupCard}>
            <div style={s.cardHeaderRow}>
              <span style={s.cardTitle}>Presupuestos</span>
              <button
                onClick={() => { setModalPresup({}); setModalPresupAbierto(true) }}
                style={s.agregarBtn}
              >
                <Plus size={13} /> Agregar
              </button>
            </div>

            {presupuestosConGasto.length === 0 ? (
              <div style={s.emptyPresup}>
                <Target size={40} color={THEME.colors.textMuted} strokeWidth={1.2} style={{ opacity: 0.3 }} />
                <span style={s.emptyText}>Sin presupuestos para este mes</span>
              </div>
            ) : (
              <div style={s.presupLista}>
                {presupuestosConGasto.map(p => {
                  const pct = p.monto_limite > 0 ? Math.min((p.gastado / p.monto_limite) * 100, 100) : 0
                  const superado = p.gastado > p.monto_limite
                  const quedan = p.monto_limite - p.gastado
                  const barColor = superado ? THEME.colors.danger : pct > 80 ? THEME.colors.warning : THEME.colors.accent
                  const textoColor = pct > 80 ? THEME.colors.danger : THEME.colors.textMuted
                  return (
                    <div key={p.id} style={s.presupItem}>
                      <div style={s.presupTop}>
                        <span style={s.presupNombre}>{p.categoria?.nombre ?? '—'}</span>
                        <div style={s.presupMontos}>
                          <span style={s.presupMontosText}>{formatMoney(p.gastado, moneda)} / {formatMoney(p.monto_limite, moneda)}</span>
                          <button
                            onClick={() => { setModalPresup(p); setModalPresupAbierto(true) }}
                            style={s.editSmBtn}
                          >
                            <Pencil size={13} color={THEME.colors.textMuted} />
                          </button>
                        </div>
                      </div>
                      <div style={s.presupBarTrack}>
                        <div style={{ ...s.presupBarFill, width: `${pct}%`, background: barColor }} />
                      </div>
                      <span style={{ ...s.presupTexto, color: textoColor }}>
                        {pct.toFixed(0)}% usado · Quedan {formatMoney(quedan < 0 ? 0 : quedan, moneda)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {modalPresupAbierto && (
        <ModalPresupuesto
          categorias={categorias}
          presupuestoExistente={modalPresup?.id ? modalPresup : null}
          mes={mes}
          anio={anio}
          moneda={moneda}
          onClose={() => { setModalPresupAbierto(false); setModalPresup(null) }}
          onSaved={() => { setModalPresupAbierto(false); setModalPresup(null); fetchData() }}
        />
      )}

      {modalMetaAbierto && (
        <ModalMeta
          meta={meta}
          mes={mes}
          anio={anio}
          moneda={moneda}
          onClose={() => setModalMetaAbierto(false)}
          onSaved={() => { setModalMetaAbierto(false); fetchData() }}
        />
      )}
    </div>
  )
}

const s = {
  root: { minHeight: '100vh', background: THEME.colors.bg, padding: '28px 32px 32px' },
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px',
  },
  monthNav: { display: 'flex', alignItems: 'center', gap: '4px' },
  navBtn: {
    background: 'none', border: 'none', color: THEME.colors.accent,
    cursor: 'pointer', padding: '4px 8px', minWidth: '44px', minHeight: '44px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: THEME.radius.sm, transition: 'opacity 0.15s',
  },
  mesLabel: { fontSize: '16px', fontWeight: 700, color: THEME.colors.textPrimary, textTransform: 'capitalize' },
  currToggle: { display: 'inline-flex', gap: '4px' },
  currBtn: {
    padding: '6px 14px', borderRadius: THEME.radius.full, fontSize: '12px',
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: THEME.font,
  },
  errorMsg: {
    marginBottom: '16px', background: THEME.colors.errorBg, color: THEME.colors.danger,
    borderRadius: THEME.radius.sm, padding: '10px 14px', fontSize: '13px',
  },
  loadingWrap: { textAlign: 'center', padding: '60px 16px', color: THEME.colors.textMuted, fontSize: '14px' },
  body: { display: 'flex', flexDirection: 'column', gap: '12px' },
  metaCard: {
    padding: '20px', borderRadius: THEME.radius.lg,
    background: THEME.colors.card, border: `1px solid ${THEME.colors.cardBorder}`,
  },
  presupCard: {
    padding: '20px', borderRadius: THEME.radius.lg,
    background: THEME.colors.card, border: `1px solid ${THEME.colors.cardBorder}`,
  },
  cardHeaderRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px',
  },
  cardTitle: { fontSize: '14px', fontWeight: 600, color: THEME.colors.textPrimary },
  configBtn: {
    padding: '5px 12px', background: 'transparent', border: `1px solid ${THEME.colors.cardBorder}`,
    borderRadius: THEME.radius.sm, fontSize: '11px', color: THEME.colors.textMuted,
    cursor: 'pointer', fontFamily: THEME.font,
  },
  agregarBtn: {
    padding: '5px 12px', background: THEME.colors.accent, border: 'none',
    borderRadius: THEME.radius.sm, fontSize: '11px', color: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: THEME.font,
    minHeight: '32px',
  },
  metaBarTrack: {
    height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
    marginBottom: '8px',
  },
  metaBarFill: { height: '100%', borderRadius: '3px', transition: 'width 0.4s ease' },
  metaFooterRow: { display: 'flex', justifyContent: 'space-between', marginTop: '8px' },
  metaFooterText: { fontSize: '11px', color: THEME.colors.textMuted },
  metaAlcanzada: {
    display: 'inline-block', marginTop: '8px',
    background: THEME.colors.successBg, color: THEME.colors.success,
    borderRadius: THEME.radius.full, fontSize: '12px', fontWeight: 600, padding: '4px 12px',
  },
  sinMetaText: { margin: 0, fontSize: '14px', color: THEME.colors.textMuted, textAlign: 'center', padding: '8px 0' },
  emptyPresup: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px 0',
  },
  emptyText: { fontSize: '14px', color: THEME.colors.textMuted },
  presupLista: { display: 'flex', flexDirection: 'column', gap: '18px' },
  presupItem: { display: 'flex', flexDirection: 'column', gap: '6px' },
  presupTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  presupNombre: { fontSize: '13px', fontWeight: 500, color: THEME.colors.textPrimary },
  presupMontos: { display: 'flex', alignItems: 'center', gap: '8px' },
  presupMontosText: { fontSize: '12px', color: THEME.colors.textMuted },
  presupBarTrack: {
    height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
  },
  presupBarFill: { height: '100%', borderRadius: '3px', transition: 'width 0.4s ease' },
  presupTexto: { fontSize: '10px' },
  editSmBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    width: '28px', height: '28px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, padding: 0,
  },
  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    background: '#181b24', borderRadius: `${THEME.radius.xl} ${THEME.radius.xl} 0 0`,
    width: '100%', maxWidth: '600px', maxHeight: '80svh', overflowY: 'auto',
    padding: '12px 20px 40px', boxSizing: 'border-box',
    animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  handle: {
    width: '40px', height: '4px', background: THEME.colors.cardBorder,
    borderRadius: '9999px', margin: '0 auto 16px',
  },
  sheetHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  sheetTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: THEME.colors.textPrimary },
  closeBtn: {
    background: THEME.colors.surface, border: `1px solid ${THEME.colors.cardBorder}`,
    borderRadius: THEME.radius.sm, cursor: 'pointer', color: THEME.colors.textMuted,
    padding: '6px', lineHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 500, color: THEME.colors.textMuted },
  input: {
    height: '48px', padding: '0 14px', borderRadius: THEME.radius.sm,
    border: `1.5px solid ${THEME.colors.inputBorder}`, fontSize: '15px',
    color: THEME.colors.textPrimary, background: THEME.colors.inputBg,
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: THEME.font,
  },
  select: {
    height: '48px', padding: '0 14px', borderRadius: THEME.radius.sm,
    border: `1.5px solid ${THEME.colors.inputBorder}`, fontSize: '15px',
    color: THEME.colors.textPrimary, background: THEME.colors.inputBg,
    outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer', fontFamily: THEME.font,
  },
  errorBox: { background: THEME.colors.errorBg, color: THEME.colors.danger, borderRadius: THEME.radius.sm, padding: '10px 14px', fontSize: '13px' },
  actions: { display: 'flex', gap: '12px', marginTop: '4px' },
  cancelBtn: {
    flex: 1, height: '52px', background: THEME.colors.inputBg, color: THEME.colors.textMuted,
    border: `1.5px solid ${THEME.colors.cardBorder}`, borderRadius: THEME.radius.sm,
    fontSize: '15px', fontWeight: 500, cursor: 'pointer', fontFamily: THEME.font,
  },
  saveBtn: {
    flex: 2, height: '52px', background: THEME.colors.accent, color: '#fff',
    border: 'none', borderRadius: THEME.radius.sm, fontSize: '15px', fontWeight: 600,
    cursor: 'pointer', fontFamily: THEME.font,
  },
}
