// Powers of Ten, the quantum end: the live half of the page. The electron's
// wave is solved on the GPU (quantum/solver.js) and drawn under the page's
// blocks by the renderer (FS_QUANTUM); here is when electrons are fired,
// where they land, and what happens when you look for one.
//
// Where an electron lands is decided the way the equation says: each frame
// the solver reports how much of the wave the screen (and everything else)
// has absorbed so far. Each electron draws a random number u when it's
// fired; when the absorbed total passes u, it has landed, on the screen or
// not in proportion to what each took in that frame, and on the row picked
// in proportion to what each row of the screen took. So the dots build up
// exactly the distribution |ψ|² sends to the screen, one at a time.

import { NX, NY, DT, GEO, SCREEN_X, Solver, floatFormat } from './solver.js';

/** The seven energies, red to violet: the wavevector, in radians a cell. */
export const KS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
export const CELL_NM = 0.05; // one grid cell, in nanometres
const T_FS = 9.109e-31 * (CELL_NM * 1e-9) ** 2 / 1.0546e-34 * 1e15; // the time unit (m·dx²/ħ) in fs
/** λ = 2π/k; E = h²/2mλ² = 1.504 eV·nm² / λ². */
export const electronVolts = (k) => 1.504 / ((2 * Math.PI / k) * CELL_NM) ** 2;

const SPEEDS = { watch: 6, fast: 64 }; // steps a frame
const SIGMA = [8, 10]; // the packet's widths, along and across
const LOOK = 4; // a look's window, σ in cells
const FLASH = 8;
const HIT_COLS = GEO.screen - 4; // dots stay off the screen's back edge

export class Quantum {
  /** host: { renderer, now, changed, scene, kick, calm, viewport } */
  constructor(host) {
    this.host = host;
    this.on = false;
    this.hidden = false;
    this.slits = 2;
    this.energy = 3;
    this.speed = 'watch';
    this.auto = true;
    this.gunY = NY / 2;
    this.flashes = [];
    this.reset();
  }

  reset() {
    this.hits = new Uint8Array(HIT_COLS * NY * 4);
    this.rowHits = new Uint32Array(NY);
    this.count = { fired: 0, hit: 0, stopped: 0, looked: 0 };
    this.hitsDirty = true;
    this.flashes = [];
    this.note = null;
  }

  /** Arriving: build the solver if this GPU can run it. */
  open() {
    if (this.on) return;
    this.on = true;
    this.hidden = false;
    this.arrive = Infinity;
    this.auto = !this.host.calm?.();
    const gl = this.host.renderer.gl;
    if (this.solver === undefined) {
      this.solver = null;
      try {
        const fmt = gl && floatFormat(gl);
        if (fmt) {
          const s = new Solver(gl, fmt);
          if (s.ok) this.solver = s;
        }
      } catch (err) {
        console.warn('No quantum solver:', err);
      }
    }
    this.supported = !!this.solver;
    if (this.solver) {
      this.solver.setSlits(this.slits);
      this.solver.clear();
    }
    this.electron = null;
    this.nextFire = 0;
  }

  close() {
    if (!this.on) return;
    this.on = false;
    this.electron = null;
    this.solver?.drop();
    this.host.renderer.clearQuantum?.();
  }

  hide(on) {
    this.hidden = on;
    this.arrive = Infinity;
    if (on) this.host.renderer.clearQuantum?.();
    else this.hitsDirty = true;
  }

  arriveAt(t) { this.arrive = Math.min(this.arrive, t); }

  /** The page's numbers, a few times a second at most. */
  tell(now = false) {
    const t = this.host.now();
    if (!now && t - (this.told || 0) < 0.4) return;
    this.told = t;
    this.host.changed();
  }

  view() {
    return {
      supported: this.supported, slits: this.slits, energy: this.energy, eV: electronVolts(KS[this.energy]),
      speed: this.speed, auto: this.auto, flying: !!this.electron, note: this.note, ...this.count,
      fs: this.electron ? this.electron.t * T_FS : 0,
    };
  }

  // ------------------------------------------------------------ electrons

