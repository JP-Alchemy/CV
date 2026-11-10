// Powers of Ten: the scales drawn in JS, each a small simulation of its own,
// painted into one grid of blocks over the screen (the renderer's FS_ZOOM).
// Everything is laid out in metres about "here", the middle of the screen:
// the CV's screen at the desk, Leiden on the map and the globe, the Earth in
// the solar system, the Sun among the stars and in the galaxy, and a
// bacterium and its proteins on the glass going down. A scale only steps
// while it's on screen.
//
// The page itself, the slime mould and the electron are drawn by their own
// passes (the renderer's camera, FS_SLIME).

import { land } from './world.js';

export const LY = 9.4607e15; // metres
export const KPC = 3.0857e19;
export const AU = 1.496e11;

/** 0 below a, up to 1 by b, 1 to c, down to 0 by d (a < b < c < d, in log10 metres; or the other way about). */
export function ramp(L, a, b, c, d) {
  if (L <= a || L >= d) return 0;
  if (L < b) return (L - a) / (b - a);
  if (L > c) return (d - L) / (d - c);
  return 1;
}

/** A seeded random number generator, so a scale looks the same every visit. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// ---------------------------------------------------------------- the grid

/** The blocks: cols × rows cells, RGBA8 each (size, colour, tone). */
// A grid of blocks, one a cell (buf: size, colour, tone; drawn flat by the 2D
// renderer). In the 3D view a block can also have depth: `deep` holds, a
// cell, how far its front and back are towards you (cells; 0, 0 is a plain
// block one cell deep on the page), and a second block behind or in front of
// it that the 2D renderer never draws: a wall, the ground, or whatever didn't
// fit (its front and back, and in buf's alpha its tone and size, 4 bits each).
export class Grid {
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.buf = new Uint8Array(cols * rows * 4);
    this.deep = new Float32Array(cols * rows * 4);
    const r = rng(7);
    this.hash = Float32Array.from({ length: cols * rows }, r);
  }

  clear() { this.buf.fill(0); this.deep.fill(0); }

  /**
   * A block in cell (i, j): size 0-1 of the cell, colour 0 ink or 1-7 the
   * spectrum, tone 0-1 (ink only); f dissolves it in. The biggest block in a
   * cell wins. z: [front, back] (cells towards you) gives it depth in 3D;
   * two that overlap merge into one, and one that doesn't goes into the
   * cell's second block, if that's free.
   */
  put(i, j, size, colour = 0, tone = 1, f = 1, z = null) {
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return;
    const k = j * this.cols + i;
    if (f < 1 && this.hash[k] >= f) return;
    const o = k * 4, s = Math.round(Math.min(1, size) * 255), b = this.buf, D = this.deep;
    if (!z) {
      if (s <= b[o]) return;
      b[o] = s; b[o + 1] = colour; b[o + 2] = Math.round(tone * 255);
      D[o] = D[o + 1] = 0;
      return;
    }
    let zf = z[0], zb = z[1];
    if (zf - zb < 0.5) { const m = (zf + zb) / 2; zf = m + 0.25; zb = m - 0.25; }
    if (!b[o]) { b[o] = s; b[o + 1] = colour; b[o + 2] = Math.round(tone * 255); D[o] = zf; D[o + 1] = zb; return; }
    const af = D[o] || D[o + 1] ? D[o] : 0, ab = D[o] || D[o + 1] ? D[o + 1] : -1; // a plain block: a cell deep, on the page
    if (zb <= af + 0.5 && zf >= ab - 0.5) { // they overlap: one block
      D[o] = Math.max(af, zf); D[o + 1] = Math.min(ab, zb);
      if (s > b[o]) { b[o] = s; b[o + 1] = colour; b[o + 2] = Math.round(tone * 255); }
      return;
    }
    if (s > b[o]) { // the new one wins; the old one goes behind
      this.second(o, b[o + 2] / 255, b[o] / 255, af, ab);
      b[o] = s; b[o + 1] = colour; b[o + 2] = Math.round(tone * 255); D[o] = zf; D[o + 1] = zb;
    } else this.second(o, tone, size, zf, zb);
  }

  /** The second block in a cell (3D only), unless it has one: a wall, the ground. */
  back(i, j, tone, size, z, f = 1) {
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return;
    const k = j * this.cols + i;
    if (f < 1 && this.hash[k] >= f) return;
    let zf = z[0], zb = z[1];
    if (zf - zb < 0.5) { const m = (zf + zb) / 2; zf = m + 0.25; zb = m - 0.25; }
    this.second(k * 4, tone, size, zf, zb);
  }

  second(o, tone, size, zf, zb) {
    if (this.buf[o + 3]) return;
    this.buf[o + 3] = (Math.round(Math.min(1, tone) * 15) << 4) | Math.max(1, Math.round(Math.min(1, size) * 15));
    this.deep[o + 2] = zf; this.deep[o + 3] = zb;
  }

  /** Lay another grid of the same size over this one: its bigger blocks win, and its second blocks fill in where there are none. */
  merge(G) {
    const a = G.buf, b = this.buf, A = G.deep, B = this.deep;
    for (let k = 0; k < a.length; k += 4) {
      if (a[k] > b[k]) { b[k] = a[k]; b[k + 1] = a[k + 1]; b[k + 2] = a[k + 2]; B[k] = A[k]; B[k + 1] = A[k + 1]; }
      if (a[k + 3] && !b[k + 3]) { b[k + 3] = a[k + 3]; B[k + 2] = A[k + 2]; B[k + 3] = A[k + 3]; }
    }
  }
}

/**
 * Paint something that only changes now and then into a layer of its own,
 * kept until `key` changes, and merge it into the grid each frame (the
 * biggest block in a cell still wins). host keeps the layer.
 */
export function cached(host, key, P, paint) {
  const V = P.V;
  if (key !== host.layerKey || !host.layer || host.layer.cols !== V.cols || host.layer.rows !== V.rows) {
    host.layer ||= new Grid();
    if (host.layer.cols !== V.cols || host.layer.rows !== V.rows) host.layer.resize(V.cols, V.rows);
    host.layer.clear();
    paint(new Pen(host.layer, V));
    host.layerKey = key;
  }
  P.G.merge(host.layer);
}

/**
 * Drawing in metres, for one frame: V = { cx, cy (the middle, px), ppm (px a
 * metre), cell (px), cols, rows }. Every shape takes a style
 * { size, colour, tone, f } and anything at least a cell across is filled.
 */
