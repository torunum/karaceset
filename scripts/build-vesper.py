"""Original Vesper authoring scene. Run with Blender --background --python this_file.
Coordinates below use game axes (Y up, muzzle -Z); exported glTF preserves them.
The .blend is the editable source, not a conversion of the Three.js placeholder.
"""
import bpy, math, random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(17)
def xyz(p): return (p[0], -p[2], p[1])
def material(name, color, roughness, metal=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    return m
steel = material('Oil-black gunmetal', (.055,.069,.084), .34, .86)
edge = material('Polished steel edges', (.19,.21,.23), .3, .88)
brass = material('Aged brass', (.32,.21,.075), .42, .8)
black = material('Bore and engraving', (.008,.009,.01), .92)
walnut = material('Oiled walnut', (.22,.085,.035), .56)
# Authored UV colour map, packed into both source and GLB. Longitudinal grain,
# quiet pores and restrained colour range avoid the old striped wood appearance.
image = bpy.data.images.new('Vesper walnut grain', width=256, height=256)
pixels = []
for y in range(256):
    for x in range(256):
        phase = x*.29 + math.sin(y*.018)*1.6 + math.sin(y*.044)*.35
        grain = ((math.sin(phase)+1)*.5)**11
        c = .77 + random.random()*.075 - grain*.13
        pixels.extend((c*.23, c*.12, c*.061, 1))
image.pixels.foreach_set(pixels); image.pack()
tex = walnut.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
walnut.node_tree.links.new(tex.outputs['Color'], walnut.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def empty(name, pos=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    o.location=xyz(pos); o.parent=parent; return o
body=empty('vesper_body'); hinge=empty('vesper_hinge', (0,-.035,-.10))
hammers=empty('vesper_hammers', (0,.07,.13))

def mesh(name, verts, faces, mat, parent=body, bevel=0, smooth=False, uv=False):
    data=bpy.data.meshes.new(name); data.from_pydata([xyz(p) for p in verts],[],faces); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.parent=parent
    data.materials.append(mat)
    for p in data.polygons: p.use_smooth=smooth
    if uv:
        layer=data.uv_layers.new(name='UVMap')
        for poly in data.polygons:
            for li in poly.loop_indices:
                v=verts[data.loops[li].vertex_index]
                layer.data[li].uv=(v[0]*4+.5, v[2]*1.3+.5)
    if bevel:
        mod=o.modifiers.new('Machined edge radius','BEVEL'); mod.width=bevel; mod.segments=3
        mod=o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    return o

def loft(name, rings, mat, parent=body, n=24, power=1, bevel=0):
    verts=[]
    for z,cy,rx,ry in rings:
        for i in range(n):
            a=i*2*math.pi/n; c=math.cos(a); s=math.sin(a)
            verts.append((math.copysign(abs(c)**power,c)*rx,cy+math.copysign(abs(s)**power,s)*ry,z))
    faces=[tuple(range(n-1,-1,-1))]
    for j in range(len(rings)-1):
        for i in range(n):
            k=j*n+i; nxt=j*n+(i+1)%n
            faces.append((k,nxt,nxt+n,k+n))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name,verts,faces,mat,parent,bevel,True,True)

def block(name, center, size, mat, parent=body, bevel=.004):
    x,y,z=center; a,b,c=[v/2 for v in size]
    vs=[(x+i*a,y+j*b,z+k*c) for k in [-1,1] for j in [-1,1] for i in [-1,1]]
    return mesh(name,vs,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],mat,parent,bevel)

def line(name, points, radius, mat, parent=body):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'; curve.resolution_u=12
    curve.bevel_depth=radius; curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for b,p in zip(spline.bezier_points,points):
        b.co=xyz(p); b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(o); o.parent=parent; curve.materials.append(mat)
    return o

# Tapered, genuinely hollow tubes: continuous outside -> crown -> inside bore.
for side in [-1,1]:
    x=side*.062; n=48; rings=[(.09,.065),(.015,.065),(-.08,.057),(-.62,.05),(-.635,.049),(-.635,.039),(-.16,.039)]
    vs=[(x+math.cos(i*2*math.pi/n)*r,.07+math.sin(i*2*math.pi/n)*r,z) for z,r in rings for i in range(n)]
    fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)]
    barrel=mesh('Left barrel' if side<0 else 'Right barrel',vs,fs,steel,hinge,smooth=True)
    barrel.data.materials.append(edge); barrel.data.materials.append(black)
    for f in barrel.data.polygons:
        if 4*n<=f.index<5*n: f.material_index=1
        if f.index>=5*n: f.material_index=2
    block('Chamber rim', (x,.07,.065),(.103,.103,.023),brass,hinge,.012)
