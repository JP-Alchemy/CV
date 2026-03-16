'use client'

import { useInView } from '@/hooks/useInView'

const SKILLS = [
  {
    label: 'Software',
    sub: 'Full-stack · AI integration · Architecture',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M9 12h6M9 8h3M9 16h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Hardware',
    sub: 'Embedded · IoT · Sensor networks',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <rect x="4" y="7" width="16" height="10" rx="1" />
        <path d="M8 7V5M12 7V5M16 7V5M8 17v2M12 17v2M16 17v2M4 12H2M22 12h-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Security',
    sub: 'OT/ICS · Penetration testing · NIS2',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Sustainability',
    sub: 'GreenTech · Circular economy · Energy transition',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        <path d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10" strokeLinecap="round" />
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
              Where OT security meets the energy transition.
            </h2>

            <div className="space-y-4 text-[#9b9bb8] font-sans text-base leading-relaxed">
              <p>
                I am a South African tech lead based in Amsterdam, working at the rare intersection of
                operational technology security, energy transition infrastructure, and full-stack engineering.
              </p>
              <p>
                My work spans both sides: hardening the digital backbone of wind farms, solar installations,
                and industrial control systems for European operators — and helping African organisations
                access EU-grade technical leadership without the overhead.
              </p>
              <p>
                I travel regularly between the Netherlands and South Africa and work with clients across
                both continents. The dual perspective is not incidental — it&rsquo;s the edge.
              </p>
              <p className="text-[#f0f0f5] border-l-2 border-accent pl-4 py-0.5 italic font-light">
                &ldquo;My goal is straightforward: apply serious technical depth to problems that actually
                matter — the energy grid, industrial infrastructure, and the communities that depend on both.&rdquo;
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
                Software&thinsp;&plus;&thinsp;Hardware&thinsp;&plus;&thinsp;Security&thinsp;&plus;&thinsp;Sustainability
              </p>
              <p className="text-center font-serif text-base text-accent mt-1">
                = a rare combination.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
