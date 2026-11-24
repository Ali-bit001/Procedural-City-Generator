/**
 * Public buildings:
 *   stadium       -> football pitch ringed by four roofed grandstands, corner floodlight masts,
 *                    entrance plaza with ticket booths, flags and parking
 *   trainStation  -> station hall (tall glazed concourse + wings) on a taxi forecourt, platforms with
 *                    long canopies, tracks, a train at the platform, an enclosed footbridge
 *   busStand      -> terminal hall, sheltered island platforms with buses in the bays, rickshaws / taxis
 *   parkingGarage -> stacked open decks on columns with cars on every level, scissor ramps, stair core,
 *                    big "P" sign
 *   fireStation   -> apparatus hall with big bay doors and trucks on the apron, crew quarters, drill tower
 *   policeStation -> 2-3 storey block with a blue band and sign, entrance steps, patrol cars, fenced yard
 */
import { massTop, type WindowStyle } from '../../spec';
import { CAR_COLORS, Site, jitter } from './site';

export function stadium(s: Site): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const team = rng.pick(['#1f6fb5', '#c0392b', '#27ae60', '#f1c40f', '#5b2c83', '#e67e22']);
  const team2 = rng.pick(['#f4f1ea', '#1e1f22', '#c9ccd1']);
  // Pitch scaled to fit the lot behind a ~26 m entrance plaza.
  const avail = D - 30 - 4;
  const k = Math.min(1, (avail - 2 * 18 - 6) / 68, (W - 8 - 2 * 18 - 6) / 105);
  const pl = 105 * k;
  const pw = 68 * k;
  const zc = 30 + avail / 2;
  s.court('football', { x0: cx - pl / 2, x1: cx + pl / 2, z0: zc - pw / 2, z1: zc + pw / 2 });
  s.props.push({ kind: 'goalPost', x: cx - pl / 2 + 1, y: 0.08, z: zc, rot: -Math.PI / 2, color: '#f4f1ea' });
  s.props.push({ kind: 'goalPost', x: cx + pl / 2 - 1, y: 0.08, z: zc, rot: Math.PI / 2, color: '#f4f1ea' });

  // Stands: long sides deeper/taller than the ends.
  const sd = 18 * Math.max(0.8, k);
  const ed = 15 * Math.max(0.8, k);
  const gap = 3;
  const sh = rng.range(11, 15);
  const eh = sh * rng.range(0.6, 0.85);
  const stand = (x: number, z: number, rot: number, w: number, d: number, h: number) => {
    s.props.push({ kind: 'grandstand', x, y: 0.05, z, rot, color: team, color2: team2, w, d, h });
    const along = Math.abs(Math.sin(rot)) < 0.5;
    s.reserved.push(along ? { x0: x - w / 2 - 1, x1: x + w / 2 + 1, z0: z - d / 2 - 1, z1: z + d / 2 + 1 } : { x0: x - d / 2 - 1, x1: x + d / 2 + 1, z0: z - w / 2 - 1, z1: z + w / 2 + 1 });
  };
  stand(cx, zc + pw / 2 + gap + sd / 2, 0, pl + 6, sd, sh);
  stand(cx, zc - pw / 2 - gap - sd / 2, Math.PI, pl + 6, sd, sh);
  stand(cx - pl / 2 - gap - ed / 2, zc, -Math.PI / 2, pw + 4, ed, eh);
  stand(cx + pl / 2 + gap + ed / 2, zc, Math.PI / 2, pw + 4, ed, eh);
  // Pitch-side LED advertising boards on all four sides, a video scoreboard on one end stand.
  const ab = 1.4;
  s.props.push({ kind: 'adBoards', x: cx, y: 0.08, z: zc - pw / 2 - ab, rot: Math.PI, color: '#1e1f22', w: pl - 6, h: 0.9 });
  s.props.push({ kind: 'adBoards', x: cx, y: 0.08, z: zc + pw / 2 + ab, rot: 0, color: '#1e1f22', w: pl - 6, h: 0.9 });
  s.props.push({ kind: 'adBoards', x: cx - pl / 2 - ab, y: 0.08, z: zc, rot: -Math.PI / 2, color: '#1e1f22', w: pw - 6, h: 0.9 });
  s.props.push({ kind: 'adBoards', x: cx + pl / 2 + ab, y: 0.08, z: zc, rot: Math.PI / 2, color: '#1e1f22', w: pw - 6, h: 0.9 });
  const sbSide = rng.chance(0.5) ? -1 : 1;
  s.props.push({ kind: 'scoreboard', x: cx + sbSide * (pl / 2 + gap + ed * 0.7), y: eh + 7.15, z: zc, rot: sbSide < 0 ? -Math.PI / 2 : Math.PI / 2, color: '#1e1f22', w: Math.min(16, pw * 0.3) });
  const fx = pl / 2 + gap + ed * 0.7;
  const fz = pw / 2 + gap + sd * 0.7;
  const fh = sh + 22;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * fx;
    const z = zc + sz * fz;
    s.props.push({ kind: 'floodlight', x, y: 0.05, z, rot: Math.atan2(-(cx - x), -(zc - z)), color: '#9aa0a6', h: fh });
  }
  s.height = fh + 4;

  // Entrance plaza with ticket booths, flags and lamps; parking either side.
  const plazaZ1 = zc - pw / 2 - gap - sd - 1;
  s.paths.push({ x0: cx - 34, x1: cx + 34, z0: 0, z1: plazaZ1 });
  const nb = rng.int(2, 4);
  for (let i = 0; i < nb; i++) {
    const bx = cx + (i - (nb - 1) / 2) * 14;
    const booth = s.mass('unit', { x0: bx - 2, x1: bx + 2, z0: plazaZ1 - 7, z1: plazaZ1 - 4 }, 1, 3, team2 === '#1e1f22' ? '#5a5f66' : '#e9e6df', { color: team });
    s.opening(booth, 'front', 0.5, 'shopfront', 2.6, 1.6, '#2b3a48', 'shop');
    s.sign(booth, 'front', 0.5, 2.3, 3, 0.5, team);
  }
  s.flags(cx, 4, 6);
  for (const x of [cx - 30, cx - 15, cx + 15, cx + 30]) s.lights.push({ kind: 'post', x, y: 0.05, z: 10, rot: 0 });
  for (const x of [cx - 26, cx - 8, cx + 8, cx + 26]) s.props.push({ kind: 'litterBin', x, y: 0.05, z: 13, rot: 0, color: '#3a3d40' });
  if (cx - 34 - 4 >= 10) {
    s.parking({ x0: 3, x1: cx - 36, z0: 2, z1: plazaZ1 - 2 });
    s.parking({ x0: cx + 36, x1: W - 3, z0: 2, z1: plazaZ1 - 2 });
  }
  s.props.push({ kind: 'pylonSign', x: cx - 35, y: 0.05, z: 2, rot: 0, color: team, color2: '#3a3d40', h: 9, w: 3.5 });
  for (const [x, z] of [[3, D - 3], [W - 3, D - 3]]) s.trees_({ x0: x - 3, x1: x + 3, z0: z - 3, z1: z + 3 }, 1);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 8);
}

