// Powers of Ten, past the galaxy. The Local Group: the Milky Way, Andromeda,
// Triangulum and the Magellanic Clouds as masses pulling on each other, with
// the dwarfs riding along, Andromeda falling towards us at 110 km/s. The
// cosmic web: galaxies along filaments round voids, grown from a nearly
// smooth start by the Zel'dovich approximation (each one moved along the
// pull it started with, x = q + D(t)ψ(q)). The observable universe's edge,
// the microwave background. And past that a guess: bubble universes in
// eternal inflation, nucleating in a false vacuum that never stops inflating.
//
// Everything is in metres about "here" (the Sun), as in scenes.js.

import { rng, KPC, LY, cached } from './scenes.js';

const G_KPC = 4.498e-12; // kpc³ / (solar mass · Myr²)
const KMS = 1.0227e-3; // km/s in kpc/Myr
const MLY = 1e6 * LY / KPC; // a million light years, in kpc
const SUN_R = 8.2; // kpc from the Milky Way's middle, which is to the right (as in scenes.js)
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// ---------------------------------------------------------------- the Local Group

// name, galactic longitude (°), distance (Mly), mass (solar masses, 0 = rides
// along), radius drawn (kpc), tilt of its disc (0 = face on, 1 = edge on).
const MEMBERS = [
  ['Milky Way', 0, 0, 1.2e12, 15, 0],
  ['Andromeda', 121.2, 2.54, 1.5e12, 33, 0.75],
  ['Triangulum', 133.6, 2.73, 5e10, 9, 0.45],
  ['Large Magellanic Cloud', 280.5, 0.163, 1e11, 4, 0.3],
  ['Small Magellanic Cloud', 302.8, 0.2, 0, 2, 0.3],
  ['Sagittarius Dwarf', 5.6, 0.07, 0, 1.5, 0],
  ['Fornax', 237.1, 0.46, 0, 1, 0],
  ['Sculptor', 287.5, 0.29, 0, 0.8, 0],
  ['Leo I', 226, 0.82, 0, 0.6, 0],
  ['NGC 6822', 25.3, 1.6, 0, 1.2, 0],
  ['IC 1613', 129.8, 2.4, 0, 1.2, 0],
  ['M32', 121.2, 2.49, 0, 0.8, 0],
  ['M110', 120.7, 2.69, 0, 1.4, 0],
  ['Leo A', 196.9, 2.6, 0, 0.6, 0],
  ['WLM', 75.9, 3.0, 0, 1.1, 0],
  ['Pegasus Dwarf', 94.8, 3.0, 0, 0.7, 0],
  ['Draco', 86.4, 0.26, 0, 0.5, 0],
  ['Ursa Minor', 105, 0.22, 0, 0.5, 0],
];

/** A hundred million years a second. */
export class LocalGroup {
  constructor() {
    const r = rng(41);
    this.b = MEMBERS.map(([name, l, d, m, rad, tilt]) => {
      const a = (l * Math.PI) / 180, dk = d * MLY;
      return { name, x: SUN_R + dk * Math.cos(a), y: -dk * Math.sin(a), vx: 0, vy: 0, m, rad, tilt, spin: r() * Math.PI, arms: r() < 0.5 ? 1 : -1 };
    });
    const mw = this.b[0], m31 = this.b[1];
    // Andromeda: 110 km/s towards us, and a little sideways.
    const dx = m31.x - mw.x, dy = m31.y - mw.y, d = Math.hypot(dx, dy);
    m31.vx = (-110 * dx / d - 57 * dy / d) * KMS;
    m31.vy = (-110 * dy / d + 57 * dx / d) * KMS;
    // Everyone else roughly on an orbit round the nearer of the two big ones.
    for (const s of this.b.slice(2)) {
      const host = Math.hypot(s.x - mw.x, s.y - mw.y) < Math.hypot(s.x - m31.x, s.y - m31.y) ? mw : m31;
      const ex = s.x - host.x, ey = s.y - host.y, e = Math.hypot(ex, ey) || 1;
      const v = Math.sqrt((G_KPC * host.m) / Math.sqrt(e * e + 400)) * 0.8;
      s.vx = host.vx - (v * ey) / e + gauss(r) * v * 0.1;
      s.vy = host.vy + (v * ex) / e + gauss(r) * v * 0.1;
    }
  }

