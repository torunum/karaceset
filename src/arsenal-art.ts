import * as T from "three";
import { oval, tube, batchRigid } from "./art";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// These surfaces are generated locally: directional wood grain, pitted iron and hide.
function surface(
  color: number,
  kind: "wood" | "metal" | "hide",
  roughness: number,
  metalness = 0,
) {
  const size = kind === "wood" ? 256 : 128,
    pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const noise =
        Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      // Fine longitudinal fibres, with broad wandering growth bands. No UV checker grain.
      const flow =
        x * 0.18 + Math.sin(y * 0.013) * 1.7 + Math.sin(y * 0.039) * 0.27;
      const grain =
        kind === "wood" ? Math.pow((Math.sin(flow) + 1) * 0.5, 9) : noise;
      const c =
        kind === "wood"
          ? 220 + noise * 9 - grain * 23 - Math.sin(flow * 0.31) * 9
          : kind === "metal"
            ? 226 + noise * 19
            : 199 + noise * 31;
      const i = (y * size + x) * 4;
      pixels[i] = c;
      pixels[i + 1] = c;
      pixels[i + 2] = c;
      pixels[i + 3] = 255;
    }
  const map = new T.DataTexture(pixels, size, size);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 8;
  map.needsUpdate = true;
  return new T.MeshStandardMaterial({
    color,
    map,
    bumpMap: map,
    bumpScale: kind === "metal" ? 0.00035 : kind === "wood" ? 0.0012 : 0.0018,
    roughness,
    metalness,
  });
}
const iron = surface(0x66717a, "metal", 0.54, 0.35);
const edge = surface(0x85867b, "metal", 0.44, 0.8);
const rust = surface(0x784329, "metal", 0.92, 0.18);
const brass = surface(0xa48b54, "metal", 0.45, 0.7);
const wood = surface(0x543525, "wood", 0.67);
const bluedSteel = surface(0x27333e, "metal", 0.38, 0.82);
const wornSteel = surface(0x59616a, "metal", 0.48, 0.77);
const gunWalnut = surface(0x573221, "wood", 0.56);
const gloveLeather = surface(0x39362f, "hide", 0.79);
const coatCloth = surface(0x43443a, "hide", 0.96);
const hide = surface(0x60554b, "hide", 0.88);
const seam = surface(0x83715a, "hide", 0.89);
const rubber = surface(0x181916, "hide", 0.97);
const black = new T.MeshStandardMaterial({ color: 0x070b09, roughness: 1 });
const skin = surface(0x727848, "hide", 0.5);
const lesion = surface(0x492e44, "hide", 0.4);
const sinew = surface(0xa4946d, "hide", 0.5);
const bile = new T.MeshStandardMaterial({
  color: 0xa9cb38,
  emissive: 0x507b0d,
  emissiveIntensity: 0.8,
  roughness: 0.25,
});
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
function box(parent: T.Object3D, mat: T.Material, p: number[], s: number[]) {
  const m = new T.Mesh(
    new RoundedBoxGeometry(s[0], s[1], s[2], 2, Math.min(...s) * 0.18),
    mat,
  );
  // RoundedBoxGeometry is non-indexed; normalize for the rigid mesh merger.
  if (!m.geometry.index)
    m.geometry.setIndex(
      Array.from(
        { length: m.geometry.getAttribute("position").count },
        (_, i) => i,
      ),
    );
  m.position.set(...(p as [number, number, number]));
  parent.add(m);
  return m;
}
function pipe(
  parent: T.Object3D,
  mat: T.Material,
  x: number,
  y: number,
  z: number,
  radius: number,
  length: number,
  inner = 0,
) {
  const m = new T.Mesh(
    new T.CylinderGeometry(radius, radius, length, 16, 1, inner > 0),
    mat,
  );
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  if (inner > 0) {
    const rim = new T.Mesh(new T.RingGeometry(inner, radius, 16), edge);
    rim.rotation.y = Math.PI;
    rim.position.set(x, y, z - length / 2);
    parent.add(rim);
    const bore = new T.Mesh(
      new T.CylinderGeometry(inner, inner, length * 0.97, 16, 1, true),
      black,
    );
    bore.material = new T.MeshStandardMaterial({
      color: 0x060807,
      side: T.BackSide,
      roughness: 1,
    });
    bore.rotation.x = Math.PI / 2;
    bore.position.copy(m.position);
    parent.add(bore);
    const end = new T.Mesh(new T.CircleGeometry(inner, 16), black);
    end.rotation.y = Math.PI;
    end.position.set(x, y, z + length * 0.42);
    parent.add(end);
  }
  return m;
}
function line(
  parent: T.Object3D,
  mat: T.Material,
  coords: number[][],
  radius = 0.004,
) {
  return tube(
    parent,
    coords.map((p) => v(p[0], p[1], p[2])),
    radius,
    mat,
    12,
  );
}
/** Longitudinal faceted loft; rings describe z, center height, half width, half height. */
function loft(
  parent: T.Object3D,
  mat: T.Material,
  rings: number[][],
  sides = 12,
) {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  rings.forEach(([z, y, w, h], j) => {
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * w, y + Math.sin(a) * h, z);
      uv.push(i / sides, j / (rings.length - 1));
      if (j && i < sides) {
        const n = j * (sides + 1) + i,
          p = n - sides - 1;
        if (rings[rings.length - 1][0] > rings[0][0])
          indices.push(p, p + 1, n, p + 1, n + 1, n);
        else indices.push(p, n, p + 1, p + 1, n, n + 1);
      }
    }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const m = new T.Mesh(geo, mat);
  parent.add(m);
  return m;
}

