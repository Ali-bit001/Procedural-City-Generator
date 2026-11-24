/**
 * Education:
 *   primary    -> low L-shaped classroom block in cheerful colours + playground (climbing frame, swings,
 *                 seesaw, slide on a soft surface) + small football pitch / court + school bus, bike rack
 *   highSchool -> 3-storey U-block around a courtyard + gym hall + running track around a football field
 *                 with bleachers and floodlights + basketball / tennis court + bus bay + staff parking
 *   university -> campus: admin hall with a clock tower facing the street, a quad with cross paths and a
 *                 fountain, lecture halls either side, library at the head of the quad, dorm slabs,
 *                 courts, parking and a stadium-style sports field with a track at the back
 */
import { massTop, type Mass, type Rect, type WindowStyle } from '../../spec';
import { Site, jitter } from './site';

const PLAY_COLORS = ['#e74c3c', '#f1c40f', '#2e86de', '#27ae60', '#e67e22', '#8e44ad'];

/** Playground on a soft surface: climbing frame, swings, seesaw, slide (needs 16 x 12). */
function playground(s: Site, x0: number, z0: number): void {
  const { rng } = s;
  s.court('playground', { x0, x1: x0 + 16, z0, z1: z0 + 12 });
  const c = () => rng.pick(PLAY_COLORS);
  s.props.push({ kind: 'climbingFrame', x: x0 + 3.5, y: 0.08, z: z0 + 7, rot: 0, color: c(), color2: c() });
  s.props.push({ kind: 'swing', x: x0 + 10, y: 0.08, z: z0 + 3.5, rot: 0, color: c(), color2: c() });
  s.props.push({ kind: 'seesaw', x: x0 + 10, y: 0.08, z: z0 + 9, rot: 0, color: c() });
  s.props.push({ kind: 'slide', x: x0 + 14.5, y: 0.08, z: z0 + 7, rot: 0, color: c(), color2: '#9aa0a6' });
  s.props.push({ kind: 'bench', x: x0 + 8, y: 0.05, z: z0 + 12.8, rot: Math.PI, color: '#6b4a33' });
}

/** Football pitch with goals sized to the rect. */
function pitch(s: Site, r: Rect): void {
  s.court('football', r);
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  const gw = Math.min(7.32, len * 0.09);
  const gh = gw < 6 ? 2 : 2.44;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  if (alongX) {
    s.props.push({ kind: 'goalPost', x: r.x0 + 1, y: 0.08, z: cz, rot: -Math.PI / 2, color: '#f4f1ea', w: gw, h: gh });
    s.props.push({ kind: 'goalPost', x: r.x1 - 1, y: 0.08, z: cz, rot: Math.PI / 2, color: '#f4f1ea', w: gw, h: gh });
  } else {
    s.props.push({ kind: 'goalPost', x: cx, y: 0.08, z: r.z0 + 1, rot: Math.PI, color: '#f4f1ea', w: gw, h: gh });
    s.props.push({ kind: 'goalPost', x: cx, y: 0.08, z: r.z1 - 1, rot: 0, color: '#f4f1ea', w: gw, h: gh });
  }
}

/** Basketball court (28 x 15 along x) with hoops. */
function basketball(s: Site, x0: number, z0: number): void {
  s.court('basketball', { x0, x1: x0 + 28, z0, z1: z0 + 15 });
  s.props.push({ kind: 'basketballHoop', x: x0 + 0.5, y: 0.08, z: z0 + 7.5, rot: -Math.PI / 2, color: '#9aa0a6' });
  s.props.push({ kind: 'basketballHoop', x: x0 + 27.5, y: 0.08, z: z0 + 7.5, rot: Math.PI / 2, color: '#9aa0a6' });
}

