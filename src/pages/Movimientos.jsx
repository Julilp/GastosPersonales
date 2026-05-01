import { useState, useEffect, useCallback } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import {
  getMovimientos,
  eliminarMovimiento,
  getCuentas,
  getMesAnioActual,
  navegarMes,
  labelMes,
} from '../lib/finanzas'
import ModalMovimiento from '../components/ModalMovimiento'
import { ChevronLeft, ChevronRight, Plus, List } from 'lucide-react'

function ItemMovimiento({ mov, onClick }) {
  const egresoColor = THEME.colors.danger
  const ingresoColor = THEME.colors.success
  const color = mov.tipo === 'ingreso' ? ingresoColor : egresoColor
  const signo = mov.tipo === 'ingreso' ? '+' : '-'

  const cat = mov.categoria
  const catNombre = cat
    ? cat.parent
      ? `${cat.parent.nombre} › ${cat.nombre}`
      : cat.nombre
    : '—'
  const catIcono = cat?.icono ?? (cat?.parent?.icono ?? '📦')

  const fechaStr = new Date(mov.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  })

  return (
    <button onClick={() => onClick(mov)} style={s.item}>
      <span style={s.itemIcon}>{catIcono}</span>
      <div style={s.itemInfo}>
        <span style={s.itemCat}>{catNombre}</span>
        {mov.descripcion && <span style={s.itemDesc}>{mov.descripcion}</span>}
        <span style={s.itemMeta}>{mov.cuenta?.nombre} · {fechaStr}</span>
      </div>
      <span style={{ ...s.itemMonto, color }}>
        {signo}{formatMoney(mov.monto, mov.moneda)}
      </span>
    </button>
  )
}

