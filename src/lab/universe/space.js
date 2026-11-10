// Frames, the camera and flights. Positions are never global: every node
// (a brick of the cosmic web, a galaxy, a star, a planet, a spot on the
// ground, a grain of sand) sits at a float64 offset in metres from its parent,
// turned by its own axes. The camera hangs off one node (its anchor), so what
// is near it is always measured from something near it, and the GPU only
// ever sees positions relative to the eye, in units of the camera distance:
// float32 is then plenty, at 10^26 m or 10^-10 m.

export const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Row-major 3x3 product. */
export function mul3(A, B) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return o;
}
export const mulv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
export const tmulv = (A, v) => [A[0] * v[0] + A[3] * v[1] + A[6] * v[2], A[1] * v[0] + A[4] * v[1] + A[7] * v[2], A[2] * v[0] + A[5] * v[1] + A[8] * v[2]];
export const T3 = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Axes (columns east, north, up) for a frame whose z is `up`: local -> parent, row-major. */
export function frameAt(up) {
  const u = norm(up);
  let e = cross([0, 0, 1], u);
  if (len(e) < 1e-6) e = [1, 0, 0];
  e = norm(e);
  const n = cross(u, e);
  return [e[0], n[0], u[0], e[1], n[1], u[1], e[2], n[2], u[2]];
}

/** A random rotation from a stream (a uniform unit quaternion). */
export function randomRot(R) {
  const u1 = R(), u2 = R() * 6.283185307, u3 = R() * 6.283185307;
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  const x = a * Math.sin(u2), y = a * Math.cos(u2), z = b * Math.sin(u3), w = b * Math.cos(u3);
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}

/** Rotation about a unit axis. */
export function axisRot(a, t) {
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c, [x, y, z] = a;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
}

let nodes = 0;
/** A place: an offset (m, float64) in its parent's axes, and its own axes (local -> parent, row-major; null = the parent's). */
export class Node {
  constructor(parent, kind, key, pos = [0, 0, 0], rot = null, extent = 1) {
    this.parent = parent; this.kind = kind; this.key = key;
    this.pos = pos; this.rot = rot; this.extent = extent;
    this.depth = parent ? parent.depth + 1 : 0;
    this.id = ++nodes;
  }
}

/** p_A = t + R p_node, walking up to ancestor A. */
export function toAncestor(n, A) {
  let R = I3(), t = [0, 0, 0];
  for (let m = n; m !== A; m = m.parent) {
    if (m.rot) { t = mulv(m.rot, t); R = mul3(m.rot, R); }
    t = add(t, m.pos);
  }
  return { R, t };
}

export function lca(a, b) {
  while (a.depth > b.depth) a = a.parent;
  while (b.depth > a.depth) b = b.parent;
  while (a !== b) { a = a.parent; b = b.parent; }
  return a;
}

/** n's frame in a's: p_a = t + R p_n. Summed only up to their common ancestor, so precision is that of the nearest shared place. */
export function rel(n, a) {
  if (n === a) return { R: I3(), t: [0, 0, 0] };
  const L = lca(n, a), N = toAncestor(n, L), A = toAncestor(a, L);
  const At = T3(A.R);
  return { R: mul3(At, N.R), t: mulv(At, sub(N.t, A.t)) };
}

/** A point in n's frame, seen from a's. */
export const pointIn = (p, n, a) => { const T = rel(n, a); return add(T.t, mulv(T.R, p)); };

/**
 * The camera: it looks at a target `t` (m, in its anchor's frame) from
 * distance D, along -dir, with `up` roughly up.
 */
