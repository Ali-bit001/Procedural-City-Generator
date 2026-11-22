/**
 * Small-detail grammar shared by all residential generators:
 *   Yard     -> swing | slide | trampoline | doghouse | patio set | bbq | garden bed | clothesline | bench
 *   Services -> water tank (roof or stand) | split AC (wall) | AC unit (ground) | solar panels | satellite dish
 *   Street   -> car | mailbox | bins
 *   Lights   -> door sconces | porch ceiling light | garage lights | back door light | path bollards | lamp post
 */
import type { RNG } from '../../core/rng';
import { inside, type OpeningPlacer, type Wall, wallsOf } from '../facade/openings';
import {
  massTop,
  rotFromNormal,
  type DetailOptions,
  type Light,
  type Mass,
  type Opening,
  type Porch,
  type Prop,
  type PropKind,
  type Rect,
} from '../spec';

const HALF_PI = Math.PI / 2;

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;
}

/** Rejection-sampling placement of rectangular footprints that avoids everything already placed. */
export class YardPlacer {
  constructor(
    readonly rng: RNG,
    readonly W: number,
    readonly D: number,
    readonly obstacles: Rect[],
  ) {}

  free(r: Rect, pad = 0.4): boolean {
    if (r.x0 < 0.3 || r.x1 > this.W - 0.3 || r.z0 < 0.3 || r.z1 > this.D - 0.3) return false;
    return !this.obstacles.some((o) => rectsOverlap(o, r, pad));
  }

  /** Try to place a w×d footprint inside `region`. Rotations are multiples of 90°. */
  place(region: Rect, w: number, d: number, rots: number[] = [0, HALF_PI, Math.PI, -HALF_PI], pad = 0.5, attempts = 30) {
    for (let i = 0; i < attempts; i++) {
      const rot = this.rng.pick(rots);
      const swap = Math.abs(Math.sin(rot)) > 0.5;
      const fw = swap ? d : w;
      const fd = swap ? w : d;
      if (region.x1 - region.x0 < fw || region.z1 - region.z0 < fd) return null;
      const x = this.rng.range(region.x0 + fw / 2, region.x1 - fw / 2);
      const z = this.rng.range(region.z0 + fd / 2, region.z1 - fd / 2);
      const rect = { x0: x - fw / 2, x1: x + fw / 2, z0: z - fd / 2, z1: z + fd / 2 };
      if (!this.free(rect, pad)) continue;
      this.obstacles.push(rect);
      return { x, z, rot, rect };
    }
    return null;
  }
}

export interface DetailContext {
  rng: RNG;
  W: number;
  D: number;
  masses: Mass[];
  facade: OpeningPlacer;
  placer: YardPlacer;
  props: Prop[];
  lights: Light[];
  details: DetailOptions;
}

// ---------------------------------------------------------------- yard props

const FOOTPRINT: Partial<Record<PropKind, [number, number]>> = {
  swing: [4.4, 2.2],
  slide: [1.0, 3.4],
  trampoline: [3.8, 3.8],
  doghouse: [1.3, 1.5],
  patioSet: [3.0, 3.0],
  bbq: [1.5, 0.8],
  gardenBed: [3.2, 1.3],
  clothesline: [4.6, 0.9],
  bench: [1.8, 0.8],
};

function propColors(rng: RNG, kind: PropKind): { color: string; color2?: string } {
  switch (kind) {
    case 'swing':
      return { color: rng.pick(['#2f6db5', '#c0392b', '#2e8b57', '#8a6a4a']), color2: rng.pick(['#f1c40f', '#e74c3c', '#2c3e50', '#ecf0f1']) };
    case 'slide':
      return { color: rng.pick(['#e67e22', '#3498db', '#e74c3c', '#f1c40f']), color2: '#5d6d7e' };
    case 'trampoline':
      return { color: rng.pick(['#2f6db5', '#27ae60', '#e67e22', '#8e44ad']), color2: '#1b1b1b' };
    case 'doghouse':
      return { color: rng.pick(['#a0522d', '#c0392b', '#e8e2d0', '#7f8c8d', '#d4a373']), color2: rng.pick(['#3d3d3d', '#5c3b2f', '#2c3e50']) };
    case 'patioSet':
      return { color: rng.pick(['#e8e4dc', '#6b4a33', '#2b2b2b']), color2: rng.pick(['#c0392b', '#2c7fb8', '#f4f1ea', '#27ae60', '#e67e22']) };
    case 'bbq':
      return { color: '#2b2b2b', color2: '#9aa0a6' };
    case 'gardenBed':
      return { color: '#7a5a3a', color2: rng.pick(['#e74c3c', '#f1c40f', '#9b59b6', '#ffffff', '#ff8fab']) };
    case 'clothesline':
      return { color: '#9aa0a6' };
    case 'bench':
      return { color: rng.pick(['#7a5a3a', '#2b2b2b', '#2e6b4a']) };
    default:
      return { color: '#888888' };
  }
}

