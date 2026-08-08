import InkScene from './InkScene'

/**
 * 二 · The Path — the story, told in a few strokes,
 * while the path winds between pines.
 */
export default function Path() {
  return (
    <InkScene
      as="section"
      id="path"
      ariaLabelledby="path-heading"
      className="relative py-28 md:py-40"
      threshold={0.15}
    >
      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-5 gap-12 md:gap-8 items-start">

        {/* The winding path & pines */}
        <svg
          viewBox="0 0 260 560"
          aria-hidden="true"
          className="hidden md:block md:col-span-2 w-full max-w-[260px] mx-auto"
        >
          <defs>
            <radialGradient id="path-wash" cx="40%" cy="25%" r="70%">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.08" />
              <stop offset="60%" stopColor="var(--ink)" stopOpacity="0.03" />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse
            cx="100" cy="150" rx="130" ry="180"
            fill="url(#path-wash)"
            className="fill-in"
            style={{ '--delay': '0.4s' } as React.CSSProperties}
          />
          {/* the path itself */}
          <path
            d="M150,10 C110,90 190,150 150,230 C110,310 60,340 95,430 C115,485 90,530 70,552"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="1"
            style={{ '--delay': '0.2s' } as React.CSSProperties}
          />
          {/* stepping stones */}
          {[
            [138, 80], [162, 150], [138, 240], [108, 320], [92, 400], [96, 470],
          ].map(([cx, cy], i) => (
            <ellipse
              key={i}
              cx={cx} cy={cy} rx="7" ry="3.5"
              className="fill-in"
              fill="var(--ink-faint)"
              opacity="0.55"
              style={{ '--delay': `${0.6 + i * 0.18}s` } as React.CSSProperties}
            />
          ))}

          {/* a pine, leaning in */}
          <g>
            <path
              d="M40,180 C48,150 44,120 60,92 C68,78 80,70 96,66"
              pathLength={1}
              className="draw"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ '--delay': '0.7s' } as React.CSSProperties}
            />
            <path
              d="M60,92 C74,90 86,94 100,102 M70,74 C82,70 94,72 108,80 M92,66 C104,58 118,56 132,62"
              pathLength={1}
              className="draw"
              fill="none"
              stroke="var(--ink-soft)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ '--delay': '1.1s' } as React.CSSProperties}
            />
            {/* needle tufts */}
            <path
              d="M96,98 C104,94 114,94 122,97 M104,76 C112,72 122,72 130,76 M126,58 C134,54 144,54 152,58"
              pathLength={1}
              className="draw"
              fill="none"
              stroke="var(--ink-faint)"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ '--delay': '1.5s' } as React.CSSProperties}
            />
          </g>

          {/* a second, distant pine */}
          <g opacity="0.6">
            <path
              d="M218,420 C214,398 218,378 210,358 C205,346 196,338 184,334"
              pathLength={1}
              className="draw"
              fill="none"
              stroke="var(--ink-soft)"
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{ '--delay': '1.3s' } as React.CSSProperties}
            />
            <path
              d="M210,358 C200,354 190,354 180,358 M206,342 C196,336 186,336 176,340"
              pathLength={1}
              className="draw"
              fill="none"
              stroke="var(--ink-faint)"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ '--delay': '1.7s' } as React.CSSProperties}
            />
          </g>
        </svg>

        {/* The story, in strokes */}
        <div className="md:col-span-3 max-w-xl">
          <p
            className="fill-in text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: 'var(--vermilion)', '--delay': '0.1s' } as React.CSSProperties}
          >
            二 · The Path
          </p>
          <h2
            id="path-heading"
            className="zen-serif text-4xl md:text-5xl tracking-tight mb-10 fill-in"
            style={{ color: 'var(--ink)', '--delay': '0.25s' } as React.CSSProperties}
          >
            Where creativity meets impact.
          </h2>

          <div className="space-y-6 text-base md:text-lg leading-relaxed font-light">
            <p className="fill-in" style={{ color: 'var(--ink-soft)', '--delay': '0.45s' } as React.CSSProperties}>
              I am a South African creative technologist living in Leiden — working
              where interactive experiences, data visualisation, and
              sustainability-minded engineering meet.
            </p>
            <p className="fill-in" style={{ color: 'var(--ink-soft)', '--delay': '0.65s' } as React.CSSProperties}>
              I am less interested in building the newest thing than the right
              thing. Creativity is a tool; craft is a discipline; impact is the
              point.
            </p>
            <p className="fill-in" style={{ color: 'var(--ink-soft)', '--delay': '0.85s' } as React.CSSProperties}>
              Lately that means AI agents and orchestrated workflows that quietly
              take care of the repetitive — so people keep the parts that need a
              human: the judgement, the care, the creative leap.
            </p>
            <blockquote
              className="fill-in border-l-2 pl-5 py-1 zen-serif text-lg md:text-xl italic"
              style={{
                color: 'var(--ink)',
                borderColor: 'var(--vermilion)',
                '--delay': '0.55s',
              } as React.CSSProperties}
            >
              It&rsquo;s not about the best technology. It&rsquo;s about the most
              thoughtful use of it.
            </blockquote>
          </div>
        </div>
      </div>
    </InkScene>
  )
}
