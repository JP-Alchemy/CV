// The pressures, solved directly. Each step the tubes' conductivities make a
// weighted graph Laplacian, and every city needs a solve of it. The mesh is
// planar, so numbered by nested dissection (cut the nodes in two across their
// longer side, number each half first and the nodes on the cut last, and so
// on down) its Cholesky factor stays sparse: one factorisation per step, then
// a pair of triangular solves per city. The factorisation is the up-looking
// kind (as in Tim Davis's CSparse), on a pattern worked out once for the
// whole mesh. Dead tubes are zeros in it, and every node gets a tiny leak to
// ground so a node whose tubes have all died stays solvable (at 0).

const LEAK = 1e-10;

export class Cholesky {
  /** mesh: from buildMesh. ground: the node held at pressure 0. */
  constructor(mesh, ground) {
    const { n, start, nbr, via } = mesh;
    this.mesh = mesh;
    this.n = n;
    this.ground = ground;
    const perm = dissect(mesh), iperm = new Int32Array(n);
    for (let k = 0; k < n; k++) iperm[perm[k]] = k;
    this.perm = perm;
    this.iperm = iperm;
    // The upper triangle of the permuted matrix, by column: for column k (node
    // perm[k]) the rows i < k it shares a tube with, and that tube.
    const Ap = new Int32Array(n + 1), Ai = [], Ae = [];
    for (let k = 0; k < n; k++) {
      const v = perm[k];
      for (let p = start[v]; p < start[v + 1]; p++) {
        const i = iperm[nbr[p]];
        if (i < k) { Ai.push(i); Ae.push(via[p]); }
      }
      Ap[k + 1] = Ai.length;
    }
    this.Ap = Ap;
    this.Ai = Int32Array.from(Ai);
    this.Ae = Int32Array.from(Ae);
    // Elimination tree (Liu), with path compression.
    const parent = new Int32Array(n).fill(-1), ancestor = new Int32Array(n).fill(-1);
    for (let k = 0; k < n; k++) {
      for (let p = Ap[k]; p < Ap[k + 1]; p++) {
        for (let i = this.Ai[p]; i !== -1 && i < k;) {
          const next = ancestor[i];
          ancestor[i] = k;
          if (next === -1) parent[i] = k;
          i = next;
        }
      }
    }
    this.parent = parent;
    this.s = new Int32Array(n);
    this.flag = new Int32Array(n).fill(-1);
    // Column counts: one symbolic pass of the factorisation.
    const count = new Int32Array(n).fill(1);
    for (let k = 0; k < n; k++) {
      for (let top = this.reach(k); top < n; top++) count[this.s[top]]++;
    }
    const Lp = new Int32Array(n + 1);
    for (let k = 0; k < n; k++) Lp[k + 1] = Lp[k] + count[k];
    this.Lp = Lp;
    this.Li = new Int32Array(Lp[n]);
    this.Lx = new Float64Array(Lp[n]);
    this.c = new Int32Array(n);
    this.x = new Float64Array(n);
    this.diag = new Float64Array(n);
    this.y = new Float64Array(n);
  }

  /** The nonzero pattern of row k of L, in s[top..n-1], in topological order (CSparse's ereach). */
  reach(k) {
    const { Ap, Ai, parent, s, flag, n } = this;
    let top = n;
    flag[k] = k;
    for (let p = Ap[k]; p < Ap[k + 1]; p++) {
      let len = 0;
      for (let i = Ai[p]; flag[i] !== k; i = parent[i]) {
        s[len++] = i;
        flag[i] = k;
      }
      while (len > 0) s[--top] = s[--len];
    }
    return top;
  }

  /** Factorise for conductances w (per tube: D / L). */
  factor(w) {
    const { n, mesh, perm, Ap, Ai, Ae, Lp, Li, Lx, c, x, s, diag, ground } = this;
    const { a, b } = mesh;
    diag.fill(LEAK);
    for (let e = 0; e < mesh.m; e++) {
      diag[a[e]] += w[e];
      diag[b[e]] += w[e];
    }
    this.flag.fill(-1);
    for (let k = 0; k < n; k++) c[k] = Lp[k];
    for (let k = 0; k < n; k++) {
      const top = this.reach(k);
      const v = perm[k];
      x[k] = v === ground ? 1 : diag[v];
      if (v !== ground) {
        for (let p = Ap[k]; p < Ap[k + 1]; p++) {
          const e = Ae[p];
          x[Ai[p]] = a[e] === ground || b[e] === ground ? 0 : -w[e];
        }
      }
      let d = x[k];
      x[k] = 0;
      for (let t = top; t < n; t++) {
        const i = s[t];
        const lki = x[i] / Lx[Lp[i]];
        x[i] = 0;
        for (let p = Lp[i] + 1; p < c[i]; p++) x[Li[p]] -= Lx[p] * lki;
        d -= lki * lki;
        const p = c[i]++;
        Li[p] = k;
        Lx[p] = lki;
      }
      const p = c[k]++;
      Li[p] = k;
      Lx[p] = Math.sqrt(d > LEAK ? d : LEAK);
    }
  }

  /** Solve for the pressures when a unit flux enters at node `src` (and leaves at ground). out: per node. */
  solveUnit(src, out) {
    const { n, perm, iperm, Lp, Li, Lx, y } = this;
    y.fill(0);
    y[iperm[src]] = 1;
    for (let j = iperm[src]; j < n; j++) { // L y = b: nothing above the source's position is touched
      if (y[j] === 0) continue;
      y[j] /= Lx[Lp[j]];
      const yj = y[j];
      for (let p = Lp[j] + 1; p < Lp[j + 1]; p++) y[Li[p]] -= Lx[p] * yj;
    }
    for (let j = n - 1; j >= 0; j--) { // L' x = y
      let v = y[j];
      for (let p = Lp[j] + 1; p < Lp[j + 1]; p++) v -= Lx[p] * y[Li[p]];
      y[j] = v / Lx[Lp[j]];
    }
    for (let k = 0; k < n; k++) out[perm[k]] = y[k];
    out[this.ground] = 0;
    return out;
  }

  get fill() { return this.Lp[this.n]; }
}

/** Nested dissection on the nodes' positions: a fill-reducing order for a planar mesh. */
function dissect(mesh) {
  const { n, x, y, start, nbr } = mesh;
  const order = new Int32Array(n);
  let at = 0;
  const side = new Int8Array(n); // scratch: 1 left, 2 right
  const go = (nodes) => {
    if (nodes.length <= 48) {
      for (const v of nodes) order[at++] = v;
      return;
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const v of nodes) {
      if (x[v] < x0) x0 = x[v];
      if (x[v] > x1) x1 = x[v];
      if (y[v] < y0) y0 = y[v];
      if (y[v] > y1) y1 = y[v];
    }
    const key = x1 - x0 >= y1 - y0 ? x : y;
    const sorted = nodes.slice().sort((p, q) => key[p] - key[q]);
    const half = sorted.length >> 1;
    for (let k = 0; k < sorted.length; k++) side[sorted[k]] = k < half ? 1 : 2;
    const left = [], right = [], cut = [];
    for (let k = 0; k < sorted.length; k++) {
      const v = sorted[k];
      if (side[v] === 2) { right.push(v); continue; }
      let touches = false;
      for (let p = start[v]; p < start[v + 1]; p++) if (side[nbr[p]] === 2) { touches = true; break; }
      (touches ? cut : left).push(v);
    }
    for (const v of nodes) side[v] = 0;
    go(left);
    go(right);
    for (const v of cut) order[at++] = v;
  };
  go(Array.from({ length: n }, (_, i) => i));
  return order;
}
