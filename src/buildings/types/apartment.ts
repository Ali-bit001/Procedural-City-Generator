/**
 * Apartment block grammar (4-24 floors).
 *
 *   Lot       -> Form + site (lawns, paths, parking, playground, trees, lamps)
 *   Form      -> slab | point tower | L-block | courtyard (perimeter block, optional gateway arch)
 *   Wing      -> Mass (flat roof + stair rooms, or a pitched roof for brick blocks)
 *   Facade    -> Floors x Bays -> Window | Entrance door (+ canopy) | Balcony door + Balcony
 *   Balconies -> pattern (stacked columns | checkerboard | ends | all) x kind (loggia | glass | iron | French)
 *   Life      -> split ACs, satellite dishes, laundry on balconies, rooftop tanks / antennas / solar
 *
 * Styles: panel (prefab blocks with pastel loggias), modern, southAsian, brick.
 */
import { RNG } from '../../core/rng';
import { jitterHex } from '../../core/color';
import { APARTMENT_PALETTES, type ApartmentStyle } from '../styles/palettes';
import { OpeningPlacer, wallOf, wallsOf } from '../facade/openings';
import {
  YardPlacer,
  rectsOverlap,
  addSatelliteDish,
  addSolarPanels,
  addSplitACs,
  addWindowShades,
  addYardProps,
  type DetailContext,
} from '../details/details';
import { placeTrees } from '../details/planting';
import { summarizeProps } from './house';
import {
  DEFAULT_DETAILS,
  massTop,
  rotFromNormal,
  stairRun,
  type Balcony,
  type Blocker,
  type DetailOptions,
  type FireEscape,
  type Pipe,
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
  type WallSide,
  type WindowStyle,
} from '../spec';

export type ApartmentForm = 'slab' | 'tower' | 'lBlock' | 'courtyard';

export interface ApartmentSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style?: ApartmentStyle;
  form?: ApartmentForm;
  details?: DetailOptions;
}

