/**
 * Turns a TerrainMap into renderable pieces:
 *   - terrain chunks (8 x 8) with three detail levels (cell step 1 / 4 / 8) and skirts that hide the
 *     cracks between neighbours at different levels; flat-shaded, vertex-coloured by biome
 *   - the sea: one large plane out to the horizon; lakes from their outlines
 *   - highways (painted ribbons) and the island bridge (deck, rail track, piers, tied arch)
 *   - instanced trees (broadleaf / conifer / palm), one draw call per kind
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fieldAt, heightAt, inPolygon, waterAt, zoneAt, ZONE, type LinkPoint, type Site, type TerrainMap } from './generate';
import { Noise2D, smoothstep } from './noise';

const C = (hex: string) => new THREE.Color(hex);
const SAND = C('#e6d5a2');
const WET_SAND = C('#c9b383');
const SHALLOW = C('#7fa59a');
const SEABED = C('#4b7a78');
const DEEP = C('#21495c');
const MUD = C('#6b6e52');
const GRASS_DRY = C('#b9b06a');
const GRASS = C('#8db35a');
const GRASS_LUSH = C('#5f9a45');
const FOREST_FLOOR = C('#4f7d3c');
const ALPINE = C('#9aa56e');
const ROCK = C('#8a8378');
const ROCK_HIGH = C('#a19c93');
const SNOW = C('#f3f5f7');

const tmp = new THREE.Color();
/** Height where snow starts; set per map from its highest peak (see buildTerrainScene). */
let snowLine = 345;

const GULLY = C('#5f6a4c');
const RIDGE = C('#b9b2a6');
const CLEARED = C('#b3b47c');
const VERGE = C('#9c9478');
const HEDGE = C('#6c8a45');
export const CROPS = ['#d6bd62', '#c9a94e', '#86ad4a', '#9cc25a', '#7a9a3e', '#8a6a48', '#a48458', '#d9cf5a', '#9bb866'].map(C);

/** Colour for one map sample: biome, then zone tints (cleared town ground, farm patchwork, road verges). */
export function terrainColor(map: TerrainMap, k: number, slope: number, curv: number, n: number, out: THREE.Color): THREE.Color {
  biomeColor(map.heights[k], map.moisture[k], map.water[k], slope, n, out, curv);
  const z = map.zone[k];
  if (z === ZONE.city || z === ZONE.town || z === ZONE.island) out.lerp(CLEARED, 0.4);
  else if (z === ZONE.road) out.lerp(VERGE, 0.6);
  else if (z === ZONE.farm) {
    const farm = map.sites.find((s) => s.kind === 'farm');
    if (farm) {
      const x = -map.size / 2 + (k % map.res) * map.cell;
      const zz = -map.size / 2 + Math.floor(k / map.res) * map.cell;
      const f = fieldAt(farm, x, zz);
      out.copy(CROPS[f.id % CROPS.length]);
      if (f.edge) out.lerp(GULLY, 0.5);
    }
  }
  return out;
}

