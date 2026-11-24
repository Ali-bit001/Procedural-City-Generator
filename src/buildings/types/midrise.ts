/**
 * Mid-rise mixed-use grammar (3-10 floors): shops below, flats/offices above.
 *
 *   Lot        -> Building at the sidewalk + paved service yard behind
 *   Building   -> Ground floor (retail) + Upper block [+ recessed top floor] + Roof room
 *   Ground     -> Lobby door + Shops (shopfront | roller shutter) + Signs [+ awnings]
 *   Upper      -> Floors x Bays -> Window | Balcony door + Balcony   (+ sunshades, split ACs)
 *   Roof       -> Parapet + stair room + water tanks / water tower / AC units / solar / clotheslines
 *
 * Styles: southAsian (plaza blocks: projecting upper floors, slab bands, chajjas, balconies,
 * shutters, big signs, many tanks), mainStreet (brick, cornice, awnings), modern (ribbon /
 * curtain-wall glazing, glass balconies, recessed top floor).
 */
import { RNG } from '../../core/rng';
import { jitterHex } from '../../core/color';
import { MIDRISE_PALETTES, type MidriseStyle } from '../styles/palettes';
import { OpeningPlacer, wallOf } from '../facade/openings';
import {
  YardPlacer,
  addBackLight,
  addBins,
  addCar,
  addSatelliteDish,
  addSolarPanels,
  addSplitACs,
  addWindowShades,
  type DetailContext,
} from '../details/details';
import { placeTrees } from '../details/planting';
import { summarizeProps } from './house';
import {
  DEFAULT_DETAILS,
  massTop,
  rotFromNormal,
  type Balcony,
  type FireEscape,
  type DetailOptions,
  type Fence,
  type HouseModel,
  type Light,
  type Mass,
  type MassKind,
  type Opening,
  type Porch,
  type Prop,
  type Rect,
  type RoofSpec,
  type Tree,
  type WindowStyle,
} from '../spec';

export interface MidriseSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style?: MidriseStyle;
  details?: DetailOptions;
}

