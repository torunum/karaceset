import { describe, expect, it } from 'vitest';
import { organPickups, organSpawns, CORPSE_MOUNDS } from '../src/organic-layout';
import { Level } from '../src/level';
import { campaignRoster, CAMPAIGN_HARD_EXTRAS } from '../src/campaign-balance';
import { campaignAmmoAudit, campaignEnemyHp, campaignPickupGrant, campaignSpawns, campaignWindup, CAMPAIGN_START_AMMO, CAMPAIGN_START_WEAPONS } from '../src/campaign-balance';

describe('organic campaign combat economy', () => {
  it('starts with one weapon and places weapon introductions before their encounters', () => {
    expect(CAMPAIGN_START_WEAPONS).toEqual(['femur']);
    expect(CAMPAIGN_START_AMMO).toEqual({femur:10,shotgun:0,acid:0});
    expect(campaignPickupGrant(1)).toEqual({weapon:'shotgun',amount:3,unlock:true});
    expect(organPickups()[1].z).toBeGreaterThan(-29);
    expect(campaignPickupGrant(4)?.weapon).toBe('acid');
    expect(organPickups()[4].x).toBeLessThan(-10);
    organPickups().forEach((pickup,i) => expect(Boolean(campaignPickupGrant(i))).toBe(pickup.kind==='ammo'));
  });
  it('budgets normal ammo against actual authored enemy HP without relying on secrets', () => {
    const audit=campaignAmmoAudit(organSpawns());
    expect(audit.enemyHp).toBe(2600);
    expect(audit.ammo).toEqual({femur:18,shotgun:8,acid:10});
    expect(audit.potentialDamage).toBe(3056);
    expect(audit.ratio).toBeGreaterThanOrEqual(1.1);
    expect(audit.ratio).toBeLessThanOrEqual(1.3);
    expect(campaignAmmoAudit(organSpawns(),'normal',true).potentialDamage).toBe(3251);
  });
  it('changes count and reaction timing without mutating actors or changing HP', () => {
    const base=Array.from({length:30},(_,i)=>({id:i}));
    const extras=Array.from({length:9},(_,i)=>({id:i+30}));
    expect(campaignSpawns(base,extras,'easy')).toHaveLength(18);
    expect(campaignSpawns(base,extras,'normal')).toEqual(base);
    const hard=campaignSpawns(base,extras,'hard');
    expect(hard).toHaveLength(39);
    expect(new Set(hard.map(x=>x.id)).size).toBe(39);
    expect(()=>campaignSpawns(base,[],'hard')).toThrow('authored');
    expect(campaignEnemyHp('cultist')).toBe(70);
    expect(campaignEnemyHp('shambler')).toBe(95);
    expect(campaignWindup('cultist','easy')).toBeGreaterThan(campaignWindup('cultist','normal'));
    expect(campaignWindup('cultist','hard')).toBeLessThan(campaignWindup('cultist','normal'));
  });
  it('scales the total small-bundle economy instead of rounding every pickup upward', () => {
    expect(campaignAmmoAudit(organSpawns(),'easy').ammo).toEqual({femur:21,shotgun:11,acid:14});
    expect(campaignAmmoAudit(organSpawns(),'hard').ammo).toEqual({femur:17,shotgun:7,acid:9});
    for(const difficulty of ['easy','normal','hard'] as const)
      for(const index of [1,4]) expect(campaignPickupGrant(index,difficulty)!.amount).toBeGreaterThan(0);
  });
  it('keeps the easy opening and validates authored hard positions against walls and props', () => {
    const base=organSpawns(), easy=campaignRoster(base,'easy');
    expect(easy).toHaveLength(18);
    expect(easy.filter(x=>x.zone===0)).toEqual(base.filter(x=>x.zone===0));
    for(const zone of [1,2,3]) expect(new Set(easy.filter(x=>x.zone===zone).map(x=>x.kind)).size).toBe(2);
    const level=new Level();
    for(const spawn of CAMPAIGN_HARD_EXTRAS) {
      expect(level.contains(spawn.x,spawn.z,.65),`${spawn.x},${spawn.z}`).toBe(true);
      for(const prop of level.scenery.props) expect(Math.hypot(spawn.x-prop.position.x,spawn.z-prop.position.z)).toBeGreaterThan(prop.radius+.46);
      for(const mound of CORPSE_MOUNDS) expect(Math.hypot(spawn.x-mound.x,spawn.z-mound.z)).toBeGreaterThan(mound.radius+.46);
      for(const other of base) expect(Math.hypot(spawn.x-other.x,spawn.z-other.z)).toBeGreaterThan(.92);
    }
    expect(campaignRoster(base,'hard')).toHaveLength(39);
  });
});
