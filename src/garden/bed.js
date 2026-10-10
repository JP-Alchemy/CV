// The garden page's ground and pots (/garden/), as blocks on the garden's
// 4 px grid: the walls the page draws are exactly the walls the sand meets.
// Each pot is a cross-section (a rim, two walls, a base), and once the garden
// starts, garden/mode.js fills the pots and the ground with damp soil.
import { CELL } from './sim.js';

// w: cells across inside the rim, h: cells tall, taper: cells each wall
// steps in towards the base.
const POTS = {
  trough: { w: 34, h: 10, taper: 0 },
  pot: { w: 20, h: 17, taper: 3 },
  tall: { w: 12, h: 23, taper: 1 },
  small: { w: 14, h: 11, taper: 2 },
};
const ORDER = ['pot', 'tall', 'trough', 'small', 'pot']; // left to right, as many as fit
const GROUND = 9; // rows of soil under it all
const GAP = 12; // the least room between pots, in cells
const ROOM = 34; // rows a pot leaves clear above it, for the plants

/** The ground's gentle rise and fall, in rows above its lowest level. */
export const hills = (col) => Math.round(1.5 + 1.5 * Math.sin(col * 0.045 + 0.7));

/** A pot's wall cells, [x, y] from its top-left (the rim overhangs by one cell). */
function walls({ w, h, taper }) {
  const out = [];
  const inset = (r) => (r < 2 ? 0 : Math.round((taper * (r - 2)) / Math.max(1, h - 3)));
  for (let r = 0; r < h; r++) {
    if (r === h - 1) { for (let x = inset(r); x <= w - 1 - inset(r); x++) out.push([x, r]); continue; }
    if (r < 2) { out.push([-1, r], [0, r], [w - 1, r], [w, r]); continue; }
    // Where a wall steps in, it keeps the cell above too, so nothing leaks through the corner.
    const a = Math.min(inset(r), inset(r - 1)), b = Math.max(inset(r), inset(r - 1));
    for (let x = a; x <= b; x++) out.push([x, r], [w - 1 - x, r]);
  }
  return out;
}

/**
 * Lay out the ground and as many pots as fit across the column (px:
 * left, width), standing on the ground, below `top` and above `bottom`. y0
 * is where the garden's grid starts. Returns the pots (blocks in page px)
 * and the beds of soil to fill: a point inside each, the level it fills to,
 * and how damp it starts.
 */
export function bed({ left, width, top, bottom, y0 }) {
  const rows = Math.floor((bottom - y0) / CELL);
  const ground = rows - GROUND;
  const beds = [{ x: Math.ceil(left / CELL) * CELL + 2, y: y0 + (rows - 1) * CELL + 2, level: y0 + ground * CELL, hills, damp: 45 }];
  const c0 = Math.ceil(left / CELL), c1 = Math.floor((left + width) / CELL);
  const fits = (name) => y0 + (ground - POTS[name].h - ROOM) * CELL >= top;
  const picked = [];
  let used = 0;
  for (const name of ORDER) {
    if (!fits(name)) continue;
    const need = POTS[name].w + 2 + (picked.length ? GAP : 0);
    if (used + need > c1 - c0) break;
    picked.push(name);
    used += need;
  }
  // Spread them out evenly, with room at both ends too.
  const outer = picked.reduce((n, name) => n + POTS[name].w + 2, 0);
  const space = (c1 - c0 - outer) / (picked.length + 1);
  const pots = [];
  let at = c0 + space;
  for (const name of picked) {
    const p = POTS[name], col = Math.round(at) + 1, row = ground - p.h;
    const blocks = walls(p).flatMap(([x, y]) => [(col + x) * CELL, y0 + (row + y) * CELL, CELL, CELL, 1]);
    pots.push({ name, blocks: Float32Array.from(blocks) });
    beds.push({ x: (col + (p.w >> 1)) * CELL + 2, y: y0 + (ground - 2) * CELL + 2, level: y0 + (row + 2) * CELL, damp: 70 });
    at += p.w + 2 + space;
  }
  return { pots, beds };
}
