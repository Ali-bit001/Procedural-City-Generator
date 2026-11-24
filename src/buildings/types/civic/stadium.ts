/**
 * Stadiums, in several designs:
 *   classic   -> four separate roofed grandstands round the pitch, corner floodlight masts
 *   bowl      -> continuous rounded-rectangle bowl, 1-2 tiers (hospitality band between), canopy or open
 *   round     -> near-circular / oval bowl
 *   horseshoe -> bowl open at one end, scoreboard standing in the opening
 *   oculus    -> big sloping roof over every seat with an open centre ringed by lights
 *   domed     -> fully covered arena: domed roof with panel bands and a skylight ring, glass / ribbed facade
 *   athletics -> running track round the pitch, roof over the main side only
 *   cricket   -> oval ground with low stands, a pavilion with a veranda in the open end, sight screens
 * Every design shares the entrance plaza (ticket booths, flags, lamps), parking and the pylon sign.
 */
import { massTop, type Bowl } from '../../spec';
import { bowlPoint, bowlTop } from '../../mesher/bowlMesher';
import { Site, jitter } from './site';

export type StadiumDesign = 'classic' | 'bowl' | 'round' | 'horseshoe' | 'oculus' | 'domed' | 'athletics' | 'cricket';

const TEAM = ['#1f6fb5', '#c0392b', '#27ae60', '#f1c40f', '#5b2c83', '#e67e22', '#0b8a8a', '#7a1f2b'];
const TEAM2 = ['#f4f1ea', '#1e1f22', '#c9ccd1'];
/** rot that makes a prop's front (-z local) face direction (fx, fz). */
const facing = (fx: number, fz: number) => Math.atan2(-fx, -fz);

export function stadium(s: Site, forced?: StadiumDesign): void {
  const design = forced ?? s.rng.weighted<StadiumDesign>([
    ['classic', 18], ['bowl', 16], ['round', 12], ['horseshoe', 12], ['oculus', 12], ['domed', 12], ['athletics', 8], ['cricket', 10],
  ]);
  s.info.design = design;
  if (design === 'classic') classic(s);
  else bowlStadium(s, design);
}

/** Entrance plaza in front of the stands (z < plazaZ1): booths, flags, lamps, bins, parking, sign, trees. */
function frontage(s: Site, cx: number, plazaZ1: number, team: string, team2: string): void {
  const { rng, W, D } = s;
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
  if (cx - 34 - 4 >= 10 && plazaZ1 > 9) {
    s.parking({ x0: 3, x1: cx - 36, z0: 2, z1: plazaZ1 - 2 });
    s.parking({ x0: cx + 36, x1: W - 3, z0: 2, z1: plazaZ1 - 2 });
  }
  s.props.push({ kind: 'pylonSign', x: cx - 35, y: 0.05, z: 2, rot: 0, color: team, color2: '#3a3d40', h: 9, w: 3.5 });
  for (const [x, z] of [[3, D - 3], [W - 3, D - 3]]) s.trees_({ x0: x - 3, x1: x + 3, z0: z - 3, z1: z + 3 }, 1);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, 8);
}

/** Football pitch (half sizes hx, hz) with goals and pitch-side LED boards. */
function footballPitch(s: Site, cx: number, cz: number, hx: number, hz: number, boards = true): void {
  s.court('football', { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });
  s.props.push({ kind: 'goalPost', x: cx - hx + 1, y: 0.08, z: cz, rot: -Math.PI / 2, color: '#f4f1ea', w: Math.min(7.32, hx * 0.14) });
  s.props.push({ kind: 'goalPost', x: cx + hx - 1, y: 0.08, z: cz, rot: Math.PI / 2, color: '#f4f1ea', w: Math.min(7.32, hx * 0.14) });
  if (!boards) return;
  const ab = 1.4;
  s.props.push({ kind: 'adBoards', x: cx, y: 0.08, z: cz - hz - ab, rot: Math.PI, color: '#1e1f22', w: hx * 2 - 6, h: 0.9 });
  s.props.push({ kind: 'adBoards', x: cx, y: 0.08, z: cz + hz + ab, rot: 0, color: '#1e1f22', w: hx * 2 - 6, h: 0.9 });
  s.props.push({ kind: 'adBoards', x: cx - hx - ab, y: 0.08, z: cz, rot: -Math.PI / 2, color: '#1e1f22', w: hz * 2 - 6, h: 0.9 });
  s.props.push({ kind: 'adBoards', x: cx + hx + ab, y: 0.08, z: cz, rot: Math.PI / 2, color: '#1e1f22', w: hz * 2 - 6, h: 0.9 });
}

