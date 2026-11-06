import os, struct, json, subprocess, tempfile

def resize_image_bytes(img_bytes, mime_type, max_dim=1024):
    with tempfile.NamedTemporaryFile(suffix='.in', delete=False) as f_in:
        f_in.write(img_bytes)
        in_path = f_in.name
    out_path = in_path + '.out'

    ps_code = f"""
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile('{in_path}')
    $w = $img.Width; $h = $img.Height
    $scale = 1.0
    if ($w -gt {max_dim} -or $h -gt {max_dim}) {{
        $scale = [System.Math]::Min({max_dim} / $w, {max_dim} / $h)
    }}
    $nw = [int]($w * $scale); $nh = [int]($h * $scale)
    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose(); $img.Dispose()
    $bmp.Save('{out_path}', [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bmp.Dispose()
    """
    
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_code], check=True, capture_output=True)
        if os.path.exists(out_path):
            with open(out_path, 'rb') as f_out:
                new_bytes = f_out.read()
            return new_bytes, 'image/jpeg'
    except Exception as e:
        pass
    finally:
        if os.path.exists(in_path): os.remove(in_path)
        if os.path.exists(out_path): os.remove(out_path)

    return img_bytes, mime_type

def optimize_glb(in_path, out_path, max_dim=1024):
    print(f"Procesando: {in_path} ...")
    with open(in_path, 'rb') as f:
        magic, ver, total_len = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67, "Not a valid GLB"
        c0_len, c0_type = struct.unpack('<II', f.read(8))
        json_data = json.loads(f.read(c0_len).decode('utf-8'))
        c1_len, c1_type = struct.unpack('<II', f.read(8))
        bin_data = bytearray(f.read(c1_len))

    images = json_data.get('images', [])
    buffer_views = json_data.get('bufferViews', [])

    img_bv_set = set()
    for img in images:
        if 'bufferView' in img:
            img_bv_set.add(img['bufferView'])

    new_bin = bytearray()

    # Copiar bufferViews de geometria / no-imagenes
    for idx, bv in enumerate(buffer_views):
        offset = bv.get('byteOffset', 0)
        length = bv['byteLength']
        if idx not in img_bv_set:
            # Alineacion a 4 bytes
            pad = len(new_bin) % 4
            if pad != 0:
                new_bin.extend(b'\x00' * (4 - pad))
            bv['byteOffset'] = len(new_bin)
            new_bin.extend(bin_data[offset:offset+length])

    # Redimensionar y añadir imagenes
    for img in images:
        if 'bufferView' not in img:
            continue
        bv_idx = img['bufferView']
        bv = buffer_views[bv_idx]
        offset = bv.get('byteOffset', 0)
        length = bv['byteLength']
        orig_img_bytes = bytes(bin_data[offset:offset+length])
        
        resized_bytes, new_mime = resize_image_bytes(orig_img_bytes, img.get('mimeType', 'image/png'), max_dim)
        img['mimeType'] = new_mime

        pad = len(new_bin) % 4
        if pad != 0:
            new_bin.extend(b'\x00' * (4 - pad))
        bv['byteOffset'] = len(new_bin)
        bv['byteLength'] = len(resized_bytes)
        new_bin.extend(resized_bytes)

    # Padding final de bin
    pad = len(new_bin) % 4
    if pad != 0:
        new_bin.extend(b'\x00' * (4 - pad))

    json_data['buffers'][0]['byteLength'] = len(new_bin)
    new_json_bytes = json.dumps(json_data, separators=(',', ':')).encode('utf-8')
    json_pad = len(new_json_bytes) % 4
    if json_pad != 0:
        new_json_bytes += b' ' * (4 - json_pad)

    total_len = 12 + 8 + len(new_json_bytes) + 8 + len(new_bin)

    with open(out_path, 'wb') as f_out:
        f_out.write(struct.pack('<III', magic, ver, total_len))
        f_out.write(struct.pack('<II', len(new_json_bytes), 0x4E4F534A))
        f_out.write(new_json_bytes)
        f_out.write(struct.pack('<II', len(new_bin), 0x004E4942))
        f_out.write(new_bin)

    orig_mb = os.path.getsize(in_path) / (1024*1024)
    new_mb = os.path.getsize(out_path) / (1024*1024)
    print(f" -> OK: {orig_mb:.2f} MB ===> {new_mb:.2f} MB ({out_path})")

if __name__ == '__main__':
    assets_dir = 'Assets3D'
    files = [f for f in os.listdir(assets_dir) if '_4k' in f and f.endswith('.glb')]
    for fname in sorted(files):
        in_p = os.path.join(assets_dir, fname)
        out_fname = fname.replace('_4k', '_1k')
        out_p = os.path.join(assets_dir, out_fname)
        optimize_glb(in_p, out_p, 1024)