  fire() {
    if (!this.solver) return;
    const { barrier, gunX, edge } = GEO;
    const gy = Math.max(edge + 14, Math.min(NY - edge - 14, this.gunY));
    this.gunY = gy;
    const th = Math.atan2(NY / 2 - gy, barrier - gunX); // aimed at the middle of the plate
    const k = KS[this.energy];
    this.solver.fire(gunX, gy, k * Math.cos(th), k * Math.sin(th), SIGMA[0], SIGMA[1]);
    this.electron = { u: Math.random(), t: 0, prev: null, colour: this.energy };
    this.count.fired++;
    this.tell(true);
  }

  /** Done with this electron: the field is wiped and the next one waits a moment. */
  finish() {
    this.electron = null;
    this.solver.clear();
    this.nextFire = this.host.now() + (this.speed === 'fast' ? 0.05 : 0.5);
    this.tell();
  }

  /** It landed on the screen, on row y. */
  land(y) {
    // A dot is two cells square, on even cells, somewhere across the screen's depth.
    const yy = y & ~1;
    let x = 0;
    for (let tries = 0; tries < 8; tries++) {
      x = Math.floor((Math.random() * HIT_COLS) / 2) * 2;
      if (!this.hits[(yy * HIT_COLS + x) * 4]) break;
    }
    this.hits[(yy * HIT_COLS + x) * 4] = 255;
    this.hitsDirty = true;
    this.rowHits[y]++;
    this.count.hit++;
    if (!this.host.calm?.()) {
      this.flashes.push({ x: SCREEN_X + x + 1, y: yy + 1, t: this.host.now(), c: this.electron.colour });
      if (this.flashes.length > FLASH) this.flashes.shift();
    }
  }

  /** What the solver says has been absorbed so far; decides if the electron has landed. */
  absorbed(rows) {
    const e = this.electron, n0 = this.solver.norm0;
    let S = 0, L = 0, flight = 0, peak = 0;
    for (let y = 0; y < NY; y++) {
      S += rows[y * 4];
      L += rows[y * 4 + 1];
      flight += rows[y * 4 + 2];
      peak = Math.max(peak, rows[y * 4 + 3]);
    }
    this.peak = peak;
    S /= n0; L /= n0; flight /= n0;
    const prev = e.prev || { S: 0, L: 0, rows: new Float32Array(NY) };
    const scr = Float32Array.from({ length: NY }, (_, y) => rows[y * 4]);
    const pick = (w) => {
      let tot = 0;
      for (const v of w) tot += Math.max(0, v);
      let r = Math.random() * tot;
      for (let y = 0; y < NY; y++) { r -= Math.max(0, w[y]); if (r <= 0) return y; }
      return NY >> 1;
    };
    let fate = null;
    if (S + L >= e.u) {
      const dS = Math.max(0, S - prev.S), dL = Math.max(0, L - prev.L);
      const onScreen = dS + dL > 0 ? Math.random() * (dS + dL) < dS : Math.random() * (S + L) < S;
      fate = onScreen ? pick(dS > 0 ? scr.map((v, y) => v - prev.rows[y]) : scr) : -1;
    } else if (flight < 0.004) {
      // Nearly all of it is gone without reaching u (the grid loses a sliver): settle it by the totals.
      fate = Math.random() * (S + L) < S ? pick(scr) : -1;
    }
    e.prev = { S, L, rows: scr };
    if (fate === null) return;
    if (fate >= 0) this.land(fate); else this.count.stopped++;
    this.finish();
  }

  // ------------------------------------------------------------ looking

