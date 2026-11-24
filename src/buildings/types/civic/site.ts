/**
 * Shared toolkit for civic generators: one Site per lot collects masses, facade openings, props, lights,
 * courts, parking etc. and turns them into a HouseModel at the end.
 */
import type { RNG } from '../../../core/rng';
import { jitterHex } from '../../../core/color';
import { OpeningPlacer, wallOf, wallsOf, type Wall } from '../../facade/openings';
import { YardPlacer } from '../../details/details';
import { placeTrees } from '../../details/planting';
import { summarizeProps } from '../house';
import type {
  AnimSpec,
  Balcony,
  Court,
  DetailOptions,
  Fence,
  HouseModel,
  Light,
  Mass,
  MassKind,
  Bowl,
  Opening,
  ParkingLot,
  Plaza,
  PolyMass,
  Porch,
  Prop,
  Rect,
  RoofSpec,
  Tree,
  WallSide,
  Walkway,
  WaterBody,
  WindowStyle,
} from '../../spec';

const overlaps = (a: Rect, b: Rect, pad = 0) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;

export const CAR_COLORS = ['#f2f2f0', '#c9ccd1', '#1e1f22', '#8e1c1c', '#1f3f73', '#5a5f66', '#2d4f3c', '#b8b2a2'];

export interface WindowOpts {
  bay: number;
  w: number;
  h: number;
  sill: number;
  style: WindowStyle;
  frame: string;
  sides?: WallSide[];
  floors?: number[];
  litChance?: number;
  noSill?: boolean;
}

export class Site {
  readonly masses: Mass[] = [];
  readonly facade: OpeningPlacer;
  readonly props: Prop[] = [];
  readonly lights: Light[] = [];
  readonly animated: AnimSpec[] = [];
  readonly paths: Rect[] = [];
  readonly driveways: Rect[] = [];
  readonly parkingLots: ParkingLot[] = [];
  readonly courts: Court[] = [];
  readonly porches: Porch[] = [];
  readonly fences: Fence[] = [];
  readonly trees: Tree[] = [];
  readonly balconies: Balcony[] = [];
  readonly walks: Walkway[] = [];
  readonly water: WaterBody[] = [];
  readonly plazas: Plaza[] = [];
  readonly bowls: Bowl[] = [];
  readonly polyMasses: PolyMass[] = [];
  /** Doors (and extra targets) that linkPaths() joins to the path network. */
  readonly entrances: { x: number; z: number; nx: number; nz: number; massId?: number }[] = [];
  /** Extra areas that scattered items must avoid. */
  readonly reserved: Rect[] = [];
  pool?: Rect;
  lawnColor: string;
  pavingColor: string;
  height?: number;
  readonly info: Record<string, string | number>;

  constructor(
    readonly rng: RNG,
    readonly W: number,
    readonly D: number,
    readonly details: DetailOptions,
    readonly seed: number,
    form: string,
  ) {
    this.facade = new OpeningPlacer(this.masses, rng);
    this.lawnColor = jitterHex('#7fae55', rng, 0.06);
    this.pavingColor = jitterHex('#c4beb3', rng, 0.04);
    this.info = { type: 'civic', form };
  }

  mass(kind: MassKind, rect: Rect, floors: number, fh: number, wall: string, roof: Partial<RoofSpec> = {}, extra: Partial<Mass> = {}): Mass {
    const m: Mass = {
      id: this.masses.length, kind, rect, baseY: 0.15, floors, floorHeight: fh, wallColor: wall, plinth: false,
      roof: { type: 'flat', pitch: 0.3, axis: 'x', overhang: 0, gableOverhang: 0.3, highSide: 1, color: '#6b6e72', parapet: true, ...roof },
      ...extra,
    };
    this.masses.push(m);
    return m;
  }

