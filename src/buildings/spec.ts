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

export type MassKind = 'main' | 'wing' | 'garage' | 'upper' | 'unit' | 'bay' | 'roofRoom' | 'shaft' | 'stairTower';

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
  | 'glassPanel'
  /** Punched windows in a concrete / stone frame, one quad per floor. */
  | 'grid'
  /** Ribbed metal cladding (no glass), for industrial sheds. */
  | 'cladding'
  /** Cladding with a glazed strip-window band near the top. */
  | 'claddingStrip';

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
  /** Flush facade: no sill under the window. */
  noSill?: boolean;
  /** Opens onto a balcony (no ACs or shades next to it). */
  balcony?: boolean;
}

export interface Porch {
  /** porch: posts + roof; canopy: flat slab; stoop: raised landing + long stair + railings; hood: small hood over the door. */
  kind: 'porch' | 'canopy' | 'stoop' | 'hood' | 'arcade';
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
  | 'helipad'
  | 'spire'
  | 'cellTower'
  | 'antennaCluster'
  | 'bigDish'
  | 'coolingTower'
  | 'bmu'
  | 'flagpole'
  | 'roofSign'
  /** Washing hung over a balcony railing (wall-mounted frame, at the rail). */
  | 'laundry'
  | 'pylonSign'
  | 'fuelCanopy'
  | 'fuelPump'
  | 'cartCorral'
  | 'dumpster'
  | 'truck'
  | 'stall'
  | 'cafeTable'
  | 'aBoard'
  | 'planter'
  | 'flowerRack'
  | 'produceDisplay'
  | 'clothesRack'
  | 'motorbike'
  | 'bikeRack'
  | 'barberPole'
  | 'crossSign'
  | 'atm'
  | 'pennants'
  | 'carPlatform'
  | 'litterBin'
  | 'stringLights'
  | 'smokestack'
  | 'storageTank'
  | 'silo'
  | 'pipeRack'
  | 'conveyor'
  | 'container'
  | 'pallets'
  | 'drums'
  | 'forklift'
  | 'craneRails'
  | 'turbineTower'
  | 'carWashBay'
  | 'airPump'
  | 'vacuum'
  | 'evCharger'
  | 'lpgCage'
  | 'iceChest'
  | 'vending'
  | 'tyreStack'
  | 'goalPost'
  | 'basketballHoop'
  | 'climbingFrame'
  | 'seesaw'
  | 'bleachers'
  | 'grandstand'
  | 'floodlight'
  | 'ambulance'
  | 'fireTruck'
  | 'bus'
  | 'garbageTruck'
  | 'bulldozer'
  | 'skip'
  | 'train'
  | 'railTrack'
  | 'parkingDeck'
  | 'ramp'
  | 'gazebo'
  | 'fountain'
  | 'mound'
  | 'transformer'
  | 'waterTowerTall'
  | 'clockTower'
  | 'picnicTable'
  | 'pond'
  | 'pylon'
  | 'platformCanopy'
  | 'garageRamp'
  | 'adBoards'
  | 'scoreboard'
  | 'footbridge'
  | 'animal'
  | 'aviary'
  | 'gateArch'
  | 'statue'
  | 'rock'
  | 'sightScreen'
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
  /** Kind-specific count / variant (garage levels, animal species, open deck side ...). */
  n?: number;
}

export type LightKind = 'sconce' | 'ceiling' | 'bollard' | 'post' | 'streetLamp' | 'aviation' | 'lotLight';

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

/**
 * Extruded convex polygon (towers). Footprint is lot-local [x, z] points, counter-clockwise seen
 * from above. The facade is drawn as one shader quad per edge per floor.
 */
export interface PolyMass {
  poly: [number, number][];
  baseY: number;
  floors: number;
  floorHeight: number;
  /** Facade shader style for the upper floors (curtain / grid / ribbon) and the frame colour. */
  facade: WindowStyle;
  frameColor: string;
  /** Ground-floor lobby glazing instead of the facade style. */
  lobby?: boolean;
  roofColor: string;
  /** Chance a whole floor is lit at night (offices light up floor by floor). */
  litChance: number;
  /** Glowing band around the top (lit crown). */
  crownLight?: boolean;
  /** Flat roof gets a parapet. */
  parapet: boolean;
}

/** Vertical pipe on a wall (drainpipe / plumbing stack), with branches into the wall at given heights. */
export interface Pipe {
  /** Point on the wall plane at the pipe; the pipe stands just off the wall. */
  x: number;
  z: number;
  nx: number;
  nz: number;
  y0: number;
  y1: number;
  color: string;
  branches: number[];
}

