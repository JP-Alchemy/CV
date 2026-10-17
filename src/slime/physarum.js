// The slime mould as Tero et al. modelled it ("Rules for biologically inspired
// adaptive network design", Science 327, 2010). Each edge of the mesh is a
// tube of length L and conductivity D. Flow through a tube follows
// Hagen-Poiseuille, Q = D (p_i - p_j) / L. One food source pushes a flux I0
// into the network and another takes it out; Kirchhoff's law (what flows into
// a junction flows out) sets every pressure. Tubes then adapt:
//
//   dD/dt = f(|Q|) - D,   f(Q) = Q^γ / (1 + Q^γ)
//
// so busy tubes thicken and idle ones wither away. The paper drives a random
// source-sink pair each step; over many small steps that averages f over
// every pair of cities. By default each step here does that average outright
// (`batch` = every city), which gives the same network without the noise.
// `batch: 2` is the paper's scheme exactly: one random pair per step.
//
// For pair (s, t) the pressures are I0 (g_s - g_t), where g_k is the pressure
// field for a unit flux into city k and out at one city held at zero. One
// factorisation per step (cholesky.js) gives every g_k. As tubes die the
// solver is rebuilt on the ones still alive, so it speeds up as the network
// forms.

import { random } from './map.js';
import { Cholesky } from './cholesky.js';

export const PAPER = { I0: 2, gamma: 1.8 }; // the paper's typical run (its Fig. 4)
export const TOKYO = { I0: 0.2, gamma: 1.15 }; // its closest match to the Tokyo rail network (Fig. S2B)

const DEAD = 1e-12; // thinner than this a tube is gone; near γ = 1 even very thin ones can grow back

export const f = (q, gamma) => {
  const qg = Math.pow(q, gamma);
  return qg / (1 + qg);
};

// f by table: indexed by the top bits of q as a float32 (sign, exponent, 8
// bits of mantissa), so steps of 0.4% in q, valued at each step's middle.
// Math.pow is the slow part of a step otherwise, by ~40×.
const SHIFT = 15;
const bits = new Float32Array(1), word = new Uint32Array(bits.buffer);
function table(gamma) {
  const tab = new Float32Array(1 << (31 - SHIFT));
  for (let k = 0; k < tab.length; k++) {
    word[0] = ((k << SHIFT) | (1 << (SHIFT - 1))) >>> 0;
    const q = bits[0];
    tab[k] = Number.isFinite(q) ? f(q, gamma) : 1;
  }
  return tab;
}

export class Physarum {
  /**
   * mesh: from buildMesh. sources: node index per food source. weights: how
   * much each city counts (all equal, as in the paper, if omitted).
   */
  constructor(mesh, sources, { I0 = PAPER.I0, gamma = PAPER.gamma, dt = 0.5, batch = Infinity, seed = 1, spread = 0.2, weights } = {}) {
    const { m, len } = mesh;
    this.mesh = mesh;
    this.sources = Int32Array.from(sources);
    this.K = sources.length;
    this.I0 = I0;
    this.gamma = gamma;
    this.dt = dt;
    this.batch = Math.max(2, Math.min(batch, this.K));
    this.rnd = random(seed);
    this.weights = weights ? Float64Array.from(weights) : null;
    // The paper's "stochastic variation assigned to the starting values of D".
    this.D = new Float64Array(m);
    for (let e = 0; e < m; e++) this.D[e] = 1 + (this.rnd() * 2 - 1) * spread;
    this.F = new Float64Array(m);
    this.invL = Float64Array.from(len, (l) => 1 / l);
    this.t = 0;
    this.steps = 0;
    this.ref = this.central();
    this.rebuild(Int32Array.from({ length: m }, (_, e) => e));
  }

  set gamma(v) {
    this._gamma = v;
    this.tab = table(v);
  }

  get gamma() { return this._gamma; }

  /** The city nearest the middle: held at zero pressure. */
  central() {
    const { x, y } = this.mesh, s = this.sources;
    let cx = 0, cy = 0;
    for (const i of s) { cx += x[i]; cy += y[i]; }
    cx /= s.length;
    cy /= s.length;
    let best = 0;
    for (let k = 1; k < s.length; k++) {
      if (Math.hypot(x[s[k]] - cx, y[s[k]] - cy) < Math.hypot(x[s[best]] - cx, y[s[best]] - cy)) best = k;
    }
    return best;
  }

