import { html, raw, S, fm, fd, D, icon, empty, modal, toast, confirmBox, fdata, money, cents, options, field, accIcon, actions, accById, ui } from '../ui/kit.js';
import { run } from '../data/store.js';
import { saveAccount, deleteAccount } from '../core/engine.js';
import { totals, prep, isLive } from '../core/ledger.js';
import { ACCOUNT_TYPES } from '../core/defaults.js';
import { openTxForm } from '../ui/txform.js';

const ENTITIES = ['Bancolombia', 'Nequi', 'Davivienda', 'Nu', 'BBVA', 'Daviplata', 'Banco de Bogotá', 'Banco Popular', 'AV Villas', 'Scotiabank Colpatria', 'Lulo Bank', 'RappiPay'];
const nextDay = (day, today) => { if (!day) return null; const [y, m] = today.split('-').map(Number); let d = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, D.daysInMonth(y, m))).padStart(2, '0')}`; if (d < today) d = D.addMonths(D.monthStart(today), 1, day); return d; };

function card(a, t, today) {
  const bal = t.balances[a.id] ?? 0, cr = a.type === 'credit', c = a.credit || {};
  const debt = -bal, avail = c.limit ? c.limit - debt : null, due = cr ? nextDay(c.dueDay, today) : null, cut = cr ? nextDay(c.cutDay, today) : null;
  const used = c.limit ? Math.min(100, Math.round((debt * 100) / c.limit)) : 0;
  return html`<div class="card" style="border-top:3px solid ${a.color || 'var(--accent)'};${a.archived ? 'opacity:.6' : ''}"><div class="row"><div class="dot" style="background:${a.color || 'var(--accent)'}22">${accIcon(a)}</div><div class="grow"><div class="bold">${a.name}</div><div class="small muted">${ACCOUNT_TYPES[a.type].label}${a.entity ? ' · ' + a.entity : ''}</div></div>${a.archived ? html`<span class="chip mute">Archivada</span>` : ''}</div>
  <div style="margin:12px 0 4px" class="small muted">${cr ? 'Deuda de la tarjeta' : 'Saldo actual'}</div><div class="num bold ${cr ? (debt > 0 ? 'neg' : '') : bal < 0 ? 'neg' : ''}" style="font-size:1.55rem">${fm(cr ? debt : bal)}</div>
  ${cr ? html`${c.limit ? html`<div class="bar ${used > 85 ? 'neg' : used > 60 ? 'warn' : ''}" style="margin:8px 0 4px"><i style="width:${Math.max(0, used)}%"></i></div><div class="small muted">Cupo total ${fm(c.limit)} · <b>Cupo disponible ${fm(avail)}</b> <span class="muted">(no es dinero tuyo)</span></div>` : html`<div class="hint">Configura el cupo para ver el disponible.</div>`}
    <div class="small muted" style="margin-top:6px">${cut ? `Corte: ${fd(cut)} · ` : ''}${due ? `Pago límite: ${fd(due)} (${D.diffDays(due, today)} d)` : ''}${c.minPayment ? ` · Pago mínimo ${fm(c.minPayment)}` : ''}</div>` : ''}
  ${a.notes ? html`<div class="small muted" style="margin-top:6px">📝 ${a.notes}</div>` : ''}
  <div class="row wrap" style="margin-top:12px;gap:6px"><a class="btn sm" href="#/historial?account=${a.id}">Movimientos</a>${a.archived ? html`<button class="btn sm" data-act="acc-restore" data-id="${a.id}">Reactivar</button>` : html`<button class="btn sm" data-act="acc-tr" data-id="${a.id}">${cr ? 'Pagar tarjeta' : 'Transferir'}</button><button class="btn sm" data-act="acc-edit" data-id="${a.id}">Editar</button><button class="btn sm ghost" data-act="acc-archive" data-id="${a.id}">Archivar</button>`}</div></div>`;
}
let showArch = false;
export function render() {
  const s = S(), today = D.today(), t = totals(s, today), live = s.accounts.filter((a) => !a.archived), arch = s.accounts.filter((a) => a.archived);
  return html`<div class="top"><div class="title"><h1>Mis cuentas</h1><small>Dinero propio, tarjetas y bolsillos</small></div><div class="tools"><button class="btn" data-act="tx-new" data-type="transfer">⇄ Transferir</button><button class="btn primary" data-act="acc-new">+ Nueva cuenta</button></div></div>
  <div class="grid g4 stats" style="margin-bottom:14px"><div class="card stat"><div class="lbl">Dinero propio total</div><div class="val num">${fm(t.own)}</div><div class="sub">Efectivo + bancos + bolsillos</div></div><div class="card stat"><div class="lbl">Efectivo</div><div class="val num">${fm(t.cash)}</div></div><div class="card stat"><div class="lbl">Bancos y billeteras</div><div class="val num">${fm(t.bank)}</div><div class="sub">Bolsillos: ${fm(t.pocket)}</div></div><div class="card stat"><div class="lbl">Deuda en tarjetas</div><div class="val num ${t.cardDebt ? 'neg' : ''}">${fm(t.cardDebt)}</div><div class="sub">${t.creditLimit ? 'Cupo disponible ' + fm(t.creditAvailable) : ''}</div></div></div>
  ${live.length ? html`<div class="grid auto-l">${live.map((a) => card(a, t, today))}</div>` : html`<div class="card">${empty('🏦', 'Crea tus cuentas: efectivo, Bancolombia, Nequi, tarjetas… sin límites ni listas fijas.', html`<p style="margin-top:12px"><button class="btn primary" data-act="acc-new">Crear cuenta</button></p>`)}</div>`}
  ${arch.length ? html`<p style="margin:18px 0 8px"><button class="btn ghost sm" data-act="acc-toggle-arch">${showArch ? 'Ocultar' : 'Mostrar'} cuentas archivadas (${arch.length})</button></p>${showArch ? html`<div class="grid auto-l">${arch.map((a) => card(a, t, today))}</div>` : ''}` : ''}`;
}

function form(id) {
  const s = S(), a = id ? accById(id) : null, today = D.today();
  const type = a?.type || 'savings', cr = a?.credit || {};
  const m = modal({
    title: a ? 'Editar cuenta' : 'Nueva cuenta', dismiss: false, wide: true,
    body: html`<form id="af" novalidate><div class="fgrid">
      ${field('Nombre personalizado', html`<input name="name" value="${a?.name || ''}" maxlength="50" required placeholder="Ej.: Nequi, Bancolombia ahorros">`)}
      ${field('Tipo de cuenta', html`<select name="type">${options(Object.entries(ACCOUNT_TYPES).map(([k, v]) => [k, `${v.icon} ${v.label}`]), type)}</select>`)}
      ${field('Banco o entidad', html`<input name="entity" list="ents" value="${a?.entity || ''}" maxlength="50" placeholder="Escribe o elige"><datalist id="ents">${ENTITIES.map((e) => html`<option value="${e}">`)}</datalist>`)}
      ${field(html`<span data-initlabel>Saldo inicial</span>`, money('initial', a ? Math.abs(a.initial) : 0), '')}
      ${field('Fecha de apertura del saldo', html`<input type="date" name="openDate" value="${a?.openDate || today}">`)}
      ${field('Color', html`<input type="color" name="color" value="${a?.color || '#7c5cff'}" style="padding:3px">`)}
      ${field('Icono (emoji, opcional)', html`<input name="icon" value="${a?.icon || ''}" maxlength="4" placeholder="${ACCOUNT_TYPES[type].icon}">`)}
      <div class="full" data-credit>
        <div class="fgrid">${field('Cupo total', money('limit', cr.limit))}${field('Pago mínimo (opcional)', money('minPayment', cr.minPayment))}
        ${field('Día de corte', html`<input type="number" min="1" max="31" name="cutDay" value="${cr.cutDay || ''}">`)}${field('Día límite de pago', html`<input type="number" min="1" max="31" name="dueDay" value="${cr.dueDay || ''}">`)}</div>
        <div class="hint">El cupo disponible nunca se suma a tu dinero. La deuda aumenta con cada compra y baja al pagar la tarjeta.</div></div>
      ${field('Notas', html`<textarea name="notes" maxlength="300">${a?.notes || ''}</textarea>`, 'full')}
    </div><div class="hint">🔒 Nunca ingreses contraseñas, PIN ni CVV. NEXORA es un registro manual: no se conecta a tu banco.</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`${a && !S().transactions.some((t) => t.accountId === a.id || t.toAccountId === a.id) ? html`<button class="btn neg" data-del style="margin-right:auto">Eliminar</button>` : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" form="af" type="submit">Guardar</button>`,
    onMount: (mm) => {
      const f = mm.$('#af'), sync = () => { const c = f.type.value === 'credit'; mm.$('[data-credit]').classList.toggle('hide', !c); mm.$('[data-initlabel]').textContent = c ? 'Deuda actual de la tarjeta' : 'Saldo inicial'; };
      f.type.addEventListener('change', sync); sync();
      mm.$('[data-del]')?.addEventListener('click', async () => { if (!await confirmBox({ title: 'Eliminar cuenta', message: `¿Eliminar "${a.name}"? No tiene movimientos.`, ok: 'Eliminar', danger: true })) return; const r = await run((st) => deleteAccount(st, a.id)); r.ok ? (mm.close(), toast('Cuenta eliminada.', 'ok')) : toast(r.error, 'bad'); });
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); const d = fdata(f), err = mm.$('[data-err]');
        const initial = d.initial ? cents(d.initial) : 0; if (!Number.isFinite(initial)) return (err.textContent = 'El saldo inicial no es válido.');
        const input = { name: d.name, type: d.type, entity: d.entity.trim(), initial: d.type === 'credit' ? -Math.abs(initial) : initial, openDate: d.openDate, color: d.color, icon: d.icon.trim() || undefined, notes: d.notes };
        if (d.type === 'credit') { const lim = d.limit ? cents(d.limit) : null, mp = d.minPayment ? cents(d.minPayment) : null; if (Number.isNaN(lim) || Number.isNaN(mp)) return (err.textContent = 'Revisa el cupo y el pago mínimo.'); input.credit = { limit: lim, minPayment: mp, cutDay: d.cutDay ? Number(d.cutDay) : null, dueDay: d.dueDay ? Number(d.dueDay) : null }; }
        if (d.type !== 'credit' && initial < 0) input.initial = initial;
        const r = await run((st) => saveAccount(st, input, a?.id));
        if (!r.ok) return (err.textContent = r.error); mm.close(); toast(a ? 'Cuenta actualizada.' : 'Cuenta creada.', 'ok');
      });
    },
  });
}
actions['acc-new'] = () => form();
actions['acc-edit'] = (el) => form(el.dataset.id);
actions['acc-tr'] = (el) => { const a = accById(el.dataset.id); a.type === 'credit' ? openTxForm({ type: 'transfer', prefill: { toAccountId: a.id, description: `Pago tarjeta ${a.name}` } }) : openTxForm({ type: 'transfer', prefill: { accountId: a.id } }); };
actions['acc-archive'] = async (el) => { const a = accById(el.dataset.id); if (!await confirmBox({ title: 'Archivar cuenta', message: `"${a.name}" dejará de aparecer en los formularios, pero conservará su historial. Su saldo debe ser cero.`, ok: 'Archivar' })) return; const r = await run((st) => saveAccount(st, { archived: true }, a.id)); r.ok ? toast('Cuenta archivada.', 'ok') : toast(r.error, 'bad', 6000); };
actions['acc-restore'] = async (el) => { const r = await run((st) => saveAccount(st, { archived: false }, el.dataset.id)); r.ok ? toast('Cuenta reactivada.', 'ok') : toast(r.error, 'bad'); };
actions['acc-toggle-arch'] = () => { showArch = !showArch; ui.render({ keepFocus: true }); };
