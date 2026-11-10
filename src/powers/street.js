// Powers of Ten, between the desk and the map. Side on, as the desk is:
// the room around it, with the sky over Leiden through the window as it is
// right now; then the house, a tall narrow one on a canal, among its
// neighbours, with trees on the quay, cyclists going by and the canal's
// surface a wave equation of its own. From above: a neighbourhood like mine
// (streets, terraced houses, back gardens, canals, cyclists), then the edge
// of town and the polders. The neighbourhood is made up, on purpose: it isn't
// my street.

import { rng, Grid, WALL, FRONT } from './scenes.js';

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
// In 3D (z, metres towards you; the screen on my desk is 0): the houses' fronts
// are where my room opens (FRONT), and they run DEEP back from there; then
// the street, the quay with its lindens, and the canal, out towards you.
const DEEP = 9, QUAY = FRONT + 5, TREES = FRONT + 4, CANAL = FRONT + 17;
const thin = (z, d = 0.05) => [z + d, z - d];

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
    // The street, the quay wall and the canal, in section (in 3D, the street and the water run out towards you).
    const road = [QUAY, FRONT - 0.3];
    P.line(-SPAN, sY, SPAN, sY, { ...ink, z: road });
    P.rect(-SPAN, sY, SPAN, sY + 0.2, { ...grey, z: road });
    const yW = sY + 1.3, water = [CANAL, QUAY + 0.3];
    let last = -1;
    for (let i = 0; i < this.N; i++) {
      const x = -SPAN + i * this.dx, ci = P.i(x);
      if (ci === last) continue;
      last = ci;
      P.dot(x, yW - this.u[i] * 0.25, { tone: 0.7, f, z: water });
    }
    if (!P.D3) for (let y = yW + 0.6; y < sY + 4; y += 0.6) P.line(-SPAN, y, SPAN, y, { size: 0.25, tone: 0.3, f }, 3); // the water, in section (in 3D its surface says it)
    P.wall(-SPAN, sY + 0.2, SPAN, sY + 4, { tone: 0.3, z: [QUAY + 0.3, QUAY] }); // the quay's wall, facing the canal
    // Lindens on the quay: in 3D the crowns are round, their leaves all through them.
    for (const tr of this.trees) {
      const cy = sY - tr.h, R = tr.r;
      const crown = (x, y) => { const q = Math.sqrt(Math.max(0, R * R - (x - tr.x) ** 2 - (y - cy) ** 2)), w = TREES + q * (2 * hash(Math.round(x * 5), Math.round(y * 5), 3) - 1); return [w + 0.25, w - 0.25]; };
      P.line(tr.x, sY, tr.x, sY - tr.h + tr.r * 0.6, { ...grey, z: thin(TREES, 0.2) });
      P.ring(tr.x, cy, tr.r, { size: 0.5, tone: 0.55, f, z: crown }, 2);
      this.speckle(P, tr.x, cy, tr.r * 0.85, { ...soft, z: crown });
    }
    this.riders.forEach((b, k) => this.rider(P, b, sY, f, FRONT + 1.2 + 2.6 * hash(k, 5)));
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
        P.put(i, j, st);
      }
    }
  }

  /** My room, around the desk: walls, floor and ceiling, a bookcase, a radiator, a window and what's outside it. In 3D, a box open towards you, the window in its back wall. */
  room(P, f, floorY, night, t) {
    const ink = { f }, grey = { tone: 0.5, f }, slab = P.D3 ? { tone: 0.3, f } : { size: 0.5, tone: 0.5, f }; // in 3D the slabs are solid, and the floor's a big face, so softer
    const ceil = floorY - 2.8, box = [FRONT, WALL - 0.3], inWall = [WALL, WALL - 0.3], edge = P.D3 ? { tone: 0.55, f } : ink;
    P.rect(-2.6, floorY, 2.6, floorY + 0.3, { ...slab, z: box });
    P.rect(-2.6, ceil - 0.3, 2.6, ceil, { ...slab, z: box });
    P.line(-2.6, floorY, 2.6, floorY, { ...edge, z: box });
    P.line(-2.6, ceil, 2.6, ceil, { ...edge, z: box });
    P.rect(-2.6, ceil - 0.3, -2.3, floorY + 0.3, { ...slab, z: box });
    P.rect(2.3, ceil - 0.3, 2.6, floorY + 0.3, { ...slab, z: box });
    // The window, and the sky through it, as it is over Leiden now (in 3D, well beyond it).
    const wx0 = 0.95, wx1 = 2.0, wy0 = floorY - 2.3, wy1 = floorY - 0.95, sky = thin(WALL - 5, 0.1);
    if (night) {
      for (const [a, b, ph] of this.stars) {
        if (Math.sin(t * 1.3 + ph) > -0.6) P.dot(wx0 + 0.06 + a * (wx1 - wx0 - 0.12), wy0 + 0.06 + b * (wy1 - wy0 - 0.12), { size: 0.5, tone: 0.8, f, z: sky });
      }
    } else {
      for (const c of this.clouds) {
        const cx = wx0 + (c.x - 0.2) * (wx1 - wx0), cy = wy0 + c.y * (wy1 - wy0);
        for (let k = 0; k < 3; k++) {
          const x = cx + (k - 1) * c.s * 0.5, y = cy - (k === 1 ? c.s * 0.25 : 0);
          if (x > wx0 + 0.05 && x < wx1 - 0.05) this.speckleIn(P, x, y, c.s * 0.35, [wx0, wy0, wx1, wy1], { size: 0.5, tone: 0.3, f, z: sky });
        }
      }
    }
    P.frame(wx0, wy0, wx1, wy1, { ...ink, z: inWall });
    P.line((wx0 + wx1) / 2, wy0, (wx0 + wx1) / 2, wy1, { ...ink, z: thin(WALL - 0.15) });
    P.line(wx0, wy0 + 0.45, wx1, wy0 + 0.45, { ...ink, z: thin(WALL - 0.15) });
    P.rect(wx0 - 0.05, wy1, wx1 + 0.05, wy1 + 0.04, { ...ink, z: [WALL + 0.12, WALL - 0.3] });
    // A radiator under it.
    const rad = [WALL + 0.1, WALL + 0.02];
    P.frame(1.0, floorY - 0.72, 1.95, floorY - 0.12, { ...grey, z: rad });
    for (let x = 1.06; x < 1.92; x += 0.07) P.line(x, floorY - 0.7, x, floorY - 0.14, { size: 0.5, tone: 0.4, f, z: rad });
    // A bookcase.
    const shelf = [WALL + 0.32, WALL];
    P.frame(-2.2, floorY - 2.0, -1.35, floorY, { ...ink, z: shelf });
    for (let s = 1; s < 5; s++) P.line(-2.2, floorY - s * 0.4, -1.35, floorY - s * 0.4, { ...ink, z: shelf });
    for (const b of this.books) {
      const base = floorY - b.s * 0.4;
      if (b.x + b.w > -1.37) continue;
      P.rect(b.x, base - b.h, b.x + b.w, base - 0.01, { tone: b.tone, f, z: [WALL + 0.28 - b.h * 0.2, WALL + 0.03] });
    }
    // A lamp from the ceiling.
    P.line(-0.9, ceil, -0.9, ceil + 0.5, { ...grey, z: thin(0.6, 0.01) });
    P.rect(-1.0, ceil + 0.5, -0.8, ceil + 0.6, { ...ink, z: (x) => { const q = Math.sqrt(Math.max(0, 0.01 - (x + 0.9) ** 2)); return [0.6 + q + 0.005, 0.6 - q - 0.005]; } });
    // In 3D, the wall behind it all, with the window in it.
    P.wall(-2.3, ceil, 2.3, floorY, { tone: 0.12, z: inWall }, [[wx0, wy0, wx1, wy1]]);
  }

  /** Dots inside a circle, kept inside a rect. */
  speckleIn(P, x, y, r, box, st) {
    const R = (r * P.V.ppm) / P.V.cell;
    if (R < 1) return;
    const ci = P.u(x), cj = P.v(y);
    const i0 = Math.max(0, Math.floor(ci - R), P.i(box[0]) + 1), i1 = Math.min(P.V.cols - 1, Math.floor(ci + R), P.i(box[2]) - 1);
    const j0 = Math.max(0, Math.floor(cj - R), P.j(box[1]) + 1), j1 = Math.min(P.V.rows - 1, Math.floor(cj + R), P.j(box[3]) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!((i + j) & 1) && (i - ci) ** 2 + (j - cj) ** 2 <= R * R) P.put(i, j, st);
  }

  /** A house front: walls, its gable, windows (lit at night, some of them) and a door. */
  house(P, h, sY, night, f) {
    const { x0, x1, n, g } = h;
    // In 3D the front is where my room opens, and its outline runs DEEP back: the side walls, and the gable becomes the roof.
    const ink = { f, z: [FRONT, FRONT - DEEP] }, w = x1 - x0, c = (x0 + x1) / 2;
    const yE = sY - STOREY * n, G = Math.min(4.2, w * 0.75), side = P.D3 ? { ...ink, tone: 0.5 } : ink;
    P.line(x0, sY, x0, yE, side);
    P.line(x1, sY, x1, yE, side);
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
      P.rect(x0 - 0.15, yE - 0.5, x1 + 0.15, yE, { tone: 0.6, f, z: [FRONT + 0.15, FRONT - DEEP] });
    }
    // Windows, storey by storey; my room's storey is open, the doll's-house way.
    const m = Math.max(1, Math.floor((w - 0.8) / 1.7)), gap = w / m, sill = { f, z: [FRONT + 0.05, FRONT - 0.3] }, holes = [];
    const open = [x0, sY - STOREY * 2, x1, sY - STOREY]; // my room's storey
    for (let k = 0; k < n; k++) {
      if (h.mine && k === 1) { holes.push(open); continue; }
      for (let q = 0; q < m; q++) {
        const xc = x0 + gap * (q + 0.5);
        if (k === 0 && q === 0) { // the door
          P.frame(xc - 0.45, sY - 2.3, xc + 0.45, sY, sill);
          holes.push([xc - 0.45, sY - 2.3, xc + 0.45, sY]);
          continue;
        }
        const yb = sY - STOREY * k - 0.8, yt = yb - 1.6;
        P.frame(xc - 0.5, yt, xc + 0.5, yb, sill);
        holes.push([xc - 0.5, yt, xc + 0.5, yb]);
        if (night && hash(h.seed, k, q) < 0.35) P.rect(xc - 0.4, yt + 0.1, xc + 0.4, yb - 0.1, { size: 0.5, colour: 3, f, z: [FRONT - 0.15, FRONT - 0.25] });
      }
    }
    P.wall(x0, yE, x1, sY, { tone: 0.12, z: [FRONT, FRONT - 0.3], f }, holes); // in 3D, the front wall itself
    for (const hole of holes) if (hole !== open) P.wall(...hole, { tone: 0.04, z: [FRONT - 1.2, FRONT - 1.4], f }); // and dark rooms behind the windows
  }

  /** Someone on a bike. */
  rider(P, b, sY, f, rz) {
    const ink = { f, z: thin(rz, 0.08) }, dir = Math.sign(b.v), x = b.x;
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

/** In 3D, the ground under a grid seen from above, `deep` cells thick, wherever there's nothing below it there already (water); `where` picks the cells. */
function ground(G, f, deep, where = null) {
  const b = G.buf, D = G.deep, n = G.cols * G.rows;
  for (let k = 0; k < n; k++) {
    if ((where && !where[k]) || (b[k * 4] && D[k * 4] < 0)) continue;
    G.back(k % G.cols, (k / G.cols) | 0, 0.08, 1, [0, -deep], f);
  }
}

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
    const key = `${V.ppm}|${V.cols}|${V.rows}|${V.cell}|${Math.round(f * 20)}|${!!P.D3}`;
    if (key !== this.key) {
      this.own ||= new Grid();
      if (this.own.cols !== V.cols || this.own.rows !== V.rows) this.own.resize(V.cols, V.rows);
      this.own.clear();
      this.streets(this.own, V, Math.round(f * 20) / 20, !!P.D3);
      this.key = key;
    }
    P.G.merge(this.own);
    if (V.cell / V.ppm < 6) {
      for (const r of this.riders) {
        const x = r.across ? r.pos : r.line * BX + 50, y = r.across ? r.line * BY + (mod(r.line, 3) === 0 ? 1 : 6) : r.pos; // on the quay, beside a canal
        P.dot(x, y, { size: 1, tone: 1, f, z: [1.8, 0] });
      }
    }
  }

  // In 3D, everything has its height (metres up, towards you): the houses
  // their storeys and pitched roofs, the lindens' crowns over the quays, the
  // garden walls; the canals and the river lie a little below the street.
  // In 3D, too, the houses are solid (whole cells), and there's ground under it all.
  streets(G, V, f, d3) {
    const { cols, rows, cell, ppm } = V;
    const c = cell / ppm; // metres a block of the screen
    const up = (top, bottom = 0) => [top / c, bottom / c];
    const WATER = up(-1.2, -1.6), QUAYSIDE = up(0.3, -1.6), built = d3 ? 1 : 0.75;
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
        if (seam < Math.max(9, c * 0.6)) { if (Math.abs(seam - 9) < c * 0.6 && c < 12) G.put(i, j, 0.5, 0, 0.45, f, up(0.2, -0.3)); continue; }
        // A river through town (the Old Rhine, more or less).
        const ry = -430 + 70 * Math.sin(x / 260);
        if (Math.abs(y - ry) < Math.max(14, c * 0.6)) {
          const e = Math.abs(Math.abs(y - ry) - 14) < c * 0.6;
          G.put(i, j, e ? 0.75 : 0.5, 0, e ? 0.8 : 0.4, f, e ? QUAYSIDE : WATER);
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
            if (wd < 4 || (c > 4 && wd < c * 0.5)) G.put(i, j, Math.abs(wd - 4) < c ? 0.75 : 0.5, 0, Math.abs(wd - 4) < c ? 0.8 : 0.4, f, Math.abs(wd - 4) < c ? QUAYSIDE : WATER);
            else if (c < 3 && hash(Math.floor((ux + 3) / 10), by) < 0.9 && mod(ux + 3, 10) < 6 && (ly < DY + 2 || ly > DY + 10)) { // lindens: their crowns up over the quay, a trunk under each
              const tz = 6 + 4 * hash(Math.floor((ux + 3) / 10), by, 2);
              G.put(i, j, odd ? 0.5 : 0.25, 0, 0.45, f, up(tz + 2 * hash(i, j, 4), tz - 3));
              if (Math.abs(mod(ux + 3, 10) - 3) < c * 0.6) G.back(i, j, 0.45, 0.25, up(tz - 3, 0), f);
            }
          }
          continue;
        }
        if (lx >= PX - 10) continue; // a street across
        if (c > 14) { if (!odd) G.put(i, j, 0.5, 0, 0.55, f, up(7 + 6 * hash(bx, by, 8))); continue; } // town, from far off: each block its own height
        if (hash(bx, by, 7) < 0.07) { if (!odd && hash(i, j) < 0.6) G.put(i, j, 0.5, 0, 0.4, f, up(9 + 5 * hash(i, j, 6), 4)); continue; } // a park, its trees
        const front = ly > DY - 11 ? 1 : ly < 11 ? 0 : -1;
        if (front >= 0) {
          // A row of houses, each its own height, with a pitched roof along the row.
          const pw = 5.2 + 2.6 * hash(bx, by, front), fx = mod(lx, pw), plot = Math.floor(lx / pw);
          const eave = STOREY * (2 + Math.floor(3 * hash(bx * 131 + plot, by, front))), t = (front ? ly - (DY - 11) : ly) / 11, roof = eave + 3.2 * (1 - Math.abs(2 * t - 1));
          if (c < 2.5 && fx < c) G.put(i, j, 1, 0, 0.95, f, up(roof + 0.4)); // the wall between two houses
          else G.put(i, j, built, 0, 0.72, f, up(c < 2.5 ? roof : eave + 1.6));
          continue;
        }
        // Back gardens: a wall down the middle, fences between, a tree here and there.
        if (c >= 3) { if (!odd && hash(i, j, 3) < 0.4) G.put(i, j, 0.25, 0, 0.35, f, up(2 + 4 * hash(i, j, 12))); continue; }
        const mid = DY / 2, half = ly < mid ? 0 : 1, pw = 5.2 + 2.6 * hash(bx, by, half), plot = Math.floor(lx / pw), fx = lx - plot * pw;
        if (Math.abs(ly - mid) < c * 0.6) G.put(i, j, 0.75, 0, 0.6, f, up(2));
        else if (fx < c) G.put(i, j, 0.5, 0, 0.35, f, up(1.2));
        else if (hash(bx * 97 + plot, by, half) < 0.3) {
          const tx = plot * pw + pw / 2, ty = half ? mid + (mid - 11) / 2 : (mid + 11) / 2, dd = Math.hypot(lx - tx, ly - ty);
          if (dd < 2.6) G.put(i, j, dd > 2.6 - c ? 0.75 : odd ? 0.5 : 0.25, 0, 0.5, f, up(5 + 1.5 * Math.sqrt(Math.max(0, 1 - (dd / 2.6) ** 2)), 2.5));
        }
      }
    }
    if (d3) ground(G, f, Math.max(0.5, 2 / c));
  }

  /** The polders: long fields between ditches, a road now and then, a farm or two. */
  polder(G, i, j, x, y, c, f, odd) {
    const up = (top, bottom = 0) => [top / c, bottom / c];
    if (mod(y + 200, 900) < Math.max(6, c * 0.6)) { G.put(i, j, 0.5, 0, 0.6, f, up(0.6, -0.4)); return; } // a road, on its dyke
    const fx = mod(x, 60);
    if (60 / c >= 3 && fx < Math.max(3, c * 0.6)) { G.put(i, j, 0.5, 0, 0.42, f, up(-0.8, -1.2)); return; } // a ditch
    const fy = Math.floor((y + 200) / 900), fxI = Math.floor(x / 60);
    if (hash(fxI, fy, 11) < 0.05 && mod(y + 200, 900) < 40 && fx > 20 && fx < 45) { G.put(i, j, 0.75, 0, 0.75, f, up(8)); return; } // a farm
    if (c < 30 && !odd && hash(i, j, 5) < 0.25) G.put(i, j, 0.25, 0, 0.3, f, up(0.5));
  }
}

