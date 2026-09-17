import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const results={};
 for(const chapel of [true,false]){
  await page.goto(`http://127.0.0.1:5173/${chapel?'?chapel=1':''}`);
  await page.waitForFunction(()=>window.__game?.assetsReady,{},{timeout:90000});
  const info=await page.evaluate(()=>{
   const g=window.__game;g.mode='paused';g.onChange=()=>{};document.getElementById('overlay').hidden=true;document.getElementById('hud').hidden=false;
   const roles={};g.level.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.environmentRole)roles[m.userData.environmentRole]=m.map?.image?.src;});
   g.enemies.forEach(e=>e.rig.root.visible=false);g.cultSprites.update(g.enemies,g.position,g.time);
   return {art:g.level.root.userData.environmentArt,roles,reliefs:g.level.root.getObjectByName('painted-chapel-reliefs')?.children.length??0,walls:g.level.walls.length};
  });
  assert(info.art.surfaces>=3);assert(info.roles.tissue.includes('painted-tissue'));
  if(chapel){assert(info.roles.stone.includes('painted-ashlar'));assert(info.roles.floor.includes('painted-flagstone'));}
  else assert(info.roles.boneWall.includes('painted-bone-wall'));
  if(chapel){assert.equal(info.reliefs,10);assert(info.roles.shrine.includes('cult-shrine'));
   for(const [name,x,z,yaw,pitch] of [['overview',0,6.2,0,.03],['shrine',0,-3.8,0,.13],['niches',1.5,.3,-Math.PI/2,.06]]){
    await page.evaluate(({x,z,yaw,pitch})=>{const g=window.__game;g.position.set(x,1.65,z);g.yaw=yaw;g.pitch=pitch;}, {x,z,yaw,pitch});
    await page.waitForFunction(({x,z})=>window.__game.camera.position.x===x&&window.__game.camera.position.z===z,{x,z});
    await page.screenshot({path:`docs/screenshots/chapel-art-${name}.png`});
   }
   const reset=await page.evaluate(()=>{const g=window.__game;g.reset();return g.level.root.getObjectByName('painted-chapel-reliefs').children.length;});assert.equal(reset,10);
  }else{
   assert.equal(info.reliefs,0);
   await page.evaluate(()=>{const g=window.__game;g.position.set(0,1.65,5);g.yaw=0;g.pitch=.08;});
   await page.waitForFunction(()=>window.__game.camera.position.z===5);
   await page.screenshot({path:'docs/screenshots/organic-art-main.png'});
  }
  results[chapel?'chapel':'main']=info;
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile('docs/environment-art-verification.json',JSON.stringify({results,errors,method:'Real WebGL staged environment views, enemies hidden for inspection; not a full playthrough.'},null,2));console.log(results);
}finally{await browser.close();}
