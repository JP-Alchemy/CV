// Scoring a network the way Tero et al. scored the mould and the Tokyo rail
// network. A network here is a set of mesh edges, so the mould, the real
// railway and the minimum spanning tree are all measured on the same tubes,
// with the same kinks:
//
//   TL  cost: its total length
//   MD  transport: the mean shortest distance between two cities, over every pair
//   FT  fault tolerance: the chance it still links every city after one cut,
//       made at a random point along it
//
// TL and MD are given relative to the minimum spanning tree's (TL_MST, MD_MST),
// and the paper's benefit-cost ratio is α = FT / TL_MST.

import { nearestNode } from './map.js';

/** Shortest paths from `src`, over the edges where use[e] (all, if null); stops at `stop` or past `reach` km. */
export function dijkstra(mesh, src, { use = null, stop = -1, reach = Infinity, dist, prev } = {}) {
  const { n, start, nbr, via, len } = mesh;
  dist = dist || new Float64Array(n);
  prev = prev || new Int32Array(n);
  dist.fill(Infinity);
  prev.fill(-1);
  const heapD = [], heapV = [];
  const push = (d, v) => {
    let i = heapD.length;
    heapD.push(d);
    heapV.push(v);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (heapD[up] <= d) break;
      heapD[i] = heapD[up];
      heapV[i] = heapV[up];
      i = up;
    }
    heapD[i] = d;
    heapV[i] = v;
  };
  const pop = () => {
    const v = heapV[0], lastD = heapD.pop(), lastV = heapV.pop();
    const N = heapD.length;
    if (N) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= N) break;
        if (c + 1 < N && heapD[c + 1] < heapD[c]) c++;
        if (heapD[c] >= lastD) break;
        heapD[i] = heapD[c];
        heapV[i] = heapV[c];
        i = c;
      }
      heapD[i] = lastD;
      heapV[i] = lastV;
    }
    return v;
  };
  dist[src] = 0;
  push(0, src);
  while (heapD.length) {
    const d = heapD[0], v = pop();
    if (d > dist[v]) continue;
    if (v === stop || d > reach) break;
    for (let k = start[v]; k < start[v + 1]; k++) {
      const e = via[k];
      if (use && !use[e]) continue;
      const w = nbr[k], nd = d + len[e];
      if (nd < dist[w]) {
        dist[w] = nd;
        prev[w] = e;
        push(nd, w);
      }
    }
  }
  return { dist, prev };
}

/** Mark the edges of the path that `prev` leads back from `to`. */
function markPath(mesh, prev, to, out) {
  for (let v = to; prev[v] >= 0;) {
    const e = prev[v];
    out[e] = 1;
    v = mesh.a[e] === v ? mesh.b[e] : mesh.a[e];
  }
}

/**
 * The minimum spanning tree over land: the shortest way to link every city,
 * with each link the shortest path over the mesh. The paper's reference.
 */
export function spanningTree(mesh, sources) {
  const K = sources.length;
  const runs = Array.from(sources, (s) => dijkstra(mesh, s));
  const inTree = new Uint8Array(K), best = new Float64Array(K).fill(Infinity), from = new Int32Array(K).fill(-1);
  const out = new Uint8Array(mesh.m);
  best[0] = 0;
  for (let it = 0; it < K; it++) {
    let k = -1;
    for (let i = 0; i < K; i++) if (!inTree[i] && (k < 0 || best[i] < best[k])) k = i;
    inTree[k] = 1;
    if (from[k] >= 0) markPath(mesh, runs[from[k]].prev, sources[k], out);
    for (let i = 0; i < K; i++) {
      const d = runs[k].dist[sources[i]];
      if (!inTree[i] && d < best[i]) {
        best[i] = d;
        from[i] = k;
      }
    }
  }
  return out;
}

/**
 * The real railway on the mesh: each line walked in short steps, each step
 * snapped to its nearest node and joined to the last by the shortest path.
 * Every city is joined to the nearest line (its station is a short way from
 * the centre), and branches that end without reaching a city are trimmed
 * off: what's left is the railway that links these cities.
 */
export function railOnMesh(mesh, rail, sources) {
  const out = new Uint8Array(mesh.m);
  const step = mesh.h / 3;
  const scratch = { dist: new Float64Array(mesh.n), prev: new Int32Array(mesh.n) };
  const join = (u, v) => {
    if (u === v) return;
    const { prev } = dijkstra(mesh, u, { stop: v, reach: mesh.h * 6, ...scratch });
    if (prev[v] >= 0) markPath(mesh, prev, v, out);
  };
  for (const { pts } of rail.lines) {
    let last = -1;
    for (let i = 0; i + 2 < pts.length; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const v = nearestNode(mesh, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
        if (last >= 0) join(last, v);
        last = v;
      }
    }
  }
  const deg = degrees(mesh, out);
  for (const s of sources) {
    if (deg[s]) continue;
    const { dist, prev } = dijkstra(mesh, s, { reach: 8, ...scratch });
    let best = -1;
    for (let v = 0; v < mesh.n; v++) if (deg[v] && dist[v] < Infinity && (best < 0 || dist[v] < dist[best])) best = v;
    if (best >= 0) {
      markPath(mesh, prev, best, out);
      for (const e of edgesOfPath(mesh, prev, best)) { deg[mesh.a[e]]++; deg[mesh.b[e]]++; }
    }
  }
  trim(mesh, out, sources);
  return out;
}

