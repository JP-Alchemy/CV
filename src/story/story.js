// The Adventurer: a short story in blocks. An ink-and-paper world, a d20, a
// small ship, seven unknown worlds, a dragon, and the colours coming home.
// Each cue rebuilds the whole scene; the engine morphs from whatever is on
// screen. Scene cuts use the site's page morph (the blocks pixelate, tumble
// and resolve: a transporter, more or less); captions share one key, so each
// line morphs letter by letter into the next.
//
// Every screen shape: each scene is laid out twice, in a wide 1280 × 720
// frame (a landscape screen) and in the 720 × 720 square in its middle (what
// landscape and portrait screens have in common). Every piece has a place in
// both and slides between them with how wide the stage is (view.k), so the
// action always fits, and spreads out when there's room. Around it the stars
// and the ground carry on to the stage's edges; on a tall stage the words go
// under the square, bigger, like subtitles. The player (player.js) works out
// the view; everything here is in story px, which el() turns into screen px.
import { typeset, measure } from '../engine/typeset.js';
import { imageBlocks } from '../engine/images.js';
import { iconFrames } from '../icons.js';
import { frameBlocks, fillBlocks } from '../ui.js';
import { ADVENTURER, SHIP, DRAGON, d20, blocks, frames } from './art.js';
import { VOICES, NOTES } from './sound.js';

export const W = 1280, H = 720, SQ = 720;
/** Room under the square for the words, on a tall stage. */
export const STRIP = 160;
const GROUND = 560, CELL = 6;

// What the stage shows. s: screen px per story px. ox, oy: the stage's corner
// on screen. x, y: the wide frame's corner, from the stage's (story px).
// w, h: how much of the story the stage shows. k: how wide that is (0 just
// the square, 1 the whole wide frame). tall: the words go under the square.
// cap: the words' size.
const view = { s: 1, ox: 0, oy: 0, x: 0, y: 0, w: W, h: H, k: 1, tall: false, cap: 3 };
export const setView = (v) => Object.assign(view, v);

/** A place between the square's (q) and the wide frame's (w), for how wide the stage is. */
const at = (w, q) => Math.round(q + (w - q) * view.k);
/** The same for a point or a world ([x, y, r]), as a function: worked out when the scene is. */
const P = (w, q) => () => w.map((v, i) => at(v, q[i]));
// Just past the stage's left and right edges, for something w wide.
const offLeft = (w) => -view.x - w - 40;
const offRight = () => view.w - view.x + 40;

const fract = (v) => v - Math.floor(v);
const hash = (a, b = 0) => fract(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);

/** Blocks in story px, placed at (X, Y) on screen, in screen px. */
function onScreen(b, X, Y) {
  const s = view.s, out = new Float32Array(b.length);
  for (let i = 0; i < b.length; i += 5) {
    out[i] = X + b[i] * s; out[i + 1] = Y + b[i + 1] * s; out[i + 2] = b[i + 2] * s; out[i + 3] = b[i + 3] * s; out[i + 4] = b[i + 4];
  }
  return out;
}

/**
 * An element the engine understands, from blocks relative to (x, y) in the
 * wide frame. Its sig carries the scale, so when the stage changes size the
 * pieces re-form at the new one (and just slide when only the width did).
 */
function el(key, x, y, b, o = {}) {
  const X = view.ox + (x + view.x) * view.s, Y = view.oy + (y + view.y) * view.s;
  return {
    key, sig: `${o.sig ?? key}@${view.s.toFixed(4)}`, x: X, y: Y, w: 0, h: 0, blocks: onScreen(b, X, Y), z: o.z ?? 0, flat: !!o.flat,
    motion: o.motion, match: o.match, fixed: false, n: b.length / 5,
    anim: o.anim && { ...o.anim, frames: o.anim.frames.map((f) => onScreen(f, 0, 0)) },
  };
}

