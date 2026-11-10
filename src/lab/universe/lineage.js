// Histories: why things are the way they are. The rest of the universe is
// hashed level by level; this makes the levels depend on each other the way
// they do out there, so every property has a cause one level up:
//
//   galaxy  when it formed, and how it made stars (ellipticals early and all
//           at once, spirals steadily, irregulars late), so how much heavy
//           matter ("metals") its gas has by now, richer towards the middle
//   star    when it was born (young ones in the spiral arms), so its metals:
//           later stars form from gas enriched by earlier supernovae
//   planet  what it's made of and what it's doing: metal-rich discs build
//           big cores (more giants); heat left inside drives plate tectonics
//           and volcanoes, more in big young worlds; water needs cool, old
//           enough ground
//   mineral what its sand is made of, from all of the above
//
// Everything is still deterministic: a seed and these rules. Times are in
// Gyr after the Big Bang (now: 13.8); metallicity is [Fe/H], dex (the Sun: 0).

import { hash, rng, gauss } from './rng.js';

export const NOW = 13.8;
/** How long a star of each class shines (Gyr); for giants and white dwarfs, how long what they were did. */
export const LIFE = { B: 0.1, A: 1, F: 4, G: 10, K: 30, M: 200, R: 10, D: 8 };
/** Mass, suns. */
export const MASS = { B: 8, A: 2, F: 1.3, G: 1, K: 0.75, M: 0.3, R: 1.2, D: 0.6 };

const fmtAge = (gyr) => (gyr >= 1 ? `${gyr.toFixed(1)} billion years` : `${Math.round(gyr * 1000)} million years`);
const fmtZ = (z) => `${(10 ** z).toFixed(z > 0.5 || z < -1 ? 1 : 2)}× the Sun's`;
export { fmtAge, fmtZ };

/** A galaxy's history (cached on it). */
export function galaxyHistory(g) {
  if (g.hist) return g.hist;
  const R = rng(hash(g.seed, 0x415)), mass = (g.R / 6e19) ** 2;
  let formed, Z0, grad, why;
  if (g.type === 'E') {
    formed = 1 + 1.5 * R(); Z0 = 0.15 + 0.15 * R() + 0.15 * Math.log10(mass + 0.1); grad = -0.04;
    why = g.env === 'cluster' ? 'built by mergers in a crowded cluster, it turned all its gas into stars early on, then stopped' : 'it merged early, used up its gas in one burst and has made few stars since';
  } else if (g.type === 'S') {
    formed = 1.5 + 3 * R(); Z0 = 0.05 + 0.2 * R() + 0.2 * Math.log10(mass + 0.1); grad = -0.07;
    why = 'a disc that has kept turning gas into stars, generation after generation, richest in the middle where it started';
  } else {
    formed = 3 + 6 * R(); Z0 = -0.9 + 0.4 * R(); grad = 0;
    why = 'small and late, with only a few generations of stars to enrich its gas';
  }
  return (g.hist = { formed, age: NOW - formed, Z0, grad, why, mass });
}

/** When a sample of a galaxy (galaxy units; young: 0-1, how much it sits in an arm) was born, Gyr. */
export function sampleBorn(gH, type, young, u) {
  if (type === 'E') return gH.formed + gH.age * 0.15 * u;
  if (type === 'S' && young > 0.55 && u < 0.4) return NOW - 0.3 * u; // knots of young stars in the arms
  return gH.formed + (NOW - gH.formed) * (type === 'I' ? Math.sqrt(u) : u);
}

/** A star's history: born, age, metallicity, and why. s: { x, y, z (galaxy units), sc, seed }. */
export function starHistory(gH, shape, s) {
  if (s.hist) return s.hist;
  const R = rng(hash(s.seed, 0x5a7)), cls = s.sc.cls, r = Math.hypot(s.x, s.y);
  const young = shape.type === 'S' ? shape.arm(r, Math.atan2(s.y, s.x)) / shape.armMax : shape.type === 'I' ? 0.7 : 0.05;
  let born = sampleBorn(gH, shape.type, young, R());
  const life = LIFE[cls];
  if (cls === 'B' || cls === 'A' || cls === 'F') born = Math.max(born, NOW - life * (0.15 + 0.8 * R())); // still shining now, so born within its life
  if (cls === 'R' || cls === 'D') born = Math.min(born, NOW - life * (0.9 + 0.5 * R())); // has lived its life already
  born = Math.min(NOW - 0.002, Math.max(gH.formed + 0.05, born));
  const span = Math.max(0.5, NOW - gH.formed), late = (born - gH.formed) / span;
  const Z = gH.Z0 + gH.grad * r - 0.4 * (1 - late) + gauss(R) * 0.08;
  const where = shape.type === 'S' ? (r < 1.2 ? 'the inner disc' : r < 3 ? (young > 0.55 ? 'a spiral arm' : 'the disc') : 'the outer disc') : shape.type === 'E' ? (r < 1 ? 'the dense core' : 'the outskirts') : 'a clump';
  return (s.hist = { born, age: NOW - born, Z, r, young, where });
}

