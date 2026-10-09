// The story's sound, all synthesised in the browser (no audio files), in the
// spirit of the blocks: small sine, triangle and square tones, clicks and
// filtered noise. The seven colours are a pentatonic scale, red to violet, so
// the light, the worlds and the gems all play their colour's note.
export const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66]; // C D E G A C D
const VOL = 0.75;

/**
 * The captions' voices: every letter blips as it forms, like dialogue in old
 * games. rate: seconds a character. pitch: times the line's key (C, or a
 * world's colour). contour: how far the pitch climbs (or falls) by the end.
 */
export const VOICES = {
  narrator: { rate: 0.045, pitch: 1, wave: 'square', lp: 2400, gain: 0.032, dur: 0.055 },
  hero: { rate: 0.05, pitch: 1.5, wave: 'triangle', gain: 0.06, dur: 0.06, contour: 0.15 },
  cheer: { rate: 0.065, pitch: 1.25, wave: 'square', lp: 3200, gain: 0.036, dur: 0.075, contour: 0.45 },
  dm: { rate: 0.06, pitch: 0.5, wave: 'square', lp: 1300, gain: 0.045, dur: 0.07, vib: 0.02 },
  sad: { rate: 0.1, pitch: 0.75, wave: 'triangle', gain: 0.07, dur: 0.12, contour: -0.45 },
  dragon: { rate: 0.066, pitch: 0.25, wave: 'sawtooth', lp: 650, gain: 0.06, dur: 0.09, vib: 0.05 },
};
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
/** A letter's note: always the same for the same letter, drifting a little along the line. */
function letterPitch(ch, i, n, base, v) {
  const deg = (ch.charCodeAt(0) * 7 + Math.floor(i / 4)) % 5;
  return base * PENTA[deg] * (/[0-9]/.test(ch) ? 2 : 1) * (1 + (v.contour || 0) * (i / Math.max(1, n - 1)));
}

const rnd = (a, b) => a + Math.random() * (b - a);

function noiseBuffer(c) {
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// A small room for the sounds to ring in: decaying noise.
function impulse(c, secs) {
  const n = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  }
  return b;
}

export class Sound {
  /** Pass an OfflineAudioContext to render instead of play. */
  constructor(ctx = null) {
    this.ctx = ctx;
    this.on = true;
    this.live = new Set();
    this.pad = null;
    if (ctx) this.build();
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.on ? VOL : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.out = comp;
    this.verb = c.createConvolver();
    this.verb.buffer = impulse(c, 2.6);
    this.send = c.createGain();
    this.send.gain.value = 0.8;
    this.send.connect(this.verb);
    this.verb.connect(this.master);
    this.noise = noiseBuffer(c);
  }

  /** Browsers only make sound after a click or key press: call this from one. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state !== 'running') this.ctx.resume?.();
  }

  get ready() { return !!this.ctx && (this.ctx.state === 'running' || typeof this.ctx.startRendering === 'function'); }
  pause() { if (this.ctx?.state === 'running' && this.ctx.suspend) this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setOn(on) {
    this.on = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? VOL : 0, this.ctx.currentTime, 0.04);
  }

  /** The mix as a stream, for recording. */
  stream() {
    if (!this.dest) { this.dest = this.ctx.createMediaStreamDestination(); this.out.connect(this.dest); }
    return this.dest.stream;
  }

  stopAll() {
    for (const n of this.live) { try { n.stop(); } catch { /* already stopped */ } }
    this.live.clear();
    this.pad = null;
  }

  /** Play an effect now, or at `at` seconds (offline rendering). */
  play(name, arg, at = null) {
    if (!this.ready || !EFFECTS[name]) return;
    EFFECTS[name](this, at ?? this.ctx.currentTime + 0.02, arg);
  }

  /** Say a caption: a blip a letter, in the voice's register, in key `base` (a frequency). */
  speak(text, voice = 'narrator', at = null, base = NOTES[0]) {
    if (!this.ready) return;
    const v = VOICES[voice] || VOICES.narrator;
    const t0 = at ?? this.ctx.currentTime + 0.02, n = text.length;
    let pause = 0;
    [...text].forEach((ch, i) => {
      if (/[A-Z0-9]/i.test(ch)) {
        this.tone(letterPitch(ch.toUpperCase(), i, n, base * v.pitch, v), t0 + i * v.rate + pause, v.dur, {
          type: v.wave, gain: v.gain, a: 0.003, r: v.dur * 0.6, rev: 0.15, lp: v.lp || 0, vib: v.vib || 0,
        });
      }
      if ((ch === '.' || ch === ',') && i < n - 1) pause += ch === ',' ? 0.06 : 0.12;
    });
  }

