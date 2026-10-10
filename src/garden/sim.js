// The garden's falling-sand world: a grid of 4px cells over the screen. Sand
// falls and piles, water flows and soaks in, a buried seed in damp soil
// sprouts, and its flower blooms in one of the seven spectrum colours. Each
// colour wants different water and light; flowers that bloom near another
// colour cross when harvested. Hung lights shine down in cones (soil and stone
// cast shadows), sprinklers drip, sowers sow and agents walk the ground
// harvesting. Pure logic: garden/mode.js drives and draws it.

import { COLOURS } from '../brand.js';

export const CELL = 4;
export const K = { EMPTY: 0, SAND: 1, WATER: 2, SEED: 3, ROOT: 4, STEM: 5, LEAF: 6, BUD: 7, PETAL: 8, DEAD: 9, INK: 10, ACCENT: 11, GLOW: 12 };
export { COLOURS };
export const PRIMARY = [0, 2, 5]; // red, yellow and blue: always in stock

// What each colour likes, from dry and sunny (red) to wet and shady (violet).
// water: damp soil around the roots, 0-1. light: light per second, 0-1.
export const NEEDS = COLOURS.map((_, k) => ({ water: 0.12 + 0.07 * k, light: 0.95 - 0.12 * k }));
const TOL = { water: 0.2, light: 0.24 };

/** The colour two flowers make: halfway round the spectrum (R+Y=O, Y+B=G, B+R=V, G+B=C). */
export function cross(a, b) {
  if (a === b) return a;
  let d = (((b - a) % 7) + 7) % 7;
  if (d > 3) d -= 7;
  return ((Math.floor(a + d / 2) % 7) + 7) % 7;
}

export const DEVICES = {
  // 4×4 sprites: # ink, a accent (spectrum index in `accent`)
  sprinkler: { accent: 4, art: ['.##.', '####', '#aa#', 'a..a'] },
  sower: { accent: 2, art: ['####', '#aa#', '#aa#', '.##.'] }, // accent: the colour it sows
};
const AGENT = ['####', '#a#a', '####', '#..#'];

const PACE = 0.6; // growth steps per second, in a plant's favourite light
const DAYLIGHT = 0.22; // light per second where the sky is open
const BEAM = { reach: 64, spread: 0.35, power: 0.85 }; // a hung light's cone: cells, widening per row, light/s at the top

export class Sim {
  constructor(cols, rows, solid) {
    const n = cols * rows;
    this.cols = cols;
    this.rows = rows;
    this.n = n;
    this.solid = solid; // 1 where the page's own blocks are: stone the garden piles on
    this.kind = new Uint8Array(n);
    this.data = new Uint8Array(n); // sand: moisture; seed and flower parts: colour; devices: accent
    this.grain = new Uint8Array(n); // per-particle random, travels with it
    this.owner = new Int32Array(n).fill(-1); // plant or device id
    this.stamp = new Uint8Array(n);
    this.frame = 0;
    this.plants = new Map();
    this.devices = [];
    this.agents = [];
    this.lights = [];
    this.lit = new Uint8Array(n); // light reaching each cell from hung lights, 0-255
    this.take = () => true; // garden/mode.js: may a sower use a seed of this colour?
    this.nextId = 1;
    this.events = [];
  }

