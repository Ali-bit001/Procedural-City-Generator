/**
 * Health:
 *   hospital -> tall main ward block + glazed lobby atrium with a drop-off canopy and loop
 *               + side wings (one holds the emergency department: ambulance bay, canopy, red sign)
 *               + back wing, rooftop helipad, big red cross, parking, flags, rooftop plant
 *   clinic   -> 1-2 storey block, glass entrance under a canopy, lit green cross, a few stalls,
 *               sometimes an ambulance on a side drive
 */
import { massTop, type Rect, type WindowStyle } from '../../spec';
import { Site, jitter } from './site';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function hospital(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#eef0ee', '#e6e1d6', '#dfe6ea', '#f0ece4']), rng, 0.02);
  const accent = rng.pick(['#2f6db5', '#2e8b7a', '#3a7ca5', '#5a6b7d']);
  const style = rng.pick<WindowStyle>(['ribbon', 'plain', 'grid']);
  const frame = rng.pick(['#5a6b7d', '#3a3d40', accent]);
  const cx = W / 2;
  const mh = clamp(W * 0.17, 13, 20);
  const md = clamp(D * 0.24, 18, 24);
  const mz0 = 34;
  const floors = rng.int(6, 10);

  const main = s.mass('main', { x0: cx - mh, x1: cx + mh, z0: mz0, z1: mz0 + md }, floors, 3.8, wall, { color: '#8f9499' });
  const wd = clamp(D * 0.3, 18, 30);
  const left = s.mass('wing', { x0: 6, x1: cx - mh, z0: mz0 + 4, z1: Math.min(D - 8, mz0 + 4 + wd) }, rng.int(3, 4), 3.6, jitter(wall, rng, 0.03));
  const right = s.mass('wing', { x0: cx + mh, x1: W - 6, z0: 40, z1: Math.min(D - 8, 40 + wd) }, 3, 3.6, jitter(wall, rng, 0.03));
  const back = mz0 + md + 4 < D - 10 ? s.mass('wing', { x0: cx - mh + 4, x1: cx + mh - 4, z0: mz0 + md, z1: Math.min(D - 8, mz0 + md + 20) }, rng.int(4, 5), 3.8, wall) : undefined;
  const lobby = s.mass('wing', { x0: cx - mh + 4, x1: cx + mh - 4, z0: 26, z1: mz0 }, 1, 6, jitter(wall, rng, 0.02), { color: '#c9ccd1' });

  for (const m of [main, left, right, ...(back ? [back] : [])]) s.windows(m, { bay: 3.2, w: 2.3, h: 1.6, sill: 0.9, style, frame, litChance: 0.6 });
  s.glaze(lobby, ['front', 'left', 'right'], frame);
  s.opening(lobby, 'front', 0.5, 'shopfront', 5, 3, '#2b3a48', 'shop', false);
  s.sign(lobby, 'front', 0.5, 4.4, (lobby.rect.x1 - lobby.rect.x0) * 0.55, 1.2, accent);

  // Drop-off canopy and loop.
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 9, x1: cx + 9, z0: 20, z1: 26 }, floorY: 0, roofY: 4.5, stepX: cx, floorColor: s.pavingColor, roofColor: '#e9e6df', postColor: accent });
  for (const x of [cx - 6, cx, cx + 6]) s.lights.push({ kind: 'ceiling', x, y: 4.48, z: 23, rot: 0 });
  s.driveways.push({ x0: cx - 12, x1: cx + 12, z0: 0, z1: 20 });
  for (const z of [5, 14]) for (const x of [cx - 12.6, cx + 12.6]) s.lights.push({ kind: 'post', x, y: 0.05, z, rot: 0 });

  // Big red cross high on the ward block, helipad on its roof.
  const top = massTop(main);
  s.clear(main, 'front', cx, mz0, 4.5, top - 0.5, top - 6.5);
  s.props.push({ kind: 'crossSign', x: cx, y: top - 3.4, z: mz0, rot: 0, color: '#e8302a', w: 4 });
  s.props.push({ kind: 'helipad', x: cx, y: top, z: mz0 + md / 2, rot: 0, color: '#5a5f66', color2: '#e8302a', w: Math.min(7, mh - 2, md / 2 - 1.5) });

  // Emergency department in the right wing: canopy over the bay, red sign, ambulances.
  const erX0 = W - 17;
  const erX1 = W - 6;
  s.driveways.push({ x0: erX0, x1: erX1, z0: 0, z1: 34 });
  s.porches.push({ kind: 'arcade', rect: { x0: erX0, x1: erX1, z0: 34, z1: 40 }, floorY: 0, roofY: 4.2, stepX: (erX0 + erX1) / 2, floorColor: s.pavingColor, roofColor: '#e9e6df', postColor: '#c0392b' });
  const erT = ((erX0 + erX1) / 2 - right.rect.x0) / (right.rect.x1 - right.rect.x0);
  s.opening(right, 'front', erT, 'shopfront', 4.5, 3, '#2b3a48', 'shop');
  s.sign(right, 'front', erT, 4.6, 8, 1.1, '#c0392b');
  s.lights.push({ kind: 'ceiling', x: (erX0 + erX1) / 2, y: 4.18, z: 37, rot: 0 });
  const nAmb = rng.int(1, 3);
  for (let i = 0; i < nAmb; i++) s.props.push({ kind: 'ambulance', x: erX0 + 2.8 + i * 3.6, y: 0.05, z: 29 - (i % 2) * 7, rot: i % 2 ? Math.PI : 0, color: '#f4f1ea' });

  // Parking either side of the loop.
  s.parking({ x0: 4, x1: cx - 14, z0: 3, z1: 30 }, Math.max(0.5, s.details.cars));
  if (erX0 - 2 - (cx + 14) >= 8) s.parking({ x0: cx + 14, x1: erX0 - 2, z0: 3, z1: 30 }, Math.max(0.5, s.details.cars));

  // Flags + benches by the entrance, plant on the wing roofs, service bins at the back.
  s.flags((6 + cx - mh) / 2, 34.5, 3);
  s.props.push({ kind: 'bench', x: cx - mh + 1.5, y: 0.05, z: 31.5, rot: 0, color: '#6b4a33' });
  s.props.push({ kind: 'litterBin', x: cx - mh + 3, y: 0.05, z: 31.5, rot: 0, color: '#3a3d40' });
  for (const m of [left, right]) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) s.props.push({ kind: 'acUnit', x: m.rect.x0 + 3 + i * 2.4, y: massTop(m), z: m.rect.z1 - 3, rot: 0, color: '#c9ccd1' });
  }
  for (let i = 0; i < 3; i++) s.props.push({ kind: 'acUnit', x: main.rect.x0 + 2.5 + i * 2.2, y: top, z: main.rect.z1 - 2, rot: 0, color: '#c9ccd1' });
  const yard = s.placer();
  for (let i = 0; i < 3; i++) {
    const spot = yard.place({ x0: 4, x1: W - 4, z0: D - 8, z1: D - 1 }, 2, 1.3, [0]);
    if (spot) s.props.push({ kind: 'dumpster', x: spot.x, y: 0.05, z: spot.z, rot: 0, color: rng.pick(['#2e6b4a', '#1f3f73']) });
  }
  s.opening(left, 'front', 0.5, 'door', 2, 2.5, accent);
  if (back) s.opening(back, 'back', 0.5, 'door', 2.2, 2.6, '#5a6b7d');
  s.linkPaths(2);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, Math.round((W * D) / 500));
}

