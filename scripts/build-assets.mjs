// Genera los recursos de marca de NEXORA (SVG vectorial, sin fuentes externas) y opcionalmente PNG.
// Uso: node scripts/build-assets.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('assets', { recursive: true });

import { mark, horizontal, maskable } from '../js/ui/logo.js';
writeFileSync('assets/logo-mark.svg', mark('g'));
writeFileSync('assets/favicon.svg', mark('f'));
writeFileSync('assets/logo-horizontal-dark.svg', horizontal({ dark: true }));
writeFileSync('assets/logo-horizontal-light.svg', horizontal({ dark: false }));
writeFileSync('assets/logo-horizontal-nostagline-dark.svg', horizontal({ dark: true, slogan: false }));
writeFileSync('assets/logo-maskable.svg', maskable());
console.log('SVG generados en assets/');

try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
  const pg = await b.newPage();
  for (const [file, svg, size] of [['icon-192.png', 'logo-mark.svg', 192], ['icon-512.png', 'logo-mark.svg', 512], ['icon-maskable-512.png', 'logo-maskable.svg', 512], ['apple-touch-icon.png', 'logo-maskable.svg', 180]]) {
    await pg.setViewportSize({ width: size, height: size });
    await pg.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${(await import('node:fs')).readFileSync('assets/' + svg).toString('base64')}" width="${size}" height="${size}">`);
    await pg.screenshot({ path: 'assets/' + file, omitBackground: true });
  }
  await b.close(); console.log('PNG generados');
} catch (e) { console.log('PNG omitidos (Playwright no disponible):', e.message.split('\n')[0]); }