  idx(x, y) { return y * this.cols + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  free(i) { return this.kind[i] === K.EMPTY && !this.solid[i]; }
  soil(i) { const k = this.kind[i]; return k === K.SAND || k === K.DEAD; }

  put(i, kind, data = 0) {
    this.kind[i] = kind;
    this.data[i] = data;
    this.grain[i] = (Math.random() * 256) | 0;
    this.owner[i] = -1;
  }

  clear(i) { this.kind[i] = K.EMPTY; this.data[i] = 0; this.owner[i] = -1; }

  swap(i, j) {
    const { kind, data, grain, owner } = this;
    let t = kind[i]; kind[i] = kind[j]; kind[j] = t;
    t = data[i]; data[i] = data[j]; data[j] = t;
    t = grain[i]; grain[i] = grain[j]; grain[j] = t;
    t = owner[i]; owner[i] = owner[j]; owner[j] = t;
    this.stamp[j] = this.stamp[i] = this.mark;
  }

  /** Pour something into a disc of cells (only where there is room). */
  pour(cx, cy, r, kind, count, data = 0) {
    let n = 0;
    for (let a = 0; a < count * 3 && n < count; a++) {
      const x = cx + Math.round((Math.random() * 2 - 1) * r), y = cy + Math.round((Math.random() * 2 - 1) * r);
      if (!this.inside(x, y)) continue;
      const i = this.idx(x, y);
      if (!this.free(i)) continue;
      this.put(i, kind, data);
      n++;
    }
    return n;
  }

  step() {
    this.frame++;
    this.mark = (this.frame % 250) + 1;
    const { cols, rows, kind, stamp } = this;
    const ltr = this.frame & 1;
    for (let y = rows - 1; y >= 0; y--) {
      for (let s = 0; s < cols; s++) {
        const x = ltr ? s : cols - 1 - s;
        const i = y * cols + x;
        const k = kind[i];
        if (k === K.EMPTY || stamp[i] === this.mark) continue;
        if (k === K.SAND || k === K.DEAD || k === K.SEED) this.fall(i, x, y);
        else if (k === K.WATER) this.flow(i, x, y);
      }
    }
    if (this.frame % 4 === 0) this.soak();
    if (this.frame % 6 === 0) this.tick(0.1);
    if (this.frame % 3 === 0) this.machines();
  }

  fall(i, x, y) {
    if (y + 1 >= this.rows) return;
    let b = i + this.cols;
    const sinks = (j) => this.free(j) || (this.kind[j] === K.WATER && !this.solid[j]);
    if (sinks(b)) { this.swap(i, b); return; }
    // A seed that lands on soil digs itself in, two cells deep (one if
    // that's all there is); on stone it waits to be buried with sand.
    if (this.kind[i] === K.SEED && this.soil(b) && !(i >= this.cols && this.soil(i - this.cols))) {
      this.swap(i, b);
      if (b + this.cols < this.n && this.soil(b + this.cols)) { this.swap(b, b + this.cols); b += this.cols; }
      this.events.push({ type: 'planted', gene: this.data[b], at: b });
      return;
    }
    // Seeds stay where they land, and soil that lands on a seed stays on it
    // (so it can be buried). Damp sand holds its shape; dry sand runs down.
    if (this.kind[i] === K.SEED || this.kind[b] === K.SEED) return;
    if (this.kind[i] === K.SAND && this.data[i] > 110 && Math.random() > 0.06) return;
    const d0 = Math.random() < 0.5 ? -1 : 1;
    for (const d of [d0, -d0]) {
      const nx = x + d;
      if (nx < 0 || nx >= this.cols || this.solid[i + d]) continue;
      if (sinks(b + d)) { this.swap(i, b + d); return; }
    }
  }

  flow(i, x, y) {
    const c = this.cols;
    if (y + 1 < this.rows) {
      const b = i + c;
      if (this.free(b)) { this.swap(i, b); return; }
      if (this.soil(b) && this.data[b] < 235 && Math.random() < 0.3) {
        this.data[b] = Math.min(255, this.data[b] + 64);
        this.clear(i);
        return;
      }
      const d0 = this.grain[i] & 1 ? 1 : -1;
      for (const d of [d0, -d0]) {
        const nx = x + d;
        if (nx >= 0 && nx < c && this.free(b + d)) { this.swap(i, b + d); return; }
      }
    }
    // Spread sideways, up to two cells a step; turn round at walls.
    const d = this.grain[i] & 1 ? 1 : -1;
    const nx = x + d;
    if (nx >= 0 && nx < c && this.free(i + d)) {
      const far = x + 2 * d >= 0 && x + 2 * d < c && this.free(i + 2 * d);
      this.swap(i, far ? i + 2 * d : i + d);
      return;
    }
    this.grain[i] ^= 1;
    const j = i + d;
    if (nx >= 0 && nx < c && this.soil(j) && this.data[j] < 235 && Math.random() < 0.08) {
      this.data[j] = Math.min(255, this.data[j] + 64);
      this.clear(i);
    }
  }

  /**
   * Moisture seeps down and sideways through soil and dries at the surface.
   * Standing water dries up too, slowly (faster under a light), so a pot
   * that was overwatered comes back.
   */
  soak() {
    const { cols, n, kind, data, solid } = this;
    for (let i = n - 1; i >= 0; i--) {
      const k = kind[i];
      if (k === K.WATER) {
        const a = i - cols;
        if ((a < 0 || (kind[a] === K.EMPTY && !solid[a])) && Math.random() < 0.0015 + this.lit[i] / 60000) this.clear(i);
        continue;
      }
      if ((k !== K.SAND && k !== K.DEAD) || !data[i]) continue;
      const b = i + cols;
      if (b < n && (kind[b] === K.SAND || kind[b] === K.DEAD) && data[b] + 6 < data[i]) {
        const t = (data[i] - data[b]) >> 3; data[i] -= t; data[b] += t;
      }
      const x = i % cols;
      const sj = x > 0 && x < cols - 1 ? i + (this.frame & 4 ? 1 : -1) : -1;
      if (sj >= 0 && (kind[sj] === K.SAND || kind[sj] === K.DEAD) && data[sj] + 12 < data[i]) {
        const t = (data[i] - data[sj]) >> 4; data[i] -= t; data[sj] += t;
      }
      const a = i - cols;
      if (a >= 0 && kind[a] === K.EMPTY && !solid[a] && Math.random() < 0.07 + this.lit[i] / 1200) data[i]--; // lit soil dries faster
    }
  }

  // ---------------------------------------------------------------- plants

  /** Average dampness (0-1) of the soil touching a cell. */
  damp(i) {
    let s = 0, n = 0;
    for (const j of this.around(i)) if (this.soil(j)) { s += this.data[j]; n++; }
    return n ? s / n / 255 : 0;
  }

  around(i) {
    const x = i % this.cols, out = [];
    if (i >= this.cols) out.push(i - this.cols);
    if (i + this.cols < this.n) out.push(i + this.cols);
    if (x > 0) out.push(i - 1);
    if (x < this.cols - 1) out.push(i + 1);
    return out;
  }

  /** True if nothing solid sits above a cell, all the way up. */
  sky(i) {
    for (let j = i - this.cols; j >= 0; j -= this.cols) {
      const k = this.kind[j];
      if (this.solid[j] || k === K.SAND || k === K.DEAD || k === K.INK || k === K.ACCENT || k === K.GLOW) return false;
    }
    return true;
  }

  claim(i, kind, p) {
    this.kind[i] = kind;
    this.data[i] = p.gene;
    this.owner[i] = p.id;
    this.grain[i] = (Math.random() * 256) | 0;
    p.cells.push(i);
  }

  tick(dt) {
    this.shine();
    // Seeds that are buried in damp soil sprout.
    if (this.frame % 30 === 0) {
      for (let i = 0; i < this.n; i++) {
        if (this.kind[i] !== K.SEED) continue;
        const below = i + this.cols;
        const resting = below >= this.n || !this.free(below);
        const buried = i >= this.cols && this.soil(i - this.cols);
        if (resting && buried && this.damp(i) > 0.12) this.sprout(i);
      }
    }
    for (const p of this.plants.values()) this.grow(p, dt);
  }

  sprout(i) {
    const p = {
      id: this.nextId++, gene: this.data[i], cells: [], roots: [], petals: [], base: i, top: i,
      height: 1, target: 12 + this.data[i] + ((Math.random() * 4) | 0), dug: 0, stage: 'grow', steps: 0,
      water: this.damp(i), light: 0.5, lightIn: 0, energy: 0, reserve: 18, health: 1, mood: 'ok', bud: -1, budEnergy: 0,
    };
    this.kind[i] = K.EMPTY;
    this.claim(i, K.STEM, p);
    this.plants.set(p.id, p);
    this.events.push({ type: 'sprout', plant: p });
  }

  grow(p, dt) {
    // Roots drink: the plant feels how damp the soil around them is, and dries it a little.
    let wet = 0, n = 0;
    for (const r of [p.base, ...p.roots.slice(-8)]) {
      for (const j of this.around(r)) {
        if (!this.soil(j)) continue;
        wet += this.data[j]; n++;
        if (this.data[j] > 0 && Math.random() < 0.08) this.data[j]--;
      }
    }
    p.water += ((n ? wet / n / 255 : 0) - p.water) * 0.08;
    const need = NEEDS[p.gene];
    let lErr = 0;
    if (p.top >= this.cols && this.soil(p.top - this.cols)) {
      // Still underground: a seedling lives on its seed until it breaks the
      // surface. Planted too deep, the seed runs out first.
      p.lightIn = 0;
      p.reserve -= PACE * dt;
      if (p.reserve <= 0) { p.mood = 'deep'; this.die(p); return; }
      p.energy += PACE * 1.5 * dt;
    } else {
      const light = p.lightIn + ((this.sky(p.top) ? DAYLIGHT : 0) + this.lit[p.top] / 255) * dt;
      p.lightIn = 0;
      p.light += (light / dt - p.light) * 0.03; // light per second, smoothed over a few seconds
      // In its favourite light every colour grows at the same pace.
      p.energy += Math.min(1.5, p.light / need.light) * PACE * dt;
      lErr = Math.max(0, Math.abs(Math.min(1, p.light) - need.light) - TOL.light);
    }
    const wErr = Math.max(0, Math.abs(p.water - need.water) - TOL.water);
    const stress = wErr + lErr;
    p.mood = !stress ? 'ok' : wErr >= lErr ? (p.water > need.water ? 'wet' : 'dry') : p.light > need.light ? 'bright' : 'dark';
    // Unhappy plants fade over tens of seconds (flowers hold on longer).
    const fade = Math.min(stress, 0.25) * (p.stage === 'bloom' ? 0.05 : 0.1);
    p.health = Math.max(0, Math.min(1, p.health + (stress ? -fade : 0.05) * dt));
    if (p.health <= 0) { this.die(p); return; }
    if (stress > 0.12) return; // too unhappy to grow
    while (p.energy >= 1) {
      p.energy -= 1;
      if (!this.growStep(p)) { p.energy = 0; break; }
    }
  }

  growStep(p) {
    const c = this.cols;
    if (p.stage === 'grow') {
      if (p.steps++ % 2 === 0 && p.roots.length < 3 + p.height) this.root(p);
      const up = p.top - c;
      if (up < 0) { p.stage = 'bud'; return true; }
      const k = this.kind[up];
      if (this.solid[up] || !(k === K.EMPTY || k === K.WATER || k === K.SAND || k === K.DEAD)) { p.stage = 'bud'; return true; }
      if (k === K.SAND || k === K.DEAD) {
        if (p.dug >= 12) return false; // buried too deep to break through
        p.dug++;
      }
      this.claim(up, K.STEM, p);
      p.top = up;
      p.height++;
      if (p.height > 3 && p.height % 3 === 0) this.leaf(p);
      if (p.height >= p.target) p.stage = 'bud';
      return true;
    }
    if (p.stage === 'bud') {
      if (p.bud < 0) {
        const up = p.top - c;
        if (up >= 0 && this.free(up)) { this.claim(up, K.BUD, p); p.bud = up; } else { this.kind[p.top] = K.BUD; p.bud = p.top; }
        return true;
      }
      if (++p.budEnergy >= 5) this.bloom(p);
      return true;
    }
    return false; // in bloom: rests until harvested
  }

  root(p) {
    const tip = p.roots.length ? p.roots[p.roots.length - 1] : p.base;
    const x = tip % this.cols;
    let best = -1, score = -1;
    for (const [dx, dy] of [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0]]) {
      if (x + dx < 0 || x + dx >= this.cols) continue;
      const j = tip + dy * this.cols + dx;
      if (j >= this.n || !this.soil(j)) continue;
      const s = this.data[j] + (dy ? 30 : 0) + Math.random() * 40;
      if (s > score) { score = s; best = j; }
    }
    if (best >= 0) { this.claim(best, K.ROOT, p); p.roots.push(best); }
  }

