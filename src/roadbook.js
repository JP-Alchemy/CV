// The motorcycle roadbook (Leiden → the Alps → Leiden), drawn in blocks like
// the rest of the site: a route map projected from the real via points, the
// trip in numbers, each day as an expandable row with its elevation profile,
// the stays, the costs and the practical notes. GPX files are generated at
// build time (scripts/prerender.mjs).

import { text, col, row, grid, space, custom, maxw, even } from './engine/layout.js';
import { typeset } from './engine/typeset.js';
import { label, rule, button, link, pressRow, section, fillBlocks, frameBlocks } from './ui.js';
import book from './data/roadbook.js';

export const ROADBOOK_PATH = '/projects/moto-tour/';
const pad2 = (n) => String(n).padStart(2, '0');
const UP = (s) => s.toUpperCase();
export const eur = (v, d = 0) => `€${v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })}`;

/** Static GPX downloads: all routes, or one day. */
export const gpxFile = (n) => (n ? `${ROADBOOK_PATH}gpx/day-${pad2(n)}.gpx` : `${ROADBOOK_PATH}gpx/leiden-alps-leiden.gpx`);

export function tripStats() {
  const km = book.days.reduce((a, d) => a + d.km, 0);
  const nights = book.hotels.reduce((a, h) => a + h.nights, 0);
  const passes = new Set();
  let top = { alt: 0, name: '' };
  for (const d of book.days) {
    for (const v of d.vias || []) if (v[3]) passes.add(v[2]);
    for (const p of d.profile || []) if (p[1] > top.alt) top = { alt: p[1], name: p[2] || '' };
  }
  return { km, nights, passes: passes.size, top, total: book.budget.total, perDay: book.budget.per_day };
}

const stayFor = (n) => book.hotels.find((h) => h.days.includes(n));

// ---------------------------------------------------------------- pixel instruments

