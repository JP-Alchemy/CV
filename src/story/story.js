// The Adventurer: a short story in blocks. An ink-and-paper world, a d20, a
// small ship, seven unknown worlds, a dragon, and the colours coming home.
// Each cue rebuilds the whole scene; the engine morphs from whatever is on
// screen. Scene cuts use the site's page morph (the blocks pixelate, tumble
// and resolve: a transporter, more or less); captions share one key, so each
// line morphs letter by letter into the next.
//
// The story is drawn in a 1280 × 720 frame, but the stage around it can be
// any shape (setView): the stars and the ground carry on to its edges, and on
// a tall stage the words go under the picture, bigger, like subtitles.
import { typeset } from '../engine/typeset.js';
import { imageBlocks } from '../engine/images.js';
import { iconFrames } from '../icons.js';
import { frameBlocks, fillBlocks } from '../ui.js';
import { ADVENTURER, SHIP, DRAGON, d20, blocks, frames } from './art.js';
import { VOICES, NOTES } from './sound.js';

export const W = 1280, H = 720;
/** Room under the picture for the words, on a tall stage. */
export const STRIP = 300;
/** Where the title card's "A SHORT STORY IN BLOCKS" sits (the player puts PLAY under it). */
export const SUB_Y = 390;
const GROUND = 560, CELL = 6;

// Where the frame sits on the stage (x, y: on the 16 px grid), the stage's
// size (w, h), whether the words go under the picture (tall), and their size
// (cap). The player sets it whenever the stage changes shape.
const view = { x: 0, y: 0, w: W, h: H, tall: false, cap: 3 };
export const setView = (v) => Object.assign(view, v);
// Just past the stage's left and right edges, for something w wide.
const offLeft = (w) => -view.x - w - 40;
const offRight = () => view.w - view.x + 40;

const fract = (v) => v - Math.floor(v);
const hash = (a, b = 0) => fract(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);

/** An element the engine understands, from blocks relative to (x, y) in the frame. */
function el(key, x, y, b, o = {}) {
  x += view.x; y += view.y;
  const abs = new Float32Array(b.length);
  for (let i = 0; i < b.length; i += 5) {
    abs[i] = b[i] + x; abs[i + 1] = b[i + 1] + y; abs[i + 2] = b[i + 2]; abs[i + 3] = b[i + 3]; abs[i + 4] = b[i + 4];
  }
  return {
    key, sig: o.sig ?? key, x, y, w: 0, h: 0, blocks: abs, z: o.z ?? 0, flat: !!o.flat,
    motion: o.motion, match: o.match, anim: o.anim, fixed: false, n: b.length / 5,
  };
}

const text = (key, str, size, y, tone = 1) => {
  const t = typeset(str, { size, tone, width: W - 120, lh: 11, align: 'center' });
  return el(key, Math.round((W - t.width) / 2), y, t.blocks, { sig: `t|${str}|${size}|${tone}` });
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
 * the saying). It runs along the bottom of the picture; on a tall stage it
 * goes under it instead, bigger, wrapping onto more lines like subtitles.
 */