// ---------------------------------------------------------------- the region

// Between the town and the country: Leiden among its neighbours, as they
// really are, roughly. The coast is Natural Earth's (geo.js), with the dunes
// behind it; the towns are the slime mould's 40 cities (slime/places.js) and
// the smaller ones near Leiden; the motorways, rivers, canals and lakes are
// traced by hand to a few hundred metres; Schiphol has its six runways, the
// Westland its glass, and the bulb fields between Leiden and Haarlem flower in
// spring (March to May, by the calendar). Everything else is polder.

const M_LAT = 111320, M_LON = 111320 * Math.cos((LEIDEN[0] * Math.PI) / 180);
/** Latitude and longitude to metres from Leiden (x east, y south). */
const xy = ([la, lo]) => [(lo - LEIDEN[1]) * M_LON, (LEIDEN[0] - la) * M_LAT];

// [lat, lon, radius km]: the towns near Leiden that aren't among the 40.
const TOWNS = [
  [52.2, 4.415, 1.5], [52.238, 4.445, 1.2], [52.143, 4.4, 1.2], [52.127, 4.447, 1], [52.129, 4.66, 2],
  [52.06, 4.49, 2.4], [52.01, 4.36, 2], [52.3, 4.69, 1.8], [52.257, 4.557, 1], [52.225, 4.52, 0.8],
  [52.263, 4.635, 1], [52.08, 4.39, 1.7], [52.04, 4.32, 1.3], [52.08, 4.75, 0.9], [52.085, 4.885, 1.3],
  [52.3, 4.86, 2], [52.29, 4.58, 0.9], [51.93, 4.58, 1.5], [51.92, 4.4, 1.5], [51.91, 4.34, 1.5],
  [52.35, 4.61, 1], [52.155, 4.52, 1.4], [52.175, 4.47, 1.2], [51.99, 4.21, 0.8], [52.04, 4.2, 1.6],
];
const MOTORWAYS = [
  [[52.34, 4.86], [52.31, 4.77], [52.27, 4.66], [52.21, 4.56], [52.17, 4.52], [52.13, 4.46], [52.09, 4.4], [52.06, 4.35], [52, 4.38], [51.93, 4.4]], // A4
  [[52.29, 4.66], [52.24, 4.56], [52.21, 4.51], [52.18, 4.47], [52.14, 4.4], [52.1, 4.34]], // A44
  [[52.08, 4.32], [52.07, 4.41], [52.05, 4.5], [52.03, 4.62], [52.03, 4.7], [52.08, 4.9], [52.09, 5.08]], // A12
  [[52.34, 4.92], [52.25, 4.98], [52.15, 5.02], [52.1, 5.06]], // A2
  [[52.3, 4.87], [52.32, 4.75], [52.38, 4.67], [52.42, 4.66]], // A9
  [[52.06, 4.35], [52, 4.39], [51.94, 4.44]], // A13
  [[51.93, 4.33], [51.94, 4.47], [51.95, 4.55], [52, 4.65]], // A20
  [[52.15, 4.52], [52.12, 4.62], [52.12, 4.7]], // N11
  Array.from({ length: 25 }, (_, k) => [52.365 + 0.03 * Math.sin((k / 24) * 2 * Math.PI), 4.89 + 0.049 * Math.cos((k / 24) * 2 * Math.PI)]), // A10
];
// [points, width m]
const WATERWAYS = [
  [[[52.207, 4.4], [52.18, 4.45], [52.16, 4.49], [52.145, 4.55], [52.13, 4.66], [52.09, 4.8], [52.085, 4.88], [52.09, 5], [52.09, 5.11]], 40], // the Old Rhine
  [[[52.465, 4.57], [52.44, 4.67], [52.42, 4.78], [52.39, 4.88], [52.38, 4.92]], 270], // the North Sea Canal
  [[[51.98, 4.05], [51.955, 4.15], [51.91, 4.3], [51.905, 4.4], [51.91, 4.48], [51.9, 4.55], [51.88, 4.6]], 500], // the Maas
  [[[52.33, 4.6], [52.25, 4.56], [52.22, 4.6], [52.24, 4.7], [52.3, 4.76], [52.35, 4.72], [52.33, 4.6]], 40], // the Haarlemmermeer's ring canal
  [[[52.16, 4.49], [52.1, 4.42], [52.07, 4.38], [52.01, 4.36]], 30], // Rijn-Schiekanaal
  [[[52.38, 4.92], [52.3, 4.97], [52.2, 5.02], [52.09, 5.08]], 100], // Amsterdam-Rijnkanaal
  [[[52.13, 4.66], [52.06, 4.68], [52.01, 4.71]], 30], // the Gouwe
];
// [lat, lon, semi-axes km (east, north), turn]
const LAKES = [
  [52.215, 4.555, 1.6, 1, 0.4], [52.19, 4.645, 0.7, 2, 0.2], [52.255, 4.745, 2, 1.6, 0], [52.04, 4.73, 1.8, 1.2, 0],
  [52.215, 4.93, 0.8, 3, -0.3], [52.145, 4.81, 2, 1.2, 0], [52.02, 4.58, 1, 0.8, 0],
];
// [lat, lon, heading°, length m]
const RUNWAYS = [[52.3486, 4.7116, 0, 3800], [52.317, 4.738, 0, 3400], [52.3, 4.783, 0, 3400], [52.297, 4.77, 58, 3500], [52.316, 4.795, 87, 3450], [52.31, 4.8, 40, 2000]];
const GLASS = [[51.99, 4.24, 5, 3.5, 0.3], [52.02, 4.53, 2, 1.5, 0]]; // the Westland, and round Bleiswijk
const BLUR = [[0, 0], [-450, -450], [450, -450], [-450, 450], [450, 450], [-640, 0], [640, 0], [0, -640], [0, 640]];
const BULBS = [52.27, 4.54, 2.5, 7, -0.4]; // the Bollenstreek