/** The biggest size up to `max` at which `str` fits across the stage on one line. */
const fit = (str, max) => Math.max(2, Math.min(max, Math.floor((view.w - 100) / measure(str, 1))));
const text = (key, str, size, y, tone = 1) => {
  const t = typeset(str, { size, tone, width: view.w - 100, lh: 11, align: 'center' });
  return el(key, Math.round((W - t.width) / 2), y, t.blocks, { sig: `t|${str}|${size}|${tone}|${t.width}` });
};
// Who says each line (the narrator, unless named here), and in which key: the
// worlds' lines are spoken in their colour's note.
const SAID = {
  'NATURAL 20.': 'cheer',
  'ENERGISE.': 'hero',
  'ENGAGE.': 'hero',
  'ROLL FOR INITIATIVE.': 'dm',
  'NATURAL 1.': 'sad',
  'IT HAD BEEN LONELY FOR A THOUSAND YEARS.': 'dragon',
};
const voiceOf = (str) => {
  const k = WORLDS.findIndex((w) => w.line === str);
  return { name: SAID[str] || 'narrator', base: NOTES[Math.max(0, k)] };
};

/** Each block's place in reading order, 0–1: line by line, left to right. */
function readingOrder(b, lineH) {
  const lines = [];
  for (let i = 0; i < b.length; i += 5) {
    const L = (lines[Math.floor(b[i + 1] / lineH)] ||= { x0: Infinity, x1: -Infinity, at: 0 });
    L.x0 = Math.min(L.x0, b[i]); L.x1 = Math.max(L.x1, b[i] + b[i + 2]);
  }
  let total = 0;
  for (const L of lines) if (L) { L.at = total; total += L.x1 - L.x0; }
  const out = new Float32Array(b.length / 5);
  for (let i = 0; i < b.length; i += 5) {
    const L = lines[Math.floor(b[i + 1] / lineH)];
    out[i / 5] = (L.at + b[i] - L.x0) / total;
  }
  return out;
}

/**
 * A caption forms as it's said, a blip a letter (the player and sound.js do
 * the saying). It runs along the bottom of the picture, as wide as the stage
 * allows; on a tall stage it's bigger and wraps onto more lines, like
 * subtitles, running on below the square.
 */
const caption = (str) => {
  if (!str) return null;
  const voice = voiceOf(str), size = view.cap;
  const t = typeset(str, { size, width: view.w - (view.tall ? 80 : 120), lh: 11, align: 'center' });
  const y = view.tall ? 640 : 671 - t.height; // tall: just under the ground, running on into the room below
  return Object.assign(el('cap', Math.round((W - t.width) / 2), y, t.blocks, { sig: `t|${str}|${size}|${t.width}`, motion: 'step' }), {
    sweep: str.length * VOICES[voice.name].rate, order: readingOrder(t.blocks, 11 * size), say: str, voice,
  });
};

// ---------------------------------------------------------------- pieces

// The night sky: the same field of stars repeats every 1280 × 720, so a bigger
// stage just sees more of it. (The middle one is the sky the story was drawn
// with.)
const starAt = (i, tx, ty) => {
  const a = i + tx * 1013 + ty * 7919;
  return { a, x: tx * W + Math.round(hash(a, 1) * (W - 8)), y: ty * H + Math.round(hash(a, 2) * (H - 8)), s: hash(a, 3) < 0.3 ? 4 : 2, len: 50 + hash(a, 4) * 150 };
};

/** Stars above `sky`, out to the stage's edges (but not behind the words under a tall picture); as warp streaks with `warp`. */
function stars(sky = Infinity, warp = false) {
  const x0 = -view.x - 8, x1 = view.w - view.x, y0 = -view.y - 8, y1 = Math.min(sky, view.tall ? H : view.h - view.y);
  const out = [];
  for (let ty = Math.floor(y0 / H); ty * H < y1; ty++) {
    for (let tx = Math.floor(x0 / W); tx * W < x1; tx++) {
      for (let i = 0; i < 46; i++) {
        const s = starAt(i, tx, ty);
        if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
        const key = tx || ty ? `star-${tx}.${ty}-${i}` : `star-${i}`;
        if (warp) { out.push(el(key, s.x - s.len / 2, s.y, Float32Array.from([0, 0, Math.round(s.len), 2, 1]), { sig: 'streak' })); continue; }
        const tw = s.s === 4 ? { frames: [Float32Array.from([0, 0, 4, 4, 1]), Float32Array.from([1, 1, 2, 2, 1])], period: 0.6 + hash(s.a, 5), phase: hash(s.a, 6) * 2 } : undefined;
        out.push(el(key, s.x, s.y, Float32Array.from([0, 0, s.s, s.s, 1]), { sig: `star|${s.s}`, anim: tw }));
      }
    }
  }
  return out;
}

