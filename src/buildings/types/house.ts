/**
 * Suburban house grammar.
 *
 *   Lot      -> Setbacks + House + Driveway + Paths + Yard
 *   House    -> Main mass [+ Wing (L-shape)] [+ Garage] [+ Upper volume (modern)]
 *   Mass     -> Floors x Walls -> Bays -> Window | Door | GarageDoor
 *   Mass     -> Roof (gable | hip | shed | flat) [+ attic window] [+ chimney]
 *   Entrance -> Porch (posts + shed roof) | Canopy (modern)
 *   Yard     -> Lawn + Fence/Hedge + Trees + Shrubs [+ Pool] + Props (see details/details.ts)
 *
 * Three style families pick different rule weights: traditional, ranch, modern.
 */
import { RNG } from '../../core/rng';
import { jitterHex, lightness } from '../../core/color';
import { HOUSE_PALETTES, MODERN_ACCENTS_DARK, MODERN_ACCENTS_LIGHT, TREE_GREENS, type HouseStyle } from '../styles/palettes';
import { OpeningPlacer, inside, wallsOf, wallOf } from '../facade/openings';
import {
  YardPlacer,
  addBackLight,
  addBins,
  addCar,
  addDoorLights,
  addGarageLights,
  addGroundAC,
  addMailbox,
  addPathLights,
  addSatelliteDish,
  addSolarPanels,
  addWallMailbox,
  addWindowShades,
  addSplitACs,
  addWaterTanks,
  addYardProps,
  type DetailContext,
} from '../details/details';
import { placeTrees } from '../details/planting';
import {
  DEFAULT_DETAILS,
  massTop,
  roofRise,
  stairRun,
  type Axis,
  type DetailOptions,
  type Fence,
  type HouseModel,
  type Light,
  type Mass,
  type MassKind,
  type Porch,
  type Prop,
  type Rect,
  type RoofSpec,
  type RoofType,
  type Tree,
} from '../spec';

export interface HouseSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  /** Force a style; otherwise chosen by weighted random. */
  style?: HouseStyle;
  details?: DetailOptions;
}

