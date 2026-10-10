import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, saveAccount, saveTransaction, deleteTransaction, voidTransaction, savePending, payPending, saveDebt, saveGoal, saveBudget, saveRecurring, setDayReview } from '../js/core/engine.js';
import { totals, balances, summarize, debtState, pendingState, netWorth, budgetStatus, daySummary, reviewStatus, goalState, savingsTotal, balanceSeries } from '../js/core/ledger.js';
import { confirmRecurrence, dueRecurrences } from '../js/core/recurrence.js';
import { parseMoney, formatMoney, setCurrency } from '../js/lib/money.js';
import * as D from '../js/lib/dates.js';

const COP = (n) => n * 100;
const TODAY = D.today();
const must = (r) => { assert.ok(r.ok, r.error || JSON.stringify(r)); return r; };
const acc = (s, name, type, pesos, extra = {}) => must(saveAccount(s, { name, type, initial: COP(pesos), openDate: '2000-01-01', ...extra })).account;
const tx = (s, o, opts) => saveTransaction(s, { date: TODAY, time: '10:00', ...o }, opts);

test('Dinero: análisis y formato exactos', () => {
  assert.equal(parseMoney('35.000'), 3500000);
  assert.equal(parseMoney('1.250.000,50'), 125000050);
  assert.equal(parseMoney('$ 35,000.50'), 3500050);
  assert.equal(parseMoney('0,1'), 10);
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.equal(0.1 * 3 === 0.3, false); // por qué no usamos floats
  assert.equal(parseMoney('0,1') * 3, 30);
  assert.match(formatMoney(COP(1000000)).replace(/\s/g, ''), /^\$1\.000\.000$/);
});

test('A. Transferencia: el total propio no cambia y no es ingreso ni gasto', () => {
  const s = emptyState(); const b = acc(s, 'Bancolombia', 'savings', 1000000), c = acc(s, 'Efectivo', 'cash', 0);
  must(tx(s, { type: 'transfer', amount: COP(200000), accountId: b.id, toAccountId: c.id }));
  const t = totals(s);
  assert.equal(t.balances[b.id], COP(800000)); assert.equal(t.balances[c.id], COP(200000)); assert.equal(t.own, COP(1000000));
  const m = summarize(s, { from: TODAY, to: TODAY });
  assert.equal(m.income, 0); assert.equal(m.expense, 0); assert.equal(m.transfers.total, COP(200000));
});

test('A2. Comisión de retiro es un gasto independiente', () => {
  const s = emptyState(); const b = acc(s, 'Banco', 'savings', 1000000), c = acc(s, 'Efectivo', 'cash', 0);
  must(tx(s, { type: 'transfer', amount: COP(200000), fee: COP(6000), accountId: b.id, toAccountId: c.id }));
  assert.equal(totals(s).own, COP(994000));
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).expense, COP(6000));
});

test('B/C. Gasto desde efectivo e ingreso en informes diario y mensual', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 100000);
  must(tx(s, { type: 'expense', amount: COP(35000), accountId: c.id, categoryId: 'ali' }));
  must(tx(s, { type: 'income', amount: COP(250000), accountId: c.id, categoryId: 'ing' }));
  assert.equal(totals(s).balances[c.id], COP(315000));
  for (const [f, t] of [[TODAY, TODAY], [D.monthStart(TODAY), D.monthEnd(TODAY)], [D.yearStart(TODAY), D.yearEnd(TODAY)]]) {
    const m = summarize(s, { from: f, to: t }); assert.equal(m.expense, COP(35000)); assert.equal(m.income, COP(250000)); assert.equal(m.byCategory.ali, COP(35000));
  }
});

