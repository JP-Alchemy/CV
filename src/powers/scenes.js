// Powers of Ten: the scales drawn in JS, each a small simulation of its own,
// painted into one grid of blocks over the screen (the renderer's FS_ZOOM).
// Everything is laid out in metres about "here", the middle of the screen:
// the CV's screen at the desk, Leiden on the map and the globe, the Earth in
// the solar system, the Sun among the stars and in the galaxy, and a
// bacterium and its proteins on the glass going down. A scale only steps
// while it's on screen.
//
// The page itself, the slime mould and the electron are drawn by their own
// passes (the renderer's camera, FS_SLIME, FS_QUANTUM).

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
export class Grid {
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.buf = new Uint8Array(cols * rows * 4);
    const r = rng(7);
    this.hash = Float32Array.from({ length: cols * rows }, r);
  }

  clear() { this.buf.fill(0); }

  /** A block in cell (i, j): size 0-1 of the cell, colour 0 ink or 1-7 the spectrum, tone 0-1 (ink only); f dissolves it in. The biggest block in a cell wins. */
  put(i, j, size, colour = 0, tone = 1, f = 1) {
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return;
    const k = j * this.cols + i;
    if (f < 1 && this.hash[k] >= f) return;
    const o = k * 4, s = Math.round(Math.min(1, size) * 255);
    if (s <= this.buf[o]) return;
    this.buf[o] = s;
    this.buf[o + 1] = colour;
    this.buf[o + 2] = Math.round(tone * 255);
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
  const a = host.layer.buf, b = P.G.buf;
  for (let k = 0; k < a.length; k += 4) if (a[k] > b[k]) { b[k] = a[k]; b[k + 1] = a[k + 1]; b[k + 2] = a[k + 2]; }
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

  dot(x, y, st) { this.G.put(this.i(x), this.j(y), st.size ?? 1, st.colour ?? 0, st.tone ?? 1, st.f ?? 1); }

  rect(x0, y0, x1, y1, st) {
    const { cols, rows } = this.V;
    const i0 = Math.max(0, this.i(x0)), i1 = Math.min(cols - 1, this.i(x1));
    const j0 = Math.max(0, this.j(y0)), j1 = Math.min(rows - 1, this.j(y1));
    if (i1 < i0 || j1 < j0) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.G.put(i, j, st.size ?? 1, st.colour ?? 0, st.tone ?? 1, st.f ?? 1);
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
      this.G.put(Math.floor(a[0] + (b[0] - a[0]) * t), Math.floor(a[1] + (b[1] - a[1]) * t), st.size ?? 1, st.colour ?? 0, st.tone ?? 1, st.f ?? 1);
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
        if (dx * dx + dy * dy <= R * R) this.G.put(i, j, st.size ?? 1, st.colour ?? 0, st.tone ?? 1, st.f ?? 1);
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
      this.G.put(Math.floor(ci + R * Math.cos(a)), Math.floor(cj + R * Math.sin(a)), st.size ?? 1, st.colour ?? 0, st.tone ?? 1, st.f ?? 1);
    }
  }
}

