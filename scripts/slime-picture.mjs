// The slime mould's picture (src/slime/picture.js): one settled run of the
// model with the paper's settings, its network as lines with their
// thickness, the cities, and a coarse mask of the land, for the procedural
// image that stands for the experiment in the work list and the link
// previews (src/engine/images.js, kind 'slime'). Run it after
// scripts/slime-map.py:
//   node scripts/slime-picture.mjs
import fs from 'node:fs';
import { readMap, buildMesh, nearestNode, classAt, LAND, CROSSABLE } from '../src/slime/map.js';
import { Physarum, f } from '../src/slime/physarum.js';
import { mouldNetwork } from '../src/slime/networks.js';

const data = JSON.parse(fs.readFileSync('src/slime/nl.json', 'utf8'));
const map = readMap(data);
const mesh = buildMesh(map, { h: 2.5, jitter: 0.2, seed: 7 });
const sources = map.cities.map((c) => nearestNode(mesh, c.x, c.y));
const P = new Physarum(mesh, sources, { seed: 1 });
for (let calm = 0; calm < 8 && P.t < 200;) {
  P.step();
  calm = P.change() < 1.5e-4 ? calm + 1 : 0;
}
const use = mouldNetwork(mesh, P.D, sources, P.threshold);
const top = f(P.I0, P.gamma);

// The network as chains between junctions and cities, each with its mean thickness.
const deg = new Int32Array(mesh.n);
for (let e = 0; e < mesh.m; e++) if (use[e]) { deg[mesh.a[e]]++; deg[mesh.b[e]]++; }
const stop = (v) => deg[v] !== 2 || sources.includes(v);
const done = new Uint8Array(mesh.m);
const lines = [];
for (let v = 0; v < mesh.n; v++) {
  if (!deg[v] || !stop(v)) continue;
  for (let k = mesh.start[v]; k < mesh.start[v + 1]; k++) {
    let e = mesh.via[k];
    if (!use[e] || done[e]) continue;
    const pts = [[mesh.x[v], mesh.y[v]]];
    let w = v, sum = 0, n = 0;
    for (;;) {
      done[e] = 1;
      sum += P.D[e]; n++;
      w = mesh.a[e] === w ? mesh.b[e] : mesh.a[e];
      pts.push([mesh.x[w], mesh.y[w]]);
      if (stop(w)) break;
      let next = -1;
      for (let q = mesh.start[w]; q < mesh.start[w + 1]; q++) if (use[mesh.via[q]] && !done[mesh.via[q]]) next = mesh.via[q];
      if (next < 0) break;
      e = next;
    }
    lines.push({ d: Math.min(1, Math.sqrt(Math.sqrt(sum / n / top))), pts: simplify(pts, 0.9) });
  }
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const L = Math.hypot(bx - ax, by - ay) || 1;
  let best = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (pts[i][1] - ay) - (by - ay) * (pts[i][0] - ax)) / L;
    if (d > best) { best = d; at = i; }
  }
  if (best <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

// The land, 4 km a cell over the map's frame, as hex rows.
const [X0, Y0, W, H] = data.box, CK = 4;
const cols = Math.ceil(W / CK), rows = Math.ceil(H / CK);
const land = [];
for (let j = 0; j < rows; j++) {
  let bits = '';
  for (let i = 0; i < cols; i++) {
    let n = 0;
    for (let q = 0; q < 16; q++) {
      const c = classAt(map, X0 + (i + ((q % 4) + 0.5) / 4) * CK, Y0 + (j + (Math.floor(q / 4) + 0.5) / 4) * CK);
      if (c === LAND || c === CROSSABLE) n++;
    }
    bits += n >= 8 ? '1' : '0';
  }
  land.push(BigInt(`0b1${bits}`).toString(16)); // the leading 1 keeps the row's length
}

const r1 = (v) => Math.round(v * 10) / 10;
const out = {
  box: data.box, cell: CK, cols, rows, land,
  cities: sources.map((s) => [r1(mesh.x[s]), r1(mesh.y[s])]),
  lines: lines.map((l) => [Math.round(l.d * 100) / 100, ...l.pts.flatMap(([x, y]) => [r1(x), r1(y)])]),
};
fs.writeFileSync('src/slime/picture.js', `// Made by scripts/slime-picture.mjs: one settled run of the slime mould model
// (the paper's settings), for the experiment's picture (src/engine/images.js).
// km from the map grid's top-left, y south. lines: [thickness 0-1, x, y, x, y, ...].
// land: one hex row per 4 km, after a leading 1 bit.
export default ${JSON.stringify(out)};
`);
console.log(`t ${P.t.toFixed(1)}: ${lines.length} lines, ${out.lines.reduce((n, l) => n + (l.length - 1) / 2, 0)} points, land ${cols}×${rows}; ${(fs.statSync('src/slime/picture.js').size / 1024).toFixed(1)} KB`);
