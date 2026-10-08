import { Ctx, layout, resolve, shift, text, col, row, grid, space, custom, maxw, even } from './engine/layout.js';
import { tokens, label, rule, button, link, image, icon, hitArea, pressRow, frameBlocks } from './ui.js';
import { iconFrames } from './icons.js';
import { site, projects, principles, experience, education, skills } from './content.js';

const pad2 = (i) => String(i + 1).padStart(2, '0');

// ---------------------------------------------------------------- navigation

const NAV = [
  { label: 'WORK', href: '#/work', match: ['work', 'project'] },
  { label: 'ABOUT', href: '#/about', match: ['about'] },
  { label: 'CV', href: '#/cv', match: ['cv'] },
  { label: 'CONTACT', href: '#/contact', match: ['contact'] },
];

function logoBox(state) {
  return custom((w, ctx) => {
    const W = 44, H = 36;
    const f = iconFrames('logo', 4);
    const els = [
      ctx.el({ key: 'nav-logo:frame', sig: `frame|${W}|${H}`, w: W, h: H, blocks: frameBlocks(W, H) }),
    ];
    const ic = ctx.el({ key: 'nav-logo:icon', sig: 'icon|logo|4', w: f.w, h: f.h, blocks: f.frames[0], motion: 'icon', anim: { frames: f.frames, period: 2.2, phase: 1.6 } });
    ic.x = even((W - f.w) / 2); ic.y = even((H - f.h) / 2);
    els.push(ic);
    els.push(ctx.el({ key: 'nav-logo', w: W, h: H, hit: { href: '#/', label: `${site.name} — home` } }));
    return { w: W, h: H, els };
  });
}

function navBar(state, S) {
  const hv = (k) => state.hover === k;
  const name = state.route.name;
  const left = [
    logoBox(state),
    button({ key: 'nav-name', label: site.name, href: '#/', small: true, hover: hv('nav-name'), aria: 'Home' }),
  ];
  if (!S.mobile && !S.tablet) left.push(button({ key: 'nav-tag', label: 'PORTFOLIO ’26', href: '#/', small: true, hover: hv('nav-tag'), aria: 'Home' }));
  const theme = button({
    key: 'nav-theme', label: 'THEME', icon: state.theme === 'dark' ? 'dark' : 'light', small: true, width: 36,
    action: 'theme', hover: false, aria: state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  });
  const right = S.mobile
    ? [button({ key: 'nav-menu', label: state.menuOpen ? 'CLOSE' : 'MENU', action: 'menu', small: true, hover: hv('nav-menu'), active: state.menuOpen, aria: state.menuOpen ? 'Close menu' : 'Open menu' }), theme]
    : [...NAV.map((n) => button({ key: `nav-${n.label}`, label: n.label, href: n.href, small: true, hover: hv(`nav-${n.label}`), active: n.match.includes(name) })), theme];
  return row([row(left, { gap: 4 }), row(right, { gap: 4 })], { justify: 'between' });
}

function footer(state, S, count) {
  const hv = (k) => state.hover === k;
  const made = `THIS PAGE IS MADE OF ${count.toLocaleString('en-US')} BLOCKS`;
  const items = [
    text(`© 2026 ${site.fullName.toUpperCase()}`, S.small, { key: 'foot-copy' }),
    text(made, S.small, { key: 'foot-count', a11y: false }),
    link({ key: 'foot-top', label: 'BACK TO TOP ↑', action: 'top', hover: hv('foot-top'), aria: 'Back to top' }),
  ];
  return col([
    rule({ key: 'foot-rule' }),
    S.mobile ? col(items, { gap: 14, mt: 20 }) : row(items, { justify: 'between', mt: 20 }),
  ]);
}

// ---------------------------------------------------------------- pages

function pageHead(S, eyebrow, title, o = {}) {
  return col([
    label(eyebrow, { key: 'page-eyebrow' }),
    text(title, S.h1, { key: o.titleKey || 'page-title', tag: 'h1', mt: S.sp(2) }),
    o.intro ? maxw(620, text(o.intro, S.body, { key: 'page-intro', mt: S.sp(2) })) : null,
  ]);
}

