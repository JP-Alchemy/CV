// Images become blocks: sample darkness on a grid, then convert to squares
// (halftone: size follows darkness; dither: ordered Bayer threshold).
// Procedural "renders" stand in for real project imagery; real images can be
// passed as { src } and are sampled through a canvas once loaded.

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 5) {
  let f = 0, amp = 0.5;
  for (let i = 0; i < oct; i++) { f += amp * vnoise(x, y, s + i * 17); x *= 2.03; y *= 2.03; amp *= 0.5; }
  return f;
}

// Each generator maps (x, y) in [0,1] (y down), aspect (w/h), seed and the
// dark flag to ink 0..1. In dark mode ink is light, so lit surfaces return
// high ink there; line-art marks stay marks in both themes.
const LIGHT = (() => { const l = [-0.55, -0.6, 0.58]; const m = Math.hypot(...l); return l.map((v) => v / m); })();
const lambert = (nx, ny, nz) => clamp(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
const lit = (lam, dark, spec = 0) => (dark ? clamp(0.08 + lam * 0.92 + spec) : clamp(0.97 - lam * 0.92 - spec));

// 2D distances for drawn shapes: negative inside.
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}
function boxDist(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function polyDist(px, py, pts) {
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    if ((ay > py) !== (by > py) && px < ax + (ex * (py - ay)) / ey) inside = !inside;
  }
  return inside ? -d : d;
}

// The motorcycle: a rider on a loaded adventure bike, in metres with y up
// and the origin on the road between the axles. Parts run front to back
// (the first one a point falls in is drawn); parts of different groups keep
// a thin gap of paper between them, and alb darkens a material.
const TYRE = 0.6, PAINT = 0.7;
function wheel(cx, cy, r, rim) {
  return {
    g: `wheel${cx}`,
    d: (x, y) => Math.hypot(x - cx, y - cy) - r,
    // The tyre is a torus, then the rim, the hub and six spokes; null
    // between the spokes, where whatever is behind shows through.
    fill(x, y) {
      const dx = x - cx, dy = y - cy, rho = Math.hypot(dx, dy);
      if (rho > rim) {
        const o = (rho - (r + rim) / 2) / ((r - rim) / 2);
        return { n: [(dx / rho) * o, (dy / rho) * o, Math.sqrt(Math.max(0, 1 - o * o))], alb: TYRE };
      }
      if (rho > rim - 0.04) return { n: [0, 0, 1] };
      if (rho < 0.08) return { n: [dx / 0.08, dy / 0.08, Math.sqrt(Math.max(0, 1 - (rho / 0.08) ** 2))] };
      const a = Math.atan2(dy, dx) - 0.3;
      for (let k = 0; k < 6; k++) {
        const t = a - (k * Math.PI) / 3;
        if (Math.cos(t) > 0 && Math.abs(Math.sin(t)) * rho < 0.02) return { ink: 0.75 };
      }
      return null;
    },
  };
}
const BODY = [[0.94, 0.86], [0.64, 1.12], [0.42, 1.17], [0.1, 1.13], [-0.08, 1.0], [-0.62, 1.02], [-0.98, 1.08],
  [-0.96, 0.96], [-0.5, 0.86], [-0.12, 0.8], [0.2, 0.74], [0.55, 0.8], [0.86, 0.78]]; // beak, tank, seat and tail
