/**
 * Landscaped grounds, laid out probabilistically rather than on a grid:
 *
 *   park -> a style (formal / natural / sporty) sets path curvature, lake odds, tree density and the
 *           feature mix. Gates on the street side (sometimes the sides / back too), maybe a blobby lake,
 *           then 3-9 features dropped by rejection sampling (fountain plaza, playground, gazebo with
 *           picnic tables, court, statue, flower garden, toilets + kiosk, small pond) and a couple of
 *           path junctions. Walks join everything as a spanning tree plus a few loops; walks over the lake
 *           become arched footbridges. Lamps / benches along the walks, trees in Gaussian clumps.
 *
 *   zoo  -> street forecourt with ticket office, gift shop, entrance arch and car park; inside a fenced
 *           ground: a hub plaza, a flamingo lake (bridged), animal enclosures (savanna, elephants, big
 *           cats, bears, hippos, rhinos, penguins, antelope) with their own ground, pools, rocks, trees
 *           and animals, a viewing point on the side facing the hub, plus a reptile house, cafe, toilets
 *           and an aviary, all joined by the same curving path network.
 */
import type { Mass, Rect, WallSide } from '../../spec';
import { Site, jitter } from './site';
import {
  blobPoly, buildNetwork, distToWalks, furnishWalks, grow, inPoly, inRect, perimeterFence, plantClumps, polyBounds,
  type GNode, type Pt,
} from './grounds';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const PLAY = ['#e74c3c', '#f1c40f', '#2e86de', '#27ae60', '#e67e22'];
const overlap = (a: Rect, b: Rect, pad: number) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;
/** rot that makes a prop's front (-z local) face direction (fx, fz). */
const facing = (fx: number, fz: number) => Math.atan2(-fx, -fz);

type Feature = 'fountain' | 'playground' | 'gazebo' | 'court' | 'statue' | 'toilets' | 'garden' | 'pond';
const RADIUS: Record<Feature, [number, number]> = {
  fountain: [6, 8.5], playground: [10.5, 10.5], gazebo: [6.5, 7], court: [16.5, 16.5], statue: [4.2, 5], toilets: [6.5, 6.5], garden: [7, 8], pond: [8, 9],
};

