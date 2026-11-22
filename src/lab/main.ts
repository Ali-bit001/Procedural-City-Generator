import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import { RNG, hashSeed } from '../core/rng';
import { generateHouse } from '../buildings/types/house';
import { generateRowhouses } from '../buildings/types/rowhouse';
import { buildHouseMesh } from '../buildings/mesher/houseMesher';
import { drawLight } from '../buildings/mesher/propMesher';
import { MeshBuilder, col, type BucketName } from '../buildings/mesher/MeshBuilder';
import type { HouseStyle, RowStyle } from '../buildings/styles/palettes';
import type { DetailOptions, HouseModel } from '../buildings/spec';

// ---------------------------------------------------------------- renderer / scene

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// The scene is static: compute shadows only when something changes, not every frame.
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd6e8');
scene.fog = new THREE.Fog('#bcd6e8', 220, 520);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 1500);
camera.position.set(-40, 75, 135);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 0, 0);

const hemi = new THREE.HemisphereLight('#dfeeff', '#6b7a52', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3df', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const materials: Record<BucketName, THREE.MeshStandardMaterial> = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.5, envMapIntensity: 1.6 }),
  glassLit: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.5, envMapIntensity: 1.6, emissive: '#ffbf6e', emissiveIntensity: 0 }),
  water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.4 }),
  lamp: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#ffd59a', emissiveIntensity: 0 }),
};

// Bloom only matters at night (bright lamps / lit windows).
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- on-demand rendering
// Only draw when something changed (camera moved, scene rebuilt, settings changed).
// An idle Lab then uses ~0% GPU instead of redrawing 60 times a second.
let needsRender = true;
function requestRender(shadows = false): void {
  needsRender = true;
  if (shadows) renderer.shadowMap.needsUpdate = true;
}
controls.addEventListener('change', () => requestRender());

