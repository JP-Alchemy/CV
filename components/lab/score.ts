/**
 * The score of hours — every timed value of the living painting lives
 * here, keyed on T ∈ [0,1] (one scroll = one day). Components consume
 * CSS variables; only this file knows when the sun sets.
 *
 * Hours, roughly:
 *   0.00–0.20 dawn · 0.20–0.45 morning→noon · 0.45–0.65 afternoon
 *   0.65–0.85 dusk · 0.85–1.00 night
 */

export type Stop<T> = [number, T]

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function keyframes(stops: Stop<number>[], t: number): number {
  if (t <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, v0] = stops[i - 1]
      const [t1, v1] = stops[i]
      return lerp(v0, v1, (t - t0) / (t1 - t0))
    }
  }
  return stops[stops.length - 1][1]
}

// ─── Color interpolation (hex, in linear-ish sRGB — fine for washes) ────────
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function colorKeyframes(stops: Stop<string>[], t: number): string {
  if (t <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1]
      const [t1, c1] = stops[i]
      const k = (t - t0) / (t1 - t0)
      const a = hexToRgb(c0)
      const b = hexToRgb(c1)
      const m = a.map((v, j) => Math.round(lerp(v, b[j], k)))
      return `rgb(${m[0]}, ${m[1]}, ${m[2]})`
    }
  }
  return stops[stops.length - 1][1]
}

// ─── The score ──────────────────────────────────────────────────────────────

/** sky wash behind everything */
const SKY: Stop<string>[] = [
  [0.0, '#f3ead8'], // dawn — pale warm paper
  [0.22, '#f4efe4'], // morning — the site's day paper
  [0.45, '#f2efe6'], // noon — clearest
  [0.62, '#efe3d2'], // afternoon warmth
  [0.75, '#e8cdb4'], // golden hour
  [0.85, '#3a3548'], // last light → violet ink
  [0.93, '#151726'], // night
  [1.0, '#11131c'], // the site's night paper
]

/** the paper the painting sits on (page background) */
const PAPER: Stop<string>[] = [
  [0.0, '#f2ecdd'],
  [0.3, '#f4efe4'],
  [0.7, '#efe6d6'],
  [0.82, '#4a4152'],
  [0.9, '#171928'],
  [1.0, '#11131c'],
]

/** ink darkness for strokes and text */
const INK: Stop<string>[] = [
  [0.0, '#2a2620'],
  [0.5, '#211f1b'],
  [0.8, '#3a3428'],
  [0.86, '#cfc9b8'], // strokes go pale as the world darkens
  [1.0, '#e6e1d3'],
]

/** softer ink for secondary strokes */
const INK_SOFT: Stop<string>[] = [
  [0.0, '#575044'],
  [0.5, '#4c473e'],
  [0.8, '#5d5546'],
  [0.86, '#a59f8e'],
  [1.0, '#b3ada0'],
]

/** the sun (then the moon takes the sky) */
const SUN_X: Stop<number>[] = [
  [0.0, 16], // % of width — rises in the east (left)
  [0.45, 46],
  [0.85, 84], // sets in the west behind the ridge
]
const SUN_Y: Stop<number>[] = [
  [0.0, 62], // % of height — low at dawn
  [0.2, 34],
  [0.45, 16], // noon apex
  [0.7, 38],
  [0.85, 66], // swallowed by the ridge
]
const SUN_SCALE: Stop<number>[] = [
  [0.0, 1],
  [0.6, 1],
  [0.78, 1.55], // the sun swells at golden hour
  [0.85, 1.7],
]
const SUN_OPACITY: Stop<number>[] = [
  [0.0, 0.55],
  [0.12, 0.8],
  [0.45, 0.9],
  [0.8, 0.95],
  [0.86, 0], // gone below the ridge
]
const SUN_COLOR: Stop<string>[] = [
  [0.0, '#d98a54'], // pale dawn gold
  [0.25, '#c1392b'], // the site's vermilion, honest daylight
  [0.7, '#c14a2b'],
  [0.85, '#a63a2b'], // deep setting red
]

