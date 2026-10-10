// Formulario único de movimientos (crear/editar) y vista de detalle.
import { html, raw, esc, str, S, fm, fd, D, toast, modal, confirmBox, money, cents, fdata, options, accountSelect, catFields, accName, catLabel, actions, forms, accById, field, centsToInput } from './kit.js';
import { store, run } from '../data/store.js';
import { saveTransaction, deleteTransaction, voidTransaction } from '../core/engine.js';
import { debtState, prep, isLive } from '../core/ledger.js';
import { TX_TYPES, TX_STATUS } from '../core/defaults.js';
import { txIcon, txTitle } from './rows.js';
import { announceBudgets } from '../alerts.js';

const ORDER = ['expense', 'income', 'transfer', 'loan_given', 'loan_received', 'debt_payment', 'debt_collection', 'saving', 'investment', 'fee', 'refund', 'adjustment'];
const ACC_LABEL = { income: 'Cuenta que recibe', expense: 'Cuenta usada', transfer: 'Cuenta de origen', loan_given: 'Cuenta de la que sale', loan_received: 'Cuenta que recibe', debt_payment: 'Cuenta con la que pagas', debt_collection: 'Cuenta que recibe', saving: 'Cuenta de origen', investment: 'Cuenta', fee: 'Cuenta cobrada', refund: 'Cuenta que recibe', adjustment: 'Cuenta a ajustar' };
const show = {
  cat_inc: ['income'], cat_exp: ['expense', 'fee'], to: ['transfer'], fee: ['transfer', 'debt_payment', 'debt_collection', 'loan_given'], party: ['income', 'expense', 'loan_given', 'loan_received', 'debt_payment', 'debt_collection', 'refund'],
  due: ['loan_given', 'loan_received'], debt: ['debt_payment', 'debt_collection'], interest: ['debt_payment', 'debt_collection'], goal: ['saving'], dir: ['saving', 'investment'], sav_to: ['saving'], ref: ['refund'], adj: ['adjustment'],
};

