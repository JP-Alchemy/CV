import { STRIDE, FIXED, FLAT, MOSAIC } from './renderer.js';

// Keep in sync with the vertex shader.
export const SHRINK = 0.24;
const SA = 0.3;
const SB = 0.7;

export function ease(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const cur = { x: 0, y: 0, w: 0, h: 0, tone: 0, p: 1 };

/** CPU mirror of the vertex shader (without rotation) — where a block is now. */
export function evalInst(a, o, t, out = cur) {
  const dur = a[o + 13];
  let p = dur > 0 ? (t - a[o + 12]) / dur : 1;
  p = p < 0 ? 0 : p > 1 ? 1 : p;
  const fl = a[o + 19];
  const fw = a[o + 2], fh = a[o + 3], tw = a[o + 6], th = a[o + 7];
  const c0x = a[o] + fw / 2, c0y = a[o + 1] + fh / 2;
  const c1x = a[o + 4] + tw / 2, c1y = a[o + 5] + th / 2;
  let cx, cy, w, h, tone;
  if (fl & MOSAIC) {
    const Ax = a[o + 8], Ay = a[o + 9], Bx = a[o + 10], By = a[o + 11], As = a[o + 20], Bs = a[o + 21];
    if (p < SA) {
      const q = ease(p / SA);
      cx = lerp(c0x, Ax, q); cy = lerp(c0y, Ay, q); w = lerp(fw, As, q); h = lerp(fh, As, q);
    } else if (p < SB) {
      const q = (p - SA) / (SB - SA), e = ease(q), b = Math.sin(Math.PI * q);
      const dx = Bx - Ax, dy = By - Ay, k = b * a[o + 14];
      cx = Ax + dx * e - dy * k; cy = Ay + dy * e + dx * k;
      w = h = lerp(As, Bs, e) * (1 - b * SHRINK * 0.5);
    } else {
      const q = ease((p - SB) / (1 - SB));
      cx = lerp(Bx, c1x, q); cy = lerp(By, c1y, q); w = lerp(Bs, tw, q); h = lerp(Bs, th, q);
    }
    tone = lerp(a[o + 16], a[o + 17], smoothstep(SA, SB, p));
  } else {
    const e = ease(p), b = Math.sin(Math.PI * p);
    const dx = c1x - c0x, dy = c1y - c0y, k = b * a[o + 14];
    cx = c0x + dx * e - dy * k; cy = c0y + dy * e + dx * k;
    const s = 1 - b * (fl & FLAT ? 0 : SHRINK);
    w = lerp(fw, tw, e) * s; h = lerp(fh, th, e) * s;
    tone = lerp(a[o + 16], a[o + 17], e);
  }
  out.x = cx - w / 2; out.y = cy - h / 2; out.w = w; out.h = h; out.tone = tone; out.p = p;
  return out;
}

// Motion profiles: duration range, wave delay, random jitter, arc and tumble.
export const PROFILES = {
  page: { dur: [0.85, 1.1], wave: 0.4, jitter: 0.14, arc: 0.14, tumble: 0.9 },
  intro: { dur: [1.0, 1.4], wave: 0.55, jitter: 0.3, arc: 0.2, tumble: 1.2 },
  shared: { dur: [0.7, 0.9], wave: 0, jitter: 0.08, arc: 0.06, tumble: 0.35 },
  local: { dur: [0.4, 0.62], wave: 0, jitter: 0.14, arc: 0.16, tumble: 0.8 },
  move: { dur: [0.45, 0.65], wave: 0, jitter: 0.06, arc: 0.04, tumble: 0.2 },
  hover: { dur: [0.2, 0.34], wave: 0, jitter: 0.12, arc: 0.08, tumble: 0.55 },
  icon: { dur: [0.3, 0.48], wave: 0, jitter: 0.12, arc: 0.18, tumble: 0.9 },
  grow: { dur: [0.22, 0.4], wave: 0, jitter: 0.28, arc: 0, tumble: 0.7 },
};

const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = () => (Math.random() < 0.5 ? -1 : 1);

function hilbert(x, y) {
  const n = 1024;
  let d = 0;
  for (let s = n >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) { x = n - 1 - x; y = n - 1 - y; }
      const t = x; x = y; y = t;
    }
  }
  return d;
}

