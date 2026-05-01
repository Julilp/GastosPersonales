import { useState, useEffect } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import {
  getRecurrentes, crearRecurrente, actualizarRecurrente, eliminarRecurrente,
  getCuotas, crearCuota, eliminarCuota, actualizarCuota,
  getCuentas, getCategorias,
} from '../lib/finanzas'
import { Repeat2, CreditCard, Trash2, PauseCircle, PlayCircle, ArrowDownRight, ArrowUpRight, X, Plus } from 'lucide-react'

function FormRecurrente({ cuentas, categorias, inicial, onGuardar, onCancelar, loading }) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'egreso')
  const [monto, setMonto] = useState(inicial?.monto ? String(inicial.monto) : '')
  const [moneda, setMoneda] = useState(inicial?.moneda ?? 'ARS')
  const [cuentaId, setCuentaId] = useState(inicial?.cuenta_id ?? '')
  const [categoriaId, setCategoriaId] = useState(inicial?.categoria_id ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [diaMes, setDiaMes] = useState(inicial?.dia_del_mes ?? 1)
  const [error, setError] = useState('')

  const opsCat = categorias.flatMap(c => [
    { id: c.id, label: `${c.icono} ${c.nombre}` },
    ...(c.subcategorias ?? []).map(s => ({ id: s.id, label: `  ${s.icono ?? ''} ${s.nombre}` })),
  ])

  function submit(e) {
    e.preventDefault()
    const m = parseFloat(monto)
    if (!m || m <= 0) { setError('Monto inválido'); return }
    if (!cuentaId) { setError('Seleccioná cuenta'); return }
    if (!categoriaId) { setError('Seleccioná categoría'); return }
    if (!descripcion.trim()) { setError('Ingresá una descripción'); return }
    setError('')
    onGuardar({ tipo, monto: m, moneda, cuenta_id: cuentaId, categoria_id: categoriaId, descripcion: descripcion.trim(), dia_del_mes: Number(diaMes) })
  }

  return (
    <form onSubmit={submit} style={s.formCard}>
      <div style={s.toggleRow}>
        {['egreso', 'ingreso'].map(t => (
          <button key={t} type="button" onClick={() => setTipo(t)} style={{
            ...s.toggleBtn,
            background: tipo === t ? (t === 'egreso' ? THEME.colors.danger : THEME.colors.success) : THEME.colors.surface,
            color: tipo === t ? '#fff' : THEME.colors.textSecondary,
          }}>
            {t === 'egreso'
              ? <><ArrowDownRight size={15} /> Egreso</>
              : <><ArrowUpRight size={15} /> Ingreso</>}
          </button>
        ))}
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.label}>Monto</label>
          <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" style={s.input} inputMode="decimal" />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Moneda</label>
          <select value={moneda} onChange={e => setMoneda(e.target.value)} style={s.select}>
            {Object.keys(APP_CONFIG.currencies).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Descripción</label>
        <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Netflix, Sueldo, Alquiler..." style={s.input} maxLength={100} />
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.label}>Cuenta</label>
          <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={s.select}>
            <option value="">Seleccioná</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Día del mes</label>
          <input type="number" min="1" max="31" value={diaMes} onChange={e => setDiaMes(e.target.value)} style={s.input} />
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Categoría</label>
        <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={s.select}>
          <option value="">Seleccioná</option>
          {opsCat.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}
      <div style={s.actions}>
        <button type="button" onClick={onCancelar} style={s.cancelBtn}>Cancelar</button>
        <button type="submit" disabled={loading} style={s.saveBtn}>{loading ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  )
}

