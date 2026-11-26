/**
 * Terrain generator for a planned region: a coastline with a waterfront main city, two small towns linked
 * to it by highways, farmland beside one town, an island district joined to the city by a road-and-rail
 * bridge, a single detailed mountain, a few lakes and small islands. Plain data only; terrain/mesh.ts turns
 * it into geometry.
 *
 * Coordinates: x, z in metres in [-size/2, size/2]; y is height above sea level (sea level = 0).
 */
import { Noise2D, smoothstep } from './noise';

export interface TerrainParams {
  seed: number;
  /** Map edge length in metres. */
  size: number;
  /** Samples per side (2^n + 1). */
  res: number;
  /** 0 = no mountain, 1 = tallest. */
  mountain: number;
  /** Rough share of the map that is land (0.45..0.8). */
  landShare: number;
  /** 0..1 how ragged the coastline is. */
  coastRoughness: number;
  /** Small offshore islands (besides the island district). */
  islands: number;
  lakes: number;
}

export const DEFAULT_TERRAIN: TerrainParams = {
  seed: 1, size: 3072, res: 513, mountain: 0.8, landShare: 0.62, coastRoughness: 0.5, islands: 2, lakes: 2,
};

export type SiteKind = 'city' | 'town' | 'farm' | 'island';
export interface Site {
  kind: SiteKind;
  name: string;
  x: number;
  z: number;
  /** Nominal radius; the real edge is `outline`. */
  r: number;
  outline: [number, number][];
  /** Farm only: field grid orientation and field size. */
  fieldAngle?: number;
  fieldW?: number;
  fieldD?: number;
}
export interface LinkPoint { x: number; z: number; y: number }
export interface Link {
  kind: 'highway' | 'bridge';
  /** Indices into `sites`. */
  from: number;
  to: number;
  width: number;
  pts: LinkPoint[];
  /** Bridge only: carries a rail track beside the road. */
  rail?: boolean;
}
export interface Lake {
  x: number;
  z: number;
  r: number;
  level: number;
  /** Shoreline polygon that follows the carved bowl (just inside the raised lip). */
  outline: [number, number][];
}
export interface Island { x: number; z: number; r: number; h: number; district?: boolean }
export interface Mountain { x: number; z: number; r: number; h: number }
/** Tree instances: [x, y, z, scale, kind] per tree; kind 0 broadleaf, 1 conifer, 2 palm. */
export type TreeData = Float32Array;

/** Per-sample zone codes. */
export const ZONE = { none: 0, city: 1, town: 2, farm: 3, island: 4, road: 5 } as const;

export interface TerrainMap {
  params: TerrainParams;
  size: number;
  res: number;
  cell: number;
  heights: Float32Array;
  moisture: Float32Array;
  /** Per sample: 0 dry, 1 sea, 2 lake. */
  water: Uint8Array;
  /** Per sample: ZONE code. */
  zone: Uint8Array;
  sites: Site[];
  links: Link[];
  lakes: Lake[];
  islands: Island[];
  mountain: Mountain | null;
  trees: TreeData;
  /** Base height (no lakes / islands / grading) at any world (x, z), including outside the map. */
  horizon: (x: number, z: number) => number;
  /** Unit vector pointing out to sea. */
  seaDir: [number, number];
  maxHeight: number;
  /** Generation time in ms. */
  ms: number;
}

// ---------------------------------------------------------------- sampling helpers (also used by the city later)

/** Bilinear height at world (x, z). */
export function heightAt(map: TerrainMap, x: number, z: number): number {
  return sampleH(map.heights, map.res, map.size, map.cell, x, z);
}

