/**
 * Architectural pieces for places of worship, built mostly as surfaces of revolution (lathe):
 *   dome (hemisphere, onion, mughal bulb, fluted lotus, lead dome on a drum with a lantern, saucer),
 *   minaret (mughal / ottoman / modern / neighbourhood), chhatri, church spire (gothic / pyramid /
 *   belfry / onion), shikhara (nagara) and vimana (dravidian), gopuram, pagoda, stupa, Nishan Sahib,
 *   tent roof, buttress, gravestone, stone lantern, and finials (crescent / cross / kalash / orthodox).
 * Local frame as every prop: origin on the mounting surface, -z is the front.
 */
import * as THREE from 'three';
import { LocalFrame, SHAPES, col } from './MeshBuilder';
import { STYLE_ID } from '../../render/windowMaterial';
import type { Prop } from '../spec';

const GOLD = '#d4a93a';
type P3 = [number, number, number];
/** Far-LOD mode: fewer segments, thinner profiles, no small details. */
let FAR = false;

/** Surface of revolution through profile points [radius, y]; `flute` ripples the radius around. */
export function lathe(L: LocalFrame, profIn: [number, number][], segsIn: number, c: THREE.Color, o: P3 = [0, 0, 0], rot0 = 0, fluteIn = 0): void {
  const segs = FAR && segsIn > 4 ? Math.max(6, Math.round(segsIn / 2)) : segsIn;
  const flute = FAR ? 0 : fluteIn;
  const prof = FAR && profIn.length > 4 ? profIn.filter((_, i) => i % 2 === 0 || i === profIn.length - 1) : profIn;
  const pt = (r: number, y: number, i: number): P3 => {
    const a = rot0 + (i / segs) * Math.PI * 2;
    const rr = r * (1 + (flute ? (i % 2 ? -flute : flute) : 0));
    return [o[0] + Math.cos(a) * rr, o[1] + y, o[2] + Math.sin(a) * rr];
  };
  for (let k = 0; k < prof.length - 1; k++) {
    const [r0, y0] = prof[k];
    const [r1, y1] = prof[k + 1];
    const dr = r1 - r0;
    const dy = y1 - y0;
    for (let i = 0; i < segs; i++) {
      const am = rot0 + ((i + 0.5) / segs) * Math.PI * 2;
      const hint: P3 = [Math.cos(am) * dy, -dr, Math.sin(am) * dy];
      if (Math.abs(hint[0]) + Math.abs(hint[1]) + Math.abs(hint[2]) < 1e-6) continue;
      if (r1 < 1e-4) L.poly('solid', [pt(r0, y0, i), pt(r0, y0, i + 1), [o[0], o[1] + y1, o[2]]], c, hint);
      else if (r0 < 1e-4) L.poly('solid', [[o[0], o[1] + y0, o[2]], pt(r1, y1, i + 1), pt(r1, y1, i)], c, hint);
      else L.poly('solid', [pt(r0, y0, i), pt(r0, y0, i + 1), pt(r1, y1, i + 1), pt(r1, y1, i)], c, hint);
    }
  }
}

const scaleProf = (p: [number, number][], r: number, y0 = 0): [number, number][] => p.map(([a, b]) => [a * r, y0 + b * r]);

const DOMES: [number, number][][] = [
  // 0 hemisphere (slightly stilted)
  [[1, 0], [1, 0.12], [0.97, 0.36], [0.87, 0.6], [0.7, 0.8], [0.45, 0.95], [0.2, 1.03], [0, 1.05]],
  // 1 onion
  [[0.82, 0], [0.98, 0.12], [1.06, 0.3], [1.0, 0.48], [0.82, 0.66], [0.55, 0.84], [0.28, 1.0], [0.1, 1.16], [0, 1.3]],
  // 2 mughal bulb
  [[0.88, 0], [1.02, 0.1], [1.08, 0.28], [1.02, 0.5], [0.84, 0.7], [0.56, 0.88], [0.26, 1.02], [0.07, 1.12], [0, 1.16]],
  // 3 lotus (gold, fluted)
  [[0.8, 0], [0.98, 0.12], [1.05, 0.32], [0.95, 0.55], [0.72, 0.75], [0.42, 0.9], [0.15, 1.02], [0, 1.08]],
  // 4 lead dome (low, on a drum)
  [[1, 0], [0.96, 0.18], [0.85, 0.36], [0.66, 0.52], [0.38, 0.63], [0, 0.67]],
  // 5 saucer (modern)
  [[1, 0], [0.92, 0.08], [0.6, 0.18], [0, 0.24]],
];
const DRUM = [0, 0, 0.32, 0, 0.38, 0.12];

/** Height of a dome prop's top (before its finial), for stacking things on it. */
export function domeTop(n: number, r: number): number {
  const prof = DOMES[n] ?? DOMES[0];
  return DRUM[n] * r + prof[prof.length - 1][1] * r + (n === 4 ? r * 0.32 : 0);
}

