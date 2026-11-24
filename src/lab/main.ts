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
import { generateMidrise } from '../buildings/types/midrise';
import { generateTower, type TowerDesign } from '../buildings/types/tower';
import { generateApartment, type ApartmentForm } from '../buildings/types/apartment';
import { generateRetail, type RetailForm } from '../buildings/types/retail';
import { drawLight } from '../buildings/mesher/propMesher';
import { MeshBuilder, col } from '../buildings/mesher/MeshBuilder';
import { createCityMaterials } from '../render/materials';
import { ChunkManager, type LotInstance } from '../render/chunks';
import { AnimationLayer } from '../render/animation';
import { generateIndustrial, type IndustrialForm } from '../buildings/types/industrial';
import { CIVIC_FORMS, civicLotSize, generateCivic, pickCivicForm, type CivicForm } from '../buildings/types/civic';
import type { ApartmentStyle, HouseStyle, MidriseStyle, RowStyle, TowerStyle } from '../buildings/styles/palettes';
import type { DetailOptions, HouseModel } from '../buildings/spec';

// URL options (handy for sharing a view): ?seed=1337&type=mid-rise&night=1&lots=20&cam=x,y,z,tx,ty,tz
const url = new URLSearchParams(location.search);

// ---------------------------------------------------------------- renderer / scene

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// The scene is static: compute shadows only when something changes, not every frame.
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.info.autoReset = false;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd6e8');
scene.fog = new THREE.Fog('#bcd6e8', 260, 650);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 1500);
// Default view: from beyond the end of the street, looking down it at both rows of front facades.
// Pulls back and up when the street has tall buildings, so towers fit in the frame.
let skyline = 20;
const homePos = () => {
  const k = Math.max(0, skyline - 30);
  return new THREE.Vector3(-streetLength / 2 - 45 - k * 0.9, 42 + k * 0.55, 20 + k * 0.5);
};
const homeTarget = () => new THREE.Vector3(-streetLength / 2 + 70, 4 + Math.max(0, skyline - 30) * 0.35, -2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
// Right-drag / two-finger drag pans along the ground; scrolling zooms towards the cursor.
controls.screenSpacePanning = false;
controls.zoomToCursor = true;
controls.minDistance = 1;
controls.maxDistance = 1500;
const camParam = url.get('cam')?.split(',').map(Number);
const customCam = camParam?.length === 6 && camParam.every(Number.isFinite);
if (customCam && camParam) {
  camera.position.set(camParam[0], camParam[1], camParam[2]);
  controls.target.set(camParam[3], camParam[4], camParam[5]);
}

const hemi = new THREE.HemisphereLight('#dfeeff', '#6b7a52', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3df', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const city = createCityMaterials();
const chunks = new ChunkManager(city);
scene.add(chunks.root);
// Smoke, fans, cranes, conveyors: GPU-animated, one draw call per kind.
const anim = new AnimationLayer();
scene.add(anim.root);

// Bloom only matters at night (bright lamps / lit windows / signs).
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.3, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- on-demand rendering
// Only draw when something changed (camera moved, scene rebuilt, settings changed).
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

type BuildingType = 'mixed street' | 'suburban houses' | 'row houses' | 'mid-rise' | 'apartments' | 'retail' | 'industrial' | 'civic' | 'office towers';
const CIVIC_GROUPS: Record<string, CivicForm[]> = {
  health: ['hospital', 'clinic'],
  education: ['primarySchool', 'highSchool', 'university'],
  public: ['stadium', 'trainStation', 'busStand', 'parkingGarage', 'fireStation', 'policeStation'],
  'parks & services': ['park', 'zoo', 'wasteYard', 'collectionPoint', 'utility'],
};
/** Small civic things that fit between ordinary buildings on a mixed street. */
const STREET_CIVIC: CivicForm[] = ['clinic', 'primarySchool', 'fireStation', 'policeStation', 'parkingGarage', 'park', 'collectionPoint', 'busStand'];
const urlSeed = Number(url.get('seed'));
const TYPES: BuildingType[] = ['mixed street', 'suburban houses', 'row houses', 'mid-rise', 'apartments', 'retail', 'industrial', 'civic', 'office towers'];
const params = {
  seed: Number.isFinite(urlSeed) && urlSeed > 0 ? urlSeed : 1337,
  type: (TYPES.find((t) => t === url.get('type')) ?? 'mixed street') as BuildingType,
  count: Number(url.get('lots')) || 16,
  houseStyle: 'mixed' as 'mixed' | HouseStyle,
  rowStyle: 'mixed' as 'mixed' | RowStyle,
  midriseStyle: 'mixed' as 'mixed' | MidriseStyle,
  towerStyle: 'mixed' as 'mixed' | TowerStyle,
  apartmentStyle: (url.get('aptStyle') ?? 'mixed') as 'mixed' | ApartmentStyle,
  apartmentForm: (url.get('form') ?? 'mixed') as 'mixed' | ApartmentForm,
  retailForm: (url.get('retail') ?? 'mixed') as 'mixed' | RetailForm,
  industrialForm: (url.get('industrial') ?? 'mixed') as 'mixed' | IndustrialForm,
  civicForm: url.get('civic') ?? 'mixed',
  animate: url.get('animate') !== '0',
  towerDesign: (url.get('design') ?? 'mixed') as 'mixed' | TowerDesign,
  waterTanks: 0.4,
  props: 1,
  cars: 0.5,
  labels: url.get('labels') !== '0',
  night: url.get('night') === '1',
  quality: 'balanced' as Quality,
  lodDistance: 150,
  sunAzimuth: 35,
  sunElevation: 48,
  newSeed: () => {
    params.seed = Math.floor(Math.random() * 99999) + 1;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    regenerate();
  },
  overview: () => focusOn(null),
  streetView: () => streetView(),
};

const gui = new GUI({ title: 'Building Lab' });
gui.add(params, 'seed', 1, 99999, 1).onFinishChange(regenerate);
gui.add(params, 'newSeed').name('🎲 New seed');
gui.add(params, 'type', TYPES).name('building type').onChange(regenerate);
gui.add(params, 'count', 4, 60, 2).name('lots').onFinishChange(regenerate);
gui.add(params, 'houseStyle', ['mixed', 'traditional', 'ranch', 'modern']).name('house style').onChange(regenerate);
gui.add(params, 'rowStyle', ['mixed', 'brownstone', 'terrace', 'modernTown']).name('row style').onChange(regenerate);
gui.add(params, 'midriseStyle', ['mixed', 'southAsian', 'mainStreet', 'modern']).name('mid-rise style').onChange(regenerate);
gui.add(params, 'apartmentStyle', ['mixed', 'panel', 'modern', 'southAsian', 'brick']).name('apartment style').onChange(regenerate);
gui.add(params, 'apartmentForm', ['mixed', 'slab', 'tower', 'lBlock', 'courtyard']).name('apartment form').onChange(regenerate);
gui.add(params, 'retailForm', ['mixed', 'stripMall', 'bigBox', 'gasStation', 'bazaar', 'carDealer']).name('retail form').onChange(regenerate);
gui.add(params, 'industrialForm', ['mixed', 'warehouse', 'factory']).name('industrial form').onChange(regenerate);
gui.add(params, 'civicForm', ['mixed', ...Object.keys(CIVIC_GROUPS), ...CIVIC_FORMS]).name('civic form').onChange(regenerate);
gui.add(params, 'towerStyle', ['mixed', 'glass', 'stone']).name('tower style').onChange(regenerate);
gui.add(params, 'towerDesign', ['mixed', 'classic', 'spiral', 'flame', 'stacked', 'rotating', 'yTower']).name('tower design').onChange(regenerate);
const det = gui.addFolder('Details');
det.add(params, 'waterTanks', 0, 1, 0.05).name('water tanks').onFinishChange(regenerate);
det.add(params, 'props', 0, 2, 0.1).name('yard props').onFinishChange(regenerate);
det.add(params, 'cars', 0, 1, 0.05).name('parked cars').onFinishChange(regenerate);
const view = gui.addFolder('View');
view.add(params, 'night').name('🌙 night').onChange(applyTimeOfDay);
view.add(params, 'animate').name('▶ animations').onChange(() => requestRender());
view.add(params, 'quality', ['low', 'balanced', 'high']).name('quality').onChange(applyQuality);
view.add(params, 'lodDistance', 40, 600, 10).name('detail distance').onChange((v: number) => {
  chunks.lodDistance = v;
  if (chunks.update(camera.position)) requestRender(true);
});
view.add(params, 'labels').onChange((v: boolean) => {
  labels.visible = v;
  requestRender();
});
view.add(params, 'sunAzimuth', 0, 360, 1).name('sun azimuth').onChange(updateSun);
view.add(params, 'sunElevation', 5, 85, 1).name('sun elevation').onChange(updateSun);
gui.add(params, 'overview').name('↺ Overview');
gui.add(params, 'streetView').name('🚶 Street view');
const statsEl = document.createElement('div');
statsEl.style.cssText = 'padding:6px 8px;font-size:11px;opacity:.85;line-height:1.5';
gui.domElement.appendChild(statsEl);

function updateSun(): void {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth);
  const el = THREE.MathUtils.degToRad(params.sunElevation);
  const r = 300;
  sun.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r);
  sun.target.position.set(0, 0, 0);
  const cam = sun.shadow.camera;
  const ext = streetLength / 2 + 25;
  cam.left = -ext;
  cam.right = ext;
  cam.top = ext;
  cam.bottom = -ext;
  cam.near = 1;
  cam.far = 800;
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
  city.setNight(night);
  anim.setNight(night);
  bloom.enabled = night;
  groundMat.color.set(night ? '#3c4a33' : '#86a862');
  requestRender(true);
}

