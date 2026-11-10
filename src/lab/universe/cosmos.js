// The large scale: the cosmic web, its galaxies, and the stars in them.
//
// The web is two layers of the same rule. Each cell of a grid gets one knot
// (a jittered point and a weight, hashed from the seed and the cell), and
// each knot links to a few of its 26 neighbours, more readily the richer
// both ends are. Knots become clusters, links become filaments, and where
// the weights are zero there are voids. The coarse layer (cells of ~100 Mpc)
// sets the weights of the fine one (~6.5 Mpc), so the galaxies you find
// close up sit where the threads were when you were far out.
//
// A galaxy is a density (an exponential disc with log-spiral arms, a bulge,
// maybe a bar; or an ellipsoid; or a clumpy irregular disc) from its seed.
// Far off it is a few thousand samples of that density. Up close it is an
// octree: each cell, hashed from the galaxy and the cell's integer
// coordinates, draws q^depth x its share of the mass as samples, so deeper
// cells hold fewer, smaller, dimmer samples; at the leaf depth (cells ~50 ly)
// q^depth has reached the galaxy's real star count and each sample IS a star,
// with a class, a system and a seed of its own.

import { hash, u01, rng, gauss, poisson, noise3, name, code } from './rng.js';
import { Inst } from './gl.js';
import { starClass } from './system.js';
import { galaxyHistory, starHistory, sampleBorn, NOW } from './lineage.js';

export const CELL = 2e23; // m: the fine web's cell (~6.5 Mpc)
export const SUPER = 16 * CELL; // the coarse web's (~100 Mpc)
export const BRICK = 4; // cells a brick (one mesh) a side

const FWD = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
  if (dx > 0 || (dx === 0 && dy > 0) || (dx === 0 && dy === 0 && dz > 0)) FWD.push([dx, dy, dz]);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function segDist(px, py, pz, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, vz = b.z - a.z, wx = px - a.x, wy = py - a.y, wz = pz - a.z;
  const t = Math.min(1, Math.max(0, (wx * vx + wy * vy + wz * vz) / (vx * vx + vy * vy + vz * vz)));
  return Math.hypot(wx - vx * t, wy - vy * t, wz - vz * t);
}

/** One layer of the web: knots and links on a grid of `cell` m, weighted by the coarser layer if there is one. */
export class Web {
  constructor(seed, cell, coarser = null) {
    this.seed = seed; this.cell = cell; this.up = coarser;
    this.pts = new Map(); this.eds = new Map(); this.gals = new Map();
  }

  /** The knot of cell (ix, iy, iz): x, y, z in cells (absolute), weight w (0: a void). */
  point(ix, iy, iz) {
    const k = `${ix},${iy},${iz}`;
    let p = this.pts.get(k);
    if (p) return p;
    const s = this.seed;
    const x = ix + 0.15 + 0.7 * u01(hash(s, ix, iy, iz, 1)), y = iy + 0.15 + 0.7 * u01(hash(s, ix, iy, iz, 2)), z = iz + 0.15 + 0.7 * u01(hash(s, ix, iy, iz, 3));
    let w = 0.2 + 0.8 * Math.pow(u01(hash(s, ix, iy, iz, 4)), 2);
    if (this.up) w *= 0.3 + 1.2 * this.up.near(x * this.cell, y * this.cell, z * this.cell);
    else w *= smooth(-0.2, 0.3, noise3(s + 77, x / 3.1, y / 3.1, z / 3.1) * 0.7 + noise3(s + 78, x / 1.2, y / 1.2, z / 1.2) * 0.3);
    if (w < 0.05) w = 0;
    p = { x, y, z, w };
    if (this.pts.size > 250000) this.pts.clear();
    this.pts.set(k, p);
    return p;
  }

