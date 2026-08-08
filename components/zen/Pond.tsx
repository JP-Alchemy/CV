import InkScene from './InkScene'
import { NOW } from '@/data/now'

/**
 * 四 · The Pond — still water, slow koi, and what I'm up to now.
 * (SVG baseline; the R3F pond replaces the water when it lands.)
 */

function Koi({ color, orbit, duration, delay, flip = false }: {
  color: string
  orbit: number
  duration: number
  delay: number
  flip?: boolean
}) {
  return (
    <g
      className="koi-orbit"
      style={{
        '--koi-dur': `${duration}s`,
        animationDelay: `${delay}s`,
        animationDirection: flip ? 'reverse' : 'normal',
      } as React.CSSProperties}
    >
      <g transform={`translate(${orbit}, 0) ${flip ? 'scale(1,-1)' : ''}`}>
        {/* body — a brushed teardrop */}
        <path
          d="M0,0 C10,-7 24,-6 32,0 C24,6 10,7 0,0 Z"
          fill={color}
          opacity="0.85"
        />
        {/* tail */}
        <path
          d="M30,0 C38,-6 44,-7 50,-3 C46,0 46,0 50,3 C44,7 38,6 30,0 Z"
          fill={color}
          opacity="0.6"
        />
        {/* eye-side fin */}
        <path d="M10,4 C12,9 16,11 21,10 C18,6 14,4 10,4 Z" fill={color} opacity="0.5" />
      </g>
    </g>
  )
}

export default function Pond() {
  return (
    <InkScene
      as="section"
      id="pond"
      ariaLabelledby="pond-heading"
      className="relative py-28 md:py-36"
      threshold={0.15}
    >
      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-14 md:gap-10 items-center">

        {/* The pond */}
        <div className="relative">
          <svg viewBox="0 0 420 300" aria-hidden="true" className="w-full">
            {/* bank */}
            <path
              d="M30,150 C30,95 110,60 210,60 C310,60 390,95 390,150 C390,205 310,240 210,240 C110,240 30,205 30,150 Z"
              pathLength={1}
              className="draw"
              fill="var(--pond)"
              stroke="var(--ink-soft)"
              strokeWidth="2.5"
              style={{ '--delay': '0.2s' } as React.CSSProperties}
            />
            {/* ripples */}
            <g style={{ transformOrigin: '210px 150px' }}>
              <ellipse className="ripple" style={{ '--delay': '0s', transformOrigin: '210px 150px' } as React.CSSProperties}
                cx="210" cy="150" rx="130" ry="62" fill="none" stroke="var(--ink-faint)" strokeWidth="1.2" />
              <ellipse className="ripple" style={{ '--delay': '2.3s', transformOrigin: '210px 150px' } as React.CSSProperties}
                cx="210" cy="150" rx="130" ry="62" fill="none" stroke="var(--ink-faint)" strokeWidth="1.2" />
              <ellipse className="ripple" style={{ '--delay': '4.6s', transformOrigin: '210px 150px' } as React.CSSProperties}
                cx="210" cy="150" rx="130" ry="62" fill="none" stroke="var(--ink-faint)" strokeWidth="1.2" />
            </g>
            {/* koi, orbiting slowly */}
            <g style={{ transformOrigin: '210px 150px' }} transform="translate(210,150)">
              <g style={{ transformOrigin: '0px 0px' }}>
                <Koi color="var(--vermilion)" orbit={78} duration={40} delay={0} />
              </g>
              <g style={{ transformOrigin: '0px 0px' }} transform="scale(-1,1)">
                <Koi color="var(--ink)" orbit={52} duration={52} delay={-18} flip />
              </g>
            </g>
            {/* reeds at the near bank */}
            <path
              d="M76,222 C80,200 76,182 82,164 M92,230 C94,210 90,196 96,178 M64,212 C66,196 62,184 66,170"
              pathLength={1}
              className="draw"
              fill="none"
              stroke="var(--ink-soft)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ '--delay': '0.9s' } as React.CSSProperties}
            />
          </svg>
        </div>

        {/* What I'm up to */}
        <div>
          <p
            className="fill-in text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: 'var(--vermilion)', '--delay': '0.1s' } as React.CSSProperties}
          >
            四 · The Pond
          </p>
          <h2
            id="pond-heading"
            className="zen-serif text-4xl md:text-5xl tracking-tight mb-8 fill-in"
            style={{ color: 'var(--ink)', '--delay': '0.2s' } as React.CSSProperties}
          >
            What I&rsquo;m up to.
          </h2>

          <ol className="space-y-6">
            {NOW.map((note, i) => (
              <li
                key={`${note.date}-${i}`}
                className="fill-in"
                style={{
                  opacity: 1 - i * 0.22,
                  '--delay': `${0.35 + i * 0.2}s`,
                } as React.CSSProperties}
              >
                <span
                  className="block text-[11px] tracking-[0.2em] uppercase mb-1"
                  style={{ color: 'var(--vermilion)' }}
                >
                  {note.date}
                </span>
                <p className="text-base md:text-lg font-light leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                  {note.text}
                </p>
              </li>
            ))}
          </ol>

          <p
            className="fill-in mt-8 text-xs italic"
            style={{ color: 'var(--ink-faint)', '--delay': '1s' } as React.CSSProperties}
          >
            Older notes drift into the mist.
          </p>
        </div>
      </div>
    </InkScene>
  )
}
