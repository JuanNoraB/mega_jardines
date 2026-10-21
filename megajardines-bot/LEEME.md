# Bot de WhatsApp – Mega Jardines

Proyecto aparte de la web. Responde en WhatsApp con menús numerados:

1. **Catálogo**: secciones → categorías → productos con precio (de 10 en 10) → foto del producto.
2. **Servicios**: los 5 servicios con lo que incluye cada uno.
3. **Buscar**: el cliente escribe "orquídea", "maceta", etc.
4. **Asesor**: pasa la conversación a una persona.

**Pasa a una persona** cuando el cliente escribe *asesor* (o *comprar*, *cotizar*, *pedido*…), cuando no se le entiende 2 veces seguidas, o cuando manda audio o foto. Le envía un link directo al WhatsApp del asesor con lo que estaba viendo, y el bot se queda callado 12 horas con ese cliente (vuelve si escribe *menú*).

Python 3.9+ y nada más (sin librerías externas).

## Archivos
- `bot.py`: todo el bot.
- `data/productos.csv`: catálogo (571 filas). Se edita en Excel; guardar como **CSV UTF-8**. Si `precio` queda vacío, el bot dice "consultar precio".
- `data/servicios.csv`: servicios. La columna `incluye` separa los puntos con `|`.
- `.env.example`: variables que hay que configurar.

## Probar en tu computadora (sin WhatsApp)
```
python bot.py --cli
```
Escribe como si fueras el cliente.

## Ponerlo en WhatsApp
1. **Número:** necesitas un número que **no** esté usado en la app de WhatsApp normal (puede ser un chip nuevo).
2. **Meta:** en developers.facebook.com crea una app tipo *Business*, agrega el producto **WhatsApp**, registra el número y copia el *Phone number ID*. Crea un token permanente con un *System User* en el Business Manager. Copia el *App Secret* de la configuración básica de la app.
3. **Servidor:** sube esta carpeta a un servicio que dé una URL **https** pública (Render, Railway, Fly.io o un VPS). Con el `Dockerfile` incluido basta. Configura ahí las variables de `.env.example`.
4. **Webhook:** en Meta → WhatsApp → Configuration, pon la URL del servidor y el mismo `WA_VERIFY_TOKEN`. Suscríbete al campo **messages**.
5. Escribe "hola" al número del bot.

## Costos
- Responder mensajes que el cliente inicia está dentro de la ventana gratuita de servicio de WhatsApp (revisar precios actuales en la página de Meta).
- El servidor: plan gratis o unos pocos dólares al mes.

## Límites conocidos
- La memoria de conversaciones vive en el servidor: si se reinicia, cada cliente vuelve a empezar desde el menú.
- Las imágenes se toman de la web publicada (`IMAGE_BASE_URL`), así que la web nueva debe estar en línea.