/** Steel fire escape on a wall: a platform per level, zig-zag flights, railings and a drop ladder. */
export interface FireEscape {
  cx: number;
  cz: number;
  nx: number;
  nz: number;
  width: number;
  depth: number;
  /** Platform heights, bottom to top. */
  levels: number[];
  color: string;
}

/** Marked parking: asphalt + stall lines. Each row is a strip along x with stalls every stallWidth. */
export interface ParkingLot {
  rect: Rect;
  rows: { z0: number; z1: number }[];
  stallWidth: number;
  color: string;
}

/**
 * Animated parts, drawn by the GPU-animated layer (render/animation.ts), not merged into chunks.
 *   smoke   - rising, drifting particles from a stack top (steam = white, short-lived)
 *   fan     - spinning blades; axis 'up' (rooftop) or along a wall normal (nx, nz)
 *   rotor   - wind-turbine blades facing yaw 'rot'
 *   shuttle - a part sliding along (dx, dy, dz): back and forth, or looping (conveyor crates)
 */
export type AnimSpec =
  | { kind: 'smoke'; x: number; y: number; z: number; radius: number; amount: number; steam?: boolean }
  | { kind: 'fan'; x: number; y: number; z: number; radius: number; speed: number; nx?: number; nz?: number }
  | { kind: 'rotor'; x: number; y: number; z: number; radius: number; rot: number; speed: number }
  /** Car-wash brush: a spinning bristle cylinder; vertical, or horizontal along yaw 'rot' when horizontal. */
  | { kind: 'brush'; x: number; y: number; z: number; radius: number; height: number; speed: number; horizontal?: boolean; rot?: number }
  /** Fountain: water droplets thrown up in a central jet and a ring of arcs landing within `radius`. */
  | { kind: 'spray'; x: number; y: number; z: number; height: number; radius: number }
  | { kind: 'shuttle'; part: 'gantry' | 'crate'; x: number; y: number; z: number; rot: number; dx: number; dy: number; dz: number; speed: number; phase: number; loop: boolean; size: number; color: string };

/** Sports surface with its line markings (drawn flat on the ground). */
export interface Court {
  kind: 'football' | 'basketball' | 'tennis' | 'track' | 'cricket' | 'playground';
  rect: Rect;
}

/** Free-form footpath: a polyline of (x, z) points with a width (curving park / campus walks). */
export interface Walkway {
  pts: [number, number][];
  width: number;
  color?: string;
}

/** Irregular water body (lake / pond / pool in an enclosure) as a closed (x, z) polygon. */
export interface WaterBody {
  pts: [number, number][];
  shore?: string;
  /** Shore height (water sits 2 cm above); default 0.03. */
  y?: number;
}

/** Stadium seating bowl swept round a superellipse (see bowlMesher). */
export interface Bowl {
  cx: number;
  cz: number;
  /** Inner (pitch-side) half-axes. */
  ax: number;
  az: number;
  /** Superellipse power: 2 = oval / round, 3-4 = rounded rectangle. */
  power: number;
  /** Tiers from the pitch outwards: seating depth and front / back heights. */
  tiers: { depth: number; y0: number; y1: number }[];
  roof: 'none' | 'canopy' | 'oculus' | 'dome';
  /** Canopy over this angle range only (radians). */
  roofArc?: [number, number];
  /** Roof height above the top row. */
  roofRise: number;
  /** How far the roof reaches past the front row towards the pitch (m). */
  cover: number;
  /** Open end (horseshoe): centre angle and angular width. */
  gap?: { at: number; width: number };
  seats: [string, string];
  pattern: 'sections' | 'rows' | 'solid';
  facade: string;
  facadeStyle: 'plain' | 'ribs' | 'glass' | 'bands';
  roofColor: string;
  accent: string;
}

/** Round paved area (fountain plaza, path junction, viewing point). */
export interface Plaza {
  x: number;
  z: number;
  r: number;
  color?: string;
}

/** Axis-aligned volume that facade details (ACs, dishes) must stay out of. */
export interface Blocker {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
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
  pipes?: Pipe[];
  /** Moving parts (smoke, fans, cranes, conveyors). */
  animated?: AnimSpec[];
  parkingLots?: ParkingLot[];
  courts?: Court[];
  walks?: Walkway[];
  water?: WaterBody[];
  plazas?: Plaza[];
  bowls?: Bowl[];
  fireEscapes?: FireEscape[];
  /** Tower volumes (extruded polygons). */
  polyMasses?: PolyMass[];
  /** Overall height incl. spires (for bounds / labels), if taller than the masses. */
  height?: number;
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
