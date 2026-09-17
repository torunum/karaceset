import { Vector3 } from "three";
/** Armed cultists preserve firing distance and change lateral lanes between shots. */
export function cultistMovement(
  position: Vector3,
  target: Vector3,
  time: number,
  phase: number,
): Vector3 {
  const toward = target.clone().sub(position).setY(0),
    distance = toward.length();
  if (distance < 0.001) return new Vector3();
  toward.divideScalar(distance);
  const side = Math.floor((time + phase) / 3.4) % 2 === 0 ? 1 : -1;
  const lateral = new Vector3(-toward.z, 0, toward.x).multiplyScalar(side);
  if (distance < 4.6)
    return toward.multiplyScalar(-1).addScaledVector(lateral, 0.3).normalize();
  if (distance > 10) return toward.addScaledVector(lateral, 0.18).normalize();
  // Small lateral movement leaves a stable aim window around each lane reversal.
  const lanePhase = (time + phase) % 3.4;
  return lateral.multiplyScalar(lanePhase < 0.35 ? 0 : 0.65);
}
