/**
 * Turns any lot model (house, row houses, mid-rise...) into triangles in lot-local space.
 *
 * Two levels of detail:
 *   LOD 0 (near): everything - window sills/shutters/awnings, door frames, railings, props, light fixtures.
 *   LOD 1 (far):  silhouettes + facades only - masses, roofs, window quads, trees, fences, water tanks,
 *                 solar panels and lamp heads (so the city still glows at night). Roughly 3-5x fewer triangles.
 */
import * as THREE from 'three';
import { FACE, LocalFrame, MeshBuilder, SHAPES, TEMPLATES, col, type BucketName } from './MeshBuilder';
import { drawLight, drawLightFar, drawProp, drawPropFar } from './propMesher';
import { courtMesh } from './courtMesher';
import { plazaMesh, walkMesh, waterMesh } from './groundMesher';
import { bowlMesh } from './bowlMesher';
import { STYLE_ID } from '../../render/windowMaterial';
import {
  STEP_RUN,
  massTop,
  stairRun,
  type Balcony,
  type Fence,
  type FireEscape,
  type ParkingLot,
  type Pipe,
  type HouseModel,
  type Mass,
  type Opening,
  type PolyMass,
  type Porch,
  type PropKind,
  type Tree,
  type WindowStyle,
} from '../spec';

export type Lod = 0 | 1;

export interface LotMeshOptions {
  /** Depth of the sidewalk/verge in front of the lot (negative z) for the driveway apron. */
  apronDepth?: number;
  /** z (negative, lot-local) where street trees are planted. */
  streetTreeZ?: number;
  lod?: Lod;
}

/** Props that still matter for the silhouette at a distance. */
const FAR_PROPS: ReadonlySet<PropKind> = new Set<PropKind>([
  'waterTank', 'waterTower', 'solarPanels', 'helipad', 'spire', 'cellTower', 'antennaCluster', 'bigDish', 'coolingTower', 'bmu', 'roofSign', 'pylonSign', 'fuelCanopy', 'truck', 'smokestack', 'storageTank', 'silo', 'pipeRack', 'conveyor', 'container', 'craneRails', 'turbineTower', 'carWashBay',
  'grandstand', 'floodlight', 'train', 'parkingDeck', 'garageRamp', 'statue', 'scoreboard', 'sightScreen', 'hyperTower', 'reactorDome', 'footbridge', 'aviary', 'gateArch', 'adBoards', 'ramp', 'gazebo', 'fountain', 'mound', 'waterTowerTall', 'clockTower', 'skip', 'pond', 'platformCanopy',
]);

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildLotGeometry(model: HouseModel, opts: LotMeshOptions = {}): MeshBuilder {
  const lod = opts.lod ?? 0;
  const b = new MeshBuilder();
  const { width: W, depth: D } = model.lot;

  // Ground: lawn (or paving) + driveways + paths
  b.box('solid', 0, -0.1, 0, W, 0.02, D, col(model.lawnColor), FACE.NY);
  const paving = col(model.pavingColor);
  for (const d of model.driveways) {
    b.box('solid', d.x0, 0.02, d.z0, d.x1, 0.06, d.z1, paving);
    if (opts.apronDepth) b.box('solid', d.x0, -0.14, -opts.apronDepth, d.x1, 0.035, 0, paving);
  }
  for (const p of model.paths) b.box('solid', p.x0, 0.02, p.z0, p.x1, 0.055, p.z1, paving);
  for (const pl of model.parkingLots ?? []) parkingMesh(b, pl, lod);
  for (const c of model.courts ?? []) courtMesh(b, c, lod);
  for (const w of model.water ?? []) waterMesh(b, w);
  for (const w of model.walks ?? []) walkMesh(b, w, model.pavingColor, lod);
  for (const p of model.plazas ?? []) plazaMesh(b, p, model.pavingColor, lod);
  for (const bw of model.bowls ?? []) bowlMesh(b, bw, lod);

  for (const m of model.masses) massMesh(b, m, model, lod);
  (model.polyMasses ?? []).forEach((pm, i) => polyMassMesh(b, pm, model.seed + i * 7919));
  for (const o of model.openings) openingMesh(b, o, lod);
  for (const bal of model.balconies) balconyMesh(b, bal, lod);
  for (const p of model.pipes ?? []) pipeMesh(b, p, lod);
  for (const fe of model.fireEscapes ?? []) fireEscapeMesh(b, fe, lod);
  for (const p of model.porches) porchMesh(b, p, lod);
  for (const c of model.chimneys) {
    b.box('solid', c.x - c.w / 2, c.y0, c.z - c.d / 2, c.x + c.w / 2, c.y1, c.z + c.d / 2, col(c.color));
    if (lod === 0) {
      b.box('solid', c.x - c.w / 2 - 0.08, c.y1, c.z - c.d / 2 - 0.08, c.x + c.w / 2 + 0.08, c.y1 + 0.12, c.z + c.d / 2 + 0.08, col('#5a5652'));
      for (const s of c.w > 0.8 ? [-0.2, 0.2] : [0]) {
        new LocalFrame(b, c.x + s, c.y1 + 0.12, c.z, 0).shape('solid', SHAPES.cylLow, 0, 0.15, 0, 0.1, 0.3, 0.1, col('#a8553a'));
      }
    }
  }
  if (model.pool) poolMesh(b, model.pool, lod);
  for (const f of model.fences) fenceMesh(b, f, lod);
  for (const t of model.trees) {
    if (lod === 1 && t.kind === 'shrub') continue;
    treeMesh(b, t, lod);
  }
  // Far away: big silhouettes stay as they are, chunky props (cars...) become cheap stand-ins, tiny ones drop.
  for (const p of model.props) {
    if (lod === 0 || FAR_PROPS.has(p.kind)) drawProp(b, p);
    else drawPropFar(b, p);
  }
  for (const l of model.lights) (lod === 0 ? drawLight : drawLightFar)(b, l);
  if (opts.streetTreeZ !== undefined) {
    model.streetTreeXs.forEach((x, i) =>
      treeMesh(b, { kind: 'round', x, z: opts.streetTreeZ!, scale: 1.15, rot: x * 7.1 + i, color: '#5a8838', trunkColor: '#6b4a33' }, lod),
    );
  }
  return b;
}