function home(state, S) {
  const hv = (k) => state.hover === k;
  const intro = col([
    label('PORTFOLIO — 2026', { key: 'page-eyebrow' }),
    text("HI, I'M JP.", S.display, { key: 'page-title', tag: 'h1', mt: S.sp(2) }),
    text(site.role.toUpperCase() + '.', S.h2, { key: 'home-role', mt: S.sp(2) }),
    maxw(560, text(site.intro, S.body, { key: 'page-intro', mt: S.sp(2) })),
    row([
      button({ key: 'cta-work', label: 'VIEW WORK', arrow: '→', href: '#/work', hover: hv('cta-work') }),
      button({ key: 'cta-contact', label: 'GET IN TOUCH', href: '#/contact', hover: hv('cta-contact') }),
    ], { gap: 8, wrap: true, mt: S.sp(3) }),
  ]);
  const heroImg = image({ key: 'hero-image', spec: { kind: 'orb' }, aspect: 1, cell: S.mobile ? 6 : 8, dark: state.theme === 'dark', alt: 'A halftone sphere with a ring' });
  const hero = S.mobile
    ? col([intro, { ...heroImg, mt: S.sp(5) }])
    : row([{ ...intro, grow: true }, { ...heroImg, basis: S.tablet ? 300 : 440 }], { gap: S.sp(4), valign: 'center' });

  const rows = projects.slice(0, 4).map((p, i) => {
    const key = `row-${p.slug}`;
    return pressRow({
      key, href: `#/work/${p.slug}`, hover: hv(key), label: `${p.title} — ${p.summary}`,
      content: (tone, z) => row([
        text(pad2(i), S.small, { key: `${key}:n`, tone: tone ? 0.55 : 0, z, a11y: false, basis: 40 }),
        { ...text(p.title, S.h3, { key: `title:${p.slug}`, tone, z, a11y: false }), basis: S.mobile ? 140 : 220 },
        S.mobile ? null : { ...text(p.summary, S.body, { key: `${key}:s`, tone: tone ? 0.55 : 0, z, a11y: false, nowrap: true }), grow: true },
        S.mobile ? { ...space(0), grow: true } : null,
        text(p.year, S.small, { key: `${key}:y`, tone: tone ? 0.55 : 0, z, a11y: false }),
        text('→', S.body, { key: `${key}:a`, tone, z, a11y: false }),
      ], { gap: S.sp(1) * 2, valign: 'center' }),
    });
  });

  const now = site.now.map((n, i) => row([
    icon({ key: `now-icon-${i}`, name: n.icon, cell: 4, phase: 0.4 + i * 0.7 }),
    { ...text(n.text, S.body, { key: `now-${i}` }), grow: true },
  ], { gap: S.sp(2), valign: 'center', mt: i ? S.sp(2) : S.sp(3) }));

  return col([
    hero,
    label('SELECTED WORK', { key: 'sec-work', mt: S.sp(10) }),
    { ...rule({ key: 'sec-work-rule' }), mt: S.sp(2) },
    ...rows,
    { ...link({ key: 'all-work', label: 'ALL PROJECTS →', href: '#/work', hover: hv('all-work') }), mt: S.sp(3) },
    label('CURRENTLY', { key: 'sec-now', mt: S.sp(10) }),
    ...now,
  ]);
}

function work(state, S) {
  const hv = (k) => state.hover === k;
  const cards = projects.map((p) => {
    const key = `card-${p.slug}`;
    const on = hv(key);
    return hitArea({ key, href: `#/work/${p.slug}`, label: `${p.title} — ${p.summary}` }, col([
      image({
        key: `img:${p.slug}`, spec: p.image, aspect: 0.62, dark: state.theme === 'dark',
        style: on ? 'dither' : 'halftone', cell: on ? 4 : 8, motion: 'hover', alt: `${p.title} cover`,
      }),
      row([
        text(p.title + (on ? ' →' : ''), S.h3, { key: `title:${p.slug}`, a11y: false, motion: 'hover' }),
        text(p.year, S.small, { key: `year:${p.slug}`, a11y: false }),
      ], { justify: 'between', mt: S.sp(2) }),
      text(p.summary, S.body, { key: `sum:${p.slug}`, tone: 0.55, a11y: false, mt: S.sp(1) }),
      text(p.tags.join(' · '), S.label, { key: `tags:${p.slug}`, a11y: false, mt: S.sp(1) }),
    ]));
  });
  return col([
    pageHead(S, 'WORK', 'SELECTED PROJECTS', { intro: 'A few things I have designed, engineered and shipped. Each one is drawn here as a field of blocks — hover to re-sample it.' }),
    { ...grid(cards, { cols: S.mobile ? 1 : 2, gap: S.sp(3), rowGap: S.sp(6) }), mt: S.sp(6) },
  ]);
}

