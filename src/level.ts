import * as T from "three";
import {batchSpatial} from './render-budget';
import {ORGAN_ROOMS,ORGAN_PATHS,ORGAN_PROPS,organSpawns,organPickups,organicWallRole,CORPSE_MOUNDS} from "./organic-layout";
import {decorateOrgan} from "./organic-architecture";
import {SECRET_PASSAGES} from './chapter-state';
import { createChapel } from "./chapel";
import polygonClipping from "polygon-clipping";
import type { Point, Wall } from "./combat";
import { closestPoint,wallHit } from "./combat";
import { mats, tube, oval, spike, batchRigid } from "./art";
import type { EnemyKind } from "./enemy-types";
import { createScenery, sceneryMats, type SceneryState } from "./scenery";
type Ring = [number, number][];
const ellipse = (x: number, z: number, rx: number, rz: number): Ring => {
  const ring: Ring = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ring.push([x + Math.cos(a) * rx, z + Math.sin(a) * rz]);
  }
  ring.push(ring[0]);
  return ring;
};
function corridor(points: number[][], width: number): Ring[] {
  const rings: Ring[] = [];
  for (const p of points) rings.push(ellipse(p[0], p[1], width, width));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = (-(b[1] - a[1]) / l) * width,
      nz = ((b[0] - a[0]) / l) * width;
    rings.push([
      [a[0] + nx, a[1] + nz],
      [b[0] + nx, b[1] + nz],
      [b[0] - nx, b[1] - nz],
      [a[0] - nx, a[1] - nz],
      [a[0] + nx, a[1] + nz],
    ]);
  }
  return rings;
}
export interface Spawn {
  x: number;
  z: number;
  kind: EnemyKind;
  zone: number;
}
export interface PickupSpec {
  x: number;
  z: number;
  kind: "health" | "ammo";
  secret?: boolean;
}
export class Level {
  secretOpen=new Set<string>();
  secretPanels=new Map<string,T.Mesh>();
  secretWalls:{id:string;wall:Wall}[]=[];
  private wallsCache:Wall[]=[];
  private wallsKey='';
  root = new T.Group();
  scenery: SceneryState;
  walls: Wall[] = [];
  polygons: Ring[][];
  breathers: T.Object3D[] = [];
  lights: T.PointLight[] = [];
  gate: T.Group = new T.Group();
  gateWall: Wall = {
    a: { x: 3.1, z: -66 },
    b: { x: 8.9, z: -66 },
    height: 6,
    gate: true,
  };
  gateOpen = false;
  gateProgress = 0;
  button = new T.Group();
  buttonPosition = new T.Vector3(10, 1, -59);
  exitPosition = new T.Vector3(6, 1, -103);
  spawns: Spawn[] = [];
  pickups: PickupSpec[] = [];
  testroom: boolean;
  constructor(
    testroom = false,
    public chapel = false,
  ) {
    this.testroom = testroom;
    const rings = chapel
      ? [
          [
            [-6, -10],
            [6, -10],
            [6, 8],
            [-6, 8],
            [-6, -10],
          ] as Ring,
        ]
      : testroom
        ? [ellipse(0, 0, 7, 9)]
        : [
            ...ORGAN_ROOMS.map(([x,z,rx,rz])=>ellipse(x,z,rx,rz)),
            ...ORGAN_PATHS.flatMap(path=>corridor(path.points,path.width)),
            ...SECRET_PASSAGES.flatMap(s=>[ellipse(s.rewardX,s.z,2.4,2.5),...corridor([[s.x-Math.sign(s.rewardX-s.x),s.z],[s.rewardX,s.z]],s.half)]),
          ];
    this.polygons = polygonClipping.union(
      ...(rings.map((r) => [r]) as [
        polygonClipping.Geom,
        ...polygonClipping.Geom[],
      ]),
    ) as Ring[][];
    this.buildSurfaces();
    if(!testroom&&!chapel)for(const [i,mound] of CORPSE_MOUNDS.entries()){
      const fallback=new T.Group();fallback.name=`mound-fallback-${i}`;
      fallback.position.set(mound.x,0,mound.z);
      oval(fallback,mats.flesh,[0,.3,0],[mound.radius,.5,mound.radius]);this.root.add(fallback);
    }
    if(!testroom&&!chapel)for(const mound of CORPSE_MOUNDS)for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;
      this.walls.push({a:{x:mound.x+Math.cos(a)*mound.radius,z:mound.z+Math.sin(a)*mound.radius},b:{x:mound.x+Math.cos(b)*mound.radius,z:mound.z+Math.sin(b)*mound.radius},height:mound.width*609/1515*.85});
    }
    if (!chapel) {
      if(testroom) this.decorate();
      else decorateOrgan(this);
    }
    if (testroom) {
      this.spawns = [{ x: 0, z: -6.4, kind: "runner", zone: 0 }];
      this.buttonPosition.set(4, 1, -3);
      this.exitPosition.set(-4, 1, -3);
      this.gateWall = {
        a: { x: 20, z: 20 },
        b: { x: 21, z: 20 },
        height: 6,
        gate: true,
      };
    } else {
      this.spawns=organSpawns();
      this.pickups=organPickups();
    }
    if (chapel) {
      this.spawns = [
        { x: -2.8, z: -2.6, kind: "cultist", zone: 0 },
        { x: 2.8, z: -4.5, kind: "cultist", zone: 0 },
        { x: -1, z: -6, kind: "shambler", zone: 0 },
        { x: 2, z: -7, kind: "shambler", zone: 0 },
      ];
      const obstacle = (
        x: number,
        z: number,
        w: number,
        d: number,
        h: number,
      ) => {
        const corners = [
          { x: x - w / 2, z: z - d / 2 },
          { x: x + w / 2, z: z - d / 2 },
          { x: x + w / 2, z: z + d / 2 },
          { x: x - w / 2, z: z + d / 2 },
        ];
        for (let i = 0; i < 4; i++)
          this.walls.push({
            a: corners[i],
            b: corners[(i + 1) % 4],
            height: h,
          });
      };
      obstacle(0, -7.7, 2.75, 1.3, 1.18);
      for (const side of [-1, 1])
        for (const z of [-8, -3, 2, 6.8])
          obstacle(side * 5.65, z, 0.66, 0.8, 5.1);
      this.buttonPosition.set(0, 1.1, -7.7);
      this.exitPosition.set(0, 1, 7.2);
    }
    this.buildInteractions();
    if(!testroom&&!chapel)for(const s of SECRET_PASSAGES){
      const material=mats.bone.clone();material.userData.environmentRole='boneWall';material.color.setHex(0xc9aaa0);
      const panel=new T.Mesh(new T.BoxGeometry(.3,5.8,s.half*2),material);
      panel.position.set(s.x,2.9,s.z);panel.name=`secret-${s.id}`;panel.userData.rigPart=true;
      this.root.add(panel);this.secretPanels.set(s.id,panel);
      this.secretWalls.push({id:s.id,wall:{a:{x:s.x,z:s.z-s.half},b:{x:s.x,z:s.z+s.half},height:6,gate:true}});
      const fissure=new T.Mesh(new T.PlaneGeometry(.08,1.1),new T.MeshBasicMaterial({color:0xb82b22}));
      const face=-Math.sign(s.rewardX-s.x);fissure.position.set(face*.157,0,0);fissure.rotation.y=face*Math.PI/2;panel.add(fissure);
    }
    if(!testroom && !chapel)batchSpatial(this.root);
    else batchRigid(this.root);
    this.scenery = createScenery(testroom, !testroom && !chapel ? ORGAN_PROPS : undefined);
    this.root.add(this.scenery.root);
    if (chapel) {
      const detail = createChapel();
      this.root.add(detail.root);
      this.lights.push(...detail.lights);
    }
  }
  activeWalls() {
    const key=`${this.gateOpen}:${this.secretWalls.map(s=>this.secretOpen.has(s.id)?1:0).join('')}:${this.walls.length}`;
    if(key!==this.wallsKey){this.wallsKey=key;this.wallsCache=[...this.walls,...(this.gateOpen?[]:[this.gateWall]),...this.secretWalls.filter(s=>!this.secretOpen.has(s.id)).map(s=>s.wall)];}
    return this.wallsCache;
  }
  contains(x: number, z: number, clearance = 0, includeGate = true) {
    let inside = false;
    for (const polygon of this.polygons) {
      let inPoly = false;
      for (const ring of polygon) {
        let inRing = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i],
            b = ring[j];
          if (
            a[1] > z !== b[1] > z &&
            x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
          )
            inRing = !inRing;
        }
        if (inRing) inPoly = !inPoly;
      }
      if (inPoly) inside = true;
    }
    if (!inside) return false;
    if (clearance)
      for (const w of includeGate ? this.activeWalls() : this.walls) {
        const q = closestPoint({ x, z }, w);
        if (Math.hypot(x - q.x, z - q.z) < clearance) return false;
      }
    return true;
  }
  buildSurfaces() {
    for (const poly of this.polygons) {
      const shape = new T.Shape(poly[0].map((p) => new T.Vector2(p[0], -p[1])));
      for (const hole of poly.slice(1))
        shape.holes.push(
          new T.Path(hole.map((p) => new T.Vector2(p[0], -p[1]))),
        );
      const floorGeo = new T.ShapeGeometry(shape);
      floorGeo.rotateX(-Math.PI / 2);
      const uv = floorGeo.getAttribute("uv");
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, uv.getX(i) / 5, uv.getY(i) / 5);
      const floorMaterial = sceneryMats.floor.clone();
      if(!this.testroom && !this.chapel) floorMaterial.userData.environmentRole="tissue";
      const floor = new T.Mesh(floorGeo, floorMaterial);
      this.root.add(floor);
      const ceiling = new T.Mesh(
        floorGeo,
        this.chapel ? sceneryMats.stone : mats.flesh,
      );
      ceiling.rotation.z = Math.PI;
      ceiling.scale.x = -1;
      ceiling.position.y = 5.8;
      this.root.add(ceiling);
      for (const ring of poly) {
        let distance = 0;
        const sections=new Map<string,{positions:number[];uvs:number[];indices:number[]}>();
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i],
            b = ring[i + 1];
          this.walls.push({
            a: { x: a[0], z: a[1] },
            b: { x: b[0], z: b[1] },
            height: 5.8,
          });
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const role=!this.testroom&&!this.chapel?organicWallRole((a[0]+b[0])*.5,(a[1]+b[1])*.5):'stone';
          if(!sections.has(role))sections.set(role,{positions:[],uvs:[],indices:[]});
          const {positions,uvs,indices}=sections.get(role)!;
          const base = positions.length / 3;
          positions.push(
            a[0],
            0,
            a[1],
            b[0],
            0,
            b[1],
            a[0],
            5.8,
            a[1],
            b[0],
            5.8,
            b[1],
          );
          uvs.push(
            distance / 4,
            0,
            (distance + len) / 4,
            0,
            distance / 4,
            1.6,
            (distance + len) / 4,
            1.6,
          );
          indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
          distance += len;
        }
        for(const [role,{positions,uvs,indices}] of sections){
        const geo = new T.BufferGeometry();
        geo.setAttribute(
          "position",
          new T.Float32BufferAttribute(positions, 3),
        );
        geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mat = sceneryMats.stone.clone();
        mat.userData.environmentRole=role;
        mat.side = T.DoubleSide;
        this.root.add(new T.Mesh(geo, mat));
        }
      }
    }
  }
  decorate() {
    let seed = 86;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Continuous raised vessels trace the room boundaries at several heights.
    for (const polygon of this.polygons)
      for (const ring of polygon) {
        const pts = ring
          .filter((_, i) => i % 2 === 0)
          .map(
            (p, i) =>
              new T.Vector3(
                p[0] * 0.999,
                0.42 + Math.sin(i * 1.8) * 0.16,
                p[1],
              ),
          );
        if (pts.length > 2) {
          pts.push(pts[0]);
          tube(this.root, pts, 0.055, mats.vein, Math.min(400, pts.length * 3));
        }
      }
    for (let i = 0; i < this.walls.length; i += 3) {
      const w = this.walls[i],
        dx = w.b.x - w.a.x,
        dz = w.b.z - w.a.z,
        len = Math.hypot(dx, dz);
      const tangent = new T.Vector3(dx / len, 0, dz / len),
        origin = new T.Vector3((w.a.x + w.b.x) / 2, 0, (w.a.z + w.b.z) / 2);
      const make = (offset: number, y: number) =>
        origin.clone().addScaledVector(tangent, offset).setY(y);
      const bend = (rand() - 0.5) * 0.5;
      tube(
        this.root,
        [make(0, 0.8), make(bend, 2), make(-bend, 3.3), make(bend * 0.5, 5.5)],
        0.045,
        mats.vein,
        16,
      );
      for (const side of [-1, 1])
        tube(
          this.root,
          [make(bend, 2.1), make(side * 0.2, 2.6), make(side * 0.5, 3.15)],
          0.024,
          mats.vein,
          10,
        );
    }
    // Rib arches sit outside the player's corridor clearance.
    const arches = this.testroom
      ? [[0, 0, 5]]
      : [
          [0, 4, 5],
          [0, -7, 2.7],
          [-1.8, -16, 2.7],
          [3.5, -24, 3],
          [8, -30, 7.7],
          [8, -36, 9],
          [8, -42, 7.7],
          [6, -52, 2.8],
          [6, -63, 2.8],
          [6, -72, 6.8],
          [6, -79, 11.5],
          [6, -86, 11.5],
          [6, -93, 7],
          [6, -100, 2.7],
        ];
    for (const [x, z, r] of arches) {
      for (const side of [-1, 1]) {
        const pts = [
          new T.Vector3(x + side * r, 0.05, z),
          new T.Vector3(x + side * r * 0.98, 1.8, z + 0.2),
          new T.Vector3(x + side * r * 0.8, 3.6, z - 0.1),
          new T.Vector3(x + side * r * 0.46, 4.8, z + 0.3),
          new T.Vector3(x + side * 0.28, 5.45, z + 0.5),
        ];
        tube(this.root, pts, r > 5 ? 0.19 : 0.13, mats.bone, 24);
        for (let j = 0; j < 3; j++)
          oval(
            this.root,
            mats.bone,
            [x + side * r * 0.98, 0.25 + j * 0.32, z],
            [0.24, 0.18, 0.24],
          );
      }
    }
    const lamps = this.testroom
      ? [
          [0, 4],
          [-4, -3],
          [4, -3],
        ]
      : [
          [-3, 3],
          [2, -10],
          [0, -20],
          [7, -27],
          [2, -34],
          [15, -37],
          [7, -44],
          [23, -40],
          [27, -49],
          [21, -55],
          [8, -58],
          [6, -64],
          [-1, -75],
          [15, -77],
          [-3, -86],
          [15, -89],
          [6, -97],
          [6, -104],
        ];
    for (const [x, z] of lamps) {
      const g = new T.Group();
      g.position.set(x, 3.9, z);
      oval(g, mats.yellow, [0, 0, 0], [0.17, 0.3, 0.17]);
      tube(
        g,
        [
          new T.Vector3(0, 1.9, 0),
          new T.Vector3(0.2, 0.8, 0.1),
          new T.Vector3(0, 0, 0),
        ],
        0.037,
        mats.tendon,
      );
      for (const side of [-1, 1])
        spike(
          g,
          new T.Vector3(side * 0.16, 0.3, 0),
          new T.Vector3(side * 0.25, -0.17, 0),
          0.035,
        );
      this.root.add(g);
      this.breathers.push(g);
    }
    // A small fixed set of actual lights; emissive glands provide the remaining visual cues.
    for (const [x, z] of this.testroom
      ? [[0, 0]]
      : [
          [0, 1],
          [3, -23],
          [8, -36],
          [25, -47],
          [7, -59],
          [6, -82],
          [6, -101],
        ]) {
      const light = new T.PointLight(0xd9a674, 23, 24, 1.7);
      light.position.set(x, 3.3, z);
      this.root.add(light);
      this.lights.push(light);
    }
    for (let i = 0; i < (this.testroom ? 8 : 120); i++) {
      const x = -6 + rand() * 36,
        z = 10 - rand() * 116;
      if (!this.contains(x, z, 0.8)) continue;
      const g = new T.Group();
      g.position.set(x, 5.8, z);
      const len = 0.3 + rand() * 1.1;
      tube(
        g,
        [
          new T.Vector3(),
          new T.Vector3(0.12, -len * 0.6, 0.1),
          new T.Vector3(0.07, -len, -0.1),
        ],
        0.045 + rand() * 0.05,
        i % 3 ? mats.tendon : mats.vein,
      );
      oval(g, mats.flesh, [0.07, -len, -0.1], [0.09, 0.14, 0.09]);
      this.root.add(g);
      this.breathers.push(g);
    }
    for (let i = 0; i < 45; i++) {
      const x = -5 + rand() * 32,
        z = 6 - rand() * 109;
      if (!this.contains(x, z, 1)) continue;
      const puddle = oval(
        this.root,
        mats.puddle,
        [x, 0.018, z],
        [0.3 + rand() * 1.4, 0.015, 0.4 + rand() * 1.2],
      );
      puddle.rotation.y = rand() * 6;
    }
  }
  buildInteractions() {
    if (this.chapel) {
      this.button.position.copy(this.buttonPosition);
      const seal = new T.Mesh(
        new T.TorusGeometry(0.23, 0.035, 8, 20),
        sceneryMats.rust,
      );
      this.button.add(seal);
      oval(this.button, mats.red, [0, 0, 0], [0.13, 0.13, 0.045]);
      this.root.add(this.button);
      const exit = new T.Mesh(
        new T.BoxGeometry(1.8, 3, 0.13),
        sceneryMats.iron,
      );
      exit.position.set(0, 1.5, 7.93);
      this.root.add(exit);
      for (const x of [-1, 1]) {
        const frame = new T.Mesh(
          new T.BoxGeometry(0.18, 3.2, 0.26),
          sceneryMats.stone,
        );
        frame.position.set(x, 1.6, 7.82);
        this.root.add(frame);
      }
      return;
    }
    this.button.position.copy(this.buttonPosition);
    oval(this.button, mats.dark, [0, 0, 0], [0.5, 0.68, 0.37]);
    oval(this.button, mats.yellow, [0, 0.1, -0.3], [0.27, 0.32, 0.19]);
    for (let i = 0; i < 5; i++)
      tube(
        this.button,
        [
          new T.Vector3((i - 2) * 0.15, -1, 0),
          new T.Vector3((i - 2) * 0.23, -0.4, 0.1),
          new T.Vector3(0, 0, 0),
        ],
        0.045,
        mats.tendon,
      );
    this.root.add(this.button);
    this.gate.position.set(6, 0, -66);
    const membrane = new T.Mesh(
      new T.PlaneGeometry(5.6, 5.8, 12, 12),
      new T.MeshStandardMaterial({
        map: mats.flesh.map,
        color: 0xc35c6b,
        side: T.DoubleSide,
        roughness: 0.32,
        transparent: true,
        opacity: 0.9,
      }),
    );
    membrane.position.y = 2.9;
    this.gate.add(membrane);
    for (let i = -3; i <= 3; i++)
      tube(
        this.gate,
        [
          new T.Vector3(i * 0.78, 0, 0.05),
          new T.Vector3(i * 0.4, 2.9, -0.04),
          new T.Vector3(i * 0.78, 5.8, 0.05),
        ],
        0.065,
        mats.vein,
      );
    if (!this.testroom) this.root.add(this.gate);
    const exit = new T.Group();
    exit.position.copy(this.exitPosition);
    exit.position.y = 0;
    if(this.testroom)for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      oval(
        exit,
        mats.bone,
        [Math.cos(a) * 1.65, 2.05 + Math.sin(a) * 2, 0],
        [0.22, 0.32, 0.2],
      );
    }
    if(!this.testroom){
      const bone=mats.bone.clone();bone.userData.environmentRole='boneWall';
      const rim=new T.Mesh(new T.TorusGeometry(1.55,.2,8,48),bone);rim.position.y=2;rim.scale.y=1.3;exit.add(rim);
    }
    const exitMaterial=this.testroom?new T.MeshBasicMaterial({color:0xe7dca4,side:T.DoubleSide}):mats.flesh.clone();
    if(!this.testroom)exitMaterial.userData.environmentRole='tissue';
    const inner = new T.Mesh(
      new T.CircleGeometry(1.5, 32),
      exitMaterial,
    );
    inner.position.set(0, 2, -0.1);
    inner.scale.y = 1.2;
    exit.add(inner);
    if(!this.testroom){
      const slit=new T.Mesh(new T.PlaneGeometry(.055,2.65),new T.MeshBasicMaterial({color:0xf3a563}));
      slit.position.set(0,2,-.085);exit.add(slit);exit.name='organic-exit-membrane';
    }
    this.root.add(exit);
  }
  update(time: number, dt: number) {
    this.scenery.update(time, dt);
    for(const [id,panel] of this.secretPanels)panel.position.y=T.MathUtils.damp(panel.position.y,this.secretOpen.has(id)?8.9:2.9,5,dt);
    this.breathers.forEach((b, i) => {
      b.scale.y = 1 + Math.sin(time * 1.5 + i) * 0.023;
    });
    if (this.gateOpen) {
      this.gateProgress = Math.min(1, this.gateProgress + dt * 0.75);
      this.gate.scale.y = 1 - this.gateProgress * 0.98;
      this.gate.position.y = this.gateProgress * 5.8;
      this.button.children[1] &&
        (this.button.children[1] as T.Mesh).scale.setScalar(0.7);
    }
  }
}
export class Navigator {
  private previousKey='';
  private grid = new Map<string, number>();
  private nodes = new Set<string>();
  constructor(private level: Level) {
    const points=level.polygons.flat(2);
    const minX=Math.floor(Math.min(...points.map(p=>p[0]))),maxX=Math.ceil(Math.max(...points.map(p=>p[0])));
    const minZ=Math.floor(Math.min(...points.map(p=>p[1]))),maxZ=Math.ceil(Math.max(...points.map(p=>p[1])));
    for (let z = minZ; z <= maxZ; z++)
      for (let x = minX; x <= maxX; x++)
        if (level.contains(x, z, 0.65, false)) this.nodes.add(`${x},${z}`);
  }
  refresh(position: T.Vector3) {
    const sx = Math.round(position.x),
      sz = Math.round(position.z);
    const refreshKey=`${sx},${sz}:${this.level.gateOpen}:${[...this.level.secretOpen].sort().join(',')}`;
    if(refreshKey===this.previousKey)return;
    this.previousKey=refreshKey;
    this.grid.clear();
    const dynamicWalls=[...(this.level.gateOpen?[]:[this.level.gateWall]),...this.level.secretWalls.filter(s=>!this.level.secretOpen.has(s.id)).map(s=>s.wall)];
    const from=new T.Vector3(),to=new T.Vector3();
    const queue: [[number, number], number][] = [[[sx, sz], 0]];
    this.grid.set(`${sx},${sz}`, 0);
    for (let i = 0; i < queue.length; i++) {
      const [[x, z], d] = queue[i];
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          key = `${nx},${nz}`;
        if (
          this.nodes.has(key) &&
          !this.grid.has(key) &&
          !dynamicWalls.some(w=>wallHit(from.set(x,1,z),to.set(nx,1,nz),w))
        ) {
          this.grid.set(key, d + 1);
          queue.push([[nx, nz], d + 1]);
        }
      }
    }
  }
  direction(position: T.Vector3) {
    let best = Infinity,
      point: Point | null = null;
    const x = Math.round(position.x),
      z = Math.round(position.z);
    for (const [dx, dz] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const key = `${x + dx},${z + dz}`,
        d = this.grid.get(key);
      if (d !== undefined && d < best) {
        best = d;
        point = { x: x + dx, z: z + dz };
      }
    }
    return point
      ? new T.Vector3(point.x - position.x, 0, point.z - position.z).normalize()
      : new T.Vector3();
  }
}
