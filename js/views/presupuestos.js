import { html, raw, S, fm, fd, D, empty, modal, toast, confirmBox, fdata, money, cents, options, field, actions, catById } from '../ui/kit.js';
import { run } from '../data/store.js';
import { saveBudget, deleteGeneric } from '../core/engine.js';
import { budgetStatus, summarize } from '../core/ledger.js';
import { budgetName } from '../alerts.js';

const PL = { monthly: 'Mensual', weekly: 'Semanal', custom: 'Personalizado' };
export function render() {
  const s = S(), today = D.today(), ws = s.settings.weekStart, ths = s.settings.budgetThresholds;
  const rows = s.budgets.map((b) => ({ b, st: budgetStatus(s, b, today, ws) })).sort((a, b) => b.st.pct - a.st.pct);
  const mon = summarize(s, D.periodRange('month', today)), budgeted = new Set(s.budgets.filter((b) => b.period === 'monthly').map((b) => b.categoryId));
  const free = Object.entries(mon.byCategory).filter(([id, v]) => v > 0 && id !== '_' && !budgeted.has(id)).sort((a, b) => b[1] - a[1]);
  return html`<div class="top"><div class="title"><h1>Presupuestos</h1><small>Límites por categoría y periodo · alertas al ${ths.join(' %, ')} % (<a href="#/configuracion">configurar</a>)</small></div><div class="tools"><button class="btn primary" data-act="bud-new">+ Nuevo presupuesto</button></div></div>
  ${rows.length ? html`<div class="grid auto-l">${rows.map(({ b, st }) => { const reached = ths.filter((t) => st.pct >= t).pop(), cls = st.pct >= 100 ? 'neg' : st.pct >= 75 ? 'warn' : '', cat = catById(b.categoryId), diff = st.prev != null ? st.spent - st.prev : null;
    return html`<div class="card"><div class="row between"><div class="row"><div class="dot" style="background:${cat?.color || 'var(--accent)'}22">${cat?.icon || '🎯'}</div><div><div class="bold">${budgetName(b)}</div><div class="small muted">${PL[b.period]} · ${fd(st.range.from)} – ${fd(st.range.to)}</div></div></div>${reached ? html`<span class="chip ${reached >= 90 ? 'neg' : 'warn'}">${reached} %</span>` : ''}</div>
    <div class="row between" style="margin:12px 0 4px"><span class="small muted">Gastado ${fm(st.spent)}</span><span class="small muted">de ${fm(b.amount)}</span></div><div class="bar ${cls}"><i style="width:${Math.min(100, st.pct)}%"></i></div>
    <div class="row between" style="margin-top:8px"><b class="num ${st.remaining < 0 ? 'neg' : 'pos'}">${st.remaining < 0 ? 'Excedido ' + fm(-st.remaining) : 'Disponible ' + fm(st.remaining)}</b><b class="num">${st.pct} %</b></div>
    ${diff != null ? html`<div class="small muted" style="margin-top:6px">Periodo anterior: ${fm(st.prev)} (${diff > 0 ? '▲ ' + fm(diff) + ' más' : diff < 0 ? '▼ ' + fm(-diff) + ' menos' : 'igual'})</div>` : ''}
    <div class="row" style="margin-top:10px;gap:6px"><button class="btn sm" data-act="bud-edit" data-id="${b.id}">Editar</button><button class="btn sm ghost" data-act="bud-del" data-id="${b.id}">Eliminar</button></div></div>`; })}</div>` : html`<div class="card">${empty('🎯', 'Define cuánto quieres gastar al mes en cada categoría. Todos los importes son tuyos y se pueden cambiar.', html`<p style="margin-top:12px"><button class="btn primary" data-act="bud-new">Crear presupuesto</button></p>`)}</div>`}
  ${free.length ? html`<div class="card" style="margin-top:14px"><h2>Gastas en estas categorías sin presupuesto</h2><div class="list">${free.slice(0, 6).map(([id, v]) => html`<div class="item"><span>${catById(id)?.icon}</span><div class="grow">${catById(id)?.name}</div><b class="num">${fm(v)}</b><button class="btn sm" data-act="bud-new" data-cat="${id}" data-amount="${v}">Presupuestar</button></div>`)}</div></div>` : ''}`;
}
function form(id, pre = {}) {
  const s = S(), b = id ? s.budgets.find((x) => x.id === id) : null, cats = s.categories.filter((c) => c.kind !== 'income');
  modal({
    title: b ? 'Editar presupuesto' : 'Nuevo presupuesto', dismiss: false,
    body: html`<form id="bf" novalidate>${field('Categoría', html`<select name="categoryId">${options(cats.map((c) => [c.id, `${c.icon} ${c.name}`]), b?.categoryId ?? pre.cat, '🎯 Todos los gastos (presupuesto total)')}</select>`)}
      ${field('Importe', money('amount', b?.amount ?? (pre.amount ? Math.ceil(pre.amount / 5000000) * 5000000 : 0), 'class="amount"'))}${field('Periodo', html`<select name="period">${options(Object.entries(PL), b?.period || 'monthly')}</select>`)}
      <div class="fgrid hide" data-custom>${field('Desde', html`<input type="date" name="start" value="${b?.start || D.today()}">`)}${field('Hasta', html`<input type="date" name="end" value="${b?.end || D.addDays(D.today(), 30)}">`)}</div><div class="err" data-err role="alert"></div></form>`,
    footer: html`<button class="btn" data-close>Cancelar</button><button class="btn primary" type="submit" form="bf">Guardar</button>`,
    onMount: (mm) => {
      const f = mm.$('#bf'), sync = () => mm.$('[data-custom]').classList.toggle('hide', f.period.value !== 'custom'); f.period.addEventListener('change', sync); sync();
      f.addEventListener('submit', async (e) => { e.preventDefault(); const d = fdata(f), amount = cents(d.amount); if (!Number.isFinite(amount)) return (mm.$('[data-err]').textContent = 'Importe no válido.');
        const r = await run((st) => saveBudget(st, { categoryId: d.categoryId || null, amount, period: d.period, start: d.start, end: d.end }, b?.id)); if (!r.ok) return (mm.$('[data-err]').textContent = r.error); mm.close(); toast('Presupuesto guardado.', 'ok'); });
    },
  });
}
actions['bud-new'] = (el) => form(null, { cat: el?.dataset?.cat, amount: Number(el?.dataset?.amount) || 0 });
actions['bud-edit'] = (el) => form(el.dataset.id);
actions['bud-del'] = async (el) => { if (!await confirmBox({ title: 'Eliminar presupuesto', message: '¿Eliminar este presupuesto? Tus movimientos no se tocan.', ok: 'Eliminar', danger: true })) return; const r = await run((s) => deleteGeneric(s, 'budgets', el.dataset.id)); r.ok ? toast('Eliminado.', 'ok') : toast(r.error, 'bad'); };
