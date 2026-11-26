/**
 * Terrain Lab: generate and explore the land the city will be built on.
 * A planned region: waterfront main city, two towns, farmland, an island district on a bridge, one mountain,
 * lakes, beaches and forests, with labels and a minimap.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GUI from 'lil-gui';
import { DEFAULT_TERRAIN, generateTerrain, heightAt, type TerrainMap, type TerrainParams } from './generate';
import { buildTerrainScene, updateTerrainLod, type TerrainScene } from './mesh';

const url = new URLSearchParams(location.search);
const camRaw = url.get('cam')?.split(',').map(Number);
const camParam = camRaw && camRaw.length === 6 && camRaw.every(Number.isFinite) ? camRaw : null;

// ---------------------------------------------------------------- renderer / scene

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false;
document.getElementById('app')!.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.cssText = 'position:fixed;inset:0;pointer-events:none';
document.body.appendChild(labelRenderer.domElement);
const labels = new THREE.Group();

const SKY = new THREE.Color('#bcd6e8');
const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 2800, 8500);
const hemi = new THREE.HemisphereLight('#dfeeff', '#6b7a52', 1.15);
const sun = new THREE.DirectionalLight('#fff3df', 2.4);
scene.add(hemi, sun, labels);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 2, 24000);
camera.position.set(0, 1800, 2400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 25;
controls.maxDistance = 9000;
controls.screenSpacePanning = false;

// ---------------------------------------------------------------- params / GUI

const params = {
  ...DEFAULT_TERRAIN,
  seed: Number(url.get('seed')) || DEFAULT_TERRAIN.seed,
  water: url.get('water') !== '0',
  trees: url.get('trees') !== '0',
  labels: url.get('labels') !== '0',
  wireframe: false,
  lodNear: 750,
  sunAzimuth: 135,
  sunElevation: 38,
  newSeed: () => {
    params.seed = Math.floor(Math.random() * 99999) + 1;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    regenerate();
  },
  overview: () => {
    if (!map) return;
    // From the sea side, looking inland: coast in front, mountains behind.
    const [pos, tgt] = overviewPose(map);
    fly = { t: 0, fromPos: camera.position.clone(), toPos: pos, fromT: controls.target.clone(), toT: tgt };
  },
};

const gui = new GUI({ title: 'Terrain Lab' });
gui.add(params, 'seed', 1, 99999, 1).onFinishChange(regenerate);
gui.add(params, 'newSeed').name('🎲 New seed');
const gen = gui.addFolder('Generation');
gen.add(params, 'mountain', 0, 1, 0.05).name('mountain (0 = none)').onFinishChange(regenerate);
gen.add(params, 'landShare', 0.45, 0.8, 0.01).name('land share').onFinishChange(regenerate);
gen.add(params, 'coastRoughness', 0, 1, 0.05).name('coast roughness').onFinishChange(regenerate);
gen.add(params, 'islands', 0, 4, 1).name('small islands').onFinishChange(regenerate);
gen.add(params, 'lakes', 0, 4, 1).onFinishChange(regenerate);
const view = gui.addFolder('View');
view.add(params, 'water').onChange(applyView);
view.add(params, 'trees').onChange(applyView);
view.add(params, 'labels').name('site labels').onChange(applyView);
view.add(params, 'wireframe').onChange(applyView);
view.add(params, 'lodNear', 200, 2000, 50).name('detail distance').onChange(() => {
  if (terrain && updateTerrainLod(terrain, camera.position, params.lodNear, params.lodNear * 3.5)) requestRender();
});
view.add(params, 'sunAzimuth', 0, 360, 1).name('sun azimuth').onChange(updateSun);
view.add(params, 'sunElevation', 5, 85, 1).name('sun elevation').onChange(updateSun);
gui.add(params, 'overview').name('↺ Overview');
const statsEl = document.createElement('div');
statsEl.style.cssText = 'padding:6px 8px;font-size:11px;opacity:.85;line-height:1.5';
gui.domElement.appendChild(statsEl);

function updateSun(): void {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth);
  const el = THREE.MathUtils.degToRad(params.sunElevation);
  sun.position.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(1000);
  requestRender();
}

function applyView(): void {
  if (!terrain) return;
  terrain.water.visible = params.water;
  terrain.trees.visible = params.trees;
  labels.visible = params.labels;
  terrain.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof THREE.MeshStandardMaterial && m.vertexColors) m.wireframe = params.wireframe;
  });
  requestRender();
}

// ---------------------------------------------------------------- terrain

let map: TerrainMap | null = null;
let terrain: TerrainScene | null = null;
let genMs = 0;
let firstView = true;
const busy = document.getElementById('busy')!;

function regenerate(): void {
  busy.style.display = 'block';
  // Let the "Generating…" note paint before the (blocking) work.
  setTimeout(() => {
    const p: TerrainParams = { seed: params.seed, size: params.size, res: params.res, mountain: params.mountain, landShare: params.landShare, coastRoughness: params.coastRoughness, islands: params.islands, lakes: params.lakes };
    history.replaceState(null, '', `?seed=${params.seed}`);
    map = generateTerrain(p);
    genMs = map.ms;
    if (terrain) {
      scene.remove(terrain.root);
      terrain.dispose();
    }
    terrain = buildTerrainScene(map);
    scene.add(terrain.root);
    buildLabels(map);
    updateTerrainLod(terrain, camera.position, params.lodNear, params.lodNear * 3.5);
    applyView();
    drawMinimap();
    if (firstView && !camParam) {
      const [pos, tgt] = overviewPose(map);
      camera.position.copy(pos);
      controls.target.copy(tgt);
    }
    firstView = false;
    busy.style.display = 'none';
    requestRender();
  }, 30);
}

/** From the sea side, looking inland at the land's middle: coast and city in front, the rest behind. */
function overviewPose(m: TerrainMap): [THREE.Vector3, THREE.Vector3] {
  const tgt = new THREE.Vector3(-m.seaDir[0] * m.size * 0.12, 0, -m.seaDir[1] * m.size * 0.12);
  const d = new THREE.Vector3(m.seaDir[0], 0.75, m.seaDir[1]).normalize();
  return [tgt.clone().addScaledVector(d, m.size * 0.85), tgt];
}

