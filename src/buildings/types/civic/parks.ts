/**
 * Parks and services:
 *   (parks and the zoo live in landscape.ts)
 *   wasteYard  -> fenced municipal dump: landfill mounds with a bulldozer, transfer shed, weighbridge
 *                 + gatehouse, rows of skips and recycling dumpsters, garbage trucks
 *   collection -> neighbourhood garbage point: walled pad with dumpsters, recycling bins and bag piles
 *   utility    -> electrical substation (transformers, control house, pylons) and / or a municipal
 *                 water tower with a pump house
 */
import { massTop, type Rect } from '../../spec';
import { Site, jitter } from './site';


export function wasteYard(s: Site): void {
  const { rng, W, D } = s;
  s.lawnColor = jitter('#8a8f5a', rng, 0.05);
  const truckColors = ['#2e6b4a', '#f4f1ea', '#f39c12', '#1f6fb5'];
  // Paved working yard + gate, weighbridge and gatehouse.
  const gx = rng.range(W * 0.3, W * 0.6);
  s.parkingLots.push({ rect: { x0: 3, x1: W - 3, z0: 3, z1: D * 0.45 }, rows: [], stallWidth: 3, color: '#6b6a66' });
  s.driveways.push({ x0: gx - 4, x1: gx + 4, z0: 0, z1: 3 });
  const wb = { x0: gx - 2, x1: gx + 2, z0: 6, z1: 18 };
  s.paths.push(wb);
  const gh = s.mass('unit', { x0: gx + 4, x1: gx + 8, z0: 8, z1: 12 }, 1, 2.8, '#d9d4c7', { color: '#6b6e72' });
  s.windows(gh, { bay: 2, w: 1.4, h: 1.1, sill: 1.0, style: 'plain', frame: '#3a3d40', litChance: 0.8 });
  s.sign(gh, 'front', 0.5, 2.0, 3, 0.5, '#2e6b4a');
  // Transfer shed with open bays.
  const shed = s.mass('main', { x0: 6, x1: Math.min(gx - 8, 44), z0: 14, z1: 36 }, 1, 9, jitter('#9fb0bf', rng, 0.04), { color: '#7a7f86' });
  const nb = Math.max(1, Math.floor((shed.rect.x1 - shed.rect.x0) / 10));
  for (let i = 0; i < nb; i++) s.opening(shed, 'front', (i + 0.5) / nb, 'garageDoor', 7, 6.5, '#3a3d40', 'garage');
  s.sign(shed, 'front', 0.5, 7.2, 8, 0.9, '#2e6b4a');
  // Skips + recycling row along the right side.
  const sx0 = W - 8;
  for (let z = 8; z < D * 0.45 - 4; z += 6.5) s.props.push({ kind: 'skip', x: sx0, y: 0.05, z, rot: 0, color: rng.pick(['#f2c94c', '#2e6b4a', '#1f6fb5', '#c0392b']) });
  const rec = ['#2e6b4a', '#1f6fb5', '#f2c94c', '#7f8c8d', '#c0392b'];
  for (let i = 0; i < 5; i++) s.props.push({ kind: 'dumpster', x: gx + 12 + i * 2.4, y: 0.05, z: D * 0.45 - 2.5, rot: 0, color: rec[i] });
  // Garbage trucks in the yard and queuing on the weighbridge.
  const yard = s.placer();
  for (let i = 0; i < rng.int(2, 4); i++) {
    const spot = yard.place({ x0: gx + 6, x1: sx0 - 3, z0: 14, z1: D * 0.45 - 5 }, 2.6, 9, [0, Math.PI], 1);
    if (spot) s.props.push({ kind: 'garbageTruck', x: spot.x, y: 0.05, z: spot.z, rot: spot.rot, color: rng.pick(truckColors) });
  }
  if (rng.chance(0.7)) s.props.push({ kind: 'garbageTruck', x: gx, y: 0.05, z: 12, rot: Math.PI, color: rng.pick(truckColors) });
  // Landfill at the back: overlapping mounds, a bulldozer working one of them.
  const lz0 = D * 0.5;
  const n = Math.max(2, Math.floor((W - 10) / 26));
  let biggest = 0;
  for (let i = 0; i < n; i++) {
    const x = 8 + ((W - 16) * (i + 0.5)) / n + rng.range(-3, 3);
    const z = lz0 + (D - lz0) * rng.range(0.4, 0.6);
    const r = Math.min((W - 16) / n / 2 + 4, (D - lz0) / 2 - 2);
    const h = rng.range(4, 8);
    biggest = Math.max(biggest, h);
    s.props.push({ kind: 'mound', x, y: 0, z, rot: 0, color: '#6b5d4f', w: r, h });
  }
  s.props.push({ kind: 'bulldozer', x: rng.range(12, W - 12), y: 0.05, z: lz0 + 1.5, rot: rng.range(-0.6, 0.6), color: '#f2c94c' });
  s.height = biggest + 2;
  for (let x = 12; x < W - 8; x += 24) s.lights.push({ kind: 'lotLight', x, y: 0.07, z: D * 0.45, rot: 0 });
  s.fence('privacy', '#8f959c', 2.6, [[gx - 4, gx + 4]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: 3 }, 3);
}

