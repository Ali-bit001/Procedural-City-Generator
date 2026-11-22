/**
 * Row house / townhouse grammar.
 *
 *   Lot     -> Row of N units sharing party walls (+ small gaps at the row ends)
 *   Row     -> style (brownstone | terrace | modernTown) + shared roof language
 *   Unit    -> Mass [+ Bay window mass] [+ Recessed top floor (modern)] [+ Garage door (modern)]
 *   Unit    -> Front: Bays x Floors -> Window | Door (doors mirrored in pairs)
 *   Entry   -> Stoop + railings (brownstone) | Door hood + steps (terrace) | Canopy (modern)
 *   Front   -> Paved areaway + iron fence | small garden + low fence/hedge | driveway
 *   Back    -> Narrow fenced yards with props, services (tanks, ACs) and lights per unit
 */
import { RNG } from '../../core/rng';
import { jitterHex } from '../../core/color';
import { ROW_PALETTES, TREE_GREENS, type RowStyle } from '../styles/palettes';
import { OpeningPlacer, wallOf } from '../facade/openings';
import {
  YardPlacer,
  addBackLight,
  addCar,
  addDoorLights,
  addGarageLights,
  addGroundAC,
  addSatelliteDish,
  addSolarPanels,
  addSplitACs,
  addWallMailbox,
  addWindowShades,
  addWaterTanks,
  addYardProps,
  type DetailContext,
} from '../details/details';
import { placeTrees } from '../details/planting';
import { summarizeProps } from './house';
import {
  DEFAULT_DETAILS,
  massTop,
  roofRise,
  stairRun,
  type Chimney,
  type DetailOptions,
  type Fence,
  type HouseModel,
  type Light,
  type Mass,
  type Opening,
  type Porch,
  type Prop,
  type Rect,
  type RoofSpec,
  type Tree,
} from '../spec';

export interface RowhouseSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  style?: RowStyle;
  details?: DetailOptions;
}

const END_GAP = 0.8;

