// The garden's first lesson (/garden/), for someone who hasn't grown a
// flower yet: from a seed in a pot to collecting its seeds, in four steps.
// Each step says what to do, points at where (scene.js draws a box, an arrow
// and a mark, and lights up the tool it needs), and moves on once it's done.
// garden/mode.js tells it what happens.
import { K, CELL, COLOURS, NEEDS } from './sim.js';

const YELLOW = 2; // the easiest colour: some light, little water
// How high over the soil the light goes, in cells: close enough to grow by
// (it shades the seed from the daylight, so it's all the light there is),
// high enough that the grown flower isn't right under it.
const LIFT = 24;
const NUMBER = { drop: 1, light: 2, grow: 3, collect: 4 };

export class Tutorial {
  constructor(garden) {
    this.g = garden;
    this.reset();
  }

  /** Back to the first step: a new garden, or the seedling didn't make it (`why`). */
  reset(why = null) {
    this.step = 'drop';
    this.at = -1; // the seed being taught, as a cell
    this.top = -1; // the open cell over the soil it's planted in
    this.why = why;
    this.got = null;
  }

  // ---------------------------------------------------------------- what happens

  planted(i) {
    if (this.step !== 'drop') return;
    const s = this.g.sim;
    this.at = i;
    this.gene = s.data[i];
    while (i >= s.cols && s.soil(i - s.cols)) i -= s.cols;
    this.top = Math.max(0, i - s.cols);
    this.why = null;
    this.step = NEEDS[this.gene].light > 0.5 ? 'light' : 'grow'; // the shade-lovers skip the light
  }

  bloomed(p) {
    if ((this.step === 'light' || this.step === 'grow') && p.base === this.at) { this.step = 'collect'; this.bud = p.bud; }
  }

  collected(got) {
    if (this.step === 'collect') { this.step = 'done'; this.got = got; }
  }

  died(p) {
    if (p.base !== this.at || this.step === 'done') return;
    const why = { wet: 'TOO WET', dry: 'TOO DRY', bright: 'TOO MUCH LIGHT', dark: 'NOT ENOUGH LIGHT', deep: 'TOO DEEP' }[p.mood] || 'UNHAPPY';
    this.reset(`IT DIED (${why}).`);
  }

  /** Move on by itself where it can: the light is hung, or the seed is gone. */
  update() {
    const s = this.g.sim;
    if (!s || this.at < 0) return;
    const p = this.plant();
    if (!p && s.kind[this.at] !== K.SEED && this.step !== 'collect' && this.step !== 'done') { this.reset('THE SEED WAS LOST.'); return; }
    if (this.step === 'light' && this.lit()) this.step = 'grow';
    if (this.step === 'grow' && p?.stage === 'bloom') { this.step = 'collect'; this.bud = p.bud; }
  }

  // ---------------------------------------------------------------- where things are

  plant() {
    for (const p of this.g.sim.plants.values()) if (p.base === this.at) return p;
    return null;
  }

  /** The pot to plant in: the first with open sky over it (or the first pot, or the ground). */
  pot() {
    const s = this.g.sim;
    if (this.potFor !== s) {
      const pots = this.g.beds.length > 1 ? this.g.beds.slice(1) : this.g.beds;
      this.potFor = s;
      this.potBed = pots.find((b) => { const c = this.g.cellAt(b.x, b.level); return c && s.sky(s.idx(c[0], c[1])); }) || pots[0];
    }
    return this.potBed;
  }

  px(i) {
    const s = this.g.sim;
    return [this.g.x0 + (i % s.cols) * CELL + CELL / 2, this.g.y0 + ((i / s.cols) | 0) * CELL + CELL / 2];
  }

  /** Where the light should hang: LIFT cells over the seed, below anything solid. */
  spot() {
    const s = this.g.sim;
    let i = this.top;
    for (let k = 0; k < LIFT && i >= s.cols * 2 && s.free(i - s.cols) && s.free(i - s.cols * 2); k++) i -= s.cols;
    return i;
  }

