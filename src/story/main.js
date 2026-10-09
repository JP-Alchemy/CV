// Plays the story (story.js) with the site's own renderer and morph engine,
// on a fixed 1280 × 720 stage, with its sound (sound.js). The engine runs on
// the player's clock, so the story can pause, jump to any moment (?t=seconds)
// and record itself to video, sound and all.
import { Renderer, TRAIL, PULSES } from '../engine/renderer.js';
import { Engine, SHRINK } from '../engine/engine.js';
import { THEMES as BRAND, unit } from '../brand.js';
import { CUES, LENGTH, NIGHT, W, H } from './story.js';
import { Sound, renderTrack } from './sound.js';

const THEMES = Object.fromEntries(Object.entries(BRAND).map(([k, t]) => [k, { bg: unit(t.bg), fg: unit(t.fg) }]));
const canvas = document.getElementById('stage');
const ui = {
  play: document.getElementById('play'),
  top: document.getElementById('top'),
  sound: document.getElementById('sound'),
  rec: document.getElementById('rec'),
  time: document.getElementById('time'),
};

let renderer;
try {
  renderer = new Renderer(canvas);
} catch {
  document.getElementById('nogl').hidden = false;
  canvas.hidden = true;
  document.getElementById('bar').hidden = true;
  throw new Error('The story needs WebGL2.');
}
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
renderer.resize(W, H, dpr());

const sound = new Sound();
const PULSE_LIFE = 1.6;
const trail = { pos: new Float32Array(TRAIL * 4), meta: new Float32Array(TRAIL * 2), n: 0, box: [0, 0, 0, 0] };
const pulseData = { data: new Float32Array(PULSES * 4), n: 0 };
let engine, clock = 0, next = 0, playing = false, started = false, last = 0, recorder = null;
let pulses = [], current = 'light', theme = null;

function reset() {
  clock = 0; next = 0; pulses = []; current = 'light';
  theme = { from: THEMES.light, to: THEMES.light, start: -10, origin: [0, 0] };
  engine = new Engine(renderer);
  engine.now = () => clock;
  engine.vw = W; engine.vh = H; engine.gridX = 0;
  engine.morphTo({ elements: [] });
}

/** One cue, at its own time (not the frame's), so timing never drifts. Sound only when playing for real. */
function run(cue, live) {
  if (cue.theme) {
    theme = { from: THEMES[current], to: THEMES[cue.theme.to], start: clock, origin: cue.theme.at };
    current = cue.theme.to;
  }
  if (cue.scene) engine.morphTo({ elements: cue.scene() }, { mode: cue.mode || 'local', origin: cue.origin, scrollFrom: 0, scrollTo: 0 });
  for (const [x, y] of cue.light || []) pulses.push({ x, y, t: clock, s: 1 });
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

/** Jump to t: replay every cue up to it, quickly and silently. */
function seek(t) {
  sound.stopAll();
  reset();
  for (let s = 0; s < t; s += 1 / 30) advance(s);
  advance(t);
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
}

// ---------------------------------------------------------------- controls

function play() {
  sound.unlock();
  if (!started || clock >= LENGTH) { seek(0); started = true; }
  sound.resume();
  if (clock > NIGHT[0] && clock < NIGHT[1]) sound.play('night'); // after a jump into the night
  playing = true;
}
function pause() {
  playing = false;
  sound.pause();
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function refresh() {
  ui.play.textContent = playing ? 'PAUSE' : started && clock >= LENGTH ? 'AGAIN' : 'PLAY';
  ui.sound.textContent = sound.on ? 'SOUND ON' : 'SOUND OFF';
  ui.sound.setAttribute('aria-pressed', String(sound.on));
  ui.rec.textContent = recorder ? 'RECORDING…' : 'RECORD VIDEO';
  ui.time.textContent = `${mmss(Math.min(clock, LENGTH))} / ${mmss(LENGTH)}`;
}

const toggle = () => { if (recorder) return; if (playing) pause(); else play(); refresh(); };
ui.play.addEventListener('click', toggle);
ui.top.addEventListener('click', () => { if (recorder) return; started = false; play(); refresh(); });
ui.sound.addEventListener('click', () => { sound.unlock(); sound.setOn(!sound.on); refresh(); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('button')) return;
  if (e.key === ' ') { e.preventDefault(); toggle(); }
  if (e.key === 'r' || e.key === 'R') ui.top.click();
  if (e.key === 'm' || e.key === 'M') ui.sound.click();
});

// Recording: from the top, at 1920 × 1080, with the sound, as MP4 where the browser can.
ui.rec.addEventListener('click', () => {
  if (recorder || !window.MediaRecorder) return;
  sound.unlock();
  const type = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  renderer.resize(W, H, 1.5);
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
    renderer.resize(W, H, dpr());
    refresh();
  };
  started = false;
  play();
  recorder.start(250);
  refresh();
});

function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
  last = now;
  if (playing) {
    advance(clock + dt, true);
    if (clock >= LENGTH) {
      playing = false;
      recorder?.stop();
    }
  }
  draw();
  refresh();
}

// Until someone presses play (browsers keep sound off until then), the
// title card holds, already assembled. ?t=seconds opens on that moment.
const at = Number(new URLSearchParams(location.search).get('t'));
seek(at || 4.2); // the title, assembled, after its light has gone by
started = !!at;
requestAnimationFrame(frame);

// For poking at it: __story.seek(42); __story.draw(); await __story.levels()
window.__story = {
  seek, draw, CUES, sound, get clock() { return clock; }, play, pause,
  levels: () => renderTrack(CUES, LENGTH),
};