// ---------------------------------------------------------------- masses & roofs

function massMesh(b: MeshBuilder, m: Mass, model: HouseModel, lod: Lod): void {
  const r = m.rect;
  const top = massTop(m);
  const wall = col(m.wallColor);
  if (m.plinth && m.baseY > 0.05) {
    b.box('solid', r.x0 - 0.06, 0, r.z0 - 0.06, r.x1 + 0.06, m.baseY, r.z1 + 0.06, col(model.foundationColor));
  }
  // The wall box's top is always under a roof; its bottom is hidden unless the mass cantilevers.
  b.box('solid', r.x0, m.baseY, r.z0, r.x1, top, r.z1, wall, FACE.PY | (m.kind === 'upper' ? 0 : FACE.NY));
  if (m.floors > 1 && m.floorBands) {
    const band = col(model.trimColor);
    for (let f = 1; f < m.floors; f++) {
      const y = m.baseY + f * m.floorHeight;
      b.box('solid', r.x0 - 0.04, y - 0.06, r.z0 - 0.04, r.x1 + 0.04, y + 0.06, r.z1 + 0.04, band);
    }
  }
  if (m.cornice) {
    const c = col(m.cornice);
    const ty = top + (m.roof.type === 'flat' && m.roof.parapet ? 0.55 : 0);
    b.box('solid', r.x0, ty - 0.45, r.z0 - 0.35, r.x1, ty + 0.12, r.z0 + 0.1, c, FACE.PZ);
    if (lod === 0) {
      b.box('solid', r.x0, ty - 0.6, r.z0 - 0.18, r.x1, ty - 0.45, r.z0, c, FACE.PZ);
      for (let x = r.x0 + 0.35; x < r.x1 - 0.2; x += 0.9) b.box('solid', x, ty - 0.75, r.z0 - 0.3, x + 0.14, ty - 0.45, r.z0, c, FACE.PZ | FACE.PY);
    }
  }
  roofMesh(b, m, model.trimColor, lod);
}

