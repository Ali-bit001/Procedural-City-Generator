/**
 * Retail grammar.
 *
 *   Lot        -> Form
 *   stripMall  -> single-storey row of shops + covered walkway + marked parking + pylon sign + service lane
 *   bigBox     -> big store box + glazed entrance block + giant sign + huge parking (trolley shelters, lot lights)
 *                 + loading docks with trucks + rooftop units
 *   gasStation -> fuel canopy over pump islands + convenience store + price pylon + aprons
 *   carDealer  -> glazed showroom + display forecourt (angled cars, hero car on a platform, pennants) + service bays
 *   bazaar     -> South Asian market row: narrow 2-3 storey shops, roller shutters, stacked signboards,
 *                 awnings, stalls on the pavement; flats above with sunshades, ACs, tanks
 */
import { RNG } from '../../core/rng';
import { jitterHex } from '../../core/color';
import { OpeningPlacer, wallOf, wallsOf } from '../facade/openings';
import { YardPlacer, addSplitACs, addWindowShades, type DetailContext } from '../details/details';
import { placeTrees } from '../details/planting';
import { SHOPS, dressShopFront, pickShop, type ShopKind } from '../details/shops';
import { summarizeProps } from './house';
import {
  DEFAULT_DETAILS,
  massTop,
  rotFromNormal,
  type Balcony,
  type DetailOptions,
  type Fence,
  type HouseModel,
  type Light,
  type Mass,
  type MassKind,
  type ParkingLot,
  type Porch,
  type Prop,
  type Rect,
  type RoofSpec,
  type Tree,
} from '../spec';

export type RetailForm = 'stripMall' | 'bigBox' | 'gasStation' | 'bazaar' | 'carDealer';

export interface RetailSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  form?: RetailForm;
  details?: DetailOptions;
}