  /** dt in Myr. */
  step(dt) {
    const steps = Math.ceil(dt / 2), h = dt / steps, B = this.b;
    for (let s = 0; s < steps; s++) {
      for (const p of B) {
        let ax = 0, ay = 0;
        for (const q of B) {
          if (q === p || !q.m) continue;
          const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy + 30 * 30; // softened: they're not points
          const k = (G_KPC * q.m) / (d2 * Math.sqrt(d2));
          ax += dx * k; ay += dy * k;
        }
        p.vx += ax * h; p.vy += ay * h;
      }
      for (const p of B) { p.x += p.vx * h; p.y += p.vy * h; }
    }
  }

  paint(P, V, f) {
    const mw = this.b[0];
    // The big ones' halos of dark matter, which is most of their mass and none of their light.
    for (const [g, R] of [[this.b[0], 290], [this.b[1], 300], [this.b[2], 120]]) {
      P.ring((g.x - mw.x + SUN_R) * KPC, (g.y - mw.y) * KPC, R * KPC, { size: 0.5, tone: 0.35, f }, 3);
    }
    for (const g of this.b) {
      // Kept where the Milky Way is: we ride along with it.
      const x = (g.x - mw.x + SUN_R) * KPC, y = (g.y - mw.y) * KPC, R = g.rad * KPC;
      this.galaxy(P, V, x, y, R, g, f);
    }
  }

  /** A galaxy, as a disc of dots thick in the middle, with two arms if it's a big one. */
  galaxy(P, V, x, y, R, g, f) {
    const Rc = (R * V.ppm) / V.cell;
    if (Rc < 1.2) { P.dot(x, y, { size: Rc > 0.5 ? 1 : 0.5, tone: 0.9, f }); return; }
    const ci = P.u(x), cj = P.v(y);
    const i0 = Math.max(0, Math.floor(ci - Rc)), i1 = Math.min(V.cols - 1, Math.floor(ci + Rc));
    const j0 = Math.max(0, Math.floor(cj - Rc)), j1 = Math.min(V.rows - 1, Math.floor(cj + Rc));
    const ca = Math.cos(g.spin), sa = Math.sin(g.spin), sq = 1 - g.tilt * 0.8;
    const spiral = g.rad > 5;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        let u = (i + 0.5 - ci) / Rc, v = (j + 0.5 - cj) / Rc;
        [u, v] = [u * ca + v * sa, (-u * sa + v * ca) / sq];
        const rr = Math.hypot(u, v);
        if (rr > 1) continue;
        let d = Math.exp(-rr * 3.2);
        if (spiral && rr > 0.12) d *= 0.45 + 0.9 * Math.max(0, Math.cos(2 * Math.atan2(v, u) - g.arms * 5 * Math.log(rr)));
        const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
        if ((h % 1000) / 1000 > d * 2.2) continue;
        P.G.put(i, j, d > 0.5 ? 1 : d > 0.25 ? 0.75 : 0.5, 0, 0.55 + 0.45 * Math.min(1, d * 2), f);
      }
    }
  }
}

// ---------------------------------------------------------------- the cosmic web

const MPC = 1e3 * KPC;
const BOX = 400 * MPC; // one box of the web
const N = 128; // galaxies a side in it (each dot a group of them, really)
const WEB_SQUEEZE = 1.4; // more and the galaxies sail through the filaments, which is where Zel'dovich's approximation gives out
const BINS = 64; // the box's crowding, from far off
export const R_OBS = 4.4e26; // the observable universe's radius, m (46.5 billion light years)

/** In place, radix 2: re and im of length n (a power of two). */
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** A 2D inverse FFT of an n × n complex grid (row-major), real part returned. */
function ifft2(re, im, n) {
  const r = new Float64Array(n), i = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    r.set(re.subarray(y * n, y * n + n)); i.set(im.subarray(y * n, y * n + n));
    fft(r, i, true);
    re.set(r, y * n); im.set(i, y * n);
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { r[y] = re[y * n + x]; i[y] = im[y * n + x]; }
    fft(r, i, true);
    for (let y = 0; y < n; y++) { re[y * n + x] = r[y]; im[y * n + x] = i[y]; }
  }
  return re;
}

