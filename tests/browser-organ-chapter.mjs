import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__game?.assetsReady&&window.__game.propSprites.ready,{},{timeout:90000});
 const result=await page.evaluate(()=>{
  const g=window.__game,paint=g.onChange;g.mode='paused';g.onChange=()=>{};
  window.__paint=()=>{const mode=g.mode;g.mode='playing';paint();g.mode=mode;};window.__paint();
  const roles=new Set();g.level.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.environmentRole)roles.add(m.userData.environmentRole);});
  const prop=g.level.scenery.props.find(p=>p.propKind==='crate'),dir=g.position.clone().set(0,0,-1);
  const states=[];const sync=()=>{g.level.scenery.update(g.time,1/60);g.propSprites.update(g.level.scenery.props,g.position);states.push(prop.root.userData.spriteState);};
  sync();g.damageProp(prop,prop.hp*.55,dir);sync();g.damageProp(prop,100,dir);sync();
  const wreckVisible=g.scene.getObjectsByProperty('name','illustrated-crate').some(o=>o.userData.propState===2&&o.visible);
  g.reset();g.mode='paused';g.onChange=()=>{};window.__paint();g.propSprites.update(g.level.scenery.props,g.position);
  const heart=g.level.root.getObjectByName('illustrated-hanging-heart');
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const ctx=canvas.getContext('2d');ctx.drawImage(heart.material.map.image,0,0);const heartAlpha=ctx.getImageData(0,0,1,1).data[3];
  return{enemies:g.enemies.length,props:g.level.scenery.props.length,pickups:g.level.pickups.length,roles:[...roles],states,wreckVisible,heartAlpha,reset:g.scene.children.filter(o=>o.name.startsWith('illustrated-')&&o.name!=='illustrated-player-weapon').length};
 });
 assert.equal(result.enemies,30);assert.equal(result.props,20);assert.deepEqual(result.states,[0,1,2]);assert(result.wreckVisible);assert.equal(result.reset,20);assert(result.roles.includes('boneWall')&&result.roles.includes('tissue'));assert(!result.roles.includes('stone'));
 assert.equal(result.heartAlpha,0);
 for(const [name,x,z,yaw,pitch] of [['entry',0,6,0,.02],['gut',-2,-9,-.32,.06],['stomach',4,-29,0,.06],['heart',6,-78,0,.06]]){
  await page.evaluate(({x,z,yaw,pitch})=>{const g=window.__game;g.position.set(x,1.65,z);g.yaw=yaw;g.pitch=pitch;window.__paint();},{x,z,yaw,pitch});
  await page.waitForFunction(({x,z})=>window.__game.camera.position.x===x&&window.__game.camera.position.z===z,{x,z});
  await page.screenshot({path:`docs/screenshots/organ-${name}.png`});
 }
 // Exercise a real keyboard interaction with the nerve node; combat state is staged.
 await page.evaluate(()=>{const g=window.__game;g.position.copy(g.level.buttonPosition);g.position.y=1.65;g.mode='playing';});
 await page.keyboard.press('e');
 result.gate=await page.evaluate(()=>{const g=window.__game;g.mode='paused';return g.level.gateOpen;});assert(result.gate);
 result.exit=await page.evaluate(()=>{const g=window.__game;g.position.copy(g.level.exitPosition);g.interact();const blocked=g.mode!=='won';g.enemies.filter(e=>e.zone===3).forEach(e=>e.hp=0);g.interact();return{blocked,cleared:g.mode==='won'};});
 assert(result.exit.blocked&&result.exit.cleared);
 assert.deepEqual(errors,[]);
 await fs.writeFile('docs/organ-chapter-verification.json',JSON.stringify({result,errors,method:'Staged runtime views, real prop damage and keyboard gate interaction; exit prerequisites staged, not a complete combat playthrough.'},null,2));console.log(result);
}finally{await browser.close();}
