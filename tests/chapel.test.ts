import { it, expect } from "vitest";
import { Vector3 } from "three";
import { Level } from "../src/level";
import { moveCircle, traceShot } from "../src/combat";
it("chapel actors and breakables fit and altar stops movement and low shots", () => {
  const l = new Level(true, true);
  expect(l.spawns).toHaveLength(4);
  expect(l.scenery.props).toHaveLength(3);
  for (const s of l.spawns) expect(l.contains(s.x, s.z, 0.5)).toBe(true);
  for (const p of l.scenery.props)
    expect(l.contains(p.position.x, p.position.z, p.radius)).toBe(true);
  const p = new Vector3(0, 1.65, -5.5);
  moveCircle(p, 0, -3, 0.34, l.activeWalls());
  expect(p.z).toBeGreaterThan(-6.73);
  expect(
    traceShot(
      new Vector3(0, 0.8, -5.5),
      new Vector3(0, 0.8, -9),
      l.activeWalls(),
      [],
    )?.kind,
  ).toBe("wall");
  expect(
    traceShot(
      new Vector3(0, 1.65, -5.5),
      new Vector3(0, 1.65, -9),
      l.activeWalls(),
      [],
    ),
  ).toBeNull();
});
