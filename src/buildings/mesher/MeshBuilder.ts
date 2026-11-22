import * as THREE from 'three';

/**
 * Accumulates flat-shaded, vertex-coloured triangles into a few buckets
 * (one draw call per bucket), so a whole house is ~3 draw calls.
 */
export type BucketName = 'solid' | 'glass' | 'glassLit' | 'water' | 'lamp';

interface Bucket {
  pos: number[];
  nor: number[];
  col: number[];
}

type V3 = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

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
      this.buckets.set(name, b);
    }
    return b;
  }

  /** Triangle; if `hint` is given the winding is flipped so the normal faces along it. */
  tri(bucket: BucketName, a: V3, b: V3, c: V3, color: THREE.Color, hint?: V3): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-12) return;
    n.normalize();
    if (hint && n.dot(hint) < 0) {
      [b, c] = [c, b];
      n.negate();
    }
    const bk = this.bucket(bucket);
    for (const p of [a, b, c]) {
      bk.pos.push(p.x, p.y, p.z);
      bk.nor.push(n.x, n.y, n.z);
      bk.col.push(color.r, color.g, color.b);
    }
  }

  /** Quad given as a cyclic sequence a-b-c-d. */
  quad(bucket: BucketName, a: V3, b: V3, c: V3, d: V3, color: THREE.Color, hint?: V3): void {
    if (!hint) {
      hint = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    }
    this.tri(bucket, a, b, c, color, hint);
    this.tri(bucket, a, c, d, color, hint);
  }

  box(bucket: BucketName, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color): void {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    this.quad(bucket, v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1), color, v(0, 1, 0));
    this.quad(bucket, v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), color, v(0, -1, 0));
    this.quad(bucket, v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0), color, v(0, 0, -1));
    this.quad(bucket, v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), color, v(0, 0, 1));
    this.quad(bucket, v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), color, v(-1, 0, 0));
    this.quad(bucket, v(x1, y0, z0), v(x1, y0, z1), v(x1, y1, z1), v(x1, y1, z0), color, v(1, 0, 0));
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
      const hint = mid.sub(centre).setY(0);
      this.quad(bucket, p, q, r, s, color, hint);
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
    }
  }

  get triangleCount(): number {
    let n = 0;
    for (const b of this.buckets.values()) n += b.pos.length / 9;
    return n;
  }

  build(materials: Record<BucketName, THREE.Material>): THREE.Group {
    const group = new THREE.Group();
    for (const [name, b] of this.buckets) {
      if (!b.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, materials[name]);
      mesh.castShadow = name !== 'water' && name !== 'lamp';
      mesh.receiveShadow = true;
      mesh.name = name;
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
  blobSmooth: flat(new THREE.IcosahedronGeometry(1, 1)),
  cone: flat(new THREE.ConeGeometry(1, 1, 7)),
};

const smooth = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
export const SHAPES = {
  box: smooth(new THREE.BoxGeometry(1, 1, 1)),
  /** Unit cylinder: radius 1, height 1, centred on the origin, axis +y. */
  cyl: smooth(new THREE.CylinderGeometry(1, 1, 1, 14)),
  cylLow: smooth(new THREE.CylinderGeometry(1, 1, 1, 6)),
  /** Unit cone: radius 1, height 1, apex +y. */
  cone: smooth(new THREE.ConeGeometry(1, 1, 12)),
  sphere: smooth(new THREE.SphereGeometry(1, 10, 6)),
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
