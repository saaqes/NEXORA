import { html, raw, S, fm, fd, D, empty, actions, changes, options, catById, accName, accIcon, ui, toast } from '../ui/kit.js';
import { summarize, totals, debtTotals, pendingState, budgetStatus, monthlySeries, balanceSeries, savingsTotal, netWorth, isLive } from '../core/ledger.js';
import { TX_TYPES, TX_STATUS } from '../core/defaults.js';
import { barChart, lineChart, donut } from '../ui/charts.js';
import { horizontal } from '../ui/logo.js';
import { toCSV, download } from '../lib/csv.js';
import { txList } from '../ui/rows.js';

const R = { kind: 'month', anchor: null, from: '', to: '', categoryId: '', accountId: '', type: '', status: '' };
const KINDS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año'], ['custom', 'Personalizado']];
const flt = () => ({ categoryId: R.categoryId || null, accountId: R.accountId || null, type: R.type || null, status: R.status || null });
function ranges() {
  const ws = S().settings.weekStart; R.anchor ||= D.today();
  if (R.kind === 'custom') { const from = R.from || D.monthStart(D.today()), to = R.to || D.today(), len = D.diffDays(to, from) + 1; return { cur: { from, to }, prev: { from: D.addDays(from, -len), to: D.addDays(from, -1) } }; }
  return { cur: D.periodRange(R.kind, R.anchor, ws), prev: D.prevRange(R.kind, R.anchor, ws) };
}
const title = (r) => ({ day: D.formatDateLong(r.from), week: `Semana del ${fd(r.from)} al ${fd(r.to)}`, month: D.monthLabel(r.from), year: `Año ${r.from.slice(0, 4)}`, custom: `${fd(r.from)} – ${fd(r.to)}` }[R.kind]);
const delta = (a, b, goodUp = true) => { if (!b) return html`<span class="muted">sin referencia</span>`; const p = Math.round(((a - b) * 100) / Math.abs(b)); if (!p) return html`<span class="muted">igual</span>`; const good = (p > 0) === goodUp; return html`<span class="${good ? 'pos' : 'neg'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)} %</span>`; };
const kpi = (l, v, cls, cmp) => html`<div class="card stat"><div class="lbl">${l}</div><div class="val num ${cls || ''}">${v}</div>${cmp ? html`<div class="sub">${cmp}</div>` : ''}</div>`;
const catRows = (m, prev) => Object.entries(m.byCategory).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ id, v, name: id === '_' ? 'Sin categoría' : catById(id)?.name || 'Eliminada', color: catById(id)?.color || '#94a3b8', icon: catById(id)?.icon || '•', prev: prev.byCategory[id] || 0 }));