export class Pen {
  constructor(G, V) { this.G = G; this.V = V; }

  i(x) { return Math.floor((this.V.cx + x * this.V.ppm) / this.V.cell); }
  j(y) { return Math.floor((this.V.cy + y * this.V.ppm) / this.V.cell); }
  /** Metres to cells (fractional). */
  u(x) { return (this.V.cx + x * this.V.ppm) / this.V.cell; }
  v(y) { return (this.V.cy + y * this.V.ppm) / this.V.cell; }
  /** One cell in metres. */
  get m() { return this.V.cell / this.V.ppm; }

  /**
   * Into cell (i, j), in a style. A style's z gives it depth in the 3D view:
   * [front, back] in metres towards you, or a function of where the cell is
   * (x, y, m) that returns them (or null: no block there in 3D).
   */
  put(i, j, st) {
    let z = st.z;
    if (z && this.D3) {
      if (typeof z === 'function') {
        z = z(((i + 0.5) * this.V.cell - this.V.cx) / this.V.ppm, ((j + 0.5) * this.V.cell - this.V.cy) / this.V.ppm);
        if (!z) return;
      }
      const k = this.V.ppm / this.V.cell;
      z = [z[0] * k, z[1] * k];
    } else z = null;
    this.G.put(i, j, st.size ?? 1, st.colour ?? 0, st.tone ?? 1, st.f ?? 1, z);
  }

  /** In 3D only: a wall (a cell's second block) over a rectangle, z [front, back] (m), leaving out `holes` ([x0, y0, x1, y1], m). */
  wall(x0, y0, x1, y1, st, holes = []) {
    if (!this.D3) return;
    const { cols, rows } = this.V, k = this.V.ppm / this.V.cell, z = [st.z[0] * k, st.z[1] * k];
    const i0 = Math.max(0, this.i(x0)), i1 = Math.min(cols - 1, this.i(x1));
    const j0 = Math.max(0, this.j(y0)), j1 = Math.min(rows - 1, this.j(y1));
    const H = holes.map(([a, b, c, d]) => [this.u(a), this.v(b), this.u(c), this.v(d)]);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (H.some(([a, b, c, d]) => i + 0.5 > a && i + 0.5 < c && j + 0.5 > b && j + 0.5 < d)) continue;
        this.G.back(i, j, st.tone ?? 1, st.size ?? 1, z, st.f ?? 1);
      }
    }
  }

  dot(x, y, st) { this.put(this.i(x), this.j(y), st); }

  /**
   * A point in space (metres from "here"; y down, z towards you). In the 3D
   * view (the zoom gives the pen a sink, S) it's drawn where it is, depth
   * and all; flat, it's drawn as dot() would, z dropped.
   */
  dot3(x, y, z, st) {
    if (!this.S) { this.dot(x, y, st); return; }
    const k = this.V.ppm;
    this.S.push(x * k, y * k, z * k, (st.size ?? 1) * this.V.cell, st.colour ?? 0, st.tone ?? 1, st.f ?? 1, 0);
  }

  /**
   * A circle in space: centre c ([x, y, z], m), radius r, in the plane of the
   * unit vectors a and b; a point every `every` cells round. Off the 3D view
   * it falls back to ring() when it lies flat on the screen.
   */
  circle3(c, r, a, b, st, every = 1) {
    if (!this.S && Math.abs(a[2]) < 1e-9 && Math.abs(b[2]) < 1e-9 && Math.abs(a[0] * b[1] - a[1] * b[0]) > 0.999) { this.ring(c[0], c[1], r, st, every); return; }
    const R = (r * this.V.ppm) / this.V.cell;
    if (R < 1) { this.dot3(c[0], c[1], c[2], st); return; }
    const n = Math.min(3000, Math.ceil((2 * Math.PI * R) / every));
    for (let k = 0; k < n; k++) {
      const t = (k / n) * 2 * Math.PI, co = Math.cos(t) * r, si = Math.sin(t) * r;
      this.dot3(c[0] + a[0] * co + b[0] * si, c[1] + a[1] * co + b[1] * si, c[2] + a[2] * co + b[2] * si, st);
    }
  }

  rect(x0, y0, x1, y1, st) {
    const { cols, rows } = this.V;
    const i0 = Math.max(0, this.i(x0)), i1 = Math.min(cols - 1, this.i(x1));
    const j0 = Math.max(0, this.j(y0)), j1 = Math.min(rows - 1, this.j(y1));
    if (i1 < i0 || j1 < j0) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.put(i, j, st);
  }

  /** The edge of a rectangle, a cell thick. */
  frame(x0, y0, x1, y1, st) {
    const m = this.m;
    this.rect(x0, y0, x1, y0 + m * 0.99, st);
    this.rect(x0, y1 - m * 0.99, x1, y1, st);
    this.rect(x0, y0, x0 + m * 0.99, y1, st);
    this.rect(x1 - m * 0.99, y0, x1, y1, st);
  }

  line(x0, y0, x1, y1, st, every = 1) {
    const a = [this.u(x0), this.v(y0)], b = [this.u(x1), this.v(y1)];
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    if (n > 20000) return;
    for (let k = 0; k <= n; k += every) {
      const t = n ? k / n : 0;
      this.put(Math.floor(a[0] + (b[0] - a[0]) * t), Math.floor(a[1] + (b[1] - a[1]) * t), st);
    }
  }

  disc(x, y, r, st) {
    const R = (r * this.V.ppm) / this.V.cell;
    if (R < 0.7) { this.dot(x, y, st); return; }
    const ci = this.u(x), cj = this.v(y);
    const i0 = Math.max(0, Math.floor(ci - R)), i1 = Math.min(this.V.cols - 1, Math.floor(ci + R));
    const j0 = Math.max(0, Math.floor(cj - R)), j1 = Math.min(this.V.rows - 1, Math.floor(cj + R));
    for (let j = j0; j <= j1; j++) {
      const dy = j + 0.5 - cj;
      for (let i = i0; i <= i1; i++) {
        const dx = i + 0.5 - ci;
        if (dx * dx + dy * dy <= R * R) this.put(i, j, st);
      }
    }
  }

  /** A circle's edge: every `every` cells round, up to a few thousand. */
  ring(x, y, r, st, every = 1) {
    const R = (r * this.V.ppm) / this.V.cell;
    if (R < 1) { this.dot(x, y, st); return; }
    const n = Math.min(3000, Math.ceil((2 * Math.PI * R) / every));
    const ci = this.u(x), cj = this.v(y);
    // Skip a ring that's nowhere near the screen.
    if (ci + R < 0 || cj + R < 0 || ci - R > this.V.cols || cj - R > this.V.rows) return;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI;
      this.put(Math.floor(ci + R * Math.cos(a)), Math.floor(cj + R * Math.sin(a)), st);
    }
  }
}