function roofMesh(b: MeshBuilder, m: Mass, trimHex: string, lod: Lod): void {
  const R = m.roof;
  const r = m.rect;
  const top = massTop(m);
  const roofC = col(R.color);
  const wallC = col(m.wallColor);
  const trimC = col(trimHex);
  const ax = R.axis;
  // Roof space: u runs along the ridge axis, v across it.
  const u0 = ax === 'x' ? r.x0 : r.z0;
  const u1 = ax === 'x' ? r.x1 : r.z1;
  const v0 = ax === 'x' ? r.z0 : r.x0;
  const v1 = ax === 'x' ? r.z1 : r.x1;
  const P = (u: number, y: number, vv: number) => (ax === 'x' ? V(u, y, vv) : V(vv, y, u));
  const boxRS = (ua: number, ub: number, ya: number, yb: number, va: number, vb: number, c: THREE.Color) => {
    const a = P(ua, ya, va);
    const z = P(ub, yb, vb);
    b.box('solid', a.x, a.y, a.z, z.x, z.y, z.z, c);
  };
  const oh = R.overhang;
  const go = R.gableOverhang;
  const p = R.pitch;
  const vc = (v0 + v1) / 2;
  const half = (v1 - v0) / 2;

  switch (R.type) {
    case 'gable': {
      const ry = top + half * p;
      const ey = top - oh * p;
      const g0 = R.gableOverhangs ? R.gableOverhangs[0] : go;
      const g1 = R.gableOverhangs ? R.gableOverhangs[1] : go;
      b.slab('solid', P(u0 - g0, ey, v0 - oh), P(u1 + g1, ey, v0 - oh), P(u1 + g1, ry, vc), P(u0 - g0, ry, vc), 0.12, roofC);
      b.slab('solid', P(u0 - g0, ey, v1 + oh), P(u1 + g1, ey, v1 + oh), P(u1 + g1, ry, vc), P(u0 - g0, ry, vc), 0.12, roofC);
      b.tri('solid', P(u0, top, v0), P(u0, top, v1), P(u0, ry, vc), wallC, P(-1, 0, 0));
      b.tri('solid', P(u1, top, v0), P(u1, top, v1), P(u1, ry, vc), wallC, P(1, 0, 0));
      if (lod === 0) {
        boxRS(u0 - g0, u1 + g1, ey - 0.18, ey, v0 - oh - 0.03, v0 - oh + 0.06, trimC);
        boxRS(u0 - g0, u1 + g1, ey - 0.18, ey, v1 + oh - 0.06, v1 + oh + 0.03, trimC);
      }
      break;
    }
    case 'hip': {
      let ru0 = u0 + half;
      let ru1 = u1 - half;
      if (ru0 > ru1) ru0 = ru1 = (u0 + u1) / 2;
      const ry = top + half * p;
      const ey = top - oh * p;
      const E00 = P(u0 - oh, ey, v0 - oh);
      const E10 = P(u1 + oh, ey, v0 - oh);
      const E11 = P(u1 + oh, ey, v1 + oh);
      const E01 = P(u0 - oh, ey, v1 + oh);
      const R0 = P(ru0, ry, vc);
      const R1 = P(ru1, ry, vc);
      b.quad('solid', E00, E10, R1, R0, roofC, P(0, 1, -1));
      b.quad('solid', E01, E11, R1, R0, roofC, P(0, 1, 1));
      b.tri('solid', E00, E01, R0, roofC, P(-1, 1, 0));
      b.tri('solid', E10, E11, R1, roofC, P(1, 1, 0));
      b.quad('solid', E00, E10, E11, E01, col('#d8d4cc'), V(0, -1, 0)); // soffit
      if (lod === 0) {
        boxRS(u0 - oh, u1 + oh, ey - 0.18, ey, v0 - oh - 0.03, v0 - oh + 0.06, trimC);
        boxRS(u0 - oh, u1 + oh, ey - 0.18, ey, v1 + oh - 0.06, v1 + oh + 0.03, trimC);
        boxRS(u0 - oh - 0.03, u0 - oh + 0.06, ey - 0.18, ey, v0 - oh, v1 + oh, trimC);
        boxRS(u1 + oh - 0.06, u1 + oh + 0.03, ey - 0.18, ey, v0 - oh, v1 + oh, trimC);
      }
      break;
    }
    case 'shed': {
      const s = R.highSide;
      const span = v1 - v0;
      const hy = top + span * p;
      const vLowWall = s > 0 ? v0 : v1;
      const vHighWall = s > 0 ? v1 : v0;
      const vl = s > 0 ? v0 - oh : v1 + oh;
      const vh = s > 0 ? v1 + oh : v0 - oh;
      const yl = top - oh * p;
      const yh = hy + oh * p;
      b.slab('solid', P(u0 - go, yl, vl), P(u1 + go, yl, vl), P(u1 + go, yh, vh), P(u0 - go, yh, vh), 0.28, roofC);
      b.tri('solid', P(u0, top, vLowWall), P(u0, top, vHighWall), P(u0, hy, vHighWall), wallC, P(-1, 0, 0));
      b.tri('solid', P(u1, top, vLowWall), P(u1, top, vHighWall), P(u1, hy, vHighWall), wallC, P(1, 0, 0));
      b.quad('solid', P(u0, top, vHighWall), P(u1, top, vHighWall), P(u1, hy, vHighWall), P(u0, hy, vHighWall), wallC, P(0, 0, s));
      break;
    }
    case 'flat': {
      if (R.parapet) {
        const t = 0.2;
        const h = top + 0.55;
        b.box('solid', r.x0 + t, top, r.z0 + t, r.x1 - t, top + 0.1, r.z1 - t, roofC, FACE.NY | FACE.NX | FACE.PX | FACE.NZ | FACE.PZ);
        // Parapet ring; outer faces continue the wall, inner faces face the roof.
        b.box('solid', r.x0, top, r.z0, r.x1, h, r.z0 + t, wallC, FACE.NY);
        b.box('solid', r.x0, top, r.z1 - t, r.x1, h, r.z1, wallC, FACE.NY);
        b.box('solid', r.x0, top, r.z0 + t, r.x0 + t, h, r.z1 - t, wallC, FACE.NY | FACE.NZ | FACE.PZ);
        b.box('solid', r.x1 - t, top, r.z0 + t, r.x1, h, r.z1 - t, wallC, FACE.NY | FACE.NZ | FACE.PZ);
        if (lod === 0) {
          // Coping cap along the parapet ring only (not a lid over the whole roof).
          const cp = col('#55585c');
          const ct = t + 0.03;
          b.box('solid', r.x0 - 0.03, h, r.z0 - 0.03, r.x1 + 0.03, h + 0.05, r.z0 - 0.03 + ct, cp);
          b.box('solid', r.x0 - 0.03, h, r.z1 + 0.03 - ct, r.x1 + 0.03, h + 0.05, r.z1 + 0.03, cp);
          b.box('solid', r.x0 - 0.03, h, r.z0 - 0.03 + ct, r.x0 - 0.03 + ct, h + 0.05, r.z1 + 0.03 - ct, cp);
          b.box('solid', r.x1 + 0.03 - ct, h, r.z0 - 0.03 + ct, r.x1 + 0.03, h + 0.05, r.z1 + 0.03 - ct, cp);
        }
      } else {
        b.box('solid', r.x0 - oh, top, r.z0 - oh, r.x1 + oh, top + 0.3, r.z1 + oh, roofC, oh < 0.01 ? FACE.NY : 0);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- towers (extruded polygons)

const h01 = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * One solid wall quad per edge (casts the shadow) + one facade-shader quad per edge per floor + roof cap.
 * Offices light up floor by floor at night, so "lit" is decided per floor, not per window.
 */
function polyMassMesh(b: MeshBuilder, pm: PolyMass, seed: number): void {
  const P = pm.poly;
  const n = P.length;
  const top = pm.baseY + pm.floors * pm.floorHeight;
  const cx = P.reduce((s, p) => s + p[0], 0) / n;
  const cz = P.reduce((s, p) => s + p[1], 0) / n;
  const frame = col(pm.frameColor);
  const roofC = col(pm.roofColor);
  const parapetH = pm.parapet ? 1.1 : 0;
  const facadeStyle = STYLE_ID[pm.facade];
  const floorLit = Array.from({ length: pm.floors }, (_, f) => h01(seed, f) < pm.litChance);

  for (let i = 0; i < n; i++) {
    const [ax, az] = P[i];
    const [bx, bz] = P[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    // Outward normal: perpendicular to the edge, pointing away from the centroid.
    let nx = (bz - az) / len;
    let nz = -(bx - ax) / len;
    if (nx * ((ax + bx) / 2 - cx) + nz * ((az + bz) / 2 - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const N = V(nx, 0, nz);
    b.quad('solid', V(ax, pm.baseY, az), V(bx, pm.baseY, bz), V(bx, top + parapetH, bz), V(ax, top + parapetH, az), frame, N);
    const d = 0.04;
    const oax = ax + nx * d, oaz = az + nz * d, obx = bx + nx * d, obz = bz + nz * d;
    for (let f = 0; f < pm.floors; f++) {
      const y0 = pm.baseY + f * pm.floorHeight;
      const y1 = y0 + pm.floorHeight;
      const lobby = pm.lobby && f === 0;
      const lit = lobby || floorLit[f] ? 1 : 0;
      b.winQuad('window', V(oax, y0, oaz), V(obx, y0, obz), V(obx, y1, obz), V(oax, y1, oaz), frame, len, pm.floorHeight,
        lobby ? STYLE_ID.shop : facadeStyle, lit + h01(i + seed, f) * 0.999, N);
    }
    if (pm.crownLight) {
      const e = 0.08;
      b.quad('lamp', V(ax + nx * e, top + 0.25, az + nz * e), V(bx + nx * e, top + 0.25, bz + nz * e), V(bx + nx * e, top + 0.55, bz + nz * e), V(ax + nx * e, top + 0.55, az + nz * e), col('#fff1cf'), N);
    }
  }
  // Roof cap (fan from the centroid; footprints are convex).
  const capY = top + 0.02;
  for (let i = 0; i < n; i++) {
    const [ax, az] = P[i];
    const [bx, bz] = P[(i + 1) % n];
    b.tri('solid', V(cx, capY, cz), V(ax, capY, az), V(bx, capY, bz), roofC, V(0, 1, 0));
  }
  if (pm.parapet) {
    // Inner face + top of the parapet: the footprint shrunk 0.3 m towards the centroid.
    const inner = P.map(([x, z]) => {
      const dx = x - cx, dz = z - cz;
      const r = Math.hypot(dx, dz) || 1;
      const k = Math.max(0.5, 1 - 0.3 / r);
      return [cx + dx * k, cz + dz * k] as [number, number];
    });
    for (let i = 0; i < n; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n];
      const [ix, iz] = inner[i], [jx, jz] = inner[(i + 1) % n];
      b.quad('solid', V(ix, capY, iz), V(jx, capY, jz), V(jx, top + parapetH, jz), V(ix, top + parapetH, iz), frame, V(cx - (ix + jx) / 2, 0, cz - (iz + jz) / 2));
      b.quad('solid', V(ax, top + parapetH, az), V(bx, top + parapetH, bz), V(jx, top + parapetH, jz), V(ix, top + parapetH, iz), frame, V(0, 1, 0));
    }
  }
}

// ---------------------------------------------------------------- facade elements

/** Anything attached to an axis-aligned wall: a point on the wall plane plus its outward normal. */
interface WallRef {
  cx: number;
  cz: number;
  nx: number;
  nz: number;
}

/** Wall-relative point: t along the wall, y up, d outwards from the wall plane. */
const wallPt = (o: WallRef, t: number, y: number, d: number) =>
  o.nz !== 0 ? V(o.cx + t, y, o.cz + o.nz * d) : V(o.cx + o.nx * d, y, o.cz + t);

/** Box relative to a wall point. The face against the wall (d = 0) is skipped. */
function wallBox(b: MeshBuilder, bucket: BucketName, o: WallRef, t0: number, t1: number, y0: number, y1: number, d0: number, d1: number, c: THREE.Color): void {
  const against = d0 <= 0.001 ? (o.nz < 0 ? FACE.PZ : o.nz > 0 ? FACE.NZ : o.nx < 0 ? FACE.PX : FACE.NX) : 0;
  if (o.nz !== 0) b.box(bucket, o.cx + t0, y0, o.cz + o.nz * d0, o.cx + t1, y1, o.cz + o.nz * d1, c, against);
  else b.box(bucket, o.cx + o.nx * d0, y0, o.cz + t0, o.cx + o.nx * d1, y1, o.cz + t1, c, against);
}

/** One facade-shader quad on a wall. */
function wallQuad(b: MeshBuilder, bucket: 'window' | 'cutout', o: WallRef, t0: number, t1: number, y0: number, y1: number, d: number, c: THREE.Color, style: number, litSeed: number): void {
  b.winQuad(bucket, wallPt(o, t0, y0, d), wallPt(o, t1, y0, d), wallPt(o, t1, y1, d), wallPt(o, t0, y1, d), c, t1 - t0, y1 - y0, style, litSeed, V(o.nx, 0, o.nz));
}

function styleOf(o: Opening): WindowStyle {
  if (o.style) return o.style;
  switch (o.kind) {
    case 'door':
      return 'door';
    case 'garageDoor':
      return 'garage';
    case 'shopfront':
      return 'shop';
    case 'sign':
      return 'sign';
    default:
      return o.mullions ? 'cross' : 'plain';
  }
}

/** Stable per-opening random number in [0, 1). */
function seedOf(o: Opening): number {
  const s = Math.sin(o.cx * 12.9898 + o.y0 * 78.233 + o.cz * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 0.999;
}

function openingMesh(b: MeshBuilder, o: Opening, lod: Lod): void {
  const hw = o.width / 2;
  const y0 = o.y0;
  const y1 = o.y0 + o.height;
  const style = styleOf(o);
  const litSeed = (o.lit ? 1 : 0) + seedOf(o);
  const panelColoured = o.kind !== 'window' && o.kind !== 'shopfront';
  const c = col(panelColoured || style === 'shutter' ? o.color : o.frameColor);
  const frame = col(o.frameColor);
  const f = 0.08;

  if (o.kind === 'sign') {
    // Sign board standing proud of the wall, lettering painted by the shader.
    wallBox(b, 'solid', o, -hw, hw, y0, y1, 0, 0.14, col('#2b2b2b'));
    wallQuad(b, 'window', o, -hw + 0.02, hw - 0.02, y0 + 0.02, y1 - 0.02, 0.145, c, STYLE_ID.sign, litSeed);
    return;
  }

  // Doors / shopfronts sit a little proud of the wall so they never z-fight a full-wall cladding quad.
  wallQuad(b, 'window', o, -hw, hw, y0, y1, o.kind === 'window' ? 0.03 : 0.045, c, STYLE_ID[style], litSeed);
  if (lod === 1) {
    if (o.shade?.kind === 'slab') wallBox(b, 'solid', o, -hw - 0.25, hw + 0.25, y1 + 0.06, y1 + 0.16, 0, 0.6, col(o.shade.color));
    return;
  }

  if (o.kind === 'window') {
    if (style !== 'curtain' && style !== 'ribbon' && !o.noSill) wallBox(b, 'solid', o, -hw - 0.1, hw + 0.1, y0 - 0.07, y0, 0, 0.12, frame); // sill
    if (o.shutterColor) {
      const sw = Math.min(0.5, o.width * 0.45);
      const sc = col(o.shutterColor);
      b.quad('solid', wallPt(o, -hw - 0.04 - sw, y0, 0.04), wallPt(o, -hw - 0.04, y0, 0.04), wallPt(o, -hw - 0.04, y1, 0.04), wallPt(o, -hw - 0.04 - sw, y1, 0.04), sc, V(o.nx, 0, o.nz));
      b.quad('solid', wallPt(o, hw + 0.04, y0, 0.04), wallPt(o, hw + 0.04 + sw, y0, 0.04), wallPt(o, hw + 0.04 + sw, y1, 0.04), wallPt(o, hw + 0.04, y1, 0.04), sc, V(o.nx, 0, o.nz));
    }
  } else if (o.kind === 'shopfront') {
    wallBox(b, 'solid', o, -hw - 0.1, hw + 0.1, y1, y1 + 0.12, 0, 0.1, frame); // head
  } else {
    // Doors and garage doors get a real frame for depth.
    wallBox(b, 'solid', o, -hw - f, hw + f, y1, y1 + f, 0, 0.1, frame);
    wallBox(b, 'solid', o, -hw - f, -hw, y0, y1, 0, 0.1, frame);
    wallBox(b, 'solid', o, hw, hw + f, y0, y1, 0, 0.1, frame);
  }
  if (o.shade) shadeMesh(b, o, hw, y1 + (o.kind === 'window' ? 0.02 : 0.12));
}

/** Sunshade above an opening: a concrete slab (chajja) or a striped, sloping fabric awning. */
function shadeMesh(b: MeshBuilder, o: Opening, hw: number, top: number): void {
  const c = col(o.shade!.color);
  if (o.shade!.kind === 'slab') {
    wallBox(b, 'solid', o, -hw - 0.25, hw + 0.25, top + 0.04, top + 0.14, 0, 0.6, c);
    return;
  }
  const out = V(o.nx, 0.6, o.nz);
  const yHigh = top + 0.2; // stays below the wall top so it never pokes through the eaves
  const yLow = top - 0.3;
  const depth = o.kind === 'shopfront' ? 1.2 : 0.7;
  const t0 = -hw - 0.12;
  const t1 = hw + 0.12;
  const white = col('#f4f1ea');
  const stripes = Math.max(2, Math.round((t1 - t0) / 0.3));
  for (let i = 0; i < stripes; i++) {
    const a = t0 + ((t1 - t0) * i) / stripes;
    const bb = t0 + ((t1 - t0) * (i + 1)) / stripes;
    b.quad('solid', wallPt(o, a, yHigh, 0), wallPt(o, bb, yHigh, 0), wallPt(o, bb, yLow, depth), wallPt(o, a, yLow, depth), i % 2 ? white : c, out);
  }
  const side = (s: number) => V(o.nz !== 0 ? s : 0, 0, o.nz !== 0 ? 0 : s);
  b.tri('solid', wallPt(o, t0, yHigh, 0), wallPt(o, t0, yLow, depth), wallPt(o, t0, yLow, 0.02), c, side(-1));
  b.tri('solid', wallPt(o, t1, yHigh, 0), wallPt(o, t1, yLow, depth), wallPt(o, t1, yLow, 0.02), c, side(1));
  b.quad('solid', wallPt(o, t0, yLow, depth), wallPt(o, t1, yLow, depth), wallPt(o, t1, yLow - 0.15, depth), wallPt(o, t0, yLow - 0.15, depth), c, V(o.nx, 0, o.nz));
}

function balconyMesh(b: MeshBuilder, bal: Balcony, lod: Lod): void {
  const hw = bal.width / 2;
  const d = bal.depth;
  wallBox(b, 'solid', bal, -hw, hw, bal.y - 0.16, bal.y, 0, d, col(bal.color));
  const rc = col(bal.railColor);
  const h = 1.0;
  if (bal.rail === 'solid') {
    wallBox(b, 'solid', bal, -hw, hw, bal.y, bal.y + h, d - 0.1, d, col(bal.color));
    wallBox(b, 'solid', bal, -hw, -hw + 0.1, bal.y, bal.y + h, 0, d - 0.1, col(bal.color));
    wallBox(b, 'solid', bal, hw - 0.1, hw, bal.y, bal.y + h, 0, d - 0.1, col(bal.color));
    return;
  }
  const bucket = bal.rail === 'glass' ? 'window' : 'cutout';
  const style = bal.rail === 'glass' ? STYLE_ID.glassPanel : STYLE_ID.iron;
  const tangent = V(bal.nz !== 0 ? 1 : 0, 0, bal.nz !== 0 ? 0 : 1);
  // front
  b.winQuad(bucket, wallPt(bal, -hw, bal.y, d), wallPt(bal, hw, bal.y, d), wallPt(bal, hw, bal.y + h, d), wallPt(bal, -hw, bal.y + h, d), rc, bal.width, h, style, 0.5, V(bal.nx, 0, bal.nz));
  // sides
  for (const s of [-1, 1]) {
    b.winQuad(bucket, wallPt(bal, s * hw, bal.y, 0), wallPt(bal, s * hw, bal.y, d), wallPt(bal, s * hw, bal.y + h, d), wallPt(bal, s * hw, bal.y + h, 0), rc, d, h, style, 0.5, tangent.clone().multiplyScalar(s));
  }
  if (lod === 0) {
    // handrail
    wallBox(b, 'solid', bal, -hw, hw, bal.y + h, bal.y + h + 0.05, d - 0.05, d + 0.02, rc);
  }
}

// ---------------------------------------------------------------- pipes & fire escapes

/** Vertical pipe off the wall, with wall brackets, a shoe at the bottom and branches into the wall. */
function pipeMesh(b: MeshBuilder, p: Pipe, lod: Lod): void {
  if (lod === 1) return; // a 12 cm pipe is invisible at a distance
  const c = col(p.color);
  const ref: WallRef = { cx: p.x, cz: p.z, nx: p.nx, nz: p.nz };
  const r = 0.06;
  const d0 = 0.06;
  wallBox(b, 'solid', ref, -r, r, Math.max(p.y0, 0.25), p.y1, d0, d0 + 2 * r, c);
  // shoe: bends out at the bottom
  wallBox(b, 'solid', ref, -r, r, p.y0, 0.3, d0, d0 + 0.32, c);
  for (let y = p.y0 + 2; y < p.y1 - 0.5; y += 3) wallBox(b, 'solid', ref, -r - 0.03, r + 0.03, y, y + 0.06, 0, d0 + 2 * r + 0.02, c);
  for (const y of p.branches) {
    // short horizontal run into the wall + a small collar
    wallBox(b, 'solid', ref, r, r + 0.45, y - 0.04, y + 0.04, 0, d0 + 0.08, c);
    wallBox(b, 'solid', ref, -r - 0.02, r + 0.02, y - 0.07, y + 0.07, d0 - 0.01, d0 + 2 * r + 0.01, c);
  }
  // gooseneck over the parapet / eave
  wallBox(b, 'solid', ref, -r, r, p.y1 - 0.1, p.y1 + 0.02, -0.35, d0 + 2 * r, c);
}

/** Steel fire escape: platform per level, alternating flights, rails (cut-out quads), drop ladder. */
function fireEscapeMesh(b: MeshBuilder, fe: FireEscape, lod: Lod): void {
  const c = col(fe.color);
  const hw = fe.width / 2;
  const dep = fe.depth;
  const n = V(fe.nx, 0, fe.nz);
  const tan = V(fe.nz !== 0 ? 1 : 0, 0, fe.nz !== 0 ? 0 : 1);
  const P = (t: number, y: number, d: number) => wallPt(fe, t, y, d);
  const rail = (a: THREE.Vector3, bb: THREE.Vector3, h: number, len: number, normal: THREE.Vector3) => {
    if (lod === 0) b.winQuad('cutout', a, bb, bb.clone().setY(bb.y + h), a.clone().setY(a.y + h), c, len, h, STYLE_ID.iron, 0.5, normal);
  };
  fe.levels.forEach((y, i) => {
    // grated platform
    wallBox(b, 'solid', fe, -hw, hw, y - 0.07, y, 0, dep, c);
    rail(P(-hw, y, dep), P(hw, y, dep), 1.0, fe.width, n);
    rail(P(-hw, y, 0), P(-hw, y, dep), 1.0, dep, tan.clone().negate());
    rail(P(hw, y, 0), P(hw, y, dep), 1.0, dep, tan);
    // flight up to the next platform, alternating direction
    const next = fe.levels[i + 1];
    if (next !== undefined) {
      const s = i % 2 === 0 ? 1 : -1;
      const ta = s * (-hw + 0.35);
      const tb = s * (hw - 0.35);
      b.slab('solid', P(ta, y, 0.15), P(tb, next - 0.07, 0.15), P(tb, next - 0.07, dep * 0.7), P(ta, y, dep * 0.7), 0.06, c);
      rail(P(ta, y, dep * 0.7), P(tb, next - 0.07, dep * 0.7), 0.9, Math.abs(tb - ta), n);
    }
  });
  // drop ladder below the first platform
  if (lod === 0 && fe.levels.length) {
    const y0 = fe.levels[0];
    const tl = hw - 0.6;
    for (const dt of [-0.22, 0.22]) wallBox(b, 'solid', fe, tl + dt - 0.03, tl + dt + 0.03, y0 - 2.3, y0, dep * 0.45, dep * 0.45 + 0.06, c);
    for (let y = y0 - 2.2; y < y0; y += 0.3) wallBox(b, 'solid', fe, tl - 0.22, tl + 0.22, y, y + 0.03, dep * 0.45, dep * 0.45 + 0.05, c);
  }
}

// ---------------------------------------------------------------- parking

function parkingMesh(b: MeshBuilder, pl: ParkingLot, lod: Lod): void {
  const r = pl.rect;
  b.box('solid', r.x0, 0.02, r.z0, r.x1, 0.07, r.z1, col(pl.color));
  if (lod === 1) return;
  const paint = col('#e9e6dc');
  for (const row of pl.rows) {
    for (let x = r.x0 + 0.3; x <= r.x1 - 0.3 + 1e-6; x += pl.stallWidth) {
      b.box('solid', x - 0.05, 0.07, row.z0 + 0.25, x + 0.05, 0.075, row.z1 - 0.25, paint);
    }
  }
}

// ---------------------------------------------------------------- entrance

function porchMesh(b: MeshBuilder, p: Porch, lod: Lod): void {
  const r = p.rect;
  const floorC = col(p.floorColor);
  if (p.floorY > 0.01) b.box('solid', r.x0, 0, r.z0, r.x1, p.floorY, r.z1, floorC);

  // Stairs down towards the street (-z): ~18 cm risers, 28 cm treads.
  const run = stairRun(p.floorY);
  const nSteps = Math.round(run / STEP_RUN);
  const rise = p.floorY / (nSteps + 1);
  const sw = p.kind === 'stoop' ? (r.x1 - r.x0) / 2 : Math.min(0.8, (r.x1 - r.x0) / 2);
  if (lod === 0) {
    for (let i = 0; i < nSteps; i++) {
      const top = p.floorY - (i + 1) * rise;
      b.box('solid', p.stepX - sw, 0, r.z0 - (i + 1) * STEP_RUN, p.stepX + sw, top, r.z0 - i * STEP_RUN, floorC, FACE.PZ);
    }
  } else if (nSteps > 0) {
    // Far away the stair is just a ramp-ish block.
    b.box('solid', p.stepX - sw, 0, r.z0 - run, p.stepX + sw, p.floorY * 0.5, r.z0, floorC, FACE.PZ);
  }

  if (p.kind === 'arcade') {
    // Covered walkway along a shop front: flat roof slab on a row of posts, fascia band on the edge.
    const post = col(p.postColor);
    b.box('solid', r.x0, p.roofY, r.z0, r.x1, p.roofY + 0.25, r.z1, col(p.roofColor), FACE.PZ);
    b.box('solid', r.x0 - 0.05, p.roofY - 0.1, r.z0 - 0.05, r.x1 + 0.05, p.roofY + 0.45, r.z0 + 0.15, post);
    const span = r.x1 - r.x0;
    const nPosts = Math.max(2, Math.round(span / 4.5) + 1);
    for (let i = 0; i < nPosts; i++) {
      const x = r.x0 + 0.2 + ((span - 0.4) * i) / (nPosts - 1);
      b.box('solid', x - 0.14, 0, r.z0 + 0.06, x + 0.14, p.roofY, r.z0 + 0.34, post, FACE.PY);
    }
    return;
  }
  if (p.kind === 'stoop') {
    if (lod === 1) return;
    // Iron railings: top rails + newel posts as geometry, balusters as one cut-out quad per run.
    const iron = col(p.postColor);
    const L = new LocalFrame(b, 0, 0, 0, 0);
    const zFoot = r.z0 - run;
    const yTop = p.floorY + 0.9;
    for (const x of [r.x0 + 0.05, r.x1 - 0.05]) {
      L.beam('solid', [x, yTop, r.z1 - 0.05], [x, yTop, r.z0], 0.05, iron);
      L.beam('solid', [x, yTop, r.z0], [x, 0.95, zFoot + 0.1], 0.05, iron);
      b.box('solid', x - 0.07, 0, zFoot - 0.02, x + 0.07, 1.1, zFoot + 0.12, iron);
      const nrm = V(x < p.stepX ? -1 : 1, 0, 0);
      const landingLen = r.z1 - 0.05 - r.z0;
      b.winQuad('cutout', V(x, p.floorY, r.z1 - 0.05), V(x, p.floorY, r.z0), V(x, yTop, r.z0), V(x, yTop, r.z1 - 0.05), iron, landingLen, 0.9, STYLE_ID.iron, 0.5, nrm);
      const slopeLen = r.z0 - (zFoot + 0.1);
      b.winQuad('cutout', V(x, p.floorY - 0.05, r.z0), V(x, 0.1, zFoot + 0.1), V(x, 0.95, zFoot + 0.1), V(x, yTop, r.z0), iron, slopeLen, 0.9, STYLE_ID.iron, 0.5, nrm);
    }
    return;
  }
  if (p.kind === 'hood') {
    const c = col(p.roofColor);
    b.box('solid', p.stepX - 0.8, p.roofY, r.z1 - 0.75, p.stepX + 0.8, p.roofY + 0.12, r.z1, c, FACE.PZ);
    if (lod === 0) {
      b.slab('solid', V(p.stepX - 0.85, p.roofY + 0.12, r.z1 - 0.8), V(p.stepX + 0.85, p.roofY + 0.12, r.z1 - 0.8), V(p.stepX + 0.85, p.roofY + 0.35, r.z1), V(p.stepX - 0.85, p.roofY + 0.35, r.z1), 0.05, c);
      for (const s of [-0.7, 0.62]) b.box('solid', p.stepX + s, p.roofY - 0.35, r.z1 - 0.55, p.stepX + s + 0.08, p.roofY, r.z1, c, FACE.PZ);
    }
    return;
  }
  if (p.kind === 'porch') {
    const post = col(p.postColor);
    const s = 0.18;
    for (const x of [r.x0 + 0.1, r.x1 - 0.1 - s]) b.box('solid', x, p.floorY, r.z0 + 0.1, x + s, p.roofY, r.z0 + 0.1 + s, post, FACE.NY | FACE.PY);
    if (r.x1 - r.x0 > 5) {
      const xm = (r.x0 + r.x1) / 2 - s / 2;
      b.box('solid', xm, p.floorY, r.z0 + 0.1, xm + s, p.roofY, r.z0 + 0.1 + s, post, FACE.NY | FACE.PY);
    }
    if (lod === 0) b.box('solid', r.x0, p.roofY - 0.2, r.z0 + 0.05, r.x1, p.roofY, r.z0 + 0.3, post, FACE.PY);
    b.slab('solid', V(r.x0 - 0.2, p.roofY, r.z0 - 0.3), V(r.x1 + 0.2, p.roofY, r.z0 - 0.3), V(r.x1 + 0.2, p.roofY + 0.5, r.z1), V(r.x0 - 0.2, p.roofY + 0.5, r.z1), 0.1, col(p.roofColor));
  } else {
    b.box('solid', r.x0, p.roofY, r.z0, r.x1, p.roofY + 0.18, r.z1, col(p.roofColor), FACE.PZ);
  }
}

// ---------------------------------------------------------------- yard

function poolMesh(b: MeshBuilder, r: { x0: number; x1: number; z0: number; z1: number }, lod: Lod): void {
  const stone = col('#dcd6c8');
  const c = 0.45;
  b.box('water', r.x0, -0.2, r.z0, r.x1, 0.05, r.z1, col('#3aa6cc'), FACE.NX | FACE.PX | FACE.NZ | FACE.PZ);
  b.box('solid', r.x0 - c, 0, r.z0 - c, r.x1 + c, 0.1, r.z0, stone);
  b.box('solid', r.x0 - c, 0, r.z1, r.x1 + c, 0.1, r.z1 + c, stone);
  b.box('solid', r.x0 - c, 0, r.z0, r.x0, 0.1, r.z1, stone, FACE.NZ | FACE.PZ);
  b.box('solid', r.x1, 0, r.z0, r.x1 + c, 0.1, r.z1, stone, FACE.NZ | FACE.PZ);
  if (lod === 0) b.box('solid', r.x0 - 1.6, 0.02, r.z0 - c, r.x0 - c, 0.06, r.z1 + c, stone);
}

function fenceMesh(b: MeshBuilder, f: Fence, lod: Lod): void {
  const c = col(f.color);
  for (const s of f.segments) {
    const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
    const alongX = Math.abs(s.x1 - s.x0) > Math.abs(s.z1 - s.z0);
    const seg = (a: number, bb: number, y0: number, y1: number, thick: number) => {
      const ax = s.x0 + ((s.x1 - s.x0) * a) / len;
      const az = s.z0 + ((s.z1 - s.z0) * a) / len;
      const bx = s.x0 + ((s.x1 - s.x0) * bb) / len;
      const bz = s.z0 + ((s.z1 - s.z0) * bb) / len;
      if (alongX) b.box('solid', ax, y0, az - thick / 2, bx, y1, bz + thick / 2, c);
      else b.box('solid', ax - thick / 2, y0, az, bx + thick / 2, y1, bz, c);
    };
    const h = s.height ?? f.height;
    if (f.kind === 'hedge') {
      const step = lod === 0 ? 2 : 4;
      for (let a = 0; a < len; a += step) {
        const hv = h * (0.92 + 0.16 * Math.abs(Math.sin(a * 3.7 + s.x0)));
        seg(a, Math.min(len, a + step + 0.05), 0, hv, 0.9);
      }
    } else if (f.kind === 'privacy') {
      seg(0, len, 0, h, 0.06);
      if (lod === 0) for (let a = 0; a <= len; a += 2.4) seg(Math.max(0, a - 0.06), Math.min(len, a + 0.06), 0, h + 0.08, 0.14);
    } else {
      // Picket and iron fences: one see-through quad per segment + a few posts.
      const iron = f.kind === 'iron';
      if (iron) seg(0, len, 0, 0.15, 0.2); // stone kerb
      const nrm = alongX ? V(0, 0, 1) : V(1, 0, 0);
      const y0 = iron ? 0.15 : 0;
      b.winQuad('cutout', V(s.x0, y0, s.z0), V(s.x1, y0, s.z1), V(s.x1, h, s.z1), V(s.x0, h, s.z0), c, len, h - y0, iron ? STYLE_ID.iron : STYLE_ID.picket, 0.5, nrm);
      if (lod === 0) {
        const every = iron ? 2.0 : 2.4;
        for (let a = 0; a <= len; a += every) seg(Math.max(0, a - 0.05), Math.min(len, a + 0.05), 0, h + 0.1, 0.1);
      }
    }
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

function place(b: MeshBuilder, geom: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, rot: number, c: THREE.Color): void {
  _q.setFromAxisAngle(_up, rot);
  _m.compose(V(x, y, z), _q, V(sx, sy, sz));
  b.geometry('solid', geom, _m, c);
}

function treeMesh(b: MeshBuilder, t: Tree, lod: Lod): void {
  const s = t.scale;
  const leaf = col(t.color);
  const trunk = col(t.trunkColor);
  if (t.kind === 'shrub') {
    place(b, TEMPLATES.blob, t.x, 0.35 * s, t.z, 0.65 * s, 0.5 * s, 0.65 * s, t.rot, leaf);
  } else if (t.kind === 'round') {
    const th = 1.9 * s;
    b.box('solid', t.x - 0.13 * s, 0, t.z - 0.13 * s, t.x + 0.13 * s, th + 0.5, t.z + 0.13 * s, trunk, FACE.PY);
    place(b, TEMPLATES.blob, t.x, th + 1.2 * s, t.z, 1.7 * s, 1.5 * s, 1.7 * s, t.rot, leaf);
    if (lod === 0) {
      const dark = leaf.clone().multiplyScalar(0.85);
      place(b, TEMPLATES.blob, t.x + Math.cos(t.rot) * 0.8 * s, th + 2.0 * s, t.z + Math.sin(t.rot) * 0.8 * s, 1.1 * s, 1.0 * s, 1.1 * s, t.rot * 2, dark);
    }
  } else if (t.kind === 'palm') {
    // Leaning segmented trunk, a crown of drooping fronds.
    const L = new LocalFrame(b, t.x, 0, t.z, t.rot);
    const lean = 0.5 * s;
    const top: [number, number, number] = [lean, 6.5 * s, 0];
    L.beam('solid', [0, 0, 0], [lean * 0.4, 3.4 * s, 0], 0.32 * s, trunk);
    L.beam('solid', [lean * 0.4, 3.3 * s, 0], top, 0.26 * s, trunk);
    const n = lod === 0 ? 8 : 5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t.rot;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const mid: [number, number, number] = [top[0] + cx * 1.5 * s, top[1] + 0.5 * s, cz * 1.5 * s];
      const tip: [number, number, number] = [top[0] + cx * 3.0 * s, top[1] - 1.1 * s, cz * 3.0 * s];
      const w = 0.45 * s;
      for (const [p0, p1] of [[top, mid], [mid, tip]] as const) {
        L.poly('solid', [[p0[0] - cz * w, p0[1], p0[2] + cx * w], [p1[0] - cz * w, p1[1], p1[2] + cx * w], [p1[0] + cz * w, p1[1], p1[2] - cx * w], [p0[0] + cz * w, p0[1], p0[2] - cx * w]], leaf, [0, 1, 0]);
        L.poly('solid', [[p0[0] - cz * w, p0[1] - 0.02, p0[2] + cx * w], [p1[0] - cz * w, p1[1] - 0.02, p1[2] + cx * w], [p1[0] + cz * w, p1[1] - 0.02, p1[2] - cx * w], [p0[0] + cz * w, p0[1] - 0.02, p0[2] - cx * w]], leaf.clone().multiplyScalar(0.8), [0, -1, 0]);
      }
    }
  } else {
    b.box('solid', t.x - 0.12 * s, 0, t.z - 0.12 * s, t.x + 0.12 * s, 1.2 * s, t.z + 0.12 * s, trunk, FACE.PY);
    place(b, TEMPLATES.cone, t.x, 1.0 * s + 1.4 * s, t.z, 1.6 * s, 2.8 * s, 1.6 * s, t.rot, leaf);
    if (lod === 0) place(b, TEMPLATES.cone, t.x, 1.0 * s + 3.1 * s, t.z, 1.1 * s, 2.2 * s, 1.1 * s, t.rot + 0.4, leaf.clone().multiplyScalar(1.1));
  }
}
