// Motor contable PURO de NEXORA. No guarda saldos: los DERIVA de los movimientos.
// Así editar/eliminar/anular jamás deja saldos desfasados ni importes duplicados (regla 15 y 16).
// Todos los importes son enteros en centavos.
import { CAT_FEES, CAT_DEBTS, SUB_INTEREST, CAT_INCOME, SUB_YIELDS } from './defaults.js';
import * as D from '../lib/dates.js';

export const isLive = (t) => t.status !== 'anulado';
export const byTime = (a, b) => D.sortKey(a).localeCompare(D.sortKey(b));

// ---------- efectos sobre cuentas ----------
// Devuelve [{accountId, delta}]. Una compra con tarjeta de crédito hace el saldo más negativo (= más deuda).
export function effectsOf(t) {
  if (!isLive(t)) return [];
  const A = t.amount, f = t.fee || 0, i = t.interest || 0, out = [];
  const add = (accountId, delta) => { if (accountId && delta) out.push({ accountId, delta }); };
  switch (t.type) {
    case 'income': case 'refund': case 'loan_received': add(t.accountId, A); break;
    case 'expense': case 'fee': case 'loan_given': add(t.accountId, -A); break;
    case 'transfer': add(t.accountId, -A); add(t.toAccountId, A); break;
    case 'saving': if (t.toAccountId) { add(t.accountId, -A); add(t.toAccountId, A); } break; // sin cuenta destino = solo reserva
    case 'investment': add(t.accountId, t.direction === 'out' ? A : -A); break;
    case 'debt_payment': add(t.accountId, -(A + i)); break;
    case 'debt_collection': add(t.accountId, A + i); break;
    case 'adjustment': add(t.accountId, t.adjustDir === '-' ? -A : A); break;
  }
  if (f && t.type !== 'fee') add(t.accountId, -f);
  return out;
}

// Flujos de ingreso/gasto de CONSUMO que alimentan los informes. Las transferencias, préstamos,
// pagos de capital, ahorros e inversiones NO generan flujos (reglas 4, 7, 8, 9, 12).
export function flowsOf(t, byId) {
  if (!isLive(t)) return [];
  const o = [], base = { txId: t.id, accountId: t.accountId, date: t.date };
  const push = (kind, amount, categoryId, subId) => amount && o.push({ ...base, kind, amount, categoryId: categoryId ?? null, subId: subId ?? null });
  switch (t.type) {
    case 'income': push('income', t.amount, t.categoryId, t.subId); break;
    case 'expense': push('expense', t.amount, t.categoryId, t.subId); break;
    case 'fee': push('expense', t.amount, t.categoryId || CAT_FEES, t.subId); break;
    case 'refund': {
      const orig = t.refId && byId?.get(t.refId);
      if (orig && isLive(orig) && orig.type === 'expense') push('expense', -t.amount, orig.categoryId, orig.subId);
      else push('income', t.amount, t.categoryId || CAT_INCOME, t.subId);
      break;
    }
    case 'debt_payment': push('expense', t.interest, CAT_DEBTS, SUB_INTEREST); break;
    case 'debt_collection': push('income', t.interest, CAT_INCOME, SUB_YIELDS); break;
  }
  if (t.fee && t.type !== 'fee') push('expense', t.fee, CAT_FEES, null);
  return o;
}

// ---------- caché por versión del estado ----------
export function prep(state) {
  if (state._c && state._c.n === state.transactions.length && state._c.v === state._v) return state._c;
  const txs = [...state.transactions].sort(byTime);
  const c = { n: state.transactions.length, v: state._v, txs, byId: new Map(state.transactions.map((t) => [t.id, t])) };
  c.flows = txs.flatMap((t) => flowsOf(t, c.byId));
  state._c = c;
  return c;
}
export const touch = (state) => { state._v = (state._v || 0) + 1; state._c = null; };

