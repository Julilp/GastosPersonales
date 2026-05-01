import { THEME } from '../config/theme'
import { MessageSquare, Home, List, Repeat2, Target, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const ITEMS = [
  { id: 'chat',          label: 'Chat',        Icon: MessageSquare, path: '/' },
  { id: 'dashboard',    label: 'Inicio',       Icon: Home,          path: '/dashboard' },
  { id: 'movimientos',  label: 'Movimientos',  Icon: List,          path: '/movimientos' },
  { id: 'fijos',        label: 'Fijos',        Icon: Repeat2,       path: '/fijos' },
  { id: 'presupuestos', label: 'Presupuestos', Icon: Target,        path: '/presupuestos' },
]

export default function Sidebar({ page, navigate }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <aside style={s.aside}>
      {/* Logo */}
      <div style={s.logo}>
        <div style={s.logoIcon}>G</div>
        <span style={s.logoText}>Gastos</span>
      </div>

      {/* Nav items */}
      <nav style={s.nav}>
        {ITEMS.map(({ id, label, Icon, path }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => navigate(path)}
              style={{
                ...s.item,
                background: active ? THEME.colors.accentSoft : 'transparent',
                color: active ? THEME.colors.accent : THEME.colors.textMuted,
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Logout */}
      <button onClick={handleLogout} style={s.logout}>
        <LogOut size={15} strokeWidth={1.8} />
        Cerrar sesión
      </button>
    </aside>
  )
}

const s = {
  aside: {
    width: '220px',
    minWidth: '220px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: THEME.colors.sidebar,
    borderRight: `1px solid ${THEME.colors.sidebarBorder}`,
    padding: '24px 12px',
    fontFamily: THEME.font,
    gap: '2px',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 12px 24px',
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: `linear-gradient(135deg, ${THEME.colors.accent}, ${THEME.colors.success})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '14px',
    color: '#fff',
    fontFamily: THEME.font,
  },
  logoText: {
    fontSize: '15px',
    fontWeight: 700,
    color: THEME.colors.textPrimary,
    letterSpacing: '-0.3px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    border: 'none',
    borderRadius: THEME.radius.sm,
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: THEME.font,
    transition: 'all 0.15s',
    textAlign: 'left',
    width: '100%',
  },
  logout: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    border: 'none',
    borderRadius: THEME.radius.sm,
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: THEME.font,
    background: 'transparent',
    color: THEME.colors.textMuted,
    width: '100%',
    transition: 'color 0.15s',
  },
}
