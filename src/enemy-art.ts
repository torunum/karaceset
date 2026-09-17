import * as T from "three";
import { installBlenderEnemy, animateBlenderCloth } from "./blender-enemies";
import {
  type Rig,
  oval,
  tube,
  boneBetween,
  spike,
  batchRigid,
  mats,
} from "./art";
import { ENEMIES, type EnemyKind } from "./enemy-types";

// Original anatomical figures. Neutral-value maps preserve readable material
// separation under the level's warm, low-key lighting.
function surfaceMap(fabric: boolean) {
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const grain = noise - Math.floor(noise);
      const vein = Math.pow(
        Math.max(0, Math.sin(x * 0.19 + Math.sin(y * 0.075) * 2.8)),
        24,
      );
      const weave = fabric ? (x % 2) * 0.065 + (y % 3 ? 0.035 : -0.055) : 0;
      const value = Math.min(
        1,
        0.84 + grain * 0.14 + weave - (fabric ? 0 : vein * 0.13),
      );
      const i = (y * 128 + x) * 4;
      pixels[i] = 255 * value;
      pixels[i + 1] = 255 * value * (fabric ? 1 : 0.965);
      pixels[i + 2] = 255 * value * (fabric ? 0.98 : 0.945);
      pixels[i + 3] = 255;
    }
  const map = new T.DataTexture(pixels, 128, 128);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.needsUpdate = true;
  return map;
}
const skinMap = surfaceMap(false),
  clothMap = surfaceMap(true);
const corpse = new T.MeshStandardMaterial({
  map: skinMap,
  bumpMap: skinMap,
  bumpScale: 0.008,
  color: 0x9a9884,
  roughness: 0.88,
});
const flayed = new T.MeshStandardMaterial({
  map: skinMap,
  bumpMap: skinMap,
  bumpScale: 0.012,
  color: 0x985c50,
  roughness: 0.73,
});
const wound = new T.MeshStandardMaterial({
  map: skinMap,
  color: 0x581d1c,
  roughness: 0.65,
});
const cloth = new T.MeshStandardMaterial({
  map: clothMap,
  bumpMap: clothMap,
  bumpScale: 0.004,
  color: 0x646b60,
  roughness: 1,
  side: T.DoubleSide,
});
const robe = new T.MeshStandardMaterial({
  map: clothMap,
  bumpMap: clothMap,
  bumpScale: 0.004,
  color: 0x75616a,
  roughness: 1,
  side: T.DoubleSide,
});
const apron = new T.MeshStandardMaterial({
  map: clothMap,
  bumpMap: clothMap,
  bumpScale: 0.005,
  color: 0x948b70,
  roughness: 0.94,
  side: T.DoubleSide,
});
const leather = new T.MeshStandardMaterial({
  map: clothMap,
  color: 0x464036,
  roughness: 0.85,
});
const iron = new T.MeshStandardMaterial({
  color: 0x707674,
  roughness: 0.55,
  metalness: 0.45,
});
const rust = new T.MeshStandardMaterial({
  color: 0x694530,
  roughness: 0.9,
  metalness: 0.35,
});
const bile = new T.MeshStandardMaterial({
  map: skinMap,
  bumpMap: skinMap,
  bumpScale: 0.012,
  color: 0xa29a5e,
  roughness: 0.58,
});
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

function block(
  parent: T.Object3D,
  material: T.Material,
  p: number[],
  s: number[],
) {
  const mesh = new T.Mesh(new T.BoxGeometry(s[0], s[1], s[2]), material);
  mesh.position.set(p[0], p[1], p[2]);
  parent.add(mesh);
  return mesh;
}

/** Cross-section sculpt: shoulders, muscles and boot lasts are continuous
 * silhouettes instead of a stack of cylinders. Sections are y/x-radius/z-radius/z-offset. */
