import * as T from 'three';
import {muscleMap} from './art';

type Role='stone'|'floor'|'tissue'|'shrine'|'boneWall'|'intestine'|'ribWall';
type Maps=Partial<Record<Role,T.Texture>>;

/** Preserve geometry, collision, sidedness and the original material on failure. */
export function applyPaintedMaterial(material:T.MeshStandardMaterial,maps:Maps) {
 const role=material.userData.environmentRole as Role,map=maps[role];
 if(!map) return false;
 material.map=map;
 material.color.setHex(role==='intestine'?0xe3c6bc:role==='tissue'?0xcab6ab:0xddd5c8);
 material.emissive.setHex(0xffffff);
 material.emissiveMap=map;
 material.emissiveIntensity=role==='shrine'?.48:role==='stone'?.13:role==='floor'?.09:.08;
 material.bumpMap=role==='shrine'?null:map;
 material.bumpScale=role==='floor'?.018:.012;
 material.roughness=role==='intestine'?.62:role==='shrine'?.83:role==='tissue'?.76:.97;
 material.needsUpdate=true;
 return true;
}

export function applyEnvironmentToRoot(root:T.Object3D,maps:Maps,tissueSource=muscleMap) {
 const clones=new Map<T.Material,T.Material>();
 const convert=(m:T.Material)=>{
  if(clones.has(m))return clones.get(m)!;
  if(!(m instanceof T.MeshStandardMaterial))return m;
  const role=(m.userData.environmentRole ?? (m.map===tissueSource?'tissue':undefined)) as Role;
  if(!maps[role])return m;
  const clone=m.clone();clone.userData.environmentRole=role;
  applyPaintedMaterial(clone,maps);clones.set(m,clone);return clone;
 };
 root.traverse(o=>{if(o instanceof T.Mesh)o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});
 return clones.size;
}

/** Fixed wall-mounted art uses the normal depth buffer; these are decorative
 * reliefs within existing masonry, never stand-in collision obstacles. */
function chapelReliefs(root:T.Object3D,atlas:T.Texture) {
 if(root.getObjectByName('painted-chapel-reliefs')) return;
 const group=new T.Group();group.name='painted-chapel-reliefs';
 const materials=[0,1,2,3].map(frame=>{
  const map=atlas.clone();map.repeat.set(.5,.5);map.offset.set((frame%2)*.5,(1-Math.floor(frame/2))*.5);
  return new T.MeshStandardMaterial({map,alphaTest:.4,side:T.DoubleSide,
   emissiveMap:map,emissive:0xffffff,emissiveIntensity:.28,roughness:.95,
   polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 });
 const plane=new T.PlaneGeometry(1,1);
 const add=(frame:number,x:number,y:number,z:number,size:number,angle:number)=>{
  const m=new T.Mesh(plane,materials[frame]);m.name=`painted-relief-${frame}`;
  m.position.set(x,y,z);m.scale.set(size,size,1);m.rotation.y=angle;
  group.add(m);
 };
 for(const side of [-1,1]) {
  for(const [i,z] of [-5.4,-1.55,4.6].entries())
   add(i%2===0?0:2,side*5.92,2.47,z,2.3,side<0?Math.PI/2:-Math.PI/2);
  add(1,side*3.65,3.02,-9.72,3.0,0);
  add(3,side*2.3,2.38,-9.64,1.7,0);
 }
 root.add(group);
}

export async function loadEnvironmentArt(root:T.Object3D,chapel:boolean) {
 const files={stone:'painted-ashlar.png',floor:'painted-flagstone.png',boneWall:'painted-bone-wall.png',intestine:'painted-intestine.png',ribWall:'painted-rib-wall.png',
  tissue:'painted-tissue.png',shrine:'cult-shrine.png',reliefs:'cult-reliefs.png',heart:'../sprites/hanging-heart.png'};
 const loaded:Partial<Record<keyof typeof files,T.Texture>>={};
 await Promise.all(Object.entries(files).map(async([role,file])=>{
  if(!chapel&&(role==='shrine'||role==='reliefs')) return;
  if(chapel&&(role==='boneWall'||role==='heart'||role==='intestine'||role==='ribWall'))return;
  try{
   const map=await new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/${file}`);
   map.colorSpace=T.SRGBColorSpace;
   map.magFilter=T.NearestFilter;map.minFilter=T.LinearMipmapLinearFilter;
   map.generateMipmaps=true;map.anisotropy=4;
   if(role!=='shrine'&&role!=='reliefs'&&role!=='heart') map.wrapS=map.wrapT=T.RepeatWrapping;
   loaded[role as keyof typeof files]=map;
  }catch(error){console.warn(`Environment art ${file} unavailable; preserving surface`,error);}
 }));
 const count=applyEnvironmentToRoot(root,loaded);
 if(chapel&&loaded.reliefs)chapelReliefs(root,loaded.reliefs);
 if(!chapel&&loaded.heart){
  root.traverse(anchor=>{
   if(!anchor.name.startsWith('organic-gland-')||anchor.getObjectByName('illustrated-gland'))return;
   anchor.children.forEach(child=>child.visible=false);
   const gland=new T.Sprite(new T.SpriteMaterial({map:loaded.heart,alphaTest:.1,toneMapped:false,fog:true}));
   gland.name='illustrated-gland';gland.scale.set(.9,1.35,1);anchor.add(gland);
  });
  const anchor=root.getObjectByName('organic-heart-anchor');
  if(anchor&&!anchor.getObjectByName('illustrated-hanging-heart')){
   anchor.children.forEach(child=>child.visible=false);
   const heart=new T.Sprite(new T.SpriteMaterial({map:loaded.heart,alphaTest:.1,toneMapped:false,fog:true}));
   heart.name='illustrated-hanging-heart';heart.scale.set(2.2,3.3,1);
   anchor.position.y=4.1;anchor.add(heart);
  }
 }
 root.userData.environmentArt={surfaces:count,loaded:Object.keys(loaded)};
}
