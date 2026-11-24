/**
 * Hotels:
 *   business -> glazed podium with a porte-cochère over a drop-off loop, slim guest-room tower on top,
 *               lit name sign on the crown (sometimes a glass sky bar), flags, taxis, planters
 *   resort   -> long slab (sometimes with an angled-back wing) with a balcony to every room facing a
 *               free-form lagoon pool deck: loungers, parasols, pool bar, palms; lobby block with a
 *               porte-cochère on the street side, tennis court, spa pavilion
 *   sail     -> sail-shaped tower tapering to a point, white exoskeleton legs + braces, cantilevered helipad,
 *               spire; reached on a causeway between lagoons with fountain jets
 *   skypark  -> three slab towers on a podium joined by a long sky deck that cantilevers past the last one:
 *               infinity pool, loungers, parasols, planted edge, name sign
 *   archTwin -> two coral towers with stepped, domed crowns, a bridge suite high between them over a giant
 *               arch, fountain plaza and drive
 *   pyramid  -> dark glass pyramid with an entrance pavilion, an obelisk and a palm-lined drive
 *   cylinders-> one to three round glass towers on a podium, the tallest with a revolving-restaurant crown
 *   terraced -> ziggurat resort stepping back on both sides, planted terrace edges, lagoon pool deck
 *   motel    -> two-storey row of rooms facing the car park, open upper walkway with railings and
 *               end stairs, a door + window per room, office with a neon VACANCY sign, tall roadside sign,
 *               small fenced pool, ice / vending machines
 */
import { RNG } from '../../core/rng';
import { DEFAULT_DETAILS, massTop, type DetailOptions, type HouseModel, type Rect, type WindowStyle } from '../spec';
import { CAR_COLORS, Site, jitter } from './civic/site';

export type HotelStyle = 'business' | 'resort' | 'motel' | 'sail' | 'skypark' | 'archTwin' | 'pyramid' | 'cylinders' | 'terraced';
export const HOTEL_STYLES: HotelStyle[] = ['business', 'resort', 'motel', 'sail', 'skypark', 'archTwin', 'pyramid', 'cylinders', 'terraced'];
export const HOTEL_LOTS: Record<HotelStyle, [number, number, number, number]> = {
  business: [42, 60, 46, 60],
  resort: [86, 110, 84, 104],
  motel: [52, 70, 40, 52],
  sail: [78, 96, 92, 112],
  skypark: [104, 130, 72, 90],
  archTwin: [92, 112, 74, 92],
  pyramid: [84, 104, 90, 110],
  cylinders: [52, 74, 58, 78],
  terraced: [92, 114, 92, 112],
};

export function hotelLotSize(rng: RNG, style: HotelStyle): { w: number; d: number } {
  const [w0, w1, d0, d1] = HOTEL_LOTS[style];
  return { w: rng.range(w0, w1), d: rng.range(d0, d1) };
}

export interface HotelSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style: HotelStyle;
  details?: DetailOptions;
}

const BRANDS = ['#c9a648', '#1f3f73', '#7a1f2b', '#2d4f3c', '#c0392b', '#1e1f22', '#0b8a8a'];

