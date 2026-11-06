// The Earth as a solid, for the 3D view (engine/renderer3d.js, cam.solid):
// a shell of cubes on a grid, both hemispheres, so you can turn right round
// it. Each column of cubes looks up the country under it the way the flat
// globe does (scenes.js Earth; geo.js, or world.js's coarse land until the
// outlines arrive): coasts solid ink, borders a shade lighter, land half ink,
// the Netherlands filled in, the sea faint. Leiden faces you when the camera
// is straight on, as in the flat view. Day and night are the renderer's,
// from where the Sun is now, so the terminator stays put as you turn.

import { land } from './world.js';

const LEIDEN = [52.16, 4.49];
const D = 180 / Math.PI;

/** Leiden's east, north and up: the view's x (right), up and z (towards you). */
function basis() {
  const p0 = LEIDEN[0] / D, l0 = LEIDEN[1] / D;
  return {
    e: [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)],
    E: [-Math.sin(l0), Math.cos(l0), 0],
    N: [-Math.sin(p0) * Math.cos(l0), -Math.sin(p0) * Math.sin(l0), Math.cos(p0)],
  };
}

/** Where the Sun is, in the view's frame (x right, y down, z towards you), for `days` since J2000. */
export function sunInView(days) {
  const { e, E, N } = basis();
  const frac = ((days % 1) + 1.5) % 1; // UTC time of day, 0 at midnight
  const dec = (-23.44 * Math.cos((2 * Math.PI * (((days + 10.5) % 365.25) + 365.25)) / 365.25)) / D;
  const sl = -(frac - 0.5) * 2 * Math.PI;
  const S = [Math.cos(dec) * Math.cos(sl), Math.cos(dec) * Math.sin(sl), Math.sin(dec)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return [dot(S, E), -dot(S, N), dot(S, e)];
}

/**
 * A globe n cubes in radius. G: geo.js's lookup once it's ready (else the
 * coarse land). Returns { n, buf: [x, y, z, tone] a cube, count }.
 */
export function buildGlobe(n, G) {
  const { e, E, N } = basis();
  const at = G?.ready ? (la, lo) => G.at(la, lo) : (la, lo) => (land(la, lo) ? 1 : 0);
  const nl = G?.ready ? G.nl : -2;
  const W = 2 * n + 1, n2 = n * n;
  const out = [];
  const top = new Int16Array(W * W), ids = new Int16Array(W * W);
  for (const sign of [1, -1]) {
    // Each column's surface height and what's there.
    for (let y = -n; y <= n; y++) {
      for (let x = -n; x <= n; x++) {
        const k = (y + n) * W + (x + n), q = x * x + y * y;
        if (q > n2) { top[k] = -1; continue; }
        const zt = Math.floor(Math.sqrt(n2 - q));
        top[k] = zt;
        const z = sign * Math.sqrt(Math.max(0, n2 - q)), up = -y;
        const vx = (x * E[0] + up * N[0] + z * e[0]) / n, vy = (x * E[1] + up * N[1] + z * e[1]) / n, vz = (x * E[2] + up * N[2] + z * e[2]) / n;
        ids[k] = at(Math.asin(Math.max(-1, Math.min(1, vz))) * D, Math.atan2(vy, vx) * D);
      }
    }
    // Then the cubes: from the surface down to just below the lowest neighbour, so steep sides have no holes.
    for (let y = -n; y <= n; y++) {
      for (let x = -n; x <= n; x++) {
        const k = (y + n) * W + (x + n), zt = top[k];
        if (zt < 0) continue;
        const nb = [x > -n ? k - 1 : -1, x < n ? k + 1 : -1, y > -n ? k - W : -1, y < n ? k + W : -1];
        let m = zt, coast = false, border = false;
        const id = ids[k];
        for (const j of nb) {
          const t = j < 0 ? -1 : top[j];
          m = Math.min(m, t + 1);
          if (j >= 0 && t >= 0 && id > 0) { if (ids[j] === 0) coast = true; else if (ids[j] !== id) border = true; }
        }
        const tone = id === 0 ? 0.16 : coast ? 1 : id === nl ? 1 : border ? 0.85 : 0.5;
        for (let z = Math.max(sign > 0 ? 0 : 1, m); z <= zt; z++) out.push(x, y, sign * z, tone);
      }
    }
  }
  return { n, buf: Float32Array.from(out), count: out.length / 4 };
}

const balls = new Map();
/** A plain ball of cubes n in radius (a shell, once it's big enough to be hollow), tone 1. Cached by n. */
export function ball(n) {
  let b = balls.get(n);
  if (b) return b;
  const out = [], m = Math.ceil(n), inner = n > 6 ? n - 1.8 : -1;
  for (let z = -m; z <= m; z++) for (let y = -m; y <= m; y++) for (let x = -m; x <= m; x++) {
    const d = Math.hypot(x, y, z);
    if (d <= n && d > inner) out.push(x, y, z, 1);
  }
  b = { buf: Float32Array.from(out), count: out.length / 4 };
  balls.set(n, b);
  return b;
}
