import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}});
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__game?.assetsReady,{},{timeout:120000});
 const result=await page.evaluate(()=>{
  const g=window.__game;g.mode='paused';g.onChange=()=>{};
  const e=g.enemies.find(e=>e.kind==='shambler');
  g.hitEnemy(e,e.position.clone(),e.position.clone().set(0,0,-1),1,'femur','torso');
  g.cultSprites.update(g.enemies,g.position,g.time);
  const bone=e.rig.root.getObjectByName('illustrated-femur-projectile');
  const proxies=[];e.rig.root.traverse(o=>{if(o.isMesh&&o.userData.organicItem!=='femur')proxies.push(o.layers.mask);});
  return{exists:!!bone,layers:bone?.children.map(o=>o.layers.mask),hp:e.hp,proxyHidden:proxies.length>0&&proxies.every(mask=>(mask>>>0)===2147483648)};
 });
 assert(result.exists);assert.deepEqual(result.layers,[1,1]);assert(result.hp>0);assert(result.proxyHidden);
 await fs.writeFile('docs/embedded-bone-verification.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
