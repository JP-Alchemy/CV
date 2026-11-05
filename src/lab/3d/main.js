// /lab/3d/: the blocks in 3D, on a page of their own. The site's own pieces
// (Renderer, attach3D, tilt3d, the engine and the real pages) plus cube
// benches, 3D shapes as engine elements (with `depth` and `ao`), and checks.

import { Renderer, STRIDE, PULSES } from '../../engine/renderer.js';
import { Engine, SHRINK } from '../../engine/engine.js';
import { typeset } from '../../engine/typeset.js';
import { bake } from '../../engine/renderer3d.js';
import { tilt3d } from '../../tilt.js';
import { buildScene } from '../../scene.js';
import { experience } from '../../content.js';
import { THEMES as BRAND, unit } from '../../brand.js';

const THEMES = Object.fromEntries(Object.entries(BRAND).map(([k, t]) => [k, { bg: unit(t.bg), fg: unit(t.fg) }]));
const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
const r = new Renderer(canvas);
const engine = new Engine(r);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
engine.calm = reduce.matches;
reduce.addEventListener?.('change', (e) => { engine.calm = e.matches; });

const L = {
  scene: Q.get('scene') || 'home',
  theme: Q.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  sort: Q.get('sort') || 'f2b',
  flat2d: false, // draw with the 2D renderer even when tilted (to compare)
  own: null, // { buf, n } when the lab owns the instances (benches)
  shape: null,
  hit: '',
};
let pageScene = null;
const pulses = { data: new Float32Array(PULSES * 4), n: 0 };
const dpr = () => Math.min(window.devicePixelRatio || 1, 3);
const vw = () => canvas.clientWidth || innerWidth;
const vh = () => canvas.clientHeight || innerHeight;
const kick = () => {};
const T = tilt3d({ renderer: r, engine, kick, surface: canvas, height: () => pageScene?.height ?? vh() });

// ?cull=1: also let the GPU drop back faces (front faces wind alike; y-down makes them clockwise, so cull FRONT).
if (Q.get('cull') === '1') {
  const gl = r.gl, draw = gl.drawArraysInstanced.bind(gl);
  gl.drawArraysInstanced = (m, f, n, c) => {
    if (m !== gl.TRIANGLE_FAN) return draw(m, f, n, c);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); draw(m, f, n, c); gl.disable(gl.CULL_FACE);
  };
}

function resize() {
  r.resize(vw(), vh(), dpr());
  engine.vw = vw(); engine.vh = vh();
}

// ---------------------------------------------------------------- scenes

function page(name) {
  const st = {
    route: { name }, hover: null, expanded: new Set([experience[0].id]), copied: false, menuOpen: false,
    theme: L.theme, touch: matchMedia('(pointer: coarse)').matches, fullscreen: false, storyEls: null,
  };
  pageScene = buildScene(st, { w: vw(), h: vh() });
  engine.gridX = pageScene.S.left;
  document.getElementById('spacer').style.height = `${pageScene.height}px`;
  return pageScene;
}

/** n cubes in a lattice with gaps, so in 3D nearly all of them show: the overdraw test. Instances the lab owns. */
function lattice(n) {
  const m = Math.ceil(Math.cbrt(n)), W = vw(), H = vh();
  const step = Math.min(W, H) * 0.62 / m, s = Math.max(1, step * 0.7);
  const buf = new Float32Array(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const x = i % m, y = ((i / m) | 0) % m, z = (i / (m * m)) | 0;
    const band = (x + y + z) % 23, tone = band < 7 && y % 5 === 0 ? 2 + band : 1;
    const px = W / 2 + (x - m / 2) * step, py = H / 2 + (y - m / 2) * step, pz = (m / 2 - z) * step;
    engine.w(buf, i * STRIDE, px, py, s, s, tone, px, py, s, s, tone, 0, 0, 0, 0, 0, 0, null, pz, pz);
  }
  return { buf, n };
}

/** A 3D shape as an engine element: blocks, and per block a depth and an occlusion mask. Centred on the screen. */
function shapeEl(name) {
  const W = vw(), H = vh(), top = window.scrollY, cubes = [];
  let cell;
  if (name === 'jp') {
    cell = Math.round(Math.min(W, H) * 0.05);
    const t = typeset('JP', { size: cell, bold: true });
    for (let d = 0; d < 4; d++) for (let i = 0; i < t.blocks.length; i += 5) cubes.push(t.blocks[i] - t.width / 2, t.blocks[i + 1] - t.height / 2, (1.5 - d) * cell);
  } else {
    cell = W < 700 ? 6 : 8;
    const R = Math.min(W, H) * 0.3, m = Math.ceil(R / cell) + 1;
    for (let x = -m; x <= m; x++) for (let y = -m; y <= m; y++) for (let z = -m; z <= m; z++) {
      const d = Math.hypot(x, y, z) * cell;
      if (d <= R && d > R - cell * 1.8) cubes.push(x * cell, y * cell, z * cell);
    }
  }
  const masks = bake(cubes, cell), blocks = [], depth = [], ao = [];
  for (let i = 0; i < masks.length; i++) {
    if (masks[i] < 0) continue; // inside: never seen
    const x = cubes[i * 3], y = cubes[i * 3 + 1], z = cubes[i * 3 + 2];
    const ring = name === 'sphere' && Math.abs(y) < cell * 1.5; // a band of light round its middle
    blocks.push(W / 2 + x - cell / 2, top + H / 2 + y - cell / 2, cell, cell, ring ? 2 + Math.floor(((Math.atan2(z, x) / Math.PI + 1) / 2) * 7) % 7 : 1);
    depth.push(z + cell / 2);
    ao.push(masks[i]);
  }
  return { key: 'lab:shape', sig: `shape|${name}|${W}|${H}|${top}`, x: 0, y: 0, w: 0, h: 0, blocks: Float32Array.from(blocks), depth: Float32Array.from(depth), ao: Float32Array.from(ao) };
}

