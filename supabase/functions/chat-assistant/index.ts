const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// ─── Types ───────────────────────────────────────────────────────────────────

type Intent = 'finanzas' | 'calendario_crear' | 'calendario_ver' | 'calendario_borrar' | 'chat'

interface MovimientoParseado {
  tipo: 'egreso' | 'ingreso'
  monto: number
  moneda: 'ARS' | 'USD'
  descripcion: string
  categoria_id: number | null
  cuenta_id: number | null
  fecha: string
}

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: string
  end: string
}

interface EventoDatos {
  summary: string
  description?: string
  start_datetime: string
  end_datetime: string
  location?: string
}

interface AssistantResponse {
  intent: Intent
  movimientos?: MovimientoParseado[]
  mensaje?: string
  eventos?: CalendarEvent[]
}

interface RequestBody {
  texto: string
  categorias: unknown[]
  cuentas: unknown[]
  fecha_hoy: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}

// ─── Claude helper ───────────────────────────────────────────────────────────

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024,
): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
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
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No se encontró JSON en la respuesta')
  return JSON.parse(match[0])
}

// ─── Google OAuth2 ───────────────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Calendar no configurado. Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en los secrets de la Edge Function.',
    )
  }
  if (!refreshToken) {
    throw new Error(
      'Google Calendar no configurado. Falta GOOGLE_REFRESH_TOKEN en los secrets de la Edge Function. Completá el flujo OAuth2 para obtenerlo.',
    )
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const errTxt = await res.text()
    console.error('Google token error:', res.status, errTxt)
    throw new Error(`Error obteniendo token de Google (${res.status}). Verificá las credenciales OAuth2.`)
  }

  const tokenData = await res.json()
  if (!tokenData.access_token) {
    throw new Error('Google no devolvió un access_token válido.')
  }
  return tokenData.access_token as string
}

// ─── Intent classification ───────────────────────────────────────────────────

async function clasificarIntent(apiKey: string, texto: string, fechaHoy: string): Promise<Intent> {
  const systemPrompt = `Sos un clasificador de intents para un asistente personal argentino de finanzas y agenda.
Fecha de hoy: ${fechaHoy}

Clasificá el mensaje del usuario en UNO de estos intents. Respondé ÚNICAMENTE con el intent, sin texto adicional:

- "finanzas" → el usuario menciona gastos, ingresos, movimientos de dinero, compras, pagos, sueldos, transferencias
- "calendario_crear" → el usuario quiere crear, agendar, añadir o recordar un evento, reunión, cita, turno, etc.
- "calendario_ver" → el usuario quiere ver, consultar o listar sus eventos, agenda, qué tiene pendiente, etc.
- "calendario_borrar" → el usuario quiere borrar, eliminar o cancelar un evento de su agenda
- "chat" → consultas generales, preguntas sobre su situación financiera, saludos, o cualquier cosa que no encaje en los anteriores

Respondé SOLO con una de estas palabras: finanzas, calendario_crear, calendario_ver, calendario_borrar, chat`

  const raw = await callClaude(apiKey, systemPrompt, texto, 20)
  const intent = raw.trim().toLowerCase() as Intent

  const validos: Intent[] = ['finanzas', 'calendario_crear', 'calendario_ver', 'calendario_borrar', 'chat']
  return validos.includes(intent) ? intent : 'chat'
}

// ─── Intent handlers ─────────────────────────────────────────────────────────

async function handleFinanzas(
  apiKey: string,
  texto: string,
  categorias: unknown[],
  cuentas: unknown[],
  fechaHoy: string,
): Promise<AssistantResponse> {
  const systemPrompt = `Sos un asistente de finanzas personales argentino. Analiza el texto del usuario y extrae TODOS los movimientos de dinero mencionados.

Fecha de hoy: ${fechaHoy}

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
- Para categoria_id y cuenta_id: elegir el mas apropiado de la lista. Si no hay match, usar null
- Para cuenta_id null, usar la primera cuenta de la lista como default
- fecha: usar fecha_hoy si no se especifica otra

Devuelve UNICAMENTE un JSON valido sin texto adicional:
{"movimientos":[{"tipo":"egreso|ingreso","monto":number,"moneda":"ARS|USD","descripcion":"string corta descriptiva","categoria_id":number|null,"cuenta_id":number|null,"fecha":"YYYY-MM-DD"}]}`

  const raw = await callClaude(apiKey, systemPrompt, texto)
  const parsed = extractJson(raw) as { movimientos?: MovimientoParseado[] }

  return {
    intent: 'finanzas',
    movimientos: parsed.movimientos ?? [],
  }
}

