// Stars and their planetary systems, from a star's seed. The class sets the
// colour, size and brightness; the brightness sets where it's hot, temperate
// and cold, and that sets what the planets are: lava and desert close in,
// oceans in the temperate band, ice and giants further out. Rings, moons and
// atmospheres by chance. Orbits turn slowly, so a system is never the same
// picture twice, but always the same system.

import { hash, u01, rng, gauss, poisson, name } from './rng.js';
import { planetHistory, MASS } from './lineage.js';

const G = 6.674e-11, MSUN = 1.989e30, MEARTH = 5.972e24;
/** Orbital period (s) at distance a (m) round mass M (kg). */
export const kepler = (a, M) => 2 * Math.PI * Math.sqrt((a * a * a) / (G * M));

export const AU = 1.496e11, RSUN = 6.96e8, REARTH = 6.371e6;

// class, share, colour (0 ink, 1-7 spectrum), tone, radius (suns), luminosity (suns), dot size (px)
const CLASSES = [
  ['M', 0.7, 1, 0.85, 0.35, 0.03, 1.4],
  ['K', 0.12, 2, 0.95, 0.8, 0.4, 1.8],
  ['G', 0.08, 3, 1, 1, 1, 2.1],
  ['F', 0.04, 0, 1, 1.3, 3, 2.2],
  ['A', 0.02, 5, 1, 1.8, 15, 2.6],
  ['B', 0.005, 6, 1, 4, 500, 3.2],
  ['D', 0.03, 0, 0.6, 0.012, 0.005, 1.1],
  ['R', 0.005, 1, 1, 40, 300, 3.2],
];
const CUM = (() => { let s = 0; return CLASSES.map((c) => (s += c[1])); })();
export const CLASS_NAMES = { M: 'red dwarf', K: 'orange dwarf', G: 'yellow dwarf', F: 'white star', A: 'blue-white star', B: 'blue giant', D: 'white dwarf', R: 'red giant' };

export function starClass(seed) {
  const u = u01(hash(seed, 0x5c)) * CUM[CUM.length - 1];
  let i = 0;
  while (u > CUM[i]) i++;
  const [cls, , col, tone, Rs, L, px] = CLASSES[i];
  return { cls, col, tone, R: Rs * RSUN * (0.8 + 0.4 * u01(hash(seed, 0x5d))), L, px };
}

const LETTERS = 'bcdefghijk';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * A star's planets. Each: orbit (a, m; period P, s; phase), kind, radius,
 * tilt, rings, atmosphere, accent colour and moons (the same, in miniature).
 */