  /** The links cell (ix, iy, iz) owns (to its 13 forward neighbours). */
  edges(ix, iy, iz) {
    const k = `${ix},${iy},${iz}`;
    let E = this.eds.get(k);
    if (E) return E;
    E = [];
    const A = this.point(ix, iy, iz);
    if (A.w > 0) {
      for (const [dx, dy, dz] of FWD) {
        const B = this.point(ix + dx, iy + dy, iz + dz);
        if (!B.w) continue;
        const L = Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z);
        const p = 0.5 * Math.exp(-(((L - 0.6) / 0.9) ** 2)) * (0.35 + 0.65 * Math.sqrt(A.w * B.w));
        if (u01(hash(this.seed, ix, iy, iz, 50 + dx * 9 + dy * 3 + dz)) < p) E.push({ a: A, b: B, L });
      }
    }
    if (this.eds.size > 250000) this.eds.clear();
    this.eds.set(k, E);
    return E;
  }

  /** How close a point (m) is to a thread or knot of this layer: 0 (a void) to 1. */
  near(px, py, pz) {
    const x = px / this.cell, y = py / this.cell, z = pz / this.cell;
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    let best = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const A = this.point(cx + dx, cy + dy, cz + dz);
      if (!A.w) continue;
      const dn = Math.hypot(x - A.x, y - A.y, z - A.z);
      best = Math.max(best, Math.exp(-((dn / 0.2) ** 2)) * Math.min(1, A.w * 1.4));
      for (const e of this.edges(cx + dx, cy + dy, cz + dz)) {
        const d = segDist(x, y, z, e.a, e.b);
        best = Math.max(best, Math.exp(-((d / 0.15) ** 2)) * Math.min(1, (e.a.w + e.b.w) * 0.9));
      }
    }
    return best;
  }

  /** The galaxies of a fine cell: clustered on its knot, strung along its links, a few in the field. */
  galaxies(ix, iy, iz) {
    const k = `${ix},${iy},${iz}`;
    let out = this.gals.get(k);
    if (out) return out;
    out = [];
    const R = rng(hash(this.seed, ix, iy, iz, 9)), A = this.point(ix, iy, iz);
    const add = (x, y, z, env) => out.push(Object.assign(makeGalaxy(hash(this.seed, ix, iy, iz, 100 + out.length), x, y, z, env, [ix, iy, iz]), { n: out.length })); // n: its index in the cell, for addresses
    if (A.w > 0) {
      const n = poisson(R, A.w * A.w * 140), sg = 0.025 + 0.03 * A.w;
      for (let i = 0; i < n; i++) add(A.x + gauss(R) * sg, A.y + gauss(R) * sg, A.z + gauss(R) * sg, 'cluster');
    }
    for (const e of this.edges(ix, iy, iz)) {
      const n = poisson(R, e.L * (e.a.w + e.b.w) * 26);
      for (let i = 0; i < n; i++) {
        const t = R();
        add(e.a.x + (e.b.x - e.a.x) * t + gauss(R) * 0.022, e.a.y + (e.b.y - e.a.y) * t + gauss(R) * 0.022, e.a.z + (e.b.z - e.a.z) * t + gauss(R) * 0.022, 'filament');
      }
    }
    for (let i = poisson(R, 2); i > 0; i--) add(ix + R(), iy + R(), iz + R(), 'field');
    if (this.gals.size > 20000) this.gals.clear();
    this.gals.set(k, out);
    return out;
  }
}

/** A galaxy's identity: where it is (cells), its kind and size (disc scale length, m). */
function makeGalaxy(seed, x, y, z, env, cell) {
  const R = rng(seed);
  const u = R();
  const type = env === 'cluster' ? (u < 0.55 ? 'E' : u < 0.9 ? 'S' : 'I') : env === 'filament' ? (u < 0.65 ? 'S' : u < 0.85 ? 'E' : 'I') : (u < 0.6 ? 'S' : u < 0.9 ? 'I' : 'E');
  const ln = Math.exp(gauss(R) * 0.35);
  const Rd = (type === 'E' ? 6e19 : type === 'S' ? 7e19 : 2.5e19) * ln;
  return { key: `g${seed}`, seed, x, y, z, type, R: Rd, env, cell };
}