/** Page -> shape (and back with null): an ordinary page morph; the engine carries the depth. */
function morph(name) {
  L.shape = name;
  const els = name ? [...pageScene.elements.filter((e) => e.fixed), shapeEl(name)] : pageScene.elements;
  engine.morphTo({ elements: els }, { mode: 'page', scrollFrom: window.scrollY, scrollTo: window.scrollY });
  T.set(!!name, !!name);
  ui();
}

function load(name) {
  L.scene = name;
  L.shape = null;
  L.own = null;
  const bench = { '10k': 1e4, '50k': 5e4, '200k': 2e5 }[name];
  if (bench) {
    engine.morphTo({ elements: [] }, { mode: 'local' });
    L.own = lattice(bench);
    sortOwn();
    r.setInstances(L.own.buf, L.own.n);
    document.getElementById('spacer').style.height = '0px';
    if (!Q.has('tilt')) T.set(true);
  } else {
    engine.morphTo(page(name), { mode: 'intro', scrollTo: window.scrollY });
  }
  ui();
}

/** Order the benches' instances front to back (or back to front, the worst case) for the tilted camera. */
function sortOwn() {
  const S = L.own;
  if (!S || L.sort === 'none') return;
  const k = T.k, kTo = T.kTo;
  T.k = 1; T.kTo = 1; T.step();
  const e = T.cam.c ? T.cam.c.eye : [0, 0, 1];
  T.k = k; T.kTo = kTo; T.step();
  const n = S.n, key = new Float64Array(n), idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    key[i] = (L.sort === 'f2b' ? -1 : 1) * (S.buf[o + 4] * e[0] + S.buf[o + 5] * e[1] + S.buf[o + 23] * e[2]);
    idx[i] = i;
  }
  idx.sort((i, j) => key[i] - key[j]);
  const out = new Float32Array(S.buf.length);
  for (let i = 0; i < n; i++) out.set(S.buf.subarray(idx[i] * STRIDE, idx[i] * STRIDE + STRIDE), i * STRIDE);
  S.buf = out;
}

// ---------------------------------------------------------------- frame

let fps = 0, frames = 0, fpsAt = performance.now();
function frame(now) {
  frames++;
  if (now - fpsAt > 1000) { fps = frames * 1000 / (now - fpsAt); frames = 0; fpsAt = now; stats(); }
  T.step(now);
  if (L.shape && !engine.calm && !T.dragging) T.yaw = Math.max(-1.5, Math.min(0.9, T.yaw + 0.002)); // a slow turn
  const t = engine.now();
  if (!L.own) engine.tick(t);
  draw(t);
  requestAnimationFrame(frame);
}

function draw(t) {
  const Th = THEMES[L.theme], S = pageScene?.S;
  const scroll = L.own ? 0 : window.scrollY;
  if (L.flat2d) T.cam.on = false;
  r.draw({
    time: t, scroll, shrink: SHRINK,
    navClip: S && !L.own ? Math.min(scroll, S.navClip) : -1e6,
    cam: null, themeA: Th, themeB: Th, themeT: 2, themeOrigin: [0, 0],
    gridOrigin: [S ? S.left : 0, 0], gridStep: 16, mouse: [-1e4, -1e4], dotAlpha: 0.075,
    trail: null, pushR: 130, pushGain: 0.45, pulses, pulseSpeed: 1100, pulseWidth: 150, layers: [],
  });
}

// ---------------------------------------------------------------- picking

canvas.addEventListener('click', (e) => {
  const data = L.own ? L.own.buf : engine.buf, n = L.own ? L.own.n : engine.count, scroll = L.own ? 0 : window.scrollY;
  const t0 = performance.now();
  const i = T.k ? T.cam.pick(data, n, e.clientX, e.clientY, scroll) : -1;
  const ms = performance.now() - t0;
  const [px, py] = T.pointer(e.clientX, e.clientY);
  let key = 'nothing';
  if (i >= 0 && L.own) key = `cube ${i}`;
  else if (i >= 0) { for (const R of engine.list) if (i >= R.off && i < R.off + R.n) key = R.key; }
  L.hit = `${key} · page (${px.toFixed(0)}, ${(py + scroll).toFixed(0)}) · ${ms.toFixed(1)} ms over ${n} blocks`;
  if (pulses.n === PULSES) pulses.data.copyWithin(0, 4);
  pulses.n = Math.min(PULSES, pulses.n + 1);
  pulses.data.set([px, py + scroll, engine.now(), 1], (pulses.n - 1) * 4);
  stats();
});

