/**
 * Places of worship, each faith in several architectures:
 *
 *   mosque   mughal      -> red sandstone compound: arcaded cloisters round a courtyard with an ablution
 *                           pool, monumental gateway, prayer hall with a tall pishtaq and three marble bulb
 *                           domes, four octagonal minarets crowned by chhatris
 *            ottoman     -> square hall under a big lead dome with cascading half-domes and corner domes,
 *                           domed portico, courtyard with a şadırvan, pencil minarets, small graveyard
 *            modern      -> "tent" hall (folded roof) with four needle minarets and reflecting pools, or a
 *                           minimal cube with a saucer dome and one square minaret
 *            local       -> neighbourhood mosque: 1-2 storeys, small dome, minaret with loudspeakers,
 *                           boundary wall, water tank
 *   church   gothic      -> nave + aisles + transept, buttresses, stained-glass lancets, rose windows,
 *                           a west tower with a spire or twin towers, churchyard with gravestones
 *            colonial    -> whitewashed / stone nave, round arches, bell tower with pyramid roof or belfry
 *            modern      -> A-frame nave with a glass front, free-standing bell tower, big cross
 *            orthodox    -> cross plan, onion domes on drums (gold / blue), bell tower
 *   temple   nagara      -> raised platform, pillared porch, hall with a pyramid roof, curvilinear shikhara
 *                           over the sanctum with clustered small towers, saffron flag
 *            dravidian   -> walled compound entered through a painted gopuram, vimana over the sanctum,
 *                           pillared hall, temple tank with a pavilion, flag mast, coconut palms
 *   gurdwara             -> white Darbar Sahib with a gold lotus dome and corner chhatris, either in the
 *                           middle of the sarovar on a causeway or beside it; Nishan Sahib, langar hall, gate
 *   buddhist pagoda      -> gate, tiled hall, tiered pagoda, garden with a pond, bridge and stone lanterns
 *            stupa       -> white stupa on terraces with prayer flags, circumambulation path, monastery
 */
import { RNG } from '../../core/rng';
import { DEFAULT_DETAILS, massTop, type DetailOptions, type HouseModel, type Mass, type Rect, type WallSide, type WindowStyle } from '../spec';
import { Site, jitter } from './civic/site';
import { domeTop } from '../mesher/sacredMesher';

export type Faith = 'mosque' | 'church' | 'temple' | 'gurdwara' | 'buddhist';
export type WorshipStyle =
  | 'mughal' | 'ottoman' | 'modernMosque' | 'localMosque'
  | 'gothic' | 'colonial' | 'modernChurch' | 'orthodox'
  | 'nagara' | 'dravidian'
  | 'gurdwara'
  | 'pagoda' | 'stupa';

export const WORSHIP_STYLES: Record<WorshipStyle, { faith: Faith; lot: [number, number, number, number]; weight: number }> = {
  mughal: { faith: 'mosque', lot: [94, 112, 94, 112], weight: 3 },
  ottoman: { faith: 'mosque', lot: [74, 90, 82, 98], weight: 3 },
  modernMosque: { faith: 'mosque', lot: [74, 92, 84, 100], weight: 3 },
  localMosque: { faith: 'mosque', lot: [26, 34, 30, 40], weight: 8 },
  gothic: { faith: 'church', lot: [52, 68, 74, 92], weight: 3 },
  colonial: { faith: 'church', lot: [34, 46, 46, 60], weight: 5 },
  modernChurch: { faith: 'church', lot: [36, 48, 46, 60], weight: 3 },
  orthodox: { faith: 'church', lot: [42, 54, 52, 66], weight: 2 },
  nagara: { faith: 'temple', lot: [44, 58, 54, 70], weight: 4 },
  dravidian: { faith: 'temple', lot: [74, 92, 86, 104], weight: 2 },
  gurdwara: { faith: 'gurdwara', lot: [74, 92, 78, 96], weight: 3 },
  pagoda: { faith: 'buddhist', lot: [52, 70, 58, 78], weight: 2 },
  stupa: { faith: 'buddhist', lot: [52, 70, 58, 78], weight: 2 },
};
export const WORSHIP_STYLE_LIST = Object.keys(WORSHIP_STYLES) as WorshipStyle[];
export const FAITHS: Faith[] = ['mosque', 'church', 'temple', 'gurdwara', 'buddhist'];

export function pickWorship(rng: RNG, among: WorshipStyle[] = WORSHIP_STYLE_LIST): WorshipStyle {
  return rng.weighted(among.map((s) => [s, WORSHIP_STYLES[s].weight] as const));
}

export function worshipLotSize(rng: RNG, style: WorshipStyle): { w: number; d: number } {
  const [w0, w1, d0, d1] = WORSHIP_STYLES[style].lot;
  return { w: rng.range(w0, w1), d: rng.range(d0, d1) };
}

export interface WorshipSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style: WorshipStyle;
  details?: DetailOptions;
}

const GOLD = '#d4a93a';
const SAFFRON = '#ff8c1a';
const MARBLE = '#f2ede2';
const rectPoly = (r: Rect): [number, number][] => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];

/** Arched windows whose spandrels match the wall. */
function arches(s: Site, m: Mass, style: WindowStyle, bay: number, w: number, h: number, sill: number, sides?: WallSide[], floors?: number[]): void {
  s.windows(m, { bay, w, h, sill, style, frame: m.wallColor, sides, floors, noSill: true, litChance: 0.55 });
}

/** Arched doorway (drawn as a full-height arched opening, glowing at night). */
function archDoor(s: Site, m: Mass, side: WallSide, t: number, w: number, h: number, style: WindowStyle = 'pointed'): void {
  const wl = s.wall(m, side);
  const cx = wl.ax + (wl.bx - wl.ax) * t;
  const cz = wl.az + (wl.bz - wl.az) * t;
  s.clear(m, side, cx, cz, w + 0.8, m.baseY + h + 0.4);
  s.facade.add({ kind: 'window', massId: m.id, wall: side, floor: 0, cx, cz, nx: wl.nx, nz: wl.nz, width: w, y0: m.baseY, height: h, color: '#2b3a48', frameColor: m.wallColor, mullions: false, style, noSill: true, lit: true });
  s.entrances.push({ x: cx, z: cz, nx: wl.nx, nz: wl.nz, massId: m.id });
}

const CARPETS: [string, string][] = [['#8e1c24', '#d9b26a'], ['#1f5e3a', '#d9b26a'], ['#7a1f2b', '#e9d9b0'], ['#2f4f7a', '#d9b26a'], ['#9c3a1f', '#efe0b8']];

/**
 * Rows of prayer carpets facing the qibla (towards +z, the prayer hall), starting at zFront and stepping
 * back towards the street until zStop.
 */
function carpetRows(s: Site, x0: number, x1: number, zFront: number, zStop: number, maxRows = 12): number {
  const pal = s.rng.pick(CARPETS);
  const alt = s.rng.pick(CARPETS);
  let n = 0;
  for (let z = zFront; z - 0.65 > zStop && n < maxRows; z -= 1.6, n++) {
    const [c1, c2] = n % 2 && s.rng.chance(0.5) ? alt : pal;
    s.props.push({ kind: 'prayerCarpet', x: (x0 + x1) / 2, y: 0.06, z, rot: Math.PI, color: c1, color2: c2, w: x1 - x0, d: 1.3 });
  }
  return n;
}