const BRAND = ['#c0392b', '#1f6fb5', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#2c3e50'];
const SIGNS = ['#c0392b', '#1f6fb5', '#27ae60', '#f1c40f', '#ffffff', '#e67e22', '#8e44ad', '#16a085', '#2c3e50', '#e84393'];
const STUCCO = ['#e8dcc4', '#d9cfba', '#efe6d2', '#cfc6b8', '#e6d3b3', '#d6d2c9', '#b98a6a'];
const SA_WALLS = ['#efe8da', '#e8dcc0', '#f2efe6', '#d9cfba', '#cfd8d4', '#e6d3b3', '#d8e2e8', '#f0e0d0', '#e9d6c4', '#cfe0c8', '#f3dfa2'];
const CAR_COLORS = ['#f2f2f0', '#c9ccd1', '#1e1f22', '#8e1c1c', '#1f3f73', '#5a5f66', '#2d4f3c', '#b8b2a2'];
const ASPHALT = '#4f5257';

export function generateRetail(spec: RetailSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const details = spec.details ?? DEFAULT_DETAILS;
  const W = spec.lotWidth;
  const D = spec.lotDepth;
  const canBig = W >= 55 && D >= 55;
  let form: RetailForm =
    spec.form ?? rng.weighted<RetailForm>([['stripMall', 30], ['bigBox', canBig ? 18 : 0], ['gasStation', 17], ['bazaar', 22], ['carDealer', 13]]);
  if (form === 'bigBox' && !canBig) form = 'stripMall';

  // ---------- shared output ----------
  const masses: Mass[] = [];
  const facade = new OpeningPlacer(masses, rng);
  const porches: Porch[] = [];
  const props: Prop[] = [];
  const lights: Light[] = [];
  const paths: Rect[] = [];
  const driveways: Rect[] = [];
  const parkingLots: ParkingLot[] = [];
  const fences: Fence[] = [];
  const trees: Tree[] = [];
  const balconies: Balcony[] = [];
  const brand = rng.pick(BRAND);
  const roofColor = rng.pick(['#6b6e72', '#5a5d61', '#8f8b84']);
  let lawnColor = jitterHex('#7fae55', rng, 0.06);
  let pavingColor = jitterHex('#c4beb3', rng, 0.04);
  const info: Record<string, string | number> = { type: 'retail', form };
  const shopKinds: ShopKind[] = [];

  const addMass = (kind: MassKind, rect: Rect, floors: number, fh: number, wallColor: string, roof: Partial<RoofSpec> = {}, extra: Partial<Mass> = {}): Mass => {
    const m: Mass = {
      id: masses.length, kind, rect, baseY: 0.15, floors, floorHeight: fh, wallColor, plinth: false,
      roof: { type: 'flat', pitch: 0, axis: 'x', overhang: 0, gableOverhang: 0, highSide: 1, color: roofColor, parapet: true, ...roof },
      ...extra,
    };
    masses.push(m);
    return m;
  };
  const car = (x: number, z: number, rot: number) =>
    props.push({ kind: 'car', x, y: 0.05, z, rot, color: rng.pick(CAR_COLORS) });

  /**
   * Marked parking in `rect`: rows of 5 m stalls along x, double-loaded around 6 m aisles.
   * Cars park nose-in; `corrals` swaps a few stalls for trolley shelters.
   */
  const parking = (rect: Rect, carChance: number, corrals = 0): ParkingLot => {
    const sw = 2.6;
    const rows: { z0: number; z1: number; aisleAfter: boolean }[] = [];
    let z = rect.z0;
    let phase = 0;
    while (z + 5 <= rect.z1 + 1e-6) {
      rows.push({ z0: z, z1: z + 5, aisleAfter: phase === 0 });
      z += 5;
      if (phase === 0) {
        if (z + 6 + 5 > rect.z1 + 1e-6) break;
        z += 6;
      }
      phase = 1 - phase;
    }
    let corralsLeft = corrals;
    for (const row of rows) {
      const zc = (row.z0 + row.z1) / 2;
      for (let x = rect.x0 + sw / 2 + 0.3; x < rect.x1 - sw / 2; x += sw) {
        if (corralsLeft > 0 && rng.chance(0.06)) {
          props.push({ kind: 'cartCorral', x, y: 0.07, z: zc, rot: 0, color: brand });
          corralsLeft--;
          continue;
        }
        if (rng.chance(carChance)) car(x, zc, row.aisleAfter ? Math.PI : 0);
      }
    }
    const lot: ParkingLot = { rect, rows, stallWidth: sw, color: ASPHALT };
    parkingLots.push(lot);
    // Lot lights along the aisles.
    for (const row of rows.filter((r) => r.aisleAfter)) {
      for (let x = rect.x0 + 8; x < rect.x1 - 4; x += 22) lights.push({ kind: 'lotLight', x, y: 0.07, z: row.z1 + 3, rot: 0 });
    }
    return lot;
  };
  const shop = (m: Mass, cx: number, width: number, height: number, style: 'shop' | 'shutter', frame: string, signColor: string | null, signH: number, awning?: string) => {
    const zf = m.rect.z0;
    const o = facade.add({
      kind: 'shopfront', massId: m.id, wall: 'front', floor: 0, cx, cz: zf, nx: 0, nz: -1, width, y0: m.baseY + 0.05, height,
      color: style === 'shutter' ? rng.pick(['#9aa0a6', '#8a8f96', '#6f7a83', '#7d8a96']) : frame, frameColor: frame, mullions: false, style, lit: rng.chance(0.85),
    });
    if (awning) o.shade = { kind: 'awning', color: awning };
    if (signColor) {
      facade.add({
        kind: 'sign', massId: m.id, wall: 'front', floor: 0, cx, cz: zf, nx: 0, nz: -1, width: width + 0.2,
        y0: m.baseY + height + (awning ? 0.5 : 0.25), height: signH, color: signColor, frameColor: '#2b2b2b', mullions: false, lit: rng.chance(0.9),
      });
    }
    return o;
  };

  switch (form) {
    // ------------------------------------------------------------ strip mall
    case 'stripMall': {
      const bd = rng.range(14, 18);
      const bw = Math.min(W - 6, rng.range(36, 70));
      const x0 = (W - bw) / 2;
      const z1 = D - 4.5; // service lane behind
      const z0 = z1 - bd;
      const fh = rng.range(4.8, 5.6);
      const wall = jitterHex(rng.pick(STUCCO), rng, 0.03);
      const frame = rng.pick(['#2b2b2b', '#3a3d40', '#6b4a33']);
      const m = addMass('main', { x0, x1: x0 + bw, z0, z1 }, 1, fh, wall, {}, { cornice: rng.chance(0.5) ? brand : undefined });
      const n = Math.max(2, Math.round(bw / rng.range(7, 10)));
      const uw = bw / n;
      for (let i = 0; i < n; i++) {
        const kind = pickShop(rng, 'west');
        shopKinds.push(kind);
        const cx = x0 + uw * (i + 0.5);
        shop(m, cx, uw - 1.0, 3.0, 'shop', frame, rng.pick(SHOPS[kind].signs), 0.9);
        // Under the walkway: seating, boards, displays (posts stand at the outer edge).
        dressShopFront(kind, { rng, props, lights, cx, z: z0, width: uw - 0.3, depth: 2.85, roofed: true, region: 'west', floorY: m.baseY, shopTop: m.baseY + 3.05 });
      }
      porches.push({ kind: 'arcade', rect: { x0, x1: x0 + bw, z0: z0 - 3.2, z1: z0 }, floorY: 0, roofY: 3.35, stepX: W / 2, floorColor: pavingColor, roofColor: jitterHex(wall, rng, 0.05), postColor: jitterHex(wall, rng, 0.08) });
      paths.push({ x0, x1: x0 + bw, z0: z0 - 3.4, z1: z0 });
      for (let i = 0; i < n; i++) lights.push({ kind: 'ceiling', x: x0 + uw * (i + 0.5), y: 3.33, z: z0 - 1.6, rot: 0 });
      // Back: loading doors, dumpsters; service lane.
      for (let i = 0; i < n; i += 2) {
        facade.add({ kind: 'garageDoor', massId: m.id, wall: 'back', floor: 0, cx: x0 + uw * (i + 0.5), cz: z1, nx: 0, nz: 1, width: 3.0, y0: m.baseY, height: 3.2, color: '#c9ccd1', frameColor: frame, mullions: false });
      }
      paths.push({ x0: 0.5, x1: W - 0.5, z0: z1, z1: D - 0.5 });
      const nd = rng.int(2, 3);
      for (let i = 0; i < nd; i++) props.push({ kind: 'dumpster', x: x0 + (bw / nd) * (i + 0.5) + rng.range(-1, 1), y: 0.05, z: z1 + 2.6, rot: 0, color: rng.pick(['#2e6b3a', '#1f4f8a', '#5a5f66']) });
      for (let i = 0; i < n; i++) props.push({ kind: 'acUnit', x: x0 + uw * (i + 0.5), y: massTop(m) + 0.1, z: (z0 + z1) / 2 + rng.range(-3, 3), rot: 0, color: '#cfd2d4' });
      // Front parking, an entrance apron and a pylon sign.
      if (z0 - 4.5 - 1.5 >= 10) parking({ x0: 3, x1: W - 3, z0: 1.5, z1: z0 - 4.5 }, details.cars);
      driveways.push({ x0: W / 2 - 3.5, x1: W / 2 + 3.5, z0: 0, z1: 1.5 });
      props.push({ kind: 'pylonSign', x: rng.chance(0.5) ? 2.2 : W - 2.2, y: 0, z: 1.0, rot: 0, color: brand, color2: '#5a5f66', h: rng.range(7, 10), w: 3.2 });
      info.shops = n;
      break;
    }

    // ------------------------------------------------------------ big-box store
    case 'bigBox': {
      const fh = rng.range(8, 10);
      const wall = jitterHex(rng.pick(['#d6d2c9', '#e8e4dc', '#c9c4b8', '#b9b6ad', '#e9e6df']), rng, 0.03);
      const bw = Math.min(W - 10, rng.range(50, 80));
      const sideDocks = W - bw - 4 >= 17;
      const bd = Math.min(D - (sideDocks ? 26 : 40), rng.range(40, 55));
      const x0 = 4;
      const z1 = sideDocks ? D - 3 : D - 17;
      const z0 = z1 - bd;
      const m = addMass('main', { x0, x1: x0 + bw, z0, z1 }, 1, fh, wall, {}, { cornice: brand });
      // Glazed entrance block, taller than the box, carrying the main sign.
      const ex = x0 + bw * rng.range(0.35, 0.65);
      const entry = addMass('wing', { x0: ex - 7, x1: ex + 7, z0: z0 - 5, z1: z0 + 0.5 }, 1, fh + 1.6, jitterHex(brand, rng, 0.05));
      for (const side of ['front', 'left', 'right'] as const) {
        const wl = wallOf(entry.rect, side);
        facade.add({ kind: 'shopfront', massId: entry.id, wall: side, floor: 0, cx: (wl.ax + wl.bx) / 2, cz: (wl.az + wl.bz) / 2, nx: wl.nx, nz: wl.nz, width: wl.length - 0.8, y0: entry.baseY + 0.05, height: 4.2, color: '#2b3a48', frameColor: '#d6d6d2', mullions: false, style: 'shop', lit: true });
      }
      facade.add({ kind: 'sign', massId: entry.id, wall: 'front', floor: 0, cx: ex, cz: entry.rect.z0, nx: 0, nz: -1, width: 11, y0: 5.6, height: Math.min(2.4, fh - 4.6), color: '#ffffff', frameColor: '#2b2b2b', mullions: false, lit: true });
      // A second giant sign on the box itself.
      const sx = ex < x0 + bw / 2 ? x0 + bw * 0.78 : x0 + bw * 0.22;
      facade.add({ kind: 'sign', massId: m.id, wall: 'front', floor: 0, cx: sx, cz: z0, nx: 0, nz: -1, width: Math.min(18, bw * 0.3), y0: fh - 3.2, height: 2.2, color: brand, frameColor: '#2b2b2b', mullions: false, lit: true });
      // Loading docks with trucks backed in.
      const dockWall = wallOf(m.rect, sideDocks ? 'right' : 'back');
      const docks = Math.max(2, Math.min(6, Math.floor((dockWall.length - 6) / 4.5)));
      for (let i = 0; i < docks; i++) {
        const t = 4 + i * 4.5;
        const cx = dockWall.ax + ((dockWall.bx - dockWall.ax) * t) / dockWall.length;
        const cz = dockWall.az + ((dockWall.bz - dockWall.az) * t) / dockWall.length;
        facade.add({ kind: 'garageDoor', massId: m.id, wall: dockWall.side, floor: 0, cx, cz, nx: dockWall.nx, nz: dockWall.nz, width: 3.0, y0: 1.2, height: 3.0, color: '#c9ccd1', frameColor: '#3b3e42', mullions: false });
        if (rng.chance(0.55)) {
          const len = 12;
          props.push({ kind: 'truck', x: cx + dockWall.nx * (len + 0.4), y: 0.05, z: cz + dockWall.nz * (len + 0.4), rot: rotFromNormal(dockWall.nx, dockWall.nz), color: rng.pick(['#f2f2f0', '#c0392b', '#1f3f73']), color2: rng.pick(['#f2f2f0', '#e9e6df', brand]), d: len });
        }
      }
      driveways.push(sideDocks ? { x0: x0 + bw + 1, x1: W - 1, z0: 0, z1: D - 1 } : { x0: 1, x1: W - 1, z0: z1, z1: D - 1 });
      // Rooftop units and skylights.
      for (let x = x0 + 6; x < x0 + bw - 4; x += 12) for (let z = z0 + 6; z < z1 - 4; z += 12) {
        props.push(rng.chance(0.6) ? { kind: 'acUnit', x, y: massTop(m) + 0.1, z, rot: 0, color: '#cfd2d4' } : { kind: 'solarPanels', x, y: massTop(m) + 0.1, z, rot: 0, color: '#9fb4bf', w: 3, d: 1.8 });
      }
      // Huge parking lot with trolley shelters.
      if (z0 - 6 - 2 >= 16) parking({ x0: 3, x1: (sideDocks ? x0 + bw : W - 3), z0: 2, z1: z0 - 6 }, details.cars * 0.8, rng.int(2, 4));
      paths.push({ x0: ex - 9, x1: ex + 9, z0: z0 - 6.5, z1: z0 - 5 });
      driveways.push({ x0: 6, x1: 13, z0: 0, z1: 2 });
      props.push({ kind: 'pylonSign', x: W - 3, y: 0, z: 1.2, rot: 0, color: brand, color2: '#5a5f66', h: rng.range(11, 15), w: 5 });
      info.size = `${Math.round(bw)} × ${Math.round(bd)} m`;
      info.docks = docks;
      break;
    }

    // ------------------------------------------------------------ petrol station
    case 'gasStation': {
      lawnColor = ASPHALT;
      pavingColor = '#c9c4b8';
      const sw = Math.min(16, W * 0.4);
      const sd = rng.range(9, 11);
      const left = rng.chance(0.5);
      const sx0 = left ? 2 : W - 2 - sw;
      const store = addMass('main', { x0: sx0, x1: sx0 + sw, z0: D - 2 - sd, z1: D - 2 }, 1, 4.2, jitterHex(rng.pick(['#e9e6df', '#d6d2c9', '#f2efe6']), rng, 0.03), {}, { cornice: brand });
      shop(store, sx0 + sw / 2, sw - 2.5, 3.0, 'shop', '#2b2b2b', null, 0);
      facade.add({ kind: 'sign', massId: store.id, wall: 'front', floor: 0, cx: sx0 + sw / 2, cz: store.rect.z0, nx: 0, nz: -1, width: sw - 3, y0: 3.4, height: 0.8, color: brand, frameColor: '#2b2b2b', mullions: false, lit: true });
      paths.push({ x0: sx0, x1: sx0 + sw, z0: store.rect.z0 - 2, z1: store.rect.z0 });
      // Canopy over the pump islands.
      const cw = Math.min(W - 8, rng.range(16, 24));
      // Canopy depth is limited by the room between the street and the shop forecourt.
      const cd = Math.max(6, Math.min(rng.range(10, 13), D - 2 - sd - 7.5));
      const cx = W / 2;
      const cz = Math.max(1.5 + cd / 2, Math.min(store.rect.z0 - 7.5 - cd / 2, 3 + cd / 2 + rng.range(0, 3)));
      props.push({ kind: 'fuelCanopy', x: cx, y: 0.07, z: cz, rot: 0, color: '#f2f2f0', color2: brand, w: cw, d: cd, h: 5.2 });
      const islands = Math.max(2, Math.floor(cw / 6.5)); // >= 6.5 m apart so cars at neighbouring islands fit
      for (let i = 0; i < islands; i++) {
        const x = cx - cw / 2 + (cw / islands) * (i + 0.5);
        props.push({ kind: 'fuelPump', x, y: 0.07, z: cz, rot: 0, color: brand });
        // Cars park tight against their own island so neighbouring islands never collide.
        for (const s of [-1, 1]) if (rng.chance(details.cars * 0.6)) car(x + s * 1.75, cz + rng.range(-0.6, 0.6), rng.chance(0.5) ? 0 : Math.PI);
      }
      // A few stalls by the shop.
      parkingLots.push({ rect: { x0: sx0, x1: sx0 + sw, z0: store.rect.z0 - 7.5, z1: store.rect.z0 - 2.5 }, rows: [{ z0: store.rect.z0 - 7.5, z1: store.rect.z0 - 2.5 }], stallWidth: 2.6, color: ASPHALT });
      for (let x = sx0 + 1.6; x < sx0 + sw - 1.3; x += 2.6) if (rng.chance(details.cars * 0.7)) car(x, store.rect.z0 - 5, Math.PI);
      props.push({ kind: 'pylonSign', x: left ? W - 2 : 2, y: 0, z: 1.2, rot: 0, color: brand, color2: '#5a5f66', h: rng.range(6, 8), w: 2.4 });
      for (const x of [4, W - 11]) driveways.push({ x0: x, x1: x + 7, z0: 0, z1: 0.3 });
      props.push({ kind: 'bins', x: left ? sx0 + sw + 1.2 : sx0 - 1.2, y: 0, z: store.rect.z0 + 1, rot: 0, color: '#2b2b2b', color2: brand });
      lights.push({ kind: 'lotLight', x: left ? W - 3 : 3, y: 0, z: D - 4, rot: 0 });
      info.pumps = islands * 2;
      break;
    }

    // ------------------------------------------------------------ car showroom
    case 'carDealer': {
      pavingColor = jitterHex('#d0cdc6', rng, 0.03);
      const bw = Math.min(W - 8, rng.range(22, 36));
      const bd = Math.max(10, Math.min(D - 18, rng.range(14, 20)));
      const left = rng.chance(0.5);
      const x0 = left ? 3 : W - 3 - bw;
      const z1 = D - 4;
      const z0 = z1 - bd;
      const fh = rng.range(6, 7);
      const m = addMass('main', { x0, x1: x0 + bw, z0, z1 }, 1, fh, jitterHex(rng.pick(['#e9e9e6', '#f3f3f1', '#3b3e42', '#9da0a3']), rng, 0.03), {}, { cornice: brand });
      // Floor-to-ceiling glass on the front and on the side facing the forecourt.
      facade.add({ kind: 'shopfront', massId: m.id, wall: 'front', floor: 0, cx: x0 + bw / 2, cz: z0, nx: 0, nz: -1, width: bw - 1, y0: m.baseY + 0.05, height: fh - 1.6, color: '#2b3a48', frameColor: '#d6d6d2', mullions: false, style: 'shop', lit: true });
      const sideWall = wallOf(m.rect, left ? 'right' : 'left');
      facade.add({ kind: 'shopfront', massId: m.id, wall: sideWall.side, floor: 0, cx: sideWall.ax, cz: (sideWall.az + sideWall.bz) / 2, nx: sideWall.nx, nz: 0, width: bd - 1.5, y0: m.baseY + 0.05, height: fh - 1.6, color: '#2b3a48', frameColor: '#d6d6d2', mullions: false, style: 'shop', lit: true });
      facade.add({ kind: 'sign', massId: m.id, wall: 'front', floor: 0, cx: x0 + bw / 2, cz: z0, nx: 0, nz: -1, width: Math.min(bw * 0.6, 16), y0: fh - 1.3, height: 0.95, color: '#ffffff', frameColor: '#2b2b2b', mullions: false, lit: true });
      // Service bays at the back.
      const bays = rng.int(2, 3);
      for (let i = 0; i < bays; i++) facade.add({ kind: 'garageDoor', massId: m.id, wall: 'back', floor: 0, cx: x0 + (bw / bays) * (i + 0.5), cz: z1, nx: 0, nz: 1, width: 3.2, y0: m.baseY, height: 3.4, color: '#c9ccd1', frameColor: '#3b3e42', mullions: false });
      paths.push({ x0: 0.5, x1: W - 0.5, z0: z1, z1: D - 0.5 });
      // Display forecourt: a hero car on a lit platform, rows of cars angled to the street, pennants.
      paths.push({ x0: 1.5, x1: W - 1.5, z0: 0.05, z1: z0 });
      const shiny = ['#f2f2f0', '#c9ccd1', '#1e1f22', '#b3121b', '#1f3f73', '#5a5f66', '#e0e0e0', '#0e5e4f', '#f39c12'];
      const px = x0 + bw / 2;
      const pz = z0 - 4.5;
      let shown = 0;
      if (pz > 6.5) {
        props.push({ kind: 'carPlatform', x: px, y: 0.06, z: pz, rot: 0, color: '#d6d6d2' });
        props.push({ kind: 'car', x: px, y: 0.36, z: pz, rot: rng.range(0.4, 0.9), color: rng.pick(shiny) });
        shown++;
      }
      // Angled 0.4 rad, a car is ~3.3 m wide across the row: space them 4 m apart, same angle per row.
      let rowIndex = 0;
      for (let rz = 4.0; rz < z0 - 2.6; rz += 6) {
        const nearPlatform = pz > 6.5 && rz > pz - 5.5;
        const angle = rowIndex++ % 2 === 0 ? 0.4 : -0.4;
        for (let x = 3.8; x < W - 3.8; x += 4.0) {
          if (nearPlatform && Math.abs(x - px) < 5) continue;
          if (rz + 2.4 > z0 && x > x0 - 1.5 && x < x0 + bw + 1.5) continue;
          props.push({ kind: 'car', x, y: 0.05, z: rz, rot: Math.PI + angle, color: rng.pick(shiny) });
          shown++;
        }
      }
      props.push({ kind: 'pennants', x: W / 2, y: 0.05, z: 0.9, rot: 0, color: '#ffffff', w: W - 3, h: 4.2 });
      props.push({ kind: 'pylonSign', x: left ? W - 1.8 : 1.8, y: 0, z: 0.9, rot: 0, color: brand, color2: '#5a5f66', h: rng.range(7, 9), w: 2.8 });
      lights.push({ kind: 'lotLight', x: 1.2, y: 0.05, z: z0 * 0.5, rot: 0 }, { kind: 'lotLight', x: W - 1.2, y: 0.05, z: z0 * 0.5, rot: 0 }); // at the edges, clear of the display cars
      driveways.push({ x0: left ? W - 11 : 4, x1: left ? W - 4 : 11, z0: 0, z1: 0.3 });
      info.cars = shown;
      break;
    }

    // ------------------------------------------------------------ bazaar (South Asian market row)
    case 'bazaar': {
      lawnColor = jitterHex('#b9b4aa', rng, 0.04);
      pavingColor = jitterHex('#a9a49a', rng, 0.04);
      const setback = rng.range(2.5, 4);
      const fh = 3.2;
      let x = 0.5;
      const units: Mass[] = [];
      while (x < W - 3.5) {
        const w = Math.min(rng.range(3, 4.6), W - 0.5 - x);
        if (w < 2.8) break;
        const d = rng.range(8, 12);
        const floors = rng.int(2, 3);
        const u = addMass('unit', { x0: x, x1: x + w, z0: setback, z1: setback + d }, floors, fh, jitterHex(rng.pick(SA_WALLS), rng, 0.05), { parapet: true }, { floorBands: true });
        units.push(u);
        x += w;
      }
      const band = rng.pick(['#5a5f66', '#b8462f', '#2f5b8a', '#3f6f4f', '#ffffff']);
      for (const u of units) {
        const uw = u.rect.x1 - u.rect.x0;
        const kind = pickShop(rng, 'sa');
        shopKinds.push(kind);
        const def = SHOPS[kind];
        const shutter = rng.chance(def.shutter);
        const awn = rng.chance(def.awning) ? rng.pick(def.awnings) : undefined;
        const signH = rng.range(0.6, 0.85);
        const ucx = (u.rect.x0 + u.rect.x1) / 2;
        shop(u, ucx, uw - 0.5, 2.5, shutter ? 'shutter' : 'shop', '#3b3e42', rng.pick(def.signs), signH, awn);
        dressShopFront(kind, { rng, props, lights, cx: ucx, z: u.rect.z0, width: uw - 0.1, depth: setback - 0.25, roofed: false, region: 'sa', floorY: u.baseY, shopTop: u.baseY + 2.55 });
        const lowerSignTop = u.baseY + 0.05 + 2.5 + (awn ? 0.5 : 0.25) + signH;
        // Upper floors: windows (some with a sign over the first floor too).
        const wl = wallOf(u.rect, 'front');
        const n = uw >= 4 ? 2 : 1;
        if (rng.chance(0.35)) {
          facade.add({ kind: 'sign', massId: u.id, wall: 'front', floor: 1, cx: (u.rect.x0 + u.rect.x1) / 2, cz: u.rect.z0, nx: 0, nz: -1, width: uw - 0.4, y0: lowerSignTop + 0.15, height: Math.min(1.2, u.baseY + 2 * fh - 0.15 - lowerSignTop - 0.15), color: rng.pick(SIGNS), frameColor: '#2b2b2b', mullions: false, lit: rng.chance(0.8) });
          if (u.floors > 2) facade.wallWindows(u, wl, { n, bay: uw / n, w: 1.2, h: 1.4, sill: 0.9, floors: [2], frame: '#6b4a33', mullions: false, litChance: 0.45 });
        } else {
          facade.wallWindows(u, wl, { n, bay: uw / n, w: 1.2, h: 1.4, sill: 0.9, floors: Array.from({ length: u.floors - 1 }, (_, k) => k + 1), frame: '#6b4a33', mullions: false, litChance: 0.45 });
        }
        facade.wallWindows(u, wallOf(u.rect, 'back'), { n, bay: uw / n, w: 1.0, h: 1.2, sill: 1.0, floors: Array.from({ length: u.floors - 1 }, (_, k) => k + 1), frame: '#6b4a33', mullions: false, litChance: 0.4 });
        // A bare light over each shop.
        lights.push({ kind: 'sconce', x: (u.rect.x0 + u.rect.x1) / 2, y: u.baseY + 2.75, z: u.rect.z0, rot: 0 });
      }
      for (const o of facade.openings) if (o.kind === 'window') o.style = 'casement';
      // Exposed end walls of taller units get a few windows too.
      for (const u of units) for (const wl of wallsOf(u.rect)) if (wl.side === 'left' || wl.side === 'right') facade.wallWindows(u, wl, { bay: 3.5, w: 1.0, h: 1.2, sill: 1.0, floors: Array.from({ length: u.floors - 1 }, (_, k) => k + 1), frame: '#6b4a33', mullions: false, litChance: 0.4 });
      if (rng.chance(0.8)) addWindowShades(facade, units.map((u) => u.id), 'slab', band);
      // Iron balconies on a few first-floor windows.
      for (const o of facade.openings.filter((oo) => oo.kind === 'window' && oo.wall === 'front' && oo.floor === 1 && !oo.shade)) {
        if (!rng.chance(0.3)) continue;
        balconies.push({ cx: o.cx, cz: o.cz, nx: 0, nz: -1, width: o.width + 0.6, depth: 0.7, y: masses[o.massId].baseY + fh, rail: 'iron', color: band, railColor: '#2b2b2b' });
      }
      // Pavement with stalls in front of the shops.
      paths.push({ x0: 0, x1: W, z0: 0.05, z1: setback });
      // Roofs: tanks, clotheslines; back alley.
      for (const u of units) {
        const top = massTop(u) + 0.1;
        if (rng.chance(0.7 * Math.min(1, details.waterTanks * 2))) props.push({ kind: 'waterTank', x: (u.rect.x0 + u.rect.x1) / 2, y: top, z: u.rect.z1 - 1.3, rot: 0, color: rng.pick(['#1e1f22', '#1e1f22', '#2a5fa8', '#e8e8e2']), w: Math.min(0.65, (u.rect.x1 - u.rect.x0) / 2 - 0.4), h: rng.range(0.3, 0.8) });
      }
      const backZ = Math.max(...units.map((u) => u.rect.z1));
      paths.push({ x0: 0, x1: W, z0: backZ, z1: D - 0.5 });
      if (D - backZ > 3) props.push({ kind: 'dumpster', x: rng.range(2, W - 2), y: 0.05, z: backZ + 1.6, rot: 0, color: '#5a5f66' });
      const ctx: DetailContext = { rng, W, D, masses: units, facade, placer: new YardPlacer(rng, W, D, []), props, lights, details };
      addSplitACs(ctx, rng.int(4, 10), ['front', 'back', 'left', 'right']);
      info.shops = units.length;
      break;
    }
  }

  // Street trees (clear of drive aprons).
  const streetTreeXs: number[] = [];
  if (form !== 'bazaar') {
    for (let sx = rng.range(3, 6); sx < W - 2; sx += rng.range(9, 12)) {
      if (driveways.some((d) => d.z0 <= 0.1 && sx > d.x0 - 1.5 && sx < d.x1 + 1.5)) continue;
      streetTreeXs.push(sx);
    }
  }
  if (form === 'stripMall' || form === 'bigBox') {
    const free = [...masses.map((m) => m.rect), ...parkingLots.map((p) => p.rect), ...paths, ...driveways];
    placeTrees(rng, trees, free, { W, D }, { x0: 0.8, x1: W - 0.8, z0: 0.6, z1: D - 0.6 }, rng.int(2, 5), [['round', 3], ['shrub', 2]]);
  }

  if (shopKinds.length) {
    const counts = new Map<string, number>();
    for (const k of shopKinds) counts.set(SHOPS[k].label, (counts.get(SHOPS[k].label) ?? 0) + 1);
    info.shops = [...counts].map(([k, c]) => (c > 1 ? k + ' x' + c : k)).join(', ');
  }
  info.details = summarizeProps(props);
  info.lot = `${W.toFixed(1)} × ${D.toFixed(1)} m`;
  return {
    seed: spec.seed,
    style: form,
    lot: { width: W, depth: D },
    lawnColor,
    trimColor: '#5a5f66',
    foundationColor: '#8f8a83',
    pavingColor,
    masses,
    openings: facade.openings,
    porches,
    chimneys: [],
    driveways,
    paths,
    fences,
    trees,
    balconies,
    parkingLots,
    paved: form !== 'stripMall',
    props,
    lights,
    streetTreeXs,
    info,
  };
}
