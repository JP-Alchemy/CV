import InkScene from './InkScene'
import Seal from './Seal'
import ThemeToggle from './ThemeToggle'

/**
 * 一 · The Summit — mist parts, mountains draw themselves,
 * a name is brushed onto the paper.
 */
export default function Summit() {
  return (
    <InkScene
      as="section"
      id="top"
      ariaLabelledby="summit-name"
      className="relative min-h-screen flex flex-col overflow-hidden"
      threshold={0.05}
    >
      {/* The sky — sun/moon hangs here */}
      <div className="absolute top-20 right-6 sm:right-12 md:right-24 z-10">
        <ThemeToggle />
      </div>

      {/* Mountains */}
      <svg
        viewBox="0 0 1200 430"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        className="absolute bottom-0 left-0 w-full h-[46vh] min-h-[280px]"
      >
        {/* far ridge */}
        <path
          d="M0,300 C150,215 260,185 380,240 C480,288 560,268 660,220 C760,172 845,190 925,230 C1010,272 1100,258 1200,215"
          pathLength={1}
          className="draw"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ '--delay': '0.9s' } as React.CSSProperties}
        />
        {/* mid ridge */}
        <path
          d="M0,345 C130,305 240,255 360,292 C480,328 600,300 700,262 C805,222 920,252 1030,300 C1090,325 1150,332 1200,322"
          pathLength={1}
          className="draw"
          fill="none"
          stroke="var(--ink-soft)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ '--delay': '0.5s' } as React.CSSProperties}
        />
        {/* the near peak */}
        <path
          d="M310,395 C400,268 465,175 560,118 C578,107 596,107 614,119 C706,175 768,262 862,395"
          pathLength={1}
          className="draw"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="3.5"
          strokeLinecap="round"
          style={{ '--delay': '0.1s' } as React.CSSProperties}
        />
        {/* snow line — a small interrupted stroke near the summit */}
        <path
          d="M540,150 C556,143 570,146 583,152 C596,146 610,144 624,151"
          pathLength={1}
          className="draw"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ '--delay': '1.4s' } as React.CSSProperties}
        />
        {/* ground whisper */}
        <path
          d="M0,412 C200,406 420,416 640,410 C860,404 1040,414 1200,408"
          pathLength={1}
          className="draw"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ '--delay': '1.2s' } as React.CSSProperties}
        />
      </svg>

      {/* Drifting mist over the ridges */}
      <div className="mist-band left-[-10%] right-[30%] bottom-[18vh] h-16" style={{ '--mist-dur': '75s' } as React.CSSProperties} aria-hidden="true" />
      <div className="mist-band left-[20%] right-[-10%] bottom-[9vh] h-20" style={{ '--mist-dur': '95s' } as React.CSSProperties} aria-hidden="true" />

      {/* The name, brushed onto the paper */}
      <div className="relative flex-1 flex items-center max-w-5xl mx-auto px-6 w-full pt-24 pb-[38vh]">
        <div>
          <p
            className="fill-in text-xs tracking-[0.35em] uppercase mb-6"
            style={{ color: 'var(--ink-faint)', '--delay': '0.2s' } as React.CSSProperties}
          >
            一 · The Summit
          </p>

          <div className="flex items-start gap-5">
            <h1
              id="summit-name"
              className="zen-serif text-6xl sm:text-7xl md:text-8xl leading-none tracking-tight fill-in"
              style={{ color: 'var(--ink)', '--delay': '0.5s' } as React.CSSProperties}
            >
              JP Bothma
            </h1>
            <div className="fill-in mt-2" style={{ '--delay': '1.1s' } as React.CSSProperties}>
              <Seal size={40} />
            </div>
          </div>

          <p
            className="fill-in mt-7 text-lg md:text-xl max-w-md leading-relaxed font-light"
            style={{ color: 'var(--ink-soft)', '--delay': '0.9s' } as React.CSSProperties}
          >
            Creative technologist. Thoughtful software for work that matters —
            interactive worlds, legible data, sustainable systems.
          </p>
        </div>
      </div>

      {/* Scroll hint — a stroke inviting descent */}
      <a
        href="#path"
        aria-label="Descend to the path"
        className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 group"
      >
        <span
          className="fill-in text-[10px] tracking-[0.3em] uppercase"
          style={{ color: 'var(--ink-faint)', '--delay': '1.8s' } as React.CSSProperties}
        >
          descend
        </span>
        <svg width="14" height="44" viewBox="0 0 14 44" aria-hidden="true">
          <path
            d="M7,2 C6,14 8,22 7,42"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{ '--delay': '2s' } as React.CSSProperties}
          />
          <path
            d="M2,35 C4,38 6,40 7,42 C8,40 10,38 12,35"
            pathLength={1}
            className="draw group-hover:translate-y-0.5 transition-transform"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{ '--delay': '2.3s' } as React.CSSProperties}
          />
        </svg>
      </a>
    </InkScene>
  )
}
