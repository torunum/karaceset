import * as T from 'three';
import {ORGAN_ROOMS,CORPSE_MOUNDS} from './organic-layout';
import type {Level} from './level';
import type {GoreSystem} from './gore';

export const BILE_VENTS=[{x:25,z:-43,radius:1.15},{x:1,z:-87,radius:1.25}];
export function ventPhase(time:number,index:number){const t=(time+index*2)%7;return t<4?'rest':t<5.5?'warning':'burst';}
/** Fixed wall art and floor remains. Only soft hanging tissues sway, never collision walls. */
export class LivingOrgan {
 root=new T.Group();ready=false;
 private soft:T.Mesh[]=[];
 private vents:T.Mesh[]=[];
 private dripClock=0;private hurtClock=0;
 constructor(private level:Level){this.root.name='living-organ-details';level.root.add(this.root);}
 async load(){
  const [atlas,moundMap]=await Promise.all([
   new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}sprites/living-organ.png`),
   new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}sprites/corpse-mound.png`).catch(()=>null),
  ]);
  if(moundMap){
   moundMap.colorSpace=T.SRGBColorSpace;moundMap.magFilter=T.NearestFilter;moundMap.minFilter=T.LinearMipmapLinearFilter;
   moundMap.repeat.set(1515/1536,609/1024);moundMap.offset.set(11/1536,1-807/1024);
   const material=new T.SpriteMaterial({map:moundMap,alphaTest:.4,transparent:false,toneMapped:false,fog:true});
   for(const [i,mound] of CORPSE_MOUNDS.entries()){
    const sprite=new T.Sprite(material),height=mound.width*609/1515;
    sprite.name='illustrated-corpse-mound';sprite.scale.set(mound.width,height,1);sprite.position.set(mound.x,height*.5,mound.z);this.root.add(sprite);
    const fallback=this.level.root.getObjectByName(`mound-fallback-${i}`);if(fallback)fallback.visible=false;
   }
  }
  atlas.colorSpace=T.SRGBColorSpace;atlas.magFilter=T.NearestFilter;atlas.minFilter=T.LinearMipmapLinearFilter;
  const materials=[0,1,2,3].map(i=>{
   const map=atlas.clone(),top=i<2?0:650,height=i<2?650:604;
   map.repeat.set(.5,height/1254);map.offset.set((i%2)*.5,1-(top+height)/1254);map.needsUpdate=true;
   return new T.MeshBasicMaterial({map,alphaTest:.4,side:T.DoubleSide,toneMapped:false,fog:true});
  });
  const geometry=new T.PlaneGeometry(1,1);
  const add=(cell:number,x:number,y:number,z:number,w:number,h:number,yaw:number,soft=false)=>{
   const mesh=new T.Mesh(geometry,materials[cell]);mesh.name=`organic-detail-${cell}`;
   mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.scale.set(w,h,1);mesh.userData.baseY=y;mesh.userData.baseHeight=h;
   this.root.add(mesh);if(soft)this.soft.push(mesh);return mesh;
  };
  // Eight rooms receive wall remains, nests and low gore. Keep the central combat lanes free.
  for(const [i,[x,z,rx,rz]] of ORGAN_ROOMS.entries()){
   for(const side of [-1,1]){
    add(1,x+side*rx*.84,1.55,z+(((i===0||i===2||i===7)&&side===-1)||(i===3&&side===1)?2.8:0),2.1,3.1,-side*Math.PI/2);
    add(2,x+side*rx*.6,.57,z-rz*.52,1.7,1.15,side*.6,true);
    const floor=add(3,x+side*rx*.56,.055,z+rz*.35,2.4,1.8,0);
    floor.rotation.set(-Math.PI/2,0,i*.7+side);
   }
  }
  for(const [x,z,yaw,w] of [[-2,-10,-.35,4.8],[1,-22,-.28,4.5],[-14,-33,1.1,4.2],[23,-35,-.4,4.5],[6,-69,0,4.7],[6,-93,0,5]])add(0,x,4.2,z,w,2.7,yaw,true);
  for(const vent of BILE_VENTS){const mesh=add(2,vent.x,.62,vent.z,2,1.3,0,true);this.vents.push(mesh);}
  this.ready=true;this.root.userData.detailCount=this.root.children.length;
 }
 reset(){this.dripClock=this.hurtClock=0;}
 update(time:number,dt:number,position:T.Vector3,gore:GoreSystem){
  if(!this.ready)return 0;
  for(const [i,mesh] of this.soft.entries()){
   mesh.scale.y=mesh.userData.baseHeight*(1+Math.sin(time*1.8+i)*.032);
   mesh.rotation.z=Math.sin(time*.8+i)*.018;
  }
  // Authored lights pulse without adding another light or shader variant.
  this.level.lights.forEach((light,i)=>{light.userData.baseIntensity??=light.intensity;light.intensity=light.userData.baseIntensity*(1+.075*Math.sin(time*2.1+i*.7));});
  this.dripClock-=dt;this.hurtClock-=dt;
  if(this.dripClock<=0){
   this.dripClock=1.7;
   const nearby=this.soft.find(m=>m.userData.baseY>3&&m.position.distanceToSquared(position)<100);
   if(nearby)gore.spray(nearby.position,new T.Vector3(0,-1,0),2);
  }
  let damage=0;
  for(const [i,vent] of BILE_VENTS.entries()){
   const phase=ventPhase(time,i),mesh=this.vents[i];
   if(mesh)mesh.scale.x=2*(phase==='warning'?1+.1*Math.sin(time*18):phase==='burst'?1.15:1);
   if(phase==='burst'&&Math.hypot(position.x-vent.x,position.z-vent.z)<vent.radius&&this.hurtClock<=0){damage=7;this.hurtClock=.7;gore.spray(new T.Vector3(vent.x,.65,vent.z),new T.Vector3(0,1,0),6);}
  }
  return damage;
 }
}
