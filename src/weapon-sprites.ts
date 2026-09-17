import * as T from 'three';
import { WEAPONS, type WeaponId } from './weapons';
import { COMBAT_MOTION } from './weapon-motion';

/** The same cooldown that gates shots drives the painted mechanical cycle. */
export function weaponSpriteFrame(id: WeaponId, remaining: number): number {
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  const phase = 1 - Math.min(1, remaining / WEAPONS[id].fireInterval);
  if (id === 'acid') {
    if (phase < .24) return 1;
    if (phase < .56) return 2;
    if (phase < .83) return 4;
    return 6;
  }
  const boundaries = [.08, .20, .36, .49, .72, .91];
  const index = boundaries.findIndex(end => phase < end);
  return index < 0 ? 7 : index + 1;
}

export class WeaponSprites {
  readonly scene = new T.Scene();
  readonly camera = new T.OrthographicCamera(-1,1,1,-1,.1,5);
  readonly mesh = new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({
    transparent: true, alphaTest: .1, depthTest: false, depthWrite: false,
    toneMapped: false,
  }));
  private maps = new Map<WeaponId,T.Texture>();
  ready = false;
  constructor() {
    this.camera.position.z = 2;
    this.mesh.name = 'illustrated-player-weapon';
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }
  async load() {
    await Promise.all((['shotgun','femur','acid'] as WeaponId[]).map(async id => {
      try {
        const map = await new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}sprites/${id}.png`);
        map.colorSpace = T.SRGBColorSpace;
        map.magFilter = map.minFilter = T.NearestFilter;
        map.generateMipmaps = false;
        map.repeat.set(.25,.5);
        this.maps.set(id,map);
      } catch(error) { console.warn(`Illustrated ${id} unavailable; keeping model`,error); }
    }));
    this.ready = true;
  }
  has(id:WeaponId) { return this.ready && this.maps.has(id); }
  update(id:WeaponId, cooldown:number, recoil:number, switchTimer:number,
    kickTime:number, bob:number, sway:T.Vector2, aspect:number) {
    const map=this.maps.get(id);
    this.mesh.visible=this.has(id) && kickTime<0;
    if (!map || !this.mesh.visible) return;
    const frame=weaponSpriteFrame(id,cooldown);
    map.offset.set((frame%4)/4,(1-Math.floor(frame/4))/2);
    this.mesh.material.map=map;
    this.mesh.userData.frame=frame;
    this.mesh.userData.weapon=id;
    this.camera.left=-aspect; this.camera.right=aspect;
    this.camera.updateProjectionMatrix();
    const size=Math.min(id==='shotgun'?1.44:1.16,aspect*1.8);
    this.mesh.scale.set(size,size,1);
    this.mesh.position.set(sway.x*.45+bob*.6,
      -1+size*.5-.03+Math.abs(bob)*.6-recoil*.025-
      Math.min(1,switchTimer/COMBAT_MOTION.switchDuration)*.7,0);
    this.mesh.rotation.z=-sway.x*.15;
  }
  render(renderer:T.WebGLRenderer) {
    if (!this.mesh.visible) return;
    renderer.clearDepth();
    renderer.render(this.scene,this.camera);
  }
}
