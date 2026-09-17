import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/?chapel=1');
 await page.waitForFunction(()=>window.__game?.assetsReady&&window.__game.weaponSprites.ready);
 await page.click('#start');
 const result=await page.evaluate(()=>{
  const g=window.__game;g.mode='paused';const paint=g.onChange;window.__paintHud=()=>{const mode=g.mode;g.mode="playing";paint();g.mode=mode;};g.onChange=()=>{};document.getElementById('overlay').hidden=true;
  g.position.set(0,1.65,4.5);g.yaw=0;g.pitch=0;g.time=10;
  const cult=g.enemies.find(e=>e.kind==='cultist'),zombie=g.enemies.find(e=>e.kind==='shambler');
  g.enemies.forEach(e=>e.rig.root.visible=e===cult||e===zombie);
  for(const [e,x] of [[cult,-1.1],[zombie,1.3]]) {e.position.set(x,1.08,.2);e.rig.root.position.set(x,0,.2);e.rig.root.rotation.y=Math.PI;e.state='idle';}
  const sync=()=>g.cultSprites.update(g.enemies,g.position,g.time);
  sync();const zFrames=[];
  for(const [state,timer,time] of [['idle',0,10],['chase',0,11],['windup',.3,12],['windup',.05,12.25],['hurt',.2,13],['dead',0,14]]) {
   zombie.state=state;zombie.timer=timer;g.time=time;zombie.rig.root.userData.moving=state==='chase';sync();zFrames.push(zombie.rig.root.userData.spriteFrame);
  }
  zombie.state='idle';sync();
  const images={};
  for(const id of ['shotgun','femur','acid']) {
   g.weaponSprites.update(id,0,0,0,-1,0,g.weaponSway,g.weaponCamera.aspect);
   const im=g.weaponSprites.mesh.material.map.image,c=document.createElement('canvas');c.width=im.width;c.height=im.height;
   const ctx=c.getContext('2d');ctx.drawImage(im,0,0);images[id]={alpha:ctx.getImageData(0,0,1,1).data[3],width:im.width};
  }
  const im=g.scene.getObjectByName('executioner-pixel-sprite').material.map.image;
  const executionerSource=im.src.includes('executioner.png');
  g.gore.sever(zombie.rig,'rightArm',g.position.clone().set(1,0,0));
  const fragment=g.gore.particles.find(p=>p.mesh.userData.pixelFragment);
  const fragmentSource=fragment.mesh.material.map.image.src.includes('executioner.png');
  zombie.rig.arms[1].visible=true;g.gore.reset();
  return {zFrames,images,executionerSource,fragmentSource};
 });
 assert.deepEqual(result.zFrames,[0,1,4,5,6,7]);assert(result.executionerSource&&result.fragmentSource);
 for(const v of Object.values(result.images)) {assert.equal(v.alpha,0);assert.equal(v.width,1774);}
 for(const id of ['shotgun','femur','acid']) {
  await page.evaluate(id=>{const g=window.__game;g.projectiles.forEach(p=>g.scene.remove(p.mesh));g.projectiles=[];g.weaponId=id;g.gun=g.arsenal[id];g.weaponCycle=0;g.recoil=0;g.switchTimer=0;g.kickTime=-1;window.__paintHud();},id);
  await page.waitForFunction(id=>window.__game.weaponSprites.mesh.userData.weapon===id,id);
  await page.screenshot({path:`docs/screenshots/illustrated-${id}.png`});
  const shot=await page.evaluate(()=>{const g=window.__game;g.mode='playing';g.shotCooldown=0;const before=g.ammo,projectiles=g.projectiles.length;g.shoot();g.mode='paused';g.weaponSprites.update(g.weaponId,g.weaponCycle,g.recoil,0,-1,0,g.weaponSway,g.weaponCamera.aspect);return {frame:g.weaponSprites.mesh.userData.frame,ammo:before-g.ammo,projectiles:g.projectiles.length-projectiles,oldVisible:Object.values(g.arsenal).some(r=>r.root.visible)};});
  assert.equal(shot.frame,1);assert.equal(shot.ammo,1);assert(shot.projectiles>0);assert(!shot.oldVisible);
  result[id]=shot;
 }
 await page.evaluate(()=>{const g=window.__game;g.projectiles.forEach(p=>g.scene.remove(p.mesh));g.projectiles=[];g.weaponId='shotgun';g.gun=g.arsenal.shotgun;g.weaponCycle=.76*.4;g.recoil=0;window.__paintHud();});
 await page.waitForFunction(()=>window.__game.weaponSprites.mesh.userData.frame===5);
 await page.screenshot({path:'docs/screenshots/illustrated-reload.png'});
 await page.evaluate(()=>window.__game.kickTime=.12);
 await page.waitForFunction(()=>!window.__game.weaponSprites.mesh.visible);
 await page.evaluate(()=>{const g=window.__game;g.kickTime=-1;g.reset();g.mode='paused';g.cultSprites.update(g.enemies,g.position,g.time);});
 result.reset=await page.evaluate(()=>{const g=window.__game;return g.scene.children.filter(o=>o.name==='executioner-pixel-sprite').length;});
 assert.equal(result.reset,2);assert.deepEqual(errors,[]);
 await fs.writeFile('docs/illustrated-arsenal-verification.json',JSON.stringify({result,errors,method:'Staged in-engine states and real fire calls; screenshots are staged, not a full playthrough.'},null,2));
 console.log(result);
} finally {await browser.close();}


