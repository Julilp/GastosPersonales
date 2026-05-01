import { THEME } from '../config/theme'
import { MessageSquare, Home, List, Repeat2, Target } from 'lucide-react'

const ITEMS = [
  { id: 'chat',          label: 'Chat',        Icon: MessageSquare, path: '/' },
  { id: 'dashboard',    label: 'Inicio',       Icon: Home,          path: '/dashboard' },
  { id: 'movimientos',  label: 'Movimientos',  Icon: List,          path: '/movimientos' },
  { id: 'fijos',        label: 'Fijos',        Icon: Repeat2,       path: '/fijos' },
  { id: 'presupuestos', label: 'Presupuestos', Icon: Target,        path: '/presupuestos' },
]

export default function BottomNav({ page, navigate }) {
  return (
    <nav style={s.nav}>
      {ITEMS.map(({ id, label, Icon, path }) => {
        const active = page === id
        return (
          <button
            key={id}
            onClick={() => navigate(path)}
            style={{
              ...s.item,
              color: active ? THEME.colors.accent : THEME.colors.textMuted,
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            <span style={{ 
              ...s.label,
              color: active ? THEME.colors.accent : THEME.colors.textMuted,
              fontWeight: active ? 600 : 400
            }}>
              {label === 'Presupuestos' ? 'Presup.' : label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

const s = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'rgba(15, 18, 25, 0.95)',
    backdropFilter: 'blur(10px)',
    borderTop: `1px solid ${THEME.colors.sidebarBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 8px',
    zIndex: 1000,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    padding: '8px 0',
  },
  label: {
    fontSize: '10px',
    fontFamily: THEME.font,
  }
}