/** Each entry is a chance (scaled by details.props); at most `max` items placed. */
export function addYardProps(ctx: DetailContext, region: Rect, chances: Partial<Record<PropKind, number>>, max = 5): void {
  const { rng, placer, props, details } = ctx;
  const kinds = (Object.keys(chances) as PropKind[]).filter((k) => rng.chance(Math.min(0.95, (chances[k] ?? 0) * details.props)));
  let placed = 0;
  for (const kind of kinds) {
    if (placed >= max) break;
    const [w, d] = FOOTPRINT[kind]!;
    const spot = placer.place(region, w, d);
    if (!spot) continue;
    props.push({ kind, x: spot.x, y: 0, z: spot.z, rot: spot.rot, ...propColors(rng, kind) });
    placed++;
  }
}

/** Ground AC condenser against the back wall of a mass. */
export function addGroundAC(ctx: DetailContext, m: Mass): void {
  const r = m.rect;
  const spot = ctx.placer.place({ x0: r.x0 + 0.3, x1: r.x1 - 0.3, z0: r.z1 + 0.25, z1: r.z1 + 1.3 }, 0.9, 0.9, [Math.PI], 0.1);
  if (spot) ctx.props.push({ kind: 'acUnit', x: spot.x, y: 0, z: spot.z, rot: Math.PI, color: '#cfd2d4' });
}

/** Wall-mounted split-AC outdoor units next to windows (very common in South Asia, Europe, Asia). */
export function addSplitACs(ctx: DetailContext, count: number, sides: Opening['wall'][] = ['back', 'left', 'right']): void {
  const { rng, facade, masses, props } = ctx;
  const byId = new Map(masses.map((m) => [m.id, m]));
  const windows = facade.openings.filter((o) => o.kind === 'window' && byId.has(o.massId) && sides.includes(o.wall) && o.height > 0.9 && !o.balcony);
  for (let i = 0; i < count && windows.length; i++) {
    const o = windows.splice(rng.int(0, windows.length - 1), 1)[0];
    const m = byId.get(o.massId)!;
    const wl = wallsOf(m.rect).find((w) => w.side === o.wall)!;
    const side = rng.chance(0.5) ? 1 : -1;
    const tx = (wl.bx - wl.ax) / wl.length;
    const tz = (wl.bz - wl.az) / wl.length;
    const off = side * (o.width / 2 + 0.7);
    const x = o.cx + tx * off;
    const z = o.cz + tz * off;
    const y = o.y0 + o.height - 0.55;
    // Must stay on the wall and not collide with another opening.
    const t = (x - wl.ax) * tx + (z - wl.az) * tz;
    if (t < 0.5 || t > wl.length - 0.5) continue;
    const clash = facade.openings.some(
      (p) => p !== o && p.nx === o.nx && p.nz === o.nz && Math.abs(p.nz !== 0 ? p.cz - o.cz : p.cx - o.cx) < 0.05 &&
        Math.abs(p.nz !== 0 ? p.cx - x : p.cz - z) < p.width / 2 + 0.6 && y < p.y0 + p.height && y + 0.6 > p.y0,
    );
    if (clash || !facade.visible(wl, x, z, 0.9, y + 0.3, m.id, 0.1)) continue;
    props.push({ kind: 'splitAC', x, y, z, rot: rotFromNormal(o.nx, o.nz), color: '#eef0f0' });
  }
}

