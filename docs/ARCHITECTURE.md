# 🌸 Arquitectura técnica

## Stack

- **Frontend Web**: Next.js 15 (App Router) + React 19 + Tailwind
- **Frontend Mobile**: Expo SDK 52 + Expo Router 4 + React Native 0.76
- **Backend**: Supabase (PostgreSQL 15 + Realtime + Auth + Storage + Edge Functions Deno)
- **Pagos**: Mercado Pago Checkout Pro (Argentina)

## Decisión clave: el LIVE en TikTok, NO dentro de la app

Hicimos esto a propósito:

- ✅ **Costo**: $0 vs $200-800 USD/hora si usáramos Agora/LiveKit
- ✅ **Latencia**: TikTok Live llega a millones de personas con calidad probada
- ✅ **Foco**: La app no se complica con video, solo gestiona inventario, pagos y cola

Lo que sí pasa **dentro de la app/web**:
- Catálogo de cápsulas, sobres o bolsitas con stock en tiempo real
- Botón "Comprar ahora" / "Sumarme a la fila"
- Lock de 3 minutos para pagar con Mercado Pago
- Avance automático de la fila cuando alguien se vence
- Panel admin con ventas en vivo

## Las 3 dinámicas LIVE

### 💊 Cápsulas
- **Cuándo**: cuando tenés stock fijo y querés que se venda libre.
- **Cómo funciona**:
  - El admin crea las cápsulas con su stock total.
  - Al arrancar el LIVE, las clientas pueden comprar libremente mientras haya stock.
  - Si se agota una, se desactiva.
  - **No hay fila**, es por orden de llegada hasta que se agote.

### ✉️ Sobres
- **Cuándo**: cuando vos querés controlar el ritmo y presentar cada sobre uno por uno.
- **Cómo funciona**:
  - Tenés N sobres totales (ej: 30) pero NINGUNO está disponible al inicio.
  - Mientras hablás, vas clickeando **"Liberar siguiente sobre"** y se hace disponible 1 más.
  - Quien lo agarra primero, se lo lleva.
  - Se acumula una fila de espera para los siguientes.

### 🎀 Bolsitas
- **Cuándo**: para vender tandas grandes con orden de llegada justo.
- **Cómo funciona**:
  - Vos abrís la fila ("Abrir fila" desde el panel).
  - Las clientas se anotan y se les da posición #1, #2, #3...
  - El primero pasa a estado "pagando" con 3 minutos.
  - Si paga, se confirma y avanza la fila.
  - Si no paga, se libera y avanza el siguiente automáticamente.

## Flujo de compra LIVE (paso a paso)

```
1. Cliente toca "Comprar"
   ↓
2. RPC buy_live_offer() en Postgres (atomic, FOR UPDATE)
   ├── Si hay stock libre → status: "paying", lock 3 min
   └── Si no hay → status: "queued", queue_position++
   ↓
3. Cliente ve countdown o posición en fila (vía Realtime)
   ↓
4. Cuando es su turno y status="paying":
   ↓
5. Cliente toca "Pagar con Mercado Pago"
   ↓
6. Edge Function create-payment-preference crea preferencia en MP
   ↓
7. Cliente redirige a checkout.mercadopago.com
   ↓
8. Cliente paga
   ↓
9. MP llama a webhook Edge Function webhook-mercadopago
   ↓
10. Webhook consulta /v1/payments/{id} en MP API (NO confía en webhook)
    ↓
11. Si status="approved":
    ├── RPC confirm_live_payment() crea la orden
    ├── Decrementa stock
    └── Marca live_purchase como "paid"
    ↓
12. Realtime notifica al cliente: "¡Pago confirmado!"
    ↓
13. Cliente ve confirmación, admin ve en su panel "+1 venta"
```

## Defensa contra concurrencia

Esto es crucial porque pueden estar 1000 clientas tocando "Comprar" al mismo tiempo:

1. **`buy_live_offer()` usa `FOR UPDATE`** sobre el row de `live_offers`. Esto serializa todas las compras de una misma oferta — solo una transacción a la vez puede modificar `reserved_count`.

2. **Lock de 3 minutos**: cuando alguien pasa a "paying", se reserva el stock. Si no paga en 3 min, se expira y avanza la siguiente.

3. **Cron `process-queue` cada 30s**: corre `expire_old_locks()` que libera locks vencidos y promueve al siguiente en la cola.

4. **Webhook idempotente**: si MP manda 2 notificaciones del mismo pago, `confirm_live_payment` chequea si ya estaba "paid" y devuelve igual sin duplicar.

## Row Level Security (RLS)

Todas las tablas tienen RLS activado:

- **profiles**: cada usuario ve solo el suyo. Admins ven todos.
- **products / categories**: lectura pública (solo activos), escritura solo admin.
- **carts / cart_items**: solo el dueño.
- **orders**: cliente ve los suyos, admin ve todos. Solo admin puede actualizar.
- **live_purchases**: cliente ve los suyos, admin ve todos. Las inserciones se hacen vía RPC con `SECURITY DEFINER`.

## Realtime channels

Las 4 tablas críticas tienen Realtime activado:
- `live_events` — para detectar cambios de estado (active/paused)
- `live_offers` — para actualizar stock en vivo
- `live_purchases` — para que el admin vea compras llegando + para que el cliente sepa cuando pasa de queued → paying
- `live_chat_messages` — para el chat (opcional, no implementado en UI por ahora)

## Schema simplificado

```
profiles ─┬─ addresses
          ├─ carts ── cart_items ── products ── product_variants
          ├─ orders ─ order_items
          └─ live_purchases ─ live_offers ─ live_events
```

## Mobile vs Web: qué comparten

- **packages/shared/src/types.ts**: TypeScript types idénticos
- **Cliente Supabase**: mismo schema, mismas RPCs
- **Branding**: paleta, logo, tagline coinciden
- **Lógica de negocio**: 100% en Postgres, los frontends solo consumen

## Mobile vs Web: qué cambia

- **Pago**: web redirige a Mercado Pago, mobile abre WebBrowser de Expo (vuelve solo)
- **Auth storage**: web usa cookies SSR, mobile usa AsyncStorage
- **Realtime**: igual en ambos
- **Estilos**: web Tailwind, mobile StyleSheets en línea
- **Routing**: web Next.js App Router, mobile Expo Router

## Costos mensuales estimados (en producción)

| Servicio | Free tier alcanza para | Cuándo escalar |
|----------|------------------------|-----------------|
| Supabase | ~50k MAU | Pro: $25 USD/mes a partir de 100k MAU |
| Vercel | Hobby: dominio + tráfico moderado | Pro: $20 USD/mes para mejor performance |
| Mercado Pago | $0 fijo, comisión por transacción | n/a |
| Google Play | $25 USD único | n/a |

**Total inicial**: $25 USD (Google Play, único)
**Total mensual mientras esté chico**: $0
**Total mensual escalando**: ~$45 USD

## Performance esperada

- LIVE con **1.000 viewers concurrentes**: funciona perfecto en free tier
- LIVE con **5.000 concurrentes**: probablemente necesites Supabase Pro
- LIVE con **10.000+**: escalar a Supabase Team + Vercel Pro

El cuello de botella suele ser Realtime, no Postgres ni Edge Functions.
