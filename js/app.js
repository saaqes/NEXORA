// NEXORA — arranque, enrutador y estructura general.
import { html, raw, str, esc, S, D, actions, changes, icon, toast, modal, closeTop, hasModal, fdata, reviewChip, centsToInput, parseMoney, catById, confirmBox, ui } from './ui/kit.js';
import { store, init, subscribe, run, loadDemo } from './data/store.js';
import { horizontal, mark } from './ui/logo.js';
import { saveSettings } from './core/engine.js';
import { reviewStatus } from './core/ledger.js';
import { openTxForm } from './ui/txform.js';
import { startReminders } from './reminders.js';
import { announceBudgets } from './alerts.js';
import * as dashboard from './views/dashboard.js';
import * as cuentas from './views/cuentas.js';
import * as calendario from './views/calendario.js';
import * as pendientes from './views/pendientes.js';
import * as deudas from './views/deudas.js';
import * as presupuestos from './views/presupuestos.js';
import * as informes from './views/informes.js';
import * as ahorros from './views/ahorros.js';
import * as recurrentes from './views/recurrentes.js';
import * as historial from './views/historial.js';
import * as configuracion from './views/configuracion.js';

const NAV = [
  ['inicio', 'Inicio', 'home', dashboard], ['cuentas', 'Mis cuentas', 'wallet', cuentas], ['calendario', 'Calendario', 'cal', calendario], ['pendientes', 'Pendientes', 'clock', pendientes],
  ['deudas', 'Préstamos y deudas', 'hand', deudas], ['presupuestos', 'Presupuestos', 'target', presupuestos], ['informes', 'Informes', 'chart', informes], ['ahorros', 'Ahorros', 'piggy', ahorros],
  ['recurrentes', 'Recurrentes', 'repeat', recurrentes], ['historial', 'Historial', 'list', historial], ['configuracion', 'Configuración', 'gear', configuracion],
];
const route = () => { const [p, q = ''] = (location.hash.slice(2) || 'inicio').split('?'); return { name: NAV.some((n) => n[0] === p) ? p : 'inicio', params: Object.fromEntries(new URLSearchParams(q)) }; };
const root = document.getElementById('root');
const welcomed = () => { try { return localStorage.getItem('nexora.welcomed') === '1'; } catch { return true; } };

function shell() {
  const s = S().settings;
  root.innerHTML = str(html`<div class="app"><aside class="side"><div class="logo">${raw(horizontal({ dark: s.theme !== 'light', slogan: true, id: 'nxs' }))}</div>
    <nav class="nav" aria-label="Principal">${NAV.map(([k, l, ic]) => html`<a href="#/${k}" data-nav="${k}">${icon(ic)}<span>${l}</span></a>`)}</nav>
    <div class="foot"><button class="btn sm" data-act="theme">${icon(s.theme === 'light' ? 'moon' : 'sun')} Tema ${s.theme === 'light' ? 'oscuro' : 'claro'}</button><p style="margin-top:10px">${store.persistent ? '🔒 Datos guardados en este dispositivo' : '⚠️ Datos temporales (sin almacenamiento)'}</p></div></aside>
    <div><div class="mobilebar"><div style="width:140px">${raw(horizontal({ dark: s.theme !== 'light', slogan: false, id: 'nxm' }))}</div><button class="btn ghost sm" data-act="theme" aria-label="Cambiar tema">${icon(s.theme === 'light' ? 'moon' : 'sun')}</button></div>
    <main id="view" tabindex="-1"></main></div></div>
    <nav class="bnav" aria-label="Móvil"><a href="#/inicio" data-nav="inicio">${icon('home')}Inicio</a><a href="#/calendario" data-nav="calendario">${icon('cal')}Día</a><a href="#/historial" data-nav="historial">${icon('list')}Historial</a><a href="#/informes" data-nav="informes">${icon('chart')}Informes</a><button data-act="more">${icon('menu')}Más</button></nav>
    <button class="fab" data-act="tx-new" aria-label="Nuevo movimiento" title="Nuevo movimiento">+</button>`);
}
let rendering = false;
ui.render = (o) => render(o);
export function render({ keepFocus = false } = {}) {
  if (rendering) return; rendering = true;
  try {
    if (!store.ready) return;
    if (!welcomed() && !S().accounts.length && !S().transactions.length) return welcome();
    if (!document.getElementById('view')) shell();
    const { name, params } = route(), v = NAV.find((n) => n[0] === name), el = document.getElementById('view');
    const f = keepFocus ? document.activeElement : null, fk = f && (f.dataset?.key || f.id || f.name), sel = f?.selectionStart, sy = scrollY;
    el.innerHTML = str(v[3].render(params));
    document.title = `${v[1]} · NEXORA`;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
    v[3].mount?.(el, params);
    if (fk) { const n = el.querySelector(`[data-key="${CSS.escape(fk)}"],#${CSS.escape(fk)}`); if (n) { n.focus(); try { n.setSelectionRange(sel, sel); } catch { /* no aplica */ } } }
    if (keepFocus) scrollTo(0, sy);
  } finally { rendering = false; }
}
function welcome() {
  const s = S().settings;
  root.innerHTML = str(html`<div class="welcome"><div class="box">${raw(horizontal({ dark: s.theme !== 'light', id: 'nxw' }).replace('<svg ', '<svg class="lg" '))}
    <h1>Bienvenido a NEXORA</h1><p class="muted" style="margin:10px 0 20px">Registra ingresos, gastos, cuentas, deudas y ahorros. Todo se calcula solo y se guarda en <b>este dispositivo</b>. No pedimos contraseñas ni datos bancarios.</p>
    <div class="col"><button class="btn primary" data-act="welcome-start">Empezar con mis propios datos</button><button class="btn" data-act="welcome-demo">Explorar con datos de ejemplo</button><label class="btn" style="cursor:pointer">Importar una copia de seguridad<input type="file" accept=".json,application/json" data-change="import-file" class="sr"></label></div>
    <p class="small muted" style="margin-top:18px">${store.persistent ? '🔒 Almacenamiento local activo (IndexedDB).' : '⚠️ No se pudo activar el almacenamiento local: ' + (store.error || '') + '. Tus datos serán temporales.'}</p></div></div>`);
}

