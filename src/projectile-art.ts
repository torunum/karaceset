import * as T from 'three';

export type OrganicItemKind = 'femur' | 'ammo' | 'health' | 'wrath' | 'ward' | 'viscera';
/** Pixel bounds in the original, genuinely transparent 1536 × 1024 atlas. */
export const ORGANIC_ITEM_RECTS: Record<OrganicItemKind, readonly [number, number, number, number]> = {
  femur: [4, 170, 540, 148],
  ammo: [568, 96, 446, 308],
  health: [1082, 0, 402, 500],
  wrath: [43, 511, 441, 481],
  ward: [566, 517, 436, 478],
  viscera: [1007, 583, 526, 358],
};

/** Shared textures/materials: removing an item or projectile allocates no disposal work. */
export class OrganicItemArt {
  ready = false;
  private atlas?: T.Texture;
  private maps = new Map<OrganicItemKind, T.Texture>();
  private materials = new Map<OrganicItemKind, T.SpriteMaterial>();
  private boneMaterial?: T.MeshBasicMaterial;
  private boneGeometry = new T.PlaneGeometry(1, 148 / 540);

  async load() {
    const atlas = await new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}sprites/organic-items.png`);
    this.install(atlas);
  }

  /** Also permits deterministic texture injection in tests without a DOM. */
  install(atlas: T.Texture) {
    this.dispose();
    this.boneGeometry = new T.PlaneGeometry(1, 148 / 540);
    this.boneGeometry.userData.sharedAsset=true;
    this.atlas = atlas;
    atlas.colorSpace = T.SRGBColorSpace;
    atlas.magFilter = T.NearestFilter;
    atlas.minFilter = T.LinearMipmapLinearFilter;
    for (const [kind, rect] of Object.entries(ORGANIC_ITEM_RECTS)) {
      const [x, y, w, h] = rect;
      const map = atlas.clone();
      map.repeat.set(w / 1536, h / 1024);
      map.offset.set(x / 1536, 1 - (y + h) / 1024);
      map.needsUpdate = true;
      this.maps.set(kind as OrganicItemKind, map);
      this.materials.set(kind as OrganicItemKind, new T.SpriteMaterial({
        map, alphaTest: .4, transparent: false, toneMapped: false, fog: true,
      }));
    }
    this.boneMaterial = new T.MeshBasicMaterial({
      map: this.maps.get('femur'), alphaTest: .4, side: T.DoubleSide,
      toneMapped: false, fog: true,
    });
    this.ready = true;
  }

  /** Width is visible bounds in world units; height preserves the illustrated aspect. */
  create(kind: OrganicItemKind, width = 1): T.Sprite | null {
    const material = this.materials.get(kind);
    if (!this.ready || !material) return null;
    const sprite = new T.Sprite(material);
    const [, , w, h] = ORGANIC_ITEM_RECTS[kind];
    sprite.scale.set(width, width * h / w, 1);
    sprite.name = `illustrated-${kind}`;
    sprite.userData.organicItem = kind;
    return sprite;
  }

  /** Crossed planes keep the spear length parallel to flight. Sharp tip is local -Z. */
  createFemur(length = .72): T.Group | null {
    if (!this.ready || !this.boneMaterial) return null;
    const group = new T.Group();
    group.name = 'illustrated-femur-projectile';
    const side = new T.Mesh(this.boneGeometry, this.boneMaterial);
    side.rotation.y = Math.PI / 2;
    const top = new T.Mesh(this.boneGeometry, this.boneMaterial);
    top.rotation.set(Math.PI / 2, Math.PI / 2, 0, 'YXZ');
    group.add(side, top);
    side.userData.organicItem=top.userData.organicItem='femur';
    group.scale.setScalar(length);
    group.userData.organicItem = 'femur';
    return group;
  }

  /** Call at application teardown, after removing instances, never for individual shots. */
  dispose() {
    this.ready = false;
    this.maps.forEach(map => map.dispose());
    this.materials.forEach(material => material.dispose());
    this.maps.clear();
    this.materials.clear();
    this.boneMaterial?.dispose();
    this.boneMaterial = undefined;
    this.boneGeometry.dispose();
    this.atlas?.dispose();
    this.atlas = undefined;
  }
}