// ---------------------------------------------------------------- the desk

/** In 3D, how far the room's back wall is behind the screen, and how far its open front is in front of it (m). */
export const WALL = -0.45, FRONT = 3.2;

/**
 * My desk, side on, with the CV's screen in the middle (the page itself is
 * drawn by the renderer, shrunk into it). Steam off the coffee rises and
 * curls; the clock tells the time.
 */
export class Desk {
  constructor() {
    this.steam = [];
    this.r = rng(3);
  }

  step(dt, V) {
    const { mug, deskY } = this.geo(V);
    const r = this.r;
    if (this.steam.length < 90 && r() < dt * 40) {
      this.steam.push({ x: mug[0] + (r() - 0.5) * mug[2] * 0.7, y: deskY - mug[3], vx: 0, age: 0, life: 2 + r() * 1.5, seed: r() * 100 });
    }
    for (const p of this.steam) {
      p.age += dt;
      const lift = 0.05 + 0.04 * Math.min(1, p.age); // warm air speeds up as it rises
      p.vx += (Math.sin(p.y * 45 + p.seed + p.age * 1.7) * 0.06 - p.vx * 0.8) * dt;
      p.x += p.vx * dt;
      p.y -= lift * dt;
    }
    this.steam = this.steam.filter((p) => p.age < p.life);
  }

  /** Where everything is, in metres from the middle of the screen (y down). */
  geo(V) {
    const sw = V.screen[0], sh = V.screen[1];
    const phone = V.touch;
    const bez = phone ? 0.005 : 0.012;
    const deskY = phone ? sh / 2 + bez + 0.004 : sh / 2 + bez + 0.13;
    return { sw, sh, bez, deskY, phone, mug: [0.4, 0, 0.08, 0.1] };
  }

  // In the 3D view everything here has its depth (z, metres towards you): the
  // screen is the page's own plane, the desk runs back to the wall behind it
  // and out towards you, the mug is round and the lamp's light a cone.
  paint(P, V, f, t) {
    const { sw, sh, bez, deskY, phone, mug } = this.geo(V);
    const z = (a, b) => [a, b];
    const ink = { f }, grey = { tone: 0.45, f };
    const at = (st, zz) => ({ ...st, z: zz });
    // Round things: a cylinder standing up at x = cx, z = cz, radius r, as the depth of each column of cells.
    const round = (cx, cz, r) => (x) => { const d = r * r - (x - cx) ** 2; return d > 0 ? [cz + Math.sqrt(d), cz - Math.sqrt(d)] : [cz + 0.002, cz - 0.002]; };
    // The desk and the floor. In 3D it goes first, so what stands on it doesn't take its top's colour, and it's softer: its top is a big face.
    const desk = () => {
      P.rect(-0.8, deskY, 0.8, deskY + 0.03, P.D3 ? { tone: 0.62, f, z: z(0.35, WALL) } : ink);
      P.rect(-0.77, deskY + 0.03, -0.74, deskY + 0.75, at(grey, z(0.32, WALL + 0.03)));
      P.rect(0.74, deskY + 0.03, 0.77, deskY + 0.75, at(grey, z(0.32, WALL + 0.03)));
    };
    if (P.D3) desk();
    // The screen's edge, then the monitor (or the phone) round it.
    P.frame(-sw / 2 - bez, -sh / 2 - bez, sw / 2 + bez, sh / 2 + bez, at(ink, z(0, phone ? -0.008 : -0.03)));
    if (P.D3) P.rect(-sw / 2, -sh / 2, sw / 2, sh / 2, { tone: 0.2, z: phone ? z(-0.004, -0.008) : z(-0.02, -0.035), f }); // its back, behind the page
    if (phone) {
      P.rect(-0.01, sh / 2 + bez, 0.01, deskY, at(grey, z(-0.01, -0.05)));
    } else {
      P.rect(-sw / 2 - bez, sh / 2, sw / 2 + bez, sh / 2 + bez, at(grey, z(0, -0.03)));
      P.rect(-0.03, sh / 2 + bez, 0.03, deskY - 0.012, at(grey, z(-0.04, -0.07)));
      P.rect(-0.12, deskY - 0.012, 0.12, deskY, at(ink, z(0.02, -0.16)));
      P.rect(-0.22, deskY - 0.018, 0.22, deskY, at(grey, z(0.24, 0.07))); // keyboard
    }
    if (!P.D3) desk();
    // Coffee.
    const [mx, , mw, mh] = mug, mz = 0.12, cup = round(mx, mz, mw / 2);
    P.frame(mx - mw / 2, deskY - mh, mx + mw / 2, deskY, at(ink, cup));
    if (P.D3) P.rect(mx - mw / 2, deskY - mh * 0.85, mx + mw / 2, deskY, { tone: 0.7, f, z: cup }); // in 3D, it's a cup: solid (and the coffee in it)
    P.ring(mx + mw / 2 + 0.018, deskY - mh / 2, 0.02, at(ink, z(mz + 0.006, mz - 0.006)));
    for (const p of this.steam) {
      const k = 1 - p.age / p.life, pz = mz + Math.sin(p.seed + p.age * 1.3) * 0.025;
      P.dot(p.x, p.y, { size: 0.5, tone: 0.25 + 0.4 * k, f, z: z(pz + 0.004, pz - 0.004) });
    }
    // A lamp, and its light on the desk.
    const lz = -0.24, arm = z(lz + 0.008, lz - 0.008);
    P.rect(-0.62, deskY - 0.015, -0.5, deskY, at(ink, round(-0.56, lz, 0.06)));
    P.line(-0.56, deskY - 0.015, -0.5, deskY - 0.36, at(ink, arm));
    P.line(-0.5, deskY - 0.36, -0.33, deskY - 0.42, at(ink, arm));
    P.rect(-0.36, deskY - 0.43, -0.28, deskY - 0.39, at(ink, round(-0.32, lz, 0.04)));
    for (let k = 0; k < 40; k++) {
      const a = (k * 0.618) % 1, b = (k * 0.382 + 0.1) % 1, c = (k * 0.737) % 1;
      const y = deskY - 0.38 + b * 0.37, x = -0.32 + (a - 0.5) * (0.04 + b * 0.3), dz = lz + (c - 0.5) * (0.04 + b * 0.3);
      P.dot(x, y, { size: 0.25, colour: 3, f: f * 0.8, z: z(dz + 0.003, dz - 0.003) });
    }
    // A plant.
    const pz = -0.25;
    P.frame(-0.79, deskY - 0.08, -0.69, deskY, at(ink, round(-0.74, pz, 0.05)));
    if (P.D3) P.rect(-0.79, deskY - 0.08, -0.69, deskY, { tone: 0.6, f, z: round(-0.74, pz, 0.05) });
    const sway = Math.sin(t * 0.7) * 0.004, y0 = deskY - 0.08;
    for (const [dx, h, dz] of [[-0.03, 0.16, 0.06], [0, 0.22, -0.02], [0.03, 0.14, -0.07], [-0.015, 0.19, -0.05], [0.02, 0.2, 0.05]]) {
      const leaf = (x, y) => { const w = pz + dz * Math.max(0, Math.min(1, (y0 - y) / h)); return [w + 0.004, w - 0.004]; };
      P.line(-0.74, y0, -0.74 + dx * 2 + sway, y0 - h, at(grey, leaf));
    }
    // The clock on the wall, telling the time.
    const cx = sw / 2 + 0.32, cy = -sh / 2 - 0.12, cr = 0.09;
    P.ring(cx, cy, cr, at(ink, z(WALL + 0.04, WALL)));
    const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    const hand = (frac, len, st) => {
      const a = frac * 2 * Math.PI - Math.PI / 2;
      P.line(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, { ...st, z: z(WALL + 0.045, WALL + 0.03) });
    };
    hand(h / 12, cr * 0.5, ink);
    hand(m / 60, cr * 0.8, ink);
    hand(s / 60, cr * 0.85, { size: 0.5, colour: 1, f });
    if (P.D3) P.disc(cx, cy, cr * 0.95, { tone: 0.15, f, z: z(WALL + 0.02, WALL) }); // its face, behind the hands
  }
}