export function trainStation(s: Site): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const stone = jitter(rng.pick(['#d9cfbd', '#c9b99a', '#b5a58f', '#e2d6bf', '#9c5a45']), rng, 0.03);
  const trim = rng.pick(['#3a4a5a', '#2d4f3c', '#5a3a28']);
  // Concourse hall + wings.
  const hall = s.mass('main', { x0: cx - 12, x1: cx + 12, z0: 12, z1: 34 }, 1, 12, stone, { type: rng.chance(0.5) ? 'gable' : 'flat', pitch: 0.4, axis: 'z', color: '#5f6b73', parapet: true });
  s.glaze(hall, ['front'], trim);
  s.opening(hall, 'front', 0.5, 'shopfront', 8, 3.4, '#2b3a48', 'shop', false);
  const wingW = Math.min(W * 0.2, 34);
  const wl = s.mass('wing', { x0: cx - 12 - wingW, x1: cx - 12, z0: 14, z1: 32 }, 2, 5, stone);
  const wr = s.mass('wing', { x0: cx + 12, x1: cx + 12 + wingW, z0: 14, z1: 32 }, 2, 5, stone);
  for (const m of [wl, wr]) s.windows(m, { bay: 3.4, w: 1.8, h: 2.6, sill: 0.9, style: 'georgian', frame: trim, litChance: 0.5 });
  s.sign(wl, 'front', 0.7, 10.4, 10, 1.1, trim);
  if (rng.chance(0.6)) {
    s.props.push({ kind: 'clockTower', x: wr.rect.x1 - 2.5, y: massTop(wr), z: 23, rot: 0, color: stone, color2: '#5f6b73', h: 12 });
    s.height = massTop(wr) + 17;
  }

  // Forecourt with a taxi rank and a bus.
  s.driveways.push({ x0: cx - 12 - wingW, x1: cx + 12 + wingW, z0: 0, z1: 11 });
  const nTaxi = rng.int(3, 7);
  for (let i = 0; i < nTaxi; i++) s.props.push({ kind: 'car', x: cx - 10 - wingW + 3 + i * 5.2, y: 0.05, z: 8.5, rot: Math.PI / 2, color: rng.pick(['#f2c94c', '#f2c94c', '#1e1f22']) });
  if (rng.chance(0.6)) s.props.push({ kind: 'bus', x: cx + wingW, y: 0.05, z: 4, rot: Math.PI / 2, color: rng.pick(['#c0392b', '#1f6fb5', '#27ae60']), d: 11 });
  for (const x of [cx - 12 - wingW + 4, cx - 16, cx + 16, cx + 12 + wingW - 4]) s.lights.push({ kind: 'post', x, y: 0.05, z: 11.8, rot: 0 });
  if (cx - 12 - wingW - 3 >= 10) s.parking({ x0: 3, x1: cx - 12 - wingW - 2, z0: 2, z1: 32 });

  // Platforms, tracks and canopies along x behind the hall.
  const px0 = 6;
  const px1 = W - 6;
  const plen = px1 - px0;
  const platColor = '#b9b4aa';
  const platform = (z0: number, z1: number) => {
    s.mass('unit', { x0: px0, x1: px1, z0, z1 }, 1, 0.95, platColor, { parapet: false, color: '#c9c4b8' });
    s.props.push({ kind: 'platformCanopy', x: (px0 + px1) / 2, y: 1.1, z: (z0 + z1) / 2, rot: 0, color: '#5f6b73', color2: trim, w: plen - 10, d: z1 - z0 + 1.5, h: 3.6 });
    for (let x = px0 + 10; x < px1 - 8; x += 14) s.props.push({ kind: 'bench', x, y: 1.1, z: (z0 + z1) / 2 + 0.7, rot: 0, color: '#6b4a33' });
  };
  platform(37, 43);
  let z = 43;
  let tracks = 0;
  let lastPlat = 40;
  let open = false;
  const trackZs: number[] = [];
  while (z + 14 <= D - 3) {
    trackZs.push(z + 2.1, z + 5.9);
    for (const tz of [z + 2.1, z + 5.9]) s.props.push({ kind: 'railTrack', x: (px0 + px1) / 2 - 1, y: 0.05, z: tz, rot: 0, color: '#9aa0a6', w: W - 4 });
    tracks += 2;
    if (z + 8 + 6 + 14 <= D - 3) {
      platform(z + 8, z + 14);
      lastPlat = z + 11;
      z += 14;
    } else {
      z += 8;
      open = true;
      break;
    }
  }
  if (open && z + 6 <= D - 3) {
    platform(z, z + 6);
    lastPlat = z + 3;
  }
  // A train or two waiting at the platforms.
  for (const tz of trackZs) {
    if (!rng.chance(0.45)) continue;
    const n = rng.int(3, Math.max(3, Math.floor((plen - 10) / 20)));
    s.props.push({ kind: 'train', x: (px0 + px1) / 2 + rng.range(-4, 4), y: 0.05, z: tz, rot: Math.PI / 2, color: rng.pick(['#e9e6df', '#c9ccd1', '#1f6fb5']), color2: rng.pick(['#c0392b', '#1f3f73', '#f1c40f', '#27ae60']), d: n * 20 });
  }
  // Enclosed footbridge over the tracks, stair towers on each end.
  if (tracks >= 2) {
    const bx = px0 + plen * rng.range(0.25, 0.35);
    const zEnd = lastPlat;
    const bridge = s.mass('upper', { x0: bx, x1: bx + 3.2, z0: 37.5, z1: Math.min(D - 2, zEnd) }, 1, 3, '#c9ccd1', { color: '#8f9499' }, { baseY: 7.2 });
    s.glaze(bridge, ['left', 'right'], '#5a6b7d');
    s.mass('stairTower', { x0: bx + 3.2, x1: bx + 7.2, z0: 37.5, z1: 42.5 }, 3, 3.4, '#c9ccd1', { color: '#8f9499' }, { baseY: 1.05 });
  }
  s.info.tracks = tracks;
  s.fence('iron', '#3a3d40', 1.8, [[0, W]]);
}