export function openTxForm({ id, type, date, prefill = {} } = {}) {
  const s = S(), prev = id ? s.transactions.find((t) => t.id === id) : null;
  const t = { ...(prev || {}), ...(prev ? {} : prefill) };
  const cur = prev?.type || type || 'expense', np = D.nowParts();
  if (!s.accounts.some((a) => !a.archived)) { toast('Primero crea una cuenta en "Mis cuentas".', 'warn'); location.hash = '#/cuentas'; return; }
  const live = s.accounts.filter((a) => !a.archived);
  const debts = s.debts.map((d) => ({ d, st: debtState(s, d) })).filter((x) => x.st.remaining > 0 || x.d.id === t.debtId);
  const expenses = prep(s).txs.filter((x) => x.type === 'expense' && isLive(x)).slice(-80).reverse();
  const m = modal({
    title: prev ? 'Editar movimiento' : 'Nuevo movimiento', dismiss: false, wide: true,
    body: html`<form id="txf" novalidate>
      <div class="typegrid" role="radiogroup" aria-label="Tipo de movimiento">${ORDER.map((k) => html`<button type="button" data-type="${k}" role="radio" aria-checked="false" ${prev && ['loan_given', 'loan_received'].includes(prev.type) && prev.type !== k ? raw('disabled') : ''}>${TX_TYPES[k].short}</button>`)}</div>
      <input type="hidden" name="type" value="${cur}">
      <div class="field"><label>Importe</label>${money('amount', t.amount, 'class="amount" required aria-label="Importe en pesos"')}<div class="hint" data-hint></div></div>
      <div class="fgrid">
        ${field('Fecha', html`<input type="date" name="date" value="${t.date || date || np.date}" required>`)}
        ${field('Hora', html`<input type="time" name="time" value="${t.time || np.time}" required>`)}
        ${field(html`<span data-acclabel>Cuenta</span>`, accountSelect('accountId', t.accountId || live[0]?.id, { includeArchivedId: t.accountId }))}
        <div class="field" data-g="to">${raw(`<label>Cuenta de destino</label>`)}${accountSelect('toAccountId', t.toAccountId, { exclude: undefined, ph: 'Selecciona…' })}</div>
        <div class="full" data-g="cat_exp">${catFields('expense', t.categoryId, t.subId)}</div>
        <div class="full" data-g="cat_inc">${catFields('income', t.categoryId, t.subId)}</div>
        <div class="field full" data-g="debt"><label>Deuda o préstamo</label><select name="debtId">${options(debts.map(({ d, st }) => [d.id, `${d.direction === 'payable' ? 'Debo a' : 'Me debe'} ${d.person} · pendiente ${fm(st.remaining)}`]), t.debtId, 'Selecciona…')}</select></div>
        <div class="field" data-g="interest"><label>Intereses del abono <span class="muted">(opcional)</span></label>${money('interest', t.interest)}</div>
        <div class="field" data-g="fee"><label>Comisión <span class="muted">(opcional, se registra como gasto)</span></label>${money('fee', t.fee)}</div>
        <div class="field full" data-g="goal"><label>Objetivo de ahorro</label><select name="goalId">${options(s.goals.filter((g) => !g.archived || g.id === t.goalId).map((g) => [g.id, g.name]), t.goalId, 'Selecciona…')}</select>${s.goals.length ? '' : html`<div class="hint">Crea primero un objetivo en "Ahorros".</div>`}</div>
        <div class="field" data-g="dir"><label>Sentido</label><select name="direction"><option value="in" ${t.direction !== 'out' ? raw('selected') : ''}>Aportar / invertir</option><option value="out" ${t.direction === 'out' ? raw('selected') : ''}>Retirar / recuperar</option></select></div>
        <div class="field" data-g="sav_to"><label>Mover a otra cuenta propia <span class="muted">(opcional)</span></label>${accountSelect('toAccountId', t.toAccountId, { ph: 'No, solo reservar saldo' })}<div class="hint">Si eliges cuenta, se crea una transferencia interna; si no, solo se reserva sin duplicar tu dinero.</div></div>
        <div class="field" data-g="party"><label data-partylabel>Persona o entidad</label><input name="party" value="${t.party || ''}" maxlength="80"></div>
        <div class="field" data-g="due"><label>Fecha de vencimiento <span class="muted">(opcional)</span></label><input type="date" name="due" value="${(prev && s.debts.find((d) => d.id === prev.debtId)?.due) || ''}"></div>
        <div class="field full" data-g="ref"><label>Gasto original que se reembolsa <span class="muted">(recomendado)</span></label><select name="refId">${options(expenses.map((x) => [x.id, `${fd(x.date)} · ${txTitle(x)} · ${fm(x.amount)}`]), t.refId, 'Sin relacionar (cuenta como ingreso)')}</select></div>
        <div class="field" data-g="adj"><label>El ajuste…</label><select name="adjustDir"><option value="+" ${t.adjustDir !== '-' ? raw('selected') : ''}>Suma al saldo</option><option value="-" ${t.adjustDir === '-' ? raw('selected') : ''}>Resta del saldo</option></select></div>
        <div class="field full" data-g="adj"><label>Motivo del ajuste (obligatorio)</label><input name="reason" value="${t.reason || ''}" maxlength="120" placeholder="Ej.: diferencia al contar el efectivo"></div>
        <div class="field full"><label>Descripción</label><input name="description" value="${t.description || ''}" maxlength="120" placeholder="¿En qué fue?"></div>
        <div class="field"><label>Etiquetas <span class="muted">(separadas por coma)</span></label><input name="tags" value="${(t.tags || []).join(', ')}"></div>
        <div class="field"><label>Estado</label><select name="status">${options([['confirmado', 'Confirmado'], ['por_verificar', 'Por verificar']], t.status === 'por_verificar' ? 'por_verificar' : 'confirmado')}</select></div>
        <div class="field full"><label>Notas</label><textarea name="notes" maxlength="500">${t.notes || ''}</textarea></div>
        <div class="field full"><label>Comprobante <span class="muted">(imagen o PDF, máx. 1,5 MB)</span></label><input type="file" name="file" accept="image/*,application/pdf">${t.attachment ? html`<div class="hint">Actual: ${t.attachment.name} <label style="display:inline"><input type="checkbox" name="rmfile"> quitar</label></div>` : ''}</div>
      </div><div class="err" role="alert" data-err></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" form="txf" type="submit" data-save>${prev ? 'Guardar cambios' : 'Guardar movimiento'}</button>`,
    onMount: (mm) => bind(mm, prev),
  });
  return m;
}

