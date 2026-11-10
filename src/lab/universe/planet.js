// Round things: planets, moons, stars, and (further down) grains of sand,
// which are just very small worlds. One generator for all of them: a
// cube-sphere quadtree. Each face of a cube, pushed out onto the sphere, is
// split into patches as the camera nears, 24 x 24 columns a patch, each column
// a stack of cubes from the ground down to its lowest neighbour (so steep
// slopes have no holes). A patch is hashed from the body's seed and its
// integer address (face, level, i, j), and the height of a column is a sum
// of noise octaves down to the patch's own voxel size: zooming in adds the
// octaves that were too small to see, so detail appears and nothing that was
// there moves. Below a few metres, boulders; below a few cm, pebbles.
//
// Deep patches (level > 7) share the axes of their level-7 ancestor, so the
// thousands of patches round the camera on the ground all line up.

import { hash, u01, rng, gauss, noise3, fbm } from './rng.js';
import { Inst } from './gl.js';
import { frameAt, tmulv, sub, len } from './space.js';

// Faces: normal, u, v.
const FACES = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]],
  [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
];
export const K_FRAME = 7;
export const G = 24; // columns a patch side

/** A point on the unit sphere from face f and (a, b) in [-1, 1] (equal-angle). */
export function dirOf(f, a, b) {
  const [n, u, v] = FACES[f], ta = Math.tan(a * 0.7853981634), tb = Math.tan(b * 0.7853981634);
  const x = n[0] + ta * u[0] + tb * v[0], y = n[1] + ta * u[1] + tb * v[1], z = n[2] + ta * u[2] + tb * v[2];
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** Which face, and where on it, a direction falls. */
export function faceOf(d) {
  const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
  let f;
  if (ax >= ay && ax >= az) f = d[0] > 0 ? 0 : 1; else if (ay >= az) f = d[1] > 0 ? 2 : 3; else f = d[2] > 0 ? 4 : 5;
  const [n, u, v] = FACES[f], dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
  const a = Math.atan((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / dn) / 0.7853981634;
  const b = Math.atan((d[0] * v[0] + d[1] * v[1] + d[2] * v[2]) / dn) / 0.7853981634;
  return [f, a, b];
}

/** What a body is made of: its look and its terrain, from a planet (or moon) description. */
export function worldFor(p) {
  const R = p.R, k = p.kind;
  const W = { kind: k, R, seed: p.seed, accent: p.accent, minerals: p.hist?.minerals, H: 0.62, sea: null, rocks: true, minVox: 2e-3, amp: R * 0.004, glow: false, atmo: p.atmo, rings: p.rings };
  if (k === 'ocean') W.sea = 0;
  if (k === 'lava') { W.sea = -0.15 * W.amp; }
  if (k === 'desert') { W.amp = R * 0.003; W.H = 0.72; }
  if (k === 'ice') { W.amp = R * 0.0025; W.H = 0.65; }
  if (k === 'gas' || k === 'icegiant') { W.amp = R * 0.0006; W.rocks = false; W.minVox = 2e3; W.H = 0.9; }
  return W;
}

export function worldForStar(star) {
  return { kind: 'star', R: star.sc.R, seed: star.seed, accent: star.sc.col, tone: star.sc.tone, H: 0.9, sea: null, rocks: false, minVox: 3e4, amp: star.sc.R * 0.0008, glow: true };
}

export function worldForGrain(g) {
  return { kind: 'grain', R: g.r, seed: g.seed, mineral: g.mineral, H: 0.62, sea: null, rocks: false, minVox: 3e-9, amp: g.r * 0.2, glow: false };
}

const MINERALS = [
  // name, colour, tone, share: mostly pale quartz and grey feldspar, the odd dark or coloured grain
  ['quartz', 0, 0.22, 0.3], ['quartz', 0, 0.32, 0.18], ['feldspar', 0, 0.5, 0.2], ['mica', 0, 0.85, 0.1],
  ['magnetite', 0, 0.97, 0.1], ['feldspar', 2, 0.6, 0.05], ['garnet', 1, 0.8, 0.035], ['olivine', 4, 0.7, 0.035],
];
export const mineral = (u) => { let s = 0; for (const m of MINERALS) { s += m[3]; if (u < s) return m; } return MINERALS[0]; };

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Body {
  constructor(node, W) {
    this.node = node; this.W = W; this.key = node.key;
    this.patches = new Map(); // live quadtree bookkeeping (world.js)
  }

  /** Continents: the slow part of the height, -1..1. */
  continent(x, y, z) {
    const l0 = this.W.R * 0.8;
    return fbm(this.W.seed, x / l0, y / l0, z / l0, 3, 0.5) + (this.W.kind === 'ocean' ? -0.08 : 0);
  }

  /** Height (m) above the radius, at direction d, with detail down to `vox` metres. */
  height(d, vox) {
    const W = this.W, R = W.R, s = W.seed;
    const x = d[0] * R, y = d[1] * R, z = d[2] * R;
    if (W.kind === 'gas' || W.kind === 'icegiant' || W.kind === 'star') {
      return W.amp * fbm(s + 5, x / (R * 0.08), y / (R * 0.08), z / (R * 0.4), 4, 0.55);
    }
    const c = this.continent(x, y, z);
    if (W.kind === 'grain') {
      let h = W.amp * (c * 1.1 + 0.25 * noise3(s + 3, x / (R * 0.35), y / (R * 0.35), z / (R * 0.35)));
      const g = Math.pow(2, -W.H), knee = R * 0.01; // a grain is smooth below a few µm: atomic terraces, not cliffs
      let lam = R * 0.1, a = W.amp * 0.35;
      for (let k = 0; lam > 2 * vox && k < 44; k++) { h += a * noise3(s + 31 * k + 1, x / lam, y / lam, z / lam); lam *= 0.5; a *= lam > knee ? g : 0.5; }
      return h;
    }
    let h = W.amp * 0.22 * c; // continental shelves and ocean basins
    // Mountain belts: long, winding ranges where a warped band field peaks, on land.
    const land = smooth(-0.04, 0.18, c), bw = R * 0.16, ww = R * 0.06;
    const wx = x + ww * noise3(s + 41, x / (R * 0.1), y / (R * 0.1), z / (R * 0.1)), wy = y + ww * noise3(s + 42, x / (R * 0.1), y / (R * 0.1), z / (R * 0.1)), wz = z + ww * noise3(s + 43, x / (R * 0.1), y / (R * 0.1), z / (R * 0.1));
    const belt = smooth(0.5, 0.88, 1 - Math.abs(noise3(s + 40, wx / bw, wy / bw, wz / bw))) * land;
    if (belt > 0.001) {
      // Ridged multifractal: sharp crests, each finer octave strongest where the coarser one is already high,
      // so peaks grow craggy and valleys stay smooth. Small worlds (low gravity) get taller mountains.
      const M = Math.min(20000, Math.max(2500, 5500 * Math.sqrt(6.4e6 / R)));
      let lam = Math.min(R * 0.008, 40e3), amp = 1, wgt = 1, sum = 0;
      for (let k = 0; k < 11 && lam > 4 * vox; k++) { // only detail a few blocks wide: finer would read as pillars, not slopes
        let r = 1 - Math.abs(noise3(s + 60 + k, x / lam, y / lam, z / lam));
        r = r * r * wgt;
        wgt = Math.min(1, r * 2.2);
        sum += r * amp;
        amp *= 0.48; lam *= 0.5;
      }
      h += M * belt * (sum - 0.3); // crests up, valleys cut down between them
    }
    // Rolling detail everywhere: rough at large scales (H), gentler below a couple of km, but craggy in the ranges.
    const g = Math.pow(2, -W.H), knee = 2000, below = 0.5 + 0.12 * belt;
    let lam = R * 0.1, a = W.amp * 0.15;
    for (let k = 0; lam > 3 * vox && k < 44; k++) {
      h += a * noise3(s + 31 * k + 1, x / lam, y / lam, z / lam);
      lam *= 0.5; a *= lam > knee ? g : below;
    }
    if (W.rocks && (W.sea === null || h > W.sea) && vox < 3) {
      h += this.bumps(x, y, z, 8, 0.35, s + 1001, vox);
      if (vox < 0.04) h += this.bumps(x, y, z, 0.12, 0.5, s + 1002, vox);
    }
    return h;
  }

  /** Boulders (or pebbles): rounded lumps in cells of `lam` metres. */
  bumps(x, y, z, lam, dens, seed, vox) {
    if (vox > lam / 3) return 0;
    const cx = Math.floor(x / lam), cy = Math.floor(y / lam), cz = Math.floor(z / lam), r0 = Math.hypot(x, y, z);
    let h = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const hh = hash(seed, cx + dx, cy + dy, cz + dz);
      if (u01(hh) > dens) continue;
      let fx = (cx + dx + u01(hash(hh, 1))) * lam, fy = (cy + dy + u01(hash(hh, 2))) * lam, fz = (cz + dz + u01(hash(hh, 3))) * lam;
      const k = r0 / Math.hypot(fx, fy, fz);
      fx *= k; fy *= k; fz *= k;
      const r = lam * (0.15 + 0.3 * u01(hash(hh, 4))), d2 = (x - fx) ** 2 + (y - fy) ** 2 + (z - fz) ** 2;
      if (d2 < r * r) h = Math.max(h, r * 0.8 * Math.sqrt(1 - d2 / (r * r)));
    }
    return h;
  }

  /** Colour, tone and glow of the ground at direction d, height h (m). */
  look(d, h, u, slope = 0) {
    const W = this.W, A = W.amp, lat = Math.abs(d[2]), R = W.R;
    const n = (l) => noise3(W.seed + 7, (d[0] * R) / l, (d[1] * R) / l, (d[2] * R) / l);
    switch (W.kind) {
      case 'star': return [W.accent, Math.min(1, 0.72 + 0.28 * (0.5 + 0.5 * n(R * 0.01)) + 0.1 * u), 1];
      case 'gas': case 'icegiant': {
        const t = d[2] * (W.kind === 'gas' ? 9 : 4) + 0.6 * n(R * 0.25) + 0.25 * n(R * 0.06);
        const band = 0.5 + 0.5 * Math.sin(t * 3.14159);
        const storm = Math.hypot(d[0] - 0.6, d[1] - 0.6, d[2] + 0.3) < 0.18;
        if (W.kind === 'icegiant') return [W.accent, 0.35 + 0.25 * band + 0.06 * u, 0];
        if (storm || (band > 0.93 && u < 0.3)) return [W.accent, 0.85, 0];
        return [0, 0.25 + 0.55 * band + 0.06 * u, 0];
      }
      case 'grain': {
        const [, col, tone] = W.mineral;
        return [col, Math.min(1, tone + 0.08 * n(R * 0.05) + 0.04 * u), 0];
      }
      default: break;
    }
    if (W.sea !== null && h <= W.sea) {
      if (W.kind === 'lava') return [W.accent, 0.85 + 0.15 * u, 1];
      return [W.accent || 6, 0.55 + 0.25 * smooth(-A, 0, h) + 0.05 * u, 0];
    }
    const hn = h / A;
    if (W.kind === 'ice') {
      if (Math.abs(n(R * 0.02)) < 0.025) return [W.accent, 0.8, 0];
      if (slope > 1.1) return [0, 0.62 + 0.2 * u, 0]; // ice-free rock faces
      return [8, 0.62 + 0.12 * hn + 0.1 * u, 0];
    }
    // Altitude bands, like real ranges: snow above the snow line (lower towards the poles), except on faces too
    // steep to hold it; bare rock and scree above the tree line; cliffs anywhere steep.
    const alt = h - (W.sea ?? 0);
    const snow = (W.kind === 'desert' ? 6500 : W.kind === 'rock' || W.kind === 'lava' ? Infinity : 4500) * (1 - 0.85 * lat * lat) + 600 * n(R * 0.004);
    if (lat > 0.86) return [8, 0.9 + 0.08 * u, 0]; // polar caps
    if (alt > snow) return slope > 0.75 - 0.25 * smooth(snow, snow + 4000, alt) ? [0, 0.72 + 0.18 * u, 0] : [8, 0.9 + 0.08 * u, 0]; // steep faces shed their snow (higher up, it clings to less)
    if (slope > 0.9) return [0, 0.66 + 0.22 * u, 0]; // cliffs: bare rock
    if (alt > snow - 900) return [0, 0.48 + 0.18 * (0.5 + 0.5 * n(R * 0.0004)) + 0.08 * u, 0]; // above the tree line: scree and bare rock
    if (W.kind === 'ocean') {
      if (alt < 25) return [0, 0.3 + 0.1 * u, 0]; // beaches
      if (slope > 0.55) return [0, 0.55 + 0.12 * u, 0];
      const m = n(R * 0.03) + 0.5 * n(R * 0.004);
      if (m > -0.15) return [4, (m > 0.3 ? 0.78 : 0.58) + 0.12 * u, 0]; // forest and grass
      return [0, 0.4 + 0.15 * u, 0]; // dry plains
    }
    if (W.kind === 'desert') return n(R * 0.04) > 0.35 ? [W.accent, 0.55 + 0.2 * u, 0] : [0, 0.35 + 0.25 * (0.5 + 0.5 * n(R * 0.005)) + 0.06 * u, 0];
    if (W.kind === 'lava') return [0, 0.8 + 0.15 * u, 0];
    // bare rock: grey by height, the odd tinted plain
    if (W.accent && n(R * 0.05) > 0.45) return [W.accent, 0.6 + 0.2 * u, 0];
    return [0, 0.4 + 0.3 * (0.5 + 0.5 * n(R * 0.01)) + 0.2 * hn + 0.05 * u, 0];
  }

  /** Patch (f, L, i, j) at g columns a side: cubes in voxel units about the patch centre, its centre (m) and axes. */
  patch(f, L, i, j, g = G) {
    const W = this.W, R = W.R, n2 = 2 ** L, span = 2 / n2, step = span / g;
    const a0 = -1 + i * span, b0 = -1 + j * span;
    const dc = dirOf(f, a0 + span / 2, b0 + span / 2);
    let rot;
    if (L <= K_FRAME) rot = frameAt(dc);
    else {
      const s = 2 ** (L - K_FRAME), sp = 2 / 2 ** K_FRAME;
      rot = frameAt(dirOf(f, -1 + (Math.floor(i / s) + 0.5) * sp, -1 + (Math.floor(j / s) + 0.5) * sp));
    }
    const pos = [dc[0] * R, dc[1] * R, dc[2] * R];
    const vox = R * Math.max(len(sub(dirOf(f, a0 + span / 2 + step, b0 + span / 2), dc)), len(sub(dirOf(f, a0 + span / 2, b0 + span / 2 + step), dc)));
    const m = g + 2, X = new Float64Array(m * m), Y = new Float64Array(m * m), Z = new Float64Array(m * m), H = new Float64Array(m * m);
    const sea = W.sea;
    for (let b = -1; b <= g; b++) for (let a = -1; a <= g; a++) {
      const d = dirOf(f, a0 + (a + 0.5) * step, b0 + (b + 0.5) * step);
      const h = this.height(d, vox), top = sea !== null ? Math.max(h, sea) : h, r = R + top;
      const q = tmulv(rot, [d[0] * r - pos[0], d[1] * r - pos[1], d[2] * r - pos[2]]);
      const k = (b + 1) * m + (a + 1);
      X[k] = q[0] / vox; Y[k] = q[1] / vox; Z[k] = q[2] / vox; H[k] = h;
    }
    const out = new Inst(g * g * 2), Rr = rng(hash(W.seed, f, L, i, j));
    for (let b = 0; b < g; b++) for (let a = 0; a < g; a++) {
      const k = (b + 1) * m + (a + 1), z = Z[k];
      const zmin = Math.min(Z[k - 1], Z[k + 1], Z[k - m], Z[k + m]);
      const sx = Math.hypot(X[k + 1] - X[k], Y[k + 1] - Y[k]), sy = Math.hypot(X[k + m] - X[k], Y[k + m] - Y[k]);
      const s = Math.max(sx, sy, 0.5) * 1.02;
      const edge = a === 0 || b === 0 || a === g - 1 || b === g - 1;
      const depth = Math.min(32, Math.max(1, Math.ceil((z - zmin) / s) + 1) + (edge ? 1 : 0));
      const d = dirOf(f, a0 + (a + 0.5) * step, b0 + (b + 0.5) * step);
      const u = Rr();
      const slope = Math.max(Math.abs(H[k + 1] - H[k - 1]), Math.abs(H[k + m] - H[k - m])) / (2 * s * vox);
      const [col, tone, glow] = this.look(d, H[k], u, slope);
      for (let c = 0; c < depth; c++) {
        out.push(X[k], Y[k], z - s * (c + 0.5), s, col, c ? tone * 0.82 : tone, glow, u);
      }
    }
    return { data: out.done(), n: out.n, pos, rot, vox };
  }

  /** Where the ground is (m, the body's frame) under direction d. */
  surface(d, vox = this.W.R * 1e-4) {
    const h = this.height(d, vox), top = this.W.sea !== null ? Math.max(h, this.W.sea) : h, r = this.W.R + top;
    return [d[0] * r, d[1] * r, d[2] * r];
  }
}

/** A planet's rings: dust and rock in its equatorial plane, in units of its radius. */
export function ringMesh(W, n = 24000) {
  const R = rng(W.seed ^ 0x219), out = new Inst(n);
  const r0 = 1.35 + 0.2 * R(), r1 = r0 + 0.6 + 0.6 * R(), acc = R() < 0.4 ? W.accent : 0;
  for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
    const r = r0 + (r1 - r0) * Math.sqrt(R()), band = noise3(W.seed + 3, r * 14, 0.5, 0.5) + 0.5 * noise3(W.seed + 4, r * 60, 0.5, 0.5);
    if (band < -0.35) continue; // gaps
    i++;
    const t = R() * 6.2832;
    out.push(r * Math.cos(t), r * Math.sin(t), gauss(R) * 0.003, 0.004 + 0.004 * R(), acc && R() < 0.3 ? acc : 0, 0.3 + 0.35 * (0.5 + 0.5 * band) + 0.1 * R(), 0, R());
  }
  return { data: out.done(), n: out.n };
}

/** A thin shell of air: pale cubes just above the ground, in units of the radius. */
export function atmoMesh(W, n = 5000) {
  const R = rng(W.seed ^ 0xa7), out = new Inst(n);
  const col = W.kind === 'gas' ? 0 : W.kind === 'lava' ? 2 : W.kind === 'desert' ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const c = 2 * R() - 1, ph = 6.2832 * R(), s = Math.sqrt(1 - c * c), r = 1.012 + 0.02 * R();
    out.push(r * s * Math.cos(ph), r * s * Math.sin(ph), r * c, 0.008, col, 0.55, 1, R());
  }
  return { data: out.done(), n: out.n };
}
