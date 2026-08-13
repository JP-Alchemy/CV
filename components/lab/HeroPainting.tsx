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
        {/* wobble only — for washes and fine twigs */}
        <filter id="lab-bleed" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.05" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* the dry brush — wobble plus streaks of paper showing through
            where the bristles ran out of ink (kasure / flying white) */}
        <filter id="lab-brush" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.05" numOctaves="2" seed="11" result="disp" />
          <feDisplacementMap in="SourceGraphic" in2="disp" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.28" numOctaves="3" seed="7" result="streak" />
          <feComposite in="wobbly" in2="streak" operator="arithmetic" k1="0.95" k2="0.38" k3="0" k4="0" />
        </filter>
        {/* the wet edge — a faint halo where ink bled into the paper */}
        <filter id="lab-halo" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="9" />
        </filter>

        {/* trunk ink is not one tone — dark heart, worn grey flanks */}
        <linearGradient id="lab-trunk-ink" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0%" stopColor={CSS('--ink')} stopOpacity="0.98" />
          <stop offset="45%" stopColor={CSS('--ink')} stopOpacity="0.82" />
          <stop offset="75%" stopColor={CSS('--ink-soft')} stopOpacity="0.88" />
          <stop offset="100%" stopColor={CSS('--ink')} stopOpacity="0.95" />
        </linearGradient>
        {/* ridge washes fade downward into the mist */}
        <linearGradient id="lab-ridge-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CSS('--ink-soft')} stopOpacity="0.5" />
          <stop offset="45%" stopColor={CSS('--ink-soft')} stopOpacity="0.16" />
          <stop offset="100%" stopColor={CSS('--ink-soft')} stopOpacity="0" />
        </linearGradient>

        {/* an open blossom — outlined petals around dark stamens */}
        <g id="lab-flower">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0" cy="-5.2" rx="3.1" ry="4.6"
              transform={`rotate(${a})`}
              fill="#f5efe3"
              stroke="#3a3428"
              strokeWidth="0.8"
              opacity="0.95"
            />
          ))}
          <circle cx="0" cy="0" r="1.5" fill="#8a4a3a" opacity="0.9" />
          {[20, 95, 170, 250, 320].map((a) => (
            <line
              key={a}
              x1="0" y1="0" x2="0" y2="-3.4"
              transform={`rotate(${a})`}
              stroke="#3a3428"
              strokeWidth="0.7"
              opacity="0.8"
            />
          ))}
        </g>
        {/* a closed bud on its calyx */}
        <g id="lab-bud">
          <circle cx="0" cy="-1" r="2.4" fill="#cf94a2" stroke="#3a3428" strokeWidth="0.7" opacity="0.9" />
          <path d="M-1.6,0.8 L0,3.4 L1.6,0.8" fill="none" stroke="#3a3428" strokeWidth="0.8" opacity="0.8" />
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

      {/* ── distant ridges — washes darkest at the crest, fading down
             into the paper like ink into mist ── */}
      <g style={{ opacity: CSS('--wash-o') }} filter="url(#lab-bleed)">
        <path
          d="M-40,650 C160,585 320,570 480,608 C620,640 760,632 900,600 C1050,566 1250,582 1480,618 L1480,910 L-40,910 Z"
          fill="url(#lab-ridge-fade)"
          opacity="0.55"
        />
        <path
          d="M-40,650 C160,585 320,570 480,608 C620,640 760,632 900,600 C1050,566 1250,582 1480,618"
          fill="none" stroke={CSS('--ink-soft')} strokeWidth="2" strokeLinecap="round" opacity="0.28"
        />
        <path
          d="M-40,708 C140,662 300,648 460,672 C640,700 820,690 980,662 C1140,634 1320,650 1480,682 L1480,910 L-40,910 Z"
          fill="url(#lab-ridge-fade)"
          opacity="0.75"
        />
        <path
          d="M-40,708 C140,662 300,648 460,672 C640,700 820,690 980,662 C1140,634 1320,650 1480,682"
          fill="none" stroke={CSS('--ink-soft')} strokeWidth="2.4" strokeLinecap="round" opacity="0.32"
        />
        <path
          d="M-40,772 C180,738 380,728 560,748 C760,770 960,762 1140,738 C1280,720 1400,728 1480,742 L1480,910 L-40,910 Z"
          fill="url(#lab-ridge-fade)"
          opacity="0.95"
        />
        <path
          d="M-40,772 C180,738 380,728 560,748 C760,770 960,762 1140,738 C1280,720 1400,728 1480,742"
          fill="none" stroke={CSS('--ink-soft')} strokeWidth="2.6" strokeLinecap="round" opacity="0.35"
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

        {/* the wet halo — ink bled a breath beyond the trunk's edge */}
        <g filter="url(#lab-halo)" opacity="0.14">
          <path
            d="M1214,530 C1180,494 1142,466 1096,450 C1046,432 992,428 936,436 C880,444 830,434 788,408 C758,390 736,364 724,336 L712,340 C726,372 750,400 784,420 C830,446 888,452 940,446 C994,440 1044,444 1090,460 C1134,476 1170,502 1198,540 Z"
            fill={CSS('--ink')}
          />
        </g>

        {/* the trunk — one filled stroke, thick at the rock, thinning as
            it reaches; a real brush loads and spends its ink */}
        <g filter="url(#lab-brush)">
          <path
            d="M1216,536
               C1182,494 1144,464 1098,447
               C1050,430 996,426 938,433
               C884,440 834,431 790,405
               C760,387 738,361 726,334
               L713,340
               C727,372 752,400 786,420
               C826,443 876,452 928,449
               C950,448 970,448 990,450
               C1036,454 1078,464 1114,482
               C1146,500 1172,520 1194,548 Z"
            fill="url(#lab-trunk-ink)"
          />
          {/* a knot where the trunk turns */}
          <path
            d="M934,432 C946,438 958,440 972,438 C962,446 948,448 936,444 Z"
            fill={CSS('--ink')}
            opacity="0.85"
          />

          {/* upper branch — tapered lift toward the sky */}
          <path
            d="M954,434 C926,408 906,376 898,338 C893,312 897,287 908,265
               L900,261 C887,285 883,312 888,340 C896,380 916,412 946,440 Z"
            fill={CSS('--ink')}
            opacity="0.92"
          />
          {/* long low branch — drifting left, spending its ink */}
          <path
            d="M1014,440 C964,464 904,480 834,487 C778,492 722,489 668,476
               L669,470 C722,481 776,484 830,479 C898,472 956,456 1006,432 Z"
            fill={CSS('--ink')}
            opacity="0.9"
          />
        </g>

        {/* kasure — streaks of paper showing through the loaded stroke */}
        <path
          d="M1180,506 C1140,478 1096,458 1048,448 M1150,510 C1114,488 1076,472 1034,462 M990,438 C950,442 910,440 872,430"
          fill="none"
          stroke={CSS('--sky')}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* twigs — the whisper ends, still drawn with a fine point */}
        <path
          d="M722,334 C712,318 706,300 704,282 M740,352 C724,344 710,342 694,344 M894,336 C882,328 868,324 852,324 M906,264 C902,250 904,236 910,224 M668,474 C654,468 640,466 624,468 M700,480 C692,492 688,504 690,518 M832,484 C826,496 824,508 826,522 M786,410 C778,424 774,438 776,454"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* hairline twig tips — pressure almost gone */}
        <path
          d="M704,282 C702,272 703,262 706,252 M852,324 C844,320 836,318 826,318 M910,224 C910,216 912,208 916,200 M624,468 C616,466 608,466 600,468 M690,518 C688,526 688,534 690,542"
          fill="none"
          stroke={CSS('--ink')}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* ── blossom clusters — open flowers and buds, each waking at
               its own moment of the morning ── */}
        {(
          [
            [706, 276, 0.0, 1.15, true],
            [694, 344, 0.08, 0.95, false],
            [740, 352, 0.16, 1.05, true],
            [852, 322, 0.05, 1.2, true],
            [908, 226, 0.12, 1.0, true],
            [894, 300, 0.2, 0.9, false],
            [626, 466, 0.1, 1.1, true],
            [692, 516, 0.22, 0.95, false],
            [826, 520, 0.15, 1.0, true],
            [770, 402, 0.25, 0.85, false],
          ] as [number, number, number, number, boolean][]
        ).map(([x, y, st, sc, open], i) => (
          <g
            key={i}
            style={{
              transform: `translate(${x}px, ${y}px) scale(calc(clamp(0, (var(--bloom) - ${st}) / ${(1 - st).toFixed(2)}, 1) * ${sc}))`,
            }}
          >
            {/* a short stem ties the cluster to its twig */}
            <path d="M0,0 C3,4 5,8 5,13" fill="none" stroke={CSS('--ink')} strokeWidth="1.1" opacity="0.7" />
            {open ? (
              <>
                <use href="#lab-flower" />
                <g transform="translate(9, 12) scale(0.8) rotate(30)"><use href="#lab-bud" /></g>
              </>
            ) : (
              <>
                <g transform="translate(0, 2)"><use href="#lab-bud" /></g>
                <g transform="translate(8, 9) scale(0.75) rotate(-25)"><use href="#lab-bud" /></g>
              </>
            )}
          </g>
        ))}
      </g>
    </svg>
  )
}