async function handleCalendarioCrear(
  apiKey: string,
  texto: string,
  fechaHoy: string,
): Promise<AssistantResponse> {
  // 1. Extraer datos del evento con Claude
  const systemPrompt = `Sos un asistente personal argentino. El usuario quiere crear un evento en Google Calendar.
Fecha de hoy: ${fechaHoy}

Extraé los datos del evento del mensaje y respondé ÚNICAMENTE con un JSON válido en este formato:
{
  "summary": "título del evento",
  "description": "descripción opcional o null",
  "start_datetime": "YYYY-MM-DDTHH:MM:SS",
  "end_datetime": "YYYY-MM-DDTHH:MM:SS",
  "location": "lugar opcional o null"
}

Reglas:
- Si no menciona hora de fin, asumir 1 hora después del inicio
- Si no menciona hora, asumir 09:00
- Si dice "mañana", calcular a partir de fecha_hoy
- Si dice "el lunes", "el viernes", etc., calcular la próxima ocurrencia a partir de fecha_hoy
- Usar formato ISO 8601 para fechas y horas
- summary es obligatorio; si no hay título claro, inferirlo del contexto`

  const raw = await callClaude(apiKey, systemPrompt, texto)
  const eventoDatos = extractJson(raw) as EventoDatos

  if (!eventoDatos.summary || !eventoDatos.start_datetime || !eventoDatos.end_datetime) {
    throw new Error('No pude extraer los datos del evento. Especificá título y fecha/hora.')
  }

  // 2. Obtener access token y crear el evento
  const accessToken = await getGoogleAccessToken()

  const eventBody = {
    summary: eventoDatos.summary,
    ...(eventoDatos.description ? { description: eventoDatos.description } : {}),
    ...(eventoDatos.location ? { location: eventoDatos.location } : {}),
    start: {
      dateTime: eventoDatos.start_datetime,
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    end: {
      dateTime: eventoDatos.end_datetime,
      timeZone: 'America/Argentina/Buenos_Aires',
    },
  }

  const calRes = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  })

  if (!calRes.ok) {
    const errTxt = await calRes.text()
    console.error('Google Calendar create error:', calRes.status, errTxt)
    throw new Error(`Error creando evento en Google Calendar (${calRes.status})`)
  }

  const evento = await calRes.json()
  const fechaFormateada = new Date(eventoDatos.start_datetime).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  return {
    intent: 'calendario_crear',
    mensaje: `Evento creado: "${evento.summary}" para el ${fechaFormateada}.${eventoDatos.location ? ` Lugar: ${eventoDatos.location}.` : ''}`,
  }
}

async function handleCalendarioVer(
  apiKey: string,
  texto: string,
  fechaHoy: string,
): Promise<AssistantResponse> {
  // 1. Determinar el rango de fechas con Claude
  const systemPrompt = `Sos un asistente personal argentino. El usuario quiere ver eventos de su Google Calendar.
Fecha de hoy: ${fechaHoy}

Extraé el rango de fechas del mensaje y respondé ÚNICAMENTE con un JSON válido:
{
  "time_min": "YYYY-MM-DDTHH:MM:SS",
  "time_max": "YYYY-MM-DDTHH:MM:SS"
}

Reglas:
- Si no especifica rango, usar desde hoy hasta 7 días después
- "esta semana" = desde hoy hasta el próximo domingo
- "hoy" = desde el inicio del día hasta el fin del día
- "mañana" = el día siguiente completo
- Siempre en formato ISO 8601`

  const raw = await callClaude(apiKey, systemPrompt, texto, 256)
  let rango: { time_min: string; time_max: string }

  try {
    rango = extractJson(raw) as { time_min: string; time_max: string }
  } catch {
    // Fallback: próximos 7 días
    const desde = new Date(fechaHoy)
    const hasta = new Date(fechaHoy)
    hasta.setDate(hasta.getDate() + 7)
    rango = {
      time_min: desde.toISOString(),
      time_max: hasta.toISOString(),
    }
  }

  // 2. Consultar Google Calendar
  const accessToken = await getGoogleAccessToken()

  const params = new URLSearchParams({
    timeMin: new Date(rango.time_min).toISOString(),
    timeMax: new Date(rango.time_max).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  })

  const calRes = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!calRes.ok) {
    const errTxt = await calRes.text()
    console.error('Google Calendar list error:', calRes.status, errTxt)
    throw new Error(`Error consultando Google Calendar (${calRes.status})`)
  }

  const calData = await calRes.json()
  const items = (calData.items ?? []) as Array<{
    id: string
    summary?: string
    description?: string
    location?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
  }>

  if (items.length === 0) {
    return {
      intent: 'calendario_ver',
      eventos: [],
      mensaje: 'No tenés eventos en ese período.',
    }
  }

  const eventos: CalendarEvent[] = items.map(item => ({
    id: item.id,
    summary: item.summary ?? '(sin título)',
    description: item.description,
    location: item.location,
    start: item.start?.dateTime ?? item.start?.date ?? '',
    end: item.end?.dateTime ?? item.end?.date ?? '',
  }))

  const lineas = eventos.map(ev => {
    const fecha = new Date(ev.start).toLocaleString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    return `• ${ev.summary} — ${fecha}${ev.location ? ` (${ev.location})` : ''}`
  })

  return {
    intent: 'calendario_ver',
    eventos,
    mensaje: `Tus próximos eventos:\n${lineas.join('\n')}`,
  }
}

