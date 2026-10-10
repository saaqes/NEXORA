import { html, raw, S, fm, fd, D, empty, modal, toast, confirmBox, fdata, money, cents, options, field, actions, accName, accountSelect, statusChip, accIcon, ui } from '../ui/kit.js';
import { run } from '../data/store.js';
import { saveDebt, saveTransaction, deleteGeneric } from '../core/engine.js';
import { debtState, debtTotals, totals } from '../core/ledger.js';
import { openTxForm } from '../ui/txform.js';
import { announceBudgets } from '../alerts.js';

const KINDS = [['personal', 'Préstamo personal'], ['bank', 'Préstamo bancario'], ['installment', 'Cuotas / financiación'], ['other', 'Otro compromiso']];
const KL = Object.fromEntries(KINDS);
let tab = 'receivable';

export function render() {
  const s = S(), dt = debtTotals(s), t = totals(s, D.today());
  const list = s.debts.filter((d) => d.direction === tab).map((d) => ({ d, st: debtState(s, d) })).sort((a, b) => (a.st.status === 'closed') - (b.st.status === 'closed') || (a.d.due || '9999').localeCompare(b.d.due || '9999'));
  const cards = tab === 'payable' ? s.accounts.filter((a) => a.type === 'credit' && !a.archived) : [];
  return html`<div class="top"><div class="title"><h1>Préstamos y deudas</h1><small>El dinero prestado es un activo por cobrar, no un gasto</small></div><div class="tools"><button class="btn" data-act="tx-new" data-type="loan_given">🤝 Presté dinero</button><button class="btn" data-act="tx-new" data-type="loan_received">🏦 Me prestaron</button><button class="btn primary" data-act="debt-new">+ Deuda existente</button></div></div>
  <div class="grid g4 stats" style="margin-bottom:14px"><div class="card stat"><div class="lbl">Me deben (préstamos)</div><div class="val num pos">${fm(dt.receivable)}</div></div><div class="card stat"><div class="lbl">Debo (préstamos y cuotas)</div><div class="val num neg">${fm(dt.payable)}</div></div><div class="card stat"><div class="lbl">Deuda de tarjetas</div><div class="val num neg">${fm(t.cardDebt)}</div></div><div class="card stat"><div class="lbl">Total que debo</div><div class="val num neg">${fm(dt.payable + t.cardDebt)}</div></div></div>
  <div class="tabs" style="margin-bottom:12px">${[['receivable', 'Me deben'], ['payable', 'Debo']].map(([k, l]) => html`<button class="${tab === k ? 'on' : ''}" data-act="debt-tab" data-tab="${k}">${l}</button>`)}</div>
  ${cards.length ? html`<h3 style="margin:6px 0 8px">Tarjetas de crédito</h3><div class="grid auto-l" style="margin-bottom:14px">${cards.map((a) => { const debt = -(t.balances[a.id] || 0); return html`<div class="card"><div class="row"><div class="dot">${accIcon(a)}</div><div class="grow"><div class="bold">${a.name}</div><div class="small muted">${a.credit?.dueDay ? 'Límite de pago: día ' + a.credit.dueDay : 'Tarjeta de crédito'}${a.credit?.minPayment ? ' · mínimo ' + fm(a.credit.minPayment) : ''}</div></div><b class="num ${debt > 0 ? 'neg' : ''}">${fm(debt)}</b></div><p style="margin-top:10px"><button class="btn sm" data-act="acc-tr" data-id="${a.id}">Pagar tarjeta</button></p></div>`; })}</div><h3 style="margin:6px 0 8px">Préstamos y otros compromisos</h3>` : ''}
  ${list.length ? html`<div class="grid auto-l">${list.map(({ d, st }) => { const [lb, cls] = statusChip(st.status), pct = st.principal ? Math.round((st.repaid * 100) / st.principal) : 0, rec = d.direction === 'receivable';
    return html`<div class="card"><div class="row between"><div class="bold">${d.person}</div><span class="chip ${cls}">${lb}</span></div><div class="small muted">${KL[d.kind] || 'Préstamo'} · desde ${fd(d.createdAt.slice(0, 10))}${d.rate ? ` · ${d.rate} % E.A.` : ''}</div>
    <div class="row between" style="margin:10px 0 4px"><span class="num bold" style="font-size:1.3rem">${fm(st.remaining)}</span><span class="small muted">de ${fm(st.principal)}</span></div><div class="bar ${st.status === 'closed' ? 'pos' : st.status === 'overdue' ? 'neg' : ''}"><i style="width:${pct}%"></i></div>
    <div class="small muted" style="margin-top:6px">Capital abonado ${fm(st.repaid)}${st.interest ? ` · intereses ${fm(st.interest)}` : ''}${d.due ? ` · vence ${fd(d.due)}` : ''}${d.installments?.amount ? ` · cuota ${fm(d.installments.amount)}` : ''}</div>${d.notes ? html`<div class="small muted">📝 ${d.notes}</div>` : ''}
    <div class="row wrap" style="margin-top:10px;gap:6px">${st.remaining ? html`<button class="btn sm ${rec ? 'pos' : 'neg'}" data-act="debt-pay" data-id="${d.id}">${rec ? 'Registrar cobro' : 'Registrar abono'}</button>` : ''}<button class="btn sm" data-act="debt-hist" data-id="${d.id}">Historial (${st.history.length})</button><button class="btn sm" data-act="debt-edit" data-id="${d.id}">Editar</button>${d.originTxId ? '' : html`<button class="btn sm ghost" data-act="debt-del" data-id="${d.id}">Eliminar</button>`}</div></div>`; })}</div>` : html`<div class="card">${empty('🤝', tab === 'receivable' ? 'Nadie te debe dinero. Si prestas, regístralo con "Presté dinero".' : 'No tienes préstamos registrados. Registra uno con "Me prestaron" o añade una deuda existente.')}</div>`}`;
}