export function busStand(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#e9e6df', '#d9d4c7', '#e2d6bf', '#c9d6dc']), rng, 0.03);
  const brand = rng.pick(['#c0392b', '#1f6fb5', '#27ae60', '#e67e22']);
  const hz0 = D - 14;
  const hall = s.mass('main', { x0: W * 0.2, x1: W * 0.8, z0: hz0, z1: D - 3 }, 1, 4.5, wall, { color: '#8f9499' });
  s.windows(hall, { bay: 3, w: 2.4, h: 2.2, sill: 0.4, style: 'shop', frame: '#3a3d40', litChance: 0.7, sides: ['front'] });
  s.windows(hall, { bay: 3.4, w: 1.6, h: 1.2, sill: 1.4, style: 'plain', frame: '#3a3d40', sides: ['left', 'right', 'back'] });
  for (const t of [0.3, 0.7]) s.opening(hall, 'front', t, 'shopfront', 3, 2.8, '#2b3a48', 'shop');
  s.sign(hall, 'front', 0.5, 3.4, Math.min(14, W * 0.4), 0.9, brand);
  s.porches.push({ kind: 'arcade', rect: { x0: W * 0.2, x1: W * 0.8, z0: hz0 - 3, z1: hz0 }, floorY: 0, roofY: 3.3, stepX: W / 2, floorColor: s.pavingColor, roofColor: brand, postColor: '#9aa0a6' });
  for (let x = W * 0.2 + 3; x < W * 0.8 - 2; x += 6) s.lights.push({ kind: 'ceiling', x, y: 3.28, z: hz0 - 1.5, rot: 0 });

  // Bus apron with island platforms (sheltered) and buses either side.
  s.parkingLots.push({ rect: { x0: 2, x1: W - 2, z0: 0, z1: hz0 - 3.5 }, rows: [], stallWidth: 3, color: '#55585d' });
  const busColors = ['#c0392b', '#1f6fb5', '#27ae60', '#f39c12', '#e9e6df', '#8e44ad'];
  const islandLen = W - 18;
  let iz = 9;
  while (iz + 4 + 9 < hz0 - 3.5) {
    s.paths.push({ x0: 9, x1: 9 + islandLen, z0: iz, z1: iz + 3.6 });
    s.porches.push({ kind: 'arcade', rect: { x0: 10, x1: 8 + islandLen, z0: iz + 0.3, z1: iz + 3.3 }, floorY: 0.12, roofY: 3.2, stepX: W / 2, floorColor: '#b9b4aa', roofColor: brand, postColor: '#9aa0a6' });
    for (let x = 14; x < 8 + islandLen - 2; x += 7) s.props.push({ kind: 'bench', x, y: 0.18, z: iz + 2.4, rot: 0, color: '#9aa0a6' });
    for (const bz of [iz - 2.4, iz + 6]) {
      for (let bx = 9 + 6; bx < 9 + islandLen - 5; bx += 13) {
        if (rng.chance(0.6)) s.props.push({ kind: 'bus', x: bx, y: 0.05, z: bz, rot: Math.PI / 2, color: rng.pick(busColors), d: 11 });
      }
    }
    iz += 13;
  }
  // Rickshaws / taxis waiting by the entrance, a ticket kiosk, bins.
  for (let i = 0; i < rng.int(2, 5); i++) s.props.push({ kind: rng.chance(0.5) ? 'motorbike' : 'car', x: 4 + i * 2.8, y: 0.05, z: hz0 - 6, rot: 0, color: rng.pick(['#f2c94c', '#2e6b4a', '#1e1f22', ...CAR_COLORS]) });
  s.props.push({ kind: 'pylonSign', x: W - 4, y: 0.05, z: 1.5, rot: 0, color: brand, color2: '#3a3d40', h: 7, w: 2.6 });
  for (const x of [W * 0.25, W * 0.75]) s.props.push({ kind: 'litterBin', x, y: 0.05, z: hz0 - 3.6, rot: 0, color: '#3a3d40' });
  s.props.push({ kind: 'dumpster', x: 3, y: 0.05, z: D - 2.5, rot: 0, color: '#2e6b4a' });
  for (const x of [1.2, W - 1.2]) s.lights.push({ kind: 'lotLight', x, y: 0.07, z: hz0 - 5, rot: 0 });
}