// ---------------------------------------------------------------- street layout

const STREET = { asphalt: 4, curb: 0.2, verge: 1.2, sidewalk: 1.6 };
const LOT_EDGE = STREET.asphalt + STREET.curb + STREET.verge + STREET.sidewalk; // 7.0
const LOT_LIFT = 0.14;

let lots: LotInstance[] = [];
let streetGroup: THREE.Group | null = null;
let streetLength = 200;
const labels = new THREE.Group();
scene.add(labels);
const groundMat = new THREE.MeshStandardMaterial({ color: '#86a862', roughness: 1 });

type LotKind = 'house' | 'row' | 'midrise' | 'apartment' | 'retail' | 'industrial' | 'civic' | 'tower';
interface LotPlan {
  kind: LotKind;
  w: number;
  d: number;
  civic?: CivicForm;
}

function civicPool(): CivicForm[] {
  const v = params.civicForm;
  if (v in CIVIC_GROUPS) return CIVIC_GROUPS[v];
  if ((CIVIC_FORMS as string[]).includes(v)) return [v as CivicForm];
  return CIVIC_FORMS;
}

function planLot(rng: RNG): LotPlan {
  const kind: LotKind =
    params.type === 'suburban houses' ? 'house'
      : params.type === 'row houses' ? 'row'
        : params.type === 'mid-rise' ? 'midrise'
          : params.type === 'office towers' ? 'tower'
            : params.type === 'apartments' ? 'apartment'
              : params.type === 'retail' ? 'retail'
                : params.type === 'industrial' ? 'industrial'
                  : params.type === 'civic' ? 'civic'
                    : rng.weighted<LotKind>([['house', 30], ['row', 19], ['midrise', 17], ['apartment', 12], ['retail', 9], ['industrial', 6], ['civic', 6], ['tower', 7]]);
  if (kind === 'civic') {
    const form = pickCivicForm(rng, params.type === 'civic' ? civicPool() : STREET_CIVIC);
    return { kind, civic: form, ...civicLotSize(rng, form) };
  }
  if (kind === 'house') return { kind, w: rng.range(18, 26), d: rng.range(34, 40) };
  if (kind === 'row') return { kind, w: rng.range(28, 46), d: rng.range(28, 34) };
  if (kind === 'midrise') return { kind, w: rng.range(20, 36), d: rng.range(26, 34) };
  if (kind === 'apartment') return { kind, w: rng.range(34, 60), d: rng.range(36, 52) };
  if (kind === 'industrial') return { kind, w: rng.range(55, 90), d: rng.range(60, 85) };
  if (kind === 'retail') {
    // Some retail forms need big lots; the generator falls back to a strip mall on small ones.
    const big = rng.chance(0.3);
    return { kind, w: big ? rng.range(60, 85) : rng.range(26, 55), d: big ? rng.range(60, 80) : rng.range(28, 50) };
  }
  return { kind, w: rng.range(40, 60), d: rng.range(45, 60) };
}