function sampleH(H: Float32Array, res: number, size: number, cell: number, x: number, z: number): number {
  const fx = Math.max(0, Math.min(res - 1.001, (x + size / 2) / cell));
  const fz = Math.max(0, Math.min(res - 1.001, (z + size / 2) / cell));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const a = H[j * res + i];
  const b = H[j * res + i + 1];
  const c = H[(j + 1) * res + i];
  const d = H[(j + 1) * res + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/** Gradient magnitude (rise / run) at world (x, z). */
export function slopeAt(map: TerrainMap, x: number, z: number): number {
  const e = map.cell;
  const dx = (heightAt(map, x + e, z) - heightAt(map, x - e, z)) / (2 * e);
  const dz = (heightAt(map, x, z + e) - heightAt(map, x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

function sampleIndex(map: TerrainMap, x: number, z: number): number {
  const i = Math.max(0, Math.min(map.res - 1, Math.round((x + map.size / 2) / map.cell)));
  const j = Math.max(0, Math.min(map.res - 1, Math.round((z + map.size / 2) / map.cell)));
  return j * map.res + i;
}

export function waterAt(map: TerrainMap, x: number, z: number): 'sea' | 'lake' | null {
  const w = map.water[sampleIndex(map, x, z)];
  return w === 1 ? 'sea' : w === 2 ? 'lake' : null;
}

export function zoneAt(map: TerrainMap, x: number, z: number): number {
  return map.zone[sampleIndex(map, x, z)];
}

export function inPolygon(x: number, z: number, pts: [number, number][]): boolean {
  let c = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const [xa, za] = pts[a];
    const [xb, zb] = pts[b];
    if (za > z !== zb > z && x < ((xb - xa) * (z - za)) / (zb - za) + xa) c = !c;
  }
  return c;
}

/** Dry, gentle and not on a road: where buildings can go. */
export function buildable(map: TerrainMap, x: number, z: number): boolean {
  const h = heightAt(map, x, z);
  return h > 1.5 && slopeAt(map, x, z) < 0.12 && !waterAt(map, x, z) && zoneAt(map, x, z) !== ZONE.road;
}

/** Farm field under a point: a stable id per field and whether the point is on a field boundary. */
export function fieldAt(site: Site, x: number, z: number): { id: number; edge: boolean } {
  const a = site.fieldAngle ?? 0;
  const dx = x - site.x;
  const dz = z - site.z;
  const u = (dx * Math.cos(a) + dz * Math.sin(a)) / (site.fieldW ?? 60);
  const v = (-dx * Math.sin(a) + dz * Math.cos(a)) / (site.fieldD ?? 40);
  // Rows are staggered so the patchwork doesn't look like a chessboard.
  const row = Math.floor(v);
  const uu = u + (((row * 0.618) % 1) + 1) % 1;
  const col = Math.floor(uu);
  const fu = uu - col;
  const fv = v - row;
  const id = ((col * 73856093) ^ (row * 19349663)) >>> 0;
  return { id, edge: fu < 0.06 || fv < 0.08 };
}

// ---------------------------------------------------------------- generation

const PREFIX = ['Shah', 'Noor', 'Gul', 'Saba', 'Rahim', 'Zar', 'Mehr', 'Bahar', 'Qasim', 'Sahil', 'Chand', 'Sitara', 'Darya', 'Kohi', 'Bagh'];
const SUFFIX = ['abad', 'pur', 'kot', 'garh', 'nagar'];

export function generateTerrain(params: TerrainParams): TerrainMap {
  const t0 = performance.now();
  const { size, res, seed } = params;
  const half = size / 2;
  const cell = size / (res - 1);
  const N = res * res;
  const noise = new Noise2D(seed);
  const n2 = new Noise2D(seed * 7 + 3);
  let rs = (seed * 2654435761) >>> 0 || 1;
  const rand = () => {
    rs ^= rs << 13;
    rs ^= rs >>> 17;
    rs ^= rs << 5;
    return (rs >>> 0) / 4294967296;
  };
  const theta = rand() * Math.PI * 2;
  const sea: [number, number] = [Math.cos(theta), Math.sin(theta)];
  const along: [number, number] = [-sea[1], sea[0]];
  const shift = (params.landShare - 0.5) * 1.4;
  const X = (i: number) => -half + i * cell;
  const P = (s: number, t: number): [number, number] => [s * sea[0] + t * along[0], s * sea[1] + t * along[1]];
  const names = new Set<string>();
  const name = () => {
    for (;;) {
      const n = PREFIX[Math.floor(rand() * PREFIX.length)] + SUFFIX[Math.floor(rand() * SUFFIX.length)];
      if (!names.has(n)) {
        names.add(n);
        return n;
      }
    }
  };

  // ---- coast field: > 0 land, < 0 sea (u, v in [-1, 1] across the map, valid outside it too)
  const coast = (x: number, z: number): number => {
    const u = x / half;
    const v = z / half;
    const d = u * sea[0] + v * sea[1];
    return -(d - shift) + params.coastRoughness * 0.26 * noise.warp(u * 1.6, v * 1.6, 0.7, 4) + 0.035 * noise.fbm(u * 6, v * 6, 3);
  };
  const coastS = (t: number): number => {
    for (let s = half * 1.6; s > -half * 1.6; s -= 6) {
      const [x, z] = P(s, t);
      if (coast(x, z) > 0) return s;
    }
    return -half;
  };
  const landFrac = (x: number, z: number, r: number): number => {
    let n = 0;
    let ok = 0;
    for (const f of [0, 0.45, 0.85]) {
      const m = f === 0 ? 1 : 12;
      for (let q = 0; q < m; q++) {
        const a = (q / m) * Math.PI * 2;
        n++;
        if (coast(x + Math.cos(a) * r * f, z + Math.sin(a) * r * f) > 0.03) ok++;
      }
    }
    return ok / n;
  };
  const inMap = (x: number, z: number, m: number) => Math.abs(x) < half - m && Math.abs(z) < half - m;

  // ---- 1. Layout: main city, island district, two towns, farmland, mountain.
  const sites: Site[] = [];
  const mkSite = (kind: SiteKind, nm: string, x: number, z: number, r: number): Site => {
    const s: Site = { kind, name: nm, x, z, r, outline: [] };
    const off = rand() * 100;
    for (let q = 0; q < 56; q++) {
      const a = (q / 56) * Math.PI * 2;
      const rr = r * siteWarp(off, a);
      s.outline.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]);
    }
    (s as Site & { off: number }).off = off;
    sites.push(s);
    return s;
  };
  const siteWarp = (off: number, a: number) => 1 + 0.15 * noise.fbm(Math.cos(a) * 1.1 + off, Math.sin(a) * 1.1 - off, 3);
  const siteDn = (s: Site, x: number, z: number) => {
    const a = Math.atan2(z - s.z, x - s.x);
    return Math.hypot(x - s.x, z - s.z) / (s.r * siteWarp((s as Site & { off: number }).off, a));
  };

  // Main city: on the coast, with a waterfront.
  const Rm = 470 + rand() * 90;
  let tm = (rand() - 0.5) * 0.3 * size;
  let city: Site | null = null;
  for (let k = 0; k < 12 && !city; k++) {
    const [x, z] = P(coastS(tm) - Rm * 0.7, tm);
    if (inMap(x, z, Rm * 0.85 + 80)) city = mkSite('city', name(), x, z, Rm);
    else tm *= 0.6;
  }
  if (!city) {
    const [x, z] = P(coastS(0) - Rm * 0.7, 0);
    city = mkSite('city', name(), x, z, Rm);
  }

  // Island district: offshore in front of the city.
  let Ri = 190 + rand() * 70;
  const ti = tm + (rand() - 0.5) * 0.5 * Rm;
  const sci = coastS(ti);
  let gap = 230 + rand() * 110;
  let si = sci + gap + Ri;
  const sMax = half - Ri * 1.35 - 90;
  if (si > sMax) {
    const over = si - sMax;
    gap = Math.max(150, gap - over);
    si = sci + gap + Ri;
    if (si > sMax) Ri = Math.max(130, Ri - (si - sMax));
    si = Math.min(si, sci + gap + Ri);
  }
  const [ix, iz] = P(si, ti);
  const islandSite = mkSite('island', `${name().replace(/(abad|pur|kot|garh|nagar)$/, '')} Island`, ix, iz, Ri * 0.68);
  const district: Island = { x: ix, z: iz, r: Ri, h: 7 + rand() * 3, district: true };

  // Two towns, a fair way from the city and from each other.
  const towns: Site[] = [];
  for (let relax = 0; relax < 4 && towns.length < 2; relax++) {
    const k = 1 - relax * 0.2;
    for (let attempt = 0; attempt < 500 && towns.length < 2; attempt++) {
      const Rt = 180 + rand() * 70;
      const x = (rand() * 2 - 1) * (half - Rt - 180);
      const z = (rand() * 2 - 1) * (half - Rt - 180);
      if (coast(x, z) < 0.06 || landFrac(x, z, Rt) < 0.85) continue;
      const dc = Math.hypot(x - city.x, z - city.z);
      if (dc < (city.r + Rt + 300) * k || dc > city.r + Rt + 1150) continue;
      if (Math.hypot(x - ix, z - iz) < (Ri + Rt + 300) * k) continue;
      if (towns.some((o) => Math.hypot(o.x - x, o.z - z) < (o.r + Rt + 420) * k)) continue;
      towns.push(mkSite('town', name(), x, z, Rt));
    }
  }

  // Farmland beside one of the towns (or anywhere it fits).
  let farm: Site | null = null;
  const others = () => sites.filter((s) => s.kind !== 'farm');
  for (let attempt = 0; attempt < 700 && !farm; attempt++) {
    const Rf = 300 + rand() * 110;
    let x: number;
    let z: number;
    if (towns.length && attempt < 450) {
      const t = towns[attempt % towns.length];
      const a = rand() * Math.PI * 2;
      const d = t.r + Rf + 80 + rand() * 160;
      x = t.x + Math.cos(a) * d;
      z = t.z + Math.sin(a) * d;
    } else {
      x = (rand() * 2 - 1) * (half - Rf);
      z = (rand() * 2 - 1) * (half - Rf);
    }
    if (!inMap(x, z, Rf * 0.9 + 110)) continue;
    if (coast(x, z) < 0.08 || landFrac(x, z, Rf) < 0.8) continue;
    if (others().some((o) => Math.hypot(o.x - x, o.z - z) < o.r + Rf + 100)) continue;
    farm = mkSite('farm', `${name()} Farms`, x, z, Rf);
    farm.fieldAngle = rand() * Math.PI;
    farm.fieldW = 55 + rand() * 30;
    farm.fieldD = 32 + rand() * 18;
  }

  // One mountain, as far from everything as it can be, wholly inside the map (where the detail is).
  let mountain: Mountain | null = null;
  if (params.mountain > 0) {
    let R = 480 + rand() * 140;
    let Hm = 200 + 260 * params.mountain;
    for (let tries = 0; tries < 6 && !mountain; tries++) {
      let best: Mountain | null = null;
      let bestScore = 25;
      for (let q = 0; q < 500; q++) {
        const x = (rand() * 2 - 1) * (half - R * 0.95 - 40);
        const z = (rand() * 2 - 1) * (half - R * 0.95 - 40);
        if (coast(x, z) < 0.3) continue;
        const score = Math.min(...sites.map((s) => Math.hypot(s.x - x, s.z - z) - s.r * 1.15 - R * 0.95));
        if (score > bestScore) {
          bestScore = score;
          best = { x, z, r: R, h: Hm };
        }
      }
      mountain = best;
      R *= 0.85;
      Hm *= 0.92;
    }
  }
  const mountainAt = (x: number, z: number): number => {
    if (!mountain) return 0;
    const M = mountain;
    const dx = x - M.x;
    const dz = z - M.z;
    const raw = Math.hypot(dx, dz) / M.r;
    if (raw > 1.6) return 0;
    const d = raw * (1 + 0.22 * n2.fbm((x / M.r) * 1.2 + 4, (z / M.r) * 1.2 - 2, 3));
    if (d >= 1.15) return 0;
    const prof = smoothstep(1.15, 0, d);
    const core = Math.pow(prof, 1.5);
    // Spurs and ridges radiating from the summit, plus finer rock detail.
    const ridge = n2.ridged((x / M.r) * 2.3 + 3, (z / M.r) * 2.3 - 1, 6, 2.1, 0.5);
    const fine = noise.fbm(x * 0.012, z * 0.012, 4);
    return M.h * core * (0.62 + 0.5 * ridge) + 14 * prof * fine;
  };

  // ---- 2. Heights: coastal ramp + hills (smoothed out inside the sites) + the mountain.
  const hillsAt = (x: number, z: number, c: number, flat: number): number => {
    const u = x / half;
    const v = z / half;
    const outside = Math.max(0, Math.max(Math.abs(u), Math.abs(v)) - 1);
    const amp = 13 * smoothstep(0.03, 0.25, c) + 90 * smoothstep(0.05, 1.2, outside) * smoothstep(0.05, 0.3, c);
    return noise.fbm(u * 4.5 + 11, v * 4.5 - 7, 5) * amp * (1 - flat);
  };
  const seaFloor = (x: number, z: number, c: number): number => {
    const dd = -c;
    return -(40 * dd + 260 * Math.pow(Math.max(0, dd - 0.15), 1.5)) + 4 * noise.fbm((x / half) * 9, (z / half) * 9, 3) * smoothstep(0, 0.08, dd);
  };
  const base = (x: number, z: number, flat = 0): number => {
    const c = coast(x, z);
    if (c < 0) return seaFloor(x, z, c);
    return 46 * Math.min(c, 2.5) + hillsAt(x, z, c, flat) + mountainAt(x, z);
  };

  const H = new Float32Array(N);
  const C = new Float32Array(N);
  const F = new Float32Array(N); // flatness: 1 inside city / town, 0.75 in farmland
  for (const s of sites) {
    if (s.kind === 'island') continue;
    const reach = s.r * 1.6;
    const strength = s.kind === 'farm' ? 0.75 : 1;
    forDisc(res, size, cell, s.x, s.z, reach, (k, x, z) => {
      const f = strength * smoothstep(1.32, 0.92, siteDn(s, x, z));
      if (f > F[k]) F[k] = f;
    });
  }
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const k = j * res + i;
      const x = X(i);
      const z = X(j);
      C[k] = coast(x, z);
      H[k] = base(x, z, F[k]);
    }
  }

  // ---- 3. Mountain detail: hydraulic erosion carves gullies and fans; light thermal erosion tidies scree.
  if (mountain) {
    const r = mountain.r * 1.2;
    const i0 = Math.max(2, Math.floor((mountain.x - r + half) / cell));
    const i1 = Math.min(res - 3, Math.ceil((mountain.x + r + half) / cell));
    const j0 = Math.max(2, Math.floor((mountain.z - r + half) / cell));
    const j1 = Math.min(res - 3, Math.ceil((mountain.z + r + half) / cell));
    if (i1 > i0 + 8 && j1 > j0 + 8) {
      const drops = Math.round((i1 - i0) * (j1 - j0) * 1.1);
      hydraulicErosion(H, res, cell, rand, i0, i1, j0, j1, drops);
      thermalErosion(H, res, cell, 1.15, 12, i0, i1, j0, j1);
    }
  }

  // ---- 4. Islands: the district (flat top, beach ring) and a few small wild ones.
  const islands: Island[] = [district];
  for (let k = 0; k < params.islands * 60 && islands.length < params.islands + 1; k++) {
    const r = 45 + rand() * 75;
    const x = (rand() * 2 - 1) * (half - r * 1.4 - 120);
    const z = (rand() * 2 - 1) * (half - r * 1.4 - 120);
    const c = coast(x, z);
    if (c > -0.12 || c < -0.7) continue;
    if (islands.some((o) => Math.hypot(o.x - x, o.z - z) < o.r * 1.3 + r * 1.4 + 160)) continue;
    if (distToSeg(x, z, ix, iz, city.x, city.z) < r * 1.4 + 120) continue; // keep the bridge line clear
    islands.push({ x, z, r, h: 8 + rand() * 26 });
  }
  for (const isl of islands) {
    const off = rand() * 50;
    forDisc(res, size, cell, isl.x, isl.z, isl.r * 1.6, (k, x, z) => {
      const a = Math.atan2(z - isl.z, x - isl.x);
      const dn = (Math.hypot(x - isl.x, z - isl.z) / isl.r) * (1 + 0.2 * noise.fbm(Math.cos(a) * 1.4 + off, Math.sin(a) * 1.4 - off, 3));
      if (dn > 1.45) return;
      let hi: number;
      if (isl.district) {
        // Plateau for buildings, a short bank, then a gentle beach into the water.
        if (dn < 0.7) hi = isl.h + 0.6 * noise.fbm(x * 0.01, z * 0.01, 2);
        else if (dn < 0.86) hi = 2.6 + (isl.h - 2.6) * smoothstep(0.86, 0.7, dn);
        else if (dn < 1) hi = 2.6 * ((1 - dn) / 0.14);
        else hi = -14 * smoothstep(1, 1.45, dn);
      } else {
        const prof = smoothstep(1.3, 0, dn);
        const hill = (0.6 + 0.4 * noise.fbm(x * 0.006, z * 0.006, 4)) * isl.h;
        hi = -18 + (hill + 18) * Math.pow(prof, 1.5);
      }
      H[k] = isl.district && dn < 1 ? hi : Math.max(H[k], hi);
    });
  }

  // ---- 5. Highways from the city to each town (paths first; grading after the lakes are placed).
  const hAt = (x: number, z: number) => sampleH(H, res, size, cell, x, z);
  const links: Link[] = [];
  const cityIdx = sites.indexOf(city);
  for (const t of towns) {
    const pts = routeHighway(city, t, rand, coast, mountainAt, mountain);
    links.push({ kind: 'highway', from: cityIdx, to: sites.indexOf(t), width: 10, pts: profile(pts, hAt, 18, 2.2) });
  }

  // ---- 6. Lakes, clear of the sites, the roads, the bridge line and the mountain's core.
  const lakes: Lake[] = [];
  const clearOf = (x: number, z: number, r: number): boolean => {
    if (!inMap(x, z, r * 1.8 + 60)) return false;
    if (sites.some((s) => Math.hypot(s.x - x, s.z - z) < s.r * 1.15 + r * 1.6 + 40)) return false;
    if (mountain && Math.hypot(mountain.x - x, mountain.z - z) < mountain.r * 0.85 + r) return false;
    if (links.some((l) => l.pts.some((p) => Math.hypot(p.x - x, p.z - z) < r * 1.9 + 30))) return false;
    if (distToSeg(x, z, ix, iz, city.x, city.z) < r * 2.3 + 60) return false;
    return true;
  };
  for (let k = 0; k < params.lakes * 250 && lakes.length < params.lakes; k++) {
    const r = 60 + rand() * 80;
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    if (coast(x, z) < 0.12 || !clearOf(x, z, r)) continue;
    if (lakes.some((o) => Math.hypot(o.x - x, o.z - z) < (o.r + r) * 1.8)) continue;
    let rim = Infinity;
    let peak = -Infinity;
    for (let a = 0; a < 24; a++) {
      const hh = hAt(x + Math.cos((a / 24) * Math.PI * 2) * r * 1.25, z + Math.sin((a / 24) * Math.PI * 2) * r * 1.25);
      rim = Math.min(rim, hh);
      peak = Math.max(peak, hh);
    }
    if (peak - rim > 40 || rim < 4) continue;
    lakes.push({ x, z, r, level: rim - 1.0, outline: [] });
  }
  for (const l of lakes) carveLake(l, H, res, size, cell, n2);

  // ---- 7. Grade the highways into the ground; build the bridge and grade its landings.
  const road = new Float32Array(N).fill(Infinity); // distance to the nearest road centreline
  for (const l of links) gradeRoad(l.pts, l.width, H, road, res, size, cell);
  {
    // Walk from the island towards the city: leave the island, cross the water, land on the mainland.
    const dx = city.x - ix;
    const dz = city.z - iz;
    const L = Math.hypot(dx, dz);
    const ux = dx / L;
    const uz = dz / L;
    let leave = -1;
    let land = -1;
    for (let s = 0; s < L; s += 3) {
      const h = hAt(ix + ux * s, iz + uz * s);
      if (leave < 0 && h < 0.5) leave = s;
      else if (leave >= 0 && h > 2.5) {
        land = s;
        break;
      }
    }
    if (leave > 0 && land > leave) {
      const sA = Math.max(0, leave - 40);
      const sB = Math.min(L, land + 40);
      const yA = Math.max(2.2, hAt(ix + ux * sA, iz + uz * sA)) + 0.3;
      const yB = Math.max(2.2, hAt(ix + ux * sB, iz + uz * sB)) + 0.3;
      const pts: LinkPoint[] = [];
      const n = Math.max(2, Math.round((sB - sA) / 6));
      for (let q = 0; q <= n; q++) {
        const t = q / n;
        const s = sA + (sB - sA) * t;
        const y = yA + (yB - yA) * t + 9 * smoothstep(0, 0.28, t) * smoothstep(1, 0.72, t);
        pts.push({ x: ix + ux * s, z: iz + uz * s, y });
      }
      // Bridge runs mainland -> island.
      pts.reverse();
      links.push({ kind: 'bridge', from: cityIdx, to: sites.indexOf(islandSite), width: 17, pts, rail: true });
      // Landings: grade the ground under the ends where the deck meets it.
      const ends = pts.filter((p) => p.y - hAt(p.x, p.z) < 2.5 && hAt(p.x, p.z) > 0);
      gradeRoad(ends, 17, H, road, res, size, cell);
    }
  }

  // ---- 8. Blend the outer rim into the horizon ring's coarse lattice (size / 16) so the two meet exactly.
  {
    const L = 16;
    const hc = size / L;
    const row = L + 1;
    const lat = new Float32Array(row * row);
    for (let b = 0; b <= L; b++) for (let a = 0; a <= L; a++) lat[b * row + a] = base(a * hc - half, b * hc - half);
    const B = 24;
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const e = Math.min(i, j, res - 1 - i, res - 1 - j);
        if (e >= B) continue;
        const fx = (i * cell) / hc;
        const fz = (j * cell) / hc;
        const a = Math.min(L - 1, Math.floor(fx));
        const b = Math.min(L - 1, Math.floor(fz));
        const tx = fx - a;
        const tz = fz - b;
        const coarse = (lat[b * row + a] * (1 - tx) + lat[b * row + a + 1] * tx) * (1 - tz) + (lat[(b + 1) * row + a] * (1 - tx) + lat[(b + 1) * row + a + 1] * tx) * tz;
        const k = j * res + i;
        H[k] = coarse + (H[k] - coarse) * smoothstep(0, B, e);
      }
    }
  }

  // ---- 9. Masks: water and zones.
  const W = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (H[k] < 0) W[k] = 1;
  for (const l of lakes) {
    forDisc(res, size, cell, l.x, l.z, l.r * 1.5, (k, x, z) => {
      if (H[k] < l.level && inPolygon(x, z, l.outline)) W[k] = 2;
    });
  }
  const Z = new Uint8Array(N);
  for (const s of sites) {
    const code = s.kind === 'city' ? ZONE.city : s.kind === 'town' ? ZONE.town : s.kind === 'farm' ? ZONE.farm : ZONE.island;
    forDisc(res, size, cell, s.x, s.z, s.r * 1.3, (k, x, z) => {
      if (H[k] > 1 && !W[k] && inPolygon(x, z, s.outline)) Z[k] = code;
    });
  }
  for (let k = 0; k < N; k++) if (road[k] < 9) Z[k] = ZONE.road;

  // ---- 10. Moisture: noise + proximity to water.
  const M = new Float32Array(N);
  let maxH = 0;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const k = j * res + i;
      let m = 0.5 + 0.45 * n2.fbm((X(i) / half) * 2.6 - 3, (X(j) / half) * 2.6 + 6, 4);
      m += 0.25 * smoothstep(0.25, 0, Math.abs(C[k]));
      M[k] = Math.max(0, Math.min(1, m));
      maxH = Math.max(maxH, H[k]);
    }
  }
  for (const l of lakes) forDisc(res, size, cell, l.x, l.z, l.r * 2.4, (k, x, z) => (M[k] = Math.min(1, M[k] + 0.35 * (1 - Math.hypot(x - l.x, z - l.z) / (l.r * 2.4)))));

  const map: TerrainMap = {
    params, size, res, cell, heights: H, moisture: M, water: W, zone: Z, sites, links, lakes, islands, mountain,
    trees: new Float32Array(0), horizon: (x, z) => base(x, z), seaDir: sea, maxHeight: maxH, ms: 0,
  };

  // ---- 11. Trees: none in the towns, on the roads or the island plateau; hedgerows in the farmland;
  // forests where it's moist, conifers up the mountain, palms on beaches.
  const trees: number[] = [];
  const step = 10;
  for (let z = -half + 16; z < half - 16; z += step) {
    for (let x = -half + 16; x < half - 16; x += step) {
      const jx = x + (rand() - 0.5) * step;
      const jz = z + (rand() - 0.5) * step;
      const k = sampleIndex(map, jx, jz);
      const zone = Z[k];
      if (zone === ZONE.city || zone === ZONE.town || zone === ZONE.island || zone === ZONE.road || road[k] < 17) continue;
      const h = heightAt(map, jx, jz);
      if (h < 1.2 || W[k]) continue;
      const s = slopeAt(map, jx, jz);
      if (s > 0.8) continue;
      if (zone === ZONE.farm) {
        if (farm && fieldAt(farm, jx, jz).edge && rand() < 0.3) trees.push(jx, h, jz, 0.7 + rand() * 0.5, 0);
        continue;
      }
      const m = M[k];
      const high = mountain ? h > 60 + mountain.h * 0.25 : false;
      const forest = smoothstep(0.56, 0.76, m + 0.2 * noise.fbm(jx * 0.004, jz * 0.004, 3)) * (h < maxH * 0.7 ? 1 : 0);
      let kind = -1;
      if (h < 6 && C[k] < 0.05 && rand() < 0.06) kind = 2;
      else if (h > 3.5 && rand() < forest * 0.85) kind = high || rand() < 0.12 ? 1 : 0;
      else if (high && h < maxH * 0.6 && rand() < 0.25) kind = 1;
      else if (h > 3.5 && rand() < 0.012) kind = high ? 1 : 0;
      if (kind < 0) continue;
      trees.push(jx, h, jz, 0.8 + rand() * 0.7, kind);
    }
  }
  map.trees = new Float32Array(trees);
  map.ms = performance.now() - t0;
  return map;
}