function business(s: Site): void {
  const { rng, W, D } = s;
  const brand = rng.pick(BRANDS);
  const glassFrame = rng.pick(['#3a3d40', '#5a6b7d', '#8f9499', '#c9a648']);
  const stone = jitter(rng.pick(['#e2ddd0', '#c9c4b8', '#d9d4c7', '#b5aa98']), rng, 0.03);
  const cx = W / 2;
  const pz0 = 13;
  const podium = s.mass('main', { x0: 3, x1: W - 3, z0: pz0, z1: D - 4 }, rng.int(2, 3), 4.5, stone, { parapet: true, color: '#6b6e72' });
  s.glaze(podium, ['front'], glassFrame);
  s.windows(podium, { bay: 3.6, w: 2.6, h: 2.4, sill: 1, style: 'plain', frame: glassFrame, sides: ['left', 'right', 'back'], litChance: 0.5 });
  s.opening(podium, 'front', 0.5, 'shopfront', 6, 3.2, '#2b3a48', 'shop', false);
  s.sign(podium, 'front', 0.5, massTop(podium) - 1.6, Math.min(16, W * 0.4), 1.1, brand);
  // Porte-cochère over the drop-off loop.
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 8, x1: cx + 8, z0: pz0 - 8, z1: pz0 }, floorY: 0, roofY: 5, stepX: cx, floorColor: s.pavingColor, roofColor: brand, postColor: '#c9c4b8' });
  for (const x of [cx - 5, cx, cx + 5]) s.lights.push({ kind: 'ceiling', x, y: 4.98, z: pz0 - 4, rot: 0 });
  s.driveways.push({ x0: cx - 12, x1: cx + 12, z0: 0, z1: pz0 });
  const taxis = rng.int(1, 3);
  for (let i = 0; i < taxis; i++) s.props.push({ kind: 'car', x: cx - 4 + i * 5, y: 0.05, z: pz0 - 4, rot: Math.PI / 2, color: rng.pick(['#1e1f22', '#1e1f22', '#f2c94c']) });
  s.flags(cx - 15, 3, rng.int(3, 5));
  for (const x of [cx - 13, cx + 13]) s.props.push({ kind: 'planter', x, y: 0.05, z: pz0 - 1, rot: 0, color: '#8f8a83', w: 2 });
  // Room tower on the podium.
  const tw = Math.min(W - 12, rng.range(24, 36));
  const td = Math.min(D - pz0 - 10, rng.range(15, 19));
  const floors = rng.int(14, 28);
  const style = rng.pick<WindowStyle>(['ribbon', 'grid', 'plain']);
  const tower = s.mass('upper', { x0: cx - tw / 2, x1: cx + tw / 2, z0: pz0 + 2, z1: pz0 + 2 + td }, floors, 3.3, jitter(stone, rng, 0.04), { parapet: true, color: '#6b6e72' }, { baseY: massTop(podium) });
  if (style === 'grid' || rng.chance(0.4)) s.glaze(tower, ['front', 'back'], glassFrame);
  else s.windows(tower, { bay: 3.6, w: 2.8, h: 1.9, sill: 0.8, style, frame: glassFrame, litChance: 0.6 });
  s.windows(tower, { bay: 3.6, w: 1.6, h: 1.9, sill: 0.8, style: 'plain', frame: glassFrame, sides: ['left', 'right'], litChance: 0.6 });
  const top = massTop(tower);
  s.props.push({ kind: 'roofSign', x: cx, y: top, z: tower.rect.z0 + 1, rot: 0, color: brand, w: Math.min(16, tw * 0.6), h: 2.6 });
  if (rng.chance(0.4)) {
    const bar = s.mass('roofRoom', { x0: cx - tw * 0.3, x1: cx + tw * 0.3, z0: tower.rect.z0 + 4, z1: tower.rect.z1 - 2 }, 1, 4, '#3a3d40', { parapet: false, color: '#3a3d40' }, { baseY: top });
    s.glaze(bar, ['front', 'left', 'right', 'back'], glassFrame);
    s.height = massTop(bar) + 2;
  } else {
    for (let i = 0; i < 3; i++) s.props.push({ kind: 'acUnit', x: cx - tw / 2 + 3 + i * 2.5, y: top, z: tower.rect.z1 - 2.5, rot: 0, color: '#c9ccd1' });
    s.height = top + 5;
  }
  s.info.floors = floors + podium.floors;
  s.trees_({ x0: 0, x1: W, z0: 0, z1: pz0 }, 2, [['round', 1], ['palm', 1]]);
}

