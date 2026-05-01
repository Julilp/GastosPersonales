import { formatMoney } from '../config/app.config'
import { THEME } from '../config/theme'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'

const TIPO_STYLES = {
  ingreso: {
    color: THEME.colors.success,
    bg: THEME.colors.successBg,
    Icon: TrendingUp,
  },
  egreso: {
    color: THEME.colors.danger,
    bg: THEME.colors.errorBg,
    Icon: TrendingDown,
  },
  balance: {
    color: THEME.colors.primary,
    bg: THEME.colors.primaryLight,
    Icon: Wallet,
  },
}

export default function TarjetaResumen({ label, valor, moneda = 'ARS', tipo = 'balance' }) {
  const estilo = TIPO_STYLES[tipo] ?? TIPO_STYLES.balance
  const valorNum = Number(valor ?? 0)
  const colorValor = tipo === 'balance' && valorNum < 0 ? THEME.colors.danger : estilo.color
  const { Icon } = estilo

  return (
    <div style={s.card}>
      <div style={{ ...s.iconWrap, background: estilo.bg }}>
        <Icon size={18} color={estilo.color} strokeWidth={2} />
      </div>
      <span style={s.label}>{label}</span>
      <span style={{ ...s.valor, color: colorValor }}>
        {formatMoney(valorNum, moneda)}
      </span>
    </div>
  )
}

const s = {
  card: {
    background: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    boxShadow: THEME.shadow.sm,
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    minWidth: 0,
    border: `1px solid ${THEME.colors.border}`,
  },
  iconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: THEME.radius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontSize: '11px',
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  valor: {
    fontSize: '16px',
    fontWeight: '700',
    lineHeight: 1,
    letterSpacing: '-0.3px',
  },
}
