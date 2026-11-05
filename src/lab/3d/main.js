// /lab/3d/: the block renderer in 3D, on its own page. The real engine and
// the real pages, drawn by Renderer3D (renderer3d.js), plus cube benches and
// a morph from the page's text into a 3D shape. Nothing here touches the site.

import { STRIDE, PULSES, TRAIL } from '../../engine/renderer.js';
import { Engine, SHRINK, PROFILES } from '../../engine/engine.js';
import { typeset } from '../../engine/typeset.js';
import { buildScene } from '../../scene.js';
import { experience } from '../../content.js';
import { THEMES as BRAND, unit } from '../../brand.js';
import { Renderer3D, bake } from './renderer3d.js';

const THEMES = Object.fromEntries(Object.entries(BRAND).map(([k, t]) => [k, { bg: unit(t.bg), fg: unit(t.fg) }]));
const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
const r = new Renderer3D(canvas);
const engine = new Engine(r);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
engine.calm = reduce.matches;
reduce.addEventListener?.('change', (e) => { engine.calm = e.matches; });

const L = {
  mode: Q.get('mode') || 'B',
  scene: Q.get('scene') || 'home',
  theme: Q.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  sort: Q.get('sort') || 'f2b',
  k: 0, kTo: Number(Q.get('tilt') || 0), // tilt: 0 flat .. 1
  yaw: 0, pitch: 0, // dragged
  sm: 0, // 0 the page's camera .. 1 a shape's
  own: null, // { buf, n, until, back } when the lab owns the instances (benches, shapes)
  shape: null,
  hit: '',
};
r.mode = L.mode;
// ?cull=1: also let the GPU drop back faces (B winds front faces alike; y-down makes them clockwise, so cull FRONT).
if (Q.get('cull') === '1') {
  const gl = r.gl, draw = gl.drawArraysInstanced.bind(gl);
  gl.drawArraysInstanced = (m, f, n, c) => {
    if (m !== gl.TRIANGLE_FAN) return draw(m, f, n, c);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); draw(m, f, n, c); gl.disable(gl.CULL_FACE);
  };
}
let pageScene = null;
const pulses = { data: new Float32Array(PULSES * 4), n: 0 };
const list = [];

const dpr = () => Math.min(window.devicePixelRatio || 1, 3);
const vw = () => canvas.clientWidth || innerWidth;
const vh = () => canvas.clientHeight || innerHeight;
const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = () => (Math.random() < 0.5 ? -1 : 1);

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

/** One instance at rest (or moving from -> to), with depth. */
function put(a, o, x, y, s, z, tone, layer = 0, ao = 0) {
  engine.w(a, o, x, y, s, s, tone, x, y, s, s, tone, 0, 0, 0, 0, layer, 0);
  a[o + 8] = ao; // edge occlusion mask (renderer3d.js bake())
  a[o + 22] = a[o + 23] = z;
}

/** n cubes in a lattice with gaps, so in 3D nearly all of them show: the overdraw test. */
function lattice(n) {
  const m = Math.ceil(Math.cbrt(n)), W = vw(), H = vh();
  const step = Math.min(W, H) * 0.62 / m, s = Math.max(1, step * 0.7);
  const buf = new Float32Array(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const x = i % m, y = ((i / m) | 0) % m, z = (i / (m * m)) | 0;
    const band = (x + y + z) % 23;
    const tone = band < 7 && (y % 5 === 0) ? 2 + band : 1;
    put(buf, i * STRIDE, W / 2 + (x - m / 2) * step, H / 2 + (y - m / 2) * step, s, (m / 2 - z) * step, tone);
  }
  return { buf, n };
}

