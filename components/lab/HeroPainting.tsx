'use client'

/**
 * The hero painting — a cliff, a cherry tree, one whole day.
 * Pure SVG driven entirely by the CSS variables the time engine writes;
 * this component renders once and the day turns without React.
 */

const CSS = (v: string) => `var(${v})` as string

export default function HeroPainting() {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    >
      {/* ── sky wash ── */}
      <rect x="0" y="0" width="1440" height="900" fill={CSS('--sky')} />

      {/* a broad tonal wash where sky meets ridge — sumi before sen */}
      <defs>
        <radialGradient id="lab-sky-wash" cx="50%" cy="70%" r="75%">
          <stop offset="0%" stopColor={CSS('--ink')} stopOpacity="0.05" />
          <stop offset="60%" stopColor={CSS('--ink')} stopOpacity="0.02" />
          <stop offset="100%" stopColor={CSS('--ink')} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lab-sun-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={CSS('--sun-c')} stopOpacity="0.95" />
          <stop offset="70%" stopColor={CSS('--sun-c')} stopOpacity="0.85" />
          <stop offset="100%" stopColor={CSS('--sun-c')} stopOpacity="0" />
        </radialGradient>
        {/* the lab's own ink-bleed — strokes must not look vector-perfect */}
        <filter id="lab-bleed" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.05" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* one blossom, reused across every cluster */}
        <g id="lab-blossom">
          <circle cx="0" cy="-4.6" r="3.4" />
          <circle cx="4.4" cy="-1.4" r="3.4" />
          <circle cx="2.7" cy="3.8" r="3.4" />
          <circle cx="-2.7" cy="3.8" r="3.4" />
          <circle cx="-4.4" cy="-1.4" r="3.4" />
        </g>
      </defs>
      <ellipse cx="720" cy="640" rx="700" ry="240" fill="url(#lab-sky-wash)" />

      {/* ── the sun — carried across the sky by scroll ── */}
      <g
        style={{
          transform: `translate(${CSS('--sun-x')}, ${CSS('--sun-y')})`,
        }}
      >
        <circle
          cx="0" cy="0" r="46"
          fill="url(#lab-sun-core)"
          style={{
            opacity: CSS('--sun-o'),
            transform: `scale(${CSS('--sun-scale')})`,
          }}
        />
      </g>

      {/* ── the moon — rises when the sun is gone ── */}
      <g style={{ transform: `translate(${CSS('--moon-x')}, ${CSS('--moon-y')})` }}>
        <path
          d="M 14 -30 A 32 32 0 1 0 14 30 A 25 25 0 1 1 14 -30 Z"
          fill={CSS('--ink')}
          style={{ opacity: CSS('--moon-o') }}
        />
      </g>

      {/* ── distant ridges — three low washes; the lower third stays ma ── */}
      <g style={{ opacity: CSS('--wash-o') }}>
        <path
          d="M-40,650 C160,585 320,570 480,608 C620,640 760,632 900,600 C1050,566 1250,582 1480,618 L1480,910 L-40,910 Z"
          fill={CSS('--ink-soft')}
          opacity="0.1"
        />
        <path
          d="M-40,708 C140,662 300,648 460,672 C640,700 820,690 980,662 C1140,634 1320,650 1480,682 L1480,910 L-40,910 Z"
          fill={CSS('--ink-soft')}
          opacity="0.14"
        />
        <path
          d="M-40,772 C180,738 380,728 560,748 C760,770 960,762 1140,738 C1280,720 1400,728 1480,742 L1480,910 L-40,910 Z"
          fill={CSS('--ink-soft')}
          opacity="0.18"
        />
      </g>

      {/* ── clouds — long ink washes that drift in ── */}
      <g
        style={{
          opacity: CSS('--cloud-o'),
          transform: `translateX(${CSS('--cloud-x')})`,
        }}
      >
        <path
          d="M120,210 C240,196 420,192 560,206 C640,213 700,208 780,198 C820,193 860,196 880,204 C860,216 800,224 720,226 C560,230 300,228 180,222 C140,220 120,216 120,210 Z"
          fill={CSS('--ink-soft')}
          opacity="0.16"
        />
        <path
          d="M420,300 C560,288 760,286 900,298 C980,304 1060,300 1140,292 C1180,288 1210,292 1224,298 C1200,310 1120,318 1020,320 C860,324 600,320 500,312 C450,308 424,304 420,300 Z"
          fill={CSS('--ink-soft')}
          opacity="0.12"
        />
      </g>

      {/* ══ the cliff and the cherry tree — the painting's heart ══ */}
      <g filter="url(#lab-bleed)">

        {/* cliff face, entering from the right in dry-brush strokes */}
        <path
          d="M1440,470 C1330,478 1240,500 1180,540 C1130,574 1105,620 1092,680 C1080,736 1076,800 1078,900 L1440,900 Z"
          fill={CSS('--ink-soft')}
          opacity="0.14"
        />
        <path
          d="M1440,462 C1338,470 1252,490 1188,532 C1136,566 1110,614 1096,676 C1084,732 1080,798 1082,900"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* dry-brush texture strokes on the face */}
        <path
          d="M1200,560 C1236,548 1280,540 1330,538 M1150,640 C1190,624 1250,612 1310,608 M1120,740 C1160,722 1220,710 1290,706"
          fill="none"
          stroke={CSS('--ink-soft')}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* grasses at the cliff's lip, growing with the morning */}
        <g
          style={{
            transform: `scaleY(${CSS('--grass')})`,
            transformOrigin: '1210px 505px',
          }}
        >
          <path
            d="M1156,508 C1152,488 1156,470 1150,452 M1176,506 C1178,486 1172,470 1178,450 M1196,504 C1192,482 1198,466 1192,444 M1258,500 C1262,480 1256,464 1262,444 M1282,502 C1278,484 1284,468 1278,450"
            fill="none"
            stroke={CSS('--ink-soft')}
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.75"
          />
        </g>

        {/* the trunk — leaning out over the void */}
        <path
          d="M1206,516 C1176,488 1140,462 1094,446 C1044,428 990,424 934,432"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="13"
          strokeLinecap="round"
          opacity="0.95"
        />
        {/* the trunk thins and splits */}
        <path
          d="M934,432 C880,440 830,430 786,404 C756,386 734,362 722,334"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.95"
        />
        {/* upper branch reaching for the sky */}
        <path
          d="M950,430 C920,404 900,372 894,336 C890,310 894,286 906,264"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="5.5"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* long low branch drifting left */}
        <path
          d="M1010,438 C960,462 900,478 832,484 C776,489 720,486 668,474"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* twigs — the whisper ends */}
        <path
          d="M722,334 C712,318 706,300 704,282 M740,352 C724,344 710,342 694,344 M894,336 C882,328 868,324 852,324 M906,264 C902,250 904,236 910,224 M668,474 C654,468 640,466 624,468 M700,480 C692,492 688,504 690,518 M832,484 C826,496 824,508 826,522"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="2.8"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* ── blossom clusters — each opens at its own moment ── */}
        {(
          [
            [706, 276, 0.0, 1.15],
            [694, 344, 0.08, 0.95],
            [740, 352, 0.16, 1.05],
            [852, 322, 0.05, 1.2],
            [908, 226, 0.12, 1.0],
            [894, 300, 0.2, 0.9],
            [626, 466, 0.1, 1.1],
            [692, 516, 0.22, 0.95],
            [826, 520, 0.15, 1.0],
            [770, 402, 0.25, 0.85],
          ] as [number, number, number, number][]
        ).map(([x, y, st, sc], i) => (
          <g
            key={i}
            style={{
              transform: `translate(${x}px, ${y}px) scale(calc(clamp(0, (var(--bloom) - ${st}) / ${(1 - st).toFixed(2)}, 1) * ${sc}))`,
            }}
          >
            <use href="#lab-blossom" fill="#dfa8b6" opacity="0.85" />
            <circle cx="0" cy="0" r="1.8" fill={CSS('--sun-c')} opacity="0.8" />
          </g>
        ))}
      </g>
    </svg>
  )
}