  /** Windows on the chosen walls (all by default). */
  windows(m: Mass, o: WindowOpts): Opening[] {
    const out: Opening[] = [];
    for (const wl of wallsOf(m.rect)) {
      if (o.sides && !o.sides.includes(wl.side)) continue;
      if (wl.length < 2) continue;
      const placed = this.facade.wallWindows(m, wl, { bay: o.bay, w: o.w, h: o.h, sill: o.sill, frame: o.frame, mullions: false, floors: o.floors, litChance: o.litChance ?? 0.45 });
      for (const p of placed) {
        p.style = o.style;
        p.noSill = o.noSill;
      }
      out.push(...placed);
    }
    return out;
  }

  /** Full-wall glazing (curtain wall quad per floor) on the given sides. */
  glaze(m: Mass, sides: WallSide[], frame = '#3a3d40'): void {
    for (const side of sides) {
      const wl = wallOf(m.rect, side);
      for (let f = 0; f < m.floors; f++) {
        this.facade.add({ kind: 'window', massId: m.id, wall: side, floor: f, cx: (wl.ax + wl.bx) / 2, cz: (wl.az + wl.bz) / 2, nx: wl.nx, nz: wl.nz, width: wl.length - 0.5, y0: m.baseY + f * m.floorHeight, height: m.floorHeight, color: '#2b3a48', frameColor: frame, mullions: false, style: 'curtain', lit: this.rng.chance(0.6) });
      }
    }
  }

  /** An opening placed at fraction t along a wall, at floor level; windows it overlaps are removed. */
  opening(m: Mass, side: WallSide, t: number, kind: 'door' | 'garageDoor' | 'shopfront', w: number, h: number, color: string, style?: WindowStyle, clear = true): Opening {
    const wl = wallOf(m.rect, side);
    if (kind !== 'garageDoor') this.entrances.push({ x: wl.ax + (wl.bx - wl.ax) * t, z: wl.az + (wl.bz - wl.az) * t, nx: wl.nx, nz: wl.nz, massId: m.id });
    if (clear) this.clear(m, side, wl.ax + (wl.bx - wl.ax) * t, wl.az + (wl.bz - wl.az) * t, w + 0.6, m.baseY + h + 0.2);
    return this.facade.add({
      kind, massId: m.id, wall: side, floor: 0, cx: wl.ax + (wl.bx - wl.ax) * t, cz: wl.az + (wl.bz - wl.az) * t, nx: wl.nx, nz: wl.nz,
      width: w, y0: m.baseY, height: h, color, frameColor: '#3a3d40', mullions: false, style, lit: true,
    });
  }

  /** Remove windows on a wall whose span overlaps (cx,cz) ± w/2 below height yTop. */
  clear(m: Mass, side: WallSide, cx: number, cz: number, w: number, yTop: number, yBottom = -1): void {
    const ops = this.facade.openings;
    for (let i = ops.length - 1; i >= 0; i--) {
      const o = ops[i];
      if (o.massId !== m.id || o.wall !== side || o.kind !== 'window') continue;
      const d = Math.abs(o.cx - cx) + Math.abs(o.cz - cz);
      if (d < (o.width + w) / 2 && o.y0 < yTop && o.y0 + o.height > yBottom) ops.splice(i, 1);
    }
  }

  sign(m: Mass, side: WallSide, t: number, y0: number, w: number, h: number, color: string): void {
    const wl = wallOf(m.rect, side);
    this.clear(m, side, wl.ax + (wl.bx - wl.ax) * t, wl.az + (wl.bz - wl.az) * t, w + 0.4, y0 + h + 0.1, y0 - 0.1);
    this.facade.add({ kind: 'sign', massId: m.id, wall: side, floor: 0, cx: wl.ax + (wl.bx - wl.ax) * t, cz: wl.az + (wl.bz - wl.az) * t, nx: wl.nx, nz: wl.nz, width: w, y0, height: h, color, frameColor: '#2b2b2b', mullions: false, lit: true });
  }

  wall(m: Mass, side: WallSide): Wall {
    return wallOf(m.rect, side);
  }

