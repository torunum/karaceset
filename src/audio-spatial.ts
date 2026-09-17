import type { Vector3 } from "three";
import { traceShot, type Wall } from "./combat";
export type AudioChannel = "weapons" | "creatures" | "world";
export function audioChannel(event: string): AudioChannel {
  if (
    ["fire", "shotgun", "acid", "equip", "reload", "kickWhoosh"].includes(event)
  )
    return "weapons";
  if (["alert", "chant", "spit", "cultShot"].includes(event))
    return "creatures";
  return "world";
}
export function spatialSound(
  source: Vector3,
  listener: Vector3,
  yaw: number,
  walls: Wall[],
) {
  const dx = source.x - listener.x,
    dz = source.z - listener.z;
  return {
    distance: source.distanceTo(listener),
    pan: Math.sin(Math.atan2(dx, -dz) + yaw),
    occlusion: traceShot(source, listener, walls, []) ? 1 : 0,
  };
}
export function occludedMix(
  distance: number,
  occlusion: number,
  lowpass = 15000,
) {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const blocked = Number.isFinite(occlusion)
    ? Math.max(0, Math.min(1, occlusion))
    : 0;
  return {
    gain: (1 - blocked * 0.62) / (1 + d * 0.12),
    lowpass: Math.min(lowpass, 15000 - (15000 - 1050) * blocked),
  };
}
