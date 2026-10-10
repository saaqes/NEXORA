// Logo NEXORA como vectores (sin imágenes externas). Fuente única: la usan la app y scripts/build-assets.mjs.
const grad = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CFF"/><stop offset="1" stop-color="#2F7BFF"/></linearGradient>`;
// N trazada + nodo verde ascendente (crecimiento) + nodo anillo (conexión)
export const markBody = `<path d="M20 47V19L44 45V17" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="44" cy="15" r="5" fill="#2FD593"/><circle cx="20" cy="49" r="3.6" fill="none" stroke="#fff" stroke-width="2.4"/>`;
export const mark = (id = 'nxg') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="NEXORA"><defs>${grad(id)}</defs><rect width="64" height="64" rx="16" fill="url(#${id})"/>${markBody}</svg>`;
const L = {
  N: '<path d="M4 38V2L24 38V2"/>', E: '<path d="M23 2H4V38H23M4 20H20"/>', X: '<path d="M3 2L25 38M25 2L3 38"/>',
  O: '<ellipse cx="14" cy="20" rx="11" ry="18"/>', R: '<path d="M4 38V2H15a9 9 0 0 1 0 18H4M14 20L25 38"/>', A: '<path d="M2 38L14 2L26 38M7 27H21"/>',
};
function wordmark(color) {
  let x = 0, out = '';
  for (const ch of 'NEXORA') { out += `<g transform="translate(${x} 0)">${L[ch]}</g>`; x += 40; }
  return { svg: `<g fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${out}</g>`, width: x - 12 };
}
export function horizontal({ dark = true, slogan = true, id = 'nxh' } = {}) {
  const ink = dark ? '#EEF0FF' : '#14163A', sub = dark ? '#9AA3D6' : '#5A6290', w = wordmark(ink), W = 64 + 18 + w.width + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 80" role="img" aria-label="NEXORA — Tu dinero, tu control"><defs>${grad(id)}</defs>
<g transform="translate(0 8)"><rect width="64" height="64" rx="16" fill="url(#${id})"/>${markBody}</g>
<g transform="translate(82 ${slogan ? 14 : 24})">${w.svg}</g>${slogan ? `<text x="84" y="68" font-family="Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="11.5" letter-spacing="3.2" fill="${sub}">TU DINERO, TU CONTROL</text>` : ''}</svg>`;
}
export const maskable = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${grad('m')}</defs><rect width="64" height="64" fill="url(#m)"/><g transform="translate(6.4 6.4) scale(.8)">${markBody}</g></svg>`;
