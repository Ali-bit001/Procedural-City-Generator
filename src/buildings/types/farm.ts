/**
 * Farms:
 *   crop       -> farmyard (farmhouse with porch, red barn, silos, machinery: tractor, combine, bales,
 *                 windpump) + 2-4 fields of different crops split by dirt tracks, one under centre-pivot
 *                 irrigation; round bales on the harvested field; wooden fence
 *   dairy      -> cow sheds with cows, milking parlour, feed silos, hay barn, fenced paddocks with
 *                 grazing cows, farmhouse, tractor
 *   orchard    -> rows of fruit trees in blocks, packing shed, tractor with a trolley of crates
 *   greenhouse -> rows of glass greenhouses, packing hall, water tower, car park
 *   village    -> South Asian dera: mud-brick courtyard house, charpais, cattle shade with buffaloes and
 *                 cows, conical haystacks, tubewell gushing into a little pool, tractor-trolley, wheat /
 *                 sugarcane / rice fields, shade trees
 */
import { RNG } from '../../core/rng';
import { DEFAULT_DETAILS, massTop, type Court, type DetailOptions, type HouseModel, type Rect } from '../spec';
import { Site, jitter } from './civic/site';

export type FarmStyle = 'crop' | 'dairy' | 'orchard' | 'greenhouse' | 'village';
export const FARM_STYLES: FarmStyle[] = ['crop', 'dairy', 'orchard', 'greenhouse', 'village'];
export const FARM_LOTS: Record<FarmStyle, [number, number, number, number]> = {
  crop: [150, 200, 130, 170],
  dairy: [130, 170, 120, 150],
  orchard: [120, 160, 110, 150],
  greenhouse: [110, 150, 100, 140],
  village: [110, 150, 100, 140],
};

export function farmLotSize(rng: RNG, style: FarmStyle): { w: number; d: number } {
  const [w0, w1, d0, d1] = FARM_LOTS[style];
  return { w: rng.range(w0, w1), d: rng.range(d0, d1) };
}

export interface FarmSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style: FarmStyle;
  details?: DetailOptions;
}

type Crop = NonNullable<Court['crop']>;
const DIRT = '#a08560';
const WOOD = '#8a6a4a';

function field(s: Site, r: Rect, crop: Crop): void {
  s.courts.push({ kind: 'field', rect: r, crop });
}

/** Split a rect into n strips along its longer side, with tracks between. */
function strips(r: Rect, n: number, gap: number): Rect[] {
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    if (alongX) {
      const w = (r.x1 - r.x0 - gap * (n - 1)) / n;
      out.push({ x0: r.x0 + i * (w + gap), x1: r.x0 + i * (w + gap) + w, z0: r.z0, z1: r.z1 });
    } else {
      const d = (r.z1 - r.z0 - gap * (n - 1)) / n;
      out.push({ x0: r.x0, x1: r.x1, z0: r.z0 + i * (d + gap), z1: r.z0 + i * (d + gap) + d });
    }
  }
  return out;
}

function farmhouse(s: Site, x0: number, z0: number): void {
  const { rng } = s;
  const wall = jitter(rng.pick(['#f4f1ea', '#efe4cf', '#e2d6bf', '#d9cfbd']), rng, 0.03);
  const m = s.mass('main', { x0, x1: x0 + 12, z0, z1: z0 + 9 }, 2, 3, wall, { type: 'gable', axis: 'x', pitch: 0.6, color: rng.pick(['#6b4a3a', '#5a6670', '#a0473a']), parapet: false, overhang: 0.4 });
  s.windows(m, { bay: 2.6, w: 1.1, h: 1.4, sill: 0.9, style: 'casement', frame: '#f4f1ea', litChance: 0.5 });
  s.opening(m, 'front', 0.5, 'door', 1.1, 2.2, '#6b4a33');
  s.porches.push({ kind: 'porch', rect: { x0: x0 + 2, x1: x0 + 10, z0: z0 - 2.2, z1: z0 }, floorY: 0.4, roofY: 2.9, stepX: x0 + 6, floorColor: '#8a6a4a', roofColor: '#6b4a3a', postColor: '#f4f1ea' });
}

