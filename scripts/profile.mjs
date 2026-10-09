// LinkedIn profile picture (1200 × 1200) in the site's style. The About
// portrait's treatment (cut out by warmth, levels, 1-bit ordered dither)
// keeps the face crisp; towards the edges the picture is still assembling,
// in coarser halftone blocks, and the click light crosses one shoulder.
// Every block is a multiple of 3px, so LinkedIn's 400px copy is the site at 1:1.
//   node scripts/profile.mjs  →  brand/linkedin-profile-light.png, -dark.png
import fs from 'node:fs';
import path from 'node:path';
import { Raster, hex, decodePNG } from './png.mjs';
import { site } from '../src/content.js';

const S = 1200, U = 6, N = S / U; // canvas, finest block, fine cells across
const THEMES = {
  light: { bg: hex('#f0f0eb'), fg: hex('#0e0e0e'), dots: 0.09 },
  dark: { bg: hex('#0c0c0c'), fg: hex('#ebebe4'), dots: 0.12 },
};
const SPECTRUM = ['#ff453a', '#ff9429', '#ffdb33', '#4cdb6b', '#33ccf2', '#406bff', '#9e52ff'].map(hex);
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fract = (v) => v - Math.floor(v);
function hash(px, py) {
  let x = fract(px * 0.1031), y = fract(py * 0.1031), z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}

// The About portrait (a lossless copy of public/images/jp-portrait.jpg),
// framed as a square around the face: eyes a little above the middle, zoomed
// out enough that LinkedIn's circle still shows the shoulders.
const photo = decodePNG(fs.readFileSync('brand/source/jp-portrait.png'));
const FRAME = { x: -58, y: -20, side: 640 }; // in photo pixels
function rgbAt(fx, fy) {
  // Bilinear; outside the photo is the grey wall, which the cut-out drops.
  const x = clamp(fx, 0, photo.w - 1.001), y = clamp(fy, 0, photo.h - 1.001);
  if (fx < 0 || fy < 0 || fx > photo.w - 1 || fy > photo.h - 1) return [156, 156, 156];
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const p = (xx, yy, k) => photo.px[(yy * photo.w + xx) * 4 + k];
  return [0, 1, 2].map((k) => (p(x0, y0, k) * (1 - tx) + p(x0 + 1, y0, k) * tx) * (1 - ty) + (p(x0, y0 + 1, k) * (1 - tx) + p(x0 + 1, y0 + 1, k) * tx) * ty);
}

// The About portrait's settings (src/content.js).
const P = site.portrait;
function inkGrid(dark) {
  const ss = 4, k = FRAME.side / N;
  const rgb = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const c = rgbAt(FRAME.x + (i + (sx + 0.5) / ss) * k, FRAME.y + (j + (sy + 0.5) / ss) * k);
      r += c[0]; g += c[1]; b += c[2];
    }
    rgb.set([r / ss / ss, g / ss / ss, b / ss / ss], (j * N + i) * 3);
  }
  // Cut-out: warm pixels stay (skin, hair, clothes), the neutral wall goes;
  // a 3×3 majority vote cleans the edge.
  const raw = new Uint8Array(N * N), mask = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) raw[i] = (rgb[i * 3] - rgb[i * 3 + 2]) / 255 > P.cutout.warm ? 1 : 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let votes = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const yy = y + j, xx = x + i;
      if (yy < 0 || xx < 0 || yy >= N || xx >= N) continue;
      votes += raw[yy * N + xx]; n++;
    }
    mask[y * N + x] = votes * 2 > n ? 1 : 0;
  }
  const [lo, hi] = P.levels;
  const v = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (!mask[i]) continue;
    const l = clamp(((0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]) / 255 - lo) / (hi - lo));
    let ink = Math.max(dark ? l : 1 - l, P.minInk);
    if (dark) ink = Math.min(ink, P.darkMaxInk);
    v[i] = Math.pow(clamp((ink - 0.1) / 0.85), P.gamma);
  }
  return { v, mask };
}

// Where the picture is resolved: an ellipse over the face, hair and jaw.
// Outside it, blocks double in size in steps, with a little noise per tile.
const SHARP = { x: 600, y: 560, ax: 300, ay: 420 };
const levelAt = (x, y) => {
  const e = Math.hypot((x - SHARP.x) / SHARP.ax, (y - SHARP.y) / SHARP.ay) + (hash(x * 0.37, y * 0.37) - 0.5) * 0.16;
  return e < 1 ? 0 : e < 1.14 ? 1 : e < 1.3 ? 2 : 3;
};

function profile(theme, { circle = false } = {}) {
  const T = THEMES[theme];
  const r = new Raster(S, S, T.bg);
  const tone = (t) => T.bg.map((c, k) => Math.round(c + (T.fg[k] - c) * t));
  const { v, mask } = inkGrid(theme === 'dark');

  // Click light from off the lower right: it lights the background and the
  // unresolved blocks of the shoulder; the face stays black and white. Colour
  // reads quieter on paper than on black, so the light version gets a wider,
  // brighter ring, and its light also lays blocks on the empty background.
  const light_ = theme === 'light';
  const PULSE = light_
    ? { x: 1240, y: 880, R: 660, width: 380, strength: 1.8 }
    : { x: 1240, y: 820, R: 560, width: 260, strength: 1.25 };
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

// --preview <dir> also writes circle-cropped copies, as LinkedIn shows them.
const out = path.resolve('brand');
fs.mkdirSync(out, { recursive: true });
const pv = process.argv.indexOf('--preview');
for (const theme of Object.keys(THEMES)) {
  const file = path.join(out, `linkedin-profile-${theme}.png`);
  fs.writeFileSync(file, profile(theme));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
  if (pv > 0) {
    fs.mkdirSync(process.argv[pv + 1], { recursive: true });
    fs.writeFileSync(path.join(process.argv[pv + 1], `profile-${theme}-circle.png`), profile(theme, { circle: true }));
  }
}
