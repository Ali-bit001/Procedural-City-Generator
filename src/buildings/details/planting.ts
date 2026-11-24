import type { RNG } from '../../core/rng';
import { jitterHex } from '../../core/color';
import { inside } from '../facade/openings';
import { AUTUMN, CONIFER_GREENS, TREE_GREENS } from '../styles/palettes';
import type { Rect, Tree } from '../spec';

const radiusOf = (t: Pick<Tree, 'kind' | 'scale'>) => (t.kind === 'shrub' ? 0.7 : 1.8) * t.scale;

export function treeColor(rng: RNG, kind: Tree['kind']): string {
  if (kind === 'cone') return jitterHex(rng.pick(CONIFER_GREENS), rng, 0.06);
  if (kind === 'palm') return jitterHex(rng.pick(TREE_GREENS), rng, 0.05);
  return rng.chance(0.1) ? rng.pick(AUTUMN) : jitterHex(rng.pick(TREE_GREENS), rng, 0.06);
}

/** Scatter trees/shrubs in `region`, avoiding obstacles, lot edges and each other. */
export function placeTrees(
  rng: RNG,
  trees: Tree[],
  obstacles: Rect[],
  lot: { W: number; D: number },
  region: Rect,
  count: number,
  kinds: [Tree['kind'], number][],
): void {
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const kind = rng.weighted(kinds);
      const scale = rng.range(0.8, 1.3);
      const radius = radiusOf({ kind, scale });
      const x = rng.range(region.x0, region.x1);
      const z = rng.range(region.z0, region.z1);
      if (x < radius * 0.6 || x > lot.W - radius * 0.6 || z > lot.D - radius * 0.6) continue;
      if (obstacles.some((r) => inside(r, x, z, radius))) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < radius + radiusOf(t))) continue;
      trees.push({ kind, x, z, scale, rot: rng.range(0, Math.PI * 2), color: treeColor(rng, kind), trunkColor: '#6b4a33' });
      break;
    }
  }
}
