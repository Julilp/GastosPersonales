const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

// ─── Types ───────────────────────────────────────────────────────────────────

type InsightType = 'alerta' | 'consejo' | 'logro' | 'tendencia' | 'proyeccion'
type Priority = 'alta' | 'media' | 'baja'

interface Insight {
  tipo: InsightType
  titulo: string
  descripcion: string
  prioridad: Priority
  valor?: string
}

interface ResumenMoneda {
  moneda: string
  total_ingresos: number
  total_egresos: number
  balance: number
}

interface GastoCategoria {
  categoria_nombre: string
  total_egresos: number
  categoria_icono?: string
}

interface Presupuesto {
  limite: number
  moneda: string
  categoria?: { nombre: string }
  gastos_actuales?: number
}

interface Recurrente {
  descripcion: string
  monto: number
  moneda: string
  tipo: string
  dia_del_mes: number
  activo: boolean
}

interface Cuota {
  descripcion: string
  monto_cuota: number
  moneda: string
  cuotas_pagadas: number
  cantidad_cuotas: number
  activa: boolean
}

interface RequestBody {
  resumen: ResumenMoneda[]
  gastos: GastoCategoria[]
  subcategorias?: GastoCategoria[]
  presupuestos?: Presupuesto[]
  recurrentes?: Recurrente[]
  cuotas?: Cuota[]
  mes: number
  anio: number
  nombre_usuario?: string
}

interface InsightsResponse {
  insights: Insight[]
  resumen_ejecutivo: string
  score_financiero?: number
  generado_en: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function nombreMes(mes: number, anio: number): string {
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function formatARS(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

// ─── Claude helper ───────────────────────────────────────────────────────────

async function callClaude(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const errTxt = await res.text()
    console.error('Claude API error:', res.status, errTxt)
    throw new Error(`Claude API error ${res.status}`)
  }

  const data = await res.json()
  return data?.content?.[0]?.text ?? ''
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf('{')
  if (start === -1) throw new Error('No JSON found')
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return JSON.parse(raw.slice(start, i + 1)) }
  }
  throw new Error('Incomplete JSON')
}

// ─── Analysis ────────────────────────────────────────────────────────────────

