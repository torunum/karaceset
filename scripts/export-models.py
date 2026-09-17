"""Export a saved, manually edited pack without running its destructive generator.
blender --background assets/blender/cultist.blend --python scripts/export-models.py
"""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
name=Path(bpy.data.filepath).stem
def export(name,roots):
    if not roots or any(o is None for o in roots):raise RuntimeError('Missing model anchors')
    bpy.ops.object.select_all(action='DESELECT')
    for o in roots:
        for item in [o,*o.children_recursive]:item.hide_set(False);item.hide_render=False;item.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/f'{name}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_apply=True)
if name in ['cultist','runner','shambler','spitter','brute']:
    required=['body','head']+[side+part for side in ['left','right'] for part in ['Arm','Forearm','Hand','Leg','Shin','Foot']]
    if name=='cultist':required.append('firearm')
    export(name,[bpy.data.objects.get(n) for n in required])
elif name=='organic-arsenal':
    for output,prefixes in [('ossuary',('femur_',)),('tithe',('acid_',)),('warden-hands',('player_hands','trigger_hand','support_hand')),('warden-kick',('kick_',))]:
        export(output,[o for o in bpy.context.scene.objects if o.type=='EMPTY' and any(o.name.startswith(p) for p in prefixes)])
elif name=='props':
    roots=[o for o in bpy.context.scene.objects if o.type=='EMPTY']
    for o in roots:o.location.x=0
    export('props',roots)
elif name=='vesper':
    export('vesper',[bpy.data.objects.get(n) for n in ['vesper_body','vesper_hinge','vesper_hammers']])
else:raise RuntimeError(f'Unknown source pack: {name}')
# Deliberately do not save the source; gallery visibility/placements are preserved.
