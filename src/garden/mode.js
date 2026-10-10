// The garden page (/garden/): its heading, pots and ground freeze into
// terrain for a falling-sand garden, and the pots and ground fill with soil.
// Plant seeds in the soil (or drop them and bury them in sand), water them,
// hang lights over them, and grow all seven spectrum colours. Flowers
// harvested beside another colour give crossed seeds; sprinklers, sowers and
// agents unlock as the spectrum fills in. Progress (colours, seeds) is kept
// locally.
import { Sim, K, CELL, COLOURS, PRIMARY, NEEDS } from './sim.js';

const KEY = 'garden.v1';
const LIMIT = { light: 16, sprinkler: 4, sower: 3, agent: 3 };
const TOOLS = ['seed', 'sand', 'water', 'light', 'sprinkler', 'sower', 'agent'];
const TIPS = {
  seed: 'DROP A SEED OVER SOIL AND IT PLANTS ITSELF. CLICK A FLOWER TO HARVEST.',
  sand: 'HOLD TO POUR SAND. BURY SEEDS IN IT.',
  water: 'HOLD TO POUR WATER. IT SOAKS INTO SAND.',
  light: 'CLICK TO HANG A LIGHT. IT SHINES DOWN. CLICK IT AGAIN TO TAKE IT DOWN.',
  sprinkler: 'CLICK TO PLACE A SPRINKLER. IT DRIPS WATER BELOW IT.',
  sower: 'PICK A COLOUR, THEN PLACE A SOWER. IT SOWS THAT COLOUR BELOW IT.',
  agent: 'CLICK TO DROP AN AGENT. IT WALKS TO FLOWERS AND HARVESTS THEM.',
};
const lower = (k) => COLOURS[k].toLowerCase();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.found?.length === 7) return s;
  } catch { /* private mode or corrupt */ }
  return { found: [false, false, false, false, false, false, false], seeds: [0, 0, 0, 0, 0, 0, 0], bloomed: 0 };
}

export class Garden {
  /** host: { renderer, engine, pulse(x, y), changed(), scene(), S() } */
  constructor(host) {
    this.host = host;
    this.sim = null;
    this.ui = null;
    this.pointer = null;
    this.acc = 0;
    this.last = 0;
    this.msg = null;
    this.hintAt = 0;
  }

