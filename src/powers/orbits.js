// Powers of Ten, round the Earth and out of the solar system: satellites in
// their real kinds of orbit, a minute a second; the Kuiper belt, the edge of
// the Sun's wind and the three spacecraft furthest out, where they are
// today; the Oort cloud; and the bubble our radio has filled since 1920.
// Everything in metres about "here", the same middles the other scales use
// (the Earth's for the satellites, the Earth's in the solar system, the
// Sun's among the stars).

import { rng, AU, LY } from './scenes.js';

const MU = 3.986e14; // the Earth's GM, m³/s²
const R_EARTH = 6.371e6;
const W_EARTH = 7.2921e-5; // the Earth's spin, rad/s (a sidereal day)
const LEIDEN = [52.16, 4.49];
const DEG = Math.PI / 180;
const YEAR_DAYS = 365.25;
const j2000ms = Date.UTC(2000, 0, 1, 12);

// ---------------------------------------------------------------- satellites

/**
 * Satellites round the globe as Earth.paint draws it, Leiden facing us: about
 * 6,000 of the ten thousand or so up there, in the orbits they really use.
 * Low Earth orbit, a few hundred km up, laps the Earth in about an hour and
 * a half: Starlink's shells (53°, 43°, 70° and the polar one), OneWeb nearly
 * over the poles 1,200 km up, the Earth-watching ones in sun-synchronous
 * orbits, the space station and China's Tiangong. Further out the
 * navigation constellations, 19,000 to 23,000 km up, twice a day: GPS,
 * Galileo, GLONASS, BeiDou. And the geostationary ring, 36,000 km up over the
 * equator, once a day, as fast as the Earth turns, so it hangs still. Each
 * moves on its own Kepler circle. In the 3D view they're where they are, all
 * the way round; flat, the ones behind the Earth are hidden. A minute a second.
 */
