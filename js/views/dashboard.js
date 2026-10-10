import { html, raw, S, fm, fd, D, icon, empty, catById, reviewChip, signed, actions, accName } from '../ui/kit.js';
import { store } from '../data/store.js';
import { totals, summarize, savingsTotal, debtTotals, netWorth, pendingState, prep, reviewStatus, balanceSeries, budgetStatus, largeExpenses, isLive } from '../core/ledger.js';
import { dueRecurrences, upcomingRecurrences } from '../core/recurrence.js';
import { barChart, lineChart, donut } from '../ui/charts.js';
import { txRow } from '../ui/rows.js';
import { budgetAlerts, budgetName } from '../alerts.js';

const stat = (ic, label, val, sub = '', cls = '', extra = '') => html`<div class="card stat ${extra}"><div class="lbl"><span class="ic">${ic}</span>${label}</div><div class="val num ${cls}">${val}</div>${sub ? html`<div class="sub">${sub}</div>` : ''}</div>`;
const pctChange = (a, b) => (b ? Math.round(((a - b) * 100) / Math.abs(b)) : null);

export function render() {
  const s = S(), today = D.today(), ws = s.settings.weekStart;
  const t = totals(s, today), day = summarize(s, { from: today, to: today });
  const mr = D.periodRange('month', today), pr = D.prevRange('month', today);
  const mon = summarize(s, mr), prevMon = summarize(s, pr);
  const dt = debtTotals(s);
  const pends = s.pendings.map((p) => ({ p, st: pendingState(s, p) })).filter((x) => x.st.remaining > 0 && x.st.status !== 'cancelled');
  const toPay = pends.filter((x) => x.p.kind === 'payable'), toCollect = pends.filter((x) => x.p.kind === 'receivable');
  const sumR = (l) => l.reduce((a, x) => a + x.st.remaining, 0);
  const nw = netWorth(s, today);
  const hasData = s.accounts.length > 0;
  const rev = reviewStatus(s, today);

  // series
  const months = Array.from({ length: 6 }, (_, i) => D.addMonths(D.monthStart(today), i - 5));
  const ms = months.map((m) => summarize(s, D.periodRange('month', m)));
  const bal = balanceSeries(s, D.addDays(today, -29), today);
  const cats = Object.entries(mon.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ label: id === '_' ? 'Sin categoría' : catById(id)?.name || 'Eliminada', value: v, color: catById(id)?.color || '#94a3b8' }));
  const top = cats.slice(0, 7), rest = cats.slice(7).reduce((a, c) => a + c.value, 0); if (rest) top.push({ label: 'Otras', value: rest, color: '#64748b' });

  // presupuesto restante del mes
  const mb = s.budgets.filter((b) => b.period === 'monthly').map((b) => ({ b, st: budgetStatus(s, b, today, ws) }));
  const total = mb.find((x) => !x.b.categoryId), budgeted = total ? total.b.amount : mb.reduce((a, x) => a + x.b.amount, 0), spentB = total ? total.st.spent : mb.reduce((a, x) => a + x.st.spent, 0);
  // próximos
  const soon = [
    ...pends.filter((x) => !x.p.due || x.p.due <= D.addDays(today, 30)).map((x) => ({ date: x.p.due || '9999', kind: x.p.kind, title: x.p.title, amount: x.st.remaining, over: x.st.status === 'overdue', id: x.p.id, type: 'pend' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const recDue = dueRecurrences(s, today), recSoon = upcomingRecurrences(s, today, 7);
  const alerts = largeExpenses(s, s.settings), bAl = budgetAlerts().filter((a) => a.th >= 75);
  const overdue = pends.filter((x) => x.st.status === 'overdue');
  const lastBackup = (() => { try { return localStorage.getItem('nexora.lastBackup'); } catch { return null; } })();
  const needBackup = s.transactions.length > 20 && (!lastBackup || D.diffDays(today, lastBackup.slice(0, 10)) > 14);

  return html`
  <div class="top"><div class="title"><h1>Hola 👋</h1><small>${D.formatDateLong(today)} · ${reviewChip(rev)}</small></div>
    <div class="tools quick"><button class="btn pos" data-act="tx-new" data-type="income">+ Ingreso</button><button class="btn neg" data-act="tx-new" data-type="expense">− Gasto</button><button class="btn" data-act="tx-new" data-type="transfer">⇄ Transferencia</button><a class="btn" href="#/deudas">🤝 Deuda</a><a class="btn" href="#/pendientes">🧾 Pago</a></div></div>
  ${store.persistent ? '' : html`<div class="banner bad">⚠️ <div><b>Los datos no se están guardando.</b> No se pudo activar el almacenamiento del navegador (${store.error || 'modo privado'}). Exporta una copia en Configuración.</div></div>`}
  ${needBackup ? html`<div class="banner">💾 <div class="grow">Hace tiempo que no haces una copia de seguridad.</div><a class="btn sm" href="#/configuracion">Hacer copia</a></div>` : ''}
  ${!hasData ? html`<div class="card">${empty('🏦', 'Aún no tienes cuentas. Crea tu primera cuenta (efectivo, banco, billetera…) para empezar a registrar.', html`<p style="margin-top:12px"><a class="btn primary" href="#/cuentas">Crear mi primera cuenta</a></p>`)}</div>` : ''}
  <div class="grid g4 stats" style="margin-bottom:14px">
    ${stat('💎', 'Dinero total disponible', fm(t.own), `Patrimonio neto estimado: ${fm(nw.net)}`, t.own < 0 ? 'neg' : '', 'hero')}
    ${stat('⬇️', 'Ingresos de hoy', fm(day.income), '', 'pos')}${stat('⬆️', 'Gastos de hoy', fm(day.expense), '', 'neg')}${stat('⚖️', 'Balance neto de hoy', fm(day.net, { sign: true }), 'Ingresos − gastos reales', day.net >= 0 ? 'pos' : 'neg')}
    ${stat('📅', 'Ingresos del mes', fm(mon.income), `Mes anterior: ${fm(prevMon.income)}`, 'pos')}${stat('🧾', 'Gastos del mes', fm(mon.expense), `Mes anterior: ${fm(prevMon.expense)}`, 'neg')}${stat('🐷', 'Ahorros acumulados', fm(savingsTotal(s, today)), 'Reservado + bolsillos', 'pos')}
    ${stat('💳', 'Deudas pendientes', fm(dt.payable + t.cardDebt), `Tarjetas: ${fm(t.cardDebt)} · Préstamos: ${fm(dt.payable)}`, dt.payable + t.cardDebt ? 'neg' : '')}${stat('🤝', 'Dinero que me deben', fm(dt.receivable + sumR(toCollect)), `Préstamos: ${fm(dt.receivable)} · Cobros: ${fm(sumR(toCollect))}`)}${stat('⏳', 'Pagos pendientes por realizar', fm(sumR(toPay)), `${toPay.length} pendiente(s)${overdue.length ? ` · ${overdue.length} vencido(s)` : ''}`, overdue.length ? 'neg' : '')}
    ${stat('💵', 'Efectivo disponible', fm(t.cash))}${stat('🏦', 'Bancos y tarjetas', fm(t.bank), t.pocket ? `Bolsillos de ahorro: ${fm(t.pocket)}` : 'Cuentas, débito y billeteras')}
    ${t.creditLimit ? stat('🪪', 'Cupo disponible (no es tu dinero)', fm(t.creditAvailable), `Cupo total ${fm(t.creditLimit)}`, 'info') : ''}
  </div>
  <div class="split">
    <div class="grid">
      <div class="card"><h2>Ingresos frente a gastos · últimos 6 meses</h2>${barChart({ labels: months.map((m) => D.MONTHS_SHORT[Number(m.slice(5, 7)) - 1]), series: [{ name: 'Ingresos', color: 'var(--pos)', values: ms.map((x) => x.income) }, { name: 'Gastos', color: 'var(--neg)', values: ms.map((x) => x.expense) }] })}</div>
      <div class="card"><h2>Evolución del dinero propio · 30 días</h2>${lineChart({ labels: bal.map((b) => b.date.slice(8) + '/' + b.date.slice(5, 7)), values: bal.map((b) => b.value) })}</div>
      <div class="card"><h2>Últimos movimientos</h2>${(() => { const l = prep(s).txs.filter((x) => x.date <= today).slice(-8).reverse(); return l.length ? html`<div class="list">${l.map((x) => txRow(x))}</div><p style="margin-top:10px"><a href="#/historial">Ver historial completo →</a></p>` : html`<div class="empty small">Aún no hay movimientos. Usa el botón <b>+</b> para registrar el primero.</div>`; })()}</div>
    </div>
    <div class="grid" style="align-content:start">
      ${recDue.length || bAl.length || alerts.length || overdue.length ? html`<div class="card"><h2>🔔 Alertas</h2><div class="list">
        ${overdue.map((x) => html`<div class="item"><span class="chip neg">Vencido</span><div class="grow small">${x.p.title} · ${fm(x.st.remaining)}</div><button class="btn sm" data-act="pend-pay" data-id="${x.p.id}">${x.p.kind === 'payable' ? 'Pagar' : 'Cobrar'}</button></div>`)}
        ${recDue.map((r) => html`<div class="item"><span class="chip warn">Recurrente</span><div class="grow small">${r.title} · ${fm(r.amount)} · ${fd(r.next)}</div><button class="btn sm" data-act="rec-confirm" data-id="${r.id}">Revisar</button></div>`)}
        ${bAl.map((a) => html`<div class="item"><span class="chip ${a.th >= 100 ? 'neg' : 'warn'}">${a.st.pct} %</span><div class="grow small">Presupuesto de ${budgetName(a.b)}: ${fm(a.st.spent)} de ${fm(a.b.amount)}</div></div>`)}
        ${alerts.slice(0, 3).map((x) => html`<div class="item" data-act="tx-open" data-id="${x.id}"><span class="chip neg">Gasto elevado</span><div class="grow small">${x.description || 'Gasto'} · ${fm(x.amount)} (${fd(x.date)})</div></div>`)}
      </div></div>` : ''}
      <div class="card"><h2>Distribución de gastos del mes</h2>${donut(top, 'Gastos')}</div>
      <div class="card"><h2>Mes actual vs. anterior</h2>${[['Ingresos', mon.income, prevMon.income, 'pos'], ['Gastos', mon.expense, prevMon.expense, 'neg'], ['Ahorro neto', mon.net, prevMon.net, mon.net >= 0 ? 'pos' : 'neg']].map(([l, a, b, c]) => { const ch = pctChange(a, b); const mx = Math.max(Math.abs(a), Math.abs(b), 1); return html`<div style="margin-bottom:12px"><div class="row between small"><b>${l}</b><span class="muted">${ch == null ? 'sin referencia' : (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + Math.abs(ch) + ' %'}</span></div>
        <div class="bar ${c}" title="Este mes"><i style="width:${Math.round((Math.abs(a) * 100) / mx)}%"></i></div><div class="bar" style="margin-top:3px;opacity:.5" title="Mes anterior"><i style="width:${Math.round((Math.abs(b) * 100) / mx)}%;background:var(--muted)"></i></div>
        <div class="row between small muted"><span class="num">${fm(a)}</span><span class="num">${fm(b)} (anterior)</span></div></div>`; })}</div>
      <div class="card"><h2>Presupuesto restante del mes</h2>${budgeted ? html`<div class="num bold" style="font-size:1.5rem;color:${budgeted - spentB < 0 ? 'var(--neg)' : 'var(--pos)'}">${fm(budgeted - spentB)}</div><div class="small muted">${fm(spentB)} gastados de ${fm(budgeted)}</div><div class="bar ${spentB > budgeted ? 'neg' : spentB * 100 / budgeted >= 75 ? 'warn' : ''}" style="margin-top:8px"><i style="width:${Math.min(100, Math.round((spentB * 100) / budgeted))}%"></i></div>` : html`<div class="empty small">Aún no defines presupuestos.<br><a href="#/presupuestos">Crear presupuesto</a></div>`}</div>
      <div class="card"><h2>Próximos pagos y cobros</h2>${soon.length || recSoon.length ? html`<div class="list">${soon.map((x) => html`<div class="item"><span class="chip ${x.kind === 'payable' ? 'neg' : 'pos'}">${x.kind === 'payable' ? 'Pagar' : 'Cobrar'}</span><div class="grow"><div class="bold small">${x.title}</div><div class="small ${x.over ? 'neg' : 'muted'}">${x.date === '9999' ? 'Sin fecha' : (x.over ? 'Vencido · ' : '') + fd(x.date)}</div></div><b class="num small">${fm(x.amount)}</b></div>`)}
        ${recSoon.map((r) => html`<div class="item"><span class="chip info">Recurrente</span><div class="grow"><div class="bold small">${r.title}</div><div class="small muted">${fd(r.next)}</div></div><b class="num small">${fm(r.amount)}</b></div>`)}</div><p style="margin-top:8px"><a href="#/pendientes">Ver pendientes →</a></p>` : html`<div class="empty small">Nada próximo a vencer 🎉</div>`}</div>
    </div>
  </div>`;
}