/** Here: a small cross in the middle, while there's nothing else to see. */
export function here(P, f) {
  const c = P.V.cx / P.V.cell, r = P.V.cy / P.V.cell;
  for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) P.G.put(Math.floor(c) + a, Math.floor(r) + b, 1, 1, 1, f);
}

// ---------------------------------------------------------------- the Earth

const LEIDEN = [52.16, 4.49];
const R_EARTH = 6.371e6;

/** Days since 2000-01-01 12:00 UTC. */
export const j2000 = (ms = Date.now()) => (ms - Date.UTC(2000, 0, 1, 12)) / 864e5;

/**
 * The globe, with Leiden in the middle, lit by the Sun from where it is right
 * now (its declination for the day of the year, and the time of day). Every
 * block looks up which country it's over (geo.js, from Natural Earth's
 * outlines, finer the closer you get): coasts are solid ink, borders a block
 * a size smaller, land a dot tone, the Netherlands filled in. Until the
 * outlines arrive it makes do with a coarse map of the land (world.js).
 */
export class Earth {
  /** o: { geo, nlOpen (the slime mould is drawing the Netherlands' inside) } */
  paint(P, V, f, days, o = {}) {
    const R = (R_EARTH * V.ppm) / V.cell;
    const ci = V.cx / V.cell, cj = V.cy / V.cell;
    if (R < 0.7) { P.G.put(Math.floor(ci), Math.floor(cj), 1, 0, 1, f); return; }
    const p0 = (LEIDEN[0] * Math.PI) / 180, l0 = (LEIDEN[1] * Math.PI) / 180;
    const e = [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)];
    const E = [-Math.sin(l0), Math.cos(l0), 0];
    const N = [-Math.sin(p0) * Math.cos(l0), -Math.sin(p0) * Math.sin(l0), Math.cos(p0)];
    // Where the Sun is overhead.
    const n = days, frac = ((n % 1) + 1.5) % 1; // UTC time of day, 0 at midnight
    const dec = (-23.44 * Math.cos((2 * Math.PI * (((n + 10.5) % 365.25) + 365.25)) / 365.25) * Math.PI) / 180;
    const sl = (-(frac - 0.5) * 2 * Math.PI);
    const S = [Math.cos(dec) * Math.cos(sl), Math.cos(dec) * Math.sin(sl), Math.sin(dec)];
    const i0 = Math.max(0, Math.floor(ci - R)), i1 = Math.min(V.cols - 1, Math.floor(ci + R));
    const j0 = Math.max(0, Math.floor(cj - R)), j1 = Math.min(V.rows - 1, Math.floor(cj + R));
    const w = i1 - i0 + 1, h = j1 - j0 + 1;
    if (w <= 0 || h <= 0) return;
    // First which country each block is over (-1 off the globe, 0 the sea), and whether it's day there.
    if (!this.ids || this.ids.length < w * h) { this.ids = new Int16Array(w * h); this.lit = new Uint8Array(w * h); }
    const ids = this.ids, lit = this.lit, D = 180 / Math.PI;
    const G = o.geo?.ready ? o.geo : null;
    // A block's point on the globe: [lat, lon, day].
    const point = (i, j) => {
      const x = (i + 0.5 - ci) / R, y = -(j + 0.5 - cj) / R, q = x * x + y * y;
      if (q > 1) return null;
      const z = Math.sqrt(1 - q);
      const px = x * E[0] + y * N[0] + z * e[0], py = x * E[1] + y * N[1] + z * e[1], pz = x * E[2] + y * N[2] + z * e[2];
      return [Math.asin(pz) * D, Math.atan2(py, px) * D, px * S[0] + py * S[1] + pz * S[2]];
    };
    const set = (k, la, lo, day) => { lit[k] = day > 0 ? 1 : 0; ids[k] = G ? G.at(la, lo) : land(la, lo) ? 1 : 0; };
    // Zoomed in, the screen is a small cap of the globe, where latitude and
    // longitude change smoothly: exact every STEP blocks, in between interpolated.
    const corner = Math.max(Math.abs(i0 - ci), Math.abs(i1 + 1 - ci)) ** 2 + Math.max(Math.abs(j0 - cj), Math.abs(j1 + 1 - cj)) ** 2;
    const STEP = 8;
    if (corner < 0.5 * R * R && R > 8 * STEP) {
      const nw = Math.ceil(w / STEP) + 1, nh = Math.ceil(h / STEP) + 1;
      const NA = new Float64Array(nw * nh), NO = new Float64Array(nw * nh), ND = new Float64Array(nw * nh);
      for (let n = 0; n < nw * nh; n++) {
        const p = point(i0 + (n % nw) * STEP, j0 + Math.floor(n / nw) * STEP);
        NA[n] = p[0]; NO[n] = p[1]; ND[n] = p[2];
      }
      const lut = G ? G.at : null;
      for (let j = j0; j <= j1; j++) {
        const gy = (j - j0) / STEP, ny = Math.min(nh - 2, gy | 0), fy = gy - ny, ey = 1 - fy;
        const row = (j - j0) * w;
        for (let i = i0; i <= i1; i++) {
          const gx = (i - i0) / STEP, nx = Math.min(nw - 2, gx | 0), fx = gx - nx, ex = 1 - fx;
          const a = ny * nw + nx, b = a + 1, c = a + nw, d = c + 1;
          const wa = ex * ey, wb = fx * ey, wc = ex * fy, wd = fx * fy;
          const la = NA[a] * wa + NA[b] * wb + NA[c] * wc + NA[d] * wd;
          const lo = NO[a] * wa + NO[b] * wb + NO[c] * wc + NO[d] * wd;
          const k = row + (i - i0);
          lit[k] = ND[a] * wa + ND[b] * wb + ND[c] * wc + ND[d] * wd > 0 ? 1 : 0;
          ids[k] = lut ? lut.call(G, la, lo) : land(la, lo) ? 1 : 0;
        }
      }
    } else {
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = (j - j0) * w + (i - i0), p = point(i, j);
          if (!p) { ids[k] = -1; continue; }
          set(k, p[0], p[1], p[2]);
        }
      }
    }
    // Then the blocks: an edge wherever a neighbour is over something else.
    const nl = o.geo?.ready ? o.geo.nl : -2;
    const limb = (1 - 1.5 / R) ** 2;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = (j - j0) * w + (i - i0), id = ids[k];
        if (id < 0) continue;
        const day = lit[k] === 1;
        if (id === 0) {
          const x = (i + 0.5 - ci) / R, y = (j + 0.5 - cj) / R;
          if (x * x + y * y > limb) P.G.put(i, j, 0.5, 0, 0.6, f);
          else if (day && ((i + 2 * j) & 3) === 0) P.G.put(i, j, 0.25, 0, 0.4, f);
          continue;
        }
        // The four neighbours (off the edge counts as the same).
        const l = i > i0 ? ids[k - 1] : id, r = i < i1 ? ids[k + 1] : id;
        const u = j > j0 ? ids[k - w] : id, d = j < j1 ? ids[k + w] : id;
        const coast = l === 0 || r === 0 || u === 0 || d === 0;
        const border = (l > 0 && l !== id) || (r > 0 && r !== id) || (u > 0 && u !== id) || (d > 0 && d !== id);
        const t = day ? 1 : 0.6;
        if (coast) P.G.put(i, j, 1, 0, t, f);
        else if (border) P.G.put(i, j, 0.75, 0, t * 0.85, f);
        else if (id === nl) { if (!o.nlOpen) P.G.put(i, j, 1, 0, day ? 1 : 0.85, f); } // filled in, day or night
        else if (day || ((i + j) & 1) === 0) P.G.put(i, j, 0.5, 0, day ? 0.5 : 0.35, f);
      }
    }
  }
}

