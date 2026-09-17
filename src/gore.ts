import * as T from "three";
import { spriteFragment, disposeSpriteFragment } from "./cult-sprites";
import { type Rig, mats } from "./art";
import { type BodyPart, type Wall, traceShot, moveCircle } from "./combat";
import {nearbyWalls} from './collision-grid';
const blood = new T.MeshStandardMaterial({
  color: 0x740911,
  roughness: 0.23,
  metalness: 0.08,
});
const darkBlood = new T.MeshStandardMaterial({
  color: 0x330508,
  roughness: 0.32,
  side: T.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
const droplet = new T.SphereGeometry(1, 5, 4),
  chip = new T.IcosahedronGeometry(0.12, 0);
const plank = new T.BoxGeometry(0.06, 0.42, 0.09),
  scrap = new T.BoxGeometry(0.22, 0.2, 0.015);
const smear = new T.CircleGeometry(1, 12);
const points = smear.getAttribute("position");
for (let i = 1; i < points.count; i++) {
  const s = 0.72 + Math.abs(Math.sin(i * 7.31)) * 0.28;
  points.setX(i, points.getX(i) * s);
  points.setY(i, points.getY(i) * s);
}
interface Particle {
  mesh: T.Object3D;
  velocity: T.Vector3;
  spin: T.Vector3;
  life: number;
  gib: boolean;
  stain: boolean;
  sleeping:boolean;
  bounds:T.Box3|null;
}
export class GoreSystem {
  private drops = new T.InstancedMesh(droplet, blood, 140);
  private stains = new T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>(smear, darkBlood, 44);
  private before=new T.Vector3();
  private next=new T.Vector3();
  private bounds=new T.Box3();
  particles: Particle[] = [];
  decals: T.Mesh[] = [];
  severed = 0;
  constructor(private scene: T.Scene) {
    this.drops.name='blood-drop-instances';this.stains.name='blood-stain-instances';
    for(const batch of [this.drops,this.stains]){
      batch.count=0;
      // The moving instances span rooms. Their tightly bounded population is
      // cheaper to submit than rebuilding their aggregate bounds every tick.
      batch.frustumCulled=false;
      batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(batch);
    }
  }
  /** The caller owns the shared image. Crop atlas cells through repeat/offset
   * before installing; alpha keeps the painted outline on walls and floors. */
  setIllustratedBlood(map:T.Texture){
    darkBlood.map=map;darkBlood.color.set(0xffffff);darkBlood.alphaTest=.35;darkBlood.needsUpdate=true;
    if(this.stains.geometry===smear)this.stains.geometry=new T.PlaneGeometry(2,2);
  }
  private isDrop(mesh:T.Object3D) {
    return mesh instanceof T.Mesh && mesh.geometry===droplet && mesh.material===blood;
  }
  private syncDrops() {
    let count=0;
    for(const particle of this.particles)if(this.isDrop(particle.mesh)){
      particle.mesh.updateMatrix();this.drops.setMatrixAt(count++,particle.mesh.matrix);
    }
    this.drops.count=count;this.drops.instanceMatrix.needsUpdate=true;
  }
  private syncStains() {
    this.stains.count=this.decals.length;
    this.decals.forEach((mesh,i)=>{mesh.updateMatrix();this.stains.setMatrixAt(i,mesh.matrix);});
    this.stains.instanceMatrix.needsUpdate=true;
  }
  reset() {
    this.particles.forEach((p) => {
      this.scene.remove(p.mesh);
      disposeSpriteFragment(p.mesh);
    });
    this.decals.forEach((p) => this.scene.remove(p));
    this.particles = [];
    this.decals = [];
    this.severed = 0;
    this.drops.count=this.stains.count=0;
  }
  add(
    mesh: T.Object3D,
    velocity: T.Vector3,
    life: number,
    gib = false,
    stain = true,
  ) {
    const limit = gib ? 28 : 140;
    const same = this.particles.filter((p) => p.gib === gib);
    if (same.length >= limit) {
      const old = same[0];
      this.scene.remove(old.mesh);
      disposeSpriteFragment(old.mesh);
      this.particles.splice(this.particles.indexOf(old), 1);
    }
    if(!this.isDrop(mesh))this.scene.add(mesh);
    let bounds:T.Box3|null=null;
    if(gib && !(mesh instanceof T.Sprite)){
      mesh.updateMatrixWorld(true);
      const inverse=mesh.matrixWorld.clone().invert(),relative=new T.Matrix4(),box=new T.Box3();
      bounds=new T.Box3();
      mesh.traverse(object=>{if(object instanceof T.Mesh){object.geometry.computeBoundingBox();relative.multiplyMatrices(inverse,object.matrixWorld);box.copy(object.geometry.boundingBox!).applyMatrix4(relative);bounds!.union(box);}});
      if(bounds.isEmpty())bounds.set(new T.Vector3(),new T.Vector3());
    }
    this.particles.push({
      mesh,
      velocity,
      spin: new T.Vector3(
        Math.random() * 7,
        Math.random() * 8,
        Math.random() * 5,
      ),
      life,
      gib,
      stain,
      sleeping:false,
      bounds,
    });
  }
  spray(point: T.Vector3, direction: T.Vector3, count = 18) {
    for (let i = 0; i < count; i++) {
      const mesh = new T.Mesh(droplet, blood);
      mesh.position.copy(point);
      const s = 0.025 + Math.random() * 0.043;
      mesh.scale.set(s, s * 0.65, s * (1.7 + Math.random()));
      const velocity = direction
        .clone()
        .multiplyScalar(2 + Math.random() * 4)
        .add(
          new T.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 3,
            (Math.random() - 0.5) * 4,
          ),
        );
      this.add(mesh, velocity, 0.7 + Math.random() * 0.55);
    }
    this.syncDrops();
  }
  stain(point: T.Vector3, normal: T.Vector3, size = 0.35) {
    while (this.decals.length >= 44) this.scene.remove(this.decals.shift()!);
    const m = new T.Mesh(smear, darkBlood);
    m.position
      .copy(point)
      .addScaledVector(normal, 0.016 + this.decals.length * 0.0001);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
    m.rotateZ(Math.random() * 6);
    m.scale.set(size, size * (0.55 + Math.random() * 0.65), 1);
    this.decals.push(m);
    this.syncStains();
  }
  sever(rig: Rig, part: BodyPart, direction: T.Vector3) {
    const source =
      part === "head"
        ? rig.head
        : part === "leftArm"
          ? rig.arms[0]
          : part === "rightArm"
            ? rig.arms[1]
            : part === "leftLeg"
              ? rig.legs[0]
              : part === "rightLeg"
                ? rig.legs[1]
                : null;
    if (!source || !source.visible) return false;
    rig.root.updateMatrixWorld(true);
    const illustrated = spriteFragment(rig, part);
    const piece = illustrated ?? source.clone(true);
    piece.traverse((o) => {
      if (o.userData.transientEffect) o.visible = false;
    });
    if (illustrated) source.getWorldPosition(piece.position);
    else
      source.matrixWorld.decompose(
        piece.position,
        piece.quaternion,
        piece.scale,
      );
    source.visible = false;
    piece.visible = true;
    piece.userData.severed = true;
    const position = piece.position.clone();
    this.add(
      piece,
      direction
        .clone()
        .multiplyScalar(4.5)
        .add(new T.Vector3((Math.random() - 0.5) * 3, 3.5, 0)),
      12,
      true,
    );
    this.spray(position, direction, 26);
    this.severed++;
    // The exposed stump stays attached to the surviving body.
    const cap = new T.Mesh(droplet, blood);
    cap.position.copy(source.position);
    cap.scale.set(0.12, 0.07, 0.12);
    source.parent?.add(cap);
    return true;
  }
  debris(
    point: T.Vector3,
    direction: T.Vector3,
    count = 12,
    material: T.Material = mats.bone,
    kind: "crate" | "barrel" | "urn" = "urn",
  ) {
    for (let i = 0; i < count; i++) {
      const mesh = new T.Mesh(
        kind === "crate" ? plank : kind === "barrel" ? scrap : chip,
        material,
      );
      mesh.position.copy(point);
      mesh.scale.set(
        0.6 + Math.random(),
        0.4 + Math.random() * 2,
        0.4 + Math.random(),
      );
      this.add(
        mesh,
        direction
          .clone()
          .multiplyScalar(2)
          .add(
            new T.Vector3(
              (Math.random() - 0.5) * 5,
              2 + Math.random() * 3,
              (Math.random() - 0.5) * 5,
            ),
          ),
        6,
        true,
        false,
      );
    }
  }
  update(dt: number, walls: Wall[]) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if(p.life<=0){this.scene.remove(p.mesh);disposeSpriteFragment(p.mesh);this.particles.splice(i,1);continue;}
      if(p.sleeping)continue;
      const before = this.before.copy(p.mesh.position);
      p.velocity.y -= dt * 10;
      const next = this.next.copy(before).addScaledVector(p.velocity, dt);
      if (p.gib) {
        moveCircle(
          p.mesh.position,
          p.velocity.x * dt,
          p.velocity.z * dt,
          0.14,
          nearbyWalls(walls,before,next,.56),
        );
        p.mesh.position.y = next.y;
        let bottom: number;
        if (p.mesh instanceof T.Sprite) {
          p.mesh.material.rotation += p.spin.z * dt;
          const angle = p.mesh.material.rotation;
          const halfHeight =
            (Math.abs(Math.sin(angle) * p.mesh.scale.x) +
              Math.abs(Math.cos(angle) * p.mesh.scale.y)) * 0.5;
          bottom = p.mesh.position.y - halfHeight;
        } else {
          p.mesh.rotation.x += p.spin.x * dt;
          p.mesh.rotation.z += p.spin.z * dt;
          p.mesh.updateMatrix();
          bottom = this.bounds.copy(p.bounds!).applyMatrix4(p.mesh.matrix).min.y;
        }
        if (bottom < 0.025) {
          p.mesh.position.y += 0.025 - bottom;
          p.velocity.y =
            Math.abs(p.velocity.y) > 0.8 ? -p.velocity.y * 0.17 : 0;
          p.velocity.x *= Math.exp(-dt * 8);
          p.velocity.z *= Math.exp(-dt * 8);
          p.spin.multiplyScalar(Math.exp(-dt * 9));
          if(p.velocity.lengthSq()<.0025&&p.spin.lengthSq()<.0025){p.sleeping=true;p.velocity.set(0,0,0);p.spin.set(0,0,0);}
          if (p.stain) {
            this.stain(
              p.mesh.position.clone().setY(0.025),
              new T.Vector3(0, 1, 0),
              0.4,
            );
            p.stain = false;
          }
        }
      } else {
        const hit = traceShot(before, next, nearbyWalls(walls,before,next), []);
        if (hit) {
          if (Math.random() < 0.28)
            this.stain(hit.point, hit.normal, 0.12 + Math.random() * 0.2);
          p.life = 0;
        } else if (next.y < 0.025) {
          if (Math.random() < 0.22)
            this.stain(
              next.setY(0.025),
              new T.Vector3(0, 1, 0),
              0.13 + Math.random() * 0.2,
            );
          p.life = 0;
        } else {
          p.mesh.position.copy(next);
          p.mesh.quaternion.setFromUnitVectors(
            new T.Vector3(0, 0, 1),
            p.velocity.clone().normalize(),
          );
        }
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        disposeSpriteFragment(p.mesh);
        this.particles.splice(i, 1);
      }
    }
    this.syncDrops();
  }
}
