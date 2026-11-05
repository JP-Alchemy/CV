// Powers of Ten, two of the small scales: the screen's own pixels, under the
// block the zoom goes into, and a strand of DNA among the bacterium's
// proteins. Everything in metres about "here", the middle of the view.

import { rng } from './scenes.js';

const NM = 1e-9;
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const RGB = [1, 4, 6]; // red, green and blue, from the spectrum

// ---------------------------------------------------------------- pixels

/**
 * The pixels under the block: each one three lights side by side, red,
 * green and blue, the way most laptop screens have them (a phone's are often
 * laid out differently). Where the screen shows the paper they're all on;
 * where it shows the ink they're all off (or the other way round in the dark
 * theme). Between them, the black that every screen is up close. Once the
 * page has gone, the view slides to the block's corner, so both show.
 */
export class Pixels {
  /** o: { pitch (m a pixel), block (m), dark, slide (0-1) } */
  paint(P, V, f, o) {
    const p = o.pitch, b = o.block, m = P.m;
    const sw = p / 3;
    // Too small to tell apart: leave it to the page.
    f *= Math.max(0, Math.min(1, (sw / m) - 0.8));
    if (f <= 0) return;
    const c = (o.slide * o.slide * (3 - 2 * o.slide)) * b * 0.5;
    const X0 = -b / 2 + c, Y0 = -b / 2 + c; // the block's top-left corner
    const xl = -V.cx / V.ppm, yt = -V.cy / V.ppm, xr = xl + V.cols * m, yb = yt + V.rows * m;
    const i0 = Math.floor((xl - X0) / p) - 1, i1 = Math.ceil((xr - X0) / p);
    const j0 = Math.floor((yt - Y0) / p) - 1, j1 = Math.ceil((yb - Y0) / p);
    if ((i1 - i0) * (j1 - j0) > 40000) return;
    const gx = sw * 0.14, gy = p * 0.07;
    const n = Math.round(b / p); // the block, in whole pixels
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const ink = i >= 0 && j >= 0 && i < n && j < n;
        const lit = o.dark ? ink : !ink;
        if (!lit) continue;
        const x = X0 + i * p, y = Y0 + j * p;
        for (let k = 0; k < 3; k++) P.rect(x + k * sw + gx, y + gy, x + (k + 1) * sw - gx - m * 0.01, y + p - gy - m * 0.01, { colour: RGB[k], f });
      }
    }
    // The black between and behind them. In the dark theme that's the paper already.
    if (!o.dark) P.rect(xl, yt, xr, yb, { tone: 1, f });
  }
}

// ---------------------------------------------------------------- DNA

const RISE = 0.34 * NM; // between base pairs
const TURN = 3.4 * NM; // a turn of the helix, about 10 base pairs
const HELIX_R = 1.0 * NM;
const GROOVE = 0.38; // of a turn: the second strand's lag (the minor groove)
const TILE = 400 * NM; // the strand repeats this far along
const MODES = 5;

/**
 * A strand of the bacterium's DNA, 2 nm wide, running through the middle:
 * two backbones round each other a turn every ten base pairs, the pairs
 * between them, bent about by the same knocks the proteins get (each bending
 * mode an Ornstein–Uhlenbeck process, the long ones slower and bigger, about
 * right for DNA's stiffness). An RNA polymerase sits on it copying a gene
 * into RNA, which trails off. It copies about 50 letters a second; a million
 * times slower, as everything is here, it doesn't seem to move at all.
 */
export class Dna {
  constructor() {
    const r = this.r = rng(17);
    this.modes = Array.from({ length: MODES }, (_, k) => {
      const q = k + 1;
      return { q, amp: 14 * NM / (q * q), tau: 4 / (q * q), a: gauss(r) * 14 * NM / (q * q), b: gauss(r) * 14 * NM / (q * q) };
    });
    // The RNA: a floppy chain off the polymerase, each link a random turn.
    this.rna = Array.from({ length: 70 }, () => gauss(r) * 0.6);
    this.wob = new Float64Array(70);
    this.pol = 30 * NM; // where the polymerase is along the strand
  }

