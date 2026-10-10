import { Renderer, TRAIL, PULSES } from './engine/renderer.js';
import { Engine, SHRINK } from './engine/engine.js';
import { buildScene } from './scene.js';
import { DomMirror } from './dom.js';
import { parseRoute, fromHash } from './router.js';
import { applyMeta, pageHTML } from './seo.js';
import { site, experience } from './content.js';
import { tokens } from './ui.js';
import { puzzle } from './puzzle.js';
import { Garden } from './garden/mode.js';
import { THEMES as BRAND, unit } from './brand.js';
import { animateFavicon } from './favicon.js';
import './style.css';

const THEMES = Object.fromEntries(Object.entries(BRAND).map(([k, t]) => [k, { bg: unit(t.bg), fg: unit(t.fg), css: t.bg }]));

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const canvas = document.getElementById('gl');
const docEl = document.getElementById('doc');
const fixedEl = document.getElementById('fixed');
const staticEl = document.getElementById('static');

// Links from the first version of this site used hash routes (#/work).
const legacy = fromHash();
if (legacy) history.replaceState(null, '', legacy + location.search);

let renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  console.warn('Falling back to plain HTML:', err);
  document.documentElement.classList.add('no-gl');
  renderer = { dpr: 1, setInstances() {}, updateInstances() {}, draw() {}, resize() {} };
}

const engine = new Engine(renderer);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
engine.calm = reduce.matches;
reduce.addEventListener?.('change', (e) => { engine.calm = e.matches; });

const state = {
  route: parseRoute(),
  hover: null,
  expanded: new Set([experience[0].id]),
  copied: false,
  menuOpen: false,
  theme: store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  touch: matchMedia('(pointer: coarse)').matches,
  fullscreen: false,
  storyEls: null, // the story's picture, while the page morphs into it
};

// Measure the canvas itself: it tracks every viewport change (rotation,
// browser UI, zoom, device emulation), unlike innerWidth + 'resize' alone.
const size = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight];
const vp = { w: size()[0], h: size()[1] };
let layoutH = vp.h;
let scene = null;
let mouse = [-1e4, -1e4];
let lastOrigin = null;
let navByKeyboard = false;
let menuReturnScroll = 0;
const scrollMemory = new Map();

let themeFrom = THEMES[state.theme];
let themeTo = THEMES[state.theme];
let themeStart = -100;
let themeOrigin = [0, 0];

function applyThemeCss() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[state.theme].css);
}

const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

function render(mode = 'local', o = {}) {
  scene = buildScene(state, { w: vp.w, h: layoutH });
  const scrollFrom = window.scrollY;
  let scrollTo = o.scrollTo ?? scrollFrom;
  scrollTo = Math.max(0, Math.min(scrollTo, scene.height - vp.h));
  engine.vw = vp.w;
  engine.vh = vp.h;
  engine.gridX = scene.S.left;
  engine.morphTo(scene, { mode, scrollFrom, scrollTo, origin: o.origin });
  for (const s of impulses) s.y += scrollTo - scrollFrom; // keep pushes where they were on screen
  for (const p of pulses) p.y += scrollTo - scrollFrom;
  docEl.style.height = `${scene.height}px`;
  dom.sync(scene);
  if (Math.abs(window.scrollY - scrollTo) > 0.5) window.scrollTo(0, scrollTo);
  engine.reveal(scrollTo);
  kick();
}

// ---------------------------------------------------------------- pointer push
//
// The pointer's path is kept as short-lived impulses (doc-space position +
// how far it moved). The vertex shader turns them into spring offsets, so
// blocks near a moving cursor get shoved and settle back. Mouse/pen only:
// on touch, dragging means scrolling.

const PUSH_LIFE = 1.3; // seconds an impulse keeps ringing (matches the shader)
const trail = { pos: new Float32Array(TRAIL * 4), meta: new Float32Array(TRAIL * 2), n: 0, box: [0, 0, 0, 0] };
const impulses = [];
let pointer = null; // last screen position of a mouse/pen pointer
let pending = [0, 0]; // motion since the last impulse
let lastImpulse = -1;