/** Plain carpet runner along a walkway from (ax, az) to (bx, bz) (axis-aligned). */
function runner(s: Site, ax: number, az: number, bx: number, bz: number, color: string): void {
  const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
  s.props.push({ kind: 'prayerCarpet', x: (ax + bx) / 2, y: 0.06, z: (az + bz) / 2, rot: alongX ? 0 : Math.PI / 2, color, color2: '#d9b26a', w: alongX ? Math.abs(bx - ax) : Math.abs(bz - az), d: 1.6, n: 1 });
}

function graves(s: Site, region: Rect, n: number, stone = '#a7a39a'): void {
  const yard = s.placer();
  for (let i = 0; i < n; i++) {
    const spot = yard.place(region, 0.8, 1.2, [0], 0.5, 12);
    if (spot) s.props.push({ kind: 'gravestone', x: spot.x, y: 0.05, z: spot.z + 0.4, rot: s.rng.range(-0.12, 0.12), color: jitter(stone, s.rng, 0.06), n: s.rng.chance(0.25) ? 1 : 0 });
  }
}

// ---------------------------------------------------------------- mosques

function mughal(s: Site): void {
  const { rng, W, D } = s;
  const sand = jitter(rng.pick(['#a5523a', '#9c4a35', '#b0603f']), rng, 0.03);
  const cx = W / 2;
  const m = 4;
  const zf = 9;
  // Monumental gateway + front cloister.
  const gate = s.mass('main', { x0: cx - 9, x1: cx + 9, z0: zf - 2, z1: zf + 8 }, 1, 13, sand, { parapet: true, color: '#8c4a35' });
  archDoor(s, gate, 'front', 0.5, 6, 9.5);
  archDoor(s, gate, 'back', 0.5, 6, 9.5);
  for (const [x, z] of [[cx - 8, zf - 1], [cx + 8, zf - 1], [cx - 8, zf + 7], [cx + 8, zf + 7]]) s.props.push({ kind: 'chhatri', x, y: massTop(gate), z, rot: 0, color: sand, color2: MARBLE, w: 1.1, h: 2.2, n: 2 });
  const side = 6;
  const hallD = 18;
  const hz0 = D - 4 - hallD;
  const cloister = (r: Rect, inner: WallSide) => {
    const c = s.mass('wing', r, 1, 6.5, sand, { parapet: true, color: '#8c4a35' });
    arches(s, c, 'pointed', 4.2, 2.8, 4.6, 0.4, [inner]);
    arches(s, c, 'pointed', 6, 1.4, 2.4, 2.2, (['front', 'back', 'left', 'right'] as WallSide[]).filter((w) => w !== inner));
  };
  cloister({ x0: m, x1: cx - 9, z0: zf, z1: zf + 6 }, 'back');
  cloister({ x0: cx + 9, x1: W - m, z0: zf, z1: zf + 6 }, 'back');
  cloister({ x0: m, x1: m + side, z0: zf + 6, z1: hz0 }, 'right');
  cloister({ x0: W - m - side, x1: W - m, z0: zf + 6, z1: hz0 }, 'left');
  // Prayer hall with the central pishtaq, three bulb domes.
  const hall = s.mass('main', { x0: m, x1: W - m, z0: hz0, z1: D - 4 }, 1, 13, sand, { parapet: true, color: '#8c4a35' });
  arches(s, hall, 'pointed', 7, 4.4, 8.5, 0.2, ['front']);
  const pish = s.mass('wing', { x0: cx - 9, x1: cx + 9, z0: hz0 - 2, z1: hz0 + 4 }, 1, 19, sand, { parapet: true, color: '#8c4a35' });
  archDoor(s, pish, 'front', 0.5, 8, 14);
  const top = massTop(hall);
  const zc = (hz0 + D - 4) / 2;
  const rBig = Math.min(8, (W - 2 * m) * 0.1);
  s.props.push({ kind: 'dome', x: cx, y: top, z: zc + 1, rot: 0, color: MARBLE, color2: MARBLE, w: rBig, n: 2, d: 3 });
  for (const sx of [-1, 1]) s.props.push({ kind: 'dome', x: cx + sx * (W - 2 * m) * 0.27, y: top, z: zc + 1, rot: 0, color: MARBLE, color2: MARBLE, w: rBig * 0.72, n: 2, d: 3 });
  for (const sx of [-1, 1]) for (const z of [hz0 + 1.5, D - 5.5]) s.props.push({ kind: 'chhatri', x: cx + sx * ((W - 2 * m) / 2 - 1.5), y: top, z, rot: 0, color: sand, color2: MARBLE, w: 1.2, h: 2.4, n: 2 });
  // Four corner minarets.
  const mh = Math.min(48, Math.max(32, W * 0.42));
  for (const [x, z] of [[m + 1.5, zf + 1], [W - m - 1.5, zf + 1], [m + 1.5, D - 5.5], [W - m - 1.5, D - 5.5]]) s.props.push({ kind: 'minaret', x, y: 0.05, z, rot: 0, color: sand, color2: MARBLE, w: 2.2, h: mh, n: 0 });
  s.height = Math.max(mh + 6, top + domeTop(2, rBig) + 4);
  // Courtyard: paving, ablution pool with a fountain, lamps.
  const court: Rect = { x0: m + side, x1: W - m - side, z0: zf + 6, z1: hz0 - 2 };
  s.paths.push({ ...court, z1: hz0 });
  s.pavingColor = jitter('#d9c7b0', rng, 0.03);
  const pw = Math.min(16, (court.x1 - court.x0) * 0.3);
  const pd = Math.min(10, (court.z1 - court.z0) * 0.3);
  const pz = (court.z0 + court.z1) / 2;
  s.water.push({ pts: rectPoly({ x0: cx - pw / 2, x1: cx + pw / 2, z0: pz - pd / 2, z1: pz + pd / 2 }), shore: MARBLE, y: 0.06 });
  s.props.push({ kind: 'fountain', x: cx, y: 0.05, z: pz, rot: 0, color: MARBLE, w: 1.4 });
  s.animated.push({ kind: 'spray', x: cx, y: 1.98, z: pz, height: 1.6, radius: 1.0 });
  for (const x of [court.x0 + 3, court.x1 - 3]) for (const z of [court.z0 + 3, court.z1 - 3]) s.lights.push({ kind: 'post', x, y: 0.05, z, rot: 0 });
  // Prayer carpets laid out in rows in front of the hall, wudu taps along the pool, shoe racks by the gate.
  s.info.carpetRows = carpetRows(s, court.x0 + 1.5, court.x1 - 1.5, hz0 - 3.3, pz + pd / 2 + 2.8);
  for (const sz of [-1, 1]) s.props.push({ kind: 'wuduTaps', x: cx, y: 0.06, z: pz + sz * (pd / 2 + 1.1), rot: sz < 0 ? 0 : Math.PI, color: MARBLE, w: pw - 1 });
  for (const sx of [-1, 1]) s.props.push({ kind: 'shoeRack', x: cx + sx * 12, y: 0.06, z: zf + 7.2, rot: Math.PI, color: '#6b4a33', w: 4 });
  for (let z = court.z0 + 8; z < court.z1 - 4; z += 12) for (const x of [court.x0 + 1, court.x1 - 1]) s.lights.push({ kind: 'post', x, y: 0.05, z, rot: 0 });
  s.paths.push({ x0: cx - 12, x1: cx + 12, z0: 0, z1: zf - 2 });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: zf - 2 }, 4);
}

