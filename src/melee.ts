import { Vector3 } from "three";
import { moveCircle, traceShot, type Target, type Wall } from "./combat";
export const KICK = {
  duration: 0.42,
  contact: 0.13,
  cooldown: 0.52,
  range: 2.65,
  damage: 30,
  impulse: 13,
};
/** The visual strike peaks at the same instant as the damage check. */
export function kickExtension(time: number): number {
  const t = Math.max(0, time);
  const chamber = KICK.contact * 0.38;
  if (t < chamber) return 0.18 * (t / chamber);
  if (t < KICK.contact)
    return (
      0.18 + 0.82 * Math.pow((t - chamber) / (KICK.contact - chamber), 0.65)
    );
  return Math.pow(
    Math.max(0, 1 - (t - KICK.contact) / (KICK.duration - KICK.contact)),
    1.6,
  );
}
export function findKickTarget(
  origin: Vector3,
  direction: Vector3,
  walls: Wall[],
  targets: Target[],
): Target | null {
  let best: Target | null = null,
    nearest = Infinity;
  const flat = direction.clone().setY(0).normalize();
  for (const target of targets) {
    if (target.hp <= 0) continue;
    const delta = target.position.clone().sub(origin),
      distance = delta.clone().setY(0).length();
    if (
      distance > KICK.range + target.radius * 0.25 ||
      distance > nearest ||
      Math.abs(delta.y) > 1.5
    )
      continue;
    if (distance > 0.05 && delta.clone().setY(0).normalize().dot(flat) < 0.72)
      continue;
    if (traceShot(origin, target.position, walls, [])) continue;
    best = target;
    nearest = distance;
  }
  return best;
}
export function stepImpulse(
  position: Vector3,
  velocity: Vector3,
  dt: number,
  radius: number,
  walls: Wall[],
) {
  const start = position.clone(),
    speed = velocity.length();
  if (speed < 0.08) {
    velocity.set(0, 0, 0);
    return 0;
  }
  moveCircle(position, velocity.x * dt, velocity.z * dt, radius, walls);
  const intended = speed * dt,
    actual = position.distanceTo(start);
  const blocked = actual < intended * 0.55;
  velocity.multiplyScalar(blocked ? 0 : Math.exp(-3.1 * dt));
  return blocked ? speed : 0;
}
