import { text, custom, layout, shift, even } from './engine/layout.js';
import { typeset, measure } from './engine/typeset.js';
import { imageBlocks } from './engine/images.js';
import { iconFrames } from './icons.js';

const EMPTY = new Float32Array(0);

export function tokens(vw) {
  const mobile = vw < 640;
  const tablet = !mobile && vw < 1024;
  const gutter = mobile ? 16 : tablet ? 32 : 48;
  const cw = Math.floor(Math.min(1200, vw - gutter * 2) / 4) * 4;
  return {
    vw, mobile, tablet, gutter, cw,
    left: even((vw - cw) / 2),
    navTop: mobile ? 14 : 20,
    navClip: mobile ? 64 : 76,
    top: mobile ? 40 : 80,
    display: { size: mobile ? 6 : tablet ? 9 : 12, lh: 9 },
    h1: { size: mobile ? 4 : tablet ? 6 : 8, lh: 10 },
    h2: { size: mobile ? 3 : 4, lh: 10 },
    h3: { size: 2, bold: true, lh: 11 },
    body: { size: 2, lh: 12 },
    small: { size: 2, lh: 11, tone: 0.55 },
    label: { size: 2, lh: 11 },
    sp: (k) => k * (mobile ? 8 : 12),
  };
}

// ---------------------------------------------------------------- primitives

/** Border of square blocks, clockwise, with the four corners clipped. */
export function frameBlocks(w, h, b = 2, tone = 1) {
  const out = [];
  const cols = Math.round(w / b), rows = Math.round(h / b);
  for (let i = 1; i < cols - 1; i++) out.push(i * b, 0, b, b, tone);
  for (let j = 1; j < rows - 1; j++) out.push(w - b, j * b, b, b, tone);
  for (let i = cols - 2; i >= 1; i--) out.push(i * b, h - b, b, b, tone);
  for (let j = rows - 2; j >= 1; j--) out.push(0, j * b, b, b, tone);
  return Float32Array.from(out);
}

/** Interior tiled with `cell` px squares (used for hover/active fills). */
export function fillBlocks(w, h, cell = 4, inset = 2, tone = 1) {
  const out = [];
  for (let y = inset; y + cell <= h - inset + 0.01; y += cell) {
    for (let x = inset; x + cell <= w - inset + 0.01; x += cell) out.push(x, y, cell, cell, tone);
  }
  return Float32Array.from(out);
}

export function dottedLine(w, b = 2, step = 6, tone = 1) {
  const out = [];
  for (let x = 0; x + b <= w; x += step) out.push(x, 0, b, b, tone);
  return Float32Array.from(out);
}

export function solidLine(w, b = 2, tone = 1) {
  const out = [];
  for (let x = 0; x + b <= w; x += b) out.push(x, 0, b, b, tone);
  return Float32Array.from(out);
}

function cornerMarks(w, h, len = 12, b = 2) {
  const out = [];
  const corners = [[0, 0, 1, 1], [w - b, 0, -1, 1], [0, h - b, 1, -1], [w - b, h - b, -1, -1]];
  for (const [x, y, dx, dy] of corners) {
    for (let i = 0; i < len; i += b) out.push(x + i * dx, y, b, b, 1);
    for (let j = b; j < len; j += b) out.push(x, y + j * dy, b, b, 1);
  }
  return Float32Array.from(out);
}

// ---------------------------------------------------------------- components

export function label(str, o = {}) {
  return text(`■ ${str}`, { size: 2, lh: 11 }, { tone: 1, tag: 'p', label: str, ...o });
}

export function rule(o = {}) {
  return custom((w, ctx) => {
    const blocks = o.solid ? solidLine(w) : dottedLine(w);
    const el = ctx.el({ key: o.key, sig: `rule|${w}|${o.solid ? 1 : 0}`, w, h: 2, blocks });
    return { w, h: 2, els: [el] };
  }, o);
}

