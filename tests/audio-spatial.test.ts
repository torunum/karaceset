import { it, expect } from "vitest";
import { Vector3 } from "three";
import { spatialSound, occludedMix, audioChannel } from "../src/audio-spatial";
const wall = { a: { x: -3, z: -2 }, b: { x: 3, z: -2 }, height: 5 };
it("a wall muffles sound and opening that wall restores direct sound", () => {
  const source = new Vector3(0, 1, -4),
    listener = new Vector3(0, 1, 0);
  const blocked = spatialSound(source, listener, 0, [wall]),
    open = spatialSound(source, listener, 0, []);
  expect(blocked.occlusion).toBe(1);
  expect(open.occlusion).toBe(0);
  expect(occludedMix(4, blocked.occlusion).gain).toBeLessThan(
    occludedMix(4, open.occlusion).gain * 0.5,
  );
  expect(occludedMix(4, 1).lowpass).toBe(1050);
});
it("pan follows listener rotation and channel selection separates creature and player weapons", () => {
  const p = new Vector3(3, 1, 0),
    listener = new Vector3(0, 1, 0);
  expect(spatialSound(p, listener, 0, []).pan).toBeCloseTo(1);
  expect(spatialSound(p, listener, Math.PI, []).pan).toBeCloseTo(-1);
  expect(audioChannel("shotgun")).toBe("weapons");
  expect(audioChannel("cultShot")).toBe("creatures");
  expect(audioChannel("woodBreak")).toBe("world");
  expect(occludedMix(NaN, Infinity).gain).toBe(1);
});
