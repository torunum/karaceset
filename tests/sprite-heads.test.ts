import { describe, expect, it } from "vitest";
import { headContour, containsHead, headBounds } from "../src/sprite-heads";

describe("painted enemy head contours", () => {
  it("keeps forward gait cleavers and collars outside each new head contour", () => {
    for(let frame=0;frame<4;frame++) {
      const cx=frame%2===0?326:289, contour=headContour("executioner-walk",frame);
      expect(containsHead(contour,cx/627,1-65/627)).toBe(true);
      expect(containsHead(contour,cx/627,1-140/627)).toBe(false);
      expect(containsHead(contour,(cx-150)/627,1-350/627)).toBe(false);
    }
  });
  it("keeps the cultist gun out of the head cut in aim, recoil and corpse poses", () => {
    for (const [frame, x, y] of [
      [4, 244, 109],
      [5, 214, 101],
      [7, 160, 399],
    ]) {
      expect(
        containsHead(
          headContour("cult-enforcer", frame),
          x / 443.5,
          1 - y / 443.5,
        ),
      ).toBe(false);
    }
  });
  it("follows all eight head positions instead of the standing rectangle", () => {
    const cult = [
      [239, 76],
      [203, 76],
      [153, 76],
      [151, 76],
      [232, 62],
      [181, 62],
      [238, 66],
      [43, 343],
    ];
    const executioner = [
      [233, 38],
      [244, 39],
      [282, 38],
      [272, 38],
      [225, 101],
      [290, 116],
      [184, 65],
      [40, 354],
    ];
    for (const [name, points] of [
      ["cult-enforcer", cult],
      ["executioner", executioner],
    ] as const) {
      points.forEach(([x, y], frame) =>
        expect(
          containsHead(headContour(name, frame), x / 443.5, 1 - y / 443.5),
        ).toBe(true),
      );
    }
  });
  it("preserves the raised cleaver and its hand in the executioner windup", () => {
    const contour = headContour("executioner", 4);
    for (const [x, y] of [
      [175, 12],
      [245, 32],
      [148, 70],
    ])
      expect(containsHead(contour, x / 443.5, 1 - y / 443.5)).toBe(false);
  });
  it("canonical detached heads have tight bounds above the weapon and shoulders", () => {
    for (const name of ["cult-enforcer", "executioner"]) {
      const bounds = headBounds(headContour(name, 0));
      expect(bounds[2] - bounds[0]).toBeLessThan(0.22);
      expect(bounds[1]).toBeGreaterThan(0.7);
    }
  });
});
