/**
 * Parametric stadium bowl: seating tiers swept around a superellipse (power 2 = oval / round,
 * 3-4 = rounded rectangle), optional open end (horseshoe), hospitality band between tiers, outer facade
 * (plain / ribbed / glass / banded) with entrances, and a roof: none, ring canopy (optionally over an
 * arc only), "oculus" roof with an open centre, or a closed dome. LOD 1 drops rows, fins and detail.
 */
import * as THREE from 'three';
import { MeshBuilder, col } from './MeshBuilder';
import { STYLE_ID } from '../../render/windowMaterial';
import type { Bowl } from '../spec';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const DOWN = V(0, -1, 0);

const angDist = (a: number, b: number) => {
  const d = Math.abs((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  return d;
};

export function bowlTop(bw: Bowl): number {
  return bw.tiers[bw.tiers.length - 1].y1;
}

export function bowlDepth(bw: Bowl): number {
  return bw.tiers.reduce((s, t) => s + t.depth, 0);
}

/** Point on the bowl at angle t, offset s outwards from the inner (pitch-side) curve. */
export function bowlPoint(bw: Bowl, t: number, s: number, scale = 1): [number, number] {
  const c = Math.cos(t);
  const sn = Math.sin(t);
  const e = 2 / bw.power;
  return [bw.cx + Math.sign(c) * Math.pow(Math.abs(c), e) * (bw.ax + s) * scale, bw.cz + Math.sign(sn) * Math.pow(Math.abs(sn), e) * (bw.az + s) * scale];
}

export function bowlMesh(b: MeshBuilder, bw: Bowl, lodIn: 0 | 1): void {
  const N = lodIn === 0 ? 72 : 36;
  // Seats under a closed dome are never seen up close: draw them at the simple level.
  const lod: 0 | 1 = bw.roof === 'dome' ? 1 : lodIn;
  const depth = bowlDepth(bw);
  const top = bowlTop(bw);
  const P = (t: number, s: number, y: number) => {
    const [x, z] = bowlPoint(bw, t, s);
    return V(x, y, z);
  };
  const radial = (t: number) => {
    const [x, z] = bowlPoint(bw, t, 0);
    return V(x - bw.cx, 0, z - bw.cz).normalize();
  };
  const inGap = (t: number) => !!bw.gap && angDist(t, bw.gap.at) < bw.gap.width / 2;
  const seatA = col(bw.seats[0]);
  const seatB = col(bw.seats[1]);
  const concrete = col('#c9c4b8');
  const dark = col('#3b3e42');
  const facade = col(bw.facade);
  const accent = col(bw.accent);
  const roofC = col(bw.roofColor);

  // Rows of every tier: [s0, s1, tread height].
  const rows: { s0: number; s1: number; y: number; tier: number; k: number }[] = [];
  let sAcc = 0;
  bw.tiers.forEach((tr, ti) => {
    const R = lod === 0 ? Math.max(4, Math.round(tr.depth / 1.3)) : 1;
    for (let k = 0; k < R; k++) {
      const y = lod === 0 ? tr.y0 + ((tr.y1 - tr.y0) * (k + 1)) / R : (tr.y0 + tr.y1) / 2;
      rows.push({ s0: sAcc + (tr.depth * k) / R, s1: sAcc + (tr.depth * (k + 1)) / R, y, tier: ti, k });
    }
    sAcc += tr.depth;
  });

  const segs: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2;
    const t1 = ((i + 1) / N) * Math.PI * 2;
    if (!inGap((t0 + t1) / 2)) segs.push([t0, t1]);
  }

  const seatColor = (i: number, tier: number, k: number) => {
    if (bw.pattern === 'solid') return tier % 2 ? seatB : seatA;
    if (bw.pattern === 'rows') return Math.floor(k / 3 + tier) % 2 ? seatB : seatA;
    return (Math.floor(i / 6) + tier) % 2 ? seatB : seatA;
  };

  segs.forEach(([t0, t1], i) => {
    const tm = (t0 + t1) / 2;
    const out = radial(tm);
    const inn = out.clone().negate();
    // Pitch wall (with LED advertising at LOD 0).
    const y0 = bw.tiers[0].y0;
    b.quad('solid', P(t0, 0, 0), P(t1, 0, 0), P(t1, 0, y0), P(t0, 0, y0), dark, inn);
    if (lod === 0) {
      const a = P(t0, -0.03, 0.25);
      const bb = P(t1, -0.03, 0.25);
      const w = a.distanceTo(bb);
      const brands = ['#c0392b', '#1f6fb5', '#f1c40f', '#27ae60', '#e67e22', '#e84393', '#f4f1ea'];
      b.winQuad('window', a, bb, P(t1, -0.03, y0 - 0.15), P(t0, -0.03, y0 - 0.15), col(brands[(i * 7 + 3) % brands.length]), w, y0 - 0.4, STYLE_ID.sign, 1 + ((i * 0.37) % 0.99), inn);
    }
    // Seating rows: tread + riser.
    let prevY = y0;
    let prevTier = 0;
    for (const r of rows) {
      const c = seatColor(i, r.tier, r.k);
      if (r.tier !== prevTier) {
        // Hospitality band between tiers: wall with a glazed strip and a light line.
        b.quad('solid', P(t0, r.s0, prevY), P(t1, r.s0, prevY), P(t1, r.s0, bw.tiers[r.tier].y0), P(t0, r.s0, bw.tiers[r.tier].y0), facade, inn);
        if (lod === 0) {
          const g0 = prevY + 0.6;
          const g1 = bw.tiers[r.tier].y0 - 0.5;
          b.quad('glass', P(t0, r.s0 - 0.02, g0), P(t1, r.s0 - 0.02, g0), P(t1, r.s0 - 0.02, g1), P(t0, r.s0 - 0.02, g1), col('#1c2733'), inn);
          b.quad('lamp', P(t0, r.s0 - 0.03, g1 + 0.1), P(t1, r.s0 - 0.03, g1 + 0.1), P(t1, r.s0 - 0.03, g1 + 0.22), P(t0, r.s0 - 0.03, g1 + 0.22), col('#fff3d6'), inn);
        }
        prevY = bw.tiers[r.tier].y0;
        prevTier = r.tier;
      }
      if (lod === 1 && r.tier === 0 && bw.tiers.length === 1) {
        b.quad('solid', P(t0, r.s0, y0), P(t1, r.s0, y0), P(t1, r.s1, bw.tiers[0].y1), P(t0, r.s1, bw.tiers[0].y1), c, UP);
        continue;
      }
      if (lod === 1) {
        const tr = bw.tiers[r.tier];
        b.quad('solid', P(t0, r.s0, tr.y0), P(t1, r.s0, tr.y0), P(t1, r.s1, tr.y1), P(t0, r.s1, tr.y1), c, UP);
        prevY = tr.y1;
        continue;
      }
      b.quad('solid', P(t0, r.s0, prevY), P(t1, r.s0, prevY), P(t1, r.s0, r.y), P(t0, r.s0, r.y), c.clone().multiplyScalar(0.72), inn);
      b.quad('solid', P(t0, r.s0, r.y), P(t1, r.s0, r.y), P(t1, r.s1, r.y), P(t0, r.s1, r.y), c, UP);
      prevY = r.y;
    }
    // Back parapet + facade + entrances.
    b.quad('solid', P(t0, depth - 0.01, top), P(t1, depth - 0.01, top), P(t1, depth - 0.01, top + 1.2), P(t0, depth - 0.01, top + 1.2), concrete, inn);
    b.quad('solid', P(t0, depth - 0.3, top + 1.2), P(t1, depth - 0.3, top + 1.2), P(t1, depth, top + 1.2), P(t0, depth, top + 1.2), concrete, UP);
    const fTop = top + 1.2;
    if (bw.facadeStyle === 'glass' && lodIn === 0) {
      const a = P(t1, depth + 0.02, 0);
      const bb = P(t0, depth + 0.02, 0);
      b.quad('solid', P(t0, depth, 0), P(t1, depth, 0), P(t1, depth, fTop), P(t0, depth, fTop), facade, out);
      b.winQuad('window', a, bb, P(t0, depth + 0.02, fTop - 0.6), P(t1, depth + 0.02, fTop - 0.6), col('#2b3a48'), a.distanceTo(bb), fTop - 0.6, STYLE_ID.curtain, (i % 3 === 0 ? 1 : 0) + 0.5, out);
    } else {
      b.quad('solid', P(t0, depth, 0), P(t1, depth, 0), P(t1, depth, fTop), P(t0, depth, fTop), facade, out);
      if (bw.facadeStyle === 'bands') {
        for (const yb of [fTop * 0.33, fTop * 0.66]) b.quad('solid', P(t0, depth + 0.03, yb), P(t1, depth + 0.03, yb), P(t1, depth + 0.03, yb + 0.9), P(t0, depth + 0.03, yb + 0.9), accent, out);
      }
      if (bw.facadeStyle === 'ribs' && lodIn === 0 && i % 2 === 0) {
        // Vertical fin sticking out of the facade.
        const pa = P(t0, depth, 0);
        const pb = P(t0, depth + 1.4, 0);
        const pc = P(t0, depth + 1.4, fTop + 0.6);
        const pd = P(t0, depth, fTop + 0.6);
        const side = V(-out.z, 0, out.x);
        b.quad('solid', pa, pb, pc, pd, accent, side);
        b.quad('solid', pa, pb, pc, pd, accent, side.clone().negate());
      }
    }
    if (lodIn === 0 && i % 6 === 3) {
      // Entrance: dark opening with a lit sign above.
      b.quad('solid', P(t0, depth + 0.04, 0), P(t1, depth + 0.04, 0), P(t1, depth + 0.04, 3.4), P(t0, depth + 0.04, 3.4), dark, out);
      b.quad('lamp', P(t0, depth + 0.05, 3.7), P(t1, depth + 0.05, 3.7), P(t1, depth + 0.05, 4.2), P(t0, depth + 0.05, 4.2), accent, out);
    }
  });

  // Close the ends of an open (horseshoe) bowl with the stepped profile.
  if (bw.gap) {
    for (const t of [bw.gap.at - bw.gap.width / 2, bw.gap.at + bw.gap.width / 2]) {
      const tq = Math.round((t / (Math.PI * 2)) * N) / N * Math.PI * 2;
      const out = radial(tq);
      const side = V(-out.z, 0, out.x);
      let yPrev = bw.tiers[0].y0;
      for (const r of [{ s0: 0, s1: 0.01, y: yPrev }, ...rows]) {
        const y = Math.max(r.y, yPrev);
        for (const h of [side, side.clone().negate()]) b.quad('solid', P(tq, r.s0, 0), P(tq, r.s1, 0), P(tq, r.s1, y), P(tq, r.s0, y), concrete, h);
        yPrev = y;
      }
      for (const h of [side, side.clone().negate()]) b.quad('solid', P(tq, depth - 0.3, 0), P(tq, depth, 0), P(tq, depth, top + 1.2), P(tq, depth - 0.3, top + 1.2), concrete, h);
    }
  }

  // Roof.
  if (bw.roof === 'none') return;
  const yo = top + bw.roofRise;
  if (bw.roof === 'canopy') {
    const inArc = (t: number) => !bw.roofArc || angDist(t, (bw.roofArc[0] + bw.roofArc[1]) / 2) <= Math.abs(bw.roofArc[1] - bw.roofArc[0]) / 2;
    const sIn = -bw.cover;
    const sOut = depth + 0.6;
    const yi = yo + 0.7;
    segs.forEach(([t0, t1], i) => {
      if (!inArc((t0 + t1) / 2)) return;
      const inn = radial((t0 + t1) / 2).negate();
      b.quad('solid', P(t0, sOut, yo), P(t1, sOut, yo), P(t1, sIn, yi), P(t0, sIn, yi), roofC, UP);
      b.quad('solid', P(t0, sOut, yo - 0.35), P(t1, sOut, yo - 0.35), P(t1, sIn, yi - 0.35), P(t0, sIn, yi - 0.35), roofC.clone().multiplyScalar(0.75), DOWN);
      b.quad('solid', P(t0, sIn, yi - 0.35), P(t1, sIn, yi - 0.35), P(t1, sIn, yi + 0.5), P(t0, sIn, yi + 0.5), accent, inn);
      if (lod === 0) b.quad('lamp', P(t0, sIn + 0.3, yi - 0.38), P(t1, sIn + 0.3, yi - 0.38), P(t1, sIn + 1.0, yi - 0.38), P(t0, sIn + 1.0, yi - 0.38), col('#fffbe8'), DOWN);
      if (i % 4 === 0) {
        // Column at the back + raked strut.
        const p0 = P(t0, depth + 0.3, top + 1.2);
        b.box('solid', p0.x - 0.3, top + 1.2, p0.z - 0.3, p0.x + 0.3, yo - 0.3, p0.z + 0.3, concrete);
      }
    });
    return;
  }
  // Oculus / dome: rings scaled towards the centre.
  const ring = (t: number, u: number, y: number) => {
    const c = Math.cos(t);
    const sn = Math.sin(t);
    const e = 2 / bw.power;
    return V(bw.cx + Math.sign(c) * Math.pow(Math.abs(c), e) * (bw.ax + depth + 0.6) * u, y, bw.cz + Math.sign(sn) * Math.pow(Math.abs(sn), e) * (bw.az + depth + 0.6) * u);
  };
  const N2 = lodIn === 0 ? 72 : 36;
  if (bw.roof === 'oculus') {
    const uOpen = Math.max(0.3, (Math.min(bw.ax / (bw.ax + depth + 0.6), bw.az / (bw.az + depth + 0.6))) - bw.cover / Math.min(bw.ax, bw.az));
    const K = lodIn === 0 ? 5 : 2;
    const yAt = (u: number) => yo + ((1 - u) / (1 - uOpen)) * 4;
    for (let i = 0; i < N2; i++) {
      const t0 = (i / N2) * Math.PI * 2;
      const t1 = ((i + 1) / N2) * Math.PI * 2;
      for (let k = 0; k < K; k++) {
        const u0 = 1 - ((1 - uOpen) * k) / K;
        const u1 = 1 - ((1 - uOpen) * (k + 1)) / K;
        const cc = k % 2 ? roofC : roofC.clone().multiplyScalar(1.06);
        b.quad('solid', ring(t0, u0, yAt(u0)), ring(t1, u0, yAt(u0)), ring(t1, u1, yAt(u1)), ring(t0, u1, yAt(u1)), cc, UP);
        b.quad('solid', ring(t0, u0, yAt(u0) - 0.4), ring(t1, u0, yAt(u0) - 0.4), ring(t1, u1, yAt(u1) - 0.4), ring(t0, u1, yAt(u1) - 0.4), cc.clone().multiplyScalar(0.7), DOWN);
      }
      const yi = yAt(uOpen);
      const inn = radial((t0 + t1) / 2).negate();
      b.quad('solid', ring(t0, uOpen, yi - 0.4), ring(t1, uOpen, yi - 0.4), ring(t1, uOpen, yi + 0.7), ring(t0, uOpen, yi + 0.7), accent, inn);
      if (lod === 0) b.quad('lamp', ring(t0, uOpen + 0.01, yi - 0.45), ring(t1, uOpen + 0.01, yi - 0.45), ring(t1, uOpen + 0.03, yi - 0.45), ring(t0, uOpen + 0.03, yi - 0.45), col('#fffbe8'), DOWN);
      // Fascia round the outside.
      const out = radial((t0 + t1) / 2);
      b.quad('solid', ring(t0, 1, yo - 0.4), ring(t1, 1, yo - 0.4), ring(t1, 1, yo + 0.2), ring(t0, 1, yo + 0.2), accent, out);
    }
    // Columns carrying the roof edge.
    segs.forEach(([t0], i) => {
      if (i % 6) return;
      const p0 = P(t0, depth + 0.3, 0);
      b.box('solid', p0.x - 0.35, top + 1.2, p0.z - 0.35, p0.x + 0.35, yo - 0.3, p0.z + 0.35, concrete);
    });
    return;
  }
  // Closed dome: panel bands, a skylight ring, lit edge.
  const domeH = Math.min(bw.ax, bw.az) * 0.42;
  const K = lodIn === 0 ? 8 : 4;
  const yAt = (u: number) => yo + domeH * (1 - u * u);
  for (let i = 0; i < N2; i++) {
    const t0 = (i / N2) * Math.PI * 2;
    const t1 = ((i + 1) / N2) * Math.PI * 2;
    for (let k = 0; k < K; k++) {
      const u0 = 1 - k / K;
      const u1 = 1 - (k + 1) / K;
      const sky = lodIn === 0 && k === Math.floor(K * 0.55);
      const cc = (k + (i % 2)) % 2 ? roofC : roofC.clone().multiplyScalar(1.08);
      if (u1 <= 0.001) b.tri(sky ? 'glass' : 'solid', ring(t0, u0, yAt(u0)), ring(t1, u0, yAt(u0)), V(bw.cx, yAt(0), bw.cz), cc, UP);
      else b.quad(sky ? 'glass' : 'solid', ring(t0, u0, yAt(u0)), ring(t1, u0, yAt(u0)), ring(t1, u1, yAt(u1)), ring(t0, u1, yAt(u1)), sky ? col('#7fa6c4') : cc, UP);
    }
    const out = radial((t0 + t1) / 2);
    b.quad('solid', ring(t0, 1, top + 1.2), ring(t1, 1, top + 1.2), ring(t1, 1, yo + 0.3), ring(t0, 1, yo + 0.3), accent, out);
    if (lodIn === 0) b.quad('lamp', ring(t0, 1.003, yo - 0.2), ring(t1, 1.003, yo - 0.2), ring(t1, 1.003, yo + 0.1), ring(t0, 1.003, yo + 0.1), col(bw.accent), out);
  }
}
