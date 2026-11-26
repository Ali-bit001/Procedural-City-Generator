/**
 * Power stations:
 *   nuclear -> hyperboloid cooling towers with big steam plumes, reactor containment domes, turbine hall,
 *              switchyard (transformers + pylons), admin block, security fence and gatehouse
 *   coal    -> boiler house + turbine hall, tall chimneys with smoke, coal stockpiles fed by conveyors,
 *              rail siding with loaded hopper wagons, cooling towers (sometimes), switchyard
 *   gas     -> combined-cycle units (turbine hall + heat-recovery boiler + slim stack), fan cooling bank
 *              with spinning fans, fuel tanks, switchyard
 *   solar   -> rows of tilted panel tables on gravel, inverter cabins, maintenance tracks, substation
 *   wind    -> wind turbines with spinning rotors on gravel pads, access tracks, control building, substation
 */
import { RNG } from '../../core/rng';
import { DEFAULT_DETAILS, massTop, type DetailOptions, type HouseModel, type Mass, type Rect, type WallSide } from '../spec';
import { Site, jitter } from './civic/site';

export type PowerStyle = 'nuclear' | 'coal' | 'gas' | 'solar' | 'wind';
export const POWER_STYLES: PowerStyle[] = ['nuclear', 'coal', 'gas', 'solar', 'wind'];
export const POWER_LOTS: Record<PowerStyle, [number, number, number, number]> = {
  nuclear: [190, 230, 170, 210],
  coal: [180, 220, 160, 200],
  gas: [130, 160, 110, 140],
  solar: [130, 190, 110, 160],
  wind: [170, 230, 150, 200],
};

export function powerLotSize(rng: RNG, style: PowerStyle): { w: number; d: number } {
  const [w0, w1, d0, d1] = POWER_LOTS[style];
  return { w: rng.range(w0, w1), d: rng.range(d0, d1) };
}

export interface PowerSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style: PowerStyle;
  details?: DetailOptions;
}

const facing = (fx: number, fz: number) => Math.atan2(-fx, -fz);

/** Ribbed metal cladding (with a glazed strip) over every wall of a shed, one quad per floor. */
function clad(s: Site, m: Mass, strip = true): void {
  for (const side of ['front', 'back', 'left', 'right'] as WallSide[]) {
    const wl = s.wall(m, side);
    for (let f = 0; f < m.floors; f++) {
      s.facade.add({ kind: 'window', massId: m.id, wall: side, floor: f, cx: (wl.ax + wl.bx) / 2, cz: (wl.az + wl.bz) / 2, nx: wl.nx, nz: wl.nz, width: wl.length - 0.2, y0: m.baseY + f * m.floorHeight, height: m.floorHeight, color: '#2b3a48', frameColor: m.wallColor, mullions: false, style: strip && f === m.floors - 1 ? 'claddingStrip' : 'cladding', lit: s.rng.chance(0.5), noSill: true });
    }
  }
}

/** Fenced switchyard: gravel, transformer rows, pylons carrying the lines away. */
function switchyard(s: Site, r: Rect): void {
  const { rng } = s;
  s.parkingLots.push({ rect: r, rows: [], stallWidth: 3, color: '#9a958a' });
  s.fences.push({ kind: 'iron', color: '#5a5f66', height: 2.6, segments: [
    { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0 }, { x0: r.x0, z0: r.z1, x1: r.x1, z1: r.z1 },
    { x0: r.x0, z0: r.z0, x1: r.x0, z1: r.z1 }, { x0: r.x1, z0: r.z0, x1: r.x1, z1: r.z1 },
  ] });
  for (let x = r.x0 + 4; x < r.x1 - 3; x += 6) for (let z = r.z0 + 4; z < r.z1 - 9; z += 6) s.props.push({ kind: 'transformer', x, y: 0.05, z, rot: 0, color: '#8a8f96' });
  for (let x = r.x0 + 6; x < r.x1 - 4; x += 18) s.props.push({ kind: 'pylon', x, y: 0.05, z: r.z1 - 5, rot: 0, color: '#8f959c', h: rng.range(24, 32) });
}

/** Perimeter security fence with a gatehouse and a staff car park at the front. */
function perimeter(s: Site, gx: number, park = true): void {
  const { W, rng } = s;
  s.fence('iron', '#3a3d40', 2.6, [[gx - 4, gx + 4]]);
  s.driveways.push({ x0: gx - 4, x1: gx + 4, z0: 0, z1: 14 });
  const gh = s.mass('unit', { x0: gx + 5, x1: gx + 9, z0: 3, z1: 7 }, 1, 2.8, '#d9d4c7', { color: '#6b6e72' });
  s.windows(gh, { bay: 2, w: 1.3, h: 1.1, sill: 1.0, style: 'plain', frame: '#3a3d40', litChance: 0.8 });
  if (park && gx - 8 > 20) s.parking({ x0: 4, x1: Math.min(gx - 6, 60), z0: 3, z1: 20 });
  void W;
  void rng;
}

