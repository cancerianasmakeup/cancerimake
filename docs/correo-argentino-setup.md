# Correo Argentino — Setup de credenciales

Este doc explica cómo activar el carrier **Correo Argentino** en producción. El código ya está listo (`supabase/functions/_shared/correo.ts` + función `shipping`/`andreani`), sólo falta cargar los secrets reales para que los envíos salgan a tu nombre.

> Estado actual: la función corre en **modo `mock`** (devuelve cotizaciones falsas para desarrollo). Para flipear a real, seguí los pasos de abajo.

---

## 1) Conseguir las credenciales de Correo Argentino

Correo Argentino no tiene auto-onboarding como Andreani. Las credenciales se piden por formulario y te las mandan por mail. Vas a necesitar **cuatro datos**:

| Variable | De dónde sale |
|---|---|
| `CORREO_USER_TOKEN` | Te lo da Correo Argentino al firmar convenio |
| `CORREO_PASSWORD_TOKEN` | Idem (es como un user/pass de aplicación) |
| `CORREO_EMAIL` | Tu mail de **MiCorreo** (cuenta web, donde te factura) |
| `CORREO_PASSWORD` | La password de esa cuenta MiCorreo |

### Pasos
1. Entrá a [https://www.correoargentino.com.ar/MiCorreo](https://www.correoargentino.com.ar/MiCorreo) y verificá que tu cuenta esté activa, con CUIT cargado y datos fiscales OK. **Lo que factures sale a este nombre.**
2. Pedí el alta a la API completando el formulario oficial que te van a indicar (típicamente vía mail a `tecnologia@correoargentino.com.ar` o un Google Form que mandan desde MiCorreo).
3. Te van a responder con el `userToken` y `passwordToken` para **TEST** primero, y después de homologar, los de **PROD**.
4. (Opcional) Pedíles también el `customerId`. Si no te lo dan, no pasa nada: la función lo obtiene automáticamente con tu email/password vía `/users/validate`.

> **Tip de seguridad:** los `userToken`/`passwordToken` no son tu login web. Son credenciales de aplicación. Si se filtran las podés rotar pidiéndoselas de nuevo a Correo. Pero **`CORREO_EMAIL`/`CORREO_PASSWORD` sí son tu login real de MiCorreo** — esas son las que tenés que cuidar más. Por eso van **sólo en el backend (Supabase)**, nunca en la app.

---

## 2) Cargar los secrets en Supabase

En tu proyecto Supabase (`qccfsbjshlomvyfabtra`):

**Dashboard**: `Project Settings → Edge Functions → Manage secrets → Add secret`

Cargá uno por uno:

```
CORREO_MODE              = sandbox      # arrancá acá; cuando esté homologado pasá a "production"
CORREO_USER_TOKEN        = <el que te mandó Correo>
CORREO_PASSWORD_TOKEN    = <el que te mandó Correo>
CORREO_EMAIL             = <tu mail de MiCorreo>
CORREO_PASSWORD          = <tu password de MiCorreo>
CORREO_CUSTOMER_ID       = <opcional — si no lo tenés, dejalo vacío>
```

**Por CLI** (alternativa):
```powershell
supabase secrets set CORREO_MODE=sandbox `
  CORREO_USER_TOKEN=xxx `
  CORREO_PASSWORD_TOKEN=xxx `
  CORREO_EMAIL=tucuenta@dominio.com `
  CORREO_PASSWORD=xxxxx
```

> Los valores quedan encriptados en el panel y los lee la edge function vía `Deno.env.get(...)`. **No quedan en el repo, no quedan en logs, no viajan a la app.**

---

## 3) Probar end-to-end

### Cotizar (no requiere autenticación, es público)
```powershell
$base = "https://qccfsbjshlomvyfabtra.supabase.co/functions/v1/andreani"
$body = '{
  "action": "quote",
  "carrier": "correo_argentino",
  "cpDestino": "5500",
  "destinationType": "domicilio",
  "bultos": [{ "kilos": 0.5, "largoCm": 20, "anchoCm": 15, "altoCm": 5 }]
}'
Invoke-RestMethod -Method Post -Uri $base -ContentType "application/json" -Body $body
```

Si todo está bien vas a recibir algo como:
```json
{
  "rates": [{ "productType": "ENC_DOM", "productName": "Encomienda - Domicilio", "price": 4250, "deliveryTimeMin": "3", "deliveryTimeMax": "7" }],
  "bestRate": { ... },
  "validTo": "2026-..."
}
```

Si seguís en mock vas a ver `"raw": { "__mock": true }` en la respuesta — eso confirma que NO está pegándole a Correo todavía. Cuando subas `CORREO_MODE=sandbox` o `production` y los secrets, el `__mock` desaparece.

### Listar sucursales
```json
{ "action": "agencies", "carrier": "correo_argentino", "region": "Mendoza" }
```

### Crear envío después del pago
La function ya lo hace automático cuando una orden pasa a `paid` (ver flujo de `webhook-mercadopago` → `create-shipment`). No tenés que llamar a esta acción manualmente desde la app.

---

## 4) Pasaje a producción

1. Probá todo en `sandbox` con un par de envíos test.
2. Pedíle a Correo que te apruebe la homologación (te piden ver pedidos de prueba).
3. Cambiá UN solo secret: `CORREO_MODE=production`.
4. Cambiá `CORREO_USER_TOKEN`/`CORREO_PASSWORD_TOKEN` por los de PROD si te dan distintos.
5. **No hace falta redeployar la function** — los secrets se aplican en caliente.

---

## 5) Auditoría de seguridad — qué revisé del repo `YamilEzequiel/correo-argentino`

(Antes de portar la lib, audité el repo público que YamilEzequiel publicó como `ylazzari-correoargentino` en npm.)

| Punto | Estado |
|---|---|
| Servidores que llama | Sólo `api.correoargentino.com.ar` y `apitest.correoargentino.com.ar`. Cero terceros. |
| Dependencias | `axios` + `dotenv` (peer deps). Estándar. |
| Telemetría / analytics | Ninguna. |
| Maneja credenciales | Sí, pero solamente las envía a Correo Argentino. |
| Logs sensibles | ⚠️ Tiene `console.log` que imprime el token al obtenerlo. En **nuestra implementación** (`_shared/correo.ts`) eso ya está silenciado. |
| Genera etiquetas | ❌ En la lib externa el endpoint `/shipping/import` está pendiente. ✅ En **nuestra** implementación está completo. |

**Conclusión:** la lib externa es segura pero está incompleta. Por eso reimplementamos el cliente directamente en Deno dentro de `supabase/functions/_shared/correo.ts` con todos los endpoints, caché de token y modo mock. **No usamos ni instalamos `ylazzari-correoargentino`.**

---

## 6) Checklist final

- [ ] Cuenta MiCorreo activa con CUIT y datos fiscales.
- [ ] Tokens de TEST recibidos por mail.
- [ ] Secrets cargados en Supabase Dashboard → Edge Functions.
- [ ] `CORREO_MODE=sandbox` y prueba de `quote` exitosa (sin `__mock`).
- [ ] Homologación aprobada por Correo.
- [ ] Tokens de PROD cargados y `CORREO_MODE=production`.
- [ ] Primer envío real generado y rastreable en MiCorreo web.