/** Finial: 1 crescent, 2 cross, 3 kalash, 4 orthodox cross (size = height). */
function finial(L: LocalFrame, x: number, y: number, z: number, size: number, type: number, c: THREE.Color): void {
  if (!type) return;
  L.beam('solid', [x, y, z], [x, y + size * 0.55, z], Math.max(0.05, size * 0.06), c);
  if (type === 1) {
    L.shape('solid', SHAPES.sphere, x, y + size * 0.35, z, size * 0.1, size * 0.1, size * 0.1, c);
    const r = size * 0.28;
    const cy = y + size * 0.75;
    for (let k = 0; k < 6; k++) {
      const a0 = -Math.PI * 0.85 + (k / 6) * Math.PI * 1.7 - Math.PI / 2;
      const a1 = -Math.PI * 0.85 + ((k + 1) / 6) * Math.PI * 1.7 - Math.PI / 2;
      L.beam('solid', [x + Math.cos(a0) * r, cy + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, cy + Math.sin(a1) * r, z], size * 0.07, c);
    }
  } else if (type === 2 || type === 4) {
    const t = Math.max(0.05, size * 0.07);
    L.beam('solid', [x, y + size * 0.5, z], [x, y + size * 1.1, z], t, c);
    L.beam('solid', [x - size * 0.25, y + size * 0.88, z], [x + size * 0.25, y + size * 0.88, z], t, c);
    if (type === 4) {
      L.beam('solid', [x - size * 0.12, y + size * 1.0, z], [x + size * 0.12, y + size * 1.0, z], t * 0.8, c);
      L.beam('solid', [x - size * 0.17, y + size * 0.63, z], [x + size * 0.17, y + size * 0.73, z], t * 0.8, c);
    }
  } else {
    for (let k = 0; k < 3; k++) L.shape('solid', SHAPES.sphere, x, y + size * (0.3 + k * 0.22), z, size * (0.16 - k * 0.04), size * 0.1, size * (0.16 - k * 0.04), c);
    L.shape('solid', SHAPES.cone, x, y + size * 1.0, z, size * 0.06, size * 0.25, size * 0.06, c);
  }
}

function dome(L: LocalFrame, n: number, r: number, c1: THREE.Color, c2: THREE.Color, fin: number, o: P3 = [0, 0, 0], segs = 16, drumH?: number): void {
  let y = o[1];
  const dh = drumH ?? DRUM[n] * r;
  if (dh > 0) {
    lathe(L, [[r * 0.92, 0], [r * 0.92, dh], [r * 0.98, dh]], segs, c2, o);
    if (!FAR && (n === 4 || drumH)) {
      // windows round the drum
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        L.box('solid', o[0] + Math.cos(a) * r * 0.93 - 0.15, y + dh * 0.25, o[2] + Math.sin(a) * r * 0.93 - 0.15, o[0] + Math.cos(a) * r * 0.93 + 0.15, y + dh * 0.8, o[2] + Math.sin(a) * r * 0.93 + 0.15, col('#2b3a48'));
      }
    }
    y += dh;
  }
  const prof = DOMES[n] ?? DOMES[0];
  lathe(L, scaleProf(prof, r), n === 3 ? 24 : segs, c1, [o[0], y, o[2]], 0, n === 3 ? 0.04 : 0);
  if (n === 3 && !FAR) {
    // lotus petals round the base
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      L.poly('solid', [[o[0] + ca * r * 0.85 - sa * r * 0.22, y + 0.02, o[2] + sa * r * 0.85 + ca * r * 0.22], [o[0] + ca * r * 0.85 + sa * r * 0.22, y + 0.02, o[2] + sa * r * 0.85 - ca * r * 0.22], [o[0] + ca * r * 1.12, y + r * 0.3, o[2] + sa * r * 1.12]], c1, [ca, 0.5, sa]);
    }
  }
  let top = y + prof[prof.length - 1][1] * r;
  if (n === 4) {
    // lantern on top
    L.shape('solid', SHAPES.cylLow, o[0], top + r * 0.12, o[2], r * 0.12, r * 0.24, r * 0.12, c2);
    lathe(L, scaleProf(DOMES[0], r * 0.13), 8, c1, [o[0], top + r * 0.24, o[2]]);
    top += r * 0.32;
  }
  finial(L, o[0], top, o[2], Math.min(4, Math.max(0.8, r * 0.45)), fin, col(GOLD));
}

