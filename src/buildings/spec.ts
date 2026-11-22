/**
 * Building data model. Generators produce these plain objects (no Three.js);
 * the mesher turns them into geometry. Coordinates are lot-local, in metres:
 *   x: across the lot (0..lotWidth), z: into the lot (0 = street edge .. lotDepth), y: up.
 * The street is on the -z side, so "front" walls face -z.
 */
import type { HouseStyle } from './styles/palettes';

export type Axis = 'x' | 'z';
export type RoofType = 'gable' | 'hip' | 'shed' | 'flat';
export type WallSide = 'front' | 'back' | 'left' | 'right';

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface RoofSpec {
  type: RoofType;
  /** rise / run */
  pitch: number;
  /** Ridge direction (gable/hip) or direction of the high edge (shed). */
  axis: Axis;
  overhang: number;
  gableOverhang: number;
  /** Shed only: +1 = high edge on the +v side, -1 = on the -v side. */
  highSide: 1 | -1;
  color: string;
  /** Flat only: parapet wall instead of an overhanging slab. */
  parapet: boolean;
}

export type MassKind = 'main' | 'wing' | 'garage' | 'upper';

export interface Mass {
  id: number;
  kind: MassKind;
  rect: Rect;
  baseY: number;
  floors: number;
  floorHeight: number;
  wallColor: string;
  roof: RoofSpec;
  /** Draw a raised foundation under this mass. */
  plinth: boolean;
}

export type OpeningKind = 'window' | 'door' | 'garageDoor';

export interface Opening {
  kind: OpeningKind;
  massId: number;
  wall: WallSide;
  floor: number;
  /** Centre of the opening on the wall plane. */
  cx: number;
  cz: number;
  /** Outward wall normal (axis aligned). */
  nx: number;
  nz: number;
  width: number;
  y0: number;
  height: number;
  color: string;
  frameColor: string;
  shutterColor?: string;
  mullions: boolean;
}

export interface Porch {
  kind: 'porch' | 'canopy';
  rect: Rect;
  floorY: number;
  roofY: number;
  stepX: number;
  floorColor: string;
  roofColor: string;
  postColor: string;
}

export interface Chimney {
  x: number;
  z: number;
  w: number;
  d: number;
  y0: number;
  y1: number;
  color: string;
}

export interface Fence {
  kind: 'picket' | 'privacy' | 'hedge';
  segments: { x0: number; z0: number; x1: number; z1: number }[];
  color: string;
  height: number;
}

export interface Tree {
  kind: 'round' | 'cone' | 'shrub';
  x: number;
  z: number;
  scale: number;
  rot: number;
  color: string;
  trunkColor: string;
}

export interface HouseModel {
  seed: number;
  style: HouseStyle;
  lot: { width: number; depth: number };
  lawnColor: string;
  trimColor: string;
  foundationColor: string;
  pavingColor: string;
  masses: Mass[];
  openings: Opening[];
  porch?: Porch;
  chimney?: Chimney;
  driveway?: Rect;
  paths: Rect[];
  fences: Fence[];
  trees: Tree[];
  pool?: Rect;
  /** x positions for street trees in the verge in front of the lot. */
  streetTreeXs: number[];
  info: Record<string, string | number>;
}

export const massTop = (m: Mass): number => m.baseY + m.floors * m.floorHeight;

/** Height the roof adds above the wall top. */
export function roofRise(m: Mass): number {
  const r = m.rect;
  const across = m.roof.axis === 'x' ? r.z1 - r.z0 : r.x1 - r.x0;
  switch (m.roof.type) {
    case 'gable':
    case 'hip':
      return (across / 2) * m.roof.pitch;
    case 'shed':
      return across * m.roof.pitch;
    case 'flat':
      return 0.5;
  }
}
