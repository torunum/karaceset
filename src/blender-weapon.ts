import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { AnimatedWeapon } from "./weapon-motion";

/** Keep the gameplay rig and hands stable while replacing its rigid art. */
export function installVesperAsset(gun: AnimatedWeapon, scene: T.Group) {
  const body = scene.getObjectByName("vesper_body");
  const hinge = scene.getObjectByName("vesper_hinge");
  const hammers = scene.getObjectByName("vesper_hammers");
  if (!body || !hinge || !hammers)
    throw new Error("Vesper GLB is missing animation anchors");
  // Validate before touching the fallback. Each anchor is a top-level, game-axis node.
  const oldHammers = gun.root.userData.hammers as T.Group;
  const preserved = new Set<T.Object3D>([
    gun.mechanism,
    oldHammers,
    gun.root.userData.supportHand,
    gun.root.userData.triggerHand,
    ...(gun.root.userData.shells ?? []),
  ]);
  const removeMesh = (o: T.Object3D) => {
    o.removeFromParent();
    o.traverse((child) => {
      if (child instanceof T.Mesh) child.geometry.dispose();
    });
  };
  for (const child of [...gun.root.children])
    if (!preserved.has(child)) removeMesh(child);
  for (const child of [...gun.mechanism.children]) removeMesh(child);
  for (const child of [...oldHammers.children]) removeMesh(child);
  // Mesh transforms from Blender remain relative to the authored anchor. The
  // existing timeline rotates Three.js groups, so no competing animation mixer.
  for (const child of [...body.children]) gun.root.add(child);
  for (const child of [...hinge.children]) gun.mechanism.add(child);
  for (const child of [...hammers.children]) oldHammers.add(child);
  gun.mechanism.position.copy(hinge.position);
  gun.mechanism.userData.restZ = hinge.position.z;
  oldHammers.position.copy(hammers.position);
  gun.root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    for (const material of Array.isArray(o.material)
      ? o.material
      : [o.material]) {
      if (material instanceof T.MeshStandardMaterial && material.map)
        material.map.anisotropy = 8;
    }
  });
  gun.root.userData.assetSource = "blender/vesper";
}

export async function loadVesperAsset(gun: AnimatedWeapon) {
  gun.root.userData.assetSource = "procedural";
  try {
    const gltf = await new GLTFLoader().loadAsync(
      `${import.meta.env.BASE_URL}models/vesper.glb`,
    );
    installVesperAsset(gun, gltf.scene);
  } catch (error) {
    gun.root.userData.assetError = String(error);
    console.warn("Vesper model could not load; keeping fallback", error);
  }
}