/** Continuous carved surface with smoothly varying authored cross-sections. */
function sculptLoft(parent: T.Object3D, mat: T.Material, rings: number[][]) {
  const curve = new T.CatmullRomCurve3(
    rings.map((r) => new T.Vector3(r[1], r[2], r[3])),
    false,
    "catmullrom",
    0.25,
  );
  const steps = (rings.length - 1) * 5;
  const sampled: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps,
      section = Math.min(rings.length - 2, Math.floor(u * (rings.length - 1)));
    const f = u * (rings.length - 1) - section,
      shape = curve.getPoint(u);
    sampled.push([
      T.MathUtils.lerp(rings[section][0], rings[section + 1][0], f),
      shape.x,
      Math.max(0.001, shape.y),
      Math.max(0.001, shape.z),
    ]);
  }
  const mesh = loft(parent, mat, sampled, 24),
    uv = mesh.geometry.getAttribute("uv");
  const length = Math.abs(rings.at(-1)![0] - rings[0][0]);
  for (let j = 0; j < sampled.length; j++) {
    const along =
      Math.abs(sampled[j][0] - rings[0][0]) / Math.max(length, 0.001);
    for (let i = 0; i <= 24; i++) uv.setY(j * 25 + i, along);
  }
  uv.needsUpdate = true;
  // Weld shading across the UV seam while retaining independent UV coordinates.
  const normals = mesh.geometry.getAttribute("normal");
  for (let j = 0; j < sampled.length; j++) {
    const first = j * 25,
      last = first + 24;
    const n = new T.Vector3()
      .fromBufferAttribute(normals, first)
      .add(new T.Vector3().fromBufferAttribute(normals, last))
      .normalize();
    normals.setXYZ(first, n.x, n.y, n.z);
    normals.setXYZ(last, n.x, n.y, n.z);
  }
  normals.needsUpdate = true;
  // Close the profile: stocks and cuffs must not reveal open ends in the inspect pose.
  for (const end of [0, rings.length - 1]) {
    const [z, y, width, height] = rings[end];
    const cap = new T.Mesh(new T.CircleGeometry(1, 24), mat);
    cap.position.set(0, y, z);
    cap.scale.set(width, height, 1);
    const increasing = rings.at(-1)![0] > rings[0][0];
    cap.rotation.y = (end === 0) === increasing ? Math.PI : 0;
    parent.add(cap);
  }
  return mesh;
}

