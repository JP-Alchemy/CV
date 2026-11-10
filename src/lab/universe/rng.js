// Seeds, hashes and noise. Nothing in the universe is stored: every place is
// a hash of its parent's seed and its own integer coordinates, so it comes
// out the same on every visit and there is no end to it.

const imul = Math.imul;

function mix(h, k) {
  k = imul(k, 0xcc9e2d51); k = (k << 15) | (k >>> 17); k = imul(k, 0x1b873593);
  h ^= k; h = (h << 13) | (h >>> 19);
  return (imul(h, 5) + 0xe6546b64) | 0;
}
function fin(h) {
  h ^= h >>> 16; h = imul(h, 0x85ebca6b); h ^= h >>> 13; h = imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

/** A uint32 from a seed and up to five integers (large ones fold their high bits in). */
export function hash(seed, a = 0, b = 0, c = 0, d = 0, e = 0) {
  let h = seed | 0;
  h = mix(h, a | 0); h = mix(h, b | 0); h = mix(h, c | 0); h = mix(h, d | 0); h = mix(h, e | 0);
  if (Math.abs(a) > 2147483647 || Math.abs(b) > 2147483647 || Math.abs(c) > 2147483647) {
    h = mix(h, (a / 4294967296) | 0); h = mix(h, (b / 4294967296) | 0); h = mix(h, (c / 4294967296) | 0);
  }
  return fin(h);
}

/** 0-1 from a hash. */
export const u01 = (h) => h / 4294967296;

/** A seeded stream of 0-1 floats (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = imul(s ^ (s >>> 15), 1 | s);
    t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal deviate from a stream. */
export const gauss = (R) => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(6.283185307 * R());

/** Poisson count with mean m (normal approximation above 30). */
export function poisson(R, m) {
  if (m <= 0) return 0;
  if (m > 30) return Math.max(0, Math.round(m + Math.sqrt(m) * gauss(R)));
  let L = Math.exp(-m), k = 0, p = 1;
  do { k++; p *= R(); } while (p > L);
  return k - 1;
}

// Value noise on an integer lattice; coordinates may be huge (float64): the
// lattice index wraps at 2^32, the fraction stays exact.
function corner(seed, x, y, z) {
  let h = seed ^ imul(x | 0, 0x27d4eb2d) ^ imul(y | 0, 0x165667b1) ^ imul(z | 0, 0x5bd1e995);
  h = imul(h ^ (h >>> 15), 0x2c1b3c6d); h = imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 2147483648 - 1;
}

/** Smooth value noise, -1..1. */
export function noise3(seed, x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = corner(seed, xi, yi, zi), b = corner(seed, xi + 1, yi, zi);
  const c = corner(seed, xi, yi + 1, zi), d = corner(seed, xi + 1, yi + 1, zi);
  const e = corner(seed, xi, yi, zi + 1), f = corner(seed, xi + 1, yi, zi + 1);
  const g = corner(seed, xi, yi + 1, zi + 1), h = corner(seed, xi + 1, yi + 1, zi + 1);
  const ab = a + (b - a) * fx, cd = c + (d - c) * fx, ef = e + (f - e) * fx, gh = g + (h - g) * fx;
  const p = ab + (cd - ab) * fy, q = ef + (gh - ef) * fy;
  return p + (q - p) * fz;
}

/** Fractal noise: n octaves, each twice the frequency and `gain` the amplitude. */
export function fbm(seed, x, y, z, n, gain = 0.5) {
  let s = 0, a = 1, f = 1;
  for (let i = 0; i < n; i++) {
    s += a * noise3(seed + i * 1013, x * f + i * 17.1, y * f - i * 9.3, z * f + i * 3.7);
    a *= gain; f *= 2;
  }
  return s;
}

// Names: syllables strung from a seed. Made up here, so nothing out there is borrowed.
const ON = ['b', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z', 'th', 'sk', 'tr', 'br', 'qu', ''];
const NU = ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ou', 'y', 'io'];
const CO = ['', '', 'n', 'r', 's', 'l', 'x', 'th', 'm', 'rk'];

/** A pronounceable made-up name, 2-3 syllables. */
export function name(seed) {
  const R = rng(seed ^ 0x51ed);
  const n = 2 + (R() < 0.35 ? 1 : 0);
  let s = '';
  for (let i = 0; i < n; i++) s += ON[(R() * ON.length) | 0] + NU[(R() * NU.length) | 0] + (i === n - 1 ? CO[(R() * CO.length) | 0] : '');
  return s[0].toUpperCase() + s.slice(1);
}

/** A catalogue code like "KX-4471". */
export function code(seed) {
  const R = rng(seed ^ 0x9e37);
  const L = 'ABCDEFGHJKLMNPRSTVWXYZ';
  return L[(R() * L.length) | 0] + L[(R() * L.length) | 0] + '-' + String(1000 + ((R() * 9000) | 0));
}
