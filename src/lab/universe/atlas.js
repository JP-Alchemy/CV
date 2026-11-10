// The atlas: a space where position is not where a world is but what it is.
// Three axes: warmth (how close it orbits, for its star's light: log2 of
// distance in Earth orbits, hotter to +x), size (log2 of radius in Earth
// radii, bigger to +y) and age (log2 of Gyr, older to +z). Every point is a
// world made by the same rules as the real ones (system.js's kinds,
// lineage.js's history and minerals, planet.js's terrain), so flying across
// the atlas morphs worlds into each other: lava into desert into ocean into
// ice, rock into ice giant into gas giant, young and erupting into old and
// still. Zooming in halves the grid spacing: the worlds you saw stay put, and
// new in-between ones appear, as finely as you care to look.

import { hash, rng } from './rng.js';
import { Inst } from './gl.js';
import { planetHistory } from './lineage.js';
import { REARTH, KIND_NAMES } from './system.js';
import { dirOf } from './planet.js';

export const UNIT = 1e8; // metres per unit of a property in the atlas
export const AXES = [
  { name: 'warmth', min: -3, max: 2.5, lo: 'cold', hi: 'hot' },
  { name: 'size', min: -2, max: 3.6, lo: 'tiny', hi: 'giant' },
  { name: 'age', min: -4, max: 3.7, lo: 'young', hi: 'old' },
];
export const FINE = 64; // the finest grid: 1/64 of a unit

/** The world at property-space point (px, py, pz), with its seed from its grid address. */
export function worldAt(px, py, pz) {
  const ix = Math.round(px * FINE), iy = Math.round(py * FINE), iz = Math.round(pz * FINE), seed = hash(0xa71a5, ix, iy, iz), R = rng(seed);
  const x = 2 ** -px, Rp = REARTH * 2 ** py, age = 2 ** pz;
  let kind;
  if (Rp > 6 * REARTH) kind = 'gas';
  else if (Rp > 3.2 * REARTH) kind = x < 0.6 ? 'gas' : 'icegiant';
  else if (x < 0.4 || (age < 0.4 && x < 1.7)) kind = 'lava';
  else if (x < 0.85) kind = 'desert';
  else if (x < 1.7) kind = Rp < 0.3 * REARTH ? 'rock' : 'ocean';
  else kind = Rp < 0.25 * REARTH ? 'rock' : 'ice';
  const giant = kind === 'gas' || kind === 'icegiant';
  const pick = (xs) => xs[(R() * xs.length) | 0];
  const p = {
    seed, key: `a${ix},${iy},${iz}`, kind, R: Rp, x, young: age < 0.4, i: 0,
    rings: giant ? R() < 0.5 : R() < 0.04, atmo: kind === 'ocean' || giant || R() < 0.5,
    accent: { ocean: pick([6, 5]), lava: pick([1, 2]), desert: pick([2, 3]), ice: pick([5, 6]), gas: pick([2, 3, 1, 7, 5]), icegiant: pick([5, 6, 7]), rock: pick([0, 7, 4]) }[kind] ?? 0,
    moons: [], params: [px, py, pz], age,
  };
  p.hist = planetHistory({ age: age + 0.05, Z: 0 }, p);
  p.name = describe(p);
  return p;
}

/** In words: "ocean world, 1.4 Earths across, temperate, 4.2 billion years". */
export function describe(p) {
  const [px, , pz] = p.params, r = p.R / REARTH;
  const warm = px > 1.2 ? 'scorching' : px > 0.3 ? 'hot' : px > -0.8 ? 'temperate' : px > -1.8 ? 'cold' : 'frozen far out';
  const age = 2 ** pz;
  return `${KIND_NAMES[p.kind]}, ${r < 10 ? r.toFixed(r < 1 ? 2 : 1) : Math.round(r)} Earths across, ${warm}, ${age < 1 ? `${Math.round(age * 1000)} million` : age.toFixed(1) + ' billion'} years old`;
}

/** A whole world as one small mesh of g x g columns a face, in units of its radius (axis-aligned, like Powers of Ten's globe). */
export function ballMesh(b, g = 8) {
  const W = b.W, R = W.R, out = new Inst(6 * g * g + 8), step = 2 / g, s = (1.25 * Math.PI) / (2 * g), r0 = rng(W.seed ^ 0xba11);
  for (let f = 0; f < 6; f++) for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    const d = dirOf(f, -1 + (i + 0.5) * step, -1 + (j + 0.5) * step);
    const h = b.height(d, R * 0.08), top = W.sea !== null ? Math.max(h, W.sea) : h, r = 1 + (top / R) * 6; // relief exaggerated 6x: at this size it would vanish
    const [col, tone, glow] = b.look(d, h, r0(), 0);
    out.push(d[0] * r, d[1] * r, d[2] * r, s, col, tone, glow, r0());
  }
  return { data: out.done(), n: out.n };
}