/** The one star that keeps changing colour. */
const glitter = () => el('glitter', at(900, 690), at(150, 210), Float32Array.from([0, 0, 8, 8, 2]), {
  sig: 'glitter', anim: { frames: [0, 1, 2, 3, 4, 5, 6].map((k) => Float32Array.from([0, 0, 8, 8, 2 + k])), period: 0.4, phase: 0.2 },
});

/** The ground, edge to edge: solid at the surface, crumbling into dots further down, clear of the captions. */
function ground(tone = 0.55) {
  const out = [], x0 = Math.floor(-view.x / 8) * 8, x1 = view.w - view.x;
  for (let y = GROUND; y < GROUND + 48; y += 8) {
    const d = (y - GROUND) / 48;
    for (let x = x0; x < x1; x += 8) {
      const h = hash(x * 0.37 + 3, y * 0.53 + 9);
      if (h > 0.95 - d * 0.85) continue;
      const s = d < 0.2 ? 8 : h < 0.3 ? 6 : 4;
      out.push(x + (8 - s) / 2, y + (8 - s) / 2, s, s, tone);
    }
  }
  return el('ground', 0, 0, Float32Array.from(out), { sig: `ground|${tone}|${x0}|${x1}`, flat: true });
}

const ringed = () => el('planet', at(960, 780), at(70, 60), imageBlocks({ kind: 'orb' }, 220, 150, { cell: 6, dark: true }), { sig: 'planet', match: 'space' });

/** The adventurer, feet on the ground at x. `star` colours the staff's tip; `motion` 'step' for walking (in one piece). */
function hero(frame, x, star = null, motion) {
  const rows = ADVENTURER[frame];
  return el('hero', x, GROUND - rows.length * CELL, blocks(rows, CELL, { star }), { sig: `hero|${frame}|${star}`, motion, flat: motion === 'step' });
}

/**
 * Walking: n steps, one every `beat` seconds, from from() to to() (worked out
 * as each step happens, for the stage as it is then), the legs swapping, a
 * footstep each. `scene(x, frame)` draws the scene with the adventurer there.
 */
function walk(t0, n, from, to, beat, scene) {
  return Array.from({ length: n }, (_, i) => ({
    t: Math.round((t0 + i * beat) * 1000) / 1000,
    sound: [['step', i]],
    scene: () => scene(Math.round(from() + ((to() - from()) * (i + 1)) / n), i % 2 === 0 && i < n - 1 ? 'walk' : 'stand'),
  }));
}

/** Beaming: a column of sparkles where the adventurer was. */
function beam(x) {
  const fr = [0, 1, 2, 3].map((f) => {
    const out = [];
    for (let i = 0; i < 70; i++) out.push(Math.floor(hash(i * 3.1 + f * 17.3, 1) * 24) * 3, Math.floor(hash(i * 5.7 + f * 9.1, 2) * 32) * 3, 3, 3, [6, 4, 1][Math.floor(hash(i, f + 3) * 3)]);
    return Float32Array.from(out);
  });
  return el('hero', x, GROUND - 96, fr[0], { sig: 'beam', anim: { frames: fr, period: 0.1, phase: 0.05 } });
}

const ROLL = frames([7, 13, 2, 18, 5, 11, 16, 9].map(d20), 5);
const die = (x, y, n) => (n === 'roll'
  ? el('die', x, y, ROLL[0], { sig: 'die|roll', anim: { frames: ROLL, period: 0.5, phase: 0.05 } })
  : el('die', x, y, blocks(d20(n), 5), { sig: `die|${n}` }));

