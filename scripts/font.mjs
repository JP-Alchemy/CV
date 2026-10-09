// The site's pixel font (src/engine/font.js) as real font files, so the type
// works outside the canvas too: the plain-HTML copy, print and PDF, slides and
// documents. Every lit pixel is a 100-unit square and an em is 10 pixels (7
// above the baseline, 2 below, 1 spare), so it's crisp at 10px, 20px, 30px…
// Spacing is the typesetter's: one pixel after every letter, four between
// words. Bold is the site's bold: each glyph ORed with itself one pixel right.
//   node scripts/font.mjs [dir]  →  jp-pixel-regular.ttf/.woff, jp-pixel-bold.ttf/.woff
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { glyph, CHARS, ALIAS, SPACE } from '../src/engine/font.js';
import { FONT } from '../src/brand.js';
import { site } from '../src/content.js';

const U = 100; // font units per pixel
const EM = 10 * U;
const ASC = 8 * U, DESC = 2 * U, GAP = 2 * U; // 12-pixel lines by default, like body text on the site
const TRACK = 1; // pixels after every glyph
const VERSION = '1.000';
const DATE = Date.UTC(2026, 9, 9); // fixed, so builds are reproducible

// The site only sets capitals in bold. Shifted onto itself, a lowercase m or
// w closes its one-pixel gaps into a slab, so the bold font draws them wider.
const BOLD = {
  m: ['........', '........', '#######.', '##.##.##', '##.##.##', '##.##.##', '##.##.##'],
  w: ['........', '........', '##....##', '##....##', '##.##.##', '##.##.##', '.##..##.'],
};

// ---------------------------------------------------------------- outlines

/**
 * Pixels (x, y pairs; y = row, 0 at the top, baseline under row 6) to
 * TrueType contours: the boundary of the lit area, clockwise, holes
 * anticlockwise, with straight runs merged.
 */
function contours(px) {
  const lit = new Set();
  for (let i = 0; i < px.length; i += 2) lit.add(`${px[i]},${px[i + 1]}`);
  const on = (x, y) => lit.has(`${x},${y}`);
  // Edges on a lattice of pixel corners, y up: row y spans 6 - y .. 7 - y.
  const edges = new Map(); // start "i,j" -> [{ to, dir }]
  const add = (a, b) => {
    const k = `${a[0]},${a[1]}`;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push({ from: a, to: b, dir: [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])], used: false });
  };
  for (let i = 0; i < px.length; i += 2) {
    const x = px[i], y = px[i + 1], j0 = 6 - y, j1 = 7 - y;
    if (!on(x, y - 1)) add([x, j1], [x + 1, j1]); // top, heading east
    if (!on(x + 1, y)) add([x + 1, j1], [x + 1, j0]); // right, south
    if (!on(x, y + 1)) add([x + 1, j0], [x, j0]); // bottom, west
    if (!on(x - 1, y)) add([x, j0], [x, j1]); // left, north
  }
  const out = [];
  for (const list of edges.values()) {
    for (const first of list) {
      if (first.used) continue;
      const pts = [];
      let e = first;
      for (;;) {
        e.used = true;
        pts.push(e.from);
        if (e.to[0] === first.from[0] && e.to[1] === first.from[1]) break;
        // Where pixels touch at a corner, turn right first: it keeps them as
        // separate shapes instead of one that pinches through the corner.
        const next = (edges.get(`${e.to[0]},${e.to[1]}`) || []).filter((n) => !n.used);
        const [dx, dy] = e.dir;
        const rank = (n) => (n.dir[0] === dy && n.dir[1] === -dx ? 0 : n.dir[0] === dx && n.dir[1] === dy ? 1 : 2);
        next.sort((a, b) => rank(a) - rank(b));
        if (!next.length) throw new Error('open contour');
        e = next[0];
      }
      // Drop points in the middle of straight runs.
      const simple = pts.filter((p, k) => {
        const a = pts[(k - 1 + pts.length) % pts.length], b = pts[(k + 1) % pts.length];
        return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
      });
      out.push(simple.map(([i, j]) => [i * U, j * U]));
    }
  }
  return out;
}

