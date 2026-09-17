import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/?chapel=1');await page.waitForFunction(()=>window.__game?.assetsReady&&window.__game.combatVfx.ready,{},{timeout:120000});
 assert.equal(await page.locator('#difficulty-control').isVisible(),false);
 const result=await page.evaluate(()=>{
  const g=window.__game,paint=g.onChange;g.mode='playing';g.switchWeapon('acid');g.switchTimer=0;g.mode='paused';g.onChange=()=>{};
  const v=(x,y,z)=>g.position.clone().set(x,y,z);
  g.position.set(0,1.65,4);g.yaw=0;g.pitch=.05;
  g.spawnProjectile(v(.65,1.5,1.8),v(0,0,-1),false,'acid');g.addCombatImpact(g.combatVfx.createImpact(.7),v(1,1,1),.3);
  const enemy=g.enemies[0];enemy.rig.root.position.set(-.7,0,0);enemy.position.set(-.7,enemy.position.y,0);g.hitEnemy(enemy,v(-.7,1,0),v(0,0,-1),10,'acid','torso');
  g.gore.stain(v(-.7,.04,1),v(0,1,0),.9);
  g.mode='playing';paint();g.mode='paused';
  return{weapon:g.weaponId,unlocked:[...g.unlockedWeapons],count:g.enemies.length,blood:g.effects.some(e=>e.mesh.name==='illustrated-blood-impact'),acid:g.projectiles[0].mesh.name,stainMap:g.scene.getObjectByName('blood-stain-instances').material.map.image.src};
 });
 assert.equal(result.weapon,'acid');assert.equal(result.count,4);assert.equal(result.unlocked.length,3);assert(result.blood);assert.equal(result.acid,'illustrated-acid-projectile');assert(result.stainMap.includes('combat-vfx.png'));
 await page.waitForFunction(()=>window.__game.camera.position.z===4);await page.screenshot({path:'docs/screenshots/chapel-combat-vfx.png'});
 assert.deepEqual(errors,[]);await fs.writeFile('docs/chapel-vfx-verification.json',JSON.stringify({result,errors,method:'Real WebGL with staged acid and enemy-hit effects; chapel retains its original roster and all three weapons.'},null,2));console.log(result);
}finally{await browser.close();}
