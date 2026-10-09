// The 404 page's puzzle, after Baba Is You. Every word on the board is a
// block you can push, and a line of them reading NOUN IS PROPERTY (across or
// down) is a rule. You start as JP, walled in. Make any rule end in HOME and
// the page goes home.
import { custom, even } from './engine/layout.js';
import { typeset, measure } from './engine/typeset.js';
import { iconFrames } from './icons.js';
import { frameBlocks } from './ui.js';

export const COLS = 9, ROWS = 8;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Words in capitals; objects: j = JP, p = the lost page, # = wall.
const LEVEL = [
  '.  .     .   .     .  .  .   .     .',
  '.  PAGE  IS  LOST  .  .  .   .     .',
  '.  .     .   .     .  .  .   HOME  .',
  '#  #     #   #     #  #  .   .     .',
  '#  .     .   .     .  #  .   .     .',
  '#  WALL  IS  STOP  .  #  .   p     .',
  '#  .     .   .     j  #  .   .     .',
  '#  #     #   #     #  #  JP  IS    YOU',
];
const OBJECTS = { j: 'jp', p: 'page', '#': 'wall' };
const NOUNS = { JP: 'jp', PAGE: 'page', WALL: 'wall' };
const PROPERTIES = new Set(['YOU', 'STOP', 'LOST', 'HOME']);

function start() {
  const ents = [];
  LEVEL.forEach((line, y) => line.trim().split(/\s+/).forEach((tok, x) => {
    if (tok === '.') return;
    ents.push(OBJECTS[tok] ? { id: ents.length, obj: OBJECTS[tok], x, y } : { id: ents.length, word: tok, x, y });
  }));
  return ents;
}

class Puzzle {
  constructor() { this.clear(); }

  /** A fresh board, for the next person who gets lost. */
  clear() {
    this.ents = start();
    this.history = [];
    this.won = null;
  }

  /** The rules in force: NOUN IS PROPERTY, reading right or down. */
  rules() {
    const at = new Map();
    for (const e of this.ents) if (e.word) at.set(`${e.x},${e.y}`, e);
    const out = [];
    for (const e of this.ents) {
      if (!NOUNS[e.word]) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const is = at.get(`${e.x + dx},${e.y + dy}`), p = at.get(`${e.x + 2 * dx},${e.y + 2 * dy}`);
        if (is?.word === 'IS' && PROPERTIES.has(p?.word)) {
          out.push({ noun: NOUNS[e.word], prop: p.word, ids: [e.id, is.id, p.id], text: `${e.word} IS ${p.word}` });
        }
      }
    }
    return out;
  }

  /** Move everything that IS YOU one cell; words in the way get pushed. */
  move(dir) {
    if (this.won) return false;
    const [dx, dy] = DIRS[dir];
    const R = this.rules();
    const is = (e, p) => (e.word ? p === 'PUSH' : R.some((r) => r.noun === e.obj && r.prop === p));
    const you = this.ents.filter((e) => e.obj && is(e, 'YOU'));
    // Whoever is furthest along goes first, so a line of YOUs doesn't block itself.
    you.sort((a, b) => (b.x - a.x) * dx + (b.y - a.y) * dy);
    const before = this.ents.map((e) => [e.x, e.y]);
    let moved = false;
    for (const e of you) {
      const pushed = new Set();
      // Can something step into (x, y)? Collects the words it would push on the way.
      const enter = (x, y) => {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
        const here = this.ents.filter((o) => o !== e && o.x === x && o.y === y);
        if (here.some((o) => is(o, 'STOP') && !is(o, 'PUSH'))) return false;
        for (const o of here) {
          if (!is(o, 'PUSH')) continue;
          if (!enter(x + dx, y + dy)) return false;
          pushed.add(o);
        }
        return true;
      };
      if (!enter(e.x + dx, e.y + dy)) continue;
      for (const o of pushed) { o.x += dx; o.y += dy; }
      e.x += dx; e.y += dy;
      moved = true;
    }
    if (!moved) return false;
    this.history.push(before);
    this.won = this.rules().find((r) => r.prop === 'HOME' && this.ents.some((e) => e.obj === r.noun)) || null;
    return true;
  }

  undo() {
    if (this.won || !this.history.length) return false;
    this.history.pop().forEach(([x, y], i) => { this.ents[i].x = x; this.ents[i].y = y; });
    return true;
  }

  /** Back to the start; undo brings the old board back. */
  restart() {
    if (this.won || !this.history.length) return false;
    this.history.push(this.ents.map((e) => [e.x, e.y]));
    start().forEach((s, i) => { this.ents[i].x = s.x; this.ents[i].y = s.y; });
    return true;
  }

  /** One line under the board: what's true right now, or what went wrong. */
  status() {
    const R = this.rules();
    if (this.won) return { text: `${this.won.text}. TAKING YOU THERE…`, tone: 1 };
    if (!R.some((r) => r.prop === 'YOU' && this.ents.some((e) => e.obj === r.noun))) return { text: 'NOTHING IS YOU ANY MORE. UNDO TO GET BACK.', tone: 1 };
    return { text: `TRUE RIGHT NOW: ${R.length ? R.map((r) => r.text).join(' · ') : 'NOTHING'}`, tone: 0.55 };
  }
}

export const puzzle = new Puzzle();

// ---------------------------------------------------------------- drawing