test('D. Tarjeta de crédito: gasto + deuda, banco intacto hasta pagar; el pago no es gasto', () => {
  const s = emptyState(); const bank = acc(s, 'Banco', 'savings', 500000), cc = acc(s, 'Visa', 'credit', 0, { credit: { limit: COP(2000000) } });
  must(tx(s, { type: 'expense', amount: COP(100000), accountId: cc.id, categoryId: 'var' }));
  let t = totals(s);
  assert.equal(t.balances[bank.id], COP(500000)); assert.equal(t.cardDebt, COP(100000));
  assert.equal(t.creditAvailable, COP(1900000)); assert.equal(t.own, COP(500000)); // cupo NO es dinero propio
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).expense, COP(100000));
  must(tx(s, { type: 'transfer', amount: COP(100000), accountId: bank.id, toAccountId: cc.id, description: 'Pago tarjeta' }));
  t = totals(s);
  assert.equal(t.balances[bank.id], COP(400000)); assert.equal(t.cardDebt, 0);
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).expense, COP(100000)); // sin duplicar
  assert.equal(netWorth(s).net, COP(400000));
});

test('D2. Advertencias: saldo negativo y cupo excedido', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 10000), cc = acc(s, 'Visa', 'credit', 0, { credit: { limit: COP(50000) } });
  const r = tx(s, { type: 'expense', amount: COP(20000), accountId: c.id }); assert.ok(r.needsConfirm);
  assert.equal(s.transactions.length, 0);
  assert.ok(tx(s, { type: 'expense', amount: COP(60000), accountId: cc.id }).needsConfirm);
  must(tx(s, { type: 'expense', amount: COP(20000), accountId: c.id }, { acceptWarnings: true }));
});

test('E/F. Pendiente no mueve saldos; el pago parcial sí, y deja 150.000', () => {
  const s = emptyState(); const b = acc(s, 'Banco', 'savings', 1000000);
  const p = must(savePending(s, { kind: 'payable', title: 'Deuda proveedor', amount: COP(200000), due: D.addDays(TODAY, 5) })).pending;
  assert.equal(totals(s).own, COP(1000000));
  assert.equal(pendingState(s, p).status, 'pending');
  must(payPending(s, p.id, { amount: COP(50000), date: TODAY, time: '11:00', accountId: b.id }));
  const ps = pendingState(s, p);
  assert.equal(ps.remaining, COP(150000)); assert.equal(ps.status, 'partial'); assert.equal(ps.history.length, 1);
  assert.equal(totals(s).balances[b.id], COP(950000));
  assert.equal(payPending(s, p.id, { amount: COP(150001), date: TODAY, time: '11:00', accountId: b.id }).ok, false);
  must(payPending(s, p.id, { amount: COP(150000), date: TODAY, time: '12:00', accountId: b.id }));
  assert.equal(pendingState(s, p).status, 'paid');
});

test('Cobro pendiente parcial suma a la cuenta receptora', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 0);
  const p = must(savePending(s, { kind: 'receivable', title: 'Cliente', amount: COP(300000) })).pending;
  must(payPending(s, p.id, { amount: COP(100000), date: TODAY, time: '09:00', accountId: c.id }));
  assert.equal(totals(s).own, COP(100000)); assert.equal(pendingState(s, p).label, 'Parcialmente cobrado');
});

test('Pendiente vencido', () => {
  const s = emptyState(); const p = must(savePending(s, { kind: 'payable', title: 'Luz', amount: 100, due: D.addDays(TODAY, -2) })).pending;
  assert.equal(pendingState(s, p).label, 'Vencido');
});

