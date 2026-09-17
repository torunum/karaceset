import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { AnimatedWeapon } from "./weapon-motion";
import type { WeaponId } from "./weapons";

type KickRig = { root: T.Group; thigh: T.Group; shin: T.Group; boot: T.Group };

function anchor(scene: T.Object3D, name: string) {
  const node = scene.getObjectByName(name);
  if (!node) throw new Error(`Blender arsenal is missing ${name}`);
  return node;
}

function clearSurface(group: T.Object3D) {
  for (const child of [...group.children]) {
    child.removeFromParent();
    child.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
    });
  }
}

function transfer(from: T.Object3D, to: T.Object3D) {
  for (const child of [...from.children]) to.add(child);
}

function configure(root: T.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m instanceof T.MeshStandardMaterial && m.map) m.map.anisotropy = 8;
    }
  });
}

/** The GLB is authored in the existing weapon's local axes and dimensions.
 * Rigid animation anchors survive replacement; loaded geometry never competes
 * with the gameplay timeline through a second animation mixer. */
export function installOrganicWeapon(
  gun: AnimatedWeapon,
  scene: T.Group,
  id: "femur" | "acid",
) {
  const body = anchor(scene, `${id}_body`);
  const mechanism = anchor(scene, `${id}_mechanism`);
  const jaws = [0, 1].map((i) => anchor(scene, `${id}_jaw_${i}`));
  // Validate the complete anchor contract before removing any existing surface.
  const hands = [
    gun.root.userData.triggerHand,
    gun.root.userData.supportHand,
  ].filter((o): o is T.Group => o instanceof T.Group);
  for (const hand of hands) hand.removeFromParent();
  gun.mechanism.removeFromParent();
  clearSurface(gun.root);
  clearSurface(gun.mechanism);
  gun.root.add(gun.mechanism, ...hands);
  transfer(body, gun.root);
  transfer(mechanism, gun.mechanism);
  gun.mechanism.position.copy(mechanism.position);
  gun.mechanism.userData.restZ = mechanism.position.z;
  gun.jaws.length = 0;
  for (const node of jaws) {
    const pivot = new T.Group();
    pivot.name = node.name;
    pivot.position.copy(node.position);
    transfer(node, pivot);
    gun.root.add(pivot);
    gun.jaws.push(pivot);
  }
  gun.tendons.length = 0;
  configure(gun.root);
  gun.root.userData.assetSource = `blender/${id === "femur" ? "ossuary" : "tithe"}`;
}

export function installBlenderHands(gun: AnimatedWeapon, scene: T.Group) {
  const nodes = [anchor(scene, "trigger_hand"), anchor(scene, "support_hand")];
  nodes.forEach((node, i) => {
    const key = i ? "supportHand" : "triggerHand";
    const hand = gun.root.userData[key] as T.Group | undefined;
    const target = hand ?? new T.Group();
    clearSurface(target);
    transfer(node, target);
    target.name = `Blender Warden ${key}`;
    gun.root.add(target);
    gun.root.userData[key] = target;
  });
  configure(gun.root);
  gun.root.userData.handsAssetSource = "blender/warden-hands";
}

export function installBlenderKick(kick: KickRig, scene: T.Group) {
  const nodes = ["kick_thigh", "kick_shin", "kick_boot"].map((name) =>
    anchor(scene, name),
  );
  // Child articulation is gameplay-owned; do not clear the knee or ankle along
  // with the old meshes, or modify their pivot positions while a kick is active.
  kick.shin.removeFromParent();
  kick.boot.removeFromParent();
  [kick.thigh, kick.shin, kick.boot].forEach((target, i) => {
    clearSurface(target);
    transfer(nodes[i], target);
  });
  kick.thigh.add(kick.shin);
  kick.shin.add(kick.boot);
  configure(kick.root);
  kick.root.userData.assetSource = "blender/warden-kick";
}

export async function loadBlenderArsenal(
  arsenal: Record<WeaponId, AnimatedWeapon>,
  kick: KickRig,
) {
  const loader = new GLTFLoader();
  const load = (name: string) =>
    loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
  const results = await Promise.allSettled([
    load("ossuary").then(({ scene }) =>
      installOrganicWeapon(arsenal.femur, scene, "femur"),
    ),
    load("tithe").then(({ scene }) =>
      installOrganicWeapon(arsenal.acid, scene, "acid"),
    ),
    load("warden-hands").then(({ scene }) => {
      for (const gun of Object.values(arsenal))
        installBlenderHands(gun, scene.clone(true));
    }),
    load("warden-kick").then(({ scene }) => installBlenderKick(kick, scene)),
  ]);
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const name = ["ossuary", "tithe", "warden-hands", "warden-kick"][i];
      console.error(`Blender asset ${name} failed to load`, result.reason);
      kick.root.userData.arsenalAssetErrors ??= [];
      kick.root.userData.arsenalAssetErrors.push(
        `${name}: ${String(result.reason)}`,
      );
    }
  });
  return results;
}