const PAGE = ['#####..', '#...##.', '#...#.#', '#...###', '#.....#', '#.###.#', '#.....#', '#.###.#', '#.....#', '#######'];
// The lost page shrugs: a question mark where its text should be.
const PAGE_LOST = ['#####..', '#...##.', '#...#.#', '#...###', '#.###.#', '#...#.#', '#..##.#', '#.....#', '#..#..#', '#######'];

/** Frames of a small bitmap, all with the same block count so they can morph. */
function sprite(frames, p, tone) {
  const pts = frames.map((rows) => rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '#' ? [[x, y]] : []))));
  const cap = Math.max(...pts.map((q) => q.length));
  return {
    w: frames[0][0].length * p,
    h: frames[0].length * p,
    frames: pts.map((q) => {
      const out = new Float32Array(cap * 5);
      for (let j = 0; j < cap; j++) {
        const [x, y] = q[Math.floor((j * q.length) / cap)];
        out.set([x * p, y * p, p, p, tone], j * 5);
      }
      return out;
    }),
  };
}

function wordEl(ctx, e, T, ts, on) {
  const tone = on ? 1 : 0.4;
  // Long words stack in two lines, the way Baba Is You sets them.
  const lines = e.word.length <= 2 || (e.word.length === 3 && measure(e.word, ts) <= T - 2) ? [e.word] : [e.word.slice(0, 2), e.word.slice(2)];
  const parts = lines.map((l) => typeset(l, { size: ts, tone }));
  const w = Math.max(...parts.map((p) => p.width));
  const h = lines.length * 7 * ts + (lines.length - 1) * 2 * ts;
  const out = [];
  parts.forEach((p, i) => {
    const ox = Math.round((w - p.width) / 2), oy = i * 9 * ts;
    for (let k = 0; k < p.blocks.length; k += 5) out.push(p.blocks[k] + ox, p.blocks[k + 1] + oy, p.blocks[k + 2], p.blocks[k + 3], p.blocks[k + 4]);
  });
  const el = ctx.el({ key: `pz:w${e.id}`, sig: `pzw|${e.word}|${ts}|${tone}`, w, h, blocks: Float32Array.from(out), z: 2, motion: 'step' });
  el.x = even((T - w) / 2);
  el.y = even((T - h) / 2);
  return el;
}

function objectEl(ctx, e, T, has) {
  const key = `pz:o${e.id}`;
  if (e.obj === 'wall') {
    // A grid of squares that shrink to specks once walls stop stopping you.
    const solid = has('wall', 'STOP');
    const n = Math.max(2, Math.round(T / 16)), c = Math.floor(T / n), s = solid ? c - 4 : 4;
    const o = Math.floor((T - n * c) / 2) + Math.floor((c - s) / 2);
    const out = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.push(o + i * c, o + j * c, s, s, solid ? 1 : 0.35);
    return ctx.el({ key, sig: `pzo|wall|${T}|${solid}`, w: T, h: T, blocks: Float32Array.from(out), motion: 'step' });
  }
  if (e.obj === 'jp') {
    // You: the nav logo, still cycling through its shapes.
    const you = has('jp', 'YOU');
    const f = iconFrames('logo', T >= 56 ? 6 : 4, you ? 1 : 0.35);
    const el = ctx.el({
      key, sig: `pzo|jp|${T}|${you}`, w: f.w, h: f.h, blocks: f.frames[0], z: 3, motion: 'step',
      anim: you ? { frames: f.frames, period: 3, phase: 1.5 } : undefined,
    });
    el.x = even((T - f.w) / 2);
    el.y = even((T - f.h) / 2);
    return el;
  }
  const lost = has('page', 'LOST');
  const f = sprite(lost ? [PAGE, PAGE_LOST] : [PAGE], T >= 56 ? 5 : 3, lost ? 0.5 : 1);
  const el = ctx.el({
    key, sig: `pzo|page|${T}|${lost}`, w: f.w, h: f.h, blocks: f.frames[0], z: 1, motion: 'step',
    anim: lost ? { frames: f.frames, period: 1.8, phase: 0.8 } : undefined,
  });
  el.x = even((T - f.w) / 2);
  el.y = even((T - f.h) / 2);
  return el;
}

/** The board. Every word and object is its own element, so moves slide. */
export function board(o = {}) {
  return custom((w, ctx) => {
    const T = Math.max(28, Math.min(64, Math.floor((w - 8) / COLS / 4) * 4));
    const pad = 4, W = COLS * T + pad * 2, H = ROWS * T + pad * 2;
    const R = puzzle.rules();
    const live = new Set(R.flatMap((r) => r.ids));
    const has = (obj, p) => R.some((r) => r.noun === obj && r.prop === p);
    const els = [ctx.el({ key: 'pz:frame', sig: `pzf|${W}|${H}`, w: W, h: H, blocks: frameBlocks(W, H) })];
    for (const e of puzzle.ents) {
      const el = e.word ? wordEl(ctx, e, T, T >= 56 ? 3 : 2, live.has(e.id)) : objectEl(ctx, e, T, has);
      el.x += pad + e.x * T;
      el.y += pad + e.y * T;
      els.push(el);
    }
    // One focusable node over the board: arrow keys play, swipes move.
    els.push(ctx.el({
      key: 'pz:board', w: W, h: H,
      a11y: { tag: 'div', text: '', attrs: { role: 'application', tabindex: '0', 'data-board': '', 'aria-label': o.label || 'Puzzle board' } },
    }));
    return { w: W, h: H, els };
  }, o);
}

/** Width the board wants at a given column width. */
export const boardWidth = (w) => COLS * Math.max(28, Math.min(64, Math.floor((w - 8) / COLS / 4) * 4)) + 8;
