// Search: ask for a place instead of wandering for it. "a ringed ocean world
// with two moons round a yellow star", "garnet sand", "a young blue giant in
// an elliptical galaxy". The words become tests at each level (galaxy, star,
// world), and the search walks outward from where you are, a few ms a frame,
// pruning as early as it can: a galaxy by its type, an octree cell by its
// expected star count, a star by its class and history, and only then the
// star's planets are made and tested. Nothing is stored; every candidate is
// generated, tested and forgotten, so the search space is the whole universe.

import { hash, name } from './rng.js';
import { CELL, galaxyCell, cellMass } from './cosmos.js';
import { galaxyHistory, starHistory } from './lineage.js';
import { makeSystem, KIND_NAMES, CLASS_NAMES } from './system.js';
import { rel, pointIn, add, sub, mulv, len, scale } from './space.js';

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1, single: 1 };
const MIN_SHARE = { garnet: 0.03, olivine: 0.15, quartz: 0.2, magnetite: 0.08, mica: 0.07, feldspar: 0.3 };

/** Words to tests. Returns { chips (what was understood), galaxy, star, planet (tests or null) }. */
export function parse(q) {
  const t = ` ${q.toLowerCase().replace(/[,.!?;]/g, ' ')} `, has = (re) => re.test(t);
  const chips = [], P = [], S = [], G = [];
  let kind = null;
  if (has(/ice giant/)) kind = 'icegiant';
  else if (has(/gas giant|\bgas\b|jupiter/)) kind = 'gas';
  else if (has(/ocean|water world|watery|\bseas?\b/)) kind = 'ocean';
  else if (has(/lava|molten|magma/)) kind = 'lava';
  else if (has(/desert|dunes?\b|\bdry\b/)) kind = 'desert';
  else if (has(/\bice\b|icy|frozen|snow/)) kind = 'ice';
  else if (has(/rocky|barren|rock world/)) kind = 'rock';
  if (kind) { P.push((p) => p.kind === kind); chips.push(KIND_NAMES[kind]); }
  if (has(/no rings?|without rings?|ringless/)) { P.push((p) => !p.rings); chips.push('no rings'); } else if (has(/ring/)) { P.push((p) => p.rings); chips.push('rings'); }
  const mm = t.match(/\b(\d+|one|two|three|four|five|six|a|an|single) moons?\b/);
  if (has(/no moons?|moonless|without (a )?moons?/)) { P.push((p) => p.moons.length === 0); chips.push('no moons'); } else if (mm) { const n = NUM[mm[1]] ?? +mm[1]; P.push((p) => p.moons.length === n); chips.push(`${n} moon${n > 1 ? 's' : ''}`); } else if (has(/ moons /)) { P.push((p) => p.moons.length >= 2); chips.push('moons'); }
  if (has(/tecton|plates|earthquake/)) { P.push((p) => p.hist.tectonic); chips.push('moving plates'); }
  if (has(/volcan|erupt/)) { P.push((p) => p.hist.volcanic); chips.push('volcanoes'); }
  const mn = t.match(/(garnet|olivine|quartz|magnetite|mica|feldspar)/);
  if (mn) {
    const name = mn[1];
    P.push((p) => p.kind !== 'gas' && p.kind !== 'icegiant' && p.hist.minerals.filter((m) => m.name.endsWith(name)).reduce((a, m) => a + m.w, 0) >= MIN_SHARE[name]);
    chips.push(`${name} sand`);
  }
  if (has(/habitable|temperate|earth-?like|like (the )?earth/)) { P.push((p) => p.kind === 'ocean' && p.hist.earths > 0.4 && p.hist.earths < 2.5); chips.push('earth-like'); }
  if (has(/\bbig\b|large|huge|super-?earth/) && kind !== 'gas' && kind !== 'icegiant') { P.push((p) => p.hist.earths > 2); chips.push('big'); }
  if (has(/small|tiny/)) { P.push((p) => p.hist.earths < 0.3); chips.push('small'); }
  let cls = null;
  if (has(/red giant/)) cls = ['R']; else if (has(/white dwarf/)) cls = ['D']; else if (has(/blue/)) cls = ['B', 'A']; else if (has(/red dwarf|red star|red sun/)) cls = ['M']; else if (has(/orange/)) cls = ['K']; else if (has(/yellow|sun-?like|like (our|the) sun/)) cls = ['G']; else if (has(/\bwhite\b/)) cls = ['F', 'A'];
  if (cls) { S.push((s) => cls.includes(s.sc.cls)); chips.push([...new Set(cls.map((c) => CLASS_NAMES[c]))].join(' or ')); }
  if (has(/young/)) { S.push((s, h) => h.age < 1); chips.push('young star'); }
  if (has(/\bold\b|ancient/)) { S.push((s, h) => h.age > 9); chips.push('old star'); }
  if (has(/metal-?rich|rich in metals/)) { S.push((s, h) => h.Z > 0.15); chips.push('metal-rich'); }
  if (has(/metal-?poor|poor in metals/)) { S.push((s, h) => h.Z < -0.4); chips.push('metal-poor'); }
  if (has(/elliptical/)) { G.push((g) => g.type === 'E'); chips.push('elliptical galaxy'); } else if (has(/irregular/)) { G.push((g) => g.type === 'I'); chips.push('irregular galaxy'); } else if (has(/spiral/)) { G.push((g) => g.type === 'S'); chips.push('spiral galaxy'); }
  const all = (fs) => (fs.length ? (...a) => fs.every((f) => f(...a)) : null);
  return { chips, galaxy: all(G), star: all(S), planet: all(P) };
}

