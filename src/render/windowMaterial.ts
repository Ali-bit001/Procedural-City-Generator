/**
 * Facade shader: every window, door, shopfront, roller shutter, sign, glass railing and
 * see-through fence is ONE quad. Frames, mullions, glass, curtains and night glow are painted here.
 *
 * Per-vertex inputs (written by MeshBuilder.winQuad):
 *   aUvM : position inside the quad in metres (0..w, 0..h)
 *   aWin : (w, h, style id, lit + seed)   lit = integer part (0/1), seed = fractional part
 *   color: frame / panel colour (vertex colour)
 */
import * as THREE from 'three';
import type { WindowStyle } from '../buildings/spec';

export const STYLE_ID: Record<WindowStyle | 'picket' | 'iron', number> = {
  plain: 0,
  cross: 1,
  casement: 2,
  georgian: 3,
  ribbon: 4,
  curtain: 5,
  shop: 6,
  shutter: 7,
  door: 8,
  garage: 9,
  sign: 10,
  glassPanel: 11,
  grid: 12,
  picket: 20,
  iron: 21,
};

const GLSL_PATTERN = /* glsl */ `
uniform float uNight;
varying vec2 vUvM;
varying vec4 vWin;

struct WinOut { vec3 color; float rough; float metal; vec3 emissive; float alpha; };

float wHash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
// 1.0 within halfW of a multiple of period
float wLines(float x, float period, float halfW) {
  float f = mod(x, period);
  return 1.0 - step(halfW, f) * step(f, period - halfW);
}
float wBox(vec2 p, vec2 lo, vec2 hi) {
  return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y);
}

WinOut winPattern(vec2 p, vec4 win, vec3 base) {
  WinOut o;
  o.color = base; o.rough = 0.65; o.metal = 0.0; o.emissive = vec3(0.0); o.alpha = 1.0;
  vec2 s = max(win.xy, vec2(0.01));
  float st = floor(win.z + 0.5);
  float lit = floor(win.w + 0.0005);
  // Quantised: the varying is interpolated, and tiny float errors would turn hashes into noise.
  float seed = floor(fract(win.w) * 997.0 + 0.5) / 997.0;
  float edge = min(min(p.x, s.x - p.x), min(p.y, s.y - p.y));
  float glass = 0.0;
  float glow = 1.0;
  float office = 0.0; // cool fluorescent light, varying pane by pane

  // Glass: dark with a faint sky gradient; some windows have pale curtains at the sides.
  vec3 glassCol = mix(vec3(0.09, 0.13, 0.18), vec3(0.30, 0.38, 0.46), clamp(p.y / s.y, 0.0, 1.0) * 0.55);
  float curtainW = 0.16 + 0.12 * wHash(seed * 91.0);
  // Curtains only in ordinary windows (not curtain walls, shopfronts, doors...).
  float curtain = step(st, 4.5) * step(0.55, seed) * (1.0 - step(curtainW, min(p.x, s.x - p.x) / s.x));
  glassCol = mix(glassCol, vec3(0.80, 0.74, 0.62), curtain * 0.8);

  if (st < 0.5) {                       // plain
    glass = step(0.07, edge);
  } else if (st < 1.5) {                // cross mullions
    glass = step(0.07, edge) * step(0.03, abs(p.x - s.x * 0.5)) * step(0.03, abs(p.y - s.y * 0.6));
  } else if (st < 2.5) {                // casement (vertical split)
    glass = step(0.07, edge) * step(0.035, abs(p.x - s.x * 0.5));
  } else if (st < 3.5) {                // georgian 2 x 3 panes
    glass = step(0.07, edge) * (1.0 - wLines(p.x, s.x / 2.0, 0.02)) * (1.0 - wLines(p.y, s.y / 3.0, 0.02));
  } else if (st < 4.5) {                // ribbon: thin frame, mullions every ~1.3 m
    float n = max(1.0, floor(s.x / 1.3 + 0.5));
    glass = step(0.04, edge) * (1.0 - wLines(p.x, s.x / n, 0.025));
  } else if (st < 5.5) {                // curtain wall: one quad per floor
    glassCol = mix(glassCol, base * 0.55, 0.35); // each tower tints its glass with its frame colour
    float n = max(1.0, floor(s.x / 1.5 + 0.5));
    float mull = wLines(p.x, s.x / n, 0.035);
    float pane = wHash(floor(p.x / (s.x / n)) * 7.13 + seed * 31.0);
    glow = pane < 0.2 ? 0.0 : 0.3 + 0.4 * pane;
    office = 1.0;
    float spandrel = step(p.y, 0.85);
    float slab = step(s.y - 0.12, p.y);
    glass = (1.0 - mull) * (1.0 - spandrel) * (1.0 - slab) * step(0.03, abs(p.y - 0.88));
    if (spandrel * (1.0 - mull) > 0.5) { o.color = glassCol * 0.7 + 0.04; o.rough = 0.3; o.metal = 0.4; }
  } else if (st < 6.5) {                // shopfront
    float n = max(1.0, floor(s.x / 1.6 + 0.5));
    glass = step(0.06, edge) * (1.0 - wLines(p.x, s.x / n, 0.03)) * step(0.03, abs(p.y - (s.y - 0.55)));
    glow = 1.25;
  } else if (st < 7.5) {                // roller shutter, some half open
    float openH = step(0.6, seed) * s.y * (0.3 + 0.35 * wHash(seed * 17.0));
    o.color = base * (0.82 + 0.18 * step(0.5, fract(p.y * 7.0)));
    o.rough = 0.45; o.metal = 0.35;
    if (p.y < openH) { glass = step(0.05, edge); glow = 1.8; }
    if (min(p.x, s.x - p.x) < 0.06) o.color = base * 0.55;
  } else if (st < 8.5) {                // door: panel + small glass + panel outlines + handle
    glass = wBox(p, vec2(s.x * 0.22, s.y * 0.68), vec2(s.x * 0.78, s.y * 0.9));
    float outline = wBox(p, vec2(s.x * 0.15, s.y * 0.08), vec2(s.x * 0.85, s.y * 0.6)) - wBox(p, vec2(s.x * 0.15 + 0.03, s.y * 0.08 + 0.03), vec2(s.x * 0.85 - 0.03, s.y * 0.6 - 0.03));
    o.color = base * (1.0 - 0.18 * outline);
    if (length(p - vec2(s.x * 0.82, s.y * 0.47)) < 0.035) o.color = vec3(0.79, 0.65, 0.28);
    glow = 0.5;
  } else if (st < 9.5) {                // garage door: horizontal grooves
    o.color = base * (1.0 - 0.18 * step(fract(p.y / (s.y / 4.0)), 0.04));
  } else if (st < 10.5) {               // shop sign with fake lettering; glows at night
    float band = step(s.y * 0.22, p.y) * step(p.y, s.y * 0.78);
    float letters = step(0.35, fract(p.x * 2.4 + seed * 13.0)) * step(0.2, fract(p.x * 0.42 + seed * 5.0));
    float lum = dot(base, vec3(0.299, 0.587, 0.114));
    vec3 ink = lum > 0.45 ? vec3(0.08) : vec3(0.97);
    o.color = mix(base, ink, band * letters * step(0.12, edge));
    if (edge < 0.05) o.color = base * 0.5;
    o.rough = 0.5;
    o.emissive = o.color * uNight * lit * 0.9;
    return o;
  } else if (st < 11.5) {               // glass panel (railings, glazed doors)
    glass = step(0.03, edge);
    glassCol = mix(glassCol, vec3(0.55, 0.68, 0.74), 0.5);
    glow = 0.0;
  } else if (st < 12.5) {               // grid: punched windows between piers, one quad per floor
    float n = max(1.0, floor(s.x / 1.6 + 0.5));
    float bw = s.x / n;
    float lx = mod(p.x, bw);
    float pane = wHash(floor(p.x / bw) * 7.13 + seed * 31.0);
    glow = pane < 0.2 ? 0.0 : 0.35 + 0.45 * pane;
    office = 1.0;
    glass = step(0.2, lx) * step(lx, bw - 0.2) * step(0.95, p.y) * step(p.y, s.y - 0.45) * step(0.02, abs(lx - bw * 0.5));
    o.rough = 0.8;
  } else if (st < 20.5) {               // picket fence (cut-out)
    float picket = step(fract(p.x / 0.26) * 0.26, 0.09) * step(p.y, s.y - 0.06 * step(0.045, abs(fract(p.x / 0.26) * 0.26 - 0.045)));
    float rails = wBox(p, vec2(0.0, 0.33), vec2(s.x, 0.41)) + step(0.95, s.y) * wBox(p, vec2(0.0, s.y - 0.33), vec2(s.x, s.y - 0.25));
    o.alpha = max(picket, rails);
    return o;
  } else {                              // wrought-iron railing (cut-out)
    float bars = step(fract(p.x / 0.14) * 0.14, 0.025);
    float rails = step(s.y - 0.05, p.y) + wBox(p, vec2(0.0, 0.28), vec2(s.x, 0.32)) + step(p.y, 0.06);
    o.alpha = max(bars, rails);
    o.rough = 0.5; o.metal = 0.3;
    return o;
  }

  o.color = mix(o.color, glassCol, glass);
  o.rough = mix(o.rough, 0.08, glass);
  o.metal = mix(o.metal, 0.45, glass);
  vec3 warm = vec3(1.0, 0.72, 0.42) * (0.7 + 0.6 * wHash(seed * 33.0));
  warm = mix(warm, vec3(0.78, 0.87, 1.0), office * 0.7);
  o.emissive = warm * glass * lit * uNight * glow * (1.0 - curtain * 0.35);
  return o;
}
`;

