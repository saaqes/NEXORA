// Reglas de negocio y validación de NEXORA. Muta el estado en memoria y devuelve `changes`
// ([['put', coleccion, obj] | ['del', coleccion, id]]) para que la capa de datos los persista.
// Es independiente del navegador, de modo que las pruebas (tests/) usan exactamente el mismo código.
import { MAX_CENTS } from '../lib/money.js';
import * as D from '../lib/dates.js';
import { TX_TYPES, ACCOUNT_TYPES, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults.js';
import { balances, debtState, pendingState, prep, touch, isLive } from './ledger.js';

let seq = 0;
export const newId = (p = 'x') => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const fail = (error) => ({ ok: false, error });
const isCents = (n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_CENTS;
const clean = (s) => (typeof s === 'string' ? s.trim() : s);

export function emptyState() {
  return { accounts: [], categories: structuredClone(DEFAULT_CATEGORIES), transactions: [], pendings: [], debts: [], budgets: [], goals: [], recurrings: [],
    settings: structuredClone(DEFAULT_SETTINGS), dayReviews: {}, alertsSeen: {}, _v: 0 };
}

// ------------------------------------------------------------------ movimientos
const NEEDS_TO = ['transfer'];
const NON_CREDIT_ONLY = ['loan_given', 'loan_received', 'saving', 'investment', 'debt_collection'];

function normalizeTx(inp, prev) {
  const t = { ...(prev || {}), ...inp };
  for (const k of ['description', 'party', 'notes', 'reason']) if (k in t) t[k] = clean(t[k]) || '';
  t.fee = t.fee || 0; t.interest = t.interest || 0;
  t.tags = (Array.isArray(t.tags) ? t.tags : String(t.tags || '').split(',')).map((x) => x.trim()).filter(Boolean);
  t.status = t.status || 'confirmado';
  for (const k of ['categoryId', 'subId', 'toAccountId', 'debtId', 'pendingId', 'goalId', 'refId']) if (t[k] === '') t[k] = null;
  return t;
}

function validateTx(state, t, sim, editingId) {
  if (!TX_TYPES[t.type]) return 'Tipo de movimiento no válido.';
  if (!isCents(t.amount) || t.amount <= 0) return 'El importe debe ser un número mayor que cero.';
  if (!isCents(t.fee)) return 'La comisión no es válida.';
  if (!isCents(t.interest)) return 'Los intereses no son válidos.';
  if (!D.isDate(t.date)) return 'La fecha no es válida.';
  if (!D.isTime(t.time)) return 'La hora no es válida.';
  const acc = (id) => state.accounts.find((a) => a.id === id);
  const a = acc(t.accountId);
  if (!a) return 'Selecciona una cuenta.';
  if (a.archived && !editingId) return 'La cuenta seleccionada está archivada.';
  if (NON_CREDIT_ONLY.includes(t.type) && a.type === 'credit' && !(t.type === 'saving' && !t.toAccountId)) return 'Este tipo de movimiento no puede hacerse con una tarjeta de crédito.';
  if (t.type === 'income' && a.type === 'credit') return 'Un ingreso no puede recibirse en una tarjeta de crédito. Usa una transferencia para pagarla.';
  if (NEEDS_TO.includes(t.type) || (t.type === 'saving' && t.toAccountId)) {
    const b = acc(t.toAccountId);
    if (!b) return 'Selecciona la cuenta de destino.';
    if (b.id === a.id) return 'La cuenta de origen y la de destino deben ser distintas.';
    if (t.type === 'saving' && (a.type === 'credit' || b.type === 'credit')) return 'El ahorro no puede moverse desde o hacia una tarjeta de crédito.';
  } else if (t.toAccountId && t.type !== 'saving') t.toAccountId = null;
  if (t.type === 'adjustment') { if (!t.reason) return 'Indica el motivo del ajuste de saldo.'; if (!['+', '-'].includes(t.adjustDir)) return 'Indica si el ajuste suma o resta.'; }
  if (t.type === 'saving' && !t.goalId) return 'Selecciona el objetivo de ahorro.';
  if (t.type === 'saving' && !state.goals.find((g) => g.id === t.goalId)) return 'El objetivo de ahorro no existe.';
  if ((t.type === 'loan_given' || t.type === 'loan_received') && !t.party) return 'Indica la persona o entidad del préstamo.';
  if (t.refId) {
    const o = state.transactions.find((x) => x.id === t.refId);
    if (t.type !== 'refund') t.refId = null;
    else if (!o || o.type !== 'expense') return 'El reembolso debe relacionarse con un gasto existente.';
    else if (o.id === t.id) return 'Un reembolso no puede referirse a sí mismo.';
  }
  if (t.type === 'debt_payment' || t.type === 'debt_collection') {
    const d = state.debts.find((x) => x.id === t.debtId);
    if (!d) return 'Selecciona la deuda o préstamo.';
    if ((t.type === 'debt_payment') !== (d.direction === 'payable')) return 'El tipo de movimiento no coincide con la deuda (pagar lo que debo / cobrar lo que me deben).';
    const s = debtState(sim, d);
    if (s.repaid > s.principal) return 'El abono supera el saldo pendiente de la deuda.';
  }
  if (t.pendingId) {
    const p = state.pendings.find((x) => x.id === t.pendingId);
    if (!p) return 'El pendiente asociado no existe.';
    if (p.cancelled) return 'El pendiente está cancelado.';
    if (pendingState(sim, p).paid > p.amount) return 'El importe supera lo que falta por pagar o cobrar de este pendiente.';
  }
  return null;
}

function warningsFor(state, sim, t) {
  const before = balances(state), after = balances(sim), w = [];
  const ids = new Set([t.accountId, t.toAccountId].filter(Boolean));
  for (const id of ids) {
    const a = state.accounts.find((x) => x.id === id);
    if (!a || after[id] >= before[id]) continue;
    if (a.type === 'credit') { if (a.credit?.limit && -after[id] > a.credit.limit) w.push(`Esta compra supera el cupo de "${a.name}".`); }
    else if (after[id] < 0) w.push(`La cuenta "${a.name}" quedará con saldo negativo.`);
  }
  return w;
}

export function saveTransaction(state, input, opts = {}) {
  const prev = opts.id ? state.transactions.find((t) => t.id === opts.id) : null;
  if (opts.id && !prev) return fail('El movimiento no existe.');
  const now = new Date(), np = D.nowParts(now);
  const t = normalizeTx({ date: np.date, time: np.time, ...input }, prev);
  if (prev) { t.id = prev.id; t.createdAt = prev.createdAt; t.updatedAt = now.toISOString(); if (['loan_given', 'loan_received'].includes(prev.type) && prev.type !== t.type) return fail('No puedes cambiar el tipo de un préstamo; elimínalo y créalo de nuevo.'); }
  else { t.id = newId('tx'); t.createdAt = now.toISOString(); }
  const simTxs = prev ? state.transactions.map((x) => (x.id === t.id ? t : x)) : [...state.transactions, t];
  const sim = { ...state, transactions: simTxs, _c: null, _v: -1 };
  const err = validateTx(state, t, sim, prev?.id);
  if (err) return fail(err);
  const warnings = warningsFor(state, sim, t);
  if (warnings.length && !opts.acceptWarnings) return { ok: false, needsConfirm: true, warnings };

  const changes = [];
  // Préstamos: crean/actualizan su registro de deuda (activo por cobrar o pasivo).
  if (t.type === 'loan_given' || t.type === 'loan_received') {
    const direction = t.type === 'loan_given' ? 'receivable' : 'payable';
    let d = state.debts.find((x) => x.id === t.debtId);
    if (!d) { d = { id: newId('debt'), direction, kind: 'personal', createdAt: now.toISOString(), originTxId: t.id }; state.debts.push(d); t.debtId = d.id; }
    d.person = t.party; d.due = opts.due !== undefined ? opts.due : d.due; d.rate = opts.rate ?? d.rate; d.notes = d.notes || t.notes;
    changes.push(['put', 'debts', d]);
  }
  if (prev) state.transactions[state.transactions.findIndex((x) => x.id === t.id)] = t; else state.transactions.push(t);
  // Reabre el día si estaba revisado: hay información nueva sin verificar.
  const rv = state.dayReviews[t.date];
  if (rv?.reviewed) { state.dayReviews[t.date] = { started: true }; changes.push(['put', 'meta', { id: 'dayReviews', value: state.dayReviews }]); }
  touch(state);
  changes.push(['put', 'transactions', t]);
  return { ok: true, tx: t, changes, reopened: !!rv?.reviewed };
}

export function deleteTransaction(state, id) {
  const t = state.transactions.find((x) => x.id === id);
  if (!t) return fail('El movimiento no existe.');
  if (state.transactions.some((x) => x.refId === id && x.type === 'refund')) return fail('Este gasto tiene reembolsos asociados. Elimina primero el reembolso.');
  const changes = [];
  if (t.type === 'loan_given' || t.type === 'loan_received') {
    const d = state.debts.find((x) => x.originTxId === id);
    if (d) {
      if (debtState(state, d).history.length) return fail('Este préstamo ya tiene abonos. Elimina primero los abonos.');
      state.debts.splice(state.debts.indexOf(d), 1); changes.push(['del', 'debts', d.id]);
    }
  }
  state.transactions.splice(state.transactions.indexOf(t), 1);
  touch(state); changes.push(['del', 'transactions', id]);
  return { ok: true, changes };
}

export function voidTransaction(state, id, voided = true) {
  const t = state.transactions.find((x) => x.id === id);
  if (!t) return fail('El movimiento no existe.');
  const next = { ...t, status: voided ? 'anulado' : 'confirmado', updatedAt: new Date().toISOString() };
  if (voided && ['loan_given', 'loan_received'].includes(t.type)) {
    const d = state.debts.find((x) => x.originTxId === id);
    if (d && debtState(state, d).history.length) return fail('Este préstamo ya tiene abonos; no se puede anular.');
  }
  state.transactions[state.transactions.indexOf(t)] = next; touch(state);
  return { ok: true, changes: [['put', 'transactions', next]] };
}

// ------------------------------------------------------------------ pendientes y deudas
export function savePending(state, input, id) {
  const prev = id && state.pendings.find((p) => p.id === id);
  const p = { ...(prev || {}), ...input };
  p.title = clean(p.title);
  if (!p.title) return fail('Escribe un título.');
  if (!isCents(p.amount) || p.amount <= 0) return fail('El importe debe ser mayor que cero.');
  if (!['payable', 'receivable'].includes(p.kind)) return fail('Indica si debes pagar o te deben pagar.');
  if (p.due && !D.isDate(p.due)) return fail('La fecha de vencimiento no es válida.');
  if (prev) { const paid = pendingState(state, prev).paid; if (p.amount < paid) return fail('El importe no puede ser menor que lo ya pagado o cobrado.'); }
  else { p.id = newId('pen'); p.createdAt = D.today(); }
  if (prev) state.pendings[state.pendings.indexOf(prev)] = p; else state.pendings.push(p);
  return { ok: true, pending: p, changes: [['put', 'pendings', p]] }; // NO toca saldos (regla 11)
}

export function payPending(state, pendingId, { amount, date, time, accountId, interest = 0, fee = 0, notes = '' }, opts = {}) {
  const p = state.pendings.find((x) => x.id === pendingId);
  if (!p) return fail('El pendiente no existe.');
  const ps = pendingState(state, p);
  if (amount > ps.remaining) return fail('El importe supera lo que falta por ' + (p.kind === 'payable' ? 'pagar.' : 'cobrar.'));
  const base = { amount, date, time, accountId, fee, notes, pendingId, description: p.title, party: p.party || '', categoryId: p.categoryId || null };
  let tx;
  if (p.debtId) tx = { ...base, type: p.kind === 'payable' ? 'debt_payment' : 'debt_collection', debtId: p.debtId, interest };
  else if (p.kind === 'payable' && p.cardAccountId) tx = { ...base, type: 'transfer', toAccountId: p.cardAccountId };
  else tx = { ...base, type: p.kind === 'payable' ? 'expense' : 'income' };
  return saveTransaction(state, tx, opts);
}

export function saveDebt(state, input, id) {
  const prev = id && state.debts.find((d) => d.id === id);
  const d = { ...(prev || {}), ...input };
  d.person = clean(d.person);
  if (!d.person) return fail('Indica la persona o entidad.');
  if (!['payable', 'receivable'].includes(d.direction)) return fail('Indica si es una deuda tuya o un préstamo que hiciste.');
  if (!d.originTxId && (!isCents(d.principal) || d.principal <= 0)) return fail('El importe debe ser mayor que cero.');
  if (d.due && !D.isDate(d.due)) return fail('La fecha de vencimiento no es válida.');
  if (prev && !d.originTxId && d.principal < debtState(state, prev).repaid) return fail('El capital no puede ser menor que lo ya abonado.');
  if (!prev) { d.id = newId('debt'); d.createdAt = new Date().toISOString(); d.kind = d.kind || 'personal'; }
  if (prev) state.debts[state.debts.indexOf(prev)] = d; else state.debts.push(d);
  touch(state);
  return { ok: true, debt: d, changes: [['put', 'debts', d]] }; // deuda ya existente: no mueve dinero
}

// ------------------------------------------------------------------ cuentas
export function saveAccount(state, input, id) {
  const prev = id && state.accounts.find((a) => a.id === id);
  const a = { ...(prev || {}), ...input };
  a.name = clean(a.name);
  if (!a.name) return fail('Escribe un nombre para la cuenta.');
  if (!ACCOUNT_TYPES[a.type]) return fail('Tipo de cuenta no válido.');
  if (!Number.isSafeInteger(a.initial) || Math.abs(a.initial) > MAX_CENTS) return fail('El saldo inicial no es válido.');
  if (a.type === 'credit') {
    const c = a.credit || {};
    if (c.limit != null && !isCents(c.limit)) return fail('El cupo total no es válido.');
    for (const k of ['cutDay', 'dueDay']) if (c[k] != null && c[k] !== '' && !(c[k] >= 1 && c[k] <= 31)) return fail('Los días de corte y pago deben estar entre 1 y 31.');
    if (a.initial > 0) a.initial = -a.initial; // deuda inicial = saldo negativo
  } else a.credit = undefined;
  if (state.accounts.some((x) => x.id !== a.id && !x.archived && x.name.toLowerCase() === a.name.toLowerCase())) return fail('Ya existe una cuenta con ese nombre.');
  if (a.archived && !prev?.archived) {
    const bal = balances(state)[a.id] ?? 0;
    if (prev && bal !== 0) return fail('Para archivar la cuenta su saldo debe ser cero. Transfiere el saldo a otra cuenta primero.');
  }
  if (!prev) { a.id = newId('acc'); a.createdAt = new Date().toISOString(); a.openDate = a.openDate || D.today(); a.archived = false; }
  if (!D.isDate(a.openDate)) return fail('La fecha de apertura no es válida.');
  if (prev) state.accounts[state.accounts.indexOf(prev)] = a; else state.accounts.push(a);
  touch(state);
  return { ok: true, account: a, changes: [['put', 'accounts', a]] };
}
export function deleteAccount(state, id) {
  if (state.transactions.some((t) => t.accountId === id || t.toAccountId === id) || state.pendings.some((p) => p.accountId === id || p.cardAccountId === id))
    return fail('La cuenta tiene movimientos. Archívala en lugar de eliminarla.');
  state.accounts = state.accounts.filter((a) => a.id !== id); touch(state);
  return { ok: true, changes: [['del', 'accounts', id]] };
}

// ------------------------------------------------------------------ categorías
export function saveCategory(state, input, id) {
  const prev = id && state.categories.find((c) => c.id === id);
  const c = { subs: [], ...(prev || {}), ...input };
  c.name = clean(c.name);
  if (!c.name) return fail('Escribe un nombre para la categoría.');
  if (state.categories.some((x) => x.id !== c.id && x.kind === c.kind && x.name.toLowerCase() === c.name.toLowerCase())) return fail('Ya existe una categoría con ese nombre.');
  const names = new Set();
  for (const s of c.subs) { s.name = clean(s.name); if (!s.name) return fail('Una subcategoría no tiene nombre.'); if (names.has(s.name.toLowerCase())) return fail(`Subcategoría repetida: ${s.name}.`); names.add(s.name.toLowerCase()); s.id ||= newId('sub'); }
  if (!prev) { c.id = newId('cat'); c.order = state.categories.length; state.categories.push(c); } else state.categories[state.categories.indexOf(prev)] = c;
  // subcategorías eliminadas: limpiar referencias
  const changes = [['put', 'categories', c]];
  if (prev) {
    const keep = new Set(c.subs.map((s) => s.id));
    for (const t of state.transactions) if (t.categoryId === c.id && t.subId && !keep.has(t.subId)) { t.subId = null; changes.push(['put', 'transactions', t]); }
  }
  touch(state);
  return { ok: true, category: c, changes };
}
export function deleteCategory(state, id) {
  const changes = [['del', 'categories', id]];
  state.categories = state.categories.filter((c) => c.id !== id);
  for (const t of state.transactions) if (t.categoryId === id) { t.categoryId = null; t.subId = null; changes.push(['put', 'transactions', t]); }
  for (const p of state.pendings) if (p.categoryId === id) { p.categoryId = null; changes.push(['put', 'pendings', p]); }
  for (const r of state.recurrings) if (r.categoryId === id) { r.categoryId = null; changes.push(['put', 'recurrings', r]); }
  for (const b of state.budgets.filter((x) => x.categoryId === id)) { state.budgets.splice(state.budgets.indexOf(b), 1); changes.push(['del', 'budgets', b.id]); }
  touch(state);
  return { ok: true, changes };
}
export function moveCategory(state, id, dir) {
  const i = state.categories.findIndex((c) => c.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= state.categories.length) return { ok: true, changes: [] };
  [state.categories[i], state.categories[j]] = [state.categories[j], state.categories[i]];
  return { ok: true, changes: state.categories.map((c, k) => ['put', 'categories', { ...c, order: k }]) };
}

// ------------------------------------------------------------------ presupuestos, metas, recurrentes
export function saveBudget(state, input, id) {
  const prev = id && state.budgets.find((b) => b.id === id);
  const b = { period: 'monthly', ...(prev || {}), ...input };
  if (!isCents(b.amount) || b.amount <= 0) return fail('El presupuesto debe ser mayor que cero.');
  if (b.categoryId && !state.categories.find((c) => c.id === b.categoryId)) return fail('La categoría no existe.');
  if (!['monthly', 'weekly', 'custom'].includes(b.period)) return fail('Periodo no válido.');
  if (b.period === 'custom' && (!D.isDate(b.start) || !D.isDate(b.end) || b.end < b.start)) return fail('El rango de fechas del presupuesto no es válido.');
  if (state.budgets.some((x) => x.id !== b.id && x.categoryId === (b.categoryId || null) && x.period === b.period && b.period !== 'custom')) return fail('Ya existe un presupuesto para esa categoría y periodo.');
  b.categoryId = b.categoryId || null;
  if (!prev) { b.id = newId('bud'); state.budgets.push(b); } else state.budgets[state.budgets.indexOf(prev)] = b;
  return { ok: true, budget: b, changes: [['put', 'budgets', b]] };
}
export function saveGoal(state, input, id) {
  const prev = id && state.goals.find((g) => g.id === id);
  const g = { ...(prev || {}), ...input };
  g.name = clean(g.name);
  if (!g.name) return fail('Escribe un nombre para el objetivo.');
  if (!isCents(g.target) || g.target <= 0) return fail('El importe objetivo debe ser mayor que cero.');
  if (g.deadline && !D.isDate(g.deadline)) return fail('La fecha límite no es válida.');
  if (!prev) { g.id = newId('goal'); g.createdAt = D.today(); state.goals.push(g); } else state.goals[state.goals.indexOf(prev)] = g;
  return { ok: true, goal: g, changes: [['put', 'goals', g]] };
}
export function deleteGeneric(state, coll, id) {
  if (coll === 'goals' && state.transactions.some((t) => t.goalId === id)) return fail('El objetivo tiene aportes registrados. Archívalo en lugar de eliminarlo.');
  if (coll === 'pendings' && state.transactions.some((t) => t.pendingId === id)) return fail('El pendiente tiene pagos registrados. Cancélalo en lugar de eliminarlo.');
  if (coll === 'debts') { const d = state.debts.find((x) => x.id === id); if (d?.originTxId) return fail('Este préstamo nació de un movimiento. Elimina el movimiento original.'); if (state.transactions.some((t) => t.debtId === id)) return fail('La deuda tiene abonos registrados. Elimina primero los abonos.'); }
  const arr = state[coll]; const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return fail('El registro no existe.');
  arr.splice(i, 1); touch(state);
  return { ok: true, changes: [['del', coll, id]] };
}
export function saveRecurring(state, input, id) {
  const prev = id && state.recurrings.find((r) => r.id === id);
  const r = { active: true, frequency: 'monthly', ...(prev || {}), ...input };
  r.title = clean(r.title);
  if (!r.title) return fail('Escribe un título.');
  if (!isCents(r.amount) || r.amount <= 0) return fail('El importe debe ser mayor que cero.');
  if (!['expense', 'income', 'transfer', 'debt_payment'].includes(r.type)) return fail('Tipo no válido.');
  if (!['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(r.frequency)) return fail('Frecuencia no válida.');
  if (r.frequency === 'custom' && !(r.everyDays >= 1)) return fail('Indica cada cuántos días se repite.');
  if (!D.isDate(r.start)) return fail('La fecha inicial no es válida.');
  if (!state.accounts.find((a) => a.id === r.accountId)) return fail('Selecciona una cuenta.');
  if (!prev) { r.id = newId('rec'); r.next = r.start; state.recurrings.push(r); } else { if (!D.isDate(r.next)) r.next = r.start; state.recurrings[state.recurrings.indexOf(prev)] = r; }
  return { ok: true, recurring: r, changes: [['put', 'recurrings', r]] };
}

// ------------------------------------------------------------------ revisión diaria y ajustes
export function setDayReview(state, date, status) {
  if (!D.isDate(date)) return fail('Fecha no válida.');
  if (status === 'reviewed') state.dayReviews[date] = { reviewed: true, at: new Date().toISOString() };
  else if (status === 'progress') state.dayReviews[date] = { started: true };
  else delete state.dayReviews[date];
  return { ok: true, changes: [['put', 'meta', { id: 'dayReviews', value: state.dayReviews }]] };
}
export function saveSettings(state, patch) {
  const s = { ...state.settings, ...patch, reminders: { ...state.settings.reminders, ...(patch.reminders || {}) } };
  if (!D.isTime(s.reminders.time) || !D.isTime(s.reminders.summaryTime)) return fail('La hora no es válida.');
  try { new Intl.DateTimeFormat('es', { timeZone: s.timezone }); } catch { return fail('Zona horaria no válida.'); }
  state.settings = s; touch(state);
  return { ok: true, changes: [['put', 'meta', { id: 'settings', value: s }]] };
}
