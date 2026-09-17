import * as T from 'three';

export const COMBAT_VFX_SIZE = [2172, 724] as const;
export const COMBAT_VFX_RECTS = {
  blood: [0, 0, 724, 724],
  acid: [790, 232, 570, 275],
  impact: [1448, 0, 724, 724],
} as const;
type EffectKind = keyof typeof COMBAT_VFX_RECTS;

/** One atlas and shared materials; no resources are allocated while animating. */
export class CombatVfxArt {
  ready = false;
  private atlas?: T.Texture;
  private maps = new Map<EffectKind, T.Texture>();
  private projectileMaterial?: T.SpriteMaterial;
  private impactMaterial?: T.SpriteMaterial;
  private bloodMaterial?: T.SpriteMaterial;
  get bloodMap() { return this.maps.get('blood'); }

  async load() {
    this.install(await new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}sprites/combat-vfx.png`));
  }

  install(atlas: T.Texture) {
    this.dispose();
    this.atlas = atlas;
    atlas.colorSpace = T.SRGBColorSpace;
    atlas.magFilter = T.NearestFilter;
    atlas.minFilter = T.LinearMipmapLinearFilter;
    for (const kind of Object.keys(COMBAT_VFX_RECTS) as EffectKind[]) {
      const [x,y,w,h] = COMBAT_VFX_RECTS[kind];
      const map = atlas.clone();
      map.repeat.set(w / COMBAT_VFX_SIZE[0], h / COMBAT_VFX_SIZE[1]);
      map.offset.set(x / COMBAT_VFX_SIZE[0], 1 - (y+h) / COMBAT_VFX_SIZE[1]);
      map.needsUpdate = true;
      this.maps.set(kind, map);
    }
    this.projectileMaterial = new T.SpriteMaterial({map: this.maps.get('acid'), alphaTest: .3, transparent: false, toneMapped: false, fog: true});
    this.impactMaterial = new T.SpriteMaterial({map: this.maps.get('impact'), alphaTest: .3, transparent: false, toneMapped: false, fog: true});
    this.bloodMaterial = new T.SpriteMaterial({map: this.maps.get('blood'), alphaTest: .3, transparent: false, toneMapped: false, fog: true});
    this.ready = true;
  }

  createProjectile(width = .42): T.Group | null {
    if (!this.ready || !this.projectileMaterial) return null;
    const group = new T.Group();
    group.name = 'illustrated-acid-projectile';
    const sprite = new T.Sprite(this.projectileMaterial);
    sprite.name = 'illustrated-bile-glob';
    sprite.scale.set(width, width * 275 / 570, 1);
    group.add(sprite);
    return group;
  }

  createImpact(size = .8): T.Sprite | null {
    if (!this.ready || !this.impactMaterial) return null;
    const sprite = new T.Sprite(this.impactMaterial);
    sprite.name = 'illustrated-acid-impact';
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  createBloodImpact(size = .5): T.Sprite | null {
    if (!this.ready || !this.bloodMaterial) return null;
    const sprite = new T.Sprite(this.bloodMaterial);
    sprite.name = 'illustrated-blood-impact';
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  /** Remove all instances first. Individual impacts/shots do not own their material. */
  dispose() {
    this.ready = false;
    this.projectileMaterial?.dispose(); this.impactMaterial?.dispose(); this.bloodMaterial?.dispose();
    this.projectileMaterial = this.impactMaterial = this.bloodMaterial = undefined;
    this.maps.forEach(map => map.dispose()); this.maps.clear();
    this.atlas?.dispose(); this.atlas = undefined;
  }
}
