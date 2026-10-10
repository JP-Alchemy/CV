import { Ctx, layout, resolve, shift, text, col, row, grid, space, custom, maxw, even } from './engine/layout.js';
import { tokens, label, rule, button, link, image, icon, hitArea, pressRow, frameBlocks, fillBlocks, solidLine, section } from './ui.js';
import { iconFrames } from './icons.js';
import { typeset } from './engine/typeset.js';
import { roadbookPage } from './roadbook.js';
import { puzzle, board, boardWidth } from './puzzle.js';
import { COLOURS, PRIMARY, CELL } from './garden/sim.js';
import { bed } from './garden/bed.js';
import { THEMES, SPECTRUM } from './brand.js';
import { ADVENTURER, frames as spriteFrames } from './story/art.js';
import {
  site, links, projects, services, onRequest, about, principles, stats, cv, experience, education, skills, colophon, story, gardenText,
} from './content.js';

const pad2 = (i) => String(i + 1).padStart(2, '0');
const UP = (s) => s.toUpperCase();

// ---------------------------------------------------------------- navigation

export const NAV = [
  { label: 'WORK', href: '/work/', match: ['work', 'project', 'roadbook'] },
  { label: 'SERVICES', href: '/services/', match: ['services'] },
  { label: 'ABOUT', href: '/about/', match: ['about'] },
  { label: 'CV', href: '/cv/', match: ['cv'] },
  { label: 'CONTACT', href: '/contact/', match: ['contact'] },
];

function logoBox() {
  return custom((w, ctx) => {
    const W = 44, H = 36;
    const f = iconFrames('logo', 4);
    const els = [
      ctx.el({ key: 'nav-logo:frame', sig: `frame|${W}|${H}`, w: W, h: H, blocks: frameBlocks(W, H) }),
    ];
    const ic = ctx.el({ key: 'nav-logo:icon', sig: 'icon|logo|4', w: f.w, h: f.h, blocks: f.frames[0], motion: 'icon', anim: { frames: f.frames, period: 2.2, phase: 1.6 } });
    ic.x = even((W - f.w) / 2); ic.y = even((H - f.h) / 2);
    els.push(ic);
    els.push(ctx.el({ key: 'nav-logo', w: W, h: H, hit: { href: '/', label: `${site.fullName} — home` } }));
    return { w: W, h: H, els };
  });
}

function navBar(state, S) {
  const hv = (k) => state.hover === k;
  const name = state.route.name;
  const left = [logoBox()];
  if (!S.mobile && !S.tablet) left.push(button({ key: 'nav-tag', label: 'CREATIVE TECHNOLOGIST', href: '/about/', small: true, hover: hv('nav-tag'), aria: 'About JP' }));
  const theme = button({
    key: 'nav-theme', label: 'THEME', icon: state.theme === 'dark' ? 'dark' : 'light', small: true, width: 36,
    action: 'theme', hover: false, aria: state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  });
  const garden = button({
    key: 'nav-garden', label: 'GARDEN', icon: 'garden', small: true, width: 36, href: '/garden/', hover: false, active: name === 'garden',
    aria: 'The garden: grow the spectrum (G)', period: 1.6,
  });
  // The story has its own day and night, and no room for a garden.
  const tools = name === 'story' ? [] : [garden, theme];
  const right = S.mobile
    ? [button({ key: 'nav-menu', label: state.menuOpen ? 'CLOSE' : 'MENU', action: 'menu', small: true, hover: hv('nav-menu'), active: state.menuOpen, aria: state.menuOpen ? 'Close menu' : 'Open menu' }), ...tools]
    : [...NAV.map((n) => button({ key: `nav-${n.label}`, label: n.label, href: n.href, small: true, hover: hv(`nav-${n.label}`), active: n.match.includes(name) })), ...tools];
  return row([row(left, { gap: 4 }), row(right, { gap: 4 })], { justify: 'between' });
}

function footer(state, S, count) {
  const hv = (k) => state.hover === k;
  const made = `THIS PAGE IS MADE OF ${count.toLocaleString('en-US')} BLOCKS`;
  const items = [
    text(`© 2026 ${UP(site.fullName)} · LEIDEN, NL`, S.small, { key: 'foot-copy' }),
    link({ key: 'foot-count', label: made, href: '/colophon/', hover: hv('foot-count'), aria: 'How this site is made' }),
    link({ key: 'foot-top', label: 'BACK TO TOP ↑', action: 'top', hover: hv('foot-top'), aria: 'Back to top' }),
  ];
  return col([
    rule({ key: 'foot-rule' }),
    S.mobile ? col(items, { gap: 14, mt: 20 }) : row(items, { justify: 'between', mt: 20 }),
  ]);
}

// ---------------------------------------------------------------- garden

/** One colour of the spectrum: a swatch to pick its seeds, with how many you hold. */
function seedChip(v, k, hv) {
  return custom((w, ctx) => {
    const size = 28, key = `gd-seed-${k}`;
    // Unknown: a "?". Seeds in hand: a small square, like a seed. Bloomed: full colour.
    const n = v.seeds[k], have = n === Infinity || n > 0;
    const known = v.found[k] || have;
    const sel = v.tool === 'seed' && v.seed === k;
    const els = [ctx.el({ key: `${key}:frame`, sig: `chipf|${sel}`, w: size, h: size, blocks: frameBlocks(size, size, sel ? 4 : 2), motion: 'hover' })];
    if (known) {
      els.push(ctx.el({ key: `${key}:fill`, sig: `chip|${k}|${v.found[k]}`, w: size, h: size, blocks: fillBlocks(size, size, 4, v.found[k] ? 6 : 10, 2 + k), motion: 'grow' }));
    } else {
      const q = typeset('?', { size: 2, tone: 0.45 });
      const el = ctx.el({ key: `${key}:q`, sig: 'chipq', w: q.width, h: 14, blocks: q.blocks });
      el.x = even((size - q.width) / 2); el.y = 7;
      els.push(el);
    }
    const count = n === Infinity ? '' : n > 0 ? String(n) : '';
    if (count) {
      const t = typeset(count, { size: 2, tone: 0.55 });
      const el = ctx.el({ key: `${key}:n`, sig: `chipn|${count}`, w: t.width, h: 14, blocks: t.blocks });
      el.x = even((size - t.width) / 2); el.y = size + 6;
      els.push(el);
    }
    const name = COLOURS[k].toLowerCase();
    const aria = !known ? `${name}: not found yet` : `${name}${v.found[k] ? ' (bloomed)' : ''}: ${n === Infinity ? 'seeds always in stock' : `${n} seeds`}`;
    els.push(ctx.el({ key, w: size, h: size, hit: { action: `gd:seed:${k}`, label: aria, pressed: sel } }));
    return { w: size, h: size + 20, els };
  });
}

