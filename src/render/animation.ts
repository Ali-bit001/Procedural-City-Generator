/**
 * GPU-animated layer: smoke & steam, spinning fans and turbine rotors, sliding cranes and conveyor crates.
 *
 * Everything is instanced and animated in the vertex shader from a single time uniform, so the CPU
 * only advances `uTime` each frame. One draw call per kind (smoke, fans, rotors, gantries, crates).
 * Specs come from lot models (lot-local) and are moved to world space with each lot's matrix.
 */
import * as THREE from 'three';
import { LocalFrame, MeshBuilder, SHAPES, col } from '../buildings/mesher/MeshBuilder';
import type { AnimSpec } from '../buildings/spec';

export interface AnimItem {
  spec: AnimSpec;
  /** Lot-local -> world (translation + rotation about y). */
  matrix: THREE.Matrix4;
}

const Y = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- templates (built once)

function template(draw: (L: LocalFrame) => void): THREE.BufferGeometry {
  const b = new MeshBuilder();
  draw(new LocalFrame(b, 0, 0, 0, 0));
  const g = b.build({ solid: new THREE.MeshBasicMaterial(), window: new THREE.MeshBasicMaterial(), cutout: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(), water: new THREE.MeshBasicMaterial(), lamp: new THREE.MeshBasicMaterial() });
  return (g.children[0] as THREE.Mesh).geometry;
}

/** Fan: housing ring + hub + 4 blades in the XZ plane, spinning about +Y (radius 1). */
const FAN = () =>
  template((L) => {
    const dark = col('#3b3e42');
    L.shape('solid', SHAPES.tube, 0, 0, 0, 1.0, 0.35, 1.0, col('#9aa0a6'));
    L.shape('solid', SHAPES.cylLow, 0, 0, 0, 0.18, 0.2, 0.18, dark);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      L.beam('solid', [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], [Math.cos(a) * 0.92, 0.04, Math.sin(a) * 0.92], 0.22, dark);
    }
  });

/** Wind-turbine rotor: hub + 3 long blades in the XZ plane, spinning about +Y (radius 1). */
const ROTOR = () =>
  template((L) => {
    const white = col('#f2f2ee');
    L.shape('solid', SHAPES.sphere, 0, 0, 0, 0.06, 0.06, 0.06, white);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      L.beam('solid', [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], [Math.cos(a), 0, Math.sin(a)], 0.035, white);
    }
  });

/** Gantry crane bridge spanning x = -0.5..0.5 (scaled to the span), hanging from y = 0. */
const GANTRY = () =>
  template((L) => {
    const yellow = col('#f2c94c');
    const dark = col('#2b2b2b');
    L.box('solid', -0.5, -0.7, -0.35, 0.5, 0, 0.35, yellow); // girder
    for (const x of [-0.5, 0.5]) L.box('solid', x - 0.03, -0.9, -1.2, x + 0.03, -0.35, 1.2, yellow); // end trucks
    L.box('solid', -0.05, -1.3, -0.6, 0.05, -0.7, 0.6, dark); // trolley
    L.beam('solid', [0, -1.3, 0], [0, -4.2, 0], 0.05, dark); // hoist cable
    L.box('solid', -0.02, -4.6, -0.25, 0.02, -4.2, 0.25, yellow); // hook block
  });

/** Car-wash brush: bristle slats in alternating colours around a core, radius 1, height 1, centred on y = 0. */
const BRUSH = () =>
  template((L) => {
    const a = col('#2f6db5');
    const b = col('#e74c3c');
    L.shape('solid', SHAPES.cylLow, 0, 0, 0, 0.25, 1.0, 0.25, col('#3b3e42'));
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2;
      L.beam('solid', [Math.cos(ang) * 0.7, -0.5, Math.sin(ang) * 0.7], [Math.cos(ang) * 0.7, 0.5, Math.sin(ang) * 0.7], 0.5, k % 2 ? a : b);
    }
  });

/** Unit crate (1 m cube standing on y = 0), tinted per instance. */
const CRATE = () =>
  template((L) => {
    L.box('solid', -0.5, 0, -0.5, 0.5, 1, 0.5, col('#ffffff'));
  });

// ---------------------------------------------------------------- shaders

const SPIN_VERT_DECL = 'attribute vec2 aSpin;\nuniform float uTime;\n';
const SPIN_NORMAL = `
float spinA = uTime * aSpin.x + aSpin.y;
mat3 spinM = mat3(cos(spinA), 0.0, -sin(spinA), 0.0, 1.0, 0.0, sin(spinA), 0.0, cos(spinA));
vec3 objectNormal = spinM * vec3(normal);
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif
`;

