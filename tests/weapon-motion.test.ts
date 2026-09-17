import { it, expect } from "vitest";
import {
  createShotgun,
  createAcidWeapon,
  createFemurWeapon,
} from "../src/arsenal-art";
import { animateWeaponModel, crossedReloadCue } from "../src/weapon-motion";
import { WEAPONS, type WeaponId } from "../src/weapons";
it("reload cue fires once even when a frame crosses the opening cue", () => {
  for (const dt of [1 / 144, 1 / 60, 1 / 20, 0.3]) {
    let remaining = WEAPONS.shotgun.fireInterval;
    let cues = 0;
    while (remaining > 0) {
      const next = Math.max(0, remaining - dt);
      if (crossedReloadCue("shotgun", remaining, next)) cues++;
      remaining = next;
    }
    expect(cues).toBe(1);
  }
  expect(crossedReloadCue("shotgun", 0, 0)).toBe(false);
  expect(crossedReloadCue("femur", WEAPONS.femur.fireInterval, 0)).toBe(false);
});
it("shotgun opens, ejects, then closes; idle never ejects shells", () => {
  const g = createShotgun();
  g.mechanism.userData.restZ = g.mechanism.position.z;
  animateWeaponModel(g, "shotgun", 0, 0, 0);
  expect(g.root.userData.shells.every((s: any) => !s.visible)).toBe(true);
  animateWeaponModel(g, "shotgun", 1, 0.2, WEAPONS.shotgun.fireInterval * 0.55);
  expect(g.mechanism.rotation.x).toBeLessThan(-0.4);
  expect(g.root.userData.shells.some((s: any) => s.visible)).toBe(true);
  animateWeaponModel(g, "shotgun", 2, 0, 0);
  expect(g.mechanism.rotation.x).toBeCloseTo(0);
  expect(g.root.userData.shells.every((s: any) => !s.visible)).toBe(true);
});
it("all weapon cycles retain finite transforms and return mechanical positions to rest", () => {
  const guns = {
    femur: createFemurWeapon(),
    shotgun: createShotgun(),
    acid: createAcidWeapon(),
  };
  for (const id of Object.keys(guns) as WeaponId[]) {
    const g = guns[id];
    const rest = g.mechanism.position.z;
    g.mechanism.userData.restZ = rest;
    for (const phase of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      animateWeaponModel(
        g,
        id,
        phase,
        1 - phase,
        WEAPONS[id].fireInterval * (1 - phase),
      );
      g.root.updateMatrixWorld(true);
      g.root.traverse((o) =>
        expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true),
      );
    }
    expect(g.mechanism.position.z).toBe(rest);
  }
});