function ottoman(s: Site): void {
  const { rng, W, D } = s;
  const stone = jitter(rng.pick(['#d9d2c3', '#e2dccd', '#cfc6b3']), rng, 0.03);
  const lead = jitter('#7c868c', rng, 0.04);
  const cx = W / 2;
  const L = Math.min(W - 26, 38);
  const hz1 = D - 6;
  const hz0 = hz1 - L;
  const hall = s.mass('main', { x0: cx - L / 2, x1: cx + L / 2, z0: hz0, z1: hz1 }, 2, 6.5, stone, { parapet: true, color: lead });
  arches(s, hall, 'arch', 3.6, 1.4, 2.4, 1.2);
  const top = massTop(hall);
  const R = L * 0.34;
  const zc = (hz0 + hz1) / 2;
  s.props.push({ kind: 'dome', x: cx, y: top, z: zc, rot: 0, color: lead, color2: stone, w: R, n: 4, d: 1 });
  for (const sz of [-1, 1]) s.props.push({ kind: 'dome', x: cx, y: top, z: zc + sz * L * 0.3, rot: 0, color: lead, color2: stone, w: L * 0.22, n: 0, d: 0 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.props.push({ kind: 'dome', x: cx + sx * L * 0.38, y: top, z: zc + sz * L * 0.38, rot: 0, color: lead, color2: stone, w: L * 0.09, n: 0, d: 1 });
  // Domed portico.
  const pz0 = hz0 - 7;
  s.porches.push({ kind: 'arcade', rect: { x0: cx - L / 2, x1: cx + L / 2, z0: pz0, z1: hz0 }, floorY: 0.3, roofY: 6.5, stepX: cx, floorColor: stone, roofColor: stone, postColor: stone });
  const nd = 5;
  for (let i = 0; i < nd; i++) s.props.push({ kind: 'dome', x: cx - L / 2 + (L / nd) * (i + 0.5), y: 6.75, z: pz0 + 3.5, rot: 0, color: lead, color2: stone, w: Math.min(2.6, L / nd / 2.4), n: 0, d: 0 });
  archDoor(s, hall, 'front', 0.5, 3.2, 5, 'arch');
  // Courtyard with a şadırvan, side arcades.
  const court: Rect = { x0: cx - L / 2, x1: cx + L / 2, z0: 10, z1: pz0 };
  s.paths.push(court, { x0: cx - 3, x1: cx + 3, z0: 0, z1: 10 });
  if (court.z1 - court.z0 > 10) {
    s.props.push({ kind: 'chhatri', x: cx, y: 0.05, z: (court.z0 + court.z1) / 2, rot: 0, color: stone, color2: lead, w: 2.6, h: 3.2, n: 4 });
    for (const x of [court.x0, court.x1 - 4]) s.porches.push({ kind: 'arcade', rect: { x0: x, x1: x + 4, z0: court.z0, z1: court.z1 }, floorY: 0.2, roofY: 4.2, stepX: x + 2, floorColor: stone, roofColor: lead, postColor: stone });
  }
  // Pencil minarets.
  const mh = rng.range(42, 58);
  const corners = L > 32 && rng.chance(0.5) ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, -1], [1, -1]];
  for (const [sx, sz] of corners) s.props.push({ kind: 'minaret', x: cx + sx * (L / 2 + 2), y: 0.05, z: sz < 0 ? hz0 - 1 : hz1 - 1, rot: 0, color: stone, color2: lead, w: 1.3, h: mh, n: 1 });
  s.height = mh + 4;
  // Carpets in the courtyard before the portico, taps round the şadırvan, shoe racks at the portico ends.
  if (court.z1 - court.z0 > 10) {
    const cz = (court.z0 + court.z1) / 2;
    s.info.carpetRows = carpetRows(s, court.x0 + 5, court.x1 - 5, court.z1 - 1.2, cz + 4.5, 6);
    for (const sx of [-1, 1]) s.props.push({ kind: 'wuduTaps', x: cx + sx * 4.6, y: 0.06, z: cz, rot: sx < 0 ? -Math.PI / 2 : Math.PI / 2, color: stone, w: 4 });
  }
  for (const sx of [-1, 1]) s.props.push({ kind: 'shoeRack', x: cx + sx * (L / 2 - 2.5), y: 0.36, z: hz0 - 1.2, rot: Math.PI, color: '#6b4a33', w: 3 });
  // Small graveyard (hazire) to one side.
  const gx = cx + L / 2 + 5;
  if (W - 3 - gx > 6) graves(s, { x0: gx, x1: W - 3, z0: 12, z1: hz0 - 2 }, 14);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 8, [['cone', 3], ['round', 1]]);
}

function modernMosque(s: Site): void {
  const { rng, W, D } = s;
  const white = jitter(rng.pick([MARBLE, '#e9e6df', '#dcd6c8']), rng, 0.02);
  const cx = W / 2;
  const zc = D * 0.58;
  if (rng.chance(0.55)) {
    // Folded tent hall on a glazed base, four needle minarets on the corners of a plaza.
    s.info.variant = 'tent';
    const hw = Math.min(16, W * 0.2);
    const hall = s.mass('main', { x0: cx - hw, x1: cx + hw, z0: zc - hw, z1: zc + hw }, 1, 4.5, white, { parapet: false, color: white });
    s.glaze(hall, ['front', 'back', 'left', 'right'], '#5a6b7d');
    const th = hw * rng.range(1.1, 1.5);
    s.props.push({ kind: 'tentHall', x: cx, y: massTop(hall), z: zc, rot: 0, color: white, w: hw * 1.15, h: th });
    const mh = rng.range(48, 70);
    const r = hw + 10;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.props.push({ kind: 'minaret', x: cx + sx * Math.min(r, W / 2 - 4), y: 0.05, z: zc + sz * Math.min(r, D - zc - 4), rot: 0, color: white, color2: '#9fb4bf', w: 1.6, h: mh, n: 2 });
    s.height = Math.max(mh, massTop(hall) + th) + 4;
    s.paths.push({ x0: cx - Math.min(r, W / 2 - 4), x1: cx + Math.min(r, W / 2 - 4), z0: zc - Math.min(r, zc - 6), z1: zc + Math.min(r, D - zc - 4) });
  } else {
    // Minimal cube, slit windows, saucer dome, one square minaret.
    s.info.variant = 'cube';
    const hw = Math.min(14, W * 0.18);
    const hall = s.mass('main', { x0: cx - hw, x1: cx + hw, z0: zc - hw, z1: zc + hw }, 1, 14, white, { parapet: true, color: white });
    s.windows(hall, { bay: 2.8, w: 0.6, h: 10, sill: 2, style: 'plain', frame: white, noSill: true, litChance: 0.6 });
    archDoor(s, hall, 'front', 0.5, 4, 7, 'pointed');
    s.props.push({ kind: 'dome', x: cx, y: massTop(hall), z: zc, rot: 0, color: white, color2: white, w: hw * 0.8, n: 5, d: 0 });
    const mh = rng.range(32, 45);
    s.props.push({ kind: 'minaret', x: cx + hw + 5, y: 0.05, z: zc - hw - 2, rot: 0, color: white, color2: '#9fb4bf', w: 1.5, h: mh, n: 2 });
    s.height = mh + 4;
    s.paths.push({ x0: cx - hw - 6, x1: cx + hw + 8, z0: zc - hw - 6, z1: zc + hw + 3 });
  }
  // Reflecting pools with fountains on the approach.
  const pz0 = 6;
  const pz1 = zc - 22;
  if (pz1 - pz0 > 6) {
    for (const sx of [-1, 1]) {
      const r = { x0: cx + sx * 4 - (sx < 0 ? 8 : 0), x1: cx + sx * 4 + (sx > 0 ? 8 : 0), z0: pz0, z1: pz1 };
      s.water.push({ pts: rectPoly(r), shore: '#cfc8bb', y: 0.06 });
      for (let z = pz0 + 3; z < pz1 - 2; z += 6) s.animated.push({ kind: 'spray', x: (r.x0 + r.x1) / 2, y: 0.1, z, height: 2.2, radius: 0.5 });
    }
  }
  // Overflow prayer rows on the plaza in front of the hall (Fridays / Eid).
  if (rng.chance(0.7)) carpetRows(s, cx - Math.min(18, W / 2 - 6), cx + Math.min(18, W / 2 - 6), zc - Math.min(16, W * 0.2) - 3, zc - 21.3, 6);
  s.paths.push({ x0: cx - 3.5, x1: cx + 3.5, z0: 0, z1: zc });
  for (const z of [4, 14, 24]) for (const sx of [-1, 1]) s.lights.push({ kind: 'post', x: cx + sx * 4.2, y: 0.05, z, rot: 0 });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 10, [['palm', 2], ['round', 2]]);
}

