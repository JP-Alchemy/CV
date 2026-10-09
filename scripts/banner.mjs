// LinkedIn banner (1584 × 396) drawn with the site's own parts: the pixel
// font, the halftone moon, the shape-shifting logo and the click light.
//   node scripts/banner.mjs  →  brand/linkedin-banner-light.png, -dark.png
import fs from 'node:fs';
import path from 'node:path';
import { typeset, measure } from '../src/engine/typeset.js';
import { GENERATORS } from '../src/engine/images.js';
import { ICONS } from '../src/icons.js';
import { frameBlocks } from '../src/ui.js';
import { site } from '../src/content.js';
import { Raster, hex } from './png.mjs';

const W = 1584, H = 396, M = 48;
const THEMES = {
  light: { bg: hex('#f0f0eb'), fg: hex('#0e0e0e'), dots: 0.09 },
  dark: { bg: hex('#0c0c0c'), fg: hex('#ebebe4'), dots: 0.12 },
};
const SPECTRUM = ['#ff453a', '#ff9429', '#ffdb33', '#4cdb6b', '#33ccf2', '#406bff', '#9e52ff'].map(hex);

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fract = (v) => v - Math.floor(v);
const mix = (a, b, t) => a.map((c, k) => Math.round(c + (b[k] - c) * t));
// The shader's per-pixel hash, so the light dithers the same way.
function hash(px, py) {
  let x = fract(px * 0.1031), y = fract(py * 0.1031), z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}

// Layout. LinkedIn puts the profile photo over the lower left (about
// x < 470, y > 180 across desktop and the app), so that corner stays quiet.
const TX = 520; // text column
const D = H - M * 2, MX = W - M - D, MY = M; // moon square, on the same margins as the text
const CX = MX + D / 2, CY = MY + D / 2, CR = D * 0.455; // moon disc
// The cursor clicks the moon's emptier side, so the ring of light sweeps
// through the side with the most ink: the shadow in light, the lit face in dark.
const TIPS = {
  light: { x: Math.round(CX - CR * 0.5), y: Math.round(CY - CR * 0.42) },
  dark: { x: Math.round(CX + CR * 0.34), y: Math.round(CY + CR * 0.3) },
};