// ---------- eventos globales ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (fn) { if (el.tagName === 'A' && !el.getAttribute('href')?.startsWith('#')) return; e.preventDefault?.(); fn(el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('[data-catsel]')) { const g = el.closest('[data-g]') || el.closest('form'); const sub = g.querySelector('select[name=subId]'); const c = catById(el.value); sub.innerHTML = '<option value="">—</option>' + (c?.subs || []).map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''); }
  const n = el.closest('[data-change]')?.dataset.change; if (n && changes[n]) changes[n](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('[data-money]')) { // miles con punto mientras escribes (es-CO)
    const v = el.value; if (/[,]/.test(v)) { el.value = v.replace(/[^\d,]/g, ''); return; }
    const d = v.replace(/\D/g, ''); el.value = d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  const n = el.closest('[data-input]')?.dataset.input; if (n && changes[n]) changes[n](el, e);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hasModal()) closeTop(); });
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); document.getElementById('view')?.focus({ preventScroll: true }); });

actions.theme = async () => { const r = await run((s) => saveSettings(s, { theme: S().settings.theme === 'light' ? 'dark' : 'light' })); if (r.ok) { shell(); render(); } };
actions.more = () => {
  const m = modal({ title: 'Menú', body: html`<div class="col">${NAV.map(([k, l, ic]) => html`<a class="btn" href="#/${k}" data-close style="justify-content:flex-start">${icon(ic)} ${l}</a>`)}</div>` });
  m.el.addEventListener('click', (e) => e.target.closest('a')?.click && setTimeout(() => m.close(), 0));
};
actions['welcome-start'] = () => { localStorage.setItem('nexora.welcomed', '1'); shell(); location.hash = '#/cuentas'; render(); toast('Crea tu primera cuenta para empezar.'); };
actions['welcome-demo'] = async () => { localStorage.setItem('nexora.welcomed', '1'); const r = await loadDemo(); if (r.ok) { shell(); location.hash = '#/inicio'; render(); toast('Datos de ejemplo cargados. Puedes eliminarlos en Configuración.', 'warn', 6000); } else toast(r.error, 'bad'); };
changes['import-file'] = async (el) => {
  const f = el.files[0]; if (!f) return;
  const { importBackup } = await import('./data/store.js');
  const r = await importBackup(await f.text());
  if (r.ok) { localStorage.setItem('nexora.welcomed', '1'); shell(); render(); toast('Copia restaurada.', 'ok'); } else toast(r.error, 'bad', 6000);
};

// ---------- arranque ----------
let t;
subscribe(() => { cancelAnimationFrame(t); t = requestAnimationFrame(() => { if (document.getElementById('view')) { const th = document.documentElement.dataset.theme; render({ keepFocus: true }); } else render(); }); });
(async () => {
  await init(); store.ready = true;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  render(); startReminders(); setTimeout(announceBudgets, 800);
})();
window.NEXORA = { store }; // útil para depuración y pruebas E2E
