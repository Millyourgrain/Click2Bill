/** Default payment terms: invoice date + this many calendar days */
export const INVOICE_NET_DAYS_DEFAULT = 30;

/**
 * @param {string} ymd - Invoice date YYYY-MM-DD
 * @param {number} days - Days to add
 * @returns {string} Due date YYYY-MM-DD or '' if invalid
 */
export function addCalendarDaysIso(ymd, days) {
  if (!ymd || typeof ymd !== 'string') return '';
  const base = ymd.slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().split('T')[0];
}

export function defaultDueDateFromInvoiceDate(ymd) {
  return addCalendarDaysIso(ymd, INVOICE_NET_DAYS_DEFAULT);
}