function nuclear(s: Site): void {
  const { rng, W, D } = s;
  const conc = jitter('#c9c4b8', rng, 0.03);
  const n = rng.chance(0.55) ? 2 : 1;
  const rb = Math.min(30, (W - 30) / (2 * n) - 4);
  const th = rb * rng.range(4.2, 4.8);
  let top = 0;
  for (let i = 0; i < n; i++) {
    const x = W * (n === 1 ? 0.7 : 0.32 + i * 0.42);
    const z = D - rb - 8;
    s.props.push({ kind: 'hyperTower', x, y: 0.05, z, rot: 0, color: conc, color2: jitter('#a8a196', rng, 0.03), w: rb, h: th });
    s.reserved.push({ x0: x - rb - 2, x1: x + rb + 2, z0: z - rb - 2, z1: z + rb + 2 });
    for (let k = 0; k < 4; k++) s.animated.push({ kind: 'smoke', x: x + rng.range(-rb * 0.25, rb * 0.25), y: th - 2, z: z + rng.range(-rb * 0.25, rb * 0.25), radius: rb * 0.32, amount: 28, steam: true });
    top = th;
  }
  // Reactor domes either side of the turbine hall, in front of the towers.
  const zr = D - 2 * rb - 40;
  const hall = s.mass('main', { x0: W * 0.3, x1: W * 0.7, z0: zr - 14, z1: zr + 14 }, 1, 24, jitter('#d9d4c7', rng, 0.03), { color: '#7a7f86' });
  clad(s, hall);
  const rr = rng.range(15, 19);
  const nd = rng.chance(0.6) ? 2 : 1;
  for (let i = 0; i < nd; i++) {
    const x = nd === 1 ? W * 0.2 : i === 0 ? W * 0.3 - rr - 3 : W * 0.7 + rr + 3;
    s.props.push({ kind: 'reactorDome', x, y: 0.05, z: zr, rot: 0, color: jitter('#e9e6df', rng, 0.02), color2: jitter('#8f959c', rng, 0.03), w: rr, h: rr * 1.6 });
    s.reserved.push({ x0: x - rr - 1, x1: x + rr + 1, z0: zr - rr - 1, z1: zr + rr + 1 });
  }
  // Admin block, switchyard, perimeter.
  const adm = s.mass('main', { x0: W * 0.42, x1: W * 0.58, z0: 22, z1: 34 }, 3, 3.6, jitter('#e2ddd0', rng, 0.03), { color: '#6b6e72' });
  s.windows(adm, { bay: 3.2, w: 2.2, h: 1.6, sill: 0.9, style: 'ribbon', frame: '#3a3d40', litChance: 0.6 });
  s.opening(adm, 'front', 0.5, 'shopfront', 4, 2.8, '#2b3a48', 'shop');
  switchyard(s, { x0: W - 58, x1: W - 6, z0: 24, z1: Math.min(zr - 22, 70) });
  perimeter(s, W * 0.5);
  s.height = top + 12;
  s.info.reactors = nd;
  s.info.coolingTowers = n;
}

