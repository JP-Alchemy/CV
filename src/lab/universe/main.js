// /lab/universe/: an endless, seeded universe in blocks. Scroll or pinch to
// zoom (towards the pointer), drag to turn, click something to fly there.
// ?seed=anything picks another universe; ?theme=light|dark.

import { Cubes } from './gl.js';
import { Universe, D_MIN, D_MAX } from './world.js';
import { metres, norm } from './space.js';
import { hash, name as nameOf } from './rng.js';
import { parse, Search } from './search.js';
import { NOW, fmtAge } from './lineage.js';
import { THEMES as BRAND, unit } from '../../brand.js';

const Q = new URLSearchParams(location.search);
const seedArg = Q.get('seed');
const seed = seedArg === null ? 1977 : /^\d+$/.test(seedArg) ? +seedArg : [...seedArg].reduce((h, c) => hash(h, c.charCodeAt(0)), 7);
const THEMES = Object.fromEntries(Object.entries(BRAND).map(([k, t]) => [k, { bg: unit(t.bg), fg: unit(t.fg) }]));
let theme = Q.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;

const canvas = document.getElementById('gl');
const gl = new Cubes(canvas);
let U = new Universe(seed, gl); // the universe you're in (another one when you go inside an atom)
const STACK = []; // the universes you're inside of, outermost first: { U, seed, cam, mineral }
U.goHome(true);
window.__U = U;

const $ = (id) => document.getElementById(id);
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const vw = () => canvas.clientWidth || innerWidth, vh = () => canvas.clientHeight || innerHeight;

// ------------------------------------------------------------ GPU timing (where the browser allows it)

const tq = gl.gl.getExtension('EXT_disjoint_timer_query_webgl2');
const queries = [];
let gpuMs = 0;
function gpuBegin() {
  if (!tq) return null;
  const q = gl.gl.createQuery();
  gl.gl.beginQuery(tq.TIME_ELAPSED_EXT, q);
  return q;
}
function gpuEnd(q) {
  if (!q) return;
  gl.gl.endQuery(tq.TIME_ELAPSED_EXT);
  queries.push(q);
  while (queries.length) {
    const a = queries[0], g = gl.gl;
    if (!g.getQueryParameter(a, g.QUERY_RESULT_AVAILABLE)) break;
    if (!g.getParameter(tq.GPU_DISJOINT_EXT)) gpuMs = gpuMs * 0.9 + (g.getQueryParameter(a, g.QUERY_RESULT) / 1e6) * 0.1;
    g.deleteQuery(a); queries.shift();
  }
}

// ------------------------------------------------------------ the loop