// ---------------------------------------------------------------- the planets

// a (AU), period (days), mean longitude at J2000 (degrees), radius (m),
// inclination to the ecliptic and longitude of the ascending node (degrees).
const PLANETS = [
  [0.387, 87.969, 252.25, 2.44e6, 7.0, 48.33],
  [0.723, 224.701, 181.98, 6.05e6, 3.39, 76.68],
  [1.0, 365.256, 100.46, R_EARTH, 0, 0],
  [1.524, 686.98, 355.45, 3.39e6, 1.85, 49.56],
  [5.203, 4332.59, 34.4, 6.99e7, 1.3, 100.46],
  [9.537, 10759.2, 49.94, 5.82e7, 2.49, 113.67],
  [19.19, 30688.5, 313.23, 2.54e7, 0.77, 74.0],
  [30.07, 60182, 304.88, 2.46e7, 1.77, 131.78],
];
const MOON = { a: 3.844e8, i: 5.145, r: 1.737e6 };

/**
 * An orbit's plane on screen (x right, y down, z towards you: the ecliptic
 * seen from its north): the unit vectors towards the ascending node and 90°
 * on from it, so a point u along the orbit is a·(P cos u + Q sin u).
 */
function plane(i, node) {
  const I = (i * Math.PI) / 180, O = (node * Math.PI) / 180;
  return [[Math.cos(O), -Math.sin(O), 0], [-Math.sin(O) * Math.cos(I), -Math.cos(O) * Math.cos(I), Math.sin(I)]];
}
const along = (a, [P, Q], u) => [0, 1, 2].map((k) => a * (P[k] * Math.cos(u) + Q[k] * Math.sin(u)));

/** The planets on circles, where they are today, a day a second; the Moon round the Earth. The Earth stays in the middle. */
export class Planets {
  /**
   * Where everything is (metres from the Earth, on screen's axes): { sun,
   * planets: [[x, y, radius], ...] (the Earth left out), moon: [x, y, radius] }.
   */
  where(days) {
    // Mean longitude on a circle in the orbit's own plane (u from the node).
    const pos = PLANETS.map(([a, T, L0, , i, node]) => along(a * AU, plane(i, node), ((L0 - node + (360 * days) / T) * Math.PI) / 180));
    const sun = pos[2].map((v) => -v);
    const mnode = 125.08 - 0.0529538 * days; // the Moon's node slides back round in 18.6 years
    return {
      sun, pos, mnode,
      planets: PLANETS.map(([, , , r], k) => [sun[0] + pos[k][0], sun[1] + pos[k][1], sun[2] + pos[k][2], r, k]).filter((p) => p[4] !== 2),
      moon: [...along(MOON.a, plane(MOON.i, mnode), ((218.316 - mnode + 13.176396 * days) * Math.PI) / 180), MOON.r],
    };
  }

