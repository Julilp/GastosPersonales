// supabase/functions/parse-movimientos/index.ts
// Integración: Anthropic Claude API
// Propósito: parsear texto libre en movimientos financieros estructurados
// Env vars requeridas: ANTHROPIC_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

interface Categoria {
  id: number
  nombre: string
  icono: string
}

interface Cuenta {
  id: number
  nombre: string
}

interface RequestBody {
  texto: string
  categorias: Categoria[]
  cuentas: Cuenta[]
  fecha_hoy: string
}

interface Movimiento {
  tipo: 'egreso' | 'ingreso'
  monto: number
  moneda: 'ARS' | 'USD'
  descripcion: string
  categoria_id: number | null
  cuenta_id: number | null
  fecha: string
}

function buildSystemPrompt(categorias: Categoria[], cuentas: Cuenta[], fecha_hoy: string): string {
  return `Sos un asistente de finanzas personales argentino. Analizá el texto del usuario y extraé TODOS los movimientos de dinero mencionados.

Fecha de hoy: ${fecha_hoy}

Categorías disponibles (usar el id exacto):
${JSON.stringify(categorias)}

Cuentas disponibles (usar el id exacto):
${JSON.stringify(cuentas)}

Reglas:
- "k" o "mil" = multiplicar por 1000 (10k = 10000)
- Si no especifica moneda, usar ARS
- Si dice "dólares", "usd", "verdes" = USD
- Si dice "sueldo", "pagaron", "cobré" = ingreso. Todo lo demás = egreso por defecto
- Para categoria_id y cuenta_id: elegir el más apropiado de la lista. Si no hay match, usar null
- Para cuenta_id null, usar la primera cuenta de la lista como default
- fecha: usar fecha_hoy si no se especifica otra

Devolvé ÚNICAMENTE un JSON válido sin texto adicional:
{"movimientos":[{"tipo":"egreso|ingreso","monto":number,"moneda":"ARS|USD","descripcion":"string corta descriptiva","categoria_id":number|null,"cuenta_id":number|null,"fecha":"YYYY-MM-DD"}]}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body: RequestBody = await req.json()
    const { texto, categorias, cuentas, fecha_hoy } = body

    if (!texto || !categorias || !cuentas || !fecha_hoy) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos: texto, categorias, cuentas, fecha_hoy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const systemPrompt = buildSystemPrompt(categorias, cuentas, fecha_hoy)

    const claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: texto }],
      }),
    })

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text()
      console.error('Claude API error:', claudeResponse.status, errorBody)
      return new Response(
        JSON.stringify({ error: 'Error al llamar a Claude API', movimientos: [] }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const claudeData = await claudeResponse.json()
    const rawContent: string = claudeData?.content?.[0]?.text ?? ''

    let movimientos: Movimiento[] = []

    try {
      // Claude puede devolver el JSON con texto alrededor en casos extremos — extraer
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta')

      const parsed = JSON.parse(jsonMatch[0])
      movimientos = parsed.movimientos ?? []
    } catch (parseError) {
      console.error('Error parseando respuesta de Claude:', parseError, 'Raw:', rawContent)
      return new Response(
        JSON.stringify({ error: 'No pude interpretar el mensaje', movimientos: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ movimientos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error inesperado en parse-movimientos:', error)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', movimientos: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
