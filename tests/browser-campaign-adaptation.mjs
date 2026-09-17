import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__game?.assetsReady&&window.__game.combatVfx.ready,{},{timeout:120000});
 const result={};
 for(const [difficulty,count] of [['hard',39],['easy',18],['normal',30]]){
  await page.selectOption('#difficulty',difficulty);
  assert.equal(await page.evaluate(()=>window.__game.enemies.length),count);
 }
 result.progression=await page.evaluate(()=>{
  const g=window.__game;g.mode='paused';const paint=g.onChange;g.onChange=()=>{};
  window.__paint=()=>{g.mode='playing';paint();g.mode='paused';};
  const originalEnemies=g.updateEnemies;g.updateEnemies=()=>{};
  const start={ammo:{...g.ammoBank},weapons:[...g.unlockedWeapons],secrets:g.totalSecrets};
  g.position.copy(g.level.buttonPosition);g.interact();const locked=!g.level.gateOpen;
  for(const weapon of ['shotgun','acid']){const p=g.pickups.find(p=>p.grant?.unlock&&p.grant.weapon===weapon);g.position.copy(p.mesh.position).setY(1.65);g.mode='playing';g.update(1/60);g.mode='paused';}
  const unlocked=[...g.unlockedWeapons];
  for(const kind of ['marrow','bile']){const p=g.pickups.find(p=>p.kind===kind);g.position.copy(p.mesh.position).setY(1.65);g.update(1/60);}
  const keys=[...g.chapterState.keys];g.position.copy(g.level.buttonPosition);g.interact();const gate=g.level.gateOpen;
  const blocked=!g.exitReady();g.enemies.filter(e=>e.zone===3).forEach(e=>e.hp=0);const exit=g.exitReady();
  g.chapterState.reset();g.chapterState.grantArmor(100);g.health=100;g.mode='playing';g.hurt(30);g.mode='paused';const armor={health:g.health,remaining:g.chapterState.armor};
  g.health=150;g.update(1);const decay=g.health;
  g.updateEnemies=originalEnemies;g.reset();g.mode='paused';
  return{start,locked,unlocked,keys,gate,blocked,exit,armor,decay,resetKeys:g.chapterState.keys.size,resetWeapons:[...g.unlockedWeapons]};
 });
 assert.deepEqual(result.progression,{start:{ammo:{femur:10,shotgun:0,acid:0},weapons:['femur'],secrets:4},locked:true,unlocked:['femur','shotgun','acid'],keys:['marrow','bile'],gate:true,blocked:true,exit:true,armor:{health:80,remaining:90},decay:149,resetKeys:0,resetWeapons:['femur']});
 result.secrets=[];
 for(const [id,x,z,rewardX,kind] of [['marrow-cache',-6.4,3,-10,'ward'],['blood-vault',-22.8,-39,-26.5,'wrath'],['bile-reliquary',28.95,-42,33,'armor'],['last-seed',2.1,-104,-1.8,'overhealth']]){
  await page.evaluate(({x,z,rewardX})=>{const g=window.__game;g.position.set(x-Math.sign(rewardX-x),1.65,z);g.yaw=Math.sign(rewardX-x)>0?-Math.PI/2:Math.PI/2;g.mode='playing';},{x,z,rewardX});
  await page.keyboard.press('e');
  const state=await page.evaluate(({id,z,rewardX,kind})=>{const g=window.__game;g.mode='paused';const original=g.updateEnemies;g.updateEnemies=()=>{};g.position.set(rewardX,1.65,z);g.update(1/60);g.updateEnemies=original;return{opened:g.chapterState.open.has(id),taken:g.pickups.find(p=>p.secretId===id).taken,found:g.chapterState.found.has(id),kind,armor:g.chapterState.armor,health:g.health};},{id,z,rewardX,kind});
  assert(state.opened&&state.taken&&state.found);if(kind==='armor')assert.equal(state.armor,200);if(kind==='overhealth')assert.equal(state.health,200);result.secrets.push(state);
 }
 result.vfx=await page.evaluate(()=>{
  const g=window.__game;g.reset();g.mode='paused';g.position.set(0,1.65,6);g.yaw=0;g.pitch=.15;
  const v=(x,y,z)=>g.position.clone().set(x,y,z);
  const wall=g.level.walls.find(w=>Math.hypot(w.b.x-w.a.x,w.b.z-w.a.z)>1);
  const midpoint=v((wall.a.x+wall.b.x)/2,1,(wall.a.z+wall.b.z)/2),direction=v(-(wall.b.z-wall.a.z),0,wall.b.x-wall.a.x).normalize();
  g.spawnProjectile(midpoint.clone().addScaledVector(direction,-.2),direction,false,'acid');
  const projectile=g.projectiles[0].mesh.name;g.updateProjectiles(.08);
  const impact=g.effects.some(e=>e.mesh.name==='illustrated-acid-impact');
  g.updateProjectiles(5);g.effects.forEach(e=>g.scene.remove(e.mesh));g.effects=[];
  g.spawnProjectile(v(.5,1.4,3.5),v(0,0,-1),false,'acid');
  g.addCombatImpact(g.combatVfx.createImpact(1),v(1,1.05,2.8),.3);
  g.addCombatImpact(g.combatVfx.createBloodImpact(.9),v(-.8,1.1,3),.2);
  for(const [x,z] of [[-.6,3],[.2,2.7],[.6,3.5]])g.gore.stain(v(x,.01,z),v(0,1,0),.8);
  const stains=g.scene.getObjectByName('blood-stain-instances');
  window.__paint();return{projectile,impact,stains:stains.count,texture:stains.material.map?.image?.src,geometry:stains.geometry.type};
 });
 assert.equal(result.vfx.projectile,'illustrated-acid-projectile');assert(result.vfx.impact);assert.equal(result.vfx.stains,3);assert(result.vfx.texture.includes('combat-vfx.png'));assert.equal(result.vfx.geometry,'PlaneGeometry');
 await page.waitForFunction(()=>window.__game.camera.position.z===6);
 await page.screenshot({path:'docs/screenshots/combat-vfx-integrated.png'});
 result.cleanup=await page.evaluate(()=>{const g=window.__game;g.reset();return{effects:g.effects.length,projectiles:g.projectiles.length,stains:g.scene.getObjectByName('blood-stain-instances').count};});
 assert.deepEqual(result.cleanup,{effects:0,projectiles:0,stains:0});assert.deepEqual(errors,[]);
 await fs.writeFile('docs/campaign-adaptation-verification.json',JSON.stringify({result,errors,method:'Real WebGL with actual difficulty selector and keyboard secret interactions; staged positions and combat effects, not a full playthrough or hardware FPS benchmark.'},null,2));
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
