import InkScene from './InkScene'

/**
 * 五 · The Tea House — where work is discussed, quietly.
 */

const OFFERINGS = [
  {
    name: 'Interactive Experiences & 3D',
    line: 'Real-time 3D, WebGL, and immersive interfaces — felt before they are understood.',
    rate: 'from €130/hr',
  },
  {
    name: 'Data Visualisation & Dashboards',
    line: 'Complex data made legible, useful, and quietly beautiful.',
    rate: 'from €120/hr',
  },
  {
    name: 'AI Agents & Workflow Automation',
    line: 'Orchestrated agents that take the repetitive, leaving people the meaningful.',
    rate: 'from €140/hr',
  },
  {
    name: 'Sustainability Engineering',
    line: 'Digital product passports, lifecycle data, measured impact. Built to last.',
    rate: 'from €120/hr',
  },
  {
    name: 'Fractional CTO',
    line: 'Part-time technical leadership with honest counsel and a steady hand.',
    rate: 'from €130/hr',
  },
]

export default function TeaHouse() {
  return (
    <InkScene
      as="section"
      id="teahouse"
      ariaLabelledby="teahouse-heading"
      className="relative py-28 md:py-36"
      threshold={0.12}
    >
      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-5 gap-14 md:gap-10 items-start">

        {/* The tea house drawing */}
        <svg
          viewBox="0 0 320 300"
          aria-hidden="true"
          className="md:col-span-2 w-full max-w-[300px] mx-auto md:sticky md:top-28"
        >
          {/* roof */}
          <path
            d="M28,120 C90,52 230,52 292,120"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{ '--delay': '0.2s' } as React.CSSProperties}
          />
          <path
            d="M52,118 C104,66 216,66 268,118"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{ '--delay': '0.5s' } as React.CSSProperties}
          />
          {/* posts */}
          <path
            d="M72,122 C73,166 71,208 72,248 M248,122 C249,166 247,208 248,248"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ '--delay': '0.7s' } as React.CSSProperties}
          />
          {/* door */}
          <path
            d="M140,248 C140,210 140,190 141,172 L179,172 C180,196 180,220 180,248"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ '--delay': '0.95s' } as React.CSSProperties}
          />
          {/* noren curtain */}
          <path
            d="M110,140 C130,146 190,146 210,140 M132,140 L132,158 M160,142 L160,160 M188,140 L188,158"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--vermilion)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ '--delay': '1.2s' } as React.CSSProperties}
          />
          {/* ground */}
          <path
            d="M36,250 C120,244 200,254 284,248"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{ '--delay': '1.35s' } as React.CSSProperties}
          />
          {/* hanging lantern by the door */}
          <path
            d="M228,132 C228,140 228,146 228,150"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="1.6"
            style={{ '--delay': '1.5s' } as React.CSSProperties}
          />
          <ellipse cx="228" cy="160" rx="9" ry="11"
            className="fill-in"
            fill="var(--vermilion-glow)"
            stroke="var(--ink-soft)"
            strokeWidth="1.6"
            style={{ '--delay': '1.65s' } as React.CSSProperties}
          />
        </svg>

        {/* The offerings */}
        <div className="md:col-span-3">
          <p
            className="fill-in text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: 'var(--vermilion)', '--delay': '0.05s' } as React.CSSProperties}
          >
            五 · The Tea House
          </p>
          <h2
            id="teahouse-heading"
            className="zen-serif text-4xl md:text-5xl tracking-tight mb-4 fill-in"
            style={{ color: 'var(--ink)', '--delay': '0.15s' } as React.CSSProperties}
          >
            Come in, let&rsquo;s talk work.
          </h2>
          <p
            className="fill-in text-base font-light leading-relaxed mb-10 max-w-lg"
            style={{ color: 'var(--ink-soft)', '--delay': '0.3s' } as React.CSSProperties}
          >
            By day I lead sustainability technology at Interfood. Around that,
            I take a small number of engagements — project work, retainers, and
            long partnerships.
          </p>

          <ul>
            {OFFERINGS.map((o, i) => (
              <li
                key={o.name}
                className="fill-in py-5 border-t last:border-b"
                style={{ borderColor: 'var(--line)', '--delay': `${0.4 + i * 0.12}s` } as React.CSSProperties}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="zen-serif text-lg" style={{ color: 'var(--ink)' }}>{o.name}</h3>
                  <span className="text-xs shrink-0" style={{ color: 'var(--ink-faint)' }}>{o.rate}</span>
                </div>
                <p className="text-sm font-light mt-1 max-w-md" style={{ color: 'var(--ink-soft)' }}>
                  {o.line}
                </p>
              </li>
            ))}
          </ul>

          <p
            className="fill-in mt-6 text-xs leading-relaxed"
            style={{ color: 'var(--ink-faint)', '--delay': '1.1s' } as React.CSSProperties}
          >
            Also poured on request: OT/ICS security assessments for energy and
            industrial clients.
          </p>
        </div>
      </div>
    </InkScene>
  )
}