export function compute() {
  const s = S(), { cur, prev } = ranges(), f = flt(), m = summarize(s, { ...cur, ...f }), p = summarize(s, { ...prev, ...f });
  return { s, cur, prev, m, p };
}
export function render() {
  const { s, cur, prev, m, p } = compute(), ws = s.settings.weekStart, cats = catRows(m, p), tot = totals(s, cur.to), nw = netWorth(s, cur.to);
  const dayList = D.eachDay(cur.from, cur.to);
  const dayKpis = (() => {
    if (R.kind === 'day') return html`${kpi('Transferencias', fm(m.transfers.total), 'info', `${m.transfers.count} movimiento(s) · no son ingreso ni gasto`)}${kpi('Pagos de deuda', fm(m.debtPaid), '', 'Capital abonado')}${kpi('Cobros de deuda', fm(m.debtCollected), 'pos', 'Capital cobrado')}${kpi('Saldo final del día', fm(tot.own), '', 'Dinero propio')}`;
    if (R.kind === 'week') { const worst = Object.entries(m.byDay).sort((a, b) => b[1].expense - a[1].expense)[0]; return html`${kpi('Promedio de gasto diario', fm(Math.round(m.expense / dayList.length)), 'neg', `${dayList.length} días`)}${kpi('Día con más gastos', worst && worst[1].expense ? D.WEEKDAYS[D.dow(worst[0])] + ' ' + Number(worst[0].slice(8)) : '—', '', worst ? fm(worst[1].expense) : '')}${kpi('Categoría con mayor gasto', cats[0]?.name || '—', '', cats[0] ? fm(cats[0].v) : '')}${kpi('Transferencias', fm(m.transfers.total), 'info', 'Excluidas del consumo')}`; }
    if (R.kind === 'year') { const ms = Array.from({ length: 12 }, (_, i) => summarize(s, { ...D.periodRange('month', `${cur.from.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`), ...flt() })); const mx = (k) => ms.reduce((b, x, i) => (x[k] > ms[b][k] ? i : b), 0); return html`${kpi('Mes con mayores gastos', ms[mx('expense')].expense ? D.MONTHS[mx('expense')] : '—', 'neg', fm(ms[mx('expense')].expense))}${kpi('Mes con mayores ingresos', ms[mx('income')].income ? D.MONTHS[mx('income')] : '—', 'pos', fm(ms[mx('income')].income))}${kpi('Promedio mensual de gasto', fm(Math.round(m.expense / 12)), 'neg')}${kpi('Patrimonio neto estimado', fm(nw.net), '', 'Al cierre del periodo')}`; }
    const bs = s.budgets.filter((b) => b.period === 'monthly').map((b) => budgetStatus(s, b, cur.from, ws)), bt = bs.reduce((a, x, i) => a + s.budgets.filter((b) => b.period === 'monthly')[i].amount, 0), bsp = bs.reduce((a, x) => a + x.spent, 0);
    const recv = debtTotals(s).receivable + s.pendings.map((x) => ({ x, st: pendingState(s, x) })).filter((y) => y.x.kind === 'receivable' && y.st.remaining > 0 && y.st.status !== 'cancelled').reduce((a, y) => a + y.st.remaining, 0);
    return html`${kpi('Ahorro neto', fm(m.net, { sign: true }), m.net >= 0 ? 'pos' : 'neg', `${m.savingsRate} % de los ingresos`)}${R.kind === 'month' ? kpi('Presupuesto utilizado', bt ? `${Math.round((bsp * 100) / bt)} %` : '—', '', bt ? `${fm(bsp)} de ${fm(bt)}` : 'Sin presupuestos mensuales') : kpi('Transferencias', fm(m.transfers.total), 'info')}${kpi('Deudas pagadas (capital)', fm(m.debtPaid))}${kpi('Cobros pendientes hoy', fm(recv), '', 'Préstamos y cobros por recibir')}`;
  })();
  const byDay = dayList.length <= 62;
  let chart = '';
  if (R.kind === 'year') {
    const y = cur.from.slice(0, 4), ser = monthlySeries(s, Number(y)), ms = ser.map((x, i) => summarize(s, { ...D.periodRange('month', `${y}-${String(i + 1).padStart(2, '0')}-01`), ...flt() }));
    chart = html`<div class="card"><h2>Evolución mes a mes</h2>${barChart({ labels: D.MONTHS_SHORT, series: [{ name: 'Ingresos', color: 'var(--pos)', values: ms.map((x) => x.income) }, { name: 'Gastos', color: 'var(--neg)', values: ms.map((x) => x.expense) }] })}</div>
    <div class="grid g2"><div class="card"><h2>Evolución de ahorros</h2>${lineChart({ labels: D.MONTHS_SHORT, values: ser.map((x) => x.savings), color: '#2fd593' })}</div><div class="card"><h2>Evolución de deudas</h2>${lineChart({ labels: D.MONTHS_SHORT, values: ser.map((x) => x.cardDebt + x.payable), color: '#ff5d73' })}</div></div>`;
  } else if (byDay && R.kind !== 'day') {
    chart = html`<div class="card"><h2>Ingresos y gastos por día</h2>${barChart({ labels: dayList.map((d) => (dayList.length > 12 ? (Number(d.slice(8)) % 5 === 1 ? String(Number(d.slice(8))) : '') : D.WD_SHORT[D.dow(d)] + Number(d.slice(8)))), series: [{ name: 'Ingresos', color: 'var(--pos)', values: dayList.map((d) => m.byDay[d]?.income || 0) }, { name: 'Gastos', color: 'var(--neg)', values: dayList.map((d) => m.byDay[d]?.expense || 0) }] })}</div>`;
  }
  const accRows = Object.entries(m.byAccount).sort((a, b) => b[1] - a[1]);
  return html`<div class="printhead">${raw(horizontal({ dark: false, id: 'nxp' }))}<div><h2 style="margin:0">Informe financiero</h2><div>${title(cur)}</div><div class="small">Generado ${fd(D.today())} · NEXORA</div></div></div>
  <div class="top noprint"><div class="title"><h1>Informes</h1><small class="cap">${title(cur)}</small></div><div class="tools"><button class="btn" data-act="rep-csv">⬇ CSV</button><button class="btn" data-act="rep-pdf">🖨 PDF / Imprimir</button></div></div>
  <div class="row between wrap noprint" style="margin-bottom:12px"><div class="tabs">${KINDS.map(([k, l]) => html`<button class="${R.kind === k ? 'on' : ''}" data-act="rep-kind" data-kind="${k}">${l}</button>`)}</div>
    ${R.kind === 'custom' ? html`<div class="row"><input type="date" style="width:auto" data-change="rep-f" data-f="from" value="${cur.from}"><span>→</span><input type="date" style="width:auto" data-change="rep-f" data-f="to" value="${cur.to}"></div>` : html`<div class="row"><button class="btn sm" data-act="rep-nav" data-n="-1" aria-label="Anterior">‹</button><button class="btn sm" data-act="rep-today">Hoy</button><button class="btn sm" data-act="rep-nav" data-n="1" aria-label="Siguiente">›</button></div>`}</div>
  <details class="card noprint" style="margin-bottom:14px" ${R.categoryId || R.accountId || R.type || R.status ? raw('open') : ''}><summary style="cursor:pointer;font-weight:700">Filtros ${R.categoryId || R.accountId || R.type || R.status ? '(activos)' : ''}</summary><div class="grid g4" style="margin-top:10px">
    <div><label>Categoría</label><select data-change="rep-f" data-f="categoryId">${options(s.categories.map((c) => [c.id, `${c.icon} ${c.name}`]), R.categoryId, 'Todas')}</select></div><div><label>Cuenta</label><select data-change="rep-f" data-f="accountId">${options(s.accounts.map((a) => [a.id, `${accIcon(a)} ${a.name}`]), R.accountId, 'Todas')}</select></div>
    <div><label>Tipo de movimiento</label><select data-change="rep-f" data-f="type">${options(Object.entries(TX_TYPES).map(([k, v]) => [k, v.short]), R.type, 'Todos')}</select></div><div><label>Estado</label><select data-change="rep-f" data-f="status">${options(Object.entries(TX_STATUS), R.status, 'Todos')}</select></div></div></details>
  <div class="grid g4 stats" style="margin-bottom:14px">${kpi('Ingresos recibidos', fm(m.income), 'pos', html`vs. periodo anterior ${delta(m.income, p.income)}`)}${kpi('Gastos de consumo', fm(m.expense), 'neg', html`vs. periodo anterior ${delta(m.expense, p.expense, false)}`)}${kpi('Balance neto', fm(m.net, { sign: true }), m.net >= 0 ? 'pos' : 'neg', html`Anterior ${fm(p.net)} ${delta(m.net, p.net)}`)}${kpi('Flujo de caja', fm(m.cashFlow, { sign: true }), m.cashFlow >= 0 ? 'pos' : 'neg', 'Variación del dinero propio')}</div>
  <div class="grid g4 stats" style="margin-bottom:14px">${dayKpis}</div>
  ${m.count ? html`<div class="grid" style="gap:14px">${chart}
    <div class="grid g2"><div class="card"><h2>Gastos por categoría</h2>${donut(cats.filter((c) => c.v > 0).map((c) => ({ label: c.name, value: c.v, color: c.color })), 'Gastos')}</div>
      <div class="card"><h2>Detalle por categoría</h2>${cats.length ? html`<div class="scroll"><table><thead><tr><th>Categoría</th><th class="r">Gasto</th><th class="r">Anterior</th></tr></thead><tbody>${cats.map((c) => html`<tr><td>${c.icon} ${c.name}</td><td class="r num">${fm(c.v)}</td><td class="r num muted">${fm(c.prev)}</td></tr>`)}</tbody></table></div>` : html`<div class="empty small">Sin gastos</div>`}</div></div>
    ${R.kind !== 'day' && accRows.length ? html`<div class="card"><h2>Gastos por cuenta</h2><div class="list">${accRows.map(([id, v]) => html`<div class="item"><div class="grow">${accName(id)}</div><div style="width:40%" class="bar"><i style="width:${Math.round((v * 100) / m.expense)}%"></i></div><b class="num" style="min-width:110px;text-align:right">${fm(v)}</b></div>`)}</div></div>` : ''}
    ${R.kind === 'day' ? html`<div class="card"><h2>Movimientos del día</h2>${txList(m.txs)}</div>` : ''}
    <div class="card"><h2>Cómo se calculan las cifras</h2><div class="small muted"><b>Ingresos recibidos</b> y <b>gastos de consumo</b> excluyen transferencias entre tus cuentas, préstamos, pagos de capital de deudas, ahorros e inversiones. <b>Flujo de caja</b> es el cambio real de tu dinero propio (incluye pagos de tarjeta y préstamos). <b>Balance neto</b> = ingresos − gastos. <b>Patrimonio neto</b> = dinero + por cobrar + inversiones − deudas y tarjetas.</div></div></div>` : html`<div class="card">${empty('📊', 'No hay movimientos en este periodo con los filtros actuales.')}</div>`}`;
}
const reset = () => ui.render();
actions['rep-kind'] = (el) => { R.kind = el.dataset.kind; reset(); };
actions['rep-nav'] = (el) => { R.anchor = D.shiftAnchor(R.kind, R.anchor || D.today(), Number(el.dataset.n)); reset(); };
actions['rep-today'] = () => { R.anchor = D.today(); reset(); };
changes['rep-f'] = (el) => { R[el.dataset.f] = el.value; reset(); };
actions['rep-pdf'] = () => { toast('En el diálogo de impresión elige "Guardar como PDF".'); setTimeout(() => window.print(), 300); };
actions['rep-csv'] = () => {
  const { s, cur, m, p } = compute(), sep = s.settings.csvSeparator, c = (v) => v / 100;
  const rows = [['NEXORA — Informe', title(cur)], ['Generado', D.today()], [], ['Métrica', 'Periodo', 'Periodo anterior'], ['Ingresos recibidos', c(m.income), c(p.income)], ['Gastos de consumo', c(m.expense), c(p.expense)], ['Balance neto', c(m.net), c(p.net)], ['Flujo de caja', c(m.cashFlow), c(p.cashFlow)], ['Transferencias internas', c(m.transfers.total), c(p.transfers.total)], [], ['Categoría', 'Gasto', 'Anterior']];
  for (const x of catRows(m, p)) rows.push([x.name, c(x.v), c(x.prev)]);
  rows.push([], ['Fecha', 'Hora', 'Tipo', 'Descripción', 'Importe', 'Cuenta', 'Categoría', 'Estado']);
  for (const t of m.txs) rows.push([t.date, t.time, TX_TYPES[t.type].label, t.description, c(t.amount), accName(t.accountId), t.categoryId ? catById(t.categoryId)?.name || '' : '', TX_STATUS[t.status]]);
  download(`nexora-informe-${R.kind}-${cur.from}.csv`, toCSV(rows, sep)); toast('Informe exportado a CSV.', 'ok');
};
