/**
 * Geometry for small props and lights. Every prop is drawn in its own local frame:
 * origin at its base / mount point, local -z = its front (or out of the wall for wall-mounted items).
 */
import * as THREE from 'three';
import { LocalFrame, MeshBuilder, SHAPES, TEMPLATES, col } from './MeshBuilder';
import type { Light, Prop } from '../spec';
import { STYLE_ID } from '../../render/windowMaterial';

const STEEL = col('#8a8f96');
const DARK = col('#2a2a2a');
const WOOD = col('#7a5a3a');
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Tiny deterministic hash so a prop's sub-details (cloth colours etc.) are stable. */
const h01 = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function drawProp(b: MeshBuilder, p: Prop): void {
  const L = new LocalFrame(b, p.x, p.y, p.z, p.rot);
  const c1 = col(p.color);
  const c2 = col(p.color2 ?? p.color);

  switch (p.kind) {
    case 'swing': {
      const hgt = 2.2;
      L.beam('solid', [-1.9, hgt, 0], [1.9, hgt, 0], 0.1, c1);
      for (const sx of [-1.8, 1.8]) {
        L.beam('solid', [sx, hgt, 0], [sx * 1.08, 0, -0.95], 0.08, c1);
        L.beam('solid', [sx, hgt, 0], [sx * 1.08, 0, 0.95], 0.08, c1);
      }
      for (const cx of [-0.75, 0.75]) {
        L.beam('solid', [cx - 0.22, hgt, 0], [cx - 0.22, 0.48, 0], 0.025, STEEL);
        L.beam('solid', [cx + 0.22, hgt, 0], [cx + 0.22, 0.48, 0], 0.025, STEEL);
        L.box('solid', cx - 0.27, 0.42, -0.13, cx + 0.27, 0.48, 0.13, c2);
      }
      break;
    }
    case 'slide': {
      // ladder at +z, chute down to -z
      const top = 1.5;
      for (const sx of [-0.3, 0.3]) {
        L.beam('solid', [sx, 0, 1.4], [sx, top + 0.6, 1.1], 0.06, c2);
      }
      for (let i = 1; i < 5; i++) L.beam('solid', [-0.3, (top * i) / 5, 1.4 - 0.06 * i], [0.3, (top * i) / 5, 1.4 - 0.06 * i], 0.04, c2);
      L.box('solid', -0.35, top - 0.05, 0.7, 0.35, top, 1.15, c2);
      L.poly('solid', [[-0.3, top, 0.75], [0.3, top, 0.75], [0.3, 0.15, -1.5], [-0.3, 0.15, -1.5]], c1, [0, 1, 0]);
      for (const sx of [-0.32, 0.32]) L.poly('solid', [[sx, top, 0.75], [sx, top + 0.15, 0.75], [sx, 0.3, -1.5], [sx, 0.15, -1.5]], c1, [Math.sign(sx), 0, 0]);
      L.beam('solid', [0, 0, -1.5], [0, 0.15, -1.5], 0.06, c2);
      break;
    }
    case 'trampoline': {
      L.shape('solid', SHAPES.tube, 0, 0.85, 0, 1.8, 0.1, 1.8, c1);
      L.shape('solid', SHAPES.cyl, 0, 0.91, 0, 1.55, 0.02, 1.55, c2);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        L.beam('solid', [Math.cos(a) * 1.7, 0.85, Math.sin(a) * 1.7], [Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75], 0.06, STEEL);
      }
      break;
    }
    case 'doghouse': {
      const w = 0.5;
      const d = 0.6;
      const hgt = 0.75;
      L.box('solid', -w, 0, -d, w, hgt, d, c1);
      // gable roof, ridge along z
      const ry = hgt + 0.45;
      L.poly('solid', [[-w - 0.1, hgt - 0.05, -d - 0.1], [0, ry, -d - 0.1], [0, ry, d + 0.1], [-w - 0.1, hgt - 0.05, d + 0.1]], c2, [-1, 1, 0]);
      L.poly('solid', [[w + 0.1, hgt - 0.05, -d - 0.1], [0, ry, -d - 0.1], [0, ry, d + 0.1], [w + 0.1, hgt - 0.05, d + 0.1]], c2, [1, 1, 0]);
      L.poly('solid', [[-w, hgt, -d], [w, hgt, -d], [0, ry - 0.05, -d]], c1, [0, 0, -1]);
      L.poly('solid', [[-w, hgt, d], [w, hgt, d], [0, ry - 0.05, d]], c1, [0, 0, 1]);
      L.box('solid', -0.2, 0.02, -d - 0.01, 0.2, 0.5, -d + 0.02, DARK); // doorway
      L.shape('solid', SHAPES.cylLow, 0.35, 0.04, -d - 0.45, 0.13, 0.08, 0.13, col('#c0392b')); // bowl
      break;
    }
    case 'patioSet': {
      L.shape('solid', SHAPES.cyl, 0, 0.73, 0, 0.6, 0.05, 0.6, c1);
      L.beam('solid', [0, 0, 0], [0, 0.72, 0], 0.07, c1);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const cx = Math.cos(a) * 0.95;
        const cz = Math.sin(a) * 0.95;
        L.box('solid', cx - 0.22, 0.42, cz - 0.22, cx + 0.22, 0.47, cz + 0.22, c1);
        const bx = Math.cos(a) * 1.15;
        const bz = Math.sin(a) * 1.15;
        L.beam('solid', [bx, 0.45, bz], [bx, 0.9, bz], 0.06, c1);
        L.beam('solid', [cx, 0, cz], [cx, 0.42, cz], 0.05, c1);
      }
      L.beam('solid', [0, 0.75, 0], [0, 2.25, 0], 0.04, STEEL);
      L.shape('solid', SHAPES.cone, 0, 2.2, 0, 1.4, 0.45, 1.4, c2);
      break;
    }
    case 'bbq': {
      L.box('solid', -0.35, 0.55, -0.25, 0.35, 0.9, 0.25, c1);
      L.box('solid', -0.35, 0.9, -0.22, 0.35, 1.05, 0.25, c1); // lid
      L.box('solid', 0.35, 0.82, -0.2, 0.7, 0.86, 0.2, c2);
      L.box('solid', -0.7, 0.82, -0.2, -0.35, 0.86, 0.2, c2);
      L.box('solid', -0.33, 0, -0.23, 0.33, 0.55, 0.23, c2);
      L.box('solid', -0.15, 0.97, -0.3, 0.15, 1.0, -0.26, STEEL); // handle
      break;
    }
    case 'gardenBed': {
      L.box('solid', -1.6, 0, -0.65, 1.6, 0.28, 0.65, c1);
      L.box('solid', -1.5, 0.28, -0.55, 1.5, 0.3, 0.55, col('#4a3426'));
      for (let i = 0; i < 5; i++) {
        const px = -1.3 + (i % 5) * 0.65 + (i > 4 ? 0.3 : 0);
        const pz = i % 2 ? 0.22 : -0.22;
        b.geometry('solid', TEMPLATES.blob, new THREE.Matrix4().compose(L.p(px, 0.42, pz), new THREE.Quaternion(), new THREE.Vector3(0.22, 0.2, 0.22)), col('#4f8a3a'));
        if (h01(p.x + i, p.z) > 0.4) L.box('solid', px - 0.06, 0.55, pz - 0.06, px + 0.06, 0.65, pz + 0.06, c2);
      }
      break;
    }
    case 'clothesline': {
      for (const sx of [-2.1, 2.1]) {
        L.beam('solid', [sx, 0, 0], [sx, 1.9, 0], 0.07, c1);
        L.beam('solid', [sx, 1.85, -0.35], [sx, 1.85, 0.35], 0.06, c1);
      }
      for (const sz of [-0.3, 0.3]) {
        L.beam('solid', [-2.1, 1.85, sz], [2.1, 1.85, sz], 0.012, col('#dddddd'));
        for (let i = 0; i < 4; i++) {
          if (h01(p.x + i, p.z + sz) < 0.3) continue;
          const cx = -1.6 + i * 1.05;
          const cw = 0.35 + h01(i, p.x) * 0.3;
          const ch = 0.4 + h01(p.z, i) * 0.4;
          const cloth = ['#e74c3c', '#3498db', '#ecf0f1', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22'][Math.floor(h01(p.x, p.z + i + sz) * 7)];
          L.box('solid', cx - cw / 2, 1.85 - ch, sz - 0.01, cx + cw / 2, 1.85, sz + 0.01, col(cloth));
        }
      }
      break;
    }
    case 'bench': {
      L.box('solid', -0.8, 0.42, -0.22, 0.8, 0.47, 0.22, c1);
      L.box('solid', -0.8, 0.55, 0.18, 0.8, 0.85, 0.23, c1);
      for (const sx of [-0.7, 0.7]) L.box('solid', sx - 0.04, 0, -0.2, sx + 0.04, 0.85, 0.23, DARK);
      break;
    }
    case 'acUnit': {
      L.box('solid', -0.42, 0, -0.38, 0.42, 0.75, 0.38, c1);
      L.shape('solid', SHAPES.cyl, 0, 0.76, 0, 0.3, 0.02, 0.3, DARK);
      L.box('solid', -0.3, 0.1, -0.39, 0.3, 0.6, -0.38, col('#9aa0a6'));
      break;
    }
    case 'splitAC': {
      // wall-mounted outdoor unit on brackets; local -z points away from the wall
      L.box('solid', -0.42, 0, -0.36, 0.42, 0.6, -0.06, c1);
      L.shape('solid', SHAPES.cylLow, -0.08, 0.3, -0.365, 0.22, 0.01, 0.22, DARK, Z);
      L.box('solid', 0.22, 0.08, -0.37, 0.38, 0.52, -0.36, col('#b8bcbf'));
      for (const sx of [-0.32, 0.32]) {
        L.beam('solid', [sx, -0.02, 0], [sx, -0.02, -0.4], 0.04, STEEL);
      }
      L.beam('solid', [0.42, 0.25, -0.2], [0.55, 0.25, -0.02], 0.03, col('#e6e6e6')); // pipe
      break;
    }
    case 'waterTank': {
      const r = p.w ?? 0.6;
      const stand = p.h ?? 0.6;
      const th = r * 2.0;
      const s = r * 0.85;
      if (stand > 1.5) {
        // tall steel tower (yards)
        for (const [sx, sz] of [[-s, -s], [s, -s], [s, s], [-s, s]]) L.beam('solid', [sx, 0, sz], [sx, stand, sz], 0.07, STEEL);
        const yb = stand * 0.5;
        L.beam('solid', [-s, yb, -s], [s, yb, -s], 0.04, STEEL);
        L.beam('solid', [-s, yb, s], [s, yb, s], 0.04, STEEL);
        L.beam('solid', [-s, yb, -s], [-s, yb, s], 0.04, STEEL);
        L.beam('solid', [s, yb, -s], [s, yb, s], 0.04, STEEL);
        L.box('solid', -s - 0.08, stand, -s - 0.08, s + 0.08, stand + 0.08, s + 0.08, STEEL);
      } else {
        // short roof stand: one block
        L.box('solid', -s - 0.08, 0, -s - 0.08, s + 0.08, stand + 0.08, s + 0.08, STEEL);
      }
      const y0 = stand + 0.08;
      L.shape('solid', SHAPES.cyl, 0, y0 + th / 2, 0, r, th, r, c1);
      const rib = c1.clone().multiplyScalar(0.8);
      for (const f of [0.33, 0.66]) L.shape('solid', SHAPES.tube, 0, y0 + th * f, 0, r + 0.02, 0.05, r + 0.02, rib);
      L.shape('solid', SHAPES.cone, 0, y0 + th + 0.08, 0, r * 0.95, 0.16, r * 0.95, c1);
      L.shape('solid', SHAPES.cylLow, 0, y0 + th + 0.2, 0, r * 0.35, 0.1, r * 0.35, c1);
      L.beam('solid', [r + 0.08, y0 + 0.15, 0], [r + 0.08, 0, 0], 0.05, col('#d9d9d9'));
      break;
    }
    case 'waterTower': {
      // Classic wooden rooftop water tower on steel legs.
      const r = p.w ?? 1.6;
      const legH = p.h ?? 2.5;
      const s = r * 0.75;
      for (const [sx, sz] of [[-s, -s], [s, -s], [s, s], [-s, s]]) L.beam('solid', [sx, 0, sz], [sx * 0.9, legH, sz * 0.9], 0.12, DARK);
      L.beam('solid', [-s, legH * 0.5, -s], [s, legH * 0.5, s], 0.06, DARK);
      L.beam('solid', [s, legH * 0.5, -s], [-s, legH * 0.5, s], 0.06, DARK);
      L.shape('solid', SHAPES.cyl, 0, legH + 0.05, 0, r + 0.15, 0.1, r + 0.15, DARK);
      const bh = r * 1.8;
      L.shape('solid', SHAPES.cyl, 0, legH + 0.1 + bh / 2, 0, r, bh, r, c1);
      for (const f of [0.2, 0.55, 0.9]) L.shape('solid', SHAPES.tube, 0, legH + 0.1 + bh * f, 0, r + 0.03, 0.06, r + 0.03, DARK);
      L.shape('solid', SHAPES.cone, 0, legH + 0.1 + bh + r * 0.35, 0, r + 0.12, r * 0.7, r + 0.12, c2);
      break;
    }
    case 'helipad': {
      const r = p.w ?? 6;
      L.shape('solid', SHAPES.cyl, 0, 0.1, 0, r, 0.2, r, c1);
      const paint = col('#f2f2ee');
      // circle marking (flat boxes around the rim) + the "H"
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = Math.cos(a) * r * 0.82;
        const z = Math.sin(a) * r * 0.82;
        L.beam('solid', [x, 0.21, z], [Math.cos(a + 0.3) * r * 0.82, 0.21, Math.sin(a + 0.3) * r * 0.82], 0.02, paint);
      }
      L.box('solid', -1.3, 0.2, -1.6, -0.9, 0.22, 1.6, c2);
      L.box('solid', 0.9, 0.2, -1.6, 1.3, 0.22, 1.6, c2);
      L.box('solid', -0.9, 0.2, -0.2, 0.9, 0.22, 0.2, c2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        L.box('lamp', Math.cos(a) * r * 0.97 - 0.08, 0.2, Math.sin(a) * r * 0.97 - 0.08, Math.cos(a) * r * 0.97 + 0.08, 0.3, Math.sin(a) * r * 0.97 + 0.08, col('#a8ff9a'));
      }
      break;
    }
    case 'spire': {
      // Tapered spire / antenna mast with a red aviation light on top.
      const r = p.w ?? 1.2;
      const h = p.h ?? 20;
      L.box('solid', -r * 1.4, 0, -r * 1.4, r * 1.4, 1.2, r * 1.4, c2);
      L.shape('solid', SHAPES.cone, 0, 1.2 + h * 0.35, 0, r, h * 0.7, r, c1);
      L.beam('solid', [0, 1.2 + h * 0.6, 0], [0, 1.2 + h, 0], 0.18, c1);
      L.box('lamp', -0.2, 1.2 + h, -0.2, 0.2, 1.6 + h, 0.2, col('#c80d08'));
      break;
    }
    case 'cellTower': {
      // Lattice telecom mast: 3 tapering legs with zig-zag bracing, sector antennas, microwave dishes.
      const h = p.h ?? 14;
      const r0 = 1.0;
      const r1 = 0.35;
      const leg = (k: number, y: number): [number, number, number] => {
        const r = r0 + (r1 - r0) * (y / h);
        const a = (k / 3) * Math.PI * 2;
        return [Math.cos(a) * r, y, Math.sin(a) * r];
      };
      for (let k = 0; k < 3; k++) L.beam('solid', leg(k, 0), leg(k, h), 0.09, c1);
      for (let y = 0; y < h - 1; y += 2) {
        for (let k = 0; k < 3; k++) L.beam('solid', leg(k, y), leg((k + 1) % 3, y + 2), 0.04, c1);
      }
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + Math.PI / 3;
        const x = Math.cos(a) * (r1 + 0.25);
        const z = Math.sin(a) * (r1 + 0.25);
        L.shape('solid', SHAPES.box, x, h - 1.4, z, 0.32, 1.5, 0.12, col('#e8e8e4'), new THREE.Vector3(0, 1, 0)); // sector antenna panel
        L.beam('solid', [x * 0.4, h - 1.4, z * 0.4], [x, h - 1.4, z], 0.05, c1);
      }
      for (const a of [0.4, 2.6]) {
        const r = r0 + (r1 - r0) * ((h - 4) / h) + 0.25;
        L.shape('solid', SHAPES.cylLow, Math.cos(a) * r, h - 4, Math.sin(a) * r, 0.45, 0.2, 0.45, col('#e8e8e4'), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      }
      L.box('lamp', -0.12, h, -0.12, 0.12, h + 0.25, 0.12, col('#c80d08'));
      break;
    }
    case 'antennaCluster': {
      // A handful of thin masts of different heights, with cross-bars; red light on the tallest.
      const h = p.h ?? 8;
      const masts: [number, number, number][] = [[0, 0, 1], [1.1, 0.4, 0.65], [-0.9, 0.7, 0.5], [0.3, -1.0, 0.8]];
      for (const [x, z, f] of masts) {
        const mh = h * f;
        L.beam('solid', [x, 0, z], [x, mh, z], 0.08, c1);
        for (let y = mh * 0.4; y < mh; y += mh * 0.25) L.beam('solid', [x - 0.35, y, z], [x + 0.35, y, z], 0.03, c1);
      }
      L.box('lamp', -0.1, h, -0.1, 0.1, h + 0.2, 0.1, col('#c80d08'));
      break;
    }
    case 'bigDish': {
      // Satellite ground-station style dish on a pedestal, aimed up and out (-z).
      const r = p.w ?? 1.5;
      L.box('solid', -0.4, 0, -0.4, 0.4, 0.9, 0.4, c2);
      L.beam('solid', [0, 0.9, 0], [0, 1.4, -0.2], 0.2, c2);
      L.shape('solid', SHAPES.cyl, 0, 1.6, -0.35, r, 0.16, r, c1, new THREE.Vector3(0, 0.8, -1));
      L.beam('solid', [0, 1.6, -0.35], [0, 1.6 + 0.8 * 0.9, -0.35 - 0.9], 0.05, c2);
      break;
    }
    case 'coolingTower': {
      L.shape('solid', SHAPES.cyl, 0, 1.1, 0, 1.3, 2.2, 1.3, c1);
      L.shape('solid', SHAPES.tube, 0, 2.3, 0, 1.35, 0.25, 1.35, c2);
      L.shape('solid', SHAPES.cylLow, 0, 2.25, 0, 1.0, 0.05, 1.0, DARK); // fan
      for (let k = 0; k < 4; k++) L.box('solid', -1.31 + 0, 0.3 + k * 0.45, -0.5, -1.3, 0.5 + k * 0.45, 0.5, c2); // louvres
      break;
    }
    case 'bmu': {
      // Building maintenance unit (window-cleaning crane): cart, mast, arm reaching out over the edge (-z), cradle.
      const reach = p.w ?? 5;
      L.box('solid', -0.9, 0, -0.8, 0.9, 0.9, 1.6, c1);
      L.box('solid', -0.6, 0.9, 0.6, 0.6, 1.6, 1.5, c2); // counterweight
      L.beam('solid', [0, 0.9, 0], [0, 3.2, 0], 0.3, c1);
      L.beam('solid', [0, 3.2, 1.0], [0, 3.2, -reach], 0.22, c1);
      L.beam('solid', [0, 3.2, -reach + 0.1], [0, 0.6, -reach + 0.1], 0.025, STEEL);
      L.box('solid', -1.0, 0.1, -reach - 0.3, 1.0, 0.6, -reach + 0.4, c2); // cradle
      break;
    }
    case 'flagpole': {
      const h = p.h ?? 8;
      L.shape('solid', SHAPES.cylLow, 0, 0.1, 0, 0.25, 0.2, 0.25, STEEL);
      L.beam('solid', [0, 0, 0], [0, h, 0], 0.07, col('#dcdcd8'));
      L.shape('solid', SHAPES.sphere, 0, h + 0.08, 0, 0.1, 0.1, 0.1, col('#c9a648'));
      // flag with a slight wave (two panels)
      L.poly('solid', [[0.04, h - 0.1, 0], [0.9, h - 0.15, 0.12], [0.9, h - 1.0, 0.12], [0.04, h - 0.95, 0]], c1);
      L.poly('solid', [[0.9, h - 0.15, 0.12], [1.7, h - 0.12, 0], [1.7, h - 0.98, 0], [0.9, h - 1.0, 0.12]], c2);
      break;
    }
    case 'pylonSign': {
      // Tall roadside sign: two legs, a cabinet with 2-3 lit panels (front and back). Faces -z.
      const h = p.h ?? 8;
      const w = p.w ?? 3;
      const panels = 2 + (h01(p.x, p.z) > 0.5 ? 1 : 0);
      const ph = Math.min(1.4, (h * 0.45) / panels);
      const top = h;
      const bottom = top - panels * ph - 0.2;
      for (const x of [-w * 0.32, w * 0.32]) L.box('solid', x - 0.16, 0, -0.16, x + 0.16, bottom, 0.16, c2);
      L.box('solid', -w / 2, bottom, -0.3, w / 2, top + 0.15, 0.3, c2);
      for (let k = 0; k < panels; k++) {
        const y0 = bottom + 0.1 + k * ph;
        const seed = 1 + h01(p.x + k, p.z) * 0.99;
        const colors = ['#c0392b', '#1f6fb5', '#f1c40f', '#ffffff', '#27ae60', '#e67e22'];
        const pc = col(k === panels - 1 ? p.color : colors[Math.floor(h01(k, p.x) * colors.length)]);
        for (const s of [-1, 1]) {
          const z = s * 0.31;
          L.winQuad('window', s < 0
            ? [[-w / 2 + 0.08, y0, z], [w / 2 - 0.08, y0, z], [w / 2 - 0.08, y0 + ph - 0.1, z], [-w / 2 + 0.08, y0 + ph - 0.1, z]]
            : [[w / 2 - 0.08, y0, z], [-w / 2 + 0.08, y0, z], [-w / 2 + 0.08, y0 + ph - 0.1, z], [w / 2 - 0.08, y0 + ph - 0.1, z]],
          pc, w - 0.16, ph - 0.1, STYLE_ID.sign, seed, [0, 0, s]);
        }
      }
      break;
    }
    case 'fuelCanopy': {
      // Petrol-station canopy: columns, deep slab, brand-coloured fascia, light panels underneath.
      const w = p.w ?? 18;
      const d = p.d ?? 12;
      const h = p.h ?? 5.2;
      for (const x of [-w / 3, w / 3]) for (const z of [-d / 4, d / 4]) L.box('solid', x - 0.3, 0, z - 0.3, x + 0.3, h, z + 0.3, c1);
      L.box('solid', -w / 2, h, -d / 2, w / 2, h + 0.9, d / 2, c1);
      // Brand band around the edge: drawn as a lamp so it glows at night, like real canopies.
      L.box('lamp', -w / 2 - 0.05, h + 0.2, -d / 2 - 0.05, w / 2 + 0.05, h + 0.75, d / 2 + 0.05, c2);
      for (let x = -w / 2 + 2; x < w / 2 - 1; x += 3) for (const z of [-d / 4, d / 4]) L.box('lamp', x - 0.6, h - 0.04, z - 0.4, x + 0.6, h, z + 0.4, col('#fff6e6'));
      break;
    }
    case 'fuelPump': {
      // Pump island: kerb + two dispensers with screens and hoses.
      L.box('solid', -0.6, 0, -2.2, 0.6, 0.2, 2.2, col('#d9d6cf'));
      for (const z of [-1.1, 1.1]) {
        L.box('solid', -0.35, 0.2, z - 0.45, 0.35, 1.9, z + 0.45, col('#eeeeea'));
        L.box('solid', -0.37, 1.55, z - 0.47, 0.37, 1.95, z + 0.47, c1);
        L.box('glass', -0.36, 1.1, z - 0.25, 0.36, 1.4, z + 0.25, col('#1c2733'));
        for (const s of [-1, 1]) L.beam('solid', [s * 0.36, 1.2, z], [s * 0.6, 0.5, z + 0.1], 0.04, DARK);
      }
      // squeegee bucket at the island end
      L.box('solid', -0.22, 0.2, 1.75, 0.22, 0.75, 2.1, col('#1f6fb5'));
      L.beam('solid', [0.05, 0.6, 1.9], [0.15, 1.2, 1.95], 0.03, DARK);
      break;
    }
    case 'cartCorral': {
      // Trolley return shelter: steel frame with a couple of trolleys in it.
      const len = 3.6;
      for (const x of [-0.6, 0.6]) {
        L.beam('solid', [x, 0, -len / 2], [x, 1.0, -len / 2], 0.06, STEEL);
        L.beam('solid', [x, 0, len / 2], [x, 1.0, len / 2], 0.06, STEEL);
        L.beam('solid', [x, 1.0, -len / 2], [x, 1.0, len / 2], 0.05, STEEL);
        L.beam('solid', [x, 0.5, -len / 2], [x, 0.5, len / 2], 0.04, STEEL);
      }
      L.box('solid', -0.62, 1.0, len / 2 - 0.05, 0.62, 1.6, len / 2 + 0.05, c1); // sign panel
      for (const z of [-0.8, 0.2]) L.box('solid', -0.3, 0.25, z - 0.4, 0.3, 0.95, z + 0.4, col('#9aa0a6'));
      break;
    }
    case 'dumpster': {
      L.box('solid', -0.95, 0.12, -0.6, 0.95, 1.25, 0.6, c1);
      L.poly('solid', [[-0.97, 1.25, -0.62], [0.97, 1.25, -0.62], [0.97, 1.4, 0.62], [-0.97, 1.4, 0.62]], c1.clone().multiplyScalar(0.8), [0, 1, -0.2]);
      for (const x of [-0.75, 0.75]) for (const z of [-0.45, 0.45]) L.shape('solid', SHAPES.cylLow, x, 0.07, z, 0.07, 0.14, 0.07, DARK, X);
      break;
    }
    case 'truck': {
      // Delivery truck: cab at -z, box trailer behind.
      const len = p.d ?? 12;
      L.box('solid', -1.25, 0.6, -2.4, 1.25, 3.1, 0, c1); // cab
      L.box('glass', -1.15, 2.0, -2.45, 1.15, 2.9, -2.3, col('#1c2733'));
      L.box('solid', -1.3, 1.0, 0.2, 1.3, 4.0, len, c2); // trailer
      L.box('solid', -1.2, 0.4, -2.3, 1.2, 0.9, len - 0.2, DARK); // chassis
      for (const z of [-1.6, len - 3.0, len - 1.6]) for (const x of [-1.05, 1.05]) L.shape('solid', SHAPES.cylLow, x, 0.5, z, 0.5, 0.35, 0.5, DARK, X);
      break;
    }
    case 'stall': {
      // Market stall: table with crates of produce under a sloping tarp on four poles. Faces -z.
      L.box('solid', -1.1, 0.75, -0.55, 1.1, 0.85, 0.55, col('#8a6a4a'));
      for (const x of [-1.0, 1.0]) for (const z of [-0.45, 0.45]) L.beam('solid', [x, 0, z], [x, 0.75, z], 0.06, col('#6b4a33'));
      const produce = ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#8e44ad', '#d35400', '#c0392b'];
      for (let i = 0; i < 4; i++) {
        const x = -0.8 + i * 0.53;
        L.box('solid', x - 0.24, 0.85, -0.45, x + 0.24, 1.05, 0.05, col('#b5895a'));
        L.box('solid', x - 0.2, 1.05, -0.4, x + 0.2, 1.15, 0.0, col(produce[Math.floor(h01(p.x + i, p.z) * produce.length)]));
      }
      for (const x of [-1.2, 1.2]) {
        L.beam('solid', [x, 0, -0.8], [x, 2.1, -0.8], 0.05, STEEL);
        L.beam('solid', [x, 0, 0.7], [x, 2.4, 0.7], 0.05, STEEL);
      }
      L.poly('solid', [[-1.35, 2.1, -0.95], [1.35, 2.1, -0.95], [1.35, 2.45, 0.8], [-1.35, 2.45, 0.8]], c1, [0, 1, -0.3]);
      break;
    }
    // ------------------------------------------------------------ shop fronts
    case 'cafeTable': {
      // Round table + chairs (p.w = chair count); p.h > 0 adds an umbrella in p.color. Chairs in p.color2.
      const chairs = p.w ?? 2;
      const chair = c2;
      L.shape('solid', SHAPES.cylLow, 0, 0.74, 0, 0.38, 0.04, 0.38, col('#e9e6df'));
      L.beam('solid', [0, 0, 0], [0, 0.72, 0], 0.05, DARK);
      for (let i = 0; i < chairs; i++) {
        const a = (i / chairs) * Math.PI * 2 + 0.4;
        const cx = Math.cos(a) * 0.62;
        const cz = Math.sin(a) * 0.62;
        L.box('solid', cx - 0.2, 0.43, cz - 0.2, cx + 0.2, 0.47, cz + 0.2, chair);
        const bx = Math.cos(a) * 0.8;
        const bz = Math.sin(a) * 0.8;
        L.beam('solid', [bx, 0.45, bz], [bx, 0.85, bz], 0.05, chair);
        L.beam('solid', [cx, 0, cz], [cx, 0.43, cz], 0.04, chair);
      }
      if ((p.h ?? 0) > 0) {
        L.beam('solid', [0, 0.76, 0], [0, 2.3, 0], 0.04, col('#dcdcd8'));
        L.shape('solid', SHAPES.cone, 0, 2.25, 0, 1.25, 0.45, 1.25, c1);
      }
      break;
    }
    case 'aBoard': {
      // A-frame menu board facing -z.
      const board = c1;
      L.poly('solid', [[-0.28, 0, -0.22], [0.28, 0, -0.22], [0.28, 0.9, -0.02], [-0.28, 0.9, -0.02]], board, [0, 0.2, -1]);
      L.poly('solid', [[-0.28, 0, 0.22], [0.28, 0, 0.22], [0.28, 0.9, 0.02], [-0.28, 0.9, 0.02]], board, [0, 0.2, 1]);
      for (let k = 0; k < 4; k++) {
        const y = 0.25 + k * 0.15;
        const zf = -0.22 + (y / 0.9) * 0.2 - 0.012;
        L.box('solid', -0.18, y, zf - 0.005, -0.18 + 0.36 * (0.5 + h01(p.x + k, p.z) * 0.5), y + 0.04, zf, col('#f4f1ea'));
      }
      break;
    }
    case 'planter': {
      const w = p.w ?? 0.9;
      L.box('solid', -w / 2, 0, -0.25, w / 2, 0.5, 0.25, c1);
      for (let k = 0; k < Math.max(1, Math.round(w / 0.5)); k++) {
        const x = -w / 2 + 0.25 + k * 0.5;
        b.geometry('solid', TEMPLATES.blob, new THREE.Matrix4().compose(L.p(x, 0.62, 0), new THREE.Quaternion(), new THREE.Vector3(0.28, 0.25, 0.28)), col('#4f8a3a'));
      }
      break;
    }
    case 'flowerRack': {
      // Three stepped tiers of buckets with flowers, against the shop front (back at +z).
      const flowers = ['#e74c3c', '#f1c40f', '#ff8fab', '#9b59b6', '#ffffff', '#e67e22', '#c0392b'];
      for (let t = 0; t < 3; t++) {
        const y = 0.3 + t * 0.32;
        const z = -0.35 + t * 0.28;
        L.box('solid', -0.7, y - 0.04, z - 0.15, 0.7, y, z + 0.15, col('#6b4a33'));
        for (let k = 0; k < 4; k++) {
          const x = -0.55 + k * 0.37;
          L.shape('solid', SHAPES.cylLow, x, y + 0.1, z, 0.12, 0.2, 0.12, col('#5a5f66'));
          b.geometry('solid', TEMPLATES.blob, new THREE.Matrix4().compose(L.p(x, y + 0.32, z), new THREE.Quaternion(), new THREE.Vector3(0.16, 0.14, 0.16)), col(flowers[Math.floor(h01(p.x + k * 3, p.z + t) * flowers.length)]));
        }
      }
      for (const x of [-0.68, 0.68]) L.beam('solid', [x, 0, -0.35], [x, 0.96, 0.21], 0.04, col('#6b4a33'));
      break;
    }
    case 'produceDisplay': {
      // Tiered crates leaning back against the shop front. p.color2 tints the goods (grey for hardware).
      const w = p.w ?? 1.5;
      const goods = p.color2 ? [p.color2, '#9aa0a6', '#5a5f66', '#c9a648'] : ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#8e44ad', '#d35400'];
      for (let t = 0; t < 3; t++) {
        const y = 0.35 + t * 0.3;
        const z = -0.4 + t * 0.25;
        for (let x = -w / 2 + 0.25; x < w / 2 - 0.2; x += 0.5) {
          L.box('solid', x - 0.22, y - 0.18, z - 0.15, x + 0.22, y, z + 0.15, col('#b5895a'));
          L.box('solid', x - 0.18, y, z - 0.11, x + 0.18, y + 0.08, z + 0.11, col(goods[Math.floor(h01(p.x + x * 7, p.z + t) * goods.length)]));
        }
      }
      for (const x of [-w / 2, w / 2]) L.beam('solid', [x, 0, -0.4], [x, 1.05, 0.15], 0.05, col('#6b4a33'));
      break;
    }
    case 'clothesRack': {
      const w = p.w ?? 1.4;
      for (const x of [-w / 2, w / 2]) L.beam('solid', [x, 0, 0], [x, 1.6, 0], 0.04, STEEL);
      L.beam('solid', [-w / 2, 1.6, 0], [w / 2, 1.6, 0], 0.03, STEEL);
      const cloth = ['#e74c3c', '#3498db', '#ecf0f1', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22', '#ff8fab', '#34495e'];
      for (let x = -w / 2 + 0.15; x < w / 2 - 0.1; x += 0.16) {
        const ch = 0.7 + h01(x * 9, p.x) * 0.5;
        L.box('solid', x - 0.06, 1.55 - ch, -0.22, x + 0.06, 1.55, 0.22, col(cloth[Math.floor(h01(p.x + x * 13, p.z) * cloth.length)]));
      }
      break;
    }
    case 'motorbike': {
      // Small motorbike, front at -z.
      for (const z of [-0.65, 0.65]) L.shape('solid', SHAPES.cylLow, 0, 0.3, z, 0.3, 0.1, 0.3, DARK, X);
      L.box('solid', -0.15, 0.35, -0.5, 0.15, 0.7, 0.45, c1); // body / tank
      L.box('solid', -0.17, 0.7, 0.0, 0.17, 0.8, 0.6, DARK); // seat
      L.beam('solid', [0, 0.35, -0.65], [0, 1.0, -0.5], 0.05, STEEL); // fork
      L.beam('solid', [-0.35, 1.0, -0.5], [0.35, 1.0, -0.5], 0.04, DARK); // handlebar
      L.box('lamp', -0.08, 0.85, -0.6, 0.08, 0.95, -0.52, col('#ffe2a8'));
      break;
    }
    case 'bikeRack': {
      // Hoops with a couple of bicycles (frames + wheel rings), along x.
      const n = p.w ?? 3;
      for (let i = 0; i < n; i++) {
        const x = -((n - 1) * 0.8) / 2 + i * 0.8;
        L.beam('solid', [x, 0, -0.3], [x, 0.8, -0.3], 0.05, STEEL);
        L.beam('solid', [x, 0, 0.3], [x, 0.8, 0.3], 0.05, STEEL);
        L.beam('solid', [x, 0.8, -0.3], [x, 0.8, 0.3], 0.05, STEEL);
        if (h01(p.x + i, p.z) > 0.4) {
          const bc = col(['#c0392b', '#1f6fb5', '#2b2b2b', '#27ae60', '#f1c40f'][Math.floor(h01(i, p.x) * 5)]);
          for (const z of [-0.55, 0.55]) L.shape('solid', SHAPES.tube, x + 0.1, 0.35, z, 0.33, 0.03, 0.33, DARK, X);
          L.beam('solid', [x + 0.1, 0.35, -0.55], [x + 0.1, 0.75, 0.1], 0.04, bc);
          L.beam('solid', [x + 0.1, 0.75, 0.1], [x + 0.1, 0.35, 0.55], 0.04, bc);
          L.beam('solid', [x + 0.1, 0.75, -0.3], [x + 0.1, 0.75, 0.1], 0.04, bc);
        }
      }
      break;
    }
    case 'barberPole': {
      // Wall-mounted striped pole; local -z points away from the wall.
      L.box('solid', -0.06, 0.0, -0.12, 0.06, 1.1, 0, STEEL);
      for (let k = 0; k < 6; k++) {
        const c = [col('#c0392b'), col('#ffffff'), col('#1f6fb5')][k % 3];
        L.shape(k % 3 === 1 ? 'lamp' : 'solid', SHAPES.cylLow, 0, 0.15 + k * 0.14, -0.2, 0.1, 0.14, 0.1, c);
      }
      L.shape('solid', SHAPES.sphere, 0, 1.02, -0.2, 0.11, 0.08, 0.11, STEEL);
      break;
    }
    case 'crossSign': {
      // Pharmacy cross on a bracket, glowing in p.color; local -z away from the wall.
      const cs = p.w ?? 1; // hospitals use a big one
      L.beam('solid', [0, 0, 0], [0, 0, -0.5], 0.06 * cs, STEEL);
      L.box('lamp', -0.12 * cs, -0.38 * cs, -0.5 - 0.12 * cs, 0.12 * cs, 0.38 * cs, -0.5, c1);
      L.box('lamp', -0.38 * cs, -0.12 * cs, -0.5 - 0.12 * cs, 0.38 * cs, 0.12 * cs, -0.5, c1);
      break;
    }
    case 'atm': {
      // Through-the-wall cash machine: steel surround, lit screen, keypad. Local -z out of the wall.
      L.box('solid', -0.45, 0.0, -0.08, 0.45, 1.6, 0, col('#9aa0a6'));
      L.box('lamp', -0.25, 1.0, -0.1, 0.25, 1.35, -0.08, col('#6fc3ff'));
      L.box('solid', -0.2, 0.75, -0.2, 0.2, 0.8, -0.08, DARK);
      L.box('solid', -0.42, 1.45, -0.12, 0.42, 1.6, -0.08, c1); // brand header
      break;
    }
    case 'pennants': {
      // A string of triangular flags between two poles, sagging slightly; p.w = length along x.
      const w = p.w ?? 10;
      const h = p.h ?? 4.5;
      for (const x of [-w / 2, w / 2]) L.beam('solid', [x, 0, 0], [x, h + 0.2, 0], 0.08, STEEL);
      const flags = ['#e74c3c', '#f1c40f', '#1f6fb5', '#27ae60', '#ffffff'];
      const n = Math.floor(w / 0.6);
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + i * (w / n);
        const x1 = x0 + w / n;
        const sag = (x: number) => h - 0.5 * (1 - Math.pow((2 * x) / w, 2));
        L.beam('solid', [x0, sag(x0), 0], [x1, sag(x1), 0], 0.015, DARK);
        L.poly('solid', [[x0 + 0.05, sag(x0 + 0.05), 0], [x1 - 0.05, sag(x1 - 0.05), 0], [(x0 + x1) / 2, sag((x0 + x1) / 2) - 0.35, 0]], col(flags[i % flags.length]));
      }
      break;
    }
    case 'carPlatform': {
      L.shape('solid', SHAPES.cyl, 0, 0.15, 0, 2.8, 0.3, 2.8, c1);
      L.shape('lamp', SHAPES.tube, 0, 0.27, 0, 2.82, 0.04, 2.82, col('#ffffff'));
      break;
    }
    case 'litterBin': {
      L.shape('solid', SHAPES.cylLow, 0, 0.45, 0, 0.24, 0.9, 0.24, c1);
      L.shape('solid', SHAPES.cylLow, 0, 0.93, 0, 0.27, 0.06, 0.27, DARK);
      break;
    }
    case 'stringLights': {
      // Festoon lights along x between -w/2 and w/2, sagging; glow at night.
      const w = p.w ?? 6;
      const h = p.h ?? 2.8;
      const n = Math.max(4, Math.floor(w / 0.6));
      const y = (x: number) => h - 0.35 * (1 - Math.pow((2 * x) / w, 2));
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + (i * w) / n;
        const x1 = x0 + w / n;
        L.beam('solid', [x0, y(x0), 0], [x1, y(x1), 0], 0.012, DARK);
        L.box('lamp', x0 - 0.05, y(x0) - 0.14, -0.05, x0 + 0.05, y(x0) - 0.04, 0.05, col('#ffd28a'));
      }
      break;
    }
    // ------------------------------------------------------------ industrial
    case 'smokestack': {
      // Tapered brick / concrete stack with warning bands, a service platform and a ladder.
      const h = p.h ?? 30;
      const r = p.w ?? 1.4;
      L.shape('solid', SHAPES.cyl, 0, h * 0.25, 0, r, h * 0.5, r, c1);
      L.shape('solid', SHAPES.cyl, 0, h * 0.75, 0, r * 0.8, h * 0.5, r * 0.8, c1);
      for (const f of [0.82, 0.92]) L.shape('solid', SHAPES.tube, 0, h * f, 0, r * 0.82, h * 0.04, r * 0.82, c2);
      L.shape('solid', SHAPES.tube, 0, h - 0.2, 0, r * 0.84, 0.4, r * 0.84, DARK);
      L.shape('solid', SHAPES.cylLow, 0, h * 0.7, 0, r * 1.3, 0.12, r * 1.3, STEEL); // platform
      L.beam('solid', [r * 1.02, 0.5, 0], [r * 0.82, h - 0.5, 0], 0.08, STEEL); // ladder
      break;
    }
    case 'storageTank': {
      const r = p.w ?? 5;
      const h = p.h ?? 8;
      L.shape('solid', SHAPES.cyl, 0, h / 2, 0, r, h, r, c1);
      L.shape('solid', SHAPES.sphere, 0, h, 0, r, r * 0.25, r, c1);
      L.shape('solid', SHAPES.tube, 0, h - 0.1, 0, r + 0.05, 0.12, r + 0.05, c2);
      for (let k = 0; k < 6; k++) {
        // spiral stair as a few steep beams around the shell
        const a0 = (k / 6) * Math.PI * 1.2;
        const a1 = ((k + 1) / 6) * Math.PI * 1.2;
        L.beam('solid', [Math.cos(a0) * (r + 0.3), (k / 6) * h, Math.sin(a0) * (r + 0.3)], [Math.cos(a1) * (r + 0.3), ((k + 1) / 6) * h, Math.sin(a1) * (r + 0.3)], 0.12, STEEL);
      }
      break;
    }
    case 'silo': {
      const r = p.w ?? 3;
      const h = p.h ?? 20;
      L.shape('solid', SHAPES.cyl, 0, h / 2, 0, r, h, r, c1);
      for (let y = h * 0.2; y < h; y += h * 0.2) L.shape('solid', SHAPES.tube, 0, y, 0, r + 0.03, 0.15, r + 0.03, c2);
      L.shape('solid', SHAPES.cone, 0, h + r * 0.3, 0, r, r * 0.6, r, c2);
      L.box('solid', -0.8, h + r * 0.55, -0.8, 0.8, h + r * 0.55 + 1.4, 0.8, c2);
      break;
    }
    case 'pipeRack': {
      // Steel bents every ~6 m carrying a bundle of pipes along x; p.w = length, p.h = height.
      const len = p.w ?? 20;
      const h = p.h ?? 5;
      for (let x = -len / 2; x <= len / 2 + 1e-6; x += Math.max(4, len / Math.max(1, Math.round(len / 6)))) {
        L.beam('solid', [x, 0, -1.2], [x, h, -1.2], 0.25, STEEL);
        L.beam('solid', [x, 0, 1.2], [x, h, 1.2], 0.25, STEEL);
        L.beam('solid', [x, h, -1.4], [x, h, 1.4], 0.22, STEEL);
      }
      const pipeCols = [c1, c2, col('#9aa0a6'), col('#c9ccd1')];
      [-0.9, -0.3, 0.3, 0.9].forEach((z, k) => {
        const pr = 0.18 + (k % 2) * 0.1;
        L.shape('solid', SHAPES.cylLow, 0, h + 0.11 + pr, z, pr, len, pr, pipeCols[k], X);
      });
      break;
    }
    case 'conveyor': {
      // Open inclined belt from (0, 1, 0) to (0, 1 + p.h, -p.w), on legs; crates ride it (animated).
      const len = p.w ?? 20;
      const rise = p.h ?? 6;
      const y0 = 1.0;
      L.poly('solid', [[-0.6, y0, 0], [0.6, y0, 0], [0.6, y0 + rise, -len], [-0.6, y0 + rise, -len]], DARK, [0, 1, 0]);
      for (const x of [-0.7, 0.7]) L.beam('solid', [x, y0 + 0.35, 0], [x, y0 + rise + 0.35, -len], 0.1, c1);
      for (let t = 0; t <= 1.0001; t += 1 / Math.max(1, Math.round(len / 7))) {
        const y = y0 + rise * t;
        const z = -len * t;
        for (const x of [-0.65, 0.65]) L.beam('solid', [x, 0, z], [x, y, z], 0.14, c1);
        L.beam('solid', [-0.65, y - 0.15, z], [0.65, y - 0.15, z], 0.12, c1);
      }
      break;
    }
    case 'container': {
      // ISO shipping container along local z (p.d = 6.1 or 12.2 m long), with door bars at the +z end.
      const len = p.d ?? 6.1;
      L.box('solid', -1.22, 0, -len / 2, 1.22, 2.6, len / 2, c1);
      const dark = c1.clone().multiplyScalar(0.75);
      for (let z = -len / 2 + 0.6; z < len / 2 - 0.3; z += 1.2) {
        L.box('solid', -1.24, 0.15, z - 0.05, -1.22, 2.45, z + 0.05, dark);
        L.box('solid', 1.22, 0.15, z - 0.05, 1.24, 2.45, z + 0.05, dark);
      }
      for (const x of [-0.6, 0.6]) L.box('solid', x - 0.04, 0.1, len / 2, x + 0.04, 2.5, len / 2 + 0.03, dark);
      break;
    }
    case 'pallets': {
      const layers = Math.round(p.h ?? 2);
      for (let k = 0; k < layers; k++) {
        const y = k * 1.15;
        L.box('solid', -0.6, y, -0.5, 0.6, y + 0.14, 0.5, col('#b5895a'));
        L.box('solid', -0.55, y + 0.14, -0.45, 0.55, y + 1.1, 0.45, c1);
      }
      break;
    }
    case 'drums': {
      const n = Math.round(p.w ?? 5);
      for (let k = 0; k < n; k++) {
        const x = (k % 3) * 0.65 - 0.65;
        const z = Math.floor(k / 3) * 0.65 - 0.3;
        L.shape('solid', SHAPES.cylLow, x, 0.45, z, 0.29, 0.9, 0.29, k % 2 ? c1 : c2);
      }
      break;
    }
    case 'forklift': {
      // Forks at -z.
      L.box('solid', -0.6, 0.2, -0.4, 0.6, 1.2, 1.4, c1);
      L.box('solid', -0.6, 1.2, 0.4, 0.6, 1.55, 1.4, DARK); // counterweight / seat area
      for (const x of [-0.55, 0.55]) L.beam('solid', [x, 1.2, 0.0], [x, 2.2, 0.0], 0.06, DARK); // roof posts
      L.box('solid', -0.62, 2.2, -0.1, 0.62, 2.26, 1.2, DARK);
      for (const x of [-0.4, 0.4]) L.beam('solid', [x, 0, -0.5], [x, 2.6, -0.5], 0.1, DARK); // mast
      for (const x of [-0.3, 0.3]) L.box('solid', x - 0.06, 0.08, -1.6, x + 0.06, 0.14, -0.5, STEEL); // forks
      for (const z of [-0.2, 1.1]) L.shape('solid', SHAPES.cylLow, 0, 0.3, z, 0.3, 1.3, 0.3, DARK, X);
      break;
    }
    case 'craneRails': {
      // Two elevated runway beams on columns for a travelling gantry crane: span p.w (x), length p.d (z), height p.h.
      const span = p.w ?? 16;
      const len = p.d ?? 30;
      const h = p.h ?? 8;
      for (const x of [-span / 2, span / 2]) {
        L.box('solid', x - 0.3, h - 0.6, -len / 2, x + 0.3, h, len / 2, c1);
        for (let z = -len / 2; z <= len / 2 + 1e-6; z += len / Math.max(1, Math.round(len / 8))) L.box('solid', x - 0.25, 0, z - 0.25, x + 0.25, h - 0.6, z + 0.25, c1);
      }
      break;
    }
    case 'turbineTower': {
      // Wind turbine tower + nacelle facing local -z (the rotor is animated separately).
      const h = p.h ?? 30;
      L.shape('solid', SHAPES.cyl, 0, h * 0.5, 0, 0.9, h, 0.9, col('#eeeeea'));
      L.box('solid', -0.7, h - 0.2, -1.0, 0.7, h + 1.2, 2.2, col('#eeeeea'));
      L.shape('solid', SHAPES.cone, 0, h + 0.5, -1.35, 0.55, 0.7, 0.55, col('#eeeeea'), new THREE.Vector3(0, 0, -1));
      break;
    }
    // ------------------------------------------------------------ petrol-station extras
    case 'carWashBay': {
      // Open drive-through bay along local z (p.d long, cars enter at -z): side walls, roof, lit sign band.
      const len = p.d ?? 14;
      const hw = 3.25;
      const h = 4.2;
      for (const x of [-hw, hw]) {
        L.box('solid', x - 0.15, 0, -len / 2, x + 0.15, h, len / 2, c1);
        // strip of frosted windows along each side wall (outside faces)
        L.box('glass', x - 0.17, 2.0, -len / 2 + 1, x + 0.17, 3.2, len / 2 - 1, col('#9fb4bf'));
      }
      L.box('solid', -hw - 0.3, h, -len / 2 - 0.3, hw + 0.3, h + 0.45, len / 2 + 0.3, c1); // roof slab
      L.box('lamp', -hw - 0.32, h + 0.05, -len / 2 - 0.32, hw + 0.32, h + 0.4, -len / 2 - 0.3, c2); // glowing fascia
      L.winQuad('window', [[-2.4, h + 0.55, -len / 2 - 0.05], [2.4, h + 0.55, -len / 2 - 0.05], [2.4, h + 1.45, -len / 2 - 0.05], [-2.4, h + 1.45, -len / 2 - 0.05]], c2, 4.8, 0.9, STYLE_ID.sign, 1.37, [0, 0, -1]);
      L.box('solid', -2.5, h + 0.45, -len / 2 + 0.05, 2.5, h + 1.5, -len / 2 + 0.25, DARK); // sign backing
      L.box('solid', -hw + 0.15, 0.02, -len / 2, hw - 0.15, 0.06, len / 2, col('#6f7378')); // wet floor
      for (const x of [-1.0, 1.0]) L.box('solid', x - 0.08, 0.06, -len / 2 + 0.5, x + 0.08, 0.2, len / 2 - 0.5, col('#f2c94c')); // guide rails
      L.box('lamp', -0.6, h - 0.08, -len / 4, 0.6, h - 0.02, len / 4, col('#ffffff'));
      break;
    }
    case 'airPump': {
      // Tyre air / water post: red cabinet, gauge screen, coiled hose.
      L.box('solid', -0.22, 0, -0.18, 0.22, 1.35, 0.18, c1);
      L.box('solid', -0.26, 1.35, -0.22, 0.26, 1.5, 0.22, col('#f2f2f0'));
      L.box('lamp', -0.12, 0.95, -0.2, 0.12, 1.15, -0.18, col('#9fe6ff'));
      L.shape('solid', SHAPES.tube, 0, 0.7, -0.24, 0.18, 0.05, 0.18, DARK, Z);
      L.beam('solid', [0.15, 0.7, -0.2], [0.4, 0.05, -0.6], 0.03, DARK);
      L.box('solid', -0.3, 1.55, -0.03, 0.3, 1.85, 0.03, col('#1f6fb5')); // "AIR" plate
      break;
    }
    case 'vacuum': {
      // Self-service vacuum: canister at the base, tall pole with an arm and two hoses.
      L.shape('solid', SHAPES.cylLow, 0, 0.5, 0, 0.35, 1.0, 0.35, c1);
      L.beam('solid', [0, 1.0, 0], [0, 3.0, 0], 0.09, STEEL);
      L.beam('solid', [0, 3.0, 0], [1.2, 3.0, 0], 0.07, STEEL);
      L.beam('solid', [1.2, 3.0, 0], [1.6, 1.0, 0.2], 0.05, DARK);
      L.beam('solid', [0.25, 0.9, 0], [0.9, 0.3, -0.3], 0.05, DARK);
      L.box('solid', -0.3, 2.5, -0.03, 0.3, 2.9, 0.03, c1);
      break;
    }
    case 'evCharger': {
      L.box('solid', -0.22, 0, -0.15, 0.22, 1.6, 0.15, col('#f2f2f0'));
      L.box('lamp', -0.04, 0.4, -0.17, 0.04, 1.4, -0.15, col('#2ecc71')); // status strip
      L.box('solid', -0.15, 1.1, -0.17, 0.15, 1.35, -0.15, DARK); // screen
      L.beam('solid', [0.22, 0.9, 0], [0.5, 0.1, -0.4], 0.04, DARK); // cable
      break;
    }
    case 'lpgCage': {
      // Gas cylinder exchange cage: steel frame, a few cylinders inside.
      L.box('solid', -0.85, 0, -0.45, 0.85, 0.08, 0.45, STEEL);
      L.box('solid', -0.85, 1.4, -0.45, 0.85, 1.48, 0.45, STEEL);
      for (const x of [-0.85, 0.85]) for (const z of [-0.45, 0.45]) L.beam('solid', [x, 0, z], [x, 1.45, z], 0.05, STEEL);
      for (let k = 0; k < 4; k++) L.shape('solid', SHAPES.cylLow, -0.6 + k * 0.4, 0.45, 0, 0.15, 0.8, 0.15, c1);
      break;
    }
    case 'iceChest': {
      L.box('solid', -0.7, 0, -0.4, 0.7, 1.05, 0.4, col('#f2f2f0'));
      L.box('solid', -0.72, 1.05, -0.42, 0.72, 1.15, 0.42, col('#1f6fb5'));
      L.box('solid', -0.5, 0.45, -0.41, 0.5, 0.75, -0.4, col('#1f6fb5')); // "ICE" panel
      break;
    }
    case 'vending': {
      L.box('solid', -0.45, 0, -0.4, 0.45, 1.9, 0.4, c1);
      L.box('lamp', -0.36, 0.7, -0.41, 0.2, 1.75, -0.4, col('#fff6e6'));
      L.box('solid', 0.24, 0.9, -0.42, 0.38, 1.4, -0.4, DARK); // coin / card panel
      break;
    }
    case 'tyreStack': {
      // Puncture-repair stacks of used tyres.
      const stacks = Math.round(p.w ?? 3);
      for (let k = 0; k < stacks; k++) {
        const n = 2 + Math.floor(h01(p.x + k, p.z) * 5);
        for (let i = 0; i < n; i++) L.shape('solid', SHAPES.cylLow, -0.8 + k * 0.8, 0.12 + i * 0.24, (h01(k, i) - 0.5) * 0.08, 0.36, 0.22, 0.36, DARK);
      }
      break;
    }
    // ------------------------------------------------------------ civic: sport & play
    case 'goalPost': {
      // Football goal facing -z: posts, crossbar, sloping back frame.
      const hw = (p.w ?? 7.32) / 2;
      const h = p.h ?? 2.44;
      const white = col('#f4f1ea');
      for (const x of [-hw, hw]) {
        L.beam('solid', [x, 0, 0], [x, h, 0], 0.12, white);
        L.beam('solid', [x, h, 0], [x, 0, 1.8], 0.05, STEEL);
      }
      L.beam('solid', [-hw, h, 0], [hw, h, 0], 0.12, white);
      L.beam('solid', [-hw, 0.05, 1.8], [hw, 0.05, 1.8], 0.05, STEEL);
      break;
    }
    case 'basketballHoop': {
      L.beam('solid', [0, 0, 0.9], [0, 3.3, 0.9], 0.14, STEEL);
      L.beam('solid', [0, 3.3, 0.9], [0, 3.3, -0.2], 0.1, STEEL);
      L.box('solid', -0.9, 2.9, -0.28, 0.9, 3.95, -0.22, col('#f4f1ea'));
      L.box('solid', -0.3, 3.05, -0.3, 0.3, 3.5, -0.28, col('#c0392b'));
      L.shape('solid', SHAPES.tube, 0, 3.05, -0.55, 0.23, 0.03, 0.23, col('#e67e22'));
      break;
    }
    case 'climbingFrame': {
      // Jungle gym: 2 x 2 m frame, deck, ladder, little slide.
      for (const x of [-1, 1]) for (const z of [-1, 1]) L.beam('solid', [x, 0, z], [x, 2.4, z], 0.1, c1);
      for (const y of [1.2, 2.4]) {
        L.beam('solid', [-1, y, -1], [1, y, -1], 0.07, c1);
        L.beam('solid', [-1, y, 1], [1, y, 1], 0.07, c1);
        L.beam('solid', [-1, y, -1], [-1, y, 1], 0.07, c1);
        L.beam('solid', [1, y, -1], [1, y, 1], 0.07, c1);
      }
      L.box('solid', -1, 1.15, -1, 1, 1.22, 1, c2);
      L.poly('solid', [[1, 3.0, -1], [1, 3.0, 1], [0, 3.6, 1], [0, 3.6, -1]], c2, [1, 1, 0]);
      L.poly('solid', [[-1, 3.0, -1], [-1, 3.0, 1], [0, 3.6, 1], [0, 3.6, -1]], c2, [-1, 1, 0]);
      for (let y = 0.3; y < 1.2; y += 0.3) L.beam('solid', [-0.4, y, 1.25], [0.4, y, 1.25], 0.05, c2);
      L.poly('solid', [[-0.35, 1.2, -1], [0.35, 1.2, -1], [0.35, 0.1, -2.8], [-0.35, 0.1, -2.8]], col('#f1c40f'), [0, 1, -0.5]);
      break;
    }
    case 'seesaw': {
      L.box('solid', -0.15, 0, -0.2, 0.15, 0.5, 0.2, STEEL);
      L.beam('solid', [-1.8, 0.25, 0], [1.8, 0.75, 0], 0.16, c1);
      for (const x of [-1.5, 1.5]) L.beam('solid', [x, x < 0 ? 0.3 : 0.7, -0.2], [x, x < 0 ? 0.6 : 1.0, 0.2], 0.04, STEEL);
      break;
    }
    case 'bleachers': {
      // Stepped aluminium seating facing -z; p.w long, p.h rows.
      const w = p.w ?? 10;
      const rows = Math.round(p.h ?? 5);
      for (let i = 0; i < rows; i++) L.box('solid', -w / 2, 0, -rows * 0.4 + i * 0.8, w / 2, 0.4 + i * 0.42, -rows * 0.4 + (i + 1) * 0.8, i % 2 ? c1 : col('#c9ccd1'));
      L.box('solid', -w / 2, 0.4 + rows * 0.42, rows * 0.4 - 0.05, w / 2, 1.5 + rows * 0.42, rows * 0.4, STEEL);
      break;
    }
    case 'grandstand': {
      // Big covered stand facing -z: stepped seating rows (two seat colours), back wall, cantilever roof.
      const w = p.w ?? 60;
      const d = p.d ?? 20;
      const h = p.h ?? 12;
      const rows = Math.max(6, Math.floor(d / 0.85));
      const rowD = d / rows;
      for (let i = 0; i < rows; i++) {
        const top = 1.2 + (i / rows) * (h - 2);
        L.box('solid', -w / 2, 0, -d / 2 + i * rowD, w / 2, top, -d / 2 + (i + 1) * rowD, Math.floor(i / 4) % 2 ? c1 : c2);
      }
      L.box('solid', -w / 2, 0, d / 2, w / 2, h + 3, d / 2 + 0.6, col('#c9c4b8'));
      // Big sponsor banners on the outside of the back wall.
      const banners = ['#c0392b', '#1f6fb5', '#f1c40f', '#27ae60', '#e67e22', '#1e1f22', '#e84393'];
      const nb = Math.max(1, Math.min(4, Math.floor(w / 18)));
      const bw = Math.min(14, (w / nb) * 0.7);
      for (let i = 0; i < nb; i++) {
        const bx = -w / 2 + (w / nb) * (i + 0.5);
        const y0 = h * 0.3;
        const y1 = y0 + Math.min(5, h * 0.4);
        const bc = col(banners[Math.floor(h01(p.x + i * 7.3, p.z - i) * banners.length)]);
        L.winQuad('window', [[bx + bw / 2, y0, d / 2 + 0.62], [bx - bw / 2, y0, d / 2 + 0.62], [bx - bw / 2, y1, d / 2 + 0.62], [bx + bw / 2, y1, d / 2 + 0.62]], bc, bw, y1 - y0, STYLE_ID.sign, 1 + h01(i, p.z) * 0.99, [0, 0, 1]);
      }
      for (let x = -w / 2 + 2; x <= w / 2 - 2; x += Math.max(8, w / 6)) L.beam('solid', [x, h + 3, d / 2 + 0.3], [x, h + 6.5, d / 2 + 0.3], 0.5, col('#9aa0a6'));
      L.box('solid', -w / 2 - 1, h + 6.5, -d / 2 + 2, w / 2 + 1, h + 7.1, d / 2 + 0.6, col('#e9e6df'));
      L.box('lamp', -w / 2, h + 6.4, -d / 2 + 2.4, w / 2, h + 6.48, -d / 2 + 3.0, col('#ffffff'));
      break;
    }
    case 'floodlight': {
      // Stadium floodlight mast with a lamp bank facing -z, tilted down.
      const h = p.h ?? 35;
      L.shape('solid', SHAPES.cylLow, 0, h / 2, 0, 0.6, h, 0.6, col('#9aa0a6'));
      L.box('solid', -2.6, h - 0.2, -0.4, 2.6, h + 3.0, 0.2, col('#5a5f66'));
      L.box('lamp', -2.4, h, -0.45, 2.4, h + 2.8, -0.4, col('#fffbe8'));
      break;
    }
    // ------------------------------------------------------------ civic: vehicles
    case 'ambulance': {
      L.box('solid', -1.05, 0.5, -1.0, 1.05, 2.9, 3.0, col('#f4f1ea'));
      L.box('solid', -1.0, 0.5, -2.6, 1.0, 2.1, -1.0, col('#f4f1ea'));
      L.box('glass', -0.95, 1.4, -2.65, 0.95, 2.05, -2.0, col('#1c2733'));
      L.box('solid', -1.07, 1.2, -2.6, 1.07, 1.5, 3.0, col('#c0392b'));
      L.box('lamp', -0.6, 2.9, -0.9, -0.05, 3.1, -0.6, col('#ff2a1a'));
      L.box('lamp', 0.05, 2.9, -0.9, 0.6, 3.1, -0.6, col('#2a6bff'));
      for (const z of [-1.8, 2.2]) for (const x of [-0.95, 0.95]) L.shape('solid', SHAPES.cylLow, x, 0.4, z, 0.4, 0.3, 0.4, DARK, X);
      break;
    }
    case 'fireTruck': {
      const red = col('#b3121b');
      L.box('solid', -1.25, 0.6, -4.5, 1.25, 3.2, -2.2, red);
      L.box('glass', -1.15, 2.1, -4.55, 1.15, 3.0, -4.4, col('#1c2733'));
      L.box('solid', -1.25, 0.6, -2.2, 1.25, 2.8, 4.5, red);
      L.box('solid', -1.27, 1.4, -2.2, 1.27, 1.6, 4.5, col('#f4f1ea'));
      for (const x of [-0.6, 0.6]) L.beam('solid', [x, 3.0, -2.0], [x, 3.0, 4.4], 0.12, STEEL); // ladder rails
      for (let z = -1.8; z < 4.4; z += 0.5) L.beam('solid', [-0.6, 3.0, z], [0.6, 3.0, z], 0.05, STEEL);
      L.box('lamp', -0.8, 3.2, -4.3, 0.8, 3.35, -4.0, col('#ff2a1a'));
      for (const z of [-3.4, 2.0, 3.4]) for (const x of [-1.1, 1.1]) L.shape('solid', SHAPES.cylLow, x, 0.5, z, 0.5, 0.35, 0.5, DARK, X);
      break;
    }
    case 'bus': {
      // Bus along local z, front at -z; windows band on both sides.
      const len = p.d ?? 11;
      L.box('solid', -1.25, 0.35, -len / 2, 1.25, 3.1, len / 2, c1);
      L.box('glass', -1.27, 1.6, -len / 2 + 0.4, 1.27, 2.6, len / 2 - 0.6, col('#1c2733'));
      L.box('glass', -1.15, 1.2, -len / 2 - 0.02, 1.15, 2.7, -len / 2 + 0.1, col('#1c2733'));
      L.box('lamp', -0.9, 2.75, -len / 2 - 0.03, 0.9, 2.95, -len / 2, col('#ffcf6b')); // destination board
      for (const z of [-len / 2 + 2, len / 2 - 2.5]) for (const x of [-1.1, 1.1]) L.shape('solid', SHAPES.cylLow, x, 0.5, z, 0.5, 0.3, 0.5, DARK, X);
      break;
    }
    case 'garbageTruck': {
      L.box('solid', -1.2, 0.6, -4.2, 1.2, 3.0, -2.2, col('#f4f1ea'));
      L.box('glass', -1.1, 1.9, -4.25, 1.1, 2.8, -4.1, col('#1c2733'));
      L.box('solid', -1.25, 0.8, -2.1, 1.25, 3.4, 3.4, c1);
      L.box('solid', -1.15, 0.6, 3.4, 1.15, 3.0, 4.6, col('#5a5f66')); // rear hopper
      for (const z of [-3.2, 2.0, 3.2]) for (const x of [-1.05, 1.05]) L.shape('solid', SHAPES.cylLow, x, 0.5, z, 0.5, 0.35, 0.5, DARK, X);
      break;
    }
    case 'bulldozer': {
      const yellow = col('#f2c94c');
      for (const x of [-1.2, 1.2]) L.box('solid', x - 0.35, 0, -1.6, x + 0.35, 0.9, 1.6, DARK);
      L.box('solid', -0.9, 0.8, -1.2, 0.9, 1.9, 1.5, yellow);
      L.box('solid', -0.7, 1.9, 0.0, 0.7, 3.0, 1.3, yellow);
      L.box('glass', -0.65, 2.1, -0.02, 0.65, 2.9, 0.02, col('#1c2733'));
      L.box('solid', -1.8, 0.1, -2.6, 1.8, 1.4, -2.3, yellow); // blade
      for (const x of [-0.8, 0.8]) L.beam('solid', [x, 1.0, -2.3], [x, 1.2, -1.2], 0.15, DARK);
      break;
    }
    case 'skip': {
      // Open roll-off skip, contents mounded inside.
      L.box('solid', -1.2, 0, -2.5, 1.2, 0.15, 2.5, c1);
      for (const x of [-1.2, 1.2]) L.poly('solid', [[x, 0.1, -2.5], [x, 0.1, 2.5], [x * 1.08, 1.5, 3.0], [x * 1.08, 1.5, -3.0]], c1, [x, 0.2, 0]);
      L.poly('solid', [[-1.2, 0.1, -2.5], [1.2, 0.1, -2.5], [1.3, 1.5, -3.0], [-1.3, 1.5, -3.0]], c1, [0, 0.2, -1]);
      L.poly('solid', [[-1.2, 0.1, 2.5], [1.2, 0.1, 2.5], [1.3, 1.5, 3.0], [-1.3, 1.5, 3.0]], c1, [0, 0.2, 1]);
      b.geometry('solid', TEMPLATES.blob, new THREE.Matrix4().compose(L.p(0, 1.2, 0), new THREE.Quaternion(), new THREE.Vector3(1.1, 0.6, 2.4)), col('#6b5d4f'));
      break;
    }
    // ------------------------------------------------------------ civic: transport
    case 'train': {
      // Carriages along local z on rails (floor at y = 1.0); loco nose at -z.
      const len = p.d ?? 60;
      const n = Math.max(1, Math.round(len / 20));
      const cl = len / n - 0.8;
      for (let i = 0; i < n; i++) {
        const z0 = -len / 2 + i * (cl + 0.8);
        L.box('solid', -1.5, 1.0, z0, 1.5, 4.2, z0 + cl, i === 0 ? c2 : c1);
        L.box('solid', -1.4, 4.2, z0 + 0.3, 1.4, 4.45, z0 + cl - 0.3, col('#9aa0a6'));
        L.box('glass', -1.52, 2.4, z0 + 1, 1.52, 3.4, z0 + cl - 1, col('#1c2733'));
        L.box('solid', -1.52, 1.5, z0 + 0.5, 1.52, 1.75, z0 + cl - 0.5, c2);
        for (const zb of [z0 + 2.5, z0 + cl - 2.5]) L.box('solid', -1.1, 0.55, zb - 1.2, 1.1, 1.0, zb + 1.2, DARK); // bogies
      }
      L.box('glass', -1.3, 2.6, -len / 2 - 0.02, 1.3, 3.6, -len / 2 + 0.1, col('#1c2733'));
      L.box('lamp', -1.0, 1.6, -len / 2 - 0.04, -0.6, 1.8, -len / 2, col('#fff6e6'));
      L.box('lamp', 0.6, 1.6, -len / 2 - 0.04, 1.0, 1.8, -len / 2, col('#fff6e6'));
      break;
    }
    case 'railTrack': {
      // Ballast bed, sleepers and two rails along local x (p.w long).
      const w = p.w ?? 60;
      L.box('solid', -w / 2, 0, -1.6, w / 2, 0.3, 1.6, col('#8a8178'));
      for (let x = -w / 2 + 0.4; x < w / 2; x += 1.2) L.box('solid', x - 0.13, 0.3, -1.25, x + 0.13, 0.42, 1.25, col('#5a4632'));
      for (const z of [-0.72, 0.72]) L.box('solid', -w / 2, 0.42, z - 0.04, w / 2, 0.58, z + 0.04, col('#9aa0a6'));
      break;
    }
    case 'parkingDeck': {
      // One open deck of a parking garage: slab, columns down to the level below, parapet, bay lines.
      const w = p.w ?? 40;
      const d = p.d ?? 30;
      const h = p.h ?? 3;
      const conc = col('#c9c4b8');
      L.box('solid', -w / 2, -0.3, -d / 2, w / 2, 0, d / 2, conc);
      // Columns on the perimeter and along the aisle edges (clear of the stall rows).
      for (let x = -w / 2 + 0.4; x <= w / 2 - 0.3; x += 7.8) for (const z of [-d / 2 + 0.3, -d / 2 + 5.9, d / 2 - 5.9, d / 2 - 0.3]) L.box('solid', x - 0.3, -h, z - 0.3, x + 0.3, -0.3, z + 0.3, conc);
      L.box('solid', -w / 2, 0, -d / 2, w / 2, 1.0, -d / 2 + 0.2, c1);
      L.box('solid', -w / 2, 0, d / 2 - 0.2, w / 2, 1.0, d / 2, c1);
      L.box('solid', -w / 2, 0, -d / 2, -w / 2 + 0.2, 1.0, d / 2, c1);
      if (p.n === 1) L.box('solid', w / 2 - 0.2, 0, -d / 2, w / 2, 0.2, d / 2, c1); // open to the ramp tower
      else L.box('solid', w / 2 - 0.2, 0, -d / 2, w / 2, 1.0, d / 2, c1);
      for (const zr of [-d / 2 + 0.5, d / 2 - 5.5]) for (let x = -w / 2 + 1; x < w / 2 - 1; x += 2.6) L.box('solid', x - 0.05, 0, zr, x + 0.05, 0.01, zr + 5, col('#f4f1ea'));
      break;
    }
    case 'ramp': {
      // Sloped ramp along local z from y = 0 (at -z) up to p.h (at +z), p.w wide, with kerbs.
      const w = p.w ?? 6;
      const len = p.d ?? 18;
      const h = p.h ?? 3;
      L.poly('solid', [[-w / 2, 0.02, -len / 2], [w / 2, 0.02, -len / 2], [w / 2, h, len / 2], [-w / 2, h, len / 2]], col('#b9b4aa'), [0, 1, -0.2]);
      L.poly('solid', [[-w / 2, -0.25, -len / 2], [w / 2, -0.25, -len / 2], [w / 2, h - 0.3, len / 2], [-w / 2, h - 0.3, len / 2]], col('#a9a49a'), [0, -1, 0.2]);
      for (const x of [-w / 2, w / 2]) L.beam('solid', [x, 0.5, -len / 2], [x, h + 0.5, len / 2], 0.2, col('#c9c4b8'));
      break;
    }
    // ------------------------------------------------------------ civic: parks & utilities
    case 'gazebo': {
      const r = p.w ?? 2.5;
      L.shape('solid', SHAPES.cylLow, 0, 0.15, 0, r, 0.3, r, col('#d8d2c4'));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        L.beam('solid', [Math.cos(a) * r * 0.9, 0.3, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.9, 2.6, Math.sin(a) * r * 0.9], 0.15, col('#f4f1ea'));
      }
      L.shape('solid', SHAPES.tube, 0, 0.9, 0, r * 0.9, 0.08, r * 0.9, col('#f4f1ea'));
      L.shape('solid', SHAPES.cone, 0, 3.2, 0, r * 1.15, 1.3, r * 1.15, c1);
      break;
    }
    case 'fountain': {
      const r = p.w ?? 3;
      L.shape('solid', SHAPES.tube, 0, 0.3, 0, r, 0.6, r, col('#d8d2c4'));
      L.shape('solid', SHAPES.tube, 0, 0.58, 0, r + 0.15, 0.06, r + 0.15, col('#e9e6df'));
      L.shape('water', SHAPES.cyl, 0, 0.25, 0, r - 0.05, 0.5, r - 0.05, col('#3aa6cc'));
      L.shape('solid', SHAPES.cylLow, 0, 0.9, 0, 0.35, 1.8, 0.35, col('#d8d2c4'));
      L.shape('solid', SHAPES.cylLow, 0, 1.8, 0, 1.0, 0.15, 1.0, col('#d8d2c4'));
      L.shape('water', SHAPES.cylLow, 0, 1.9, 0, 0.9, 0.08, 0.9, col('#5fc0e0'));
      break;
    }
    case 'mound': {
      // Landfill heap: a few flattened lumps of soil and rubbish.
      const r = p.w ?? 10;
      const h = p.h ?? 5;
      for (let k = 0; k < 5; k++) {
        const a = h01(p.x + k, p.z) * Math.PI * 2;
        const d = k === 0 ? 0 : r * 0.45 * h01(k, p.x);
        b.geometry('solid', TEMPLATES.blob, new THREE.Matrix4().compose(L.p(Math.cos(a) * d, 0, Math.sin(a) * d), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(r * (k === 0 ? 1 : 0.55), h * (k === 0 ? 1 : 0.7), r * (k === 0 ? 0.85 : 0.5))), col(k % 2 ? '#6b5d4f' : '#7d7366'));
      }
      for (let k = 0; k < 8; k++) {
        const a = h01(k, p.z) * Math.PI * 2;
        const d = r * 0.6 * h01(p.x, k);
        const debris = ['#c0392b', '#1f6fb5', '#f4f1ea', '#27ae60', '#f39c12'][k % 5];
        L.box('solid', Math.cos(a) * d - 0.3, h * 0.55 * (1 - d / r), Math.sin(a) * d - 0.3, Math.cos(a) * d + 0.3, h * 0.55 * (1 - d / r) + 0.4, Math.sin(a) * d + 0.3, col(debris));
      }
      break;
    }
    case 'transformer': {
      const grey = col('#8a8f96');
      L.box('solid', -1.0, 0, -0.8, 1.0, 2.4, 0.8, grey);
      for (let z = -0.6; z <= 0.61; z += 0.3) L.box('solid', 1.0, 0.3, z - 0.04, 1.35, 2.0, z + 0.04, grey); // cooling fins
      for (const x of [-0.6, 0, 0.6]) for (let k = 0; k < 4; k++) L.shape('solid', SHAPES.cylLow, x, 2.5 + k * 0.18, 0, 0.12 - k * 0.01, 0.14, 0.12 - k * 0.01, col('#e9e6df'));
      L.box('solid', -1.05, 0, -0.85, 1.05, 0.3, 0.85, col('#5a5f66'));
      break;
    }
    case 'waterTowerTall': {
      // Municipal water tower: column + big tank with conical underside and roof.
      const h = p.h ?? 25;
      const r = p.w ?? 5;
      L.shape('solid', SHAPES.cyl, 0, h / 2, 0, 1.4, h, 1.4, c2);
      L.shape('solid', SHAPES.cone, 0, h - 1.5, 0, r, 3, r, c1, new THREE.Vector3(0, -1, 0));
      L.shape('solid', SHAPES.cyl, 0, h + 2.0, 0, r, 4, r, c1);
      L.shape('solid', SHAPES.cone, 0, h + 4.6, 0, r * 1.02, 1.2, r * 1.02, c2);
      L.shape('solid', SHAPES.tube, 0, h + 2.0, 0, r + 0.3, 0.12, r + 0.3, STEEL); // walkway rail
      break;
    }
    case 'clockTower': {
      const h = p.h ?? 20;
      L.box('solid', -2, 0, -2, 2, h, 2, c1);
      L.box('solid', -2.2, h - 4.5, -2.2, 2.2, h - 4.2, 2.2, c2);
      for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        L.shape('lamp', SHAPES.cyl, nx * 2.02, h - 2.3, nz * 2.02, 1.2, 0.08, 1.2, col('#f4f1ea'), new THREE.Vector3(nx, 0, nz));
        L.beam('solid', [nx * 2.1, h - 2.3, nz * 2.1], [nx * 2.1 + nz * 0.0, h - 1.5, nz * 2.1 + nx * 0.0], 0.08, DARK);
      }
      L.shape('solid', SHAPES.cone, 0, h + 2.0, 0, 2.6, 4, 2.6, c2);
      break;
    }
    case 'pond': {
      // Irregular pond: overlapping water discs with a stone / reed edge (p.w x p.d radii).
      const rx = p.w ?? 6;
      const rz = p.d ?? 4;
      const lobes: [number, number, number, number][] = [[0, 0, rx, rz], [rx * 0.45, rz * 0.35, rx * 0.6, rz * 0.6], [-rx * 0.4, -rz * 0.3, rx * 0.55, rz * 0.65]];
      for (const [x, z, a, c] of lobes) {
        L.shape('solid', SHAPES.cyl, x, 0.04, z, a + 0.5, 0.08, c + 0.5, col('#8f8a7d'));
        L.shape('water', SHAPES.cyl, x, 0.07, z, a, 0.1, c, col('#3f8fa8'));
      }
      for (let k = 0; k < 9; k++) {
        const t = (k / 9) * Math.PI * 2 + h01(p.x, k) * 0.4;
        const x = Math.cos(t) * (rx + 0.3);
        const z = Math.sin(t) * (rz + 0.3);
        if (k % 3 === 0) b.geometry('solid', TEMPLATES.blob, new THREE.Matrix4().compose(L.p(x, 0.15, z), new THREE.Quaternion(), new THREE.Vector3(0.5, 0.3, 0.45)), col('#9a958a'));
        else for (let r = 0; r < 3; r++) L.beam('solid', [x + r * 0.15, 0, z], [x + r * 0.2, 0.9 + r * 0.2, z + 0.1], 0.04, col('#6f8a3a'));
      }
      break;
    }
    case 'pylon': {
      // Lattice power-line tower: tapered legs, cross bracing, two cross-arms with insulators. Arms along x.
      const h = p.h ?? 24;
      const g = 0.11;
      const st = col('#8f959c');
      const legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const base = 2.4;
      const top = 0.7;
      for (const [sx, sz] of legs) L.beam('solid', [sx * base, 0, sz * base], [sx * top, h, sz * top], g * 1.6, st);
      for (let k = 0; k < 4; k++) {
        const y0 = (h * k) / 4;
        const y1 = (h * (k + 1)) / 4;
        const w0 = base + (top - base) * (k / 4);
        const w1 = base + (top - base) * ((k + 1) / 4);
        L.beam('solid', [-w0, y0, -w0], [w1, y1, -w1], g, st);
        L.beam('solid', [-w0, y0, w0], [w1, y1, w1], g, st);
        L.beam('solid', [-w0, y0, -w0], [-w1, y1, w1], g, st);
        L.beam('solid', [w0, y0, -w0], [w1, y1, w1], g, st);
      }
      for (const [y, a] of [[h * 0.78, 4.5], [h * 0.95, 3.2]] as const) {
        L.beam('solid', [-a, y, 0], [a, y, 0], 0.22, st);
        for (const x of [-a + 0.3, a - 0.3]) for (let i = 0; i < 4; i++) L.shape('solid', SHAPES.cylLow, x, y - 0.25 - i * 0.18, 0, 0.14, 0.12, 0.14, col('#e9e6df'));
      }
      L.shape('solid', SHAPES.cone, 0, h + 1.0, 0, 0.6, 2, 0.6, st);
      break;
    }
    case 'platformCanopy': {
      // Long railway platform canopy along x (p.w), p.d deep, columns down the middle, light strip under.
      const w = p.w ?? 60;
      const d = p.d ?? 6;
      const h = p.h ?? 4;
      for (let x = -w / 2 + 2; x <= w / 2 - 2 + 1e-6; x += Math.max(6, (w - 4) / Math.max(1, Math.round((w - 4) / 9)))) {
        L.box('solid', x - 0.15, 0, -0.15, x + 0.15, h, 0.15, c2);
        L.beam('solid', [x, h - 0.8, 0], [x, h, -d / 2], 0.12, c2);
        L.beam('solid', [x, h - 0.8, 0], [x, h, d / 2], 0.12, c2);
      }
      L.poly('solid', [[-w / 2, h, -d / 2], [w / 2, h, -d / 2], [w / 2, h + 0.5, 0], [-w / 2, h + 0.5, 0]], c1, [0, 1, -0.3]);
      L.poly('solid', [[w / 2, h, d / 2], [-w / 2, h, d / 2], [-w / 2, h + 0.5, 0], [w / 2, h + 0.5, 0]], c1, [0, 1, 0.3]);
      L.poly('solid', [[w / 2, h - 0.02, -d / 2], [-w / 2, h - 0.02, -d / 2], [-w / 2, h - 0.02, d / 2], [w / 2, h - 0.02, d / 2]], c1, [0, -1, 0]);
      L.box('lamp', -w / 2 + 1, h - 0.12, -0.25, w / 2 - 1, h - 0.04, 0.25, col('#fff6e6'));
      break;
    }
    case 'garageRamp': {
      // Two-lane scissor ramp tower along local z (p.d long, p.w wide, p.h per level, p.n levels).
      // Lane A (x < 0) carries ramps from even levels going +z, lane B (x > 0) from odd levels going -z;
      // flat landings span both lanes at alternating ends. Same-lane ramps are two levels apart, so they never meet.
      const w = p.w ?? 7;
      const d = p.d ?? 30;
      const h = p.h ?? 3;
      const n = p.n ?? 3;
      const Lg = Math.min(6, d * 0.2);
      const conc = col('#c9c4b8');
      const deck = col('#b4afa5');
      const t = 0.25;
      const ramp = (xa: number, xb: number, za: number, ya: number, zb: number, yb: number, outer: number) => {
        L.poly('solid', [[xa, ya, za], [xb, ya, za], [xb, yb, zb], [xa, yb, zb]], deck, [0, 1, 0]);
        L.poly('solid', [[xa, ya - t, za], [xb, ya - t, za], [xb, yb - t, zb], [xa, yb - t, zb]], conc, [0, -1, 0]);
        for (const x of [xa, xb]) L.poly('solid', [[x, ya - t, za], [x, ya, za], [x, yb, zb], [x, yb - t, zb]], conc, [x === xa ? -1 : 1, 0, 0]);
        // outer parapet wall and inner kerb, sloped with the ramp (both faces)
        const xo = outer < 0 ? xa : xb;
        const xi = outer < 0 ? xb : xa;
        for (const [x, hh] of [[xo, 1.0], [xi, 0.25]] as const) {
          L.poly('solid', [[x, ya, za], [x, ya + hh, za], [x, yb + hh, zb], [x, yb, zb]], conc, [outer, 0, 0]);
          L.poly('solid', [[x, ya, za], [x, ya + hh, za], [x, yb + hh, zb], [x, yb, zb]], conc, [-outer, 0, 0]);
        }
      };
      const zs = -d / 2 + Lg;
      const ze = d / 2 - Lg;
      for (let k = 0; k < n; k++) {
        if (k % 2 === 0) ramp(-w / 2, 0, zs, k * h + 0.02, ze, (k + 1) * h, -1);
        else ramp(0, w / 2, ze, k * h + 0.02, zs, (k + 1) * h, 1);
      }
      for (let j = 1; j <= n; j++) {
        const y = j * h;
        const atPlus = j % 2 === 1;
        const z0 = atPlus ? ze : -d / 2;
        const z1 = atPlus ? d / 2 : zs;
        L.box('solid', -w / 2, y - 0.3, z0, w / 2, y, z1, deck);
        const zEnd = atPlus ? d / 2 : -d / 2;
        L.box('solid', -w / 2, y, zEnd - 0.1, w / 2, y + 1.0, zEnd + 0.1, c1); // end parapet
        L.box('solid', w / 2 - 0.15, y, z0, w / 2, y + 1.0, z1, c1); // outer parapet
      }
      for (const x of [-w / 2 + 0.25, 0, w / 2 - 0.25]) for (const z of [-d / 2 + 0.3, zs, ze, d / 2 - 0.3]) L.box('solid', x - 0.25, 0, z - 0.25, x + 0.25, n * h - 0.3, z + 0.25, conc);
      // height-limit bar over the entry lane
      L.box('solid', -w / 2, 2.3, -d / 2 - 0.4, 0, 2.5, -d / 2 - 0.2, col('#f2c94c'));
      break;
    }
    case 'adBoards': {
      // Pitch-side advertising hoardings along local x (p.w long, p.h tall), facing -z; lit panels in brand colours.
      const w = p.w ?? 60;
      const h = p.h ?? 0.9;
      const brands = ['#c0392b', '#1f6fb5', '#f1c40f', '#27ae60', '#e67e22', '#8e44ad', '#1e1f22', '#e84393', '#16a085', '#f4f1ea'];
      const n = Math.max(1, Math.round(w / 5));
      const pw = w / n;
      L.box('solid', -w / 2, 0, 0.02, w / 2, h, 0.25, DARK);
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + i * pw + 0.04;
        const x1 = x0 + pw - 0.08;
        const bc = col(brands[Math.floor(h01(p.x + i * 3.1, p.z + i) * brands.length)]);
        L.winQuad('window', [[x0, 0.08, 0], [x1, 0.08, 0], [x1, h - 0.05, 0], [x0, h - 0.05, 0]], bc, x1 - x0, h - 0.13, STYLE_ID.sign, 1 + h01(i, p.x) * 0.99, [0, 0, -1]);
      }
      break;
    }
    case 'scoreboard': {
      // Big video screen on a frame, facing -z (p.w wide).
      const w = p.w ?? 12;
      const sh = w * 0.42;
      for (const x of [-w * 0.35, w * 0.35]) L.beam('solid', [x, 0, 0.4], [x, 1.2, 0.4], 0.35, STEEL);
      L.box('solid', -w / 2 - 0.3, 1.2, 0, w / 2 + 0.3, 1.2 + sh + 0.6, 0.8, DARK);
      L.box('lamp', -w / 2, 1.5, -0.04, w / 2, 1.5 + sh * 0.62, 0, col('#3aa0ff'));
      L.box('lamp', -w / 2, 1.5 + sh * 0.66, -0.04, -0.02, 1.5 + sh - 0.05, 0, col('#ffcf3a'));
      L.box('lamp', 0.02, 1.5 + sh * 0.66, -0.04, w / 2, 1.5 + sh - 0.05, 0, col('#ff5a4a'));
      break;
    }
    case 'footbridge': {
      // Arched footbridge along local z (p.d span, p.w wide, p.h rise) with railings and stone abutments.
      const len = p.d ?? 14;
      const w = p.w ?? 2.6;
      const rise = p.h ?? 1.2;
      const N = 10;
      const y = (u: number) => 0.3 + rise * Math.sin(Math.PI * u);
      const zAt = (u: number) => -len / 2 + len * u;
      const under = c1.clone().multiplyScalar(0.7);
      const side = c1.clone().multiplyScalar(0.85);
      for (let i = 0; i < N; i++) {
        const u0 = i / N;
        const u1 = (i + 1) / N;
        L.poly('solid', [[-w / 2, y(u0), zAt(u0)], [w / 2, y(u0), zAt(u0)], [w / 2, y(u1), zAt(u1)], [-w / 2, y(u1), zAt(u1)]], c1, [0, 1, 0]);
        L.poly('solid', [[-w / 2, y(u0) - 0.25, zAt(u0)], [w / 2, y(u0) - 0.25, zAt(u0)], [w / 2, y(u1) - 0.25, zAt(u1)], [-w / 2, y(u1) - 0.25, zAt(u1)]], under, [0, -1, 0]);
        for (const x of [-w / 2, w / 2]) {
          L.poly('solid', [[x, y(u0) - 0.25, zAt(u0)], [x, y(u0), zAt(u0)], [x, y(u1), zAt(u1)], [x, y(u1) - 0.25, zAt(u1)]], side, [x, 0, 0]);
          L.beam('solid', [x, y(u0) + 1.0, zAt(u0)], [x, y(u1) + 1.0, zAt(u1)], 0.08, c2);
          L.beam('solid', [x, y(u0), zAt(u0)], [x, y(u0) + 1.0, zAt(u0)], 0.08, c2);
        }
      }
      for (const x of [-w / 2, w / 2]) L.beam('solid', [x, y(1), zAt(1)], [x, y(1) + 1.0, zAt(1)], 0.08, c2);
      for (const z of [-len / 2, len / 2]) L.box('solid', -w / 2 - 0.4, 0, z - 0.8, w / 2 + 0.4, 0.4, z + 0.8, col('#a39d92'));
      break;
    }
    case 'animal':
      drawAnimal(L, p.n ?? 0, h01(p.x, p.z));
      break;
    case 'aviary': {
      // Domed bird cage: low wall, meridian ribs, two rings.
      const r = p.w ?? 7;
      const steel = col('#e9e6df');
      L.shape('solid', SHAPES.tube, 0, 0.4, 0, r, 0.8, r, col('#a39d92'));
      const M = 10;
      for (let k = 0; k < M; k++) {
        const a = (k / M) * Math.PI * 2;
        for (let i = 0; i < 6; i++) {
          const t0 = (i / 6) * (Math.PI / 2);
          const t1 = ((i + 1) / 6) * (Math.PI / 2);
          L.beam('solid', [Math.cos(a) * r * Math.cos(t0), 0.8 + r * Math.sin(t0), Math.sin(a) * r * Math.cos(t0)], [Math.cos(a) * r * Math.cos(t1), 0.8 + r * Math.sin(t1), Math.sin(a) * r * Math.cos(t1)], 0.1, steel);
        }
      }
      for (const t of [0.35, 0.8]) L.shape('solid', SHAPES.tube, 0, 0.8 + r * Math.sin(t), 0, r * Math.cos(t), 0.08, r * Math.cos(t), steel);
      L.shape('solid', SHAPES.sphere, 0, 0.8 + r, 0, 0.4, 0.4, 0.4, steel);
      break;
    }
    case 'gateArch': {
      // Entrance arch: two pillars + a sign beam (lit sign on both faces); p.w span, p.h height.
      const w = p.w ?? 8;
      const h = p.h ?? 5;
      for (const x of [-w / 2, w / 2]) {
        L.box('solid', x - 0.6, 0, -0.6, x + 0.6, h, 0.6, c2);
        L.shape('solid', SHAPES.cone, x, h + 0.6, 0, 0.9, 1.2, 0.9, c1);
      }
      L.box('solid', -w / 2, h - 1.6, -0.3, w / 2, h - 0.2, 0.3, c1);
      for (const s of [-1, 1]) {
        const z = s * 0.31;
        const pts: [number, number, number][] = s < 0
          ? [[-w / 2 + 0.7, h - 1.45, z], [w / 2 - 0.7, h - 1.45, z], [w / 2 - 0.7, h - 0.35, z], [-w / 2 + 0.7, h - 0.35, z]]
          : [[w / 2 - 0.7, h - 1.45, z], [-w / 2 + 0.7, h - 1.45, z], [-w / 2 + 0.7, h - 0.35, z], [w / 2 - 0.7, h - 0.35, z]];
        L.winQuad('window', pts, c1, w - 1.4, 1.1, STYLE_ID.sign, 1.5, [0, 0, s]);
      }
      break;
    }
    case 'statue': {
      const stone = col('#cfc8bb');
      L.box('solid', -0.9, 0, -0.9, 0.9, 0.5, 0.9, stone);
      L.box('solid', -0.6, 0.5, -0.6, 0.6, 1.9, 0.6, stone);
      L.box('solid', -0.25, 1.9, -0.18, 0.25, 2.8, 0.18, c1);
      L.box('solid', -0.32, 2.8, -0.22, 0.32, 3.55, 0.22, c1);
      L.shape('solid', SHAPES.sphere, 0, 3.8, 0, 0.2, 0.22, 0.2, c1);
      L.beam('solid', [0.3, 3.4, 0], [0.75, 4.1, -0.2], 0.12, c1);
      break;
    }
    case 'rock': {
      const s = p.w ?? 1;
      b.geometry('solid', TEMPLATES.blob, new THREE.Matrix4().compose(L.p(0, s * 0.35, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot), new THREE.Vector3(s, s * 0.7, s * 0.85)), c1);
      break;
    }
    case 'picnicTable': {
      const wood = col('#8a6a4a');
      L.box('solid', -0.9, 0.72, -0.4, 0.9, 0.78, 0.4, wood);
      for (const z of [-0.75, 0.75]) L.box('solid', -0.9, 0.42, z - 0.15, 0.9, 0.47, z + 0.15, wood);
      for (const x of [-0.7, 0.7]) {
        L.beam('solid', [x, 0, -0.8], [x, 0.75, 0.2], 0.07, wood);
        L.beam('solid', [x, 0, 0.8], [x, 0.75, -0.2], 0.07, wood);
      }
      break;
    }
    case 'laundry': {
      // Clothes draped over a balcony rail: local -z points out of the building, origin on the rail top.
      const w = p.w ?? 2;
      const cloths = ['#e74c3c', '#3498db', '#ecf0f1', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22', '#ff8fab', '#34495e'];
      const n = Math.max(2, Math.floor(w / 0.55));
      for (let i = 0; i < n; i++) {
        if (h01(p.x + i, p.z) < 0.25) continue;
        const x = -w / 2 + (i + 0.5) * (w / n);
        const cw = 0.3 + h01(i, p.x) * 0.2;
        const ch = 0.35 + h01(p.z, i) * 0.45;
        L.box('solid', x - cw / 2, -ch, -0.06, x + cw / 2, 0.02, -0.03, col(cloths[Math.floor(h01(p.x + i * 3, p.z + i) * cloths.length)]));
      }
      break;
    }
    case 'roofSign': {
      // Big rooftop sign on a steel frame, lettering + glow from the sign shader. Faces -z.
      const w = p.w ?? 10;
      const h = p.h ?? 2.5;
      const base = 1.2;
      for (const x of [-w / 2 + 0.4, 0, w / 2 - 0.4]) {
        L.beam('solid', [x, 0, 0], [x, base + h, 0], 0.12, STEEL);
        L.beam('solid', [x, 0, 1.2], [x, base + h * 0.8, 0.05], 0.08, STEEL);
      }
      L.box('solid', -w / 2, base, 0.02, w / 2, base + h, 0.2, DARK);
      L.winQuad('window', [[-w / 2 + 0.05, base + 0.05, -0.01], [w / 2 - 0.05, base + 0.05, -0.01], [w / 2 - 0.05, base + h - 0.05, -0.01], [-w / 2 + 0.05, base + h - 0.05, -0.01]], c1, w - 0.1, h - 0.1, STYLE_ID.sign, 1 + ((p.x * 7.31 + p.z * 3.17) % 1 + 1) % 1 * 0.99, [0, 0, -1]);
      break;
    }
    case 'solarPanels': {
      const w = p.w ?? 4;
      const d = p.d ?? 2;
      if (p.h !== undefined) {
        // Flush on a sloped roof: local +z is uphill, slope = p.h (rise/run).
        const slope = p.h;
        const cols = Math.max(1, Math.floor(w / 1.05));
        const rows = Math.max(1, Math.floor(d / 1.75));
        const pw = w / cols;
        const pd = d / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x0 = -w / 2 + c * pw + 0.03;
            const x1 = x0 + pw - 0.06;
            const z0 = -d / 2 + r * pd + 0.03;
            const z1 = z0 + pd - 0.06;
            L.poly('glass', [[x0, z0 * slope, z0], [x1, z0 * slope, z0], [x1, z1 * slope, z1], [x0, z1 * slope, z1]], c1, [0, 1, -slope]);
          }
        }
        // aluminium frame underneath
        L.poly('solid', [[-w / 2 - 0.03, -d / 2 * slope - 0.03, -d / 2 - 0.03], [w / 2 + 0.03, -d / 2 * slope - 0.03, -d / 2 - 0.03], [w / 2 + 0.03, (d / 2) * slope - 0.03, d / 2 + 0.03], [-w / 2 - 0.03, (d / 2) * slope - 0.03, d / 2 + 0.03]], col('#c9ccd1'), [0, 1, -slope]);
        break;
      }
      const rows = Math.max(1, Math.floor(d / 1.6));
      const tilt = 0.45;
      for (let r = 0; r < rows; r++) {
        const z0 = -d / 2 + r * (d / rows);
        const z1 = z0 + (d / rows) * 0.8;
        const yLow = 0.3;
        const yHigh = yLow + (z1 - z0) * tilt;
        L.poly('glass', [[-w / 2, yLow, z0], [w / 2, yLow, z0], [w / 2, yHigh, z1], [-w / 2, yHigh, z1]], c1, [0, 1, -0.4]);
        for (let i = 1; i < Math.floor(w / 1.0); i++) {
          const x = -w / 2 + i * 1.0;
          L.beam('solid', [x, yLow + 0.005, z0], [x, yHigh + 0.005, z1], 0.02, col('#c9ccd1'));
        }
        for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) {
          L.beam('solid', [sx, 0, z0 + 0.05], [sx, yLow, z0 + 0.05], 0.05, STEEL);
          L.beam('solid', [sx, 0, z1 - 0.05], [sx, yHigh, z1 - 0.05], 0.05, STEEL);
        }
      }
      break;
    }
    case 'satelliteDish': {
      L.beam('solid', [0, 0, 0], [0, 0, -0.4], 0.05, STEEL);
      // flattened sphere tilted up and away from the wall
      L.shape('solid', SHAPES.cylLow, 0, 0.05, -0.45, 0.42, 0.06, 0.42, c1, new THREE.Vector3(0, 0.6, -1));
      L.beam('solid', [0, 0.05, -0.45], [0, 0.3, -0.85], 0.025, STEEL);
      break;
    }
    case 'car': {
      const body = c1;
      const glass = col('#1c2733');
      L.box('solid', -0.88, 0.3, -2.15, 0.88, 0.95, 2.15, body);
      L.box('solid', -0.86, 0.3, -2.25, 0.86, 0.65, -2.1, DARK); // bumpers
      L.box('solid', -0.86, 0.3, 2.1, 0.86, 0.65, 2.25, DARK);
      // cabin: glass box with a painted roof
      L.box('glass', -0.78, 0.95, -0.9, 0.78, 1.45, 1.2, glass);
      L.box('solid', -0.8, 1.45, -0.75, 0.8, 1.52, 1.1, body);
      for (const [wx, wz] of [[-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]]) {
        L.shape('solid', SHAPES.cylLow, wx, 0.33, wz, 0.33, 0.24, 0.33, DARK, X);
      }
      L.box('lamp', -0.8, 0.7, -2.16, -0.5, 0.82, -2.14, col('#f4f1e0'));
      L.box('lamp', 0.5, 0.7, -2.16, 0.8, 0.82, -2.14, col('#f4f1e0'));
      L.box('solid', -0.8, 0.7, 2.14, -0.5, 0.82, 2.16, col('#a01818'));
      L.box('solid', 0.5, 0.7, 2.14, 0.8, 0.82, 2.16, col('#a01818'));
      if (p.h) {
        // police light bar
        L.box('lamp', -0.55, 1.52, -0.15, -0.02, 1.64, 0.15, col('#ff2a1a'));
        L.box('lamp', 0.02, 1.52, -0.15, 0.55, 1.64, 0.15, col('#2a6bff'));
      }
      break;
    }
    case 'mailbox': {
      L.beam('solid', [0, 0, 0], [0, 1.0, 0], 0.08, WOOD);
      L.box('solid', -0.13, 1.0, -0.25, 0.13, 1.2, 0.25, c1);
      L.shape('solid', SHAPES.cylLow, 0, 1.2, 0, 0.13, 0.5, 0.13, c1, Z);
      L.box('solid', 0.13, 1.15, 0.05, 0.15, 1.35, 0.1, col('#c0392b')); // flag
      break;
    }
    case 'wallMailbox': {
      // letterbox on the wall; local -z points out of the wall
      L.box('solid', -0.17, 0, -0.15, 0.17, 0.38, 0, c1);
      L.poly('solid', [[-0.18, 0.38, -0.17], [0.18, 0.38, -0.17], [0.18, 0.46, 0], [-0.18, 0.46, 0]], c1.clone().multiplyScalar(0.8), [0, 1, -1]);
      L.box('solid', -0.11, 0.26, -0.155, 0.11, 0.29, -0.15, DARK); // letter slot
      break;
    }
    case 'bins': {
      for (const [sx, c] of [[-0.35, c1], [0.35, c2]] as const) {
        L.box('solid', sx - 0.28, 0.05, -0.3, sx + 0.28, 1.0, 0.3, c);
        L.box('solid', sx - 0.3, 1.0, -0.33, sx + 0.3, 1.06, 0.32, c.clone().multiplyScalar(0.85));
      }
      break;
    }
  }
}

