import * as T from "three";
import { moveCircle, type Wall } from "./combat";
import type { Rig } from "./art";
import {nearbyWalls} from './collision-grid';

interface Node {
  position: T.Vector3;
  previous: T.Vector3;
  radius: number;
}
interface Link {
  a: number;
  b: number;
  length: number;
}
interface Binding {
  mesh: T.Object3D;
  start: number;
  end: number;
  axis: T.Vector3;
  rotation: T.Quaternion;
  offset: T.Vector3;
  scale: T.Vector3;
}

/** Small position-based ragdoll. A braced torso and five freely rotating limbs share joint particles. */
export class CorpseRagdoll {
  nodes: Node[] = [];
  links: Link[] = [];
  bindings: Binding[] = [];
  elapsed = 0;
  settled = false;
  private quietTime=0;
  private velocity=new T.Vector3();
  private correction=new T.Vector3();
  private corrected=new T.Vector3();
  private torsoRotation: T.Quaternion;
  private torsoOffset: T.Vector3;
  private initialBasis: T.Quaternion;
  private torsoScale: T.Vector3;
  constructor(
    public rig: Rig,
    impulse: T.Vector3,
  ) {
    rig.root.updateMatrixWorld(true);
    const world = (o: T.Object3D, p = new T.Vector3()) =>
      o.localToWorld(p.clone());
    const add = (position: T.Vector3, radius: number) => {
      const velocity = impulse.clone().add(new T.Vector3(0, 0.5, 0));
      // Higher joints receive more impulse, so the body topples instead of dropping vertically.
      velocity.multiplyScalar(0.65 + position.y * 0.32);
      this.nodes.push({
        position,
        previous: position.clone().addScaledVector(velocity, -1 / 60),
        radius,
      });
      return this.nodes.length - 1;
    };
    add(world(rig.root, new T.Vector3(0, 0.8, 0)), 0.2); // pelvis
    add(world(rig.head), 0.16); // neck
    rig.arms.forEach((a) => add(world(a), 0.13));
    rig.legs.forEach((l) => add(world(l), 0.16));
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) this.link(a, b);
    const bind = (
      mesh: T.Object3D,
      start: number,
      localEnd: T.Vector3,
      radius: number,
    ) => {
      const position = world(mesh),
        end = add(world(mesh, localEnd), radius);
      this.link(start, end);
      this.bindings.push({
        mesh,
        start,
        end,
        axis: this.nodes[end].position
          .clone()
          .sub(this.nodes[start].position)
          .normalize(),
        rotation: mesh.getWorldQuaternion(new T.Quaternion()),
        offset: position.sub(this.nodes[start].position),
        scale: mesh.getWorldScale(new T.Vector3()),
      });
    };
    bind(rig.head, 1, new T.Vector3(0, 0.25, 0), 0.17);
    rig.arms.forEach((a, i) =>
      bind(a, 2 + i, new T.Vector3(0, -0.67, 0), 0.12),
    );
    rig.legs.forEach((l, i) =>
      bind(l, 4 + i, new T.Vector3(0, -0.73, -0.04), 0.15),
    );
    this.torsoRotation = rig.body.getWorldQuaternion(new T.Quaternion());
    this.torsoScale = rig.body.getWorldScale(new T.Vector3());
    this.torsoOffset = rig.body
      .getWorldPosition(new T.Vector3())
      .sub(this.nodes[0].position);
    this.initialBasis = this.basis();
    // Preserve world transforms before replacing animation with physical transforms.
    for (const child of [...rig.root.children])
      if (child !== rig.body && !this.bindings.some((b) => b.mesh === child))
        rig.body.attach(child);
    for (const b of this.bindings) rig.root.attach(b.mesh);
    rig.root.position.set(0, 0, 0);
    rig.root.quaternion.identity();
    rig.root.scale.setScalar(1);
    this.apply();
  }
  private link(a: number, b: number) {
    this.links.push({
      a,
      b,
      length: this.nodes[a].position.distanceTo(this.nodes[b].position),
    });
  }
  private basis() {
    const y = this.nodes[1].position
      .clone()
      .sub(this.nodes[0].position)
      .normalize();
    const x = this.nodes[3].position
      .clone()
      .sub(this.nodes[2].position)
      .normalize();
    const z = x.clone().cross(y).normalize();
    x.copy(y).cross(z).normalize();
    return new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().makeBasis(x, y, z),
    );
  }
  update(dt: number, walls: Wall[]) {
    if (this.settled || !this.rig.root.parent) return;
    const steps = Math.max(1, Math.ceil(dt / (1 / 60))),
      h = dt / steps;
    for (let step = 0; step < steps; step++) {
      this.elapsed += h;
      for (const n of this.nodes) {
        const velocity = this.velocity.copy(n.position)
          .sub(n.previous)
          .multiplyScalar(0.982);
        n.previous.copy(n.position);
        n.position.add(velocity);
        n.position.y -= 13 * h * h;
      }
      for (let k = 0; k < 10; k++) {
        for (const l of this.links) {
          const a = this.nodes[l.a].position,
            b = this.nodes[l.b].position,
            delta = this.correction.copy(b).sub(a),
            distance = delta.length();
          if (distance < 1e-6) continue;
          delta.multiplyScalar(((distance - l.length) / distance) * 0.5);
          a.add(delta);
          b.sub(delta);
        }
        for (const n of this.nodes) {
          const corrected = this.corrected.copy(n.previous);
          moveCircle(
            corrected,
            n.position.x - corrected.x,
            n.position.z - corrected.z,
            n.radius,
            nearbyWalls(walls,corrected,n.position,n.radius*4),
          );
          n.position.x = corrected.x;
          n.position.z = corrected.z;
          if (n.position.y < n.radius) {
            n.position.y = n.radius;
            n.previous.x += (n.position.x - n.previous.x) * 0.22;
            n.previous.z += (n.position.z - n.previous.z) * 0.22;
            n.previous.y = n.position.y;
          }
        }
      }
      const quiet=this.nodes.every(n=>n.position.distanceToSquared(n.previous)<0.000004);
      this.quietTime=quiet?this.quietTime+h:0;
    }
    this.apply();
    if (this.elapsed > 4 || (this.elapsed>1 && this.quietTime>.45)) this.settled = true;
  }
  private apply() {
    const rotation = this.basis().multiply(this.initialBasis.clone().invert());
    this.rig.body.position
      .copy(this.torsoOffset)
      .applyQuaternion(rotation)
      .add(this.nodes[0].position);
    this.rig.body.quaternion.copy(rotation).multiply(this.torsoRotation);
    this.rig.body.scale.copy(this.torsoScale);
    for (const b of this.bindings) {
      const axis = this.nodes[b.end].position
        .clone()
        .sub(this.nodes[b.start].position)
        .normalize();
      const q = new T.Quaternion().setFromUnitVectors(b.axis, axis);
      b.mesh.position
        .copy(b.offset)
        .applyQuaternion(q)
        .add(this.nodes[b.start].position);
      b.mesh.quaternion.copy(q).multiply(b.rotation);
      b.mesh.scale.copy(b.scale);
    }
  }
}