/** A roof spot on a flat roof that isn't covered by a taller mass. */
function flatRoofSpots(masses: Mass[], inset: number): { m: Mass; x: number; z: number; top: number }[] {
  const out: { m: Mass; x: number; z: number; top: number }[] = [];
  const flats = masses.filter((m) => m.roof.type === 'flat').sort((a, b) => massTop(b) - massTop(a));
  for (const m of flats) {
    const r = m.rect;
    if (r.x1 - r.x0 < inset * 2 + 0.4 || r.z1 - r.z0 < inset * 2 + 0.4) continue;
    const top = massTop(m) + (m.roof.parapet ? 0.1 : 0.3);
    const corners = [
      [r.x0 + inset, r.z1 - inset],
      [r.x1 - inset, r.z1 - inset],
      [r.x0 + inset, r.z0 + inset],
      [r.x1 - inset, r.z0 + inset],
    ];
    for (const [x, z] of corners) {
      const covered = masses.some((o) => o !== m && massTop(o) > massTop(m) - 0.1 && inside(o.rect, x, z, inset));
      if (!covered) out.push({ m, x, z, top });
    }
  }
  return out;
}

const TANK_COLORS = ['#1e1f22', '#1e1f22', '#2a5fa8', '#e8e8e2', '#1e1f22', '#3f6fb0'];

/**
 * Water tanks: on a flat roof (on a short stand) if possible, otherwise on a tall steel stand
 * in the backyard. `chance` is usually details.waterTanks.
 */
export function addWaterTanks(ctx: DetailContext, chance: number, backRegion?: Rect): void {
  const { rng, props, masses, placer } = ctx;
  if (!rng.chance(chance)) return;
  const color = rng.pick(TANK_COLORS);
  const spots = flatRoofSpots(masses, 1.0);
  if (spots.length) {
    const s = spots[0];
    const count = rng.chance(0.3) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const dx = i === 0 ? 0 : s.x < (s.m.rect.x0 + s.m.rect.x1) / 2 ? 1.5 : -1.5;
      props.push({ kind: 'waterTank', x: s.x + dx, y: s.top, z: s.z, rot: rng.range(0, 6.28), color, w: rng.range(0.55, 0.7), h: rng.range(0.3, 1.2) });
    }
    return;
  }
  if (backRegion && rng.chance(0.6)) {
    const spot = placer.place(backRegion, 1.8, 1.8, [0], 0.3);
    if (spot) props.push({ kind: 'waterTank', x: spot.x, y: 0, z: spot.z, rot: 0, color, w: rng.range(0.6, 0.75), h: rng.range(3, 4.5) });
  }
}

/** Solar panels: tilted racks on flat roofs, or flush on a mono-pitch (shed) roof. */
export function addSolarPanels(ctx: DetailContext, chance: number): void {
  const { rng, props, masses } = ctx;
  if (!rng.chance(chance)) return;
  const roofs = masses.filter((m) => m.roof.type === 'flat' || (m.roof.type === 'shed' && m.roof.axis === 'x')).sort((a, b) => massTop(b) - massTop(a));
  for (const m of roofs) {
    const r = m.rect;
    if (m.roof.type === 'shed') {
      // Flush on the slope; local +z points uphill.
      const span = r.z1 - r.z0;
      const w = Math.min(r.x1 - r.x0 - 1.4, 8);
      const d = Math.min(span - 1.4, 5);
      if (w < 2 || d < 1.6) continue;
      const zc = (r.z0 + r.z1) / 2;
      const zLowWall = m.roof.highSide > 0 ? r.z0 : r.z1;
      const y = massTop(m) + Math.abs(zc - zLowWall) * m.roof.pitch + 0.28 + 0.04;
      props.push({ kind: 'solarPanels', x: (r.x0 + r.x1) / 2, y, z: zc, rot: m.roof.highSide > 0 ? 0 : Math.PI, color: '#1d2b4a', w, d, h: m.roof.pitch });
      return;
    }
    const w = Math.min(r.x1 - r.x0 - 2, 6);
    const d = Math.min((r.z1 - r.z0) / 2 - 1, 3.6);
    if (w < 2 || d < 1.6) continue;
    const x = (r.x0 + r.x1) / 2;
    const z = r.z0 + 1 + d / 2;
    const covered = masses.some((o) => o !== m && massTop(o) > massTop(m) - 0.1 && rectsOverlap(o.rect, { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }));
    if (covered) continue;
    props.push({ kind: 'solarPanels', x, y: massTop(m) + (m.roof.parapet ? 0.1 : 0.3), z, rot: 0, color: '#1d2b4a', w, d });
    return;
  }
}

