# Notificaciones de drops — setup

La edge function `notify-drop-open` manda email + WhatsApp a las personas que dejaron su contacto en la landing cerrada (tabla `store_subscribers`).

> **Estado actual:** corre en **modo mock**. Si tocás "Notificar suscriptas" en `/admin/store`, vas a ver mensajes en los logs pero no se envía nada real. Para activar, cargá las credenciales de abajo.

---

## 1) Email vía Resend (recomendado)

[Resend](https://resend.com) es lo más simple para producción: 100 mails/día gratis, después USD 20 por 50k. Soporte de dominio propio con SPF/DKIM en 10 minutos.

### 1.1 Setup
1. Crear cuenta en https://resend.com
2. **Domains → Add domain** → `cancerianas.com.ar` (o el que uses).
3. Te da 3 records DNS (TXT/CNAME). Pegalos en tu provider (Cloudflare/Hostinger/etc).
4. Esperá la verificación (5-30 min).
5. **API Keys → Create API Key** → guardá el valor (sólo lo mostrá una vez).

### 1.2 Cargar secrets en Supabase
Dashboard → Project Settings → Edge Functions → Manage secrets:
```
RESEND_API_KEY = re_XXXXXXXXXXXXXXXX
RESEND_FROM    = Cancerianas <ofertas@cancerianas.com.ar>
```

> El `RESEND_FROM` tiene que usar un dominio que verificaste. Si todavía no tenés dominio propio, podés usar `onboarding@resend.dev` (sólo dev, no llega a inbox).

### 1.3 Probar
```powershell
$base = "https://qccfsbjshlomvyfabtra.supabase.co/functions/v1/notify-drop-open"
$body = '{ "dropId": "<id-de-un-drop-existente>" }'
Invoke-RestMethod -Method Post -Uri $base -ContentType "application/json" -Body $body `
  -Headers @{ "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY" }
```

Respuesta esperada:
```json
{ "ok": true, "drops": 1, "notified": 5, "errors": 0, "perDrop": { "...": { "sent": 5, "errors": 0 } } }
```

---

## 2) WhatsApp vía Twilio (opcional)

WhatsApp tiene un onboarding más pesado (Meta Business Manager + número aprobado + plantillas). Hasta que lo termines, dejalo en mock.

### 2.1 Setup rápido (sandbox para testing)
1. Crear cuenta en https://www.twilio.com
2. **Messaging → Try it out → Send a WhatsApp message** → te suscribís al sandbox enviando "join <código>" desde tu celular al `+1 415 523 8886`.
3. En **Console** copiá `Account SID` y `Auth Token`.

### 2.2 Cargar secrets
```
TWILIO_ACCOUNT_SID    = ACxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN     = <token>
TWILIO_WHATSAPP_FROM  = whatsapp:+14155238886       # sandbox; en prod usá tu número aprobado
```

> En sandbox sólo funciona para los números que se "joinearon". Para producción tenés que aprobar tu número y plantillas. Recién ahí podés mandar a cualquier WhatsApp.

### 2.3 Producción
- Aprobá un número WhatsApp Business (toma 1-3 días).
- Creá un **template** aprobado con el texto de aviso (Twilio te guía).
- En `_shared/notify.ts`, la función `sendWhatsApp()` actualmente manda texto libre — fuera del sandbox necesitás mandar **template variables** (cambio menor en el body).

---

## 3) Variables opcionales

```
SITE_URL               = https://cancerianas.com.ar     # url base que va en los CTAs del mail
BRAND_NAME             = Cancerianas
BRAND_LOGO_URL         = https://pub-xxx.r2.dev/cancerianas/LOGO.png
NOTIFY_WINDOW_MINUTES  = 10                              # cuántos minutos antes/después del start_at considera "abriendo ahora" cuando la function corre por cron
```

---

## 4) Ejecución automática (cron)

La function ya soporta ser invocada **sin body** para el modo cron: busca drops cuyo `starts_at` esté en los próximos `NOTIFY_WINDOW_MINUTES` y notifica los nuevos.

### 4.1 Con `pg_cron` de Supabase (gratis, recomendado)
En SQL Editor:

```sql
-- Habilitar pg_cron + pg_net (sólo una vez)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net   WITH SCHEMA extensions;

-- Job cada 5 min: invocar notify-drop-open sin body
SELECT cron.schedule(
  'notify-drop-open-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qccfsbjshlomvyfabtra.supabase.co/functions/v1/notify-drop-open',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Y guardá tu service role key como GUC:
```sql
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJ...';
```

> ⚠️ **No** pongas la service role key en el repo. Se carga una vez en SQL Editor y queda en la DB.

### 4.2 Alternativa simple: GitHub Action
Si preferís evitar `pg_cron`, podés hacer un workflow que cada 5min haga `curl` a la edge function. Pero `pg_cron` es más confiable y no consume minutos de Actions.

---

## 5) Idempotencia

La function es idempotente: cada subscriber tiene un array `notified_drops`. Si la function se ejecuta dos veces para el mismo drop, los suscriptores que ya recibieron aviso son ignorados.

Si querés **reenviar** a alguien:
```sql
UPDATE store_subscribers
SET notified_drops = notified_drops - '<dropId>'::uuid
WHERE id = '<subscriber-id>';
```

---

## 6) Flujo completo

```
1. Visitante entra a la web (TikTok) → tienda cerrada → landing
2. Deja email + whatsapp → INSERT en store_subscribers
3. Vos creás un drop en /admin/store con starts_at = viernes 20:00
4. (auto) cron corre cada 5 min y a las 19:55-20:05 detecta drop abriendo
5. Itera subscribers no notificados → manda email/wa → marca notified_drops
6. La gente entra desde el link → tienda ya está abierta (drop activo) → compra
```

O en modo manual:
```
1-3. Igual
4. Vos tocás "Notificar suscriptas" en el botón del drop en /admin/store
5-6. Igual
```

---

## 7) Auditoría

Cada send queda en logs de la edge function (Dashboard → Edge Functions → notify-drop-open → Logs). En modo real Resend tiene su propio panel con bounces/opens/clicks; Twilio idem.

---

## 8) Recordatorios de envío pendiente (`notify-pending-shipment`)

Cuando una clienta paga productos pero no completa el envío (no carga dirección, no elige carrier, no paga la cotización personalizada), la function `notify-pending-shipment` le manda recordatorios:

- **1er recordatorio**: 24hs después de que se le mandó el link inicial (o 24hs después de que admin cargó la cotización custom).
- **2do recordatorio**: 72hs después.
- Después del 2do, **no se mandan más recordatorios automáticos** — el producto sigue reservado.
- **No hay reembolso automático.** El stock queda apartado a su nombre hasta que pague.

### Cron cada 1 hora

En SQL Editor (asumiendo que ya tenés `pg_cron` y `app.settings.service_role_key` cargados del paso 4.1):

```sql
SELECT cron.schedule(
  'shipment-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qccfsbjshlomvyfabtra.supabase.co/functions/v1/notify-pending-shipment',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

La function busca shipments en status `pending_address`, `pending_custom_quote` o `pending_payment` con `reminder_count < 2` y decide quién toca recordar según los timestamps. Tiene cooldown interno de 24h entre recordatorios para no spamear si el cron corre seguido.

### Forzar manualmente
Desde admin podés invocar la function con un `shipmentId` específico:
```
POST /functions/v1/notify-pending-shipment
Authorization: Bearer <service-role>
Body: { "shipmentId": "uuid-del-shipment" }
```

### Resetear recordatorios
Si querés que un shipment vuelva al estado "no se le envió ningún recordatorio":
```sql
UPDATE shipments
SET reminder_count = 0, last_reminder_at = NULL
WHERE id = '<shipment-id>';
```

---

## 9) Mensaje de cotización personalizada (`notify-custom-quote`)

Cuando admin carga el precio en `/admin/shipments/<id>` y toca "Guardar y avisar a la clienta", se invoca esta function con el `shipmentId`. Le manda mail + WA con el monto cotizado, el mensaje opcional del admin y el link directo al wizard.

No requiere cron. Es un trigger manual desde la UI.
