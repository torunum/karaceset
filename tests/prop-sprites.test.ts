import { afterEach, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { PropSprites, propSpriteState } from "../src/prop-sprites";
import type { Breakable } from "../src/scenery";

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const scene = new T.Scene(), root = new T.Group(), damageVisual = new T.Group(), wreckage = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  root.add(body, damageVisual); wreckage.add(body.clone()); wreckage.visible = false;
  scene.add(root, wreckage);
  const prop: Breakable = { root, damageVisual, wreckage, propKind: "barrel", hp: 60, broken: false, position: new T.Vector3(0, .6, 0), radius: .46, state: "idle" };
  vi.spyOn(T.TextureLoader.prototype, "loadAsync").mockResolvedValue(new T.Texture());
  const sprites = new PropSprites(scene);
  return { scene, root, wreckage, body, prop, sprites };
}

describe("illustrated organic destructibles", () => {
  it("uses the same damage thresholds as gameplay, including zero-HP before broken is set", () => {
    expect(propSpriteState({ propKind: "barrel", hp: 31, broken: false })).toBe(0);
    expect(propSpriteState({ propKind: "barrel", hp: 30, broken: false })).toBe(1);
    expect(propSpriteState({ propKind: "crate", hp: 20, broken: false })).toBe(1);
    expect(propSpriteState({ propKind: "urn", hp: 0, broken: false })).toBe(2);
    expect(propSpriteState({ propKind: "urn", hp: 40, broken: true })).toBe(2);
  });

  it("keeps fallback geometry until load, then renders wreckage even when its intact root is hidden", async () => {
    const { sprites, scene, prop, root, wreckage, body } = fixture();
    sprites.update([prop], new T.Vector3(0, 1, 3));
    expect(body.layers.mask).toBe(1);
    expect(scene.getObjectByName("illustrated-barrel")).toBeUndefined();
    await sprites.load(); sprites.update([prop], new T.Vector3(0, 1, 3));
    expect(body.layers.mask >>> 0).toBe(0x80000000);
    expect(root.visible).toBe(true);
    prop.broken = true; prop.hp = 0; root.visible = false; wreckage.visible = true;
    sprites.update([prop], new T.Vector3(0, 1, 3));
    const mesh = scene.getObjectByName("illustrated-barrel")!;
    expect(mesh.visible).toBe(true); expect(mesh.userData.propState).toBe(2);
    scene.remove(wreckage);
    sprites.update([prop], new T.Vector3(0, 1, 3));
    expect(mesh.visible).toBe(false);
    sprites.dispose();
  });

  it("restores source layers and frees per-instance resources when reset or removed", async () => {
    const { sprites, scene, prop, body } = fixture();
    body.layers.set(2);
    await sprites.load(); sprites.update([prop], new T.Vector3());
    const mesh = scene.getObjectByName("illustrated-barrel") as T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
    const disposeMap = vi.spyOn(mesh.material.map!, "dispose");
    const disposeMaterial = vi.spyOn(mesh.material, "dispose");
    sprites.update([], new T.Vector3());
    expect(scene.getObjectByName("illustrated-barrel")).toBeUndefined();
    expect(body.layers.mask).toBe(4);
    expect(disposeMap).toHaveBeenCalledOnce(); expect(disposeMaterial).toHaveBeenCalledOnce();
    sprites.update([prop], new T.Vector3()); sprites.reset();
    expect(body.layers.mask).toBe(4);
    expect(scene.getObjectByName("illustrated-barrel")).toBeUndefined();
    sprites.dispose();
  });
});
