"""Author original horror character parts in Blender; game joints drive the exported parts.
Run on a factory scene. The editable .blend is retained per character.
"""
import bpy, bmesh, math, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ATLAS_PATH=ROOT/'public/textures/character-material-atlas.png'
def xyz(v): return (v[0],-v[2],v[1])
random.seed(97)

def mat(name, rgb, rough=.8, metal=0, pattern=None):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    quadrant = (0,1) if 'wool' in name else (1,1) if 'coat' in name else (1,0) if 'leather' in name else (0,0) if name=='Mortuary skin' else None
    if quadrant is not None and ATLAS_PATH.exists():
        image=bpy.data.images.load(str(ATLAS_PATH),check_existing=True);image.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']);m['atlasQuadrant']=quadrant
    elif pattern:
        img=bpy.data.images.new(name+' atlas',width=256,height=256); pixels=[]
        for y in range(256):
            for x in range(256):
                noise=random.random(); t=.75+noise*.2
                if pattern=='cloth': t-=.085*((x%3==0)+(y%3==0)); t-=.12*(.5+.5*math.sin(x*.08+math.sin(y*.04)))**8
                if pattern=='skin': t-=.15*(.5+.5*math.sin(x*.06+math.sin(y*.07)))**5
                if pattern=='flesh': t-=.25*(.5+.5*math.sin(x*.21+math.sin(y*.03)*2))**9
                pixels.extend((rgb[0]*t,rgb[1]*t,rgb[2]*t,1))
        img.pixels.foreach_set(pixels); img.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    return m

def anchor(name):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def mesh(name,vs,fs,material,parent,sub=0):
    data=bpy.data.meshes.new(name);data.from_pydata([xyz(v) for v in vs],[],fs);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=parent;data.materials.append(material)
    uv=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        p.use_smooth=True
        for li in p.loop_indices:
                v=vs[data.loops[li].vertex_index];uv.data[li].uv=((math.atan2(v[0],v[2])/(2*math.pi)+.5),v[1]*.55+.2)
    if sub:
        mod=o.modifiers.new('Surface subdivision','SUBSURF');mod.levels=sub
    return o
def section(name,rings,material,parent,fold=0,n=24,sub=1):
    vs=[]
    for j,(y,rx,rz,cz) in enumerate(rings):
        for i in range(n):
            a=2*math.pi*i/n
            f=1+fold*(math.sin(a*7+j*.23)*.65+math.sin(a*11-j*.11)*.35)
            vs.append((math.sin(a)*rx*f,y,cz+math.cos(a)*rz*f))
    fs=[tuple(range(n-1,-1,-1))]
    for j in range(len(rings)-1):
        for i in range(n): fs.append((j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n))
    fs.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name,vs,fs,material,parent,sub)
def orb(name,pos,scale,material,parent,segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,location=xyz(pos))
    o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.parent=parent;o.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return o
def curve(name,points,r,material,parent):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=6;d.bevel_depth=r;d.bevel_resolution=2
    s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for b,p in zip(s.bezier_points,points):b.co=xyz(p);b.handle_left_type=b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.parent=parent;d.materials.append(material);return o
def fuse(name,objects,voxel=.009):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0];o.name=name
    mod=o.modifiers.new('Unified sculpt surface','REMESH');mod.mode='VOXEL';mod.voxel_size=voxel;mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Relax sculpt','SMOOTH');mod.factor=1.2;mod.iterations=4;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Game topology','DECIMATE');mod.ratio=.35;bpy.ops.object.modifier_apply(modifier=mod.name)
    # Remeshing discards UVs. Unwrap the final surface for packed albedo.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
    return o

