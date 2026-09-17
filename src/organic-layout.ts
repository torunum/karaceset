import type {Spawn,PickupSpec} from './level';
import type {Breakable} from './scenery';

/** Material districts follow the established loops, not individual screen views. */
export function organicWallRole(x:number,z:number):'intestine'|'ribWall'|'boneWall'{
 if((x < -9&&z < -25&&z > -65)||(z < -67&&z > -76)||z < -97)return 'ribWall';
 if(z > -29||(z > -48&&x > -9)||(x > 15&&z > -60))return 'intestine';
 return 'boneWall';
}
export const CORPSE_MOUNDS=[
 {x:3.5,z:6.5,radius:.8,width:2.5},
 {x:-3,z:-39,radius:1,width:3},
 {x:-20,z:-43.2,radius:.85,width:2.7},
 {x:20,z:-41.5,radius:.8,width:2.5},
 {x:16,z:-85,radius:.9,width:2.9},
 {x:-4,z:-86,radius:.9,width:2.9},
];

/** Metres. Rooms are connected by two pre-gate loops and one optional rear loop. */
export const ORGAN_ROOMS = [
 [0,3,6.5,7.5], [4,-35,11,10], [-17,-39,6,7], [22,-42,7,9],
 [6,-58,6,5], [6,-84,13,11], [-13,-80,5,5], [6,-103,4,4],
] as const;
export const ORGAN_PATHS: {points:number[][];width:number}[] = [
 {points:[[0,-3],[-3,-12],[1,-22],[4,-28]],width:3},
 {points:[[-5,-35],[-13,-32],[-17,-39],[-17,-45],[-10,-52],[3,-56]],width:2.7},
 {points:[[13,-35],[22,-32],[25,-40],[22,-50],[12,-57]],width:2.8},
 {points:[[4,-43],[3,-49],[6,-55]],width:3},
 {points:[[6,-60],[6,-70],[6,-76]],width:2.8},
 {points:[[-5,-83],[-13,-80],[-13,-72],[-3,-72],[6,-77]],width:2.5},
 {points:[[6,-92],[6,-103]],width:3},
];
export const ORGAN_ROUTE = [[0,6],[-3,-12],[1,-22],[4,-35],[-13,-32],[-17,-39],[-10,-52],[6,-58],[22,-32],[22,-42],[22,-50],[6,-70],[6,-84],[-13,-80],[-13,-72],[6,-103]];
export const ORGAN_PROPS: [Breakable['propKind'],number,number][] = [
 ['crate',-3,5],['urn',4,1],['barrel',-3,-30],['crate',10,-32],['urn',10,-40],
 ['barrel',-19,-36],['crate',-14,-42],['urn',-19,-42],
 ['barrel',25,-37],['crate',19,-43],['urn',25,-46],['barrel',9,-58],
 ['crate',0,-80],['barrel',13,-80],['barrel',11,-88],['urn',-2,-89],
 ['crate',-15,-80],['urn',-12,-77],['urn',8,-102],['crate',3,-103],
];
export function organSpawns():Spawn[] {
 const packs:[number,number[][]][]=[
  [0,[[-2,-18],[2,-25]]],
  [1,[[-1,-31],[8,-31],[-2,-37],[8,-39],[3,-42],[-17,-36],[-20,-40],[-15,-43]]],
  [2,[[20,-36],[25,-41],[19,-46],[24,-48],[4,-54],[8,-58]]],
  [3,[[3,-77],[11,-77],[-2,-82],[14,-82],[3,-85],[9,-86],[-2,-89],[13,-90],[6,-92],[-13,-78],[-15,-81],[-11,-82],[5,-99],[8,-103]]],
 ];
 return packs.flatMap(([zone,points])=>points.map(([x,z],i)=>({x,z,zone:zone===3&&x < -10?4:zone,kind:zone===0&&i===0?'shambler':i%3===0?'cultist':'shambler'})));
}
export function organPickups():PickupSpec[] {
 return [[-2,2],[3,-24],[-3,-33],[10,-37],[-19,-38],[-14,-43],[23,-36],[26,-43],[21,-48],[5,-57],[10,-58],[3,-74],[-2,-80],[13,-84],[2,-89],[10,-91],[-14,-81],[5,-100]].map(([x,z],i)=>({x,z,kind:i%3===2?'health':'ammo',secret:x < -10&&z < -65}));
}
