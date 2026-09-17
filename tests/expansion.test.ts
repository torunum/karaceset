import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { KICK, kickExtension, findKickTarget, stepImpulse } from "../src/melee";
import { traceShot, type Target, type Wall } from "../src/combat";
import { WEAPONS } from "../src/weapons";
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const target = (x: number, z: number): Target => ({
  position: v(x, 1, z),
  radius: 0.5,
  hp: 100,
  state: "chase",
});
describe("physical kick", () => {
  it("boot reaches full extension at damage contact and returns before cooldown", () => {
    expect(kickExtension(0)).toBe(0);
    expect(kickExtension(KICK.contact)).toBeCloseTo(1);
    expect(kickExtension(KICK.duration)).toBe(0);
    expect(KICK.contact).toBeLessThan(0.15);
    expect(KICK.duration).toBeLessThan(KICK.cooldown);
    const before = Array.from({ length: 21 }, (_, i) =>
      kickExtension((KICK.contact * i) / 20),
    );
    const after = Array.from({ length: 21 }, (_, i) =>
      kickExtension(KICK.contact + ((KICK.duration - KICK.contact) * i) / 20),
    );
    expect(before.every((x, i) => i === 0 || x >= before[i - 1])).toBe(true);
    expect(after.every((x, i) => i === 0 || x <= after[i - 1])).toBe(true);
  });
  it("selects closest target in front, not behind or outside reach", () => {
    const near = target(0, -1.3),
      far = target(0, -4),
      behind = target(0, 1);
    expect(
      findKickTarget(v(0, 1.65, 0), v(0, 0, -1), [], [far, behind, near]),
    ).toBe(near);
  });
  it("cannot kick through a wall", () => {
    const wall: Wall = {
      a: { x: -3, z: -0.5 },
      b: { x: 3, z: -0.5 },
      height: 5,
    };
    expect(
      findKickTarget(v(0, 1.65, 0), v(0, 0, -1), [wall], [target(0, -1.3)]),
    ).toBeNull();
  });
  it("knockback is swept and stops before wall even for large step", () => {
    const wall: Wall = { a: { x: -3, z: -2 }, b: { x: 3, z: -2 }, height: 5 };
    const p = v(0, 1, 0),
      velocity = v(0, 0, -14);
    const impact = stepImpulse(p, velocity, 0.3, 0.5, [wall]);
    expect(p.z).toBeGreaterThanOrEqual(-1.501);
    expect(impact).toBeGreaterThan(0);
    expect(velocity.length()).toBeLessThan(1);
  });
});
it("reports a limb hit independently of torso/head", () => {
  const t = {
    ...target(0, -2),
    hitParts: [
      { name: "leftArm" as const, center: v(-0.8, 1, -2), radius: 0.18 },
    ],
  };
  expect(traceShot(v(-0.8, 1, 0), v(-0.8, 1, -4), [], [t])?.part).toBe(
    "leftArm",
  );
});
it("three weapons have distinct damage, cadence and projectile patterns", () => {
  expect(Object.keys(WEAPONS)).toHaveLength(3);
  expect(WEAPONS.shotgun.pellets).toBeGreaterThan(1);
  expect(WEAPONS.acid.fireInterval).toBeLessThan(WEAPONS.femur.fireInterval);
  expect(WEAPONS.femur.canPin).toBe(true);
  expect(WEAPONS.shotgun.canPin).toBe(false);
});
