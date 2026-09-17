import {expect,it} from 'vitest';
import * as T from 'three';
import {batchSpatial,LocalLightPool} from '../src/render-budget';

it('retains triangles, UVs and articulated children while splitting distant static surfaces',()=>{
 const root=new T.Group(),material=new T.MeshStandardMaterial();
 const animated=new T.Group();animated.add(new T.Mesh(new T.BoxGeometry(),material));root.add(animated);
 const panel=new T.Mesh(new T.BoxGeometry(),material);panel.userData.rigPart=true;root.add(panel);
 for(const z of [-50,0,50]){const m=new T.Mesh(new T.BoxGeometry(2,2,2),material);m.position.set(3,2,z);m.receiveShadow=true;root.add(m);}
 batchSpatial(root,12);
 expect(root.children).toContain(animated);
 expect(root.children).toContain(panel);
 const batches=root.children.filter(o=>o instanceof T.Mesh&&o!==panel) as T.Mesh[];
 expect(batches.reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0)).toBe(36);
 for(const m of batches){expect(m.material).toBe(material);expect(m.receiveShadow).toBe(true);expect(m.geometry.getAttribute('uv').count).toBe(m.geometry.getAttribute('position').count);expect(m.geometry.boundingBox!.max.z-m.geometry.boundingBox!.min.z).toBeLessThanOrEqual(2);}
 expect(Math.min(...batches.map(m=>m.geometry.boundingBox!.min.z))).toBe(-51);
 expect(Math.max(...batches.map(m=>m.geometry.boundingBox!.max.z))).toBe(51);
});

it('keeps a constant visible light count and follows the local authored light properties',()=>{
 const scene=new T.Scene(),sources=Array.from({length:10},(_,i)=>{const l=new T.PointLight(i%2?0xff0000:0xffffff,20+i,22,1.7);l.position.z=-i*12;scene.add(l);return l;});
 const pool=new LocalLightPool(scene,sources,4);
 pool.update(new T.Vector3(0,0,-108));
 expect(sources.every(l=>!l.visible)).toBe(true);
 expect(pool.lights.filter(l=>l.visible)).toHaveLength(4);
 expect(pool.lights.some(l=>l.position.z===-108 && l.intensity===29 && l.color.equals(sources[9].color))).toBe(true);
 const identities=[...pool.lights];
 pool.update(new T.Vector3());
 expect(pool.lights).toEqual(identities);
 expect(pool.lights.some(l=>l.position.z===0)).toBe(true);
 expect(pool.lights.every(l=>l.distance===22 && l.decay===1.7)).toBe(true);
});

it('preserves front faces when baking a mirrored ceiling transform',()=>{
 const root=new T.Group(),mesh=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshStandardMaterial());
 mesh.scale.x=-1;root.add(mesh);batchSpatial(root);
 for(const child of root.children){const geo=(child as T.Mesh).geometry,positions=geo.getAttribute('position'),normals=geo.getAttribute('normal');
  for(let i=0;i<positions.count;i+=3){const a=new T.Vector3().fromBufferAttribute(positions,i),b=new T.Vector3().fromBufferAttribute(positions,i+1),c=new T.Vector3().fromBufferAttribute(positions,i+2),normal=new T.Vector3().fromBufferAttribute(normals,i);expect(b.sub(a).cross(c.sub(a)).dot(normal)).toBeGreaterThan(0);}
 }
});
