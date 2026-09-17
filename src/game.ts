import * as T from "three";
import { CultSprites } from "./cult-sprites";
import { loadVesperAsset } from "./blender-weapon";
import { WeaponSprites } from "./weapon-sprites";
import { loadEnvironmentArt } from "./environment-art";
import {PropSprites} from './prop-sprites';
import {OrganicItemArt} from './projectile-art';
import {ChapterState,SECRET_PASSAGES,CAMPAIGN_KEYS,type PowerKind,type SecretReward,type CampaignKey} from './chapter-state';
import {CombatVfxArt} from './combat-vfx-art';
import {CAMPAIGN_PLAYER_SPEED,CAMPAIGN_START_AMMO,CAMPAIGN_START_WEAPONS,campaignEnemyHp,campaignWindup,campaignRoster,campaignPickupGrant,type Difficulty,type CampaignAmmoGrant} from './campaign-balance';
import {LivingOrgan} from './living-organ';
import {LocalLightPool} from './render-budget';
import { preloadBlenderEnemies, installBlenderEnemy } from "./blender-enemies";
import { loadBlenderArsenal } from "./blender-arsenal";
import { loadBlenderProps, loadBlenderScenery } from "./blender-props";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  CONFIG,
  damageEnemy,
  planPin,
  traceShot,
  moveCircle,
  canAttack,
  type Target,
  type EnemyState,
  type BodyPart,
} from "./combat";
import { createEnemy, animateEnemy } from "./enemy-art";
import { cultistMovement } from "./enemy-tactics";
import { ENEMIES, type EnemyKind } from "./enemy-types";
import {
  createShotgun,
  createAcidWeapon,
  createKickRig,
  createFemurWeapon,
} from "./arsenal-art";
import { WEAPONS, type WeaponId } from "./weapons";
import { CorpseRagdoll } from "./ragdoll";
import {
  animateWeaponModel,
  crossedReloadCue,
  COMBAT_MOTION,
} from "./weapon-motion";
import { GoreSystem } from "./gore";
import { KICK, kickExtension, findKickTarget, stepImpulse } from "./melee";
import { sceneryMats, updateBreakableDamage, type Breakable } from "./scenery";
import { Level, Navigator } from "./level";
import { femur, oval, mats, disposeRig, type Rig } from "./art";
import { AudioSystem, type SoundEvent } from "./audio";
import { spatialSound } from "./audio-spatial";
export interface Enemy extends Target {
  rig: Rig;
  ragdoll: CorpseRagdoll | null;
  kind: EnemyKind;
  zone: number;
  timer: number;
  cooldown: number;
  phase: number;
  pin: ReturnType<typeof planPin>;
  origin: T.Vector3;
  impactOffset: T.Vector3;
  impactDirection: T.Vector3;
  deathTime: number;
  activated: boolean;
  velocity: T.Vector3;
  shoveHits: Set<Enemy>;
  lostParts: Set<BodyPart>;
  limbDamage: Partial<Record<BodyPart, number>>;
  corrosion: number;
  bleeding: number;
  bleedOffset: T.Vector3;
  shadow: T.Mesh;
}
interface Projectile {
  mesh: T.Group;
  position: T.Vector3;
  direction: T.Vector3;
  hostile: boolean;
  life: number;
  damage: number;
  speed: number;
  weapon: WeaponId | "bullet";
}
interface Effect {
  mesh: T.Object3D;
  velocity: T.Vector3;
  life: number;
  max: number;
}
interface Pickup {
  mesh: T.Group;
  kind: "ammo" | "health" | SecretReward | CampaignKey;
  grant?: CampaignAmmoGrant;
  secretId?:string;
  secret: boolean;
  taken: boolean;
}
export type Mode = "menu" | "playing" | "paused" | "dead" | "won";
export class Game {
  difficulty:Difficulty='normal';
  unlockedWeapons=new Set<WeaponId>(CAMPAIGN_START_WEAPONS);
  combatVfx=new CombatVfxArt();
  sealMarkers=new Map<CampaignKey,T.Group>();
  get totalSecrets(){return this.testroom?2:SECRET_PASSAGES.length;}
  setDifficulty(value:Difficulty){
    if(this.hasStarted&&this.mode!=='dead'&&this.mode!=='won')return;
    this.difficulty=value;this.reset();
  }
  chapterState=new ChapterState();
  itemArt=new OrganicItemArt();
  livingOrgan?:LivingOrgan;
  scene = new T.Scene();
  cultSprites = new CultSprites(this.scene);
  camera = new T.PerspectiveCamera(78, 1, 0.07, 150);
  weaponScene = new T.Scene();
  weaponSprites = new WeaponSprites();
  propSprites = new PropSprites(this.scene);
  weaponCamera = new T.PerspectiveCamera(57, 1, 0.01, 10);
  renderer: T.WebGLRenderer;
  keyLight = new T.DirectionalLight(0xc5ada0, 1.1);
  weaponSway = new T.Vector2();
  previousAim = new T.Vector2();
  level: Level;
  nav: Navigator;
  audio = new AudioSystem();
  gun = createFemurWeapon();
  arsenal: Record<WeaponId, ReturnType<typeof createFemurWeapon>> = {
    femur: this.gun,
    shotgun: createShotgun(),
    acid: createAcidWeapon(),
  };
  weaponId: WeaponId = "femur";
  ammoBank: Record<WeaponId, number> = { femur: 28, shotgun: 12, acid: 65 };
  switchTimer = 0;
  kickRig = createKickRig();
  kickTime = -1;
  kickCooldown = 0;
  kickConnected = false;
  kicksLanded = 0;
  bodiesCollided = 0;
  brokenProps = 0;
  muzzleLight = new T.PointLight(0xffad64, 0, 5, 2);
  muzzleFlash = new T.Mesh(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshBasicMaterial({
      color: 0xffd99a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  gore = new GoreSystem(this.scene);
  shadowMaterial = new T.MeshBasicMaterial({
    color: 0x080607,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  remains: T.Object3D[] = [];
  pickups: Pickup[] = [];
  position = new T.Vector3(0, 1.65, 6);
  yaw = 0;
  pitch = 0;
  health = 100;
  get ammo() {
    return this.ammoBank[this.weaponId];
  }
  set ammo(value: number) {
    this.ammoBank[this.weaponId] = value;
  }
  kills = 0;
  pins = 0;
  secrets = 0;
  elapsed = 0;
  time = 0;
  mode: Mode = "menu";
  keys = new Set<string>();
  firing = false;
  shotCooldown = 0;
  weaponCycle = 0;
  recoil = 0;
  hurtFlash = 0;
  hitFlash = 0;
  notice = "";
  noticeTimer = 0;
  navTimer = 0;
  stepTimer = 0;
  hasStarted = false;
  finalTriggered = false;
  detachedLook = false;
  testroom: boolean;
  chapel = new URLSearchParams(location.search).has("chapel");
  renderScale = 1;
  localLights?: LocalLightPool;
  sensitivity = 0.002;
  onChange = () => {};
  accumulator = 0;
  previous = 0;
  lastHud = 0;
  frameCount = 0;
  fps = 60;
  fpsTime = 0;
  assetsReady = false;
  constructor(public canvas: HTMLCanvasElement) {
    this.testroom =
      this.chapel || new URLSearchParams(location.search).has("testroom");
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x100b0d);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.autoClear = false;
    this.scene.fog = new T.FogExp2(0x190e10, 0.027);
    this.scene.add(new T.HemisphereLight(0xaaa6ac, 0x302020, 1.35));
    const sun = this.keyLight;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -15,
      right: 15,
      top: 15,
      bottom: -15,
      near: 0.5,
      far: 40,
    });
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun.target);
    const room = new RoomEnvironment(),
      pmrem = new T.PMREMGenerator(this.renderer);
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.18;
    this.weaponScene.environment = environment;
    this.weaponScene.environmentIntensity = 0.25;
    sun.position.set(3, 8, 5);
    this.scene.add(sun);
    this.weaponScene.add(new T.HemisphereLight(0xd5bdc1, 0x543344, 2.1));
    const key = new T.DirectionalLight(0xffe1b2, 2.1);
    key.position.set(-2, 3, 2);
    this.weaponScene.add(key);

    for (const [id, rig] of Object.entries(this.arsenal)) {
      this.weaponScene.add(rig.root);
      rig.root.scale.setScalar(0.55);
      rig.root.visible = id === "femur";
      rig.mechanism.userData.restZ = rig.mechanism.position.z;
    }
    this.weaponScene.add(this.kickRig.root);
    this.kickRig.root.visible = false;
    this.kickRig.root.scale.setScalar(0.75);
    this.muzzleLight.position.set(0.2, 0.05, -1);
    this.weaponScene.add(this.muzzleLight);
    this.weaponScene.add(this.muzzleFlash);
    this.muzzleFlash.visible = false;
    this.level = new Level(this.testroom, this.chapel);
    if(!this.testroom)this.livingOrgan=new LivingOrgan(this.level);
    if(!this.testroom)this.localLights=new LocalLightPool(this.scene,this.level.lights);
    if (this.chapel) {
      this.scene.environmentIntensity = 0.08;
      this.scene.fog = new T.FogExp2(0x161516, 0.018);
      this.keyLight.intensity = 0.48;
    }
    this.nav = new Navigator(this.level);
    this.scene.add(this.level.root);
    this.level.root.traverse((o) => {
      if (o instanceof T.Mesh) o.receiveShadow = true;
    });
    this.level.scenery.props.forEach((p) =>
      p.root.traverse((o) => {
        if (o instanceof T.Mesh) o.castShadow = true;
      }),
    );
    this.reset();
    this.bind();
    this.canvas.style.visibility = "hidden";
    void Promise.allSettled([
      this.livingOrgan?.load(),
      this.itemArt.load().then(()=>this.installItemArt()),
      this.combatVfx.load().then(()=>this.gore.setIllustratedBlood(this.combatVfx.bloodMap!)),
      this.weaponSprites.load(),
      this.propSprites.load().catch(error=>console.warn('Illustrated props unavailable',error)),
      this.cultSprites
        .load()
        .catch((error) => console.warn("Cult sprite unavailable", error)),
      loadVesperAsset(this.arsenal.shotgun),
      loadBlenderArsenal(this.arsenal, this.kickRig),
      loadBlenderProps(this.level.scenery.props).catch((error) =>
        console.warn("Blender props unavailable", error),
      ),
      loadBlenderScenery(this.level.root).catch((error) =>
        console.warn("Blender scenery unavailable", error),
      ),
      preloadBlenderEnemies()
        .then(() => {
          for (const enemy of this.enemies)
            if (
              enemy.hp > 0 &&
              !enemy.ragdoll &&
              enemy.state !== "pinned" &&
              enemy.state !== "pinning"
            )
              installBlenderEnemy(enemy.rig, enemy.kind);
        })
        .catch((error) =>
          console.warn("Blender characters unavailable", error),
        ),
    ]).then(async () => {
      await loadEnvironmentArt(this.level.root,this.chapel).catch(error=>
        console.warn('Environment illustrations unavailable',error));
      this.assetsReady = true;
      this.canvas.style.visibility = "";
      this.onChange();
    });
    this.resize();
    requestAnimationFrame(this.frame);
  }
  reset() {
    this.livingOrgan?.reset();
    this.chapterState.reset();
    this.level.secretOpen=this.chapterState.open;
    for(const panel of this.level.secretPanels.values())panel.position.y=2.9;
    this.propSprites.reset();
    this.cultSprites.reset();
    this.gore.reset();
    for (const e of this.enemies) {
      this.scene.remove(e.rig.root);
      this.scene.remove(e.shadow);
      disposeRig(e.rig.root);
    }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const e of this.effects) this.scene.remove(e.mesh);
    for (const r of this.remains) this.scene.remove(r);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.remains = [];
    this.pickups = [];
    this.health = 100;
    this.weaponId = this.chapel ? "shotgun" : "femur";
    this.gun = this.arsenal[this.weaponId];
    this.ammoBank = this.testroom?{ femur: 28, shotgun: 12, acid: 65 }:{...CAMPAIGN_START_AMMO};
    this.unlockedWeapons=new Set<WeaponId>(this.testroom?['femur','shotgun','acid']:CAMPAIGN_START_WEAPONS);
    for (const [id, rig] of Object.entries(this.arsenal))
      rig.root.visible = id === this.weaponId;
    this.switchTimer = this.kickCooldown = 0;
    this.kickTime = -1;
    this.kicksLanded = this.bodiesCollided = this.brokenProps = 0;
    this.kickRig.root.visible = false;
    this.kickRig.root.scale.setScalar(0.75);
    this.kills = this.pins = this.secrets = this.elapsed = 0;
    this.finalTriggered = false;
    this.shotCooldown = 0;
    this.weaponCycle = 0;
    this.recoil = 0;
    this.hurtFlash = this.hitFlash = 0;
    this.keys.clear();
    this.firing = false;
    this.noticeTimer = 0;
    this.position.set(0, 1.65, this.chapel ? 4 : this.testroom ? 5 : 6);
    this.yaw = this.pitch = 0;
    this.level.gateOpen = false;
    this.level.gateProgress = 0;
    this.level.gate.position.y = 0;
    this.level.gate.scale.y = 1;
    this.level.scenery.reset();
    for (const s of this.testroom?this.level.spawns:campaignRoster(this.level.spawns,this.difficulty)) {
      const def = ENEMIES[s.kind];
      const rig = createEnemy(s.kind);
      rig.root.position.set(s.x, 0, s.z);
      if (this.chapel) rig.root.rotation.y = Math.PI;
      const barrel = rig.root.getObjectByName("muzzle");
      if (barrel) {
        const flash = new T.Mesh(
          new T.IcosahedronGeometry(0.065, 0),
          new T.MeshBasicMaterial({ color: 0xffc777 }),
        );
        flash.name = "enemy-muzzle-flash";
        flash.userData.transientEffect = true;
        flash.scale.set(0.6, 0.6, 1.9);
        flash.visible = false;
        barrel.add(flash);
      }
      this.scene.add(rig.root);
      rig.root.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const position = new T.Vector3(s.x, def.center, s.z);
      const shadow = oval(
        this.scene,
        this.shadowMaterial,
        [s.x, 0.026, s.z],
        [def.radius * 1.15, 0.008, def.radius * 0.8],
      );
      this.enemies.push({
        position,
        radius: def.radius,
        // Movement clearance includes shoulders; the torso hit volume must leave the head exposed.
        torsoHitRadius: def.radius * 0.7,
        hp: this.testroom?def.hp:campaignEnemyHp(s.kind),
        state: "idle",
        headOffset: undefined,
        headRadius: 0.19,
        rig,
        ragdoll: null,
        kind: s.kind,
        zone: s.zone,
        timer: 0,
        cooldown: 1.2,
        phase: this.enemies.length * 2.3,
        pin: null,
        origin: position.clone(),
        impactOffset: new T.Vector3(),
        impactDirection: new T.Vector3(0, 0, -1),
        deathTime: 0,
        activated: false,
        velocity: new T.Vector3(),
        shoveHits: new Set(),
        lostParts: new Set(),
        limbDamage: {},
        corrosion: 0,
        bleeding: 0,
        bleedOffset: new T.Vector3(),
        shadow,
      });
    }
    for (const [index,s] of this.level.pickups.entries()) {
      const grant=this.testroom?undefined:campaignPickupGrant(index,this.difficulty);
      if(!this.testroom&&s.kind==='ammo'&&(!grant||(!grant.amount&&!grant.unlock)))continue;
      const g = new T.Group();
      g.position.set(s.x, 0.22, s.z);
      if (s.kind === "ammo") {
        for (let i = 0; i < 3; i++) {
          const b = femur(0.6);
          b.position.x = (i - 1) * 0.16;
          b.rotation.x = -0.7;
          g.add(b);
        }
      } else {
        oval(g, mats.red, [0, 0, 0], [0.22, 0.28, 0.18]);
        for (const x of [-0.08, 0.08])
          oval(g, mats.tendon, [x, 0.19, 0], [0.08, 0.17, 0.07]);
      }
      oval(g, this.shadowMaterial, [0, -0.19, 0], [0.3, 0.006, 0.3]);
      this.scene.add(g);
      this.pickups.push({
        mesh: g,
        kind: s.kind,
        grant,
        taken: false,
        secret: !!s.secret,
      });
    }
    if(!this.testroom)for(const s of [...SECRET_PASSAGES.map(s=>({x:s.rewardX,z:s.z,kind:s.kind,secretId:s.id})),{x:23,z:-47,kind:'wrath' as PowerKind,secretId:undefined},{x:6,z:-73,kind:'armor' as SecretReward,secretId:undefined}]){
      const mesh=new T.Group();mesh.position.set(s.x,.7,s.z);this.scene.add(mesh);
      this.pickups.push({mesh,kind:s.kind,secretId:s.secretId,secret:false,taken:false});
    }
    if(!this.testroom)for(const key of CAMPAIGN_KEYS){
      const mesh=new T.Group();mesh.name=`campaign-key-${key.kind}`;mesh.position.set(key.x,.7,key.z);this.scene.add(mesh);
      this.pickups.push({mesh,kind:key.kind,secret:false,taken:false});
    }
    this.installItemArt();
    this.nav.refresh(this.position);
    this.onChange();
  }
  installItemArt(){
    if(!this.itemArt.ready)return;
    for(const p of this.pickups){
      if(p.mesh.userData.illustrated)continue;
      const artKind=p.kind==='armor'||p.kind==='bile'?'ward':p.kind==='overhealth'?'health':p.kind==='marrow'?'wrath':p.kind;
      const sprite=this.itemArt.create(artKind,p.kind==='ammo'?.8:p.kind==='health'?.52:.68);
      if(!sprite)continue;
      p.mesh.children.forEach(child=>child.visible=false);
      sprite.position.y=p.kind==='ammo'?.14:p.kind==='health'?.26:0;
      p.mesh.add(sprite);p.mesh.userData.illustrated=true;
      if(p.kind==='marrow'||p.kind==='bile')this.frameSeal(p.mesh);
    }
    if(!this.testroom&&!this.sealMarkers.size)for(const key of ['marrow','bile'] as const){
      const marker=new T.Group();marker.name=`lock-seal-${key}`;
      marker.position.copy(key==='marrow'?this.level.buttonPosition:this.level.exitPosition);marker.position.y=1.5;
      const sprite=this.itemArt.create(key==='marrow'?'wrath':'ward',.68);if(sprite)marker.add(sprite);
      this.frameSeal(marker);this.scene.add(marker);this.sealMarkers.set(key,marker);
    }
    this.sealMarkers.forEach(marker=>marker.visible=true);
  }
  frameSeal(group:T.Group){
    for(const angle of [-.65,.65]){
      const bone=this.itemArt.createFemur(.8);if(!bone)continue;
      bone.rotation.set(Math.PI/2,angle,0);bone.position.z=.03;group.add(bone);
    }
  }
  bind() {
    document.addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      )
        e.preventDefault();
      if (e.code === "Escape") {
        if (this.mode === "playing") this.pause();
        return;
      }
      if (this.mode === "playing") {
        this.keys.add(e.code);
        if (e.code === "KeyE" && !e.repeat) this.interact();
        if ((e.code === "KeyF" || e.code === "KeyQ") && !e.repeat) this.kick();
        if (!e.repeat && e.code.startsWith("Digit")) {
          const id = (
            { Digit1: "femur", Digit2: "shotgun", Digit3: "acid" } as Record<
              string,
              WeaponId
            >
          )[e.code];
          if (id) this.switchWeapon(id);
        }
      }
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    document.addEventListener("mousemove", (e) => {
      if (
        this.mode === "playing" &&
        (document.pointerLockElement === this.canvas ||
          (this.detachedLook && e.buttons === 2))
      ) {
        this.yaw -= e.movementX * this.sensitivity;
        this.pitch = Math.max(
          -1.2,
          Math.min(1.2, this.pitch - e.movementY * this.sensitivity),
        );
      }
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.mode === "playing" && e.button === 0) {
        this.firing = true;
        this.shoot();
      }
    });
    document.addEventListener("mouseup", () => (this.firing = false));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      if (
        !document.pointerLockElement &&
        this.mode === "playing" &&
        !this.detachedLook
      )
        this.pause();
    });
    window.addEventListener("blur", () => this.pause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    window.addEventListener("resize", () => this.resize());
  }
  async start() {
    if (this.mode === "dead" || this.mode === "won") this.reset();
    this.hasStarted = true;
    this.mode = "playing";
    this.audio.start();
    this.keys.clear();
    this.firing = false;
    try {
      await this.canvas.requestPointerLock();
      this.detachedLook = false;
    } catch {
      this.detachedLook = true;
      this.message("Fare kilidi yok: sağ tuşu basılı tutarak bak.");
    }
    this.onChange();
  }
  pause() {
    if (this.mode !== "playing") return;
    this.mode = "paused";
    this.keys.clear();
    this.firing = false;
    this.audio.pause();
    if (document.pointerLockElement) document.exitPointerLock();
    this.onChange();
  }
  finish(mode: "dead" | "won") {
    this.mode = mode;
    this.keys.clear();
    this.firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.pause();
    this.onChange();
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, 1.5, 1080 / h) * this.renderScale,
    );
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.weaponCamera.aspect = w / h;
    this.weaponCamera.updateProjectionMatrix();
  }
  message(s: string) {
    this.notice = s;
    this.noticeTimer = 3.4;
    this.onChange();
  }
  aim() {
    return new T.Vector3(0, 0, -1).applyEuler(
      new T.Euler(this.pitch, this.yaw, 0, "YXZ"),
    );
  }
  shoot() {
    if (
      this.mode !== "playing" ||
      this.shotCooldown > 0 ||
      this.switchTimer > 0 ||
      this.kickTime >= 0
    )
      return;
    if (this.ammo <= 0) {
      this.shotCooldown = 0.5;
      this.message("Mühimmat tükendi. Silah değiştir veya tekme kullan.");
      return;
    }
    this.ammo--;
    const def = WEAPONS[this.weaponId];
    this.shotCooldown = def.fireInterval;
    this.weaponCycle = def.fireInterval;
    this.recoil = 1;
    this.audio.play(
      this.weaponId === "shotgun"
        ? "shotgun"
        : this.weaponId === "acid"
          ? "acid"
          : "fire",
    );
    this.muzzleLight.color.set(this.weaponId === "acid" ? 0x829b35 : 0xffad64);
    this.muzzleLight.intensity = this.weaponId === "shotgun" ? 7 : 2;
    const dir = this.aim(),
      position = this.position.clone().addScaledVector(dir, 0.16);
    for (let i = 0; i < def.pellets; i++) {
      const direction = dir.clone();
      if (def.spread) {
        const angle = i * 2.39996 + this.time,
          spread =
            def.spread *
            (def.pellets > 1
              ? Math.sqrt(i / (def.pellets - 1))
              : Math.random());
        const right = new T.Vector3(1, 0, 0).applyEuler(
          new T.Euler(0, this.yaw, 0),
        );
        direction
          .addScaledVector(right, Math.cos(angle) * spread)
          .add(new T.Vector3(0, Math.sin(angle) * spread, 0))
          .normalize();
      }
      this.spawnProjectile(
        position,
        direction,
        false,
        this.weaponId,
        def.damage,
      );
    }
  }
  switchWeapon(id: WeaponId) {
    if(!this.unlockedWeapons.has(id)){this.message('Bu silahı bölümde bulmalısın.');return;}
    if (id === this.weaponId || this.kickTime >= 0 || this.mode !== "playing")
      return;
    this.weaponId = id;
    this.gun = this.arsenal[id];
    for (const [key, rig] of Object.entries(this.arsenal))
      rig.root.visible = key === id;
    this.switchTimer = COMBAT_MOTION.switchDuration;
    this.shotCooldown = Math.max(
      this.shotCooldown,
      COMBAT_MOTION.switchDuration,
    );
    this.weaponCycle = 0;
    this.recoil = 0;
    this.audio.play("equip");
    this.onChange();
  }
  spawnProjectile(
    position: T.Vector3,
    direction: T.Vector3,
    hostile: boolean,
    weaponId: WeaponId | "bullet" = hostile ? "acid" : "femur",
    damage = hostile ? 15 : CONFIG.damage,
  ) {
    if (this.projectiles.length >= CONFIG.maxProjectiles) {
      const old = this.projectiles.shift()!;
      this.scene.remove(old.mesh);
    }
    const mesh = weaponId === "femur" ? (this.itemArt.createFemur()??femur()) : weaponId==='acid'?(this.combatVfx.createProjectile()??new T.Group()):new T.Group();
    if (weaponId === "acid"&&!this.combatVfx.ready) {
      oval(mesh, mats.yellow, [0, 0, 0], [0.08, 0.075, 0.12]);
      oval(mesh, mats.flesh, [0, 0, 0.09], [0.06, 0.07, 0.1]);
    } else if (weaponId !== "femur"&&weaponId!=='acid') {
      oval(mesh, mats.yellow, [0, 0, 0], [0.015, 0.015, 0.13]);
    }
    mesh.position.copy(position);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), direction);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      position: position.clone(),
      direction: direction.clone(),
      hostile,
      life: 4,
      damage,
      speed: hostile
        ? weaponId === "bullet"
          ? 35
          : 10
        : WEAPONS[weaponId as WeaponId].projectileSpeed,
      weapon: weaponId,
    });
  }
  addCombatImpact(mesh:T.Sprite|null,position:T.Vector3,life:number){
    if(!mesh)return;
    if(this.effects.length>=CONFIG.maxEffects)this.scene.remove(this.effects.shift()!.mesh);
    mesh.position.copy(position);this.scene.add(mesh);
    this.effects.push({mesh,velocity:new T.Vector3(),life,max:life});
  }
  canCollectPickup(p:Pickup){
    if(p.kind==='ammo')return p.grant?!!(p.grant.unlock&&!this.unlockedWeapons.has(p.grant.weapon))||this.ammoBank[p.grant.weapon]<({femur:80,shotgun:40,acid:180}[p.grant.weapon]):this.ammoBank.femur<80||this.ammoBank.shotgun<40||this.ammoBank.acid<180;
    if(p.kind==='health')return this.health<100;
    if(p.kind==='overhealth')return this.health<200;
    if(p.kind==='armor')return this.chapterState.armor<(p.secretId?200:100);
    if(p.kind==='marrow'||p.kind==='bile')return !this.chapterState.keys.has(p.kind);
    return true;
  }
  collectPickup(p:Pickup){
    p.taken=true;p.mesh.visible=false;
    let notice='';
    if(p.kind==='ammo'){
      if(p.grant){
        const {weapon,amount,unlock}=p.grant;
        this.ammoBank[weapon]=Math.min({femur:80,shotgun:40,acid:180}[weapon],this.ammoBank[weapon]+amount);
        if(unlock){this.unlockedWeapons.add(weapon);this.switchWeapon(weapon);}
        notice=`${WEAPONS[weapon].name}${unlock?' ALINDI':''} · +${amount}`;
      }else{
        this.ammoBank.femur=Math.min(80,this.ammoBank.femur+12);
        this.ammoBank.shotgun=Math.min(40,this.ammoBank.shotgun+4);
        this.ammoBank.acid=Math.min(180,this.ammoBank.acid+20);
        notice='+12 KEMİK · +4 FİŞEK · +20 ASİT';
      }
    }else if(p.kind==='health'){this.health=Math.min(100,this.health+30);notice='+30 CAN';}
    else if(p.kind==='overhealth'){this.health=Math.min(200,this.health+100);notice='YAŞAM TOHUMU · +100 GEÇİCİ CAN';}
    else if(p.kind==='armor'){const amount=p.secretId?200:100;this.chapterState.grantArmor(amount);notice=`KEMİK PLAKA · ${amount} ZIRH`;}
    else if(p.kind==='marrow'||p.kind==='bile'){
      this.chapterState.collectKey(p.kind);notice=p.kind==='marrow'?'İLİK MÜHRÜ · Sinir düğümü artık açılabilir.':'SAFRA MÜHRÜ · Çıkış mührü çözüldü.';
      const marker=this.sealMarkers.get(p.kind);if(marker)marker.visible=false;
      for(const e of this.enemies)if(e.state==='idle'&&e.position.distanceTo(this.position)<12){e.activated=true;e.state='chase';}
    }else{this.chapterState.grant(p.kind);notice=p.kind==='wrath'?'GAZAP · 18 SN ÇİFT HASAR':'KEMİK ZIRHI · 24 SN %60 KORUMA';}
    if(p.secret&&this.testroom)this.secrets++;
    this.message(notice);this.audio.play('pickup');
  }
  burst(position: T.Vector3, bone = false) {
    for (let i = 0; i < 7; i++) {
      if (this.effects.length >= CONFIG.maxEffects) {
        this.scene.remove(this.effects.shift()!.mesh);
      }
      const mesh = oval(
        this.scene,
        bone ? mats.bone : mats.red,
        position.toArray(),
        [0.035, 0.035, 0.07],
      );
      this.effects.push({
        mesh,
        velocity: new T.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 2,
          (Math.random() - 0.5) * 3,
        ),
        life: 0.5,
        max: 0.5,
      });
    }
  }
  addRemain(mesh: T.Object3D) {
    this.remains.push(mesh);
    while (this.remains.length > CONFIG.maxRemains) {
      const old = this.remains.shift()!;
      this.scene.remove(old);
    }
  }
  hitEnemy(
    enemy: Enemy,
    point: T.Vector3,
    dir: T.Vector3,
    amount = CONFIG.damage,
    source: WeaponId | "kick" | "impact" | "explosion" | "corrosion" = "femur",
    part: BodyPart = "torso",
  ) {
    if (enemy.hp <= 0) return;
    let damage = this.chapterState.outgoing(amount) * (part === "head" ? 1.8 : 1);
    if (part !== "torso" && source !== "corrosion") {
      enemy.limbDamage[part] = (enemy.limbDamage[part] ?? 0) + damage;
      if (
        enemy.limbDamage[part]! >= (part === "head" ? 45 : 35) &&
        !enemy.lostParts.has(part)
      ) {
        if (this.gore.sever(enemy.rig, part, dir)) {
          enemy.lostParts.add(part);
          enemy.bleeding = 1.4;
          enemy.bleedOffset.copy(point).sub(enemy.position);
          this.playAt("sever", point);
        }
        if (part === "head") damage = Math.max(damage, enemy.hp);
      }
    }
    damageEnemy(enemy, damage);
    this.hitFlash = 0.18;
    if(source!=='corrosion')this.addCombatImpact(this.combatVfx.createBloodImpact(source==='shotgun'?.8:.55),point,.18);
    this.gore.spray(
      point,
      dir,
      source === "shotgun" ? 10 : source === "corrosion" ? 3 : 16,
    );
    if (source !== "corrosion") this.playAt("flesh", point);
    enemy.timer = source === "kick" ? 0.7 : 0.27;
    enemy.activated = true;
    if (source === "acid") enemy.corrosion = 2;
    if (source === "femur") {
      const embedded = this.itemArt.createFemur(.85)??femur(.85);
      embedded.position.copy(point);
      embedded.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), dir);
      enemy.rig.root.updateMatrixWorld(true);
      enemy.rig.root.attach(embedded);
    }
    if (enemy.hp <= 0) {
      this.kills++;
      enemy.origin.copy(enemy.position);
      enemy.impactOffset.copy(point).sub(enemy.position);
      enemy.impactDirection.copy(dir);
      enemy.pin =
        source === "femur"
          ? planPin(enemy, dir, this.level.activeWalls())
          : null;
      enemy.deathTime = 0;
      if (enemy.pin) {
        enemy.velocity.set(0, 0, 0);
        enemy.state = "pinning";
        this.pins++;
        this.message("ÇİVİLENDİ  /  +1");
      } else {
        enemy.state = "dead";
        if (source === "shotgun" || source === "explosion") {
          const extra: BodyPart =
            part === "head"
              ? "leftArm"
              : (["head", "rightArm", "leftLeg", "rightLeg"] as BodyPart[])[
                  this.kills % 4
                ];
          if (this.gore.sever(enemy.rig, extra, dir))
            enemy.lostParts.add(extra);
          enemy.velocity
            .addScaledVector(dir, source === "explosion" ? 7 : 3.5)
            .setY(0);
        }
      }
      if (!enemy.pin) {
        enemy.ragdoll = new CorpseRagdoll(
          enemy.rig,
          enemy.velocity.clone().addScaledVector(dir, 2.5),
        );
        enemy.velocity.set(0, 0, 0);
      }
      this.gore.stain(
        enemy.position.clone().setY(0.025),
        new T.Vector3(0, 1, 0),
        0.55,
      );
      this.addRemain(enemy.rig.root);
    }
  }
  refreshHitParts() {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.rig.root.position.x = e.position.x;
      e.rig.root.position.z = e.position.z;
      e.rig.root.updateMatrixWorld(true);
      const entries: [BodyPart, T.Group, T.Vector3, number][] = [
        ["head", e.rig.head, new T.Vector3(0, 0.13, 0), 0.18],
        ["leftArm", e.rig.arms[0], new T.Vector3(0, -0.32, 0), 0.19],
        ["rightArm", e.rig.arms[1], new T.Vector3(0, -0.32, 0), 0.19],
        ["leftLeg", e.rig.legs[0], new T.Vector3(0, -0.32, 0), 0.18],
        ["rightLeg", e.rig.legs[1], new T.Vector3(0, -0.32, 0), 0.18],
      ];
      e.hitParts = entries
        .filter(([, obj]) => obj.visible)
        .map(([name, obj, offset, radius]) => ({
          name,
          center: obj.localToWorld(offset),
          radius: radius * (e.kind === "brute" ? 1.16 : 1),
        }));
    }
  }
  kick() {
    if (
      this.mode !== "playing" ||
      this.kickCooldown > 0 ||
      this.switchTimer > 0
    )
      return;
    this.kickTime = 0;
    this.kickCooldown = KICK.cooldown;
    this.kickConnected = false;
    this.audio.play("kickWhoosh");
  }
  updateKick(dt: number) {
    if (this.kickTime < 0) return;
    this.kickTime += dt;
    if (this.kickTime >= KICK.contact && !this.kickConnected) {
      this.kickConnected = true;
      const dir = this.aim().setY(0).normalize(),
        targets: Target[] = [
          ...this.enemies,
          ...this.level.scenery.props.filter((p) => !p.broken),
        ];
      const target = findKickTarget(
        this.position,
        dir,
        this.level.activeWalls(),
        targets,
      );
      if (target) {
        this.kicksLanded++;
        this.audio.play("kickImpact");
        this.hitFlash = 0.2;
        if ("propKind" in target) this.damageProp(target as Breakable, 70, dir);
        else {
          const e = target as Enemy;
          this.hitEnemy(e, e.position.clone(), dir, KICK.damage, "kick");
          e.velocity
            .copy(dir)
            .multiplyScalar(KICK.impulse * (e.kind === "brute" ? 0.55 : 1));
          e.shoveHits.clear();
          e.timer = 0.75;
        }
      }
    }
    if (this.kickTime >= KICK.duration) this.kickTime = -1;
  }
  playAt(event: SoundEvent, point: T.Vector3) {
    const sound = spatialSound(
      point,
      this.position,
      this.yaw,
      this.level.activeWalls(),
    );
    this.audio.play(event, sound.distance, sound.pan, sound.occlusion);
  }
  damageProp(prop: Breakable, amount: number, dir: T.Vector3) {
    if (prop.broken) return;
    prop.hp = Math.max(0, prop.hp - amount);
    updateBreakableDamage(prop);
    if (prop.hp > 0) {
      this.playAt(
        prop.propKind === "crate"
          ? "woodHit"
          : prop.propKind === "barrel"
            ? "metalHit"
            : "stoneHit",
        prop.position,
      );
      return;
    }
    prop.broken = true;
    prop.state = "dead";
    prop.root.visible = false;
    this.brokenProps++;
    this.gore.debris(
      prop.position,
      dir,
      prop.propKind === "barrel" ? 18 : 12,
      prop.propKind === "crate"
        ? sceneryMats.wood
        : prop.propKind === "barrel"
          ? sceneryMats.rust
          : sceneryMats.stone,
      prop.propKind,
    );
    this.playAt(
      prop.propKind === "barrel"
        ? "explosion"
        : prop.propKind === "crate"
          ? "woodBreak"
          : "stoneBreak",
      prop.position,
    );
    if (prop.propKind === "barrel") {
      this.gore.spray(prop.position, dir, 28);
      this.gore.stain(
        prop.position.clone().setY(0.02),
        new T.Vector3(0, 1, 0),
        1,
      );
      for (const e of this.enemies) {
        const distance = e.position.distanceTo(prop.position);
        if (
          e.hp <= 0 ||
          distance > 4.2 ||
          traceShot(prop.position, e.position, this.level.activeWalls(), [])
        )
          continue;
        const away = e.position.clone().sub(prop.position).setY(0).normalize();
        this.hitEnemy(
          e,
          e.position.clone(),
          away,
          Math.max(35, 165 - distance * 28),
          "explosion",
        );
        e.velocity.addScaledVector(away, 10 * (1 - distance / 5));
      }
      const distance = this.position.distanceTo(prop.position);
      if (
        distance < 3.5 &&
        !traceShot(prop.position, this.position, this.level.activeWalls(), [])
      )
        this.hurt(Math.ceil(35 * (1 - distance / 3.5)));
      for (const other of this.level.scenery.props) {
        if (
          other !== prop &&
          !other.broken &&
          other.position.distanceTo(prop.position) < 2.7 &&
          !traceShot(
            prop.position,
            other.position,
            this.level.activeWalls(),
            [],
          )
        )
          this.damageProp(other, 80, dir);
      }
    } else if(this.testroom) {
      this.ammoBank.shotgun = Math.min(40, this.ammoBank.shotgun + 2);
      this.ammoBank.acid = Math.min(180, this.ammoBank.acid + 8);
      this.message("KIRILDI · +2 FİŞEK / +8 ASİT");
    } else this.message('KIRILDI');
  }
  updateShoves(dt: number) {
    const walls = this.level.activeWalls();
    for (const e of this.enemies) {
      if (
        e.velocity.lengthSq() < 0.01 ||
        e.ragdoll !== null ||
        e.state === "pinned" ||
        e.state === "pinning"
      )
        continue;
      const start = e.position.clone(),
        velocity = e.velocity.clone(),
        speed = velocity.length();
      const impact = stepImpulse(e.position, e.velocity, dt, e.radius, walls);
      if (impact > 4) {
        this.audio.play("kickImpact");
        if (e.hp > 0)
          this.hitEnemy(
            e,
            e.position.clone(),
            velocity.clone().normalize(),
            Math.min(30, impact * 1.8),
            "impact",
          );
      }
      if (speed > 3) {
        const proxies = this.enemies
          .filter(
            (other) => other !== e && other.hp > 0 && !e.shoveHits.has(other),
          )
          .map((other) => ({
            position: other.position,
            radius: other.radius + e.radius,
            hp: other.hp,
            state: other.state,
            owner: other,
          }));
        const hit = traceShot(start, e.position, [], proxies);
        if (hit) {
          const other = (hit.target as (typeof proxies)[number]).owner;
          e.shoveHits.add(other);
          other.shoveHits.add(e);
          this.bodiesCollided++;
          e.position.copy(hit.point);
          other.velocity.addScaledVector(velocity, 0.68);
          const dir = velocity.clone().normalize();
          this.hitEnemy(
            other,
            other.position.clone(),
            dir,
            Math.min(35, speed * 2),
            "impact",
          );
          if (e.hp > 0)
            this.hitEnemy(
              e,
              e.position.clone(),
              dir.clone().negate(),
              8,
              "impact",
            );
          e.velocity.multiplyScalar(0.23);
          other.timer = 0.8;
          this.audio.play("kickImpact");
        }
        for (const prop of this.level.scenery.props) {
          if (prop.broken) continue;
          const proxy = {
            position: prop.position,
            radius: prop.radius + e.radius,
            hp: prop.hp,
            state: prop.state,
          };
          if (traceShot(start, e.position, [], [proxy])) {
            this.damageProp(prop, speed * 8, velocity.clone().normalize());
            e.velocity.multiplyScalar(0.4);
          }
        }
      }
      e.rig.root.position.x = e.position.x;
      e.rig.root.position.z = e.position.z;
    }
  }
  resolveProps(position: T.Vector3, radius: number) {
    for (const prop of this.level.scenery.props) {
      if (prop.broken) continue;
      const dx = position.x - prop.position.x,
        dz = position.z - prop.position.z,
        dist = Math.hypot(dx, dz),
        sum = radius + prop.radius;
      if (dist > 1e-5 && dist < sum) {
        position.x += (dx / dist) * (sum - dist);
        position.z += (dz / dist) * (sum - dist);
      }
    }
  }
  hurt(amount: number) {
    if (this.mode !== "playing") return;
    this.health = Math.max(0, this.health - this.chapterState.incoming(amount));
    this.hurtFlash = 0.6;
    this.audio.play("hurt");
    if (this.health <= 0) this.finish("dead");
  }
  updateProjectiles(dt: number) {
    this.refreshHitParts();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i],
        next = p.position.clone().addScaledVector(p.direction, dt * p.speed);
      const targets = p.hostile
        ? [
            {
              position: this.position.clone().add(new T.Vector3(0, -0.3, 0)),
              radius: 0.48,
              hp: this.health,
              state: "idle" as EnemyState,
            },
          ]
        : [
            ...this.enemies,
            ...this.level.scenery.props.filter((prop) => !prop.broken),
          ];
      const hit = traceShot(
        p.position,
        next,
        this.level.activeWalls(),
        targets,
      );
      p.life -= dt;
      if (hit) {
        if(p.weapon==='acid')this.addCombatImpact(this.combatVfx.createImpact(.8),hit.point.clone().addScaledVector(p.direction,-.08),.3);
        if (hit.kind === "enemy") {
          if (p.hostile) this.hurt(p.damage);
          else if (hit.target && "propKind" in hit.target)
            this.damageProp(hit.target as Breakable, p.damage, p.direction);
          else
            this.hitEnemy(
              hit.target as Enemy,
              hit.point,
              p.direction,
              p.damage,
              p.weapon as WeaponId,
              hit.part,
            );
        } else {
          this.audio.play(p.hostile ? "flesh" : "bone");
          this.burst(hit.point, !p.hostile);
          if (!p.hostile && p.weapon === "femur") {
            const lodged = this.itemArt.createFemur(.85)??femur(.85);
            lodged.position.copy(hit.point).addScaledVector(p.direction, -0.25);
            lodged.quaternion.copy(p.mesh.quaternion);
            this.scene.add(lodged);
            this.addRemain(lodged);
          }
          if(p.weapon!=='acid'){const stain = oval(
            this.scene,
            mats.puddle,
            hit.point.clone().addScaledVector(hit.normal, 0.015).toArray(),
            [0.24, 0.24, 0.014],
          );
          stain.quaternion.setFromUnitVectors(
            new T.Vector3(0, 0, 1),
            hit.normal,
          );
          this.addRemain(stain);
          }
        }
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      } else if (p.life <= 0 || next.y < 0.02 || next.y > 5.75) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      } else {
        p.position.copy(next);
        p.mesh.position.copy(next);
      }
    }
  }
  updateEnemies(dt: number) {
    const walls = this.level.activeWalls();
    for (const e of this.enemies) {
      const previousPosition = e.position.clone();
      e.rig.root.userData.moving = false;
      const flash = e.rig.root.getObjectByName("enemy-muzzle-flash");
      if (flash)
        flash.visible =
          e.hp > 0 && this.time < (e.rig.root.userData.flashUntil ?? 0);
      const def = ENEMIES[e.kind],
        ranged =
          def.ranged && !(e.kind === "cultist" && e.lostParts.has("rightArm"));
      e.cooldown -= dt;
      e.shadow.position.set(e.position.x, 0.026, e.position.z);
      e.shadow.visible = e.rig.root.parent === this.scene;
      if (
        e.hp > 0 &&
        e.activated &&
        e.position.distanceTo(this.position) < 16 &&
        this.time > (e.rig.root.userData.nextVoice ?? 0)
      ) {
        this.playAt(e.kind === "cultist" ? "chant" : "alert", e.position);
        e.rig.root.userData.nextVoice = this.time + 7 + (e.phase % 3);
      }
      if (e.bleeding > 0) {
        e.bleeding -= dt;
        if (this.time % 0.09 < dt)
          this.gore.spray(
            e.position.clone().add(e.bleedOffset),
            new T.Vector3(0, 0.8, -0.3),
            3,
          );
      }
      if (e.corrosion > 0 && e.hp > 0) {
        e.corrosion -= dt;
        if (this.time % 0.3 < dt)
          this.hitEnemy(
            e,
            e.position.clone(),
            new T.Vector3(0, 0.5, 0),
            4,
            "corrosion",
          );
      }
      if (e.hp <= 0) {
        e.deathTime += dt;
        if (e.state === "pinning" && e.pin) {
          const duration = Math.max(
              0.22,
              e.origin.distanceTo(e.pin.target) / CONFIG.pushSpeed,
            ),
            t = Math.min(1, e.deathTime / duration);
          e.position.copy(e.origin).lerp(e.pin.target, 1 - Math.pow(1 - t, 2));
          e.rig.root.position.x = e.position.x;
          e.rig.root.position.z = e.position.z;
          if (t === 1) {
            e.state = "pinned";
            const anchor = e.pin.target.clone().add(e.impactOffset);
            const wallHit = traceShot(
              anchor,
              anchor
                .clone()
                .addScaledVector(e.impactDirection, CONFIG.pinDistance),
              walls,
              [],
            );
            const wallPoint = wallHit?.point ?? e.pin.wallPoint;
            const shaft = this.itemArt.createFemur(anchor.distanceTo(wallPoint)+.35)??femur(anchor.distanceTo(wallPoint)+.35);
            shaft.position.copy(anchor).lerp(wallPoint, 0.5);
            shaft.quaternion.setFromUnitVectors(
              new T.Vector3(0, 0, -1),
              wallPoint.clone().sub(anchor).normalize(),
            );
            this.scene.add(shaft);
            this.addRemain(shaft);
            this.audio.play("bone");
            const stain = oval(
              this.scene,
              mats.puddle,
              wallPoint.clone().addScaledVector(e.pin.normal, 0.02).toArray(),
              [0.56, 0.6, 0.012],
            );
            stain.quaternion.setFromUnitVectors(
              new T.Vector3(0, 0, 1),
              e.pin.normal,
            );
            this.addRemain(stain);
          }
        }
        if (e.state === "pinned") {
          e.rig.body.rotation.z =
            Math.sin(e.deathTime * 15) * 0.12 * Math.exp(-e.deathTime * 2);
          e.rig.head.rotation.x = 0.25;
          e.rig.arms.forEach((a) => (a.rotation.x = 0.15));
          e.rig.root.position.y = 0;
        }
        if (e.state === "dead") {
          if (e.ragdoll) {
            e.ragdoll.update(dt, walls);
            e.position.copy(e.ragdoll.nodes[0].position);
          }
        }
        continue;
      }
      const distance = e.position.distanceTo(this.position),
        los = !traceShot(e.position, this.position, walls, []);
      if (e.state === "idle") {
        if (
          distance < (e.zone === 0 ? 6 : e.kind === "cultist" ? 23 : 17) &&
          los &&
          (e.zone !== 3 || this.level.gateOpen)
        ) {
          e.activated = true;
          e.rig.root.userData.nextVoice = this.time + 3 + (e.phase % 4);
          e.state = "chase";
        } else {
          animateEnemy(e.rig, e.state, this.time, e.phase, e.kind);
          continue;
        }
      }
      if (e.state === "hurt") {
        e.timer -= dt;
        if (e.timer <= 0) e.state = "chase";
      } else if (e.state === "windup") {
        e.timer -= dt;
        e.rig.root.rotation.y = Math.atan2(
          -(this.position.x - e.position.x),
          -(this.position.z - e.position.z),
        );
        if (e.timer <= 0) {
          if (canAttack(e)) {
            if (!ranged) {
              if (distance < Math.min(1.8, def.range) + 0.2 && los)
                this.hurt(def.damage);
            } else if (los) {
              e.rig.root.updateMatrixWorld(true);
              const muzzle =
                e.kind === "cultist"
                  ? e.rig.root.getObjectByName("muzzle")
                  : undefined;
              const shotOrigin = muzzle
                ? muzzle.getWorldPosition(new T.Vector3())
                : e.position
                    .clone()
                    .addScaledVector(
                      this.position.clone().sub(e.position).normalize(),
                      0.65,
                    );
              const dir = this.position
                .clone()
                .add(new T.Vector3(0, -0.15, 0))
                .sub(shotOrigin)
                .normalize();
              // A barrel pressed through masonry must not spawn a bullet beyond it.
              if (!traceShot(e.position, shotOrigin, walls, [])) {
                this.spawnProjectile(
                  shotOrigin,
                  dir,
                  true,
                  e.kind === "cultist" ? "bullet" : "acid",
                  def.damage,
                );
                e.rig.root.userData.spriteFiredAt = this.time;
              }
              if (muzzle) {
                e.rig.root.userData.flashUntil = this.time + 0.065;
                if (flash) flash.visible = true;
              }
              this.playAt(
                e.kind === "cultist" ? "cultShot" : "spit",
                e.position,
              );
            }
          }
          e.state = "chase";
          e.cooldown = def.cooldown;
        }
      } else {
        const range = ranged ? def.range : Math.min(1.8, def.range);
        if (distance < range && los && e.cooldown <= 0) {
          e.state = "windup";
          e.timer = this.testroom?def.windup:campaignWindup(e.kind,this.difficulty);
          e.rig.root.userData.windupDuration=e.timer;
          this.playAt(e.kind === "cultist" ? "chant" : "alert", e.position);
        } else if (
          distance > (ranged ? 7 : range - 0.2) ||
          !los ||
          (e.kind === "cultist" && ranged)
        ) {
          const direction = los
            ? e.kind === "cultist" && ranged
              ? cultistMovement(e.position, this.position, this.time, e.phase)
              : this.position.clone().sub(e.position).setY(0).normalize()
            : this.nav.direction(e.position);
          const speed =
            def.speed *
            (e.lostParts.has("leftLeg") || e.lostParts.has("rightLeg")
              ? 0.4
              : 1);
          for (const other of this.enemies) {
            if (other === e || other.hp <= 0) continue;
            const dx = e.position.x - other.position.x,
              dz = e.position.z - other.position.z,
              d = Math.hypot(dx, dz);
            if (d > 0 && d < 1.05) {
              direction.x += (dx / d) * 0.5;
              direction.z += (dz / d) * 0.5;
            }
          }
          const movementWeight = Math.min(1, direction.length());
          direction.normalize().multiplyScalar(movementWeight);
          moveCircle(
            e.position,
            direction.x * speed * dt,
            direction.z * speed * dt,
            e.radius,
            walls,
          );
          this.resolveProps(e.position, e.radius);
          e.rig.root.rotation.y =
            e.kind === "cultist" && ranged
              ? Math.atan2(
                  -(this.position.x - e.position.x),
                  -(this.position.z - e.position.z),
                )
              : Math.atan2(-direction.x, -direction.z);
        }
      }
      e.rig.root.position.x = e.position.x;
      e.rig.root.position.z = e.position.z;
      const missingLeg =
        e.lostParts.has("leftLeg") || e.lostParts.has("rightLeg");
      e.rig.root.position.y = missingLeg ? -0.24 : 0;
      e.position.y = def.center + (missingLeg ? -0.24 : 0);
      e.rig.root.userData.moving =
        e.position.distanceToSquared(previousPosition) > 0.000001;
      animateEnemy(e.rig, e.state, this.time, e.phase, e.kind);
    }
  }
  interact() {
    if(!this.testroom){
      const forward=new T.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
      const clue=this.chapterState.nearby(this.position,forward);
      if(clue){
        const target=new T.Vector3(clue.x,1.65,clue.z),hit=traceShot(this.position,target,this.level.walls,[]);
        if(!hit){this.chapterState.tryOpen(this.position,forward);this.audio.play('door');this.message('Kemik dikişi ayrılıyor…');this.nav.refresh(this.position);return;}
      }
    }
    if (
      this.position.distanceTo(this.level.buttonPosition) < 2.4 &&
      !this.level.gateOpen
    ) {
      if(!this.testroom&&!this.chapterState.canOpenGate()){this.message('İLİK MÜHRÜ GEREKLİ · Batıdaki ilik kolunu araştır.');return;}
      this.level.gateOpen = true;
      this.audio.play("door");
      this.message("Zar açılıyor. Son boşluk seni bekliyor.");
      this.nav.refresh(this.position);
      return;
    }
    if (this.position.distanceTo(this.level.exitPosition) < 3) {
      if (this.exitReady()) {
        this.finish("won");
      } else
        this.message(
          !this.testroom&&!this.chapterState.keys.has('bile')?'SAFRA MÜHRÜ GEREKLİ · Doğudaki safra koluna dön.':`Çıkış bağlı: ${this.remainingGuardians()} muhafız hâlâ canlı.`,
        );
    }
  }
  prompt() {
    if(!this.testroom){const key=this.pickups.find(p=>!p.taken&&(p.kind==='marrow'||p.kind==='bile')&&this.position.distanceTo(p.mesh.position)<3&&!traceShot(this.position,p.mesh.position,this.level.activeWalls(),[]));if(key)return key.kind==='marrow'?'İLİK MÜHRÜ · YAKLAŞ VE AL':'SAFRA MÜHRÜ · YAKLAŞ VE AL';}
    if(!this.testroom&&this.chapterState.nearby(this.position,new T.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw))))return 'E  ·  ÇATLAK KEMİĞİ YOKLA';
    if (
      this.position.distanceTo(this.level.buttonPosition) < 2.4 &&
      !this.level.gateOpen
    )
      return !this.testroom&&!this.chapterState.canOpenGate()?'İLİK MÜHRÜ GEREKLİ':"E  ·  SİNİR DÜĞÜMÜNÜ SIK";
    if (this.position.distanceTo(this.level.exitPosition) < 3)
      return this.exitReady()
        ? "E  ·  ORGANİZMADAN ÇIK"
        : !this.testroom&&!this.chapterState.keys.has('bile')?'SAFRA MÜHRÜ GEREKLİ':`ÇIKIŞ KİLİTLİ  ·  ${this.remainingGuardians()} MUHAFIZ`;
    return "";
  }
  objective() {
    if (this.chapel)
      return !this.level.gateOpen
        ? "Şapeli temizle. Altarın mührünü E ile kır."
        : this.kills === this.enemies.length
          ? "Girişteki demir kapıya dön. E ile çık."
          : `Ayini sustur · ${this.enemies.length - this.kills} canlı`;
    if (this.exitReady())
      return "Aydınlık yarığa ulaş. E ile çık.";
    if(!this.testroom&&this.position.z<=-24){
      if(!this.chapterState.keys.has('marrow'))return 'Batıdaki ilik kolunda İlik Mührü’nü bul.';
      if(!this.chapterState.keys.has('bile'))return 'Doğudaki safra kolunda Safra Mührü’nü bul.';
    }
    if (this.level.gateOpen)
      return `Kalp muhafızlarını sustur · ${this.remainingGuardians()} canlı`;
    if (this.position.z > -24) return "Geçidi takip et. Kemiklerini hazırla.";
    return "Sinir düğümünü bul ve zar kapısını aç.";
  }
  remainingGuardians(){return this.enemies.filter(e=>e.hp>0&&(this.testroom||e.zone===3)).length;}
  exitReady(){return this.testroom?this.kills>=this.enemies.length&&this.level.gateOpen:this.chapterState.canExit(this.level.gateOpen,this.enemies);}
  powerStatus(){return [this.chapterState.armor>0?`ZIRH ${Math.ceil(this.chapterState.armor)}`:'',this.chapterState.keys.has('marrow')?'İLİK MÜHRÜ':'',this.chapterState.keys.has('bile')?'SAFRA MÜHRÜ':'',this.chapterState.wrath>0?`GAZAP ×2 · ${Math.ceil(this.chapterState.wrath)} sn`:'',this.chapterState.ward>0?`KEMİK ZIRHI · ${Math.ceil(this.chapterState.ward)} sn`:''].filter(Boolean).join('   /   ');}
  zone() {
    if (this.chapel) return "KÜL ŞAPELİ";
    const z = this.position.z;
    if (z > -8) return "UYANIŞ";
    if (z > -26) return "BAĞIRSAK TÜNELİ";
    if (this.position.x < -10 && z < -65) return "KEMİK CEBİ";
    if (this.position.x < -10) return "İLİK ODASI";
    if (this.position.x > 18) return "SAFRA ODASI";
    if (z > -47) return "MİDE BOŞLUĞU";
    if (z > -68) return "SİNİR DÜĞÜMÜ";
    return z > -97 ? "KALP ODASI" : "ÇIKIŞ YARIĞI";
  }
  update(dt: number) {
    this.time += dt;
    this.chapterState.step(dt);
    if(this.health>100)this.health=Math.max(100,this.health-dt);
    if(!this.testroom){
      for(const event of this.chapterState.enter(this.position.z,this.level.gateOpen)){
        this.message(event==='awakening'?'Et uyanıyor. İlk nöbetçiler seni duydu.':event==='stomach'?'Mide boşluğu. Yan geçitlerde kaynak ara.':'Kalp hızlandı. Muhafızlar uyanıyor.');
        this.playAt(event==='stomach'?'chant':'door',this.position);
        for(const e of this.enemies)if(e.state==='idle'&&e.zone===(event==='awakening'?0:event==='stomach'?1:3)&&e.position.distanceTo(this.position)<(event==='heart'?16:12)){e.activated=true;e.state='chase';}
      }
      if(this.chapterState.discover(this.position).length){this.secrets=this.chapterState.found.size;this.message(`GİZLİ ODA · ${this.secrets} / ${SECRET_PASSAGES.length}`);this.audio.play('pickup');}
    }
    this.elapsed += dt;
    const previousCooldown = this.weaponCycle;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.weaponCycle = Math.max(0, this.weaponCycle - dt);
    if (crossedReloadCue(this.weaponId, previousCooldown, this.weaponCycle))
      this.audio.play("reload");
    this.recoil = Math.max(0, this.recoil - dt / COMBAT_MOTION.recoilDuration);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    this.switchTimer = Math.max(0, this.switchTimer - dt);
    this.muzzleLight.intensity *= Math.exp(-dt * 28);
    this.updateKick(dt);
    if (this.firing) this.shoot();
    let forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")),
      right = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    if (this.keys.has("ArrowLeft")) this.yaw += dt * 1.6;
    if (this.keys.has("ArrowRight")) this.yaw -= dt * 1.6;
    if (this.keys.has("ArrowUp")) this.pitch = Math.min(1.2, this.pitch + dt);
    if (this.keys.has("ArrowDown"))
      this.pitch = Math.max(-1.2, this.pitch - dt);
    const length = Math.hypot(forward, right);
    if (length) {
      forward /= length;
      right /= length;
      const dx = -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right,
        dz = -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right;
      moveCircle(
        this.position,
        dx * (this.testroom?CONFIG.playerSpeed:CAMPAIGN_PLAYER_SPEED) * dt,
        dz * (this.testroom?CONFIG.playerSpeed:CAMPAIGN_PLAYER_SPEED) * dt,
        CONFIG.playerRadius,
        this.level.activeWalls(),
      );
      this.resolveProps(this.position, CONFIG.playerRadius);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.audio.play("step");
        this.stepTimer = 0.38;
      }
    }
    this.navTimer -= dt;
    if (this.navTimer <= 0) {
      this.nav.refresh(this.position);
      this.navTimer = 0.6;
    }
    this.updateShoves(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.gore.update(dt, this.level.activeWalls());
    this.level.update(this.time, dt);
    const environmentDamage=this.livingOrgan?.update(this.time,dt,this.position,this.gore)??0;
    if(environmentDamage)this.hurt(environmentDamage);
    for (const p of this.pickups) {
      if(p.taken || (p.secretId&&!this.chapterState.open.has(p.secretId)))continue;
      const floating=p.kind!=='ammo'&&p.kind!=='health';
      p.mesh.position.y=(floating?.7:.22)+Math.sin(this.time*2+p.mesh.position.x)*(floating?.08:.018);
      if(this.position.distanceTo(p.mesh.position)<1.55&&this.canCollectPickup(p)&&!traceShot(this.position,p.mesh.position,this.level.activeWalls(),[]))this.collectPickup(p);
    }
    // The isolated test rooms keep their refill convenience; campaign supplies are finite.
    if (
      this.testroom&&this.ammoBank.femur === 0 &&
      this.ammoBank.shotgun === 0 &&
      this.ammoBank.acid === 0 &&
      this.projectiles.every((p) => p.hostile) &&
      this.time % 6 < dt
    ) {
      const nearest = this.pickups
        .filter((p) => p.kind === "ammo")
        .sort(
          (a, b) =>
            a.mesh.position.distanceTo(this.position) -
            b.mesh.position.distanceTo(this.position),
        )[0];
      if (nearest) {
        nearest.taken = false;
        nearest.mesh.visible = true;
        this.message("Bir kemik bezi yeniden doldu. Yakındaki demeti topla.");
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      e.velocity.y -= dt * 6;
      e.mesh.position.addScaledVector(e.velocity, dt);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        this.effects.splice(i, 1);
      }
    }
  }
  frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const elapsed = (now - (this.previous || now)) / 1000;
    const delta = Math.min(0.1, elapsed);
    this.previous = now;
    if (this.mode === "playing") {
      this.accumulator += delta;
      let n = 0;
      while (this.accumulator >= 1 / 60 && n++ < 6 && this.mode === "playing") {
        this.update(1 / 60);
        this.accumulator -= 1 / 60;
      }
    } else this.accumulator = 0;
    this.camera.position.copy(this.position);
    this.localLights?.update(this.position);
    this.keyLight.position.copy(this.position).add(new T.Vector3(-6, 10, 3));
    this.keyLight.target.position.copy(this.position).setY(0);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    const moving =
      this.mode === "playing" &&
      ["KeyW", "KeyA", "KeyS", "KeyD"].some((k) => this.keys.has(k));
    const bob = moving
      ? Math.sin(this.time * 10) * 0.013
      : Math.sin(this.time * 1.8) * 0.006;
    this.weaponSway.lerp(
      new T.Vector2(
        T.MathUtils.clamp((this.previousAim.x - this.yaw) * 1.5, -0.075, 0.075),
        T.MathUtils.clamp((this.previousAim.y - this.pitch) * 1.2, -0.05, 0.05),
      ),
      1 - Math.exp(-delta * 12),
    );
    this.previousAim.set(this.yaw, this.pitch);
    this.gun.root.position.set(
      0.1 + bob + this.weaponSway.x,
      -0.13 +
        this.weaponSway.y +
        Math.abs(bob) -
        this.recoil * 0.025 -
        (this.switchTimer / COMBAT_MOTION.switchDuration) * 0.304 -
        (this.kickTime >= 0 ? 0.18 : 0),
      -0.84 + this.recoil * 0.13,
    );
    this.gun.root.rotation.set(0.16 + this.recoil * 0.12, 0, -0.035 + bob);
    animateWeaponModel(
      this.gun,
      this.weaponId,
      this.time,
      this.recoil,
      this.weaponCycle,
    );
    this.muzzleFlash.visible =
      this.weaponId === "shotgun" && this.recoil > 0.72;
    this.gun.root.updateMatrixWorld(true);
    this.muzzleFlash.position.copy(
      this.gun.root.localToWorld(new T.Vector3(0, 0.03, -0.75)),
    );
    this.muzzleFlash.scale.set(
      0.065 + this.recoil * 0.04,
      0.09 + this.recoil * 0.04,
      0.18,
    );
    this.muzzleFlash.rotation.z = this.time * 40;
    this.kickRig.root.visible = this.kickTime >= 0;
    if (this.kickTime >= 0) {
      const extension = kickExtension(this.kickTime);
      this.kickRig.root.position.set(
        0.28 - extension * 0.18,
        -0.6 + extension * 0.39,
        -0.25 - extension * 0.16,
      );
      this.kickRig.root.rotation.set(
        -0.08,
        extension * 0.04,
        -0.12 + extension * 0.12,
      );
      this.kickRig.thigh.rotation.x = 0.35 + extension * 1.55;
      this.kickRig.shin.rotation.x = -0.65 + extension * 0.2;
      this.kickRig.boot.rotation.x = -0.12 - extension * 0.2;
    }
    this.cultSprites.update(this.enemies, this.position, this.time);
    this.propSprites.update(this.level.scenery.props,this.position);
    this.weaponSprites.update(this.weaponId,this.weaponCycle,this.recoil,
      this.switchTimer,this.kickTime,bob,this.weaponSway,this.weaponCamera.aspect);
    for (const [id,rig] of Object.entries(this.arsenal))
      rig.root.visible=id===this.weaponId && !this.weaponSprites.has(this.weaponId);
    if (this.weaponSprites.has(this.weaponId)) this.muzzleFlash.visible=false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.weaponScene, this.weaponCamera);
    this.weaponSprites.render(this.renderer);
    this.frameCount++;
    this.fpsTime += elapsed;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.frameCount / this.fpsTime);
      this.fpsTime = this.frameCount = 0;
    }
    if (now - this.lastHud > 80) {
      this.onChange();
      this.lastHud = now;
    }
  };
}
