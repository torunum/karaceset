import * as T from "three";
import type { Target } from "./combat";
import { batchRigid, boneBetween, mats, oval, tube } from "./art";

export interface Breakable extends Target {
  root: T.Group;
  propKind: "barrel" | "crate" | "urn";
  broken: boolean;
  damageVisual: T.Group;
  wreckage: T.Group;
}
export interface SceneryState {
  root: T.Group;
  props: Breakable[];
  update(time: number, dt: number): void;
  reset(): void;
}

// Small deterministic surface maps work in both WebGL and the node level tests.
function weatheredMap(kind: "stone" | "wood" | "iron") {
  const size = 128,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const noise = ((x * 1973 + y * 9277 + x * y * 11) & 255) / 255;
      const row = Math.floor(y / 32);
      const mortar = y % 32 < 2 || (x + (row % 2) * 32) % 64 < 2;
      const grain =
        kind === "stone"
          ? mortar
            ? 0.24
            : 0.62 + noise * 0.31 - Math.sin(x * 0.19 + y * 0.12) * 0.055
          : kind === "wood"
            ? 0.58 +
              noise * 0.1 +
              Math.sin(x * 0.09 + Math.sin(y * 0.023) * 0.7) * 0.08 +
              Math.sin(x * 0.27 + y * 0.004) * 0.025
            : 0.46 +
              noise * 0.4 -
              Math.max(0, Math.sin(x * 0.14 + y * 0.19)) * 0.16;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = grain * 255;
      data[i + 3] = 255;
    }
  const map = new T.DataTexture(data, size, size);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.needsUpdate = true;
  return map;
}
const stoneMap =
    typeof document === "undefined"
      ? weatheredMap("stone")
      : new T.TextureLoader().load("/textures/abbey-stone.png"),
  woodMap = weatheredMap("wood"),
  ironMap = weatheredMap("iron");
stoneMap.colorSpace = T.SRGBColorSpace;
stoneMap.wrapS = stoneMap.wrapT = T.RepeatWrapping;
stoneMap.anisotropy = 4;
export const sceneryMats = {
  stone: new T.MeshStandardMaterial({
    color: 0xc8c2b0,
    map: stoneMap,
    bumpMap: stoneMap,
    bumpScale: 0.025,
    roughness: 0.98,
  }),
  floor: new T.MeshStandardMaterial({
    color: 0x99968a,
    map: stoneMap,
    bumpMap: stoneMap,
    bumpScale: 0.065,
    roughness: 0.9,
  }),
  iron: new T.MeshStandardMaterial({
    color: 0x34352e,
    map: ironMap,
    metalness: 0.65,
    roughness: 0.82,
  }),
  rust: new T.MeshStandardMaterial({
    color: 0x704530,
    map: ironMap,
    metalness: 0.4,
    roughness: 0.92,
  }),
  wood: new T.MeshStandardMaterial({
    color: 0x746044,
    map: woodMap,
    bumpMap: woodMap,
    bumpScale: 0.03,
    roughness: 0.95,
  }),
  cloth: new T.MeshStandardMaterial({
    color: 0x452f29,
    map: woodMap,
    side: T.DoubleSide,
    roughness: 1,
  }),
  parchment: new T.MeshStandardMaterial({
    color: 0xa89670,
    map: ironMap,
    side: T.DoubleSide,
    roughness: 1,
  }),
  wax: new T.MeshStandardMaterial({ color: 0xd1b887, roughness: 0.9 }),
  ash: new T.MeshStandardMaterial({ color: 0x22221d, roughness: 1 }),
  sigil: new T.MeshStandardMaterial({
    color: 0x852c1c,
    emissive: 0x58160c,
    emissiveIntensity: 0.2,
    roughness: 0.92,
  }),
  flame: new T.MeshBasicMaterial({ color: 0xffb454 }),
};
const boxGeo = new T.BoxGeometry(1, 1, 1);
sceneryMats.stone.userData.environmentRole = 'stone';
sceneryMats.floor.userData.environmentRole = 'floor';
function box(
  parent: T.Object3D,
  material: T.Material,
  p: number[],
  s: number[],
  angle = 0,
) {
  const mesh = new T.Mesh(boxGeo, material);
  mesh.position.set(p[0], p[1], p[2]);
  mesh.scale.set(s[0], s[1], s[2]);
  mesh.rotation.y = angle;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: T.Object3D,
  mat: T.Material,
  r1: number,
  r2: number,
  h: number,
  x: number,
  y: number,
  z: number,
  sides = 12,
) {
  const mesh = new T.Mesh(new T.CylinderGeometry(r1, r2, h, sides), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function ring(
  parent: T.Object3D,
  radius: number,
  thickness: number,
  mat: T.Material,
  p: number[],
  horizontal = true,
) {
  const mesh = new T.Mesh(new T.TorusGeometry(radius, thickness, 5, 24), mat);
  mesh.position.set(p[0], p[1], p[2]);
  if (horizontal) mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}
function segment(
  parent: T.Object3D,
  a: number[],
  b: number[],
  radius: number,
  mat: T.Material,
) {
  return boneBetween(
    parent,
    new T.Vector3(...a),
    new T.Vector3(...b),
    radius,
    mat,
  );
}

/** A painted inverted pentagram, also used as the cult's barrel warning mark. */
function sigil(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  radius: number,
  vertical = false,
) {
  const g = new T.Group();
  g.position.set(x, y, z);
  if (vertical) g.rotation.x = Math.PI / 2;
  parent.add(g);
  ring(g, radius, 0.018, sceneryMats.sigil, [0, 0, 0]);
  const points = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    return [Math.cos(a) * radius * 0.89, 0, Math.sin(a) * radius * 0.89];
  });
  for (let i = 0; i < 5; i++)
    segment(g, points[i], points[(i + 2) % 5], 0.018, sceneryMats.sigil);
  return g;
}
function skull(parent: T.Object3D, x: number, y: number, z: number, angle = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.rotation.y = angle;
  parent.add(g);
  oval(g, mats.bone, [0, 0.13, 0], [0.16, 0.18, 0.15]);
  oval(g, mats.bone, [0, -0.005, -0.045], [0.13, 0.06, 0.12]);
  for (const side of [-1, 1])
    oval(
      g,
      sceneryMats.ash,
      [side * 0.065, 0.15, -0.126],
      [0.051, 0.057, 0.027],
    );
  oval(g, sceneryMats.ash, [0, 0.065, -0.152], [0.028, 0.04, 0.015]);
  for (let i = 0; i < 5; i++)
    box(g, mats.bone, [(i - 2) * 0.033, 0.014, -0.139], [0.023, 0.042, 0.026]);
}