def build(kind):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    skin=mat('Mortuary skin',(.34,.30,.225),.83,pattern='skin')
    flesh=mat('Striated exposed muscle',(.32,.072,.055),.64,pattern='flesh')
    bone=mat('Stained dentine',(.28,.235,.15),.86)
    dark=mat('Deep cavities',(.009,.006,.005),.94)
    robe=mat('Ash stained oxblood wool',(.16,.022,.016),.98,pattern='cloth')
    coat=mat('Decayed charcoal coat',(.09,.105,.087),.96,pattern='cloth')
    apron=mat('Blood soaked butcher leather',(.20,.13,.075),.84,pattern='skin')
    iron=mat('Pitted ritual iron',(.10,.115,.12),.56,.72)
    boot=mat('Cracked black leather',(.036,.03,.023),.88,pattern='skin')
    yellow=mat('Bilious tissue',(.24,.27,.075),.48,pattern='skin')
    tissue=flesh if kind=='runner' else yellow if kind=='spitter' else skin
    body=anchor('body');head=anchor('head')
    width=.35 if kind=='brute' else .285 if kind=='spitter' else .225
    if kind=='cultist':
        # Full ankle-length vestment with a shoulder yoke and narrow cinched waist.
        section('Heavy pleated vestment',[(.28,.32,.19,.014),(.32,.32,.19,.01),(.53,.282,.173,.01),(.76,.223,.152,0),(.89,.172,.131,0),(1.0,.179,.14,0),(1.22,.236,.159,0),(1.36,.258,.153,0),(1.43,.205,.125,0),(1.47,.083,.075,0)],robe,body,.11,40)
        section('Overlapping shoulder mantle',[(1.19,.259,.181,0),(1.21,.26,.183,0),(1.37,.282,.18,0),(1.44,.209,.133,0),(1.49,.088,.086,0)],coat,body,.07,32)
        for side in [-1,1]:
            # Separate hanging panels break symmetry without toy-like jewellery.
            vs=[(side*.05,1.42,-.15),(side*.12,1.40,-.16),(side*.12,.64,-.18),(side*.048,.59,-.184)]
            panel=mesh('Ritual stole',vs,[(0,1,2,3)],apron,body,1)
            mod=panel.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.006
        curve('Rope belt',[(math.sin(i*math.pi/8)*.185,.90,math.cos(i*math.pi/8)*.145) for i in range(17)],.012,boot,body)
        curve('Hanging knot',[(.05,.90,-.154),(.072,.77,-.179),(.09,.66,-.176)],.012,boot,body)
    else:
        depth=.235 if kind in ['brute','spitter'] else .135
        hunch=.09 if kind=='shambler' else .065 if kind=='runner' else .035 if kind=='spitter' else 0
        section('Continuous torso',[(.68,width*.70,depth*.58,.012),(.73,width*.85,depth*.83,.016),(.82,width*.91,depth*.95,.013),(.94,width*.77,depth*.91,0),(1.07,width*.88,depth,-hunch*.2),(1.23,width,depth,-hunch*.5),(1.35,width*.94,depth*.86,-hunch*.8),(1.44,width*.58,depth*.63,-hunch),(1.52,.056,.065,-hunch)],tissue,body,n=32)
        if kind=='runner':
            for side in [-1,1]:
                for j in range(6):
                    y=1.3-j*.065
                    curve('Intercostal ridges',[(side*.025,y,-.138),(side*.12,y-.017,-.14),(side*.195,y-.028,-.07)],.009,flesh,body)
                curve('Neck tendon',[(side*.045,1.57,-.04),(side*.05,1.44,-.06),(side*.15,1.35,-.105)],.012,bone,body)
        if kind=='shambler':
            for side in [-1,1]:
                vs=[(side*.055,1.43,-.095),(side*.24,1.33,-.1),(side*.19,.81,-.16),(side*.065,.71,-.14),(side*.085,1.10,-.154)]
                o=mesh('Torn work coat lapel',vs,[(0,1,2,3,4)],coat,body,1);m=o.modifiers.new('Thick torn cloth','SOLIDIFY');m.thickness=.012
            for j in range(4):curve('Exposed rib', [(-.08,1.22-j*.06,-.14),(0,1.2-j*.06,-.18),(.09,1.22-j*.06,-.14)],.01,bone,body)
        if kind=='brute':
            section('Butcher apron',[(.39,.21,.18,-.025),(.43,.24,.20,-.023),(.77,.245,.215,-.026),(1.02,.265,.241,-.01),(1.28,.22,.241,-.009)],apron,body,.02,32)
            for side in [-1,1]:curve('Apron strap',[(side*.18,1.25,-.238),(side*.20,1.44,-.09),(side*.22,1.31,.18)],.026,boot,body)
        if kind=='spitter':
            belly=fuse('Distended infected abdomen',[orb('Belly',(0,1.03,-.155),(.24,.29,.18),yellow,body),orb('Throat sac',(0,1.37,-.14),(.13,.20,.13),yellow,body)])
            for side in [-1,1]:
                curve('Varicose vessel',[(side*.04,1.28,-.29),(side*.16,1.16,-.3),(side*.14,.98,-.30),(side*.045,.83,-.23)],.007,flesh,body)
    # Skull is one remeshed sculpt: brow, malar arches, nose and jaw flow together.
    parts=[orb('Cranium',(0,.15,0),(.105,.145,.098),tissue,head),orb('Jaw',(0,.049,-.033),(.064,.068,.066),tissue,head),orb('Nasal bridge',(0,.135,-.09),(.022,.055,.029),tissue,head)]
    for side in [-1,1]:
        parts.append(orb('Cheekbone',(side*.072,.10,-.062),(.028,.038,.031),tissue,head))
        parts.append(orb('Brow',(side*.049,.187,-.07),(.057,.023,.038),tissue,head))
    skull=fuse('Gaunt unified face',parts,.008)
    for side in [-1,1]:
        # Boolean sockets produce actual recessed eyes, not coloured spheres.
        cutter=orb('socket cutter',(side*.049,.149,-.091),(.029,.024,.033),dark,head)
        bpy.context.view_layer.objects.active=skull
        mod=skull.modifiers.new('Recessed orbit','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        orb('Sunken orbit',(side*.049,.148,-.078),(.023,.018,.017),dark,head)
    cutter=orb('mouth cutter',(0,.049,-.098),(.040,.022,.033),dark,head)
    bpy.context.view_layer.objects.active=skull
    mod=skull.modifiers.new('Recessed oral cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    orb('Recessed mouth interior',(0,.049,-.070),(.036,.019,.013),dark,head)
    for side in [-1,1]:
        for j in range(0 if kind=='cultist' else 3):
            if j==2 and (side<0 or kind=='shambler'):continue
            tooth=section('Irregular exposed tooth',[(.047+j*.002,.004,.005,-.090),(.061-j*.001,.005,.006,-.090)],bone,head,n=8,sub=0);tooth.location.x=side*(.007+j*.010)
    if kind=='cultist':
        # Hood is an open draped shell, leaving a deep face opening.
        vs=[];n=28
        rings=[(-.05,.145,.12,.03),(.07,.17,.14,.04),(.22,.165,.145,.035),(.32,.104,.105,.025),(.40,.015,.025,.04)]
        for y,rx,rz,cz in rings:
            for i in range(n):
                a=-2.25+4.5*i/(n-1);vs.append((math.sin(a)*rx,y,cz+math.cos(a)*rz))
        fs=[(j*n+i,(j+1)*n+i,(j+1)*n+i+1,j*n+i+1) for j in range(len(rings)-1) for i in range(n-1)]
        hood=mesh('Open pointed penitential hood',vs,fs,robe,head,1);m=hood.modifiers.new('Heavy hood thickness','SOLIDIFY');m.thickness=.014
        # Lower half mask leaves the eye sockets sunk under the hood.
        section('Iron jaw veil',[(-.035,.068,.06,-.052),(.00,.085,.06,-.058),(.07,.093,.067,-.048),(.10,.086,.054,-.057)],iron,head,n=20)
    if kind=='brute':
        section('Riveted executioner helmet',[(.15,.126,.108,.008),(.18,.129,.11,.009),(.29,.109,.10,.014),(.33,.04,.047,.01)],iron,head,n=24)
        for side in [-1,1]:curve('Helmet rim',[(side*.12,.18,-.04),(side*.104,.17,-.091),(side*.025,.172,-.108)],.006,iron,head)
    if kind=='spitter':
        curve('Split mandible left',[(-.07,.08,-.05),(-.09,-.01,-.10),(-.04,-.06,-.13)],.018,tissue,head)
        curve('Split mandible right',[(.07,.08,-.05),(.09,-.01,-.10),(.04,-.06,-.13)],.018,tissue,head)
    # Export part-local surfaces. Existing shoulder/elbow/knee pivots animate them.
    for side,label in [(-1,'left'),(1,'right')]:
        upper=anchor(label+'Arm');lower=anchor(label+'Forearm');hand=anchor(label+'Hand')
        cloth=robe if kind=='cultist' else coat if kind=='shambler' else tissue
        bulk=1.45 if kind=='brute' else 1
        section('Rounded sloping deltoid',[(.115,.012*bulk,.02*bulk,0),(.092,.055*bulk,.053*bulk,0),(.047,.089*bulk,.088*bulk,0),(-.025,.098*bulk,.088*bulk,0),(-.13,.078*bulk,.077*bulk,-.005),(-.24,.059*bulk,.056*bulk,-.006),(-.32,.050*bulk,.049*bulk,0),(-.35,.025*bulk,.028*bulk,0)],cloth,upper,.08 if kind in ['cultist','shambler'] else .015)
        section('Forearm',[(.065,.022*bulk,.024*bulk,0),(.034,.05*bulk,.053*bulk,0),(-.025,.067*bulk,.062*bulk,0),(-.12,.059*bulk,.051*bulk,-.009),(-.24,.037*bulk,.034*bulk,-.014),(-.29,.036*bulk,.032*bulk,-.015),(-.31,.02*bulk,.02*bulk,-.015)],cloth,lower,.065 if kind in ['cultist','shambler'] else 0)
        palm=orb('Palm',(0,-.037,-.011),(.041,.065,.025),boot if kind=='cultist' else tissue,hand)
        fingers=[palm]
        for j in range(4):
            x=(j-1.5)*.020
            fingers.append(orb('Finger',(x,-.097+(abs(j-1.5)*.008),-.029),(.011,.044,.012),palm.data.materials[0],hand,16))
        fingers.append(orb('Thumb',(side*.045,-.033,-.025),(.016,.037,.017),palm.data.materials[0],hand,16))
        fuse('Sculpted hand',fingers,.005)
        thigh=anchor(label+'Leg');shin=anchor(label+'Shin');foot=anchor(label+'Foot')
        legmat=tissue if kind=='runner' else coat
        section('Thigh',[(.095,.035*bulk,.039*bulk,0),(.057,.076*bulk,.079*bulk,0),(.003,.097*bulk,.096*bulk,0),(-.07,.098*bulk,.094*bulk,0),(-.19,.076*bulk,.070*bulk,0),(-.31,.053*bulk,.049*bulk,.014),(-.39,.049*bulk,.048*bulk,.018)],legmat,thigh,.065 if kind!='runner' else 0)
        section('Calf',[(.025,.05*bulk,.049*bulk,0),(-.08,.065*bulk,.067*bulk,.014),(-.18,.052*bulk,.054*bulk,.016),(-.30,.037*bulk,.036*bulk,0),(-.35,.034*bulk,.035*bulk,0)],legmat,shin,.07 if kind!='runner' else 0)
        section('Boot',[(.09,.038,.05,.0),(.045,.047,.071,-.018),(-.005,.061,.123,-.052),(-.052,.069,.142,-.061),(-.079,.066,.137,-.061)],tissue if kind=='runner' else boot,foot,n=24)
        if kind!='runner':
            section('Layered sole',[(-.075,.068,.14,-.061),(-.093,.068,.14,-.061)],dark,foot,n=24,sub=0)
            for j in range(4):curve('Boot lace',[(-.034,.04-j*.015,-.06-j*.012),(.032,.034-j*.015,-.07-j*.012)],.0025,apron,foot)
    if kind=='cultist':
        gun=anchor('firearm')
        # Compact receiver and tapered hollow barrel with forward -Z axis.
        for x in [-.032,.032]:
            o=section('Service gun barrel',[(-.46,.022,.022,0),(-.08,.031,.031,0)],iron,gun,n=20,sub=0)
            o.rotation_euler.x=math.pi/2;o.location=xyz((x,.009,0))
        curve('Wood stock',[(0,0,.03),(0,-.07,.13),(0,-.09,.21)],.038,apron,gun)
    # Apply all modifiers, then consolidate rigid meshes per material within anchors.
    for o in list(bpy.context.scene.objects):
        if o.type not in {'MESH','CURVE'}:continue
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    for a in [o for o in bpy.context.scene.objects if o.type=='EMPTY']:
        bymat={}
        for o in a.children:
            if o.type=='MESH' and len(o.data.materials)==1:bymat.setdefault(o.data.materials[0],[]).append(o)
        for m,items in bymat.items():
            if len(items)<2:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in items:o.select_set(True)
            bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name=a.name+'_'+m.name
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or not o.data.uv_layers:continue
        uv=o.data.uv_layers.active
        for face in o.data.polygons:
            material=o.data.materials[face.material_index];q=material.get('atlasQuadrant')
            if q is None:continue
            for li in face.loop_indices:
                u,v=uv.data[li].uv
                uv.data[li].uv=(q[0]*.5+.006+min(.999,max(0,u))*.488,q[1]*.5+.006+min(.999,max(0,v))*.488)
    # Source scene arranges the part anchors anatomically; export keeps their local data.
    # The runtime uses these same parent-independent anchors to retain severing behavior.
    positions={'body':(0,0,0),'head':(0,1.37 if kind=='spitter' else 1.52,-.22 if kind=='spitter' else -.015)}
    if kind in ['shambler','runner']:
        positions['head']=(0,1.52,-.105 if kind=='shambler' else -.080)
    for side,label in [(-1,'left'),(1,'right')]:
        shoulder=.24 if kind=='cultist' else width
        positions.update({label+'Arm':(side*shoulder,1.36,0),label+'Forearm':(side*(shoulder+.022 if kind=='cultist' else shoulder+.065),1.05,-.018),label+'Hand':(side*(shoulder+.034 if kind=='cultist' else shoulder+.09),.775,-.065),label+'Leg':(side*(.16 if kind=='brute' else .108),.79,0),label+'Shin':(side*(.178 if kind=='brute' else .126),.425,.026),label+'Foot':(side*(.182 if kind=='brute' else .13),.095,-.015)})
    if kind=='cultist':positions['firearm']=(.274,.775,-.065)
    for name,p in positions.items():bpy.data.objects[name].location=xyz(p)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/blender/{kind}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/{kind}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
    print('ENEMY_EXPORTED',kind,sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'))
for kind in ['cultist','shambler','runner','spitter','brute']:build(kind)