function barn(s: Site, x0: number, z0: number, w = 16, d = 22): void {
  const { rng } = s;
  const red = jitter(rng.pick(['#a33a2a', '#8c2f22', '#b5473a', '#7a6a5a']), rng, 0.03);
  const m = s.mass('main', { x0, x1: x0 + w, z0, z1: z0 + d }, 1, 7, red, { type: 'gable', axis: 'z', pitch: 0.95, color: '#4a4f55', parapet: false, overhang: 0.4 });
  s.opening(m, 'front', 0.5, 'garageDoor', 5, 5.2, '#f4f1ea', 'garage');
  s.windows(m, { bay: 5, w: 1, h: 1, sill: 4.5, style: 'plain', frame: '#f4f1ea', sides: ['left', 'right'], litChance: 0.2 });
}

function crop(s: Site): void {
  const { rng, W, D } = s;
  // Farmyard in the front-left corner.
  const yx1 = Math.min(64, W * 0.38);
  const yz1 = Math.min(58, D * 0.42);
  s.parkingLots.push({ rect: { x0: 4, x1: yx1, z0: 6, z1: yz1 }, rows: [], stallWidth: 3, color: jitter(DIRT, rng, 0.05) });
  farmhouse(s, 8, 16);
  barn(s, 26, 14);
  const nSilo = rng.int(1, 3);
  for (let i = 0; i < nSilo; i++) s.props.push({ kind: 'silo', x: 47 + i * 7, y: 0.05, z: 20, rot: 0, color: rng.pick(['#c9ccd1', '#9fb0bf', '#e9e6df']), color2: '#8f959c', w: 3, h: rng.range(12, 18) });
  s.props.push({ kind: 'tractor', x: 20, y: 0.05, z: 44, rot: Math.PI / 2, color: rng.pick(['#c0392b', '#2e7d32', '#1f6fb5', '#f39c12']), color2: '#f4f1ea' });
  if (rng.chance(0.7)) s.props.push({ kind: 'harvester', x: 40, y: 0.05, z: 46, rot: -Math.PI / 2, color: rng.pick(['#2e7d32', '#c0392b', '#f2c94c']), color2: '#c9a648' });
  for (let i = 0; i < 6; i++) s.props.push({ kind: 'hayBale', x: 8 + (i % 3) * 1.9, y: 0.05, z: 48 + Math.floor(i / 3) * 1.6, rot: 0, color: '#d9b86a', color2: '#b8973d', n: 0 });
  s.props.push({ kind: 'windpump', x: yx1 - 6, y: 0.05, z: yz1 - 6, rot: 0, color: '#c9ccd1', color2: '#c0392b', h: 10 });
  s.paths.push({ x0: 28, x1: 33, z0: 0, z1: 14 });
  // Fields: the rest of the lot, split by tracks.
  const crops: Crop[] = ['wheat', 'maize', 'ploughed', 'stubble', 'vegetables', 'pasture'];
  const fieldsR = strips({ x0: yx1 + 6, x1: W - 4, z0: 6, z1: D - 4 }, rng.int(2, 3), 5);
  const back = { x0: 4, x1: yx1, z0: yz1 + 6, z1: D - 4 };
  fieldsR.push(back);
  fieldsR.forEach((r, i) => {
    const c = crops[(i + rng.int(0, 5)) % crops.length];
    field(s, r, c);
    if (c === 'stubble') for (let k = 0; k < 10; k++) s.props.push({ kind: 'hayBale', x: rng.range(r.x0 + 3, r.x1 - 3), y: 0.08, z: rng.range(r.z0 + 3, r.z1 - 3), rot: rng.range(0, 3), color: '#d9b86a', color2: '#b8973d', n: 0 });
  });
  for (let i = 0; i < fieldsR.length - 2; i++) s.paths.push({ x0: fieldsR[i].x1, x1: fieldsR[i + 1].x0, z0: 6, z1: D - 4 });
  s.pavingColor = jitter(DIRT, rng, 0.05);
  // Centre-pivot irrigation on the biggest field.
  const big = fieldsR.slice(0, -1).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0];
  if (big && rng.chance(0.6)) {
    const cx = (big.x0 + big.x1) / 2;
    const cz = (big.z0 + big.z1) / 2;
    s.props.push({ kind: 'pivotIrrigation', x: cx, y: 0.05, z: cz, rot: rng.range(0, 6.28), color: '#c9ccd1', w: Math.min(big.x1 - big.x0, big.z1 - big.z0) / 2 - 3 });
  }
  s.fence('picket', WOOD, 1.2, [[28, 33]]);
  s.trees_({ x0: 0, x1: yx1, z0: 0, z1: yz1 }, 6);
  s.height = 22;
}

