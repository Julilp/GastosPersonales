import { useState, useEffect, useRef } from 'react'
import { THEME } from '../config/theme'
import { APP_CONFIG, formatMoney } from '../config/app.config'
import { getCuentas, getCategorias, crearMovimiento } from '../lib/finanzas'
import { supabase } from '../lib/supabaseClient'
import { Bot, Send, Loader2, X } from 'lucide-react'

function TypingIndicator() {
  return (
    <div style={s.typingBubble}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            ...s.typingDot,
            animation: `pulse 1.4s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function Chat() {
  const [msgs, setMsgs] = useState([])
  const [texto, setTexto] = useState('')
  const [parseando, setParseando] = useState(false)
  const [error, setError] = useState('')
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const endRef = useRef(null)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, parseando])

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

  async function handleInterpretar() {
    if (!texto.trim() || parseando) return
    const textoEnviado = texto.trim()
    setMsgs(prev => [...prev, { role: 'user', text: textoEnviado }])
    setTexto('')
    setParseando(true)
    setError('')

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-movimientos', {
        body: {
          texto: textoEnviado,
          categorias: categoriasFlat,
          cuentas,
          fecha_hoy: new Date().toISOString().slice(0, 10),
        },
      })
      if (fnError) throw new Error(fnError.message)
      const parsed = Array.isArray(data) ? data : (data?.movimientos ?? [])
      if (!parsed.length) throw new Error('No se encontraron movimientos en el texto.')

      const guardados = await Promise.all(parsed.map(m => crearMovimiento(m)))
      setMsgs(prev => [
        ...prev,
        {
          role: 'ai',
          text: `Registré ${guardados.length} movimiento${guardados.length !== 1 ? 's' : ''}:`,
          items: guardados,
        },
      ])
    } catch (e) {
      setMsgs(prev => [...prev, { role: 'ai', text: `No pude interpretar el mensaje: ${e.message}` }])
    }
    setParseando(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleInterpretar()
    }
  }

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={{ ...s.header, padding: isMobile ? '16px' : '28px 32px 16px' }}>
        <div>
          <h1 style={{ ...s.titulo, fontSize: isMobile ? '20px' : '22px' }}>Chat</h1>
          <p style={s.subtitulo}>Registrá movimientos en texto libre</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={s.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={s.errorClose}><X size={16} /></button>
        </div>
      )}

      {/* Messages area */}
      <div style={{ ...s.messagesArea, padding: isMobile ? '16px 16px 140px' : '16px 32px 120px' }}>
        {msgs.length === 0 && !parseando ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}><Bot size={48} color={THEME.colors.textMuted} strokeWidth={1.5} /></div>
            <p style={s.emptyTitulo}>Escribi tus movimientos abajo</p>
            <p style={s.emptyDesc}>
              Ej: "gasté 10k en padel, pagué nafta 5k y me depositaron 50k de sueldo"
            </p>
          </div>
        ) : (
          <div style={s.bubbleList}>
            {msgs.map((msg, i) => {
              if (msg.role === 'user') {
                return (
                  <div key={i} style={s.userBubbleWrap}>
                    <div style={{ ...s.bubble, ...s.userBubble, animation: 'slideUp 0.3s ease' }}>
                      {msg.text}
                    </div>
                  </div>
                )
              }
              // AI bubble
              return (
                <div key={i} style={s.aiBubbleWrap}>
                  <div style={{ ...s.bubble, ...s.aiBubble, animation: 'slideUp 0.3s ease' }}>
                    <span style={s.aiText}>{msg.text}</span>
                    {msg.items && msg.items.length > 0 && (
                      <div style={s.itemsList}>
                        {msg.items.map((mov, j) => {
                          const esIngreso = mov.tipo === 'ingreso'
                          const color = esIngreso ? THEME.colors.success : THEME.colors.danger
                          const signo = esIngreso ? '+' : '-'
                          return (
                            <div key={j} style={s.movRow}>
                              <div style={s.movRowLeft}>
                                <span style={{
                                  ...s.movDot,
                                  background: color,
                                }} />
                                <span style={s.movRowDesc}>{mov.descripcion || nombreCategoria(mov.categoria_id)}</span>
                              </div>
                              <span style={{ ...s.movRowMonto, color }}>
                                {signo}{formatMoney(mov.monto, mov.moneda ?? APP_CONFIG.defaultCurrency)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {parseando && (
              <div style={s.aiBubbleWrap}>
                <TypingIndicator />
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input area — fixed */}
      <div style={{ 
        ...s.inputBar, 
        left: isMobile ? 0 : '220px',
        bottom: isMobile ? '64px' : 0,
        padding: isMobile ? '12px 16px' : '12px 24px'
      }}>
        <div style={s.inputWrap}>
          <input
            type="text"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: gasté 10k en padel, pagué 5k de nafta..."
            disabled={parseando}
            style={{ ...s.input, opacity: parseando ? 0.6 : 1 }}
          />
          <button
            onClick={handleInterpretar}
            disabled={parseando || !texto.trim()}
            style={{
              ...s.sendBtn,
              opacity: parseando || !texto.trim() ? 0.5 : 1,
              cursor: parseando || !texto.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {parseando
              ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Guardando...</>
              : <><Send size={15} /> Interpretar</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh', background: THEME.colors.bg,
    color: THEME.colors.textPrimary, fontFamily: THEME.font, position: 'relative',
  },
  header: {
    padding: '28px 32px 16px',
    borderBottom: `1px solid ${THEME.colors.cardBorder}`,
  },
  titulo: { margin: 0, fontSize: '22px', fontWeight: 700, color: THEME.colors.textPrimary, letterSpacing: '-0.5px' },
  subtitulo: { margin: '4px 0 0', fontSize: '13px', color: THEME.colors.textMuted },
  errorBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: THEME.colors.errorBg, color: THEME.colors.danger,
    borderRadius: THEME.radius.sm, padding: '12px 14px',
    margin: '12px 32px 0', fontSize: '14px', gap: '8px',
  },
  errorClose: {
    background: 'none', border: 'none', color: THEME.colors.danger,
    cursor: 'pointer', padding: '0 4px', flexShrink: 0,
    display: 'flex', alignItems: 'center', lineHeight: 0,
  },
  messagesArea: {
    padding: '16px 32px 120px',
    minHeight: 'calc(100vh - 80px)',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '50vh', gap: '12px', textAlign: 'center', padding: '20px',
  },
  emptyIcon: { lineHeight: 0, opacity: 0.5 },
  emptyTitulo: { margin: 0, fontSize: '18px', fontWeight: 600, color: THEME.colors.textMuted },
  emptyDesc: { margin: 0, fontSize: '13px', color: THEME.colors.textMuted, maxWidth: '280px', lineHeight: '1.5' },
  bubbleList: {
    display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '680px', margin: '0 auto',
  },
  userBubbleWrap: { display: 'flex', justifyContent: 'flex-end' },
  aiBubbleWrap: { display: 'flex', justifyContent: 'flex-start' },
  bubble: {
    padding: '14px 18px', borderRadius: THEME.radius.lg,
    fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word',
  },
  userBubble: {
    alignSelf: 'flex-end', maxWidth: '70%',
    background: THEME.colors.accent, color: '#fff',
  },
  aiBubble: {
    alignSelf: 'flex-start', maxWidth: '75%',
    background: THEME.colors.card, border: `1px solid ${THEME.colors.cardBorder}`,
    color: THEME.colors.textPrimary,
  },
  aiText: { display: 'block', fontSize: '14px', color: THEME.colors.textPrimary },
  itemsList: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  movRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', borderRadius: THEME.radius.sm,
    background: 'rgba(255,255,255,0.05)',
  },
  movRowLeft: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  movDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  movRowDesc: {
    fontSize: '12px', color: THEME.colors.textPrimary,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  movRowMonto: { fontSize: '12px', fontWeight: 600, flexShrink: 0, marginLeft: '8px' },
  typingBubble: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '14px 18px', borderRadius: THEME.radius.lg,
    background: THEME.colors.card, border: `1px solid ${THEME.colors.cardBorder}`,
    width: 'fit-content',
  },
  typingDot: {
    display: 'inline-block', width: '7px', height: '7px',
    borderRadius: '50%', background: THEME.colors.textMuted,
  },
  // Input area — fixed
  inputBar: {
    position: 'fixed', left: '220px', right: 0, bottom: 0,
    padding: '12px 24px', background: THEME.colors.surface,
    borderTop: `1px solid ${THEME.colors.cardBorder}`, zIndex: 90,
    boxSizing: 'border-box',
  },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: THEME.colors.inputBg, border: `1px solid ${THEME.colors.inputBorder}`,
    borderRadius: THEME.radius.lg, padding: '5px 5px 5px 18px',
    maxWidth: '680px', margin: '0 auto',
  },
  input: {
    flex: 1, background: 'none', border: 'none', color: THEME.colors.textPrimary,
    fontSize: '13px', outline: 'none', fontFamily: THEME.font, minHeight: '36px',
  },
  sendBtn: {
    background: THEME.colors.accent, border: 'none', borderRadius: THEME.radius.sm,
    color: '#fff', padding: '10px 18px', fontSize: '12px', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '6px', fontFamily: THEME.font,
    transition: 'opacity 0.15s', flexShrink: 0,
  },
}