/** The garden's toolbar: tools, the spectrum's seeds, and what to do next. */
function gardenBar(state, S) {
  const v = state.garden;
  const hv = (k) => state.hover === k;
  const tools = v.tools.map((t) => button({ key: `gd-tool-${t}`, label: t.toUpperCase(), small: true, action: `gd:tool:${t}`, active: v.tool === t, pressed: v.tool === t, hover: hv(`gd-tool-${t}`) }));
  // On a phone the first lesson lives down here, in the hint's place, with
  // its button where START OVER goes (no box over the garden to get in the way).
  const lesson = S.mobile && v.tutorial;
  const done = lesson
    ? button({ key: 'gd-done', label: v.tutorial.button, small: true, action: 'gd:skip', hover: hv('gd-done'), aria: v.tutorial.button === 'SKIP' ? 'Skip the garden lesson' : 'Close the garden lesson' })
    : button({ key: 'gd-done', label: 'START OVER', small: true, action: 'gd:restart', hover: hv('gd-done'), aria: 'Start the garden over: fresh soil, empty pots (your colours and seeds stay)' });
  const chips = row(COLOURS.map((_, k) => seedChip(v, k, hv)), { gap: S.mobile ? 4 : 6 });
  // The hint has room for a set number of lines, whatever it says, so the
  // toolbar (and the ground and pots on it) never move as it changes.
  const lines = S.mobile ? 4 : 2, line = typeset('A', S.small).height, room = lines * line + (S.mobile ? 4 : 0);
  const said = lesson
    ? col([text(v.tutorial.label, S.small, { key: 'gd-hint-step', tone: 0.55 }), text(v.tutorial.text, S.small, { key: 'gd-hint', tone: 1, mt: 4, attrs: { 'aria-live': 'polite' } })])
    : text(v.hint, S.small, { key: 'gd-hint', tone: 1, attrs: { 'aria-live': 'polite' } });
  const hint = custom((w, ctx) => { const b = layout(said, w, ctx); return { w: b.w, h: room, els: b.els }; });
  if (S.mobile) {
    return col([row([...tools, done], { gap: 4, wrap: true, rowGap: 4 }), { ...chips, mt: 10 }, { ...hint, mt: 2 }]);
  }
  return col([
    row([row(tools, { gap: 4 }), done], { justify: 'between' }),
    { ...row([chips, { ...hint, grow: true }], { gap: 20 }), mt: 12 },
  ]);
}

/**
 * The toolbar, pinned to the bottom of the screen on a paper-coloured band,
 * as tall as it will be with every tool unlocked (so unlocking one doesn't
 * move the ground).
 */
function gardenBand(state, S, ctx, vp) {
  const b = layout(gardenBar(state, S), S.cw, ctx);
  const full = layout(gardenBar({ ...state, garden: { ...state.garden, tools: state.garden.every, tutorial: null } }, S), S.cw, new Ctx('gd-size', state));
  const pad = S.mobile ? 12 : 16, bandH = Math.max(b.h, full.h) + pad * 2, top = vp.h - bandH;
  shift(b.els, S.left, top + pad);
  const band = ctx.el({ key: 'gd-band', sig: `gdb|${vp.w}|${bandH}`, w: vp.w, h: bandH, blocks: fillBlocks(vp.w, bandH, 4, 0, 0), flat: true });
  const edge = ctx.el({ key: 'gd-edge', sig: `gde|${vp.w}`, w: vp.w, h: 2, blocks: solidLine(vp.w) });
  band.y = top;
  edge.y = top;
  for (const e of b.els) e.z = (e.z || 0) + 4;
  band.z = 3;
  edge.z = 4;
  const els = [band, edge, ...b.els];
  for (const e of els) e.fixed = true;
  return { els, top };
}

/** The ground and pots (garden/bed.js) between the heading and the toolbar, as page blocks. */
function gardenBed(S, ctx, top, bottom) {
  const { pots, beds } = bed({ left: S.left, width: S.cw, top, bottom, y0: Math.ceil(S.navClip / CELL) * CELL });
  const els = pots.map((p, i) => {
    const b = p.blocks;
    let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
    for (let j = 0; j < b.length; j += 5) { x0 = Math.min(x0, b[j]); y0 = Math.min(y0, b[j + 1]); x1 = Math.max(x1, b[j] + b[j + 2]); y1 = Math.max(y1, b[j + 1] + b[j + 3]); }
    const local = b.slice();
    for (let j = 0; j < local.length; j += 5) { local[j] -= x0; local[j + 1] -= y0; }
    const el = ctx.el({ key: `pot-${i}`, sig: `pot|${p.name}`, w: x1 - x0, h: y1 - y0, blocks: local });
    el.x = x0; el.y = y0;
    return el;
  });
  return { els, beds };
}

// The first lesson (garden/tutorial.js): a box saying what to do, an arrow
// at where, and a mark on the spot to click. A toolbar button to press first
// blinks instead, and the box sits over it.
const ARROW = ['...#...', '...#...', '...#...', '#######', '.#####.', '..###..', '...#...'];
const cells = (rows, c, tone = 1) => Float32Array.from(rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === '#' ? [x * c, y * c, c, c, tone] : []))));
const nudge = (b, dy) => { const o = b.slice(); for (let i = 1; i < o.length; i += 5) o[i] += dy; return o; };
const blink = (w, h, b) => ({ frames: [frameBlocks(w, h, b), frameBlocks(w, h, b, 0.15)], period: 0.45, phase: 0 });

