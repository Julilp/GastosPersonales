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

function BarraProgreso({ gastado, limite }) {
  const pct = limite > 0 ? Math.min((gastado / limite) * 100, 100) : 0
  const superado = gastado > limite
  const color = superado ? THEME.colors.danger : pct > 75 ? THEME.colors.warning : THEME.colors.success

  return (
    <div style={s.barraWrap}>
      <div style={s.barraFondo}>
        <div style={{ ...s.barraRelleno, width: `${pct}%`, background: color }} />
      </div>
      <span style={{ ...s.barraPct, color }}>
        {pct.toFixed(0)}%{superado ? ' ⚠️' : ''}
      </span>
    </div>
  )
}

function ModalPresupuesto({ categorias, presupuestoExistente, mes, anio, moneda, onClose, onSaved }) {
  const [categoriaId, setCategoriaId] = useState(presupuestoExistente?.categoria_id ?? '')
  const [limite, setLimite] = useState(presupuestoExistente?.monto_limite ? String(presupuestoExistente.monto_limite) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Aplanar categorias
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
          <h2 style={s.sheetTitle}>
            {presupuestoExistente ? 'Editar presupuesto' : 'Nuevo presupuesto'}
          </h2>
          <button onClick={onClose} style={s.closeBtn} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Categoría</label>
            <select
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              style={s.select}
              disabled={Boolean(presupuestoExistente)}
            >
              <option value="">Seleccioná una categoría</option>
              {opciones.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Límite ({moneda})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={limite}
              onChange={e => setLimite(e.target.value)}
              placeholder="0.00"
              style={s.input}
              inputMode="decimal"
            />
          </div>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn}>Cancelar</button>
            <button type="submit" disabled={saving} style={s.saveBtn}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
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
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError('La meta debe ser mayor a 0')
      return
    }
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
            <input
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              style={s.input}
              inputMode="decimal"
            />
          </div>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn}>Cancelar</button>
            <button type="submit" disabled={saving} style={s.saveBtn}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
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

  const [modalPresup, setModalPresup] = useState(null)  // null = cerrado, {} = nuevo, objeto = editar
  const [modalPresupAbierto, setModalPresupAbierto] = useState(false)
  const [modalMetaAbierto, setModalMetaAbierto] = useState(false)

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

  // Cruzar presupuestos con gastos por categoría (filtrado por moneda)
  const presupuestosFiltrados = presupuestos.filter(p => p.moneda === moneda)

  const presupuestosConGasto = presupuestosFiltrados.map(p => {
    const gastosCat = gastos.find(g => g.categoria_id === p.categoria_id)
    return {
      ...p,
      gastado: gastosCat ? Number(gastosCat.total_egresos) : 0,
    }
  })

  // Balance del mes para meta de ahorro
  const filaMoneda = resumen.filter(r => r.moneda === moneda)
  const totalIngresos = filaMoneda.reduce((a, r) => a + Number(r.total_ingresos ?? 0), 0)
  const totalEgresos = filaMoneda.reduce((a, r) => a + Number(r.total_egresos ?? 0), 0)
  const balanceMes = totalIngresos - totalEgresos

  const metaMonto = meta ? Number(meta.monto_objetivo) : 0
  const metaPct = metaMonto > 0 ? Math.min((balanceMes / metaMonto) * 100, 100) : 0
  const metaSuperada = balanceMes >= metaMonto && metaMonto > 0
  const metaColor = metaSuperada ? THEME.colors.success : metaPct > 50 ? THEME.colors.warning : THEME.colors.danger

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={() => irMes(-1)} style={s.navBtn}><ChevronLeft size={20} /></button>
        <span style={s.mesLabel}>{labelMes(mes, anio)}</span>
        <button onClick={() => irMes(1)} style={s.navBtn}><ChevronRight size={20} /></button>
      </div>

      {/* Selector moneda */}
      <div style={s.monedaRow}>
        {Object.keys(APP_CONFIG.currencies).map(c => (
          <button
            key={c}
            onClick={() => setMoneda(c)}
            style={{
              ...s.monedaBtn,
              background: moneda === c ? THEME.colors.primary : THEME.colors.bg,
              color: moneda === c ? '#fff' : THEME.colors.textSecondary,
              fontWeight: moneda === c ? '600' : '400',
              border: `1.5px solid ${moneda === c ? THEME.colors.primary : THEME.colors.border}`,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {error && <div style={s.errorMsg}>{error}</div>}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : (
        <div style={s.body}>
          {/* Meta de ahorro */}
          <div style={s.sectionCard}>
            <div style={s.sectionHeaderRow}>
              <h3 style={s.sectionTitle}>Meta de ahorro</h3>
              <button onClick={() => setModalMetaAbierto(true)} style={s.editBtn}>
                {meta ? 'Editar' : 'Configurar'}
              </button>
            </div>
            {meta ? (
              <div style={s.metaContent}>
                <div style={s.metaMontos}>
                  <div style={s.metaCol}>
                    <span style={s.metaSmLabel}>Ahorro actual</span>
                    <span style={{ ...s.metaValor, color: balanceMes >= 0 ? THEME.colors.success : THEME.colors.danger }}>
                      {formatMoney(balanceMes, moneda)}
                    </span>
                  </div>
                  <div style={s.metaDivider} />
                  <div style={s.metaCol}>
                    <span style={s.metaSmLabel}>Meta</span>
                    <span style={s.metaValor}>{formatMoney(metaMonto, moneda)}</span>
                  </div>
                </div>
                <BarraProgreso gastado={balanceMes < 0 ? 0 : balanceMes} limite={metaMonto} />
                {metaSuperada && (
                  <span style={s.metaAlcanzada}>Meta alcanzada</span>
                )}
              </div>
            ) : (
              <p style={s.sinMetaText}>No hay meta configurada para este mes.</p>
            )}
          </div>

          {/* Presupuestos */}
          <div style={s.sectionCard}>
            <div style={s.sectionHeaderRow}>
              <h3 style={s.sectionTitle}>Presupuestos</h3>
              <button
                onClick={() => { setModalPresup({}); setModalPresupAbierto(true) }}
                style={s.addBtn}
              >
                <Plus size={14} /> Agregar
              </button>
            </div>

            {presupuestosConGasto.length === 0 ? (
              <div style={s.emptyPresup}>
                <Target size={40} color={THEME.colors.textMuted} strokeWidth={1.2} style={{ opacity: 0.3 }} />
                <span style={s.emptyText}>Sin presupuestos para este mes</span>
              </div>
            ) : (
              <div style={s.presupLista}>
                {presupuestosConGasto.map(p => (
                  <div key={p.id} style={s.presupItem}>
                    <div style={s.presupTop}>
                      <span style={s.presupIcono}>{p.categoria?.icono ?? '📦'}</span>
                      <div style={s.presupInfo}>
                        <span style={s.presupNombre}>{p.categoria?.nombre ?? '—'}</span>
                        <span style={s.presupMontos}>
                          {formatMoney(p.gastado, moneda)} de {formatMoney(p.monto_limite, moneda)}
                        </span>
                      </div>
                      <button
                        onClick={() => { setModalPresup(p); setModalPresupAbierto(true) }}
                        style={s.editSmBtn}
                        aria-label="Editar presupuesto"
                      >
                        <Pencil size={15} color={THEME.colors.textMuted} />
                      </button>
                    </div>
                    <BarraProgreso gastado={p.gastado} limite={p.monto_limite} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal presupuesto */}
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

      {/* Modal meta */}
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
  monedaRow: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
  },
  monedaBtn: {
    height: '36px',
    padding: '0 16px',
    borderRadius: THEME.radius.full,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  errorMsg: {
    margin: '0 16px 8px',
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
  body: {
    padding: '0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionCard: {
    background: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    boxShadow: THEME.shadow.sm,
    padding: '16px',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  editBtn: {
    height: '34px',
    padding: '0 14px',
    background: THEME.colors.primaryLight,
    color: THEME.colors.primary,
    border: 'none',
    borderRadius: THEME.radius.md,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  addBtn: {
    height: '34px',
    padding: '0 14px',
    background: THEME.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: THEME.radius.md,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background 0.15s',
  },
  metaContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  metaMontos: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  metaCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metaDivider: {
    width: '1px',
    height: '40px',
    background: THEME.colors.border,
  },
  metaSmLabel: {
    fontSize: '11px',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  metaValor: {
    fontSize: '18px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: '-0.3px',
  },
  metaAlcanzada: {
    display: 'inline-block',
    background: THEME.colors.successBg,
    color: THEME.colors.success,
    borderRadius: THEME.radius.full,
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 12px',
    alignSelf: 'flex-start',
  },
  sinMetaText: {
    margin: 0,
    fontSize: '14px',
    color: THEME.colors.textMuted,
    textAlign: 'center',
    padding: '8px 0',
  },
  barraWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  barraFondo: {
    flex: 1,
    height: '8px',
    background: THEME.colors.border,
    borderRadius: '9999px',
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.4s ease',
  },
  barraPct: {
    fontSize: '12px',
    fontWeight: '600',
    minWidth: '44px',
    textAlign: 'right',
  },
  emptyPresup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 0',
  },
  emptyText: {
    fontSize: '14px',
    color: THEME.colors.textMuted,
  },
  presupLista: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  presupItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingBottom: '14px',
    borderBottom: `1px solid ${THEME.colors.border}`,
  },
  presupTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  presupIcono: {
    fontSize: '22px',
    lineHeight: 1,
    flexShrink: 0,
  },
  presupInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: 0,
  },
  presupNombre: {
    fontSize: '14px',
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  presupMontos: {
    fontSize: '12px',
    color: THEME.colors.textSecondary,
  },
  editSmBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Modal
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    background: THEME.colors.surface,
    borderRadius: `${THEME.radius.xl} ${THEME.radius.xl} 0 0`,
    width: '100%',
    maxWidth: '600px',
    maxHeight: '80svh',
    overflowY: 'auto',
    padding: '12px 20px 40px',
    boxSizing: 'border-box',
    animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  handle: {
    width: '40px',
    height: '4px',
    background: THEME.colors.border,
    borderRadius: '9999px',
    margin: '0 auto 16px',
  },
  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  sheetTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeBtn: {
    background: THEME.colors.bg,
    border: `1px solid ${THEME.colors.border}`,
    borderRadius: THEME.radius.sm,
    cursor: 'pointer',
    color: THEME.colors.textMuted,
    padding: '6px',
    lineHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  input: {
    height: '48px',
    padding: '0 14px',
    borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`,
    fontSize: '15px',
    color: THEME.colors.textPrimary,
    background: THEME.colors.bg,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    height: '48px',
    padding: '0 14px',
    borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`,
    fontSize: '15px',
    color: THEME.colors.textPrimary,
    background: THEME.colors.bg,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  errorBox: {
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    borderRadius: THEME.radius.sm,
    padding: '10px 14px',
    fontSize: '13px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
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
  saveBtn: {
    flex: 2,
    height: '52px',
    background: THEME.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: THEME.radius.md,
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}