function coal(s: Site): void {
  const { rng, W, D } = s;
  const shed = jitter(rng.pick(['#8f9aa3', '#9fb0bf', '#7f8c99', '#b9b6ad']), rng, 0.03);
  const bx0 = W * 0.38;
  const boiler = s.mass('main', { x0: bx0, x1: bx0 + 36, z0: D * 0.45, z1: D * 0.45 + 34 }, 1, 52, shed, { color: '#5a5f66' });
  clad(s, boiler);
  const turb = s.mass('wing', { x0: bx0 + 36, x1: bx0 + 76, z0: D * 0.45 + 4, z1: D * 0.45 + 30 }, 1, 24, jitter(shed, rng, 0.04), { color: '#5a5f66' });
  clad(s, turb);
  const nStack = rng.chance(0.5) ? 2 : 1;
  const sh = rng.range(120, 170);
  for (let i = 0; i < nStack; i++) {
    const x = bx0 - 12 - i * 14;
    const z = D * 0.45 + 17;
    s.props.push({ kind: 'smokestack', x, y: 0.05, z, rot: 0, color: rng.pick(['#b5aa98', '#c9c4b8']), color2: '#c0392b', w: 4.2, h: sh });
    s.animated.push({ kind: 'smoke', x, y: sh, z, radius: 3.2, amount: 22 });
  }
  let top = sh;
  if (rng.chance(0.6)) {
    const rb = rng.range(16, 20);
    const th = rb * 4;
    const x = W - rb - 10;
    const z = D - rb - 8;
    s.props.push({ kind: 'hyperTower', x, y: 0.05, z, rot: 0, color: jitter('#c9c4b8', rng, 0.03), color2: '#a8a196', w: rb, h: th });
    s.reserved.push({ x0: x - rb - 2, x1: x + rb + 2, z0: z - rb - 2, z1: z + rb + 2 });
    for (let k = 0; k < 3; k++) s.animated.push({ kind: 'smoke', x: x + rng.range(-3, 3), y: th - 2, z: z + rng.range(-3, 3), radius: rb * 0.3, amount: 22, steam: true });
    top = Math.max(top, th);
  }
  // Coal yard on the left: black piles fed by conveyors to the boiler, a rail siding with loaded hoppers.
  const yard: Rect = { x0: 6, x1: bx0 - 36, z0: D * 0.35, z1: D - 8 };
  s.parkingLots.push({ rect: yard, rows: [], stallWidth: 3, color: '#3b3a38' });
  const piles = Math.max(2, Math.floor((yard.z1 - yard.z0) / 34));
  for (let i = 0; i < piles; i++) {
    const z = yard.z0 + ((yard.z1 - yard.z0) * (i + 0.5)) / piles;
    const x = (yard.x0 + yard.x1) / 2 + 6;
    s.props.push({ kind: 'mound', x, y: 0, z, rot: 0, color: '#232323', w: Math.min(16, (yard.x1 - yard.x0) / 2 - 2), h: rng.range(7, 11), n: 1 });
    const dx = bx0 - x;
    const dz = D * 0.45 + 10 - z;
    s.props.push({ kind: 'conveyor', x: x + 10, y: 0.05, z, rot: facing(dx, dz), color: '#8f959c', w: Math.hypot(dx, dz) - 10, h: 26 });
  }
  s.props.push({ kind: 'railTrack', x: 4, y: 0.05, z: (yard.z0 + yard.z1) / 2, rot: Math.PI / 2, color: '#9aa0a6', w: yard.z1 - yard.z0 });
  s.props.push({ kind: 'hopperWagons', x: 4, y: 0.05, z: (yard.z0 + yard.z1) / 2, rot: 0, color: '#5a4632', d: Math.min(90, yard.z1 - yard.z0 - 6) });
  s.props.push({ kind: 'bulldozer', x: (yard.x0 + yard.x1) / 2 - 8, y: 0.05, z: yard.z0 + 6, rot: 0.6, color: '#f2c94c' });
  switchyard(s, { x0: W - 60, x1: W - 6, z0: 24, z1: Math.min(D * 0.45 - 6, 70) });
  perimeter(s, W * 0.55);
  s.height = top + 15;
  s.info.chimneys = nStack;
}

function gas(s: Site): void {
  const { rng, W, D } = s;
  const shed = jitter(rng.pick(['#c9ccd1', '#d9d4c7', '#9fb0bf']), rng, 0.03);
  const units = rng.int(2, 3);
  const z0 = D * 0.42;
  let top = 0;
  for (let i = 0; i < units; i++) {
    const x0 = 10 + i * 30;
    const gt = s.mass('main', { x0, x1: x0 + 14, z0, z1: z0 + 30 }, 1, 14, shed, { color: '#6b6e72' });
    clad(s, gt);
    const hrsg = s.mass('wing', { x0: x0 + 1, x1: x0 + 13, z0: z0 + 32, z1: z0 + 52 }, 1, 26, jitter('#8f959c', rng, 0.04), { color: '#5a5f66' });
    clad(s, hrsg, false);
    const sh = rng.range(45, 60);
    s.props.push({ kind: 'smokestack', x: x0 + 7, y: 0.05, z: z0 + 56, rot: 0, color: '#c9ccd1', color2: '#9aa0a6', w: 2.6, h: sh });
    s.animated.push({ kind: 'smoke', x: x0 + 7, y: sh, z: z0 + 56, radius: 2, amount: 10, steam: true });
    top = Math.max(top, sh);
  }
  // Fan cooling bank on a deck.
  const cx0 = 10 + units * 30 + 6;
  if (W - 10 - cx0 > 20) {
    const deck = s.mass('unit', { x0: cx0, x1: W - 10, z0: z0 + 8, z1: z0 + 24 }, 1, 9, '#9aa0a6', { color: '#6b6e72' });
    clad(s, deck, false);
    for (let x = cx0 + 4; x < W - 13; x += 8) for (const z of [z0 + 12, z0 + 20]) {
      s.props.push({ kind: 'coolingTower', x, y: massTop(deck), z, rot: 0, color: '#c9ccd1' });
      s.animated.push({ kind: 'fan', x, y: massTop(deck) + 2.2, z, radius: 1.0, speed: rng.range(4, 7) });
    }
  }
  for (const [x, z] of [[W - 24, D - 20], [W - 46, D - 20]]) s.props.push({ kind: 'storageTank', x, y: 0.05, z, rot: 0, color: '#e9e6df', color2: '#c0392b', w: 8, h: 11 });
  switchyard(s, { x0: W - 54, x1: W - 6, z0: 22, z1: Math.min(z0 - 4, 56) });
  perimeter(s, W * 0.35);
  s.height = top + 8;
  s.info.units = units;
}