export class Camera {
  constructor(anchor) {
    this.anchor = anchor; this.t = [0, 0, 0]; this.D = 1;
    this.dir = norm([0.3, -0.8, 0.5]); this.up = [0, 0, 1];
  }
  eye() { return add(this.t, scale(this.dir, this.D)); }
  /** Re-hang the camera off another node; nothing on screen moves. */
  reanchor(n) {
    if (n === this.anchor) return;
    const T = rel(this.anchor, n);
    this.t = add(T.t, mulv(T.R, this.t));
    this.dir = norm(mulv(T.R, this.dir)); this.up = norm(mulv(T.R, this.up));
    this.anchor = n;
  }
  /** View axes (rows: right, up, back) from the anchor's axes. */
  axes() {
    const f = scale(this.dir, -1);
    let r = cross(f, this.up);
    if (len(r) < 1e-9) r = cross(f, [1, 0, 0]);
    r = norm(r);
    const u = cross(r, f);
    return [r[0], r[1], r[2], u[0], u[1], u[2], this.dir[0], this.dir[1], this.dir[2]];
  }
  /** Turn about the target: yaw about `up`, pitch about the right axis (kept off the poles, and above `floor` if given). */
  orbit(dyaw, dpitch, floor = -0.995) {
    let d = mulv(axisRot(norm(this.up), -dyaw), this.dir);
    const r = norm(cross(this.up, d));
    for (const f of [1, 0.5, 0.25, 0.1]) { // near the top or the floor, go as far as it can rather than stick
      const d2 = mulv(axisRot(r, dpitch * f), d), c = dot(norm(d2), norm(this.up));
      if (c < 0.995 && c > floor) { d = d2; break; }
    }
    this.dir = norm(d);
  }
}

/**
 * The smooth zoom-and-pan of van Wijk & Nuij (2003): from width w0 to w1
 * across a distance u1, zooming out as far as it pays to and back in.
 * Written in the forms that stay exact when u1/w0 is 10^30.
 * at(s): u (gone from the start), rem (left to the end), w; s in [0, S].
 */
export function flightPath(u1, w0, w1, rho = 1.4) {
  const r2 = rho * rho, r4 = r2 * r2;
  if (u1 < 1e-9 * Math.max(w0, w1)) {
    const k = Math.log(w1 / w0), S = Math.abs(k) / rho || 0.01;
    return { S, at: (s) => ({ u: 0, rem: 0, w: w0 * Math.exp((k * s) / S) }) };
  }
  const b0 = (w1 * w1 - w0 * w0 + r4 * u1 * u1) / (2 * w0 * r2 * u1);
  const b1 = (w1 * w1 - w0 * w0 - r4 * u1 * u1) / (2 * w1 * r2 * u1);
  const R0 = -Math.asinh(b0), R1 = -Math.asinh(b1), S = (R1 - R0) / rho;
  return {
    S,
    at(s) {
      const a = rho * s + R0, b = rho * (S - s) - R1;
      return { u: (w0 / r2) * Math.sinh(rho * s) / Math.cosh(a), rem: (w1 / r2) * Math.sinh(rho * (S - s)) / Math.cosh(b), w: s < S / 2 ? w0 * Math.cosh(R0) / Math.cosh(a) : w1 * Math.cosh(R1) / Math.cosh(b) };
    },
  };
}

/** Metres in words: the camera distance on the HUD. */
export function metres(m) {
  const LY = 9.4607e15, PC = 3.0857e16, AU = 1.496e11;
  if (m >= 3.0857e22) return `${fmt(m / 3.0857e22)} Mpc`;
  if (m >= 3.0857e19) return `${fmt(m / 3.0857e19)} kpc`;
  if (m >= 0.1 * LY) return `${fmt(m / LY)} ly`;
  if (m >= 0.05 * AU) return `${fmt(m / AU)} AU`;
  if (m >= 1e3) return `${fmt(m / 1e3)} km`;
  if (m >= 1) return `${fmt(m)} m`;
  if (m >= 1e-3) return `${fmt(m * 1e3)} mm`;
  if (m >= 1e-6) return `${fmt(m * 1e6)} µm`;
  if (m >= 1e-9) return `${fmt(m * 1e9)} nm`;
  return `${fmt(m * 1e12)} pm`;
  function fmt(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
  void PC;
}
