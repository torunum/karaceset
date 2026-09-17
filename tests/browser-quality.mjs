import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/?testroom=1');await page.waitForFunction(()=>window.__game);
 await page.click('#start');
 const result=await page.evaluate(async()=>{
  const g=window.__game;g.mode='paused';await g.audio.ready;const e=g.enemies[0];const dir=e.position.clone().set(.3,0,-1).normalize();g.hitEnemy(e,e.position.clone(),dir,150,'acid','torso');
  for(let i=0;i<250;i++)g.updateEnemies(1/60);
  const d=e.ragdoll;
  const ragdoll={exists:!!d,settled:d?.settled,low:d?.nodes[0].position.y,minClearance:Math.min(...d.nodes.map(n=>n.position.y-n.radius)),finite:d.nodes.every(n=>n.position.toArray().every(Number.isFinite)),detached:e.rig.arms.every(a=>a.parent===e.rig.root)};
  const audio={decoded:g.audio.buffers.size,failed:g.audio.failedSamples};
  g.position.copy(e.position).add(e.position.clone().set(0,1.65,3));g.pitch=-.3;g.yaw=0;g.onChange=()=>{};document.querySelector('#overlay').hidden=true;document.querySelector('#hud').hidden=false;
  return {ragdoll,audio};
 });
 assert(result.ragdoll.exists&&result.ragdoll.settled&&result.ragdoll.finite&&result.ragdoll.detached);assert(result.ragdoll.low<.7);assert(result.ragdoll.minClearance>=-.001);assert(result.audio.decoded>=30);assert.equal(result.audio.failed.length,0);
 await page.screenshot({path:'docs/screenshots/quality-ragdoll.png'});
 await page.evaluate(()=>{const g=window.__game;g.reset();g.position.set(0,1.65,5);g.pitch=0;g.mode='playing';g.switchWeapon('shotgun');g.switchTimer=0;g.shotCooldown=.56;g.weaponCycle=.56;g.recoil=.15;g.mode='paused';});
 await page.screenshot({path:'docs/screenshots/quality-shotgun-cycle.png'});
 assert.deepEqual(errors,[]);await fs.writeFile('docs/quality-verification.json',JSON.stringify({...result,errors},null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}