/** Names on the HUD. */
export function galaxyName(g) {
  return `${name(g.seed)} ${code(g.seed)}`;
}

/**
 * A brick of BRICK^3 cells of a layer as one mesh: positions in cells from
 * the brick's corner. Fine layer: a cube per galaxy (its bulge; the rest of
 * it is drawn as an impostor when it's near), and the galaxies, in the
 * mesh's (shuffled) order, for picking. Coarse layer: dots strung along its
 * threads, standing in for the galaxies it is too far to draw.
 */
export function webBrick(web, bx, by, bz, fine) {
  const out = new Inst(4096), R = rng(hash(web.seed, bx, by, bz, 31)), gals = [];
  const ox = bx * BRICK, oy = by * BRICK, oz = bz * BRICK;
  for (let i = 0; i < BRICK; i++) for (let j = 0; j < BRICK; j++) for (let k = 0; k < BRICK; k++) {
    const ix = ox + i, iy = oy + j, iz = oz + k;
    if (fine) {
      for (const g of web.galaxies(ix, iy, iz)) gals.push(g);
    } else {
      const A = web.point(ix, iy, iz), C = rng(hash(web.seed, ix, iy, iz, 12));
      if (A.w > 0) {
        for (let n = poisson(C, A.w * A.w * 30); n > 0; n--) out.push(A.x - ox + gauss(C) * 0.04, A.y - oy + gauss(C) * 0.04, A.z - oz + gauss(C) * 0.04, 0.02, 0, 0.75 + 0.25 * C(), 1.5 + 2 * C(), C());
      }
      for (const e of web.edges(ix, iy, iz)) {
        for (let n = poisson(C, e.L * (e.a.w + e.b.w) * 16); n > 0; n--) {
          const t = C();
          out.push(e.a.x + (e.b.x - e.a.x) * t - ox + gauss(C) * 0.02, e.a.y + (e.b.y - e.a.y) * t - oy + gauss(C) * 0.02, e.a.z + (e.b.z - e.a.z) * t - oz + gauss(C) * 0.02, 0.012, C() < 0.04 ? 6 : 0, 0.45 + 0.35 * C(), 1.5 + 3 * C(), C());
        }
      }
    }
  }
  if (fine) {
    for (let i = gals.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [gals[i], gals[j]] = [gals[j], gals[i]]; }
    for (const g of gals) {
      const c = g.type === 'E' ? 0 : R() < 0.1 ? (g.type === 'I' ? 5 : 6) : 0;
      out.push(g.x - ox, g.y - oy, g.z - oz, (g.R * 0.08) / CELL, c, g.type === 'E' ? 0.9 : 0.7 + 0.25 * R(), 1 + galaxyHistory(g).formed, R()); // glow channel: 1 + when it formed (Gyr)
    }
  }
  return { data: out.done(), n: out.n, gals };
}

