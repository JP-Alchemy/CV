// Powers of Ten, between the desk and the map. Side on, as the desk is:
// the room around it, with the sky over Leiden through the window as it is
// right now; then the house, a tall narrow one on a canal, among its
// neighbours, with trees on the quay, cyclists going by and the canal's
// surface a wave equation of its own. From above: a neighbourhood like mine
// (streets, terraced houses, back gardens, canals, cyclists), then the edge
// of town and the polders. The neighbourhood is made up, on purpose: it isn't
// my street.

import { rng, Grid } from './scenes.js';

const LEIDEN = [52.16, 4.49];
const STOREY = 3.1; // m, floor to floor

/** How high the Sun is over Leiden right now, as the sine of its altitude. */
export function sunOverLeiden(days) {
  const p0 = (LEIDEN[0] * Math.PI) / 180, l0 = (LEIDEN[1] * Math.PI) / 180;
  const frac = ((days % 1) + 1.5) % 1;
  const dec = (-23.44 * Math.cos((2 * Math.PI * (((days + 10.5) % 365.25) + 365.25)) / 365.25) * Math.PI) / 180;
  const sl = -(frac - 0.5) * 2 * Math.PI;
  return Math.cos(p0) * Math.cos(l0) * Math.cos(dec) * Math.cos(sl) + Math.cos(p0) * Math.sin(l0) * Math.cos(dec) * Math.sin(sl) + Math.sin(p0) * Math.sin(dec);
}

const hash = (a, b, c = 0) => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------- side on

const GABLES = ['step', 'neck', 'bell', 'spout', 'flat'];
const SPAN = 170; // m either side of my house

export class Street {
  constructor() {
    const r = rng(21);
    // The houses: mine in the middle, neighbours either way.
    this.houses = [{ x0: -2.6, x1: 2.6, n: 3, g: 'step', mine: true, seed: 1 }];
    for (const dir of [1, -1]) {
      let x = 2.6 * dir;
      while (Math.abs(x) < SPAN) {
        const w = 4.6 + r() * 2.8, n = 2 + Math.floor(r() * 3);
        const x0 = dir > 0 ? x : x - w, x1 = dir > 0 ? x + w : x;
        this.houses.push({ x0, x1, n, g: GABLES[Math.floor(r() * GABLES.length)], seed: Math.floor(r() * 1e6) });
        x += w * dir;
      }
    }
    this.trees = [];
    for (let x = -SPAN; x < SPAN; x += 9 + r() * 5) if (Math.abs(x) > 7) this.trees.push({ x, h: 6 + r() * 2.5, r: 2.4 + r() * 1.2 });
    this.riders = Array.from({ length: 9 }, () => ({ x: (r() - 0.5) * 2 * SPAN, v: (r() < 0.5 ? -1 : 1) * (4 + r() * 2), ph: r() * 6 }));
    this.books = [];
    for (let s = 0; s < 5; s++) {
      for (let x = -2.18; x < -1.4;) {
        const w = 0.025 + r() * 0.035;
        this.books.push({ s, x, w, h: 0.18 + r() * 0.15, tone: 0.45 + r() * 0.5 });
        x += w + 0.004;
      }
    }
    this.clouds = Array.from({ length: 4 }, () => ({ x: r(), y: 0.2 + r() * 0.5, s: 0.15 + r() * 0.2 }));
    this.stars = Array.from({ length: 14 }, () => [r(), r() * 0.8, r() * 6]);
    // The canal's surface: a damped wave equation, nudged by the wind.
    this.N = 680;
    this.dx = (2 * SPAN) / this.N;
    this.u = new Float32Array(this.N);
    this.v = new Float32Array(this.N);
    this.r = r;
  }

