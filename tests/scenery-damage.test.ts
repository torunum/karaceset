import { describe, expect, it } from "vitest";
import { Box3 } from "three";
import { createScenery, updateBreakableDamage } from "../src/scenery";

describe("breakable damage presentation", () => {
  it("shows damage at half health, then settles without moving its collider", () => {
    const scenery = createScenery(true);
    for (const prop of scenery.props) {
      const position = prop.position.clone();
      expect(prop.damageVisual.visible).toBe(false);
      prop.hp /= 2;
      updateBreakableDamage(prop);
      expect(prop.damageVisual.visible).toBe(true);
      scenery.update(0.03, 0.03);
      expect(Math.abs(prop.root.rotation.z)).toBeGreaterThan(0);
      scenery.update(2, 2);
      expect(prop.root.rotation.z).toBe(0);
      expect(prop.position.equals(position)).toBe(true);
    }
  });
  it("keeps one grounded wreckage per prop after destruction and resets it", () => {
    const scenery = createScenery(true);
    for (const prop of scenery.props) {
      const pieces = prop.wreckage.children.length;
      expect(pieces).toBeGreaterThan(0);
      expect(prop.wreckage.parent).toBe(scenery.root);
      expect(prop.wreckage.visible).toBe(false);
      prop.hp = 0;
      prop.broken = true;
      updateBreakableDamage(prop);
      updateBreakableDamage(prop);
      scenery.update(10, 10);
      expect(prop.root.visible).toBe(false);
      expect(prop.wreckage.visible).toBe(true);
      expect(prop.wreckage.children.length).toBe(pieces);
      expect(
        new Box3().setFromObject(prop.wreckage).min.y,
      ).toBeGreaterThanOrEqual(0);
    }
    scenery.reset();
    for (const prop of scenery.props) {
      expect(prop.root.visible).toBe(true);
      expect(prop.damageVisual.visible).toBe(false);
      expect(prop.wreckage.visible).toBe(false);
      expect(prop.root.userData.damageWobble).toBe(0);
    }
  });
});