/** Biome colour from height, moisture, water kind (0 dry, 1 sea, 2 lake), slope, a noise value and curvature (> 0 gully, < 0 ridge). */
export function biomeColor(h: number, m: number, w: number, slope: number, n: number, out: THREE.Color, curv = 0): THREE.Color {
  if (w === 2) return out.copy(MUD); // lake bed
  if (h < 0) {
    const d = -h;
    if (d < 1.2) return out.copy(WET_SAND);
    if (d < 9) return out.copy(SHALLOW).lerp(SEABED, smoothstep(1.2, 9, d));
    return out.copy(SEABED).lerp(DEEP, smoothstep(9, 60, d));
  }
  // Beach: low and gentle.
  const beachTop = 2.4 + 1.4 * n;
  if (h < beachTop && slope < 0.2) return out.copy(h < 0.5 ? WET_SAND : SAND);
  // Grass by moisture, with forest floor where it is lush.
  out.copy(GRASS_DRY).lerp(GRASS, smoothstep(0.2, 0.5, m)).lerp(GRASS_LUSH, smoothstep(0.55, 0.8, m));
  if (m > 0.7) out.lerp(FOREST_FLOOR, smoothstep(0.7, 0.85, m) * 0.6);
  if (h < beachTop + 3) out.lerp(SAND, (1 - (h - beachTop) / 3) * 0.5);
  // Alpine meadow, rock, snow.
  out.lerp(ALPINE, smoothstep(200, 320, h));
  const rock = Math.max(smoothstep(0.5, 0.9, slope), smoothstep(snowLine - 45, snowLine + 55, h + n * 40) * 0.8);
  if (rock > 0) out.lerp(tmp.copy(ROCK).lerp(ROCK_HIGH, smoothstep(200, 500, h)), rock);
  // Erosion detail: gullies darker and greener, ridges and spurs paler.
  if (curv && h > 15) {
    const g = Math.max(-1, Math.min(1, curv * 0.35));
    if (g > 0) out.lerp(GULLY, g * 0.5);
    else out.lerp(RIDGE, -g * 0.4);
  }
  const snow = smoothstep(snowLine, snowLine + 50, h + n * 50) * (1 - smoothstep(1.6, 2.4, slope)) * (curv > 0.8 ? 0.6 : 1);
  if (snow > 0) out.lerp(SNOW, snow);
  return out;
}

export interface TerrainChunk {
  levels: THREE.Mesh[];
  center: THREE.Vector3;
  radius: number;
  lod: number;
}

export interface TerrainScene {
  root: THREE.Group;
  chunks: TerrainChunk[];
  water: THREE.Group;
  infra: THREE.Group;
  trees: THREE.Group;
  /** Per-sample colours (also used for the minimap). */
  colors: Float32Array;
  ms: number;
  dispose(): void;
}

const STEPS = [1, 4, 8];