/** Shapes to morph into: [x, y, z, ...] cube corners on a grid of `cell`, around (0, 0, 0). */
function shape(name) {
  const W = vw(), H = vh(), out = [];
  if (name === 'jp') {
    const cell = Math.round(Math.min(W, H) * 0.05);
    const t = typeset('JP', { size: cell, bold: true });
    for (let d = 0; d < 4; d++) {
      for (let i = 0; i < t.blocks.length; i += 5) out.push(t.blocks[i] - t.width / 2, t.blocks[i + 1] - t.height / 2, (1.5 - d) * cell);
    }
    return { cubes: out, cell };
  }
  const cell = W < 700 ? 6 : 8, R = Math.min(W, H) * 0.3;
  const m = Math.ceil(R / cell) + 1;
  for (let x = -m; x <= m; x++) for (let y = -m; y <= m; y++) for (let z = -m; z <= m; z++) {
    const d = Math.hypot(x, y, z) * cell;
    if (d <= R && d > R - cell * 1.8) out.push(x * cell, y * cell, z * cell);
  }
  return { cubes: out, cell };
}

/** Page blocks on screen (doc space), as [x, y, w, h, tone] from the engine's buffer. */
function pageBlocks(fixed) {
  const a = engine.buf, out = [], top = window.scrollY;
  for (let i = 0; i < engine.count; i++) {
    const o = i * STRIDE, fx = (a[o + 19] & 1) !== 0;
    if (fx !== fixed || a[o + 6] <= 0) continue;
    if (!fx && (a[o + 5] + a[o + 7] < top || a[o + 5] > top + vh())) continue;
    out.push(i);
  }
  return out;
}

/** Morph the page's blocks into a 3D shape (and back, with `back`). */
function morph(name) {
  const t = engine.now(), W = vw(), H = vh(), top = window.scrollY, a = engine.buf;
  const P = PROFILES.page;
  const nav = pageBlocks(true), src = pageBlocks(false).sort((i, j) => a[i * STRIDE + 4] - a[j * STRIDE + 4]);
  if (!name) {
    // Back: every page block comes from the cube that took its place.
    const S = L.own, n = engine.count, buf = new Float32Array(n * STRIDE);
    const from = S.order;
    let until = 0;
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE;
      buf.set(a.subarray(o, o + STRIDE), o);
      const f = from.get(i);
      if (f === undefined) continue;
      const q = f * STRIDE, B = S.buf;
      const t0 = t + (1 - B[q + 4] / W) * P.wave + rnd(0, P.jitter), dur = rnd(P.dur[0], P.dur[1]) * 1.3;
      engine.w(buf, o, B[q + 4], B[q + 5], B[q + 6], B[q + 7], B[q + 17], a[o + 4], a[o + 5], a[o + 6], a[o + 7], a[o + 17],
        t0, dur, sgn() * rnd(0.2, 1) * P.arc, sgn() * rnd(0.3, 1) * P.tumble * 2, a[o + 18], a[o + 19] & 3);
      buf[o + 22] = B[q + 23]; buf[o + 23] = 0;
      until = Math.max(until, t0 + dur);
    }
    L.own = { buf, n, until, back: true };
    L.shape = null;
    L.kTo = 0;
    r.setInstances(buf, n);
    return;
  }
  const { cubes, cell } = shape(name);
  const ao = bake(cubes, cell);
  const keep = [];
  for (let i = 0; i < ao.length; i++) if (ao[i] >= 0) keep.push(i);
  keep.sort((i, j) => cubes[i * 3] - cubes[j * 3]);
  const n = nav.length + keep.length, buf = new Float32Array(n * STRIDE);
  nav.forEach((i, k) => buf.set(a.subarray(i * STRIDE, i * STRIDE + STRIDE), k * STRIDE));
  const order = new Map(); // page instance -> the cube it became (for the way back)
  const cx = W / 2, cy = top + H / 2;
  let until = 0;
  keep.forEach((c, k) => {
    const o = (nav.length + k) * STRIDE;
    const s = src.length ? src[Math.floor(k * src.length / keep.length)] : -1, q = s * STRIDE;
    const x = cx + cubes[c * 3] - cell / 2, y = cy + cubes[c * 3 + 1] - cell / 2, z = cubes[c * 3 + 2] + cell / 2;
    const tone = Math.hypot(cubes[c * 3], cubes[c * 3 + 2]) < cell * 3 && name === 'sphere' ? 4 : 1; // a ring of light round the middle
    const t0 = t + (s >= 0 ? a[q + 4] / W : 0.5) * P.wave + rnd(0, P.jitter), dur = rnd(P.dur[0], P.dur[1]) * 1.3;
    if (s >= 0) {
      engine.w(buf, o, a[q + 4], a[q + 5], a[q + 6], a[q + 7], a[q + 17], x, y, cell, cell, tone,
        t0, dur, sgn() * rnd(0.2, 1) * P.arc, sgn() * rnd(0.3, 1) * P.tumble * 2, 0, 0);
      buf[o + 8] = ao[c];
      if (!order.has(s)) order.set(s, nav.length + k);
    } else put(buf, o, x, y, cell, z, tone, 0, ao[c]);
    buf[o + 22] = 0; buf[o + 23] = z;
    until = Math.max(until, t0 + dur);
  });
  // Page blocks with no cube of their own ride along with a neighbour's.
  src.forEach((s, k) => { if (!order.has(s)) order.set(s, nav.length + Math.floor(k * keep.length / src.length)); });
  L.own = { buf, n, until, order };
  L.shape = name;
  L.kTo = 1;
  r.setInstances(buf, n);
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
    if (!Q.has('tilt')) L.kTo = 1;
  } else {
    engine.morphTo(page(name), { mode: 'intro', scrollTo: window.scrollY });
  }
  ui();
}

