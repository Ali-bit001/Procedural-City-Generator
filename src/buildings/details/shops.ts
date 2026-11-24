/**
 * Shop types: every shopfront (strip malls, bazaars, mid-rise ground floors) is a specific kind of shop
 * with its own signs, awning habits and street furniture in front of it.
 *
 *   café        -> tables + chairs (+ umbrellas when not under a roof), menu board, planters
 *   restaurant  -> more seating, festoon string lights
 *   grocery     -> tiered produce crates either side of the door
 *   florist     -> flower stands
 *   pharmacy    -> glowing green cross on the wall
 *   bakery      -> menu board, bench
 *   barber      -> barber pole by the door
 *   bank        -> ATM in the wall
 *   clothing    -> clothes rails outside (South Asia) / planters (west)
 *   hardware    -> goods stacked out front
 *   mobile      -> bright signs, menu board
 *   tea stall   -> plastic tables and chairs (South Asia)
 *   bike shop   -> motorbikes lined up outside
 */
import type { RNG } from '../../core/rng';
import type { Light, Prop } from '../spec';

export type ShopKind =
  | 'cafe'
  | 'restaurant'
  | 'grocery'
  | 'florist'
  | 'pharmacy'
  | 'bakery'
  | 'barber'
  | 'bank'
  | 'clothing'
  | 'hardware'
  | 'mobile'
  | 'teaStall'
  | 'bikeShop'
  | 'generic';

export type StreetRegion = 'west' | 'sa';

interface ShopDef {
  label: string;
  /** Relative frequency on western / South Asian streets. */
  west: number;
  sa: number;
  signs: string[];
  awning: number;
  awnings: string[];
  /** Chance of a roller shutter instead of glazing (South Asian streets). */
  shutter: number;
}

const ANY_SIGN = ['#c0392b', '#1f6fb5', '#27ae60', '#f1c40f', '#ffffff', '#e67e22', '#8e44ad', '#16a085', '#2c3e50', '#e84393'];

export const SHOPS: Record<ShopKind, ShopDef> = {
  cafe: { label: 'café', west: 14, sa: 6, signs: ['#6b4a33', '#2f4a3a', '#f4f1ea', '#1f3b2f'], awning: 0.7, awnings: ['#2e6b4a', '#6b2e2a', '#2b2b2b', '#c9772b'], shutter: 0.1 },
  restaurant: { label: 'restaurant', west: 10, sa: 10, signs: ['#c0392b', '#2b2b2b', '#d35400', '#f1c40f'], awning: 0.5, awnings: ['#8e1c1c', '#2b2b2b'], shutter: 0.2 },
  grocery: { label: 'grocery', west: 8, sa: 14, signs: ['#27ae60', '#f39c12', '#ffffff'], awning: 0.6, awnings: ['#27ae60', '#f39c12', '#2e6b4a'], shutter: 0.5 },
  florist: { label: 'florist', west: 5, sa: 2, signs: ['#ff8fab', '#f4f1ea', '#9b59b6'], awning: 0.6, awnings: ['#ff8fab', '#2e6b4a'], shutter: 0 },
  pharmacy: { label: 'pharmacy', west: 7, sa: 8, signs: ['#27ae60', '#ffffff'], awning: 0.1, awnings: ['#27ae60'], shutter: 0.3 },
  bakery: { label: 'bakery', west: 7, sa: 6, signs: ['#c9a648', '#6b4a33', '#f4f1ea'], awning: 0.8, awnings: ['#c9772b', '#8e1c1c', '#f4f1ea'], shutter: 0.2 },
  barber: { label: 'barber', west: 5, sa: 6, signs: ['#1f3f73', '#2b2b2b', '#c0392b'], awning: 0.2, awnings: ['#1f3f73'], shutter: 0.4 },
  bank: { label: 'bank', west: 6, sa: 5, signs: ['#1f3f73', '#16a085', '#2c3e50'], awning: 0, awnings: ['#1f3f73'], shutter: 0 },
  clothing: { label: 'clothing', west: 10, sa: 12, signs: ['#2b2b2b', '#e84393', '#8e44ad', '#ffffff'], awning: 0.3, awnings: ['#2b2b2b', '#e84393'], shutter: 0.6 },
  hardware: { label: 'hardware', west: 4, sa: 8, signs: ['#f39c12', '#c0392b', '#1f6fb5'], awning: 0.2, awnings: ['#1f6fb5'], shutter: 0.8 },
  mobile: { label: 'mobile shop', west: 4, sa: 12, signs: ['#1f6fb5', '#e84393', '#f1c40f', '#16a085'], awning: 0.1, awnings: ['#1f6fb5'], shutter: 0.6 },
  teaStall: { label: 'tea stall', west: 0, sa: 8, signs: ['#c0392b', '#27ae60', '#f1c40f'], awning: 0.5, awnings: ['#1f3f73', '#c0392b'], shutter: 0.4 },
  bikeShop: { label: 'motorbike shop', west: 2, sa: 7, signs: ['#c0392b', '#2b2b2b', '#1f6fb5'], awning: 0.2, awnings: ['#2b2b2b'], shutter: 0.7 },
  generic: { label: 'shop', west: 10, sa: 8, signs: ANY_SIGN, awning: 0.3, awnings: ['#c0392b', '#1f3f73', '#2e6b4a', '#f39c12'], shutter: 0.6 },
};