// ---------------------------------------------------------------- site labels

const KIND_LABEL = { city: 'Main city', town: 'Town', farm: 'Farmland', island: 'Island district' } as const;

function buildLabels(m: TerrainMap): void {
  for (const c of [...labels.children]) {
    labels.remove(c);
    (c as CSS2DObject).element.remove();
  }
  const add = (text: string, sub: string, x: number, y: number, z: number) => {
    const el = document.createElement('div');
    el.className = 'site-label';
    el.innerHTML = `${text}<small>${sub}</small>`;
    const o = new CSS2DObject(el);
    o.position.set(x, y, z);
    labels.add(o);
  };
  for (const s of m.sites) add(s.name, KIND_LABEL[s.kind], s.x, Math.max(0, heightAt(m, s.x, s.z)) + 40, s.z);
  if (m.mountain) {
    const M = m.mountain;
    // label the actual summit near the nominal centre
    let best = { x: M.x, z: M.z, h: -Infinity };
    for (let q = 0; q < 400; q++) {
      const a = (q / 400) * Math.PI * 2 * 7;
      const r = (q / 400) * M.r * 0.6;
      const x = M.x + Math.cos(a) * r;
      const z = M.z + Math.sin(a) * r;
      if (Math.abs(x) > m.size / 2 || Math.abs(z) > m.size / 2) continue;
      const h = heightAt(m, x, z);
      if (h > best.h) best = { x, z, h };
    }
    if (best.h > 0) add('Mountain', `${Math.round(best.h)} m`, best.x, best.h + 30, best.z);
  }
  const bridge = m.links.find((l) => l.kind === 'bridge');
  if (bridge) {
    const p = bridge.pts[Math.floor(bridge.pts.length / 2)];
    add('Bridge', 'road + rail', p.x, p.y + 45, p.z);
  }
}