const S = { fps: 0, frames: 0, at: performance.now(), js: 0, dt: 16, last: performance.now(), worst: 0, hist: [] };
function frame(now) {
  const dt = Math.min(0.1, (now - S.last) / 1000);
  S.last = now;
  S.dt = S.dt * 0.95 + dt * 1000 * 0.05;
  steer(dt);
  const t0 = performance.now(), q = gpuBegin();
  U.render(dt, THEMES[theme], vw(), vh(), dpr());
  gpuEnd(q);
  depth();
  marks(now);
  follow();
  searching();
  const js = performance.now() - t0;
  S.js = S.js * 0.9 + js * 0.1;
  S.worst = Math.max(S.worst * 0.995, js);
  S.frames++;
  if (now - S.at > 500) {
    S.fps = (S.frames * 1000) / (now - S.at); S.frames = 0; S.at = now;
    // Keep the frame rate: fewer cubes when frames run long, more back when there's room.
    const ms = Math.max(S.dt, gpuMs);
    if (ms > 21 && U.detail > 0.35) U.detail *= 0.9;
    else if (ms < 14 && U.detail < 1) U.detail = Math.min(1, U.detail * 1.05);
    hud();
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ input
//
// Drag turns about what you're looking at; right-drag, shift-drag or two
// fingers move (along the ground, when you're on it); the wheel or a pinch
// zooms towards the pointer, eased; WASD move, arrows turn, Q/E or +/- zoom.
// Let go mid-turn and it coasts to a stop. Touching anything ends a flight.

const C = {
  P: new Map(), mode: null, moved: 0, downAt: 0, pinch: 0, mid: null, last: 0,
  zoom: 0, zx: 0, zy: 0, // log-distance still to go, and towards where
  vo: [0, 0], vp: [0, 0], // turn (rad/s) and move (px/s) still coasting
  keys: new Set(),
};
const TURN = 0.0055; // radians a pixel
const turn = (dx, dy) => {
  U.cam.orbit(dx * TURN, -dy * TURN); // grab: the near side follows the pointer
  if (Math.abs(dy) > Math.abs(dx) * 0.5) U.tilted = performance.now();
};

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  C.P.set(e.pointerId, { x: e.clientX, y: e.clientY });
  C.vo = [0, 0]; C.vp = [0, 0];
  if (C.P.size === 1) {
    C.moved = 0; C.downAt = performance.now();
    C.mode = e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey || e.metaKey ? 'move' : 'turn';
  }
  if (C.P.size === 2) {
    const [a, b] = [...C.P.values()];
    C.pinch = Math.hypot(a.x - b.x, a.y - b.y); C.mid = [(a.x + b.x) / 2, (a.y + b.y) / 2]; C.moved = 99; C.mode = 'two';
  }
  U.steering = true;
});
canvas.addEventListener('pointermove', (e) => {
  const p = C.P.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (C.P.size === 1) {
    C.moved += Math.abs(dx) + Math.abs(dy);
    if (C.moved <= 3) return;
    U.stopFlight();
    const dt = Math.max(8, e.timeStamp - (p.t || e.timeStamp - 16)) / 1000;
    p.t = C.last = e.timeStamp;
    if (C.mode === 'move') { U.pan(dx, dy); C.vp = [C.vp[0] * 0.5 + (dx / dt) * 0.5, C.vp[1] * 0.5 + (dy / dt) * 0.5]; }
    else { turn(dx, dy); C.vo = [C.vo[0] * 0.5 + (dx / dt) * 0.5, C.vo[1] * 0.5 + (dy / dt) * 0.5]; }
  } else if (C.P.size === 2) {
    const [a, b] = [...C.P.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    if (C.pinch > 0 && d > 0) U.zoomAt(m[0], m[1], C.pinch / d);
    if (C.mid) U.pan(m[0] - C.mid[0], m[1] - C.mid[1]);
    C.pinch = d; C.mid = m;
  }
});
const release = (e) => {
  if (!C.P.has(e.pointerId)) return;
  const single = C.P.size === 1;
  C.P.delete(e.pointerId);
  if (single && C.moved < 6 && performance.now() - C.downAt < 500 && e.button === 0 && C.mode === 'turn') select(U.select(e.clientX, e.clientY));
  if (e.timeStamp - C.last > 60) { C.vo = [0, 0]; C.vp = [0, 0]; } // a flick coasts; a drag that stopped before letting go doesn't
  if (C.P.size < 2) { C.pinch = 0; C.mid = null; }
  if (C.P.size === 1) C.mode = 'turn';
  if (!C.P.size) U.steering = C.keys.size > 0;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  const d = e.deltaY * px;
  C.zoom += d * (e.ctrlKey ? 0.02 : 0.006); // a mouse notch (100 px) is ~1.8x; trackpad pinches arrive as ctrl+wheel
  C.zoom = Math.max(-10, Math.min(10, C.zoom));
  C.zx = e.clientX; C.zy = e.clientY;
}, { passive: false });

const HELD = new Set(['w', 'a', 's', 'd', 'q', 'e', '+', '=', '-', '_', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return; // typing in the search box
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (HELD.has(k)) { C.keys.add(k); U.steering = true; U.stopFlight(); }
  else if (k === 'Escape') { if (SEL) select(null); else U.up(); }
  else if (k === 'Enter' || k === 'g') go();
  else if (k === '/') { $('q').focus(); }
  else if (k === '[' || k === ']') { U.epoch = Math.min(NOW, Math.max(0.2, U.epoch + (k === ']' ? 1 : -1) * (e.shiftKey ? 1 : 0.1))); timebar(); }
  else if (k === 'y') why(U.cam.anchor);
  else if (k === 'a') atlas();
  else if (k === 'b') blockPanel();
  else if (k === 'l') copyLink();
  else if (k === 'u' || k === 'Backspace') U.up();
  else if (k === 'h') U.goHome(false);
  else if (k === 't') toggleTheme();
  else if (k === ' ') { U.paused = !U.paused; ui(); }
  else return;
  e.preventDefault();
});
addEventListener('keyup', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  C.keys.delete(k);
  if (!C.keys.size && !C.P.size) U.steering = false;
});
addEventListener('blur', () => { C.keys.clear(); U.steering = false; });