function gardenLesson(state, S, ctx, band, top) {
  const t = state.garden?.tutorial;
  if (!t) return { els: [], hole: null };
  const els = [];
  const fix = (e, z = 8) => { e.fixed = true; e.z = z; els.push(e); return e; };
  // A toolbar button to press first: a blinking ring round it, and the arrow points there.
  const want = t.tool ? `gd-tool-${t.tool}:frame` : t.chip !== null ? `gd-seed-${t.chip}:frame` : null;
  const at = want && band.els.find((e) => e.key === want);
  let point = t.target;
  if (at) {
    const w = at.w + 8, h = at.h + 8;
    const ring = fix(ctx.el({ key: 'gt-ring', sig: `gtr|${w}|${h}`, w, h, blocks: frameBlocks(w, h, 4), motion: 'icon', anim: blink(w, h, 4) }));
    ring.x = at.x - 4; ring.y = at.y - 4;
    point = [at.x + at.w / 2, at.y - 6];
  }
  // The spot to click: a small blinking square.
  if (t.mark) {
    const q = 24;
    const mark = fix(ctx.el({ key: 'gt-mark', sig: 'gt-mark', w: q, h: q, blocks: frameBlocks(q, q, 4), motion: 'icon', anim: blink(q, q, 4) }));
    mark.x = even(t.mark[0] - q / 2); mark.y = even(t.mark[1] - q / 2);
  }
  const A = 7 * 4;
  const arrowAt = (tx, ty) => {
    const tip = t.mark && !at ? ty - 18 : ty; // stop short of the mark
    const ay = even(tip - A - 6);
    if (t.arrow !== false && !at) {
      const arrow = fix(ctx.el({ key: 'gt-arrow', sig: 'gt-arrow', w: A, h: A, blocks: cells(ARROW, 4), motion: 'icon', anim: { frames: [cells(ARROW, 4), nudge(cells(ARROW, 4), 6)], period: 0.6, phase: 0 } }));
      arrow.x = even(tx - A / 2); arrow.y = ay;
    }
    return ay;
  };
  if (S.mobile) {
    if (point) arrowAt(...point);
    return { els, hole: null };
  }
  // The box, with what to do.
  const W = Math.min(320, S.cw), pad = 12;
  const body = layout(col([
    text(t.label, S.small, { key: 'gt-step', tone: 0.55, a11y: false }),
    text(t.text, S.small, { key: 'gt-text', tone: 1, a11y: false, mt: 6 }),
    row([button({ key: 'gt-btn', label: t.button, small: true, action: 'gd:skip', hover: state.hover === 'gt-btn', aria: t.button === 'SKIP' ? 'Skip the garden lesson' : 'Close the garden lesson' })], { mt: 10 }),
  ]), W - pad * 2, ctx);
  const H = body.h + pad * 2;
  let x, y;
  if (point) {
    // The box goes over the arrow, or beside it where the heading is in the way.
    const [tx, ty] = point;
    const ay = arrowAt(tx, ty);
    x = tx - W / 2; y = ay - 6 - H;
    if (y < top) {
      const side = tx - A / 2 - 16 - W >= S.left ? -1 : 1;
      x = side < 0 ? tx - A / 2 - 16 - W : tx + A / 2 + 16;
      y = Math.max(top, ay + A - H);
    }
  } else {
    x = S.left + S.cw - W; y = band.top - H - 16;
  }
  x = even(Math.max(S.left, Math.min(S.left + S.cw - W, x)));
  y = even(Math.max(S.navClip + 8, y));
  const fill = fix(ctx.el({ key: 'gt-box', sig: `gtb|${W}|${H}`, w: W, h: H, blocks: fillBlocks(W, H, 4, 0, 0), flat: true }), 7);
  const edge = fix(ctx.el({ key: 'gt-edge', sig: `gte|${W}|${H}`, w: W, h: H, blocks: frameBlocks(W, H) }));
  fill.x = edge.x = x; fill.y = edge.y = y;
  shift(body.els, x + pad, y + pad);
  for (const e of body.els) fix(e, 9);
  return { els, hole: [x, y, x + W, y + H] };
}

function gardenPage(state, S) {
  return pageHead(S, gardenText.eyebrow, gardenText.title, { h1: 'Grow the spectrum: a falling-sand garden', intro: gardenText.intro });
}

// ---------------------------------------------------------------- pieces

function pageHead(S, eyebrow, title, o = {}) {
  return col([
    label(eyebrow, { key: 'page-eyebrow' }),
    text(title, S.h1, { key: o.titleKey || 'page-title', tag: 'h1', label: o.h1, mt: S.sp(2) }),
    o.intro ? maxw(640, text(o.intro, S.body, { key: 'page-intro', mt: S.sp(2) })) : null,
  ]);
}

/** A way into the story (/story/): the adventurer looking about, a line, and a button. */
function storyTeaser(state, S, line) {
  const cell = S.mobile ? 5 : 6;
  const f = spriteFrames([ADVENTURER.stand, ADVENTURER.up, ADVENTURER.cheer, ADVENTURER.stand, ADVENTURER.walk], cell);
  const hero = custom((w, ctx) => {
    const W = 12 * cell, H = 16 * cell;
    return { w: W, h: H, els: [ctx.el({ key: 'story-hero', sig: `story-hero|${cell}`, w: W, h: H, blocks: f[0], motion: 'icon', anim: { frames: f, period: 1.7, phase: 0.9 } })] };
  });
  const body = col([
    text(story.title, S.h3, { key: 'story-title', tag: 'h3', label: 'The Adventurer' }),
    maxw(560, text(line, S.body, { key: 'story-line', mt: S.sp(1) })),
    row([button({ key: 'story-watch', label: story.cta, arrow: '→', href: story.href, hover: state.hover === 'story-watch', aria: 'Watch The Adventurer, a short animated story with sound' })], { mt: S.sp(2) }),
  ]);
  return row([hero, { ...body, grow: true }], { gap: S.sp(S.mobile ? 2 : 4), valign: 'center', mt: S.sp(3) });
}

function projectRow(p, i, state, S) {
  const key = `row-${p.slug}`;
  const hv = state.hover === key;
  return pressRow({
    key, href: `/work/${p.slug}/`, hover: hv, label: `${p.name} — ${p.summary}`,
    content: (tone, z) => row([
      text(pad2(i), S.small, { key: `${key}:n`, tone: tone ? 0.55 : 0, z, a11y: false, basis: 40 }),
      { ...text(p.title, S.h3, { key: `title:${p.slug}`, tone, z, a11y: false }), basis: S.mobile ? 150 : 250 },
      S.mobile ? { ...space(0), grow: true } : { ...text(p.line || p.summary, S.body, { key: `${key}:s`, tone: tone ? 0.55 : 0, z, a11y: false }), grow: true },
      S.mobile ? null : { ...text(p.when, S.small, { key: `${key}:y`, tone: tone ? 0.55 : 0, z, a11y: false, align: 'right' }), basis: 120 },
      text('→', S.body, { key: `${key}:a`, tone, z, a11y: false }),
    ], { gap: S.sp(2), valign: 'center' }),
  });
}

// ---------------------------------------------------------------- pages

