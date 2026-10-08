import { typeset } from './typeset.js';

// A tiny layout system. Nodes are plain objects; layout(node, width, ctx)
// returns a box { w, h, els } whose elements carry blocks relative to their
// own origin. Parents move children by shifting element origins only.

export const text = (str, style, o = {}) => ({ t: 'text', str, style, ...o });
export const col = (children, o = {}) => ({ t: 'col', children: children.filter(Boolean), gap: 0, ...o });
export const row = (children, o = {}) => ({ t: 'row', children: children.filter(Boolean), gap: 0, ...o });
export const grid = (children, o = {}) => ({ t: 'grid', children: children.filter(Boolean), cols: 2, gap: 0, ...o });
export const space = (h) => ({ t: 'space', h });
export const custom = (fn, o = {}) => ({ t: 'custom', fn, ...o });
export const maxw = (w, child) => ({ t: 'maxw', w, child, mt: child.mt });

export const even = (v) => Math.round(v / 2) * 2;

export function shift(els, dx, dy) {
  for (const e of els) { e.x += dx; e.y += dy; }
}

export class Ctx {
  constructor(page, state) {
    this.page = page;
    this.state = state;
    this.auto = 0;
    this.keys = new Set();
  }

  key(k) {
    let key = k ?? `${this.page}:${this.auto++}`;
    if (this.keys.has(key)) {
      let i = 2;
      while (this.keys.has(`${key}~${i}`)) i++;
      key = `${key}~${i}`;
    }
    this.keys.add(key);
    return key;
  }

  /** Create an element; blocks are (x, y, w, h, tone) relative to its origin. */
  el(o) {
    const blocks = o.blocks || new Float32Array(0);
    return {
      key: this.key(o.key),
      sig: o.sig ?? '',
      x: 0,
      y: 0,
      w: o.w ?? 0,
      h: o.h ?? 0,
      blocks,
      z: o.z ?? 0,
      flat: !!o.flat,
      motion: o.motion,
      match: o.match,
      anim: o.anim,
      a11y: o.a11y,
      hit: o.hit,
      fixed: !!o.fixed,
    };
  }
}

export function layout(n, w, ctx) {
  switch (n.t) {
    case 'text': {
      const st = n.style;
      const tone = n.tone ?? st.tone ?? 1;
      const ts = typeset(n.str, {
        size: st.size, bold: st.bold, lh: st.lh, tone,
        width: n.nowrap ? Infinity : (n.width ?? w), align: n.align,
      });
      const el = ctx.el({
        key: n.key,
        sig: `t|${n.str}|${st.size}|${st.bold ? 1 : 0}|${st.lh}|${tone}|${n.align || ''}|${ts.width}|${ts.lines}`,
        w: ts.width, h: ts.height, blocks: ts.blocks, z: n.z, motion: n.motion,
        a11y: n.a11y === false ? null : { tag: n.tag || 'p', text: n.label ?? n.str },
      });
      return { w: ts.width, h: ts.height, els: [el] };
    }

    case 'space':
      return { w: 0, h: n.h, els: [] };

    case 'col': {
      let y = 0, mw = 0;
      const els = [];
      n.children.forEach((c, i) => {
        if (i) y += c.mt ?? n.gap;
        const b = layout(c, w, ctx);
        let x = 0;
        const al = c.align ?? n.align;
        if (al === 'center') x = even((w - b.w) / 2);
        else if (al === 'right') x = w - b.w;
        shift(b.els, x, y);
        els.push(...b.els);
        y += b.h;
        mw = Math.max(mw, x + b.w);
      });
      return { w: n.fill ? w : mw, h: y, els };
    }

    case 'row': {
      const kids = n.children;
      const gap = n.gap;
      const boxes = new Array(kids.length);
      let fixedW = 0, growN = 0;
      kids.forEach((c, i) => {
        if (c.grow) { growN++; return; }
        boxes[i] = layout(c, c.basis ?? w, ctx);
        if (c.basis !== undefined) boxes[i].w = c.basis; // fixed-width column
        fixedW += boxes[i].w;
      });
      const gw = growN ? Math.max(0, Math.floor((w - fixedW - gap * (kids.length - 1)) / growN / 2) * 2) : 0;
      kids.forEach((c, i) => {
        if (!c.grow) return;
        boxes[i] = layout(c, gw, ctx);
        boxes[i].w = gw;
      });

      // Break into lines (wrap) and place.
      const lines = [];
      let line = [], lw = 0;
      boxes.forEach((b) => {
        const need = line.length ? lw + gap + b.w : b.w;
        if (n.wrap && line.length && need > w) { lines.push({ items: line, w: lw }); line = []; lw = 0; }
        lw = line.length ? lw + gap + b.w : b.w;
        line.push(b);
      });
      if (line.length) lines.push({ items: line, w: lw });

      const els = [];
      let y = 0, mw = 0;
      lines.forEach((l, li) => {
        if (li) y += n.rowGap ?? gap;
        const lh = l.items.reduce((m, b) => Math.max(m, b.h), 0);
        let x = 0, g = gap;
        if (n.justify === 'between' && l.items.length > 1) g = Math.floor((w - (l.w - gap * (l.items.length - 1))) / (l.items.length - 1));
        else if (n.justify === 'end') x = w - l.w;
        else if (n.justify === 'center') x = even((w - l.w) / 2);
        l.items.forEach((b) => {
          let dy = 0;
          if (n.valign === 'center') dy = Math.round((lh - b.h) / 2);
          else if (n.valign === 'bottom') dy = lh - b.h;
          shift(b.els, x, y + dy);
          els.push(...b.els);
          x += b.w + g;
        });
        mw = Math.max(mw, x - g);
        y += lh;
      });
      return { w: n.justify === 'between' || n.justify === 'end' ? w : mw, h: y, els };
    }

    case 'grid': {
      const cols = n.cols;
      const gap = n.gap;
      const cw = Math.floor((w - gap * (cols - 1)) / cols / 2) * 2;
      const els = [];
      let y = 0;
      for (let r = 0; r * cols < n.children.length; r++) {
        if (r) y += n.rowGap ?? gap;
        let rh = 0;
        for (let c = 0; c < cols; c++) {
          const child = n.children[r * cols + c];
          if (!child) break;
          const b = layout(child, cw, ctx);
          shift(b.els, c * (cw + gap), y);
          els.push(...b.els);
          rh = Math.max(rh, b.h);
        }
        y += rh;
      }
      return { w, h: y, els };
    }

    case 'maxw': {
      const b = layout(n.child, Math.min(w, n.w), ctx);
      return b;
    }

    case 'custom':
      return n.fn(w, ctx);

    default:
      throw new Error('unknown node ' + n.t);
  }
}

/** Turn relative element blocks into absolute (doc or screen) coordinates. */
export function resolve(els) {
  for (const e of els) {
    const b = e.blocks;
    const out = new Float32Array(b.length);
    for (let i = 0; i < b.length; i += 5) {
      out[i] = b[i] + e.x;
      out[i + 1] = b[i + 1] + e.y;
      out[i + 2] = b[i + 2];
      out[i + 3] = b[i + 3];
      out[i + 4] = b[i + 4];
    }
    e.rel = b;
    e.blocks = out;
    e.n = b.length / 5;
  }
  return els;
}
