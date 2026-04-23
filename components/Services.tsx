'use client'

import { useInView } from '@/hooks/useInView'
import { ArrowRight } from 'lucide-react'

const SERVICES = [
  {
    id: 'interactive-3d',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path d="M12 2L3 7l9 5 9-5-9-5z" strokeLinejoin="round" />
        <path d="M3 12l9 5 9-5M3 17l9 5 9-5" strokeLinejoin="round" />
      </svg>
    ),
    name: 'Interactive Experiences & 3D',
    description:
      'Real-time 3D, WebGL and immersive interfaces that help people feel the thing before they understand it. React-Three-Fiber, Unity, Unreal — web or native.',
    rate: 'From €130 / hr',
    tag: 'Favourite work',
  },
  {
    id: 'data-viz',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 15l4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="15" r="1.5" fill="currentColor" />
        <circle cx="11" cy="10" r="1.5" fill="currentColor" />
        <circle cx="14" cy="13" r="1.5" fill="currentColor" />
        <circle cx="19" cy="6" r="1.5" fill="currentColor" />
      </svg>
    ),
    name: 'Data Visualisation & Dashboards',
    description:
      'Turning complex data into something legible, useful, and quietly beautiful. Operational dashboards, sustainability reporting, and custom visual tooling — built for the people who actually use them.',
    rate: 'From €120 / hr',
    tag: null,
  },
  {
    id: 'sustainability',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        <path d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10" strokeLinecap="round" />
      </svg>
    ),
    name: 'Sustainability Engineering',
    description:
      'Software for the circular economy: digital product passports, lifecycle data pipelines, and measured-impact tooling. ESPR-aligned, pragmatic, and built to last.',
    rate: 'From €120 / hr',
    tag: null,
  },
  {
    id: 'fractional-cto',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
        <path d="M19 8l2-2M19 12h2" strokeLinecap="round" />
      </svg>
    ),
    name: 'Fractional CTO',
    description:
      'Part-time technical leadership for small teams building something they care about. Strategy, architecture, hiring, and honest counsel — without the overhead of a full-time hire.',
    rate: 'From €130 / hr',
    tag: null,
  },
]

function scrollToContact() {
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
}

export default function Services() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.05 })

  return (
    <section
      id="services"
      ref={ref}
      className="py-28 lg:py-36 bg-bg-surface"
      aria-labelledby="services-heading"
    >
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className={`mb-16 animate-on-scroll ${inView ? 'in-view' : ''}`}>
          <p className="text-accent text-sm font-sans font-medium tracking-[0.12em] uppercase mb-4">
            Services
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h2
              id="services-heading"
              className="font-serif text-4xl lg:text-5xl text-[#f0f0f5] leading-[1.1] tracking-tight max-w-md"
            >
              How I can help.
            </h2>
            <p className="text-[#9b9bb8] font-sans text-sm max-w-xs leading-relaxed">
              Project work, retainers, and long engagements &mdash; for teams who&rsquo;d rather do
              a few things well than many things loudly.
            </p>
          </div>
        </div>

        {/* Service cards grid */}
        <div className={`grid sm:grid-cols-2 gap-4 stagger-children ${inView ? '' : ''}`}>
          {SERVICES.map(({ id, icon, name, description, rate, tag }, i) => (
            <div
              key={id}
              className={`animate-on-scroll group relative p-7 rounded-xl border border-border-subtle bg-bg hover:border-accent/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_40px_rgba(78,205,196,0.07)] ${
                inView ? 'in-view' : ''
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Tag */}
              {tag && (
                <span className="absolute top-5 right-5 text-[10px] font-sans font-semibold tracking-widest uppercase text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              )}

              {/* Icon */}
              <div className="text-accent mb-5 w-10 h-10 rounded-lg bg-accent/8 border border-accent/15 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                {icon}
              </div>

              {/* Content */}
              <h3 className="font-sans font-semibold text-[#f0f0f5] text-base mb-2">{name}</h3>
              <p className="text-[#9b9bb8] font-sans text-sm leading-relaxed mb-6">{description}</p>

              {/* Footer row */}
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm font-medium text-[#6a6a85]">{rate}</span>

                {/* CTA on hover */}
                <button
                  onClick={scrollToContact}
                  className="flex items-center gap-1.5 text-sm font-sans font-medium text-accent opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded px-1"
                  aria-label={`Enquire about ${name}`}
                >
                  Let&rsquo;s talk
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Accent line on hover */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div
          className={`mt-10 text-center animate-on-scroll ${inView ? 'in-view' : ''}`}
          style={{ transitionDelay: '400ms' }}
        >
          <p className="text-[#6a6a85] font-sans text-sm">
            Not sure which fits? Send a message &mdash; most engagements start with a short, quiet conversation.
          </p>
          <p className="mt-3 text-[#6a6a85] font-sans text-xs">
            Also available on request: OT/ICS security assessments and red-team exercises for energy and industrial clients.
          </p>
        </div>
      </div>
    </section>
  )
}
