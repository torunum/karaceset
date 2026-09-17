import { Vector3 } from "three";
import { BONE_LAUNCHER } from "./weapons";
export const CONFIG = {
  damage: BONE_LAUNCHER.damage,
  projectileSpeed: BONE_LAUNCHER.projectileSpeed,
  pinDistance: 3.6,
  pushSpeed: 10,
  fireInterval: BONE_LAUNCHER.fireInterval,
  playerSpeed: 6.3,
  playerRadius: 0.34,
  maxProjectiles: 40,
  maxRemains: 24,
  maxEffects: 80,
};
export interface Point {
  x: number;
  z: number;
}
export interface Wall {
  a: Point;
  b: Point;
  height: number;
  gate?: boolean;
}
export type EnemyState =
  "idle" | "chase" | "windup" | "hurt" | "dead" | "pinning" | "pinned";
export interface Target {
  position: Vector3;
  radius: number;
  torsoHitRadius?: number;
  hp: number;
  state: EnemyState;
  headOffset?: number;
  headRadius?: number;
  hitParts?: { name: BodyPart; center: Vector3; radius: number }[];
}
export type BodyPart =
  "torso" | "head" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
export interface Hit {
  kind: "enemy" | "wall";
  point: Vector3;
  distance: number;
  target?: Target;
  wall?: Wall;
  normal: Vector3;
  part?: BodyPart;
}
export function closestPoint(p: Point, w: Wall): Point {
  const dx = w.b.x - w.a.x,
    dz = w.b.z - w.a.z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - w.a.x) * dx + (p.z - w.a.z) * dz) / (dx * dx + dz * dz),
    ),
  );
  return { x: w.a.x + dx * t, z: w.a.z + dz * t };
}
export function wallHit(a: Vector3, b: Vector3, w: Wall): Hit | null {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    ex = w.b.x - w.a.x,
    ez = w.b.z - w.a.z,
    den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-8) return null;
  const qx = w.a.x - a.x,
    qz = w.a.z - a.z,
    t = (qx * ez - qz * ex) / den,
    u = (qx * dz - qz * dx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  const point = a.clone().lerp(b, t);
  if (point.y < 0 || point.y > w.height) return null;
  const normal = new Vector3(-ez, 0, ex).normalize();
  if (normal.dot(b.clone().sub(a)) > 0) normal.negate();
  return {
    kind: "wall",
    point,
    distance: point.distanceTo(a),
    wall: w,
    normal,
  };
}
export function traceShot(
  a: Vector3,
  b: Vector3,
  walls: Wall[],
  targets: Target[],
): Hit | null {
  let best: Hit | null = null;
  for (const w of walls) {
    const h = wallHit(a, b, w);
    if (h && (!best || h.distance < best.distance)) best = h;
  }
  const d = b.clone().sub(a),
    len = d.length();
  if (!len) return best;
  d.divideScalar(len);
  for (const t of targets) {
    if (t.hp <= 0) continue;
    const spheres = [
      {
        center: t.position,
        radius: t.torsoHitRadius ?? t.radius,
        name: "torso" as BodyPart,
      },
      ...(t.hitParts ?? []),
    ];
    if (t.headOffset !== undefined)
      spheres.push({
        center: t.position.clone().add(new Vector3(0, t.headOffset, 0)),
        radius: t.headRadius ?? 0.3,
        name: "head",
      });
    for (const sphere of spheres) {
      const offset = a.clone().sub(sphere.center);
      const along = offset.dot(d),
        c = offset.lengthSq() - sphere.radius * sphere.radius,
        disc = along * along - c;
      if (disc < 0) continue;
      let distance = -along - Math.sqrt(disc);
      if (c < 0) distance = 0;
      if (distance < 0 || distance > len || (best && distance >= best.distance))
        continue;
      const point = a.clone().addScaledVector(d, distance);
      best = {
        kind: "enemy",
        point,
        distance,
        target: t,
        normal: point.clone().sub(sphere.center).normalize(),
        part: sphere.name,
      };
    }
  }
  return best;
}
export function planPin(t: Target, direction: Vector3, walls: Wall[]) {
  const dir = direction.clone().normalize();
  if (Math.abs(dir.y) > 0.55) return null;
  const h = traceShot(
    t.position,
    t.position.clone().addScaledVector(dir, CONFIG.pinDistance),
    walls,
    [],
  );
  if (!h || h.kind !== "wall" || h.wall?.gate || -dir.dot(h.normal) < 0.55)
    return null;
  const clearance = t.radius + 0.12;
  const target = h.point
    .clone()
    .addScaledVector(dir, -clearance / -dir.dot(h.normal));
  target.y = t.position.y;
  if (target.clone().sub(t.position).dot(dir) < 0.05) return null;
  // Check the entire swept body, not just its centre; adjacent corners cannot be crossed.
  const distance = t.position.distanceTo(target);
  for (let s = 1; s <= Math.ceil(distance / 0.12); s++) {
    const p = t.position.clone().lerp(target, s / Math.ceil(distance / 0.12));
    for (const w of walls) {
      const q = closestPoint(p, w);
      if (Math.hypot(p.x - q.x, p.z - q.z) < t.radius + 0.025) return null;
    }
  }
  return { target, wallPoint: h.point, normal: h.normal };
}
export function damageEnemy(t: Target, amount: number) {
  if (t.hp <= 0) return;
  t.hp = Math.max(0, t.hp - amount);
  t.state = t.hp > 0 ? "hurt" : "dead";
}
export function canAttack(t: Target) {
  return t.hp > 0 && (t.state === "chase" || t.state === "windup");
}
export function moveCircle(
  position: Vector3,
  dx: number,
  dz: number,
  radius: number,
  walls: Wall[],
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (0.4 * radius)));
  for (let s = 0; s < steps; s++) {
    position.x += dx / steps;
    position.z += dz / steps;
    for (let iter = 0; iter < 3; iter++)
      for (const w of walls) {
        const q = closestPoint(position, w),
          x = position.x - q.x,
          z = position.z - q.z,
          d = Math.hypot(x, z);
        if (d < radius && d > 1e-8) {
          position.x += (x / d) * (radius - d);
          position.z += (z / d) * (radius - d);
        }
      }
  }
}