function edgesOfPath(mesh, prev, to) {
  const out = [];
  for (let v = to; prev[v] >= 0;) {
    const e = prev[v];
    out.push(e);
    v = mesh.a[e] === v ? mesh.b[e] : mesh.a[e];
  }
  return out;
}

function degrees(mesh, use) {
  const deg = new Int32Array(mesh.n);
  for (let e = 0; e < mesh.m; e++) if (use[e]) { deg[mesh.a[e]]++; deg[mesh.b[e]]++; }
  return deg;
}

/** Cut back every branch that ends somewhere other than a city, and drop pieces no city is on. */
export function trim(mesh, use, sources) {
  const isCity = new Uint8Array(mesh.n);
  for (const s of sources) isCity[s] = 1;
  const deg = degrees(mesh, use);
  const queue = [];
  for (let v = 0; v < mesh.n; v++) if (deg[v] === 1 && !isCity[v]) queue.push(v);
  while (queue.length) {
    const v = queue.pop();
    if (deg[v] !== 1) continue;
    for (let k = mesh.start[v]; k < mesh.start[v + 1]; k++) {
      const e = mesh.via[k];
      if (!use[e]) continue;
      use[e] = 0;
      deg[v]--;
      const w = mesh.nbr[k];
      if (--deg[w] === 1 && !isCity[w]) queue.push(w);
      break;
    }
  }
  const seen = reach(mesh, use, sources);
  for (let e = 0; e < mesh.m; e++) if (use[e] && !seen[mesh.a[e]]) use[e] = 0;
  return use;
}

/** The nodes the cities can reach over `use`. */
function reach(mesh, use, sources) {
  const seen = new Uint8Array(mesh.n), stack = [...sources];
  for (const s of sources) seen[s] = 1;
  while (stack.length) {
    const v = stack.pop();
    for (let k = mesh.start[v]; k < mesh.start[v + 1]; k++) {
      if (!use[mesh.via[k]]) continue;
      const w = mesh.nbr[k];
      if (!seen[w]) { seen[w] = 1; stack.push(w); }
    }
  }
  return seen;
}

/** The mould's network: every tube at least `thick` in conductivity, on a piece a city is on. */
export function mouldNetwork(mesh, D, sources, thick = 0.01) {
  const use = new Uint8Array(mesh.m);
  for (let e = 0; e < mesh.m; e++) if (D[e] >= thick) use[e] = 1;
  const seen = reach(mesh, use, sources);
  for (let e = 0; e < mesh.m; e++) if (use[e] && !seen[mesh.a[e]]) use[e] = 0;
  return use;
}

/** TL, MD and FT of a network (as absolute km and a probability), and whether it links every city. */
export function measure(mesh, use, sources) {
  const K = sources.length;
  let TL = 0;
  for (let e = 0; e < mesh.m; e++) if (use[e]) TL += mesh.len[e];
  const scratch = { dist: new Float64Array(mesh.n), prev: new Int32Array(mesh.n) };
  let sum = 0, linked = true;
  for (let k = 0; k < K; k++) {
    const { dist } = dijkstra(mesh, sources[k], { use, ...scratch });
    for (let l = k + 1; l < K; l++) {
      const d = dist[sources[l]];
      if (d === Infinity) linked = false;
      sum += d;
    }
  }
  const MD = linked ? sum / ((K * (K - 1)) / 2) : Infinity;
  return { TL, MD, FT: linked ? 1 - cutLength(mesh, use, sources) / TL : 0, linked };
}

/**
 * The length of network where a single cut would cut a city off: the bridges
 * (edges on no loop) with a city on each side. Tarjan's bridge search, kept
 * iterative so a long line can't overflow the stack.
 */
function cutLength(mesh, use, sources) {
  const { n, start, nbr, via, len } = mesh;
  const disc = new Int32Array(n).fill(-1), low = new Int32Array(n), up = new Int32Array(n).fill(-1);
  const cities = new Int32Array(n), next = new Int32Array(n);
  for (const s of sources) cities[s] = 1;
  const K = sources.length;
  let time = 0, cut = 0;
  const root = sources[0];
  const stack = [root];
  disc[root] = low[root] = time++;
  next[root] = start[root];
  while (stack.length) {
    const v = stack[stack.length - 1];
    if (next[v] < start[v + 1]) {
      const k = next[v]++;
      const e = via[k];
      if (!use[e] || e === up[v]) continue;
      const w = nbr[k];
      if (disc[w] < 0) {
        disc[w] = low[w] = time++;
        up[w] = e;
        next[w] = start[w];
        stack.push(w);
      } else if (disc[w] < low[v]) low[v] = disc[w];
      continue;
    }
    stack.pop();
    const e = up[v];
    if (e < 0) continue;
    const u = mesh.a[e] === v ? mesh.b[e] : mesh.a[e];
    if (low[v] < low[u]) low[u] = low[v];
    cities[u] += cities[v];
    if (low[v] > disc[u] && cities[v] > 0 && cities[v] < K) cut += len[e];
  }
  return cut;
}

/** A network's scores against the spanning tree's: TL_MST, MD_MST, FT and α. */
export function relative(m, tree) {
  const TL = m.TL / tree.TL, MD = m.MD / tree.MD;
  return { TL, MD, FT: m.FT, alpha: m.FT / TL, linked: m.linked };
}
