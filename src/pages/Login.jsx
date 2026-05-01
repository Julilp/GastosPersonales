import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { APP_CONFIG } from '../config/app.config'
import { THEME } from '../config/theme'

export default function Login() {
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function switchModo(m) {
    setModo(m)
    setError('')
    setSuccess('')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (modo === 'register' && password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    if (modo === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) {
        setError(err.message)
      } else {
        setSuccess('Cuenta creada. Revisá tu email para confirmar.')
      }
    }

    setLoading(false)
  }

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>💰</div>
        <h1 style={s.title}>{APP_CONFIG.name}</h1>

        <div style={s.tabs}>
          <button
            type="button"
            onClick={() => switchModo('login')}
            style={{ ...s.tab, ...(modo === 'login' ? s.tabActive : {}) }}
          >
            Ingresar
          </button>
          <button
            type="button"
            onClick={() => switchModo('register')}
            style={{ ...s.tab, ...(modo === 'register' ? s.tabActive : {}) }}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={s.input}
            />
          </div>

          {modo === 'register' && (
            <div style={s.field}>
              <label style={s.label}>Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={s.input}
              />
            </div>
          )}

          {error && <div style={s.error}>{error}</div>}
          {success && <div style={s.successBox}>{success}</div>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading
              ? modo === 'login' ? 'Ingresando...' : 'Creando cuenta...'
              : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100svh',
    background: THEME.colors.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    background: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    boxShadow: THEME.shadow.lg,
    padding: '40px 24px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logo: {
    fontSize: '48px',
    marginBottom: '12px',
    lineHeight: 1,
  },
  title: {
    margin: '0 0 24px 0',
    fontSize: '28px',
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: '-0.5px',
  },
  tabs: {
    display: 'flex',
    width: '100%',
    borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`,
    overflow: 'hidden',
    marginBottom: '24px',
  },
  tab: {
    flex: 1,
    height: '44px',
    border: 'none',
    background: THEME.colors.bg,
    color: THEME.colors.textSecondary,
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: THEME.colors.primary,
    color: '#fff',
    fontWeight: '600',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
  error: {
    background: THEME.colors.errorBg,
    color: THEME.colors.danger,
    borderRadius: THEME.radius.sm,
    padding: '10px 14px',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  successBox: {
    background: THEME.colors.successBg,
    color: THEME.colors.success,
    borderRadius: THEME.radius.sm,
    padding: '10px 14px',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  btn: {
    height: '52px',
    background: THEME.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: THEME.radius.md,
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
  },
}
