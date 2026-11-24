/**
 * Landscape toolkit for parks and the zoo:
 *   - blobby lake polygons and geometry tests (point in polygon, segment crossings, distances)
 *   - a path network over "nodes" (gates, plazas, features, viewing points) on a visibility graph that also
 *     has waypoints round obstacle corners and the lake: each node joins the built network by its shortest
 *     route (a greedy Steiner tree), plus a few loops; single hops bow gently, routes through waypoints are
 *     Chaikin-smoothed, and hops across the lake become a straight walk with an arched footbridge
 *   - furniture along walks (lamps, benches facing the path, bins)
 *   - clumped tree planting (Gaussian clusters + singles) that keeps off walks, water, features
 */
import type { RNG } from '../../../core/rng';
import { treeColor } from '../../details/planting';
import type { Rect, Tree, Walkway } from '../../spec';
import type { Site } from './site';

export type Pt = [number, number];

export interface GNode {
  x: number;
  z: number;
  /** Keep-out radius: walks start at this distance from the centre, other walks keep clear of it. */
  r: number;
  /** How close walks come to the centre (default 0.92 r), e.g. up to a gazebo's paving. */
  reach?: number;
  gate?: boolean;
}

// ---------------------------------------------------------------- geometry

export function blobPoly(rng: RNG, cx: number, cz: number, rx: number, rz: number, n = 22, rough = 1): Pt[] {
  const p1 = rng.range(0, 6.28);
  const p2 = rng.range(0, 6.28);
  const p3 = rng.range(0, 6.28);
  const a2 = rng.range(0.08, 0.2) * rough;
  const a3 = rng.range(0.05, 0.13) * rough;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const k = 1 + a2 * Math.sin(2 * t + p1) + a3 * Math.sin(3 * t + p2) + 0.04 * rough * Math.sin(5 * t + p3) + rng.range(-0.025, 0.025) * rough;
    out.push([cx + Math.cos(t) * rx * k, cz + Math.sin(t) * rz * k]);
  }
  return out;
}

export function inPoly(x: number, z: number, pts: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Polygon grown (shrunk if negative) by `d` metres about its centroid. */
export function grow(pts: Pt[], d: number): Pt[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    return [x + ((x - cx) / l) * d, z + ((z - cz) / l) * d];
  });
}

export function polyBounds(pts: Pt[]): Rect {
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), z0: Math.min(...pts.map((p) => p[1])), z1: Math.max(...pts.map((p) => p[1])) };
}

/** Parameters t0..t1 (0..1 along a->b) where the segment is inside the polygon, or null. */
export function crossPoly(a: Pt, b: Pt, pts: Pt[]): [number, number] | null {
  const ts: number[] = [];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ex = pts[i][0] - pts[j][0];
    const ez = pts[i][1] - pts[j][1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((pts[j][0] - a[0]) * ez - (pts[j][1] - a[1]) * ex) / den;
    const u = ((pts[j][0] - a[0]) * dz - (pts[j][1] - a[1]) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) ts.push(t);
  }
  if (inPoly(a[0], a[1], pts)) ts.push(0);
  if (inPoly(b[0], b[1], pts)) ts.push(1);
  if (ts.length < 2) return null;
  ts.sort((p, q) => p - q);
  return [ts[0], ts[ts.length - 1]];
}

export function distSeg(px: number, pz: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

/** Segment vs rect (grown by pad), Liang-Barsky. */
export function segHitsRect(a: Pt, b: Pt, r: Rect, pad: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, a[0] - (r.x0 - pad)) && clip(dx, r.x1 + pad - a[0]) && clip(-dz, a[1] - (r.z0 - pad)) && clip(dz, r.z1 + pad - a[1]);
}

function segsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export const inRect = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

// ---------------------------------------------------------------- path network

export interface NetworkOpts {
  width: number;
  lake?: Pt[];
  blockers: Rect[];
  /** Longest water crossing that gets a bridge (m). */
  maxBridge?: number;
  /** Chance of adding each short non-tree edge as a loop. */
  loops?: number;
  /** Max sideways bow of a walk, as a fraction of its length. */
  curve?: number;
  bridgeColor?: string;
  railColor?: string;
}