function bind(m, prev) {
  const f = m.$('#txf'), err = m.$('[data-err]');
  const setType = (ty) => {
    f.type.value = ty;
    f.querySelectorAll('[data-type]').forEach((b) => { const on = b.dataset.type === ty; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    for (const [g, types] of Object.entries(show)) f.querySelectorAll(`[data-g="${g.replace('cat_inc', 'cat_inc').replace('sav_to', 'sav_to')}"]`).forEach((el) => {
      const ok = types.includes(ty); el.classList.toggle('hide', !ok); el.querySelectorAll('input,select,textarea').forEach((i) => { i.disabled = !ok; });
    });
    f.querySelector('[data-acclabel]').textContent = ACC_LABEL[ty];
    f.querySelector('[data-partylabel]').textContent = ['loan_given', 'loan_received'].includes(ty) ? 'Persona o entidad (obligatorio)' : 'Persona o entidad (opcional)';
    const hint = { transfer: 'Mover dinero entre tus cuentas no es ingreso ni gasto.', loan_given: 'Se descuenta de la cuenta y queda como dinero por cobrar (no es gasto).', loan_received: 'Entra dinero a tu cuenta y queda como deuda (no es ingreso).', debt_payment: 'Reduce la deuda; solo los intereses cuentan como gasto.', debt_collection: 'Reduce lo que te deben; el capital no es ingreso.', saving: 'Ahorrar entre cuentas propias no es gasto.', investment: 'Una inversión es un activo, no un gasto de consumo.', adjustment: 'No cuenta como ingreso ni gasto; queda identificado con su motivo.', expense: 'Con tarjeta de crédito aumenta la deuda de la tarjeta, no baja tu banco.' }[ty] || '';
    f.querySelector('[data-hint]').textContent = hint;
    // un abono/cobro solo lista deudas del sentido correcto
    const ds = f.debtId; if (ds && (ty === 'debt_payment' || ty === 'debt_collection')) for (const o of ds.options) { const d = S().debts.find((x) => x.id === o.value); if (d) o.hidden = (ty === 'debt_payment') !== (d.direction === 'payable'); }
    // selects duplicados toAccountId: solo el de la sección visible queda habilitado (ver disabled arriba)
  };
  f.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => setType(b.dataset.type)));
  setType(f.type.value);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const d = fdata(f), btn = m.$('[data-save]'); btn.disabled = true;
    try {
      const amount = cents(d.amount);
      if (!Number.isFinite(amount) || amount <= 0) { err.textContent = 'Escribe un importe válido mayor que cero.'; return; }
      const input = { ...d, amount, fee: cents(d.fee), interest: cents(d.interest) };
      for (const k of ['fee', 'interest']) if (!Number.isFinite(input[k])) { err.textContent = 'Revisa los importes de comisión o intereses.'; return; }
      delete input.file; delete input.rmfile; delete input.due;
      input.tags = d.tags;
      if (d.rmfile) input.attachment = null;
      const file = f.file?.files?.[0];
      if (file) {
        if (file.size > 1.5 * 1024 * 1024) { err.textContent = 'El comprobante supera 1,5 MB.'; return; }
        input.attachment = { name: file.name, type: file.type, data: await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(file); }) };
      }
      if (input.type !== 'adjustment') { delete input.adjustDir; delete input.reason; }
      if (!['saving', 'investment'].includes(input.type)) delete input.direction;
      if (input.type === 'saving' && !input.toAccountId) input.toAccountId = null;
      const opts = { id: prev?.id, due: d.due || null };
      let res = await run((s) => saveTransaction(s, input, opts));
      if (res.needsConfirm) {
        const ok = await confirmBox({ title: 'Revisa este movimiento', message: res.warnings.join(' ') + ' ¿Quieres guardarlo de todas formas?', ok: 'Guardar de todas formas' });
        if (!ok) return;
        res = await run((s) => saveTransaction(s, input, { ...opts, acceptWarnings: true }));
      }
      if (!res.ok) { err.textContent = res.error; return; }
      m.close(); toast(prev ? 'Movimiento actualizado.' : 'Movimiento registrado.', 'ok');
      if (res.reopened) toast('El día estaba revisado; vuelve a "Registro en progreso" hasta que lo confirmes.', 'warn', 5500);
      announceBudgets();
    } finally { btn.disabled = false; }
  });
}

