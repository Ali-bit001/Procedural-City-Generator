/**
 * Building data model. Generators produce these plain objects (no Three.js);
 * the mesher turns them into geometry. Coordinates are lot-local, in metres:
 *   x: across the lot (0..lotWidth), z: into the lot (0 = street edge .. lotDepth), y: up.
 * The street is on the -z side, so "front" walls face -z.
 */
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
  /** Per-end gable overhang [start, end] along the ridge; used by terraces so shared ends don't overlap. */
  gableOverhangs?: [number, number];
  /** Shed only: +1 = high edge on the +v side, -1 = on the -v side. */
  highSide: 1 | -1;
  color: string;
  /** Flat only: parapet wall instead of an overhanging slab. */
  parapet: boolean;
}

export type MassKind = 'main' | 'wing' | 'garage' | 'upper' | 'unit' | 'bay' | 'roofRoom';

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
  /** Projecting cornice band along the front at the top of the wall (brownstones). */
  cornice?: string;
  /** Trim band between floors. */
  floorBands?: boolean;
}

export type OpeningKind = 'window' | 'door' | 'garageDoor' | 'shopfront' | 'sign';

/**
 * How the window shader paints an opening (see render/windowMaterial.ts).
 * All of these are a single quad; frames, mullions, glass and glow are drawn in the shader.
 */
export type WindowStyle =
  | 'plain'
  | 'cross'
  | 'casement'
  | 'georgian'
  | 'ribbon'
  | 'curtain'
  | 'shop'
  | 'shutter'
  | 'door'
  | 'garage'
  | 'sign'
  | 'glassPanel';

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
  /** Sunshade over a window: concrete slab (chajja) or a fabric awning. */
  shade?: { kind: 'slab' | 'awning'; color: string };
  /** Window glows at night. */
  lit?: boolean;
  /** Shader style; defaults from kind / mullions. */
  style?: WindowStyle;
  /** Opens onto a balcony (no ACs or shades next to it). */
  balcony?: boolean;
}

export interface Porch {
  /** porch: posts + roof; canopy: flat slab; stoop: raised landing + long stair + railings; hood: small hood over the door. */
  kind: 'porch' | 'canopy' | 'stoop' | 'hood';
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
  kind: 'picket' | 'privacy' | 'hedge' | 'iron';
  /** Optional per-segment height overrides the fence height (e.g. lower along the front yard). */
  segments: { x0: number; z0: number; x1: number; z1: number; height?: number }[];
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

export type PropKind =
  | 'swing'
  | 'slide'
  | 'trampoline'
  | 'doghouse'
  | 'patioSet'
  | 'bbq'
  | 'gardenBed'
  | 'clothesline'
  | 'acUnit'
  | 'splitAC'
  | 'waterTank'
  | 'solarPanels'
  | 'satelliteDish'
  | 'car'
  | 'mailbox'
  | 'wallMailbox'
  | 'waterTower'
  | 'bins'
  | 'bench';

/**
 * A small object. Local frame: origin on the ground (or mount point), local -z is the "front",
 * rotated by `rot` around +y. Wall-mounted props have local -z pointing out of the wall.
 */
export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  rot: number;
  color: string;
  color2?: string;
  /** Kind-specific sizes (e.g. tank stand height, solar array size). */
  w?: number;
  d?: number;
  h?: number;
}

export type LightKind = 'sconce' | 'ceiling' | 'bollard' | 'post' | 'streetLamp';

export interface Light {
  kind: LightKind;
  x: number;
  y: number;
  z: number;
  /** Same convention as Prop.rot (wall lights: local -z points out of the wall). */
  rot: number;
}

/** Cantilevered balcony slab on a wall, with a railing. */
export interface Balcony {
  cx: number;
  cz: number;
  nx: number;
  nz: number;
  width: number;
  depth: number;
  /** Top of the slab (= floor level of the room behind). */
  y: number;
  rail: 'iron' | 'glass' | 'solid';
  color: string;
  railColor: string;
}

export interface HouseModel {
  seed: number;
  style: string;
  lot: { width: number; depth: number };
  lawnColor: string;
  trimColor: string;
  foundationColor: string;
  pavingColor: string;
  masses: Mass[];
  openings: Opening[];
  porches: Porch[];
  chimneys: Chimney[];
  driveways: Rect[];
  paths: Rect[];
  fences: Fence[];
  trees: Tree[];
  pool?: Rect;
  balconies: Balcony[];
  /** Whole lot is paved (commercial) instead of lawn. */
  paved?: boolean;
  props: Prop[];
  lights: Light[];
  /** x positions for street trees in the verge in front of the lot. */
  streetTreeXs: number[];
  info: Record<string, string | number>;
}

/** Tunable detail knobs passed into every generator. */
export interface DetailOptions {
  /** 0..1 chance multiplier for rooftop / stand water tanks. */
  waterTanks: number;
  /** 0..2 multiplier for yard props (swings, dog houses, patio sets…). */
  props: number;
  /** 0..1 chance a car is parked in a driveway. */
  cars: number;
}

export const DEFAULT_DETAILS: DetailOptions = { waterTanks: 0.4, props: 1, cars: 0.5 };

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

/** Rotation (around +y) that makes a prop's local -z face along the outward normal (nx, nz). */
export const rotFromNormal = (nx: number, nz: number): number => Math.atan2(-nx, -nz);

/** Stairs: ~18 cm risers, 28 cm treads. Horizontal run of the stair needed to climb `h` metres. */
export const STEP_RISE = 0.18;
export const STEP_RUN = 0.28;
export const stairRun = (h: number): number => (h <= 0.2 ? 0 : (Math.ceil(h / STEP_RISE) - 1) * STEP_RUN);