  step(dt) {
    const { u, v, N, dx, r } = this;
    const c2 = 1.4 * 1.4, steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i < N - 1; i++) v[i] += (c2 * (u[i - 1] - 2 * u[i] + u[i + 1]) / (dx * dx) - 0.35 * v[i]) * h;
      for (let i = 0; i < N; i++) u[i] += v[i] * h;
    }
    if (r() < dt * 6) { const i = 1 + Math.floor(r() * (N - 2)); v[i] += (r() - 0.5) * 1.2; }
    for (const b of this.riders) {
      b.x += b.v * dt;
      b.ph += Math.abs(b.v) * dt * 1.6;
      if (b.x > SPAN) b.x -= 2 * SPAN; else if (b.x < -SPAN) b.x += 2 * SPAN;
    }
    for (const c of this.clouds) c.x = (c.x + dt * 0.004) % 1.4;
  }

  /** g: the desk's geometry (deskY); sun: sine of the Sun's altitude. */
  paint(P, V, f, t, g, sun) {
    const floorY = g.deskY + 0.75, sY = floorY + STOREY;
    const night = sun < -0.05;
    const ink = { f }, grey = { tone: 0.5, f }, soft = { tone: 0.35, size: 0.5, f };
    this.room(P, f, floorY, night, t);
    for (const h of this.houses) this.house(P, h, sY, night, f);
    // The street, the quay wall and the canal, in section.
    P.line(-SPAN, sY, SPAN, sY, ink);
    P.rect(-SPAN, sY, SPAN, sY + 0.2, grey);
    const yW = sY + 1.3;
    let last = -1;
    for (let i = 0; i < this.N; i++) {
      const x = -SPAN + i * this.dx, ci = P.i(x);
      if (ci === last) continue;
      last = ci;
      P.dot(x, yW - this.u[i] * 0.25, { tone: 0.7, f });
    }
    for (let y = yW + 0.6; y < sY + 4; y += 0.6) P.line(-SPAN, y, SPAN, y, { size: 0.25, tone: 0.3, f }, 3);
    // Lindens on the quay.
    for (const tr of this.trees) {
      P.line(tr.x, sY, tr.x, sY - tr.h + tr.r * 0.6, grey);
      P.ring(tr.x, sY - tr.h, tr.r, { size: 0.5, tone: 0.55, f }, 2);
      this.speckle(P, tr.x, sY - tr.h, tr.r * 0.85, soft);
    }
    for (const b of this.riders) this.rider(P, b, sY, f);
  }

  /** Dots inside a circle, every other cell. */
  speckle(P, x, y, r, st) {
    const R = (r * P.V.ppm) / P.V.cell;
    if (R < 1.5) return;
    const ci = P.u(x), cj = P.v(y);
    const i0 = Math.max(0, Math.floor(ci - R)), i1 = Math.min(P.V.cols - 1, Math.floor(ci + R));
    const j0 = Math.max(0, Math.floor(cj - R)), j1 = Math.min(P.V.rows - 1, Math.floor(cj + R));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (((i + j) & 1) || (i - ci) ** 2 + (j - cj) ** 2 > R * R) continue;
        P.G.put(i, j, st.size, 0, st.tone, st.f);
      }
    }
  }

  /** My room, around the desk: walls, floor and ceiling, a bookcase, a radiator, a window and what's outside it. */
  room(P, f, floorY, night, t) {
    const ink = { f }, grey = { tone: 0.5, f }, slab = { size: 0.5, tone: 0.5, f };
    const ceil = floorY - 2.8;
    P.rect(-2.6, floorY, 2.6, floorY + 0.3, slab);
    P.rect(-2.6, ceil - 0.3, 2.6, ceil, slab);
    P.line(-2.6, floorY, 2.6, floorY, ink);
    P.line(-2.6, ceil, 2.6, ceil, ink);
    P.rect(-2.6, ceil - 0.3, -2.3, floorY + 0.3, slab);
    P.rect(2.3, ceil - 0.3, 2.6, floorY + 0.3, slab);
    // The window, and the sky through it, as it is over Leiden now.
    const wx0 = 0.95, wx1 = 2.0, wy0 = floorY - 2.3, wy1 = floorY - 0.95;
    if (night) {
      for (const [a, b, ph] of this.stars) {
        if (Math.sin(t * 1.3 + ph) > -0.6) P.dot(wx0 + 0.06 + a * (wx1 - wx0 - 0.12), wy0 + 0.06 + b * (wy1 - wy0 - 0.12), { size: 0.5, tone: 0.8, f });
      }
    } else {
      for (const c of this.clouds) {
        const cx = wx0 + (c.x - 0.2) * (wx1 - wx0), cy = wy0 + c.y * (wy1 - wy0);
        for (let k = 0; k < 3; k++) {
          const x = cx + (k - 1) * c.s * 0.5, y = cy - (k === 1 ? c.s * 0.25 : 0);
          if (x > wx0 + 0.05 && x < wx1 - 0.05) this.speckleIn(P, x, y, c.s * 0.35, [wx0, wy0, wx1, wy1], { size: 0.5, tone: 0.3, f });
        }
      }
    }
    P.frame(wx0, wy0, wx1, wy1, ink);
    P.line((wx0 + wx1) / 2, wy0, (wx0 + wx1) / 2, wy1, ink);
    P.line(wx0, wy0 + 0.45, wx1, wy0 + 0.45, ink);
    P.rect(wx0 - 0.05, wy1, wx1 + 0.05, wy1 + 0.04, ink);
    // A radiator under it.
    P.frame(1.0, floorY - 0.72, 1.95, floorY - 0.12, grey);
    for (let x = 1.06; x < 1.92; x += 0.07) P.line(x, floorY - 0.7, x, floorY - 0.14, { size: 0.5, tone: 0.4, f });
    // A bookcase.
    P.frame(-2.2, floorY - 2.0, -1.35, floorY, ink);
    for (let s = 1; s < 5; s++) P.line(-2.2, floorY - s * 0.4, -1.35, floorY - s * 0.4, ink);
    for (const b of this.books) {
      const base = floorY - b.s * 0.4;
      if (b.x + b.w > -1.37) continue;
      P.rect(b.x, base - b.h, b.x + b.w, base - 0.01, { tone: b.tone, f });
    }
    // A lamp from the ceiling.
    P.line(-0.9, ceil, -0.9, ceil + 0.5, grey);
    P.rect(-1.0, ceil + 0.5, -0.8, ceil + 0.6, ink);
  }

  /** Dots inside a circle, kept inside a rect. */
  speckleIn(P, x, y, r, box, st) {
    const R = (r * P.V.ppm) / P.V.cell;
    if (R < 1) return;
    const ci = P.u(x), cj = P.v(y);
    const i0 = Math.max(0, Math.floor(ci - R), P.i(box[0]) + 1), i1 = Math.min(P.V.cols - 1, Math.floor(ci + R), P.i(box[2]) - 1);
    const j0 = Math.max(0, Math.floor(cj - R), P.j(box[1]) + 1), j1 = Math.min(P.V.rows - 1, Math.floor(cj + R), P.j(box[3]) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!((i + j) & 1) && (i - ci) ** 2 + (j - cj) ** 2 <= R * R) P.G.put(i, j, st.size, 0, st.tone, st.f);
  }

  /** A house front: walls, its gable, windows (lit at night, some of them) and a door. */
  house(P, h, sY, night, f) {
    const { x0, x1, n, g } = h;
    const ink = { f }, w = x1 - x0, c = (x0 + x1) / 2;
    const yE = sY - STOREY * n, G = Math.min(4.2, w * 0.75);
    P.line(x0, sY, x0, yE, ink);
    P.line(x1, sY, x1, yE, ink);
    const L = (a, b, cc, d) => P.line(a, b, cc, d, ink);
    if (g === 'step') {
      const tw = w * 0.28, dx = (w - tw) / 6, dy = G / 4;
      let xl = x0, xr = x1, y = yE;
      for (let s = 0; s < 3; s++) {
        L(xl, y, xl, y - dy); L(xr, y, xr, y - dy);
        L(xl, y - dy, xl + dx, y - dy); L(xr, y - dy, xr - dx, y - dy);
        xl += dx; xr -= dx; y -= dy;
      }
      L(xl, y, xl, y - dy); L(xr, y, xr, y - dy); L(xl, y - dy, xr, y - dy);
    } else if (g === 'neck') {
      const nw = w * 0.22, ys = yE - G * 0.35, yt = yE - G;
      L(x0, yE, x0, ys); L(x1, yE, x1, ys);
      L(x0, ys, c - nw, ys); L(x1, ys, c + nw, ys);
      L(c - nw, ys, c - nw, yt); L(c + nw, ys, c + nw, yt);
      L(c - nw - 0.2, yt, c, yt - 0.6); L(c + nw + 0.2, yt, c, yt - 0.6);
      L(c - nw - 0.2, yt, c + nw + 0.2, yt);
    } else if (g === 'bell') {
      let px = x0, py = yE;
      for (let k = 1; k <= 14; k++) {
        const u = k / 14, x = x0 + u * w, y = yE - G * Math.pow(Math.sin(Math.PI * u), 0.55);
        L(px, py, x, y); px = x; py = y;
      }
    } else if (g === 'spout') {
      L(x0, yE, c, yE - G); L(x1, yE, c, yE - G);
    } else {
      P.rect(x0 - 0.15, yE - 0.5, x1 + 0.15, yE, { tone: 0.6, f });
    }
    // Windows, storey by storey; my room's storey is open, the doll's-house way.
    const m = Math.max(1, Math.floor((w - 0.8) / 1.7)), gap = w / m;
    for (let k = 0; k < n; k++) {
      if (h.mine && k === 1) continue;
      for (let q = 0; q < m; q++) {
        const xc = x0 + gap * (q + 0.5);
        if (k === 0 && q === 0) { // the door
          P.frame(xc - 0.45, sY - 2.3, xc + 0.45, sY, ink);
          continue;
        }
        const yb = sY - STOREY * k - 0.8, yt = yb - 1.6;
        P.frame(xc - 0.5, yt, xc + 0.5, yb, ink);
        if (night && hash(h.seed, k, q) < 0.35) P.rect(xc - 0.4, yt + 0.1, xc + 0.4, yb - 0.1, { size: 0.5, colour: 3, f });
      }
    }
  }

  /** Someone on a bike. */
  rider(P, b, sY, f) {
    const ink = { f }, dir = Math.sign(b.v), x = b.x;
    if (P.V.ppm * 2 < P.V.cell) { P.dot(x, sY - 1, ink); return; }
    P.ring(x - 0.5, sY - 0.34, 0.34, ink);
    P.ring(x + 0.5, sY - 0.34, 0.34, ink);
    P.line(x - 0.5, sY - 0.34, x, sY - 0.34, ink);
    P.line(x, sY - 0.34, x - 0.15 * dir, sY - 0.85, ink);
    P.line(x - 0.15 * dir, sY - 0.85, x + 0.45 * dir, sY - 0.85, ink);
    P.line(x + 0.5 * dir, sY - 0.34, x + 0.4 * dir, sY - 1.0, ink);
    P.line(x - 0.2 * dir, sY - 0.95, x + 0.1 * dir, sY - 1.5, ink); // back
    P.line(x + 0.1 * dir, sY - 1.45, x + 0.4 * dir, sY - 1.05, ink); // arm
    P.disc(x + 0.15 * dir, sY - 1.68, 0.12, ink);
    const a = b.ph;
    P.line(x, sY - 0.34, x + Math.cos(a) * 0.17, sY - 0.34 + Math.sin(a) * 0.17, ink);
    P.line(x - 0.2 * dir, sY - 0.95, x + Math.cos(a) * 0.17, sY - 0.34 + Math.sin(a) * 0.17, ink); // leg
  }
}