const FRONT = 0.3;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function generateMidrise(spec: MidriseSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const details = spec.details ?? DEFAULT_DETAILS;
  const style: MidriseStyle = spec.style ?? rng.weighted<MidriseStyle>([['southAsian', 40], ['mainStreet', 30], ['modern', 30]]);
  const pal = MIDRISE_PALETTES[style];
  const W = spec.lotWidth;
  const D = spec.lotDepth;
  const SA = style === 'southAsian';
  const MS = style === 'mainStreet';
  const MOD = style === 'modern';

  // ---------- global parameters ----------
  const side = MOD ? rng.range(1.2, 2.5) : SA && rng.chance(0.5) ? 0.8 : 0;
  const depth = clamp(rng.range(14, 22), 10, D - 6);
  const floorsTotal = SA ? rng.int(3, 7) : MS ? rng.int(3, 6) : rng.int(5, 10);
  const gh = MOD ? 4.6 : 4.2;
  const fh = MS ? 3.3 : 3.1;
  const plinth = 0.15;
  const proj = SA && rng.chance(0.7) ? rng.range(0.8, 1.2) : 0;

  const wallColor = jitterHex(rng.pick(pal.walls), rng, 0.04);
  const bandColor = rng.pick(pal.bands);
  const frameColor = rng.pick(pal.frames);
  const roofColor = rng.pick(pal.roofs);
  const pavingColor = jitterHex(rng.pick(pal.paving), rng, 0.03);

  const masses: Mass[] = [];
  const addMass = (kind: MassKind, rect: Rect, baseY: number, floors: number, floorHeight: number, roof: Partial<RoofSpec>, extra: Partial<Mass> = {}): Mass => {
    const m: Mass = {
      id: masses.length, kind, rect, baseY, floors, floorHeight, wallColor, plinth: false,
      roof: { type: 'flat', pitch: 0, axis: 'x', overhang: 0, gableOverhang: 0, highSide: 1, color: roofColor, parapet: true, ...roof },
      ...extra,
    };
    masses.push(m);
    return m;
  };

  // ---------- massing ----------
  const x0 = side;
  const x1 = W - side;
  const ground = addMass('main', { x0, x1, z0: FRONT + proj, z1: FRONT + depth }, plinth, 1, gh, { parapet: false });
  const upperFloors = floorsTotal - 1;
  const topSetback = MOD && upperFloors >= 5 && rng.chance(0.5);
  const upper = addMass('upper', { x0, x1, z0: FRONT, z1: FRONT + depth }, plinth + gh, topSetback ? upperFloors - 1 : upperFloors, fh,
    { parapet: !MOD || rng.chance(0.5), overhang: MOD ? 0.3 : 0 },
    { floorBands: SA || MS, cornice: MS ? rng.pick(['#efe6d2', '#3b3632', '#5a4a3f']) : undefined });
  let roofMass = upper;
  if (topSetback) {
    const accent = rng.pick(['#3b3e42', '#26282b', '#b4895e']);
    roofMass = addMass('upper', { x0: x0 + 0.5, x1: x1 - 0.5, z0: FRONT + rng.range(2.5, 3.5), z1: FRONT + depth - 0.5 }, massTop(upper), 1, fh,
      { parapet: false, overhang: 0.6, color: '#2f3236' }, { wallColor: accent });
  }
  // Stair / lift room on the roof, at a back corner.
  const rr = roofMass.rect;
  const roomLeft = rng.chance(0.5);
  const roomRect: Rect = roomLeft
    ? { x0: rr.x0 + 0.8, x1: rr.x0 + 4.0, z0: rr.z1 - 5.0, z1: rr.z1 - 0.8 }
    : { x0: rr.x1 - 4.0, x1: rr.x1 - 0.8, z0: rr.z1 - 5.0, z1: rr.z1 - 0.8 };
  const roofTop = massTop(roofMass) + (roofMass.roof.parapet ? 0.1 : 0.3);
  const room = addMass('roofRoom', roomRect, roofTop, 1, 2.8, { parapet: false, overhang: 0.25 });

  // ---------- ground floor: lobby + shops + signs ----------
  const facade = new OpeningPlacer(masses, rng);
  const lobbyW = 2.4;
  const lobbySide = rng.chance(0.5) ? -1 : 1;
  const shopX0 = lobbySide < 0 ? x0 + lobbyW : x0;
  const shopX1 = lobbySide < 0 ? x1 : x1 - lobbyW;
  const nShops = Math.max(1, Math.round((shopX1 - shopX0) / rng.range(4.5, 7)));
  const shopW = (shopX1 - shopX0) / nShops;
  const signChance = SA ? 0.95 : MS ? 0.7 : 0.35;
  const awnings = MS && rng.chance(0.55);
  const awningColor = rng.pick(pal.awnings);
  const shopTop = plinth + 0.05 + (SA ? gh - 1.55 : MS ? gh - 1.3 : gh - 1.0);
  const zf = ground.rect.z0;

  for (let i = 0; i < nShops; i++) {
    const cx = shopX0 + shopW * (i + 0.5);
    const shutter = SA && rng.chance(0.45);
    const shop = facade.add({
      kind: 'shopfront', massId: ground.id, wall: 'front', floor: 0, cx, cz: zf, nx: 0, nz: -1,
      width: shopW - 0.5, y0: plinth + 0.05, height: shopTop - plinth - 0.05,
      color: shutter ? rng.pick(pal.shutters) : frameColor, frameColor: MS ? rng.pick(pal.frames) : frameColor,
      mullions: false, style: shutter ? 'shutter' : 'shop', lit: rng.chance(0.8),
    });
    if (awnings) shop.shade = { kind: 'awning', color: awningColor };
    if (rng.chance(signChance)) {
      const signY = shopTop + (awnings ? 0.45 : 0.15);
      // Never taller than the space left under the first upper floor.
      const sh = Math.min(SA ? rng.range(0.85, 1.15) : MS ? 0.6 : 0.5, plinth + gh - 0.12 - signY);
      facade.add({
        kind: 'sign', massId: ground.id, wall: 'front', floor: 0, cx, cz: zf, nx: 0, nz: -1,
        width: SA ? shopW - 0.3 : shopW - 1.2, y0: signY, height: sh,
        color: rng.pick(pal.signs), frameColor: '#2b2b2b', mullions: false, lit: rng.chance(0.85),
      });
    }
  }
  const lobbyX = lobbySide < 0 ? x0 + lobbyW / 2 : x1 - lobbyW / 2;
  const lobbyDoor = facade.add({
    kind: 'door', massId: ground.id, wall: 'front', floor: 0, cx: lobbyX, cz: zf, nx: 0, nz: -1,
    width: 1.5, y0: plinth + 0.05, height: 2.7, color: MOD ? '#2b3a48' : rng.pick(['#3b3e42', '#6b4a33', '#2f3b2f']),
    frameColor, mullions: false, style: MOD ? 'glassPanel' : 'door', lit: true,
  });
  // Back service door + a couple of small windows.
  const gBack = wallOf(ground.rect, 'back');
  facade.add({ kind: 'door', massId: ground.id, wall: 'back', floor: 0, cx: (x0 + x1) / 2, cz: ground.rect.z1, nx: 0, nz: 1, width: 1.1, y0: plinth, height: 2.2, color: '#5a5f66', frameColor, mullions: false });
  facade.wallWindows(ground, gBack, { n: 3, bay: (x1 - x0) / 3, w: 1.0, h: 0.8, sill: 2.4, frame: frameColor, mullions: false, litChance: 0.3 });
  if (side >= 0.8) {
    for (const s of ['left', 'right'] as const) facade.wallWindows(ground, wallOf(ground.rect, s), { bay: 4, w: 1.0, h: 0.8, sill: 2.4, frame: frameColor, mullions: false, litChance: 0.3 });
  }

  // ---------- upper floors ----------
  const balconies: Balcony[] = [];
  const winStyle: WindowStyle = SA ? rng.pick(['casement', 'cross'] as WindowStyle[]) : MS ? rng.pick(['georgian', 'cross'] as WindowStyle[]) : 'ribbon';
  const bay = SA ? rng.range(3.0, 3.6) : MS ? rng.range(2.6, 3.2) : rng.range(3.2, 4.0);
  const win = SA ? { w: rng.range(1.3, 1.7), h: rng.range(1.4, 1.6), sill: 0.9 } : MS ? { w: rng.range(1.0, 1.2), h: rng.range(1.8, 2.0), sill: 0.8 } : { w: bay - rng.range(0.6, 1.0), h: rng.range(1.8, 2.0), sill: 0.6 };
  const curtainFront = MOD && rng.chance(0.4);
  const balconyRail: Balcony['rail'] = SA ? (rng.chance(0.6) ? 'iron' : 'solid') : 'glass';
  const wantsBalconies = (SA && rng.chance(0.6)) || (MOD && !curtainFront && rng.chance(0.45));
  const balconyPattern = rng.pick(['alternate', 'ends', 'all'] as const);
  const isBalconyBay = (i: number, n: number) =>
    wantsBalconies && (balconyPattern === 'all' ? true : balconyPattern === 'ends' ? i === 0 || i === n - 1 : i % 2 === 0);

  for (const m of masses.filter((mm) => mm.kind === 'upper')) {
    const isTop = m !== upper;
    for (const wl of [wallOf(m.rect, 'front'), wallOf(m.rect, 'back'), wallOf(m.rect, 'left'), wallOf(m.rect, 'right')]) {
      const isSide = wl.side === 'left' || wl.side === 'right';
      if (isSide && side < 0.8 && !isTop) continue; // party walls stay blank
      if (curtainFront && wl.side === 'front') {
        // One full-width glazed quad per floor.
        for (let f = 0; f < m.floors; f++) {
          facade.add({ kind: 'window', massId: m.id, wall: 'front', floor: f, cx: (wl.ax + wl.bx) / 2, cz: wl.az, nx: 0, nz: -1, width: wl.length - 0.4, y0: m.baseY + f * m.floorHeight, height: m.floorHeight, color: '#2b3a48', frameColor, mullions: false, style: 'curtain', lit: rng.chance(0.45) });
        }
        continue;
      }
      const n = Math.max(1, Math.floor(wl.length / (isSide ? bay * 1.4 : bay)));
      const placed = facade.wallWindows(m, wl, {
        n, bay: wl.length / n, w: Math.min(win.w, wl.length / n - 0.6), h: win.h, sill: win.sill, frame: frameColor, mullions: false, litChance: 0.45,
      });
      for (const o of placed) o.style = winStyle;

      // Balconies on the front: convert chosen bays into balcony doors.
      if (wl.side === 'front' && !isTop) {
        for (const o of placed) {
          const i = Math.floor(((o.cx - wl.ax) / wl.length) * n);
          if (!isBalconyBay(i, n)) continue;
          const floorY = m.baseY + o.floor * m.floorHeight;
          o.balcony = true;
          o.y0 = floorY + 0.05;
          o.height = Math.min(2.3, m.floorHeight - 0.5);
          o.width = Math.min(o.width, 1.5);
          o.style = SA ? 'casement' : 'glassPanel';
          balconies.push({
            cx: o.cx, cz: o.cz, nx: 0, nz: -1, width: o.width + 1.1, depth: SA ? 1.0 : 1.4, y: floorY,
            rail: balconyRail, color: SA ? bandColor : '#d6d6d2', railColor: SA ? '#2b2b2b' : '#9fb4bf',
          });
        }
      }
    }
  }
  // New York style fire escape across two window bays on the front of some main-street blocks.
  const fireEscapes: FireEscape[] = [];
  if (MS && upper.floors >= 2 && rng.chance(0.4)) {
    const wl = wallOf(upper.rect, 'front');
    const n = Math.max(1, Math.floor(wl.length / bay));
    const bw = wl.length / n;
    if (n >= 3) {
      // centred on a bay boundary away from the lobby side
      const k = lobbySide < 0 ? rng.int(Math.ceil(n / 2), n - 1) : rng.int(1, Math.max(1, Math.floor(n / 2)));
      const width = Math.min(2 * bw - 0.4, 5.5);
      fireEscapes.push({
        cx: wl.ax + k * bw, cz: wl.az, nx: 0, nz: -1, width, depth: 1.2,
        levels: Array.from({ length: upper.floors }, (_, f) => upper.baseY + f * upper.floorHeight),
        color: rng.pick(['#2b2b2b', '#3a2a22', '#2f4a3a']),
      });
    }
  }

  // Concrete sunshades over the windows (classic South Asian chajjas).
  if (SA && rng.chance(0.8)) addWindowShades(facade, [upper.id], 'slab', bandColor);

  // Roof room door, facing the front.
  facade.add({ kind: 'door', massId: room.id, wall: 'front', floor: 0, cx: (roomRect.x0 + roomRect.x1) / 2, cz: roomRect.z0, nx: 0, nz: -1, width: 1.0, y0: roofTop, height: 2.1, color: '#6f7a83', frameColor, mullions: false });

  // Projection soffit over the shops reads as a canopy; add one for flush styles too.
  const porches: Porch[] = [];
  if (!proj && !awnings && rng.chance(MOD ? 0.7 : 0.4)) {
    porches.push({ kind: 'canopy', rect: { x0, x1, z0: FRONT - 0.8, z1: FRONT }, floorY: 0, roofY: plinth + gh - 0.35, stepX: lobbyX, floorColor: pavingColor, roofColor: MOD ? '#2f3236' : bandColor, postColor: frameColor });
  }

  // ---------- details ----------
  const props: Prop[] = [];
  const lights: Light[] = [];
  const back: Rect = { x0: 0.6, x1: W - 0.6, z0: FRONT + depth + 0.6, z1: D - 0.6 };
  const obstacles: Rect[] = [...masses.filter((m) => m.kind !== 'roofRoom').map((m) => m.rect)];
  const placer = new YardPlacer(rng, W, D, obstacles);
  const ctx: DetailContext = { rng, W, D, masses, facade, placer, props, lights, details };

  // Split ACs everywhere on South Asian blocks; fewer elsewhere.
  addSplitACs(ctx, SA ? rng.int(3, 8) : MS ? rng.int(0, 2) : rng.int(0, 3), SA ? ['front', 'back', 'left', 'right'] : ['back', 'left', 'right']);
  addSatelliteDish({ ...ctx, masses: [room] }, room, SA ? 0.7 : 0.2);

  // Roof: placed on the roof slab, avoiding the stair room.
  const roofPlacer = new YardPlacer(rng, W, D, [{ ...roomRect }]);
  const roofRegion: Rect = { x0: rr.x0 + 0.6, x1: rr.x1 - 0.6, z0: rr.z0 + 0.6, z1: rr.z1 - 0.6 };
  const roofProp = (kind: Prop['kind'], w: number, d: number, extra: Partial<Prop> = {}, rots = [0]) => {
    const s = roofPlacer.place(roofRegion, w, d, rots, 0.3);
    if (s) props.push({ kind, x: s.x, y: roofTop, z: s.z, rot: s.rot, color: '#cfd2d4', ...extra });
    return s;
  };
  const tankColor = () => rng.pick(['#1e1f22', '#1e1f22', '#2a5fa8', '#e8e8e2', '#3f6fb0']);
  if (SA) {
    const n = Math.round(rng.int(2, 5) * Math.min(1, details.waterTanks * 2));
    for (let i = 0; i < n; i++) roofProp('waterTank', 1.6, 1.6, { color: tankColor(), w: rng.range(0.55, 0.75), h: rng.range(0.3, 0.9) });
    // More tanks on top of the stair room.
    if (rng.chance(details.waterTanks * 1.5)) {
      const cx = (roomRect.x0 + roomRect.x1) / 2;
      const cz = (roomRect.z0 + roomRect.z1) / 2;
      for (const dz of rng.chance(0.5) ? [-0.9, 0.9] : [0]) props.push({ kind: 'waterTank', x: cx, y: massTop(room) + 0.3, z: cz + dz, rot: 0, color: tankColor(), w: 0.6, h: 0.15 });
    }
    if (rng.chance(0.5 * details.props)) roofProp('clothesline', 4.6, 0.9, { color: '#9aa0a6' }, [0, Math.PI / 2]);
    // Rooftop telecom masts are a common sight on South Asian commercial blocks.
    if (rng.chance(0.18)) roofProp('cellTower', 2.6, 2.6, { color: '#b8bcc0', h: rng.range(8, 14) });
  } else if (MS) {
    if (rng.chance(0.35 * Math.max(details.waterTanks * 2, 0.5))) roofProp('waterTower', 4, 4, { color: '#7a5a3f', color2: '#3b3632', w: 1.6, h: 2.6 });
    for (let i = rng.int(2, 4); i > 0; i--) roofProp('acUnit', 1.2, 1.2, {}, [0, Math.PI]);
    if (rng.chance(0.25)) roofProp('antennaCluster', 2.8, 2.8, { color: '#8a8f96', h: rng.range(4, 7) });
  } else {
    for (let i = rng.int(3, 6); i > 0; i--) roofProp('acUnit', 1.2, 1.2, {}, [0, Math.PI]);
    addSolarPanels({ ...ctx, masses: [roofMass] }, 0.5);
    if (rng.chance(details.waterTanks)) roofProp('waterTank', 1.6, 1.6, { color: '#e8e8e2', w: 0.65, h: 0.4 });
  }

  // Service yard: parking, bins, a tree; walled off at the back.
  const parking = Math.max(0, Math.floor((back.x1 - back.x0) / 3.2) - 1);
  for (let i = 0; i < parking; i++) {
    if (!rng.chance(details.cars)) continue;
    const x = back.x0 + 1.6 + i * 3.2;
    if (back.z1 - back.z0 < 5.2) break;
    addCar({ ...ctx, details: { ...details, cars: 1 } }, { x0: x - 1.2, x1: x + 1.2, z0: back.z1 - 5, z1: back.z1 });
  }
  addBins(ctx, x1 - 1.2, FRONT + depth + 1.0, 0.8);
  const trees: Tree[] = [];
  if (rng.chance(0.4)) placeTrees(rng, trees, placer.obstacles, { W, D }, back, 1, [['round', 1]]);

  const fences: Fence[] = [{
    kind: 'privacy', color: SA ? '#b9b4aa' : MS ? '#8a4a3a' : '#3a3d40', height: 2.2,
    segments: [
      { x0: 0.2, z0: D - 0.2, x1: W - 0.2, z1: D - 0.2 },
      { x0: 0.2, z0: FRONT + depth, x1: 0.2, z1: D - 0.2 },
      { x0: W - 0.2, z0: FRONT + depth, x1: W - 0.2, z1: D - 0.2 },
    ],
  }];

  // ---------- lights ----------
  const lobbyRot = rotFromNormal(0, -1);
  for (const s of [-1, 1]) lights.push({ kind: 'sconce', x: lobbyX + s * 1.15, y: lobbyDoor.y0 + 2.4, z: zf, rot: lobbyRot });
  if (proj > 0) {
    // Soffit lights under the projecting upper floors.
    for (let i = 0; i < nShops; i++) lights.push({ kind: 'ceiling', x: shopX0 + shopW * (i + 0.5), y: plinth + gh - 0.02, z: FRONT + proj / 2, rot: 0 });
  }
  addBackLight({ ...ctx, masses: [ground] }, ground, 0.8);

  // Street trees every ~10 m.
  const streetTreeXs: number[] = [];
  for (let sx = rng.range(3, 6); sx < W - 2; sx += rng.range(9, 11)) streetTreeXs.push(sx);

  const paths: Rect[] = [];
  const openings: Opening[] = facade.openings;
  return {
    seed: spec.seed,
    style,
    lot: { width: W, depth: D },
    lawnColor: pavingColor,
    trimColor: bandColor,
    foundationColor: '#8f8a83',
    pavingColor,
    masses,
    openings,
    porches,
    chimneys: [],
    driveways: [],
    paths,
    fences,
    trees,
    balconies,
    fireEscapes,
    paved: true,
    props,
    lights,
    streetTreeXs,
    info: {
      type: 'mid-rise mixed-use',
      style,
      floors: floorsTotal,
      shops: nShops,
      facade: curtainFront ? 'curtain wall' : winStyle,
      balconies: balconies.length,
      roof: summarizeProps(props.filter((p) => p.y > 1)),
      lot: `${W.toFixed(1)} × ${D.toFixed(1)} m`,
    },
  };
}