/** Indices of points sorted along a Hilbert curve over a shared box. */
function hilbertOrder(cx, cy, count, box) {
  const keys = new Float64Array(count);
  const s = 1023 / Math.max(1, box.x1 - box.x0, box.y1 - box.y0);
  for (let i = 0; i < count; i++) {
    const hx = Math.max(0, Math.min(1023, ((cx[i] - box.x0) * s) | 0));
    const hy = Math.max(0, Math.min(1023, ((cy[i] - box.y0) * s) | 0));
    keys[i] = hilbert(hx, hy) * 1048576 + i;
  }
  keys.sort();
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i++) out[i] = keys[i] % 1048576;
  return out;
}

function boxOf() {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  b.add = (x, y) => { if (x < b.x0) b.x0 = x; if (y < b.y0) b.y0 = y; if (x > b.x1) b.x1 = x; if (y > b.y1) b.y1 = y; };
  return b;
}

export class Engine {
  constructor(renderer) {
    this.r = renderer;
    this.start = performance.now();
    this.els = new Map();
    this.list = [];
    this.dying = new Float32Array(1024 * STRIDE);
    this.dyingCount = 0;
    this.dyingUntil = 0;
    this.buf = new Float32Array(0);
    this.count = 0;
    this.animUntil = 0;
    this.calm = false; // prefers-reduced-motion
    this.slow = Number(new URLSearchParams(location.search).get('slow')) || 1; // debug: slow motion
    this.vw = 1; this.vh = 1;
    this.cell = 16; // mosaic grid (matches the background dot grid)
    this.gridX = 0;
  }

  now() { return (performance.now() - this.start) / 1000 / this.slow; }

  /** Write one instance. Pass cells [Ax, Ay, As, Bx, By, Bs] for a mosaic path. */
  w(a, o, fx, fy, fw, fh, ft, tx, ty, tw, th, tt, t0, dur, arc, tumble, z, flags, cells) {
    if (this.calm) { t0 = dur > 0 ? this.now() : t0; dur = Math.min(dur, 0.16); arc = 0; tumble = 0; cells = null; }
    a[o] = fx; a[o + 1] = fy; a[o + 2] = fw; a[o + 3] = fh;
    a[o + 4] = tx; a[o + 5] = ty; a[o + 6] = tw; a[o + 7] = th;
    a[o + 12] = t0; a[o + 13] = dur; a[o + 14] = arc; a[o + 15] = tumble;
    a[o + 16] = ft; a[o + 17] = tt; a[o + 18] = z;
    if (cells) {
      a[o + 8] = cells[0]; a[o + 9] = cells[1]; a[o + 20] = cells[2];
      a[o + 10] = cells[3]; a[o + 11] = cells[4]; a[o + 21] = cells[5];
      a[o + 19] = flags | MOSAIC;
    } else {
      a[o + 8] = a[o + 9] = a[o + 10] = a[o + 11] = a[o + 20] = a[o + 21] = 0;
      a[o + 19] = flags & ~MOSAIC;
    }
    if (t0 + dur > this.animUntil) this.animUntil = t0 + dur;
  }

  pushDying(fx, fy, fw, fh, ft, tx, ty, tw, th, tt, t0, dur, arc, tumble, z, flags, cells) {
    if ((this.dyingCount + 1) * STRIDE > this.dying.length) {
      const next = new Float32Array(this.dying.length * 2);
      next.set(this.dying);
      this.dying = next;
    }
    const o = this.dyingCount++ * STRIDE;
    this.w(this.dying, o, fx, fy, fw, fh, ft, tx, ty, tw, th, tt, t0, dur, arc, tumble, z, flags, cells);
    const end = this.dying[o + 12] + this.dying[o + 13];
    if (end > this.dyingUntil) this.dyingUntil = end;
  }

  flagsOf(E) { return (E.fixed ? FIXED : 0) | (E.flat ? FLAT : 0); }

  /** Absolute target blocks for a scene element (icons pick their current frame). */
  targets(E, anim) {
    if (!anim) return E.blocks;
    const f = anim.frames[anim.k];
    const out = new Float32Array(f.length);
    for (let i = 0; i < f.length; i += 5) {
      out[i] = f[i] + E.x; out[i + 1] = f[i + 1] + E.y;
      out[i + 2] = f[i + 2]; out[i + 3] = f[i + 3]; out[i + 4] = f[i + 4];
    }
    return out;
  }