// ---------------------------------------------------------------- from above

const BX = 100, BY = 80; // a block and its street, m
const mod = (a, b) => ((a % b) + b) % b;

/**
 * A neighbourhood like mine, from above, block by block out to the edge of
 * town and into the polders. Each block of the screen asks what's under it,
 * so it's as detailed as the zoom allows: plots and garden walls close up,
 * rows of houses further out, a texture of town further still. Cyclists ride
 * the streets and turn at the corners.
 */
export class Town {
  constructor() {
    const r = this.r = rng(33);
    // Districts, each laid out at its own angle and block size; mine is the one at the middle, square to the canal.
    this.districts = [{ x: 0, y: 0, a: 0, bx: BX, by: BY }];
    for (let tries = 0; this.districts.length < 16 && tries < 400; tries++) {
      const d = 650 + Math.sqrt(r()) * 2200, t = r() * 2 * Math.PI, x = Math.cos(t) * d, y = Math.sin(t) * d;
      if (this.districts.some((q) => Math.hypot(q.x - x, q.y - y) < 620)) continue;
      this.districts.push({ x, y, a: (r() - 0.5) * 1.4, bx: 75 + r() * 60, by: 60 + r() * 30 });
    }
    this.riders = Array.from({ length: 90 }, () => {
      const across = r() < 0.5;
      return { across, line: Math.round((r() - 0.5) * 9), pos: (r() - 0.5) * 800, dir: r() < 0.5 ? -1 : 1, v: 4 + r() * 2 };
    });
  }