export function clinic(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#f2f0ea', '#e8eef0', '#efe8dc', '#dfe9e2']), rng, 0.02);
  const accent = rng.pick(['#2e8b57', '#2f6db5', '#2e8b7a']);
  const amb = W >= 30 && rng.chance(0.55);
  const bx0 = 3;
  const bx1 = amb ? W - 7 : W - 3;
  const bz0 = 11;
  const m = s.mass('main', { x0: bx0, x1: bx1, z0: bz0, z1: Math.min(D - 5, bz0 + 14) }, rng.int(1, 2), 3.6, wall, { color: '#8f9499' });
  const cx = (bx0 + bx1) / 2;
  s.windows(m, { bay: 3, w: 1.9, h: 1.4, sill: 0.9, style: rng.pick<WindowStyle>(['plain', 'ribbon']), frame: '#5a6b7d', litChance: 0.55 });
  s.opening(m, 'front', 0.5, 'shopfront', 4, 2.8, '#2b3a48', 'shop');
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 3, x1: cx + 3, z0: bz0 - 3, z1: bz0 }, floorY: 0, roofY: 3.1, stepX: cx, floorColor: s.pavingColor, roofColor: '#e9e6df', postColor: accent });
  s.lights.push({ kind: 'ceiling', x: cx, y: 3.08, z: bz0 - 1.5, rot: 0 });
  s.sign(m, 'front', 0.5, 3.3, Math.min(9, bx1 - bx0 - 4), 0.7, accent);
  // Lit cross beside the entrance.
  const crossX = cx + 4.6;
  s.clear(m, 'front', crossX, bz0, 1.6, 3.4, 1.6);
  s.props.push({ kind: 'crossSign', x: crossX, y: 2.5, z: bz0, rot: 0, color: '#2ecc71', w: 1.3 });

  s.paths.push({ x0: cx - 1.2, x1: cx + 1.2, z0: 0, z1: bz0 - 3 });
  s.parking({ x0: 1, x1: cx - 1.8, z0: 1, z1: 6.5 });
  s.parking({ x0: cx + 1.8, x1: amb ? W - 7.5 : W - 1, z0: 1, z1: 6.5 });
  if (amb) {
    s.driveways.push({ x0: W - 6.2, x1: W - 1, z0: 0, z1: bz0 + 8 });
    s.props.push({ kind: 'ambulance', x: W - 3.6, y: 0.05, z: bz0 + 4, rot: 0, color: '#f4f1ea' });
  }
  s.props.push({ kind: 'bench', x: cx - 4.5, y: 0.05, z: bz0 - 1.2, rot: 0, color: '#6b4a33' });
  s.props.push({ kind: 'planter', x: cx - 3.4, y: 0.05, z: bz0 - 3.6, rot: 0, color: '#8f8a83', color2: '#4f8a3a' });
  s.props.push({ kind: 'planter', x: cx + 3.4, y: 0.05, z: bz0 - 3.6, rot: 0, color: '#8f8a83', color2: '#4f8a3a' });
  s.props.push({ kind: 'acUnit', x: bx0 + 2, y: massTop(m), z: m.rect.z1 - 2, rot: 0, color: '#c9ccd1' });
  s.props.push({ kind: 'bins', x: bx0 + 1.5, y: 0.05, z: Math.min(D - 1.5, m.rect.z1 + 1.6), rot: 0, color: '#2e6b4a', color2: '#1f3f73' });
  const back: Rect = { x0: 0, x1: W, z0: m.rect.z1, z1: D };
  s.trees_(back, 3);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 2);
}
