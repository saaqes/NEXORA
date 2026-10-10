// Alertas de presupuesto (50/75/90/100 %, configurables) sin avisos duplicados.
import { S } from './ui/kit.js';
import { toast } from './ui/kit.js';
import { budgetStatus } from './core/ledger.js';
import { catById, fm } from './ui/kit.js';
import { saveMeta } from './data/store.js';

export function budgetAlerts() {
  const s = S(), ths = [...(s.settings.budgetThresholds || [])].sort((a, b) => a - b);
  return s.budgets.map((b) => { const st = budgetStatus(s, b, undefined, s.settings.weekStart); const th = ths.filter((x) => st.pct >= x).pop(); return th ? { b, st, th } : null; }).filter(Boolean);
}
export const budgetName = (b) => (b.categoryId ? catById(b.categoryId)?.name || 'Categoría' : 'Presupuesto total');
export function announceBudgets() {
  const s = S(); let dirty = false;
  for (const a of budgetAlerts()) {
    const key = `${a.b.id}|${a.st.range.from}|${a.th}`;
    if (s.alertsSeen[key]) continue;
    // marca como vistos también los umbrales inferiores para no repetir
    for (const t of s.settings.budgetThresholds) if (t <= a.th) s.alertsSeen[`${a.b.id}|${a.st.range.from}|${t}`] = 1;
    dirty = true;
    toast(`${a.th >= 100 ? '🚨' : '⚠️'} ${budgetName(a.b)}: llevas ${a.st.pct} % del presupuesto (${fm(a.st.spent)} de ${fm(a.b.amount)}).`, a.th >= 90 ? 'bad' : 'warn', 6500);
  }
  if (dirty) saveMeta('alertsSeen', s.alertsSeen);
}
