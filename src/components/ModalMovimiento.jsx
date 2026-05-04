import { useState, useEffect } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG } from '../config/app.config'
import {
  getCuentas,
  getCategorias,
  crearMovimiento,
  actualizarMovimiento,
  crearTraspaso,
  crearCategoria,
  sugerirCategoria,
} from '../lib/finanzas'
import { X, Trash2, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Sparkles, Check, X as XIcon } from 'lucide-react'
import { CategoryIcon } from '../lib/categoryIcons'

const HOY = () => new Date().toISOString().slice(0, 10)

export default function ModalMovimiento({ movimiento, onClose, onSaved, onEliminar }) {
  const esEdicion = Boolean(movimiento?.id)

  const [tipo, setTipo] = useState(movimiento?.tipo ?? 'egreso')
  const [monto, setMonto] = useState(movimiento?.monto ? String(movimiento.monto) : '')
  const [moneda, setMoneda] = useState(movimiento?.moneda ?? APP_CONFIG.defaultCurrency)
  const [cuentaId, setCuentaId] = useState(movimiento?.cuenta_id ?? '')
  const [categoriaId, setCategoriaId] = useState(movimiento?.categoria_id ?? '')
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? '')
  const [fecha, setFecha] = useState(movimiento?.fecha ?? HOY())

  const [cuentaDestinoId, setCuentaDestinoId] = useState('')
  const [montoDestino, setMontoDestino] = useState('')
  const [monedaDestino, setMonedaDestino] = useState(APP_CONFIG.defaultCurrency)

  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [sugerencia, setSugerencia] = useState(null) // { categoria_id, categoria_nombre, icono, es_nueva }
  const [buscandoSugerencia, setBuscandoSugerencia] = useState(false)
  const [creandoCateg, setCreandoCateg] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [c, cat] = await Promise.all([getCuentas(), getCategorias()])
        setCuentas(c)
        setCategorias(cat)
        if (!esEdicion && c.length) setCuentaId(c[0].id)
      } catch (e) {
        setError(e.message)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (tipo === 'traspaso' || !descripcion.trim() || descripcion.trim().length < 4) {
      setSugerencia(null)
      return
    }
    setSugerencia(null)
    setBuscandoSugerencia(true)
    const timer = setTimeout(async () => {
      try {
        const result = await sugerirCategoria({ descripcion, tipo, categorias })
        setSugerencia(result)
      } catch (_) {}
      setBuscandoSugerencia(false)
    }, 700)
    return () => { clearTimeout(timer); setBuscandoSugerencia(false) }
  }, [descripcion, tipo])

  const opcionesCategorias = categorias.flatMap(cat => {
    const items = [{ id: cat.id, label: cat.nombre, indent: false }]
    if (cat.subcategorias?.length) {
      cat.subcategorias.forEach(sub => {
        items.push({ id: sub.id, label: sub.nombre, indent: true })
      })
    }
    return items
  })

  async function handleGuardar(e) {
    e.preventDefault()
    setError('')

    const montoNum = parseFloat(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (!cuentaId) { setError('Seleccioná una cuenta'); return }

    if (tipo === 'traspaso') {
      if (!cuentaDestinoId) { setError('Seleccioná la cuenta destino'); return }
      const montoDestinoNum = parseFloat(montoDestino)
      if (!montoDestino || isNaN(montoDestinoNum) || montoDestinoNum <= 0) { setError('El monto destino debe ser mayor a 0'); return }
      setSaving(true)
      try {
        await crearTraspaso({
          origenCuentaId: cuentaId,
          origenMonto: montoNum,
          origenMoneda: moneda,
          destinoCuentaId: cuentaDestinoId,
          destinoMonto: montoDestinoNum,
          destinoMoneda: monedaDestino,
          descripcion: descripcion.trim() || null,
          fecha,
        })
        onSaved()
      } catch (e) { setError(e.message); setSaving(false) }
      return
    }

    if (!categoriaId) { setError('Seleccioná una categoría'); return }
    setSaving(true)
    try {
      const payload = { tipo, monto: montoNum, moneda, cuenta_id: cuentaId, categoria_id: categoriaId, descripcion: descripcion.trim() || null, fecha }
      if (esEdicion) { await actualizarMovimiento(movimiento.id, payload) } else { await crearMovimiento(payload) }
      onSaved()
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />

        <div style={s.header}>
          <h2 style={s.title}>{esEdicion ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          <button onClick={onClose} style={s.closeBtn} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={s.loadingWrap}>Cargando...</div>
        ) : (
          <form onSubmit={handleGuardar} style={s.form}>
            <div style={s.toggleRow}>
              <button
                type="button"
                onClick={() => setTipo('egreso')}
                style={{
                  ...s.toggleBtn,
                  background: tipo === 'egreso' ? THEME.colors.danger : THEME.colors.bg,
                  color: tipo === 'egreso' ? '#fff' : THEME.colors.textSecondary,
                  fontWeight: tipo === 'egreso' ? '600' : '400',
                }}
              >
                <ArrowDownRight size={16} />
                Egreso
              </button>
              <button
                type="button"
                onClick={() => setTipo('ingreso')}
                style={{
                  ...s.toggleBtn,
                  background: tipo === 'ingreso' ? THEME.colors.success : THEME.colors.bg,
                  color: tipo === 'ingreso' ? '#fff' : THEME.colors.textSecondary,
                  fontWeight: tipo === 'ingreso' ? '600' : '400',
                }}
              >
                <ArrowUpRight size={16} />
                Ingreso
              </button>
              <button
                type="button"
                onClick={() => setTipo('traspaso')}
                style={{
                  ...s.toggleBtn,
                  background: tipo === 'traspaso' ? THEME.colors.accent : THEME.colors.bg,
                  color: tipo === 'traspaso' ? '#fff' : THEME.colors.textSecondary,
                  fontWeight: tipo === 'traspaso' ? '600' : '400',
                }}
              >
                <ArrowLeftRight size={16} />
                Traspaso
              </button>
            </div>

            <div style={s.row}>
              <div style={{ ...s.field, flex: 2 }}>
                <label style={s.label}>Monto</label>
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
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Moneda</label>
                <select value={moneda} onChange={e => setMoneda(e.target.value)} style={s.select}>
                  {Object.keys(APP_CONFIG.currencies).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Cuenta</label>
              <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={s.select}>
                <option value="">Seleccioná una cuenta</option>
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {tipo === 'traspaso' && (
              <>
                <div style={s.row}>
                  <div style={{ ...s.field, flex: 2 }}>
                    <label style={s.label}>Monto destino</label>
                    <input type="number" min="0" step="0.01" value={montoDestino} onChange={e => setMontoDestino(e.target.value)} placeholder="0.00" style={s.input} inputMode="decimal" />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <label style={s.label}>Moneda</label>
                    <select value={monedaDestino} onChange={e => setMonedaDestino(e.target.value)} style={s.select}>
                      {Object.keys(APP_CONFIG.currencies).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Cuenta destino</label>
                  <select value={cuentaDestinoId} onChange={e => setCuentaDestinoId(e.target.value)} style={s.select}>
                    <option value="">Seleccioná cuenta destino</option>
                    {cuentas.filter(c => c.id !== cuentaId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </>
            )}

            {tipo !== 'traspaso' && (
              <div style={s.field}>
                <label style={s.label}>Categoría</label>
                <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={s.select}>
                  <option value="">Seleccioná una categoría</option>
                  {opcionesCategorias.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.indent ? '    ' : ''}{opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={s.field}>
              <label style={s.label}>Descripción (opcional)</label>
              <input
                type="text"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: supermercado, nafta..."
                style={s.input}
                maxLength={200}
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                style={s.input}
              />
            </div>

            {error && <div style={s.error}>{error}</div>}

            {esEdicion && onEliminar && (
              <button type="button" onClick={onEliminar} style={s.deleteBtn}>
                <Trash2 size={15} />
                Eliminar movimiento
              </button>
            )}
            <div style={s.actions}>
              <button type="button" onClick={onClose} style={s.cancelBtn}>Cancelar</button>
              <button type="submit" disabled={saving} style={s.saveBtn}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    background: '#1a1d2e',
    borderRadius: `${THEME.radius.xl} ${THEME.radius.xl} 0 0`,
    width: '100%',
    maxWidth: '600px',
    maxHeight: '92svh',
    overflowY: 'auto',
    padding: '12px 20px 32px',
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  title: {
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
  loadingWrap: {
    textAlign: 'center',
    padding: '40px',
    color: THEME.colors.textSecondary,
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  toggleRow: {
    display: 'flex',
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    border: `1.5px solid ${THEME.colors.border}`,
  },
  toggleBtn: {
    flex: 1,
    height: '48px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background 0.15s, color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
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
  error: {
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    borderRadius: THEME.radius.sm,
    padding: '10px 14px',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  deleteBtn: {
    width: '100%',
    height: '44px',
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    border: `1px solid ${THEME.colors.danger}`,
    borderRadius: THEME.radius.md,
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.15s',
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
    transition: 'all 0.15s',
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
    transition: 'all 0.15s',
  },
}
