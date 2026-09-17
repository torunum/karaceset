import { describe, expect, it } from "vitest";
import type { EnemyState } from "../src/combat";
import { ENEMIES } from "../src/enemy-types";
import {
  enemySpriteFrame,
  enemySpriteDirection,
  executionerSpriteFrame,
  executionerWalkCell,
  type EnemySpritePose,
} from "../src/enemy-sprite-motion";

const pose = (overrides: Partial<EnemySpritePose> = {}): EnemySpritePose => ({
  state: "chase",
  moving: false,
  time: 0,
  enteredAt: 0,
  ...overrides,
});

describe("executioner melee atlas", () => {
  it("uses four forward locomotion cells only during actual chase movement", () => {
    expect(Array.from({length: 5}, (_,i) => executionerWalkCell(pose({moving:true,time:i*.1})))).toEqual([0,1,2,3,0]);
    expect(executionerWalkCell(pose())).toBeNull();
    for(const state of ["idle","windup","hurt","dead","pinned"] as const)
      expect(executionerWalkCell(pose({state,moving:true}))).toBeNull();
    expect(executionerWalkCell(pose({moving:true,time:NaN}))).toBe(0);
  });
  it("holds the raised cleaver until the final tenth of the windup", () => {
    expect(executionerSpriteFrame(pose({ state: "windup" }), 0.3)).toBe(4);
    expect(executionerSpriteFrame(pose({ state: "windup" }), 0.1)).toBe(5);
    expect(executionerSpriteFrame(pose({ state: "windup" }), 0.01)).toBe(5);
    expect(executionerSpriteFrame(pose({ state: "windup" }), NaN)).toBe(4);
  });
  it("interrupts the slash on injury/death and never borrows gun release cues", () => {
    expect(executionerSpriteFrame(pose({ state: "hurt" }), 0.01)).toBe(6);
    expect(executionerSpriteFrame(pose({ state: "dead" }), 0.01)).toBe(7);
    expect(executionerSpriteFrame(pose({ firedAt: 0, time: 0.01 }))).toBe(0);
  });
});

describe("cult enforcer directional atlas", () => {
  it("maps front, image-right profile, back and image-left profile correctly", () => {
    expect(enemySpriteDirection(0, 0)).toBe(0);
    expect(enemySpriteDirection(0, -Math.PI / 2)).toBe(2);
    expect(enemySpriteDirection(0, Math.PI)).toBe(4);
    expect(enemySpriteDirection(0, Math.PI / 2)).toBe(6);
    for (let cell = 0; cell < 8; cell++)
      expect(enemySpriteDirection(0, (-cell * Math.PI) / 4)).toBe(cell);
  });

  it("keeps view selection relative to actor yaw and invariant under full turns", () => {
    for (let cell = 0; cell < 8; cell++)
      for (const actorYaw of [-2.6, 0, 1.3])
        for (const actorTurns of [-4, 0, 3])
          for (const cameraTurns of [-3, 0, 4])
            expect(
              enemySpriteDirection(
                actorYaw + actorTurns * Math.PI * 2,
                actorYaw - (cell * Math.PI) / 4 + cameraTurns * Math.PI * 2,
              ),
            ).toBe(cell);
    expect(enemySpriteDirection(Math.PI - 0.01, -Math.PI + 0.01)).toBe(0);
    expect(enemySpriteDirection(-Math.PI + 0.01, Math.PI - 0.01)).toBe(0);
  });

  it("chooses the nearest sector around angular boundaries", () => {
    const halfSector = Math.PI / 8;
    expect(enemySpriteDirection(0, -halfSector + 0.0001)).toBe(0);
    expect(enemySpriteDirection(0, -halfSector - 0.0001)).toBe(1);
    expect(enemySpriteDirection(0, halfSector - 0.0001)).toBe(0);
    expect(enemySpriteDirection(0, halfSector + 0.0001)).toBe(7);
  });

  it("returns a finite direction for invalid and extreme angles", () => {
    for (const angle of [NaN, Infinity, -Infinity]) {
      expect(enemySpriteDirection(angle, 0)).toBe(0);
      expect(enemySpriteDirection(0, angle)).toBe(0);
    }
    for (const actorYaw of [-Number.MAX_VALUE, 0, Number.MAX_VALUE])
      for (const cameraBearing of [-Number.MAX_VALUE, 0, Number.MAX_VALUE]) {
        const cell = enemySpriteDirection(actorYaw, cameraBearing);
        expect(Number.isInteger(cell)).toBe(true);
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(8);
      }
  });
});

