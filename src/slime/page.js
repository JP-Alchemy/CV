// The slime mould experiment (/projects/slime-mould/), in blocks: the map the
// mould grows on, its controls and scores, and how it works. The tubes
// themselves are drawn under the map's frame and cities by slime/mode.js, from
// the model; its view of things (state.slime) gives this page its numbers.

import { text, col, row, grid, space, custom, maxw, even } from '../engine/layout.js';
import { typeset } from '../engine/typeset.js';
import { label, rule, button, link, section, fillBlocks, frameBlocks } from '../ui.js';
import { slimeText as T } from '../content.js';
import places from './places.js';

export { SLIME_PATH } from '../router.js';
export const BOX = places.box; // [x0, y0, w, h] km, the frame the map shows

const km = (v) => `${Math.round(v).toLocaleString('en-GB')} KM`;
const times = (v) => `${v.toFixed(2)}×`;
const pct = (v) => `${Math.round(v * 100)}%`;

/** A one-pixel outline in paper round some type's pixels, so it reads over the tubes. */
function outline(blocks, px) {
  const on = new Set(), out = [];
  for (let i = 0; i < blocks.length; i += 5) on.add(`${Math.round(blocks[i] / px)},${Math.round(blocks[i + 1] / px)}`);
  const seen = new Set(on);
  for (const k of on) {
    const [x, y] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const q = `${x + dx},${y + dy}`;
        if (seen.has(q)) continue;
        seen.add(q);
        out.push((x + dx) * px, (y + dy) * px, px, px, 0);
      }
    }
  }
  return Float32Array.from(out);
}