const MOTORCYCLE = [
  { g: 'arm', d: (x, y) => segDist(x, y, 0.17, 1.31, 0.4, 1.24) - 0.07, bevel: 0.07 }, // forearm
  { g: 'arm', d: (x, y) => segDist(x, y, -0.04, 1.5, 0.17, 1.31) - 0.085, bevel: 0.085 }, // upper arm
  { g: 'head', d: (x, y) => segDist(x, y, 0.1, 1.92, 0.32, 1.86) - 0.035, bevel: 0.035 }, // helmet peak
  { g: 'head', d: (x, y) => Math.hypot(x - 0.05, y - 1.76) - 0.19, bevel: 0.19, visor: true }, // helmet
  { g: 'leg', d: (x, y) => boxDist(x, y, 0.12, 0.55, 0.14, 0.075, 0.05), bevel: 0.06, alb: 0.7 }, // boot
  { g: 'leg', d: (x, y) => segDist(x, y, 0.22, 1.02, 0.07, 0.62) - 0.09, bevel: 0.09 }, // shin
  { g: 'leg', d: (x, y) => segDist(x, y, -0.24, 1.08, 0.22, 1.04) - 0.115, bevel: 0.115 }, // thigh
  { g: 'torso', d: (x, y) => segDist(x, y, -0.26, 1.12, -0.08, 1.52) - 0.17, bevel: 0.17 },
  { g: 'bike', d: (x, y) => segDist(x, y, 0.64, 1.14, 0.5, 1.48) - 0.04, bevel: 0.04, alb: 0.9 }, // windscreen
  { g: 'bike', d: (x, y) => polyDist(x, y, BODY), bevel: 0.14, alb: PAINT },
  { g: 'case', d: (x, y) => boxDist(x, y, -0.74, 0.84, 0.26, 0.19, 0.05), bevel: 0.07, alb: 0.85 }, // pannier
  { g: 'bike', d: (x, y) => boxDist(x, y, 0.08, 0.52, 0.25, 0.2, 0.09), bevel: 0.11, alb: PAINT * 0.85 }, // engine
  { g: 'bike', d: (x, y) => segDist(x, y, 0.72, 0.4, 0.52, 1.0) - 0.05, bevel: 0.05, alb: PAINT }, // fork
  wheel(0.72, 0.4, 0.4, 0.25),
  wheel(-0.7, 0.4, 0.4, 0.25),
];

// The skyline behind it, left to right in image units (y down): a massif, a
// jagged peak, a low saddle behind the rider, three towers and a ridge.
const DOLOMITES = [[-1.2, 0.44], [-1.0, 0.36], [-0.94, 0.3], [-0.9, 0.31], [-0.86, 0.24], [-0.8, 0.22], [-0.76, 0.25],
  [-0.72, 0.21], [-0.66, 0.2], [-0.62, 0.3], [-0.58, 0.33], [-0.52, 0.29], [-0.47, 0.17], [-0.44, 0.15], [-0.41, 0.21],
  [-0.38, 0.18], [-0.33, 0.11], [-0.3, 0.12], [-0.24, 0.24], [-0.16, 0.3], [-0.06, 0.35], [0.06, 0.36], [0.16, 0.3],
  [0.22, 0.24], [0.26, 0.25], [0.3, 0.13], [0.34, 0.12], [0.36, 0.18], [0.39, 0.17], [0.41, 0.14], [0.44, 0.14],
  [0.46, 0.22], [0.49, 0.2], [0.51, 0.17], [0.54, 0.18], [0.57, 0.3], [0.66, 0.34], [0.72, 0.28], [0.78, 0.24],
  [0.84, 0.25], [0.9, 0.2], [0.95, 0.22], [1.0, 0.3], [1.2, 0.38]];