function resort(s: Site): void {
  const { rng, W, D } = s;
  const brand = rng.pick(BRANDS);
  const wall = jitter(rng.pick(['#f4f1ea', '#efe4cf', '#e9dcc4', '#f2e6d8', '#e4eef0']), rng, 0.02);
  const roof = rng.pick(['#a0473a', '#6b6e72', '#c9a648']);
  const cx = W / 2;
  // Lobby block + porte-cochère on the street.
  const lobby = s.mass('main', { x0: cx - 12, x1: cx + 12, z0: 12, z1: 22 }, 2, 4.5, wall, { type: 'hip', axis: 'x', pitch: 0.4, color: roof, parapet: false, overhang: 1 });
  s.glaze(lobby, ['front'], '#5a6b7d');
  s.opening(lobby, 'front', 0.5, 'shopfront', 5, 3.2, '#2b3a48', 'shop', false);
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 7, x1: cx + 7, z0: 5, z1: 12 }, floorY: 0, roofY: 4.8, stepX: cx, floorColor: s.pavingColor, roofColor: roof, postColor: wall });
  s.driveways.push({ x0: cx - 11, x1: cx + 11, z0: 0, z1: 5 });
  s.sign(lobby, 'front', 0.5, 5.6, 12, 1.1, brand);
  s.flags(cx - 16, 3, 4);
  // Guest slab with balconies to the pool.
  const sz0 = 24;
  const sd = 15;
  const floors = rng.int(6, 11);
  const slab = s.mass('main', { x0: 6, x1: W - 6, z0: sz0, z1: sz0 + sd }, floors, 3.2, wall, { parapet: true, color: roof });
  const winStyle = rng.pick<WindowStyle>(['plain', 'casement']);
  s.windows(slab, { bay: 4, w: 2.8, h: 2.3, sill: 0.3, style: winStyle, frame: '#5a6b7d', sides: ['back', 'front'], floors: Array.from({ length: floors - 1 }, (_, i) => i + 1), litChance: 0.6 });
  s.windows(slab, { bay: 4, w: 3.2, h: 2.6, sill: 0.2, style: 'shop', frame: '#5a6b7d', sides: ['back'], floors: [0], litChance: 0.8 });
  const rail = rng.pick<'glass' | 'iron'>(['glass', 'iron']);
  for (const o of s.facade.openings) {
    if (o.massId !== slab.id || o.wall !== 'back' || o.floor < 1) continue;
    s.balconies.push({ cx: o.cx, cz: o.cz, nx: o.nx, nz: o.nz, width: o.width + 0.4, depth: 1.6, y: o.y0 - 0.3, rail, color: wall, railColor: rail === 'glass' ? '#9fb4bf' : '#2b2b2b' });
  }
  s.height = massTop(slab) + 3;
  s.info.floors = floors;
  // Lagoon pool deck behind.
  const dz0 = sz0 + sd + 2;
  const deck = { x0: 8, x1: W - 8, z0: dz0, z1: D - 6 };
  s.paths.push(deck);
  s.pavingColor = jitter('#e9dcc4', rng, 0.03);
  const pcx = (deck.x0 + deck.x1) / 2 + rng.range(-6, 6);
  const pcz = (deck.z0 + deck.z1) / 2;
  const rx = (deck.x1 - deck.x0) * 0.3;
  const rz = (deck.z1 - deck.z0) * 0.28;
  const pts: [number, number][] = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    const k = 1 + 0.18 * Math.sin(2 * t + 1.3) + 0.1 * Math.sin(3 * t);
    pts.push([pcx + Math.cos(t) * rx * k, pcz + Math.sin(t) * rz * k]);
  }
  s.water.push({ pts, shore: '#f4f1ea', y: 0.06 });
  const loungers = rng.int(8, 16);
  for (let i = 0; i < loungers; i++) {
    const t = (i / loungers) * Math.PI * 2;
    const x = pcx + Math.cos(t) * (rx * 1.35 + 2.5);
    const z = pcz + Math.sin(t) * (rz * 1.35 + 2.5);
    if (x < deck.x0 + 1 || x > deck.x1 - 1 || z < deck.z0 + 1.2 || z > deck.z1 - 1) continue;
    s.props.push({ kind: 'lounger', x, y: 0.06, z, rot: Math.atan2(Math.cos(t), Math.sin(t)), color: rng.pick(['#f4f1ea', '#1f6fb5', brand]) });
    if (i % 2) s.props.push({ kind: 'parasol', x: x + Math.cos(t) * 1.4, y: 0.06, z: z + Math.sin(t) * 1.4, rot: 0, color: rng.pick(['#f4f1ea', brand, '#e67e22']), w: 1.3 });
  }
  s.props.push({ kind: 'gazebo', x: deck.x1 - 5, y: 0.05, z: deck.z0 + 5, rot: 0, color: roof, w: 2.6 });
  for (let i = 0; i < 10; i++) s.trees.push({ kind: 'palm', x: deck.x0 + 1.5 + ((deck.x1 - deck.x0 - 3) * i) / 9, z: i % 2 ? deck.z1 + 1.8 : deck.z0 - 0.2 + 3.5, scale: rng.range(0.85, 1.15), rot: rng.range(0, 6.28), color: jitter('#4f8a3a', rng, 0.05), trunkColor: '#8a6a4a' });
  // Tennis court + spa pavilion on the side strips if there's room.
  if (W > 96) s.court('tennis', { x0: 2, x1: 26, z0: 2, z1: 11 });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: sz0 }, 8, [['palm', 3], ['round', 1]]);
}