const LAMP = col('#ffe2a8');

/**
 * Cheap stand-ins for the far LOD: chunky props that would visibly "pop" out if dropped.
 * Same position, footprint and colour as the full prop, a handful of boxes each.
 * Returns false if the prop has no stand-in (it is simply skipped far away).
 */
export function drawPropFar(b: MeshBuilder, p: Prop): boolean {
  const L = new LocalFrame(b, p.x, p.y, p.z, p.rot);
  const c1 = col(p.color);
  switch (p.kind) {
    case 'car':
      // body + cabin (~24 triangles instead of ~200)
      L.box('solid', -0.88, 0.15, -2.2, 0.88, 0.95, 2.2, c1);
      L.box('glass', -0.78, 0.95, -0.9, 0.78, 1.5, 1.2, col('#1c2733'));
      return true;
    case 'dumpster':
      L.box('solid', -0.95, 0.12, -0.6, 0.95, 1.35, 0.6, c1);
      return true;
    case 'fuelPump':
      L.box('solid', -0.4, 0, -1.6, 0.4, 1.9, 1.6, col('#eeeeea'));
      return true;
    case 'stall':
    case 'produceDisplay':
    case 'flowerRack':
      L.box('solid', -1.0, 0, -0.5, 1.0, 1.1, 0.5, col('#b5895a'));
      return true;
    case 'cafeTable':
    case 'patioSet':
      // the umbrella is what reads from far away
      if ((p.h ?? 1) > 0) L.shape('solid', SHAPES.cone, 0, 2.2, 0, 1.25, 0.45, 1.25, c1);
      return true;
    case 'motorbike':
      L.box('solid', -0.2, 0.1, -0.8, 0.2, 0.95, 0.8, c1);
      return true;
    case 'railTrack': {
      // ballast + two rails, no sleepers
      const w = p.w ?? 60;
      L.box('solid', -w / 2, 0, -1.6, w / 2, 0.38, 1.6, col('#7d756b'));
      for (const z of [-0.72, 0.72]) L.box('solid', -w / 2, 0.38, z - 0.05, w / 2, 0.56, z + 0.05, col('#9aa0a6'));
      return true;
    }
    case 'pylon': {
      const h = p.h ?? 24;
      const st = col('#8f959c');
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.beam('solid', [sx * 2.4, 0, sz * 2.4], [sx * 0.7, h, sz * 0.7], 0.25, st);
      L.beam('solid', [-4.5, h * 0.78, 0], [4.5, h * 0.78, 0], 0.3, st);
      L.beam('solid', [-3.2, h * 0.95, 0], [3.2, h * 0.95, 0], 0.3, st);
      return true;
    }
    case 'transformer':
      L.box('solid', -1.05, 0, -0.85, 1.35, 2.4, 0.85, c1);
      return true;
    case 'bus':
      L.box('solid', -1.25, 0.35, -(p.d ?? 11) / 2, 1.25, 3.1, (p.d ?? 11) / 2, c1);
      return true;
    case 'ambulance':
      L.box('solid', -1.05, 0.4, -2.6, 1.05, 2.9, 3.0, col('#f4f1ea'));
      return true;
    case 'fireTruck':
      L.box('solid', -1.25, 0.4, -4.5, 1.25, 3.2, 4.5, col('#b3121b'));
      return true;
    case 'garbageTruck':
      L.box('solid', -1.25, 0.4, -4.2, 1.25, 3.4, 4.6, c1);
      return true;
    case 'bins':
    case 'acUnit':
      L.box('solid', -0.6, 0, -0.35, 0.6, 1.0, 0.35, c1);
      return true;
    default:
      return false;
  }
}