/** Small domed kiosk on columns. */
function chhatri(L: LocalFrame, r: number, h: number, c1: THREE.Color, c2: THREE.Color, n: number, o: P3 = [0, 0, 0]): void {
  L.shape('solid', SHAPES.cylLow, o[0], o[1] + 0.12, o[2], r * 1.1, 0.24, r * 1.1, c1);
  for (let k = 0; k < (FAR ? 0 : 6); k++) {
    const a = (k / 6) * Math.PI * 2;
    L.beam('solid', [o[0] + Math.cos(a) * r * 0.85, o[1] + 0.24, o[2] + Math.sin(a) * r * 0.85], [o[0] + Math.cos(a) * r * 0.85, o[1] + h, o[2] + Math.sin(a) * r * 0.85], Math.max(0.12, r * 0.12), c1);
  }
  L.shape('solid', SHAPES.cylLow, o[0], o[1] + h + 0.1, o[2], r * 1.15, 0.2, r * 1.15, c1);
  dome(L, n, r * 0.95, c2, c1, 3, [o[0], o[1] + h + 0.2, o[2]], 12);
}

export function drawSacred(L: LocalFrame, p: Prop, far = false): boolean {
  FAR = far;
  try {
    return sacred(L, p);
  } finally {
    FAR = false;
  }
}

const TINY = new Set(['buttress', 'gravestone', 'stoneLantern', 'prayerCarpet', 'wuduTaps', 'shoeRack', 'hedgeRow']);