const MOVE_VERT_DECL = 'attribute vec4 aMove;\nattribute vec2 aMove2;\nuniform float uTime;\n';
const MOVE_BEGIN = `
vec3 transformed = vec3(position);
float mt = uTime * aMove.w + aMove2.x;
float mf = aMove2.y > 0.5 ? fract(mt) : 0.5 - 0.5 * cos(6.2831853 * mt);
vec3 moveOffset = aMove.xyz * mf;
`;
// project_vertex with a world-space offset after the instance matrix (the mesh itself sits at the origin).
const MOVE_PROJECT = `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xyz += moveOffset;
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

function spinMaterial(uTime: { value: number }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SPIN_VERT_DECL}`)
      .replace('#include <beginnormal_vertex>', SPIN_NORMAL)
      .replace('#include <begin_vertex>', 'vec3 transformed = spinM * vec3(position);');
  };
  m.customProgramCacheKey = () => 'anim-spin';
  return m;
}

function moveMaterial(uTime: { value: number }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${MOVE_VERT_DECL}`)
      .replace('#include <begin_vertex>', MOVE_BEGIN)
      .replace('#include <project_vertex>', MOVE_PROJECT);
  };
  m.customProgramCacheKey = () => 'anim-move';
  return m;
}

const SMOKE_VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
attribute vec3 aOrigin;
attribute vec4 aParams; // phase, lifetime (s), base size (m), rise speed (m/s)
attribute vec4 aTint;   // rgb, opacity
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
#include <common>
#include <fog_pars_vertex>
void main() {
  float age = fract(uTime / aParams.y + aParams.x);
  float t = age * aParams.y;
  vec3 p = aOrigin;
  p.y += aParams.w * t * (1.0 - 0.3 * age);
  p.xz += uWind * t * (0.3 + age);
  p.x += sin(t * 1.3 + aParams.x * 40.0) * 0.7 * age;
  p.z += cos(t * 1.1 + aParams.x * 23.0) * 0.7 * age;
  float size = aParams.z * (0.6 + age * 2.6);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  float ang = aParams.x * 6.2831 + t * 0.25;
  vec2 q = vec2(position.x * cos(ang) - position.y * sin(ang), position.x * sin(ang) + position.y * cos(ang));
  mvPosition.xy += q * size;
  gl_Position = projectionMatrix * mvPosition;
  vUv = position.xy + 0.5;
  vAlpha = aTint.a * smoothstep(0.0, 0.08, age) * (1.0 - age);
  vColor = aTint.rgb;
  #include <fog_vertex>
}
`;

const SMOKE_FRAG = /* glsl */ `
uniform float uNight;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  float wobble = sin(vUv.x * 9.0 + vUv.y * 7.0) * 0.08;
  float a = vAlpha * smoothstep(1.0, 0.2, r + wobble);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * mix(1.0, 0.25, uNight), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** Fountain droplets: ballistic arcs from the nozzle (aDir = horizontal velocity, aParams.w = launch vy). */
const SPRAY_VERT = /* glsl */ `
uniform float uTime;
attribute vec3 aOrigin;
attribute vec4 aParams; // phase, lifetime (s), droplet size (m), vertical launch speed (m/s)
attribute vec4 aTint;   // horizontal velocity xz, unused, unused
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
#include <common>
#include <fog_pars_vertex>
void main() {
  float age = fract(uTime / aParams.y + aParams.x);
  float t = age * aParams.y;
  vec3 p = aOrigin + vec3(aTint.x * t, aParams.w * t - 4.9 * t * t, aTint.y * t);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  mvPosition.xy += position.xy * aParams.z * (1.0 + age * 0.4);
  gl_Position = projectionMatrix * mvPosition;
  vUv = position.xy + 0.5;
  vAlpha = 0.75 * smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.9, 1.0, age));
  vColor = vec3(0.72, 0.86, 0.97);
  #include <fog_vertex>
}
`;

// ---------------------------------------------------------------- layer

export class AnimationLayer {
  readonly root = new THREE.Group();
  /** Total animated instances (0 = nothing to animate, the Lab can stay idle). */
  count = 0;
  private readonly uTime = { value: 0 };
  private readonly uNight = { value: 0 };
  private readonly uWind = { value: new THREE.Vector2(1.6, 0.7) };
  private templates?: { fan: THREE.BufferGeometry; rotor: THREE.BufferGeometry; gantry: THREE.BufferGeometry; crate: THREE.BufferGeometry; brush: THREE.BufferGeometry };

  update(dt: number): void {
    this.uTime.value += dt;
  }

  setNight(on: boolean): void {
    this.uNight.value = on ? 1 : 0;
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.root.clear();
    this.count = 0;
  }

  build(items: AnimItem[]): void {
    this.dispose();
    this.templates ??= { fan: FAN(), rotor: ROTOR(), gantry: GANTRY(), crate: CRATE(), brush: BRUSH() };
    const smoke: { origin: THREE.Vector3; params: number[]; tint: number[] }[] = [];
    const spray: { origin: THREE.Vector3; params: number[]; tint: number[] }[] = [];
    const fans: { m: THREE.Matrix4; spin: [number, number] }[] = [];
    const rotors: { m: THREE.Matrix4; spin: [number, number] }[] = [];
    const brushes: { m: THREE.Matrix4; spin: [number, number] }[] = [];
    const gantries: { m: THREE.Matrix4; move: number[]; move2: number[]; color: THREE.Color }[] = [];
    const crates: { m: THREE.Matrix4; move: number[]; move2: number[]; color: THREE.Color }[] = [];

    const pos = new THREE.Vector3();
    const lotQ = new THREE.Quaternion();
    const tmpS = new THREE.Vector3();
    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (const { spec: s, matrix } of items) {
      matrix.decompose(tmpS, lotQ, tmpS);
      pos.set(s.x, s.y, s.z).applyMatrix4(matrix);
      const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(lotQ);
      switch (s.kind) {
        case 'smoke': {
          const n = Math.max(8, Math.round(s.amount * 1.4)); // dense enough to read as a continuous plume
          const life = s.steam ? 3.5 : 9;
          const tint = s.steam ? [0.95, 0.95, 0.95, 0.42] : [0.42, 0.42, 0.43, 0.55];
          for (let i = 0; i < n; i++) {
            smoke.push({
              origin: pos.clone().add(new THREE.Vector3((rand() - 0.5) * s.radius, 0, (rand() - 0.5) * s.radius)),
              params: [i / n + rand() * 0.02, life * (0.85 + rand() * 0.3), s.radius * (s.steam ? 1.6 : 1.7), s.steam ? 2.2 : 2.6],
              tint,
            });
          }
          break;
        }
        case 'spray': {
          // Central jet falling back into the top bowl + a ring of 8 arcs that drop ~1.4 m into the basin at `radius`.
          const g = 9.8;
          const jet = (H: number, fall: number, dx: number, dz: number, reach: number, n: number, size: number) => {
            const vy = Math.sqrt(2 * g * H);
            const life = (vy + Math.sqrt(vy * vy + 2 * g * fall)) / g;
            const vh = reach / life;
            for (let i = 0; i < n; i++) {
              const j = 0.08 * (rand() - 0.5);
              spray.push({ origin: pos.clone(), params: [i / n + rand() * 0.02, life * (0.98 + rand() * 0.04), size, vy * (0.96 + rand() * 0.06)], tint: [dx * vh + j, dz * vh + j * (rand() - 0.5), 0, 0] });
            }
          };
          jet(s.height, 0, 0, 0, 0, 80, 0.085);
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const d = toWorld(Math.cos(a), 0, Math.sin(a));
            jet(s.height * 0.35, 1.4, d.x, d.z, s.radius, 16, 0.07);
          }
          break;
        }
        case 'fan': {
          const axis = s.nx !== undefined ? toWorld(s.nx, 0, s.nz ?? 0).normalize() : Y.clone();
          const q = new THREE.Quaternion().setFromUnitVectors(Y, axis);
          fans.push({ m: new THREE.Matrix4().compose(pos.clone(), q, new THREE.Vector3(s.radius, s.radius, s.radius)), spin: [s.speed, rand() * 6.28] });
          break;
        }
        case 'rotor': {
          const axis = toWorld(-Math.sin(s.rot), 0, -Math.cos(s.rot)).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(Y, axis);
          rotors.push({ m: new THREE.Matrix4().compose(pos.clone(), q, new THREE.Vector3(s.radius, s.radius, s.radius)), spin: [s.speed, rand() * 6.28] });
          break;
        }
        case 'brush': {
          const axis = s.horizontal ? toWorld(Math.cos(s.rot ?? 0), 0, -Math.sin(s.rot ?? 0)).normalize() : Y.clone();
          const q = new THREE.Quaternion().setFromUnitVectors(Y, axis);
          brushes.push({ m: new THREE.Matrix4().compose(pos.clone(), q, new THREE.Vector3(s.radius, s.height, s.radius)), spin: [s.speed, rand() * 6.28] });
          break;
        }
        case 'shuttle': {
          const q = lotQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, s.rot));
          const scale = s.part === 'gantry' ? new THREE.Vector3(s.size, 1, 1) : new THREE.Vector3(s.size, s.size, s.size);
          const travel = toWorld(s.dx, s.dy, s.dz);
          const entry = {
            m: new THREE.Matrix4().compose(pos.clone(), q, scale),
            move: [travel.x, travel.y, travel.z, s.speed],
            move2: [s.phase, s.loop ? 1 : 0],
            color: new THREE.Color(s.color),
          };
          (s.part === 'gantry' ? gantries : crates).push(entry);
          break;
        }
      }
    }

    // Smoke: one instanced quad per particle, all motion in the shader.
    if (smoke.length) {
      const g = new THREE.InstancedBufferGeometry();
      const quad = new THREE.PlaneGeometry(1, 1);
      g.index = quad.index;
      g.setAttribute('position', quad.getAttribute('position'));
      g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(smoke.flatMap((p) => p.origin.toArray())), 3));
      g.setAttribute('aParams', new THREE.InstancedBufferAttribute(new Float32Array(smoke.flatMap((p) => p.params)), 4));
      g.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(smoke.flatMap((p) => p.tint)), 4));
      g.instanceCount = smoke.length;
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uWind: { value: new THREE.Vector2() }, uNight: { value: 0 } }]),
        vertexShader: SMOKE_VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        depthWrite: false,
        fog: true,
      });
      // Share the live uniforms (merge() clones them).
      mat.uniforms.uTime = this.uTime;
      mat.uniforms.uWind = this.uWind;
      mat.uniforms.uNight = this.uNight;
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;
      this.root.add(mesh);
    }

    if (spray.length) {
      const g = new THREE.InstancedBufferGeometry();
      const quad = new THREE.PlaneGeometry(1, 1);
      g.index = quad.index;
      g.setAttribute('position', quad.getAttribute('position'));
      g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(spray.flatMap((p) => p.origin.toArray())), 3));
      g.setAttribute('aParams', new THREE.InstancedBufferAttribute(new Float32Array(spray.flatMap((p) => p.params)), 4));
      g.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(spray.flatMap((p) => p.tint)), 4));
      g.instanceCount = spray.length;
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }]),
        vertexShader: SPRAY_VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        depthWrite: false,
        fog: true,
      });
      mat.uniforms.uTime = this.uTime;
      mat.uniforms.uNight = this.uNight;
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;
      this.root.add(mesh);
    }

    const instanced = (geom: THREE.BufferGeometry, mat: THREE.Material, list: { m: THREE.Matrix4; color?: THREE.Color }[], attrs: Record<string, [number[], number]>) => {
      if (!list.length) return;
      const g = geom.clone();
      for (const [name, [data, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(data), size));
      const mesh = new THREE.InstancedMesh(g, mat, list.length);
      list.forEach((e, i) => {
        mesh.setMatrixAt(i, e.m);
        if (e.color) mesh.setColorAt(i, e.color);
      });
      mesh.frustumCulled = false; // the shader moves things beyond the static bounds
      this.root.add(mesh);
    };
    const t = this.templates;
    instanced(t.fan, spinMaterial(this.uTime), fans, { aSpin: [fans.flatMap((f) => f.spin), 2] });
    instanced(t.rotor, spinMaterial(this.uTime), rotors, { aSpin: [rotors.flatMap((f) => f.spin), 2] });
    instanced(t.brush, spinMaterial(this.uTime), brushes, { aSpin: [brushes.flatMap((f) => f.spin), 2] });
    instanced(t.gantry, moveMaterial(this.uTime), gantries, { aMove: [gantries.flatMap((g) => g.move), 4], aMove2: [gantries.flatMap((g) => g.move2), 2] });
    instanced(t.crate, moveMaterial(this.uTime), crates, { aMove: [crates.flatMap((c) => c.move), 4], aMove2: [crates.flatMap((c) => c.move2), 2] });

    this.count = smoke.length + spray.length + fans.length + rotors.length + brushes.length + gantries.length + crates.length;
  }
}