// ---------------------------------------------------------------- minimap

const mini = document.getElementById('minimap') as HTMLCanvasElement;
const mctx = mini.getContext('2d')!;
let miniBase: ImageData | null = null;

function drawMinimap(): void {
  if (!map || !terrain) return;
  const S = mini.width;
  const img = mctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = Math.round((x / (S - 1)) * (map.res - 1));
      const j = Math.round((y / (S - 1)) * (map.res - 1));
      const k = j * map.res + i;
      let r = terrain.colors[k * 3];
      let g = terrain.colors[k * 3 + 1];
      let b = terrain.colors[k * 3 + 2];
      const w = map.water[k];
      if (w) {
        // water tinted over the bed, darker with depth
        const depth = w === 1 ? Math.min(1, -map.heights[k] / 60) : 0.2;
        const wr = 0.16 - depth * 0.08;
        const wg = 0.48 - depth * 0.2;
        const wb = 0.66 - depth * 0.15;
        r = r * 0.25 + wr * 0.75;
        g = g * 0.25 + wg * 0.75;
        b = b * 0.25 + wb * 0.75;
      }
      const o = (y * S + x) * 4;
      img.data[o] = Math.round(Math.pow(r, 1 / 2.2) * 255);
      img.data[o + 1] = Math.round(Math.pow(g, 1 / 2.2) * 255);
      img.data[o + 2] = Math.round(Math.pow(b, 1 / 2.2) * 255);
      img.data[o + 3] = 255;
    }
  }
  mctx.putImageData(img, 0, 0);
  // Links and site outlines on top.
  const M = map;
  const toPx = (v: number) => ((v + M.size / 2) / M.size) * S;
  for (const l of map.links) {
    mctx.strokeStyle = l.kind === 'bridge' ? '#ffd34d' : '#3b3d42';
    mctx.lineWidth = l.kind === 'bridge' ? 3 : 2;
    mctx.beginPath();
    l.pts.forEach((p, q) => (q ? mctx.lineTo(toPx(p.x), toPx(p.z)) : mctx.moveTo(toPx(p.x), toPx(p.z))));
    mctx.stroke();
  }
  const SITE_COL = { city: '#ff5a4f', town: '#ff9b3d', farm: '#e6d34f', island: '#c46bff' } as const;
  for (const s of map.sites) {
    mctx.strokeStyle = SITE_COL[s.kind];
    mctx.lineWidth = 1.5;
    mctx.setLineDash([3, 2]);
    mctx.beginPath();
    s.outline.forEach(([x, z], q) => (q ? mctx.lineTo(toPx(x), toPx(z)) : mctx.moveTo(toPx(x), toPx(z))));
    mctx.closePath();
    mctx.stroke();
    mctx.setLineDash([]);
  }
  miniBase = mctx.getImageData(0, 0, S, S);
  drawMinimapMarker();
}

function drawMinimapMarker(): void {
  if (!miniBase || !map) return;
  const S = mini.width;
  mctx.putImageData(miniBase, 0, 0);
  const toPx = (v: number) => ((v + map!.size / 2) / map!.size) * S;
  const tx = toPx(controls.target.x);
  const tz = toPx(controls.target.z);
  const dir = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
  mctx.strokeStyle = '#fff';
  mctx.fillStyle = 'rgba(255,255,255,.25)';
  mctx.lineWidth = 2;
  mctx.beginPath();
  mctx.moveTo(tx + dir.x * 10, tz + dir.z * 10);
  mctx.lineTo(tx - dir.x * 6 - dir.z * 6, tz - dir.z * 6 + dir.x * 6);
  mctx.lineTo(tx - dir.x * 6 + dir.z * 6, tz - dir.z * 6 - dir.x * 6);
  mctx.closePath();
  mctx.fill();
  mctx.stroke();
}

mini.addEventListener('click', (e) => {
  if (!map) return;
  const r = mini.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * map.size - map.size / 2;
  const z = ((e.clientY - r.top) / r.height) * map.size - map.size / 2;
  flyTo(new THREE.Vector3(x, Math.max(0, heightAt(map, x, z)), z), 900);
});