function home(state, S) {
  const hv = (k) => state.hover === k;
  const dark = state.theme === 'dark';
  const intro = col([
    label('CREATIVE TECHNOLOGIST · LEIDEN, NL', { key: 'page-eyebrow' }),
    text("HI, I'M JP.", S.display, { key: 'page-title', tag: 'h1', label: `Hi, I'm ${site.fullName} — a creative technologist in Leiden`, mt: S.sp(2) }),
    text(UP(site.tagline), S.h2, { key: 'home-role', mt: S.sp(2) }),
    maxw(580, text(site.intro, S.body, { key: 'page-intro', mt: S.sp(2) })),
    row([
      button({ key: 'cta-work', label: 'SEE THE WORK', arrow: '→', href: '/work/', hover: hv('cta-work') }),
      button({ key: 'cta-services', label: 'WORK WITH ME', href: '/services/', hover: hv('cta-services') }),
    ], { gap: 8, wrap: true, mt: S.sp(3) }),
  ]);
  const heroImg = col([
    image({ key: 'hero-image', spec: { kind: 'moon' }, aspect: 1, cell: S.mobile ? 6 : 8, dark, alt: 'A halftone moon reflected in still water' }),
    text('THE MOON DOES NOT TRY TO REFLECT ITSELF.', S.small, { key: 'hero-caption', mt: 12, align: 'right', a11y: false }),
  ]);
  const hero = S.mobile
    ? col([intro, { ...heroImg, mt: S.sp(5) }])
    : row([{ ...intro, grow: true }, { ...heroImg, basis: S.tablet ? 300 : 440 }], { gap: S.sp(4), valign: 'center' });

  const now = site.now.map((n, i) => row([
    icon({ key: `now-icon-${i}`, name: n.icon, cell: 4, phase: 0.4 + i * 0.7 }),
    { ...text(n.when, S.small, { key: `now-when-${i}` }), basis: S.mobile ? 72 : 96 },
    { ...text(n.text, S.body, { key: `now-${i}` }), grow: true },
  ], { gap: S.sp(2), valign: 'center', mt: i ? S.sp(2) : S.sp(3) }));

  return col([
    hero,
    ...section(S, 'work', 'SELECTED WORK'),
    ...projects.slice(0, 4).map((p, i) => projectRow(p, i, state, S)),
    { ...link({ key: 'all-work', label: 'ALL PROJECTS →', href: '/work/', hover: hv('all-work') }), mt: S.sp(3) },
    ...section(S, 'now', 'CURRENTLY'),
    ...now,
    ...section(S, 'story', 'MY STORY'),
    storyTeaser(state, S, story.home),
    ...section(S, 'hire', 'WORK WITH ME'),
    maxw(640, text('By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements: interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO work.', S.body, { key: 'hire-text', mt: S.sp(3) })),
    { ...link({ key: 'hire-link', label: 'SERVICES →', href: '/services/', hover: hv('hire-link') }), mt: S.sp(3) },
  ]);
}

function work(state, S) {
  const cards = projects.map((p) => {
    const key = `card-${p.slug}`;
    const on = state.hover === key;
    return hitArea({ key, href: `/work/${p.slug}/`, label: `${p.name} — ${p.summary}` }, col([
      image({
        key: `img:${p.slug}`, spec: p.image, aspect: 0.62, dark: state.theme === 'dark', motion: 'hover', alt: `${p.name} — cover image`,
        // hover re-samples the image: halftone <-> dither (photos set their own resting style)
        ...(p.image.style === 'dither'
          ? { style: on ? 'halftone' : 'dither', cell: on ? 6 : p.image.cell || 3, gamma: on ? 1 : p.image.gamma }
          : { style: on ? 'dither' : 'halftone', cell: on ? 4 : 8 }),
      }),
      row([
        text(p.title + (on ? ' →' : ''), S.h3, { key: `title:${p.slug}`, a11y: false, motion: 'hover' }),
        text(p.when, S.small, { key: `when:${p.slug}`, a11y: false }),
      ], { justify: 'between', mt: S.sp(2) }),
      text(p.summary, S.body, { key: `sum:${p.slug}`, tone: 0.55, a11y: false, mt: S.sp(1) }),
      text(p.tags.join(' · '), S.label, { key: `tags:${p.slug}`, a11y: false, mt: S.sp(1) }),
    ]));
  });
  return col([
    pageHead(S, 'WORK', 'SELECTED PROJECTS', {
      h1: 'Selected projects — interactive 3D, data and sustainability work',
      intro: 'Day-job platforms, client work and small gifts hung along the path. Each one is drawn here as a field of blocks — hover to re-sample it.',
    }),
    { ...grid(cards, { cols: S.mobile ? 1 : 2, gap: S.sp(3), rowGap: S.sp(6) }), mt: S.sp(6) },
  ]);
}

/**
 * Case-study sections under a project: a paragraph (`text`, `note`), a grid
 * of headed points (`items`), big numbers (`stats`), a numbered story
 * (`steps`) and halftone screenshots (`gallery`).
 */
function caseSections(p, state, S) {
  const dark = state.theme === 'dark';
  return (p.sections || []).flatMap((sec, si) => {
    const k = `cs-${si}`;
    const para = (str, key) => maxw(720, text(str, S.body, { key, mt: S.sp(3) }));
    const out = [...section(S, k, sec.title, { mt: S.sp(8) })];
    if (sec.text) out.push(para(sec.text, `${k}-text`));
    if (sec.items) {
      out.push({ ...grid(sec.items.map((it, i) => col([
        text(UP(it.lead), S.h3, { key: `${k}-${i}-l`, tag: 'h3', label: it.lead }),
        text(it.text, S.body, { key: `${k}-${i}-t`, mt: S.sp(1) }),
      ])), { cols: S.mobile ? 1 : sec.cols || 2, gap: S.sp(4), rowGap: S.sp(4) }), mt: S.sp(3) });
    }
    if (sec.stats) {
      out.push({ ...grid(sec.stats.map((st, i) => col([
        text(st.value, S.h1, { key: `${k}-${i}-v`, label: `${st.value} ${st.label.toLowerCase()}` }),
        text(st.label, S.small, { key: `${k}-${i}-sl`, mt: S.sp(1), a11y: false }),
      ])), { cols: S.mobile ? 2 : 3, gap: S.sp(3), rowGap: S.sp(4) }), mt: S.sp(3) });
    }
    if (sec.steps) {
      out.push(col(sec.steps.map((st, i) => row([
        text(pad2(i), S.small, { key: `${k}-${i}-n`, a11y: false, basis: 40 }),
        { ...maxw(720, text(st, S.body, { key: `${k}-${i}-s` })), grow: true },
      ], { mt: i ? S.sp(2) : 0 })), { mt: S.sp(3) }));
    }
    if (sec.gallery) {
      out.push({ ...grid(sec.gallery.map((g, i) => col([
        image({ key: `${k}-${i}-img`, spec: { src: g.src, lumaInk: g.lumaInk, levels: g.levels }, aspect: g.aspect ?? 0.5625, style: 'dither', cell: 4, dark, alt: g.alt }),
        g.caption ? text(g.caption, S.small, { key: `${k}-${i}-c`, mt: 12, a11y: false }) : null,
      ])), { cols: S.mobile ? 1 : 2, gap: S.sp(3), rowGap: S.sp(4) }), mt: S.sp(3) });
    }
    if (sec.note) out.push(para(sec.note, `${k}-note`));
    return out;
  });
}