/** Reuse prebuilt damage meshes: repeated hits never allocate lasting debris. */
export function updateBreakableDamage(prop: Breakable) {
  const destroyed = prop.broken || prop.hp <= 0;
  prop.damageVisual.visible =
    !destroyed && prop.hp <= (prop.propKind === "barrel" ? 30 : 20);
  prop.root.visible = !destroyed;
  prop.wreckage.visible = destroyed;
  prop.root.userData.damageWobble = destroyed ? 0 : 0.3;
}

function damagedSurfaces(kind: Breakable["propKind"]) {
  const damage = new T.Group();
  damage.name = `${kind}-damage`;
  for (let side = 0; side < 4; side++) {
    const face = new T.Group();
    face.rotation.y = (side * Math.PI) / 2;
    damage.add(face);
    if (kind === "crate") {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.17;
        segment(
          face,
          [x, 0.27, 0.461],
          [x + 0.036, 0.56, 0.461],
          0.012,
          sceneryMats.ash,
        );
        segment(
          face,
          [x + 0.036, 0.56, 0.461],
          [x - 0.019, 0.76, 0.461],
          0.009,
          sceneryMats.ash,
        );
        const splinter = box(
          face,
          sceneryMats.wood,
          [x + 0.05, 0.58, 0.485],
          [0.034, 0.23, 0.024],
        );
        splinter.rotation.x = -0.48;
        splinter.rotation.z = 0.17 * (i - 1);
      }
    } else if (kind === "barrel") {
      oval(face, sceneryMats.ash, [0.035, 0.6, 0.407], [0.09, 0.15, 0.012]);
      const bent = box(
        face,
        sceneryMats.rust,
        [0.08, 0.66, 0.445],
        [0.1, 0.16, 0.018],
      );
      bent.rotation.y = -0.65;
      bent.rotation.z = 0.35;
      segment(
        face,
        [-0.1, 0.79, 0.401],
        [0.065, 0.85, 0.401],
        0.011,
        sceneryMats.ash,
      );
    } else {
      const points = [
        [-0.09, 0.29, 0.317],
        [0.018, 0.38, 0.368],
        [-0.024, 0.53, 0.385],
        [0.073, 0.65, 0.354],
        [0.055, 0.73, 0.312],
      ];
      for (let i = 1; i < points.length; i++)
        segment(face, points[i - 1], points[i], 0.009, sceneryMats.ash);
      segment(face, points[2], [-0.14, 0.59, 0.347], 0.007, sceneryMats.ash);
    }
  }
  batchRigid(damage);
  damage.visible = false;
  return damage;
}