// ---------------------------------------------------------------- helpers

/** Calls fn for each sample within radius r of (x, z). */
function forDisc(res: number, size: number, cell: number, x: number, z: number, r: number, fn: (k: number, x: number, z: number) => void): void {
  const ir = Math.ceil(r / cell);
  const ci = Math.round((x + size / 2) / cell);
  const cj = Math.round((z + size / 2) / cell);
  for (let j = Math.max(0, cj - ir); j <= Math.min(res - 1, cj + ir); j++) {
    for (let i = Math.max(0, ci - ir); i <= Math.min(res - 1, ci + ir); i++) {
      const px = -size / 2 + i * cell;
      const pz = -size / 2 + j * cell;
      if (Math.hypot(px - x, pz - z) <= r) fn(j * res + i, px, pz);
    }
  }
}

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

/** City edge -> town edge: a gently curving line that keeps off the sea and the mountain, resampled every 6 m. */
function routeHighway(a: Site, b: Site, rand: () => number, coast: (x: number, z: number) => number, mountainAt: (x: number, z: number) => number, mountain: Mountain | null): [number, number][] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const start: [number, number] = [a.x + ux * a.r * 0.55, a.z + uz * a.r * 0.55];
  const end: [number, number] = [b.x - ux * b.r * 0.55, b.z - uz * b.r * 0.55];
  const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const o1 = (rand() - 0.5) * 0.22 * len;
  const o2 = (rand() - 0.5) * 0.22 * len;
  const ctrl: [number, number][] = [start, [start[0] + (end[0] - start[0]) / 3 - uz * o1, start[1] + (end[1] - start[1]) / 3 + ux * o1], [start[0] + ((end[0] - start[0]) * 2) / 3 - uz * o2, start[1] + ((end[1] - start[1]) * 2) / 3 + ux * o2], end];
  // Cubic Bezier through the controls.
  let pts: [number, number][] = [];
  const n = Math.max(8, Math.round(len / 6));
  for (let q = 0; q <= n; q++) {
    const t = q / n;
    const m = 1 - t;
    pts.push([
      m * m * m * ctrl[0][0] + 3 * m * m * t * ctrl[1][0] + 3 * m * t * t * ctrl[2][0] + t * t * t * ctrl[3][0],
      m * m * m * ctrl[0][1] + 3 * m * m * t * ctrl[1][1] + 3 * m * t * t * ctrl[2][1] + t * t * t * ctrl[3][1],
    ]);
  }
  // Keep off the sea (push inland) and off the mountain (push outward), then smooth.
  for (let it = 0; it < 4; it++) {
    for (let q = 1; q < pts.length - 1; q++) {
      let [x, z] = pts[q];
      for (let g = 0; g < 80 && coast(x, z) < 0.05; g++) {
        // inland = direction of increasing coast field
        const e = 8;
        const gx = coast(x + e, z) - coast(x - e, z);
        const gz = coast(x, z + e) - coast(x, z - e);
        const gl = Math.hypot(gx, gz) || 1;
        x += (gx / gl) * 10;
        z += (gz / gl) * 10;
      }
      if (mountain) {
        for (let g = 0; g < 80 && mountainAt(x, z) > 6; g++) {
          const mx = x - mountain.x;
          const mz = z - mountain.z;
          const ml = Math.hypot(mx, mz) || 1;
          x += (mx / ml) * 10;
          z += (mz / ml) * 10;
        }
      }
      pts[q] = [x, z];
    }
    for (let s = 0; s < 6; s++) pts = pts.map((p, q) => (q === 0 || q === pts.length - 1 ? p : [(pts[q - 1][0] + 2 * p[0] + pts[q + 1][0]) / 4, (pts[q - 1][1] + 2 * p[1] + pts[q + 1][1]) / 4]));
  }
  // Resample evenly.
  const out: [number, number][] = [pts[0]];
  let carry = 0;
  for (let q = 1; q < pts.length; q++) {
    const [ax, az] = pts[q - 1];
    const [bx, bz] = pts[q];
    const sl = Math.hypot(bx - ax, bz - az);
    let d = 6 - carry;
    while (d <= sl) {
      out.push([ax + ((bx - ax) * d) / sl, az + ((bz - az) * d) / sl]);
      d += 6;
    }
    carry = sl - (d - 6);
  }
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) < 3) out[out.length - 1] = last;
  else out.push(last);
  return out;
}