function generateLot(plan: LotPlan, seed: number, details: DetailOptions): HouseModel {
  const pick = <T extends string>(v: 'mixed' | T) => (v === 'mixed' ? undefined : v);
  if (plan.kind === 'house') return generateHouse({ seed, lotWidth: plan.w, lotDepth: plan.d, style: pick(params.houseStyle), details });
  if (plan.kind === 'row') return generateRowhouses({ seed, lotWidth: plan.w, lotDepth: plan.d, style: pick(params.rowStyle), details });
  if (plan.kind === 'civic') return generateCivic({ seed, lotWidth: plan.w, lotDepth: plan.d, form: plan.civic!, details });
  if (plan.kind === 'industrial') return generateIndustrial({ seed, lotWidth: plan.w, lotDepth: plan.d, form: pick(params.industrialForm), details });
  if (plan.kind === 'retail') return generateRetail({ seed, lotWidth: plan.w, lotDepth: plan.d, form: pick(params.retailForm), details });
  if (plan.kind === 'apartment') return generateApartment({ seed, lotWidth: plan.w, lotDepth: plan.d, style: pick(params.apartmentStyle), form: pick(params.apartmentForm), details });
  if (plan.kind === 'midrise') return generateMidrise({ seed, lotWidth: plan.w, lotDepth: plan.d, style: pick(params.midriseStyle), details });
  return generateTower({ seed, lotWidth: plan.w, lotDepth: plan.d, style: pick(params.towerStyle), design: pick(params.towerDesign), details });
}

