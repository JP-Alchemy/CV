import { Ctx, layout, resolve, shift, text, col, row, grid, space, custom, maxw, even } from './engine/layout.js';
import { tokens, label, rule, button, link, image, icon, hitArea, pressRow, frameBlocks, fillBlocks, solidLine, section } from './ui.js';
import { iconFrames } from './icons.js';
import { typeset } from './engine/typeset.js';
import { roadbookPage } from './roadbook.js';
import { puzzle, board, boardWidth } from './puzzle.js';
import { COLOURS, PRIMARY } from './garden/sim.js';
import {
  site, links, projects, services, onRequest, about, principles, stats, cv, experience, education, skills,
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
  const left = [
    logoBox(),
    button({ key: 'nav-name', label: site.name, href: '/', small: true, hover: hv('nav-name'), aria: 'Home' }),
  ];
  if (!S.mobile && !S.tablet) left.push(button({ key: 'nav-tag', label: 'CREATIVE TECHNOLOGIST', href: '/about/', small: true, hover: hv('nav-tag'), aria: 'About JP' }));
  const theme = button({
    key: 'nav-theme', label: 'THEME', icon: state.theme === 'dark' ? 'dark' : 'light', small: true, width: 36,
    action: 'theme', hover: false, aria: state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  });
  const garden = button({
    key: 'nav-garden', label: 'GARDEN', icon: 'garden', small: true, width: 36, action: 'garden', hover: false, active: !!state.garden,
    aria: state.garden ? 'Leave garden mode (G)' : 'Garden mode: grow the spectrum (G)', period: 1.6,
  });
  const right = S.mobile
    ? [button({ key: 'nav-menu', label: state.menuOpen ? 'CLOSE' : 'MENU', action: 'menu', small: true, hover: hv('nav-menu'), active: state.menuOpen, aria: state.menuOpen ? 'Close menu' : 'Open menu' }), garden, theme]
    : [...NAV.map((n) => button({ key: `nav-${n.label}`, label: n.label, href: n.href, small: true, hover: hv(`nav-${n.label}`), active: n.match.includes(name) })), garden, theme];
  return row([row(left, { gap: 4 }), row(right, { gap: 4 })], { justify: 'between' });
}

function footer(state, S, count) {
  const hv = (k) => state.hover === k;
  const made = `THIS PAGE IS MADE OF ${count.toLocaleString('en-US')} BLOCKS`;
  const items = [
    text(`© 2026 ${UP(site.fullName)} · LEIDEN, NL`, S.small, { key: 'foot-copy' }),
    text(made, S.small, { key: 'foot-count', a11y: false }),
    link({ key: 'foot-top', label: 'BACK TO TOP ↑', action: 'top', hover: hv('foot-top'), aria: 'Back to top' }),
  ];
  return col([
    rule({ key: 'foot-rule' }),
    S.mobile ? col(items, { gap: 14, mt: 20 }) : row(items, { justify: 'between', mt: 20 }),
  ]);
}

// ---------------------------------------------------------------- garden mode

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

/** Garden mode's toolbar: tools, the spectrum's seeds, and what to do next. */
function gardenBar(state, S) {
  const v = state.garden;
  const hv = (k) => state.hover === k;
  const tools = v.tools.map((t) => button({ key: `gd-tool-${t}`, label: t.toUpperCase(), small: true, action: `gd:tool:${t}`, active: v.tool === t, pressed: v.tool === t, hover: hv(`gd-tool-${t}`) }));
  const done = button({ key: 'gd-done', label: 'LEAVE', arrow: '→', small: true, action: 'garden', hover: hv('gd-done'), aria: 'Leave garden mode' });
  const chips = row(COLOURS.map((_, k) => seedChip(v, k, hv)), { gap: S.mobile ? 4 : 6 });
  const hint = text(v.hint, S.small, { key: 'gd-hint', tone: 1, attrs: { 'aria-live': 'polite' } });
  if (S.mobile) {
    return col([row([...tools, done], { gap: 4, wrap: true, rowGap: 4 }), { ...chips, mt: 10 }, { ...hint, mt: 2 }]);
  }
  return col([
    row([row(tools, { gap: 4 }), done], { justify: 'between' }),
    { ...row([chips, { ...hint, grow: true }], { gap: 20 }), mt: 12 },
  ]);
}

// ---------------------------------------------------------------- pieces

