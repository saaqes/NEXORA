// Estado de la app + persistencia. La UI solo habla con `store.run(...)`.
import * as DB from './db.js';
import { emptyState } from '../core/engine.js';
import { touch } from '../core/ledger.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../core/defaults.js';
import { toBackup, fromBackup } from '../core/backup.js';
import { buildDemo } from '../core/demo.js';
import { setCurrency } from '../lib/money.js';
import { setTimezone } from '../lib/dates.js';

export const store = { state: emptyState(), persistent: false, error: null, listeners: new Set() };
const notify = () => store.listeners.forEach((f) => f());
export const subscribe = (f) => (store.listeners.add(f), () => store.listeners.delete(f));
export function applySettings() {
  const s = store.state.settings; setCurrency(s.currency); setTimezone(s.timezone);
  document.documentElement.dataset.theme = s.theme === 'light' ? 'light' : 'dark';
}

export async function init() {
  const st = store.state;
  try {
    await DB.open();
    const d = await DB.loadAll();
    const meta = Object.fromEntries(d.meta.map((m) => [m.id, m.value]));
    if (!meta.initialized) {
      await DB.apply([...DEFAULT_CATEGORIES.map((c, i) => ['put', 'categories', { ...c, order: i }]), ['put', 'meta', { id: 'settings', value: DEFAULT_SETTINGS }], ['put', 'meta', { id: 'initialized', value: new Date().toISOString() }]]);
    } else {
      for (const k of ['accounts', 'transactions', 'pendings', 'debts', 'budgets', 'goals', 'recurrings']) st[k] = d[k];
      st.categories = d.categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      st.settings = { ...DEFAULT_SETTINGS, ...(meta.settings || {}), reminders: { ...DEFAULT_SETTINGS.reminders, ...(meta.settings?.reminders || {}) } };
      st.dayReviews = meta.dayReviews || {}; st.alertsSeen = meta.alertsSeen || {};
    }
    store.persistent = true;
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) { store.error = e.message; store.persistent = false; }
  touch(st); applySettings(); notify();
}

// Ejecuta una operación del motor y persiste sus cambios. Si falla el guardado, recarga desde disco.
export async function run(fn) {
  const res = fn(store.state);
  if (!res.ok) return res;
  try { if (store.persistent) await DB.apply(res.changes || []); }
  catch (e) { await reload(); return { ok: false, error: 'No se pudo guardar en el dispositivo: ' + e.message }; }
  if (res.changes?.some((c) => c[1] === 'meta' && c[2].id === 'settings')) applySettings();
  touch(store.state); notify();
  return res;
}
export async function reload() {
  const keep = store.state; store.state = emptyState();
  try { await init(); } catch { store.state = keep; }
}
export async function saveMeta(id, value) { if (store.persistent) await DB.apply([['put', 'meta', { id, value }]]); }
export const exportBackup = () => JSON.stringify(toBackup(store.state), null, 1);
export async function importBackup(json) {
  const r = fromBackup(json); if (r.error) return { ok: false, error: r.error };
  const d = {}; for (const k of ['accounts', 'categories', 'transactions', 'pendings', 'debts', 'budgets', 'goals', 'recurrings']) d[k] = r.state[k];
  d.meta = [{ id: 'settings', value: r.state.settings }, { id: 'dayReviews', value: r.state.dayReviews }, { id: 'alertsSeen', value: r.state.alertsSeen }, { id: 'initialized', value: new Date().toISOString() }];
  if (store.persistent) await DB.replaceAll(d);
  store.state = r.state; touch(store.state); applySettings(); notify();
  return { ok: true };
}
export async function loadDemo() {
  const st = store.state, snapshot = JSON.stringify(st, (k, v) => (k === '_c' ? undefined : v));
  try { const changes = buildDemo(st); if (store.persistent) await DB.apply(changes); touch(st); notify(); return { ok: true }; }
  catch (e) { store.state = Object.assign(emptyState(), JSON.parse(snapshot)); touch(store.state); notify(); return { ok: false, error: e.message }; }
}
export async function removeDemo() {
  const st = store.state, changes = [];
  const demoTx = new Set(st.transactions.filter((t) => t.demo).map((t) => t.id));
  for (const d of st.debts) if (demoTx.has(d.originTxId)) d.demo = true; // préstamos nacidos de movimientos de ejemplo
  for (const k of ['transactions', 'pendings', 'debts', 'budgets', 'goals', 'recurrings', 'accounts']) {
    for (const r of st[k].filter((x) => x.demo)) changes.push(['del', k, r.id]);
    st[k] = st[k].filter((x) => !x.demo);
  }
  if (store.persistent) await DB.apply(changes);
  touch(st); notify(); return { ok: true, count: changes.length };
}
export const hasDemo = () => ['accounts', 'transactions'].some((k) => store.state[k].some((x) => x.demo));
export async function eraseAll() {
  const st = emptyState();
  if (store.persistent) await DB.replaceAll({ categories: st.categories.map((c, i) => ({ ...c, order: i })), meta: [{ id: 'settings', value: st.settings }, { id: 'initialized', value: new Date().toISOString() }] });
  store.state = st; touch(st); applySettings(); notify();
}
