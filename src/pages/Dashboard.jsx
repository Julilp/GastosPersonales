import { useState, useEffect, useCallback } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import {
  getResumenMes,
  getGastosPorCategoria,
  getGastosPorSubcategoria,
  getPendientesMes,
  getPresupuestos,
  getRecurrentes,
  getCuotas,
  omitirPendiente,
  aplicarRecurrente,
  pagarCuota,
  getMesAnioActual,
  navegarMes,
  labelMes,
} from '../lib/finanzas'
import ModalMovimiento from '../components/ModalMovimiento'
import { CategoryIcon } from '../lib/categoryIcons'
import { Clock, ChevronLeft, ChevronRight, Plus, LogOut, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { getEraInsights, INSIGHT_CONFIG, PRIORITY_ORDER, sortInsights, getScoreColor, getScoreLabel } from '../lib/eraContext'

// ─── ERA Context Insights Panel ──────────────────────────────────────────────

function InsightsERA({ resumen, gastos, subcategorias, presupuestos, recurrentes, cuotas, mes, anio }) {
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)

  const cargar = useCallback(async () => {
    if (!resumen || resumen.length === 0) return
    setLoading(true)
    setError('')
    try {
      const data = await getEraInsights({ resumen, gastos, subcategorias, presupuestos, recurrentes, cuotas, mes, anio })
      setInsights(data)
      setHasLoaded(true)
    } catch (e) {
      setError('No se pudieron cargar los insights.')
    }
    setLoading(false)
  }, [resumen, gastos, subcategorias, presupuestos, recurrentes, cuotas, mes, anio])

  useEffect(() => {
    if (!hasLoaded && resumen && resumen.length > 0) {
      cargar()
    }
  }, [resumen])

  const insightsSorted = insights ? sortInsights(insights.insights ?? []) : []

  return (
    <div style={si.card}>
      <div style={si.header} onClick={() => setExpanded(e => !e)}>
        <div style={si.headerLeft}>
          <Sparkles size={16} color={THEME.colors.accent} />
          <span style={si.title}>Insights ERA</span>
          {insights?.score_financiero != null && (
            <span style={{
              ...si.scoreBadge,
              background: getScoreColor(insights.score_financiero) + '22',
              color: getScoreColor(insights.score_financiero),
            }}>
              {insights.score_financiero}/100 · {getScoreLabel(insights.score_financiero)}
            </span>
          )}
        </div>
        <div style={si.headerRight}>
          {hasLoaded && (
            <button
              onClick={e => { e.stopPropagation(); cargar() }}
              style={si.refreshBtn}
              disabled={loading}
              title="Actualizar insights"
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
            </button>
          )}
          {expanded ? <ChevronUp size={16} color={THEME.colors.textMuted} /> : <ChevronDown size={16} color={THEME.colors.textMuted} />}
        </div>
      </div>

      {expanded && (
        <div style={si.body}>
          {loading && !hasLoaded && (
            <div style={si.loadingRow}>
              <RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite', color: THEME.colors.accent }} />
              <span style={si.loadingText}>Analizando tus finanzas con IA...</span>
            </div>
          )}

          {error && !loading && (
            <span style={si.errorText}>{error}</span>
          )}

          {!hasLoaded && !loading && !error && (
            <div style={si.emptyState}>
              <span style={si.emptyText}>Registrá movimientos para ver insights personalizados.</span>
            </div>
          )}

          {insights && (
            <>
              {insights.resumen_ejecutivo && (
                <p style={si.resumen}>{insights.resumen_ejecutivo}</p>
              )}
              <div style={si.insightsList}>
                {insightsSorted.map((insight, i) => {
                  const config = INSIGHT_CONFIG[insight.tipo] ?? INSIGHT_CONFIG.consejo
                  return (
                    <div key={i} style={{ ...si.insightItem, background: config.bg, borderLeft: `3px solid ${config.color}` }}>
                      <div style={si.insightTop}>
                        <span style={si.insightEmoji}>{config.emoji}</span>
                        <span style={{ ...si.insightTipo, color: config.color }}>{config.label}</span>
                        {insight.valor && (
                          <span style={{ ...si.insightValor, color: config.color }}>{insight.valor}</span>
                        )}
                        <span style={{ ...si.prioridadBadge, opacity: insight.prioridad === 'alta' ? 1 : 0.6 }}>
                          {insight.prioridad === 'alta' ? '●' : insight.prioridad === 'media' ? '◐' : '○'}
                        </span>
                      </div>
                      <p style={si.insightTitulo}>{insight.titulo}</p>
                      <p style={si.insightDesc}>{insight.descripcion}</p>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const si = {
  card: {
    background: THEME.colors.card,
    border: `1px solid ${THEME.colors.accent}44`,
    borderRadius: THEME.radius.lg,
    marginBottom: '16px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', cursor: 'pointer',
    borderBottom: `1px solid ${THEME.colors.cardBorder}`,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  title: { fontSize: '14px', fontWeight: 600, color: THEME.colors.textPrimary },
  scoreBadge: {
    fontSize: '11px', fontWeight: 700, padding: '2px 8px',
    borderRadius: '9999px', letterSpacing: '0.3px',
  },
  refreshBtn: {
    background: 'none', border: 'none', color: THEME.colors.textMuted,
    cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
    borderRadius: THEME.radius.sm,
  },
  body: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  loadingRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' },
  loadingText: { fontSize: '13px', color: THEME.colors.textMuted },
  errorText: { fontSize: '13px', color: THEME.colors.danger },
  emptyState: { padding: '8px 0' },
  emptyText: { fontSize: '13px', color: THEME.colors.textMuted },
  resumen: {
    margin: '0 0 8px', fontSize: '13px', color: THEME.colors.textMuted,
    fontStyle: 'italic', lineHeight: '1.5',
  },
  insightsList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  insightItem: {
    borderRadius: THEME.radius.sm, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  insightTop: { display: 'flex', alignItems: 'center', gap: '6px' },
  insightEmoji: { fontSize: '13px', lineHeight: 1 },
  insightTipo: { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  insightValor: { fontSize: '11px', fontWeight: 700, marginLeft: 'auto' },
  prioridadBadge: { fontSize: '11px', color: THEME.colors.textMuted, marginLeft: '2px' },
  insightTitulo: { margin: 0, fontSize: '13px', fontWeight: 600, color: THEME.colors.textPrimary },
  insightDesc: { margin: 0, fontSize: '12px', color: THEME.colors.textMuted, lineHeight: '1.5' },
}

// ─── Pendiente Item ───────────────────────────────────────────────────────────

function PendienteItem({ label, sub, monto, moneda, tipo, onAplicar, onNoAplicar, aplicando }) {
  const color = tipo === 'ingreso' ? THEME.colors.success : THEME.colors.danger
  const signo = tipo === 'ingreso' ? '+' : '-'
  return (
    <div style={sp.item}>
      <div style={sp.itemInfo}>
        <span style={sp.itemLabel}>{label}</span>
        <span style={sp.itemSub}>{sub}</span>
      </div>
      <span style={{ ...sp.itemMonto, color }}>{signo}{formatMoney(monto, moneda)}</span>
      <button onClick={onNoAplicar} disabled={aplicando} style={sp.noAplicarBtn}>
        No aplicar
      </button>
      <button onClick={onAplicar} disabled={aplicando} style={sp.aplicarBtn}>
        {aplicando ? '...' : 'Aplicar'}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const inicial = getMesAnioActual()
  const [mes, setMes] = useState(inicial.mes)
  const [anio, setAnio] = useState(inicial.anio)
  const [resumen, setResumen] = useState([])
  const [gastos, setGastos] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [pendientes, setPendientes] = useState({ recurrentes_pendientes: [], cuotas_pendientes: [] })
  const [presupuestos, setPresupuestos] = useState([])
  const [recurrentes, setRecurrentes] = useState([])
  const [cuotas, setCuotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [aplicandoId, setAplicandoId] = useState(null)

  const esMesActual = (() => { const a = getMesAnioActual(); return mes === a.mes && anio === a.anio })()

  useEffect(() => { fetchData() }, [mes, anio])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [r, g, p, sub, pres, rec, cuot] = await Promise.all([
        getResumenMes(mes, anio),
        getGastosPorCategoria(mes, anio, APP_CONFIG.defaultCurrency),
        getPendientesMes(mes, anio),
        getGastosPorSubcategoria(mes, anio, APP_CONFIG.defaultCurrency),
        getPresupuestos(mes, anio),
        getRecurrentes(),
        getCuotas(),
      ])
      setResumen(r)
      setGastos(g)
      setPendientes(p)
      setSubcategorias(sub ?? [])
      setPresupuestos(pres ?? [])
      setRecurrentes(rec ?? [])
      setCuotas(cuot ?? [])
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

  async function handleAplicarRec(rec) {
    setAplicandoId(`rec-${rec.id}`)
    try {
      await aplicarRecurrente(rec, mes, anio)
      fetchData()
    } catch (e) { setError(e.message) }
    setAplicandoId(null)
  }

  async function handlePagarCuota(cuota) {
    setAplicandoId(`cuota-${cuota.id}`)
    try {
      await pagarCuota(cuota, mes, anio)
      fetchData()
    } catch (e) { setError(e.message) }
    setAplicandoId(null)
  }

  async function handleNoAplicarRec(recId) {
    setPendientes(p => ({
      ...p,
      recurrentes_pendientes: p.recurrentes_pendientes.filter(r => r.id !== recId)
    }))
    try { await omitirPendiente('recurrente', recId, mes, anio) } catch (e) { setError(e.message) }
  }
  async function handleNoAplicarCuota(cuotaId) {
    setPendientes(p => ({
      ...p,
      cuotas_pendientes: p.cuotas_pendientes.filter(c => c.id !== cuotaId)
    }))
    try { await omitirPendiente('cuota', cuotaId, mes, anio) } catch (e) { setError(e.message) }
  }

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const datosPorMoneda = Object.keys(APP_CONFIG.currencies).map(mon => {
    const filas = resumen.filter(r => r.moneda === mon)
    return {
      moneda: mon,
      totalIngresos: filas.reduce((a, r) => a + Number(r.total_ingresos ?? 0), 0),
      totalEgresos: filas.reduce((a, r) => a + Number(r.total_egresos ?? 0), 0),
      balance: filas.reduce((a, r) => a + Number(r.balance ?? 0), 0),
    }
  })

  const recPend = pendientes.recurrentes_pendientes ?? []
  const cuotasPend = pendientes.cuotas_pendientes ?? []
  const totalPendientes = recPend.length + cuotasPend.length

  // Calcular total de gastos para porcentajes
  const totalGastos = gastos.reduce((a, g) => a + Number(g.total_egresos ?? 0), 0)

  return (
    <div style={{ ...s.root, padding: isMobile ? '16px' : '28px 32px 32px' }}>
      {/* Header row: MonthNav + Logout */}
      <div style={s.headerRow}>
        <div style={{ ...s.monthNav, justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
          <button onClick={() => irMes(-1)} style={s.navBtn}>
            <ChevronLeft size={18} />
          </button>
          <span style={s.mesLabel}>{labelMes(mes, anio)}</span>
          <button onClick={() => irMes(1)} style={s.navBtn}>
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={s.logoutBtn}
            aria-label="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : (
        <>
          {/* Cards por moneda */}
          {datosPorMoneda.map(({ moneda: mon, totalIngresos, totalEgresos, balance }) => (
            <div key={mon}>
              <span style={s.monedaLabel}>{mon}</span>
              <div style={{ ...s.cardsGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr' }}>
                <div style={s.card}>
                  <span style={s.cardLabel}>Balance</span>
                  <span style={{ ...s.cardMonto, color: THEME.colors.textPrimary }}>{formatMoney(balance, mon)}</span>
                </div>
                <div style={s.card}>
                  <span style={s.cardLabel}>Ingresos</span>
                  <span style={{ ...s.cardMonto, color: THEME.colors.success }}>{formatMoney(totalIngresos, mon)}</span>
                </div>
                <div style={s.card}>
                  <span style={s.cardLabel}>Egresos</span>
                  <span style={{ ...s.cardMonto, color: THEME.colors.danger }}>{formatMoney(totalEgresos, mon)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* ERA Context Insights */}
          <InsightsERA
            resumen={resumen}
            gastos={gastos}
            subcategorias={subcategorias}
            presupuestos={presupuestos}
            recurrentes={recurrentes}
            cuotas={cuotas}
            mes={mes}
            anio={anio}
          />

          {/* 2-col grid: gastos por cat + últimos movs */}
          <div style={{ ...s.twoColGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            {/* Gastos por categoría */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>Gastos por categoría</h3>
              {gastos.length === 0 ? (
                <span style={s.sinDatos}>Sin datos</span>
              ) : (
                <div style={s.catLista}>
                  {gastos.map((g, i) => {
                    const pct = totalGastos > 0 ? (Number(g.total_egresos) / totalGastos) * 100 : 0
                    return (
                      <div key={i} style={s.catItem}>
                        <div style={s.catRow}>
                          <span style={s.catNombre}>
                            {g.categoria_icono || g.icono
                              ? <CategoryIcon name={g.categoria_icono || g.icono} size={13} color="currentColor" style={{ marginRight: 6, flexShrink: 0, opacity: 0.8 }} />
                              : null}
                            {g.categoria_nombre ?? g.nombre ?? '—'}
                          </span>
                          <span style={s.catMonto}>{formatMoney(g.total_egresos, APP_CONFIG.defaultCurrency)}</span>
                        </div>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${pct}%`, background: THEME.colors.accent }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Gastos por subcategoría */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>Por subcategoría</h3>
              {subcategorias.length === 0 ? (
                <span style={s.sinDatos}>Sin datos</span>
              ) : (
                <div style={s.catLista}>
                  {subcategorias.map((g, i) => {
                    const pct = totalGastos > 0 ? (Number(g.total_egresos) / totalGastos) * 100 : 0
                    return (
                      <div key={i} style={s.catItem}>
                        <div style={s.catRow}>
                          <span style={s.catNombre}>
                            {g.categoria_icono || g.icono
                              ? <CategoryIcon name={g.categoria_icono || g.icono} size={13} color="currentColor" style={{ marginRight: 6, flexShrink: 0, opacity: 0.8 }} />
                              : null}
                            {g.categoria_nombre}
                          </span>
                          <span style={s.catMonto}>{formatMoney(g.total_egresos, APP_CONFIG.defaultCurrency)}</span>
                        </div>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${pct}%`, background: THEME.colors.accent }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pendientes del mes */}
          {esMesActual && totalPendientes > 0 && (
            <div style={s.pendCard}>
              <div style={s.pendHeader}>
                <span style={s.pendTitle}>
                  <Clock size={15} color={THEME.colors.warning} />
                  Pendientes del mes
                </span>
                <span style={s.pendBadge}>{totalPendientes}</span>
              </div>

              {recPend.length > 0 && (
                <>
                  <span style={s.pendSubtitle}>Recurrentes</span>
                  {recPend.map(r => (
                    <PendienteItem
                      key={`rec-${r.id}`}
                      label={r.descripcion}
                      sub={`${r.cuenta?.nombre} · día ${r.dia_del_mes}`}
                      monto={r.monto}
                      moneda={r.moneda}
                      tipo={r.tipo}
                      onAplicar={() => handleAplicarRec(r)}
                      onNoAplicar={() => handleNoAplicarRec(r.id)}
                      aplicando={aplicandoId === `rec-${r.id}`}
                    />
                  ))}
                </>
              )}

              {cuotasPend.length > 0 && (
                <>
                  <span style={s.pendSubtitle}>Cuotas</span>
                  {cuotasPend.map(c => (
                    <PendienteItem
                      key={`cuota-${c.id}`}
                      label={c.descripcion}
                      sub={`Cuota ${c.cuotas_pagadas + 1}/${c.cantidad_cuotas} · ${c.cuenta?.nombre}`}
                      monto={c.monto_cuota}
                      moneda={c.moneda}
                      tipo="egreso"
                      onAplicar={() => handlePagarCuota(c)}
                      onNoAplicar={() => handleNoAplicarCuota(c.id)}
                      aplicando={aplicandoId === `cuota-${c.id}`}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={() => setModalAbierto(true)} style={s.fab} aria-label="Nuevo movimiento">
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {modalAbierto && (
        <ModalMovimiento
          movimiento={null}
          onClose={() => setModalAbierto(false)}
          onSaved={() => { setModalAbierto(false); fetchData() }}
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
  mesLabel: { fontSize: '16px', fontWeight: '700', color: THEME.colors.textPrimary, textTransform: 'capitalize' },
  logoutBtn: {
    background: 'transparent', border: `1px solid ${THEME.colors.cardBorder}`,
    color: THEME.colors.danger, borderRadius: THEME.radius.sm,
    cursor: 'pointer', padding: '6px 10px', minHeight: '44px', minWidth: '44px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginLeft: '8px',
  },
  monedaLabel: {
    display: 'block', fontSize: '11px', fontWeight: 700, color: THEME.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', marginTop: '4px',
  },
  error: {
    marginBottom: '16px', background: THEME.colors.errorBg, color: THEME.colors.danger,
    borderRadius: THEME.radius.sm, padding: '10px 14px', fontSize: '13px',
  },
  loadingWrap: { textAlign: 'center', padding: '60px 16px', color: THEME.colors.textMuted, fontSize: '14px' },
  cardsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' },
  twoColGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' },
  card: {
    padding: '18px 16px', borderRadius: THEME.radius.lg,
    background: THEME.colors.card, border: `1px solid ${THEME.colors.cardBorder}`,
  },
  cardLabel: {
    display: 'block', fontSize: '11px', color: THEME.colors.textMuted,
    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px',
  },
  cardMonto: { display: 'block', fontSize: '20px', fontWeight: 700, marginTop: '8px' },
  cardTitle: { margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: THEME.colors.textPrimary },
  sinDatos: { fontSize: '13px', color: THEME.colors.textMuted },
  catLista: { display: 'flex', flexDirection: 'column', gap: '14px' },
  catItem: { display: 'flex', flexDirection: 'column', gap: '6px' },
  catRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  catNombre: { fontSize: '13px', color: THEME.colors.textPrimary, fontWeight: 500, display: 'flex', alignItems: 'center' },
  catMonto: { fontSize: '12px', color: THEME.colors.textMuted },
  barTrack: { height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.4s ease' },
  pendCard: {
    background: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
    border: `1px solid ${THEME.colors.warning}33`,
  },
  pendHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' },
  pendTitle: {
    fontSize: '15px', fontWeight: 600, color: THEME.colors.textPrimary,
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  pendBadge: { background: THEME.colors.warning, color: '#000', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, padding: '2px 8px' },
  pendSubtitle: { fontSize: '11px', fontWeight: 600, color: THEME.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' },
  fab: {
    position: 'fixed', bottom: '24px', right: '24px',
    width: '56px', height: '56px', borderRadius: '9999px',
    background: THEME.colors.accent, color: '#fff', border: 'none',
    cursor: 'pointer', boxShadow: THEME.shadow.lg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 150, transition: 'all 0.15s',
  },
}

const sp = {
  item: { display: 'flex', alignItems: 'center', gap: '10px', paddingBlock: '8px', borderBottom: `1px solid ${THEME.colors.cardBorder}` },
  itemInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
  itemLabel: { fontSize: '13px', fontWeight: 600, color: THEME.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSub: { fontSize: '11px', color: THEME.colors.textMuted },
  itemMonto: { fontSize: '13px', fontWeight: 700, flexShrink: 0 },
  noAplicarBtn: {
    height: '32px', padding: '0 10px', background: 'transparent',
    color: THEME.colors.textMuted, border: `1px solid ${THEME.colors.cardBorder}`,
    borderRadius: THEME.radius.sm, fontSize: '12px', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
  },
  aplicarBtn: {
    height: '32px', padding: '0 12px', background: THEME.colors.accentSoft,
    color: THEME.colors.accent, border: 'none', borderRadius: THEME.radius.sm,
    fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
  },
}
