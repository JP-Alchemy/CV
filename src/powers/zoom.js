// Powers of Ten (/projects/powers-of-ten/): one zoom, no cuts, from the CV
// out past the edge of the universe and down inside a proton. L is how much
// the view shows, as log10 of the metres across it; everything is centred on
// "here", the middle of the view, the way the Eameses centred theirs on a
// picnic.
//
// At rest the view is the CV page, as big as your screen really is. Zooming
// in, the page itself grows (the renderer's camera) about a letter of its
// title until one block fills the screen, and then it's the pixels, the
// glass, a bacterium on it, its proteins and DNA, one base pair, one of its
// carbon atoms, the nucleus and a proton. Zooming out, the page shrinks into
// the screen on my desk, then the room, the town, the Netherlands (the slime
// mould, still growing), the Earth, the planets, the stars, the galaxy and on.
// Each scale is a simulation that only runs while it's on screen.

import { Grid, Pen, Desk, Earth, Planets, Stars, Galaxy, Bacteria, Proteins, here, ramp, j2000, LY, AU } from './scenes.js';
import { geo, loadGeo } from './geo.js';
import { Street, Town, sunOverLeiden } from './street.js';
import { LocalGroup, Web, Bubbles } from './cosmos.js';
import { BasePair, Atom, Nucleus, Proton } from './atoms.js';
import { Satellites, Outer, Oort, Radio, voyager1, radioYears } from './orbits.js';
import { Pixels, Dna } from './small.js';
import { powersText as T } from '../content.js';
import places from '../slime/places.js';

const BOX = places.box; // the slime mould's map, km
const LEIDEN = [105.5, 154.7]; // km on that map (between Den Haag and Haarlem)
const MAP_REF = 800; // the map is laid out once at this width, then scaled
const L_MAX = 30.5;
const L_MIN = -14.72; // one proton, all of it
const RATE = 7; // how fast the view catches up with where you've zoomed to, per second
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** About how big a CSS pixel is: a laptop's or a phone's. */
const pxMetres = (touch) => (touch ? 1.7e-4 : 2.64e-4);

const sup = (n) => String(n).replace(/./g, (c) => SUP[c]);
const down = (L, a, b, c, d) => ramp(-L, -a, -b, -c, -d); // ramp() for scales below: a > b > c > d

/** A length in words, to two figures. */
export function inWords(m) {
  const two = (x) => {
    const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    const r = Math.round(x / p) * p;
    return r >= 1000 ? Math.round(r).toLocaleString('en-GB') : String(+r.toPrecision(2));
  };
  const ly = m / LY;
  for (const [n, w] of [[1e12, 'TRILLION'], [1e9, 'BILLION'], [1e6, 'MILLION']]) if (ly >= n) return `${two(ly / n)} ${w} LIGHT YEARS`;
  if (m >= 0.3 * LY) return `${two(ly)} LIGHT YEAR${ly >= 1.5 || ly < 0.95 ? 'S' : ''}`;
  if (m >= 1000) return `${two(m / 1000)} KM`;
  if (m >= 1) return `${two(m)} M`;
  if (m >= 0.01) return `${two(m * 100)} CM`;
  if (m >= 1e-3) return `${two(m * 1000)} MM`;
  if (m >= 1e-6) return `${two(m * 1e6)} MICROMETRES`;
  if (m >= 1e-9) return `${two(m * 1e9)} NANOMETRES`;
  if (m >= 1e-12) return `${two(m * 1e12)} PICOMETRES`;
  return `${two(m * 1e15)} FEMTOMETRES`;
}

export class Zoom {
  /** host: { renderer, now, kick, changed, calm, touch, dpr, dark, mould } */
  constructor(host) {
    this.host = host;
    this.on = false;
    this.grid = new Grid();
    this.L = null;
  }

  open() {
    if (this.on) return;
    this.on = true;
    this.hidden = false;
    this.L = this.Lt = null;
    this.days = j2000();
    this.last = null;
    this.seen = {};
    // The world's outlines, for the globe: a repaint once they're in.
    loadGeo().then(() => { this.painted = null; this.host.kick(); });
  }

  close() {
    if (!this.on) return;
    this.on = false;
    this.host.renderer.clearZoom?.();
    this.cam = null;
  }

  /** Under the menu: nothing zooms or draws. */
  hide(on) {
    this.hidden = on;
    if (on) { this.host.renderer.clearZoom?.(); this.cam = null; }
  }