/** One glyph's glyf entry (all points on the curve), padded to 4 bytes. */
function glyfEntry(cs) {
  if (!cs.length) return { data: Buffer.alloc(0), bbox: null, points: 0 };
  const all = cs.flat();
  const bbox = [
    Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])),
    Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1])),
  ];
  const b = new Bytes();
  b.i16(cs.length);
  bbox.forEach((v) => b.i16(v));
  let n = 0;
  for (const c of cs) { n += c.length; b.u16(n - 1); }
  b.u16(0); // no instructions
  const flags = [], xs = new Bytes(), ys = new Bytes();
  let px = 0, py = 0;
  for (const [x, y] of all) {
    let f = 1; // on curve
    const dx = x - px, dy = y - py;
    if (dx === 0) f |= 0x10;
    else if (Math.abs(dx) <= 255) { f |= 0x02 | (dx > 0 ? 0x10 : 0); xs.u8(Math.abs(dx)); } else xs.i16(dx);
    if (dy === 0) f |= 0x20;
    else if (Math.abs(dy) <= 255) { f |= 0x04 | (dy > 0 ? 0x20 : 0); ys.u8(Math.abs(dy)); } else ys.i16(dy);
    flags.push(f);
    px = x; py = y;
  }
  flags.forEach((f) => b.u8(f));
  b.raw(xs.buf()); b.raw(ys.buf());
  return { data: pad4(b.buf()), bbox, points: all.length };
}

// ---------------------------------------------------------------- binary

class Bytes {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); }
  u16(v) { this.a.push((v >> 8) & 255, v & 255); }
  i16(v) { this.u16(v < 0 ? v + 65536 : v); }
  u32(v) { this.a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  i64(v) { this.u32(Math.floor(v / 2 ** 32)); this.u32(v % 2 ** 32); }
  tag(s) { for (const c of s.padEnd(4)) this.u8(c.charCodeAt(0)); }
  raw(buf) { for (const v of buf) this.a.push(v); }
  buf() { return Buffer.from(this.a); }
}
const pad4 = (buf) => (buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]) : buf);
function checksum(buf) {
  const p = pad4(buf);
  let s = 0;
  for (let i = 0; i < p.length; i += 4) s = (s + p.readUInt32BE(i)) >>> 0;
  return s;
}

// ---------------------------------------------------------------- tables

const bitmap = (rows) => ({ w: rows[0].length, px: rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '#' ? [x, y] : []))) });

/** The glyph set: .notdef, space, then every character in code point order. */
function glyphSet(bold) {
  const box = bitmap(['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####']);
  const list = [{ name: '.notdef', codes: [], ...box }, { name: 'space', codes: [0x20, 0xa0], w: SPACE - TRACK, px: [] }];
  const drawn = (str) => {
    // A string drawn as one glyph, letters spaced as the typesetter spaces them.
    const px = [];
    let x = 0;
    for (const ch of str) {
      const g = bold && BOLD[ch] ? bitmap(BOLD[ch]) : glyph(ch, bold);
      for (let i = 0; i < g.px.length; i += 2) px.push(g.px[i] + x, g.px[i + 1]);
      x += g.w + TRACK;
    }
    return { w: x - TRACK, px };
  };
  const chars = [...CHARS, ...Object.keys(ALIAS)].filter((c) => c !== ' ');
  chars.sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  for (const ch of chars) list.push({ name: `u${ch.codePointAt(0).toString(16).padStart(4, '0')}`, codes: [ch.codePointAt(0)], ...drawn(ALIAS[ch] || ch) });
  return list;
}

function cmap(map) {
  // Format 4: runs where code points and glyph ids both step by one share a segment.
  const pairs = [...map.entries()].sort((a, b) => a[0] - b[0]);
  const segs = [];
  for (const [c, g] of pairs) {
    const s = segs[segs.length - 1];
    if (s && c === s.end + 1 && g === s.gid + (c - s.start)) s.end = c;
    else segs.push({ start: c, end: c, gid: g });
  }
  segs.push({ start: 0xffff, end: 0xffff, gid: 0 });
  const n = segs.length, p2 = 2 ** Math.floor(Math.log2(n));
  const b = new Bytes();
  b.u16(0); b.u16(2); // version, two encoding records sharing one subtable
  b.u16(0); b.u16(3); b.u32(20); // Unicode BMP
  b.u16(3); b.u16(1); b.u32(20); // Windows Unicode BMP
  b.u16(4); b.u16(16 + 8 * n); b.u16(0);
  b.u16(n * 2); b.u16(p2 * 2); b.u16(Math.log2(p2)); b.u16(n * 2 - p2 * 2);
  segs.forEach((s) => b.u16(s.end));
  b.u16(0);
  segs.forEach((s) => b.u16(s.start));
  segs.forEach((s) => b.u16(s.start === 0xffff ? 1 : (s.gid - s.start + 65536) % 65536));
  segs.forEach(() => b.u16(0));
  return b.buf();
}