function buildFeature(s: Site, f: Feature, n: GNode, blockers: Rect[]): void {
  const { rng } = s;
  const { x, z, r } = n;
  switch (f) {
    case 'fountain': {
      s.plazas.push({ x, z, r });
      const bw = r * 0.38;
      s.props.push({ kind: 'fountain', x, y: 0.05, z, rot: 0, color: '#d8d2c4', w: bw });
      s.animated.push({ kind: 'spray', x, y: 1.98, z, height: rng.range(2, 3.4), radius: bw * 0.72 });
      const nb = rng.int(4, 6);
      const a0 = rng.range(0, 6.28);
      for (let k = 0; k < nb; k++) {
        const a = a0 + (k / nb) * Math.PI * 2;
        s.props.push({ kind: 'bench', x: x + Math.cos(a) * (r - 1.3), y: 0.05, z: z + Math.sin(a) * (r - 1.3), rot: facing(-Math.cos(a), -Math.sin(a)), color: '#6b4a33' });
        const al = a + Math.PI / nb;
        s.lights.push({ kind: 'post', x: x + Math.cos(al) * (r - 0.5), y: 0.05, z: z + Math.sin(al) * (r - 0.5), rot: 0 });
      }
      return;
    }
    case 'playground': {
      const x0 = x - 8;
      const z0 = z - 6;
      n.reach = 6.4; // run onto the soft surface
      s.court('playground', { x0, x1: x0 + 16, z0, z1: z0 + 12 });
      const c = () => rng.pick(PLAY);
      s.props.push({ kind: 'climbingFrame', x: x0 + 3.5, y: 0.08, z: z0 + 7, rot: 0, color: c(), color2: c() });
      s.props.push({ kind: 'swing', x: x0 + 10, y: 0.08, z: z0 + 3.5, rot: 0, color: c(), color2: c() });
      s.props.push({ kind: 'seesaw', x: x0 + 10, y: 0.08, z: z0 + 9, rot: 0, color: c() });
      s.props.push({ kind: 'slide', x: x0 + 14.5, y: 0.08, z: z0 + 7, rot: 0, color: c(), color2: '#9aa0a6' });
      s.props.push({ kind: 'bench', x: x0 + 8, y: 0.05, z: z0 + 12.9, rot: Math.PI, color: '#6b4a33' });
      return;
    }
    case 'gazebo': {
      s.plazas.push({ x, z, r: 3.6 });
      n.reach = 3.3;
      s.props.push({ kind: 'gazebo', x, y: 0.05, z, rot: 0, color: rng.pick(['#a0473a', '#3f5f7a', '#2d4f3c', '#f4f1ea']), w: 2.6 });
      const nt = rng.int(2, 4);
      const a0 = rng.range(0, 6.28);
      for (let k = 0; k < nt; k++) {
        const a = a0 + (k / nt) * Math.PI * 2;
        s.props.push({ kind: 'picnicTable', x: x + Math.cos(a) * 5.2, y: 0.05, z: z + Math.sin(a) * 5.2, rot: -a, color: '#8a6a4a' });
      }
      return;
    }
    case 'court': {
      const kind = rng.chance(0.6) ? 'basketball' : 'tennis';
      n.reach = 8;
      if (kind === 'basketball') {
        s.court('basketball', { x0: x - 14, x1: x + 14, z0: z - 7.5, z1: z + 7.5 });
        s.props.push({ kind: 'basketballHoop', x: x - 13.5, y: 0.08, z, rot: -Math.PI / 2, color: '#9aa0a6' });
        s.props.push({ kind: 'basketballHoop', x: x + 13.5, y: 0.08, z, rot: Math.PI / 2, color: '#9aa0a6' });
      } else {
        const rr = { x0: x - 12, x1: x + 12, z0: z - 6, z1: z + 6 };
        s.court('tennis', rr);
        s.fences.push({ kind: 'iron', color: '#2f5f3a', height: 3, segments: [{ x0: rr.x0, z0: rr.z0, x1: rr.x1, z1: rr.z0 }, { x0: rr.x0, z0: rr.z1, x1: rr.x1, z1: rr.z1 }, { x0: rr.x0, z0: rr.z0, x1: rr.x0, z1: rr.z1 }, { x0: rr.x1, z0: rr.z0, x1: rr.x1, z1: rr.z1 }] });
      }
      return;
    }
    case 'statue': {
      s.plazas.push({ x, z, r, color: jitter('#cfc8bb', rng, 0.04) });
      s.props.push({ kind: 'statue', x, y: 0.05, z, rot: rng.range(0, 6.28), color: rng.pick(['#6b5a3a', '#4f7a6a', '#8a7a5a']) });
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) if (rng.chance(0.6)) s.props.push({ kind: 'planter', x: x + Math.cos(a + 0.785) * (r - 1), y: 0.05, z: z + Math.sin(a + 0.785) * (r - 1), rot: -a, color: '#8f8a83', w: 1.2 });
      return;
    }
    case 'toilets': {
      const t = s.mass('unit', { x0: x - 3, x1: x + 3, z0: z - 2, z1: z + 2 }, 1, 3, jitter('#d9cfbd', rng, 0.04), { color: '#6b6e72' });
      s.opening(t, 'front', 0.3, 'door', 1, 2.1, '#3f5f7a');
      s.opening(t, 'front', 0.7, 'door', 1, 2.1, '#a0473a');
      s.props.push({ kind: 'stall', x: x + (rng.chance(0.5) ? -4.8 : 4.8), y: 0.05, z: z - 1, rot: 0, color: rng.pick(['#c0392b', '#1f6fb5', '#f39c12']) });
      s.plazas.push({ x, z, r: 4.6 });
      n.reach = 4.3;
      return;
    }
    case 'garden': {
      s.plazas.push({ x, z, r: 2.4 });
      s.plazas.push({ x, z, r: 6.4, color: jitter('#d8cdb8', rng, 0.03) });
      n.reach = 6.1;
      s.props.push({ kind: rng.chance(0.5) ? 'statue' : 'planter', x, y: 0.05, z, rot: 0, color: '#8a7a5a', w: 1.4 });
      const nb = rng.int(5, 7);
      const flower = rng.pick(['#e74c3c', '#f1c40f', '#e84393', '#9b59b6', '#ff8c42']);
      for (let k = 0; k < nb; k++) {
        const a = (k / nb) * Math.PI * 2;
        s.props.push({ kind: 'gardenBed', x: x + Math.cos(a) * 4.8, y: 0.05, z: z + Math.sin(a) * 4.8, rot: -a - Math.PI / 2, color: '#6b4a33', color2: rng.chance(0.7) ? flower : rng.pick(PLAY) });
      }
      return;
    }
    case 'pond': {
      s.water.push({ pts: blobPoly(rng, x, z, r * 0.7, r * 0.5, 18) });
      for (let k = 0; k < 4; k++) {
        const a = rng.range(0, 6.28);
        s.props.push({ kind: 'rock', x: x + Math.cos(a) * r * 0.78, y: 0.03, z: z + Math.sin(a) * r * 0.58, rot: a, color: '#9a958a', w: rng.range(0.5, 1) });
      }
      return;
    }
  }
}

/** True if a disc (x, z, r) is clear of the lake (grown by `pad`). */
const clearOfLake = (lake: Pt[] | undefined, x: number, z: number, r: number, pad: number) => {
  if (!lake) return true;
  const g = grow(lake, pad);
  if (inPoly(x, z, g)) return false;
  for (let k = 0; k < 8; k++) if (inPoly(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r, g)) return false;
  return true;
};

