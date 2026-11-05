// The page in 3D (engine/renderer3d.js): tilt it back like a runway and drag
// to turn it. Loaded only when wanted; until then nothing changes, and flat
// it draws exactly as the 2D renderer does.
//
// Tilted, the page's links aren't where the blocks are on screen any more,
// so the mirror's links (dom.js) stop taking the pointer and a click or hover
// is taken to where it meets the page instead. The nav stays flat and keeps
// its own links. The pointer's push and the click light go there too.

import { attach3D } from './engine/renderer3d.js';

const PAGE = { tilt: -0.85, yaw: 0.42 }; // a page lies back, a little turned
const SHAPE = { tilt: -0.32, yaw: 0.3 }; // a shape is seen nearly face on
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * o: { renderer, engine, kick, surface (where drags start), height() (the
 * page's height), doc / fixed (the mirror's roots, optional) }.
 */
export function tilt3d(o) {
  const { engine, kick } = o;
  const cam = attach3D(o.renderer);
  const T = { cam, k: 0, kTo: 0, yaw: 0, pitch: 0, sm: 0, shape: false, last: 0, raf: 0 };
  const root = document.documentElement;

  const view = () => {
    const k = T.k, m = T.sm, r = o.renderer;
    cam.view.k = k;
    cam.view.tilt = k ? k * (PAGE.tilt + (SHAPE.tilt - PAGE.tilt) * m + T.pitch) : 0;
    cam.view.yaw = k ? k * (PAGE.yaw + (SHAPE.yaw - PAGE.yaw) * m + T.yaw) : 0;
    cam.view.s = k ? k / (1.4 * Math.max(r.w, r.h)) : 0;
    cam.on = k > 0; // flat, it's the 2D renderer itself (and Powers of Ten's zoom keeps its camera)
    root.classList.toggle('tilted', k > 0);
  };

  /** Ease towards the wanted tilt; true while still moving. */
  T.step = (now = performance.now()) => {
    const dt = Math.min(0.1, (now - (T.last || now)) / 1000);
    T.last = now;
    const ease = (v, to, rate) => (engine.calm ? to : Math.abs(to - v) < 1e-3 ? to : v + (to - v) * Math.min(1, dt * rate));
    T.k = ease(T.k, T.kTo, 3.2);
    T.sm = ease(T.sm, +T.shape, 2.5);
    if (!T.k) T.yaw = T.pitch = 0; // back flat: the next tilt starts from the usual angle
    view();
    T.reveal();
    return T.k !== T.kTo || T.sm !== +T.shape;
  };

  const run = () => {
    if (T.raf) return;
    T.last = 0;
    const go = (now) => { T.raf = 0; const more = T.step(now); kick(); if (more || drag) T.raf = requestAnimationFrame(go); };
    T.raf = requestAnimationFrame(go);
  };

  /** Tilt in (true) or lay flat (false); `shape` turns the camera towards something in the middle. */
  T.set = (on, shape = T.shape) => { T.kTo = on ? 1 : 0; T.shape = !!shape; run(); };
  T.toggle = () => T.set(!T.kTo);

  /** Where a screen point lands on the page (screen px): for the push, the light and clicks. */
  T.pointer = (x, y) => (T.k ? cam.toPage(x, y) || [x, y] : [x, y]);

  /**
   * Blocks that started off screen wait until scrolled to (engine.reveal).
   * Tilted, the screen shows more of the page: reveal all of it it can see.
   */
  T.reveal = () => {
    const top = window.scrollY, r = o.renderer, H = r.h;
    let y0 = top, y1 = top + H;
    if (T.k) {
      y0 = Infinity; y1 = -Infinity;
      for (const y of [0, H]) for (const x of [0, r.w / 2, r.w]) {
        const p = cam.toPage(x, y);
        if (!p) { y0 = Math.min(y0, top); y1 = Infinity; continue; }
        y0 = Math.min(y0, p[1] + top); y1 = Math.max(y1, p[1] + top);
      }
      y1 = Math.min(y1, o.height() + H);
    }
    const keep = engine.vh;
    engine.vh = Math.max(H, (y1 - y0) / 0.94);
    if (engine.reveal(y0)) kick();
    engine.vh = keep;
  };
  window.addEventListener('scroll', () => { if (T.k) T.reveal(); }, { passive: true });

  // Drag to turn it (mouse and pen; a finger scrolls). Dragging the flat page tips it in.
  let drag = null;
  o.surface.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest?.('#fixed, #panel, input, textarea')) return;
    drag = { x: e.clientX, y: e.clientY, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    drag.moved = true;
    if (!T.kTo) T.set(true);
    // Never round to the back of the page: about ±70° side to side, from face on to 75° back.
    const yaw0 = PAGE.yaw + (SHAPE.yaw - PAGE.yaw) * T.sm, tilt0 = PAGE.tilt + (SHAPE.tilt - PAGE.tilt) * T.sm;
    T.yaw = clamp(T.yaw + dx * 0.004, -1.2 - yaw0, 1.2 - yaw0);
    T.pitch = clamp(T.pitch - dy * 0.003, -1.3 - tilt0, 0.15 - tilt0);
    drag.x = e.clientX; drag.y = e.clientY;
    T.dragging = true;
    run();
  });
  window.addEventListener('pointerup', () => {
    if (drag?.moved) addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true }); // a drag isn't a click
    drag = null;
    T.dragging = false;
  });

  // Tilted clicks and hover: the mirror's link under where the pointer meets the page.
  if (o.doc) {
    const style = document.createElement('style');
    style.textContent = '.tilted #doc .hit { pointer-events: none; }';
    document.head.appendChild(style);
    const linkAt = (x, y) => {
      const p = T.pointer(x, y);
      for (const n of o.doc.querySelectorAll('.hit')) {
        const b = n.getBoundingClientRect();
        if (p[0] >= b.left && p[0] < b.right && p[1] >= b.top && p[1] < b.bottom) return n;
      }
      return null;
    };
    let over = null;
    const hover = (n) => {
      if (n === over) return;
      over?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      n?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      over = n;
      root.style.cursor = n ? 'pointer' : '';
    };
    window.addEventListener('pointermove', (e) => {
      if (!T.k || drag?.moved || e.pointerType !== 'mouse' || o.fixed?.contains(e.target)) return hover(null);
      hover(linkAt(e.clientX, e.clientY));
    }, { passive: true });
    window.addEventListener('click', (e) => {
      if (!T.k || o.fixed?.contains(e.target) || e.target.closest?.('a, button')) return;
      const n = linkAt(e.clientX, e.clientY);
      if (n) { e.preventDefault(); n.click(); }
    });
  }

  addEventListener('keydown', (e) => {
    if (e.key !== '3' || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
    T.toggle();
  });

  view();
  return T;
}