function classic(s: Site): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const team = rng.pick(TEAM);
  const team2 = rng.pick(TEAM2);
  // Pitch scaled to fit the lot behind a ~26 m entrance plaza.
  const avail = D - 30 - 4;
  const k = Math.min(1, (avail - 2 * 18 - 6) / 68, (W - 8 - 2 * 18 - 6) / 105);
  const pl = 105 * k;
  const pw = 68 * k;
  const zc = 30 + avail / 2;
  footballPitch(s, cx, zc, pl / 2, pw / 2);
  // Stands: long sides deeper / taller than the ends.
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
  const sbSide = rng.chance(0.5) ? -1 : 1;
  s.props.push({ kind: 'scoreboard', x: cx + sbSide * (pl / 2 + gap + ed * 0.7), y: eh + 7.15, z: zc, rot: sbSide < 0 ? -Math.PI / 2 : Math.PI / 2, color: '#1e1f22', w: Math.min(16, pw * 0.3) });
  const fx = pl / 2 + gap + ed * 0.7;
  const fz = pw / 2 + gap + sd * 0.7;
  const fh = sh + 22;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * fx;
    const z = zc + sz * fz;
    s.props.push({ kind: 'floodlight', x, y: 0.05, z, rot: facing(cx - x, zc - z), color: '#9aa0a6', h: fh });
  }
  s.height = fh + 4;
  frontage(s, cx, zc - pw / 2 - gap - sd - 1, team, team2);
}