  /** Marked parking: rows of 5 m stalls along x around 6 m aisles, cars nose-in, lot lights. */
  parking(rect: Rect, carChance = this.details.cars): ParkingLot | undefined {
    if (rect.x1 - rect.x0 < 6 || rect.z1 - rect.z0 < 5) return undefined;
    const sw = 2.6;
    const rows: { z0: number; z1: number; aisleAfter: boolean }[] = [];
    let z = rect.z0;
    let phase = 0;
    while (z + 5 <= rect.z1 + 1e-6) {
      rows.push({ z0: z, z1: z + 5, aisleAfter: phase === 0 });
      z += 5;
      if (phase === 0) {
        if (z + 11 > rect.z1 + 1e-6) break;
        z += 6;
      }
      phase = 1 - phase;
    }
    for (const row of rows) {
      for (let x = rect.x0 + sw / 2 + 0.3; x < rect.x1 - sw / 2; x += sw) {
        if (this.rng.chance(carChance)) this.props.push({ kind: 'car', x, y: 0.05, z: (row.z0 + row.z1) / 2, rot: row.aisleAfter ? Math.PI : 0, color: this.rng.pick(CAR_COLORS) });
      }
      if (row.aisleAfter) for (let x = rect.x0 + 8; x < rect.x1 - 4; x += 22) this.lights.push({ kind: 'lotLight', x, y: 0.07, z: row.z1 + 3, rot: 0 });
    }
    const lot: ParkingLot = { rect, rows, stallWidth: sw, color: '#4f5257' };
    this.parkingLots.push(lot);
    return lot;
  }

  court(kind: Court['kind'], rect: Rect): Court {
    const c = { kind, rect };
    this.courts.push(c);
    return c;
  }

  /** Placement helper that avoids everything placed so far. */
  placer(): YardPlacer {
    return new YardPlacer(this.rng, this.W, this.D, [
      ...this.masses.map((m) => m.rect),
      ...this.paths,
      ...this.driveways,
      ...this.parkingLots.map((p) => p.rect),
      ...this.courts.map((c) => c.rect),
      ...this.porches.map((p) => p.rect),
      ...this.reserved,
      ...(this.pool ? [this.pool] : []),
      ...this.water.map((w) => ({ x0: Math.min(...w.pts.map((p) => p[0])) - 1, x1: Math.max(...w.pts.map((p) => p[0])) + 1, z0: Math.min(...w.pts.map((p) => p[1])) - 1, z1: Math.max(...w.pts.map((p) => p[1])) + 1 })),
    ]);
  }

  trees_(region: Rect, n: number, kinds: [Tree['kind'], number][] = [['round', 4], ['cone', 1]]): void {
    const p = this.placer();
    const obstacles = [...p.obstacles, ...this.props.filter((pr) => pr.y < 1).map((pr) => ({ x0: pr.x - 1, x1: pr.x + 1, z0: pr.z - 1, z1: pr.z + 1 }))];
    placeTrees(this.rng, this.trees, obstacles, { W: this.W, D: this.D }, region, n, kinds);
  }

  /** Perimeter fence with a gap (gate) on the street side between gx0..gx1. */
  fence(kind: Fence['kind'], color: string, height: number, gates: [number, number][]): void {
    const e = kind === 'hedge' ? 0.5 : 0.3;
    const segs: Fence['segments'] = [];
    let x = e;
    for (const [g0, g1] of [...gates].sort((a, b) => a[0] - b[0])) {
      if (g0 > x) segs.push({ x0: x, z0: e, x1: g0, z1: e });
      x = Math.max(x, g1);
    }
    if (x < this.W - e) segs.push({ x0: x, z0: e, x1: this.W - e, z1: e });
    segs.push({ x0: e, z0: e, x1: e, z1: this.D - e }, { x0: this.W - e, z0: e, x1: this.W - e, z1: this.D - e }, { x0: e, z0: this.D - e, x1: this.W - e, z1: this.D - e });
    this.fences.push({ kind, color, height, segments: segs.filter((s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0) > 0.4) });
  }

