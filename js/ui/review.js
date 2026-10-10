// Cierre diario: el día solo queda "revisado" cuando el usuario lo confirma explícitamente.
import { html, S, fm, fd, modal, toast, D } from './kit.js';
import { run } from '../data/store.js';
import { setDayReview } from '../core/engine.js';
import { pendingState } from '../core/ledger.js';
import { dueRecurrences } from '../core/recurrence.js';

export function openItems(date) {
  const s = S();
  const pend = s.pendings.map((p) => ({ p, st: pendingState(s, p) })).filter((x) => x.st.remaining > 0 && x.st.status !== 'cancelled' && x.p.due && x.p.due <= date);
  return { pend, rec: dueRecurrences(s, date) };
}
export async function finishReview(date) {
  const { pend, rec } = openItems(date);
  const confirmIt = async () => { const r = await run((s) => setDayReview(s, date, 'reviewed')); if (r.ok) toast(`Día ${fd(date)} marcado como revisado.`, 'ok'); return r; };
  if (!pend.length && !rec.length) return confirmIt();
  return new Promise((res) => {
    const m = modal({
      title: 'Antes de cerrar el día', dismiss: false,
      body: html`<p>Tienes elementos que vencen o ya vencieron. Ninguno ha movido tu dinero todavía:</p><div class="list" style="margin:10px 0">
      ${pend.map(({ p, st }) => html`<div class="item"><div class="grow"><div class="bold">${p.title}</div><div class="small muted">${p.kind === 'payable' ? 'Por pagar' : 'Por cobrar'} · vence ${fd(p.due)}</div></div><b class="num">${fm(st.remaining)}</b></div>`)}
      ${rec.map((r) => html`<div class="item"><div class="grow"><div class="bold">${r.title}</div><div class="small muted">Recurrente propuesto para ${fd(r.next)}</div></div><b class="num">${fm(r.amount)}</b></div>`)}</div>
      <p class="small muted">Si ya pagaste o cobraste algo, regístralo antes de cerrar. Si no, puedes cerrar el día igualmente.</p>`,
      footer: html`<button class="btn" data-a="back">Volver y registrar</button><a class="btn" href="#/pendientes" data-a="go">Ver pendientes</a><button class="btn primary" data-a="ok">Cerrar el día igualmente</button>`,
    });
    m.el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      m.close();
      res(a === 'ok' ? await confirmIt() : { ok: false, cancelled: true });
    });
  });
}
