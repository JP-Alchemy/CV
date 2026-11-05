// Powers of Ten, below the DNA. Zoom into one rung of the helix and it's a
// base pair, guanine and cytosine, turned to face us: their atoms jiggling
// with heat, held to each other by three hydrogen bonds. Then one of its
// carbon atoms, its six electrons drawn the way quantum mechanics has them,
// as where each would be found if you looked, sampled from its orbital; then
// the nucleus, six protons and six neutrons; then one proton, three quarks
// on strings of gluon field. Everything in metres about "here".

import { rng } from './scenes.js';

const NM = 1e-9, PM = 1e-12, FM = 1e-15;
const A0 = 52.9 * PM; // the Bohr radius
const LIFE = 2.2; // s a found electron's dot stays
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// ---------------------------------------------------------------- the base pair

/**
 * Guanine (left) and cytosine (right), paired the Watson–Crick way: the
 * rings as regular polygons with bonds 0.14 nm long (real ones are within a
 * few hundredths of that), the three hydrogen bonds about 0.29 nm from atom
 * to atom, and the sugars they hang from where the backbone carries on. In
 * nm, y up; built once.
 */
function basePair() {
  const r = 0.139, atoms = [], bonds = [];
  const add = (el, x, y) => { atoms.push({ el, x, y }); return atoms.length - 1; };
  const bond = (a, b) => bonds.push([a, b]);
  const out = (k, from, el, len) => { // a substituent straight out from a ring atom
    const A = atoms[k], dx = A.x - from[0], dy = A.y - from[1], d = Math.hypot(dx, dy);
    const n = add(el, A.x + (dx / d) * len, A.y + (dy / d) * len);
    bond(k, n);
    return n;
  };
  const ring = (cx, names) => names.map(([el, deg]) => add(el, cx + r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)));
  // Cytosine: N3 facing guanine, O2 above, the amino N4 below.
  const cx = 0.1455 + r;
  const [cN3, cC2, cN1, cC6, cC5, cC4] = ring(cx, [['N', 180], ['C', 120], ['N', 60], ['C', 0], ['C', -60], ['C', -120]]);
  [[cN3, cC2], [cC2, cN1], [cN1, cC6], [cC6, cC5], [cC5, cC4], [cC4, cN3]].forEach(([a, b]) => bond(a, b));
  const C = [cx, 0];
  const cO2 = out(cC2, C, 'O', 0.124), cN4 = out(cC4, C, 'N', 0.134);
  out(cC5, C, 'H', 0.108); out(cC6, C, 'H', 0.108);
  const cS = out(cN1, C, 'C', 0.147); // the sugar's first carbon
  // Guanine: N1 facing cytosine, the amino N2 above, O6 below, the five-ring on the far side.
  const gx = -0.1455 - r;
  const [gN1, gC2, gN3, gC4, gC5, gC6] = ring(gx, [['N', 0], ['C', 60], ['N', 120], ['C', 180], ['C', -120], ['C', -60]]);
  [[gN1, gC2], [gC2, gN3], [gN3, gC4], [gC4, gC5], [gC5, gC6], [gC6, gN1]].forEach(([a, b]) => bond(a, b));
  const G = [gx, 0];
  const gN2 = out(gC2, G, 'N', 0.134), gO6 = out(gC6, G, 'O', 0.124);
  const gH1 = out(gN1, G, 'H', 0.101);
  // The five-ring on the C4–C5 edge: C4, N9, C8, N7, C5, a regular pentagon.
  const A = atoms[gC5], B = atoms[gC4];
  let px = B.x, py = B.y, dx = B.x - A.x, dy = B.y - A.y;
  const five = [];
  for (let k = 0; k < 3; k++) {
    const t = (72 * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; // turning away from the six-ring
    px += dx; py += dy;
    five.push(add(['N', 'C', 'N'][k], px, py));
  }
  const [gN9, gC8, gN7] = five;
  bond(gC4, gN9); bond(gN9, gC8); bond(gC8, gN7); bond(gN7, gC5);
  const P5 = [(A.x + B.x + atoms[gN9].x + atoms[gC8].x + atoms[gN7].x) / 5, (A.y + B.y + atoms[gN9].y + atoms[gC8].y + atoms[gN7].y) / 5];
  out(gC8, P5, 'H', 0.108);
  const gS = out(gN9, P5, 'C', 0.147);
  // The amino groups' hydrogens, ±60° either side of the C–N line; one of each pair points across.
  const amino = (n, c) => {
    const N = atoms[n], Cc = atoms[c], a = Math.atan2(N.y - Cc.y, N.x - Cc.x);
    return [1, -1].map((s) => { const h = add('H', N.x + 0.101 * Math.cos(a + s * Math.PI / 3), N.y + 0.101 * Math.sin(a + s * Math.PI / 3)); bond(n, h); return h; });
  };
  const hN2 = amino(gN2, gC2), hN4 = amino(cN4, cC4);
  // Which hydrogen of each amino group points at its partner.
  const towards = (hs, to) => hs.reduce((b, h) => (Math.hypot(atoms[h].x - atoms[to].x, atoms[h].y - atoms[to].y) < Math.hypot(atoms[b].x - atoms[to].x, atoms[b].y - atoms[to].y) ? h : b));
  const hbonds = [[towards(hN2, cO2), cO2], [gH1, cN3], [towards(hN4, gO6), gO6]];
  return { atoms, bonds, hbonds, focus: gC8, sugars: [gS, cS] };
}

