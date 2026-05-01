import { useState, useEffect } from 'react'
import { THEME } from '../config/theme'
import { getCategorias, crearCategoria, eliminarCategoria } from '../lib/finanzas'
import { Plus, X, Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-react'

const ICONOS_SUGERIDOS = [
  '🍔','🛒','🚗','🏠','💊','📚','🎬','✈️','👗','💪',
  '🐾','🎮','💰','🍺','☕','🎵','💡','📱','🧴','🎁',
]

function FormCategoria({ categorias, onGuardar, onCancelar, loading }) {
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState('📦')
  const [parentId, setParentId] = useState('')
  const [iconoCustom, setIconoCustom] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    onGuardar({
      nombre: nombre.trim(),
      icono: iconoCustom || icono,
      parent_id: parentId || null,
    })
  }

  const iconoActual = iconoCustom || icono

  return (
    <form onSubmit={handleSubmit} style={s.formCard}>
      <h3 style={s.formTitle}>Nueva categoría</h3>

      <div style={s.field}>
        <label style={s.label}>Nombre</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Transporte"
          style={s.input}
          required
          maxLength={50}
        />
      </div>

      <div style={s.field}>
        <label style={s.label}>Icono</label>
        <div style={s.iconosGrid}>
          {ICONOS_SUGERIDOS.map(em => (
            <button
              key={em}
              type="button"
              onClick={() => { setIcono(em); setIconoCustom('') }}
              style={{
                ...s.iconoBtn,
                background: icono === em && !iconoCustom ? THEME.colors.primaryLight : THEME.colors.bg,
                border: `2px solid ${icono === em && !iconoCustom ? THEME.colors.primary : THEME.colors.border}`,
              }}
            >
              {em}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={iconoCustom}
          onChange={e => setIconoCustom(e.target.value)}
          placeholder="O escribí un emoji personalizado..."
          style={{ ...s.input, marginTop: '8px' }}
          maxLength={4}
        />
        <div style={s.iconoPreview}>
          Previsualización: <span style={s.iconoPreviewEm}>{iconoActual}</span> {nombre || 'Categoría'}
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Categoría padre (opcional)</label>
        <select
          value={parentId}
          onChange={e => setParentId(e.target.value)}
          style={s.select}
        >
          <option value="">Ninguna (categoría raíz)</option>
          {categorias.filter(c => !c.parent_id).map(c => (
            <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
          ))}
        </select>
      </div>

      <div style={s.formActions}>
        <button type="button" onClick={onCancelar} style={s.cancelBtn}>Cancelar</button>
        <button type="submit" disabled={loading} style={s.saveBtn}>
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function ItemCategoria({ cat, onEliminar }) {
  const [expandida, setExpandida] = useState(false)
  const tieneSubs = cat.subcategorias?.length > 0
  const esDefault = cat.es_default

  return (
    <div style={s.catCard}>
      <div style={s.catRow}>
        <span style={s.catIcono}>{cat.icono ?? '📦'}</span>
        <div style={s.catInfo}>
          <span style={s.catNombre}>{cat.nombre}</span>
          {esDefault && <span style={s.badge}>Default</span>}
          {tieneSubs && (
            <span style={s.subCount}>{cat.subcategorias.length} subcategorías</span>
          )}
        </div>
        <div style={s.catActions}>
          {tieneSubs && (
            <button
              onClick={() => setExpandida(v => !v)}
              style={s.expandBtn}
              aria-label={expandida ? 'Colapsar' : 'Expandir'}
            >
              {expandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {!esDefault && (
            <button
              onClick={() => onEliminar(cat)}
              style={s.deleteBtn}
              aria-label="Eliminar categoría"
            >
              <Trash2 size={16} color={THEME.colors.textMuted} />
            </button>
          )}
        </div>
      </div>

      {expandida && tieneSubs && (
        <div style={s.subList}>
          {cat.subcategorias.map(sub => (
            <div key={sub.id} style={s.subItem}>
              <span style={s.subIcono}>{sub.icono ?? '  '}</span>
              <span style={s.subNombre}>{sub.nombre}</span>
              {sub.es_default && <span style={s.badgeSm}>Default</span>}
              {!sub.es_default && (
                <button
                  onClick={() => onEliminar(sub)}
                  style={s.deleteSmBtn}
                  aria-label="Eliminar subcategoría"
                >
                  <Trash2 size={14} color={THEME.colors.textMuted} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const data = await getCategorias()
      setCategorias(data)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function handleGuardar(payload) {
    setGuardando(true)
    setError('')
    try {
      await crearCategoria(payload)
      setMostrarForm(false)
      fetchData()
    } catch (e) {
      setError(e.message)
    }
    setGuardando(false)
  }

  async function handleEliminar() {
    if (!confirmEliminar) return
    setEliminando(true)
    setError('')
    try {
      await eliminarCategoria(confirmEliminar.id)
      setConfirmEliminar(null)
      fetchData()
    } catch (e) {
      setError(e.message)
      setConfirmEliminar(null)
    }
    setEliminando(false)
  }

  return (
    <div style={{ ...s.root, padding: isMobile ? 0 : '0 0 32px' }}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.pageTitle}>Categorías</h1>
        <button onClick={() => setMostrarForm(v => !v)} style={s.addBtn}>
          {mostrarForm ? <><X size={15} /> Cancelar</> : <><Plus size={15} /> Nueva</>}
        </button>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {mostrarForm && (
        <div style={s.formWrap}>
          <FormCategoria
            categorias={categorias}
            onGuardar={handleGuardar}
            onCancelar={() => setMostrarForm(false)}
            loading={guardando}
          />
        </div>
      )}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : categorias.length === 0 ? (
        <div style={s.empty}>
          <Tag size={48} color={THEME.colors.textMuted} strokeWidth={1.2} style={{ opacity: 0.3 }} />
          <span style={s.emptyText}>Sin categorías todavía</span>
        </div>
      ) : (
        <div style={s.lista}>
          {categorias.map(cat => (
            <ItemCategoria
              key={cat.id}
              cat={cat}
              onEliminar={c => setConfirmEliminar(c)}
            />
          ))}
        </div>
      )}

      {/* Confirm eliminar */}
      {confirmEliminar && (
        <div style={s.confirmOverlay} onClick={e => e.target === e.currentTarget && setConfirmEliminar(null)}>
          <div style={s.confirmSheet}>
            <h3 style={s.confirmTitle}>Eliminar categoría</h3>
            <p style={s.confirmText}>
              ¿Eliminás la categoría <strong>{confirmEliminar.icono} {confirmEliminar.nombre}</strong>?
              No se puede eliminar si tiene movimientos asociados.
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
  root: {
    minHeight: '100svh',
    background: THEME.colors.bg,
    paddingBottom: '100px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 16px 16px',
    background: THEME.colors.surface,
    borderBottom: `1px solid ${THEME.colors.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  pageTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  addBtn: {
    height: '40px',
    padding: '0 16px',
    background: THEME.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: THEME.radius.md,
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background 0.15s',
  },
  error: {
    margin: '12px 16px 0',
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    borderRadius: THEME.radius.sm,
    padding: '10px 14px',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  formWrap: {
    padding: '16px',
  },
  formCard: {
    background: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    boxShadow: THEME.shadow.md,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  formTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
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
  iconosGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  iconoBtn: {
    width: '44px',
    height: '44px',
    borderRadius: THEME.radius.sm,
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
  },
  iconoPreview: {
    fontSize: '13px',
    color: THEME.colors.textSecondary,
    marginTop: '4px',
  },
  iconoPreviewEm: {
    fontSize: '18px',
  },
  formActions: {
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
    gap: '10px',
  },
  catCard: {
    background: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    boxShadow: THEME.shadow.sm,
    overflow: 'hidden',
  },
  catRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    minHeight: '64px',
  },
  catIcono: {
    fontSize: '26px',
    lineHeight: 1,
    flexShrink: 0,
    width: '32px',
    textAlign: 'center',
  },
  catInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  catNombre: {
    fontSize: '15px',
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  badge: {
    display: 'inline-block',
    background: THEME.colors.primaryLight,
    color: THEME.colors.primary,
    borderRadius: THEME.radius.full,
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    width: 'fit-content',
  },
  badgeSm: {
    display: 'inline-block',
    background: THEME.colors.primaryLight,
    color: THEME.colors.primary,
    borderRadius: THEME.radius.full,
    fontSize: '10px',
    fontWeight: '600',
    padding: '1px 6px',
    marginLeft: 'auto',
  },
  subCount: {
    fontSize: '12px',
    color: THEME.colors.textMuted,
  },
  catActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: THEME.colors.textMuted,
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.sm,
    transition: 'opacity 0.15s',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.sm,
    transition: 'opacity 0.15s',
  },
  deleteSmBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.sm,
    marginLeft: 'auto',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  subList: {
    borderTop: `1px solid ${THEME.colors.border}`,
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: THEME.colors.bg,
  },
  subItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    minHeight: '44px',
    borderBottom: `1px solid ${THEME.colors.border}`,
  },
  subIcono: {
    fontSize: '18px',
    lineHeight: 1,
    width: '24px',
    textAlign: 'center',
    flexShrink: 0,
  },
  subNombre: {
    fontSize: '14px',
    color: THEME.colors.textPrimary,
    flex: 1,
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
