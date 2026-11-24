/**
 * Industrial grammar.
 *
 *   warehouse -> clad box (flat or sawtooth roof) + loading docks with trucks + dock canopy + office annex
 *                + truck court + container stacks (sometimes under a travelling gantry crane)
 *                + rooftop / wall exhaust fans (animated)
 *   factory   -> production hall(s) (metal-clad or old brick with sawtooth roof) + boiler house + smokestacks
 *                (animated smoke) + tank farm in a bund + silos fed by conveyors (animated crates)
 *                + pipe racks + cooling towers (spinning fans, steam) + crane yard (moving gantry)
 *                + sometimes a wind turbine (spinning rotor)
 *   both      -> security fence with a gate + gatehouse, floodlights, forklifts, pallets, drums
 */
import { RNG } from '../../core/rng';
import { jitterHex } from '../../core/color';
import { OpeningPlacer, inside, wallsOf } from '../facade/openings';
import { YardPlacer } from '../details/details';
import { summarizeProps } from './house';
import {
  DEFAULT_DETAILS,
  massTop,
  type AnimSpec,
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
  type WindowStyle,
} from '../spec';

export type IndustrialForm = 'warehouse' | 'factory';

export interface IndustrialSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  form?: IndustrialForm;
  details?: DetailOptions;
}

const CLADDING = ['#9fb0bf', '#c9ccd1', '#d9d4c7', '#7f8c99', '#5f7d8c', '#e2ddd0', '#8a9a7f', '#b9b6ad'];
const BRICK = ['#8b4a3a', '#9c5a45', '#7a3f33', '#a86a50'];
const TRUCK = ['#f2f2f0', '#c0392b', '#1f3f73', '#f39c12', '#2e6b4a'];
const CONTAINER = ['#c0392b', '#1f6fb5', '#27ae60', '#f39c12', '#8e44ad', '#7f8c8d', '#d35400', '#16a085', '#2c3e50'];

