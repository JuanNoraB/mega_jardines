# mega_jardines

Web de Mega Jardines (vivero y jardinería en Quito).

| Carpeta / archivo | Qué es |
|---|---|
| `megajardines/` | La web (HTML, CSS y JS estáticos). Se publica sola en GitHub Pages con cada push a `main`. |
| `megajardines-bot/` | Bot de WhatsApp (proyecto aparte, Python). Ver su `LEEME.md`. |
| `sincronizar.ps1` | Trae el inventario desde Google Sheets y las fotos nuevas desde Drive hacia la web y el bot. |

## Actualizar el catálogo
Es **automático**: todas las madrugadas (3:00, hora de Quito) GitHub Actions corre `sincronizar.ps1`
(`.github/workflows/sincronizar.yml`), guarda los cambios en el repo y publica la web. Si no hubo cambios, no hace nada.
Basta con editar la hoja **Inventario_megajardines** (activo `si`/`no`, precios, productos nuevos).

Para no esperar a la madrugada: en GitHub, pestaña **Actions → Sincronizar inventario → Run workflow**.

Si la sincronización falla (hoja vacía, columna borrada, foto no pública), GitHub avisa por correo y la web se queda como estaba.

### Manual (desde una computadora)
1. En esta carpeta:
   ```
   powershell -ExecutionPolicy Bypass -File sincronizar.ps1
   ```
2. Subir los cambios:
   ```
   git add -A
   git commit -m "Actualizar inventario"
   git push
   ```
   GitHub publica la web en un par de minutos.

Más detalles de la web en `megajardines/LEEME.md`.