export function parkingGarage(s: Site): void {
  const { rng, W, D } = s;
  const levels = rng.int(3, 6);
  const lh = 3.1;
  const conc = jitter(rng.pick(['#c9c4b8', '#b9b4aa', '#d4cfc4']), rng, 0.03);
  const band = rng.pick(['#c9c4b8', '#1f6fb5', '#e67e22', '#2e8b57', '#9aa0a6']);
  const x0 = 7;
  const rw = 7; // two-lane ramp tower beside the decks
  const x1 = W - 3.5 - rw;
  const z0 = 4;
  const z1 = D - 4;
  const dw = x1 - x0;
  const dd = z1 - z0;
  // Ground floor: open parking under the first deck; entry lane into the ramp tower from the street.
  s.parkingLots.push({ rect: { x0, x1: x1 + rw, z0, z1 }, rows: [], stallWidth: 2.6, color: '#55585d' });
  s.driveways.push({ x0: x1, x1: x1 + rw, z0: 0, z1: z0 });
  const carsOnDeck = (y: number) => {
    for (const zr of [z0 + 0.5 + 2.5, z1 - 0.5 - 2.5]) {
      for (let x = x0 + 1 + 1.3; x < x1 - 1.3; x += 2.6) {
        if (rng.chance(y === 0 ? 0.6 : y > (levels - 1) * lh ? 0.3 : 0.55)) s.props.push({ kind: 'car', x, y: y + 0.05, z: zr, rot: zr < (z0 + z1) / 2 ? 0 : Math.PI, color: rng.pick(CAR_COLORS) });
      }
    }
  };
  carsOnDeck(0);
  for (let k = 1; k <= levels; k++) {
    const y = k * lh;
    s.props.push({ kind: 'parkingDeck', x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, rot: 0, color: k % 2 ? band : conc, w: dw, d: dd, h: lh, n: 1 });
    carsOnDeck(y);
  }
  s.props.push({ kind: 'garageRamp', x: x1 + rw / 2, y: 0.05, z: (z0 + z1) / 2, rot: 0, color: band, w: rw, d: dd, h: lh, n: levels });
  // Light posts on the open top deck.
  for (let x = x0 + 6; x < x1 - 3; x += 14) s.lights.push({ kind: 'post', x, y: levels * lh, z: (z0 + z1) / 2, rot: 0 });
  // Stair / lift core at the front-left corner, with the P sign.
  const core = s.mass('stairTower', { x0: 1.5, x1: x0, z0: z0, z1: z0 + 5.5 }, levels + 1, lh, conc, { color: '#8f9499' });
  s.windows(core, { bay: 2.5, w: 0.9, h: 1.6, sill: 0.8, style: 'plain', frame: '#3a3d40', sides: ['front', 'left'], litChance: 0.7 });
  s.opening(core, 'front', 0.5, 'door', 1.4, 2.3, '#3a3d40');
  s.sign(core, 'front', 0.5, massTop(core) - 2.6, 3.6, 2.2, '#1f6fb5');
  s.props.push({ kind: 'pylonSign', x: W - 1.2, y: 0.05, z: 1.4, rot: 0, color: '#1f6fb5', color2: '#3a3d40', h: 5, w: 1.8 });
  s.props.push({ kind: 'atm', x: 3.8, y: 0.15, z: z0, rot: 0, color: '#1f6fb5' });
  s.height = (levels + 1) * lh + 2;
  s.info.levels = levels;
}

