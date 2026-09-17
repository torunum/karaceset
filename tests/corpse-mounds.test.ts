import {it,expect} from 'vitest';
import {Vector3} from 'three';
import {Level} from '../src/level';
import {moveCircle,traceShot} from '../src/combat';
it('large corpse piles stop walking and low shots but permit fire above their silhouette',()=>{
 const level=new Level(),start=new Vector3(1.5,.4,6.5),end=new Vector3(5.3,.4,6.5);
 expect(traceShot(start,end,level.activeWalls(),[])).not.toBeNull();
 expect(traceShot(start.clone().setY(1.65),end.clone().setY(1.65),level.activeWalls(),[])).toBeNull();
 const player=start.clone().setY(1.65);moveCircle(player,3.8,0,.34,level.activeWalls());expect(player.x).toBeLessThan(2.5);
 expect(level.root.getObjectByName('mound-fallback-0')?.visible).toBe(true);
});