test('Préstamos: dado no es gasto; devolución parcial; recibido no es ingreso', () => {
  const s = emptyState(); const b = acc(s, 'Banco', 'savings', 1000000);
  const loan = must(tx(s, { type: 'loan_given', amount: COP(150000), accountId: b.id, party: 'Ana' })).tx;
  assert.equal(totals(s).balances[b.id], COP(850000));
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).expense, 0);
  assert.equal(netWorth(s).net, COP(1000000)); // activo por cobrar
  const debt = s.debts[0]; assert.equal(debtState(s, debt).remaining, COP(150000));
  must(tx(s, { type: 'debt_collection', amount: COP(50000), accountId: b.id, debtId: debt.id }));
  assert.equal(debtState(s, debt).remaining, COP(100000)); assert.equal(totals(s).balances[b.id], COP(900000));
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).income, 0);
  assert.equal(tx(s, { type: 'debt_collection', amount: COP(200000), accountId: b.id, debtId: debt.id }).ok, false);
  assert.equal(deleteTransaction(s, loan.id).ok, false); // tiene abonos
  // préstamo recibido
  const l2 = must(tx(s, { type: 'loan_received', amount: COP(80000), accountId: b.id, party: 'Banco X' })).tx;
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).income, 0);
  assert.equal(netWorth(s).payableDebts, COP(80000));
  must(tx(s, { type: 'debt_payment', amount: COP(30000), interest: COP(2000), accountId: b.id, debtId: s.debts[1].id }));
  const m = summarize(s, { from: TODAY, to: TODAY });
  assert.equal(m.expense, COP(2000)); // solo intereses son gasto; capital no
  assert.equal(debtState(s, s.debts[1]).remaining, COP(50000));
});

test('G. Editar y eliminar recalcula sin duplicar', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 100000);
  const t1 = must(tx(s, { type: 'expense', amount: COP(35000), accountId: c.id })).tx;
  must(saveTransaction(s, { amount: COP(20000) }, { id: t1.id }));
  assert.equal(totals(s).own, COP(80000)); assert.equal(summarize(s, { from: TODAY, to: TODAY }).expense, COP(20000));
  must(saveTransaction(s, { type: 'income' }, { id: t1.id })); assert.equal(totals(s).own, COP(120000));
  must(deleteTransaction(s, t1.id)); assert.equal(totals(s).own, COP(100000));
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).count, 0);
  // transferencia: editar y anular sin duplicar
  const c2 = acc(s, 'Banco', 'savings', 0);
  const tr = must(tx(s, { type: 'transfer', amount: COP(10000), accountId: c.id, toAccountId: c2.id })).tx;
  must(saveTransaction(s, { amount: COP(30000) }, { id: tr.id }));
  assert.equal(totals(s).balances[c2.id], COP(30000)); assert.equal(totals(s).own, COP(100000));
  must(voidTransaction(s, tr.id)); assert.equal(totals(s).balances[c2.id], 0); assert.equal(totals(s).balances[c.id], COP(100000));
});

test('Reembolso reduce el gasto original; ajuste exige motivo', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 100000);
  const g = must(tx(s, { type: 'expense', amount: COP(50000), accountId: c.id, categoryId: 'ali' })).tx;
  must(tx(s, { type: 'refund', amount: COP(10000), accountId: c.id, refId: g.id }));
  const m = summarize(s, { from: TODAY, to: TODAY }); assert.equal(m.expense, COP(40000)); assert.equal(m.income, 0); assert.equal(m.byCategory.ali, COP(40000));
  assert.equal(deleteTransaction(s, g.id).ok, false);
  assert.equal(tx(s, { type: 'adjustment', amount: 5, accountId: c.id, adjustDir: '+' }).ok, false);
  must(tx(s, { type: 'adjustment', amount: COP(1000), accountId: c.id, adjustDir: '-', reason: 'Diferencia en conteo' }));
  const m2 = summarize(s, { from: TODAY, to: TODAY }); assert.equal(m2.expense, COP(40000)); assert.equal(m2.adjustments, -COP(1000));
});

test('Validaciones de importes y transferencias', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 0);
  for (const amount of [0, -5, 1.5, NaN, 1e15]) assert.equal(tx(s, { type: 'income', amount, accountId: c.id }).ok, false);
  assert.equal(tx(s, { type: 'transfer', amount: 100, accountId: c.id, toAccountId: c.id }).ok, false);
  assert.equal(tx(s, { type: 'income', amount: 100, accountId: c.id, date: '2025-02-30' }).ok, false);
  const cc = acc(s, 'Visa', 'credit', 0);
  assert.equal(tx(s, { type: 'income', amount: 100, accountId: cc.id }).ok, false);
});

