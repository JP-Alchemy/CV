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
import { buildGlobe, sunInView, ball } from './globe.js';
import { Street, Town, Region, sunOverLeiden } from './street.js';
import { LocalGroup, Web, Web3, Bubbles } from './cosmos.js';
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
  /** host: { renderer, now, kick, changed, calm, touch, dpr, dark, mould, wantMould } */
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
    this.away = false;
    this.inputAt = 0;
    // The world's outlines, for the globe: a repaint once they're in.
    loadGeo().then(() => { this.painted = null; this.host.kick(); });
  }

  close() {
    if (!this.on) return;
    this.on = false;
    this.host.renderer.clearZoom?.();
    if (this.host.renderer.cam3d) this.host.renderer.cam3d.solid = this.host.renderer.cam3d.points = this.host.renderer.cam3d.far = null;
    this.cam = null;
  }

  /** Under the menu: nothing zooms or draws. */
  hide(on) {
    this.hidden = on;
    if (on) { this.host.renderer.clearZoom?.(); this.cam = null; if (this.host.renderer.cam3d) this.host.renderer.cam3d.solid = this.host.renderer.cam3d.points = this.host.renderer.cam3d.far = null; }
  }

  /**
   * Where the page put things: z = { area: [x, y, w, h] (screen px), focus:
   * [x, y, block] (px, the lit spot it zooms into), rects (the blocks round it,
   * px from the focus), cell, cv (it's the CV, not any page) }.
   */
  layout(z) {
    this.cv = !!z.cv;
    const [, , w, h] = z.area;
    this.area = z.area;
    this.focus = z.focus;
    this.rects = z.rects || [];
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
  wheel(d) { this.Lt = this.clamp((this.Lt ?? this.L0) - d * 0.0024); this.inputAt = this.host.now(); this.host.kick(); }

  /** Pinch: the fingers moved `ratio` times further apart. */
  pinch(ratio) { this.Lt = this.clamp(this.Lt - Math.log10(ratio)); this.L = this.clamp(this.L - Math.log10(ratio)); this.inputAt = this.host.now(); this.host.kick(); }

  /** By whole powers of ten (to the next one along). */
  by(n) {
    const k = n < 0 ? Math.ceil(this.Lt - 1e-6) + n : Math.floor(this.Lt + 1e-6) + n;
    this.Lt = this.clamp(k);
    this.inputAt = this.host.now();
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

  /**
   * Zoomed into any page but Powers of Ten's own: true once you've been away
   * and come back to the page's own size and let go, so the page can scroll
   * again. Close enough to it, left alone, it settles there.
   */
  get resting() {
    if (this.L === null || !this.area) return false;
    if (Math.abs(this.L - this.L0) > 0.1) this.away = true;
    // Barely pinched at all, it waits a moment longer before giving up.
    if (this.host.now() - this.inputAt < (this.away ? 0.35 : 1.2)) return false;
    if (Math.abs(this.Lt - this.L0) >= 0.08) return false;
    if (this.Lt !== this.L0) this.home();
    return Math.abs(this.L - this.L0) < 0.004; // close enough that letting go doesn't jump
  }

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
    const in3d = !!this.host.renderer.cam3d?.on; // in 3D the slime mould's map isn't drawn, so the region stays on until the country is small
    const vis = this.vis = {
      desk: ramp(L, L0, L0 + 0.08, 2.15, 2.55),
      town: ramp(L, 2.15, 2.55, 3.95, 4.45),
      here: ramp(L, 2.6, 3.0, 7.3, 7.8),
      region: in3d ? ramp(L, 3.7, 4.15, 5.9, 6.4) : ramp(L, 3.7, 4.15, 5.25, 5.75),
      map: ramp(L, 4.75, 5.25, 5.8, 6.3),
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
    // Out towards the Netherlands: the slime mould's worker starts, ready for when its map is on screen.
    if (L > 2.8 && !this.seen.mould) { this.seen.mould = true; this.host.wantMould?.(); }
    if (vis.map && !this.seen.map) { this.seen.map = true; this.host.mould?.arriveAt(now); }

    const [x, y, w, h] = this.area;
    const V = {
      cx: w / 2, cy: h / 2, ppm: this.ppm, cell: this.cell, cols: this.grid.cols, rows: this.grid.rows,
      screen: [w * this.px, h * this.px], touch: this.touch,
    };
    const P = new Pen(this.grid, V);
    const c3 = this.host.renderer.cam3d;
    if (c3?.on) P.S = []; // the 3D view: things in space are drawn where they are (Pen.dot3)
    else if (c3) c3.points = null;
    let alive = false;
    const solid = this.solid(vis, V, x, y, w, h); // in 3D, the Earth as a solid while it fits the screen; 0-1
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
      if (P.S && !this.web3 && !this.web3Soon) this.web3Soon = setTimeout(() => { this.web3 ||= new Web3(); }, 0); // and its 3D one (a fifth of a second)
    }
    if (vis.web && P.S && (this.web3 ||= new Web3()).step(dt)) alive = true; // in 3D, a web you can go round
    else if (vis.web && !P.S && (this.web ||= new Web()).step(dt)) alive = true;
    if (vis.bubbles) { (this.bubbles ||= new Bubbles()).step(dt); alive = true; }
    if (vis.glass || vis.proteins || vis.dna) { (this.bacteria ||= new Bacteria()).step(dt); alive = true; }
    if (vis.proteins) { (this.proteins ||= new Proteins()).step(dt); }
    if (vis.dna) { (this.dna ||= new Dna()).step(dt); alive = true; }
    if (vis.pair) { (this.pair ||= new BasePair()).step(dt); alive = true; }
    if (vis.atom) { (this.atom ||= new Atom()).step(dt); alive = true; }
    if (vis.nucleus) { (this.nucleus ||= new Nucleus()).step(dt); alive = true; }
    if (vis.proton) { (this.proton ||= new Proton()).step(dt); alive = true; }

    const changed = moving || alive || this.painted !== L || this.painted3d !== !!P.S; // and when the 3D view comes or goes
    this.painted3d = !!P.S;
    if (changed) {
      this.grid.clear();
      if (vis.desk) {
        this.desk.paint(P, V, vis.desk, t);
        this.street.paint(P, V, vis.desk, t, this.desk.geo(V), sunOverLeiden(j2000()));
      }
      if (vis.town) this.town.paint(P, V, vis.town);
      if (vis.region) (this.region ||= new Region(places, geo)).paint(P, V, vis.region);
      if (vis.here) here(P, vis.here);
      if (vis.earth && solid < 1) (this.earth ||= new Earth()).paint(P, V, vis.earth * (1 - solid), j2000(), { geo, nlOpen: (vis.map > 0.2 && !in3d) || vis.region > 0 });
      if (vis.sats) this.sats.paint(P, V, vis.sats);
      if (vis.planets) (this.planets ||= new Planets()).paint(P, V, vis.planets, this.days, { bodies: !this.solidPlanets });
      if (vis.outer) (this.outer ||= new Outer()).paint(P, V, vis.outer, this.days);
      if (vis.oort) (this.oort ||= new Oort()).paint(P, V, vis.oort);
      if (vis.stars) (this.stars ||= new Stars()).paint(P, V, vis.stars);
      if (vis.radio) this.radio.paint(P, V, vis.radio);
      if (vis.galaxy) this.galaxy.paint(P, V, vis.galaxy);
      if (vis.group) this.group.paint(P, V, vis.group);
      if (vis.web) { const W = P.S ? this.web3 : this.web; W.paint(P, V, vis.web); if (L > 25.6) W.edge(P, V, vis.web); }
      if (vis.bubbles) this.bubbles.paint(P, V, vis.bubbles);
      if (vis.pixels) {
        (this.pixels ||= new Pixels()).paint(P, V, vis.pixels, {
          pitch: this.px / (this.host.dpr?.() || 1), dark: !!this.host.dark?.(),
          rects: this.rects.map((r) => r.map((v) => v * this.px)),
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
      // From the town out to the Earth the grid is a view straight down onto the globe: in 3D it's lifted back onto it.
      const ground = !vis.desk && (vis.town || vis.region || vis.earth) ? [x + w / 2, y + h / 2, 6.371e6 * this.ppm, 6.371e6 * this.ppm + (this.zc ?? -6.371e6 * this.ppm)] : null;
      this.host.renderer.setZoom?.({ cols: this.grid.cols, rows: this.grid.rows, buf: this.grid.buf, x, y, cell: this.cell, ball: ground });
      if (c3) c3.far = in3d && ground && !vis.desk ? this.far(V, x, y, w, h, ground) : null;
      if (P.S) c3.points = { buf: Float32Array.from(P.S), n: P.S.length / 8, centre: [x + w / 2, y + h / 2, this.zc || 0], version: (this.pointsV = (this.pointsV || 0) + 1) };
      this.painted = L;
    }
    this.tell();
    return moving || alive;
  }

  /**
   * In 3D, the ground beyond the screen: the same map, FAR times as far
   * across and as coarse, round the zoom's grid and lifted onto the same
   * sphere, so tilted you see the land go on to the horizon (further out the
   * whole globe does it: solid()). Painted again only when the scale has
   * drifted by a sixth (one ring a frame); in between it's drawn at the
   * scale it was painted, which is right, just a little coarser or finer.
   */
  far(V, x, y, w, h, ground) {
    const R = 6.371e6 * this.ppm;
    if (R < 3 * Math.max(w, h)) return null; // the globe's there instead
    this.rings ||= [];
    let inner = [x, y, w, h], busy = false;
    return [3, 9].map((FAR, i) => {
      const want = this.ppm / FAR;
      let ring = this.rings[i];
      const stale = !ring || ring.G.cols !== V.cols || ring.G.rows !== V.rows || ring.geo !== geo.ready;
      if (stale || (!busy && Math.abs(Math.log(ring.ppm / want)) > 0.15)) {
        busy = true; // one ring a frame
        ring = this.rings[i] ||= { G: new Grid(), parts: {}, version: 0 };
        if (ring.G.cols !== V.cols || ring.G.rows !== V.rows) ring.G.resize(V.cols, V.rows);
        ring.G.clear();
        const Vr = { ...V, ppm: want }, P = new Pen(ring.G, Vr), Lr = Math.log10(this.area[2] / want), q = ring.parts;
        const town = this.L > 2.55 ? ramp(Lr, -99, -98, 3.95, 4.45) : 0, region = ramp(Lr, 3.7, 4.15, 5.9, 6.4), earth = ramp(Lr, 4.9, 5.4, 99, 100);
        if (town) (q.town ||= new Town()).paint(P, Vr, town);
        if (region) (q.region ||= new Region(places, geo)).paint(P, Vr, region);
        if (earth) (q.earth ||= new Earth()).paint(P, Vr, earth, j2000(), { geo, nlOpen: region > 0 });
        Object.assign(ring, { ppm: want, geo: geo.ready, version: ring.version + 1 });
      }
      const S = this.ppm / ring.ppm, m = 0.07; // page px a ring px, now
      const [ix, iy, iw, ih] = inner;
      const out = {
        buf: ring.G.buf, cols: V.cols, rows: V.rows, version: ring.version, dot: 0.8 / Math.sqrt(FAR), ring: true,
        x: x + w / 2 - V.cx * S, y: y + h / 2 - V.cy * S, cell: this.cell * S, ball: ground,
        hole: [ix + iw * m, iy + ih * m, ix + iw * (1 - m), iy + ih * (1 - m)], // inside the grid (or ring) within it
      };
      inner = [out.x, out.y, V.cols * out.cell, V.rows * out.cell];
      return out;
    });
  }

  /**
   * The 3D view's globe (globe.js): rebuilt when its size on screen changes by
   * a tenth, drawn by the renderer (cam3d.solid). It takes over from the flat
   * globe as the whole Earth comes to fit the view. Returns how much it has (0-1).
   */
  solid(vis, V, x, y, w, h) {
    const c3 = this.host.renderer.cam3d;
    if (!c3) return 0;
    const R = 6.371e6 * V.ppm, fit = 0.42 * Math.min(w, h);
    const k = c3.on && vis.earth ? Math.max(0, Math.min(1, (fit * 1.25 - R) / (fit * 0.35))) : 0;
    const n = Math.round(R / this.cell);
    this.zc = -R * (1 - k); // where the Earth's middle is: a radius behind the map, coming forward to the middle of the view as the whole globe takes over
    const list = [];
    const globe = k > 0 && n >= 4;
    if (globe) {
      const ready = geo.ready;
      if (!this.globe || Math.abs(n - this.globe.n) > this.globe.n * 0.1 || this.globe.ready !== ready) {
        this.globe = buildGlobe(n, geo);
        this.globe.ready = ready;
      }
      list.push({ buf: this.globe.buf, n: this.globe.count, centre: [x + w / 2, y + h / 2, this.zc], size: R / this.globe.n, sun: sunInView(j2000()), fade: vis.earth * k });
    }
    // Closer, where the map (the grid, lifted onto the sphere) fills the screen: the rest of the Earth behind and round it, coarser, so its curve runs on to the horizon.
    if (c3.on && vis.earth && k < 1 && R < 3 * Math.max(w, h)) {
      const nb = Math.min(n, 128), ready = geo.ready;
      if (!this.back || this.back.n !== nb || this.back.ready !== ready) { this.back = buildGlobe(nb, geo); this.back.ready = ready; }
      const m = 0.07; // inside the map's dissolving edge
      list.push({
        buf: this.back.buf, n: this.back.count, centre: [x + w / 2, y + h / 2, this.zc], size: (R * 0.99) / nb, sun: sunInView(j2000()), fade: vis.earth * (1 - k), tone: 0.75,
        hole: [x + w * m, y + h * m, x + w * (1 - m), y + h * (1 - m)],
      });
    }
    if (c3.on && vis.planets) list.push(...this.bodies(vis.planets, V, x, y, w, h, !globe));
    c3.solid = list.length ? list : null;
    this.solidPlanets = c3.on && vis.planets > 0;
    return globe ? k : 0;
  }

  /** The zoom (L) at which the 3D globe has wholly taken over from the flat one, on this screen (see solid()). */
  globeL() {
    if (!this.area) return 7;
    const [, , w, h] = this.area, fit = 0.42 * Math.min(w, h);
    return Math.log10((6.371e6 * w) / (0.9 * fit)); // where the Earth's radius on screen is 0.9 of what fits: k = 1
  }

  /**
   * The Sun, the planets, the Moon (and the Earth, once its globe has gone) as
   * balls on their orbits, where they are today. Too small to see at their
   * real size, so never smaller than a few cells; lit from where the Sun is,
   * so they show their phases as you turn round them. The Sun lights itself.
   */
  bodies(f, V, x, y, w, h, earth) {
    if (!(w > 0 && h > 0 && V.ppm > 0)) return [];
    const W = (this.planets ||= new Planets()).where(this.days);
    const cx = x + w / 2, cy = y + h / 2, cell = this.cell, out = [], taken = [];
    // Too small to see at their real size, so shown bigger, but still shrinking as you zoom out: a radius of
    // k × (the real one, in cells)^p, never less than the real one or half a cell. Bigger bodies stay bigger.
    const shown = (r, k, p) => { const c = (r * V.ppm) / cell; return Math.max(c, 0.5, k * Math.pow(c, p)); };
    // Biggest first; a body whose ball would run into one already there waits until they're apart.
    const add = (p, r, size, o = {}) => {
      const sx = cx + p[0] * V.ppm, sy = cy + p[1] * V.ppm;
      let n = size;
      if (Math.hypot(sx - cx, sy - cy) > Math.hypot(w, h) / 2 + n * cell) return; // off screen
      if (taken.some(([tx, ty, tr]) => Math.hypot(sx - tx, sy - ty) < (tr + n + 1) * cell)) return;
      taken.push([sx, sy, n]);
      n = Math.min(60, n > 4 ? Math.round(n) : Math.round(n * 2) / 2);
      const b = ball(n);
      const toSun = [0, 1, 2].map((k) => W.sun[k] - (p[k] || 0)), d = Math.hypot(...toSun) || 1;
      out.push({ buf: b.buf, n: b.count, centre: [sx, sy, (p[2] || 0) * V.ppm], size: cell, sun: toSun.map((v) => v / d), fade: f, ...o });
    };
    add(W.sun, 6.96e8, shown(6.96e8, 10.7, 0.25), { colour: 3, lit: false }); // about 9 cells as it comes into view, 2 by 10^14 m
    const bodies = W.planets.map(([px, py, pz, r]) => [[px, py, pz], r, 0.85]);
    if (earth) bodies.push([[0, 0, 0], 6.371e6, 0.9]);
    bodies.push([W.moon.slice(0, 3), W.moon[3], 0.75]);
    for (const [p, r, tone] of bodies.sort((a, b) => b[1] - a[1])) add(p, r, shown(r, 3.8, 0.12), { tone }); // the Earth: 4 cells at 10^9 m, about 2 at 10^12, 1 at 10^14
    return out;
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
      : L > 5.0 ? S.nl
      : L > 3.9 ? S.region
      : L > 3.35 ? S.edge
      : L > 2.35 ? S.town
      : L > 1.3 ? S.house
      : L > 0.7 ? S.room
      : L > L0 + 0.08 ? S.desk
      : L >= L0 - 0.4 ? (this.cv ? S.page : S.thisPage)
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
