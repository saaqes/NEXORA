import { html, raw, str, S, fm, fd, D, empty, modal, toast, confirmBox, fdata, money, cents, options, field, actions, changes, accName, accountSelect, catFields, catLabel, statusChip, ui } from '../ui/kit.js';
import { run } from '../data/store.js';
import { savePending, payPending, deleteGeneric } from '../core/engine.js';
import { pendingState, debtState } from '../core/ledger.js';
import { announceBudgets } from '../alerts.js';

const SUB = { payable: [['bill', 'Factura'], ['loan', 'Cuota de préstamo'], ['card', 'Pago de tarjeta de crédito'], ['utility', 'Servicio público'], ['subscription', 'Suscripción por pagar'], ['recurring', 'Pago recurrente'], ['other', 'Otro']], receivable: [['client', 'Cobro a cliente'], ['loan', 'Cobro de préstamo'], ['other', 'Otro']] };
const SUBL = Object.fromEntries([...SUB.payable, ...SUB.receivable]);
const f = { tab: 'payable', sub: '' };

export function render() {
  const s = S(), today = D.today();
  const all = s.pendings.map((p) => ({ p, st: pendingState(s, p) }));
  const view = all.filter((x) => (f.tab === 'done' ? x.st.status === 'paid' || x.st.status === 'cancelled' : x.p.kind === f.tab && x.st.status !== 'paid' && x.st.status !== 'cancelled') && (!f.sub || x.p.subtype === f.sub)).sort((a, b) => (a.p.due || '9999').localeCompare(b.p.due || '9999'));
  const open = all.filter((x) => x.st.remaining > 0 && x.st.status !== 'cancelled');
  const sum = (k, od) => open.filter((x) => x.p.kind === k && (!od || x.st.status === 'overdue')).reduce((a, x) => a + x.st.remaining, 0);
  const subs = f.tab === 'done' ? [...SUB.payable, ...SUB.receivable.filter((x) => !SUB.payable.some((y) => y[0] === x[0]))] : SUB[f.tab];
  return html`<div class="top"><div class="title"><h1>Pendientes</h1><small>Crear un pendiente no mueve tu dinero: solo cambia al registrar el pago o cobro real</small></div><div class="tools"><button class="btn primary" data-act="pend-new">+ Nuevo pendiente</button></div></div>
  <div class="grid g4 stats" style="margin-bottom:14px"><div class="card stat"><div class="lbl">Por pagar</div><div class="val num neg">${fm(sum('payable'))}</div></div><div class="card stat"><div class="lbl">Vencido por pagar</div><div class="val num ${sum('payable', 1) ? 'neg' : ''}">${fm(sum('payable', 1))}</div></div><div class="card stat"><div class="lbl">Por cobrar</div><div class="val num pos">${fm(sum('receivable'))}</div></div><div class="card stat"><div class="lbl">Cobros vencidos</div><div class="val num ${sum('receivable', 1) ? 'warn' : ''}">${fm(sum('receivable', 1))}</div></div></div>
  <div class="row between wrap" style="margin-bottom:12px"><div class="tabs">${[['payable', 'Debo pagar'], ['receivable', 'Me deben pagar'], ['done', 'Historial']].map(([k, l]) => html`<button class="${f.tab === k ? 'on' : ''}" data-act="pend-tab" data-tab="${k}">${l}</button>`)}</div>
    <select style="max-width:240px" data-change="pend-sub"><option value="">Todos los tipos</option>${options(subs, f.sub)}</select></div>
  ${view.length ? html`<div class="grid auto-l">${view.map(({ p, st }) => { const [lb, cls] = statusChip(st.status); const pct = Math.round((st.paid * 100) / p.amount), rec = p.kind === 'receivable'; return html`<div class="card"><div class="row between"><div class="bold">${p.title}</div><span class="chip ${cls}">${st.label}</span></div>
    <div class="small muted">${SUBL[p.subtype] || (rec ? 'Cobro' : 'Pago')}${p.party ? ' · ' + p.party : ''}${p.categoryId ? ' · ' + catLabel(p.categoryId) : ''}</div>
    <div class="row between" style="margin:10px 0 4px"><span class="num bold" style="font-size:1.3rem">${fm(st.remaining)}</span><span class="small muted">de ${fm(p.amount)}</span></div>
    <div class="bar ${st.status === 'overdue' ? 'neg' : st.status === 'paid' ? 'pos' : ''}"><i style="width:${pct}%"></i></div>
    <div class="small ${st.status === 'overdue' ? 'neg' : 'muted'}" style="margin-top:6px">${p.due ? `Vence ${fd(p.due)}${st.remaining && st.status !== 'cancelled' ? ` (${D.diffDays(p.due, today) >= 0 ? 'en ' + D.diffDays(p.due, today) + ' d' : 'hace ' + -D.diffDays(p.due, today) + ' d'})` : ''}` : 'Sin fecha de vencimiento'}${p.accountId ? ' · ' + accName(p.accountId) : ''}${p.reminderDays != null ? ` · 🔔 ${p.reminderDays} d antes` : ''}</div>
    ${p.notes ? html`<div class="small muted">📝 ${p.notes}</div>` : ''}
    <div class="row wrap" style="margin-top:10px;gap:6px">${st.remaining > 0 && !p.cancelled ? html`<button class="btn sm ${rec ? 'pos' : 'neg'}" data-act="pend-pay" data-id="${p.id}">${rec ? 'Registrar cobro' : 'Registrar pago'}</button>` : ''}<button class="btn sm" data-act="pend-hist" data-id="${p.id}">Historial (${st.history.length})</button>${st.paid === 0 || !p.cancelled ? html`<button class="btn sm" data-act="pend-edit" data-id="${p.id}">Editar</button>` : ''}<button class="btn sm ghost" data-act="pend-cancel" data-id="${p.id}">${p.cancelled ? 'Reactivar' : 'Cancelar'}</button>${st.history.length ? '' : html`<button class="btn sm ghost" data-act="pend-del" data-id="${p.id}">Eliminar</button>`}</div></div>`; })}</div>` : html`<div class="card">${empty('🧾', f.tab === 'done' ? 'Aquí aparecerán los pendientes pagados, cobrados o cancelados.' : 'No hay pendientes en esta lista.', f.tab === 'done' ? '' : html`<p style="margin-top:12px"><button class="btn primary" data-act="pend-new" data-kind="${f.tab}">Agregar uno</button></p>`)}</div>`}`;
}

