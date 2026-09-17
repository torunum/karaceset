import {it,expect} from 'vitest';
import * as T from 'three';
import {writeFileSync} from 'node:fs';
import {Level} from '../src/level';
import {createEnemy} from '../src/enemy-art';
import {CorpseRagdoll} from '../src/ragdoll';
import {GoreSystem} from '../src/gore';

it.skipIf(!process.env.PROFILE_GORE)('profiles 30 simultaneously dismembered corpses against the actual chapter walls',()=>{
 const level=new Level(),walls=level.activeWalls(),scene=new T.Scene(),gore=new GoreSystem(scene),bodies:CorpseRagdoll[]=[];
 let seed=42;const random=Math.random;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 try{
  for(let i=0;i<30;i++){
   const rig=createEnemy('shambler');rig.root.position.set((i%6-3)*1.3,0,-31-Math.floor(i/6)*1.3);scene.add(rig.root);
   gore.sever(rig,'head',new T.Vector3(1,0,-2));gore.sever(rig,'leftArm',new T.Vector3(-1,0,-2));
   bodies.push(new CorpseRagdoll(rig,new T.Vector3(1,0,-3)));
  }
  const corpseMs:number[]=[],goreMs:number[]=[];
  for(let i=0;i<35;i++){
   const start=performance.now();bodies.forEach(b=>b.update(1/60,walls));const middle=performance.now();gore.update(1/60,walls);const end=performance.now();
   if(i>=5){corpseMs.push(middle-start);goreMs.push(end-middle);}
  }
  const median=(a:number[])=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
  const result={scenario:'30 corpses, 60 sever calls, 28 retained gibs, 140 initial droplets; 35 fixed steps; 5 warmup discarded',walls:walls.length,corpses:bodies.length,retainedGibs:gore.particles.filter(p=>p.gib).length,medianCorpseMs:median(corpseMs),medianGoreMs:median(goreMs),medianCombinedMs:median(corpseMs.map((t,i)=>t+goreMs[i])),maxCombinedMs:Math.max(...corpseMs.map((t,i)=>t+goreMs[i]))};
  writeFileSync(`docs/gore-cpu-${process.env.PROFILE_GORE}.json`,JSON.stringify(result,null,2));console.log(result);
  expect(bodies).toHaveLength(30);
 }finally{Math.random=random;}
},120000);
