# 🌸 Cancerianas

Plataforma de e-commerce + LIVE shopping. Web + App Android.

> Para mujeres libres.

## Qué tiene

- **Web (Next.js 15)** — tienda completa, checkout con Mercado Pago, panel admin, módulo LIVE.
- **App móvil (React Native + Expo)** — espejo de la web, lista para Google Play.
- **Backend (Supabase)** — PostgreSQL, autenticación, Storage, Realtime, Edge Functions.
- **Pagos (Mercado Pago)** — Checkout Pro con webhook automático.

## Estructura

```
cancerianas/
├── apps/
│   ├── web/           Next.js 15 — tienda web + panel admin
│   └── mobile/        Expo (React Native) — app Android/iOS
├── packages/
│   └── shared/        Tipos TypeScript compartidos
├── supabase/
│   ├── migrations/    SQL del schema, RLS, funciones
│   └── functions/     Edge Functions (Mercado Pago)
└── docs/              Documentación
```

## Para arrancar

Leé **[SETUP.md](./SETUP.md)** — instrucciones paso a paso, en orden, en español.

Resumen rápido:

1. Crear proyecto en Supabase y correr el SQL
2. Pegar variables de entorno en `.env.local`
3. Desplegar Edge Functions a Supabase
4. Configurar webhook en Mercado Pago
5. `npm install` desde la raíz
6. `npm run web:dev` para web, `npm run mobile:start` para mobile

## Módulo LIVE

Tres dinámicas con mecánicas distintas:

| Tipo | Cómo funciona |
|------|----------------|
| **💊 Cápsulas** | Stock fijo. Se vende mientras haya. Sin fila. |
| **✉️ Sobres** | Vos liberás los sobres uno por uno desde el panel admin mientras los presentás en TikTok. |
| **🎀 Bolsitas** | Fila por orden de llegada. Vos abrís y cerrás la fila desde el panel. |

El video sigue siendo en TikTok Live (sin costos extra de streaming). La app maneja inventario, pagos, cola y notificaciones en tiempo real.

## Stack

- Next.js 15 + React 19 (App Router)
- Expo SDK 52 + Expo Router 4
- Supabase (Postgres + Realtime + Auth + Storage + Edge Functions)
- Mercado Pago Checkout Pro
- Tailwind CSS (web) / StyleSheets (mobile)
- TypeScript en todo

## Licencia

Propiedad de Cancerianas. Todos los derechos reservados.
