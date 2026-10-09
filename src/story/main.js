// Plays the story (story.js) with the site's own renderer and morph engine,
// and its sound (sound.js). The engine runs on the player's clock, so the
// story can pause, be scrubbed to any moment (?t=seconds opens on one) and
// record itself to video, sound and all.
//
// The stage fills the window and is drawn at the screen's own resolution. The
// story's 1280 × 720 frame sits in the middle, as big as fits above the
// controls, with the background, stars and ground carrying on to the edges;
// on a tall screen the words go under the picture (story.js: setView).
import { Renderer, TRAIL, PULSES } from '../engine/renderer.js';
import { Engine, SHRINK } from '../engine/engine.js';
import { THEMES as BRAND, unit } from '../brand.js';
import { CUES, CHAPTERS, LENGTH, NIGHT, W, H, STRIP, SUB_Y, setView } from './story.js';
import { Sound, renderTrack } from './sound.js';
import { pixelBox, labelSize } from './pixels.js';

const THEMES = Object.fromEntries(Object.entries(BRAND).map(([k, t]) => [k, { bg: unit(t.bg), fg: unit(t.fg) }]));
const $ = (id) => document.getElementById(id);
const player = $('player'), canvas = $('stage');
const ui = {
  bar: $('bar'), play: $('play'), sound: $('sound'), full: $('full'), now: $('now'), of: $('of'), home: $('home'),
  scrub: $('scrub'), done: $('done'), knob: $('knob'), marks: $('marks'), tip: $('tip'), said: $('said'), start: $('start'),
};
const START = labelSize('PLAY'); // the PLAY button under the title, on landing

let renderer;
try {
  renderer = new Renderer(canvas);
} catch {
  $('nogl').hidden = false;
  canvas.hidden = true;
  ui.bar.hidden = true;
  ui.home.hidden = true;
  throw new Error('The story needs WebGL2.');
}

const sound = new Sound();
const PULSE_LIFE = 1.6;
const trail = { pos: new Float32Array(TRAIL * 4), meta: new Float32Array(TRAIL * 2), n: 0, box: [0, 0, 0, 0] };
const pulseData = { data: new Float32Array(PULSES * 4), n: 0 };
let engine, clock = 0, next = 0, playing = false, started = false, last = 0, recorder = null;
let pulses = [], current = 'light', theme = null, said = null, shown = null;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------- the stage

const MAX_PIXELS = 3840 * 2160; // past this, draw smaller and let the screen scale it up
const REC = { x: 0, y: 0, w: W, h: H, tall: false, cap: 3, s: 1 }; // recording: just the frame
let view = null, recording = false, resized = false;

/** Where the frame goes on the stage as it is now, and how big the words are. */
function fit() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight, room = Math.max(1, ch - ui.bar.offsetHeight);
  const tall = cw / room < 1.2, fh = tall ? H + STRIP : H;
  const s = Math.min(cw / W, room / fh); // CSS px per story px
  const snap = (v) => Math.round(v / 16) * 16;
  return {
    // A tall picture sits a little above the middle, where the eye expects it.
    x: snap((cw / s - W) / 2), y: snap((room / s - fh) * (tall ? 0.4 : 0.5)), w: cw / s, h: ch / s, tall, s,
    // The words at least ~11 CSS px tall along the bottom, ~15 under a tall picture.
    cap: tall ? clamp(Math.round(15 / (7 * s)), 4, 9) : clamp(Math.ceil(11 / (7 * s)), 3, 5),
  };
}

/** Size the canvas to the screen's pixels and, if the stage changed shape, rebuild the scene to fit. */
function layout() {
  const v = recording ? REC : fit();
  if (recording) renderer.resize(W, H, 1.5); // 1920 × 1080
  else {
    const dpr = window.devicePixelRatio || 1, px = canvas.clientWidth * canvas.clientHeight * dpr * dpr;
    renderer.resize(v.w, v.h, v.s * dpr * Math.min(1, Math.sqrt(MAX_PIXELS / px)));
  }
  const moved = !view || view.x !== v.x || view.y !== v.y || view.tall !== v.tall || view.cap !== v.cap
    || Math.abs(view.w - v.w) > 1 || Math.abs(view.h - v.h) > 1;
  view = v;
  setView(v);
  if (moved && engine) replay(clock);
  // PLAY sits under the title card's "A SHORT STORY IN BLOCKS", wherever that is.
  ui.start.style.left = `${Math.round((v.x + W / 2) * v.s - START.w / 2)}px`;
  ui.start.style.top = `${Math.round((v.y + SUB_Y + 7 * v.cap) * v.s + 28)}px`;
}
const onResize = () => { resized = true; };
const watch = new ResizeObserver(onResize);
watch.observe(canvas);
watch.observe(ui.bar);
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------- the clock

function reset() {
  clock = 0; next = 0; pulses = []; current = 'light'; said = null;
  theme = { from: THEMES.light, to: THEMES.light, start: -10, origin: [0, 0] };
  engine = new Engine(renderer);
  engine.now = () => clock;
  engine.vw = view.w; engine.vh = view.h; engine.gridX = 0;
  engine.morphTo({ elements: [] });
}