export function park(s: Site): void {
  const { rng, W, D } = s;
  s.lawnColor = jitter(rng.pick(['#6fae4a', '#79b552', '#68a447']), rng, 0.04);
  s.pavingColor = jitter(rng.pick(['#d8cdb8', '#c9bfae', '#cfc8bb', '#b9b2a6']), rng, 0.03);
  const style = rng.weighted<'formal' | 'natural' | 'sporty'>([['formal', 25], ['natural', 55], ['sporty', 20]]);
  s.info.style = style;
  const curve = style === 'formal' ? 0.02 : style === 'natural' ? 0.22 : 0.12;

  // Gates: street side always, sides / back sometimes.
  const gates: GNode[] = [];
  const nFront = W > 70 && rng.chance(0.5) ? 2 : 1;
  for (let i = 0; i < nFront; i++) gates.push({ x: nFront === 1 ? rng.range(0.3, 0.7) * W : (i === 0 ? rng.range(0.15, 0.35) : rng.range(0.65, 0.85)) * W, z: 0.3, r: 0, gate: true });
  if (rng.chance(0.45)) gates.push({ x: 0.3, z: rng.range(0.35, 0.8) * D, r: 0, gate: true });
  if (rng.chance(0.45)) gates.push({ x: W - 0.3, z: rng.range(0.35, 0.8) * D, r: 0, gate: true });
  if (rng.chance(0.3)) gates.push({ x: rng.range(0.25, 0.75) * W, z: D - 0.3, r: 0, gate: true });

  // Lake.
  let lake: Pt[] | undefined;
  if (W * D > 3000 && rng.chance(style === 'natural' ? 0.8 : 0.4)) {
    const rx = clamp(W * rng.range(0.13, 0.24), 7, 22);
    const rz = clamp(D * rng.range(0.13, 0.24), 6, 18);
    const lx = rng.range(rx + 9, W - rx - 9);
    const lz = rng.range(rz + 12, D - rz - 8);
    lake = blobPoly(rng, lx, lz, rx, rz, 26, style === 'formal' ? 0.3 : 1);
    s.water.push({ pts: lake, shore: rng.pick(['#cdbf9c', '#a39d92', '#b9ae8f']) });
    const ring = grow(lake, 0.7);
    for (let k = 0; k < rng.int(3, 8); k++) {
      const p = ring[rng.int(0, ring.length - 1)];
      s.props.push({ kind: 'rock', x: p[0], y: 0.03, z: p[1], rot: rng.range(0, 6.28), color: '#9a958a', w: rng.range(0.5, 1.2) });
    }
  }

  // Features, by style.
  const weights: [Feature, number][] =
    style === 'formal' ? [['fountain', 5], ['statue', 4], ['garden', 5], ['gazebo', 2], ['playground', 2], ['toilets', 1], ['court', 0.5], ['pond', 1]]
      : style === 'natural' ? [['fountain', 1], ['statue', 1], ['garden', 2], ['gazebo', 4], ['playground', 3], ['toilets', 2], ['court', 1], ['pond', 2]]
        : [['fountain', 1], ['statue', 1], ['garden', 1], ['gazebo', 2], ['playground', 4], ['toilets', 2], ['court', 6], ['pond', 1]];
  const maxOf: Record<Feature, number> = { fountain: 1, playground: 2, gazebo: 2, court: style === 'sporty' ? 3 : 1, statue: 2, toilets: 1, garden: 2, pond: lake ? 0 : 1 };
  const used: Record<string, number> = {};
  const count = clamp(Math.round((W * D) / 850), 3, 9);
  const nodes: { n: GNode; f: Feature }[] = [];
  const blockers: Rect[] = [];
  const fits = (x: number, z: number, r: number) =>
    x > r + 3 && x < W - r - 3 && z > r + 4 && z < D - r - 3 &&
    nodes.every((o) => Math.hypot(o.n.x - x, o.n.z - z) > o.n.r + r + 5) &&
    gates.every((g) => Math.hypot(g.x - x, g.z - z) > r + 6) &&
    clearOfLake(lake, x, z, r, 3);
  // Formal parks put a fountain on the central axis first.
  if (style === 'formal') {
    const r = rng.range(...RADIUS.fountain);
    for (let k = 0; k < 30; k++) {
      const x = W / 2 + rng.range(-0.08, 0.08) * W;
      const z = D * rng.range(0.4, 0.6);
      if (fits(x, z, r)) {
        nodes.push({ n: { x, z, r }, f: 'fountain' });
        used.fountain = 1;
        break;
      }
    }
  }
  for (let i = nodes.length; i < count; i++) {
    const avail = weights.filter(([f]) => (used[f] ?? 0) < maxOf[f]);
    if (!avail.length) break;
    const f = rng.weighted(avail);
    const r = rng.range(...RADIUS[f]);
    for (let k = 0; k < 40; k++) {
      const x = rng.range(r + 3, W - r - 3);
      const z = rng.range(r + 4, D - r - 3);
      if (!fits(x, z, r)) continue;
      nodes.push({ n: { x, z, r }, f });
      used[f] = (used[f] ?? 0) + 1;
      break;
    }
  }
  // A couple of bare junctions make the network branch more naturally.
  const junctions: GNode[] = [];
  for (let k = 0; k < rng.int(0, 2) + (W * D > 6000 ? 1 : 0); k++) {
    for (let t = 0; t < 20; t++) {
      const x = rng.range(8, W - 8);
      const z = rng.range(8, D - 8);
      if (!fits(x, z, 2.2) || junctions.some((j) => Math.hypot(j.x - x, j.z - z) < 12)) continue;
      junctions.push({ x, z, r: 2.6 });
      s.plazas.push({ x, z, r: 3 });
      // a shade tree in a round bed, with a bench under it
      s.props.push({ kind: 'planter', x, y: 0.05, z, rot: 0, color: '#a39d92', w: 1.4 });
      s.trees.push({ kind: 'round', x, z, scale: 1.25, rot: rng.range(0, 6.28), color: jitter('#4f8a3a', rng, 0.06), trunkColor: '#6b4a33' });
      const ba = rng.range(0, 6.28);
      s.props.push({ kind: 'bench', x: x + Math.cos(ba) * 1.9, y: 0.05, z: z + Math.sin(ba) * 1.9, rot: facing(Math.cos(ba), Math.sin(ba)), color: '#6b4a33' });
      break;
    }
  }
  for (const { n, f } of nodes) buildFeature(s, f, n, blockers);
  s.info.features = nodes.map((n) => n.f).join(', ');

  // Paths.
  const width = style === 'formal' ? rng.range(2.8, 3.6) : rng.range(2.2, 3);
  const allNodes = [...gates, ...nodes.map((n) => n.n), ...junctions];
  const walks = buildNetwork(s, allNodes, { width, lake, blockers, curve, loops: style === 'formal' ? 0.5 : 0.3 });
  const lakeOk = lake ? grow(lake, 1.2) : undefined;
  const ok = (x: number, z: number) =>
    x > 0.8 && x < W - 0.8 && z > 0.8 && z < D - 0.8 && !(lakeOk && inPoly(x, z, lakeOk)) &&
    allNodes.every((n) => Math.hypot(n.x - x, n.z - z) > n.r + 0.6) && !blockers.some((r) => inRect(r, x, z, 0.5)) &&
    distToWalks(x, z, walks) > 0.25;
  furnishWalks(s, walks, rng.range(12, 18), ok);

  // Formal parks: avenues of trees along the walks.
  if (style === 'formal') {
    for (const w of walks) {
      for (let i = 0; i < w.pts.length - 1; i++) {
        const [ax, az] = w.pts[i];
        const [bx, bz] = w.pts[i + 1];
        const l = Math.hypot(bx - ax, bz - az);
        for (let t = 3; t < l; t += 8) {
          for (const sd of [-1, 1]) {
            const x = ax + ((bx - ax) * t) / l - ((bz - az) / l) * sd * (w.width / 2 + 2.2);
            const z = az + ((bz - az) * t) / l + ((bx - ax) / l) * sd * (w.width / 2 + 2.2);
            if (ok(x, z) && distToWalks(x, z, walks) > 1.2 && !s.trees.some((tr) => Math.hypot(tr.x - x, tr.z - z) < 3)) {
              s.trees.push({ kind: 'round', x, z, scale: 1.1, rot: rng.range(0, 6.28), color: jitter('#4f8a3a', rng, 0.05), trunkColor: '#6b4a33' });
            }
          }
        }
      }
    }
  }

  // Trees in clumps; keep off walks, water, features, furniture.
  const things = [...s.props.map((p) => [p.x, p.z] as Pt), ...s.lights.map((l) => [l.x, l.z] as Pt)];
  const lakeTree = lake ? grow(lake, 2) : undefined;
  const treeOk = (x: number, z: number, r: number) =>
    x > r * 0.6 && x < W - r * 0.6 && z > r * 0.6 && z < D - r * 0.6 &&
    !(lakeTree && inPoly(x, z, lakeTree)) &&
    allNodes.every((n) => Math.hypot(n.x - x, n.z - z) > n.r + r * 0.5 + 1.2) &&
    !blockers.some((b) => inRect(b, x, z, r)) &&
    !s.courts.some((c) => inRect(c.rect, x, z, r * 0.6 + 0.5)) &&
    distToWalks(x, z, walks) > r * 0.5 + 0.8 &&
    things.every(([px, pz]) => Math.hypot(px - x, pz - z) > 1.6);
  const density = style === 'natural' ? 120 : style === 'formal' ? 260 : 190;
  plantClumps(s, Math.round((W * D) / density), treeOk, rng.range(0.05, 0.4));

  // Boundary: hedge or railings with gaps at the gates; sometimes a named arch over the main gate.
  perimeterFence(s, rng.chance(0.6) ? 'hedge' : 'iron', rng.chance(0.6) ? '#4d7a3a' : '#2f3a33', rng.range(1.0, 1.6), gates.map((g) => [g.x, g.z] as Pt), width + 2.2);
  if (rng.chance(0.35)) s.props.push({ kind: 'gateArch', x: gates[0].x, y: 0.05, z: 1.2, rot: 0, color: '#2d6a3e', color2: '#cfc8bb', w: width + 3.2, h: 4.5 });
}