function localMosque(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#f2f0ea', '#e9efe4', '#f3ead8', '#e8e3d6']), rng, 0.02);
  const trim = rng.pick(['#2e7d32', '#1f6f5c', '#3f8f4a', '#2f6db5']);
  const z0 = 8;
  const m = s.mass('main', { x0: 3, x1: W - 3, z0, z1: Math.min(D - 4, z0 + 18) }, rng.int(1, 2), 4, wall, { parapet: true, color: '#9aa0a6' });
  arches(s, m, 'pointed', 3, 1.4, 2.3, 0.9);
  archDoor(s, m, 'front', 0.5, 2.2, 3.2);
  s.sign(m, 'front', 0.5, 3.45, Math.min(8, W - 12), 0.45, trim);
  const top = massTop(m);
  const r = Math.min((W - 6) * 0.22, 4.2);
  s.props.push({ kind: 'dome', x: W / 2, y: top, z: (z0 + m.rect.z1) / 2, rot: 0, color: rng.chance(0.5) ? trim : wall, color2: wall, w: r, n: rng.chance(0.5) ? 1 : 0, d: 1 });
  const mh = rng.range(15, 22);
  s.props.push({ kind: 'minaret', x: W - 3.2, y: 0.05, z: 4, rot: 0, color: wall, color2: trim, w: 1.1, h: mh, n: 3 });
  s.props.push({ kind: 'waterTank', x: 5, y: top, z: m.rect.z1 - 2.5, rot: 0, color: '#1e1f22', h: 1.5 });
  s.height = Math.max(mh + 3, top + domeTop(1, r) + 2);
  s.paths.push({ x0: 3, x1: W - 6, z0: 1, z1: z0 });
  s.props.push({ kind: 'bench', x: 5, y: 0.05, z: z0 - 1, rot: 0, color: '#6b4a33' });
  if (rng.chance(0.6)) carpetRows(s, 7.2, W - 7, z0 - 1.6, 1.5, 3);
  s.props.push({ kind: 'shoeRack', x: W / 2 + 3, y: 0.06, z: z0 - 0.3, rot: 0, color: '#6b4a33', w: 2.4 });
  s.fence('privacy', wall, 2, [[W / 2 - 2, W / 2 + 2]]);
  s.trees_({ x0: 0, x1: W, z0: m.rect.z1, z1: D }, 2);
}

// ---------------------------------------------------------------- churches