const onStage = (p) => [p[0] + view.x, p[1] + view.y];
// For screen readers: the line being said, in ordinary case.
const sentence = (s) => s.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());

/** One cue, at its own time (not the frame's), so timing never drifts. Sound only when playing for real. */
function run(cue, live) {
  if (cue.theme) {
    theme = { from: THEMES[current], to: THEMES[cue.theme.to], start: clock, origin: onStage(cue.theme.at) };
    current = cue.theme.to;
  }
  if (cue.scene) {
    const els = cue.scene();
    engine.morphTo({ elements: els }, { mode: cue.mode || 'local', origin: cue.origin && onStage(cue.origin), scrollFrom: 0, scrollTo: 0 });
    // A new line is said as it forms; the very first one waits for the page to assemble.
    const cap = els.find((e) => e.key === 'cap');
    if (live && cap && cap.say !== said) {
      if (sound.ready) sound.speak(cap.say, cap.voice.name, sound.ctx.currentTime + (said ? 0.12 : 0.7), cap.voice.base);
      ui.said.textContent = sentence(cap.say);
    }
    said = cap ? cap.say : null;
  }
  for (const p of cue.light || []) { const [x, y] = onStage(p); pulses.push({ x, y, t: clock, s: 1 }); }
  if (live) for (const s of cue.sound || []) { const [name, arg] = [].concat(s); sound.play(name, arg); }
}

function advance(to, live = false) {
  while (next < CUES.length && CUES[next].t <= to) {
    clock = CUES[next].t;
    run(CUES[next++], live);
  }
  clock = to;
  engine.tick(clock);
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

function draw() {
  pulses = pulses.filter((p) => clock - p.t < PULSE_LIFE);
  const live = pulses.slice(-PULSES);
  live.forEach((p, i) => pulseData.data.set([p.x, p.y, p.t, p.s], i * 4));
  pulseData.n = live.length;
  const tt = (clock - theme.start) / 0.9;
  renderer.draw({
    time: clock, scroll: 0, shrink: SHRINK, navClip: 0,
    themeA: theme.from, themeB: theme.to, themeT: tt >= 1 ? 2 : Math.max(0, tt), themeOrigin: theme.origin,
    gridOrigin: [0, 0], gridStep: 16, mouse: [-1e4, -1e4], dotAlpha: 0.075,
    trail, pushR: 130, pushGain: 0.45, pulses: pulseData, pulseSpeed: 1100, pulseWidth: 150,
  });
  // The controls (and the logo) follow the story from day into night and back.
  if (current !== shown) {
    shown = current;
    player.style.setProperty('--paper', BRAND[current].bg);
    player.style.setProperty('--ink', BRAND[current].fg);
    for (const b of Object.values(boxes)) b.theme(THEMES[current]);
  }
  for (const b of Object.values(boxes)) b.draw();
}

// ---------------------------------------------------------------- controls

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
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
  if (recorder) return;
  seek(t);
  started = true;
  ambience();
}
const toggle = () => { if (recorder) return; if (playing) pause(); else play(); };
const fromTop = () => { if (recorder) return; seek(0); play(); };

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
  if (recorder || e.button > 0) return;
  ui.scrub.setPointerCapture(e.pointerId);
  drag = { was: playing };
  if (playing) pause();
  want = timeAt(e);
  tip(want);
  ui.scrub.classList.add('drag');
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
  ui.scrub.classList.remove('drag');
  ui.tip.hidden = true;
  if (drag.was) play();
  drag = null;
}
ui.scrub.addEventListener('pointerup', drop);
ui.scrub.addEventListener('pointercancel', drop);
ui.scrub.addEventListener('pointerleave', () => { if (!drag) ui.tip.hidden = true; });

// Fullscreen, where the browser allows it (not iPhones: there, turn the phone sideways).
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
ui.full.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function fullscreen() {
  if (ui.full.hidden) return;
  const r = fsElement()
    ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    : (player.requestFullscreen || player.webkitRequestFullscreen).call(player);
  r?.catch?.(() => {});
}

ui.play.addEventListener('click', toggle);
ui.sound.addEventListener('click', () => { sound.unlock(); sound.setOn(!sound.on); });
ui.full.addEventListener('click', fullscreen);
ui.start.addEventListener('click', play);

// The logo and the buttons, in blocks (pixels.js). The logo shifts when you
// point at it, as on the home page; the buttons fill in, like its nav and its
// buttons. On landing, PLAY waits under the title; once the story's going it
// breaks up into nothing.
Object.assign(ui.start.style, { width: `${START.w}px`, height: `${START.h}px` });
const boxes = {
  logo: pixelBox($('logo'), 44, 36),
  play: pixelBox(ui.play.querySelector('canvas'), 36, 36),
  sound: pixelBox(ui.sound.querySelector('canvas'), 44, 36),
  full: pixelBox(ui.full.querySelector('canvas'), 36, 36),
  start: pixelBox(ui.start.querySelector('canvas'), START.w, START.h),
};
boxes.logo.show('logo', { period: 2.2, phase: 1.6 });
boxes.start.show('PLAY', { text: true });
ui.home.addEventListener('pointerenter', () => boxes.logo.nudge());
ui.home.addEventListener('focus', () => boxes.logo.nudge());
for (const k of ['play', 'sound', 'full', 'start']) {
  const b = ui[k];
  b.addEventListener('pointerenter', () => boxes[k].hover(true));
  b.addEventListener('pointerleave', () => boxes[k].hover(b.matches(':focus-visible')));
  b.addEventListener('focus', () => boxes[k].hover(b.matches(':focus-visible')));
  b.addEventListener('blur', () => boxes[k].hover(false));
}

