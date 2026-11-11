/** Presentation helpers. Dates arrive from the API as ISO-ish strings (no TZ games). */

const ACRONYMS = { id: 'ID', kva: 'kVA', kw: 'kW', kwh: 'kWh', inr: '₹', gst: 'GST', no: 'No.', wo: 'WO' };

export function humanize(key = '') {
  return String(key)
    .split('_')
    .filter(Boolean)
    .map((w, i) => ACRONYMS[w] || (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const KEEP_UPPER = new Set(['LED', 'CFL', 'LDR', 'NEFT', 'RTGS', 'UPI', 'IT', 'I', 'II', 'III', 'IV', 'OK']);
/** 'SOLAR_LED' -> 'Solar LED', 'CLASS_II' -> 'Class II', 'IN_PROGRESS' -> 'In progress' */
export function enumLabel(v) {
  if (v == null) return '';
  return String(v)
    .split('_')
    .map((w, i) => (KEEP_UPPER.has(w) ? w : i === 0 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ');
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const fmtINR = (v) => (v == null ? '—' : inr.format(v));
export const fmtNum = (v) => (v == null ? '—' : num.format(v));
export const fmtCompactINR = (v) =>
  v == null ? '—' : '₹' + new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
export function fmtDateTime(s) {
  if (!s) return '—';
  const t = String(s).slice(11, 16);
  return `${fmtDate(s)}${t ? `, ${t}` : ''}`;
}
export const fmtMonth = (ym) => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}` : '');

export function timeAgo(s) {
  if (!s) return '';
  const diff = (Date.now() - new Date(String(s).replace(' ', 'T')).getTime()) / 1000;
  if (diff < 60) return 'just now';
  const units = [[86400 * 30, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [sec, u] of units) if (diff >= sec) return `${Math.floor(diff / sec)}${u} ago`;
  return '';
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

/** Status -> semantic tone (status palette: always paired with a text label). */
const TONES = {
  good: ['FUNCTIONAL', 'OPERATIONAL', 'ACTIVE', 'COMPLETED', 'RESOLVED', 'CLOSED', 'OK', 'WITHIN BUDGET'],
  warning: ['UNDER_MAINTENANCE', 'MAINTENANCE', 'IN_PROGRESS', 'ASSIGNED', 'LOW', 'PENDING'],
  serious: ['OPEN', 'INACTIVE'],
  critical: ['FAULTY', 'FAULT', 'OFFLINE', 'OUT_OF_STOCK', 'OVER BUDGET', 'REJECTED', 'CANCELLED'],
};
export function toneOf(v) {
  const s = String(v ?? '').toUpperCase();
  for (const [tone, list] of Object.entries(TONES)) if (list.includes(s)) return tone;
  return 'neutral';
}

/** Generic cell formatter keyed on column name/type. */
export function formatCell(key, value, type) {
  if (value == null || value === '') return '—';
  if (value === 'Y' || value === 'N') return value === 'Y' ? 'Yes' : 'No';
  // identifiers & coordinates: never locale-format (10002 not "10,002"; keep 6dp)
  if (/(_id|_no|^log_number|^handled_by|^latitude|^longitude)$/.test(key)) return String(value);
  if (typeof value === 'string' && /^[A-Z]+(_[A-Z]+)*$/.test(value) && value.length > 1) return enumLabel(value);
  if (/(_inr|cost|amount|price|salary|budget|spent|payroll|variance|billed)/.test(key) && typeof value === 'number') return fmtINR(value);
  if (type === 'timestamp' || /_timestamp$|_time$|_at$/.test(key)) return fmtDateTime(value);
  if (type === 'date' || /_date$|^date_/.test(key)) return fmtDate(value);
  if (typeof value === 'number') return fmtNum(value);
  return String(value);
}