// The ship moves as one piece (flat: no tumbling on the way). x 'left': just
// off the stage's left edge.
const ship = (x, y, motion) => el('ship', x === 'left' ? offLeft(SHIP[0].length * CELL) : x, y, blocks(SHIP, CELL), { sig: 'ship', flat: true, motion });

// The colours found so far, in a row of seven slots at the top.
const slotX = (k) => Math.round((W - (7 * 28 + 6 * 12)) / 2) + k * 40;
function slots(found) {
  return [0, 1, 2, 3, 4, 5, 6].flatMap((k) => [
    el(`slot-${k}`, slotX(k), 28, frameBlocks(28, 28), { sig: 'slot' }),
    found > k ? el(`gem-${k}`, slotX(k) + 4, 32, fillBlocks(20, 20, 5, 0, 2 + k), { sig: 'gem|slot' }) : null,
  ]).filter(Boolean);
}
const GEM = ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'];
const gem = (k, x, y) => el(`gem-${k}`, x, y, blocks(GEM, CELL, { tone: 2 + k }), { sig: 'gem|big' });

// The worlds, each in its own colour, and each seen a different way: where it
// is ([x, y, radius]), where its colour comes up, the ship (two places if it's
// moving), whether we pan across to it from the last one or cut, and for how
// long we stay. Places are P(wide, square).
const WORLDS = [
  {
    kind: 'terrain', line: 'THE FIRST WORLD HUMMED IN RED.', at: P([820, 330, 200], [700, 300, 170]), gem: P([1040, 150], [900, 150]),
    ship: [() => ['left', 420], P([150, 420], [300, 440])], dur: 3.2,
  },
  {
    kind: 'waves', line: 'THE NEXT WAS AN OCEAN THAT SANG.', at: P([740, 330, 180], [720, 320, 160]), gem: P([950, 140], [910, 140]),
    ship: [P([150, 420], [300, 440])], pan: true, dur: 2.6,
  },
  {
    kind: 'cubes', line: 'THEN A CITY OF GOLDEN CUBES.', at: P([640, 370, 270], [640, 370, 250]), gem: P([970, 130], [900, 110]),
    from: [W, 0], dur: 2.6,
  },
  {
    kind: 'globe', line: 'A FOREST THAT WALKED AT NIGHT.', at: P([1000, 220, 120], [860, 220, 100]), gem: P([760, 130], [640, 140]),
    ship: [P([100, 420], [290, 440]), P([330, 420], [400, 440])], from: [0, H / 2], dur: 2.6,
  },
  {
    kind: 'rings', line: 'RINGS OF ICE, RINGING.', at: P([840, 320, 180], [760, 320, 150]), gem: P([1060, 130], [930, 120]),
    ship: [P([330, 420], [400, 440])], pan: true, dur: 2.6,
  },
  {
    kind: 'earth', line: 'A WORLD MADE ENTIRELY OF RAIN.', at: P([640, 330, 230], [640, 320, 210]), gem: P([960, 150], [880, 120]),
    from: [W / 2, H], dur: 3.2,
  },
];
const WORLD_BLOCKS = new Map();
function world(k, cx, cy, R, motion) {
  const id = `${k}|${R}`;
  if (!WORLD_BLOCKS.has(id)) {
    const b = imageBlocks({ kind: WORLDS[k].kind }, 2 * R, 2 * R, { cell: 8, dark: true });
    const out = [];
    for (let i = 0; i < b.length; i += 5) {
      if (Math.hypot(b[i] + b[i + 2] / 2 - R, b[i + 1] + b[i + 3] / 2 - R) > R - 4) continue;
      out.push(b[i], b[i + 1], b[i + 2], b[i + 3], 2 + k);
    }
    WORLD_BLOCKS.set(id, Float32Array.from(out));
  }
  return el(`world-${k}`, cx - R, cy - R, WORLD_BLOCKS.get(id), { sig: `world|${id}`, match: 'space', motion });
}

const dragon = (frame) => el('dragon', at(840, 760), GROUND - 16 * 7, blocks(DRAGON[frame], 7), { sig: `dragon|${frame}` });