// While it plays, the controls fade after a moment of stillness; any touch,
// move or key brings them back. (Clicking the picture itself doesn't play or
// pause; a double click goes fullscreen.)
let idleAt = 0;
const poke = () => { idleAt = performance.now() + 2600; player.classList.remove('idle'); };
player.addEventListener('pointerdown', poke, true);
player.addEventListener('pointermove', poke);
player.addEventListener('focusin', poke);
canvas.addEventListener('dblclick', fullscreen);
function idle() {
  const still = playing && !view.tall && !drag && performance.now() > idleAt && !ui.bar.matches(':hover');
  player.classList.toggle('idle', still);
}

const KEYS = {
  ' ': toggle, k: toggle, f: fullscreen, m: () => ui.sound.click(), r: fromTop,
  ArrowLeft: (e) => (e.shiftKey ? chapter(-1) : jump(clock - 5)),
  ArrowRight: (e) => (e.shiftKey ? chapter(1) : jump(clock + 5)),
  j: () => jump(clock - 10), l: () => jump(clock + 10),
  PageUp: () => chapter(-1), PageDown: () => chapter(1),
  Home: () => jump(0), End: () => jump(LENGTH),
};
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ((k === ' ' || k === 'Enter') && e.target.closest?.('button, a')) return; // the button's own
  const go = KEYS[k] || (/^[0-9]$/.test(k) ? () => jump((LENGTH * Number(k)) / 10) : null);
  if (!go) return;
  e.preventDefault();
  go(e);
  poke();
});

const put = (el, k, v) => { if (el[k] !== v) el[k] = v; };
const attr = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
// Each button's icon, its name for screen readers, and a tooltip with its key.
const SAYS = {
  play: ['Play', 'Play (space)'], pause: ['Pause', 'Pause (space)'], again: ['Play again', 'Play again (space)'],
  full: ['Fullscreen', 'Fullscreen (F)'], window: ['Exit fullscreen', 'Exit fullscreen (F)'],
};
function button(b, box, name, o) {
  box.show(name, o);
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
  button(ui.full, boxes.full, fsElement() ? 'window' : 'full');
  put(ui.now, 'textContent', mmss(t));
  ui.done.style.width = pct;
  ui.knob.style.left = pct;
  if (Math.floor(t) !== second) {
    second = Math.floor(t);
    ui.scrub.setAttribute('aria-valuenow', String(second));
    ui.scrub.setAttribute('aria-valuetext', `${mmss(t)}, ${chapterAt(t).name.toLowerCase()}`);
  }
}

// Recording, from the console (__story.record()): from the top, just the
// frame, at 1920 × 1080, with the sound, as MP4 where the browser can. The
// file saves when the story ends.
function record() {
  if (recorder || !window.MediaRecorder) return;
  sound.unlock();
  const type = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  recording = true;
  player.classList.add('recording');
  layout();
  const tracks = [...canvas.captureStream(60).getVideoTracks(), ...(sound.ctx ? sound.stream().getAudioTracks() : [])];
  const chunks = [];
  recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: type, videoBitsPerSecond: 16e6 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type }));
    a.download = `the-adventurer.${type.includes('mp4') ? 'mp4' : 'webm'}`;
    a.click();
    recorder = null;
    recording = false;
    player.classList.remove('recording');
    layout();
  };
  seek(0);
  play();
  recorder.start(250);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (resized) { resized = false; layout(); }
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
  last = now;
  if (want !== null) { seek(want); started = true; want = null; }
  if (playing) {
    advance(clock + dt, true);
    if (clock >= LENGTH) {
      playing = false;
      recorder?.stop();
    }
  }
  draw();
  idle();
  refresh();
}

// Until someone presses play (browsers keep sound off until then), the
// title card holds, already assembled, just before its light: PLAY sets that
// off, chime and all, and the story carries on from there. ?t=seconds opens
// on that moment instead.
layout();
const at = Number(new URLSearchParams(location.search).get('t'));
seek(at || 2.2); // the light comes at 2.3
started = !!at;
if (started) ui.start.hidden = true;
refresh(); // the buttons' icons, before the first frame
requestAnimationFrame(frame);

// For poking at it: __story.seek(42); __story.draw(); await __story.levels()
// (__story.frame(ms) runs one frame by hand, where the page isn't being drawn;
// __story.record() makes a video.)
window.__story = {
  seek, jump, draw, layout, frame, record, CUES, CHAPTERS, sound, play, pause,
  get clock() { return clock; }, get view() { return view; },
  levels: () => renderTrack(CUES, LENGTH),
};