const VERT_DECL = /* glsl */ `
attribute vec2 aUvM;
attribute vec4 aWin;
varying vec2 vUvM;
varying vec4 vWin;
`;

/** Patch a MeshStandardMaterial into the facade shader. */
function patchStandard(mat: THREE.MeshStandardMaterial, night: { value: number }, cutout: boolean): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUvM = aUvM;\nvWin = aWin;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_PATTERN}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\nWinOut wp = winPattern(vUvM, vWin, diffuseColor.rgb);\n${cutout ? 'if (wp.alpha < 0.5) discard;' : ''}\ndiffuseColor.rgb = wp.color;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = wp.rough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = wp.metal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += wp.emissive;');
  };
  mat.customProgramCacheKey = () => (cutout ? 'facade-cutout' : 'facade');
  return mat;
}

/** Shadow-pass material for cut-out quads, so fence shadows show the gaps too. */
function cutoutDepth(night: { value: number }): THREE.MeshDepthMaterial {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUvM = aUvM;\nvWin = aWin;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_PATTERN}`)
      .replace('void main() {', 'void main() {\n  if (winPattern(vUvM, vWin, vec3(1.0)).alpha < 0.5) discard;');
  };
  mat.customProgramCacheKey = () => 'facade-cutout-depth';
  return mat;
}

export function createFacadeMaterials(night: { value: number }) {
  return {
    window: patchStandard(new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 1.5 }), night, false),
    cutout: patchStandard(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide }), night, true),
    cutoutDepth: cutoutDepth(night),
  };
}