/** Road heights: the ground smoothed along the route (a moving average), never below `minY`. */
function profile(pts: [number, number][], hAt: (x: number, z: number) => number, win: number, minY: number): LinkPoint[] {
  const g = pts.map(([x, z]) => hAt(x, z));
  return pts.map(([x, z], q) => {
    let s = 0;
    let n = 0;
    for (let w = Math.max(0, q - win); w <= Math.min(g.length - 1, q + win); w++) {
      s += g[w];
      n++;
    }
    return { x, z, y: Math.max(minY, s / n) };
  });
}

/** Cut and fill the ground to a road: flat under the carriageway, blending back over the verges. */
function gradeRoad(pts: LinkPoint[], width: number, H: Float32Array, road: Float32Array, res: number, size: number, cell: number): void {
  const hw = width / 2;
  const reach = hw + 16;
  const N = res * res;
  const bestD = new Float32Array(N).fill(Infinity);
  const bestY = new Float32Array(N);
  const touched: number[] = [];
  for (const p of pts) {
    forDisc(res, size, cell, p.x, p.z, reach, (k, x, z) => {
      const d = Math.hypot(x - p.x, z - p.z);
      if (bestD[k] === Infinity) touched.push(k);
      if (d < bestD[k]) {
        bestD[k] = d;
        bestY[k] = p.y;
      }
    });
  }
  for (const k of touched) {
    const t = smoothstep(hw + 1.5, reach, bestD[k]);
    H[k] = bestY[k] - 0.08 + (H[k] - (bestY[k] - 0.08)) * t;
    if (bestD[k] < road[k]) road[k] = bestD[k];
  }
}

