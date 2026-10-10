import { COLLECTIONS } from '../data/db.js';
import { emptyState } from './engine.js';
import { DEFAULT_SETTINGS } from './defaults.js';
import { isCents } from './validate-lite.js';

export const FORMAT = 'nexora-backup';
export function toBackup(state) {
  const data = {};
  for (const c of COLLECTIONS) if (c !== 'meta') data[c] = state[c];
  return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), settings: state.settings, dayReviews: state.dayReviews, alertsSeen: state.alertsSeen, data };
}
// Valida una copia antes de reemplazar nada. Devuelve {state} o {error}.
export function fromBackup(json) {
  let b; try { b = typeof json === 'string' ? JSON.parse(json) : json; } catch { return { error: 'El archivo no es un JSON válido.' }; }
  if (!b || b.format !== FORMAT || !b.data) return { error: 'El archivo no es una copia de seguridad de NEXORA.' };
  const s = emptyState(); s.categories = [];
  for (const c of COLLECTIONS) if (c !== 'meta') {
    const arr = b.data[c]; if (arr === undefined) continue;
    if (!Array.isArray(arr)) return { error: `Datos dañados en "${c}".` };
    const ids = new Set();
    for (const r of arr) { if (!r || typeof r.id !== 'string' || ids.has(r.id)) return { error: `Registro inválido o duplicado en "${c}".` }; ids.add(r.id); }
    s[c] = arr;
  }
  for (const t of s.transactions) if (!isCents(t.amount) || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return { error: 'Hay movimientos con importes o fechas inválidos.' };
  s.settings = { ...DEFAULT_SETTINGS, ...(b.settings || {}), reminders: { ...DEFAULT_SETTINGS.reminders, ...(b.settings?.reminders || {}) } };
  s.dayReviews = b.dayReviews || {}; s.alertsSeen = b.alertsSeen || {};
  return { state: s };
}
