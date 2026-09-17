import { it, expect } from "vitest";
import { Vector3 } from "three";
import { Level, Navigator } from "../src/level";
import { moveCircle, traceShot } from "../src/combat";
import { ORGAN_ROUTE } from '../src/organic-layout';
it("all intended route centres are connected and navigable after the membrane opens", () => {
  const l = new Level();
  const route = ORGAN_ROUTE;
  for (const [x, z] of route)
    expect(l.contains(x, z, 0.5), `inside ${x},${z}`).toBe(true);
  const nav = new Navigator(l);
  l.gateOpen = true;
  nav.refresh(new Vector3(6, 1, -103));
  for (const [x, z] of route.slice(0, -1))
    expect(
      nav.direction(new Vector3(x, 1, z)).length(),
      `connected ${x},${z}`,
    ).toBeGreaterThan(0);
});
it("membrane blocks both movement and projectiles until opened", () => {
  const l = new Level(),
    p = new Vector3(6, 1, -64);
  moveCircle(p, 0, -5, 0.34, l.activeWalls());
  expect(p.z).toBeGreaterThan(-66);
  expect(
    traceShot(
      new Vector3(6, 1, -64),
      new Vector3(6, 1, -68),
      l.activeWalls(),
      [],
    )?.wall?.gate,
  ).toBe(true);
  l.gateOpen = true;
  moveCircle(p, 0, -5, 0.34, l.activeWalls());
  expect(p.z).toBeLessThan(-66);
});
it("high-speed movement cannot tunnel out of the test room", () => {
  const l = new Level(true),
    p = new Vector3(0, 1, 0);
  moveCircle(p, 30, 0, 0.34, l.walls);
  expect(l.contains(p.x, p.z, 0.33)).toBe(true);
});
