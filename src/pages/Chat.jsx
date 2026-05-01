import { useState, useEffect, useRef } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import { getCuentas, getCategorias, crearMovimiento, actualizarMovimiento, eliminarMovimiento } from '../lib/finanzas'
import { supabase } from '../lib/supabaseClient'
import {
  Bot,
  FolderOpen,
  Landmark,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  Send,
  Loader2,
  Trash2,
  Pencil,
} from 'lucide-react'

export default function Chat() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [texto, setTexto] = useState('')
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [parseando, setParseando] = useState(false)
  const [movimientos, setMovimientos] = useState([])
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [editando, setEditando] = useState(null)
  const exitoTimer = useRef(null)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    async function cargar() {
      try {
        const [c, cat] = await Promise.all([getCuentas(), getCategorias()])
        setCuentas(c)
        setCategorias(cat)
      } catch (e) {
        setError(e.message)
      }
    }
    cargar()
  }, [])

  useEffect(() => {
    return () => { if (exitoTimer.current) clearTimeout(exitoTimer.current) }
  }, [])

  const categoriasFlat = categorias.flatMap(cat => {
    const items = [{ id: cat.id, nombre: cat.nombre, icono: cat.icono }]
    if (cat.subcategorias?.length) {
      cat.subcategorias.forEach(sub => {
        items.push({ id: sub.id, nombre: sub.nombre, icono: sub.icono })
      })
    }
    return items
  })

  function nombreCategoria(categoria_id) {
    const cat = categoriasFlat.find(c => c.id === categoria_id)
    if (!cat) return '—'
    return `${cat.icono ?? ''} ${cat.nombre}`.trim()
  }

  function nombreCuenta(cuenta_id) {
    const cuenta = cuentas.find(c => c.id === cuenta_id)
    return cuenta ? cuenta.nombre : '—'
  }

  async function handleInterpretar() {
    if (!texto.trim()) return
    setError('')
    setParseando(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-movimientos', {
        body: {
          texto,
          categorias: categoriasFlat,
          cuentas,
          fecha_hoy: new Date().toISOString().slice(0, 10),
        },
      })
      if (fnError) throw new Error(fnError.message)
      const parsed = Array.isArray(data) ? data : (data?.movimientos ?? [])
      if (!parsed.length) throw new Error('No se encontraron movimientos en el texto.')

      const guardados = await Promise.all(parsed.map(m => crearMovimiento(m)))
      setMovimientos(prev => [...prev, ...guardados])
      setTexto('')
      mostrarExito(`${guardados.length} movimiento${guardados.length !== 1 ? 's' : ''} guardado${guardados.length !== 1 ? 's' : ''}`)
    } catch (e) {
      setError(e.message)
    }
    setParseando(false)
  }

  async function handleEliminar(id) {
    try {
      await eliminarMovimiento(id)
      setMovimientos(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  function handleEditar(mov) {
    setEditando({ ...mov })
  }

  function handleCerrarEdicion() {
    setEditando(null)
  }

  async function handleGuardarEdicion(actualizado) {
    try {
      const { id, ...payload } = actualizado
      const updated = await actualizarMovimiento(id, payload)
      setMovimientos(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m))
      setEditando(null)
    } catch (e) {
      setError(e.message)
    }
  }

  function mostrarExito(msg) {
    setExito(msg)
    if (exitoTimer.current) clearTimeout(exitoTimer.current)
    exitoTimer.current = setTimeout(() => setExito(''), 3000)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleInterpretar()
    }
  }

  const inputBottomOffset = 64

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.titulo}>Chat</h1>
        <p style={s.subtitulo}>Registra tus movimientos en texto libre</p>
      </div>

      <div style={{ ...s.content, paddingBottom: '160px' }}>
        {error && (
          <div style={s.errorBanner}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={s.errorClose}>
              <X size={16} />
            </button>
          </div>
        )}

        {movimientos.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>
              <Bot size={48} color={THEME.colors.textMuted} strokeWidth={1.5} />
            </div>
            <p style={s.emptyTitulo}>Escribi tus movimientos abajo</p>
            <p style={s.emptyDesc}>
              Ej: "gasté 10k en padel, pagué nafta 5k y me depositaron 50k de sueldo"
            </p>
          </div>
        ) : (
          <div style={s.lista}>
            {movimientos.map((mov, index) => (
              <CardMovimiento
                key={mov.id}
                mov={mov}
                index={index}
                nombreCategoria={nombreCategoria}
                nombreCuenta={nombreCuenta}
                onEditar={() => handleEditar(mov)}
                onEliminar={() => handleEliminar(mov.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ ...s.inputBar, bottom: inputBottomOffset }}>
        <div style={s.inputWrap}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: gasté 10k en padel, pagué 5k de nafta y me depositaron 50k de sueldo..."
            rows={3}
            disabled={parseando}
            style={{ ...s.textarea, opacity: parseando ? 0.6 : 1 }}
          />
          <button
            onClick={handleInterpretar}
            disabled={parseando || !texto.trim()}
            style={{
              ...s.interpretarBtn,
              opacity: parseando || !texto.trim() ? 0.5 : 1,
              cursor: parseando || !texto.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {parseando ? (
              <span style={s.spinnerWrap}>
                <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                Guardando...
              </span>
            ) : (
              <span style={s.spinnerWrap}>
                <Send size={16} />
                Interpretar
              </span>
            )}
          </button>
        </div>
        <p style={s.inputHint}>Ctrl+Enter para interpretar</p>
      </div>

      {exito && (
        <div style={s.toast}>
          <Check size={16} strokeWidth={2.5} />
          {exito}
        </div>
      )}

      {editando && (
        <DrawerEdicion
          mov={editando}
          cuentas={cuentas}
          categoriasFlat={categoriasFlat}
          onClose={handleCerrarEdicion}
          onGuardar={handleGuardarEdicion}
        />
      )}
    </div>
  )
}

function CardMovimiento({ mov, index, nombreCategoria, nombreCuenta, onEditar, onEliminar }) {
  const esIngreso = mov.tipo === 'ingreso'
  return (
    <div style={{
      ...s.card,
      animation: 'fadeSlideUp 0.3s ease forwards',
      animationDelay: `${index * 0.07}s`,
      opacity: 0,
    }}>
      <div style={s.cardTop}>
        <span style={{
          ...s.badge,
          background: esIngreso ? THEME.colors.successBg : THEME.colors.dangerSoft,
          color: esIngreso ? THEME.colors.success : THEME.colors.danger,
        }}>
          {esIngreso
            ? <><ArrowUpRight size={12} /> Ingreso</>
            : <><ArrowDownRight size={12} /> Egreso</>}
        </span>
        <span style={s.cardMonto}>
          {formatMoney(mov.monto, mov.moneda ?? APP_CONFIG.defaultCurrency)}
        </span>
      </div>
      {mov.descripcion && (
        <p style={s.cardDesc}>{mov.descripcion}</p>
      )}
      <div style={s.cardMeta}>
        <span style={s.cardMetaItem}>
          <FolderOpen size={12} />
          {nombreCategoria(mov.categoria_id)}
        </span>
        <span style={s.cardMetaItem}>
          <Landmark size={12} />
          {nombreCuenta(mov.cuenta_id)}
        </span>
        {mov.fecha && (
          <span style={s.cardMetaItem}>
            <Calendar size={12} />
            {mov.fecha}
          </span>
        )}
      </div>
      <div style={s.cardActions}>
        <button onClick={onEditar} style={s.editBtn}>
          <Pencil size={14} />
          Editar
        </button>
        <button onClick={onEliminar} style={s.deleteBtn}>
          <Trash2 size={14} />
          Eliminar
        </button>
      </div>
    </div>
  )
}

function DrawerEdicion({ mov, cuentas, categoriasFlat, onClose, onGuardar }) {
  const [tipo, setTipo] = useState(mov.tipo ?? 'egreso')
  const [monto, setMonto] = useState(mov.monto ? String(mov.monto) : '')
  const [moneda, setMoneda] = useState(mov.moneda ?? APP_CONFIG.defaultCurrency)
  const [cuentaId, setCuentaId] = useState(mov.cuenta_id ?? '')
  const [categoriaId, setCategoriaId] = useState(mov.categoria_id ?? '')
  const [descripcion, setDescripcion] = useState(mov.descripcion ?? '')
  const [fecha, setFecha] = useState(mov.fecha ?? new Date().toISOString().slice(0, 10))
  const [err, setErr] = useState('')

  function handleGuardar(e) {
    e.preventDefault()
    setErr('')
    const montoNum = parseFloat(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setErr('El monto debe ser mayor a 0')
      return
    }
    if (!cuentaId) { setErr('Selecciona una cuenta'); return }
    if (!categoriaId) { setErr('Selecciona una categoría'); return }
    onGuardar({
      ...mov,
      tipo,
      monto: montoNum,
      moneda,
      cuenta_id: cuentaId,
      categoria_id: categoriaId,
      descripcion: descripcion.trim() || null,
      fecha,
    })
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.drawerHeader}>
          <h2 style={s.drawerTitulo}>Editar movimiento</h2>
          <button onClick={onClose} style={s.closeBtn} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleGuardar} style={s.drawerForm}>
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
              <ArrowDownRight size={15} />
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
              <ArrowUpRight size={15} />
              Ingreso
            </button>
          </div>

          <div style={s.drawerRow}>
            <div style={{ ...s.drawerField, flex: 2 }}>
              <label style={s.drawerLabel}>Monto</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0.00"
                style={s.drawerInput}
                inputMode="decimal"
              />
            </div>
            <div style={{ ...s.drawerField, flex: 1 }}>
              <label style={s.drawerLabel}>Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value)} style={s.drawerSelect}>
                {Object.keys(APP_CONFIG.currencies).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={s.drawerField}>
            <label style={s.drawerLabel}>Cuenta</label>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={s.drawerSelect}>
              <option value="">Selecciona una cuenta</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div style={s.drawerField}>
            <label style={s.drawerLabel}>Categoria</label>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={s.drawerSelect}>
              <option value="">Selecciona una categoria</option>
              {categoriasFlat.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icono ?? ''} {cat.nombre}</option>
              ))}
            </select>
          </div>

          <div style={s.drawerField}>
            <label style={s.drawerLabel}>Descripcion (opcional)</label>
            <input
              type="text"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: supermercado, nafta..."
              style={s.drawerInput}
              maxLength={200}
            />
          </div>

          <div style={s.drawerField}>
            <label style={s.drawerLabel}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              style={s.drawerInput}
            />
          </div>

          {err && <div style={s.drawerError}>{err}</div>}

          <div style={s.drawerActions}>
            <button type="button" onClick={onClose} style={s.cancelBtn}>Cancelar</button>
            <button type="submit" style={s.saveBtn}>Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    background: THEME.colors.bg,
    color: THEME.colors.textPrimary,
    fontFamily: 'system-ui, sans-serif',
    position: 'relative',
  },
  header: {
    padding: '24px 20px 12px',
    borderBottom: `1px solid ${THEME.colors.border}`,
  },
  titulo: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  subtitulo: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: THEME.colors.textSecondary,
  },
  content: {
    padding: '16px 16px 0',
    maxWidth: '680px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    borderRadius: THEME.radius.md,
    padding: '12px 14px',
    marginBottom: '16px',
    fontSize: '14px',
    gap: '8px',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: THEME.colors.danger,
    cursor: 'pointer',
    padding: '0 4px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 0,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
    gap: '12px',
    textAlign: 'center',
    padding: '20px',
  },
  emptyIcon: {
    lineHeight: 0,
    opacity: 0.5,
  },
  emptyTitulo: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  emptyDesc: {
    margin: 0,
    fontSize: '13px',
    color: THEME.colors.textMuted,
    maxWidth: '280px',
    lineHeight: '1.5',
  },
  lista: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    border: `1px solid ${THEME.colors.border}`,
    padding: '14px 16px',
    boxShadow: THEME.shadow.sm,
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
    gap: '8px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: THEME.radius.full,
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.02em',
  },
  cardMonto: {
    fontSize: '18px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  cardDesc: {
    margin: '0 0 8px',
    fontSize: '14px',
    color: THEME.colors.textPrimary,
    lineHeight: '1.4',
  },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '12px',
  },
  cardMetaItem: {
    fontSize: '12px',
    color: THEME.colors.textSecondary,
    background: THEME.colors.bg,
    borderRadius: THEME.radius.sm,
    padding: '3px 8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
  },
  editBtn: {
    flex: 1,
    height: '44px',
    background: THEME.colors.primaryLight,
    color: THEME.colors.primary,
    border: `1px solid ${THEME.colors.primary}`,
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
  deleteBtn: {
    flex: 1,
    height: '44px',
    background: THEME.colors.dangerSoft,
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
  guardarBar: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '0 16px',
    zIndex: 90,
    maxWidth: '680px',
    width: '100%',
    boxSizing: 'border-box',
  },
  guardarBtn: {
    width: '100%',
    height: '52px',
    background: THEME.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: THEME.radius.lg,
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: THEME.shadow.md,
    transition: 'all 0.15s',
  },
  inputBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    padding: '10px 16px 12px',
    background: THEME.colors.surface,
    borderTop: `1px solid ${THEME.colors.border}`,
    zIndex: 90,
    boxSizing: 'border-box',
  },
  inputWrap: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    maxWidth: '680px',
    margin: '0 auto',
  },
  textarea: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`,
    fontSize: '14px',
    color: THEME.colors.textPrimary,
    background: THEME.colors.bg,
    outline: 'none',
    resize: 'none',
    lineHeight: '1.5',
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
    minHeight: '72px',
  },
  interpretarBtn: {
    minWidth: '110px',
    height: '44px',
    background: THEME.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: THEME.radius.md,
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.15s',
  },
  spinnerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
  },
  inputHint: {
    margin: '6px 0 0',
    fontSize: '11px',
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: '680px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: THEME.colors.successBg,
    color: THEME.colors.success,
    border: `1px solid ${THEME.colors.success}`,
    borderRadius: THEME.radius.lg,
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    zIndex: 300,
    whiteSpace: 'nowrap',
    boxShadow: THEME.shadow.lg,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    animation: 'slideInDown 0.25s ease forwards',
  },
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
    background: THEME.colors.surface,
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
    borderRadius: THEME.radius.full,
    margin: '0 auto 16px',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  drawerTitulo: {
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
  drawerForm: {
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
  drawerRow: {
    display: 'flex',
    gap: '12px',
  },
  drawerField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  drawerLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  drawerInput: {
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
  drawerSelect: {
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
  drawerError: {
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    borderRadius: THEME.radius.sm,
    padding: '10px 14px',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  drawerActions: {
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