const SIDE_MARGIN = 1.8;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function generateHouse(spec: HouseSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const details = spec.details ?? DEFAULT_DETAILS;
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
    type, pitch, axis, overhang, gableOverhang: 0.3, highSide: 1, color: roofColor, parapet: false, ...extra,
  });

  const masses: Mass[] = [];
  const addMass = (kind: MassKind, rect: Rect, baseY: number, floors: number, floorHeight: number, roof: RoofSpec, color = wallColor, hasPlinth = true): Mass => {
    const m: Mass = { id: masses.length, kind, rect, baseY, floors, floorHeight, wallColor: color, roof, plinth: hasPlinth, floorBands: style !== 'modern' };
    masses.push(m);
    return m;
  };

  // ---------- main mass ----------
  const mainFloors =
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
    wing = addMass('wing', { x0, x1: x0 + ww, z0, z1 }, plinth, floors, fh, mkRoof(roofType === 'hip' ? 'hip' : 'gable', 'z'));
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
    garage.floorBands = false;
  }

  // ---------- openings ----------
  const facade = new OpeningPlacer(masses, rng);
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
  const shutterColor = style === 'traditional' && rng.chance(0.45) ? rng.pick(pal.shutters) : undefined;
  const modernSparseSides = style === 'modern' && rng.chance(0.6);
  const litChance = 0.35;

  for (const m of masses) {
    if (m.kind === 'garage') continue;
    for (const wl of wallsOf(m.rect)) {
      if (wl.length < 1.8) continue;
      const isSide = wl.side === 'left' || wl.side === 'right';
      if (modernSparseSides && isSide) {
        const slit = rng.chance(0.5);
        facade.wallWindows(m, wl, {
          n: 1, bay: wl.length, w: slit ? 0.6 : win.w, h: slit ? m.floorHeight - 0.6 : win.h, sill: slit ? 0.3 : win.sill,
          frame: trimColor, mullions: false, litChance,
        });
      } else {
        facade.wallWindows(m, wl, { bay: win.bay, w: win.w, h: win.h, sill: win.sill, frame: trimColor, mullions: win.mullions, shutter: shutterColor, litChance });
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
          if (!facade.visible(wl, cx, cz, 0.7, y0 + h / 2, m.id)) continue;
          facade.add({ kind: 'window', massId: m.id, wall: wl.side, floor: m.floors, cx, cz, nx: wl.nx, nz: wl.nz, width: 0.7, y0, height: h, color: '#2b3a48', frameColor: trimColor, mullions: win.mullions, lit: rng.chance(0.2) });
        }
      }
    }
  }

  // Front door: the most central visible ground-floor front window of the main mass.
  const frontSlots = facade.openings.filter((o) => o.massId === main.id && o.wall === 'front' && o.floor === 0);
  let doorX = (mainRect.x0 + mainRect.x1) / 2;
  let door = frontSlots[0];
  if (frontSlots.length) {
    const mid = frontSlots.reduce((s, o) => s + o.cx, 0) / frontSlots.length;
    door = frontSlots.reduce((best, o) => (Math.abs(o.cx - mid) < Math.abs(best.cx - mid) ? o : best));
    facade.toDoor(door, style === 'modern' ? rng.range(1.1, 1.5) : 1.0, main.baseY, style === 'modern' ? 2.4 : 2.15, doorColor);
    doorX = door.cx;
  }

  // Garage doors + an optional side window.
  const garageDoors = [];
  if (garage) {
    const gr = garage.rect;
    const gwid = gr.x1 - gr.x0;
    const doors = garageCars === 2 && rng.chance(0.5) ? [0.25, 0.75].map((t) => ({ t, w: Math.min(2.5, gwid / 2 - 0.6) })) : [{ t: 0.5, w: Math.min(gwid - 0.8, 5.0) }];
    for (const d of doors) {
      garageDoors.push(
        facade.add({
          kind: 'garageDoor', massId: garage.id, wall: 'front', floor: 0, cx: gr.x0 + gwid * d.t, cz: gr.z0, nx: 0, nz: -1,
          width: d.w, y0: garage.baseY, height: 2.2, color: garageDoorColor, frameColor: trimColor, mullions: false,
        }),
      );
    }
    const outer = wallOf(gr, garageSide < 0 ? 'left' : 'right');
    if (rng.chance(0.5)) {
      const cx = outer.ax;
      const cz = (gr.z0 + gr.z1) / 2;
      if (facade.visible(outer, cx, cz, 1, 1.5, garage.id))
        facade.add({ kind: 'window', massId: garage.id, wall: outer.side, floor: 0, cx, cz, nx: outer.nx, nz: outer.nz, width: 1.0, y0: 1.1, height: 0.9, color: '#2b3a48', frameColor: trimColor, mullions: false });
    }
  }

  // ---------- entrance: porch / canopy ----------
  const porches: Porch[] = [];
  const wantsPorch = style === 'traditional' ? rng.chance(0.7) : style === 'ranch' ? rng.chance(0.5) : rng.chance(0.65);
  if (wantsPorch && door) {
    // Free stretch of the main front wall (not hidden by the wing).
    let fx0 = mainRect.x0;
    let fx1 = mainRect.x1;
    if (wing && wing.rect.z0 < mainRect.z0) {
      if (wing.rect.x0 <= mainRect.x0 + 0.01) fx0 = wing.rect.x1;
      else fx1 = wing.rect.x0;
    }
    const full = style !== 'modern' && rng.chance(0.35);
    const half = rng.range(1.4, 2.2);
    const depth = style === 'modern' ? rng.range(1.4, 2.2) : rng.range(1.8, 2.5);
    const top1 = massTop(main);
    porches.push({
      kind: style === 'modern' ? 'canopy' : 'porch',
      rect: { x0: full ? fx0 : Math.max(fx0, doorX - half), x1: full ? fx1 : Math.min(fx1, doorX + half), z0: mainRect.z0 - depth, z1: mainRect.z0 },
      floorY: style === 'modern' ? 0.12 : plinth,
      roofY: style === 'modern' ? plinth + 2.65 : main.floors >= 2 || upper ? plinth + fh - 0.1 : Math.min(top1 - 0.15, plinth + fh - 0.1),
      stepX: doorX,
      floorColor: style === 'modern' ? pavingColor : rng.chance(0.5) ? '#b9b4aa' : '#9b7a58',
      roofColor,
      postColor: trimColor,
    });
  } else if (door && plinth > 0.25) {
    // No porch: just a small landing with steps.
    porches.push({ kind: 'hood', rect: { x0: doorX - 0.9, x1: doorX + 0.9, z0: mainRect.z0 - 1.0, z1: mainRect.z0 }, floorY: plinth, roofY: plinth + 2.4, stepX: doorX, floorColor: '#b9b4aa', roofColor, postColor: trimColor });
  }
  const porch = porches[0];

  // ---------- window sunshades: concrete chajjas (modern) or fabric awnings ----------
  const shadeChance = style === 'modern' ? 0.35 : style === 'ranch' ? 0.25 : 0.18;
  if (rng.chance(shadeChance)) {
    const kind = style === 'modern' || (style === 'ranch' && rng.chance(0.5)) ? 'slab' : 'awning';
    const color = kind === 'slab' ? rng.pick(['#2f3236', '#d8d6d0', '#bdb9b0']) : rng.pick(['#2e6b4a', '#8e1c1c', '#1f3f73', '#c9772b', '#5a5f66']);
    addWindowShades(facade, masses.filter((m) => m.kind !== 'garage').map((m) => m.id), kind, color);
    // Windows sheltered by the porch roof don't need one.
    if (porch && porch.kind === 'porch') {
      for (const o of facade.openings) {
        if (o.wall === 'front' && o.floor === 0 && o.cx > porch.rect.x0 - 0.8 && o.cx < porch.rect.x1 + 0.8) o.shade = undefined;
      }
    }
  }

  // ---------- chimney (through the main roof) ----------
  const chimneys: HouseModel['chimneys'] = [];
  if ((main.roof.type === 'gable' || main.roof.type === 'hip') && rng.chance(style === 'traditional' ? 0.55 : 0.3)) {
    const top = massTop(main);
    const rise = roofRise(main);
    const along = rng.range(0.2, 0.8);
    const across = rng.range(-0.6, 0.6);
    const x = main.roof.axis === 'x' ? mainRect.x0 + mw * along : (mainRect.x0 + mainRect.x1) / 2 + across;
    const z = main.roof.axis === 'x' ? (mainRect.z0 + mainRect.z1) / 2 + across : mainRect.z0 + md * along;
    chimneys.push({ x, z, w: 0.7, d: 0.9, y0: top - 0.5, y1: top + rise + rng.range(0.6, 1.1), color: rng.pick(['#8a4b3a', '#7a4234', '#9a9590']) });
  }

  // ---------- driveway & paths ----------
  const paths: Rect[] = [];
  const driveways: Rect[] = [];
  if (garage) {
    const gr = garage.rect;
    driveways.push({ x0: gr.x0 + 0.2, x1: gr.x1 - 0.2, z0: 0, z1: gr.z0 });
  }
  const driveway = driveways[0];
  const entryZ = porch ? porch.rect.z0 - stairRun(porch.floorY) : mainRect.z0;
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
    // Along the front yard tall fences/hedges step down so they don't hide the house.
    const frontHeight = kind === 'picket' ? height : kind === 'hedge' ? 0.9 : 1.1;
    const e = kind === 'hedge' ? 0.5 : 0.25; // hedges are thick: keep them inside the lot
    // Where the side fences step up to full height: roughly the front line of the house.
    const frontLine = clamp(Math.min(...masses.map((m) => m.rect.z0)) + 1, 2, D - 3);
    const segments: Fence['segments'] = [
      // Side fences run the full depth of the lot, from the street to the back.
      { x0: e, z0: e, x1: e, z1: frontLine, height: frontHeight },
      { x0: e, z0: frontLine, x1: e, z1: D - e },
      { x0: W - e, z0: e, x1: W - e, z1: frontLine, height: frontHeight },
      { x0: W - e, z0: frontLine, x1: W - e, z1: D - e },
      // Back fence.
      { x0: e, z0: D - e, x1: W - e, z1: D - e },
    ];
    // Optional low fence along the street, with openings for the driveway and the path.
    if (kind !== 'privacy' && rng.chance(0.5)) {
      const gaps = [
        ...driveways.map((d) => [d.x0 - 0.3, d.x1 + 0.3]),
        ...paths.filter((p) => p.z0 < 0.5).map((p) => [p.x0 - 0.4, p.x1 + 0.4]),
      ].sort((a, b) => a[0] - b[0]);
      let x = e;
      for (const [g0, g1] of gaps) {
        if (g0 > x) segments.push({ x0: x, z0: e, x1: g0, z1: e, height: frontHeight });
        x = Math.max(x, g1);
      }
      if (x < W - e) segments.push({ x0: x, z0: e, x1: W - e, z1: e, height: frontHeight });
    }
    fences.push({ kind, color, height, segments: segments.filter((s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0) > 0.4) });
  }

  // ---------- details: props, services, lights ----------
  const obstacles: Rect[] = [...masses.map((m) => m.rect), ...paths, ...driveways, ...porches.map((p) => p.rect)];
  if (pool) obstacles.push({ x0: pool.x0 - 2.1, x1: pool.x1 + 0.5, z0: pool.z0 - 0.5, z1: pool.z1 + 0.5 });
  const props: Prop[] = [];
  const lights: Light[] = [];
  const ctx: DetailContext = { rng, W, D, masses, facade, placer: new YardPlacer(rng, W, D, obstacles), props, lights, details };
  const backyard: Rect = { x0: 0.9, x1: W - 0.9, z0: houseBack + 0.8, z1: D - 0.9 };

  // Services first: they hug the house.
  addGroundAC(ctx, main);
  addSplitACs(ctx, rng.chance(0.3) ? rng.int(1, 3) : 0);
  addWaterTanks(ctx, details.waterTanks, { x0: 0.9, x1: W - 0.9, z0: houseBack + 0.5, z1: Math.min(D - 1, houseBack + 4) });
  addSolarPanels(ctx, style === 'modern' ? 0.5 : 0.2);
  addSatelliteDish(ctx, upper ?? main, 0.15);

  // Backyard life.
  addYardProps(ctx, backyard, {
    patioSet: 0.4, swing: 0.25, doghouse: 0.25, bbq: 0.3, trampoline: 0.12, slide: 0.1, gardenBed: 0.25, clothesline: 0.15, bench: 0.1,
  }, 5);

  // Street side.
  if (driveway) {
    addCar(ctx, driveway);
    addMailbox(ctx, driveway.x0 < doorX ? driveway.x0 - 0.1 : driveway.x1 + 0.1, 0.85);
    if (garage) {
      const binX = garageSide < 0 ? garage.rect.x0 - 0.9 : garage.rect.x1 + 0.9;
      addBins(ctx, binX, garage.rect.z0 + 0.6, 0.45);
    }
  } else {
    addMailbox(ctx, doorX, 0.85);
  }
  // No kerbside mailbox? Most of those houses get a letterbox on the wall by the door instead.
  if (door && !props.some((p) => p.kind === 'mailbox')) addWallMailbox(ctx, door, rng.chance(0.5) ? 1 : -1, 0.7);

  // Lights.
  if (door) addDoorLights(ctx, door, porch);
  addGarageLights(ctx, garageDoors);
  addBackLight(ctx, main, 0.6);
  const streetPath = paths.find((p) => p.z0 <= 0.01);
  if (streetPath) addPathLights(ctx, streetPath, 0.3, 0.25);

  // ---------- planting (last, so it avoids everything above) ----------
  const trees: Tree[] = [];
  const lot = { W, D };
  const treeKinds: [Tree['kind'], number][] = style === 'modern' ? [['round', 5], ['cone', 2]] : [['round', 6], ['cone', 3]];
  placeTrees(rng, trees, obstacles, lot, { x0: 1, x1: W - 1, z0: 1.5, z1: Math.max(2, frontSetback - 1) }, rng.int(0, 2), treeKinds);
  placeTrees(rng, trees, obstacles, lot, { x0: 1, x1: W - 1, z0: houseBack + 1.5, z1: D - 1.5 }, rng.int(1, 4), treeKinds);
  placeTrees(rng, trees, obstacles, lot, { x0: 1, x1: W - 1, z0: 1, z1: D - 1 }, rng.int(2, 6), [['shrub', 1]]);

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
    if (driveways.some((d) => x > d.x0 - 2 && x < d.x1 + 2)) continue;
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
    openings: facade.openings,
    porches,
    chimneys,
    driveways,
    paths,
    fences,
    trees,
    pool,
    balconies: [],
    props,
    lights,
    streetTreeXs,
    info: {
      type: 'suburban house',
      style,
      floors: upper ? 2 : Math.max(...masses.map((m) => m.floors)),
      roof: upper ? `flat + ${upper.roof.type}` : main.roof.type,
      shape: wing ? 'L-shape (wing)' : upper ? 'stacked volumes' : 'single volume',
      garage: garageCars ? `${garageCars}-car` : 'none',
      entrance: porch ? porch.kind : 'none',
      pool: pool ? 'yes' : 'no',
      details: summarizeProps(props),
      lot: `${W.toFixed(1)} × ${D.toFixed(1)} m`,
    },
  };
}

export function summarizeProps(props: Prop[]): string {
  const counts = new Map<string, number>();
  for (const p of props) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  return [...counts].map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(', ') || '—';
}
