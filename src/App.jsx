import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { initCuentasDefault } from './lib/finanzas'
import { THEME } from './config/theme'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Dashboard from './pages/Dashboard'
import Movimientos from './pages/Movimientos'
import Categorias from './pages/Categorias'
import Presupuestos from './pages/Presupuestos'
import Fijos from './pages/Fijos'
import Navbar from './components/Navbar'

const ROUTES = {
  '/': 'chat',
  '/dashboard': 'dashboard',
  '/movimientos': 'movimientos',
  '/categorias': 'categorias',
  '/presupuestos': 'presupuestos',
  '/fijos': 'fijos',
}

function getPage() {
  return ROUTES[window.location.pathname] ?? 'dashboard'
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [page, setPage] = useState(getPage())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) handleFirstLogin(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) handleFirstLogin(s)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleFirstLogin(s) {
    const key = `init_done_${s.user.id}`
    if (localStorage.getItem(key)) return
    try {
      await initCuentasDefault()
      localStorage.setItem(key, '1')
    } catch (_) {}
  }

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPage(ROUTES[path] ?? 'dashboard')
  }

  useEffect(() => {
    const handler = () => setPage(getPage())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  if (session === undefined) return <div style={s.loading}>Cargando...</div>
  if (!session) return <Login />

  return (
    <div style={s.root}>
      <div style={s.content}>
        {page === 'chat'         && <Chat />}
        {page === 'dashboard'    && <Dashboard />}
        {page === 'movimientos'  && <Movimientos />}
        {page === 'fijos'        && <Fijos />}
        {page === 'presupuestos' && <Presupuestos />}
        {page === 'categorias'   && <Categorias />}
      </div>
      <Navbar page={page} navigate={navigate} />
    </div>
  )
}

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100svh',
    background: THEME.colors.bg,
  },
  content: {
    flex: 1,
    paddingBottom: '80px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100svh',
    color: THEME.colors.textSecondary,
    fontSize: '14px',
  },
}