function onPointer(e) {
  if (e.pointerType === 'touch') return;
  if (pointer) { pending[0] += e.clientX - pointer[0]; pending[1] += e.clientY - pointer[1]; }
  pointer = [e.clientX, e.clientY];
}

function burst(e) {
  if (e.pointerType === 'touch' || engine.calm) return;
  impulses.push({ x: e.clientX, y: e.clientY + window.scrollY, dx: 0, dy: 0, t: engine.now(), burst: 34 });
  kick();
}

function updateTrail(t) {
  if (pointer && !engine.calm && Math.abs(pending[0]) + Math.abs(pending[1]) > 0.5 && t - lastImpulse >= 1 / 90) {
    impulses.push({ x: pointer[0], y: pointer[1] + window.scrollY, dx: pending[0], dy: pending[1], t, burst: 0 });
    pending = [0, 0];
    lastImpulse = t;
  }
  while (impulses.length && (t - impulses[0].t > PUSH_LIFE || impulses.length > TRAIL)) impulses.shift();
  // Bounds of everything the samples can reach, so the shader can skip
  // blocks nowhere near the pointer's path.
  const reach = (scene ? (scene.S.mobile ? 100 : 130) : 130) * 2.2;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  impulses.forEach((s, i) => {
    trail.pos.set([s.x, s.y, s.dx, s.dy], i * 4);
    trail.meta.set([s.t, s.burst], i * 2);
    box[0] = Math.min(box[0], s.x - reach); box[1] = Math.min(box[1], s.y - reach);
    box[2] = Math.max(box[2], s.x + reach); box[3] = Math.max(box[3], s.y + reach);
  });
  trail.box = box;
  trail.n = impulses.length;
  return trail.n > 0;
}

// ---------------------------------------------------------------- click light
//
// Every click sends a ring of spectral light out from the click point; the
// shaders light up blocks and grid dots as it passes.

const PULSE_LIFE = 1.6; // seconds (matches the fade in LIGHT_GLSL)
const pulses = [];
const pulseData = { data: new Float32Array(PULSES * 4), n: 0 };
const storyPulses = { data: new Float32Array(PULSES * 4), n: 0 }; // the same, in the story's time

function pulse(x, y, force = false) {
  if (engine.calm && !force) return;
  pulses.push({ x, y: y + window.scrollY, t: engine.now(), s: 1 });
  if (pulses.length > PULSES) pulses.shift();
  kick();
}

function updatePulses(t) {
  while (pulses.length && t - pulses[0].t > PULSE_LIFE) pulses.shift();
  pulses.forEach((p, i) => pulseData.data.set([p.x, p.y, p.t, p.s], i * 4));
  pulseData.n = pulses.length;
  return pulseData.n > 0;
}

// ---------------------------------------------------------------- the story
//
// /story/ is played by src/story/player.js (loaded the first time it's
// needed) on a layer of blocks of its own, with its own clock, under the nav.
// Arriving, the page morphs into the story's picture and then the story takes
// over; leaving (or opening the menu), it hands its picture back to the page,
// which morphs it into what's next. The story sets the colours while it shows.

let story = null; // the player, while on /story/
let handover = false; // the page is morphing into the story's picture
let storyAt = 0; // the site's time at the story's last frame
let storyLib = null;
const loadStory = () => import('./story/player.js').then((m) => { storyLib = m; });
const canGL = () => !document.documentElement.classList.contains('no-gl');
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

/** The rectangle the story has, on screen: under the nav (all of it, full screen). */
function storyStage() {
  const top = state.fullscreen ? 0 : tokens(renderer.w).navClip;
  return { x: 0, y: top, w: renderer.w, h: renderer.h - top };
}

