<p align="center"><img src="assets/logo-horizontal-dark.svg" alt="NEXORA — Tu dinero, tu control" width="360"></p>

# NEXORA — Tu dinero, tu control

Aplicación web de **control financiero personal**: ingresos, gastos, cuentas, tarjetas, efectivo, transferencias, deudas, préstamos, pagos pendientes, ahorros, presupuestos, calendario diario, informes y recordatorios. Interfaz en español, **COP** y zona **America/Bogota** por defecto, tema oscuro (con tema claro), responsive y instalable como PWA.

> NEXORA es un **registro manual**: no se conecta a bancos, no ejecuta transferencias reales y **nunca** pide contraseñas, PIN ni CVV.

## Funciones
- **Dashboard** con 12 indicadores, gráficos (ingresos vs gastos, evolución del saldo, distribución por categorías, mes actual vs anterior), alertas, presupuesto restante y próximos pagos/cobros.
- **Mis cuentas**: efectivo, ahorros, corriente, débito, **tarjeta de crédito** (cupo, cupo disponible, deuda, corte, pago límite, pago mínimo), billeteras, bolsillos y personalizadas. Archivar/reactivar.
- **12 tipos de movimiento**: ingreso, gasto, transferencia (con comisión), préstamo dado/recibido, pago/cobro de deuda, ahorro, inversión, comisión, reembolso y ajuste de saldo (con motivo). Editar, anular, duplicar, eliminar con confirmación, comprobante opcional.
- **Calendario financiero** con resumen por día y estados *Pendiente de revisar / Registro en progreso / Día revisado* (solo se marca revisado con confirmación explícita).
- **Pendientes** (por pagar / por cobrar, pagos parciales con historial), **Préstamos y deudas** (capital vs intereses), **Presupuestos** (50/75/90/100 %), **Ahorros** (reservado vs separado), **Recurrentes** (se proponen y se confirman), **Historial** con búsqueda, filtros, orden y carga progresiva, **Informes** diario/semanal (lun–dom)/mensual/anual/personalizado con CSV y PDF (imprimir).
- **Recordatorios** configurables (ver limitaciones), **copias de seguridad** JSON, importación y borrado total.

## Instalación y ejecución
Requisitos: Node.js ≥ 18 (solo para el servidor estático y las pruebas; la app **no tiene dependencias** ni paso de compilación).

```bash
git clone https://github.com/saaqes/NEXORA.git && cd NEXORA
npm start            # http://localhost:8080  (o: node scripts/serve.mjs 3000)
npm test             # pruebas del núcleo financiero (node:test)
npm run assets       # regenera logos SVG/PNG (los PNG requieren Playwright)
```
Cualquier servidor estático sirve (`python3 -m http.server`, nginx…). Debe servirse por **HTTP(S)** (los módulos ES no funcionan con `file://`).

## Estructura
```
index.html, manifest.webmanifest, sw.js   Shell PWA
assets/                                   Logo (SVG), favicon, iconos PNG
css/app.css                               Sistema de diseño (tokens, temas oscuro/claro)
js/lib/       money, dates, html (escape XSS), csv
js/core/      ledger (cálculos puros), engine (reglas y validación), recurrence, backup, demo, defaults
js/data/      db (IndexedDB), store (estado + persistencia atómica)
js/ui/        kit, charts (SVG), logo, txform, rows, review
js/views/     una vista por módulo (dashboard, cuentas, calendario, …)
js/reminders.js, js/alerts.js             Recordatorios y alertas de presupuesto
tests/        Pruebas A–J del enunciado + reglas contables
docs/         NOTIFICACIONES.md, BACKEND.md (Supabase/RLS)
```

## Decisiones técnicas importantes
- **Importes exactos**: enteros en centavos, sin `float`; límite por importe 1e13 centavos. `parseMoney` entiende `35.000`, `1.250.000,50`, etc.
- **Los saldos no se guardan, se derivan** de los movimientos (`ledger.js`). Editar, anular o eliminar nunca deja saldos desfasados ni importes duplicados.
- **Cada movimiento produce *efectos* (cuentas) y *flujos* (ingresos/gastos de consumo)** por separado: transferencias, préstamos, pagos de capital, ahorros e inversiones afectan saldos pero no los informes de consumo.
- **Métricas**: *Ingresos recibidos* y *Gastos de consumo* (sin transferencias/capital); *Balance neto* = ingresos − gastos; *Flujo de caja* = variación del dinero propio (incluye pago de tarjeta y préstamos); *Dinero disponible* = efectivo + bancos + bolsillos (el cupo de crédito **no** cuenta); *Patrimonio neto* = dinero + por cobrar + inversiones − (deuda de tarjetas + deudas por pagar).
- Tarjeta de crédito = cuenta con saldo negativo (deuda). La compra aumenta deuda; el pago es una transferencia banco → tarjeta (no es gasto nuevo).
- Un **pendiente** nunca mueve saldos; solo el pago/cobro real crea el movimiento.
- Seguridad web: escape automático de HTML, CSP restrictiva, CSV con neutralización de fórmulas, validación de copias antes de importar.

## Persistencia, copias y datos
Los datos se guardan en **IndexedDB** del navegador (solo en ese dispositivo). Configuración → *Descargar copia (JSON)* y *Restaurar copia*. Recomendado: copia semanal. Para sincronización multi-dispositivo y login ver `docs/BACKEND.md`. Los *datos de ejemplo* están marcados y se eliminan con un clic.

## Limitaciones honestas
- **Notificaciones con la app cerrada: NO implementadas** (requieren backend + Web Push; ver `docs/NOTIFICACIONES.md`). Hoy funcionan con la app abierta, con aviso atrasado al abrirla.
- **Sin autenticación ni sincronización** en esta versión (almacenamiento local).
- **PDF** vía impresión del navegador (*Guardar como PDF*) con el logo de NEXORA.
- Los saldos iniciales cuentan desde la *fecha de apertura* de cada cuenta.

## Despliegue
Sitio 100 % estático: GitHub Pages, Netlify, Vercel o Cloudflare Pages (publicar la raíz del repositorio, sin build). **Usa HTTPS** para service worker y notificaciones. Para actualizar, sube un nuevo commit; el service worker usa "red primero".

## Pruebas
`npm test` cubre: transferencia propia (A), gasto (B), ingreso (C), tarjeta de crédito (D), pendiente sin efecto (E) y pago parcial (F), editar/eliminar/anular (G), periodos exactos día/semana/mes/año (I), préstamos, reembolsos, ajustes, metas, presupuestos, recurrentes, revisión diaria, zona horaria y copias de seguridad. Las pruebas H (persistencia al recargar) y J (recordatorio con reloj simulado) se verificaron en navegador real con Playwright.
