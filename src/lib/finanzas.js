import { supabase } from './supabaseClient'

export async function getResumenMes(mes, anio) {
  const { data, error } = await supabase.rpc('get_resumen_mes', {
    p_mes: mes,
    p_anio: anio,
  })
  if (error) throw error
  return data
}

export async function getGastosPorCategoria(mes, anio, moneda) {
  const { data, error } = await supabase.rpc('get_gastos_por_categoria', {
    p_mes: mes,
    p_anio: anio,
    p_moneda: moneda,
  })
  if (error) throw error
  return data
}

export async function getGastosPorSubcategoria(mes, anio, moneda) {
  const { data, error } = await supabase.rpc('get_gastos_por_subcategoria', {
    p_mes: mes,
    p_anio: anio,
    p_moneda: moneda,
  })
  if (error) throw error
  return data
}

export async function getMovimientos({ mes, anio, tipo, moneda, cuenta_id, search } = {}) {
  let q = supabase
    .from('movimientos')
    .select(`
      *,
      cuenta:cuentas(id, nombre, tipo),
      categoria:categorias(id, nombre, icono, parent_id,
        parent:categorias!parent_id(id, nombre, icono)
      )
    `)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })

  if (mes && anio) {
    const from = `${anio}-${String(mes).padStart(2, '0')}-01`
    const to = new Date(anio, mes, 0).toISOString().slice(0, 10)
    q = q.gte('fecha', from).lte('fecha', to)
  }
  if (tipo) q = q.eq('tipo', tipo)
  if (moneda) q = q.eq('moneda', moneda)
  if (cuenta_id) q = q.eq('cuenta_id', cuenta_id)
  if (search) q = q.ilike('descripcion', `%${search}%`)

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function crearMovimiento(payload) {
  const { data, error } = await supabase.from('movimientos').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function crearTraspaso({ origenCuentaId, origenMonto, origenMoneda, destinoCuentaId, destinoMonto, destinoMoneda, descripcion, fecha }) {
  const traspaso_id = crypto.randomUUID()
  const { error: e1 } = await supabase.from('movimientos').insert({
    tipo: 'traspaso', traspaso_direccion: 'salida',
    monto: origenMonto, moneda: origenMoneda, cuenta_id: origenCuentaId,
    descripcion: descripcion || null, fecha, traspaso_id,
  })
  if (e1) throw e1
  const { error: e2 } = await supabase.from('movimientos').insert({
    tipo: 'traspaso', traspaso_direccion: 'entrada',
    monto: destinoMonto, moneda: destinoMoneda, cuenta_id: destinoCuentaId,
    descripcion: descripcion || null, fecha, traspaso_id,
  })
  if (e2) throw e2
}

export async function actualizarMovimiento(id, payload) {
  const { data, error } = await supabase
    .from('movimientos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarMovimiento(id) {
  const { error } = await supabase.from('movimientos').delete().eq('id', id)
  if (error) throw error
}

export async function getCuentas() {
  const { data, error } = await supabase
    .from('cuentas')
    .select('*')
    .eq('activa', true)
    .order('orden')
  if (error) throw error
  return data
}

export async function getCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*, subcategorias:categorias!parent_id(id, nombre, icono, es_default, user_id)')
    .is('parent_id', null)
    .order('nombre')
  if (error) throw error
  return data
}

export async function crearCategoria(payload) {
  const { data, error } = await supabase.from('categorias').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function eliminarCategoria(id) {
  const { count, error: chk } = await supabase
    .from('movimientos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', id)
  if (chk) throw chk
  if (count > 0) throw new Error('No se puede eliminar: la categoría tiene movimientos asociados')
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  if (error) throw error
}

export async function getPresupuestos(mes, anio) {
  const { data, error } = await supabase
    .from('presupuestos')
    .select('*, categoria:categorias(id, nombre, icono)')
    .eq('mes', mes)
    .eq('anio', anio)
  if (error) throw error
  return data
}

export async function upsertPresupuesto(payload) {
  const { data, error } = await supabase
    .from('presupuestos')
    .upsert(payload, { onConflict: 'user_id,categoria_id,mes,anio,moneda' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMetaAhorro(mes, anio) {
  const { data, error } = await supabase
    .from('meta_ahorro')
    .select('*')
    .eq('mes', mes)
    .eq('anio', anio)
  if (error) throw error
  return data
}

export async function upsertMetaAhorro(payload) {
  const { data, error } = await supabase
    .from('meta_ahorro')
    .upsert(payload, { onConflict: 'user_id,mes,anio,moneda' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Recurrentes ──────────────────────────────────────────────

export async function getRecurrentes() {
  const { data, error } = await supabase
    .from('recurrentes')
    .select(`*, cuenta:cuentas(id,nombre), categoria:categorias(id,nombre,icono)`)
    .order('dia_del_mes')
  if (error) throw error
  return data
}

export async function crearRecurrente(payload) {
  const { data, error } = await supabase.from('recurrentes').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function actualizarRecurrente(id, payload) {
  const { data, error } = await supabase.from('recurrentes').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function eliminarRecurrente(id) {
  const { error } = await supabase.from('recurrentes').delete().eq('id', id)
  if (error) throw error
}

export async function aplicarRecurrente(recurrente, mes, anio) {
  const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(recurrente.dia_del_mes).padStart(2, '0')}`
  const { data: mov, error: e1 } = await supabase
    .from('movimientos')
    .insert({
      tipo: recurrente.tipo,
      monto: recurrente.monto,
      moneda: recurrente.moneda,
      cuenta_id: recurrente.cuenta_id ?? recurrente.cuenta?.id,
      categoria_id: recurrente.categoria_id ?? recurrente.categoria?.id,
      descripcion: recurrente.descripcion,
      fecha,
    })
    .select()
    .single()
  if (e1) throw e1

  const { error: e2 } = await supabase.from('recurrentes_aplicados').insert({
    recurrente_id: recurrente.id,
    mes,
    anio,
    movimiento_id: mov.id,
  })
  if (e2) throw e2
  return mov
}

// ── Cuotas ───────────────────────────────────────────────────

export async function getCuotas() {
  const { data, error } = await supabase
    .from('cuotas')
    .select(`*, cuenta:cuentas(id,nombre), categoria:categorias(id,nombre,icono)`)
    .order('fecha_inicio')
  if (error) throw error
  return data
}

export async function crearCuota(payload) {
  const { data, error } = await supabase.from('cuotas').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function actualizarCuota(id, payload) {
  const { data, error } = await supabase.from('cuotas').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function eliminarCuota(id) {
  const { error } = await supabase.from('cuotas').delete().eq('id', id)
  if (error) throw error
}

export async function pagarCuota(cuota, mes, anio) {
  const cuotaNum = cuota.cuotas_pagadas + 1
  const esFinal = cuotaNum >= cuota.cantidad_cuotas
  const fecha = `${anio}-${String(mes).padStart(2, '0')}-01`

  const { data: mov, error: e1 } = await supabase
    .from('movimientos')
    .insert({
      tipo: 'egreso',
      monto: cuota.monto_cuota,
      moneda: cuota.moneda,
      cuenta_id: cuota.cuenta_id ?? cuota.cuenta?.id,
      categoria_id: cuota.categoria_id ?? cuota.categoria?.id,
      descripcion: `${cuota.descripcion} (cuota ${cuotaNum}/${cuota.cantidad_cuotas})`,
      fecha,
    })
    .select()
    .single()
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('cuotas')
    .update({ cuotas_pagadas: cuotaNum, activa: !esFinal })
    .eq('id', cuota.id)
  if (e2) throw e2

  return mov
}

// ── Pendientes del mes ────────────────────────────────────────

export async function omitirPendiente(tipo, referenciaId, mes, anio) {
  const { error } = await supabase.rpc('omitir_pendiente', {
    p_tipo: tipo,
    p_referencia_id: referenciaId,
    p_mes: mes,
    p_anio: anio,
  })
  if (error) throw error
}

export async function getPendientesMes(mes, anio) {
  const { data, error } = await supabase.rpc('get_pendientes_mes', {
    p_mes: mes,
    p_anio: anio,
  })
  if (error) throw error
  return data?.[0] ?? { recurrentes_pendientes: [], cuotas_pendientes: [] }
}

export async function initCuentasDefault() {
  const { error } = await supabase.rpc('init_cuentas_default')
  if (error) throw error
}

export function getMesAnioActual() {
  const now = new Date()
  return { mes: now.getMonth() + 1, anio: now.getFullYear() }
}

export function navegarMes(mes, anio, delta) {
  let m = mes + delta
  let a = anio
  if (m > 12) { m = 1; a++ }
  if (m < 1) { m = 12; a-- }
  return { mes: m, anio: a }
}

export function labelMes(mes, anio) {
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export async function sugerirCategoria({ descripcion, tipo, categorias }) {
  const { data, error } = await supabase.functions.invoke('suggest-categoria', {
    body: { descripcion, tipo, categorias },
  })
  if (error) throw error
  return data
}