/** Each frame: ease the zoom in, coast, and drive by the held keys. */
function steer(dt) {
  const K = C.keys, has = (...ks) => ks.some((k) => K.has(k));
  if (C.zoom) {
    const step = Math.abs(C.zoom) < 0.002 ? C.zoom : C.zoom * (1 - Math.exp(-dt * 8)); // softer: notches in a row blend into one steady glide
    U.zoomAt(C.zx, C.zy, Math.exp(step));
    C.zoom -= step;
  }
  const z = (has('e', '+', '=') ? -1 : 0) + (has('q', '-', '_') ? 1 : 0);
  if (z) U.zoomAt(vw() / 2, vh() / 2, Math.exp(z * dt * 1.6));
  const mx = (has('d') ? 1 : 0) - (has('a') ? 1 : 0), my = (has('w') ? 1 : 0) - (has('s') ? 1 : 0);
  if (mx || my) U.pan(-mx * dt * vh() * 0.6, my * dt * vh() * 0.6);
  const tx = (has('ArrowLeft') ? 1 : 0) - (has('ArrowRight') ? 1 : 0), ty = (has('ArrowUp') ? 1 : 0) - (has('ArrowDown') ? 1 : 0);
  if (tx || ty) turn(tx * dt * 260, ty * dt * 200);
  if (!C.P.size) { // coasting
    const f = Math.exp(-dt * 5);
    if (Math.hypot(...C.vo) > 5) turn(C.vo[0] * dt, C.vo[1] * dt); else C.vo = [0, 0];
    if (Math.hypot(...C.vp) > 5) U.pan(C.vp[0] * dt, C.vp[1] * dt); else C.vp = [0, 0];
    C.vo = [C.vo[0] * f, C.vo[1] * f]; C.vp = [C.vp[0] * f, C.vp[1] * f];
  }
}

// ------------------------------------------------------------ selection
//
// Click selects: brackets round the thing and a card with what it is and how
// far. Double-click, Enter or the card's Go travels there. Scrolling always
// zooms about the middle of the view, so it never wanders off.

let SEL = null;
function select(sel) {
  SEL = sel;
  const card = $('card');
  if (!SEL) { card.hidden = true; $('sel').hidden = true; return; }
  const [name, ...rest] = SEL.label.split(' · ');
  card.innerHTML = `<div><b>${esc(name)}</b>${rest.length ? `<br><span>${esc(rest.join(' · '))}</span>` : ''}<br><span id="card-far"></span></div><button id="card-go">${SEL.dest.atlas ? 'Find a real one ⏎' : 'Go ⏎'}</button><button id="card-why">Why?</button><button id="card-x" aria-label="Clear">×</button>`;
  card.hidden = false;
  $('card-go').onclick = go;
  $('card-why').onclick = () => why(SEL.dest.node);
  $('card-x').onclick = () => select(null);
  follow();
}
function go() {
  if (!SEL) return;
  if (SEL.dest.atlas) { findLike(SEL.dest.atlas); select(null); return; }
  U.fly(SEL.dest);
  toast(`→ ${SEL.label.split(' · ')[0]}`);
  select(null);
}
/** Keep the brackets on the selection, and its distance up to date. */
function follow() {
  if (!SEL) return;
  const p = U.screenOf(SEL.dest.node, SEL.dest.p), el = $('sel');
  if (p) { el.hidden = false; el.style.transform = `translate(${Math.round(p[0])}px, ${Math.round(p[1])}px)`; } else el.hidden = true;
  const far = $('card-far');
  if (far && p) far.textContent = SEL.dest.atlas ? 'a possible world: Find searches the universe for a real one like it' : `${metres(p[2])} away`;
}
canvas.addEventListener('dblclick', (e) => {
  const s = U.select(e.clientX, e.clientY);
  if (s) { select(s); go(); }
});

