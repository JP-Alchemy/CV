'use client'

import { useInView } from '@/hooks/useInView'

const SKILLS = [
  {
    label: 'Interactive & 3D',
    sub: 'WebGL · React-Three-Fiber · Unity · Unreal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M12 2L3 7l9 5 9-5-9-5z" strokeLinejoin="round" />
        <path d="M3 12l9 5 9-5M3 17l9 5 9-5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Data Visualisation',
    sub: 'Making complex systems legible',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 15l4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="15" r="1" fill="currentColor" />
        <circle cx="11" cy="10" r="1" fill="currentColor" />
        <circle cx="14" cy="13" r="1" fill="currentColor" />
        <circle cx="19" cy="6" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Sustainability',
    sub: 'Circular systems · Digital product passports · Measured impact',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        <path d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Human-Centred Craft',
    sub: 'Full-stack · UX · thoughtful architecture',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function About() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      id="about"
      ref={ref}
      className="py-28 lg:py-36 relative"
      aria-labelledby="about-heading"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 bg-grid-subtle bg-grid opacity-100 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left — text */}
          <div
            className={`animate-on-scroll ${inView ? 'in-view' : ''}`}
          >
            <p className="text-accent text-sm font-sans font-medium tracking-[0.12em] uppercase mb-4">
              The intersection
            </p>
            <h2
              id="about-heading"
              className="font-serif text-4xl lg:text-5xl text-[#f0f0f5] leading-[1.1] tracking-tight mb-6"
            >
              Where creativity meets impact.
            </h2>

            <div className="space-y-4 text-[#9b9bb8] font-sans text-base leading-relaxed">
              <p>
                I am a South African creative technologist based in Leiden &mdash; working where
                interactive experiences, data visualisation, and sustainability-minded engineering
                meet.
              </p>
              <p>
                I am less interested in building the newest thing and more interested in building the
                right thing. Creativity is a tool; craft is a discipline; impact is the point.
              </p>
              <p>
                Much of my work is making complex systems &mdash; dairy supply chains, energy data,
                product lifecycles, industrial infrastructure &mdash; legible and felt, so the people
                inside them can make better decisions.
              </p>
              <p className="text-[#f0f0f5] border-l-2 border-accent pl-4 py-0.5 italic font-light">
                &ldquo;It&rsquo;s not about the best technology. It&rsquo;s about the most thoughtful
                use of it &mdash; in service of work that actually matters.&rdquo;
              </p>
            </div>
          </div>

          {/* Right — skill grid */}
          <div
            className={`animate-on-scroll stagger-children ${inView ? 'in-view' : ''}`}
            style={{ transitionDelay: '150ms' }}
          >
            <p className="text-[#6a6a85] text-xs font-sans tracking-[0.1em] uppercase mb-6">
              Capabilities
            </p>
            <div className="grid grid-cols-2 gap-3">
              {SKILLS.map(({ label, sub, icon }) => (
                <div
                  key={label}
                  className="animate-on-scroll group p-5 rounded-lg border border-border-subtle bg-bg-surface hover:border-accent/30 hover:bg-bg-elevated transition-all"
                >
                  <div className="text-accent mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
                    {icon}
                  </div>
                  <p className="font-sans font-semibold text-sm text-[#f0f0f5] mb-1">{label}</p>
                  <p className="font-sans text-xs text-[#6a6a85] leading-snug">{sub}</p>
                </div>
              ))}
            </div>

            {/* Intersection formula */}
            <div className="mt-4 p-4 rounded-lg border border-dashed border-accent/20 bg-accent/[0.04]">
              <p className="text-center font-sans text-xs tracking-wider text-[#6a6a85] uppercase">
                Creativity&thinsp;&plus;&thinsp;Craft&thinsp;&plus;&thinsp;Sustainability
              </p>
              <p className="text-center font-serif text-base text-accent mt-1">
                = quiet, considered impact.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