/** Two adult gloved hands, with forearms extending toward the player's shoulders. */
export function addHoldingHands(parent: T.Group) {
  let hands = new T.Group();
  const triggerHand = hands;
  parent.userData.triggerHand = triggerHand;
  hands.name = "Worn gloves and coat cuffs";
  parent.add(hands);
  function forearm(a: T.Vector3, b: T.Vector3, radius: number) {
    const direction = b.clone().sub(a),
      length = direction.length();
    const sleeveRoot = new T.Group();
    sleeveRoot.position.copy(a);
    sleeveRoot.quaternion.setFromUnitVectors(v(0, 0, 1), direction.normalize());
    hands.add(sleeveRoot);
    // Authored elbow-to-wrist profile; folds compress close to the cuff.
    const rings = [
      [0, 0, radius * 1.03, radius * 0.84],
      [length * 0.12, -0.005, radius * 1.02, radius * 0.89],
      [length * 0.33, -0.007, radius * 0.95, radius * 0.87],
      [length * 0.58, -0.003, radius * 0.78, radius * 0.73],
      [length * 0.71, 0, radius * 0.8, radius * 0.69],
      [length * 0.78, 0.003, radius * 0.7, radius * 0.63],
      [length * 0.85, 0, radius * 0.73, radius * 0.65],
      [length * 0.91, 0, radius * 0.64, radius * 0.6],
      [length, 0, radius * 0.65, radius * 0.61],
    ];
    sculptLoft(sleeveRoot, coatCloth, rings);
    sculptLoft(sleeveRoot, gloveLeather, [
      [length * 0.94, 0, radius * 0.68, radius * 0.63],
      [length * 1.01, 0, radius * 0.67, radius * 0.62],
      [length * 1.06, 0, radius * 0.6, radius * 0.56],
    ]);
    line(
      sleeveRoot,
      rubber,
      [
        [radius * 0.86, 0, length * 0.1],
        [radius * 0.75, 0, length * 0.5],
        [radius * 0.62, 0, length * 0.94],
      ],
      0.0018,
    );
    batchRigid(sleeveRoot);
  }
  forearm(v(0.25, -0.46, 0.64), v(0.097, -0.28, 0.34), 0.085);
  // Pistol grip: the back of the glove and four separate fingers wrap the stock.
  const palm = oval(
    hands,
    gloveLeather,
    [0.1, -0.23, 0.28],
    [0.077, 0.094, 0.087],
  );
  palm.rotation.z = -0.2;
  oval(hands, rubber, [0.159, -0.22, 0.29], [0.023, 0.057, 0.058]);
  for (let i = 0; i < 4; i++) {
    const y = -0.15 - i * 0.038;
    line(
      hands,
      gloveLeather,
      [
        [0.133, y, 0.264],
        [0.124, y - 0.008, 0.19],
        [0.069, y - 0.012, 0.165],
        [0.009, y - 0.009, 0.183],
      ],
      0.016,
    );
    oval(hands, rubber, [0.132, y, 0.238], [0.019, 0.012, 0.021]);
    line(
      hands,
      seam,
      [
        [0.127, y + 0.012, 0.245],
        [0.117, y + 0.008, 0.205],
      ],
      0.0018,
    );
  }
  line(
    hands,
    gloveLeather,
    [
      [0.063, -0.26, 0.33],
      [0.011, -0.19, 0.31],
      [-0.025, -0.132, 0.25],
    ],
    0.025,
  );
  batchRigid(hands);
  hands = new T.Group();
  hands.name = "Articulated supporting hand";
  parent.add(hands);
  parent.userData.supportHand = hands;
  // Supporting hand cradles the fore-end, its fingers climbing around the left side.
  forearm(v(-0.3, -0.42, 0.35), v(-0.16, -0.21, -0.075), 0.083);
  const support = oval(
    hands,
    gloveLeather,
    [-0.105, -0.157, -0.19],
    [0.084, 0.052, 0.111],
  );
  support.rotation.z = -0.2;
  for (let i = 0; i < 4; i++) {
    const z = -0.105 - i * 0.048;
    line(
      hands,
      gloveLeather,
      [
        [-0.041, -0.163, z],
        [-0.139, -0.149, z],
        [-0.165, -0.081, z - 0.007],
        [-0.137, -0.025, z - 0.011],
      ],
      0.016,
    );
    oval(hands, rubber, [-0.159, -0.105, z], [0.017, 0.023, 0.019]);
    line(
      hands,
      seam,
      [
        [-0.173, -0.107, z - 0.006],
        [-0.167, -0.067, z - 0.011],
      ],
      0.0018,
    );
  }
  line(
    hands,
    gloveLeather,
    [
      [-0.113, -0.137, -0.071],
      [-0.051, -0.09, -0.065],
      [0.004, -0.069, -0.101],
    ],
    0.024,
  );
  box(hands, brass, [-0.17, -0.185, -0.012], [0.035, 0.018, 0.042]).rotation.z =
    -0.35;
  batchRigid(hands);
}