/**
 * One box of the web, its galaxies on a grid at the start, each moved along
 * the gradient of a Gaussian random potential as the growth factor D goes
 * from almost nothing to today. Beyond the box it repeats, each copy turned
 * or flipped so the repeats don't line up.
 */
export class Web {
  constructor() {
    const r = rng(57), n = N;
    const re = new Float64Array(n * n), im = new Float64Array(n * n);
    const px = [new Float64Array(n * n), new Float64Array(n * n)];
    // The potential's spectrum: steep, with small scales cut off.
    const phase = Array.from({ length: n * n }, () => [gauss(r), gauss(r)]);
    for (const [axis, out] of [[0, px[0]], [1, px[1]]]) {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const kx = x <= n / 2 ? x : x - n, ky = y <= n / 2 ? y : y - n, k = Math.hypot(kx, ky);
          const o = y * n + x;
          if (!k || k > 48) { re[o] = im[o] = 0; continue; }
          const amp = Math.pow(k, -1.9) * Math.exp(-(k * k) / 500), [a, b] = phase[o];
          const kk = axis === 0 ? kx : ky; // ψ = −∇Φ: i·k·Φ
          re[o] = -b * amp * kk; im[o] = a * amp * kk;
        }
      }
      out.set(ifft2(re, im, n));
    }
    // Scaled by how much it squeezes (the divergence of ψ, in grid steps) so
    // that today the galaxies have crossed into filaments and knots.
    let rms = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dv = px[0][y * n + ((x + 1) % n)] - px[0][y * n + x] + px[1][((y + 1) % n) * n + x] - px[1][y * n + x];
      rms += dv * dv;
    }
    rms = Math.sqrt(rms / (n * n));
    const s = (WEB_SQUEEZE * (BOX / n)) / rms;
    this.psi = px.map((a) => a.map((v) => v * s));
    this.D = 0.3;
    this.counts = new Uint16Array(BINS * BINS);
    this.bin();
  }

  /** Grow: D from almost nothing to today over about twelve seconds, then it stays. */
  step(dt) {
    if (this.D >= 1) return false;
    this.D = Math.min(1, this.D + dt / 14);
    this.bin();
    return true;
  }

  /** Where galaxy k is in the box now, m. */
  at(k) {
    const q = BOX / N, x = (k % N + 0.5) * q, y = (Math.floor(k / N) + 0.5) * q;
    return [((x + this.D * this.psi[0][k]) % BOX + BOX) % BOX, ((y + this.D * this.psi[1][k]) % BOX + BOX) % BOX];
  }

  /** How many galaxies in each bin of the box, for drawing it from far off. */
  bin() {
    const c = this.counts;
    c.fill(0);
    this.X ||= new Float64Array(N * N);
    this.Y ||= new Float64Array(N * N);
    for (let k = 0; k < N * N; k++) {
      const [x, y] = this.at(k);
      this.X[k] = x / BOX; this.Y[k] = y / BOX;
      c[Math.min(BINS - 1, Math.floor((y / BOX) * BINS)) * BINS + Math.min(BINS - 1, Math.floor((x / BOX) * BINS))]++;
    }
    // Averaged down by halves, so from further off each block sees the average of what's in it.
    const mean = (N * N) / (BINS * BINS);
    let res = BINS, lvl = Float32Array.from(c, (v) => v / mean);
    this.mips = { [res]: lvl };
    while (res > 2) {
      const h = res / 2, nx = new Float32Array(h * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
        nx[y * h + x] = (lvl[2 * y * res + 2 * x] + lvl[2 * y * res + 2 * x + 1] + lvl[(2 * y + 1) * res + 2 * x] + lvl[(2 * y + 1) * res + 2 * x + 1]) / 4;
      }
      res = h; lvl = nx; this.mips[res] = lvl;
    }
  }

  /** A copy of the box at tile (tx, ty): one of the eight ways to turn or flip it. */
  static sym(tx, ty) { return ((Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0) % 8; }
  static apply(s, u, v) {
    if (s & 1) u = 1 - u;
    if (s & 2) v = 1 - v;
    return s & 4 ? [v, u] : [u, v];
  }

  /** Cached: it only changes while it grows, or the zoom moves. */
  paint(P, V, f) {
    cached(this, `${V.ppm}|${V.cell}|${this.D}|${Math.round(f * 20)}`, P, (Q) => this.draw(Q, V, Math.round(f * 20) / 20));
  }

  draw(P, V, f) {
    const m = V.cell / V.ppm; // metres a block
    const G = P.G, cols = V.cols, rows = V.rows;
    const edge = (R_OBS * V.ppm) / V.cell, ci = V.cx / V.cell, cj = V.cy / V.cell;
    if (m < (BOX / N) * 1.2) {
      // Close up: the galaxies themselves, counted into blocks.
      const cnt = this.cnt && this.cnt.length === cols * rows ? this.cnt : (this.cnt = new Uint8Array(cols * rows));
      cnt.fill(0);
      const x0 = -V.cx / V.ppm, y0 = -V.cy / V.ppm, x1 = x0 + cols * m, y1 = y0 + rows * m;
      for (let ty = Math.floor(y0 / BOX); ty * BOX < y1; ty++) {
        for (let tx = Math.floor(x0 / BOX); tx * BOX < x1; tx++) {
          const s = Web.sym(tx, ty), X = this.X, Y = this.Y;
          const ox = (V.cx + tx * BOX * V.ppm) / V.cell, oy = (V.cy + ty * BOX * V.ppm) / V.cell, sc = (BOX * V.ppm) / V.cell;
          for (let k = 0; k < N * N; k++) {
            let u = X[k], v = Y[k];
            if (s & 1) u = 1 - u;
            if (s & 2) v = 1 - v;
            if (s & 4) [u, v] = [v, u];
            const i = Math.floor(ox + u * sc), j = Math.floor(oy + v * sc);
            if (i >= 0 && j >= 0 && i < cols && j < rows && cnt[j * cols + i] < 255) cnt[j * cols + i]++;
          }
        }
      }
      for (let k = 0; k < cnt.length; k++) {
        const c = cnt[k];
        if (c) G.put(k % cols, Math.floor(k / cols), c > 3 ? 1 : c > 1 ? 0.75 : 0.5, 0, Math.min(1, 0.55 + c * 0.12), f);
      }
      return;
    }
    // Far off: how crowded each bit of the box is, inside the observable universe.
    const per = (BOX * V.ppm) / V.cell; // blocks a box
    let res = BINS;
    while (res > 2 && res > per) res /= 2;
    const map = this.mips[res];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const di = i + 0.5 - ci, dj = j + 0.5 - cj;
        if (di * di + dj * dj > edge * edge) continue;
        const x = ((i + 0.5) * V.cell - V.cx) / V.ppm / BOX, y = ((j + 0.5) * V.cell - V.cy) / V.ppm / BOX;
        const tx = Math.floor(x), ty = Math.floor(y), sy = Web.sym(tx, ty);
        let u = x - tx, v = y - ty;
        if (sy & 1) u = 1 - u;
        if (sy & 2) v = 1 - v;
        if (sy & 4) { const w = u; u = v; v = w; }
        const c = map[Math.min(res - 1, (v * res) | 0) * res + Math.min(res - 1, (u * res) | 0)];
        // Averaged over more, the contrast fades: on the largest scales the universe is smooth, and so is this.
        const k = c;
        if (k > 0.85) G.put(i, j, k > 3 ? 1 : k > 1.8 ? 0.75 : k > 1.2 ? 0.5 : 0.25, 0, Math.min(1, 0.4 + k * 0.15), f);
      }
    }
  }

  /** The edge of what we can see: the microwave background, the oldest light there is, red-shifted past red. */
  edge(P, V, f) {
    P.ring(0, 0, R_OBS, { colour: 1, f }, 1);
    P.ring(0, 0, R_OBS * 1.02, { colour: 1, size: 0.5, f }, 3);
  }
}

