import * as THREE from 'three';

/**
 * Accumulates flat-shaded, vertex-coloured triangles into a few buckets (one draw call per bucket).
 * Lots are built in lot-local space, then merged into chunk builders with `appendFrom`.
 *
 *   solid  - walls, roofs, props (vertex colours)
 *   window - facade quads painted by the window shader (windows, doors, shopfronts, signs)
 *   cutout - see-through quads (picket / iron fences, railings), alpha-cut in the shader
 *   glass  - reflective prop glass (car windows, solar panels)
 *   water  - pools
 *   lamp   - light sources (emissive at night)
 */
export type BucketName = 'solid' | 'window' | 'cutout' | 'glass' | 'water' | 'lamp';

/** Buckets that carry facade-shader attributes (aUvM, aWin). */
const FACADE: ReadonlySet<BucketName> = new Set<BucketName>(['window', 'cutout']);

interface Bucket {
  pos: number[];
  nor: number[];
  col: number[];
  uvm?: number[];
  win?: number[];
}

/** Face flags for `box(..., skip)`. Hidden faces are simply not emitted. */
export const FACE = { NY: 1, PY: 2, NX: 4, PX: 8, NZ: 16, PZ: 32 } as const;

type V3 = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _n = new THREE.Vector3();

const colorCache = new Map<string, THREE.Color>();
export function col(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

export class MeshBuilder {
  private buckets = new Map<BucketName, Bucket>();

  private bucket(name: BucketName): Bucket {
    let b = this.buckets.get(name);
    if (!b) {
      b = { pos: [], nor: [], col: [] };
      if (FACADE.has(name)) {
        b.uvm = [];
        b.win = [];
      }
      this.buckets.set(name, b);
    }
    return b;
  }

  /** Triangle; if `hint` is given the winding is flipped so the normal faces along it. */
  tri(bucket: BucketName, a: V3, b: V3, c: V3, color: THREE.Color, hint?: V3): void {
    _n.crossVectors(_e1.subVectors(b, a), _e2.subVectors(c, a));
    if (_n.lengthSq() < 1e-12) return;
    _n.normalize();
    if (hint && _n.dot(hint) < 0) {
      [b, c] = [c, b];
      _n.negate();
    }
    const bk = this.bucket(bucket);
    for (const p of [a, b, c]) {
      bk.pos.push(p.x, p.y, p.z);
      bk.nor.push(_n.x, _n.y, _n.z);
      bk.col.push(color.r, color.g, color.b);
      bk.uvm?.push(0, 0);
      bk.win?.push(0, 0, 0, 0);
    }
  }

  /** Quad given as a cyclic sequence a-b-c-d. */
  quad(bucket: BucketName, a: V3, b: V3, c: V3, d: V3, color: THREE.Color, hint?: V3): void {
    if (!hint) hint = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    this.tri(bucket, a, b, c, color, hint);
    this.tri(bucket, a, c, d, color, hint);
  }

  /**
   * Facade quad for the window shader. Corners: bottom-left, bottom-right, top-right, top-left
   * (as seen from outside). `w`,`h` are its size in metres; `style` a STYLE_ID; `litSeed` = lit + seed.
   */
  winQuad(bucket: 'window' | 'cutout', bl: V3, br: V3, tr: V3, tl: V3, color: THREE.Color, w: number, h: number, style: number, litSeed: number, normal: V3): void {
    const bk = this.bucket(bucket);
    const verts: [V3, number, number][] = [
      [bl, 0, 0], [br, w, 0], [tr, w, h],
      [bl, 0, 0], [tr, w, h], [tl, 0, h],
    ];
    // Make the winding face `normal`.
    _n.crossVectors(_e1.subVectors(br, bl), _e2.subVectors(tr, bl));
    const flip = _n.dot(normal) < 0;
    const order = flip ? [0, 2, 1, 3, 5, 4] : [0, 1, 2, 3, 4, 5];
    const n = normal.clone().normalize();
    for (const i of order) {
      const [p, u, vv] = verts[i];
      bk.pos.push(p.x, p.y, p.z);
      bk.nor.push(n.x, n.y, n.z);
      bk.col.push(color.r, color.g, color.b);
      bk.uvm!.push(u, vv);
      bk.win!.push(w, h, style, litSeed);
    }
  }

  /**
   * Axis-aligned box. `skip` is a FACE bitmask of faces that are hidden (against a wall, on the
   * ground, under a roof...). Bottom faces resting on the ground are skipped automatically.
   */
  box(bucket: BucketName, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color, skip = 0): void {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    if (y0 <= 0.06) skip |= FACE.NY;
    if (!(skip & FACE.PY)) this.quad(bucket, v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1), color, v(0, 1, 0));
    if (!(skip & FACE.NY)) this.quad(bucket, v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), color, v(0, -1, 0));
    if (!(skip & FACE.NZ)) this.quad(bucket, v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0), color, v(0, 0, -1));
    if (!(skip & FACE.PZ)) this.quad(bucket, v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), color, v(0, 0, 1));
    if (!(skip & FACE.NX)) this.quad(bucket, v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), color, v(-1, 0, 0));
    if (!(skip & FACE.PX)) this.quad(bucket, v(x1, y0, z0), v(x1, y0, z1), v(x1, y1, z1), v(x1, y1, z0), color, v(1, 0, 0));
  }

  /** A quad extruded upward by `t` into a slab (thick roof planes). */
  slab(bucket: BucketName, a: V3, b: V3, c: V3, d: V3, t: number, color: THREE.Color): void {
    const up = v(0, t, 0);
    const [A, B, C, Dd] = [a, b, c, d].map((p) => p.clone().add(up));
    this.quad(bucket, A, B, C, Dd, color, v(0, 1, 0));
    this.quad(bucket, a, b, c, d, color, v(0, -1, 0));
    const centre = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
    const ring: [V3, V3, V3, V3][] = [
      [a, b, B, A],
      [b, c, C, B],
      [c, d, Dd, C],
      [d, a, A, Dd],
    ];
    for (const [p, q, r, s] of ring) {
      const mid = p.clone().add(q).multiplyScalar(0.5);
      this.quad(bucket, p, q, r, s, color, mid.sub(centre).setY(0));
    }
  }

  /** Append any (non-indexed) geometry transformed by `matrix`, in a single colour. */
  geometry(bucket: BucketName, geom: THREE.BufferGeometry, matrix: THREE.Matrix4, color: THREE.Color): void {
    const bk = this.bucket(bucket);
    const pos = geom.getAttribute('position');
    const nor = geom.getAttribute('normal');
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      bk.pos.push(p.x, p.y, p.z);
      bk.nor.push(n.x, n.y, n.z);
      bk.col.push(color.r, color.g, color.b);
      bk.uvm?.push(0, 0);
      bk.win?.push(0, 0, 0, 0);
    }
  }

  /** Merge another builder's triangles into this one, transformed by `matrix` (lot -> chunk space). */
  appendFrom(src: MeshBuilder, matrix: THREE.Matrix4): void {
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const e = matrix.elements;
    const ne = nm.elements;
    for (const [name, s] of src.buckets) {
      const d = this.bucket(name);
      const P = s.pos;
      const N = s.nor;
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2];
        d.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        const nx = N[i], ny = N[i + 1], nz = N[i + 2];
        d.nor.push(ne[0] * nx + ne[3] * ny + ne[6] * nz, ne[1] * nx + ne[4] * ny + ne[7] * nz, ne[2] * nx + ne[5] * ny + ne[8] * nz);
      }
      for (const c of s.col) d.col.push(c);
      if (s.uvm && d.uvm) for (const u of s.uvm) d.uvm.push(u);
      if (s.win && d.win) for (const w of s.win) d.win.push(w);
    }
  }

  get triangleCount(): number {
    let n = 0;
    for (const b of this.buckets.values()) n += b.pos.length / 9;
    return n;
  }

  trianglesIn(name: BucketName): number {
    return (this.buckets.get(name)?.pos.length ?? 0) / 9;
  }

  build(materials: Record<BucketName, THREE.Material>, depthMaterials: Partial<Record<BucketName, THREE.Material>> = {}): THREE.Group {
    const group = new THREE.Group();
    for (const [name, b] of this.buckets) {
      if (!b.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      if (b.uvm) g.setAttribute('aUvM', new THREE.Float32BufferAttribute(b.uvm, 2));
      if (b.win) g.setAttribute('aWin', new THREE.Float32BufferAttribute(b.win, 4));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, materials[name]);
      // Facade quads lie flat on walls and lamps are tiny: neither needs to cast shadows.
      mesh.castShadow = name === 'solid' || name === 'cutout' || name === 'glass';
      mesh.receiveShadow = name !== 'lamp';
      if (depthMaterials[name]) mesh.customDepthMaterial = depthMaterials[name];
      mesh.name = name;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    return group;
  }
}

