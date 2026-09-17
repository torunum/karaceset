import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const loader = new T.TextureLoader();
const bonePixels = new Uint8Array(128 * 128 * 4);
for (let y = 0; y < 128; y++)
  for (let x = 0; x < 128; x++) {
    const n = (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
    const grain =
      0.83 +
      Math.abs(n) * 0.16 -
      0.065 * Math.pow(Math.sin(x * 0.21 + Math.sin(y * 0.05) * 0.6), 8);
    const i = (y * 128 + x) * 4;
    bonePixels[i] = 255 * grain;
    bonePixels[i + 1] = 246 * grain;
    bonePixels[i + 2] = 218 * grain;
    bonePixels[i + 3] = 255;
  }
const boneMap = new T.DataTexture(bonePixels, 128, 128);
boneMap.colorSpace = T.SRGBColorSpace;
boneMap.wrapS = boneMap.wrapT = T.RepeatWrapping;
boneMap.needsUpdate = true;
export const muscleMap =
  typeof document === "undefined"
    ? new T.Texture()
    : loader.load("/textures/muscle.png");
muscleMap.colorSpace = T.SRGBColorSpace;
muscleMap.wrapS = muscleMap.wrapT = T.RepeatWrapping;
muscleMap.anisotropy = 4;
export const mats = {
  flesh: new T.MeshStandardMaterial({
    map: muscleMap,
    color: 0xb88b8d,
    roughness: 0.48,
    bumpMap: muscleMap,
    bumpScale: 0.075,
  }),
  dark: new T.MeshStandardMaterial({
    map: muscleMap,
    color: 0x643e53,
    roughness: 0.38,
    bumpMap: muscleMap,
    bumpScale: 0.08,
  }),
  bone: new T.MeshStandardMaterial({
    color: 0xc7b799,
    map: boneMap,
    roughness: 0.87,
    bumpMap: boneMap,
    bumpScale: 0.025,
  }),
  tendon: new T.MeshStandardMaterial({ color: 0x9c6b68, roughness: 0.45 }),
  vein: new T.MeshStandardMaterial({ color: 0x391c45, roughness: 0.3 }),
  black: new T.MeshStandardMaterial({ color: 0x140b16, roughness: 0.58 }),
  yellow: new T.MeshStandardMaterial({
    color: 0xd6ce77,
    emissive: 0xaaa033,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  }),
  red: new T.MeshStandardMaterial({
    color: 0xbb384b,
    emissive: 0x781c35,
    emissiveIntensity: 0.4,
    roughness: 0.36,
  }),
  puddle: new T.MeshStandardMaterial({
    color: 0x351925,
    roughness: 0.12,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
  }),
};
const sphere = new T.SphereGeometry(1, 12, 8);
const cylinder = new T.CylinderGeometry(0.65, 1, 1, 9),
  cone = new T.ConeGeometry(1, 1, 9);
export function oval(
  parent: T.Object3D,
  mat: T.Material,
  p: number[],
  s: number[],
) {
  const m = new T.Mesh(sphere, mat);
  m.position.set(p[0], p[1], p[2]);
  m.scale.set(s[0], s[1], s[2]);
  parent.add(m);
  return m;
}
export function tube(
  parent: T.Object3D,
  points: T.Vector3[],
  radius: number,
  mat: T.Material,
  segments = 12,
) {
  const curve = new T.CatmullRomCurve3(points);
  const m = new T.Mesh(
    new T.TubeGeometry(curve, segments, radius, 6, false),
    mat,
  );
  parent.add(m);
  return m;
}
export function boneBetween(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  r = 0.08,
  mat: T.Material = mats.bone,
) {
  const delta = b.clone().sub(a);
  const m = new T.Mesh(cylinder, mat);
  m.scale.set(r, delta.length(), r);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  parent.add(m);
  return m;
}
export function spike(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  r = 0.08,
  mat: T.Material = mats.bone,
) {
  const d = b.clone().sub(a);
  const m = new T.Mesh(cone, mat);
  m.scale.set(r, d.length(), r);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  parent.add(m);
  return m;
}
/** Batch rigid pieces by material, retaining articulated groups and explicitly excluded meshes. */
export function batchRigid(parent: T.Object3D, exclude: T.Object3D[] = []) {
  const groups = new Map<T.Material, T.Mesh[]>();
  for (const child of [...parent.children]) {
    if (
      child instanceof T.Mesh &&
      !exclude.includes(child) &&
      !Array.isArray(child.material)
    ) {
      const list = groups.get(child.material) || [];
      list.push(child);
      groups.set(child.material, list);
    }
  }
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((m) => {
      m.updateMatrix();
      return m.geometry.clone().applyMatrix4(m.matrix);
    });
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (merged) {
      meshes.forEach((m) => parent.remove(m));
      parent.add(new T.Mesh(merged, material));
    }
  }
}
export function disposeRig(root: T.Object3D) {
  const seen = new Set<T.BufferGeometry>();
  root.traverse((o) => {
    if (o instanceof T.Mesh && !o.geometry.userData.sharedAsset && ![sphere, cylinder, cone].includes(o.geometry))
      seen.add(o.geometry);
  });
  seen.forEach((g) => g.dispose());
}
export function femur(length = 1.25) {
  const g = new T.Group();
  boneBetween(
    g,
    new T.Vector3(0, 0, -length * 0.3),
    new T.Vector3(0, 0, length * 0.35),
    0.055,
  );
  spike(
    g,
    new T.Vector3(0, 0, -length * 0.25),
    new T.Vector3(0, 0, -length * 0.65),
    0.075,
  );
  for (const x of [-0.065, 0.065])
    oval(g, mats.bone, [x, 0, length * 0.34], [0.09, 0.065, 0.09]);
  return g;
}
export interface Rig {
  root: T.Group;
  body: T.Group;
  head: T.Group;
  arms: T.Group[];
  legs: T.Group[];
  sac: T.Mesh;
}
export function creature(kind: "runner" | "spitter"): Rig {
  const root = new T.Group(),
    body = new T.Group(),
    head = new T.Group();
  root.add(body);
  const heavy = kind === "spitter";
  const skin = heavy ? mats.dark : mats.flesh;
  // Pear-shaped thorax, exposed rib cage and vertebral spine.
  oval(
    body,
    skin,
    [0, 1.12, 0],
    [heavy ? 0.53 : 0.32, heavy ? 0.67 : 0.47, 0.3],
  );
  oval(body, mats.dark, [0, 0.72, 0], [0.26, 0.2, 0.23]);
  for (let i = 0; i < 6; i++) {
    const y = 0.86 + i * 0.115,
      w = (heavy ? 0.46 : 0.3) * Math.sin(((i + 2) / 9) * Math.PI);
    tube(
      body,
      [
        new T.Vector3(-w, y, 0.07),
        new T.Vector3(-w * 0.85, y + 0.03, -0.26),
        new T.Vector3(0, y - 0.03, -0.32),
        new T.Vector3(w * 0.85, y + 0.03, -0.26),
        new T.Vector3(w, y, 0.07),
      ],
      0.029,
      mats.bone,
      10,
    );
    oval(body, mats.bone, [0, y, 0.27], [0.065, 0.065, 0.065]);
  }
  head.position.set(0, heavy ? 1.78 : 1.62, -0.09);
  body.add(head);
  oval(head, skin, [0, 0, 0], [0.25, 0.29, 0.24]);
  oval(head, mats.black, [0, -0.045, -0.205], [0.17, 0.19, 0.052]);
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.05;
    spike(
      head,
      new T.Vector3(x, 0.085, -0.235),
      new T.Vector3(x, 0.015 - Math.abs(x) * 0.15, -0.28),
      0.022,
    );
    spike(
      head,
      new T.Vector3(x, -0.17, -0.235),
      new T.Vector3(x, -0.085, -0.28),
      0.018,
    );
  }
  for (const x of [-0.15, 0.15]) {
    oval(head, mats.yellow, [x, 0.105, -0.194], [0.048, 0.021, 0.041]);
    spike(
      head,
      new T.Vector3(x, 0.2, 0.02),
      new T.Vector3(x * 1.8, 0.4, 0.08),
      0.06,
    );
  }
  const arms: T.Group[] = [],
    legs: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * (heavy ? 0.45 : 0.3), 1.35, 0);
    body.add(arm);
    arms.push(arm);
    boneBetween(
      arm,
      new T.Vector3(),
      new T.Vector3(side * 0.22, -0.42, -0.08),
      0.075,
      skin,
    );
    boneBetween(
      arm,
      new T.Vector3(side * 0.22, -0.42, -0.08),
      new T.Vector3(side * 0.13, -0.82, -0.24),
      0.05,
    );
    oval(arm, skin, [side * 0.22, -0.4, -0.08], [0.1, 0.12, 0.1]);
    for (let j = 0; j < 3; j++)
      spike(
        arm,
        new T.Vector3(side * 0.13 + (j - 1) * 0.06, -0.79, -0.23),
        new T.Vector3(side * 0.15 + (j - 1) * 0.1, -1.02, -0.4),
        0.034,
      );
    const leg = new T.Group();
    leg.position.set(side * 0.19, 0.76, 0);
    root.add(leg);
    legs.push(leg);
    boneBetween(
      leg,
      new T.Vector3(),
      new T.Vector3(side * 0.035, -0.37, 0.13),
      0.095,
      skin,
    );
    boneBetween(
      leg,
      new T.Vector3(side * 0.035, -0.37, 0.13),
      new T.Vector3(side * 0.02, -0.7, -0.05),
      0.048,
    );
    oval(leg, mats.dark, [0, -0.7, -0.14], [0.11, 0.07, 0.22]);
  }
  const sac = oval(
    body,
    heavy ? mats.yellow : mats.red,
    [0, 1.3, heavy ? -0.35 : 0.24],
    [heavy ? 0.27 : 0.15, heavy ? 0.31 : 0.22, 0.16],
  );
  if (heavy) {
    for (let i = 0; i < 4; i++)
      oval(
        body,
        mats.dark,
        [(i % 2 ? 1 : -1) * 0.4, 0.88 + Math.floor(i / 2) * 0.3, 0.15],
        [0.2, 0.24, 0.25],
      );
  }
  batchRigid(body, [sac]);
  batchRigid(head);
  arms.forEach((a) => batchRigid(a));
  legs.forEach((a) => batchRigid(a));
  return { root, body, head, arms, legs, sac };
}
export function animateCreature(
  r: Rig,
  state: string,
  time: number,
  phase: number,
  heavy: boolean,
) {
  const walk = state === "chase" ? 1 : 0;
  const swing = Math.sin(time * (heavy ? 6 : 12) + phase);
  r.body.position.y =
    Math.sin(time * 3 + phase) * 0.018 + Math.abs(swing) * 0.035 * walk;
  r.legs.forEach((l, i) => (l.rotation.x = swing * (i ? 1 : -1) * 0.5 * walk));
  r.arms.forEach((a, i) => {
    a.rotation.x =
      state === "windup" ? -1.1 : walk * swing * (i ? 1 : -1) * 0.3;
    a.rotation.z = (i ? 1 : -1) * (state === "windup" ? 0.35 : 0.08);
  });
  r.head.rotation.x =
    state === "windup" ? -0.23 : Math.sin(time * 1.9 + phase) * 0.05;
  r.sac.material =
    state === "windup" ? mats.yellow : heavy ? mats.yellow : mats.red;
  if (state === "hurt") r.body.rotation.x = -0.22;
  else r.body.rotation.x *= 0.8;
}
export function weapon() {
  const root = new T.Group(),
    mechanism = new T.Group(),
    jaws: T.Group[] = [],
    tendons: T.Mesh[] = [];
  root.add(mechanism);
  oval(root, mats.dark, [0, -0.06, 0.13], [0.18, 0.15, 0.47]);
  oval(root, mats.flesh, [0, 0.06, 0.22], [0.13, 0.07, 0.2]);
  for (let i = 0; i < 5; i++) {
    const z = 0.32 - i * 0.095;
    oval(root, mats.bone, [0, 0.115, z], [0.075, 0.028, 0.032]);
    for (const side of [-1, 1])
      tube(
        root,
        [
          new T.Vector3(side * 0.03, 0.105, z),
          new T.Vector3(side * 0.12, 0.065, z - 0.035),
          new T.Vector3(side * 0.17, -0.01, z - 0.06),
        ],
        0.018,
        mats.tendon,
        8,
      );
  }
  for (const x of [-0.16, 0.16]) {
    tube(
      root,
      [
        new T.Vector3(x, -0.1, 0.48),
        new T.Vector3(x * 1.2, 0.035, 0.14),
        new T.Vector3(x, 0.02, -0.32),
        new T.Vector3(x * 0.6, 0.04, -0.62),
      ],
      0.055,
      mats.bone,
      16,
    );
  }
  for (let i = 0; i < 5; i++) {
    const z = 0.3 - i * 0.14;
    tube(
      root,
      [
        new T.Vector3(-0.17, -0.06, z),
        new T.Vector3(-0.12, -0.17, z),
        new T.Vector3(0.12, -0.17, z),
        new T.Vector3(0.17, -0.06, z),
      ],
      0.026,
      mats.bone,
      8,
    );
  }
  oval(root, mats.flesh, [0.12, -0.21, 0.34], [0.12, 0.22, 0.14]);
  boneBetween(
    root,
    new T.Vector3(0.1, -0.23, 0.32),
    new T.Vector3(0.13, -0.42, 0.42),
    0.055,
  );
  for (const side of [-1, 1]) {
    const j = new T.Group();
    j.position.set(side * 0.14, 0, -0.4);
    root.add(j);
    jaws.push(j);
    tube(
      j,
      [
        new T.Vector3(0, 0, 0.12),
        new T.Vector3(side * 0.07, 0.04, -0.14),
        new T.Vector3(side * 0.01, 0.045, -0.35),
      ],
      0.043,
      mats.bone,
    );
    for (let i = 0; i < 4; i++)
      spike(
        j,
        new T.Vector3(side * 0.06, 0.02, -i * 0.07),
        new T.Vector3(-side * 0.04, 0.05, -i * 0.07 - 0.04),
        0.025,
      );
    const t = tube(
      root,
      [
        new T.Vector3(side * 0.17, 0.015, 0.37),
        new T.Vector3(side * 0.24, 0.1, -0.03),
        new T.Vector3(side * 0.15, 0.04, -0.48),
      ],
      0.027,
      mats.tendon,
      18,
    );
    tendons.push(t);
  }
  const load = femur(0.95);
  load.position.set(0, 0.07, -0.15);
  mechanism.add(load);
  oval(root, mats.yellow, [0, -0.02, 0.37], [0.055, 0.033, 0.06]);
  return { root, mechanism, jaws, tendons };
}