function FormCuota({ cuentas, categorias, onGuardar, onCancelar, loading }) {
  const [descripcion, setDescripcion] = useState('')
  const [montoTotal, setMontoTotal] = useState('')
  const [montoCuota, setMontoCuota] = useState('')
  const [cantCuotas, setCantCuotas] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  const [cuentaId, setCuentaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const opsCat = categorias.flatMap(c => [
    { id: c.id, label: `${c.icono} ${c.nombre}` },
    ...(c.subcategorias ?? []).map(s => ({ id: s.id, label: `  ${s.icono ?? ''} ${s.nombre}` })),
  ])

  function submit(e) {
    e.preventDefault()
    const mt = parseFloat(montoTotal), mc = parseFloat(montoCuota), n = parseInt(cantCuotas)
    if (!descripcion.trim()) { setError('Ingresá descripción'); return }
    if (!mt || mt <= 0) { setError('Monto total inválido'); return }
    if (!mc || mc <= 0) { setError('Monto cuota inválido'); return }
    if (!n || n <= 0) { setError('Cantidad de cuotas inválida'); return }
    if (!cuentaId) { setError('Seleccioná cuenta'); return }
    if (!categoriaId) { setError('Seleccioná categoría'); return }
    setError('')
    onGuardar({ descripcion: descripcion.trim(), monto_total: mt, monto_cuota: mc, cantidad_cuotas: n, moneda, cuenta_id: cuentaId, categoria_id: categoriaId, fecha_inicio: fechaInicio })
  }

  return (
    <form onSubmit={submit} style={s.formCard}>
      <div style={s.field}>
        <label style={s.label}>Descripción</label>
        <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Smart TV, Notebook..." style={s.input} maxLength={100} />
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Total</label>
          <input type="number" min="0" step="0.01" value={montoTotal} onChange={e => setMontoTotal(e.target.value)} placeholder="0.00" style={s.input} inputMode="decimal" />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Por cuota</label>
          <input type="number" min="0" step="0.01" value={montoCuota} onChange={e => setMontoCuota(e.target.value)} placeholder="0.00" style={s.input} inputMode="decimal" />
        </div>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Cuotas</label>
          <input type="number" min="1" value={cantCuotas} onChange={e => setCantCuotas(e.target.value)} placeholder="12" style={s.input} inputMode="numeric" />
        </div>
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Moneda</label>
          <select value={moneda} onChange={e => setMoneda(e.target.value)} style={s.select}>
            {Object.keys(APP_CONFIG.currencies).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.label}>1ª cuota</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={s.input} />
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Cuenta</label>
        <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={s.select}>
          <option value="">Seleccioná</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div style={s.field}>
        <label style={s.label}>Categoría</label>
        <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={s.select}>
          <option value="">Seleccioná</option>
          {opsCat.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}
      <div style={s.actions}>
        <button type="button" onClick={onCancelar} style={s.cancelBtn}>Cancelar</button>
        <button type="submit" disabled={loading} style={s.saveBtn}>{loading ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  )
}

function ItemRecurrente({ rec, onToggleActivo, onEliminar }) {
  const color = rec.tipo === 'ingreso' ? THEME.colors.success : THEME.colors.danger
  const signo = rec.tipo === 'ingreso' ? '+' : '-'
  return (
    <div style={s.item}>
      <span style={s.itemIcon}>{rec.categoria?.icono ?? '📦'}</span>
      <div style={s.itemInfo}>
        <span style={s.itemNombre}>{rec.descripcion}</span>
        <span style={s.itemMeta}>{rec.cuenta?.nombre} · día {rec.dia_del_mes}</span>
      </div>
      <span style={{ ...s.itemMonto, color }}>{signo}{formatMoney(rec.monto, rec.moneda)}</span>
      <div style={s.itemActions}>
        <button
          onClick={() => onToggleActivo(rec)}
          style={{
            ...s.chipBtn,
            background: rec.activo ? THEME.colors.primaryLight : THEME.colors.surface,
            color: rec.activo ? THEME.colors.primary : THEME.colors.textMuted,
          }}
          title={rec.activo ? 'Archivar' : 'Activar'}
        >
          {rec.activo
            ? <PauseCircle size={14} />
            : <PlayCircle size={14} />}
          {rec.activo ? 'Activo' : 'Pausado'}
        </button>
        <button onClick={() => onEliminar(rec)} style={s.deleteSmBtn} title="Eliminar">
          <Trash2 size={15} color={THEME.colors.textMuted} />
        </button>
      </div>
    </div>
  )
}

function ItemCuota({ cuota, onEliminar }) {
  const restantes = cuota.cantidad_cuotas - cuota.cuotas_pagadas
  const pct = Math.round((cuota.cuotas_pagadas / cuota.cantidad_cuotas) * 100)
  return (
    <div style={s.item}>
      <span style={s.itemIcon}>{cuota.categoria?.icono ?? '📦'}</span>
      <div style={{ ...s.itemInfo, gap: '4px' }}>
        <span style={s.itemNombre}>{cuota.descripcion}</span>
        <span style={s.itemMeta}>{cuota.cuenta?.nombre} · {cuota.cuotas_pagadas}/{cuota.cantidad_cuotas} cuotas pagadas</span>
        <div style={s.miniBarFondo}>
          <div style={{ ...s.miniBarRelleno, width: `${pct}%` }} />
        </div>
      </div>
      <div style={s.itemRight}>
        <span style={{ ...s.itemMonto, color: THEME.colors.danger }}>
          -{formatMoney(cuota.monto_cuota, cuota.moneda)}
        </span>
        <span style={s.cuotaRest}>{restantes} restantes</span>
      </div>
      <button onClick={() => onEliminar(cuota)} style={s.deleteSmBtn} title="Eliminar">
        <Trash2 size={15} color={THEME.colors.textMuted} />
      </button>
    </div>
  )
}

function ConfirmSheet({ texto, onConfirmar, onCancelar, loading }) {
  return (
    <div style={s.confirmOverlay} onClick={e => e.target === e.currentTarget && onCancelar()}>
      <div style={s.confirmSheet}>
        <p style={s.confirmText}>{texto}</p>
        <div style={s.actions}>
          <button onClick={onCancelar} style={s.cancelBtn}>Cancelar</button>
          <button onClick={onConfirmar} disabled={loading} style={s.dangerBtn}>
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Fijos() {
  const [tab, setTab] = useState('recurrentes')
  const [recurrentes, setRecurrentes] = useState([])
  const [cuotas, setCuotas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    try {
      const [r, cu, cnt, cat] = await Promise.all([
        getRecurrentes(), getCuotas(), getCuentas(), getCategorias(),
      ])
      setRecurrentes(r)
      setCuotas(cu)
      setCuentas(cnt)
      setCategorias(cat)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleGuardarRec(payload) {
    setGuardando(true)
    try {
      await crearRecurrente(payload)
      setMostrarForm(false)
      fetchAll()
    } catch (e) { setError(e.message) }
    setGuardando(false)
  }

  async function handleGuardarCuota(payload) {
    setGuardando(true)
    try {
      await crearCuota(payload)
      setMostrarForm(false)
      fetchAll()
    } catch (e) { setError(e.message) }
    setGuardando(false)
  }

  async function handleToggleActivo(rec) {
    try {
      await actualizarRecurrente(rec.id, { activo: !rec.activo })
      fetchAll()
    } catch (e) { setError(e.message) }
  }

  async function handleEliminar() {
    if (!confirm) return
    setEliminando(true)
    try {
      if (confirm.tipo === 'rec') await eliminarRecurrente(confirm.item.id)
      else await eliminarCuota(confirm.item.id)
      setConfirm(null)
      fetchAll()
    } catch (e) { setError(e.message) }
    setEliminando(false)
  }

  const recActivosN = recurrentes.filter(r => r.activo).length
  const cuotasActivasN = cuotas.filter(c => c.activa && c.cuotas_pagadas < c.cantidad_cuotas).length

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.pageTitle}>Fijos</h1>
        <button onClick={() => setMostrarForm(v => !v)} style={s.addBtn}>
          {mostrarForm
            ? <><X size={15} /> Cancelar</>
            : <><Plus size={15} /> Nuevo</>}
        </button>
      </div>

      <div style={s.tabsRow}>
        <button
          onClick={() => setTab('recurrentes')}
          style={{ ...s.tabBtn, ...(tab === 'recurrentes' ? s.tabBtnActive : {}) }}
        >
          <Repeat2 size={15} />
          Recurrentes
          {recActivosN > 0 && <span style={s.badge}>{recActivosN}</span>}
        </button>
        <button
          onClick={() => setTab('cuotas')}
          style={{ ...s.tabBtn, ...(tab === 'cuotas' ? s.tabBtnActive : {}) }}
        >
          <CreditCard size={15} />
          Cuotas
          {cuotasActivasN > 0 && <span style={s.badge}>{cuotasActivasN}</span>}
        </button>
      </div>

      {error && <div style={s.errorMsg}>{error}</div>}

      {mostrarForm && (
        <div style={s.formWrap}>
          {tab === 'recurrentes' ? (
            <FormRecurrente
              cuentas={cuentas}
              categorias={categorias}
              inicial={null}
              onGuardar={handleGuardarRec}
              onCancelar={() => setMostrarForm(false)}
              loading={guardando}
            />
          ) : (
            <FormCuota
              cuentas={cuentas}
              categorias={categorias}
              onGuardar={handleGuardarCuota}
              onCancelar={() => setMostrarForm(false)}
              loading={guardando}
            />
          )}
        </div>
      )}

      {loading ? (
        <div style={s.loadingWrap}>Cargando...</div>
      ) : tab === 'recurrentes' ? (
        recurrentes.length === 0 ? (
          <div style={s.empty}>
            <Repeat2 size={48} color={THEME.colors.textMuted} strokeWidth={1.2} style={{ opacity: 0.3 }} />
            <span style={s.emptyText}>Sin gastos o ingresos fijos</span>
          </div>
        ) : (
          <div style={s.lista}>
            {recurrentes.map(r => (
              <ItemRecurrente
                key={r.id}
                rec={r}
                onToggleActivo={handleToggleActivo}
                onEliminar={item => setConfirm({ tipo: 'rec', item })}
              />
            ))}
          </div>
        )
      ) : (
        cuotas.length === 0 ? (
          <div style={s.empty}>
            <CreditCard size={48} color={THEME.colors.textMuted} strokeWidth={1.2} style={{ opacity: 0.3 }} />
            <span style={s.emptyText}>Sin compras en cuotas</span>
          </div>
        ) : (
          <div style={s.lista}>
            {cuotas.map(c => (
              <ItemCuota
                key={c.id}
                cuota={c}
                onEliminar={item => setConfirm({ tipo: 'cuota', item })}
              />
            ))}
          </div>
        )
      )}

      {confirm && (
        <ConfirmSheet
          texto={`¿Eliminás "${confirm.item.descripcion}"? Esta acción no se puede deshacer.`}
          onConfirmar={handleEliminar}
          onCancelar={() => setConfirm(null)}
          loading={eliminando}
        />
      )}
    </div>
  )
}

const s = {
  root: { minHeight: '100svh', background: THEME.colors.bg, paddingBottom: '100px' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 16px 16px', background: THEME.colors.surface,
    borderBottom: `1px solid ${THEME.colors.border}`, position: 'sticky', top: 0, zIndex: 10,
  },
  pageTitle: { margin: 0, fontSize: '20px', fontWeight: '700', color: THEME.colors.textPrimary },
  addBtn: {
    height: '40px', padding: '0 16px', background: THEME.colors.primary,
    color: '#fff', border: 'none', borderRadius: THEME.radius.md,
    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
  },
  tabsRow: {
    display: 'flex', gap: '0', borderBottom: `1px solid ${THEME.colors.border}`,
    background: THEME.colors.surface,
  },
  tabBtn: {
    flex: 1, height: '48px', border: 'none', background: 'none',
    color: THEME.colors.textSecondary, fontSize: '14px', fontWeight: '500',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', borderBottom: '2px solid transparent', transition: 'all 0.15s',
  },
  tabBtnActive: {
    color: THEME.colors.primary, borderBottom: `2px solid ${THEME.colors.primary}`, fontWeight: '600',
  },
  badge: {
    background: THEME.colors.primary, color: '#fff', borderRadius: '9999px',
    fontSize: '11px', fontWeight: '700', padding: '1px 6px', minWidth: '18px', textAlign: 'center',
  },
  errorMsg: {
    margin: '12px 16px 0', background: THEME.colors.errorBg, color: THEME.colors.danger,
    borderRadius: THEME.radius.sm, padding: '10px 14px', fontSize: '13px',
  },
  formWrap: { padding: '16px' },
  formCard: {
    background: THEME.colors.surface, borderRadius: THEME.radius.lg,
    boxShadow: THEME.shadow.md, padding: '20px 16px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  loadingWrap: { textAlign: 'center', padding: '60px 16px', color: THEME.colors.textSecondary, fontSize: '14px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 16px' },
  emptyText: { fontSize: '15px', color: THEME.colors.textMuted },
  lista: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  item: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: THEME.colors.surface, borderRadius: THEME.radius.lg,
    padding: '14px 16px', boxShadow: THEME.shadow.sm,
  },
  itemIcon: { fontSize: '22px', lineHeight: 1, flexShrink: 0, width: '32px', textAlign: 'center' },
  itemInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  itemNombre: { fontSize: '14px', fontWeight: '600', color: THEME.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemMeta: { fontSize: '11px', color: THEME.colors.textMuted },
  itemMonto: { fontSize: '14px', fontWeight: '700', flexShrink: 0 },
  itemRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 },
  cuotaRest: { fontSize: '11px', color: THEME.colors.textMuted },
  itemActions: { display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' },
  chipBtn: {
    height: '28px', padding: '0 10px', borderRadius: THEME.radius.full,
    border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
  },
  deleteSmBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: THEME.radius.sm, padding: 0,
  },
  miniBarFondo: { height: '4px', background: THEME.colors.border, borderRadius: '9999px', overflow: 'hidden', marginTop: '2px' },
  miniBarRelleno: { height: '100%', background: THEME.colors.primary, borderRadius: '9999px', transition: 'width 0.4s ease' },
  toggleRow: {
    display: 'flex', borderRadius: THEME.radius.md, overflow: 'hidden',
    border: `1.5px solid ${THEME.colors.border}`,
  },
  toggleBtn: {
    flex: 1, height: '44px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    transition: 'background 0.15s, color 0.15s',
  },
  row: { display: 'flex', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: THEME.colors.textSecondary },
  input: {
    height: '48px', padding: '0 14px', borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`, fontSize: '15px',
    color: THEME.colors.textPrimary, background: THEME.colors.bg,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  select: {
    height: '48px', padding: '0 14px', borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`, fontSize: '15px',
    color: THEME.colors.textPrimary, background: THEME.colors.bg,
    outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer',
  },
  errorBox: { background: THEME.colors.errorBg, color: THEME.colors.danger, borderRadius: THEME.radius.sm, padding: '10px 14px', fontSize: '13px' },
  actions: { display: 'flex', gap: '12px' },
  cancelBtn: {
    flex: 1, height: '52px', background: THEME.colors.surface, color: THEME.colors.textSecondary,
    border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, fontSize: '15px', fontWeight: '500', cursor: 'pointer',
  },
  saveBtn: {
    flex: 2, height: '52px', background: THEME.colors.primary, color: '#fff',
    border: 'none', borderRadius: THEME.radius.md, fontSize: '15px', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  dangerBtn: {
    flex: 2, height: '52px', background: THEME.colors.danger, color: '#fff',
    border: 'none', borderRadius: THEME.radius.md, fontSize: '15px', fontWeight: '600', cursor: 'pointer',
  },
  confirmOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  confirmSheet: {
    background: THEME.colors.surface, borderRadius: `${THEME.radius.xl} ${THEME.radius.xl} 0 0`,
    width: '100%', maxWidth: '600px', padding: '24px 20px 40px', boxSizing: 'border-box',
    animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  confirmText: { margin: '0 0 20px', fontSize: '15px', color: THEME.colors.textPrimary, lineHeight: '1.5' },
}