/** the moon rises with the night */
const MOON_OPACITY: Stop<number>[] = [
  [0.84, 0],
  [0.92, 0.85],
  [1.0, 0.95],
]
const MOON_X: Stop<number>[] = [
  [0.84, 22],
  [1.0, 30],
]
const MOON_Y: Stop<number>[] = [
  [0.84, 40],
  [1.0, 22],
]

/** ridge washes fade with distance and hour */
const WASH_OPACITY: Stop<number>[] = [
  [0.0, 0.5],
  [0.2, 0.85],
  [0.7, 0.9],
  [0.88, 0.55],
  [1.0, 0.65],
]

/** clouds drift in through the afternoon */
const CLOUD_X: Stop<number>[] = [
  [0.0, -18], // % translate — waiting off-stage left
  [0.45, -6],
  [0.7, 6],
  [1.0, 14],
]
const CLOUD_OPACITY: Stop<number>[] = [
  [0.0, 0],
  [0.42, 0],
  [0.55, 0.5],
  [0.75, 0.7],
  [0.88, 0.35],
  [1.0, 0.45],
]

/** the tree blossoms through the morning, closes at night */
const BLOOM: Stop<number>[] = [
  [0.0, 0],
  [0.18, 0.05],
  [0.3, 0.55],
  [0.45, 1],
  [0.85, 1],
  [0.97, 0.35], // blossoms close to buds under the moon
]

/** grasses grow on the cliff edge */
const GRASS: Stop<number>[] = [
  [0.0, 0],
  [0.25, 0.1],
  [0.5, 1],
]

/** how deep into night we are — drives fireflies, reflections, glow */
const NIGHT: Stop<number>[] = [
  [0.78, 0],
  [0.88, 0.7],
  [1.0, 1],
]

/** golden-hour glow strength for the atmosphere layer */
const GLOW: Stop<number>[] = [
  [0.6, 0],
  [0.78, 0.85],
  [0.86, 0],
]

/** petal fall density multiplier across the day */
const PETALS: Stop<number>[] = [
  [0.0, 0.15],
  [0.3, 0.5],
  [0.55, 1],
  [0.8, 0.8],
  [1.0, 0.35],
]

export interface DayValues {
  t: number
  sky: string
  paper: string
  ink: string
  inkSoft: string
  sunX: number
  sunY: number
  sunScale: number
  sunOpacity: number
  sunColor: string
  moonOpacity: number
  moonX: number
  moonY: number
  washOpacity: number
  cloudX: number
  cloudOpacity: number
  bloom: number
  grass: number
  night: number
  glow: number
  petals: number
}

export function scoreAt(t: number): DayValues {
  return {
    t,
    sky: colorKeyframes(SKY, t),
    paper: colorKeyframes(PAPER, t),
    ink: colorKeyframes(INK, t),
    inkSoft: colorKeyframes(INK_SOFT, t),
    sunX: keyframes(SUN_X, t),
    sunY: keyframes(SUN_Y, t),
    sunScale: keyframes(SUN_SCALE, t),
    sunOpacity: keyframes(SUN_OPACITY, t),
    sunColor: colorKeyframes(SUN_COLOR, t),
    moonOpacity: keyframes(MOON_OPACITY, t),
    moonX: keyframes(MOON_X, t),
    moonY: keyframes(MOON_Y, t),
    washOpacity: keyframes(WASH_OPACITY, t),
    cloudX: keyframes(CLOUD_X, t),
    cloudOpacity: keyframes(CLOUD_OPACITY, t),
    bloom: keyframes(BLOOM, t),
    grass: keyframes(GRASS, t),
    night: keyframes(NIGHT, t),
    glow: keyframes(GLOW, t),
    petals: keyframes(PETALS, t),
  }
}

/** the hour band each headline belongs to */
export const HEADLINE_HOURS = {
  signature: { from: 0.02, to: 0.24 },
  work: { from: 0.3, to: 0.58 },
  teahouse: { from: 0.62, to: 0.84 },
  hello: { from: 0.88, to: 1.0 },
} as const