export const GENERATORS = {
  orb(x, y, ar, s, dark) {
    const px = (x - 0.5) * ar, py = y - 0.46;
    const r = 0.3;
    const d2 = px * px + py * py;
    const rx = px / 1.75, ry = (py + 0.03) / 0.5;
    const ring = Math.abs(Math.hypot(rx, ry) - r * 1.02) < 0.022;
    if (d2 < r * r) {
      if (ring && py > 0.02) return 0.95;
      const nz = Math.sqrt(r * r - d2) / r;
      const lam = lambert(px / r, py / r, nz);
      return lit(lam, dark, Math.pow(lam, 22) * 0.6);
    }
    if (ring) return 0.9;
    if (dark) return 0;
    const sh = Math.hypot(px / 1.6, (py - 0.37) / 0.08);
    return sh < r ? 0.55 * (1 - sh / r) : 0;
  },

  portrait(x, y, ar, s, dark) {
    // A plaster bust: head, neck and shoulders, lit from the top left.
    const px = (x - 0.5) * ar, py = y;
    let dx = px / 0.15, dy = (py - 0.35) / 0.19;
    let d2 = dx * dx + dy * dy;
    if (d2 < 1) return lit(lambert(dx, dy * 0.8, Math.sqrt(1 - d2)), dark);
    if (Math.abs(px) < 0.075 && py > 0.45 && py < 0.7) {
      const nx = px / 0.075;
      return lit(lambert(nx, 0, Math.sqrt(1 - nx * nx)) * 0.75, dark);
    }
    dx = px / 0.43; dy = (py - 0.98) / 0.34;
    d2 = dx * dx + dy * dy;
    if (d2 < 1 && py > 0.62) return lit(lambert(dx, dy, Math.sqrt(1 - d2)), dark);
    return 0;
  },

  terrain(x, y, ar, s = 3) {
    // Topographic map: contour lines of a noise height field.
    const f = (u, v) => fbm(u * ar * 1.7 + 3, v * 1.7 + 1, s, 5);
    const h = f(x, y), e = 0.003;
    const gx = (f(x + e, y) - h) / e, gy = (f(x, y + e) - h) / e;
    const bands = 10;
    const fr = (h * bands) % 1;
    const dist = Math.min(fr, 1 - fr) / (bands * Math.hypot(gx, gy) + 1e-6);
    if (dist < 0.0065) return 0.92;
    const shade = clamp((gx * 0.6 + gy * 0.5) * 0.35);
    return shade * 0.45;
  },

  waves(x, y, ar) {
    const px = x * ar, py = y;
    const a = Math.sin(Math.hypot(px - 0.2 * ar, py - 0.3) * 46);
    const b = Math.sin(Math.hypot(px - 0.85 * ar, py - 0.8) * 40);
    const v = (a + b) * 0.25 + 0.5;
    return clamp(Math.pow(v, 1.6));
  },

  cubes(x, y, ar, s, dark) {
    // Tumbling blocks: pointy hexagons split into three shaded rhombi.
    const R = 0.115;
    const px = x * ar, py = y;
    const q = ((Math.sqrt(3) / 3) * px - py / 3) / R;
    const r = ((2 / 3) * py) / R;
    const cx = q, cz = r, cy = -q - r;
    let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const hx = R * Math.sqrt(3) * (rx + rz / 2), hy = R * 1.5 * rz;
    const a = ((Math.atan2(-(py - hy), px - hx) * 180) / Math.PI + 360) % 360;
    const fade = 1 - y * 0.45;
    const face = a >= 30 && a < 150 ? 0.08 : a >= 150 && a < 270 ? 0.5 : 0.92;
    return (dark ? 1 - face : face) * fade;
  },

  rings(x, y, ar) {
    const px = x * ar, py = y;
    const a = Math.hypot(px - ar * 0.38, py - 0.5);
    const b = Math.hypot(px - ar * 0.62, py - 0.5);
    const v = (Math.sin(a * 70) > 0 ? 1 : 0) ^ (Math.sin(b * 70) > 0 ? 1 : 0);
    const vign = 1 - smooth(0.25, 0.75, Math.hypot(px - ar / 2, py - 0.5));
    return v ? 0.85 * vign + 0.05 : 0.0;
  },

  bars(x, y) {
    const n = 22;
    const i = Math.floor(x * n);
    const fx = x * n - i;
    const hgt = 0.15 + 0.7 * fbm(i * 0.35, 0.5, 9, 3) + 0.08 * Math.sin(i * 0.9);
    const top = 0.92 - hgt;
    if (fx > 0.18 && fx < 0.82 && y > top && y < 0.92) return 0.25 + 0.7 * smooth(top, top + 0.5, y);
    if (Math.abs(y - 0.93) < 0.006) return 0.9;
    return Math.abs(y * 10 - Math.round(y * 10)) < 0.015 ? 0.22 : 0;
  },

  moon(x, y, ar, s, dark) {
    // A cratered moon over still water, with its broken reflection below.
    const px = (x - 0.5) * ar, horizon = 0.66;
    if (y < horizon) {
      const py = y - 0.32, r = 0.2;
      const d2 = px * px + py * py;
      if (d2 > r * r) return 0;
      const nz = Math.sqrt(r * r - d2) / r;
      const crater = smooth(0.55, 0.75, fbm(px * 9 + 3, py * 9 + 7, 31, 4)) * 0.35;
      const lam = clamp(lambert(px / r, py / r, nz) - crater);
      return lit(lam, dark);
    }
    if (y < horizon + 0.006) return 0.75;
    const depth = (y - horizon) / (1 - horizon);
    const half = 0.2 * (1 + depth * 0.9) + Math.sin(y * 90) * 0.02;
    const ripple = Math.sin(y * 150 + Math.sin(px * 18) * 1.4);
    if (Math.abs(px) < half && ripple > 0.35 - depth * 0.6) {
      const v = (1 - Math.abs(px) / half) * (1 - depth * 0.55);
      return dark ? clamp(0.3 + v * 0.7) : clamp(0.2 + v * 0.6);
    }
    return Math.sin(y * 150 + px * 3) > 0.96 ? 0.25 : 0;
  },

  duck(x, y, ar, s, dark) {
    // A rubber duck bobbing on a little water.
    const px = (x - 0.5) * ar;
    const water = 0.78 + Math.sin(px * 26) * 0.012;
    if (y > water) return Math.sin(px * 40 + y * 70) > 0.6 ? 0.55 : 0.12;
    const eye = Math.hypot(px + 0.15, y - 0.3);
    if (eye < 0.022) return dark ? 0.05 : 0.98;
    let dx = (px + 0.33) / 0.11, dy = (y - 0.36) / 0.045; // beak
    if (dx * dx + dy * dy < 1) return lit(lambert(-0.4, dy * 0.5, 0.8) * 0.55, dark);
    dx = (px + 0.11) / 0.15; dy = (y - 0.33) / 0.15; // head
    let d2 = dx * dx + dy * dy;
    if (d2 < 1) return lit(lambert(dx, dy, Math.sqrt(1 - d2)), dark);
    dx = (px - 0.06) / 0.33; dy = (y - 0.62) / 0.19; // body
    d2 = dx * dx + dy * dy;
    if (d2 < 1) return lit(lambert(dx, dy, Math.sqrt(1 - d2)), dark);
    dx = (px - 0.36) / 0.1; dy = (y - 0.47) / 0.1; // tail
    d2 = dx * dx + dy * dy;
    if (d2 < 1 && px > 0.3) return lit(lambert(dx, dy, Math.sqrt(1 - d2)) * 0.8, dark);
    return 0;
  },

  cyber(x, y, ar, s, dark) {
    // Synthwave: a striped sun sinking behind a perspective grid.
    const px = (x - 0.5) * ar, horizon = 0.58;
    if (y < horizon) {
      const sy = y - 0.4, r = 0.26;
      if (px * px + sy * sy < r * r) {
        const band = (y - 0.32) / (horizon - 0.32);
        if (band > 0 && Math.sin(band * band * 34) > 0.15) return 0;
        return dark ? 0.35 + 0.6 * (1 - y / horizon) : 0.3 + 0.65 * (y / horizon);
      }
      return 0;
    }
    if (y < horizon + 0.008) return 0.9;
    const z = 0.05 / (y - horizon);
    const gx = px * z * 6;
    const lineZ = Math.abs(((z * 3) % 1) - 0.5) > 0.5 - 0.08 / (1 + z * 3);
    const lineX = Math.abs(((gx + 100.5) % 1) - 0.5) > 0.5 - 0.06 * (1 + z * 0.2);
    return lineZ || lineX ? 0.85 : 0;
  },

  switchbacks(x, y, ar, s = 5) {
    // An alpine pass: hairpins climbing a contour-lined slope.
    const px = x * ar;
    const road = (t) => [(0.5 + 0.36 * Math.sin(t * Math.PI * 5.5) * (0.5 + t * 0.5)) * ar, 0.93 - t * 0.84];
    let best = 9;
    let [ax, ay] = road(0);
    for (let i = 1; i <= 160; i++) {
      const [bx, by] = road(i / 160);
      const vx = bx - ax, vy = by - ay;
      const k = clamp(((px - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
      const d = Math.hypot(px - ax - vx * k, y - ay - vy * k);
      if (d < best) best = d;
      ax = bx; ay = by;
    }
    if (best < 0.024) return 0.95;
    if (best < 0.04) return 0;
    const h = fbm(px * 2.4 + 1, y * 2.4 + 4, s, 4) + (1 - y) * 0.6;
    const fr = (h * 9) % 1;
    return Math.min(fr, 1 - fr) < 0.06 ? 0.4 : 0;
  },

  motorcycle(x, y, ar, s, dark) {
    // A rider on a loaded adventure bike, on a road below the Dolomites.
    const px = (x - 0.5) * ar, ground = 0.88, k = 0.4 * Math.min(1, ar);
    const bx = px / k, by = (ground - y) / k; // in the bike's metres
    const near = {}; // how close each group in front of this part came
    let halo = 9;
    // Only points inside the bike's box (with its halo) can touch it.
    const parts = bx > -1.17 && bx < 1.19 && by > -0.07 && by < 2.02 ? MOTORCYCLE : [];
    for (const p of parts) {
      const d = p.d(bx, by);
      const f = d < 0 && p.fill ? p.fill(bx, by) : null;
      if (d >= 0 || (p.fill && !f)) {
        if (d >= 0) { near[p.g] = Math.min(near[p.g] ?? 9, d); halo = Math.min(halo, d); }
        continue;
      }
      for (const g in near) if (g !== p.g && near[g] < 0.04) return 0;
      if (f?.ink) return f.ink;
      let n = f?.n;
      if (!n) {
        const e = 0.004;
        const gx = p.d(bx + e, by) - p.d(bx - e, by), gy = p.d(bx, by + e) - p.d(bx, by - e);
        const g = Math.hypot(gx, gy) || 1, o = 1 - clamp(-d / p.bevel);
        n = [(gx / g) * o, (gy / g) * o, Math.sqrt(Math.max(0, 1 - o * o))];
      }
      let lam = lambert(n[0], -n[1], n[2]) * (f?.alb ?? p.alb ?? 1);
      if (p.visor && bx > 0.08 && Math.abs(by - 1.75) < 0.06) lam *= 0.2; // a dark band across the front
      // On paper the bike stays a darker mass than the other renders, so it
      // holds its shape in front of the range.
      return dark ? clamp(0.08 + lam * 0.92) : clamp(0.97 - lam * 0.55);
    }
    if (halo < 0.06) return 0;
    // The road: the bike's shadow, the far edge, the centre line and the near edge.
    if (Math.hypot(px / 0.42, (y - ground - 0.005) / 0.022) < 1) return dark ? 0 : 0.55;
    if (Math.abs(y - (ground - 0.02)) < 0.006) return 0.6;
    if (Math.abs(y - (ground + 0.03)) < 0.007) return Math.sin(px * 24) > 0.1 ? 0.75 : 0;
    if (Math.abs(y - (ground + 0.08)) < 0.009) return 0.85;
    if (y > ground - 0.03) return 0;
    // The range: the ridge as a line, and stipple down the faces turned
    // away from the light.
    let i = 1;
    while (i < DOLOMITES.length - 1 && DOLOMITES[i][0] < px) i++;
    let edge = 9;
    for (let j = Math.max(1, i - 2); j < Math.min(DOLOMITES.length, i + 3); j++) {
      edge = Math.min(edge, segDist(px, y, ...DOLOMITES[j - 1], ...DOLOMITES[j]));
    }
    if (edge < 0.009) return 0.75;
    const [ax, ay] = DOLOMITES[i - 1], [cx, cy] = DOLOMITES[i];
    const top = ay + (cy - ay) * clamp((px - ax) / (cx - ax));
    if (y < top || cy <= ay) return 0;
    return clamp((dark ? 0.24 : 0.3) * (1 - smooth(0.04, 0.2, y - top)) * (0.8 + 0.4 * fbm(px * 30, y * 3, 13, 2)));
  },

  pose(x, y, ar) {
    // Pose-estimation skeleton: joints, bones and a tracking box.
    const px = (x - 0.5) * ar, py = y;
    const J = {
      head: [0.02, 0.17], neck: [0, 0.27], ls: [-0.12, 0.3], rs: [0.12, 0.29], le: [-0.24, 0.2], re: [0.2, 0.42],
      lh: [-0.27, 0.08], rh: [0.13, 0.52], hip: [0.01, 0.55], lhip: [-0.08, 0.56], rhip: [0.09, 0.55],
      lk: [-0.17, 0.71], rk: [0.15, 0.7], la: [-0.13, 0.88], ra: [0.27, 0.8],
    };
    const bones = [['neck', 'ls'], ['neck', 'rs'], ['ls', 'le'], ['le', 'lh'], ['rs', 're'], ['re', 'rh'], ['neck', 'hip'],
      ['hip', 'lhip'], ['hip', 'rhip'], ['lhip', 'lk'], ['lk', 'la'], ['rhip', 'rk'], ['rk', 'ra'], ['neck', 'head']];
    for (const k in J) if (Math.hypot(px - J[k][0], py - J[k][1]) < (k === 'head' ? 0.06 : 0.026)) return 0.95;
    for (const [a, b] of bones) {
      const [ax, ay] = J[a], [bx, by] = J[b];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy));
      if (Math.hypot(px - ax - vx * t, py - ay - vy * t) < 0.009) return 0.75;
    }
    const bx = Math.abs(px) - 0.36, by = Math.abs(py - 0.5) - 0.44;
    const edge = Math.max(bx, by);
    if (Math.abs(edge) < 0.006 && (Math.floor((px + py) * 40) % 2 === 0)) return 0.55;
    return 0;
  },

  swarm(x, y, ar, s, dark) {
    // A little fort under a swirling swarm of flies.
    const px = (x - 0.5) * ar;
    for (let i = 0; i < 90; i++) {
      const a = i * 2.399 + Math.sin(i * 0.7) * 0.4;
      const r = 0.05 + 0.2 * Math.sqrt(i / 90) + hash2(i, 3, 7) * 0.03;
      const fx = 0.2 + Math.cos(a) * r * 1.35, fy = 0.3 + Math.sin(a) * r * 0.75;
      if (Math.hypot(px - fx, y - fy) < 0.011 + hash2(i, 9, 2) * 0.006) return 0.95;
    }
    if (Math.abs(y - 0.88) < 0.006) return Math.floor(px * 60) % 2 === 0 ? 0.7 : 0;
    const inWall = Math.abs(px + 0.12) < 0.2 && y > 0.6 && y < 0.88;
    const merlon = Math.abs(px + 0.12) < 0.2 && y > 0.54 && y <= 0.6 && Math.floor((px + 0.32) / 0.06) % 2 === 0;
    const tower = Math.abs(px + 0.12) < 0.07 && y > 0.42 && y < 0.6;
    const towerTop = Math.abs(px + 0.12) < 0.09 && y > 0.38 && y <= 0.42 && Math.floor((px + 0.21) / 0.045) % 2 === 0;
    const door = Math.abs(px + 0.12) < 0.045 && y > 0.74 && (y > 0.78 || Math.hypot(px + 0.12, y - 0.78) < 0.045);
    const flag = (Math.abs(px + 0.12) < 0.005 && y > 0.27 && y < 0.38) || (px > -0.12 && px < -0.05 && y > 0.27 && y < 0.31);
    if (door) return 0;
    if (inWall || merlon || tower || towerTop || flag) {
      const side = clamp(0.55 + (px + 0.12) * 1.4);
      return dark ? clamp(1 - side * 0.6) : clamp(0.35 + side * 0.6);
    }
    return 0;
  },

  earth(x, y, ar, s, dark) {
    // The globe with supply routes arcing across it.
    const px = (x - 0.5) * ar, py = y - 0.5;
    const arcs = [[-0.28, 0.12, 0.05, -0.1, 0.22], [0.25, 0.2, 0.05, -0.1, 0.16], [-0.1, -0.28, 0.05, -0.1, 0.12]];
    for (const [ax, ay, bx, by, lift] of arcs) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2 - lift;
      let best = 9, prev = [ax, ay];
      for (let i = 1; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        const cx = u * u * ax + 2 * u * t * mx + t * t * bx, cy = u * u * ay + 2 * u * t * my + t * t * by;
        const vx = cx - prev[0], vy = cy - prev[1];
        const k = clamp(((px - prev[0]) * vx + (py - prev[1]) * vy) / (vx * vx + vy * vy));
        best = Math.min(best, Math.hypot(px - prev[0] - vx * k, py - prev[1] - vy * k));
        prev = [cx, cy];
      }
      if (best < 0.015) return 0.98;
      if (best < 0.03) return 0;
      if (Math.hypot(px - ax, py - ay) < 0.026) return 0.98;
    }
    if (Math.hypot(px - 0.05, py + 0.1) < 0.03) return 0.98;
    // Plain shaded planet with landmasses, so the routes stay legible.
    const r = 0.42, d = Math.hypot(px, py);
    if (d > r) return Math.abs(d - r - 0.03) < 0.004 ? 0.4 : 0;
    const z = Math.sqrt(r * r - d * d);
    const lam = lambert(px / r, py / r, z / r);
    const lat = Math.asin(-py / r), lon = Math.atan2(px, z) + 0.6;
    const land = fbm(lon * 2 + 4, lat * 2 + 4, 21, 4) > 0.5;
    const base = land ? 0.5 : 0.1;
    return dark ? clamp(base * (0.35 + lam * 0.9)) : clamp(base + (1 - lam) * 0.3);
  },

  globe(x, y, ar, s, dark) {
    const px = (x - 0.5) * ar, py = y - 0.5;
    const r = 0.4;
    const d = Math.hypot(px, py);
    if (d > r) return Math.abs(d - r - 0.03) < 0.005 ? 0.5 : 0;
    const z = Math.sqrt(r * r - d * d);
    const lat = Math.asin(-py / r), lon = Math.atan2(px, z) + 0.6;
    const g = 12;
    const la = Math.abs((((lat / Math.PI) * g + 0.5) % 1) - 0.5) < 0.05;
    const lo = Math.abs((((lon / Math.PI) * g + 0.5) % 1) - 0.5) < 0.05 * Math.cos(lat) + 0.01;
    if (la || lo) return 0.92;
    const land = fbm(lon * 2 + 4, lat * 2 + 4, 21, 4) > 0.52;
    const lam = lambert(px / r, py / r, z / r);
    const base = dark ? 0.1 + lam * 0.35 : 0.42 - lam * 0.35;
    return clamp(base + (land ? 0.3 : 0));
  },
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const photoCache = new Map();
export function loadPhoto(src, onload) {
  if (photoCache.has(src)) return photoCache.get(src);
  const entry = { img: null, ready: false };
  photoCache.set(src, entry);
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    entry.img = img;
    entry.ready = true;
    if (onload) onload(); else window.dispatchEvent(new Event('photo-loaded'));
  };
  img.src = src;
  return entry;
}

