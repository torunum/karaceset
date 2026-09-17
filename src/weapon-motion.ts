import * as T from "three";
import { WEAPONS, type WeaponId } from "./weapons";

export const COMBAT_MOTION = { recoilDuration: 0.15, switchDuration: 0.23 };
const SHOTGUN_OPEN_START = 0.14;
const SHOTGUN_OPEN_END = 0.32;
const SHOTGUN_RELOAD_CUE = (SHOTGUN_OPEN_START + SHOTGUN_OPEN_END) / 2;
/** Crossing detection preserves a single cue even when a slow frame skips it. */
export function crossedReloadCue(
  id: WeaponId,
  previous: number,
  remaining: number,
) {
  const threshold = WEAPONS[id].fireInterval * (1 - SHOTGUN_RELOAD_CUE);
  return id === "shotgun" && previous > threshold && remaining <= threshold;
}

export interface AnimatedWeapon {
  root: T.Group;
  mechanism: T.Group;
  jaws: T.Group[];
  tendons: T.Mesh[];
}
const smooth = (a: number, b: number, x: number) => {
  const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Cooldown defines a reproducible mechanical timeline, independent of frame rate. */
export function animateWeaponModel(
  gun: AnimatedWeapon,
  id: WeaponId,
  time: number,
  recoil: number,
  shotCooldown: number,
) {
  const restZ = gun.mechanism.userData.restZ ?? 0;
  const phase =
    1 - T.MathUtils.clamp(shotCooldown / WEAPONS[id].fireInterval, 0, 1);
  const active = shotCooldown > 0;
  const support = gun.root.userData.supportHand as T.Group | undefined;
  const trigger = gun.root.userData.triggerHand as T.Group | undefined;
  gun.mechanism.rotation.set(0, 0, 0);
  gun.mechanism.position.z = restZ;
  gun.mechanism.scale.set(1, 1, 1);
  if (support) {
    support.position.set(0, 0, 0);
    support.rotation.set(0, 0, 0);
  }
  if (trigger) {
    trigger.rotation.x = recoil * -0.045;
    trigger.position.z = recoil * 0.018;
  }
  if (id === "shotgun") {
    const opening = active
      ? smooth(SHOTGUN_OPEN_START, SHOTGUN_OPEN_END, phase) *
        (1 - smooth(0.72, 0.93, phase))
      : 0;
    gun.mechanism.rotation.x = -opening * 0.56;
    gun.mechanism.position.z = restZ + recoil * 0.012;
    if (support) {
      support.position.y = -opening * 0.16;
      support.position.z = opening * 0.055;
      support.rotation.x = -opening * 0.24;
    }
    const hammers = gun.root.userData.hammers as T.Group | undefined;
    if (hammers)
      hammers.rotation.x = active ? -0.65 * (1 - smooth(0.38, 0.58, phase)) : 0;
    const shells = gun.root.userData.shells as T.Group[] | undefined;
    shells?.forEach((shell, i) => {
      const e = T.MathUtils.clamp((phase - 0.34 - i * 0.025) / 0.29, 0, 1);
      shell.visible =
        active && phase > 0.34 + i * 0.025 && phase < 0.66 + i * 0.025;
      shell.position.set(
        (i ? 1 : -1) * (0.068 + e * 0.15),
        0.035 + Math.sin(e * Math.PI) * 0.22,
        e * 0.38,
      );
      shell.rotation.set(e * 3.6, (i ? 1 : -1) * e * 2.2, e * 1.8);
    });
  } else if (id === "femur") {
    const pull = active
      ? smooth(0.03, 0.3, phase) * (1 - smooth(0.52, 0.89, phase))
      : 0;
    gun.mechanism.position.z = restZ + pull * 0.17;
    gun.jaws.forEach((jaw, i) => {
      jaw.rotation.y = (i ? 1 : -1) * (pull * 0.18 + recoil * 0.12);
    });
    gun.tendons.forEach((t) => {
      t.scale.x = 1 - pull * 0.08;
      t.scale.y = 1 + pull * 0.04;
    });
    if (support) {
      support.position.z = pull * 0.05;
      support.rotation.z = pull * 0.04;
    }
  } else {
    gun.mechanism.scale.set(
      1 + recoil * 0.15,
      1 + recoil * 0.15,
      1 - recoil * 0.025,
    );
    gun.jaws.forEach((lobe, i) => {
      const wave = Math.sin(time * 4.5 - i * 1.15) * 0.025;
      lobe.scale.set(
        1 + wave - recoil * 0.11,
        1 + wave - recoil * 0.16,
        1 - wave + recoil * 0.07,
      );
      lobe.rotation.y = Math.sin(time * 2.2 + i) * 0.025;
    });
    gun.tendons.forEach((t, i) => {
      t.scale.x = 1 - Math.sin(time * 4 - i) * 0.012 - recoil * 0.04;
    });
    if (support) support.rotation.x = recoil * 0.07;
  }
}