function solar(s: Site): void {
  const { rng, W, D } = s;
  s.lawnColor = jitter('#a8a46a', rng, 0.05);
  const field: Rect = { x0: 6, x1: W - 6, z0: 26, z1: D - 6 };
  s.parkingLots.push({ rect: field, rows: [], stallWidth: 3, color: '#b5ab92' });
  const tw = rng.range(26, 36);
  const blocks = Math.max(1, Math.floor((field.x1 - field.x0 - 6) / (tw + 3)));
  let tables = 0;
  for (let z = field.z0 + 4; z < field.z1 - 3; z += 7.5) {
    for (let b = 0; b < blocks; b++) {
      const x = field.x0 + 3 + b * (tw + 3) + tw / 2;
      s.props.push({ kind: 'solarTable', x, y: 0.05, z, rot: 0, color: '#1d2c4a', w: tw, d: 4.2 });
      tables++;
    }
  }
  // Inverter cabins along the central track, substation at the front.
  s.paths.push({ x0: W / 2 - 2, x1: W / 2 + 2, z0: 14, z1: field.z1 });
  for (let z = field.z0 + 20; z < field.z1 - 10; z += 40) {
    const inv = s.mass('unit', { x0: W / 2 + 3, x1: W / 2 + 9, z0: z, z1: z + 2.6 }, 1, 2.6, '#e9e6df', { color: '#9aa0a6' });
    s.reserved.push(inv.rect);
  }
  switchyard(s, { x0: 6, x1: 50, z0: 4, z1: 24 });
  perimeter(s, W * 0.5, false);
  s.height = 32;
  s.info.tables = tables;
}

function wind(s: Site): void {
  const { rng, W, D } = s;
  s.lawnColor = jitter('#8fb060', rng, 0.05);
  const h = rng.range(60, 80);
  const r = h * rng.range(0.38, 0.45);
  const yaw = rng.range(-0.4, 0.4);
  const spots: [number, number][] = [];
  for (let t = 0; t < 200 && spots.length < 9; t++) {
    const x = rng.range(r + 6, W - r - 6);
    const z = rng.range(34, D - 12);
    if (spots.some(([a, b]) => Math.hypot(a - x, b - z) < r * 2.2)) continue;
    spots.push([x, z]);
  }
  for (const [x, z] of spots) {
    s.props.push({ kind: 'turbineTower', x, y: 0.05, z, rot: yaw, color: '#eeeeea', h });
    s.animated.push({ kind: 'rotor', x: x - Math.sin(yaw) * 1.7, y: h + 0.55, z: z - Math.cos(yaw) * 1.7, radius: r, rot: yaw, speed: rng.range(0.8, 1.3) });
    s.parkingLots.push({ rect: { x0: x - 5, x1: x + 5, z0: z - 5, z1: z + 5 }, rows: [], stallWidth: 3, color: '#b5ab92' });
    s.paths.push({ x0: x - 1.6, x1: x + 1.6, z0: 20, z1: z });
  }
  s.paths.push({ x0: 8, x1: W - 8, z0: 18, z1: 22 });
  const ctl = s.mass('main', { x0: 8, x1: 24, z0: 4, z1: 14 }, 1, 3.6, '#e2ddd0', { color: '#6b6e72' });
  s.windows(ctl, { bay: 3, w: 1.6, h: 1.4, sill: 1, style: 'plain', frame: '#3a3d40', litChance: 0.6 });
  switchyard(s, { x0: 30, x1: 70, z0: 2, z1: 16 });
  s.height = h + r + 4;
  s.info.turbines = spots.length;
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 10);
}

const GENERATORS: Record<PowerStyle, (s: Site) => void> = { nuclear, coal, gas, solar, wind };

export function generatePower(spec: PowerSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const s = new Site(rng, spec.lotWidth, spec.lotDepth, spec.details ?? DEFAULT_DETAILS, spec.seed, spec.style);
  s.info.type = 'power';
  GENERATORS[spec.style](s);
  return s.model(`power:${spec.style}`);
}