export function generateRowhouses(spec: RowhouseSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const details = spec.details ?? DEFAULT_DETAILS;
  const style: RowStyle = spec.style ?? rng.weighted<RowStyle>([['brownstone', 35], ['terrace', 40], ['modernTown', 25]]);
  const pal = ROW_PALETTES[style];
  const W = spec.lotWidth;
  const D = spec.lotDepth;

  // ---------- row layout ----------
  const rowW = W - 2 * END_GAP;
  const unitTarget = style === 'brownstone' ? rng.range(5.8, 7) : style === 'terrace' ? rng.range(5, 6.5) : rng.range(6.2, 7.5);
  const n = Math.max(2, Math.round(rowW / unitTarget));
  const raw = Array.from({ length: n }, () => (style === 'brownstone' ? rng.range(0.88, 1.12) : 1));
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const widths = raw.map((r) => (r / rawSum) * rowW);

  const modernGarages = style === 'modernTown' && rng.chance(0.6);
  const setback = style === 'brownstone' ? rng.range(4.4, 5.4) : style === 'terrace' ? rng.range(2.8, 4) : modernGarages ? rng.range(6.2, 7) : rng.range(3.5, 4.5);
  const md = Math.min(rng.range(10, 13), D - setback - 6);
  const fh = style === 'brownstone' ? rng.range(3.2, 3.5) : style === 'terrace' ? rng.range(2.9, 3.1) : rng.range(3.0, 3.2);
  const plinth = style === 'brownstone' ? rng.range(1.2, 1.6) : style === 'terrace' ? rng.range(0.35, 0.6) : 0.15;
  const baseFloors = style === 'brownstone' ? rng.int(3, 4) : style === 'terrace' ? rng.int(2, 3) : rng.chance(0.7) ? 3 : 2;
  const terraceRoof = rng.chance(0.6) ? 'continuous' : 'frontGables';
  const pitch = rng.range(0.6, 0.85);
  const rowRoofColor = jitterHex(rng.pick(pal.roofs), rng, 0.04);
  const trimColor = rng.pick(pal.trims);
  const cornice = rng.pick(pal.cornices);
  const pavingColor = jitterHex(rng.pick(pal.paving), rng, 0.03);
  const lawnColor = jitterHex('#7fae55', rng, 0.06);
  const mirrorDoors = rng.chance(0.65);
  const rowHasBays = style !== 'modernTown' && rng.chance(style === 'brownstone' ? 0.45 : 0.5);
  const modernSetbackTop = style === 'modernTown' && baseFloors >= 3 && rng.chance(0.4);
  const stagger = style === 'modernTown' && rng.chance(0.4);

  const win =
    style === 'brownstone'
      ? { w: rng.range(1.0, 1.2), h: rng.range(1.9, 2.2), sill: 0.6, mullions: true }
      : style === 'terrace'
        ? { w: rng.range(0.9, 1.1), h: rng.range(1.5, 1.7), sill: 0.8, mullions: true }
        : { w: 0, h: rng.range(2.0, 2.3), sill: 0.4, mullions: false };
  win.h = Math.min(win.h, fh - win.sill - 0.3);

  const masses: Mass[] = [];
  const addMass = (m: Omit<Mass, 'id'>): Mass => {
    const full = { ...m, id: masses.length } as Mass;
    masses.push(full);
    return full;
  };
  const mkRoof = (extra: Partial<RoofSpec>): RoofSpec => ({
    type: 'flat', pitch, axis: 'x', overhang: 0, gableOverhang: 0.3, highSide: 1, color: rowRoofColor, parapet: true, ...extra,
  });

  // ---------- unit masses ----------
  interface Unit {
    i: number;
    mass: Mass;
    rect: Rect;
    doorLeft: boolean;
    color: string;
    upper?: Mass;
  }
  const units: Unit[] = [];
  let x = END_GAP;
  let prevColor = '';
  for (let i = 0; i < n; i++) {
    const w = widths[i];
    let color = rng.pick(pal.walls);
    for (let k = 0; k < 4 && color === prevColor; k++) color = rng.pick(pal.walls);
    prevColor = color;
    color = jitterHex(color, rng, 0.04);
    const dz = stagger ? (i % 2 ? 0.6 : -0.6) * 0.5 : style === 'brownstone' ? rng.range(-0.1, 0.1) : 0;
    const rect: Rect = { x0: x, x1: x + w, z0: setback + dz, z1: setback + dz + md };
    let floors = baseFloors;
    if (style === 'brownstone' && rng.chance(0.3)) floors += rng.chance(0.5) ? 1 : -1;
    floors = Math.max(2, floors);

    let roof: RoofSpec;
    if (style === 'terrace') {
      roof =
        terraceRoof === 'continuous'
          ? mkRoof({ type: 'gable', axis: 'x', overhang: 0.35, gableOverhangs: [i === 0 ? 0.3 : 0, i === n - 1 ? 0.3 : 0], color: jitterHex(rowRoofColor, rng, 0.02) })
          : mkRoof({ type: 'gable', axis: 'z', overhang: 0.3, gableOverhang: 0.35, color: jitterHex(rowRoofColor, rng, 0.03) });
    } else if (style === 'brownstone') {
      roof = mkRoof({ parapet: true });
    } else {
      roof = mkRoof({ parapet: modernSetbackTop || rng.chance(0.5), overhang: 0.2 });
    }

    const topFloors = modernSetbackTop ? floors - 1 : floors;
    const mass = addMass({
      kind: 'unit', rect, baseY: plinth, floors: topFloors, floorHeight: fh, wallColor: color, roof, plinth: true,
      cornice: style === 'brownstone' ? cornice : undefined, floorBands: style === 'terrace',
    });
    units.push({ i, mass, rect, doorLeft: mirrorDoors ? i % 2 === 0 : true, color });
    x += w;
  }

  // Modern: recessed top floor (roof terrace in front of it).
  if (modernSetbackTop) {
    // Same recess for the whole row; each top floor keeps its own unit's cladding so columns read as one.
    const recess = rng.range(2, 3);
    for (const u of units) {
      const r = u.rect;
      u.upper = addMass({
        kind: 'upper', rect: { x0: r.x0, x1: r.x1, z0: r.z0 + recess, z1: r.z1 - 0.5 }, baseY: massTop(u.mass), floors: 1, floorHeight: fh,
        wallColor: u.color, roof: mkRoof({ parapet: false, overhang: 0.35, color: '#2f3236' }), plinth: false,
      });
    }
  }

  // ---------- bays: positions along each unit front ----------
  const bayCount = (w: number) => (w >= 6.6 ? 3 : 2);
  const bayCentres = (u: Unit) => {
    const nb = bayCount(u.rect.x1 - u.rect.x0);
    const bw = (u.rect.x1 - u.rect.x0) / nb;
    return Array.from({ length: nb }, (_, k) => u.rect.x0 + bw * (k + 0.5));
  };
  const doorX = (u: Unit) => {
    const c = bayCentres(u);
    return u.doorLeft ? c[0] : c[c.length - 1];
  };

  // Bay windows (projecting boxes) in front of the non-door bays.
  if (rowHasBays) {
    const bayFloors = style === 'brownstone' ? rng.int(1, 2) : rng.int(1, 2);
    for (const u of units) {
      if (!rng.chance(0.85)) continue;
      const c = bayCentres(u);
      const others = u.doorLeft ? c.slice(1) : c.slice(0, -1);
      const bw = (u.rect.x1 - u.rect.x0) / c.length;
      const cx = others.reduce((a, b) => a + b, 0) / others.length;
      const w = others.length * bw - 0.7;
      const depth = rng.range(0.7, 0.9);
      addMass({
        kind: 'bay', rect: { x0: cx - w / 2, x1: cx + w / 2, z0: u.rect.z0 - depth, z1: u.rect.z0 + 0.3 }, baseY: plinth,
        floors: Math.min(bayFloors, u.mass.floors), floorHeight: fh, wallColor: u.color,
        roof: style === 'terrace' ? mkRoof({ type: 'hip', axis: 'x', pitch: 0.45, overhang: 0.12, color: rowRoofColor }) : mkRoof({ parapet: false, overhang: 0.12, color: cornice }),
        plinth: true, cornice: undefined,
      });
    }
  }

  // ---------- openings ----------
  const facade = new OpeningPlacer(masses, rng);
  const frame = style === 'brownstone' ? trimColor : style === 'terrace' ? trimColor : rng.pick(pal.trims);
  const shutter = style === 'terrace' && rng.chance(0.15) ? rng.pick(['#2c3a4e', '#45583a']) : undefined;
  const doors: { u: Unit; door: Opening }[] = [];
  const garageDoors: Opening[] = [];

  for (const u of units) {
    const uw = u.rect.x1 - u.rect.x0;
    const nb = bayCount(uw);
    const ww = style === 'modernTown' ? Math.min(2.4, uw / nb - 0.8) : win.w;
    const front = wallOf(u.rect, 'front');
    const back = wallOf(u.rect, 'back');
    const upperFloors = Array.from({ length: u.mass.floors - 1 }, (_, k) => k + 1);
    const wp = { n: nb, bay: uw / nb, w: ww, h: win.h, sill: win.sill, frame, mullions: win.mullions, shutter, litChance: 0.4 };

    facade.wallWindows(u.mass, front, { ...wp, floors: upperFloors });
    facade.wallWindows(u.mass, back, { ...wp, n: Math.max(1, nb - 1) });

    // Ground floor front.
    const dx = doorX(u);
    if (modernGarages) {
      // Door at one side, garage door filling the rest.
      const doorW = 1.1;
      const doorCx = u.doorLeft ? u.rect.x0 + 0.5 + doorW / 2 : u.rect.x1 - 0.5 - doorW / 2;
      const door = facade.add({ kind: 'door', massId: u.mass.id, wall: 'front', floor: 0, cx: doorCx, cz: u.rect.z0, nx: 0, nz: -1, width: doorW, y0: plinth, height: 2.4, color: rng.pick(pal.doors), frameColor: frame, mullions: false });
      doors.push({ u, door });
      const gx0 = u.doorLeft ? doorCx + doorW / 2 + 0.6 : u.rect.x0 + 0.5;
      const gx1 = u.doorLeft ? u.rect.x1 - 0.5 : doorCx - doorW / 2 - 0.6;
      if (gx1 - gx0 > 2.6) {
        garageDoors.push(facade.add({ kind: 'garageDoor', massId: u.mass.id, wall: 'front', floor: 0, cx: (gx0 + gx1) / 2, cz: u.rect.z0, nx: 0, nz: -1, width: Math.min(3.0, gx1 - gx0 - 0.2), y0: 0.05, height: 2.3, color: rng.pick(['#3a3d40', '#b4895e', '#d9d9d6']), frameColor: frame, mullions: false }));
      }
    } else {
      const slots = facade.wallWindows(u.mass, front, { ...wp, floors: [0] });
      const slot = slots.find((o) => Math.abs(o.cx - dx) < 0.1);
      if (slot) {
        facade.toDoor(slot, style === 'modernTown' ? 1.2 : 1.05, plinth, style === 'brownstone' ? 2.6 : 2.3, rng.pick(pal.doors));
        doors.push({ u, door: slot });
      } else {
        // Door bay hidden (shouldn't happen) — place it directly.
        const door = facade.add({ kind: 'door', massId: u.mass.id, wall: 'front', floor: 0, cx: dx, cz: u.rect.z0, nx: 0, nz: -1, width: 1.05, y0: plinth, height: 2.3, color: rng.pick(pal.doors), frameColor: frame, mullions: false });
        doors.push({ u, door });
      }
    }

    // Garden-level windows under the stoop's parlour floor (brownstone).
    if (style === 'brownstone' && plinth > 1.1) {
      for (const cx of bayCentres(u)) {
        if (Math.abs(cx - dx) < 0.1) continue;
        if (!facade.visible(front, cx, u.rect.z0, 0.9, plinth / 2, u.mass.id)) continue;
        facade.add({ kind: 'window', massId: u.mass.id, wall: 'front', floor: -1, cx, cz: u.rect.z0, nx: 0, nz: -1, width: 0.9, y0: 0.2, height: plinth - 0.5, color: '#2b3a48', frameColor: frame, mullions: false, lit: rng.chance(0.3) });
      }
    }

    // Outer walls of the end units get windows; party walls stay blank.
    if (u.i === 0) facade.wallWindows(u.mass, wallOf(u.rect, 'left'), { ...wp, n: undefined, bay: 3.2, w: Math.min(ww, 1.2) || 1.0 });
    if (u.i === n - 1) facade.wallWindows(u.mass, wallOf(u.rect, 'right'), { ...wp, n: undefined, bay: 3.2, w: Math.min(ww, 1.2) || 1.0 });

    if (u.upper) {
      const uf = wallOf(u.upper.rect, 'front');
      facade.wallWindows(u.upper, uf, { n: 1, bay: uw, w: uw - 1.4, h: fh - 0.6, sill: 0.2, frame, mullions: false, litChance: 0.5 });
      facade.wallWindows(u.upper, wallOf(u.upper.rect, 'back'), { ...wp, n: 1 });
    }
  }

  // Bay window glazing.
  for (const m of masses.filter((mm) => mm.kind === 'bay')) {
    const r = m.rect;
    const bw = r.x1 - r.x0;
    facade.wallWindows(m, wallOf(r, 'front'), { n: bw > 3.5 ? 2 : 1, bay: bw, w: bw > 3.5 ? bw / 2 - 0.5 : bw - 0.7, h: win.h, sill: win.sill, frame, mullions: true, litChance: 0.4 });
    for (const side of ['left', 'right'] as const) {
      facade.wallWindows(m, wallOf(r, side), { n: 1, bay: 1, w: 0.45, h: win.h, sill: win.sill, frame, mullions: false, litChance: 0.4 });
    }
  }

  // Concrete sunshades over the windows on some modern rows.
  if (style === 'modernTown' && rng.chance(0.35)) {
    addWindowShades(facade, masses.map((m) => m.id), 'slab', rng.pick(['#2f3236', '#d8d6d0']));
  }

  // ---------- entrances ----------
  const porches: Porch[] = [];
  const paths: Rect[] = [];
  const driveways: Rect[] = [];
  const lights: Light[] = [];

  for (const { u, door } of doors) {
    const dx = door.cx;
    if (style === 'brownstone') {
      const landing: Rect = { x0: dx - 0.85, x1: dx + 0.85, z0: u.rect.z0 - 1.2, z1: u.rect.z0 };
      porches.push({ kind: 'stoop', rect: landing, floorY: plinth, roofY: plinth + 2.9, stepX: dx, floorColor: jitterHex(u.color, rng, 0.03), roofColor: cornice, postColor: '#1c1c1c' });
      const footZ = landing.z0 - stairRun(plinth);
      paths.push({ x0: dx - 0.85, x1: dx + 0.85, z0: 0, z1: Math.max(0.1, footZ) });
    } else if (style === 'terrace') {
      const landing: Rect = { x0: dx - 0.75, x1: dx + 0.75, z0: u.rect.z0 - 0.8, z1: u.rect.z0 };
      porches.push({ kind: 'hood', rect: landing, floorY: plinth, roofY: plinth + door.height + 0.15, stepX: dx, floorColor: '#d8d3c8', roofColor: trimColor, postColor: trimColor });
      paths.push({ x0: dx - 0.6, x1: dx + 0.6, z0: 0, z1: landing.z0 - stairRun(plinth) });
    } else {
      porches.push({ kind: 'canopy', rect: { x0: dx - 0.9, x1: dx + 0.9, z0: u.rect.z0 - 1.1, z1: u.rect.z0 }, floorY: 0.12, roofY: plinth + 2.7, stepX: dx, floorColor: pavingColor, roofColor: '#2f3236', postColor: frame });
      paths.push({ x0: dx - 0.6, x1: dx + 0.6, z0: 0, z1: u.rect.z0 - 1.1 });
    }
  }
  for (const g of garageDoors) driveways.push({ x0: g.cx - g.width / 2 - 0.1, x1: g.cx + g.width / 2 + 0.1, z0: 0, z1: g.cz });

  // ---------- chimneys ----------
  const chimneys: Chimney[] = [];
  for (let i = 1; i < n; i++) {
    const a = units[i - 1].mass;
    const b = units[i].mass;
    const bx = a.rect.x1;
    if (style === 'terrace' && rng.chance(0.75)) {
      const top = Math.min(massTop(a), massTop(b));
      const rise = Math.min(roofRise(a), roofRise(b));
      const z = terraceRoof === 'continuous' ? (a.rect.z0 + a.rect.z1) / 2 : a.rect.z0 + md * 0.6;
      chimneys.push({ x: bx, z, w: 0.9, d: 0.7, y0: top - 0.3, y1: top + rise + rng.range(0.6, 1.0), color: rng.pick(['#8a4b3a', '#9a9590', '#7a4234']) });
    } else if (style === 'brownstone' && rng.chance(0.35)) {
      const top = Math.max(massTop(a), massTop(b));
      chimneys.push({ x: bx, z: a.rect.z1 - rng.range(1.5, 3), w: 0.8, d: 0.8, y0: top - 0.3, y1: top + rng.range(1.0, 1.6), color: '#6e3f33' });
    }
  }

  // ---------- fences ----------
  const fences: Fence[] = [];
  // Back yards: dividers between units + back fence.
  const backSegs: Fence['segments'] = [{ x0: END_GAP, z0: D - 0.25, x1: W - END_GAP, z1: D - 0.25 }];
  for (let i = 0; i <= n; i++) {
    const bx = i === 0 ? units[0].rect.x0 : i === n ? units[n - 1].rect.x1 : units[i].rect.x0;
    const z0 = i === 0 ? units[0].rect.z1 : i === n ? units[n - 1].rect.z1 : Math.max(units[i - 1].rect.z1, units[i].rect.z1);
    backSegs.push({ x0: bx, z0, x1: bx, z1: D - 0.25 });
  }
  fences.push({ kind: 'privacy', color: style === 'modernTown' ? '#3a3d40' : jitterHex('#8a6a4a', rng, 0.05), height: 1.8, segments: backSegs });

  // Front: iron railings (brownstone) / low fence or hedge (terrace) along the street, with gaps at paths.
  if (style !== 'modernTown' || rng.chance(0.3)) {
    const kind: Fence['kind'] = style === 'brownstone' ? 'iron' : style === 'terrace' ? rng.pick(['picket', 'hedge', 'iron'] as const) : 'hedge';
    const h = kind === 'iron' ? 1.0 : kind === 'hedge' ? 0.8 : 0.9;
    const e = kind === 'hedge' ? 0.5 : 0.3;
    const segs: Fence['segments'] = [];
    const gaps = [...paths, ...driveways].map((p) => [p.x0 - 0.15, p.x1 + 0.15]).sort((a, b) => a[0] - b[0]);
    let gx = END_GAP;
    for (const [g0, g1] of gaps) {
      if (g0 > gx) segs.push({ x0: gx, z0: e, x1: g0, z1: e });
      gx = Math.max(gx, g1);
    }
    if (gx < W - END_GAP) segs.push({ x0: gx, z0: e, x1: W - END_GAP, z1: e });
    // Low dividers between front gardens.
    for (let i = 0; i <= n; i++) {
      const bx = i === n ? units[n - 1].rect.x1 : units[i].rect.x0;
      const zEnd = Math.min(...units.filter((_, k) => k === i || k === i - 1).map((u) => u.rect.z0)) - (rowHasBays ? 0.95 : 0.05);
      if (zEnd - e > 0.6) segs.push({ x0: bx, z0: e, x1: bx, z1: zEnd });
    }
    fences.push({ kind, color: kind === 'iron' ? '#1c1c1c' : kind === 'hedge' ? jitterHex('#4e7a36', rng, 0.06) : '#f4f2ec', height: h, segments: segs.filter((s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0) > 0.4) });
  }

  // Brownstones: the front areaway is paved, not lawn.
  if (style === 'brownstone') {
    for (const u of units) paths.push({ x0: u.rect.x0 + 0.05, x1: u.rect.x1 - 0.05, z0: 0.05, z1: u.rect.z0 - 0.02 });
  }

  // ---------- per-unit details ----------
  const props: Prop[] = [];
  const porchRects = porches.map((p) => ({ ...p.rect, z0: p.rect.z0 - stairRun(p.floorY) }));
  const obstacles: Rect[] = [...masses.map((m) => m.rect), ...paths, ...driveways, ...porchRects];
  const placer = new YardPlacer(rng, W, D, obstacles);
  const trees: Tree[] = [];

  for (const u of units) {
    const unitMasses = masses.filter((m) => m === u.mass || m === u.upper || (m.kind === 'bay' && m.rect.x0 >= u.rect.x0 - 0.01 && m.rect.x1 <= u.rect.x1 + 0.01));
    const ctx: DetailContext = { rng, W, D, masses: unitMasses, facade, placer, props, lights, details };
    const yard: Rect = { x0: u.rect.x0 + 0.4, x1: u.rect.x1 - 0.4, z0: u.rect.z1 + 0.6, z1: D - 0.6 };

    addGroundAC(ctx, u.mass);
    if (rng.chance(0.35)) addSplitACs(ctx, rng.int(1, 2));
    addWaterTanks(ctx, details.waterTanks * (style === 'terrace' ? 0.6 : 1), { ...yard, z1: Math.min(yard.z1, yard.z0 + 3) });
    addSolarPanels(ctx, style === 'modernTown' ? 0.3 : 0.12);
    addSatelliteDish(ctx, u.upper ?? u.mass, 0.12);
    addYardProps(ctx, yard, { patioSet: 0.3, bbq: 0.25, gardenBed: 0.25, clothesline: 0.2, doghouse: 0.12, bench: 0.12, swing: 0.06, slide: 0.05 }, 2);
    addBackLight(ctx, u.mass, 0.5);

    const entry = doors.find((d) => d.u === u)!;
    const porch = porches[doors.indexOf(entry)];
    addDoorLights(ctx, entry.door, porch);
    addWallMailbox(ctx, entry.door, u.doorLeft ? 1 : -1, 0.9);
    if (style === 'brownstone' && rng.chance(0.4)) {
      // Lamp posts flanking the foot of the stoop.
      const footZ = porch.rect.z0 - stairRun(plinth) - 0.2;
      for (const s of [-1, 1]) lights.push({ kind: 'post', x: entry.door.cx + s * 1.05, y: 0, z: Math.max(0.6, footZ), rot: 0 });
    }

    // Bins in the front (brownstone areaway / terrace garden).
    if (style !== 'modernTown' && rng.chance(0.4)) {
      const bx = u.doorLeft ? u.rect.x1 - 1.0 : u.rect.x0 + 1.0;
      props.push({ kind: 'bins', x: bx, y: 0, z: 1.0, rot: 0, color: rng.pick(['#2e6b3a', '#2b2b2b', '#1f4f8a', '#5a5f66']), color2: rng.pick(['#1f4f8a', '#8a8f96', '#6b4a33']) });
    }

    placeTrees(rng, trees, obstacles, { W, D }, yard, rng.chance(0.5) ? 1 : 0, [['round', 4], ['cone', 1]]);
    if (style === 'terrace') placeTrees(rng, trees, obstacles, { W, D }, { x0: u.rect.x0 + 0.5, x1: u.rect.x1 - 0.5, z0: 0.6, z1: u.rect.z0 - 0.6 }, rng.int(0, 2), [['shrub', 1]]);
  }
  for (const g of garageDoors) {
    const u = units.find((uu) => g.cx > uu.rect.x0 && g.cx < uu.rect.x1)!;
    const ctx: DetailContext = { rng, W, D, masses: [u.mass], facade, placer, props, lights, details };
    addCar(ctx, driveways.find((d) => Math.abs((d.x0 + d.x1) / 2 - g.cx) < 0.1)!);
  }
  if (garageDoors.length) addGarageLights({ rng, W, D, masses, facade, placer, props, lights, details }, garageDoors.slice(0, 1));

  // Modern units: planters by the door.
  if (style === 'modernTown') {
    for (const { door } of doors) {
      if (rng.chance(0.6)) trees.push({ kind: 'shrub', x: door.cx + (rng.chance(0.5) ? 1 : -1) * 1.2, z: door.cz - 1.4, scale: 0.6, rot: rng.range(0, 6), color: jitterHex(rng.pick(TREE_GREENS), rng, 0.06), trunkColor: '#6b4a33' });
    }
  }

  // Street trees roughly every 8 m, clear of paths and driveways.
  const streetTreeXs: number[] = [];
  for (let sx = END_GAP + rng.range(2, 5); sx < W - 2; sx += rng.range(7, 9)) {
    if ([...paths, ...driveways].some((p) => p.z0 <= 0.1 && sx > p.x0 - 1.4 && sx < p.x1 + 1.4)) continue;
    streetTreeXs.push(sx);
  }

  return {
    seed: spec.seed,
    style,
    lot: { width: W, depth: D },
    lawnColor,
    trimColor,
    foundationColor: style === 'brownstone' ? '#6a4a3e' : '#8f8a83',
    pavingColor,
    masses,
    openings: facade.openings,
    porches,
    chimneys,
    driveways,
    paths,
    fences,
    trees,
    balconies: [],
    props,
    lights,
    streetTreeXs,
    info: {
      type: 'row houses',
      style,
      units: n,
      floors: style === 'brownstone' ? `${Math.min(...units.map((u) => u.mass.floors))}–${Math.max(...units.map((u) => u.mass.floors + (u.upper ? 1 : 0)))}` : baseFloors,
      roof: style === 'terrace' ? (terraceRoof === 'continuous' ? 'continuous gable' : 'front gables') : modernSetbackTop ? 'flat + roof terraces' : 'flat (parapet)',
      entrance: style === 'brownstone' ? 'stoops' : style === 'terrace' ? 'door hoods' : modernGarages ? 'canopy + garages' : 'canopy',
      'bay windows': rowHasBays ? 'yes' : 'no',
      details: summarizeProps(props),
      lot: `${W.toFixed(1)} × ${D.toFixed(1)} m`,
    },
  };
}
