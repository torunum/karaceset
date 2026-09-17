import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport:{width:1100,height:760}});
  const errors=[]; page.on('pageerror', e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:5173/?chapel=1');
  await page.waitForFunction(()=>window.__game?.arsenal.shotgun.root.userData.assetSource==='blender/vesper');
  const result=await page.evaluate(async()=>{
    const g=window.__game; g.mode='paused';
    const gun=g.arsenal.shotgun;
    const {animateWeaponModel}=await import('/src/weapon-motion.ts');
    const {WEAPONS}=await import('/src/weapons.ts');
    const {installVesperAsset}=await import('/src/blender-weapon.ts');
    const T=await import('/node_modules/three/build/three.module.js');
    const before=gun.root.children.length;
    let rejected=false; try{installVesperAsset(gun,new T.Group());}catch{rejected=true;}
    const intact=before===gun.root.children.length;
    let triangles=0, finite=true, textured=0;
    gun.root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;const materials=Array.isArray(o.material)?o.material:[o.material];textured+=materials.filter(m=>m.map).length;}});
    animateWeaponModel(gun,'shotgun',1,0,WEAPONS.shotgun.fireInterval*.55);
    const opening=gun.mechanism.rotation.x;
    const shells=gun.root.userData.shells.some(s=>s.visible);
    gun.root.updateMatrixWorld(true);gun.root.traverse(o=>finite&&=o.matrixWorld.elements.every(Number.isFinite));
    animateWeaponModel(gun,'shotgun',2,0,0);
    const closed=gun.mechanism.rotation.x;
    g.reset();
    return {source:gun.root.userData.assetSource,triangles,textured,opening,shells,finite,closed,rejected,intact,resetSource:g.gun.root.userData.assetSource};
  });
  assert.equal(result.source,'blender/vesper');assert.equal(result.resetSource,result.source);
  assert(result.opening<-.4&&result.shells&&result.finite);assert(Math.abs(result.closed)<1e-7);
  assert(result.triangles>1000&&result.triangles<40000);assert(result.textured>0);
  assert(result.rejected&&result.intact);assert.deepEqual(errors,[]);
  await page.click('#start');
  await page.evaluate(()=>{const g=window.__game;g.mode='paused';g.onChange=()=>{};document.getElementById('overlay').hidden=true;g.enemies.forEach(e=>e.cooldown=100);});
  await page.screenshot({path:'docs/screenshots/vesper-blender-game.png'});
  // A neutral turntable view exposes the asset instead of hiding it in darkness.
  await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');const g=window.__game;
    g.onChange=()=>{};for(const id of ['overlay','hud','top','vignette','damage'])document.getElementById(id).hidden=true;document.querySelector('.grain').hidden=true;
    g.level.root.visible=false;g.enemies.forEach(e=>{e.rig.root.visible=false;e.shadow.visible=false;});g.gun.root.visible=false;
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const asset=(await new GLTFLoader().loadAsync('/models/vesper.glb')).scene;
    asset.position.y=1;asset.rotation.y=-.65;g.scene.add(asset);
    g.scene.fog=null;g.scene.background=new T.Color(0x26282b);g.scene.environmentIntensity=.7;g.keyLight.intensity=2;
    g.position.set(.8,1.20,.60);g.yaw=Math.atan2(.8,.6);g.pitch=-.2;
  });
  await page.screenshot({path:'docs/screenshots/vesper-blender-study.png'});
  // Missing asset must leave a usable procedural weapon, without an unhandled rejection.
  await page.route('**/models/vesper.glb',route=>route.fulfill({status:404,body:'missing'}));
  await page.reload();await page.waitForFunction(()=>window.__game?.arsenal.shotgun.root.userData.assetError);
  const fallback=await page.evaluate(()=>{const gun=window.__game.arsenal.shotgun;return {source:gun.root.userData.assetSource,meshes:gun.mechanism.children.length};});
  assert.equal(fallback.source,'procedural');assert(fallback.meshes>0);assert.deepEqual(errors,[]);
  await fs.writeFile('docs/blender-weapon-verification.json',JSON.stringify({result,fallback,errors,method:'Live GLB load, mechanical timeline, reset and missing-asset fallback; staged screenshots, not a subjective quality pass.'},null,2));
  console.log({result,fallback,errors});
} finally {await browser.close();}