/** Far-LOD light: only the glowing part, so the city still sparkles at night. */
export function drawLightFar(b: MeshBuilder, l: Light): void {
  const L = new LocalFrame(b, l.x, l.y, l.z, l.rot);
  switch (l.kind) {
    case 'sconce':
      L.box('lamp', -0.08, -0.12, -0.24, 0.08, 0.1, -0.1, LAMP);
      break;
    case 'ceiling':
      L.box('lamp', -0.14, -0.11, -0.14, 0.14, -0.01, 0.14, LAMP);
      break;
    case 'bollard':
      L.box('lamp', -0.065, 0.6, -0.065, 0.065, 0.72, 0.065, LAMP);
      break;
    case 'post':
      L.box('lamp', -0.14, 2.0, -0.14, 0.14, 2.35, 0.14, LAMP);
      break;
    case 'streetLamp':
      L.box('lamp', -0.16, 6.24, -1.8, 0.16, 6.3, -1.25, LAMP);
      break;
    case 'lotLight':
      for (const x of [-1.0, 1.0]) L.box('lamp', x - 0.35, 8.8, -0.25, x + 0.35, 8.95, 0.25, LAMP);
      break;
    case 'aviation':
      // Oversized on purpose: obstruction lights must read from far away.
      L.box('lamp', -0.45, 0.5, -0.45, 0.45, 1.4, 0.45, col('#c80d08'));
      break;
  }
}

