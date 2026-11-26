/**
 * Utility structures: water towers in several designs, power-station pieces (hyperboloid cooling towers,
 * reactor domes, coal wagons, solar tables) and farm kit (tractor, combine, hay, pivot irrigation,
 * windpump, greenhouse, open shed, charpai, tubewell, haystack).
 * Local frame as every prop: origin on the ground, -z is the front.
 */
import * as THREE from 'three';
import { LocalFrame, SHAPES, col } from './MeshBuilder';
import { lathe } from './sacredMesher';
import { STYLE_ID } from '../../render/windowMaterial';
import type { Prop } from '../spec';

const STEEL = col('#8f959c');
const DARK = col('#1e1f22');
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const h01 = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------- water towers

let FAR_MODE = false;

/** p.n: 0 pedestal, 1 legged steel, 2 spheroid, 3 concrete reservoir, 4 chalice, 5 lattice hyperboloid. */
function waterTower(L: LocalFrame, p: Prop, c1: THREE.Color, c2: THREE.Color): void {
  const h = p.h ?? 25;
  const r = p.w ?? 5;
  switch (p.n ?? 0) {
    case 1: {
      const n = h01(p.x, p.z) > 0.5 ? 6 : 4;
      const pt = (k: number, y: number): [number, number, number] => {
        const a = (k / n) * Math.PI * 2 + Math.PI / n;
        const rr = r * (0.95 - 0.25 * (y / h));
        return [Math.cos(a) * rr, y, Math.sin(a) * rr];
      };
      for (let k = 0; k < n; k++) {
        L.beam('solid', pt(k, 0), pt(k, h), 0.35, c2);
        for (const [ya, yb] of [[0.05, 0.35], [0.35, 0.65], [0.65, 0.95]]) {
          L.beam('solid', pt(k, h * ya), pt(k + 1, h * yb), 0.1, STEEL);
          L.beam('solid', pt(k + 1, h * ya), pt(k, h * yb), 0.1, STEEL);
        }
      }
      L.shape('solid', SHAPES.cyl, 0, h * 0.5, 0, 0.35, h, 0.35, STEEL); // riser pipe
      L.shape('solid', SHAPES.tube, 0, h + 0.1, 0, r + 0.5, 0.15, r + 0.5, STEEL); // walkway
      lathe(L, [[r * 0.55, h - 1.2], [r, h], [r, h + r * 1.1], [0, h + r * 1.6]], 16, c1);
      L.beam('solid', [r + 0.3, h, 0], [r * 0.75 + 0.3, 0.3, 0], 0.08, STEEL); // ladder
      L.shape('solid', SHAPES.sphere, 0, h + r * 1.65, 0, 0.3, 0.3, 0.3, c2);
      return;
    }
    case 2: {
      lathe(L, [[r * 0.22, 0], [r * 0.18, h - r * 0.4], [r * 0.5, h + r * 0.05]], 12, c2);
      lathe(L, [[r * 0.45, h], [r * 0.85, h + r * 0.35], [r * 1.0, h + r * 0.9], [r * 0.85, h + r * 1.45], [r * 0.5, h + r * 1.78], [0, h + r * 1.9]], 18, c1);
      L.shape('solid', SHAPES.tube, 0, h + r * 0.9, 0, r * 1.03, 0.25, r * 1.03, c2);
      return;
    }
    case 3: {
      // South Asian concrete overhead reservoir: columns + ring beams, drum tank, railed roof, stair round the shaft.
      const conc = c2;
      const n = 6 + (h01(p.z, p.x) > 0.5 ? 2 : 0);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = Math.cos(a) * r * 0.8;
        const z = Math.sin(a) * r * 0.8;
        L.box('solid', x - 0.3, 0, z - 0.3, x + 0.3, h, z + 0.3, conc);
      }
      for (const f of [0.33, 0.66]) L.shape('solid', SHAPES.tube, 0, h * f, 0, r * 0.8, 0.45, r * 0.8, conc);
      L.shape('solid', SHAPES.cyl, 0, h * 0.5, 0, r * 0.25, h, r * 0.25, conc);
      for (let k = 0; k < 10; k++) {
        const a0 = (k / 10) * Math.PI * 4;
        const a1 = ((k + 1) / 10) * Math.PI * 4;
        L.beam('solid', [Math.cos(a0) * r * 0.45, (k / 10) * h, Math.sin(a0) * r * 0.45], [Math.cos(a1) * r * 0.45, ((k + 1) / 10) * h, Math.sin(a1) * r * 0.45], 0.25, conc);
      }
      L.shape('solid', SHAPES.cylLow, 0, h + 0.2, 0, r * 1.05, 0.4, r * 1.05, conc);
      L.shape('solid', SHAPES.cyl, 0, h + 0.4 + r * 0.5, 0, r, r, r, c1);
      L.shape('solid', SHAPES.cylLow, 0, h + 0.5 + r, 0, r * 1.06, 0.2, r * 1.06, conc);
      L.shape('solid', SHAPES.tube, 0, h + 1.1 + r, 0, r * 1.02, 0.08, r * 1.02, STEEL);
      return;
    }
    case 4: {
      lathe(L, [[r * 0.35, 0], [r * 0.26, h * 0.55], [r * 0.5, h * 0.85], [r, h], [r * 1.02, h + r * 0.55], [r * 0.95, h + r * 0.6], [0, h + r * 0.62]], 20, c1);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        L.beam('solid', [Math.cos(a) * r * 0.36, 0.2, Math.sin(a) * r * 0.36], [Math.cos(a) * r * 0.27, h * 0.55, Math.sin(a) * r * 0.27], 0.12, c2); // flutes
      }
      return;
    }
    case 5: {
      // Twisted lattice (hyperboloid) tower with a tank on top.
      const n = 16;
      const rb = r * 0.95;
      const rt = r * 0.45;
      for (const dir of [1, -1]) {
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2;
          const a1 = a0 + dir * Math.PI * 0.42;
          L.beam('solid', [Math.cos(a0) * rb, 0, Math.sin(a0) * rb], [Math.cos(a1) * rt, h, Math.sin(a1) * rt], 0.14, c2);
        }
      }
      for (const f of [0.25, 0.5, 0.75]) {
        const rr = Math.sqrt((rb * rb * (1 - f) * (1 - f)) + rt * rt * f * f + 2 * rb * rt * f * (1 - f) * Math.cos(Math.PI * 0.42));
        L.shape('solid', SHAPES.tube, 0, h * f, 0, rr, 0.12, rr, c2);
      }
      L.shape('solid', SHAPES.cyl, 0, h + r * 0.35, 0, r * 0.6, r * 0.7, r * 0.6, c1);
      lathe(L, [[r * 0.62, h + r * 0.7], [0, h + r * 0.95]], 14, c2);
      return;
    }
    default: {
      L.shape('solid', SHAPES.cyl, 0, h / 2, 0, 1.4, h, 1.4, c2);
      L.shape('solid', SHAPES.cone, 0, h - 1.5, 0, r, 3, r, c1, new THREE.Vector3(0, -1, 0));
      L.shape('solid', SHAPES.cyl, 0, h + 2.0, 0, r, 4, r, c1);
      L.shape('solid', SHAPES.cone, 0, h + 4.6, 0, r * 1.02, 1.2, r * 1.02, c2);
      L.shape('solid', SHAPES.tube, 0, h + 2.0, 0, r + 0.3, 0.12, r + 0.3, STEEL);
    }
  }
}

