import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:760}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__game?.assetsReady,{},{timeout:60000});
 const result=await page.evaluate(async()=>{
  const g=window.__game;g.mode='paused';const {animateEnemy}=await import('/src/enemy-art.ts');
  const kinds=[...new Set(g.enemies.map(e=>e.kind))];const actors=[];
  for(const kind of kinds){const e=g.enemies.find(e=>e.kind===kind);let meshes=0,triangles=0;const geometries=new Set();e.rig.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geometries.add(o.geometry);}});
   for(let frame=0;frame<60;frame++)animateEnemy(e.rig,'windup',frame/60,0,kind);e.rig.root.updateMatrixWorld(true);let finite=true;e.rig.root.traverse(o=>finite&&=o.matrixWorld.elements.every(Number.isFinite));
   actors.push({kind,source:e.rig.root.userData.assetSource,meshes,triangles,finite});
  }
  const weapons=Object.fromEntries(Object.entries(g.arsenal).map(([id,gun])=>[id,{source:gun.root.userData.assetSource,hands:gun.root.userData.handsAssetSource}]));
  const props=g.level.scenery.props.map(p=>p.root.userData.blenderAsset);
  const kick=g.kickRig.root.userData.assetSource;
  const e=g.enemies.find(e=>e.kind==='cultist');g.gore.sever(e.rig,'leftArm',e.position.clone().set(1,0,-1));
  const severed=!e.rig.arms[0].visible;
  g.reset();const reset=g.enemies.every(e=>e.rig.root.userData.assetSource===`blender/${e.kind}`);
  const fresh=g.enemies[0];let freshFinite=true;fresh.rig.root.updateMatrixWorld(true);fresh.rig.root.traverse(o=>freshFinite&&=o.matrixWorld.elements.every(Number.isFinite));
  return{actors,weapons,props,kick,severed,reset,freshFinite};
 });
 assert.equal(result.actors.length,5);for(const a of result.actors){assert.equal(a.source,`blender/${a.kind}`);assert(a.finite);assert(a.triangles>1000&&a.triangles<80000);}
 for(const w of Object.values(result.weapons)){assert(w.source.startsWith('blender/'));assert.equal(w.hands,'blender/warden-hands');}
 assert(result.props.every(p=>p==='props-v1'));assert.equal(result.kick,'blender/warden-kick');assert(result.severed&&result.reset&&result.freshFinite);assert.deepEqual(errors,[]);
 // All five installed gameplay rigs under neutral light, including their joints.
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const g=window.__game;g.mode='paused';g.onChange=()=>{};
  for(const id of ['overlay','hud','top','vignette','damage'])document.getElementById(id).hidden=true;document.querySelector('.grain').hidden=true;
  g.level.root.visible=false;Object.values(g.arsenal).forEach(gun=>gun.root.visible=false);g.enemies.forEach(e=>{e.rig.root.visible=false;e.shadow.visible=false;});
  g.pickups.forEach(p=>p.mesh.visible=false);g.remains.forEach(p=>p.visible=false);g.effects.forEach(p=>p.mesh.visible=false);g.projectiles.forEach(p=>p.mesh.visible=false);
  ['cultist','shambler','runner','spitter','brute'].forEach((kind,i)=>{const e=g.enemies.find(e=>e.kind===kind);e.rig.root.visible=true;e.rig.root.position.set((i-2)*1.05,0,0);e.rig.root.rotation.y=Math.PI;});
  g.scene.fog=null;g.scene.background=new T.Color(0x292b2c);g.scene.environmentIntensity=.6;g.keyLight.intensity=2.1;g.position.set(0,1.25,5);g.pitch=0;g.yaw=0;
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x41403a,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;g.scene.add(floor);
 });
 await page.screenshot({path:'docs/screenshots/blender-enemy-lineup.png'});
 await page.goto('http://127.0.0.1:5173/?chapel=1');await page.waitForFunction(()=>window.__game?.assetsReady);
 await page.click('#start');await page.evaluate(()=>{const g=window.__game;g.mode='paused';g.onChange=()=>{};document.getElementById('overlay').hidden=true;});
 await page.screenshot({path:'docs/screenshots/blender-chapel-game.png'});
 assert.deepEqual(errors,[]);
 await fs.writeFile('docs/blender-pack-verification.json',JSON.stringify({result,errors,method:'Actual GLB loads, five gameplay rigs, all weapons/hands/boot, prop slots, sever and reset. Staged neutral/in-game screenshots; not a subjective quality acceptance.'},null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