export function collectionPoint(s: Site): void {
  const { rng, W, D } = s;
  // Concrete pad with a low wall on three sides, open to the street.
  const pz1 = Math.min(D - 2, 9);
  s.parkingLots.push({ rect: { x0: 2, x1: W - 2, z0: 1, z1: pz1 }, rows: [], stallWidth: 3, color: '#8f8a83' });
  s.fences.push({ kind: 'privacy', color: jitter('#b9b4aa', rng, 0.04), height: 1.6, segments: [{ x0: 1.8, z0: 1, x1: 1.8, z1: pz1 + 0.2 }, { x0: W - 1.8, z0: 1, x1: W - 1.8, z1: pz1 + 0.2 }, { x0: 1.8, z0: pz1 + 0.2, x1: W - 1.8, z1: pz1 + 0.2 }] });
  const colors = ['#2e6b4a', '#2e6b4a', '#1f6fb5', '#f2c94c', '#7f8c8d', '#c0392b'];
  const n = Math.floor((W - 5) / 2.3);
  for (let i = 0; i < n; i++) {
    const x = 3.6 + i * 2.3;
    if (rng.chance(0.85)) s.props.push({ kind: 'dumpster', x, y: 0.05, z: pz1 - 1.1, rot: 0, color: rng.pick(colors) });
    else s.props.push({ kind: 'bins', x, y: 0.05, z: pz1 - 1, rot: 0, color: '#2e6b4a', color2: '#1f6fb5' });
  }
  // Overflowing bag piles in front of the dumpsters.
  for (let i = 0; i < rng.int(1, 4); i++) s.props.push({ kind: 'mound', x: rng.range(3.5, W - 3.5), y: 0, z: rng.range(2.5, pz1 - 3), rot: 0, color: '#2b2b2b', w: rng.range(0.7, 1.3), h: rng.range(0.4, 0.8) });
  s.props.push({ kind: 'litterBin', x: W - 1, y: 0.05, z: 0.6, rot: 0, color: '#2d4f3c' });
  s.lights.push({ kind: 'post', x: 1, y: 0.05, z: 0.6, rot: 0 });
  if (D > pz1 + 4) s.trees_({ x0: 0, x1: W, z0: pz1 + 1, z1: D }, Math.max(1, Math.round(W / 8)));
}

