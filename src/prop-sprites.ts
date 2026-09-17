import * as T from "three";
import type { Breakable } from "./scenery";

type Kind = Breakable["propKind"];
type Entry = {
  mesh: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
  texture: T.Texture;
  hidden: Map<T.Mesh, number>;
};

// Explicit atlas rectangles preserve the irregular spacing of the original art.
// Values are measured in source pixels, without resampling or editing the PNG.
export const PROP_ATLAS = {
  barrel: { top: 0, height: 449, feet: [418, 420, 421], metresPerPixel: 0.00315 },
  crate: { top: 449, height: 340, feet: [321, 319, 318], metresPerPixel: 0.0033 },
  urn: { top: 789, height: 465, feet: [411, 411, 415], metresPerPixel: 0.0028 },
} as const;

export function propSpriteState(prop: Pick<Breakable, "broken" | "hp" | "propKind">): 0 | 1 | 2 {
  if (prop.broken || prop.hp <= 0) return 2;
  return prop.hp <= (prop.propKind === "barrel" ? 30 : 20) ? 1 : 0;
}

/** Illustrated destructibles retain the existing targets, damage groups and
 * collision radii. Only render layers are replaced after the atlas has loaded. */
export class PropSprites {
  ready = false;
  private atlas?: T.Texture;
  private entries = new Map<Breakable, Entry>();
  private position = new T.Vector3();

  constructor(private scene: T.Scene) {}

  async load() {
    if (this.ready) return;
    const atlas = await new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}sprites/organic-props.png`);
    atlas.colorSpace = T.SRGBColorSpace;
    atlas.magFilter = atlas.minFilter = T.NearestFilter;
    atlas.generateMipmaps = false;
    this.atlas = atlas;
    this.ready = true;
  }

  update(props: readonly Breakable[], camera: T.Vector3) {
    if (!this.ready || !this.atlas) return;
    const retained = new Set(props);
    for (const [prop, entry] of this.entries) {
      if (!retained.has(prop)) this.retire(prop, entry);
    }
    for (const prop of props) {
      let entry = this.entries.get(prop);
      if (!entry) {
        const texture = this.atlas.clone();
        const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
          map: texture, alphaTest: 0.45, side: T.DoubleSide, toneMapped: false, fog: true,
        }));
        mesh.name = `illustrated-${prop.propKind}`;
        mesh.userData.visualStyle = "organic-prop-atlas";
        entry = { mesh, texture, hidden: new Map() };
        this.entries.set(prop, entry);
        this.scene.add(mesh);
      }
      // Traverse again to also suppress any asynchronously loaded Blender meshes.
      for (const root of [prop.root, prop.wreckage]) root.traverse((object) => {
        if (object instanceof T.Mesh) {
          if (!entry!.hidden.has(object)) entry!.hidden.set(object, object.layers.mask);
          object.layers.set(31);
        }
      });
      const state = propSpriteState(prop);
      const spec = PROP_ATLAS[prop.propKind as Kind];
      entry.texture.repeat.set(418 / 1254, spec.height / 1254);
      entry.texture.offset.set(state / 3, 1 - (spec.top + spec.height) / 1254);
      const owner = state === 2 ? prop.wreckage : prop.root;
      owner.getWorldPosition(this.position);
      entry.mesh.position.copy(this.position);
      entry.mesh.position.y += (spec.feet[state] - spec.height / 2) * spec.metresPerPixel;
      entry.mesh.scale.set(418 * spec.metresPerPixel, spec.height * spec.metresPerPixel, 1);
      entry.mesh.rotation.set(0, Math.atan2(camera.x - this.position.x, camera.z - this.position.z), 0);
      // Detached/hidden scenery must not leave independently parented sprites.
      let ancestor: T.Object3D | null = owner;
      let visible = true;
      while (ancestor && ancestor !== this.scene) {
        if (!ancestor.visible) visible = false;
        ancestor = ancestor.parent;
      }
      entry.mesh.visible = visible && ancestor === this.scene;
      entry.mesh.userData.propState = state;
      prop.root.userData.spriteState = state;
    }
  }

  private retire(prop: Breakable, entry: Entry) {
    this.scene.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    entry.mesh.material.dispose();
    entry.texture.dispose();
    for (const [mesh, mask] of entry.hidden) mesh.layers.mask = mask;
    this.entries.delete(prop);
  }

  reset() {
    for (const [prop, entry] of this.entries) this.retire(prop, entry);
  }

  dispose() {
    this.reset();
    this.atlas?.dispose();
    this.atlas = undefined;
    this.ready = false;
  }
}