block('Raised sight rib',(0,.12,-.26),(.02,.017,.72),steel,hinge,.003)
block('Brass bead',(0,.138,-.60),(.013,.019,.018),brass,hinge,.005)
loft('Carved fore-end',[(-.48,-.032,.008,.012),(-.43,-.038,.05,.032),(-.32,-.039,.075,.045),(-.12,-.032,.091,.051),(.015,-.017,.081,.044),(.047,-.006,.065,.026)],walnut,hinge)
block('Fore-end latch',(0,-.077,-.17),(.028,.009,.13),edge,hinge,.004)
loft('Scalloped action',[(-.103,.005,.085,.048),(-.083,.014,.088,.061),(.014,.014,.092,.064),(.105,.005,.084,.056),(.153,-.011,.056,.047)],steel,power=.42,bevel=.003)
loft('Carved birds-head grip',[(.115,-.035,.057,.052),(.16,-.068,.06,.065),(.21,-.116,.054,.078),(.26,-.167,.05,.084),(.30,-.197,.057,.081),(.34,-.212,.063,.07),(.367,-.212,.052,.054),(.378,-.212,.027,.032)],walnut)
loft('Grip heel cap',[(.365,-.212,.052,.054),(.381,-.212,.027,.032),(.386,-.212,.008,.013)],black)
line('Trigger guard',[(0,-.032,.01),(0,-.142,.045),(0,-.178,.11),(0,-.153,.195),(0,-.084,.219)],.009,steel)
for z in [.065,.10]: line('Curved trigger',[(0,-.046,z),(0,-.10,z-.015),(0,-.122,z+.005)],.006,edge)
block('Top tang',(0,.065,.175),(.045,.011,.16),steel)
line('Opening lever',[(0,.086,.085),(.012,.094,.126),(.056,.097,.16)],.009,edge)
for side in [-1,1]:
    # Thin shaped lock plates, inlaid scrolls and recessed screw slots.
    x=side*.091
    block('Lock plate',(x,.01,.024),(.005,.081,.155),edge,bevel=.009)
    for z in [-.03,.08]:
        block('Slotted pin',(x+side*.004,.021,z),(.005,.019,.019),steel,bevel=.006)
        line('Screw recess',[(x+side*.007,.015,z-.004),(x+side*.007,.027,z+.004)],.0011,black)
    for j in range(3):
        z=-.015+j*.035
        line('Engraved scroll',[(x+side*.003,-.015,z-.012),(x+side*.004,.015,z),(x+side*.003,-.008,z+.014)],.0011,black)
    line('Hammer neck',[(side*.06,0,0),(side*.06,.06,.024),(side*.06,.086,-.009)],.009,steel,hammers)
    block('Hammer spur',(side*.06,.084,-.003),(.026,.012,.031),edge,hammers,.003)
    # Shallow diagonal chequering on the fore-end, only in the hand contact patch.
    for j in range(13):
        z=-.29+j*.016
        line('Fore-end chequering',[(side*.077,-.024,z),(side*.079,-.041,z+.018)],.0008,black,hinge)

# Apply modifiers/curves before export, then merge only rigid surfaces by material.
for obj in list(bpy.context.scene.objects):
    if obj.type not in {'MESH','CURVE'}: continue
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH')
for parent in [body,hinge,hammers]:
    for mat in [steel,edge,brass,black,walnut]:
        objects=[o for o in parent.children if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==mat]
        if len(objects)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        objects[0].name=parent.name+'_'+mat.name
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/vesper.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/vesper.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
print('VESPER_EXPORTED', sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'))