  /** Where the page put things: z = { area: [x, y, w, h] (screen px), focus: [x, y, block] (px), cell }. */
  layout(z) {
    const [, , w, h] = z.area;
    this.area = z.area;
    this.focus = z.focus;
    this.cell = z.cell;
    this.touch = !!this.host.touch;
    this.px = pxMetres(this.touch);
    this.L0 = Math.log10(w * this.px);
    // One block fills the view.
    this.Lfill = this.L0 - Math.log10(Math.max(w, h) / z.focus[2]);
    // Where the pixels give way to the glass.
    this.Lpix = Math.min(-3.9, this.Lfill - 0.7);
    if (this.L === null) this.L = this.Lt = this.L0;
    this.L = this.clamp(this.L);
    this.Lt = this.clamp(this.Lt);
    const cols = Math.ceil(w / this.cell), rows = Math.ceil(h / this.cell);
    if (this.grid.cols !== cols || this.grid.rows !== rows) this.grid.resize(cols, rows);
    this.painted = null;
  }

  clamp(L) { return Math.max(L_MIN, Math.min(L_MAX, L)); }

  // ------------------------------------------------------------ input

  /** Wheel or drag, in px: down (positive) goes in. */
  wheel(d) { this.Lt = this.clamp((this.Lt ?? this.L0) - d * 0.0024); this.host.kick(); }

  /** Pinch: the fingers moved `ratio` times further apart. */
  pinch(ratio) { this.Lt = this.clamp(this.Lt - Math.log10(ratio)); this.L = this.clamp(this.L - Math.log10(ratio)); this.host.kick(); }

  /** By whole powers of ten (to the next one along). */
  by(n) {
    const k = n < 0 ? Math.ceil(this.Lt - 1e-6) + n : Math.floor(this.Lt + 1e-6) + n;
    this.Lt = this.clamp(k);
    this.host.kick();
  }

  home() { this.Lt = this.L0; this.host.kick(); }

  action(a) {
    if (a === 'zm:in') this.by(-1);
    else if (a === 'zm:out') this.by(1);
    else if (a === 'zm:home') this.home();
  }

  // ------------------------------------------------------------ what's where

  get atHome() { return Math.abs(this.L - this.L0) < 0.02; }

  /** px a metre, now. */
  get ppm() { return this.area[2] / Math.pow(10, this.L); }

  /** The middle of the view, on screen. */
  get centre() { return [this.area[0] + this.area[2] / 2, this.area[1] + this.area[3] / 2]; }

  /** For the renderer: how the page's blocks move. */
  camera() {
    if (!this.on || this.hidden || this.L === null) return null;
    const L = this.L, s = Math.pow(10, this.L0 - L);
    const C = this.centre, [x, y, w, h] = this.area;
    let F = C, A = C;
    if (s >= 1) {
      F = [this.focus[0], this.focus[1]];
      const k = Math.min(1, Math.log10(s) / 1.0), e = k * k * (3 - 2 * k);
      A = [F[0] + (C[0] - F[0]) * e, F[1] + (C[1] - F[1]) * e];
    }
    const clip = s >= 1 ? [x, y, x + w, y + h] : [A[0] + (x - F[0]) * s, A[1] + (y - F[1]) * s, A[0] + (x + w - F[0]) * s, A[1] + (y + h - F[1]) * s];
    const fade = L < this.L0 ? Math.max(0, Math.min(1, (L - (this.Lfill - 0.3)) / 0.35)) : Math.max(0, Math.min(1, (this.L0 + 2.1 - L) / 0.4));
    return { s, F, A, clip, fade };
  }

  /** Where the slime mould's map is (for slime/mode.js), while it's on screen. */
  slimeRect() {
    const f = this.vis?.map || 0;
    if (!f) return null;
    const k = this.ppm * 1000, C = this.centre;
    return {
      x: C[0] - (LEIDEN[0] - BOX[0]) * k, y: C[1] - (LEIDEN[1] - BOX[1]) * k, w: BOX[2] * k, h: BOX[3] * k,
      ref: { w: MAP_REF, h: Math.round((MAP_REF * BOX[3]) / BOX[2]) }, fade: f,
    };
  }

  // ------------------------------------------------------------ frames