export function pickShop(rng: RNG, region: StreetRegion): ShopKind {
  return rng.weighted((Object.keys(SHOPS) as ShopKind[]).map((k) => [k, SHOPS[k][region]] as [ShopKind, number]));
}

/** Everything needed to dress one shop's frontage (street at -z). */
export interface Frontage {
  rng: RNG;
  props: Prop[];
  lights: Light[];
  /** Shop centre x and the z of its front wall. */
  cx: number;
  z: number;
  width: number;
  /** Free depth in front of the wall (towards -z) that belongs to this shop. */
  depth: number;
  /** Covered by a walkway / projecting floor (no umbrellas, no string lights). */
  roofed: boolean;
  region: StreetRegion;
  /** Floor level at the door and the top of the shopfront (for wall-mounted signs). */
  floorY: number;
  shopTop: number;
}

const CHAIRS = ['#2b2b2b', '#6b4a33', '#c9ccd1', '#2e6b4a'];

/** Put the shop's street furniture in front of it. */
export function dressShopFront(kind: ShopKind, f: Frontage): void {
  const { rng, props } = f;
  const def = SHOPS[kind];
  const half = f.width / 2;
  const at = (k: Prop['kind'], x: number, zOff: number, extra: Partial<Prop> = {}) =>
    props.push({ kind: k, x, y: 0.05, z: f.z - zOff, rot: 0, color: '#888888', ...extra });
  const onWall = (k: Prop['kind'], x: number, y: number, color: string) => props.push({ kind: k, x, y, z: f.z, rot: 0, color });
  const board = () => {
    if (f.depth >= 0.8) at('aBoard', f.cx + half - 0.45, 0.45, { color: rng.pick(['#2b2b2b', '#1f3b2f', '#6b4a33']) });
  };

  switch (kind) {
    case 'cafe':
    case 'restaurant': {
      const rowDepth = 1.9;
      const rows = kind === 'restaurant' && f.depth >= rowDepth * 2 + 0.4 ? 2 : f.depth >= 2.0 ? 1 : 0;
      const umbrella = !f.roofed && rng.chance(0.6) ? 1 : 0;
      const umbrellaColor = rng.pick(def.awnings);
      const chairColor = rng.pick(CHAIRS);
      const n = Math.floor((f.width - 0.4) / 2.1);
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < n; i++) {
          const x = f.cx - ((n - 1) * 2.1) / 2 + i * 2.1;
          at('cafeTable', x, 1.15 + r * rowDepth, { color: umbrellaColor, color2: chairColor, w: rng.pick([2, 3, 4]), h: umbrella });
        }
      }
      if (rows === 0) board();
      if (rows && kind === 'restaurant' && !f.roofed) at('stringLights', f.cx, Math.min(f.depth - 0.3, 1.2 + rows * rowDepth - 0.6), { w: f.width - 0.4, h: 2.9 });
      if (rows && !f.roofed && f.depth >= 2.8 && f.width >= 4) {
        at('planter', f.cx - half + 0.55, f.depth - 0.35, { color: '#5a5f66', w: 0.9 });
        at('planter', f.cx + half - 0.55, f.depth - 0.35, { color: '#5a5f66', w: 0.9 });
      }
      break;
    }
    case 'grocery': {
      if (f.depth < 0.9) break;
      const both = f.width >= 3.8;
      at('produceDisplay', f.cx - half + 0.85, 0.55, { w: 1.4 });
      if (both) at('produceDisplay', f.cx + half - 0.85, 0.55, { w: 1.4 });
      // A stall only where it fits behind the crates (crates reach 1.0 m out, the stall is 2 m deep).
      if (f.region === 'sa' && f.depth >= 3.2 && rng.chance(0.5)) at('stall', f.cx, f.depth - 1.0, { color: rng.pick(['#2f5b8a', '#c0392b', '#27ae60', '#f39c12']) });
      break;
    }
    case 'florist': {
      if (f.depth < 0.9) break;
      at('flowerRack', f.cx - half + 0.85, 0.5);
      if (f.width >= 3.8) at('flowerRack', f.cx + half - 0.85, 0.5);
      break;
    }
    case 'pharmacy':
      onWall('crossSign', f.cx + half - 0.45, f.shopTop + 0.7, '#27ae60');
      break;
    case 'bakery':
      board();
      if (f.depth >= 1.3 && f.width >= 3.5) at('bench', f.cx - half + 1.0, 0.6, { color: '#6b4a33' });
      break;
    case 'barber':
      onWall('barberPole', f.cx + half - 0.25, f.floorY + 1.1, '#ffffff');
      board();
      break;
    case 'bank':
      onWall('atm', f.cx - half + 0.55, f.floorY, '#1f3f73');
      break;
    case 'clothing':
      if (f.region === 'sa') {
        if (f.depth >= 0.9) at('clothesRack', f.cx - half + 0.85, 0.5, { w: 1.4 });
        if (f.depth >= 0.9 && f.width >= 3.8) at('clothesRack', f.cx + half - 0.85, 0.5, { w: 1.4 });
      } else if (!f.roofed && f.depth >= 0.8) {
        at('planter', f.cx + half - 0.6, 0.4, { color: '#2b2b2b', w: 0.9 });
      }
      break;
    case 'hardware':
      if (f.depth >= 0.9) at('produceDisplay', f.cx - half + 0.85, 0.55, { w: 1.4, color2: '#c0392b' });
      break;
    case 'mobile':
      board();
      break;
    case 'teaStall': {
      if (f.depth < 1.8) break;
      // As many 2 m table+chair sets as fit inside this shop's own frontage.
      const n = Math.floor((f.width - 1.9) / 2.0) + 1;
      if (n < 1) break;
      const plastic = rng.pick(['#f4f1ea', '#c0392b', '#1f6fb5', '#27ae60']);
      for (let i = 0; i < n; i++) at('cafeTable', f.cx - ((n - 1) * 2.0) / 2 + i * 2.0, 1.05, { color: plastic, color2: plastic, w: rng.pick([3, 4]), h: 0 });
      break;
    }
    case 'bikeShop': {
      if (f.depth < 1.6) break;
      for (let x = f.cx - half + 0.6; x <= f.cx + half - 0.5; x += 0.95) {
        at('motorbike', x, 1.0, { rot: rng.range(-0.25, 0.25), color: rng.pick(['#c0392b', '#2b2b2b', '#1f6fb5', '#9aa0a6']) });
      }
      break;
    }
    case 'generic':
      break;
  }

  // A bit of general street life.
  const busy = kind === 'cafe' || kind === 'restaurant' || kind === 'teaStall' || kind === 'bikeShop' || kind === 'grocery';
  // Parked sideways, so keep it 1 m clear of the frontage edges.
  if (f.region === 'sa' && !busy && f.depth >= 2.2 && half >= 1.1 && rng.chance(0.35)) {
    at('motorbike', f.cx + rng.range(-half + 1.0, half - 1.0), f.depth - 0.9, { rot: Math.PI / 2 + rng.range(-0.3, 0.3), color: rng.pick(['#c0392b', '#2b2b2b', '#1f6fb5', '#9aa0a6']) });
  }
}