/** Builds walks between nodes; returns the walks (also pushed to the site) for furnishing / tree avoidance. */
export function buildNetwork(s: Site, nodes: GNode[], o: NetworkOpts): Walkway[] {
  const { rng } = s;
  const maxBridge = o.maxBridge ?? 26;
  const hw = o.width / 2;
  const lakeOuter = o.lake ? grow(o.lake, hw + 1.2) : undefined;
  const inLot = (x: number, z: number, m: number) => x > m && x < s.W - m && z > m && z < s.D - m;

  // Waypoints just outside blocker corners and around the lake let walks go round obstacles.
  const verts: GNode[] = nodes.map((n) => ({ ...n }));
  const nReal = nodes.length;
  const wpOk = (x: number, z: number) =>
    inLot(x, z, hw + 0.8) && !o.blockers.some((r) => inRect(r, x, z, hw + 0.6)) && !(lakeOuter && inPoly(x, z, lakeOuter)) &&
    verts.every((v) => Math.hypot(v.x - x, v.z - z) > Math.max(v.r, 1.5) + 1.5);
  const off = hw + 2.2;
  for (const r of o.blockers) {
    for (const [x, z] of [[r.x0 - off, r.z0 - off], [r.x1 + off, r.z0 - off], [r.x0 - off, r.z1 + off], [r.x1 + off, r.z1 + off]] as Pt[]) if (wpOk(x, z)) verts.push({ x, z, r: 0 });
  }
  if (o.lake) {
    const ring = grow(o.lake, hw + 2.6);
    const step = Math.max(1, Math.floor(ring.length / 10));
    for (let i = 0; i < ring.length; i += step) if (wpOk(ring[i][0], ring[i][1])) verts.push({ x: ring[i][0], z: ring[i][1], r: 0 });
  }
  const isWp = (i: number) => i >= nReal;

  interface Edge { i: number; j: number; len: number; cost: number; bridge?: [number, number] }
  const P = (n: GNode): Pt => [n.x, n.z];
  const adj: Edge[][] = verts.map(() => []);
  const all: Edge[] = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const a = verts[i];
      const b = verts[j];
      if (a.gate && b.gate) continue;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.5 || len > 90) continue;
      if (verts.some((c, k) => k !== i && k !== j && c.r > 0 && distSeg(c.x, c.z, P(a), P(b)) < c.r + 1.4)) continue;
      if (o.blockers.some((r) => segHitsRect(P(a), P(b), r, hw + 0.4))) continue;
      let bridge: [number, number] | undefined;
      if (o.lake) {
        const cr = crossPoly(P(a), P(b), o.lake);
        if (cr) {
          const span = (cr[1] - cr[0]) * len;
          if (isWp(i) || isWp(j) || span > maxBridge || cr[0] * len < a.r + 2.5 || (1 - cr[1]) * len < b.r + 2.5) continue;
          bridge = cr;
        } else if (lakeOuter && crossPoly(P(a), P(b), lakeOuter)) continue; // don't graze the shore
      }
      // Waypoint hops cost a little extra so direct walks win when they exist.
      const e: Edge = { i, j, len, cost: len * (bridge ? 1.2 : 1) + (isWp(i) || isWp(j) ? 1.5 : 0), bridge };
      all.push(e);
      adj[i].push(e);
      adj[j].push(e);
    }
  }

  // Connect real nodes one at a time by their shortest route (Dijkstra) to the part already built.
  const chosen = new Set<Edge>();
  const built = new Set<number>([0]);
  const connected = new Set<number>([0]);
  for (let round = 1; round < nReal; round++) {
    const dist = new Array(verts.length).fill(Infinity);
    const prev: (Edge | undefined)[] = new Array(verts.length).fill(undefined);
    const done = new Array(verts.length).fill(false);
    for (const v of built) dist[v] = 0;
    for (;;) {
      let u = -1;
      for (let k = 0; k < verts.length; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0) break;
      done[u] = true;
      // Paths may pass through waypoints and built vertices, but not through other unconnected real nodes.
      if (u !== 0 && !built.has(u) && !isWp(u)) continue;
      for (const e of adj[u]) {
        const w = e.i === u ? e.j : e.i;
        const nd = dist[u] + (chosen.has(e) ? e.cost * 0.3 : e.cost);
        if (nd < dist[w]) {
          dist[w] = nd;
          prev[w] = e;
        }
      }
    }
    let target = -1;
    for (let k = 1; k < nReal; k++) if (!connected.has(k) && dist[k] < Infinity && (target < 0 || dist[k] < dist[target])) target = k;
    if (target < 0) break;
    connected.add(target);
    for (let v = target; !built.has(v); ) {
      const e = prev[v]!;
      chosen.add(e);
      built.add(v);
      v = e.i === v ? e.j : e.i;
    }
    built.add(target);
  }

  // A few loops between real nodes, and at least one bridge over a lake.
  const segOf = (e: Edge): [Pt, Pt] => [P(verts[e.i]), P(verts[e.j])];
  const crossesChosen = (e: Edge) => {
    const [a, b] = segOf(e);
    for (const c of chosen) {
      if (c.i === e.i || c.i === e.j || c.j === e.i || c.j === e.j) continue;
      const [p, q] = segOf(c);
      if (segsCross(a, b, p, q)) return true;
    }
    return false;
  };
  const realEdges = all.filter((e) => !isWp(e.i) && !isWp(e.j) && !chosen.has(e) && connected.has(e.i) && connected.has(e.j));
  const lens = [...chosen].map((e) => e.len).sort((p, q) => p - q);
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
  let added = 0;
  for (const e of realEdges.sort((p, q) => p.cost - q.cost)) {
    if (added >= Math.ceil(nReal / 3) || e.len > median * 1.8) break;
    if (!rng.chance(o.loops ?? 0.3) || crossesChosen(e)) continue;
    chosen.add(e);
    added++;
  }
  if (o.lake && ![...chosen].some((e) => e.bridge) && rng.chance(0.9)) {
    const b = realEdges.filter((e) => e.bridge && !chosen.has(e) && !crossesChosen(e)).sort((p, q) => p.cost - q.cost)[0];
    if (b) chosen.add(b);
  }

  // Render: bridges on their own; chains through degree-2 waypoints become one smoothed polyline.
  // Interior walk points keep a path-width off every feature except the walk's own end nodes.
  const okPoint = (x: number, z: number, ends: number[]) =>
    !(lakeOuter && inPoly(x, z, lakeOuter)) && !o.blockers.some((r) => inRect(r, x, z, hw + 0.3)) &&
    !nodes.some((c, k) => c.r > 0 && !ends.includes(k) && Math.hypot(c.x - x, c.z - z) < c.r + hw + 0.2) && inLot(x, z, 0.3);
  const walks: Walkway[] = [];
  const trimFrom = (n: GNode, toward: Pt): Pt => {
    const dx = toward[0] - n.x;
    const dz = toward[1] - n.z;
    const l = Math.hypot(dx, dz) || 1;
    const reach = n.reach ?? n.r * 0.92;
    return [n.x + (dx / l) * reach, n.z + (dz / l) * reach];
  };
  const deg = new Array(verts.length).fill(0);
  for (const e of chosen) if (!e.bridge) {
    deg[e.i]++;
    deg[e.j]++;
  }
  const used = new Set<Edge>();
  const plain = [...chosen].filter((e) => !e.bridge);
  const nextEdge = (v: number, from: Edge) => plain.find((e) => e !== from && !used.has(e) && (e.i === v || e.j === v));
  for (const e of chosen) {
    if (!e.bridge) continue;
    const a = verts[e.i];
    const b = verts[e.j];
    const ux = (b.x - a.x) / e.len;
    const uz = (b.z - a.z) / e.len;
    const t0 = e.bridge[0] * e.len - 1.6;
    const t1 = e.bridge[1] * e.len + 1.6;
    const e0: Pt = [a.x + ux * t0, a.z + uz * t0];
    const e1: Pt = [a.x + ux * t1, a.z + uz * t1];
    walks.push({ pts: [trimFrom(a, P(b)), e0], width: o.width }, { pts: [e1, trimFrom(b, P(a))], width: o.width });
    const span = t1 - t0;
    s.props.push({ kind: 'footbridge', x: (e0[0] + e1[0]) / 2, y: 0.02, z: (e0[1] + e1[1]) / 2, rot: Math.atan2(ux, uz), color: o.bridgeColor ?? '#9a7550', color2: o.railColor ?? '#5a3e2b', w: o.width + 0.4, d: span + 0.4, h: Math.min(1.8, 0.7 + span * 0.05) });
  }
  for (const start of plain) {
    if (used.has(start)) continue;
    // Walk outwards from this edge both ways while the shared vertex is a degree-2 waypoint.
    used.add(start);
    const chain: number[] = [start.i, start.j];
    for (const dir of [0, 1]) {
      let edge = start;
      let v = dir === 0 ? start.j : start.i;
      while (isWp(v) && deg[v] === 2) {
        const nx = nextEdge(v, edge);
        if (!nx) break;
        used.add(nx);
        v = nx.i === v ? nx.j : nx.i;
        if (dir === 0) chain.push(v);
        else chain.unshift(v);
        edge = nx;
      }
    }
    let pts: Pt[] = chain.map((k) => P(verts[k]));
    const first = verts[chain[0]];
    const last = verts[chain[chain.length - 1]];
    pts[0] = trimFrom(first, pts[1]);
    pts[pts.length - 1] = trimFrom(last, pts[pts.length - 2]);
    if (pts.length === 2) {
      // Single hop: gentle quadratic bow, either side, else straight.
      const [s0, s1] = pts;
      const sl = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
      const ux = (s1[0] - s0[0]) / (sl || 1);
      const uz = (s1[1] - s0[1]) / (sl || 1);
      const n = Math.max(2, Math.ceil(sl / 3));
      const bow = rng.range(-1, 1) * (o.curve ?? 0.15) * sl;
      for (const offs of [bow, -bow]) {
        if (Math.abs(offs) < 0.3) break;
        const cx = (s0[0] + s1[0]) / 2 - uz * offs;
        const cz = (s0[1] + s1[1]) / 2 + ux * offs;
        const cand: Pt[] = [];
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          cand.push([(1 - t) * (1 - t) * s0[0] + 2 * (1 - t) * t * cx + t * t * s1[0], (1 - t) * (1 - t) * s0[1] + 2 * (1 - t) * t * cz + t * t * s1[1]]);
        }
        if (cand.slice(1, -1).every(([x, z]) => okPoint(x, z, [chain[0], chain[chain.length - 1]]))) {
          pts = cand;
          break;
        }
      }
    } else {
      // Chaikin smoothing around the waypoints (kept only if it stays clear).
      let sm = pts;
      for (let it = 0; it < 2; it++) {
        const out: Pt[] = [sm[0]];
        for (let k = 0; k < sm.length - 1; k++) {
          const [ax, az] = sm[k];
          const [bx, bz] = sm[k + 1];
          if (k > 0) out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
          if (k < sm.length - 2) out.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
        }
        out.push(sm[sm.length - 1]);
        sm = out;
      }
      if (sm.slice(1, -1).every(([x, z]) => okPoint(x, z, [chain[0], chain[chain.length - 1]]))) pts = sm;
    }
    walks.push({ pts, width: o.width });
  }
  s.walks.push(...walks);
  return walks;
}