type Quality = 'low' | 'balanced' | 'high';
const QUALITY: Record<Quality, { pixelRatio: number; shadowSize: number }> = {
  low: { pixelRatio: 1, shadowSize: 2048 },
  balanced: { pixelRatio: Math.min(window.devicePixelRatio, 1.25), shadowSize: 4096 },
  high: { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowSize: 4096 },
};
function applyQuality(q: Quality): void {
  const s = QUALITY[q];
  renderer.setPixelRatio(s.pixelRatio);
  composer.setPixelRatio(s.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  if (sun.shadow.mapSize.x !== s.shadowSize) {
    sun.shadow.mapSize.set(s.shadowSize, s.shadowSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  requestRender(true);
}

// ---------------------------------------------------------------- params / GUI

type BuildingType = 'mixed street' | 'suburban houses' | 'row houses';
const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
const params = {
  seed: Number.isFinite(urlSeed) && urlSeed > 0 ? urlSeed : 1337,
  type: 'mixed street' as BuildingType,
  count: 16,
  houseStyle: 'mixed' as 'mixed' | HouseStyle,
  rowStyle: 'mixed' as 'mixed' | RowStyle,
  waterTanks: 0.4,
  props: 1,
  cars: 0.5,
  labels: true,
  night: false,
  quality: 'balanced' as Quality,
  sunAzimuth: 35,
  sunElevation: 48,
  newSeed: () => {
    params.seed = Math.floor(Math.random() * 99999) + 1;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    regenerate();
  },
  overview: () => focusOn(null),
};

const gui = new GUI({ title: 'Building Lab' });
gui.add(params, 'seed', 1, 99999, 1).onFinishChange(regenerate);
gui.add(params, 'newSeed').name('🎲 New seed');
gui.add(params, 'type', ['mixed street', 'suburban houses', 'row houses']).name('building type').onChange(regenerate);
gui.add(params, 'count', 4, 40, 2).name('lots').onFinishChange(regenerate);
gui.add(params, 'houseStyle', ['mixed', 'traditional', 'ranch', 'modern']).name('house style').onChange(regenerate);
gui.add(params, 'rowStyle', ['mixed', 'brownstone', 'terrace', 'modernTown']).name('row style').onChange(regenerate);
const det = gui.addFolder('Details');
det.add(params, 'waterTanks', 0, 1, 0.05).name('water tanks').onFinishChange(regenerate);
det.add(params, 'props', 0, 2, 0.1).name('yard props').onFinishChange(regenerate);
det.add(params, 'cars', 0, 1, 0.05).name('parked cars').onFinishChange(regenerate);
const view = gui.addFolder('View');
view.add(params, 'night').name('🌙 night').onChange(applyTimeOfDay);
view.add(params, 'quality', ['low', 'balanced', 'high']).name('quality').onChange(applyQuality);
view.add(params, 'labels').onChange((v: boolean) => {
  houses.forEach((h) => (h.label.visible = v));
  requestRender();
});
view.add(params, 'sunAzimuth', 0, 360, 1).name('sun azimuth').onChange(updateSun);
view.add(params, 'sunElevation', 5, 85, 1).name('sun elevation').onChange(updateSun);
gui.add(params, 'overview').name('↺ Overview');
const statsEl = document.createElement('div');
statsEl.style.cssText = 'padding:6px 8px;font-size:11px;opacity:.8';
gui.domElement.appendChild(statsEl);

function updateSun(): void {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth);
  const el = THREE.MathUtils.degToRad(params.sunElevation);
  const r = 220;
  sun.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r);
  sun.target.position.set(0, 0, 0);
  const cam = sun.shadow.camera;
  const ext = streetLength / 2 + 20;
  cam.left = -ext;
  cam.right = ext;
  cam.top = ext;
  cam.bottom = -ext;
  cam.near = 1;
  cam.far = 600;
  cam.updateProjectionMatrix();
  requestRender(true);
}

function applyTimeOfDay(): void {
  const night = params.night;
  const sky = new THREE.Color(night ? '#0b1222' : '#bcd6e8');
  scene.background = sky;
  (scene.fog as THREE.Fog).color.copy(sky);
  hemi.color.set(night ? '#2a3a66' : '#dfeeff');
  hemi.groundColor.set(night ? '#0b0f18' : '#6b7a52');
  hemi.intensity = night ? 0.45 : 1.1;
  sun.color.set(night ? '#9fb6ff' : '#fff3df');
  sun.intensity = night ? 0.35 : 2.6;
  scene.environmentIntensity = night ? 0.06 : 0.35;
  materials.lamp.emissiveIntensity = night ? 5 : 0;
  materials.glassLit.emissiveIntensity = night ? 1.4 : 0;
  bloom.enabled = night;
  groundMat.color.set(night ? '#3c4a33' : '#86a862');
  requestRender(true);
}

// ---------------------------------------------------------------- street layout

const STREET = { asphalt: 4, curb: 0.2, verge: 1.2, sidewalk: 1.6 };
const LOT_EDGE = STREET.asphalt + STREET.curb + STREET.verge + STREET.sidewalk; // 7.0
const LOT_LIFT = 0.14;

interface HouseEntry {
  index: number;
  model: HouseModel;
  group: THREE.Group;
  label: CSS2DObject;
  centre: THREE.Vector3;
}

let houses: HouseEntry[] = [];
let streetGroup: THREE.Group | null = null;
let streetLength = 200;
const world = new THREE.Group();
scene.add(world);
const groundMat = new THREE.MeshStandardMaterial({ color: '#86a862', roughness: 1 });

function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
    if (o instanceof CSS2DObject) o.element.remove();
  });
  g.removeFromParent();
}

interface LotPlan {
  kind: 'house' | 'row';
  w: number;
  d: number;
}