async function handleCalendarioBorrar(
  apiKey: string,
  texto: string,
  fechaHoy: string,
): Promise<AssistantResponse> {
  // 1. Extraer qué evento borrar
  const systemPrompt = `Sos un asistente personal argentino. El usuario quiere borrar un evento de Google Calendar.
Fecha de hoy: ${fechaHoy}

Extraé los datos de búsqueda del mensaje y respondé ÚNICAMENTE con un JSON válido:
{
  "query": "nombre o descripción del evento a buscar",
  "fecha": "YYYY-MM-DD o null si no se menciona fecha"
}

Si el usuario dice "el turno del dentista del viernes", query = "dentista" y fecha = la fecha del próximo viernes.`

  const raw = await callClaude(apiKey, systemPrompt, texto, 256)
  const busqueda = extractJson(raw) as { query: string; fecha: string | null }

  if (!busqueda.query) {
    throw new Error('No entendí qué evento querés borrar. Especificá el nombre o fecha.')
  }

  // 2. Buscar eventos en un rango amplio
  const accessToken = await getGoogleAccessToken()

  const desde = busqueda.fecha
    ? new Date(busqueda.fecha)
    : new Date(fechaHoy)

  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + 30)

  const params = new URLSearchParams({
    q: busqueda.query,
    timeMin: desde.toISOString(),
    timeMax: hasta.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '5',
  })

  const listRes = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!listRes.ok) {
    const errTxt = await listRes.text()
    console.error('Google Calendar search error:', listRes.status, errTxt)
    throw new Error(`Error buscando evento en Google Calendar (${listRes.status})`)
  }

  const listData = await listRes.json()
  const items = listData.items ?? []

  if (items.length === 0) {
    return {
      intent: 'calendario_borrar',
      mensaje: `No encontré ningún evento que coincida con "${busqueda.query}".`,
    }
  }

  // Borrar el primer evento encontrado
  const eventoABorrar = items[0] as { id: string; summary?: string; start?: { dateTime?: string; date?: string } }

  const deleteRes = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventoABorrar.id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  if (!deleteRes.ok && deleteRes.status !== 204) {
    const errTxt = await deleteRes.text()
    console.error('Google Calendar delete error:', deleteRes.status, errTxt)
    throw new Error(`Error borrando el evento (${deleteRes.status})`)
  }

  const fechaEvento = eventoABorrar.start?.dateTime ?? eventoABorrar.start?.date ?? ''
  const fechaFormateada = fechaEvento
    ? new Date(fechaEvento).toLocaleString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    : ''

  return {
    intent: 'calendario_borrar',
    mensaje: `Evento eliminado: "${eventoABorrar.summary ?? busqueda.query}"${fechaFormateada ? ` del ${fechaFormateada}` : ''}.`,
  }
}

async function handleChat(
  apiKey: string,
  texto: string,
  fechaHoy: string,
): Promise<AssistantResponse> {
  const systemPrompt = `Sos un asistente personal amigable de finanzas para un argentino.
Fecha de hoy: ${fechaHoy}

Respondé de forma concisa y útil. Podés:
- Dar consejos sobre finanzas personales
- Responder preguntas generales
- Guiar al usuario sobre cómo usar el asistente (registrar gastos en texto libre, consultar agenda, etc.)

Usá español argentino informal. Máximo 3-4 oraciones.`

  const mensaje = await callClaude(apiKey, systemPrompt, texto, 512)

  return {
    intent: 'chat',
    mensaje: mensaje.trim(),
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return errorResponse('ANTHROPIC_API_KEY no configurada', 500)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Body inválido')
  }

  const { texto, categorias, cuentas, fecha_hoy } = body

  if (!texto || !categorias || !cuentas || !fecha_hoy) {
    return errorResponse('Faltan campos requeridos: texto, categorias, cuentas, fecha_hoy')
  }

  try {
    // Clasificar intent
    const intent = await clasificarIntent(apiKey, texto, fecha_hoy)

    let resultado: AssistantResponse

    switch (intent) {
      case 'finanzas':
        resultado = await handleFinanzas(apiKey, texto, categorias, cuentas, fecha_hoy)
        break

      case 'calendario_crear':
        resultado = await handleCalendarioCrear(apiKey, texto, fecha_hoy)
        break

      case 'calendario_ver':
        resultado = await handleCalendarioVer(apiKey, texto, fecha_hoy)
        break

      case 'calendario_borrar':
        resultado = await handleCalendarioBorrar(apiKey, texto, fecha_hoy)
        break

      case 'chat':
      default:
        resultado = await handleChat(apiKey, texto, fecha_hoy)
        break
    }

    return jsonResponse(resultado)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    console.error('chat-assistant error:', message)
    return errorResponse(message, 500)
  }
})
