import InkScene from './InkScene'
import { PROJECTS, type Project, type LanternState } from '@/data/projects'

/**
 * 三 · The Lanterns — one per gift. Lit means alive in the world,
 * kindling means being built, ember means resting.
 */

function LanternSvg({ state, delay, variant }: { state: LanternState; delay: number; variant: number }) {
  const lit = state === 'lit'
  const kindling = state === 'kindling'

  // three hand-cut silhouettes so the row doesn't read as a stamp sheet
  const bodies = [
    { x: 36, y: 48, w: 48, h: 88, rx: 22 }, // classic
    { x: 43, y: 42, w: 34, h: 98, rx: 16 }, // tall & narrow
    { x: 30, y: 58, w: 60, h: 70, rx: 30 }, // low & round
  ]
  const b = bodies[variant % bodies.length]
  const midY = b.y + b.h / 2

  return (
    <svg viewBox="0 0 120 190" className="w-24 mx-auto lantern" aria-hidden="true">
      {/* glow — warm amber by day, lantern-red by night */}
      {(lit || kindling) && (
        <ellipse
          cx="60" cy={midY + 8} rx="42" ry="48"
          fill="var(--lantern-glow)"
          className={`lantern-glow ${kindling ? 'flame-flicker' : ''}`}
        />
      )}

      {/* hanging cord */}
      <path
        d={`M60,4 C59,${b.y - 30} 61,${b.y - 22} 60,${b.y - 12}`}
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
        d={`M${60 - b.w / 2 + 8},${b.y - 4} L60,${b.y - 14} L${60 + b.w / 2 - 8},${b.y - 4}`}
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
        x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx}
        pathLength={1}
        className="draw"
        fill={lit || kindling ? 'var(--lantern-glow)' : 'none'}
        stroke="var(--ink)"
        strokeWidth="2.5"
        style={{ '--delay': `${delay + 0.3}s` } as React.CSSProperties}
      />
      {/* ribs — the paper's bones */}
      <path
        d={[
          `M${b.x + 2},${b.y + b.h * 0.24} C${b.x + b.w * 0.3},${b.y + b.h * 0.28} ${b.x + b.w * 0.7},${b.y + b.h * 0.28} ${b.x + b.w - 2},${b.y + b.h * 0.24}`,
          `M${b.x},${b.y + b.h * 0.46} C${b.x + b.w * 0.3},${b.y + b.h * 0.5} ${b.x + b.w * 0.7},${b.y + b.h * 0.5} ${b.x + b.w},${b.y + b.h * 0.46}`,
          `M${b.x + 1},${b.y + b.h * 0.68} C${b.x + b.w * 0.3},${b.y + b.h * 0.72} ${b.x + b.w * 0.7},${b.y + b.h * 0.72} ${b.x + b.w - 1},${b.y + b.h * 0.68}`,
          `M${b.x + 4},${b.y + b.h * 0.88} C${b.x + b.w * 0.35},${b.y + b.h * 0.92} ${b.x + b.w * 0.65},${b.y + b.h * 0.92} ${b.x + b.w - 4},${b.y + b.h * 0.88}`,
        ].join(' ')}
        pathLength={1}
        className="draw"
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="1.4"
        strokeLinecap="round"
        style={{ '--delay': `${delay + 0.5}s` } as React.CSSProperties}
      />
      {/* inner flame — a teardrop reaching upward */}
      {(lit || kindling) && (
        <path
          d={`M60,${midY + 12} C54,${midY + 6} 55,${midY - 2} 60,${midY - 10} C65,${midY - 2} 66,${midY + 6} 60,${midY + 12} Z`}
          className={`fill-in ${kindling ? 'flame-flicker' : ''}`}
          fill="var(--vermilion)"
          opacity={lit ? 0.85 : 0.6}
          style={{ '--delay': `${delay + 0.7}s` } as React.CSSProperties}
        />
      )}
      {/* bottom cap + tassel */}
      <path
        d={`M${60 - b.w / 2 + 12},${b.y + b.h + 4} L${60 + b.w / 2 - 12},${b.y + b.h + 4} M60,${b.y + b.h + 8} C59,${b.y + b.h + 16} 61,${b.y + b.h + 22} 60,${b.y + b.h + 30}`}
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
  const delay = 0.2 + index * 0.2
  const label = STATE_LABEL[project.state]

  const inner = (
    <>
      <LanternSvg state={project.state} delay={delay} variant={index} />
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
    'lantern-card fill-in block text-center px-5 pb-6 pt-0 -mt-1 rounded-sm transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]'
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

        {/* the branch they hang from — with a few living twigs */}
        <svg viewBox="0 0 1100 44" aria-hidden="true" className="w-full -mb-3">
          <path
            d="M0,30 C180,18 340,36 520,26 C700,16 900,32 1100,22"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ '--delay': '0.1s' } as React.CSSProperties}
          />
          <path
            d="M212,26 C230,16 244,10 264,8 M700,21 C716,12 728,8 748,8 M962,26 C978,18 988,12 1004,8"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{ '--delay': '0.5s' } as React.CSSProperties}
          />
          <path
            d="M256,12 C262,10 268,9 274,10 M740,10 C746,8 752,8 758,9"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{ '--delay': '0.8s' } as React.CSSProperties}
          />
        </svg>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {PROJECTS.map((p, i) => (
            <LanternCard key={p.id} project={p} index={i} />
          ))}
        </div>
      </div>
    </InkScene>
  )
}