describe("cult enforcer sprite timeline", () => {
  it("plays the alternating 1,2,3,2 walk at ten frames per second", () => {
    const frames = Array.from({ length: 9 }, (_, i) =>
      enemySpriteFrame(pose({ moving: true, enteredAt: 3, time: 3 + i * 0.1 })),
    );
    expect(frames).toEqual([1, 2, 3, 2, 1, 2, 3, 2, 1]);
    expect(enemySpriteFrame(pose({ moving: true, time: 0.099 }))).toBe(1);
    expect(enemySpriteFrame(pose({ moving: false, time: 0.2 }))).toBe(0);
    expect(enemySpriteFrame(pose({ state: "idle", moving: true }))).toBe(0);
  });

  it("aims for the complete gameplay windup and recoils only after recorded release", () => {
    const release = 10 + ENEMIES.cultist.windup;
    for (const time of [10, 10.2, release - 0.001, release])
      expect(
        enemySpriteFrame(pose({ state: "windup", enteredAt: 10, time })),
      ).toBe(4);
    for (const age of [0, 0.04, 0.099])
      expect(
        enemySpriteFrame(
          pose({ enteredAt: release, time: release + age, firedAt: release }),
        ),
      ).toBe(5);
    expect(
      enemySpriteFrame(
        pose({ enteredAt: release, time: release + 0.1, firedAt: release }),
      ),
    ).toBe(0);
    expect(
      enemySpriteFrame(
        pose({
          moving: true,
          enteredAt: release,
          time: release + 0.1,
          firedAt: release,
        }),
      ),
    ).toBe(2);
    expect(
      enemySpriteFrame(
        pose({ enteredAt: release, time: release + 0.9, firedAt: release }),
      ),
    ).toBe(0);
  });

  it("does not invent a shot when windup is interrupted or line of sight is lost", () => {
    const interrupted = [
      pose({ state: "windup", enteredAt: 2, time: 2.1 }),
      pose({ state: "hurt", enteredAt: 2.12, time: 2.12 }),
      pose({ state: "chase", enteredAt: 2.3, time: 2.31 }),
    ];
    expect(interrupted.map(enemySpriteFrame)).toEqual([4, 6, 0]);
    // Completed windup can still end without a release (occlusion/disarming).
    expect(
      enemySpriteFrame(
        pose({
          enteredAt: ENEMIES.cultist.windup,
          time: ENEMIES.cultist.windup + 0.01,
        }),
      ),
    ).toBe(0);
    // Even a very quick recovery must not resurrect the previous recoil cue.
    expect(
      enemySpriteFrame(pose({ enteredAt: 1.04, time: 1.05, firedAt: 1 })),
    ).toBe(0);
  });

  it("keeps hurt/pinned/death poses above recoil and death stable over time", () => {
    for (const state of ["hurt", "pinning", "pinned"] as const)
      expect(
        enemySpriteFrame(pose({ state, moving: true, time: 0.01, firedAt: 0 })),
      ).toBe(6);
    for (const time of [0, 0.05, 10, 1000])
      expect(
        enemySpriteFrame(
          pose({ state: "dead", moving: true, time, firedAt: 0 }),
        ),
      ).toBe(7);
    expect(
      enemySpriteFrame(pose({ state: "windup", time: 0.01, firedAt: 0 })),
    ).toBe(4);
  });

  it("returns finite atlas cells for invalid, future, reset and extreme clocks", () => {
    const states: EnemyState[] = [
      "idle",
      "chase",
      "windup",
      "hurt",
      "dead",
      "pinning",
      "pinned",
    ];
    for (const state of states)
      for (const time of [
        NaN,
        Infinity,
        -Infinity,
        -1,
        0,
        0.3,
        Number.MAX_VALUE,
      ])
        for (const enteredAt of [0, NaN, Infinity, -Number.MAX_VALUE]) {
          const frame = enemySpriteFrame(
            pose({ state, moving: true, time, enteredAt, firedAt: 0 }),
          );
          expect(Number.isInteger(frame)).toBe(true);
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(frame).toBeLessThan(8);
        }
    expect(enemySpriteFrame(pose({ time: 0, firedAt: 1 }))).toBe(0);
    expect(enemySpriteFrame(pose({ time: 0, firedAt: NaN }))).toBe(0);
    expect(
      enemySpriteFrame(pose({ moving: true, time: 0, enteredAt: 3 })),
    ).toBe(1);
  });
});
