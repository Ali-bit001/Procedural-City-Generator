import * as THREE from 'three';
import { LocalFrame, MeshBuilder, SHAPES, TEMPLATES, col, type BucketName } from './MeshBuilder';
import { drawLight, drawProp } from './propMesher';
import { STEP_RUN, massTop, stairRun, type HouseModel, type Mass, type Opening, type Porch, type Tree, type Fence } from '../spec';

export interface HouseMeshOptions {
  /** Depth of the sidewalk/verge in front of the lot (negative z) for the driveway apron. */
  apronDepth?: number;
  /** z (negative, lot-local) where street trees are planted. */
  streetTreeZ?: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildHouseMesh(
  model: HouseModel,
  materials: Record<BucketName, THREE.Material>,
  opts: HouseMeshOptions = {},
): { group: THREE.Group; triangles: number } {
  const b = new MeshBuilder();
  const { width: W, depth: D } = model.lot;

  // Lawn & paving
  b.box('solid', 0, -0.1, 0, W, 0.02, D, col(model.lawnColor));
  const paving = col(model.pavingColor);
  for (const d of model.driveways) {
    b.box('solid', d.x0, 0.02, d.z0, d.x1, 0.06, d.z1, paving);
    if (opts.apronDepth) b.box('solid', d.x0, -0.14, -opts.apronDepth, d.x1, 0.035, 0, paving);
  }
  for (const p of model.paths) b.box('solid', p.x0, 0.02, p.z0, p.x1, 0.055, p.z1, paving);

  for (const m of model.masses) massMesh(b, m, model);
  for (const o of model.openings) openingMesh(b, o);
  for (const p of model.porches) porchMesh(b, p);
  for (const c of model.chimneys) {
    b.box('solid', c.x - c.w / 2, c.y0, c.z - c.d / 2, c.x + c.w / 2, c.y1, c.z + c.d / 2, col(c.color));
    b.box('solid', c.x - c.w / 2 - 0.08, c.y1, c.z - c.d / 2 - 0.08, c.x + c.w / 2 + 0.08, c.y1 + 0.12, c.z + c.d / 2 + 0.08, col('#5a5652'));
    // chimney pots
    for (const s of c.w > 0.8 ? [-0.2, 0.2] : [0]) {
      const L = new LocalFrame(b, c.x + s, c.y1 + 0.12, c.z, 0);
      L.shape('solid', SHAPES.cylLow, 0, 0.15, 0, 0.1, 0.3, 0.1, col('#a8553a'));
    }
  }
  if (model.pool) poolMesh(b, model.pool);
  for (const f of model.fences) fenceMesh(b, f);
  for (const t of model.trees) treeMesh(b, t);
  for (const p of model.props) drawProp(b, p);
  for (const l of model.lights) drawLight(b, l);
  if (opts.streetTreeZ !== undefined) {
    model.streetTreeXs.forEach((x, i) =>
      treeMesh(b, { kind: 'round', x, z: opts.streetTreeZ!, scale: 1.15, rot: x * 7.1 + i, color: '#5a8838', trunkColor: '#6b4a33' }),
    );
  }

  const triangles = b.triangleCount;
  return { group: b.build(materials), triangles };
}

// ---------------------------------------------------------------- masses & roofs

function massMesh(b: MeshBuilder, m: Mass, model: HouseModel): void {
  const r = m.rect;
  const top = massTop(m);
  const wall = col(m.wallColor);
  if (m.plinth && m.baseY > 0.05) {
    b.box('solid', r.x0 - 0.06, 0, r.z0 - 0.06, r.x1 + 0.06, m.baseY, r.z1 + 0.06, col(model.foundationColor));
  }
  b.box('solid', r.x0, m.baseY, r.z0, r.x1, top, r.z1, wall);
  // Thin band between floors.
  if (m.floors > 1 && m.floorBands) {
    for (let f = 1; f < m.floors; f++) {
      const y = m.baseY + f * m.floorHeight;
      b.box('solid', r.x0 - 0.04, y - 0.06, r.z0 - 0.04, r.x1 + 0.04, y + 0.06, r.z1 + 0.04, col(model.trimColor));
    }
  }
  // Projecting cornice along the front (brownstones).
  if (m.cornice) {
    const c = col(m.cornice);
    const ty = top + (m.roof.type === 'flat' && m.roof.parapet ? 0.55 : 0);
    b.box('solid', r.x0, ty - 0.45, r.z0 - 0.35, r.x1, ty + 0.12, r.z0 + 0.1, c);
    b.box('solid', r.x0, ty - 0.6, r.z0 - 0.18, r.x1, ty - 0.45, r.z0, c);
    for (let x = r.x0 + 0.35; x < r.x1 - 0.2; x += 0.9) b.box('solid', x, ty - 0.75, r.z0 - 0.3, x + 0.14, ty - 0.45, r.z0, c); // brackets
  }
  roofMesh(b, m, model.trimColor);
}

function roofMesh(b: MeshBuilder, m: Mass, trimHex: string): void {
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
      // Fascia boards along the eaves.
      boxRS(u0 - g0, u1 + g1, ey - 0.18, ey, v0 - oh - 0.03, v0 - oh + 0.06, trimC);
      boxRS(u0 - g0, u1 + g1, ey - 0.18, ey, v1 + oh - 0.06, v1 + oh + 0.03, trimC);
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
      // Soffit (underside) so the overhang doesn't look paper-thin from below.
      b.quad('solid', E00, E10, E11, E01, col('#d8d4cc'), V(0, -1, 0));
      boxRS(u0 - oh, u1 + oh, ey - 0.18, ey, v0 - oh - 0.03, v0 - oh + 0.06, trimC);
      boxRS(u0 - oh, u1 + oh, ey - 0.18, ey, v1 + oh - 0.06, v1 + oh + 0.03, trimC);
      boxRS(u0 - oh - 0.03, u0 - oh + 0.06, ey - 0.18, ey, v0 - oh, v1 + oh, trimC);
      boxRS(u1 + oh - 0.06, u1 + oh + 0.03, ey - 0.18, ey, v0 - oh, v1 + oh, trimC);
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
        b.box('solid', r.x0, top, r.z0, r.x1, top + 0.1, r.z1, roofC);
        const t = 0.2;
        const h = top + 0.55;
        b.box('solid', r.x0, top, r.z0, r.x1, h, r.z0 + t, wallC);
        b.box('solid', r.x0, top, r.z1 - t, r.x1, h, r.z1, wallC);
        b.box('solid', r.x0, top, r.z0, r.x0 + t, h, r.z1, wallC);
        b.box('solid', r.x1 - t, top, r.z0, r.x1, h, r.z1, wallC);
        b.box('solid', r.x0 - 0.03, h, r.z0 - 0.03, r.x1 + 0.03, h + 0.05, r.z1 + 0.03, col('#55585c'));
      } else {
        b.box('solid', r.x0 - oh, top, r.z0 - oh, r.x1 + oh, top + 0.3, r.z1 + oh, roofC);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- openings

/** Box positioned relative to an opening: t along the wall, y absolute, d outward from the wall plane. */
function wallBox(b: MeshBuilder, bucket: BucketName, o: Opening, t0: number, t1: number, y0: number, y1: number, d0: number, d1: number, c: THREE.Color): void {
  if (o.nz !== 0) {
    b.box(bucket, o.cx + t0, y0, o.cz + o.nz * d0, o.cx + t1, y1, o.cz + o.nz * d1, c);
  } else {
    b.box(bucket, o.cx + o.nx * d0, y0, o.cz + t0, o.cx + o.nx * d1, y1, o.cz + t1, c);
  }
}

function openingMesh(b: MeshBuilder, o: Opening): void {
  const hw = o.width / 2;
  const y0 = o.y0;
  const y1 = o.y0 + o.height;
  const frame = col(o.frameColor);
  const f = 0.08;

  if (o.kind === 'window') {
    wallBox(b, o.lit ? 'glassLit' : 'glass', o, -hw, hw, y0, y1, -0.02, 0.03, col(o.color));
    wallBox(b, 'solid', o, -hw - f, hw + f, y1, y1 + f, 0, 0.08, frame); // head
    wallBox(b, 'solid', o, -hw - f - 0.05, hw + f + 0.05, y0 - f, y0, 0, 0.13, frame); // sill
    wallBox(b, 'solid', o, -hw - f, -hw, y0, y1, 0, 0.08, frame);
    wallBox(b, 'solid', o, hw, hw + f, y0, y1, 0, 0.08, frame);
    if (o.mullions) {
      if (o.width > 0.8) wallBox(b, 'solid', o, -0.025, 0.025, y0, y1, 0, 0.05, frame);
      wallBox(b, 'solid', o, -hw, hw, y0 + o.height * 0.55 - 0.025, y0 + o.height * 0.55 + 0.025, 0, 0.05, frame);
    }
    if (o.shutterColor) {
      const sw = Math.min(0.5, o.width * 0.45);
      const sc = col(o.shutterColor);
      wallBox(b, 'solid', o, -hw - f - sw, -hw - f - 0.02, y0, y1, 0, 0.05, sc);
      wallBox(b, 'solid', o, hw + f + 0.02, hw + f + sw, y0, y1, 0, 0.05, sc);
    }
    if (o.shade) shadeMesh(b, o, hw, y1 + f);
  } else if (o.kind === 'door') {
    wallBox(b, 'solid', o, -hw, hw, y0, y1, -0.02, 0.06, col(o.color));
    wallBox(b, 'glass', o, -hw * 0.6, hw * 0.6, y1 - 0.7, y1 - 0.25, 0.06, 0.07, col('#2b3a48'));
    wallBox(b, 'solid', o, -hw - f, hw + f, y1, y1 + f, 0, 0.1, frame);
    wallBox(b, 'solid', o, -hw - f, -hw, y0, y1, 0, 0.1, frame);
    wallBox(b, 'solid', o, hw, hw + f, y0, y1, 0, 0.1, frame);
    wallBox(b, 'solid', o, hw * 0.55, hw * 0.7, y0 + 1.0, y0 + 1.08, 0.06, 0.1, col('#c9a648')); // handle
  } else {
    const panel = col(o.color);
    const groove = panel.clone().multiplyScalar(0.8);
    wallBox(b, 'solid', o, -hw, hw, y0, y1, -0.02, 0.04, panel);
    for (let i = 1; i < 4; i++) {
      const y = y0 + (o.height * i) / 4;
      wallBox(b, 'solid', o, -hw, hw, y - 0.02, y + 0.02, 0.04, 0.055, groove);
    }
    wallBox(b, 'solid', o, -hw - f, hw + f, y1, y1 + f, 0, 0.08, frame);
    wallBox(b, 'solid', o, -hw - f, -hw, y0, y1, 0, 0.08, frame);
    wallBox(b, 'solid', o, hw, hw + f, y0, y1, 0, 0.08, frame);
  }
}

/** Sunshade above a window: a concrete slab (chajja) or a striped, sloping fabric awning. */
function shadeMesh(b: MeshBuilder, o: Opening, hw: number, top: number): void {
  const c = col(o.shade!.color);
  if (o.shade!.kind === 'slab') {
    wallBox(b, 'solid', o, -hw - 0.25, hw + 0.25, top + 0.04, top + 0.14, 0, 0.6, c);
    return;
  }
  // Point on the wall-relative frame: t along the wall, y up, d outwards.
  const W = (t: number, y: number, d: number) => (o.nz !== 0 ? V(o.cx + t, y, o.cz + o.nz * d) : V(o.cx + o.nx * d, y, o.cz + t));
  const out = V(o.nx, 0.6, o.nz);
  const yHigh = top + 0.2; // stays below the wall top so it never pokes through the eaves
  const yLow = top - 0.3;
  const depth = 0.7;
  const t0 = -hw - 0.12;
  const t1 = hw + 0.12;
  const white = col('#f4f1ea');
  const stripes = Math.max(2, Math.round((t1 - t0) / 0.22));
  for (let i = 0; i < stripes; i++) {
    const a = t0 + ((t1 - t0) * i) / stripes;
    const bb = t0 + ((t1 - t0) * (i + 1)) / stripes;
    b.quad('solid', W(a, yHigh, 0), W(bb, yHigh, 0), W(bb, yLow, depth), W(a, yLow, depth), i % 2 ? white : c, out);
  }
  // Side cheeks and a valance along the front edge.
  b.tri('solid', W(t0, yHigh, 0), W(t0, yLow, depth), W(t0, yLow, 0.02), c, V(o.nz !== 0 ? -1 : 0, 0, o.nz !== 0 ? 0 : -1));
  b.tri('solid', W(t1, yHigh, 0), W(t1, yLow, depth), W(t1, yLow, 0.02), c, V(o.nz !== 0 ? 1 : 0, 0, o.nz !== 0 ? 0 : 1));
  b.quad('solid', W(t0, yLow, depth), W(t1, yLow, depth), W(t1, yLow - 0.15, depth), W(t0, yLow - 0.15, depth), c, V(o.nx, 0, o.nz));
}

// ---------------------------------------------------------------- entrance

function porchMesh(b: MeshBuilder, p: Porch): void {
  const r = p.rect;
  const floorC = col(p.floorColor);
  b.box('solid', r.x0, 0, r.z0, r.x1, p.floorY, r.z1, floorC);

  // Stairs down towards the street (-z): ~18 cm risers, 28 cm treads.
  const run = stairRun(p.floorY);
  const nSteps = Math.round(run / STEP_RUN);
  const rise = p.floorY / (nSteps + 1);
  const sw = p.kind === 'stoop' ? (r.x1 - r.x0) / 2 : Math.min(0.8, (r.x1 - r.x0) / 2);
  for (let i = 0; i < nSteps; i++) {
    const top = p.floorY - (i + 1) * rise;
    b.box('solid', p.stepX - sw, 0, r.z0 - (i + 1) * STEP_RUN, p.stepX + sw, top, r.z0 - i * STEP_RUN, floorC);
  }

  if (p.kind === 'stoop') {
    // Iron railings along the landing and down the stair, with balusters.
    const iron = col(p.postColor);
    const L = new LocalFrame(b, 0, 0, 0, 0);
    const zFoot = r.z0 - run;
    for (const x of [r.x0 + 0.05, r.x1 - 0.05]) {
      const yTop = p.floorY + 0.9;
      L.beam('solid', [x, yTop, r.z1 - 0.05], [x, yTop, r.z0], 0.05, iron);
      L.beam('solid', [x, yTop, r.z0], [x, 0.95, zFoot + 0.1], 0.05, iron);
      for (let z = r.z1 - 0.2; z > zFoot + 0.15; z -= 0.3) {
        const yBase = z >= r.z0 ? p.floorY : Math.max(0, p.floorY - ((r.z0 - z) / STEP_RUN + 1) * rise);
        const yRail = z >= r.z0 ? yTop : 0.95 + ((yTop - 0.95) * (z - zFoot - 0.1)) / (r.z0 - zFoot - 0.1);
        L.beam('solid', [x, yBase, z], [x, yRail, z], 0.025, iron);
      }
      b.box('solid', x - 0.07, 0, zFoot - 0.02, x + 0.07, 1.1, zFoot + 0.12, iron); // newel post
    }
    return;
  }
  if (p.kind === 'hood') {
    // Small hood on brackets above the door.
    const c = col(p.roofColor);
    b.box('solid', p.stepX - 0.8, p.roofY, r.z1 - 0.75, p.stepX + 0.8, p.roofY + 0.12, r.z1, c);
    b.slab('solid', V(p.stepX - 0.85, p.roofY + 0.12, r.z1 - 0.8), V(p.stepX + 0.85, p.roofY + 0.12, r.z1 - 0.8), V(p.stepX + 0.85, p.roofY + 0.35, r.z1), V(p.stepX - 0.85, p.roofY + 0.35, r.z1), 0.05, c);
    for (const s of [-0.7, 0.62]) b.box('solid', p.stepX + s, p.roofY - 0.35, r.z1 - 0.55, p.stepX + s + 0.08, p.roofY, r.z1, c);
    return;
  }
  if (p.kind === 'porch') {
    const post = col(p.postColor);
    const s = 0.18;
    for (const x of [r.x0 + 0.1, r.x1 - 0.1 - s]) {
      b.box('solid', x, p.floorY, r.z0 + 0.1, x + s, p.roofY, r.z0 + 0.1 + s, post);
    }
    if (r.x1 - r.x0 > 5) {
      const xm = (r.x0 + r.x1) / 2 - s / 2;
      b.box('solid', xm, p.floorY, r.z0 + 0.1, xm + s, p.roofY, r.z0 + 0.1 + s, post);
    }
    b.box('solid', r.x0, p.roofY - 0.2, r.z0 + 0.05, r.x1, p.roofY, r.z0 + 0.3, post); // beam
    b.slab('solid', V(r.x0 - 0.2, p.roofY, r.z0 - 0.3), V(r.x1 + 0.2, p.roofY, r.z0 - 0.3), V(r.x1 + 0.2, p.roofY + 0.5, r.z1), V(r.x0 - 0.2, p.roofY + 0.5, r.z1), 0.1, col(p.roofColor));
  } else {
    b.box('solid', r.x0, p.roofY, r.z0, r.x1, p.roofY + 0.18, r.z1, col('#2f3236'));
  }
}

// ---------------------------------------------------------------- yard

function poolMesh(b: MeshBuilder, r: { x0: number; x1: number; z0: number; z1: number }): void {
  const stone = col('#dcd6c8');
  const c = 0.45;
  b.box('water', r.x0, -0.2, r.z0, r.x1, 0.05, r.z1, col('#3aa6cc'));
  b.box('solid', r.x0 - c, 0, r.z0 - c, r.x1 + c, 0.1, r.z0, stone);
  b.box('solid', r.x0 - c, 0, r.z1, r.x1 + c, 0.1, r.z1 + c, stone);
  b.box('solid', r.x0 - c, 0, r.z0, r.x0, 0.1, r.z1, stone);
  b.box('solid', r.x1, 0, r.z0, r.x1 + c, 0.1, r.z1, stone);
  b.box('solid', r.x0 - 1.6, 0.02, r.z0 - c, r.x0 - c, 0.06, r.z1 + c, stone); // deck
}

function fenceMesh(b: MeshBuilder, f: Fence): void {
  const c = col(f.color);
  for (const s of f.segments) {
    const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
    const alongX = Math.abs(s.x1 - s.x0) > Math.abs(s.z1 - s.z0);
    const seg = (a: number, bb: number, y0: number, y1: number, thick: number) => {
      // a..bb are distances along the segment
      const ax = s.x0 + ((s.x1 - s.x0) * a) / len;
      const az = s.z0 + ((s.z1 - s.z0) * a) / len;
      const bx = s.x0 + ((s.x1 - s.x0) * bb) / len;
      const bz = s.z0 + ((s.z1 - s.z0) * bb) / len;
      if (alongX) b.box('solid', ax, y0, az - thick / 2, bx, y1, bz + thick / 2, c);
      else b.box('solid', ax - thick / 2, y0, az, bx + thick / 2, y1, bz, c);
    };
    const h = s.height ?? f.height;
    if (f.kind === 'hedge') {
      for (let a = 0; a < len; a += 2) {
        const hv = h * (0.92 + 0.16 * Math.abs(Math.sin(a * 3.7 + s.x0)));
        seg(a, Math.min(len, a + 2.05), 0, hv, 0.9);
      }
    } else if (f.kind === 'privacy') {
      seg(0, len, 0, h, 0.06);
      for (let a = 0; a <= len; a += 2.4) seg(Math.max(0, a - 0.06), Math.min(len, a + 0.06), 0, h + 0.08, 0.14);
    } else if (f.kind === 'iron') {
      // Low wrought-iron railing on a stone kerb.
      seg(0, len, 0, 0.15, 0.2);
      seg(0, len, h - 0.05, h, 0.05);
      seg(0, len, 0.3, 0.34, 0.03);
      for (let a = 0.08; a < len; a += 0.14) seg(a, Math.min(len, a + 0.025), 0.15, h + 0.06, 0.025);
      for (let a = 0; a <= len; a += 2.0) seg(Math.max(0, a - 0.06), Math.min(len, a + 0.06), 0, h + 0.12, 0.12);
    } else {
      seg(0, len, 0.35, 0.43, 0.04);
      if (h > 0.95) seg(0, len, 0.8, 0.88, 0.04);
      for (let a = 0.05; a < len; a += 0.26) seg(a, Math.min(len, a + 0.09), 0, h, 0.03);
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

function treeMesh(b: MeshBuilder, t: Tree): void {
  const s = t.scale;
  const leaf = col(t.color);
  const trunk = col(t.trunkColor);
  if (t.kind === 'shrub') {
    place(b, TEMPLATES.blob, t.x, 0.35 * s, t.z, 0.65 * s, 0.5 * s, 0.65 * s, t.rot, leaf);
  } else if (t.kind === 'round') {
    const th = 1.9 * s;
    b.box('solid', t.x - 0.13 * s, 0, t.z - 0.13 * s, t.x + 0.13 * s, th + 0.5, t.z + 0.13 * s, trunk);
    place(b, TEMPLATES.blob, t.x, th + 1.2 * s, t.z, 1.7 * s, 1.5 * s, 1.7 * s, t.rot, leaf);
    const dark = leaf.clone().multiplyScalar(0.85);
    place(b, TEMPLATES.blob, t.x + Math.cos(t.rot) * 0.8 * s, th + 2.0 * s, t.z + Math.sin(t.rot) * 0.8 * s, 1.1 * s, 1.0 * s, 1.1 * s, t.rot * 2, dark);
  } else {
    b.box('solid', t.x - 0.12 * s, 0, t.z - 0.12 * s, t.x + 0.12 * s, 1.2 * s, t.z + 0.12 * s, trunk);
    place(b, TEMPLATES.cone, t.x, 1.0 * s + 1.4 * s, t.z, 1.6 * s, 2.8 * s, 1.6 * s, t.rot, leaf);
    place(b, TEMPLATES.cone, t.x, 1.0 * s + 3.1 * s, t.z, 1.1 * s, 2.2 * s, 1.1 * s, t.rot + 0.4, leaf.clone().multiplyScalar(1.1));
  }
}
