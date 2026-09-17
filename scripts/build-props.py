"""Original Blender-authored breakables. Blender --background --python scripts/build-props.py.
Meters, Blender Z-up; glTF export converts to the game's Y-up. Source includes
separate editable intact, damage-overlay and persistent wreckage collections.
"""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
random.seed(271)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,col,rough=.8,metal=0):
 m=bpy.data.materials.new(name); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*col,1); p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
wood=material('Split smoked oak',(.25,.16,.085)); iron=material('Oxidized forged iron',(.1,.12,.13),.55,.72); rust=material('Ferric crust',(.09,.035,.012),.94,.22); ceramic=material('Ash glazed ceramic',(.28,.25,.21),.58); cut=material('Fresh timber cuts',(.43,.30,.15)); dark=material('Fracture cavity',(.012,.009,.008)); flesh=material('Desiccated organic membrane',(.23,.057,.035),.7); brass=material('Worn funerary bronze',(.14,.10,.037),.55,.65)
# Packed original maps export directly; surfaces also retain UVs for art edits.
for mat,kind,base in [(wood,'wood',(.22,.13,.066)),(iron,'metal',(.07,.085,.09)),(ceramic,'ceramic',(.23,.20,.17)),(rust,'rust',(.09,.038,.016)),(brass,'bronze',(.14,.10,.037))]:
 im=bpy.data.images.new('Prop '+kind+' surface',width=256,height=256); pix=[]
 for y in range(256):
  for x in range(256):
   n=random.random(); grain=math.sin(x*.19+math.sin(y*.031)*1.2)
   f=.78+n*.17-max(0,grain)**14*.17 if kind=='wood' else .74+n*.19-(math.sin(x*.047)+math.cos(y*.027+x*.007))*.028
   pix.extend((*[v*f for v in base],1))
 im.pixels.foreach_set(pix);im.pack()
 tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
def group(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def mesh(name,verts,faces,mat,parent,smooth=False,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.parent=parent;d.materials.append(mat)
 for p in d.polygons:p.use_smooth=smooth
 uv=d.uv_layers.new(name='SurfaceUV')
 for p in d.polygons:
  for li in p.loop_indices:
   co=d.vertices[d.loops[li].vertex_index].co;uv.data[li].uv=(co.x*2+co.y*.23,co.z*1.5+co.y)
 if bevel:
  mod=o.modifiers.new('Rounded worn arris','BEVEL');mod.width=bevel;mod.segments=2
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
 return o
def box(name,c,s,mat,parent,bevel=.008,rot=0):
 verts=[(a*s[0]/2,b*s[1]/2,z*s[2]/2) for z in [-1,1] for b in [-1,1] for a in [-1,1]]
 verts=[(c[0]+x*math.cos(rot)-y*math.sin(rot),c[1]+x*math.sin(rot)+y*math.cos(rot),c[2]+z) for x,y,z in verts]
 return mesh(name,verts,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],mat,parent,bevel=bevel)
def lathe(name,profile,mat,parent,N=48,start=0,end=math.tau,dent=False):
 verts=[]
 for j,(r,z) in enumerate(profile):
  for i in range(N+1):
   a=start+(end-start)*i/N;rr=r
   if dent:rr*=1-.075*math.exp(-((a-2.2)/.4)**2)*math.sin(z*math.pi/1.2)**2+.008*math.sin(a*24)
   verts.append((rr*math.cos(a),rr*math.sin(a),z))
 faces=[]
 for j in range(len(profile)-1):
  for i in range(N):
   k=j*(N+1)+i;faces.append((k,k+1,k+N+2,k+N+1))
 return mesh(name,verts,faces,mat,parent,True)
def tube(name,points,r,mat,parent,sides=8):
 vs=[]
 for i,p in enumerate(points):
  direction=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  direction.normalize();u=direction.cross(Vector((0,0,1)))
  if u.length<.01:u=direction.cross(Vector((0,1,0)))
  u.normalize();v=direction.cross(u)
  for j in range(sides):vs.append(Vector(p)+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*v))
 fs=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(len(points)-1) for j in range(sides)]
 return mesh(name,vs,fs,mat,parent,True)
def plank(parent,c,width,height,depth,name='Hand hewn plank',rotation=0):
 # Individually cut bevelled polygonal ends, deliberately unequal corner notches.
 w=width/2;h=height/2;shape=[(-w,-h),(.18*w,-h+.012),(w,-h+.005),(w,h-.04),(.6*w,h),(-w,h-.009)]
 verts=[]
 for y in [-depth/2,depth/2]:
  for x,z in shape:verts.append((c[0]+x*math.cos(rotation)-y*math.sin(rotation),c[1]+x*math.sin(rotation)+y*math.cos(rotation),c[2]+z))
 n=len(shape);fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 return mesh(name,verts,fs,wood,parent,bevel=.006)