  // ---------------------------------------------------------------- voices

  track(node, end) {
    node.stop(end);
    this.live.add(node);
    node.onended = () => this.live.delete(node);
  }

  /** An envelope: in over `a`, held, out over `r`, `d` long in all. */
  env(t, d, peak, a = 0.005, r = 0.12) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, d - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    return g;
  }

  route(node, rev) {
    node.connect(this.master);
    if (rev) {
      const s = this.ctx.createGain();
      s.gain.value = rev;
      node.connect(s);
      s.connect(this.send);
    }
  }

  tone(f, t, d, { type = 'triangle', gain = 0.1, a = 0.005, r = 0.12, to = null, rev = 0.25, vib = 0, lp = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 6.5; lg.gain.value = f * vib;
      l.connect(lg); lg.connect(o.frequency);
      l.start(t); this.track(l, t + d + 0.05);
    }
    const g = this.env(t, d, gain, a, r);
    let last = o;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); last = fl; }
    last.connect(g);
    this.route(g, rev);
    o.start(t);
    this.track(o, t + d + 0.05);
  }

  hiss(t, d, { type = 'bandpass', f = 2000, q = 1, gain = 0.1, a = 0.002, r = 0.05, to = null, rev = 0.2 } = {}) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = this.env(t, d, gain, a, r);
    src.connect(fl); fl.connect(g);
    this.route(g, rev);
    src.start(t, rnd(0, 1.5));
    this.track(src, t + d + 0.05);
  }

  click(t, f = 3000, gain = 0.08) { this.hiss(t, 0.014, { f, q: 3, gain, a: 0.001, r: 0.01, rev: 0.12 }); }

  /** The night's drone: a low fifth and a little wind. */
  ambient(on, t) {
    const c = this.ctx;
    if (on && !this.pad) {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 3);
      this.route(g, 0.5);
      const nodes = [];
      for (const [f, v] of [[110, 1], [164.81, 0.6], [220.4, 0.25]]) {
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sine'; o.frequency.value = f; og.gain.value = v;
        o.connect(og); og.connect(g); o.start(t); nodes.push(o);
      }
      const src = c.createBufferSource(), fl = c.createBiquadFilter(), ng = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      src.buffer = this.noise; src.loop = true;
      fl.type = 'lowpass'; fl.frequency.value = 260; ng.gain.value = 0.6;
      lfo.frequency.value = 0.08; lg.gain.value = 160;
      lfo.connect(lg); lg.connect(fl.frequency);
      src.connect(fl); fl.connect(ng); ng.connect(g);
      src.start(t); lfo.start(t); nodes.push(src, lfo);
      for (const n of nodes) this.live.add(n);
      this.pad = { g, nodes };
    } else if (!on && this.pad) {
      // Fade from wherever it is (gain.value can't be trusted here: it isn't
      // updated until the context next renders, which offline, or right after
      // a jump into the night, means a burst at full gain).
      const { g, nodes } = this.pad;
      if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(t);
      else g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0.0001, t, 0.6);
      for (const n of nodes) { n.stop(t + 3); n.onended = () => this.live.delete(n); }
      this.pad = null;
    }
  }
}

// ---------------------------------------------------------------- effects