function toggleFullscreen() {
  const d = document, el = d.documentElement;
  const r = fsElement()
    ? (d.exitFullscreen || d.webkitExitFullscreen).call(d)
    : (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  r?.catch?.(() => {});
}
const onFullscreen = () => {
  state.fullscreen = !!fsElement();
  render('local');
  story?.layout();
};
document.addEventListener('fullscreenchange', onFullscreen);
document.addEventListener('webkitfullscreenchange', onFullscreen);

/** Morph the page into the story's picture (creating the player first, if need be); it takes over once there. */
function storyIn() {
  story ||= storyLib.createPlayer({ renderer, stage: storyStage, fullscreen: toggleFullscreen, isFullscreen: () => !!fsElement() });
  state.storyEls = [story.frame()];
  handover = true;
  themeFrom = themeTo;
  themeTo = story.look().b;
  themeStart = engine.now();
  themeOrigin = lastOrigin || [vp.w / 2, vp.h / 2];
}

/** The story hands its picture to the page, at rest, and goes (or only hides, under the menu). */
function storyOut(keep) {
  themeFrom = story.visible ? story.colours() : themeTo;
  themeTo = THEMES[state.theme];
  themeStart = engine.now();
  themeOrigin = lastOrigin || [vp.w / 2, vp.h / 2];
  if (story.visible) engine.place([story.frame()]);
  handover = false;
  state.storyEls = null;
  if (keep) story.hide();
  else { story.destroy(); story = null; }
}

// ---------------------------------------------------------------- frame loop

let raf = 0;
let timer = 0;
function kick() { if (!raf) raf = requestAnimationFrame(frame); }

function frame() {
  raf = 0;
  if (!scene) return;
  const t = engine.now();
  engine.tick(t);
  const pushing = updateTrail(t);
  const lit = updatePulses(t);
  if (garden.on) garden.frame(t, pulses, { speed: 1100, width: scene.S.mobile ? 110 : 150 });
  const d = renderer.dpr;
  let tt = (t - themeStart) / 0.9;
  let look = { a: themeFrom, b: themeTo, t: tt >= 1 ? 2 : Math.max(0, tt), origin: themeOrigin };
  const layers = [];
  if (story) {
    story.step(Math.min(Math.max(0, t - storyAt), 0.05));
    storyAt = t;
    // The page has become the story's picture: the story takes it from here.
    if (handover && t > engine.animUntil + 0.05) {
      handover = false;
      engine.forget('story:');
      state.storyEls = null;
      story.show();
    }
    if (story.visible) {
      look = story.look();
      tt = look.t;
      // Each light reaches both: the page's in the story's time, the story's in the page's.
      const shift = story.time() - t, own = story.pulses();
      const mine = [...pulses.map((p) => ({ ...p, t: p.t + shift })), ...own].slice(-PULSES);
      storyPulses.n = mine.length;
      mine.forEach((p, i) => storyPulses.data.set([p.x, p.y, p.t, p.s], i * 4));
      const all = [...pulses, ...own.map((p) => ({ ...p, t: p.t - shift }))].slice(-PULSES);
      pulseData.n = all.length;
      all.forEach((p, i) => pulseData.data.set([p.x, p.y, p.t, p.s], i * 4));
      layers.push({ layer: story.layer, time: story.time(), navClip: story.clip(), pulses: storyPulses });
    }
  }
  renderer.draw({
    time: t,
    scroll: Math.round(window.scrollY * d) / d,
    shrink: SHRINK,
    navClip: Math.min(window.scrollY, scene.S.navClip),
    themeA: look.a,
    themeB: look.b,
    themeT: look.t,
    themeOrigin: look.origin,
    gridOrigin: [scene.S.left, 0],
    gridStep: 16,
    mouse,
    dotAlpha: 0.075,
    trail,
    pushR: scene.S.mobile ? 100 : 130,
    pushGain: 0.45,
    pulses: pulseData,
    pulseSpeed: 1100,
    pulseWidth: scene.S.mobile ? 110 : 150,
    layers,
  });
  if (story || garden.on || t < engine.animUntil + 0.05 || tt < 1 || pushing || lit) { kick(); return; }
  clearTimeout(timer);
  const next = engine.nextTick();
  if (next < Infinity) timer = setTimeout(kick, Math.max(16, (next - engine.now()) * 1000));
}

// ---------------------------------------------------------------- garden mode
//
// Any page can turn into a falling-sand garden (src/garden). While it's on,
// the page can't scroll, and a layer over it takes the pointer for the tools.

const garden = new Garden({
  renderer,
  engine,
  now: () => engine.now(),
  pulse: (x, y) => pulse(x, y, true),
  changed: () => { if (garden.on) { state.garden = garden.view(); render('local'); } },
  scene: () => scene,
});
// The page holds still while gardening. Hiding overflow would drop the
// scrollbar and widen the page (a resize), so scrolling is blocked instead.
let lockY = 0;
const holdStill = (e) => { if (garden.on) e.preventDefault(); };
window.addEventListener('wheel', holdStill, { passive: false });
window.addEventListener('touchmove', holdStill, { passive: false });
window.addEventListener('scroll', () => { if (garden.on && Math.abs(window.scrollY - lockY) > 0.5) window.scrollTo(0, lockY); });
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']);

const capture = document.createElement('div');
capture.id = 'garden';
capture.setAttribute('aria-hidden', 'true');
document.body.appendChild(capture);
capture.addEventListener('pointerdown', (e) => {
  try { capture.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
  garden.down(e.clientX, e.clientY);
  kick();
});
capture.addEventListener('pointermove', (e) => { mouse = [e.clientX, e.clientY]; garden.move(e.clientX, e.clientY); });
capture.addEventListener('pointerup', () => garden.up());
capture.addEventListener('pointercancel', () => garden.up());

function toggleGarden() {
  const root = document.documentElement;
  if (!garden.on && state.route.name === 'story') return; // the story needs the whole stage
  if (garden.on) {
    garden.leave();
    state.garden = null;
    root.classList.remove('gardening');
    render('local');
    return;
  }
  if (state.menuOpen) { state.menuOpen = false; render('page', { scrollTo: menuReturnScroll }); }
  state.hover = null;
  lockY = window.scrollY;
  garden.open();
  state.garden = garden.view();
  root.classList.add('gardening');
  render('local');
  garden.enter({ top: scene.S.navClip, bottom: scene.gardenTop, width: vp.w });
  state.garden = garden.view();
  capture.style.top = `${garden.y0}px`;
  capture.style.height = `${garden.rows * 4}px`;
  kick();
}

// ---------------------------------------------------------------- 404 puzzle

const PLAY_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
let lastPlay = -1;
let swipe = null;

/** Apply one puzzle step and redraw; held keys repeat at a readable pace. */
function play(step, held = false) {
  const t = engine.now();
  if (held && t - lastPlay < 0.11) return;
  if (!step()) return;
  lastPlay = t;
  render('local');
  if (puzzle.won) {
    // Light goes out from the word that made it true, then the page goes home.
    const el = scene.elements.find((x) => x.key === `pz:w${puzzle.won.ids[2]}`);
    const at = el ? [el.x + el.w / 2, el.y + el.h / 2 - window.scrollY] : [vp.w / 2, vp.h / 2];
    pulse(at[0], at[1]);
    setTimeout(() => {
      puzzle.clear();
      lastOrigin = at;
      navigate(parseRoute('/'), true);
    }, engine.calm ? 500 : 1300);
  }
}

// Swipes on the board move (touch-action: none on it keeps the page still).
document.addEventListener('pointerdown', (e) => {
  swipe = e.target.closest?.('[data-board]') ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
});
document.addEventListener('pointerup', (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  play(() => puzzle.move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'));
});

// ---------------------------------------------------------------- interaction

function centerOf(node) {
  const r = node.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

function runAction(action, node) {
  if (action === 'theme') {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    themeFrom = THEMES[state.theme];
    themeTo = THEMES[next];
    themeStart = engine.now();
    themeOrigin = centerOf(node);
    state.theme = next;
    store.set('theme', next);
    applyThemeCss();
    render('local');
  } else if (action === 'menu') {
    state.hover = null;
    if (!state.menuOpen) {
      menuReturnScroll = window.scrollY;
      if (story) storyOut(true);
      state.menuOpen = true;
      render('page', { scrollTo: 0, origin: centerOf(node) });
    } else {
      state.menuOpen = false;
      if (story) storyIn();
      render('page', { scrollTo: menuReturnScroll, origin: centerOf(node) });
    }
  } else if (action === 'top') {
    window.scrollTo({ top: 0, behavior: engine.calm ? 'auto' : 'smooth' });
  } else if (action === 'copy') {
    navigator.clipboard?.writeText(site.email).catch(() => {});
    state.copied = true;
    render('local');
    setTimeout(() => { state.copied = false; render('local'); }, 2200);
  } else if (action === 'print') {
    window.print();
  } else if (action === 'garden') {
    toggleGarden();
  } else if (action.startsWith('gd:')) {
    garden.select(action);
  } else if (action === 'pz:undo') {
    play(() => puzzle.undo());
  } else if (action === 'pz:restart') {
    play(() => puzzle.restart());
  } else if (action.startsWith('toggle:')) {
    const id = action.slice(7);
    if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
    render('local');
  }
}

const dom = new DomMirror(docEl, fixedEl, {
  hover(key, on) {
    if (key === 'nav-logo' && on) { engine.nudge('nav-logo:icon'); kick(); }
    const next = on ? key : state.hover === key ? null : state.hover;
    if (next === state.hover) return;
    state.hover = next;
    render('local');
  },
  click(key, node, e) {
    navByKeyboard = e.detail === 0;
    if (navByKeyboard || !lastOrigin) lastOrigin = centerOf(node);
    const action = node.dataset.action;
    if (action) { e.preventDefault(); runAction(action, node); return; }
    const href = node.getAttribute('href') || '';
    // Internal links navigate in place (and morph); modified clicks open tabs.
    if (!href.startsWith('/') || href.startsWith('//') || node.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const route = parseRoute(new URL(href, location.href).pathname);
    if (route.path !== state.route.path) { navigate(route, true); return; }
    if (state.menuOpen) {
      state.menuOpen = false;
      state.hover = null;
      if (story) storyIn();
      render('page', { scrollTo: 0, origin: lastOrigin });
    } else {
      window.scrollTo({ top: 0, behavior: engine.calm ? 'auto' : 'smooth' });
    }
  },
});

/** The canvas is decorative; this plain copy serves no-JS, no-WebGL and print. */
function syncStatic() {
  staticEl.innerHTML = pageHTML(state.route);
}

async function navigate(route, push) {
  if (garden.on) toggleGarden();
  if (route.name === 'story' && canGL() && !storyLib) await loadStory();
  scrollMemory.set(state.route.path, state.menuOpen ? menuReturnScroll : window.scrollY);
  if (push) history.pushState(null, '', route.path + location.search);
  const target = push ? 0 : scrollMemory.get(route.path) ?? 0;
  if (story && route.name !== 'story') storyOut(false);
  state.route = route;
  state.menuOpen = false;
  state.hover = null;
  applyMeta(route);
  syncStatic();
  if (route.name === 'story' && canGL()) storyIn();
  render('page', { scrollTo: target, origin: lastOrigin || [vp.w / 2, vp.h / 2] });
  if (navByKeyboard) docEl.querySelector('h1')?.focus({ preventScroll: true });
  navByKeyboard = false;
}

window.addEventListener('popstate', () => navigate(parseRoute(), false));
window.addEventListener('hashchange', () => {
  const path = fromHash();
  if (!path) return;
  history.replaceState(null, '', path + location.search);
  navigate(parseRoute(), false);
});

document.addEventListener('pointerdown', (e) => {
  if (e.target === capture) return; // the garden's own tools handle it
  lastOrigin = [e.clientX, e.clientY];
  burst(e);
  if (e.pointerType !== 'touch' && e.button === 0) pulse(e.clientX, e.clientY);
}, { capture: true });
// Touch: pulse on tap (click), not on touch-down, which also starts scrolls.
document.addEventListener('click', (e) => { if (e.pointerType === 'touch' && e.target !== capture) pulse(e.clientX, e.clientY); }, { capture: true });
document.addEventListener('pointermove', (e) => { mouse = [e.clientX, e.clientY]; onPointer(e); kick(); }, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { mouse = [-1e4, -1e4]; pointer = null; pending = [0, 0]; kick(); });
window.addEventListener('scroll', () => { engine.reveal(window.scrollY); kick(); }, { passive: true });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.menuOpen) runAction('menu', fixedEl);
  // Garden mode: G toggles it on any page, Escape leaves; keys don't scroll it.
  if (!e.metaKey && !e.ctrlKey && !e.altKey && ((e.key === 'g' || e.key === 'G') || (e.key === 'Escape' && garden.on))) {
    e.preventDefault();
    if (!e.repeat) toggleGarden();
    return;
  }
  if (garden.on && SCROLL_KEYS.has(e.key) && !(e.key === ' ' && e.target.closest?.('a, button'))) e.preventDefault();
  // The 404 puzzle: arrows or WASD move, Z undoes, R restarts.
  if (state.route.name !== 'notFound' || state.menuOpen || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const fn = PLAY_KEYS[k] ? () => puzzle.move(PLAY_KEYS[k]) : k === 'z' || k === 'Backspace' ? () => puzzle.undo() : k === 'r' ? () => puzzle.restart() : null;
  if (!fn) return;
  e.preventDefault();
  play(fn, e.repeat);
});

let rz = 0;
let lastDpr = dpr();
function onResize() {
  const [w, h] = size();
  const d = dpr();
  if (w === renderer.w && h === renderer.h && d === lastDpr) return;
  lastDpr = d;
  vp.h = h;
  engine.vh = h;
  renderer.resize(w, h, d);
  engine.reveal(window.scrollY);
  story?.layout(); // the story re-fits at once, so its blocks shift as the window does
  kick();
  clearTimeout(rz);
  rz = setTimeout(() => {
    const [w2, h2] = size();
    const widthChanged = w2 !== vp.w;
    // A garden is laid on the page as it was, so a new width starts it again.
    const regarden = widthChanged && garden.on;
    if (regarden) toggleGarden();
    vp.w = w2;
    if (widthChanged || Math.abs(h2 - layoutH) > 160) {
      layoutH = h2;
      render('resize');
    }
    if (regarden) {
      toggleGarden();
      garden.say('THE WINDOW CHANGED SIZE, SO THE GARDEN STARTED AGAIN.', 5);
    }
  }, 140);
}
new ResizeObserver(onResize).observe(canvas);
window.addEventListener('resize', onResize); // DPR changes (moving between screens)

// ---------------------------------------------------------------- boot

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
applyThemeCss();
applyMeta(state.route);
syncStatic();
renderer.resize(vp.w, vp.h, dpr());
const boot = () => render('intro', { scrollTo: 0 });
if (state.route.name === 'story' && canGL()) {
  loadStory().then(() => { storyIn(); boot(); });
} else {
  boot();
  setTimeout(loadStory, 4000); // the story's code, ready for when it's wanted
}

animateFavicon();

// Real photos re-render once loaded.
window.addEventListener('photo-loaded', () => render('local'));

// Debug/inspection handle.
window.__site = { engine, state, render, impulses, pulses, kick, frame, puzzle, garden, navigate, get scene() { return scene; }, get story() { return story; } };
