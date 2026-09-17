"""Original Blender source for Ossuary, Tithe and the Warden's viewmodel limbs.
All forms are authored here as continuous cross-section surfaces. No Three.js
placeholder geometry is imported. Editable meshes, UVs and packed maps in .blend.
"""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(410)
def xyz(p): return (p[0],-p[2],p[1])
def group(name):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); return o
def mat(name,color,rough=.6,metal=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    image=bpy.data.images.new(name+' UV',width=256,height=256); pixels=[]
    for y in range(256):
        for x in range(256):
            grain=random.random()*.09+.86 + math.sin(x*.06+math.sin(y*.04)*1.4)*.04
            if 'bone' in name: grain-=max(0, math.sin(x*.23+y*.025))**18*.11
            pixels.extend([c*grain for c in color]+[1])
    image.pixels.foreach_set(pixels); image.pack()
    tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
    m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    return m
bone=mat('Aged porous bone',(.44,.36,.23),.7)
marrow=mat('Dry oxblood sinew',(.115,.023,.028),.48)
iron=mat('Blackened forged iron',(.042,.052,.055),.4,.75)
edge=mat('Exposed steel wear',(.19,.20,.18),.38,.78)
skin=mat('Necrotic olive membrane',(.115,.125,.047),.43)
vein=mat('Vascular bruising',(.092,.026,.043),.52)
bile=mat('Amber bile',(.24,.28,.031),.27)
leather=mat('Warden cracked leather',(.042,.033,.024),.78)
cloth=mat('Warden coal canvas',(.049,.048,.041),.94)
rubber=mat('Boot lug rubber',(.012,.013,.012),.97)
thread=mat('Dark waxed stitching',(.12,.099,.067),.86)
def mesh(name,verts,faces,material,parent,sub=1):
    d=bpy.data.meshes.new(name); d.from_pydata([xyz(p) for p in verts],[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.parent=parent
    d.materials.append(material)
    for f in d.polygons: f.use_smooth=True
    layer=d.uv_layers.new(name='UVMap')
    for poly in d.polygons:
        for li in poly.loop_indices:
            v=verts[d.loops[li].vertex_index]; layer.data[li].uv=(v[0]*2+.5,v[2]*1.2+.5)
    if sub:
        mod=o.modifiers.new('Authored surface smoothing','SUBSURF'); mod.levels=sub; mod.render_levels=sub
    return o
def loft(name,rings,material,parent,n=24,flute=0,power=1,sub=1):
    vs=[]
    for j,(z,cx,cy,rx,ry) in enumerate(rings):
        for i in range(n):
            a=i*2*math.pi/n; c=math.cos(a); s=math.sin(a)
            ridge=1+flute*math.cos(6*a+j*.4)
            vs.append((cx+math.copysign(abs(c)**power,c)*rx*ridge,cy+math.copysign(abs(s)**power,s)*ry*ridge,z))
    fs=[tuple(range(n-1,-1,-1))]
    for j in range(len(rings)-1):
        for i in range(n): fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    fs.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name,vs,fs,material,parent,sub)
def cord(name,points,radii,material,parent,n=10):
    vs=[]; previous_a=None; previous_tangent=None
    for j,p in enumerate(points):
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        tangent.normalize()
        if previous_a is None:
            ref=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
            a=tangent.cross(ref).normalized()
        else:
            # Parallel transport prevents frame flips at knuckle bends. A fresh
            # global-axis cross product per ring twists glove fingers into fins.
            a=previous_tangent.rotation_difference(tangent) @ previous_a
        b=tangent.cross(a).normalized(); previous_a=a; previous_tangent=tangent
        for i in range(n):
            q=Vector(p)+radii[j]*(a*math.cos(i*2*math.pi/n)+b*math.sin(i*2*math.pi/n)); vs.append(tuple(q))
    fs=[tuple(range(n-1,-1,-1))]
    for j in range(len(points)-1):
        for i in range(n): fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    fs.append(tuple((len(points)-1)*n+i for i in range(n)))
    return mesh(name,vs,fs,material,parent)

def folded_limb(name,points,radii,parent):
    dense=[]; widths=[]
    for j in range((len(points)-1)*4+1):
        f=j/4; k=min(int(f),len(points)-2); t=f-k
        p=Vector(points[k]).lerp(Vector(points[k+1]),t)
        r=radii[k]*(1-t)+radii[k+1]*t
        # Cloth compresses into broad asymmetric ridges close to articulation.
        envelope=math.sin(math.pi*j/((len(points)-1)*4))**.5
        r+=envelope*(math.sin(j*1.7)*.0035+math.sin(j*.61)*.002)
        p.x+=math.sin(j*.83)*.002*envelope
        dense.append(tuple(p)); widths.append(r)
    return cord(name,dense,widths,cloth,parent,24)

# OSSUARY: swept animal mandibles around a metal firing channel, with a long
# irregular cortical receiver and deeply tapering roots. Moving jaws are separate.
fb=group('femur_body'); fm=group('femur_mechanism')
loft('Carved cortical receiver',[(.39,0,-.17,.025,.032),(.36,0,-.17,.065,.078),(.25,0,-.125,.063,.095),(.13,0,-.055,.075,.078),(0,0,-.022,.105,.071),(-.2,.007,-.014,.094,.062),(-.4,0,-.008,.069,.048),(-.6,0,0,.041,.035),(-.65,0,0,.023,.024)],bone,fb,flute=.065)
loft('Recessed firing channel',[(.18,0,.044,.023,.018),(.17,0,.044,.027,.02),(-.62,0,.044,.022,.018),(-.65,0,.044,.019,.017)],iron,fb,power=.6)
loft('Reciprocating bone bolt',[(.23,0,.079,.032,.025),(.2,0,.088,.047,.035),(-.18,0,.075,.024,.019),(-.3,0,.06,.006,.006)],edge,fm,power=.7)
for side in [-1,1]:
    jaw=group('femur_jaw_'+str(0 if side<0 else 1))
    cord('Swept mandible',[(side*.03,-.054,.24),(side*.10,-.042,.12),(side*.14,.015,-.14),(side*.115,.075,-.4),(side*.074,.05,-.68)], [.009,.046,.05,.034,.003],bone,jaw,16)
    for i in range(5):
        z=-.05-i*.11
        cord('Inward cortical tooth',[(side*.132,.018,z),(side*.109,.07,z-.02),(side*.061,.088,z-.035)],[.019,.014,.001],bone,jaw)
    cord('Receiver tendon',[(side*.049,-.13,.32),(side*.093,-.048,.12),(side*.102,-.024,-.19),(side*.071,-.006,-.53)],[.007,.013,.011,.002],marrow,fb)
    for i in range(6):
        z=.1-i*.072
        cord('Cortical fissure',[(side*.081,.021,z),(side*.094,-.009,z-.009),(side*.074,-.042,z-.018)],[.001,.002,.001],marrow,fb,6)

# TITHE: one asymmetric fluted gland, not a cluster of spheres. Contractile mouth
# and two continuous muscle sheets provide deformation anchors for the timeline.
ab=group('acid_body'); am=group('acid_mechanism')
loft('Necrotic gland mantle',[(.42,0,-.09,.013,.015),(.34,.01,-.053,.10,.095),(.23,-.012,-.028,.16,.13),(.08,.01,-.012,.18,.135),(-.08,-.012,-.012,.151,.129),(-.24,.006,-.013,.10,.082),(-.41,0,0,.057,.05),(-.59,0,0,.024,.026)],skin,ab,32,.08)
loft('Contractile mouth', [(-.42,0,0,.041,.041),(-.53,0,0,.035,.037),(-.61,0,0,.044,.041),(-.64,0,0,.039,.038),(-.64,0,0,.023,.023),(-.56,0,0,.021,.022)],marrow,am,32,.09)
loft('Mouth bile meniscus',[(-.565,0,0,.001,.001),(-.567,0,0,.021,.021)],bile,am,24,sub=0)
for side in [-1,1]:
    lobe=group('acid_jaw_'+str(0 if side<0 else 1))
    cord('Longitudinal muscle sheet',[(side*.012,-.057,.37),(side*.085,.058,.22),(side*.116,.089,.03),(side*.08,.072,-.2),(side*.026,.029,-.49)],[.005,.045,.04,.028,.002],vein,lobe,20)
    for i in range(7):
        z=.24-i*.061; width=.147-max(0,.05-z)*.20
        cord('Membrane vascular fork',[(side*.012,.116,z),(side*width*.6,.096,z-.026),(side*width,.018,z-.014),(side*width*.77,-.073,z+.012)],[.0015,.004,.004,.001],vein,ab,8)

# Hands: anatomically curved continuous glove palms and individual tapered,
# multi-joint fingers. Voxel union joins each palm/finger into a single glove.
hg=group('player_hands'); tr=group('trigger_hand'); tr.parent=hg; su=group('support_hand'); su.parent=hg
def weld_glove(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.convert(target='MESH'); bpy.ops.object.join()
    o=objects[0]; o.name=name
    mod=o.modifiers.new('Unified glove topology','REMESH'); mod.mode='VOXEL'; mod.voxel_size=.004; mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Leather relaxed surface','SMOOTH'); mod.factor=.6; mod.iterations=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Reproject unwrap after remeshing; every final glove has valid UV coordinates.
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(island_margin=.025); bpy.ops.object.mode_set(mode='OBJECT')
    return o
for parent,side,start,wrist in [(tr,1,(.25,-.43,.61),(.105,-.276,.345)),(su,-1,(-.30,-.41,.34),(-.15,-.20,-.04))]:
    points=[tuple(Vector(start).lerp(Vector(wrist),i/8)) for i in range(9)]
    radii=[.077,.079,.073,.069,.063,.062,.052,.055,.052]
    folded_limb('Tailored folded sleeve',points,radii,parent)
    direction=(Vector(wrist)-Vector(start)).normalized()
    cord('Overlapping leather gauntlet cuff',[tuple(Vector(wrist)+direction*t) for t in [-.045,-.02,.018,.052]],[.055,.057,.054,.048],leather,parent,24)
    parts=[]
    if side==1:
        parts.append(loft('Trigger glove palm',[(.355,.10,-.26,.039,.046),(.32,.092,-.24,.044,.065),(.26,.090,-.217,.045,.075),(.215,.084,-.215,.042,.069),(.192,.074,-.212,.025,.051)],leather,parent))
        for i in range(4):
            y=-.145-i*.035
            # The grip sweeps rearward as it descends. Lower fingers follow that
            # sweep instead of all curling into the same plane in empty air.
            rear=i*.029
            parts.append(cord('Curled trigger finger',[(.103,y,.277+rear*.58),(.106,y-.004,.239+rear*.8),(.086,y-.014,.192+rear),(.057,y-.018,.166+rear),(.015,y-.012,.177+rear)],[.018,.02,.017,.014,.009],leather,parent,12))
        parts.append(cord('Opposing trigger thumb',[(.071,-.273,.33),(.01,-.24,.31),(-.017,-.166,.25),(.012,-.136,.226)],[.026,.026,.021,.012],leather,parent,12))
    else:
        parts.append(loft('Supporting glove palm',[(-.034,-.137,-.195,.027,.033),(-.073,-.113,-.166,.049,.044),(-.17,-.103,-.149,.065,.044),(-.267,-.11,-.149,.049,.036),(-.285,-.112,-.148,.02,.017)],leather,parent))
        for i in range(4):
            z=-.098-i*.047
            parts.append(cord('Fore-end gripping finger',[(-.063,-.161,z),(-.125,-.138,z),(-.136,-.094,z-.005),(-.118,-.052,z-.009),(-.071,-.033,z-.01)],[.018,.019,.017,.014,.008],leather,parent,12))
        parts.append(cord('Opposing support thumb',[(-.138,-.165,-.055),(-.083,-.105,-.06),(-.012,-.077,-.091),(.003,-.09,-.126)],[.025,.024,.018,.009],leather,parent,12))
    weld_glove(parts,'Unified articulated '+parent.name+' glove')
    if side==1:
        for i in range(3):
            y=-.165-i*.035
            rear=i*.029
            cord('Glove knuckle stitch',[(.123,y,.264+rear*.6),(.126,y-.001,.244+rear*.8),(.104,y-.008,.219+rear)],[.0011]*3,thread,parent,6)
    else:
        for i in range(4):
            z=-.098-i*.047
            cord('Support knuckle stitch',[(-.145,-.112,z),(-.146,-.087,z-.003),(-.131,-.063,z-.006)],[.0011]*3,thread,parent,6)
    cord('Sleeve seam',[tuple(Vector(start).lerp(Vector(wrist),t)+Vector((side*.054,0,0))) for t in [0,.3,.65,1]],[.0015]*4,thread,parent,6)

kb=group('kick_body'); kt=group('kick_thigh'); ks=group('kick_shin'); kf=group('kick_boot')
for parent,points,radii in [(kt,[(0,0,0),(0,-.04,0),(.006,-.18,.006),(0,-.33,0),(0,-.4,0)],[.079,.095,.084,.069,.069]),(ks,[(0,0,0),(0,-.055,.008),(0,-.15,.025),(0,-.28,.013),(0,-.4,0)],[.075,.079,.071,.057,.051])]:
    folded_limb('Folded trouser '+parent.name,points,radii,parent)
loft('Stitched combat boot upper',[(.092,0,-.056,.025,.035),(.075,0,-.03,.065,.085),(.01,0,-.024,.072,.11),(-.07,0,-.066,.078,.072),(-.16,0,-.091,.09,.044),(-.245,0,-.099,.09,.035),(-.286,0,-.105,.065,.022),(-.299,0,-.106,.023,.012)],leather,kf,32,power=.8)
loft('Heavy welt sole',[(.097,0,-.133,.025,.012),(.081,0,-.136,.07,.022),(-.06,0,-.137,.08,.021),(-.2,0,-.14,.097,.023),(-.28,0,-.14,.077,.021),(-.308,0,-.14,.025,.012)],rubber,kf,32,power=.65)
loft('Forged toe shell',[(-.183,0,-.096,.091,.042),(-.198,0,-.096,.092,.042),(-.26,0,-.102,.085,.033),(-.287,0,-.106,.064,.022),(-.30,0,-.107,.025,.014)],iron,kf,32,power=.8)
for i in range(6):
    z=-.017-i*.026; y=.04-i*.019
    cord('Crossed waxed boot laces',[(-.038,y,z),(.035,y-.017,z-.026),(-.035,y-.017,z-.026)],[.003]*3,thread,kf,8)
for side in [-1,1]:
    cord('Double stitched welt',[(side*.057,-.094,.064),(side*.075,-.113,-.06),(side*.09,-.116,-.19),(side*.059,-.121,-.277)],[.002]*4,thread,kf,8)
    for i in range(5):
        z=-.055-i*.046
        cord('Raised sole lug',[(side*.042,-.157,z),(side*.081,-.157,z)],[.016,.016],rubber,kf,6)

# Bake modifiers and rigidly merge by material inside each animation anchor.
for o in list(bpy.context.scene.objects):
    if o.type!='MESH': continue
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.convert(target='MESH')
for parent in [o for o in bpy.context.scene.objects if o.type=='EMPTY']:
    bymat={}
    for o in list(parent.children):
        if o.type=='MESH': bymat.setdefault(o.data.materials[0].name,[]).append(o)
    for name,objects in bymat.items():
        if len(objects)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); objects[0].name=parent.name+' '+name
(ROOT/'assets/blender').mkdir(parents=True,exist_ok=True); (ROOT/'public/models').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/organic-arsenal.blend'))
for name,prefixes in [('ossuary',('femur_',)),('tithe',('acid_',)),('warden-hands',('player_hands','trigger_hand','support_hand')),('warden-kick',('kick_',))]:
    bpy.ops.object.select_all(action='DESELECT')
    def include(o):
        while o:
            if any(o.name.startswith(p) for p in prefixes): return True
            o=o.parent
        return False
    for o in bpy.context.scene.objects:
        if include(o): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/f'{name}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
print('ORGANIC_ARSENAL_EXPORTED',sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'))