export function openTxDetail(id) {
  const s = S(), t = s.transactions.find((x) => x.id === id); if (!t) return;
  const orig = t.refId && s.transactions.find((x) => x.id === t.refId), debt = t.debtId && s.debts.find((d) => d.id === t.debtId), pend = t.pendingId && s.pendings.find((p) => p.id === t.pendingId), goal = t.goalId && s.goals.find((g) => g.id === t.goalId);
  const row = (k, v) => (v || v === 0 ? html`<tr><th>${k}</th><td>${v}</td></tr>` : '');
  const m = modal({
    title: 'Detalle del movimiento', wide: true,
    body: html`<div class="row gap" style="margin-bottom:12px"><div class="dot" style="width:52px;height:52px;font-size:1.6rem">${txIcon(t)}</div><div class="grow"><div class="bold" style="font-size:1.1rem">${txTitle(t)}</div><div class="muted small">${TX_TYPES[t.type].label}</div></div><div class="num bold" style="font-size:1.4rem">${fm(t.amount)}</div></div>
    <div class="scroll"><table><tbody>
      ${row('Fecha y hora', `${fd(t.date)} ${t.time}`)}${row(t.type === 'transfer' ? 'Cuenta de origen' : 'Cuenta', accName(t.accountId))}${row('Cuenta de destino', t.toAccountId ? accName(t.toAccountId) : '')}
      ${row('Categoría', t.categoryId ? catLabel(t.categoryId, t.subId) : '')}${row('Persona / entidad', t.party)}${row('Comisión', t.fee ? fm(t.fee) : '')}${row('Intereses', t.interest ? fm(t.interest) : '')}
      ${row('Estado', TX_STATUS[t.status])}${row('Etiquetas', (t.tags || []).join(', '))}${row('Motivo del ajuste', t.reason)}${row('Notas', t.notes)}
      ${row('Reembolso de', orig ? `${txTitle(orig)} (${fm(orig.amount)})` : '')}${row('Deuda', debt ? `${debt.person}` : '')}${row('Pendiente', pend ? pend.title : '')}${row('Objetivo', goal ? goal.name : '')}
      ${row('Registrado', t.createdAt ? new Date(t.createdAt).toLocaleString('es-CO', { timeZone: S().settings.timezone }) : '')}${t.updatedAt ? row('Editado', new Date(t.updatedAt).toLocaleString('es-CO', { timeZone: S().settings.timezone })) : ''}
    </tbody></table></div>
    ${t.attachment ? (t.attachment.type.startsWith('image/') ? html`<p class="small muted" style="margin-top:10px">Comprobante</p><img src="${t.attachment.data}" alt="Comprobante" style="max-width:100%;border-radius:12px;margin-top:6px">` : html`<p style="margin-top:10px"><a href="${t.attachment.data}" download="${t.attachment.name}">📎 ${t.attachment.name}</a></p>`) : ''}`,
    footer: html`<button class="btn neg" data-del>Eliminar</button>${t.status === 'anulado' ? html`<button class="btn" data-void="0">Restaurar</button>` : html`<button class="btn" data-void="1">Anular</button>`}<button class="btn" data-dup>Duplicar</button><button class="btn primary" data-edit>Editar</button>`,
    onMount: (mm) => {
      mm.$('[data-edit]').onclick = () => { mm.close(); openTxForm({ id }); };
      mm.$('[data-dup]').onclick = () => { mm.close(); const { id: _i, createdAt, updatedAt, attachment, pendingId, ...rest } = t; openTxForm({ prefill: { ...rest, date: undefined, time: undefined } }); };
      mm.$('[data-void]').onclick = async (e) => { const v = e.currentTarget.dataset.void === '1'; if (!await confirmBox({ title: v ? 'Anular movimiento' : 'Restaurar', message: v ? 'El movimiento se conservará en el historial pero dejará de afectar saldos e informes.' : 'El movimiento volverá a afectar saldos e informes.', ok: v ? 'Anular' : 'Restaurar' })) return; const r = await run((st) => voidTransaction(st, id, v)); r.ok ? (mm.close(), toast(v ? 'Movimiento anulado.' : 'Movimiento restaurado.', 'ok')) : toast(r.error, 'bad'); };
      mm.$('[data-del]').onclick = async () => { if (!await confirmBox({ title: 'Eliminar movimiento', message: 'Se eliminará definitivamente y se revertirán sus efectos en saldos, presupuestos e informes. ¿Continuar?', ok: 'Eliminar', danger: true })) return; const r = await run((st) => deleteTransaction(st, id)); r.ok ? (mm.close(), toast('Movimiento eliminado.', 'ok')) : toast(r.error, 'bad'); };
    },
  });
}
actions['tx-new'] = (el) => openTxForm({ type: el.dataset.type, date: el.dataset.date });
actions['tx-open'] = (el) => openTxDetail(el.dataset.id);
