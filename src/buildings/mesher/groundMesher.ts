/**
 * Free-form ground pieces: curving walkways (mitred quad strips with round end caps), irregular water
 * bodies (fan + shore band) and round plazas. All flat, a few hundred triangles at most.
 */
import * as THREE from 'three';
import { MeshBuilder, col } from './MeshBuilder';
import type { Plaza, WaterBody, Walkway } from '../spec';

const UP = new THREE.Vector3(0, 1, 0);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function disc(b: MeshBuilder, bucket: 'solid' | 'water', x: number, z: number, r: number, y: number, c: THREE.Color, segs: number): void {
  const centre = V(x, y, z);
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    b.tri(bucket, centre, V(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r), V(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r), c, UP);
  }
}

export function walkMesh(b: MeshBuilder, w: Walkway, paving: string, lod: 0 | 1): void {
  const pts = w.pts;
  if (pts.length < 2) return;
  const c = col(w.color ?? paving);
  const hw = w.width / 2;
  const y = 0.045;
  // Per-vertex offset: averaged segment normals with a clamped miter.
  const off: [number, number][] = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const bb = pts[Math.min(pts.length - 1, i + 1)];
    let dx = bb[0] - a[0];
    let dz = bb[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    let scale = 1;
    if (i > 0 && i < pts.length - 1) {
      const sx = p[0] - a[0];
      const sz = p[1] - a[1];
      const sl = Math.hypot(sx, sz) || 1;
      const cos = (sx / sl) * dx + (sz / sl) * dz;
      scale = 1 / Math.max(0.5, cos);
    }
    return [-dz * hw * scale, dx * hw * scale];
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    b.quad('solid', V(ax + off[i][0], y, az + off[i][1]), V(bx + off[i + 1][0], y, bz + off[i + 1][1]), V(bx - off[i + 1][0], y, bz - off[i + 1][1]), V(ax - off[i][0], y, az - off[i][1]), c, UP);
  }
  const segs = lod === 0 ? 10 : 6;
  disc(b, 'solid', pts[0][0], pts[0][1], hw, y - 0.002, c, segs);
  disc(b, 'solid', pts[pts.length - 1][0], pts[pts.length - 1][1], hw, y - 0.002, c, segs);
}

export function waterMesh(b: MeshBuilder, wb: WaterBody): void {
  const pts = wb.pts;
  const n = pts.length;
  if (n < 3) return;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n;
  const cz = pts.reduce((s, p) => s + p[1], 0) / n;
  const shore = col(wb.shore ?? '#cdbf9c');
  const water = col('#3f8fa8');
  const ys = wb.y ?? 0.03;
  const out = pts.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const l = Math.hypot(dx, dz) || 1;
    return [x + (dx / l) * 1.0, z + (dz / l) * 1.0] as [number, number];
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    b.quad('solid', V(pts[i][0], ys, pts[i][1]), V(pts[j][0], ys, pts[j][1]), V(out[j][0], ys, out[j][1]), V(out[i][0], ys, out[i][1]), shore, UP);
    b.tri('water', V(cx, ys + 0.02, cz), V(pts[i][0], ys + 0.02, pts[i][1]), V(pts[j][0], ys + 0.02, pts[j][1]), water, UP);
  }
}

export function plazaMesh(b: MeshBuilder, p: Plaza, paving: string, lod: 0 | 1): void {
  const c = col(p.color ?? paving);
  disc(b, 'solid', p.x, p.z, p.r, 0.05, c, lod === 0 ? 24 : 12);
  if (lod === 0) {
    const rim = c.clone().multiplyScalar(0.82);
    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const p0 = (a: number, r: number) => V(p.x + Math.cos(a) * r, 0.052, p.z + Math.sin(a) * r);
      b.quad('solid', p0(a0, p.r - 0.35), p0(a1, p.r - 0.35), p0(a1, p.r), p0(a0, p.r), rim, UP);
    }
  }
}
