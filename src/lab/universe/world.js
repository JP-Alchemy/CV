// The universe: what to draw this frame, at what detail, and where the
// camera hangs. Each level (the coarse web, the fine web, galaxies far and
// near, star systems, round bodies, sand, atoms) looks at the camera, asks
// the store for the meshes it wants (generated on demand, a few ms a frame,
// nearest first, and evicted when unused) and adds them to the frame, faded
// in and out by camera distance, inside an instance budget.

import { hash, rng, u01 } from './rng.js';
import { Node, Camera, rel, mul3, mulv, tmulv, sub, add, scale, len, norm, dot, cross, frameAt, randomRot, axisRot, flightPath } from './space.js';
import { Web, CELL, SUPER, BRICK, webBrick, GalaxyShape, octreeParams, cellMass, cellCount, galaxyCell, galaxyImpostor, galaxyName } from './cosmos.js';
import { makeSystem, KIND_NAMES, CLASS_NAMES } from './system.js';
import { Body, worldFor, worldForStar, worldForGrain, ringMesh, atmoMesh, dirOf, faceOf, G, K_FRAME } from './planet.js';
import { GRAIN, GT, SPOT, ATOM, AT, ASPOT, grainTile, atomTile } from './micro.js';
import { Inst } from './gl.js';
import { galaxyHistory, starHistory, NOW, LIFE, fmtAge, fmtZ } from './lineage.js';
import { kepler } from './system.js';
import { worldAt, ballMesh, describe, UNIT, AXES, FINE } from './atlas.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const nlerp = (a, b, t) => { const v = norm(add(scale(a, 1 - t), scale(b, t))); return Number.isFinite(v[0]) ? v : b; };
export const D_MIN = 8e-11, D_MAX = 1.2e26; // down to inside an atom (and through it: main.js)
const SOLID = new Set(['rock', 'ocean', 'desert', 'lava', 'ice']);

/** Meshes by key: made on demand within a time budget, nearest first; the least recently used go when GPU memory runs high. */
class Store {
  constructor(gl) { this.gl = gl; this.m = new Map(); this.want = new Map(); this.frame = 0; this.limit = 192e6; this.ms = 0; this.made = 0; }
  get(key) { const e = this.m.get(key); if (e) e.used = this.frame; return e; }
  need(key, prio, make) {
    const e = this.get(key);
    if (e) return e;
    const w = this.want.get(key);
    if (!w || w.prio > prio) this.want.set(key, { key, prio, make });
    return null;
  }
  run(budgetMs) {
    const t0 = performance.now(), jobs = [...this.want.values()].sort((a, b) => a.prio - b.prio);
    let made = 0;
    for (const j of jobs) {
      if (made && performance.now() - t0 > budgetMs) break;
      const r = j.make(), mesh = r.n ? this.gl.mesh(r.data, r.n) : null;
      if (!r.keep) r.data = null;
      this.m.set(j.key, { mesh, n: r.n, meta: r, used: this.frame, born: performance.now() });
      made++;
    }
    this.pending = jobs.length - made;
    this.ms = performance.now() - t0; this.made = made;
    this.want.clear();
    if (this.gl.bytes > this.limit) {
      const old = [...this.m.entries()].filter(([, e]) => e.used < this.frame).sort((a, b) => a[1].used - b[1].used);
      for (const [k, e] of old) { if (this.gl.bytes < this.limit * 0.75) break; this.gl.free(e.mesh); this.m.delete(k); }
    }
    this.frame++;
  }
}

export class Universe {
  constructor(seed, gl) {
    this.seed = seed >>> 0; this.gl = gl;
    this.root = new Node(null, 'root', 'root', [0, 0, 0], null, 1e27);
    this.sup = new Web(hash(this.seed, 0x50), SUPER);
    this.web = new Web(hash(this.seed, 0x51), CELL, this.sup);
    this.store = new Store(gl);
    this.nodes = new Map(); this.gals = new Map(); this.stars = new Map(); this.leaf = new Map(); this.spots = new Map(); this.grains = new Map(); this.lattices = new Map();
    this.cam = new Camera(this.root);
    this.time = 0; this.detail = 1; this.flight = null; this.paused = false;
    this.T = 0; this.rate = 1; this.epoch = NOW; // the clock (s, running at the speed of what you're looking at) and the age of the universe (Gyr)
    this.budget = 180000;
    this.sky = null;
    this.zc = new Map(); // tile centre heights
    this.marks = []; // blocks people left (main.js keeps them)
    this.atlasRoot = new Node(null, 'atlas', 'atlas', [0, 0, 0], null, 1e12); this.atlasBodies = new Map(); this.atlasOn = false;
  }

  // ------------------------------------------------------------ places

  node(key, make) {
    let n = this.nodes.get(key);
    if (!n) { if (this.nodes.size > 40000) this.nodes.clear(); n = make(); this.nodes.set(key, n); }
    return n;
  }

  /** A galaxy's shape, octree and node. */
  gi(g) {
    let I = this.gals.get(g.key);
    if (I) return I;
    const shape = new GalaxyShape(g), P = octreeParams(g, shape);
    const node = new Node(this.root, 'galaxy', g.key, [g.x * CELL, g.y * CELL, g.z * CELL], randomRot(rng(g.seed ^ 0x77)), shape.B * g.R);
    I = { g, shape, P, node, name: galaxyName(g) };
    node.info = I;
    this.gals.set(g.key, I);
    return I;
  }

  /** A star's system, bodies and nodes (created once, kept). */
  si(s) {
    let I = this.stars.get(s.key);
    if (I) return I;
    const gI = this.gi(s.g), sH = starHistory(galaxyHistory(s.g), gI.shape, s), sys = makeSystem(s, sH);
    const node = new Node(gI.node, 'star', s.key, [s.x * s.g.R, s.y * s.g.R, s.z * s.g.R], randomRot(rng(s.seed ^ 0x99)), sys.E);
    I = { s, sys, node, gI, name: sys.name, hist: sH };
    node.info = I;
    I.body = new Body(node, worldForStar(s));
    I.body.star = I;
    I.planets = sys.planets.map((p) => {
      const pn = new Node(node, 'planet', p.key, [p.a, 0, 0], axisRot([1, 0, 0], p.tilt), p.soi);
      const b = new Body(pn, worldFor(p));
      b.p = p; b.star = I;
      pn.info = b;
      b.moons = p.moons.map((m) => {
        const mn = new Node(pn, 'moon', m.key, [m.a, 0, 0], null, m.R * 8);
        const mb = new Body(mn, worldFor(m));
        mb.p = m; mb.star = I; mb.planet = b;
        mn.info = mb;
        return mb;
      });
      return b;
    });
    this.stars.set(s.key, I);
    return I;
  }

  /** The real stars of a leaf cell of a galaxy's octree. */
  leafStars(gI, i, j, k) {
    const d = gI.P.dStar, key = `${gI.g.key}:${i}:${j}:${k}`;
    let S = this.leaf.get(key);
    if (!S) {
      if (this.leaf.size > 30000) this.leaf.clear();
      S = galaxyCell(gI.g, gI.shape, gI.P, d, i, j, k).stars;
      this.leaf.set(key, S);
    }
    return S;
  }

