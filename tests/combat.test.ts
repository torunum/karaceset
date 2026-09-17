import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import {
  traceShot,
  planPin,
  damageEnemy,
  canAttack,
  CONFIG,
  type Target,
  type Wall,
} from "../src/combat";
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const wall: Wall = { a: { x: -5, z: -5 }, b: { x: 5, z: -5 }, height: 6 };
const enemy = (z = -3): Target => ({
  position: v(0, 1.1, z),
  radius: 0.55,
  hp: 60,
  state: "idle",
});
describe("swept bone projectile", () => {
  it("hits an enemy even when one frame travels past it", () => {
    expect(traceShot(v(0, 1, 0), v(0, 1, -10), [wall], [enemy()])?.kind).toBe(
      "enemy",
    );
  });
  it("wall occludes targets behind it", () => {
    expect(traceShot(v(0, 1, 0), v(0, 1, -10), [wall], [enemy(-7)])?.kind).toBe(
      "wall",
    );
  });
  it("does not hit beyond the frame endpoint", () => {
    expect(traceShot(v(0, 1, 0), v(0, 1, -1), [wall], [enemy()])).toBeNull();
  });
  it("visible head can be hit above the torso sphere", () => {
    const e = { ...enemy(), headOffset: 0.56, headRadius: 0.3 };
    expect(traceShot(v(0, 1.8, 0), v(0, 1.8, -4), [], [e])?.kind).toBe("enemy");
  });
  it("pins lethal hits with body clearance", () => {
    const e = enemy();
    const pin = planPin(e, v(0, 0, -1), [wall]);
    expect(pin).not.toBeNull();
    expect(pin!.target.z).toBeGreaterThan(-5 + e.radius);
  });
  it("normal death in open space", () => {
    expect(planPin(enemy(), v(0, 0, -1), [])).toBeNull();
  });
  it("rejects glancing walls", () => {
    expect(planPin(enemy(), v(0.99, 0, -0.1).normalize(), [wall])).toBeNull();
  });
  it("nonlethal hits stagger; dead and pinned enemies cannot attack", () => {
    const e = enemy();
    e.hp = CONFIG.damage + 10;
    damageEnemy(e, CONFIG.damage);
    expect(e.state).toBe("hurt");
    expect(e.hp).toBe(10);
    damageEnemy(e, CONFIG.damage);
    expect(canAttack(e)).toBe(false);
    e.state = "pinned";
    expect(canAttack(e)).toBe(false);
  });
});