/** Running track (92 x 58) around a football field, with bleachers on the street side and floodlights. */
function sportsGround(s: Site, cx: number, z0: number, lights: boolean): void {
  const r = { x0: cx - 46, x1: cx + 46, z0, z1: z0 + 58 };
  s.court('track', r);
  pitch(s, { x0: cx - 27, x1: cx + 27, z0: z0 + 11, z1: z0 + 47 });
  s.props.push({ kind: 'bleachers', x: cx, y: 0.05, z: z0 - 2.4, rot: Math.PI, color: s.rng.pick(['#1f6fb5', '#c0392b', '#27ae60']), w: 24, h: 5 });
  s.reserved.push({ x0: cx - 12.5, x1: cx + 12.5, z0: z0 - 5, z1: z0 });
  if (!lights) return;
  for (const [x, z] of [[cx - 47, z0 + 2], [cx + 47, z0 + 2], [cx - 47, z0 + 56], [cx + 47, z0 + 56]]) {
    s.props.push({ kind: 'floodlight', x, y: 0.05, z, rot: Math.atan2(-(cx - x), -(z0 + 29 - z)), color: '#9aa0a6', h: 18 });
  }
  s.height = Math.max(s.height ?? 0, 22);
}

function schoolWindows(s: Site, m: Mass, style: WindowStyle, frame: string): void {
  s.windows(m, { bay: 3.2, w: 2.4, h: 1.5, sill: 0.8, style, frame, litChance: 0.35 });
}

export function primarySchool(s: Site): void {
  const { rng, W, D } = s;
  const wall = jitter(rng.pick(['#f3e3c3', '#f6d8c0', '#e9efd9', '#f7ecd0', '#e4eef4']), rng, 0.03);
  const accent = rng.pick(PLAY_COLORS);
  const pitched = rng.chance(0.5);
  const roof = pitched ? { type: 'hip' as const, pitch: 0.45, color: rng.pick(['#a0473a', '#6b6e72', '#3f5f7a']), parapet: false, overhang: 0.5 } : {};
  const floors = rng.int(1, 2);
  const ax1 = Math.min(W * 0.66, 54);
  const A = s.mass('main', { x0: 6, x1: ax1, z0: 12, z1: 23 }, floors, 3.5, wall, { ...roof, axis: 'x' });
  const B = s.mass('wing', { x0: 6, x1: 18, z0: 23, z1: Math.min(D * 0.7, 48) }, floors, 3.5, jitter(wall, rng, 0.02), { ...roof, axis: 'z' });
  for (const m of [A, B]) schoolWindows(s, m, 'casement', accent);
  const doorT = 0.3;
  const doorX = A.rect.x0 + (A.rect.x1 - A.rect.x0) * doorT;
  s.opening(A, 'front', doorT, 'door', 2.4, 2.6, accent);
  s.porches.push({ kind: 'arcade', rect: { x0: doorX - 3, x1: doorX + 3, z0: 9.5, z1: 12 }, floorY: 0, roofY: 2.9, stepX: doorX, floorColor: s.pavingColor, roofColor: accent, postColor: '#f4f1ea' });
  s.lights.push({ kind: 'ceiling', x: doorX, y: 2.88, z: 10.8, rot: 0 });
  s.sign(A, 'front', 0.65, 2.75, Math.min(9, (ax1 - 6) * 0.35), 0.75, accent);
  s.paths.push({ x0: doorX - 1.5, x1: doorX + 1.5, z0: 0, z1: 9.5 });

  // Playground in the crook of the L, a pitch or court beyond it.
  const px0 = 21;
  const pz0 = 27;
  if (pz0 + 12 < D - 3) playground(s, px0, pz0);
  const fx0 = px0 + 19;
  const fr = { x0: fx0, x1: W - 4, z0: 27, z1: D - 4 };
  const fw = fr.x1 - fr.x0;
  const fd = fr.z1 - fr.z0;
  if (fw >= 24 && fd >= 16) pitch(s, { x0: fx0, x1: fx0 + Math.min(40, fw), z0: fr.z0, z1: fr.z0 + Math.min(26, fd) });
  else if (fw >= 28 && fd >= 15) basketball(s, fx0, fr.z0);

  // School bus bay.
  const bx0 = ax1 + 2;
  if (W - 3 - bx0 >= 13) {
    s.driveways.push({ x0: bx0, x1: W - 3, z0: 0, z1: 10 });
    s.props.push({ kind: 'bus', x: (bx0 + W - 3) / 2, y: 0.05, z: 5.5, rot: Math.PI / 2, color: '#f2b705', d: 11 });
  }
  s.props.push({ kind: 'bikeRack', x: doorX + 5, y: 0.05, z: 8, rot: 0, color: '#9aa0a6', w: 4 });
  s.props.push({ kind: 'flagpole', x: doorX - 5.5, y: 0.05, z: 6, rot: 0, color: '#01411c', color2: '#ffffff', h: 8 });
  s.props.push({ kind: 'bins', x: 4, y: 0.05, z: D - 3, rot: 0, color: '#2e6b4a', color2: '#1f3f73' });
  for (let i = 0; i < 2; i++) s.props.push({ kind: 'acUnit', x: 9 + i * 2.5, y: massTop(B) + (pitched ? 0 : 0), z: B.rect.z1 + 1.2, rot: 0, color: '#c9ccd1' });
  const gates: [number, number][] = [[doorX - 2, doorX + 2]];
  if (W - 3 - bx0 >= 13) gates.push([bx0, W - 3]);
  // Link the wing, playground and pitch to the paths.
  s.opening(B, 'right', 0.6, 'door', 2, 2.4, accent);
  if (pz0 + 12 < D - 3) s.target(px0 - 1.6, pz0 + 6);
  s.target(fx0 - 1.6, fr.z0 + 3);
  s.linkPaths(2.2);
  s.fence('iron', '#2f3a33', 1.6, gates);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, Math.round((W * D) / 380));
}

