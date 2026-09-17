import type { EnemyState } from "./combat";

export const ENEMY_SPRITE_FRAMES = {
  idle: 0,
  walkLeft: 1,
  walkCenter: 2,
  walkRight: 3,
  aim: 4,
  fire: 5,
  hurt: 6,
  death: 7,
} as const;

export type EnemySpriteFrame =
  (typeof ENEMY_SPRITE_FRAMES)[keyof typeof ENEMY_SPRITE_FRAMES];

export type EnemySpriteDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Eight views around an actor facing local -Z. Equal actor/camera bearings show
 * the front; decreasing camera bearing walks toward the image-right profile.
 * Normalize the inputs separately so even opposite extreme finite angles cannot
 * overflow their difference. Invalid orientation falls back to the front view. */
export function enemySpriteDirection(
  actorYaw: number,
  cameraBearing: number,
): EnemySpriteDirection {
  if (!Number.isFinite(actorYaw) || !Number.isFinite(cameraBearing)) return 0;
  const turn = Math.PI * 2;
  const relative = (cameraBearing % turn) - (actorYaw % turn);
  const sector = Math.round(-relative / (Math.PI / 4));
  return (((sector % 8) + 8) % 8) as EnemySpriteDirection;
}

export const ENEMY_SPRITE_MOTION = {
  walkFramesPerSecond: 10,
  fireDuration: 0.1,
} as const;

export interface EnemySpritePose {
  state: EnemyState;
  moving: boolean;
  /** Gameplay clock, in seconds. */
  time: number;
  /** Entry time of the current state, using the same clock. */
  enteredAt: number;
  /** Actual weapon release time. Omit for cancelled/interrupted windups.
   * A state transition by itself is not evidence that a projectile was fired. */
  firedAt?: number;
}

const WALK: readonly EnemySpriteFrame[] = [1, 2, 3, 2];
const BOUNDARY_EPSILON = 1e-9;

/** The executioner's original three strides are side views, not forward poses.
 * Its supplemental 2x2 atlas has a complete forward contact/pass/contact/pass cycle. */
export function executionerWalkCell(pose: EnemySpritePose): number | null {
  if (pose.state !== "chase" || !pose.moving) return null;
  const elapsed = Math.max(0, pose.time - pose.enteredAt);
  const tick = Math.floor((elapsed + BOUNDARY_EPSILON) * ENEMY_SPRITE_MOTION.walkFramesPerSecond);
  return Number.isFinite(tick) ? tick % 4 : 0;
}

/** Pure, deterministic atlas selection. It never advances attack gameplay or
 * guesses a shot from elapsed aim time. The caller records an actual release. */
export function enemySpriteFrame(pose: EnemySpritePose): EnemySpriteFrame {
  const { state, moving, time, enteredAt, firedAt } = pose;
  if (state === "dead") return ENEMY_SPRITE_FRAMES.death;
  if (state === "hurt" || state === "pinning" || state === "pinned")
    return ENEMY_SPRITE_FRAMES.hurt;
  if (state === "windup") return ENEMY_SPRITE_FRAMES.aim;
  if (state !== "chase") return ENEMY_SPRITE_FRAMES.idle;

  const validClock = Number.isFinite(time) && Number.isFinite(enteredAt);
  if (
    validClock &&
    firedAt !== undefined &&
    Number.isFinite(firedAt) &&
    firedAt >= enteredAt &&
    time >= firedAt &&
    time - firedAt < ENEMY_SPRITE_MOTION.fireDuration - BOUNDARY_EPSILON
  )
    return ENEMY_SPRITE_FRAMES.fire;

  if (!moving) return ENEMY_SPRITE_FRAMES.idle;
  const elapsed = validClock ? Math.max(0, time - enteredAt) : 0;
  const tick = Math.floor(
    (elapsed + BOUNDARY_EPSILON) * ENEMY_SPRITE_MOTION.walkFramesPerSecond,
  );
  // A reset/uninitialised/extreme clock still yields a valid atlas cell.
  return WALK[Number.isFinite(tick) ? tick % WALK.length : 0];
}

/** The cleaver begins its downstroke in the last 100 ms of melee preparation.
 * This visual cue does not imply a hit: range/occlusion remain gameplay checks. */
export function executionerSpriteFrame(
  pose: EnemySpritePose,
  windupRemaining?: number,
): EnemySpriteFrame {
  if (
    pose.state === "windup" &&
    windupRemaining !== undefined &&
    Number.isFinite(windupRemaining) &&
    windupRemaining >= 0 &&
    windupRemaining <= 0.1
  )
    return ENEMY_SPRITE_FRAMES.fire;
  return enemySpriteFrame({ ...pose, firedAt: undefined });
}