const EFFECTS = {
  /** Blocks landing: a scatter of clicks that settles, then a soft thump. */
  assemble(s, t, { n = 34, spread = 1.15 } = {}) {
    for (let i = 0; i < n; i++) s.click(t + spread * Math.pow(i / n, 0.8) + rnd(0, 0.04), rnd(1800, 5200), 0.03 + 0.07 * (1 - i / n));
    s.tone(140, t + spread, 0.3, { type: 'sine', gain: 0.22, to: 60, rev: 0.1 });
  },
  /** A scene cut: the page morph's shuffle of squares. */
  shuffle(s, t) {
    s.hiss(t, 0.9, { type: 'lowpass', f: 300, to: 2400, gain: 0.05, a: 0.25, r: 0.4, rev: 0.3 });
    EFFECTS.assemble(s, t + 0.15, { n: 22, spread: 0.85 });
  },
  /** The click light: one run up through the seven colours. */
  light(s, t) {
    NOTES.forEach((f, i) => {
      s.tone(f, t + i * 0.045, 1.1, { type: 'sine', gain: 0.06, rev: 0.7, r: 0.9 });
      s.tone(f * 2, t + i * 0.045, 0.5, { type: 'triangle', gain: 0.015, rev: 0.7, r: 0.4 });
    });
  },
  twinkle(s, t) {
    [6, 4, 6, 5].forEach((k, i) => s.tone(NOTES[k] * 2, t + i * 0.11, 0.35, { type: 'sine', gain: 0.035, rev: 0.8, r: 0.3 }));
  },
  caption(s, t) { s.tone(1760, t, 0.04, { type: 'sine', gain: 0.025, rev: 0.2, r: 0.03 }); },
  /** A footstep: soft, and each foot a little different. */
  step(s, t, i = 0) {
    s.tone(i % 2 ? 150 : 124, t, 0.08, { type: 'sine', gain: 0.08, to: 64, r: 0.06, rev: 0.05 });
    s.click(t, i % 2 ? 1500 : 1150, 0.018);
  },
  /** A shooting star: a high note falling away, and a breath of air. */
  meteor(s, t) {
    s.tone(2600, t + 0.1, 0.6, { type: 'sine', gain: 0.022, to: 1250, r: 0.45, rev: 0.7 });
    s.hiss(t + 0.1, 0.55, { f: 5200, to: 1800, q: 2.5, gain: 0.018, a: 0.12, r: 0.35, rev: 0.6 });
  },
  /** Something big going by: a rush of air, up and away. */
  whoosh(s, t) {
    s.hiss(t, 0.75, { f: 320, to: 2600, q: 0.7, gain: 0.07, a: 0.3, r: 0.35, rev: 0.45 });
  },
  /** A die tumbling on stone. */
  roll(s, t, d = 2.4) {
    let u = 0;
    while (u < d) {
      const k = u / d;
      s.click(t + u, rnd(1200, 3400), 0.05 + 0.06 * (1 - k));
      if (Math.random() < 0.45) s.tone(rnd(700, 1300), t + u, 0.05, { type: 'triangle', gain: 0.05, r: 0.04, rev: 0.1 });
      u += rnd(0.05, 0.12) * (1 + k * 1.6);
    }
  },
  land(s, t) {
    s.tone(1100, t, 0.06, { type: 'triangle', gain: 0.09, r: 0.05, rev: 0.15 });
    s.tone(170, t, 0.22, { type: 'sine', gain: 0.2, to: 80, rev: 0.1 });
  },
  nat20(s, t) {
    [0, 2, 3, 5].forEach((k, i) => s.tone(NOTES[k], t + 0.1 + i * 0.11, 0.55, { type: 'square', gain: 0.045, lp: 3200, rev: 0.4, r: 0.4 }));
    [0, 2, 3].forEach((k) => s.tone(NOTES[k] / 2, t + 0.55, 1.4, { type: 'triangle', gain: 0.05, a: 0.02, rev: 0.6, r: 1 }));
  },
  /** A natural 1: a slide down, a little sad, a little funny. */
  nat1(s, t) {
    [392, 370, 349.2].forEach((f, i) => s.tone(f, t + 0.12 + i * 0.32, 0.3, { type: 'triangle', gain: 0.09, lp: 1800, rev: 0.3 }));
    s.tone(329.6, t + 1.08, 0.9, { type: 'triangle', gain: 0.09, lp: 1800, vib: 0.02, to: 300, rev: 0.4, r: 0.5 });
  },
  /** The transporter: noise that climbs and shimmers, and bright tones on top. */
  energise(s, t) {
    s.hiss(t, 1.7, { f: 700, to: 7000, q: 4, gain: 0.07, a: 0.3, r: 0.5, rev: 0.6 });
    for (let i = 0; i < 7; i++) {
      const f = NOTES[i] * 2;
      s.tone(f, t + i * 0.08, 1.4, { type: 'sine', gain: 0.022, to: f * 1.12, vib: 0.012, a: 0.25, r: 0.6, rev: 0.8 });
    }
  },
  /** Warp: a rising rumble, a rush of air, a jump. */
  engage(s, t) {
    s.tone(48, t, 2, { type: 'sawtooth', gain: 0.12, to: 96, lp: 220, a: 0.4, r: 0.8, rev: 0.2 });
    s.hiss(t + 0.2, 1.3, { type: 'lowpass', f: 250, to: 7000, gain: 0.11, a: 0.5, r: 0.6, rev: 0.4 });
    s.tone(90, t + 0.75, 0.8, { type: 'sine', gain: 0.32, to: 32, rev: 0.25 });
  },
  /** Arriving at a world: a slow chord on its colour's note. */
  arrive(s, t, k) {
    const f = NOTES[k] / 4;
    [[f, 1], [f * 1.5, 0.7], [f * 2, 0.5]].forEach(([g, v]) => s.tone(g, t + 0.2, 2.6, { type: 'sine', gain: 0.06 * v, a: 0.7, r: 1.4, rev: 0.6 }));
  },
  /** A colour collected: its note, then an octave up. */
  collect(s, t, k) {
    s.tone(NOTES[k], t, 0.08, { type: 'square', gain: 0.05, lp: 4000, rev: 0.3 });
    s.tone(NOTES[k] * 2, t + 0.08, 0.45, { type: 'square', gain: 0.045, lp: 4000, rev: 0.5, r: 0.35 });
    s.tone(NOTES[k] * 3, t + 0.08, 0.6, { type: 'sine', gain: 0.02, rev: 0.8, r: 0.5 });
  },
  growl(s, t) {
    s.tone(62, t, 1.5, { type: 'sawtooth', gain: 0.16, vib: 0.12, lp: 480, a: 0.15, r: 0.6, rev: 0.3 });
    s.hiss(t, 1.4, { type: 'lowpass', f: 380, gain: 0.12, a: 0.2, r: 0.6, rev: 0.3 });
  },
  calm(s, t) {
    [220, 277.2, 329.6, 440].forEach((f, i) => s.tone(f, t + i * 0.05, 3, { type: 'sine', gain: 0.035, a: 0.9, r: 1.6, rev: 0.7 }));
  },
  sit(s, t) { s.hiss(t, 0.2, { type: 'lowpass', f: 500, gain: 0.16, r: 0.15, rev: 0.1 }); },
  /** Dawn: a wide, slow chord, and the colours one by one. */
  dawn(s, t) {
    [261.6, 329.6, 392, 493.9].forEach((f, i) => s.tone(f, t, 4, { type: 'sine', gain: 0.04, a: 1.6 + i * 0.2, r: 1.8, rev: 0.7 }));
    NOTES.forEach((f, i) => s.tone(f, t + 1 + i * 0.14, 1.2, { type: 'triangle', gain: 0.035, rev: 0.7, r: 0.9 }));
  },
  bloom(s, t, n = 16) {
    for (let i = 0; i < n; i++) s.tone(NOTES[i % 7], t + 0.1 + i * 0.07, 0.16, { type: 'sine', gain: 0.045, to: NOTES[i % 7] * 1.5, rev: 0.5 });
  },
  end(s, t) {
    [130.8, 196, 261.6, 329.6].forEach((f) => s.tone(f, t + 0.6, 4.5, { type: 'sine', gain: 0.045, a: 1.2, r: 2.5, rev: 0.8 }));
    s.tone(1046.5, t + 0.9, 2.5, { type: 'sine', gain: 0.03, rev: 0.9, r: 2 });
  },
  night(s, t) { s.ambient(true, t); },
  morning(s, t) { s.ambient(false, t); },
};

/** Render every cue's sound offline: per second, the loudest sample and the average level. */
export async function renderTrack(cues, length, rate = 22050) {
  const ctx = new OfflineAudioContext(2, Math.ceil(length * rate), rate);
  const s = new Sound(ctx);
  let said = null;
  for (const c of cues) {
    for (const x of c.sound || []) { const [name, arg] = [].concat(x); s.play(name, arg, c.t); }
    const cap = c.scene?.().find((e) => e.key === 'cap');
    if (cap && cap.say !== said) s.speak(cap.say, cap.voice.name, c.t + (said ? 0.12 : 0.7), cap.voice.base);
    said = cap ? cap.say : null;
  }
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0), out = [];
  for (let sec = 0; sec < length; sec++) {
    let peak = 0, sum = 0;
    for (let i = sec * rate; i < Math.min(d.length, (sec + 1) * rate); i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
    out.push({ sec, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / rate).toFixed(4) });
  }
  return out;
}