  /** o.bodies === false: only the orbits (the 3D view draws the bodies as solids). */
  paint(P, V, f, days, o = {}) {
    const { sun, pos, mnode } = this.where(days);
    const orbit = { size: 0.25, tone: 0.4, f };
    PLANETS.forEach(([a, , , , i, node], k) => { if (k !== 2) P.circle3(sun, a * AU, ...plane(i, node), orbit, 3); });
    P.circle3(sun, AU, ...plane(0, 0), { size: 0.5, tone: 0.5, f }, 3);
    const moonOrbit = () => P.circle3([0, 0, 0], MOON.a, ...plane(MOON.i, mnode), orbit, 3);
    if (o.bodies === false) { moonOrbit(); return; }
    P.disc(sun[0], sun[1], Math.max(6.96e8, P.m * 1.2), { colour: 3, f });
    PLANETS.forEach(([, , , r], k) => {
      if (k === 2) return;
      P.disc(sun[0] + pos[k][0], sun[1] + pos[k][1], Math.max(r, P.m * 0.5), { f });
    });
    P.disc(0, 0, Math.max(R_EARTH, P.m * 0.5), { f }); // the Earth, in the middle
    moonOrbit();
    const moon = this.where(days).moon;
    P.disc(moon[0], moon[1], Math.max(1.737e6, P.m * 0.5), { f });
  }
}

// ---------------------------------------------------------------- the stars

// The nearest and brightest: galactic longitude (degrees), distance (light
// years), colour (0 white-ish ink, 1-7 the spectrum).
// Their galactic latitudes (degrees), in the same order, for the 3D view:
// Alpha Centauri, Barnard's, Wolf 359, Lalande 21185, Sirius, UV Ceti, Ross
// 154, Ross 248, Epsilon Eridani, Lacaille 9352, Ross 128, Procyon, 61 Cygni,
// Altair, Vega, Arcturus, Aldebaran, Polaris, Betelgeuse, Rigel, Deneb.
// Filled in from memory of the catalogues: right to a degree or two, not checked.
const STARS_B = [-0.7, 14.1, 56.1, 65.4, -8.9, -75.7, -10.3, -16.9, -48.1, -66.0, 59.6, 13.0, -5.8, -8.9, 19.2, 69.1, -20.2, 26.5, -9.0, -25.2, 2.0];
const STARS = [
  [315.7, 4.37, 3], [31.0, 5.96, 1], [244.1, 7.86, 1], [185.1, 8.31, 1], [227.2, 8.6, 6],
  [175.5, 8.73, 1], [11.3, 9.69, 1], [110.0, 10.29, 1], [195.8, 10.47, 2], [5.1, 10.72, 1],
  [270.1, 11.01, 1], [213.7, 11.46, 0], [82.3, 11.4, 2], [47.7, 16.7, 0], [67.4, 25.0, 5],
  [15.1, 36.7, 2], [181.0, 65, 2], [123.3, 433, 3], [199.8, 548, 1], [209.2, 860, 6], [84.3, 2600, 5],
];

/** The nearest stars flattened onto the galaxy's plane (towards its middle is to the right), and some of the many more. */
export class Stars {
  constructor() {
    const r = rng(11), rz = rng(13); // heights from their own stream, so the flat view's stars stay where they were
    this.field = Array.from({ length: 900 }, () => {
      const d = 5 * Math.pow(1000, r()), a = r() * 2 * Math.PI; // as many in each power of ten of distance
      const c = r() < 0.7 ? 0 : [1, 2, 3, 6][Math.floor(r() * 4)];
      // Above or below the plane: all round us close by, a disc about a thousand light years thick further out.
      return [d * Math.cos(a) * LY, -d * Math.sin(a) * LY, c, gauss(rz) * Math.min(d * 0.6, 1000) * LY];
    });
  }

  paint(P, V, f) {
    for (const [x, y, c, z] of this.field) P.dot3(x, y, z, { size: 0.5, colour: c, tone: 0.6, f });
    STARS.forEach(([l, d, c], k) => {
      const a = (l * Math.PI) / 180, b = (STARS_B[k] * Math.PI) / 180;
      const x = d * LY * Math.cos(b) * Math.cos(a), y = -d * LY * Math.cos(b) * Math.sin(a), z = d * LY * Math.sin(b), m = P.m * 0.6;
      if (P.S) { P.dot3(x, y, z, { colour: c, f, size: 1.25 }); return; }
      for (const [dx, dy] of [[0, 0], [m, 0], [0, m], [m, m]]) P.dot(x + dx, y + dy, { colour: c, f });
    });
    const m = P.m * 0.6;
    for (const [dx, dy] of [[0, 0], [m, 0], [0, m], [m, m]]) P.dot(dx, dy, { colour: 3, f }); // the Sun
  }
}

// ---------------------------------------------------------------- the galaxy

const G_KPC = 4.498e-12; // kpc³ / (solar mass · Myr²)
const SUN_R = 8.2; // kpc from the middle
export const GALAXY_N = 500;

/**
 * The Milky Way as N stars pulling on each other (a leapfrog, softened), in a
 * halo of dark matter and round a bulge that are only smooth pulls. A cold
 * disc like this grows spiral arms of its own. Thirty million years a second.
 */