def crack(parent,points,width=.006):tube('Deep branching fracture',points,width,dark,parent,5)
for kind in ['crate','barrel','urn']:
 intact=group(kind+'_intact');damage=group(kind+'_damage');wreck=group(kind+'_wreckage')
 if kind=='crate':
  for axis in range(2):
   for side in [-1,1]:
    for i in range(5):
     c=((i-2)*.177,side*.425,.49) if axis==0 else (side*.425,(i-2)*.177,.49)
     plank(intact,c,.17,.91,.055,rotation=axis*math.pi/2)
    for z in [.105,.84]:
     box('Iron encircling strap',(0,side*.465,z) if axis==0 else (side*.465,0,z),(.94,.025,.058) if axis==0 else (.025,.94,.058),iron,intact,.004)
    for x in [-.385,.385]:
     for z in [.105,.84]:box('Square clinched nail',(x,side*.485,z) if axis==0 else (side*.485,x,z),(.026,.017,.026) if axis==0 else (.017,.026,.026),rust,intact,.004)
    # Readable deep longitudinal cracks, fresh splinters sit above actual plank surfaces.
    c=[(-.23,side*.458,.73),(-.20,side*.464,.59),(-.24,side*.464,.47),(-.2,side*.463,.25)]
    if axis:c=[(y,x,z) for x,y,z in c]
    crack(damage,c,.01)
    for k in range(3):
     p=(-.19+k*.02,side*.468,.38+k*.06) if axis==0 else (side*.468,-.19+k*.02,.38+k*.06)
     box('Exposed split timber',p,(.015,.012,.18),cut,damage,.001)
  for i in range(5):box('Lid plank',((i-2)*.177,0,.972),(.17,.85,.04),wood,intact,.007)
  # Corner guards have folds rather than oversized rectangular blocks.
  for x in [-.447,.447]:
   for y in [-.447,.447]:
    box('Folded corner iron',(x,y,.49),(.042,.042,.9),iron,intact,.003)
  for i in range(11):
   a=i*2.399;rad=.13+(i%4)*.15;ob=plank(wreck,(math.cos(a)*rad,math.sin(a)*rad,.08+(i%3)*.025),.11,.48+(i%3)*.09,.035,'Split fallen timber')
   # Rotate about own local center by baking parent-space source into origin first.
   bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');ob.rotation_euler=(math.pi/2,0,a);ob.select_set(False)
  for i in range(3):box('Torn iron strap',((i-1)*.23,0,.045),(.04,.64,.017),iron,wreck,.003,i*.8)
 elif kind=='barrel':
  profile=[(.34,.02),(.4,.045),(.407,.08),(.4,.12),(.418,.2),(.435,.35),(.441,.6),(.436,.86),(.418,1.04),(.398,1.12),(.4,1.17),(.38,1.19),(.364,1.17),(.37,1.13)]
  lathe('Dented rolled barrel shell',profile,iron,intact,dent=True)
  lathe('Inset sealed lid',[(0,1.148),(.365,1.148),(.365,1.16),(.35,1.166),(0,1.166)],iron,intact)
  for z,r in [(.11,.407),(.3,.434),(.88,.436),(1.13,.405)]:lathe('Raised rolled hoop',[(r-.01,z-.025),(r+.012,z-.018),(r+.016,z),(r+.01,z+.018),(r-.01,z+.025)],rust,intact)
  for i in range(9):
   a=i*2.399;r=.08+(i%3)*.085
   tube('Organic capillary',[(0,0,1.178),(r*.6*math.cos(a),r*.6*math.sin(a),1.18),(r*math.cos(a+.3),r*math.sin(a+.3),1.183)],.008,flesh,intact)
  for i in range(4):
   a=i*math.pi/2
   points=[]
   for j in range(6):
    b=a+(.035 if j%2 else -.045);z=.82-j*.085;r=.448
    points.append((r*math.cos(b),r*math.sin(b),z))
   crack(damage,points,.013)
  lathe('Grounded lower torn shell',[(.34,.014),(.4,.045),(.41,.18),(.43,.29)],iron,wreck,dent=True)
  for i in range(7):
   a=i*math.tau/7;start=a+.07
   ob=lathe('Curled torn sheet',[(.33,.03),(.43,.08),(.5,.16),(.55,.24+(i%2)*.1)],iron,wreck,8,start,start+.42,True)
  lathe('Broken top hoop',[(.47,.03),(.49,.04),(.49,.055),(.47,.065)],rust,wreck,32,0,4.8)
 else:
  profile=[(.16,.012),(.24,.025),(.25,.055),(.232,.09),(.2,.135),(.255,.2),(.32,.29),(.37,.4),(.39,.52),(.375,.65),(.335,.74),(.263,.805),(.19,.84),(.174,.9),(.178,.995),(.23,1.016),(.239,1.041),(.231,1.062),(.195,1.07),(.163,1.045),(.144,1.02),(.14,.9),(.16,.845),(.23,.79),(.30,.715),(.337,.61),(.347,.49),(.323,.37),(.26,.27),(.17,.19),(0,.18)]
  lathe('Thrown hollow funerary vessel',profile,ceramic,intact,64)
  for z,r in [(.063,.25),(.23,.28),(.77,.31),(1.04,.24)]:lathe('Incised bronze band',[(r,z-.012),(r+.005,z),(r,z+.012)],brass,intact)
  for side in [-1,1]:
   points=[(side*(.3+.15*math.sin(t*math.pi)),0,.76-t*.25) for t in [j/16 for j in range(17)]]
   tube('Cast loop handle',points,.027,brass,intact,10)
  # Thin raised funerary ribs follow the belly; restrained, readable relief.
  for i in range(12):
   a=i*math.tau/12;points=[(r*math.cos(a),r*math.sin(a),z) for r,z in [(.328,.31),(.383,.43),(.399,.52),(.384,.64),(.345,.72)]]
   tube('Funerary carved rib',points,.008,brass,intact,5)
  for i in range(4):
   a=i*math.pi/2
   crack(damage,[(r*math.cos(a+d),r*math.sin(a+d),z) for r,z,d in [(.34,.74,0),(.38,.64,.025),(.4,.52,-.028),(.383,.43,.02),(.338,.32,-.04)]],.009)
  lathe('Surviving ceramic foot',profile[:5],ceramic,wreck,40)
  for i in range(12):
   a=i*2.399;r=.3+(i%3)*.12;cx=math.cos(a)*r;cy=math.sin(a)*r
   verts=[(cx-.12,cy-.07,.022),(cx+.1,cy-.08,.025),(cx+.14,cy+.035,.05+(i%3)*.035),(cx-.08,cy+.1,.04),(cx-.12,cy-.07,.045),(cx+.1,cy-.08,.048),(cx+.14,cy+.035,.073+(i%3)*.035),(cx-.08,cy+.1,.063)]
   mesh('Thick curved ceramic shard',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],ceramic,wreck,bevel=.005)
