// Dinero = enteros en CENTAVOS (Number seguro). Nunca se usan decimales flotantes.
// Límite por importe: 1e13 centavos (100.000 millones de pesos) para que las sumas sean siempre exactas.
export const MAX_CENTS = 1e13;
let currency = 'COP';
export const setCurrency = (c) => { currency = c || 'COP'; fmtCache.clear(); };
const fmtCache = new Map();
function fmt(frac) {
  const k = currency + frac;
  if (!fmtCache.has(k)) {
    fmtCache.set(k, new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: frac, maximumFractionDigits: frac }));
  }
  return fmtCache.get(k);
}
export function formatMoney(cents, { sign = false } = {}) {
  const c = Math.round(Number(cents) || 0);
  const abs = Math.abs(c);
  const s = fmt(abs % 100 === 0 ? 0 : 2).format(abs / 100);
  if (c < 0) return '-' + s;
  return sign && c > 0 ? '+' + s : s;
}
export function formatCompact(cents) {
  const v = Math.abs(cents) / 100, s = cents < 0 ? '-' : '';
  if (v >= 1e9) return s + '$' + (v / 1e9).toFixed(1).replace('.0', '') + ' mil M';
  if (v >= 1e6) return s + '$' + (v / 1e6).toFixed(1).replace('.0', '') + ' M';
  if (v >= 1e3) return s + '$' + Math.round(v / 1e3) + ' k';
  return s + '$' + Math.round(v);
}
// Acepta "35.000", "35000", "1.250.000,50", "$ 35,000.50" (heurística es-CO). Devuelve centavos o NaN.
export function parseMoney(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : NaN;
  let s = String(input ?? '').replace(/[\s$]|COP/gi, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return NaN;
  const neg = s.startsWith('-'); if (neg) s = s.slice(1);
  const lastDot = s.lastIndexOf('.'), lastCom = s.lastIndexOf(',');
  let dec = '';
  if (lastDot >= 0 && lastCom >= 0) {
    const sep = lastDot > lastCom ? '.' : ',';
    const i = s.lastIndexOf(sep);
    dec = s.slice(i + 1); s = s.slice(0, i);
  } else if (lastCom >= 0 || lastDot >= 0) {
    const sep = lastCom >= 0 ? ',' : '.';
    const parts = s.split(sep);
    const last = parts[parts.length - 1];
    // un único separador con 1-2 dígitos finales = decimal; en otro caso = miles
    if (parts.length === 2 && last.length > 0 && last.length <= 2) { dec = last; s = parts[0]; }
  }
  const intPart = s.replace(/[.,]/g, '');
  if (!/^\d*$/.test(intPart) || !/^\d{0,2}$/.test(dec)) return NaN;
  if (!intPart && !dec) return NaN;
  const cents = Number(intPart || '0') * 100 + Number((dec + '00').slice(0, 2));
  return neg ? -cents : cents;
}
export const centsToInput = (c) => {
  const a = Math.abs(c), p = Math.floor(a / 100), d = a % 100;
  return String(p).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + String(d).padStart(2, '0') : '');
};
export const pct = (part, whole) => (whole > 0 ? Math.round((part * 100) / whole) : 0);
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