function sacred(L: LocalFrame, p: Prop): boolean {
  if (FAR && TINY.has(p.kind)) return true; // not worth drawing far away
  const c1 = col(p.color);
  const c2 = col(p.color2 ?? p.color);
  const gold = col(GOLD);
  switch (p.kind) {
    case 'dome':
      dome(L, p.n ?? 0, p.w ?? 4, c1, c2, p.d ?? 0, [0, 0, 0], 16, p.h);
      return true;
    case 'finial':
      finial(L, 0, 0, 0, p.w ?? 2, p.n ?? 2, c1);
      return true;
    case 'chhatri':
      chhatri(L, p.w ?? 1.2, p.h ?? 2.4, c1, c2, p.n ?? 2);
      return true;
    case 'minaret': {
      const n = p.n ?? 0;
      const w = p.w ?? 1.5;
      const h = p.h ?? 30;
      if (n === 0) {
        // Mughal: octagonal tapering shaft in stages, corbelled balconies, chhatri on top.
        lathe(L, [[w * 1.25, 0], [w * 1.25, h * 0.06], [w, h * 0.06], [w * 0.82, h * 0.82]], 8, c1, [0, 0, 0], Math.PI / 8);
        for (const f of FAR ? [0.82] : [0.36, 0.62, 0.82]) {
          const r = w * (1 - 0.18 * (f / 0.82));
          lathe(L, [[r, h * f - 0.9], [r * 1.45, h * f], [r * 1.45, h * f + 0.3], [r * 0.9, h * f + 0.3]], 8, c2, [0, 0, 0], Math.PI / 8);
          lathe(L, [[r * 1.42, h * f + 0.3], [r * 1.42, h * f + 1.1]], 8, c2, [0, 0, 0], Math.PI / 8);
        }
        chhatri(L, w * 0.85, Math.max(2, h * 0.08), c2, c2, 2, [0, h * 0.82 + 0.3, 0]);
        return true;
      }
      if (n === 1) {
        // Ottoman pencil: polygonal base, slim shaft, one or two balconies, tall lead cone.
        L.box('solid', -w * 1.3, 0, -w * 1.3, w * 1.3, h * 0.1, w * 1.3, c1);
        lathe(L, [[w, h * 0.1], [w * 0.95, h * 0.84]], 12, c1);
        for (const f of h > 40 ? [0.55, 0.74] : [0.7]) {
          lathe(L, [[w * 0.95, h * f - 1.2], [w * 1.45, h * f], [w * 1.45, h * f + 1.0], [w * 0.95, h * f + 1.0]], 12, c1);
        }
        lathe(L, [[w * 1.05, h * 0.84], [0, h]], 12, c2);
        finial(L, 0, h, 0, 1.8, 1, gold);
        return true;
      }
      if (n === 2) {
        // Modern needle: square shaft tapering to a point, a glass ring.
        lathe(L, [[w * 1.2, 0], [w * 0.75, h * 0.82], [0, h]], 4, c1, [0, 0, 0], Math.PI / 4);
        lathe(L, [[w * 0.95, h * 0.68], [w * 1.25, h * 0.69], [w * 1.25, h * 0.72], [w * 0.92, h * 0.73]], 4, c2, [0, 0, 0], Math.PI / 4);
        finial(L, 0, h, 0, 1.4, 1, gold);
        return true;
      }
      // Neighbourhood: square shaft, balcony with loudspeakers, small domed kiosk.
      L.box('solid', -w, 0, -w, w, h * 0.78, w, c1);
      L.box('solid', -w * 1.4, h * 0.72, -w * 1.4, w * 1.4, h * 0.74, w * 1.4, c2);
      L.box('solid', -w * 1.4, h * 0.74, -w * 1.4, w * 1.4, h * 0.74 + 0.9, -w * 1.35, c2);
      L.box('solid', -w * 1.4, h * 0.74, w * 1.35, w * 1.4, h * 0.74 + 0.9, w * 1.4, c2);
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.shape('solid', SHAPES.cone, x * w * 1.05, h * 0.86, z * w * 1.05, 0.25, 0.5, 0.25, col('#d9d9d9'), new THREE.Vector3(x, 0, z));
      L.box('solid', -w * 0.8, h * 0.78, -w * 0.8, w * 0.8, h * 0.9, w * 0.8, c1);
      dome(L, 1, w * 0.95, c2, c1, 1, [0, h * 0.9, 0], 10);
      return true;
    }
    case 'churchSpire': {
      // On top of a square tower of half-width w.
      const n = p.n ?? 0;
      const w = p.w ?? 3;
      const h = p.h ?? 12;
      const iron = col('#3a3d40');
      if (n === 0) {
        lathe(L, [[w * 0.85, 0], [0, h]], 8, c2, [0, 0, 0], Math.PI / 8);
        for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          L.box('solid', x * w * 0.85 - 0.35, 0, z * w * 0.85 - 0.35, x * w * 0.85 + 0.35, 1.5, z * w * 0.85 + 0.35, c1);
          lathe(L, [[0.4, 1.5], [0, 1.5 + h * 0.18]], 4, c1, [x * w * 0.85, 0, z * w * 0.85], Math.PI / 4);
        }
        finial(L, 0, h, 0, 2.2, 2, iron);
      } else if (n === 1) {
        lathe(L, [[w * 1.08, 0], [0, h]], 4, c2, [0, 0, 0], Math.PI / 4);
        finial(L, 0, h, 0, 1.8, 2, iron);
      } else if (n === 2) {
        // open belfry with a bell, little dome
        for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.box('solid', x * w * 0.8 - 0.3, 0, z * w * 0.8 - 0.3, x * w * 0.8 + 0.3, h * 0.45, z * w * 0.8 + 0.3, c1);
        L.shape('solid', SHAPES.cone, 0, h * 0.25, 0, w * 0.35, w * 0.45, w * 0.35, gold);
        L.box('solid', -w, h * 0.45, -w, w, h * 0.52, w, c1);
        lathe(L, scaleProf(DOMES[0], w * 0.75), 12, c2, [0, h * 0.52, 0]);
        finial(L, 0, h * 0.52 + w * 0.78, 0, 1.6, 2, iron);
      } else {
        lathe(L, [[w * 0.7, 0], [w * 0.7, h * 0.3]], 12, c1);
        dome(L, 1, w * 0.8, c2, c1, 4, [0, h * 0.3, 0], 12);
      }
      return true;
    }
    case 'shikhara': {
      const n = p.n ?? 0;
      const w = p.w ?? 4;
      const h = p.h ?? 16;
      if (n === 0) {
        // Nagara: curvilinear ribbed tower, smaller towers clustered round it, amalaka + kalash.
        const tower = (o: P3, ww: number, hh: number) => {
          const prof: [number, number][] = [];
          for (let k = 0; k <= 6; k++) {
            const t = k / 6;
            prof.push([ww * (1 - 0.68 * Math.pow(t, 1.7)), hh * t]);
          }
          lathe(L, prof, 16, c1, o, Math.PI / 16, 0.07);
          const tr = ww * 0.32;
          lathe(L, [[tr * 0.9, hh], [tr * 1.35, hh + tr * 0.25], [tr * 0.9, hh + tr * 0.5]], 16, c2, o, 0, 0.12);
          finial(L, o[0], o[1] + hh + tr * 0.5, o[2], Math.max(0.8, ww * 0.35), 3, gold);
        };
        tower([0, 0, 0], w, h);
        if (!FAR) for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) tower([x * w * 0.62, 0, z * w * 0.62], w * 0.42, h * 0.5);
        return true;
      }
      // Dravidian vimana: stepped square tiers with miniature shrines, octagonal capstone.
      const K = 4;
      let y = 0;
      let ww = w;
      for (let k = 0; k < K; k++) {
        const th = (h * 0.7) / K;
        L.box('solid', -ww, y, -ww, ww, y + th, ww, k % 2 ? c2 : c1);
        L.box('solid', -ww - 0.2, y + th - 0.25, -ww - 0.2, ww + 0.2, y + th, ww + 0.2, c2);
        const nk = FAR ? 0 : Math.max(2, Math.floor((ww * 2) / 1.4));
        for (let i = 0; i < nk; i++) {
          const t = -ww + (i + 0.5) * ((ww * 2) / nk);
          for (const [x, z] of [[t, -ww], [t, ww], [-ww, t], [ww, t]]) L.box('solid', x - 0.3, y + th, z - 0.3, x + 0.3, y + th + 0.7, z + 0.3, c1);
        }
        y += th;
        ww *= 0.74;
      }
      lathe(L, scaleProf(DOMES[0], ww * 1.4), 8, c1, [0, y, 0], Math.PI / 8);
      finial(L, 0, y + ww * 1.45, 0, 1.6, 3, gold);
      return true;
    }
    case 'gopuram': {
      // Stepped gateway tower (p.w along x, p.d deep, p.h high), painted tiers, barrel-vault top with kalashas.
      const w = (p.w ?? 18) / 2;
      const d = (p.d ?? 10) / 2;
      const h = p.h ?? 30;
      const paint = [c1, col('#e74c3c'), col('#f1c40f'), col('#27ae60'), col('#2e86de'), c2, col('#e67e22')];
      const base = h * 0.22;
      L.box('solid', -w, 0, -d, w, base, d, col('#8f8a83'));
      L.box('solid', -w * 0.22, 0, -d - 0.05, w * 0.22, base * 0.75, d + 0.05, col('#1e1f22'));
      const K = 7;
      let y = base;
      let wx = w;
      let dz = d;
      for (let k = 0; k < K; k++) {
        const th = (h * 0.68) / K;
        L.box('solid', -wx, y, -dz, wx, y + th, dz, paint[k % paint.length]);
        L.box('solid', -wx - 0.25, y + th - 0.25, -dz - 0.25, wx + 0.25, y + th, dz + 0.25, c2);
        const nf = FAR ? 0 : Math.max(2, Math.floor((wx * 2) / 1.3));
        for (let i = 0; i < nf; i++) {
          const x = -wx + (i + 0.5) * ((wx * 2) / nf);
          const fc = paint[(i + k * 3) % paint.length];
          for (const s of [-1, 1]) L.box('solid', x - 0.25, y + 0.25, s * dz - 0.2, x + 0.25, y + th - 0.4, s * dz + 0.2, fc);
        }
        y += th;
        wx *= 0.88;
        dz *= 0.8;
      }
      L.shape('solid', SHAPES.cyl, 0, y, 0, dz * 1.1, wx * 2, dz * 1.1, c2, new THREE.Vector3(1, 0, 0));
      const nk = 5 + 2 * Math.floor(wx / 3);
      for (let i = 0; i < nk; i++) finial(L, -wx + (i + 0.5) * ((wx * 2) / nk), y + dz * 1.05, 0, 1.4, 3, gold);
      return true;
    }
    case 'pagoda': {
      // Tiered pagoda (p.n tiers), body half-width p.w, total height p.h; upturned eaves; spire with rings.
      const n = p.n ?? 5;
      const w = p.w ?? 4;
      const h = p.h ?? 24;
      const tierH = (h * 0.78) / n;
      let y = 0;
      L.box('solid', -w * 1.3, 0, -w * 1.3, w * 1.3, 0.8, w * 1.3, col('#9a958a'));
      y = 0.8;
      for (let k = 0; k < n; k++) {
        const wb = w * (1 - 0.1 * k);
        const bh = tierH * 0.55;
        L.box('solid', -wb, y, -wb, wb, y + bh, wb, c1);
        const ov = wb * 0.45 + 0.6;
        const yt = y + bh;
        const ye = yt + tierH * 0.12;
        const yr = yt + tierH * 0.45;
        const corner = (sx: number, sz: number): P3 => [sx * (wb + ov), ye + 0.45, sz * (wb + ov)];
        const ins = (sx: number, sz: number): P3 => [sx * wb * 0.7, yr, sz * wb * 0.7];
        const sides: [number, number, number, number][] = [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]];
        for (const [ax, az, bx, bz] of sides) {
          const nx = (ax + bx) / 2;
          const nz = (az + bz) / 2;
          L.poly('solid', [corner(ax, az), corner(bx, bz), ins(bx, bz), ins(ax, az)], c2, [nx, 1.2, nz]);
          L.poly('solid', [corner(ax, az), corner(bx, bz), [bx * wb, yt, bz * wb], [ax * wb, yt, az * wb]], c2.clone().multiplyScalar(0.6), [nx, -1, nz]);
        }
        L.box('solid', -wb * 0.7, yr, -wb * 0.7, wb * 0.7, yr + 0.15, wb * 0.7, c2);
        y = yr;
      }
      const sp = h - y;
      L.beam('solid', [0, y, 0], [0, y + sp, 0], 0.22, gold);
      for (let k = 0; k < 7; k++) L.shape('solid', SHAPES.tube, 0, y + sp * (0.15 + k * 0.09), 0, 0.55 - k * 0.04, 0.08, 0.55 - k * 0.04, gold);
      L.shape('solid', SHAPES.sphere, 0, y + sp, 0, 0.3, 0.3, 0.3, gold);
      return true;
    }
    case 'stupa': {
      // Terraces, drum, white dome (anda), harmika, stacked parasols, prayer-flag lines.
      const r = p.w ?? 8;
      let y = 0;
      for (let k = 0; k < 3; k++) {
        const s = r * (1.6 - k * 0.2);
        L.box('solid', -s, y, -s, s, y + r * 0.18, s, c1);
        y += r * 0.18;
      }
      lathe(L, [[r * 1.02, 0], [r * 1.02, r * 0.18]], 20, c1, [0, y, 0]);
      y += r * 0.18;
      lathe(L, scaleProf(DOMES[0], r), 20, c1, [0, y, 0]);
      y += r * 1.0;
      L.box('solid', -r * 0.22, y, -r * 0.22, r * 0.22, y + r * 0.25, r * 0.22, gold);
      y += r * 0.25;
      const top = y + r * 0.9;
      if (FAR) L.shape('solid', SHAPES.cone, 0, y + r * 0.36, 0, r * 0.18, r * 0.72, r * 0.18, gold);
      else for (let k = 0; k < 9; k++) L.shape('solid', SHAPES.cylLow, 0, y + r * 0.08 * k, 0, r * (0.18 - k * 0.015), r * 0.05, r * (0.18 - k * 0.015), gold);
      finial(L, 0, y + r * 0.72, 0, r * 0.3, 3, gold);
      const flagCols = ['#2e86de', '#f4f1ea', '#e74c3c', '#27ae60', '#f1c40f'];
      // Prayer-flag strings from the spire down to the corners (only on big stupas).
      for (const [x, z] of FAR || r < 3 ? [] : [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const ex = x * r * 2.4;
        const ez = z * r * 2.4;
        const N = 14;
        const at = (t: number): P3 => [ex * t, top - (top - 1.2) * t - Math.sin(Math.PI * t) * 1.2, ez * t];
        for (let i = 0; i < N; i++) L.beam('solid', at(i / N), at((i + 1) / N), 0.03, col('#6b6b6b'));
        L.beam('solid', at(1), [ex, 0, ez], 0.06, col('#8a6a4a'));
        for (let i = 0; i < N; i++) {
          const [px, py, pz] = at((i + 0.5) / N);
          const fx = -z * 0.25;
          const fz = x * 0.25;
          L.poly('solid', [[px - fx, py, pz - fz], [px + fx, py, pz + fz], [px + fx, py - 0.5, pz + fz], [px - fx, py - 0.5, pz - fz]], col(flagCols[i % flagCols.length]), [x, 0, z]);
          L.poly('solid', [[px - fx, py, pz - fz], [px + fx, py, pz + fz], [px + fx, py - 0.5, pz + fz], [px - fx, py - 0.5, pz - fz]], col(flagCols[i % flagCols.length]), [-x, 0, -z]);
        }
      }
      return true;
    }
    case 'nishanSahib': {
      // Tall Sikh flagpole wrapped in saffron cloth, triangular flag, khanda-style finial.
      const h = p.h ?? 22;
      L.box('solid', -1.2, 0, -1.2, 1.2, 0.8, 1.2, col('#f4f1ea'));
      L.shape('solid', SHAPES.cylLow, 0, 0.8 + (h - 2) / 2, 0, 0.22, h - 2, 0.22, c1);
      L.beam('solid', [0, h - 1.2, 0], [0, h, 0], 0.12, gold);
      finial(L, 0, h, 0, 1.6, 3, gold);
      L.poly('solid', [[0.1, h - 1.4, 0], [3.4, h - 2.4, 0.2], [0.1, h - 3.4, 0]], c1, [0, 0, -1]);
      L.poly('solid', [[0.1, h - 1.4, 0], [3.4, h - 2.4, 0.2], [0.1, h - 3.4, 0]], c1, [0, 0, 1]);
      return true;
    }
    case 'tentHall': {
      // Folded "desert tent" roof over a square of half-width p.w, apex p.h (eight triangular facets).
      const w = p.w ?? 20;
      const h = p.h ?? 14;
      const corners: P3[] = [[-w, 0, -w], [w, 0, -w], [w, 0, w], [-w, 0, w]];
      const apex: P3 = [0, h, 0];
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        const m: P3 = [(a[0] + b[0]) / 2, h * 0.28, (a[2] + b[2]) / 2];
        const nx = (a[0] + b[0]) / 2;
        const nz = (a[2] + b[2]) / 2;
        L.poly('solid', [a, m, apex], i % 2 ? c1 : c1.clone().multiplyScalar(0.94), [nx, w * 0.6, nz]);
        L.poly('solid', [m, b, apex], i % 2 ? c1.clone().multiplyScalar(0.94) : c1, [nx, w * 0.6, nz]);
        // glazed slot under the raised edge
        L.poly('glass', [a, b, m], col('#2b3a48'), [nx, 0, nz]);
      }
      finial(L, 0, h, 0, 2.5, 1, gold);
      return true;
    }
    case 'prayerCarpet': {
      // Prayer carpet runner along local x (p.w long, p.d deep): repeating mats with an arched mihrab motif
      // pointing to -z (the qibla side), border stripes; n = 1 plain runner (no motif).
      const w = p.w ?? 20;
      const d = p.d ?? 1.3;
      const y = 0.012;
      L.poly('solid', [[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]], c1, [0, 1, 0]);
      const y2 = y + 0.004;
      L.poly('solid', [[-w / 2, y2, -d / 2], [w / 2, y2, -d / 2], [w / 2, y2, -d / 2 + 0.08], [-w / 2, y2, -d / 2 + 0.08]], c2, [0, 1, 0]);
      L.poly('solid', [[-w / 2, y2, d / 2 - 0.08], [w / 2, y2, d / 2 - 0.08], [w / 2, y2, d / 2], [-w / 2, y2, d / 2]], c2, [0, 1, 0]);
      if ((p.n ?? 0) === 1) return true;
      const seg = 1.15;
      const n = Math.max(1, Math.floor(w / seg));
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + (i + 0.5) * (w / n);
        const hw = (w / n) * 0.32;
        L.poly('solid', [[x0 - hw, y2, d / 2 - 0.2], [x0 + hw, y2, d / 2 - 0.2], [x0 + hw, y2, -d / 2 + 0.45], [x0, y2, -d / 2 + 0.2], [x0 - hw, y2, -d / 2 + 0.45]], c2, [0, 1, 0]);
        L.poly('solid', [[x0 - hw * 0.6, y2 + 0.002, d / 2 - 0.32], [x0 + hw * 0.6, y2 + 0.002, d / 2 - 0.32], [x0 + hw * 0.6, y2 + 0.002, -d / 2 + 0.5], [x0, y2 + 0.002, -d / 2 + 0.34], [x0 - hw * 0.6, y2 + 0.002, -d / 2 + 0.5]], c1.clone().multiplyScalar(0.8), [0, 1, 0]);
      }
      return true;
    }
    case 'wuduTaps': {
      // Ablution station along local x: stone seat ledge, low wall with a row of brass taps, drain channel.
      const w = p.w ?? 8;
      const stone = c1;
      L.box('solid', -w / 2, 0, 0.2, w / 2, 0.75, 0.5, stone);
      L.box('solid', -w / 2, 0, -0.75, w / 2, 0.38, -0.45, stone);
      L.box('solid', -w / 2, 0.01, -0.45, w / 2, 0.03, 0.2, col('#8f8a83'));
      for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 0.9) {
        L.beam('solid', [x, 0.6, 0.2], [x, 0.6, 0.05], 0.04, col(GOLD));
        L.beam('solid', [x, 0.6, 0.05], [x, 0.5, 0.05], 0.035, col(GOLD));
      }
      return true;
    }
    case 'shoeRack': {
      // Open shoe shelves (p.w long) with pairs of shoes in assorted colours.
      const w = p.w ?? 3;
      const wood = c1;
      L.box('solid', -w / 2, 0, -0.2, -w / 2 + 0.05, 1.2, 0.2, wood);
      L.box('solid', w / 2 - 0.05, 0, -0.2, w / 2, 1.2, 0.2, wood);
      L.box('solid', -w / 2, 0, 0.18, w / 2, 1.2, 0.2, wood);
      const shoes = ['#1e1f22', '#6b4a33', '#8a6a4a', '#2b2b2b', '#c0392b', '#f4f1ea'];
      for (const y of [0.05, 0.45, 0.85]) {
        L.box('solid', -w / 2, y - 0.03, -0.2, w / 2, y, 0.2, wood);
        for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.32) {
          const h = (Math.abs(Math.sin(x * 12.9 + y * 31.7 + p.x)) * 6) | 0;
          L.box('solid', x - 0.12, y, -0.15, x + 0.12, y + 0.1, 0.1, col(shoes[h % shoes.length]));
        }
      }
      return true;
    }
    case 'strut': {
      // Structural member from the origin to local (0, h, -d), p.w thick (exoskeleton legs, supports).
      L.beam('solid', [0, 0, 0], [0, p.h ?? 10, -(p.d ?? 0)], p.w ?? 1, c1);
      return true;
    }
    case 'archRib': {
      // Big decorative arch in the local x-y plane: spans -w..w, rises p.h, p.d thick.
      const w = p.w ?? 10;
      const h = p.h ?? 20;
      const t = p.d ?? 1.6;
      const N = FAR ? 8 : 16;
      for (let i = 0; i < N; i++) {
        const a0 = Math.PI - (i / N) * Math.PI;
        const a1 = Math.PI - ((i + 1) / N) * Math.PI;
        L.beam('solid', [Math.cos(a0) * w, Math.sin(a0) * h, 0], [Math.cos(a1) * w, Math.sin(a1) * h, 0], t, c1);
      }
      return true;
    }
    case 'obelisk': {
      const h = p.h ?? 16;
      const w = p.w ?? 1;
      L.box('solid', -w * 1.8, 0, -w * 1.8, w * 1.8, 0.8, w * 1.8, c2);
      lathe(L, [[w * 1.15, 0.8], [w * 0.75, h * 0.9], [0, h]], 4, c1, [0, 0, 0], Math.PI / 4);
      lathe(L, [[w * 0.76, h * 0.9 - 0.02], [0, h + 0.02]], 4, col(GOLD), [0, 0, 0], Math.PI / 4);
      return true;
    }
    case 'glassPyramid': {
      // Glass pyramid (half-width p.w, height p.h): curtain-wall bands on the four sloped faces, lit at night.
      const a = p.w ?? 30;
      const h = p.h ?? 40;
      const bands = FAR ? 4 : Math.max(4, Math.round(h / 3.6));
      const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 4; i++) {
        const [ax, az] = corners[i];
        const [bx, bz] = corners[(i + 1) % 4];
        const nx = (ax + bx) / 2;
        const nz = (az + bz) / 2;
        const normal: [number, number, number] = [nx * h, a, nz * h];
        for (let k = 0; k < bands; k++) {
          const t0 = k / bands;
          const t1 = (k + 1) / bands;
          const s0 = a * (1 - t0);
          const s1 = a * (1 - t1);
          const y0 = h * t0;
          const y1 = h * t1;
          const slant = Math.hypot(h / bands, (s0 - s1));
          if (k === bands - 1) {
            L.poly('glass', [[bx * s0, y0, bz * s0], [ax * s0, y0, az * s0], [0, h, 0]], c1, normal);
            continue;
          }
          // seen from outside: bottom-left is the "b" corner (faces wind clockwise from above)
          L.winQuad('window', [[bx * s0, y0, bz * s0], [ax * s0, y0, az * s0], [ax * s1, y1, az * s1], [bx * s1, y1, bz * s1]], c1, s0 * 2, slant, STYLE_ID.curtain, (k % 3 === 0 ? 1 : 0) + ((k * 0.37 + i * 0.13) % 0.99), normal);
        }
        // Edge ribs
        L.beam('solid', [ax * a, 0, az * a], [0, h, 0], 0.35, c2);
      }
      L.beam('lamp', [0, h, 0], [0, h + 1.2, 0], 0.5, col('#fff6d8'));
      return true;
    }
    case 'hedgeRow': {
      // Planted strip along local x (p.w long): trough + clipped greenery (terraces, roof gardens).
      const w = p.w ?? 10;
      L.box('solid', -w / 2, 0, -0.45, w / 2, 0.55, 0.45, c2);
      L.box('solid', -w / 2 + 0.1, 0.55, -0.38, w / 2 - 0.1, 1.15, 0.38, c1);
      return true;
    }
    case 'buttress': {
      // Stepped buttress against a wall; local -z points away from the wall.
      const h = p.h ?? 8;
      const d = p.d ?? 1.6;
      L.box('solid', -0.45, 0, -d, 0.45, h * 0.55, 0, c1);
      L.box('solid', -0.4, h * 0.55, -d * 0.6, 0.4, h * 0.85, 0, c1);
      L.poly('solid', [[-0.4, h * 0.85, -d * 0.6], [0.4, h * 0.85, -d * 0.6], [0.4, h, 0], [-0.4, h, 0]], c1, [0, 1, -1]);
      return true;
    }
    case 'gravestone': {
      if ((p.n ?? 0) === 1) {
        L.beam('solid', [0, 0, 0], [0, 1.1, 0], 0.12, c1);
        L.beam('solid', [-0.3, 0.8, 0], [0.3, 0.8, 0], 0.1, c1);
      } else {
        L.box('solid', -0.3, 0, -0.08, 0.3, 0.75, 0.08, c1);
        L.shape('solid', SHAPES.cylLow, 0, 0.75, 0, 0.3, 0.16, 0.08, c1, new THREE.Vector3(0, 0, 1));
      }
      L.box('solid', -0.35, 0, -0.9, 0.35, 0.12, 0.1, c1.clone().multiplyScalar(0.85));
      return true;
    }
    case 'stoneLantern': {
      const stone = c1;
      L.box('solid', -0.35, 0, -0.35, 0.35, 0.2, 0.35, stone);
      L.shape('solid', SHAPES.cylLow, 0, 0.75, 0, 0.12, 1.1, 0.12, stone);
      L.box('solid', -0.3, 1.3, -0.3, 0.3, 1.4, 0.3, stone);
      L.box('lamp', -0.22, 1.4, -0.22, 0.22, 1.75, 0.22, col('#ffd28a'));
      lathe(L, [[0.55, 1.75], [0.12, 2.05], [0, 2.2]], 6, stone);
      return true;
    }
  }
  return false;
}
