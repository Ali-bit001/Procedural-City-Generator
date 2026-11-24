/**
 * Cars in several body types. Local frame like every prop: origin on the ground, nose towards -z.
 * All types fit the old 1.9 x 4.5 m footprint so parking layouts stay valid.
 *   0 sedan · 1 hatchback · 2 SUV · 3 jeep · 4 pickup · 5 EV · 6 minicar · 7 van · 8 auto-rickshaw · 9 sports coupe
 * When a prop doesn't name a type (p.n), one is picked from its position, so every existing car park varies.
 */
import * as THREE from 'three';
import { LocalFrame, SHAPES, col } from './MeshBuilder';
import type { Prop } from '../spec';

const DARK = col('#1e1f22');
const GLASS = col('#1c2733');
const HEAD = col('#f4f1e0');
const TAIL = col('#a01818');
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export const CAR_TYPES = ['sedan', 'hatchback', 'suv', 'jeep', 'pickup', 'ev', 'minicar', 'van', 'rickshaw', 'sports'] as const;
const WEIGHTS: [number, number][] = [[0, 26], [1, 16], [2, 16], [3, 6], [4, 8], [5, 10], [6, 8], [7, 6], [9, 4]];

/** Well-mixed hash of a position (cars sit on regular grids, so a cheap sine hash would band). */
const h01 = (a: number, b: number) => {
  let h = Math.imul(Math.round(a * 20) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(b * 20) | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function carType(p: Prop): number {
  if (p.n !== undefined) return p.n;
  if (p.h) return 0; // police cars are sedans
  // Lots of the same size put cars at the same local spots, so mix in the (random) paint colour too.
  let ch = 0;
  for (let i = 0; i < p.color.length; i++) ch = (Math.imul(ch, 31) + p.color.charCodeAt(i)) | 0;
  let r = h01(p.x + (ch % 9973) * 0.731, p.z + ((ch >>> 7) % 997) * 0.293) * 100;
  for (const [t, w] of WEIGHTS) {
    r -= w;
    if (r <= 0) return t;
  }
  return 0;
}

/** Simple dimensions for far stand-ins: [half width, front z, rear z, body top, cabin z0, cabin z1, cabin top]. */
const FAR: Record<number, [number, number, number, number, number, number, number]> = {
  0: [0.88, -2.2, 2.2, 0.85, -0.75, 1.15, 1.38],
  1: [0.86, -1.95, 1.95, 0.88, -0.6, 1.85, 1.45],
  2: [0.92, -2.25, 2.25, 1.05, -0.8, 2.05, 1.7],
  3: [0.9, -2.0, 2.0, 1.1, -0.6, 1.6, 1.75],
  4: [0.92, -2.25, 2.25, 1.0, -0.9, 0.2, 1.6],
  5: [0.9, -2.2, 2.2, 0.82, -1.1, 1.6, 1.38],
  6: [0.76, -1.55, 1.55, 0.85, -0.5, 1.3, 1.4],
  7: [0.92, -2.25, 2.25, 1.0, -1.3, 2.25, 1.95],
  8: [0.7, -1.3, 1.25, 0.75, -0.9, 1.25, 1.75],
  9: [0.92, -2.2, 2.2, 0.68, -0.3, 1.0, 1.08],
};

function wheels(L: LocalFrame, hw: number, zs: number[], r: number): void {
  for (const z of zs) for (const x of [-hw + 0.02, hw - 0.02]) L.shape('solid', SHAPES.cylLow, x, r, z, r, 0.24, r, DARK, X);
}

function lights(L: LocalFrame, hw: number, zf: number, zr: number, y: number): void {
  L.box('lamp', -hw + 0.08, y, zf - 0.01, -hw + 0.38, y + 0.12, zf + 0.01, HEAD);
  L.box('lamp', hw - 0.38, y, zf - 0.01, hw - 0.08, y + 0.12, zf + 0.01, HEAD);
  L.box('solid', -hw + 0.08, y, zr - 0.01, -hw + 0.38, y + 0.12, zr + 0.01, TAIL);
  L.box('solid', hw - 0.38, y, zr - 0.01, hw - 0.08, y + 0.12, zr + 0.01, TAIL);
}

export function drawCar(L: LocalFrame, p: Prop): void {
  const c = col(p.color);
  const t = carType(p);
  switch (t) {
    case 1: { // hatchback
      L.box('solid', -0.86, 0.3, -1.95, 0.86, 0.88, 1.95, c);
      L.box('glass', -0.78, 0.88, -0.6, 0.78, 1.4, 1.85, GLASS);
      L.box('solid', -0.8, 1.4, -0.45, 0.8, 1.47, 1.8, c);
      wheels(L, 0.86, [-1.2, 1.25], 0.31);
      lights(L, 0.86, -1.95, 1.95, 0.68);
      break;
    }
    case 2: { // SUV
      L.box('solid', -0.92, 0.35, -2.25, 0.92, 1.05, 2.25, c);
      L.box('solid', -0.9, 0.35, -2.3, 0.9, 0.6, 2.3, DARK);
      L.box('glass', -0.84, 1.05, -0.8, 0.84, 1.62, 2.05, GLASS);
      L.box('solid', -0.86, 1.62, -0.65, 0.86, 1.7, 2.0, c);
      for (const x of [-0.7, 0.7]) L.box('solid', x - 0.04, 1.7, -0.5, x + 0.04, 1.76, 1.9, DARK); // roof rails
      wheels(L, 0.92, [-1.4, 1.4], 0.38);
      lights(L, 0.92, -2.25, 2.25, 0.82);
      break;
    }
    case 3: { // jeep
      L.box('solid', -0.9, 0.4, -2.0, 0.9, 1.1, 2.0, c);
      L.box('glass', -0.84, 1.1, -0.6, 0.84, 1.7, -0.5, GLASS); // flat windscreen
      L.box('glass', -0.86, 1.1, -0.5, 0.86, 1.68, 1.6, GLASS);
      L.box('solid', -0.88, 1.68, -0.6, 0.88, 1.78, 1.65, c);
      L.box('solid', -0.95, 0.4, -2.08, 0.95, 0.62, -1.98, DARK); // bull bar
      L.shape('solid', SHAPES.cylLow, 0, 1.0, 2.15, 0.36, 0.25, 0.36, DARK, Z); // spare wheel
      wheels(L, 0.95, [-1.3, 1.3], 0.42);
      lights(L, 0.9, -2.0, 2.0, 0.85);
      break;
    }
    case 4: { // pickup
      L.box('solid', -0.92, 0.35, -2.25, 0.92, 1.0, 0.2, c);
      L.box('glass', -0.84, 1.0, -0.9, 0.84, 1.55, 0.2, GLASS);
      L.box('solid', -0.86, 1.55, -0.75, 0.86, 1.62, 0.15, c);
      L.box('solid', -0.92, 0.35, 0.2, 0.92, 0.6, 2.25, c); // bed floor
      for (const x of [-0.92, 0.82]) L.box('solid', x, 0.6, 0.25, x + 0.1, 1.0, 2.25, c);
      L.box('solid', -0.92, 0.6, 2.15, 0.92, 1.0, 2.25, c);
      wheels(L, 0.92, [-1.4, 1.45], 0.38);
      lights(L, 0.92, -2.25, 2.25, 0.8);
      break;
    }
    case 5: { // EV: smooth nose, long glass canopy, light bars front and back
      L.box('solid', -0.9, 0.3, -1.6, 0.9, 0.82, 2.2, c);
      L.poly('solid', [[-0.9, 0.82, -1.6], [0.9, 0.82, -1.6], [0.9, 0.6, -2.2], [-0.9, 0.6, -2.2]], c, [0, 1, -0.5]);
      L.box('solid', -0.9, 0.3, -2.2, 0.9, 0.6, -1.6, c);
      L.box('glass', -0.8, 0.82, -1.1, 0.8, 1.36, 1.6, GLASS);
      L.box('lamp', -0.85, 0.58, -2.21, 0.85, 0.64, -2.19, HEAD);
      L.box('solid', -0.85, 0.72, 2.19, 0.85, 0.78, 2.21, TAIL);
      wheels(L, 0.9, [-1.35, 1.4], 0.34);
      break;
    }
    case 6: { // minicar
      L.box('solid', -0.75, 0.28, -1.55, 0.75, 0.85, 1.55, c);
      L.box('glass', -0.7, 0.85, -0.5, 0.7, 1.35, 1.3, GLASS);
      L.box('solid', -0.72, 1.35, -0.4, 0.72, 1.42, 1.25, col('#f4f1ea'));
      wheels(L, 0.75, [-1.0, 1.0], 0.27);
      lights(L, 0.75, -1.55, 1.55, 0.62);
      break;
    }
    case 7: { // van / minivan
      L.box('solid', -0.92, 0.35, -2.25, 0.92, 1.0, 2.25, c);
      L.poly('solid', [[-0.92, 1.0, -2.25], [0.92, 1.0, -2.25], [0.92, 1.9, -1.3], [-0.92, 1.9, -1.3]], GLASS, [0, 1, -1]);
      L.box('solid', -0.92, 1.0, -1.3, 0.92, 1.95, 2.25, c);
      for (const s of [-1, 1]) L.box('glass', s * 0.925 - 0.01, 1.2, -1.1, s * 0.925 + 0.01, 1.62, 1.9, GLASS);
      wheels(L, 0.92, [-1.5, 1.5], 0.34);
      lights(L, 0.92, -2.25, 2.25, 0.78);
      break;
    }
    case 8: { // auto-rickshaw: three wheels, canvas canopy
      const body = col('#2e6b4a');
      L.box('solid', -0.62, 0.25, -1.25, 0.62, 0.75, 1.2, body);
      L.box('solid', -0.2, 0.75, -1.3, 0.2, 1.2, -1.1, body); // nose
      for (const [x, z] of [[-0.66, -0.9], [0.66, -0.9], [-0.66, 1.15], [0.66, 1.15]]) L.beam('solid', [x, 0.75, z], [x, 1.62, z], 0.06, DARK);
      L.box('solid', -0.7, 1.6, -0.95, 0.7, 1.75, 1.25, c);
      L.box('solid', -0.68, 0.75, 1.15, 0.68, 1.6, 1.25, c); // back canvas
      L.box('solid', -0.55, 0.75, 0.2, 0.55, 0.95, 1.0, col('#3b3e42')); // seat
      L.shape('solid', SHAPES.cylLow, 0, 0.26, -1.0, 0.26, 0.16, 0.26, DARK, X);
      for (const x of [-0.6, 0.6]) L.shape('solid', SHAPES.cylLow, x, 0.26, 0.75, 0.26, 0.16, 0.26, DARK, X);
      L.box('lamp', -0.12, 1.0, -1.32, 0.12, 1.12, -1.3, HEAD);
      break;
    }
    case 9: { // sports coupe
      L.box('solid', -0.92, 0.25, -2.2, 0.92, 0.68, 2.2, c);
      L.box('glass', -0.78, 0.68, -0.3, 0.78, 1.06, 1.0, GLASS);
      L.box('solid', -0.8, 1.06, -0.15, 0.8, 1.1, 0.9, c);
      L.box('solid', -0.85, 0.85, 1.95, 0.85, 0.9, 2.2, DARK); // spoiler
      for (const x of [-0.7, 0.7]) L.box('solid', x - 0.04, 0.68, 2.0, x + 0.04, 0.85, 2.1, DARK);
      wheels(L, 0.92, [-1.35, 1.4], 0.33);
      lights(L, 0.92, -2.2, 2.2, 0.5);
      break;
    }
    default: { // sedan
      L.box('solid', -0.88, 0.3, -2.2, 0.88, 0.85, 2.2, c);
      L.box('solid', -0.86, 0.3, -2.25, 0.86, 0.6, -2.12, DARK);
      L.box('solid', -0.86, 0.3, 2.12, 0.86, 0.6, 2.25, DARK);
      L.box('glass', -0.78, 0.85, -0.75, 0.78, 1.36, 1.15, GLASS);
      L.box('solid', -0.8, 1.36, -0.6, 0.8, 1.43, 1.05, c);
      wheels(L, 0.88, [-1.35, 1.35], 0.33);
      lights(L, 0.88, -2.2, 2.2, 0.66);
      if (p.h) {
        // police light bar
        L.box('lamp', -0.55, 1.43, -0.15, -0.02, 1.55, 0.15, col('#ff2a1a'));
        L.box('lamp', 0.02, 1.43, -0.15, 0.55, 1.55, 0.15, col('#2a6bff'));
      }
    }
  }
}

/** Far stand-in: body + cabin boxes in the type's proportions (~24 triangles). */
export function drawCarFar(L: LocalFrame, p: Prop): void {
  const [hw, zf, zr, top, c0, c1, ct] = FAR[carType(p)] ?? FAR[0];
  L.box('solid', -hw, 0.15, zf, hw, top, zr, col(p.color));
  L.box('glass', -hw + 0.1, top, c0, hw - 0.1, ct, c1, GLASS);
}