function motel(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#f2e3c6', '#e8d3b0', '#cfe0ef', '#f2d0c0', '#e9e6df']), rng, 0.02);
  const trim = rng.pick(['#c0392b', '#1f6fb5', '#2d4f3c', '#e67e22', '#8e44ad']);
  const roof = rng.pick(['#6b4a3a', '#5a6670', '#a0473a']);
  const bz0 = D - 13;
  const bx0 = 14;
  const bx1 = W - 4;
  const fh = 3;
  const block = s.mass('main', { x0: bx0, x1: bx1, z0: bz0, z1: D - 3 }, 2, fh, wall, { type: 'gable', axis: 'x', pitch: 0.35, color: roof, parapet: false, overhang: 0.6 });
  // Rooms: door + window each, both floors, numbered by the walkway.
  const roomW = 4;
  const nRooms = Math.floor((bx1 - bx0 - 2) / roomW);
  const wl = s.wall(block, 'front');
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < nRooms; i++) {
      const x0 = bx0 + 1 + i * roomW;
      const y = block.baseY + f * fh;
      s.facade.add({ kind: 'door', massId: block.id, wall: 'front', floor: f, cx: x0 + 0.9, cz: wl.az, nx: 0, nz: -1, width: 0.95, y0: y, height: 2.15, color: trim, frameColor: '#3a3d40', mullions: false, lit: false });
      s.facade.add({ kind: 'window', massId: block.id, wall: 'front', floor: f, cx: x0 + 2.6, cz: wl.az, nx: 0, nz: -1, width: 1.8, y0: y + 0.9, height: 1.2, color: '#2b3a48', frameColor: '#e9e6df', mullions: false, lit: rng.chance(0.5) });
      if (rng.chance(0.4)) s.props.push({ kind: 'acUnit', x: x0 + 3.6, y: y + 0.4, z: wl.az - 0.4, rot: 0, color: '#c9ccd1' });
    }
  }
  s.windows(block, { bay: 4, w: 1, h: 0.8, sill: 1.5, style: 'plain', frame: '#e9e6df', sides: ['back'], litChance: 0.4 });
  // Upper walkway: slab on posts with an iron railing, stairs at both ends.
  const walk = 2.2;
  s.porches.push({ kind: 'arcade', rect: { x0: bx0, x1: bx1, z0: bz0 - walk, z1: bz0 }, floorY: 0, roofY: block.baseY + fh - 0.27, stepX: (bx0 + bx1) / 2, floorColor: '#b9b4aa', roofColor: '#d9d4c7', postColor: trim });
  s.balconies.push({ cx: (bx0 + bx1) / 2, cz: bz0, nx: 0, nz: -1, width: bx1 - bx0, depth: walk, y: block.baseY + fh, rail: 'iron', color: '#d9d4c7', railColor: trim });
  for (const x of [bx0 - 1.4, bx1 + 1.4]) {
    if (x > W - 1.5) continue;
    s.props.push({ kind: 'ramp', x, y: 0.05, z: bz0 - walk - 2.6 + 3.5, rot: Math.PI, color: '#b9b4aa', w: 1.2, d: 6, h: fh });
  }
  for (let x = bx0 + 2; x < bx1 - 1; x += 8) s.lights.push({ kind: 'ceiling', x, y: block.baseY + fh - 0.3, z: bz0 - 1.1, rot: 0 });
  // Office at the street end with a VACANCY sign.
  const office = s.mass('wing', { x0: 3, x1: bx0 - 2, z0: bz0 - 2, z1: D - 3 }, 1, 3.4, wall, { type: 'gable', axis: 'z', pitch: 0.4, color: roof, parapet: false, overhang: 0.6 });
  s.opening(office, 'front', 0.5, 'shopfront', 3.4, 2.6, '#2b3a48', 'shop');
  s.sign(office, 'front', 0.5, 2.85, Math.min(6, bx0 - 6), 0.5, '#e8302a');
  s.props.push({ kind: 'pylonSign', x: 3.5, y: 0.05, z: 2.5, rot: 0, color: trim, color2: '#3a3d40', h: rng.range(9, 13), w: 3.4 });
  // Parking in front of the rooms, small fenced pool, machines.
  s.parking({ x0: bx0, x1: bx1, z0: 3, z1: bz0 - walk - 1 }, Math.min(0.8, s.details.cars + 0.2));
  const pool = { x0: 3, x1: bx0 - 3, z0: 4, z1: Math.min(bz0 - 6, 14) };
  if (pool.x1 - pool.x0 > 4 && pool.z1 - pool.z0 > 4) {
    s.pool = pool;
    s.fences.push({ kind: 'iron', color: '#2b2b2b', height: 1.3, segments: [
      { x0: pool.x0 - 1, z0: pool.z0 - 1, x1: pool.x1 + 1, z1: pool.z0 - 1 }, { x0: pool.x0 - 1, z0: pool.z1 + 1, x1: pool.x1 + 1, z1: pool.z1 + 1 },
      { x0: pool.x0 - 1, z0: pool.z0 - 1, x1: pool.x0 - 1, z1: pool.z1 + 1 }, { x0: pool.x1 + 1, z0: pool.z0 - 1, x1: pool.x1 + 1, z1: pool.z1 + 1 },
    ] });
  }
  s.props.push({ kind: 'vending', x: bx0 - 0.9, y: 0.05, z: bz0 - walk - 0.8, rot: Math.PI / 2, color: '#c0392b' });
  s.props.push({ kind: 'iceChest', x: bx0 - 0.9, y: 0.05, z: bz0 - walk - 2.4, rot: Math.PI / 2, color: '#1f6fb5' });
  s.props.push({ kind: 'dumpster', x: W - 2.5, y: 0.05, z: bz0 - walk - 3, rot: Math.PI / 2, color: '#2e6b4a' });
  s.height = massTop(block) + 3;
  s.info.rooms = nRooms * 2;
  void CAR_COLORS;
}


// ---------------------------------------------------------------- landmark hotels

const facing = (fx: number, fz: number) => Math.atan2(-fx, -fz);

interface StackStyle { facade: WindowStyle; frame: string; roof: string; lit: number; crown?: boolean; lobby?: boolean }

/** Stack of per-floor convex footprints as polygon masses (bands of `band` floors share a footprint). */
function polyStack(s: Site, floors: number, fh: number, baseY: number, foot: (f: number) => [number, number][], st: StackStyle, band = 1): number {
  for (let f = 0; f < floors; f += band) {
    const n = Math.min(band, floors - f);
    const last = f + n >= floors;
    s.polyMasses.push({ poly: foot(f + n / 2), baseY: baseY + f * fh, floors: n, floorHeight: fh, facade: st.facade, frameColor: st.frame, lobby: st.lobby && f === 0, roofColor: st.roof, litChance: st.lit, crownLight: last && st.crown, parapet: last });
  }
  return baseY + floors * fh;
}

const circle = (cx: number, cz: number, r: number, n = 16): [number, number][] =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cz + Math.sin((i / n) * Math.PI * 2) * r] as [number, number]);

