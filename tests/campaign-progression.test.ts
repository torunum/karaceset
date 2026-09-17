import {it,expect} from 'vitest';
import {ChapterState,CAMPAIGN_KEYS} from '../src/chapter-state';
import {Level,Navigator} from '../src/level';
import {CORPSE_MOUNDS} from '../src/organic-layout';
import {Vector3} from 'three';
it('requires two different public-route seals without consuming them at doors',()=>{
 const state=new ChapterState();expect(state.canOpenGate()).toBe(false);
 expect(state.collectKey('marrow')).toBe(true);expect(state.collectKey('marrow')).toBe(false);
 expect(state.canOpenGate()).toBe(true);expect(state.canExit(true,[{zone:3,hp:0}])).toBe(false);
 state.collectKey('bile');expect(state.canExit(true,[{zone:3,hp:0}])).toBe(true);
 expect(state.canExit(true,[{zone:3,hp:1}])).toBe(false);
 state.reset();expect(state.canOpenGate()).toBe(false);expect(state.keys.size).toBe(0);
});
it('armor spends only the amount it absorbs and resets with the run',()=>{
 const state=new ChapterState();state.grantArmor(100);expect(state.incoming(30)).toBe(20);expect(state.armor).toBe(90);
 state.armor=2;expect(state.incoming(30)).toBe(28);expect(state.armor).toBe(0);
 state.grantArmor(200);expect(state.incoming(30)).toBe(15);
 state.reset();expect(state.armor).toBe(0);
});
it('a smaller armor pickup preserves active stronger protection but depleted armor resets its type',()=>{
 const state=new ChapterState();state.grantArmor(200);state.incoming(30);
 state.grantArmor(100);expect(state.armor).toBe(185);expect(state.incoming(30)).toBe(15);
 state.incoming(1000);expect(state.armor).toBe(0);
 state.grantArmor(100);expect(state.incoming(30)).toBe(20);
});
it('both public seals are accessible before any doors open and the opened membrane connects the exit',()=>{
 const level=new Level(),nav=new Navigator(level),entrance=new Vector3(0,1,6);
 expect(level.gateOpen).toBe(false);expect(level.secretOpen.size).toBe(0);
 nav.refresh(entrance);
 for(const key of CAMPAIGN_KEYS){
  expect(level.contains(key.x,key.z,.65),`${key.kind} active-wall clearance`).toBe(true);
  expect(nav.direction(new Vector3(key.x,1,key.z)).length(),`${key.kind} entrance route`).toBeGreaterThan(0);
  for(const prop of level.scenery.props)expect(Math.hypot(key.x-prop.position.x,key.z-prop.position.z),`${key.kind} prop clearance`).toBeGreaterThan(prop.radius+.34);
  for(const mound of CORPSE_MOUNDS)expect(Math.hypot(key.x-mound.x,key.z-mound.z),`${key.kind} mound clearance`).toBeGreaterThan(mound.radius+.34);
 }
 nav.refresh(level.exitPosition);expect(nav.direction(entrance).length()).toBe(0);
 level.gateOpen=true;nav.refresh(level.exitPosition);
 expect(nav.direction(entrance).length()).toBeGreaterThan(0);
 for(const key of CAMPAIGN_KEYS)expect(nav.direction(new Vector3(key.x,1,key.z)).length()).toBeGreaterThan(0);
 expect(level.secretOpen.size).toBe(0);
});