function carveLake(l: Lake, H: Float32Array, res: number, size: number, cell: number, n2: Noise2D): void {
  const warpAt = (a: number) => 1 + 0.22 * n2.fbm(Math.cos(a) * 1.3 + l.x * 0.01, Math.sin(a) * 1.3 + l.z * 0.01, 3);
  for (let q = 0; q < 48; q++) {
    const a = (q / 48) * Math.PI * 2 - Math.PI;
    // a cell and a half past the bowl edge, so bilinear sampling never reaches into the bowl
    l.outline.push([l.x + Math.cos(a) * (l.r / warpAt(a) + cell * 1.6), l.z + Math.sin(a) * (l.r / warpAt(a) + cell * 1.6)]);
  }
  const depth = 5 + l.r * 0.05;
  forDisc(res, size, cell, l.x, l.z, l.r * 2.4, (k, x, z) => {
    const dn = (Math.hypot(x - l.x, z - l.z) / l.r) * warpAt(Math.atan2(z - l.z, x - l.x));
    if (dn < 1) {
      H[k] = Math.min(H[k], l.level - depth * Math.pow(1 - dn * dn, 0.8) - 0.3);
      return;
    }
    // A lip just above the surface, then an embankment tapering away gently (never a cliff).
    const floor = l.level + 0.25 + Math.min(1, (dn - 1) / 0.3) * 1.2 - Math.max(0, dn - 1.3) * l.r * 0.35;
    let h = H[k];
    if (dn < 2.3) {
      const b = smoothstep(1, 2.3, dn);
      h = (l.level + 0.3 + (dn - 1) * l.r * 0.06) * (1 - b) + h * b;
    }
    H[k] = Math.max(floor, h);
  });
}

