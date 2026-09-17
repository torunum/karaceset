import { beforeAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Level, Navigator } from '../src/level';
import { ORGAN_PATHS, ORGAN_ROOMS } from '../src/organic-layout';

describe('organic campaign layout', () => {
  let level: Level;
  let nav: Navigator;
  // Surface and prop construction is intentionally shared by these geometry checks.
  beforeAll(() => {
    level = new Level();
    nav = new Navigator(level);
  });

  it('places every encounter, pickup, and breakable on reachable floor with clearance', () => {
    level.gateOpen = true;
    nav.refresh(level.exitPosition);
    const placements = [
      ...level.spawns.map(p => ({ ...p, clearance: 0.65, label: `enemy ${p.kind}` })),
      ...level.pickups.map(p => ({ ...p, clearance: 0.34, label: `pickup ${p.kind}` })),
      ...level.scenery.props.map(p => ({ x: p.position.x, z: p.position.z, clearance: p.radius, label: `prop ${p.propKind}` })),
    ];
    expect(placements.length).toBeGreaterThan(40);
    for (const p of placements) {
      const label = `${p.label} at ${p.x},${p.z}`;
      expect(level.contains(p.x, p.z, p.clearance), `${label} wall clearance`).toBe(true);
      expect(nav.direction(new Vector3(p.x, 1, p.z)).length(), `${label} exit route`).toBeGreaterThan(0);
    }
  });

  it('keeps both pre-gate side loops traversable along their full bends', () => {
    level.gateOpen = false;
    nav.refresh(level.buttonPosition);
    const loops = ORGAN_PATHS.filter(path => path.points.some(([x]) => x < -10 || x > 18)
      && path.points.every(([, z]) => z > -66));
    expect(loops).toHaveLength(2);
    for (const path of loops) {
      for (let i = 1; i < path.points.length; i++) {
        const [ax, az] = path.points[i - 1], [bx, bz] = path.points[i];
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3);
        for (let step = 0; step <= steps; step++) {
          const t = step / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          expect(level.contains(x, z, 0.65), `loop clearance at ${x},${z}`).toBe(true);
        }
      }
      for (const [x, z] of path.points) {
        expect(nav.direction(new Vector3(x, 1, z)).length(), `loop navigation at ${x},${z}`).toBeGreaterThan(0);
      }
    }
  });

  it('prevents either branch or the rear secret loop from bypassing the closed membrane', () => {
    level.gateOpen = false;
    nav.refresh(level.exitPosition);
    for (const [x, z] of [[0, 6], [4, -35], [-17, -39], [22, -42], [6, -58]]) {
      expect(nav.direction(new Vector3(x, 1, z)).length(), `closed gate at ${x},${z}`).toBe(0);
    }
    // The rear loop itself is connected to the exit, but not the pre-gate side.
    expect(nav.direction(new Vector3(-13, 1, -80)).length()).toBeGreaterThan(0);
    level.gateOpen = true;
    nav.refresh(level.exitPosition);
    for (const [x, z] of [[0, 6], [-17, -39], [22, -42], [6, -58]]) {
      expect(nav.direction(new Vector3(x, 1, z)).length(), `open gate at ${x},${z}`).toBeGreaterThan(0);
    }
  });

  it('has eight usable chambers across a medium-sized floor plan', () => {
    level.gateOpen = true;
    expect(ORGAN_ROOMS).toHaveLength(8);
    const points = level.polygons.flat(2);
    const width = Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]));
    const depth = Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]));
    expect(width).toBeGreaterThan(45);
    expect(width).toBeLessThan(80);
    expect(depth).toBeGreaterThan(105);
    expect(depth).toBeLessThan(150);
    for (const [x, z] of ORGAN_ROOMS) {
      expect(level.contains(x, z, 1), `chamber at ${x},${z}`).toBe(true);
    }
    expect(level.contains(level.buttonPosition.x, level.buttonPosition.z, 0.34)).toBe(true);
    expect(level.contains(level.exitPosition.x, level.exitPosition.z, 0.34)).toBe(true);
  });
});