function gothic(s: Site): void {
  const { rng, W, D } = s;
  const stone = jitter(rng.pick(['#b5ab98', '#a39d92', '#c2b8a3', '#9a8f7c']), rng, 0.03);
  const slate = rng.pick(['#4f5560', '#5a6670', '#3f4a4f']);
  const cx = W / 2;
  const nw = Math.min(14, W * 0.24);
  const aw = 6;
  const z0 = 16;
  const z1 = D - 8;
  const nave = s.mass('main', { x0: cx - nw / 2, x1: cx + nw / 2, z0, z1 }, 1, 15, stone, { type: 'gable', axis: 'z', pitch: 1.2, color: slate, parapet: false, overhang: 0.3 });
  const aisles = [-1, 1].map((sx) => s.mass('wing', sx < 0 ? { x0: cx - nw / 2 - aw, x1: cx - nw / 2, z0: z0 + 2, z1: z1 - 4 } : { x0: cx + nw / 2, x1: cx + nw / 2 + aw, z0: z0 + 2, z1: z1 - 4 }, 1, 7.5, stone, { parapet: true, color: slate }));
  const tz0 = z1 - 24;
  const transept = s.mass('wing', { x0: cx - nw / 2 - aw - 6, x1: cx + nw / 2 + aw + 6, z0: tz0, z1: tz0 + 11 }, 1, 15, stone, { type: 'gable', axis: 'x', pitch: 1.2, color: slate, parapet: false, overhang: 0.3 });
  s.windows(nave, { bay: 4.5, w: 2.2, h: 5, sill: 8.8, style: 'stained', frame: stone, sides: ['left', 'right'], noSill: true });
  for (const a of aisles) s.windows(a, { bay: 4.5, w: 1.9, h: 4.2, sill: 1.6, style: 'stained', frame: stone, sides: ['left', 'right', 'front'], noSill: true });
  for (const side of ['left', 'right'] as WallSide[]) {
    const wl = s.wall(transept, side);
    s.facade.add({ kind: 'window', massId: transept.id, wall: side, floor: 0, cx: wl.ax, cz: (wl.az + wl.bz) / 2, nx: wl.nx, nz: wl.nz, width: 6, y0: 7.5, height: 6, color: '#2b3a48', frameColor: stone, mullions: false, style: 'rose', noSill: true, lit: true });
  }
  // Buttresses along the aisles.
  for (const a of aisles) {
    const left = a.rect.x0 < cx;
    const x = left ? a.rect.x0 : a.rect.x1;
    for (let z = a.rect.z0 + 2.25; z < a.rect.z1 - 1; z += 4.5) s.props.push({ kind: 'buttress', x, y: 0.15, z, rot: left ? Math.PI / 2 : -Math.PI / 2, color: stone, h: 8.5, d: 1.8 });
  }
  const twin = rng.chance(0.45) && W > 56;
  if (twin) {
    // Cathedral front: twin towers, rose window and great door between them.
    s.info.front = 'twin towers';
    for (const sx of [-1, 1]) {
      const t = s.mass('stairTower', sx < 0 ? { x0: cx - nw / 2 - aw, x1: cx - nw / 2, z0: z0 - 6, z1: z0 + 2 } : { x0: cx + nw / 2, x1: cx + nw / 2 + aw, z0: z0 - 6, z1: z0 + 2 }, 3, 9.5, stone, { parapet: true, color: slate });
      s.windows(t, { bay: 3, w: 1.4, h: 4.5, sill: 2, style: 'pointed', frame: stone, sides: ['front', sx < 0 ? 'left' : 'right'], floors: [1, 2], noSill: true });
      if (rng.chance(0.6)) s.props.push({ kind: 'churchSpire', x: (t.rect.x0 + t.rect.x1) / 2, y: massTop(t), z: (t.rect.z0 + t.rect.z1) / 2, rot: 0, color: stone, color2: slate, w: aw / 2, h: rng.range(14, 22), n: 0 });
    }
    const wl = s.wall(nave, 'front');
    s.facade.add({ kind: 'window', massId: nave.id, wall: 'front', floor: 0, cx: cx, cz: wl.az, nx: 0, nz: -1, width: Math.min(8, nw - 3), y0: 7.4, height: Math.min(8, nw - 3), color: '#2b3a48', frameColor: stone, mullions: false, style: 'rose', noSill: true, lit: true });
    archDoor(s, nave, 'front', 0.5, 3.6, 6);
    s.height = 28.5 + 22;
  } else {
    // Single west tower with a tall spire.
    s.info.front = 'west tower';
    const t = s.mass('stairTower', { x0: cx - 4.5, x1: cx + 4.5, z0: z0 - 9, z1: z0 + 0.5 }, 3, 9, stone, { parapet: true, color: slate });
    s.windows(t, { bay: 3, w: 1.4, h: 4.5, sill: 2.5, style: 'pointed', frame: stone, floors: [1, 2], noSill: true });
    archDoor(s, t, 'front', 0.5, 3, 5.4);
    const sh = rng.range(22, 34);
    s.props.push({ kind: 'churchSpire', x: cx, y: massTop(t), z: (t.rect.z0 + t.rect.z1) / 2, rot: 0, color: stone, color2: slate, w: 4.5, h: sh, n: 0 });
    s.height = massTop(t) + sh + 3;
  }
  s.paths.push({ x0: cx - 2, x1: cx + 2, z0: 0, z1: z0 - (twin ? 6 : 9) });
  graves(s, { x0: 2, x1: cx - nw / 2 - aw - 2, z0: 6, z1: D - 3 }, 22);
  graves(s, { x0: cx + nw / 2 + aw + 2, x1: W - 2, z0: 6, z1: D - 3 }, 22);
  s.fence('iron', '#2b2b2b', 1.4, [[cx - 2.5, cx + 2.5]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 8, [['cone', 3], ['round', 2]]);
}

function colonial(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#efe9dc', '#e9e4d6', '#cdbfa6', '#d9c8a8']), rng, 0.03);
  const roof = rng.pick(['#a0473a', '#6b4a3a', '#5a6670']);
  const cx = W / 2;
  const nw = Math.min(12, W * 0.3);
  const z0 = 14;
  const nave = s.mass('main', { x0: cx - nw / 2, x1: cx + nw / 2, z0, z1: D - 8 }, 1, 8, wall, { type: 'gable', axis: 'z', pitch: 0.7, color: roof, parapet: false, overhang: 0.5 });
  arches(s, nave, 'arch', 4, 1.5, 3.4, 1.5, ['left', 'right']);
  const t = s.mass('stairTower', { x0: cx - 3, x1: cx + 3, z0: z0 - 6, z1: z0 + 0.5 }, 2, 9, wall, { parapet: true, color: roof });
  arches(s, t, 'arch', 3, 1.2, 2.6, 4, ['front', 'left', 'right'], [1]);
  archDoor(s, t, 'front', 0.5, 2.4, 4, 'arch');
  const n = rng.chance(0.5) ? 1 : 2;
  s.props.push({ kind: 'churchSpire', x: cx, y: massTop(t), z: (t.rect.z0 + t.rect.z1) / 2, rot: 0, color: wall, color2: roof, w: 3, h: n === 1 ? rng.range(6, 10) : rng.range(7, 9), n });
  s.height = massTop(t) + 13;
  s.paths.push({ x0: cx - 1.8, x1: cx + 1.8, z0: 0, z1: z0 - 6 });
  for (const sx of [-1, 1]) s.props.push({ kind: 'bench', x: cx + sx * 5, y: 0.05, z: 4, rot: 0, color: '#6b4a33' });
  graves(s, { x0: 2, x1: W - 2, z0: D - 7, z1: D - 1 }, 8);
  s.fence(rng.chance(0.5) ? 'picket' : 'iron', rng.chance(0.5) ? '#f4f1ea' : '#2b2b2b', 1.1, [[cx - 2, cx + 2]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 6);
}

function modernChurch(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#e9e6df', '#c9c4b8', '#d9d4c7']), rng, 0.03);
  const roof = rng.pick(['#3f4a4f', '#5f8a7a', '#6b4a3a', '#8f9499']);
  const cx = W / 2;
  const hw = Math.min(8.5, W * 0.2);
  const z0 = 14;
  const nave = s.mass('main', { x0: cx - hw, x1: cx + hw, z0, z1: D - 10 }, 1, 3, wall, { type: 'gable', axis: 'z', pitch: rng.range(1.8, 2.4), color: roof, parapet: false, overhang: 0.6 });
  s.glaze(nave, ['front'], '#3a3d40');
  s.windows(nave, { bay: 3, w: 0.5, h: 2.2, sill: 0.5, style: 'stained', frame: wall, sides: ['left', 'right'], noSill: true });
  const apex = massTop(nave) + hw * nave.roof.pitch;
  s.props.push({ kind: 'finial', x: cx, y: apex - 0.4, z: z0 + 0.6, rot: 0, color: rng.pick([GOLD, '#3a3d40', '#f4f1ea']), w: 4, n: 2 });
  const bt = s.mass('stairTower', { x0: cx + hw + 4, x1: cx + hw + 7, z0: z0 - 6, z1: z0 - 3 }, 1, rng.range(14, 20), jitter('#b9b4aa', rng, 0.03), { parapet: false, color: '#8f9499' });
  s.props.push({ kind: 'finial', x: cx + hw + 5.5, y: massTop(bt), z: z0 - 4.5, rot: 0, color: '#3a3d40', w: 2.5, n: 2 });
  s.height = Math.max(apex, massTop(bt)) + 4;
  s.paths.push({ x0: cx - 6, x1: cx + 6, z0: 0, z1: z0 });
  if (W - (cx + hw + 9) > 8) s.parking({ x0: cx + hw + 9, x1: W - 2, z0: z0, z1: D - 4 });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 6);
}

function orthodox(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#f4f1ea', '#cfe0ef', '#f3e3a6', '#f2d0d0', '#d6ead6']), rng, 0.02);
  const domeC = rng.pick([GOLD, '#2e5fa8', '#2f7a4a', GOLD]);
  const roof = '#5f8a7a';
  const cx = W / 2;
  const zc = D * 0.55;
  const c = 6;
  const core = s.mass('main', { x0: cx - c, x1: cx + c, z0: zc - c, z1: zc + c }, 1, 11, wall, { parapet: true, color: roof });
  const arm = (r: Rect, axis: 'x' | 'z') => s.mass('wing', r, 1, 8, wall, { type: 'gable', axis, pitch: 0.55, color: roof, parapet: false, overhang: 0.3 });
  const front = arm({ x0: cx - 4, x1: cx + 4, z0: zc - c - 7, z1: zc - c }, 'z');
  arm({ x0: cx - 4, x1: cx + 4, z0: zc + c, z1: zc + c + 6 }, 'z');
  arm({ x0: cx - c - 6, x1: cx - c, z0: zc - 4, z1: zc + 4 }, 'x');
  arm({ x0: cx + c, x1: cx + c + 6, z0: zc - 4, z1: zc + 4 }, 'x');
  for (const m of s.masses) arches(s, m, 'arch', 3, 1.0, 2.6, 1.6);
  archDoor(s, front, 'front', 0.5, 2.4, 3.8, 'arch');
  const top = massTop(core);
  s.props.push({ kind: 'dome', x: cx, y: top, z: zc, rot: 0, color: domeC, color2: wall, w: 3.6, n: 1, d: 4, h: 4.5 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.props.push({ kind: 'dome', x: cx + sx * (c - 1.6), y: top, z: zc + sz * (c - 1.6), rot: 0, color: domeC, color2: wall, w: 1.5, n: 1, d: 4, h: 2.4 });
  const bt = s.mass('stairTower', { x0: cx - 2.5, x1: cx + 2.5, z0: zc - c - 13, z1: zc - c - 8 }, 3, 5.5, wall, { parapet: true, color: roof });
  arches(s, bt, 'arch', 2.5, 1.0, 2.2, 1.6, undefined, [2]);
  archDoor(s, bt, 'front', 0.5, 2, 3.2, 'arch');
  s.props.push({ kind: 'churchSpire', x: cx, y: massTop(bt), z: (bt.rect.z0 + bt.rect.z1) / 2, rot: 0, color: wall, color2: domeC, w: 2.5, h: 5, n: 3 });
  s.height = Math.max(top + 4.5 + domeTop(1, 3.6) + 4, massTop(bt) + 10);
  s.paths.push({ x0: cx - 2, x1: cx + 2, z0: 0, z1: zc - c - 13 });
  s.fence('iron', '#2b2b2b', 1.4, [[cx - 2.5, cx + 2.5]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 8, [['cone', 2], ['round', 2]]);
}

// ---------------------------------------------------------------- Hindu temples

function nagara(s: Site): void {
  const { rng, W, D } = s;
  const stone = jitter(rng.pick(['#e3b27c', MARBLE, '#f6d7a0', '#e8c9a0', '#f0e0c8']), rng, 0.03);
  const accent = rng.pick(['#c0392b', '#e67e22', SAFFRON]);
  const cx = W / 2;
  const pw = Math.min(W - 12, 30);
  const pz0 = 14;
  const pz1 = Math.min(D - 6, pz0 + 30);
  const plat = s.mass('unit', { x0: cx - pw / 2, x1: cx + pw / 2, z0: pz0, z1: pz1 }, 1, 1.6, jitter(stone, rng, 0.05), { parapet: false, color: stone });
  const by = massTop(plat);
  s.porches.push({ kind: 'stoop', rect: { x0: cx - 4, x1: cx + 4, z0: pz0 - 0.1, z1: pz0 }, floorY: 1.6, roofY: 4, stepX: cx, floorColor: stone, roofColor: stone, postColor: accent });
  const mand = s.mass('main', { x0: cx - 7, x1: cx + 7, z0: pz0 + 4, z1: pz0 + 16 }, 1, 5, stone, { type: 'hip', axis: 'x', pitch: 0.95, color: stone, parapet: false, overhang: 0.6 }, { baseY: by });
  arches(s, mand, 'arch', 3.2, 1.3, 2.4, 1, ['left', 'right']);
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 5, x1: cx + 5, z0: pz0 + 1, z1: pz0 + 4 }, floorY: by, roofY: by + 4.2, stepX: cx, floorColor: stone, roofColor: stone, postColor: stone });
  archDoor(s, mand, 'front', 0.5, 2.4, 3.4, 'arch');
  const sanct = s.mass('wing', { x0: cx - 5, x1: cx + 5, z0: pz0 + 16, z1: pz0 + 26 }, 1, 5.5, stone, { parapet: false, color: stone }, { baseY: by });
  const sh = rng.range(16, 24);
  s.props.push({ kind: 'shikhara', x: cx, y: massTop(sanct), z: (sanct.rect.z0 + sanct.rect.z1) / 2, rot: 0, color: stone, color2: jitter(stone, rng, 0.08), w: 5, h: sh, n: 0 });
  s.props.push({ kind: 'flagpole', x: cx + 0.4, y: massTop(sanct) + sh + 1.6, z: (sanct.rect.z0 + sanct.rect.z1) / 2, rot: 0, color: SAFFRON, color2: SAFFRON, h: 3 });
  s.height = massTop(sanct) + sh + 6;
  // Small shrine in the corner, a sacred tree, flower stalls by the gate, bells.
  if (W - (cx + pw / 2) > 8) {
    const sh2 = s.mass('unit', { x0: W - 7, x1: W - 3, z0: pz0, z1: pz0 + 4 }, 1, 2.6, stone, { parapet: false, color: stone });
    s.props.push({ kind: 'shikhara', x: W - 5, y: massTop(sh2), z: pz0 + 2, rot: 0, color: stone, color2: stone, w: 1.6, h: 4.5, n: 0 });
  }
  s.trees.push({ kind: 'round', x: 5, z: pz0 + 6, scale: 1.6, rot: 0, color: jitter('#4f8a3a', rng, 0.05), trunkColor: '#6b4a33' });
  for (let i = 0; i < rng.int(1, 3); i++) s.props.push({ kind: 'stall', x: 4 + i * 3, y: 0.05, z: 3, rot: 0, color: rng.pick(['#e74c3c', '#f1c40f', SAFFRON]) });
  s.paths.push({ x0: cx - 4, x1: cx + 4, z0: 0, z1: pz0 }, { x0: 2, x1: W - 2, z0: pz0 - 3, z1: pz0 });
  s.fence('privacy', jitter(stone, rng, 0.05), 1.8, [[cx - 4, cx + 4]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 4);
}

function dravidian(s: Site): void {
  const { rng, W, D } = s;
  const stone = jitter(rng.pick(['#d8c9a3', '#cdbb96', '#e2d3ad']), rng, 0.03);
  const cx = W / 2;
  const wz0 = 14;
  // Compound wall entered through the gopuram.
  const gw = Math.min(24, W * 0.3);
  const gh = rng.range(32, 46);
  s.fences.push({ kind: 'privacy', color: stone, height: 4.5, segments: [
    { x0: 4, z0: wz0, x1: cx - gw / 2, z1: wz0 }, { x0: cx + gw / 2, z0: wz0, x1: W - 4, z1: wz0 },
    { x0: 4, z0: wz0, x1: 4, z1: D - 4 }, { x0: W - 4, z0: wz0, x1: W - 4, z1: D - 4 }, { x0: 4, z0: D - 4, x1: W - 4, z1: D - 4 },
  ] });
  s.props.push({ kind: 'gopuram', x: cx, y: 0.05, z: wz0, rot: 0, color: jitter('#e9d9b0', rng, 0.04), color2: rng.pick(['#c0392b', '#2e86de', '#27ae60']), w: gw, d: 11, h: gh });
  s.reserved.push({ x0: cx - gw / 2 - 1, x1: cx + gw / 2 + 1, z0: wz0 - 6.5, z1: wz0 + 6.5 });
  // Pillared hall + sanctum under a vimana.
  const zc = wz0 + (D - 4 - wz0) * 0.62;
  const mand = s.mass('main', { x0: cx - 9, x1: cx + 9, z0: zc - 16, z1: zc - 4 }, 1, 5, stone, { parapet: true, color: stone });
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 9, x1: cx + 9, z0: zc - 20, z1: zc - 16 }, floorY: 0.4, roofY: 4.6, stepX: cx, floorColor: stone, roofColor: stone, postColor: stone });
  archDoor(s, mand, 'front', 0.5, 2.6, 3.6, 'arch');
  const sanct = s.mass('wing', { x0: cx - 6, x1: cx + 6, z0: zc - 4, z1: zc + 8 }, 1, 6, stone, { parapet: false, color: stone });
  const vh = rng.range(14, 20);
  s.props.push({ kind: 'shikhara', x: cx, y: massTop(sanct), z: zc + 2, rot: 0, color: stone, color2: jitter('#e9d9b0', rng, 0.04), w: 6, h: vh, n: 1 });
  s.props.push({ kind: 'flagpole', x: cx, y: 0.05, z: zc - 23, rot: 0, color: GOLD, color2: GOLD, h: 12 });
  s.height = Math.max(gh, massTop(sanct) + vh) + 4;
  // Temple tank with a pavilion in the middle.
  const tank: Rect = { x0: 9, x1: Math.min(cx - 13, 9 + 22), z0: wz0 + 10, z1: wz0 + 30 };
  if (tank.x1 - tank.x0 > 8 && tank.z1 < D - 8) {
    s.pool = tank;
    s.props.push({ kind: 'chhatri', x: (tank.x0 + tank.x1) / 2, y: 0.05, z: (tank.z0 + tank.z1) / 2, rot: 0, color: stone, color2: stone, w: 1.6, h: 2.6, n: 0 });
  }
  s.paths.push({ x0: cx - 5, x1: cx + 5, z0: 0, z1: zc - 20 });
  s.trees_({ x0: 5, x1: W - 5, z0: wz0 + 1, z1: D - 5 }, 10, [['palm', 4], ['round', 1]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: wz0 - 1 }, 3, [['palm', 1]]);
}