/** Low-poly templates for vegetation (flat-shaded). */
function flat(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals();
  return ng;
}
export const TEMPLATES = {
  blob: flat(new THREE.IcosahedronGeometry(1, 0)),
  cone: flat(new THREE.ConeGeometry(1, 1, 7)),
};

const smooth = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
export const SHAPES = {
  box: smooth(new THREE.BoxGeometry(1, 1, 1)),
  /** Unit cylinder: radius 1, height 1, centred on the origin, axis +y. */
  cyl: smooth(new THREE.CylinderGeometry(1, 1, 1, 10)),
  cylLow: smooth(new THREE.CylinderGeometry(1, 1, 1, 6)),
  /** Open-ended ring (no caps): hoops, ribs, rims. */
  tube: smooth(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true)),
  /** Unit cone: radius 1, height 1, apex +y. */
  cone: smooth(new THREE.ConeGeometry(1, 1, 10)),
  sphere: smooth(new THREE.SphereGeometry(1, 8, 5)),
};

const _Y = new THREE.Vector3(0, 1, 0);

/**
 * A local coordinate frame (position + rotation around +y) for drawing props.
 * All coordinates passed to its methods are in the prop's local space.
 */
export class LocalFrame {
  private readonly base: THREE.Matrix4;
  private readonly q: THREE.Quaternion;

