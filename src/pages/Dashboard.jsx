import { useState, useEffect } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import {
  getResumenMes,
  getGastosPorCategoria,
  getMovimientos,
  getPendientesMes,
  aplicarRecurrente,
  pagarCuota,
  getMesAnioActual,
  navegarMes,
  labelMes,
} from '../lib/finanzas'
import ModalMovimiento from '../components/ModalMovimiento'
import { Clock, ChevronLeft, ChevronRight, Plus, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

function PendienteItem({ label, sub, monto, moneda, tipo, onAplicar, aplicando }) {
  const color = tipo === 'ingreso' ? THEME.colors.success : THEME.colors.danger
  const signo = tipo === 'ingreso' ? '+' : '-'
  return (
    <div style={sp.item}>
      <div style={sp.itemInfo}>
        <span style={sp.itemLabel}>{label}</span>
        <span style={sp.itemSub}>{sub}</span>
      </div>
      <span style={{ ...sp.itemMonto, color }}>{signo}{formatMoney(monto, moneda)}</span>
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
  const [moneda, setMoneda] = useState(APP_CONFIG.defaultCurrency)

  const [resumen, setResumen] = useState([])
  const [gastos, setGastos] = useState([])
  const [ultimosMovs, setUltimosMovs] = useState([])
  const [pendientes, setPendientes] = useState({ recurrentes_pendientes: [], cuotas_pendientes: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [aplicandoId, setAplicandoId] = useState(null)

  const esMesActual = (() => { const a = getMesAnioActual(); return mes === a.mes && anio === a.anio })()

  useEffect(() => { fetchData() }, [mes, anio, moneda])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [r, g, p, movs] = await Promise.all([
        getResumenMes(mes, anio),
        getGastosPorCategoria(mes, anio, moneda),
        getPendientesMes(mes, anio),
        getMovimientos({ mes, anio }),
      ])
      setResumen(r)
      setGastos(g)
      setPendientes(p)
      setUltimosMovs((movs ?? []).slice(0, 5))
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const filaMoneda = resumen.filter(r => r.moneda === moneda)
  const totalIngresos = filaMoneda.reduce((a, r) => a + Number(r.total_ingresos ?? 0), 0)
  const totalEgresos = filaMoneda.reduce((a, r) => a + Number(r.total_egresos ?? 0), 0)
  const balance = totalIngresos - totalEgresos

  const recPend = pendientes.recurrentes_pendientes ?? []
  const cuotasPend = pendientes.cuotas_pendientes ?? []
  const totalPendientes = recPend.length + cuotasPend.length

  // Calcular total de gastos para porcentajes
  const totalGastos = gastos.reduce((a, g) => a + Number(g.total_egresos ?? 0), 0)

  return (
    <div style={{ ...s.root, padding: isMobile ? '16px' : '28px 32px 32px' }}>
      {/* Header row: MonthNav + CurrToggle */}
      <div style={{ ...s.headerRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '16px' : '0' }}>
        <div style={{ ...s.monthNav, justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
          <button onClick={() => irMes(-1)} style={s.navBtn}>
            <ChevronLeft size={18} />
          </button>
          <span style={s.mesLabel}>{labelMes(mes, anio)}</span>
          <button onClick={() => irMes(1)} style={s.navBtn}>
            <ChevronRight size={18} />
          </button>
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
          {isMobile && (
            <button 
              onClick={() => supabase.auth.signOut()} 
              style={{ ...s.currBtn, background: 'transparent', border: `1px solid ${THEME.colors.cardBorder}`, color: THEME.colors.danger }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : (
        <>
          {/* 3-col cards grid */}
          <div style={{ ...s.cardsGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr' }}>
            <div style={s.card}>
              <span style={s.cardLabel}>Balance</span>
              <span style={{ ...s.cardMonto, color: THEME.colors.textPrimary }}>{formatMoney(balance, moneda)}</span>
            </div>
            <div style={s.card}>
              <span style={s.cardLabel}>Ingresos</span>
              <span style={{ ...s.cardMonto, color: THEME.colors.success }}>{formatMoney(totalIngresos, moneda)}</span>
            </div>
            <div style={s.card}>
              <span style={s.cardLabel}>Egresos</span>
              <span style={{ ...s.cardMonto, color: THEME.colors.danger }}>{formatMoney(totalEgresos, moneda)}</span>
            </div>
          </div>

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
                          <span style={s.catNombre}>{g.icono ? `${g.icono} ` : ''}{g.categoria_nombre ?? g.nombre ?? '—'}</span>
                          <span style={s.catMonto}>{formatMoney(g.total_egresos, moneda)}</span>
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

            {/* Últimos movimientos */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>Últimos movimientos</h3>
              {ultimosMovs.length === 0 ? (
                <span style={s.sinDatos}>Sin movimientos</span>
              ) : (
                <div style={s.movsLista}>
                  {ultimosMovs.map((mov) => {
                    const esIngreso = mov.tipo === 'ingreso'
                    const color = esIngreso ? THEME.colors.success : THEME.colors.danger
                    const signo = esIngreso ? '+' : '-'
                    const cat = mov.categoria
                    const catIcono = cat?.icono ?? (cat?.parent?.icono ?? '📦')
                    const catNombre = cat
                      ? cat.parent ? `${cat.parent.nombre} › ${cat.nombre}` : cat.nombre
                      : '—'
                    const fechaStr = new Date(mov.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                    return (
                      <div key={mov.id} style={s.movItem}>
                        <div style={s.movLeft}>
                          <div style={s.movIconBox}>{catIcono}</div>
                          <div style={s.movInfo}>
                            <span style={s.movDesc}>{mov.descripcion || catNombre}</span>
                            <span style={s.movMeta}>{catNombre} · {fechaStr}</span>
                          </div>
                        </div>
                        <span style={{ ...s.movMonto, color }}>{signo}{formatMoney(mov.monto, mov.moneda)}</span>
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
  currToggle: { display: 'inline-flex', gap: '4px' },
  currBtn: {
    padding: '6px 14px', borderRadius: THEME.radius.full, fontSize: '12px',
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: THEME.font,
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
  catNombre: { fontSize: '13px', color: THEME.colors.textPrimary, fontWeight: 500 },
  catMonto: { fontSize: '12px', color: THEME.colors.textMuted },
  barTrack: { height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.4s ease' },
  movsLista: { display: 'flex', flexDirection: 'column', gap: '6px' },
  movItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderRadius: THEME.radius.sm,
    background: THEME.colors.surface, cursor: 'pointer',
  },
  movLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  movIconBox: {
    width: '32px', height: '32px', borderRadius: THEME.radius.sm,
    background: THEME.colors.accentSoft, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '14px', flexShrink: 0,
  },
  movInfo: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  movDesc: {
    fontSize: '13px', fontWeight: 500, color: THEME.colors.textPrimary,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  movMeta: { fontSize: '11px', color: THEME.colors.textMuted },
  movMonto: { fontSize: '13px', fontWeight: 700, flexShrink: 0, marginLeft: '8px' },
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
  aplicarBtn: {
    height: '32px', padding: '0 12px', background: THEME.colors.accentSoft,
    color: THEME.colors.accent, border: 'none', borderRadius: THEME.radius.sm,
    fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
  },
}