  leaf(p) {
    const side = (p.height / 3) % 2 ? -1 : 1;
    const x = p.top % this.cols;
    for (const s of [side, side * 2]) {
      if (x + s < 0 || x + s >= this.cols) break;
      const j = p.top + s;
      if (!this.free(j)) break;
      this.claim(j, K.LEAF, p);
      if (p.height < 9) break;
    }
  }

  bloom(p) {
    // A round flower head, 5 cells across, around a dark centre (the bud).
    const c = this.cols, b = p.bud, x = b % c;
    p.petals = [b];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if ((Math.abs(dx) === 2 && Math.abs(dy) === 2) || (!dx && !dy)) continue;
      if (x + dx < 0 || x + dx >= c) continue;
      const j = b + dy * c + dx;
      if (j < 0 || !this.free(j)) continue;
      this.claim(j, K.PETAL, p);
      p.petals.push(j);
    }
    p.stage = 'bloom';
    this.events.push({ type: 'bloom', plant: p });
  }

  /** The nearest other flower in bloom, within reach of its pollen. */
  partner(p, reach = 26) {
    const c = this.cols, px = p.bud % c, py = (p.bud / c) | 0;
    let best = null, bd = reach * reach;
    for (const q of this.plants.values()) {
      if (q === p || q.stage !== 'bloom' || q.gene === p.gene) continue;
      const dx = (q.bud % c) - px, dy = ((q.bud / c) | 0) - py, d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = q; }
    }
    return best;
  }

  /** Pick a flower's seeds: crossed if another colour bloomed nearby. Returns { gene, count }. */
  harvest(p) {
    if (p.stage !== 'bloom') return null;
    const q = this.partner(p);
    const gene = q ? cross(p.gene, q.gene) : p.gene;
    for (const j of p.petals) {
      if (j === p.bud) continue;
      this.clear(j);
      p.cells.splice(p.cells.indexOf(j), 1);
    }
    this.kind[p.bud] = K.BUD;
    p.petals = [];
    p.stage = 'bud';
    p.budEnergy = 0;
    return { gene, count: q ? 2 : 3, crossed: !!q, from: p.gene, with: q?.gene };
  }

  /** The plant whose flower is near a cell, if any. */
  flowerAt(i, reach = 3) {
    const c = this.cols, x = i % c, y = (i / c) | 0;
    for (const p of this.plants.values()) {
      if (p.stage !== 'bloom') continue;
      if (Math.abs((p.bud % c) - x) <= reach && Math.abs(((p.bud / c) | 0) - y) <= reach) return p;
    }
    return null;
  }

  die(p) {
    for (const j of p.cells) if (this.owner[j] === p.id) this.put(j, K.DEAD);
    this.plants.delete(p.id);
    this.events.push({ type: 'die', plant: p });
  }

  // ---------------------------------------------------------------- light

  /** Hang a 2×2 light with its top-left cell at (x, y). */
  hang(x, y) {
    const cells = [];
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      if (!this.inside(x + i, y + j)) return false;
      const k = this.idx(x + i, y + j);
      if (!this.free(k)) return false;
      cells.push(k);
    }
    const l = { id: this.nextId++, x, y, cells };
    cells.forEach((k, n) => { this.kind[k] = K.GLOW; this.data[k] = n; this.owner[k] = l.id; this.grain[k] = (Math.random() * 256) | 0; }); // data: which quarter
    this.lights.push(l);
    this.shine();
    return true;
  }

  /**
   * Where the hung lights reach: a cone down from each, fading with distance.
   * Soil, stone and machines stop the light in their column (plants don't).
   */
  shine() {
    const { cols, rows, kind, solid, lit } = this;
    lit.fill(0);
    const stop = new Uint8Array(cols);
    for (const l of this.lights) {
      stop.fill(0);
      const lx = l.x + 1, ly = l.y + 2;
      for (let dy = 0; dy < BEAM.reach && ly + dy < rows; dy++) {
        const y = ly + dy, half = 1 + dy * BEAM.spread, fall = 1 - dy / BEAM.reach;
        const x0 = Math.max(0, Math.floor(lx - half)), x1 = Math.min(cols - 1, Math.ceil(lx + half) - 1);
        for (let x = x0; x <= x1; x++) {
          if (stop[x]) continue;
          const i = y * cols + x, k = kind[i];
          const edge = Math.min(1, Math.abs(x + 0.5 - lx) / half);
          lit[i] = Math.min(255, lit[i] + 255 * BEAM.power * fall * (1 - edge * edge * 0.6));
          if (solid[i] || k === K.SAND || k === K.DEAD || k === K.INK || k === K.ACCENT || k === K.GLOW) stop[x] = 1;
        }
      }
    }
  }

  /** Take down whatever machine, light or agent is at a cell. Returns what it was. */
  remove(i, only) {
    const id = this.owner[i];
    const l = this.lights.find((q) => q.id === id);
    if (l && (!only || only === 'light')) {
      for (const k of l.cells) this.clear(k);
      this.lights.splice(this.lights.indexOf(l), 1);
      this.shine();
      return 'light';
    }
    const d = this.devices.find((q) => q.id === id);
    if (d && (!only || only === d.type)) {
      for (const k of d.cells) this.clear(k);
      this.devices.splice(this.devices.indexOf(d), 1);
      return d.type;
    }
    if (!only || only === 'agent') {
      const x = i % this.cols, y = (i / this.cols) | 0;
      const a = this.agents.find((q) => x >= q.x - 1 && x <= q.x + 4 && y >= q.y - 1 && y <= q.y + 4);
      if (a) { this.agents.splice(this.agents.indexOf(a), 1); return 'agent'; }
    }
    return null;
  }

  // ---------------------------------------------------------------- machines

  place(type, x, y, gene) {
    const cells = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      if (!this.inside(x + i, y + j)) return false;
      const k = this.idx(x + i, y + j);
      if (!this.free(k)) return false;
      cells.push(k);
    }
    const d = { id: this.nextId++, type, x, y, cells, t: 0, gene, slot: 0, cover: 0 };
    const art = DEVICES[type].art, accent = type === 'sower' ? gene : DEVICES[type].accent;
    cells.forEach((k, n) => {
      const ch = art[(n / 4) | 0][n % 4];
      // Every cell is solid; '.' cells are drawn as paper.
      this.kind[k] = ch === 'a' ? K.ACCENT : K.INK;
      this.data[k] = ch === 'a' ? accent : ch === '#' ? 0 : 255;
      this.owner[k] = d.id;
    });
    this.devices.push(d);
    return true;
  }

  /**
   * A sower sows three spots in a row beneath it, one seed at a time, and
   * covers each seed with a few grains of sand. A spot with a plant waits.
   */
  sow(d) {
    if (d.cover > 0) {
      if (d.t % 3 === 0) {
        const j = this.idx(d.sx, d.y + 4);
        if (this.free(j)) { this.put(j, K.SAND); d.cover--; }
      }
      return;
    }
    if (d.t % 90) return; // every 4.5 s
    const sx = d.x + 2 + [-6, 0, 6][d.slot++ % 3];
    if (!this.inside(sx, d.y + 4)) return;
    for (let y = d.y + 4; y < Math.min(this.rows, d.y + 60); y++) {
      const k = this.kind[this.idx(sx, y)];
      if (k === K.STEM || k === K.ROOT || k === K.SEED || k === K.LEAF || k === K.BUD || k === K.PETAL) return; // already growing
      if (this.solid[this.idx(sx, y)] || k === K.SAND || k === K.DEAD) break;
    }
    const j = this.idx(sx, d.y + 4);
    if (!this.free(j) || !this.take(d.gene)) return;
    this.put(j, K.SEED, d.gene);
    d.sx = sx;
    d.cover = 4;
  }

  addAgent(x, y) {
    if (!this.inside(x, y) || !this.inside(x + 3, y + 3)) return false;
    this.agents.push({ x, y, dir: Math.random() < 0.5 ? -1 : 1, t: 0, cool: 0, climb: 0 });
    return true;
  }

  machines() {
    for (const d of this.devices) {
      d.t++;
      if (d.type === 'sprinkler' && d.t % 5 === 0) { // four drops a second, from alternate nozzles
        const x = d.x + (d.t % 10 ? 0 : 3), y = d.y + 4;
        if (this.inside(x, y) && this.free(this.idx(x, y))) this.put(this.idx(x, y), K.WATER);
      } else if (d.type === 'sower') this.sow(d);
    }
    // Agents: fall, walk, step up one cell, turn at walls, harvest what they reach.
    // They walk through plants (in front of them), not through soil or stone.
    const open = (x, y) => {
      if (!this.inside(x, y)) return false;
      const i = this.idx(x, y), k = this.kind[i];
      return !this.solid[i] && (k === K.EMPTY || k === K.WATER || k === K.LEAF || k === K.STEM || k === K.PETAL || k === K.BUD);
    };
    const clearCol = (x, y0, y1) => { for (let y = y0; y <= y1; y++) if (!open(x, y)) return false; return true; };
    const clearRow = (y, x0, x1) => { for (let x = x0; x <= x1; x++) if (!open(x, y)) return false; return true; };
    for (const a of this.agents) {
      if (++a.t % 2) continue;
      const cx = a.x + 2, feet = a.y + 3;
      // Head for the nearest flower in bloom; after giving up on a wall, wander a while.
      if (a.cool > 0) a.cool--;
      else {
        let best = null, bd = 1e9;
        for (const p of this.plants.values()) {
          if (p.stage !== 'bloom') continue;
          const d = Math.abs((p.base % this.cols) - cx) + Math.abs(((p.base / this.cols) | 0) - feet) * 2;
          if (d < bd) { bd = d; best = p; }
        }
        if (best && Math.abs((best.base % this.cols) - cx) > 1) a.dir = (best.base % this.cols) > cx ? 1 : -1;
      }
      const ax = a.dir > 0 ? a.x + 4 : a.x - 1;
      const wall = !clearCol(ax, a.y, a.y + 3);
      // Fall, unless clinging to a wall it's climbing.
      if (!(wall && a.climb) && clearRow(a.y + 4, a.x, a.x + 3)) { a.y++; a.climb = 0; continue; }
      let moved = false;
      for (let up = 0; up <= 2 && !moved; up++) {
        let room = clearCol(ax, a.y - up, a.y + 3 - up);
        for (let k = 1; room && k <= up; k++) room = clearRow(a.y - k, a.x, a.x + 3); // head-room to step up
        if (room) { a.x += a.dir; a.y -= up; moved = true; a.climb = 0; }
      }
      if (!moved) {
        // Too tall to step: climb the wall, up to a point.
        if (a.climb < 32 && clearRow(a.y - 1, a.x, a.x + 3)) { a.y--; a.climb++; }
        else { a.dir = -a.dir; a.cool = 60; a.climb = 0; }
      }
      // A flowering plant whose stem it reaches gets climbed and harvested.
      for (const p of this.plants.values()) {
        if (p.stage !== 'bloom') continue;
        const px = p.base % this.cols, py = (p.base / this.cols) | 0;
        if (Math.abs(px - cx) > 2 || py < a.y - 2 || py > feet + 6) continue;
        const got = this.harvest(p);
        if (got) this.events.push({ type: 'harvest', by: 'agent', ...got, x: cx, y: a.y });
      }
    }
  }

  /** RGBA per cell for the renderer: kind, colour or moisture, grain, health. */
  paint(buf) {
    const { n, kind, data, grain, owner } = this;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      const k = kind[i];
      buf[o] = k;
      if (!k) { buf[o + 1] = this.lit[i]; continue; } // empty: how much light passes (beam dust)
      buf[o + 1] = data[i];
      buf[o + 2] = grain[i];
      const p = owner[i] >= 0 ? this.plants.get(owner[i]) : null;
      buf[o + 3] = p ? (p.health * 255) | 0 : 255;
    }
    for (const a of this.agents) {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const ch = AGENT[j][i];
        if (ch === '.' || !this.inside(a.x + i, a.y + j)) continue;
        const o = this.idx(a.x + i, a.y + j) * 4;
        buf[o] = ch === 'a' ? K.ACCENT : K.INK;
        buf[o + 1] = ch === 'a' ? 6 : 0;
        buf[o + 3] = 255;
      }
    }
  }
}