function project(state, S, slug) {
  const hv = (k) => state.hover === k;
  const i = projects.findIndex((p) => p.slug === slug);
  if (i < 0) return notFound(state, S);
  const p = projects[i];
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const nxt = projects[(i + 1) % projects.length];
  const meta = [[/\d{4}/.test(p.when) ? 'WHEN' : 'STATUS', p.when], ['ROLE', p.role], ['STACK', p.stack]].map(([k, v], j) => col([
    text(k, S.small, { key: `meta-k-${j}` }),
    text(v, S.body, { key: `meta-v-${j}`, mt: 10 }),
  ]));
  return col([
    link({ key: 'back', label: '← ALL WORK', href: '/work/', hover: hv('back') }),
    text(p.title, S.h1, { key: `title:${p.slug}`, tag: 'h1', label: p.name, mt: S.sp(4) }),
    maxw(720, text(p.summary, S.h2, { key: 'page-intro', mt: S.sp(2) })),
    { ...grid(meta, { cols: S.mobile ? 1 : 3, gap: S.sp(2), rowGap: S.sp(2) }), mt: S.sp(4) },
    { ...image({
      key: `img:${p.slug}`, spec: p.image, dark: state.theme === 'dark', alt: `${p.name} — cover image`,
      aspect: p.imageAspect ?? (S.mobile ? 0.8 : 0.5), w: p.imageMaxW,
      style: p.image.style, cell: p.image.cell || (S.mobile ? 6 : 8), gamma: p.image.gamma,
    }), mt: S.sp(5) },
    maxw(680, col(p.body.map((para, j) => text(para, S.body, { key: `body-${j}`, mt: j ? S.sp(2) : 0 })), { mt: S.sp(5) })),
    ...caseSections(p, state, S),
    text(p.tags.join(' · '), S.label, { key: 'tags', mt: S.sp(p.sections ? 8 : 4) }),
    p.url ? row([button(p.url.startsWith('/')
      ? { key: 'visit', label: p.cta || 'OPEN', arrow: '→', href: p.url, hover: hv('visit') }
      : { key: 'visit', label: `VISIT ${UP(p.name)}`, arrow: '↗', href: p.url, external: true, hover: hv('visit') })], { mt: S.sp(4) }) : null,
    { ...rule({ key: 'proj-rule' }), mt: S.sp(6) },
    row([
      button({ key: 'prev', label: prev.title, arrow: '←', href: `/work/${prev.slug}/`, hover: hv('prev'), aria: `Previous project: ${prev.name}` }),
      button({ key: 'next', label: nxt.title, arrow: '→', href: `/work/${nxt.slug}/`, hover: hv('next'), aria: `Next project: ${nxt.name}` }),
    ], { justify: 'between', wrap: true, gap: 8, mt: S.sp(3) }),
  ]);
}

function servicesPage(state, S) {
  const hv = (k) => state.hover === k;
  const rows = services.map((s, i) => {
    const key = `svc-${i}`;
    return pressRow({
      key, href: '/contact/', hover: hv(key), label: `${s.name}. ${s.text}`, padY: 22,
      content: (tone, z) => (S.mobile
        ? col([
          row([icon({ key: `${key}:i`, name: s.icon, cell: 4, tone, z }), text(s.title, S.h3, { key: `${key}:t`, tone, z, a11y: false })], { gap: 12, valign: 'center' }),
          text(s.text, S.body, { key: `${key}:d`, tone: tone ? 0.55 : 0, z, a11y: false, mt: 12 }),
        ])
        : row([
          icon({ key: `${key}:i`, name: s.icon, cell: 5, tone, z }),
          { ...text(s.title, S.h3, { key: `${key}:t`, tone, z, a11y: false }), basis: 300 },
          { ...text(s.text, S.body, { key: `${key}:d`, tone: tone ? 0.55 : 0, z, a11y: false }), grow: true },
        ], { gap: S.sp(2), valign: 'center' })),
    });
  });
  return col([
    pageHead(S, 'SERVICES', "COME IN, LET'S TALK WORK.", {
      h1: 'Services — interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO',
      intro: "By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements — project work, retainers and long partnerships. Leiden-based, working with teams across the EU and further afield. For rates, get in touch and I'll give you a straight answer.",
    }),
    { ...rule({ key: 'svc-rule' }), mt: S.sp(6) },
    ...rows,
    maxw(720, text(onRequest.text, S.body, { key: 'svc-extra', tone: 0.55, mt: S.sp(4) })),
    row([
      button({ key: 'svc-contact', label: 'GET IN TOUCH', arrow: '→', href: '/contact/', hover: hv('svc-contact') }),
      button({ key: 'svc-cv', label: 'READ MY CV', href: '/cv/', hover: hv('svc-cv') }),
    ], { gap: 8, wrap: true, mt: S.sp(5) }),
  ]);
}

