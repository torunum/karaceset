import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { CombatVfxArt, COMBAT_VFX_RECTS, COMBAT_VFX_SIZE } from '../src/combat-vfx-art';

describe('illustrated combat effects', () => {
  it('keeps fallbacks before load and shares materials between instances', () => {
    const art = new CombatVfxArt();
    expect(art.createProjectile()).toBeNull();
    expect(art.createImpact()).toBeNull();
    expect(art.createBloodImpact()).toBeNull();
    art.install(new T.Texture());
    const a = art.createProjectile()!.children[0] as T.Sprite;
    const b = art.createProjectile()!.children[0] as T.Sprite;
    expect(a.material).toBe(b.material);
    expect(a.scale.y / a.scale.x).toBeCloseTo(275 / 570);
    expect(art.createImpact()!.material).toBe(art.createImpact()!.material);
    expect(art.createBloodImpact()!.material).toBe(art.createBloodImpact()!.material);
    expect(art.createBloodImpact()!.material.map).toBe(art.bloodMap);
    const disposed = vi.spyOn(a.material, 'dispose');
    art.dispose(); art.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(art.bloodMap).toBeUndefined();
  });

  it('keeps the blood crop square for existing circular decal UVs', () => {
    const art = new CombatVfxArt(); art.install(new T.Texture());
    expect(art.bloodMap!.repeat.x).toBeCloseTo(1 / 3);
    expect(art.bloodMap!.repeat.y).toBe(1);
    expect(art.bloodMap!.offset.toArray()).toEqual([0,0]);
    for (const [x,y,w,h] of Object.values(COMBAT_VFX_RECTS)) {
      expect(x+w).toBeLessThanOrEqual(COMBAT_VFX_SIZE[0]);
      expect(y+h).toBeLessThanOrEqual(COMBAT_VFX_SIZE[1]);
    }
    art.dispose();
  });
});
