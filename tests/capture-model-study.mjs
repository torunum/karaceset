import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await page.goto('http://127.0.0.1:5173/?chapel=1');await page.waitForFunction(()=>window.__game?.assetsReady);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const g=window.__game;
  g.mode='paused';g.onChange=()=>{};for(const id of ['overlay','hud','top','vignette','damage'])document.getElementById(id).hidden=true;document.querySelector('.grain').hidden=true;
  g.level.root.visible=false;g.enemies.forEach(e=>{e.rig.root.visible=false;e.shadow.visible=false;});g.gun.root.visible=false;
  const e=g.enemies.find(e=>e.kind==='cultist');e.rig.root.visible=true;e.rig.root.position.set(0,0,0);e.rig.root.rotation.set(0,Math.PI,0);
  g.scene.fog=null;g.scene.background=new T.Color(0x24282b);g.scene.environmentIntensity=.35;g.keyLight.intensity=1.6;g.position.set(0,1.1,2.45);g.pitch=0;g.yaw=0;
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x343839,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;g.scene.add(floor);
 });
 for(const [name,angle]of [['front',Math.PI],['side',Math.PI/2],['back',0]]){await page.evaluate(angle=>window.__game.enemies.find(e=>e.kind==='cultist').rig.root.rotation.y=angle,angle);await page.screenshot({path:`docs/screenshots/cultist-study-${name}.png`});}
 await page.evaluate(async()=>{const {animateEnemy}=await import('/src/enemy-art.ts');const e=window.__game.enemies.find(e=>e.kind==='cultist');e.rig.root.rotation.y=Math.PI;for(let i=0;i<50;i++)animateEnemy(e.rig,'windup',i/60,0,'cultist');});
 await page.screenshot({path:'docs/screenshots/cultist-aim-front.png'});
 await page.evaluate(()=>window.__game.enemies.find(e=>e.kind==='cultist').rig.root.rotation.y=Math.PI/2);
 await page.screenshot({path:'docs/screenshots/cultist-aim-side.png'});
 await page.evaluate(()=>{const g=window.__game;g.enemies.forEach(e=>e.rig.root.visible=false);g.gun.root.visible=true;});await page.screenshot({path:'docs/screenshots/shotgun-study.png'});
}finally{await browser.close();}