/**
 * One base pair, every atom shivering with heat (about 0.01 nm, drawn as it
 * is, each its own Ornstein–Uhlenbeck process, hydrogens more), the bonds
 * stretching with them and the three hydrogen bonds dotted. Past a point the
 * view slides onto one carbon, the five-ring's, for the atom below.
 */
export class BasePair {
  constructor() {
    this.r = rng(91);
    const g = basePair();
    this.atoms = g.atoms.map((a) => ({ ...a, x: a.x * NM, y: -a.y * NM, jx: 0, jy: 0 }));
    this.bonds = g.bonds;
    this.hbonds = g.hbonds;
    this.sugars = g.sugars;
    this.focus = g.focus;
  }

  step(dt) {
    const r = this.r;
    for (const a of this.atoms) {
      const s = a.el === 'H' ? 0.018 : 0.009; // nm
      const k = Math.exp(-dt * 8), q = s * Math.sqrt(1 - k * k);
      a.jx = a.jx * k + gauss(r) * q;
      a.jy = a.jy * k + gauss(r) * q;
    }
  }

  /** slide: 0 the pair in the middle, 1 its five-ring carbon in the middle. */
  paint(P, V, f, slide) {
    const F = this.atoms[this.focus], e = slide * slide * (3 - 2 * slide);
    const ox = -F.x * e, oy = -F.y * e;
    const at = (a) => [a.x + a.jx * NM + ox, a.y + a.jy * NM + oy];
    const pts = this.atoms.map(at);
    for (const [a, b] of this.bonds) P.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], { size: 0.75, tone: 0.75, f });
    for (const [a, b] of this.hbonds) P.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], { size: 0.75, tone: 0.75, f }, 4);
    // The backbone, carrying on out of the picture from each sugar.
    for (const k of this.sugars) {
      const [x, y] = pts[k], d = Math.hypot(x - ox, y - oy) || 1;
      P.line(x, y, x + ((x - ox) / d) * 3 * NM, y + ((y - oy) / d) * 3 * NM, { size: 0.5, tone: 0.35, f }, 2);
    }
    this.atoms.forEach((a, k) => {
      const [x, y] = pts[k];
      if (a.el === 'H') cloud(P, V, x, y, 0.035 * NM, f);
      else if (a.el === 'O') { cloud(P, V, x, y, 0.07 * NM, f); P.ring(x, y, 0.075 * NM, { size: 0.75, tone: 0.8, f }, 1); }
      else if (a.el === 'N') { cloud(P, V, x, y, 0.07 * NM, f); P.ring(x, y, 0.075 * NM, { size: 0.5, tone: 0.55, f }, 2); }
      else cloud(P, V, x, y, 0.072 * NM, f);
    });
  }
}