export default function Movimientos() {
  const inicial = getMesAnioActual()
  const [mes, setMes] = useState(inicial.mes)
  const [anio, setAnio] = useState(inicial.anio)

  const [tipo, setTipo] = useState('')
  const [moneda, setMoneda] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [search, setSearch] = useState('')

  const [movimientos, setMovimientos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalMov, setModalMov] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    getCuentas().then(setCuentas).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getMovimientos({
        mes,
        anio,
        tipo: tipo || undefined,
        moneda: moneda || undefined,
        cuenta_id: cuentaId || undefined,
        search: search || undefined,
      })
      setMovimientos(data)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [mes, anio, tipo, moneda, cuentaId, search])

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

      <div style={s.filtros}>
        <div style={s.filtroRow}>
          {['', 'egreso', 'ingreso'].map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              style={{
                ...s.chip,
                background: tipo === t ? THEME.colors.primary : THEME.colors.bg,
                color: tipo === t ? '#fff' : THEME.colors.textSecondary,
                border: `1.5px solid ${tipo === t ? THEME.colors.primary : THEME.colors.border}`,
                fontWeight: tipo === t ? '600' : '400',
              }}
            >
              {t === '' ? 'Todos' : t === 'egreso' ? 'Egresos' : 'Ingresos'}
            </button>
          ))}
        </div>

        <div style={{ ...s.filtroRow, gap: '8px' }}>
          <select
            value={moneda}
            onChange={e => setMoneda(e.target.value)}
            style={s.filtroSelect}
          >
            <option value="">Todas las monedas</option>
            {Object.keys(APP_CONFIG.currencies).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={cuentaId}
            onChange={e => setCuentaId(e.target.value)}
            style={s.filtroSelect}
          >
            <option value="">Todas las cuentas</option>
            {cuentas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por descripción..."
          style={s.searchInput}
        />
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : movimientos.length === 0 ? (
        <div style={s.empty}>
          <List size={48} color={THEME.colors.textMuted} strokeWidth={1.2} style={{ opacity: 0.4 }} />
          <span style={s.emptyText}>Sin movimientos en este período</span>
        </div>
      ) : (
        <div style={s.lista}>
          {movimientos.map(mov => (
            <ItemMovimiento key={mov.id} mov={mov} onClick={abrirEditar} />
          ))}
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
              <button
                onClick={() => setConfirmEliminar(null)}
                style={s.cancelBtn}
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                style={s.confirmDeleteBtn}
              >
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
  root: {
    minHeight: '100svh',
    background: THEME.colors.bg,
    paddingBottom: '100px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 16px 12px',
    background: THEME.colors.surface,
    borderBottom: `1px solid ${THEME.colors.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navBtn: {
    background: 'none',
    border: 'none',
    color: THEME.colors.primary,
    cursor: 'pointer',
    padding: '4px 8px',
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.sm,
    transition: 'opacity 0.15s',
  },
  mesLabel: {
    fontSize: '17px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textTransform: 'capitalize',
  },
  filtros: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: THEME.colors.surface,
    borderBottom: `1px solid ${THEME.colors.border}`,
  },
  filtroRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  chip: {
    height: '36px',
    padding: '0 14px',
    borderRadius: THEME.radius.full,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    minWidth: '44px',
  },
  filtroSelect: {
    flex: 1,
    height: '40px',
    padding: '0 12px',
    borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`,
    fontSize: '13px',
    color: THEME.colors.textPrimary,
    background: THEME.colors.bg,
    outline: 'none',
    cursor: 'pointer',
    minWidth: 0,
  },
  searchInput: {
    height: '40px',
    padding: '0 14px',
    borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`,
    fontSize: '14px',
    color: THEME.colors.textPrimary,
    background: THEME.colors.bg,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    margin: '12px 16px 0',
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    borderRadius: THEME.radius.sm,
    padding: '10px 14px',
    fontSize: '13px',
  },
  loadingWrap: {
    textAlign: 'center',
    padding: '60px 16px',
    color: THEME.colors.textSecondary,
    fontSize: '14px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '60px 16px',
  },
  emptyText: {
    fontSize: '15px',
    color: THEME.colors.textMuted,
  },
  lista: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: '14px 16px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    boxShadow: THEME.shadow.sm,
    minHeight: '72px',
    transition: 'background 0.15s',
  },
  itemIcon: {
    fontSize: '24px',
    lineHeight: 1,
    flexShrink: 0,
    width: '36px',
    textAlign: 'center',
  },
  itemInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  itemCat: {
    fontSize: '14px',
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemDesc: {
    fontSize: '12px',
    color: THEME.colors.textSecondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemMeta: {
    fontSize: '11px',
    color: THEME.colors.textMuted,
  },
  itemMonto: {
    fontSize: '15px',
    fontWeight: '700',
    flexShrink: 0,
    letterSpacing: '-0.2px',
  },
  fab: {
    position: 'fixed',
    bottom: '88px',
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '9999px',
    background: THEME.colors.primary,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: THEME.shadow.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 150,
    transition: 'all 0.15s',
  },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  confirmSheet: {
    background: THEME.colors.surface,
    borderRadius: `${THEME.radius.xl} ${THEME.radius.xl} 0 0`,
    width: '100%',
    maxWidth: '600px',
    padding: '24px 20px 40px',
    boxSizing: 'border-box',
    animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  confirmTitle: {
    margin: '0 0 8px',
    fontSize: '18px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  confirmText: {
    margin: '0 0 24px',
    fontSize: '14px',
    color: THEME.colors.textSecondary,
    lineHeight: '1.5',
  },
  confirmActions: {
    display: 'flex',
    gap: '12px',
  },
  cancelBtn: {
    flex: 1,
    height: '52px',
    background: THEME.colors.bg,
    color: THEME.colors.textSecondary,
    border: `1.5px solid ${THEME.colors.border}`,
    borderRadius: THEME.radius.md,
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    flex: 2,
    height: '52px',
    background: THEME.colors.danger,
    color: '#fff',
    border: 'none',
    borderRadius: THEME.radius.md,
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}
