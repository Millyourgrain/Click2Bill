export const DEFAULT_INVOICE_CURRENCY = 'CAD';

/** ISO 4217 codes — multi-currency platform. */
export const INVOICE_CURRENCY_OPTIONS = [
  { code: 'CAD', label: 'CAD — Canadian dollar' },
  { code: 'USD', label: 'USD — US dollar' },
  { code: 'GBP', label: 'GBP — British pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'CNY', label: 'CNY — Chinese yuan' },
  { code: 'INR', label: 'INR — Indian rupee' },
];

export function isCadCurrency(currencyCode) {
  return (currencyCode || DEFAULT_INVOICE_CURRENCY) === 'CAD';
}

/**
 * CRA-facing label for the sales tax line (HST / GST / QST) so buyers can support ITC claims.
 * Combined-rate provinces → HST; 5% → GST; Québec combined QST ≈ 9.975%.
 */
export function formatCadSalesTaxLabel(taxRate) {
  const r = Number(taxRate);
  if (!Number.isFinite(r) || r < 0) return 'HST/GST';
  if (r === 0) return 'HST/GST (0%)';
  if (Math.abs(r - 5) < 0.05) return `GST (${r}%)`;
  if (Math.abs(r - 9.975) < 0.05) return `QST (${r}%)`;
  if (r > 5 && r <= 15) return `HST (${r}%)`;
  return `HST/GST (${r}%)`;
}

/** Sum invoice totals grouped by currency code. */
export function totalsByCurrency(invoices) {
  const map = {};
  for (const inv of invoices || []) {
    const c = inv.currency || DEFAULT_INVOICE_CURRENCY;
    map[c] = (map[c] || 0) + (Number(inv.total) || 0);
  }
  return map;
}

export function formatInvoiceMoney(amount, currencyCode = DEFAULT_INVOICE_CURRENCY) {
  const code = currencyCode || DEFAULT_INVOICE_CURRENCY;
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: code }).format(Number(amount) || 0);
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

/** Human-readable multi-currency breakdown, e.g. for dashboard cards. */
export function formatTotalsByCurrencyLines(totalsMap) {
  const entries = Object.entries(totalsMap || {}).filter(([, v]) => Math.abs(Number(v) || 0) > 0.0001);
  if (!entries.length) return '';
  return entries.map(([code, amt]) => formatInvoiceMoney(amt, code)).join(' · ');
}