/** Order the lab's own instances front to back (or back to front, the worst case) for the current camera. */
function sortOwn() {
  const S = L.own;
  if (!S || S.order || L.sort === 'none') return;
  view();
  const e = camEye();
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

function camEye() {
  const V = r.view, ct = Math.cos(V.tilt), st = Math.sin(V.tilt), cy = Math.cos(V.yaw), sy = Math.sin(V.yaw);
  return [-sy, cy * st, cy * ct];
}

// ---------------------------------------------------------------- camera

function view() {
  const k = L.k, M = Math.max(vw(), vh());
  r.view.k = k;
  // A page lies back like a runway; a shape is seen nearly face on.
  const m = L.sm;
  r.view.tilt = k * (-0.85 + 0.53 * m + L.pitch);
  r.view.yaw = k * (0.42 - 0.12 * m + L.yaw);
  r.view.s = k / (1.4 * M);
  if (!k) r.view.tilt = r.view.yaw = r.view.s = 0;
}

/**
 * Blocks that started off screen wait hidden until scrolled to (engine.reveal,
 * as main.js does on scroll). Tilted, the screen shows more of the page than
 * the viewport: reveal from the highest to the lowest point it can see.
 */
function reveal() {
  const top = window.scrollY, H = vh();
  let y0 = top, y1 = top + H;
  if (L.k) {
    const c = r.cam;
    y0 = Infinity; y1 = -Infinity;
    for (const y of [0, H]) for (const x of [0, vw() / 2, vw()]) {
      const [px, py] = r.toPage(x, y);
      const k = c ? c.vp[12] * px + c.vp[13] * py + c.vp[15] : 1; // clip w of the hit: behind the camera if <= 0
      if (!(k > 0) || !Number.isFinite(py)) { y0 = Math.min(y0, top); y1 = Infinity; continue; }
      y0 = Math.min(y0, py + top); y1 = Math.max(y1, py + top);
    }
    y1 = Math.min(y1, (pageScene?.height ?? y1) + H);
  }
  const keep = engine.vh;
  engine.vh = Math.max(H, (y1 - y0) / 0.94);
  engine.reveal(y0);
  engine.vh = keep;
}

// ---------------------------------------------------------------- frame

let fps = 0, frames = 0, fpsAt = performance.now(), last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frames++;
  if (now - fpsAt > 1000) { fps = frames * 1000 / (now - fpsAt); frames = 0; fpsAt = now; stats(); }
  // Tilt: eased, or at once with reduced motion.
  L.k = engine.calm ? L.kTo : L.k + (L.kTo - L.k) * Math.min(1, dt * 3.2);
  if (Math.abs(L.k - L.kTo) < 1e-3) L.k = L.kTo;
  if (!L.k) L.yaw = L.pitch = 0; // back flat: the next tilt starts from the usual angle
  L.sm = engine.calm ? +!!L.shape : L.sm + (+!!L.shape - L.sm) * Math.min(1, dt * 2.5);
  if (L.shape && !engine.calm && !drag) L.yaw += dt * 0.12;
  view();
  const t = engine.now();
  if (L.own && L.own.back && t > L.own.until) { L.own = null; engine.pack(); }
  if (!L.own) { engine.tick(t); reveal(); }
  draw(t);
  requestAnimationFrame(frame);
}