/** A flower like the garden's: a stem and a 5×5 head in colour k. */
function flower(i, x, k) {
  const tall = 4 + Math.floor(hash(i, 8) * 5), out = [];
  for (let j = 1; j <= tall; j++) out.push(0, -j * CELL, CELL, CELL, 1);
  const cy = -(tall + 3) * CELL;
  for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
    if (Math.abs(u) === 2 && Math.abs(v) === 2) continue;
    out.push(u * CELL, cy + v * CELL, CELL, CELL, u === 0 && v === 0 ? 1 : 2 + k);
  }
  return el(`flower-${i}`, x, GROUND, Float32Array.from(out), { sig: `flower|${k}` });
}
/** Flowers right across the stage, as many as fit. */
function flowers() {
  const n = Math.max(6, Math.floor((view.w - 120) / 68)), x0 = Math.round(W / 2 - ((n - 1) * 68) / 2);
  return Array.from({ length: n }, (_, i) => flower(i, x0 + i * 68 + Math.round(hash(i, 9) * 20) - 10, i % 7));
}

// ---------------------------------------------------------------- scenes

const HX = () => at(300, 360); // where the adventurer stands at home
const LX = () => at(360, 400); // and in front of the dragon
const walking = (o) => (o.walking ? 'step' : undefined);
const home = (o) => [
  ground(), ringed(), ...stars(GROUND - 40), o.glitter !== false ? glitter() : null,
  hero(o.hero || 'stand', o.heroX ?? HX(), o.star ?? null, walking(o)), o.die ? die(HX() + 110, GROUND - 150, o.die) : null,
  caption(o.cap),
].filter(Boolean);

const space = (o) => [
  ...stars(Infinity, o.warp), o.shipX !== null ? ship(o.shipX ?? at(400, 420), 300) : null, ...slots(0), caption(o.cap),
].filter(Boolean);

/** At world k: the worlds in view ([k, x, y, R, motion]), the colours found so far, its colour coming up, the ship. */
const atWorld = (k, o) => [
  ...stars(), ...o.worlds.map((w) => world(...w)), ...slots(o.found),
  o.gem ? gem(k, ...WORLDS[k].gem()) : null, o.ship ? ship(o.ship[0], o.ship[1], o.shipMotion) : null, caption(o.cap),
].filter(Boolean);

/** The trip: at each world its colour comes up and flies into its slot. */
function trip(t) {
  return WORLDS.flatMap((w, k) => {
    const s = t, path = w.ship || [];
    const here = () => [k, ...w.at()];
    const shot = (o) => atWorld(k, { found: k, cap: w.line, ship: path.length ? path[path.length - 1]() : null, worlds: [here()], ...o });
    t += w.dur;
    const cues = [];
    if (w.pan) {
      // The last world goes off to the left as this one comes in from the right.
      const p = WORLDS[k - 1];
      const gone = () => { const [, y, r] = p.at(); return [k - 1, offLeft(2 * r) + r, y, r, 'pan']; };
      const coming = () => { const [, y, r] = w.at(); return [k, offRight() + r, y, r]; };
      cues.push(
        { t: s, sound: ['whoosh', ['arrive', k]], scene: () => shot({ cap: p.line, worlds: [gone(), coming()] }) },
        { t: s + 0.06, scene: () => shot({ worlds: [gone(), [...here(), 'pan']] }) },
        { t: s + 0.6, scene: () => shot({ worlds: [gone(), here()], gem: true }) },
      );
    } else {
      cues.push({ t: s, mode: 'page', origin: w.from || [W, H / 2], sound: ['shuffle', ['arrive', k]], scene: () => shot({ gem: true, ship: path[0]?.() }) });
      // The ship sets off once the cut has settled (moving earlier, it would
      // drag the cut's loose blocks along with it).
      if (path.length > 1) cues.push({ t: s + 1.5, scene: () => shot({ gem: true, shipMotion: 'glide' }) });
    }
    cues.push({ t: s + w.dur - 0.9, light: [[slotX(k) + 14, 42]], sound: [['collect', k]], scene: () => shot({ found: k + 1 }) });
    if (k === 0) cues[0].chapter = 'SIX WORLDS';
    return cues;
  });
}

