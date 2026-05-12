# 🌸 Setup paso a paso

Esta guía te lleva de cero a producción. Seguila en orden, no te saltees pasos.

**Tiempo estimado**: 2-3 horas la primera vez, después 15 minutos.

---

## ✅ Antes de arrancar

Tenés que tener:

- [ ] Cuenta en [Supabase](https://supabase.com) (gratis)
- [ ] Cuenta en [Mercado Pago](https://www.mercadopago.com.ar) con tu CUIT
- [ ] Cuenta en [Vercel](https://vercel.com) (gratis)
- [ ] Cuenta de [Google Play Developer](https://play.google.com/console) ($25 USD pago único, **solo para subir la app**)
- [ ] Node.js 20+ instalado en tu compu ([descargar](https://nodejs.org))

---

## 🌸 Parte 1 — Supabase (la base de datos)

### 1.1 Crear el proyecto

1. Andá a https://supabase.com → "New project"
2. Region: **South America (São Paulo)**
3. Nombre: `cancerianas`
4. Contraseña de la DB: poneles una FUERTE y guardala donde no la pierdas
5. Esperá que termine de crearse (1-2 min)

### 1.2 Correr el SQL del schema

1. En tu proyecto de Supabase, andá a **SQL Editor** (panel lateral izquierdo)
2. Click en "+ New query"
3. Abrí el archivo `supabase/migrations/20260504000000_initial_schema.sql` de este repo y **copiá todo el contenido**
4. Pegalo en el SQL Editor de Supabase y dale **Run** (esquina inf. derecha)
5. Repetir con `supabase/migrations/20260504000001_stock_functions.sql`

Si todo salió bien, vas a ver "Success. No rows returned".

### 1.3 Verificar que las tablas se crearon

Andá a **Table Editor** (panel lateral). Tenés que ver: `profiles`, `products`, `categories`, `orders`, `order_items`, `live_events`, `live_offers`, `live_purchases`, etc.

### 1.4 Crear bucket de Storage para imágenes

1. Andá a **Storage** (panel lateral)
2. Click en "New bucket"
3. Nombre: `products`
4. Tildá **"Public bucket"** (importante)
5. Click en Create

### 1.5 Habilitar Realtime en las tablas LIVE

1. Andá a **Database → Replication**
2. Buscá la tabla `live_events` → activala
3. Hacé lo mismo con `live_offers`, `live_purchases`, `live_chat_messages`

(Si el SQL inicial ya las activó vas a ver el toggle en ON)

### 1.6 Copiar las credenciales

1. Andá a **Settings → API**
2. Copiá estos 3 valores y guardalos:
   - **Project URL** → será tu `SUPABASE_URL`
   - **anon public** key → será tu `SUPABASE_ANON_KEY`
   - **service_role** key (revelar) → será tu `SUPABASE_SERVICE_ROLE_KEY` ⚠️ NUNCA la subas a git

---

## 🌸 Parte 2 — Mercado Pago

### 2.1 Conseguir las credenciales

1. Entrá a https://www.mercadopago.com.ar/developers/panel/app
2. Click en "Crear aplicación"
3. Modelo de integración: **Pagos online (Checkout Pro)**
4. Nombre: `Cancerianas`
5. Una vez creada, en el menú lateral andá a **Credenciales de producción**
6. Copiá el **Access Token de producción** (empieza con `APP_USR-...`)

> ⚠️ **Para desarrollo / testing**: usá las credenciales de TEST mientras probás. Cambiá a producción cuando estés lista para vender en serio.

### 2.2 Configurar webhook (después del paso 3)

Esto lo hacemos más adelante, después de desplegar las Edge Functions.

---

## 🌸 Parte 3 — Edge Functions (lógica de Mercado Pago)

Estas son funciones que corren en Supabase y se conectan con Mercado Pago.

### 3.1 Instalar Supabase CLI

```bash
# Mac
brew install supabase/tap/supabase

# Windows (con Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
curl -fsSL https://supabase.com/install.sh | sh
```

### 3.2 Login y vincular proyecto

```bash
cd cancerianas-app
supabase login
supabase link --project-ref TU_PROJECT_REF
```

(`TU_PROJECT_REF` lo sacás del URL del dashboard: `https://supabase.com/dashboard/project/AQUI_TU_REF/...`)

### 3.3 Configurar las variables secretas

```bash
supabase secrets set MP_ACCESS_TOKEN="APP_USR-tu-access-token-aca"
supabase secrets set SITE_URL="https://cancerianas.com.ar"
```

(Reemplazá la URL por el dominio que vas a usar, o por tu URL de Vercel cuando lo despliegues)

### 3.4 Desplegar las funciones

```bash
supabase functions deploy create-payment-preference
supabase functions deploy webhook-mercadopago --no-verify-jwt
supabase functions deploy process-queue --no-verify-jwt
```

> El `--no-verify-jwt` es importante en webhook y process-queue porque MP y el cron no mandan JWT.

### 3.5 Configurar el cron job para expirar locks

En Supabase, andá a **Database → Extensions** y activá `pg_cron` y `pg_net`.

Después en **SQL Editor**:

```sql
SELECT cron.schedule(
  'expire-live-locks',
  '*/30 * * * * *',
  $$
    SELECT net.http_post(
      url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/process-queue',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SERVICE_ROLE_KEY_ACA',
        'Content-Type', 'application/json'
      )
    );
  $$
);
```

(Reemplazá `TU_PROJECT_REF` y `SERVICE_ROLE_KEY_ACA` por los tuyos)

### 3.6 Configurar el webhook en Mercado Pago

1. Volvé a https://www.mercadopago.com.ar/developers/panel/app
2. Tu app → **Webhooks** → Configurar notificaciones
3. URL: `https://TU_PROJECT_REF.supabase.co/functions/v1/webhook-mercadopago`
4. Eventos: tildá **Pagos**
5. Modo: producción
6. Guardar

---

## 🌸 Parte 4 — Web app (Next.js)

### 4.1 Instalar dependencias

Desde la raíz del proyecto:

```bash
npm install
```

### 4.2 Configurar variables de entorno

```bash
cd apps/web
cp .env.example .env.local
```

Editá `.env.local` y poné tus 3 valores de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 4.3 Probar localmente

```bash
cd ../..   # volver a la raíz
npm run web:dev
```

Abrí http://localhost:3000 — deberías ver la home de Cancerianas.

### 4.4 Crear tu cuenta y hacerla admin

1. En la web local, andá a `/auth` y registrate con tu email
2. Volvé al SQL Editor de Supabase y corré:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'TU_EMAIL@ejemplo.com';
```

3. Cerrá sesión y volvé a entrar
4. Ahora vas a poder entrar a `/admin`

### 4.5 Desplegar a Vercel

```bash
# instalar Vercel CLI si no la tenés
npm i -g vercel

cd apps/web
vercel
```

Seguí los pasos del wizard:
- "Set up and deploy?" → Sí
- Vincular con cuenta de Vercel
- Project name: `cancerianas-web`
- Override settings: No

Después, en el dashboard de Vercel → tu proyecto → Settings → Environment Variables, agregá las mismas 3 variables del `.env.local`.

Volvé a desplegar:

```bash
vercel --prod
```

¡Tu web ya está online en Vercel!

### 4.6 Conectar tu dominio (opcional)

En Vercel → tu proyecto → Settings → Domains → Add → escribí tu dominio. Vercel te dice qué registros DNS poner en tu registrador (Nominalia, NIC.ar, GoDaddy, etc.).

---

## 🌸 Parte 5 — App móvil (Android)

### 5.1 Configurar variables de entorno

```bash
cd apps/mobile
cp .env.example .env
```

Editá `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### 5.2 Probar en tu Android

1. Bajá la app **Expo Go** del Play Store en tu teléfono
2. Desde la raíz del proyecto:

```bash
npm run mobile:start
```

3. Escaneá el QR que aparece en la terminal con la app Expo Go
4. ¡Ya tenés Cancerianas corriendo en tu cel!

### 5.3 Build para Google Play

Necesitás Expo EAS:

```bash
npm i -g eas-cli
eas login
cd apps/mobile
eas build:configure
eas build --platform android --profile production
```

Esto te genera un archivo `.aab` que subís a Google Play Console.

### 5.4 Subir a Google Play

1. Andá a https://play.google.com/console
2. Crear nueva app → Cancerianas
3. Llená la ficha (descripción, screenshots, política de privacidad)
4. En "Producción" → "Crear nueva versión" → subí el `.aab`
5. Esperá 1-2 semanas la revisión de Google

---

## 🌸 Parte 6 — Hacer tu primer LIVE

### 6.1 Cargar productos

1. Andá a `/admin/products/new`
2. Llená nombre, precio, stock, imagen, categoría
3. Estado: **Activo**
4. Guardar

### 6.2 Crear evento LIVE

1. `/admin/live/new`
2. Elegí tipo: cápsulas, sobres o bolsitas
3. Título: "LIVE Sábado a la noche"
4. Agregá las ofertas: nombre, precio, stock
5. Crear (queda en estado "draft")

### 6.3 Día del LIVE

1. Andá a `/admin/live/[id]` (panel de control)
2. Click en "ARRANCAR LIVE" → el evento pasa a **active**
3. Compartí el link `https://cancerianas.com.ar/live/[id]` por TikTok / Instagram
4. Empezás a transmitir en TikTok Live como siempre
5. Mientras hablás, en el panel:
   - **Cápsulas**: las clientas compran libre, vos solo mirás
   - **Sobres**: vas clickeando "Liberar siguiente sobre" cuando presentás cada uno
   - **Bolsitas**: tocás "Abrir fila" cuando estás lista para que entren

### 6.4 Después del LIVE

1. "Finalizar" en el panel
2. Andá a `/admin/orders` para ver todas las compras
3. Marcalas como "preparando" → "enviada" → "entregada" mientras vas despachando

---

## 🆘 Si algo no funciona

### "Cannot find module @cancerianas/shared"
Asegurate de correr `npm install` desde la raíz del proyecto, no desde `apps/web`.

### "Invalid API key" o "Unauthorized" en Supabase
Revisá que las variables de entorno estén bien copiadas (sin espacios al final).

### Los pagos no se confirman automáticamente
1. Revisá que el webhook esté bien configurado en Mercado Pago
2. Andá a Supabase → Edge Functions → webhook-mercadopago → Logs
3. Mirá si llegan notificaciones

### El cron no expira los locks
1. Verificá que `pg_cron` y `pg_net` estén habilitados
2. Corré: `SELECT * FROM cron.job;` para ver los jobs
3. Mirá los logs en Edge Functions → process-queue

### "Realtime no actualiza en vivo"
1. Verificá en Database → Replication que las 4 tablas LIVE estén activadas
2. Cerrá y abrí la página

---

## 💗 Listo

Si llegaste hasta acá, tenés:

✅ Web online en Vercel
✅ App Android lista
✅ Pagos con Mercado Pago funcionando
✅ Sistema LIVE con 3 dinámicas
✅ Panel admin completo

A vender se ha dicho 🌸