function brokenRemains(kind: Breakable["propKind"]) {
  const wreckage = new T.Group();
  wreckage.name = `${kind}-wreckage`;
  for (let i = 0; i < (kind === "crate" ? 9 : 7); i++) {
    const angle = i * 2.39996;
    const distance = 0.17 + (i % 3) * 0.19;
    let piece: T.Mesh;
    if (kind === "crate") {
      const shape = new T.Shape();
      shape.moveTo(-0.075, -0.24);
      shape.lineTo(0.07, -0.27);
      shape.lineTo(0.075, 0.15);
      shape.lineTo(0.028, 0.25);
      shape.lineTo(0.015, 0.18);
      shape.lineTo(-0.04, 0.31);
      shape.lineTo(-0.075, 0.2);
      shape.closePath();
      piece = new T.Mesh(
        new T.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false }),
        sceneryMats.wood,
      );
      piece.rotation.x = -Math.PI / 2 + (i % 3) * 0.13;
    } else if (kind === "urn") {
      piece = new T.Mesh(
        new T.LatheGeometry(
          [
            new T.Vector2(0.21, 0),
            new T.Vector2(0.35, 0.14),
            new T.Vector2(0.37, 0.32),
            new T.Vector2(0.34, 0.32),
            new T.Vector2(0.32, 0.14),
            new T.Vector2(0.19, 0),
          ],
          5,
          0,
          0.6 + (i % 2) * 0.2,
        ),
        sceneryMats.stone,
      );
      piece.rotation.set(0.65 + (i % 3) * 0.44, angle, 0.5);
    } else {
      const shape = new T.Shape();
      shape.moveTo(-0.16, -0.2);
      shape.lineTo(0.14, -0.16);
      shape.lineTo(0.2, 0.08);
      shape.lineTo(0.085, 0.22);
      shape.lineTo(0.015, 0.12);
      shape.lineTo(-0.08, 0.26);
      shape.lineTo(-0.13, 0.07);
      shape.closePath();
      const geometry = new T.ExtrudeGeometry(shape, {
        depth: 0.012,
        bevelEnabled: false,
      });
      const positions = geometry.attributes.position;
      for (let j = 0; j < positions.count; j++)
        positions.setZ(
          j,
          positions.getZ(j) + Math.pow(positions.getX(j), 2) * 2.6,
        );
      geometry.computeVertexNormals();
      piece = new T.Mesh(geometry, sceneryMats.rust);
      piece.rotation.x = -Math.PI / 2 + (i % 3) * 0.38;
    }
    piece.rotation.y += angle;
    piece.position.set(
      Math.sin(angle) * distance,
      0,
      Math.cos(angle) * distance,
    );
    wreckage.add(piece);
    piece.updateMatrixWorld(true);
    piece.position.y = 0.012 - new T.Box3().setFromObject(piece).min.y;
  }
  if (kind === "barrel") {
    const rim = ring(wreckage, 0.39, 0.028, sceneryMats.iron, [0, 0.04, 0]);
    rim.scale.x = 0.7;
  }
  batchRigid(wreckage);
  wreckage.visible = false;
  return wreckage;
}
function makeBreakable(
  kind: Breakable["propKind"],
  x: number,
  z: number,
  angle: number,
): Breakable {
  const root = new T.Group();
  root.position.set(x, 0, z);
  root.rotation.y = angle;
  if (kind === "barrel") {
    // Riveted, corroded drum with rolled rims, recessed lid, bung and warning seal.
    cylinder(root, sceneryMats.rust, 0.4, 0.4, 1.13, 0, 0.585, 0, 16);
    for (const y of [0.1, 0.38, 0.81, 1.1])
      ring(root, 0.402, 0.032, sceneryMats.iron, [0, y, 0]);
    cylinder(root, sceneryMats.iron, 0.382, 0.382, 0.035, 0, 1.155, 0, 16);
    cylinder(root, sceneryMats.rust, 0.064, 0.064, 0.035, 0.18, 1.188, 0.11, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      oval(
        root,
        sceneryMats.iron,
        [Math.sin(a) * 0.407, 0.81, Math.cos(a) * 0.407],
        [0.025, 0.025, 0.025],
      );
    }
    box(root, sceneryMats.parchment, [0, 0.61, 0.405], [0.4, 0.44, 0.009]);
    sigil(root, 0, 0.61, 0.418, 0.17, true);
    tube(
      root,
      [
        new T.Vector3(0.17, 1.2, 0.1),
        new T.Vector3(0.23, 1.17, 0.31),
        new T.Vector3(0.32, 1.06, 0.31),
      ],
      0.016,
      mats.vein,
      6,
    );
  } else if (kind === "crate") {
    // Individual splintered planks, timber framing, diagonal bracing and nail heads.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        box(
          root,
          sceneryMats.wood,
          [(i - 2) * 0.174, 0.5, side * 0.425],
          [0.164, 0.84 - (i % 2) * 0.026, 0.062],
        );
        box(
          root,
          sceneryMats.wood,
          [side * 0.425, 0.5, (i - 2) * 0.174],
          [0.062, 0.84, 0.164],
        );
      }
      for (const y of [0.15, 0.84]) {
        box(root, sceneryMats.wood, [0, y, side * 0.474], [0.99, 0.105, 0.07]);
        box(root, sceneryMats.iron, [side * 0.455, y, 0], [0.027, 0.057, 0.91]);
      }
      const brace = box(
        root,
        sceneryMats.wood,
        [0, 0.5, side * 0.484],
        [0.105, 1.06, 0.065],
      );
      brace.rotation.z = side * 0.74;
      for (const x of [-0.39, 0.39])
        for (const y of [0.15, 0.84])
          oval(
            root,
            sceneryMats.iron,
            [x, y, side * 0.515],
            [0.02, 0.02, 0.015],
          );
    }
    for (let i = 0; i < 5; i++)
      box(
        root,
        sceneryMats.wood,
        [(i - 2) * 0.174, 0.956, 0],
        [0.164, 0.065, 0.85],
      );
    box(
      root,
      sceneryMats.parchment,
      [0.17, 0.55, 0.524],
      [0.18, 0.23, 0.012],
      0.08,
    );
    sigil(root, 0.17, 0.55, 0.538, 0.07, true);
  } else {
    // Hollow funerary vessel: shaped foot, shoulder, narrow neck and iron handles.
    const profile = [
      [0.14, 0],
      [0.25, 0.06],
      [0.22, 0.14],
      [0.37, 0.35],
      [0.38, 0.56],
      [0.3, 0.74],
      [0.18, 0.82],
      [0.18, 0.98],
      [0.23, 1.02],
      [0.23, 1.06],
      [0.15, 1.06],
      [0.14, 0.98],
      [0.14, 0.82],
    ];
    const urn = new T.Mesh(
      new T.LatheGeometry(
        profile.map((p) => new T.Vector2(p[0], p[1])),
        14,
      ),
      sceneryMats.stone,
    );
    root.add(urn);
    ring(root, 0.215, 0.03, sceneryMats.rust, [0, 1.04, 0]);
    for (const side of [-1, 1]) {
      const handle = ring(
        root,
        0.14,
        0.025,
        sceneryMats.iron,
        [side * 0.36, 0.67, 0],
        false,
      );
      handle.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      segment(
        root,
        [Math.sin(a) * 0.35, 0.29, Math.cos(a) * 0.35],
        [Math.sin(a) * 0.36, 0.65, Math.cos(a) * 0.36],
        0.014,
        sceneryMats.rust,
      );
    }
    sigil(root, 0, 0.5, 0.386, 0.15, true);
  }
  batchRigid(root);
  const damageVisual = damagedSurfaces(kind),
    wreckage = brokenRemains(kind);
  root.add(damageVisual);
  root.userData.damageWobble = 0;
  wreckage.position.copy(root.position);
  wreckage.rotation.y = angle;
  root.name = `breakable-${kind}`;
  return {
    root,
    damageVisual,
    wreckage,
    propKind: kind,
    broken: false,
    hp: kind === "barrel" ? 60 : 40,
    radius: kind === "crate" ? 0.56 : 0.46,
    position: new T.Vector3(x, 0.6, z),
    state: "idle",
  };
}

