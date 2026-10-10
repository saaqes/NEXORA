// Utilidades de interfaz compartidas: modales, avisos, formularios, iconos y formato.
import { html, raw, esc, str } from '../lib/html.js';
import { formatMoney, centsToInput, parseMoney } from '../lib/money.js';
import * as D from '../lib/dates.js';
import { store } from '../data/store.js';
import { ACCOUNT_TYPES } from '../core/defaults.js';

export const S = () => store.state;
export const fm = formatMoney;
export const fd = (d) => D.formatDate(d, S().settings.dateFormat);
export const actions = {}, forms = {};
export { html, raw, esc, str, D, parseMoney, centsToInput };

const P = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', wallet: 'M3 7a2 2 0 0 1 2-2h14v4M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14h2',
  cal: 'M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 9h16M8 2v4M16 2v4', clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  hand: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z', target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', piggy: 'M5 11a7 6 0 0 1 12-3l3-1v4l-1 1v3l-3 1v2h-3v-2H9v2H6v-3a6 6 0 0 1-1-3zM15 11h.01', repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14', sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4', moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  menu: 'M4 6h16M4 12h16M4 18h16', x: 'M6 6l12 12M18 6L6 18', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8zM13.7 20a2 2 0 0 1-3.4 0',
};
export const icon = (n) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`);

// ---------- avisos y modales ----------
export function toast(msg, kind = '', ms = 3800) {
  const el = Object.assign(document.createElement('div'), { className: 'toast ' + kind, textContent: msg });
  document.getElementById('toasts').append(el); setTimeout(() => el.remove(), ms);
}
const modals = [];
export function modal({ title, body, footer = '', wide = false, dismiss = true, onMount }) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = str(html`<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}"><header><h2>${title}</h2><button class="btn ghost sm" data-close aria-label="Cerrar">${icon('x')}</button></header><div class="body">${body}</div>${footer ? html`<footer>${footer}</footer>` : ''}</div>`);
  const prevFocus = document.activeElement;
  const m = { el: ov, close() { ov.remove(); modals.splice(modals.indexOf(m), 1); prevFocus?.focus?.(); }, $: (s) => ov.querySelector(s) };
  ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || (dismiss && e.target === ov)) m.close(); });
  document.body.append(ov); modals.push(m);
  ov.querySelector('input:not([type=hidden]),select,textarea')?.focus({ preventScroll: true });
  onMount?.(m);
  return m;
}
export const closeTop = () => modals.at(-1)?.close();
export const hasModal = () => modals.length > 0;
export function confirmBox({ title = 'Confirmar', message, ok = 'Confirmar', danger = false }) {
  return new Promise((res) => {
    const m = modal({ title, body: html`<p>${message}</p>`, dismiss: false, footer: html`<button class="btn" data-no>Cancelar</button><button class="btn ${danger ? 'neg' : 'primary'}" data-yes>${ok}</button>` });
    m.el.querySelector('[data-yes]').onclick = () => { m.close(); res(true); };
    m.el.querySelector('[data-no]').onclick = () => { m.close(); res(false); };
    m.el.querySelector('[data-close]').addEventListener('click', () => res(false));
  });
}

// ---------- datos de apoyo ----------
export const accById = (id) => S().accounts.find((a) => a.id === id);
export const catById = (id) => S().categories.find((c) => c.id === id);
export const accName = (id) => accById(id)?.name || '—';
export const catLabel = (catId, subId) => { const c = catById(catId); if (!c) return catId ? 'Categoría eliminada' : 'Sin categoría'; const s = c.subs.find((x) => x.id === subId); return s ? `${c.name} · ${s.name}` : c.name; };
export const catColor = (id) => catById(id)?.color || '#94a3b8';
export const accIcon = (a) => a.icon || ACCOUNT_TYPES[a.type]?.icon || '👛';
export const options = (list, sel, ph) => html`${ph != null ? html`<option value="">${ph}</option>` : ''}${list.map(([v, l]) => html`<option value="${v}" ${v === sel ? raw('selected') : ''}>${l}</option>`)}`;
export function accountSelect(name, selected, { exclude, noCredit = false, ph, includeArchivedId } = {}) {
  const list = S().accounts.filter((a) => (!a.archived || a.id === includeArchivedId || a.id === selected) && a.id !== exclude && !(noCredit && a.type === 'credit'));
  return html`<select name="${name}" data-name="${name}">${options(list.map((a) => [a.id, `${accIcon(a)} ${a.name}`]), selected, ph)}</select>`;
}
export function catFields(kind, catId, subId, required = false) {
  const cats = S().categories.filter((c) => (kind === 'income' ? c.kind === 'income' : c.kind !== 'income'));
  const c = catById(catId);
  return html`<div class="field"><label>Categoría</label><select name="categoryId" data-catsel>${options(cats.map((x) => [x.id, `${x.icon} ${x.name}`]), catId, required ? 'Selecciona…' : 'Sin categoría')}</select></div>
  <div class="field"><label>Subcategoría <span class="muted">(opcional)</span></label><select name="subId">${options((c?.subs || []).map((s) => [s.id, s.name]), subId, '—')}</select></div>`;
}
export const money = (name, value, extra = '') => html`<input name="${name}" data-money inputmode="decimal" autocomplete="off" placeholder="0" value="${value ? centsToInput(value) : ''}" ${raw(extra)}>`;
export function fdata(form) {
  const o = {}; for (const [k, v] of new FormData(form)) o[k] = v;
  form.querySelectorAll('input[type=checkbox]').forEach((c) => { o[c.name] = c.checked; });
  return o;
}
export const cents = (v) => { if (v === '' || v == null) return 0; const n = parseMoney(v); return n; };
export const statusChip = (s) => ({ pending: ['Pendiente', 'mute'], partial: ['Parcial', 'warn'], paid: ['Pagado', 'pos'], overdue: ['Vencido', 'neg'], cancelled: ['Cancelado', 'mute'], open: ['Vigente', 'info'], closed: ['Saldada', 'pos'] }[s] || [s, 'mute']);
export const signed = (n) => html`<span class="num ${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${fm(n, { sign: true })}</span>`;
export const field = (label, inner, cls = '') => html`<div class="field ${cls}"><label>${label}</label>${inner}</div>`;
export const empty = (icon, text, cta = '') => html`<div class="empty"><div class="big">${icon}</div><p>${text}</p>${cta}</div>`;
export const changes = {};
export const REVIEW = { pending: ['Pendiente de revisar', 'mute'], progress: ['Registro en progreso', 'warn'], reviewed: ['Día revisado', 'pos'] };
export const reviewChip = (st) => html`<span class="chip ${REVIEW[st][1]}">${REVIEW[st][0]}</span>`;
export const ui = { render: () => {} };