function regenerate(): void {
  const t0 = performance.now();
  labels.children.forEach((l) => (l as CSS2DObject).element.remove());
  labels.clear();
  if (streetGroup) {
    streetGroup.traverse((o) => o instanceof THREE.Mesh && o.geometry !== groundGeom && o.geometry.dispose());
    streetGroup.removeFromParent();
  }
  history.replaceState(null, '', `?seed=${params.seed}`);

  const rng = new RNG(params.seed);
  const n = params.count;
  const plans = Array.from({ length: n }, () => planLot(rng));
  const north = plans.slice(0, Math.ceil(n / 2));
  const south = plans.slice(Math.ceil(n / 2));
  const rowLen = (row: LotPlan[]) => row.reduce((s, l) => s + l.w, 0);
  streetLength = Math.max(rowLen(north), rowLen(south)) + 30;
  const details: DetailOptions = { waterTanks: params.waterTanks, props: params.props, cars: params.cars };

  lots = [];
  let index = 0;
  for (const [row, sideSign] of [[north, 1], [south, -1]] as const) {
    let x = -rowLen(row) / 2;
    for (const plan of row) {
      const model = generateLot(plan, hashSeed(params.seed, index), details);
      const matrix =
        sideSign > 0
          ? new THREE.Matrix4().makeTranslation(x, LOT_LIFT, LOT_EDGE)
          : new THREE.Matrix4().makeTranslation(x + plan.w, LOT_LIFT, -LOT_EDGE).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
      lots.push({ index, model, matrix });
      x += plan.w;
      index++;
    }
  }
  const tGen = performance.now();
  chunks.lodDistance = params.lodDistance;
  chunks.build(lots, { apronDepth: LOT_EDGE - STREET.asphalt, streetTreeZ: -(STREET.sidewalk + STREET.verge / 2) });
  chunks.update(camera.position);
  skyline = Math.max(...lots.map((l) => l.bounds!.max.y));
  anim.build(lots.flatMap((l) => (l.model.animated ?? []).map((spec) => ({ spec, matrix: l.matrix }))));
  // Tall skylines need the haze pushed back or distant towers wash out.
  const fog = scene.fog as THREE.Fog;
  fog.near = 260 + skyline * 1.5;
  fog.far = 650 + skyline * 3;

  // Labels above each lot.
  for (const lot of lots) {
    const b = lot.bounds!;
    const el = document.createElement('div');
    el.className = 'house-label';
    el.textContent = `#${lot.index + 1}`;
    const label = new CSS2DObject(el);
    label.position.set((b.min.x + b.max.x) / 2, b.max.y + 1.5, (b.min.z + b.max.z) / 2);
    labels.add(label);
  }
  labels.visible = params.labels;

  streetGroup = buildStreet(streetLength);
  scene.add(streetGroup);
  updateSun();
  const s = chunks.stats();
  buildInfo = `${lots.length} lots · ${s.chunks} chunks · near ${(s.trisNear / 1000).toFixed(0)}k / far ${(s.trisFar / 1000).toFixed(0)}k tris<br>generate ${(tGen - t0).toFixed(0)} ms · mesh ${(performance.now() - tGen).toFixed(0)} ms`;
  statsEl.innerHTML = buildInfo;
}
let buildInfo = '';