export function pendingForm(id, kind) {
  const s = S(), p = id ? s.pendings.find((x) => x.id === id) : null, k = p?.kind || kind || 'payable', today = D.today();
  const m = modal({
    title: p ? 'Editar pendiente' : 'Nuevo pendiente', dismiss: false, wide: true,
    body: html`<form id="pf" novalidate><div class="fgrid">
      ${field('Tipo', html`<select name="kind" ${p ? raw('disabled') : ''}>${options([['payable', 'Dinero que debo pagar'], ['receivable', 'Dinero que me deben pagar']], k)}</select>`)}
      ${field('Categoría de pendiente', html`<select name="subtype">${options(SUB[k], p?.subtype)}</select>`)}
      ${field('Título', html`<input name="title" value="${p?.title || ''}" maxlength="80" required placeholder="Ej.: Factura de energía">`, 'full')}
      ${field('Importe', money('amount', p?.amount))}${field('Persona o entidad', html`<input name="party" value="${p?.party || ''}" maxlength="80">`)}
      ${field('Fecha de vencimiento', html`<input type="date" name="due" value="${p?.due || ''}">`)}
      ${field('Recordatorio', html`<select name="reminderDays">${options([['', 'Sin recordatorio'], ['0', 'El mismo día'], ['1', '1 día antes'], ['3', '3 días antes'], ['7', '7 días antes']], p?.reminderDays != null ? String(p.reminderDays) : '')}</select>`)}
      <div class="full" data-cat>${catFields(k === 'receivable' ? 'income' : 'expense', p?.categoryId, p?.subId)}</div>
      ${field('Cuenta prevista para pagar o recibir', accountSelect('accountId', p?.accountId, { ph: 'Sin definir' }))}
      <div class="field" data-g="card"><label>Tarjeta que se paga</label>${accountSelect('cardAccountId', p?.cardAccountId, { ph: 'Selecciona…' })}</div>
      <div class="field" data-g="debt"><label>Deuda asociada</label><select name="debtId">${options(s.debts.filter((d) => d.direction === k).map((d) => [d.id, `${d.person} · pendiente ${fm(debtState(s, d).remaining)}`]), p?.debtId, 'Ninguna')}</select></div>
      ${field('Notas', html`<textarea name="notes" maxlength="400">${p?.notes || ''}</textarea>`, 'full')}</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="pf">Guardar</button>`,
    onMount: (mm) => {
      const fm_ = mm.$('#pf'), sync = () => { const st = fm_.subtype.value, kk = fm_.kind.value; mm.$('[data-g=card]').classList.toggle('hide', !(kk === 'payable' && st === 'card')); mm.$('[data-g=debt]').classList.toggle('hide', st !== 'loan'); };
      fm_.kind.addEventListener('change', () => { mm.$('[data-cat]').innerHTML = str(catFields(fm_.kind.value === 'receivable' ? 'income' : 'expense')); fm_.subtype.innerHTML = SUB[fm_.kind.value].map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); sync(); });
      fm_.subtype.addEventListener('change', sync); sync();
      fm_.addEventListener('submit', async (e) => {
        e.preventDefault(); const d = fdata(fm_), err = mm.$('[data-err]'), amount = cents(d.amount);
        if (!Number.isFinite(amount)) return (err.textContent = 'Escribe un importe válido.');
        const input = { kind: p ? p.kind : d.kind, subtype: d.subtype, title: d.title, amount, party: d.party, due: d.due || null, categoryId: d.categoryId || null, subId: d.subId || null, accountId: d.accountId || null, cardAccountId: d.subtype === 'card' ? d.cardAccountId || null : null, debtId: d.subtype === 'loan' ? d.debtId || null : null, reminderDays: d.reminderDays === '' ? null : Number(d.reminderDays), notes: d.notes };
        const r = await run((st) => savePending(st, input, p?.id)); if (!r.ok) return (err.textContent = r.error);
        mm.close(); toast(p ? 'Pendiente actualizado.' : 'Pendiente creado. Tu saldo no cambia hasta registrar el pago.', 'ok');
      });
    },
  });
}