function draw(t) {
  const T = THEMES[L.theme];
  const S = pageScene?.S;
  const scroll = docScroll();
  updateTrail(t, scroll);
  r.draw({
    time: t, scroll, shrink: SHRINK,
    navClip: S && !L.own ? Math.min(scroll, S.navClip) : -1e6,
    cam: null, themeA: T, themeB: T, themeT: 2, themeOrigin: [0, 0],
    gridOrigin: [S ? S.left : 0, 0], gridStep: 16, mouse: [-1e4, -1e4], dotAlpha: 0.075,
    trail: trail.n ? trail : null, pushR: 130, pushGain: 0.45, pulses, pulseSpeed: 1100, pulseWidth: 150, layers: [],
  });
}

// ---------------------------------------------------------------- push
//
// As on the site: the pointer's path pushes blocks around (main.js). Tilted,
// the path is where the pointer meets the page (r.toPage), and pushed blocks
// lift off it. Mouse and pen only; never with reduced motion.

const trail = { pos: new Float32Array(TRAIL * 4), meta: new Float32Array(TRAIL * 2), n: 0, box: [0, 0, 0, 0] };
const impulses = [];
let pointer = null, lastImpulse = -1;
const docScroll = () => (L.own && !L.own.order && !L.own.back ? 0 : window.scrollY);

function impulse(x, y, burst, t) {
  const [px, py] = r.toPage(x, y), y1 = py + docScroll();
  const prev = pointer;
  pointer = [px, y1];
  if (burst) { impulses.push({ x: px, y: y1, dx: 0, dy: 0, t, burst }); return; }
  if (!prev || t - lastImpulse < 1 / 90) return;
  const dx = px - prev[0], dy = y1 - prev[1];
  if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
  impulses.push({ x: px, y: y1, dx, dy, t, burst: 0 });
  lastImpulse = t;
}

function updateTrail(t) {
  while (impulses.length && (t - impulses[0].t > 1.3 || impulses.length > TRAIL)) impulses.shift();
  const reach = 130 * 2.2, box = [Infinity, Infinity, -Infinity, -Infinity];
  impulses.forEach((s, i) => {
    trail.pos.set([s.x, s.y, s.dx, s.dy], i * 4);
    trail.meta.set([s.t, s.burst], i * 2);
    box[0] = Math.min(box[0], s.x - reach); box[1] = Math.min(box[1], s.y - reach);
    box[2] = Math.max(box[2], s.x + reach); box[3] = Math.max(box[3], s.y + reach);
  });
  trail.box = box;
  trail.n = impulses.length;
}

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' || engine.calm || drag?.moved) return;
  impulse(e.clientX, e.clientY, 0, engine.now());
});
canvas.addEventListener('pointerleave', () => { pointer = null; });