export class Galaxy {
  constructor(n = GALAXY_N) {
    const r = rng(5);
    this.n = n;
    this.mass = 4e10 / n;
    this.x = new Float64Array(n); this.y = new Float64Array(n);
    this.vx = new Float64Array(n); this.vy = new Float64Array(n);
    this.ax = new Float64Array(n); this.ay = new Float64Array(n);
    this.c = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const rad = Math.min(16, 0.4 - 3 * Math.log((r() + 1e-9) * (r() + 1e-9)) * 0.85);
      const a = r() * 2 * Math.PI;
      this.x[i] = rad * Math.cos(a);
      this.y[i] = rad * Math.sin(a);
      this.c[i] = r() < 0.72 ? 0 : [1, 2, 3, 5, 6][Math.floor(r() * 5)];
    }
    // Heights above the disc, for the 3D view (the pull is worked out in the disc's plane): a thin
    // disc a few hundred parsecs thick, puffing up into the bulge in the middle. Their own stream.
    const rz = rng(17);
    this.z = Float64Array.from({ length: n }, (_, i) => {
      const rad = Math.hypot(this.x[i], this.y[i]);
      return gauss(rz) * (0.25 + 0.9 * Math.max(0, 1 - rad / 2.5));
    });
    this.accel();
    for (let i = 0; i < n; i++) {
      const rad = Math.hypot(this.x[i], this.y[i]);
      const ar = -(this.ax[i] * this.x[i] + this.ay[i] * this.y[i]) / rad;
      const v = Math.sqrt(Math.max(0, ar * rad));
      const tx = this.y[i] / rad, ty = -this.x[i] / rad; // clockwise on screen, as seen from the north
      this.vx[i] = v * tx + gauss(r) * v * 0.06;
      this.vy[i] = v * ty + gauss(r) * v * 0.06;
    }
    this.time = 0;
  }

  accel() {
    const { n, x, y, ax, ay } = this;
    const gm = G_KPC * this.mass, eps2 = 0.35 * 0.35;
    const vh2 = 0.17 * 0.17, rc2 = 2.5 * 2.5; // the halo: flat at about 170 km/s
    const gb = G_KPC * 1.2e10, ab2 = 0.6 * 0.6; // the bulge
    for (let i = 0; i < n; i++) {
      const r2 = x[i] * x[i] + y[i] * y[i];
      const h = -vh2 / (r2 + rc2) - gb / Math.pow(r2 + ab2, 1.5);
      ax[i] = h * x[i];
      ay[i] = h * y[i];
    }
    for (let i = 0; i < n; i++) {
      const xi = x[i], yi = y[i];
      let sx = 0, sy = 0;
      for (let j = i + 1; j < n; j++) {
        const dx = x[j] - xi, dy = y[j] - yi;
        const d2 = dx * dx + dy * dy + eps2;
        const k = gm / (d2 * Math.sqrt(d2));
        sx += dx * k; sy += dy * k;
        ax[j] -= dx * k; ay[j] -= dy * k;
      }
      ax[i] += sx; ay[i] += sy;
    }
  }

  /** dt in Myr. */
  step(dt) {
    const steps = Math.ceil(dt / 0.6);
    const h = dt / steps;
    const { n, x, y, vx, vy, ax, ay } = this;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) { vx[i] += ax[i] * h * 0.5; vy[i] += ay[i] * h * 0.5; x[i] += vx[i] * h; y[i] += vy[i] * h; }
      this.accel();
      for (let i = 0; i < n; i++) { vx[i] += ax[i] * h * 0.5; vy[i] += ay[i] * h * 0.5; }
    }
    this.time += dt;
  }

  paint(P, V, f) {
    const { n, x, y, c } = this;
    if (P.S) { // in 3D, each star where it is, the disc with some thickness
      for (let i = 0; i < n; i++) P.dot3((x[i] + SUN_R) * KPC, y[i] * KPC, this.z[i] * KPC, { size: 0.75, colour: c[i], tone: 0.85, f });
      P.dot3(0, 0, 0, { colour: 3, f });
      return;
    }
    const G = P.G, count = this.count ||= new Map();
    count.clear();
    for (let i = 0; i < n; i++) {
      const ci = P.i((x[i] + SUN_R) * KPC), cj = P.j(y[i] * KPC);
      if (ci < 0 || cj < 0 || ci >= V.cols || cj >= V.rows) continue;
      const k = cj * V.cols + ci;
      const e = count.get(k);
      if (e) e[0]++; else count.set(k, [1, c[i]]);
    }
    for (const [k, [m, col]] of count) {
      G.put(k % V.cols, Math.floor(k / V.cols), m > 3 ? 1 : m > 1 ? 0.75 : 0.5, col, 0.85, f);
    }
    P.dot(0, 0, { colour: 3, f }); // the Sun
    if (V.ppm * KPC * 0.5 > V.cell) P.dot(SUN_R * KPC, 0, { f, size: 0.25 }); // the middle (a black hole, too small to see)
  }
}

// ---------------------------------------------------------------- bacteria

const UM = 1e-6;

/**
 * The glass of the screen, which (like every screen that gets touched) has
 * bacteria on it: rods 2 µm long, swimming in the damp the way E. coli does,
 * running straight at about 20 µm/s and tumbling to a new heading now and
 * then. We swim along with one of them, so it stays in the middle.
 */
export class Bacteria {
  constructor() {
    const r = this.r = rng(9);
    this.cells = Array.from({ length: 46 }, (_, k) => ({
      x: k ? (r() - 0.5) * 260 * UM : 0, y: k ? (r() - 0.5) * 180 * UM : 0,
      a: k ? r() * 2 * Math.PI : 0, len: (1.6 + r() * 0.9) * UM, run: r() * 1, tumble: 0, ph: r() * 6,
    }));
    this.speed = 20 * UM;
  }

  step(dt) {
    const r = this.r, me = this.cells[0];
    for (const b of this.cells) {
      b.ph += dt * 30;
      if (b === me) continue;
      if (b.tumble > 0) {
        b.tumble -= dt;
        b.a += (r() - 0.5) * 18 * dt;
        continue;
      }
      b.run -= dt;
      if (b.run <= 0) { b.tumble = 0.1 + r() * 0.1; b.run = -Math.log(r() + 1e-6) * 1.0; }
      b.x += Math.cos(b.a) * this.speed * dt;
      b.y += Math.sin(b.a) * this.speed * dt;
      b.a += gauss(r) * Math.sqrt(dt * 0.1); // rotational diffusion
    }
    // We swim along with ours: everyone else drifts back past us.
    for (const b of this.cells) {
      if (b === me) continue;
      b.x -= this.speed * dt;
      if (b.x < -130 * UM) { b.x += 260 * UM; b.y = (r() - 0.5) * 180 * UM; }
    }
  }

  paint(P, V, f) {
    for (const b of this.cells) this.rod(P, V, b, f, b === this.cells[0]);
  }