  step(dt) {
    const r = this.r;
    for (const b of this.riders) {
      const pitch = b.across ? BX : BY, before = Math.floor((b.pos - (b.across ? 50 : 6)) / pitch);
      b.pos += b.dir * b.v * dt;
      const after = Math.floor((b.pos - (b.across ? 50 : 6)) / pitch);
      if (after !== before && r() < 0.3) {
        // Turn onto the cross street at this corner.
        const corner = b.across ? after * BX + 50 + (b.dir < 0 ? BX : 0) : after * BY + 6 + (b.dir < 0 ? BY : 0);
        const line = b.line;
        b.across = !b.across;
        b.line = b.across ? Math.round((corner - 6) / BY) : Math.round((corner - 50) / BX);
        b.pos = b.across ? line * BX + 50 : line * BY + 6;
        b.dir = r() < 0.5 ? -1 : 1;
      }
      if (Math.abs(b.pos) > 420 || Math.abs((b.across ? BY : BX) * b.line) > 420) { b.dir = -Math.sign(b.pos) || 1; if (Math.abs(b.line) > 5) b.line = Math.sign(b.line) * 5; }
    }
  }

  /** The streets only change when the zoom does, so they're painted into a layer of their own and kept; the bikes go on top every frame. */
  paint(P, V, f) {
    const key = `${V.ppm}|${V.cols}|${V.rows}|${V.cell}|${Math.round(f * 20)}`;
    if (key !== this.key) {
      this.own ||= new Grid();
      if (this.own.cols !== V.cols || this.own.rows !== V.rows) this.own.resize(V.cols, V.rows);
      this.own.clear();
      this.streets(this.own, V, Math.round(f * 20) / 20);
      this.key = key;
    }
    const a = this.own.buf, b = P.G.buf;
    for (let k = 0; k < a.length; k += 4) {
      if (a[k] > b[k]) { b[k] = a[k]; b[k + 1] = a[k + 1]; b[k + 2] = a[k + 2]; }
    }
    if (V.cell / V.ppm < 6) {
      for (const r of this.riders) {
        const x = r.across ? r.pos : r.line * BX + 50, y = r.across ? r.line * BY + (mod(r.line, 3) === 0 ? 1 : 6) : r.pos; // on the quay, beside a canal
        P.dot(x, y, { size: 1, tone: 1, f });
      }
    }
  }

