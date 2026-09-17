import {Vector3} from 'three';
export type PowerKind='wrath'|'ward';
export type CampaignKey='marrow'|'bile';
export type SecretReward=PowerKind|'armor'|'overhealth';
export const CAMPAIGN_KEYS=[{kind:'marrow' as CampaignKey,x:-17,z:-40,name:'İLİK MÜHRÜ'},{kind:'bile' as CampaignKey,x:22,z:-42,name:'SAFRA MÜHRÜ'}];
export const SECRET_PASSAGES=[
 {id:'marrow-cache',x:-6.4,z:3,half:1.3,rewardX:-10,kind:'ward' as PowerKind},
 {id:'blood-vault',x:-22.8,z:-39,half:1.3,rewardX:-26.5,kind:'wrath' as PowerKind},
 {id:'bile-reliquary',x:28.95,z:-42,half:1.3,rewardX:33,kind:'armor' as SecretReward},
 {id:'last-seed',x:2.1,z:-104,half:1.3,rewardX:-1.8,kind:'overhealth' as SecretReward},
] as const;
export class ChapterState {
 open=new Set<string>();found=new Set<string>();events=new Set<string>();
 keys=new Set<CampaignKey>();armor=0;private armorFraction=1/3;
 wrath=0;ward=0;
 reset(){this.open.clear();this.found.clear();this.events.clear();this.keys.clear();this.armor=0;this.armorFraction=1/3;this.wrath=this.ward=0;}
 collectKey(key:CampaignKey){if(this.keys.has(key))return false;this.keys.add(key);return true;}
 canOpenGate(){return this.keys.has('marrow');}
 grantArmor(points:100|200){const fraction=points===200?.5:1/3;this.armorFraction=this.armor>0?Math.max(this.armorFraction,fraction):fraction;this.armor=Math.max(this.armor,points);}
 grant(kind:PowerKind){this[kind]=kind==='wrath'?18:24;}
 step(dt:number){this.wrath=Math.max(0,this.wrath-dt);this.ward=Math.max(0,this.ward-dt);}
 outgoing(damage:number){return damage*(this.wrath>0?2:1);}
 incoming(damage:number){const incoming=damage*(this.ward>0?.4:1),absorbed=Math.min(this.armor,incoming*this.armorFraction);this.armor-=absorbed;return incoming-absorbed;}
 nearby(position:Vector3,forward:Vector3){
  return SECRET_PASSAGES.find(s=>{
   if(this.open.has(s.id))return false;
   const dx=s.x-position.x,dz=s.z-position.z,d=Math.hypot(dx,dz);
   return d<2.3&&d>.05&&(dx*forward.x+dz*forward.z)/d>.65;
  });
 }
 tryOpen(position:Vector3,forward:Vector3){const s=this.nearby(position,forward);if(!s)return null;this.open.add(s.id);return s.id;}
 discover(position:Vector3){
  const entered:string[]=[];
  for(const s of SECRET_PASSAGES)if(this.open.has(s.id)&&!this.found.has(s.id)&&Math.hypot(position.x-s.rewardX,position.z-s.z)<2.1){this.found.add(s.id);entered.push(s.id);}
  return entered;
 }
 enter(z:number,gate:boolean){
  const entered:string[]=[];
  for(const [id,active] of [['awakening',z<-7],['stomach',z<-28],['heart',gate&&z<-75]] as const)
   if(active&&!this.events.has(id)){this.events.add(id);entered.push(id);}
  return entered;
 }
 canExit(gate:boolean,enemies:{zone:number;hp:number}[]){return gate&&this.keys.has('bile')&&enemies.every(e=>e.zone!==3||e.hp<=0);}
}
