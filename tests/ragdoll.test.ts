import { describe, it, expect } from "vitest";
import * as T from "three";
import { CorpseRagdoll } from "../src/ragdoll";
import type { Rig } from "../src/art";
function rig(): Rig {
  const root = new T.Group(),
    body = new T.Group(),
    head = new T.Group(),
    sac = new T.Mesh();
  root.add(body);
  body.add(head, sac);
  head.position.y = 1.5;
  const arms = [new T.Group(), new T.Group()],
    legs = [new T.Group(), new T.Group()];
  arms.forEach((a, i) => {
    body.add(a);
    a.position.set(i ? 0.35 : -0.35, 1.35, 0);
  });
  legs.forEach((l, i) => {
    root.add(l);
    l.position.set(i ? 0.18 : -0.18, 0.8, 0);
  });
  return { root, body, head, sac, arms, legs };
}
describe("physical death", () => {
  it("falls to floor with constrained joints, preserves severed visibility and settles", () => {
    const r = rig();
    new T.Scene().add(r.root);
    r.arms[0].visible = false;
    const d = new CorpseRagdoll(r, new T.Vector3(0, 0, -3));
    for (let i = 0; i < 260; i++) d.update(1 / 60, []);
    expect(d.settled).toBe(true);
    expect(r.arms[0].visible).toBe(false);
    expect(d.nodes[0].position.y).toBeLessThan(0.5);
    for (const n of d.nodes)
      expect(n.position.y).toBeGreaterThanOrEqual(n.radius - 1e-6);
    for (const l of d.links)
      expect(
        Math.abs(
          d.nodes[l.a].position.distanceTo(d.nodes[l.b].position) - l.length,
        ),
      ).toBeLessThan(0.09);
  });
  it("sweeps high impulse against walls and never tunnels joints through", () => {
    const r = rig();
    new T.Scene().add(r.root);
    const d = new CorpseRagdoll(r, new T.Vector3(0, 0, -20));
    const walls = [{ a: { x: -10, z: -1 }, b: { x: 10, z: -1 }, height: 5 },
      ...Array.from({length:20},(_,i)=>({a:{x:100+i,z:100},b:{x:100+i,z:105},height:5}))];
    for (let i = 0; i < 90; i++) d.update(1 / 60, walls);
    for (const n of d.nodes)
      expect(n.position.z).toBeGreaterThanOrEqual(-1 + n.radius - 0.005);
  });
});
