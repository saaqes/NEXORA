// Gráficos SVG propios (sin librerías externas). Todo se calcula con los datos reales recibidos.
import { html, raw, esc } from '../lib/html.js';
import { formatCompact, formatMoney } from '../lib/money.js';

const nice = (max) => { if (max <= 0) return 100; const p = 10 ** Math.floor(Math.log10(max)); const n = max / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const W = 600, PL = 52, PR = 10, PT = 12, PB = 26;

export function barChart({ labels, series, height = 200 }) {
  const all = series.flatMap((s) => s.values), top = nice(Math.max(0, ...all)), H = height, iw = W - PL - PR, ih = H - PT - PB;
  const gw = iw / labels.length, bw = Math.min(26, (gw * 0.7) / series.length);
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = PT + ih - (ih * i) / 4; g += `<line class="grid" x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}"/><text x="${PL - 6}" y="${y + 3}" text-anchor="end">${esc(formatCompact((top * i) / 4))}</text>`; }
  const bars = labels.map((lb, i) => {
    const x0 = PL + gw * i + (gw - bw * series.length) / 2;
    return series.map((s, k) => { const h = (s.values[i] / top) * ih; return `<rect x="${x0 + bw * k}" y="${PT + ih - h}" width="${bw - 2}" height="${Math.max(h, s.values[i] ? 1 : 0)}" rx="4" fill="${s.color}"><title>${esc(lb)} · ${esc(s.name)}: ${esc(formatMoney(s.values[i]))}</title></rect>`; }).join('') +
      `<text x="${PL + gw * i + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
  }).join('');
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">${raw(g + bars)}</svg><div class="legend">${series.map((s) => html`<span><i style="background:${s.color}"></i>${s.name}</span>`)}</div>`;
}

export function lineChart({ labels, values, color = '#7c5cff', height = 200 }) {
  const H = height, iw = W - PL - PR, ih = H - PT - PB;
  let hi = Math.max(0, ...values), lo = Math.min(0, ...values);
  if (hi === lo) hi = lo + 100;
  const top = nice(hi - lo) * (hi - lo > 0 ? 1 : 1), span = Math.max(hi - lo, 1), pad = span * 0.08, mx = hi + pad, mn = lo < 0 ? lo - pad : lo;
  const X = (i) => PL + (values.length === 1 ? iw / 2 : (iw * i) / (values.length - 1)), Y = (v) => PT + ih - ((v - mn) / (mx - mn)) * ih;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = mn + ((mx - mn) * i) / 4, y = Y(v); g += `<line class="grid" x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}"/><text x="${PL - 6}" y="${y + 3}" text-anchor="end">${esc(formatCompact(v))}</text>`; }
  const pts = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const step = Math.max(1, Math.ceil(labels.length / 7));
  const xl = labels.map((l, i) => (i % step === 0 || i === labels.length - 1 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : '')).join('');
  const dots = values.length <= 40 ? values.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${color}"><title>${esc(labels[i])}: ${esc(formatMoney(v))}</title></circle>`).join('') : '';
  const id = 'lg' + Math.random().toString(36).slice(2, 7);
  const area = `M${pts[0]} L${pts.join(' L')} L${X(values.length - 1)},${Y(Math.max(mn, Math.min(0, mx)))} L${X(0)},${Y(Math.max(mn, Math.min(0, mx)))}Z`;
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de línea"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${raw(g)}<path d="${area}" fill="url(#${id})"/><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${raw(dots + xl)}</svg>`;
}

export function donut(items, centerLabel = '') {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total) return html`<div class="empty small">Sin datos en este periodo</div>`;
  const R = 70, C = 2 * Math.PI * R; let off = 0;
  const arcs = items.map((it) => { const len = (it.value / total) * C; const a = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${it.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(it.label)}: ${esc(formatMoney(it.value))} (${Math.round((it.value * 100) / total)} %)</title></circle>`; off += len; return a; }).join('');
  return html`<div class="donutwrap"><svg viewBox="0 0 180 180" role="img" aria-label="Distribución">${raw(arcs)}<text x="90" y="86" text-anchor="middle" style="font-size:10px">${centerLabel}</text><text x="90" y="104" text-anchor="middle" style="font-size:13px;font-weight:700;fill:var(--text)">${formatCompact(total)}</text></svg>
  <div class="lg">${items.slice(0, 8).map((it) => html`<div class="r"><i style="background:${it.color}"></i><span>${it.label}</span><b class="num">${Math.round((it.value * 100) / total)} %</b></div>`)}</div></div>`;
}
