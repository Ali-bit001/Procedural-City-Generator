/**
 * Chunked, merged city rendering.
 *
 * Lots are grouped into square chunks. Each chunk is ONE merged mesh per material bucket (~6 draw
 * calls) in two detail levels; the far level is shown once the camera is `lodDistance` away.
 * Picking uses per-lot bounding boxes (no triangle raycasts), so hovering stays cheap at any size.
 */
import * as THREE from 'three';
import { MeshBuilder } from '../buildings/mesher/MeshBuilder';
import { buildLotGeometry, type Lod, type LotMeshOptions } from '../buildings/mesher/lotMesher';
import { massTop, roofRise, type HouseModel } from '../buildings/spec';
import type { CityMaterials } from './materials';

export interface LotInstance {
  index: number;
  model: HouseModel;
  /** Lot-local -> world transform. */
  matrix: THREE.Matrix4;
  /** World-space bounds (filled in by the manager). */
  bounds?: THREE.Box3;
}

interface Chunk {
  box: THREE.Box3;
  levels: [THREE.Group, THREE.Group];
  tris: [number, number];
  lod: Lod;
}

export class ChunkManager {
  readonly root = new THREE.Group();
  /** Switch a chunk to the far level beyond this distance (metres from the camera to the chunk box). */
  lodDistance = 150;
  private chunks: Chunk[] = [];
  private lots: LotInstance[] = [];

  constructor(
    private readonly mats: CityMaterials,
    private readonly chunkSize = 64,
  ) {}

  build(lots: LotInstance[], meshOpts: Omit<LotMeshOptions, 'lod'>): void {
    this.dispose();
    this.lots = lots;
    const groups = new Map<string, LotInstance[]>();
    const c = new THREE.Vector3();
    for (const lot of lots) {
      lot.bounds = lotBounds(lot);
      lot.bounds.getCenter(c);
      const key = `${Math.floor(c.x / this.chunkSize)},${Math.floor(c.z / this.chunkSize)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lot);
    }
    for (const members of groups.values()) {
      const box = new THREE.Box3();
      for (const l of members) box.union(l.bounds!);
      box.getCenter(c);
      const toChunk = new THREE.Matrix4().makeTranslation(-c.x, 0, -c.z);
      const tris: [number, number] = [0, 0];
      const levels = ([0, 1] as const).map((lod) => {
        const cb = new MeshBuilder();
        for (const l of members) cb.appendFrom(buildLotGeometry(l.model, { ...meshOpts, lod }), toChunk.clone().multiply(l.matrix));
        tris[lod] = cb.triangleCount;
        const g = cb.build(this.mats.materials, this.mats.depthMaterials);
        g.position.set(c.x, 0, c.z);
        g.visible = lod === 0;
        this.root.add(g);
        return g;
      }) as [THREE.Group, THREE.Group];
      this.chunks.push({ box, levels, tris, lod: 0 });
    }
  }

  /** Update LOD levels for the camera. Returns true if anything switched. */
  update(camPos: THREE.Vector3): boolean {
    let changed = false;
    for (const ch of this.chunks) {
      const want: Lod = ch.box.distanceToPoint(camPos) > this.lodDistance ? 1 : 0;
      if (want !== ch.lod) {
        ch.lod = want;
        ch.levels[0].visible = want === 0;
        ch.levels[1].visible = want === 1;
        changed = true;
      }
    }
    return changed;
  }

  /** Nearest lot whose bounds the ray hits. */
  pick(ray: THREE.Ray): LotInstance | null {
    let best: LotInstance | null = null;
    let bestD = Infinity;
    const hit = new THREE.Vector3();
    for (const lot of this.lots) {
      if (!lot.bounds || !ray.intersectBox(lot.bounds, hit)) continue;
      const d = hit.distanceToSquared(ray.origin);
      if (d < bestD) {
        bestD = d;
        best = lot;
      }
    }
    return best;
  }

  stats(): { chunks: number; near: number; far: number; trisNear: number; trisFar: number } {
    let near = 0;
    let trisNear = 0;
    let trisFar = 0;
    for (const ch of this.chunks) {
      if (ch.lod === 0) near++;
      trisNear += ch.tris[0];
      trisFar += ch.tris[1];
    }
    return { chunks: this.chunks.length, near, far: this.chunks.length - near, trisNear, trisFar };
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.root.clear();
    this.chunks = [];
    this.lots = [];
  }
}

/** World bounds of a lot: its footprint up to the top of its tallest roof (+ a bit for props). */
function lotBounds(lot: LotInstance): THREE.Box3 {
  const m = lot.model;
  const h = Math.max(
    3,
    m.height ?? 0,
    ...m.masses.map((ms) => massTop(ms) + roofRise(ms)),
    ...(m.polyMasses ?? []).map((pm) => pm.baseY + pm.floors * pm.floorHeight),
  ) + 2;
  return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(m.lot.width, h, m.lot.depth)).applyMatrix4(lot.matrix);
}