function project(state, S, slug) {
  const hv = (k) => state.hover === k;
  const i = projects.findIndex((p) => p.slug === slug);
  if (i < 0) return notFound(state, S);
  const p = projects[i];
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const nxt = projects[(i + 1) % projects.length];
  const meta = [['YEAR', p.year], ['ROLE', p.role], ['STACK', p.stack]].map(([k, v], j) => col([
    text(k, S.small, { key: `meta-k-${j}` }),
    text(v, S.body, { key: `meta-v-${j}`, mt: 10 }),
  ]));
  return col([
    link({ key: 'back', label: '← ALL WORK', href: '#/work', hover: hv('back') }),
    text(p.title, S.h1, { key: `title:${p.slug}`, tag: 'h1', mt: S.sp(4) }),
    maxw(700, text(p.summary, S.h2, { key: 'page-intro', mt: S.sp(2) })),
    { ...grid(meta, { cols: S.mobile ? 1 : 3, gap: S.sp(2), rowGap: S.sp(2) }), mt: S.sp(4) },
    { ...image({ key: `img:${p.slug}`, spec: p.image, aspect: S.mobile ? 0.8 : 0.5, cell: S.mobile ? 6 : 8, dark: state.theme === 'dark', alt: `${p.title} cover` }), mt: S.sp(5) },
    maxw(680, col(p.body.map((para, j) => text(para, S.body, { key: `body-${j}`, mt: j ? S.sp(2) : 0 })), { mt: S.sp(5) })),
    text(p.tags.join(' · '), S.label, { key: 'tags', mt: S.sp(4) }),
    { ...rule({ key: 'proj-rule' }), mt: S.sp(6) },
    row([
      button({ key: 'prev', label: prev.title, arrow: '←', href: `#/work/${prev.slug}`, hover: hv('prev'), aria: `Previous project: ${prev.title}` }),
      button({ key: 'next', label: nxt.title, arrow: '→', href: `#/work/${nxt.slug}`, hover: hv('next'), aria: `Next project: ${nxt.title}` }),
    ], { justify: 'between', wrap: true, gap: 8, mt: S.sp(3) }),
  ]);
}

function about(state, S) {
  const hv = (k) => state.hover === k;
  const bio = col([
    text(site.intro, S.body, { key: 'about-1' }),
    text('Before software I studied computer science and spent a long time making things for the web, then for devices you can hold, then for screens you can walk around. The common thread is building tools that make complex systems feel simple.', S.body, { key: 'about-2', mt: S.sp(2) }),
    text(`${site.location}. ${site.availability}.`, S.body, { key: 'about-3', tone: 0.55, mt: S.sp(2) }),
    row([
      button({ key: 'about-cv', label: 'READ MY CV', arrow: '→', href: '#/cv', hover: hv('about-cv') }),
    ], { mt: S.sp(3) }),
  ]);
  const portrait = image({ key: 'hero-image', spec: { kind: 'portrait' }, aspect: 1.2, cell: S.mobile ? 6 : 8, dark: state.theme === 'dark', alt: 'Abstract halftone portrait' });
  const top = S.mobile
    ? col([bio, { ...portrait, mt: S.sp(4) }])
    : row([{ ...maxw(600, bio), grow: true }, { ...portrait, basis: S.tablet ? 260 : 360 }], { gap: S.sp(5) });

  const items = principles.map((p, i) => col([
    icon({ key: `pr-icon-${i}`, name: p.icon, cell: 6, phase: 0.3 + i * 0.8 }),
    text(p.title, S.h3, { key: `pr-title-${i}`, tag: 'h3', mt: S.sp(2) }),
    text(p.text, S.body, { key: `pr-text-${i}`, mt: S.sp(1) }),
  ]));

  return col([
    pageHead(S, 'ABOUT', 'I BUILD THINGS THAT FEEL ALIVE.'),
    { ...top, mt: S.sp(6) },
    label('PRINCIPLES', { key: 'sec-pr', mt: S.sp(10) }),
    { ...rule({ key: 'sec-pr-rule' }), mt: S.sp(2) },
    { ...grid(items, { cols: S.mobile ? 1 : 3, gap: S.sp(4), rowGap: S.sp(5) }), mt: S.sp(4) },
  ]);
}