// ---------------------------------------------------------------- furnishing & planting

export function distToWalks(x: number, z: number, walks: Walkway[]): number {
  let d = Infinity;
  for (const w of walks) for (let i = 0; i < w.pts.length - 1; i++) d = Math.min(d, distSeg(x, z, w.pts[i], w.pts[i + 1]) - w.width / 2);
  return d;
}

/** Lamps on one side, benches (facing the walk) and bins on the other, every `every` metres. */
export function furnishWalks(s: Site, walks: Walkway[], every: number, ok: (x: number, z: number) => boolean): void {
  const { rng } = s;
  for (const w of walks) {
    let acc = every * rng.range(0.3, 0.7);
    for (let i = 0; i < w.pts.length - 1; i++) {
      const [ax, az] = w.pts[i];
      const [bx, bz] = w.pts[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 1e-6) continue;
      const tx = (bx - ax) / l;
      const tz = (bz - az) / l;
      while (acc <= l) {
        const x = ax + tx * acc;
        const z = az + tz * acc;
        const side = rng.chance(0.5) ? 1 : -1;
        const nx = -tz * side;
        const nz = tx * side;
        const off = w.width / 2;
        const lx = x + nx * (off + 0.6);
        const lz = z + nz * (off + 0.6);
        if (ok(lx, lz)) s.lights.push({ kind: 'post', x: lx, y: 0.05, z: lz, rot: 0 });
        if (rng.chance(0.65)) {
          const bxp = x - nx * (off + 0.75);
          const bzp = z - nz * (off + 0.75);
          // bench faces the walk: its front (-z local) must point along +n
          if (ok(bxp, bzp)) {
            s.props.push({ kind: 'bench', x: bxp, y: 0.05, z: bzp, rot: Math.atan2(-nx, -nz), color: '#6b4a33' });
            if (rng.chance(0.3) && ok(bxp + tx * 1.4, bzp + tz * 1.4)) s.props.push({ kind: 'litterBin', x: bxp + tx * 1.4, y: 0.05, z: bzp + tz * 1.4, rot: 0, color: '#2d4f3c' });
          }
        }
        acc += every;
      }
      acc -= l;
    }
  }
}

