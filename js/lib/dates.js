// Fechas como cadenas 'YYYY-MM-DD' / 'HH:mm' calculadas en la zona horaria configurada (America/Bogota).
let TZ = 'America/Bogota';
export const setTimezone = (tz) => { TZ = tz || 'America/Bogota'; };
export const getTimezone = () => TZ;
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function nowParts(now = new Date(), tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, dow: DOW[p.weekday] };
}
export const today = (now) => nowParts(now).date;
export const nowTime = (now) => nowParts(now).time;
const utc = (s) => new Date(s + 'T00:00:00Z');
const str = (d) => d.toISOString().slice(0, 10);
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && str(utc(s)) === s;
export const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const addDays = (s, n) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return str(d); };
export const diffDays = (a, b) => Math.round((utc(a) - utc(b)) / 864e5);
export const dow = (s) => utc(s).getUTCDay();
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12
export function addMonths(s, n, anchorDay) {
  const [y, m, d] = s.split('-').map(Number);
  const t = (m - 1) + n, yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12 + 1;
  const day = Math.min(anchorDay || d, daysInMonth(yy, mm));
  return `${yy}-${String(mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export const startOfWeek = (s, weekStart = 1) => addDays(s, -((dow(s) - weekStart + 7) % 7));
export const monthStart = (s) => s.slice(0, 7) + '-01';
export const monthEnd = (s) => { const [y, m] = s.split('-').map(Number); return `${s.slice(0, 7)}-${daysInMonth(y, m)}`; };
export const yearStart = (s) => s.slice(0, 4) + '-01-01';
export const yearEnd = (s) => s.slice(0, 4) + '-12-31';
// Rango de un periodo: day | week | month | year | custom
export function periodRange(kind, anchor, weekStart = 1) {
  if (kind === 'day') return { from: anchor, to: anchor };
  if (kind === 'week') { const f = startOfWeek(anchor, weekStart); return { from: f, to: addDays(f, 6) }; }
  if (kind === 'month') return { from: monthStart(anchor), to: monthEnd(anchor) };
  if (kind === 'year') return { from: yearStart(anchor), to: yearEnd(anchor) };
  return { from: anchor, to: anchor };
}
export function prevRange(kind, anchor, weekStart = 1) {
  if (kind === 'day') return periodRange('day', addDays(anchor, -1));
  if (kind === 'week') return periodRange('week', addDays(anchor, -7), weekStart);
  if (kind === 'month') return periodRange('month', addMonths(monthStart(anchor), -1));
  return periodRange('year', `${Number(anchor.slice(0, 4)) - 1}-01-01`);
}
export function shiftAnchor(kind, anchor, n) {
  if (kind === 'day') return addDays(anchor, n);
  if (kind === 'week') return addDays(anchor, 7 * n);
  if (kind === 'month') return addMonths(monthStart(anchor), n);
  return `${Number(anchor.slice(0, 4)) + n}-01-01`;
}
export const eachDay = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const WD_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export function formatDate(s, fmt = 'dd/mm/yyyy') {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  if (fmt === 'yyyy-mm-dd') return s;
  if (fmt === 'long') return `${Number(d)} de ${MONTHS[Number(m) - 1]} de ${y}`;
  return `${d}/${m}/${y}`;
}
export const formatDateLong = (s) => `${WEEKDAYS[dow(s)]} ${Number(s.slice(8))} de ${MONTHS[Number(s.slice(5, 7)) - 1]} de ${s.slice(0, 4)}`;
export const monthLabel = (s) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
export const sortKey = (t) => `${t.date} ${t.time || '00:00'} ${t.createdAt || ''}`;