// ---------------------------------------------------------------- picking

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (!drag.moved) return;
  if (!L.kTo) { L.kTo = 1; ui(); } // dragging the flat page tips it into 3D
  // Orbit, but never round to the back of the page: about ±70° side to side, from face on to 75° back.
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const yaw0 = 0.42 - 0.12 * L.sm, tilt0 = -0.85 + 0.53 * L.sm;
  L.yaw = clamp(L.yaw + dx * 0.004, -1.2 - yaw0, 1.2 - yaw0);
  L.pitch = clamp(L.pitch - dy * 0.003, -1.3 - tilt0, 0.15 - tilt0);
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  const d = drag;
  drag = null;
  if (d && d.moved) return;
  if (e.pointerType !== 'touch' && !engine.calm) impulse(e.clientX, e.clientY, 34, engine.now());
  const own = L.own, data = own ? own.buf : engine.buf, n = own ? own.n : engine.count;
  const scroll = own && !own.order && !own.back ? 0 : window.scrollY;
  const t0 = performance.now();
  const i = r.pick(data, n, e.clientX, e.clientY, scroll);
  const ms = performance.now() - t0;
  if (i < 0) {
    // Between a letter's pixels: where the click lands on the page, and the element there (what dom.js would get).
    const box = (R, x, y) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < R.T.length; k += 5) { x0 = Math.min(x0, R.T[k]); y0 = Math.min(y0, R.T[k + 1]); x1 = Math.max(x1, R.T[k] + R.T[k + 2]); y1 = Math.max(y1, R.T[k + 1] + R.T[k + 3]); }
      return x >= x0 - 4 && x <= x1 + 4 && y >= y0 - 4 && y <= y1 + 4;
    };
    const [px, py] = r.toPage(e.clientX, e.clientY), dy = py + scroll;
    const nav = own ? null : engine.list.find((R) => R.fixed && R.n && box(R, e.clientX, e.clientY)); // the nav stays flat on screen
    const el = nav || (own ? null : engine.list.find((R) => !R.fixed && R.n && box(R, px, dy)));
    L.hit = nav ? `${nav.key} (nav, ${ms.toFixed(1)} ms)` : `${el ? el.key : 'nothing'} via the page at (${px.toFixed(0)}, ${dy.toFixed(0)}) (${ms.toFixed(1)} ms over ${n} blocks)`;
    if (el && !nav) light(px, dy);
    stats();
    return;
  }
  const o = i * STRIDE;
  let key = own ? `cube ${i}` : '?';
  if (!own) for (const R of engine.list) if (i >= R.off && i < R.off + R.n) key = R.key;
  L.hit = `${key} (${ms.toFixed(1)} ms over ${n} blocks)`;
  // Light it up where it is.
  const fx = (data[o + 19] & 1) !== 0;
  light(data[o + 4] + data[o + 6] / 2, data[o + 5] + data[o + 7] / 2 + (fx ? scroll : 0));
  stats();
});

function light(x, y) {
  if (pulses.n === PULSES) pulses.data.copyWithin(0, 4);
  pulses.n = Math.min(PULSES, pulses.n + 1);
  pulses.data.set([x, y, engine.now(), 1], (pulses.n - 1) * 4);
}

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

/** The table: ms a frame for each approach and size, tilted, sorted front to back and back to front. */
function bench(sizes = ['10k', '50k', '200k'], modes = ['2D', 'A', 'B'], sorts = ['f2b', 'b2f']) {
  const keep = { mode: L.mode, scene: L.scene, sort: L.sort, k: L.k, kTo: L.kTo };
  const rows = [];
  for (const size of sizes) for (const sort of sorts) {
    L.sort = sort; L.k = L.kTo = 1; view();
    load(size);
    for (const mode of modes) {
      r.mode = mode;
      if (mode === '2D') { L.k = 0; view(); } else { L.k = 1; view(); }
      time(5);
      const ms = Math.min(time(20), time(20));
      rows.push({ size, sort, mode, ms: +ms.toFixed(2), fps: Math.round(Math.min(1000 / ms, 999)) });
    }
  }
  Object.assign(L, keep); r.mode = L.mode;
  load(L.scene);
  const txt = `${vw()}×${vh()} @${dpr()}x\n` + rows.map((x) => `${x.size.padEnd(5)} ${x.sort} ${x.mode.padEnd(2)} ${String(x.ms).padStart(6)} ms  ${x.fps} fps`).join('\n');
  document.getElementById('out').textContent = txt;
  return rows;
}