// ---------------------------------------------------------------- gurdwara

function gurdwara(s: Site): void {
  const { rng, W, D } = s;
  const white = jitter('#f4f1ea', rng, 0.01);
  const cx = W / 2;
  const inPool = rng.chance(0.4);
  s.info.layout = inPool ? 'darbar in the sarovar' : 'sarovar beside';
  s.pavingColor = jitter(MARBLE, rng, 0.02);
  const hs = 9;
  let dz: number;
  if (inPool) {
    // Sarovar filling the middle, Darbar Sahib on an island reached by a causeway.
    const pool: Rect = { x0: 8, x1: W - 8, z0: 22, z1: D - 8 };
    s.paths.push({ x0: 4, x1: W - 4, z0: 18, z1: D - 4 });
    s.water.push({ pts: rectPoly(pool), shore: MARBLE, y: 0.06 });
    dz = (pool.z0 + pool.z1) / 2;
    s.paths.push({ x0: cx - 3, x1: cx + 3, z0: 18, z1: dz });
    s.plazas.push({ x: cx, z: dz, r: hs + 3 });
    const rc = rng.pick(['#7a1f2b', '#2f4f7a', '#8e1c24']);
    runner(s, 6, 20, cx - 4, 20, rc);
    runner(s, cx + 4, 20, W - 6, 20, rc);
    runner(s, 6, D - 6, W - 6, D - 6, rc);
    runner(s, 6, 20.9, 6, D - 6.9, rc);
    runner(s, W - 6, 20.9, W - 6, D - 6.9, rc);
    runner(s, cx, 21, cx, dz - hs - 3.2, rc);
  } else {
    dz = D * 0.62;
    const pool: Rect = { x0: 6, x1: cx - hs - 6, z0: 22, z1: D - 8 };
    if (pool.x1 - pool.x0 > 8) {
      s.paths.push({ x0: 3, x1: pool.x1 + 3, z0: 19, z1: D - 5 });
      s.water.push({ pts: rectPoly(pool), shore: MARBLE, y: 0.06 });
      const rc = rng.pick(['#7a1f2b', '#2f4f7a', '#8e1c24']);
      runner(s, pool.x0, pool.z0 - 1.6, pool.x1, pool.z0 - 1.6, rc);
      runner(s, pool.x1 + 1.6, pool.z0, pool.x1 + 1.6, pool.z1, rc);
    }
    s.paths.push({ x0: cx - hs - 4, x1: cx + hs + 4, z0: dz - hs - 4, z1: dz + hs + 4 });
  }
  const darbar = s.mass('main', { x0: cx - hs, x1: cx + hs, z0: dz - hs, z1: dz + hs }, 2, 5, white, { parapet: true, color: white });
  arches(s, darbar, 'arch', 3, 1.3, 2.6, 1.0);
  for (const side of ['front', 'back', 'left', 'right'] as WallSide[]) archDoor(s, darbar, side, 0.5, 2.4, 3.6, 'arch');
  const top = massTop(darbar);
  const r = hs * 0.55;
  s.props.push({ kind: 'dome', x: cx, y: top, z: dz, rot: 0, color: GOLD, color2: white, w: r, n: 3, d: 3, h: 1.2 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.props.push({ kind: 'chhatri', x: cx + sx * (hs - 1.4), y: top, z: dz + sz * (hs - 1.4), rot: 0, color: white, color2: GOLD, w: 1.1, h: 2.2, n: 3 });
  s.height = top + 1.2 + domeTop(3, r) + 3;
  // Nishan Sahib, langar hall, gateway.
  const nh = rng.range(22, 30);
  s.props.push({ kind: 'nishanSahib', x: cx + hs + 7, y: 0.05, z: inPool ? 14 : dz - hs - 2, rot: 0, color: SAFFRON, h: nh });
  s.height = Math.max(s.height, nh + 3);
  const lx0 = inPool ? W - 24 : cx + hs + 12;
  if (!inPool && W - 4 - lx0 > 8) {
    const langar = s.mass('wing', { x0: lx0, x1: W - 4, z0: dz - 4, z1: Math.min(D - 4, dz + 18) }, 1, 4.5, white, { parapet: true, color: '#c9c4b8' });
    arches(s, langar, 'arch', 3.4, 1.4, 2.2, 1.0);
    archDoor(s, langar, 'left', 0.3, 2.2, 3, 'arch');
    s.sign(langar, 'left', 0.6, 3.3, 6, 0.7, SAFFRON);
  }
  const gate = s.mass('wing', { x0: cx - 6, x1: cx + 6, z0: 6, z1: 12 }, 1, 7, white, { parapet: true, color: white });
  archDoor(s, gate, 'front', 0.5, 3.4, 5, 'arch');
  archDoor(s, gate, 'back', 0.5, 3.4, 5, 'arch');
  for (const sx of [-1, 1]) s.props.push({ kind: 'chhatri', x: cx + sx * 4.8, y: massTop(gate), z: 9, rot: 0, color: white, color2: GOLD, w: 0.9, h: 1.8, n: 3 });
  s.sign(gate, 'front', 0.5, 5.4, 7, 0.8, SAFFRON);
  s.paths.push({ x0: cx - 4, x1: cx + 4, z0: 0, z1: 6 }, { x0: cx - 3, x1: cx + 3, z0: 12, z1: 19 });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 6);
}

// ---------------------------------------------------------------- Buddhist

function pagodaTemple(s: Site): void {
  const { rng, W, D } = s;
  const red = jitter(rng.pick(['#a33a2a', '#8c2f22', '#b5473a']), rng, 0.03);
  const tile = rng.pick(['#3f4a4f', '#2f3b33', '#4a4f5a']);
  const cx = W / 2;
  s.pavingColor = jitter('#cfc8bb', rng, 0.03);
  s.props.push({ kind: 'gateArch', x: cx, y: 0.05, z: 3, rot: 0, color: red, color2: red, w: 7, h: 6 });
  const hz0 = D * 0.5;
  const hall = s.mass('main', { x0: cx - 11, x1: cx + 11, z0: hz0, z1: hz0 + 13 }, 1, 6, red, { type: 'hip', axis: 'x', pitch: 0.65, color: tile, parapet: false, overhang: 1.6 });
  s.windows(hall, { bay: 2.6, w: 1.8, h: 3, sill: 1, style: 'georgian', frame: '#6b4a33', sides: ['front', 'left', 'right'], litChance: 0.6 });
  s.opening(hall, 'front', 0.5, 'door', 2.6, 3.4, '#6b4a33');
  const tiers = rng.pick([3, 5, 5, 7]);
  const ph = tiers * rng.range(4, 5);
  const px = cx + (rng.chance(0.5) ? -1 : 1) * Math.min(20, W / 2 - 9);
  s.props.push({ kind: 'pagoda', x: px, y: 0.05, z: hz0 - 11, rot: 0, color: rng.chance(0.5) ? red : '#f4f1ea', color2: tile, w: Math.min(4.2, 2 + tiers * 0.3), h: ph, n: tiers });
  s.reserved.push({ x0: px - 8, x1: px + 8, z0: hz0 - 19, z1: hz0 - 3 });
  s.height = Math.max(ph, 6 + 11 * 0.65 + 2) + 2;
  s.info.tiers = tiers;
  // Garden: pond with a red bridge, stone lanterns along the walk.
  s.paths.push({ x0: cx - 2.5, x1: cx + 2.5, z0: 0, z1: hz0 });
  for (let z = 8; z < hz0 - 2; z += 7) for (const sx of [-1, 1]) s.props.push({ kind: 'stoneLantern', x: cx + sx * 3.6, y: 0.05, z, rot: 0, color: '#a39d92' });
  const ox = px < cx ? cx + 16 : cx - 16;
  if (Math.abs(ox - cx) + 10 < W / 2) {
    s.water.push({ pts: rectPoly({ x0: ox - 8, x1: ox + 8, z0: 10, z1: 22 }).map(([x, z], i) => [x + (i % 2 ? 1.5 : -1), z + (i < 2 ? 1 : -1)]) as [number, number][] });
    s.props.push({ kind: 'footbridge', x: ox, y: 0.02, z: 16, rot: Math.PI / 2, color: red, color2: red, w: 2, d: 18, h: 1.4 });
  }
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 12, [['round', 2], ['cone', 2]]);
  for (const t of s.trees) if (rng.chance(0.3)) t.color = jitter('#e8a7c0', rng, 0.05); // cherry blossom
}

