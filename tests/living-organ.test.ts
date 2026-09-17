import {it,expect} from 'vitest';
import {ventPhase,LivingOrgan} from '../src/living-organ';
import {Group,Vector3} from 'three';
import type {Level} from '../src/level';
import type {GoreSystem} from '../src/gore';
it('vents telegraph before bursting and rest between attacks',()=>{
 expect(ventPhase(0,0)).toBe('rest');expect(ventPhase(4.2,0)).toBe('warning');
 expect(ventPhase(5.8,0)).toBe('burst');expect(ventPhase(7,0)).toBe('rest');
});
it('does not damage players when the visible hazard art is unavailable',()=>{
 const living=new LivingOrgan({root:new Group(),lights:[]} as unknown as Level);
 expect(living.update(5.8,.1,new Vector3(25,1.65,-43),{spray(){}} as unknown as GoreSystem)).toBe(0);
});