  /** Look for the electron in a small window round cell (x, y): found or not, the wave collapses to match. */
  look(x, y) {
    const e = this.electron;
    if (!e) {
      this.note = 'NOTHING TO LOOK FOR: NO ELECTRON IS IN FLIGHT.';
      this.tell(true);
      return;
    }
    const f = this.solver.read();
    let all = 0, inside = 0, topIn = 0, topOut = 0;
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const k = (j * NX + i) * 4, d = f[k] * f[k] + f[k + 1] * f[k + 1];
        const w2 = Math.exp(-((i - x) ** 2 + (j - y) ** 2) / (LOOK * LOOK));
        all += d;
        inside += d * w2;
        topIn = Math.max(topIn, d * w2);
        topOut = Math.max(topOut, d * (1 - w2));
      }
    }
    if (all <= 0) return;
    const found = Math.random() * all < inside;
    const kept = found ? inside : all - inside;
    if (kept <= all * 1e-6) return;
    const scale = this.solver.norm0 / kept;
    this.solver.measure(x, y, LOOK, found, Math.sqrt(scale));
    // The brightest spot until the next reading: where it was found, or as before, scaled.
    this.peak = (found ? topIn : topOut) * scale;
    e.u = Math.random(); // a fresh state: what it already lost doesn't count any more
    e.prev = null;
    this.count.looked++;
    const pct = Math.round((100 * inside) / all);
    this.note = found
      ? `FOUND IT. THE CHANCE WAS ${pct}%, AND NOW IT'S ONLY THERE.`
      : `NOT THERE (A ${pct}% CHANCE). NOW IT'S EVERYWHERE ELSE.`;
    this.tell(true);
    this.host.kick();
  }

  /** The pointer, in doc px: aims the gun on the near side of the plate, looks on the far side. */
  pointer(px, py, down) {
    const r = this.rect;
    if (!this.on || !this.solver || !r || this.hidden) return false;
    let u = (px - r[0]) / r[2], v = (py - r[1]) / r[3];
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
    if (this.transposed) [u, v] = [v, u];
    const x = u * NX, y = v * NY;
    if (x < GEO.barrier) {
      this.gunY = y;
      if (down && !this.electron) this.fire();
      this.host.kick();
      return true;
    }
    if (down && x >= GEO.barrier + GEO.thick) this.look(x, y);
    return down;
  }

  action(a) {
    if (a === 'qm:fire') {
      if (!this.electron) this.fire();
    } else if (a === 'qm:auto') {
      this.auto = !this.auto;
      this.nextFire = 0;
    } else if (a === 'qm:speed') {
      this.speed = this.speed === 'fast' ? 'watch' : 'fast';
    } else if (a === 'qm:slits') {
      this.slits = this.slits === 2 ? 1 : 2;
      this.solver?.setSlits(this.slits);
      if (this.electron) { this.electron = null; this.solver.clear(); }
      this.reset();
    } else if (a === 'qm:clear') {
      this.reset();
    } else if (a === 'qm:e+' || a === 'qm:e-') {
      const e = Math.max(0, Math.min(KS.length - 1, this.energy + (a === 'qm:e+' ? 1 : -1)));
      if (e === this.energy) return;
      this.energy = e;
      if (this.electron) { this.electron = null; this.solver.clear(); }
      this.reset(); // a new energy is a new pattern
    }
    this.note = a === 'qm:clear' || a === 'qm:slits' || a.startsWith('qm:e') ? null : this.note;
    this.tell(true);
    this.host.kick();
  }

  // ------------------------------------------------------------ frames

  /** Each frame, from main.js. True while it wants more frames. */
  frame(t) {
    if (!this.on || this.hidden) return false;
    const box = this.host.scene()?.quantum;
    if (!box || !this.solver) { this.host.renderer.clearQuantum?.(); return false; }
    this.rect = [box.x, box.y, box.w, box.h];
    this.transposed = box.transposed;
    if (t < this.arrive) return true;
    const fade = Math.min(box.fade ?? 1, Math.max(0, Math.min(1, (t - this.arrive) / 0.6)));
    // Only while it's on screen.
    const [top, vh] = this.host.viewport();
    const seen = box.y < top + vh && box.y + box.h > top;
    if (seen && fade >= 1) {
      if (this.electron) {
        const n = SPEEDS[this.speed];
        this.solver.step(n);
        this.electron.t += n * DT;
        const rows = this.solver.poll();
        if (rows) this.absorbed(rows);
        if (this.electron) this.solver.request();
        this.tell();
      } else if (this.auto && t >= this.nextFire) {
        this.fire();
      }
    }
    const now = this.host.now();
    this.flashes = this.flashes.filter((f) => now - f.t < 1.6);
    const flash = new Float32Array(FLASH * 4);
    this.flashes.forEach((f, i) => flash.set([f.x, f.y, f.t, f.c], i * 4));
    this.host.renderer.setQuantum({
      field: this.solver.field, walls: this.solver.walls, hits: this.hitsDirty ? this.hits : null, hitCols: HIT_COLS,
      rect: this.rect, block: box.block, transposed: box.transposed, grid: [NX, NY], screenX: SCREEN_X,
      peak: this.electron ? this.peak || 1 : 1, gun: [GEO.gunX - 8, this.gunY, 4], fade,
      flash, flashN: this.flashes.length,
    });
    this.hitsDirty = false;
    return fade < 1 || (seen && (!!this.electron || this.auto)) || this.flashes.length > 0;
  }
}
