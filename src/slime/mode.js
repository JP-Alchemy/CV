// The slime mould experiment's live half (/projects/slime-mould/). The model
// runs in a worker (slime/worker.js); here its tubes are drawn into a texture
// of 4 px cells under the map on the page (the frame, the cities and their
// names are the page's own blocks, on top), and what it's doing goes to the
// page as state.slime.

import { slimeText as T } from '../content.js';
import { BOX } from './page.js';

const CELL = 4;
const INSET = 4; // clear of the map's frame
const I0S = [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 4, 6, 8];
const GAMMAS = [0.9, 1, 1.15, 1.3, 1.5, 1.65, 1.8, 2, 2.4, 3];
const VIEW_EVERY = 0.5; // s between status updates to the page while it grows

export class Mould {
  /** host: { renderer, now, changed, scene, kick, calm } */
  constructor(host) {
    this.host = host;
    this.on = false;
    this.hidden = false;
    this.ready = false;
    this.I0 = T.presets[0].I0;
    this.gamma = T.presets[0].gamma;
    this.run = 0;
    this.rail = false;
    this.tree = false;
    this.arrive = Infinity;
  }

  /** Arriving on the page: start the worker (the run starts once it has the map). */
  open() {
    if (this.on) return;
    this.on = true;
    this.hidden = false;
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.message(e.data);
  }

  /** Leaving: the worker goes, and the map with it. */
  close() {
    if (!this.on) return;
    this.on = false;
    this.waiting = false;
    this.worker.terminate();
    this.worker = null;
    this.ready = false;
    this.D = null;
    this.mould = null;
    this.grid = null;
    this.arrive = Infinity;
    this.host.renderer.clearSlime?.();
  }

  /** Under the menu: keep growing, don't draw. */
  hide(on) {
    this.hidden = on;
    this.arrive = Infinity; // back once the page has landed again
    if (on) this.host.renderer.clearSlime?.();
    else this.dirty = true;
  }

  /** The page has landed (or will at `t`): the map dissolves in from then. */
  arriveAt(t) { this.arrive = Math.min(this.arrive, t); }

  message(d) {
    if (d.type === 'ready') {
      this.ready = true;
      this.map = d.map;
      this.mesh = d.mesh;
      this.railUse = d.railUse;
      this.treeUse = d.treeUse;
      this.railScore = d.rail;
      this.treeScore = d.tree;
      this.grid = null;
      this.waiting = true; // grows once the map is on screen (frame())
      this.host.kick();
      return;
    }
    if (d.run !== this.run) return; // from a run since replaced
    if (d.type === 'frame') {
      this.D = d.D;
      this.t = d.t;
      this.top = d.top;
      this.dirty = true;
      if (d.settled && !this.settled) { this.settled = true; this.playing = false; this.tell(true); }
      this.host.kick();
    } else if (d.type === 'score') {
      this.mould = d.mould;
      this.tell(d.settled);
    }
  }

  /** The page's numbers, a couple of times a second at most. */
  tell(now = false) {
    const t = this.host.now();
    if (!now && t - (this.told || 0) < VIEW_EVERY) return;
    this.told = t;
    this.host.changed();
  }

  /** Grow from scratch with the current settings. */
  grow(fresh = true) {
    if (!this.ready) return;
    this.run++;
    if (fresh) this.seed = (this.seed || 0) + 1;
    this.worker.postMessage({ type: 'grow', run: this.run, I0: this.I0, gamma: this.gamma, seed: this.seed });
    this.playing = true;
    this.settled = false;
    this.mould = null;
    this.t = 0;
    this.tell(true);
  }

  action(a) {
    if (a === 'sm:play') {
      this.playing = !this.playing;
      this.worker?.postMessage({ type: this.playing ? 'play' : 'pause' });
      this.tell(true);
    } else if (a === 'sm:again') {
      this.grow();
    } else if (a === 'sm:rail' || a === 'sm:tree') {
      this[a.slice(3)] = !this[a.slice(3)];
      this.tell(true);
      this.host.kick();
    } else if (a.startsWith('sm:preset:')) {
      const p = T.presets.find((q) => q.id === a.slice(10));
      if (!p) return;
      this.I0 = p.I0;
      this.gamma = p.gamma;
      this.grow();
    } else if (/^sm:(I0|gamma)[+-]$/.test(a)) {
      const key = a.slice(3, -1), up = a.endsWith('+');
      const list = key === 'I0' ? I0S : GAMMAS;
      let i = list.findIndex((v) => v >= this[key] - 1e-9);
      if (i < 0) i = list.length - 1;
      else if (list[i] > this[key] + 1e-9 && !up) i--; // between steps: down goes to the one below
      else i += up ? 1 : -1;
      this[key] = list[Math.max(0, Math.min(list.length - 1, i))];
      this.grow();
    }
  }

