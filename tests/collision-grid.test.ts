import {expect,it} from 'vitest';
import {Vector3} from 'three';
import {moveCircle,traceShot,type Wall} from '../src/combat';
import {nearbyWalls} from '../src/collision-grid';

it('preserves swept collision and wall order at corners while excluding distant walls',()=>{
 const local:Wall[]=[{a:{x:-4,z:-1},b:{x:4,z:-1},height:6},{a:{x:1,z:-4},b:{x:1,z:4},height:6}];
 const walls=[...local,...Array.from({length:1000},(_,i)=>({a:{x:100+i,z:100},b:{x:100+i,z:105},height:6}))];
 for(const [dx,dz] of [[3,-3],[-3,-4],[.01,-.02],[20,-20]]){
  const a=new Vector3(0,1,0),b=a.clone();const candidates=nearbyWalls(walls,a,new Vector3(dx,1,dz),.8);
  expect(candidates).toEqual(local);moveCircle(a,dx,dz,.2,walls);moveCircle(b,dx,dz,.2,candidates);expect(a.distanceTo(b)).toBeLessThan(1e-8);
  expect(traceShot(new Vector3(0,1,0),new Vector3(dx,1,dz),walls,[])?.wall).toBe(traceShot(new Vector3(0,1,0),new Vector3(dx,1,dz),candidates,[])?.wall);
 }
});
it('keeps long walls and uses new dynamic snapshots after a gate opens',()=>{
 const wall:Wall={a:{x:-200,z:1},b:{x:200,z:1},height:6},gate:Wall={a:{x:0,z:0},b:{x:0,z:2},height:6};
 const far=Array.from({length:20},(_,i)=>({a:{x:400+i,z:400},b:{x:400+i,z:405},height:6}));
 const from=new Vector3(-1,1,1),to=new Vector3(1,1,1),closed=[wall,gate,...far],open=[wall,...far];
 expect(nearbyWalls(closed,from,to)).toEqual([wall,gate]);expect(nearbyWalls(open,from,to)).toEqual([wall]);
 expect(nearbyWalls(closed,from,to)).toBe(nearbyWalls(closed,from,to));
});
