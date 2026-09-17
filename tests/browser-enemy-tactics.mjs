import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/?chapel=1');await page.waitForFunction(()=>window.__game);await page.click('#start');
 const result=await page.evaluate(()=>{
  const g=window.__game;g.mode='paused';const e=g.enemies.find(e=>e.kind==='cultist');g.enemies.filter(o=>o!==e).forEach(o=>o.hp=0);
  const setup=(z)=>{e.position.set(0,1.08,0);e.rig.root.position.set(0,0,0);e.rig.root.rotation.y=Math.PI;e.state='chase';e.cooldown=100;e.phase=0;e.hp=95;g.position.set(0,1.65,z);g.time=1;};
  setup(7);for(let i=0;i<60;i++){g.time+=1/60;g.updateEnemies(1/60);}const strafe=Math.abs(e.position.x);const moving=e.rig.root.userData.moving;
  setup(2);for(let i=0;i<40;i++){g.time+=1/60;g.updateEnemies(1/60);}const retreat=e.position.distanceTo(g.position);
  setup(7);e.state='windup';e.timer=.3;for(let i=0;i<10;i++){g.time+=1/60;g.updateEnemies(1/60);}const steady=e.position.length()-1.08;
  e.timer=.001;g.updateEnemies(1/60);const muzzle=e.rig.root.getObjectByName('muzzle');const projectile=g.projectiles.at(-1);const originGap=muzzle&&projectile?muzzle.getWorldPosition(e.position.clone()).distanceTo(projectile.position):null;
  g.reset();return {strafe,moving,retreat,steady,projectile:!!projectile,originGap};
 });
 assert(result.strafe>.5);assert(result.moving);assert(result.retreat>2.7);assert(Math.abs(result.steady)<.001);assert(result.projectile);if(result.originGap!==null)assert(result.originGap<.12);assert.deepEqual(errors,[]);
 await fs.writeFile('docs/animation-combat-verification.json',JSON.stringify({...result,errors},null,2));console.log(result);
}finally{await browser.close();}
