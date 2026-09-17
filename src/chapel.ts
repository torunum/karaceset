import * as T from "three";
import { tube, oval, mats, batchRigid } from "./art";
import { sceneryMats } from "./scenery";

/** Original chapel detail set; architecture stays against the perimeter to preserve navigation. */
export function createChapel() {
  const root = new T.Group(),
    stone = sceneryMats.stone.clone(),
    dark = sceneryMats.iron.clone();
  stone.color.setHex(0x8b897e);
  dark.color.setHex(0x292a27);
  const flesh = new T.MeshStandardMaterial({
    map: mats.flesh.map,
    color: 0x633c38,
    roughness: 0.67,
    bumpMap: mats.flesh.map,
    bumpScale: 0.025,
  });
  const mortar = new T.MeshStandardMaterial({ color: 0x252421, roughness: 1 });
  const glass = new T.MeshStandardMaterial({
    color: 0x421914,
    emissive: 0x762a17,
    emissiveIntensity: 0.4,
    roughness: 0.45,
    side: T.DoubleSide,
  });
  glass.userData.environmentRole = "shrine";
  function block(
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    angle = 0,
  ) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = angle;
    root.add(m);
    return m;
  }
  // Separate wedge-shaped voussoirs give arches stone joints and a pointed crown.
  // Built once, then merged by material below; no animated geometry or new lights.
  function arch(
    x: number,
    spring: number,
    z: number,
    half: number,
    rise: number,
    width: number,
    depth: number,
    rotation = 0,
    divisions = 9,
  ) {
    const point = (t: number, side: number) => {
      const s = 1 - t;
      return new T.Vector2(
        side * half * (s * s + 1.56 * s * t),
        spring + rise * (1.32 * s * t + t * t),
      );
    };
    for (const side of [-1, 1])
      for (let i = 0; i < divisions; i++) {
        const a = point((i + 0.025) / divisions, side);
        const b = point((i + 0.975) / divisions, side);
        const normal = new T.Vector2(-(b.y - a.y), b.x - a.x)
          .normalize()
          .multiplyScalar(width / 2);
        const shape = new T.Shape();
        shape.moveTo(a.x + normal.x, a.y + normal.y);
        shape.lineTo(b.x + normal.x, b.y + normal.y);
        shape.lineTo(b.x - normal.x, b.y - normal.y);
        shape.lineTo(a.x - normal.x, a.y - normal.y);
        shape.closePath();
        const geometry = new T.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: false,
          steps: 1,
          curveSegments: 1,
        });
        // BoxGeometry is indexed; retain compatible attributes for batchRigid.
        geometry.setIndex(
          Array.from(
            { length: geometry.getAttribute("position").count },
            (_, index) => index,
          ),
        );
        geometry.translate(0, 0, -depth / 2);
        const mesh = new T.Mesh(geometry, stone);
        mesh.position.set(x, 0, z);
        mesh.rotation.y = rotation;
        root.add(mesh);
      }
  }
  // Recessed stone plinth and pilasters with weathered block courses.
  for (const side of [-1, 1]) {
    block(stone, side * 5.84, 0.15, -1, 0.24, 0.3, 17.8);
    for (const z of [-8, -3, 2, 6.8]) {
      block(stone, side * 5.82, 0.24, z, 0.64, 0.48, 0.9);
      for (let j = 0; j < 9; j++)
        block(
          stone,
          side * 5.79,
          0.65 + j * 0.48,
          z,
          0.4 + (j % 3 === 0 ? 0.07 : 0),
          0.46,
          0.52,
          Math.sin(j * 13 + z) * 0.016,
        );
      block(stone, side * 5.81, 4.76, z, 0.6, 0.16, 0.72);
      block(stone, side * 5.82, 4.96, z, 0.64, 0.22, 0.9);
    }
    // Deep pointed wall niches: silhouette and dimensional frame, no painted fake portals.
    // The inherited z=0 pier occupies the old middle niche; mount between piers instead.
    for (const z of [-5.4, -1.55, 4.6]) {
      block(mortar, side * 5.975, 2.35, z, 0.025, 2.7, 1.7);
      for (let layer = 0; layer < 3; layer++) {
        const half = 0.77 + layer * 0.15;
        const face = side * (5.79 + layer * 0.055);
        arch(
          face,
          2.8,
          z,
          half,
          0.99 + layer * 0.17,
          0.12,
          0.13,
          Math.PI / 2,
          6,
        );
        for (const q of [-1, 1]) {
          block(stone, face, 1.99, z + q * half, 0.13, 1.62, 0.12);
          block(stone, face, 2.78, z + q * half, 0.18, 0.12, 0.19);
        }
      }
      block(stone, side * 5.76, 1.12, z, 0.44, 0.14, 2.32);
      block(stone, side * 5.85, 1.0, z, 0.24, 0.12, 2.12);
    }
  }
  // Stone ribs over the aisle. They read as load-bearing masonry, not uniform glowing bones.
  for (const z of [-7.8, -2.8, 2.2, 6.7]) {
    arch(0, 3.8, z, 5.7, 1.9, 0.32, 0.42, 0, 14);
    arch(0, 3.84, z, 5.7, 1.9, 0.12, 0.57, 0, 14);
    block(stone, 0, 5.65, z, 0.38, 0.35, 0.66);
  }
  // The shared test-room scenery ends its z=0 vault arms at x=+/-0.9.
  // Complete that inherited vault here; keep the entire crown below the 5.8 m ceiling.
  arch(0, 5.47, 0, 1.07, 0.12, 0.34, 0.47, 0, 4);
  block(stone, 0, 5.57, 0, 0.32, 0.36, 0.5);
  // Inlaid central aisle, broken flagstone edging and shallow rain/drain channels.
  for (let z = -7; z < 7; z += 1.1) {
    for (const side of [-1, 1])
      block(stone, side * 1.72, 0.016, z, 0.2, 0.027, 1.03);
  }
  for (const side of [-1, 1]) {
    block(mortar, side * 4.6, 0.011, -0.7, 0.2, 0.019, 16);
    for (let z = -8; z < 7; z += 0.26)
      block(dark, side * 4.6, 0.025, z, 0.24, 0.025, 0.035);
  }
  // Original lancet stained-glass window behind altar.
  const shape = new T.Shape();
  shape.moveTo(-1.5, 1.4);
  shape.lineTo(-1.5, 3.7);
  shape.quadraticCurveTo(-1.15, 4.65, 0, 5.25);
  shape.quadraticCurveTo(1.15, 4.65, 1.5, 3.7);
  shape.lineTo(1.5, 1.4);
  shape.closePath();
  const windowGeometry = new T.ShapeGeometry(shape);
  const windowPositions = windowGeometry.getAttribute("position");
  const windowUV = windowGeometry.getAttribute("uv");
  for (let i = 0; i < windowPositions.count; i++)
    windowUV.setXY(
      i,
      (windowPositions.getX(i) + 1.5) / 3,
      (windowPositions.getY(i) - 1.4) / 3.85,
    );
  const window = new T.Mesh(windowGeometry, glass);
  window.position.z = -9.94;
  root.add(window);
  // Three recessed orders frame the illustrated shrine, leaving its center unobstructed.
  for (let layer = 0; layer < 3; layer++) {
    const half = 1.67 + layer * 0.24;
    const face = -9.69 - layer * 0.09;
    arch(0, 3.68, face, half, 1.76 + layer * 0.17, 0.18, 0.19, 0, 9);
    for (const side of [-1, 1]) {
      block(stone, side * half, 2.5, face, 0.18, 2.36, 0.19);
      block(stone, side * half, 1.3, face, 0.27, 0.2, 0.29);
      block(stone, side * half, 3.62, face, 0.28, 0.16, 0.28);
    }
  }
  block(stone, 0, 1.24, -9.72, 4.6, 0.18, 0.35);
  block(stone, 0, 1.1, -9.8, 4.32, 0.12, 0.2);
  for (const side of [-1, 1]) {
    // Stepped buttresses and paired blind lancets make the end wall a complete facade.
    for (let tier = 0; tier < 3; tier++) {
      block(
        stone,
        side * 2.53,
        0.6 + tier * 1.4,
        -9.77 - tier * 0.03,
        0.55 - tier * 0.08,
        1.2,
        0.44 - tier * 0.04,
      );
      block(
        stone,
        side * 2.53,
        1.24 + tier * 1.4,
        -9.77 - tier * 0.03,
        0.64 - tier * 0.08,
        0.14,
        0.46 - tier * 0.04,
      );
    }
    for (const offset of [3.5, 4.76]) {
      const center = side * offset;
      block(mortar, center, 2.41, -9.96, 0.82, 2.34, 0.025);
      arch(center, 3.45, -9.79, 0.47, 0.86, 0.16, 0.17, 0, 6);
      for (const edge of [-1, 1])
        block(stone, center + edge * 0.47, 2.36, -9.79, 0.16, 2.18, 0.17);
      block(stone, center, 1.21, -9.78, 1.17, 0.15, 0.3);
    }
  }
  // Infestation follows the outer buttresses, never crossing the shrine artwork.
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const base = side * (2.62 + (i % 4) * 0.19);
    const points = [
      new T.Vector3(base, 0.03, -9.59),
      new T.Vector3(base + side * 0.17, 0.6, -9.56),
      new T.Vector3(base + side * 0.04, 1.6, -9.59),
      new T.Vector3(base + side * 0.38, 2.5 + (i % 5) * 0.3, -9.65),
    ];
    tube(root, points, 0.025 + (i % 3) * 0.014, flesh, 15);
  }
  // Hanging iron reliquaries, chain segments, and subtle gutter wax.
  const beforeFixtures = new Set(root.children);
  for (const side of [-1, 1])
    for (const z of [-5, 1.2]) {
      for (let j = 0; j < 12; j++) {
        const link = new T.Mesh(new T.TorusGeometry(0.046, 0.012, 5, 8), dark);
        link.position.set(side * 3.9, 5.3 - j * 0.11, z);
        link.rotation.y = j % 2 ? Math.PI / 2 : 0;
        root.add(link);
      }
      block(dark, side * 3.9, 3.91, z, 0.34, 0.035, 0.34);
      const candle = block(
        sceneryMats.wax,
        side * 3.9,
        4.04,
        z,
        0.085,
        0.22,
        0.085,
      );
      oval(
        root,
        new T.MeshBasicMaterial({ color: 0xffb767 }),
        [candle.position.x, 4.19, z],
        [0.035, 0.075, 0.035],
      );
    }
  const fixtures = new T.Group();
  fixtures.name = "blender-hanging-fixtures";
  fixtures.userData.blenderSlot = true;
  for (const child of [...root.children])
    if (!beforeFixtures.has(child)) fixtures.add(child);
  root.add(fixtures);
  // Flatten nested static tubes/ovals before one merge per material.
  root.updateMatrixWorld(true);
  const meshes: T.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      let parent = o.parent;
      while (parent && parent !== root) {
        if (parent.userData.blenderSlot) return;
        parent = parent.parent;
      }
      meshes.push(o);
    }
  });
  for (const m of meshes) {
    m.geometry = m.geometry.clone().applyMatrix4(m.matrixWorld);
    root.add(m);
    m.position.set(0, 0, 0);
    m.quaternion.identity();
    m.scale.setScalar(1);
  }
  for (const c of [...root.children])
    if (!(c instanceof T.Mesh) && !c.userData.blenderSlot) root.remove(c);
  batchRigid(root);
  root.traverse((o) => {
    if (o instanceof T.Mesh) o.receiveShadow = true;
  });
  const lights: T.PointLight[] = [];
  for (const [x, y, z, power, color] of [
    [-3.9, 4.25, -5, 17, 0xe6a466],
    [3.9, 4.25, 1.2, 18, 0xe6a466],
    [0, 3.4, -8.4, 13, 0xb34f35],
    [0, 4, 5.4, 12, 0x899cac],
  ]) {
    const light = new T.PointLight(color, power, 15, 2);
    light.position.set(x, y, z);
    root.add(light);
    lights.push(light);
  }
  return { root, lights };
}