  /** The solver on these tubes only (and the cities): local numbering, its own factorisation. */
  rebuild(edges) {
    const mesh = this.mesh;
    const local = new Int32Array(mesh.n).fill(-1), nodes = [];
    const add = (v) => {
      if (local[v] < 0) { local[v] = nodes.length; nodes.push(v); }
      return local[v];
    };
    for (const s of this.sources) add(s);
    const a = new Int32Array(edges.length), b = new Int32Array(edges.length);
    for (let k = 0; k < edges.length; k++) {
      a[k] = add(mesh.a[edges[k]]);
      b[k] = add(mesh.b[edges[k]]);
    }
    const n = nodes.length, m = edges.length;
    const start = new Int32Array(n + 1);
    for (let k = 0; k < m; k++) { start[a[k] + 1]++; start[b[k] + 1]++; }
    for (let i = 0; i < n; i++) start[i + 1] += start[i];
    const fill = start.slice(0, n), nbr = new Int32Array(2 * m), via = new Int32Array(2 * m);
    for (let k = 0; k < m; k++) {
      nbr[fill[a[k]]] = b[k]; via[fill[a[k]]++] = k;
      nbr[fill[b[k]]] = a[k]; via[fill[b[k]]++] = k;
    }
    const x = Float32Array.from(nodes, (v) => mesh.x[v]), y = Float32Array.from(nodes, (v) => mesh.y[v]);
    this.sub = { n, m, a, b, start, nbr, via, x, y, edge: edges, node: Int32Array.from(nodes) };
    this.src = Int32Array.from(this.sources, (s) => local[s]);
    this.chol = new Cholesky(this.sub, this.src[this.ref]);
    this.w = new Float64Array(m);
    this.live = Int32Array.from({ length: m }, (_, k) => k);
    this.nLive = m;
    this.g = Array.from(this.sources, () => new Float64Array(n));
  }

  /** The cities this step: all of them, or `batch` drawn at random (in proportion to their weights). */
  draw() {
    const K = this.K;
    if (this.batch >= K) return Array.from({ length: K }, (_, k) => k);
    const out = [], w = this.weights;
    while (out.length < this.batch) {
      let k = 0;
      if (!w) k = Math.floor(this.rnd() * K);
      else {
        let total = 0;
        for (let i = 0; i < K; i++) if (!out.includes(i)) total += w[i];
        let u = this.rnd() * total;
        for (; k < K - 1; k++) {
          if (out.includes(k)) continue;
          if ((u -= w[k]) <= 0) break;
        }
      }
      if (!out.includes(k)) out.push(k);
    }
    return out;
  }

  /** One step of dt: pressures for this step's cities, then every live tube adapts. */
  step() {
    const { a, b, edge } = this.sub;
    const D = this.D, F = this.F, w = this.w, invL = this.invL, live = this.live;
    for (let k = 0; k < w.length; k++) w[k] = D[edge[k]] * invL[edge[k]];
    this.chol.factor(w);
    const drawn = this.draw();
    for (const k of drawn) if (k !== this.ref) this.chol.solveUnit(this.src[k], this.g[k]);
    const g = drawn.map((k) => this.g[k]);
    // How much each pair counts: equal, or the product of the two cities' weights.
    const S = g.length, weighted = this.weights && this.batch >= this.K;
    const pw = new Float64Array(S * S);
    let total = 0;
    for (let s = 0; s < S; s++) {
      for (let t = s + 1; t < S; t++) total += pw[s * S + t] = weighted ? this.weights[drawn[s]] * this.weights[drawn[t]] : 1;
    }
    for (let k = 0; k < pw.length; k++) pw[k] /= total;
    const tab = this.tab, dt = this.dt, I0 = this.I0;
    const d = new Float64Array(S);
    let kept = 0;
    for (let k = 0; k < this.nLive; k++) {
      const l = live[k], e = edge[l], i = a[l], j = b[l];
      const c = I0 * w[l];
      for (let s = 0; s < S; s++) d[s] = c * (g[s][i] - g[s][j]);
      let sum = 0;
      for (let s = 0; s < S; s++) {
        const ds = d[s], row = s * S;
        for (let t = s + 1; t < S; t++) {
          bits[0] = ds > d[t] ? ds - d[t] : d[t] - ds;
          sum += pw[row + t] * tab[word[0] >>> SHIFT];
        }
      }
      F[e] = sum;
      const next = D[e] + dt * (sum - D[e]);
      if (next < DEAD) D[e] = 0;
      else {
        D[e] = next;
        live[kept++] = l;
      }
    }
    this.nLive = kept;
    this.t += dt;
    this.steps++;
    // Rebuild on the living once half the solver's tubes have died.
    if (kept < this.sub.m / 2 && this.sub.m > 64) this.rebuild(Int32Array.from(live.subarray(0, kept), (l) => edge[l]));
  }

  /** How much the tubes moved this step, as a share of the network: near 0 once it has settled. */
  change() {
    let num = 0, den = 0;
    const len = this.mesh.len, edge = this.sub.edge;
    for (let k = 0; k < this.nLive; k++) {
      const e = edge[this.live[k]];
      num += Math.abs(this.F[e] - this.D[e]) * len[e];
      den += this.D[e] * len[e];
    }
    return den > 0 ? num / den : 0;
  }

  /** The thinnest a tube can be and still count as network: a quarter of a dead-end city's own tube. */
  get threshold() {
    return (0.25 * 2 * f(this.I0, this.gamma)) / this.K;
  }
}
