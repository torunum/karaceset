import { describe, expect, it } from "vitest";
import * as T from "three";
import { installBlenderHands, installBlenderKick, installOrganicWeapon } from "../src/blender-arsenal";
import type { AnimatedWeapon } from "../src/weapon-motion";
import { readFileSync } from "node:fs";

function surface() { return new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()); }
function scene(names: string[]) {
  const root = new T.Group();
  for (const name of names) {
    const anchor = new T.Group(); anchor.name = name; anchor.add(surface()); root.add(anchor);
  }
  return root;
}
function gun(): AnimatedWeapon {
  const root = new T.Group(), mechanism = new T.Group();
  mechanism.add(surface()); root.add(surface(), mechanism);
  for (const key of ["triggerHand", "supportHand"]) {
    const hand = new T.Group(); hand.add(surface()); root.add(hand); root.userData[key] = hand;
  }
  return { root, mechanism, jaws: [], tendons: [] };
}

describe("Blender viewmodel contracts", () => {
  it("ships real packed GLBs with finite mesh bounds, UVs and required anchors", () => {
    const assets = {
      ossuary: ["femur_body", "femur_mechanism", "femur_jaw_0", "femur_jaw_1"],
      tithe: ["acid_body", "acid_mechanism", "acid_jaw_0", "acid_jaw_1"],
      "warden-hands": ["trigger_hand", "support_hand"],
      "warden-kick": ["kick_thigh", "kick_shin", "kick_boot"],
    };
    for (const [name, required] of Object.entries(assets)) {
      const data = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
      expect(data.readUInt32LE(0)).toBe(0x46546c67);
      const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
      const names = json.nodes.map((n: { name?: string }) => n.name);
      for (const anchor of required) expect(names).toContain(anchor);
      for (const mesh of json.meshes) for (const p of mesh.primitives) {
        expect(p.attributes.TEXCOORD_0).toBeTypeOf("number");
        expect(p.attributes.NORMAL).toBeTypeOf("number");
        const accessor = json.accessors[p.attributes.POSITION];
        expect([...accessor.min, ...accessor.max].every(Number.isFinite)).toBe(true);
      }
      expect(json.images.length).toBeGreaterThan(0);
      expect(json.images.every((i: { bufferView?: number }) => typeof i.bufferView === "number")).toBe(true);
    }
  });
  it("validates complete organic anchors before altering the current weapon", () => {
    const rig = gun(), original = [...rig.root.children];
    expect(() => installOrganicWeapon(rig, scene(["femur_body", "femur_mechanism"]), "femur")).toThrow("femur_jaw_0");
    expect(rig.root.children).toEqual(original);
  });
  it("replaces organic rigid surfaces and keeps loaded hand anchors in either load order", () => {
    for (const handsFirst of [false, true]) {
      const rig = gun(), old = rig.root.children[0], hand = rig.root.userData.triggerHand;
      const hands = scene(["trigger_hand", "support_hand"]);
      const mesh = hands.getObjectByName("trigger_hand")!.children[0];
      if (handsFirst) installBlenderHands(rig, hands);
      installOrganicWeapon(rig, scene(["femur_body", "femur_mechanism", "femur_jaw_0", "femur_jaw_1"]), "femur");
      if (!handsFirst) installBlenderHands(rig, hands);
      expect(old.parent).toBeNull();
      expect(rig.root.userData.triggerHand).toBe(hand);
      expect(mesh.parent).toBe(hand);
      expect(rig.jaws).toHaveLength(2);
      expect(rig.mechanism.parent).toBe(rig.root);
    }
  });
  it("replaces kick meshes while preserving live joint transforms and hierarchy", () => {
    const root = new T.Group(), thigh = new T.Group(), shin = new T.Group(), boot = new T.Group();
    root.add(thigh); thigh.add(shin); shin.add(boot);
    [thigh, shin, boot].forEach((o) => o.add(surface()));
    shin.position.y = -.4; boot.position.y = -.4; thigh.rotation.x = 1.2;
    installBlenderKick({ root, thigh, shin, boot }, scene(["kick_thigh", "kick_shin", "kick_boot"]));
    expect(shin.parent).toBe(thigh); expect(boot.parent).toBe(shin);
    expect(shin.position.y).toBe(-.4); expect(boot.position.y).toBe(-.4);
    expect(thigh.rotation.x).toBe(1.2);
    expect(thigh.children.filter((o) => o instanceof T.Mesh)).toHaveLength(1);
  });
});