export function makeSystem(star, sH) {
  const R = rng(hash(star.seed, 0x5157)), sc = star.sc, Mstar = MASS[sc.cls] * MSUN;
  const base = name(star.seed);
  const zb = Math.round(Math.max(-1, Math.min(1, sH.Z * 3))); // metal-rich discs build more planets
  const nP = Math.max(0, (sc.cls === 'D' ? poisson(R, 1) : sc.cls === 'M' ? poisson(R, 3) : 2 + Math.floor(R() * 7)) + zb);
  const planets = [];
  let a = (0.12 + 0.35 * R()) * AU * Math.sqrt(Math.max(sc.L, 0.02)) + sc.R * 4;
  for (let i = 0; i < Math.min(nP, 10); i++) {
    const seed = hash(star.seed, 0x91, i), P = rng(seed);
    const x = a / AU / Math.sqrt(Math.max(sc.L, 0.005)); // distance in "Earth orbits" for this star's light
    let kind;
    const u = P();
    if (x < 0.4) kind = u < 0.5 ? 'lava' : u < 0.85 ? 'desert' : u < 0.92 ? 'gas' : 'rock';
    else if (x < 0.85) kind = u < 0.6 ? 'desert' : u < 0.85 ? 'rock' : 'ocean';
    else if (x < 1.7) kind = u < 0.6 ? 'ocean' : u < 0.8 ? 'rock' : 'desert';
    else if (x < 4) kind = u < 0.45 ? 'ice' : u < 0.7 ? 'rock' : u < 0.9 ? 'gas' : 'icegiant';
    else kind = u < 0.5 ? 'gas' : u < 0.8 ? 'icegiant' : 'ice';
    // Causes, not dice: a metal-rich disc builds big cores fast (more gas giants), a metal-poor one rarely does;
    // a young system's inner worlds are still molten.
    if (x > 1.7 && (kind === 'rock' || kind === 'ice') && P() < 0.5 * Math.max(0, sH.Z + 0.1)) kind = 'gas';
    if (kind === 'gas' && sH.Z < -0.4 && P() < 0.6) kind = 'icegiant';
    let young = false;
    if ((kind === 'ocean' || kind === 'desert' || kind === 'rock') && x < 1.7 && sH.age < 0.4) { kind = 'lava'; young = true; }
    const giant = kind === 'gas' || kind === 'icegiant';
    const Rp = (kind === 'gas' ? 7 + 5 * P() : kind === 'icegiant' ? 3.5 + 1.2 * P() : 0.35 + 1.4 * P() * P()) * REARTH;
    const p = {
      i, seed, key: `p${seed}`, star, kind, R: Rp, a, x, young,
      P: kepler(a, Mstar), phase: P() * 6.283, day: (giant ? 0.35 + 0.3 * P() : 0.5 + 2.5 * P()) * 86400,
      inc: gauss(P) * 0.03, tilt: gauss(P) * 0.35,
      rings: giant ? P() < 0.5 : P() < 0.04,
      atmo: kind === 'ocean' || giant || (kind !== 'lava' && P() < 0.55) || (kind === 'lava' && P() < 0.5),
      accent: accentFor(kind, P),
      name: `${base} ${LETTERS[i]}`,
      moons: [],
    };
    p.hist = planetHistory(sH, p);
    const Mp = p.hist.earths * MEARTH;
    const nM = Math.min(6, poisson(P, giant ? 2.8 : kind === 'ice' ? 0.6 : 0.5));
    let am = Rp * (3 + 3 * P());
    for (let m = 0; m < nM; m++) {
      const ms = hash(seed, 0x300, m), M = rng(ms), mu = M();
      const mk = mu < 0.45 ? 'rock' : mu < 0.8 ? 'ice' : mu < 0.92 ? 'lava' : 'desert';
      const Rm = (giant ? 0.15 + 0.3 * M() : 0.08 + 0.2 * M()) * REARTH;
      am *= 1.5 + 0.8 * M();
      p.moons.push({ i: m, seed: ms, key: `m${ms}`, kind: mk, R: Rm, a: am, P: kepler(am, Mp), day: 86400 * (1 + 5 * M()), x, phase: M() * 6.283, inc: gauss(M) * 0.05, tilt: 0, rings: false, atmo: false, accent: accentFor(mk, M), name: `${p.name} ${ROMAN[m]}`, moons: [], parent: p });
    }
    for (const m of p.moons) m.hist = planetHistory(sH, m);
    p.soi = Math.max(Rp * 30, am * 1.4);
    planets.push(p);
    a *= 1.45 + 0.6 * P();
  }
  const outer = planets.length ? planets[planets.length - 1].a : sc.R * 200;
  return { planets, E: Math.max(outer * 1.4, AU * 0.3), name: base, mass: Mstar };
}

function accentFor(kind, R) {
  const pick = (xs) => xs[(R() * xs.length) | 0];
  return {
    ocean: pick([6, 5, 6]), lava: pick([1, 2]), desert: pick([2, 3]), ice: pick([5, 6]),
    gas: pick([2, 3, 1, 7, 5]), icegiant: pick([5, 6, 7]), rock: pick([0, 0, 7, 4]),
  }[kind] ?? 0;
}

export const KIND_NAMES = { lava: 'lava world', desert: 'desert world', rock: 'rocky world', ocean: 'ocean world', ice: 'ice world', gas: 'gas giant', icegiant: 'ice giant' };
