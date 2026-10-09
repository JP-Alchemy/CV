// LinkedIn profile pictures (1200 × 1200) in the site's style, from photos in
// brand/source. Each is cut out from its background and dithered in 1-bit like
// the About portrait, which keeps the face crisp; towards the edges the picture
// is still assembling, in coarser halftone blocks, and the click light crosses.
// Every block is a multiple of 3px, so LinkedIn's 400px copy is the site at 1:1.
//   node scripts/profile.mjs [name…]  →  brand/linkedin-profile[-name]-light.png, -dark.png
import fs from 'node:fs';
import path from 'node:path';
import { Raster, THEMES, SPECTRUM, decodePNG } from './png.mjs';
import { site } from '../src/content.js';

const S = 1200, U = 6, N = S / U; // canvas, finest block, fine cells across
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fract = (v) => v - Math.floor(v);
function hash(px, py) {
  let x = fract(px * 0.1031), y = fract(py * 0.1031), z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}

// The About portrait's settings (src/content.js): levels, gamma, ink limits.
const P = site.portrait;

// frame: the square taken from the photo, in photo pixels. sharp: where the
// picture is resolved, in output pixels. pulse: the click light per theme.
// Colour reads quieter on paper than on black, so the light version gets a
// wider, brighter ring, and its light also lays blocks on the empty background.
const PHOTOS = {
  // The About portrait (a lossless copy of public/images/jp-portrait.jpg),
  // framed around the face: eyes a little above the middle, zoomed out enough
  // that LinkedIn's circle still shows the shoulders. Warm pixels stay (skin,
  // hair, clothes) and the neutral grey wall goes, as on the About page. The
  // light comes from off the lower right, across one shoulder.
  portrait: {
    file: 'linkedin-profile',
    src: 'brand/source/jp-portrait.png',
    frame: { x: -58, y: -20, side: 640 },
    cutout: { warm: P.cutout.warm },
    tone: P,
    sharp: { x: 600, y: 560, ax: 300, ay: 420 },
    pulse: {
      light: { x: 1240, y: 880, R: 660, width: 380, strength: 1.8 },
      dark: { x: 1240, y: 820, R: 560, width: 260, strength: 1.25 },
    },
  },
  // In profile, in autumn. The leaves are as warm as the coat, so the cut-out
  // is a mask from macOS's subject lifting (scripts/mask.swift), plus the top
  // knot it lost against the pale wall. The photo is darker and softer than
  // the portrait: wider levels, the darkest ink capped so the dark hair keeps
  // its texture, and a light sharpen for the eye and mouth. The light comes up
  // from below the chin, across the front of the coat.
  side: {
    file: 'linkedin-profile-side',
    src: 'brand/source/jp-side.png',
    frame: { x: 0, y: 0, side: 400 },
    mask: 'brand/source/jp-side-mask.png',
    add: [{ x: 80, y: 121, rx: 21, ry: 25 }, { x: 101, y: 123, rx: 7, ry: 11 }],
    tone: { ...P, levels: [0, 0.9], gamma: 1, maxInk: 0.8, sharpen: { radius: 4, amount: 0.9 } },
    sharp: { x: 520, y: 520, ax: 340, ay: 360 },
    pulse: {
      light: { x: 1320, y: 1180, R: 820, width: 420, strength: 1.8 },
      dark: { x: 1320, y: 1160, R: 760, width: 320, strength: 1.25 },
    },
  },
};

function bilinear(img, fx, fy, outside) {
  // Bilinear; outside the photo is `outside`, which the cut-out drops.
  const x = clamp(fx, 0, img.w - 1.001), y = clamp(fy, 0, img.h - 1.001);
  if (fx < 0 || fy < 0 || fx > img.w - 1 || fy > img.h - 1) return outside;
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const p = (xx, yy, k) => img.px[(yy * img.w + xx) * 4 + k];
  return [0, 1, 2].map((k) => (p(x0, y0, k) * (1 - tx) + p(x0 + 1, y0, k) * tx) * (1 - ty) + (p(x0, y0 + 1, k) * (1 - tx) + p(x0 + 1, y0 + 1, k) * tx) * ty);
}