  /** Each frame: catch up with the zoom, step what's on screen, paint the grid. True while it wants frames. */
  frame(t) {
    if (!this.on || this.hidden || this.L === null || !this.area) return false;
    const dt = this.last === null ? 1 / 60 : Math.min(0.05, Math.max(0, t - this.last));
    this.last = t;
    const moving = Math.abs(this.Lt - this.L) > 1e-4;
    if (moving) this.L += (this.Lt - this.L) * (1 - Math.exp(-dt * (this.host.calm?.() ? 20 : RATE)));
    else this.L = this.Lt;
    const L = this.L, L0 = this.L0, Lf = this.Lfill, Lp = this.Lpix;
    const vis = this.vis = {
      desk: ramp(L, L0, L0 + 0.08, 2.15, 2.55),
      town: ramp(L, 2.15, 2.55, 3.95, 4.45),
      here: Math.max(ramp(L, 2.6, 3.0, 3.9, 4.4), ramp(L, 5.6, 6.0, 7.3, 7.8)),
      map: ramp(L, 3.6, 4.2, 5.8, 6.3),
      earth: ramp(L, 4.9, 5.4, 8.6, 9.2),
      sats: ramp(L, 6.6, 7.0, 8.3, 8.6),
      planets: ramp(L, 8.2, 8.8, 14.5, 15.2),
      outer: ramp(L, 11.9, 12.4, 15.0, 15.6),
      oort: ramp(L, 14.2, 14.7, 16.9, 17.5),
      stars: ramp(L, 15.0, 15.6, 18.6, 19.3),
      radio: ramp(L, 16.6, 17.1, 20.9, 21.5),
      galaxy: ramp(L, 18.2, 18.9, 21.9, 22.5),
      group: ramp(L, 21.5, 22.1, 23.4, 24.0),
      web: ramp(L, 23.2, 23.9, 27.0, 27.6),
      bubbles: ramp(L, 27.0, 27.6, 99, 100),
      pixels: down(L, Lf + 0.02, Lf - 0.3, Lp, Lp - 0.45),
      glass: down(L, Lp + 0.15, Lp - 0.3, -6.4, -6.9),
      proteins: down(L, -5.4, -5.9, -7.3, -7.7),
      dna: down(L, -6.2, -6.6, -8.1, -8.5),
      pair: down(L, -7.9, -8.3, -9.55, -9.95),
      atom: down(L, -9.3, -9.7, -12.6, -13.2),
      nucleus: down(L, -13.2, -13.6, -14.3, -14.55),
      proton: down(L, -14.25, -14.5, -99, -100),
    };
    const now = this.host.now();
    // The slime mould starts growing the first time it's seen.
    if (vis.map && !this.seen.map) { this.seen.map = true; this.host.mould?.arriveAt(now); }

    const [x, y, w, h] = this.area;
    const V = {
      cx: w / 2, cy: h / 2, ppm: this.ppm, cell: this.cell, cols: this.grid.cols, rows: this.grid.rows,
      screen: [w * this.px, h * this.px], touch: this.touch,
    };
    const P = new Pen(this.grid, V);
    let alive = false;
    if (vis.desk) { (this.desk ||= new Desk()).step(dt, V); (this.street ||= new Street()).step(dt); alive = true; }
    if (vis.town) { (this.town ||= new Town()).step(dt); alive = true; }
    if (vis.sats) { (this.sats ||= new Satellites()).step(dt); alive = true; }
    if (vis.planets) { this.days += dt; alive = true; }
    if (vis.radio) { (this.radio ||= new Radio()).step(dt); alive = true; } else this.radio?.reset();
    if (vis.galaxy) { (this.galaxy ||= new Galaxy()).step(dt * 30); alive = true; }
    if (vis.group) {
      (this.group ||= new LocalGroup()).step(dt * 100);
      alive = true;
      if (!this.web && !this.webSoon) this.webSoon = setTimeout(() => { this.web ||= new Web(); }, 0); // the web takes a moment to build: start it before it's needed
    }
    if (vis.web && (this.web ||= new Web()).step(dt)) alive = true;
    if (vis.bubbles) { (this.bubbles ||= new Bubbles()).step(dt); alive = true; }
    if (vis.glass || vis.proteins || vis.dna) { (this.bacteria ||= new Bacteria()).step(dt); alive = true; }
    if (vis.proteins) { (this.proteins ||= new Proteins()).step(dt); }
    if (vis.dna) { (this.dna ||= new Dna()).step(dt); alive = true; }
    if (vis.pair) { (this.pair ||= new BasePair()).step(dt); alive = true; }
    if (vis.atom) { (this.atom ||= new Atom()).step(dt); alive = true; }
    if (vis.nucleus) { (this.nucleus ||= new Nucleus()).step(dt); alive = true; }
    if (vis.proton) { (this.proton ||= new Proton()).step(dt); alive = true; }

    const changed = moving || alive || this.painted !== L;
    if (changed) {
      this.grid.clear();
      if (vis.desk) {
        this.desk.paint(P, V, vis.desk, t);
        this.street.paint(P, V, vis.desk, t, this.desk.geo(V), sunOverLeiden(j2000()));
      }
      if (vis.town) this.town.paint(P, V, vis.town);
      if (vis.here) here(P, vis.here);
      if (vis.earth) (this.earth ||= new Earth()).paint(P, V, vis.earth, j2000(), { geo, nlOpen: vis.map > 0.2 });
      if (vis.sats) this.sats.paint(P, V, vis.sats);
      if (vis.planets) (this.planets ||= new Planets()).paint(P, V, vis.planets, this.days);
      if (vis.outer) (this.outer ||= new Outer()).paint(P, V, vis.outer, this.days);
      if (vis.oort) (this.oort ||= new Oort()).paint(P, V, vis.oort);
      if (vis.stars) (this.stars ||= new Stars()).paint(P, V, vis.stars);
      if (vis.radio) this.radio.paint(P, V, vis.radio);
      if (vis.galaxy) this.galaxy.paint(P, V, vis.galaxy);
      if (vis.group) this.group.paint(P, V, vis.group);
      if (vis.web) { this.web.paint(P, V, vis.web); if (L > 25.6) this.web.edge(P, V, vis.web); }
      if (vis.bubbles) this.bubbles.paint(P, V, vis.bubbles);
      if (vis.pixels) {
        (this.pixels ||= new Pixels()).paint(P, V, vis.pixels, {
          pitch: this.px / (this.host.dpr?.() || 1), block: this.focus[2] * this.px, dark: !!this.host.dark?.(),
          slide: Math.max(0, Math.min(1, (Lf - 0.45 - L) / 0.4)),
        });
      }
      if (vis.glass) this.bacteria.paint(P, V, vis.glass);
      const inCell = (i, j) => this.bacteria.within(P, V, i, j);
      if (vis.proteins) this.proteins.paint(P, V, vis.proteins, inCell);
      if (vis.dna) this.dna.paint(P, V, vis.dna, inCell);
      if (vis.pair) this.pair.paint(P, V, vis.pair, Math.max(0, Math.min(1, (-8.75 - L) / 0.55)));
      if (vis.atom) this.atom.paint(P, V, vis.atom);
      if (vis.nucleus) this.nucleus.paint(P, V, vis.nucleus);
      if (vis.proton) this.proton.paint(P, V, vis.proton);
      this.host.renderer.setZoom?.({ cols: this.grid.cols, rows: this.grid.rows, buf: this.grid.buf, x, y, cell: this.cell });
      this.painted = L;
    }
    this.tell();
    return moving || alive;
  }