function regenerate(): void {
  houses.forEach((h) => disposeGroup(h.group));
  houses = [];
  if (streetGroup) disposeGroup(streetGroup);
  history.replaceState(null, '', `?seed=${params.seed}`);

  const rng = new RNG(params.seed);
  const n = params.count;
  const lots: LotPlan[] = Array.from({ length: n }, () => {
    const kind: LotPlan['kind'] =
      params.type === 'suburban houses' ? 'house' : params.type === 'row houses' ? 'row' : rng.chance(0.4) ? 'row' : 'house';
    return kind === 'house' ? { kind, w: rng.range(18, 26), d: rng.range(34, 40) } : { kind, w: rng.range(28, 46), d: rng.range(28, 34) };
  });
  const north = lots.slice(0, Math.ceil(n / 2));
  const south = lots.slice(Math.ceil(n / 2));
  const rowLen = (row: LotPlan[]) => row.reduce((s, l) => s + l.w, 0);
  streetLength = Math.max(rowLen(north), rowLen(south)) + 30;
  const details: DetailOptions = { waterTanks: params.waterTanks, props: params.props, cars: params.cars };

  let triangles = 0;
  let index = 0;
  for (const [row, sideSign] of [[north, 1], [south, -1]] as const) {
    let x = -rowLen(row) / 2;
    for (const lot of row) {
      const seed = hashSeed(params.seed, index);
      const model =
        lot.kind === 'house'
          ? generateHouse({ seed, lotWidth: lot.w, lotDepth: lot.d, style: params.houseStyle === 'mixed' ? undefined : params.houseStyle, details })
          : generateRowhouses({ seed, lotWidth: lot.w, lotDepth: lot.d, style: params.rowStyle === 'mixed' ? undefined : params.rowStyle, details });
      const { group, triangles: t } = buildHouseMesh(model, materials, {
        apronDepth: LOT_EDGE - STREET.asphalt,
        streetTreeZ: -(STREET.sidewalk + STREET.verge / 2),
      });
      triangles += t;
      if (sideSign > 0) {
        group.position.set(x, LOT_LIFT, LOT_EDGE);
      } else {
        group.rotation.y = Math.PI;
        group.position.set(x + lot.w, LOT_LIFT, -LOT_EDGE);
      }
      world.add(group);
      group.updateMatrixWorld(true);

      const rs = model.masses.map((m) => m.rect);
      const localCentre = new THREE.Vector3(
        (Math.min(...rs.map((r) => r.x0)) + Math.max(...rs.map((r) => r.x1))) / 2,
        0,
        (Math.min(...rs.map((r) => r.z0)) + Math.max(...rs.map((r) => r.z1))) / 2,
      );
      const centre = group.localToWorld(localCentre.clone());
      const el = document.createElement('div');
      el.className = 'house-label';
      el.textContent = `#${index + 1}`;
      const label = new CSS2DObject(el);
      label.position.set(localCentre.x, lot.kind === 'row' ? 17 : 12.5, localCentre.z);
      label.visible = params.labels;
      group.add(label);

      group.userData.house = index;
      houses.push({ index, model, group, label, centre });
      x += lot.w;
      index++;
    }
  }

  streetGroup = buildStreet(streetLength);
  world.add(streetGroup);
  updateSun();
  sceneStats = `${houses.length} lots · ${(triangles / 1000).toFixed(0)}k triangles`;
  statsEl.textContent = sceneStats;
}
let sceneStats = '';