// ------------------------------------------------------------ markers and hover
//
// Where you can go from here, named on screen: click one to fly there. The
// list is rebuilt a few times a second; positions follow every frame.

const M = { list: [], at: 0, anchor: null, els: new Map(), tipAt: 0, tip: null };
function marks(now) {
  const box = $('marks');
  if (U.flight) { box.hidden = true; M.anchor = null; return; }
  box.hidden = false;
  if (now - M.at > 300 || M.anchor !== U.cam.anchor) { M.list = U.targets(); M.at = now; M.anchor = U.cam.anchor; }
  const shown = [], seen = new Set();
  for (const t of M.list) {
    const p = U.screenOf(t.node);
    if (!p) continue;
    if (shown.some((q) => Math.abs(q.p[1] - p[1]) < 22 && Math.abs(q.p[0] - p[0]) < 170)) continue; // its label would sit on one already named
    shown.push({ t, p });
    if (shown.length >= 12) break;
  }
  for (const { t, p } of shown) {
    let el = M.els.get(t.key);
    if (!el) {
      el = document.createElement('button');
      el.className = 'mark';
      el.innerHTML = `<i></i><span><b>${esc(t.label)}</b> ${esc(t.sub || '')}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); select(U.selectNode(t.node, `${t.label} · ${t.sub || ''}`)); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); select(U.selectNode(t.node, `${t.label} · ${t.sub || ''}`)); go(); });
      box.appendChild(el);
      M.els.set(t.key, el);
    }
    el.style.transform = `translate(${Math.round(p[0])}px, ${Math.round(p[1])}px)`;
    seen.add(t.key);
  }
  for (const [k, el] of M.els) if (!seen.has(k)) { el.remove(); M.els.delete(k); }
}

/** What a click here would do: a label by the pointer, and a hand cursor. */
function hover(x, y) {
  const now = performance.now();
  if (now - M.tipAt < 90) return;
  M.tipAt = now;
  const h = U.flight ? null : U.pick(x, y, false), tip = $('tip');
  canvas.style.cursor = h?.go ? 'pointer' : 'crosshair';
  if (h?.go && h.label) {
    tip.textContent = `${h.label} · click to select, double-click to go`;
    tip.style.transform = `translate(${Math.round(Math.min(x + 14, vw() - tip.offsetWidth - 8))}px, ${Math.round(y + 16)}px)`;
    tip.hidden = false;
  } else tip.hidden = true;
}
canvas.addEventListener('pointermove', (e) => { if (!C.P.size && e.pointerType === 'mouse') hover(e.clientX, e.clientY); });
canvas.addEventListener('pointerleave', () => { $('tip').hidden = true; });
canvas.addEventListener('pointerdown', () => { $('tip').hidden = true; });

// ------------------------------------------------------------ why

/** The chain of causes for a place, from it up to its galaxy. */
function why(n) {
  const rows = U.why(n), el = $('why');
  if (!rows.length) return;
  el.innerHTML = `<button id="why-x" aria-label="Close">×</button><h2>Why it's like this</h2>${rows.map(([t, x], i) => `<section><b>${esc(t)}</b><p>${esc(x)}</p></section>${i < rows.length - 1 ? '<i>↑ because of</i>' : ''}`).join('')}`;
  el.hidden = false;
  $('why-x').onclick = () => { el.hidden = true; };
}

// ------------------------------------------------------------ time

/** The time bar: the age of the universe (drag to go back), and how fast the clock runs here. */
function timebar() {
  const r = $('epoch');
  if (document.activeElement !== r) r.value = U.epoch;
  const now = U.epoch >= NOW - 0.01;
  $('epoch-l').textContent = now ? `now: ${NOW} billion years after the Big Bang` : `${U.epoch.toFixed(2)} billion years after the Big Bang (${fmtAge(NOW - U.epoch)} ago)`;
  $('clock').textContent = `clock: 1 s here = ${span(U.rate)}${U.paused ? ' (paused)' : ''}`;
  const sn = U.find('star');
  $('unborn').textContent = sn && U.epoch < sn.info.hist.born ? `${sn.info.name} isn't born yet: wait ${fmtAge(sn.info.hist.born - U.epoch)}` : '';
}
function span(sec) {
  const y = sec / 3.156e7;
  if (y >= 1e9) return `${(y / 1e9).toFixed(1)} billion years`;
  if (y >= 1e6) return `${(y / 1e6).toFixed(1)} million years`;
  if (y >= 1e3) return `${(y / 1e3).toFixed(1)} thousand years`;
  if (y >= 1) return `${y.toFixed(1)} years`;
  if (sec >= 86400) return `${(sec / 86400).toFixed(1)} days`;
  if (sec >= 3600) return `${(sec / 3600).toFixed(1)} hours`;
  return `${(sec / 60).toFixed(1)} minutes`;
}
$('epoch').addEventListener('input', (e) => { U.epoch = +e.target.value; timebar(); });
$('epoch-now').addEventListener('click', () => { U.epoch = NOW; timebar(); });

// ------------------------------------------------------------ search

let FIND = null;
$('find').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('q').value.trim(), q = parse(text);
  $('q').blur();
  if (!text) return;
  if (!q.chips.length) { $('find-out').innerHTML = '<p>Try words like: ocean, lava, ice, gas giant, rings, two moons, yellow star, young, metal-rich, volcanoes, garnet sand, elliptical.</p>'; return; }
  startSearch(q);
});
function startSearch(q) {
  FIND = new Search(U, q);
  FIND.at = 0;
  $('find-out').innerHTML = `<p class="chips">${q.chips.map((c) => `<span>${esc(c)}</span>`).join('')}</p><p id="find-st"></p><ol id="find-res"></ol>`;
}
$('q').addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('q').blur(); FIND = null; $('find-out').innerHTML = ''; } });
function searching() {
  if (!FIND) return;
  if (!FIND.done) FIND.step(5);
  const now = performance.now();
  if (now - FIND.at < 200 && !FIND.done) return;
  FIND.at = now;
  const st = $('find-st'), res = $('find-res');
  if (!st) return;
  st.textContent = `${FIND.done ? (FIND.found.length ? 'Found' : 'Nothing near enough') : 'Searching'}: ${FIND.stars.toLocaleString()} stars, ${FIND.systems.toLocaleString()} systems built, ${FIND.galaxies} galax${FIND.galaxies === 1 ? 'y' : 'ies'}`;
  if (res.childElementCount !== FIND.found.length) {
    res.innerHTML = FIND.found.map((f, i) => `<li><button data-i="${i}"><b>${esc(f.label)}</b> ${esc(f.sub)} · ${metres(f.dist)}</button></li>`).join('');
  }
  if (FIND.done) FIND.at = Infinity;
}
$('find-out').addEventListener('click', (e) => {
  const i = e.target.closest('button')?.dataset.i;
  if (i === undefined || !FIND) return;
  const f = FIND.found[+i], S = U.si(f.s);
  const n = f.p ? S.planets.find((b) => b.p.key === f.p.key).node : S.node;
  select(U.selectNode(n, `${f.label} · ${f.sub}`));
  go();
});