export function drawLight(b: MeshBuilder, l: Light): void {
  const L = new LocalFrame(b, l.x, l.y, l.z, l.rot);
  switch (l.kind) {
    case 'sconce':
      L.box('solid', -0.07, -0.15, -0.03, 0.07, 0.15, 0, DARK);
      L.box('solid', -0.02, 0.02, -0.12, 0.02, 0.06, -0.03, DARK);
      L.box('lamp', -0.08, -0.12, -0.24, 0.08, 0.1, -0.1, LAMP);
      L.box('solid', -0.1, 0.1, -0.26, 0.1, 0.14, -0.08, DARK);
      break;
    case 'ceiling':
      L.shape('lamp', SHAPES.cylLow, 0, -0.06, 0, 0.14, 0.1, 0.14, LAMP);
      L.shape('solid', SHAPES.cylLow, 0, 0, 0, 0.16, 0.03, 0.16, DARK);
      break;
    case 'bollard':
      L.shape('solid', SHAPES.cylLow, 0, 0.3, 0, 0.07, 0.6, 0.07, DARK);
      L.shape('lamp', SHAPES.cylLow, 0, 0.66, 0, 0.065, 0.12, 0.065, LAMP);
      L.shape('solid', SHAPES.cylLow, 0, 0.74, 0, 0.09, 0.04, 0.09, DARK);
      break;
    case 'post':
      L.shape('solid', SHAPES.cylLow, 0, 0.1, 0, 0.14, 0.2, 0.14, DARK);
      L.beam('solid', [0, 0, 0], [0, 2.0, 0], 0.08, DARK);
      L.box('lamp', -0.14, 2.0, -0.14, 0.14, 2.35, 0.14, LAMP);
      L.shape('solid', SHAPES.cone, 0, 2.43, 0, 0.22, 0.18, 0.22, DARK);
      break;
    case 'lotLight':
      // Parking-lot pole with two flood heads.
      L.shape('solid', SHAPES.cylLow, 0, 0.35, 0, 0.3, 0.7, 0.3, col('#9a958c'));
      L.beam('solid', [0, 0, 0], [0, 9, 0], 0.16, col('#5a5f66'));
      L.beam('solid', [-1.0, 9, 0], [1.0, 9, 0], 0.1, col('#5a5f66'));
      for (const x of [-1.0, 1.0]) {
        L.box('solid', x - 0.35, 8.9, -0.25, x + 0.35, 9.15, 0.25, col('#5a5f66'));
        L.box('lamp', x - 0.3, 8.84, -0.2, x + 0.3, 8.9, 0.2, LAMP);
      }
      break;
    case 'aviation':
      // Red obstruction light on a short post (tall buildings, masts).
      L.beam('solid', [0, 0, 0], [0, 0.6, 0], 0.06, DARK);
      L.box('lamp', -0.12, 0.6, -0.12, 0.12, 0.85, 0.12, col('#c80d08'));
      break;
    case 'streetLamp':
      L.shape('solid', SHAPES.cylLow, 0, 0.3, 0, 0.16, 0.6, 0.16, col('#5a5f66'));
      L.beam('solid', [0, 0, 0], [0, 6.2, 0], 0.13, col('#5a5f66'));
      L.beam('solid', [0, 6.1, 0], [0, 6.4, -1.4], 0.08, col('#5a5f66'));
      L.box('solid', -0.2, 6.3, -1.85, 0.2, 6.45, -1.2, col('#5a5f66'));
      L.box('lamp', -0.16, 6.24, -1.8, 0.16, 6.3, -1.25, LAMP);
      break;
  }
}