export class Satellites {
  constructor() {
    const r = rng(41);
    const s = (alt, inc, node, u, size = 0.5, tone = 0.7) => {
      const a = R_EARTH + alt;
      return { a, inc: inc * DEG, node, u, n: Math.sqrt(MU / (a * a * a)), size, tone };
    };
    const shell = (alt, inc, planes, per, o = {}) => {
      for (let p = 0; p < planes; p++) for (let k = 0; k < per; k++) {
        this.sats.push(s(alt + (o.spread ? (r() - 0.5) * o.spread : 0), inc, (p / planes) * 2 * Math.PI, ((k + p * 0.37) / per) * 2 * Math.PI, o.size, o.tone));
      }
    };
    this.sats = [];
    this.iss = s(4.2e5, 51.64, r() * 2 * Math.PI, r() * 2 * Math.PI, 1, 1);
    this.sats.push(this.iss, s(3.9e5, 41.5, r() * 2 * Math.PI, r() * 2 * Math.PI, 1, 1)); // and Tiangong
    // Starlink.
    shell(5.5e5, 53, 72, 22);
    shell(5.3e5, 43, 28, 22);
    shell(5.7e5, 70, 36, 20);
    shell(5.6e5, 97.6, 6, 58);
    // OneWeb, nearly over the poles.
    shell(1.2e6, 87.9, 12, 49);
    // Watching the Earth: sun-synchronous, 500-800 km.
    for (let k = 0; k < 400; k++) this.sats.push(s(5e5 + r() * 3e5, 97.5, r() * 2 * Math.PI, r() * 2 * Math.PI));
    // Everything else low: launch-site inclinations.
    const INC = [28.5, 51.6, 65, 82, 98.2];
    for (let k = 0; k < 300; k++) this.sats.push(s(3e5 + r() * 1.2e6, INC[Math.floor(r() * INC.length)], r() * 2 * Math.PI, r() * 2 * Math.PI));
    // Navigation, in their planes.
    const nav = { size: 0.75, tone: 0.85 };
    shell(2.0186e7, 55, 6, 5, nav); // GPS
    shell(2.3222e7, 56, 3, 8, nav); // Galileo
    shell(1.91e7, 64.8, 3, 8, nav); // GLONASS
    shell(2.1528e7, 55, 3, 8, nav); // BeiDou
    // Geostationary: on the equator, as fast as the Earth turns.
    for (let k = 0; k < 550; k++) this.sats.push(s(3.5786e7, 0, 0, r() * 2 * Math.PI, 0.75, 0.85));
    this.t = 0;
    // The view, as Earth.paint has it: e towards us (Leiden), E to the right, N up.
    const p0 = LEIDEN[0] * DEG, l0 = LEIDEN[1] * DEG;
    this.e = [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)];
    this.E = [-Math.sin(l0), Math.cos(l0), 0];
    this.N = [-Math.sin(p0) * Math.cos(l0), -Math.sin(p0) * Math.sin(l0), Math.cos(p0)];
  }

  /** dt real seconds; a minute a second. */
  step(dt) { this.t += dt * 60; }

  /** Where a satellite is: [x, y (m, y down), seen (not behind the Earth, from straight on), z (towards you)]. */
  where(q) {
    // The node turns back against the Earth's spin (we're in the Earth's frame).
    const node = q.node - W_EARTH * this.t, u = q.u + q.n * this.t;
    const cu = Math.cos(u), su = Math.sin(u), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(q.inc), si = Math.sin(q.inc);
    const x = q.a * (cn * cu - sn * su * ci), y = q.a * (sn * cu + cn * su * ci), z = q.a * su * si;
    const { e, E, N } = this;
    const sx = x * E[0] + y * E[1] + z * E[2], sy = -(x * N[0] + y * N[1] + z * N[2]), d = x * e[0] + y * e[1] + z * e[2];
    return [sx, sy, d > 0 || sx * sx + sy * sy > R_EARTH * R_EARTH, d];
  }

  paint(P, V, f) {
    const space = !!P.S; // the 3D view: everything where it is, the Earth hides what's behind it
    // The geostationary ring itself, faint and dotted.
    const a = R_EARTH + 3.5786e7, n = 240;
    for (let k = 0; k < n; k++) {
      const [x, y, seen, d] = this.where({ a, inc: 0, node: 0, u: (k / n) * 2 * Math.PI + W_EARTH * this.t, n: 0 });
      if (space) P.dot3(x, y, d, { size: 0.25, tone: 0.4, f });
      else if (seen) P.dot(x, y, { size: 0.25, tone: 0.4, f });
    }
    for (const q of this.sats) {
      const [x, y, seen, d] = this.where(q);
      if (space) { P.dot3(x, y, d, { size: q === this.iss ? 1.25 : q.size, tone: q.tone, f }); continue; }
      if (!seen) continue;
      if (q === this.iss) {
        const m = P.m * 0.6;
        for (const [dx, dy] of [[0, 0], [m, 0], [0, m], [m, m]]) P.dot(x + dx, y + dy, { f });
      } else P.dot(x, y, { size: q.size, tone: q.tone, f });
    }
  }
}

// ---------------------------------------------------------------- the edge of the solar system

// Furthest out, with where they were on 2026-11-05: heliocentric ecliptic
// longitude and latitude (degrees), distance (AU), and how fast it grows (AU
// a year). Voyager 1 is reaching one light day from us about now.
const CRAFT = [
  { lon: 255, lat: 35, d: 172.9, v: 3.57 }, // Voyager 1
  { lon: 289, lat: -32, d: 145.0, v: 3.25 }, // Voyager 2
  { lon: 293, lat: 2, d: 65.0, v: 2.95 }, // New Horizons
];
const CRAFT_EPOCH = (Date.UTC(2026, 10, 5) - j2000ms) / 864e5;
const NOSE = 255 * DEG; // the way the Sun moves through the gas between the stars, about where Voyager 1 went

/** The Sun, seen from the Earth in the middle (as Planets has it). */
function sunAt(days) {
  const th = ((100.46 + (360 * days) / 365.256) * Math.PI) / 180;
  return [-AU * Math.cos(th), AU * Math.sin(th)];
}

/** How far Voyager 1 is from the Sun, in AU, on a day (since J2000). */
export const voyager1 = (days) => CRAFT[0].d + (CRAFT[0].v * (days - CRAFT_EPOCH)) / YEAR_DAYS;

/**
 * Out past Neptune: the Kuiper belt, a few hundred of its icy bodies on
 * their (very slow) orbits; the termination shock and the heliopause, where
 * the Sun's wind first slows and then gives out against the gas between the
 * stars, squashed in front and trailing behind (their shape is roughly
 * known, from the two Voyagers going through); and the Voyagers and New
 * Horizons where they are today, with the way they came.
 */