// ------------------------------------------------------------ inside atoms (6)
//
// Zoom far enough into one atom and it opens into a whole universe, seeded
// from the atom (its grain, its lattice spot and its place in the lattice):
// infinite in both directions. Zoom out past the top and you come back out of
// the atom. Each level down is pushed on a stack, with where you were.

const snap = (c) => ({ anchor: c.anchor, t: c.t.slice(), D: c.D, dir: c.dir.slice(), up: c.up.slice() });
function freeAll(V) { for (const e of V.store.m.values()) gl.free(e.mesh); V.store.m.clear(); }
function depth() {
  if (U.wantsOut) { U.wantsOut = false; if (STACK.length) exitAtom(); }
  const a = U.atomUnder;
  if (a && U.cam.D < 2e-10 && a.d < 2e-9 && !U.flight) enterAtom(); // closer than an atom across, to the atom under you
}
function enterAtom() {
  const a = U.atomUnder, parent = U, s2 = hash(parent.seed, a.L.seed, a.i, a.j, a.k);
  STACK.push({ U: parent, seed: parent.seed, cam: snap(parent.cam), mineral: a.mineral });
  freeAll(parent);
  U = new Universe(s2, gl); window.__U = U;
  const gal = U.home().star.gI.node;
  Object.assign(U.cam, { anchor: U.root, t: gal.pos.slice(), D: D_MAX * 0.6, dir: norm([0.3, -0.5, 0.8]), up: [0, 0, 1] });
  U.epoch = parent.epoch;
  applyMarks(); select(null); FIND = null; $('find-out').innerHTML = '';
  flash(); toast(`Inside an atom of ${a.mineral}: a whole universe, ${STACK.length + 1} deep. Zoom out past the top to come back.`);
}
function exitAtom() {
  const st = STACK.pop();
  freeAll(U);
  if (!st.U) { st.U = new Universe(st.seed, gl); st.U.goHome(true); }
  U = st.U; window.__U = U;
  if (st.cam) Object.assign(U.cam, st.cam, { t: st.cam.t.slice() });
  U.cam.D = Math.max(U.cam.D, 6e-10);
  C.zoom = Math.max(C.zoom, 0);
  applyMarks(); select(null); FIND = null; $('find-out').innerHTML = '';
  flash(); toast(STACK.length ? `Back out, ${STACK.length + 1} universes deep` : 'Back in our universe');
}
function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