function cv(state, S) {
  const hv = (k) => state.hover === k;
  const entries = experience.map((e) => {
    const key = `exp-${e.id}`;
    const open = state.expanded.has(e.id);
    const head = pressRow({
      key, action: `toggle:${e.id}`, hover: hv(key), label: `${e.role}, ${e.org}`, expanded: open, rule: false,
      content: (tone, z) => row([
        { ...text(e.period, S.small, { key: `${key}:p`, tone: tone ? 0.55 : 0, z, a11y: false }), basis: S.mobile ? 120 : 180 },
        { ...col([
          text(e.role.toUpperCase(), S.h3, { key: `${key}:r`, tone, z, a11y: false }),
          S.mobile ? text(e.org, S.small, { key: `${key}:o`, tone: tone ? 0.55 : 0, z, a11y: false, mt: 8 }) : null,
        ]), grow: true },
        S.mobile ? null : text(e.org, S.body, { key: `${key}:o2`, tone, z, a11y: false }),
        text(open ? '−' : '+', S.h2, { key: `${key}:t`, tone, z, a11y: false, motion: 'icon' }),
      ], { gap: S.sp(2), valign: 'center' }),
    });
    const body = open
      ? col([
        text(e.summary, S.body, { key: `${key}:sum` }),
        ...e.points.map((pt, j) => row([
          text('→', S.body, { key: `${key}:b${j}`, a11y: false }),
          { ...text(pt, S.body, { key: `${key}:pt${j}` }), grow: true },
        ], { gap: 12, mt: j ? 10 : S.sp(2) })),
      ], { mt: S.sp(2) })
      : null;
    return col([
      head,
      body ? { ...row([space(0), { ...body, grow: true }], { gap: S.mobile ? 12 : 180 + S.sp(2) + 12 }), mt: S.sp(1) } : null,
      { ...rule({ key: `${key}:rule` }), mt: open ? S.sp(3) : 0 },
    ]);
  });

  const edu = education.map((e, i) => row([
    { ...text(e.period, S.small, { key: `edu-p-${i}` }), basis: S.mobile ? 120 : 192 },
    { ...col([text(e.title.toUpperCase(), S.h3, { key: `edu-t-${i}`, tag: 'h3' }), text(e.org, S.body, { key: `edu-o-${i}`, mt: 10, tone: 0.55 })]), grow: true },
  ], { gap: S.sp(2), mt: S.sp(3) }));

  const sk = skills.map((g, i) => col([
    text(g.group, S.small, { key: `sk-g-${i}` }),
    text(g.items.join('\n'), S.body, { key: `sk-i-${i}`, mt: S.sp(1) }),
  ]));

  return col([
    pageHead(S, 'CURRICULUM VITAE', 'EXPERIENCE', { intro: 'Ten years across product studios, a hardware startup and an agency. Select a role to expand it.' }),
    { ...rule({ key: 'cv-top-rule' }), mt: S.sp(5) },
    ...entries,
    label('EDUCATION', { key: 'sec-edu', mt: S.sp(8) }),
    ...edu,
    label('SKILLS', { key: 'sec-sk', mt: S.sp(8) }),
    { ...grid(sk, { cols: S.mobile ? 2 : 4, gap: S.sp(2), rowGap: S.sp(4) }), mt: S.sp(3) },
    row([
      button({ key: 'cv-pdf', label: 'DOWNLOAD PDF', arrow: '↓', href: '/cv.pdf', hover: hv('cv-pdf'), external: true }),
      button({ key: 'cv-contact', label: 'GET IN TOUCH', href: '#/contact', hover: hv('cv-contact') }),
    ], { gap: 8, wrap: true, mt: S.sp(6) }),
  ]);
}