/** Bordered button. Hover/active floods it with a dissolve fill. */
export function button(o) {
  return custom((w, ctx) => {
    const size = 2;
    const H = o.small ? 36 : 44;
    const padX = o.small ? 12 : 16;
    const lw = measure(o.label, size);
    const icon = o.icon ? iconFrames(o.icon, 4) : null;
    const arrowW = o.arrow ? measure(o.arrow, size) + 10 : 0;
    const contentW = icon ? icon.w : lw + arrowW;
    let W = o.width ?? contentW + padX * 2;
    W = Math.ceil((W - 4) / 4) * 4 + 4;
    const on = !!(o.hover || o.active);
    const tone = on ? 0 : 1;
    const z = on ? 2 : 0;
    const els = [];
    els.push(ctx.el({ key: `${o.key}:frame`, sig: `frame|${W}|${H}`, w: W, h: H, blocks: frameBlocks(W, H) }));
    els.push(ctx.el({ key: `${o.key}:fill`, sig: `fill|${W}|${H}|${on ? 1 : 0}`, w: W, h: H, blocks: on ? fillBlocks(W, H) : EMPTY, z: 1, motion: 'grow' }));
    const cx = o.align === 'left' ? padX : even((W - contentW) / 2);
    if (icon) {
      const f = icon.frames.map((fr) => { const c = fr.slice(); for (let i = 4; i < c.length; i += 5) c[i] = tone; return c; });
      const el = ctx.el({
        key: `${o.key}:icon`, sig: `icon|${o.icon}|${tone}`, w: icon.w, h: icon.h, blocks: f[0], z, motion: 'icon',
        anim: f.length > 1 ? { frames: f, period: o.period ?? 2.6 } : undefined,
      });
      el.x = cx; el.y = even((H - icon.h) / 2);
      els.push(el);
    } else {
      const ty = Math.round((H - 14) / 2);
      const back = o.arrow === '←'; // leading arrow
      const lab = typeset(o.label, { size, tone });
      const l = ctx.el({ key: `${o.key}:label`, sig: `lab|${o.label}|${tone}`, w: lab.width, h: 14, blocks: lab.blocks, z, motion: 'hover' });
      l.x = back ? cx + arrowW : cx;
      l.y = ty;
      els.push(l);
      if (o.arrow) {
        const ar = typeset(o.arrow, { size, tone });
        const a = ctx.el({ key: `${o.key}:arrow`, sig: `arrow|${o.arrow}|${tone}`, w: ar.width, h: 14, blocks: ar.blocks, z, motion: 'hover' });
        a.x = (back ? cx : cx + lw + 10) + (o.hover ? (back ? -4 : 4) : 0);
        a.y = ty;
        els.push(a);
      }
    }
    els.push(ctx.el({
      key: o.key, w: W, h: H,
      hit: { href: o.href, action: o.action, label: o.aria || o.label, external: o.external, download: o.download, current: o.active, pressed: o.pressed },
    }));
    return { w: W, h: H, els };
  }, o);
}

/** Inline text link with a dotted underline that turns solid on hover. */
export function link(o) {
  return custom((w, ctx) => {
    const st = o.style || { size: 2, lh: 12 };
    const str = o.label + (o.external ? ' ↗' : '');
    const ts = typeset(str, { size: st.size, bold: st.bold, lh: st.lh, tone: 1, width: w });
    const els = [];
    els.push(ctx.el({ key: `${o.key}:label`, sig: `t|${str}|${st.size}|${st.bold ? 1 : 0}|${ts.width}`, w: ts.width, h: ts.height, blocks: ts.blocks }));
    const uy = ts.height + st.size * 3;
    const u = ctx.el({
      key: `${o.key}:line`, sig: `u|${ts.width}|${o.hover ? 1 : 0}|${st.size}`, w: ts.width, h: st.size,
      blocks: o.hover ? solidLine(ts.width, st.size) : dottedLine(ts.width, st.size, st.size * 3), motion: 'hover',
    });
    u.y = uy;
    els.push(u);
    els.push(ctx.el({ key: o.key, w: ts.width, h: uy + st.size, hit: { href: o.href, action: o.action, label: o.aria || o.label, external: o.external, download: o.download } }));
    return { w: ts.width, h: uy + st.size, els };
  }, o);
}

