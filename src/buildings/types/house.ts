/**
 * Suburban house grammar.
 *
 *   Lot      -> Setbacks + House + Driveway + Paths + Yard
 *   House    -> Main mass [+ Wing (L-shape)] [+ Garage] [+ Upper volume (modern)]
 *   Mass     -> Floors x Walls -> Bays -> Window | Door | GarageDoor
 *   Mass     -> Roof (gable | hip | shed | flat) [+ attic window] [+ chimney]
 *   Entrance -> Porch (posts + shed roof) | Canopy (modern)
 *   Yard     -> Lawn + Fence/Hedge + Trees + Shrubs [+ Pool]
 *
 * Three style families pick different rule weights: traditional, ranch, modern.
 */
import { RNG } from '../../core/rng';
import { jitterHex, lightness } from '../../core/color';
import {
  HOUSE_PALETTES,
  MODERN_ACCENTS_DARK,
  MODERN_ACCENTS_LIGHT,
  TREE_GREENS,
  CONIFER_GREENS,
  AUTUMN,
  type HouseStyle,
} from '../styles/palettes';
import {
  massTop,
  roofRise,
  type Axis,
  type Fence,
  type HouseModel,
  type Mass,
  type MassKind,
  type Opening,
  type Porch,
  type Rect,
  type RoofSpec,
  type RoofType,
  type Tree,
  type WallSide,
} from '../spec';

export interface HouseSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  /** Force a style; otherwise chosen by weighted random. */
  style?: HouseStyle;
}

const SIDE_MARGIN = 1.8;

