"""Offline review of exported GLBs, independent of Three.js placeholder art."""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
grip='--grip' in sys.argv
arrangement=[('vesper',(0,0,0)),('warden-hands',(0,0,0))] if grip else [('ossuary',(-.85,0,.3)),('tithe',(.05,0,.3)),('warden-hands',(.95,0,.3)),('warden-kick',(.7,-.1,-.9))]
for name,offset in arrangement:
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/f'{name}.glb'))
    if name=='warden-kick':
        thigh=bpy.data.objects.get('kick_thigh'); shin=bpy.data.objects.get('kick_shin'); boot=bpy.data.objects.get('kick_boot')
        shin.parent=thigh; shin.location=(0,0,-.4); boot.parent=shin; boot.location=(0,0,-.4)
    for o in set(bpy.context.scene.objects)-before:
        if not o.parent:
            o.location+=Vector((offset[0],-offset[2],offset[1]))
bpy.ops.object.camera_add(location=(.14,-1.2,.46) if grip else (2.4,-3.1,2.1)); cam=bpy.context.object
direction=Vector((0,0,-.09) if grip else (0,0,0))-cam.location; cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=1.15 if grip else 3.1; bpy.context.scene.camera=cam
for loc,power,size in [((0,-2,4),700,4),((-3,1,2),500,3),((2,3,2),800,2)]:
    bpy.ops.object.light_add(type='AREA',location=loc); l=bpy.context.object; l.data.energy=power; l.data.shape='DISK'; l.data.size=size
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.world.color=(.12,.12,.12); scene.view_settings.view_transform='AgX'
scene.render.resolution_x=1500; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(ROOT/('docs/shotgun-blender-grip-study.png' if grip else 'docs/organic-blender-study.png'))
bpy.ops.render.render(write_still=True)