function dairy(s: Site): void {
  const { rng, W, D } = s;
  s.parkingLots.push({ rect: { x0: 4, x1: W * 0.55, z0: 6, z1: D * 0.5 }, rows: [], stallWidth: 3, color: jitter('#9a8a70', rng, 0.05) });
  farmhouse(s, 6, 12);
  // Cow sheds with cows inside, milking parlour, feed silos, hay barn.
  const sheds = 2;
  for (let i = 0; i < sheds; i++) {
    const x = 24 + i * 0;
    const z = 14 + i * 18;
    const w = Math.min(40, W * 0.55 - 30);
    s.props.push({ kind: 'openShed', x: x + w / 2, y: 0.05, z: z + 6, rot: 0, color: '#8f959c', color2: '#b5aa98', w, d: 12, h: 4, n: 1 });
    s.reserved.push({ x0: x, x1: x + w, z0: z, z1: z + 12 });
    for (let k = 0; k < Math.floor(w / 3.2); k++) s.props.push({ kind: 'animal', x: x + 1.8 + k * 3.2, y: 0.07, z: z + 6.5 + rng.range(-1, 1), rot: Math.PI + rng.range(-0.3, 0.3), color: '#f2efe8', n: 10 });
  }
  const parlour = s.mass('main', { x0: 24, x1: 40, z0: 52, z1: 62 }, 1, 4, jitter('#e9e6df', rng, 0.03), { type: 'gable', axis: 'x', pitch: 0.4, color: '#5a6670', parapet: false, overhang: 0.4 });
  s.windows(parlour, { bay: 3, w: 1.2, h: 0.8, sill: 2.2, style: 'plain', frame: '#5a6670', litChance: 0.6 });
  for (let i = 0; i < 3; i++) s.props.push({ kind: 'silo', x: 46 + i * 5, y: 0.05, z: 56, rot: 0, color: rng.pick(['#c9ccd1', '#2f6db5']), color2: '#8f959c', w: 2, h: 10 });
  s.props.push({ kind: 'openShed', x: 14, y: 0.05, z: D * 0.5 - 10, rot: 0, color: '#6b6e72', color2: '#b5aa98', w: 16, d: 10, h: 5 });
  for (let i = 0; i < 12; i++) s.props.push({ kind: 'hayBale', x: 8 + (i % 6) * 1.25, y: 0.05 + Math.floor(i / 6) * 0.45, z: D * 0.5 - 10, rot: 0, color: '#d9b86a', color2: '#b8973d', n: 1 });
  s.props.push({ kind: 'tractor', x: W * 0.5, y: 0.05, z: 20, rot: Math.PI / 2, color: rng.pick(['#2e7d32', '#c0392b']), color2: '#f4f1ea', n: 1 });
  // Fenced paddocks with grazing cows.
  const pad: Rect = { x0: W * 0.55 + 6, x1: W - 4, z0: 6, z1: D - 4 };
  const back: Rect = { x0: 4, x1: W * 0.55, z0: D * 0.5 + 6, z1: D - 4 };
  for (const r of [...strips(pad, 2, 3), back]) {
    field(s, r, 'pasture');
    s.fences.push({ kind: 'picket', color: WOOD, height: 1.3, segments: [
      { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0 }, { x0: r.x0, z0: r.z1, x1: r.x1, z1: r.z1 },
      { x0: r.x0, z0: r.z0, x1: r.x0, z1: r.z1 }, { x0: r.x1, z0: r.z0, x1: r.x1, z1: r.z1 },
    ] });
    const n = Math.round(((r.x1 - r.x0) * (r.z1 - r.z0)) / 260);
    for (let k = 0; k < n; k++) s.props.push({ kind: 'animal', x: rng.range(r.x0 + 3, r.x1 - 3), y: 0.08, z: rng.range(r.z0 + 3, r.z1 - 3), rot: rng.range(0, 6.28), color: '#f2efe8', n: rng.chance(0.85) ? 10 : 12 });
  }
  s.trees_({ x0: 0, x1: W, z0: 0, z1: 8 }, 5);
  s.height = 14;
}