export function createShotgun() {
  const root = new T.Group(),
    mechanism = new T.Group(),
    jaws: T.Group[] = [],
    tendons: T.Mesh[] = [];
  root.name = "Vesper — sacramental double barrel";
  root.add(mechanism);
  mechanism.position.set(0, -0.035, -0.1);
  // Hinge is at the receiver's lower front edge; the whole barrel assembly breaks here.
  for (const x of [-0.068, 0.068]) {
    pipe(mechanism, bluedSteel, x, 0.07, -0.3, 0.066, 0.69, 0.047);
    pipe(mechanism, bluedSteel, x, 0.07, -0.025, 0.068, 0.1);
    pipe(mechanism, brass, x, 0.07, 0.07, 0.052, 0.04);
    pipe(mechanism, black, x, 0.07, 0.093, 0.015, 0.003);
    for (let i = 0; i < 3; i++)
      line(
        mechanism,
        rust,
        [
          [x + 0.03, 0.124, -0.13 - i * 0.1],
          [x + 0.034, 0.126, -0.18 - i * 0.1],
        ],
        0.0025,
      );
  }
  box(mechanism, bluedSteel, [0, 0.123, -0.29], [0.017, 0.022, 0.66]);
  box(mechanism, brass, [0, 0.149, -0.6], [0.014, 0.021, 0.025]);
  sculptLoft(mechanism, gunWalnut, [
    [-0.42, -0.034, 0.025, 0.018],
    [-0.36, -0.032, 0.075, 0.046],
    [-0.13, -0.032, 0.096, 0.053],
    [0.02, -0.016, 0.07, 0.04],
    [0.06, -0.009, 0.015, 0.015],
  ]);
  for (const z of [-0.31, -0.17])
    box(mechanism, bluedSteel, [0, -0.061, z], [0.154, 0.018, 0.022]);
  sculptLoft(root, gunWalnut, [
    [0.0, -0.05, 0.043, 0.05],
    [0.12, -0.07, 0.067, 0.085],
    [0.24, -0.16, 0.055, 0.11],
    [0.42, -0.19, 0.06, 0.095],
    [0.46, -0.19, 0.048, 0.08],
  ]);
  box(root, bluedSteel, [0, 0.014, 0.047], [0.159, 0.13, 0.235]);
  box(root, bluedSteel, [0, 0.083, 0.037], [0.147, 0.015, 0.2]);
  box(root, rubber, [0, -0.19, 0.458], [0.125, 0.19, 0.019]);
  for (const side of [-1, 1]) {
    const hinge = pipe(
      root,
      wornSteel,
      side * 0.089,
      -0.032,
      -0.085,
      0.021,
      0.01,
    );
    hinge.rotation.set(0, 0, Math.PI / 2);
    const sideplate = box(
      root,
      bluedSteel,
      [side * 0.083, 0.015, 0.061],
      [0.009, 0.096, 0.17],
    );
    sideplate.rotation.x = 0.03;
    // Angular votive sigils are metal inlay, following the receiver plane.
    const x = side * 0.089;
    line(
      root,
      wornSteel,
      [
        [x, 0.052, 0.08],
        [x, -0.015, 0.035],
        [x, 0.052, -0.012],
        [x, 0.052, 0.08],
      ],
      0.0014,
    );
    line(
      root,
      brass,
      [
        [x, 0.065, 0.034],
        [x, -0.021, 0.034],
      ],
      0.0014,
    );
    for (const z of [-0.013, 0.12]) {
      const pin = pipe(root, brass, x, 0.024, z, 0.009, 0.011);
      pin.rotation.set(0, 0, Math.PI / 2);
    }
    line(
      root,
      wornSteel,
      [
        [side * 0.076, 0.079, -0.043],
        [side * 0.076, 0.079, 0.133],
      ],
      0.003,
    );
    for (let i = 0; i < 6; i++)
      line(
        root,
        rubber,
        [
          [side * 0.049, -0.1 - i * 0.012, 0.23],
          [side * 0.053, -0.13 - i * 0.011, 0.33],
        ],
        0.0015,
      );
  }
  line(
    root,
    brass,
    [
      [0, -0.043, 0.055],
      [0, -0.15, 0.036],
      [0, -0.185, 0.13],
      [0, -0.15, 0.208],
    ],
    0.012,
  );
  line(
    root,
    iron,
    [
      [0, -0.055, 0.085],
      [0, -0.106, 0.09],
      [0, -0.127, 0.115],
    ],
    0.009,
  );
  box(root, brass, [0.035, 0.111, 0.095], [0.027, 0.018, 0.1]).rotation.y =
    -0.27;
  const hammers = new T.Group();
  hammers.position.set(0, 0.07, 0.13);
  root.add(hammers);
  for (const x of [-0.06, 0.06]) {
    line(
      hammers,
      wornSteel,
      [
        [x, 0, 0],
        [x, 0.065, 0.032],
        [x, 0.085, -0.008],
      ],
      0.012,
    );
    box(hammers, bluedSteel, [x, 0.08, -0.007], [0.033, 0.016, 0.036]);
  }
  root.userData.hammers = hammers;
  batchRigid(hammers);
  const shells: T.Group[] = [];
  for (const x of [-0.068, 0.068]) {
    const shell = new T.Group();
    shell.position.set(x, 0.035, 0.0);
    pipe(shell, rust, 0, 0, 0, 0.045, 0.13);
    pipe(shell, brass, 0, 0, 0.067, 0.048, 0.024);
    pipe(shell, black, 0, 0, 0.081, 0.01, 0.002);
    root.add(shell);
    batchRigid(shell);
    shell.visible = false;
    shells.push(shell);
  }
  root.userData.shells = shells;
  // Twin barrel clamps, screw slots, rear notch and fine worn muzzle edges.
  for (const z of [-0.56, -0.2]) {
    box(mechanism, bluedSteel, [0, 0.073, z], [0.266, 0.014, 0.014]);
    for (const x of [-0.068, 0.068])
      pipe(mechanism, bluedSteel, x, 0.07, z, 0.067, 0.012, 0.047);
  }
  for (const x of [-0.026, 0.026])
    box(root, bluedSteel, [x, 0.108, 0.1], [0.022, 0.03, 0.025]);
  for (const side of [-1, 1])
    for (const z of [-0.015, 0.115]) {
      line(
        root,
        black,
        [
          [side * 0.095, 0.018, z - 0.006],
          [side * 0.095, 0.028, z + 0.006],
        ],
        0.0018,
      );
    }
  addHoldingHands(root);
  batchRigid(root);
  batchRigid(mechanism);
  return { root, mechanism, jaws, tendons };
}

