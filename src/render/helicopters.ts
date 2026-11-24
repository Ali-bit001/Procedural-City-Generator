/**
 * A few helicopters flying between the scene's helipads.
 *
 * Each one runs a small state machine, updated on the CPU (only 2-3 instances, so this is cheap):
 *   idle (on the pad, rotor winding down / up) -> lift (vertical, 12 m) -> turn (yaw to the next pad)
 *   -> climb (vertical to cruise height above the skyline) -> cruise (straight, nose down, slight bank
 *   while turning) -> descend (vertical, slowing near the pad) -> land -> idle
 * With a single helipad the route is a sightseeing loop of waypoints that ends back on the same pad.
 */
import * as THREE from 'three';
import { LocalFrame, MeshBuilder, SHAPES, col } from '../buildings/mesher/MeshBuilder';

const PAINT: [string, string][] = [
  ['#f4f1ea', '#c0392b'], // medical
  ['#1f3f73', '#f4f1ea'], // police
  ['#f2c94c', '#1e1f22'], // news
  ['#1e1f22', '#c9a648'], // executive
];

function geom(draw: (L: LocalFrame) => void): THREE.BufferGeometry {
  const b = new MeshBuilder();
  draw(new LocalFrame(b, 0, 0, 0, 0));
  const plain = new THREE.MeshBasicMaterial();
  const g = b.build({ solid: plain, window: plain, cutout: plain, glass: plain, water: plain, lamp: plain });
  return (g.children[0] as THREE.Mesh).geometry;
}

/** Body (nose towards -z, skids on y = 0). */
function bodyGeometry(main: string, stripe: string): THREE.BufferGeometry {
  return geom((L) => {
    const c = col(main);
    const s = col(stripe);
    const dark = col('#1c2733');
    const steel = col('#6b6e72');
    L.shape('solid', SHAPES.sphere, 0, 1.55, -0.5, 1.05, 0.95, 1.7, c);
    L.shape('solid', SHAPES.sphere, 0, 1.75, -1.25, 0.86, 0.62, 0.95, dark); // windscreen
    L.box('solid', -1.06, 1.25, -0.6, 1.06, 1.45, 0.9, s); // stripe
    L.beam('solid', [0, 1.65, 0.9], [0, 1.95, 6.3], 0.36, c);
    L.box('solid', -0.05, 1.8, 5.9, 0.05, 3.1, 6.55, s); // fin
    L.box('solid', -0.9, 1.95, 5.8, 0.9, 2.02, 6.2, c); // stabiliser
    L.beam('solid', [0, 2.35, -0.2], [0, 2.85, -0.2], 0.22, steel); // mast
    for (const x of [-0.85, 0.85]) {
      L.beam('solid', [x, 0.06, -1.7], [x, 0.06, 1.5], 0.09, steel);
      L.beam('solid', [x, 0.06, -1.9], [x, 0.22, -2.05], 0.09, steel);
      for (const z of [-0.9, 0.7]) L.beam('solid', [x, 0.06, z], [x * 0.6, 0.9, z], 0.08, steel);
    }
  });
}

/** Main rotor: four blades round the y axis at the origin. */
const ROTOR = () =>
  geom((L) => {
    const c = col('#2b2b2b');
    L.shape('solid', SHAPES.cylLow, 0, 0, 0, 0.3, 0.2, 0.3, col('#6b6e72'));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      L.beam('solid', [Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25], [Math.cos(a) * 5.4, -0.08, Math.sin(a) * 5.4], 0.28, c);
    }
  });

/** Tail rotor: two blades round the x axis. */
const TAIL = () =>
  geom((L) => {
    const c = col('#2b2b2b');
    L.beam('solid', [0, -0.75, 0], [0, 0.75, 0], 0.12, c);
    L.beam('solid', [0, 0, -0.75], [0, 0, 0.75], 0.12, c);
  });

interface Waypoint {
  p: THREE.Vector3;
  /** Pad index when this waypoint is a landing. */
  pad?: number;
}

