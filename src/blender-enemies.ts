import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { disposeRig, type Rig } from "./art";
import type { EnemyKind } from "./enemy-types";

const library = new Map<EnemyKind, T.Group>();
let loading: Promise<void> | undefined;
const cloth = new WeakMap<Rig, { mesh: T.Mesh; rest: Float32Array }[]>();
export function preloadBlenderEnemies() {
  return (loading ??= Promise.all(
    (["cultist", "runner", "shambler", "spitter", "brute"] as EnemyKind[]).map(
      async (kind) => {
        const asset = await new GLTFLoader().loadAsync(
          `${import.meta.env.BASE_URL}models/${kind}.glb`,
        );
        library.set(kind, asset.scene);
      },
    ),
  )
    .then(() => {})
    .catch((error) => {
      loading = undefined;
      throw error;
    }));
}

/** Replace surfaces only. Existing joints retain AI, hitboxes, severing and corpse poses. */
export function installBlenderEnemy(rig: Rig, kind: EnemyKind): boolean {
  const source = library.get(kind);
  if (!source || rig.root.userData.assetSource === `blender/${kind}`)
    return false;
  const parts: Record<string, T.Object3D> = { body: rig.body, head: rig.head };
  for (const [i, side] of ["left", "right"].entries()) {
    const arm = rig.arms[i],
      leg = rig.legs[i];
    const forearm = arm.getObjectByName("elbow")!;
    const hand =
      forearm.getObjectByName("hand") ??
      forearm.children.find(
        (o) => o instanceof T.Group && o.name !== "cult-firearm",
      );
    if (!hand) throw new Error(`Missing ${side} hand joint`);
    parts[`${side}Arm`] = arm;
    parts[`${side}Forearm`] = forearm;
    parts[`${side}Hand`] = hand;
    parts[`${side}Leg`] = leg;
    parts[`${side}Shin`] = leg.getObjectByName("knee")!;
    parts[`${side}Foot`] = leg.getObjectByName("ankle")!;
  }
  if (kind === "cultist")
    parts.firearm = rig.root.getObjectByName("cult-firearm")!;
  const incoming = Object.entries(parts).map(([name, target]) => {
    const node = source.getObjectByName(name);
    if (!node || !target)
      throw new Error(`Missing Blender character anchor ${name}`);
    return { name, target, node };
  });
  const oldMeshes: T.Mesh[] = [];
  rig.root.traverse((o) => {
    if (o instanceof T.Mesh && !o.userData.transientEffect) oldMeshes.push(o);
  });
  oldMeshes.forEach((o) => {
    o.removeFromParent();
    disposeRig(o);
  });
  const clothParts: { mesh: T.Mesh; rest: Float32Array }[] = [];
  for (const { name, target, node } of incoming) {
    for (const child of node.children) {
      const copy = child.clone(true);
      copy.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        // Reset disposes per-instance geometry; keep the cached template immutable.
        o.geometry = o.geometry.clone();
        o.castShadow = true;
        o.receiveShadow = true;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials)
          if (m instanceof T.MeshStandardMaterial && m.map)
            m.map.anisotropy = 4;
        if (
          kind === "cultist" &&
          name === "body" &&
          materials.some((m) => m.name.includes("wool"))
        ) {
          clothParts.push({
            mesh: o,
            rest: new Float32Array(o.geometry.attributes.position.array),
          });
        }
      });
      target.add(copy);
    }
  }
  cloth.set(rig, clothParts);
  if (kind === "shambler") rig.head.position.z = -0.105;
  if (kind === "runner") rig.head.position.z = -0.08;
  rig.root.userData.assetSource = `blender/${kind}`;
  return true;
}

export function animateBlenderCloth(
  rig: Rig,
  time: number,
  phase: number,
  walking: boolean,
) {
  for (const { mesh, rest } of cloth.get(rig) ?? []) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = rest[i * 3],
        y = rest[i * 3 + 1],
        z = rest[i * 3 + 2];
      const weight = T.MathUtils.clamp((0.9 - y) / 0.62, 0, 1) ** 2;
      const swing = Math.sin(time * (walking ? 6 : 1.7) + phase - weight * 1.8);
      p.setXYZ(
        i,
        x + swing * weight * (walking ? 0.025 : 0.005),
        y,
        z + swing * weight * 0.009,
      );
    }
    p.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  }
}