// ---------------------------------------------------------------- zoo animals (low-poly, head towards -z)

interface Beast {
  color: string;
  legH: number;
  /** width, height, length */
  body: [number, number, number];
  /** neck length, thickness */
  neck?: [number, number];
  head: [number, number, number];
  extra?: (L: LocalFrame, top: number) => void;
}

const BEASTS: Beast[] = [
  // 0 elephant
  { color: '#8d8a86', legH: 1.3, body: [1.7, 1.7, 3.0], head: [1.1, 1.1, 0.9], extra: (L, top) => {
    const c = col('#8d8a86');
    L.beam('solid', [0, top - 1.0, -2.0], [0, 0.4, -2.3], 0.22, c); // trunk
    for (const s of [-1, 1]) {
      L.box('solid', s * 0.55, top - 1.2, -1.75, s * 0.95, top - 0.2, -1.65, c.clone().multiplyScalar(0.9)); // ears
      L.beam('solid', [s * 0.3, top - 1.3, -1.9], [s * 0.35, top - 1.2, -2.5], 0.08, col('#f4f1ea')); // tusks
    }
  } },
  // 1 giraffe
  { color: '#d9a441', legH: 1.9, body: [0.8, 0.95, 1.9], neck: [2.4, 0.3], head: [0.32, 0.32, 0.65], extra: (L, top) => {
    const spot = col('#7a4b22');
    for (const [x, z] of [[-0.41, -0.5], [0.41, 0.2], [-0.41, 0.6], [0.41, -0.3]]) L.box('solid', x - 0.02, top - 0.7, z - 0.18, x + 0.02, top - 0.4, z + 0.18, spot);
  } },
  // 2 zebra
  { color: '#f2f0ea', legH: 0.85, body: [0.6, 0.7, 1.6], neck: [0.7, 0.25], head: [0.26, 0.3, 0.55], extra: (L, top) => {
    const k = col('#1e1f22');
    for (let i = 0; i < 5; i++) L.box('solid', -0.31, top - 0.7, -0.7 + i * 0.34, 0.31, top + 0.01, -0.6 + i * 0.34, k);
  } },
  // 3 lion
  { color: '#c8a05a', legH: 0.6, body: [0.6, 0.65, 1.6], head: [0.42, 0.42, 0.45], extra: (L, top) => {
    L.box('solid', -0.42, top - 0.6, -1.05, 0.42, top + 0.25, -0.75, col('#7a4f24')); // mane
  } },
  // 4 bear
  { color: '#5a3e2b', legH: 0.55, body: [0.95, 0.95, 1.7], head: [0.5, 0.5, 0.5] },
  // 5 penguin (drawn upright, see drawAnimal)
  { color: '#1e1f22', legH: 0, body: [0.4, 0.75, 0.35], head: [0.25, 0.25, 0.25] },
  // 6 flamingo
  { color: '#f08aa8', legH: 1.0, body: [0.35, 0.35, 0.6], neck: [0.8, 0.07], head: [0.12, 0.12, 0.25] },
  // 7 antelope
  { color: '#a6753f', legH: 0.9, body: [0.45, 0.55, 1.2], neck: [0.55, 0.2], head: [0.22, 0.25, 0.4], extra: (L, top) => {
    for (const s of [-1, 1]) L.beam('solid', [s * 0.08, top + 0.75, -0.95], [s * 0.2, top + 1.25, -0.75], 0.05, col('#3b2a1d'));
  } },
  // 8 hippo
  { color: '#7b6f73', legH: 0.4, body: [1.4, 1.1, 2.7], head: [0.9, 0.7, 0.9] },
  // 9 rhino
  { color: '#8c8c88', legH: 0.65, body: [1.1, 1.1, 2.4], head: [0.6, 0.6, 0.8], extra: (L, top) => {
    L.beam('solid', [0, top - 0.2, -2.0], [0, top + 0.35, -2.15], 0.12, col('#d9d4c7'));
  } },
];