/** Strut prop between two lot points (y included). */
function strut(s: Site, a: [number, number, number], b: [number, number, number], w: number, color: string): void {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  s.props.push({ kind: 'strut', x: a[0], y: a[1], z: a[2], rot: Math.hypot(dx, dz) < 1e-3 ? 0 : facing(dx, dz), color, w, h: b[1] - a[1], d: Math.hypot(dx, dz) });
}

/** Drop-off forecourt: porte-cochère, loop, taxis, flags. */
function forecourt(s: Site, cx: number, z1: number, roof: string): void {
  const { rng } = s;
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 8, x1: cx + 8, z0: z1 - 7, z1 }, floorY: 0, roofY: 5, stepX: cx, floorColor: s.pavingColor, roofColor: roof, postColor: '#e9e6df' });
  for (const x of [cx - 5, cx, cx + 5]) s.lights.push({ kind: 'ceiling', x, y: 4.98, z: z1 - 3.5, rot: 0 });
  s.driveways.push({ x0: cx - 12, x1: cx + 12, z0: 0, z1: z1 });
  for (let i = 0; i < rng.int(1, 3); i++) s.props.push({ kind: 'car', x: cx - 4 + i * 5, y: 0.05, z: z1 - 3.5, rot: Math.PI / 2, color: rng.pick(['#1e1f22', '#f4f1ea', '#f2c94c']) });
  s.flags(cx - 16, 3, 4);
}

function sail(s: Site): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const zb = D - 10;
  const Wm = Math.min(W - 26, 44);
  const Dm = Math.min(zb - 34, 32);
  const floors = rng.int(34, 46);
  const fh = 3.6;
  const foot = (f: number): [number, number][] => {
    const t = Math.min(0.985, f / floors);
    const wid = Wm * (1 - 0.78 * Math.pow(t, 1.15));
    const dep = Dm * Math.pow(1 - t, 0.55) * (0.78 + 0.22 * Math.sin(Math.PI * t));
    return Array.from({ length: 11 }, (_, k) => {
      const u = -1 + (2 * k) / 10;
      return [cx + (u * wid) / 2, zb - dep * (1 - u * u) - 0.5] as [number, number];
    });
  };
  const top = polyStack(s, floors, fh, 0.15, foot, { facade: 'claddingStrip', frame: '#eef1f2', roof: '#e9e6df', lit: 0.55, lobby: true, crown: true }, 2);
  // Exoskeleton: two legs from the back corners to the apex, cross braces, a spire.
  const apex: [number, number, number] = [cx, top - 2, zb - 0.5];
  const legs: [number, number, number][] = [[cx - Wm / 2 - 1.5, 0.15, zb + 1.5], [cx + Wm / 2 + 1.5, 0.15, zb + 1.5]];
  for (const l of legs) strut(s, l, apex, 1.6, '#f4f1ea');
  for (const t of [0.22, 0.45, 0.66]) {
    const p = (l: [number, number, number]): [number, number, number] => [l[0] + (apex[0] - l[0]) * t, l[1] + (apex[1] - l[1]) * t, l[2] + (apex[2] - l[2]) * t];
    strut(s, p(legs[0]), p(legs[1]), 0.9, '#f4f1ea');
  }
  strut(s, apex, [cx, top + 22, zb - 0.5], 0.5, '#e9e6df');
  // Cantilevered helipad near the top.
  const hy = top * 0.82;
  const hf = foot(floors * 0.82);
  const hx = Math.max(...hf.map((p) => p[0])) + 7;
  s.props.push({ kind: 'helipad', x: hx, y: hy, z: zb - 8, rot: 0, color: '#5a5f66', color2: '#f2f2ee', w: 6.5 });
  strut(s, [hx - 6.5, hy - 6, zb - 8], [hx, hy - 0.1, zb - 8], 0.7, '#f4f1ea');
  s.height = top + 24;
  s.info.floors = floors;
  // Causeway between two lagoons with fountain jets.
  const lz = (zb - Dm) / 2;
  s.driveways.push({ x0: cx - 5, x1: cx + 5, z0: 0, z1: zb - Dm });
  for (const sx of [-1, 1]) {
    const lx = cx + sx * (W / 4 + 2);
    const pts: [number, number][] = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      return [lx + Math.cos(a) * (W / 4 - 6) * (1 + 0.08 * Math.sin(3 * a)), lz + Math.sin(a) * (lz - 4)] as [number, number];
    });
    s.water.push({ pts, shore: '#e9dcc4', y: 0.06 });
    for (const dz of [-6, 0, 6]) s.animated.push({ kind: 'spray', x: lx, y: 0.1, z: lz + dz, height: 4, radius: 0.6 });
  }
  for (let z = 4; z < zb - Dm - 2; z += 8) for (const sx of [-1, 1]) s.trees.push({ kind: 'palm', x: cx + sx * 6.5, z, scale: 1.1, rot: rng.range(0, 6), color: jitter('#4f8a3a', rng, 0.05), trunkColor: '#8a6a4a' });
  s.flags(cx, 2, 2);
}

