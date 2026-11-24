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