// ---------- saldos ----------
export function balances(state, upTo) {
  const { txs } = prep(state), b = {};
  for (const a of state.accounts) b[a.id] = (!upTo || (a.openDate || '0000') <= upTo) ? a.initial || 0 : 0;
  for (const t of txs) {
    if (upTo && t.date > upTo) break;
    for (const e of effectsOf(t)) if (e.accountId in b) b[e.accountId] += e.delta;
  }
  return b;
}
const group = (t) => (t === 'cash' ? 'cash' : t === 'pocket' ? 'pocket' : 'bank');
export function totals(state, upTo) {
  const b = balances(state, upTo), r = { cash: 0, bank: 0, pocket: 0, own: 0, cardDebt: 0, creditLimit: 0, creditAvailable: 0, balances: b };
  for (const a of state.accounts) {
    const v = b[a.id];
    if (a.type === 'credit') {
      r.cardDebt += -v;                     // deuda positiva
      if (a.credit?.limit) { r.creditLimit += a.credit.limit; r.creditAvailable += a.credit.limit + v; }
    } else { r[group(a.type)] += v; r.own += v; }
  }
  return r; // own = dinero propio; el cupo disponible NUNCA entra en own
}

// ---------- deudas (prestamos) ----------
export const principalOf = (debt, byId) => {
  const o = debt.originTxId && byId.get(debt.originTxId);
  return o && isLive(o) ? o.amount : debt.principal || 0;
};
export function debtState(state, debt) {
  const { txs, byId } = prep(state);
  const history = txs.filter((t) => t.debtId === debt.id && isLive(t) && (t.type === 'debt_payment' || t.type === 'debt_collection'));
  const principal = principalOf(debt, byId);
  const repaid = history.reduce((a, t) => a + t.amount, 0);
  const interest = history.reduce((a, t) => a + (t.interest || 0), 0);
  const remaining = Math.max(0, principal - repaid);
  const today = D.today();
  const status = remaining === 0 ? 'closed' : debt.due && debt.due < today ? 'overdue' : repaid > 0 ? 'partial' : 'open';
  return { principal, repaid, interest, remaining, history, status };
}
export function debtTotals(state) {
  let payable = 0, receivable = 0;
  for (const d of state.debts) { const s = debtState(state, d).remaining; if (d.direction === 'payable') payable += s; else receivable += s; }
  return { payable, receivable };
}

// ---------- pendientes ----------
export function pendingState(state, p, todayStr = D.today()) {
  const { txs } = prep(state);
  const history = txs.filter((t) => t.pendingId === p.id && isLive(t));
  const paid = history.reduce((a, t) => a + t.amount, 0);
  const remaining = Math.max(0, p.amount - paid);
  let status = 'pending';
  if (p.cancelled) status = 'cancelled';
  else if (remaining === 0) status = 'paid';
  else if (p.due && p.due < todayStr) status = 'overdue';
  else if (paid > 0) status = 'partial';
  const rec = p.kind === 'receivable';
  const label = { pending: 'Pendiente', partial: rec ? 'Parcialmente cobrado' : 'Parcialmente pagado', paid: rec ? 'Cobrado' : 'Pagado', overdue: 'Vencido', cancelled: 'Cancelado' }[status];
  return { paid, remaining, status, label, history };
}

// ---------- filtros y resúmenes ----------
export function txMatches(t, f = {}) {
  if (f.from && t.date < f.from) return false;
  if (f.to && t.date > f.to) return false;
  if (f.type && t.type !== f.type) return false;
  if (f.status && t.status !== f.status) return false;
  if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false;
  if (f.categoryId && t.categoryId !== f.categoryId) return false;
  if (f.min != null && f.min !== '' && t.amount < f.min) return false;
  if (f.max != null && f.max !== '' && t.amount > f.max) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![t.description, t.party, t.notes, (t.tags || []).join(' ')].some((x) => (x || '').toLowerCase().includes(q))) return false;
  }
  return true;
}