function stupaTemple(s: Site): void {
  const { rng, W, D } = s;
  const white = jitter('#f4f1ea', rng, 0.01);
  const cx = W / 2;
  const r = Math.min(9, W * 0.13);
  const zc = D * 0.55;
  s.plazas.push({ x: cx, z: zc, r: r * 1.7 + 3.5, color: jitter('#d8cdb8', rng, 0.03) });
  s.props.push({ kind: 'stupa', x: cx, y: 0.05, z: zc, rot: 0, color: white, color2: GOLD, w: r });
  s.reserved.push({ x0: cx - r * 2.6, x1: cx + r * 2.6, z0: zc - r * 2.6, z1: zc + r * 2.6 });
  s.height = r * 3.8 + 3;
  // Ring of small chortens round the walk.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    s.props.push({ kind: 'stupa', x: cx + Math.cos(a) * (r * 1.7 + 6), y: 0.05, z: zc + Math.sin(a) * (r * 1.7 + 6), rot: 0, color: white, color2: GOLD, w: 0.9 });
  }
  // Monastery (vihara) to one side.
  const mx0 = cx + r * 1.7 + 9;
  if (W - 3 - mx0 > 8) {
    const mon = s.mass('main', { x0: mx0, x1: W - 3, z0: zc - 12, z1: zc + 6 }, 2, 3.6, rng.pick([white, '#8c2f22', '#f3d36b']), { type: 'hip', axis: 'z', pitch: 0.5, color: rng.pick(['#c9a648', '#a33a2a']), parapet: false, overhang: 1 });
    s.windows(mon, { bay: 2.8, w: 1.4, h: 1.6, sill: 0.9, style: 'casement', frame: '#a33a2a', litChance: 0.6 });
    s.opening(mon, 'left', 0.5, 'door', 2.2, 2.8, '#a33a2a');
  }
  s.paths.push({ x0: cx - 2.5, x1: cx + 2.5, z0: 0, z1: zc - r * 1.7 - 3 });
  s.props.push({ kind: 'gateArch', x: cx, y: 0.05, z: 2.5, rot: 0, color: '#a33a2a', color2: '#f3d36b', w: 6.5, h: 5 });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 10);
}

const GENERATORS: Record<WorshipStyle, (s: Site) => void> = {
  mughal, ottoman, modernMosque, localMosque, gothic, colonial, modernChurch, orthodox, nagara, dravidian, gurdwara, pagoda: pagodaTemple, stupa: stupaTemple,
};

export function generateWorship(spec: WorshipSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const s = new Site(rng, spec.lotWidth, spec.lotDepth, spec.details ?? DEFAULT_DETAILS, spec.seed, spec.style);
  s.info.type = 'worship';
  s.info.faith = WORSHIP_STYLES[spec.style].faith;
  GENERATORS[spec.style](s);
  return s.model(`worship:${spec.style}`);
}
