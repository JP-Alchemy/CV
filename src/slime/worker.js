// The slime mould experiment's model, off the main thread. It builds the mesh
// and the two networks the mould is measured against (the real railway and
// the minimum spanning tree), then grows the mould: about 25 ms of steps at a
// time, then the tubes go to the page (slime/mode.js draws them) and, now and
// then, the scores. It stops by itself once the network has settled.
//
// In: { type: 'grow', I0, gamma, seed } (from scratch), 'pause', 'play'.
// Out: 'ready' (the map, the mesh and the references, once), 'frame' (t and
// every tube's conductivity), 'score' (the mould's network, measured).

import data from './nl.json';
import { readMap, buildMesh, nearestNode } from './map.js';
import { Physarum, f } from './physarum.js';
import { spanningTree, railOnMesh, mouldNetwork, measure, relative } from './networks.js';

const MESH = { h: 2.5, jitter: 0.2, seed: 7 }; // ~6,500 junctions, ~18,500 tubes
const SLICE = 25; // ms of stepping between frames
const DT = 0.25; // model time per step: small, so it changes smoothly on screen
const PACE = 5; // model time per second at most, so the thinning out can be watched
const SCORE_EVERY = 400; // ms between scores while growing
const CALM = 1.5e-4; // change per step under which the network has settled
const UNTIL = 600; // give up settling past this time (it hasn't happened in testing)

const map = readMap(data);
const mesh = buildMesh(map, MESH);
const sources = Int32Array.from(map.cities, (c) => nearestNode(mesh, c.x, c.y));
const treeUse = spanningTree(mesh, sources);
const railUse = railOnMesh(mesh, map.rail, sources);
const tree = measure(mesh, treeUse, sources);
const rail = measure(mesh, railUse, sources);
const scored = (m) => ({ ...m, rel: relative(m, tree) });

let P = null, run = 0, playing = false, timer = 0, lastScore = 0, calm = 0, settled = false, clock = 0;

postMessage({
  type: 'ready',
  box: data.box,
  map: { cols: map.cols, rows: map.rows, cell: map.cell, cls: map.cls },
  mesh: { n: mesh.n, m: mesh.m, x: mesh.x, y: mesh.y, a: mesh.a, b: mesh.b },
  sources,
  railUse,
  treeUse,
  rail: scored(rail),
  tree: scored(tree),
});

function frame() {
  const D = Float32Array.from(P.D);
  postMessage({ type: 'frame', run, t: P.t, steps: P.steps, live: P.nLive, top: f(P.I0, P.gamma), settled, D }, [D.buffer]);
}

function score() {
  const m = measure(mesh, mouldNetwork(mesh, P.D, sources, P.threshold), sources);
  postMessage({ type: 'score', run, t: P.t, mould: scored(m), settled });
  lastScore = performance.now();
}

function loop() {
  timer = 0;
  if (!playing || !P) return;
  const t0 = performance.now();
  // Model time may only run PACE per second of ours (from `clock`, when this run started).
  const allowed = ((t0 - clock) / 1000) * PACE;
  let steps = 0;
  while (P.t < allowed && performance.now() - t0 < SLICE) {
    P.step();
    steps++;
    calm = P.change() < CALM ? calm + 1 : 0;
    if (calm >= 8 || P.t >= UNTIL) { settled = true; playing = false; break; }
  }
  if (steps) frame();
  if (settled || (steps && performance.now() - lastScore > SCORE_EVERY)) score();
  if (playing) timer = setTimeout(loop, P.t < allowed ? 0 : 16);
}

onmessage = ({ data: msg }) => {
  if (msg.type === 'grow') {
    clearTimeout(timer);
    run = msg.run;
    P = new Physarum(mesh, sources, { I0: msg.I0, gamma: msg.gamma, seed: msg.seed, dt: DT });
    clock = performance.now();
    calm = 0;
    settled = false;
    playing = true;
    frame();
    score();
    timer = setTimeout(loop, 0);
  } else if (msg.type === 'pause') {
    playing = false;
    clearTimeout(timer);
  } else if (msg.type === 'play' && P && !settled) {
    playing = true;
    clock = performance.now() - (P.t / PACE) * 1000; // carry on from where it was
    clearTimeout(timer);
    timer = setTimeout(loop, 0);
  }
};