  view() {
    return {
      ready: this.ready, playing: this.playing, settled: this.settled, t: this.t || 0,
      I0: this.I0, gamma: this.gamma, rail: this.rail, tree: this.tree,
      mould: this.mould, rail0: this.railScore, tree0: this.treeScore,
    };
  }

  /** The cells for the map at this size: what the ground is, the railway and the tree, and each tube's ends. */
  layout(rect) {
    const cols = Math.floor((rect.w - 2 * INSET) / CELL), rows = Math.floor((rect.h - 2 * INSET) / CELL);
    const s = rect.w / BOX[2]; // px per km
    const toX = (x) => ((x - BOX[0]) * s - INSET) / CELL, toY = (y) => ((y - BOX[1]) * s - INSET) / CELL;
    const base = new Uint8Array(cols * rows * 4);
    const { cls, cols: mc, rows: mr, cell } = this.map;
    for (let j = 0; j < rows; j++) {
      const y = BOX[1] + (INSET + (j + 0.5) * CELL) / s, gj = Math.floor(y / cell);
      for (let i = 0; i < cols; i++) {
        const x = BOX[0] + (INSET + (i + 0.5) * CELL) / s, gi = Math.floor(x / cell);
        base[(j * cols + i) * 4] = gi >= 0 && gj >= 0 && gi < mc && gj < mr ? cls[gj * mc + gi] : 0;
      }
    }
    const { m, a, b, x, y } = this.mesh;
    const ends = new Float32Array(m * 4);
    for (let e = 0; e < m; e++) {
      ends[e * 4] = toX(x[a[e]]);
      ends[e * 4 + 1] = toY(y[a[e]]);
      ends[e * 4 + 2] = toX(x[b[e]]);
      ends[e * 4 + 3] = toY(y[b[e]]);
    }
    this.grid = { rw: rect.w, rh: rect.h, cols, rows, base, ends, buf: new Uint8Array(cols * rows * 4) };
    for (let e = 0; e < m; e++) {
      if (this.railUse[e]) this.line(e, (k) => { base[k + 2] |= 1; });
      if (this.treeUse[e]) this.line(e, (k) => { base[k + 2] |= 2; });
    }
    this.dirty = true;
  }

  /** Every cell along tube e (as a byte offset into the cell buffer). */
  line(e, fn) {
    const { ends, cols, rows } = this.grid;
    const x0 = ends[e * 4], y0 = ends[e * 4 + 1], x1 = ends[e * 4 + 2], y1 = ends[e * 4 + 3];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
    for (let k = 0; k <= n; k++) {
      const i = Math.floor(x0 + ((x1 - x0) * k) / n), j = Math.floor(y0 + ((y1 - y0) * k) / n);
      if (i >= 0 && j >= 0 && i < cols && j < rows) fn((j * cols + i) * 4);
    }
  }

  /** The tubes into the cells: each cell keeps its thickest tube, as (D / D_max)^1/4, so its radius. */
  paint() {
    const { buf, base } = this.grid;
    buf.set(base);
    const D = this.D, top = this.top, m = this.mesh.m;
    for (let e = 0; e < m; e++) {
      const d = D[e] / top;
      if (d < 0.0016) continue; // thinner than a thread
      const v = Math.round(255 * Math.min(1, Math.sqrt(Math.sqrt(d))));
      // The thickest tubes are two cells wide.
      const wide = v > 200 ? (k) => { for (const o of [0, 4, this.grid.cols * 4]) if (buf[k + o + 1] < v) buf[k + o + 1] = v; } : null;
      this.line(e, wide || ((k) => { if (buf[k + 1] < v) buf[k + 1] = v; }));
    }
  }

  /** Each frame, from main.js: draw the map where the page has put it. True while it still needs frames. */
  frame(t) {
    if (!this.on || this.hidden || !this.ready) return false;
    const rect = this.host.scene()?.slime;
    if (!rect) return false;
    if (this.waiting) {
      if (t < this.arrive) return true;
      this.waiting = false;
      this.grow(false);
    }
    if (!this.D) return true;
    if (!this.grid || this.grid.rw !== rect.w || this.grid.rh !== rect.h) this.layout(rect);
    const fade = Math.max(0, Math.min(1, (t - this.arrive) / 0.6));
    if (fade <= 0) return true;
    const changed = this.dirty;
    if (changed) { this.paint(); this.dirty = false; }
    const g = this.grid;
    this.host.renderer.setSlime?.({
      cols: g.cols, rows: g.rows, x0: rect.x + INSET, y0: rect.y + INSET, cell: CELL,
      buf: changed || !this.uploaded ? g.buf : null, show: [this.rail, this.tree], fade, still: this.host.calm?.(),
    });
    this.uploaded = true;
    return fade < 1 || this.playing;
  }
}
