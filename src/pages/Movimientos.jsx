import { useState, useEffect, useCallback, useMemo } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import {
  getMovimientos,
  eliminarMovimiento,
  getMesAnioActual,
  navegarMes,
  labelMes,
} from '../lib/finanzas'
import ModalMovimiento from '../components/ModalMovimiento'
import { ChevronLeft, ChevronRight, Plus, List } from 'lucide-react'

export default function Movimientos() {
  const inicial = getMesAnioActual()
  const [mes, setMes] = useState(inicial.mes)
  const [anio, setAnio] = useState(inicial.anio)

  const [tipoFiltro, setTipoFiltro] = useState('')
  const [search, setSearch] = useState('')

  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalMov, setModalMov] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getMovimientos({ mes, anio })
      setMovimientos(data)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [mes, anio])

  useEffect(() => { fetchData() }, [fetchData])

  function irMes(delta) {
    const n = navegarMes(mes, anio, delta)
    setMes(n.mes)
    setAnio(n.anio)
  }

  function abrirEditar(mov) {
    setModalMov(mov)
    setModalAbierto(true)
  }

  async function handleEliminar() {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await eliminarMovimiento(confirmEliminar.id)
      setConfirmEliminar(null)
      setModalMov(null)
      setModalAbierto(false)
      fetchData()
    } catch (e) {
      setError(e.message)
    }
    setEliminando(false)
  }

  // Filtro local en memoria
  const movsFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      const matchTipo = tipoFiltro === '' || m.tipo === tipoFiltro
      const matchSearch = search === '' || (m.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
      return matchTipo && matchSearch
    })
  }, [movimientos, tipoFiltro, search])

  return (
    <div style={{ ...s.root, padding: isMobile ? '16px' : '28px 32px 32px' }}>
      {/* MonthNav */}
      <div style={s.header}>
        <button onClick={() => irMes(-1)} style={s.navBtn}>
          <ChevronLeft size={18} />
        </button>
        <span style={s.mesLabel}>{labelMes(mes, anio)}</span>
        <button onClick={() => irMes(1)} style={s.navBtn}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Filter row: chips + search */}
      <div style={{ ...s.filterRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
        <div style={{ ...s.chips, overflowX: 'auto', paddingBottom: isMobile ? '4px' : 0 }}>
          {[
            { value: '', label: 'todos' },
            { value: 'egreso', label: 'egresos' },
            { value: 'ingreso', label: 'ingresos' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTipoFiltro(value)}
              style={{
                ...s.chip,
                flex: isMobile ? 1 : 'none',
                background: tipoFiltro === value ? THEME.colors.accent : 'transparent',
                color: tipoFiltro === value ? '#fff' : THEME.colors.textMuted,
                border: `1px solid ${tipoFiltro === value ? THEME.colors.accent : THEME.colors.cardBorder}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar..."
          style={{ ...s.searchInput, maxWidth: isMobile ? '100%' : '280px' }}
        />
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : movsFiltrados.length === 0 ? (
        <div style={s.empty}>
          <List size={48} color={THEME.colors.textMuted} strokeWidth={1.2} style={{ opacity: 0.4 }} />
          <span style={s.emptyText}>Sin movimientos en este período</span>
        </div>
      ) : (
        <div style={s.lista}>
          {movsFiltrados.map((mov, i) => {
            const esIngreso = mov.tipo === 'ingreso'
            const color = esIngreso ? THEME.colors.success : THEME.colors.danger
            const signo = esIngreso ? '+' : '-'
            const cat = mov.categoria
            const catNombre = cat
              ? cat.parent ? `${cat.parent.nombre} › ${cat.nombre}` : cat.nombre
              : '—'
            const catIcono = cat?.icono ?? (cat?.parent?.icono ?? '📦')
            const fechaStr = new Date(mov.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
            return (
              <button
                key={mov.id}
                onClick={() => abrirEditar(mov)}
                style={{
                  ...s.item,
                  animation: 'fadeIn 0.25s ease both',
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <div style={s.itemLeft}>
                  <div style={s.iconBox}>{catIcono}</div>
                  <div style={s.itemInfo}>
                    <span style={s.itemDesc}>{mov.descripcion || catNombre}</span>
                    <span style={s.itemMeta}>{catNombre} · {mov.cuenta?.nombre} · {fechaStr}</span>
                  </div>
                </div>
                <span style={{ ...s.itemMonto, color }}>{signo}{formatMoney(mov.monto, mov.moneda)}</span>
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={() => { setModalMov(null); setModalAbierto(true) }}
        style={s.fab}
        aria-label="Nuevo movimiento"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {modalAbierto && (
        <ModalMovimiento
          movimiento={modalMov}
          onClose={() => { setModalAbierto(false); setModalMov(null) }}
          onSaved={() => { setModalAbierto(false); setModalMov(null); fetchData() }}
          onEliminar={modalMov ? () => { setModalAbierto(false); setConfirmEliminar(modalMov) } : undefined}
        />
      )}

      {confirmEliminar && (
        <div style={s.confirmOverlay} onClick={e => e.target === e.currentTarget && setConfirmEliminar(null)}>
          <div style={s.confirmSheet}>
            <h3 style={s.confirmTitle}>Eliminar movimiento</h3>
            <p style={s.confirmText}>
              ¿Confirmás que querés eliminar este movimiento? Esta acción no se puede deshacer.
            </p>
            <div style={s.confirmActions}>
              <button onClick={() => setConfirmEliminar(null)} style={s.cancelBtn}>Cancelar</button>
              <button onClick={handleEliminar} disabled={eliminando} style={s.confirmDeleteBtn}>
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  root: { minHeight: '100vh', background: THEME.colors.bg, padding: '28px 32px 32px' },
  header: {
    display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px',
  },
  navBtn: {
    background: 'none', border: 'none', color: THEME.colors.accent,
    cursor: 'pointer', padding: '4px 8px', minWidth: '44px', minHeight: '44px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: THEME.radius.sm, transition: 'opacity 0.15s',
  },
  mesLabel: { fontSize: '16px', fontWeight: 700, color: THEME.colors.textPrimary, textTransform: 'capitalize' },
  filterRow: {
    display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap',
  },
  chips: { display: 'flex', gap: '4px' },
  chip: {
    padding: '7px 16px', borderRadius: THEME.radius.sm, fontSize: '12px',
    fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
    transition: 'all 0.2s', fontFamily: THEME.font, minHeight: '44px',
    display: 'flex', alignItems: 'center',
  },
  searchInput: {
    flex: 1, maxWidth: '280px', padding: '8px 14px',
    background: THEME.colors.inputBg, border: `1px solid ${THEME.colors.inputBorder}`,
    borderRadius: THEME.radius.sm, color: THEME.colors.textPrimary,
    fontSize: '12px', outline: 'none', fontFamily: THEME.font,
    minHeight: '44px', boxSizing: 'border-box',
  },
  error: {
    marginBottom: '12px', background: THEME.colors.errorBg, color: THEME.colors.danger,
    borderRadius: THEME.radius.sm, padding: '10px 14px', fontSize: '13px',
  },
  loadingWrap: { textAlign: 'center', padding: '60px 16px', color: THEME.colors.textMuted, fontSize: '14px' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '12px', padding: '60px 16px',
  },
  emptyText: { fontSize: '15px', color: THEME.colors.textMuted },
  lista: { display: 'flex', flexDirection: 'column', gap: '6px' },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderRadius: THEME.radius.sm,
    background: THEME.colors.card, border: `1px solid ${THEME.colors.cardBorder}`,
    cursor: 'pointer', textAlign: 'left', width: '100%',
    fontFamily: THEME.font,
  },
  itemLeft: { display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0, flex: 1 },
  iconBox: {
    width: '38px', height: '38px', borderRadius: THEME.radius.sm,
    background: THEME.colors.accentSoft, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '16px', flexShrink: 0,
  },
  itemInfo: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  itemDesc: {
    fontSize: '13px', fontWeight: 500, color: THEME.colors.textPrimary,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  itemMeta: { fontSize: '11px', color: THEME.colors.textMuted, marginTop: '2px' },
  itemMonto: { fontSize: '15px', fontWeight: 700, flexShrink: 0, marginLeft: '8px' },
  fab: {
    position: 'fixed', bottom: '24px', right: '24px',
    width: '56px', height: '56px', borderRadius: '9999px',
    background: THEME.colors.accent, color: '#fff', border: 'none',
    cursor: 'pointer', boxShadow: THEME.shadow.lg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 150, transition: 'all 0.15s',
  },
  confirmOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  confirmSheet: {
    background: '#181b24', borderRadius: `${THEME.radius.xl} ${THEME.radius.xl} 0 0`,
    width: '100%', maxWidth: '600px', padding: '24px 20px 40px', boxSizing: 'border-box',
    animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  confirmTitle: { margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: THEME.colors.textPrimary },
  confirmText: { margin: '0 0 24px', fontSize: '14px', color: THEME.colors.textMuted, lineHeight: '1.5' },
  confirmActions: { display: 'flex', gap: '12px' },
  cancelBtn: {
    flex: 1, height: '52px', background: THEME.colors.inputBg, color: THEME.colors.textMuted,
    border: `1.5px solid ${THEME.colors.cardBorder}`, borderRadius: THEME.radius.sm,
    fontSize: '15px', fontWeight: 500, cursor: 'pointer', fontFamily: THEME.font,
  },
  confirmDeleteBtn: {
    flex: 2, height: '52px', background: THEME.colors.danger, color: '#fff',
    border: 'none', borderRadius: THEME.radius.sm, fontSize: '15px', fontWeight: 600,
    cursor: 'pointer', fontFamily: THEME.font,
  },
}
