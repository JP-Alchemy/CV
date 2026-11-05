// Makes src/powers/geo-data.js: the countries of the world for Powers of
// Ten's globe, at three levels of detail, each cut to the window it's used
// in. From Natural Earth (public domain) via world-atlas 2.0.2's TopoJSON:
//
//   the world      1:110m, everywhere,                      drawn at 0.25°
//   Europe         1:50m,  25°W-45°E, 33-72°N,              drawn at 0.04°
//   the Low Countries 1:10m, 0.5-10°E, 49-55.5°N,           drawn at 0.006°
//
// Each country's rings are clipped to the window, thinned to about half a
// pixel of that level and stored as integer steps, so the browser can fill
// them into a lookup map of which country each pixel is in (geo.js).
//
//   curl -sSfLO https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-{110m,50m,10m}.json
//   node scripts/world-map.mjs path/to/that/folder

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/world-map.mjs <folder with countries-*.json>'); process.exit(1); }

const LEVELS = [
  { file: 'countries-110m.json', box: [-180, -90, 180, 90], step: 0.25 },
  { file: 'countries-50m.json', box: [-25, 33, 45, 72], step: 0.04 },
  { file: 'countries-10m.json', box: [0.5, 49, 10, 55.5], step: 0.006 },
];

/** TopoJSON arcs, decoded to [lon, lat] arrays. */
function arcsOf(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
}

function ring(arcs, idx) {
  const out = [];
  for (const i of idx) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    out.push(...(out.length ? a.slice(1) : a));
  }
  return out;
}

/** Sutherland–Hodgman against the window, a pixel outside it. */
function clip(pts, [x0, y0, x1, y1]) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const cut = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1],
  ];
  let out = pts;
  for (let e = 0; e < 4 && out.length; e++) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
      const ina = edges[e](a), inb = edges[e](b);
      if (inb) { if (!ina) out.push(cut[e](a, b)); out.push(b); } else if (ina) out.push(cut[e](a, b));
    }
  }
  return out;
}

const ids = [];
const index = (id) => { let k = ids.indexOf(id); if (k < 0) { ids.push(id); k = ids.length - 1; } return k + 1; };

const levels = LEVELS.map(({ file, box, step }) => {
  const topo = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const arcs = arcsOf(topo);
  const q = step / 2; // stored in half pixels
  const pad = [box[0] - step, box[1] - step, box[2] + step, box[3] + step];
  const countries = [];
  let points = 0;
  for (const g of topo.objects.countries.geometries) {
    if (!g.arcs) continue;
    const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    const rings = [];
    for (const poly of polys) {
      for (const r of poly) {
        let pts = clip(ring(arcs, r), pad);
        if (pts.length < 3) continue;
        // Thin to about half a pixel.
        const kept = [pts[0]];
        for (const p of pts) {
          const l = kept[kept.length - 1];
          if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) >= step * 0.5) kept.push(p);
        }
        if (kept.length < 3) continue;
        const enc = [];
        let px = 0, py = 0;
        for (const [x, y] of kept) {
          const ix = Math.round((x - box[0]) / q), iy = Math.round((box[3] - y) / q);
          enc.push(ix - px, iy - py);
          px = ix; py = iy;
        }
        rings.push(enc);
        points += kept.length;
      }
    }
    if (rings.length) countries.push([index(g.id ?? g.properties?.name), rings]);
  }
  console.log(`${file}: ${countries.length} countries, ${points} points`);
  return { box, step, countries };
});

const NL = index('528');
const body = `// Made by scripts/world-map.mjs from Natural Earth (public domain), via
// world-atlas 2.0.2: each level is [lon0, lat0, lon1, lat1], degrees a pixel,
// and countries as [index, rings], each ring as steps of half a pixel (x east,
// y south) from the window's top-left. NL is the Netherlands' index.
export const NL = ${NL};
export const LEVELS = ${JSON.stringify(levels)};
`;
writeFileSync(new URL('../src/powers/geo-data.js', import.meta.url), body);
console.log(`src/powers/geo-data.js: ${(body.length / 1024).toFixed(0)} KB, ${ids.length} countries`);