  streets(G, V, f) {
    const { cols, rows, cell, ppm } = V;
    const c = cell / ppm; // metres a block of the screen
    for (let j = 0; j < rows; j++) {
      const y = ((j + 0.5) * cell - V.cy) / ppm;
      for (let i = 0; i < cols; i++) {
        const x = ((i + 0.5) * cell - V.cx) / ppm;
        const odd = (i + j) & 1;
        const a = Math.atan2(y, x), d = Math.hypot(x, y);
        const edge = 1700 + 450 * Math.sin(a * 3 + 1) + 250 * Math.sin(a * 7 + 4);
        if (d > edge) { this.polder(G, i, j, x, y, c, f, odd); continue; }
        // Which district: the nearest middle. Where two are about as near, a main road.
        let k1 = 0, d1 = Infinity, d2 = Infinity;
        for (let k = 0; k < this.districts.length; k++) {
          const q = this.districts[k], dd = (x - q.x) ** 2 + (y - q.y) ** 2;
          if (dd < d1) { d2 = d1; d1 = dd; k1 = k; } else if (dd < d2) d2 = dd;
        }
        const seam = Math.sqrt(d2) - Math.sqrt(d1);
        if (seam < Math.max(9, c * 0.6)) { if (Math.abs(seam - 9) < c * 0.6 && c < 12) G.put(i, j, 0.5, 0, 0.45, f); continue; }
        // A river through town (the Old Rhine, more or less).
        const ry = -430 + 70 * Math.sin(x / 260);
        if (Math.abs(y - ry) < Math.max(14, c * 0.6)) {
          const e = Math.abs(Math.abs(y - ry) - 14) < c * 0.6;
          G.put(i, j, e ? 0.75 : 0.5, 0, e ? 0.8 : 0.4, f);
          continue;
        }
        // Into the district's own streets: turned, and gently bent.
        const D = this.districts[k1], ca = Math.cos(D.a), sa = Math.sin(D.a);
        let ux = (x - D.x) * ca + (y - D.y) * sa, uy = -(x - D.x) * sa + (y - D.y) * ca;
        if (k1) { ux += 14 * Math.sin(uy / 170 + k1); uy += 10 * Math.sin(ux / 210 + k1 * 2); }
        const PX = D.bx, PY = D.by, DY = PY - 12;
        const bx = Math.floor((ux + 45) / PX) + k1 * 1000, by = Math.floor((uy + DY) / PY) + k1 * 1000;
        const lx = mod(ux + 45, PX), ly = mod(uy + DY, PY);
        if (ly >= DY) { // the street along the block, or a canal
          if (mod(by, 3) === 0) {
            const wd = Math.abs(ly - DY - 6);
            if (wd < 4 || (c > 4 && wd < c * 0.5)) G.put(i, j, Math.abs(wd - 4) < c ? 0.75 : 0.5, 0, Math.abs(wd - 4) < c ? 0.8 : 0.4, f);
            else if (c < 3 && hash(Math.floor((ux + 3) / 10), by) < 0.9 && mod(ux + 3, 10) < 6 && (ly < DY + 2 || ly > DY + 10)) G.put(i, j, odd ? 0.5 : 0.25, 0, 0.45, f); // lindens
          }
          continue;
        }
        if (lx >= PX - 10) continue; // a street across
        if (c > 14) { if (!odd) G.put(i, j, 0.5, 0, 0.55, f); continue; } // town, from far off
        if (hash(bx, by, 7) < 0.07) { if (!odd && hash(i, j) < 0.6) G.put(i, j, 0.5, 0, 0.4, f); continue; } // a park
        const front = ly > DY - 11 ? 1 : ly < 11 ? 0 : -1;
        if (front >= 0) {
          const pw = 5.2 + 2.6 * hash(bx, by, front), fx = mod(lx, pw);
          if (c < 2.5 && fx < c) G.put(i, j, 1, 0, 0.95, f); // the wall between two houses
          else G.put(i, j, 0.75, 0, 0.72, f);
          continue;
        }
        // Back gardens: a wall down the middle, fences between, a tree here and there.
        if (c >= 3) { if (!odd && hash(i, j, 3) < 0.4) G.put(i, j, 0.25, 0, 0.35, f); continue; }
        const mid = DY / 2, half = ly < mid ? 0 : 1, pw = 5.2 + 2.6 * hash(bx, by, half), plot = Math.floor(lx / pw), fx = lx - plot * pw;
        if (Math.abs(ly - mid) < c * 0.6) G.put(i, j, 0.75, 0, 0.6, f);
        else if (fx < c) G.put(i, j, 0.5, 0, 0.35, f);
        else if (hash(bx * 97 + plot, by, half) < 0.3) {
          const tx = plot * pw + pw / 2, ty = half ? mid + (mid - 11) / 2 : (mid + 11) / 2, dd = Math.hypot(lx - tx, ly - ty);
          if (dd < 2.6) G.put(i, j, dd > 2.6 - c ? 0.75 : odd ? 0.5 : 0.25, 0, 0.5, f);
        }
      }
    }
  }

  /** The polders: long fields between ditches, a road now and then, a farm or two. */
  polder(G, i, j, x, y, c, f, odd) {
    if (mod(y + 200, 900) < Math.max(6, c * 0.6)) { G.put(i, j, 0.5, 0, 0.6, f); return; } // a road
    const fx = mod(x, 60);
    if (60 / c >= 3 && fx < Math.max(3, c * 0.6)) { G.put(i, j, 0.5, 0, 0.42, f); return; } // a ditch
    const fy = Math.floor((y + 200) / 900), fxI = Math.floor(x / 60);
    if (hash(fxI, fy, 11) < 0.05 && mod(y + 200, 900) < 40 && fx > 20 && fx < 45) { G.put(i, j, 0.75, 0, 0.75, f); return; } // a farm
    if (c < 30 && !odd && hash(i, j, 5) < 0.25) G.put(i, j, 0.25, 0, 0.3, f);
  }
}
