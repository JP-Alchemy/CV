'use client'

import { useInView } from '@/hooks/useInView'

const TRUST_SIGNALS = [
  {
    id: 'craft',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M12 2l2.4 5 5.6.8-4 4 1 5.6L12 15l-5 2.4 1-5.6-4-4 5.6-.8L12 2z" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Interactive by craft',
    body: 'A decade of building 3D, real-time and data-dense interfaces — from WebGL to game engines. Interaction design is not an afterthought; it is the work.',
  },
  {
    id: 'full-stack',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" />
        <path d="M7 10l3 3-3 3M13 13h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'End-to-end, end-to-care',
    body: 'Schematic to cloud dashboard — embedded, firmware, backend, and interface. No handoffs, no silos, and no loose ends.',
  },
  {
    id: 'sa-eu-bridge',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M17 8l4 4-4 4M7 8l-4 4 4 4M14 4l-4 16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'SA ↔ EU perspective',
    body: 'Active in both markets. Helping European teams reach African talent, and African teams meet EU standards — quietly, and with care.',
  },
]

const PROCESS_STEPS = [
  {
    n: '01',
    label: 'Listen',
    body: 'A short, honest conversation about the problem — not the solution. No RFPs, no pitch theatre.',
  },
  {
    n: '02',
    label: 'Shape',
    body: 'Small, sharp milestones. Async-first communication, prototypes over slides, and risks surfaced early.',
  },
  {
    n: '03',
    label: 'Hand over',
    body: 'Documentation, knowledge transfer, and a clear path to independence — or to an ongoing, lightweight partnership.',
  },
]

export default function Credibility() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      id="credibility"
      ref={ref}
      className="py-24 lg:py-32 bg-bg-surface border-y border-border-subtle"
      aria-labelledby="credibility-heading"
    >
      <div className="max-w-6xl mx-auto px-6">

        {/* Trust signals */}
        <div
          className={`grid md:grid-cols-3 gap-6 animate-on-scroll ${inView ? 'in-view' : ''}`}
        >
          {TRUST_SIGNALS.map(({ id, icon, title, body }) => (
            <div
              key={id}
              className="flex gap-4"
            >
              <div className="shrink-0 mt-0.5 w-8 h-8 rounded bg-accent/8 border border-accent/15 flex items-center justify-center text-accent">
                {icon}
              </div>
              <div>
                <h3 className="font-sans font-semibold text-[#f0f0f5] text-sm mb-1">{title}</h3>
                <p className="font-sans text-[#9b9bb8] text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div
          className="border-t border-border-subtle my-14"
          aria-hidden="true"
        />

        {/* How I work */}
        <div className={`animate-on-scroll ${inView ? 'in-view' : ''}`} style={{ transitionDelay: '150ms' }}>
          <p className="text-[#6a6a85] text-xs font-sans tracking-[0.1em] uppercase mb-8" id="credibility-heading">
            How I work
          </p>

          <div className="grid md:grid-cols-3 gap-0 relative">
            {/* Connecting line — desktop */}
            <div
              className="hidden md:block absolute top-4 left-[calc(33.33%+16px)] right-[calc(33.33%+16px)] h-[1px] bg-gradient-to-r from-accent/30 via-accent/15 to-accent/30"
              aria-hidden="true"
            />

            {PROCESS_STEPS.map(({ n, label, body }, i) => (
              <div
                key={n}
                className={`animate-on-scroll flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-6 pb-8 md:pb-0 ${
                  inView ? 'in-view' : ''
                }`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  {/* Step number */}
                  <span className="w-8 h-8 rounded-full border border-accent/30 bg-accent/8 flex items-center justify-center font-sans text-xs font-semibold text-accent relative z-10">
                    {n}
                  </span>
                  {/* Mobile connecting line */}
                  {i < 2 && (
                    <div
                      className="md:hidden w-8 h-[1px] bg-accent/20"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <p className="font-sans font-semibold text-[#f0f0f5] text-sm mb-1.5">{label}</p>
                <p className="font-sans text-[#9b9bb8] text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
