/**
 * Office tower grammar (14-60 floors).
 *
 *   Lot      -> Plaza (trees, benches, fountain, bollards) + [Podium] + Tower + service yard
 *   Tower    -> Design x Footprint
 *   Design   -> classic (straight | setbacks | taper | twist) | spiral | flame | stacked | rotating floors | Y-tower
 *   Footprint-> rect | chamfer | rounded | round | oval | triangle | hexagon | octagon | diamond
 *   Floor    -> one or more convex polygons (components). Runs of identical floors merge into one PolyMass.
 *   Crown    -> plant room + AC units | helipad | spire   [+ lit crown band]
 *
 * Every design is just a function "floor index -> polygons", so new designs are cheap to add and
 * all of them share the one-quad-per-floor-per-edge facade.
 */
import { RNG } from '../../core/rng';
import { jitterHex } from '../../core/color';
import { TOWER_PALETTES, type TowerStyle } from '../styles/palettes';
import { YardPlacer, addCar } from '../details/details';
import { summarizeProps } from './house';
import {
  DEFAULT_DETAILS,
  type DetailOptions,
  type HouseModel,
  type Light,
  type Mass,
  type PolyMass,
  type Porch,
  type Prop,
  type Rect,
  type Tree,
  rotFromNormal,
} from '../spec';

export type TowerDesign = 'classic' | 'spiral' | 'flame' | 'stacked' | 'rotating' | 'yTower';

export interface TowerSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style?: TowerStyle;
  design?: TowerDesign;
  details?: DetailOptions;
}

type Pt = [number, number];
type Shape = 'rect' | 'chamfer' | 'rounded' | 'round' | 'oval' | 'triangle' | 'hexagon' | 'octagon' | 'diamond';
type Classic = 'straight' | 'setbacks' | 'taper' | 'twist';
type Crown = 'plant' | 'helipad' | 'spire';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------- footprints (centred on the origin)

function regular(n: number, hw: number, hd: number, offset: number): Pt[] {
  return Array.from({ length: n }, (_, k) => {
    const a = offset + (k / n) * Math.PI * 2;
    return [Math.cos(a) * hw, Math.sin(a) * hd] as Pt;
  });
}

function footprint(shape: Shape, w: number, d: number, rng: RNG): Pt[] {
  const hw = w / 2;
  const hd = d / 2;
  switch (shape) {
    case 'rect':
      return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    case 'diamond':
      return [[0, -hd], [hw, 0], [0, hd], [-hw, 0]];
    case 'chamfer': {
      const c = Math.min(w, d) * rng.range(0.12, 0.22);
      return [[-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]];
    }
    case 'rounded': {
      const r = Math.min(w, d) * rng.range(0.15, 0.3);
      const pts: Pt[] = [];
      const corners: [number, number, number][] = [[hw - r, -hd + r, -Math.PI / 2], [hw - r, hd - r, 0], [-hw + r, hd - r, Math.PI / 2], [-hw + r, -hd + r, Math.PI]];
      for (const [cx, cz, a0] of corners) {
        for (let k = 0; k <= 3; k++) {
          const a = a0 + (k / 3) * (Math.PI / 2);
          pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
        }
      }
      return pts;
    }
    case 'round':
      return regular(16, hw, hw, 0);
    case 'oval':
      return regular(18, hw, hd, 0);
    case 'hexagon':
      return regular(6, hw, hw, Math.PI / 6);
    case 'octagon':
      return regular(8, hw, hw, Math.PI / 8);
    case 'triangle': {
      // Rounded triangle with one corner pointing at the street (-z).
      const R = Math.min(w, d) * 0.6;
      const r = R * 0.2;
      const pts: Pt[] = [];
      for (let k = 0; k < 3; k++) {
        const th = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
        const cx = Math.cos(th) * (R - 2 * r);
        const cz = Math.sin(th) * (R - 2 * r);
        for (let j = 0; j <= 3; j++) {
          const a = th - Math.PI / 3 + (j / 3) * ((2 * Math.PI) / 3);
          pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
        }
      }
      return pts;
    }
  }
}