  /** Enough light from the hung lights reaching the seed for its colour. */
  lit() {
    return this.g.sim.lit[this.top] / 255 >= NEEDS[this.gene].light - 0.22;
  }

  // ---------------------------------------------------------------- what it says

  /**
   * The step for the toolbar and the page: label, text, where to point
   * (`target`, screen px; or the toolbar's `tool` or seed `chip` when one
   * needs pressing first), a spot to `mark`, and the box's button.
   */
  view() {
    const g = this.g, s = g.sim;
    if (!s) return null;
    this.update();
    const v = { label: this.step === 'done' ? 'WELL DONE' : `STEP ${NUMBER[this.step]} OF 4`, target: null, mark: null, tool: null, chip: null, button: 'SKIP' };
    const say = (text) => { v.text = this.why ? `${this.why} ${text}` : text; };
    if (this.step === 'drop') {
      const b = this.pot();
      if (g.tool !== 'seed') { say('PICK SEED IN THE TOOLBAR.'); v.tool = 'seed'; }
      else if (g.seed !== YELLOW && !this.picked) { say("PICK THE YELLOW SEED. IT'S THE EASIEST TO GROW."); v.chip = YELLOW; }
      else { say('CLICK JUST ABOVE THIS POT TO DROP A SEED IN.'); v.target = v.mark = [b.x, b.level - 10 * CELL]; }
      if (g.seed === YELLOW) this.picked = true;
    } else if (this.step === 'light') {
      v.target = v.mark = this.px(this.spot());
      const c = COLOURS[this.gene];
      if (g.tool !== 'light') { say(`PLANTED. A ${c} SEED WANTS LIGHT: PICK LIGHT IN THE TOOLBAR.`); v.tool = 'light'; }
      else if (s.lights.length) say('A LITTLE CLOSER. CLICK A LIGHT TO TAKE IT DOWN, THEN CLICK THE MARK.');
      else say('CLICK THE MARK TO HANG A LIGHT OVER THE SEED.');
    } else if (this.step === 'grow') {
      const p = this.plant();
      v.target = this.px(p && p.top < this.top ? p.top : this.top);
      v.arrow = false; // nothing to click: the box just sits by it
      if (!p) say('THE SOIL IS DAMP, SO IT WILL SPROUT SOON.');
      else if (p.mood === 'dry') { say("IT'S THIRSTY. PICK WATER AND POUR A LITTLE ON IT."); v.tool = g.tool === 'water' ? null : 'water'; }
      else if (p.mood === 'wet') say('TOO WET. GIVE IT A MOMENT TO DRY OUT.');
      else if (p.mood === 'dark') { say('IT WANTS MORE LIGHT. HANG A LIGHT CLOSER OVER IT.'); v.tool = g.tool === 'light' ? null : 'light'; }
      else if (p.mood === 'bright') { say('TOO BRIGHT. CLICK A LIGHT WITH THE LIGHT TOOL TO TAKE IT DOWN.'); v.tool = g.tool === 'light' ? null : 'light'; }
      else {
        const pct = p.stage === 'grow' ? Math.round((p.height / p.target) * 80) : 80 + Math.round((p.budEnergy / 5) * 20);
        say(`GROWING: ${Math.min(99, pct)}%. JUST WATCH IT GO.`);
      }
    } else if (this.step === 'collect') {
      const [bx, by] = this.px(this.bud);
      v.target = [bx, by - 3 * CELL]; // just over the petals
      say('IT BLOOMED! CLICK THE FLOWER TO COLLECT ITS SEEDS.');
    } else {
      const got = this.got;
      say(`${got.count} ${COLOURS[got.gene]} SEEDS COLLECTED. NOW FIND ALL SEVEN: TWO COLOURS SIDE BY SIDE CROSS.`);
      v.button = 'GOT IT';
    }
    return v;
  }
}
