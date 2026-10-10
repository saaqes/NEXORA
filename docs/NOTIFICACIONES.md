# Recordatorios y notificaciones en NEXORA

## Qué hace la versión actual (100 % cliente)

| Escenario | ¿Funciona? | Cómo |
|---|---|---|
| App abierta (pestaña o PWA, en primer o segundo plano) | ✅ | `js/reminders.js` revisa cada 15 s la hora en **America/Bogota** (o la zona configurada) y muestra el aviso dentro de la app. |
| App abierta + permiso de notificaciones | ✅ | Además lanza una notificación del navegador (vía `ServiceWorkerRegistration.showNotification`). |
| App abierta **después** de la hora configurada | ✅ (aviso atrasado, una sola vez) | Al abrir, si la hora ya pasó y el día no está revisado, se muestra el aviso y se avisa de que fue atrasado. |
| **App cerrada** | ❌ **No funciona** | Un sitio web no puede ejecutar código programado cuando el navegador lo cerró. NEXORA no lo simula. |

**Sin duplicados:** cada aviso se registra en `localStorage` (`nexora.fired.v1`) con la clave `tipo|fecha`; "Recordármelo más tarde" guarda un `snooze|fecha` con la marca de tiempo.

## Requisitos del navegador
- **Permiso explícito**: `Notification.requestPermission()` solo se llama al pulsar *Permitir notificaciones* en Configuración.
- **HTTPS** (o `http://localhost`): obligatorio para service workers y notificaciones.
- **Service worker** (`sw.js`): cachea la app para uso sin conexión y muestra notificaciones.
- Compatibilidad: Chrome/Edge/Firefox/Safari 16.4+ (en iOS, solo si la PWA está instalada en la pantalla de inicio).

## Cómo obtener avisos fiables con la app cerrada (arquitectura propuesta)
1. **Backend** (p. ej. Supabase Edge Functions, Cloud Run o un servidor Node) con tabla `push_subscriptions(user_id, endpoint, p256dh, auth, timezone, reminder_time, days)`.
2. El cliente se suscribe con `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })` y envía la suscripción al backend (autenticada).
3. **Tarea programada** (cron cada minuto: `pg_cron`, Cloud Scheduler, GitHub Actions no recomendado por latencia): selecciona usuarios cuya hora local (según su `timezone`, p. ej. `America/Bogota`) coincide con `reminder_time`, cuyo día no está revisado y que no tienen un `reminder_log(user_id, date, kind)` ya enviado (**evita duplicados** con restricción UNIQUE).
4. El backend envía el **Web Push** con la librería `web-push` firmando con la clave privada VAPID (**solo en el servidor, nunca en el repositorio**).
5. `sw.js` ya incluye el manejador `push` y `notificationclick`, así que el cliente no necesita más cambios.

Alternativas: FCM (Firebase Cloud Messaging) para Android/Web, o correo/Telegram/WhatsApp Business como canal de respaldo.
