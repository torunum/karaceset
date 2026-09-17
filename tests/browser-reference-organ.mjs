import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__game?.assetsReady&&window.__game.livingOrgan?.ready,{},{timeout:120000});
 const result=await page.evaluate(()=>{
  const g=window.__game,paint=g.onChange;g.mode='paused';g.onChange=()=>{};window.__paint=()=>{g.mode='playing';paint();g.mode='paused';};
  const roles={};g.level.root.traverse(o=>{if(o.isMesh&&o.material.userData.environmentRole)roles[o.material.userData.environmentRole]=o.material.map?.image?.src;});
  const mounds=g.livingOrgan.root.children.filter(o=>o.name==='illustrated-corpse-mound');
  return{roles,mounds:mounds.length,details:g.livingOrgan.root.children.length,fallbackHidden:!g.level.root.getObjectByName('mound-fallback-0').visible,lights:g.localLights?.lights.length??0};
 });
 assert.equal(result.mounds,6);assert(result.fallbackHidden);assert(result.roles.intestine.includes('painted-intestine'));assert(result.roles.ribWall.includes('painted-rib-wall'));
 for(const [name,x,z,yaw] of [['intestine',-2,-9,-.32],['marrow',-17,-33,0],['mound',0,8.4,-.6]]){
  await page.evaluate(({x,z,yaw})=>{const g=window.__game;g.position.set(x,1.65,z);g.yaw=yaw;g.pitch=0;window.__paint();},{x,z,yaw});
  await page.waitForFunction(({x,z})=>window.__game.camera.position.x===x&&window.__game.camera.position.z===z,{x,z});
  await page.screenshot({path:`docs/screenshots/reference-${name}.png`});
 }
 assert.deepEqual(errors,[]);await fs.writeFile('docs/reference-organ-verification.json',JSON.stringify({result,errors,method:'Actual WebGL at staged viewpoints; not a full combat playthrough.'},null,2));console.log(result);
}finally{await browser.close();}