interface Wall {
  side: WallSide;
  nx: number;
  nz: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

function wallsOf(r: Rect): Wall[] {
  return [
    { side: 'front', nx: 0, nz: -1, ax: r.x0, az: r.z0, bx: r.x1, bz: r.z0 },
    { side: 'back', nx: 0, nz: 1, ax: r.x0, az: r.z1, bx: r.x1, bz: r.z1 },
    { side: 'left', nx: -1, nz: 0, ax: r.x0, az: r.z0, bx: r.x0, bz: r.z1 },
    { side: 'right', nx: 1, nz: 0, ax: r.x1, az: r.z0, bx: r.x1, bz: r.z1 },
  ];
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function inside(r: Rect, x: number, z: number, pad = 0): boolean {
  return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
}

export function generateHouse(spec: HouseSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const style: HouseStyle =
    spec.style ?? rng.weighted<HouseStyle>([['traditional', 45], ['ranch', 25], ['modern', 30]]);
  const pal = HOUSE_PALETTES[style];
  const W = spec.lotWidth;
  const D = spec.lotDepth;
  const usable = W - 2 * SIDE_MARGIN;

  // ---------- global house parameters ----------
  const fh = style === 'modern' ? rng.range(3.0, 3.3) : rng.range(2.8, 3.0);
  const plinth = style === 'modern' ? 0.15 : rng.range(0.35, 0.6);
  const frontSetback = rng.range(6.5, 9);

  const wallColor = jitterHex(rng.pick(pal.walls), rng, 0.04);
  const roofColor = jitterHex(rng.pick(pal.roofs), rng, 0.05);
  const trimColor = rng.pick(pal.trims);
  const doorColor = rng.pick(pal.doors);
  const garageDoorColor = rng.pick(pal.garageDoors);
  const pavingColor = jitterHex(rng.pick(pal.paving), rng, 0.03);
  const lawnColor = jitterHex('#7fae55', rng, 0.06);

  // ---------- footprint layout: main + garage side by side ----------
  let garageCars = rng.chance(0.85) ? (rng.chance(0.6) ? 2 : 1) : 0;
  let gw = garageCars === 2 ? rng.range(5.8, 6.4) : garageCars === 1 ? rng.range(3.5, 3.9) : 0;
  let mw =
    style === 'ranch' ? rng.range(12, 17) : style === 'modern' ? rng.range(9, 14) : rng.range(8.5, 12.5);
  const md = style === 'modern' ? rng.range(8, 11.5) : rng.range(8, 10.5);
  const MIN_MAIN = 7.5;
  if (mw + gw > usable) {
    mw = Math.max(MIN_MAIN, usable - gw);
    if (mw + gw > usable && garageCars === 2) {
      garageCars = 1;
      gw = 3.7;
      mw = Math.max(MIN_MAIN, usable - gw);
    }
    if (mw + gw > usable) {
      garageCars = 0;
      gw = 0;
      mw = Math.min(mw, usable);
    }
  }
  const xStart = SIDE_MARGIN + (usable - mw - gw) * rng.range(0.25, 0.75);
  const garageSide: 1 | -1 = rng.chance(0.5) ? -1 : 1; // -1 = garage on the low-x side
  const mainX0 = garageSide < 0 ? xStart + gw : xStart;
  const mainRect: Rect = { x0: mainX0, x1: mainX0 + mw, z0: frontSetback, z1: frontSetback + md };

  // ---------- roof language ----------
  const pitch =
    style === 'traditional' ? rng.range(0.6, 0.95) : style === 'ranch' ? rng.range(0.3, 0.45) : rng.range(0.1, 0.2);
  const roofType: RoofType =
    style === 'traditional'
      ? rng.weighted<RoofType>([['gable', 6], ['hip', 4]])
      : style === 'ranch'
        ? rng.weighted<RoofType>([['hip', 6], ['gable', 4]])
        : rng.weighted<RoofType>([['flat', 6], ['shed', 4]]);
  const overhang = style === 'modern' ? rng.range(0.15, 0.7) : rng.range(0.4, 0.7);
  const mkRoof = (type: RoofType, axis: Axis, extra: Partial<RoofSpec> = {}): RoofSpec => ({
    type,
    pitch,
    axis,
    overhang,
    gableOverhang: 0.3,
    highSide: 1,
    color: roofColor,
    parapet: false,
    ...extra,
  });

  const masses: Mass[] = [];
  const addMass = (kind: MassKind, rect: Rect, baseY: number, floors: number, floorHeight: number, roof: RoofSpec, color = wallColor, hasPlinth = true): Mass => {
    const m: Mass = { id: masses.length, kind, rect, baseY, floors, floorHeight, wallColor: color, roof, plinth: hasPlinth };
    masses.push(m);
    return m;
  };

  // ---------- main mass ----------
  let mainFloors =
    style === 'ranch' ? 1 : style === 'traditional' ? (rng.chance(0.75) ? 2 : 1) : rng.chance(0.6) ? 2 : 1;
  const wantsWing =
    mw >= 9 && ((style === 'traditional' && rng.chance(0.55)) || (style === 'ranch' && rng.chance(0.35)));
  let mainAxis: Axis = mw >= md ? 'x' : 'z';
  if (style === 'traditional' && roofType === 'gable' && !wantsWing && rng.chance(0.25)) mainAxis = 'z'; // front-gabled
  if (roofType === 'hip') mainAxis = mw >= md ? 'x' : 'z';

  let main: Mass;
  let upper: Mass | undefined;
  if (style === 'modern' && mainFloors === 2) {
    // Ground box + offset/cantilevered upper box in a contrasting material.
    main = addMass('main', mainRect, plinth, 1, fh, mkRoof('flat', 'x', { overhang: rng.range(0, 0.3), parapet: rng.chance(0.4) }));
    const uw = mw * rng.range(0.6, 1.0);
    const ud = md * rng.range(0.75, 1.1);
    const ux0 = clamp(mainRect.x0 + rng.range(-1.5, mw - uw + 1.5), SIDE_MARGIN, W - SIDE_MARGIN - uw);
    const uz0 = Math.max(4, mainRect.z0 + rng.range(-1.5, md - ud + 1.0));
    const accent = lightness(wallColor) > 0.6 ? rng.pick(MODERN_ACCENTS_DARK) : rng.pick(MODERN_ACCENTS_LIGHT);
    const upperRoof = rng.chance(0.6)
      ? mkRoof('flat', 'x', { overhang: rng.range(0.3, 0.9), color: rng.pick(pal.roofs) })
      : mkRoof('shed', 'x', { highSide: rng.chance(0.5) ? 1 : -1 });
    upper = addMass('upper', { x0: ux0, x1: ux0 + uw, z0: uz0, z1: uz0 + ud }, plinth + fh, 1, fh, upperRoof, jitterHex(accent, rng, 0.03), false);
  } else {
    const roof =
      roofType === 'shed'
        ? mkRoof('shed', 'x', { highSide: rng.chance(0.5) ? 1 : -1 })
        : roofType === 'flat'
          ? mkRoof('flat', 'x', { parapet: rng.chance(0.4) })
          : mkRoof(roofType, mainAxis);
    main = addMass('main', mainRect, plinth, mainFloors, fh, roof);
  }

  // ---------- wing (L-shape, protrudes towards the street) ----------
  let wing: Mass | undefined;
  if (wantsWing) {
    const wingSide = garageCars ? -garageSide : rng.chance(0.5) ? -1 : 1;
    const ww = rng.range(3.8, Math.min(6.5, mw * 0.5));
    const protrude = rng.range(2, Math.max(2.1, Math.min(4, frontSetback - 3.5)));
    const x0 = wingSide < 0 ? mainRect.x0 : mainRect.x1 - ww;
    const z0 = mainRect.z0 - protrude;
    // Keep the wing's ridge buried inside the main roof.
    const z1 = mainRect.z0 + rng.range(Math.min(ww / 2 + 0.4, md / 2), md / 2);
    const floors = style === 'traditional' && rng.chance(0.7) ? mainFloors : 1;
    const wingRoofType: RoofType = roofType === 'hip' ? 'hip' : 'gable';
    wing = addMass('wing', { x0, x1: x0 + ww, z0, z1 }, plinth, floors, fh, mkRoof(wingRoofType, 'z'));
  }

  // ---------- garage ----------
  let garage: Mass | undefined;
  if (garageCars) {
    const gx0 = garageSide < 0 ? xStart : mainRect.x1;
    const gz0 = mainRect.z0 + rng.range(-1.5, 2.5);
    const gd = rng.range(6, 7);
    let gRoof: RoofSpec;
    if (style === 'modern') gRoof = mkRoof('flat', 'x', { overhang: rng.range(0, 0.5), color: main.roof.color });
    else if (style === 'ranch') gRoof = mkRoof(roofType, gw >= gd ? 'x' : 'z');
    else if (roofType === 'hip') gRoof = mkRoof('hip', gw >= gd ? 'x' : 'z');
    else gRoof = mkRoof('gable', rng.chance(0.5) ? 'z' : 'x');
    garage = addMass('garage', { x0: gx0, x1: gx0 + gw, z0: gz0, z1: gz0 + gd }, 0.05, 1, plinth + fh - 0.05, gRoof, wallColor, false);
  }

  // ---------- openings ----------
  const win =
    style === 'traditional'
      ? { w: rng.range(0.9, 1.2), h: rng.range(1.35, 1.6), sill: 0.85, bay: rng.range(2.6, 3.2), mullions: true }
      : style === 'ranch'
        ? { w: rng.range(1.3, 1.9), h: rng.range(1.1, 1.3), sill: 1.0, bay: rng.range(3.2, 4.0), mullions: rng.chance(0.5) }
        : (() => {
            const w = rng.range(1.8, 3.0);
            return { w, h: rng.range(1.9, 2.3), sill: rng.range(0.35, 0.6), bay: w + rng.range(0.9, 1.6), mullions: false };
          })();
  win.h = Math.min(win.h, fh - win.sill - 0.3);
  const shutterColor =
    style === 'traditional' && rng.chance(0.45) ? rng.pick(pal.shutters) : undefined;
  const modernSparseSides = style === 'modern' && rng.chance(0.6);

  const occluded = (px: number, py: number, pz: number, selfId: number): boolean => {
    for (const m of masses) {
      if (m.id === selfId) continue;
      if (inside(m.rect, px, pz, 0.01) && py >= m.baseY - 0.5 && py <= massTop(m) + roofRise(m)) return true;
    }
    return false;
  };
  const visible = (wl: Wall, cx: number, cz: number, w: number, y: number, selfId: number): boolean => {
    const len = Math.hypot(wl.bx - wl.ax, wl.bz - wl.az);
    const tx = (wl.bx - wl.ax) / len;
    const tz = (wl.bz - wl.az) / len;
    for (const s of [-0.5, 0, 0.5]) {
      if (occluded(cx + tx * w * s + wl.nx * 0.3, y, cz + tz * w * s + wl.nz * 0.3, selfId)) return false;
    }
    return true;
  };

  const openings: Opening[] = [];
  const push = (o: Omit<Opening, 'frameColor' | 'mullions'> & Partial<Pick<Opening, 'frameColor' | 'mullions'>>) =>
    openings.push({ frameColor: trimColor, mullions: false, ...o });

  for (const m of masses) {
    if (m.kind === 'garage') continue;
    for (const wl of wallsOf(m.rect)) {
      const L = Math.hypot(wl.bx - wl.ax, wl.bz - wl.az);
      if (L < 1.8) continue;
      const isSide = wl.side === 'left' || wl.side === 'right';
      let n = Math.max(1, Math.floor(L / win.bay));
      let w = win.w;
      let h = win.h;
      let sill = win.sill;
      if (modernSparseSides && isSide) {
        n = 1;
        if (rng.chance(0.5)) {
          // tall slit window
          w = 0.6;
          sill = 0.3;
          h = m.floorHeight - 0.6;
        }
      }
      w = Math.min(w, L / n - 0.6);
      for (let f = 0; f < m.floors; f++) {
        const floorY = m.baseY + f * m.floorHeight;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const cx = wl.ax + (wl.bx - wl.ax) * t;
          const cz = wl.az + (wl.bz - wl.az) * t;
          if (!visible(wl, cx, cz, w, floorY + sill + h / 2, m.id)) continue;
          push({
            kind: 'window', massId: m.id, wall: wl.side, floor: f, cx, cz, nx: wl.nx, nz: wl.nz,
            width: w, y0: floorY + sill, height: h, color: '#2b3a48', mullions: win.mullions, shutterColor,
          });
        }
      }
    }

    // Attic window in the gable triangle.
    if (m.roof.type === 'gable' && style !== 'modern') {
      const rise = roofRise(m);
      if (rise > 1.6 && rng.chance(0.6)) {
        const top = massTop(m);
        for (const wl of wallsOf(m.rect)) {
          const isGableEnd = m.roof.axis === 'x' ? wl.side === 'left' || wl.side === 'right' : wl.side === 'front' || wl.side === 'back';
          if (!isGableEnd) continue;
          const cx = (wl.ax + wl.bx) / 2;
          const cz = (wl.az + wl.bz) / 2;
          const h = Math.min(0.9, rise * 0.4);
          const y0 = top + rise * 0.18;
          if (!visible(wl, cx, cz, 0.7, y0 + h / 2, m.id)) continue;
          push({ kind: 'window', massId: m.id, wall: wl.side, floor: m.floors, cx, cz, nx: wl.nx, nz: wl.nz, width: 0.7, y0, height: h, color: '#2b3a48', mullions: win.mullions });
        }
      }
    }
  }

  // Front door: replace the most central visible ground-floor front window of the main mass.
  const frontSlots = openings.filter((o) => o.massId === main.id && o.wall === 'front' && o.floor === 0);
  let doorX = (mainRect.x0 + mainRect.x1) / 2;
  if (frontSlots.length) {
    const mid = frontSlots.reduce((s, o) => s + o.cx, 0) / frontSlots.length;
    const door = frontSlots.reduce((best, o) => (Math.abs(o.cx - mid) < Math.abs(best.cx - mid) ? o : best));
    door.kind = 'door';
    door.width = style === 'modern' ? rng.range(1.1, 1.5) : 1.0;
    door.y0 = main.baseY;
    door.height = style === 'modern' ? 2.4 : 2.15;
    door.color = doorColor;
    door.shutterColor = undefined;
    door.mullions = false;
    doorX = door.cx;
  }

  // Garage doors + an optional side window.
  if (garage) {
    const g = garage;
    const gr = g.rect;
    const gwid = gr.x1 - gr.x0;
    const doors = garageCars === 2 && rng.chance(0.5) ? [0.27, 0.73].map((t) => ({ t, w: 2.5 })) : [{ t: 0.5, w: Math.min(gwid - 0.8, 5.0) }];
    for (const d of doors) {
      push({
        kind: 'garageDoor', massId: g.id, wall: 'front', floor: 0, cx: gr.x0 + gwid * d.t, cz: gr.z0, nx: 0, nz: -1,
        width: d.w, y0: g.baseY, height: 2.2, color: garageDoorColor,
      });
    }
    const outer = wallsOf(gr).find((wl) => wl.side === (garageSide < 0 ? 'left' : 'right'))!;
    if (rng.chance(0.5)) {
      const cx = outer.ax;
      const cz = (gr.z0 + gr.z1) / 2;
      if (visible(outer, cx, cz, 1, 1.5, g.id))
        push({ kind: 'window', massId: g.id, wall: outer.side, floor: 0, cx, cz, nx: outer.nx, nz: outer.nz, width: 1.0, y0: 1.1, height: 0.9, color: '#2b3a48' });
    }
  }

  // ---------- entrance: porch / canopy ----------
  let porch: Porch | undefined;
  const wantsPorch = style === 'traditional' ? rng.chance(0.7) : style === 'ranch' ? rng.chance(0.5) : rng.chance(0.65);
  if (wantsPorch && frontSlots.length) {
    // Free stretch of the main front wall (not hidden by the wing).
    let fx0 = mainRect.x0;
    let fx1 = mainRect.x1;
    if (wing && wing.rect.z0 < mainRect.z0) {
      if (wing.rect.x0 <= mainRect.x0 + 0.01) fx0 = wing.rect.x1;
      else fx1 = wing.rect.x0;
    }
    const full = style !== 'modern' && rng.chance(0.35);
    const half = rng.range(1.4, 2.2);
    const px0 = full ? fx0 : Math.max(fx0, doorX - half);
    const px1 = full ? fx1 : Math.min(fx1, doorX + half);
    const depth = style === 'modern' ? rng.range(1.4, 2.2) : rng.range(1.8, 2.5);
    const top1 = massTop(main);
    porch = {
      kind: style === 'modern' ? 'canopy' : 'porch',
      rect: { x0: px0, x1: px1, z0: mainRect.z0 - depth, z1: mainRect.z0 },
      floorY: style === 'modern' ? 0.12 : plinth,
      roofY: main.floors >= 2 || upper ? plinth + fh - 0.1 : Math.min(top1 - 0.15, plinth + fh - 0.1),
      stepX: doorX,
      floorColor: style === 'modern' ? pavingColor : rng.chance(0.5) ? '#b9b4aa' : '#9b7a58',
      roofColor,
      postColor: trimColor,
    };
    if (style === 'modern') porch.roofY = plinth + 2.65;
  }

  // ---------- chimney (through the main roof) ----------
  let chimney: HouseModel['chimney'];
  if ((main.roof.type === 'gable' || main.roof.type === 'hip') && rng.chance(style === 'traditional' ? 0.55 : 0.3)) {
    const top = massTop(main);
    const rise = roofRise(main);
    const along = rng.range(0.2, 0.8);
    const across = rng.range(-0.6, 0.6);
    const x = main.roof.axis === 'x' ? mainRect.x0 + mw * along : (mainRect.x0 + mainRect.x1) / 2 + across;
    const z = main.roof.axis === 'x' ? (mainRect.z0 + mainRect.z1) / 2 + across : mainRect.z0 + md * along;
    chimney = { x, z, w: 0.7, d: 0.9, y0: top - 0.5, y1: top + rise + rng.range(0.6, 1.1), color: rng.pick(['#8a4b3a', '#7a4234', '#9a9590']) };
  }

  // ---------- driveway & paths ----------
  const paths: Rect[] = [];
  let driveway: Rect | undefined;
  if (garage) {
    const gr = garage.rect;
    driveway = { x0: gr.x0 + 0.2, x1: gr.x1 - 0.2, z0: 0, z1: gr.z0 };
  }
  const entryZ = porch ? porch.rect.z0 - 0.35 : mainRect.z0;
  if (driveway && rng.chance(0.45)) {
    // Path runs from the door forward, then sideways to the driveway.
    const turnZ = Math.max(1.5, entryZ - rng.range(1.5, 3));
    paths.push({ x0: doorX - 0.6, x1: doorX + 0.6, z0: turnZ - 0.6, z1: entryZ });
    const dx = driveway.x0 > doorX ? driveway.x0 : driveway.x1;
    paths.push({ x0: Math.min(doorX, dx), x1: Math.max(doorX, dx), z0: turnZ - 0.6, z1: turnZ + 0.6 });
  } else {
    paths.push({ x0: doorX - 0.6, x1: doorX + 0.6, z0: 0, z1: entryZ });
  }

  // ---------- backyard: pool, fence ----------
  const footprintX0 = Math.min(...masses.map((m) => m.rect.x0));
  const footprintX1 = Math.max(...masses.map((m) => m.rect.x1));
  const houseBack = Math.max(...masses.map((m) => m.rect.z1));
  const backDepth = D - houseBack;

  let pool: Rect | undefined;
  if (backDepth >= 10 && rng.chance(style === 'modern' ? 0.45 : 0.28)) {
    const pw = Math.min(rng.range(6, 9), usable - 2);
    const pd = rng.range(3.2, 4.4);
    const x0 = rng.range(SIDE_MARGIN + 0.5, W - SIDE_MARGIN - 0.5 - pw);
    const z0 = houseBack + rng.range(2.5, Math.max(2.6, backDepth - pd - 2.5));
    pool = { x0, x1: x0 + pw, z0, z1: z0 + pd };
  }

  const fences: Fence[] = [];
  if (rng.chance(0.65)) {
    const kind: Fence['kind'] =
      style === 'traditional'
        ? rng.weighted<Fence['kind']>([['picket', 5], ['privacy', 3], ['hedge', 2]])
        : style === 'ranch'
          ? rng.weighted<Fence['kind']>([['privacy', 6], ['picket', 2], ['hedge', 2]])
          : rng.weighted<Fence['kind']>([['hedge', 5], ['privacy', 5]]);
    const color =
      kind === 'picket' ? '#f4f2ec' : kind === 'hedge' ? jitterHex('#4e7a36', rng, 0.06) : style === 'modern' ? '#3a3d40' : jitterHex('#8a6a4a', rng, 0.06);
    const height = kind === 'picket' ? 1.1 : kind === 'hedge' ? rng.range(1.1, 1.6) : 1.8;
    const e = 0.25;
    const fz = clamp(mainRect.z1 - 1.5, mainRect.z0 + 1, D - 3);
    fences.push({
      kind, color, height,
      segments: [
        { x0: e, z0: D - e, x1: W - e, z1: D - e },
        { x0: e, z0: fz, x1: e, z1: D - e },
        { x0: W - e, z0: fz, x1: W - e, z1: D - e },
        { x0: e, z0: fz, x1: footprintX0, z1: fz },
        { x0: footprintX1, z0: fz, x1: W - e, z1: fz },
      ].filter((s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0) > 0.4),
    });
  }

  // ---------- planting ----------
  const trees: Tree[] = [];
  const obstacles: Rect[] = [...masses.map((m) => m.rect), ...paths];
  if (driveway) obstacles.push(driveway);
  if (pool) obstacles.push(pool);
  if (porch) obstacles.push(porch.rect);

  const greenFor = (kind: Tree['kind']) =>
    kind === 'cone' ? jitterHex(rng.pick(CONIFER_GREENS), rng, 0.06) : rng.chance(0.1) ? rng.pick(AUTUMN) : jitterHex(rng.pick(TREE_GREENS), rng, 0.06);

  const placeTrees = (region: Rect, count: number, kinds: [Tree['kind'], number][]) => {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 25; attempt++) {
        const kind = rng.weighted(kinds);
        const scale = kind === 'shrub' ? rng.range(0.8, 1.3) : rng.range(0.8, 1.3);
        const radius = kind === 'shrub' ? 0.7 * scale : 1.8 * scale;
        const x = rng.range(region.x0, region.x1);
        const z = rng.range(region.z0, region.z1);
        if (x < radius * 0.6 || x > W - radius * 0.6 || z > D - radius * 0.6) continue;
        if (obstacles.some((r) => inside(r, x, z, radius))) continue;
        if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < radius + (t.kind === 'shrub' ? 0.7 : 1.8) * t.scale)) continue;
        trees.push({ kind, x, z, scale, rot: rng.range(0, Math.PI * 2), color: greenFor(kind), trunkColor: '#6b4a33' });
        break;
      }
    }
  };
  const treeKinds: [Tree['kind'], number][] = style === 'modern' ? [['round', 5], ['cone', 2]] : [['round', 6], ['cone', 3]];
  placeTrees({ x0: 1, x1: W - 1, z0: 1.5, z1: Math.max(2, frontSetback - 1) }, rng.int(0, 2), treeKinds);
  placeTrees({ x0: 1, x1: W - 1, z0: houseBack + 1.5, z1: D - 1.5 }, rng.int(1, 4), treeKinds);
  placeTrees({ x0: 1, x1: W - 1, z0: 1, z1: D - 1 }, rng.int(2, 6), [['shrub', 1]]);

  // Foundation plantings along the visible front of the main mass.
  if (style !== 'modern' && rng.chance(0.7)) {
    const z = mainRect.z0 - 0.7;
    for (let x = mainRect.x0 + 0.6; x < mainRect.x1 - 0.4; x += rng.range(1.0, 1.5)) {
      if (Math.abs(x - doorX) < 1.2) continue;
      if (porch && x > porch.rect.x0 - 0.5 && x < porch.rect.x1 + 0.5) continue;
      if (masses.some((m) => m.id !== main.id && inside(m.rect, x, z, 0.4))) continue;
      trees.push({ kind: 'shrub', x, z, scale: rng.range(0.55, 0.8), rot: rng.range(0, 6.28), color: jitterHex(rng.pick(TREE_GREENS), rng, 0.08), trunkColor: '#6b4a33' });
    }
  }

  // Street tree in the verge, avoiding the driveway and path.
  const streetTreeXs: number[] = [];
  for (let attempt = 0; attempt < 10 && streetTreeXs.length === 0; attempt++) {
    const x = rng.range(2, W - 2);
    if (driveway && x > driveway.x0 - 2 && x < driveway.x1 + 2) continue;
    if (paths.some((p) => p.z0 <= 0.01 && x > p.x0 - 1.5 && x < p.x1 + 1.5)) continue;
    streetTreeXs.push(x);
  }

  return {
    seed: spec.seed,
    style,
    lot: { width: W, depth: D },
    lawnColor,
    trimColor,
    foundationColor: pal.foundation,
    pavingColor,
    masses,
    openings,
    porch,
    chimney,
    driveway,
    paths,
    fences,
    trees,
    pool,
    streetTreeXs,
    info: {
      style,
      floors: upper ? 2 : Math.max(...masses.map((m) => m.floors)),
      roof: upper ? `flat + ${upper.roof.type}` : main.roof.type,
      shape: wing ? 'L-shape (wing)' : upper ? 'stacked volumes' : 'single volume',
      garage: garageCars ? `${garageCars}-car` : 'none',
      entrance: porch ? porch.kind : 'none',
      pool: pool ? 'yes' : 'no',
      lot: `${W.toFixed(1)} × ${D.toFixed(1)} m`,
    },
  };
}