function banner(theme, { photo = null } = {}) {
  const T = THEMES[theme];
  const dark = theme === 'dark';
  const TIP = TIPS[theme];
  const PULSE = { x: TIP.x, y: TIP.y, R: 214, width: 128, strength: 1.5 };
  const r = new Raster(W, H, T.bg);
  const tone = (t) => mix(T.bg, T.fg, t);

  // Click light: a ring of lit pixels, red at the leading edge to violet at
  // the trailing edge. On the site the brightness is quantised; here a pixel
  // is either fully lit or not (dithered by intensity), so colours stay clean.
  // It stays inside the moon's frame, clear of the text.
  const light = (cx, cy) => {
    if (cx < MX || cx > MX + D || cy < MY || cy > MY + D) return null;
    const d = Math.hypot(cx - PULSE.x, cy - PULSE.y);
    const u = (PULSE.R - d) / PULSE.width;
    if (u <= 0 || u >= 1) return null;
    const I = Math.sin(Math.PI * u) * PULSE.strength * Math.exp(-d / 700);
    if (hash(cx, cy) >= I) return null;
    const band = clamp(Math.floor(u * 7 + (hash(cx + 17.31, cy + 17.31) - 0.5) * 0.9), 0, 6);
    return { rgb: SPECTRUM[band], I };
  };
  // Cursor push: blocks near the pointer are nudged away from it, as on the site.
  const P = { x: TIP.x + 14, y: TIP.y + 22 };
  const push = (x, y) => {
    const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy) || 1;
    const k = 9 * Math.exp(-((d / 34) ** 2));
    return [Math.round((dx / d) * k), Math.round((dy / d) * k)];
  };
  let count = 0;
  const block = (x, y, w, h, t, lit = true, pushed = false) => {
    if (pushed) { const [px, py] = push(x + w / 2, y + h / 2); x += px; y += py; }
    const L = lit && light(x + w / 2, y + h / 2);
    r.rect(x, y, w, h, L ? L.rgb : tone(t));
    count++;
  };
  const blocks = (b, ox, oy, lit = true) => {
    for (let i = 0; i < b.length; i += 5) block(ox + b[i], oy + b[i + 1], b[i + 2], b[i + 3], b[i + 4], lit);
  };

  // Dot grid. Dots the light passes through swell a little so the ring
  // still reads when LinkedIn shows the banner at half size.
  for (let y = 8; y < H; y += 16) {
    for (let x = 8; x < W; x += 16) {
      const [px, py] = push(x + 1, y + 1);
      const L = light(x + 1 + px, y + 1 + py);
      count++;
      if (!L) { r.rect(x + px, y + py, 2, 2, tone(T.dots)); continue; }
      const s = L.I > 0.8 ? 4 : 2;
      r.rect(x + px + 1 - s / 2, y + py + 1 - s / 2, s, s, L.rgb);
    }
  }

  const text = (str, size, x, y, o = {}) => {
    const t = typeset(str, { size, lh: o.lh ?? 10, tone: o.tone ?? 1, width: o.width ?? Infinity });
    blocks(t.blocks, x, y, o.lit ?? true);
    return t;
  };

  // Logo: the five states the nav mark cycles through, side by side.
  const cell = 6, pad = 10;
  const bw = 7 * cell + pad * 2, bh = 5 * cell + pad * 2;
  ICONS.logo.forEach((rows, k) => {
    const x0 = M + k * (bw + 10), y0 = M;
    blocks(frameBlocks(bw, bh, 2), x0, y0);
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') block(x0 + pad + i * cell, y0 + pad + j * cell, cell, cell, 1);
    });
  });

  // Text column.
  const eyebrow = `■ ${site.role.toUpperCase()} · LEIDEN, NL`;
  text(eyebrow, 3, TX, M + (bh - 21) / 2);
  const colW = MX - 56 - TX;
  let size = 7;
  const lines = ['THOUGHTFUL SOFTWARE', 'FOR WORK THAT MATTERS.'];
  while (size > 3 && Math.max(...lines.map((l) => measure(l, size))) > colW) size--;
  let y = 126;
  for (const l of lines) { text(l, size, TX, y); y += size * 10; }
  y += 20;
  text('3D · DATA · AI AGENTS · SUSTAINABILITY', 3, TX, y, { tone: 0.55 });
  y += 21 + 30;
  // A button like the site's: clipped-corner border, label and arrow.
  const label = 'JPBOTHMA.COM ↗';
  const lw = measure(label, 3);
  blocks(frameBlocks(lw + 36, 50, 2), TX, y);
  text(label, 3, TX + 18, y + 14);

  // The home page's cratered moon, just the disc, filling its frame.
  const cellM = 6, ss = 3, n = Math.floor(D / cellM);
  const field = (u, v) => GENERATORS.moon(0.5 + (u - 0.5) * 0.44, 0.32 + (v - 0.5) * 0.44, 1, 0, dark);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) acc += field((i + (sx + 0.5) / ss) / n, (j + (sy + 0.5) / ss) / n);
      // Capped, so the shadow side stays a texture rather than a solid slab.
      const v = Math.min(clamp((acc / (ss * ss) - 0.1) / 0.85), 0.72);
      const s = Math.round(cellM * Math.sqrt(v));
      if (s < 2) continue;
      const o = Math.floor((cellM - s) / 2);
      block(MX + i * cellM + o, MY + j * cellM + o, s, s, 1, true, true);
    }
  }
  // A faint dotted limb, so the lit side still has an edge.
  for (let a = 0; a < 360; a += 2.4) {
    const t = (a * Math.PI) / 180;
    block(Math.round((CX + Math.cos(t) * (CR + 8)) / 2) * 2 - 1, Math.round((CY + Math.sin(t) * (CR + 8)) / 2) * 2 - 1, 2, 2, 0.35);
  }
  for (const [cx, cy, dx, dy] of [[MX, MY, 1, 1], [MX + D - 2, MY, -1, 1], [MX, MY + D - 2, 1, -1], [MX + D - 2, MY + D - 2, -1, -1]]) {
    block(Math.min(cx, cx + dx * 14), cy, 16, 2, 1, false);
    block(cx, Math.min(cy, cy + dy * 14), 2, 16, 1, false);
  }

  // The pointer that set off the light: ink outline, paper fill.
  const ARROW = [
    '#..........', '##.........', '#=#........', '#==#.......', '#===#......', '#====#.....',
    '#=====#....', '#======#...', '#=======#..', '#========#.', '#=====#####', '#==#==#....',
    '#=#.#==#...', '##..#==#...', '#....#==#..', '.....#==#..', '......##...',
  ];
  const pc = 3;
  ARROW.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '#') r.rect(TIP.x + i * pc, TIP.y + j * pc, pc, pc, tone(1));
      else if (row[i] === '=') r.rect(TIP.x + i * pc, TIP.y + j * pc, pc, pc, T.bg);
    }
  });
  // The site's footer line, counted honestly (its own blocks included).
  let foot = '', total = count;
  for (let k = 0; k < 3; k++) {
    foot = `THIS BANNER IS MADE OF ${total.toLocaleString('en-GB')} BLOCKS`;
    total = count + typeset(foot, { size: 2, lh: 11 }).blocks.length / 5;
  }
  text(foot, 2, MX + D - measure(foot, 2), MY + D + 12, { tone: 0.55, lit: false });

  // Preview only: where LinkedIn's profile photo lands.
  if (photo) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - photo.x, y - photo.y);
      if (d < photo.r) r.rect(x, y, 1, 1, d > photo.r - 8 ? [255, 255, 255] : [150, 150, 150]);
    }
  }
  return r.png();
}

// --preview <dir> also writes copies with the profile photo drawn where
// LinkedIn puts it on desktop and in the app.
const out = path.resolve('brand');
fs.mkdirSync(out, { recursive: true });
const pv = process.argv.indexOf('--preview');
for (const theme of Object.keys(THEMES)) {
  const file = path.join(out, `linkedin-banner-${theme}.png`);
  fs.writeFileSync(file, banner(theme));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
  if (pv > 0) {
    const dir = process.argv[pv + 1];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${theme}-desktop.png`), banner(theme, { photo: { x: 197, y: 330, r: 152 } }));
    fs.writeFileSync(path.join(dir, `${theme}-app.png`), banner(theme, { photo: { x: 250, y: 396, r: 205 } }));
  }
}
