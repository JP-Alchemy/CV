// The slime mould's arena (nl.json, made by scripts/slime-map.py): the
// Netherlands on a 610 m grid, the 40 cities it feeds on and the real railway.
// Here it becomes what the model needs: a mesh of tubes over the land, in km
// from the map's top-left corner, y running south.

export const LAND = 1, CROSSABLE = 2, OPEN_WATER = 3, ISLAND = 4;

/** nl.json, decoded: the class grid, and the cities and rail lines in map km. */
export function readMap(data) {
  const { x0, y0, cell, cols, rows } = data.grid;
  const runs = Uint8Array.from(atob(data.map), (c) => c.charCodeAt(0));
  const cls = new Uint8Array(cols * rows);
  for (let k = 0, i = 0; k < runs.length; k += 2) {
    cls.fill(runs[k], i, i + runs[k + 1]);
    i += runs[k + 1];
  }
  const km = (x, y) => [(x - x0) / 1000, (y0 - y) / 1000];
  const flat = (xy) => {
    const out = new Float32Array(xy.length);
    for (let i = 0; i < xy.length; i += 2) [out[i], out[i + 1]] = km(xy[i], xy[i + 1]);
    return out;
  };
  return {
    cols, rows, cls,
    cell: cell / 1000,
    w: (cols * cell) / 1000,
    h: (rows * cell) / 1000,
    cities: data.cities.map(([name, x, y, pop]) => {
      const [cx, cy] = km(x, y);
      return { name, pop, x: cx, y: cy };
    }),
    rail: {
      nodes: data.rail.nodes.map(([x, y]) => km(x, y)),
      lines: data.rail.lines.map(([a, b, xy]) => ({ a, b, pts: flat(xy) })),
    },
  };
}

/** The class of the map at (x, y) km. */
export function classAt(map, x, y) {
  const i = Math.floor(x / map.cell), j = Math.floor(y / map.cell);
  return i < 0 || j < 0 || i >= map.cols || j >= map.rows ? 0 : map.cls[j * map.cols + i];
}

const growable = (map, x, y) => {
  const c = classAt(map, x, y);
  return c === LAND || c === CROSSABLE;
};

/** A seeded random number generator (mulberry32), so a run can be repeated. */
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The tubes the mould starts with: a triangular lattice over the land, `h` km
 * apart, each node nudged at random so no line runs straighter than the
 * mould would grow it. An edge is a tube where both ends are on land and it
 * doesn't cross open water. Only the largest connected piece is kept.
 */
export function buildMesh(map, { h = 2.5, jitter = 0.2, seed = 7 } = {}) {
  const rnd = random(seed);
  const dy = (h * Math.sqrt(3)) / 2;
  const nx = Math.ceil(map.w / h) + 2, ny = Math.ceil(map.h / dy) + 2;
  const at = new Int32Array(nx * ny).fill(-1);
  const X = [], Y = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = i * h + (j & 1 ? h / 2 : 0) + (rnd() * 2 - 1) * jitter * h;
      const y = j * dy + (rnd() * 2 - 1) * jitter * h;
      if (!growable(map, x, y)) continue;
      at[j * nx + i] = X.length;
      X.push(x);
      Y.push(y);
    }
  }
  const A = [], B = [];
  const link = (p, q) => {
    if (p < 0 || q < 0) return;
    for (const s of [0.25, 0.5, 0.75]) {
      if (!growable(map, X[p] + (X[q] - X[p]) * s, Y[p] + (Y[q] - Y[p]) * s)) return;
    }
    A.push(p);
    B.push(q);
  };
  const node = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? -1 : at[j * nx + i]);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = node(i, j);
      if (p < 0) continue;
      link(p, node(i + 1, j));
      const s = j & 1 ? 0 : -1; // the row below sits half a step right of this one
      link(p, node(i + s, j + 1));
      link(p, node(i + s + 1, j + 1));
    }
  }
  return keepLargest({ x: X, y: Y, a: A, b: B, h });
}

function keepLargest({ x, y, a, b, h }) {
  const n = x.length;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let e = 0; e < a.length; e++) parent[find(a[e])] = find(b[e]);
  const size = new Int32Array(n);
  for (let i = 0; i < n; i++) size[find(i)]++;
  let root = 0;
  for (let i = 0; i < n; i++) if (size[i] > size[root]) root = i;
  const id = new Int32Array(n).fill(-1);
  const X = [], Y = [];
  for (let i = 0; i < n; i++) {
    if (find(i) !== root) continue;
    id[i] = X.length;
    X.push(x[i]);
    Y.push(y[i]);
  }
  const ea = [], eb = [];
  for (let e = 0; e < a.length; e++) {
    if (id[a[e]] < 0) continue;
    ea.push(id[a[e]]);
    eb.push(id[b[e]]);
  }
  return meshOf(Float32Array.from(X), Float32Array.from(Y), Int32Array.from(ea), Int32Array.from(eb), h);
}

/** The mesh with its lengths, its adjacency (CSR: each node's edges) and a bucket grid for lookups. */
function meshOf(x, y, a, b, h) {
  const n = x.length, m = a.length;
  const len = new Float32Array(m);
  for (let e = 0; e < m; e++) len[e] = Math.hypot(x[b[e]] - x[a[e]], y[b[e]] - y[a[e]]);
  const start = new Int32Array(n + 1);
  for (let e = 0; e < m; e++) {
    start[a[e] + 1]++;
    start[b[e] + 1]++;
  }
  for (let i = 0; i < n; i++) start[i + 1] += start[i];
  const fill = start.slice(0, n);
  const nbr = new Int32Array(2 * m), via = new Int32Array(2 * m);
  for (let e = 0; e < m; e++) {
    nbr[fill[a[e]]] = b[e];
    via[fill[a[e]]++] = e;
    nbr[fill[b[e]]] = a[e];
    via[fill[b[e]]++] = e;
  }
  const bw = Math.ceil(Math.max(...x) / h) + 1, bh = Math.ceil(Math.max(...y) / h) + 1;
  const bucket = Array.from({ length: bw * bh }, () => []);
  for (let i = 0; i < n; i++) bucket[Math.floor(y[i] / h) * bw + Math.floor(x[i] / h)].push(i);
  return { n, m, x, y, a, b, len, start, nbr, via, h, bucket, bw, bh };
}

/** The mesh node nearest (x, y) km. */
export function nearestNode(mesh, x, y) {
  const { h, bucket, bw, bh } = mesh;
  const ci = Math.floor(x / h), cj = Math.floor(y / h);
  let best = -1, bd = Infinity;
  for (let r = 1; best < 0 || r <= 2; r++) {
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= bw || j >= bh) continue;
        for (const k of bucket[j * bw + i]) {
          const d = (mesh.x[k] - x) ** 2 + (mesh.y[k] - y) ** 2;
          if (d < bd) { bd = d; best = k; }
        }
      }
    }
    if (r > 40) break;
  }
  return best;
}
