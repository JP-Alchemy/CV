'use client'

import { useInView } from '@/hooks/useInView'
import { ArrowRight } from 'lucide-react'

const PRODUCTS = [
  {
    id: 'interfarm',
    status: 'Live',
    statusColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    dotColor: 'bg-emerald-400',
    name: 'Interfarm',
    badge: 'At Interfood',
    description:
      'A sustainability platform used by Interfood customers and their dairy suppliers to plan, fund, and track on-farm interventions that reduce CO\u2082 emissions together. Turning scope-3 from a spreadsheet into a shared conversation.',
    signals: ['On-farm CO\u2082 reduction', 'Customer \u2194 supplier collaboration', 'Intervention workflow'],
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className="w-full h-full" strokeWidth={1}>
        {/* Rolling hills + sun + leaf */}
        <circle cx="34" cy="14" r="4" strokeOpacity={0.6} />
        <path d="M4 34c4-4 8-4 12 0s8 4 12 0 8-4 12 0 4 0 4 0" strokeOpacity={0.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 40c4-3 8-3 12 0s8 3 12 0 8-3 12 0 4 0 4 0" strokeOpacity={0.25} strokeLinecap="round" strokeLinejoin="round" />
        {/* Leaf */}
        <path d="M18 26c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z" strokeOpacity={0.5} />
        <path d="M22 30c2-3 4-5 7-6" strokeOpacity={0.6} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'nezen',
    status: 'Live',
    statusColor: 'text-accent bg-accent/10 border-accent/20',
    dotColor: 'bg-accent',
    name: 'nezen.io',
    badge: 'Personal',
    description:
      'A daily zen story app \u2014 one koan each morning by email or WhatsApp, with space to reflect and a growing archive. Built as a quiet corner of the internet for slowing down.',
    signals: ['One koan a day', 'Email & WhatsApp', 'WebGL ink canvas'],
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className="w-full h-full" strokeWidth={2}>
        {/* Ensō — a single imperfect brushstroke with a gap at the top */}
        <path
          d="M 21 8 A 16 16 0 1 0 32 10"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'dpp',
    status: 'Research phase',
    statusColor: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    dotColor: 'bg-sky-400',
    name: 'Digital Product Passport Infrastructure',
    badge: null,
    description:
      'Hardware and software for telling the story of a physical thing &mdash; where it came from, what it&rsquo;s made of, where it&rsquo;s going next. Built for the circular economy, aligned with the incoming EU Digital Product Passport.',
    signals: ['ESPR regulation-aligned', 'Hardware + cloud stack', 'SA manufacturing partners'],
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className="w-full h-full" strokeWidth={1}>
        {/* Supply chain / globe illustration */}
        <circle cx="24" cy="24" r="16" strokeOpacity={0.25} />
        <circle cx="24" cy="24" r="16" strokeDasharray="3 6" strokeOpacity={0.15} />
        <path d="M8 24h32M24 8c-4 4-6 9-6 16s2 12 6 16M24 8c4 4 6 9 6 16s-2 12-6 16" strokeOpacity={0.5} strokeLinecap="round" />
        {/* Nodes */}
        <circle cx="24" cy="12" r="2.5" fill="currentColor" fillOpacity={0.6} stroke="none" />
        <circle cx="36" cy="24" r="2.5" fill="currentColor" fillOpacity={0.6} stroke="none" />
        <circle cx="24" cy="36" r="2.5" fill="currentColor" fillOpacity={0.6} stroke="none" />
        <circle cx="12" cy="24" r="2.5" fill="currentColor" fillOpacity={0.6} stroke="none" />
        <circle cx="24" cy="24" r="3" fill="currentColor" fillOpacity={0.8} stroke="none" />
      </svg>
    ),
  },
]

function scrollToContact() {
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
}

export default function Building() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.08 })

  return (
    <section
      id="building"
      ref={ref}
      className="py-28 lg:py-36 relative overflow-hidden"
      aria-labelledby="building-heading"
    >
      {/* Background accent */}
      <div
        className="absolute top-0 right-0 w-1/2 h-full pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 80% 40%, rgba(78,205,196,0.04) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className={`mb-4 animate-on-scroll ${inView ? 'in-view' : ''}`}>
          <p className="text-accent text-sm font-sans font-medium tracking-[0.12em] uppercase mb-4">
            Products
          </p>
          <h2
            id="building-heading"
            className="font-serif text-4xl lg:text-5xl text-[#f0f0f5] leading-[1.1] tracking-tight max-w-lg mb-4"
          >
            What I&rsquo;m building.
          </h2>
          <p className="text-[#9b9bb8] font-sans text-base max-w-xl leading-relaxed">
            The work I&rsquo;m currently putting my time into &mdash; some at Interfood, some on the
            side. Both are sustainability-shaped, and both are open to thoughtful partners.
          </p>
        </div>

        {/* Product cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {PRODUCTS.map(({ id, status, statusColor, dotColor, name, badge, description, signals, icon }, i) => (
            <div
              key={id}
              className={`animate-on-scroll group relative flex flex-col p-7 rounded-xl border border-border-subtle bg-bg-surface hover:border-accent/20 transition-all duration-300 ${
                inView ? 'in-view' : ''
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {/* Status badge */}
              <div className="flex items-center gap-3 mb-6">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-1 rounded-full border ${statusColor}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
                  {status}
                </span>
                {badge && (
                  <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-[#6a6a85] border border-border-subtle px-2 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </div>

              {/* Icon */}
              <div
                className="w-16 h-16 mb-5 text-accent opacity-60 group-hover:opacity-90 transition-opacity"
                aria-hidden="true"
              >
                {icon}
              </div>

              {/* Content */}
              <h3 className="font-sans font-semibold text-[#f0f0f5] text-lg mb-3">{name}</h3>
              <p className="text-[#9b9bb8] font-sans text-sm leading-relaxed mb-6 flex-grow">{description}</p>

              {/* Signals */}
              <ul className="flex flex-wrap gap-2 mb-6" aria-label="Key features">
                {signals.map((s) => (
                  <li
                    key={s}
                    className="text-xs font-sans text-[#6a6a85] border border-border-subtle px-2.5 py-1 rounded-full"
                  >
                    {s}
                  </li>
                ))}
              </ul>

              {/* Divider */}
              <div className="border-t border-border-subtle pt-5">
                <p className="text-[#6a6a85] font-sans text-xs leading-relaxed">
                  Interested in early access or design partnership? I&rsquo;d like to hear from you.
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA block */}
        <div
          className={`mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 rounded-xl border border-dashed border-accent/20 bg-accent/[0.03] animate-on-scroll ${
            inView ? 'in-view' : ''
          }`}
          style={{ transitionDelay: '280ms' }}
        >
          <div className="flex-grow">
            <p className="font-sans font-medium text-[#f0f0f5] text-sm mb-1">
              Quietly looking for design partners.
            </p>
            <p className="font-sans text-[#6a6a85] text-sm">
              If you&rsquo;re working in sustainability, circular economy, or energy infrastructure &mdash; I&rsquo;d love to talk.
            </p>
          </div>
          <button
            onClick={scrollToContact}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 text-sm font-sans font-semibold text-accent border border-accent/40 rounded hover:bg-accent/10 hover:border-accent/70 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Register interest
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  )
}
