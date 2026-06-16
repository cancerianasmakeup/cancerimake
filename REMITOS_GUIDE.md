# Módulo de Remitos & Presupuestos - Guía de Uso

## 🎯 Descripción

El módulo de Remitos es una herramienta completa para generar presupuestos y remitos en vivo, con la capacidad de:

- ✅ Crear múltiples remitos simultáneamente (pestañas)
- ✅ Agregar productos con cantidad y precio automático
- ✅ Cálculo automático de totales y subtotales
- ✅ Generar PDF con membrete de Cancerianas
- ✅ Guardar remitos en localStorage (persistencia)
- ✅ Filtrar por estado (borradores/enviados)

## 📍 Ubicación

**URL:** `/admin/remitos`
**Componentes:**
- `apps/web/components/RemitosManager.tsx` - Gestor principal
- `apps/web/components/RemitoBrowser.tsx` - Vista de lista
- `apps/web/components/RemitosEditor.tsx` - Editor de remitos
- `apps/web/lib/remito-pdf.ts` - Generador de PDFs

## 🚀 Cómo Usar

### 1. Acceder al módulo
1. Ve a `/admin`
2. En el menú lateral, haz clic en **"Remitos"** (icono de documento)

### 2. Crear un nuevo remito
- Haz clic en el botón **"Nuevo Remito"**
- Se abrirá el editor en blanco

### 3. Llenar información de la clienta
- **Nombre** (requerido para generar PDF)
- **Email** (opcional)
- **Teléfono** (opcional)

### 4. Agregar items/productos
- Completa los campos en la sección "Items":
  - Producto: Nombre del artículo
  - Cantidad: Unidades (ej: 2, 0.5, etc.)
  - Precio: Precio unitario
- Haz clic en **"Agregar"**

### 5. Gestionar items
- **Editar:** Modifica directamente en la tabla
- **Eliminar:** Haz clic en el icono de papelera
- Los totales se actualizan automáticamente

### 6. Agregar notas
- En la sección "Notas" agrega términos, condiciones, instrucciones, etc.
- Aparecerá en el PDF final

### 7. Guardar remito
- Haz clic en **"💾 Guardar"**
- Se almacena automáticamente en localStorage

### 8. Generar PDF
- Haz clic en **"Descargar PDF"**
- Se descargará un PDF profesional con:
  - Membrete de Cancerianas
  - Información de la clienta
  - Tabla de productos
  - Cálculos: Subtotal, IVA (21%), Total
  - Notas y fecha

## 🎨 Diseño del PDF

El PDF incluye:
- **Encabezado Profesional:** 
  - Logo de Cancerianas (lado izquierdo)
  - Título "REMITO" destacado (lado derecho)
  - Nombre y descripción de Cancerianas
- **Información:** Número de remito, fecha, datos de la clienta
- **Tabla de items:** Producto, Cantidad, Precio, Total
- **Resumen:** Subtotal, IVA (21%), Total final
- **Pie:** Información de contacto y fecha de generación

### URL del Logo:
```
https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/logo%20solo%20(1).png
```

### Colores utilizados (Brand Cancerianas):
- Rose Deep (#E66B85)
- Rose Primary (#FF8FA3)
- Ink Primary (#3D2A33)
- Ink Secondary (#5C4853)

## 💾 Almacenamiento

Actualmente los remitos se guardan en **localStorage**. Para usar Supabase:

1. Crea tabla en Supabase:
```sql
CREATE TABLE remitos (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT now(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  items JSONB NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  user_id UUID REFERENCES profiles(id)
);
```

2. Actualiza `RemitosManager.tsx` para usar `supabase.from('remitos')`

## 🔄 Características adicionales

### Navegación entre remitos
- Vista de **"Browser"**: Lista todos los remitos
- Haz clic en **"Editar"** para abrir el editor
- Haz clic en **"Descargar PDF"** desde la lista

### Filtros
- **Todos:** Muestra todos los remitos
- **Borradores:** Remitos sin enviar
- **Enviados:** Remitos marcados como enviados

### Eliminar remito
- Haz clic en el icono de papelera
- Se pedirá confirmación

## 📱 Responsive

El módulo es **100% responsive**:
- Móvil: Vista apilada
- Tablet: Dos columnas
- Desktop: Tres columnas + sidebar

## ⚙️ Configuración futura

### Próximas mejoras (roadmap):
- [ ] Integración con base de datos (Supabase)
- [ ] Envío de PDF por email automático
- [ ] Historial de remitos por cliente
- [ ] Plantillas personalizables
- [ ] Exportación a Excel/CSV
- [ ] Numeración automática de remitos
- [ ] Firma digital
- [ ] Múltiples clientes simultáneamente (pestañas)

## 🖼️ Personalización del Membrete

Si quieres cambiar el logo o la información del membrete, edita estos archivos:

### Logo en PDF:
**Archivo:** `lib/remito-pdf.ts`
```typescript
const CANCERIANAS_LOGO =
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/logo%20solo%20(1).png";
```

### Nombre y descripción de empresa:
**Archivo:** `lib/remito-pdf.ts` (líneas ~43-48)
```typescript
doc.text("CANCERIANAS", margin, yPosition);
doc.text("Belleza & Moda Premium", margin, yPosition + 5);
doc.text("www.cancerianas.com", margin, yPosition + 9);
```

### Información en footer:
**Archivo:** `lib/remito-pdf.ts` (líneas ~180-183)
```typescript
doc.text(
  "Cancerianas - Belleza & Moda Premium | www.cancerianas.com",
  margin,
  yPosition
);
```

## 🐛 Troubleshooting

### El PDF no se descarga
- Verifica que tengas al menos un item
- Verifica que hayas completado el nombre de la clienta
- Intenta con otro navegador

### Los remitos desaparecen al refrescar
- Verifica que localStorage no esté deshabilitado
- Revisa la consola (F12) para errores

### El cálculo de IVA está mal
- El cálculo automático es del 21% (IVA Argentina estándar)
- Puedes cambiar el porcentaje en `RemitosEditor.tsx` línea del cálculo del IVA

## 📞 Soporte

Para agregar funcionalidades o reportar problemas, revisa:
- `components/RemitosManager.tsx`
- `components/RemitosEditor.tsx`
- `lib/remito-pdf.ts`