# Authored chapel fixtures; same library permits replacement without changing navigation.
stone=material('Sacrificial basalt',(.14,.145,.13),.91)
stone_tex=stone.node_tree.nodes.new('ShaderNodeTexImage');stone_tex.image=bpy.data.images['Prop ceramic surface'];stone.node_tree.links.new(stone_tex.outputs['Color'],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
cloth=material('Dried oxblood altar runner',(.095,.012,.009),.94)
wax=material('Tallow',(.44,.34,.20),.8)
flame=material('Lantern wick light',(.8,.3,.04),.6)
flame.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.3,.035,1)
flame.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=3
altar=group('altar_intact');altar.rotation_euler.z=math.pi # runner faces game +Z
for c,sz in [((0,0,.1),(2.75,1.3,.2)),((0,0,.24),(2.48,1.08,.11)),((0,0,1.03),(2.6,1.08,.22)),((0,0,.905),(2.42,.94,.07))]:box('Carved basalt cornice',c,sz,stone,altar,.035)
for side in [-1,1]:
 for c,sz in [((side*.87,0,.57),(.48,.74,.61)),((side*.87,0,.3),(.59,.85,.09)),((side*.87,0,.845),(.59,.85,.08))]:box('Chamfered altar pier',c,sz,stone,altar,.025)
 for y in [-.38,.38]:
  for x in [-.15,0,.15]:box('Pier carved recess',(side*.87+x,y,.58),(.035,.02,.36),dark,altar,.005)