/** Dish mounted high on a side or back wall. */
export function addSatelliteDish(ctx: DetailContext, m: Mass, chance: number): void {
  const { rng, props, facade } = ctx;
  if (!rng.chance(chance)) return;
  const walls = wallsOf(m.rect).filter((w) => w.side !== 'front');
  const wl: Wall = rng.pick(walls);
  const t = rng.range(0.6, wl.length - 0.6);
  const x = wl.ax + ((wl.bx - wl.ax) * t) / wl.length;
  const z = wl.az + ((wl.bz - wl.az) * t) / wl.length;
  const y = massTop(m) - 0.6;
  if (!facade.visible(wl, x, z, 0.8, y, m.id, 0)) return;
  if (facade.openings.some((o) => o.nx === wl.nx && o.nz === wl.nz && Math.hypot(o.cx - x, o.cz - z) < o.width / 2 + 0.6 && y < o.y0 + o.height + 0.3 && y > o.y0 - 0.6)) return;
  props.push({ kind: 'satelliteDish', x, y, z, rot: rotFromNormal(wl.nx, wl.nz), color: '#e6e6e2' });
}

// ---------------------------------------------------------------- street-side details

const CAR_COLORS = ['#f2f2f0', '#c9ccd1', '#1e1f22', '#8e1c1c', '#1f3f73', '#5a5f66', '#2d4f3c', '#b8b2a2'];

export function addCar(ctx: DetailContext, driveway: Rect): void {
  const { rng, props, placer } = ctx;
  if (!rng.chance(ctx.details.cars)) return;
  const len = driveway.z1 - driveway.z0;
  if (len < 5.2 || driveway.x1 - driveway.x0 < 2.2) return;
  const x = rng.chance(0.5) || driveway.x1 - driveway.x0 < 5 ? (driveway.x0 + driveway.x1) / 2 : driveway.x0 + 1.4 + rng.range(0, driveway.x1 - driveway.x0 - 2.8);
  const z = driveway.z1 - 2.6 - rng.range(0, Math.max(0, len - 5.4));
  props.push({ kind: 'car', x, y: 0.05, z, rot: rng.chance(0.6) ? 0 : Math.PI, color: rng.pick(CAR_COLORS) });
  placer.obstacles.push({ x0: x - 1, x1: x + 1, z0: z - 2.3, z1: z + 2.3 });
}

export function addMailbox(ctx: DetailContext, nearX: number, chance: number): void {
  const { rng, props, placer } = ctx;
  if (!rng.chance(chance)) return;
  for (const dx of [-1, 1]) {
    const x = nearX + dx * rng.range(0.9, 1.3);
    const rect = { x0: x - 0.25, x1: x + 0.25, z0: 0.4, z1: 0.9 };
    if (!placer.free(rect, 0.1)) continue;
    placer.obstacles.push(rect);
    props.push({ kind: 'mailbox', x, y: 0, z: 0.65, rot: 0, color: rng.pick(['#2b2b2b', '#2b2b2b', '#9aa0a6', '#8e1c1c', '#1f3f73']) });
    return;
  }
}

/** Letterbox fixed to the wall beside a door (row houses, houses without a kerbside mailbox). */
export function addWallMailbox(ctx: DetailContext, door: Opening, side: 1 | -1, chance: number): void {
  const { rng, props } = ctx;
  if (!rng.chance(chance)) return;
  const tx = door.nz !== 0 ? 1 : 0;
  const tz = door.nz !== 0 ? 0 : 1;
  const off = side * (door.width / 2 + 0.5);
  props.push({
    kind: 'wallMailbox', x: door.cx + tx * off, y: door.y0 + 1.05, z: door.cz + tz * off, rot: rotFromNormal(door.nx, door.nz),
    color: rng.pick(['#2b2b2b', '#8e1c1c', '#1f3f73', '#b08d57', '#5a5f66']),
  });
}

/** Sunshades over windows: concrete slabs (chajjas) or striped fabric awnings. */
export function addWindowShades(facade: OpeningPlacer, massIds: number[], kind: 'slab' | 'awning', color: string): void {
  for (const o of facade.openings) {
    // Skip slits, garden-level and small attic windows.
    if (o.kind !== 'window' || o.balcony || !massIds.includes(o.massId) || o.width < 0.7 || o.height < 0.95 || o.floor < 0) continue;
    o.shade = { kind, color };
  }
}

