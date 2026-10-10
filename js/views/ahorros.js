import { html, raw, S, fm, fd, D, empty, modal, toast, confirmBox, fdata, money, cents, options, field, actions, accName, accountSelect, accIcon, ui } from '../ui/kit.js';
import { run } from '../data/store.js';
import { saveGoal, saveTransaction, deleteGeneric } from '../core/engine.js';
import { goalState, savingsTotal, totals } from '../core/ledger.js';
import { announceBudgets } from '../alerts.js';

let showArch = false;
export function render() {
  const s = S(), today = D.today(), t = totals(s, today), list = s.goals.filter((g) => !g.archived || showArch).map((g) => ({ g, st: goalState(s, g) }));
  const res = list.reduce((a, x) => a + x.st.reserved, 0), sep = list.reduce((a, x) => a + x.st.separated, 0);
  return html`<div class="top"><div class="title"><h1>Ahorros y objetivos</h1><small>Reservar saldo no duplica tu dinero; moverlo a otra cuenta es una transferencia interna</small></div><div class="tools"><button class="btn primary" data-act="goal-new">+ Nuevo objetivo</button></div></div>
  <div class="grid g4 stats" style="margin-bottom:14px"><div class="card stat"><div class="lbl">🐷 Ahorros acumulados</div><div class="val num pos">${fm(savingsTotal(s, today))}</div></div><div class="card stat"><div class="lbl">Reservado (en tus cuentas)</div><div class="val num">${fm(res)}</div></div><div class="card stat"><div class="lbl">Separado en otra cuenta</div><div class="val num">${fm(sep)}</div></div><div class="card stat"><div class="lbl">Bolsillos de ahorro</div><div class="val num">${fm(t.pocket)}</div></div></div>
  ${list.length ? html`<div class="grid auto-l">${list.map(({ g, st }) => html`<div class="card" style="${g.archived ? 'opacity:.6' : ''}"><div class="row between"><div class="bold">🎯 ${g.name}</div>${g.archived ? html`<span class="chip mute">Archivado</span>` : st.pct >= 100 ? html`<span class="chip pos">¡Logrado!</span>` : ''}</div>
    <div class="row between" style="margin:10px 0 4px"><span class="num bold" style="font-size:1.35rem">${fm(st.saved)}</span><span class="small muted">meta ${fm(g.target)}</span></div><div class="bar pos"><i style="width:${st.pct}%"></i></div>
    <div class="small muted" style="margin-top:6px">${st.pct} % · faltan ${fm(Math.max(0, g.target - st.saved))}${g.deadline ? ` · fecha límite ${fd(g.deadline)}${D.diffDays(g.deadline, D.today()) > 0 && st.saved < g.target ? ` (≈ ${fm(Math.ceil((g.target - st.saved) / Math.max(1, D.diffDays(g.deadline, D.today()) / 30)))}/mes)` : ''}` : ''}</div>
    <div class="small muted">Reservado ${fm(st.reserved)} · Separado ${fm(st.separated)}${g.accountId ? ' · cuenta ' + accName(g.accountId) : ''}</div>
    <div class="row wrap" style="margin-top:10px;gap:6px">${g.archived ? '' : html`<button class="btn sm pos" data-act="goal-move" data-id="${g.id}" data-dir="in">+ Aportar</button><button class="btn sm" data-act="goal-move" data-id="${g.id}" data-dir="out">− Retirar</button>`}<button class="btn sm" data-act="goal-hist" data-id="${g.id}">Historial (${st.history.length})</button><button class="btn sm" data-act="goal-edit" data-id="${g.id}">Editar</button><button class="btn sm ghost" data-act="goal-arch" data-id="${g.id}">${g.archived ? 'Reactivar' : 'Archivar'}</button>${st.history.length ? '' : html`<button class="btn sm ghost" data-act="goal-del" data-id="${g.id}">Eliminar</button>`}</div></div>`)}</div>` : html`<div class="card">${empty('🐷', 'Crea objetivos: fondo de emergencia, computador, vehículo, vacaciones…', html`<p style="margin-top:12px"><button class="btn primary" data-act="goal-new">Crear objetivo</button></p>`)}</div>`}
  ${s.goals.some((g) => g.archived) ? html`<p style="margin-top:14px"><button class="btn ghost sm" data-act="goal-showarch">${showArch ? 'Ocultar' : 'Mostrar'} archivados</button></p>` : ''}`;
}
function form(id) {
  const s = S(), g = id ? s.goals.find((x) => x.id === id) : null;
  modal({ title: g ? 'Editar objetivo' : 'Nuevo objetivo', dismiss: false,
    body: html`<form id="gf" novalidate>${field('Nombre', html`<input name="name" value="${g?.name || ''}" maxlength="60" required placeholder="Ej.: Comprar un computador">`)}${field('Importe objetivo', money('target', g?.target, 'class="amount"'))}<div class="fgrid">${field('Fecha límite (opcional)', html`<input type="date" name="deadline" value="${g?.deadline || ''}">`)}${field('Cuenta asociada (opcional)', accountSelect('accountId', g?.accountId, { ph: 'Ninguna' }))}</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="gf">Guardar</button>`,
    onMount: (mm) => mm.$('#gf').addEventListener('submit', async (e) => { e.preventDefault(); const d = fdata(mm.$('#gf')), target = cents(d.target); if (!Number.isFinite(target)) return (mm.$('[data-err]').textContent = 'Importe no válido.');
      const r = await run((st) => saveGoal(st, { name: d.name, target, deadline: d.deadline || null, accountId: d.accountId || null }, g?.id)); if (!r.ok) return (mm.$('[data-err]').textContent = r.error); mm.close(); toast('Objetivo guardado.', 'ok'); }) });
}
function move(id, dir) {
  const s = S(), g = s.goals.find((x) => x.id === id), t = D.nowParts(), inn = dir === 'in', st = goalState(s, g);
  modal({ title: `${inn ? 'Aportar a' : 'Retirar de'} ${g.name}`,
    body: html`<form id="mf" novalidate>${field('Importe', money('amount', 0, 'class="amount"'))}
      <div class="field"><label>${inn ? 'Cuenta de la que sale el ahorro' : 'Cuenta que recibe el dinero'}</label>${accountSelect('accountId', g.accountId || s.accounts.find((a) => !a.archived && a.type !== 'credit')?.id, { noCredit: true })}</div>
      <div class="field"><label>¿Cómo se guarda?</label><select name="mode"><option value="reserve">Solo reservar (el dinero sigue en la misma cuenta)</option><option value="move">Mover a otra cuenta propia (transferencia interna)</option></select></div>
      <div class="field hide" data-other><label>${inn ? 'Cuenta de ahorro destino' : 'Cuenta de ahorro de origen'}</label>${accountSelect('other', null, { noCredit: true, ph: 'Selecciona…' })}</div><div class="fgrid">${field('Fecha', html`<input type="date" name="date" value="${t.date}">`)}${field('Hora', html`<input type="time" name="time" value="${t.time}">`)}</div>
      ${inn ? '' : html`<div class="hint">Reservado ${fm(st.reserved)} · Separado ${fm(st.separated)}</div>`}<div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="mf">Guardar</button>`,
    onMount: (mm) => { const f = mm.$('#mf'); f.mode.addEventListener('change', () => mm.$('[data-other]').classList.toggle('hide', f.mode.value !== 'move'));
      f.addEventListener('submit', async (e) => { e.preventDefault(); const d = fdata(f), err = mm.$('[data-err]'), amount = cents(d.amount); if (!Number.isFinite(amount) || amount <= 0) return (err.textContent = 'Escribe un importe válido.');
        if (!inn && amount > (d.mode === 'move' ? st.separated : st.reserved)) return (err.textContent = `No puedes retirar más de lo ${d.mode === 'move' ? 'separado' : 'reservado'} (${fm(d.mode === 'move' ? st.separated : st.reserved)}).`);
        let a = d.accountId, to = null; if (d.mode === 'move') { if (!d.other) return (err.textContent = 'Selecciona la otra cuenta.'); to = inn ? d.other : d.accountId; a = inn ? d.accountId : d.other; }
        const input = { type: 'saving', goalId: id, direction: dir, amount, accountId: a, toAccountId: to, date: d.date, time: d.time, description: `${inn ? 'Aporte a' : 'Retiro de'} ${g.name}` };
        let r = await run((s2) => saveTransaction(s2, input)); if (r.needsConfirm) { if (!await confirmBox({ title: 'Revisa', message: r.warnings.join(' '), ok: 'Continuar' })) return; r = await run((s2) => saveTransaction(s2, input, { acceptWarnings: true })); }
        if (!r.ok) return (err.textContent = r.error); mm.close(); toast(inn ? 'Aporte registrado.' : 'Retiro registrado.', 'ok'); }); } });
}
actions['goal-new'] = () => form(); actions['goal-edit'] = (el) => form(el.dataset.id); actions['goal-move'] = (el) => move(el.dataset.id, el.dataset.dir);
actions['goal-showarch'] = () => { showArch = !showArch; ui.render(); };
actions['goal-arch'] = async (el) => { const g = S().goals.find((x) => x.id === el.dataset.id); const r = await run((s) => saveGoal(s, { archived: !g.archived }, g.id)); r.ok ? toast(g.archived ? 'Objetivo reactivado.' : 'Objetivo archivado.', 'ok') : toast(r.error, 'bad'); };
actions['goal-del'] = async (el) => { if (!await confirmBox({ title: 'Eliminar objetivo', message: '¿Eliminar este objetivo?', ok: 'Eliminar', danger: true })) return; const r = await run((s) => deleteGeneric(s, 'goals', el.dataset.id)); r.ok ? toast('Eliminado.', 'ok') : toast(r.error, 'bad'); };
actions['goal-hist'] = (el) => { const s = S(), g = s.goals.find((x) => x.id === el.dataset.id), st = goalState(s, g); modal({ title: `Historial · ${g.name}`, body: st.history.length ? html`<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cuenta</th><th class="r">Importe</th></tr></thead><tbody>${[...st.history].reverse().map((t) => html`<tr><td>${fd(t.date)}</td><td>${t.direction === 'out' ? 'Retiro' : 'Aporte'} ${t.toAccountId ? '(separado)' : '(reservado)'}</td><td>${accName(t.accountId)}${t.toAccountId ? ' → ' + accName(t.toAccountId) : ''}</td><td class="r num ${t.direction === 'out' ? 'neg' : 'pos'}">${t.direction === 'out' ? '−' : '+'}${fm(t.amount)}</td></tr>`)}</tbody></table>` : html`<div class="empty small">Sin aportes todavía.</div>` }); };