  flags(x: number, z: number, n: number): void {
    const colors = ['#c0392b', '#1f6fb5', '#27ae60', '#f1c40f', '#ffffff', '#01411c'];
    for (let i = 0; i < n; i++) this.props.push({ kind: 'flagpole', x: x + (i - (n - 1) / 2) * 2.2, y: 0.05, z, rot: 0, color: this.rng.pick(colors), color2: this.rng.pick(colors), h: 8 });
  }

  /** Extra point that linkPaths() should reach (court edge, stand, bus stop ...). */
  target(x: number, z: number): void {
    this.entrances.push({ x, z, nx: 0, nz: 0 });
  }

  /**
   * Join every entrance / target to the walkable network (paths, drives, parking, porches, the street edge)
   * with the shortest clear L-shaped footpath, so the buildings of a campus read as one place.
   */
  linkPaths(width = 2.2): void {
    const net: Rect[] = [
      { x0: 0, x1: this.W, z0: -2, z1: 0.02 },
      ...this.paths, ...this.driveways, ...this.parkingLots.map((p) => p.rect), ...this.porches.map((p) => p.rect),
    ];
    const blockers: { r: Rect; id?: number }[] = [
      ...this.masses.filter((m) => m.baseY < 3 && m.floorHeight >= 1.5).map((m) => ({ r: m.rect, id: m.id })),
      ...this.courts.map((c) => ({ r: c.rect })),
      ...this.reserved.map((r) => ({ r })),
      ...(this.pool ? [{ r: this.pool }] : []),
    ];
    const hw = width / 2;
    const seg = (ax: number, az: number, bx: number, bz: number): Rect => ({ x0: Math.min(ax, bx) - hw, x1: Math.max(ax, bx) + hw, z0: Math.min(az, bz) - hw, z1: Math.max(az, bz) + hw });
    const clear = (r: Rect, own?: number) =>
      r.x0 > 0.2 && r.x1 < this.W - 0.2 && r.z1 < this.D - 0.2 && !blockers.some((b) => b.id !== own && overlaps(r, b.r, 0.15));
    const inNet = (x: number, z: number) => net.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
    const ents = [...this.entrances];
    // Nearest first, so later links can reuse earlier ones.
    const dist = (e: { x: number; z: number }) => Math.min(...net.map((r) => Math.abs(Math.max(r.x0, Math.min(r.x1, e.x)) - e.x) + Math.abs(Math.max(r.z0, Math.min(r.z1, e.z)) - e.z)));
    ents.sort((a, b) => dist(a) - dist(b));
    // Turning lines just outside every blocker, for routes that have to go around buildings.
    const xs = blockers.flatMap((q) => [q.r.x0 - hw - 0.4, q.r.x1 + hw + 0.4]).filter((x) => x > hw + 0.3 && x < this.W - hw - 0.3);
    const zs = blockers.flatMap((q) => [q.r.z0 - hw - 0.4, q.r.z1 + hw + 0.4]).filter((z) => z > hw && z < this.D - hw - 0.3);
    for (const e of ents) {
      const sx = e.x + e.nx * 0.05;
      const sz = e.z + e.nz * 0.05;
      if (inNet(sx + e.nx * 0.5, sz + e.nz * 0.5)) continue;
      const tx = e.x + e.nx * (hw + 0.4);
      const tz = e.z + e.nz * (hw + 0.4);
      let stub: Rect | undefined;
      if (e.nx || e.nz) {
        stub = seg(sx, sz, tx, tz);
        // never reach back into the building
        if (e.nz < 0) stub.z1 = e.z;
        if (e.nz > 0) stub.z0 = e.z;
        if (e.nx < 0) stub.x1 = e.x;
        if (e.nx > 0) stub.x0 = e.x;
        if (!clear(stub, e.massId)) continue;
      }
      let best: { cost: number; rects: Rect[] } | undefined;
      const consider = (pts: [number, number][], cost: number) => {
        if (best && cost >= best.cost) return;
        const rects: Rect[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const q = seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
          if (q.x1 - q.x0 <= width + 0.01 && q.z1 - q.z0 <= width + 0.01) continue;
          if (!clear(q)) return;
          rects.push(q);
        }
        best = { cost, rects };
      };
      for (const r of net) {
        const px = Math.max(r.x0 + hw, Math.min(r.x1 - hw, tx));
        const pz = Math.max(r.z0 + hw, Math.min(r.z1 - hw, tz));
        const man = Math.abs(px - tx) + Math.abs(pz - tz);
        consider([[tx, tz], [px, tz], [px, pz]], man);
        consider([[tx, tz], [tx, pz], [px, pz]], man);
        if (best && best.cost <= man) continue;
        for (const zm of zs) consider([[tx, tz], [tx, zm], [px, zm], [px, pz]], Math.abs(zm - tz) + Math.abs(px - tx) + Math.abs(pz - zm) + 2);
        for (const xm of xs) consider([[tx, tz], [xm, tz], [xm, pz], [px, pz]], Math.abs(xm - tx) + Math.abs(pz - tz) + Math.abs(px - xm) + 2);
      }
      if (!best) continue;
      for (const q of [...(stub ? [stub] : []), ...best.rects]) {
        this.paths.push(q);
        net.push(q);
      }
    }
  }