const lair = (o) => [
  ground(0.4), ...stars(GROUND - 40), ...slots(6), dragon(o.dragon || 'grr'),
  o.gem === 'big' ? gem(6, at(1080, 920), GROUND - 200) : null,
  hero(o.hero || 'stand', o.heroX ?? LX(), 5, walking(o)), o.die ? die(LX() + 110, GROUND - 170, o.die) : null,
  caption(o.cap),
].filter(Boolean);

const dawn = (o) => [
  ground(), ringed(), ...slots(7), ...(o.flowers ? flowers() : []),
  hero(o.hero || 'stand', o.heroX ?? HX(), 6, walking(o)), caption(o.cap),
].filter(Boolean);

/** The small print on the title and end cards: the words' size, so it can be read on a phone too. */
const small = () => view.cap;
const TITLE = 'THE ADVENTURER';
const titleSize = () => fit(TITLE, 12);
/** Where the title card's "A SHORT STORY IN BLOCKS" ends (the player puts PLAY under it). */
export const subtitleEnd = () => 250 + 7 * titleSize() + 56 + 7 * small();
const titleCard = () => [
  text('title', TITLE, titleSize(), 250),
  text('sub', 'A SHORT STORY IN BLOCKS', small(), 250 + 7 * titleSize() + 56),
];
const end = () => {
  const mark = iconFrames('logo', 10), c = small(), by = 'BY JP BOTHMA · JPBOTHMA.COM';
  const subAt = view.tall ? 390 : 350, byAt = subAt + 7 * c + 24;
  const markAt = Math.max(470, byAt + typeset(by, { size: c, width: view.w - 100, lh: 11 }).height + 50);
  return [
    text('end-title', TITLE, fit(TITLE, view.tall ? 12 : 8), 250),
    text('end-sub', 'A SHORT STORY IN BLOCKS', c, subAt),
    text('end-by', by, c, byAt, 0.55),
    el('mark', Math.round((W - mark.w) / 2), markAt, mark.frames[0], { sig: 'mark', anim: { frames: mark.frames, period: 1.4, phase: 0.6 } }),
  ];
};

// ---------------------------------------------------------------- the script