test('I. Periodos exactos: día, semana (lun-dom), mes y año', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 1000000);
  const put = (date, amount) => must(saveTransaction(s, { type: 'expense', amount: COP(amount), accountId: c.id, date, time: '08:00' }));
  put('2026-03-01', 1); put('2026-03-02', 10); put('2026-03-08', 100); put('2026-03-09', 1000); put('2026-04-01', 10000); put('2025-12-31', 100000);
  const r = (k, a) => { const x = D.periodRange(k, a, 1); return summarize(s, x).expense / 100; };
  assert.equal(r('day', '2026-03-02'), 10);
  assert.equal(r('week', '2026-03-04'), 110);
  assert.equal(r('month', '2026-03-15'), 1111);
  assert.equal(r('year', '2026-06-01'), 11111);
  assert.equal(D.startOfWeek('2026-03-08', 1), '2026-03-02'); // domingo pertenece a la semana que empieza lunes
});

test('Cuentas: saldo inicial por fecha, archivar y eliminar', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 50000);
  assert.equal(saveAccount(s, { name: 'efectivo', type: 'cash', initial: 0 }).ok, false);
  must(tx(s, { type: 'income', amount: COP(1000), accountId: c.id }));
  assert.equal(saveAccount(s, { archived: true }, c.id).ok, false); // saldo != 0
  assert.equal(must(saveAccount(s, { name: 'Vacía', type: 'cash', initial: 0 })).account.archived, false);
});

test('Metas de ahorro: reservado vs separado, sin duplicar dinero', () => {
  const s = emptyState(); const b = acc(s, 'Banco', 'savings', 1000000), p = acc(s, 'Bolsillo PC', 'pocket', 0);
  const g = must(saveGoal(s, { name: 'Computador', target: COP(500000) })).goal;
  must(tx(s, { type: 'saving', goalId: g.id, accountId: b.id, amount: COP(100000), direction: 'in' }));              // reserva
  assert.equal(totals(s).own, COP(1000000));
  must(tx(s, { type: 'saving', goalId: g.id, accountId: b.id, toAccountId: p.id, amount: COP(200000), direction: 'in' })); // separado
  assert.equal(totals(s).own, COP(1000000)); assert.equal(totals(s).balances[p.id], COP(200000));
  const gs = goalState(s, g); assert.equal(gs.reserved, COP(100000)); assert.equal(gs.separated, COP(200000)); assert.equal(gs.pct, 60);
  assert.equal(savingsTotal(s), COP(300000)); // sin contar dos veces el bolsillo
  assert.equal(summarize(s, { from: TODAY, to: TODAY }).expense, 0);
  must(tx(s, { type: 'saving', goalId: g.id, accountId: b.id, amount: COP(40000), direction: 'out' }));
  assert.equal(goalState(s, g).saved, COP(260000));
});

test('Presupuestos por categoría y periodo', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 1000000);
  const b = must(saveBudget(s, { categoryId: 'ali', amount: COP(600000), period: 'monthly' })).budget;
  must(tx(s, { type: 'expense', amount: COP(300000), accountId: c.id, categoryId: 'ali' }));
  must(tx(s, { type: 'expense', amount: COP(50000), accountId: c.id, categoryId: 'tra' }));
  const st = budgetStatus(s, b, TODAY); assert.equal(st.spent, COP(300000)); assert.equal(st.pct, 50); assert.equal(st.remaining, COP(300000));
  assert.equal(saveBudget(s, { categoryId: 'ali', amount: 1, period: 'monthly' }).ok, false);
});