  get on() { return !!this.sim; }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.progress)); } catch { /* fine */ }
  }

  unlocked() {
    const p = this.progress, found = p.found.filter(Boolean).length;
    return {
      sprinkler: p.bloomed > 0,
      sower: p.found.some((f, k) => f && !PRIMARY.includes(k)),
      agent: found >= 5,
    };
  }

  /** The toolbar's view of the garden (read by the scene). */
  view() {
    const u = this.unlocked();
    return {
      tool: this.tool,
      seed: this.seed,
      found: this.progress.found,
      seeds: this.progress.seeds.map((n, k) => (PRIMARY.includes(k) ? Infinity : n)),
      tools: TOOLS.filter((t) => !(t in u) || u[t]),
      every: TOOLS, // for sizing the toolbar as it will be once all are unlocked
      hint: this.msg && this.msg.until > this.host.now() ? this.msg.text : this.hint(),
    };
  }

  // ---------------------------------------------------------------- enter / leave

  /** Load progress and pick up the tools (before the toolbar is drawn). */
  open() {
    this.progress = load();
    this.tool = 'seed';
    this.seed = 2; // yellow: the most forgiving
  }

  /**
   * Freeze the page into terrain. `area` is the screen rect the garden may
   * use; its `beds` (garden/bed.js) are filled with soil, from the bottom up.
   */
  enter(area) {
    this.x0 = 0;
    this.bottom = area.bottom;
    this.y0 = Math.ceil(area.top / CELL) * CELL;
    this.cols = Math.ceil(area.width / CELL);
    this.rows = Math.max(8, Math.floor((area.bottom - this.y0) / CELL));
    const solid = new Uint8Array(this.cols * this.rows);
    const sy = window.scrollY;
    for (const E of this.host.scene().elements) {
      if (E.fixed || !E.blocks?.length) continue;
      const b = E.blocks;
      for (let i = 0; i < b.length; i += 5) {
        if (b[i + 4] < 0.2 || b[i + 2] <= 0) continue;
        const x0 = Math.floor((b[i] - this.x0) / CELL), x1 = Math.floor((b[i] + b[i + 2] - 0.01 - this.x0) / CELL);
        const y0 = Math.floor((b[i + 1] - sy - this.y0) / CELL), y1 = Math.floor((b[i + 1] + b[i + 3] - 0.01 - sy - this.y0) / CELL);
        if (y1 < 0 || y0 >= this.rows || x1 < 0 || x0 >= this.cols) continue;
        for (let y = Math.max(0, y0); y <= Math.min(this.rows - 1, y1); y++) {
          for (let x = Math.max(0, x0); x <= Math.min(this.cols - 1, x1); x++) solid[y * this.cols + x] = 1;
        }
      }
    }
    this.sim = new Sim(this.cols, this.rows, solid);
    this.filling = this.fill(area.beds || []);
    // Sowers sow from your seeds (red, yellow and blue never run out).
    this.sim.take = (gene) => {
      if (PRIMARY.includes(gene)) return true;
      if (!(this.progress.seeds[gene] > 0)) return false;
      this.progress.seeds[gene]--;
      this.save();
      this.host.changed();
      return true;
    };
    this.buf = new Uint8Array(this.cols * this.rows * 4);
    this.started = this.host.now();
    this.last = this.started;
    this.acc = 0;
    this.say(this.progress.bloomed ? 'WELCOME BACK. GROW ALL SEVEN COLOURS.' : 'PICK A SEED, THEN CLICK OVER A POT TO DROP IT IN.', 5);
  }

  /** The cells the beds fill: what's open below each level that its point can reach, lowest last. */
  fill(beds) {
    const s = this.sim, out = [], seen = new Uint8Array(s.n);
    for (const b of beds) {
      const start = this.cellAt(b.x, b.y), level = Math.floor((b.level - this.y0) / CELL);
      if (!start) continue;
      const stack = [s.idx(start[0], start[1])];
      while (stack.length) {
        const i = stack.pop();
        if (seen[i] || !s.free(i)) continue;
        const x = i % s.cols, y = (i / s.cols) | 0;
        if (y < level - (b.hills ? b.hills(x) : 0)) continue;
        seen[i] = 1;
        out.push([i, b.damp]);
        if (x > 0) stack.push(i - 1);
        if (x < s.cols - 1) stack.push(i + 1);
        if (y > 0) stack.push(i - s.cols);
        if (y < s.rows - 1) stack.push(i + s.cols);
      }
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  /** Hand every grain back to the page: they fly into its blocks and vanish. */
  leave() {
    const s = this.sim;
    if (!s) return;
    const sy = window.scrollY, out = [];
    const tone = { [K.SAND]: 0.5, [K.WATER]: 0.35, [K.DEAD]: 0.3, [K.SEED]: 1 };
    for (let i = 0; i < s.n; i++) {
      const k = s.kind[i];
      if (!k || (out.length > 36000 && Math.random() < 0.5)) continue;
      out.push(this.x0 + (i % s.cols) * CELL, this.y0 + ((i / s.cols) | 0) * CELL + sy, 3, 3, tone[k] ?? 0.85);
    }
    this.sim = null;
    this.host.renderer.clearGarden();
    this.host.engine.absorb(Float32Array.from(out), sy);
    this.save();
  }

  // ---------------------------------------------------------------- tools

  select(action) {
    const [, what, arg] = action.split(':');
    if (what === 'tool') { this.tool = arg; this.say(TIPS[arg], 5); }
    if (what === 'seed') {
      const k = Number(arg);
      if (PRIMARY.includes(k) || this.progress.seeds[k] > 0) { this.seed = k; this.tool = 'seed'; this.say(this.needs(k), 4); }
      else if (this.progress.found[k]) this.say(`NO ${COLOURS[k]} SEEDS LEFT. HARVEST A ${COLOURS[k]} FLOWER FOR MORE.`, 4);
      else this.say(`${COLOURS[k]}: NOT GROWN YET. CROSS TWO COLOURS TO FIND IT.`, 4);
    }
    this.host.changed();
  }

  needs(k) {
    const n = NEEDS[k];
    const water = n.water < 0.3 ? 'LITTLE WATER' : n.water < 0.5 ? 'SOME WATER' : 'LOTS OF WATER';
    const light = n.light > 0.75 ? 'LOTS OF LIGHT' : n.light > 0.5 ? 'SOME LIGHT' : 'SHADE';
    return `${COLOURS[k]}: ${light}, ${water}.`;
  }

  cellAt(x, y) {
    const cx = Math.floor((x - this.x0) / CELL), cy = Math.floor((y - this.y0) / CELL);
    return this.sim.inside(cx, cy) ? [cx, cy] : null;
  }

  down(x, y) {
    if (!this.sim) return;
    const c = this.cellAt(x, y);
    if (!c) return;
    const s = this.sim, i = s.idx(c[0], c[1]);
    this.pointer = { x, y };
    if (this.tool === 'seed') {
      const p = s.flowerAt(i);
      if (p) { this.gather(s.harvest(p), x, y); this.pointer = null; return; }
      const k = this.seed;
      if (!PRIMARY.includes(k) && !(this.progress.seeds[k] > 0)) { this.say(`NO ${COLOURS[k]} SEEDS LEFT.`, 3); return; }
      this.pointer = null;
      // In the air it drops from where you clicked (and plants itself where
      // it lands); clicked on soil, it goes straight in there.
      const spot = this.spot(c[0], c[1]);
      if (spot >= 0) { s.put(spot, K.SEED, k); this.say(`PLANTED. ${this.needs(k)}`, 4); }
      else if (s.free(i)) s.put(i, K.SEED, k);
      else return;
      if (!PRIMARY.includes(k)) { this.progress.seeds[k]--; this.save(); this.host.changed(); }
    } else if (LIMIT[this.tool]) {
      // Click a light or machine with its own tool to take it away again.
      this.pointer = null;
      const t = this.tool;
      if (s.remove(i, t)) { this.say(`${t.toUpperCase()} REMOVED.`, 2); return; }
      const placed = t === 'agent' ? s.agents.length : t === 'light' ? s.lights.length : s.devices.filter((d) => d.type === t).length;
      if (placed >= LIMIT[t]) { this.say(`THAT'S ALL THE ${t.toUpperCase()}S FOR NOW (${LIMIT[t]}).`, 3); return; }
      const ok = t === 'agent' ? s.addAgent(c[0] - 2, c[1] - 2) : t === 'light' ? s.hang(c[0] - 1, c[1] - 1) : s.place(t, c[0] - 2, c[1] - 2, this.seed);
      if (!ok) { this.say('NOT ENOUGH ROOM THERE.', 2); return; }
      if (t === 'light') this.host.pulse(x, y);
      if (t === 'sower') this.say(`A ${COLOURS[this.seed]} SOWER.${PRIMARY.includes(this.seed) || this.progress.seeds[this.seed] ? '' : ` IT WAITS FOR ${COLOURS[this.seed]} SEEDS.`}`, 4);
    }
  }

  /**
   * Where a seed clicked onto soil goes: two cells under the surface there.
   * -1 if the cell isn't soil, or there isn't room under it.
   */
  spot(x, y) {
    const s = this.sim, at = (yy) => s.idx(x, yy);
    if (!s.soil(at(y))) return -1;
    while (y > 0 && s.soil(at(y - 1))) y--; // up to the surface
    return y + 2 < s.rows && s.soil(at(y + 1)) && s.soil(at(y + 2)) ? at(y + 2) : -1;
  }

  move(x, y) { if (this.pointer) this.pointer = { x, y }; }
  up() { this.pointer = null; }

  gather(got, x, y) {
    if (!got) return;
    const p = this.progress;
    p.seeds[got.gene] += got.count;
    this.save();
    const what = `${got.count} ${COLOURS[got.gene]} SEEDS`;
    this.say(got.crossed ? `CROSSED ${COLOURS[got.from]} WITH ${COLOURS[got.with]}: ${what}.` : `HARVESTED ${what}.`, 4);
    if (x !== undefined) this.host.pulse(x, y);
    this.host.changed();
  }

  // ---------------------------------------------------------------- frame

  /** Advance the garden to time t and upload it. pulses: the click light's rings. */
  frame(t, pulses, light) {
    const s = this.sim;
    if (!s) return;
    const dt = Math.min(0.1, t - this.last);
    this.last = t;
    this.acc += dt;
    const sy = window.scrollY;
    while (this.acc >= 1 / 60) {
      this.acc -= 1 / 60;
      // The soil fills in from the bottom up, over the first half second or so.
      if (this.filling.length) {
        const n = Math.max(40, Math.ceil(this.filling.length / 20));
        for (const [i, damp] of this.filling.splice(-n)) if (s.free(i)) { s.put(i, K.SAND); s.data[i] = damp; }
      }
      if (this.pointer) {
        const c = this.cellAt(this.pointer.x, this.pointer.y);
        if (c && this.tool === 'sand') s.pour(c[0], c[1], 2, K.SAND, 4);
        if (c && this.tool === 'water') s.pour(c[0], c[1], 2, K.WATER, 5);
      }
      // The click light feeds plants it passes (unless they're under soil).
      for (const p of s.plants.values()) {
        const above = p.top - s.cols;
        if (above >= 0 && s.soil(above)) continue;
        const px = this.x0 + (p.top % s.cols) * CELL + 2, py = this.y0 + ((p.top / s.cols) | 0) * CELL + 2 + sy;
        for (const q of pulses) {
          const age = t - q.t, r = Math.hypot(px - q.x, py - q.y);
          const u = (age * light.speed - r) / light.width;
          if (u <= 0 || u >= 1) continue;
          const fade = 1 - Math.min(1, Math.max(0, (age - 0.8) / 0.7));
          p.lightIn += Math.sin(Math.PI * u) * q.s * Math.exp(-r / 700) * fade * (1 / 60) * 11;
        }
      }
      s.step();
    }
    for (const e of s.events.splice(0)) this.event(e, sy);
    if (t - this.hintAt > 0.5) {
      this.hintAt = t;
      const h = this.view().hint;
      if (h !== this.shown) { this.shown = h; this.host.changed(); }
    }
    s.paint(this.buf);
    this.host.renderer.setGarden({ cols: s.cols, rows: s.rows, x0: this.x0, y0: this.y0, cell: CELL, buf: this.buf });
  }

  event(e, sy) {
    const s = this.sim, p = this.progress;
    const at = (i) => [this.x0 + (i % s.cols) * CELL + 2, this.y0 + ((i / s.cols) | 0) * CELL + 2];
    if (e.type === 'planted') {
      if (!s.devices.some((d) => d.sx === e.at % s.cols)) this.say(`PLANTED. ${this.needs(e.gene)}`, 4); // a sower's seeds plant quietly
    } else if (e.type === 'bloom') {
      const before = this.unlocked(), first = !p.found[e.plant.gene];
      p.bloomed++;
      p.found[e.plant.gene] = true;
      this.save();
      const [x, y] = at(e.plant.bud);
      this.host.pulse(x, y);
      const after = this.unlocked(), n = p.found.filter(Boolean).length;
      let text = first ? `NEW COLOUR: ${COLOURS[e.plant.gene]}. ${n} OF 7.` : `A ${COLOURS[e.plant.gene]} FLOWER. CLICK IT WITH SEEDS TO HARVEST.`;
      if (after.sprinkler && !before.sprinkler) text = `FIRST BLOOM. HARVEST IT WITH THE SEED TOOL. SPRINKLER UNLOCKED.`;
      else if (after.sower && !before.sower) text = `NEW COLOUR: ${COLOURS[e.plant.gene]}. SOWER UNLOCKED: IT SOWS AND BURIES SEEDS FOR YOU.`;
      else if (after.agent && !before.agent) text = `NEW COLOUR: ${COLOURS[e.plant.gene]}. AGENT UNLOCKED: IT WALKS THE GARDEN AND HARVESTS.`;
      if (n === 7 && first) {
        text = 'THE FULL SPECTRUM. THANK YOU FOR GROWING IT.';
        for (let k = 0; k < 4; k++) setTimeout(() => this.host.pulse(Math.random() * innerWidth, this.y0 + Math.random() * s.rows * CELL), k * 350);
      }
      this.say(text, 6);
      this.host.changed();
    } else if (e.type === 'harvest') {
      const p2 = this.progress;
      p2.seeds[e.gene] += e.count;
      this.save();
      this.say(`AN AGENT HARVESTED ${e.count} ${COLOURS[e.gene]} SEEDS${e.crossed ? ` (A ${COLOURS[e.from]} × ${COLOURS[e.with]} CROSS)` : ''}.`, 4);
      this.host.changed();
    } else if (e.type === 'die') {
      const why = { wet: 'TOO MUCH WATER', dry: 'TOO DRY', bright: 'TOO MUCH LIGHT', dark: 'NOT ENOUGH LIGHT', deep: 'PLANTED TOO DEEP' }[e.plant.mood] || 'UNHAPPY';
      this.say(`THE ${COLOURS[e.plant.gene]} DIED (${why}). IT'S SOIL NOW.`, 4);
    }
  }

  say(text, seconds) { this.msg = { text, until: this.host.now() + seconds }; }

  /** What to do next, or what the unhappiest plant needs. */
  hint() {
    const s = this.sim;
    if (!s) return '';
    const n = this.progress.found.filter(Boolean).length;
    let worst = null;
    for (const p of s.plants.values()) if (p.mood !== 'ok' && (!worst || p.health < worst.health)) worst = p;
    if (worst) {
      const c = COLOURS[worst.gene];
      return { wet: `THE ${c} IS DROWNING. LESS WATER.`, dry: `THE ${c} IS THIRSTY.`, bright: `THE ${c} WANTS SHADE. MOVE THE LIGHTS AWAY.`, dark: `THE ${c} WANTS MORE LIGHT. HANG A LIGHT JUST ABOVE IT.` }[worst.mood];
    }
    let seeds = 0, buried = 0, dry = 0;
    for (let i = 0; i < s.n; i++) {
      if (s.kind[i] !== K.SEED) continue;
      seeds++;
      if (i >= s.cols && s.soil(i - s.cols)) { buried++; if (s.damp(i) <= 0.12) dry++; }
    }
    if (dry) return 'NOW WATER IT.';
    if (seeds > buried) return 'COVER THE SEED WITH SAND.';
    const plants = [...s.plants.values()];
    if (plants.some((p) => p.stage === 'bloom')) return 'CLICK A FLOWER WITH THE SEED TOOL TO HARVEST ITS SEEDS.';
    if (plants.length) return n ? `${n} OF 7 COLOURS. ${this.needs(plants[0].gene)}` : 'GROWING. A LIGHT ABOVE IT HELPS IT ALONG.';
    if (!seeds && !this.progress.bloomed) return 'PICK A SEED, THEN CLICK OVER A POT TO DROP IT IN.';
    if (n >= 1 && n < 7) return `${n} OF 7. FLOWERS THAT BLOOM SIDE BY SIDE CROSS WHEN YOU HARVEST THEM.`;
    return n === 7 ? 'THE FULL SPECTRUM. KEEP GARDENING.' : 'GROW ALL SEVEN COLOURS.';
  }
}