/** The whole route, projected from lat/lon, with numbered stays and passes. */
function routeMap(S) {
  return custom((w, ctx) => {
    // The route runs north–south, so the frame is tall and capped in width.
    const W = even(Math.min(w, 980)), H = even(W * (S.mobile ? 1.15 : 0.78));
    const pts = [];
    for (const d of book.days) for (const v of d.vias || []) pts.push([v[0], v[1]]);
    for (const h of book.hotels) pts.push([h.lat, h.lon]);
    let la0 = Infinity, la1 = -Infinity, lo0 = Infinity, lo1 = -Infinity;
    for (const [la, lo] of pts) { la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
    const kx = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
    const pad = S.mobile ? 28 : 44;
    const s = Math.min((W - pad * 2) / ((lo1 - lo0) * kx), (H - pad * 2) / (la1 - la0));
    const ox = (W - (lo1 - lo0) * kx * s) / 2, oy = (H - (la1 - la0) * s) / 2;
    const P = (la, lo) => [ox + (lo - lo0) * kx * s, oy + (la1 - la) * s];

    // Route: 2px blocks every ~2px along every leg, de-duplicated on the grid.
    const seen = new Set();
    const route = [];
    for (const d of book.days) {
      const v = d.vias || [];
      for (let i = 1; i < v.length; i++) {
        const [x0, y0] = P(v[i - 1][0], v[i - 1][1]), [x1, y1] = P(v[i][0], v[i][1]);
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
        for (let k = 0; k <= n; k++) {
          const gx = Math.round((x0 + ((x1 - x0) * k) / n) / 2) * 2, gy = Math.round((y0 + ((y1 - y0) * k) / n) / 2) * 2;
          const key = gx * 8192 + gy;
          if (seen.has(key)) continue;
          seen.add(key);
          route.push(gx - 1, gy - 1, 2, 2, 1);
        }
      }
    }
    const passes = [];
    const passSeen = new Set();
    for (const d of book.days) {
      for (const v of d.vias || []) {
        if (!v[3] || passSeen.has(v[2])) continue;
        passSeen.add(v[2]);
        const [x, y] = P(v[0], v[1]);
        passes.push(Math.round(x) - 3, Math.round(y) - 3, 6, 6, 1);
      }
    }
    const els = [
      ctx.el({ key: 'rb-map-route', sig: `route|${W}|${H}`, w: W, h: H, blocks: Float32Array.from(route) }),
      ctx.el({ key: 'rb-map-passes', sig: `passes|${W}|${H}`, w: W, h: H, blocks: Float32Array.from(passes) }),
    ];

    // Markers: an inked box with the night numbers knocked out, plus the town.
    const boxes = [];
    const overlaps = (r) => boxes.some((b) => r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y);
    const place = (key, lat, lon, num, town) => {
      const [cx, cy] = P(lat, lon);
      const t = typeset(num, { size: 2, tone: 0 });
      const bw = Math.ceil((t.width + 8) / 2) * 2, bh = 20;
      let bx = even(cx - bw / 2), by = even(cy - bh / 2);
      // Stays that sit almost on top of each other (Cochem / Boppard) step aside.
      for (const [dx, dy] of [[0, 0], [bw + 4, 0], [-(bw + 4), 0], [0, -(bh + 4)], [0, bh + 4]]) {
        if (!overlaps({ x: bx + dx, y: by + dy, w: bw, h: bh })) { bx += dx; by += dy; break; }
      }
      boxes.push({ x: bx, y: by, w: bw, h: bh });
      const fill = ctx.el({ key: `${key}:box`, sig: `mk|${bw}`, w: bw, h: bh, blocks: fillBlocks(bw, bh, 2, 0), z: 1 });
      fill.x = bx; fill.y = by;
      const num_ = ctx.el({ key: `${key}:n`, sig: `mkn|${num}`, w: t.width, h: 14, blocks: t.blocks, z: 2 });
      num_.x = bx + 4; num_.y = by + 3;
      els.push(fill, num_);
      if (!town) return;
      const tl = typeset(UP(town), { size: 2, tone: 0.55 });
      const cands = [
        { x: bx + bw + 6, y: by + 3 }, { x: bx - tl.width - 6, y: by + 3 },
        { x: even(cx - tl.width / 2), y: by - 20 }, { x: even(cx - tl.width / 2), y: by + bh + 6 },
      ];
      const pick = cands.find((c) => c.x >= 0 && c.x + tl.width <= W && !overlaps({ x: c.x, y: c.y, w: tl.width, h: 14 })) || cands[0];
      boxes.push({ x: pick.x, y: pick.y, w: tl.width, h: 14 });
      // A paper-coloured knock-out keeps the name readable over the route.
      const halo = ctx.el({ key: `${key}:h`, sig: `mkh|${tl.width}`, w: tl.width + 8, h: 20, blocks: fillBlocks(tl.width + 8, 20, 2, 0, 0), z: 1 });
      halo.x = even(pick.x) - 4; halo.y = even(pick.y) - 4;
      const lab = ctx.el({ key: `${key}:l`, sig: `mkl|${town}`, w: tl.width, h: 14, blocks: tl.blocks, z: 2 });
      lab.x = even(pick.x); lab.y = even(pick.y);
      els.push(halo, lab);
    };
    const home = book.days[0].vias[0];
    place('rb-mk-home', home[0], home[1], 'H', 'Leiden');
    book.hotels.forEach((h, i) => place(`rb-mk-${i}`, h.lat, h.lon, h.days.join('·'), h.town));
    els.push(ctx.el({ key: 'rb-map-frame', sig: `frame|${W}|${H}`, w: W, h: H, blocks: frameBlocks(W, H) }));
    return { w: W, h: H, els };
  });
}

/** A day's elevation profile as 2px columns every 4px (0–3,000 m). */
function elevation(day, key) {
  return custom((w, ctx) => {
    const prof = day.profile;
    const W = Math.min(w, 720), H = 64;
    const maxKm = prof[prof.length - 1][0] || day.km || 1;
    const alt = (km) => {
      for (let i = 1; i < prof.length; i++) {
        if (km <= prof[i][0]) {
          const a = prof[i - 1], b = prof[i];
          return a[1] + ((b[1] - a[1]) * (km - a[0])) / Math.max(1e-6, b[0] - a[0]);
        }
      }
      return prof[prof.length - 1][1];
    };
    const cols = [];
    for (let x = 0; x + 2 <= W; x += 4) {
      const h = Math.max(2, even((alt((x / W) * maxKm) / 3000) * H));
      cols.push(x, H - h, 2, h, 1);
    }
    const el = ctx.el({ key, sig: `elev|${W}|${day.n}`, w: W, h: H, blocks: Float32Array.from(cols), flat: true });
    return { w: W, h: H, els: [el] };
  });
}

/** Spend per day: one bar per day, day numbers underneath. */
function spendBars(S) {
  return custom((w, ctx) => {
    const n = book.costs.length, gap = S.mobile ? 4 : 10, H = 120;
    const bw = Math.floor((w - gap * (n - 1)) / n / 2) * 2;
    const max = Math.max(...book.costs.map((c) => c.total));
    const bars = [];
    const els = [];
    book.costs.forEach((c, i) => {
      const h = Math.max(2, even((c.total / max) * H));
      bars.push(i * (bw + gap), H - h, bw, h, 1);
      const t = typeset(pad2(c.n), { size: 2, tone: 0.55 });
      const lab = ctx.el({ key: `rb-bar-${i}`, sig: `bar|${c.n}`, w: t.width, h: 14, blocks: t.blocks });
      lab.x = i * (bw + gap) + even((bw - t.width) / 2); lab.y = H + 10;
      els.push(lab);
    });
    els.unshift(ctx.el({ key: 'rb-bars', sig: `bars|${w}`, w, h: H, blocks: Float32Array.from(bars), flat: true }));
    return { w, h: H + 24, els };
  });
}

// ---------------------------------------------------------------- page

function dayBody(d, S, key) {
  const parts = [text(d.roads, S.body, { key: `${key}:roads` })];
  if (d.why) parts.push(text(d.why, S.body, { key: `${key}:why`, tone: 0.55, mt: S.sp(1) }));
  if (d.profile && d.profile.length > 1) {
    const top = d.profile.reduce((m, p) => (p[1] > m[1] ? p : m), d.profile[0]);
    parts.push({ ...elevation(d, `${key}:elev`), mt: S.sp(3) });
    parts.push(text(`ELEVATION, 0–3,000 M · HIGHEST ${UP(top[2] || '')} ${top[1].toLocaleString('en-GB')} M`, S.small, { key: `${key}:elevl`, mt: 10 }));
  }
  const passes = (d.vias || []).filter((v) => v[3]).map((v) => v[2]);
  if (passes.length) parts.push(text(`PASSES: ${UP(passes.join(' · '))}`, S.small, { key: `${key}:passes`, mt: S.sp(2) }));
  (d.foot || []).forEach((f, i) => parts.push(row([
    text(f.t, S.small, { key: `${key}:ft${i}`, basis: 56 }),
    { ...col([text(UP(f.h), S.h3, { key: `${key}:fh${i}` }), text(f.d, S.body, { key: `${key}:fd${i}`, mt: 8 })]), grow: true },
  ], { mt: S.sp(2) })));
  const stay = stayFor(d.n);
  if (stay) {
    const first = stay.days[0] === d.n;
    parts.push(text(first
      ? `SLEEP: ${UP(stay.name)}, ${UP(stay.town)} · ${stay.nights} NIGHT${stay.nights > 1 ? 'S' : ''} · ${eur(stay.price, 2)}`
      : `SLEEP: SAME ROOM, ${UP(stay.name)}`, S.small, { key: `${key}:sleep`, mt: S.sp(2) }));
  } else if (d.n === book.days.length) {
    parts.push(text('SLEEP: HOME', S.small, { key: `${key}:sleep`, mt: S.sp(2) }));
  }
  if (d.cost) parts.push(text(`SPEND TODAY ${eur(d.cost.total)} · SO FAR ${eur(d.cost.cum)}`, S.small, { key: `${key}:cost`, mt: 8 }));
  const actions = [];
  if (d.kind !== 'rest') actions.push(link({ key: `${key}:gpx`, label: `DAY ${pad2(d.n)} ROUTE · GPX ↓`, href: gpxFile(d.n), download: true, aria: `Download the day ${d.n} route as GPX` }));
  if (stay && stay.days[0] === d.n && stay.url) actions.push(link({ key: `${key}:book`, label: 'BOOK', href: stay.url, external: true, aria: `Book ${stay.name}` }));
  if (actions.length) parts.push(row(actions, { gap: S.sp(3), mt: S.sp(2), wrap: true }));
  return col(parts);
}

function accordion(S, state, id, title, body, gutter = 0) {
  const key = `rb-${id}`;
  const open = state.expanded.has(id);
  const hv = state.hover === key;
  return col([
    pressRow({
      key, action: `toggle:${id}`, hover: hv, expanded: open, rule: false, label: title,
      content: (tone, z) => row([
        { ...text(UP(title), S.h3, { key: `${key}:t`, tone, z, a11y: false }), grow: true },
        text(open ? '−' : '+', S.h2, { key: `${key}:x`, tone, z, a11y: false, motion: 'icon' }),
      ], { gap: S.sp(2), valign: 'center' }),
    }),
    open ? { ...row([space(0), { ...maxw(760, text(body, S.body, { key: `${key}:b` })), grow: true }], { gap: gutter || 12 }), mt: S.sp(1) } : null,
    { ...rule({ key: `${key}:rule` }), mt: open ? S.sp(3) : 0 },
  ]);
}

export function roadbookPage(state, S) {
  const hv = (k) => state.hover === k;
  const st = tripStats();
  const DW = S.mobile ? 90 : 110; // date column

  const stats = [
    [eur(st.total), 'TOTAL, SOLO'], [eur(st.perDay), 'PER DAY'], [`${st.km.toLocaleString('en-GB')} KM`, 'DISTANCE'],
    [String(st.nights), 'NIGHTS'], [String(st.passes), 'NAMED PASSES'], [`${st.top.alt.toLocaleString('en-GB')} M`, 'HIGHEST POINT'],
  ].map(([v, l], i) => col([
    text(v, S.h1, { key: `rb-stat-v-${i}`, label: `${v} ${l.toLowerCase()}` }),
    text(l, S.small, { key: `rb-stat-l-${i}`, mt: S.sp(1), a11y: false }),
  ]));

  const days = book.days.map((d) => {
    const id = `day-${d.n}`, key = `rb-${id}`, open = state.expanded.has(id);
    return col([
      pressRow({
        key, action: `toggle:${id}`, hover: hv(key), expanded: open, rule: false,
        label: `Day ${d.n}, ${d.date}: ${d.title}. ${d.frm} to ${d.to}${d.km ? `, ${d.km} km` : ''}`,
        content: (tone, z) => row([
          text(pad2(d.n), S.small, { key: `${key}:n`, tone: tone ? 0.55 : 0, z, a11y: false, basis: 32 }),
          { ...text(UP(d.date), S.small, { key: `${key}:d`, tone: tone ? 0.55 : 0, z, a11y: false }), basis: DW },
          { ...col([
            text(UP(d.title), S.h3, { key: `${key}:t`, tone, z, a11y: false }),
            text(`${d.frm} → ${d.to}${d.km ? ` · ${d.km} km · ${d.hrs}` : ' · rest day'}`, S.small, { key: `${key}:r`, tone: tone ? 0.55 : 0, z, a11y: false, mt: 8 }),
          ]), grow: true },
          text(open ? '−' : '+', S.h2, { key: `${key}:x`, tone, z, a11y: false, motion: 'icon' }),
        ], { gap: S.sp(2), valign: 'center' }),
      }),
      open ? { ...row([space(0), { ...maxw(760, dayBody(d, S, key)), grow: true }], { gap: S.mobile ? 12 : 32 + DW + S.sp(4) + 12 }), mt: S.sp(1) } : null,
      { ...rule({ key: `${key}:rule` }), mt: open ? S.sp(3) : 0 },
    ]);
  });

  const stays = book.hotels.map((h, i) => {
    const key = `rb-stay-${i}`;
    return pressRow({
      key, href: h.url, external: true, hover: hv(key),
      label: `Nights ${h.days.join(' and ')}: ${h.name}, ${h.town}. ${h.checkin} to ${h.checkout}, ${eur(h.price, 2)}. Open on Booking.com`,
      content: (tone, z) => row([
        text(h.days.join('·'), S.h3, { key: `${key}:n`, tone, z, a11y: false, basis: 48 }),
        { ...col([
          text(UP(h.name), S.h3, { key: `${key}:t`, tone, z, a11y: false }),
          text(`${h.town} · ${h.where}${S.mobile ? ` · ${h.checkin}` : ''}`, S.small, { key: `${key}:w`, tone: tone ? 0.55 : 0, z, a11y: false, mt: 8 }),
        ]), grow: true },
        S.mobile ? null : { ...text(`${UP(h.checkin)} → ${UP(h.checkout)}`, S.small, { key: `${key}:d`, tone: tone ? 0.55 : 0, z, a11y: false }), basis: 250 },
        { ...text(eur(h.price, 2), S.body, { key: `${key}:p`, tone, z, a11y: false, align: 'right' }), basis: 96 },
        text('↗', S.body, { key: `${key}:a`, tone, z, a11y: false }),
      ], { gap: S.sp(2), valign: 'center' }),
    });
  });

  const money = (key, item, note, amount, strong) => col([
    row([
      { ...text(UP(item), S.h3, { key: `${key}:i` }), basis: S.mobile ? 150 : 280 },
      S.mobile ? { ...space(0), grow: true } : { ...maxw(620, text(note || '', S.body, { key: `${key}:n`, tone: 0.55 })), grow: true },
      { ...text(amount, strong ? S.h3 : S.body, { key: `${key}:a`, align: 'right' }), basis: 110 },
    ], { gap: S.sp(2), mt: S.sp(2) }),
    S.mobile && note ? text(note, S.body, { key: `${key}:nm`, tone: 0.55, mt: 8 }) : null,
    { ...rule({ key: `${key}:rule` }), mt: S.sp(2) },
  ]);
  const b = book.budget;

  return col([
    link({ key: 'back', label: '← MOTORCYCLE TOUR FRAMEWORK', href: '/work/motorcycle-tour/', hover: hv('back') }),
    label('ROADBOOK · 24 AUG — 4 SEP 2026 · SOLO', { key: 'page-eyebrow', mt: S.sp(4) }),
    text('LEIDEN → THE ALPS → LEIDEN', S.h1, { key: 'page-title', tag: 'h1', label: 'Roadbook: Leiden to the Alps and back by motorcycle', mt: S.sp(2) }),
    maxw(680, text(`Eleven nights, ${st.km.toLocaleString('en-GB')} km. Back roads throughout, bar the transit across Germany. Every numbered marker is a place to sleep; the small squares are the named passes.`, S.body, { key: 'page-intro', mt: S.sp(2) })),
    { ...routeMap(S), mt: S.sp(5) },
    text('H = HOME · NUMBERED BOXES = NIGHTS · SQUARES = NAMED PASSES', S.small, { key: 'rb-legend', mt: 12, a11y: false }),
    { ...grid(stats, { cols: S.mobile ? 2 : 3, gap: S.sp(3), rowGap: S.sp(4) }), mt: S.sp(6) },

    ...section(S, 'days', 'DAY BY DAY', { mt: S.sp(8) }),
    ...days,

    ...section(S, 'stays', 'WHERE YOU SLEEP', { mt: S.sp(8) }),
    ...stays,

    ...section(S, 'costs', 'WHAT IT COSTS', { mt: S.sp(8) }),
    { ...spendBars(S), mt: S.sp(3) },
    text('SPEND PER DAY, INCLUDING THE BED', S.small, { key: 'rb-bars-l', mt: 8, a11y: false }),
    { ...space(0), mt: S.sp(2) },
    ...b.rows.map((r, i) => money(`rb-cost-${i}`, r.item, r.note, eur(r.amount))),
    money('rb-sub', 'Subtotal', '', eur(b.subtotal)),
    money('rb-cont', 'Contingency at 10%', 'There are no spare days in this schedule.', eur(b.contingency)),
    money('rb-total', 'Total', `Solo, one room, one bike — ${eur(b.per_day)} a day.`, eur(b.total), true),
    maxw(760, col(b.basis.map((t, i) => row([
      text('→', S.body, { key: `rb-basis-a${i}`, a11y: false }),
      { ...text(t, S.body, { key: `rb-basis-${i}` }), grow: true },
    ], { gap: 12, mt: i ? 10 : 0 })), { mt: S.sp(3) })),
    label('BEFORE YOU LEAVE — NOT TRIP SPENDING, BUT SPEND IT ANYWAY', { key: 'rb-before', mt: S.sp(5) }),
    ...b.before.map((r, i) => money(`rb-bef-${i}`, r.item, r.note, r.cost)),

    ...section(S, 'warn', 'WORTH KNOWING', { mt: S.sp(8) }),
    ...book.warnings.map((x, i) => accordion(S, state, `warn-${i}`, x.h, x.d)),

    ...section(S, 'prac', 'BEFORE YOU GO', { mt: S.sp(8) }),
    ...book.practical.map((x, i) => accordion(S, state, `prac-${i}`, x.h, x.d)),

    ...section(S, 'gpx', 'TAKE IT WITH YOU', { mt: S.sp(8) }),
    row([button({ key: 'rb-gpx', label: 'DOWNLOAD ALL ROUTES (GPX)', arrow: '↓', href: gpxFile(0), download: true, hover: hv('rb-gpx') })], { mt: S.sp(3) }),
    maxw(720, text('Via-point routes, not recorded tracks: your nav app calculates the roads between the points, which keeps live closures and your own preferences in play. Set it to avoid motorways on every day except 1 and 12.', S.body, { key: 'rb-gpx-n', mt: S.sp(3) })),
    maxw(720, text('Distances, riding times and elevations are close estimates. All accommodation is booked; the prices shown are what was paid.', S.body, { key: 'rb-gpx-n2', tone: 0.55, mt: S.sp(2) })),
  ]);
}

// ---------------------------------------------------------------- static exports (build + SEO)

function gpxXml(list, name) {
  const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let s = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="jpbothma.com roadbook" xmlns="http://www.topografix.com/GPX/1/1">\n';
  s += `  <metadata><name>${e(name)}</name></metadata>\n`;
  for (const h of book.hotels) {
    if (list.some((d) => h.days.includes(d.n))) {
      s += `  <wpt lat="${h.lat.toFixed(6)}" lon="${h.lon.toFixed(6)}"><name>${e(h.name)}</name><desc>${e(h.town)}</desc><sym>Lodging</sym></wpt>\n`;
    }
  }
  for (const d of list) {
    if (d.kind === 'rest') continue;
    s += `  <rte>\n    <name>Day ${pad2(d.n)} - ${e(d.title)}</name>\n`;
    for (const v of d.vias) s += `    <rtept lat="${v[0].toFixed(5)}" lon="${v[1].toFixed(5)}"><name>${e(v[2])}</name></rtept>\n`;
    s += '  </rte>\n';
  }
  return `${s}</gpx>\n`;
}

/** [path, xml] for every GPX file the page links to. */
export function gpxFiles() {
  return [
    [gpxFile(0), gpxXml(book.days, 'Leiden - Alps - Leiden')],
    ...book.days.filter((d) => d.kind !== 'rest').map((d) => [gpxFile(d.n), gpxXml([d], `Day ${d.n}`)]),
  ];
}

export { book };