/** Decoded pixels ({ w, h, px: RGBA }) for a src, for build scripts that have no <img>. */
export function setPhoto(src, rgba) {
  photoCache.set(src, { img: null, rgba, ready: true });
}

/** Cover-fit into cols x rows, as RGBA: averaged pixels, or the browser's resampling. */
function fitPixels(entry, cols, rows) {
  const src = entry.rgba;
  if (!src) {
    const c = document.createElement('canvas');
    c.width = cols; c.height = rows;
    const g = c.getContext('2d', { willReadFrequently: true });
    const iw = entry.img.naturalWidth, ih = entry.img.naturalHeight;
    const s = Math.max(cols / iw, rows / ih);
    const dw = iw * s, dh = ih * s;
    g.imageSmoothingQuality = 'high';
    g.drawImage(entry.img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    return g.getImageData(0, 0, cols, rows).data;
  }
  const s = Math.max(cols / src.w, rows / src.h);
  const ox = (src.w - cols / s) / 2, oy = (src.h - rows / s) / 2;
  const out = new Uint8ClampedArray(cols * rows * 4);
  for (let j = 0; j < rows; j++) {
    const y0 = Math.floor(oy + j / s), y1 = Math.max(y0 + 1, Math.floor(oy + (j + 1) / s));
    for (let i = 0; i < cols; i++) {
      const x0 = Math.floor(ox + i / s), x1 = Math.max(x0 + 1, Math.floor(ox + (i + 1) / s));
      const acc = [0, 0, 0, 0];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let k = 0; k < 4; k++) acc[k] += src.px[(y * src.w + x) * 4 + k];
      const n = (y1 - y0) * (x1 - x0);
      for (let k = 0; k < 4; k++) out[(j * cols + i) * 4 + k] = acc[k] / n;
    }
  }
  return out;
}