function orchard(s: Site): void {
  const { rng, W, D } = s;
  farmhouse(s, 6, 12);
  const shed = s.mass('main', { x0: 24, x1: 46, z0: 10, z1: 24 }, 1, 6, jitter('#9fb0bf', rng, 0.04), { type: 'gable', axis: 'x', pitch: 0.3, color: '#6b6e72', parapet: false, overhang: 0.4 });
  s.opening(shed, 'front', 0.5, 'garageDoor', 5, 4.2, '#c9ccd1', 'garage');
  s.parkingLots.push({ rect: { x0: 4, x1: 50, z0: 2, z1: 9 }, rows: [], stallWidth: 3, color: jitter(DIRT, rng, 0.05) });
  s.props.push({ kind: 'tractor', x: 36, y: 0.05, z: 30, rot: Math.PI / 2, color: rng.pick(['#2e7d32', '#c0392b', '#1f6fb5']), color2: '#8a6a4a', n: 1 });
  // Blocks of fruit trees in rows on grass.
  const blocks = [{ x0: 54, x1: W - 4, z0: 6, z1: D - 4 }, { x0: 4, x1: 50, z0: 36, z1: D - 4 }];
  const fruit = rng.pick(['#e8a7c0', '#f4f1ea', '#c0392b', '#f39c12']);
  let trees = 0;
  for (const r of blocks) {
    field(s, r, 'pasture');
    const sp = rng.range(7, 8.5);
    for (let x = r.x0 + 3; x < r.x1 - 2; x += sp) {
      for (let z = r.z0 + 3; z < r.z1 - 2; z += sp * 0.85) {
        s.trees.push({ kind: 'round', x, z, scale: rng.range(0.6, 0.78), rot: rng.range(0, 6.28), color: rng.chance(0.35) ? jitter(fruit, rng, 0.05) : jitter('#4f8a3a', rng, 0.06), trunkColor: '#6b4a33' });
        trees++;
      }
    }
  }
  s.info.trees = trees;
  s.fence('picket', WOOD, 1.2, [[24, 30]]);
  s.height = 10;
}

function greenhouse(s: Site): void {
  const { rng, W, D } = s;
  const hall = s.mass('main', { x0: 6, x1: 40, z0: 10, z1: 30 }, 1, 7, jitter('#e9e6df', rng, 0.03), { color: '#8f959c' });
  s.windows(hall, { bay: 4, w: 2, h: 1.4, sill: 4, style: 'ribbon', frame: '#3a3d40', litChance: 0.6 });
  s.opening(hall, 'front', 0.3, 'garageDoor', 4, 4.4, '#c9ccd1', 'garage');
  s.opening(hall, 'front', 0.75, 'door', 1.2, 2.3, '#3a3d40');
  s.parking({ x0: 6, x1: 40, z0: 34, z1: 46 });
  s.props.push({ kind: 'waterTowerTall', x: 24, y: 0.05, z: D - 14, rot: 0, color: '#9fb0bf', color2: '#8f959c', h: 14, w: 3.5, n: rng.pick([1, 2]) });
  // Rows of glasshouses.
  const gw = 8;
  const gd = Math.min(60, D - 16);
  let n = 0;
  for (let x = 48; x + gw < W - 4; x += gw + 2.5) {
    s.props.push({ kind: 'greenhouse', x: x + gw / 2, y: 0.05, z: 8 + gd / 2, rot: 0, color: '#bcd3da', w: gw, d: gd });
    s.reserved.push({ x0: x, x1: x + gw, z0: 8, z1: 8 + gd });
    n++;
  }
  s.paths.push({ x0: 44, x1: W - 4, z0: 8 + gd + 1, z1: 8 + gd + 4 });
  if (D - 8 - gd - 8 > 12) field(s, { x0: 48, x1: W - 4, z0: 8 + gd + 6, z1: D - 4 }, 'vegetables');
  s.info.greenhouses = n;
  s.trees_({ x0: 0, x1: 44, z0: 46, z1: D }, 6);
  s.height = 20;
}

