// Link previews (1200 × 630), one per page, drawn with the site's own parts:
// the page's words in the pixel font, its picture in blocks, the mark, and
// the click light crossing one corner. What each card says comes from
// pageMeta(route).card in src/seo.js; prerender.mjs writes them out.
import fs from 'node:fs';
import { typeset, measure } from '../src/engine/typeset.js';
import { imageBlocks, setPhoto } from '../src/engine/images.js';
import { ICONS, iconFrames } from '../src/icons.js';
import { Raster, THEMES, SPECTRUM, decodePNG } from './png.mjs';

const W = 1200, H = 630, M = 72;
const P = 400, PX = W - M - P, PY = (H - P) / 2; // the picture square
const TW = PX - 56 - M; // text column
const T = THEMES.light;

// Photos the site loads as <img>, as PNG copies Node can decode.
const PHOTOS = {
  '/images/jp-portrait.jpg': 'brand/source/jp-portrait.png',
  '/images/swarmfort-cover.jpg': 'brand/source/swarmfort-cover.png',
};
for (const [src, file] of Object.entries(PHOTOS)) setPhoto(src, decodePNG(fs.readFileSync(file)));

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fract = (v) => v - Math.floor(v);
// The shader's per-pixel hash, so the light dithers the way it does on the site.
function hash(px, py) {
  let x = fract(px * 0.1031), y = fract(py * 0.1031), z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}

// A click just off the bottom right corner: the ring has reached the corner
// of the picture, red at its leading edge, violet behind.
const PULSE = { x: 1250, y: 700, R: 390, width: 260, strength: 1.6 };
function light(cx, cy) {
  const d = Math.hypot(cx - PULSE.x, cy - PULSE.y);
  const u = (PULSE.R - d) / PULSE.width;
  if (u <= 0 || u >= 1) return null;
  const I = Math.sin(Math.PI * u) * PULSE.strength * Math.exp(-d / 900);
  if (hash(cx, cy) >= I) return null;
  return { rgb: SPECTRUM[clamp(Math.floor(u * 7 + (hash(cx + 17.31, cy + 17.31) - 0.5) * 0.9), 0, 6)], I };
}

/** The picture's blocks, inside a P × P square. */
function picture(pic) {
  const fit = (spec, w, h, o = {}) => imageBlocks(spec, w, h, {
    style: o.style || 'halftone', cell: o.style === 'dither' ? 4 : 8, gamma: o.gamma ?? 1,
  });
  const shift = (b, dx, dy) => { for (let i = 0; i < b.length; i += 5) { b[i] += dx; b[i + 1] += dy; } return b; };
  const inner = P - 16;
  if (pic.image) return shift(fit(pic.image, inner, inner, pic), 8, 8);
  if (pic.blocks) return shift(Float32Array.from(pic.blocks), Math.round((P - pic.w) / 2), Math.round((P - pic.h) / 2));
  if (pic.mosaic) {
    // Four pictures, two by two.
    const g = 16, s = (inner - g) / 2;
    return pic.mosaic.flatMap((spec, k) => [...shift(fit(spec, s, s, { style: spec.style }), 8 + (k % 2) * (s + g), 8 + Math.floor(k / 2) * (s + g))]);
  }
  if (pic.icons) {
    // Icons in a grid of three, as on the services page.
    const cell = 14, cols = 3, rows = Math.ceil(pic.icons.length / cols);
    const cw = P / cols, rh = P / rows;
    return pic.icons.flatMap((name, k) => {
      const f = iconFrames(name, cell);
      return [...shift(f.frames[0].slice(), Math.round((k % cols) * cw + (cw - f.w) / 2), Math.round(Math.floor(k / cols) * rh + (rh - f.h) / 2))];
    });
  }
  // One frame of the mark, large.
  const rows = ICONS.logo[pic.mark], cell = 44;
  const ox = (P - rows[0].length * cell) / 2, oy = (P - rows.length * cell) / 2;
  return rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '#' ? [ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, 1] : [])));
}