type Pattern = 'stacked' | 'checker' | 'ends' | 'all';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function generateApartment(spec: ApartmentSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const details = spec.details ?? DEFAULT_DETAILS;
  const W = spec.lotWidth;
  const D = spec.lotDepth;
  const style: ApartmentStyle = spec.style ?? rng.weighted<ApartmentStyle>([['panel', 25], ['modern', 25], ['southAsian', 30], ['brick', 20]]);
  const canCourt = W >= 34 && D >= 34;
  let form: ApartmentForm = spec.form ?? rng.weighted<ApartmentForm>([['slab', 35], ['tower', 20], ['lBlock', 20], ['courtyard', canCourt ? 25 : 0]]);
  if (form === 'courtyard' && !canCourt) form = 'slab';
  const pal = APARTMENT_PALETTES[style];
  const PANEL = style === 'panel';
  const MOD = style === 'modern';
  const SA = style === 'southAsian';
  const BRICK = style === 'brick';

  // ---------- global parameters ----------
  const fh = rng.range(2.9, 3.1);
  const plinth = MOD ? 0.15 : rng.range(0.4, 0.8);
  const floors =
    form === 'tower' ? rng.int(12, 24) : form === 'courtyard' || BRICK ? rng.int(4, 7) : PANEL ? rng.pick([5, 5, 9, 9, 12]) : rng.int(5, 10);
  const wallColor = jitterHex(rng.pick(pal.walls), rng, 0.03);
  const frame = rng.pick(pal.frames);
  const roofColor = rng.pick(pal.roofs);
  const band = rng.pick(pal.bands);
  const lawnColor = jitterHex('#7fae55', rng, 0.06);
  const pavingColor = jitterHex('#bdb8ae', rng, 0.04);
  const doorColor = MOD ? '#2b3a48' : rng.pick(['#5a3a2a', '#3b3e42', '#6b2e2a', '#2f4a3a', '#8a8f96']);
  const pitched = BRICK && form !== 'tower' && rng.chance(0.5);
  const pitch = rng.range(0.6, 0.8);

  const masses: Mass[] = [];
  const add = (kind: MassKind, rect: Rect, roof: Partial<RoofSpec> = {}, extra: Partial<Mass> = {}): Mass => {
    const m: Mass = {
      id: masses.length, kind, rect, baseY: plinth, floors, floorHeight: fh, wallColor, plinth: true,
      floorBands: PANEL || SA,
      roof: { type: 'flat', pitch, axis: 'x', overhang: 0, gableOverhang: 0.3, highSide: 1, color: roofColor, parapet: true, ...roof },
      ...extra,
    };
    masses.push(m);
    return m;
  };
  const gable = (axis: 'x' | 'z'): Partial<RoofSpec> => (pitched ? { type: 'gable', axis, overhang: 0.4, parapet: false } : {});

  // ---------- form ----------
  let d = rng.range(11, 14);
  let setback = rng.range(5, 9);
  const streetMasses: Mass[] = [];
  const balconyWalls: { m: Mass; side: WallSide }[] = [];
  let garden: Rect | undefined; // open area for playground / trees
  switch (form) {
    case 'slab': {
      d = Math.min(d, D - setback - 7);
      const L = Math.min(W - 8, rng.range(30, 64));
      const x0 = (W - L) / 2;
      const m = add('main', { x0, x1: x0 + L, z0: setback, z1: setback + d }, gable('x'));
      streetMasses.push(m);
      balconyWalls.push({ m, side: 'front' }, { m, side: 'back' });
      break;
    }
    case 'tower': {
      setback = rng.range(6, 10);
      const s = Math.min(rng.range(18, 26), W - 10, D - setback - 9);
      const x0 = (W - s) / 2;
      const m = add('main', { x0, x1: x0 + s, z0: setback, z1: setback + s });
      streetMasses.push(m);
      for (const side of ['front', 'back', 'left', 'right'] as const) balconyWalls.push({ m, side });
      break;
    }
    case 'lBlock': {
      d = Math.min(d, (D - setback - 7) / 2);
      const L = Math.min(W - 8, rng.range(30, 56));
      const x0 = (W - L) / 2;
      const front = add('main', { x0, x1: x0 + L, z0: setback, z1: setback + d }, gable('x'));
      const right = rng.chance(0.5);
      const len = clamp(rng.range(18, 30), d + 6, D - setback - 7);
      const wx0 = right ? x0 + L - d : x0;
      // Pitched wings overlap to the main ridge so the gable end hides inside the main roof.
      const wing = add('wing', { x0: wx0, x1: wx0 + d, z0: setback + (pitched ? d / 2 : d), z1: setback + len }, gable('z'));
      streetMasses.push(front);
      balconyWalls.push({ m: front, side: 'front' }, { m: front, side: 'back' }, { m: wing, side: right ? 'left' : 'right' });
      garden = right ? { x0: x0 + 1, x1: wx0 - 2, z0: setback + d + 2, z1: D - 2 } : { x0: wx0 + d + 2, x1: x0 + L - 1, z0: setback + d + 2, z1: D - 2 };
      break;
    }
    case 'courtyard': {
      setback = rng.range(0.6, 1.8);
      const ox0 = 1;
      const ox1 = W - 1;
      const oz1 = D - 1.5;
      d = Math.min(d, (ox1 - ox0 - 12) / 2, (oz1 - setback - 12) / 2);
      const gate = ox1 - ox0 > 30 && rng.chance(0.5);
      const gc = (ox0 + ox1) / 2;
      const fronts: Mass[] = [];
      if (gate) {
        fronts.push(add('main', { x0: ox0, x1: gc - 2.25, z0: setback, z1: setback + d }, gable('x')));
        fronts.push(add('main', { x0: gc + 2.25, x1: ox1, z0: setback, z1: setback + d }, gable('x')));
        // Bridge over the gateway, from the first floor up.
        add('upper', { x0: gc - 2.25, x1: gc + 2.25, z0: setback, z1: setback + d }, gable('x'), { baseY: plinth + fh, floors: floors - 1, plinth: false });
      } else {
        fronts.push(add('main', { x0: ox0, x1: ox1, z0: setback, z1: setback + d }, gable('x')));
      }
      const back = add('wing', { x0: ox0, x1: ox1, z0: oz1 - d, z1: oz1 }, gable('x'));
      const sz0 = pitched ? setback + d / 2 : setback + d;
      const sz1 = pitched ? oz1 - d / 2 : oz1 - d;
      const left = add('wing', { x0: ox0, x1: ox0 + d, z0: sz0, z1: sz1 }, gable('z'));
      const rightW = add('wing', { x0: ox1 - d, x1: ox1, z0: sz0, z1: sz1 }, gable('z'));
      streetMasses.push(...fronts);
      for (const f of fronts) balconyWalls.push({ m: f, side: 'back' });
      balconyWalls.push({ m: back, side: 'front' }, { m: left, side: 'right' }, { m: rightW, side: 'left' });
      garden = { x0: ox0 + d + 1, x1: ox1 - d - 1, z0: setback + d + 1, z1: oz1 - d - 1 };
      break;
    }
  }

  // ---------- windows ----------
  const facade = new OpeningPlacer(masses, rng);
  const win =
    PANEL ? { w: rng.range(1.4, 1.6), h: 1.4, sill: 0.85, bay: rng.range(3.0, 3.3) }
      : MOD ? (() => { const w = rng.range(1.8, 2.4); return { w, h: rng.range(1.9, 2.1), sill: 0.4, bay: w + rng.range(1.0, 1.4) }; })()
        : SA ? { w: rng.range(1.2, 1.6), h: 1.4, sill: 0.9, bay: rng.range(3.0, 3.6) }
          : { w: rng.range(1.1, 1.3), h: 1.8, sill: 0.8, bay: rng.range(2.6, 3.0) };
  win.h = Math.min(win.h, fh - win.sill - 0.3);
  const winStyle: WindowStyle = PANEL ? 'casement' : MOD ? 'plain' : SA ? rng.pick(['casement', 'cross'] as WindowStyle[]) : rng.pick(['georgian', 'cross'] as WindowStyle[]);

  // ---------- external lift shaft / stair tower ----------
  // Added before the windows, so windows behind them are never placed (the occlusion test sees them).
  const building = masses.filter((m) => m.kind === 'main' || m.kind === 'wing');
  const courtSide = new Map(balconyWalls.map((bw) => [bw.m, bw.side]));
  const attach = (kind: 'shaft' | 'stairTower') => {
    const sw = kind === 'shaft' ? 2.4 : 3.2; // along the wall
    const sd = kind === 'shaft' ? 2.4 : 3.6; // out from the wall
    for (let attempt = 0; attempt < 10; attempt++) {
      const host = rng.pick(building);
      const side: WallSide = form === 'courtyard' ? courtSide.get(host) ?? 'back' : rng.pick(['back', 'left', 'right'] as WallSide[]);
      const wl = wallOf(host.rect, side);
      if (wl.length < sw + 2) continue;
      // Sit on a bay boundary, between two window columns.
      const nb = Math.max(1, Math.floor(wl.length / win.bay));
      const t = nb > 1 ? rng.int(1, nb - 1) * (wl.length / nb) : wl.length / 2;
      const px = wl.ax + ((wl.bx - wl.ax) * t) / wl.length;
      const pz = wl.az + ((wl.bz - wl.az) * t) / wl.length;
      const rect: Rect =
        wl.nz !== 0
          ? { x0: px - sw / 2, x1: px + sw / 2, z0: wl.nz < 0 ? pz - sd : pz, z1: wl.nz < 0 ? pz : pz + sd }
          : { x0: wl.nx < 0 ? px - sd : px, x1: wl.nx < 0 ? px : px + sd, z0: pz - sw / 2, z1: pz + sw / 2 };
      if (rect.x0 < 0.5 || rect.x1 > W - 0.5 || rect.z0 < 0.5 || rect.z1 > D - 0.5) continue;
      if (masses.some((o) => o !== host && rectsOverlap(o.rect, rect, 0.05))) continue;
      const top = massTop(host) + 2.8;
      return add(kind, rect, { parapet: false, overhang: 0.15, color: roofColor }, {
        baseY: 0.05, floors: host.floors + 1, floorHeight: (top - 0.05) / (host.floors + 1), plinth: false, floorBands: false,
        wallColor: kind === 'shaft' ? '#6f7a83' : MOD ? rng.pick(['#3b3e42', wallColor]) : jitterHex(wallColor, rng, 0.05),
      });
    }
    return undefined;
  };
  if ((PANEL && rng.chance(0.35)) || (BRICK && !pitched && rng.chance(0.2)) || (SA && rng.chance(0.15))) attach('shaft');
  if ((MOD && rng.chance(0.4)) || (SA && rng.chance(0.25)) || (form === 'tower' && rng.chance(0.4))) attach('stairTower');

  for (const m of masses) {
    if (m.kind === 'shaft' || m.kind === 'stairTower') {
      // Glass lift shaft: one glazed quad per floor per face. Stair tower: slit windows at the half-landings.
      for (const wl of wallsOf(m.rect)) {
        for (let f = 0; f < m.floors; f++) {
          const y0 = m.baseY + f * m.floorHeight;
          const cx = (wl.ax + wl.bx) / 2;
          const cz = (wl.az + wl.bz) / 2;
          if (m.kind === 'shaft') {
            if (!facade.visible(wl, cx, cz, wl.length - 0.3, y0 + m.floorHeight / 2, m.id, 0)) continue;
            facade.add({ kind: 'window', massId: m.id, wall: wl.side, floor: f, cx, cz, nx: wl.nx, nz: wl.nz, width: wl.length - 0.2, y0, height: m.floorHeight, color: '#2b3a48', frameColor: '#9aa0a6', mullions: false, style: 'curtain', lit: f < m.floors - 1 && rng.chance(0.5) });
          } else if (f < m.floors - 1) {
            const sy = y0 + m.floorHeight * 0.5 + 0.1;
            if (!facade.visible(wl, cx, cz, 0.7, sy + 0.7, m.id, 0)) continue;
            facade.add({ kind: 'window', massId: m.id, wall: wl.side, floor: f, cx, cz, nx: wl.nx, nz: wl.nz, width: 0.7, y0: sy, height: 1.4, color: '#2b3a48', frameColor: frame, mullions: false, style: 'plain', noSill: true, lit: rng.chance(0.85) });
          }
        }
      }
      continue;
    }
    for (const wl of wallsOf(m.rect)) {
      if (wl.length < 2) continue;
      const placed = facade.wallWindows(m, wl, { bay: win.bay, w: win.w, h: win.h, sill: win.sill, frame, mullions: false, litChance: 0.45 });
      for (const o of placed) {
        o.style = winStyle;
        o.noSill = PANEL || MOD; // flush prefab / modern facades have no sills
      }
    }
  }

  // ---------- entrances ----------
  const doors: { m: Mass; door: Opening }[] = [];
  const porches: Porch[] = [];
  for (const m of streetMasses) {
    const L = m.rect.x1 - m.rect.x0;
    const cores = form === 'tower' ? 1 : Math.max(1, Math.round(L / rng.range(14, 20)));
    for (let k = 0; k < cores; k++) {
      const target = m.rect.x0 + ((k + 0.5) * L) / cores;
      const slots = facade.openings.filter((o) => o.massId === m.id && o.wall === 'front' && o.floor === 0 && o.kind === 'window');
      if (!slots.length) continue;
      const slot = slots.reduce((a, b) => (Math.abs(b.cx - target) < Math.abs(a.cx - target) ? b : a));
      if (Math.abs(slot.cx - target) > win.bay) continue;
      const door = facade.toDoor(slot, 1.3, m.baseY, 2.3, doorColor);
      if (MOD) door.style = 'glassPanel';
      door.lit = true;
      doors.push({ m, door });
      porches.push(
        BRICK
          ? { kind: 'hood', rect: { x0: door.cx - 0.9, x1: door.cx + 0.9, z0: m.rect.z0 - 1.0, z1: m.rect.z0 }, floorY: plinth, roofY: plinth + 2.45, stepX: door.cx, floorColor: '#b9b4aa', roofColor: band, postColor: frame }
          : { kind: 'canopy', rect: { x0: door.cx - 1.4, x1: door.cx + 1.4, z0: m.rect.z0 - 1.5, z1: m.rect.z0 }, floorY: plinth, roofY: plinth + 2.65, stepX: door.cx, floorColor: '#b9b4aa', roofColor: MOD ? '#2f3236' : band, postColor: frame },
      );
    }
  }

  // ---------- balconies ----------
  const balconies: Balcony[] = [];
  const props: Prop[] = [];
  const pattern: Pattern = PANEL ? 'stacked' : MOD ? 'checker' : SA ? rng.pick(['checker', 'stacked', 'all'] as Pattern[]) : 'stacked';
  const every = rng.pick([2, 3]);
  const offset = rng.int(0, every - 1);
  const wantsBalconies = !(BRICK && rng.chance(0.4));
  const depth = PANEL ? 1.2 : MOD ? 1.6 : SA ? 1.0 : 0.35;
  const rail: Balcony['rail'] = PANEL ? 'solid' : MOD ? 'glass' : SA ? (rng.chance(0.6) ? 'iron' : 'solid') : 'iron';
  const laundryChance = SA ? 0.35 : PANEL ? 0.12 : 0;
  const isBalcony = (i: number, f: number, n: number) =>
    pattern === 'all' ? true : pattern === 'ends' ? i === 0 || i === n - 1 : pattern === 'checker' ? (i + f) % 2 === 0 : i % every === offset;
  if (wantsBalconies) {
    for (const { m, side } of balconyWalls) {
      const wl = wallOf(m.rect, side);
      const n = Math.max(1, Math.floor(wl.length / win.bay));
      const ws = facade.openings.filter((o) => o.massId === m.id && o.wall === side && o.kind === 'window' && o.floor >= (m.baseY > plinth + 0.1 ? 0 : 1) && o.height > 1);
      for (const o of ws) {
        const t = Math.hypot(o.cx - wl.ax, o.cz - wl.az);
        const i = clamp(Math.floor((t / wl.length) * n), 0, n - 1);
        const f = o.floor + Math.round((m.baseY - plinth) / fh);
        if (!isBalcony(i, f, n)) continue;
        const floorY = m.baseY + o.floor * m.floorHeight;
        // Never run a balcony into a lift shaft / stair tower / other wing next to it.
        const span = Math.min(win.bay - 0.3, o.width + 1.6) / 2 + 0.15;
        const tx = o.nz !== 0 ? 1 : 0;
        const tz = o.nz !== 0 ? 0 : 1;
        const hits = [-1, 1].some((s2) => {
          const px = o.cx + tx * span * s2 + o.nx * depth * 0.5;
          const pz = o.cz + tz * span * s2 + o.nz * depth * 0.5;
          return masses.some((om) => om !== m && px > om.rect.x0 && px < om.rect.x1 && pz > om.rect.z0 && pz < om.rect.z1 && floorY + 0.5 > om.baseY && floorY + 0.5 < massTop(om));
        });
        if (hits) continue;
        o.balcony = true;
        o.y0 = floorY + 0.05;
        o.height = Math.min(2.3, m.floorHeight - 0.5);
        if (BRICK) {
          o.width = Math.min(o.width, 1.2); // French window
        } else {
          o.width = Math.min(o.width, 1.5);
          o.style = MOD ? 'glassPanel' : 'casement';
        }
        const width = BRICK ? o.width + 0.4 : Math.min(win.bay - 0.3, o.width + (PANEL ? 1.6 : 1.1));
        // Panel loggias get a colour per column; everything else matches the band / glass.
        const colour = PANEL ? pal.accents[(i * 7 + m.id * 3) % pal.accents.length] : MOD ? '#d6d6d2' : SA ? band : '#d8cfb8';
        balconies.push({ cx: o.cx, cz: o.cz, nx: o.nx, nz: o.nz, width, depth, y: floorY, rail, color: colour, railColor: rail === 'glass' ? '#9fb4bf' : rail === 'iron' ? '#2b2b2b' : colour });
        if (rng.chance(laundryChance)) {
          props.push({ kind: 'laundry', x: o.cx + o.nx * depth, y: floorY + 1.0, z: o.cz + o.nz * depth, rot: rotFromNormal(o.nx, o.nz), color: '#ffffff', w: width * 0.8 });
        }
      }
    }
  }
  if (SA && rng.chance(0.8)) addWindowShades(facade, masses.map((m) => m.id), 'slab', band);

  // Helpers for wall-mounted services.
  const blockers: Blocker[] = [];
  const outside = (x: number, y: number, z: number) => !masses.some((om) => x > om.rect.x0 && x < om.rect.x1 && z > om.rect.z0 && z < om.rect.z1 && y > om.baseY - 0.2 && y < massTop(om) + 0.6);
  const nearBalcony = (wl: ReturnType<typeof wallOf>, t: number, pad: number) =>
    balconies.some((bl) => bl.nx === wl.nx && bl.nz === wl.nz && Math.abs(wl.nz !== 0 ? bl.cz - wl.az : bl.cx - wl.ax) < 0.05 && Math.abs((wl.nz !== 0 ? bl.cx - wl.ax : bl.cz - wl.az) - t) < bl.width / 2 + pad);

  // ---------- fire escapes (steel, on an end wall) ----------
  const fireEscapes: FireEscape[] = [];
  if (form !== 'tower' && ((BRICK && rng.chance(0.5)) || (PANEL && rng.chance(0.15)) || (SA && rng.chance(0.2)))) {
    const feColor = rng.pick(['#2b2b2b', '#3a2a22', '#2f4a3a']);
    const cands = building.flatMap((m) => (['left', 'right'] as WallSide[]).map((side) => ({ m, wl: wallOf(m.rect, side) })));
    for (const { m, wl } of cands.sort(() => rng.next() - 0.5)) {
      const width = 3.6;
      const depth = 1.2;
      if (wl.length < width + 1.5) continue;
      const t = wl.length / 2;
      const cx = wl.ax + ((wl.bx - wl.ax) * t) / wl.length;
      const cz = wl.az + ((wl.bz - wl.az) * t) / wl.length;
      const midY = m.baseY + m.floorHeight * 1.5;
      // exterior wall, room in the lot, nothing else there
      const ftx = wl.nz !== 0 ? 1 : 0;
      const ftz = wl.nz !== 0 ? 0 : 1;
      if (![-1, 0, 1].every((k) => outside(cx + ftx * k * (width / 2 + 0.2) + wl.nx * depth * 0.6, midY, cz + ftz * k * (width / 2 + 0.2) + wl.nz * depth * 0.6))) continue;
      const ox = cx + wl.nx * (depth + 0.3);
      const oz = cz + wl.nz * (depth + 0.3);
      if (ox < 0.3 || ox > W - 0.3 || oz < 0.3 || oz > D - 0.3) continue;
      if (nearBalcony(wl, t, width / 2 + 0.3)) continue;
      const levels = Array.from({ length: m.floors - 1 }, (_, k) => m.baseY + (k + 1) * m.floorHeight);
      fireEscapes.push({ cx, cz, nx: wl.nx, nz: wl.nz, width, depth, levels, color: feColor });
      const tx = wl.nz !== 0 ? 1 : 0;
      const tz = wl.nz !== 0 ? 0 : 1;
      const xs = [cx - tx * (width / 2 + 0.3), cx + tx * (width / 2 + 0.3), cx + wl.nx * (depth + 0.3)];
      const zs = [cz - tz * (width / 2 + 0.3), cz + tz * (width / 2 + 0.3), cz + wl.nz * (depth + 0.3)];
      blockers.push({ x0: Math.min(...xs, cx), x1: Math.max(...xs, cx), z0: Math.min(...zs, cz), z1: Math.max(...zs, cz), y0: levels[0] - 2.6, y1: massTop(m) + 1 });
      if (form !== 'courtyard' || fireEscapes.length >= 2) break;
    }
  }

  // ---------- pipes (drainpipes / plumbing stacks) ----------
  const pipes: Pipe[] = [];
  const pipeColor = SA ? rng.pick(['#9aa0a6', '#e9e9e4', '#3b3e42']) : BRICK ? '#3b3e42' : PANEL ? '#8a8f96' : '#5a5d61';
  let pipeCount = SA ? rng.int(3, 7) : PANEL ? rng.int(2, 4) : BRICK ? rng.int(2, 4) : rng.int(0, 1);
  const branchy = SA || (PANEL && rng.chance(0.3));
  const pipeCands: { m: Mass; wl: ReturnType<typeof wallOf>; t: number }[] = [];
  for (const m of building) {
    const sides: WallSide[] = SA ? ['back', 'left', 'right', 'front'] : ['back', 'left', 'right'];
    for (const side of sides) {
      const wl = wallOf(m.rect, side);
      if (wl.length < 2) continue;
      const ts = [0.35, wl.length - 0.35];
      if (SA && side !== 'front') {
        const nb = Math.max(1, Math.floor(wl.length / win.bay));
        for (let k = 1; k < nb; k++) ts.push((k * wl.length) / nb);
      }
      for (const t of ts) pipeCands.push({ m, wl, t });
    }
  }
  for (const { m, wl, t } of pipeCands.sort(() => rng.next() - 0.5)) {
    if (pipeCount <= 0) break;
    const x = wl.ax + ((wl.bx - wl.ax) * t) / wl.length;
    const z = wl.az + ((wl.bz - wl.az) * t) / wl.length;
    const y1 = pitched ? massTop(m) - 0.1 : massTop(m) + 0.5;
    // Clear of other wings / shafts, balconies, entrances, fire escapes and other pipes.
    if (![0.25, 0.5, 0.85].every((f) => outside(x + wl.nx * 0.3, m.baseY + (y1 - m.baseY) * f, z + wl.nz * 0.3))) continue;
    if (nearBalcony(wl, t, 0.25)) continue;
    if (wl.side === 'front' && doors.some(({ door }) => Math.hypot(door.cx - x, door.cz - z) < 2.2)) continue;
    if (blockers.some((bk) => x + wl.nx * 0.2 > bk.x0 && x + wl.nx * 0.2 < bk.x1 && z + wl.nz * 0.2 > bk.z0 && z + wl.nz * 0.2 < bk.z1)) continue;
    if (pipes.some((p) => Math.hypot(p.x - x, p.z - z) < 1.0)) continue;
    const branches = branchy ? Array.from({ length: m.floors }, (_, f) => m.baseY + f * m.floorHeight + 0.35) : [];
    pipes.push({ x, z, nx: wl.nx, nz: wl.nz, y0: 0, y1, color: pipeColor, branches });
    blockers.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4, y0: 0, y1: y1 + 0.5 });
    pipeCount--;
  }

  // ---------- roof: stair rooms + equipment ----------
  const roofMasses = masses.filter((m) => m.roof.type === 'flat' && (m.kind === 'main' || m.kind === 'wing' || m.kind === 'upper'));
  if (!pitched) {
    for (const { m, door } of doors) {
      const top = massTop(m) + 0.1;
      const rx0 = clamp(door.cx - 1.6, m.rect.x0 + 0.5, m.rect.x1 - 3.7);
      add('roofRoom', { x0: rx0, x1: rx0 + 3.2, z0: m.rect.z1 - 4.8, z1: m.rect.z1 - 0.8 }, { parapet: false, overhang: 0.2 }, { baseY: top, floors: 1, floorHeight: 2.8, plinth: false, floorBands: false });
    }
  }
  const rooms = masses.filter((m) => m.kind === 'roofRoom');
  const tankColor = () => rng.pick(['#1e1f22', '#1e1f22', '#2a5fa8', '#e8e8e2']);
  for (const m of roofMasses) {
    if (m.kind === 'upper') continue;
    const top = massTop(m) + 0.1;
    const rp = new YardPlacer(rng, W, D, rooms.map((r) => r.rect));
    const region: Rect = { x0: m.rect.x0 + 0.7, x1: m.rect.x1 - 0.7, z0: m.rect.z0 + 0.7, z1: m.rect.z1 - 0.7 };
    const put = (kind: Prop['kind'], w: number, dd: number, extra: Partial<Prop>) => {
      const s = rp.place(region, w, dd, [0, Math.PI / 2], 0.3);
      if (s) props.push({ kind, x: s.x, y: top, z: s.z, rot: s.rot, color: '#cfd2d4', ...extra });
    };
    const scale = (m.rect.x1 - m.rect.x0) / 15;
    if (SA) {
      for (let i = Math.round(rng.range(1.5, 3) * scale * Math.min(1, details.waterTanks * 2)); i > 0; i--) put('waterTank', 1.6, 1.6, { color: tankColor(), w: rng.range(0.55, 0.75), h: rng.range(0.3, 0.9) });
      if (rng.chance(0.4 * details.props)) put('clothesline', 4.6, 0.9, { color: '#9aa0a6' });
      if (rng.chance(0.1)) put('cellTower', 2.6, 2.6, { color: '#b8bcc0', h: rng.range(8, 14) });
    } else if (PANEL) {
      if (rng.chance(0.5)) put('antennaCluster', 2.6, 2.6, { color: '#8a8f96', h: rng.range(3, 5) });
    } else if (MOD) {
      for (let i = rng.int(1, 3); i > 0; i--) put('acUnit', 1.2, 1.2, {});
    }
  }
  const ctxBase = { rng, W, D, facade, props, details };
  const lights: Light[] = [];
  // All masses, so panels never overlap the stair rooms.
  if (MOD) addSolarPanels({ ...ctxBase, masses, placer: new YardPlacer(rng, W, D, []), lights }, 0.4);

  // ---------- site ----------
  const paths: Rect[] = [];
  for (const p of porches) {
    const run = stairRun(p.floorY);
    paths.push({ x0: p.stepX - 0.9, x1: p.stepX + 0.9, z0: 0, z1: Math.max(0.1, p.rect.z0 - run) });
  }
  const driveways: Rect[] = [];
  const houseBack = Math.max(...masses.map((m) => m.rect.z1));
  if (form !== 'courtyard' && D - houseBack >= 9) {
    // Parking strip at the back, reached by a lane along one side when there's room.
    const pk: Rect = { x0: 2, x1: W - 2, z0: D - 6.5, z1: D - 1 };
    driveways.push(pk);
    const bx0 = Math.min(...masses.map((m) => m.rect.x0));
    const bx1 = Math.max(...masses.map((m) => m.rect.x1));
    if (W - bx1 >= 5) driveways.push({ x0: W - 4.2, x1: W - 1.2, z0: 0, z1: pk.z0 });
    else if (bx0 >= 5) driveways.push({ x0: 1.2, x1: 4.2, z0: 0, z1: pk.z0 });
    for (let x = 3.6; x < W - 3.6; x += 2.8) {
      if (!rng.chance(details.cars)) continue;
      props.push({ kind: 'car', x, y: 0.05, z: (pk.z0 + pk.z1) / 2, rot: rng.chance(0.5) ? 0 : Math.PI, color: rng.pick(['#f2f2f0', '#c9ccd1', '#1e1f22', '#8e1c1c', '#1f3f73', '#5a5f66', '#2d4f3c']) });
    }
  }

  const obstacles: Rect[] = [...masses.map((m) => m.rect), ...paths, ...driveways, ...porches.map((p) => ({ ...p.rect, z0: p.rect.z0 - stairRun(p.floorY) }))];
  for (const p of props) if (p.kind === 'car') obstacles.push({ x0: p.x - 1, x1: p.x + 1, z0: p.z - 2.3, z1: p.z + 2.3 });
  const placer = new YardPlacer(rng, W, D, obstacles);
  const ctx: DetailContext = { ...ctxBase, masses: building, placer, lights, blockers };

  // Life on the facades.
  addSplitACs(ctx, SA ? rng.int(6, 14) : PANEL ? rng.int(3, 8) : MOD ? rng.int(0, 3) : rng.int(0, 2), ['front', 'back', 'left', 'right']);
  if (PANEL || SA) for (let i = rng.int(1, 4); i > 0; i--) addSatelliteDish(ctx, rng.pick(ctx.masses), 1);

  // Playground + trees.
  const playRegion = garden ?? (D - houseBack > 14 ? { x0: 2, x1: W - 2, z0: houseBack + 2, z1: (driveways[0]?.z0 ?? D) - 1.5 } : setback > 8 ? { x0: 2, x1: W - 2, z0: 1.5, z1: setback - 2 } : undefined);
  if (playRegion && playRegion.x1 - playRegion.x0 > 6 && playRegion.z1 - playRegion.z0 > 4) {
    addYardProps(ctx, playRegion, { swing: 0.7, slide: 0.6, bench: 0.9, gardenBed: 0.4, trampoline: 0.1, patioSet: 0.15 }, 4);
  }
  const trees: Tree[] = [];
  if (garden) placeTrees(rng, trees, placer.obstacles, { W, D }, garden, rng.int(2, 5), [['round', 4], ['cone', 1]]);
  if (setback > 3) placeTrees(rng, trees, placer.obstacles, { W, D }, { x0: 1, x1: W - 1, z0: 1, z1: setback - 1 }, rng.int(1, 4), [['round', 3], ['shrub', 2]]);
  placeTrees(rng, trees, placer.obstacles, { W, D }, { x0: 1, x1: W - 1, z0: houseBack + 1, z1: D - 1 }, rng.int(0, 3), [['round', 3], ['cone', 1]]);

  // Lamp posts by the entrances, a light over each door.
  for (const { door } of doors) {
    lights.push({ kind: 'ceiling', x: door.cx, y: plinth + (BRICK ? 2.42 : 2.62), z: door.cz - 0.7, rot: 0 });
    if (rng.chance(0.5) && door.cz > 3) lights.push({ kind: 'post', x: door.cx + 1.6, y: 0, z: 1.2, rot: 0 });
  }
  if (garden) for (let i = rng.int(1, 3); i > 0; i--) lights.push({ kind: 'post', x: rng.range(garden.x0 + 1, garden.x1 - 1), y: 0, z: rng.range(garden.z0 + 1, garden.z1 - 1), rot: 0 });
  for (const { door } of doors) {
    // Only where there is a front yard (courtyard blocks stand right on the sidewalk).
    if (door.cz >= 3.5 && rng.chance(0.5)) props.push({ kind: 'bins', x: door.cx + (rng.chance(0.5) ? 2.4 : -2.4), y: 0, z: door.cz - 2.2, rot: 0, color: rng.pick(['#2e6b3a', '#2b2b2b', '#1f4f8a', '#5a5f66']), color2: rng.pick(['#1f4f8a', '#8a8f96', '#6b4a33']) });
  }

  // Low hedge along the street (with gaps for paths and the drive).
  const fences: Fence[] = [];
  if (form !== 'courtyard' && setback > 3 && rng.chance(0.5)) {
    const gaps = [...paths, ...driveways.filter((dw) => dw.z0 <= 0.1)].map((p) => [p.x0 - 0.3, p.x1 + 0.3]).sort((a, b) => a[0] - b[0]);
    const segs: Fence['segments'] = [];
    let gx = 0.5;
    for (const [g0, g1] of gaps) {
      if (g0 > gx) segs.push({ x0: gx, z0: 0.5, x1: g0, z1: 0.5 });
      gx = Math.max(gx, g1);
    }
    if (gx < W - 0.5) segs.push({ x0: gx, z0: 0.5, x1: W - 0.5, z1: 0.5 });
    fences.push({ kind: BRICK ? 'iron' : 'hedge', color: BRICK ? '#1c1c1c' : jitterHex('#4e7a36', rng, 0.06), height: BRICK ? 1.0 : 0.8, segments: segs.filter((sg) => sg.x1 - sg.x0 > 0.4) });
  }

  const streetTreeXs: number[] = [];
  for (let sx = rng.range(3, 6); sx < W - 2; sx += rng.range(8, 10)) {
    if ([...paths, ...driveways].some((p) => p.z0 <= 0.1 && sx > p.x0 - 1.4 && sx < p.x1 + 1.4)) continue;
    streetTreeXs.push(sx);
  }

  return {
    seed: spec.seed,
    style,
    lot: { width: W, depth: D },
    lawnColor,
    trimColor: band,
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
    pipes,
    fireEscapes,
    props,
    lights,
    streetTreeXs,
    info: {
      type: 'apartment block',
      style,
      form: form + (masses.some((m) => m.kind === 'upper') ? ' (gateway)' : ''),
      floors,
      entrances: doors.length,
      balconies: balconies.length + (balconies.length ? ` (${pattern})` : ''),
      roof: pitched ? 'pitched' : 'flat + stair rooms',
      services: [
        pipes.length ? pipes.length + ' pipes' : '',
        fireEscapes.length ? 'fire escape' : '',
        masses.some((m) => m.kind === 'shaft') ? 'lift shaft' : '',
        masses.some((m) => m.kind === 'stairTower') ? 'stair tower' : '',
      ].filter(Boolean).join(', ') || '—',
      details: summarizeProps(props),
      lot: `${W.toFixed(1)} × ${D.toFixed(1)} m`,
    },
  };
}