// ---------------------------------------------------------------- the web, in 3D

const N3 = 64; // galaxies a side in the 3D box (262,144 of them)
const B3 = 32; // its crowding, binned

/** A 3D inverse FFT of an n³ complex grid (x fastest), real part returned. */
function ifft3(re, im, n) {
  const r = new Float64Array(n), i = new Float64Array(n), n2 = n * n;
  for (const [stride, outer] of [[1, (a, b) => a * n + b * n2], [n, (a, b) => a + b * n2], [n2, (a, b) => a + b * n]]) {
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const o = outer(a, b);
      for (let k = 0; k < n; k++) { r[k] = re[o + k * stride]; i[k] = im[o + k * stride]; }
      fft(r, i, true);
      for (let k = 0; k < n; k++) { re[o + k * stride] = r[k]; im[o + k * stride] = i[k]; }
    }
  }
  return re;
}

/**
 * The web for the 3D view: the same Zel'dovich approximation as Web, in a
 * box of 64³ galaxies, so its sheets, filaments and voids are 3D and you can
 * go round them. Close up, every galaxy; from further off, how crowded each
 * bit of space is, in cubes that grow with the view so there are never more
 * than some tens of thousands. Beyond the box it repeats, each copy turned
 * or flipped (one of 48 ways). It reaches out to the edge of what we can see,
 * the microwave background, a sphere.
 */