/** Cut a paragraph to whole words within `lines` lines. */
function clip(str, size, width, lines, lh) {
  const words = str.split(' ');
  let out = str;
  while (typeset(out, { size, width, lh }).lines > lines && words.length > 1) {
    words.pop();
    out = `${words.join(' ').replace(/[,.;:—–-]+$/, '')}…`;
  }
  return out;
}

/** One card: c = pageMeta(route).card, path = the page's address. */
export function card(c, path) {
  const r = new Raster(W, H, T.bg);
  const ink = (t) => T.bg.map((v, k) => Math.round(v + (T.fg[k] - v) * t));
  const blocks = (b, ox, oy, lit) => {
    for (let i = 0; i < b.length; i += 5) {
      const x = ox + b[i], y = oy + b[i + 1], w = b[i + 2], h = b[i + 3];
      const L = lit && light(x + w / 2, y + h / 2), t = b[i + 4];
      r.rect(x, y, w, h, L ? L.rgb : t >= 1.5 ? SPECTRUM[Math.round(t) - 2] : ink(t));
    }
  };
  const words = (t, x, y) => blocks(t.blocks, x, y, false);

  // The dot grid; dots in the light swell and take its colour.
  for (let y = 8; y < H; y += 16) {
    for (let x = 8; x < W; x += 16) {
      const L = light(x + 1, y + 1);
      if (!L) { r.rect(x, y, 2, 2, ink(T.dots)); continue; }
      const s = L.I > 0.9 ? 8 : L.I > 0.6 ? 6 : 4;
      r.rect(x + 1 - s / 2, y + 1 - s / 2, s, s, L.rgb);
    }
  }

  // The picture, in its corner marks.
  blocks(picture(c.picture), PX, PY, true);
  for (const [cx, cy, dx, dy] of [[PX, PY, 1, 1], [PX + P - 2, PY, -1, 1], [PX, PY + P - 2, 1, -1], [PX + P - 2, PY + P - 2, -1, -1]]) {
    r.rect(Math.min(cx, cx + dx * 14), cy, 16, 2, ink(1));
    r.rect(cx, Math.min(cy, cy + dy * 14), 2, 16, ink(1));
  }

  // Words: the eyebrow, then the largest title (up to three lines, no word
  // broken) that leaves the text up to three lines below it.
  let y = 96;
  words(typeset(clip(`■ ${c.eyebrow}`, 3, TW, 1, 10), { size: 3, lh: 10, width: TW }), M, y);
  y += 21 + 40;
  const ts = c.textSize || 3, bottom = H - M - 21 - 40;
  const need = Math.min(3, typeset(c.text, { size: ts, lh: 11, width: TW }).lines);
  let title, size, gap, room;
  for (size = c.size || 10; size >= 4; size--) {
    title = typeset(c.title, { size, lh: 10, width: c.size ? Infinity : TW });
    gap = Math.max(30, size * 5);
    room = Math.floor((bottom - y - title.height - gap) / (11 * ts));
    if (c.size || (title.lines <= 3 && room >= need && c.title.split(' ').every((w) => measure(w, size) <= TW))) break;
  }
  words(title, M, y);
  y += title.height + gap;
  const text = typeset(clip(c.text, ts, TW, Math.min(room, 4), 11), { size: ts, lh: 11, width: TW });
  words(text, M, y);
  if (c.note) words(typeset(c.note, { size: 3, lh: 10, width: TW, tone: 0.55 }), M, y + text.height + 30);

  const mark = iconFrames('logo', 4).frames[0];
  blocks(mark, M, H - M - 20, false);
  words(typeset(`JPBOTHMA.COM${path === '/' ? '' : path.replace(/\/$/, '')}`.toUpperCase(), { size: 3 }), M + 28 + 18, H - M - 21);
  return r.png();
}