const segs = (pts, w) => {
  const out = [];
  const P = pts.map(xy);
  for (let k = 1; k < P.length; k++) {
    const [ax, ay] = P[k - 1], [bx, by] = P[k];
    out.push({ ax, ay, bx, by, w, x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) });
  }
  return out;
};
const ellipse = ([la, lo, a, b, t]) => { const [x, y] = xy([la, lo]); return { x, y, a: a * 1000, b: b * 1000, c: Math.cos(t), s: Math.sin(t), r: Math.max(a, b) * 1000 }; };
const inEllipse = (e, x, y) => { const dx = x - e.x, dy = y - e.y, u = (dx * e.c + dy * e.s) / e.a, v = (-dx * e.s + dy * e.c) / e.b; return u * u + v * v; };

export class Region {
  /** places: the slime mould's cities ({ cities: [name, x km, y km, people] }); G: geo.js. */
  constructor(places, G) {
    this.G = G;
    const lei = places.cities.find((c) => c[0] === 'Leiden');
    this.towns = places.cities.map(([name, x, y, n]) => ({ x: (x - lei[1]) * 1000, y: (y - lei[2]) * 1000, r: name === 'Leiden' ? 2600 : 5.5 * Math.sqrt(n) }));
    for (const [la, lo, r] of TOWNS) { const [x, y] = xy([la, lo]); this.towns.push({ x, y, r: r * 1000 }); }
    this.towns.forEach((t, k) => { t.p = k * 1.7; t.q = k * 2.3; });
    this.roads = MOTORWAYS.flatMap((p) => segs(p, 30));
    this.water = WATERWAYS.flatMap(([p, w]) => segs(p, w));
    this.runways = RUNWAYS.map(([la, lo, h, len]) => {
      const [x, y] = xy([la, lo]), dx = (Math.sin((h * Math.PI) / 180) * len) / 2, dy = (-Math.cos((h * Math.PI) / 180) * len) / 2;
      return segs([[LEIDEN[0] - (y - dy) / M_LAT, LEIDEN[1] + (x - dx) / M_LON], [LEIDEN[0] - (y + dy) / M_LAT, LEIDEN[1] + (x + dx) / M_LON]], 60)[0];
    });
    this.lakes = LAKES.map(ellipse);
    this.glass = GLASS.map(ellipse);
    this.bulbs = ellipse(BULBS);
    this.terminal = { ...xy([52.31, 4.763]), r: 700 };
  }