const groundGeom = new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2);
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
    for (const xs of [-L, L]) b.box('solid', xs - 0.02, 0.15, z2, xs + 0.02, 0.152, z3, col('#bdb8ad'));
    for (let x = -L + (s > 0 ? 8 : 20); x < L - 4; x += 24) {
      drawLight(b, { kind: 'streetLamp', x, y: 0.12, z: s * (STREET.asphalt + STREET.curb + 0.35), rot: s > 0 ? 0 : Math.PI });
    }
  }
  for (let x = -L + 1; x < L - 3; x += 6) b.box('solid', x, 0.0, -0.08, x + 3, 0.012, 0.08, col('#e8d36a'));
  const g = b.build(city.materials, city.depthMaterials);
  const ground = new THREE.Mesh(groundGeom, groundMat);
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

function pick(ev: PointerEvent): LotInstance | null {
  pointer.set((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return chunks.pick(raycaster.ray);
}

let hoverQueued: PointerEvent | null = null;
renderer.domElement.addEventListener('pointermove', (ev) => (hoverQueued = ev));
function updateHover(): void {
  const ev = hoverQueued;
  hoverQueued = null;
  if (!ev) return;
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
}
renderer.domElement.addEventListener('pointerdown', (ev) => (downPos = { x: ev.clientX, y: ev.clientY }));
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y) > 4) return;
  const h = pick(ev);
  if (h) focusOn(h);
});

// Smooth camera fly-to
let fly: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null = null;

