export const APP_CONFIG = {
  name: 'Finanzas',
  locale: 'es-AR',
  currencies: {
    ARS: { symbol: '$', decimals: 2 },
    USD: { symbol: 'U$D', decimals: 2 },
  },
  defaultCurrency: 'ARS',
}

export function formatMoney(amount, moneda = 'ARS') {
  const { symbol, decimals } = APP_CONFIG.currencies[moneda]
  return `${symbol} ${Number(amount).toLocaleString(APP_CONFIG.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}