  step(dt) {
    const r = this.r;
    for (const M of this.modes) {
      const k = Math.exp(-dt / M.tau), s = M.amp * Math.sqrt(1 - k * k);
      M.a = M.a * k + gauss(r) * s;
      M.b = M.b * k + gauss(r) * s;
    }
    for (let i = 0; i < this.wob.length; i++) this.wob[i] = this.wob[i] * Math.exp(-dt) + gauss(r) * 0.5 * Math.sqrt(dt);
  }

  /** The strand's middle across, at x along. */
  y(x) {
    let s = 0;
    for (const M of this.modes) {
      const w = (2 * Math.PI * M.q) / TILE;
      s += M.a * Math.sin(w * x) + M.b * (Math.cos(w * x) - 1); // through the middle at x = 0
    }
    return s;
  }

  paint(P, V, f, inside) {
    const m = P.m, xl = -V.cx / V.ppm, xr = xl + V.cols * m;
    const put = (x, y, size, tone) => {
      const i = P.i(x), j = P.j(y);
      if (inside(i, j)) P.G.put(i, j, size, 0, tone, f);
    };
    const wide = (2 * HELIX_R) / m; // cells across
    const step = Math.min(RISE / 3, m * 0.5);
    if (wide < 2.5) {
      // From afar, one thread.
      for (let x = xl; x <= xr; x += step) put(x, this.y(x), wide < 0.6 ? 0.5 : 1, 0.9);
    } else {
      const open = (x) => Math.max(0, 1 - Math.abs(x - this.pol) / (2.2 * NM)); // the bubble the polymerase opens
      for (let x = xl; x <= xr; x += step) {
        const c = this.y(x), th = (2 * Math.PI * x) / TURN, o = 1 + open(x) * 1.6;
        put(x, c + HELIX_R * o * Math.sin(th), 1, 1);
        put(x, c + HELIX_R * o * Math.sin(th + GROOVE * 2 * Math.PI), 1, 0.8);
      }
      // The base pairs, once they're far enough apart to see.
      if (RISE / m > 1.2) {
        for (let n = Math.floor(xl / RISE); n * RISE <= xr; n++) {
          const x = n * RISE;
          if (open(x) > 0.3) continue; // apart, being read
          const c = this.y(x), th = (2 * Math.PI * x) / TURN;
          const a = c + HELIX_R * Math.sin(th), b = c + HELIX_R * Math.sin(th + GROOVE * 2 * Math.PI);
          for (let y = Math.min(a, b); y <= Math.max(a, b); y += m * 0.5) put(x, y, 0.5, 0.55);
        }
      }
    }
    // The polymerase, about 10 nm across, and the RNA coming off it.
    const px = this.pol, py = this.y(px), R = 5.5 * NM;
    if (R / m > 1.5) {
      const j0 = Math.max(0, P.j(py - R)), j1 = Math.min(V.rows - 1, P.j(py + R));
      const i0 = Math.max(0, P.i(px - R)), i1 = Math.min(V.cols - 1, P.i(px + R));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = ((i + 0.5) * V.cell - V.cx) / V.ppm - px, dy = ((j + 0.5) * V.cell - V.cy) / V.ppm - py;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > R || !inside(i, j)) continue;
          if (d > R - Math.max(m, R * 0.12)) P.G.put(i, j, 1, 0, 0.9, f);
          else if (((i + j) & 1) === 0) P.G.put(i, j, 0.5, 0, 0.5, f);
        }
      }
      let x = px, y = py - R, a = -Math.PI / 2;
      for (let k = 0; k < this.rna.length; k++) {
        a += (this.rna[k] + this.wob[k]) * 0.5;
        const nx = x + Math.cos(a) * 0.6 * NM, ny = y + Math.sin(a) * 0.6 * NM;
        for (let s = 0; s <= 1; s += Math.min(1, m / (0.6 * NM) * 0.5)) put(x + (nx - x) * s, y + (ny - y) * s, 0.75, 0.7);
        x = nx; y = ny;
      }
    } else put(px, py, 1, 1);
  }
}
