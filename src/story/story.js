// The Adventurer: a short story in blocks. An ink-and-paper world, a d20, a
// small ship, seven unknown worlds, a dragon, and the colours coming home.
// Each cue rebuilds the whole scene; the engine morphs from whatever is on
// screen. Scene cuts use the site's page morph (the blocks pixelate, tumble
// and resolve: a transporter, more or less); captions share one key, so each
// line morphs letter by letter into the next.
import { typeset } from '../engine/typeset.js';
import { imageBlocks } from '../engine/images.js';
import { iconFrames } from '../icons.js';
import { frameBlocks, fillBlocks } from '../ui.js';
import { ADVENTURER, SHIP, DRAGON, d20, blocks, frames } from './art.js';

export const W = 1280, H = 720;
const GROUND = 560, CELL = 6;

const fract = (v) => v - Math.floor(v);
const hash = (a, b = 0) => fract(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);

/** An element the engine understands, from blocks relative to (x, y). */
function el(key, x, y, b, o = {}) {
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
const caption = (str) => (str ? text('cap', str, 3, 650) : null);

// ---------------------------------------------------------------- pieces

const STARS = Array.from({ length: 46 }, (_, i) => ({ x: Math.round(hash(i, 1) * (W - 8)), y: Math.round(hash(i, 2) * (H - 8)), s: hash(i, 3) < 0.3 ? 4 : 2, len: 50 + hash(i, 4) * 150 }));

/** Stars above `sky`; as warp streaks with `warp`. */
function stars(sky = H, warp = false) {
  return STARS.flatMap((s, i) => {
    if (s.y > sky) return [];
    if (warp) return [el(`star-${i}`, s.x - s.len / 2, s.y, Float32Array.from([0, 0, Math.round(s.len), 2, 1]), { sig: 'streak' })];
    const tw = s.s === 4 ? { frames: [Float32Array.from([0, 0, 4, 4, 1]), Float32Array.from([1, 1, 2, 2, 1])], period: 0.6 + hash(i, 5), phase: hash(i, 6) * 2 } : undefined;
    return [el(`star-${i}`, s.x, s.y, Float32Array.from([0, 0, s.s, s.s, 1]), { sig: `star|${s.s}`, anim: tw })];
  });
}

/** The one star that keeps changing colour. */
const glitter = (x, y) => el('glitter', x, y, Float32Array.from([0, 0, 8, 8, 2]), {
  sig: 'glitter', anim: { frames: [0, 1, 2, 3, 4, 5, 6].map((k) => Float32Array.from([0, 0, 8, 8, 2 + k])), period: 0.4, phase: 0.2 },
});

/** The ground: solid at the surface, crumbling into dots further down, clear of the captions. */
function ground(tone = 0.55) {
  const out = [];
  for (let y = GROUND; y < GROUND + 48; y += 8) {
    const d = (y - GROUND) / 48;
    for (let x = 0; x < W; x += 8) {
      const h = hash(x * 0.37 + 3, y * 0.53 + 9);
      if (h > 0.95 - d * 0.85) continue;
      const s = d < 0.2 ? 8 : h < 0.3 ? 6 : 4;
      out.push(x + (8 - s) / 2, y + (8 - s) / 2, s, s, tone);
    }
  }
  return el('ground', 0, 0, Float32Array.from(out), { sig: `ground|${tone}`, flat: true });
}

const ringed = () => el('planet', 960, 70, imageBlocks({ kind: 'orb' }, 220, 150, { cell: 6, dark: true }), { sig: 'planet', match: 'space' });

/** The adventurer, feet on the ground at x. `star` colours the staff's tip. */
function hero(frame, x, star = null) {
  const rows = ADVENTURER[frame];
  return el('hero', x, GROUND - rows.length * CELL, blocks(rows, CELL, { star }), { sig: `hero|${frame}|${star}` });
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

const ship = (x, y) => el('ship', x, y, blocks(SHIP, CELL), { sig: 'ship' });

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

// The worlds, each in its own colour.
const WORLDS = [
  { kind: 'terrain', line: 'THE FIRST WORLD HUMMED IN RED.' },
  { kind: 'waves', line: 'THE NEXT WAS AN OCEAN THAT SANG.' },
  { kind: 'cubes', line: 'THEN A CITY OF GOLDEN CUBES.' },
  { kind: 'globe', line: 'A FOREST THAT WALKED AT NIGHT.' },
  { kind: 'rings', line: 'RINGS OF ICE, RINGING.' },
  { kind: 'earth', line: 'A WORLD MADE ENTIRELY OF RAIN.' },
];
function world(k, cx = 700, cy = 330, R = 190) {
  const b = imageBlocks({ kind: WORLDS[k].kind }, 2 * R, 2 * R, { cell: 8, dark: true });
  const out = [];
  for (let i = 0; i < b.length; i += 5) {
    if (Math.hypot(b[i] + b[i + 2] / 2 - R, b[i + 1] + b[i + 3] / 2 - R) > R - 4) continue;
    out.push(b[i], b[i + 1], b[i + 2], b[i + 3], 2 + k);
  }
  return el(`world-${k}`, cx - R, cy - R, Float32Array.from(out), { sig: `world|${k}`, match: 'space' });
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
const home = (o) => [
  ground(), ringed(), ...stars(GROUND - 40), o.glitter !== false ? glitter(900, 150) : null,
  hero(o.hero || 'stand', HX, o.star ?? null), o.die ? die(HX + 110, GROUND - 150, o.die) : null,
  caption(o.cap),
].filter(Boolean);

const space = (o) => [
  ...stars(H, o.warp), ship(o.shipX ?? 400, 300), ...slots(0), caption(o.cap),
].filter(Boolean);

const atWorld = (k, o) => [
  ...stars(H), world(k), ...slots(o.found), o.gem ? gem(k, 960, 300) : null, caption(o.cap),
].filter(Boolean);

const lair = (o) => [
  ground(0.4), ...stars(GROUND - 40), ...slots(6), dragon(o.dragon || 'grr'),
  o.gem === 'big' ? gem(6, 1080, GROUND - 200) : null,
  hero(o.hero || 'stand', 360, 5), o.die ? die(470, GROUND - 170, o.die) : null,
  caption(o.cap),
].filter(Boolean);

const FLOWERS = Array.from({ length: 16 }, (_, i) => ({ x: 120 + i * 68 + Math.round(hash(i, 9) * 20), k: i % 7 }));
const dawn = (o) => [
  ground(), ringed(), ...slots(7), ...(o.flowers ? FLOWERS.map((f, i) => flower(i, f.x, f.k)) : []),
  hero(o.hero || 'stand', HX, 6), caption(o.cap),
].filter(Boolean);

const end = () => {
  const mark = iconFrames('logo', 10);
  return [
    text('end-title', 'THE ADVENTURER', 8, 250),
    text('end-sub', 'A SHORT STORY IN BLOCKS', 3, 350),
    text('end-by', 'BY JP BOTHMA · JPBOTHMA.COM', 3, 395, 0.55),
    el('mark', Math.round((W - mark.w) / 2), 470, mark.frames[0], { sig: 'mark', anim: { frames: mark.frames, period: 1.4, phase: 0.6 } }),
  ];
};

// ---------------------------------------------------------------- the script

// t: seconds. mode: 'intro' | 'page' (mosaic) | 'local' (things re-form in
// place). light: points the click light runs out from. theme: switch to it,
// dissolving out from `at`. sound: effects from sound.js, [name, arg] for an
// argument.
const C = [W / 2, H / 2];
const heroAt = [HX + 36, GROUND - 60];
export const CUES = [
  { t: 0, mode: 'intro', sound: ['assemble'], scene: () => [text('title', 'THE ADVENTURER', 12, 250), text('sub', 'A SHORT STORY IN BLOCKS', 3, 390)] },
  { t: 2.3, light: [[W / 2, 290]], sound: ['light'] },
  { t: 4.8, mode: 'page', origin: C, theme: { to: 'dark', at: C }, sound: ['shuffle', 'night'], scene: () => home({ cap: 'EVERYTHING HERE WAS INK AND PAPER.' }) },
  { t: 9.0, sound: ['caption', 'twinkle'], scene: () => home({ hero: 'up', cap: 'BUT SOMETHING OUT THERE KEPT GLITTERING.' }) },
  { t: 13.2, sound: ['caption', ['roll', 2.4]], scene: () => home({ hero: 'stand', die: 'roll', cap: 'SO THE ADVENTURER ROLLED FOR COURAGE.' }) },
  { t: 15.8, light: [[HX + 152, GROUND - 115]], sound: ['land', 'nat20'], scene: () => home({ hero: 'cheer', die: 20, cap: 'NATURAL 20.' }) },
  { t: 18.4, sound: ['caption'], scene: () => home({ hero: 'stand', glitter: true, cap: 'ENERGISE.' }) },
  { t: 19.4, sound: ['energise'], scene: () => [ground(), ringed(), ...stars(GROUND - 40), glitter(900, 150), beam(HX + 6), caption('ENERGISE.')] },
  { t: 21.0, mode: 'page', origin: heroAt, sound: ['shuffle'], scene: () => space({ cap: 'THE SHIP WAS SMALL. THE SKY WAS NOT.' }) },
  { t: 25.0, light: [[390, 330]], sound: ['engage'], scene: () => space({ warp: true, shipX: 470, cap: 'ENGAGE.' }) },
  ...WORLDS.flatMap((w, k) => {
    const t = 27.6 + k * 3.2;
    return [
      { t, mode: 'page', origin: [W, H / 2], sound: ['shuffle', ['arrive', k]], scene: () => atWorld(k, { found: k, gem: true, cap: w.line }) },
      { t: t + 1.9, light: [[slotX(k) + 14, 42]], sound: [['collect', k]], scene: () => atWorld(k, { found: k + 1, cap: w.line }) },
    ];
  }),
  { t: 47.0, mode: 'page', origin: [W, H / 2], sound: ['shuffle', 'growl'], scene: () => lair({ gem: 'big', cap: 'THE LAST COLOUR HAD A DRAGON ON IT.' }) },
  { t: 50.6, sound: ['caption', ['roll', 1.9]], scene: () => lair({ gem: 'big', die: 'roll', cap: 'ROLL FOR INITIATIVE.' }) },
  { t: 52.6, sound: ['land', 'nat1'], scene: () => lair({ gem: 'big', die: 1, cap: 'NATURAL 1.' }) },
  { t: 54.6, sound: ['caption', 'sit'], scene: () => lair({ gem: 'big', hero: 'sit', cap: 'SO THE ADVENTURER SAT DOWN AND TALKED.' }) },
  { t: 58.0, sound: ['caption', 'calm'], scene: () => lair({ gem: 'big', hero: 'sit', dragon: 'calm', cap: 'IT HAD BEEN LONELY FOR A THOUSAND YEARS.' }) },
  { t: 61.6, light: [[slotX(6) + 14, 42]], sound: [['collect', 6], 'light'], scene: () => [...lair({ hero: 'cheer', dragon: 'calm', cap: 'IT GAVE THE LAST COLOUR GLADLY.' }).filter((e) => !e.key.startsWith('slot') && !e.key.startsWith('gem')), ...slots(7)] },
  { t: 64.6, mode: 'page', origin: heroAt, theme: { to: 'light', at: heroAt }, sound: ['shuffle', 'morning', 'dawn'], scene: () => dawn({ cap: 'AND THE COLOURS CAME HOME.' }) },
  { t: 66.4, light: [heroAt, [heroAt[0], heroAt[1] - 40]], sound: ['light', 'bloom'], scene: () => dawn({ hero: 'cheer', flowers: true, cap: 'AND THE COLOURS CAME HOME.' }) },
  { t: 69.6, sound: ['caption'], scene: () => dawn({ hero: 'cheer', flowers: true, cap: 'THE UNKNOWN IS ONLY A PLACE NO ONE HAS WALKED YET.' }) },
  { t: 74.0, mode: 'page', origin: C, sound: ['shuffle', 'end'], scene: end },
];
/** Seconds into the story where the night's drone plays. */
export const NIGHT = [4.8, 64.6];
export const LENGTH = 80;