# Continuous draped runner bends across the lip; asymmetrical hem, close-set folds.
verts=[];rows=[(-.49,1.17),(-.15,1.17),(.2,1.17),(.52,1.17),(.575,1.15),(.61,.93),(.614,.72),(.614,.49)]
for j,(y,z) in enumerate(rows):
 for i in range(17):
  x=-.37+i*.74/16;fold=math.sin(i*1.5)*.01*(j/7)
  verts.append((x,y+fold,z+math.sin(i*1.13)*.018*(j/7)))
mesh('Folded woven altar runner',verts,[(j*17+i,j*17+i+1,(j+1)*17+i+1,(j+1)*17+i) for j in range(7) for i in range(16)],cloth,altar,True)
# Embroidered inverted seal stays thin to the cloth surface.
pts=[(.21*math.cos(math.pi/2+i*math.tau/5),.637,.79+.21*math.sin(math.pi/2+i*math.tau/5)) for i in range(5)]
for i in range(5):tube('Embroidered cult seal',[pts[i],pts[(i+2)%5]],.005,brass,altar,5)
for x in [-1,-.7,.7,1]:
 y=-.17 if abs(x)>.8 else .18;h=.23+abs(x)*.13
 o=lathe('Melted votive',[(.041,1.15),(.044,1.15+h*.6),(.036,1.15+h),(.018,1.15+h-.018)],wax,altar,20);o.location=(x,y,0)
 for j in range(3):tube('Wax gutter',[(x+.033*math.cos(j*2),y+.033*math.sin(j*2),1.15+h-.025),(x+.04*math.cos(j*2),y+.04*math.sin(j*2),1.15+h*(.3+j*.13))],.009,wax,altar)
 o=lathe('Candle flame',[(.01,1.15+h),(.022,1.18+h),(.009,1.23+h),(0,1.27+h)],flame,altar,12);o.location=(x,y,0)
# Hinged iron scripture folio with separated cover and pages.
box('Bound ritual folio',(.11,.01,1.185),(.49,.41,.045),iron,altar,.013,.12)
box('Folio cut page block',(.11,.01,1.216),(.455,.377,.021),wax,altar,.005,.12)
for j in range(7):box('Scripture ruling',(.11,-.12+j*.04,1.229),(.3-(j%3)*.025,.006,.002),dark,altar,.0005,.12)
lantern=group('lantern_intact')
for z in [.025,.07,.52]:lathe('Octagonal lantern rim',[(.18,z),(.22,z+.02),(.21,z+.035),(.18,z+.045)],iron,lantern,8)
for i in range(8):
 a=i*math.tau/8;tube('Forged cage upright',[(.19*math.cos(a),.19*math.sin(a),.06),(.19*math.cos(a),.19*math.sin(a),.52)],.009,iron,lantern,6)
lathe('Pierced conical lantern crown',[(.215,.56),(.19,.595),(.07,.7),(.038,.73)],iron,lantern,8)
lathe('Tallow pillar',[(.045,.08),(.047,.31),(.037,.35),(.02,.343)],wax,lantern,20)
lathe('Lantern living wick',[(.01,.35),(.025,.385),(.013,.43),(0,.47)],flame,lantern,16)
for j in range(9):
 points=[]
 for i in range(17):
  a=i*math.tau/16;x=.026*math.cos(a);z=.765+j*.067+.044*math.sin(a)
  points.append((x if j%2 else 0,0 if j%2 else x,z))
 tube('Alternating forged chain link',points,.007,iron,lantern,5)

# Merge by material within each runtime state, keeping editable separated masters
# in the .blend. Export temporary copies so artists retain every original part.
(ROOT/'assets/blender').mkdir(parents=True,exist_ok=True);(ROOT/'public/models').mkdir(parents=True,exist_ok=True)
roots=[o for o in bpy.context.scene.objects if o.type=='EMPTY']
for root in roots:
 root.location.x={'crate':-1.55,'barrel':0,'urn':1.55,'altar':4,'lantern':6}[root.name.split('_')[0]]
 for child in root.children:
  child.hide_set(not root.name.endswith('_intact'))
  child.hide_render=not root.name.endswith('_intact')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/props.blend'))
for root in roots:
 root.location.x=0
 for child in root.children:child.hide_set(False);child.hide_render=False
for root in [o for o in bpy.context.scene.objects if o.type=='EMPTY']:
 mats={m for o in root.children if o.type=='MESH' for m in o.data.materials}
 for mat in mats:
  objects=[o for o in root.children if o.type=='MESH' and o.data.materials[0]==mat]
  if not objects:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=root.name+'_'+mat.name
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/props.glb'),export_format='GLB',export_yup=True,export_apply=True,use_selection=True)
print('PROPS_EXPORT_COMPLETE')
