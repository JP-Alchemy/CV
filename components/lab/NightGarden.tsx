'use client'

import { PROJECTS } from '@/data/projects'

/**
 * The night garden — where "the work" lives. It is always night here.
 * Four lanterns hang from a branch over still water; each is a project
 * from the registry, its glow trembling in the pond below.
 */

const NIGHT = {
  paper: '#11131c',
  deep: '#0b0d14',
  ink: '#e6e1d3',
  inkSoft: '#b3ada0',
  inkFaint: '#8a8577',
  vermilion: '#e05545',
  glow: 'rgba(226, 132, 82, 0.5)',
  water: '#141824',
}

const LANTERN_X = [260, 620, 980, 1300] // viewBox positions
const LANTERN_DROP = [148, 96, 170, 118] // cord lengths — hand-hung, not measured

export default function NightGarden({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="absolute inset-0" style={{ background: NIGHT.paper }}>
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <filter id="garden-bleed" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="garden-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={NIGHT.glow} />
            <stop offset="100%" stopColor="rgba(226,132,82,0)" />
          </radialGradient>
          <linearGradient id="garden-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NIGHT.water} />
            <stop offset="100%" stopColor={NIGHT.deep} />
          </linearGradient>
        </defs>

        {/* the water — lower half, utterly still */}
        <rect x="0" y="520" width="1440" height="380" fill="url(#garden-water)" />
        <g filter="url(#garden-bleed)">
          {/* far bank */}
          <path
            d="M-40,520 C300,512 700,514 1000,518 C1180,521 1340,518 1480,514"
            fill="none" stroke={NIGHT.inkFaint} strokeWidth="2" opacity="0.6"
          />
          {/* stones at the near bank */}
          <path
            d="M60,838 C110,822 190,818 240,834 C264,842 268,856 246,864 C180,884 100,882 62,862 C44,852 44,844 60,838 Z"
            fill={NIGHT.deep} stroke={NIGHT.inkSoft} strokeWidth="2.4" opacity="0.9"
          />
          <path
            d="M300,862 C336,852 388,850 420,860 C438,866 438,876 422,882 C378,894 322,892 300,880 C288,874 290,866 300,862 Z"
            fill={NIGHT.deep} stroke={NIGHT.inkSoft} strokeWidth="2" opacity="0.75"
          />
          {/* reeds */}
          <path
            d="M130,836 C136,800 130,772 138,740 M158,842 C162,810 156,786 164,756 M186,846 C190,818 186,796 192,772"
            fill="none" stroke={NIGHT.inkSoft} strokeWidth="2.4" strokeLinecap="round" opacity="0.7"
          />

          {/* the branch the lanterns hang from — reaching in from above */}
          <path
            d="M1480,60 C1240,96 980,110 720,104 C500,99 320,88 160,64"
            fill="none" stroke={NIGHT.ink} strokeWidth="7" strokeLinecap="round" opacity="0.9"
          />
          <path
            d="M1180,102 C1150,124 1130,150 1122,180 M560,100 C540,124 528,152 524,182 M860,108 C848,128 840,150 838,174"
            fill="none" stroke={NIGHT.inkSoft} strokeWidth="3" strokeLinecap="round" opacity="0.7"
          />
          {/* cords — each lantern truly hangs from the branch */}
          {LANTERN_X.map((x, i) => {
            // branch height at each x, read off the curve by eye
            const branchY = [78, 103, 99, 74][i]
            return (
              <path
                key={i}
                d={`M${x},${branchY} C${x - 2},${branchY + 30} ${x + 2},${LANTERN_DROP[i] - 24} ${x},${LANTERN_DROP[i] + 4}`}
                fill="none"
                stroke={NIGHT.inkSoft}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.8"
              />
            )
          })}
        </g>

        {/* lantern reflections — trembling smears of light in the water */}
        {LANTERN_X.map((x, i) => (
          <g key={i} className="garden-reflection" style={{ animationDelay: `${i * 1.3}s` }}>
            <ellipse cx={x} cy={640 + i * 18} rx="46" ry="90" fill="url(#garden-glow)" opacity="0.5" />
            <ellipse cx={x} cy={640 + i * 18} rx="10" ry="52" fill="url(#garden-glow)" opacity="0.7" />
          </g>
        ))}
      </svg>

      {/* the lanterns themselves — HTML, so they are real links */}
      {PROJECTS.map((p, i) => {
        const x = (LANTERN_X[i] / 1440) * 100
        const drop = (LANTERN_DROP[i] / 900) * 100
        const inner = (
          <span className="garden-lantern-inner">
            <svg viewBox="0 0 90 150" className="w-[74px]" aria-hidden="true">
              <path d={`M45,0 C44,${10 + i * 2} 46,${16 + i} 45,26`} fill="none" stroke={NIGHT.inkSoft} strokeWidth="2" />
              <ellipse cx="45" cy="74" rx="40" ry="44" fill="url(#garden-glow)" />
              <path d="M31,34 L45,24 L59,34" fill="none" stroke={NIGHT.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="24" y="38" width="42" height="66" rx="19" fill="rgba(226,132,82,0.32)" stroke={NIGHT.ink} strokeWidth="2.4" />
              <path d="M26,60 C36,63 54,63 64,60 M26,82 C36,85 54,85 64,82" fill="none" stroke={NIGHT.inkSoft} strokeWidth="1.4" />
              <path d="M45,96 C41,90 42,84 45,79 C48,84 49,90 45,96 Z" fill={NIGHT.vermilion} opacity="0.9" />
              <path d="M34,108 L56,108 M45,112 C44,120 46,126 45,132" fill="none" stroke={NIGHT.inkSoft} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="garden-label">
              <span className="garden-name">{p.name}</span>
              <span className="garden-story">{p.story}</span>
            </span>
          </span>
        )
        return p.href ? (
          <a
            key={p.id}
            href={p.href}
            target={p.external ? '_blank' : undefined}
            rel={p.external ? 'noopener noreferrer' : undefined}
            className="garden-lantern"
            style={{ left: `${x}%`, top: `${drop}%` }}
          >
            {inner}
          </a>
        ) : (
          <span key={p.id} className="garden-lantern" style={{ left: `${x}%`, top: `${drop}%` }}>
            {inner}
          </span>
        )
      })}

      {/* the way back */}
      <button
        type="button"
        onClick={onReturn}
        className="absolute top-6 left-6 text-sm tracking-[0.2em] uppercase lab-link"
        style={{
          color: NIGHT.inkSoft,
          fontFamily: 'var(--font-zen-sans), system-ui, sans-serif',
        }}
      >
        ← the cliff
      </button>

      <p
        className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] italic select-none"
        style={{ color: NIGHT.inkFaint, fontFamily: 'var(--font-zen-serif), Georgia, serif' }}
        aria-hidden="true"
      >
        it is always night here — the lanterns see to it
      </p>
    </div>
  )
}