function skypark(s: Site): void {
  const { rng, W, D } = s;
  const brand = rng.pick(BRANDS);
  const stone = jitter(rng.pick(['#e2ddd0', '#d9d4c7', '#c9ccd1']), rng, 0.03);
  const tw = 14;
  const td = Math.min(26, D - 40);
  const zt0 = D - 6 - td;
  const span = W * 0.78 - 6;
  const g = (span - 3 * tw) / 2;
  const podium = s.mass('main', { x0: 6, x1: W * 0.78, z0: zt0 - 12, z1: D - 6 }, 3, 4.6, stone, { parapet: true, color: '#6b6e72' });
  s.glaze(podium, ['front', 'left', 'right'], '#3a3d40');
  s.opening(podium, 'front', 0.5, 'shopfront', 6, 3.4, '#2b3a48', 'shop', false);
  const floors = rng.int(38, 50);
  let top = 0;
  for (let i = 0; i < 3; i++) {
    const x0 = 6 + i * (tw + g);
    const t = s.mass('upper', { x0, x1: x0 + tw, z0: zt0, z1: zt0 + td }, floors, 3.3, stone, { parapet: true, color: '#6b6e72' }, { baseY: massTop(podium) });
    s.glaze(t, ['front', 'back', 'left', 'right'], '#5a6b7d');
    top = Math.max(top, massTop(t));
  }
  // The sky deck across all three tops, cantilevering past the last tower.
  const dz0 = zt0 + td / 2 - 7;
  const deck = s.mass('upper', { x0: 3, x1: W - 3, z0: dz0, z1: dz0 + 14 }, 1, 2.6, '#e9e6df', { parapet: false, color: '#d9d4c7' }, { baseY: top });
  const dy = massTop(deck) + 0.3; // flat roof slab without a parapet is 0.3 m thick
  s.water.push({ pts: [[6, dz0 + 1.5], [W * 0.62, dz0 + 1.5], [W * 0.62, dz0 + 6], [6, dz0 + 6]], shore: '#cfe3ea', y: dy + 0.01 });
  for (let x = 8; x < W * 0.6; x += 3) s.props.push({ kind: 'lounger', x, y: dy + 0.05, z: dz0 + 8, rot: Math.PI, color: '#f4f1ea' });
  for (let x = 6; x < W - 6; x += 9) {
    s.props.push({ kind: 'hedgeRow', x: x + 3, y: dy, z: dz0 + 12.6, rot: 0, color: '#4f8a3a', color2: '#9a958a', w: 6 });
    s.lights.push({ kind: 'post', x, y: dy, z: dz0 + 10.5, rot: 0 });
  }
  for (let x = W * 0.66; x < W - 6; x += 5) s.props.push({ kind: 'parasol', x, y: dy + 0.05, z: dz0 + 4, rot: 0, color: brand, w: 1.6 });
  s.props.push({ kind: 'roofSign', x: 6 + tw / 2, y: dy, z: dz0 + 0.5, rot: 0, color: brand, w: 12, h: 2.4 });
  s.height = dy + 6;
  s.info.floors = floors + 3;
  forecourt(s, W * 0.4, zt0 - 12, brand);
  s.trees_({ x0: W * 0.8, x1: W, z0: 0, z1: D }, 6, [['palm', 3], ['round', 1]]);
}

function archTwin(s: Site): void {
  const { rng, W, D } = s;
  const coral = jitter(rng.pick(['#e8a08a', '#f2c6a8', '#e9b98f', '#f0d7c0']), rng, 0.03);
  const trim = rng.pick(['#f4f1ea', '#2e7d8c', '#c9a648']);
  const cx = W / 2;
  const zb = D - 24;
  const floors = rng.int(18, 24);
  const fh = 3.3;
  const towers = [{ x0: 8, x1: cx - 10 }, { x0: cx + 10, x1: W - 8 }].map((r) => {
    const t = s.mass('main', { ...r, z0: zb, z1: zb + 18 }, floors, fh, coral, { parapet: true, color: coral });
    s.windows(t, { bay: 3.4, w: 2.2, h: 1.9, sill: 0.8, style: 'arch', frame: coral, litChance: 0.6, noSill: true });
    // Stepped crown with a little dome.
    let y = massTop(t);
    let w = (r.x1 - r.x0) / 2 - 2;
    const mx = (r.x0 + r.x1) / 2;
    for (let k = 0; k < 2; k++) {
      const c = s.mass('roofRoom', { x0: mx - w, x1: mx + w, z0: zb + 4 + k * 2, z1: zb + 14 - k * 2 }, 1, 4, coral, { parapet: true, color: trim }, { baseY: y });
      s.windows(c, { bay: 3, w: 1.4, h: 2, sill: 0.8, style: 'arch', frame: coral, noSill: true });
      y = massTop(c);
      w *= 0.6;
    }
    s.props.push({ kind: 'dome', x: mx, y, z: zb + 9, rot: 0, color: trim, color2: coral, w: Math.min(3.5, w + 0.8), n: 1, d: 3 });
    return t;
  });
  const top = massTop(towers[0]);
  // Bridge suite spanning the gap near the top, giant arch below it, low lobby wing between the legs.
  const bridge = s.mass('upper', { x0: cx - 10, x1: cx + 10, z0: zb + 3, z1: zb + 15 }, 3, fh, coral, { parapet: true, color: trim }, { baseY: top - 4 * fh });
  s.windows(bridge, { bay: 3, w: 2, h: 1.9, sill: 0.8, style: 'arch', frame: coral, sides: ['front', 'back'], noSill: true });
  const archBase = top * 0.38;
  s.props.push({ kind: 'archRib', x: cx, y: archBase, z: zb - 0.6, rot: 0, color: trim, w: 10, h: bridge.baseY - archBase, d: 1.8 });
  const lobby = s.mass('wing', { x0: cx - 10, x1: cx + 10, z0: zb + 4, z1: zb + 18 }, 2, 4.5, coral, { parapet: true, color: trim });
  s.glaze(lobby, ['front'], '#5a6b7d');
  s.height = top + 16;
  s.info.floors = floors;
  // Fountain plaza and drive.
  s.plazas.push({ x: cx, z: 13, r: 9 });
  s.props.push({ kind: 'fountain', x: cx, y: 0.05, z: 13, rot: 0, color: '#e9e6df', w: 3.4 });
  s.animated.push({ kind: 'spray', x: cx, y: 1.98, z: 13, height: 3, radius: 2.4 });
  s.driveways.push({ x0: cx - 14, x1: cx + 14, z0: 0, z1: 4 }, { x0: cx - 14, x1: cx - 10, z0: 4, z1: zb }, { x0: cx + 10, x1: cx + 14, z0: 4, z1: zb });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 12, [['palm', 4], ['round', 1]]);
}