/** The map: its frame, the 40 cities and their names. Its element 'sm-map' is where the tubes go. */
function map(S, W) {
  return custom((w, ctx) => {
    const MW = even(Math.min(w, W)), s = MW / BOX[2], MH = even(BOX[3] * s);
    const els = [ctx.el({ key: 'sm-map', sig: `smmap|${MW}|${MH}`, w: MW, h: MH, blocks: frameBlocks(MW, MH), a11y: { tag: 'p', text: T.map } })];
    const R = S.mobile ? 2 : 3;
    const cities = places.cities.map(([name, x, y, pop], i) => ({ i, name, pop, x: (x - BOX[0]) * s, y: (y - BOX[1]) * s }));
    const hits = (r, b) => r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y;
    const taken = cities.map((c) => ({ x: c.x - R - 2, y: c.y - R - 2, w: 2 * R + 4, h: 2 * R + 4 }));
    for (const c of cities) {
      const q = 2 * R; // the square, in a ring of paper
      const m = ctx.el({ key: `sm-city-${c.i}`, sig: `smc|${R}`, w: q, h: q, blocks: Float32Array.of(-2, -2, q + 4, 2, 0, -2, q, q + 4, 2, 0, -2, 0, 2, q, 0, q, 0, 2, q, 0, 0, 0, q, q, 1), z: 2 });
      m.x = even(c.x - R);
      m.y = even(c.y - R);
      els.push(m);
    }
    // Names in the cities' own order (the provincial capitals, then by size),
    // beside their square where there's room and clear of every other square
    // and name; the ones that don't fit go without.
    const size = S.mobile ? 1 : 2;
    for (const c of cities) {
      const t = typeset(c.name.toUpperCase(), { size, tone: 0.75 });
      const h = 7 * size;
      const spot = [
        [c.x + R + 4, c.y - h / 2], [c.x - R - 4 - t.width, c.y - h / 2], [c.x - t.width / 2, c.y - R - 4 - h], [c.x - t.width / 2, c.y + R + 4],
      ].map(([x, y]) => ({ x: even(x), y: even(y), w: t.width, h }))
        .find((r) => r.x >= 4 && r.y >= 4 && r.x + r.w <= MW - 4 && r.y + r.h <= MH - 4 && !taken.some((b) => hits({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, b)));
      if (!spot) continue;
      taken.push(spot);
      const l = ctx.el({ key: `sm-name-${c.i}`, sig: `smn|${c.name}|${size}`, w: t.width, h, blocks: t.blocks, z: 2 });
      const o = ctx.el({ key: `sm-name-${c.i}:o`, sig: `smo|${c.name}|${size}`, w: t.width, h, blocks: outline(t.blocks, size), z: 1 });
      l.x = o.x = spot.x;
      l.y = o.y = spot.y;
      els.push(o, l);
    }
    return { w: MW, h: MH, els };
  });
}

/** What the mould is doing, and the buttons for it. */
function controls(state, S, v) {
  const hv = (k) => state.hover === k;
  const status = !v.ready ? 'LAYING OUT THE MAP' : v.settled ? 'SETTLED' : v.playing ? 'GROWING' : 'PAUSED';
  const line = v.ready ? `t = ${v.t.toFixed(1)}${v.mould?.linked ? ` · ${km(v.mould.TL)} OF NETWORK` : ''}` : 'THE MODEL STARTS IN A MOMENT';
  const btn = (key, lbl, action, o = {}) => button({ key, label: lbl, action, hover: hv(key), small: true, ...o });
  const preset = T.presets.find((p) => p.I0 === v.I0 && p.gamma === v.gamma);
  const stepper = (key, name, value) => row([
    { ...text(name, S.label, { key: `${key}:l`, a11y: false }), basis: 150 },
    btn(`${key}:dn`, '−', `sm:${key}-`, { aria: `Less ${name}` }),
    { ...text(value, S.h3, { key: `${key}:v`, align: 'center', motion: 'step', label: `${name} ${value}` }), basis: 64 },
    btn(`${key}:up`, '+', `sm:${key}+`, { aria: `More ${name}` }),
  ], { gap: 8, valign: 'center' });
  return col([
    text(status, S.h2, { key: 'sm-status', motion: 'step', attrs: { 'aria-live': 'polite' } }),
    text(line, S.small, { key: 'sm-line', motion: 'step', mt: S.sp(1) }),
    row([
      v.settled
        ? btn('sm-play', 'GROW IT AGAIN', 'sm:again')
        : btn('sm-play', v.playing ? 'PAUSE' : 'CARRY ON', 'sm:play', { pressed: !v.playing }),
      v.settled ? null : btn('sm-again', 'START AGAIN', 'sm:again'),
    ], { gap: 8, mt: S.sp(3), wrap: true, rowGap: 8 }),
    row([
      btn('sm-rail', 'THE RAILWAY', 'sm:rail', { active: v.rail, pressed: !!v.rail, aria: 'Show the real railway' }),
      btn('sm-tree', 'THE SHORTEST TREE', 'sm:tree', { active: v.tree, pressed: !!v.tree, aria: 'Show the minimum spanning tree' }),
    ], { gap: 8, mt: 8, wrap: true, rowGap: 8 }),
    maxw(460, text(T.seeing, S.body, { key: 'sm-seeing', tone: 0.55, mt: S.sp(3) })),
    label('SETTINGS', { key: 'sm-settings', mt: S.sp(5) }),
    row(T.presets.map((p) => btn(`sm-p-${p.id}`, p.label, `sm:preset:${p.id}`, { active: preset === p, pressed: preset === p })), { gap: 8, mt: S.sp(2), wrap: true, rowGap: 8 }),
    { ...stepper('I0', 'FLOW, I₀', v.I0 < 1 ? v.I0.toFixed(2) : v.I0.toFixed(1)), mt: S.sp(3) },
    { ...stepper('gamma', 'COMPETITION, γ', v.gamma.toFixed(2)), mt: 8 },
    maxw(460, text(T.settings, S.body, { key: 'sm-settings-t', tone: 0.55, mt: S.sp(3) })),
  ]);
}

/** The three networks side by side, measured the paper's way. */
function scores(S, v) {
  const nets = S.mobile
    ? [['MOULD', v.mould], ['RAIL', v.rail0], ['TREE', v.tree0]]
    : [['THE MOULD', v.mould], ['THE RAILWAY', v.rail0], ['SHORTEST TREE', v.tree0]];
  const LW = S.mobile ? 104 : 280, CW = S.mobile ? 76 : 220;
  const cell = (key, top, sub, o = {}) => ({
    ...col([
      text(top, S.mobile ? S.body : S.h3, { key: `${key}:a`, motion: 'step', tone: o.tone }),
      sub ? text(sub, S.small, { key: `${key}:b`, motion: 'step', mt: 6 }) : null,
    ]),
    basis: CW,
  });
  const metric = (key, name, note, fn) => col([
    row([
      { ...col([
        text(name, S.mobile ? S.small : S.h3, { key: `${key}:n`, tone: S.mobile ? 1 : undefined }),
        S.mobile ? null : text(note, S.small, { key: `${key}:note`, mt: 6 }),
      ]), basis: LW },
      ...nets.map(([, m], i) => {
        if (!m) return cell(`${key}-${i}`, '…', '');
        if (!m.linked) return cell(`${key}-${i}`, '—', 'NOT LINKED YET');
        return cell(`${key}-${i}`, ...fn(m));
      }),
    ], { gap: S.mobile ? 4 : 12 }),
    { ...rule({ key: `${key}:rule` }), mt: S.sp(2) },
  ], { mt: S.sp(2) });
  return col([
    row([
      { ...space(0), basis: LW },
      ...nets.map(([name], i) => ({ ...text(name, S.label, { key: `sm-h-${i}` }), basis: CW })),
    ], { gap: S.mobile ? 4 : 12 }),
    metric('sm-tl', 'LENGTH', 'COST: ALL THE TUBE OR TRACK', (m) => S.mobile ? [times(m.rel.TL)] : [km(m.TL), times(m.rel.TL)]),
    metric('sm-md', S.mobile ? 'TRIP' : 'AVERAGE TRIP', 'THE SHORTEST WAY BETWEEN TWO CITIES', (m) => S.mobile ? [times(m.rel.MD)] : [km(m.MD), times(m.rel.MD)]),
    metric('sm-ft', S.mobile ? 'CUT' : 'SURVIVES A CUT', 'STILL LINKS EVERY CITY AFTER ONE BREAK', (m) => [pct(m.FT)]),
    metric('sm-al', S.mobile ? 'α' : 'BENEFIT FOR COST, α', 'SURVIVING A CUT, PER LENGTH', (m) => [m.rel.alpha.toFixed(2)]),
  ]);
}

export function slimePage(state, S) {
  const hv = (k) => state.hover === k;
  const v = state.slime || { ready: false, t: 0, I0: T.presets[0].I0, gamma: T.presets[0].gamma, playing: true };
  const wide = S.cw >= 1100; // the map beside its controls
  const W = wide ? 620 : Math.min(S.cw, 640);
  const legend = text('YELLOW: THE MOULD · SQUARES: THE 40 CITIES · DOTS: THE RAILWAY · SPARSE DOTS: THE SHORTEST TREE', S.small, { key: 'sm-legend', mt: 12, a11y: false });
  const top = wide
    ? row([{ ...col([map(S, W), legend]), basis: W }, { ...controls(state, S, v), grow: true }], { gap: S.sp(5) })
    : col([map(S, W), legend, { ...controls(state, S, v), mt: S.sp(4) }]);

  return col([
    link({ key: 'back', label: '← WORK', href: '/work/', hover: hv('back') }),
    label(T.eyebrow, { key: 'page-eyebrow', mt: S.sp(4) }),
    text(T.title, S.h1, { key: 'page-title', tag: 'h1', label: 'Slime mould railways: a slime mould model of the Dutch rail network', mt: S.sp(2) }),
    maxw(720, text(T.intro, S.body, { key: 'page-intro', mt: S.sp(2) })),
    { ...top, mt: S.sp(5) },

    ...section(S, 'scores', 'THE SCORES', { mt: S.sp(8) }),
    { ...scores(S, v), mt: S.sp(2) },

    ...T.sections.flatMap((sec) => [
      ...section(S, sec.id, sec.title, { mt: S.sp(8) }),
      ...sec.paras.map((p, i) => maxw(720, text(p, S.body, { key: `sm-${sec.id}-${i}`, mt: S.sp(i ? 2 : 3) }))),
      sec.cite ? row([link({ key: `sm-${sec.id}-cite`, label: sec.cite.label, href: sec.cite.href, external: true, hover: hv(`sm-${sec.id}-cite`) })], { mt: S.sp(3) }) : null,
    ]),
  ]);
}