export function summarize(state, f = {}) {
  const { txs, byId } = prep(state);
  const r = { income: 0, expense: 0, net: 0, savingsRate: 0, byCategory: {}, bySub: {}, incomeByCategory: {}, byAccount: {}, byDay: {},
    transfers: { count: 0, total: 0 }, cashFlow: 0, debtPaid: 0, debtCollected: 0, loansGiven: 0, loansReceived: 0, saved: 0, invested: 0, adjustments: 0, count: 0, txs: [] };
  const own = new Set(state.accounts.filter((a) => a.type !== 'credit').map((a) => a.id));
  for (const t of txs) {
    if (!isLive(t) && f.status !== 'anulado') continue;
    if (!txMatches(t, { ...f, categoryId: null })) continue;
    r.count++; r.txs.push(t);
    for (const e of effectsOf(t)) if (own.has(e.accountId)) r.cashFlow += e.delta;
    for (const fl of flowsOf(t, byId)) {
      if (f.categoryId && fl.categoryId !== f.categoryId) continue;
      const day = (r.byDay[fl.date] ||= { income: 0, expense: 0 });
      if (fl.kind === 'income') { r.income += fl.amount; day.income += fl.amount; r.incomeByCategory[fl.categoryId ?? '_'] = (r.incomeByCategory[fl.categoryId ?? '_'] || 0) + fl.amount; }
      else {
        r.expense += fl.amount; day.expense += fl.amount;
        r.byCategory[fl.categoryId ?? '_'] = (r.byCategory[fl.categoryId ?? '_'] || 0) + fl.amount;
        const k = `${fl.categoryId ?? '_'}|${fl.subId ?? ''}`; r.bySub[k] = (r.bySub[k] || 0) + fl.amount;
        r.byAccount[fl.accountId] = (r.byAccount[fl.accountId] || 0) + fl.amount;
      }
    }
    if (isLive(t)) switch (t.type) {
      case 'transfer': r.transfers.count++; r.transfers.total += t.amount; break;
      case 'debt_payment': r.debtPaid += t.amount; break;
      case 'debt_collection': r.debtCollected += t.amount; break;
      case 'loan_given': r.loansGiven += t.amount; break;
      case 'loan_received': r.loansReceived += t.amount; break;
      case 'saving': r.saved += t.direction === 'out' ? -t.amount : t.amount; break;
      case 'investment': r.invested += t.direction === 'out' ? -t.amount : t.amount; break;
      case 'adjustment': r.adjustments += t.adjustDir === '-' ? -t.amount : t.amount; break;
    }
  }
  r.net = r.income - r.expense;
  r.savingsRate = r.income > 0 ? Math.round((r.net * 100) / r.income) : 0;
  return r;
}

// ---------- ahorros / metas ----------
export function goalState(state, g) {
  const { txs } = prep(state);
  let reserved = 0, separated = 0; const history = [];
  for (const t of txs) {
    if (t.goalId !== g.id || t.type !== 'saving' || !isLive(t)) continue;
    const s = t.direction === 'out' ? -t.amount : t.amount;
    if (t.toAccountId) separated += s; else reserved += s;
    history.push(t);
  }
  const saved = reserved + separated;
  return { reserved, separated, saved, pct: g.target > 0 ? Math.min(100, Math.round((saved * 100) / g.target)) : 0, history };
}
export function savingsTotal(state, upTo) {
  // ahorro reservado + saldo de bolsillos + ahorro separado en cuentas que no son bolsillo (sin doble conteo)
  const { txs } = prep(state), b = balances(state, upTo), acc = new Map(state.accounts.map((a) => [a.id, a]));
  let total = 0;
  for (const a of state.accounts) if (a.type === 'pocket') total += b[a.id];
  for (const t of txs) {
    if (t.type !== 'saving' || !t.goalId || !isLive(t) || (upTo && t.date > upTo)) continue;
    const s = t.direction === 'out' ? -t.amount : t.amount;
    if (!t.toAccountId) total += s;
    else if (acc.get(t.toAccountId)?.type !== 'pocket') total += s;
  }
  return total;
}
export function investedTotal(state, upTo) {
  return prep(state).txs.reduce((a, t) => a + (t.type === 'investment' && isLive(t) && (!upTo || t.date <= upTo) ? (t.direction === 'out' ? -t.amount : t.amount) : 0), 0);
}

// ---------- patrimonio ----------
export function netWorth(state, upTo) {
  const t = totals(state, upTo), dt = debtTotals(state), inv = investedTotal(state, upTo);
  const assets = t.own + dt.receivable + inv, liabilities = t.cardDebt + dt.payable;
  return { assets, liabilities, net: assets - liabilities, own: t.own, receivable: dt.receivable, invested: inv, cardDebt: t.cardDebt, payableDebts: dt.payable };
}

