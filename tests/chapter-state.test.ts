import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {ChapterState,SECRET_PASSAGES} from '../src/chapter-state';
describe('living chapter progression',()=>{
 it('opens secrets by facing their clue and counts entry only once',()=>{
  const c=new ChapterState(),s=SECRET_PASSAGES[0];
  const p=new Vector3(s.x+1.4,1.65,s.z);
  expect(c.tryOpen(p,new Vector3(1,0,0))).toBeNull();
  expect(c.tryOpen(p,new Vector3(-1,0,0))).toBe(s.id);
  expect(c.discover(p)).toEqual([]);
  expect(c.discover(new Vector3(s.rewardX,1.65,s.z))).toEqual([s.id]);
  expect(c.discover(new Vector3(s.rewardX,1.65,s.z))).toEqual([]);
  c.reset();expect(c.open.size).toBe(0);expect(c.found.size).toBe(0);
 });
 it('powerups change combat only while their timers are active',()=>{
  const c=new ChapterState();c.grant('wrath');c.grant('ward');
  expect(c.outgoing(20)).toBe(40);expect(c.incoming(20)).toBe(8);
  c.step(19);expect(c.outgoing(20)).toBe(20);expect(c.incoming(20)).toBe(8);
  c.step(6);expect(c.incoming(20)).toBe(20);
  c.grant('wrath');c.reset();expect(c.outgoing(20)).toBe(20);
 });
 it('encounters trigger once in order and exit requires the final arena only',()=>{
  const c=new ChapterState();expect(c.enter(-8,false)).toEqual(['awakening']);
  c.collectKey('bile');
  expect(c.enter(-8,false)).toEqual([]);
  expect(c.enter(-30,false)).toEqual(['stomach']);
  expect(c.enter(-77,true)).toEqual(['heart']);
  expect(c.canExit(true,[{zone:1,hp:40},{zone:3,hp:0}])).toBe(true);
  expect(c.canExit(true,[{zone:3,hp:40}])).toBe(false);
  expect(c.canExit(false,[{zone:3,hp:0}])).toBe(false);
 });
});
