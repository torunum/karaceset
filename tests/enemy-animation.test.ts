import { describe, expect, it } from "vitest";
import * as T from "three";
import { createEnemy, animateEnemy } from "../src/enemy-art";
import { ENEMIES } from "../src/enemy-types";

describe("attack animation timing", () => {
  it.each([.8,1,1.25])("runner commits before contact at windup scale %s", (scale) => {
    const rig = createEnemy("runner");
    rig.root.userData.moving = false;
    const duration = ENEMIES.runner.windup*scale;
    rig.root.userData.windupDuration=duration;
    for (let t = 0; t <= duration - 0.09; t += 0.005)
      animateEnemy(rig, "windup", t, 0, "runner");
    expect(rig.arms[1].rotation.x).toBeGreaterThan(1.1);
    for (let t = duration - 0.085; t <= duration; t += 0.005)
      animateEnemy(rig, "windup", t, 0, "runner");
    expect(rig.arms[1].rotation.x).toBeLessThan(0.4);
  });
  it("a stagger interrupts the attack and visibly recoils within 50 ms", () => {
    const rig = createEnemy("runner");
    rig.root.userData.moving = false;
    animateEnemy(rig, "windup", 0, 0, "runner");
    animateEnemy(rig, "hurt", 0.1, 0, "runner");
    animateEnemy(rig, "hurt", 0.15, 0, "runner");
    expect(rig.root.userData.releaseTime).toBeUndefined();
    expect(rig.body.rotation.x).toBeGreaterThan(0.15);
  });
});

describe("cultist cloth and firearm contacts", () => {
  it("keeps the robe sewn at the waist with bounded independent hem movement", () => {
    const rig = createEnemy("cultist");
    const hem = rig.root.getObjectByName("cult-hem") as T.Mesh;
    const positions = hem.geometry.getAttribute("position");
    const original = new Float32Array(positions.array);
    let greatest = 0;
    let anchorDrift = 0;
    for (let frame = 0; frame < 180; frame++) {
      animateEnemy(rig, "chase", frame / 60, 0.3, "cultist");
      for (let i = 0; i < positions.count; i++) {
        const distance = Math.hypot(
          positions.getX(i) - original[i * 3],
          positions.getY(i) - original[i * 3 + 1],
          positions.getZ(i) - original[i * 3 + 2],
        );
        if (original[i * 3 + 1] >= 0.88)
          anchorDrift = Math.max(anchorDrift, distance);
        greatest = Math.max(greatest, distance);
      }
    }
    expect(greatest).toBeGreaterThan(0.03);
    expect(greatest).toBeLessThan(0.055);
    expect(anchorDrift).toBe(0);
    const frozen = Array.from(positions.array);
    animateEnemy(rig, "dead", 5, 0.3, "cultist");
    expect(Array.from(positions.array)).toEqual(frozen);
    expect(() => rig.root.clone(true)).not.toThrow();
  });
  it("aims forward with a support wrist touching the fore-end and respects severed arms", () => {
    const rig = createEnemy("cultist");
    for (let frame = 0; frame < 60; frame++)
      animateEnemy(rig, "windup", frame / 60, 0, "cultist");
    rig.root.updateMatrixWorld(true);
    const gun = rig.root.getObjectByName("cult-firearm")!;
    const muzzle = gun.getObjectByName("muzzle")!;
    const axis = new T.Vector3(0, 0, -1).applyQuaternion(
      muzzle.getWorldQuaternion(new T.Quaternion()),
    );
    expect(axis.dot(new T.Vector3(0, 0, -1))).toBeGreaterThan(0.995);
    const supportPoint = gun.localToWorld(new T.Vector3(0, 0.025, -0.19));
    const supportHand = rig.arms[0].getObjectByName("hand")!;
    expect(
      supportHand.getWorldPosition(new T.Vector3()).distanceTo(supportPoint),
    ).toBeLessThan(0.008);
    rig.arms[0].visible = false;
    const rotation = rig.arms[0].quaternion.clone();
    animateEnemy(rig, "chase", 1.1, 0, "cultist");
    expect(rig.arms[0].quaternion.equals(rotation)).toBe(true);
  });
});