/** A galaxy's shape: density, sampling and colour, in units of its scale length. */
export class GalaxyShape {
  constructor(g) {
    const R = rng(g.seed ^ 0x6a1);
    this.type = g.type; this.seed = g.seed;
    this.m = R() < 0.5 ? 2 : R() < 0.6 ? 3 : 4;
    this.pitch = 0.2 + 0.35 * R();
    this.s = 0.45 + 0.45 * R();
    this.hz = 0.07 + 0.05 * R();
    this.fb = 0.12 + 0.25 * R();
    this.Rb = 0.3 + 0.25 * R();
    this.phase = R() * 6.283;
    this.accent = [6, 5, 6, 1, 7, 5][(R() * 6) | 0];
    const bar = R() < 0.4 ? 0.3 + 0.5 * R() : 0;
    this.ax = [1 + bar, 1 - bar * 0.45, 0.6];
    this.B = 6;
    if (g.type === 'E') { this.fb = 1; this.Rb = 1; this.ax = [1, 0.7 + 0.3 * R(), 0.45 + 0.5 * R()]; this.B = 7; }
    if (g.type === 'I') { this.s = 0.85; this.hz = 0.2; this.fb = 0.05; this.B = 5; }
    this.armMax = g.type === 'S' ? 1 - this.s + 3.2 * this.s : g.type === 'I' ? 2.6 : 1;
    this.norm = 1 / (this.ax[0] * this.ax[1] * this.ax[2] * 8 * Math.PI * this.Rb ** 3);
  }
  arm(r, th) {
    if (this.type === 'S') {
      const a = (1 + Math.cos(this.m * (th - Math.log(r + 0.05) / Math.tan(this.pitch)) + this.phase)) / 2;
      return 1 - this.s + this.s * 3.2 * a * a * a;
    }
    if (this.type === 'I') return Math.max(0.05, 1 + 1.6 * noise3(this.seed, r * Math.cos(th) * 1.4, r * Math.sin(th) * 1.4, 0.5));
    return 1;
  }
  density(x, y, z) {
    let rho = 0;
    if (this.fb < 1) {
      const r = Math.hypot(x, y);
      rho += (1 - this.fb) * Math.exp(-r) * this.arm(r, Math.atan2(y, x)) / (2 * Math.PI) * Math.exp(-Math.abs(z) / this.hz) / (2 * this.hz);
    }
    if (this.fb > 0) rho += this.fb * Math.exp(-Math.hypot(x / this.ax[0], y / this.ax[1], z / this.ax[2]) / this.Rb) * this.norm;
    return rho;
  }
  /** A sample of the density: x, y, z. */
  sample(R) {
    if (R() < this.fb) {
      const u = -this.Rb * Math.log(R() * R() * R() + 1e-12), c = 2 * R() - 1, ph = 6.283 * R(), s = Math.sqrt(1 - c * c);
      return [u * s * Math.cos(ph) * this.ax[0], u * s * Math.sin(ph) * this.ax[1], u * c * this.ax[2]];
    }
    let r = 0, th = 0;
    for (let i = 0; i < 40; i++) {
      r = -Math.log(R() * R() + 1e-12); th = 6.283 * R();
      if (R() * this.armMax < this.arm(r, th)) break;
    }
    const z = -this.hz * Math.log(R() + 1e-12) * (R() < 0.5 ? -1 : 1);
    return [r * Math.cos(th), r * Math.sin(th), z];
  }
  /** Colour and tone of a sample here (u: its own 0-1 hash). Mostly ink; young blue knots in the arms, the odd red nebula. */
  look(x, y, z, u) {
    const r = Math.hypot(x, y), b = Math.hypot(x / this.ax[0], y / this.ax[1], z / this.ax[2]);
    if (this.fb >= 1 || b < this.Rb * 1.5) return [0, 0.7 + 0.3 * u];
    const a = this.arm(r, Math.atan2(y, x)) / this.armMax;
    if (a > 0.55 && u < 0.13) return [this.accent, 1];
    if (u > 0.988) return [1, 0.9];
    return [0, 0.3 + 0.45 * a + 0.2 * u];
  }
}

/** The galaxy's octree parameters: K0 samples at the root, a factor q a level, real stars at depth dStar. */
export function octreeParams(g, shape) {
  const N = 1e11 * (g.R / 6e19) ** 2 * (g.type === 'I' ? 0.2 : 1);
  const B = shape.B, K0 = 30000;
  const dStar = Math.ceil(Math.log2((2 * B * g.R) / 5e17)); // leaf cells of ~50 ly: hundreds to thousands of stars each in a disc like ours
  return { N, B, K0, dStar, q: Math.pow(N / K0, 1 / dStar) };
}