// ---------------------------------------------------------------- navigation

let fly: { t: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
function flyTo(target: THREE.Vector3, dist: number): void {
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  if (dir.y < 0.35) dir.setY(0.35).normalize();
  fly = { t: 0, fromPos: camera.position.clone(), toPos: target.clone().addScaledVector(dir, dist), fromT: controls.target.clone(), toT: target.clone() };
  requestRender();
}

const raycaster = new THREE.Raycaster();
renderer.domElement.addEventListener('dblclick', (e) => {
  if (!terrain) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const meshes = terrain.chunks.flatMap((c) => c.levels.filter((m) => m.visible));
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (hit) flyTo(hit.point, Math.max(120, camera.position.distanceTo(hit.point) * 0.45));
});

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  keys.add(e.key.toLowerCase());
  requestRender();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function applyKeys(dt: number): boolean {
  if (!keys.size) return false;
  const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  const v = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) v.add(fwd);
  if (keys.has('s') || keys.has('arrowdown')) v.sub(fwd);
  if (keys.has('d') || keys.has('arrowright')) v.add(right);
  if (keys.has('a') || keys.has('arrowleft')) v.sub(right);
  let up = 0;
  if (keys.has('e')) up += 1;
  if (keys.has('q')) up -= 1;
  if (!v.lengthSq() && !up) return false;
  const speed = Math.max(40, camera.position.y * 0.9) * (keys.has('shift') ? 3 : 1) * dt;
  v.normalize().multiplyScalar(speed);
  v.y = up * speed * 0.7;
  camera.position.add(v);
  controls.target.add(v);
  return true;
}

// ---------------------------------------------------------------- render loop (on demand)

let needsRender = true;
function requestRender(): void {
  needsRender = true;
}
controls.addEventListener('change', requestRender);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  requestRender();
});

let last = performance.now();
let frames = 0;
let fpsTime = 0;
let lastTris = 0;
function loop(now: number): void {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let moving = false;
  if (fly) {
    fly.t = Math.min(1, fly.t + dt * 0.9);
    const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
    camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    if (fly.t >= 1) fly = null;
    moving = true;
  }
  if (applyKeys(dt)) moving = true;
  // Keep the camera above the ground.
  if (map) {
    const g = heightAt(map, camera.position.x, camera.position.z);
    if (camera.position.y < Math.max(0, g) + 6) camera.position.y = Math.max(0, g) + 6;
  }
  if (controls.update()) moving = true;
  if (moving) needsRender = true;
  if (!needsRender) {
    fpsTime += dt;
    return;
  }
  needsRender = false;
  if (terrain) updateTerrainLod(terrain, camera.position, params.lodNear, params.lodNear * 3.5);
  renderer.info.reset();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  lastTris = renderer.info.render.triangles;
  drawMinimapMarker();
  frames++;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    const m = map;
    statsEl.innerHTML = m
      ? `${(m.size / 1000).toFixed(1)} km map · ${m.sites.filter((x) => x.kind === 'town').length} towns · ${m.islands.length - 1} small islands · ${m.lakes.length} lakes<br>${m.links.filter((l) => l.kind === 'highway').length} highways · ${m.links.some((l) => l.kind === 'bridge') ? 'bridge' : 'no bridge'} · peak ${Math.round(m.maxHeight)} m · ${(m.trees.length / 5).toLocaleString()} trees<br>generate ${Math.round(genMs)} ms · mesh ${Math.round(terrain?.ms ?? 0)} ms<br>${Math.round(frames / fpsTime)} fps · ${(lastTris / 1000).toFixed(0)}k tris drawn`
      : '';
    frames = 0;
    fpsTime = 0;
  }
}

// Optional camera from the URL: cam=x,y,z,tx,ty,tz
if (camParam) {
  camera.position.set(camParam[0], camParam[1], camParam[2]);
  controls.target.set(camParam[3], camParam[4], camParam[5]);
}
updateSun();
regenerate();
requestAnimationFrame(loop);