function village(s: Site): void {
  const { rng, W, D } = s;
  const mud = jitter(rng.pick(['#b08a62', '#a88358', '#c19a6b']), rng, 0.04);
  // Walled courtyard house (haveli-style dera) at the front.
  const c: Rect = { x0: 6, x1: Math.min(48, W * 0.36), z0: 8, z1: Math.min(44, D * 0.38) };
  s.fences.push({ kind: 'privacy', color: mud, height: 2.4, segments: [
    { x0: c.x0, z0: c.z0, x1: (c.x0 + c.x1) / 2 - 2, z1: c.z0 }, { x0: (c.x0 + c.x1) / 2 + 2, z0: c.z0, x1: c.x1, z1: c.z0 },
    { x0: c.x0, z0: c.z1, x1: c.x1, z1: c.z1 }, { x0: c.x0, z0: c.z0, x1: c.x0, z1: c.z1 }, { x0: c.x1, z0: c.z0, x1: c.x1, z1: c.z1 },
  ] });
  s.parkingLots.push({ rect: c, rows: [], stallWidth: 3, color: jitter('#c9b08a', rng, 0.04) });
  const rooms = s.mass('main', { x0: c.x0 + 0.4, x1: c.x1 - 0.4, z0: c.z1 - 7, z1: c.z1 - 0.4 }, 1, 3.2, mud, { parapet: true, color: jitter(mud, rng, 0.04) });
  s.windows(rooms, { bay: 4, w: 0.9, h: 1, sill: 1, style: 'casement', frame: '#3f5f7a', sides: ['front'], litChance: 0.4 });
  for (let t = 0.15; t < 0.9; t += 0.25) s.opening(rooms, 'front', t, 'door', 1, 2, rng.pick(['#3f5f7a', '#2e6b4a', '#6b4a33']));
  const side = s.mass('wing', { x0: c.x0 + 0.4, x1: c.x0 + 6, z0: c.z0 + 4, z1: c.z1 - 7 }, 1, 3, mud, { parapet: true, color: mud });
  s.opening(side, 'right', 0.5, 'door', 1, 2, '#6b4a33');
  for (let i = 0; i < rng.int(2, 4); i++) s.props.push({ kind: 'charpai', x: c.x0 + 10 + i * 2.6, y: 0.08, z: c.z0 + 8 + rng.range(-1, 1), rot: rng.range(-0.3, 0.3), color: '#e2d6bf' });
  s.props.push({ kind: 'waterTank', x: c.x0 + 4, y: massTop(rooms), z: c.z1 - 3, rot: 0, color: '#1e1f22', h: 1.2 });
  // Cattle shade with buffaloes and cows by the courtyard; haystacks; chickens; goats.
  const shx = c.x1 + 14;
  s.props.push({ kind: 'openShed', x: shx, y: 0.05, z: c.z0 + 10, rot: 0, color: rng.pick(['#8a6a4a', '#9a958a']), color2: mud, w: 16, d: 8, h: 3, n: 1 });
  s.reserved.push({ x0: shx - 8.5, x1: shx + 8.5, z0: c.z0 + 5, z1: c.z0 + 15 });
  for (let k = 0; k < 4; k++) s.props.push({ kind: 'animal', x: shx - 6 + k * 3.8, y: 0.07, z: c.z0 + 10 + rng.range(-0.8, 0.8), rot: Math.PI + rng.range(-0.3, 0.3), color: '#2b2b2b', n: rng.chance(0.7) ? 11 : 10 });
  for (let k = 0; k < 3; k++) s.props.push({ kind: 'hayBale', x: shx - 6 + k * 5, y: 0.05, z: c.z0 + 22, rot: 0, color: '#d9b86a', color2: '#b8973d', n: 2, w: rng.range(1.6, 2.2) });
  for (let k = 0; k < 6; k++) s.props.push({ kind: 'animal', x: c.x0 + 14 + rng.range(-4, 4), y: 0.08, z: c.z0 + 13 + rng.range(-2, 2), rot: rng.range(0, 6.28), color: '#f2efe8', n: 14 });
  for (let k = 0; k < 3; k++) s.props.push({ kind: 'animal', x: shx + rng.range(-6, 6), y: 0.07, z: c.z0 + 30 + rng.range(-3, 3), rot: rng.range(0, 6.28), color: '#c9b18a', n: 13 });
  // Tubewell gushing into a small pool.
  const tx = shx + 12;
  const tz = c.z0 + 4;
  const hut = s.mass('unit', { x0: tx, x1: tx + 3, z0: tz, z1: tz + 3 }, 1, 2.4, jitter('#9c5a45', rng, 0.04), { parapet: false, color: '#9c5a45' });
  s.opening(hut, 'front', 0.5, 'door', 0.9, 1.9, '#3f5f7a');
  s.water.push({ pts: [[tx + 3.6, tz - 1], [tx + 8, tz - 1], [tx + 8, tz + 3], [tx + 3.6, tz + 3]], shore: '#9a958a', y: 0.03 });
  s.animated.push({ kind: 'spray', x: tx + 3.3, y: 1.1, z: tz + 1, height: 0.5, radius: 2.4 });
  s.props.push({ kind: 'tractor', x: shx + 4, y: 0.05, z: c.z0 + 38, rot: Math.PI / 2, color: rng.pick(['#c0392b', '#1f6fb5']), color2: '#6f9a3a', n: 1 });
  // Fields: wheat, sugarcane, rice paddy, ploughed; shisham / kikar shade trees along the bunds.
  const all = strips({ x0: c.x1 + 34, x1: W - 4, z0: 6, z1: D - 4 }, rng.int(2, 3), 2.5);
  all.push({ x0: 6, x1: c.x1 + 30, z0: c.z1 + 16, z1: D - 4 });
  const crops: Crop[] = rng.chance(0.5) ? ['wheat', 'sugarcane', 'paddy', 'ploughed'] : ['sugarcane', 'paddy', 'wheat', 'vegetables'];
  all.forEach((r, i) => field(s, r, crops[i % crops.length]));
  s.pavingColor = jitter(DIRT, rng, 0.05);
  s.paths.push({ x0: (c.x0 + c.x1) / 2 - 2, x1: (c.x0 + c.x1) / 2 + 2, z0: 0, z1: c.z0 });
  for (const r of all) for (let x = r.x0 + 4; x < r.x1 - 2; x += rng.range(14, 24)) s.trees.push({ kind: 'round', x, z: r.z0 - 1.2, scale: rng.range(1.0, 1.4), rot: rng.range(0, 6.28), color: jitter('#5a7f3a', rng, 0.06), trunkColor: '#5a4632' });
  s.trees_({ x0: 0, x1: c.x1 + 30, z0: 0, z1: c.z1 + 14 }, 4);
  s.height = 12;
}

const GENERATORS: Record<FarmStyle, (s: Site) => void> = { crop, dairy, orchard, greenhouse, village };

export function generateFarm(spec: FarmSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const s = new Site(rng, spec.lotWidth, spec.lotDepth, spec.details ?? DEFAULT_DETAILS, spec.seed, spec.style);
  s.info.type = 'farm';
  s.lawnColor = jitter('#8fae5a', rng, 0.04);
  GENERATORS[spec.style](s);
  return s.model(`farm:${spec.style}`);
}
