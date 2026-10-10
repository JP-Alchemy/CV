// The favicon: the mark from the nav, changing its mind in the browser tab as
// well (JP, prompt, target, heart, smile). The site's engine moves the blocks,
// each frame is painted into a small canvas, and the tab gets it as a PNG.
// The page's <head> starts with the mark at rest as an SVG (vite.config.js);
// with reduced motion, or in a browser that ignores a changing icon, that is
// what stays.
import { Engine } from './engine/engine.js';
import { paint } from './engine/paint.js';
import { iconFrames } from './icons.js';
import { THEMES, unit } from './brand.js';

const SIZE = 64, CELL = 8; // 7 × 5 cells of 8 px: blocks of 2 px at 16 px
const NONE = { setInstances() {}, updateInstances() {} }; // the engine's renderer: we paint ourselves

export function animateFavicon() {
  const link = document.querySelector('link[rel="icon"]');
  if (!link || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d');
  if (!g) return;
  const dark = matchMedia('(prefers-color-scheme: dark)'); // the tab strip's, not the page's

  const e = new Engine(NONE);
  e.vw = e.vh = SIZE;
  const f = iconFrames('logo', CELL);
  const x = (SIZE - f.w) / 2, y = (SIZE - f.h) / 2;
  const at = f.frames[0].slice();
  for (let i = 0; i < at.length; i += 5) { at[i] += x; at[i + 1] += y; }
  e.morphTo({ elements: [{ key: 'mark', sig: 'mark', x, y, blocks: at, motion: 'icon', anim: { frames: f.frames, period: 2.2, phase: 2.2 } }] });
  const mark = e.els.get('mark');

  // Ink on light tabs, paper on dark ones, as the SVG in the <head> does.
  function draw(t) {
    const T = THEMES[dark.matches ? 'dark' : 'light'];
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    paint(g, e, t, unit(T.bg), unit(T.fg));
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
  }

  let shown = 0; // the mark on the tab now (JP, from the <head>), or -1 mid-tumble
  function step() {
    const t = e.now();
    e.tick(t);
    const moving = t < e.animUntil;
    // A hidden tab gets a timer a second at best, so it skips the tumble and
    // shows each mark once it has landed.
    if (moving ? !document.hidden : shown !== mark.anim.k) {
      draw(t);
      shown = moving ? -1 : mark.anim.k;
    }
    const next = moving ? (document.hidden ? e.animUntil + 0.02 : t + 0.05) : e.nextTick();
    setTimeout(step, Math.max(0, next - t) * 1000 * e.slow);
  }
  dark.addEventListener('change', () => draw(e.now()));
  // Start once the blocks have arrived, so the first thing the tab sees move is a tumble.
  setTimeout(step, Math.max(0, e.animUntil - e.now()) * 1000 * e.slow);
}