  /** A rod: a capsule with a membrane round it and, big enough, its flagella behind it. */
  rod(P, V, b, f, mine) {
    const w = 0.8 * UM, half = (b.len - w) / 2;
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    const px = (V.ppm) / V.cell; // cells a metre
    const Rc = (w / 2) * px, Hc = half * px;
    const ci = P.u(b.x), cj = P.v(b.y);
    if (Rc + Hc < 0.6) { P.G.put(Math.floor(ci), Math.floor(cj), Rc + Hc > 0.25 ? 0.5 : 0.25, 0, 1, f); return; }
    const ext = Rc + Hc + 1;
    if (ci + ext < 0 || cj + ext < 0 || ci - ext > V.cols || cj - ext > V.rows) return;
    // Flagella: a few wavy threads trailing behind, a few body lengths long.
    if (Rc > 1.5) {
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * w * 0.25;
        let last = null;
        for (let s = 0; s <= 1; s += 0.004) {
          const along = -half - w / 2 - s * 6 * UM;
          const side = off + Math.sin(s * 30 - b.ph + k) * 0.25 * UM;
          const x = b.x + along * ca - side * sa, y = b.y + along * sa + side * ca;
          const c = [Math.floor(P.u(x)), Math.floor(P.v(y))];
          if (!last || c[0] !== last[0] || c[1] !== last[1]) P.G.put(c[0], c[1], 0.5, 0, 0.55, f);
          last = c;
        }
      }
    }
    const i0 = Math.max(0, Math.floor(ci - ext)), i1 = Math.min(V.cols - 1, Math.floor(ci + ext));
    const j0 = Math.max(0, Math.floor(cj - ext)), j1 = Math.min(V.rows - 1, Math.floor(cj + ext));
    const wall = Math.max(1, Math.min(2.5, Rc * 0.08));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i + 0.5 - ci, dy = j + 0.5 - cj;
        const along = dx * ca + dy * sa, side = -dx * sa + dy * ca;
        const t = Math.max(-Hc, Math.min(Hc, along));
        const d2 = (along - t) * (along - t) + side * side;
        if (d2 > Rc * Rc) continue;
        const d = Math.sqrt(d2);
        if (Rc < 2 || d > Rc - wall) P.G.put(i, j, 1, 0, 1, f);
        else if (!mine && ((i * 7 + j * 3) % 5) === 0) P.G.put(i, j, 0.25, 0, 0.5, f);
      }
    }
  }

  /** Is cell (i, j) inside the one we follow (for the proteins)? */
  within(P, V, i, j) {
    const b = this.cells[0], w = 0.8 * UM, half = (b.len - w) / 2;
    const px = V.ppm / V.cell;
    const dx = i + 0.5 - P.u(b.x), dy = j + 0.5 - P.v(b.y);
    const t = Math.max(-half * px, Math.min(half * px, dx)), r = (w / 2) * px - 1.5;
    return r > 0 && (dx - t) * (dx - t) + dy * dy < r * r;
  }
}

// ---------------------------------------------------------------- proteins

const NM = 1e-9;

/**
 * Inside the bacterium: proteins crowded into a quarter of the space, each
 * knocked about by the water (Brownian dynamics: a random step of √(2DΔt), D
 * from Stokes–Einstein in cytoplasm about ten times as thick as water), and
 * pushed apart where they touch. Time slowed down about a million times. One
 * box of them, repeated.
 */
export class Proteins {
  constructor() {
    const r = this.r = rng(13);
    this.box = 120 * NM;
    this.p = [];
    for (let k = 0; k < 110; k++) {
      const ribosome = k < 5;
      const rad = ribosome ? 12.5 * NM : (2 + r() * r() * 5) * NM;
      this.p.push({ x: r() * this.box, y: r() * this.box, r: rad, tone: ribosome ? 1 : 0.55 + r() * 0.4 });
    }
    this.slow = 1e-6; // a microsecond a second
  }

  step(dt) {
    const kT = 4.11e-21, eta = 0.01; // 37°C-ish, cytoplasm at ten times water
    const h = dt * this.slow, B = this.box, r = this.r;
    for (const q of this.p) {
      const D = kT / (6 * Math.PI * eta * q.r);
      const s = Math.sqrt(2 * D * h);
      q.x += gauss(r) * s;
      q.y += gauss(r) * s;
    }
    // Overlaps pushed apart (the shortest way round the repeating box).
    for (let it = 0; it < 2; it++) {
      for (let a = 0; a < this.p.length; a++) {
        const A = this.p[a];
        for (let b = a + 1; b < this.p.length; b++) {
          const Q = this.p[b];
          let dx = Q.x - A.x, dy = Q.y - A.y;
          dx -= Math.round(dx / B) * B;
          dy -= Math.round(dy / B) * B;
          const m = A.r + Q.r, d2 = dx * dx + dy * dy;
          if (d2 >= m * m || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const push = (m - d) / d * 0.5;
          const wa = Q.r / m, wb = A.r / m; // the small one moves more
          A.x -= dx * push * wa * 2; A.y -= dy * push * wa * 2;
          Q.x += dx * push * wb * 2; Q.y += dy * push * wb * 2;
        }
      }
    }
    for (const q of this.p) { q.x = ((q.x % B) + B) % B; q.y = ((q.y % B) + B) % B; }
  }

  paint(P, V, f, inside) {
    const B = this.box, m = P.m;
    const xl = -V.cx / V.ppm, y0 = -V.cy / V.ppm; // the screen's top-left, metres
    const xw = V.cols * m, yh = V.rows * m;
    const tiles = ((xw / B + 2) * (yh / B + 2));
    if (tiles > 900) return; // too small to see yet
    for (let ty = Math.floor(y0 / B) - 1; ty * B < y0 + yh + B; ty++) {
      for (let tx = Math.floor(xl / B) - 1; tx * B < xl + xw + B; tx++) {
        for (const q of this.p) {
          const x = tx * B + q.x, y = ty * B + q.y;
          const R = (q.r * V.ppm) / V.cell;
          const ci = P.u(x), cj = P.v(y);
          if (ci + R < 0 || cj + R < 0 || ci - R > V.cols || cj - R > V.rows) continue;
          if (R < 1.2) {
            const i = Math.floor(ci), j = Math.floor(cj);
            if (inside(i, j)) P.G.put(i, j, R > 0.6 ? 1 : 0.75, 0, q.tone, f);
            continue;
          }
          const i0 = Math.max(0, Math.floor(ci - R)), i1 = Math.min(V.cols - 1, Math.floor(ci + R));
          const j0 = Math.max(0, Math.floor(cj - R)), j1 = Math.min(V.rows - 1, Math.floor(cj + R));
          const edge = Math.max(1, R * 0.12), R2 = R * R, E2 = (R - edge) * (R - edge);
          for (let j = j0; j <= j1; j++) {
            const dy = j + 0.5 - cj;
            for (let i = i0; i <= i1; i++) {
              const dx = i + 0.5 - ci, d2 = dx * dx + dy * dy;
              if (d2 > R2) continue;
              const ring = d2 > E2;
              if (!ring && ((i + j) & 1) !== 0) continue;
              if (!inside(i, j)) continue;
              if (ring) P.G.put(i, j, 1, 0, q.tone, f);
              else P.G.put(i, j, 0.5, 0, q.tone * 0.6, f);
            }
          }
        }
      }
    }
  }
}
