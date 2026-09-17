import {expect,it} from 'vitest';
import * as T from 'three';
import {GoreSystem} from '../src/gore';

it('renders bounded blood drops and persistent stains with two shared batches',()=>{
 const scene=new T.Scene(),gore=new GoreSystem(scene);
 gore.spray(new T.Vector3(1,2,3),new T.Vector3(1,0,0),180);
 const drops=scene.getObjectByName('blood-drop-instances') as T.InstancedMesh;
 expect(drops).toBeInstanceOf(T.InstancedMesh);
 expect(gore.particles).toHaveLength(140);expect(drops.count).toBe(140);
 expect(gore.particles.every(p=>p.mesh.parent===null)).toBe(true);
 const matrix=new T.Matrix4();drops.getMatrixAt(0,matrix);expect(new T.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([1,2,3]);
 for(let i=0;i<60;i++)gore.stain(new T.Vector3(i,0,0),new T.Vector3(0,1,0));
 const stains=scene.getObjectByName('blood-stain-instances') as T.InstancedMesh;
 expect(stains.count).toBe(44);expect(gore.decals).toHaveLength(44);
 expect(scene.children.filter(o=>o instanceof T.Mesh)).toHaveLength(2);
 gore.update(2,[]);expect(drops.count).toBe(0);expect(gore.particles).toHaveLength(0);
 gore.reset();expect(stains.count).toBe(0);expect(gore.decals).toHaveLength(0);
});

it('keeps severed parts and debris as independent physical objects',()=>{
 const scene=new T.Scene(),gore=new GoreSystem(scene);
 const piece=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());piece.position.y=2;
 gore.add(piece,new T.Vector3(1,1,0),2,true,false);
 gore.update(.1,[]);expect(piece.parent).toBe(scene);expect(piece.position.x).toBeGreaterThan(0);
 gore.reset();expect(piece.parent).toBe(null);
});

it('sleeps floor debris without hiding it, while expiry and reset still work',()=>{
 const scene=new T.Scene(),gore=new GoreSystem(scene),piece=new T.Mesh(new T.BoxGeometry(.2,.2,.2),new T.MeshBasicMaterial());
 piece.position.set(0,.1,0);gore.add(piece,new T.Vector3(),12,true,false);
 for(let i=0;i<360;i++)gore.update(1/60,[]);
 expect(gore.particles[0].sleeping).toBe(true);expect(piece.parent).toBe(scene);expect(piece.visible).toBe(true);
 const resting=piece.position.clone(),life=gore.particles[0].life;
 gore.update(1,[]);expect(piece.position.equals(resting)).toBe(true);expect(gore.particles[0].life).toBeLessThan(life);
 gore.update(12,[]);expect(piece.parent).toBe(null);expect(gore.particles).toHaveLength(0);
});

it('installs painted alpha blood in the existing shared stain batch',()=>{
 const scene=new T.Scene(),gore=new GoreSystem(scene),map=new T.Texture();gore.setIllustratedBlood(map);
 gore.stain(new T.Vector3(),new T.Vector3(0,1,0));
 const batch=scene.getObjectByName('blood-stain-instances') as T.InstancedMesh;
 expect((batch.material as T.MeshStandardMaterial).map).toBe(map);expect(batch.geometry).toBeInstanceOf(T.PlaneGeometry);expect(batch.count).toBe(1);
 const geometry=batch.geometry;gore.setIllustratedBlood(map);expect(batch.geometry).toBe(geometry);
});