/** Wing for Y-towers: a slab from the centre outwards with a rounded tip (convex). */
function wing(len: number, width: number, angle: number): Pt[] {
  const hw = width / 2;
  const tip = Math.max(0.1, len - hw);
  const pts: Pt[] = [[0, -hw], [tip, -hw]];
  for (let j = 1; j < 4; j++) {
    const a = -Math.PI / 2 + (j / 4) * Math.PI;
    pts.push([tip + Math.cos(a) * hw, Math.sin(a) * hw]);
  }
  pts.push([tip, hw], [0, hw]);
  return pts.map(([x, z]) => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)]);
}

const xf = (pts: Pt[], sx: number, sz: number, rot: number, cx: number, cz: number): Pt[] =>
  pts.map(([x, z]) => {
    const X = x * sx;
    const Z = z * sz;
    return [cx + X * Math.cos(rot) - Z * Math.sin(rot), cz + X * Math.sin(rot) + Z * Math.cos(rot)];
  });

const samePoly = (a: Pt[], b: Pt[]) => a.length === b.length && a.every(([x, z], i) => Math.abs(x - b[i][0]) < 1e-6 && Math.abs(z - b[i][1]) < 1e-6);

/** Distance from the centre to the nearest edge (largest inscribed circle around it). */
function innerRadius(pts: Pt[], cx: number, cz: number): number {
  let r = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    r = Math.min(r, Math.abs((bx - ax) * (az - cz) - (ax - cx) * (bz - az)) / len);
  }
  return r;
}

/** For a point inside a convex polygon: distance to the nearest edge and that edge's outward normal. */
function edgeInfo(P: Pt[], x: number, z: number): { dist: number; nx: number; nz: number } | null {
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length;
  const cz = P.reduce((s, p) => s + p[1], 0) / P.length;
  let best: { dist: number; nx: number; nz: number } | null = null;
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i];
    const [bx, bz] = P[(i + 1) % P.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) continue;
    let nx = (bz - az) / len;
    let nz = -(bx - ax) / len;
    if (nx * ((ax + bx) / 2 - cx) + nz * ((az + bz) / 2 - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const d = (ax - x) * nx + (az - z) * nz; // > 0 when the point is on the inner side
    if (d < 0) return null;
    if (!best || d < best.dist) best = { dist: d, nx, nz };
  }
  return best;
}

/** z of the street-facing edge of a set of convex polygons along the line x = const. */
function frontZAt(polys: Pt[][], x: number): number | null {
  let best: number | null = null;
  for (const P of polys) {
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i];
      const [bx, bz] = P[(i + 1) % P.length];
      if ((ax - x) * (bx - x) > 0 || ax === bx) continue;
      const z = az + ((x - ax) / (bx - ax)) * (bz - az);
      if (best === null || z < best) best = z;
    }
  }
  return best;
}

