import { useState, useEffect } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import {
  getResumenMes,
  getGastosPorCategoria,
  getPendientesMes,
  aplicarRecurrente,
  pagarCuota,
  getMesAnioActual,
  navegarMes,
  labelMes,
} from '../lib/finanzas'
import TarjetaResumen from '../components/TarjetaResumen'
import GraficoGastos from '../components/GraficoGastos'
import ModalMovimiento from '../components/ModalMovimiento'
import { Clock, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

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
      const [r, g, p] = await Promise.all([
        getResumenMes(mes, anio),
        getGastosPorCategoria(mes, anio, moneda),
        getPendientesMes(mes, anio),
      ])
      setResumen(r)
      setGastos(g)
      setPendientes(p)
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

  const filaMoneda = resumen.filter(r => r.moneda === moneda)
  const totalIngresos = filaMoneda.reduce((a, r) => a + Number(r.total_ingresos ?? 0), 0)
  const totalEgresos = filaMoneda.reduce((a, r) => a + Number(r.total_egresos ?? 0), 0)
  const balance = totalIngresos - totalEgresos

  const recPend = pendientes.recurrentes_pendientes ?? []
  const cuotasPend = pendientes.cuotas_pendientes ?? []
  const totalPendientes = recPend.length + cuotasPend.length

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button onClick={() => irMes(-1)} style={s.navBtn}>
          <ChevronLeft size={20} />
        </button>
        <span style={s.mesLabel}>{labelMes(mes, anio)}</span>
        <button onClick={() => irMes(1)} style={s.navBtn}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={s.monedaRow}>
        {Object.keys(APP_CONFIG.currencies).map(c => (
          <button
            key={c}
            onClick={() => setMoneda(c)}
            style={{
              ...s.monedaBtn,
              background: moneda === c ? THEME.colors.primary : THEME.colors.surface,
              color: moneda === c ? '#fff' : THEME.colors.textSecondary,
              fontWeight: moneda === c ? '600' : '400',
              border: `1.5px solid ${moneda === c ? THEME.colors.primary : THEME.colors.border}`,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : (
        <div style={s.body}>
          <div style={s.tarjetasRow}>
            <TarjetaResumen label="Balance" valor={balance} moneda={moneda} tipo="balance" />
            <TarjetaResumen label="Ingresos" valor={totalIngresos} moneda={moneda} tipo="ingreso" />
            <TarjetaResumen label="Egresos" valor={totalEgresos} moneda={moneda} tipo="egreso" />
          </div>

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

          <div style={s.graficoCard}>
            <h3 style={s.seccionTitle}>Gastos por categoría</h3>
            <GraficoGastos datos={gastos} moneda={moneda} />
          </div>
        </div>
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
  root: { minHeight: '100svh', background: THEME.colors.bg, paddingBottom: '100px' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 16px 12px', background: THEME.colors.surface,
    borderBottom: `1px solid ${THEME.colors.border}`, position: 'sticky', top: 0, zIndex: 10,
  },
  navBtn: {
    background: 'none', border: 'none', color: THEME.colors.primary,
    cursor: 'pointer', padding: '4px 8px', minWidth: '44px', minHeight: '44px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: THEME.radius.sm, transition: 'opacity 0.15s',
  },
  mesLabel: { fontSize: '17px', fontWeight: '700', color: THEME.colors.textPrimary, textTransform: 'capitalize' },
  monedaRow: { display: 'flex', gap: '8px', padding: '12px 16px' },
  monedaBtn: { height: '36px', padding: '0 16px', borderRadius: THEME.radius.full, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' },
  error: { margin: '0 16px 8px', background: THEME.colors.errorBg, color: THEME.colors.danger, borderRadius: THEME.radius.sm, padding: '10px 14px', fontSize: '13px' },
  loadingWrap: { textAlign: 'center', padding: '60px 16px', color: THEME.colors.textSecondary, fontSize: '14px' },
  body: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px' },
  tarjetasRow: { display: 'flex', gap: '10px', marginTop: '4px' },
  pendCard: {
    background: THEME.colors.surface, borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.sm,
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
    border: `1px solid ${THEME.colors.warning}33`,
  },
  pendHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px',
  },
  pendTitle: {
    fontSize: '15px', fontWeight: '600', color: THEME.colors.textPrimary,
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  pendBadge: { background: THEME.colors.warning, color: '#000', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', padding: '2px 8px' },
  pendSubtitle: { fontSize: '11px', fontWeight: '600', color: THEME.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' },
  graficoCard: { background: THEME.colors.surface, borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.sm, padding: '16px' },
  seccionTitle: { margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: THEME.colors.textPrimary },
  fab: {
    position: 'fixed', bottom: '80px', right: '20px',
    width: '56px', height: '56px', borderRadius: '9999px',
    background: THEME.colors.primary, color: '#fff', border: 'none',
    cursor: 'pointer', boxShadow: THEME.shadow.lg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 150, transition: 'all 0.15s',
  },
}

const sp = {
  item: { display: 'flex', alignItems: 'center', gap: '10px', paddingBlock: '8px', borderBottom: `1px solid ${THEME.colors.border}` },
  itemInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
  itemLabel: { fontSize: '13px', fontWeight: '600', color: THEME.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSub: { fontSize: '11px', color: THEME.colors.textMuted },
  itemMonto: { fontSize: '13px', fontWeight: '700', flexShrink: 0 },
  aplicarBtn: {
    height: '32px', padding: '0 12px', background: THEME.colors.primaryLight,
    color: THEME.colors.primary, border: 'none', borderRadius: THEME.radius.sm,
    fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0,
    transition: 'all 0.15s',
  },
}