function aboutPage(state, S) {
  const hv = (k) => state.hover === k;
  const bio = col([
    ...about.bio.map((b, i) => text(b, S.body, { key: `about-${i}`, mt: i ? S.sp(2) : 0 })),
    row([button({ key: 'about-cv', label: 'READ MY CV', arrow: '→', href: '/cv/', hover: hv('about-cv') })], { mt: S.sp(3) }),
  ]);
  const { alt, style, cell, gamma, ...spec } = site.portrait;
  const portrait = image({ key: 'hero-image', spec, style, cell, gamma, aspect: 1.3, dark: state.theme === 'dark', alt });
  const top = S.mobile
    ? col([bio, { ...portrait, mt: S.sp(4) }])
    : row([{ ...maxw(600, bio), grow: true }, { ...portrait, basis: S.tablet ? 260 : 360 }], { gap: S.sp(5) });

  const statCells = stats.map((s, i) => col([
    text(s.value, S.h1, { key: `stat-v-${i}`, label: `${s.value} ${s.label.toLowerCase()}` }),
    text(s.label, S.small, { key: `stat-l-${i}`, mt: S.sp(1), a11y: false }),
  ]));
  const items = principles.map((p, i) => col([
    icon({ key: `pr-icon-${i}`, name: p.icon, cell: 6, phase: 0.3 + i * 0.8 }),
    text(p.title, S.h3, { key: `pr-title-${i}`, tag: 'h3', mt: S.sp(2) }),
    text(p.text, S.body, { key: `pr-text-${i}`, mt: S.sp(1) }),
  ]));

  return col([
    pageHead(S, 'ABOUT', 'WHERE CREATIVITY MEETS IMPACT.', { h1: `About ${site.fullName} — where creativity meets impact` }),
    { ...top, mt: S.sp(6) },
    { ...grid(statCells, { cols: S.mobile ? 2 : 4, gap: S.sp(3), rowGap: S.sp(4) }), mt: S.sp(8) },
    maxw(900, text(about.quote, S.h2, { key: 'about-quote', mt: S.sp(10), tag: 'blockquote' })),
    ...section(S, 'pr', 'CREATIVITY · CRAFT · IMPACT'),
    { ...grid(items, { cols: S.mobile ? 1 : 3, gap: S.sp(4), rowGap: S.sp(5) }), mt: S.sp(4) },
    ...section(S, 'story', 'MY STORY'),
    storyTeaser(state, S, story.about),
  ]);
}

function cvPage(state, S) {
  const hv = (k) => state.hover === k;
  const PW = S.mobile ? 110 : 224; // period column
  const entries = experience.map((e) => {
    const key = `exp-${e.id}`;
    const open = state.expanded.has(e.id);
    const head = pressRow({
      key, action: `toggle:${e.id}`, hover: hv(key), label: `${e.role}, ${e.org} (${e.period.toLowerCase()})`, expanded: open, rule: false,
      content: (tone, z) => row([
        { ...text(e.period, S.small, { key: `${key}:p`, tone: tone ? 0.55 : 0, z, a11y: false }), basis: PW },
        { ...col([
          text(UP(e.role), S.h3, { key: `${key}:r`, tone, z, a11y: false }),
          S.mobile ? text(e.org, S.small, { key: `${key}:o`, tone: tone ? 0.55 : 0, z, a11y: false, mt: 8 }) : null,
        ]), grow: true },
        S.mobile ? null : text(e.org, S.body, { key: `${key}:o2`, tone, z, a11y: false }),
        text(open ? '−' : '+', S.h2, { key: `${key}:t`, tone, z, a11y: false, motion: 'icon' }),
      ], { gap: S.sp(2), valign: 'center' }),
    });
    const body = open
      ? col([
        text(`${e.place}. ${e.summary}`, S.body, { key: `${key}:sum` }),
        ...e.points.map((pt, j) => row([
          text('→', S.body, { key: `${key}:b${j}`, a11y: false }),
          { ...text(pt, S.body, { key: `${key}:pt${j}` }), grow: true },
        ], { gap: 12, mt: j ? 10 : S.sp(2) })),
        text(e.tags, S.small, { key: `${key}:tags`, mt: S.sp(2) }),
      ])
      : null;
    return col([
      head,
      body ? { ...row([space(0), { ...maxw(760, body), grow: true }], { gap: S.mobile ? 12 : PW + S.sp(2) + 12 }), mt: S.sp(1) } : null,
      { ...rule({ key: `${key}:rule` }), mt: open ? S.sp(3) : 0 },
    ]);
  });

  const edu = education.map((e, i) => row([
    { ...text(e.period, S.small, { key: `edu-p-${i}` }), basis: S.mobile ? 110 : PW + 12 },
    { ...col([text(UP(e.title), S.h3, { key: `edu-t-${i}`, tag: 'h3' }), text(e.org, S.body, { key: `edu-o-${i}`, mt: 10, tone: 0.55 })]), grow: true },
  ], { gap: S.sp(2), mt: S.sp(3) }));

  const sk = skills.map((g, i) => col([
    text(g.group, S.small, { key: `sk-g-${i}`, tag: 'h3' }),
    text(g.items.join('\n'), S.body, { key: `sk-i-${i}`, label: g.items.join(', '), mt: S.sp(1) }),
  ]));

  return col([
    pageHead(S, 'CURRICULUM VITAE', UP(cv.title), {
      titleKey: 'page-title',
      h1: `${site.fullName} — CV: ${cv.title}`,
      intro: cv.summary,
    }),
    text(`${UP(site.location)} · OPEN TO EU & GLOBAL ENGAGEMENTS`, S.small, { key: 'cv-loc', mt: S.sp(2) }),
    row([
      button({ key: 'cv-print', label: 'PRINT / SAVE AS PDF', action: 'print', hover: hv('cv-print') }),
      button({ key: 'cv-li', label: 'LINKEDIN', arrow: '↗', href: site.linkedin, external: true, hover: hv('cv-li') }),
    ], { gap: 8, wrap: true, mt: S.sp(3) }),
    ...section(S, 'exp', 'EXPERIENCE', { mt: S.sp(8) }),
    ...entries,
    ...section(S, 'edu', 'EDUCATION', { mt: S.sp(8) }),
    ...edu,
    ...section(S, 'sk', 'SKILLS', { mt: S.sp(8) }),
    { ...grid(sk, { cols: S.mobile ? 2 : 4, gap: S.sp(2), rowGap: S.sp(4) }), mt: S.sp(3) },
    ...section(S, 'avail', 'OPEN TO COLLABORATION', { mt: S.sp(8) }),
    maxw(720, text(cv.available, S.body, { key: 'cv-avail', mt: S.sp(3) })),
    row([button({ key: 'cv-contact', label: 'GET IN TOUCH', arrow: '→', href: '/contact/', hover: hv('cv-contact') })], { mt: S.sp(3) }),
  ]);
}