/** An atom from afar: a fuzzy round cloud, thickest in the middle. */
function cloud(P, V, x, y, R, f) {
  const Rc = (R * V.ppm) / V.cell;
  if (Rc < 1) { P.dot(x, y, { f }); return; }
  const ci = P.u(x), cj = P.v(y);
  const i0 = Math.max(0, Math.floor(ci - Rc)), i1 = Math.min(V.cols - 1, Math.floor(ci + Rc));
  const j0 = Math.max(0, Math.floor(cj - Rc)), j1 = Math.min(V.rows - 1, Math.floor(cj + Rc));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const rr = Math.hypot(i + 0.5 - ci, j + 0.5 - cj) / Rc;
    if (rr > 1) continue;
    const d = Math.exp(-rr * rr * 2.5), h = (((i * 73856093) ^ (j * 19349663)) >>> 0) % 1000 / 1000;
    if (h < d) P.G.put(i, j, d > 0.6 ? 1 : d > 0.3 ? 0.75 : 0.5, 0, 0.5 + 0.5 * d, f);
  }
}

// ---------------------------------------------------------------- one atom

/**
 * A carbon atom: 1s², 2s², 2p², with hydrogen-like orbitals at Slater's
 * screened charges (5.7 for the inner shell, 3.1 for the outer). Every
 * moment a few positions are drawn from each electron's |ψ|² and shown as
 * dots that fade, so the cloud is built of places it would be found. The
 * two 2p electrons are in px and py, the lobes in the plane of the screen.
 */
export class Atom {
  constructor() {
    this.r = rng(17);
    this.dots = [];
  }

  sample(kind) {
    const r = this.r;
    const dir = () => { const z = 2 * r() - 1, t = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); return [s * Math.cos(t), s * Math.sin(t), z]; };
    const gamma = (k, scale) => { let s = 0; for (let i = 0; i < k; i++) s -= Math.log(r() + 1e-12); return s * scale; };
    if (kind === 0) { // 1s, Z = 5.7: P(r) ∝ r² e^(−2Zr)
      const rad = gamma(3, 1 / (2 * 5.7)) * A0, [x, y] = dir();
      return [x * rad, y * rad];
    }
    if (kind === 1) { // 2s, Z = 3.1: P(r) ∝ r² (2 − Zr)² e^(−Zr), by rejection
      for (;;) {
        const rad = gamma(3, 1 / 3.1), w = ((2 - 3.1 * rad) ** 2) / 4;
        if (r() < Math.min(1, w / 4)) { const [x, y] = dir(); return [x * rad * A0, y * rad * A0]; }
      }
    }
    // 2p, Z = 3.1: P(r) ∝ r⁴ e^(−Zr), and cos² of the angle to its axis.
    const rad = gamma(5, 1 / 3.1) * A0;
    const c = (r() < 0.5 ? -1 : 1) * Math.cbrt(r()), s = Math.sqrt(1 - c * c), t = 2 * Math.PI * r();
    const along = c * rad, side = s * rad * Math.cos(t);
    return kind === 2 ? [along, side] : [side, along];
  }

  step(dt) {
    const t = (this.t = (this.t || 0) + dt);
    const n = Math.min(60, Math.ceil(dt * 1000));
    for (let k = 0; k < n; k++) {
      const kind = [0, 0, 1, 1, 2, 3][Math.floor(this.r() * 6)]; // six electrons, one draw each
      const [x, y] = this.sample(kind);
      this.dots.push({ x, y, t, kind });
    }
    while (this.dots.length && t - this.dots[0].t > LIFE) this.dots.shift();
  }

  paint(P, V, f) {
    const t = this.t || 0;
    for (const d of this.dots) {
      const k = 1 - (t - d.t) / LIFE;
      P.dot(d.x, d.y, { size: d.kind === 0 ? 1 : 0.75, tone: 0.35 + 0.65 * k, f });
    }
    P.disc(0, 0, Math.max(2.7 * FM, P.m * 0.5), { f }); // the nucleus, far too small to see
  }
}

