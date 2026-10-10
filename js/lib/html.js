// Plantillas HTML con escape automático (previene XSS con texto del usuario).
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s ?? ''));
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const one = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(one).join('') : v === false || v == null ? '' : esc(v));
export const html = (strings, ...vals) => new Safe(strings.reduce((a, s, i) => a + s + (i < vals.length ? one(vals[i]) : ''), ''));
export const str = (v) => one(v);
