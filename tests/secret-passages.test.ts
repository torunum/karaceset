import {it,expect} from 'vitest';
import {Vector3} from 'three';
import {Level} from '../src/level';
import {traceShot,moveCircle} from '../src/combat';
import {SECRET_PASSAGES} from '../src/chapter-state';
it('secret doors block bullets and walking, then reveal real navigable reward chambers',()=>{
 const level=new Level();
 for(const s of SECRET_PASSAGES){
  const direction=Math.sign(s.rewardX-s.x),start=new Vector3(s.x-direction,1.65,s.z),end=new Vector3(s.rewardX,1.65,s.z);
  expect(level.contains(end.x,end.z,.34,false)).toBe(true);
  expect(traceShot(start,end,level.activeWalls(),[])?.wall?.gate).toBe(true);
  const blocked=start.clone();moveCircle(blocked,direction*1.6,0,.34,level.activeWalls());expect((blocked.x-s.x)*direction).toBeLessThan(0);
  level.secretOpen.add(s.id);
  expect(traceShot(start,end,level.activeWalls(),[])).toBeNull();
  const entered=start.clone();moveCircle(entered,direction*1.6,0,.34,level.activeWalls());expect((entered.x-s.x)*direction).toBeGreaterThan(0);
 }
});
