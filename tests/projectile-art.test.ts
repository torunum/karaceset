import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { OrganicItemArt, ORGANIC_ITEM_RECTS, type OrganicItemKind } from '../src/projectile-art';

describe('illustrated projectile and organic items', () => {
  it('preserves forward projectile orientation and uses shared resources between shots', () => {
    const art = new OrganicItemArt();
    expect(art.createFemur()).toBeNull();
    art.install(new T.Texture());
    const first = art.createFemur()!, second = art.createFemur()!;
    for (const child of first.children) {
      expect(child.userData.organicItem).toBe('femur');
      const tip = new T.Vector3(1, 0, 0).applyQuaternion(child.quaternion);
      expect(tip.distanceTo(new T.Vector3(0, 0, -1))).toBeLessThan(.00001);
    }
    const a = first.children[0] as T.Mesh, b = second.children[0] as T.Mesh;
    expect(a.geometry).toBe(b.geometry);
    expect(a.material).toBe(b.material);
    const normals = first.children.map(child => new T.Vector3(0, 0, 1).applyQuaternion(child.quaternion));
    expect(Math.abs(normals[0].dot(normals[1]))).toBeLessThan(.00001);
    art.dispose();
    expect(art.createFemur()).toBeNull();
  });

  it('crops each item without aliasing atlas cells and disposes shared material once', () => {
    const art = new OrganicItemArt(); art.install(new T.Texture());
    for (const kind of Object.keys(ORGANIC_ITEM_RECTS) as OrganicItemKind[]) {
      const item = art.create(kind, 2)!;
      const [x, y, w, h] = ORGANIC_ITEM_RECTS[kind];
      expect(item.material.map!.offset.x).toBeCloseTo(x / 1536);
      expect(item.material.map!.offset.y).toBeCloseTo(1 - (y + h) / 1024);
      expect(item.scale.y).toBeCloseTo(2 * h / w);
      expect(x + w).toBeLessThanOrEqual(1536);
      expect(y + h).toBeLessThanOrEqual(1024);
    }
    const material = art.create('wrath')!.material;
    const dispose = vi.spyOn(material, 'dispose');
    art.dispose(); art.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