/** Halftone / dithered image in a w x (w*aspect) box with corner marks. */
export function image(o) {
  return custom((w, ctx) => {
    const W = even(o.w ? Math.min(o.w, w) : w);
    const H = even(o.h ?? W * (o.aspect ?? 0.66));
    const style = o.style || 'halftone';
    const cell = o.cell || 8;
    const dark = !!o.dark;
    const blocks = imageBlocks(o.spec, W - 8, H - 8, { style, cell, dark, gamma: o.gamma ?? 1 });
    for (let i = 0; i < blocks.length; i += 5) { blocks[i] += 4; blocks[i + 1] += 4; }
    const id = o.spec.kind || o.spec.src;
    const els = [
      ctx.el({
        key: o.key, sig: `img|${id}|${W}|${H}|${style}|${cell}|${dark ? 1 : 0}|${blocks.length}`,
        w: W, h: H, blocks, motion: o.motion, match: 'space', a11y: o.alt ? { tag: 'img', text: o.alt } : null,
      }),
    ];
    if (o.marks !== false) {
      els.push(ctx.el({ key: `${o.key}:marks`, sig: `marks|${W}|${H}`, w: W, h: H, blocks: cornerMarks(W, H) }));
    }
    return { w: W, h: H, els };
  }, o);
}

/** Looping pixel icon. */
export function icon(o) {
  return custom((w, ctx) => {
    const f = iconFrames(o.name, o.cell || 5, o.tone ?? 1);
    const el = ctx.el({
      key: o.key, sig: `icon|${o.name}|${o.cell || 5}|${o.tone ?? 1}`, w: f.w, h: f.h, blocks: f.frames[0], motion: 'icon', z: o.z,
      anim: f.frames.length > 1 && o.loop !== false ? { frames: f.frames, period: o.period ?? 2.4, phase: o.phase } : undefined,
    });
    return { w: f.w, h: f.h, els: [el] };
  }, o);
}

/** Make any node clickable: adds a hit element over its box. */
export function hitArea(o, child) {
  return custom((w, ctx) => {
    const b = layout(child, w, ctx);
    const W = o.fill ? w : b.w;
    b.els.push(ctx.el({ key: o.key, w: W, h: b.h, hit: { href: o.href, action: o.action, label: o.label, external: o.external, expanded: o.expanded } }));
    return { w: W, h: b.h, els: b.els };
  }, o);
}

/**
 * Full-width row that inverts on hover: dissolve fill behind, content
 * re-rendered with tone 0 on top. `content(tone, z)` returns a node.
 */
export function pressRow(o) {
  return custom((w, ctx) => {
    const on = !!o.hover;
    const padX = o.padX ?? 12;
    const inner = layout(o.content(on ? 0 : 1, on ? 2 : 0), w - padX * 2, ctx);
    const H = Math.max(o.h ?? 0, even(inner.h + (o.padY ?? 16) * 2));
    shift(inner.els, padX, even((H - inner.h) / 2));
    const els = [
      ctx.el({ key: `${o.key}:fill`, sig: `fill|${w}|${H}|${on ? 1 : 0}`, w, h: H, blocks: on ? fillBlocks(w, H, 4, 0) : EMPTY, z: 1, motion: 'grow' }),
      ...inner.els,
    ];
    if (o.rule !== false) {
      const r = ctx.el({ key: `${o.key}:rule`, sig: `rule|${w}`, w, h: 2, blocks: dottedLine(w) });
      r.y = H;
      els.push(r);
    }
    els.push(ctx.el({ key: o.key, w, h: H, hit: { href: o.href, action: o.action, label: o.label, external: o.external, expanded: o.expanded } }));
    return { w, h: H + 2, els };
  }, o);
}

/** Section heading: a ■ label and a dotted rule. Returns two nodes. */
export function section(S, key, title, o = {}) {
  return [
    label(title, { key: `sec-${key}`, tag: 'h2', mt: o.mt ?? S.sp(10) }),
    { ...rule({ key: `sec-${key}-rule` }), mt: S.sp(2) },
  ];
}
