// Which country is where, for Powers of Ten's globe. The outlines
// (geo-data.js, made by scripts/world-map.mjs from Natural Earth) are loaded
// when the zoom opens and filled, a level at a time, into maps of which
// country each pixel is in: the world at 0.25°, Europe at 0.04°, the Low
// Countries at 0.006°. A lookup takes the finest map that covers the point.

let levels = null;
let NL = 0;
let loading = null;

/** Start loading (once); resolves when every level is filled. */
export function loadGeo() {
  loading ||= import('./geo-data.js').then(async (m) => {
    NL = m.NL;
    const out = [];
    for (const L of m.LEVELS) {
      out.push(fill(L));
      levels = out.slice(); // coarse levels work while finer ones fill
      await new Promise((r) => setTimeout(r, 0));
    }
  }).catch((err) => { console.warn('No world outlines:', err); });
  return loading;
}

function fill({ box, step, countries }) {
  const W = Math.round((box[2] - box[0]) / step), H = Math.round((box[3] - box[1]) / step);
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = c.getContext('2d', { willReadFrequently: true });
  for (const [k, rings] of countries) {
    ctx.fillStyle = `rgb(${k},0,0)`;
    ctx.beginPath();
    for (const r of rings) {
      let x = 0, y = 0;
      for (let i = 0; i < r.length; i += 2) {
        x += r[i]; y += r[i + 1];
        if (i) ctx.lineTo(x / 2, y / 2); else ctx.moveTo(x / 2, y / 2);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  const px = ctx.getImageData(0, 0, W, H).data;
  const map = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] >= 128) map[i] = px[i * 4];
  return { box, step, inv: 1 / step, W, H, map };
}

export const geo = {
  get ready() { return !!levels; },
  get nl() { return NL; },
  /** The country at (lat, lon), as an index (0 for the sea). */
  at(lat, lon) {
    for (let k = levels.length - 1; k >= 0; k--) {
      const L = levels[k], box = L.box;
      if (lon < box[0] || lon >= box[2] || lat <= box[1] || lat > box[3]) continue;
      return L.map[((box[3] - lat) * L.inv | 0) * L.W + ((lon - box[0]) * L.inv | 0)];
    }
    return 0;
  },
};