test('Recurrentes: se proponen y solo se contabilizan al confirmar', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 1000000);
  const r = must(saveRecurring(s, { title: 'Arriendo', type: 'expense', amount: COP(700000), accountId: c.id, categoryId: 'viv', frequency: 'monthly', start: D.addDays(TODAY, -1) })).recurring;
  assert.equal(dueRecurrences(s, TODAY).length, 1); assert.equal(totals(s).own, COP(1000000));
  must(confirmRecurrence(s, r.id)); assert.equal(totals(s).own, COP(300000));
  assert.equal(dueRecurrences(s, TODAY).length, 0); assert.ok(s.recurrings[0].next > TODAY);
  assert.equal(D.addMonths('2026-01-31', 1, 31), '2026-02-28');
});

test('Revisión diaria: no se marca sola y se reabre con movimientos nuevos', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 0);
  assert.equal(reviewStatus(s, TODAY), 'pending');
  must(tx(s, { type: 'income', amount: 100, accountId: c.id })); assert.equal(reviewStatus(s, TODAY), 'progress');
  setDayReview(s, TODAY, 'reviewed'); assert.equal(reviewStatus(s, TODAY), 'reviewed');
  must(tx(s, { type: 'income', amount: 100, accountId: c.id })); assert.equal(reviewStatus(s, TODAY), 'progress');
});

test('Resumen del día y serie de saldo', () => {
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 100000);
  must(saveTransaction(s, { type: 'expense', amount: COP(1000), accountId: c.id, date: D.addDays(TODAY, -1), time: '10:00' }));
  must(tx(s, { type: 'income', amount: COP(5000), accountId: c.id }));
  const d = daySummary(s, TODAY); assert.equal(d.opening, COP(99000)); assert.equal(d.closing.own, COP(104000));
  const ser = balanceSeries(s, D.addDays(TODAY, -2), TODAY); assert.deepEqual(ser.map((x) => x.value), [COP(100000), COP(99000), COP(104000)]);
});

test('Zona horaria America/Bogota', () => {
  const p = D.nowParts(new Date('2026-01-01T03:30:00Z'), 'America/Bogota'); // UTC-5
  assert.equal(p.date, '2025-12-31'); assert.equal(p.time, '22:30');
});

import { toBackup, fromBackup } from '../js/core/backup.js';
import { toCSV } from '../js/lib/csv.js';

test('Copia de seguridad: ida y vuelta conserva saldos y rechaza datos dañados', () => {
  const s = emptyState(); const b = acc(s, 'Banco', 'savings', 1000000), c = acc(s, 'Efectivo', 'cash', 0);
  must(tx(s, { type: 'transfer', amount: COP(200000), accountId: b.id, toAccountId: c.id }));
  const json = JSON.stringify(toBackup(s));
  const r = fromBackup(json); assert.ok(r.state, r.error);
  assert.equal(totals(r.state).balances[b.id], COP(800000)); assert.equal(r.state.transactions.length, 1);
  assert.ok(fromBackup('{"format":"otro"}').error); assert.ok(fromBackup('no json').error);
  const bad = JSON.parse(json); bad.data.transactions[0].amount = 1.5; assert.ok(fromBackup(bad).error);
  const dup = JSON.parse(json); dup.data.accounts.push(dup.data.accounts[0]); assert.ok(fromBackup(dup).error);
});

test('CSV neutraliza fórmulas y escapa separadores', () => {
  const out = toCSV([['=SUMA(A1)', 'a;b', 'normal']], ';');
  assert.ok(out.includes("\"'=SUMA(A1)\"")); assert.ok(out.includes('"a;b"'));
});

test('Eliminar categoría limpia referencias y presupuestos', async () => {
  const { deleteCategory } = await import('../js/core/engine.js');
  const s = emptyState(); const c = acc(s, 'Efectivo', 'cash', 100000);
  must(tx(s, { type: 'expense', amount: COP(100), accountId: c.id, categoryId: 'ali' })); must(saveBudget(s, { categoryId: 'ali', amount: COP(1000) }));
  must(deleteCategory(s, 'ali'));
  assert.equal(s.transactions[0].categoryId, null); assert.equal(s.budgets.length, 0); assert.equal(totals(s).own, COP(99900));
});
