import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { THEME } from '../config/theme'
import { formatMoney } from '../config/app.config'

const PALETTE = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6',
  '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#64748b',
]

function CustomTooltip({ active, payload, moneda }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div style={s.tooltip}>
      <span style={s.tooltipIcon}>{item.categoria_icono}</span>
      <span style={s.tooltipName}>{item.categoria_nombre}</span>
      <span style={s.tooltipMonto}>{formatMoney(item.total_egresos, moneda)}</span>
      <span style={s.tooltipPct}>{Number(item.porcentaje).toFixed(1)}%</span>
    </div>
  )
}

function CustomLegend({ payload }) {
  return (
    <ul style={s.legend}>
      {payload.map((entry, i) => (
        <li key={i} style={s.legendItem}>
          <span style={{ ...s.legendDot, background: entry.color }} />
          <span style={s.legendIcon}>{entry.payload.categoria_icono}</span>
          <span style={s.legendLabel}>{entry.payload.categoria_nombre}</span>
          <span style={s.legendPct}>{Number(entry.payload.porcentaje).toFixed(0)}%</span>
        </li>
      ))}
    </ul>
  )
}

export default function GraficoGastos({ datos = [], moneda = 'ARS' }) {
  if (!datos.length) {
    return (
      <div style={s.empty}>
        <span style={s.emptyIcon}>📊</span>
        <span style={s.emptyText}>Sin gastos en este período</span>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={datos}
            dataKey="total_egresos"
            nameKey="categoria_nombre"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {datos.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip moneda={moneda} />} />
        </PieChart>
      </ResponsiveContainer>
      <CustomLegend payload={datos.map((d, i) => ({
        color: PALETTE[i % PALETTE.length],
        payload: d,
      }))} />
    </div>
  )
}

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '40px 16px',
  },
  emptyIcon: {
    fontSize: '40px',
    lineHeight: 1,
    opacity: 0.4,
  },
  emptyText: {
    fontSize: '14px',
    color: THEME.colors.textMuted,
  },
  tooltip: {
    background: THEME.colors.surface,
    borderRadius: THEME.radius.sm,
    boxShadow: THEME.shadow.md,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: '140px',
  },
  tooltipIcon: {
    fontSize: '20px',
    lineHeight: 1,
  },
  tooltipName: {
    fontSize: '13px',
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  tooltipMonto: {
    fontSize: '14px',
    fontWeight: '700',
    color: THEME.colors.danger,
  },
  tooltipPct: {
    fontSize: '12px',
    color: THEME.colors.textSecondary,
  },
  legend: {
    listStyle: 'none',
    margin: 0,
    padding: '0 4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '9999px',
    flexShrink: 0,
  },
  legendIcon: {
    fontSize: '14px',
    lineHeight: 1,
  },
  legendLabel: {
    fontSize: '13px',
    color: THEME.colors.textPrimary,
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  legendPct: {
    fontSize: '12px',
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
}