/** A cell's share of the galaxy's mass (8 probes). */
export function cellMass(shape, cx, cy, cz, half) {
  // Big cells: 8 probes would miss a thin disc entirely, so read the share from a mass grid built once from the
  // galaxy's own samples (summed-volume, so any aligned box is a few lookups).
  const M = massGrid(shape), vs = (2 * shape.B) / MG, nv = (2 * half) / vs;
  if (nv >= 0.999) {
    const i0 = Math.round((cx - half + shape.B) / vs), j0 = Math.round((cy - half + shape.B) / vs), k0 = Math.round((cz - half + shape.B) / vs), w = Math.round(nv);
    return boxSum(M, i0, j0, k0, i0 + w, j0 + w, k0 + w);
  }
  let s = 0;
  for (let i = 0; i < 8; i++) s += shape.density(cx + (i & 1 ? 0.5 : -0.5) * half, cy + (i & 2 ? 0.5 : -0.5) * half, cz + (i & 4 ? 0.5 : -0.5) * half);
  return (s / 8) * (2 * half) ** 3;
}

const MG = 64; // the mass grid: MG^3 cells over the galaxy's box
/** Summed-volume table of the galaxy's mass, from 200k samples of its density (made once a galaxy). */
function massGrid(shape) {
  if (shape.mg) return shape.mg;
  const n = MG + 1, S = new Float64Array(n * n * n), R = rng(shape.seed ^ 0x3a55), N = 200000, B = shape.B, vs = (2 * B) / MG;
  const at = (i, j, k) => (i * n + j) * n + k;
  for (let t = 0; t < N; t++) {
    const [x, y, z] = shape.sample(R), i = Math.floor((x + B) / vs), j = Math.floor((y + B) / vs), k = Math.floor((z + B) / vs);
    if (i >= 0 && j >= 0 && k >= 0 && i < MG && j < MG && k < MG) S[at(i + 1, j + 1, k + 1)] += 1 / N;
  }
  for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) for (let k = 1; k < n; k++) {
    S[at(i, j, k)] += S[at(i - 1, j, k)] + S[at(i, j - 1, k)] + S[at(i, j, k - 1)] - S[at(i - 1, j - 1, k)] - S[at(i - 1, j, k - 1)] - S[at(i, j - 1, k - 1)] + S[at(i - 1, j - 1, k - 1)];
  }
  return (shape.mg = { S, n });
}
function boxSum(M, i0, j0, k0, i1, j1, k1) {
  const { S, n } = M, c = (v) => Math.max(0, Math.min(n - 1, v)), at = (i, j, k) => (c(i) * n + c(j)) * n + c(k);
  return S[at(i1, j1, k1)] - S[at(i0, j1, k1)] - S[at(i1, j0, k1)] - S[at(i1, j1, k0)] + S[at(i0, j0, k1)] + S[at(i0, j1, k0)] + S[at(i1, j0, k0)] - S[at(i0, j0, k0)];
}

/** A cell's expected number of samples (or stars, at the leaf depth). */
export function cellCount(P, mass, d) { return d >= P.dStar ? P.N * mass : P.K0 * P.q ** d * mass; }

/**
 * Cell (d, i, j, k) of a galaxy's octree: its samples (or stars), in units of
 * the cell's half size about its centre. Stars come with their seeds.
 */