const sampleCache = new Map();

/** Darkness grid (cols x rows), supersampled. */
export function sample(spec, cols, rows, ar, dark = false) {
  const treat = JSON.stringify([spec.lumaInk, spec.cutout, spec.levels, spec.minInk, spec.darkMaxInk]);
  const id = `${spec.kind || spec.src}|${spec.seed || 0}|${treat}|${cols}|${rows}|${ar.toFixed(3)}|${dark ? 1 : 0}`;
  const hit = sampleCache.get(id);
  if (hit) return hit;
  const out = new Float32Array(cols * rows);
  if (spec.src) {
    const entry = loadPhoto(spec.src, spec.onload);
    if (!entry.ready) return null;
    const d = fitPixels(entry, cols, rows);
    // Optional cut-out: keep warm pixels (skin, hair, clothes) and drop a
    // neutral grey backdrop, then clean the mask with a 3x3 majority vote.
    let mask = null;
    if (spec.cutout) {
      const raw = new Uint8Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) raw[i] = (d[i * 4] - d[i * 4 + 2]) / 255 > (spec.cutout.warm ?? 0.05) ? 1 : 0;
      mask = new Uint8Array(cols * rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let votes = 0, n = 0;
          for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
            const yy = y + j, xx = x + k;
            if (yy < 0 || xx < 0 || yy >= rows || xx >= cols) continue;
            votes += raw[yy * cols + xx]; n++;
          }
          mask[y * cols + x] = votes * 2 > n ? 1 : 0;
        }
      }
    }
    const [lo, hi] = spec.levels || [0, 1];
    for (let i = 0; i < cols * rows; i++) {
      if (mask && !mask[i]) { out[i] = 0; continue; }
      const l = clamp(((0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255 - lo) / (hi - lo));
      // Ink is light in dark mode. Images with a dark background (game
      // screenshots) set lumaInk so their bright subjects become the blocks
      // in both themes instead of a solid slab.
      let ink = dark || spec.lumaInk ? l : 1 - l;
      if (mask) ink = Math.max(ink, spec.minInk ?? 0);
      if (dark && spec.darkMaxInk) ink = Math.min(ink, spec.darkMaxInk); // keep bright clothes from going solid
      out[i] = ink;
    }
  } else {
    const fn = GENERATORS[spec.kind] || GENERATORS.orb;
    const ss = 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        let acc = 0;
        for (let sy = 0; sy < ss; sy++) {
          for (let sx = 0; sx < ss; sx++) {
            acc += fn((i + (sx + 0.5) / ss) / cols, (j + (sy + 0.5) / ss) / rows, ar, spec.seed, dark);
          }
        }
        out[j * cols + i] = acc / (ss * ss);
      }
    }
  }
  sampleCache.set(id, out);
  return out;
}