export class Outer {
  constructor() {
    const r = rng(43);
    this.belt = Array.from({ length: 420 }, () => {
      const a = 30 + r() * 20 + (r() < 0.3 ? 9.5 * (r() - 0.5) : 0); // AU
      // Tilted out of the ecliptic: most a few degrees (the cold belt), a scattered fifth up to 30°.
      const inc = (r() < 0.8 ? 4 : 17) * Math.sqrt(-2 * Math.log(r() + 1e-9)) * DEG;
      return { a, th: r() * 2 * Math.PI, n: (2 * Math.PI) / (365.256 * Math.pow(a, 1.5)), e: (r() - 0.5) * 0.12, inc: Math.min(inc, 35 * DEG), node: r() * 2 * Math.PI };
    });
    // Directions all round, for drawing the edge of the Sun's wind as a shell.
    this.dirs = Array.from({ length: 1400 }, (_, k) => {
      const z = 1 - (2 * (k + 0.5)) / 1400, s = Math.sqrt(1 - z * z), a = k * 2.39996;
      return [s * Math.cos(a), s * Math.sin(a), z];
    });
  }

  paint(P, V, f, days) {
    const sun = sunAt(days);
    const dim = { size: 0.5, tone: 0.55, f };
    for (const b of this.belt) {
      const th = b.th + b.n * days, rr = b.a * (1 + b.e * Math.cos(th * 2)) * AU;
      P.dot3(sun[0] + rr * Math.cos(th), sun[1] - rr * Math.sin(th), rr * Math.sin(b.inc) * Math.sin(th - b.node), dim);
    }
    // The heliosphere: about 120 AU out in front, much further behind.
    const shape = (k) => (phi) => k * AU * (120 + 110 * (1 - Math.cos(phi - NOSE)) / 2);
    if (P.S) { // in 3D, a shell round the Sun, squashed towards the nose
      const nose = [Math.cos(NOSE), -Math.sin(NOSE), 0];
      for (const [k, st, every] of [[1, { size: 0.75, tone: 0.75, f }, 1], [0.78, { size: 0.5, tone: 0.45, f }, 3]]) {
        this.dirs.forEach((d, i) => {
          if (i % every) return;
          const c = d[0] * nose[0] + d[1] * nose[1] + d[2] * nose[2], r = k * AU * (120 + 110 * (1 - c) / 2);
          P.dot3(sun[0] + d[0] * r, sun[1] + d[1] * r, d[2] * r, st);
        });
      }
    } else {
      this.outline(P, sun, shape(1), { size: 0.75, tone: 0.75, f }, 1);
      this.outline(P, sun, shape(0.78), { size: 0.5, tone: 0.45, f }, 3);
    }
    for (const c of CRAFT) {
      const D = (c.d + (c.v * (days - CRAFT_EPOCH)) / YEAR_DAYS) * AU, d = D * Math.cos(c.lat * DEG), z = D * Math.sin(c.lat * DEG);
      const x = sun[0] + d * Math.cos(c.lon * DEG), y = sun[1] - d * Math.sin(c.lon * DEG);
      if (P.S) { // the way it came, out of the ecliptic at its real latitude
        const n = Math.min(400, Math.ceil(Math.hypot(x - sun[0], y - sun[1], z) * P.V.ppm / P.V.cell / 2));
        for (let k = 0; k <= n; k++) P.dot3(sun[0] + (x - sun[0]) * k / n, sun[1] + (y - sun[1]) * k / n, z * k / n, { size: 0.5, tone: 0.45, f });
        P.dot3(x, y, z, { size: 1.25, f });
        continue;
      }
      P.line(sun[0], sun[1], x, y, { size: 0.5, tone: 0.45, f }, 2);
      const m = P.m * 0.6;
      for (const [dx, dy] of [[0, 0], [m, 0], [0, m], [m, m]]) P.dot(x + dx, y + dy, { f });
    }
  }

  outline(P, c, r, st, every) {
    const R = r(NOSE) * P.V.ppm / P.V.cell;
    if (R < 1) return;
    const n = Math.min(3000, Math.ceil((2 * Math.PI * R * 1.4) / every));
    for (let k = 0; k < n; k++) {
      const phi = (k / n) * 2 * Math.PI, d = r(phi);
      P.dot(c[0] + d * Math.cos(phi), c[1] - d * Math.sin(phi), st);
    }
  }
}

