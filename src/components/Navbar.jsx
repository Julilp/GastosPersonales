import { useState, useEffect } from 'react'
import { THEME } from '../config/theme'
import {
  MessageSquare,
  Home,
  List,
  Repeat2,
  Target,
} from 'lucide-react'

const TABS = [
  { key: 'chat',         label: 'Chat',   Icon: MessageSquare, path: '/' },
  { key: 'dashboard',    label: 'Inicio', Icon: Home,          path: '/dashboard' },
  { key: 'movimientos',  label: 'Movs',   Icon: List,          path: '/movimientos' },
  { key: 'fijos',        label: 'Fijos',  Icon: Repeat2,       path: '/fijos' },
  { key: 'presupuestos', label: 'Presup', Icon: Target,        path: '/presupuestos' },
]

export default function Navbar({ page, navigate }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 640)

  useEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <nav style={s.nav}>
      {TABS.map(tab => {
        const active = page === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={s.tab}
          >
            {active && <span style={s.tabActiveLine} />}
            <tab.Icon
              size={20}
              color={active ? THEME.colors.primary : THEME.colors.textMuted}
              strokeWidth={active ? 2.2 : 1.8}
            />
            {isDesktop && (
              <span style={{
                ...s.tabLabel,
                color: active ? THEME.colors.primary : THEME.colors.textMuted,
                fontWeight: active ? '600' : '400',
              }}>
                {tab.label}
              </span>
            )}
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
    background: THEME.colors.surface,
    borderTop: `1px solid ${THEME.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 100,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  tab: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 2px',
    position: 'relative',
    minWidth: '44px',
    transition: 'opacity 0.15s',
  },
  tabLabel: {
    fontSize: '10px',
    lineHeight: 1,
    letterSpacing: '0.01em',
  },
  tabActiveLine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: '2px',
    borderRadius: '0 0 2px 2px',
    background: THEME.colors.primary,
  },
}