  paint(P, V, f) {
    const spring = [2, 3, 4].includes(new Date().getMonth());
    const key = `${V.ppm}|${V.cols}|${V.rows}|${V.cell}|${V.cx}|${V.cy}|${Math.round(f * 20)}|${this.G.ready}|${spring}|${!!P.D3}`;
    if (key !== this.key) {
      this.own ||= new Grid();
      if (this.own.cols !== V.cols || this.own.rows !== V.rows) this.own.resize(V.cols, V.rows);
      this.own.clear();
      this.fill(this.own, V, Math.round(f * 20) / 20, spring, !!P.D3);
      this.key = key;
    }
    P.G.merge(this.own);
  }

  // In 3D (heights in cells, towards you): the towns stand up off the land,
  // most in their middles, and the dunes, farms and glass a little; the sea,
  // the lakes and the waterways lie a little below it. Real heights would be
  // too small to see from this far up, so they're drawn several times over.
  fill(G, V, f, spring, d3) {
    const { cols, rows, cell, ppm } = V, c = cell / ppm, h = c * 0.5, land = d3 ? new Uint8Array(cols * rows) : null;
    const tall = (m, most) => [Math.min(most, (m * 4) / c), 0], SEA = [-0.2, -0.5], WET = [-0.1, -0.4];
    const at = (x, y) => (this.G.ready ? this.G.at(LEIDEN[0] - y / M_LAT, LEIDEN[1] + x / M_LON) : 1);
    // What's in view (and a little round it), so each block only asks about those.
    const vx0 = -V.cx / ppm - c, vx1 = (cols * cell - V.cx) / ppm + c, vy0 = -V.cy / ppm - c, vy1 = (rows * cell - V.cy) / ppm + c;
    const seen = (s) => s.x1 + s.w + c > vx0 && s.x0 - s.w - c < vx1 && s.y1 + s.w + c > vy0 && s.y0 - s.w - c < vy1;
    const roads = this.roads.filter(seen), water = this.water.filter(seen), runways = this.runways.filter(seen);
    const round = (e) => e.x + e.r * 1.4 + c > vx0 && e.x - e.r * 1.4 - c < vx1 && e.y + e.r * 1.4 + c > vy0 && e.y - e.r * 1.4 - c < vy1;
    const towns = this.towns.filter(round), lakes = this.lakes.filter(round), glass = this.glass.filter(round), bulbs = [this.bulbs].filter(round);
    // The lines (water, runways, roads) and the towns, drawn once into a
    // layer of cells: walked along, or filled over, rather than asked about
    // at every block.
    const line = new Uint8Array(cols * rows), built = new Float32Array(cols * rows);
    const ci = (x) => (V.cx + x * ppm) / cell, cj = (y) => (V.cy + y * ppm) / cell;
    const stroke = (list, kind, pad) => {
      for (const sg of list) {
        const half = Math.max(sg.w / 2, pad) / c, n = Math.ceil((Math.hypot(sg.bx - sg.ax, sg.by - sg.ay) / c) * 2) + 1, r = Math.ceil(half);
        for (let k = 0; k <= n; k++) {
          const u = k / n, px = ci(sg.ax + (sg.bx - sg.ax) * u), py = cj(sg.ay + (sg.by - sg.ay) * u);
          if (px < -r - 1 || py < -r - 1 || px > cols + r || py > rows + r) continue;
          for (let j = Math.floor(py - half); j <= Math.floor(py + half); j++) {
            if (j < 0 || j >= rows) continue;
            for (let i = Math.floor(px - half); i <= Math.floor(px + half); i++) {
              if (i < 0 || i >= cols || (i + 0.5 - px) ** 2 + (j + 0.5 - py) ** 2 > half * half + 0.25) continue;
              const q = j * cols + i;
              if (!line[q] || line[q] > kind) line[q] = kind;
            }
          }
        }
      }
    };
    stroke(water, 1, h); stroke(runways, 2, h * 0.8); stroke(roads, 3, h);
    for (const t of towns) {
      const R = (t.r * 1.3) / c, x0 = ci(t.x), y0 = cj(t.y);
      for (let j = Math.max(0, Math.floor(y0 - R)); j <= Math.min(rows - 1, Math.floor(y0 + R)); j++) {
        for (let i = Math.max(0, Math.floor(x0 - R)); i <= Math.min(cols - 1, Math.floor(x0 + R)); i++) {
          const dx = i + 0.5 - x0, dy = j + 0.5 - y0, a = Math.atan2(dy, dx);
          const d = (Math.hypot(dx, dy) * c) / (t.r * (1 + 0.18 * Math.sin(3 * a + t.p) + 0.1 * Math.sin(7 * a + t.q)));
          const q = j * cols + i;
          if (d < 1 && 1 - d > built[q]) built[q] = 1 - d;
        }
      }
    }
    // The sea: how much of the ground round each point of a coarse lattice
    // is sea (the outlines are a few hundred metres a pixel, so blurred a
    // little), then read between the points, so the coast runs smooth, not in stairs.
    const sp = Math.max(320, c * 1.5), taps = c > 700 ? BLUR.slice(0, 1) : BLUR, lx0 = vx0 - 2000, ly0 = vy0 - 2000;
    const LW = Math.ceil((vx1 - lx0) / sp) + 2, LH = Math.ceil((vy1 + 1000 - ly0) / sp) + 2, wet = new Float32Array(LW * LH);
    for (let b = 0; b < LH; b++) for (let a = 0; a < LW; a++) {
      let n = 0;
      for (const [ox, oy] of taps) n += at(lx0 + a * sp + ox, ly0 + b * sp + oy) === 0 ? 1 : 0;
      wet[b * LW + a] = n / taps.length;
    }
    const seaAt = (x, y) => {
      const gx = (x - lx0) / sp, gy = (y - ly0) / sp, a = Math.max(0, Math.min(LW - 2, gx | 0)), b = Math.max(0, Math.min(LH - 2, gy | 0)), fx = gx - a, fy = gy - b, k = b * LW + a;
      return (wet[k] * (1 - fx) + wet[k + 1] * fx) * (1 - fy) + (wet[k + LW] * (1 - fx) + wet[k + LW + 1] * fx) * fy > 0.5;
    };
    const polders = new Map(), inside = (list, x, y) => list.some((e) => Math.abs(x - e.x) < e.r && Math.abs(y - e.y) < e.r && inEllipse(e, x, y) < 1);
    const W = cols + 2, sea = new Uint8Array(W * (rows + 2));
    for (let j = -1; j <= rows; j++) {
      const y = ((j + 0.5) * cell - V.cy) / ppm;
      for (let i = -1; i <= cols; i++) sea[(j + 1) * W + i + 1] = seaAt(((i + 0.5) * cell - V.cx) / ppm, y) ? 1 : 0;
    }
    for (let j = 0; j < rows; j++) {
      const y = ((j + 0.5) * cell - V.cy) / ppm;
      for (let i = 0; i < cols; i++) {
        const x = ((i + 0.5) * cell - V.cx) / ppm, odd = (i + j) & 1, k = (j + 1) * W + i + 1;
        if (sea[k]) { if (((i + 2 * j) & 3) === 0) G.put(i, j, 0.25, 0, 0.4, f, SEA); continue; }
        if (this.G.ready && c > 400 && at(x, y) !== this.G.nl) continue; // further out, only the Netherlands: the globe has the rest
        if (land) land[j * cols + i] = 1;
        if (sea[k - 1] || sea[k + 1] || sea[k - W] || sea[k + W]) { G.put(i, j, 1, 0, 1, f, [0.15, -0.2]); continue; } // the beach
        if (inside(lakes, x, y)) { if (((i + 2 * j) & 3) === 0) G.put(i, j, 0.25, 0, 0.4, f, SEA); else if (lakes.some((e) => inEllipse(e, x, y) > (1 - c / e.r) ** 2)) G.put(i, j, 0.75, 0, 0.8, f, [0.1, -0.3]); continue; }
        const ln = line[j * cols + i];
        if (ln === 1) { G.put(i, j, 0.75, 0, 0.8, f, WET); continue; }
        if (ln === 2) { G.put(i, j, 0.9, 0, 0.95, f, [0.05, -0.2]); continue; }
        if (ln === 3) { G.put(i, j, 0.6, 0, 0.7, f, [0.25, -0.1]); continue; }
        if (Math.hypot(x - this.terminal.x, y - this.terminal.y) < this.terminal.r) { if (!odd) G.put(i, j, 0.75, 0, 0.8, f, tall(20, 1)); continue; }
        // A town: built up, denser and taller in the middle, its edge wavy.
        const town = built[j * cols + i];
        if (town > 0) {
          const z = tall(10 + 45 * town * town, 2.5);
          if (town > 0.55) G.put(i, j, odd ? 0.5 : 0.75, 0, 0.75, f, z);
          else if (!odd || hash(i, j, 9) < 0.3) G.put(i, j, 0.5, 0, 0.55, f, z);
          continue;
        }
        // The dunes: a strip of sand and scrub behind the beach.
        if (seaAt(x - 1800, y) || seaAt(x - 900, y)) { if (hash(i, j, 13) < 0.55) G.put(i, j, 0.4, 0, 0.45, f, tall(8 + 7 * (Math.sin(x / 400 + 1) + Math.sin(y / 650 + Math.sin(x / 900))), 1.5)); continue; }
        if (inside(glass, x, y)) { // greenhouses: whole blocks of glass
          const gx = Math.floor((x + 5e4) / 260), gy = Math.floor((y + 5e4) / 180);
          if (hash(gx, gy, 17) < 0.75) G.put(i, j, 0.6, 0, 0.9, f, tall(6, 0.6));
          continue;
        }
        // Fields, in strips between ditches, each polder at its own angle.
        const px = Math.floor((x + 5e4) / 3500), py = Math.floor((y + 5e4) / 3500), pk = px * 4096 + py;
        let pol = polders.get(pk);
        if (!pol) { const ang = (hash(px, py, 19) - 0.5) * 1.2; polders.set(pk, pol = { co: Math.cos(ang), si: Math.sin(ang), sw: 70 + 90 * hash(px, py, 23) }); }
        const { co, si, sw } = pol, u = x * co + y * si, v = -x * si + y * co, strip = Math.floor(u / sw);
        if (inside(bulbs, x, y)) { // bulb fields: in flower in spring
          const tulip = [1, 1, 2, 3, 7][Math.floor(hash(strip, Math.floor(v / 300), 29) * 5)];
          if (spring) G.put(i, j, 0.55, tulip, 1, f, [0.25, 0]);
          else if (strip & 1) G.put(i, j, 0.35, 0, 0.4, f, [0.15, 0]);
          continue;
        }
        if (sw > c * 2 && Math.abs(u - strip * sw) < h) { G.put(i, j, 0.4, 0, 0.42, f, WET); continue; } // a ditch
        if (hash(strip, Math.floor(v / 900), 31) < 0.012) { G.put(i, j, 0.6, 0, 0.7, f, tall(10, 1)); continue; } // a farm
        if (!odd && hash(i, j, 5) < 0.22) G.put(i, j, 0.25, 0, 0.3, f, [0.15, 0]);
      }
    }
    if (land) ground(G, f, 0.5, land);
  }
}