// ---------------------------------------------------------------- keyboard movement
// WASD / arrows move across the ground in the direction you face, Q/E (or PgDn/PgUp) go down/up,
// Shift = 3x faster. Speed scales with how far out you are zoomed.
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement | null)?.closest?.('input, select, textarea')) return;
  if (MOVE_KEYS.has(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'PageUp', 'PageDown', 'ShiftLeft', 'ShiftRight']);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function applyKeys(dt: number): boolean {
  if (!keys.size) return false;
  const k = (...codes: string[]) => codes.some((c) => keys.has(c));
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _right.crossVectors(_fwd, UP).normalize();
  _move.set(0, 0, 0);
  if (k('KeyW', 'ArrowUp')) _move.add(_fwd);
  if (k('KeyS', 'ArrowDown')) _move.sub(_fwd);
  if (k('KeyD', 'ArrowRight')) _move.add(_right);
  if (k('KeyA', 'ArrowLeft')) _move.sub(_right);
  const vert = (k('KeyE', 'PageUp') ? 1 : 0) - (k('KeyQ', 'PageDown') ? 1 : 0);
  if (_move.lengthSq() === 0 && vert === 0) return false;
  const dist = camera.position.distanceTo(controls.target);
  const speed = THREE.MathUtils.clamp(dist * 0.9, 5, 300) * (k('ShiftLeft', 'ShiftRight') ? 3 : 1) * dt;
  if (_move.lengthSq() > 0) _move.normalize().multiplyScalar(speed);
  _move.y = vert * speed * 0.6;
  camera.position.add(_move);
  controls.target.add(_move);
  // Stay above the ground.
  if (camera.position.y < 1.2) {
    const d = 1.2 - camera.position.y;
    camera.position.y += d;
    controls.target.y += d;
  }
  fly = null;
  return true;
}

/** Drop to eye level on the nearest sidewalk, looking down the street. */
function streetView(): void {
  const side = camera.position.z >= 0 ? 1 : -1;
  const z = side * (LOT_EDGE - STREET.sidewalk / 2);
  const x = THREE.MathUtils.clamp(controls.target.x, -streetLength / 2 + 5, streetLength / 2 - 5);
  const toPos = new THREE.Vector3(x - 12, 1.7, z);
  const toT = new THREE.Vector3(x + 8, 3.5, z * 0.4);
  fly = { fromPos: camera.position.clone(), toPos, fromT: controls.target.clone(), toT, t: 0 };
}
function focusOn(h: LotInstance | null): void {
  let toT: THREE.Vector3;
  let toPos: THREE.Vector3;
  if (h) {
    const b = h.bounds!;
    const centre = b.getCenter(new THREE.Vector3());
    const height = b.max.y;
    toT = centre.clone().setY(Math.min(height * 0.45, 12));
    const facing = centre.z > 0 ? -1 : 1; // look at the front, from the street
    const dist = 22 + height * 0.9;
    toPos = centre.clone().add(new THREE.Vector3(dist * 0.35, 8 + height * 0.5, facing * dist));
  } else {
    toT = homeTarget();
    toPos = homePos();
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
if (!customCam) {
  camera.position.copy(homePos());
  controls.target.copy(homeTarget());
}
applyTimeOfDay();
applyQuality(params.quality);
const timer = new THREE.Timer();
let frames = 0;
let animAccum = 0;
let fpsTime = 0;
let lastCalls = 0;
let lastTris = 0;
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
  if (applyKeys(dt)) moving = true;
  // Animated parts: advance time; when only they change, redraw at most 30 times a second.
  if (params.animate && anim.count > 0) {
    anim.update(dt);
    animAccum += dt;
    if (animAccum >= 1 / 30) {
      animAccum = 0;
      needsRender = true;
    }
  }
  if (controls.update()) moving = true; // true while the camera is still gliding (damping)
  if (moving && chunks.update(camera.position)) requestRender(true);
  updateHover();
  if (moving || needsRender) {
    needsRender = false;
    renderer.info.reset();
    composer.render();
    labelRenderer.render(scene, camera);
    lastCalls = renderer.info.render.calls;
    lastTris = renderer.info.render.triangles;
    frames++;
  }
  fpsTime += dt;
  if (fpsTime >= 1) {
    const s = chunks.stats();
    const fps = (frames ? `${Math.round(frames / fpsTime)} fps` : 'idle (0 fps)') + (params.animate && anim.count ? ` · ${anim.count} animated` : '');
    statsEl.innerHTML = `${buildInfo}<br>${fps} · ${lastCalls} draw calls · ${(lastTris / 1000).toFixed(0)}k tris drawn · ${s.near}/${s.chunks} chunks near`;
    frames = 0;
    fpsTime = 0;
  }
});