function bowlStadium(s: Site, design: Exclude<StadiumDesign, 'classic'>): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const team = rng.pick(TEAM);
  const team2 = rng.pick(TEAM2);
  const plazaMin = 24;

  // What the bowl has to enclose (half sizes) and its shape.
  let hx = design === 'athletics' ? 65 : design === 'cricket' ? rng.range(60, 68) : 56.5;
  let hz = design === 'athletics' ? 37 : design === 'cricket' ? hx * rng.range(0.82, 0.92) : 38;
  const power = design === 'round' ? rng.range(2, 2.15) : design === 'cricket' ? 2 : design === 'domed' ? rng.range(2.3, 3) : design === 'athletics' ? 2.4 : rng.range(3, 4);
  let ax = hx;
  let az = hz;
  if (design === 'athletics') {
    // Fit the round-ended track outline, not its bounding box.
    az = hz * 1.06;
    ax = hx;
    for (let i = 0; i <= 16; i++) {
      const ph = (i / 16) * (Math.PI / 2);
      const x = hx - hz + hz * Math.cos(ph);
      const z = hz * Math.sin(ph);
      ax = Math.max(ax, (x + 0.5) / Math.pow(1 - Math.pow(Math.min(0.999, z / az), power), 1 / power));
    }
  } else if (design !== 'cricket') {
    // Smallest superellipse (aspect f on z) that contains the rectangle's corners.
    const f = design === 'round' ? rng.range(1.3, 1.45) : rng.range(1.1, 1.2);
    az = hz * f;
    ax = hx / Math.pow(1 - Math.pow(1 / f, power), 1 / power);
  }

  // Tiers.
  const twoTier = design !== 'cricket' && design !== 'athletics' && rng.chance(design === 'round' ? 0.4 : 0.55);
  const d1 = design === 'cricket' ? rng.range(7, 9) : rng.range(10, 14);
  const tiers: Bowl['tiers'] = [{ depth: d1, y0: 1.3, y1: 1.3 + d1 * (design === 'cricket' ? 0.38 : rng.range(0.42, 0.5)) }];
  if (twoTier) {
    const d2 = rng.range(7, 10);
    const y0 = tiers[0].y1 + rng.range(3, 4.5);
    tiers.push({ depth: d2, y0, y1: y0 + d2 * rng.range(0.55, 0.65) });
  }
  const depth = tiers.reduce((a, t) => a + t.depth, 0);

  // Fit the whole bowl (outer edge + floodlights) into the lot behind the plaza.
  const maxX = W / 2 - 4;
  const maxZ = (D - plazaMin - 4) / 2;
  const k = Math.min(1, (maxX - depth - 1) / ax, (maxZ - depth - 1) / az);
  ax *= k;
  az *= k;
  hx *= k;
  hz *= k;
  const cz = D - 4 - (az + depth + 1);

  // Roof.
  let roof: Bowl['roof'] = 'none';
  let roofArc: [number, number] | undefined;
  if (design === 'bowl') roof = rng.chance(0.7) ? 'canopy' : 'none';
  else if (design === 'round') roof = rng.chance(0.6) ? 'canopy' : 'none';
  else if (design === 'horseshoe') roof = 'canopy';
  else if (design === 'oculus') roof = 'oculus';
  else if (design === 'domed') roof = 'dome';
  else if (design === 'athletics') {
    roof = 'canopy';
    const side = rng.chance(0.5) ? Math.PI / 2 : Math.PI * 1.5;
    roofArc = [side - 0.85, side + 0.85];
  } else if (design === 'cricket' && rng.chance(0.6)) {
    roof = 'canopy';
    roofArc = [Math.PI * 1.5 - 0.5, Math.PI * 1.5 + 0.5];
  }
  const gap = design === 'horseshoe' ? { at: rng.pick([0, Math.PI]), width: rng.range(1.0, 1.5) } : design === 'cricket' ? { at: Math.PI / 2, width: rng.range(0.9, 1.3) } : undefined;
  const facadeStyle = design === 'domed' ? rng.pick<Bowl['facadeStyle']>(['glass', 'ribs']) : rng.pick<Bowl['facadeStyle']>(['plain', 'ribs', 'glass', 'bands']);
  const bowl: Bowl = {
    cx, cz, ax, az, power, tiers, roof, roofArc,
    roofRise: rng.range(4, 7),
    cover: design === 'oculus' ? rng.range(10, 20) : rng.range(1, 4),
    gap,
    seats: [team, design === 'cricket' ? '#f4f1ea' : team2],
    pattern: rng.pick<Bowl['pattern']>(['sections', 'rows', 'solid']),
    facade: jitter(rng.pick(['#e9e6df', '#c9c4b8', '#d9d4c7', '#5a5f66', '#f4f1ea', '#8f9aa3']), rng, 0.03),
    facadeStyle,
    roofColor: design === 'domed' ? rng.pick(['#dfe3e6', '#b5c4c9', '#c9ccd1', jitter(team, rng, 0.05)]) : rng.pick(['#e9e6df', '#dfe3e6', '#c9ccd1']),
    accent: team,
  };
  s.bowls.push(bowl);
  s.reserved.push({ x0: cx - ax - depth - 1.5, x1: cx + ax + depth + 1.5, z0: cz - az - depth - 1.5, z1: cz + az + depth + 1.5 });
  const top = bowlTop(bowl);
  const roofTop = roof === 'dome' ? top + bowl.roofRise + Math.min(ax, az) * 0.42 : roof === 'none' ? top + 1.2 : top + bowl.roofRise + 4.5;
  s.height = roofTop + 2;
  s.info.tiers = tiers.length;
  s.info.roof = roof;

  // Playing surface.
  if (design === 'athletics') {
    s.court('track', { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });
    const ri = hz - 7.2;
    footballPitch(s, cx, cz, hx - hz + ri * 0.78, ri * 0.6, false);
  } else if (design === 'cricket') {
    s.court('cricket', { x0: cx - ax, x1: cx + ax, z0: cz - az, z1: cz + az });
    s.props.push({ kind: 'sightScreen', x: cx + hx - 3, y: 0.05, z: cz, rot: Math.PI / 2, color: '#f4f1ea', w: 10, h: 5 });
    s.props.push({ kind: 'sightScreen', x: cx - hx + 3, y: 0.05, z: cz, rot: -Math.PI / 2, color: '#f4f1ea', w: 10, h: 5 });
  } else {
    footballPitch(s, cx, cz, hx - 4, hz - 4);
  }

  // Scoreboards and floodlights.
  const at = (t: number, sOff: number) => bowlPoint(bowl, t, sOff);
  if (design === 'horseshoe' && gap) {
    const [x, z] = at(gap.at, depth * 0.45);
    s.props.push({ kind: 'scoreboard', x, y: 0.05, z, rot: facing(cx - x, cz - z), color: '#1e1f22', w: Math.min(18, az * 0.45), h: 3 });
  } else if (roof === 'none' || design === 'cricket') {
    const t = rng.pick([0, Math.PI]);
    const [x, z] = at(t, depth + 2.5);
    s.props.push({ kind: 'scoreboard', x, y: 0.05, z, rot: facing(cx - x, cz - z), color: '#1e1f22', w: Math.min(14, az * 0.35), h: top + 1 });
  }
  if (roof === 'none' || design === 'cricket') {
    const n = design === 'cricket' ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const t = Math.PI / n + (i * Math.PI * 2) / n;
      if (gap && Math.abs(Math.atan2(Math.sin(t - gap.at), Math.cos(t - gap.at))) < gap.width / 2) continue;
      const [x, z] = at(t, depth + 2.5);
      s.props.push({ kind: 'floodlight', x, y: 0.05, z, rot: facing(cx - x, cz - z), color: '#9aa0a6', h: top + 20 });
    }
    s.height = Math.max(s.height ?? 0, top + 24);
  }

  // Cricket: pavilion with a veranda in the open end, grass banks with trees either side.
  if (design === 'cricket') {
    const pz0 = cz + az + 1.5;
    const pz1 = Math.min(D - 2, pz0 + 12);
    if (pz1 - pz0 > 7) {
      const pav = s.mass('main', { x0: cx - 14, x1: cx + 14, z0: pz0, z1: pz1 }, 2, 4.2, jitter('#f4f1ea', rng, 0.02), { type: 'hip', pitch: 0.45, color: rng.pick(['#2d4f3c', '#a0473a', '#3f5f7a']), parapet: false, overhang: 0.7 });
      s.windows(pav, { bay: 3, w: 1.6, h: 2.2, sill: 0.7, style: 'georgian', frame: '#2d4f3c', litChance: 0.6 });
      s.porches.push({ kind: 'arcade', rect: { x0: cx - 13, x1: cx + 13, z0: pz0 - 3.5, z1: pz0 }, floorY: 0.6, roofY: 3.8, stepX: cx, floorColor: '#cfc8bb', roofColor: '#f4f1ea', postColor: '#f4f1ea' });
      s.props.push({ kind: 'flagpole', x: cx, y: massTop(pav) + 2.5, z: (pz0 + pz1) / 2, rot: 0, color: team, color2: '#ffffff', h: 6 });
      s.props.push({ kind: 'clockTower', x: cx, y: massTop(pav), z: (pz0 + pz1) / 2, rot: 0, color: '#f4f1ea', color2: '#2d4f3c', h: 2.5 });
    }
    for (const sx of [-1, 1]) s.trees_({ x0: cx + sx * 18 - 6, x1: cx + sx * 18 + 6, z0: cz + az - 4, z1: D - 2 }, 3);
  }

  frontage(s, cx, cz - az - depth - 2, team, team2);
}