/**
 * A planet's (or moon's) history: what it's made of and doing, its minerals
 * (weights for its sand) and why. sH: its star's. p: from makeSystem.
 */
export function planetHistory(sH, p) {
  const R = rng(hash(p.seed, 0x91a));
  const giant = p.kind === 'gas' || p.kind === 'icegiant';
  const earths = giant ? (p.kind === 'gas' ? 100 : 15) * (p.R / 4e7) ** 1.5 : (p.R / 6.371e6) ** 3.4;
  const age = Math.max(0.01, sH.age - 0.05);
  const heat = giant ? 0 : earths ** 0.8 / Math.sqrt(age + 0.3); // heat left inside, relative to the Earth's (~0.45)
  const tectonic = !giant && p.kind !== 'lava' && heat > 0.3 && R() < 0.85;
  const volcanic = !giant && (p.kind === 'lava' || heat > 0.8);
  const water = p.kind === 'ocean' || p.kind === 'ice';
  const rich = Math.max(0, sH.Z);
  const M = (name, col, tone, w, why) => ({ name, col, tone, w, why });
  const minerals = [
    M('quartz', 0, 0.22, tectonic && water ? 0.3 : 0.04, tectonic && water ? 'Quartz piles up where continents form: crust melted and remelted by moving plates, with water.' : 'Quartz is scarce here: there are no moving plates and water to build continents from.'),
    M('feldspar', 0, 0.5, 0.25, 'Feldspar is most of any rocky crust.'),
    M('pink feldspar', 2, 0.6, tectonic && water ? 0.06 : 0.01, 'Pink feldspar comes from granite, the rock of continents.'),
    M('mica', 0, 0.85, tectonic && water ? 0.1 : 0.02, 'Mica forms in wet crust that has been buried and reworked.'),
    M('magnetite', 0, 0.97, 0.03 + 0.12 * rich, `Magnetite is iron oxide; there's ${rich > 0.1 ? 'plenty' : 'a little'} because the star formed from gas with metals ${fmtZ(sH.Z)}.`),
    M('olivine', 4, 0.7, volcanic ? 0.25 : 0.03, volcanic ? 'Olivine is fresh rock from the mantle, and this world is still erupting.' : 'Olivine weathers away unless volcanoes keep bringing up more; here they mostly don\'t.'),
    M('garnet', 1, 0.8, tectonic ? 0.05 : 0.004, tectonic ? 'Garnet grows in rock squeezed and heated deep in a moving crust.' : 'Garnet needs rock buried and squeezed by moving plates, so it\'s rare here.'),
  ];
  const tot = minerals.reduce((a, m) => a + m.w, 0);
  for (const m of minerals) m.w /= tot;
  let why;
  if (giant) why = p.kind === 'gas' ? (p.x < 0.5 ? 'a gas giant that formed beyond the snow line and spiralled in close' : `a big icy core formed beyond the snow line, ${rich > 0.1 ? 'quickly in this metal-rich disc, ' : ''}and grabbed the gas round it before it blew away`) : 'formed far out, slowly, from ice, too late to grab much gas';
  else if (p.kind === 'lava') why = p.young ? `only ${fmtAge(age)} old: it hasn't cooled yet` : 'so close to its star that the rock is molten';
  else if (p.kind === 'ocean') why = 'in the band where water stays liquid, and old enough to have cooled and kept it';
  else if (p.kind === 'desert') why = 'warm, and too close in for water to stay';
  else if (p.kind === 'ice') why = 'beyond the snow line: its water froze';
  else why = earths < 0.3 ? 'too small to hold on to air or heat' : 'a bare rocky world';
  return {
    earths, heat, tectonic, volcanic, water, age, minerals, why,
    state: [tectonic && 'moving plates', volcanic && 'volcanoes', water && (p.kind === 'ice' ? 'frozen water' : 'oceans')].filter(Boolean),
  };
}

/** Pick a mineral from a weighted list (or the default mix). */
export function pickMineral(list, u) {
  let s = 0;
  for (const m of list) { s += m.w; if (u < s) return m; }
  return list[list.length - 1];
}
