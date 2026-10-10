// E2E en navegador real: npm start (otra terminal) y luego PLAYWRIGHT_MODULE=<ruta> node tests/e2e.mjs
import { tmpdir } from 'node:os';
// Cubre pruebas A, B, C, G, H y J (recordatorio con reloj simulado) y revisa desbordes en móvil.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const SP = tmpdir() + '/';
const BASE = process.env.BASE || 'http://localhost:8080';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: 'es-CO', timezoneId: 'America/Bogota' });
const p = await ctx.newPage(); const errs = []; let ok = 0, bad = 0;
p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
const check = (n, c, extra = '') => { c ? ok++ : bad++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' ' + extra)); };
const state = () => p.evaluate(() => { const s = window.NEXORA.store.state; return { acc: s.accounts.map((a) => a.name), tx: s.transactions.length }; });
const own = () => p.evaluate(async () => { const L = await import('./js/core/ledger.js'); const t = L.totals(window.NEXORA.store.state); return { own: t.own / 100, b: Object.fromEntries(window.NEXORA.store.state.accounts.map((a) => [a.name, t.balances[a.id] / 100])) }; });
await p.goto(`${BASE}/`); await p.waitForTimeout(600);
await p.click('[data-act=welcome-start]'); await p.waitForTimeout(400);
// crear cuentas por UI
async function newAcc(name, type, initial) { await p.click('[data-act=acc-new]'); await p.fill('#af [name=name]', name); await p.selectOption('#af [name=type]', type); await p.fill('#af [name=initial]', initial); await p.click('#af ~ * [type=submit], button[form=af]'); await p.waitForTimeout(300); }
await newAcc('Bancolombia', 'savings', '1000000'); await newAcc('Efectivo', 'cash', '0');
check('cuentas creadas', (await state()).acc.length === 2);
// Prueba A: transferencia 200.000
await p.click('.top [data-act=tx-new][data-type=transfer]'); await p.waitForTimeout(200);
await p.fill('#txf [name=amount]', '200000');
await p.selectOption('#txf [data-g=to] select', { label: '💵 Efectivo' }).catch(async () => { const v = await p.$$eval('#txf select[name=toAccountId]:not([disabled]) option', (o) => o.map((x) => x.textContent)); console.log('opts', v); });
await p.click('button[form=txf]'); await p.waitForTimeout(400);
let o = await own(); check('A banco 800.000', o.b.Bancolombia === 800000, JSON.stringify(o)); check('A efectivo 200.000', o.b.Efectivo === 200000); check('A total 1.000.000', o.own === 1000000);
// Prueba B: gasto 35.000 de efectivo con categoría
await p.evaluate(() => (location.hash = '#/inicio')); await p.waitForTimeout(200); await p.click('.top [data-act=tx-new][data-type=expense]'); await p.waitForTimeout(200);
await p.fill('#txf [name=amount]', '35.000'); await p.selectOption('#txf [data-g=cat_exp] select[name=categoryId]', 'ali'); await p.selectOption('#txf select[name=accountId]', { label: '💵 Efectivo' }); await p.fill('#txf [name=description]', 'Comida');
await p.click('button[form=txf]'); await p.waitForTimeout(400);
o = await own(); check('B efectivo 165.000', o.b.Efectivo === 165000, JSON.stringify(o));
const dash = await p.locator('#view').innerText(); check('dashboard gastos hoy 35.000', /Gastos de hoy\s+\$\s?35\.000/.test(dash), dash.slice(0, 300));
// Prueba C: ingreso 250.000 en efectivo
await p.click('.top [data-act=tx-new][data-type=income]'); await p.waitForTimeout(200);
await p.fill('#txf [name=amount]', '250000'); await p.selectOption('#txf select[name=accountId]', { label: '💵 Efectivo' });
await p.click('button[form=txf]'); await p.waitForTimeout(400);
o = await own(); check('C efectivo 415.000', o.b.Efectivo === 415000);
// Prueba H: recargar
await p.reload(); await p.waitForTimeout(800);
o = await own(); const st = await state(); check('H persistencia tras recargar', st.tx === 3 && o.b.Efectivo === 415000 && o.b.Bancolombia === 800000, JSON.stringify([st, o]));
// Editar y eliminar vía UI (Prueba G)
await p.goto(`${BASE}/#/historial`); await p.waitForTimeout(400);
await p.click('.item:has-text("Comida")'); await p.click('[data-edit]'); await p.fill('#txf [name=amount]', '20000'); await p.click('button[form=txf]'); await p.waitForTimeout(400);
o = await own(); check('G editar recalcula (efectivo 430.000)', o.b.Efectivo === 430000, JSON.stringify(o));
await p.click('.item:has-text("Comida")'); await p.click('[data-del]'); await p.click('[data-yes]'); await p.waitForTimeout(400);
o = await own(); check('G eliminar revierte (efectivo 450.000)', o.b.Efectivo === 450000, JSON.stringify(o));
// Prueba J: recordatorio con reloj simulado (zona America/Bogota). 21:00 Bogotá = 02:00Z del día siguiente.
const wait = (sel, ms) => p.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
await p.clock.install({ time: new Date('2026-10-11T01:59:50Z') }); await p.goto(`${BASE}/#/inicio`); await p.waitForTimeout(800);
check('J sin aviso antes de la hora (20:59)', (await p.locator('[data-daily]').count()) === 0);
check('J aviso diario a las 9:00 p. m.', await wait('[data-daily]', 25000));
await p.screenshot({ path: SP + 'reminder.png' });
await p.click('[data-a=later]'); await p.waitForTimeout(3000);
check('J posponer cierra el aviso y no duplica', (await p.locator('[data-daily]').count()) === 0);
await p.clock.setSystemTime(new Date('2026-10-11T02:40:00Z'));
check('J reaparece tras posponer', await wait('[data-daily]', 25000));
await p.click('[data-a=ok]'); await p.waitForTimeout(600);
const rv = await p.evaluate(async () => { const L = await import('./js/core/ledger.js'); const D = await import('./js/lib/dates.js'); return L.reviewStatus(window.NEXORA.store.state, D.today()); });
check('J "Sí, ya registré todo" marca revisado', rv === 'reviewed', rv);
await p.clock.setSystemTime(new Date('2026-10-11T03:40:00Z')); await p.waitForTimeout(17000);
check('J no repite si ya está revisado', (await p.locator('[data-daily]').count()) === 0);
// móvil
const m = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-CO', isMobile: true, hasTouch: true });
const mp = await m.newPage(); mp.on('pageerror', (e) => errs.push('M PAGEERR ' + e.message));
await mp.goto(`${BASE}/`); await mp.waitForTimeout(500); await mp.click('[data-act=welcome-demo]'); await mp.waitForTimeout(600);
await mp.screenshot({ path: SP + 'mobile-dash.png' });
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); check('móvil sin scroll horizontal (inicio)', !overflow);
for (const r of ['cuentas', 'calendario', 'pendientes', 'deudas', 'presupuestos', 'informes', 'ahorros', 'recurrentes', 'historial', 'configuracion']) { await mp.goto(`${BASE}/#/` + r); await mp.waitForTimeout(250); const ov = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ov > 1) check('móvil overflow ' + r, false, ov + 'px'); }
await mp.goto(`${BASE}/#/informes`); await mp.waitForTimeout(300); await mp.screenshot({ path: SP + 'mobile-informes.png' });
await mp.click('.fab'); await mp.waitForTimeout(400); await mp.screenshot({ path: SP + 'mobile-form.png' });
console.log(errs.join('\n') || 'sin errores de consola'); console.log(`${ok} OK, ${bad} FAIL`);
await b.close();