function pageHead(S, eyebrow, title, o = {}) {
  return col([
    label(eyebrow, { key: 'page-eyebrow' }),
    text(title, S.h1, { key: o.titleKey || 'page-title', tag: 'h1', label: o.h1, mt: S.sp(2) }),
    o.intro ? maxw(640, text(o.intro, S.body, { key: 'page-intro', mt: S.sp(2) })) : null,
  ]);
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
    ...section(S, 'hire', 'WORK WITH ME'),
    maxw(640, text('By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements: interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO work.', S.body, { key: 'hire-text', mt: S.sp(3) })),
    { ...link({ key: 'hire-link', label: 'SERVICES & RATES →', href: '/services/', hover: hv('hire-link') }), mt: S.sp(3) },
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
      key, href: '/contact/', hover: hv(key), label: `${s.name} — ${s.rate.toLowerCase()}. ${s.text}`, padY: 22,
      content: (tone, z) => (S.mobile
        ? col([
          row([icon({ key: `${key}:i`, name: s.icon, cell: 4, tone, z }), text(s.title, S.h3, { key: `${key}:t`, tone, z, a11y: false })], { gap: 12, valign: 'center' }),
          text(s.text, S.body, { key: `${key}:d`, tone: tone ? 0.55 : 0, z, a11y: false, mt: 12 }),
          text(s.rate, S.small, { key: `${key}:r`, tone, z, a11y: false, mt: 12 }),
        ])
        : row([
          icon({ key: `${key}:i`, name: s.icon, cell: 5, tone, z }),
          { ...text(s.title, S.h3, { key: `${key}:t`, tone, z, a11y: false }), basis: 300 },
          { ...text(s.text, S.body, { key: `${key}:d`, tone: tone ? 0.55 : 0, z, a11y: false }), grow: true },
          { ...text(s.rate, S.small, { key: `${key}:r`, tone, z, a11y: false, align: 'right' }), basis: 150 },
        ], { gap: S.sp(2), valign: 'center' })),
    });
  });
  return col([
    pageHead(S, 'SERVICES & RATES', "COME IN, LET'S TALK WORK.", {
      h1: 'Services — interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO',
      intro: 'By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements — project work, retainers and long partnerships. Leiden-based, working with teams across the EU and further afield.',
    }),
    { ...rule({ key: 'svc-rule' }), mt: S.sp(6) },
    ...rows,
    maxw(720, text(`${onRequest.text.replace(/\.$/, '')} — ${onRequest.rate.toLowerCase()}.`, S.body, { key: 'svc-extra', tone: 0.55, mt: S.sp(4) })),
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
    ...section(S, 'avail', 'CURRENTLY AVAILABLE', { mt: S.sp(8) }),
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
        button({ key: 'svc', label: 'SERVICES & RATES', href: '/services/', hover: hv('svc') }),
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

const PAGES = { home, work, project, services: servicesPage, about: aboutPage, cv: cvPage, contact, notFound, roadbook: roadbookPage };

export function buildScene(state, vp) {
  const S = tokens(vp.w);
  const ctx = new Ctx(state.menuOpen ? 'menu' : state.route.name + (state.route.slug || ''), state);

  const nav = layout(navBar(state, S), S.cw, ctx);
  shift(nav.els, S.left, S.navTop);
  for (const e of nav.els) e.fixed = true;

  const pageNode = state.menuOpen ? menu(state, S) : PAGES[state.route.name](state, S, state.route.slug);
  const page = layout(pageNode, S.cw, ctx);
  const top = S.navClip + S.top;
  shift(page.els, S.left, top);

  const count = (els) => els.reduce((n, e) => n + e.blocks.length / 5, 0);
  const approx = count(nav.els) + count(page.els) + 900;
  const foot = layout(footer(state, S, Math.round(approx / 10) * 10), S.cw, ctx);
  const fy = Math.max(top + page.h + S.sp(10), vp.h - foot.h - S.sp(3));
  shift(foot.els, S.left, fy);

  // Garden mode: a toolbar pinned to the bottom, on a paper-coloured band.
  const bar = [];
  let gardenTop = vp.h;
  if (state.garden) {
    const b = layout(gardenBar(state, S), S.cw, ctx);
    const pad = S.mobile ? 12 : 16, bandH = b.h + pad * 2;
    gardenTop = vp.h - bandH;
    shift(b.els, S.left, gardenTop + pad);
    const band = ctx.el({ key: 'gd-band', sig: `gdb|${vp.w}|${bandH}`, w: vp.w, h: bandH, blocks: fillBlocks(vp.w, bandH, 4, 0, 0), flat: true });
    const edge = ctx.el({ key: 'gd-edge', sig: `gde|${vp.w}`, w: vp.w, h: 2, blocks: solidLine(vp.w) });
    band.y = gardenTop;
    edge.y = gardenTop;
    for (const e of b.els) e.z = (e.z || 0) + 4;
    band.z = 3;
    edge.z = 4;
    bar.push(band, edge, ...b.els);
    for (const e of bar) e.fixed = true;
  }

  const elements = resolve([...nav.els, ...page.els, ...foot.els, ...bar]);
  return { elements, height: fy + foot.h + S.sp(3), S, gardenTop };
}