// ---------------------------------------------------------------- the desk

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

  paint(P, V, f, t) {
    const { sw, sh, bez, deskY, phone, mug } = this.geo(V);
    const ink = { f }, grey = { tone: 0.45, f };
    // The screen's edge, then the monitor (or the phone) round it.
    P.frame(-sw / 2 - bez, -sh / 2 - bez, sw / 2 + bez, sh / 2 + bez, ink);
    if (phone) {
      P.rect(-0.01, sh / 2 + bez, 0.01, deskY, grey);
    } else {
      P.rect(-sw / 2 - bez, sh / 2, sw / 2 + bez, sh / 2 + bez, grey);
      P.rect(-0.03, sh / 2 + bez, 0.03, deskY - 0.012, grey);
      P.rect(-0.12, deskY - 0.012, 0.12, deskY, ink);
      P.rect(-0.22, deskY - 0.018, 0.22, deskY, grey); // keyboard
    }
    // The desk and the floor.
    P.rect(-0.8, deskY, 0.8, deskY + 0.03, ink);
    P.rect(-0.77, deskY + 0.03, -0.74, deskY + 0.75, grey);
    P.rect(0.74, deskY + 0.03, 0.77, deskY + 0.75, grey);
    // Coffee.
    const [mx, , mw, mh] = mug;
    P.frame(mx - mw / 2, deskY - mh, mx + mw / 2, deskY, ink);
    P.ring(mx + mw / 2 + 0.018, deskY - mh / 2, 0.02, ink);
    for (const p of this.steam) {
      const k = 1 - p.age / p.life;
      P.dot(p.x, p.y, { size: 0.5, tone: 0.25 + 0.4 * k, f });
    }
    // A lamp, and its light on the desk.
    P.rect(-0.62, deskY - 0.015, -0.5, deskY, ink);
    P.line(-0.56, deskY - 0.015, -0.5, deskY - 0.36, ink);
    P.line(-0.5, deskY - 0.36, -0.33, deskY - 0.42, ink);
    P.rect(-0.36, deskY - 0.43, -0.28, deskY - 0.39, ink);
    for (let k = 0; k < 40; k++) {
      const a = (k * 0.618) % 1, b = (k * 0.382 + 0.1) % 1;
      const y = deskY - 0.38 + b * 0.37, x = -0.32 + (a - 0.5) * (0.04 + b * 0.3);
      P.dot(x, y, { size: 0.25, colour: 3, f: f * 0.8 });
    }
    // A plant.
    P.frame(-0.79, deskY - 0.08, -0.69, deskY, ink);
    const sway = Math.sin(t * 0.7) * 0.004;
    for (const [dx, h] of [[-0.03, 0.16], [0, 0.22], [0.03, 0.14], [-0.015, 0.19], [0.02, 0.2]]) {
      P.line(-0.74, deskY - 0.08, -0.74 + dx * 2 + sway, deskY - 0.08 - h, grey);
    }
    // The clock on the wall, telling the time.
    const cx = sw / 2 + 0.32, cy = -sh / 2 - 0.12, cr = 0.09;
    P.ring(cx, cy, cr, ink);
    const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    const hand = (frac, len, st) => {
      const a = frac * 2 * Math.PI - Math.PI / 2;
      P.line(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, st);
    };
    hand(h / 12, cr * 0.5, ink);
    hand(m / 60, cr * 0.8, ink);
    hand(s / 60, cr * 0.85, { size: 0.5, colour: 1, f });
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

// a (AU), period (days), mean longitude at J2000 (degrees), radius (m).
const PLANETS = [
  [0.387, 87.969, 252.25, 2.44e6],
  [0.723, 224.701, 181.98, 6.05e6],
  [1.0, 365.256, 100.46, R_EARTH],
  [1.524, 686.98, 355.45, 3.39e6],
  [5.203, 4332.59, 34.4, 6.99e7],
  [9.537, 10759.2, 49.94, 5.82e7],
  [19.19, 30688.5, 313.23, 2.54e7],
  [30.07, 60182, 304.88, 2.46e7],
];

/** The planets on circles, where they are today, a day a second; the Moon round the Earth. The Earth stays in the middle. */
export class Planets {
  paint(P, V, f, days) {
    const pos = PLANETS.map(([a, T, L0]) => {
      const th = ((L0 + (360 * days) / T) * Math.PI) / 180;
      return [a * AU * Math.cos(th), -a * AU * Math.sin(th)];
    });
    const sun = [-pos[2][0], -pos[2][1]];
    const orbit = { size: 0.25, tone: 0.4, f };
    PLANETS.forEach(([a], k) => { if (k !== 2) P.ring(sun[0], sun[1], a * AU, orbit, 3); });
    P.ring(sun[0], sun[1], AU, { size: 0.5, tone: 0.5, f }, 3);
    P.disc(sun[0], sun[1], Math.max(6.96e8, P.m * 1.2), { colour: 3, f });
    PLANETS.forEach(([, , , r], k) => {
      if (k === 2) return;
      P.disc(sun[0] + pos[k][0], sun[1] + pos[k][1], Math.max(r, P.m * 0.5), { f });
    });
    P.disc(0, 0, Math.max(R_EARTH, P.m * 0.5), { f }); // the Earth, in the middle
    const mth = ((218.316 + 13.176396 * days) * Math.PI) / 180;
    P.ring(0, 0, 3.844e8, orbit, 3);
    P.disc(3.844e8 * Math.cos(mth), -3.844e8 * Math.sin(mth), Math.max(1.737e6, P.m * 0.5), { f });
  }
}

// ---------------------------------------------------------------- the stars

// The nearest and brightest: galactic longitude (degrees), distance (light
// years), colour (0 white-ish ink, 1-7 the spectrum).
const STARS = [
  [315.7, 4.37, 3], [31.0, 5.96, 1], [244.1, 7.86, 1], [185.1, 8.31, 1], [227.2, 8.6, 6],
  [175.5, 8.73, 1], [11.3, 9.69, 1], [110.0, 10.29, 1], [195.8, 10.47, 2], [5.1, 10.72, 1],
  [270.1, 11.01, 1], [213.7, 11.46, 0], [82.3, 11.4, 2], [47.7, 16.7, 0], [67.4, 25.0, 5],
  [15.1, 36.7, 2], [181.0, 65, 2], [123.3, 433, 3], [199.8, 548, 1], [209.2, 860, 6], [84.3, 2600, 5],
];

/** The nearest stars flattened onto the galaxy's plane (towards its middle is to the right), and some of the many more. */
export class Stars {
  constructor() {
    const r = rng(11);
    this.field = Array.from({ length: 900 }, () => {
      const d = 5 * Math.pow(1000, r()), a = r() * 2 * Math.PI; // as many in each power of ten of distance
      return [d * Math.cos(a) * LY, -d * Math.sin(a) * LY, r() < 0.7 ? 0 : [1, 2, 3, 6][Math.floor(r() * 4)]];
    });
  }

  paint(P, V, f) {
    for (const [x, y, c] of this.field) P.dot(x, y, { size: 0.5, colour: c, tone: 0.6, f });
    for (const [l, d, c] of STARS) {
      const a = (l * Math.PI) / 180;
      const x = d * LY * Math.cos(a), y = -d * LY * Math.sin(a), m = P.m * 0.6;
      for (const [dx, dy] of [[0, 0], [m, 0], [0, m], [m, m]]) P.dot(x + dx, y + dy, { colour: c, f });
    }
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
