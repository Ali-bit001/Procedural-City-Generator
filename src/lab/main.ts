import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import GUI from 'lil-gui';
import { RNG, hashSeed } from '../core/rng';
import { generateHouse } from '../buildings/types/house';
import { buildHouseMesh } from '../buildings/mesher/houseMesher';
import { MeshBuilder, col, type BucketName } from '../buildings/mesher/MeshBuilder';
import type { HouseStyle } from '../buildings/styles/palettes';
import type { HouseModel } from '../buildings/spec';

// ---------------------------------------------------------------- renderer / scene

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
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

const materials: Record<BucketName, THREE.Material> = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.5, envMapIntensity: 1.6 }),
  water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.4 }),
};

// ---------------------------------------------------------------- params / GUI

const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
const params = {
  seed: Number.isFinite(urlSeed) && urlSeed > 0 ? urlSeed : 1337,
  count: 20,
  style: 'mixed' as 'mixed' | HouseStyle,
  labels: true,
  sunAzimuth: 35,
  sunElevation: 48,
  newSeed: () => {
    params.seed = Math.floor(Math.random() * 99999) + 1;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    regenerate();
  },
  overview: () => focusOn(null),
};

const gui = new GUI({ title: 'Building Lab · Suburban houses' });
gui.add(params, 'seed', 1, 99999, 1).onFinishChange(regenerate);
gui.add(params, 'newSeed').name('🎲 New seed');
gui.add(params, 'count', 4, 40, 2).name('houses').onFinishChange(regenerate);
gui.add(params, 'style', ['mixed', 'traditional', 'ranch', 'modern']).onChange(regenerate);
gui.add(params, 'labels').onChange((v: boolean) => houses.forEach((h) => (h.label.visible = v)));
const sunFolder = gui.addFolder('Sun');
sunFolder.add(params, 'sunAzimuth', 0, 360, 1).name('azimuth').onChange(updateSun);
sunFolder.add(params, 'sunElevation', 5, 85, 1).name('elevation').onChange(updateSun);
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

function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
    if (o instanceof CSS2DObject) o.element.remove();
  });
  g.removeFromParent();
}

function regenerate(): void {
  houses.forEach((h) => disposeGroup(h.group));
  houses = [];
  if (streetGroup) disposeGroup(streetGroup);
  history.replaceState(null, '', `?seed=${params.seed}`);

  const rng = new RNG(params.seed);
  const n = params.count;
  const lots = Array.from({ length: n }, () => ({ w: rng.range(18, 26), d: rng.range(34, 40) }));
  const north = lots.slice(0, Math.ceil(n / 2));
  const south = lots.slice(Math.ceil(n / 2));
  const rowLen = (row: typeof lots) => row.reduce((s, l) => s + l.w, 0);
  streetLength = Math.max(rowLen(north), rowLen(south)) + 30;

  let triangles = 0;
  let index = 0;
  for (const [row, sideSign] of [[north, 1], [south, -1]] as const) {
    let x = -rowLen(row) / 2;
    for (const lot of row) {
      const seed = hashSeed(params.seed, index);
      const model = generateHouse({
        seed,
        lotWidth: lot.w,
        lotDepth: lot.d,
        style: params.style === 'mixed' ? undefined : params.style,
      });
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

      const main = model.masses[0].rect;
      const localCentre = new THREE.Vector3((main.x0 + main.x1) / 2, 0, (main.z0 + main.z1) / 2);
      const centre = group.localToWorld(localCentre.clone());
      const el = document.createElement('div');
      el.className = 'house-label';
      el.textContent = `#${index + 1}`;
      const label = new CSS2DObject(el);
      label.position.set(localCentre.x, 12.5, localCentre.z);
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
  statsEl.textContent = `${houses.length} houses · ${(triangles / 1000).toFixed(0)}k triangles`;
}

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
  }
  // centre-line dashes
  for (let x = -L + 1; x < L - 3; x += 6) b.box('solid', x, 0.0, -0.08, x + 3, 0.012, 0.08, col('#e8d36a'));
  // end caps of grass
  const g = b.build(materials);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#86a862', roughness: 1 }),
  );
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
  tooltip.innerHTML = `<b>House #${h.index + 1}</b> <span style="opacity:.6">seed ${h.model.seed}</span><br>${info}`;
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
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- loop

regenerate();
const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = timer.getDelta();
  if (fly) {
    fly.t = Math.min(1, fly.t + dt * 1.2);
    const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
    camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    if (fly.t >= 1) fly = null;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});