function buildStreet(length: number): THREE.Group {
  const b = new MeshBuilder();
  const L = length / 2;
  const asphalt = col('#4a4d52');
  const curb = col('#b9b6ae');
  const verge = col('#78a54f');
  const walk = col('#cfcac0');
  b.box('solid', -L, -0.1, -STREET.asphalt, L, 0.0, STREET.asphalt, asphalt);
  for (const s of [1, -1]) {
    const z0 = s * STREET.asphalt;
    const z1 = s * (STREET.asphalt + STREET.curb);
    const z2 = s * (STREET.asphalt + STREET.curb + STREET.verge);
    const z3 = s * LOT_EDGE;
    b.box('solid', -L, -0.1, z0, L, 0.15, z1, curb);
    b.box('solid', -L, -0.1, z1, L, 0.12, z2, verge);
    b.box('solid', -L, -0.1, z2, L, 0.15, z3, walk);
    // sidewalk joints
    for (let x = -L; x < L; x += 1.6) b.box('solid', x, 0.15, z2, x + 0.04, 0.152, z3, col('#bdb8ad'));
    // street lamps, staggered on the two sides, arm reaching over the road
    for (let x = -L + (s > 0 ? 8 : 20); x < L - 4; x += 24) {
      drawLight(b, { kind: 'streetLamp', x, y: 0.12, z: s * (STREET.asphalt + STREET.curb + 0.35), rot: s > 0 ? 0 : Math.PI });
    }
  }
  // centre-line dashes
  for (let x = -L + 1; x < L - 3; x += 6) b.box('solid', x, 0.0, -0.08, x + 3, 0.012, 0.08, col('#e8d36a'));
  const g = b.build(materials);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = -0.11;
  ground.receiveShadow = true;
  g.add(ground);
  return g;
}

// ---------------------------------------------------------------- interaction

const tooltip = document.getElementById('tooltip')!;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = { x: 0, y: 0 };

function pick(ev: PointerEvent): HouseEntry | null {
  pointer.set((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(houses.map((h) => h.group), true);
  for (const hit of hits) {
    let o: THREE.Object3D | null = hit.object;
    while (o && o.userData.house === undefined) o = o.parent;
    if (o) return houses[o.userData.house as number];
  }
  return null;
}

renderer.domElement.addEventListener('pointermove', (ev) => {
  const h = pick(ev);
  if (!h) {
    tooltip.style.display = 'none';
    renderer.domElement.style.cursor = '';
    return;
  }
  renderer.domElement.style.cursor = 'pointer';
  const info = Object.entries(h.model.info)
    .map(([k, v]) => `<span style="opacity:.65">${k}</span> ${v}`)
    .join('<br>');
  tooltip.innerHTML = `<b>Lot #${h.index + 1}</b> <span style="opacity:.6">seed ${h.model.seed}</span><br>${info}`;
  tooltip.style.display = 'block';
  tooltip.style.left = `${ev.clientX + 14}px`;
  tooltip.style.top = `${ev.clientY + 14}px`;
});
renderer.domElement.addEventListener('pointerdown', (ev) => (downPos = { x: ev.clientX, y: ev.clientY }));
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y) > 4) return;
  const h = pick(ev);
  if (h) focusOn(h);
});

// Smooth camera fly-to
let fly: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null = null;
function focusOn(h: HouseEntry | null): void {
  const toT = h ? h.centre.clone().setY(3) : new THREE.Vector3(0, 0, 0);
  let toPos: THREE.Vector3;
  if (h) {
    const facing = h.centre.z > 0 ? -1 : 1; // look at the front of the house, from the street
    toPos = h.centre.clone().add(new THREE.Vector3(10, 14, facing * 28));
  } else {
    toPos = new THREE.Vector3(-40, 75, 135);
  }
  fly = { fromPos: camera.position.clone(), toPos, fromT: controls.target.clone(), toT, t: 0 };
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  requestRender();
});

// ---------------------------------------------------------------- loop

regenerate();
applyTimeOfDay();
applyQuality(params.quality);
const timer = new THREE.Timer();
let frames = 0;
let fpsTime = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = timer.getDelta();
  let moving = false;
  if (fly) {
    fly.t = Math.min(1, fly.t + dt * 1.2);
    const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
    camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    if (fly.t >= 1) fly = null;
    moving = true;
  }
  if (controls.update()) moving = true; // true while the camera is still gliding (damping)
  if (moving || needsRender) {
    needsRender = false;
    composer.render();
    labelRenderer.render(scene, camera);
    frames++;
  }
  fpsTime += dt;
  if (fpsTime >= 1) {
    statsEl.textContent = `${sceneStats} · ${frames ? `${Math.round(frames / fpsTime)} fps` : 'idle (0 fps)'}`;
    frames = 0;
    fpsTime = 0;
  }
});