export function generateIndustrial(spec: IndustrialSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const details = spec.details ?? DEFAULT_DETAILS;
  const W = spec.lotWidth;
  const D = spec.lotDepth;
  const form: IndustrialForm = spec.form ?? rng.weighted<IndustrialForm>([['warehouse', 50], ['factory', 50]]);

  const masses: Mass[] = [];
  const facade = new OpeningPlacer(masses, rng);
  const props: Prop[] = [];
  const lights: Light[] = [];
  const animated: AnimSpec[] = [];
  const paths: Rect[] = [];
  const driveways: Rect[] = [];
  const porches: Porch[] = [];
  const fences: Fence[] = [];
  const info: Record<string, string | number> = { type: 'industrial', form };
  const roofColor = rng.pick(['#7a7f86', '#6b6e72', '#8f9499']);

  const addMass = (kind: MassKind, rect: Rect, floors: number, fh: number, wall: string, roof: Partial<RoofSpec> = {}): Mass => {
    const m: Mass = {
      id: masses.length, kind, rect, baseY: 0.15, floors, floorHeight: fh, wallColor: wall, plinth: false,
      roof: { type: 'flat', pitch: 0.25, axis: 'x', overhang: 0, gableOverhang: 0.3, highSide: 1, color: roofColor, parapet: true, ...roof },
    };
    masses.push(m);
    return m;
  };
  const outsideAll = (x: number, y: number, z: number, self: Mass) =>
    !masses.some((o) => o !== self && inside(o.rect, x, z, -0.01) && y > o.baseY && y < massTop(o) + 0.5);
  /**
   * Cover every exposed wall of a mass with one facade quad per floor: ribbed cladding (optionally with a
   * glazed strip band), or the stone/brick `grid` style for old brick halls.
   */
  const clad = (m: Mass, style: WindowStyle, color: string) => {
    for (const wl of wallsOf(m.rect)) {
      const cx = (wl.ax + wl.bx) / 2;
      const cz = (wl.az + wl.bz) / 2;
      if (!outsideAll(cx + wl.nx * 0.3, m.baseY + m.floorHeight * 0.5, cz + wl.nz * 0.3, m)) continue;
      for (let f = 0; f < m.floors; f++) {
        facade.add({
          kind: 'window', massId: m.id, wall: wl.side, floor: f, cx, cz, nx: wl.nx, nz: wl.nz, width: wl.length - 0.05,
          y0: m.baseY + f * m.floorHeight + 0.02, height: m.floorHeight - 0.04, color: color, frameColor: color, mullions: false,
          style, noSill: true, lit: rng.chance(0.5),
        });
      }
    }
  };
  const flood = (x: number, z: number) => lights.push({ kind: 'lotLight', x, y: 0.05, z, rot: 0 });

  // ---------- site: fence with a gate, gatehouse ----------
  const gateX0 = rng.chance(0.5) ? 4 : W - 14;
  const gate: Rect = { x0: gateX0, x1: gateX0 + 10, z0: 0, z1: 2 };
  driveways.push(gate);
  const e = 0.4;
  fences.push({
    kind: 'iron', color: '#8a8f96', height: 2.2,
    segments: [
      { x0: e, z0: e, x1: gate.x0, z1: e },
      { x0: gate.x1, z0: e, x1: W - e, z1: e },
      { x0: e, z0: e, x1: e, z1: D - e },
      { x0: W - e, z0: e, x1: W - e, z1: D - e },
      { x0: e, z0: D - e, x1: W - e, z1: D - e },
    ].filter((s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0) > 0.5),
  });
  const ghX = gate.x0 < W / 2 ? gate.x1 + 1 : gate.x0 - 5;
  const gatehouse = addMass('roofRoom', { x0: ghX, x1: ghX + 4, z0: 1.5, z1: 5 }, 1, 3, '#e9e6df', { parapet: false, overhang: 0.4 });
  facade.wallWindows(gatehouse, wallsOf(gatehouse.rect)[0], { n: 1, bay: 4, w: 2.4, h: 1.2, sill: 1.0, frame: '#3b3e42', mullions: false, litChance: 0.9 });
  const occupied: Rect[] = [gatehouse.rect, gate];

  if (form === 'warehouse') {
    // ------------------------------------------------------------ warehouse / logistics
    const cladColor = jitterHex(rng.pick(CLADDING), rng, 0.03);
    const fh = rng.range(10, 13);
    const x0 = 4;
    const x1 = W - 4;
    const z1 = D - 4;
    const bd = Math.max(20, Math.min(50, D - 32, rng.range(28, 50)));
    const z0 = z1 - bd;
    const sawtooth = rng.chance(0.4);
    const sheds: Mass[] = [];
    if (sawtooth) {
      const n = Math.max(2, Math.round(bd / rng.range(8, 11)));
      const step = bd / n;
      for (let i = 0; i < n; i++) sheds.push(addMass(i === 0 ? 'main' : 'wing', { x0, x1, z0: z0 + i * step, z1: z0 + (i + 1) * step }, 1, fh, cladColor, { type: 'shed', pitch: 0.32, highSide: 1, overhang: 0.2, gableOverhang: 0.2, parapet: false }));
    } else {
      sheds.push(addMass('main', { x0, x1, z0, z1 }, 1, fh, cladColor));
    }
    for (const s of sheds) clad(s, rng.chance(0.6) ? 'claddingStrip' : 'cladding', cladColor);
    // Glazed north lights on each sawtooth's steep face.
    if (sawtooth) {
      for (const s of sheds.slice(0, -1)) {
        const rise = (s.rect.z1 - s.rect.z0) * 0.32;
        facade.add({ kind: 'window', massId: s.id, wall: 'back', floor: 1, cx: (x0 + x1) / 2, cz: s.rect.z1, nx: 0, nz: 1, width: x1 - x0 - 1, y0: massTop(s) + 0.15, height: rise - 0.3, color: '#2b3a48', frameColor: '#9aa0a6', mullions: false, style: 'ribbon', noSill: true, lit: rng.chance(0.5) });
      }
    }
    const front = sheds[0];
    // Loading docks along the front, with a canopy and trucks backed in.
    const officeW = rng.range(12, 18);
    const officeLeft = gate.x0 < W / 2;
    const dx0 = officeLeft ? x0 + officeW + 3 : x0 + 3;
    const dx1 = officeLeft ? x1 - 3 : x1 - officeW - 3;
    const docks = Math.max(2, Math.floor((dx1 - dx0) / 4.2));
    for (let i = 0; i < docks; i++) {
      const cx = dx0 + (dx1 - dx0) * ((i + 0.5) / docks);
      facade.add({ kind: 'garageDoor', massId: front.id, wall: 'front', floor: 0, cx, cz: z0, nx: 0, nz: -1, width: 3.0, y0: 1.2, height: 3.2, color: rng.pick(['#c9ccd1', '#f2c94c', '#1f3f73']), frameColor: '#2b2b2b', mullions: false });
      if (rng.chance(Math.min(0.9, 1.1 * details.cars))) props.push({ kind: 'truck', x: cx, y: 0.05, z: z0 - 12.4, rot: Math.PI, color: rng.pick(TRUCK), color2: rng.pick(['#f2f2f0', '#e9e6df', '#c9ccd1']), d: 12 });
    }
    porches.push({ kind: 'canopy', rect: { x0: dx0 - 1, x1: dx1 + 1, z0: z0 - 2.5, z1: z0 }, floorY: 0, roofY: 4.9, stepX: (dx0 + dx1) / 2, floorColor: '#9a958c', roofColor: '#5a5d61', postColor: '#5a5d61' });
    // Office annex: two glazed floors at the gate end.
    const ox0 = officeLeft ? x0 : x1 - officeW;
    const office = addMass('upper', { x0: ox0, x1: ox0 + officeW, z0: z0 - rng.range(7, 10), z1: z0 + 0.5 }, 2, 3.6, rng.pick(['#e9e6df', '#3b3e42', '#d6d2c9']), { overhang: 0.3, parapet: false });
    office.baseY = 0.15;
    for (const wl of wallsOf(office.rect)) {
      if (!outsideAll((wl.ax + wl.bx) / 2 + wl.nx * 0.3, 2, (wl.az + wl.bz) / 2 + wl.nz * 0.3, office)) continue;
      for (let f = 0; f < 2; f++) facade.add({ kind: 'window', massId: office.id, wall: wl.side, floor: f, cx: (wl.ax + wl.bx) / 2, cz: (wl.az + wl.bz) / 2, nx: wl.nx, nz: wl.nz, width: wl.length - 0.6, y0: 0.15 + f * 3.6, height: 3.6, color: '#2b3a48', frameColor: '#3a3d40', mullions: false, style: 'curtain', lit: rng.chance(0.6) });
    }
    driveways.push({ x0: 1.5, x1: W - 1.5, z0: 2, z1: z0 });
    occupied.push(...masses.map((m) => m.rect), { x0: dx0 - 1, x1: dx1 + 1, z0: z0 - 15, z1: z0 });
    // Container stacks in the yard, sometimes under a gantry crane.
    const yard: Rect = officeLeft ? { x0: W - 20, x1: W - 3, z0: 6, z1: z0 - 16 } : { x0: 3, x1: 20, z0: 6, z1: z0 - 16 };
    if (yard.z1 - yard.z0 > 8) {
      const withCrane = rng.chance(0.4) && yard.z1 - yard.z0 > 12;
      for (let x = yard.x0 + 1.6; x < yard.x1 - 1.4; x += 2.9) {
        for (let z = yard.z0 + 3.5; z < yard.z1 - 3; z += 6.8) {
          const levels = rng.int(1, 3);
          for (let l = 0; l < levels; l++) props.push({ kind: 'container', x, y: 0.05 + l * 2.6, z, rot: 0, color: rng.pick(CONTAINER), d: 6.1 });
        }
      }
      if (withCrane) {
        const span = yard.x1 - yard.x0 + 1;
        const len = yard.z1 - yard.z0;
        const cxm = (yard.x0 + yard.x1) / 2;
        props.push({ kind: 'craneRails', x: cxm, y: 0.05, z: (yard.z0 + yard.z1) / 2, rot: 0, color: '#c0a030', w: span, d: len, h: 11 });
        animated.push({ kind: 'shuttle', part: 'gantry', x: cxm, y: 11.05, z: yard.z0 + 2, rot: 0, dx: 0, dy: 0, dz: len - 4, speed: rng.range(0.03, 0.05), phase: rng.next(), loop: false, size: span + 0.6, color: '#ffffff' });
      }
      occupied.push(yard);
    }
    // Exhaust fans spinning on the roof and high on the side walls.
    const top = massTop(front);
    for (let i = rng.int(3, 7); i > 0; i--) {
      const s = rng.pick(sheds);
      animated.push({ kind: 'fan', x: rng.range(x0 + 4, x1 - 4), y: massTop(s) + (sawtooth ? 0.4 : 0.35), z: rng.range(s.rect.z0 + 2, s.rect.z1 - 2), radius: 0.9, speed: rng.range(3, 7) });
    }
    for (const side of [-1, 1]) {
      const x = side < 0 ? x0 : x1;
      for (let z = z0 + 6; z < z1 - 4; z += rng.range(9, 14)) animated.push({ kind: 'fan', x: x + side * 0.15, y: top - 2.2, z, radius: 0.8, speed: rng.range(4, 8), nx: side, nz: 0 });
    }
    info.docks = docks;
    info.roof = sawtooth ? 'sawtooth' : 'flat';
  } else {
    // ------------------------------------------------------------ factory
    const brick = rng.chance(0.35);
    const wall = brick ? jitterHex(rng.pick(BRICK), rng, 0.04) : jitterHex(rng.pick(CLADDING), rng, 0.03);
    const hx0 = 4;
    const hw = Math.min(W * rng.range(0.5, 0.62), W - 30);
    const hz1 = D - 4;
    const hd = Math.min(D * rng.range(0.42, 0.55), D - 26);
    const hz0 = hz1 - hd;
    const fh = brick ? 6 : rng.range(9, 12);
    const floors = brick ? 2 : 1;
    const halls: Mass[] = [];
    if (brick || rng.chance(0.4)) {
      // sawtooth production hall
      const n = Math.max(2, Math.round(hd / rng.range(8, 10)));
      const step = hd / n;
      for (let i = 0; i < n; i++) halls.push(addMass(i === 0 ? 'main' : 'wing', { x0: hx0, x1: hx0 + hw, z0: hz0 + i * step, z1: hz0 + (i + 1) * step }, floors, fh, wall, { type: 'shed', pitch: 0.35, highSide: 1, overhang: 0.2, gableOverhang: 0.2, parapet: false }));
      for (const h of halls.slice(0, -1)) {
        const rise = (h.rect.z1 - h.rect.z0) * 0.35;
        facade.add({ kind: 'window', massId: h.id, wall: 'back', floor: floors, cx: hx0 + hw / 2, cz: h.rect.z1, nx: 0, nz: 1, width: hw - 1, y0: massTop(h) + 0.15, height: rise - 0.3, color: '#2b3a48', frameColor: '#9aa0a6', mullions: false, style: 'ribbon', noSill: true, lit: rng.chance(0.6) });
      }
    } else {
      halls.push(addMass('main', { x0: hx0, x1: hx0 + hw, z0: hz0, z1: hz1 }, floors, fh, wall, { type: 'gable', axis: 'x', pitch: 0.18, overhang: 0.4, parapet: false }));
    }
    for (const h of halls) clad(h, brick ? 'grid' : 'claddingStrip', wall);
    const hall = halls[0];
    // Loading doors on the front, a couple of trucks.
    for (let i = 0; i < 3; i++) {
      const cx = hx0 + hw * (0.2 + i * 0.3);
      facade.add({ kind: 'garageDoor', massId: hall.id, wall: 'front', floor: 0, cx, cz: hz0, nx: 0, nz: -1, width: 4.0, y0: 0.15, height: 4.5, color: rng.pick(['#c9ccd1', '#f2c94c', '#5a5f66']), frameColor: '#2b2b2b', mullions: false });
      if (rng.chance(Math.min(0.9, 0.8 * details.cars))) props.push({ kind: 'truck', x: cx, y: 0.05, z: hz0 - 13, rot: Math.PI, color: rng.pick(TRUCK), color2: rng.pick(['#f2f2f0', '#c9ccd1']), d: 12 });
    }
    // Boiler house + smokestacks with smoke.
    const bx1 = hx0 + hw;
    const boiler = addMass('upper', { x0: bx1 - 10, x1: bx1, z0: hz0 - 8, z1: hz0 + 0.5 }, 1, 8, brick ? wall : jitterHex('#9a958c', rng, 0.04), { parapet: true });
    clad(boiler, brick ? 'grid' : 'cladding', boiler.wallColor);
    const stacks = rng.int(1, 3);
    for (let i = 0; i < stacks; i++) {
      const sh = rng.range(25, 55);
      const sr = rng.range(1.1, 1.8);
      const sx = bx1 + 3 + i * 4.5;
      const sz = hz0 - 4;
      props.push({ kind: 'smokestack', x: sx, y: 0.05, z: sz, rot: 0, color: brick ? '#8b4a3a' : '#c9c4b8', color2: sh > 40 ? '#c0392b' : '#5a5d61', w: sr, h: sh });
      animated.push({ kind: 'smoke', x: sx, y: sh + 0.3, z: sz, radius: sr * 0.8, amount: rng.int(28, 44) });
      if (sh > 40) lights.push({ kind: 'aviation', x: sx, y: sh + 0.05, z: sz, rot: 0 });
      occupied.push({ x0: sx - sr - 1, x1: sx + sr + 1, z0: sz - sr - 1, z1: sz + sr + 1 });
    }
    occupied.push(...masses.map((m) => m.rect), { x0: hx0, x1: hx0 + hw, z0: hz0 - 15, z1: hz0 });
    const placer = new YardPlacer(rng, W, D, occupied);
    const right: Rect = { x0: hx0 + hw + 3, x1: W - 3, z0: 3, z1: D - 3 };
    // Crane yard first (it needs the most room), with a travelling gantry over stock.
    if (rng.chance(0.5)) {
      const span = rng.range(12, 16);
      const len = rng.range(20, 28);
      const s = placer.place({ x0: 3, x1: W - 3, z0: 3, z1: D - 3 }, span + 1.5, len, [0], 1);
      if (s) {
        props.push({ kind: 'craneRails', x: s.x, y: 0.05, z: s.z, rot: 0, color: '#c0a030', w: span, d: len, h: 9 });
        animated.push({ kind: 'shuttle', part: 'gantry', x: s.x, y: 9.05, z: s.z - len / 2 + 2, rot: 0, dx: 0, dy: 0, dz: len - 4, speed: rng.range(0.03, 0.05), phase: rng.next(), loop: false, size: span + 0.6, color: '#ffffff' });
        for (let z = s.z - len / 2 + 3; z < s.z + len / 2 - 2; z += 3) {
          props.push(rng.chance(0.5)
            ? { kind: 'pallets', x: s.x + rng.range(-span / 3, span / 3), y: 0.05, z, rot: 0, color: rng.pick(['#e9e6df', '#9aa0a6', '#5a7d9a']), h: rng.int(1, 3) }
            : { kind: 'drums', x: s.x + rng.range(-span / 3, span / 3), y: 0.05, z, rot: 0, color: '#1f6fb5', color2: '#c0392b', w: rng.int(3, 6) });
        }
      }
    }
    // Tank farm inside a low bund wall, piped to the hall.
    const tanks: Rect[] = [];
    for (let i = rng.int(2, 4); i > 0; i--) {
      const r = rng.range(3, 6);
      const s = placer.place({ ...right, z0: (right.z0 + right.z1) / 2 }, 2 * r + 1, 2 * r + 1, [0], 0.8);
      if (!s) break;
      props.push({ kind: 'storageTank', x: s.x, y: 0.05, z: s.z, rot: 0, color: rng.pick(['#e9e6df', '#c9ccd1', '#d9d4c7']), color2: rng.pick(['#c0392b', '#1f6fb5', '#27ae60']), w: r, h: rng.range(6, 12) });
      tanks.push(s.rect);
    }
    if (tanks.length) {
      const bund = { x0: Math.min(...tanks.map((t) => t.x0)) - 1, x1: Math.max(...tanks.map((t) => t.x1)) + 1, z0: Math.min(...tanks.map((t) => t.z0)) - 1, z1: Math.max(...tanks.map((t) => t.z1)) + 1 };
      fences.push({ kind: 'privacy', color: '#a9a49a', height: 1.0, segments: [
        { x0: bund.x0, z0: bund.z0, x1: bund.x1, z1: bund.z0 }, { x0: bund.x0, z0: bund.z1, x1: bund.x1, z1: bund.z1 },
        { x0: bund.x0, z0: bund.z0, x1: bund.x0, z1: bund.z1 }, { x0: bund.x1, z0: bund.z0, x1: bund.x1, z1: bund.z1 },
      ] });
      // Pipe rack from the tank farm to the hall.
      const pz = (bund.z0 + bund.z1) / 2;
      const len = bund.x0 - (hx0 + hw) - 0.5;
      if (len > 3 && pz > hz0 + 2 && pz < hz1 - 2) props.push({ kind: 'pipeRack', x: hx0 + hw + len / 2, y: 0.05, z: pz, rot: 0, color: rng.pick(['#c0392b', '#f2c94c', '#1f6fb5']), color2: '#5a5f66', w: len, h: rng.range(4, 6) });
    }
    // Silos with conveyors carrying crates up to them.
    for (let i = rng.int(1, 3); i > 0; i--) {
      const r = rng.range(2.5, 3.5);
      const sh = rng.range(14, 24);
      const len = rng.range(10, 14);
      const s = placer.place({ ...right, z1: (right.z0 + right.z1) / 2 + 6 }, 2 * r + 2, 2 * r + len + 2, [0], 0.6);
      if (!s) break;
      const sz = s.rect.z1 - r - 1;
      props.push({ kind: 'silo', x: s.x, y: 0.05, z: sz, rot: 0, color: rng.pick(['#d9d4c7', '#c9ccd1', '#e9e6df']), color2: '#9aa0a6', w: r, h: sh });
      // conveyor rises from the front towards the silo top (local -z -> world +z)
      const oz = sz - r - len;
      const rise = sh - 1.2;
      props.push({ kind: 'conveyor', x: s.x, y: 0.05, z: oz, rot: Math.PI, color: '#f2c94c', w: len, h: rise });
      const crates = Math.max(3, Math.round(len / 2.2));
      const speed = 1.1 / Math.hypot(len, rise); // ~1.1 m/s along the belt
      for (let k = 0; k < crates; k++) {
        animated.push({ kind: 'shuttle', part: 'crate', x: s.x, y: 1.1, z: oz, rot: 0, dx: 0, dy: rise, dz: len, speed, phase: k / crates, loop: true, size: 0.6, color: rng.pick(['#b5895a', '#8a6a4a', '#c9a648']) });
      }
    }
    // Cooling towers on the hall roof: spinning fans + steam.
    for (let i = rng.int(1, 3); i > 0; i--) {
      const h = rng.pick(halls);
      const x = rng.range(hx0 + 3, hx0 + hw - 3);
      const z = (h.rect.z0 + h.rect.z1) / 2;
      const y = massTop(h) + (h.roof.type === 'shed' ? (h.rect.z1 - h.rect.z0) * 0.35 * 0.5 + 0.3 : h.roof.type === 'gable' ? (h.rect.z1 - h.rect.z0) * 0.5 * 0.18 + 0.2 : 0.1);
      props.push({ kind: 'coolingTower', x, y, z, rot: 0, color: '#d9dbdc', color2: '#9aa0a6' });
      animated.push({ kind: 'fan', x, y: y + 2.35, z, radius: 1.05, speed: rng.range(3, 6) });
      animated.push({ kind: 'smoke', x, y: y + 2.6, z, radius: 1.3, amount: 12, steam: true });
    }
    // Sometimes a wind turbine in a back corner.
    if (rng.chance(0.25)) {
      const s = placer.place({ x0: 3, x1: W - 3, z0: D / 2, z1: D - 3 }, 6, 6, [0], 1);
      if (s) {
        const h = rng.range(28, 40);
        const rot = rng.range(-0.6, 0.6);
        props.push({ kind: 'turbineTower', x: s.x, y: 0.05, z: s.z, rot, color: '#eeeeea', h });
        animated.push({ kind: 'rotor', x: s.x - Math.sin(rot) * 1.7, y: h + 0.55, z: s.z - Math.cos(rot) * 1.7, radius: rng.range(9, 12), rot, speed: rng.range(0.9, 1.5) });
        lights.push({ kind: 'aviation', x: s.x, y: h + 1.2, z: s.z + 0.6, rot: 0 });
      }
    }
    driveways.push({ x0: 1.5, x1: W - 1.5, z0: 2, z1: hz0 });
    info.halls = halls.length;
    info.stacks = stacks;
    info.style = brick ? 'old brick, sawtooth' : 'metal-clad';
  }

  // ---------- yard life: forklifts, pallets, drums, floodlights ----------
  const yardPlacer = new YardPlacer(rng, W, D, [...occupied, ...masses.map((m) => m.rect)]);
  const yardRegion: Rect = { x0: 2, x1: W - 2, z0: 6, z1: D - 2 };
  for (let i = rng.int(1, 3); i > 0; i--) {
    const s = yardPlacer.place(yardRegion, 1.4, 3.4, [0, Math.PI / 2, Math.PI, -Math.PI / 2], 0.5);
    if (s) props.push({ kind: 'forklift', x: s.x, y: 0.05, z: s.z, rot: s.rot, color: rng.pick(['#f2c94c', '#e67e22', '#c0392b']) });
  }
  for (let i = rng.int(2, 5); i > 0; i--) {
    const s = yardPlacer.place(yardRegion, 1.4, 1.2, [0], 0.3);
    if (s) props.push(rng.chance(0.6)
      ? { kind: 'pallets', x: s.x, y: 0.05, z: s.z, rot: 0, color: rng.pick(['#e9e6df', '#9aa0a6', '#c9a648']), h: rng.int(1, 3) }
      : { kind: 'drums', x: s.x, y: 0.05, z: s.z, rot: 0, color: '#1f6fb5', color2: '#c0392b', w: rng.int(3, 6) });
  }
  for (let x = 6; x < W - 4; x += 28) flood(x, 3);
  flood(W - 3, D - 3);
  flood(3, D - 3);

  info.animated = animated.length;
  info.details = summarizeProps(props);
  info.lot = `${W.toFixed(1)} × ${D.toFixed(1)} m`;
  return {
    seed: spec.seed,
    style: form,
    lot: { width: W, depth: D },
    lawnColor: jitterHex('#8f8b84', rng, 0.04),
    trimColor: '#5a5f66',
    foundationColor: '#8f8a83',
    pavingColor: jitterHex('#5a5d61', rng, 0.04),
    masses,
    openings: facade.openings,
    porches,
    chimneys: [],
    driveways,
    paths,
    fences,
    trees: [],
    balconies: [],
    props,
    lights,
    animated,
    streetTreeXs: [],
    paved: true,
    height: Math.max(...props.filter((p) => p.kind === 'smokestack' || p.kind === 'turbineTower').map((p) => (p.h ?? 0) + 12), 0) || undefined,
    info,
  };
}