export function fireStation(s: Site): void {
  const { rng, W, D } = s;
  const brick = rng.chance(0.6);
  const wall = brick ? jitter(rng.pick(['#9c5a45', '#8b4a3a', '#a86a50']), rng, 0.03) : jitter(rng.pick(['#e2ddd0', '#d9d4c7', '#c9ccd1']), rng, 0.03);
  const red = '#b3121b';
  const bays = Math.max(2, Math.min(4, Math.floor((W - 18) / 5.5)));
  const bayW = bays * 5.5 + 2;
  const hallZ0 = 13;
  const hall = s.mass('main', { x0: 4, x1: 4 + bayW, z0: hallZ0, z1: hallZ0 + 18 }, 1, 6, wall, { color: '#6b6e72' });
  for (let i = 0; i < bays; i++) {
    const t = (1 + i * 5.5 + 2.75) / bayW;
    s.opening(hall, 'front', t, 'garageDoor', 4.2, 4.6, rng.chance(0.5) ? '#c9ccd1' : red, 'garage');
  }
  s.sign(hall, 'front', 0.5, 5.0, Math.min(12, bayW - 2), 0.8, red);
  for (let i = 0; i <= bays; i++) s.lights.push({ kind: 'sconce', x: 4 + 1 + i * 5.5 - 0.0, y: 4.9, z: hallZ0, rot: 0 });
  const qx0 = 4 + bayW;
  const quarters = s.mass('wing', { x0: qx0, x1: W - 4, z0: hallZ0 + 1, z1: hallZ0 + 15 }, 2, 3.4, jitter(wall, rng, 0.03));
  s.windows(quarters, { bay: 3, w: 1.6, h: 1.5, sill: 0.9, style: brick ? 'georgian' : 'plain', frame: '#e9e1cf', litChance: 0.6 });
  s.opening(quarters, 'front', 0.5, 'door', 1.8, 2.4, red);
  s.paths.push({ x0: (qx0 + W - 4) / 2 - 1, x1: (qx0 + W - 4) / 2 + 1, z0: 0, z1: hallZ0 + 1 });
  // Apron with trucks out front.
  s.driveways.push({ x0: 4, x1: 4 + bayW, z0: 0, z1: hallZ0 });
  const out = rng.int(1, Math.min(2, bays));
  for (let i = 0; i < out; i++) {
    const t = (1 + i * 5.5 + 2.75) / bayW;
    s.props.push({ kind: 'fireTruck', x: 4 + bayW * t, y: 0.05, z: 6.3, rot: 0, color: red });
  }
  // Drill tower at the back, with staff parking.
  const tower = s.mass('stairTower', { x0: W - 10, x1: W - 5, z0: hallZ0 + 20, z1: hallZ0 + 25 }, 5, 3, jitter(wall, rng, 0.04), { color: '#6b6e72' });
  s.windows(tower, { bay: 2.5, w: 1.2, h: 1.6, sill: 0.6, style: 'plain', frame: red, litChance: 0.2 });
  s.height = massTop(tower) + 2;
  s.driveways.push({ x0: W - 3.6, x1: W - 0.6, z0: 0, z1: hallZ0 + 19 });
  if (W - 14 - 4 >= 8) s.parking({ x0: 4, x1: W - 12, z0: hallZ0 + 20, z1: Math.min(D - 2, hallZ0 + 31) });
  s.props.push({ kind: 'flagpole', x: W - 2.2, y: 0.05, z: 3, rot: 0, color: '#c0392b', color2: '#ffffff', h: 8 });
  s.props.push({ kind: 'acUnit', x: qx0 + 2, y: massTop(quarters), z: quarters.rect.z1 - 2, rot: 0, color: '#c9ccd1' });
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 3);
}