// ------------------------------------------------------------ blocks (5)
//
// One block per visitor: put it anywhere (at what you're looking at), in a
// colour, with a note. Saved in this browser; a link carries it (and where it
// is) to anyone, and their browser keeps it too. Everyone seeing everyone's
// blocks needs a shared store (a server): see the README.

const MKEY = 'universe-blocks-v1';
let MARKS = [];
try { MARKS = JSON.parse(localStorage.getItem(MKEY) || '[]'); } catch { MARKS = []; }
const universePath = () => [...STACK.map((st) => st.seed), U.seed].join('.');
function saveMarks() { try { localStorage.setItem(MKEY, JSON.stringify(MARKS)); } catch { /* private mode: they last as long as the page */ } }
function applyMarks() { U.setMarks(MARKS.filter((m) => m.u === universePath())); }
function blockPanel() {
  const el = $('blockp'), mine = MARKS.find((m) => m.mine);
  el.innerHTML = `<button id="bx" aria-label="Close">×</button><b>Leave your block</b><p>One per visitor, where you're looking now. ${mine ? 'Placing again moves it.' : ''}</p>
    <div class="sw">${[1, 2, 3, 4, 5, 6, 7].map((c) => `<button data-c="${c}" style="background:var(--s${c})" aria-label="colour ${c}"></button>`).join('')}</div>
    <input id="bnote" maxlength="60" placeholder="a note (optional)" value="${esc(mine?.note || '')}"><button id="bplace">Place it here</button>${mine ? '<button id="blink">Copy a link to it</button>' : ''}`;
  el.hidden = false;
  let col = mine?.col || 1 + Math.floor(Math.random() * 7);
  const mark = () => el.querySelectorAll('.sw button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.c === col));
  mark();
  el.querySelector('.sw').onclick = (e) => { const c = e.target.closest('button')?.dataset.c; if (c) { col = +c; mark(); } };
  $('bx').onclick = () => { el.hidden = true; };
  $('bplace').onclick = () => {
    const m = U.placeMark(col, $('bnote').value);
    if (!m) { toast('Blocks go in the universe, not the atlas'); return; }
    m.u = universePath(); m.view = U.location();
    MARKS = MARKS.filter((x) => !x.mine).concat(m);
    saveMarks(); applyMarks(); el.hidden = true;
    toast('Your block is here. Copy link (L) to send someone to it.');
  };
  if ($('blink')) $('blink').onclick = () => { copyLink(mine); el.hidden = true; };
}
/** A link to where you are (or to your block), carrying the block so whoever opens it sees it. */
function copyLink(m = null) {
  if (U.atlasOn) { toast('Links go to places in the universe, not the atlas'); return; }
  const H = new URLSearchParams();
  H.set('u', m ? m.u : universePath());
  H.set('at', m ? m.view : U.location());
  const mine = m || MARKS.find((x) => x.mine && x.u === universePath());
  if (mine) H.set('mark', btoa(unescape(encodeURIComponent(JSON.stringify({ id: mine.id, u: mine.u, at: mine.at, p: mine.p, col: mine.col, note: mine.note })))));
  const url = `${location.origin}${location.pathname}${location.search}#${H}`;
  history.replaceState(null, '', url);
  navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast('Link is in the address bar'));
}
/** Open a link: the right universe, the block it carries, and the place. */
function readLink() {
  const H = new URLSearchParams(location.hash.slice(1));
  const us = (H.get('u') || '').split('.').filter(Boolean).map(Number);
  if (us.length && us[us.length - 1] !== U.seed) {
    for (const sd of us.slice(0, -1)) STACK.push({ seed: sd, mineral: 'something' });
    U = new Universe(us[us.length - 1], gl); window.__U = U; U.goHome(true);
  }
  const mk = H.get('mark');
  if (mk) {
    try {
      const m = JSON.parse(decodeURIComponent(escape(atob(mk))));
      if (!MARKS.some((x) => x.id === m.id)) { MARKS.push({ ...m, mine: false, view: H.get('at') }); saveMarks(); }
    } catch { /* not a block */ }
  }
  applyMarks();
  if (H.get('at')) U.goLocation(H.get('at'));
}

