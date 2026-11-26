/**
 * Sports surfaces with line markings: football / cricket fields, basketball and tennis courts,
 * running tracks (stadium-shaped ovals) and playground surfaces. Flat, cheap geometry; line markings
 * are only drawn at LOD 0.
 */
import * as THREE from 'three';
import { MeshBuilder, col } from './MeshBuilder';
import type { Court } from '../spec';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const TOP = 0.075; // surface top
const LINE = TOP + 0.006;

export function courtMesh(b: MeshBuilder, c: Court, lod: 0 | 1): void {
  const r = c.rect;
  const W = r.x1 - r.x0;
  const D = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  // Court space: u along the long side, v across it.
  const alongX = W >= D;
  const len = alongX ? W : D;
  const wid = alongX ? D : W;
  const P = (u: number, y: number, v: number) => (alongX ? V(cx + u, y, cz + v) : V(cx + v, y, cz + u));
  const paint = col('#f4f1ea');
  const rect = (u0: number, v0: number, u1: number, v1: number, y0: number, y1: number, c: THREE.Color) => {
    const a = P(u0, y0, v0);
    const z = P(u1, y1, v1);
    b.box('solid', a.x, a.y, a.z, z.x, z.y, z.z, c);
  };
  const line = (u0: number, v0: number, u1: number, v1: number) => rect(u0, v0, u1, v1, TOP, LINE, paint);
  /** Outline of a rectangle with lines `w` wide. */
  const outline = (hu: number, hv: number, w = 0.1, du = 0) => {
    line(du - hu, -hv, du + hu, -hv + w);
    line(du - hu, hv - w, du + hu, hv);
    line(du - hu, -hv, du - hu + w, hv);
    line(du + hu - w, -hv, du + hu, hv);
  };
  /** Arc band between radii (in court space) at the given centre. */
  const arc = (uc: number, vc: number, rad: number, a0: number, a1: number, w = 0.1, color = paint, y = LINE, segs = 20) => {
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + ((a1 - a0) * i) / segs;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
      const p = (t: number, rr: number) => P(uc + Math.cos(t) * rr, y, vc + Math.sin(t) * rr);
      b.quad('solid', p(t0, rad - w / 2), p(t1, rad - w / 2), p(t1, rad + w / 2), p(t0, rad + w / 2), color, UP);
    }
  };
  const base = (color: string) => rect(-len / 2, -wid / 2, len / 2, wid / 2, 0.02, TOP, col(color));

  switch (c.kind) {
    case 'football': {
      base('#4e8f3a');
      if (lod === 1) return;
      // mowing stripes
      const n = Math.max(4, Math.round(len / 5));
      for (let i = 0; i < n; i += 2) rect(-len / 2 + (i * len) / n, -wid / 2, -len / 2 + ((i + 1) * len) / n, wid / 2, TOP, TOP + 0.003, col('#5aa047'));
      const s = Math.min(1, len / 105, wid / 68);
      const hu = len / 2 - 1;
      const hv = wid / 2 - 1;
      outline(hu, hv, 0.12);
      line(-0.06, -hv, 0.06, hv); // halfway
      arc(0, 0, 9.15 * s, 0, Math.PI * 2, 0.12, paint, LINE, 28);
      for (const sgn of [-1, 1]) {
        const pd = 16.5 * s;
        const pw = Math.min(40.3 * s, wid - 4) / 2;
        const gd = 5.5 * s;
        const gw = Math.min(18.3 * s, wid - 6) / 2;
        const gx = sgn * hu;
        line(gx - sgn * pd - 0.06, -pw, gx - sgn * pd + 0.06, pw);
        line(Math.min(gx, gx - sgn * pd), -pw, Math.max(gx, gx - sgn * pd), -pw + 0.12);
        line(Math.min(gx, gx - sgn * pd), pw - 0.12, Math.max(gx, gx - sgn * pd), pw);
        line(gx - sgn * gd - 0.06, -gw, gx - sgn * gd + 0.06, gw);
        line(Math.min(gx, gx - sgn * gd), -gw, Math.max(gx, gx - sgn * gd), -gw + 0.12);
        line(Math.min(gx, gx - sgn * gd), gw - 0.12, Math.max(gx, gx - sgn * gd), gw);
      }
      return;
    }
    case 'cricket': {
      // Oval outfield filling the rect, pitch strip + creases, elliptical boundary rope.
      const grass = col('#4e8f3a');
      const segs = lod === 0 ? 48 : 24;
      const E = (t: number, k: number, y: number) => P(Math.cos(t) * (len / 2) * k, y, Math.sin(t) * (wid / 2) * k);
      for (let i = 0; i < segs; i++) {
        const t0 = (i / segs) * Math.PI * 2;
        const t1 = ((i + 1) / segs) * Math.PI * 2;
        b.tri('solid', P(0, TOP, 0), E(t0, 1, TOP), E(t1, 1, TOP), grass, UP);
        if (lod === 0) b.quad('solid', E(t0, 0.9, LINE), E(t1, 0.9, LINE), E(t1, 0.905, LINE), E(t0, 0.905, LINE), paint, UP);
      }
      rect(-10, -1.5, 10, 1.5, TOP, TOP + 0.004, col('#c9a66b'));
      if (lod === 1) return;
      for (const u of [-8.8, 8.8]) line(u - 0.05, -1.5, u + 0.05, 1.5);
      return;
    }
    case 'basketball': {
      base('#3a6ea5');
      const s = Math.min(1, len / 28, wid / 15);
      const hu = Math.min(14, len / 2 - 1);
      const hv = Math.min(7.5, wid / 2 - 1);
      for (const sgn of [-1, 1]) rect(sgn * hu - (sgn > 0 ? 5.8 * s : 0), -2.45 * s, sgn * hu + (sgn < 0 ? 5.8 * s : 0), 2.45 * s, TOP, TOP + 0.003, col('#b5653a'));
      if (lod === 1) return;
      outline(hu, hv, 0.08);
      line(-0.04, -hv, 0.04, hv);
      arc(0, 0, 1.8 * s, 0, Math.PI * 2, 0.08);
      for (const sgn of [-1, 1]) {
        arc(sgn * (hu - 1.6 * s), 0, 6.75 * s, sgn > 0 ? Math.PI / 2 : -Math.PI / 2, sgn > 0 ? Math.PI * 1.5 : Math.PI / 2, 0.08);
        arc(sgn * (hu - 5.8 * s), 0, 1.8 * s, sgn > 0 ? Math.PI / 2 : -Math.PI / 2, sgn > 0 ? Math.PI * 1.5 : Math.PI / 2, 0.08);
      }
      return;
    }
    case 'tennis': {
      base('#3f7d4f');
      const hu = Math.min(11.9, len / 2 - 2);
      const hv = Math.min(5.5, wid / 2 - 1.5);
      rect(-hu, -hv, hu, hv, TOP, TOP + 0.003, col('#2f6db5'));
      if (lod === 1) return;
      outline(hu, hv, 0.08);
      const sv = hv * (8.23 / 10.97);
      line(-hu, -sv, hu, -sv + 0.08);
      line(-hu, sv - 0.08, hu, sv);
      for (const sgn of [-1, 1]) line(sgn * hu * (6.4 / 11.9) - 0.04, -sv, sgn * hu * (6.4 / 11.9) + 0.04, sv);
      line(-hu * (6.4 / 11.9), -0.04, hu * (6.4 / 11.9), 0.04);
      rect(-0.02, -hv - 0.5, 0.02, hv + 0.5, TOP, TOP + 1.0, col('#2b2b2b')); // net
      return;
    }
    case 'track': {
      // Stadium-shaped running track hugging the rect; 7 m wide (6 lanes), lane lines at LOD 0.
      const R = wid / 2;
      const straight = len - wid;
      const band = (r0: number, r1: number, color: THREE.Color, y: number) => {
        const seg = 16;
        for (const sgn of [-1, 1]) {
          // straights
          const v0 = sgn * r0;
          const v1 = sgn * r1;
          const a = P(-straight / 2, y, v0);
          const bb = P(straight / 2, y, v0);
          const c2 = P(straight / 2, y, v1);
          const d = P(-straight / 2, y, v1);
          b.quad('solid', a, bb, c2, d, color, UP);
          // bends
          const uc = sgn * (straight / 2);
          for (let i = 0; i < seg; i++) {
            const t0 = -Math.PI / 2 + (Math.PI * i) / seg;
            const t1 = -Math.PI / 2 + (Math.PI * (i + 1)) / seg;
            const p = (t: number, rr: number) => P(uc + sgn * Math.cos(t) * rr, y, Math.sin(t) * rr);
            b.quad('solid', p(t0, r0), p(t1, r0), p(t1, r1), p(t0, r1), color, UP);
          }
        }
      };
      band(R - 7.2, R, col('#b5553a'), TOP);
      if (lod === 1) return;
      for (let k = 0; k <= 6; k++) {
        const rr = R - 7.2 + k * 1.2;
        band(rr - 0.025, rr + 0.025, paint, LINE);
      }
      return;
    }
    case 'field': {
      // Crop field: base colour + rows along the long side (raised ridges for tall crops).
      const crop = c.crop ?? 'wheat';
      const look: Record<string, [string, string, number, number]> = {
        // base, row colour, row spacing (m), ridge height (m; 0 = flat stripe)
        wheat: ['#c9a94a', '#b8973d', 0.9, 0],
        stubble: ['#d1bd7a', '#b9a464', 0.8, 0],
        maize: ['#6f8a3a', '#4f7a2a', 1.4, 1.1],
        ploughed: ['#7a5a3e', '#5e4430', 0.9, 0.08],
        paddy: ['#5f8f4a', '#7fb35a', 0.6, 0],
        sugarcane: ['#5a7f34', '#3f6a2a', 1.6, 2.1],
        pasture: ['#7aa34e', '#86ad58', 3, 0],
        vegetables: ['#6b5340', '#4f8a3a', 1.2, 0.35],
      };
      const [baseC, rowC, sp, ridge] = look[crop] ?? look.wheat;
      base(baseC);
      if (crop === 'paddy') {
        // flooded basins between bunds
        const nb = Math.max(1, Math.round(len / 14));
        for (let i = 0; i < nb; i++) {
          const u0 = -len / 2 + (i * len) / nb + 0.6;
          const u1 = -len / 2 + ((i + 1) * len) / nb - 0.6;
          const a = P(u0, TOP + 0.004, -wid / 2 + 0.6);
          const z = P(u1, TOP + 0.006, wid / 2 - 0.6);
          b.box('water', Math.min(a.x, z.x), a.y, Math.min(a.z, z.z), Math.max(a.x, z.x), z.y, Math.max(a.z, z.z), col('#6a9a8a'));
        }
      }
      if (lod === 1) return;
      const rc = col(rowC);
      const n = Math.floor(wid / sp);
      for (let i = 0; i < n; i++) {
        const v = -wid / 2 + (i + 0.5) * sp;
        if (ridge > 0) {
          rect(-len / 2 + 0.6, v - sp * 0.28, len / 2 - 0.6, v + sp * 0.28, TOP, TOP + ridge, rc);
        } else if (crop === 'paddy') {
          rect(-len / 2 + 0.6, v - 0.12, len / 2 - 0.6, v + 0.12, TOP + 0.006, TOP + 0.12, rc); // seedlings
        } else {
          rect(-len / 2, v - sp * 0.22, len / 2, v + sp * 0.22, TOP, TOP + 0.004, rc);
        }
      }
      return;
    }
    case 'playground': {
      base(alongX ? '#c0573e' : '#4f8a5a');
      return;
    }
  }
}