export function policeStation(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#e2ddd0', '#d9d4c7', '#c9ccd1', '#e9e6df']), rng, 0.03);
  const blue = rng.pick(['#1f3f73', '#24427a', '#1b365d']);
  const floors = rng.int(2, 3);
  const bx1 = W - 7;
  const m = s.mass('main', { x0: 5, x1: bx1, z0: 11, z1: 25 }, floors, 3.6, wall, { color: '#6b6e72' });
  s.windows(m, { bay: 3, w: 1.6, h: 1.6, sill: 0.9, style: rng.pick<WindowStyle>(['plain', 'ribbon']), frame: blue, litChance: 0.65 });
  const cx = (5 + bx1) / 2;
  s.opening(m, 'front', 0.5, 'door', 2.4, 2.6, '#2b3a48', 'glassPanel');
  s.sign(m, 'front', 0.5, 3.1, Math.min(12, bx1 - 9), 0.6, blue);
  s.porches.push({ kind: 'stoop', rect: { x0: cx - 3, x1: cx + 3, z0: 9.2, z1: 11 }, floorY: 0.55, roofY: 3, stepX: cx, floorColor: '#b9b4aa', roofColor: wall, postColor: '#3a3d40' });
  s.lights.push({ kind: 'sconce', x: cx - 2, y: 2.7, z: 11, rot: 0 }, { kind: 'sconce', x: cx + 2, y: 2.7, z: 11, rot: 0 });
  s.paths.push({ x0: cx - 1.6, x1: cx + 1.6, z0: 0, z1: 9.2 - 1.0 });
  s.flags(cx - 7, 5, 2);
  for (const x of [cx - 4, cx + 4]) s.lights.push({ kind: 'bollard', x, y: 0.05, z: 1.2, rot: 0 });
  // Patrol cars in front and in the yard.
  const police = ['#f4f1ea', '#1f3f73', '#1e1f22'];
  s.parking({ x0: cx + 2.5, x1: bx1, z0: 1.5, z1: 7 }, 0);
  for (let x = cx + 2.5 + 1.6; x < bx1 - 1.3; x += 2.6) if (rng.chance(0.7)) s.props.push({ kind: 'car', x, y: 0.05, z: 4.25, rot: Math.PI, color: rng.pick(police), h: 1 });
  s.driveways.push({ x0: W - 6, x1: W - 1, z0: 0, z1: 27 });
  const yard = { x0: 3, x1: W - 3, z0: 27, z1: D - 2 };
  if (yard.z1 - yard.z0 >= 5) {
    s.parking(yard, 0);
    for (let x = yard.x0 + 1.6; x < yard.x1 - 1.3; x += 2.6) if (rng.chance(0.55)) s.props.push({ kind: 'car', x, y: 0.05, z: yard.z0 + 2.5, rot: Math.PI, color: rng.pick(police), h: rng.chance(0.7) ? 1 : undefined });
  }
  s.fence('iron', '#2b2b2b', 2.2, [[cx - 2, cx + 2], [cx + 2.5, bx1], [W - 6, W - 1]]);
  for (let i = 0; i < 2; i++) s.props.push({ kind: 'acUnit', x: 7 + i * 2.5, y: massTop(m), z: 22, rot: 0, color: '#c9ccd1' });
  s.trees_({ x0: 0, x1: cx - 2, z0: 0, z1: 10 }, 2);
}