export function createAcidWeapon() {
  const root = new T.Group(),
    mechanism = new T.Group(),
    jaws: T.Group[] = [],
    tendons: T.Mesh[] = [];
  root.name = "The Tithe — living acid gland";
  root.add(mechanism);
  loft(root, skin, [
    [-0.64, 0.0, 0.025, 0.026],
    [-0.54, 0.0, 0.06, 0.058],
    [-0.34, -0.01, 0.075, 0.08],
    [-0.12, -0.028, 0.15, 0.14],
    [0.13, -0.045, 0.178, 0.155],
    [0.32, -0.053, 0.115, 0.12],
    [0.43, -0.063, 0.016, 0.018],
  ]);
  // Bladder lobes are retained as animation targets, unlike the rigid skin mantle.
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? -1 : 1,
      lobe = new T.Group();
    lobe.position.set(side * 0.115, 0.055, 0.23 - i * 0.095);
    root.add(lobe);
    jaws.push(lobe);
    oval(lobe, i % 3 ? skin : lesion, [0, 0, 0], [0.074, 0.085, 0.092]);
    line(
      lobe,
      lesion,
      [
        [-0.045, 0.019, 0.05],
        [0, 0.08, 0],
        [0.042, 0.03, -0.065],
      ],
      0.008,
    );
  }
  for (const side of [-1, 1]) {
    const t = line(
      root,
      sinew,
      [
        [side * 0.055, -0.13, 0.37],
        [side * 0.18, -0.07, 0.17],
        [side * 0.14, 0.052, -0.13],
        [side * 0.052, 0.024, -0.56],
      ],
      0.022,
    );
    tendons.push(t);
    line(
      root,
      lesion,
      [
        [side * 0.08, 0.039, 0.31],
        [side * 0.125, 0.095, 0.16],
        [side * 0.087, 0.075, -0.18],
        [side * 0.028, 0.051, -0.48],
      ],
      0.01,
    );
    for (let i = 0; i < 6; i++) {
      const z = 0.29 - i * 0.115;
      line(
        root,
        sinew,
        [
          [side * 0.016, -0.127, z],
          [side * 0.127, -0.131, z - 0.01],
          [side * 0.155, -0.052, z - 0.025],
        ],
        0.01,
      );
    }
  }
  for (let i = 0; i < 9; i++) {
    const z = 0.29 - i * 0.076;
    const width = 0.11 - Math.max(0, -z) * 0.12;
    line(
      root,
      sinew,
      [
        [-width, -0.065, z],
        [-width * 1.18, 0.045, z - 0.012],
        [0, 0.123 - Math.max(0, -z) * 0.13, z - 0.025],
        [width * 1.18, 0.045, z - 0.012],
        [width, -0.065, z],
      ],
      0.012,
    );
    line(
      root,
      lesion,
      [
        [-width, 0.078, z],
        [0.025, 0.133, z - 0.018],
        [width, 0.066, z - 0.035],
      ],
      0.0035,
    );
  }
  // Folded fleshy sphincter and dark throat keep the muzzle readable in silhouette.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    oval(
      mechanism,
      lesion,
      [Math.cos(a) * 0.04, Math.sin(a) * 0.04, -0.617],
      [0.025, 0.026, 0.065],
    );
  }
  pipe(mechanism, black, 0, 0, -0.63, 0.029, 0.028);
  oval(mechanism, bile, [0, 0, -0.65], [0.019, 0.019, 0.007]);
  oval(root, lesion, [0.045, -0.18, 0.23], [0.072, 0.145, 0.105]);
  for (let i = 0; i < 4; i++)
    line(
      root,
      sinew,
      [
        [-0.025, -0.16 - i * 0.035, 0.18],
        [0.04, -0.19 - i * 0.026, 0.148],
        [0.096, -0.16 - i * 0.029, 0.19],
      ],
      0.011,
    );
  for (let i = 0; i < 13; i++) {
    const z = 0.31 - i * 0.047,
      angle = i * 2.4;
    oval(
      root,
      i % 3 ? lesion : bile,
      [Math.cos(angle) * 0.13, 0.03 + Math.sin(angle) * 0.085, z],
      [0.014, 0.016, 0.021],
    );
  }
  addHoldingHands(root);
  batchRigid(root, tendons);
  batchRigid(mechanism);
  return { root, mechanism, jaws, tendons };
}

