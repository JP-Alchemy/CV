import { Renderer } from './engine/renderer.js';
import { Engine, SHRINK } from './engine/engine.js';
import { buildScene, pageTitle } from './scene.js';
import { DomMirror } from './dom.js';
import { parseRoute } from './router.js';
import { site, experience } from './content.js';
import './style.css';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const THEMES = {
  light: { bg: hex('#f0f0eb'), fg: hex('#0e0e0e'), css: '#f0f0eb' },
  dark: { bg: hex('#0c0c0c'), fg: hex('#ebebe4'), css: '#0c0c0c' },
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const canvas = document.getElementById('gl');
const docEl = document.getElementById('doc');
const fixedEl = document.getElementById('fixed');

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
};

// Measure the canvas itself: it tracks every viewport change (rotation,
// browser UI, zoom, device emulation), unlike innerWidth + 'resize' alone.
const size = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight];
const vp = { w: size()[0], h: size()[1] };
let layoutH = vp.h;
let scene = null;
let mouse = [-1e4, -1e4];
let lastOrigin = null;
let navByClick = false;
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
  docEl.style.height = `${scene.height}px`;
  dom.sync(scene);
  if (Math.abs(window.scrollY - scrollTo) > 0.5) window.scrollTo(0, scrollTo);
  engine.reveal(scrollTo);
  kick();
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
  const d = renderer.dpr;
  const tt = (t - themeStart) / 0.9;
  renderer.draw({
    time: t,
    scroll: Math.round(window.scrollY * d) / d,
    shrink: SHRINK,
    navClip: Math.min(window.scrollY, scene.S.navClip),
    themeA: themeFrom,
    themeB: themeTo,
    themeT: tt >= 1 ? 2 : Math.max(0, tt),
    themeOrigin,
    gridOrigin: [scene.S.left, 0],
    gridStep: 16,
    mouse,
    dotAlpha: 0.075,
  });
  if (t < engine.animUntil + 0.05 || tt < 1) { kick(); return; }
  clearTimeout(timer);
  const next = engine.nextTick();
  if (next < Infinity) timer = setTimeout(kick, Math.max(16, (next - engine.now()) * 1000));
}

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
      state.menuOpen = true;
      render('page', { scrollTo: 0, origin: centerOf(node) });
    } else {
      state.menuOpen = false;
      render('page', { scrollTo: menuReturnScroll, origin: centerOf(node) });
    }
  } else if (action === 'top') {
    window.scrollTo({ top: 0, behavior: engine.calm ? 'auto' : 'smooth' });
  } else if (action === 'copy') {
    navigator.clipboard?.writeText(site.email).catch(() => {});
    state.copied = true;
    render('local');
    setTimeout(() => { state.copied = false; render('local'); }, 2200);
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
    if (href.startsWith('#')) {
      const same = parseRoute(href).path === state.route.path && !state.menuOpen;
      if (same) { e.preventDefault(); window.scrollTo({ top: 0, behavior: engine.calm ? 'auto' : 'smooth' }); return; }
      navByClick = true;
      if (state.menuOpen && parseRoute(href).path === state.route.path) {
        e.preventDefault();
        state.menuOpen = false;
        state.hover = null;
        render('page', { scrollTo: 0, origin: lastOrigin });
      }
    }
  },
});

window.addEventListener('hashchange', () => {
  scrollMemory.set(state.route.path, state.menuOpen ? menuReturnScroll : window.scrollY);
  const route = parseRoute();
  const target = navByClick ? 0 : scrollMemory.get(route.path) ?? 0;
  navByClick = false;
  state.route = route;
  state.menuOpen = false;
  state.hover = null;
  document.title = pageTitle(route);
  render('page', { scrollTo: target, origin: lastOrigin || [vp.w / 2, vp.h / 2] });
  if (navByKeyboard) docEl.querySelector('h1')?.focus({ preventScroll: true });
  navByKeyboard = false;
});

document.addEventListener('pointerdown', (e) => { lastOrigin = [e.clientX, e.clientY]; }, { capture: true });
document.addEventListener('pointermove', (e) => { mouse = [e.clientX, e.clientY]; kick(); }, { passive: true });
document.addEventListener('pointerleave', () => { mouse = [-1e4, -1e4]; kick(); });
window.addEventListener('scroll', () => { engine.reveal(window.scrollY); kick(); }, { passive: true });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.menuOpen) runAction('menu', fixedEl);
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
  kick();
  clearTimeout(rz);
  rz = setTimeout(() => {
    const [w2, h2] = size();
    const widthChanged = w2 !== vp.w;
    vp.w = w2;
    if (widthChanged || Math.abs(h2 - layoutH) > 160) {
      layoutH = h2;
      render('resize');
    }
  }, 140);
}
new ResizeObserver(onResize).observe(canvas);
window.addEventListener('resize', onResize); // DPR changes (moving between screens)

// ---------------------------------------------------------------- boot

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
applyThemeCss();
document.title = pageTitle(state.route);
renderer.resize(vp.w, vp.h, dpr());
render('intro', { scrollTo: 0 });

// Real photos re-render once loaded.
window.addEventListener('photo-loaded', () => render('local'));

// Debug/inspection handle.
window.__site = { engine, state, render, get scene() { return scene; } };
