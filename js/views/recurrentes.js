import { html, raw, S, fm, fd, D, empty, modal, toast, confirmBox, fdata, money, cents, options, field, actions, accName, accountSelect, catFields, catLabel } from '../ui/kit.js';
import { run } from '../data/store.js';
import { saveRecurring, deleteGeneric } from '../core/engine.js';
import { dueRecurrences, confirmRecurrence, skipRecurrence } from '../core/recurrence.js';
import { debtState } from '../core/ledger.js';
import { announceBudgets } from '../alerts.js';

const FREQ = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual', custom: 'Personalizada' };
const TYPES = [['expense', 'Gasto (arriendo, servicios, suscripciones…)'], ['income', 'Ingreso periódico / pago de cliente'], ['transfer', 'Transferencia / aporte de ahorro'], ['debt_payment', 'Cuota de préstamo']];
export function render() {
  const s = S(), today = D.today(), due = dueRecurrences(s, today);
  return html`<div class="top"><div class="title"><h1>Movimientos recurrentes</h1><small>NEXORA los <b>propone</b> y tú los confirmas: nada se contabiliza solo</small></div><div class="tools"><button class="btn primary" data-act="rec-new">+ Nueva recurrente</button></div></div>
  ${due.length ? html`<div class="card" style="margin-bottom:14px;border-color:var(--warn)"><h2>📌 Por confirmar (${due.length})</h2><div class="list">${due.map((r) => html`<div class="item"><div class="grow"><div class="bold">${r.title}</div><div class="small muted">Tocaba el ${fd(r.next)} · ${accName(r.accountId)}</div></div><b class="num">${fm(r.amount)}</b><button class="btn sm primary" data-act="rec-confirm" data-id="${r.id}">Revisar y confirmar</button><button class="btn sm" data-act="rec-skip" data-id="${r.id}">Omitir</button></div>`)}</div></div>` : ''}
  ${s.recurrings.length ? html`<div class="grid auto-l">${s.recurrings.map((r) => html`<div class="card" style="${r.active ? '' : 'opacity:.55'}"><div class="row between"><div class="bold">🔁 ${r.title}</div><span class="chip ${r.type === 'income' ? 'pos' : r.type === 'transfer' ? 'info' : 'neg'}">${TYPES.find((t) => t[0] === r.type)[1].split(' (')[0]}</span></div>
    <div class="num bold" style="font-size:1.3rem;margin:8px 0 2px">${fm(r.amount)}</div><div class="small muted">${FREQ[r.frequency]}${r.frequency === 'custom' ? ` (cada ${r.everyDays} d)` : ''} · ${accName(r.accountId)}${r.toAccountId ? ' → ' + accName(r.toAccountId) : ''}${r.categoryId ? ' · ' + catLabel(r.categoryId, r.subId) : ''}</div>
    <div class="small ${r.next <= today ? 'warn' : 'muted'}" style="margin-top:4px">Próxima: ${fd(r.next)}${r.lastDone ? ` · última confirmada ${fd(r.lastDone)}` : ''}</div>
    <div class="row wrap" style="margin-top:10px;gap:6px"><button class="btn sm" data-act="rec-edit" data-id="${r.id}">Editar</button><button class="btn sm ghost" data-act="rec-toggle" data-id="${r.id}">${r.active ? 'Pausar' : 'Reanudar'}</button><button class="btn sm ghost" data-act="rec-del" data-id="${r.id}">Eliminar</button></div></div>`)}</div>` : html`<div class="card">${empty('🔁', 'Configura arriendo, servicios, suscripciones, cuotas, ingresos periódicos o aportes de ahorro.', html`<p style="margin-top:12px"><button class="btn primary" data-act="rec-new">Crear recurrente</button></p>`)}</div>`}`;
}
function form(id) {
  const s = S(), r = id ? s.recurrings.find((x) => x.id === id) : null, ty = r?.type || 'expense';
  modal({ title: r ? 'Editar recurrente' : 'Nueva recurrente', dismiss: false, wide: true,
    body: html`<form id="rf" novalidate><div class="fgrid">${field('Tipo', html`<select name="type">${options(TYPES, ty)}</select>`, 'full')}${field('Título', html`<input name="title" value="${r?.title || ''}" maxlength="80" required placeholder="Ej.: Arriendo">`, 'full')}
      ${field('Importe', money('amount', r?.amount))}${field('Frecuencia', html`<select name="frequency">${options(Object.entries(FREQ), r?.frequency || 'monthly')}</select>`)}
      <div class="field hide" data-g="every"><label>Cada cuántos días</label><input type="number" min="1" name="everyDays" value="${r?.everyDays || 15}"></div>
      ${field('Fecha inicial', html`<input type="date" name="start" value="${r?.start || D.today()}" ${r ? raw('disabled') : ''}>`)}${r ? field('Próxima ejecución', html`<input type="date" name="next" value="${r.next}">`) : ''}
      ${field(html`<span data-acclabel>Cuenta</span>`, accountSelect('accountId', r?.accountId))}<div class="field" data-g="to"><label>Cuenta destino</label>${accountSelect('toAccountId', r?.toAccountId, { ph: 'Selecciona…' })}</div>
      <div class="field" data-g="debt"><label>Deuda</label><select name="debtId">${options(s.debts.filter((d) => d.direction === 'payable').map((d) => [d.id, `${d.person} · ${fm(debtState(s, d).remaining)}`]), r?.debtId, 'Selecciona…')}</select></div>
      <div class="full" data-g="cat">${catFields(ty === 'income' ? 'income' : 'expense', r?.categoryId, r?.subId)}</div></div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="rf">Guardar</button>`,
    onMount: (mm) => { const f = mm.$('#rf'), sync = () => { const t = f.type.value; mm.$('[data-g=every]').classList.toggle('hide', f.frequency.value !== 'custom'); mm.$('[data-g=to]').classList.toggle('hide', t !== 'transfer'); mm.$('[data-g=debt]').classList.toggle('hide', t !== 'debt_payment'); mm.$('[data-g=cat]').classList.toggle('hide', t === 'transfer' || t === 'debt_payment'); mm.$('[data-g=to] select').disabled = t !== 'transfer'; mm.$('[data-g=debt] select').disabled = t !== 'debt_payment'; };
      f.type.addEventListener('change', sync); f.frequency.addEventListener('change', sync); sync();
      f.addEventListener('submit', async (e) => { e.preventDefault(); const d = fdata(f), err = mm.$('[data-err]'), amount = cents(d.amount); if (!Number.isFinite(amount)) return (err.textContent = 'Importe no válido.');
        const input = { type: d.type, title: d.title, amount, frequency: d.frequency, everyDays: Number(d.everyDays) || null, accountId: d.accountId, toAccountId: d.type === 'transfer' ? d.toAccountId || null : null, debtId: d.type === 'debt_payment' ? d.debtId || null : null, categoryId: d.categoryId || null, subId: d.subId || null };
        if (!r) input.start = d.start; else input.next = d.next;
        const res = await run((st) => saveRecurring(st, input, r?.id)); if (!res.ok) return (err.textContent = res.error); mm.close(); toast('Guardada. Te la propondré cuando llegue su fecha.', 'ok'); }); } });
}
function confirmForm(id) {
  const s = S(), r = s.recurrings.find((x) => x.id === id);
  modal({ title: `Confirmar: ${r.title}`, body: html`<form id="cf" novalidate><p class="small muted">Se registrará como movimiento real con fecha ${fd(r.next)} y se descontará/sumará en la cuenta.</p>${field('Importe real', money('amount', r.amount, 'class="amount"'))}<div class="fgrid">${field('Fecha', html`<input type="date" name="date" value="${r.next}">`)}${field('Cuenta', accountSelect('accountId', r.accountId))}</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="cf">Confirmar y registrar</button>`,
    onMount: (mm) => mm.$('#cf').addEventListener('submit', async (e) => { e.preventDefault(); const d = fdata(mm.$('#cf')), amount = cents(d.amount), err = mm.$('[data-err]'); if (!Number.isFinite(amount)) return (err.textContent = 'Importe no válido.');
      const ov = { amount, date: d.date, accountId: d.accountId }; let res = await run((st) => confirmRecurrence(st, id, ov)); if (res.needsConfirm) { if (!await confirmBox({ title: 'Revisa', message: res.warnings.join(' '), ok: 'Continuar' })) return; res = await run((st) => confirmRecurrence(st, id, ov, { acceptWarnings: true })); }
      if (!res.ok) return (err.textContent = res.error); mm.close(); toast('Movimiento registrado.', 'ok'); announceBudgets(); }) });
}
actions['rec-new'] = () => form(); actions['rec-edit'] = (el) => form(el.dataset.id); actions['rec-confirm'] = (el) => confirmForm(el.dataset.id);
actions['rec-skip'] = async (el) => { if (!await confirmBox({ title: 'Omitir', message: 'Se saltará esta ocurrencia sin registrar ningún movimiento.', ok: 'Omitir' })) return; const r = await run((s) => skipRecurrence(s, el.dataset.id)); r.ok ? toast('Omitida.') : toast(r.error, 'bad'); };
actions['rec-toggle'] = async (el) => { const r = S().recurrings.find((x) => x.id === el.dataset.id); await run((s) => saveRecurring(s, { active: !r.active }, r.id)); };
actions['rec-del'] = async (el) => { if (!await confirmBox({ title: 'Eliminar recurrente', message: 'No afecta movimientos ya registrados.', ok: 'Eliminar', danger: true })) return; const r = await run((s) => deleteGeneric(s, 'recurrings', el.dataset.id)); r.ok ? toast('Eliminada.', 'ok') : toast(r.error, 'bad'); };