const caption = (str) => {
  if (!str) return null;
  const voice = voiceOf(str), size = view.cap;
  const t = typeset(str, { size, width: (view.tall ? W : Math.max(W, view.w)) - 120, lh: 11, align: 'center' });
  const y = view.tall ? H + 56 : 671 - t.height;
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
const glitter = (x, y) => el('glitter', x, y, Float32Array.from([0, 0, 8, 8, 2]), {
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

const ringed = () => el('planet', 960, 70, imageBlocks({ kind: 'orb' }, 220, 150, { cell: 6, dark: true }), { sig: 'planet', match: 'space' });

/** The adventurer, feet on the ground at x. `star` colours the staff's tip; `motion` 'step' for walking (in one piece). */
function hero(frame, x, star = null, motion) {
  const rows = ADVENTURER[frame];
  return el('hero', x, GROUND - rows.length * CELL, blocks(rows, CELL, { star }), { sig: `hero|${frame}|${star}`, motion, flat: motion === 'step' });
}

/**
 * Walking: a step every `beat` seconds from x0 to x1, the legs swapping, a
 * footstep each. `scene(x, frame)` draws the scene with the adventurer there.
 */
function walk(t0, x0, x1, beat, scene) {
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / 16));
  return Array.from({ length: n }, (_, i) => ({
    t: Math.round((t0 + i * beat) * 1000) / 1000,
    sound: [['step', i]],
    scene: () => scene(Math.round(x0 + ((x1 - x0) * (i + 1)) / n), i % 2 === 0 && i < n - 1 ? 'walk' : 'stand'),
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
// long we stay.
const WORLDS = [
  { kind: 'terrain', line: 'THE FIRST WORLD HUMMED IN RED.', at: [820, 330, 200], gem: [1040, 150], ship: [['left', 420], [150, 420]], dur: 3.2 },
  { kind: 'waves', line: 'THE NEXT WAS AN OCEAN THAT SANG.', at: [740, 330, 180], gem: [950, 140], ship: [[150, 420]], pan: true, dur: 2.6 },
  { kind: 'cubes', line: 'THEN A CITY OF GOLDEN CUBES.', at: [640, 370, 270], gem: [970, 130], from: [W, 0], dur: 2.6 },
  { kind: 'globe', line: 'A FOREST THAT WALKED AT NIGHT.', at: [1000, 220, 120], gem: [760, 130], ship: [[100, 420], [330, 420]], from: [0, H / 2], dur: 2.6 },
  { kind: 'rings', line: 'RINGS OF ICE, RINGING.', at: [840, 320, 180], gem: [1060, 130], ship: [[330, 420]], pan: true, dur: 2.6 },
  { kind: 'earth', line: 'A WORLD MADE ENTIRELY OF RAIN.', at: [640, 330, 230], gem: [960, 150], from: [W / 2, H], dur: 3.2 },
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

const dragon = (frame) => el('dragon', 840, GROUND - 16 * 7, blocks(DRAGON[frame], 7), { sig: `dragon|${frame}` });

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

// ---------------------------------------------------------------- scenes

const HX = 300; // where the adventurer stands at home
const walking = (o) => (o.walking ? 'step' : undefined);
const home = (o) => [
  ground(), ringed(), ...stars(GROUND - 40), o.glitter !== false ? glitter(900, 150) : null,
  hero(o.hero || 'stand', o.heroX ?? HX, o.star ?? null, walking(o)), o.die ? die(HX + 110, GROUND - 150, o.die) : null,
  caption(o.cap),
].filter(Boolean);

const space = (o) => [
  ...stars(Infinity, o.warp), o.shipX !== null ? ship(o.shipX ?? 400, 300) : null, ...slots(0), caption(o.cap),
].filter(Boolean);

/** At world k: the worlds in view ([k, x, y, R, motion]), the colours found so far, its colour coming up, the ship. */
const atWorld = (k, o) => [
  ...stars(), ...o.worlds.map((w) => world(...w)), ...slots(o.found),
  o.gem ? gem(k, ...WORLDS[k].gem) : null, o.ship ? ship(o.ship[0], o.ship[1], o.shipMotion) : null, caption(o.cap),
].filter(Boolean);

/** The trip: at each world its colour comes up and flies into its slot. */
function trip(t) {
  return WORLDS.flatMap((w, k) => {
    const s = t, [cx, cy, R] = w.at, path = w.ship || [];
    const here = [k, cx, cy, R];
    const at = (o) => atWorld(k, { found: k, cap: w.line, ship: path[path.length - 1], worlds: [here], ...o });
    t += w.dur;
    const cues = [];
    if (w.pan) {
      // The last world goes off to the left as this one comes in from the right.
      const p = WORLDS[k - 1], [, py, pR] = p.at;
      const gone = () => [k - 1, offLeft(2 * pR) + pR, py, pR, 'pan'];
      cues.push(
        { t: s, sound: ['whoosh', ['arrive', k]], scene: () => at({ cap: p.line, worlds: [gone(), [k, offRight() + R, cy, R]] }) },
        { t: s + 0.06, scene: () => at({ worlds: [gone(), [...here, 'pan']] }) },
        { t: s + 0.6, scene: () => at({ worlds: [gone(), here], gem: true }) },
      );
    } else {
      cues.push({ t: s, mode: 'page', origin: w.from || [W, H / 2], sound: ['shuffle', ['arrive', k]], scene: () => at({ gem: true, ship: path[0] }) });
      // The ship sets off once the cut has settled (moving earlier, it would
      // drag the cut's loose blocks along with it).
      if (path.length > 1) cues.push({ t: s + 1.5, scene: () => at({ gem: true, shipMotion: 'glide' }) });
    }
    cues.push({ t: s + w.dur - 0.9, light: [[slotX(k) + 14, 42]], sound: [['collect', k]], scene: () => at({ found: k + 1 }) });
    if (k === 0) cues[0].chapter = 'SIX WORLDS';
    return cues;
  });
}

const lair = (o) => [
  ground(0.4), ...stars(GROUND - 40), ...slots(6), dragon(o.dragon || 'grr'),
  o.gem === 'big' ? gem(6, 1080, GROUND - 200) : null,
  hero(o.hero || 'stand', o.heroX ?? 360, 5, walking(o)), o.die ? die(470, GROUND - 170, o.die) : null,
  caption(o.cap),
].filter(Boolean);

const FLOWERS = Array.from({ length: 16 }, (_, i) => ({ x: 120 + i * 68 + Math.round(hash(i, 9) * 20), k: i % 7 }));
const dawn = (o) => [
  ground(), ringed(), ...slots(7), ...(o.flowers ? FLOWERS.map((f, i) => flower(i, f.x, f.k)) : []),
  hero(o.hero || 'stand', o.heroX ?? HX, 6, walking(o)), caption(o.cap),
].filter(Boolean);

/** The small print on the title and end cards: the words' size, so it can be read on a phone too. */
const small = () => view.cap;
const end = () => {
  const mark = iconFrames('logo', 10), c = small(), by = 'BY JP BOTHMA · JPBOTHMA.COM';
  const subAt = view.tall ? 390 : 350, byAt = subAt + 7 * c + 24;
  const markAt = Math.max(470, byAt + typeset(by, { size: c, width: W - 120, lh: 11 }).height + 50);
  return [
    text('end-title', 'THE ADVENTURER', view.tall ? 12 : 8, 250),
    text('end-sub', 'A SHORT STORY IN BLOCKS', c, subAt),
    text('end-by', by, c, byAt, 0.55),
    el('mark', Math.round((W - mark.w) / 2), markAt, mark.frames[0], { sig: 'mark', anim: { frames: mark.frames, period: 1.4, phase: 0.6 } }),
  ];
};

// ---------------------------------------------------------------- the script

// t: seconds. mode: 'intro' | 'page' (mosaic) | 'local' (things re-form in
// place). light: points the click light runs out from. theme: switch to it,
// dissolving out from `at`. sound: effects from sound.js, [name, arg] for an
// argument. chapter: a name for the scrubber. Points are in the frame.
const C = [W / 2, H / 2];
const heroAt = [HX + 36, GROUND - 60];
const HOME = 'EVERYTHING HERE WAS INK AND PAPER.';
const LAIR = 'THE LAST COLOUR HAD A DRAGON ON IT.';
const DAWN = 'AND THE COLOURS CAME HOME.';
const BACK = 460; // where the adventurer comes home from
export const CUES = [
  { t: 0, chapter: 'TITLE', mode: 'intro', sound: ['assemble'], scene: () => [text('title', 'THE ADVENTURER', 12, 250), text('sub', 'A SHORT STORY IN BLOCKS', small(), SUB_Y)] },
  { t: 2.3, light: [[W / 2, 290]], sound: ['light'] },
  { t: 4.8, chapter: 'HOME', mode: 'page', origin: C, theme: { to: 'dark', at: C }, sound: ['shuffle', 'night'], scene: () => home({ heroX: 60, cap: HOME }) },
  ...walk(6.0, 60, HX, 0.2, (x, f) => home({ heroX: x, hero: f, walking: true, cap: HOME })),
  { t: 9.8, sound: ['caption', 'twinkle'], scene: () => home({ hero: 'up', cap: 'BUT SOMETHING OUT THERE KEPT GLITTERING.' }) },
  { t: 14.0, sound: ['caption', ['roll', 2.4]], scene: () => home({ hero: 'stand', die: 'roll', cap: 'SO THE ADVENTURER ROLLED FOR COURAGE.' }) },
  { t: 16.6, light: [[HX + 152, GROUND - 115]], sound: ['land', 'nat20'], scene: () => home({ hero: 'cheer', die: 20, cap: 'NATURAL 20.' }) },
  { t: 19.2, sound: ['caption'], scene: () => home({ hero: 'stand', glitter: true, cap: 'ENERGISE.' }) },
  { t: 20.2, sound: ['energise'], scene: () => [ground(), ringed(), ...stars(GROUND - 40), glitter(900, 150), beam(HX + 6), caption('ENERGISE.')] },
  { t: 21.8, chapter: 'THE SHIP', mode: 'page', origin: heroAt, sound: ['shuffle'], scene: () => space({ cap: 'THE SHIP WAS SMALL. THE SKY WAS NOT.' }) },
  { t: 25.8, light: [[390, 330]], sound: ['engage'], scene: () => space({ warp: true, shipX: 470, cap: 'ENGAGE.' }) },
  // Off it goes, out of the picture (and gone, so it doesn't fly back across the cut).
  { t: 27.2, sound: ['whoosh'], scene: () => space({ warp: true, shipX: offRight(), cap: 'ENGAGE.' }) },
  { t: 27.8, scene: () => space({ warp: true, shipX: null, cap: 'ENGAGE.' }) },
  ...trip(28.0),
  { t: 44.8, chapter: 'THE DRAGON', mode: 'page', origin: [W, H / 2], sound: ['shuffle', 'growl'], scene: () => lair({ gem: 'big', heroX: 200, cap: LAIR }) },
  ...walk(45.8, 200, 360, 0.2, (x, f) => lair({ gem: 'big', heroX: x, hero: f, walking: true, cap: LAIR })),
  { t: 48.6, sound: ['caption', ['roll', 1.9]], scene: () => lair({ gem: 'big', die: 'roll', cap: 'ROLL FOR INITIATIVE.' }) },
  { t: 50.6, sound: ['land', 'nat1'], scene: () => lair({ gem: 'big', die: 1, cap: 'NATURAL 1.' }) },
  { t: 52.6, sound: ['caption', 'sit'], scene: () => lair({ gem: 'big', hero: 'sit', cap: 'SO THE ADVENTURER SAT DOWN AND TALKED.' }) },
  { t: 56.4, sound: ['caption', 'calm'], scene: () => lair({ gem: 'big', hero: 'sit', dragon: 'calm', cap: 'IT HAD BEEN LONELY FOR A THOUSAND YEARS.' }) },
  { t: 60.4, light: [[slotX(6) + 14, 42]], sound: [['collect', 6], 'light'], scene: () => [...lair({ hero: 'cheer', dragon: 'calm', cap: 'IT GAVE THE LAST COLOUR GLADLY.' }).filter((e) => !e.key.startsWith('slot') && !e.key.startsWith('gem')), ...slots(7)] },
  { t: 63.6, chapter: 'HOME AGAIN', mode: 'page', origin: [BACK + 36, GROUND - 60], theme: { to: 'light', at: [BACK + 36, GROUND - 60] }, sound: ['shuffle', 'morning', 'dawn'], scene: () => dawn({ heroX: BACK, cap: DAWN }) },
  ...walk(64.3, BACK, HX, 0.15, (x, f) => dawn({ heroX: x, hero: f, walking: true, cap: DAWN })),
  { t: 65.8, light: [heroAt, [heroAt[0], heroAt[1] - 40]], sound: ['light', 'bloom'], scene: () => dawn({ hero: 'cheer', flowers: true, cap: DAWN }) },
  { t: 69.4, sound: ['caption'], scene: () => dawn({ hero: 'cheer', flowers: true, cap: 'THE UNKNOWN IS ONLY A PLACE NO ONE HAS WALKED YET.' }) },
  { t: 74.0, chapter: 'THE END', mode: 'page', origin: C, sound: ['shuffle', 'end'], scene: end },
].sort((a, b) => a.t - b.t);
/** Where the scrubber marks the chapters. */
export const CHAPTERS = CUES.filter((c) => c.chapter).map((c) => ({ t: c.t, name: c.chapter }));
/** Seconds into the story where the night's drone plays. */
export const NIGHT = [4.8, 63.6];
export const LENGTH = 80;
