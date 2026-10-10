// Paint an engine's blocks into a 2D canvas as they are at time t: at rest
// on whole device pixels, like the site's renderer, and turning and rounding
// on the move, as the shader does. For the small pieces of the site that are
// canvases of their own (the story player's buttons, the favicon).
import { evalInst } from './engine.js';
import { STRIDE, FLAT } from './renderer.js';

const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/** bg and fg are 0–1 RGB; tone mixes between them. */
export function paint(g, e, t, bg, fg, dpr = 1) {
  const ink = rgb(fg), paper = rgb(bg);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const a = e.buf, order = Array.from({ length: e.count }, (_, i) => i).sort((i, j) => a[i * STRIDE + 18] - a[j * STRIDE + 18]);
  for (const i of order) {
    const o = i * STRIDE, c = evalInst(a, o, t);
    if (c.w < 0.05 || c.h < 0.05) continue;
    g.fillStyle = c.tone >= 0.999 ? ink : c.tone <= 0.001 ? paper : rgb(mix(bg, fg, c.tone));
    if (c.p <= 0 || c.p >= 1) {
      const x0 = Math.round(c.x * dpr) / dpr, y0 = Math.round(c.y * dpr) / dpr;
      g.fillRect(x0, y0, Math.round((c.x + c.w) * dpr) / dpr - x0, Math.round((c.y + c.h) * dpr) / dpr - y0);
      continue;
    }
    const flat = a[o + 19] & FLAT, b = Math.sin(Math.PI * c.p);
    g.save();
    g.translate(c.x + c.w / 2, c.y + c.h / 2);
    if (!flat) g.rotate(b * a[o + 15]);
    g.beginPath();
    if (g.roundRect && !flat) g.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, (b * 0.55 * Math.min(c.w, c.h)) / 2);
    else g.rect(-c.w / 2, -c.h / 2, c.w, c.h);
    g.fill();
    g.restore();
  }
}