/** Ink per fine cell (0 = paper) and the figure's mask, for one photo. */
function inkGrid(ph, dark) {
  const photo = decodePNG(fs.readFileSync(ph.src));
  const matte = ph.mask && decodePNG(fs.readFileSync(ph.mask));
  const ss = 4, k = ph.frame.side / N;
  const rgb = new Float32Array(N * N * 3), cover = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let r = 0, g = 0, b = 0, c = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const fx = ph.frame.x + (i + (sx + 0.5) / ss) * k, fy = ph.frame.y + (j + (sy + 0.5) / ss) * k;
      const s = bilinear(photo, fx, fy, [156, 156, 156]);
      r += s[0]; g += s[1]; b += s[2];
      if (!matte) continue;
      const inAdd = ph.add?.some((e) => ((fx - e.x) / e.rx) ** 2 + ((fy - e.y) / e.ry) ** 2 <= 1);
      c += inAdd ? 1 : bilinear(matte, fx, fy, [0])[0] / 255;
    }
    rgb.set([r / ss / ss, g / ss / ss, b / ss / ss], (j * N + i) * 3);
    cover[j * N + i] = c / ss / ss;
  }
  // Cut-out by mask or by warmth; a 3×3 majority vote cleans the edge.
  const raw = new Uint8Array(N * N), mask = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    raw[i] = matte ? (cover[i] > 0.5 ? 1 : 0) : (rgb[i * 3] - rgb[i * 3 + 2]) / 255 > ph.cutout.warm ? 1 : 0;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let votes = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const yy = y + j, xx = x + i;
      if (yy < 0 || xx < 0 || yy >= N || xx >= N) continue;
      votes += raw[yy * N + xx]; n++;
    }
    mask[y * N + x] = votes * 2 > n ? 1 : 0;
  }
  const T = ph.tone, [lo, hi] = T.levels;
  const lum = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) lum[i] = (0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]) / 255;
  if (T.sharpen) sharpen(lum, mask, T.sharpen);
  const v = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (!mask[i]) continue;
    const l = clamp((lum[i] - lo) / (hi - lo));
    let ink = Math.max(dark ? l : 1 - l, T.minInk);
    ink = Math.min(ink, dark ? T.darkMaxInk : T.maxInk ?? 1);
    v[i] = Math.pow(clamp((ink - 0.1) / 0.85), T.gamma);
  }
  return { v, mask };
}

/** Unsharp mask over the figure only, so soft light still shows the features. */
function sharpen(lum, mask, { radius: R, amount }) {
  const blur = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!mask[y * N + x]) continue;
    let s = 0, n = 0;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const yy = y + j, xx = x + i;
      if (yy < 0 || xx < 0 || yy >= N || xx >= N || !mask[yy * N + xx]) continue;
      s += lum[yy * N + xx]; n++;
    }
    blur[y * N + x] = s / n;
  }
  for (let i = 0; i < N * N; i++) if (mask[i]) lum[i] += amount * (lum[i] - blur[i]);
}