export function highSchool(s: Site): void {
  const { rng, W, D } = s;
  const brick = rng.chance(0.55);
  const wall = brick ? jitter(rng.pick(['#9c5a45', '#a86a50', '#8b4a3a']), rng, 0.03) : jitter(rng.pick(['#e2d6bf', '#d9d4c7', '#e9e1cf']), rng, 0.03);
  const frame = brick ? '#e9e1cf' : rng.pick(['#2f6db5', '#2e8b57', '#a0473a']);
  const team = rng.pick(['#1f6fb5', '#c0392b', '#27ae60', '#e67e22', '#5b2c83']);
  const A = s.mass('main', { x0: 6, x1: 62, z0: 12, z1: 26 }, 3, 3.6, wall);
  const B = s.mass('wing', { x0: 6, x1: 18, z0: 26, z1: 48 }, 3, 3.6, wall);
  const C = s.mass('wing', { x0: 50, x1: 62, z0: 26, z1: 48 }, 3, 3.6, wall);
  for (const m of [A, B, C]) schoolWindows(s, m, brick ? 'georgian' : 'plain', frame);
  const gym = s.mass('wing', { x0: 66, x1: W - 40, z0: 10, z1: 32 }, 1, 9, jitter(brick ? '#d9d4c7' : '#c9ccd1', rng, 0.03), { color: '#7a7f86' });
  s.windows(gym, { bay: 5, w: 3.8, h: 1.4, sill: 6.4, style: 'ribbon', frame: '#3a3d40', litChance: 0.4, noSill: true });
  s.opening(gym, 'front', 0.5, 'door', 3, 2.8, team);
  s.sign(gym, 'front', 0.5, 3.6, Math.min(12, gym.rect.x1 - gym.rect.x0 - 4), 1.0, team);
  s.opening(A, 'front', 0.5, 'door', 3.2, 2.8, frame);
  s.porches.push({ kind: 'arcade', rect: { x0: 29, x1: 39, z0: 8.5, z1: 12 }, floorY: 0, roofY: 3.3, stepX: 34, floorColor: s.pavingColor, roofColor: wall, postColor: '#e9e1cf' });
  s.lights.push({ kind: 'ceiling', x: 34, y: 3.28, z: 10.2, rot: 0 });
  s.sign(A, 'front', 0.5, 3.7, 12, 0.8, team);
  s.paths.push({ x0: 32.5, x1: 35.5, z0: 0, z1: 8.5 });
  for (const m of [A, B, C, gym]) for (let i = 0; i < rng.int(1, 3); i++) s.props.push({ kind: 'acUnit', x: m.rect.x0 + 3 + i * 2.6, y: massTop(m), z: m.rect.z1 - 2.5, rot: 0, color: '#c9ccd1' });

  // Courtyard between the arms: paved centre, benches, trees.
  s.paths.push({ x0: 22, x1: 46, z0: 32, z1: 42 });
  for (const x of [25, 34, 43]) s.props.push({ kind: 'picnicTable', x, y: 0.05, z: 37, rot: 0, color: '#8a6a4a' });

  // Bus drop-off, parking, flags.
  s.driveways.push({ x0: 6, x1: 31, z0: 0, z1: 10 });
  for (const x of [13, 25]) if (rng.chance(0.8)) s.props.push({ kind: 'bus', x, y: 0.05, z: 5.5, rot: Math.PI / 2, color: '#f2b705', d: 11 });
  s.parking({ x0: W - 36, x1: W - 4, z0: 2, z1: 34 });
  s.flags(49, 6, 2);
  s.props.push({ kind: 'bikeRack', x: 42, y: 0.05, z: 9, rot: 0, color: '#9aa0a6', w: 6 });

  // Court + sports ground.
  if (rng.chance(0.5)) basketball(s, 66, 35);
  else {
    s.court('tennis', { x0: 66, x1: 90, z0: 36, z1: 48 });
    s.fences.push({ kind: 'iron', color: '#2f5f3a', height: 3, segments: [{ x0: 66, z0: 36, x1: 90, z1: 36 }, { x0: 66, z0: 48, x1: 90, z1: 48 }, { x0: 66, z0: 36, x1: 66, z1: 48 }, { x0: 90, z0: 36, x1: 90, z1: 48 }] });
  }
  sportsGround(s, W / 2, D - 62, rng.chance(0.6));

  // Courtyard doors in the arms, and walks out to the courts and the sports ground.
  s.opening(B, 'right', 0.5, 'door', 2, 2.5, frame);
  s.opening(C, 'left', 0.5, 'door', 2, 2.5, frame);
  s.target(80, 51.5);
  s.target(W / 2 + 15, D - 63.5);
  s.linkPaths(2.2);
  s.fence('iron', '#2f3a33', 2, [[6, 31], [32, 36], [W - 36, W - 4]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, Math.round((W * D) / 520));
}

export function university(s: Site): void {
  const { rng, W, D } = s;
  const cx = W / 2;
  const brick = rng.chance(0.5);
  const wall = brick ? jitter(rng.pick(['#9c5a45', '#b07a5a', '#8b4a3a']), rng, 0.03) : jitter(rng.pick(['#d9cfbd', '#e2d6bf', '#c9b99a']), rng, 0.03);
  const stone = jitter('#dcd3c2', rng, 0.03);
  const frame = brick ? '#efe6d4' : '#4a4f55';
  const style: WindowStyle = brick ? 'casement' : 'georgian';
  const roofPitched = rng.chance(0.4) ? { type: 'hip' as const, pitch: 0.35, color: rng.pick(['#5a6670', '#6b4a3a']), parapet: false, overhang: 0.3 } : {};
  const uniColor = rng.pick(['#7a1f2b', '#1f3f73', '#2d4f3c', '#5b2c83']);

  // Admin hall with clock tower, facing the street.
  const admin = s.mass('main', { x0: cx - 24, x1: cx + 24, z0: 14, z1: 30 }, 3, 4, stone, { ...roofPitched, axis: 'x' });
  s.windows(admin, { bay: 3.4, w: 1.8, h: 2.2, sill: 0.8, style: 'georgian', frame: '#4a4f55', litChance: 0.4 });
  s.opening(admin, 'front', 0.5, 'door', 3, 3.2, '#5a3a28');
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 8, x1: cx + 8, z0: 9, z1: 14 }, floorY: 0.3, roofY: 6.5, stepX: cx, floorColor: stone, roofColor: stone, postColor: '#f2eee6' });
  s.sign(admin, 'front', 0.5, 8.4, 14, 1.1, uniColor);
  s.props.push({ kind: 'clockTower', x: cx, y: massTop(admin), z: 22, rot: 0, color: stone, color2: uniColor, h: 14 });
  s.height = massTop(admin) + 20;
  s.paths.push({ x0: cx - 2, x1: cx + 2, z0: 0, z1: 9 });
  s.flags(cx - 15, 7, 3);

  // Quad: lawn, perimeter + cross paths, fountain plaza.
  const qx0 = cx - 26;
  const qx1 = cx + 26;
  const qz0 = 36;
  const qz1 = 96;
  s.paths.push({ x0: cx - 1.5, x1: cx + 1.5, z0: 30, z1: 98 });
  s.paths.push({ x0: qx0, x1: qx1, z0: 64.5, z1: 67.5 });
  s.paths.push({ x0: qx0, x1: qx1, z0: qz0, z1: qz0 + 2.4 }, { x0: qx0, x1: qx1, z0: qz1 - 2.4, z1: qz1 });
  s.paths.push({ x0: qx0, x1: qx0 + 2.4, z0: qz0, z1: qz1 }, { x0: qx1 - 2.4, x1: qx1, z0: qz0, z1: qz1 });
  s.paths.push({ x0: cx - 7, x1: cx + 7, z0: 59, z1: 73 });
  s.props.push({ kind: 'fountain', x: cx, y: 0.05, z: 66, rot: 0, color: stone, w: 3.5 });
  s.animated.push({ kind: 'spray', x: cx, y: 1.95, z: 66, height: 2.6, radius: 2.4 });
  s.furnishPath({ x0: qx0 + 2.4, x1: cx - 7, z0: 64.5, z1: 67.5 }, 9);
  s.furnishPath({ x0: cx + 7, x1: qx1 - 2.4, z0: 64.5, z1: 67.5 }, 9);
  s.furnishPath({ x0: cx - 1.5, x1: cx + 1.5, z0: 73, z1: 96 }, 10);

  // Lecture halls either side of the quad, doors onto it.
  const halls: Mass[] = [];
  const hall = (r: Rect, side: 'left' | 'right') => {
    const m = s.mass('wing', r, rng.int(3, 4), 3.8, jitter(wall, rng, 0.03), { ...roofPitched, axis: 'z' });
    s.windows(m, { bay: 3.2, w: 2.0, h: 2.0, sill: 0.9, style, frame, litChance: 0.45 });
    s.opening(m, side, 0.5, 'door', 2.6, 2.8, '#5a3a28');
    halls.push(m);
    const doorZ = (r.z0 + r.z1) / 2;
    const dx = side === 'right' ? r.x1 : r.x0;
    s.paths.push(side === 'right' ? { x0: dx, x1: qx0, z0: doorZ - 1.2, z1: doorZ + 1.2 } : { x0: qx1, x1: dx, z0: doorZ - 1.2, z1: doorZ + 1.2 });
    s.props.push({ kind: 'bikeRack', x: side === 'right' ? dx + 2.2 : dx - 2.2, y: 0.05, z: doorZ + 4, rot: Math.PI / 2, color: '#9aa0a6', w: 4 });
  };
  hall({ x0: cx - 46, x1: cx - 28, z0: qz0, z1: 62 }, 'right');
  hall({ x0: cx - 46, x1: cx - 28, z0: 68, z1: qz1 }, 'right');
  if (rng.chance(0.5)) hall({ x0: cx + 28, x1: cx + 46, z0: qz0, z1: qz1 }, 'left');
  else {
    hall({ x0: cx + 28, x1: cx + 46, z0: qz0, z1: 62 }, 'left');
    hall({ x0: cx + 28, x1: cx + 46, z0: 68, z1: qz1 }, 'left');
  }

  // Library at the head of the quad, columned portico.
  const lib = s.mass('main', { x0: cx - 22, x1: cx + 22, z0: 104, z1: 122 }, 3, 4.5, stone);
  s.windows(lib, { bay: 3.6, w: 2.0, h: 3.0, sill: 0.8, style: 'georgian', frame: '#4a4f55', litChance: 0.6 });
  s.opening(lib, 'front', 0.5, 'door', 3.4, 3.4, '#5a3a28');
  s.porches.push({ kind: 'arcade', rect: { x0: cx - 10, x1: cx + 10, z0: 98, z1: 104 }, floorY: 0.4, roofY: 8, stepX: cx, floorColor: stone, roofColor: stone, postColor: '#f2eee6' });
  s.sign(lib, 'front', 0.5, 9.6, 12, 1.0, uniColor);

  // Dorms, parking, courts.
  const dormWall = jitter(rng.pick(['#e9e1cf', '#c9b99a', '#d9d4c7', '#b5c4c9']), rng, 0.03);
  const dorm = (r: Rect) => {
    const m = s.mass('main', r, rng.int(5, 7), 3.0, dormWall);
    s.windows(m, { bay: 2.8, w: 1.4, h: 1.4, sill: 0.9, style: 'plain', frame: '#5a5f66', litChance: 0.55 });
    s.opening(m, 'front', 0.5, 'door', 2, 2.5, '#3a3d40');
    for (let i = 0; i < 3; i++) s.props.push({ kind: 'acUnit', x: r.x0 + 3 + i * 2.5, y: massTop(m), z: r.z1 - 3, rot: 0, color: '#c9ccd1' });
  };
  const lc1 = cx - 50;
  const rc0 = cx + 50;
  s.parking({ x0: 6, x1: lc1, z0: 4, z1: 60 });
  dorm({ x0: 10, x1: 28, z0: 66, z1: 120 });
  if (lc1 - 32 >= 14) dorm({ x0: 32, x1: lc1, z0: 74, z1: 120 });
  basketball(s, rc0 + 2, 8);
  s.court('tennis', { x0: rc0 + 2, x1: rc0 + 26, z0: 27, z1: 39 });
  dorm({ x0: rc0 + 6, x1: rc0 + 24, z0: 46, z1: 120 });
  if (W - 6 - (rc0 + 28) >= 14) dorm({ x0: rc0 + 28, x1: W - 6, z0: 54, z1: 120 });

  // Campus bus stop at the front.
  s.driveways.push({ x0: cx + 10, x1: cx + 40, z0: 0, z1: 11 });
  s.props.push({ kind: 'bus', x: cx + 25, y: 0.05, z: 5.5, rot: Math.PI / 2, color: uniColor, color2: '#f4f1ea', d: 11 });

  sportsGround(s, cx, D - 62, true);
  // Walks from every dorm, the courts and the sports ground into the campus network.
  s.target(rc0 + 14, 25);
  s.target(cx + 15, D - 63.5);
  s.target(cx - 15, D - 63.5);
  s.linkPaths(2.4);
  s.fence('hedge', '#4d7a3a', 1.3, [[cx - 3, cx + 3], [cx + 10, cx + 40], [6, lc1]]);
  s.trees_({ x0: qx0, x1: qx1, z0: qz0, z1: qz1 }, 16, [['round', 3], ['cone', 1]]);
  s.trees_({ x0: 0, x1: W, z0: 0, z1: D }, Math.round((W * D) / 700));
}
