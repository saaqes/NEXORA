import * as D from '../lib/dates.js';
import { saveTransaction } from './engine.js';

export function advance(rec, from = rec.next) {
  switch (rec.frequency) {
    case 'daily': return D.addDays(from, 1);
    case 'weekly': return D.addDays(from, 7);
    case 'monthly': return D.addMonths(from, 1, Number(rec.start.slice(8)));
    case 'yearly': return D.addMonths(from, 12, Number(rec.start.slice(8)));
    default: return D.addDays(from, Math.max(1, rec.everyDays || 1));
  }
}
// Operaciones que ya tocan según la fecha: se PROPONEN, nunca se contabilizan solas.
export const dueRecurrences = (state, todayStr) => state.recurrings.filter((r) => r.active && r.next <= todayStr).sort((a, b) => a.next.localeCompare(b.next));
export const upcomingRecurrences = (state, todayStr, days) => state.recurrings.filter((r) => r.active && r.next > todayStr && r.next <= D.addDays(todayStr, days));

export function confirmRecurrence(state, id, overrides = {}, opts = {}) {
  const r = state.recurrings.find((x) => x.id === id);
  if (!r) return { ok: false, error: 'La operación recurrente no existe.' };
  const res = saveTransaction(state, {
    type: r.type, amount: r.amount, date: r.next, accountId: r.accountId, toAccountId: r.toAccountId || null, categoryId: r.categoryId || null,
    subId: r.subId || null, description: r.title, party: r.party || '', debtId: r.debtId || null, recurringId: r.id, ...overrides,
  }, opts);
  if (!res.ok) return res;
  const next = { ...r, next: advance(r), lastDone: r.next };
  state.recurrings[state.recurrings.indexOf(r)] = next;
  return { ...res, changes: [...res.changes, ['put', 'recurrings', next]] };
}
export function skipRecurrence(state, id) {
  const r = state.recurrings.find((x) => x.id === id);
  if (!r) return { ok: false, error: 'La operación recurrente no existe.' };
  const next = { ...r, next: advance(r) };
  state.recurrings[state.recurrings.indexOf(r)] = next;
  return { ok: true, changes: [['put', 'recurrings', next]] };
}