type State = 'idle' | 'lift' | 'turn' | 'climb' | 'cruise' | 'descend';

interface Heli {
  group: THREE.Group;
  rotor: THREE.Mesh;
  tail: THREE.Mesh;
  beacon: THREE.Mesh;
  state: State;
  timer: number;
  pad: number;
  route: Waypoint[];
  yaw: number;
  speed: number;
  rotorSpeed: number;
  bank: number;
}

const YAW_RATE = 0.7;
const RISE = 7;
const CRUISE = 38;

export class HelicopterFleet {
  readonly root = new THREE.Group();
  private helis: Heli[] = [];
  private pads: THREE.Vector3[] = [];
  private cruiseY = 80;
  private time = 0;
  private rand: () => number = Math.random;

  get count(): number {
    return this.helis.length;
  }

  /** World position and yaw of helicopter i (for a chase camera). */
  pose(i: number): { pos: THREE.Vector3; yaw: number } | undefined {
    const h = this.helis[i % Math.max(1, this.helis.length)];
    return h ? { pos: h.group.position, yaw: h.yaw } : undefined;
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.root.clear();
    this.helis = [];
  }

  /** pads: helipad surfaces in world space; skyline: tallest building top. */
  build(pads: THREE.Vector3[], skyline: number, seed = 1): void {
    this.dispose();
    this.pads = pads;
    if (!pads.length) return;
    let s = (seed % 2147483646) + 1;
    this.rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    this.cruiseY = Math.max(skyline + 28, ...pads.map((p) => p.y + 25));
    const n = pads.length === 1 ? 1 : Math.min(3, pads.length);
    const order = pads.map((_, i) => i).sort(() => this.rand() - 0.5);
    const rotorGeom = ROTOR();
    const tailGeom = TAIL();
    for (let i = 0; i < n; i++) {
      const [main, stripe] = PAINT[Math.floor(this.rand() * PAINT.length)];
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 });
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeometry(main, stripe), mat);
      const rotor = new THREE.Mesh(rotorGeom.clone(), mat);
      rotor.position.set(0, 2.85, -0.2);
      const tail = new THREE.Mesh(tailGeom.clone(), mat);
      tail.position.set(0.3, 2.3, 6.25);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff2a1a' }));
      beacon.position.set(0, 2.05, 6.3);
      group.add(body, rotor, tail, beacon);
      group.scale.setScalar(1.1);
      const pad = order[i % order.length];
      group.position.copy(pads[pad]);
      const yaw = this.rand() * Math.PI * 2;
      group.rotation.set(0, yaw, 0, 'YXZ');
      this.root.add(group);
      this.helis.push({ group, rotor, tail, beacon, state: 'idle', timer: 3 + this.rand() * 14, pad, route: [], yaw, speed: 0, rotorSpeed: 0, bank: 0 });
    }
  }

  private plan(h: Heli): void {
    const here = this.pads[h.pad];
    if (this.pads.length === 1) {
      // Sightseeing loop round the city, back to the same pad.
      const r = 140 + this.rand() * 80;
      const a0 = this.rand() * Math.PI * 2;
      h.route = [0, 1, 2].map((k) => ({ p: new THREE.Vector3(here.x + Math.cos(a0 + k * 2.1) * r, this.cruiseY, here.z + Math.sin(a0 + k * 2.1) * r) }));
      h.route.push({ p: here, pad: h.pad });
      return;
    }
    // Next pad: random, not the current one, preferring pads no other helicopter is using.
    const busy = new Set(this.helis.filter((o) => o !== h).map((o) => (o.route.length ? o.route[o.route.length - 1].pad ?? o.pad : o.pad)));
    const options = this.pads.map((_, i) => i).filter((i) => i !== h.pad && !busy.has(i));
    const pool = options.length ? options : this.pads.map((_, i) => i).filter((i) => i !== h.pad);
    const next = pool[Math.floor(this.rand() * pool.length)];
    h.route = [{ p: this.pads[next], pad: next }];
  }

  update(dt: number): void {
    this.time += dt;
    for (const h of this.helis) this.step(h, Math.min(dt, 0.1));
  }

  private step(h: Heli, dt: number): void {
    const g = h.group;
    const pos = g.position;
    const target = h.route[0];
    const turnTo = (p: THREE.Vector3) => {
      const want = Math.atan2(-(p.x - pos.x), -(p.z - pos.z));
      let d = want - h.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const stepYaw = Math.sign(d) * Math.min(Math.abs(d), YAW_RATE * dt);
      h.yaw += stepYaw;
      h.bank += ((-stepYaw / Math.max(dt, 1e-3)) * 0.35 - h.bank) * Math.min(1, dt * 2);
      return Math.abs(d);
    };
    let rotorTarget = 1;
    switch (h.state) {
      case 'idle': {
        h.timer -= dt;
        rotorTarget = h.timer < 4 ? 1 : 0.15;
        if (h.timer <= 0 && h.rotorSpeed > 0.9) {
          this.plan(h);
          h.state = 'lift';
          h.timer = 12;
        }
        break;
      }
      case 'lift': {
        const pad = this.pads[h.pad];
        pos.y = Math.min(pad.y + 12, pos.y + RISE * 0.6 * dt);
        if (pos.y >= pad.y + 12 - 1e-3) h.state = 'turn';
        break;
      }
      case 'turn': {
        if (turnTo(target.p) < 0.03) h.state = 'climb';
        break;
      }
      case 'climb': {
        pos.y = Math.min(this.cruiseY, pos.y + RISE * dt);
        turnTo(target.p);
        if (pos.y >= this.cruiseY - 1e-3) h.state = 'cruise';
        break;
      }
      case 'cruise': {
        const dx = target.p.x - pos.x;
        const dz = target.p.z - pos.z;
        const dist = Math.hypot(dx, dz);
        turnTo(target.p);
        const want = Math.min(CRUISE, dist * 0.35 + 2);
        h.speed += (want - h.speed) * Math.min(1, dt * 0.8);
        const stepLen = Math.min(dist, h.speed * dt);
        if (dist > 1e-3) {
          pos.x += (dx / dist) * stepLen;
          pos.z += (dz / dist) * stepLen;
        }
        if (dist < 1.5) {
          h.speed = 0;
          if (target.pad !== undefined) h.state = 'descend';
          else {
            h.route.shift();
            h.state = 'turn';
          }
        }
        break;
      }
      case 'descend': {
        // Settle onto the exact centre of the pad on the way down.
        pos.x += (target.p.x - pos.x) * Math.min(1, dt * 1.5);
        pos.z += (target.p.z - pos.z) * Math.min(1, dt * 1.5);
        const gap = pos.y - target.p.y;
        pos.y -= Math.min(gap, Math.max(1.2, Math.min(RISE, gap * 0.4)) * dt);
        if (gap <= 0.02) {
          pos.copy(target.p);
          h.pad = target.pad ?? h.pad;
          h.route = [];
          h.state = 'idle';
          h.timer = 8 + this.rand() * 16;
        }
        break;
      }
    }
    h.rotorSpeed += (rotorTarget - h.rotorSpeed) * Math.min(1, dt * 0.6);
    h.rotor.rotation.y += h.rotorSpeed * 28 * dt;
    h.tail.rotation.x += h.rotorSpeed * 45 * dt;
    if (h.state !== 'cruise' && h.state !== 'turn' && h.state !== 'climb') h.bank *= Math.max(0, 1 - dt * 2);
    const pitch = h.state === 'cruise' ? -(h.speed / CRUISE) * 0.14 : 0;
    g.rotation.set(pitch, h.yaw, THREE.MathUtils.clamp(h.bank, -0.3, 0.3), 'YXZ');
    h.beacon.visible = Math.sin(this.time * 6 + h.pad) > 0.6;
  }
}
