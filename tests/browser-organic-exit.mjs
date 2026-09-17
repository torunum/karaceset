import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}});
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__game?.assetsReady,{},{timeout:120000});
 const textured=await page.evaluate(()=>{const g=window.__game;g.mode='playing';g.onChange();g.mode='paused';g.onChange=()=>{};g.position.set(6,1.65,-98);g.yaw=0;g.pitch=0;
  const exit=g.level.root.getObjectByName('organic-exit-membrane');return exit.children.filter(o=>o.isMesh&&o.material.map).length;
 });
 assert.equal(textured,2);await page.waitForFunction(()=>window.__game.camera.position.z===-98);
 await page.screenshot({path:'docs/screenshots/living-exit.png'});console.log({textured});
}finally{await browser.close();}
