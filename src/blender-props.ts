import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Breakable } from "./scenery";

let asset: Promise<T.Group> | undefined;
function loadAsset() {
  return (asset ??= new GLTFLoader()
    .loadAsync(`${import.meta.env.BASE_URL}models/props.glb`)
    .then((gltf) => gltf.scene)
    .catch((error) => {
      asset = undefined;
      throw error;
    }));
}

/** Preserve collision targets and the existing damage/reset groups. Model geometry
 * and materials are shared between instances, so these clones must not be disposed
 * individually. Every asset is authored in metres with its base on y = 0.
 */
export async function loadBlenderProps(props: Breakable[]): Promise<number> {
  const library = await loadAsset();
  // Validate the complete library before replacing any scene object.
  const templates = new Map<string, T.Object3D>();
  for (const kind of ["crate", "barrel", "urn"]) {
    for (const state of ["intact", "damage", "wreckage"]) {
      const name = `${kind}_${state}`;
      const template = library.getObjectByName(name);
      if (!template) throw new Error(`Blender props: missing ${name}`);
      templates.set(name, template);
    }
  }
  let changed = 0;
  for (const prop of props) {
    if (prop.root.userData.blenderAsset === "props-v1") continue;
    const clone = (state: string) => {
      const model = templates.get(`${prop.propKind}_${state}`)!.clone(true);
      model.traverse((object) => {
        if (object instanceof T.Mesh) {
          object.castShadow = state === "intact";
          object.receiveShadow = true;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of materials) {
            if (material instanceof T.MeshStandardMaterial && material.map) {
              material.map.anisotropy = 4;
            }
          }
        }
      });
      return model;
    };
    const retired: T.BufferGeometry[] = [];
    const collect = (root: T.Object3D) =>
      root.traverse((o) => {
        // batchRigid creates uniquely owned BufferGeometry; primitive helper
        // geometries can be shared with living scenery and must stay allocated.
        if (o instanceof T.Mesh && o.geometry.type === "BufferGeometry")
          retired.push(o.geometry);
      });
    for (const child of [...prop.root.children]) {
      if (child !== prop.damageVisual) {
        collect(child);
        prop.root.remove(child);
      }
    }
    prop.root.add(clone("intact"));
    collect(prop.damageVisual);
    collect(prop.wreckage);
    prop.damageVisual.clear();
    prop.damageVisual.add(clone("damage"));
    prop.wreckage.clear();
    prop.wreckage.add(clone("wreckage"));
    prop.root.userData.blenderAsset = "props-v1";
    new Set(retired).forEach((geometry) => geometry.dispose());
    changed++;
  }
  return changed;
}

/** Swap named static-art slots only; architecture, lights and collision remain
 * owned by the level. Altar placement is also used by the original main level.
 */
export async function loadBlenderScenery(
  levelRoot: T.Object3D,
): Promise<number> {
  const library = await loadAsset();
  const altar = library.getObjectByName("altar_intact");
  const lantern = library.getObjectByName("lantern_intact");
  if (!altar || !lantern)
    throw new Error("Blender scenery: incomplete fixture library");
  const slots: T.Object3D[] = [];
  levelRoot.traverse((object) => {
    if (object.userData.blenderSlot && !object.userData.blenderAsset)
      slots.push(object);
  });
  let changed = 0;
  for (const slot of slots) {
    if (
      slot.name !== "blender-altar-slot" &&
      slot.name !== "blender-hanging-fixtures"
    )
      continue;
    // These groups contain shared primitive geometries/materials; retain them.
    slot.clear();
    if (slot.name === "blender-altar-slot") slot.add(altar.clone(true));
    else {
      for (const x of [-3.9, 3.9])
        for (const z of [-5, 1.2]) {
          const model = lantern.clone(true);
          model.position.set(x, 3.91, z);
          slot.add(model);
        }
    }
    slot.traverse((object) => {
      if (object instanceof T.Mesh) {
        object.receiveShadow = true;
        object.castShadow = false;
      }
    });
    slot.userData.blenderAsset = "props-v1";
    changed++;
  }
  return changed;
}
