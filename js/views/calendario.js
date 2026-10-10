import { html, raw, S, fm, fd, D, empty, actions, accName, accIcon, reviewChip, ui, toast } from '../ui/kit.js';
import { run } from '../data/store.js';
import { daySummary, prep, isLive, pendingState, reviewStatus, totals, summarize } from '../core/ledger.js';
import { setDayReview } from '../core/engine.js';
import { finishReview } from '../ui/review.js';
import { txRow } from '../ui/rows.js';

const st = { month: null, day: null };
function ensure(params) {
  const today = D.today();
  if (params?.day && D.isDate(params.day)) { st.day = params.day; st.month = D.monthStart(params.day); }
  st.day ||= today; st.month ||= D.monthStart(st.day);
}
export function render(params) {
  ensure(params);
  const s = S(), today = D.today(), ws = s.settings.weekStart;
  const first = st.month, last = D.monthEnd(first), gridStart = D.startOfWeek(first, ws), gridEnd = D.addDays(D.startOfWeek(last, ws), 6);
  const agg = {};
  for (const t of prep(s).txs) { if (t.date < gridStart || t.date > gridEnd || !isLive(t)) continue; const a = (agg[t.date] ||= {}); if (['income', 'debt_collection', 'refund', 'loan_received'].includes(t.type)) a.inc = 1; else if (['expense', 'fee', 'debt_payment'].includes(t.type)) a.exp = 1; else a.oth = 1; }
  for (const p of s.pendings) { if (p.due && p.due >= gridStart && p.due <= gridEnd && pendingState(s, p).remaining > 0 && !p.cancelled) (agg[p.due] ||= {}).pen = 1; }
  const heads = Array.from({ length: 7 }, (_, i) => D.WD_SHORT[(ws + i) % 7]);
  const cells = D.eachDay(gridStart, gridEnd).map((d) => {
    const a = agg[d] || {}, r = reviewStatus(s, d), inM = d >= first && d <= last;
    return html`<button class="d ${inM ? '' : 'out'} ${d === st.day ? 'sel' : ''} ${d === today ? 'today' : ''}" data-act="cal-day" data-date="${d}" aria-label="${D.formatDateLong(d)}"><span>${Number(d.slice(8))}</span><span class="marks">${a.inc ? html`<i class="i-pos"></i>` : ''}${a.exp ? html`<i class="i-neg"></i>` : ''}${a.pen ? html`<i class="i-warn"></i>` : ''}</span><span class="rv">${r === 'reviewed' ? '✓' : r === 'progress' ? '…' : ' '}</span></button>`;
  });
  // días sin revisar (últimos 30, desde el primer movimiento)
  const firstTx = prep(s).txs[0]?.date;
  const unrev = firstTx ? D.eachDay(D.addDays(today, -29) > firstTx ? D.addDays(today, -29) : firstTx, today).filter((d) => reviewStatus(s, d) !== 'reviewed').reverse() : [];
  const d = daySummary(s, st.day), sm = d.summary;
  const accs = s.accounts.filter((a) => !a.archived || d.closing.balances[a.id]);
  const sec = (title, list, empty = 'Ninguno') => html`<div><h3>${title}</h3>${list.length ? html`<div class="list">${list.map((t) => txRow(t, { act: true }))}</div>` : html`<div class="small muted">${empty}</div>`}</div>`;
  return html`<div class="top"><div class="title"><h1>Calendario financiero</h1><small>Revisa cada día de forma independiente</small></div><div class="tools"><button class="btn sm" data-act="cal-today">Hoy</button></div></div>
  <div class="split"><div class="grid" style="align-content:start">
    <div class="card"><div class="row between" style="margin-bottom:10px"><button class="btn sm" data-act="cal-nav" data-n="-1" aria-label="Mes anterior">‹</button><h2 class="cap" style="margin:0">${D.monthLabel(first)}</h2><button class="btn sm" data-act="cal-nav" data-n="1" aria-label="Mes siguiente">›</button></div>
      <div class="cal">${heads.map((h) => html`<div class="h">${h}</div>`)}${cells}</div><div class="legend"><span><i style="background:var(--pos)"></i>Ingreso</span><span><i style="background:var(--neg)"></i>Gasto</span><span><i style="background:var(--warn)"></i>Vence algo</span><span>✓ revisado · … en progreso</span></div></div>
    <div class="card"><h2>Días por revisar (últimos 30)</h2>${unrev.length ? html`<div class="row wrap" style="gap:6px">${unrev.map((x) => html`<button class="btn sm" data-act="cal-day" data-date="${x}">${Number(x.slice(8))}/${x.slice(5, 7)} ${reviewStatus(s, x) === 'progress' ? '…' : ''}</button>`)}</div>` : html`<div class="empty small">Todos los días están revisados ✅</div>`}</div>
  </div>
  <div class="grid" style="align-content:start"><div class="card"><div class="row between"><button class="btn sm" data-act="cal-daynav" data-n="-1" aria-label="Día anterior">‹</button><div class="right" style="text-align:center"><h2 class="cap" style="margin:0">${D.formatDateLong(st.day)}</h2><div style="margin-top:4px">${reviewChip(d.review)}</div></div><button class="btn sm" data-act="cal-daynav" data-n="1" aria-label="Día siguiente">›</button></div>
    <div class="quick" style="margin:12px 0"><button class="btn pos sm" data-act="tx-new" data-type="income" data-date="${st.day}">+ Ingreso</button><button class="btn neg sm" data-act="tx-new" data-type="expense" data-date="${st.day}">− Gasto</button><button class="btn sm" data-act="tx-new" data-type="transfer" data-date="${st.day}">⇄ Transferencia</button></div>
    ${d.review === 'reviewed' ? html`<div class="banner good"><span class="grow">Revisaste este día: ingresos y gastos verificados.</span><button class="btn sm" data-act="day-reopen">Reabrir</button></div>` : html`<div class="banner"><span class="grow small">¿Ya registraste todo lo de este día? Confírmalo cuando termines.</span>${d.review === 'pending' ? html`<button class="btn sm" data-act="day-start">En progreso</button>` : ''}<button class="btn primary sm" data-act="day-finish">Marcar revisado</button></div>`}
    <table><tbody><tr><td>Saldo inicial del día</td><td class="r num">${fm(d.opening)}</td></tr><tr><td>Ingresos reales</td><td class="r num pos">${fm(sm.income)}</td></tr><tr><td>Gastos reales</td><td class="r num neg">${fm(sm.expense)}</td></tr><tr><td><b>Balance neto del día</b></td><td class="r num ${sm.net >= 0 ? 'pos' : 'neg'}"><b>${fm(sm.net, { sign: true })}</b></td></tr><tr><td>Transferencias (${sm.transfers.count})</td><td class="r num info">${fm(sm.transfers.total)}</td></tr><tr><td>Saldo final (dinero propio)</td><td class="r num bold">${fm(d.closing.own)}</td></tr></tbody></table></div>
  <div class="card"><h2>Saldo final por cuenta</h2><div class="list">${accs.map((a) => html`<div class="item"><span>${accIcon(a)}</span><div class="grow small">${a.name}${a.type === 'credit' ? ' (deuda)' : ''}</div><b class="num">${fm(a.type === 'credit' ? -d.closing.balances[a.id] : d.closing.balances[a.id])}</b></div>`)}</div></div>
  <div class="card"><h2>Movimientos del día (${d.txs.length})</h2><div class="grid">${d.txs.length ? html`${sec('Ingresos recibidos', d.incomes)}${sec('Gastos realizados', d.expenses)}${sec('Transferencias', d.transfers)}${sec('Pagos efectuados', d.payments)}${sec('Cobros recibidos', d.collections)}${d.txs.filter((t) => !d.incomes.includes(t) && !d.expenses.includes(t) && !d.transfers.includes(t) && !d.payments.includes(t) && !d.collections.includes(t)).length ? sec('Otros', d.txs.filter((t) => !d.incomes.includes(t) && !d.expenses.includes(t) && !d.transfers.includes(t) && !d.payments.includes(t) && !d.collections.includes(t))) : ''}` : html`<div class="empty small">Sin movimientos este día.</div>`}</div></div>
  <div class="card"><h2>Pendientes con vencimiento este día</h2>${d.pendingPay.length || d.pendingCollect.length ? html`<div class="list">${[...d.pendingPay, ...d.pendingCollect].map(({ p, st: ps }) => html`<div class="item"><span class="chip ${p.kind === 'payable' ? 'neg' : 'pos'}">${p.kind === 'payable' ? 'Pagar' : 'Cobrar'}</span><div class="grow small bold">${p.title}</div><b class="num">${fm(ps.remaining)}</b><button class="btn sm" data-act="pend-pay" data-id="${p.id}">${p.kind === 'payable' ? 'Pagar' : 'Cobrar'}</button></div>`)}</div>` : html`<div class="small muted">Nada vence este día.</div>`}</div></div></div>`;
}
actions['cal-day'] = (el) => { st.day = el.dataset.date; st.month = D.monthStart(st.day); ui.render({ keepFocus: true }); };
actions['cal-nav'] = (el) => { st.month = D.addMonths(st.month, Number(el.dataset.n)); ui.render(); };
actions['cal-daynav'] = (el) => { st.day = D.addDays(st.day, Number(el.dataset.n)); st.month = D.monthStart(st.day); ui.render(); };
actions['cal-today'] = () => { st.day = D.today(); st.month = D.monthStart(st.day); ui.render(); };
actions['day-start'] = async () => { await run((s) => setDayReview(s, st.day, 'progress')); };
actions['day-reopen'] = async () => { await run((s) => setDayReview(s, st.day, 'progress')); toast('Día reabierto: "Registro en progreso".'); };
actions['day-finish'] = async () => { await finishReview(st.day); };
