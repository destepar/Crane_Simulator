Add-Type -AssemblyName System.Drawing

function Optimize-GLB {
    param(
        [string]$inPath,
        [string]$outPath,
        [int]$maxDim = 1024
    )

    Write-Host "Procesando $inPath ..."
    $bytes = [System.IO.File]::ReadAllBytes($inPath)
    if ($bytes.Length -lt 20) { return }

    $magic = [System.BitConverter]::ToUInt32($bytes, 0)
    if ($magic -ne 0x46546C67) { return } # 'glTF'

    $c0Len = [System.BitConverter]::ToUInt32($bytes, 12)
    $jsonStr = [System.Text.Encoding]::UTF8.GetString($bytes, 20, $c0Len)
    $json = $jsonStr | ConvertFrom-Json

    $c1Offset = 20 + $c0Len
    $c1Len = [System.BitConverter]::ToUInt32($bytes, $c1Offset)
    $binData = New-Object byte[] $c1Len
    [System.Array]::Copy($bytes, $c1Offset + 8, $binData, 0, $c1Len)

    # Identificar bufferViews de imagenes
    $imgBvIndices = @{}
    if ($json.images) {
        foreach ($img in $json.images) {
            if ($null -ne $img.bufferView) {
                $imgBvIndices[$img.bufferView] = $true
            }
        }
    }

    # Copiar bufferViews no-imagen a un nuevo bin
    $newBinStream = New-Object System.IO.MemoryStream

    for ($i = 0; $i -lt $json.bufferViews.Count; $i++) {
        $bv = $json.bufferViews[$i]
        $offset = if ($null -ne $bv.byteOffset) { $bv.byteOffset } else { 0 }
        $len = $bv.byteLength

        if (-not $imgBvIndices.ContainsKey($i)) {
            $curOffset = $newBinStream.Position
            $pad = ($curOffset % 4)
            if ($pad -ne 0) {
                for ($p = 0; $p -lt (4 - $pad); $p++) { $newBinStream.WriteByte(0) }
            }
            $bv.byteOffset = [int]$newBinStream.Position
            $newBinStream.Write($binData, $offset, $len)
        }
    }

    # Procesar imagenes
    if ($json.images) {
        foreach ($img in $json.images) {
            $bvIdx = $img.bufferView
            $bv = $json.bufferViews[$bvIdx]
            $offset = if ($null -ne $bv.byteOffset) { $bv.byteOffset } else { 0 }
            $len = $bv.byteLength

            $imgStream = New-Object System.IO.MemoryStream($binData, $offset, $len)
            $srcBmp = [System.Drawing.Image]::FromStream($imgStream)

            $w = $srcBmp.Width
            $h = $srcBmp.Height

            $scale = 1.0
            if ($w -gt $maxDim -or $h -gt $maxDim) {
                $scale = [System.Math]::Min([double]$maxDim / $w, [double]$maxDim / $h)
            }

            $newW = [int]($w * $scale)
            $newH = [int]($h * $scale)

            $destBmp = New-Object System.Drawing.Bitmap $newW, $newH
            $g = [System.Drawing.Graphics]::FromImage($destBmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($srcBmp, 0, 0, $newW, $newH)
            $g.Dispose()
            $srcBmp.Dispose()
            $imgStream.Dispose()

            $outImgStream = New-Object System.IO.MemoryStream
            $destBmp.Save($outImgStream, [System.Drawing.Imaging.ImageFormat]::Jpeg)
            $destBmp.Dispose()

            $imgBytes = $outImgStream.ToArray()
            $outImgStream.Dispose()

            $img.mimeType = 'image/jpeg'

            $curOffset = $newBinStream.Position
            $pad = ($curOffset % 4)
            if ($pad -ne 0) {
                for ($p = 0; $p -lt (4 - $pad); $p++) { $newBinStream.WriteByte(0) }
            }

            $bv.byteOffset = [int]$newBinStream.Position
            $bv.byteLength = $imgBytes.Length
            $newBinStream.Write($imgBytes, 0, $imgBytes.Length)
        }
    }

    $curOffset = $newBinStream.Position
    $pad = ($curOffset % 4)
    if ($pad -ne 0) {
        for ($p = 0; $p -lt (4 - $pad); $p++) { $newBinStream.WriteByte(0) }
    }

    $newBinBytes = $newBinStream.ToArray()
    $newBinStream.Dispose()

    $json.buffers[0].byteLength = $newBinBytes.Length

    $newJsonStr = $json | ConvertTo-Json -Depth 20 -Compress
    $newJsonBytes = [System.Text.Encoding]::UTF8.GetBytes($newJsonStr)
    $jsonPad = ($newJsonBytes.Length % 4)
    if ($jsonPad -ne 0) {
        $needed = 4 - $jsonPad
        $padBytes = New-Object byte[] $needed
        for ($p=0; $p -lt $needed; $p++) { $padBytes[$p] = 0x20 }
        $newJsonBytes = $newJsonBytes + $padBytes
    }

    $totalLen = 12 + 8 + $newJsonBytes.Length + 8 + $newBinBytes.Length

    $outStream = [System.IO.File]::Create($outPath)
    $writer = New-Object System.IO.BinaryWriter $outStream

    $writer.Write([uint32]0x46546C67)
    $writer.Write([uint32]2)
    $writer.Write([uint32]$totalLen)

    $writer.Write([uint32]$newJsonBytes.Length)
    $writer.Write([uint32]0x4E4F534A)
    $writer.Write($newJsonBytes)

    $writer.Write([uint32]$newBinBytes.Length)
    $writer.Write([uint32]0x004E4942)
    $writer.Write($newBinBytes)

    $writer.Dispose()
    $outStream.Dispose()

    $oldMb = [System.Math]::Round($bytes.Length / (1024*1024), 2)
    $newMb = [System.Math]::Round($totalLen / (1024*1024), 2)
    Write-Host "-> Optimizado: $oldMb MB ===> $newMb MB ($outPath)" -ForegroundColor Green
}

$files = Get-ChildItem -Path "Assets3D" -Filter "*_4k*.glb"
foreach ($f in $files) {
    $outName = $f.Name -replace "_4k", "_1k"
    $outPath = Join-Path $f.DirectoryName $outName
    Optimize-GLB $f.FullName $outPath 1024
}
