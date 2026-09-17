import { describe, expect, it } from 'vitest';
import { weaponSpriteFrame } from '../src/weapon-sprites';
import { WEAPONS, type WeaponId } from '../src/weapons';

describe('illustrated weapon timing', () => {
  it('shows rest after cooldown and on invalid clocks', () => {
    for (const id of ['shotgun','femur','acid'] as WeaponId[])
      for (const remaining of [0,-1,NaN,Infinity])
        expect(weaponSpriteFrame(id,remaining)).toBe(0);
  });
  it('fires immediately, opens before loading, closes before ready', () => {
    const frame=(phase:number)=>weaponSpriteFrame('shotgun',.76*(1-phase));
    expect([0,.1,.25,.4,.6,.8,.95].map(frame)).toEqual([1,2,3,4,5,6,7]);
  });
  it('keeps rapid acid discharge readable instead of cycling eight tiny frames', () => {
    const frames=new Set<number>();
    for(let t=0;t<.17;t+=1/60)frames.add(weaponSpriteFrame('acid',.17-t));
    expect([...frames]).toEqual([1,2,4,6]);
  });
  it('restarts every weapon on a new shot', () => {
    for (const id of ['shotgun','femur','acid'] as WeaponId[]) {
      expect(weaponSpriteFrame(id,WEAPONS[id].fireInterval)).toBe(1);
      expect(weaponSpriteFrame(id,WEAPONS[id].fireInterval*2)).toBe(1);
    }
  });
});
