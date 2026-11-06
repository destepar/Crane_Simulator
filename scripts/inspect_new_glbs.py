import struct, json, os

for name in ['Porsche.glb', 'Lambo.glb', 'Helicopter.glb']:
    path = os.path.join('Assets3D', name)
    if not os.path.exists(path):
        continue
    size = os.path.getsize(path) / (1024*1024)
    with open(path, 'rb') as f:
        magic, ver, total_len = struct.unpack('<III', f.read(12))
        c0_len, _ = struct.unpack('<II', f.read(8))
        d = json.loads(f.read(c0_len).decode('utf-8'))
        c1_len, _ = struct.unpack('<II', f.read(8))
    
    bvs = d.get('bufferViews', [])
    imgs = d.get('images', [])
    img_bytes = sum(bvs[img['bufferView']]['byteLength'] for img in imgs if 'bufferView' in img) / (1024*1024)
    meshes_count = len(d.get('meshes', []))
    print(f"{name}: Total={size:.1f}MB, JSON={c0_len/1024:.1f}KB, BIN={c1_len/(1024*1024):.1f}MB, Images={len(imgs)} ({img_bytes:.1f}MB), Meshes={meshes_count}")
