import { glyph, SPACE, CAP, normalize } from './font.js';

/**
 * Lay out a string in the pixel font. Every lit font pixel becomes one square
 * block of `size` CSS px.
 *
 * Options: size, bold, width (wrap width in px), lh (line height in font
 * pixels), align ('left' | 'center' | 'right'), tone, track (letter spacing).
 *
 * Returns { width, height, lines, n, blocks } where blocks is a Float32Array of
 * (x, y, w, h, tone) tuples relative to the top-left of the first line's cap
 * height. The box height covers cap height only; descenders hang below it.
 */
export function typeset(input, o) {
  const size = o.size;
  const bold = !!o.bold;
  const track = o.track ?? 1;
  const lh = o.lh ?? 12;
  const tone = o.tone ?? 1;
  const maxCols = o.width === undefined || o.width === Infinity
    ? Infinity
    : Math.max(1, Math.floor(o.width / size));

  const lines = [];
  for (const para of normalize(String(input)).split('\n')) {
    let line = { glyphs: [], w: 0 };
    const pushLine = () => { lines.push(line); line = { glyphs: [], w: 0 }; };

    for (const word of para.split(' ')) {
      if (!word) { // collapse repeated spaces but keep leading indent minimal
        continue;
      }
      // Measure the word.
      const gs = [];
      let ww = 0;
      for (const ch of word) {
        const g = glyph(ch, bold);
        if (gs.length) ww += track;
        gs.push({ g, x: ww });
        ww += g.w;
      }
      const start = line.glyphs.length ? line.w + track + SPACE : 0;
      if (start + ww <= maxCols) {
        for (const p of gs) line.glyphs.push({ g: p.g, x: start + p.x });
        line.w = start + ww;
        continue;
      }
      if (line.glyphs.length) pushLine();
      if (ww <= maxCols) {
        for (const p of gs) line.glyphs.push({ g: p.g, x: p.x });
        line.w = ww;
        continue;
      }
      // Word longer than a line: hard-break it.
      let x = 0;
      for (const p of gs) {
        if (x + p.g.w > maxCols && line.glyphs.length) { pushLine(); x = 0; }
        line.glyphs.push({ g: p.g, x });
        line.w = x + p.g.w;
        x += p.g.w + track;
      }
    }
    pushLine();
  }

  let inkW = 0;
  for (const l of lines) inkW = Math.max(inkW, l.w);
  const boxCols = maxCols === Infinity ? inkW : (o.align && o.align !== 'left' ? maxCols : inkW);

  let n = 0;
  for (const l of lines) for (const p of l.glyphs) n += p.g.px.length >> 1;
  const blocks = new Float32Array(n * 5);
  let k = 0;
  lines.forEach((l, li) => {
    let off = 0;
    if (o.align === 'center') off = Math.floor((boxCols - l.w) / 2);
    else if (o.align === 'right') off = boxCols - l.w;
    const y0 = li * lh;
    for (const p of l.glyphs) {
      const px = p.g.px;
      for (let i = 0; i < px.length; i += 2) {
        blocks[k++] = (off + p.x + px[i]) * size;
        blocks[k++] = (y0 + px[i + 1]) * size;
        blocks[k++] = size;
        blocks[k++] = size;
        blocks[k++] = tone;
      }
    }
  });

  return {
    width: boxCols * size,
    height: ((lines.length - 1) * lh + CAP) * size,
    lines: lines.length,
    n,
    blocks,
  };
}

/** Width in px of a single-line string without wrapping. */
export function measure(str, size, bold = false, track = 1) {
  const words = normalize(String(str)).split(' ').filter(Boolean);
  let w = 0;
  words.forEach((word, i) => {
    if (i) w += track + SPACE;
    let first = true;
    for (const ch of word) {
      if (!first) w += track;
      w += glyph(ch, bold).w;
      first = false;
    }
  });
  return w * size;
}