// ---------------------------------------------------------------- measuring

/** Milliseconds a frame, forced: draw `frames` times, then wait for the GPU (readPixels). */
function time(frames = 30) {
  const gl = r.gl, px = new Uint8Array(4), t = engine.now();
  draw(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) draw(t);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (performance.now() - t0) / frames;
}

/** Ms a frame for the 2D renderer (flat) and 3D (tilted), by size and draw order. */
function bench(sizes = ['10k', '50k', '200k'], sorts = ['f2b', 'b2f']) {
  const keep = { scene: L.scene, sort: L.sort };
  const rows = [];
  for (const size of sizes) for (const sort of sorts) {
    L.sort = sort;
    load(size);
    for (const mode of ['2D', '3D']) {
      T.k = T.kTo = mode === '3D' ? 1 : 0; T.step();
      time(5);
      const ms = Math.min(time(20), time(20));
      rows.push({ size, sort, mode, ms: +ms.toFixed(2), fps: Math.round(Math.min(1000 / ms, 999)) });
    }
  }
  Object.assign(L, keep);
  load(L.scene);
  document.getElementById('out').textContent = `${vw()}×${vh()} @${dpr()}x\n` + rows.map((x) => `${x.size.padEnd(5)} ${x.sort} ${x.mode} ${String(x.ms).padStart(6)} ms  ${x.fps} fps`).join('\n');
  return rows;
}

/** Straight on, does 3D draw today's page exactly? Pixels that differ from the 2D renderer. */
function parity() {
  const gl = r.gl, W = canvas.width, H = canvas.height, t = engine.now();
  const keep = [T.k, T.kTo];
  T.k = T.kTo = 0; T.step();
  const grab = (on) => { T.cam.on = on; draw(t); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const a = grab(false), b = grab(true);
  let differ = 0, max = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (d) differ++;
    if (d > max) max = d;
  }
  [T.k, T.kTo] = keep; T.step();
  const out = { differ, of: W * H, maxDelta: max };
  document.getElementById('out').textContent = `parity (${W}×${H}): ${JSON.stringify(out)}`;
  return out;
}

// ---------------------------------------------------------------- panel

function stats() {
  const n = L.own ? L.own.n : engine.count;
  document.querySelector('#panel summary').textContent = `3D lab · ${fps.toFixed(0)} fps · ${n.toLocaleString()} blocks`;
  const el = document.getElementById('stat');
  if (el) el.textContent = `${canvas.width}×${canvas.height}${engine.calm ? ' · calm' : ''}${L.hit ? `\nhit: ${L.hit}` : ''}`;
}

function ui() {
  const el = document.getElementById('ui');
  const btn = (label, on, fn) => `<button aria-pressed="${on}" data-fn="${fn}">${label}</button>`;
  el.innerHTML = [
    `<div class="row"><b>scene</b>${['home', 'cv', '10k', '50k', '200k'].map((s) => btn(s, L.scene === s, `scene:${s}`)).join('')}</div>`,
    `<div class="row"><b>view</b>${btn('tilt (3)', T.kTo > 0, 'tilt')}${['sphere', 'jp'].map((s) => btn(`→ ${s}`, L.shape === s, `shape:${s}`)).join('')}${btn(L.theme, false, 'theme')}${btn('2D', L.flat2d, 'flat2d')}</div>`,
    `<div class="row"><b>order</b>${['f2b', 'b2f', 'none'].map((s) => btn(s, L.sort === s, `sort:${s}`)).join('')}</div>`,
    `<div class="row"><b>test</b>${btn('bench', false, 'bench')}${btn('parity', false, 'parity')}</div>`,
    '<div id="stat"></div>',
  ].join('');
  stats();
}

document.getElementById('ui').addEventListener('click', (e) => {
  const fn = e.target.closest('button')?.dataset.fn;
  if (!fn) return;
  const [k, v] = fn.split(':');
  if (k === 'scene') load(v);
  if (k === 'tilt') T.toggle();
  if (k === 'shape' && !L.own) morph(L.shape === v ? null : v);
  if (k === 'theme') { L.theme = L.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = L.theme; if (!L.own && !L.shape) load(L.scene); }
  if (k === 'flat2d') L.flat2d = !L.flat2d;
  if (k === 'sort') { L.sort = v; if (L.own) load(L.scene); }
  if (k === 'bench') bench();
  if (k === 'parity') parity();
  ui();
});
addEventListener('keydown', (e) => { if (e.key === '3') setTimeout(ui); });

if (Q.get('tilt') === '1') T.set(true);
document.documentElement.dataset.theme = L.theme;
resize();
addEventListener('resize', () => { resize(); if (!L.shape) load(L.scene); });
load(L.scene);
requestAnimationFrame(frame);
window.__lab = { L, T, r, engine, bench, parity, time, load, morph };