// ---------------------------------------------------------------- zoo

interface EnclosureType {
  size: [number, number];
  ground: string;
  fence: number;
  /** [species, min, max] */
  animals: [number, number, number][];
  pool?: number;
  rocks?: number;
  trees?: number;
  house?: boolean;
}

const ENCLOSURES: Record<string, EnclosureType> = {
  savanna: { size: [42, 30], ground: '#c9b27a', fence: 1.6, animals: [[1, 2, 3], [2, 3, 5], [7, 2, 5]], rocks: 2, trees: 3, house: true },
  elephants: { size: [30, 24], ground: '#a68e6a', fence: 1.8, animals: [[0, 2, 4]], pool: 0.2, rocks: 2, trees: 1, house: true },
  bigCats: { size: [24, 18], ground: '#9db06a', fence: 3.4, animals: [[3, 2, 3]], rocks: 4, trees: 2 },
  bears: { size: [22, 18], ground: '#8d9a63', fence: 3, animals: [[4, 1, 3]], pool: 0.18, rocks: 4, trees: 2 },
  hippos: { size: [24, 20], ground: '#a68e6a', fence: 1.6, animals: [[8, 2, 3]], pool: 0.3 },
  rhinos: { size: [26, 20], ground: '#b49c72', fence: 1.8, animals: [[9, 1, 3]], rocks: 2, trees: 1 },
  penguins: { size: [16, 12], ground: '#e4eaee', fence: 1.3, animals: [[5, 8, 14]], pool: 0.25, rocks: 3 },
  antelope: { size: [28, 22], ground: '#bfa76f', fence: 1.6, animals: [[7, 4, 7], [2, 2, 3]], trees: 2 },
};
const BIG = new Set([0, 1, 8, 9]);