/**
 * The Oort cloud: icy bodies from about 2,000 to 100,000 AU, the furthest a
 * good way to the nearest star. Nobody has seen one out there; it's where
 * the long-period comets have to be coming from. Drawn as a sphere seen from
 * outside, thinning outwards, with as many in each power of ten of distance.
 */
export class Oort {
  constructor() {
    const r = rng(47);
    this.pts = Array.from({ length: 2600 }, () => {
      const d = 2000 * Math.pow(50, Math.sqrt(r())) * AU; // more of them in the inner cloud
      const z = 2 * r() - 1, a = r() * 2 * Math.PI, s = Math.sqrt(1 - z * z);
      return [d * s * Math.cos(a), d * s * Math.sin(a), d * z];
    });
  }

  paint(P, V, f) {
    for (const [x, y, z] of this.pts) P.dot3(x, y, z, { size: 0.5, tone: 0.6, f }); // a sphere, in 3D
  }
}

// ---------------------------------------------------------------- our radio

const FIRST_BROADCAST = Date.UTC(1920, 10, 2); // KDKA, Pittsburgh, the first public radio broadcast
const YEAR_MS = YEAR_DAYS * 864e5;

/** How far our first broadcast has got by now, in light years. */
export const radioYears = (ms = Date.now()) => (ms - FIRST_BROADCAST) / YEAR_MS;

/**
 * The bubble our radio and television have filled, spreading at the speed of
 * light since 1920: its front in the spectrum (it's light), red leading,
 * violet trailing, and a ring for each decade of broadcasting inside it. Here
 * it grows a year a second, from today, while it's on screen.
 */
export class Radio {
  constructor() { this.extra = 0; }

  step(dt) { this.extra += dt; }
  reset() { this.extra = 0; }

  paint(P, V, f) {
    const R = (radioYears() + this.extra) * LY;
    const Rc = (R * V.ppm) / V.cell;
    if (Rc < 0.7) { P.dot(0, 0, { colour: 1, f }); return; }
    if (P.S) { this.sphere(P, V, f, R); return; }
    // Decades: where the broadcasts of 1930, 1940, … have got to.
    const now = 1920.84 + radioYears() + this.extra;
    for (let y = 1930; y < now; y += 10) {
      const r = (now - y) * LY;
      if ((r * V.ppm) / V.cell > 3) P.ring(0, 0, r, { size: 0.25, tone: 0.4, f }, 3);
    }
    // Small, just its leading edge.
    if (Rc < 12) { P.ring(0, 0, R, { colour: 1, f }, 1); return; }
    // The front: seven bands, red outermost, about half a cell each.
    const band = P.m * 0.55;
    for (let k = 0; k < 7; k++) {
      const r = R - k * band;
      if (r <= 0) break;
      P.ring(0, 0, r, { size: 1, colour: k + 1, f }, 1);
    }
  }

  /** In 3D it's what it is, a sphere: the front as seven shells, the decades as fainter ones inside. */
  sphere(P, V, f, R) {
    const shell = (r, st, spacing, cap) => {
      const rc = (r * V.ppm) / V.cell, n = Math.min(cap, Math.max(12, Math.ceil((4 * Math.PI * rc * rc) / (spacing * spacing))));
      for (let k = 0; k < n; k++) {
        const z = 1 - (2 * (k + 0.5)) / n, s = Math.sqrt(1 - z * z), a = k * 2.39996;
        P.dot3(r * s * Math.cos(a), r * s * Math.sin(a), r * z, st);
      }
    };
    const now = 1920.84 + radioYears() + this.extra;
    for (let y = 1930; y < now; y += 10) {
      const r = (now - y) * LY;
      if ((r * V.ppm) / V.cell > 3) shell(r, { size: 0.25, tone: 0.4, f }, 5, 700);
    }
    const band = P.m * 0.55;
    for (let k = 0; k < 7; k++) {
      const r = R - k * band;
      if (r <= 0) break;
      shell(r, { size: 1, colour: k + 1, f }, 2.5, 2200);
    }
  }
}
