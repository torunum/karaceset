import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__game?.assetsReady&&window.__game.livingOrgan?.ready,{},{timeout:120000});
 const result=await page.evaluate(()=>{
  const g=window.__game,paint=g.onChange;g.mode='paused';g.onChange=()=>{};
  window.__paint=()=>{const mode=g.mode;g.mode='playing';paint();g.mode=mode;};
  const result={details:g.livingOrgan.root.children.length,itemArt:g.itemArt.ready,pickups:g.pickups.length,secretDoors:g.level.secretPanels.size};
  const projectile=g.itemArt.createFemur();result.projectile=projectile.name;result.projectilePlanes=projectile.children.length;
  g.spawnProjectile(g.position.clone().set(.5,1.2,2.5),g.position.clone().set(-1,0,0),false,'femur');
  g.gore.spray(g.position.clone().set(0,1,3),g.position.clone().set(0,0,1),30);g.gore.update(.01,g.level.activeWalls());
  result.bloodInstances=g.scene.getObjectByName('blood-drop-instances').count;
  g.chapterState.grant('ward');g.mode='playing';g.hurt(20);result.wardDamage=100-g.health;
  g.chapterState.grant('wrath');result.wrath=g.chapterState.outgoing(20);
  g.mode='paused';g.chapterState.reset();g.health=100;
  g.position.set(-5,1.65,3);g.yaw=Math.PI/2;g.pitch=0;window.__paint();
  return result;
 });
 assert.equal(result.secretDoors,4);assert.equal(result.pickups,26);assert(result.details>=50);assert(result.itemArt);
 assert.equal(result.projectilePlanes,2);assert.equal(result.wardDamage,8);assert.equal(result.wrath,40);assert.equal(result.bloodInstances,30);
 await page.evaluate(()=>window.__game.mode='playing');await page.keyboard.press('e');
 result.secret=await page.evaluate(()=>{
  const g=window.__game;g.mode='paused';const opened=g.level.secretOpen.has('marrow-cache');
  for(let i=0;i<60;i++)g.level.update(i/60,1/60);
  g.position.set(-10,1.65,3);g.update(1/60);g.mode='paused';g.yaw=-Math.PI/2;
  window.__paint();return{opened,panelY:g.level.secretPanels.get('marrow-cache').position.y,found:g.secrets,ward:g.chapterState.ward};
 });
 assert(result.secret.opened&&result.secret.panelY>8);assert.equal(result.secret.found,1);assert(result.secret.ward>23);
 await page.screenshot({path:'docs/screenshots/living-secret.png'});
 result.reset=await page.evaluate(()=>{const g=window.__game;g.reset();g.mode='paused';g.onChange=()=>{};return{secret:g.secrets,open:g.level.secretOpen.size,ward:g.chapterState.ward,pickups:g.pickups.length};});
 assert.deepEqual(result.reset,{secret:0,open:0,ward:0,pickups:26});
 for(const [name,x,z,yaw] of [['entry',0,6,0],['gut',-2,-9,-.32],['heart',6,-78,0]]){
  await page.evaluate(({x,z,yaw})=>{const g=window.__game;g.position.set(x,1.65,z);g.yaw=yaw;g.pitch=.06;g.livingOrgan.update(2,1/60,g.position,g.gore);window.__paint();},{x,z,yaw});
  await page.waitForFunction(({x,z})=>window.__game.camera.position.x===x&&window.__game.camera.position.z===z,{x,z});
  await page.screenshot({path:`docs/screenshots/living-${name}.png`});
 }
 result.exit=await page.evaluate(()=>{const g=window.__game;g.level.gateOpen=true;g.chapterState.collectKey('bile');const blocked=!g.exitReady();g.enemies.filter(e=>e.zone===3).forEach(e=>e.hp=0);const sideEnemy=g.enemies.some(e=>e.zone!==3&&e.hp>0);return{blocked,cleared:g.exitReady(),sideEnemy};});
 assert.deepEqual(result.exit,{blocked:true,cleared:true,sideEnemy:true});
 assert.deepEqual(errors,[]);await fs.writeFile('docs/living-chapter-verification.json',JSON.stringify({result,errors,method:'Real WebGL, staged cameras/combat state, actual keyboard secret interaction and pickup update. Not a complete human playthrough.'},null,2));console.log(result);
}finally{await browser.close();}
