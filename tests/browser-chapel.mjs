import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/?chapel=1');await page.waitForFunction(()=>window.__game);await page.click('#start');
 await page.evaluate(()=>{const g=window.__game;g.mode='paused';g.onChange=()=>{};document.querySelector('#overlay').hidden=true;document.querySelector('#hud').hidden=false;g.position.set(0,1.65,4);g.yaw=0;g.pitch=0;});
 await page.screenshot({path:'docs/screenshots/chapel-overview.png'});
 await page.evaluate(()=>{const g=window.__game;const e=g.enemies.find(e=>e.kind==='cultist');e.position.set(0,1.08,-1);e.rig.root.position.set(0,0,-1);e.rig.root.rotation.y=Math.PI;g.position.set(0,1.65,1.8);g.pitch=-.06;g.gun.root.visible=false;});
 await page.screenshot({path:'docs/screenshots/chapel-cultist-front.png'});
 await page.evaluate(()=>window.__game.enemies.find(e=>e.kind==='cultist').rig.root.rotation.y=Math.PI/2);
 await page.screenshot({path:'docs/screenshots/chapel-cultist-side.png'});
 const result=await page.evaluate(()=>{const g=window.__game;g.reset();g.mode='playing';const props=g.level.scenery.props;const valid=g.enemies.every(e=>g.level.contains(e.position.x,e.position.z,e.radius));const dir=g.position.clone().set(0,0,-1);for(const p of props)g.damageProp(p,250,dir);for(const e of g.enemies)g.hitEnemy(e,e.position.clone(),dir,999,'acid');g.position.copy(g.level.buttonPosition);g.interact();const opened=g.level.gateOpen;g.position.copy(g.level.exitPosition);g.interact();const won=g.mode==='won';g.reset();return {chapel:g.chapel,weapon:g.weaponId,valid,opened,won,actors:g.enemies.length,props:props.length,reset:props.every(p=>!p.broken)&&g.kills===0};});
 assert(result.valid&&result.opened&&result.won&&result.reset);assert.equal(result.weapon,'shotgun');assert.equal(result.actors,4);assert.equal(result.props,3);assert.deepEqual(errors,[]);await fs.writeFile('docs/chapel-verification.json',JSON.stringify({...result,errors},null,2));console.log(result);
}finally{await browser.close();}

