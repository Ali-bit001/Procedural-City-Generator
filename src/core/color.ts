import type { RNG } from './rng';

/** Slightly vary a hex colour's brightness/tint so repeated palettes don't look cloned. */
export function jitterHex(hex: string, rng: RNG, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const base = 1 + rng.range(-amount, amount);
  const ch = (v: number) => {
    const f = base + rng.range(-amount, amount) * 0.35;
    return Math.max(0, Math.min(255, Math.round(v * f)));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Perceived lightness 0..1 (used to pick contrasting materials). */
export function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
