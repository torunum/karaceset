import * as T from 'three';
import {mats,oval} from './art';
import type {Level} from './level';
import {ORGAN_ROOMS,ORGAN_PATHS,organicWallRole} from './organic-layout';

/** Sculpture follows the navigable polygon boundary; low ceiling details remain
 * above the player. The occupied interior has no unregistered floor obstacles. */
export function decorateOrgan(level:Level) {
 const bone=mats.bone.clone();bone.userData.environmentRole='ribWall';
 const flesh=mats.flesh.clone();flesh.userData.environmentRole='intestine';
 const dark=mats.dark.clone();dark.userData.environmentRole='tissue';
 const arc=(points:T.Vector3[],radius:number,mat:T.Material,taper=false)=>{
  const curve=new T.CatmullRomCurve3(points),segments=32,radial=8;
  const geo=new T.TubeGeometry(curve,segments,radius,radial,false),pos=geo.getAttribute('position');
  for(let i=0;i<=segments;i++){
   const center=curve.getPointAt(i/segments),t=i/segments;
   const swell=(.75+.22*Math.sin(t*Math.PI)+.1*Math.sin(t*35))*(taper?1-.94*t:1);
   for(let j=0;j<=radial;j++){const k=i*(radial+1)+j;
    pos.setXYZ(k,center.x+(pos.getX(k)-center.x)*swell,center.y+(pos.getY(k)-center.y)*swell,center.z+(pos.getZ(k)-center.z)*swell);
   }
  }
  const uv=geo.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*curve.getLength()/2.6);
  geo.computeVertexNormals();const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;level.root.add(mesh);
 };
 const arch=(x:number,z:number,r:number,angle:number,bony:boolean)=>{
  const points=[];
  for(let i=0;i<=20;i++){
   const t=i/20*Math.PI,side=Math.cos(t)*r;
   points.push(new T.Vector3(x+side*Math.cos(angle),.1+Math.sin(t)*5.25,z+side*Math.sin(angle)));
  }
  arc(points,bony?.27:.42,bony?bone:flesh);
 };
 // Transverse muscular folds create actual curved intestinal tunnel profiles.
 for(const [pathIndex,path] of ORGAN_PATHS.entries())for(let j=1;j<path.points.length;j++){
  const a=path.points[j-1],b=path.points[j],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const count=Math.ceil(length/2.1),angle=Math.atan2(-dx,dz);
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t;
   arch(x,z,path.width+.24,angle,pathIndex===4||pathIndex===6||organicWallRole(x,z)==='ribWall');
  }
 }
 // Room ribs fan around the chamber perimeter, leaving its fighting floor open.
 for(const [index,[x,z,rx,rz]] of ORGAN_ROOMS.entries()){
  // Account for the inward curve at standing eye height, including tube thickness.
  const eyeHeightSpan=Math.sqrt(1-Math.pow((1.9-.1)/5.25,2));
  for(const offset of [-.46,0,.46]){
   // The west secret doorway cuts through the central rib in these rooms.
   if((offset===0&&(index===0||index===2||index===3))||(index===7&&offset<=0))continue;
   arch(x,z+offset*rz,(rx*Math.sqrt(1-offset*offset)+.35)/eyeHeightSpan,0,true);
  }
  for(let j=0;j<9;j++){
   const a=j/9*Math.PI*2,px=x+Math.cos(a)*rx*.72,pz=z+Math.sin(a)*rz*.72;
   const length=1.35+(j%3)*.45;
   arc([new T.Vector3(px,5.78,pz),new T.Vector3(px+.12,5.0,pz+.09),new T.Vector3(px+.06,5.78-length,pz)],.28,j%3!==0?bone:flesh,true);
  }
  const gland=new T.Group();gland.position.set(x,4.35,z);
  gland.name=`organic-gland-${index}`;
  if(index===5)gland.name='organic-heart-anchor';
  oval(gland,dark,[0,0,0],[index===5?1.35:.5,index===5?1.1:.55,.5]);
  const glow=new T.MeshStandardMaterial({color:0x8c351d,emissive:0xe76e25,emissiveIntensity:.9,roughness:.55});
  oval(gland,glow,[0,-.23,.35],[index===5?.62:.18,.22,.12]);
  level.root.add(gland);level.breathers.push(gland);
  const light=new T.PointLight(index===3?0xb4bc77:0xd9a176,28,23,1.7);light.position.set(x,3.35,z);
  level.root.add(light);level.lights.push(light);
 }
 // A restrained pair of warm glands lights the long first passage.
 for(const [x,z] of [[-2,-10],[0,-22]]){
  const light=new T.PointLight(0xda9570,18,17,1.8);light.position.set(x,3.8,z);level.root.add(light);level.lights.push(light);
 }
 level.root.userData.organicChapter='The Hollow Organ';
}