export function generateTower(spec: TowerSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const details = spec.details ?? DEFAULT_DETAILS;
  const style: TowerStyle = spec.style ?? rng.weighted<TowerStyle>([['glass', 65], ['stone', 35]]);
  const design: TowerDesign =
    spec.design ?? rng.weighted<TowerDesign>([['classic', 34], ['spiral', 14], ['flame', 12], ['stacked', 14], ['rotating', 12], ['yTower', 14]]);
  const pal = TOWER_PALETTES[style];
  const W = spec.lotWidth;
  const D = spec.lotDepth;

  const floors =
    design === 'yTower' ? rng.int(35, 60) : design === 'flame' || design === 'spiral' ? rng.int(28, 55) : rng.int(14, 45);
  const fh = rng.range(3.7, 4.1);
  const plaza = rng.range(8, 14);
  const frame = jitterHex(rng.pick(pal.frames), rng, 0.03);
  const roofColor = rng.pick(pal.roofs);
  const pavingColor = jitterHex(rng.pick(pal.paving), rng, 0.03);
  const facade = style === 'glass' ? 'curtain' : 'grid';
  const litChance = rng.range(0.4, 0.65);

  // Room available for the tower (centred in the lot, behind the plaza).
  const maxW = W - 10;
  const maxD = D - plaza - 8;
  const cx = W / 2 + rng.range(-1.5, 1.5);

  // ---------- footprint per design ----------
  const shapePool: Record<TowerDesign, [Shape, number][]> = {
    classic: [['rect', 30], ['chamfer', 20], ['rounded', 15], ['round', 8], ['oval', 8], ['hexagon', 6], ['octagon', 6], ['triangle', 4], ['diamond', 3]],
    spiral: [['triangle', 30], ['rect', 20], ['hexagon', 20], ['rounded', 15], ['diamond', 15]],
    flame: [['round', 35], ['oval', 25], ['hexagon', 20], ['octagon', 20]],
    stacked: [['rect', 50], ['chamfer', 25], ['rounded', 25]],
    rotating: [['rounded', 40], ['oval', 30], ['round', 15], ['rect', 15]],
    yTower: [['hexagon', 1]],
  };
  const shape = rng.weighted(shapePool[design]);
  const square = ['round', 'triangle', 'hexagon', 'octagon', 'diamond'].includes(shape) || design === 'spiral';
  // Flames bulge to 1.2x, rotating plates sweep a circle: leave room.
  const room = design === 'flame' ? 1.22 : design === 'rotating' ? 1.3 : design === 'stacked' ? 1.15 : 1;
  let tw = Math.min(rng.range(22, 34), maxW / room);
  let td = Math.min(rng.range(20, 30), maxD / room);
  if (square) tw = td = Math.min(tw, td);
  if (design === 'rotating') td = Math.min(td, tw);
  const base = footprint(shape, tw, td, rng);

  const hasPodium = (design === 'classic' || design === 'stacked' || design === 'spiral') && rng.chance(0.5);
  const polyMasses: PolyMass[] = [];
  let podium: PolyMass | undefined;
  let baseY = 0;
  let cz: number;
  if (hasPodium) {
    const span = Math.max(tw, td) * room;
    const pw = Math.min(W - 4, span + rng.range(8, 16));
    const pd = Math.min(D - plaza - 5, span + rng.range(6, 12));
    const pf = rng.int(2, 5);
    const pz = plaza + pd / 2;
    podium = {
      poly: xf(footprint('rect', pw, pd, rng), 1, 1, 0, cx, pz),
      baseY: 0, floors: pf, floorHeight: 4.5, facade, frameColor: jitterHex(rng.pick(pal.podium), rng, 0.03),
      lobby: true, roofColor, litChance: 0.6, parapet: true,
    };
    polyMasses.push(podium);
    baseY = pf * 4.5;
    cz = pz + rng.range(0, Math.max(0, (pd - span) / 2 - 1));
  } else {
    cz = plaza + (Math.max(tw, td) * room) / 2 + 1;
  }

  // ---------- design: floor index -> convex polygons (one per component) ----------
  let label: string = design;
  let floorAt: (f: number) => (Pt[] | null)[];
  let plateGap = false; // rotating floors: plates float above a gap that reveals the core
  let spireForced = false;
  const t = (f: number) => f / Math.max(1, floors - 1);

  switch (design) {
    case 'classic': {
      const kind = rng.weighted<Classic>([['straight', 35], ['setbacks', 30], ['taper', 15], ['twist', 20]]);
      label = kind;
      if (kind === 'straight') {
        floorAt = () => [xf(base, 1, 1, 0, cx, cz)];
      } else if (kind === 'setbacks') {
        const tiers = rng.chance(0.5) ? [0.62, 1] : [0.5, 0.8, 1];
        const steps = tiers.map((_, i) => i * rng.range(5, 8));
        floorAt = (f) => {
          const i = tiers.findIndex((b) => t(f) <= b - 1e-9 || b === 1);
          const sx = Math.max(10, tw - steps[i]) / tw;
          const sz = Math.max(10, td - steps[i]) / td;
          return [xf(base, sx, sz, 0, cx, cz)];
        };
      } else if (kind === 'taper') {
        const end = rng.range(0.6, 0.78);
        const tiers = Math.ceil(floors / 3);
        floorAt = (f) => {
          const s = 1 - (Math.floor(f / 3) / Math.max(1, tiers - 1)) * (1 - end);
          return [xf(base, s, s, 0, cx, cz)];
        };
      } else {
        const twist = rng.range(30, 90) * DEG * (rng.chance(0.5) ? 1 : -1);
        floorAt = (f) => [xf(base, 1, 1, twist * t(f), cx, cz)];
      }
      break;
    }
    case 'spiral': {
      // Strong twist, slimming slightly with height.
      const total = rng.range(120, 220) * DEG * (rng.chance(0.5) ? 1 : -1);
      const slim = rng.range(0, 0.2);
      floorAt = (f) => {
        const s = 1 - slim * t(f);
        return [xf(base, s, s, total * t(f), cx, cz)];
      };
      spireForced = rng.chance(0.5);
      break;
    }
    case 'flame': {
      // Swells above the base, then narrows to a point; a gentle twist. Profile quantised in 2-floor steps.
      const bulge = rng.range(0.12, 0.22);
      const tw0 = rng.range(10, 35) * DEG;
      floorAt = (f) => {
        const q = t(Math.floor(f / 2) * 2);
        const s = Math.max(0.22, (1 + bulge * Math.sin(Math.PI * Math.min(1, q * 1.4))) * (1 - 0.72 * Math.pow(q, 2.2)));
        return [xf(base, s, s, tw0 * q, cx, cz)];
      };
      spireForced = true;
      break;
    }
    case 'stacked': {
      // Blocks of 4-8 floors, each shifted (and sometimes turned) like a pile of boxes.
      const blocks: { f0: number; dx: number; dz: number; rot: number; s: number }[] = [];
      const maxOff = Math.max(0, Math.min(5, (maxW - tw) / 2, (maxD - td) / 2));
      for (let f0 = 0; f0 < floors; f0 += rng.int(4, 8)) {
        blocks.push({
          f0,
          dx: f0 === 0 ? 0 : rng.range(-maxOff, maxOff),
          dz: f0 === 0 ? 0 : rng.range(-maxOff, maxOff),
          rot: tw === td && rng.chance(0.3) ? (rng.chance(0.5) ? 15 : -15) * DEG : 0,
          s: f0 === 0 ? 1 : rng.range(0.8, 1.0),
        });
      }
      floorAt = (f) => {
        let blk = blocks[0];
        for (const b of blocks) if (b.f0 <= f) blk = b;
        return [xf(base, blk.s, blk.s, blk.rot, cx + blk.dx, cz + blk.dz)];
      };
      break;
    }
    case 'rotating': {
      // Each floor plate turned to its own angle (a travelling wave) around a fixed round core.
      const amp = rng.range(15, 40) * DEG;
      const waves = rng.range(0.8, 2.2);
      const phase = rng.range(0, Math.PI * 2);
      const drift = rng.range(-40, 40) * DEG;
      const core = regular(12, Math.min(tw, td) * 0.22, Math.min(tw, td) * 0.22, 0);
      floorAt = (f) => [
        xf(core, 1, 1, 0, cx, cz),
        f === 0 ? null : xf(base, 1, 1, amp * Math.sin(phase + t(f) * waves * Math.PI * 2) + drift * t(f), cx, cz),
      ];
      plateGap = true;
      break;
    }
    case 'yTower': {
      // Three wings around a hexagonal core; wings step back in a spiral, the core rises into a spire.
      const ww = rng.range(9, 12);
      const L0 = Math.min(rng.range(16, 24), maxW / 2 - 1, maxD / 2 - 1);
      const rc = ww * 0.8;
      const steps = rng.int(5, 7);
      const rot0 = -Math.PI / 2 + (rng.chance(0.5) ? Math.PI / 3 : 0);
      const coreTop = 1; // core runs the full height
      const wingsEnd = rng.range(0.7, 0.85);
      const core = regular(6, rc, rc, Math.PI / 6);
      floorAt = (f) => {
        const q = t(f);
        const out: (Pt[] | null)[] = [q <= coreTop ? xf(core, 1, 1, 0, cx, cz) : null];
        for (let i = 0; i < 3; i++) {
          const level = Math.floor((q / wingsEnd) * steps + i / 3);
          const len = L0 * (1 - level / (steps + 0.5));
          out.push(len > rc * 1.15 && q < wingsEnd ? xf(wing(len, ww, rot0 + (i * 2 * Math.PI) / 3), 1, 1, 0, cx, cz) : null);
        }
        return out;
      };
      spireForced = true;
      break;
    }
  }

  // ---------- run-length merge: identical consecutive floors become one PolyMass ----------
  const lobbyHere = !hasPodium;
  const runs: ({ poly: Pt[]; f0: number; n: number } | null)[] = [];
  const flush = (r: { poly: Pt[]; f0: number; n: number }, comp: number) => {
    const gap = plateGap && comp === 1 ? 0.45 : 0;
    polyMasses.push({
      poly: r.poly, baseY: baseY + r.f0 * fh + gap, floors: r.n, floorHeight: fh - (gap && r.n === 1 ? gap : 0),
      facade: plateGap && comp === 0 ? 'grid' : facade, frameColor: plateGap && comp === 0 ? '#5a5d61' : frame,
      lobby: lobbyHere && r.f0 === 0, roofColor, litChance, parapet: false,
    });
  };
  for (let f = 0; f < floors; f++) {
    const comps = floorAt(f);
    const n = Math.max(comps.length, runs.length);
    for (let c = 0; c < n; c++) {
      const p = comps[c] ?? null;
      const r = runs[c] ?? null;
      if (r && p && samePoly(r.poly, p)) {
        r.n++;
        continue;
      }
      if (r) flush(r, c);
      runs[c] = p ? { poly: p, f0: f, n: 1 } : null;
    }
  }
  runs.forEach((r, c) => r && flush(r, c));

  // Fit to the lot: twisted corners, flame bulges and rotating plates reach further than the base
  // footprint. Shrink the whole tower about its axis until every floor is inside (keeps the plaza clear).
  const towerMasses = polyMasses.filter((m) => m !== podium);
  {
    const xMin = 1.5, xMax = W - 1.5, zMin = plaza * 0.75, zMax = D - 7;
    let k = 1;
    for (const m of towerMasses) {
      for (const [x, z] of m.poly) {
        const dx = x - cx;
        const dz = z - cz;
        if (dx > 1e-9) k = Math.min(k, (xMax - cx) / dx);
        else if (dx < -1e-9) k = Math.min(k, (xMin - cx) / dx);
        if (dz > 1e-9) k = Math.min(k, (zMax - cz) / dz);
        else if (dz < -1e-9) k = Math.min(k, (zMin - cz) / dz);
      }
    }
    if (k < 1) for (const m of towerMasses) m.poly = m.poly.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k] as Pt);
  }

  // The highest volume carries the crown.
  const topOf = (m: PolyMass) => m.baseY + m.floors * m.floorHeight;
  const top = towerMasses.reduce((a, b) => (topOf(b) >= topOf(a) ? b : a));
  const topY = topOf(top);
  const tcx = top.poly.reduce((s, p) => s + p[0], 0) / top.poly.length;
  const tcz = top.poly.reduce((s, p) => s + p[1], 0) / top.poly.length;
  const rIn = innerRadius(top.poly, tcx, tcz);

  // ---------- crown ----------
  const masses: Mass[] = [];
  const props: Prop[] = [];
  const crown: Crown = spireForced
    ? 'spire'
    : rng.weighted<Crown>([['plant', 50], ['helipad', floors >= 28 && rIn >= 8 ? 25 : 0], ['spire', 25]]);
  top.parapet = crown !== 'helipad' && design !== 'flame';
  top.crownLight = style === 'glass' && rng.chance(0.45);
  let spireH = 0;
  if (crown === 'plant') {
    const s = Math.min(rIn * 1.2, 12);
    masses.push({
      id: 0, kind: 'roofRoom', rect: { x0: tcx - s / 2, x1: tcx + s / 2, z0: tcz - s / 2, z1: tcz + s / 2 }, baseY: topY, floors: 1,
      floorHeight: rng.range(3.5, 5), wallColor: jitterHex(frame, rng, 0.05), plinth: false,
      roof: { type: 'flat', pitch: 0, axis: 'x', overhang: 0.2, gableOverhang: 0, highSide: 1, color: roofColor, parapet: false },
    });
  } else if (crown === 'helipad') {
    props.push({ kind: 'helipad', x: tcx, y: topY + 0.02, z: tcz, rot: 0, color: '#3b3e42', color2: '#f2c94c', w: Math.min(rIn * 0.85, 9) });
  } else {
    spireH = design === 'yTower' ? rng.range(35, 70) : design === 'flame' ? rng.range(15, 35) : rng.range(12, 40);
    props.push({ kind: 'spire', x: tcx, y: topY + 0.02, z: tcz, rot: 0, color: '#c9ccd1', color2: frame, w: Math.max(0.6, Math.min(rIn * 0.3, 2.5)), h: spireH });
  }

  // ---------- rooftop equipment ----------
  // Everything is placed inside the roof outline, clear of the centre piece (plant room / helipad / spire),
  // of the parapet and of each other.
  const lights: Light[] = [];
  const roofY = topY + 0.02;
  const centreR =
    crown === 'plant' ? Math.min(rIn * 1.2, 12) * 0.71 + 0.4 : crown === 'helipad' ? Math.min(rIn * 0.85, 9) + 0.6 : Math.max(0.6, Math.min(rIn * 0.3, 2.5)) * 2 + 0.6;
  const taken: { x: number; z: number; r: number }[] = [{ x: tcx, z: tcz, r: centreR }];
  /** Random spot inside the roof with clearance r; returns the nearest-edge outward normal too. */
  const roofSpot = (r: number) => {
    for (let a = 0; a < 40; a++) {
      const ang = rng.range(0, Math.PI * 2);
      const rad = rng.range(0, rIn);
      const x = tcx + Math.cos(ang) * rad;
      const z = tcz + Math.sin(ang) * rad;
      const edge = edgeInfo(top.poly, x, z);
      if (!edge || edge.dist < r + 0.5) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r + 0.4)) continue;
      taken.push({ x, z, r });
      return { x, z, ...edge };
    }
    return null;
  };
  const put = (kind: Prop['kind'], r: number, chance: number, extra: (s: NonNullable<ReturnType<typeof roofSpot>>) => Partial<Prop>) => {
    if (!rng.chance(chance)) return;
    const s = roofSpot(r);
    if (s) props.push({ kind, x: s.x, y: roofY, z: s.z, rot: 0, color: '#cfd2d4', ...extra(s) });
  };
  const steel = '#b8bcc0';
  // Big lit rooftop sign facing the street (needs a long straight front edge).
  if (crown !== 'helipad' && rIn > 7 && rng.chance(0.25)) {
    const w = Math.min(rIn * 1.3, 14);
    const z = tcz - rIn + 1.4; // just behind the front parapet
    const r = { x0: tcx - w / 2, x1: tcx + w / 2, z0: z - 0.3, z1: z + 1.4 };
    const corners = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]];
    const fits = corners.every(([x, zz]) => (edgeInfo(top.poly, x, zz)?.dist ?? 0) > 0.4);
    // Rectangle vs. circle clearance against everything already on the roof.
    const clear = taken.every((t) => Math.hypot(t.x - Math.max(r.x0, Math.min(t.x, r.x1)), t.z - Math.max(r.z0, Math.min(t.z, r.z1))) > t.r + 0.3);
    if (fits && clear) {
      taken.push({ x: tcx, z: z + 0.5, r: w / 2 });
      props.push({ kind: 'roofSign', x: tcx, y: roofY, z, rot: 0, color: rng.pick(['#c0392b', '#1f6fb5', '#ffffff', '#f1c40f', '#26282b']), w, h: rng.range(2, 3.2) });
    }
  }
  if (crown === 'plant') {
    // Plant: AC condensers or cooling towers around the plant room.
    const cooling = rng.chance(0.4);
    for (let i = rng.int(3, 6); i > 0; i--) put(cooling ? 'coolingTower' : 'acUnit', cooling ? 1.5 : 0.7, 1, (s) => ({ rot: rotFromNormal(s.nx, s.nz), color: cooling ? '#d9dbdc' : '#cfd2d4', color2: '#9aa0a6' }));
  }
  put('cellTower', 1.2, 0.3, () => ({ color: steel, h: rng.range(10, 18) }));
  put('antennaCluster', 1.4, 0.35, () => ({ color: steel, h: rng.range(6, 12) }));
  for (let i = rng.chance(0.3) ? rng.int(1, 2) : 0; i > 0; i--) put('bigDish', 1.8, 1, (s) => ({ rot: rotFromNormal(s.nx, s.nz), color: '#eeeeea', color2: '#9aa0a6', w: rng.range(1.2, 1.8) }));
  // Window-cleaning crane: parked near an edge with its arm reaching out over it.
  put('bmu', 1.2, 0.35, (s) => ({ rot: rotFromNormal(s.nx, s.nz), color: '#e9e6df', color2: '#c0392b', w: s.dist + 1.4 }));
  put('flagpole', 0.4, 0.15, () => ({ color: rng.pick(['#c0392b', '#1f6fb5', '#27ae60', '#f1c40f', '#ffffff']), color2: rng.pick(['#ffffff', '#2c3e50', '#c0392b']), h: rng.range(6, 9) }));
  // Red aviation obstruction lights on the corners of tall towers.
  if (topY > 60) {
    const n = top.poly.length;
    const step = Math.max(1, Math.round(n / 4));
    const y = top.parapet ? topY + 1.1 : roofY;
    for (let i = 0; i < n; i += step) {
      const [x, z] = top.poly[i];
      lights.push({ kind: 'aviation', x: x + (tcx - x) * 0.04, y, z: z + (tcz - z) * 0.04, rot: 0 });
    }
  }

  // ---------- plaza ----------
  const groundPolys = podium ? [podium.poly] : polyMasses.filter((m) => m.baseY < baseY + fh * 0.5).map((m) => m.poly);
  const frontAtCx = frontZAt(groundPolys, cx) ?? plaza;
  // Overhanging floors (flame bulge, rotating plates, shifted stacks) count for the plaza and yard edges.
  const allPts = polyMasses.flatMap((m) => m.poly);
  const frontZ = Math.min(...allPts.map((p) => p[1]));
  const backZ = Math.max(...allPts.map((p) => p[1]));
  const paths: Rect[] = [{ x0: cx - 3, x1: cx + 3, z0: 0, z1: frontAtCx }];
  const porches: Porch[] = [{ kind: 'canopy', rect: { x0: cx - 4.5, x1: cx + 4.5, z0: frontAtCx - 3, z1: frontAtCx }, floorY: 0, roofY: 4.2, stepX: cx, floorColor: pavingColor, roofColor: '#2f3236', postColor: frame }];
  const trees: Tree[] = [];
  let pool: Rect | undefined;
  if (rng.chance(0.35)) {
    const side = rng.chance(0.5) ? 1 : -1;
    const fw = rng.range(5, 8);
    const x0 = side > 0 ? cx + 5 : cx - 5 - fw;
    if (x0 > 2 && x0 + fw < W - 2 && frontZ > 6) pool = { x0, x1: x0 + fw, z0: frontZ * 0.3, z1: frontZ * 0.3 + Math.min(3.5, frontZ * 0.4) };
  }
  // Trees in a row across the plaza, benches facing the street between them.
  const treeZ = frontZ * 0.55;
  for (let x = 4; x < W - 3; x += rng.range(7, 9)) {
    if (Math.abs(x - cx) < 5.5) continue;
    if (pool && x > pool.x0 - 2.5 && x < pool.x1 + 2.5) continue;
    trees.push({ kind: 'round', x, z: treeZ, scale: rng.range(0.9, 1.15), rot: rng.range(0, 6.28), color: jitterHex('#5a8838', rng, 0.06), trunkColor: '#6b4a33' });
    if (x + 4 < W - 3 && Math.abs(x + 4 - cx) > 5.5 && rng.chance(0.6 * details.props)) props.push({ kind: 'bench', x: x + 4, y: 0, z: treeZ, rot: 0, color: '#2b2b2b' });
  }
  for (let z = 2; z < frontAtCx - 3.5; z += 3) for (const s of [-1, 1]) lights.push({ kind: 'bollard', x: cx + s * 3.4, y: 0, z, rot: 0 });
  for (const x of [2.5, W - 2.5]) lights.push({ kind: 'post', x, y: 0, z: 1.5, rot: 0 });

  // Service yard behind: parked cars.
  const placer = new YardPlacer(rng, W, D, [{ x0: 0, x1: W, z0: 0, z1: backZ }]);
  if (D - backZ > 6.5) {
    for (let x = 2.5; x < W - 2.5; x += 3.2) {
      if (!rng.chance(details.cars * 0.8)) continue;
      addCar({ rng, W, D, masses, facade: null as never, placer, props, lights, details: { ...details, cars: 1 } }, { x0: x - 1.2, x1: x + 1.2, z0: D - 6, z1: D - 0.5 });
    }
  }

  const streetTreeXs: number[] = [];
  for (let sx = rng.range(3, 6); sx < W - 2; sx += rng.range(9, 11)) if (Math.abs(sx - cx) > 5) streetTreeXs.push(sx);

  const height = topY + spireH + (crown === 'plant' ? 5 : 1);
  return {
    seed: spec.seed,
    style,
    lot: { width: W, depth: D },
    lawnColor: pavingColor,
    trimColor: frame,
    foundationColor: '#8f8a83',
    pavingColor: jitterHex(pavingColor, rng, 0.08),
    masses,
    openings: [],
    porches,
    chimneys: [],
    driveways: [],
    paths,
    fences: [],
    trees,
    pool,
    balconies: [],
    paved: true,
    polyMasses,
    height,
    props,
    lights,
    streetTreeXs,
    info: {
      type: 'office tower',
      style,
      design: label + (podium ? ' + podium' : ''),
      footprint: design === 'yTower' ? 'Y (3 wings + core)' : shape,
      floors: floors + (podium ? podium.floors : 0),
      height: `${Math.round(height)} m`,
      volumes: polyMasses.length,
      crown: crown + (top.crownLight ? ' + lit crown' : ''),
      plaza: summarizeProps(props.filter((p) => p.y < 1)) + (pool ? ', fountain' : ''),
      lot: `${W.toFixed(1)} × ${D.toFixed(1)} m`,
    },
  };
}