/** A running search. step(ms) advances it; found, counts and done tell how it's going. */
export class Search {
  constructor(U, q) {
    this.U = U; this.q = q; this.found = []; this.cells = 0; this.stars = 0; this.systems = 0; this.galaxies = 0;
    this.done = false; this.t0 = performance.now(); this.gen = this.run();
  }
  step(ms) {
    const t = performance.now();
    while (!this.done && performance.now() - t < ms) if (this.gen.next().done) this.done = true;
    if (performance.now() - this.t0 > 25000) this.done = true;
  }

  *run() {
    const U = this.U, q = this.q, T = rel(U.cam.anchor, U.root), here = add(T.t, mulv(T.R, U.cam.t));
    // Galaxies: the one you're in first (if it fits), then the nearest that fit.
    const ci = here.map((v) => Math.floor(v / CELL)), gals = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) for (const g of U.web.galaxies(ci[0] + i, ci[1] + j, ci[2] + k)) {
      if (q.galaxy && !q.galaxy(g)) continue;
      gals.push([Math.hypot(g.x * CELL - here[0], g.y * CELL - here[1], g.z * CELL - here[2]), g]);
    }
    gals.sort((a, b) => a[0] - b[0]);
    const inside = U.find('galaxy')?.info.g;
    if (inside && (!q.galaxy || q.galaxy(inside))) gals.unshift([0, inside]);
    const seen = new Set();
    for (const [, g] of gals.slice(0, 10)) {
      if (seen.has(g.key)) continue;
      seen.add(g.key); this.galaxies++;
      const gI = U.gi(g), P = gI.P, shape = gI.shape, gH = galaxyHistory(g), R = g.R;
      // Start where you are if you're in it, else somewhere in its disc (or body), and spread out shell by shell.
      let p0;
      if (g === inside) { const Tg = rel(U.cam.anchor, gI.node); p0 = scale(add(Tg.t, mulv(Tg.R, U.cam.t)), 1 / R); } else { const a = (hash(g.seed, 77) / 4294967296) * 6.283; p0 = shape.type === 'E' ? [0.8, 0, 0] : [2 * Math.cos(a), 2 * Math.sin(a), 0]; }
      const n = 2 ** P.dStar, size = (2 * P.B) / n, half = size / 2, c0 = p0.map((v) => Math.floor((v + P.B) / size));
      let firstShell = -1;
      for (let r = 0; r <= 45; r++) {
        if (firstShell >= 0 && r > firstShell + 2) break;
        for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
          if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
          const i = c0[0] + a, j = c0[1] + b, k = c0[2] + c;
          if (i < 0 || j < 0 || k < 0 || i >= n || j >= n || k >= n) continue;
          this.cells++;
          if (P.N * cellMass(shape, -P.B + (i + 0.5) * size, -P.B + (j + 0.5) * size, -P.B + (k + 0.5) * size, half) < 0.3) continue; // no stars expected
          for (const s of galaxyCell(g, shape, P, P.dStar, i, j, k).stars) {
            this.stars++;
            const h = starHistory(gH, shape, s);
            if (h.born > U.epoch || (q.star && !q.star(s, h))) continue;
            const dist = () => len(sub(pointIn([s.x * R, s.y * R, s.z * R], gI.node, U.root), here));
            if (!q.planet) { this.hit({ g, s, label: name(s.seed), sub: `${CLASS_NAMES[s.sc.cls]}, in ${gI.name.split(' ')[0]}`, dist: dist() }); continue; }
            const sys = makeSystem(s, h);
            this.systems++;
            for (const p of sys.planets) {
              if (!q.planet(p)) continue;
              this.hit({ g, s, p, label: p.name, sub: `${KIND_NAMES[p.kind]}${p.rings ? ', rings' : ''}${p.moons.length ? `, ${p.moons.length} moon${p.moons.length > 1 ? 's' : ''}` : ''} · ${CLASS_NAMES[s.sc.cls]}, in ${gI.name.split(' ')[0]}`, dist: dist() });
            }
          }
          if (this.found.length && firstShell < 0) firstShell = r;
          if (this.found.length >= 6) return;
          yield;
        }
      }
      if (this.found.length) return; // nearest galaxy with a match wins
    }
  }

  hit(f) {
    if (this.found.some((x) => x.label === f.label)) return;
    this.found.push(f);
    this.found.sort((a, b) => a.dist - b.dist);
  }
}

