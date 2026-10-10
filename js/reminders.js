// Recordatorios. LIMITACIÓN HONESTA: un sitio web solo puede ejecutar código mientras la pestaña/PWA está abierta
// (o en segundo plano reciente). Con la app cerrada NO se envían avisos sin un servidor push (docs/NOTIFICACIONES.md).
// Al abrir la app, los avisos vencidos del día se muestran una sola vez ("aviso atrasado").
import { html, S, fm, fd, D, modal, toast, hasModal } from './ui/kit.js';
import { run } from './data/store.js';
import { reviewStatus, pendingState } from './core/ledger.js';
import { setDayReview } from './core/engine.js';
import { finishReview } from './ui/review.js';
import { openTxForm } from './ui/txform.js';

const KEY = 'nexora.fired.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = (o) => { try { const d = Object.keys(o).sort().slice(-200); localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(d.map((k) => [k, o[k]])))); } catch { /* sin localStorage */ } };
const fired = { has: (k) => !!load()[k], add: (k, v = 1) => { const o = load(); o[k] = v; save(o); }, del: (k) => { const o = load(); delete o[k]; save(o); }, get: (k) => load()[k] };

export const notifSupport = () => ({ api: 'Notification' in window, secure: window.isSecureContext, sw: 'serviceWorker' in navigator, permission: 'Notification' in window ? Notification.permission : 'unsupported' });
export async function requestNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  return Notification.requestPermission();
}
async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !S().settings.reminders.browserNotifications) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification(title, { body, tag, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png' });
    else new Notification(title, { body, tag, icon: 'assets/icon-192.png' });
  } catch { /* el navegador puede rechazarla */ }
}

export function openDailyPrompt(date = D.today()) {
  if (document.querySelector('[data-daily]')) return;
  const m = modal({
    title: '¿Ya registraste todo hoy?', dismiss: false,
    body: html`<div data-daily><p style="font-size:1.05rem">¿Ya registraste todos los gastos e ingresos de hoy (${fd(date)})?</p><div class="col" style="margin-top:14px">
      <button class="btn pos" data-a="ok">✅ Sí, ya registré todo</button><button class="btn neg" data-a="exp">Registrar un gasto</button><button class="btn pos" data-a="inc">Registrar un ingreso</button>
      <button class="btn" data-a="rev">Revisar movimientos</button><button class="btn ghost" data-a="later">Recordármelo más tarde (${S().settings.reminders.snoozeMinutes} min)</button></div></div>`,
  });
  m.el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'ok') { const r = await finishReview(date); if (r.ok) m.close(); return; }
    m.close();
    if (a === 'exp') openTxForm({ type: 'expense', date });
    else if (a === 'inc') openTxForm({ type: 'income', date });
    else if (a === 'rev') location.hash = `#/calendario?day=${date}`;
    else if (a === 'later') { fired.add(`snooze|${date}`, Date.now() + S().settings.reminders.snoozeMinutes * 60000); fired.del(`daily|${date}`); toast('Te lo recordaré más tarde (mientras NEXORA esté abierta).'); }
  });
}

export function tick(now = new Date()) {
  const s = S(), r = s.settings.reminders; if (!r.enabled && !r.summaryEnabled && !r.debtDue) return;
  const np = D.nowParts(now), { date, time, dow } = np;
  // 1) revisión diaria
  if (r.enabled && r.days.includes(dow) && time >= r.time && reviewStatus(s, date) !== 'reviewed') {
    const snooze = fired.get(`snooze|${date}`);
    const due = !fired.has(`daily|${date}`) && (!snooze || now.getTime() >= snooze);
    if (due && !hasModal()) {
      fired.add(`daily|${date}`); fired.del(`snooze|${date}`);
      openDailyPrompt(date); notify('NEXORA', '¿Ya registraste todos los gastos e ingresos de hoy?', 'daily-' + date);
      if (time > r.time && Math.abs(Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) - (Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3)))) > 5) toast('Aviso atrasado: NEXORA no estaba abierta a la hora configurada.', 'warn', 6000);
    }
  }
  // 2) recordatorios adicionales
  for (const x of r.extras || []) if (x.time && time >= x.time && !fired.has(`extra|${x.id}|${date}`)) {
    fired.add(`extra|${x.id}|${date}`); toast('🔔 ' + (x.label || 'Recordatorio'), '', 8000); notify('NEXORA', x.label || 'Recordatorio', `extra-${x.id}-${date}`);
  }
  // 3) resumen diario
  if (r.summaryEnabled && time >= r.summaryTime && !fired.has(`summary|${date}`)) {
    fired.add(`summary|${date}`);
    import('./core/ledger.js').then(({ summarize }) => { const t = summarize(s, { from: date, to: date }); const msg = `Hoy: ingresos ${fm(t.income)}, gastos ${fm(t.expense)}, balance ${fm(t.net)}.`; toast('📊 ' + msg, '', 9000); notify('Resumen del día', msg, 'summary-' + date); });
  }
  // 4) vencimientos: una vez al día, a partir de las 08:00
  if (time >= '08:00' && !fired.has(`due|${date}`) && (r.debtDue || r.upcoming || r.receivables)) {
    const items = s.pendings.map((p) => ({ p, st: pendingState(s, p) })).filter((x) => x.st.remaining > 0 && x.st.status !== 'cancelled' && x.p.due);
    const soon = items.filter((x) => x.p.kind === 'payable' && (x.p.reminderDays != null ? x.p.due <= D.addDays(date, x.p.reminderDays) : r.upcoming && x.p.due <= D.addDays(date, r.upcomingDays)));
    const coll = items.filter((x) => x.p.kind === 'receivable' && (x.p.reminderDays != null ? x.p.due <= D.addDays(date, x.p.reminderDays) : r.receivables && x.p.due <= date));
    const debts = r.debtDue ? s.debts.filter((d) => d.direction === 'payable' && d.due && d.due <= D.addDays(date, r.debtDays)) : [];
    fired.add(`due|${date}`);
    if (soon.length || coll.length || debts.length) {
      const parts = [soon.length && `${soon.length} pago(s) próximo(s) o vencido(s)`, coll.length && `${coll.length} cobro(s) pendiente(s)`, debts.length && `${debts.length} deuda(s) por vencer`].filter(Boolean).join(' · ');
      toast('📌 ' + parts, 'warn', 9000); notify('NEXORA: pendientes', parts, 'due-' + date);
    }
  }
}
let timer;
export function startReminders() { clearInterval(timer); tick(); timer = setInterval(tick, 15000); document.addEventListener('visibilitychange', () => !document.hidden && tick()); }
