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

      {/* ── distant ridges, three washes deep ── */}
      <g style={{ opacity: CSS('--wash-o') }}>
        <path
          d="M-40,560 C160,470 320,450 480,505 C620,552 760,540 900,495 C1050,447 1250,470 1480,520 L1480,910 L-40,910 Z"
          fill={CSS('--ink-soft')}
          opacity="0.13"
        />
        <path
          d="M-40,620 C140,560 300,540 460,575 C640,614 820,600 980,560 C1140,522 1320,545 1480,590 L1480,910 L-40,910 Z"
          fill={CSS('--ink-soft')}
          opacity="0.2"
        />
        <path
          d="M-40,690 C180,645 380,632 560,660 C760,690 960,678 1140,645 C1280,621 1400,632 1480,650 L1480,910 L-40,910 Z"
          fill={CSS('--ink-soft')}
          opacity="0.3"
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
    </svg>
  )
}
