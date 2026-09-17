import * as T from "three";
import type { Rig } from "./art";
import type { BodyPart, EnemyState } from "./combat";
import { headContour, headBounds, headMaskGLSL } from "./sprite-heads";
import {
  enemySpriteFrame,
  enemySpriteDirection,
  executionerSpriteFrame,
  executionerWalkCell,
} from "./enemy-sprite-motion";

interface Actor {
  rig: Rig;
  kind: string;
  state: EnemyState;
  position: T.Vector3;
  hp: number;
  phase: number;
  timer?: number;
  lostParts: Set<BodyPart>;
}
interface Entry {
  mesh: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
  map: T.Texture;
  actionMap: T.Texture;
  directionMap: T.Texture;
  walkMap?: T.Texture;
  keyed: { value: number };
  state: EnemyState;
  enteredAt: number;
  frame: number;
  missing: number[];
  corpse: { value: number };
  flash: T.Sprite;
  profile: SpriteProfile;
  floorClip: { value: number };
  head: T.Vector2[];
}
const entriesByRig = new WeakMap<Rig, Entry>();
const partNames: BodyPart[] = [
  "head",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
];
// Local sprite UV rectangles. Kept narrow to avoid removing the crossed weapon
// and torso when a peripheral limb is lost. These are cutouts, not skeletal skinning.
const cuts = [
  new T.Vector4(0.34, 0.72, 0.67, 0.97),
  new T.Vector4(0.66, 0.35, 0.83, 0.66),
  new T.Vector4(0.2, 0.35, 0.37, 0.66),
  new T.Vector4(0.52, 0.04, 0.72, 0.32),
  new T.Vector4(0.29, 0.04, 0.47, 0.32),
];
const deadCuts = [
  new T.Vector4(0.04, 0.09, 0.34, 0.34),
  new T.Vector4(0.16, 0.02, 0.35, 0.13),
  new T.Vector4(0.35, 0.02, 0.51, 0.13),
  new T.Vector4(0.72, 0.06, 0.97, 0.17),
  new T.Vector4(0.63, 0.15, 0.93, 0.27),
];
interface SpriteProfile {
  texture: T.Texture;
  directions?: T.Texture;
  walk?: T.Texture;
  size: number;
  ground: number[];
  cuts: T.Vector4[];
  deadCuts: T.Vector4[];
  name: string;
}
const executionerCuts = [
  new T.Vector4(0.41, 0.76, 0.6, 0.98),
  new T.Vector4(0.63, 0.42, 0.79, 0.7),
  new T.Vector4(0.27, 0.4, 0.43, 0.69),
  new T.Vector4(0.57, 0.07, 0.78, 0.32),
  new T.Vector4(0.23, 0.07, 0.42, 0.32),
];
const executionerDeadCuts = [
  new T.Vector4(0.02, 0.08, 0.2, 0.26),
  new T.Vector4(0.23, 0.05, 0.43, 0.16),
  new T.Vector4(0.22, 0.2, 0.43, 0.31),
  new T.Vector4(0.7, 0.06, 0.97, 0.16),
  new T.Vector4(0.68, 0.18, 0.97, 0.27),
];
// Measured opaque bottom margins of the delivered cells, in cell-height units.
// Align soles/corpse to the floor without altering or stretching the artwork.
const actionGround = [
  0.03157, 0.03833, 0.06088, 0.06088, 0.05862, 0.05862, 0.07666, 0.0699,
];
const directionGround = [
  0.02706, 0.03157, 0.02255, 0.04961, 0.07666, 0.06539, 0.05637, 0.02706,
];
// The turnaround source has a baked neutral backdrop. Rendering keys only that
// bright, nearly achromatic palette; the RGBA action sheet needs no keying.
const paletteKey = `float lo=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
float hi=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
if(lo>.60 && hi-lo<.035) discard;`;
function flashTexture() {
  const n = 24,
    data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = x - n / 2,
        dy = y - n / 2,
        r = Math.hypot(dx, dy),
        a = Math.atan2(dy, dx);
      const reach = 5 + 5 * Math.pow(Math.cos(a * 4), 8);
      if (r > reach) continue;
      const i = (y * n + x) * 4;
      data[i] = 255;
      data[i + 1] = r < 4 ? 242 : 137;
      data[i + 2] = r < 3 ? 167 : 23;
      data[i + 3] = 255;
    }
  const map = new T.DataTexture(data, n, n);
  map.magFilter = map.minFilter = T.NearestFilter;
  map.needsUpdate = true;
  return map;
}
function frameUV(map: T.Texture, frame: number) {
  map.repeat.set(0.25, 0.5);
  map.offset.set((frame % 4) / 4, (1 - Math.floor(frame / 4)) / 2);
}
function maskMaterial(
  map: T.Texture,
  missing: number[],
  corpse: { value: number },
  keyed: { value: number },
  profile: SpriteProfile,
  floorClip: { value: number },
  head: T.Vector2[],
) {
  const material = new T.MeshBasicMaterial({
    map,
    alphaTest: 0.45,
    side: T.DoubleSide,
    toneMapped: false,
    fog: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.cultMissing = { value: missing };
    shader.uniforms.cultCuts = { value: profile.cuts };
    shader.uniforms.cultDeadCuts = { value: profile.deadCuts };
    shader.uniforms.cultCorpse = corpse;
    shader.uniforms.cultKeyed = keyed;
    shader.uniforms.spriteFloorClip = floorClip;
    shader.uniforms.spriteHead = { value: head };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 cultUV;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\ncultUV=uv;");
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec2 cultUV;\nuniform float cultMissing[5];\nuniform vec4 cultCuts[5];\nuniform vec4 cultDeadCuts[5];\nuniform float cultCorpse;\nuniform float cultKeyed;\nuniform float spriteFloorClip;" +
        headMaskGLSL,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      if(cultUV.y<spriteFloorClip) discard;
      if(cultKeyed>1.5){
        if(diffuseColor.r>.12 && diffuseColor.b>.12 && diffuseColor.g<min(diffuseColor.r,diffuseColor.b)*.45) discard;
      } else if(cultKeyed>.5){${paletteKey}}
      if(cultMissing[0]>.5 && insideSpriteHead(cultUV)) discard;
      for(int i=1;i<5;i++){
        vec4 r=mix(cultCuts[i],cultDeadCuts[i],cultCorpse);
        if(cultMissing[i]>.5 && cultUV.x>r.x && cultUV.y>r.y && cultUV.x<r.z && cultUV.y<r.w) discard;
      }`,
    );
  };
  material.customProgramCacheKey = () => "cult-sprite-contoured-head-v4";
  return material;
}

/** Cylindrical billboards keep the painted silhouette upright while walls still
 * occlude it through the normal depth buffer. Collision joints remain in 3D. */
export class CultSprites {
  private profiles = new Map<string, SpriteProfile>();
  private entries = new Map<Rig, Entry>();
  private flashMap = flashTexture();
  ready = false;
  constructor(private scene: T.Scene) {}
  async load() {
    const texture = async (file: string) => {
      const map = await new T.TextureLoader().loadAsync(
        `${import.meta.env.BASE_URL}sprites/${file}`,
      );
      map.colorSpace = T.SRGBColorSpace;
      map.magFilter = map.minFilter = T.NearestFilter;
      map.generateMipmaps = false;
      return map;
    };
    await Promise.all([
      (async () => {
        try {
          const map = await texture("cult-enforcer.png");
          let directions: T.Texture | undefined;
          try {
            directions = await texture("cult-directions.png");
          } catch (error) {
            console.warn(
              "Cult turnaround unavailable; keeping front frames",
              error,
            );
          }
          this.profiles.set("cultist", {
            texture: map,
            directions,
            size: 2.1,
            ground: actionGround,
            cuts,
            deadCuts,
            name: "cult-enforcer",
          });
        } catch (error) {
          console.warn("Cult sprite unavailable; preserving 3D model", error);
        }
      })(),
      (async () => {
        try {
          const map = await texture("executioner.png");
          let walk: T.Texture | undefined;
          try { walk = await texture("executioner-walk.png"); }
          catch (error) { console.warn("Executioner forward walk unavailable", error); }
          this.profiles.set("shambler", {
            texture: map,
            walk,
            size: 2.3,
            ground: [
              0.0665, 0.0755, 0.0665, 0.0665, 0.0665, 0.054, 0.0665, 0.027,
            ],
            cuts: executionerCuts,
            deadCuts: executionerDeadCuts,
            name: "executioner",
          });
        } catch (error) {
          console.warn(
            "Executioner sprite unavailable; preserving 3D model",
            error,
          );
        }
      })(),
    ]);
    // Publish only after every optional atlas has settled, so partial loads can
    // never leave a direction entry permanently bound to an action texture.
    this.ready = true;
  }
  reset() {
    for (const [rig, e] of this.entries) {
      this.retire(rig, e);
    }
    this.entries.clear();
  }
  private retire(rig: Rig, e: Entry) {
    this.scene.remove(e.mesh, e.flash);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
    e.actionMap.dispose();
    e.directionMap.dispose();
    e.walkMap?.dispose();
    e.flash.material.dispose();
    entriesByRig.delete(rig);
    this.entries.delete(rig);
  }
  update(actors: Actor[], camera: T.Vector3, time: number) {
    if (!this.ready) return;
    for (const actor of actors) {
      const profile = this.profiles.get(actor.kind);
      if (!profile) continue;
      const size = profile.size;
      let entry = this.entries.get(actor.rig);
      if (actor.rig.root.parent !== this.scene) {
        if (entry) this.retire(actor.rig, entry);
        continue;
      }
      if (!entry) {
        const map = profile.texture.clone();
        const directionMap = (profile.directions ?? profile.texture).clone(),
          keyed = { value: 0 };
        const missing = [0, 0, 0, 0, 0],
          corpse = { value: 0 },
          floorClip = { value: 0 };
        const head = headContour(profile.name, 0).map(
          (p) => new T.Vector2(...p),
        );
        const mesh = new T.Mesh(
          new T.PlaneGeometry(size, size),
          maskMaterial(map, missing, corpse, keyed, profile, floorClip, head),
        );
        mesh.name = `${profile.name}-pixel-sprite`;
        mesh.frustumCulled = false;
        const flash = new T.Sprite(
          new T.SpriteMaterial({
            map: this.flashMap,
            transparent: true,
            blending: T.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        flash.name = "cult-pixel-muzzle-flash";
        flash.scale.set(0.27, 0.27, 1);
        this.scene.add(flash);
        entry = {
          mesh,
          profile,
          floorClip,
          head,
          map,
          actionMap: map,
          directionMap,
          walkMap: profile.walk?.clone(),
          keyed,
          missing,
          corpse,
          flash,
          state: actor.state,
          enteredAt: time,
          frame: 0,
        };
        this.entries.set(actor.rig, entry);
        entriesByRig.set(actor.rig, entry);
        this.scene.add(mesh);
        actor.rig.root.userData.visualStyle = `pixel-${profile.name}`;
      }
      // Mesh-only layers retain group visibility flags used by severing and AI.
      // Newly created blood stumps are included without exposing the proxy rig.
      actor.rig.root.traverse((o) => {
        if (o instanceof T.Mesh && o.userData.organicItem!=='femur') o.layers.set(31);
      });
      const firedAt = actor.rig.root.userData.spriteFiredAt as
        number | undefined;
      if (entry.state !== actor.state) {
        entry.enteredAt =
          actor.state === "chase" &&
          firedAt !== undefined &&
          firedAt >= entry.enteredAt
            ? firedAt
            : time;
        entry.state = actor.state;
      }
      const pose = {
        state: actor.state,
        moving: !!actor.rig.root.userData.moving,
        time: time + actor.phase * 0.05,
        enteredAt: entry.enteredAt + actor.phase * 0.05,
        firedAt:
          firedAt === undefined ? undefined : firedAt + actor.phase * 0.05,
      };
      entry.frame =
        actor.kind === "shambler"
          ? executionerSpriteFrame(pose, actor.timer)
          : enemySpriteFrame(pose);
      const walkCell = entry.walkMap ? executionerWalkCell(pose) : null;
      headContour(walkCell === null ? profile.name : "executioner-walk", walkCell ?? entry.frame).forEach((p, i) =>
        entry!.head[i].set(...p),
      );
      // The raised cleaver in row two intrudes into the idle cell bottom gutter.
      entry.floorClip.value =
        actor.kind === "shambler" && entry.frame === 0 ? 0.055 : 0;
      const direction = enemySpriteDirection(
        actor.rig.root.rotation.y,
        Math.atan2(
          -(camera.x - actor.position.x),
          -(camera.z - actor.position.z),
        ),
      );
      const useDirection =
        !!profile.directions &&
        direction !== 0 &&
        entry.frame === 0 &&
        actor.lostParts.size === 0 &&
        actor.rig.head.visible;
      entry.map = walkCell !== null ? entry.walkMap! : useDirection ? entry.directionMap : entry.actionMap;
      entry.keyed.value = walkCell !== null ? 2 : useDirection ? 1 : 0;
      entry.mesh.material.map = entry.map;
      if (walkCell !== null) {
        entry.map.repeat.set(.5,.5);
        entry.map.offset.set((walkCell % 2)/2,(1-Math.floor(walkCell/2))/2);
      } else frameUV(entry.map, useDirection ? direction : entry.frame);
      actor.rig.root.userData.spriteDirection = useDirection ? direction : 0;
      const dead = actor.state === "dead";
      entry.corpse.value = dead ? 1 : 0;
      partNames.forEach(
        (part, i) => (entry!.missing[i] = actor.lostParts.has(part) ? 1 : 0),
      );
      // Gore hides the joint before the caller adds lostParts. Preserve that
      // immediate removal across death/pose transitions and intervening renders.
      if (!actor.rig.head.visible) entry.missing[0] = 1;
      const ground = walkCell !== null ? [57,50,48,48][walkCell]/627 : useDirection
        ? directionGround[direction]
        : profile.ground[entry.frame];
      entry.mesh.position.set(
        actor.position.x,
        size * (0.5 - ground),
        actor.position.z,
      );
      entry.mesh.rotation.y = Math.atan2(
        camera.x - actor.position.x,
        camera.z - actor.position.z,
      );
      if (walkCell !== null) {
        const centreOffset = (313.5 - [326,289,326,289][walkCell])/627 * size;
        entry.mesh.position.x += Math.cos(entry.mesh.rotation.y) * centreOffset;
        entry.mesh.position.z -= Math.sin(entry.mesh.rotation.y) * centreOffset;
      }
      entry.mesh.visible = actor.rig.root.visible;
      entry.flash.visible =
        entry.mesh.visible && actor.kind === "cultist" && entry.frame === 5;
      entry.flash.position.copy(entry.mesh.position);
      entry.flash.position.y = 1.27;
      entry.flash.position.addScaledVector(
        new T.Vector3(
          camera.x - actor.position.x,
          0,
          camera.z - actor.position.z,
        ).normalize(),
        0.06,
      );
      actor.rig.root.userData.spriteFrame = entry.frame;
      actor.rig.root.userData.spriteWalkCell = walkCell;
    }
  }
}

/** Detached sprite fragments use the same illustrated frame as the living enemy. */
export function spriteFragment(rig: Rig, part: BodyPart): T.Sprite | null {
  const entry = entriesByRig.get(rig),
    index = partNames.indexOf(part);
  if (!entry || index < 0) return null;
  if (part === "head") {
    // Use the clean neutral head, never the current pose's overlapping firearm
    // or corpse gutter. The authored contour rejects shoulders inside its bounds.
    const contour = headContour(entry.profile.name, 0),
      bounds = headBounds(contour);
    const [x0, y0, x1, y1] = bounds,
      map = entry.actionMap.clone();
    map.repeat.set((x1 - x0) / 4, (y1 - y0) / 2);
    map.offset.set(x0 / 4, (1 + y0) / 2);
    const material = new T.SpriteMaterial({
      map,
      alphaTest: 0.4,
      toneMapped: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.spriteHead = {
        value: contour.map((p) => new T.Vector2(...p)),
      };
      shader.uniforms.headCrop = { value: new T.Vector4(...bounds) };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 headLocalUV;",
        )
        .replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\nheadLocalUV=uv;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 headLocalUV;\nuniform vec4 headCrop;" +
            headMaskGLSL,
        )
        .replace(
          "#include <map_fragment>",
          "#include <map_fragment>\nif(!insideSpriteHead(mix(headCrop.xy,headCrop.zw,headLocalUV))) discard;",
        );
    };
    material.customProgramCacheKey = () => "detached-contoured-head-v1";
    const sprite = new T.Sprite(material);
    sprite.scale.set(
      (x1 - x0) * entry.profile.size,
      (y1 - y0) * entry.profile.size,
      1,
    );
    sprite.userData.pixelFragment = true;
    sprite.userData.headOnly = true;
    entry.missing[0] = 1;
    return sprite;
  }
  const rect = (
      entry.corpse.value ? entry.profile.deadCuts : entry.profile.cuts
    )[index],
    map = entry.map.clone();
  // Fragment cutouts use the transparent action pose even when struck from behind.
  map.source = entry.actionMap.source;
  map.needsUpdate = true;
  const col = entry.frame % 4,
    row = 1 - Math.floor(entry.frame / 4);
  map.repeat.set((rect.z - rect.x) / 4, (rect.w - rect.y) / 2);
  map.offset.set((col + rect.x) / 4, (row + rect.y) / 2);
  const sprite = new T.Sprite(
    new T.SpriteMaterial({
      map,
      alphaTest: 0.4,
      transparent: false,
      toneMapped: false,
    }),
  );
  sprite.scale.set(
    (rect.z - rect.x) * entry.profile.size,
    (rect.w - rect.y) * entry.profile.size,
    1,
  );
  sprite.userData.pixelFragment = true;
  return sprite;
}
export function disposeSpriteFragment(object: T.Object3D) {
  if (object instanceof T.Sprite && object.userData.pixelFragment) {
    object.material.map?.dispose();
    object.material.dispose();
  }
}