async function generarInsights(apiKey: string, body: RequestBody): Promise<InsightsResponse> {
  const { resumen, gastos, subcategorias, presupuestos, recurrentes, cuotas, mes, anio, nombre_usuario } = body

  const labelMes = nombreMes(mes, anio)
  const nombre = nombre_usuario ?? 'el usuario'

  // Build financial context summary for Claude
  const resumenPorMoneda = resumen.reduce<Record<string, ResumenMoneda>>((acc, r) => {
    acc[r.moneda] = r
    return acc
  }, {})

  const arsData = resumenPorMoneda['ARS']
  const usdData = resumenPorMoneda['USD']

  const ingresosARS = arsData ? Number(arsData.total_ingresos) : 0
  const egresosARS = arsData ? Number(arsData.total_egresos) : 0
  const balanceARS = arsData ? Number(arsData.balance) : 0
  const ingresosUSD = usdData ? Number(usdData.total_ingresos) : 0
  const egresosUSD = usdData ? Number(usdData.total_egresos) : 0

  const tasaAhorro = ingresosARS > 0 ? ((ingresosARS - egresosARS) / ingresosARS * 100).toFixed(1) : null
  const topGastos = (gastos ?? []).slice(0, 5).map(g => `${g.categoria_nombre}: ${formatARS(Number(g.total_egresos))}`)

  // Detect budget overruns
  const presupuestosConOverrun = (presupuestos ?? []).filter(p => {
    if (!p.gastos_actuales || !p.limite) return false
    return Number(p.gastos_actuales) > Number(p.limite)
  })

  // Upcoming cuotas
  const cuotasActivas = (cuotas ?? []).filter(c => c.activa && c.cuotas_pagadas < c.cantidad_cuotas)
  const totalCuotasMes = cuotasActivas.reduce((s, c) => s + Number(c.monto_cuota), 0)

  // Recurrentes activos
  const recurrentesActivos = (recurrentes ?? []).filter(r => r.activo)
  const totalRecurrentesEgresos = recurrentesActivos
    .filter(r => r.tipo === 'egreso' && r.moneda === 'ARS')
    .reduce((s, r) => s + Number(r.monto), 0)

  const contextFinanciero = `
CONTEXTO FINANCIERO DE ${nombre.toUpperCase()} - ${labelMes.toUpperCase()}

=== RESUMEN MENSUAL ===
ARS: Ingresos ${formatARS(ingresosARS)} | Egresos ${formatARS(egresosARS)} | Balance ${formatARS(balanceARS)}${tasaAhorro ? ` | Tasa ahorro: ${tasaAhorro}%` : ''}
${ingresosUSD > 0 || egresosUSD > 0 ? `USD: Ingresos U$D${ingresosUSD.toLocaleString('es-AR')} | Egresos U$D${egresosUSD.toLocaleString('es-AR')}` : ''}

=== TOP GASTOS POR CATEGORÍA ===
${topGastos.length > 0 ? topGastos.join('\n') : 'Sin gastos registrados'}

${subcategorias && subcategorias.length > 0 ? `=== TOP SUBCATEGORÍAS ===\n${subcategorias.slice(0, 5).map(s => `${s.categoria_nombre}: ${formatARS(Number(s.total_egresos))}`).join('\n')}` : ''}

${presupuestosConOverrun.length > 0 ? `=== PRESUPUESTOS EXCEDIDOS ===\n${presupuestosConOverrun.map(p => `${p.categoria?.nombre ?? 'Sin categoría'}: límite ${formatARS(Number(p.limite))}, gastado ${formatARS(Number(p.gastos_actuales))}`).join('\n')}` : ''}

${cuotasActivas.length > 0 ? `=== CUOTAS EN CURSO ===\n${cuotasActivas.map(c => `${c.descripcion}: cuota ${c.cuotas_pagadas + 1}/${c.cantidad_cuotas} (${formatARS(Number(c.monto_cuota))})`).join('\n')}\nTotal cuotas del mes: ${formatARS(totalCuotasMes)}` : ''}

${recurrentesActivos.length > 0 ? `=== GASTOS FIJOS RECURRENTES ===\n${recurrentesActivos.map(r => `${r.descripcion}: ${r.moneda === 'USD' ? 'U$D' : formatARS(Number(r.monto))} (día ${r.dia_del_mes})`).join('\n')}\nTotal fijos ARS/mes: ${formatARS(totalRecurrentesEgresos)}` : ''}
`

  const systemPrompt = `Sos un asesor financiero personal experto para argentinos. Analizás datos financieros reales y generás insights accionables, específicos y útiles.

Tu tarea: analizar el contexto financiero y devolver un JSON con insights personalizados.

Tipos de insights:
- "alerta": problemas urgentes (presupuesto excedido, balance negativo, gasto anormal)
- "consejo": recomendaciones proactivas (optimizar, ahorrar, reorganizar)
- "logro": reconocer algo positivo (buen ahorro, presupuesto cumplido)
- "tendencia": patrones observados en los datos
- "proyeccion": estimaciones basadas en los datos actuales

Prioridades: "alta" (requiere atención inmediata), "media" (importante pero no urgente), "baja" (informativo)

Reglas:
- Máximo 5 insights, mínimo 2
- Sé ESPECÍFICO con números reales del contexto
- Usá español argentino informal
- El score_financiero va de 0 a 100 (considera ahorro, control de presupuesto, diversificación)
- El resumen_ejecutivo es UNA sola oración que resume el mes
- Si no hay datos suficientes, generá insights útiles igualmente

Respondé ÚNICAMENTE con JSON válido:
{
  "insights": [
    {
      "tipo": "alerta|consejo|logro|tendencia|proyeccion",
      "titulo": "Título corto (max 40 chars)",
      "descripcion": "Descripción accionable con datos específicos (1-2 oraciones)",
      "prioridad": "alta|media|baja",
      "valor": "Número o % relevante (opcional)"
    }
  ],
  "resumen_ejecutivo": "Una oración que resume el estado financiero del mes",
  "score_financiero": 75
}`

  const raw = await callClaude(apiKey, systemPrompt, contextFinanciero)
  const parsed = extractJson(raw) as { insights: Insight[]; resumen_ejecutivo: string; score_financiero?: number }

  return {
    insights: parsed.insights ?? [],
    resumen_ejecutivo: parsed.resumen_ejecutivo ?? 'Sin datos suficientes para generar un resumen.',
    score_financiero: parsed.score_financiero,
    generado_en: new Date().toISOString(),
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY no configurada' }, 500)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400)
  }

  if (!body.resumen || !body.mes || !body.anio) {
    return jsonResponse({ error: 'Faltan campos: resumen, mes, anio' }, 400)
  }

  try {
    const result = await generarInsights(apiKey, body)
    return jsonResponse(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    console.error('era-insights error:', message)
    return jsonResponse({ error: message }, 500)
  }
})
