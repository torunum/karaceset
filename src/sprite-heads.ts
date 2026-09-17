/** Hand-authored head silhouettes, measured in the delivered 443.5px cells.
 * Unlike a rectangular atlas crop these stop at the jaw and exclude foreground
 * guns, raised cleavers, hands and the cloth pooled beside a fallen head. */
export type HeadContour = readonly (readonly [number, number])[];
const uv = (points: number[][]): HeadContour =>
  points.map(([x, y]) => [x / 443.5, 1 - y / 443.5]);
const cult = [
  [
    [238, 20],
    [264, 31],
    [278, 62],
    [272, 99],
    [258, 125],
    [220, 123],
    [196, 103],
    [209, 45],
  ],
  [
    [202, 20],
    [228, 31],
    [242, 62],
    [236, 99],
    [222, 125],
    [184, 123],
    [160, 103],
    [173, 45],
  ],
  [
    [152, 20],
    [178, 31],
    [192, 62],
    [186, 99],
    [172, 125],
    [134, 123],
    [110, 103],
    [123, 45],
  ],
  [
    [150, 20],
    [176, 31],
    [190, 62],
    [184, 99],
    [170, 125],
    [132, 123],
    [108, 103],
    [121, 45],
  ],
  [
    [232, 12],
    [257, 25],
    [269, 53],
    [261, 80],
    [244, 90],
    [218, 91],
    [197, 77],
    [207, 36],
  ],
  [
    [181, 11],
    [205, 23],
    [219, 50],
    [210, 74],
    [194, 82],
    [168, 85],
    [146, 71],
    [153, 31],
  ],
  [
    [241, 22],
    [260, 35],
    [267, 59],
    [255, 90],
    [235, 110],
    [208, 100],
    [190, 79],
    [207, 42],
  ],
  [
    [24, 309],
    [52, 305],
    [78, 317],
    [88, 341],
    [79, 358],
    [50, 368],
    [18, 360],
    [1, 337],
  ],
].map(uv);
const executioner = [
  [
    [228, 0],
    [246, 10],
    [258, 32],
    [253, 60],
    [245, 79],
    [219, 77],
    [207, 55],
    [210, 22],
  ],
  [
    [239, 0],
    [257, 12],
    [267, 34],
    [261, 59],
    [246, 78],
    [224, 66],
    [214, 44],
    [220, 17],
  ],
  [
    [279, 0],
    [298, 12],
    [306, 34],
    [300, 60],
    [286, 79],
    [264, 67],
    [252, 44],
    [259, 18],
  ],
  [
    [270, 0],
    [287, 13],
    [298, 35],
    [290, 62],
    [278, 80],
    [254, 66],
    [243, 44],
    [250, 18],
  ],
  [
    [215, 62],
    [234, 66],
    [248, 84],
    [249, 104],
    [238, 122],
    [218, 131],
    [199, 111],
    [192, 88],
  ],
  [
    [283, 79],
    [301, 87],
    [311, 110],
    [303, 134],
    [286, 149],
    [263, 141],
    [255, 117],
    [264, 94],
  ],
  [
    [185, 29],
    [204, 40],
    [219, 60],
    [213, 81],
    [197, 91],
    [173, 85],
    [157, 63],
    [163, 43],
  ],
  [
    [30, 326],
    [52, 325],
    [69, 337],
    [72, 355],
    [60, 373],
    [34, 383],
    [14, 375],
    [7, 352],
  ],
].map(uv);

export function headContour(profile: string, frame: number): HeadContour {
  if (profile === "executioner-walk") return executionerWalk[Math.max(0,Math.min(3,Math.floor(frame)))];
  return (profile === "executioner" ? executioner : cult)[
    Math.max(0, Math.min(7, Math.floor(frame)))
  ];
}
// Forward gait supplement has 627px cells. Exclude collar/apron and cleaver.
const executionerWalk: HeadContour[] = [
  [326,9,20,111], [289,9,20,111], [326,2,18,117], [289,2,18,117],
].map(([cx,top,shoulder,jaw]) => [
  [cx-7,top],[cx+7,top],[cx+32,top+shoulder], [cx+32,jaw-27],
  [cx+20,jaw],[cx-20,jaw],[cx-32,jaw-27],[cx-32,top+shoulder],
].map(([x,y]) => [x/627,1-y/627] as const));
export function headBounds(
  points: HeadContour,
): [number, number, number, number] {
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
export function containsHead(points: HeadContour, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
/** Same point-in-polygon operation for body removal and detached-head alpha. */
export const headMaskGLSL = `
uniform vec2 spriteHead[8];
bool insideSpriteHead(vec2 p) {
  bool inside=false;
  for(int i=0;i<8;i++) {
    vec2 a=spriteHead[i]; vec2 b=spriteHead[(i+7)%8];
    if((a.y>p.y)!=(b.y>p.y)) {
      if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
    }
  }
  return inside;
}`;
