const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ICON_OPTIONS = [
  'utensils','car','heart-pulse','star','zap','briefcase','package',
  'sun','moon','shopping-cart','coffee','bike','train-front','fuel',
  'milestone','pill','stethoscope','shield-check','wine','tv',
  'trophy','plane','lightbulb','flame','wifi','home','smartphone',
  'activity','wrench','music','camera','book','gift','map-pin',
  'dumbbell','scissors','shirt','wallet','users','dog','baby',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { descripcion, tipo, categorias } = await req.json()

  const listaCateg = categorias.flatMap(c => {
    const lines = [`- ID:${c.id} | icono:${c.icono || 'package'} | ${c.nombre}`]
    if (c.subcategorias?.length) {
      c.subcategorias.forEach(s => lines.push(`  - ID:${s.id} | icono:${s.icono || 'package'} | ${s.nombre}`))
    }
    return lines
  }).join('\n')

  const prompt = `Sos un asistente de finanzas personales argentino. El usuario registró este movimiento:
Tipo: ${tipo}
Descripción: "${descripcion}"

Categorías disponibles (los iconos son nombres de iconos Lucide):
${listaCateg}

Tu tarea: elegir la categoría más apropiada. Priorizá subcategorías específicas sobre categorías padre.
Si ninguna encaja bien, sugerí una categoría nueva con nombre corto y un icono Lucide del siguiente listado:
${ICON_OPTIONS.join(', ')}

Ejemplos:
- "salida a comer con Valen" → { "es_nueva": true, "categoria_nombre": "Salidas con Valen", "icono": "wine" }
- "clase de pádel" → si existe subcategoría Pádel, usar su ID; si no → { "es_nueva": true, "categoria_nombre": "Pádel", "icono": "activity" }
- "arreglo frenos auto" → si existe subcategoría Auto usar su ID
- "gym" → usar ID de Deportes o subcategoría correspondiente

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"categoria_id": "el-id-exacto-o-null", "categoria_nombre": "nombre", "icono": "nombre-lucide", "es_nueva": false}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const text = data.content?.[0]?.text ?? '{}'
  const match = text.match(/\{[\s\S]*\}/)
  const result = match ? JSON.parse(match[0]) : { categoria_id: null, categoria_nombre: '', icono: 'package', es_nueva: false }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