/** Clumps of trees (Gaussian around random centres) plus loose singles, wherever `ok` allows. */
export function plantClumps(s: Site, count: number, ok: (x: number, z: number, r: number) => boolean, coniferShare = 0.2, region?: Rect): void {
  const { rng } = s;
  const reg = region ?? { x0: 1, x1: s.W - 1, z0: 1, z1: s.D - 1 };
  const radiusOf = (t: Tree) => (t.kind === 'shrub' ? 0.7 : 1.8) * t.scale;
  const tryTree = (x: number, z: number, kind: Tree['kind']) => {
    const scale = kind === 'shrub' ? rng.range(0.8, 1.3) : rng.range(0.85, 1.45);
    const r = (kind === 'shrub' ? 0.7 : 1.8) * scale;
    if (!inRect(reg, x, z) || !ok(x, z, r)) return false;
    if (s.trees.some((t) => Math.hypot(t.x - x, t.z - z) < (r + radiusOf(t)) * 0.8)) return false;
    s.trees.push({ kind, x, z, scale, rot: rng.range(0, 6.28), color: treeColor(rng, kind), trunkColor: '#6b4a33' });
    return true;
  };
  const pickKind = (): Tree['kind'] => (rng.chance(0.12) ? 'shrub' : rng.chance(coniferShare) ? 'cone' : 'round');
  let planted = 0;
  let guard = 0;
  while (planted < count && guard++ < count * 6) {
    const cx = rng.range(reg.x0, reg.x1);
    const cz = rng.range(reg.z0, reg.z1);
    if (!ok(cx, cz, 2)) continue;
    const size = rng.chance(0.3) ? 1 : rng.int(3, 9);
    const sigma = rng.range(2.5, 6);
    const kind = pickKind();
    for (let k = 0; k < size * 3 && planted < count; k++) {
      // Box-Muller
      const u = Math.max(1e-6, rng.next());
      const v = rng.next();
      const rr = sigma * Math.sqrt(-2 * Math.log(u));
      if (tryTree(cx + Math.cos(6.283 * v) * rr, cz + Math.sin(6.283 * v) * rr, rng.chance(0.8) ? kind : pickKind())) planted++;
      if (k >= size && rng.chance(0.5)) break;
    }
  }
}

