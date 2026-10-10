// Datos de EJEMPLO. Todos llevan demo:true para poder eliminarlos con un clic. No son datos reales del usuario.
import * as D from '../lib/dates.js';
import { saveAccount, saveTransaction, savePending, saveDebt, saveGoal, saveBudget, saveRecurring } from './engine.js';

export function buildDemo(state) {
  const changes = [], T = D.today(), c = (n) => n * 100, mark = { demo: true };
  const run = (r) => { if (!r.ok) throw new Error(r.error || 'demo'); changes.push(...r.changes); return r; };
  const A = (name, type, initial, extra = {}) => run(saveAccount(state, { name, type, initial: c(initial), entity: extra.entity || '', color: extra.color || '#7c6cff', openDate: D.addDays(T, -75), ...mark, ...extra })).account;
  const bank = A('Cuenta ahorros (ejemplo)', 'savings', 2400000, { entity: 'Banco de ejemplo' });
  const cash = A('Efectivo (ejemplo)', 'cash', 150000);
  const card = A('Tarjeta crédito (ejemplo)', 'credit', 0, { entity: 'Banco de ejemplo', credit: { limit: c(3000000), cutDay: 15, dueDay: 2, minPayment: c(80000) } });
  const pocket = A('Bolsillo viaje (ejemplo)', 'pocket', 0);
  const tx = (o, opts) => run(saveTransaction(state, { ...mark, ...o }, { acceptWarnings: true, ...opts }));
  for (let m = 2; m >= 0; m--) {
    const base = D.addMonths(D.monthStart(T), -m);
    const day = (n) => { const d = D.addDays(base, n - 1); return d <= T ? d : null; };
    const when = (n) => day(n);
    if (when(1)) tx({ type: 'income', amount: c(3200000), accountId: bank.id, categoryId: 'ing', subId: 'ing:salario', description: 'Salario', date: when(1), time: '08:00' });
    if (when(2)) tx({ type: 'expense', amount: c(850000), accountId: bank.id, categoryId: 'viv', subId: 'viv:arriendo', description: 'Arriendo', date: when(2), time: '09:00' });
    if (when(4)) tx({ type: 'expense', amount: c(180000), accountId: bank.id, categoryId: 'viv', subId: 'viv:servicios-publicos', description: 'Servicios', date: when(4), time: '10:00' });
    if (when(5)) tx({ type: 'transfer', amount: c(300000), accountId: bank.id, toAccountId: cash.id, description: 'Retiro cajero', fee: c(3000), date: when(5), time: '11:00' });
    for (const [n, amt, cat, sub, desc] of [[6, 95000, 'ali', 'ali:mercado', 'Mercado'], [9, 42000, 'ali', 'ali:domicilios', 'Domicilio'], [12, 60000, 'tra', 'tra:gasolina', 'Gasolina'], [14, 38000, 'ent', 'ent:suscripciones', 'Suscripciones'], [17, 120000, 'ali', 'ali:mercado', 'Mercado'], [20, 85000, 'rop', 'rop:ropa', 'Ropa']])
      if (when(n)) tx({ type: 'expense', amount: c(amt), accountId: n % 2 ? card.id : cash.id, categoryId: cat, subId: sub, description: desc, date: when(n), time: '15:00' });
  }
  tx({ type: 'income', amount: c(250000), accountId: cash.id, categoryId: 'ing', subId: 'ing:trabajo-independiente', description: 'Trabajo freelance', date: D.addDays(T, -1), time: '17:00' });
  tx({ type: 'expense', amount: c(35000), accountId: cash.id, categoryId: 'ali', subId: 'ali:comida-fuera-de-casa', description: 'Almuerzo', date: T, time: '13:00' });
  const g = run(saveGoal(state, { name: 'Viaje (ejemplo)', target: c(2000000), deadline: D.addDays(T, 180), accountId: pocket.id, ...mark })).goal;
  tx({ type: 'saving', goalId: g.id, accountId: bank.id, toAccountId: pocket.id, amount: c(400000), direction: 'in', description: 'Aporte viaje', date: D.addDays(T, -10), time: '12:00' });
  tx({ type: 'transfer', amount: c(100000), accountId: bank.id, toAccountId: card.id, description: 'Pago de tarjeta', date: D.addDays(T, -3), time: '12:00' });
  tx({ type: 'loan_given', amount: c(150000), accountId: bank.id, party: 'Persona de ejemplo', description: 'Préstamo', date: D.addDays(T, -20), time: '12:00' });
  run(savePending(state, { kind: 'payable', title: 'Internet (ejemplo)', amount: c(95000), party: 'Operador', due: D.addDays(T, 4), categoryId: 'viv', accountId: bank.id, ...mark }));
  run(savePending(state, { kind: 'receivable', title: 'Cobro cliente (ejemplo)', amount: c(500000), party: 'Cliente', due: D.addDays(T, 9), accountId: bank.id, ...mark }));
  run(saveDebt(state, { direction: 'payable', person: 'Banco de ejemplo', kind: 'bank', principal: c(1200000), due: D.addDays(T, 60), ...mark }));
  for (const [cat, amt] of [['ali', 600000], ['tra', 250000], ['ent', 150000], ['viv', 1100000]]) run(saveBudget(state, { categoryId: cat, amount: c(amt), period: 'monthly', ...mark }));
  run(saveRecurring(state, { title: 'Arriendo (ejemplo)', type: 'expense', amount: c(850000), accountId: bank.id, categoryId: 'viv', frequency: 'monthly', start: D.addDays(T, 3), ...mark }));
  return changes;
}
