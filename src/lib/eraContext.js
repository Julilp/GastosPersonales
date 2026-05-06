import { supabase } from './supabaseClient'

// ─── Era Context: AI-powered financial insights layer ────────────────────────
//
// Wraps the era-insights edge function and provides helpers for
// generating personalized financial insights, scores, and recommendations
// powered by Claude AI with full financial context.

export async function getEraInsights({ resumen, gastos, subcategorias, presupuestos, recurrentes, cuotas, mes, anio }) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase.functions.invoke('era-insights', {
    body: {
      resumen,
      gastos,
      subcategorias: subcategorias ?? [],
      presupuestos: presupuestos ?? [],
      recurrentes: recurrentes ?? [],
      cuotas: cuotas ?? [],
      mes,
      anio,
      nombre_usuario: user?.email?.split('@')[0] ?? 'Julian',
    },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

// Maps insight type to display config
export const INSIGHT_CONFIG = {
  alerta: { emoji: '⚠️', color: '#f87171', bg: 'rgba(248,113,113,0.08)', label: 'Alerta' },
  consejo: { emoji: '💡', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', label: 'Consejo' },
  logro: { emoji: '🏆', color: '#34d399', bg: 'rgba(52,211,153,0.08)', label: 'Logro' },
  tendencia: { emoji: '📊', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', label: 'Tendencia' },
  proyeccion: { emoji: '🔮', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Proyección' },
}

export const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 }

// Sorts insights: alerts first, then by priority
export function sortInsights(insights) {
  return [...insights].sort((a, b) => {
    if (a.tipo === 'alerta' && b.tipo !== 'alerta') return -1
    if (b.tipo === 'alerta' && a.tipo !== 'alerta') return 1
    return (PRIORITY_ORDER[a.prioridad] ?? 1) - (PRIORITY_ORDER[b.prioridad] ?? 1)
  })
}

// Score color based on financial health score (0-100)
export function getScoreColor(score) {
  if (score >= 75) return '#34d399'
  if (score >= 50) return '#f59e0b'
  return '#f87171'
}

export function getScoreLabel(score) {
  if (score >= 80) return 'Excelente'
  if (score >= 65) return 'Bueno'
  if (score >= 50) return 'Regular'
  if (score >= 35) return 'Necesita atención'
  return 'Crítico'
}

// Suggested chat prompts based on available financial data
export function getSuggestedPrompts(resumen, gastos) {
  const base = [
    'Analiza mis gastos de este mes',
    '¿Cómo puedo ahorrar más?',
    '¿En qué categoría gasto más?',
  ]

  const tieneIngresos = resumen?.some(r => Number(r.total_ingresos) > 0)
  const tieneGastos = resumen?.some(r => Number(r.total_egresos) > 0)
  const topCategoria = gastos?.[0]?.categoria_nombre

  const dinamicos = []
  if (tieneIngresos && tieneGastos) {
    dinamicos.push('¿Cuál es mi tasa de ahorro este mes?')
  }
  if (topCategoria) {
    dinamicos.push(`¿Estoy gastando demasiado en ${topCategoria.toLowerCase()}?`)
  }
  if (tieneGastos) {
    dinamicos.push('Dame consejos para reducir mis egresos')
    dinamicos.push('¿Cómo voy con el presupuesto?')
  }

  return [...dinamicos, ...base].slice(0, 4)
}
