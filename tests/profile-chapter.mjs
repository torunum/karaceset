import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}});
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__game?.assetsReady,{},{timeout:120000});
 const result=await page.evaluate(async()=>{
  const g=window.__game;g.mode='paused';g.onChange=()=>{};g.position.set(4,1.65,-29);
  const r=g.renderer,render=r.render.bind(r),frames=[];r.info.autoReset=false;
  let stats=null;
  r.render=(scene,camera)=>{if(scene===g.scene){r.info.reset();stats={at:performance.now()};}render(scene,camera);if(scene===g.weaponScene&&stats){stats.calls=r.info.render.calls;stats.triangles=r.info.render.triangles;stats.cpu=performance.now()-stats.at;frames.push(stats);}};
  await new Promise(resolve=>{const poll=()=>frames.length>=30?resolve():requestAnimationFrame(poll);poll();});
  r.render=render;r.info.autoReset=true;
  const last=frames.slice(5),intervals=last.slice(1).map((s,i)=>s.at-last[i].at).sort((a,b)=>a-b);
  let points=0,meshes=0;g.scene.traverseVisible(o=>{if(o.isPointLight)points++;if(o.isMesh)meshes++;});
  return{viewport:[1100,760],backend:r.getContext().getParameter(r.getContext().RENDERER),frames:last.length,medianFrameMs:intervals[Math.floor(intervals.length/2)],medianRenderCpuMs:last.map(s=>s.cpu).sort((a,b)=>a-b)[12],calls:last.at(-1).calls,triangles:last.at(-1).triangles,points,meshes,memory:r.info.memory};
 });
 await fs.writeFile(`docs/performance-${process.argv[2]||'sample'}.json`,JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
