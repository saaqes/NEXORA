export function toCSV(rows, sep = ';') {
  const q = (v) => { const s = String(v ?? ''); return new RegExp(`[${sep}"\\n\\r]`).test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(q).join(sep)).join('\r\n');
}
export function download(name, content, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