  /** Benches and lamp posts along a path rect (on both long sides). */
  furnishPath(p: Rect, every = 12): void {
    const alongX = p.x1 - p.x0 >= p.z1 - p.z0;
    const len = alongX ? p.x1 - p.x0 : p.z1 - p.z0;
    for (let t = every / 2; t < len - 2; t += every) {
      const bench = t + every / 2 < len - 1.2 && this.rng.chance(0.6);
      if (alongX) {
        this.lights.push({ kind: 'post', x: p.x0 + t, y: 0.05, z: p.z0 - 0.6, rot: 0 });
        if (bench) this.props.push({ kind: 'bench', x: p.x0 + t + every / 2, y: 0.05, z: p.z1 + 0.7, rot: 0, color: '#6b4a33' });
      } else {
        this.lights.push({ kind: 'post', x: p.x0 - 0.6, y: 0.05, z: p.z0 + t, rot: 0 });
        if (bench) this.props.push({ kind: 'bench', x: p.x1 + 0.7, y: 0.05, z: p.z0 + t + every / 2, rot: Math.PI / 2, color: '#6b4a33' });
      }
    }
  }

  model(style: string): HouseModel {
    const streetTreeXs: number[] = [];
    for (let sx = this.rng.range(3, 6); sx < this.W - 2; sx += this.rng.range(9, 12)) {
      if ([...this.paths, ...this.driveways].some((d) => d.z0 <= 0.1 && sx > d.x0 - 1.5 && sx < d.x1 + 1.5)) continue;
      streetTreeXs.push(sx);
    }
    this.info.details = summarizeProps(this.props);
    this.info.lot = `${this.W.toFixed(0)} × ${this.D.toFixed(0)} m`;
    return {
      seed: this.seed,
      style,
      lot: { width: this.W, depth: this.D },
      lawnColor: this.lawnColor,
      trimColor: '#5a5f66',
      foundationColor: '#8f8a83',
      pavingColor: this.pavingColor,
      masses: this.masses,
      openings: this.facade.openings,
      porches: this.porches,
      chimneys: [],
      driveways: this.driveways,
      paths: this.paths,
      fences: this.fences,
      trees: this.trees,
      pool: this.pool,
      balconies: this.balconies,
      parkingLots: this.parkingLots,
      courts: this.courts,
      walks: this.walks,
      water: this.water,
      plazas: this.plazas,
      bowls: this.bowls,
      polyMasses: this.polyMasses,
      props: this.props,
      lights: this.lights,
      animated: this.animated,
      streetTreeXs,
      height: this.height,
      info: this.info,
    };
  }
}

export const jitter = jitterHex;
