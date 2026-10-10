import { html, raw, S, fm, fd, D, empty, actions, changes, options, accIcon, catById, ui, toast } from '../ui/kit.js';
import { prep, txMatches } from '../core/ledger.js';
import { TX_TYPES, TX_STATUS } from '../core/defaults.js';
import { txRow, txTitle } from '../ui/rows.js';
import { toCSV, download } from '../lib/csv.js';
import { parseMoney } from '../lib/money.js';
import { catLabel, accName } from '../ui/kit.js';

const F = { q: '', from: '', to: '', accountId: '', categoryId: '', type: '', status: '', min: '', max: '', sort: 'date_desc', page: 1 };
const PAGE = 50;
export const filtered = () => {
  const f = { ...F, min: F.min ? parseMoney(F.min) : null, max: F.max ? parseMoney(F.max) : null };
  if (Number.isNaN(f.min)) f.min = null; if (Number.isNaN(f.max)) f.max = null;
  const l = prep(S()).txs.filter((t) => txMatches(t, f));
  const [k, dir] = F.sort.split('_'), m = dir === 'asc' ? 1 : -1;
  return k === 'amount' ? [...l].sort((a, b) => (a.amount - b.amount) * m) : dir === 'desc' ? [...l].reverse() : l;
};
export function render(params) {
  if (params?.account !== undefined && params.account !== F._acc) { F.accountId = params.account; F._acc = params.account; F.page = 1; }
  const s = S(), list = filtered(), shown = list.slice(0, F.page * PAGE), total = list.reduce((a, t) => a + (t.status === 'anulado' ? 0 : TX_TYPES[t.type].sign * t.amount), 0);
  const ctl = (label, inner) => html`<div><label>${label}</label>${inner}</div>`;
  return html`<div class="top"><div class="title"><h1>Historial</h1><small>${list.length} movimiento(s) encontrados</small></div><div class="tools"><button class="btn" data-act="hist-csv">⬇ Exportar CSV</button><button class="btn" data-act="hist-clear">Limpiar filtros</button><button class="btn primary" data-act="tx-new">+ Nuevo</button></div></div>
  <div class="card" style="margin-bottom:14px"><div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
    ${ctl('Buscar', html`<input data-input="hist-f" data-key="q" data-f="q" type="search" placeholder="Descripción, persona, notas…" value="${F.q}">`)}
    ${ctl('Desde', html`<input type="date" data-change="hist-f" data-f="from" value="${F.from}">`)}${ctl('Hasta', html`<input type="date" data-change="hist-f" data-f="to" value="${F.to}">`)}
    ${ctl('Cuenta', html`<select data-change="hist-f" data-f="accountId">${options(s.accounts.map((a) => [a.id, `${accIcon(a)} ${a.name}`]), F.accountId, 'Todas')}</select>`)}
    ${ctl('Categoría', html`<select data-change="hist-f" data-f="categoryId">${options(s.categories.map((c) => [c.id, `${c.icon} ${c.name}`]), F.categoryId, 'Todas')}</select>`)}
    ${ctl('Tipo', html`<select data-change="hist-f" data-f="type">${options(Object.entries(TX_TYPES).map(([k, v]) => [k, v.short]), F.type, 'Todos')}</select>`)}
    ${ctl('Estado', html`<select data-change="hist-f" data-f="status">${options(Object.entries(TX_STATUS), F.status, 'Todos')}</select>`)}
    ${ctl('Importe mín.', html`<input data-input="hist-f" data-key="min" data-f="min" data-money inputmode="decimal" value="${F.min}" placeholder="0">`)}${ctl('Importe máx.', html`<input data-input="hist-f" data-key="max" data-f="max" data-money inputmode="decimal" value="${F.max}" placeholder="∞">`)}
    ${ctl('Ordenar', html`<select data-change="hist-f" data-f="sort">${options([['date_desc', 'Fecha: recientes primero'], ['date_asc', 'Fecha: antiguos primero'], ['amount_desc', 'Importe: mayor a menor'], ['amount_asc', 'Importe: menor a mayor']], F.sort)}</select>`)}
  </div></div>
  <div class="card">${shown.length ? html`<div class="list">${shown.map((t) => txRow(t))}</div>${shown.length < list.length ? html`<p style="text-align:center;margin-top:12px"><button class="btn" data-act="hist-more">Cargar más (${list.length - shown.length} restantes)</button></p>` : ''}` : empty('🔎', 'No hay movimientos con estos filtros.')}</div>`;
}
const set = (el) => { F[el.dataset.f] = el.value; F.page = 1; ui.render({ keepFocus: true }); };
changes['hist-f'] = set;
actions['hist-more'] = () => { F.page++; ui.render({ keepFocus: true }); };
actions['hist-clear'] = () => { Object.assign(F, { q: '', from: '', to: '', accountId: '', categoryId: '', type: '', status: '', min: '', max: '', sort: 'date_desc', page: 1 }); if (location.hash.includes('?')) { F._acc = undefined; location.hash = '#/historial'; } else ui.render(); };
actions['hist-csv'] = () => {
  const rows = [['Fecha', 'Hora', 'Tipo', 'Descripción', 'Importe', 'Cuenta', 'Cuenta destino', 'Categoría', 'Persona', 'Comisión', 'Intereses', 'Estado', 'Etiquetas', 'Notas']];
  for (const t of filtered()) rows.push([t.date, t.time, TX_TYPES[t.type].label, t.description, t.amount / 100, accName(t.accountId), t.toAccountId ? accName(t.toAccountId) : '', t.categoryId ? catLabel(t.categoryId, t.subId) : '', t.party, (t.fee || 0) / 100, (t.interest || 0) / 100, TX_STATUS[t.status], (t.tags || []).join(' '), t.notes]);
  download(`nexora-movimientos-${D.today()}.csv`, toCSV(rows, S().settings.csvSeparator)); toast('CSV exportado.', 'ok');
};