export function buildTerrainScene(map: TerrainMap): TerrainScene {
  const t0 = performance.now();
  const { res, size, cell, heights } = map;
  const noise = new Noise2D(map.params.seed * 13 + 5);
  snowLine = Math.max(240, map.maxHeight * 0.68);
  // Per-sample colours.
  const colors = new Float32Array(res * res * 3);
  const col = new THREE.Color();
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const k = j * res + i;
      const hx = heights[j * res + Math.min(res - 1, i + 1)] - heights[j * res + Math.max(0, i - 1)];
      const hz = heights[Math.min(res - 1, j + 1) * res + i] - heights[Math.max(0, j - 1) * res + i];
      const slope = Math.hypot(hx, hz) / (2 * cell);
      const h = heights[k];
      const curv =
        (heights[j * res + Math.min(res - 1, i + 1)] + heights[j * res + Math.max(0, i - 1)] + heights[Math.min(res - 1, j + 1) * res + i] + heights[Math.max(0, j - 1) * res + i] - 4 * h) / cell;
      terrainColor(map, k, slope, curv, noise.fbm(i * 0.05, j * 0.05, 3), col);
      colors[k * 3] = col.r;
      colors[k * 3 + 1] = col.g;
      colors[k * 3 + 2] = col.b;
    }
  }

  const root = new THREE.Group();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const skirtMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
  const cells = res - 1;
  const CH = 64;
  const nch = Math.ceil(cells / CH);
  const chunks: TerrainChunk[] = [];
  const X = (i: number) => -size / 2 + i * cell;
  for (let cj = 0; cj < nch; cj++) {
    for (let ci = 0; ci < nch; ci++) {
      const i0 = ci * CH;
      const j0 = cj * CH;
      const levels = STEPS.map((step) => {
        const n = CH / step;
        const pos: number[] = [];
        const cols: number[] = [];
        const index: number[] = [];
        const skirt: number[] = [];
        const vert = (i: number, j: number, drop = 0) => {
          const k = j * res + i;
          let y = heights[k];
          if (step > 1) {
            const r = step >> 1;
            let wet = false;
            let lo = y;
            for (let jj = Math.max(0, j - r); jj <= Math.min(res - 1, j + r); jj++) {
              for (let ii = Math.max(0, i - r); ii <= Math.min(res - 1, i + r); ii++) {
                const kk = jj * res + ii;
                if (map.water[kk] === 2 || map.zone[kk] === ZONE.road) wet = true;
                lo = Math.min(lo, heights[kk]);
              }
            }
            if (wet) y = lo;
          }
          pos.push(X(i), y - drop, X(j));
          // Farmland: the ground between the field quads reads as hedgerow / track green.
          if (map.zone[k] === ZONE.farm) cols.push(HEDGE.r, HEDGE.g, HEDGE.b);
          else cols.push(colors[k * 3], colors[k * 3 + 1], colors[k * 3 + 2]);
          return pos.length / 3 - 1;
        };
        for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) vert(Math.min(res - 1, i0 + a * step), Math.min(res - 1, j0 + b * step));
        const row = n + 1;
        for (let b = 0; b < n; b++) {
          for (let a = 0; a < n; a++) {
            const p = b * row + a;
            index.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
          }
        }
        // Skirts: a strip hanging down from each edge hides cracks against coarser neighbours
        // (and, on the map's outer edge, against the coarse horizon ring).
        const edge = (ids: number[], outer: boolean) => {
          const dropAt = (y: number) => (outer && y > -3 ? 600 : 4 + step * 3);
          for (let q = 0; q < ids.length - 1; q++) {
            const a = ids[q];
            const bq = ids[q + 1];
            const pa = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]];
            const pb = [pos[bq * 3], pos[bq * 3 + 1], pos[bq * 3 + 2]];
            const s0 = pos.length / 3;
            pos.push(pa[0], pa[1] - dropAt(pa[1]), pa[2], pb[0], pb[1] - dropAt(pb[1]), pb[2]);
            cols.push(cols[a * 3], cols[a * 3 + 1], cols[a * 3 + 2], cols[bq * 3], cols[bq * 3 + 1], cols[bq * 3 + 2]);
            skirt.push(a, s0, bq, bq, s0, s0 + 1, a, bq, s0, bq, s0 + 1, s0);
          }
        };
        edge(Array.from({ length: row }, (_, a) => a), cj === 0);
        edge(Array.from({ length: row }, (_, a) => n * row + a), cj === nch - 1);
        edge(Array.from({ length: row }, (_, b) => b * row), ci === 0);
        edge(Array.from({ length: row }, (_, b) => b * row + n), ci === nch - 1);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        g.setIndex([...index, ...skirt]);
        g.addGroup(0, index.length, 0);
        g.addGroup(index.length, skirt.length, 1);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, [terrainMat, skirtMat]);
        mesh.visible = step === 4;
        root.add(mesh);
        return mesh;
      });
      const cx = X(i0 + CH / 2);
      const cz = X(j0 + CH / 2);
      const ck = Math.min(res - 1, j0 + CH / 2) * res + Math.min(res - 1, i0 + CH / 2);
      chunks.push({ levels, center: new THREE.Vector3(cx, heights[ck], cz), radius: (CH * cell) / Math.SQRT2, lod: 1 });
    }
  }

  // Horizon ring: the same base field continued 3 map-widths out, at 1/32 resolution, with the map cut out.
  {
    const hc = size / 16;
    const ext = size * 3;
    const n = Math.round((2 * ext) / hc);
    const row = n + 1;
    const hs = new Float32Array(row * row);
    for (let b = 0; b <= n; b++) {
      for (let a = 0; a <= n; a++) {
        const x = -ext + a * hc;
        const z = -ext + b * hc;
        const inside = Math.abs(x) <= size / 2 + 1 && Math.abs(z) <= size / 2 + 1;
        hs[b * row + a] = inside ? heightAt(map, x, z) : map.horizon(x, z);
      }
    }
    const pos: number[] = [];
    const cols: number[] = [];
    const c = new THREE.Color();
    const put = (a: number, b: number) => {
      const h = hs[b * row + a];
      const sx = (hs[b * row + Math.min(n, a + 1)] - hs[b * row + Math.max(0, a - 1)]) / (2 * hc);
      const sz = (hs[Math.min(n, b + 1) * row + a] - hs[Math.max(0, b - 1) * row + a]) / (2 * hc);
      const slope = Math.max(Math.hypot(sx, sz) * 2.5, smoothstep(110, 320, h + 40 * noise.fbm(a * 0.4, b * 0.4, 2)) * 0.85);
      if (h < -12) c.copy(DEEP).lerp(SEABED, 0.25); // seen through the sea: one flat tone, no checkerboard
      else biomeColor(h, 0.55 + 0.12 * noise.fbm(a * 0.04, b * 0.04, 2), h < 0 ? 1 : 0, slope, noise.fbm(a * 0.1, b * 0.1, 2), c);
      (skirtMode ? spos : pos).push(-ext + a * hc, h - drop, -ext + b * hc);
      (skirtMode ? scols : cols).push(c.r, c.g, c.b);
    };
    let drop = 0;
    let skirtMode = false;
    const spos: number[] = [];
    const scols: number[] = [];
    const cut = (a: number, b: number) => {
      const cx = -ext + (a + 0.5) * hc;
      const cz = -ext + (b + 0.5) * hc;
      return a >= 0 && b >= 0 && a < n && b < n && Math.abs(cx) < size / 2 && Math.abs(cz) < size / 2;
    };
    for (let b = 0; b < n; b++) {
      for (let a = 0; a < n; a++) {
        if (cut(a, b)) continue;
        put(a, b); put(a, b + 1); put(a + 1, b);
        put(a + 1, b); put(a, b + 1); put(a + 1, b + 1);
        // Skirt down from any edge shared with the cut-out, covering the gap to the detailed map edge.
        const edges: [number, number, number, number][] = [];
        if (cut(a - 1, b)) edges.push([a, b, a, b + 1]);
        if (cut(a + 1, b)) edges.push([a + 1, b, a + 1, b + 1]);
        if (cut(a, b - 1)) edges.push([a, b, a + 1, b]);
        if (cut(a, b + 1)) edges.push([a, b + 1, a + 1, b + 1]);
        for (const [a0, b0, a1, b1] of edges) {
          const H0 = hs[b0 * row + a0];
          const H1 = hs[b1 * row + a1];
          const d = (y: number) => (y > -3 ? 600 : 10);
          skirtMode = true;
          for (const tri of [[0, 0, 1, 0, 0, 1], [1, 0, 0, 1, 1, 1], [0, 0, 0, 1, 1, 0], [1, 0, 1, 1, 0, 1]]) {
            for (let v = 0; v < 6; v += 2) {
              const [ea, eb] = tri[v] ? [a1, b1] : [a0, b0];
              drop = tri[v + 1] ? d(tri[v] ? H1 : H0) : 0;
              put(ea, eb);
            }
          }
          drop = 0;
          skirtMode = false;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    root.add(new THREE.Mesh(g, terrainMat));
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(scols, 3));
    sg.computeVertexNormals();
    root.add(new THREE.Mesh(sg, skirtMat));
  }

  // Water.
  const water = new THREE.Group();
  const seaMat = new THREE.MeshLambertMaterial({ color: '#2f86b0', transparent: true, opacity: 0.84 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(size * 8, size * 8, 48, 48).rotateX(-Math.PI / 2), seaMat);
  sea.position.y = 0;
  sea.renderOrder = 1;
  water.add(sea);
  const lakeMat = new THREE.MeshLambertMaterial({ color: '#3a8fa6', transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  for (const l of map.lakes) {
    const shape = new THREE.Shape(l.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, lakeMat);
    mesh.position.y = l.level;
    mesh.renderOrder = 1;
    water.add(mesh);
  }
  root.add(water);

  // Highways and the island bridge (one merged mesh each kind; the road paint sits just above the ground).
  const infra = new THREE.Group();
  const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bridgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  const roadParts: THREE.BufferGeometry[] = [];
  const bridgeParts: THREE.BufferGeometry[] = [];
  for (const l of map.links) {
    if (l.kind === 'highway') roadParts.push(...highwayGeometry(l.pts, l.width));
    else bridgeParts.push(...bridgeGeometry(map, l.pts, l.width, map.params.seed));
  }
  for (const s of map.sites) if (s.kind === 'farm') roadParts.push(fieldGeometry(map, s));
  if (roadParts.length) infra.add(new THREE.Mesh(mergeGeometries(roadParts), roadMat));
  if (bridgeParts.length) infra.add(new THREE.Mesh(mergeGeometries(bridgeParts), bridgeMat));
  root.add(infra);

  // Trees: instanced per kind.
  const trees = new THREE.Group();
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const c = C(hex);
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) arr.set([c.r, c.g, c.b], v * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const trunk = (h: number, r: number) => paint(new THREE.CylinderGeometry(r * 0.7, r, h, 5, 1, true).translate(0, h / 2, 0), '#6b4a33');
  const kinds = [
    mergeGeometries([trunk(2.2, 0.25), paint(new THREE.IcosahedronGeometry(2.2, 0).scale(1, 0.9, 1).translate(0, 3.9, 0), '#ffffff')]),
    mergeGeometries([trunk(1.6, 0.22), paint(new THREE.ConeGeometry(1.9, 6.5, 6).translate(0, 4.6, 0), '#ffffff')]),
    mergeGeometries([trunk(6.5, 0.22), ...[0, 1, 2, 3, 4].map((q) => paint(new THREE.BoxGeometry(0.5, 0.12, 3.2).translate(0, 6.5, 1.5).rotateX(0.35).rotateY((q / 5) * Math.PI * 2), '#ffffff'))]),
  ];
  // Foliage parts get tinted per instance; trunks stay brown because their vertex colour multiplies a near-white tint.
  const T = map.trees;
  const counts = [0, 0, 0];
  for (let q = 0; q < T.length; q += 5) counts[T[q + 4]]++;
  const greens = [['#4f8a3a', '#5f9a45', '#3f7a35', '#6f9a3a'], ['#2f5f3a', '#3a6b40', '#2a5233'], ['#4f8a3a', '#5f9a45']];
  kinds.forEach((g, kind) => {
    if (!counts[kind]) return;
    const mesh = new THREE.InstancedMesh(g, treeMat, counts[kind]);
    const m4 = new THREE.Matrix4();
    const q4 = new THREE.Quaternion();
    let n = 0;
    for (let q = 0; q < T.length; q += 5) {
      if (T[q + 4] !== kind) continue;
      const s = T[q + 3];
      q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (T[q] * 0.37 + T[q + 2] * 0.71) % (Math.PI * 2));
      m4.compose(new THREE.Vector3(T[q], T[q + 1] - 0.2, T[q + 2]), q4, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(n, m4);
      const pal = greens[kind];
      mesh.setColorAt(n, C(pal[Math.floor(((T[q] * 13.7 + T[q + 2] * 7.1) % pal.length + pal.length) % pal.length)]));
      n++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    trees.add(mesh);
  });
  root.add(trees);

  return {
    root,
    chunks,
    water,
    infra,
    trees,
    colors,
    ms: performance.now() - t0,
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      terrainMat.dispose();
      skirtMat.dispose();
      seaMat.dispose();
      lakeMat.dispose();
      roadMat.dispose();
      bridgeMat.dispose();
      treeMat.dispose();
    },
  };
}

// ---------------------------------------------------------------- infrastructure geometry

function colored(g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const n = ng.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) arr.set([c.r, c.g, c.b], v * 3);
  ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  ng.deleteAttribute('uv');
  return ng;
}

/** A box of size (w across, h up, l along) centred at (x, y, z), heading `yaw` and climbing at `pitch`. */
function obox(x: number, y: number, z: number, yaw: number, pitch: number, w: number, h: number, l: number, c: THREE.Color): THREE.BufferGeometry {
  return colored(new THREE.BoxGeometry(w, h, l).rotateX(-pitch).rotateY(yaw).translate(x, y, z), c);
}

/** A flat ribbon following pts at lateral offset `off` (+ = right), `w` wide, `lift` above the points. */
function ribbon(pts: LinkPoint[], off: number, w: number, lift: number, c: THREE.Color, dash = 0): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const pos: number[] = [];
  const side = (q: number) => {
    const a = pts[Math.max(0, q - 1)];
    const b = pts[Math.min(pts.length - 1, q + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return [(b.z - a.z) / l, -(b.x - a.x) / l]; // right-hand normal
  };
  let run = 0;
  for (let q = 0; q < pts.length - 1; q++) {
    const p = pts[q];
    const r = pts[q + 1];
    const seg = Math.hypot(r.x - p.x, r.z - p.z);
    run += seg;
    if (dash && run % (dash * 2) > dash) continue; // gaps between dashes
    const [nx, nz] = side(q);
    const [mx, mz] = side(q + 1);
    const a0 = [p.x + nx * (off - w / 2), p.y + lift, p.z + nz * (off - w / 2)];
    const a1 = [p.x + nx * (off + w / 2), p.y + lift, p.z + nz * (off + w / 2)];
    const b0 = [r.x + mx * (off - w / 2), r.y + lift, r.z + mz * (off - w / 2)];
    const b1 = [r.x + mx * (off + w / 2), r.y + lift, r.z + mz * (off + w / 2)];
    pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
  }
  if (!pos.length) return out;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Normals of a flat road point up; fix any that came out downward from the winding.
  const nrm = g.getAttribute('normal');
  for (let v = 0; v < nrm.count; v++) if (nrm.getY(v) < 0) nrm.setXYZ(v, -nrm.getX(v), -nrm.getY(v), -nrm.getZ(v));
  out.push(colored(g, c));
  return out;
}

/**
 * Farm fields as crisp draped quads (the terrain grid is too coarse for clean field edges): the same staggered
 * grid as fieldAt, inset so hedgerow strips show between them, with furrow stripes along each field.
 */
function fieldGeometry(map: TerrainMap, farm: Site): THREE.BufferGeometry {
  const a = farm.fieldAngle ?? 0;
  const W = farm.fieldW ?? 60;
  const D = farm.fieldD ?? 40;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const world = (u: number, v: number): [number, number] => [farm.x + u * W * ca - v * D * sa, farm.z + u * W * sa + v * D * ca];
  const pos: number[] = [];
  const cols: number[] = [];
  const c = new THREE.Color();
  const rows = Math.ceil((farm.r * 1.4) / D);
  const colsN = Math.ceil((farm.r * 1.4) / W) + 1;
  const ok = (x: number, z: number) => inPolygon(x, z, farm.outline) && zoneAt(map, x, z) === ZONE.farm && !waterAt(map, x, z);
  const SU = 8;
  const SV = 3;
  for (let row = -rows; row < rows; row++) {
    const sh = (((row * 0.618) % 1) + 1) % 1;
    for (let col = -colsN; col < colsN; col++) {
      const u0 = col - sh + 0.035;
      const u1 = col + 1 - sh - 0.035;
      const v0 = row + 0.06;
      const v1 = row + 1 - 0.06;
      const corners = [world(u0, v0), world(u1, v0), world(u0, v1), world(u1, v1), world((u0 + u1) / 2, (v0 + v1) / 2)];
      if (!corners.every(([x, z]) => ok(x, z))) continue;
      const id = ((col * 73856093) ^ (row * 19349663)) >>> 0;
      const base = CROPS[id % CROPS.length];
      const ploughed = id % CROPS.length >= 5 && id % CROPS.length <= 6;
      for (let su = 0; su < SU; su++) {
        // Furrows: alternate strips a touch darker (stronger on ploughed earth).
        c.copy(base).multiplyScalar(su % 2 ? (ploughed ? 0.86 : 0.93) : 1);
        for (let sv = 0; sv < SV; sv++) {
          const ua = u0 + ((u1 - u0) * su) / SU;
          const ub = u0 + ((u1 - u0) * (su + 1)) / SU;
          const va = v0 + ((v1 - v0) * sv) / SV;
          const vb = v0 + ((v1 - v0) * (sv + 1)) / SV;
          const P = [world(ua, va), world(ub, va), world(ua, vb), world(ub, vb)].map(([x, z]) => [x, heightAt(map, x, z) + 0.12, z]);
          for (const q of [0, 2, 1, 1, 2, 3]) {
            pos.push(...P[q]);
            cols.push(c.r, c.g, c.b);
          }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const nrm = g.getAttribute('normal');
  for (let v = 0; v < nrm.count; v++) if (nrm.getY(v) < 0) nrm.setXYZ(v, -nrm.getX(v), -nrm.getY(v), -nrm.getZ(v));
  return g;
}

const ASPHALT = C('#4a4c50');
const PAINT = C('#e9e4d0');
const PAINT_Y = C('#e2c048');

function highwayGeometry(pts: LinkPoint[], width: number): THREE.BufferGeometry[] {
  return [
    ...ribbon(pts, 0, width, 0.06, ASPHALT),
    ...ribbon(pts, -width / 2 + 0.5, 0.22, 0.09, PAINT),
    ...ribbon(pts, width / 2 - 0.5, 0.22, 0.09, PAINT),
    ...ribbon(pts, 0, 0.25, 0.09, PAINT_Y, 6),
  ];
}

/**
 * Road-and-rail bridge: concrete deck (road on one side, a ballasted rail track on the other), parapets,
 * piers wherever the ground drops away, and a tied arch over the main span when the crossing is long.
 */
function bridgeGeometry(map: TerrainMap, pts: LinkPoint[], width: number, seed: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const CONCRETE = C('#a3a19a');
  const PIER = C('#8f8c86');
  const GRAVEL = C('#7c7368');
  const RAIL = C('#55565a');
  const SLEEPER = C('#6b5a48');
  const ARCH = C(seed % 2 ? '#d24a3a' : '#ecebe6');
  const hw = width / 2;
  const roadOff = -2.6;
  const railOff = 4.6;
  let run = 0;
  let nextPier = 18;
  const L = pts.reduce((s, p, q) => (q ? s + Math.hypot(p.x - pts[q - 1].x, p.z - pts[q - 1].z) : 0), 0);
  for (let q = 0; q < pts.length - 1; q++) {
    const p = pts[q];
    const r = pts[q + 1];
    const dx = r.x - p.x;
    const dz = r.z - p.z;
    const dy = r.y - p.y;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(dy, len);
    const l3 = Math.hypot(len, dy) + 0.15;
    const mx = (p.x + r.x) / 2;
    const my = (p.y + r.y) / 2;
    const mz = (p.z + r.z) / 2;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const at = (off: number, y: number, w: number, h: number, c: THREE.Color) => out.push(obox(mx + rx * off, my + y, mz + rz * off, yaw, pitch, w, h, l3, c));
    at(0, -0.8, width, 1.5, CONCRETE); // deck slab
    at(roadOff, 0.0, 10.4, 0.12, ASPHALT); // carriageway
    at(railOff, 0.05, 4.4, 0.24, GRAVEL); // ballast
    at(railOff - 0.72, 0.3, 0.12, 0.18, RAIL);
    at(railOff + 0.72, 0.3, 0.12, 0.18, RAIL);
    at(-hw + 0.2, 0.55, 0.4, 1.1, CONCRETE); // parapets
    at(hw - 0.2, 0.55, 0.4, 1.1, CONCRETE);
    // Sleepers, every couple of metres.
    for (let s = 0.5; s < len; s += 2) {
      const t = s / len;
      out.push(obox(p.x + dx * t + rx * railOff, p.y + dy * t + 0.18, p.z + dz * t + rz * railOff, yaw, pitch, 2.4, 0.14, 0.3, SLEEPER));
    }
    // Piers where the ground (or sea floor) drops well below the deck.
    run += len;
    if (run >= nextPier) {
      nextPier += 36;
      const ground = heightAt(map, r.x, r.z);
      if (r.y - ground > 4) {
        const bottom = Math.min(ground, 0) - 3;
        const top = r.y - 1.5;
        out.push(obox(r.x, (bottom + top) / 2, r.z, yaw, 0, width * 0.55, top - bottom, 2.8, PIER));
        out.push(obox(r.x, top - 0.6, r.z, yaw, 0, width + 0.6, 1.2, 3.4, CONCRETE));
      }
    }
  }
  // Tied arch over the middle of a long crossing.
  if (L > 240) {
    const span0 = 0.3;
    const span1 = 0.7;
    const rise = Math.min(36, L * 0.075);
    const posAt = (t: number) => {
      // point at fraction t of the bridge length
      let acc = 0;
      for (let q = 1; q < pts.length; q++) {
        const sl = Math.hypot(pts[q].x - pts[q - 1].x, pts[q].z - pts[q - 1].z);
        if (acc + sl >= t * L) {
          const f = (t * L - acc) / sl;
          return { x: pts[q - 1].x + (pts[q].x - pts[q - 1].x) * f, y: pts[q - 1].y + (pts[q].y - pts[q - 1].y) * f, z: pts[q - 1].z + (pts[q].z - pts[q - 1].z) * f, yaw: Math.atan2(pts[q].x - pts[q - 1].x, pts[q].z - pts[q - 1].z) };
        }
        acc += sl;
      }
      const e = pts[pts.length - 1];
      return { x: e.x, y: e.y, z: e.z, yaw: 0 };
    };
    const SEG = 18;
    for (const side of [-1, 1]) {
      let prev: THREE.Vector3 | null = null;
      for (let s = 0; s <= SEG; s++) {
        const u = s / SEG;
        const b = posAt(span0 + (span1 - span0) * u);
        const off = side * (hw + 0.6);
        const cur = new THREE.Vector3(b.x + Math.cos(b.yaw) * off, b.y + 0.4 + rise * 4 * u * (1 - u), b.z - Math.sin(b.yaw) * off);
        if (prev) {
          const d = cur.clone().sub(prev);
          const hl = Math.hypot(d.x, d.z);
          const m = cur.clone().add(prev).multiplyScalar(0.5);
          out.push(obox(m.x, m.y, m.z, Math.atan2(d.x, d.z), Math.atan2(d.y, hl), 1.2, 1.5, d.length() + 0.4, ARCH));
        }
        // Hangers down to the deck.
        if (s > 0 && s < SEG) {
          const hgt = cur.y - (b.y + 0.4);
          if (hgt > 1) out.push(obox(cur.x, b.y + 0.4 + hgt / 2, cur.z, b.yaw, 0, 0.22, hgt, 0.22, ARCH));
        }
        prev = cur;
      }
    }
    // Wind braces across the top.
    for (const u of [0.32, 0.5, 0.68]) {
      const b = posAt(span0 + (span1 - span0) * u);
      out.push(obox(b.x, b.y + 0.4 + rise * 4 * u * (1 - u), b.z, b.yaw, 0, width + 1.2, 0.6, 0.6, ARCH));
    }
  }
  return out;
}

/** Pick each chunk's detail level from the camera distance; returns true when anything changed. */
export function updateTerrainLod(scene: TerrainScene, camera: THREE.Vector3, near = 750, far = 2600): boolean {
  let changed = false;
  for (const c of scene.chunks) {
    const d = Math.max(0, camera.distanceTo(c.center) - c.radius);
    const lod = d < near ? 0 : d < far ? 1 : 2;
    if (lod === c.lod) continue;
    c.levels.forEach((m, i) => (m.visible = i === lod));
    c.lod = lod;
    changed = true;
  }
  return changed;
}
