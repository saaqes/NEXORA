import { html, raw, fm, fd, S, catById, catLabel, accName, accById, actions, signed } from './kit.js';
import { TX_TYPES, TX_STATUS } from '../core/defaults.js';

const TYPE_ICON = { income: '⬇️', expense: '⬆️', transfer: '🔁', loan_given: '🤝', loan_received: '🏦', debt_payment: '💸', debt_collection: '💰', saving: '🐷', investment: '📈', fee: '🏷️', refund: '↩️', adjustment: '⚖️' };
export const txIcon = (t) => (['income', 'expense', 'fee'].includes(t.type) && catById(t.categoryId)?.icon) || TYPE_ICON[t.type];
export function txTitle(t) { return t.description || (t.type === 'transfer' ? `${accName(t.accountId)} → ${accName(t.toAccountId)}` : TX_TYPES[t.type].short); }
export function txSign(t) {
  if (t.type === 'adjustment') return t.adjustDir === '-' ? -1 : 1;
  if (t.type === 'investment') return t.direction === 'out' ? 1 : -1;
  return TX_TYPES[t.type].sign;
}
export function txRow(t, { account = true, act = true } = {}) {
  const sign = txSign(t), void_ = t.status === 'anulado';
  const amt = sign === 0 ? html`<span class="num info">${fm(t.amount)}</span>` : html`<span class="num ${sign > 0 ? 'pos' : 'neg'}">${sign > 0 ? '+' : '−'}${fm(t.amount)}</span>`;
  const extra = t.fee ? ` · comisión ${fm(t.fee)}` : '';
  return html`<div class="item" ${act ? raw(`data-act="tx-open" data-id="${t.id}"`) : ''} style="${void_ ? 'opacity:.5;text-decoration:line-through' : ''}"><div class="dot">${txIcon(t)}</div>
  <div class="grow"><div class="bold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${txTitle(t)}</div>
  <div class="small muted">${fd(t.date)} ${t.time || ''} · ${TX_TYPES[t.type].short}${account ? ` · ${accName(t.accountId)}${t.toAccountId ? ' → ' + accName(t.toAccountId) : ''}` : ''}${t.categoryId ? ' · ' + catLabel(t.categoryId, t.subId) : ''}${extra}${t.status === 'por_verificar' ? ' · por verificar' : ''}${void_ ? ' · ANULADO' : ''}</div></div><div class="right">${amt}</div></div>`;
}
export const txList = (txs, limit = 50) => (txs.length ? html`<div class="list">${txs.slice(0, limit).map((t) => txRow(t))}</div>` : html`<div class="empty small">Sin movimientos</div>`);
export { TYPE_ICON };