/** Perimeter fence (any kind) with gaps around gate points on the lot edges. */
export function perimeterFence(s: Site, kind: 'hedge' | 'iron' | 'privacy' | 'picket', color: string, height: number, gates: Pt[], gap = 5, r?: Rect): void {
  const e = kind === 'hedge' ? 0.5 : 0.3;
  const R = r ?? { x0: e, x1: s.W - e, z0: e, z1: s.D - e };
  const sides: [Pt, Pt][] = [[[R.x0, R.z0], [R.x1, R.z0]], [[R.x1, R.z0], [R.x1, R.z1]], [[R.x0, R.z1], [R.x1, R.z1]], [[R.x0, R.z0], [R.x0, R.z1]]];
  const segs: { x0: number; z0: number; x1: number; z1: number }[] = [];
  for (const [a, b] of sides) {
    const alongX = a[1] === b[1];
    const cuts = gates
      .filter((g) => (alongX ? Math.abs(g[1] - a[1]) < 1.5 : Math.abs(g[0] - a[0]) < 1.5))
      .map((g) => (alongX ? g[0] : g[1]))
      .sort((p, q) => p - q);
    let t = alongX ? a[0] : a[1];
    const end = alongX ? b[0] : b[1];
    for (const c of cuts) {
      if (c - gap / 2 > t) segs.push(alongX ? { x0: t, z0: a[1], x1: c - gap / 2, z1: a[1] } : { x0: a[0], z0: t, x1: a[0], z1: c - gap / 2 });
      t = Math.max(t, c + gap / 2);
    }
    if (end > t) segs.push(alongX ? { x0: t, z0: a[1], x1: end, z1: a[1] } : { x0: a[0], z0: t, x1: a[0], z1: end });
  }
  s.fences.push({ kind, color, height, segments: segs.filter((q) => Math.hypot(q.x1 - q.x0, q.z1 - q.z0) > 0.4) });
}