function nameTable(style) {
  const family = FONT.family;
  const names = {
    0: `© ${new Date(DATE).getUTCFullYear()} ${site.fullName}`,
    1: family,
    2: style,
    3: `${family} ${style} ${VERSION}`,
    4: `${family} ${style}`,
    5: `Version ${VERSION}`,
    6: `${family.replace(/\s+/g, '')}-${style}`,
    8: site.fullName,
    9: site.fullName,
    11: site.url,
    12: `${site.url}/colophon/`,
  };
  const ids = Object.keys(names).map(Number).sort((a, b) => a - b);
  const strings = ids.map((id) => {
    const s = Buffer.alloc(names[id].length * 2);
    for (let i = 0; i < names[id].length; i++) s.writeUInt16BE(names[id].charCodeAt(i), i * 2);
    return s;
  });
  const b = new Bytes();
  b.u16(0); b.u16(ids.length); b.u16(6 + 12 * ids.length);
  let off = 0;
  ids.forEach((id, i) => {
    b.u16(3); b.u16(1); b.u16(0x409); b.u16(id); b.u16(strings[i].length); b.u16(off);
    off += strings[i].length;
  });
  strings.forEach((s) => b.raw(s));
  return b.buf();
}

/** A complete TrueType font for one weight. */
function buildTTF(bold) {
  const style = bold ? 'Bold' : 'Regular';
  const set = glyphSet(bold);
  const glyphs = set.map((g) => ({ ...g, adv: (g.w + TRACK) * U, ...glyfEntry(contours(g.px)) }));
  const cmapping = new Map();
  glyphs.forEach((g, i) => g.codes.forEach((c) => cmapping.set(c, i)));

  const inked = glyphs.filter((g) => g.bbox);
  const bb = [Math.min(...inked.map((g) => g.bbox[0])), Math.min(...inked.map((g) => g.bbox[1])), Math.max(...inked.map((g) => g.bbox[2])), Math.max(...inked.map((g) => g.bbox[3]))];
  const loca = new Bytes(), glyf = [];
  let off = 0;
  for (const g of glyphs) { loca.u32(off); glyf.push(g.data); off += g.data.length; }
  loca.u32(off);
  const hmtx = new Bytes();
  for (const g of glyphs) { hmtx.u16(g.adv); hmtx.i16(g.bbox ? g.bbox[0] : 0); }

  const since1904 = (DATE - Date.UTC(1904, 0, 1)) / 1000;
  const head = new Bytes();
  head.u16(1); head.u16(0); head.u32(0x00010000); head.u32(0); head.u32(0x5f0f3cf5);
  head.u16(0x000b); head.u16(EM); head.i64(since1904); head.i64(since1904);
  bb.forEach((v) => head.i16(v));
  head.u16(bold ? 1 : 0); head.u16(10); head.i16(2); head.i16(1); head.i16(0);

  const hhea = new Bytes();
  hhea.u32(0x00010000); hhea.i16(ASC); hhea.i16(-DESC); hhea.i16(GAP);
  hhea.u16(Math.max(...glyphs.map((g) => g.adv)));
  hhea.i16(Math.min(...inked.map((g) => g.bbox[0])));
  hhea.i16(Math.min(...inked.map((g) => g.adv - g.bbox[2])));
  hhea.i16(Math.max(...inked.map((g) => g.bbox[2])));
  hhea.i16(1); hhea.i16(0); hhea.i16(0);
  for (let i = 0; i < 4; i++) hhea.i16(0);
  hhea.i16(0); hhea.u16(glyphs.length);

  const maxp = new Bytes();
  maxp.u32(0x00010000); maxp.u16(glyphs.length);
  maxp.u16(Math.max(...glyphs.map((g) => g.points)));
  maxp.u16(Math.max(...glyphs.map((g) => (g.bbox ? g.data.readInt16BE(0) : 0))));
  maxp.u16(0); maxp.u16(0); maxp.u16(2);
  for (let i = 0; i < 8; i++) maxp.u16(0);

  const codes = [...cmapping.keys()];
  const widths = glyphs.filter((g) => g.adv > 0).map((g) => g.adv);
  const os2 = new Bytes();
  os2.u16(4); os2.i16(Math.round(widths.reduce((s, w) => s + w, 0) / widths.length));
  os2.u16(bold ? 700 : 400); os2.u16(5); os2.u16(0); // installable: PDFs can embed it
  [600, 600, 0, 100, 600, 600, 0, 400].forEach((v) => os2.i16(v)); // sub/superscript
  os2.i16(U); os2.i16(3 * U); os2.i16(0); // strikeout, family class
  for (let i = 0; i < 10; i++) os2.u8(0); // PANOSE: any
  // Unicode ranges: Basic Latin, Latin-1, General Punctuation, Super/Subscripts, Currency,
  // Arrows, Mathematical Operators, Geometric Shapes, Miscellaneous Symbols, Dingbats.
  const range = (bits) => bits.reduce((m, b) => (m | (1 << b)) >>> 0, 0);
  os2.u32(range([0, 1, 31])); os2.u32(range([32 - 32, 33 - 32, 37 - 32, 38 - 32, 45 - 32, 46 - 32, 47 - 32])); os2.u32(0); os2.u32(0);
  os2.tag('JPB ');
  os2.u16((bold ? 0x20 : 0x40) | 0x80); // bold or regular; use the typo metrics
  os2.u16(Math.min(...codes)); os2.u16(Math.min(0xffff, Math.max(...codes)));
  os2.i16(ASC); os2.i16(-DESC); os2.i16(GAP);
  os2.u16(ASC + GAP); os2.u16(DESC); // win metrics hold the line gap above
  os2.u32(1); os2.u32(0); // Latin 1
  os2.i16(5 * U); os2.i16(7 * U); os2.u16(0); os2.u16(0x20); os2.u16(0);

  const post = new Bytes();
  post.u32(0x00030000); post.u32(0); post.i16(-U); post.i16(U);
  for (let i = 0; i < 5; i++) post.u32(0);

  return sfnt({
    'OS/2': os2.buf(), cmap: cmap(cmapping), glyf: Buffer.concat(glyf), head: head.buf(), hhea: hhea.buf(),
    hmtx: hmtx.buf(), loca: loca.buf(), maxp: maxp.buf(), name: nameTable(style), post: post.buf(),
  });
}