// ---------- presupuestos ----------
export function budgetRange(b, anchor, weekStart = 1) {
  if (b.period === 'custom') return { from: b.start, to: b.end };
  return D.periodRange(b.period === 'weekly' ? 'week' : 'month', anchor, weekStart);
}
const spentIn = (state, categoryId, r) => {
  const { flows } = prep(state); let s = 0;
  for (const f of flows) if (f.kind === 'expense' && f.date >= r.from && f.date <= r.to && (!categoryId || f.categoryId === categoryId)) s += f.amount;
  return s;
};
export function budgetStatus(state, b, anchor = D.today(), weekStart = 1) {
  const range = budgetRange(b, anchor, weekStart);
  const spent = spentIn(state, b.categoryId, range);
  let prev = null;
  if (b.period !== 'custom') prev = spentIn(state, b.categoryId, D.prevRange(b.period === 'weekly' ? 'week' : 'month', anchor, weekStart));
  return { range, spent, remaining: b.amount - spent, pct: b.amount > 0 ? Math.round((spent * 100) / b.amount) : 0, prev };
}

// ---------- día ----------
export function reviewStatus(state, date) {
  const r = state.dayReviews?.[date];
  if (r?.reviewed) return 'reviewed';
  return prep(state).txs.some((t) => t.date === date && isLive(t)) || r?.started ? 'progress' : 'pending';
}
export function daySummary(state, date) {
  const prevDay = D.addDays(date, -1), s = summarize(state, { from: date, to: date });
  const { txs } = prep(state);
  const dayTxs = txs.filter((t) => t.date === date);
  const live = dayTxs.filter(isLive);
  const pend = state.pendings.map((p) => ({ p, s: pendingState(state, p) })).filter((x) => x.p.due === date && x.s.remaining > 0 && x.s.status !== 'cancelled');
  return {
    date, opening: totals(state, prevDay).own, closing: totals(state, date), summary: s, txs: dayTxs,
    incomes: live.filter((t) => t.type === 'income'), expenses: live.filter((t) => t.type === 'expense'), transfers: live.filter((t) => t.type === 'transfer'),
    payments: live.filter((t) => t.type === 'debt_payment' || (t.pendingId && ['expense', 'transfer', 'debt_payment'].includes(t.type))),
    collections: live.filter((t) => t.type === 'debt_collection' || (t.pendingId && t.type === 'income')),
    pendingPay: pend.filter((x) => x.p.kind === 'payable'), pendingCollect: pend.filter((x) => x.p.kind === 'receivable'),
    review: reviewStatus(state, date),
  };
}

// ---------- series ----------
export function balanceSeries(state, from, to) {
  // Saldo propio al cierre de cada día del rango (una sola pasada).
  const days = D.eachDay(from, to), start = totals(state, D.addDays(from, -1)).own;
  const delta = {}, own = new Set(state.accounts.filter((a) => a.type !== 'credit').map((a) => a.id));
  const openers = state.accounts.filter((a) => a.type !== 'credit' && a.openDate > D.addDays(from, -1) && a.openDate <= to);
  for (const a of openers) delta[a.openDate] = (delta[a.openDate] || 0) + (a.initial || 0);
  for (const t of prep(state).txs) {
    if (t.date < from || t.date > to) continue;
    for (const e of effectsOf(t)) if (own.has(e.accountId)) delta[t.date] = (delta[t.date] || 0) + e.delta;
  }
  let run = start;
  return days.map((d) => ({ date: d, value: (run += delta[d] || 0) }));
}
export function monthlySeries(state, year) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0'), from = `${year}-${m}-01`, to = D.monthEnd(from);
    const s = summarize(state, { from, to });
    const end = savingsTotal(state, to), debt = debtTotals(state);
    return { month: i + 1, income: s.income, expense: s.expense, net: s.net, savings: end, cardDebt: totals(state, to).cardDebt, payable: debt.payable };
  });
}

// ---------- alertas ----------
export function largeExpenseThreshold(state, settings) {
  if (settings.largeExpense > 0) return settings.largeExpense;
  const d = D.today(), from = D.addDays(d, -90);
  const xs = prep(state).flows.filter((f) => f.kind === 'expense' && f.date >= from && f.date <= d && f.amount > 0);
  if (xs.length < 10) return 0;
  return Math.round((xs.reduce((a, f) => a + f.amount, 0) / xs.length) * 3);
}
export function largeExpenses(state, settings, days = 7) {
  const th = largeExpenseThreshold(state, settings); if (!th) return [];
  const from = D.addDays(D.today(), -days);
  return prep(state).txs.filter((t) => t.type === 'expense' && isLive(t) && t.date >= from && t.amount >= th).reverse();
}
