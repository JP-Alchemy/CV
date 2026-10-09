// Plays The Adventurer (story.js) inside the site, at /story/, under the
// site's nav. The site (src/main.js) creates a player when you arrive and
// gives it a layer of blocks of its own (renderer.layer()); the player runs
// its own engine on the story's clock, so it can pause, be scrubbed to any
// moment (?t=seconds opens on one) and keep its own sound. Arriving, the site
// morphs the page you came from into the story's picture (frame()) and then
// hands over (show()); leaving, the player hands its picture back the same
// way, so it can morph into the next page.
//
// The story's clock only runs while it plays. The engine's time runs on
// regardless (clock + slack), so what's already moving settles when you
// pause, the stars keep twinkling, and the picture can re-form for a new
// screen shape while paused, too.
import { Engine, evalInst } from '../engine/engine.js';
import { STRIDE } from '../engine/renderer.js';
import { THEMES as BRAND, unit } from '../brand.js';
import { CUES, CHAPTERS, LENGTH, NIGHT, W, H, SQ, STRIP, subtitleEnd, setView } from './story.js';
import { Sound, renderTrack } from './sound.js';
import { pixelBox, labelSize } from './pixels.js';
import './player.css';

const THEMES = Object.fromEntries(Object.entries(BRAND).map(([k, t]) => [k, { bg: unit(t.bg), fg: unit(t.fg) }]));
const PULSE_LIFE = 1.6;
const POSTER = 2.2; // landing: the title, assembled, just before its light (2.3)
const START = labelSize('PLAY'); // the PLAY button under the title, on landing
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// For screen readers: the line being said, in ordinary case.
const sentence = (s) => s.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
// Lights, origins and theme points can be functions, worked out when they happen.
const pt = (p) => (typeof p === 'function' ? p() : p);

const UI = `
  <h1 class="sr">The Adventurer: a short story in blocks</h1>
  <p class="sr" data-said aria-live="polite"></p>
  <button class="start" type="button" aria-label="Play" title="Play (space)"><canvas></canvas></button>
  <div class="bar">
    <button data-play type="button" aria-label="Play" title="Play (space)"><canvas></canvas></button>
    <div class="scrub" role="slider" tabindex="0" aria-label="Time" aria-valuemin="0" aria-valuenow="0">
      <div class="track"><div class="done"></div></div>
      <div class="marks" aria-hidden="true"></div>
      <div class="knob" aria-hidden="true"></div>
      <div class="tip" hidden aria-hidden="true"></div>
    </div>
    <span class="time"><span class="now">00:00</span><span class="of"></span></span>
    <button data-sound type="button" aria-label="Sound" aria-pressed="true" title="Sound on (M)"><canvas></canvas></button>
    <button data-full type="button" aria-label="Fullscreen" title="Fullscreen (F)"><canvas></canvas></button>
  </div>`;

/**
 * The player. o.renderer: the site's. o.stage(): the rectangle the story
 * has, in screen px (under the nav). o.fullscreen(): toggle full screen.
 * o.isFullscreen().
 */