function debtForm(id) {
  const s = S(), d = id ? s.debts.find((x) => x.id === id) : null, st = d && debtState(s, d), fromTx = !!d?.originTxId;
  modal({
    title: d ? 'Editar deuda o préstamo' : 'Registrar deuda existente', dismiss: false,
    body: html`<form id="df" novalidate>${d ? '' : html`<p class="hint" style="margin-bottom:10px">Úsalo para una deuda que ya tenías (no mueve dinero de tus cuentas). Si hoy prestas o te prestan dinero, usa los botones "Presté dinero" / "Me prestaron".</p>`}<div class="fgrid">
      ${field('Tipo', html`<select name="direction" ${d ? raw('disabled') : ''}>${options([['payable', 'Yo debo'], ['receivable', 'Me deben']], d?.direction || tab)}</select>`)}${field('Clase', html`<select name="kind">${options(KINDS, d?.kind || 'personal')}</select>`)}
      ${field('Persona o entidad', html`<input name="person" value="${d?.person || ''}" maxlength="80" required>`, 'full')}
      ${field(fromTx ? 'Capital (definido por el movimiento original)' : 'Capital pendiente inicial', money('principal', st ? st.principal : 0, fromTx ? 'disabled' : ''))}${field('Fecha de vencimiento', html`<input type="date" name="due" value="${d?.due || ''}">`)}
      ${field('Tasa de interés E.A. % (opcional)', html`<input name="rate" inputmode="decimal" value="${d?.rate ?? ''}">`)}${field('Cuota (opcional)', money('inst', d?.installments?.amount))}
      ${field('Notas', html`<textarea name="notes" maxlength="400">${d?.notes || ''}</textarea>`, 'full')}</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="df">Guardar</button>`,
    onMount: (mm) => mm.$('#df').addEventListener('submit', async (e) => {
      e.preventDefault(); const x = fdata(mm.$('#df')), err = mm.$('[data-err]'), principal = x.principal === undefined ? undefined : cents(x.principal), inst = x.inst ? cents(x.inst) : 0;
      if (Number.isNaN(principal) || Number.isNaN(inst)) return (err.textContent = 'Revisa los importes.');
      const input = { direction: d?.direction || x.direction, kind: x.kind, person: x.person, due: x.due || null, rate: x.rate ? Number(String(x.rate).replace(',', '.')) : null, installments: inst ? { amount: inst } : null, notes: x.notes };
      if (!fromTx) input.principal = principal;
      const r = await run((st2) => saveDebt(st2, input, d?.id)); if (!r.ok) return (err.textContent = r.error);
      mm.close(); toast('Guardado. Registrar una deuda existente no mueve tu dinero.', 'ok');
    }),
  });
}
function payDebt(id) {
  const s = S(), d = s.debts.find((x) => x.id === id), st = debtState(s, d), rec = d.direction === 'receivable', t = D.nowParts();
  modal({
    title: rec ? `Cobro de ${d.person}` : `Abono a ${d.person}`,
    body: html`<form id="dp" novalidate><p class="small muted">Saldo pendiente de capital: <b>${fm(st.remaining)}</b></p>${field('Capital ' + (rec ? 'cobrado' : 'abonado'), money('amount', Math.min(st.remaining, st.remaining), 'class="amount"'))}
      <div class="fgrid">${field('Intereses (opcional)', money('interest', 0))}${field('Comisión (opcional)', money('fee', 0))}${field('Fecha', html`<input type="date" name="date" value="${t.date}">`)}${field('Hora', html`<input type="time" name="time" value="${t.time}">`)}
      ${field(rec ? 'Cuenta que recibe' : 'Cuenta con la que pagas', accountSelect('accountId', s.accounts.find((a) => !a.archived && a.type !== 'credit')?.id, { noCredit: true }))}</div><div class="hint">Los intereses y comisiones se registran aparte del capital: ${rec ? 'los intereses cobrados cuentan como ingreso' : 'los intereses pagados cuentan como gasto'}; el capital no.</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="dp">Registrar</button>`,
    onMount: (mm) => mm.$('#dp').addEventListener('submit', async (e) => {
      e.preventDefault(); const x = fdata(mm.$('#dp')), err = mm.$('[data-err]'), amount = cents(x.amount), interest = x.interest ? cents(x.interest) : 0, fee = x.fee ? cents(x.fee) : 0;
      if (![amount, interest, fee].every(Number.isFinite) || amount <= 0) return (err.textContent = 'Revisa los importes.');
      const input = { type: rec ? 'debt_collection' : 'debt_payment', debtId: id, amount, interest, fee, date: x.date, time: x.time, accountId: x.accountId, party: d.person, description: (rec ? 'Cobro de ' : 'Abono a ') + d.person };
      let r = await run((s2) => saveTransaction(s2, input));
      if (r.needsConfirm) { if (!await confirmBox({ title: 'Revisa este movimiento', message: r.warnings.join(' '), ok: 'Continuar' })) return; r = await run((s2) => saveTransaction(s2, input, { acceptWarnings: true })); }
      if (!r.ok) return (err.textContent = r.error); mm.close(); toast('Registrado. Saldo actualizado.', 'ok'); announceBudgets();
    }),
  });
}
actions['debt-tab'] = (el) => { tab = el.dataset.tab; ui.render(); };
actions['debt-new'] = () => debtForm();
actions['debt-edit'] = (el) => debtForm(el.dataset.id);
actions['debt-pay'] = (el) => payDebt(el.dataset.id);
actions['debt-hist'] = (el) => { const s = S(), d = s.debts.find((x) => x.id === el.dataset.id), st = debtState(s, d); modal({ title: `Historial · ${d.person}`, body: html`<p class="small muted">Capital ${fm(st.principal)} · abonado ${fm(st.repaid)} · intereses ${fm(st.interest)} · saldo ${fm(st.remaining)}</p>${st.history.length ? html`<table><thead><tr><th>Fecha</th><th>Cuenta</th><th class="r">Capital</th><th class="r">Interés</th></tr></thead><tbody>${st.history.map((t) => html`<tr><td>${fd(t.date)}</td><td>${accName(t.accountId)}</td><td class="r num">${fm(t.amount)}</td><td class="r num">${fm(t.interest || 0)}</td></tr>`)}</tbody></table>` : html`<div class="empty small">Sin abonos todavía.</div>`}` }); };
actions['debt-del'] = async (el) => { if (!await confirmBox({ title: 'Eliminar deuda', message: 'Se eliminará este registro (sin abonos).', ok: 'Eliminar', danger: true })) return; const r = await run((st) => deleteGeneric(st, 'debts', el.dataset.id)); r.ok ? toast('Eliminada.', 'ok') : toast(r.error, 'bad', 6000); };
