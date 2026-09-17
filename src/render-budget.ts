import * as T from 'three';

/** Keep static art batched locally. A chapter-wide mesh defeats frustum culling:
 * a visible entrance submits every distant rib, wall and ceiling triangle. */
export function batchSpatial(parent:T.Object3D,cellSize=24) {
 type Bucket={material:T.Material;attributes:Map<string,{size:number;values:number[]}>;cast:boolean;receive:boolean;layers:number};
 const buckets=new Map<string,Bucket>();
 for(const child of [...parent.children]) {
  if(!(child instanceof T.Mesh)||Array.isArray(child.material)||child.children.length||!child.visible||child.userData.rigPart)continue;
  child.updateMatrix();
  const mirrored=child.matrix.determinant()<0;
  const transformed=child.geometry.clone().applyMatrix4(child.matrix);
  const geo=transformed.index?transformed.toNonIndexed():transformed;
  const position=geo.getAttribute('position');
  const names=Object.keys(geo.attributes).sort();
  for(let i=0;i<position.count;i+=3){
   const x=(position.getX(i)+position.getX(i+1)+position.getX(i+2))/3;
   const z=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3;
   const key=[child.material.uuid,Math.floor(x/cellSize),Math.floor(z/cellSize),child.castShadow,child.receiveShadow,child.layers.mask,names.join(',')].join(':');
   let bucket=buckets.get(key);
   if(!bucket){bucket={material:child.material,attributes:new Map(names.map(name=>[name,{size:geo.getAttribute(name).itemSize,values:[]}])),cast:child.castShadow,receive:child.receiveShadow,layers:child.layers.mask};buckets.set(key,bucket);}
   for(const [name,target] of bucket.attributes){const source=geo.getAttribute(name);for(const vertex of mirrored?[i,i+2,i+1]:[i,i+1,i+2])for(let component=0;component<target.size;component++)target.values.push(source.getComponent(vertex,component));}
  }
  geo.dispose();if(geo!==transformed)transformed.dispose();
  parent.remove(child);
 }
 for(const bucket of buckets.values()){
  const geo=new T.BufferGeometry();
  for(const [name,attribute] of bucket.attributes)geo.setAttribute(name,new T.Float32BufferAttribute(attribute.values,attribute.size));
  geo.computeBoundingBox();geo.computeBoundingSphere();
  const mesh=new T.Mesh(geo,bucket.material);mesh.name='static-spatial-batch';mesh.castShadow=bucket.cast;mesh.receiveShadow=bucket.receive;mesh.layers.mask=bucket.layers;parent.add(mesh);
 }
}

/** A constant shader light count avoids recompilation as rooms change. Original
 * lights stay as animated authoring anchors; only the nearest four illuminate. */
export class LocalLightPool {
 readonly lights:T.PointLight[];
 private candidates:{source:T.PointLight;position:T.Vector3;distance:number}[];
 constructor(parent:T.Object3D,sources:T.PointLight[],count=4){
  this.candidates=sources.map(source=>{source.visible=false;return{source,position:new T.Vector3(),distance:0};});
  this.lights=Array.from({length:Math.min(count,sources.length)},()=>{const light=new T.PointLight(0xffffff,0);light.name='local-light-pool';parent.add(light);return light;});
 }
 update(position:T.Vector3){
  for(const candidate of this.candidates){candidate.source.getWorldPosition(candidate.position);candidate.distance=candidate.position.distanceToSquared(position);}
  this.candidates.sort((a,b)=>a.distance-b.distance);
  for(let i=0;i<this.lights.length;i++){const light=this.lights[i],{source,position:world}=this.candidates[i];light.position.copy(world);light.color.copy(source.color);light.intensity=source.intensity;light.distance=source.distance;light.decay=source.decay;}
 }
}
