import InkScene from './InkScene'
import { PROJECTS, type Project, type LanternState } from '@/data/projects'

/**
 * 三 · The Lanterns — one per gift. Lit means alive in the world,
 * kindling means being built, ember means resting.
 */

function LanternSvg({ state, delay }: { state: LanternState; delay: number }) {
  const lit = state === 'lit'
  const kindling = state === 'kindling'

  return (
    <svg viewBox="0 0 120 190" className="w-24 mx-auto lantern" aria-hidden="true">
      {/* glow */}
      {(lit || kindling) && (
        <ellipse
          cx="60" cy="102" rx="42" ry="48"
          fill="var(--vermilion-glow)"
          className={`lantern-glow ${kindling ? 'flame-flicker' : ''}`}
        />
      )}

      {/* hanging cord */}
      <path
        d="M60,4 C59,14 61,22 60,32"
        pathLength={1}
        className="draw"
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ '--delay': `${delay}s` } as React.CSSProperties}
      />
      {/* top cap */}
      <path
        d="M44,42 L60,30 L76,42"
        pathLength={1}
        className="draw"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ '--delay': `${delay + 0.15}s` } as React.CSSProperties}
      />
      {/* body */}
      <rect
        x="36" y="48" width="48" height="88" rx="22"
        pathLength={1}
        className="draw"
        fill={lit || kindling ? 'var(--vermilion-glow)' : 'none'}
        stroke="var(--ink)"
        strokeWidth="2.5"
        style={{ '--delay': `${delay + 0.3}s` } as React.CSSProperties}
      />
      {/* ribs */}
      <path
        d="M38,76 C50,80 70,80 82,76 M38,104 C50,108 70,108 82,104"
        pathLength={1}
        className="draw"
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="1.6"
        strokeLinecap="round"
        style={{ '--delay': `${delay + 0.5}s` } as React.CSSProperties}
      />
      {/* inner flame */}
      {(lit || kindling) && (
        <path
          d="M60,100 C55,94 56,87 60,82 C64,87 65,94 60,100 Z"
          className={`fill-in ${kindling ? 'flame-flicker' : ''}`}
          fill="var(--vermilion)"
          opacity={lit ? 0.85 : 0.6}
          style={{ '--delay': `${delay + 0.7}s` } as React.CSSProperties}
        />
      )}
      {/* bottom cap + tassel */}
      <path
        d="M48,140 L72,140 M60,144 C59,152 61,158 60,166"
        pathLength={1}
        className="draw"
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ '--delay': `${delay + 0.6}s` } as React.CSSProperties}
      />
    </svg>
  )
}

const STATE_LABEL: Record<LanternState, string | null> = {
  lit: null,
  kindling: 'in the making',
  ember: 'resting',
}

function LanternCard({ project, index }: { project: Project; index: number }) {
  const delay = 0.2 + index * 0.25
  const label = STATE_LABEL[project.state]

  const inner = (
    <>
      <LanternSvg state={project.state} delay={delay} />
      <h3
        className="zen-serif text-xl mt-5 mb-2 tracking-tight"
        style={{ color: 'var(--ink)' }}
      >
        {project.name}
      </h3>
      <p className="text-sm leading-relaxed font-light" style={{ color: 'var(--ink-soft)' }}>
        {project.story}
      </p>
      <p className="mt-3 text-xs tracking-[0.15em] uppercase" style={{ color: 'var(--vermilion)' }}>
        {label ?? (project.external ? 'visit →' : 'enter →')}
      </p>
    </>
  )

  const cardClass =
    'fill-in block text-center px-5 py-6 rounded-sm transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]'
  const style = { '--delay': `${delay}s` } as React.CSSProperties

  if (project.href) {
    return (
      <a
        href={project.href}
        target={project.external ? '_blank' : undefined}
        rel={project.external ? 'noopener noreferrer' : undefined}
        className={cardClass}
        style={style}
      >
        {inner}
      </a>
    )
  }
  return (
    <div className={cardClass} style={style}>
      {inner}
    </div>
  )
}

export default function Lanterns() {
  return (
    <InkScene
      as="section"
      id="lanterns"
      ariaLabelledby="lanterns-heading"
      className="relative py-28 md:py-36"
      threshold={0.1}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-6">
          <p
            className="fill-in text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: 'var(--vermilion)', '--delay': '0.05s' } as React.CSSProperties}
          >
            三 · The Lanterns
          </p>
          <h2
            id="lanterns-heading"
            className="zen-serif text-4xl md:text-5xl tracking-tight mb-4 fill-in"
            style={{ color: 'var(--ink)', '--delay': '0.15s' } as React.CSSProperties}
          >
            Small gifts, hung along the path.
          </h2>
          <p
            className="fill-in text-base font-light leading-relaxed"
            style={{ color: 'var(--ink-soft)', '--delay': '0.3s' } as React.CSSProperties}
          >
            Things I build and hand to small communities — free to use, take,
            and wander off with. A lit lantern is alive in the world.
          </p>
        </div>

        {/* the branch they hang from */}
        <svg viewBox="0 0 1100 30" aria-hidden="true" className="w-full mb-2">
          <path
            d="M0,18 C180,8 340,24 520,15 C700,6 900,20 1100,12"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ '--delay': '0.1s' } as React.CSSProperties}
          />
        </svg>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PROJECTS.map((p, i) => (
            <LanternCard key={p.id} project={p} index={i} />
          ))}
        </div>
      </div>
    </InkScene>
  )
}
