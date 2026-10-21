# mega_jardines

Web de Mega Jardines (vivero y jardinería en Quito).

| Carpeta / archivo | Qué es |
|---|---|
| `megajardines/` | La web (HTML, CSS y JS estáticos). Se publica sola en GitHub Pages con cada push a `main`. |
| `megajardines-bot/` | Bot de WhatsApp (proyecto aparte, Python). Ver su `LEEME.md`. |
| `sincronizar.ps1` | Trae el inventario desde Google Sheets y las fotos nuevas desde Drive hacia la web y el bot. |

## Actualizar el catálogo
1. Editar la hoja **Inventario_megajardines** (activo `si`/`no`, precios, productos nuevos).
2. En esta carpeta:
   ```
   powershell -ExecutionPolicy Bypass -File sincronizar.ps1
   ```
3. Subir los cambios:
   ```
   git add -A
   git commit -m "Actualizar inventario"
   git push
   ```
   GitHub publica la web en un par de minutos.

Más detalles de la web en `megajardines/LEEME.md`.