function contact(state, S) {
  const hv = (k) => state.hover === k;
  const emailStyle = S.mobile ? { size: 3, lh: 10 } : S.h2;
  return col([
    pageHead(S, 'CONTACT', "LET'S BUILD SOMETHING.", { intro: `${site.availability}. The fastest way to reach me is email — I reply within a couple of days.` }),
    { ...link({ key: 'email', label: site.email.toUpperCase(), href: `mailto:${site.email}`, style: emailStyle, hover: hv('email'), aria: `Email ${site.email}` }), mt: S.sp(6) },
    row([
      button({ key: 'copy', label: state.copied ? 'COPIED ✓' : 'COPY EMAIL', action: 'copy', hover: hv('copy'), active: state.copied }),
      button({ key: 'mail', label: 'OPEN MAIL', arrow: '↗', href: `mailto:${site.email}`, hover: hv('mail') }),
    ], { gap: 8, wrap: true, mt: S.sp(3) }),
    label('ELSEWHERE', { key: 'sec-links', mt: S.sp(10) }),
    { ...rule({ key: 'sec-links-rule' }), mt: S.sp(2) },
    ...site.links.map((l, i) => {
      const key = `ext-${i}`;
      return pressRow({
        key, href: l.href, external: true, hover: hv(key), label: l.label,
        content: (tone, z) => row([
          text(l.label, S.h3, { key: `${key}:l`, tone, z, a11y: false }),
          text('↗', S.body, { key: `${key}:a`, tone, z, a11y: false }),
        ], { justify: 'between', valign: 'center' }),
      });
    }),
    text(site.location.toUpperCase(), S.small, { key: 'loc', mt: S.sp(4) }),
  ]);
}

function menu(state, S) {
  const hv = (k) => state.hover === k;
  return col([
    label('MENU', { key: 'page-eyebrow' }),
    { ...rule({ key: 'menu-rule' }), mt: S.sp(2) },
    ...[{ label: 'HOME', href: '#/' }, ...NAV].map((n) => {
      const key = `menu-${n.label}`;
      return pressRow({
        key, href: n.href, hover: hv(key), label: n.label, padY: 20,
        content: (tone, z) => row([
          text(n.label, S.h1, { key: `${key}:l`, tone, z, a11y: false }),
          text('→', S.h2, { key: `${key}:a`, tone, z, a11y: false }),
        ], { justify: 'between', valign: 'center' }),
      });
    }),
  ]);
}

function notFound(state, S) {
  const hv = (k) => state.hover === k;
  return col([
    label('ERROR', { key: 'page-eyebrow' }),
    text('404', S.display, { key: 'page-title', tag: 'h1', mt: S.sp(2) }),
    text('THESE BLOCKS DID NOT ASSEMBLE INTO ANYTHING.', S.h2, { key: 'page-intro', mt: S.sp(3) }),
    row([button({ key: 'home', label: 'BACK HOME', arrow: '→', href: '#/', hover: hv('home') })], { mt: S.sp(4) }),
  ]);
}

const PAGES = { home, work, project, about, cv, contact, notFound };

export function pageTitle(route) {
  const p = route.name === 'project' && projects.find((x) => x.slug === route.slug);
  const t = { home: '', work: 'Work', about: 'About', cv: 'CV', contact: 'Contact', notFound: 'Not found' }[route.name];
  if (p) return `${p.title} — ${site.fullName}`;
  return t ? `${t} — ${site.fullName}` : site.title;
}

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

  const elements = resolve([...nav.els, ...page.els, ...foot.els]);
  return { elements, height: fy + foot.h + S.sp(3), S };
}
