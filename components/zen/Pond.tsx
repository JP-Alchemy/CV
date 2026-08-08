import InkScene from './InkScene'
import PondWater from './pond3d/PondWater'
import { NOW } from '@/data/now'

/**
 * 四 · The Pond — living water (R3F ripple shader + koi) with an SVG
 * fallback for reduced motion, missing WebGL, and while loading.
 */

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
          <PondWater />
          <p
            className="mt-3 text-center text-[11px] italic select-none"
            style={{ color: 'var(--ink-faint)' }}
            aria-hidden="true"
          >
            stir the water · press to call the koi
          </p>
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