  /**
   * Morph whatever is on screen into `scene`.
   * o.mode: 'page' | 'local' | 'resize' | 'intro'
   * o.scrollFrom / o.scrollTo: scroll before/after (page changes jump scroll)
   * o.origin: [x, y] screen point the page wave starts from
   */
  morphTo(scene, o = {}) {
    const t = this.now();
    const mode = o.mode || 'local';
    const shift = (o.scrollTo ?? 0) - (o.scrollFrom ?? 0);
    const top = o.scrollTo ?? 0;
    const margin = 160;
    const vis0 = top - margin, vis1 = top + this.vh + margin;
    const pooled = mode === 'page' || mode === 'intro';
    const next = new Map();
    const list = [];

    const poolOld = []; // flat [x, y, w, h, tone, z, flags]
    const poolNewRec = [];
    const poolNewIdx = [];

    const curArr = (O) => {
      const out = new Float32Array(O.n * 5);
      const dy = O.fixed ? 0 : shift;
      for (let i = 0; i < O.n; i++) {
        const c = evalInst(O.inst, i * STRIDE, t);
        out[i * 5] = c.x; out[i * 5 + 1] = c.y + dy; out[i * 5 + 2] = c.w; out[i * 5 + 3] = c.h; out[i * 5 + 4] = c.tone;
      }
      return out;
    };

    for (const E of scene.elements) {
      const O = this.els.get(E.key);
      const flags = this.flagsOf(E);
      const sameSig = O && O.sig === E.sig && O.fixed === !!E.fixed;
      const anim = E.anim
        ? (sameSig && O.anim ? O.anim : { frames: E.anim.frames, k: 0, next: t + (E.anim.phase ?? rnd(0.6, 2.2)), period: E.anim.period ?? 2.2 })
        : null;
      const T = this.targets(E, anim);
      const n = T.length / 5;
      const rec = {
        key: E.key, sig: E.sig, x: E.x, y: E.y, fixed: !!E.fixed, flat: !!E.flat, z: E.z || 0,
        n, anim, motion: E.motion, match: E.match, inst: null, off: 0, T,
      };

      if (sameSig && O.x === E.x && O.y === E.y && (shift === 0 || E.fixed)) {
        rec.inst = O.inst; // untouched: in-flight motion continues
        rec.hidden = O.hidden; rec.minY = O.minY; rec.maxY = O.maxY;
      } else if (sameSig && O.n === n && O.hidden) {
        rec.inst = new Float32Array(n * STRIDE);
        this.hide(rec);
      } else if (sameSig && O.n === n) {
        // Same shape, new place: slide.
        const C = curArr(O);
        rec.inst = new Float32Array(n * STRIDE);
        const P = PROFILES[mode === 'page' ? 'shared' : 'move'];
        const stagger = mode === 'resize' ? 0.15 : 0.05;
        for (let i = 0; i < n; i++) {
          const b = i * 5;
          const d = Math.min(1, Math.max(0, (T[b + 1] - top) / this.vh));
          this.w(rec.inst, i * STRIDE,
            C[b], C[b + 1], C[b + 2], C[b + 3], C[b + 4],
            T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4],
            t + d * stagger + rnd(0, P.jitter * 0.5), rnd(P.dur[0], P.dur[1]),
            sgn() * rnd(0.2, 1) * P.arc * 0.5, sgn() * rnd(0.2, 1) * P.tumble * 0.5, rec.z, flags);
        }
      } else if (O) {
        const P = PROFILES[E.motion || (mode === 'page' ? 'shared' : 'local')];
        rec.inst = this.localMorph(O, curArr(O), T, n, rec, flags, t, P);
      } else if (pooled && !E.fixed && n && this.offscreen(rec, top)) {
        // Fully outside the viewport: stay hidden until scrolled into view.
        rec.inst = new Float32Array(n * STRIDE);
        this.hide(rec);
      } else {
        rec.inst = new Float32Array(n * STRIDE);
        for (let i = 0; i < n; i++) {
          const b = i * 5;
          const visible = !pooled || E.fixed || (T[b + 1] + T[b + 3] > vis0 && T[b + 1] < vis1);
          if (visible) { poolNewRec.push(rec); poolNewIdx.push(i); continue; }
          this.w(rec.inst, i * STRIDE, T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], 0, 0, 0, 0, rec.z, flags);
        }
      }
      next.set(E.key, rec);
      list.push(rec);
    }

    // Everything that disappeared becomes source material.
    for (const [key, O] of this.els) {
      if (next.has(key)) continue;
      const C = curArr(O);
      const fl = this.flagsOf(O);
      for (let i = 0; i < O.n; i++) {
        const b = i * 5;
        if (pooled && !O.fixed && (C[b + 1] + C[b + 3] < vis0 || C[b + 1] > vis1)) continue;
        if (C[b + 2] < 0.05) continue;
        poolOld.push(C[b], C[b + 1], C[b + 2], C[b + 3], C[b + 4], O.z, fl);
      }
    }
    // Blocks still merging from a previous morph join the pool too.
    for (let i = 0; i < this.dyingCount; i++) {
      const c = evalInst(this.dying, i * STRIDE, t);
      if (c.p >= 1 || c.w < 0.05) continue;
      const fl = this.dying[i * STRIDE + 19] & ~MOSAIC;
      const dy = (fl & FIXED) ? 0 : shift;
      poolOld.push(c.x, c.y + dy, c.w, c.h, c.tone, this.dying[i * STRIDE + 18], fl);
    }
    this.dyingCount = 0;
    this.dyingUntil = 0;

    if (pooled && !this.calm) {
      this.mosaic(poolOld, poolNewRec, poolNewIdx, t, mode, o, top);
    } else if (pooled) {
      // Reduced motion: no travel — old blocks blink out, new ones blink in.
      this.mapPools(poolOld, [], [], t, 'local', o, top);
      this.mapPools([], poolNewRec, poolNewIdx, t, 'local', o, top);
    } else {
      this.mapPools(poolOld, poolNewRec, poolNewIdx, t, mode, o, top);
    }

    this.els = next;
    this.list = list;
    this.pack();
  }

  /** Vertical extent of an element's targets; true if it is fully off screen. */
  offscreen(rec, top) {
    const T = rec.T;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < T.length; i += 5) {
      if (T[i + 1] < y0) y0 = T[i + 1];
      if (T[i + 1] + T[i + 3] > y1) y1 = T[i + 1] + T[i + 3];
    }
    rec.minY = y0; rec.maxY = y1;
    return y1 < top || y0 > top + this.vh;
  }

  hide(rec) {
    const T = rec.T, flags = this.flagsOf(rec);
    if (rec.minY === undefined) this.offscreen(rec, 0);
    for (let i = 0; i < rec.n; i++) {
      const b = i * 5;
      const cx = T[b] + T[b + 2] / 2, cy = T[b + 1] + T[b + 3] / 2;
      this.w(rec.inst, i * STRIDE, cx, cy, 0, 0, T[b + 4], cx, cy, 0, 0, T[b + 4], 0, 0, 0, 0, rec.z, flags);
    }
    rec.hidden = true;
  }

  /**
   * Assemble hidden elements that have scrolled into view: each grid cell pops
   * in as a square, wobbles, then resolves into its blocks.
   */
  reveal(scrollTop) {
    if (this.calm) {
      for (const R of this.list) if (R.hidden) { R.hidden = false; this.settle(R); }
      return false;
    }
    const t = this.now();
    const y0 = scrollTop - 40, y1 = scrollTop + this.vh * 0.94;
    const cs = this.cell, gx0 = this.gridX;
    let any = false;
    for (const R of this.list) {
      if (!R.hidden || R.maxY < y0 || R.minY > y1) continue;
      R.hidden = false;
      any = true;
      const T = R.T, flags = this.flagsOf(R);
      const cells = new Map();
      for (let i = 0; i < R.n; i++) {
        const b = i * 5;
        const gx = Math.floor((T[b] + T[b + 2] / 2 - gx0) / cs), gy = Math.floor((T[b + 1] + T[b + 3] / 2) / cs);
        const k = gx * 100003 + gy;
        let c = cells.get(k);
        if (!c) { c = { x: gx0 + (gx + 0.5) * cs, y: (gy + 0.5) * cs, items: [], area: 0 }; cells.set(k, c); }
        c.items.push(i);
        c.area += T[b + 2] * T[b + 3];
      }
      for (const c of cells.values()) {
        const sz = Math.round((cs * Math.min(1, Math.max(0.4, Math.sqrt(c.area / (cs * cs)) * 1.15))) / 2) * 2;
        const t0 = t + 0.22 * Math.min(1, Math.max(0, (c.y - scrollTop) / this.vh)) + rnd(0, 0.2);
        const dur = rnd(0.55, 0.75), tum = sgn() * rnd(0.2, 0.7);
        for (const i of c.items) {
          const b = i * 5;
          this.w(R.inst, i * STRIDE, c.x, c.y, 0, 0, T[b + 4], T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4],
            t0, dur, 0, tum, R.z, flags, [c.x, c.y, sz, c.x, c.y, sz]);
        }
      }
      this.upload(R);
    }
    return any;
  }

  settle(R) {
    const T = R.T, flags = this.flagsOf(R);
    for (let i = 0; i < R.n; i++) {
      const b = i * 5;
      this.w(R.inst, i * STRIDE, T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], 0, 0, 0, 0, R.z, flags);
    }
    this.upload(R);
  }

  upload(R) {
    if (!R.n) return;
    this.buf.set(R.inst, R.off * STRIDE);
    this.r.updateInstances(R.inst, 0, R.off, R.n);
  }

  localMorph(O, C, T, m, rec, flags, t, P) {
    const n = O.n;
    const inst = new Float32Array(m * STRIDE);
    const z = rec.z;
    const pick = () => [t + rnd(0, P.jitter), rnd(P.dur[0], P.dur[1]), sgn() * rnd(0.3, 1) * P.arc, sgn() * rnd(0.3, 1) * P.tumble];
    if (m === 0) {
      for (let i = 0; i < n; i++) {
        const b = i * 5;
        const [t0, dur, , tum] = pick();
        const cx = C[b] + C[b + 2] / 2, cy = C[b + 1] + C[b + 3] / 2;
        this.pushDying(C[b], C[b + 1], C[b + 2], C[b + 3], C[b + 4], cx, cy, 0, 0, C[b + 4], t0, dur, 0, tum, O.z, this.flagsOf(O));
      }
      return inst;
    }
    if (n === 0) {
      for (let j = 0; j < m; j++) {
        const b = j * 5;
        const [t0, dur, , tum] = pick();
        const cx = T[b] + T[b + 2] / 2, cy = T[b + 1] + T[b + 3] / 2;
        this.w(inst, j * STRIDE, cx, cy, 0, 0, T[b + 4], T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], t0, dur, 0, tum, z, flags);
      }
      return inst;
    }
    // Pair by rank: either in block order (text: glyph i -> glyph i) or along
    // a Hilbert curve over the element (images: each block hops to a neighbour).
    let so = null, sn = null;
    if (rec.match === 'space') {
      const ox = new Float32Array(n), oy = new Float32Array(n);
      const nx = new Float32Array(m), ny = new Float32Array(m);
      const box = boxOf();
      for (let i = 0; i < n; i++) { ox[i] = C[i * 5] + C[i * 5 + 2] / 2; oy[i] = C[i * 5 + 1] + C[i * 5 + 3] / 2; box.add(ox[i], oy[i]); }
      for (let j = 0; j < m; j++) { nx[j] = T[j * 5] + T[j * 5 + 2] / 2; ny[j] = T[j * 5 + 1] + T[j * 5 + 3] / 2; box.add(nx[j], ny[j]); }
      so = hilbertOrder(ox, oy, n, box);
      sn = hilbertOrder(nx, ny, m, box);
    }
    const oi = (r) => (so ? so[r] : r);
    const ni = (r) => (sn ? sn[r] : r);
    const emit = (i, j, survivor) => {
      const a = i * 5, b = j * 5;
      const [t0, dur, arc, tum] = pick();
      if (survivor) this.w(inst, j * STRIDE, C[a], C[a + 1], C[a + 2], C[a + 3], C[a + 4], T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], t0, dur, arc, tum, z, flags);
      else this.pushDying(C[a], C[a + 1], C[a + 2], C[a + 3], C[a + 4], T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], t0, dur, arc, tum, z, flags);
    };
    if (m >= n) {
      for (let r = 0; r < m; r++) emit(oi(Math.floor((r * n) / m)), ni(r), true);
      return inst;
    }
    let last = -1;
    for (let r = 0; r < n; r++) {
      const jr = Math.floor((r * m) / n);
      emit(oi(r), ni(jr), jr !== last);
      last = jr;
    }
    return inst;
  }

  /**
   * Page transitions. Old and new blocks are bucketed into grid cells; cells
   * are paired along a Hilbert curve; every block then travels
   *   own spot -> its cell square -> partner cell square -> target spot
   * with one shared timing per cell pair, so each cell moves as one rigid
   * square: the page pixelates, re-arranges and sharpens again.
   */
  mosaic(old, recs, idx, t, mode, o, top) {
    const cs = this.cell, gx0 = this.gridX;
    const N = old.length / 7, M = recs.length;
    if (M === 0) return this.mapPools(old, recs, idx, t, mode, o, top);
    const P = PROFILES[N === 0 ? 'intro' : 'page'];
    const diag = Math.hypot(this.vw, this.vh);
    const origin = o.origin || [this.vw / 2, this.vh / 2];

    // Bucket into cells, in doc space of the destination scroll position.
    const bucket = (count, get) => {
      const map = new Map();
      const cells = [];
      for (let i = 0; i < count; i++) {
        const [x, y, w, h, fixed] = get(i);
        const cx = x + w / 2, cy = (fixed ? y + top : y) + h / 2;
        const gx = Math.floor((cx - gx0) / cs), gy = Math.floor(cy / cs);
        const k = gx * 100003 + gy;
        let c = map.get(k);
        if (!c) {
          c = { x: gx0 + (gx + 0.5) * cs, y: (gy + 0.5) * cs, items: [], area: 0 };
          map.set(k, c);
          cells.push(c);
        }
        c.items.push(i);
        c.area += w * h;
      }
      for (const c of cells) {
        const s = cs * Math.min(1, Math.max(0.4, Math.sqrt(c.area / (cs * cs)) * 1.15));
        c.s = Math.round(s / 2) * 2;
      }
      return cells;
    };
    const oc = bucket(N, (i) => [old[i * 7], old[i * 7 + 1], old[i * 7 + 2], old[i * 7 + 3], old[i * 7 + 6] & FIXED]);
    const nc = bucket(M, (j) => { const T = recs[j].T, b = idx[j] * 5; return [T[b], T[b + 1], T[b + 2], T[b + 3], recs[j].fixed]; });

    const place = (R, j, from, A, B, g) => {
      const b = idx[j] * 5, T = R.T;
      const ay = R.fixed ? A.y - top : A.y, by = R.fixed ? B.y - top : B.y;
      this.w(R.inst, idx[j] * STRIDE, from[0], from[1], from[2], from[3], from[4],
        T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], g.t0, g.dur, g.arc, g.tum, R.z, this.flagsOf(R),
        [A.x, ay, A.s, B.x, by, B.s]);
    };

    // Intro: invent scattered source squares, one per destination cell.
    if (N === 0) {
      for (const B of nc) {
        const A = {
          x: gx0 + (Math.floor(rnd(-2, (this.vw - gx0) / cs + 2)) + 0.5) * cs,
          y: top + (Math.floor(rnd(-2, this.vh / cs + 2)) + 0.5) * cs,
          s: B.s,
        };
        const g = {
          t0: t + P.wave * Math.min(1, Math.max(0, (B.y - top) / this.vh)) + rnd(0, P.jitter),
          dur: rnd(P.dur[0], P.dur[1]),
          arc: sgn() * rnd(0.2, 1) * P.arc,
          tum: sgn() * rnd(0.3, 1) * P.tumble,
        };
        for (const j of B.items) {
          const R = recs[j];
          const ay = R.fixed ? A.y - top : A.y;
          place(R, j, [A.x, ay, 0, 0, R.T[idx[j] * 5 + 4]], A, B, g);
        }
      }
      return;
    }

    // Pair cells along one Hilbert curve (screen space), proportionally by rank.
    const Nc = oc.length, Mc = nc.length;
    const box = boxOf();
    const ox = new Float32Array(Nc), oy = new Float32Array(Nc);
    const nx = new Float32Array(Mc), ny = new Float32Array(Mc);
    oc.forEach((c, i) => { ox[i] = c.x; oy[i] = c.y - top; box.add(ox[i], oy[i]); });
    nc.forEach((c, j) => { nx[j] = c.x; ny[j] = c.y - top; box.add(nx[j], ny[j]); });
    const so = hilbertOrder(ox, oy, Nc, box);
    const sn = hilbertOrder(nx, ny, Mc, box);
    const primaryA = new Int32Array(Mc).fill(-1);
    const firstB = new Int32Array(Nc).fill(-1);
    const link = (a, b) => { if (primaryA[b] < 0) primaryA[b] = a; if (firstB[a] < 0) firstB[a] = b; };
    if (Mc >= Nc) for (let r = 0; r < Mc; r++) link(so[Math.floor((r * Nc) / Mc)], sn[r]);
    else for (let r = 0; r < Nc; r++) link(so[r], sn[Math.floor((r * Mc) / Nc)]);

    const groups = new Map();
    const group = (a, b) => {
      const k = a * 1048576 + b;
      let g = groups.get(k);
      if (!g) {
        const A = oc[a], B = nc[b];
        const d = Math.hypot(A.x - origin[0], A.y - top - origin[1]) / diag;
        const L = Math.hypot(B.x - A.x, B.y - A.y);
        g = {
          t0: t + P.wave * Math.min(1, d) + rnd(0, P.jitter),
          dur: rnd(P.dur[0], P.dur[1]) + Math.min(0.3, L / 3000),
          arc: sgn() * rnd(0.2, 1) * P.arc,
          tum: sgn() * rnd(0.3, 1) * P.tumble,
        };
        groups.set(k, g);
      }
      return g;
    };

    const used = new Uint8Array(N);
    for (let b = 0; b < Mc; b++) {
      const a = primaryA[b];
      const A = oc[a], B = nc[b], g = group(a, b);
      const nA = A.items.length, nB = B.items.length;
      for (let k = 0; k < nB; k++) {
        const i = A.items[Math.floor((k * nA) / nB)];
        used[i] = 1;
        const j = B.items[k], R = recs[j], s = i * 7;
        let fy = old[s + 1];
        const srcFixed = (old[s + 6] & FIXED) !== 0;
        if (srcFixed && !R.fixed) fy += top;
        if (!srcFixed && R.fixed) fy -= top;
        place(R, j, [old[s], fy, old[s + 2], old[s + 3], old[s + 4]], A, B, g);
      }
    }
    // Leftover source blocks ride along with their cell and vanish into it.
    for (let a = 0; a < Nc; a++) {
      const A = oc[a], b = firstB[a], B = nc[b], g = group(a, b);
      for (const i of A.items) {
        const s = i * 7;
        if (used[i] || old[s + 6] & FIXED) continue;
        this.pushDying(old[s], old[s + 1], old[s + 2], old[s + 3], old[s + 4], B.x, B.y, 0, 0, old[s + 4],
          g.t0, g.dur, g.arc, g.tum, old[s + 5], old[s + 6], [A.x, A.y, A.s, B.x, B.y, B.s]);
      }
    }
  }

  /** Non-page changes: pair leftovers along a Hilbert curve, or grow/shrink in place. */
  mapPools(old, recs, idx, t, mode, o, top) {
    const N = old.length / 7;
    const M = recs.length;
    const P = PROFILES[mode === 'page' || mode === 'intro' ? 'page' : 'grow'];
    const diag = Math.hypot(this.vw, this.vh);
    const origin = o.origin || [this.vw / 2, this.vh / 2];

    if (M === 0) {
      for (let i = 0; i < N; i++) {
        const a = i * 7;
        const cx = old[a] + old[a + 2] / 2, cy = old[a + 1] + old[a + 3] / 2;
        const sy = old[a + 6] & FIXED ? cy : cy - top;
        const delay = P.wave * Math.min(1, Math.hypot(cx - origin[0], sy - origin[1]) / diag);
        this.pushDying(old[a], old[a + 1], old[a + 2], old[a + 3], old[a + 4], cx, cy, 0, 0, old[a + 4],
          t + delay + rnd(0, P.jitter), rnd(P.dur[0], P.dur[1]) * 0.6, 0, sgn() * rnd(0.3, 1) * P.tumble, old[a + 5], old[a + 6]);
      }
      return;
    }

    if (N === 0) {
      for (let j = 0; j < M; j++) {
        const R = recs[j], b = idx[j] * 5, T = R.T;
        const cx = T[b] + T[b + 2] / 2, cy = T[b + 1] + T[b + 3] / 2;
        this.w(R.inst, idx[j] * STRIDE, cx, cy, 0, 0, T[b + 4], T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4],
          t + rnd(0, P.jitter), rnd(P.dur[0], P.dur[1]), 0, sgn() * rnd(0.3, 1) * P.tumble, R.z, this.flagsOf(R));
      }
      return;
    }

    const ox = new Float32Array(N), oy = new Float32Array(N);
    const nx = new Float32Array(M), ny = new Float32Array(M);
    const box = boxOf();
    for (let i = 0; i < N; i++) {
      const a = i * 7;
      ox[i] = old[a] + old[a + 2] / 2;
      oy[i] = old[a + 1] + old[a + 3] / 2 - (old[a + 6] & FIXED ? 0 : top);
      box.add(ox[i], oy[i]);
    }
    for (let j = 0; j < M; j++) {
      const R = recs[j], b = idx[j] * 5, T = R.T;
      nx[j] = T[b] + T[b + 2] / 2;
      ny[j] = T[b + 1] + T[b + 3] / 2 - (R.fixed ? 0 : top);
      box.add(nx[j], ny[j]);
    }
    const so = hilbertOrder(ox, oy, N, box);
    const sn = hilbertOrder(nx, ny, M, box);

    const emit = (i, j, survivor) => {
      const a = i * 7;
      const R = recs[j], b = idx[j] * 5, T = R.T;
      const flags = this.flagsOf(R);
      let fy = old[a + 1];
      const srcFixed = (old[a + 6] & FIXED) !== 0;
      if (srcFixed && !R.fixed) fy += top;
      if (!srcFixed && R.fixed) fy -= top;
      const L = Math.hypot(nx[j] - ox[i], ny[j] - oy[i]);
      const dur = rnd(P.dur[0], P.dur[1]) + Math.min(0.35, L / 2500);
      const d = Math.hypot(ox[i] - origin[0], oy[i] - origin[1]) / diag;
      const t0 = t + P.wave * Math.min(1, d) + rnd(0, P.jitter);
      const arc = sgn() * rnd(0.2, 1) * P.arc;
      const tum = sgn() * rnd(0.3, 1) * P.tumble;
      if (survivor) {
        this.w(R.inst, idx[j] * STRIDE, old[a], fy, old[a + 2], old[a + 3], old[a + 4],
          T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], t0, dur, arc, tum, R.z, flags);
      } else {
        this.pushDying(old[a], fy, old[a + 2], old[a + 3], old[a + 4],
          T[b], T[b + 1], T[b + 2], T[b + 3], T[b + 4], t0, dur, arc, tum, R.z, flags);
      }
    };

    if (M >= N) {
      for (let r = 0; r < M; r++) emit(so[Math.floor((r * N) / M)], sn[r], true);
    } else {
      let last = -1;
      for (let r = 0; r < N; r++) {
        const j = Math.floor((r * M) / N);
        emit(so[r], sn[j], j !== last);
        last = j;
      }
    }
  }

  /** Concatenate every element's instances (+ blocks still merging) and upload. */
  pack() {
    const t = this.now();
    let total = 0;
    for (const R of this.list) total += R.n;
    // Drop finished merges: they sit exactly under their survivor.
    let alive = 0;
    let until = 0;
    for (let i = 0; i < this.dyingCount; i++) {
      const o = i * STRIDE;
      const end = this.dying[o + 12] + this.dying[o + 13];
      if (end > t) {
        if (alive !== i) this.dying.copyWithin(alive * STRIDE, o, o + STRIDE);
        alive++;
        if (end > until) until = end;
      }
    }
    this.dyingCount = alive;
    this.dyingUntil = until;
    total += alive;
    if (this.buf.length < total * STRIDE) this.buf = new Float32Array(Math.ceil(total * 1.25) * STRIDE + 1024);
    let off = 0;
    for (const R of this.list) {
      if (R.n) this.buf.set(R.inst, off * STRIDE);
      R.off = off;
      off += R.n;
    }
    if (alive) this.buf.set(this.dying.subarray(0, alive * STRIDE), off * STRIDE);
    this.count = total;
    this.r.setInstances(this.buf, total);
  }

  /** Advance looping icons. */
  tick(t) {
    for (const R of this.list) {
      const A = R.anim;
      if (!A || this.calm || R.hidden || t < A.next || A.frames.length < 2) continue;
      A.k = (A.k + 1) % A.frames.length;
      A.next = t + A.period * rnd(0.85, 1.25);
      const f = A.frames[A.k];
      R.T = this.targets(R, A);
      const P = PROFILES.icon;
      const flags = this.flagsOf(R);
      for (let i = 0; i < R.n; i++) {
        const c = evalInst(R.inst, i * STRIDE, t);
        const b = i * 5;
        this.w(R.inst, i * STRIDE, c.x, c.y, c.w, c.h, c.tone,
          f[b] + R.x, f[b + 1] + R.y, f[b + 2], f[b + 3], f[b + 4],
          t + rnd(0, P.jitter), rnd(P.dur[0], P.dur[1]), sgn() * rnd(0.3, 1) * P.arc, sgn() * rnd(0.3, 1) * P.tumble, R.z, flags);
      }
      this.upload(R);
    }
    // Garbage-collect merged blocks once they have all landed.
    if (this.dyingCount && t > this.dyingUntil) this.pack();
  }

  /** Make a looping element advance right away (e.g. logo on hover). */
  nudge(key, t = this.now()) {
    const R = this.els.get(key);
    if (R && R.anim) R.anim.next = t;
  }

  /** Earliest time a looping icon wants to move next. */
  nextTick() {
    let t = Infinity;
    if (!this.calm) for (const R of this.list) if (R.anim && !R.hidden && R.anim.frames.length > 1 && R.anim.next < t) t = R.anim.next;
    if (this.dyingCount && this.dyingUntil < t) t = this.dyingUntil + 0.01;
    return t;
  }
}