export class Web3 {
  constructor() {
    const r = rng(61), n = N3, n3 = n * n * n;
    const phase = Array.from({ length: n3 }, () => [gauss(r), gauss(r)]);
    const psi = [];
    for (let axis = 0; axis < 3; axis++) {
      const re = new Float64Array(n3), im = new Float64Array(n3);
      for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const f = (v) => (v <= n / 2 ? v : v - n), kx = f(x), ky = f(y), kz = f(z), k = Math.hypot(kx, ky, kz), o = (z * n + y) * n + x;
        if (!k || k > 26) continue;
        const amp = Math.pow(k, -2.4) * Math.exp(-(k * k) / 170), [a, b] = phase[o], kk = [kx, ky, kz][axis]; // ψ = −∇Φ
        re[o] = -b * amp * kk; im[o] = a * amp * kk;
      }
      psi.push(ifft3(re, im, n));
    }
    // Scaled by how much it squeezes, as Web does, so that today it has crossed into sheets and filaments.
    let rms = 0;
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const o = (z * n + y) * n + x;
      const dv = psi[0][(z * n + y) * n + ((x + 1) % n)] - psi[0][o] + psi[1][(z * n + ((y + 1) % n)) * n + x] - psi[1][o] + psi[2][(((z + 1) % n) * n + y) * n + x] - psi[2][o];
      rms += dv * dv;
    }
    rms = Math.sqrt(rms / n3);
    const sc = (WEB_SQUEEZE * 0.8) / (n * rms); // in boxes
    this.psi = psi.map((a) => Float32Array.from(a, (v) => v * sc));
    this.P = [new Float32Array(n3), new Float32Array(n3), new Float32Array(n3)];
    this.D = 0.3;
    this.place();
  }

  /** Grow, as Web does. */
  step(dt) {
    if (this.D >= 1) return false;
    this.D = Math.min(1, this.D + dt / 14);
    this.place();
    return true;
  }

  /** Where every galaxy is now (in boxes, 0-1), and how crowded each bin is, averaged down by halves. */
  place() {
    const n = N3, [X, Y, Z] = this.P, c = new Float32Array(B3 * B3 * B3);
    const wrap = (v) => v - Math.floor(v);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const o = (z * n + y) * n + x;
      X[o] = wrap((x + 0.5) / n + this.D * this.psi[0][o]);
      Y[o] = wrap((y + 0.5) / n + this.D * this.psi[1][o]);
      Z[o] = wrap((z + 0.5) / n + this.D * this.psi[2][o]);
      c[((Math.min(B3 - 1, (Z[o] * B3) | 0) * B3) + Math.min(B3 - 1, (Y[o] * B3) | 0)) * B3 + Math.min(B3 - 1, (X[o] * B3) | 0)]++;
    }
    const mean = (n * n * n) / (B3 * B3 * B3);
    let res = B3, lvl = c.map((v) => v / mean);
    this.mips = { [res]: lvl };
    while (res > 1) {
      const h = res / 2, nx = new Float32Array(h * h * h);
      for (let z = 0; z < h; z++) for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
        let sum = 0;
        for (let d = 0; d < 8; d++) sum += lvl[((2 * z + (d >> 2)) * res + 2 * y + ((d >> 1) & 1)) * res + 2 * x + (d & 1)];
        nx[(z * h + y) * h + x] = sum / 8;
      }
      res = h; lvl = nx; this.mips[res] = lvl;
    }
  }

  /** A copy of the box at tile (tx, ty, tz): one of 48 turns and flips. Returns [u, v, w] in the copy for [u, v, w] in the box. */
  static sym(tx, ty, tz) { return ((Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663) ^ Math.imul(tz, 83492791)) >>> 0) % 48; }
  static apply(s, u, v, w) {
    if (s & 1) u = 1 - u;
    if (s & 2) v = 1 - v;
    if (s & 4) w = 1 - w;
    switch ((s >> 3) % 6) {
      case 1: return [v, u, w];
      case 2: return [w, v, u];
      case 3: return [u, w, v];
      case 4: return [v, w, u];
      case 5: return [w, u, v];
      default: return [u, v, w];
    }
  }

  /** In the 3D view (P.S), round "here", out to the view's reach or the edge of what we can see. */
  paint(P, V, f) {
    const reach = Math.min(R_OBS, Math.hypot(V.cols, V.rows) * V.cell * 0.5 / V.ppm), cell = V.cell / V.ppm;
    if (reach < 0.33 * BOX) { // close up: the galaxies themselves (some tens of thousands in reach)
      const [X, Y, Z] = this.P, t0 = Math.floor(-reach / BOX), t1 = Math.floor(reach / BOX), r2 = reach * reach;
      const size = Math.max(0.5, Math.min(1, (BOX / N3 / 6) / cell));
      for (let tz = t0; tz <= t1; tz++) for (let ty = t0; ty <= t1; ty++) for (let tx = t0; tx <= t1; tx++) {
        const s = Web3.sym(tx, ty, tz);
        for (let k = 0; k < X.length; k++) {
          const [u, v, w] = Web3.apply(s, X[k], Y[k], Z[k]);
          const x = (tx + u) * BOX, y = (ty + v) * BOX, z = (tz + w) * BOX;
          if (x * x + y * y + z * z < r2) P.dot3(x, y, z, { size, tone: 0.8, f });
        }
      }
      return;
    }
    // Further off: galaxies scattered by how crowded each bit of space is (a few to a crowded bit, none in a
    // void), at fixed spots, about 24 bits across the view's reach, so it reads the same at every scale.
    const step = Math.max(reach / 24, BOX / B3 / 2);
    let res = B3;
    while (res > 1 && BOX / res < step * 0.99) res /= 2;
    const map = this.mips[res], m = Math.ceil(reach / step), size = 0.75;
    const hash = (a, b, c, d) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647) ^ Math.imul(d, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    for (let k = -m; k <= m; k++) for (let j = -m; j <= m; j++) for (let i = -m; i <= m; i++) {
      const x = i * step, y = j * step, z = k * step;
      if (x * x + y * y + z * z > reach * reach) continue;
      const bx = x / BOX, by = y / BOX, bz = z / BOX, tx = Math.floor(bx), ty = Math.floor(by), tz = Math.floor(bz);
      const [u, v, w] = Web3.apply(Web3.sym(tx, ty, tz), bx - tx, by - ty, bz - tz);
      const c = map[(Math.min(res - 1, (w * res) | 0) * res + Math.min(res - 1, (v * res) | 0)) * res + Math.min(res - 1, (u * res) | 0)];
      // Averaged over more, the contrast fades: on the largest scales the universe is smooth (and sparse here).
      const count = Math.floor(Math.pow(Math.max(0, c - 0.9), 1.7) * 1.0 + hash(i, j, k, 7));
      for (let g = 0; g < Math.min(count, 6); g++) {
        const ox = (hash(i, j, k, 3 * g + 11) - 0.5) * step, oy = (hash(i, j, k, 3 * g + 12) - 0.5) * step, oz = (hash(i, j, k, 3 * g + 13) - 0.5) * step;
        P.dot3(x + ox, y + oy, z + oz, { size, tone: Math.min(1, 0.45 + c * 0.12), f });
      }
    }
  }

  /** The edge of what we can see, the microwave background: a sphere. */
  edge(P, V, f) {
    const rc = (R_OBS * V.ppm) / V.cell, n = Math.min(4000, Math.max(60, Math.ceil(4 * Math.PI * rc * rc / 6)));
    for (let k = 0; k < n; k++) {
      const z = 1 - (2 * (k + 0.5)) / n, s = Math.sqrt(1 - z * z), a = k * 2.39996;
      P.dot3(R_OBS * s * Math.cos(a), R_OBS * s * Math.sin(a), R_OBS * z, { colour: 1, f });
    }
  }
}