function sculpt(
  parent: T.Object3D,
  material: T.Material,
  sections: number[][],
  x = 0,
) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const sides = 12;
  sections.forEach(([y, rx, rz, z], ring) => {
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      positions.push(x + Math.sin(a) * rx, y, z + Math.cos(a) * rz);
      uvs.push(i / sides, ring / (sections.length - 1));
      if (ring < sections.length - 1 && i < sides) {
        const n = ring * (sides + 1) + i,
          b = n + sides + 1;
        indices.push(n, b, n + 1, n + 1, b, b + 1);
      }
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

/** Sewn, angular cloth with actual folds and a ragged lower edge. */
function garment(
  parent: T.Object3D,
  material: T.Material,
  top: number,
  bottom: number,
  width: number,
  flare: number,
  depth: number,
  openFront = false,
) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const count = 32,
    rings = 5;
  for (let ring = 0; ring < rings; ring++) {
    for (let i = 0; i <= count; i++) {
      const a = (i / count) * Math.PI * 2;
      const fold =
        1 + Math.sin(a * 8 + ring * 0.17) * 0.065 + Math.sin(a * 3) * 0.035;
      const radius = (width + (flare * ring) / (rings - 1)) * fold;
      positions.push(
        Math.sin(a) * radius,
        T.MathUtils.lerp(top, bottom, ring / (rings - 1)) +
          (ring === rings - 1 ? ((i * 7) % 5) * 0.022 : 0),
        Math.cos(a) * depth * fold,
      );
      uvs.push((i / count) * 2, (ring / (rings - 1)) * 2);
    }
  }
  for (let ring = 0; ring < rings - 1; ring++)
    for (let i = 0; i < count; i++) {
      if (openFront && i >= 14 && i <= 17) continue;
      const a = ring * (count + 1) + i,
        b = a + count + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  parent.add(new T.Mesh(geo, material));
}

function skull(head: T.Group, skin: T.Material, masked: boolean) {
  sculpt(head, skin, [
    [0.198, 0.018, 0.025, 0.018],
    [0.176, 0.076, 0.079, 0.016],
    [0.125, 0.116, 0.106, 0.012],
    [0.057, 0.126, 0.116, 0.006],
    [-0.004, 0.118, 0.105, 0.002],
    [-0.047, 0.086, 0.082, -0.022],
    [-0.104, 0.067, 0.068, -0.026],
    [-0.135, 0.039, 0.043, -0.022],
    [-0.144, 0.004, 0.004, -0.018],
  ]);
  // Narrow jaw, angular brow and cheekbones retain a human adult face.
  oval(head, skin, [0, -0.106, -0.052], [0.064, 0.038, 0.051]);
  for (const side of [-1, 1]) {
    oval(
      head,
      mats.black,
      [side * 0.049, 0.036, -0.106],
      [0.034, 0.027, 0.017],
    );
    boneBetween(
      head,
      v(side * 0.013, 0.075, -0.11),
      v(side * 0.09, 0.065, -0.093),
      0.022,
      skin,
    );
    boneBetween(
      head,
      v(side * 0.08, -0.006, -0.104),
      v(side * 0.093, -0.048, -0.076),
      0.023,
      skin,
    );
    oval(head, skin, [side * 0.124, -0.006, 0.005], [0.017, 0.035, 0.021]);
    oval(head, wound, [side * 0.135, -0.007, -0.001], [0.004, 0.019, 0.014]);
    // A small clouded eye deep behind the brow, with no glowing cartoon iris.
    oval(head, corpse, [side * 0.05, 0.035, -0.12], [0.013, 0.009, 0.007]);
    tube(
      head,
      [
        v(side * 0.094, -0.018, -0.086),
        v(side * 0.062, -0.043, -0.111),
        v(side * 0.049, -0.069, -0.109),
      ],
      0.008,
      skin,
      5,
    );
    boneBetween(
      head,
      v(side * 0.108, 0.081, -0.071),
      v(side * 0.091, 0.115, -0.081),
      0.012,
      skin,
    );
  }
  spike(head, v(0, 0.027, -0.098), v(0, -0.025, -0.149), 0.019, skin);
  block(head, mats.black, [0, -0.087, -0.094], [0.073, 0.012, 0.018]);
  if (masked) {
    block(head, iron, [0, -0.055, -0.125], [0.129, 0.12, 0.018]);
    for (const x of [-0.036, 0, 0.036])
      block(head, mats.black, [x, -0.05, -0.136], [0.009, 0.05, 0.004]);
    tube(
      head,
      [v(-0.115, -0.048, -0.08), v(0, -0.048, 0.13), v(0.115, -0.048, -0.08)],
      0.012,
      leather,
    );
  } else {
    oval(head, wound, [-0.085, -0.035, -0.092], [0.031, 0.057, 0.013]);
    boneBetween(
      head,
      v(-0.087, -0.044, -0.109),
      v(-0.061, -0.081, -0.102),
      0.011,
    );
    for (let i = 0; i < 5; i++)
      block(
        head,
        mats.bone,
        [(i - 2) * 0.01, -0.085, -0.105],
        [0.007, 0.009, 0.005],
      );
    // Uneven stitches close one temple wound.
    for (let i = 0; i < 4; i++)
      boneBetween(
        head,
        v(-0.092, 0.107 - i * 0.023, -0.076),
        v(-0.117, 0.098 - i * 0.023, -0.064),
        0.003,
        leather,
      );
  }
}

// Dedicated cloth atlas: washed seams, dark damp hem and irregular ash deposits.
// UVs run once around the garment so dirt has a physical scale rather than repeating.
function cultClothMap() {
  const size = 256,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        h = y / size;
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = hash - Math.floor(hash);
      const seam = Math.pow(Math.abs(Math.cos(u * Math.PI * 8)), 80);
      const soot = Math.max(
        0,
        Math.sin(u * 21 + Math.sin(h * 11)) * Math.cos(h * 19 + u * 7),
      );
      const damp = Math.max(0, h - 0.63) * 0.75;
      const shade = 0.65 + grain * 0.17 + seam * 0.1 - soot * 0.16 - damp;
      const i = (y * size + x) * 4;
      data[i] = 182 * shade;
      data[i + 1] = 113 * shade;
      data[i + 2] = 103 * shade;
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, size, size);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
const cultMap = cultClothMap();
const cultWool = new T.MeshStandardMaterial({
  map: cultMap,
  bumpMap: clothMap,
  bumpScale: 0.006,
  roughness: 0.96,
  side: T.DoubleSide,
});
const cultTrim = new T.MeshStandardMaterial({
  map: cultMap,
  color: 0xaba195,
  roughness: 0.94,
  side: T.DoubleSide,
});
const maskIron = new T.MeshStandardMaterial({
  map: clothMap,
  color: 0x8c8e84,
  metalness: 0.62,
  roughness: 0.69,
  side: T.DoubleSide,
});
const gloveHide = new T.MeshStandardMaterial({
  map: clothMap,
  color: 0x5f574a,
  roughness: 0.82,
});

/** Continuous tailored cross-sections. The front opening cuts the mesh, not its
 * material; the recessed face therefore remains genuinely inside the hood. */
function foldedCloth(
  parent: T.Object3D,
  material: T.Material,
  sections: number[][],
  opening = 0,
  folds = 0.065,
) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const sides = 48;
  sections.forEach(([y, rx, rz, z], ring) => {
    for (let i = 0; i <= sides; i++) {
      const angle =
        Math.PI + opening / 2 + (i / sides) * (Math.PI * 2 - opening);
      const fold =
        1 +
        Math.sin(angle * 9 + ring * 0.09) * folds +
        Math.sin(angle * 5 - 0.4) * folds * 0.6;
      const hem =
        ring === sections.length - 1 ? Math.sin(angle * 7) * 0.012 : 0;
      positions.push(
        Math.sin(angle) * rx * fold,
        y + hem,
        z + Math.cos(angle) * rz * fold,
      );
      uvs.push(i / sides, ring / (sections.length - 1));
      if (i < sides && ring < sections.length - 1) {
        const a = ring * (sides + 1) + i,
          b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

type ClothRest = { positions: Float32Array; anchor: number; bottom: number };
const clothRest = new WeakMap<T.Mesh, ClothRest>();
function registerCloth(
  mesh: T.Mesh,
  name: string,
  anchor: number,
  bottom: number,
) {
  mesh.name = name;
  clothRest.set(mesh, {
    positions: new Float32Array(mesh.geometry.getAttribute("position").array),
    anchor,
    bottom,
  });
}
function animateCloth(
  rig: Rig,
  time: number,
  phase: number,
  walking: boolean,
  hurt: boolean,
) {
  for (const name of ["cult-hem", "cult-stole"]) {
    const mesh = rig.body.getObjectByName(name) as T.Mesh | undefined;
    const rest = mesh && clothRest.get(mesh);
    if (!mesh || !rest) continue;
    const positions = mesh.geometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    const amplitude = walking ? 0.042 : hurt ? 0.026 : 0.009;
    for (let i = 0; i < positions.count; i++) {
      const x = rest.positions[i * 3],
        y = rest.positions[i * 3 + 1],
        z = rest.positions[i * 3 + 2];
      const weight = T.MathUtils.clamp(
        (rest.anchor - y) / (rest.anchor - rest.bottom),
        0,
        1,
      );
      // Delayed bottom folds trail the gait; the waist and shoulders stay sewn in place.
      const wave = time * (walking ? 5.8 : 1.8) + phase - weight * 1.5;
      positions.setXYZ(
        i,
        x + Math.sin(wave) * amplitude * weight * weight,
        y + Math.cos(wave * 2 + x * 8) * amplitude * 0.16 * weight,
        z + Math.sin(wave + x * 6) * amplitude * 0.55 * weight,
      );
    }
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  }
}

/** Two fixed-length arm segments solve to wrist contacts in torso space. */
function solveArm(arm: T.Group, wrist: T.Vector3, side: number) {
  const elbow = arm.getObjectByName("elbow")!,
    hand = arm.getObjectByName("hand")!;
  const upper = elbow.position,
    lower = hand.position;
  const delta = wrist.clone().sub(arm.position),
    distance = delta.length();
  const lengthA = upper.length(),
    lengthB = lower.length();
  const reach = Math.min(distance, lengthA + lengthB - 0.001);
  const direction = delta.normalize();
  const bend = v(side, -0.7, 0.1)
    .addScaledVector(direction, -v(side, -0.7, 0.1).dot(direction))
    .normalize();
  const along =
    (lengthA * lengthA - lengthB * lengthB + reach * reach) / (2 * reach);
  const elbowOffset = direction
    .clone()
    .multiplyScalar(along)
    .addScaledVector(
      bend,
      Math.sqrt(Math.max(0, lengthA * lengthA - along * along)),
    );
  arm.quaternion.setFromUnitVectors(
    upper.clone().normalize(),
    elbowOffset.clone().normalize(),
  );
  const lowerDirection = direction
    .multiplyScalar(reach)
    .sub(elbowOffset)
    .applyQuaternion(arm.quaternion.clone().invert())
    .normalize();
  elbow.quaternion.setFromUnitVectors(
    lower.clone().normalize(),
    lowerDirection,
  );
  return { elbow, hand };
}
function poseCultistArms(
  rig: Rig,
  attack: boolean,
  release: number,
  time: number,
  phase: number,
  hurt: boolean,
  dt: number,
) {
  const right = rig.arms[1],
    left = rig.arms[0];
  if (!right.visible || right.parent !== rig.body) return;
  const gun = right.getObjectByName("cult-firearm");
  if (!gun) return;
  const aim = T.MathUtils.lerp(
    rig.root.userData.aimBlend ?? 0,
    attack ? 1 : 0,
    1 - Math.exp(-dt * (attack ? 30 : 18)),
  );
  rig.root.userData.aimBlend = aim;
  const ready = (1 - aim) * 0.065;
  const breath = Math.sin(time * 1.8 + phase) * 0.003;
  const wrist = v(
    0.07,
    1.17 - ready + breath,
    -0.24 + release * 0.025 + (hurt ? 0.035 : 0),
  );
  const { elbow, hand } = solveArm(right, wrist, 1);
  const parentRotation = right.quaternion.clone().multiply(elbow.quaternion);
  // Counter-rotate the wrist: the gun stays aimed along local -Z, independent of elbow bend.
  const gunRotation = new T.Quaternion().setFromEuler(
    new T.Euler(-0.16 * (1 - aim), 0, 0),
  );
  gun.quaternion.copy(parentRotation.clone().invert().multiply(gunRotation));
  hand.quaternion.copy(parentRotation.clone().invert().multiply(gunRotation));
  if (left.visible && left.parent === rig.body) {
    const support = v(0, 0.025, -0.19).applyQuaternion(gunRotation).add(wrist);
    const solved = solveArm(left, support, -1);
    solved.hand.quaternion.copy(
      left.quaternion
        .clone()
        .multiply(solved.elbow.quaternion)
        .invert()
        .multiply(gunRotation),
    );
  }
}

function createCultist(): Rig {
  const root = new T.Group(),
    body = new T.Group(),
    head = new T.Group();
  root.name = "enemy-cultist";
  body.name = "torso";
  head.name = "head";
  root.add(body);
  body.add(head);
  head.position.set(0, 1.52, -0.015);
  // Cinched waist and broad shoulder mantle, with weighted cloth hanging below.
  const hem = foldedCloth(
    body,
    cultWool,
    [
      [1.48, 0.086, 0.092, 0],
      [1.43, 0.21, 0.14, 0],
      [1.35, 0.26, 0.16, 0],
      [1.2, 0.232, 0.167, 0],
      [1.02, 0.175, 0.14, 0],
      [0.89, 0.17, 0.135, 0],
      [0.76, 0.222, 0.15, 0],
      [0.57, 0.269, 0.17, 0],
      [0.33, 0.3, 0.186, 0],
    ],
    0.24,
  );
  foldedCloth(
    body,
    cultTrim,
    [
      [1.49, 0.09, 0.1, 0],
      [1.43, 0.22, 0.153, 0],
      [1.35, 0.281, 0.173, 0],
      [1.24, 0.25, 0.18, 0],
    ],
    0.32,
    0.042,
  );
  // Offset stole: draped front cloth carries the tarnished ritual seal.
  const stole = foldedCloth(
    body,
    cultTrim,
    [
      [1.4, 0.18, 0.173, -0.006],
      [1.2, 0.17, 0.18, -0.006],
      [0.96, 0.13, 0.157, -0.006],
      [0.72, 0.14, 0.17, -0.006],
    ],
    5.48,
    0.04,
  );
  stole.rotation.y = Math.PI + 0.13;
  registerCloth(hem, "cult-hem", 0.88, 0.33);
  registerCloth(stole, "cult-stole", 1.2, 0.72);
  foldedCloth(
    body,
    leather,
    [
      [0.94, 0.182, 0.15, 0],
      [0.88, 0.183, 0.15, 0],
    ],
    0,
    0.005,
  );
  const buckle = new T.Mesh(new T.TorusGeometry(0.026, 0.006, 4, 4), maskIron);
  buckle.position.set(0.055, 0.907, -0.155);
  buckle.rotation.z = Math.PI / 4;
  body.add(buckle);
  for (const x of [-0.13, 0.12])
    block(body, leather, [x, 0.84, -0.15], [0.066, 0.105, 0.05]);
  tube(
    body,
    [
      v(-0.08, 1.4, -0.15),
      v(-0.055, 1.26, -0.195),
      v(0.038, 1.17, -0.2),
      v(0.093, 1.38, -0.154),
    ],
    0.005,
    rust,
    12,
  );
  const seal = new T.Mesh(new T.CylinderGeometry(0.023, 0.023, 0.008, 6), rust);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0.023, 1.178, -0.204);
  body.add(seal);
  // Opaque cavity behind a faceted funerary mask. No eye spheres or exposed face.
  sculpt(head, mats.black, [
    [0.275, 0.012, 0.022, 0.018],
    [0.235, 0.085, 0.082, 0.018],
    [0.14, 0.109, 0.092, 0.012],
    [0.025, 0.078, 0.07, 0],
    [-0.035, 0.02, 0.032, 0],
  ]);
  foldedCloth(
    head,
    cultWool,
    [
      [0.315, 0.005, 0.01, 0.037],
      [0.29, 0.075, 0.08, 0.025],
      [0.245, 0.135, 0.137, 0.014],
      [0.16, 0.15, 0.15, 0.012],
      [0.055, 0.14, 0.157, 0.014],
      [-0.07, 0.155, 0.153, 0.025],
    ],
    1.32,
    0.033,
  );
  // Plate follows a narrow brow, cheek planes and pointed chin, with black slit
  // recessed under the folded hood. A center ridge catches the room's key light.
  const plate = new T.BufferGeometry();
  const p: number[] = [],
    uv: number[] = [],
    ids: number[] = [];
  const rows = [
    [0.214, 0.083, -0.122],
    [0.177, 0.08, -0.131],
    [0.151, 0.069, -0.139],
    [0.095, 0.074, -0.135],
    [0.036, 0.051, -0.127],
    [-0.002, 0.016, -0.108],
  ];
  rows.forEach(([y, w, z], r) => {
    for (let c = 0; c < 3; c++) {
      p.push((c - 1) * w, y, z - (c === 1 ? 0.019 : 0));
      uv.push(c / 2, r / 5);
    }
    if (r < rows.length - 1 && r !== 1)
      for (let c = 0; c < 2; c++) {
        const a = r * 3 + c;
        ids.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
  });
  plate.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  plate.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  plate.setIndex(ids);
  plate.computeVertexNormals();
  head.add(new T.Mesh(plate, maskIron));
  for (const x of [-0.027, 0, 0.027])
    block(head, mats.black, [x, 0.068, -0.147], [0.006, 0.033, 0.004]);
  const arms: T.Group[] = [],
    legs: T.Group[] = [];
  for (const [i, side] of [-1, 1].entries()) {
    const arm = new T.Group();
    arm.name = `arm-${i}`;
    arm.position.set(side * 0.24, 1.36, 0);
    body.add(arm);
    arms.push(arm);
    foldedCloth(
      arm,
      cultWool,
      [
        [0.036, 0.065, 0.071, 0],
        [0, 0.095, 0.1, 0],
        [-0.1, 0.087, 0.09, 0],
        [-0.23, 0.065, 0.067, -0.008],
        [-0.335, 0.06, 0.058, -0.018],
      ],
      0,
      0.07,
    );
    const elbow = new T.Group();
    elbow.name = "elbow";
    elbow.position.set(side * 0.022, -0.31, -0.018);
    arm.add(elbow);
    arm.userData.elbowName = "elbow";
    foldedCloth(
      elbow,
      cultWool,
      [
        [0.028, 0.061, 0.063, 0],
        [-0.06, 0.07, 0.07, -0.006],
        [-0.18, 0.059, 0.056, -0.02],
        [-0.275, 0.047, 0.045, -0.042],
      ],
      0,
      0.07,
    );
    foldedCloth(
      elbow,
      cultTrim,
      [
        [-0.226, 0.053, 0.05, -0.033],
        [-0.279, 0.051, 0.05, -0.042],
      ],
      0,
      0.015,
    );
    const hand = new T.Group();
    hand.name = "hand";
    hand.position.set(side * 0.012, -0.275, -0.047);
    elbow.add(hand);
    sculpt(hand, gloveHide, [
      [0.015, 0.027, 0.024, 0],
      [-0.025, 0.041, 0.029, 0],
      [-0.068, 0.039, 0.025, -0.004],
      [-0.081, 0.028, 0.017, -0.009],
    ]);
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.019;
      tube(
        hand,
        [
          v(x, -0.063, -0.006),
          v(x, -0.091, -0.022),
          v(x, -0.09, -0.047),
          v(x, -0.077, -0.05),
        ],
        0.0085,
        gloveHide,
        7,
      );
    }
    tube(
      hand,
      [
        v(side * 0.03, -0.025, -0.005),
        v(side * 0.051, -0.044, -0.027),
        v(side * 0.03, -0.064, -0.05),
      ],
      0.011,
      gloveHide,
      7,
    );
    if (i === 1) {
      const gun = new T.Group();
      gun.name = "cult-firearm";
      gun.position.copy(hand.position);
      const muzzle = new T.Object3D();
      muzzle.name = "muzzle";
      muzzle.position.set(0, 0.009, -0.5);
      gun.add(muzzle);
      gun.rotation.x = -1.22;
      elbow.add(gun);
      block(gun, iron, [0, -0.015, -0.13], [0.064, 0.084, 0.3]);
      boneBetween(gun, v(0, 0.009, -0.23), v(0, 0.009, -0.49), 0.022, iron);
      boneBetween(gun, v(0, 0.009, -0.45), v(0, 0.009, -0.496), 0.024, leather);
      block(gun, leather, [0, -0.066, 0.023], [0.057, 0.12, 0.068]).rotation.x =
        -0.2;
      block(gun, rust, [0, -0.105, -0.164], [0.042, 0.14, 0.065]).rotation.x =
        0.15;
      block(gun, iron, [0, 0.048, -0.29], [0.012, 0.022, 0.025]);
    }
    const leg = new T.Group();
    leg.name = `leg-${i}`;
    leg.position.set(side * 0.108, 0.79, 0);
    root.add(leg);
    legs.push(leg);
    foldedCloth(
      leg,
      cultWool,
      [
        [0.025, 0.085, 0.079, 0],
        [-0.1, 0.089, 0.088, 0],
        [-0.24, 0.065, 0.067, 0.014],
        [-0.375, 0.051, 0.052, 0.024],
      ],
      0,
      0.05,
    );
    const knee = new T.Group();
    knee.name = "knee";
    knee.position.set(side * 0.018, -0.365, 0.026);
    leg.add(knee);
    leg.userData.kneeName = "knee";
    sculpt(knee, leather, [
      [0.02, 0.052, 0.052, 0],
      [-0.09, 0.06, 0.059, 0],
      [-0.24, 0.038, 0.043, -0.033],
      [-0.34, 0.036, 0.039, -0.041],
    ]);
    const foot = new T.Group();
    foot.name = "ankle";
    foot.position.set(side * 0.004, -0.33, -0.041);
    knee.add(foot);
    leg.userData.ankleName = "ankle";
    sculpt(foot, gloveHide, [
      [0.055, 0.036, 0.042, 0],
      [0.008, 0.047, 0.067, -0.01],
      [-0.025, 0.065, 0.123, -0.048],
      [-0.07, 0.065, 0.128, -0.05],
    ]);
    sculpt(foot, leather, [
      [-0.069, 0.066, 0.129, -0.05],
      [-0.095, 0.066, 0.129, -0.05],
    ]);
    for (let j = 0; j < 3; j++)
      boneBetween(
        foot,
        v(-0.031, 0.018 - j * 0.015, -0.042 - j * 0.021),
        v(0.03, 0.013 - j * 0.015, -0.042 - j * 0.021),
        0.0035,
        cloth,
      );
  }
  const sac = oval(body, wound, [0, 1.07, 0], [0.02, 0.02, 0.02]);
  sac.visible = false;
  sac.name = "wound-sac";
  const groups: T.Group[] = [];
  root.traverse((o) => {
    if (o instanceof T.Group) groups.push(o);
  });
  groups.reverse().forEach((g) => batchRigid(g, [sac, hem, stole]));
  body.userData.restHeadY = 1.65;
  return { root, body, head, arms, legs, sac };
}

export function createEnemy(kind: EnemyKind): Rig {
  const rig = kind === "cultist" ? createCultist() : createAnatomicalEnemy(kind);
  installBlenderEnemy(rig, kind);
  return rig;
}

function createAnatomicalEnemy(kind: EnemyKind): Rig {
  const root = new T.Group(),
    body = new T.Group(),
    head = new T.Group();
  root.name = `enemy-${kind}`;
  body.name = "torso";
  head.name = "head";
  root.add(body);
  const brute = kind === "brute",
    carrier = kind === "spitter",
    cultist = kind === "cultist";
  const runner = kind === "runner";
  const skin = runner ? flayed : corpse;
  const shoulder = brute ? 0.36 : carrier ? 0.29 : 0.225;
  const chestDepth = brute ? 0.225 : 0.145;
  const headY = carrier ? 1.5 : 1.65;
  sculpt(body, skin, [
    [1.44, shoulder * 0.29, chestDepth * 0.6, 0],
    [1.38, shoulder * 0.86, chestDepth * 0.87, 0],
    [1.27, shoulder, chestDepth, 0],
    [1.12, shoulder * 0.89, chestDepth * 0.93, 0.012],
    [0.98, shoulder * 0.67, chestDepth * 0.74, 0.017],
    [0.88, shoulder * 0.73, chestDepth * 0.79, 0.009],
    [0.78, shoulder * 0.76, chestDepth * 0.78, 0],
    [0.7, shoulder * 0.38, chestDepth * 0.44, 0],
  ]);
  for (const side of [-1, 1]) {
    oval(
      body,
      skin,
      [side * shoulder * 0.44, 1.265, -chestDepth * 0.72],
      [shoulder * 0.43, 0.105, 0.059],
    );
    boneBetween(
      body,
      v(side * 0.044, 1.08, -chestDepth * 0.7),
      v(side * shoulder * 0.58, 0.91, -chestDepth * 0.61),
      0.023,
      skin,
    );
    if (runner)
      for (let i = 0; i < 4; i++)
        boneBetween(
          body,
          v(side * 0.027, 1.255 - i * 0.035, -chestDepth - 0.018),
          v(side * shoulder * 0.69, 1.22 - i * 0.035, -chestDepth * 0.86),
          0.008,
          mats.tendon,
        );
  }
  oval(body, wound, [0, 0.78, 0], [brute ? 0.26 : 0.185, 0.14, 0.145]);
  boneBetween(body, v(-shoulder, 1.37, 0), v(shoulder, 1.37, 0), 0.062, skin);
  boneBetween(
    body,
    v(0, 1.35, 0.018),
    v(0, headY - 0.09, carrier ? -0.18 : 0),
    0.067,
    skin,
  );
  for (let i = 0; i < 5; i++) {
    const y = 1.1 + i * 0.053,
      w = shoulder * (0.72 + Math.sin((i / 4) * Math.PI) * 0.18);
    if (!cultist)
      for (const side of [-1, 1]) {
        if (brute && side > 0) continue;
        tube(
          body,
          [
            v(side * 0.014, y, -chestDepth - 0.008),
            v(side * w * 0.72, y + 0.027, -chestDepth),
            v(side * w, y + 0.014, -0.06),
          ],
          0.012,
          runner ? mats.bone : mats.tendon,
          7,
        );
      }
    oval(
      body,
      mats.bone,
      [0, y + 0.09, chestDepth * 0.91],
      [0.027, 0.023, 0.024],
    );
  }
  for (const side of [-1, 1])
    boneBetween(
      body,
      v(side * 0.07, 0.89, -0.115),
      v(side * 0.12, 1.13, -0.145),
      0.016,
      mats.tendon,
    );
  head.position.set(0, headY, carrier ? -0.22 : -0.015);
  body.add(head);
  skull(head, skin, cultist);

  if (cultist) {
    garment(body, robe, 1.4, 0.27, 0.225, 0.13, 0.18, true);
    garment(head, robe, 0.16, -0.18, 0.139, 0.029, 0.14, true);
    oval(head, robe, [0, 0.14, 0.022], [0.145, 0.086, 0.137]);
    // Hood rim frames darkness without fantasy horns or emissive eyes.
    tube(
      head,
      [
        v(-0.123, -0.12, -0.119),
        v(-0.124, 0.095, -0.103),
        v(0, 0.195, -0.079),
        v(0.124, 0.095, -0.103),
        v(0.123, -0.12, -0.119),
      ],
      0.025,
      robe,
    );
    block(body, leather, [0, 0.89, -0.181], [0.43, 0.069, 0.029]);
    block(body, rust, [0, 1.23, -0.19], [0.045, 0.08, 0.013]);
    boneBetween(
      body,
      v(-0.021, 1.235, -0.201),
      v(0.025, 1.26, -0.201),
      0.008,
      iron,
    );
  } else if (kind === "shambler") {
    garment(body, cloth, 1.35, 0.83, 0.223, -0.034, 0.153, true);
    block(body, apron, [-0.11, 1.19, -0.164], [0.065, 0.11, 0.012]).rotation.z =
      -0.2;
  } else if (brute) {
    garment(body, leather, 0.85, 0.6, 0.27, 0.02, 0.19);
    // Folded hide bib wraps the torso, while its split hem hangs independently.
    garment(body, apron, 1.34, 0.69, 0.29, -0.065, 0.238, true);
    block(body, apron, [0, 1.075, -0.234], [0.39, 0.53, 0.019]);
    for (const x of [-0.14, 0.14])
      boneBetween(body, v(x, 1.38, -0.18), v(x, 1.2, -0.259), 0.024, apron);
    block(body, wound, [0.075, 0.91, -0.251], [0.19, 0.24, 0.009]).rotation.z =
      -0.17;
    block(body, wound, [-0.1, 1.16, -0.251], [0.12, 0.16, 0.009]).rotation.z =
      0.31;
    tube(
      head,
      [v(-0.12, 0.06, -0.078), v(0, 0.09, 0.124), v(0.12, 0.06, -0.078)],
      0.022,
      leather,
    );
  } else if (runner)
    garment(body, leather, 0.85, 0.68, 0.18, 0.009, 0.13, true);

  const arms: T.Group[] = [],
    legs: T.Group[] = [];
  for (const [i, side] of [-1, 1].entries()) {
    const arm = new T.Group();
    arm.name = `arm-${i}`;
    arm.position.set(side * shoulder, 1.36, 0);
    body.add(arm);
    arms.push(arm);
    const elbow = v(side * 0.065, -0.31, -0.018),
      wrist = v(side * 0.09, -0.585, -0.067);
    const sleeve = cultist
      ? robe
      : kind === "shambler" && i === 0
        ? cloth
        : skin;
    const muscle = brute ? 1.45 : runner ? 1.02 : 1;
    sculpt(
      arm,
      sleeve,
      [
        [0.035, 0.031, 0.031, 0],
        [0, 0.08 * muscle, 0.085 * muscle, 0],
        [-0.085, 0.077 * muscle, 0.073 * muscle, -0.004],
        [-0.195, 0.06 * muscle, 0.064 * muscle, -0.01],
        [-0.31, 0.044 * muscle, 0.043 * muscle, -0.018],
      ],
      side * 0.033,
    );
    oval(
      arm,
      skin,
      [elbow.x, elbow.y, elbow.z],
      [brute ? 0.09 : 0.055, 0.065, 0.059],
    );
    const forearm = new T.Group();
    forearm.name = "elbow";
    forearm.position.copy(elbow);
    arm.add(forearm);
    arm.userData.elbowName = forearm.name;
    sculpt(
      forearm,
      sleeve,
      [
        [0.008, 0.047 * muscle, 0.043 * muscle, 0],
        [-0.065, 0.059 * muscle, 0.056 * muscle, -0.012],
        [-0.15, 0.046 * muscle, 0.043 * muscle, -0.031],
        [-0.269, 0.029 * muscle, 0.027 * muscle, -0.047],
      ],
      side * 0.012,
    );
    if (!cultist)
      boneBetween(
        forearm,
        v(-0.018, -0.025, -0.04),
        wrist
          .clone()
          .sub(elbow)
          .add(v(-0.018, 0.02, -0.035)),
        0.012,
        mats.tendon,
      );
    const hand = new T.Group();
    hand.position.copy(wrist).sub(elbow);
    forearm.add(hand);
    sculpt(hand, skin, [
      [0.01, 0.023 * muscle, 0.025, 0],
      [-0.025, 0.041 * muscle, 0.027, 0],
      [-0.066, 0.04 * muscle, 0.021, -0.004],
      [-0.083, 0.029 * muscle, 0.017, -0.009],
    ]);
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.021 * muscle,
        length = 0.037 + Math.sin(((f + 1) / 5) * Math.PI) * 0.019;
      tube(
        hand,
        [
          v(x, -0.07, -0.008),
          v(x, -0.07 - length * 0.6, -0.015),
          v(x, -0.07 - length, -0.035),
        ],
        0.0085 * muscle,
        skin,
        5,
      );
      oval(hand, skin, [x, -0.069, -0.024], [0.011, 0.012, 0.008]);
      if (runner)
        spike(
          hand,
          v(x, -0.07 - length, -0.035),
          v(x, -0.081 - length, -0.061),
          0.006,
          mats.bone,
        );
    }
    tube(
      hand,
      [
        v(side * 0.031, -0.022, 0),
        v(side * 0.063, -0.049, -0.012),
        v(side * 0.054, -0.079, -0.03),
      ],
      0.011 * muscle,
      skin,
      5,
    );
    if (cultist) {
      garment(forearm, robe, 0.022, -0.12, 0.065, 0.015, 0.063);
      for (const yy of [-0.02, -0.05, -0.08])
        boneBetween(
          forearm,
          v(-0.049, yy, -0.056),
          v(0.045, yy + 0.013, -0.059),
          0.008,
          robe,
        );
    }
    batchRigid(hand);
    if (cultist && i === 1) {
      // Short, battered firearm with distinct receiver, barrel, grip and magazine.
      const gun = new T.Group();
      gun.position.copy(wrist).sub(elbow);
      gun.rotation.x = -1.22;
      forearm.add(gun);
      block(gun, iron, [0, -0.015, -0.13], [0.065, 0.095, 0.31]);
      boneBetween(gun, v(0, 0.011, -0.24), v(0, 0.011, -0.49), 0.026, iron);
      block(gun, leather, [0, -0.065, 0.024], [0.057, 0.135, 0.07]).rotation.x =
        -0.2;
      block(gun, rust, [0, -0.113, -0.165], [0.049, 0.155, 0.072]).rotation.x =
        0.15;
      block(gun, iron, [0, 0.048, -0.298], [0.018, 0.035, 0.032]);
    }
    if (brute && i === 1) {
      const cleaver = new T.Group();
      cleaver.position.copy(elbow).negate();
      forearm.add(cleaver);
      boneBetween(
        cleaver,
        v(wrist.x, -0.53, -0.068),
        v(wrist.x, -0.88, -0.068),
        0.028,
        leather,
      );
      block(
        cleaver,
        iron,
        [wrist.x + 0.105, -0.94, -0.068],
        [0.26, 0.29, 0.031],
      );
      block(
        cleaver,
        rust,
        [wrist.x + 0.105, -0.85, -0.087],
        [0.235, 0.094, 0.007],
      );
      block(
        cleaver,
        mats.bone,
        [wrist.x + 0.105, -1.078, -0.068],
        [0.255, 0.017, 0.027],
      );
    }
    const leg = new T.Group();
    leg.name = `leg-${i}`;
    leg.position.set(side * (brute ? 0.16 : 0.108), 0.79, 0);
    root.add(leg);
    legs.push(leg);
    const knee = v(side * 0.018, -0.365, 0.026),
      ankle = v(side * 0.022, -0.695, -0.015);
    const trouser = runner || carrier ? skin : cloth;
    sculpt(
      leg,
      trouser,
      [
        [0.018, 0.073 * muscle, 0.076 * muscle, 0],
        [-0.065, 0.098 * muscle, 0.091 * muscle, 0.005],
        [-0.165, 0.087 * muscle, 0.087 * muscle, 0.012],
        [-0.275, 0.057 * muscle, 0.063 * muscle, 0.02],
        [-0.365, 0.05 * muscle, 0.045 * muscle, 0.026],
      ],
      side * 0.012,
    );
    const shin = new T.Group();
    shin.name = "knee";
    shin.position.copy(knee);
    leg.add(shin);
    leg.userData.kneeName = shin.name;
    sculpt(
      shin,
      trouser,
      [
        [0.013, 0.05 * muscle, 0.045 * muscle, 0],
        [-0.068, 0.068 * muscle, 0.064 * muscle, 0.009],
        [-0.16, 0.058 * muscle, 0.048 * muscle, -0.013],
        [-0.275, 0.032 * muscle, 0.036 * muscle, -0.035],
        [-0.33, 0.032 * muscle, 0.035 * muscle, -0.041],
      ],
      side * 0.004,
    );
    oval(
      leg,
      runner ? mats.bone : skin,
      [knee.x, knee.y, -0.025],
      [0.039, 0.042, 0.025],
    );
    const foot = new T.Group();
    foot.name = "ankle";
    foot.position.copy(ankle).sub(knee);
    shin.add(foot);
    leg.userData.ankleName = foot.name;
    sculpt(foot, runner ? corpse : leather, [
      [0.08, 0.033 * muscle, 0.038, 0],
      [0.025, 0.047 * muscle, 0.059, -0.005],
      [-0.009, 0.067 * muscle, 0.117, -0.045],
      [-0.058, 0.069 * muscle, 0.13, -0.051],
      [-0.072, 0.062 * muscle, 0.122, -0.05],
    ]);
    sculpt(foot, leather, [
      [-0.07, 0.064 * muscle, 0.124, -0.05],
      [-0.095, 0.064 * muscle, 0.124, -0.05],
    ]);
    if (!runner)
      for (let j = 0; j < 4; j++)
        boneBetween(
          foot,
          v(-0.035, 0.036 - j * 0.014, -0.043 - j * 0.016),
          v(0.035, 0.036 - j * 0.014, -0.043 - j * 0.016),
          0.004,
          apron,
        );
    else
      for (let j = 0; j < 4; j++)
        oval(
          foot,
          corpse,
          [(j - 1.5) * 0.023, -0.046, -0.16],
          [0.014, 0.018, 0.025],
        );
  }
  const sac = oval(
    body,
    carrier ? bile : wound,
    [
      carrier ? 0.125 : -0.13,
      carrier ? 1.24 : 1.04,
      carrier ? 0.2 : -chestDepth,
    ],
    carrier ? [0.255, 0.305, 0.238] : [0.045, 0.09, 0.013],
  );
  sac.name = "wound-sac";
  if (carrier) {
    oval(body, corpse, [-0.1, 1.35, 0.16], [0.24, 0.25, 0.19]);
    for (let i = 0; i < 5; i++)
      oval(
        body,
        bile,
        [i % 2 ? 0.23 : -0.18, 0.97 + i * 0.095, 0.17],
        [0.064, 0.084, 0.075],
      );
    tube(
      body,
      [v(0.16, 1.38, 0.25), v(0.23, 1.46, 0.02), v(0.13, 1.4, -0.24)],
      0.026,
      mats.vein,
    );
    garment(body, cloth, 0.91, 0.65, 0.22, 0.015, 0.16, true);
  }
  // Place the head pivot at the neck while keeping the skull at its adult height.
  head.position.y -= 0.13;
  head.children.forEach((child) => (child.position.y += 0.13));
  // Merge each rigid part separately: severed limbs and head stay detachable.
  batchRigid(body, [sac]);
  batchRigid(head);
  [...arms, ...legs].forEach((limb) => {
    const groups: T.Object3D[] = [];
    limb.traverse((o) => {
      if (o instanceof T.Group) groups.push(o);
    });
    groups.reverse().forEach((g) => batchRigid(g));
  });
  if (brute) root.scale.setScalar(1.16);
  body.userData.restHeadY = headY;
  return { root, body, head, arms, legs, sac };
}

export function animateEnemy(
  rig: Rig,
  state: string,
  time: number,
  phase: number,
  kind: EnemyKind,
) {
  // Death and pin poses belong to the game's body physics, including all joints.
  if (state === "dead" || state === "pinned" || state === "pinning") return;
  const data = rig.root.userData;
  const dt = Math.min(0.05, Math.max(0, time - (data.animationTime ?? time)));
  if (data.animationState !== state) {
    if (data.animationState === "windup" && state !== "hurt")
      data.releaseTime = time;
    if (state === "hurt") delete data.releaseTime;
    data.animationState = state;
    data.stateTime = time;
  }
  data.animationTime = time;
  const age = time - (data.stateTime ?? time);
  const walking =
    typeof data.moving === "boolean"
      ? data.moving
      : state === "chase" || state === "walk";
  const attack =
    state === "windup" || state === "shooting" || state === "attack";
  const hurt = state === "hurt";
  const duration = data.windupDuration ?? ENEMIES[kind].windup;
  const armedCultist = kind === "cultist" && rig.arms[1].visible;
  // Raise, hold the readable anticipation pose, then commit in the final 75 ms.
  // The AI's windup/contact time stays unchanged; only the pose spacing changes.
  const strike =
    attack && !armedCultist
      ? T.MathUtils.smoothstep(age, duration - 0.075, duration)
      : 0;
  const charge = attack
    ? T.MathUtils.smoothstep(age / (duration * 0.38), 0, 1) * (1 - strike)
    : 0;
  const release = Math.max(
    strike,
    Math.max(0, 1 - (time - (data.releaseTime ?? -100)) / 0.14),
  );
  const settle =
    1 - Math.exp(-dt * (hurt ? 42 : release > 0 ? 55 : attack ? 26 : 18));
  const speed =
    kind === "runner"
      ? 11.5
      : kind === "shambler"
        ? 4
        : kind === "brute"
          ? 4.7
          : 5.8;
  const gait = time * speed + phase;
  const swing = Math.sin(gait),
    idle = Math.sin(time * 1.8 + phase);
  const hunch =
    kind === "spitter"
      ? -0.16
      : kind === "runner"
        ? -0.1
        : kind === "shambler"
          ? -0.045
          : -0.02;
  const ease = (current: number, target: number) =>
    T.MathUtils.lerp(current, target, settle);
  rig.body.position.y = ease(
    rig.body.position.y,
    idle * 0.009 + (walking ? Math.cos(gait * 2) * 0.019 : 0) - charge * 0.026,
  );
  rig.body.rotation.x = ease(
    rig.body.rotation.x,
    hurt ? 0.17 : hunch + charge * 0.07 - release * 0.14,
  );
  rig.body.rotation.y = ease(
    rig.body.rotation.y,
    walking ? swing * (kind === "runner" ? 0.08 : 0.035) : idle * 0.012,
  );
  rig.body.rotation.z = ease(
    rig.body.rotation.z,
    hurt
      ? Math.sin(phase) * 0.13
      : walking
        ? swing * (kind === "shambler" ? 0.065 : 0.032)
        : idle * 0.012,
  );
  rig.legs.forEach((leg, i) => {
    if (leg.parent !== rig.root || !leg.visible) return;
    const stride = Math.sin(gait + i * Math.PI);
    const limp = kind === "shambler" && i === 0 ? 0.5 : 1;
    const amplitude = kind === "runner" ? 0.66 : kind === "brute" ? 0.3 : 0.38;
    leg.rotation.x = ease(
      leg.rotation.x,
      walking ? stride * amplitude * limp : (i ? -0.035 : 0.035) * charge,
    );
    leg.rotation.z = ease(
      leg.rotation.z,
      (i ? -0.015 : 0.015) + (walking ? swing * 0.014 : 0),
    );
    const knee = leg.getObjectByName("knee");
    const ankle = leg.getObjectByName("ankle");
    // The trailing heel lifts as the knee folds, then extends for heel strike.
    if (knee)
      knee.rotation.x = ease(
        knee.rotation.x,
        walking
          ? -Math.max(0, -stride) * (kind === "runner" ? 1.08 : 0.63)
          : -0.035,
      );
    if (ankle)
      ankle.rotation.x = ease(
        ankle.rotation.x,
        walking ? Math.max(0, -stride) * 0.34 - Math.max(0, stride) * 0.12 : 0,
      );
  });
  rig.arms.forEach((arm, i) => {
    if (arm.parent !== rig.body || !arm.visible) return;
    const side = i ? 1 : -1;
    let x = walking
      ? swing * side * (kind === "runner" ? 0.48 : 0.25)
      : idle * 0.035;
    let z = -side * (kind === "brute" ? 0.16 : 0.07);
    let elbowX = 0.12 + (walking ? Math.max(0, side * swing) * 0.22 : 0);
    let y = 0;
    if (kind === "cultist" && rig.arms[1].visible) {
      x = i === 1 ? 1.07 + charge * 0.1 - release * 0.24 : 0.73;
      z = i === 1 ? -0.055 : -0.27;
      elbowX = i === 1 ? 0.13 : 0.66;
      y = i === 1 ? -0.03 : -0.35;
      if (walking) x += swing * 0.025;
    } else if (kind === "brute") {
      if (i === 1) {
        x += charge * 2.1 - release * 0.25;
        elbowX += charge * 0.65;
      } else {
        x += charge * 0.52;
        z += charge * 0.1;
      }
    } else if (kind === "spitter") {
      x += 0.13 + charge * 0.46;
      elbowX = 0.4 + charge * 0.57;
      z -= side * charge * 0.22;
    } else if (kind === "shambler") {
      x += 0.33 + charge * 0.8 - release * 0.14;
      elbowX += i === 0 ? 0.45 : 0.12;
      y += side * 0.1;
    } else {
      x += charge * (i === 1 ? 1.4 : 0.78) - release * 0.23;
      elbowX += charge * 0.68;
      z -= side * charge * 0.16;
    }
    if (hurt) {
      x -= 0.28;
      z -= side * 0.11;
    }
    arm.rotation.x = ease(arm.rotation.x, x);
    arm.rotation.y = ease(arm.rotation.y, y);
    arm.rotation.z = ease(arm.rotation.z, z);
    const elbow = arm.getObjectByName("elbow");
    if (elbow) elbow.rotation.x = ease(elbow.rotation.x, elbowX);
  });
  if (kind === "cultist") {
    animateCloth(rig, time, phase, walking, hurt);
    animateBlenderCloth(rig, time, phase, walking);
    poseCultistArms(rig, attack, release, time, phase, hurt, dt);
  }
  if (rig.head.parent === rig.body && rig.head.visible) {
    rig.head.rotation.x = ease(
      rig.head.rotation.x,
      hurt
        ? -0.14
        : -hunch * 0.7 - charge * 0.12 + release * 0.17 + idle * 0.025,
    );
    rig.head.rotation.y = ease(
      rig.head.rotation.y,
      !walking && !attack
        ? Math.sin(time * 0.57 + phase) * 0.12
        : -rig.body.rotation.y * 0.7,
    );
    rig.head.rotation.z = ease(
      rig.head.rotation.z,
      (kind === "shambler" ? 0.12 : 0) + idle * 0.025,
    );
  }
  if (kind === "spitter" && rig.sac.parent === rig.body) {
    rig.sac.scale.set(
      0.255 * (1 + idle * 0.03 + charge * 0.075),
      0.305 * (1 + charge * 0.12),
      0.238 * (1 + idle * 0.035 + charge * 0.08),
    );
  }
}
