import struct, json, os

assets_dir = 'Assets3D'
for fname in os.listdir(assets_dir):
    if not fname.endswith('.glb'):
        continue
    filepath = os.path.join(assets_dir, fname)
    with open(filepath, 'rb') as f:
        header = f.read(12)
        if len(header) < 12:
            continue
        c0_len, c0_type = struct.unpack('<II', f.read(8))
        json_data = json.loads(f.read(c0_len).decode('utf-8'))
        print(f"=== {fname} ({os.path.getsize(filepath) / 1024:.1f} KB) ===")
        print("  Meshes count:", len(json_data.get('meshes', [])))
        for i, n in enumerate(json_data.get('nodes', [])):
            print(f"    Node {i}: name='{n.get('name')}', mesh={n.get('mesh')}, children={n.get('children')}")
