// The smallest places. Close enough to the ground (a few cm), the surface
// becomes sand: grains strewn over it on a jittered grid, hashed from the
// spot (a 1 m square of the planet, so the same beach is the same beach).
// Each grain is a small lumpy world of its own mineral (planet.js, kind
// 'grain'), drawn as one cube far off and as a voxel ball, then a quadtree,
// as you near it. On a grain, closer than ~30 nm, the ground turns into
// atoms: a two-atom lattice under the grain's surface, terraced where the
// surface steps, shivering with heat. Each tile of atoms is hashed from the
// grain and the tile's integer address.

import { hash, u01, rng } from './rng.js';
import { Inst } from './gl.js';
import { mineral } from './planet.js';
import { pickMineral } from './lineage.js';

export const GRAIN = 6e-4; // m: a grain's cell
export const GT = 16; // cells a tile side
export const SPOT = 1; // m: the square a spot of ground is hashed from
export const ATOM = 2.6e-10; // m: lattice spacing
export const AT = 16; // atoms a tile side
export const ASPOT = 2e-8; // m: the square of a grain's surface a lattice is hashed from

/** A tile of grains (cells (tx*GT.., ty*GT..)) on a spot whose ground is at z = surfZ(x, y) (m, the spot's frame). Units: GRAIN. */
export function grainTile(seed, tx, ty, surfZ, minerals = null) {
  const out = new Inst(GT * GT * 2), grains = [];
  for (let b = 0; b < GT; b++) for (let a = 0; a < GT; a++) {
    const gx = tx * GT + a, gy = ty * GT + b;
    for (let layer = 0; layer < 2; layer++) {
      const hh = hash(seed, gx, gy, layer);
      if (layer === 1 && u01(hh) < 0.35) continue;
      const jx = a + 0.5 + (u01(hash(hh, 1)) - 0.5) * 0.55 + layer * 0.5, jy = b + 0.5 + (u01(hash(hh, 2)) - 0.5) * 0.55 + layer * 0.5;
      const x = (tx * GT + jx) * GRAIN, y = (ty * GT + jy) * GRAIN;
      const r = GRAIN * (0.24 + 0.2 * u01(hash(hh, 3)));
      const z = surfZ(x, y) + r * (layer ? 0.3 : 0.85);
      const mm = minerals && pickMineral(minerals, u01(hash(hh, 4))), mn = mm ? [mm.name, mm.col, mm.tone, mm.why] : mineral(u01(hash(hh, 4))); // the planet's own mix, from its history
      out.push(jx, jy, z / GRAIN, (1.12 * r) / GRAIN, mn[1], mn[2], 0, u01(hash(hh, 5)));
      grains.push({ key: `${seed}:${gx}:${gy}:${layer}`, seed: hh, x, y, z, r, mineral: mn, addr: [gx, gy, layer] });
    }
  }
  return { data: out.done(), n: out.n, grains };
}

/** A tile of atoms (columns (tx*AT.., ty*AT..)) under a surface at z = surfZ(x, y) (m). Units: ATOM. */
export function atomTile(seed, tx, ty, surfZ, mn) {
  const out = new Inst(AT * AT * 10), R = rng(hash(seed, tx, ty, 0xa7));
  for (let b = 0; b < AT; b++) for (let a = 0; a < AT; a++) {
    const i = tx * AT + a, j = ty * AT + b;
    const zs = surfZ((i + 0.5) * ATOM, (j + 0.5) * ATOM) / ATOM; // the surface, in lattice steps
    const top = Math.floor(zs);
    for (let k = top; k > top - 5; k--) {
      const imp = u01(hash(seed, i, j, k)) < 0.012;
      out.push(a, b, k, 0.62, imp ? 1 + ((u01(hash(seed, i, j, k, 1)) * 7) | 0) : 0, 0.92, 0, R());
      if (k + 0.5 < zs) out.push(a + 0.5, b + 0.5, k + 0.5, 0.42, mn[1], Math.max(0.2, mn[2] * 0.6), 0, R());
    }
  }
  return { data: out.done(), n: out.n };
}
