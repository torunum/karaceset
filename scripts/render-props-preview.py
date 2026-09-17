import bpy, math
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/blender/props.blend'))
for o in bpy.context.scene.objects:
 if o.parent and o.parent.name.startswith(('altar','lantern')):o.hide_render=True
bpy.ops.mesh.primitive_plane_add(size=200);p=bpy.context.object;p.location.z=-.01
m=bpy.data.materials.new('Preview floor');m.diffuse_color=(.035,.035,.035,1);p.data.materials.append(m)
bpy.ops.object.camera_add(location=(3.8,-6.8,3.5));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=5.2;bpy.context.scene.camera=cam
for loc,power,size in [((0,-4,6),900,5),((-4,1,3),750,4),((3,3,4),1000,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.render.threads_mode='FIXED';s.render.threads=4;s.cycles.use_denoising=True;s.render.resolution_x=1000;s.render.resolution_y=650;s.render.resolution_percentage=100;s.world.color=(.08,.08,.08);s.render.image_settings.file_format='PNG';s.render.filepath=str(root/'docs/blender-props-preview.png');bpy.ops.render.render(write_still=True)

for o in bpy.context.scene.objects:
 if o.parent:
  o.hide_render=not o.parent.name.startswith(('altar','lantern'))
cam.location=(7,-6,3.5);cam.rotation_euler=(Vector((4.7,0,.7))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=4.7;s.render.filepath=str(root/'docs/blender-fixtures-preview.png');bpy.ops.render.render(write_still=True)

