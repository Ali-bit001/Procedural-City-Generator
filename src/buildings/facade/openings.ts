/**
 * Shared facade grammar: Wall -> Floors -> Bays -> Opening.
 * Handles visibility so windows are never placed on hidden or shared walls.
 */
import type { RNG } from '../../core/rng';
import { massTop, roofRise, type Mass, type Opening, type Rect, type WallSide } from '../spec';

export interface Wall {
  side: WallSide;
  nx: number;
  nz: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  length: number;
}

export function wallsOf(r: Rect): Wall[] {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  return [
    { side: 'front', nx: 0, nz: -1, ax: r.x0, az: r.z0, bx: r.x1, bz: r.z0, length: w },
    { side: 'back', nx: 0, nz: 1, ax: r.x0, az: r.z1, bx: r.x1, bz: r.z1, length: w },
    { side: 'left', nx: -1, nz: 0, ax: r.x0, az: r.z0, bx: r.x0, bz: r.z1, length: d },
    { side: 'right', nx: 1, nz: 0, ax: r.x1, az: r.z0, bx: r.x1, bz: r.z1, length: d },
  ];
}

export const wallOf = (r: Rect, side: WallSide): Wall => wallsOf(r).find((w) => w.side === side)!;

export function inside(r: Rect, x: number, z: number, pad = 0): boolean {
  return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
}

export interface WindowParams {
  /** Number of bays; defaults to floor(length / bay). */
  n?: number;
  bay: number;
  w: number;
  h: number;
  sill: number;
  floors?: number[];
  color?: string;
  frame: string;
  mullions: boolean;
  shutter?: string;
  litChance: number;
}

export class OpeningPlacer {
  readonly openings: Opening[] = [];

  constructor(
    private readonly masses: Mass[],
    private readonly rng: RNG,
  ) {}

  /** Point is outside this wall but inside another mass (or its roof). */
  private occluded(px: number, py: number, pz: number, selfId: number): boolean {
    for (const m of this.masses) {
      if (m.id === selfId) continue;
      if (inside(m.rect, px, pz, 0.01) && py >= m.baseY - 0.5 && py <= massTop(m) + roofRise(m)) return true;
    }
    return false;
  }

  /**
   * Flush walls: when two masses share a wall plane, the point just *inside* this wall lies inside
   * the other mass too. The lower-id mass owns that stretch of facade; the other skips it.
   */
  private ownedByEarlier(px: number, py: number, pz: number, selfId: number): boolean {
    for (const m of this.masses) {
      if (m.id >= selfId) continue;
      const r = m.rect;
      if (px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1 && py >= m.baseY && py <= massTop(m)) return true;
    }
    return false;
  }

  /** `extra` widens the tested span to cover frames/shutters. */
  visible(wl: Wall, cx: number, cz: number, w: number, y: number, selfId: number, extra = 0.4): boolean {
    const tx = (wl.bx - wl.ax) / wl.length;
    const tz = (wl.bz - wl.az) / wl.length;
    const span = w + extra;
    for (const s of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const px = cx + tx * span * s;
      const pz = cz + tz * span * s;
      if (this.occluded(px + wl.nx * 0.3, y, pz + wl.nz * 0.3, selfId)) return false;
      if (this.ownedByEarlier(px - wl.nx * 0.1, y, pz - wl.nz * 0.1, selfId)) return false;
    }
    return true;
  }

  add(o: Opening): Opening {
    this.openings.push(o);
    return o;
  }

  /** Evenly spaced windows along a wall, for each requested floor. */
  wallWindows(m: Mass, wl: Wall, p: WindowParams): Opening[] {
    const out: Opening[] = [];
    if (wl.length < 0.6) return out;
    const n = p.n ?? Math.max(1, Math.floor(wl.length / p.bay));
    const w = Math.min(p.w, wl.length / n - 0.6);
    if (w < 0.3) return out;
    const floors = p.floors ?? Array.from({ length: m.floors }, (_, i) => i);
    const extra = 0.4 + (p.shutter ? 1.0 : 0);
    for (const f of floors) {
      const floorY = m.baseY + f * m.floorHeight;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const cx = wl.ax + (wl.bx - wl.ax) * t;
        const cz = wl.az + (wl.bz - wl.az) * t;
        if (!this.visible(wl, cx, cz, w, floorY + p.sill + p.h / 2, m.id, extra)) continue;
        out.push(
          this.add({
            kind: 'window', massId: m.id, wall: wl.side, floor: f, cx, cz, nx: wl.nx, nz: wl.nz,
            width: w, y0: floorY + p.sill, height: p.h, color: p.color ?? '#2b3a48', frameColor: p.frame,
            mullions: p.mullions, shutterColor: p.shutter, lit: this.rng.chance(p.litChance),
          }),
        );
      }
    }
    return out;
  }

  /** Turn an existing window slot into a door (keeps its position). */
  toDoor(o: Opening, width: number, y0: number, height: number, color: string): Opening {
    o.kind = 'door';
    o.width = width;
    o.y0 = y0;
    o.height = height;
    o.color = color;
    o.shutterColor = undefined;
    o.mullions = false;
    o.lit = false;
    return o;
  }
}
