import { it, expect } from "vitest";
import { Vector3 } from "three";
import { cultistMovement } from "../src/enemy-tactics";
const p = new Vector3(),
  target = (z: number) => new Vector3(0, 1.65, z);
it("armed cultist retreats at close range, approaches distant targets and strafes at firing range", () => {
  expect(cultistMovement(p, target(-2), 1, 0).z).toBeGreaterThan(0);
  expect(cultistMovement(p, target(-14), 1, 0).z).toBeLessThan(0);
  const strafe = cultistMovement(p, target(-7), 1, 0);
  expect(Math.abs(strafe.x)).toBeGreaterThan(0.5);
  expect(strafe.z).toBe(0);
  expect(cultistMovement(p, target(-7), 4.5, 0).x).toBeLessThan(0);
});
it("lane transitions and coincident positions do not cause a nonfinite direction", () => {
  expect(cultistMovement(p, p, 1, 0).length()).toBe(0);
  expect(cultistMovement(p, target(-7), 0.1, 0).length()).toBe(0);
});