/** A scavenged ossuary mechanism: long bone rails and an exposed recoil carriage. */
export function createFemurWeapon() {
  const root = new T.Group(),
    mechanism = new T.Group(),
    jaws: T.Group[] = [],
    tendons: T.Mesh[] = [];
  root.name = "Ossuary � bone rail launcher";
  root.add(mechanism);
  const ivory = surface(0xb4a48a, "hide", 0.73);
  const marrow = surface(0x613333, "hide", 0.48);
  loft(root, wood, [
    [0.45, -0.16, 0.025, 0.025],
    [0.38, -0.15, 0.065, 0.085],
    [0.2, -0.13, 0.065, 0.11],
    [0.04, -0.035, 0.085, 0.085],
    [-0.16, -0.01, 0.072, 0.066],
    [-0.48, 0.0, 0.043, 0.035],
    [-0.61, 0.0, 0.014, 0.016],
  ]);
  for (const side of [-1, 1]) {
    line(
      root,
      ivory,
      [
        [side * 0.064, -0.012, 0.3],
        [side * 0.118, 0.05, 0.12],
        [side * 0.1, 0.032, -0.22],
        [side * 0.068, 0.006, -0.64],
      ],
      0.031,
    );
    oval(root, ivory, [side * 0.069, 0.008, -0.63], [0.045, 0.05, 0.072]);
    for (let i = 0; i < 5; i++) {
      const z = 0.15 - i * 0.13;
      line(
        root,
        marrow,
        [
          [side * 0.12, 0.052, z],
          [side * 0.105, 0.018, z - 0.026],
          [side * 0.1, -0.025, z - 0.036],
        ],
        0.005,
      );
    }
    const jaw = new T.Group();
    jaw.position.set(side * 0.078, -0.015, -0.34);
    root.add(jaw);
    jaws.push(jaw);
    line(
      jaw,
      ivory,
      [
        [0, 0, 0],
        [side * 0.045, 0.1, -0.1],
        [side * 0.025, 0.13, -0.27],
        [0, 0.08, -0.33],
      ],
      0.025,
    );
    for (let i = 0; i < 4; i++) {
      const tooth = new T.Mesh(new T.ConeGeometry(0.013, 0.046, 7), ivory);
      tooth.position.set(side * 0.022, 0.1, -0.12 - i * 0.055);
      tooth.rotation.z = Math.PI;
      jaw.add(tooth);
    }
    batchRigid(jaw);
    const tendon = line(
      root,
      marrow,
      [
        [side * 0.1, -0.056, 0.25],
        [side * 0.152, -0.04, -0.05],
        [side * 0.11, -0.014, -0.4],
        [side * 0.074, 0.03, -0.62],
      ],
      0.018,
    );
    tendons.push(tendon);
  }
  pipe(mechanism, iron, 0, 0.055, -0.08, 0.043, 0.48);
  pipe(mechanism, brass, 0, 0.055, 0.12, 0.059, 0.07);
  line(
    mechanism,
    ivory,
    [
      [0, 0.09, 0.1],
      [0, 0.11, -0.14],
      [0, 0.085, -0.55],
    ],
    0.029,
  );
  oval(mechanism, ivory, [0, 0.088, -0.53], [0.047, 0.039, 0.052]);
  for (const z of [-0.25, 0.11]) {
    box(root, iron, [0, -0.015, z], [0.22, 0.035, 0.065]);
    for (const x of [-0.095, 0.095])
      oval(root, brass, [x, 0.007, z], [0.01, 0.008, 0.01]);
  }
  line(
    root,
    brass,
    [
      [0, -0.08, 0.11],
      [0, -0.2, 0.1],
      [0, -0.21, 0.22],
      [0, -0.12, 0.25],
    ],
    0.01,
  );
  for (let i = 0; i < 6; i++)
    line(
      root,
      hide,
      [
        [-0.06, -0.11 - i * 0.01, 0.24 + i * 0.02],
        [0, -0.22, 0.24 + i * 0.02],
        [0.06, -0.11 - i * 0.01, 0.24 + i * 0.02],
      ],
      0.009,
    );
  addHoldingHands(root);
  batchRigid(root, tendons);
  batchRigid(mechanism);
  return { root, mechanism, jaws, tendons };
}

