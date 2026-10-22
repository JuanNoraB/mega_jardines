<#
  Sincroniza el inventario de Mega Jardines desde Google Sheets + Google Drive hacia la web.

  - Lee la hoja "Inventario_megajardines" (debe estar compartida: "Cualquier persona con el enlace puede ver").
  - Columnas: codigo | activo | tipo | categoria | nombre | precio | foto | descripcion
      activo: si / no  (vacío = si)
      precio: 4.50 o 4,50 (vacío = "consultar precio")
      foto:   nombre de archivo que ya está en la web (P_187.jpg)
              o el enlace de Drive de una foto nueva (también debe ser pública)
  - Descarga y optimiza las fotos nuevas en megajardines/img/productos/<codigo>.jpg
  - Regenera: megajardines/assets/data.js, megajardines/data/inventario.csv (respaldo)
              y megajardines-bot/data/productos.csv

  Uso:
    powershell -ExecutionPolicy Bypass -File sincronizar.ps1
    powershell -ExecutionPolicy Bypass -File sincronizar.ps1 -Csv ruta\inventario.csv   (sin internet / pruebas)
#>
param(
  [string]$HojaId = "1y0PDmb3mT7-eC90OWYbp2bXlb4QKvxPfss0CrsUib3Q",
  [string]$Csv = "",
  [switch]$Simular        # muestra lo que haría sin escribir nada
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$site  = Join-Path $root "megajardines"
$fotos = Join-Path $site "img\productos"
$enc   = New-Object Text.UTF8Encoding($false)
$cacheFile = Join-Path $site "data\fotos-drive.json"
$warn = New-Object System.Collections.Generic.List[string]

function Slug([string]$s) {
  $n = $s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
  ($n.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
}
function Download([string]$url) {
  $wc = New-Object Net.WebClient
  $wc.Headers.Add("User-Agent", "Mozilla/5.0")
  $bytes = $wc.DownloadData($url)
  return @{ bytes = $bytes; type = $wc.ResponseHeaders["Content-Type"] }
}
function DriveId([string]$s) {
  if ($s -match '/d/([A-Za-z0-9_-]{20,})') { return $Matches[1] }
  if ($s -match '[?&]id=([A-Za-z0-9_-]{20,})') { return $Matches[1] }
  return $null
}
function SaveOptimized([byte[]]$bytes, [string]$dest) {
  $ms = New-Object IO.MemoryStream (, $bytes)
  $img = [Drawing.Image]::FromStream($ms)
  try {
    if ($img.PropertyIdList -contains 0x0112) {
      switch ($img.GetPropertyItem(0x0112).Value[0]) { 3 { $img.RotateFlip('Rotate180FlipNone') } 6 { $img.RotateFlip('Rotate90FlipNone') } 8 { $img.RotateFlip('Rotate270FlipNone') } }
    }
    $scale = [Math]::Min(1.0, 1200.0 / [Math]::Max($img.Width, $img.Height))
    [int]$w = [Math]::Round($img.Width * $scale); [int]$h = [Math]::Round($img.Height * $scale)
    $bmp = New-Object Drawing.Bitmap -ArgumentList $w, $h
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear([Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose()
    $codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
    $ep = New-Object Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 82L
    $bmp.Save($dest, $codec, $ep); $bmp.Dispose()
  } finally { $img.Dispose(); $ms.Dispose() }
}

# ---------------------------------------------------------------- 1. leer la hoja
if ($Csv) {
  $text = [IO.File]::ReadAllText((Resolve-Path $Csv).Path, $enc)
  Write-Host "Leyendo $Csv"
} else {
  Write-Host "Descargando la hoja de Google..."
  # gid=0 es la pestaña "Inventario" (la pestaña "Listas" solo alimenta los desplegables)
  $r = Download "https://docs.google.com/spreadsheets/d/$HojaId/export?format=csv&gid=0"
  $text = [Text.Encoding]::UTF8.GetString($r.bytes)
  if ($text -match '<html') { throw "No se pudo leer la hoja. Revisa que esté compartida como 'Cualquier persona con el enlace puede ver'." }
}
$text = $text.TrimStart([char]0xFEFF)
$rows = @($text | ConvertFrom-Csv)
if ($rows.Count -eq 0) { throw "La hoja está vacía. No se cambió nada en la web." }

# encabezados flexibles (Código, CODIGO, Precio ($)...)
$cols = @{}
foreach ($h in $rows[0].PSObject.Properties.Name) { $cols[(Slug $h) -replace '-.*$', ''] = $h }
foreach ($need in 'codigo', 'nombre', 'tipo') {
  if (-not $cols[$need]) { throw "Falta la columna '$need' en la hoja. Columnas encontradas: $($rows[0].PSObject.Properties.Name -join ', ')" }
}
function Col($row, $name) { if ($cols[$name]) { "$($row.($cols[$name]))".Trim() } else { "" } }

# ---------------------------------------------------------------- 2. procesar filas
$cache = @{}
if (Test-Path $cacheFile) { (Get-Content $cacheFile -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $cache[$_.Name] = $_.Value } }
$seen = @{}; $products = @(); $all = @(); $inactive = 0; $downloaded = 0
foreach ($row in $rows) {
  $codigo = Col $row 'codigo'; $nombre = Col $row 'nombre'; $tipo = Col $row 'tipo'
  if (-not $codigo -and -not $nombre) { continue }                       # fila vacía
  if (-not $codigo) { $warn.Add("Fila sin código: '$nombre' (omitida)"); continue }
  if ($codigo -notmatch '^[A-Za-z0-9_-]+$') { $warn.Add("Código inválido '$codigo' (solo letras, números, _ y -)"); continue }
  if ($seen[$codigo]) { $warn.Add("Código repetido $codigo (se usa la primera fila)"); continue }
  $seen[$codigo] = 1
  if (-not $nombre -or -not $tipo) { $warn.Add("$codigo sin nombre o tipo (omitido)"); continue }

  $activoTxt = (Col $row 'activo').ToLower()
  $activo = -not ($activoTxt -in @('no', 'n', '0', 'false', 'falso', 'agotado', 'inactivo'))
  $categoria = Col $row 'categoria'; if (-not $categoria) { $categoria = $tipo }
  $precioTxt = (Col $row 'precio') -replace '[^\d,\.]', ''
  if ($precioTxt -match ',\d{1,2}$') { $precioTxt = $precioTxt.Replace('.', '').Replace(',', '.') } else { $precioTxt = $precioTxt.Replace(',', '') }
  $precio = 0.0; if ($precioTxt) { [void][double]::TryParse($precioTxt, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$precio) }
  $foto = Col $row 'foto'; $desc = Col $row 'descripcion'

  # foto: archivo local o enlace de Drive / URL
  $img = ""
  if ($foto -match '^https?://' -and -not (DriveId $foto)) {
    # Solo se aceptan enlaces de Google Drive (evita descargar cualquier archivo de internet)
    $warn.Add("$codigo : la foto debe ser un enlace de Google Drive (se ignoró '$foto')")
  } elseif ($foto -match '^https?://') {
    $id = DriveId $foto
    $dest = Join-Path $fotos "$codigo.jpg"
    $key = if ($id) { $id } else { $foto }
    if ($cache[$codigo] -eq $key -and (Test-Path $dest)) { $img = "img/productos/$codigo.jpg" }
    elseif ($activo) {
      $url = if ($id) { "https://drive.google.com/uc?export=download&id=$id" } else { $foto }
      try {
        $r = Download $url
        if ($r.type -notlike 'image/*') { throw "no es una imagen (¿la foto está compartida públicamente?)" }
        if (-not $Simular) { SaveOptimized $r.bytes $dest; $cache[$codigo] = $key }
        $img = "img/productos/$codigo.jpg"; $downloaded++
        Write-Host "  foto nueva: $codigo"
      } catch { $warn.Add("$codigo : no se pudo descargar la foto -> $($_.Exception.Message)") }
    }
  } elseif ($foto) {
    if (Test-Path (Join-Path $fotos $foto)) { $img = "img/productos/$foto" }
    else { $warn.Add("$codigo : la foto '$foto' no está en img/productos") }
  }

  $all += [pscustomobject]@{ codigo = $codigo; activo = $(if ($activo) { 'si' } else { 'no' }); tipo = $tipo; categoria = $categoria; nombre = $nombre; precio = $(if ($precio -gt 0) { '{0:0.00}' -f $precio } else { '' }); foto = $(if ($img) { Split-Path $img -Leaf } else { $foto }); descripcion = $desc }
  if (-not $activo) { $inactive++; continue }
  $products += [ordered]@{ id = $codigo; n = $nombre; p = [Math]::Round($precio, 2); img = $img; g = (Slug $tipo); c = @(Slug $categoria); d = $desc; _tipo = $tipo; _cat = $categoria }
}
if ($products.Count -eq 0) { throw "No hay productos activos. No se cambió nada en la web." }

# ---------------------------------------------------------------- 3. generar archivos
$orden = @('plantas', 'macetas', 'piedras', 'tierras-y-abonos')
$groups = $products | Group-Object { $_.g } | Sort-Object { $i = $orden.IndexOf($_.Name); if ($i -lt 0) { 99 } else { $i } }, Name
$tree = foreach ($grp in $groups) {
  $cats = $grp.Group | Group-Object { $_.c[0] } | Sort-Object { $_.Group[0]._cat }
  [ordered]@{ g = $grp.Name; label = $grp.Group[0]._tipo; cats = @($cats | ForEach-Object { [ordered]@{ k = $_.Name; label = $_.Group[0]._cat; count = $_.Count } }) }
}
$old = ([IO.File]::ReadAllText("$site\assets\data.js", $enc) -replace '^[^{]*', '').TrimEnd().TrimEnd(';') | ConvertFrom-Json
$clean = $products | Sort-Object { $_.n } | ForEach-Object { $_.Remove('_tipo'); $_.Remove('_cat'); $_ }
$data = [ordered]@{ tree = @($tree); products = @($clean); services = $old.services }

Write-Host ""
Write-Host "Activos: $($products.Count)   Inactivos: $inactive   Fotos nuevas: $downloaded"
if ($Simular) { Write-Host "(simulación: no se escribió nada)"; $warn | ForEach-Object { Write-Warning $_ }; return }

$json = $data | ConvertTo-Json -Depth 8 -Compress
$newJs = "// Generado por sincronizar.ps1 desde Google Sheets. No editar a mano.`nwindow.MJ_DATA = $json;`n"
$oldJs = if (Test-Path "$site\assets\data.js") { [IO.File]::ReadAllText("$site\assets\data.js", $enc) } else { "" }
[IO.File]::WriteAllText("$site\assets\data.js", $newJs, $enc)
# Si el catálogo cambió, se marca una versión nueva en las páginas para que los
# navegadores no muestren precios viejos guardados en caché.
if ($newJs -ne $oldJs) {
  $ver = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmm")
  foreach ($page in Get-ChildItem $site -Filter *.html) {
    $html = [IO.File]::ReadAllText($page.FullName, $enc)
    $upd = [regex]::Replace($html, 'assets/data\.js(\?v=\d+)?"', "assets/data.js?v=$ver`"")
    if ($upd -ne $html) { [IO.File]::WriteAllText($page.FullName, $upd, $enc) }
  }
}
[IO.File]::WriteAllLines("$site\data\inventario.csv", [string[]]($all | ConvertTo-Csv -NoTypeInformation), $enc)
($cache | ConvertTo-Json) | ForEach-Object { [IO.File]::WriteAllText($cacheFile, $_, $enc) }
$bot = Join-Path $root "megajardines-bot\data\productos.csv"
if (Test-Path (Split-Path $bot)) {
  $botRows = $products | ForEach-Object { [pscustomobject]@{ id = $_.id; nombre = $_.n; grupo = $_._tipo; categoria = $_._cat; precio = $(if ($_.p -gt 0) { '{0:0.00}' -f $_.p } else { '' }); imagen = $_.img } }
  [IO.File]::WriteAllLines($bot, [string[]]($botRows | ConvertTo-Csv -NoTypeInformation), $enc)
}
Write-Host "Listo: web y bot actualizados."
$warn | ForEach-Object { Write-Warning $_ }