function profile(ph, theme, { circle = false } = {}) {
  const T = THEMES[theme];
  const r = new Raster(S, S, T.bg);
  const tone = (t) => T.bg.map((c, k) => Math.round(c + (T.fg[k] - c) * t));
  const { v, mask } = inkGrid(ph, theme === 'dark');

  // Outside the sharp ellipse, blocks double in size in steps, with a little
  // noise per tile.
  const levelAt = (x, y) => {
    const e = Math.hypot((x - ph.sharp.x) / ph.sharp.ax, (y - ph.sharp.y) / ph.sharp.ay) + (hash(x * 0.37, y * 0.37) - 0.5) * 0.16;
    return e < 1 ? 0 : e < 1.14 ? 1 : e < 1.3 ? 2 : 3;
  };

  // The click light lights the background and the unresolved blocks of the
  // figure; the face stays black and white.
  const light_ = theme === 'light';
  const PULSE = ph.pulse[theme];
  const light = (cx, cy) => {
    const d = Math.hypot(cx - PULSE.x, cy - PULSE.y);
    const u = (PULSE.R - d) / PULSE.width;
    if (u <= 0 || u >= 1) return null;
    const I = Math.sin(Math.PI * u) * PULSE.strength * Math.exp(-d / 900);
    if (hash(cx, cy) >= I) return null;
    return { rgb: SPECTRUM[clamp(Math.floor(u * 7 + (hash(cx + 17.31, cy + 17.31) - 0.5) * 0.9), 0, 6)], I };
  };
  const block = (x, y, s, lit) => {
    const L = lit && light(x + s / 2, y + s / 2);
    r.rect(x, y, s, s, L ? L.rgb : tone(1));
  };

  // Dot grid (the site's, three times larger), kept off the figure.
  for (let y = 24; y < S; y += 48) for (let x = 24; x < S; x += 48) {
    if (mask[Math.floor(y / U) * N + Math.floor(x / U)]) continue;
    const L = light(x + 3, y + 3);
    if (!L) { r.rect(x, y, 6, 6, tone(T.dots)); continue; }
    const s = L.I > 0.8 ? 12 : 6;
    r.rect(x + 3 - s / 2, y + 3 - s / 2, s, s, L.rgb);
  }

  // The figure, as a quadtree of 48px tiles: split while the spot wants finer
  // blocks. Fine cells dither like the About page; coarse ones are halftone
  // squares sized by their average ink.
  const avg = (x, y, c) => {
    let a = 0;
    for (let j = y / U; j < (y + c) / U; j++) for (let i = x / U; i < (x + c) / U; i++) a += v[j * N + i];
    return a / ((c / U) ** 2);
  };
  const tile = (x, y, lvl) => {
    const c = U << lvl;
    if (lvl > levelAt(x + c / 2, y + c / 2)) {
      const h = c / 2;
      for (const [dx, dy] of [[0, 0], [h, 0], [0, h], [h, h]]) tile(x + dx, y + dy, lvl - 1);
      return;
    }
    if (lvl === 0) {
      const i = x / U, j = y / U;
      if (v[j * N + i] > BAYER4[(j % 4) * 4 + (i % 4)]) block(x, y, U, false);
      return;
    }
    // Capped below the cell, so even solid areas stay separate blocks. A lit
    // block swells to the light's brightness: on paper the pale hoodie makes
    // small blocks, and colour needs room to show.
    const a = avg(x, y, c);
    const L = (a > 0 || (light_ && lvl >= 2 && hash(x * 1.7 + 3.1, y * 1.3 + 7.7) < 0.6)) && light(x + c / 2, y + c / 2);
    const want = Math.max(c * Math.sqrt(a), L ? c * Math.sqrt(Math.min(L.I, 1)) : 0);
    const s = Math.round(Math.min(want, c * 0.86) / 3) * 3;
    if (s < 6) return;
    const o = Math.floor((c - s) / 6) * 3;
    r.rect(x + o, y + o, s, s, L ? L.rgb : tone(1));
  };
  for (let y = 0; y < S; y += 48) for (let x = 0; x < S; x += 48) tile(x, y, 3);

  // Preview only: LinkedIn's circle on a white page.
  if (circle) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) > S / 2) r.rect(x, y, 1, 1, [255, 255, 255]);
    }
  }
  return r.png();
}

// Names pick photos (all by default). --out <dir> writes somewhere other than
// brand/; --preview <dir> also writes circle-cropped copies, as LinkedIn shows them.
const argv = process.argv.slice(2);
const opt = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv.splice(i, 2)[1] : null; };
const out = path.resolve(opt('--out') || 'brand');
const pv = opt('--preview');
const names = argv.length ? argv : Object.keys(PHOTOS);
fs.mkdirSync(out, { recursive: true });
for (const name of names) {
  const ph = PHOTOS[name];
  if (!ph) throw new Error(`no photo called "${name}" (try: ${Object.keys(PHOTOS).join(', ')})`);
  for (const theme of Object.keys(THEMES)) {
    const file = path.join(out, `${ph.file}-${theme}.png`);
    fs.writeFileSync(file, profile(ph, theme));
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
    if (pv) {
      fs.mkdirSync(pv, { recursive: true });
      fs.writeFileSync(path.join(pv, `${ph.file}-${theme}-circle.png`), profile(ph, theme, { circle: true }));
    }
  }
}