// ---------------------------------------------------------------- bubbles

/**
 * Eternal inflation, as a toy: a false vacuum inflating at a constant rate,
 * with bubbles of true vacuum (universes) nucleating at random in what's
 * left of it. In comoving coordinates a bubble's wall grows towards a size
 * that shrinks the later it nucleates, so later bubbles are smaller and fill
 * the gaps between the earlier ones, and the foam never fills up. Ours is the
 * big one in the middle, with the observable universe a speck inside it.
 */
export class Bubbles {
  constructor() {
    this.r = rng(77);
    this.span = 3e30; // m either side
    this.ours = { x: -2.4e28, y: 1.1e28, R: 3.2e28, t0: -1, r: 3.2e28 };
    this.b = [this.ours];
    this.time = 0;
  }

  /** dt in seconds of the page. */
  step(dt) {
    this.time += dt;
    const H = 0.18, r = this.r;
    for (const b of this.b) if (b.r < b.R) b.r = b.R * Math.min(1, (this.time - b.t0) / 2.5) ** 0.7;
    if (this.b.length > 340) return;
    for (let n = 0; n < 2; n++) {
      if (r() > dt * 24) continue;
      const x = (r() * 2 - 1) * this.span, y = (r() * 2 - 1) * this.span * 0.7;
      // Only in the false vacuum: not inside a bubble that's already there.
      if (this.b.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < (q.R * 1.05) ** 2)) continue;
      const R = 9e29 * Math.exp(-H * this.time) * (0.4 + r() * 0.8);
      if (R < 3e27) continue;
      this.b.push({ x, y, R, t0: this.time, r: 0 });
    }
  }

  paint(P, V, f) {
    for (const b of this.b) {
      if (b.r <= 0) continue;
      P.ring(b.x, b.y, b.r, { size: 0.75, tone: b === this.ours ? 1 : 0.75, f }, 1);
      const Rc = (b.r * V.ppm) / V.cell;
      if (Rc > 2 && Rc < 160) this.fill(P, V, b, Rc, f);
    }
    // Inside ours, where it's bigger than the screen: a faint texture of everything in it.
    const Ro = (this.ours.r * V.ppm) / V.cell;
    if (Ro >= 160) {
      const ci = P.u(this.ours.x), cj = P.v(this.ours.y);
      for (let j = 0; j < V.rows; j++) for (let i = 0; i < V.cols; i++) {
        if ((i * 7 + j * 3) % 11 || (i - ci) ** 2 + (j - cj) ** 2 > Ro * Ro) continue;
        P.G.put(i, j, 0.25, 0, 0.35, f);
      }
    }
    // The observable universe, a speck in ours.
    P.ring(0, 0, R_OBS, { colour: 1, f }, 1);
  }

  fill(P, V, b, Rc, f) {
    const ci = P.u(b.x), cj = P.v(b.y);
    const i0 = Math.max(0, Math.floor(ci - Rc)), i1 = Math.min(V.cols - 1, Math.floor(ci + Rc));
    const j0 = Math.max(0, Math.floor(cj - Rc)), j1 = Math.min(V.rows - 1, Math.floor(cj + Rc));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if ((i * 7 + j * 3) % 11 || (i - ci) ** 2 + (j - cj) ** 2 > Rc * Rc) continue;
      P.G.put(i, j, 0.25, 0, 0.35, f);
    }
  }
}