  constructor(
    private readonly b: MeshBuilder,
    x: number,
    y: number,
    z: number,
    rot: number,
  ) {
    this.q = new THREE.Quaternion().setFromAxisAngle(_Y, rot);
    this.base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
  }

  p(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.base);
  }

  dir(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, y, z).applyQuaternion(this.q);
  }

  private put(bucket: BucketName, geom: THREE.BufferGeometry, pos: THREE.Vector3, q: THREE.Quaternion, scale: THREE.Vector3, c: THREE.Color): void {
    const m = new THREE.Matrix4().compose(pos, q, scale);
    this.b.geometry(bucket, geom, this.base.clone().multiply(m), c);
  }

  /** Axis-aligned (in local space) box between two corners. */
  box(bucket: BucketName, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: THREE.Color): void {
    this.put(
      bucket, SHAPES.box,
      new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(),
      new THREE.Vector3(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), c,
    );
  }

  /** Shape (cylinder/cone/sphere template) whose +y axis is aligned with `axis`, centred at (x,y,z). */
  shape(bucket: BucketName, geom: THREE.BufferGeometry, x: number, y: number, z: number, rx: number, h: number, rz: number, c: THREE.Color, axis = _Y): void {
    const q = new THREE.Quaternion().setFromUnitVectors(_Y, axis.clone().normalize());
    this.put(bucket, geom, new THREE.Vector3(x, y, z), q, new THREE.Vector3(rx, h, rz), c);
  }

  /** Square-section beam between two local points (posts, rails, ropes, legs). */
  beam(bucket: BucketName, a: [number, number, number], bEnd: [number, number, number], t: number, c: THREE.Color): void {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...bEnd);
    const d = new THREE.Vector3().subVectors(B, A);
    const len = d.length();
    if (len < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(_Y, d.divideScalar(len));
    this.put(bucket, SHAPES.box, A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(t, len, t), c);
  }

  /** Flat polygon (3 or 4 local points). `hint` is a local direction the face should point to. */
  poly(bucket: BucketName, pts: [number, number, number][], c: THREE.Color, hint?: [number, number, number]): void {
    const P = pts.map(([x, y, z]) => this.p(x, y, z));
    const H = hint ? this.dir(...hint) : undefined;
    if (P.length === 3) this.b.tri(bucket, P[0], P[1], P[2], c, H);
    else this.b.quad(bucket, P[0], P[1], P[2], P[3], c, H);
  }
}