// ------------------------------------------------------------ the atlas (4)

function atlas() {
  select(null);
  if (U.atlasOn) { U.atlasExit(); toast('Back where you were'); } else { U.atlasEnter(); toast(U.atlasHere ? `The atlas: ${U.atlasHere} is in the middle. Click a world, then Find a real one.` : 'The atlas of possible worlds: hotter, bigger, older along the axes'); }
  ui();
}
/** Search the universe for a real world like an atlas one: same kind, similar size, warmth and age. */
function findLike(p) {
  if (U.atlasOn) U.atlasExit();
  ui();
  startSearch({
    chips: [`like: ${p.name}`],
    galaxy: null,
    star: (s, h) => Math.abs(Math.log2(Math.max(0.01, h.age) / p.age)) < 1.3,
    planet: (x) => x.kind === p.kind && Math.abs(Math.log2(x.R / p.R)) < 0.5 && Math.abs(Math.log2((x.x || 1) / p.x)) < 0.7,
  });
}

// ------------------------------------------------------------ HUD

function toggleTheme() { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; }
let toastT = 0;
function toast(s) { const el = $('toast'); el.textContent = s; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

function hud() {
  if (U.drawn === undefined) return;
  timebar();
  const chain = U.chain().filter((n) => n.kind !== 'patch');
  const D = U.cam.D;
  const crumbs = STACK.flatMap((st, i) => [`<button data-u="${i}">${i ? `Universe ${i + 1}` : 'Our universe'}</button>`, `<span>inside an atom of ${esc(st.mineral || 'something')}</span>`]);
  crumbs.push(...chain.map((n, i) => `<button data-i="${i}"${i === chain.length - 1 ? ' aria-current="true"' : ''}>${esc(U.label(n))}${STACK.length && !i ? ` (universe ${STACK.length + 1})` : ''}</button>`));
  if (D < 3e-8 && U.find('grain')) crumbs.push('<span>Atoms · a lattice 0.26 nm apart</span>');
  const html = crumbs.join('<i>›</i>');
  if ($('path').dataset.h !== html) { $('path').innerHTML = html; $('path').dataset.h = html; }
  const across = 2 * D * Math.tan(gl.fov / 2) * (vw() / vh());
  $('scale').innerHTML = `<b>${metres(across)}</b> across · 10<sup>${Math.log10(D).toFixed(1)}</sup> m away${U.flight ? ' · warping' : ''}<small>click: select · double-click or Enter: go · scroll: zoom · drag: turn · right-drag: move</small>`;
  const c = U.counts || {};
  $('stats-sum').textContent = `${S.fps.toFixed(0)} fps · ${(U.drawn / 1000).toFixed(0)}k cubes`;
  $('stats-out').textContent = [
    `frame       ${S.dt.toFixed(1)} ms (rAF)   js ${S.js.toFixed(2)} ms   worst ${S.worst.toFixed(1)} ms`,
    `gpu         ${tq ? `${gpuMs.toFixed(2)} ms` : 'no timer query in this browser'}`,
    `cubes       ${U.drawn.toLocaleString()} in ${gl.stats.draws} draws (budget ${Math.round(U.budget * U.detail / 1000)}k, detail ${U.detail.toFixed(2)})`,
    `  by level  ${Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}k`).join(' · ') || '-'}`,
    `generate    ${U.store.ms.toFixed(1)} ms (${U.store.made} made, ${U.store.pending || 0} waiting)`,
    `collect     ${U.collectMs.toFixed(2)} ms`,
    `meshes      ${gl.meshes} · ${(gl.bytes / 1048576).toFixed(0)} MB on the GPU`,
    `camera      ${U.cam.anchor.kind} · D ${D.toExponential(2)} m · seed ${seed}`,
    `view        ${canvas.width}×${canvas.height} @${dpr()}x`,
  ].join('\n');
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('path').addEventListener('click', (e) => {
  const u = e.target.closest('button')?.dataset.u;
  if (u !== undefined) { while (STACK.length > +u) exitAtom(); return; }
  const i = e.target.closest('button')?.dataset.i;
  if (i === undefined) return;
  const chain = U.chain().filter((n) => n.kind !== 'patch'), n = chain[+i];
  if (n && n !== U.cam.anchor) U.flyToLevel(n);
});

function ui() {
  $('bar').innerHTML = [
    ['atlas', U.atlasOn ? 'Back' : 'Atlas', U.atlasOn ? 'Back from the atlas (A)' : 'Atlas of possible worlds (A)'], ['block', 'Block', 'Leave your block here (B)'], ['link', 'Link', 'Copy a link to here (L)'],
    ['why', 'Why?', 'Why is it like this? (Y)'], ['up', 'Up', 'Up a level (U)'], ['home', 'Home', 'Home (H)'], ['theme', 'Ink', 'Paper / ink (T)'], ['pause', U.paused ? 'Play' : 'Pause', 'Pause the clock (space)'],
  ].map(([k, t, title]) => `<button data-k="${k}" title="${title}">${t}</button>`).join('');
}
$('bar').addEventListener('click', (e) => {
  const k = e.target.closest('button')?.dataset.k;
  if (k === 'why') why(U.cam.anchor);
  if (k === 'atlas') atlas();
  if (k === 'block') blockPanel();
  if (k === 'link') copyLink();
  if (k === 'up') U.up();
  if (k === 'home') U.goHome(false);
  if (k === 'theme') toggleTheme();
  if (k === 'pause') U.paused = !U.paused;
  ui();
});

/**
 * Measuring: draw n frames of dt ms each, synchronously, then wait for the
 * GPU (readPixels). Returns ms a frame (CPU + GPU), cubes, draws and what
 * the generator did. Works while the tab is hidden (no rAF needed).
 */
window.__tick = (n = 1, dt = 16.7) => {
  const g = gl.gl, px = new Uint8Array(4);
  let gen = 0, made = 0;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { steer(dt / 1000); U.render(dt / 1000, THEMES[theme], vw(), vh(), dpr()); depth(); searching(); gen += U.store.ms; made += U.store.made; }
  g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  const ms = (performance.now() - t0) / n;
  marks(performance.now());
  follow();
  hud();
  return { ms: +ms.toFixed(2), genMs: +(gen / n).toFixed(2), made, pending: U.store.pending, cubes: U.drawn, draws: gl.stats.draws, counts: U.counts, D: U.cam.D, at: U.cam.anchor.kind, gpuMB: +(gl.bytes / 1048576).toFixed(1) };
};
/** Settle (generate everything wanted), then time frames with generation switched off. */
window.__measure = (frames = 30) => {
  for (let i = 0; i < 400; i++) { window.__tick(1, 0); if (!U.store.pending) break; }
  const keep = U.store.run.bind(U.store);
  U.store.run = (ms) => keep(0.0001);
  window.__tick(3, 0);
  const r = window.__tick(frames, 0);
  U.store.run = keep;
  return r;
};

readLink();
ui();
hud();
requestAnimationFrame(frame);
