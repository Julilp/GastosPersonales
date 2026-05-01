const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada', movimientos: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let body: { texto: string; categorias: unknown[]; cuentas: unknown[]; fecha_hoy: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body invalido', movimientos: [] }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { texto, categorias, cuentas, fecha_hoy } = body

  if (!texto || !categorias || !cuentas || !fecha_hoy) {
    return new Response(
      JSON.stringify({ error: 'Faltan campos requeridos', movimientos: [] }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const systemPrompt = `Sos un asistente de finanzas personales argentino. Analiza el texto del usuario y extrae TODOS los movimientos de dinero mencionados.

Fecha de hoy: ${fecha_hoy}

Categorias disponibles (usar el id exacto):
${JSON.stringify(categorias)}

Cuentas disponibles (usar el id exacto):
${JSON.stringify(cuentas)}

Reglas:
- "k" o "mil" = multiplicar por 1000 (10k = 10000)
- Si no especifica moneda, usar ARS
- Si dice "dolares", "usd", "verdes" = USD para ese movimiento
- Si dice "sueldo", "pagaron", "cobre", "me depositaron", "cobré", "me pagaron", "gané" = ingreso
- Todo lo demas = egreso por defecto
- COMPRA DE DIVISAS: si el usuario dice "compre dolares/usd/verdes" y menciona cuanto gasto en ARS Y cuantos dolares recibio, generar DOS movimientos: (1) egreso en ARS por lo que gasto, (2) ingreso en USD por los dolares que recibio. Mismo principio para venta de dolares (egreso USD + ingreso ARS).
- SEPARAR bien cada gasto mencionado, aunque esten en una sola oracion larga
- Para categoria_id: elegir el mas apropiado de la lista. Si no hay match, usar el id de la primera categoria de la lista (nunca null)
- Para cuenta_id: elegir el mas apropiado de la lista. Si no hay match, usar el id de la primera cuenta de la lista (nunca null)
- fecha: usar fecha_hoy si no se especifica otra

Devuelve UNICAMENTE un JSON valido sin texto adicional:
{"movimientos":[{"tipo":"egreso|ingreso","monto":number,"moneda":"ARS|USD","descripcion":"string corta descriptiva","categoria_id":number,"cuenta_id":number,"fecha":"YYYY-MM-DD"}]}`

  let claudeRes: Response
  try {
    claudeRes = await fetch(ANTHROPIC_API_URL, {
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
  } catch {
    return new Response(
      JSON.stringify({ error: 'Error de red llamando a Claude', movimientos: [] }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!claudeRes.ok) {
    const errTxt = await claudeRes.text()
    console.error('Claude API error:', claudeRes.status, errTxt)
    return new Response(
      JSON.stringify({ error: `Claude API error ${claudeRes.status}`, movimientos: [] }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const claudeData = await claudeRes.json()
  const raw: string = claudeData?.content?.[0]?.text ?? ''

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no json')
    const parsed = JSON.parse(match[0])
    return new Response(
      JSON.stringify({ movimientos: parsed.movimientos ?? [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    console.error('Parse error. Raw:', raw)
    return new Response(
      JSON.stringify({ error: 'No pude interpretar el mensaje', movimientos: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
