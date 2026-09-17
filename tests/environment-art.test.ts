import {expect,it} from 'vitest';
import * as T from 'three';
import {applyPaintedMaterial,applyEnvironmentToRoot} from '../src/environment-art';
it('keeps existing material intact when its illustration is unavailable',()=>{
 const original=new T.Texture(),m=new T.MeshStandardMaterial({map:original});m.userData.environmentRole='stone';
 expect(applyPaintedMaterial(m,{})).toBe(false);expect(m.map).toBe(original);
});
it('uses separate floor and wall textures and preserves render side',()=>{
 const stone=new T.Texture(),floor=new T.Texture();
 for(const role of ['stone','floor'] as const){const m=new T.MeshStandardMaterial({side:T.DoubleSide});m.userData.environmentRole=role;
 expect(applyPaintedMaterial(m,{stone,floor})).toBe(true);expect(m.map).toBe(role==='stone'?stone:floor);expect(m.side).toBe(T.DoubleSide);}
});
it('lights shrine details from the illustration without bumping the painted relief',()=>{
 const shrine=new T.Texture(),m=new T.MeshStandardMaterial();m.userData.environmentRole='shrine';
 applyPaintedMaterial(m,{shrine});expect(m.emissiveMap).toBe(shrine);expect(m.bumpMap).toBeNull();expect(m.emissiveIntensity).toBeGreaterThan(.2);
});
it('isolates level surfaces from actor materials and preserves sharing within level',()=>{
 const source=new T.Texture(),replacement=new T.Texture(),shared=new T.MeshStandardMaterial({map:source});
 const root=new T.Group(),a=new T.Mesh(new T.BoxGeometry(),shared),b=new T.Mesh(new T.BoxGeometry(),[shared]);root.add(a,b);
 applyEnvironmentToRoot(root,{tissue:replacement},source);
 expect(shared.map).toBe(source);expect(shared.userData.environmentRole).toBeUndefined();
 expect(a.material).not.toBe(shared);expect(b.material[0]).toBe(a.material);expect(a.material.map).toBe(replacement);
});