function enclosure(s: Site, r: Rect, t: EnclosureType): void {
  const { rng } = s;
  s.parkingLots.push({ rect: r, rows: [], stallWidth: 3, color: jitter(t.ground, rng, 0.04) });
  s.fences.push({ kind: 'iron', color: '#3a3d40', height: t.fence, segments: [
    { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0 }, { x0: r.x0, z0: r.z1, x1: r.x1, z1: r.z1 },
    { x0: r.x0, z0: r.z0, x1: r.x0, z1: r.z1 }, { x0: r.x1, z0: r.z0, x1: r.x1, z1: r.z1 },
  ] });
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const taken: [number, number, number][] = [];
  let pool: Pt[] | undefined;
  if (t.pool) {
    const rx = w * t.pool;
    const rz = d * t.pool * 1.1;
    const px = rng.range(r.x0 + rx + 2, r.x1 - rx - 2);
    const pz = rng.range(r.z0 + rz + 2, r.z1 - rz - 2);
    pool = blobPoly(rng, px, pz, rx, rz, 18, 0.7);
    s.water.push({ pts: pool, shore: '#a39d92', y: 0.075 });
  }
  const poolOut = pool ? grow(pool, 1.2) : undefined;
  if (t.house && w > 24) {
    const hx = rng.chance(0.5) ? r.x0 + 1 : r.x1 - 8;
    const hz = r.z1 - 7;
    s.mass('unit', { x0: hx, x1: hx + 7, z0: hz, z1: hz + 6 }, 1, 4, jitter('#b49c72', rng, 0.05), { color: '#7a5a3a' });
    taken.push([hx + 3.5, hz + 3, 5]);
  }
  const free = (x: number, z: number, rad: number) => inRect(r, x, z, -rad - 0.6) && !(poolOut && inPoly(x, z, poolOut)) && taken.every(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) > tr + rad);
  for (let k = 0; k < (t.rocks ?? 0); k++) {
    const sz = rng.range(0.8, 2);
    for (let a = 0; a < 15; a++) {
      const x = rng.range(r.x0, r.x1);
      const z = rng.range(r.z0, r.z1);
      if (!free(x, z, sz)) continue;
      s.props.push({ kind: 'rock', x, y: 0.07, z, rot: rng.range(0, 6.28), color: jitter('#8f8a7d', rng, 0.06), w: sz });
      taken.push([x, z, sz]);
      break;
    }
  }
  for (let k = 0; k < (t.trees ?? 0); k++) {
    for (let a = 0; a < 15; a++) {
      const x = rng.range(r.x0, r.x1);
      const z = rng.range(r.z0, r.z1);
      if (!free(x, z, 2)) continue;
      s.trees.push({ kind: 'round', x, z, scale: rng.range(0.8, 1.15), rot: rng.range(0, 6.28), color: jitter('#6f8f3a', rng, 0.06), trunkColor: '#6b4a33' });
      taken.push([x, z, 2]);
      break;
    }
  }
  for (const [sp, lo, hi] of t.animals) {
    const n = rng.int(lo, hi);
    const rad = BIG.has(sp) ? 2.2 : sp === 5 ? 0.5 : 1.1;
    for (let k = 0; k < n; k++) {
      // Hippos like to sit in the water.
      if (sp === 8 && pool && rng.chance(0.6)) {
        const c = pool.reduce((acc, p) => [acc[0] + p[0] / pool!.length, acc[1] + p[1] / pool!.length], [0, 0]);
        s.props.push({ kind: 'animal', x: c[0] + rng.range(-1.5, 1.5), y: -0.75, z: c[1] + rng.range(-1, 1), rot: rng.range(0, 6.28), color: '#7b6f73', n: sp });
        continue;
      }
      for (let a = 0; a < 25; a++) {
        const x = rng.range(r.x0, r.x1);
        const z = rng.range(r.z0, r.z1);
        if (!free(x, z, rad)) continue;
        s.props.push({ kind: 'animal', x, y: 0.07, z, rot: rng.range(0, 6.28), color: '#888888', n: sp });
        taken.push([x, z, rad]);
        break;
      }
    }
  }
}

