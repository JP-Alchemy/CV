import { Ctx, layout, resolve, shift, text, col, row, grid, space, custom, maxw, even } from './engine/layout.js';
import { tokens, label, rule, button, link, image, icon, hitArea, pressRow, frameBlocks } from './ui.js';
import { iconFrames } from './icons.js';
import {
  site, links, projects, services, onRequest, about, principles, stats, cv, experience, education, skills,
} from './content.js';

const pad2 = (i) => String(i + 1).padStart(2, '0');
const UP = (s) => s.toUpperCase();

// ---------------------------------------------------------------- navigation

export const NAV = [
  { label: 'WORK', href: '/work/', match: ['work', 'project'] },
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
  const right = S.mobile
    ? [button({ key: 'nav-menu', label: state.menuOpen ? 'CLOSE' : 'MENU', action: 'menu', small: true, hover: hv('nav-menu'), active: state.menuOpen, aria: state.menuOpen ? 'Close menu' : 'Open menu' }), theme]
    : [...NAV.map((n) => button({ key: `nav-${n.label}`, label: n.label, href: n.href, small: true, hover: hv(`nav-${n.label}`), active: n.match.includes(name) })), theme];
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

// ---------------------------------------------------------------- pieces

function pageHead(S, eyebrow, title, o = {}) {
  return col([
    label(eyebrow, { key: 'page-eyebrow' }),
    text(title, S.h1, { key: o.titleKey || 'page-title', tag: 'h1', label: o.h1, mt: S.sp(2) }),
    o.intro ? maxw(640, text(o.intro, S.body, { key: 'page-intro', mt: S.sp(2) })) : null,
  ]);
}

function section(S, key, title, o = {}) {
  return [
    label(title, { key: `sec-${key}`, tag: 'h2', mt: o.mt ?? S.sp(10) }),
    { ...rule({ key: `sec-${key}-rule` }), mt: S.sp(2) },
  ];
}

function projectRow(p, i, state, S) {
  const key = `row-${p.slug}`;
  const hv = state.hover === key;
  return pressRow({
    key, href: `/work/${p.slug}/`, hover: hv, label: `${p.name} — ${p.summary}`,
    content: (tone, z) => row([
      text(pad2(i), S.small, { key: `${key}:n`, tone: tone ? 0.55 : 0, z, a11y: false, basis: 40 }),
      { ...text(p.title, S.h3, { key: `title:${p.slug}`, tone, z, a11y: false }), basis: S.mobile ? 150 : 250 },
      S.mobile ? { ...space(0), grow: true } : { ...text(p.summary, S.body, { key: `${key}:s`, tone: tone ? 0.55 : 0, z, a11y: false }), grow: true },
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
        key: `img:${p.slug}`, spec: p.image, aspect: 0.62, dark: state.theme === 'dark',
        style: on ? 'dither' : 'halftone', cell: on ? 4 : 8, motion: 'hover', alt: `${p.name} — cover image`,
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
    { ...image({ key: `img:${p.slug}`, spec: p.image, aspect: S.mobile ? 0.8 : 0.5, cell: S.mobile ? 6 : 8, dark: state.theme === 'dark', alt: `${p.name} — cover image` }), mt: S.sp(5) },
    maxw(680, col(p.body.map((para, j) => text(para, S.body, { key: `body-${j}`, mt: j ? S.sp(2) : 0 })), { mt: S.sp(5) })),
    text(p.tags.join(' · '), S.label, { key: 'tags', mt: S.sp(4) }),
    p.url ? row([button({ key: 'visit', label: `VISIT ${UP(p.name)}`, arrow: '↗', href: p.url, external: true, hover: hv('visit') })], { mt: S.sp(4) }) : null,
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
  const portrait = image({ key: 'hero-image', spec: { kind: 'portrait' }, aspect: 1.2, cell: S.mobile ? 6 : 8, dark: state.theme === 'dark', alt: 'Abstract halftone bust' });
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

function notFound(state, S) {
  const hv = (k) => state.hover === k;
  return col([
    label('LOST ON THE PATH', { key: 'page-eyebrow' }),
    text('404', S.display, { key: 'page-title', tag: 'h1', label: 'Page not found', mt: S.sp(2) }),
    text('THESE BLOCKS DID NOT ASSEMBLE INTO ANYTHING.', S.h2, { key: 'page-intro', mt: S.sp(3) }),
    text('“Where does the path go after the gate?” — “It goes where you do.”', S.body, { key: 'koan', tone: 0.55, mt: S.sp(3) }),
    row([button({ key: 'home', label: 'BACK HOME', arrow: '→', href: '/', hover: hv('home') })], { mt: S.sp(4) }),
  ]);
}

const PAGES = { home, work, project, services: servicesPage, about: aboutPage, cv: cvPage, contact, notFound };

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