function pyramid(s: Site): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const S = Math.min(W - 16, D - 34, 72);
  const zc = D - 6 - S / 2;
  const h = S * rng.range(0.62, 0.72);
  s.props.push({ kind: 'glassPyramid', x: cx, y: 0.05, z: zc, rot: 0, color: '#1c2229', color2: '#3a3d40', w: S / 2, h });
  s.reserved.push({ x0: cx - S / 2, x1: cx + S / 2, z0: zc - S / 2, z1: zc + S / 2 });
  s.height = h + 4;
  // Entrance pavilion, obelisk on the axis, palm-lined drive.
  const ent = s.mass('wing', { x0: cx - 7, x1: cx + 7, z0: zc - S / 2 - 6, z1: zc - S / 2 + 1 }, 1, 6, '#c9b99a', { parapet: true, color: '#8f8a83' });
  s.glaze(ent, ['front'], '#3a3d40');
  s.sign(ent, 'front', 0.5, 6.2, 10, 1.2, rng.pick(BRANDS));
  s.props.push({ kind: 'obelisk', x: cx, y: 0.05, z: 8, rot: 0, color: '#d9cfbd', color2: '#9a958a', w: 1.2, h: rng.range(16, 24) });
  s.driveways.push({ x0: cx - 12, x1: cx - 4, z0: 0, z1: zc - S / 2 - 6 }, { x0: cx + 4, x1: cx + 12, z0: 0, z1: zc - S / 2 - 6 });
  for (let z = 4; z < zc - S / 2 - 7; z += 7) for (const sx of [-1, 1]) s.trees.push({ kind: 'palm', x: cx + sx * 13.5, z, scale: 1.15, rot: rng.range(0, 6), color: jitter('#4f8a3a', rng, 0.05), trunkColor: '#8a6a4a' });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 6, [['palm', 1]]);
}

function cylinders(s: Site): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const frame = rng.pick(['#8a6a3a', '#3a3d40', '#5a6b7d', '#c9a648']);
  const zc = D * 0.58;
  const podium = s.mass('main', { x0: 4, x1: W - 4, z0: 14, z1: D - 4 }, 2, 4.5, jitter('#d9d4c7', rng, 0.03), { parapet: true, color: '#6b6e72' });
  s.glaze(podium, ['front'], frame);
  const py = massTop(podium);
  const n = W > 60 ? rng.int(2, 3) : 1;
  const towers = [{ x: cx, z: zc, r: rng.range(9, 11), f: rng.int(26, 40) }];
  if (n >= 2) towers.push({ x: cx - Math.min(18, W / 2 - 12), z: zc + 4, r: rng.range(6.5, 8), f: rng.int(14, 22) });
  if (n >= 3) towers.push({ x: cx + Math.min(18, W / 2 - 12), z: zc + 4, r: rng.range(6.5, 8), f: rng.int(16, 24) });
  let top = 0;
  towers.forEach((t, i) => {
    const y = polyStack(s, t.f, 3.3, py, () => circle(t.x, t.z, t.r, 18), { facade: rng.chance(0.5) ? 'curtain' : 'ribbon', frame, roof: '#6b6e72', lit: 0.6 }, t.f);
    if (i === 0) {
      // Revolving restaurant crown + antenna.
      s.polyMasses.push({ poly: circle(t.x, t.z, t.r * 0.5, 10), baseY: y, floors: 1, floorHeight: 1.6, facade: 'plain', frameColor: frame, roofColor: frame, litChance: 0, parapet: false });
      const y2 = polyStack(s, 2, 3.6, y + 1.6, () => circle(t.x, t.z, t.r + 2.6, 20), { facade: 'curtain', frame, roof: '#3a3d40', lit: 0.9, crown: true }, 2);
      strut(s, [t.x, y2, t.z], [t.x, y2 + 18, t.z], 0.45, '#9aa0a6');
      top = y2 + 18;
    }
  });
  s.height = top + 2;
  s.info.towers = n;
  forecourt(s, cx, 14, frame);
}