/** Side of a rect facing the point (hx, hz): returns midpoint + outward normal. */
function sideFacing(r: Rect, hx: number, hz: number, lim: Rect): { side: WallSide; x: number; z: number; nx: number; nz: number } {
  const cands = [
    { side: 'front' as const, x: (r.x0 + r.x1) / 2, z: r.z0, nx: 0, nz: -1 },
    { side: 'back' as const, x: (r.x0 + r.x1) / 2, z: r.z1, nx: 0, nz: 1 },
    { side: 'left' as const, x: r.x0, z: (r.z0 + r.z1) / 2, nx: -1, nz: 0 },
    { side: 'right' as const, x: r.x1, z: (r.z0 + r.z1) / 2, nx: 1, nz: 0 },
  ].filter((c) => inRect(lim, c.x + c.nx * 4, c.z + c.nz * 4));
  cands.sort((a, b) => Math.hypot(a.x - hx, a.z - hz) - Math.hypot(b.x - hx, b.z - hz));
  return cands[0] ?? { side: 'front', x: (r.x0 + r.x1) / 2, z: r.z0, nx: 0, nz: -1 };
}

export function zoo(s: Site): void {
  const { rng, W, D } = s;
  s.lawnColor = jitter('#79a94e', rng, 0.05);
  s.pavingColor = jitter(rng.pick(['#d8cdb8', '#cfc2a6', '#c9bfae']), rng, 0.03);
  const brand = rng.pick(['#2e7d32', '#e67e22', '#1f6fb5', '#8e44ad']);
  const wall = jitter(rng.pick(['#e2d6bf', '#d9cfbd', '#c9b99a', '#f0e6d2']), rng, 0.03);
  const roof = rng.pick(['#7a5a3a', '#5a6670', '#a0473a']);
  const gx = W * rng.range(0.55, 0.7);

  // Street forecourt: ticket office, gift shop, entrance arch, car park.
  s.paths.push({ x0: gx - 21, x1: gx + 21, z0: 0, z1: 4.6 }, { x0: gx - 6.6, x1: gx + 6.6, z0: 4.6, z1: 15 });
  const office = s.mass('main', { x0: gx - 19, x1: gx - 7, z0: 5, z1: 12 }, 1, 4, wall, { type: 'hip', pitch: 0.4, color: roof, parapet: false, overhang: 0.6 });
  const shop = s.mass('main', { x0: gx + 7, x1: gx + 19, z0: 5, z1: 12 }, 1, 4, jitter(wall, rng, 0.03), { type: 'hip', pitch: 0.4, color: roof, parapet: false, overhang: 0.6 });
  for (const m of [office, shop]) {
    s.windows(m, { bay: 3, w: 1.6, h: 1.4, sill: 0.9, style: 'casement', frame: brand, litChance: 0.6 });
    s.opening(m, 'front', 0.5, 'shopfront', 3.4, 2.6, '#2b3a48', 'shop');
    s.sign(m, 'front', 0.5, 2.9, 6, 0.7, brand);
  }
  s.props.push({ kind: 'gateArch', x: gx, y: 0.05, z: 13.5, rot: 0, color: brand, color2: jitter('#b49c72', rng, 0.04), w: 9, h: 6.5 });
  s.flags(gx, 3, 4);
  if (gx - 24 > 12) s.parking({ x0: 3, x1: gx - 24, z0: 2, z1: 24 });
  s.props.push({ kind: 'bus', x: Math.min(W - 9, gx + 30), y: 0.05, z: 6, rot: Math.PI / 2, color: brand, d: 11 });
  s.driveways.push({ x0: gx + 23, x1: W - 2, z0: 0, z1: 11 });

  // Fenced zoo grounds.
  const iz0 = 26;
  const inner: Rect = { x0: 4, x1: W - 4, z0: iz0 + 2, z1: D - 4 };
  perimeterFence(s, 'iron', '#2f3a33', 2.4, [[gx, iz0]], 7, { x0: 1, x1: W - 1, z0: iz0, z1: D - 1 });
  s.paths.push({ x0: gx - 2, x1: gx + 2, z0: 15, z1: iz0 + 4 });
  const hub: GNode = { x: gx, z: iz0 + 10, r: 6.5 };
  s.plazas.push({ x: hub.x, z: hub.z, r: hub.r });
  s.props.push({ kind: 'fountain', x: hub.x, y: 0.05, z: hub.z, rot: 0, color: '#d8d2c4', w: 2.4 });
  s.animated.push({ kind: 'spray', x: hub.x, y: 1.98, z: hub.z, height: 2.4, radius: 1.7 });
  const occupied: Rect[] = [{ x0: gx - 9, x1: gx + 9, z0: iz0, z1: iz0 + 18 }];
  const blockers: Rect[] = [];
  const nodes: GNode[] = [hub];
  const place = (w: number, d: number, gap: number): Rect | undefined => {
    for (let k = 0; k < 60; k++) {
      const [fw, fd] = rng.chance(0.5) ? [w, d] : [d, w];
      if (inner.x1 - inner.x0 < fw || inner.z1 - inner.z0 < fd) continue;
      const x0 = rng.range(inner.x0, inner.x1 - fw);
      const z0 = rng.range(inner.z0, inner.z1 - fd);
      const r = { x0, x1: x0 + fw, z0, z1: z0 + fd };
      if (occupied.some((o) => overlap(o, r, gap))) continue;
      occupied.push(r);
      return r;
    }
    return undefined;
  };

  // Flamingo lake.
  let lake: Pt[] | undefined;
  if (rng.chance(0.75)) {
    const rx = rng.range(9, 14);
    const rz = rng.range(6, 10);
    const r = place(rx * 2 + 2, rz * 2 + 2, 7);
    if (r) {
      lake = blobPoly(rng, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, rx, rz, 24);
      s.water.push({ pts: lake, shore: '#cdbf9c' });
      const c = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
      for (let k = 0; k < rng.int(6, 11); k++) {
        const p = lake[rng.int(0, lake.length - 1)];
        const t = rng.range(0.7, 0.88);
        s.props.push({ kind: 'animal', x: c[0] + (p[0] - c[0]) * t, y: 0.02, z: c[1] + (p[1] - c[1]) * t, rot: rng.range(0, 6.28), color: '#f08aa8', n: 6 });
      }
      // Lake bounds are not a blocker: walks may bridge it.
      occupied[occupied.length - 1] = polyBounds(grow(lake, 3));
    }
  }

  // Enclosures: savanna first if it fits, then a shuffled mix.
  const names = Object.keys(ENCLOSURES).filter((n) => n !== 'savanna');
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  const order = ['savanna', ...names];
  const placed: string[] = [];
  for (const name of order) {
    if (placed.length >= Math.round((W * D) / 3800)) break;
    const t = ENCLOSURES[name];
    const k = rng.range(0.9, 1.15);
    const r = place(t.size[0] * k, t.size[1] * k, 8);
    if (!r) continue;
    enclosure(s, r, t);
    blockers.push(r);
    placed.push(name);
    const v = sideFacing(r, hub.x, hub.z, inner);
    const node = { x: v.x + v.nx * 3.4, z: v.z + v.nz * 3.4, r: 2.4 };
    nodes.push(node);
    s.plazas.push({ x: node.x, z: node.z, r: 2.6 });
    s.props.push({ kind: 'bench', x: v.x + v.nx * 1.6 + v.nz * 1.6, y: 0.05, z: v.z + v.nz * 1.6 + v.nx * 1.6, rot: facing(-v.nx, -v.nz), color: '#6b4a33' });
  }
  s.info.enclosures = placed.join(', ');

  // Visitor buildings.
  const building = (w: number, d: number, fh: number, label: string, color: string): Mass | undefined => {
    const r = place(w, d, 7);
    if (!r) return undefined;
    const m = s.mass('main', r, 1, fh, jitter(wall, rng, 0.04), { type: rng.chance(0.5) ? 'hip' : 'flat', pitch: 0.35, color: roof, parapet: false, overhang: 0.5 });
    blockers.push(r);
    const v = sideFacing(r, hub.x, hub.z, inner);
    s.windows(m, { bay: 3.2, w: 1.8, h: 1.6, sill: 1.0, style: 'casement', frame: color, litChance: 0.6 });
    s.opening(m, v.side, 0.5, 'shopfront', 3.4, 2.7, '#2b3a48', 'shop');
    s.sign(m, v.side, 0.5, Math.min(fh - 1, 3.2), Math.min(8, Math.max(r.x1 - r.x0, r.z1 - r.z0) * 0.5), 0.8, color);
    const node = { x: v.x + v.nx * 2.6, z: v.z + v.nz * 2.6, r: 1.6 };
    nodes.push(node);
    s.plazas.push({ x: node.x, z: node.z, r: 2.4 });
    s.info[label] = 1;
    return m;
  };
  building(18, 12, 5.5, 'reptileHouse', '#2e7d32');
  const cafe = building(12, 9, 4, 'cafe', '#c0392b');
  if (cafe) {
    const yard = s.placer();
    for (let k = 0; k < 4; k++) {
      const spot = yard.place({ x0: cafe.rect.x0 - 7, x1: cafe.rect.x1 + 7, z0: cafe.rect.z0 - 7, z1: cafe.rect.z1 + 7 }, 2.2, 2.2, [0], 0.6);
      if (spot && !blockers.some((b) => inRect(b, spot.x, spot.z, 1.2))) s.props.push({ kind: 'cafeTable', x: spot.x, y: 0.05, z: spot.z, rot: 0, color: '#c0392b', color2: '#f4f1ea' });
    }
  }
  building(7, 4.5, 3, 'toilets', '#3f5f7a');
  {
    const r = place(16, 16, 7);
    if (r) {
      const cx = (r.x0 + r.x1) / 2;
      const cz = (r.z0 + r.z1) / 2;
      s.props.push({ kind: 'aviary', x: cx, y: 0.05, z: cz, rot: 0, color: '#e9e6df', w: 7.2 });
      s.trees.push({ kind: 'round', x: cx, z: cz, scale: 1.2, rot: 0, color: jitter('#4f8a3a', rng, 0.05), trunkColor: '#6b4a33' });
      blockers.push({ x0: cx - 7.6, x1: cx + 7.6, z0: cz - 7.6, z1: cz + 7.6 });
      const dx = hub.x - cx;
      const dz = hub.z - cz;
      const l = Math.hypot(dx, dz) || 1;
      nodes.push({ x: cx + (dx / l) * 9.6, z: cz + (dz / l) * 9.6, r: 1.6 });
      s.info.aviary = 1;
      s.height = 9;
    }
  }

  // Visitor walks + furniture + planting.
  const walks = buildNetwork(s, nodes, { width: 3.2, lake, blockers, curve: 0.18, loops: 0.35, maxBridge: 30 });
  const lakeOk = lake ? grow(lake, 1.2) : undefined;
  const all = [...blockers, ...occupied.slice(0, 1)];
  const ok = (x: number, z: number) =>
    inRect(inner, x, z, -0.5) && !(lakeOk && inPoly(x, z, lakeOk)) && !all.some((b) => inRect(b, x, z, 0.8)) &&
    nodes.every((n) => Math.hypot(n.x - x, n.z - z) > n.r + 0.5) && distToWalks(x, z, walks) > 0.25;
  furnishWalks(s, walks, 16, ok);
  const things = [...s.props.map((p) => [p.x, p.z] as Pt), ...s.lights.map((l) => [l.x, l.z] as Pt)];
  const lakeTree = lake ? grow(lake, 2) : undefined;
  const front: Rect[] = [...s.paths, ...s.driveways, ...s.parkingLots.map((p) => p.rect), ...s.masses.map((m) => m.rect)];
  plantClumps(s, Math.round((W * D) / 170), (x, z, r) =>
    x > r * 0.6 && x < W - r * 0.6 && z > r * 0.6 && z < D - r * 0.6 && Math.abs(z - iz0) > 1.5 &&
    !(lakeTree && inPoly(x, z, lakeTree)) && !all.some((b) => inRect(b, x, z, r * 0.7 + 0.5)) && !front.some((b) => inRect(b, x, z, r * 0.6)) &&
    nodes.every((n) => Math.hypot(n.x - x, n.z - z) > n.r + r * 0.5 + 1) && distToWalks(x, z, walks) > r * 0.5 + 0.8 &&
    things.every(([px, pz]) => Math.hypot(px - x, pz - z) > 1.6), 0.15);
}