  /** The real star nearest p (galaxy units): its own leaf cell, then any neighbour that could hold a nearer one. */
  nearestStar(gI, p) {
    const P = gI.P, size = (2 * P.B) / 2 ** P.dStar, n = 2 ** P.dStar;
    const ci = Math.floor((p[0] + P.B) / size), cj = Math.floor((p[1] + P.B) / size), ck = Math.floor((p[2] + P.B) / size);
    let best = null, bd = Infinity;
    const box = (i, j, k) => { // distance from p to cell (i, j, k)
      const lo = (v, c) => -P.B + c * size - v, hi = (v, c) => v - (-P.B + (c + 1) * size);
      return Math.hypot(Math.max(0, lo(p[0], i), hi(p[0], i)), Math.max(0, lo(p[1], j), hi(p[1], j)), Math.max(0, lo(p[2], k), hi(p[2], k)));
    };
    const order = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const i = ci + a, j = cj + b, k = ck + c;
      if (i >= 0 && j >= 0 && k >= 0 && i < n && j < n && k < n) order.push([box(i, j, k), i, j, k]);
    }
    order.sort((x, y) => x[0] - y[0]);
    for (const [d0, i, j, k] of order) {
      if (d0 >= bd) break;
      for (const s of this.leafStars(gI, i, j, k)) {
        const dd = Math.hypot(s.x - p[0], s.y - p[1], s.z - p[2]);
        if (dd < bd) { bd = dd; best = s; }
      }
    }
    return best;
  }

  /** A spot of ground (1 m square, hashed) on a body under direction d: where sand is generated. */
  spot(body, d) {
    const [f, a, b] = faceOf(d), q = SPOT / (body.W.R * 0.7853981634);
    const ia = Math.floor((a + 1) / q), ib = Math.floor((b + 1) / q), key = `${body.key}:u${f}:${ia}:${ib}`;
    let M = this.spots.get(key);
    if (M) return M;
    const dc = dirOf(f, -1 + (ia + 0.5) * q, -1 + (ib + 0.5) * q);
    M = new Node(body.node, 'micro', key, body.surface(dc, 1e-3), frameAt(dc), 0.3);
    M.body = body; M.seed = hash(body.W.seed, f, ia, ib); M.addr = [f, ia, ib];
    M.surfZ = (x, y) => {
      const pt = add(M.pos, mulv(M.rot, [x, y, 0])), S = body.surface(norm(pt), 2e-4);
      return tmulv(M.rot, sub(S, M.pos))[2];
    };
    this.spots.set(key, M);
    return M;
  }

  /** A grain of sand as a body of its own. */
  grain(M, g) {
    let B = this.grains.get(g.key);
    if (B) return B;
    const n = new Node(M, 'grain', g.key, [g.x, g.y, g.z], randomRot(rng(g.seed)), g.r);
    B = new Body(n, worldForGrain(g));
    B.g = g; n.info = B;
    if (this.grains.size > 400) this.grains.clear();
    this.grains.set(g.key, B);
    return B;
  }

  /** A patch of a grain's surface laid out as a crystal lattice. */
  lattice(B, d) {
    const [f, a, b] = faceOf(d), q = ASPOT / (B.W.R * 0.7853981634);
    const ia = Math.floor((a + 1) / q), ib = Math.floor((b + 1) / q), key = `${B.key}:a${f}:${ia}:${ib}`;
    let L = this.lattices.get(key);
    if (L) return L;
    const dc = dirOf(f, -1 + (ia + 0.5) * q, -1 + (ib + 0.5) * q);
    L = new Node(B.node, 'atoms', key, B.surface(dc, ATOM), frameAt(dc), 4e-8);
    L.seed = hash(B.W.seed, f, ia, ib); L.body = B; L.addr = [f, ia, ib];
    L.surfZ = (x, y) => {
      const pt = add(L.pos, mulv(L.rot, [x, y, 0])), S = B.surface(norm(pt), ATOM);
      return tmulv(L.rot, sub(S, L.pos))[2];
    };
    if (this.lattices.size > 200) this.lattices.clear();
    this.lattices.set(key, L);
    return L;
  }

  /** The chain of places the camera is in. */
  chain() {
    const out = [];
    for (let n = this.cam.anchor; n; n = n.parent) out.unshift(n);
    return out;
  }
  find(kind) { for (let n = this.cam.anchor; n; n = n.parent) if (n.kind === kind) return n; return null; }
  bodyOf(n) { return n.kind === 'star' ? n.info.body : n.kind === 'planet' || n.kind === 'moon' || n.kind === 'grain' ? n.info : null; }

  // ------------------------------------------------------------ the frame

  frame(n) {
    let F = this.fc.get(n);
    if (F) return F;
    const T = rel(n, this.cam.anchor);
    F = { T, R: mul3(this.V, T.R), o: scale(mulv(this.V, sub(T.t, this.eye)), 1 / this.cam.D) };
    this.fc.set(n, F);
    return F;
  }
  eyeIn(n) { const F = this.frame(n); return tmulv(F.T.R, sub(this.eye, F.T.t)); }
  /** Is a sphere (centre c, m, in n's frame; radius r, m) in view? */
  inView(n, c, r, widen = 1) {
    const F = this.frame(n), D = this.cam.D, v = add(F.o, scale(mulv(F.R, c), 1 / D)), rr = r / D, w = -v[2];
    if (w + rr < this.gl.near || w - rr > this.gl.far) return false;
    const ty = Math.tan(this.gl.fov / 2) * widen, tx = Math.tan(this.gl.fov / 2) * this.aspect * widen;
    return Math.abs(v[0]) <= w * tx + rr * 1.5 && Math.abs(v[1]) <= w * ty + rr * 1.5;
  }
  /** Screen radius (px) of a sphere of radius r at distance d. */
  px(r, d) { return r / Math.max(d, 1e-30) / this.gl.pxAng; }

  add(e, n, unit, count, o = {}) {
    if (!e?.mesh || count <= 0) return;
    const age = performance.now() - (e.born || 0);
    if (age < 350) o = { ...o, fade: (o.fade ?? 1) * (age / 350) }; // new meshes dissolve in, a cube at a time, rather than pop
    const c = Math.min(count, e.n);
    this.items.push({ e, F: this.frame(n), unit, n: c, o });
    this.drawn += c;
  }

  /** Build and draw a frame. dt in seconds. */
  render(dt, theme, w, h, dpr) {
    this.rate = this.timeRate();
    if (!this.paused && Number.isFinite(this.rate)) { this.time += dt; this.T += dt * this.rate; }
    this.aspect = w / h;
    if (this.flight) this.stepFlight(dt); else this.settle(dt);
    const c = this.cam;
    if (![c.D, ...c.t, ...c.dir, ...c.up].every(Number.isFinite)) { this.flight = null; this.goHome(true); } // never stay lost: a bad number anywhere puts you back home
    if (!Number.isFinite(this.T)) this.T = 0;
    c.D = clamp(c.D, D_MIN, D_MAX);
    this.eye = c.eye(); this.V = c.axes(); this.fc = new Map();
    this.items = []; this.picks = []; this.spheres = []; this.drawn = 0; this.sky = null;
    this.gl.pxAng = (2 * Math.tan(this.gl.fov / 2)) / h;
    this.counts = {};
    const t0 = performance.now();
    this.orbits();
    const B = this.budget * this.detail;
    this.atomUnder = null;
    if (this.atlasOn) this.level('atlas', () => this.atlasDraw(B * 0.8));
    else {
      this.level('super', () => this.superWeb(B * 0.25));
      this.level('web', () => this.fineWeb(B * 0.3));
      this.level('galaxies', () => this.galaxies(B * 0.5));
      this.level('systems', () => this.systems(B * 0.7));
      this.level('sand', () => this.sand(B * 0.35));
      this.level('atoms', () => this.atoms(B * 0.45));
      this.level('marks', () => this.drawMarks());
    }
    this.collectMs = performance.now() - t0;
    this.store.run(this.flight ? 4 : 7);
    const sky = this.sky ? this.sky.map((v, i) => theme.bg[i] + (v - theme.bg[i]) * this.skyK) : theme.bg;
    this.gl.begin(w, h, dpr, theme, sky, this.time, this.epoch);
    const D = c.D;
    for (const it of this.items) this.gl.draw(it.e.mesh, it.n, { R: it.F.R, o: it.F.o, sc: it.unit / D }, it.o);
    this.gl.end();
  }
  level(name, fn) { const n0 = this.drawn; fn(); this.counts[name] = this.drawn - n0; }

  // ------------------------------------------------------------ the web

  bricks(layer, side, Rv, fade, budget, fine) {
    if (fade <= 0.01) return;
    const e = this.eyeIn(this.root), b = [Math.floor(e[0] / side), Math.floor(e[1] / side), Math.floor(e[2] / side)], r = Math.ceil(Rv / side);
    const list = [];
    let total = 0;
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
      const bx = b[0] + i, by = b[1] + j, bz = b[2] + k;
      const c = [(bx + 0.5) * side, (by + 0.5) * side, (bz + 0.5) * side];
      const d = Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]);
      if (d > Rv + side) continue;
      if (!this.inView(this.root, c, side * 0.9)) continue;
      const key = `${fine ? 'w' : 'W'}${bx},${by},${bz}`;
      const E = this.store.need(key, d / side, () => webBrick(layer, bx, by, bz, fine));
      if (E) { list.push({ E, bx, by, bz, d }); total += E.n; }
    }
    const keep = Math.min(1, budget / Math.max(1, total));
    for (const { E, bx, by, bz, d } of list) {
      const n = this.node(`${fine ? 'w' : 'W'}${bx},${by},${bz}`, () => new Node(this.root, 'brick', `b${bx},${by},${bz}`, [bx * side, by * side, bz * side]));
      const far = 1 - smooth(Rv * 0.75, Rv + side * 0.5, d); // thin out towards the edge of what's drawn
      const cnt = Math.round(E.n * keep * far);
      this.add(E, n, layer.cell, cnt, { fade: fade, minPx: fine ? 1.6 : 1.3, maxPx: 6, glow: true });
      if (fine) this.picks.push({ node: n, unit: layer.cell, list: E.meta.gals, count: cnt, kind: 'galaxy', off: [bx * BRICK, by * BRICK, bz * BRICK] });
    }
  }

  superWeb(budget) {
    const D = this.cam.D, side = SUPER * BRICK;
    this.bricks(this.sup, side, Math.min(4.5 * D, side * 3.2), smooth(1.2e24, 5e24, D), budget, false);
  }

  fineWeb(budget) {
    const D = this.cam.D, side = CELL * BRICK;
    this.bricks(this.web, side, clamp(5 * D, side * 1.2, side * 3.6), smooth(5e19, 4e20, D) * (1 - smooth(1e25, 3e25, D)), budget, true);
  }

  // ------------------------------------------------------------ galaxies

  /** The galaxies near the eye: impostors far off, an octree for the one you're in or at. */
  galaxies(budget) {
    const D = this.cam.D;
    if (D > 4e24) return;
    const e = this.eyeIn(this.root), c = [Math.floor(e[0] / CELL), Math.floor(e[1] / CELL), Math.floor(e[2] / CELL)];
    const gn = this.find('galaxy');
    let detail = gn ? gn.info : null, best = Infinity;
    const near = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      for (const g of this.web.galaxies(c[0] + i, c[1] + j, c[2] + k)) {
        const d = Math.hypot(g.x * CELL - e[0], g.y * CELL - e[1], g.z * CELL - e[2]);
        const px = this.px(g.R * 4, d);
        if (px > 3) near.push({ g, d, px });
        if (!gn && d < g.R * 18 && d < best) { best = d; detail = this.gi(g); }
      }
    }
    let used = 0;
    const dd = detail ? len(this.eyeIn(detail.node)) : Infinity, dfade = detail ? 1 - smooth(detail.node.extent * 1.6, detail.node.extent * 3, dd) : 0;
    near.sort((a, b) => b.px - a.px);
    for (const { g, d, px } of near.slice(0, 120)) {
      const I = this.gi(g);
      const fade = (I === detail ? 1 - dfade : 1) * smooth(3, 8, px) * (1 - smooth(1e24, 3e24, D));
      if (fade <= 0.01 || !this.inView(I.node, [0, 0, 0], I.node.extent)) continue;
      const E = this.store.need(`gi${g.key}`, 1 / px, () => galaxyImpostor(g, I.shape));
      const n = Math.round(clamp(px * px * 0.5, 60, 3000));
      if (E && used < budget * 0.3) { this.add(E, I.node, g.R, n, { fade, minPx: 1, maxPx: 6, glow: true }); used += n; }
      this.picks.push({ node: I.node, unit: 1, list: [{ x: 0, y: 0, z: 0, gal: g }], count: 1, kind: 'galaxy', r: g.R * 3 });
    }
    if (detail && dfade > 0.01) this.octree(detail, budget - used, dfade * (this.find('star') ? 0.55 : 1)); // inside a system the galaxy is the backdrop: quieter
  }

  octree(I, budget, fade) {
    const { P, shape, g, node } = I, e = scale(this.eyeIn(node), 1 / g.R);
    const tau = (180 * this.gl.pxAng) / Math.max(0.3, this.detail);
    const mk = (d, i, j, k) => {
      const size = (2 * P.B) / 2 ** d, h = size / 2;
      const c = [-P.B + (i + 0.5) * size, -P.B + (j + 0.5) * size, -P.B + (k + 0.5) * size];
      const dx = Math.max(0, Math.abs(e[0] - c[0]) - h), dy = Math.max(0, Math.abs(e[1] - c[1]) - h), dz = Math.max(0, Math.abs(e[2] - c[2]) - h);
      const dist = Math.max(Math.hypot(dx, dy, dz), size * 1e-3);
      const mass = cellMass(shape, c[0], c[1], c[2], h), n = Math.min(d >= P.dStar ? 5000 : 8000, cellCount(P, mass, d)); // as many as it will actually make
      const was = !!I.split?.has(`${d}:${i}:${j}:${k}`), err = size / dist / tau;
      // Hysteresis: a cell split last frame stays split while it's still fairly worth it (err > 0.7); a new one needs
      // err > 1. Both are stable, and the budget is handed out by need alone, so nothing flips back and forth at rest.
      return { d, i, j, k, c, h, err, was, want: was ? err > 0.7 : err > 1, prio: err, n, draw: n * share(d, n, mass, Math.hypot(e[0] - c[0], e[1] - c[1], e[2] - c[2]), h) };
    };
    // What a cell draws: each dot stands for m stars, and is drawn with a chance set by how bright those m stars
    // look from here (m / distance²) against a threshold. The same band of sky then looks the same however finely
    // it's divided, and the budget counts dots drawn, not dots made.
    // Two copies of the threshold: F (moved in notches) picks the cells, Fd (eased after it) sets how many dots
    // they draw, so a notch neither re-picks cells every frame nor steps the brightness all at once.
    const F = I.F || (I.F = 3e-3), Fd = (I.Fd = (I.Fd || F) * (F / (I.Fd || F)) ** 0.08);
    function share(d, n, mass, dist, h, f = F) {
      if (n <= 0) return 0;
      const m = d >= P.dStar ? 1 : (P.N * mass) / n, pc = (Math.max(dist, h * 0.5) * g.R) / 3.086e16;
      return Math.min(1, m / (pc * pc) / f);
    }
    // Split the most worthwhile cell first (a binary heap on err), until nothing needs it or the budget's spent.
    const root = mk(0, 0, 0, 0), heap = [root], cells = [], split = new Set();
    let total = root.draw, full = false;
    const push = (x) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].prio >= heap[i].prio) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].prio > heap[m].prio) m = l; if (r < heap.length && heap[r].prio > heap[m].prio) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    for (let it = 0; heap.length && it < 6000; it++) {
      const C = pop();
      if (!C.want || C.d >= P.dStar) { cells.push(C); continue; }
      const kids = [];
      let add = 0;
      for (let q = 0; q < 8; q++) {
        const K = mk(C.d + 1, C.i * 2 + (q & 1), C.j * 2 + ((q >> 1) & 1), C.k * 2 + ((q >> 2) & 1));
        if (K.n < 0.02 && K.d < P.dStar) continue;
        const near = Math.hypot(e[0] - K.c[0], e[1] - K.c[1], e[2] - K.c[2]) < K.h * 2.6; // close by: keep it whichever way you look, so turning round doesn't rebuild it
        if (!near && !this.inView(node, scale(K.c, g.R), K.h * 1.8 * g.R, 1.35)) continue; // a margin round the view, so a small turn needs nothing new
        kids.push(K); add += K.draw;
      }
      if (total - C.draw + add > budget) { cells.push(C); full = true; continue; } // dots drawn: budgeted
      if (cells.length + heap.length + kids.length > 400) { cells.push(C); continue; } // and draw calls
      // Split only once all its children are made (ask for them, keep the parent meanwhile): a region swaps from
      // coarse to fine in one go when it's ready, instead of a stand-in flashing over half-made neighbours.
      let ready = true;
      for (const K of kids) {
        const key = `gc${g.key}:${K.d}:${K.i}:${K.j}:${K.k}`, dd = K.d, ii = K.i, jj = K.j, kk = K.k;
        if (!this.store.need(key, 1 / K.err, () => ({ ...galaxyCell(g, shape, P, dd, ii, jj, kk), keep: true }))) ready = false;
      }
      if (!ready) { cells.push(C); continue; }
      total += add - C.draw;
      split.add(`${C.d}:${C.i}:${C.j}:${C.k}`);
      for (const K of kids) push(K);
    }
    cells.push(...heap);
    // A cell not made yet is stood in for by its nearest ancestor that is; and then none of that ancestor's
    // other descendants are drawn, so a region is either the coarse cell or its finer ones, never both on top
    // of each other (which flashed boxes of double density as the galaxy turned and cells re-split).
    const picks = [], stand = new Set();
    for (const C of cells) {
      let { d, i, j, k } = C, E = null;
      for (; d >= 0; d--, i >>= 1, j >>= 1, k >>= 1) {
        const key = `gc${g.key}:${d}:${i}:${j}:${k}`, dd = d, ii = i, jj = j, kk = k;
        E = d === C.d ? this.store.need(key, 1 / C.err, () => ({ ...galaxyCell(g, shape, P, dd, ii, jj, kk), keep: true })) : this.store.get(key);
        if (E) break;
      }
      if (!E) continue;
      picks.push({ E, d, i, j, k });
      if (d < C.d) stand.add(`${d}:${i}:${j}:${k}`);
    }
    const covered = (d, i, j, k) => { for (let a = d - 1, x = i >> 1, y = j >> 1, z = k >> 1; a >= 0; a--, x >>= 1, y >>= 1, z >>= 1) if (stand.has(`${a}:${x}:${y}:${z}`)) return true; return false; };
    const drawn = new Set();
    let drawnTotal = 0, dim = false;
    for (const { E, d, i, j, k } of picks) {
      if (stand.size && covered(d, i, j, k)) continue;
      const key = `gc${g.key}:${d}:${i}:${j}:${k}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const M = E.meta, n = this.node(key, () => new Node(node, 'gcell', key, scale(M.c, g.R)));
      // Samples smaller than a pixel would all draw as a pixel, and finer cells hold more of them: draw a share
      // in proportion to their area on screen, so refining a cell sharpens it without brightening it.
      const sh = share(d, E.n, M.mass, len(sub(e, M.c)), M.half, Fd), cnt = Math.round(E.n * sh);
      if (sh < 1) dim = true;
      if (!(cnt > 0)) continue;
      let sz = 1;
      if (!M.stars) {
        const dist = Math.max(len(sub(e, M.c)) - M.half * 1.2, M.half * 0.05) * g.R, spx = (M.sz * M.half * g.R) / dist / this.gl.pxAng;
        sz = Math.min(1, 3 / spx); // a cell left coarse near the eye would be giant blocks: keep its samples to dots
      }
      drawnTotal += cnt;
      this.add(E, n, M.half * g.R, cnt, { fade, minPx: 1, maxPx: 4, glow: true, sz });
      this.picks.push({ node: n, unit: M.half * g.R, data: M.data, count: E.n, kind: M.stars ? 'star' : 'sample', stars: M.stars, gI: I, cell: M });
    }
    I.split = split;
    // Out of budget before the view was fine enough: raise the threshold (fewer, brighter dots); well under it: lower it.
    // In notches, and only after it's been over (or well under) budget for a while: a threshold that moves every
    // frame moves the budget's cut-off every frame, and the sky flickers even when you hold still.
    // (Lowering it only helps while some dots are being held back; once every dot is drawn it would just sink.)
    const over = full ? 1 : drawnTotal < budget * 0.4 && dim ? -1 : 0;
    I.Fv = over && over === Math.sign(I.Fv || 0) ? I.Fv + over : over;
    if (I.Fv >= 20) { I.F = Math.min(1e6, I.F * 1.25); I.Fv = 0; } else if (I.Fv <= -20) { I.F = Math.max(1e-9, I.F / 1.25); I.Fv = 0; }
  }

  // ------------------------------------------------------------ systems and bodies

  /**
   * The clock runs at the speed of what you're looking at: about one orbit
   * at the camera's distance, round what it's near, every 40 s. A planet
   * from orbit: hours a second; a system: a year in seconds; a galaxy: it
   * turns in under a minute. On the ground or below, a minute a second.
   */
  timeRate() {
    const c = this.cam, A = c.anchor;
    if (A.kind === 'micro' || A.kind === 'grain') return 60;
    const pm = this.find('moon') || this.find('planet'), sn = this.find('star'), gn = this.find('galaxy');
    let M;
    if (pm) M = Math.max(1e22, pm.info.p.hist.earths * 5.972e24);
    else if (sn) M = sn.info.sys.mass;
    else if (gn) M = 2e41 * galaxyHistory(gn.info.g).mass;
    else M = 2e45;
    return clamp(kepler(Math.max(c.D, 1), M) / 40, 60, 8e13); // at most ~2.5 million years a second: a galaxy turns in a minute or so, not a blur
  }

  /** Planets and moons round their orbits, galaxies round their middles, by the clock. */
  orbits() {
    const T = this.T;
    for (const I of this.stars.values()) {
      for (const b of I.planets) {
        const p = b.p, ph = p.phase + (6.2832 * T) / p.P;
        b.node.pos = [p.a * Math.cos(ph), p.a * Math.sin(ph) * Math.cos(p.inc), p.a * Math.sin(ph) * Math.sin(p.inc)];
        for (const m of b.moons) {
          const q = m.p, mh = q.phase + (6.2832 * T) / q.P;
          m.node.pos = [q.a * Math.cos(mh), q.a * Math.sin(mh) * Math.cos(q.inc), q.a * Math.sin(mh) * Math.sin(q.inc)];
        }
      }
    }
    // A galaxy's spiral pattern turns as a whole (a density wave), once in its rotation period at three scale lengths.
    for (const I of this.gals.values()) {
      if (!I.rot0) I.rot0 = I.node.rot, I.theta = 0, I.spin = kepler(3 * I.g.R, 2e41 * galaxyHistory(I.g).mass);
      const th = ((6.2832 * T) / I.spin) % 6.2832, d = th - I.theta;
      if (!d) continue;
      I.theta = th;
      I.node.rot = mul3(I.rot0, axisRot([0, 0, 1], th));
      if (this.cam.anchor === I.node && !this.flight) { // the camera keeps still while the galaxy turns under it
        const Rz = axisRot([0, 0, 1], -d), c = this.cam;
        c.t = mulv(Rz, c.t); c.dir = mulv(Rz, c.dir); c.up = mulv(Rz, c.up);
      }
    }
  }

  systems(budget) {
    const D = this.cam.D, sn = this.find('star');
    let I = sn ? sn.info : null;
    if (!I) {
      const gn = this.find('galaxy');
      if (!gn || D > 2e16) return;
      const s = this.nearestStar(gn.info, scale(this.cam.t, 1 / gn.info.g.R));
      if (!s) return;
      I = this.si(s);
    }
    if (this.epoch < I.hist.born) return; // not born yet
    const dist = len(this.eyeIn(I.node)), E = I.sys.E;
    const fade = (1 - smooth(E * 40, E * 200, Math.max(dist, D))) * smooth(I.hist.born, I.hist.born + 0.05, this.epoch); // planets form in its first 50 million years
    if (fade <= 0.01) return;
    this.sysFade = fade;
    // orbits: dotted rings
    for (const b of I.planets) {
      const OE = this.store.need(`orb${b.key}`, 2, () => ring(720, b.p.inc));
      this.add(OE, I.node, b.p.a, 720, { fade, glow: true });
    }
    const left = { n: this.find('micro') ? budget * 0.6 : budget }; // down in the sand, the sand gets the rest
    const ground = this.find('grain') ? smooth(3e-7, 3e-6, D) : 1; // inside a grain, the mm blocks of the ground would be cliffs: let them go
    this.bodyDraw(I.body, null, fade, left);
    for (const b of I.planets) {
      this.bodyDraw(b, this.sunTo(b.node, I.node), fade, left, ground);
      const pd = len(this.eyeIn(b.node));
      if (b.moons.length && pd < b.p.soi * 6) {
        for (const m of b.moons) {
          const OE = this.store.need(`orb${m.key}`, 3, () => ring(360, m.p.inc));
          this.add(OE, b.node, m.p.a, 360, { fade: fade * (1 - smooth(b.p.soi * 2, b.p.soi * 6, pd)), glow: true });
          this.bodyDraw(m, this.sunTo(m.node, I.node), fade, left);
        }
      }
    }
  }

  /** A round body: a dot, a voxel ball, or its quadtree; then its rings and air. sun: towards the star, in its own frame. */
  bodyDraw(b, sun, fade, left, fadeOut = 1) {
    const W = b.W, R = W.R, e = this.eyeIn(b.node), dist = len(e), px = this.px(R, dist);
    const reach = W.rings ? R * 2.4 : R * 1.05;
    this.picks.push({ node: b.node, unit: 1, list: [{ x: 0, y: 0, z: 0, body: b }], count: 1, kind: 'body', r: R });
    if (!this.inView(b.node, [0, 0, 0], reach)) return;
    const F = this.frame(b.node), sv = sun ? norm(mulv(F.R, sun)) : null;
    const o = { fade: fade * fadeOut, sun: sv, ctr: F.o, glow: W.glow, minPx: 0 };
    this.spheres.push({ b, sun });
    if (fade * fadeOut <= 0.01) return;
    if (px < 2) {
      const col = W.kind === 'star' ? W.accent : W.accent || 0, big = W.kind === 'star' ? 4 : b.node.kind === 'grain' ? 2 : 3.5;
      const DE = this.store.need(`dot${col}:${big}`, 0, () => { const I = new Inst(1); I.push(0, 0, 0, -big, col, 1, 1, 0); return { data: I.done(), n: 1 }; });
      this.add(DE, b.node, 1, 1, { fade, glow: true });
    } else if (px < 140) {
      const g = [3, 4, 6, 8, 12, 16, 24].find((v) => v >= px / 5) || 24;
      for (let f = 0; f < 6; f++) {
        const key = `bb${b.key}:${g}:${f}`, E = this.store.need(key, 1, () => b.patch(f, 0, 0, 0, g));
        if (!E) continue;
        const n = this.node(key, () => new Node(b.node, 'patch', key, E.meta.pos, E.meta.rot));
        this.add(E, n, E.meta.vox, E.n, o);
        left.n -= E.n;
      }
    } else this.quadtree(b, e, o, left);
    if (W.rings && px > 1) {
      const E = this.store.need(`ring${b.key}`, 1, () => ringMesh(W));
      this.add(E, b.node, R, Math.round(clamp(px * px * 0.8, 200, 24000)), { fade, sun: sv, minPx: 1, maxPx: 5 }); // a ring dot stands for many small rocks
    }
    const air = smooth(R * 1.6, R * 2.6, dist); // a haze seen from afar; close in, its dots would be squares in your face
    if (W.atmo && px > 6 && air > 0.01) {
      const E = this.store.need(`air${b.key}`, 1, () => atmoMesh(W));
      this.add(E, b.node, R, Math.round(clamp(px * px * 0.08, 60, 2500)), { fade: fade * 0.5 * air, minPx: 1, glow: true });
    }
    if (W.atmo && dist < R * 1.04 && sun) { // the sky
      const day = dot(norm(e), sun);
      this.skyK = 0.4 * (1 - smooth(R * 1.002, R * 1.035, dist)) * smooth(-0.15, 0.35, day);
      this.sky = SKY[W.kind === 'lava' ? 1 : W.kind === 'desert' ? 2 : W.kind === 'gas' ? 0 : 4];
    }
  }

  quadtree(b, e, o, left) {
    const W = b.W, R = W.R, ed = len(e), en = scale(e, 1 / ed), amp = W.amp * 1.5;
    const k9 = (9 * this.gl.pxAng) / Math.max(0.3, this.detail); // split when a column would be more than ~9 px
    b.adapt = clamp(b.adapt || 1, 1, 6);
    const maxCubes = Math.max(15000, left.n);
    const horizon = ed > R - amp ? Math.acos(clamp((R - amp) / ed, -1, 1)) : Math.PI;
    const hcache = b.hc || (b.hc = new Map());
    const mk = (f, L, i, j) => {
      const span = 2 / 2 ** L, dc = dirOf(f, -1 + (i + 0.5) * span, -1 + (j + 0.5) * span), g = gridAt(L);
      const ang = span * 0.62, size = R * span * 0.8;
      let hc = 0;
      if (L >= 3) { // its ground, not sea level: mountains are near
        const k = `${f}:${L}:${i}:${j}`;
        hc = hcache.get(k);
        if (hc === undefined) { if (hcache.size > 50000) hcache.clear(); hc = b.height(dc, size * 0.25); if (W.sea !== null) hc = Math.max(hc, W.sea); hcache.set(k, hc); }
      }
      const ctr = scale(dc, R + hc);
      const th = Math.acos(clamp(dot(dc, en), -1, 1));
      const vis = th - ang < horizon + 0.02 && this.inView(b.node, ctr, size * 1.4 + Math.min(W.amp, size) * 0.8);
      const made = this.store.m.get(`bp${b.key}:${f}:${L}:${i}:${j}`);
      return { f, L, i, j, g, err: size / Math.max(len(sub(e, ctr)), size * 0.05), tau: k9 * g * b.adapt, vis, vox: (R * span * 0.7854) / g, cubes: made ? made.n : g * g * 1.8 };
    };
    let P = [], full = false, cubes = 0;
    for (let f = 0; f < 6; f++) { const K = mk(f, 0, 0, 0); if (K.vis) { P.push(K); cubes += K.cubes; } }
    for (let it = 0; it < 3000; it++) {
      let bi = -1, be = 0;
      for (let q = 0; q < P.length; q++) { const p = P[q], x = p.err / p.tau; if (x > 1 && x > be && p.vox > W.minVox) { be = x; bi = q; } }
      if (bi < 0) break;
      const C = P[bi], kids = [];
      let add = -C.cubes;
      for (let q = 0; q < 4; q++) { const K = mk(C.f, C.L + 1, C.i * 2 + (q & 1), C.j * 2 + (q >> 1)); if (K.vis) { kids.push(K); add += K.cubes; } }
      if (cubes + add > maxCubes) { full = true; break; }
      cubes += add;
      P[bi] = P[P.length - 1]; P.pop();
      P.push(...kids);
    }
    // Out of cubes before the ground under the eye was fine: coarsen the rings round it next frame; room to spare: sharpen them.
    const chainDone = !P.some((p) => p.err > 3 && p.vox > W.minVox);
    if (full && !chainDone) b.adapt *= 1.12; else if (!full) b.adapt *= 0.97;
    const drawn = new Set();
    for (const C of P) {
      let { L, i, j } = C, E = null, key = '';
      for (; L >= 0; L--, i >>= 1, j >>= 1) {
        key = `bp${b.key}:${C.f}:${L}:${i}:${j}`;
        const LL = L, ii = i, jj = j;
        E = L === C.L ? this.store.need(key, 1 / C.err, () => b.patch(C.f, LL, ii, jj, gridAt(LL))) : this.store.get(key);
        if (E) break;
      }
      if (!E || drawn.has(key)) continue;
      drawn.add(key);
      const n = this.node(key, () => new Node(b.node, 'patch', key, E.meta.pos, E.meta.rot));
      this.add(E, n, E.meta.vox, E.n, o);
      left.n -= E.n;
    }
    if (!drawn.size) { // nothing made yet: the ball
      for (let f = 0; f < 6; f++) {
        const key = `bb${b.key}:24:${f}`, E = this.store.need(key, 0, () => b.patch(f, 0, 0, 0, 24));
        if (E) this.add(E, this.node(key, () => new Node(b.node, 'patch', key, E.meta.pos, E.meta.rot)), E.meta.vox, E.n, o);
      }
    }
  }

  // ------------------------------------------------------------ sand and atoms

  sand(budget) {
    const M = this.find('micro'), D = this.cam.D;
    if (!M) return;
    const fade = 1 - smooth(0.03, 0.09, D);
    if (fade <= 0.01) return;
    const e = this.eyeIn(M);
    const at = this.cam.anchor === M ? this.cam.t : this.targetIn(M);
    const side = GT * GRAIN, rv = clamp(D * 9, 0.006, 0.04);
    const t0 = [Math.floor((at[0] - rv) / side), Math.floor((at[1] - rv) / side)], t1 = [Math.floor((at[0] + rv) / side), Math.floor((at[1] + rv) / side)];
    const near = [], others = this.find('grain') ? smooth(1e-7, 1e-6, D) : 1; // the other grains, as you go into one
    for (let tx = t0[0]; tx <= t1[0]; tx++) for (let ty = t0[1]; ty <= t1[1]; ty++) {
      const key = `gt${M.key}:${tx}:${ty}`;
      const c = [(tx + 0.5) * side, (ty + 0.5) * side, 0];
      c[2] = this.zc.get(key) ?? (this.zc.size > 5000 && this.zc.clear(), this.zc.set(key, M.surfZ(c[0], c[1])).get(key));
      if (!this.inView(M, c, side)) continue;
      const E = this.store.need(key, Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]) / side, () => grainTile(M.seed, tx, ty, M.surfZ, M.body.W.minerals));
      if (!E) continue;
      const n = this.node(key, () => new Node(M, 'gtile', key, [tx * side, ty * side, 0]));
      this.add(E, n, GRAIN, E.n, { fade: fade * others, sun: this.sunView(M) });
      for (const g of E.meta.grains) {
        const px = this.px(g.r, Math.hypot(g.x - e[0], g.y - e[1], g.z - e[2]));
        if (px > 9) near.push({ g, px });
      }
      this.picks.push({ node: M, unit: 1, list: E.meta.grains, count: E.meta.grains.length, kind: 'grain', micro: M });
    }
    near.sort((a, b) => b.px - a.px);
    const left = { n: budget * 0.7 }, gn = this.find('grain'), sun = this.sunIn(M);
    const atomsIn = D < 3e-8 ? smooth(5e-9, 1.6e-8, D) : 1;
    for (const { g } of near.slice(0, 24)) {
      if (left.n <= 0) break;
      const B = this.grain(M, g);
      const s = sun ? tmulv(B.node.rot, sun) : null;
      this.bodyDraw(B, s, fade, left, gn === B.node ? atomsIn : others);
    }
    if (gn && !near.find((x) => x.g === gn.info.g)) this.bodyDraw(gn.info, sun ? tmulv(gn.rot, sun) : null, fade, left, atomsIn);
  }

  atoms(budget) {
    const gn = this.find('grain'), D = this.cam.D;
    if (!gn || D > 3e-8) return;
    const B = gn.info, fade = 1 - smooth(1e-8, 3e-8, D);
    const tB = this.cam.anchor === gn ? this.cam.t : this.targetIn(gn);
    const L = this.lattice(B, norm(tB)), at = this.targetIn(L), e = this.eyeIn(L);
    { // the atom you're looking at: zoom far enough into it and you're inside (main.js)
      const i = Math.round(at[0] / ATOM), j = Math.round(at[1] / ATOM), k = Math.floor(L.surfZ((i + 0.5) * ATOM, (j + 0.5) * ATOM) / ATOM);
      this.atomUnder = { L, i, j, k, d: Math.hypot(at[0] - i * ATOM, at[1] - j * ATOM, at[2] - k * ATOM), mineral: B.W.mineral[0] };
    }
    const side = AT * ATOM, rv = Math.min(D * 14, Math.sqrt(budget / 10 / Math.PI) * ATOM);
    const t0 = [Math.floor((at[0] - rv) / side), Math.floor((at[1] - rv) / side)], t1 = [Math.floor((at[0] + rv) / side), Math.floor((at[1] + rv) / side)];
    const mn = B.W.mineral;
    for (let tx = t0[0]; tx <= t1[0]; tx++) for (let ty = t0[1]; ty <= t1[1]; ty++) {
      const key = `at${L.key}:${tx}:${ty}`;
      const c = [(tx + 0.5) * side, (ty + 0.5) * side, 0];
      c[2] = this.zc.get(key) ?? (this.zc.size > 5000 && this.zc.clear(), this.zc.set(key, L.surfZ(c[0], c[1])).get(key));
      if (!this.inView(L, c, side)) continue;
      const E = this.store.need(key, Math.hypot(c[0] - e[0], c[1] - e[1]) / side, () => atomTile(L.seed, tx, ty, L.surfZ, mn));
      if (!E) continue;
      const n = this.node(key, () => new Node(L, 'atile', key, [tx * side, ty * side, 0]));
      this.add(E, n, ATOM, E.n, { fade, jit: 0.05, sun: this.sunView(L) });
    }
  }

  /** The camera's target, in n's frame. */
  targetIn(n) { const F = this.frame(n); return tmulv(F.T.R, sub(this.cam.t, F.T.t)); }
  /** Towards the star, in n's frame (or null, out in space). */
  sunIn(n) {
    const sn = this.find('star');
    if (!sn) return null;
    let b = n;
    while (b && b.kind !== 'planet' && b.kind !== 'moon') b = b.parent;
    if (b) { const T = rel(n, b); return norm(tmulv(T.R, this.sunTo(b, sn))); } // on a world: its turning sky
    const T = rel(n, sn);
    return norm(tmulv(T.R, scale(T.t, -1)));
  }
  /** Towards the star from body node n, in n's frame; a world turns once a day, which here turns its sky (the light) instead of its ground. */
  sunTo(n, star) {
    const T = rel(n, star), s = norm(tmulv(T.R, scale(T.t, -1))), day = n.info?.p?.day;
    return day ? mulv(axisRot([0, 0, 1], (-6.2832 * this.T) / day), s) : s;
  }
  sunView(n) { const s = this.sunIn(n); return s ? norm(mulv(this.frame(n).R, s)) : null; }

  // ------------------------------------------------------------ moving about

  /** Move the anchor up and down the tree to where the target is; pull the target onto things worth looking at. */
  settle(dt) {
    const c = this.cam;
    if (this.atlasOn) { c.D = clamp(c.D, (UNIT / FINE) * 0.6, UNIT * 10); c.up = nlerp(c.up, [0, 1, 0], Math.min(1, dt * 2)); return; }
    for (let i = 0; i < 8; i++) {
      const A = c.anchor;
      if (A === this.root) break;
      const r = len(c.t), x = A.extent;
      const leave = {
        galaxy: r > 1.6 * x || c.D > 10 * x,
        star: r > 6 * x || c.D > 60 * x,
        planet: r > 1.5 * x || c.D > 8 * x,
        moon: r > 1.5 * x || c.D > 8 * x,
        micro: c.D > 0.12 || r > 0.6,
        grain: c.D > 60 * x || r > 5 * x,
      }[A.kind];
      if (!leave) break;
      c.reanchor(A.parent);
    }
    for (let i = 0; i < 8; i++) { const n = this.childFor(c.anchor); if (!n) break; c.reanchor(n); }
    const A = c.anchor, k = Math.min(1, dt * 3);
    // Zooming into empty space would end in black: there's nothing between the galaxies, the stars or
    // the planets to land on. So close in, the target drifts to the nearest thing worth seeing, and the
    // zoom can't get ahead of it (the camera stays at least a few times its distance from it).
    const was = this.pulling;
    this.pulling = false;
    const attract = (p, near) => {
      if (!p || performance.now() - (this.zoomingOut || -1e9) < 500) return; // backing away on purpose: don't drag the view sideways
      const d = len(sub(p, c.t));
      if (d < near) return;
      this.pulling = d > c.D * 0.02; // while it's on its way, zooming aims at it, not at the pointer
      c.t = add(c.t, scale(sub(p, c.t), Math.min(1, dt * 6)));
      c.D = Math.max(c.D, len(sub(p, c.t)) * 1.5); // the zoom waits for the pull, so what you're pulled to stays in view: it locks on, it doesn't slide in from off-screen
    };
    if (A.kind === 'root' && c.D < 2e22) {
      const ci = [Math.floor(c.t[0] / CELL), Math.floor(c.t[1] / CELL), Math.floor(c.t[2] / CELL)];
      let best = null, bd = Infinity;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let kk = -1; kk <= 1; kk++) for (const g of this.web.galaxies(ci[0] + i, ci[1] + j, ci[2] + kk)) {
        const d = Math.hypot(g.x * CELL - c.t[0], g.y * CELL - c.t[1], g.z * CELL - c.t[2]);
        if (d < bd) { bd = d; best = g; }
      }
      if (best) attract([best.x * CELL, best.y * CELL, best.z * CELL], best.R * 7); // only from outside it (it is 6.5 R across; the camera joins it inside 7.8 R)
    }
    if (A.kind === 'galaxy' && (c.D < 3e18 || was)) { // ~300 ly across: from here on, single stars are what there is to see
      const I = A.info, R = I.g.R, tp = scale(c.t, 1 / R);
      let s = this.nearestStar(I, tp);
      for (let q = 0.8; !s && q > 0.01; q *= 0.75) s = this.nearestStar(I, scale(tp, q)); // out in the empty halo: look further in
      if (s) attract([s.x * R, s.y * R, s.z * R], 0);
    }
    if (A.kind === 'star' && c.D < A.extent * 3 && c.D > A.info.body.W.R * 4) { // well off to one side of everything: come back to the star or the nearest planet (right by the star, its surface takes over)
      let best = [0, 0, 0], bd = len(c.t) / 3; // the star itself counts, from a little further off
      for (const b of A.info.planets) { const d = len(sub(b.node.pos, c.t)); if (d < bd) { bd = d; best = b.node.pos; } }
      attract(best, c.D * 0.25);
    }
    this.glide(dt);
    const b = this.bodyOf(A);
    if (b) { // close to a world: look at its ground, from above it
      const R = b.W.R;
      if (c.D < 2.5 * R && len(c.t) < R * 0.9) { // the target is inside the world: move it out to the ground along your line of sight, so the view doesn't turn
        const e = c.eye(), Rs = R + Math.max(0, b.W.sea ?? 0), B = dot(e, c.dir), C = dot(e, e) - Rs * Rs, disc = B * B - C; // eye - dir*s meets the sphere at s = B ± sqrt(disc)
        if (disc > 0) { const sHit = B - Math.sqrt(disc), g = b.surface(norm(sub(e, scale(c.dir, sHit))), c.D * 0.01), sNew = len(sub(e, g)); if (sNew > 0) { c.t = sub(e, scale(c.dir, sNew)); c.D = sNew; } }
      }
      const tr = len(c.t);
      if (tr > R * 0.9 && tr < R * 1.2) { // close in, the target stays on the ground (for a grain, the same surface its atoms sit under)
        const g = b.surface(norm(c.t), Math.max(c.D * 0.005, b.W.kind === 'grain' ? ATOM : b.W.minVox)), off = len(sub(g, c.t));
        if (off < c.D * 0.05) c.t = g;
        else { c.t = add(c.t, scale(sub(g, c.t), Math.min(1, dt * 8))); c.D = Math.max(c.D, len(sub(g, c.t)) * 1.5); } // eased onto it if it's far off (and the zoom waits for it), so the view never jumps
      }
      else if (tr >= R * 1.2 && c.D < R * 4) { attract(scale(norm(c.t), R * 1.02), 0); this.tipUp(norm(c.t), 0.25, dt); } // zooming into the empty space beside it: glide onto it (looking down onto it as you come), rather than snap at the last moment
      const near = 1 - smooth(R * 0.3, R * 2.5, c.D);
      if (near > 0) {
        c.up = nlerp(c.up, norm(c.t), k * near);
        const floor = 0.06 * smooth(R * 0.05, R * 0.002, c.D);
        if (len(c.t) < R * 1.2 && dot(c.dir, norm(c.t)) < floor) this.tipUp(norm(c.t), floor, dt); // back above the horizon, as a smooth tilt
      }
      c.D = Math.max(c.D, A.kind === 'grain' ? D_MIN : SOLID.has(b.W.kind) ? 4e-4 : b.W.minVox * 30);
      if (c.D < R * 0.3) this.clearGround((e) => len(e) - len(b.surface(norm(e), Math.max(c.D * 0.01, b.W.minVox))), norm(c.t));
    }
    if (A.kind === 'micro') {
      this.clearGround((e) => e[2] - A.surfZ(e[0], e[1]), [0, 0, 1]);
      c.up = nlerp(c.up, [0, 0, 1], k);
      c.t = [c.t[0], c.t[1], A.surfZ(c.t[0], c.t[1])];
      if (dot(c.dir, [0, 0, 1]) < 0.05) c.dir = norm([c.dir[0], c.dir[1], 0.05]);
      c.D = Math.max(c.D, 4e-4 * 0.2);
    }
    if (!this.steering && A.kind === 'galaxy') c.up = nlerp(c.up, [0, 0, 1], k * 0.3);
    if (!this.steering && A.kind === 'star' && c.D > A.info.body.W.R * 3) c.up = nlerp(c.up, [0, 0, 1], k * 0.3);
  }

  childFor(A) {
    const c = this.cam, t = c.t, D = c.D;
    if (A.kind === 'root') {
      const ci = [Math.floor(t[0] / CELL), Math.floor(t[1] / CELL), Math.floor(t[2] / CELL)];
      let best = null, bd = Infinity;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        for (const g of this.web.galaxies(ci[0] + i, ci[1] + j, ci[2] + k)) {
          const d = Math.hypot(g.x * CELL - t[0], g.y * CELL - t[1], g.z * CELL - t[2]), x = 6.5 * g.R;
          if (d < 1.2 * x && D < 6 * x && d < bd) { bd = d; best = g; }
        }
      }
      return best ? this.gi(best).node : null;
    }
    if (A.kind === 'galaxy' && D < 3e15) {
      const I = A.info, s = this.nearestStar(I, scale(t, 1 / I.g.R));
      if (!s) return null;
      const S = this.si(s), d = len(sub(t, S.node.pos));
      return d < 4 * S.sys.E && D < 30 * S.sys.E ? S.node : null;
    }
    if (A.kind === 'star') {
      for (const b of A.info.planets) if (len(sub(t, b.node.pos)) < b.p.soi && D < 3 * b.p.soi) return b.node;
    }
    const b = this.bodyOf(A);
    if (A.kind === 'planet') for (const m of b.moons) { const d = len(sub(t, m.node.pos)); if (d < m.node.extent && d < 0.4 * len(m.node.pos) && D < 3 * m.node.extent) return m.node; } // only when you're really at the moon, not when it swings past
    if ((A.kind === 'planet' || A.kind === 'moon') && SOLID.has(b.W.kind) && D < 0.05) {
      const r = len(t);
      if (Math.abs(r - b.W.R) < b.W.amp * 4 && (b.W.sea === null || r - b.W.R > b.W.sea + 0.01)) return this.spot(b, norm(t));
    }
    if (A.kind === 'micro') {
      let best = null, bd = Infinity;
      for (const B of this.grains.values()) {
        if (B.node.parent !== A) continue;
        const d = len(sub(t, B.node.pos));
        if (d < 2 * B.W.R && D < 25 * B.W.R && d < bd) { bd = d; best = B; }
      }
      return best ? best.node : null;
    }
    return null;
  }

  /** Zoom by k (<1 in) towards screen point (x, y): the target slides towards what's there. */
  zoomAt(x, y, k) { // always about what you're looking at (the middle of the view): predictable; select and Go to move elsewhere
    this.stopFlight();
    const c = this.cam;
    if (k > 1 && c.D >= D_MAX * 0.999 && !this.atlasOn) this.wantsOut = true; // past the top: back out of the atom this universe is in (main.js)
    c.D = clamp(c.D * k, D_MIN, D_MAX);
    if (k < 1) this.zoomingIn = performance.now(); // settle() tips the view gently while you zoom down onto ground
    else if (k > 1) this.zoomingOut = performance.now(); // and holds off pulling you towards things while you back away
  }

  /**
   * Keep the eye out of the ground: if it's below the terrain under it (height(eye) < a little clearance),
   * tip the view up about the target, step by step, until it clears. height(e): metres above ground.
   */
  clearGround(height, up) {
    const c = this.cam, clear = c.D * 0.03, buried = height(c.eye()) < -c.D * 0.15; // only deep under gets fast steps
    for (let i = 0; i < 3 && height(c.eye()) < clear; i++) {
      const e = dot(c.dir, up);
      if (e > 0.985) break;
      const side = sub(c.dir, scale(up, e)), sl = len(side), h = sl > 1e-6 ? scale(side, 1 / sl) : [1, 0, 0];
      const ne = Math.min(0.99, e + (buried ? 0.03 : 0.012)); // a pebble under the eye nudges it up; even buried, it climbs out over a few frames rather than jerk
      c.dir = norm(add(scale(up, ne), scale(h, Math.sqrt(1 - ne * ne))));
    }
  }

  /** Tilt the view up about the target (towards `up`) until its elevation is at least `want`, at most ~0.9 rad a second. */
  tipUp(up, want, dt) {
    const c = this.cam, e = dot(c.dir, up);
    if (e >= want) return;
    const side = sub(c.dir, scale(up, e)), sl = len(side), h = sl > 1e-6 ? scale(side, 1 / sl) : [1, 0, 0];
    const ang = Math.acos(clamp(e, -1, 1)), goal = Math.acos(clamp(want, -1, 1)), ne = Math.cos(ang - Math.min(ang - goal, 0.9 * dt));
    c.dir = norm(add(scale(up, ne), scale(h, Math.sqrt(Math.max(0, 1 - ne * ne)))));
  }

  /** Which way is up for the ground the target is on (null: out in space). */
  groundUp() {
    const c = this.cam, A = c.anchor, b = this.bodyOf(A);
    if (A.kind === 'micro') return [0, 0, 1];
    if (b && A.kind !== 'star' && c.D < b.W.R * 0.3) return norm(c.t);
    return null;
  }

  /**
   * Move the target by a drag of (dx, dy) px, as if grabbing what's there:
   * on the ground it slides along the ground (drag down to go forwards), in
   * space it moves across the view.
   */
  pan(dx, dy) {
    this.stopFlight();
    const c = this.cam, s = c.D * this.gl.pxAng, g = this.groundUp();
    if (!this.gl.pxAng) return;
    if (g) {
      let f = sub(scale(c.dir, -1), scale(g, dot(scale(c.dir, -1), g)));
      if (len(f) < 1e-6) { const V = c.axes(); f = sub([V[3], V[4], V[5]], scale(g, dot([V[3], V[4], V[5]], g))); } // straight down: forwards is screen-up
      f = norm(f);
      const r = norm(cross(f, g)), k = s / Math.max(0.35, Math.abs(dot(c.dir, g))); // a shallow view sees the ground further off: reach further
      c.t = add(c.t, add(scale(r, -dx * k), scale(f, dy * k)));
    } else {
      const V = c.axes();
      c.t = add(c.t, add(scale([V[0], V[1], V[2]], -dx * s), scale([V[3], V[4], V[5]], dy * s)));
    }
  }

  /** Any steering by hand ends a flight where it is. */
  stopFlight() { if (this.flight) { this.flight = null; this.warp = 0; } }

  /** Zooming down onto ground tips the view towards the horizon, so the landscape stands up as you land (unless you've just set the tilt yourself). */
  glide(dt) {
    const now = performance.now();
    if (now - (this.zoomingIn || -1e9) > 400 || now - (this.tilted || -1e9) < 6000) return;
    const c = this.cam, A = c.anchor, b = this.bodyOf(A);
    let up = null, s = 0;
    if (b && A.kind !== 'star') { up = norm(c.t); s = smooth(b.W.R * 0.08, b.W.R * 0.002, c.D); }
    if (A.kind === 'micro') { up = [0, 0, 1]; s = 1; }
    if (!up || s <= 0) return;
    const want = Math.cos(0.95 * s), e = dot(c.dir, up);
    if (e <= want) return;
    const eye = c.eye(), above = A.kind === 'micro' ? eye[2] - A.surfZ(eye[0], eye[1]) : len(eye) - len(b.surface(norm(eye), Math.max(c.D * 0.01, b.W.minVox)));
    if (above < c.D * 0.25) return; // the ground's close under the eye: don't tip it down into it (the clearance would only tip it back)
    const side = sub(c.dir, scale(up, e)), sl = len(side), h = sl > 1e-6 ? scale(side, 1 / sl) : norm(cross(up, [0.31, 0.95, 0.02]));
    const ang = Math.acos(clamp(e, -1, 1)), goal = Math.acos(clamp(want, -1, 1)), ne = Math.cos(ang + Math.min(goal - ang, 0.6 * dt)); // at most ~0.6 rad a second: a turn of the head, not a lurch
    c.dir = norm(add(scale(up, ne), scale(h, Math.sqrt(Math.max(0, 1 - ne * ne)))));
  }

  /** The ray through screen point (x, y): origin and direction in the anchor's frame. */
  ray(x, y) {
    const ty = Math.tan(this.gl.fov / 2), w = this.gl.w, h = this.gl.h;
    const dv = norm([((x / w) * 2 - 1) * ty * (w / h), (1 - (y / h) * 2) * ty, -1]);
    return [this.cam.eye(), norm(tmulv(this.cam.axes(), dv))];
  }

  /**
   * What's at screen point (x, y)? The nearest round thing the ray hits, or
   * the point (galaxy, star, sample, grain) drawn nearest the pointer.
   * Returns { at: point in the anchor's frame, go(): where to fly } or null.
   */
  pick(x, y, quick = false) {
    if (!this.V) return null;
    const [o, d] = this.ray(x, y), D = this.cam.D, w = this.gl.w, h = this.gl.h, ty = Math.tan(this.gl.fov / 2);
    let hit = null;
    for (const { b } of this.spheres) {
      const F = this.frame(b.node), ob = tmulv(F.T.R, sub(o, F.T.t)), db = tmulv(F.T.R, d), R = b.W.R + Math.max(0, b.W.sea ?? 0);
      const B = dot(ob, db), C = dot(ob, ob) - R * R, disc = B * B - C;
      if (disc < 0) continue;
      const s = -B - Math.sqrt(disc);
      if (s < 0 || (hit && s >= hit.s)) continue;
      const pB = add(ob, scale(db, s)), S = b.surface(norm(pB), Math.max(s * 1e-3, b.W.minVox));
      hit = { s, b, at: add(F.T.t, mulv(F.T.R, S)), pB: S };
    }
    let pt = null, bp = quick ? 10 : 18;
    const proj = (F, unit, lx, ly, lz) => {
      const v = add(F.o, scale(mulv(F.R, [lx, ly, lz]), unit / D));
      if (v[2] >= 0) return null;
      const sx = ((v[0] / -v[2] / (ty * (w / h))) + 1) * 0.5 * w, sy = (1 - v[1] / -v[2] / ty) * 0.5 * h;
      return [sx, sy, -v[2] * D];
    };
    for (const P of this.picks) {
      const F = this.frame(P.node);
      if (P.data) { // galaxy octree cells: every sample
        const a = P.data, n = Math.min(P.count, a.length / 8);
        for (let i = 0; i < n; i++) {
          const q = proj(F, P.unit, a[i * 8], a[i * 8 + 1], a[i * 8 + 2]);
          if (!q) continue;
          const dp = Math.hypot(q[0] - x, q[1] - y);
          if (dp < bp && (!hit || q[2] < hit.s)) { bp = dp; pt = { P, i, depth: q[2] }; }
        }
        continue;
      }
      for (let i = 0; i < Math.min(P.count, P.list.length); i++) {
        const it = P.list[i], f = P.off || [0, 0, 0], q = proj(F, P.unit, it.x - f[0], it.y - f[1], it.z - f[2]);
        if (!q) continue;
        const dp = Math.hypot(q[0] - x, q[1] - y);
        if (dp < bp && (!hit || q[2] < hit.s * 0.98)) { bp = dp; pt = { P, i, it, depth: q[2] }; }
      }
    }
    if (pt) return this.resolve(pt, quick);
    if (hit) {
      const b = hit.b;
      return {
        at: hit.at, label: b.W.kind === 'grain' ? `Into this grain of ${b.W.mineral[0]}` : b.W.kind === 'star' || !SOLID.has(b.W.kind) ? `Closer to ${b.p?.name || b.star?.name || 'it'}` : `Land here · ${b.p.name}`,
        go: () => ({ node: b.node, p: hit.pB, D: clamp(this.cam.D * 0.18, b.W.kind === 'grain' ? 2e-9 : SOLID.has(b.W.kind) ? 0.02 : b.W.minVox * 40, b.W.R * 0.8) }),
      };
    }
    return null;
  }

  resolve(pt, quick) {
    const { P } = pt, F = this.frame(P.node), at = (l) => add(F.T.t, mulv(F.T.R, l));
    if (P.kind === 'galaxy') {
      const g = pt.it.gal || pt.it, I = this.gi(g);
      const f = P.off || [0, 0, 0], p = P.list.length === 1 ? at([0, 0, 0]) : at(scale([pt.it.x - f[0], pt.it.y - f[1], pt.it.z - f[2]], P.unit));
      return { at: p, label: this.label(I.node), go: () => this.destFor(I.node) };
    }
    if (P.kind === 'star' || P.kind === 'sample') {
      const a = P.data, i = pt.i, I = P.gI, lp = [a[i * 8], a[i * 8 + 1], a[i * 8 + 2]];
      const p = at(scale(lp, P.unit));
      if (quick) return { at: p };
      const gpt = add(P.cell.c, scale(lp, P.cell.half)), s = P.kind === 'star' ? P.stars[i] : this.nearestStar(I, gpt);
      if (!s) return { at: p };
      const S = this.si(s);
      return { at: p, label: `${S.name} · ${CLASS_NAMES[s.sc.cls]}, ${S.planets.length} planet${S.planets.length === 1 ? '' : 's'}`, go: () => this.destFor(S.node) };
    }
    if (P.kind === 'body') {
      const b = pt.it.body, p = at([0, 0, 0]);
      return { at: p, label: this.label(b.node), go: () => this.destFor(b.node) };
    }
    if (P.kind === 'atlas') {
      const b = pt.it.b, p = b.p;
      return { at: at([0, 0, 0]), label: `${p.name} · in the atlas`, go: () => ({ node: b.node, p: [0, 0, 0], D: this.cam.D * 0.5, atlas: p }) };
    }
    if (P.kind === 'mark') {
      const m = pt.it.m;
      return { at: at([0, 0, 0]), label: `${m.mine ? 'Your block' : 'A block'}${m.note ? ` · “${m.note}”` : ''}`, go: () => this.destFor(m.node) };
    }
    if (P.kind === 'grain') {
      const g = pt.it, B = this.grain(P.micro, g);
      return { at: at([g.x, g.y, g.z]), label: `Into this grain of ${g.mineral[0]}`, go: () => ({ node: B.node, p: [0, 0, 0], D: g.r * 4 }) };
    }
    return null;
  }

  /** Where to look at a body from: mostly from its sunny side. */
  niceDir(b) {
    if (!b.star) return [0, -0.5, 0.86];
    const T = rel(b.star.node, b.node), s = norm(T.t);
    return norm(add(scale(s, 0.8), [0.25, -0.35, 0.4]));
  }

  /** Where to stand to see a place: a galaxy from above its disc, a system whole, a world from its sunny side. */
  destFor(n) {
    if (n.kind === 'mark') return { node: n.parent, p: n.pos.slice(), D: Math.max(this.cam.D * 0.1, 12), up: null };
    if (n.kind === 'galaxy') return { node: n, p: [0, 0, 0], D: n.extent * 2.2, dir: norm([0.1, -0.55, 0.83]), up: [0, 0, 1] };
    if (n.kind === 'star') return { node: n, p: [0, 0, 0], D: n.extent * 1.1, dir: norm([0.2, -0.6, 0.77]), up: [0, 0, 1] };
    const b = this.bodyOf(n);
    if (b) return { node: n, p: [0, 0, 0], D: b.W.R * (b.W.rings ? 5 : 3.2), dir: this.niceDir(b), up: [0, 0, 1] };
    return null;
  }

  /** The k real stars nearest p (galaxy units). */
  starsNear(gI, p, k, until = Infinity) { // until: a performance.now() after which it makes no new leaf cells (each is thousands of stars in a dense core)
    const P = gI.P, size = (2 * P.B) / 2 ** P.dStar, n = 2 ** P.dStar, all = [];
    const ci = Math.floor((p[0] + P.B) / size), cj = Math.floor((p[1] + P.B) / size), ck = Math.floor((p[2] + P.B) / size);
    for (const [a, b, c] of NEAR27) { // its own cell first, then faces, edges, corners
      const i = ci + a, j = cj + b, kk = ck + c;
      if (i < 0 || j < 0 || kk < 0 || i >= n || j >= n || kk >= n) continue;
      if (!this.leaf.has(`${gI.g.key}:${i}:${j}:${kk}`) && performance.now() > until) continue;
      for (const s of this.leafStars(gI, i, j, kk)) all.push([Math.hypot(s.x - p[0], s.y - p[1], s.z - p[2]), s]);
    }
    return all.sort((x, y) => x[0] - y[0]).slice(0, k).map((x) => x[1]);
  }

  /**
   * The places you can go from here, to show as markers: the galaxies round
   * you on the web, the stars round you in a galaxy, a system's planets, a
   * planet's moons. Each { key, node, label, sub, dest }.
   */
  targets() {
    const A = this.cam.anchor, c = this.cam, out = [];
    if (this.atlasOn) return this.atlasTargets();
    for (const m of this.marks) if (m.node) out.push({ key: `mark${m.id}`, node: m.node, label: `◆ ${m.note || (m.mine ? 'your block' : 'a block')}`, sub: m.mine ? '(yours)' : '' });
    if (A.kind === 'root') {
      const ci = [Math.floor(c.t[0] / CELL), Math.floor(c.t[1] / CELL), Math.floor(c.t[2] / CELL)], gs = [];
      const r = c.D > 3e24 ? 0 : 1;
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) for (const g of this.web.galaxies(ci[0] + i, ci[1] + j, ci[2] + k)) gs.push([Math.hypot(g.x * CELL - c.t[0], g.y * CELL - c.t[1], g.z * CELL - c.t[2]) / g.R, g]);
      gs.sort((a, b) => a[0] - b[0]);
      for (const [, g] of gs.slice(0, 24)) { const I = this.gi(g); out.push({ key: g.key, node: I.node, label: I.name.split(' ')[0], sub: { S: 'spiral', E: 'elliptical', I: 'irregular' }[g.type] }); }
    } else if (A.kind === 'galaxy') {
      const I = A.info, R = I.g.R, tp = scale(c.t, 1 / R), P = I.P, leaf = (2 * P.B) / 2 ** P.dStar, n = 2 ** P.dStar;
      // Making a leaf cell's stars costs milliseconds: at most a few new ones a refresh, the rest next time.
      const until = performance.now() + 6; // making a leaf cell's stars costs milliseconds: a few ms of new ones a refresh, the rest next time
      const cellStars = (i, j, k) => (this.leaf.has(`${I.g.key}:${i}:${j}:${k}`) || performance.now() < until ? this.leafStars(I, i, j, k) : []);
      const stars = c.D < 3e18 ? this.starsNear(I, tp, 3, until) : [];
      // ...and the brightest star in each square of a grid in the galaxy's own plane (it turns with the galaxy,
      // so the same cells are reused), so names spread out.
      const across = 2 * c.D * Math.tan(this.gl.fov / 2) * Math.min(this.aspect || 1, 1.6), step = Math.max(leaf, 2 ** Math.round(Math.log2(across / 6 / R)));
      const o = [Math.round(tp[0] / step) * step, Math.round(tp[1] / step) * step, tp[2]];
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
        const q = [o[0] + a * step, o[1] + b * step, o[2]];
        const ci = [0, 1, 2].map((k) => Math.floor((q[k] + P.B) / leaf));
        if (ci.some((v) => v < 0 || v >= n)) continue;
        let best = null;
        let bs = -1;
        for (const s of cellStars(ci[0], ci[1], ci[2])) { const v = RANK[s.sc.cls] + 5 * u01(hash(s.seed, 3)); if (v > bs) { bs = v; best = s; } } // bright ones first, but not only giants
        if (best) stars.push(best);
      }
      for (const s of stars) { const S = this.si(s); if (S.hist.born > this.epoch) continue; out.push({ key: s.key, node: S.node, label: S.name, sub: `${CLASS_NAMES[s.sc.cls]}, ${S.planets.length} planet${S.planets.length === 1 ? '' : 's'}` }); }
    } else if (A.kind === 'star') {
      for (const b of A.info.planets) out.push({ key: b.key, node: b.node, label: b.p.name, sub: KIND_NAMES[b.p.kind] });
    } else if (A.kind === 'planet' || A.kind === 'moon') {
      const b = A.info, P = A.kind === 'moon' ? b.planet : b;
      if (A.kind === 'moon') out.push({ key: P.key, node: P.node, label: P.p.name, sub: KIND_NAMES[P.p.kind] });
      for (const m of P.moons) if (m !== b) out.push({ key: m.key, node: m.node, label: m.p.name, sub: `moon, ${KIND_NAMES[m.p.kind]}` });
    }
    for (const t of out) t.dest = () => this.destFor(t.node);
    return out;
  }

  /** Where a point of node n lands on screen: [x, y, distance] in CSS px and metres, or null behind the eye or off screen. */
  screenOf(n, p = [0, 0, 0]) {
    if (!this.V || !this.gl.w) return null;
    const T = rel(n, this.cam.anchor), q = add(T.t, mulv(T.R, p)), d = sub(q, this.eye), v = mulv(this.V, d);
    if (v[2] >= 0) return null;
    const ty = Math.tan(this.gl.fov / 2), w = this.gl.w, h = this.gl.h;
    const x = ((v[0] / -v[2] / (ty * (w / h))) + 1) * 0.5 * w, y = (1 - v[1] / -v[2] / ty) * 0.5 * h;
    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) return null;
    return [x, y, len(d)];
  }

  /** Click: fly to what's there. */
  /** What a click at (x, y) selects: { label, dest } (dest: where Go takes you; its node and point are what gets the brackets), or null. */
  select(x, y) {
    const h = this.pick(x, y, false);
    if (!h?.go) return null;
    const dest = h.go();
    return dest ? { label: h.label, dest } : null;
  }

  /** A selection from a node (a marker). */
  selectNode(n, label) {
    if (n.kind === 'aplanet') return { label: `${n.info.p.name} · in the atlas`, dest: { node: n, p: [0, 0, 0], D: this.cam.D * 0.5, atlas: n.info.p } };
    if (n.kind === 'aend') return { label: `Towards ${label}`, dest: { node: this.atlasRoot, p: n.pos.slice(), D: this.cam.D } };
    const dest = this.destFor(n);
    return dest ? { label: label || this.label(n), dest } : null;
  }

  // ------------------------------------------------------------ addresses

  /**
   * Where the camera is, as a path anyone can follow: each level by how it
   * is regenerated (a web cell and index, a leaf cell and index, a planet's
   * number, a 1 m spot, a grain's cell), then the camera in that frame.
   */
  address(n = this.cam.anchor) {
    const segs = [];
    for (let m = n; m; m = m.parent) {
      const I = m.info;
      if (m.kind === 'galaxy') segs.unshift(`g${I.g.cell.join(',')},${I.g.n}`);
      else if (m.kind === 'star') segs.unshift(`s${I.s.cell.join(',')},${I.s.n}`);
      else if (m.kind === 'planet') segs.unshift(`p${I.p.i}`);
      else if (m.kind === 'moon') segs.unshift(`m${I.p.i}`);
      else if (m.kind === 'micro') segs.unshift(`u${m.addr.join(',')}`);
      else if (m.kind === 'grain') segs.unshift(`r${I.g.addr.join(',')}`);
    }
    return segs.join('/');
  }

  /** The node at an address: { node (as deep as it resolves), full (all of it did) }. */
  nodeAt(path) {
    let n = this.root, gI = null, S = null, b = null, M = null;
    const segs = path.split('/').filter(Boolean);
    for (const seg of segs) {
      const k = seg[0], v = seg.slice(1).split(',').map(Number);
      let next = null;
      if (k === 'g') { const g = this.web.galaxies(v[0], v[1], v[2])[v[3]]; if (g) { gI = this.gi(g); next = gI.node; } }
      else if (k === 's' && gI) { const st = this.leafStars(gI, v[0], v[1], v[2])[v[3]]; if (st) { S = this.si(st); next = S.node; } }
      else if (k === 'p' && S) { b = S.planets[v[0]]; next = b?.node; }
      else if (k === 'm' && b) { b = b.moons[v[0]]; next = b?.node; }
      else if (k === 'u' && b) { const q = SPOT / (b.W.R * 0.7853981634); M = this.spot(b, dirOf(v[0], -1 + (v[1] + 0.5) * q, -1 + (v[2] + 0.5) * q)); next = M; }
      else if (k === 'r' && M) {
        const t = grainTile(M.seed, Math.floor(v[0] / GT), Math.floor(v[1] / GT), M.surfZ, M.body.W.minerals);
        const g = t.grains.find((x) => x.addr[0] === v[0] && x.addr[1] === v[1] && x.addr[2] === v[2]);
        if (g) next = this.grain(M, g).node;
      }
      if (!next) return { node: n, full: false };
      n = next;
    }
    return { node: n, full: true };
  }

  /** The camera as a string: address @ target ; distance ; direction ; up. */
  location() {
    const c = this.cam;
    return `${this.address()}@${c.t.map((v) => v.toPrecision(16)).join(',')};${c.D.toPrecision(7)};${c.dir.map((v) => v.toFixed(5)).join(',')};${c.up.map((v) => v.toFixed(5)).join(',')}`;
  }

  /** Put the camera where location() said. */
  goLocation(str) {
    const [path, cam] = str.split('@'), { node, full } = this.nodeAt(path || '');
    if (!full || !cam) { const d = this.destFor(node); if (d) this.fly(d); return false; }
    const [t, D, dir, up] = cam.split(';'), c = this.cam;
    c.anchor = node; c.t = t.split(',').map(Number); c.D = +D; c.dir = norm(dir.split(',').map(Number)); c.up = norm(up.split(',').map(Number));
    this.flight = null;
    return true;
  }

  // ------------------------------------------------------------ blocks people leave

  /** marks: [{ id, at (address), p (m, in that place's frame), col, note, mine }]. */
  setMarks(list) {
    for (const m of this.marks) if (m.node) m.node.parent = null;
    this.marks = list.map((m) => ({ ...m, node: undefined }));
  }

  drawMarks() {
    for (const m of this.marks) {
      if (m.node === undefined) { const r = this.nodeAt(m.at); m.node = r.full ? new Node(r.node, 'mark', `mark${m.id}`, m.p) : null; }
      if (!m.node) continue;
      const E = this.store.need(`markcube${m.col}`, 0, () => { const I = new Inst(1); I.push(0, 0, 0, 1, m.col, 1, 1, 0.5); return { data: I.done(), n: 1 }; });
      this.add(E, m.node, 1, 1, { minPx: 7, glow: true }); // a 1 m block, never less than a few pixels: a beacon from anywhere
      this.picks.push({ node: m.node, unit: 1, list: [{ x: 0, y: 0, z: 0, m }], count: 1, kind: 'mark' });
    }
  }

  /** Leave (or move) your block at what you're looking at. */
  placeMark(col, note) {
    if (this.atlasOn) return null;
    return { id: `${Date.now().toString(36)}`, at: this.address(), p: this.cam.t.slice(), col, note: String(note || '').slice(0, 60), mine: true };
  }

  // ------------------------------------------------------------ the atlas of possible worlds

  /** The world at an atlas grid point (kept while in view). */
  atlasBody(px, py, pz) {
    const key = `a${Math.round(px * FINE)},${Math.round(py * FINE)},${Math.round(pz * FINE)}`;
    let b = this.atlasBodies.get(key);
    if (b) return b;
    const p = worldAt(px, py, pz), n = new Node(this.atlasRoot, 'aplanet', key, [px * UNIT, py * UNIT, pz * UNIT]);
    b = new Body(n, worldFor(p));
    b.p = p; n.info = b;
    if (this.atlasBodies.size > 3000) this.atlasBodies.clear();
    this.atlasBodies.set(key, b);
    return b;
  }

  /** Where a real world sits in the atlas: [warmth, size, age]. */
  paramsOf(b) { return [-Math.log2(b.p.x || 1), Math.log2(b.p.R / 6.371e6), Math.log2(b.star ? b.star.hist.age : 4.6)]; }

  atlasEnter() {
    if (this.atlasOn) return;
    const c = this.cam, pm = this.find('moon') || this.find('planet');
    this.atlasBack = { anchor: c.anchor, t: c.t.slice(), D: c.D, dir: c.dir.slice(), up: c.up.slice() };
    const at = pm ? this.paramsOf(pm.info) : [0, 0, 1.5];
    this.atlasOn = true; this.flight = null;
    c.anchor = this.atlasRoot; c.t = at.map((v, k) => clamp(v, AXES[k].min, AXES[k].max) * UNIT); c.D = UNIT * 0.7; c.dir = norm([0.45, 0.3, 0.85]); c.up = [0, 1, 0];
    this.atlasHere = pm ? pm.info.p.name : null;
  }

  atlasExit() {
    if (!this.atlasOn) return;
    const B = this.atlasBack, c = this.cam;
    this.atlasOn = false; this.flight = null;
    Object.assign(c, { anchor: B.anchor, t: B.t, D: B.D, dir: B.dir, up: B.up });
  }

  atlasDraw(budget) {
    const c = this.cam, D = c.D, tp = scale(c.t, 1 / UNIT);
    const sc = clamp((D / UNIT) * 0.12, 1 / FINE, 1), sp = 2 ** Math.round(Math.log2(sc)), span = 3; // grid spacing: power of two, so coarse points stay as it refines; the whole lattice sits in front of the eye
    const r = sp * UNIT * 0.2, light = norm(mulv(this.V, [0.45, 0.6, 0.66])), o = tp.map((v) => Math.round(v / sp) * sp);
    let used = 0;
    for (let a = -span; a <= span; a++) for (let b2 = -span; b2 <= span; b2++) for (let k = -span; k <= span; k++) {
      const q = [o[0] + a * sp, o[1] + b2 * sp, o[2] + k * sp];
      if (q.some((v, i) => v < AXES[i].min - 1e-9 || v > AXES[i].max + 1e-9)) continue;
      const pos = scale(q, UNIT), dist = len(sub(pos, c.t));
      const fade = (1 - smooth(span * sp * UNIT * 0.75, span * sp * UNIT * 1.05, dist)) * smooth(r * 3, r * 8, len(sub(pos, this.eye))); // the edge of the lattice, and anything right by the eye
      if (fade <= 0.01 || used > budget) continue;
      const bd = this.atlasBody(q[0], q[1], q[2]);
      if (!this.inView(bd.node, [0, 0, 0], r * 1.6)) continue;
      const E = this.store.need(`ab${bd.node.key}`, dist / UNIT, () => ballMesh(bd));
      this.picks.push({ node: bd.node, unit: 1, list: [{ x: 0, y: 0, z: 0, b: bd }], count: 1, kind: 'atlas' });
      if (!E) continue;
      this.add(E, bd.node, r * (bd.p.kind === 'gas' || bd.p.kind === 'icegiant' ? 1.25 : 1), E.n, { fade, sun: light, ctr: this.frame(bd.node).o, glow: bd.W.glow });
      used += E.n;
      if (bd.W.rings) { const RE = this.store.need(`ring${bd.key}`, 2, () => ringMesh(bd.W, 3000)); this.add(RE, bd.node, r * 1.25, 3000, { fade, sun: light, minPx: 1, maxPx: 3 }); }
    }
    // Dotted axes through where you are, so you can tell which way is hotter, bigger, older.
    if (!this.atlasAxes) this.atlasAxes = new Node(this.atlasRoot, 'aaxes', 'aaxes', [0, 0, 0]);
    this.atlasAxes.pos = c.t.slice();
    const AE = this.store.need('aaxes', 0, () => { const I = new Inst(3 * 241); for (let ax = 0; ax < 3; ax++) for (let i = -120; i <= 120; i++) { const v = [0, 0, 0]; v[ax] = i / 40; I.push(v[0], v[1], v[2], -1.5, [1, 4, 6][ax], 0.6, 1, 0.5); } return { data: I.done(), n: I.n }; });
    this.add(AE, this.atlasAxes, sp * UNIT, 3 * 241, { glow: true });
  }

  /** Atlas labels: the axes' ends, and the worlds round you. */
  atlasTargets() {
    const out = [], c = this.cam, D = c.D, sc = clamp((D / UNIT) * 0.12, 1 / FINE, 1), sp = 2 ** Math.round(Math.log2(sc));
    if (!this.atlasEnds) this.atlasEnds = AXES.flatMap((A, k) => [-1, 1].map((sgn) => ({ k, sgn, node: new Node(this.atlasRoot, 'aend', `aend${k}${sgn}`, [0, 0, 0]), label: sgn > 0 ? `${A.hi} →` : `← ${A.lo}` })));
    for (const e of this.atlasEnds) { const v = c.t.slice(); v[e.k] += e.sgn * sp * UNIT * 2.6; e.node.pos = v; out.push({ key: e.node.key, node: e.node, label: e.label, sub: AXES[e.k].name }); }
    const near = [...this.atlasBodies.values()].map((b) => [len(sub(b.node.pos, c.t)), b]).filter(([d]) => d < sp * UNIT * 2.2).sort((a, b) => a[0] - b[0]).slice(0, 8);
    for (const [, b] of near) out.push({ key: b.node.key, node: b.node, label: b.p.name.split(',')[0], sub: b.p.name.split(',').slice(1).join(',') });
    for (const t of out) t.dest = () => null;
    return out;
  }

  /** Click straight to travel (double-click). */
  click(x, y) {
    const h = this.pick(x, y, false);
    if (h?.go) this.fly(h.go());
    return h;
  }

  /** Fly (warp) to { node, p, D, dir?, up? } along a zoom-out-and-in path. */
  fly(dest) {
    dest = { ...dest, D: dest.D * this.fit() };
    const c = this.cam, A0 = c.anchor, A1 = dest.node;
    const T10 = rel(A1, A0), T01 = rel(A0, A1);
    const d0 = sub(add(T10.t, mulv(T10.R, dest.p)), c.t), d1 = sub(add(T01.t, mulv(T01.R, c.t)), dest.p);
    const u1 = len(d0), path = flightPath(u1, c.D, dest.D);
    const dirA1 = norm(mulv(T01.R, c.dir)), upA1 = norm(mulv(T01.R, c.up));
    this.flight = {
      A0, A1, p0: c.t.slice(), p1: dest.p, d0, d1, u1, path, t: 0,
      T: clamp(0.9 + 0.11 * path.S, 1.1, 5), R10: T10.R,
      dirA1, upA1, dirEnd: dest.dir ? norm(dest.dir) : dirA1, upEnd: dest.up ? norm(dest.up) : upA1, D1: dest.D,
    };
  }

  stepFlight(dt) {
    const F = this.flight, c = this.cam;
    F.t += dt;
    const x = Math.min(1, F.t / F.T), e = x * x * x * (x * (6 * x - 15) + 10); // smootherstep
    const { u, rem, w } = F.path.at(e * F.path.S);
    const q = smooth(0.15, 0.95, x), dir = nlerp(F.dirA1, F.dirEnd, q), up = nlerp(F.upA1, F.upEnd, q);
    if (F.u1 > 0 && u < rem) {
      c.anchor = F.A0; c.t = add(F.p0, scale(F.d0, u / F.u1)); c.dir = norm(mulv(F.R10, dir)); c.up = norm(mulv(F.R10, up));
    } else {
      c.anchor = F.A1; c.t = add(F.p1, scale(F.d1, F.u1 > 0 ? rem / F.u1 : 0)); c.dir = dir; c.up = up;
    }
    c.D = w;
    this.warp = F.path.S > 8 ? Math.sin(Math.PI * x) : 0;
    if (x >= 1) { this.flight = null; this.warp = 0; c.anchor = F.A1; c.t = F.p1.slice(); c.D = F.D1; }
  }

  /**
   * Why a place is the way it is: from n up through its world, star and
   * galaxy, each a [title, reason]. Every reason is a rule in lineage.js
   * applied to the level above.
   */
  why(n) {
    const out = [], cap = (t) => t[0].toUpperCase() + t.slice(1), ago = (gyr) => fmtAge(gyr);
    for (let m = n; m; m = m.parent) {
      const I = m.info;
      if (m.kind === 'grain') {
        const mn = I.g.mineral;
        out.push([`A grain of ${mn[0]}, ${(I.W.R * 2e3).toFixed(2)} mm`, mn[3] || `${cap(mn[0])} is common in sand.`]);
      } else if (m.kind === 'planet' || m.kind === 'moon' || m.kind === 'aplanet') {
        const p = I.p, h = p.hist, giant = p.kind === 'gas' || p.kind === 'icegiant';
        let t = `${cap(h.why)}. ${h.earths < 1 ? h.earths.toFixed(2) : h.earths.toFixed(1)} Earth masses, ${ago(h.age)} old.`;
        if (!giant) t += h.tectonic ? ' Big and young enough to be hot inside, so its crust is still moving.' : h.volcanic ? ' Still hot enough inside for volcanoes.' : ' Its inside has cooled: the crust is still.';
        const top = h.minerals.slice().sort((a, b) => b.w - a.w).slice(0, 3).map((x) => `${x.name} ${Math.round(x.w * 100)}%`).join(', ');
        if (!giant) t += ` Its sand: ${top}.`;
        out.push([m.kind === 'aplanet' ? cap(p.name) : `${p.name} · ${m.kind === 'moon' ? 'moon, ' : ''}${KIND_NAMES[p.kind]}`, t]);
      } else if (m.kind === 'star') {
        const h = I.hist, cls = I.s.sc.cls, gn = I.gI.name.split(' ')[0];
        let t = `Born ${ago(h.age)} ago in ${h.where} of ${gn}, from gas with metals ${fmtZ(h.Z)}: `;
        t += h.Z > 0.05 ? 'enriched by the supernovae of the stars before it.' : h.age > 9 ? 'it formed early, before much of that had happened.' : 'the gas out there was never much enriched.';
        t += { B: ` So heavy it burns out in ${ago(LIFE.B)}; it has ${ago(Math.max(0.001, LIFE.B - h.age))} left.`, A: ` It will shine for ${ago(LIFE.A)} in all; ${ago(Math.max(0.01, LIFE.A - h.age))} to go.`, D: ' A white dwarf: the cooling core of a star that has died.', R: ' A red giant: an old star swelling at the end of its life.', M: ' Red dwarfs burn so slowly that not one has died yet.' }[cls] || '';
        if (I.planets.length) t += h.Z > 0.1 ? ' Metal-rich gas built big planet cores quickly.' : h.Z < -0.4 ? ' Metal-poor gas made few planets.' : '';
        out.push([`${I.name} · ${CLASS_NAMES[cls]}`, t]);
      } else if (m.kind === 'galaxy') {
        const h = galaxyHistory(I.g);
        out.push([`${I.name} · ${{ S: 'spiral', E: 'elliptical', I: 'irregular' }[I.g.type]} galaxy`, `Formed ${h.formed.toFixed(1)} billion years after the Big Bang (${ago(h.age)} ago), ${{ cluster: 'in a cluster', filament: 'on a filament', field: 'out in the field' }[I.g.env]}: ${h.why}. Its gas has metals ${fmtZ(h.Z0)} in the middle.`]);
      } else if (m.kind === 'root') {
        out.push(['The cosmic web', 'Galaxies gather where matter collapsed into threads and knots: clusters where threads meet, voids between.']);
      }
    }
    return out;
  }

  /** On a tall, narrow screen, stand further back so what you flew to fits across. */
  fit() { const a = this.gl.w && this.gl.h ? this.gl.w / this.gl.h : innerWidth / innerHeight; return Number.isFinite(a) && a > 0 ? Math.max(1, 0.85 / a) : 1; } // a page not laid out yet has no size: don't divide by it

  /** Up a level: fly out to the parent of where you are. */
  up() {
    const A = this.cam.anchor;
    if (A === this.root) this.fly({ node: this.root, p: this.cam.t, D: Math.min(D_MAX, this.cam.D * 20) });
    else this.flyToLevel(A.parent);
  }

  /** Fly out to one of the places the camera is in. */
  flyToLevel(P) {
    const b = this.bodyOf(P), A = this.cam.anchor;
    const D = P.kind === 'root' ? Math.max(this.cam.D * 30, 3e23) : P.kind === 'galaxy' ? P.extent * 2.2 : P.kind === 'star' ? P.extent * 1.1 : b ? b.W.R * (b.W.rings ? 5 : 3.2) : P.kind === 'micro' ? 0.05 : P.extent * 10;
    const T = rel(A, this.root);
    this.fly({ node: P, p: P.kind === 'root' ? add(T.t, mulv(T.R, this.cam.t)) : [0, 0, 0], D });
  }

  label(n) {
    const I = n.info;
    switch (n.kind) {
      case 'root': return 'The cosmic web';
      case 'atlas': return 'Atlas of possible worlds';
      case 'galaxy': return `${I.name} · ${{ S: 'spiral', E: 'elliptical', I: 'irregular' }[I.g.type]} galaxy`;
      case 'star': return `${I.name} · ${CLASS_NAMES[I.s.sc.cls]}, ${I.planets.length} planet${I.planets.length === 1 ? '' : 's'}`;
      case 'planet': case 'moon': return `${I.p.name} · ${n.kind === 'moon' ? 'moon, ' : ''}${KIND_NAMES[I.p.kind]}${I.p.rings ? ', rings' : ''}${I.p.moons.length ? `, ${I.p.moons.length} moon${I.p.moons.length > 1 ? 's' : ''}` : ''}`;
      case 'micro': { const d = norm(n.pos), lat = Math.asin(d[2]) * 57.2958, lon = Math.atan2(d[1], d[0]) * 57.2958; return `Ground · ${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`; }
      case 'grain': return `Grain of ${I.W.mineral[0]} · ${(I.W.R * 2e3).toFixed(2)} mm`;
      default: return n.kind;
    }
  }

  // ------------------------------------------------------------ home

  /** A first place to stand: a spiral galaxy near the origin, a star in its disc with a planet worth seeing. */
  home() {
    let g0 = null;
    for (let r = 0; r < 6 && !g0; r++) {
      for (let i = -r; i <= r && !g0; i++) for (let j = -r; j <= r && !g0; j++) for (let k = -r; k <= r && !g0; k++) {
        for (const g of this.web.galaxies(i, j, k)) if (g.type === 'S' && g.R > 5e19) { g0 = g; break; }
      }
    }
    const I = this.gi(g0);
    let pick = null;
    const R = rng(this.seed ^ 0x40e);
    for (let tries = 0; tries < 60 && !pick; tries++) {
      const r = 1.6 + 1.6 * R(), th = R() * 6.283;
      const s = this.nearestStar(I, [r * Math.cos(th), r * Math.sin(th), 0]);
      if (!s) continue;
      const S = this.si(s);
      const b = S.planets.find((p) => p.p.rings) || S.planets.find((p) => p.p.kind === 'ocean' && p.p.moons.length);
      if (b) pick = b;
    }
    pick = pick || this.si(this.nearestStar(I, [2, 0, 0])).planets[0];
    return pick;
  }

  goHome(instant = true) {
    const b = this.home();
    const dest = { node: b.node, p: [0, 0, 0], D: b.W.R * (b.W.rings ? 5 : 3.2), dir: this.niceDir(b), up: [0, 0, 1] };
    if (instant) { const c = this.cam; c.anchor = dest.node; c.t = [0, 0, 0]; c.D = dest.D * this.fit(); c.dir = dest.dir; c.up = [0, 0, 1]; this.flight = null; } else this.fly(dest);
    return b;
  }
}

const RANK = { B: 7, A: 6, R: 5, F: 4, G: 3, K: 2, M: 1, D: 0 };
const NEAR27 = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) NEAR27.push([a, b, c]);
NEAR27.sort((x, y) => Math.abs(x[0]) + Math.abs(x[1]) + Math.abs(x[2]) - (Math.abs(y[0]) + Math.abs(y[1]) + Math.abs(y[2])));

/** Columns a patch side at quadtree level L: fewer deep down, where there are many levels in view at once. */
const gridAt = (L) => (L < 8 ? G : 16);

const SKY = [[0.6, 0.6, 0.62], [1, 0.58, 0.16], [1, 0.86, 0.2], [0.3, 0.8, 0.95], [0.2, 0.8, 0.95]];

/** A dotted circle of n points, in units of its radius, tipped by inc. */
function ring(n, inc) {
  const I = new Inst(n), ci = Math.cos(inc), s = Math.sin(inc);
  for (let i = 0; i < n; i++) { const t = (i / n) * 6.2832; I.push(Math.cos(t), Math.sin(t) * ci, Math.sin(t) * s, -1, 0, 0.35, 1, (i * 0.618) % 1); }
  return { data: I.done(), n };
}