function drawAnimal(L: LocalFrame, n: number, r: number): void {
  const s = BEASTS[n % BEASTS.length];
  const c = col(s.color);
  const [bw, bh, bl] = s.body;
  if (n === 5) {
    // penguin: upright body, white belly, beak, feet
    L.box('solid', -bw / 2, 0.05, -bl / 2, bw / 2, bh, bl / 2, c);
    L.box('solid', -bw / 2 + 0.06, 0.12, -bl / 2 - 0.01, bw / 2 - 0.06, bh - 0.15, -bl / 2 + 0.05, col('#f4f1ea'));
    L.box('solid', -0.12, bh, -0.12, 0.12, bh + 0.25, 0.12, c);
    L.box('solid', -0.04, bh + 0.08, -0.24, 0.04, bh + 0.14, -0.12, col('#f39c12'));
    L.box('solid', -0.15, 0, -0.25, 0.15, 0.05, 0, col('#f39c12'));
    return;
  }
  const y0 = s.legH;
  const top = y0 + bh;
  L.box('solid', -bw / 2, y0, -bl / 2, bw / 2, top, bl / 2, c);
  const lt = Math.max(0.06, bw * 0.22);
  if (n === 6) {
    // flamingo: standing on one leg, the other tucked up
    L.beam('solid', [0, 0, 0], [0, y0, 0], 0.04, c);
    L.beam('solid', [0, y0 - 0.1, 0.05], [0.05, y0 - 0.45, 0.2], 0.04, c);
  } else {
    const lx = bw / 2 - lt / 2;
    const lz = bl / 2 - lt / 2 - 0.05;
    const stride = (r - 0.5) * 0.3;
    for (const [x, z, k] of [[-lx, -lz, 1], [lx, -lz, -1], [-lx, lz, -1], [lx, lz, 1]] as const) L.beam('solid', [x, 0, z + k * stride], [x, y0 + 0.1, z], lt, c);
  }
  let hy = top - s.head[1] * 0.3;
  let hz = -bl / 2 - s.head[2] / 2 + 0.1;
  if (s.neck) {
    const [nl, nt] = s.neck;
    const ny = top + nl * 0.85;
    const nz = -bl / 2 - nl * 0.35;
    L.beam('solid', [0, top - 0.15, -bl / 2 + 0.15], [0, ny, nz], nt, c);
    hy = ny;
    hz = nz - s.head[2] / 2 + 0.05;
  }
  const [hw, hh, hl] = s.head;
  L.box('solid', -hw / 2, hy - hh / 2, hz - hl / 2, hw / 2, hy + hh / 2, hz + hl / 2, c);
  if (n === 6) L.box('solid', -0.03, hy - 0.1, hz - hl / 2 - 0.1, 0.03, hy, hz - hl / 2, col('#2b2b2b'));
  L.beam('solid', [0, top - 0.1, bl / 2], [0, top - 0.6, bl / 2 + 0.25], 0.05, c); // tail
  s.extra?.(L, top);
}