/**
 * Droplet hydraulic erosion inside a sub-rectangle: each droplet runs downhill, picks up sediment where
 * it speeds up and drops it where it slows, carving gullies and laying fans at the foot of the slopes.
 */
function hydraulicErosion(H: Float32Array, res: number, cell: number, rand: () => number, i0: number, i1: number, j0: number, j1: number, drops: number): void {
  const inertia = 0.08;
  const capacity = 2.2;
  const minSlope = 0.02;
  const erodeRate = 0.3;
  const depositRate = 0.25;
  const evaporate = 0.025;
  const gravity = 4;
  const life = 48;
  // Erosion brush (radius 2 cells).
  const brush: [number, number, number][] = [];
  let wsum = 0;
  for (let dj = -2; dj <= 2; dj++) {
    for (let di = -2; di <= 2; di++) {
      const w = Math.max(0, 2.2 - Math.hypot(di, dj));
      if (w > 0) {
        brush.push([di, dj, w]);
        wsum += w;
      }
    }
  }
  for (const b of brush) b[2] /= wsum;
  const at = (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const k = j * res + i;
    const a = H[k];
    const b = H[k + 1];
    const c = H[k + res];
    const d = H[k + res + 1];
    return { h: a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy, gx: (b - a) * (1 - fy) + (d - c) * fy, gy: (c - a) * (1 - fx) + (d - b) * fx };
  };
  for (let n = 0; n < drops; n++) {
    let x = i0 + rand() * (i1 - i0);
    let y = j0 + rand() * (j1 - j0);
    let dx = 0;
    let dy = 0;
    let speed = 1;
    let water = 1;
    let sed = 0;
    for (let s = 0; s < life; s++) {
      const ci = Math.floor(x);
      const cj = Math.floor(y);
      const fx = x - ci;
      const fy = y - cj;
      const here = at(x, y);
      dx = dx * inertia - here.gx * (1 - inertia);
      dy = dy * inertia - here.gy * (1 - inertia);
      const l = Math.hypot(dx, dy);
      if (l < 1e-6) break;
      dx /= l;
      dy /= l;
      x += dx;
      y += dy;
      if (x < i0 || y < j0 || x >= i1 || y >= j1) break;
      const dh = at(x, y).h - here.h;
      const cap = Math.max(-dh / cell, minSlope) * speed * water * capacity;
      const k = cj * res + ci;
      if (sed > cap || dh > 0) {
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depositRate;
        sed -= amt;
        H[k] += amt * (1 - fx) * (1 - fy);
        H[k + 1] += amt * fx * (1 - fy);
        H[k + res] += amt * (1 - fx) * fy;
        H[k + res + 1] += amt * fx * fy;
      } else {
        const amt = Math.min((cap - sed) * erodeRate, -dh);
        for (const [di, dj, w] of brush) {
          const kk = (cj + dj) * res + ci + di;
          const take = amt * w;
          H[kk] -= take;
          sed += take;
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed - (dh / cell) * gravity));
      water *= 1 - evaporate;
    }
  }
}

/** In-place thermal erosion inside a sub-rectangle: material slides to the lowest 4-neighbour while the drop exceeds talus * cell. */
function thermalErosion(H: Float32Array, res: number, cell: number, talus: number, iterations: number, i0: number, i1: number, j0: number, j1: number): void {
  const maxD = talus * cell;
  for (let it = 0; it < iterations; it++) {
    for (let j = Math.max(1, j0); j < Math.min(res - 1, j1); j++) {
      for (let i = Math.max(1, i0); i < Math.min(res - 1, i1); i++) {
        const k = j * res + i;
        let n = k - 1;
        if (H[k + 1] < H[n]) n = k + 1;
        if (H[k - res] < H[n]) n = k - res;
        if (H[k + res] < H[n]) n = k + res;
        const d = H[k] - H[n];
        if (d <= maxD) continue;
        const m = (d - maxD) * 0.5;
        H[k] -= m;
        H[n] += m;
      }
    }
  }
}