// t: seconds. mode: 'intro' | 'page' (mosaic) | 'local' (things re-form in
// place). light: points the click light runs out from. theme: switch to it,
// dissolving out from `at`. sound: effects from sound.js, [name, arg] for an
// argument. chapter: a name for the scrubber. Points are in the wide frame;
// lights, origins and theme.at can be functions, worked out when they happen.
const C = [W / 2, H / 2];
const heroAt = () => [HX() + 36, GROUND - 60];
const BACK = () => at(460, 540); // where the adventurer comes home from
const backAt = () => [BACK() + 36, GROUND - 60];
const HOME = 'EVERYTHING HERE WAS INK AND PAPER.';
const LAIR = 'THE LAST COLOUR HAD A DRAGON ON IT.';
const DAWN = 'AND THE COLOURS CAME HOME.';
export const CUES = [
  { t: 0, chapter: 'TITLE', mode: 'intro', sound: ['assemble'], scene: titleCard },
  { t: 2.3, light: () => [[W / 2, 250 + 3.5 * titleSize()]], sound: ['light'] },
  { t: 4.8, chapter: 'HOME', mode: 'page', origin: C, theme: { to: 'dark', at: C }, sound: ['shuffle', 'night'], scene: () => home({ heroX: at(60, 180), cap: HOME }) },
  ...walk(6.0, 15, () => at(60, 180), HX, 0.2, (x, f) => home({ heroX: x, hero: f, walking: true, cap: HOME })),
  { t: 9.8, sound: ['caption', 'twinkle'], scene: () => home({ hero: 'up', cap: 'BUT SOMETHING OUT THERE KEPT GLITTERING.' }) },
  { t: 14.0, sound: ['caption', ['roll', 2.4]], scene: () => home({ hero: 'stand', die: 'roll', cap: 'SO THE ADVENTURER ROLLED FOR COURAGE.' }) },
  { t: 16.6, light: () => [[HX() + 152, GROUND - 115]], sound: ['land', 'nat20'], scene: () => home({ hero: 'cheer', die: 20, cap: 'NATURAL 20.' }) },
  { t: 19.2, sound: ['caption'], scene: () => home({ hero: 'stand', glitter: true, cap: 'ENERGISE.' }) },
  { t: 20.2, sound: ['energise'], scene: () => [ground(), ringed(), ...stars(GROUND - 40), glitter(), beam(HX() + 6), caption('ENERGISE.')] },
  { t: 21.8, chapter: 'THE SHIP', mode: 'page', origin: heroAt, sound: ['shuffle'], scene: () => space({ cap: 'THE SHIP WAS SMALL. THE SKY WAS NOT.' }) },
  { t: 25.8, light: () => [[at(390, 450), 330]], sound: ['engage'], scene: () => space({ warp: true, shipX: at(470, 480), cap: 'ENGAGE.' }) },
  // Off it goes, out of the picture (and gone, so it doesn't fly back across the cut).
  { t: 27.2, sound: ['whoosh'], scene: () => space({ warp: true, shipX: offRight(), cap: 'ENGAGE.' }) },
  { t: 27.8, scene: () => space({ warp: true, shipX: null, cap: 'ENGAGE.' }) },
  ...trip(28.0),
  { t: 44.8, chapter: 'THE DRAGON', mode: 'page', origin: [W, H / 2], sound: ['shuffle', 'growl'], scene: () => lair({ gem: 'big', heroX: at(200, 300), cap: LAIR }) },
  ...walk(45.8, 10, () => at(200, 300), LX, 0.2, (x, f) => lair({ gem: 'big', heroX: x, hero: f, walking: true, cap: LAIR })),
  { t: 48.6, sound: ['caption', ['roll', 1.9]], scene: () => lair({ gem: 'big', die: 'roll', cap: 'ROLL FOR INITIATIVE.' }) },
  { t: 50.6, sound: ['land', 'nat1'], scene: () => lair({ gem: 'big', die: 1, cap: 'NATURAL 1.' }) },
  { t: 52.6, sound: ['caption', 'sit'], scene: () => lair({ gem: 'big', hero: 'sit', cap: 'SO THE ADVENTURER SAT DOWN AND TALKED.' }) },
  { t: 56.4, sound: ['caption', 'calm'], scene: () => lair({ gem: 'big', hero: 'sit', dragon: 'calm', cap: 'IT HAD BEEN LONELY FOR A THOUSAND YEARS.' }) },
  { t: 60.4, light: [[slotX(6) + 14, 42]], sound: [['collect', 6], 'light'], scene: () => [...lair({ hero: 'cheer', dragon: 'calm', cap: 'IT GAVE THE LAST COLOUR GLADLY.' }).filter((e) => !e.key.startsWith('slot') && !e.key.startsWith('gem')), ...slots(7)] },
  { t: 63.6, chapter: 'HOME AGAIN', mode: 'page', origin: backAt, theme: { to: 'light', at: backAt }, sound: ['shuffle', 'morning', 'dawn'], scene: () => dawn({ heroX: BACK(), cap: DAWN }) },
  ...walk(64.3, 10, BACK, HX, 0.15, (x, f) => dawn({ heroX: x, hero: f, walking: true, cap: DAWN })),
  { t: 65.8, light: () => { const [x, y] = heroAt(); return [[x, y], [x, y - 40]]; }, sound: ['light', 'bloom'], scene: () => dawn({ hero: 'cheer', flowers: true, cap: DAWN }) },
  { t: 69.4, sound: ['caption'], scene: () => dawn({ hero: 'cheer', flowers: true, cap: 'THE UNKNOWN IS ONLY A PLACE NO ONE HAS WALKED YET.' }) },
  { t: 74.0, chapter: 'THE END', mode: 'page', origin: C, sound: ['shuffle', 'end'], scene: end },
].sort((a, b) => a.t - b.t);
/** Where the scrubber marks the chapters. */
export const CHAPTERS = CUES.filter((c) => c.chapter).map((c) => ({ t: c.t, name: c.chapter }));
/** Seconds into the story where the night's drone plays. */
export const NIGHT = [4.8, 63.6];
export const LENGTH = 80;