function terraced(s: Site): void {
  const { rng, W, D } = s;
  const brand = rng.pick(BRANDS);
  const wall = jitter(rng.pick(['#f4f1ea', '#efe4cf', '#e9dcc4']), rng, 0.02);
  const levels = rng.int(7, 11);
  const fh = 3.3;
  const z0 = 18;
  const z1 = Math.min(D - 34, z0 + 40);
  const sbF = 1.6;
  const sbB = 2.8;
  let y = 0.15;
  let built = 0;
  for (let k = 0; k < levels; k++) {
    const r: Rect = { x0: 8 + k * 0.8, x1: W - 8 - k * 0.8, z0: z0 + k * sbF, z1: z1 - k * sbB };
    if (r.z1 - r.z0 < 8) break;
    const m = s.mass(k === 0 ? 'main' : 'upper', r, 1, fh, wall, { parapet: false, color: '#d9d4c7' }, { baseY: y });
    s.windows(m, { bay: 3.6, w: 2.8, h: 2.3, sill: 0.3, style: k % 2 ? 'shop' : 'plain', frame: '#5a6b7d', sides: ['front', 'back'], litChance: 0.6 });
    y = massTop(m);
    built++;
    // Planted edges on the terrace exposed above the next level.
    if (k < levels - 1) {
      s.props.push({ kind: 'hedgeRow', x: (r.x0 + r.x1) / 2, y, z: r.z0 + 0.6, rot: 0, color: '#4f8a3a', color2: '#e9e6df', w: r.x1 - r.x0 - 1 });
      s.props.push({ kind: 'hedgeRow', x: (r.x0 + r.x1) / 2, y, z: r.z1 - 0.6, rot: 0, color: '#4f8a3a', color2: '#e9e6df', w: r.x1 - r.x0 - 1 });
    }
  }
  s.height = y + 3;
  s.info.levels = built;
  // Lobby front + lagoon deck behind.
  s.porches.push({ kind: 'arcade', rect: { x0: W / 2 - 8, x1: W / 2 + 8, z0: z0 - 6, z1: z0 }, floorY: 0, roofY: 4.6, stepX: W / 2, floorColor: s.pavingColor, roofColor: brand, postColor: wall });
  s.driveways.push({ x0: W / 2 - 11, x1: W / 2 + 11, z0: 0, z1: z0 - 6 });
  s.flags(W / 2 - 15, 3, 4);
  const deck: Rect = { x0: 8, x1: W - 8, z0: z1 + 3, z1: D - 5 };
  s.paths.push(deck);
  const pcx = W / 2 + rng.range(-8, 8);
  const pcz = (deck.z0 + deck.z1) / 2;
  const rx = (deck.x1 - deck.x0) * 0.32;
  const rz = (deck.z1 - deck.z0) * 0.3;
  s.water.push({ pts: Array.from({ length: 20 }, (_, i) => { const t = (i / 20) * Math.PI * 2; const k = 1 + 0.15 * Math.sin(2 * t + 0.7) + 0.1 * Math.sin(3 * t); return [pcx + Math.cos(t) * rx * k, pcz + Math.sin(t) * rz * k] as [number, number]; }), shore: '#f4f1ea', y: 0.06 });
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const x = pcx + Math.cos(t) * (rx * 1.3 + 2.5);
    const z = pcz + Math.sin(t) * (rz * 1.3 + 2.5);
    if (x < deck.x0 + 1 || x > deck.x1 - 1 || z < deck.z0 + 1.2 || z > deck.z1 - 1) continue;
    s.props.push({ kind: 'lounger', x, y: 0.06, z, rot: Math.atan2(Math.cos(t), Math.sin(t)), color: '#f4f1ea' });
  }
  for (let i = 0; i < 8; i++) s.trees.push({ kind: 'palm', x: deck.x0 + 2 + ((deck.x1 - deck.x0 - 4) * i) / 7, z: deck.z1 + 1.5 > D - 1 ? deck.z1 - 1.5 : deck.z1 + 1.5, scale: rng.range(0.9, 1.2), rot: rng.range(0, 6), color: jitter('#4f8a3a', rng, 0.05), trunkColor: '#8a6a4a' });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: z0 - 6 }, 6, [['palm', 3], ['round', 1]]);
}

const GENERATORS: Record<HotelStyle, (s: Site) => void> = { business, resort, motel, sail, skypark, archTwin, pyramid, cylinders, terraced };

export function generateHotel(spec: HotelSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const s = new Site(rng, spec.lotWidth, spec.lotDepth, spec.details ?? DEFAULT_DETAILS, spec.seed, spec.style);
  s.info.type = 'hotel';
  GENERATORS[spec.style](s);
  return s.model(`hotel:${spec.style}`);
}