function sfnt(tables) {
  const tags = Object.keys(tables).sort();
  const n = tags.length, p2 = 2 ** Math.floor(Math.log2(n));
  const dir = new Bytes();
  dir.u32(0x00010000); dir.u16(n); dir.u16(p2 * 16); dir.u16(Math.log2(p2)); dir.u16(n * 16 - p2 * 16);
  let off = 12 + 16 * n;
  for (const t of tags) {
    dir.tag(t); dir.u32(checksum(tables[t])); dir.u32(off); dir.u32(tables[t].length);
    off += pad4(tables[t]).length;
  }
  const font = Buffer.concat([dir.buf(), ...tags.map((t) => pad4(tables[t]))]);
  // head.checkSumAdjustment makes the whole file sum to 0xB1B0AFBA.
  const headAt = 12 + 16 * n + tags.slice(0, tags.indexOf('head')).reduce((s, t) => s + pad4(tables[t]).length, 0);
  font.writeUInt32BE((0xb1b0afba - checksum(font) + 2 ** 32) % 2 ** 32, headAt + 8);
  return font;
}

/** WOFF 1.0: the same tables, each zlib-compressed. */
function woff(ttf) {
  const n = ttf.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    const tag = ttf.toString('latin1', r, r + 4), sum = ttf.readUInt32BE(r + 4), off = ttf.readUInt32BE(r + 8), len = ttf.readUInt32BE(r + 12);
    const data = ttf.subarray(off, off + len);
    const z = zlib.deflateSync(data, { level: 9 });
    tables.push({ tag, sum, len, data: z.length < len ? z : data });
  }
  const size = 44 + 20 * n + tables.reduce((s, t) => s + pad4(t.data).length, 0);
  const b = new Bytes();
  b.tag('wOFF'); b.u32(0x00010000); b.u32(size); b.u16(n); b.u16(0); b.u32(ttf.length);
  b.u16(1); b.u16(0); for (let i = 0; i < 5; i++) b.u32(0);
  let off = 44 + 20 * n;
  for (const t of tables) { b.tag(t.tag); b.u32(off); b.u32(t.data.length); b.u32(t.len); b.u32(t.sum); off += pad4(t.data).length; }
  return Buffer.concat([b.buf(), ...tables.map((t) => pad4(t.data))]);
}

/** { 'jp-pixel-regular.ttf': Buffer, … } */
export function fontFiles() {
  const out = {};
  for (const [weight, file] of Object.entries(FONT.files)) {
    const ttf = buildTTF(weight === 'bold');
    out[`${file}.ttf`] = ttf;
    out[`${file}.woff`] = woff(ttf);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] || 'brand/fonts');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, buf] of Object.entries(fontFiles())) {
    fs.writeFileSync(path.join(dir, name), buf);
    console.log(`wrote ${path.relative(process.cwd(), path.join(dir, name))} (${(buf.length / 1024).toFixed(1)} KB)`);
  }
}