/** Straight on, does each 3D approach draw today's page exactly? Pixels that differ from the 2D renderer. */
function parity() {
  const gl = r.gl, W = canvas.width, H = canvas.height, t = engine.now();
  const keep = [r.mode, L.k];
  L.k = 0; view();
  const grab = (m) => { r.mode = m; draw(t); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const base = grab('2D'), out = {};
  for (const m of ['A', 'B']) {
    const px = grab(m);
    let diff = 0, max = 0;
    for (let i = 0; i < px.length; i += 4) {
      const d = Math.max(Math.abs(px[i] - base[i]), Math.abs(px[i + 1] - base[i + 1]), Math.abs(px[i + 2] - base[i + 2]));
      if (d) diff++;
      if (d > max) max = d;
    }
    out[m] = { differ: diff, of: W * H, maxDelta: max };
  }
  [r.mode, L.k] = keep;
  let ink = 0;
  for (let i = 0; i < base.length; i += 4) if (base[i] < 128) ink++;
  out.inkPixels = ink;
  document.getElementById('out').textContent = `parity (${W}×${H}): ${JSON.stringify(out)}`;
  return out;
}

// ---------------------------------------------------------------- panel

function stats() {
  const n = L.own ? L.own.n : engine.count;
  document.querySelector('#panel summary').textContent = `3D lab · ${r.mode} · ${fps.toFixed(0)} fps · ${n.toLocaleString()} blocks`;
  document.getElementById('stat').textContent = `${fps.toFixed(0)} fps · ${n.toLocaleString()} blocks · ${canvas.width}×${canvas.height}${engine.calm ? ' · calm' : ''}${L.hit ? `\nhit: ${L.hit}` : ''}`;
}

function ui() {
  const el = document.getElementById('ui');
  const btn = (label, on, fn) => `<button aria-pressed="${on}" data-fn="${fn}">${label}</button>`;
  el.innerHTML = [
    `<div class="row"><b>draw</b>${['2D', 'A', 'B'].map((m) => btn(m === 'A' ? 'A ray-box' : m === 'B' ? 'B faces' : '2D today', r.mode === m, `mode:${m}`)).join('')}</div>`,
    `<div class="row"><b>scene</b>${['home', 'cv', '10k', '50k', '200k'].map((s) => btn(s, L.scene === s, `scene:${s}`)).join('')}</div>`,
    `<div class="row"><b>view</b>${btn('tilt', L.kTo > 0, 'tilt')}${['sphere', 'jp'].map((s) => btn(`→ ${s}`, L.shape === s, `shape:${s}`)).join('')}${btn(L.theme, false, 'theme')}</div>`,
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
  if (k === 'mode') r.mode = L.mode = v;
  if (k === 'scene') load(v);
  if (k === 'tilt') L.kTo = L.kTo > 0 ? 0 : 1;
  if (k === 'shape') {
    if (L.shape === v) morph(null);
    else if (!L.own || L.own.order || L.own.back) { if (L.own?.order) { L.own = null; engine.pack(); } morph(v); }
  }
  if (k === 'theme') { L.theme = L.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = L.theme; if (!L.own) load(L.scene); }
  if (k === 'sort') { L.sort = v; if (L.own && !L.own.order) { load(L.scene); } }
  if (k === 'bench') bench();
  if (k === 'parity') parity();
  ui();
});

document.documentElement.dataset.theme = L.theme;
resize();
addEventListener('resize', () => { resize(); load(L.scene); });
load(L.scene);
requestAnimationFrame(frame);
window.__lab = { L, r, engine, bench, parity, time, load, morph, view };
