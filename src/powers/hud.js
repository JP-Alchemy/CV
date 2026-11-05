// Powers of Ten's panel along the bottom of the screen: how big the view is,
// in powers of ten and in words, what you're looking at, and the zoom's
// buttons. It holds still (fixed) while everything above it zooms, on paper
// of its own so it reads over whatever's under it, and it's always as tall
// as the longest caption needs, so the view above never changes size.

import { text, col, row, layout, shift } from '../engine/layout.js';
import { typeset, measure } from '../engine/typeset.js';
import { button } from '../ui.js';
import { powersText as T } from '../content.js';

const Z = 4; // over the page, however big its blocks get

const btnW = (s) => Math.ceil((measure(s, 2) + 24 - 4) / 4) * 4 + 4;

/** o.cv: on the CV (Powers of Ten's own page), not any page. */
export function powersHud(state, S, ctx, vp, o = {}) {
  const v = state.zoom || { readout: '10⁰ M', size: '', caption: '', home: true };
  const hv = (k) => state.hover === k;
  const btn = (key, lbl, action, aria) => button({ key, label: lbl, action, hover: hv(key), small: true, aria });
  const cv = o.cv !== false;
  const homeLabel = S.mobile ? (cv ? 'CV' : 'PAGE') : cv ? 'BACK TO THE CV' : 'BACK TO THE PAGE';
  const zoomBtns = [btn('zm-out', '−', 'zm:out', 'Zoom out ten times'), btn('zm-in', '+', 'zm:in', 'Zoom in ten times')];
  const home = v.home ? null : btn('zm-home', homeLabel, 'zm:home', cv ? 'Back to the CV' : 'Back to the page');
  const readout = text(v.readout, S.h2, { key: 'zm-readout', motion: 'step', nowrap: true, label: `About ${v.size.toLowerCase()} across`, attrs: { 'aria-live': 'polite' } });
  const size = text(S.cw < 900 && S.mobile ? v.size.replace(/ ACROSS$/, '') : v.size, S.small, { key: 'zm-size', motion: 'step', nowrap: true, a11y: false });
  const scale = col([readout, { ...size, mt: 8 }]);

  // Side by side when there's room, stacked when not. The caption's column,
  // and the height the longest caption needs in it.
  const stacked = S.cw < 900;
  const gap = S.sp(3);
  const buttonsW = stacked ? 0 : Math.max(btnW('BACK TO THE PAGE'), 8 + 2 * btnW('+'));
  const scaleW = stacked ? 0 : 220;
  const capW = stacked ? S.cw : S.cw - scaleW - buttonsW - gap * 2;
  const longest = Math.max(...Object.values(T.scales).map((s) => typeset(s.replace('{HOW}', T.scales.howTouch), { size: S.body.size, lh: S.body.lh, width: capW }).height));
  const caption = { ...text(v.caption, S.body, { key: 'zm-caption', motion: 'step' }), basis: capW };

  const node = stacked
    ? col([
      row([{ ...readout, grow: true }, ...zoomBtns], { gap: 8, valign: 'center' }),
      row([{ ...size, grow: true }, home], { gap: 8, valign: 'center', mt: 8 }),
      { ...caption, mt: S.sp(2) },
    ])
    : row([
      { ...scale, basis: scaleW },
      caption,
      { ...col([row(zoomBtns, { gap: 8 }), home ? row([home], { mt: 8 }) : null]), basis: buttonsW },
    ], { gap, valign: 'center' });
  const pad = S.mobile ? 12 : 18;
  const box = layout(node, S.cw, ctx);
  const inner = stacked ? Math.max(box.h, 36 + 8 + 36 + S.sp(2) + longest) : Math.max(box.h, longest, 36 * 2 + 8);
  const H = Math.ceil((inner + pad * 2) / 4) * 4;
  const y = vp.h - H;
  shift(box.els, S.left, y + pad + (stacked ? 0 : Math.round((inner - box.h) / 2)));
  const panel = ctx.el({
    key: 'zm-panel', sig: `panel|${vp.w}|${H}`, w: vp.w, h: H, z: Z - 1, flat: true,
    blocks: Float32Array.from([0, 0, vp.w, H, 0, ...rule(vp.w)]),
  });
  panel.x = 0;
  panel.y = y;
  for (const e of box.els) e.z = (e.z || 0) + Z;
  const els = [panel, ...box.els];
  for (const e of els) e.fixed = true;
  return { els, h: H };
}

/** A dotted line across the top of the panel. */
function rule(w) {
  const out = [];
  for (let x = 0; x < w; x += 4) out.push(x, 0, 2, 2, 1);
  return out;
}