  // ------------------------------------------------------------ words

  /** The panel's readout and caption; the page re-renders when they change (a few times a second at most). */
  tell() {
    const v = this.view();
    if (!v) return;
    const key = `${v.readout}|${v.size}|${v.caption}|${v.home}`;
    if (key === this.toldKey) return;
    const t = this.host.now();
    if (t - (this.toldAt || 0) < 0.25) { this.host.kick(); return; }
    this.toldKey = key;
    this.toldAt = t;
    this.host.changed();
  }

  view() {
    if (this.L === null || !this.area) return null;
    const L = this.L, L0 = this.L0, Lf = this.Lfill, S = T.scales;
    const fill = (s) => s
      .replace('{SIZE}', inWords(Math.pow(10, L0)))
      .replace('{BLOCK}', inWords(this.focus[2] * this.px))
      .replace('{V1}', `${((voyager1(j2000()) * AU) / 2.998e8 / 3600).toFixed(1)} HOURS`)
      .replace('{RADIO}', `${Math.round(2 * radioYears())} LIGHT YEARS`)
      .replace('{ACT}', this.touch ? 'TAP' : 'CLICK')
      .replace('{HOW}', this.touch ? S.howTouch : S.how);
    const caption =
      L > 27.3 ? S.bubbles
      : L > 25.9 ? S.universe
      : L > 23.4 ? S.web
      : L > 21.7 ? S.group
      : L > 19.2 ? S.galaxy
      : L > 17.7 ? S.radio
      : L > 15.9 ? S.stars
      : L > 14.4 ? S.oort
      : L > 12.6 ? S.voyager
      : L > 9.5 ? S.planets
      : L > 8.4 ? S.moon
      : L > 7.75 ? S.orbits
      : L > 7.3 ? S.earth
      : L > 6.4 ? S.europe
      : L > 5.7 ? S.country
      : L > 3.9 ? S.nl
      : L > 3.35 ? S.edge
      : L > 2.35 ? S.town
      : L > 1.3 ? S.house
      : L > 0.7 ? S.room
      : L > L0 + 0.08 ? S.desk
      : L >= L0 - 0.4 ? S.page
      : L > Lf + 0.3 ? S.letter
      : L > Lf - 0.3 ? S.block
      : L > this.Lpix ? S.pixels
      : L > -5.0 ? S.glass
      : L > -5.9 ? S.cell
      : L > -6.6 ? S.proteins
      : L > -8.2 ? S.dna
      : L > -9.6 ? S.pair
      : L > -11.3 ? S.atom
      : L > -13.4 ? S.inside
      : L > -14.4 ? S.nucleus
      : S.proton;
    return {
      readout: `10${sup(Math.round(L))} M`,
      size: `${inWords(Math.pow(10, L))} ACROSS`,
      caption: fill(caption),
      home: this.atHome,
    };
  }
}