export function addBins(ctx: DetailContext, x: number, z: number, chance: number): void {
  const { rng, props, placer } = ctx;
  if (!rng.chance(chance)) return;
  const rect = { x0: x - 0.75, x1: x + 0.75, z0: z - 0.4, z1: z + 0.4 };
  if (!placer.free(rect, 0.05)) return;
  placer.obstacles.push(rect);
  props.push({ kind: 'bins', x, y: 0, z, rot: 0, color: rng.pick(['#2e6b3a', '#2b2b2b', '#1f4f8a', '#5a5f66']), color2: rng.pick(['#1f4f8a', '#8a8f96', '#6b4a33']) });
}

// ---------------------------------------------------------------- lights

/** Lights around a front door: sconces beside it, or a ceiling light under a porch roof. */
export function addDoorLights(ctx: DetailContext, door: Opening, porch?: Porch): void {
  const { rng, lights } = ctx;
  const rot = rotFromNormal(door.nx, door.nz);
  const tx = door.nz !== 0 ? 1 : 0;
  const tz = door.nz !== 0 ? 0 : 1;
  if (porch && (porch.kind === 'porch' || porch.kind === 'canopy')) {
    lights.push({ kind: 'ceiling', x: door.cx, y: porch.roofY - 0.05, z: (porch.rect.z0 + porch.rect.z1) / 2, rot });
    if (rng.chance(0.5)) return;
  }
  const off = door.width / 2 + 0.35;
  const y = door.y0 + Math.min(door.height + 0.1, 2.0);
  const sides = rng.chance(0.6) ? [-1, 1] : [rng.chance(0.5) ? -1 : 1];
  for (const s of sides) lights.push({ kind: 'sconce', x: door.cx + tx * off * s, y, z: door.cz + tz * off * s, rot });
}

export function addGarageLights(ctx: DetailContext, doors: Opening[]): void {
  const { rng, lights } = ctx;
  if (!doors.length || !rng.chance(0.65)) return;
  const xs = doors.flatMap((d) => [d.cx - d.width / 2 - 0.35, d.cx + d.width / 2 + 0.35]);
  const d0 = doors[0];
  const y = d0.y0 + d0.height + 0.35;
  const chosen = rng.chance(0.5) ? [Math.min(...xs), Math.max(...xs)] : [(Math.min(...xs) + Math.max(...xs)) / 2];
  for (const x of chosen) lights.push({ kind: 'sconce', x, y, z: d0.cz, rot: rotFromNormal(d0.nx, d0.nz) });
}

/** Light over a back door / between back windows. */
export function addBackLight(ctx: DetailContext, m: Mass, chance: number): void {
  const { rng, lights, facade } = ctx;
  if (!rng.chance(chance)) return;
  const back = facade.openings.filter((o) => o.massId === m.id && o.wall === 'back' && o.floor === 0).sort((a, b) => a.cx - b.cx);
  let x: number;
  if (back.length >= 2) x = (back[0].cx + back[1].cx) / 2;
  else if (back.length === 1) x = back[0].cx + (back[0].cx > (m.rect.x0 + m.rect.x1) / 2 ? -1 : 1) * (back[0].width / 2 + 0.6);
  else x = (m.rect.x0 + m.rect.x1) / 2;
  lights.push({ kind: 'sconce', x, y: m.baseY + 2.2, z: m.rect.z1, rot: rotFromNormal(0, 1) });
}

/** Bollards along a straight path that reaches the street, and/or a lamp post at its start. */
export function addPathLights(ctx: DetailContext, path: Rect, bollardChance: number, postChance: number): void {
  const { rng, lights, placer } = ctx;
  if (rng.chance(bollardChance)) {
    const side = rng.chance(0.5) ? path.x0 - 0.3 : path.x1 + 0.3;
    for (let z = path.z0 + 1.2; z < path.z1 - 0.8; z += 2.4) lights.push({ kind: 'bollard', x: side, y: 0, z, rot: 0 });
  }
  if (rng.chance(postChance)) {
    const x = rng.chance(0.5) ? path.x0 - 0.5 : path.x1 + 0.5;
    const rect = { x0: x - 0.2, x1: x + 0.2, z0: 0.5, z1: 0.9 };
    if (placer.free(rect, 0.1)) {
      placer.obstacles.push(rect);
      lights.push({ kind: 'post', x, y: 0, z: 0.7, rot: 0 });
    }
  }
}