export function payForm(id) {
  const s = S(), p = s.pendings.find((x) => x.id === id); if (!p) return;
  const ps = pendingState(s, p), rec = p.kind === 'receivable', t = D.nowParts();
  const m = modal({
    title: rec ? 'Registrar cobro' : 'Registrar pago',
    body: html`<form id="pay" novalidate><p><b>${p.title}</b><br><span class="small muted">Pendiente: ${fm(ps.remaining)} de ${fm(p.amount)}${p.cardAccountId ? ' · se registra como transferencia a la tarjeta (no es un gasto nuevo)' : ''}</span></p>
      ${field(rec ? 'Importe cobrado (puede ser parcial)' : 'Importe pagado (puede ser parcial)', money('amount', ps.remaining, 'class="amount"'))}
      <div class="fgrid">${field('Fecha', html`<input type="date" name="date" value="${t.date}">`)}${field('Hora', html`<input type="time" name="time" value="${t.time}">`)}
      ${field(rec ? 'Cuenta que recibe' : 'Cuenta con la que pagas', accountSelect('accountId', p.accountId || s.accounts.find((a) => !a.archived && a.type !== 'credit')?.id, { noCredit: !!p.cardAccountId || rec }))}
      ${p.debtId ? field('Intereses incluidos (opcional)', money('interest', 0)) : ''}${field('Comisión (opcional)', money('fee', 0))}</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="pay">${rec ? 'Registrar cobro' : 'Registrar pago'}</button>`,
    onMount: (mm) => mm.$('#pay').addEventListener('submit', async (e) => {
      e.preventDefault(); const d = fdata(mm.$('#pay')), err = mm.$('[data-err]'), amount = cents(d.amount), interest = d.interest ? cents(d.interest) : 0, fee = d.fee ? cents(d.fee) : 0;
      if (![amount, interest, fee].every(Number.isFinite) || amount <= 0) return (err.textContent = 'Revisa los importes.');
      const args = { amount, date: d.date, time: d.time, accountId: d.accountId, interest, fee };
      let r = await run((st) => payPending(st, id, args));
      if (r.needsConfirm) { if (!await confirmBox({ title: 'Revisa este pago', message: r.warnings.join(' ') + ' ¿Continuar?', ok: 'Continuar' })) return; r = await run((st) => payPending(st, id, args, { acceptWarnings: true })); }
      if (!r.ok) return (err.textContent = r.error);
      mm.close(); toast(rec ? 'Cobro registrado y sumado a tu cuenta.' : 'Pago registrado y descontado de tu cuenta.', 'ok'); announceBudgets();
    }),
  });
}
actions['pend-new'] = (el) => pendingForm(null, el?.dataset?.kind);
actions['pend-edit'] = (el) => pendingForm(el.dataset.id);
actions['pend-pay'] = (el) => payForm(el.dataset.id);
actions['pend-tab'] = (el) => { f.tab = el.dataset.tab; f.sub = ''; ui.render(); };
changes['pend-sub'] = (el) => { f.sub = el.value; ui.render(); };
actions['pend-hist'] = (el) => {
  const s = S(), p = s.pendings.find((x) => x.id === el.dataset.id), ps = pendingState(s, p);
  modal({ title: `Historial · ${p.title}`, body: html`<p class="small muted">Creado ${fd(p.createdAt)} · Importe ${fm(p.amount)} · Pendiente ${fm(ps.remaining)}</p>${ps.history.length ? html`<table><thead><tr><th>Fecha</th><th>Cuenta</th><th class="r">Importe</th></tr></thead><tbody>${ps.history.map((t) => html`<tr><td>${fd(t.date)} ${t.time}</td><td>${accName(t.accountId)}</td><td class="r num">${fm(t.amount)}</td></tr>`)}</tbody></table>` : html`<div class="empty small">Aún no hay pagos ni cobros.</div>`}` });
};
actions['pend-cancel'] = async (el) => { const p = S().pendings.find((x) => x.id === el.dataset.id); if (!p.cancelled && !await confirmBox({ title: 'Cancelar pendiente', message: 'Dejará de contarse como pendiente. Los pagos ya registrados se conservan.', ok: 'Cancelar pendiente' })) return; const r = await run((st) => savePending(st, { cancelled: !p.cancelled }, p.id)); r.ok ? toast(p.cancelled ? 'Pendiente reactivado.' : 'Pendiente cancelado.', 'ok') : toast(r.error, 'bad'); };
actions['pend-del'] = async (el) => { if (!await confirmBox({ title: 'Eliminar pendiente', message: '¿Eliminar este pendiente definitivamente?', ok: 'Eliminar', danger: true })) return; const r = await run((st) => deleteGeneric(st, 'pendings', el.dataset.id)); r.ok ? toast('Pendiente eliminado.', 'ok') : toast(r.error, 'bad'); };