// ---------------------------------------------------------------- the nucleus

/**
 * Carbon-12's nucleus: six protons and six neutrons, each 0.84 fm in radius,
 * held together by the strong force and pushed apart where they overlap,
 * jostling. Ours, the proton in the middle, is held still.
 */
export class Nucleus {
  constructor() {
    const r = this.r = rng(23);
    this.n = Array.from({ length: 12 }, (_, k) => {
      const a = (k / 11) * 2 * Math.PI * 2.3, rad = k ? 1.3 + 0.9 * Math.sqrt(k / 11) : 0;
      return { x: k ? Math.cos(a) * rad * FM : 0, y: k ? Math.sin(a) * rad * FM : 0, proton: k % 2 === 0, ph: r() * 6 };
    });
  }

  step(dt) {
    const N = this.n, r = this.r, R = 0.84 * FM;
    for (let it = 0; it < 2; it++) {
      for (let a = 1; a < N.length; a++) {
        const p = N[a];
        // Held in: a pull towards the middle, the strong force on average.
        p.x += (-p.x * 0.8 * dt) + gauss(r) * 0.06 * FM * Math.sqrt(dt * 60) * 0.5;
        p.y += (-p.y * 0.8 * dt) + gauss(r) * 0.06 * FM * Math.sqrt(dt * 60) * 0.5;
      }
      for (let a = 0; a < N.length; a++) for (let b = a + 1; b < N.length; b++) {
        const A = N[a], B = N[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-18, m = R * 1.9;
        if (d >= m) continue;
        const push = (m - d) / d * 0.5;
        if (a) { A.x -= dx * push; A.y -= dy * push; } else { B.x += dx * push; B.y += dy * push; }
        if (a) { B.x += dx * push; B.y += dy * push; }
      }
    }
  }

  paint(P, V, f) {
    const R = 0.84 * FM;
    for (const p of this.n) {
      P.ring(p.x, p.y, R, { size: 1, tone: 0.9, f }, 1);
      if (p.proton) speckle(P, V, p.x, p.y, R * 0.85, { size: 0.5, tone: 0.65, f });
    }
  }
}

function speckle(P, V, x, y, R, st) {
  const Rc = (R * V.ppm) / V.cell;
  if (Rc < 1.5) { P.dot(x, y, st); return; }
  const ci = P.u(x), cj = P.v(y);
  const i0 = Math.max(0, Math.floor(ci - Rc)), i1 = Math.min(V.cols - 1, Math.floor(ci + Rc));
  const j0 = Math.max(0, Math.floor(cj - Rc)), j1 = Math.min(V.rows - 1, Math.floor(cj + Rc));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (((i + j) & 1) || (i - ci) ** 2 + (j - cj) ** 2 > Rc * Rc) continue;
    P.G.put(i, j, st.size, 0, st.tone, st.f);
  }
}

// ---------------------------------------------------------------- one proton

/**
 * A proton: two up quarks and a down, each pulled towards where the three
 * strings of gluon field meet by a force that doesn't weaken with distance
 * (the string tension: about 1 GeV per femtometre, some sixteen tonnes of
 * force), so they can never be pulled out. The field is drawn as light, because
 * it's energy: nearly all of the proton's mass is in it, not in the quarks.
 * Quark–antiquark pairs blink in and out of the field.
 */
