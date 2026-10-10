// The player's little pieces of the site, in its blocks and moving with its own
// engine: the logo top left (the home page's box and shape-shifting monogram)
// and the buttons' icons, which tumble from one state into the next and fill
// in on hover like the home page's nav buttons. Each is a small 2D canvas: the
// engine works out where every block is, this paints the squares.
import { Engine } from '../engine/engine.js';
import { paint } from '../engine/paint.js';
import { iconFrames } from '../icons.js';
import { frameBlocks, fillBlocks } from '../ui.js';
import { typeset } from '../engine/typeset.js';
import { frames as spriteFrames } from './art.js';

// The icons, as rows ('#' a block): 5 × 5 like the nav's, the speaker 7 × 5.
// They hold still, and only change shape when what they stand for changes.
const ART = {
  play: ['.#...', '.##..', '.###.', '.##..', '.#...'],
  pause: ['.#.#.', '.#.#.', '.#.#.', '.#.#.', '.#.#.'],
  again: ['#...#', '#..##', '#.###', '#..##', '#...#'], // back to the start
  full: ['##.##', '#...#', '.....', '#...#', '##.##'],
  window: ['.#.#.', '##.##', '.....', '##.##', '.#.#.'],
  sound: ['..#...#', '###.#.#', '###.#.#', '###.#.#', '..#...#'],
  muted: ['..#....', '###.#.#', '###..#.', '###.#.#', '..#....'],
};
const CELL = 4;

function glyph(name, text) {
  if (text) { const t = typeset(name, { size: 2 }); return { frames: [t.blocks], w: t.width, h: t.height }; }
  if (name === 'logo') return iconFrames('logo', CELL); // the one that loops
  const rows = ART[name];
  return { frames: spriteFrames([rows], CELL), w: rows[0].length * CELL, h: rows.length * CELL };
}

/** The size of a button with a word in it, like the home page's: 44 px tall, the box on the 4 px grid. */
export function labelSize(text) {
  const w = typeset(text, { size: 2 }).width + 32;
  return { w: Math.ceil((w - 4) / 4) * 4 + 4, h: 44 };
}

const NONE = { setInstances() {}, updateInstances() {} }; // the engine's renderer: we paint ourselves
const EMPTY = new Float32Array(0);
const even = (v) => Math.round(v / 2) * 2;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * A w × h box of blocks drawn into `canvas`, with an icon inside: show(name)
 * changes it (tumbling; { text: true } for a word instead), hover(on) fills
 * the box in, nudge() makes a looping icon shift right away, clear() breaks
 * the lot up into nothing, theme({ bg, fg }) follows the story's day and
 * night, and draw() paints it, once a frame.
 */
export function pixelBox(canvas, w, h) {
  const g = canvas.getContext('2d');
  const e = new Engine(NONE);
  e.vw = w; e.vh = h;
  e.calm = reduce.matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  let icon = null, on = false, look = null;

  function build() {
    const tone = on ? 0 : 1;
    const f = icon.frames.map((fr) => { const c = fr.slice(); for (let i = 4; i < c.length; i += 5) c[i] = tone; return c; });
    const x = even((w - icon.w) / 2), y = even((h - icon.h) / 2);
    const at = f[0].slice();
    for (let i = 0; i < at.length; i += 5) { at[i] += x; at[i + 1] += y; }
    e.morphTo({
      elements: [
        { key: 'frame', sig: 'frame', x: 0, y: 0, blocks: frameBlocks(w, h) },
        { key: 'fill', sig: `fill|${on}`, x: 0, y: 0, blocks: on ? fillBlocks(w, h) : EMPTY, z: 1, motion: 'grow' },
        {
          key: 'icon', sig: `icon|${icon.name}|${tone}`, x, y, blocks: at, z: 2, motion: 'icon',
          anim: f.length > 1 ? { frames: f, period: icon.period, phase: icon.phase } : undefined,
        },
      ],
    });
  }

  // The colours right now, mid-way through a change of theme or not.
  const colours = (t) => {
    const k = Math.min(1, Math.max(0, (t - look.start) / 0.6));
    return { bg: mix(look.from.bg, look.to.bg, k), fg: mix(look.from.fg, look.to.fg, k) };
  };

  return {
    show(name, o = {}) {
      if (icon?.name === name) return;
      icon = { name, ...glyph(name, o.text), period: o.period ?? 2.2, phase: o.phase };
      build();
    },
    hover(v) {
      if (on === v || !icon) return;
      on = v;
      build();
    },
    nudge() { e.nudge('icon'); },
    clear() {
      icon = null;
      on = false;
      e.morphTo({ elements: [] }, { mode: 'page', origin: [w / 2, h / 2] });
    },
    theme(t) {
      const now = e.now();
      look = { from: look ? colours(now) : t, to: t, start: look ? now : -10 };
    },
    draw() {
      if (!look) return;
      const t = e.now();
      e.tick(t);
      const { bg, fg } = colours(t);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      paint(g, e, t, bg, fg, dpr);
    },
  };
}
