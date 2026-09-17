import type {Vector3} from 'three';
import type {Wall} from './combat';

/** Immutable active-wall snapshots are shared by the entire fixed step. Gates
 * produce a new snapshot, naturally replacing this weakly held acceleration data. */
class WallGrid {
 readonly length:number;
 private cells=new Map<string,number[]>();
 private queries=new Map<string,Wall[]>();
 constructor(private walls:Wall[],private size=8){
  this.length=walls.length;
  walls.forEach((wall,index)=>{
   for(let x=Math.floor(Math.min(wall.a.x,wall.b.x)/size);x<=Math.floor(Math.max(wall.a.x,wall.b.x)/size);x++)
    for(let z=Math.floor(Math.min(wall.a.z,wall.b.z)/size);z<=Math.floor(Math.max(wall.a.z,wall.b.z)/size);z++){
     const key=`${x},${z}`,cell=this.cells.get(key);if(cell)cell.push(index);else this.cells.set(key,[index]);
    }
  });
 }
 query(a:Vector3,b:Vector3,padding:number){
  const x0=Math.floor((Math.min(a.x,b.x)-padding)/this.size),x1=Math.floor((Math.max(a.x,b.x)+padding)/this.size);
  const z0=Math.floor((Math.min(a.z,b.z)-padding)/this.size),z1=Math.floor((Math.max(a.z,b.z)+padding)/this.size);
  const key=`${x0},${x1},${z0},${z1}`,cached=this.queries.get(key);if(cached)return cached;
  const indices=new Set<number>();
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const index of this.cells.get(`${x},${z}`)??[])indices.add(index);
  // Sequential penetration correction depends on wall ordering.
  const result=[...indices].sort((a,b)=>a-b).map(index=>this.walls[index]);
  if(this.queries.size>=256)this.queries.clear();this.queries.set(key,result);return result;
 }
}
const grids=new WeakMap<Wall[],WallGrid>();
export function nearbyWalls(walls:Wall[],from:Vector3,to:Vector3,padding=0):Wall[]{
 if(walls.length<12)return walls;
 let grid=grids.get(walls);if(!grid||grid.length!==walls.length){grid=new WallGrid(walls);grids.set(walls,grid);}
 return grid.query(from,to,padding);
}
