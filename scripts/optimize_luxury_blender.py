import bpy, os, sys

def optimize_asset(in_path, out_path, target_faces=90000):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    print(f"\n=======================================================")
    print(f"Procesando: {in_path} -> {out_path}")
    print(f"Tamaño original: {os.path.getsize(in_path) / (1024*1024):.2f} MB")
    
    bpy.ops.import_scene.gltf(filepath=in_path)
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    total_faces = sum(len(o.data.polygons) for o in mesh_objs)
    print(f"Mallas encontradas: {len(mesh_objs)}, Poligonos totales: {total_faces}")
    
    if total_faces > target_faces:
        ratio = max(0.01, min(0.9, target_faces / total_faces))
        print(f"Aplicando Decimate con ratio {ratio:.4f}...")
        for obj in mesh_objs:
            if len(obj.data.polygons) > 200:
                mod = obj.modifiers.new(name="DecimateOpt", type='DECIMATE')
                mod.ratio = ratio
                bpy.context.view_layer.objects.active = obj
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except Exception as e:
                    print(f"Aviso en modifier: {e}")
                    
    final_faces = sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
    print(f"Exportando a GLB con {final_faces} poligonos...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', export_apply=True)
    print(f"Completado! Nuevo tamaño: {os.path.getsize(out_path) / (1024*1024):.2f} MB")
    print(f"=======================================================\n")

assets = [
    ('Assets3D/Porsche.glb', 'Assets3D/Porsche.glb', 80000),
    ('Assets3D/Lambo.glb', 'Assets3D/Lambo.glb', 90000),
    ('Assets3D/Helicopter.glb', 'Assets3D/Helicopter.glb', 85000),
]

for in_p, out_p, target_f in assets:
    if os.path.exists(in_p):
        optimize_asset(in_p, out_p, target_f)

print("TODOS LOS ASSETS DE LUJO HAN SIDO OPTIMIZADOS CON ÉXITO.")
