import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5173/?chapel=1');await page.waitForFunction(()=>window.__game);
 await page.click('#settings-toggle');await page.locator('#volume-creatures').focus();await page.keyboard.press('Home');for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');
 assert(Math.abs(await page.evaluate(()=>window.__game.audio.channelVolumes.creatures)-.2)<.001);
 await page.screenshot({path:'docs/screenshots/audio-mix-settings.png'});await page.click('#settings-close');await page.click('#start');
 const audio=await page.evaluate(async()=>{
  const a=window.__game.audio;await a.ready;a.play('cultShot',4,.4,0);let voice=a.voices.at(-1);const open={gain:voice.gain.gain.value,filter:voice.filter.frequency.value};await new Promise(r=>setTimeout(r,45));a.play('cultShot',4,.4,1);voice=a.voices.at(-1);const blocked={gain:voice.gain.gain.value,filter:voice.filter.frequency.value};return {open,blocked,bus:a.channels.creatures.gain.value,decoded:a.buffers.size};
 });assert(audio.blocked.gain<audio.open.gain*.5);assert.equal(audio.blocked.filter,1050);assert(Math.abs(audio.bus-.2)<.001);
 const damage=await page.evaluate(()=>{
  const g=window.__game;g.mode='paused';g.onChange=()=>{};document.querySelector('#overlay').hidden=true;document.querySelector('#hud').hidden=false;g.enemies.forEach(e=>{e.rig.root.visible=false;e.shadow.visible=false;});g.position.set(0,1.65,3);g.yaw=0;g.pitch=-.19;g.gun.root.visible=false;
  g.level.scenery.props.forEach((p,i)=>{p.position.set((i-1)*1.6,.6,-1);p.root.position.set(p.position.x,0,-1);p.wreckage.position.copy(p.root.position);p.root.rotation.y=0;p.wreckage.rotation.y=0;g.damageProp(p,p.hp/2,g.position.clone().set(0,0,-1));});return g.level.scenery.props.every(p=>p.damageVisual.visible&&p.root.visible&&!p.wreckage.visible);
 });assert(damage);await page.screenshot({path:'docs/screenshots/props-damaged.png'});
 const broken=await page.evaluate(()=>{const g=window.__game;g.level.scenery.props.forEach(p=>g.damageProp(p,999,g.position.clone().set(0,0,-1)));g.gore.reset();return g.level.scenery.props.every(p=>!p.root.visible&&p.wreckage.visible);});assert(broken);await page.screenshot({path:'docs/screenshots/props-wreckage.png'});
 const reset=await page.evaluate(()=>{const g=window.__game;g.reset();return g.level.scenery.props.every(p=>p.root.visible&&!p.damageVisual.visible&&!p.wreckage.visible);});assert(reset);assert.deepEqual(errors,[]);const result={audio,damage,broken,reset,errors};await fs.writeFile('docs/environment-audio-verification.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