export function galaxyCell(g, shape, P, d, i, j, k) {
  const size = (2 * P.B) / 2 ** d, half = size / 2;
  const cx = -P.B + (i + 0.5) * size, cy = -P.B + (j + 0.5) * size, cz = -P.B + (k + 0.5) * size;
  const mass = cellMass(shape, cx, cy, cz, half);
  const R = rng(hash(g.seed, d, i, j, k));
  const leaf = d >= P.dStar;
  const n = Math.min(leaf ? 5000 : 8000, leaf ? poisson(R, P.N * mass) : Math.round(P.K0 * P.q ** d * mass));
  let bound = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) bound = Math.max(bound, shape.density(cx + a * half, cy + b * half, cz + c * half));
  bound *= 2.5;
  const out = new Inst(Math.max(1, n)), stars = leaf ? [] : null, gH = galaxyHistory(g);
  const sz = (0.014 * P.B * P.q ** (-d / 2)) / half;
  // Big cells: pick a mass-grid cell by its mass first, then a point in it (rejection against the density
  // there, with the peak probed on the disc's plane): a thin disc stays thin instead of filling the box.
  const MGd = massGrid(shape), vs = (2 * P.B) / MG, nv = Math.round((2 * half) / vs);
  let place = null;
  if (!leaf && nv >= 1) {
    const i0 = Math.round((cx - half + P.B) / vs), j0 = Math.round((cy - half + P.B) / vs), k0 = Math.round((cz - half + P.B) / vs);
    const cum = new Float64Array(nv * nv * nv);
    let tot = 0;
    for (let a = 0; a < nv; a++) for (let b = 0; b < nv; b++) for (let c = 0; c < nv; c++) { tot += boxSum(MGd, i0 + a, j0 + b, k0 + c, i0 + a + 1, j0 + b + 1, k0 + c + 1); cum[(a * nv + b) * nv + c] = tot; }
    if (tot > 0) {
      place = () => {
        const u = R() * tot;
        let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; }
        const a = Math.floor(lo / (nv * nv)), b = Math.floor(lo / nv) % nv, c = lo % nv;
        const x0 = -P.B + (i0 + a) * vs, y0 = -P.B + (j0 + b) * vs, z0 = -P.B + (k0 + c) * vs;
        const zp = Math.min(z0 + vs, Math.max(z0, 0)), top = 2.5 * Math.max(shape.density(x0 + vs / 2, y0 + vs / 2, zp), shape.density(x0 + vs / 2, y0 + vs / 2, z0 + vs / 2), 1e-12);
        for (let t = 0; t < 20; t++) {
          const x = x0 + R() * vs, y = y0 + R() * vs, z = z0 + R() * vs;
          if (R() * top <= shape.density(x, y, z)) return [x, y, z];
        }
        return [x0 + vs / 2, y0 + vs / 2, zp];
      };
    }
  }
  for (let c = 0, tries = 0; c < n && tries < n * 40 + 40; tries++) {
    let x, y, z, lx, ly, lz;
    if (place) { [x, y, z] = place(); lx = (x - cx) / half; ly = (y - cy) / half; lz = (z - cz) / half; }
    else {
      lx = R() * 2 - 1; ly = R() * 2 - 1; lz = R() * 2 - 1;
      x = cx + lx * half; y = cy + ly * half; z = cz + lz * half;
      if (!leaf && R() * bound > shape.density(x, y, z)) continue;
    }
    c++;
    if (leaf) {
      const seed = hash(g.seed, d, i, j, k, c), sc = starClass(seed), st = { key: `s${seed}`, seed, x, y, z, sc, g, cell: [i, j, k], n: stars.length };
      out.push(lx, ly, lz, -sc.px, sc.col, sc.tone, 1 + starHistory(gH, shape, st).born, R());
      stars.push(st);
    } else {
      const u = R(), [col, tone] = shape.look(x, y, z, u), born = col === shape.accent && col ? NOW - 0.3 * R() : sampleBorn(gH, shape.type, 0, R());
      out.push(lx, ly, lz, sz, col, tone, 1 + born, R());
    }
  }
  return { data: out.done(), n: out.n, half, c: [cx, cy, cz], stars, sz, mass, leaf };
}

/** A galaxy seen from afar: n samples of its density, in units of its scale length. */
export function galaxyImpostor(g, shape, n = 3000) {
  const R = rng(g.seed ^ 5), out = new Inst(n), gH = galaxyHistory(g);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = shape.sample(R), u = R(), [col, tone] = shape.look(x, y, z, u), born = col === shape.accent && col ? NOW - 0.3 * R() : sampleBorn(gH, shape.type, 0, R());
    out.push(x, y, z, 0.05, col, tone, 1 + born, R());
  }
  return { data: out.done(), n: out.n };
}