export function utility(s: Site): void {
  const { rng, W, D } = s;
  const kind = rng.weighted<'substation' | 'waterTower' | 'both'>([['substation', 45], ['waterTower', 30], ['both', 25]]);
  s.info.kind = kind;
  const wantTower = kind !== 'substation';
  const wantSub = kind !== 'waterTower';
  const split = wantTower && wantSub ? W * 0.6 : W;
  if (wantSub) {
    const yard: Rect = { x0: 3, x1: split - 3, z0: 4, z1: D - 3 };
    s.parkingLots.push({ rect: yard, rows: [], stallWidth: 3, color: '#9a958a' });
    s.fences.push({ kind: 'iron', color: '#5a5f66', height: 2.6, segments: [
      { x0: yard.x0, z0: yard.z0, x1: yard.x1, z1: yard.z0 }, { x0: yard.x0, z0: yard.z1, x1: yard.x1, z1: yard.z1 },
      { x0: yard.x0, z0: yard.z0, x1: yard.x0, z1: yard.z1 }, { x0: yard.x1, z0: yard.z0, x1: yard.x1, z1: yard.z1 },
    ] });
    const ctl = s.mass('unit', { x0: yard.x0 + 2, x1: yard.x0 + 12, z0: yard.z0 + 2, z1: yard.z0 + 8 }, 1, 3.4, jitter('#9c5a45', rng, 0.04), { color: '#6b6e72' });
    s.windows(ctl, { bay: 3, w: 1.2, h: 1.2, sill: 1.2, style: 'plain', frame: '#3a3d40', litChance: 0.6 });
    s.opening(ctl, 'front', 0.75, 'door', 1.6, 2.3, '#5a5f66');
    // Transformer grid.
    const tx0 = yard.x0 + 16;
    for (let x = tx0; x < yard.x1 - 3; x += 6) for (let z = yard.z0 + 4; z < yard.z1 - 12; z += 6) s.props.push({ kind: 'transformer', x, y: 0.05, z, rot: 0, color: '#8a8f96' });
    // Pylons at the back carrying the lines away.
    for (let x = yard.x0 + 6; x < yard.x1 - 4; x += 16) s.props.push({ kind: 'pylon', x, y: 0.05, z: yard.z1 - 5, rot: 0, color: '#8f959c', h: rng.range(18, 26) });
    s.height = 30;
    for (const x of [yard.x0 + 1, yard.x1 - 1]) s.lights.push({ kind: 'lotLight', x, y: 0.07, z: yard.z0 + 1, rot: 0 });
  }
  if (wantTower) {
    const x0 = wantSub ? split : 0;
    const tcx = (x0 + W) / 2;
    const tcz = D * 0.55;
    const h = rng.range(22, 32);
    s.props.push({ kind: 'waterTowerTall', x: tcx, y: 0.05, z: tcz, rot: 0, color: rng.pick(['#e9e6df', '#b5c4c9', '#9fb0bf']), color2: rng.pick(['#8f959c', '#5a6b7d']), h, w: Math.min(6, (W - x0) / 3) });
    s.reserved.push({ x0: tcx - 6.5, x1: tcx + 6.5, z0: tcz - 6.5, z1: tcz + 6.5 });
    const pump = s.mass('unit', { x0: tcx - 4, x1: tcx + 4, z0: tcz - 14, z1: tcz - 9 }, 1, 3.2, jitter('#d9cfbd', rng, 0.04), { color: '#6b6e72' });
    s.windows(pump, { bay: 3, w: 1.2, h: 1, sill: 1.4, style: 'plain', frame: '#3a3d40', litChance: 0.4 });
    s.opening(pump, 'front', 0.5, 'door', 1.6, 2.3, '#3f5f7a');
    s.paths.push({ x0: tcx - 1, x1: tcx + 1, z0: 0, z1: tcz - 14 });
    s.height = Math.max(s.height ?? 0, h + 7);
    s.trees_({ x0, x1: W, z0: 0, z1: D }, 5);
  }
  s.props.push({ kind: 'acUnit', x: 6, y: massTop(s.masses[0]), z: 9, rot: 0, color: '#c9ccd1' });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: 4 }, 3);
}