function contact(state, S) {
  const hv = (k) => state.hover === k;
  const big = S.mobile ? { size: 3, lh: 10 } : S.h2;
  const primary = site.email
    ? [
      { ...link({ key: 'email', label: UP(site.email), href: `mailto:${site.email}`, style: big, hover: hv('email'), aria: `Email ${site.email}` }), mt: S.sp(6) },
      row([
        button({ key: 'copy', label: state.copied ? 'COPIED ✓' : 'COPY EMAIL', action: 'copy', hover: hv('copy'), active: state.copied }),
        button({ key: 'li', label: 'LINKEDIN', arrow: '↗', href: site.linkedin, external: true, hover: hv('li') }),
      ], { gap: 8, wrap: true, mt: S.sp(3) }),
    ]
    : [
      { ...link({ key: 'li-big', label: 'SAY HELLO ON LINKEDIN', href: site.linkedin, external: true, style: big, hover: hv('li-big'), aria: 'Message JP on LinkedIn' }), mt: S.sp(6) },
      row([
        button({ key: 'li', label: 'MESSAGE ME', arrow: '↗', href: site.linkedin, external: true, hover: hv('li') }),
        button({ key: 'svc', label: 'SERVICES', href: '/services/', hover: hv('svc') }),
      ], { gap: 8, wrap: true, mt: S.sp(3) }),
    ];
  return col([
    pageHead(S, 'CONTACT', 'PASS THROUGH. SAY HELLO.', {
      h1: `Contact ${site.fullName}`,
      intro: 'A project, a partnership or a thoughtful question — my inbox is genuinely open. No newsletters, no CRM. Just a quiet, real conversation.',
    }),
    ...primary,
    text('BASED IN LEIDEN (CET) · USUALLY BACK WITHIN A DAY · EU & GLOBAL', S.small, { key: 'loc', mt: S.sp(4) }),
    ...section(S, 'links', 'ELSEWHERE'),
    ...links.map((l, i) => {
      const key = `ext-${i}`;
      return pressRow({
        key, href: l.href, external: true, hover: hv(key), label: l.label,
        content: (tone, z) => row([
          text(l.label, S.h3, { key: `${key}:l`, tone, z, a11y: false }),
          text('↗', S.body, { key: `${key}:a`, tone, z, a11y: false }),
        ], { justify: 'between', valign: 'center' }),
      });
    }),
  ]);
}

function menu(state, S) {
  const hv = (k) => state.hover === k;
  return col([
    label('MENU', { key: 'page-eyebrow' }),
    { ...rule({ key: 'menu-rule' }), mt: S.sp(2) },
    ...[{ label: 'HOME', href: '/' }, ...NAV].map((n) => {
      const key = `menu-${n.label}`;
      return pressRow({
        key, href: n.href, hover: hv(key), label: n.label, padY: 18,
        content: (tone, z) => row([
          text(n.label, S.h1, { key: `${key}:l`, tone, z, a11y: false }),
          text('→', S.h2, { key: `${key}:a`, tone, z, a11y: false }),
        ], { justify: 'between', valign: 'center' }),
      });
    }),
  ]);
}

// ---------------------------------------------------------------- colophon

/** A colour sample: paper is an empty frame, ink and the light are solid blocks. */
function swatch(key, tone, size) {
  return custom((w, ctx) => {
    const q = Math.min(size, Math.floor(w / 4) * 4);
    const blocks = tone === 0 ? frameBlocks(q, q) : fillBlocks(q, q, 4, 0, tone);
    return { w: q, h: q, els: [ctx.el({ key, sig: `sw|${tone}|${q}`, w: q, h: q, blocks })] };
  });
}

/** One frame of the logo, held still in a box. */
function markFrame(k, cell) {
  return custom((w, ctx) => {
    const f = iconFrames('logo', cell);
    const pad = cell * 2, W = f.w + pad * 2, H = f.h + pad * 2;
    const ic = ctx.el({ key: `cf-mark-${k}`, sig: `mark|${k}|${cell}`, w: f.w, h: f.h, blocks: f.frames[k], motion: 'icon' });
    ic.x = pad; ic.y = pad;
    return { w: W, h: H, els: [ctx.el({ key: `cf-mark-${k}:frame`, sig: `frame|${W}|${H}`, w: W, h: H, blocks: frameBlocks(W, H) }), ic] };
  });
}

function colophonPage(state, S) {
  const hv = (k) => state.hover === k;
  const C = colophon;
  const para = (str, key) => maxw(720, text(str, S.body, { key, mt: S.sp(3) }));
  const q = S.mobile ? 64 : 88;
  const sample = (key, tone, name, lines) => col([
    swatch(key, tone, q),
    text(name, S.label, { key: `${key}:n`, mt: S.sp(1) }),
    text(lines.join('\n'), S.small, { key: `${key}:h`, mt: 6 }),
  ]);
  const D = THEMES.dark;
  const scale = S.mobile ? [2, 3, 4, 6] : [2, 4, 6, 8];
  const files = C.downloads.map((d, i) => {
    const key = `dl-${i}`;
    return pressRow({
      key, href: d.href, download: true, hover: hv(key), label: `Download ${d.label.toLowerCase()} (${d.kind})`,
      content: (tone, z) => row([
        { ...text(d.label, S.h3, { key: `${key}:l`, tone, z, a11y: false }), grow: true },
        S.mobile ? null : text(d.kind, S.small, { key: `${key}:k`, tone: tone ? 0.55 : 0, z, a11y: false }),
        text('↓', S.body, { key: `${key}:a`, tone, z, a11y: false }),
      ], { gap: S.sp(2), valign: 'center' }),
    });
  });
  return col([
    pageHead(S, 'COLOPHON', 'HOW THIS SITE IS MADE.', { h1: 'Colophon — how this site is made', intro: C.intro }),

    ...section(S, 'colour', 'COLOUR'),
    para(C.colour, 'cf-colour'),
    { ...grid([
      sample('sw-paper', 0, 'PAPER', [UP(THEMES.light.bg), `DARK ${UP(D.bg)}`]),
      sample('sw-ink', 1, 'INK', [UP(THEMES.light.fg), `DARK ${UP(D.fg)}`]),
    ], { cols: S.mobile ? 2 : 7, gap: S.sp(2) }), mt: S.sp(4) },
    { ...grid(SPECTRUM.map((h, k) => sample(`sw-${k}`, 2 + k, COLOURS[k], [UP(h)])), { cols: S.mobile ? 3 : 7, gap: S.sp(2), rowGap: S.sp(3) }), mt: S.sp(4) },

    ...section(S, 'type', 'TYPE'),
    para(C.type, 'cf-type'),
    col(C.specimen.map((l, i) => text(l, S.mobile ? S.body : S.h2, { key: `cf-spec-${i}`, mt: i ? S.sp(1) : 0 })), { mt: S.sp(4) }),
    { ...row(scale.map((size) => col([
      text('Aa', { size, lh: 10 }, { key: `cf-aa-${size}`, a11y: false }),
      text(`${size * 10}PX`, S.small, { key: `cf-aa-${size}:l`, mt: S.sp(1) }),
    ])), { gap: S.sp(4), valign: 'bottom', wrap: true, rowGap: S.sp(3) }), mt: S.sp(4) },

    ...section(S, 'mark', 'THE MARK'),
    para(C.mark, 'cf-mark'),
    { ...grid(C.frames.map((f, k) => col([
      markFrame(k, S.mobile ? 6 : 8),
      text(f.label, S.label, { key: `cf-frame-${k}`, mt: S.sp(2) }),
      text(f.text, S.body, { key: `cf-frame-${k}:t`, tone: 0.55, mt: 6 }),
    ])), { cols: S.mobile ? 2 : 5, gap: S.sp(2), rowGap: S.sp(4) }), mt: S.sp(4) },

    ...section(S, 'motion', 'MOTION AND LIGHT'),
    para(C.motion, 'cf-motion'),

    ...section(S, 'build', "HOW IT'S BUILT"),
    col(C.build.map((b, i) => row([
      text('→', S.body, { key: `cf-build-${i}:a`, a11y: false }),
      { ...maxw(720, text(b, S.body, { key: `cf-build-${i}` })), grow: true },
    ], { gap: 12, mt: i ? S.sp(2) : 0 })), { mt: S.sp(3) }),
    row([button({ key: 'cf-story', label: 'WATCH THE ADVENTURER', arrow: '→', href: story.href, hover: hv('cf-story'), aria: 'Watch The Adventurer, a short animated story with sound' })], { mt: S.sp(4) }),

    ...section(S, 'files', 'DOWNLOADS'),
    ...files,
  ]);
}

