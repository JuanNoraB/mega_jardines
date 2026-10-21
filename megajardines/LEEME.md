# Mega Jardines – sitio web

Sitio estático (HTML, CSS y JS). No necesita base de datos ni servidor especial.

## Estructura
- `index.html`, `productos.html`, `servicios.html`, `terminos.html`, `privacidad.html`
- `assets/app.js`: datos de contacto (WhatsApp, correo, redes). Se cambian aquí y se actualiza todo el sitio.
- `assets/data.js`: catálogo (563 productos con precio) y galerías de servicios.
- `assets/catalog.js`: buscador, filtros y orden del catálogo.
- `assets/cart.js`: carrito de pedidos. Se guarda en el navegador del cliente y el pedido se envía por WhatsApp o por correo (no hay pagos en línea ni servidor).
- `img/`: todas las imágenes (753), optimizadas para web.

- `pedido.html`: muestra un pedido con fotos a partir del enlace que va en el mensaje (`pedido.html?p=97x3,98x1`). Su vista previa en WhatsApp usa `img/og-pedido.jpg`; si el sitio queda en otro dominio, cambiar las URL `og:` de esa página.

## Inventario (Google Sheets + Drive)
- La hoja **Inventario_megajardines** es la fuente de datos. Columnas: `codigo | activo | tipo | categoria | nombre | precio | foto | descripcion`.
  - Quitar un producto: `activo` = `no` (o borrar la fila). Precio vacío = "consultar precio".
  - Producto nuevo: subir la foto a la carpeta **Inventario_imagenes** de Drive (compartida con enlace), copiar su enlace y pegarlo en `foto`.
- Para pasar los cambios a la web, desde la carpeta del proyecto:
  `powershell -ExecutionPolicy Bypass -File sincronizar.ps1`
  Descarga la hoja, baja y optimiza las fotos nuevas en `img/productos/`, y regenera `assets/data.js`, `data/inventario.csv` (respaldo) y el CSV del bot.
  Si la hoja está vacía o le falta una columna, no toca la web. Con `-Simular` muestra qué haría sin escribir.

## Métricas (Google Analytics 4)
1. Crear una propiedad en analytics.google.com (tipo "Web") y copiar el **ID de medición** (`G-XXXXXXXXXX`).
2. Pegarlo en `assets/app.js` → `ga4Id`.
3. Eventos que se registran: `add_to_cart`, `remove_from_cart`, `view_cart`, `generate_lead` (pedido enviado, con método y valor), `search`, `search_no_results` (qué buscan y no encuentran), `select_category`, `contact_whatsapp`, `contact_email`, `social_click`, `view_shared_order`.
   Para ver detalles de cada evento en los informes, registrar sus parámetros como "dimensiones personalizadas" en GA4 (Administrar → Definiciones personalizadas).

## Pendiente del cliente
- Completar RUC y dirección en `terminos.html` y `privacidad.html` (buscar `[completar]`).
- Precios de tierras y abonos, si se quieren mostrar.

## Cómo publicar
1. Recuperar el acceso al dominio `megajardines.com` con el registrador donde está inscrito.
2. Subir la carpeta completa a cualquier hosting estático (Netlify, Vercel, Cloudflare Pages o un hosting compartido por FTP).
3. Apuntar el dominio (DNS) al nuevo hosting.

## Editar precios o productos
Abrir `assets/data.js`, buscar el producto por nombre y cambiar el campo `"p"` (precio).
