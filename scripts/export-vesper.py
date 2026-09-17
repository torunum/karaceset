"""Export the current edited .blend; never regenerate/overwrite its authoring scene."""
import bpy
from pathlib import Path
root = Path(__file__).resolve().parents[1]
anchors = [bpy.data.objects.get(name) for name in ['vesper_body', 'vesper_hinge', 'vesper_hammers']]
if any(o is None for o in anchors):
    raise RuntimeError('Required Vesper animation anchors are missing')
bpy.ops.object.select_all(action='DESELECT')
for anchor in anchors:
    anchor.select_set(True)
    for child in anchor.children_recursive: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/vesper.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=False)