export function createKickRig() {
  const root = new T.Group(),
    thigh = new T.Group(),
    shin = new T.Group(),
    boot = new T.Group();
  root.name = "Warden right leg";
  root.add(thigh);
  thigh.add(shin);
  shin.position.y = -0.4;
  shin.add(boot);
  boot.position.y = -0.4;
  // Articulation remains at hip, knee and ankle; calf and thigh have tapered anatomy.
  const upper = new T.Mesh(
    new T.CylinderGeometry(0.102, 0.076, 0.39, 12),
    hide,
  );
  upper.position.y = -0.195;
  thigh.add(upper);
  const calf = new T.Mesh(new T.CylinderGeometry(0.084, 0.062, 0.37, 12), hide);
  calf.position.set(0, -0.195, 0.012);
  shin.add(calf);
  oval(shin, iron, [0, -0.01, -0.065], [0.087, 0.092, 0.035]);
  loft(shin, iron, [
    [-0.07, -0.19, 0.068, 0.15],
    [-0.097, -0.19, 0.058, 0.137],
    [-0.104, -0.19, 0.042, 0.11],
  ]);
  for (const y of [-0.09, -0.29]) {
    const band = new T.Mesh(
      new T.CylinderGeometry(
        0.087 - (y < -0.2 ? 0.013 : 0),
        0.087 - (y < -0.2 ? 0.013 : 0),
        0.027,
        12,
      ),
      rubber,
    );
    band.position.y = y;
    shin.add(band);
    box(shin, brass, [0.075, y, -0.016], [0.018, 0.036, 0.042]);
  }
  // A foot last with heel cup, raised instep, broad metatarsal and compressed toe box.
  loft(boot, hide, [
    [0.088, -0.051, 0.026, 0.052],
    [0.068, -0.045, 0.068, 0.077],
    [-0.005, -0.043, 0.072, 0.092],
    [-0.09, -0.073, 0.079, 0.07],
    [-0.175, -0.092, 0.09, 0.047],
    [-0.259, -0.103, 0.084, 0.035],
    [-0.289, -0.106, 0.057, 0.025],
    [-0.299, -0.108, 0.009, 0.01],
  ]);
  loft(boot, rubber, [
    [0.092, -0.12, 0.006, 0.012],
    [0.078, -0.127, 0.07, 0.02],
    [-0.06, -0.127, 0.077, 0.023],
    [-0.19, -0.135, 0.095, 0.021],
    [-0.277, -0.135, 0.079, 0.018],
    [-0.307, -0.133, 0.008, 0.01],
  ]);
  loft(boot, iron, [
    [-0.18, -0.092, 0.09, 0.048],
    [-0.228, -0.097, 0.09, 0.044],
    [-0.278, -0.105, 0.071, 0.032],
    [-0.296, -0.108, 0.015, 0.012],
  ]);
  box(boot, rubber, [0, -0.16, 0.032], [0.121, 0.034, 0.09]);
  const cuff = new T.Mesh(
    new T.CylinderGeometry(0.077, 0.07, 0.13, 12, 1, true),
    hide,
  );
  cuff.position.y = 0.025;
  boot.add(cuff);
  for (const side of [-1, 1]) {
    line(
      boot,
      seam,
      [
        [side * 0.064, -0.087, 0.065],
        [side * 0.075, -0.099, -0.065],
        [side * 0.088, -0.114, -0.18],
        [side * 0.066, -0.122, -0.275],
      ],
      0.0025,
    );
    for (let i = 0; i < 5; i++) {
      const z = -0.018 - i * 0.027,
        y = 0.016 - i * 0.017;
      oval(boot, brass, [side * 0.038, y, z], [0.009, 0.004, 0.008]);
      line(
        boot,
        seam,
        [
          [side * 0.038, y + 0.003, z],
          [-side * 0.038, y - 0.009, z - 0.024],
        ],
        0.0035,
      );
    }
    for (let i = 0; i < 4; i++)
      box(
        boot,
        rubber,
        [side * 0.067, -0.158, -0.11 - i * 0.04],
        [0.039, 0.02, 0.023],
      ).rotation.y = side * 0.18;
    for (const z of [-0.218, -0.255])
      oval(boot, brass, [side * 0.072, -0.082, z], [0.004, 0.006, 0.004]);
  }
  line(
    boot,
    rubber,
    [
      [-0.067, 0.058, -0.015],
      [0, 0.062, -0.068],
      [0.069, 0.058, -0.015],
    ],
    0.014,
  );
  box(boot, brass, [0.055, 0.063, -0.041], [0.033, 0.028, 0.013]);
  for (let i = 0; i < 4; i++)
    line(
      boot,
      edge,
      [
        [-0.051 + i * 0.021, -0.061, -0.205],
        [-0.041 + i * 0.021, -0.066, -0.244],
      ],
      0.0015,
    );
  [thigh, shin, boot].forEach((g) => batchRigid(g));
  return { root, thigh, shin, boot };
}
