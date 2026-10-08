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

const sampleCache = new Map();

/** Darkness grid (cols x rows), supersampled. */
export function sample(spec, cols, rows, ar, dark = false) {
  const id = `${spec.kind || spec.src}|${spec.seed || 0}|${cols}|${rows}|${ar.toFixed(3)}|${dark ? 1 : 0}`;
  const hit = sampleCache.get(id);
  if (hit) return hit;
  const out = new Float32Array(cols * rows);
  if (spec.src) {
    const entry = loadPhoto(spec.src, spec.onload);
    if (!entry.ready) return null;
    const c = document.createElement('canvas');
    c.width = cols; c.height = rows;
    const g = c.getContext('2d', { willReadFrequently: true });
    // cover-fit
    const iw = entry.img.naturalWidth, ih = entry.img.naturalHeight;
    const s = Math.max(cols / iw, rows / ih);
    const dw = iw * s, dh = ih * s;
    g.imageSmoothingQuality = 'high';
    g.drawImage(entry.img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    const d = g.getImageData(0, 0, cols, rows).data;
    for (let i = 0; i < cols * rows; i++) {
      const l = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      out[i] = dark ? l : 1 - l; // ink is light in dark mode
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
        const s = Math.round((cell * Math.sqrt(v)) / 2) * 2;
        if (s < 2) continue;
        const o = (cell - s) / 2;
        out.push(ox + i * cell + o, oy + j * cell + o, s, s, 1);
      }
    }
  }
  return Float32Array.from(out);
}