export function createPlayer(o) {
  const layer = o.renderer.layer();
  const sound = new Sound();
  const root = document.createElement('div');
  root.id = 'story-ui';
  root.innerHTML = UI;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  const ui = {
    bar: $('.bar'), play: $('[data-play]'), sound: $('[data-sound]'), full: $('[data-full]'), now: $('.now'), of: $('.of'),
    scrub: $('.scrub'), done: $('.done'), knob: $('.knob'), marks: $('.marks'), tip: $('.tip'), said: $('[data-said]'), start: $('.start'),
  };

  let engine, clock = 0, slack = 0, next = 0, playing = false, started = false, visible = false;
  let pulses = [], current = 'light', theme = null, said = null, shown = null, view = null, last = -1, snaps = 0;
  const now = () => clock + slack;

  // ------------------------------------------------------------ the stage

  /**
   * Where the story goes on the stage as it is now. The square always fits;
   * the wider the stage, the more of the wide frame it shows (k). On a tall
   * stage the words go under the square.
   */
  function fit() {
    const st = o.stage(), room = Math.max(1, st.h - ui.bar.offsetHeight);
    const tall = st.w / room < 0.8, fh = tall ? H + STRIP : H;
    const s = Math.min(st.w / SQ, room / fh); // screen px per story px
    const w = st.w / s;
    return {
      s, ox: st.x, oy: st.y, w, h: st.h / s, tall, clip: st.y,
      k: clamp((w - SQ) / (W - SQ), 0, 1),
      x: (w - W) / 2,
      // A tall picture sits a little above the middle, where the eye expects it.
      y: (room / s - fh) * (tall ? 0.4 : 0.5),
      // The words at least ~11 px tall along the bottom, ~15 under a tall picture.
      cap: tall ? clamp(Math.round(15 / (7 * s)), 3, 9) : clamp(Math.ceil(11 / (7 * s)), 3, 5),
    };
  }

  /** Fit the story to the stage; if that changed its shape, the picture re-forms to fit. */
  function layout() {
    const v = fit();
    const same = view && view.tall === v.tall && view.cap === v.cap
      && ['s', 'ox', 'oy', 'x', 'y', 'w', 'h'].every((k) => Math.abs(view[k] - v[k]) < 0.01);
    view = v;
    setView(v);
    // PLAY sits under the title card's "A SHORT STORY IN BLOCKS", wherever that is.
    ui.start.style.left = `${Math.round(v.ox + (W / 2 + v.x) * v.s - START.w / 2)}px`;
    ui.start.style.top = `${Math.round(v.oy + (subtitleEnd() + v.y) * v.s + 28)}px`;
    if (!same && engine) reshape();
  }

  /** Re-form the scene as it is now for a new view (it moves even while paused: see slack). */
  function reshape() {
    engine.vw = o.renderer.w;
    engine.vh = o.renderer.h;
    if (last < 0) return;
    const els = CUES[last].scene().map((e) => (e.sweep ? { ...e, sweep: 0 } : e));
    engine.morphTo({ elements: els }, { mode: 'local', scrollFrom: 0, scrollTo: 0 });
  }

  // ------------------------------------------------------------ the clock

  function reset() {
    clock = 0; slack = 0; next = 0; pulses = []; current = 'light'; said = null; last = -1;
    theme = { from: THEMES.light, to: THEMES.light, start: -10, origin: [0, 0] };
    engine = new Engine(layer);
    engine.now = now;
    engine.vw = o.renderer.w; engine.vh = o.renderer.h; engine.gridX = 0;
    engine.morphTo({ elements: [] });
  }

  const onStage = (p) => [view.ox + (p[0] + view.x) * view.s, view.oy + (p[1] + view.y) * view.s];

  /** Cue i, at its own time (not the frame's), so timing never drifts. Sound only when playing for real. */
  function run(i, live) {
    const cue = CUES[i];
    if (cue.theme) {
      theme = { from: THEMES[current], to: THEMES[cue.theme.to], start: now(), origin: onStage(pt(cue.theme.at)) };
      current = cue.theme.to;
    }
    if (cue.scene) {
      const els = cue.scene();
      last = i;
      engine.morphTo({ elements: els }, { mode: cue.mode || 'local', origin: cue.origin && onStage(pt(cue.origin)), scrollFrom: 0, scrollTo: 0 });
      // A new line is said as it forms; the very first one waits for the page to assemble.
      const cap = els.find((e) => e.key === 'cap');
      if (live && cap && cap.say !== said) {
        if (sound.ready) sound.speak(cap.say, cap.voice.name, sound.ctx.currentTime + (said ? 0.12 : 0.7), cap.voice.base);
        ui.said.textContent = sentence(cap.say);
      }
      said = cap ? cap.say : null;
    }
    for (const p of pt(cue.light) || []) { const [x, y] = onStage(p); pulses.push({ x, y, t: now(), s: 1 }); }
    if (live) for (const s of cue.sound || []) { const [name, arg] = [].concat(s); sound.play(name, arg); }
  }

  function advance(to, live = false) {
    while (next < CUES.length && CUES[next].t <= to) {
      clock = CUES[next].t;
      run(next++, live);
    }
    clock = to;
    engine.tick(now());
  }

  /** Rebuild the scene at t: replay every cue up to it, quickly and silently. */
  function replay(t) {
    reset();
    for (let s = 0; s < t; s += 1 / 30) advance(s);
    advance(t);
  }
  /** Jump to t, stopping whatever was sounding. */
  function seek(t) {
    sound.stopAll();
    replay(clamp(t, 0, LENGTH));
  }

  // ------------------------------------------------------------ controls

  const chapterAt = (t) => CHAPTERS.reduce((c, x) => (x.t <= t ? x : c), CHAPTERS[0]);
  for (const c of CHAPTERS.slice(1)) {
    const m = document.createElement('i');
    m.style.left = `${(c.t / LENGTH) * 100}%`;
    ui.marks.append(m);
  }
  ui.of.textContent = ` / ${mmss(LENGTH)}`;
  ui.scrub.setAttribute('aria-valuemax', String(LENGTH));

  /** The night's drone, if we're in the night (after a jump into it). */
  const ambience = () => { if (playing && clock > NIGHT[0] && clock < NIGHT[1]) sound.play('night'); };
  /** Play on from wherever it is (from the title card, on landing); at the end, from the top. */
  function play() {
    sound.unlock();
    if (clock >= LENGTH) seek(0);
    started = true;
    sound.resume();
    playing = true;
    ambience();
  }
  function pause() {
    playing = false;
    sound.pause();
  }
  function jump(t) {
    seek(t);
    started = true;
    ambience();
  }
  const toggle = () => { if (playing) pause(); else play(); };
  const fromTop = () => { seek(0); play(); };

  /** Chapter by chapter. Back goes to the start of this one, or the one before if we've only just begun it. */
  function chapter(d) {
    const i = CHAPTERS.indexOf(chapterAt(clock));
    const j = clamp(d > 0 ? i + 1 : clock - CHAPTERS[i].t > 2 ? i : i - 1, 0, CHAPTERS.length - 1);
    // Playing, watch the cut happen; paused, land once it has settled.
    jump(CHAPTERS[j].t + (playing || j === 0 ? 0 : 1.6));
  }

  // The scrubber: drag (or click) anywhere along it. Jumps happen once a frame,
  // so dragging stays smooth.
  let drag = null, want = null;
  const timeAt = (e) => { const r = ui.scrub.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * LENGTH; };
  function tip(t) {
    ui.tip.hidden = false;
    ui.tip.textContent = `${chapterAt(t).name} ${mmss(t)}`;
    const w = ui.scrub.clientWidth, half = ui.tip.offsetWidth / 2;
    ui.tip.style.left = `${clamp((t / LENGTH) * w, half, w - half)}px`;
  }
  ui.scrub.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    ui.scrub.setPointerCapture(e.pointerId);
    drag = { was: playing };
    if (playing) pause();
    want = timeAt(e);
    tip(want);
  });
  ui.scrub.addEventListener('pointermove', (e) => {
    const t = timeAt(e);
    if (drag) want = t;
    if (drag || e.pointerType === 'mouse') tip(t);
  });
  function drop() {
    if (!drag) return;
    if (want !== null) { seek(want); want = null; }
    started = true;
    ui.tip.hidden = true;
    if (drag.was) play();
    drag = null;
  }
  ui.scrub.addEventListener('pointerup', drop);
  ui.scrub.addEventListener('pointercancel', drop);
  ui.scrub.addEventListener('pointerleave', () => { if (!drag) ui.tip.hidden = true; });

  // Full screen, where the browser allows it (not iPhones: there, turn the phone sideways).
  ui.full.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const fullscreen = () => { if (!ui.full.hidden) o.fullscreen(); };

  ui.play.addEventListener('click', toggle);
  ui.sound.addEventListener('click', () => { sound.unlock(); sound.setOn(!sound.on); });
  ui.full.addEventListener('click', fullscreen);
  ui.start.addEventListener('click', play);
  // A double click on the picture goes full screen (not on the nav's links, or the controls).
  const onDouble = (e) => { if (visible && !e.target.closest?.('a, button, #story-ui .bar')) fullscreen(); };
  document.addEventListener('dblclick', onDouble);

  // The buttons, in blocks (pixels.js): they fill in like the site's nav.
  Object.assign(ui.start.style, { width: `${START.w}px`, height: `${START.h}px` });
  const boxes = {
    play: pixelBox(ui.play.querySelector('canvas'), 36, 36),
    sound: pixelBox(ui.sound.querySelector('canvas'), 44, 36),
    full: pixelBox(ui.full.querySelector('canvas'), 36, 36),
    start: pixelBox(ui.start.querySelector('canvas'), START.w, START.h),
  };
  boxes.start.show('PLAY', { text: true });
  for (const k of Object.keys(boxes)) {
    const b = ui[k];
    b.addEventListener('pointerenter', () => boxes[k].hover(true));
    b.addEventListener('pointerleave', () => boxes[k].hover(b.matches(':focus-visible')));
    b.addEventListener('focus', () => boxes[k].hover(b.matches(':focus-visible')));
    b.addEventListener('blur', () => boxes[k].hover(false));
  }

  // While it plays, the controls fade after a moment of stillness; any touch,
  // move or key brings them back. (Clicking the picture doesn't play or pause:
  // it sends out the site's light, as anywhere else.)
  let idleAt = 0;
  const poke = () => { idleAt = performance.now() + 2600; document.documentElement.classList.remove('story-idle'); };
  document.addEventListener('pointerdown', poke, true);
  document.addEventListener('pointermove', poke);
  root.addEventListener('focusin', poke);
  function idle() {
    const still = visible && playing && !view.tall && !drag && performance.now() > idleAt && !ui.bar.matches(':hover');
    document.documentElement.classList.toggle('story-idle', still);
  }

  const KEYS = {
    ' ': toggle, k: toggle, f: fullscreen, m: () => ui.sound.click(), r: fromTop,
    ArrowLeft: (e) => (e.shiftKey ? chapter(-1) : jump(clock - 5)),
    ArrowRight: (e) => (e.shiftKey ? chapter(1) : jump(clock + 5)),
    j: () => jump(clock - 10), l: () => jump(clock + 10),
    PageUp: () => chapter(-1), PageDown: () => chapter(1),
    Home: () => jump(0), End: () => jump(LENGTH),
  };
  function onKey(e) {
    if (!visible || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ((k === ' ' || k === 'Enter') && e.target.closest?.('button, a')) return; // the button's own
    const go = KEYS[k] || (/^[0-9]$/.test(k) ? () => jump((LENGTH * Number(k)) / 10) : null);
    if (!go) return;
    e.preventDefault();
    go(e);
    poke();
  }
  document.addEventListener('keydown', onKey);

  const put = (el, k, v) => { if (el[k] !== v) el[k] = v; };
  const attr = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
  // Each button's icon, its name for screen readers, and a tooltip with its key.
  const SAYS = {
    play: ['Play', 'Play (space)'], pause: ['Pause', 'Pause (space)'], again: ['Play again', 'Play again (space)'],
    full: ['Fullscreen', 'Fullscreen (F)'], window: ['Exit fullscreen', 'Exit fullscreen (F)'],
  };
  function button(b, box, name) {
    box.show(name);
    if (SAYS[name]) { attr(b, 'aria-label', SAYS[name][0]); put(b, 'title', SAYS[name][1]); }
  }
  let second = -1;
  function refresh() {
    const t = Math.min(clock, LENGTH), pct = `${(t / LENGTH) * 100}%`;
    button(ui.play, boxes.play, playing ? 'pause' : clock >= LENGTH ? 'again' : 'play');
    if (started && !ui.start.hidden && !ui.start.classList.contains('gone')) {
      ui.start.classList.add('gone');
      boxes.start.clear();
    }
    button(ui.sound, boxes.sound, sound.on ? 'sound' : 'muted');
    attr(ui.sound, 'aria-pressed', String(sound.on));
    put(ui.sound, 'title', sound.on ? 'Sound on (M)' : 'Sound off (M)');
    button(ui.full, boxes.full, o.isFullscreen() ? 'window' : 'full');
    put(ui.now, 'textContent', mmss(t));
    ui.done.style.width = pct;
    ui.knob.style.left = pct;
    if (Math.floor(t) !== second) {
      second = Math.floor(t);
      ui.scrub.setAttribute('aria-valuenow', String(second));
      ui.scrub.setAttribute('aria-valuetext', `${mmss(t)}, ${chapterAt(t).name.toLowerCase()}`);
    }
  }

  // ------------------------------------------------------------ for the site

  /** One of the site's frames, dt seconds after the last. */
  function step(dt) {
    if (want !== null) { seek(want); started = true; want = null; }
    if (playing) {
      advance(clock + dt, true);
      if (clock >= LENGTH) playing = false;
    } else {
      slack += dt;
      engine.tick(now());
    }
    pulses = pulses.filter((p) => now() - p.t < PULSE_LIFE);
    // The controls follow the story from day into night and back.
    if (current !== shown) {
      shown = current;
      root.style.setProperty('--paper', BRAND[current].bg);
      root.style.setProperty('--ink', BRAND[current].fg);
      for (const b of Object.values(boxes)) b.theme(THEMES[current]);
    }
    for (const b of Object.values(boxes)) b.draw();
    idle();
    refresh();
  }

  /** The colours to draw with right now (see the renderer's theme). */
  function look() {
    const tt = (now() - theme.start) / 0.9;
    return { a: theme.from, b: theme.to, t: tt >= 1 ? 2 : Math.max(0, tt), origin: theme.origin };
  }

  /** The picture as it is now, as one element at rest: for the site's engine to morph into, or to take over. */
  function frame() {
    const t = now(), a = engine.buf, out = [];
    for (let i = 0; i < engine.count; i++) {
      const c = evalInst(a, i * STRIDE, t);
      if (c.w >= 0.05 && c.h >= 0.05) out.push(c.x, c.y, c.w, c.h, c.tone);
    }
    return { key: 'story:frame', sig: `story|${++snaps}`, x: 0, y: 0, w: 0, h: 0, blocks: Float32Array.from(out), z: 0, flat: false, fixed: false };
  }

  function show() {
    visible = true;
    layout();
    root.classList.add('on');
  }
  function hide() {
    pause();
    visible = false;
    root.classList.remove('on');
    document.documentElement.classList.remove('story-idle');
  }
  function destroy() {
    hide();
    sound.stopAll();
    sound.ctx?.close?.();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', poke, true);
    document.removeEventListener('pointermove', poke);
    document.removeEventListener('dblclick', onDouble);
    root.remove();
    layer.dispose();
    if (window.__story === api) delete window.__story;
  }

  // Until someone presses play (browsers keep sound off until then), the
  // title card holds, already assembled, just before its light: PLAY sets that
  // off, chime and all, and the story carries on from there. ?t=seconds opens
  // on that moment instead.
  layout();
  const at = Number(new URLSearchParams(location.search).get('t'));
  seek(at || POSTER);
  started = !!at;
  if (started) ui.start.hidden = true;
  refresh();

  const api = {
    get visible() { return visible; },
    layer, time: now, clip: () => view.clip, pulses: () => pulses, step, look,
    /** The colours on show now, for the site to turn back from as you leave. */
    colours: () => ((now() - theme.start) / 0.9 >= 0.5 ? theme.to : theme.from),
    frame, show, hide, layout, destroy,
    // For poking at it in the console: __story.seek(42); await __story.levels()
    seek, jump, play, pause, CUES, CHAPTERS, sound,
    get clock() { return clock; }, get view() { return view; },
    levels: () => renderTrack(CUES, LENGTH),
  };
  window.__story = api;
  return api;
}