/**
 * Convert a spec into blocks inside a w x h box.
 * style 'halftone': square per cell sized by darkness (cell px, 2px steps)
 * style 'dither': ordered dither, uniform blocks of `cell` px
 */
export function imageBlocks(spec, w, h, { style = 'halftone', cell = 8, dark = false, gamma = 1 } = {}) {
  const cols = Math.floor(w / cell), rows = Math.floor(h / cell);
  const ox = Math.floor((w - cols * cell) / 2), oy = Math.floor((h - rows * cell) / 2);
  const d = sample(spec, cols, rows, w / h, dark);
  if (!d) return new Float32Array(0);
  const out = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let v = d[j * cols + i];
      // Paper stays paper: lift the floor so near-white areas emit nothing.
      v = Math.pow(clamp((v - 0.1) / 0.85), gamma);
      if (style === 'dither') {
        if (v > BAYER4[(j % 4) * 4 + (i % 4)]) out.push(ox + i * cell, oy + j * cell, cell, cell, 1);
      } else {
        // Square side follows darkness in 1px steps (more tones than 2px
        // steps); integer offsets keep every edge on the pixel grid.
        const s = Math.round(cell * Math.sqrt(v));
        if (s < 2) continue;
        const o = Math.floor((cell - s) / 2);
        out.push(ox + i * cell + o, oy + j * cell + o, s, s, 1);
      }
    }
  }
  return Float32Array.from(out);
}