export function drawUtility(L: LocalFrame, p: Prop, far = false): boolean {
  FAR_MODE = far;
  try {
    return utility(L, p);
  } finally {
    FAR_MODE = false;
  }
}

function utility(L: LocalFrame, p: Prop): boolean {
  const c1 = col(p.color);
  const c2 = col(p.color2 ?? p.color);
  switch (p.kind) {
    case 'waterTowerTall':
      waterTower(L, p, c1, c2);
      return true;
    case 'hyperTower': {
      // Hyperboloid cooling tower: concrete shell on a ring of diagonal legs, dark inside at the top.
      const rb = p.w ?? 25;
      const h = p.h ?? 120;
      const yw = h * 0.78;
      const rw = rb * 0.58;
      const c = (yw * rw) / Math.sqrt(rb * rb - rw * rw);
      const r = (y: number) => rw * Math.sqrt(1 + ((y - yw) / c) ** 2);
      const legH = h * 0.06;
      const prof: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const y = legH + ((h - legH) * k) / 10;
        prof.push([r(y), y]);
      }
      lathe(L, prof, 28, c1);
      lathe(L, [[r(h * 0.9) * 1.005, h * 0.9], [r(h) * 1.005, h]], 28, c2);
      L.shape('solid', SHAPES.cylLow, 0, h * 0.86, 0, r(h * 0.86) * 0.97, 0.2, r(h * 0.86) * 0.97, DARK);
      const n = 24;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        const rl = r(legH);
        L.beam('solid', [Math.cos(a0) * rl, 0, Math.sin(a0) * rl], [Math.cos(a1) * rl, legH, Math.sin(a1) * rl], 0.6, c1);
      }
      return true;
    }
    case 'reactorDome': {
      // Containment building: cylinder + hemispherical dome, a band and a hatch.
      const r = p.w ?? 18;
      const h = p.h ?? 32;
      lathe(L, [[r, 0], [r, h]], 28, c1);
      lathe(L, [[r, h], [r * 0.92, h + r * 0.4], [r * 0.7, h + r * 0.72], [r * 0.38, h + r * 0.92], [0, h + r]], 28, c1);
      L.shape('solid', SHAPES.tube, 0, h, 0, r + 0.15, 0.8, r + 0.15, c2);
      L.box('solid', -2, 0, -r - 0.2, 2, 5, -r + 0.5, c2);
      return true;
    }
    case 'hopperWagons': {
      // Train of open coal hoppers along local z (p.d long), heaped with coal.
      const len = p.d ?? 60;
      const n = Math.max(1, Math.floor(len / 13));
      for (let i = 0; i < n; i++) {
        const z0 = -len / 2 + i * 13 + 0.5;
        L.box('solid', -1.4, 1.6, z0, 1.4, 3.6, z0 + 12, c1);
        L.poly('solid', [[-1.4, 1.6, z0], [1.4, 1.6, z0], [0.4, 0.8, z0 + 2], [-0.4, 0.8, z0 + 2]], c1, [0, -1, -1]);
        L.box('solid', -1.3, 3.6, z0 + 0.3, 1.3, 4.1, z0 + 11.7, col('#232323'));
        for (const zb of [z0 + 2, z0 + 10]) L.box('solid', -1.1, 0.55, zb - 1.2, 1.1, 1.6, zb + 1.2, DARK);
      }
      return true;
    }
    case 'solarTable': {
      // Ground-mounted solar table along local x (p.w long, p.d deep), tilted to face -z, on posts.
      const w = p.w ?? 30;
      const d = p.d ?? 4;
      const tilt = 0.45;
      const y0 = 0.6;
      const y1 = y0 + d * Math.sin(tilt);
      const zf = -(d * Math.cos(tilt)) / 2;
      const zb = -zf;
      L.poly('glass', [[-w / 2, y0, zf], [w / 2, y0, zf], [w / 2, y1, zb], [-w / 2, y1, zb]], col('#1d2c4a'), [0, 1, -0.6]);
      L.poly('solid', [[w / 2, y0 - 0.05, zf], [-w / 2, y0 - 0.05, zf], [-w / 2, y1 - 0.05, zb], [w / 2, y1 - 0.05, zb]], STEEL, [0, -1, 0.6]);
      // panel frame lines as flat strips (2 triangles each)
      if (!FAR_MODE) for (let x = -w / 2 + 1.05; x < w / 2; x += 1.05) L.poly('solid', [[x - 0.025, y0 + 0.012, zf], [x + 0.025, y0 + 0.012, zf], [x + 0.025, y1 + 0.012, zb], [x - 0.025, y1 + 0.012, zb]], col('#c9ccd1'), [0, 1, -0.6]);
      if (!FAR_MODE) for (let x = -w / 2 + 1; x < w / 2; x += 4) {
        L.beam('solid', [x, 0, zf * 0.6], [x, y0 + 0.1, zf * 0.6], 0.1, STEEL);
        L.beam('solid', [x, 0, zb * 0.6], [x, y1 - 0.2, zb * 0.6], 0.1, STEEL);
      }
      return true;
    }
    // ------------------------------------------------------------ farm kit
    case 'tractor': {
      // Tractor nose to -z; n = 1 tows a two-wheel trolley loaded with hay / cane behind.
      L.box('solid', -0.55, 0.7, -2.1, 0.55, 1.55, -0.3, c1); // bonnet
      L.box('solid', -0.65, 0.7, -0.3, 0.65, 1.4, 0.9, c1);
      L.box('glass', -0.65, 1.4, -0.3, 0.65, 2.7, 0.9, col('#2b3a48'));
      L.box('solid', -0.7, 2.7, -0.4, 0.7, 2.85, 1.0, c1);
      L.beam('solid', [0.4, 1.55, -1.7], [0.4, 2.6, -1.7], 0.1, DARK); // exhaust
      for (const x of [-0.95, 0.95]) {
        L.shape('solid', SHAPES.cylLow, x, 0.85, 0.6, 0.85, 0.5, 0.85, DARK, X);
        L.shape('solid', SHAPES.cylLow, x * 0.82, 0.5, -1.6, 0.5, 0.3, 0.5, DARK, X);
        L.shape('solid', SHAPES.cylLow, x * 1.02, 0.85, 0.6, 0.45, 0.05, 0.45, c2, X); // hub
      }
      if ((p.n ?? 0) === 1) {
        L.beam('solid', [0, 0.7, 1.0], [0, 0.7, 2.0], 0.12, DARK);
        L.box('solid', -1.1, 0.9, 2.0, 1.1, 1.6, 6.0, c2);
        L.box('solid', -1.0, 1.6, 2.2, 1.0, 2.4, 5.8, col(p.color2 === '#6f9a3a' ? '#6f9a3a' : '#d9b86a'));
        for (const x of [-1.15, 1.15]) L.shape('solid', SHAPES.cylLow, x, 0.5, 4.0, 0.5, 0.25, 0.5, DARK, X);
      }
      return true;
    }
    case 'harvester': {
      // Combine harvester nose to -z: cutting header, body, glass cab, unloading auger.
      L.box('solid', -2.9, 0.4, -4.4, 2.9, 1.3, -3.4, c2); // header
      for (let x = -2.6; x <= 2.6; x += 0.4) L.box('solid', x - 0.04, 0.35, -4.6, x + 0.04, 0.45, -4.4, DARK);
      L.shape('solid', SHAPES.cylLow, 0, 1.4, -3.9, 0.45, 5.6, 0.45, c2, X); // reel
      L.box('solid', -1.4, 0.8, -3.4, 1.4, 3.4, 2.4, c1);
      L.box('glass', -0.9, 3.4, -3.2, 0.9, 4.6, -1.6, col('#2b3a48'));
      L.box('solid', -1.0, 4.6, -3.3, 1.0, 4.75, -1.5, c1);
      L.box('solid', -1.2, 3.4, -1.0, 1.2, 4.2, 1.8, c1); // grain tank
      L.beam('solid', [1.2, 3.8, 0.8], [3.6, 4.2, -1.0], 0.35, c1); // auger
      for (const x of [-1.5, 1.5]) {
        L.shape('solid', SHAPES.cylLow, x, 0.95, -2.2, 0.95, 0.6, 0.95, DARK, X);
        L.shape('solid', SHAPES.cylLow, x, 0.6, 1.8, 0.6, 0.4, 0.6, DARK, X);
      }
      return true;
    }
    case 'hayBale': {
      const n = p.n ?? 0;
      if (n === 0) L.shape('solid', SHAPES.cylLow, 0, 0.75, 0, 0.75, 1.2, 0.75, c1, X);
      else if (n === 1) {
        L.box('solid', -0.55, 0, -0.4, 0.55, 0.45, 0.4, c1);
        L.box('solid', -0.56, 0.18, -0.41, 0.56, 0.22, 0.41, c2);
      } else {
        // conical haystack (toori) with a rounded top
        const r = p.w ?? 2;
        lathe(L, [[r, 0], [r * 0.95, r * 0.9], [r * 0.6, r * 1.6], [r * 0.2, r * 2.0], [0, r * 2.1]], 12, c1);
      }
      return true;
    }
    case 'pivotIrrigation': {
      // Centre-pivot irrigation: central tower at the origin, arm of truss spans on wheeled A-frames
      // reaching p.w along local +x.
      const len = p.w ?? 60;
      const h = 3.6;
      L.beam('solid', [0, 0, 0], [0, h + 1, 0], 0.4, STEEL);
      for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [0, 1.4]]) L.beam('solid', [x, 0, z], [0, h, 0], 0.15, STEEL);
      const span = 12;
      for (let x0 = 0; x0 < len - 0.1; x0 += span) {
        const x1 = Math.min(len, x0 + span);
        L.beam('solid', [x0, h, 0], [x1, h, 0], 0.18, col('#c9ccd1'));
        const xm = (x0 + x1) / 2;
        L.beam('solid', [x0, h, 0], [xm, h - 1.3, 0], 0.06, STEEL);
        L.beam('solid', [xm, h - 1.3, 0], [x1, h, 0], 0.06, STEEL);
        if (!FAR_MODE) for (let x = x0 + 2; x < x1; x += 3) L.beam('solid', [x, h, 0], [x, 1.2, 0], 0.03, STEEL);
        for (const z of [-1.3, 1.3]) L.beam('solid', [x1, h, 0], [x1, 0.6, z], 0.12, STEEL);
        L.shape('solid', SHAPES.cylLow, x1, 0.6, -1.3, 0.6, 0.25, 0.6, DARK, Z);
        L.shape('solid', SHAPES.cylLow, x1, 0.6, 1.3, 0.6, 0.25, 0.6, DARK, Z);
      }
      return true;
    }
    case 'windpump': {
      // Farm windpump: tapering lattice tower, many-bladed wheel facing -z, tail vane.
      const h = p.h ?? 10;
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.beam('solid', [x * 1.4, 0, z * 1.4], [x * 0.3, h, z * 0.3], 0.1, STEEL);
      for (const f of [0.3, 0.6]) L.shape('solid', SHAPES.tube, 0, h * f, 0, 1.4 - 1.1 * f, 0.06, 1.4 - 1.1 * f, STEEL);
      const r = 1.6;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        L.poly('solid', [[Math.cos(a) * 0.3, h + Math.sin(a) * 0.3, -0.6], [Math.cos(a + 0.18) * r, h + Math.sin(a + 0.18) * r, -0.6], [Math.cos(a) * r, h + Math.sin(a) * r, -0.6]], c1, [0, 0, -1]);
      }
      L.shape('solid', SHAPES.tube, 0, h, -0.6, r, 0.08, r, STEEL, Z);
      L.beam('solid', [0, h, -0.6], [0, h, 2.2], 0.08, STEEL);
      L.box('solid', -0.04, h - 0.6, 1.6, 0.04, h + 0.8, 2.6, c2); // tail vane
      return true;
    }
    case 'greenhouse': {
      // Glass greenhouse along local z (p.d long, p.w wide): glass walls, arched glass roof, white ribs.
      const w = p.w ?? 8;
      const d = p.d ?? 30;
      const wh = 2.4;
      const rib = col('#e9e6df');
      const gl = col('#bcd3da');
      for (const x of [-w / 2, w / 2]) L.poly('glass', [[x, 0, -d / 2], [x, 0, d / 2], [x, wh, d / 2], [x, wh, -d / 2]], gl, [x, 0, 0]);
      const N = 8;
      const arc = (t: number): [number, number] => [-(w / 2) * Math.cos(Math.PI * t), wh + (w * 0.32) * Math.sin(Math.PI * t)];
      for (let i = 0; i < N; i++) {
        const [xa, ya] = arc(i / N);
        const [xb, yb] = arc((i + 1) / N);
        L.poly('glass', [[xa, ya, -d / 2], [xb, yb, -d / 2], [xb, yb, d / 2], [xa, ya, d / 2]], gl, [(xa + xb) / 2, 1, 0]);
      }
      for (const z of [-d / 2, d / 2]) {
        const pts: [number, number, number][] = [[-w / 2, 0, z], [w / 2, 0, z], [w / 2, wh, z]];
        for (let i = N; i >= 0; i--) pts.push([arc(i / N)[0], arc(i / N)[1], z]);
        for (let i = 1; i < pts.length - 1; i++) L.poly('glass', [pts[0], pts[i], pts[i + 1]], gl, [0, 0, z]);
      }
      if (!FAR_MODE) {
        for (let z = -d / 2; z <= d / 2 + 0.01; z += 3) {
          for (let i = 0; i < N; i++) L.beam('solid', [arc(i / N)[0], arc(i / N)[1], z], [arc((i + 1) / N)[0], arc((i + 1) / N)[1], z], 0.06, rib);
          for (const x of [-w / 2, w / 2]) L.beam('solid', [x, 0, z], [x, wh, z], 0.06, rib);
        }
        for (let x = -w / 2 + 1; x < w / 2 - 0.5; x += 1.4) L.box('solid', x - 0.3, 0, -d / 2 + 0.6, x + 0.3, 0.6, d / 2 - 0.6, col('#4f8a3a'));
      }
      return true;
    }
    case 'openShed': {
      // Open-sided shed (cow shed / hay barn / cattle shade): posts, pitched corrugated roof, back wall.
      const w = p.w ?? 30;
      const d = p.d ?? 12;
      const h = p.h ?? 4;
      const rise = d * 0.18;
      for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.max(3, w / Math.round(w / 5))) for (const z of [-d / 2, d / 2]) L.box('solid', x - 0.15, 0, z - 0.15, x + 0.15, h, z + 0.15, STEEL);
      L.poly('solid', [[-w / 2 - 0.3, h, -d / 2 - 0.5], [w / 2 + 0.3, h, -d / 2 - 0.5], [w / 2 + 0.3, h + rise, 0], [-w / 2 - 0.3, h + rise, 0]], c1, [0, 1, -0.3]);
      L.poly('solid', [[w / 2 + 0.3, h, d / 2 + 0.5], [-w / 2 - 0.3, h, d / 2 + 0.5], [-w / 2 - 0.3, h + rise, 0], [w / 2 + 0.3, h + rise, 0]], c1, [0, 1, 0.3]);
      L.poly('solid', [[w / 2 + 0.3, h - 0.02, -d / 2 - 0.5], [-w / 2 - 0.3, h - 0.02, -d / 2 - 0.5], [-w / 2 - 0.3, h - 0.02, d / 2 + 0.5], [w / 2 + 0.3, h - 0.02, d / 2 + 0.5]], c1.clone().multiplyScalar(0.6), [0, -1, 0]);
      if ((p.n ?? 0) === 1) L.box('solid', -w / 2, 0, d / 2 - 0.15, w / 2, h, d / 2 + 0.1, c2); // back wall
      L.box('solid', -w / 2, 0, -d / 2 + 0.8, w / 2, 0.8, -d / 2 + 1.2, c2); // feed trough
      return true;
    }
    case 'charpai': {
      // Woven rope bed (charpai): wooden frame on four legs, light rope top.
      const wood = col('#6b4a33');
      for (const [x, z] of [[-0.45, -0.95], [0.45, -0.95], [-0.45, 0.95], [0.45, 0.95]]) L.box('solid', x - 0.05, 0, z - 0.05, x + 0.05, 0.45, z + 0.05, wood);
      L.box('solid', -0.5, 0.38, -1.0, 0.5, 0.45, 1.0, wood);
      L.box('solid', -0.44, 0.45, -0.94, 0.44, 0.47, 0.94, c1);
      return true;
    }
  }
  return false;
}

void STYLE_ID;