export class Proton {
  constructor() {
    const r = this.r = rng(29);
    this.q = [0, 1, 2].map((k) => {
      const a = (k / 3) * 2 * Math.PI + 0.4;
      return { x: Math.cos(a) * 0.4 * FM, y: Math.sin(a) * 0.4 * FM, vx: 0, vy: 0 };
    });
    this.pairs = [];
    this.t = 0;
    for (const q of this.q) q.ph = r();
  }

  step(dt) {
    const r = this.r;
    this.t += dt;
    const J = this.junction();
    for (const q of this.q) {
      const dx = q.x - J[0], dy = q.y - J[1], d = Math.hypot(dx, dy) || 1e-18;
      // The string: a constant pull towards the junction, and a kick now and then.
      q.vx += (-(dx / d) * 4 * FM - q.vx * 1.5) * dt + gauss(r) * 1.2 * FM * Math.sqrt(dt);
      q.vy += (-(dy / d) * 4 * FM - q.vy * 1.5) * dt + gauss(r) * 1.2 * FM * Math.sqrt(dt);
      q.x += q.vx * dt; q.y += q.vy * dt;
      // Inside the proton, about 0.84 fm.
      const rr = Math.hypot(q.x, q.y);
      if (rr > 0.75 * FM) { q.x *= (0.75 * FM) / rr; q.y *= (0.75 * FM) / rr; q.vx *= -0.3; q.vy *= -0.3; }
    }
    if (r() < dt * 6) {
      const a = r() * 2 * Math.PI, d = Math.sqrt(r()) * 0.6 * FM, s = 0.06 * FM;
      this.pairs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, a: r() * Math.PI, s, t: this.t });
    }
    this.pairs = this.pairs.filter((p) => this.t - p.t < 0.35);
  }

  /** Where the three strings meet: the point with the least total string (near the middle of the three). */
  junction() {
    let x = (this.q[0].x + this.q[1].x + this.q[2].x) / 3, y = (this.q[0].y + this.q[1].y + this.q[2].y) / 3;
    for (let it = 0; it < 12; it++) { // Weiszfeld's iteration for the Fermat point
      let sx = 0, sy = 0, sw = 0;
      for (const q of this.q) { const d = Math.hypot(q.x - x, q.y - y) || 1e-20; sx += q.x / d; sy += q.y / d; sw += 1 / d; }
      x = sx / sw; y = sy / sw;
    }
    return [x, y];
  }

  paint(P, V, f) {
    const J = this.junction(), t = this.t;
    P.ring(0, 0, 0.84 * FM, { size: 0.5, tone: 0.5, f }, 2);
    // The strings: bands of field, flickering through the spectrum.
    const w = 0.09 * FM;
    for (const [k, q] of this.q.entries()) {
      const dx = q.x - J[0], dy = q.y - J[1], d = Math.hypot(dx, dy) || 1e-20, nx = -dy / d, ny = dx / d;
      const steps = Math.ceil((d * V.ppm) / V.cell) + 1;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        for (let o = -2; o <= 2; o++) {
          const x = J[0] + dx * u + nx * w * (o / 2), y = J[1] + dy * u + ny * w * (o / 2);
          const c = 1 + ((Math.floor(t * 9 + u * 7 + o * 1.3 + k * 2.1) % 7) + 7) % 7;
          P.dot(x, y, { size: Math.abs(o) === 2 ? 0.5 : 1, colour: c, f });
        }
      }
    }
    // The quarks, as good as points: drawn a few blocks across so you can see them.
    for (const q of this.q) P.disc(q.x, q.y, Math.max(0.03 * FM, P.m * 1.6), { f });
    for (const p of this.pairs) {
      const ox = Math.cos(p.a) * p.s, oy = Math.sin(p.a) * p.s;
      P.dot(p.x + ox, p.y + oy, { size: 0.75, tone: 0.7, f });
      P.dot(p.x - ox, p.y - oy, { size: 0.75, tone: 0.7, f });
    }
  }
}