export function createScenery(testroom = false, organicProps?: [Breakable["propKind"],number,number][]): SceneryState {
  const root = new T.Group(),
    architecture = new T.Group(),
    flames: T.Mesh[] = [],
    banners: T.Group[] = [];
  root.name = "desecrated-abbey";
  root.add(architecture);
  const props: Breakable[] = [];
  const candle = (
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    h = 0.28,
  ) => {
    cylinder(parent, sceneryMats.iron, 0.1, 0.12, 0.035, x, y + 0.018, z, 8);
    cylinder(
      parent,
      sceneryMats.wax,
      0.045,
      0.06,
      h,
      x,
      y + h / 2 + 0.035,
      z,
      8,
    );
    for (let i = 0; i < 3; i++)
      cylinder(
        parent,
        sceneryMats.wax,
        0.012,
        0.019,
        h * 0.35,
        x + Math.cos(i * 2) * 0.045,
        y + h * 0.68,
        z + Math.sin(i * 2) * 0.045,
        5,
      );
    // Flames are kept out of the static geometry batch so that they can flicker.
    const flame = oval(
      parent,
      sceneryMats.flame,
      [x, y + h + 0.105, z],
      [0.031, 0.078, 0.025],
    );
    flame.updateWorldMatrix(true, false);
    const world = flame.getWorldPosition(new T.Vector3());
    parent.remove(flame);
    root.add(flame);
    flame.position.copy(world);
    flames.push(flame);
  };
  const chain = (x: number, z: number, length: number, hook = false) => {
    const count = Math.floor(length / 0.15);
    for (let i = 0; i < count; i++) {
      const link = ring(
        architecture,
        0.063,
        0.015,
        i % 4 === 0 ? sceneryMats.rust : sceneryMats.iron,
        [x, 5.66 - i * 0.15, z],
        false,
      );
      link.scale.y = 1.4;
      link.rotation.y = ((i % 2) * Math.PI) / 2;
    }
    if (hook)
      tube(
        architecture,
        [
          new T.Vector3(x, 5.7 - length, z),
          new T.Vector3(x + 0.13, 5.4 - length, z),
          new T.Vector3(x + 0.27, 5.45 - length, z),
          new T.Vector3(x + 0.26, 5.66 - length, z),
        ],
        0.037,
        sceneryMats.rust,
        12,
      );
  };
  const banner = (x: number, z: number, angle: number) => {
    const g = new T.Group();
    g.position.set(x, 4.9, z);
    g.rotation.y = angle;
    root.add(g);
    banners.push(g);
    segment(g, [-0.67, 0.12, 0], [0.67, 0.12, 0], 0.045, sceneryMats.iron);
    const outline = new T.Shape();
    outline.moveTo(-0.53, 0);
    outline.lineTo(0.53, 0);
    outline.lineTo(0.46, -1.97);
    outline.lineTo(0.31, -1.76);
    outline.lineTo(0.21, -2.28);
    outline.lineTo(0.02, -1.97);
    outline.lineTo(-0.12, -2.17);
    outline.lineTo(-0.23, -1.64);
    outline.lineTo(-0.4, -2.1);
    outline.lineTo(-0.53, -1.88);
    outline.closePath();
    g.add(new T.Mesh(new T.ShapeGeometry(outline), sceneryMats.cloth));
    sigil(g, 0, -0.75, 0.018, 0.34, true);
    for (const x of [-0.46, 0.46])
      ring(g, 0.063, 0.013, sceneryMats.rust, [x, 0.06, 0], false);
    batchRigid(g);
  };
  const altar = (x: number, z: number, angle: number) => {
    const g = new T.Group();
    g.name = "blender-altar-slot";
    g.userData.blenderSlot = true;
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    architecture.add(g);
    box(g, sceneryMats.stone, [0, 0.11, 0], [2.75, 0.22, 1.3]);
    for (const x of [-0.88, 0.88]) {
      box(g, sceneryMats.stone, [x, 0.54, 0], [0.48, 0.78, 0.8]);
      box(g, sceneryMats.iron, [x, 0.34, 0], [0.53, 0.09, 0.85]);
    }
    box(g, sceneryMats.stone, [0, 1.02, 0], [2.6, 0.25, 1.08]);
    box(g, sceneryMats.cloth, [0, 1.156, 0.05], [0.72, 0.017, 1.08]);
    box(g, sceneryMats.cloth, [0, 0.83, 0.59], [0.72, 0.65, 0.02]);
    sigil(g, 0, 0.83, 0.612, 0.22, true);
    skull(g, -0.28, 1.23, -0.05, -0.23);
    for (const x of [-1.01, -0.72, 0.72, 1.01])
      candle(
        g,
        x,
        1.16,
        Math.abs(x) > 0.8 ? -0.22 : 0.15,
        0.2 + Math.abs(x) * 0.15,
      );
    const page = box(
      g,
      sceneryMats.parchment,
      [0.26, 1.19, 0.15],
      [0.4, 0.025, 0.38],
      -0.18,
    );
    page.rotation.z = -0.08;
    for (let i = 0; i < 4; i++)
      box(
        g,
        sceneryMats.ash,
        [0.26, 1.217, 0.04 + i * 0.07],
        [0.23 - i * 0.015, 0.008, 0.013],
        -0.18,
      );
  };
  const pier = (x: number, z: number, height: number) => {
    box(architecture, sceneryMats.stone, [x, 0.16, z], [0.95, 0.32, 1]);
    for (let i = 0; i < Math.floor(height / 0.52); i++)
      box(
        architecture,
        sceneryMats.stone,
        [x + (i % 2) * 0.025, 0.55 + i * 0.52, z],
        [0.67 + (i % 3 === 0 ? 0.07 : 0), 0.49, 0.74],
        (i % 2 ? 1 : -1) * 0.018,
      );
    box(
      architecture,
      sceneryMats.stone,
      [x, height, z],
      [0.88, 0.21, 0.94],
      0.05,
    );
    for (const y of [1.04, 2.65])
      if (y < height)
        box(architecture, sceneryMats.iron, [x, y, z], [0.76, 0.074, 0.8]);
  };
  // These positions are in wide rooms or against walls, never at corridor necks.
  const propSpecs: [Breakable["propKind"], number, number][] = organicProps ?? (testroom
    ? [
        ["crate", -2.6, 4],
        ["barrel", 3, -1],
        ["urn", -4, -1],
      ]
    : [
        ["crate", -2.6, 4.6],
        ["urn", 2.8, 1.6],
        ["barrel", 4, -31.6],
        ["crate", 15, -33],
        ["urn", 0, -39.5],
        ["barrel", 13.5, -39],
        ["urn", 28.4, -45.2],
        ["crate", 24.5, -50.2],
        ["crate", 3.3, -58],
        ["urn", 10.7, -56.8],
        ["barrel", -2, -78],
        ["barrel", 13, -86],
        ["crate", -3, -89],
        ["urn", 15.7, -82.2],
        ["crate", 3, -89.8],
        ["urn", 8.8, -102],
      ]);
  propSpecs.forEach(([kind, x, z], i) => {
    const prop = makeBreakable(kind, x, z, Math.sin(i * 8.4) * 0.4);
    root.add(prop.root, prop.wreckage);
    props.push(prop);
  });
  const rooms = organicProps ? [] : testroom
    ? [[0, 0, 5.8]]
    : [
        [0, 3, 4.7],
        [8, -36, 8.1],
        [6, -83, 11.6],
      ];
  for (const [x, z, radius] of rooms) {
    for (const side of [-1, 1]) {
      pier(x + side * radius, z, side === -1 ? 3.35 : 4.25);
      pier(x + side * radius * 0.86, z - 4.3, 3.8);
      // Survivors of Gothic vaulting embedded in the living ceiling.
      tube(
        architecture,
        [
          new T.Vector3(x + side * radius, 3.5, z),
          new T.Vector3(x + side * radius * 0.83, 4.6, z),
          new T.Vector3(x + side * 0.9, 5.58, z),
        ],
        0.22,
        sceneryMats.stone,
        12,
      );
      banner(x + side * radius * 0.89, z + 1.5, side * 0.5);
      chain(x + side * radius * 0.64, z - 2, 2.1, true);
      // Dislodged blocks and old remains around pillar feet, below movement sightlines.
      for (let i = 0; i < 4; i++) {
        box(
          architecture,
          sceneryMats.stone,
          [
            x + side * (radius - 0.28 - i * 0.19),
            0.1 + (i % 2) * 0.055,
            z + 0.7 + i * 0.19,
          ],
          [0.32, 0.21, 0.26],
          i * 1.4,
        );
        segment(
          architecture,
          [x + side * (radius - 0.6), 0.095, z + 0.5 + i * 0.23],
          [x + side * (radius - 0.97), 0.09, z + 0.65 + i * 0.23],
          0.033,
          mats.bone,
        );
      }
      skull(architecture, x + side * (radius - 0.6), 0.17, z + 1.2, side * 0.9);
      for (let i = 0; i < 3; i++)
        candle(
          architecture,
          x + side * (radius - 0.57) + i * 0.17,
          0.02,
          z - 0.8 + i * 0.15,
          0.18 + i * 0.09,
        );
    }
    sigil(architecture, x, 0.036, z - 1.7, radius * 0.3);
    ring(architecture, radius * 0.3 + 0.19, 0.012, sceneryMats.ash, [
      x,
      0.037,
      z - 1.7,
    ]);
  }
  if (!testroom && !organicProps) {
    altar(-0.2, 8.35, Math.PI);
    altar(-0.1, -33, Math.PI / 2);
    altar(-4.5, -82.5, Math.PI / 2);
    // Rusting slaughter rails and chained hooks in the side meatworks.
    segment(
      architecture,
      [23.6, 4.8, -43],
      [27.5, 4.8, -50],
      0.1,
      sceneryMats.iron,
    );
    for (let i = 0; i < 4; i++)
      chain(24 + i * 0.8, -44 - i * 1.35, 2.5 + (i % 2) * 0.3, true);
    banner(27.9, -48, -0.7);
    sigil(architecture, 26, 0.038, -47, 1.12);
    // Candle niches and parchment scraps offer warm landmarks between halls.
    for (const [x, z] of [
      [1.8, -9],
      [-2.5, -18],
      [5, -25],
      [3.9, -52],
      [9.9, -58],
      [7.9, -100],
    ]) {
      box(
        architecture,
        sceneryMats.stone,
        [x, 0.23, z],
        [0.38, 0.46, 0.43],
        0.18,
      );
      candle(architecture, x, 0.47, z, 0.38);
      const paper = box(
        architecture,
        sceneryMats.parchment,
        [x - 0.24, 0.025, z + 0.3],
        [0.27, 0.01, 0.37],
        0.67,
      );
      paper.rotation.x = 0.018;
    }
  } else if (!organicProps) altar(0, -7.7, 0);

  // Flatten static scenery only. Breakable parents and flames stay individually addressable.
  architecture.updateMatrixWorld(true);
  const staticMeshes: T.Mesh[] = [];
  architecture.traverse((o) => {
    if (o instanceof T.Mesh) {
      let parent = o.parent;
      while (parent && parent !== architecture) {
        if (parent.userData.blenderSlot) return;
        parent = parent.parent;
      }
      staticMeshes.push(o);
    }
  });
  for (const mesh of staticMeshes) {
    mesh.geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    architecture.add(mesh);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
  }
  for (const child of [...architecture.children])
    if (!(child instanceof T.Mesh) && !child.userData.blenderSlot)
      architecture.remove(child);
  batchRigid(architecture);
  const originals = props.map((p) => ({
    position: p.position.clone(),
    rotation: p.root.rotation.clone(),
    hp: p.hp,
  }));
  return {
    root,
    props,
    update(time: number, dt: number) {
      props.forEach((p) => {
        const remaining = Math.max(
          0,
          (p.root.userData.damageWobble as number) - dt,
        );
        p.root.userData.damageWobble = remaining;
        p.root.rotation.z = Math.sin((0.3 - remaining) * 45) * remaining * 0.12;
        p.root.rotation.x = Math.sin((0.3 - remaining) * 36) * remaining * 0.07;
        p.wreckage.visible = p.broken || p.hp <= 0;
      });
      flames.forEach((f, i) => {
        f.scale.y =
          0.078 *
          (1 +
            Math.sin(time * 11 + i * 2.3) * 0.17 +
            Math.sin(time * 19 + i) * 0.08);
      });
      banners.forEach((b, i) => {
        b.rotation.z = Math.sin(time * 0.6 + i) * 0.012;
      });
    },
    reset() {
      props.forEach((p, i) => {
        p.broken = false;
        p.root.visible = true;
        p.hp = originals[i].hp;
        p.state = "idle";
        p.position.copy(originals[i].position);
        p.root.position.set(p.position.x, 0, p.position.z);
        p.root.rotation.copy(originals[i].rotation);
        p.root.scale.setScalar(1);
        p.root.userData.damageWobble = 0;
        p.damageVisual.visible = false;
        p.wreckage.visible = false;
      });
    },
  };
}