// 404: a small Baba Is You-style puzzle (src/puzzle.js), with a plain way out.
function notFound(state, S) {
  const hv = (k) => state.hover === k;
  const st = puzzle.status();
  const intro = [
    label('LOST ON THE PATH', { key: 'page-eyebrow' }),
    text('404', S.display, { key: 'page-title', tag: 'h1', label: 'Page not found', mt: S.sp(2) }),
    text('THIS PAGE GOT LOST.', S.h2, { key: 'page-intro', mt: S.sp(3) }),
    maxw(480, text('Everything on this site is made of blocks, the rules included. Push the words around until the page finds its way home.', S.body, { key: 'pz-how', mt: S.sp(3) })),
  ];
  const help = [
    text(state.touch ? 'SWIPE ON THE BOARD TO MOVE' : 'ARROW KEYS OR WASD TO MOVE · Z UNDO · R RESTART', S.small, { key: 'pz-keys', mt: S.sp(3) }),
    row([
      button({ key: 'pz-undo', label: 'UNDO', small: true, action: 'pz:undo', hover: hv('pz-undo') }),
      button({ key: 'pz-restart', label: 'RESTART', small: true, action: 'pz:restart', hover: hv('pz-restart') }),
    ], { gap: 8, mt: S.sp(2) }),
    row([button({ key: 'home', label: 'OR JUST GO HOME', arrow: '→', href: '/', hover: hv('home') })], { mt: S.sp(4) }),
  ];
  const play = col([
    board({ key: 'pz', label: 'Puzzle board. You are JP. Arrow keys move you and push the words; a line of words such as PAGE IS LOST is a rule.' }),
    text(st.text, S.small, { key: 'pz-status', tone: st.tone, attrs: { 'aria-live': 'polite' }, mt: S.sp(2) }),
  ]);
  if (S.mobile || S.tablet) return col([...intro, { ...play, mt: S.sp(4) }, ...help]);
  return row([{ ...col([...intro, ...help]), grow: true }, { ...play, basis: boardWidth(1e4) }], { gap: S.sp(6) });
}

const PAGES = { home, work, project, services: servicesPage, about: aboutPage, cv: cvPage, contact, colophon: colophonPage, notFound, roadbook: roadbookPage, garden: gardenPage };

export function buildScene(state, vp) {
  const S = tokens(vp.w);
  const ctx = new Ctx(state.menuOpen ? 'menu' : state.route.name + (state.route.slug || ''), state);

  const nav = layout(navBar(state, S), S.cw, ctx);
  shift(nav.els, S.left, S.navTop);
  for (const e of nav.els) e.fixed = true;

  // The story plays itself under the nav (src/story/player.js), on blocks of
  // its own; the page only holds its picture while morphing into it
  // (state.storyEls, at rest, in screen px). Full screen, not even the nav.
  if (state.route.name === 'story' && !state.menuOpen) {
    const pic = (state.storyEls || []).map((e) => ({ ...e }));
    return { elements: resolve([...(state.fullscreen ? [] : nav.els), ...pic]), height: vp.h, S };
  }

  const pageNode = state.menuOpen ? menu(state, S) : PAGES[state.route.name](state, S, state.route.slug);
  const page = layout(pageNode, S.cw, ctx);
  const top = S.navClip + S.top;
  shift(page.els, S.left, top);

  // The garden is one screen: its heading, then the ground and pots down to
  // the toolbar, and no footer. `beds` tell garden/mode.js where the soil goes.
  if (state.route.name === 'garden' && !state.menuOpen) {
    const bar = state.garden ? gardenBand(state, S, ctx, vp) : { els: [], top: vp.h };
    const ground = gardenBed(S, ctx, top + page.h, bar.top);
    const lesson = gardenLesson(state, S, ctx, bar, top + page.h + 8);
    return {
      elements: resolve([...nav.els, ...page.els, ...ground.els, ...bar.els, ...lesson.els]),
      height: vp.h, S, gardenTop: bar.top, beds: ground.beds, gardenHole: lesson.hole,
    };
  }

  const count = (els) => els.reduce((n, e) => n + e.blocks.length / 5, 0);
  const approx = count(nav.els) + count(page.els) + 900;
  const foot = layout(footer(state, S, Math.round(approx / 10) * 10), S.cw, ctx);
  const fy = Math.max(top + page.h + S.sp(10), vp.h - foot.h - S.sp(3));
  shift(foot.els, S.left, fy);

  const elements = resolve([...nav.els, ...page.els, ...foot.els]);
  return { elements, height: fy + foot.h + S.sp(3), S };
}
