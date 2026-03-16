'use client'

import { useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import HeroCanvas from './HeroCanvas'

// ── Personalise ───────────────────────────────────────────────────────────────
const NAME = 'JP Bothma'
// ─────────────────────────────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export default function Hero() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
      aria-label="Introduction"
    >
      {/* Animated energy-grid canvas */}
      <HeroCanvas />

      {/* Radial vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, #0a0a0f 100%)',
        }}
        aria-hidden="true"
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, #0a0a0f)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-16">
        <div
          className={`transition-all duration-1000 ease-out ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Credibility line */}
          <p
            className="text-[#9b9bb8] text-sm font-sans font-medium tracking-[0.15em] uppercase mb-8"
            style={{ transitionDelay: '100ms' }}
          >
            Amsterdam&nbsp;&middot;&nbsp;South Africa&nbsp;&middot;&nbsp;Available for EU &amp; global engagements
          </p>

          {/* Name */}
          <p
            className="font-sans text-sm font-medium tracking-[0.1em] uppercase text-accent mb-3"
            style={{ transitionDelay: '150ms' }}
          >
            {NAME}
          </p>

          {/* Tagline — the headline */}
          <h1
            className="font-serif text-4xl sm:text-6xl lg:text-7xl text-[#f0f0f5] leading-[1.05] tracking-tightest max-w-3xl mb-6"
            style={{ transitionDelay: '200ms' }}
          >
            Securing the infrastructure of{' '}
            <em className="not-italic text-accent">tomorrow&rsquo;s</em>{' '}
            energy&nbsp;systems.
          </h1>

          {/* Sub-tagline */}
          <p
            className="text-[#9b9bb8] font-sans text-lg max-w-xl mb-10 leading-relaxed"
            style={{ transitionDelay: '300ms' }}
          >
            OT/ICS security &amp; GreenTech consulting at the intersection of
            operational technology, energy transition, and the SA&thinsp;&#8596;&thinsp;EU corridor.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap gap-4"
            style={{ transitionDelay: '400ms' }}
          >
            <button
              onClick={() => scrollTo('contact')}
              className="px-6 py-3 bg-accent text-bg font-sans font-semibold text-sm rounded hover:bg-accent-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Work with me
            </button>
            <button
              onClick={() => scrollTo('services')}
              className="px-6 py-3 border border-[rgba(255,255,255,0.15)] text-[#f0f0f5] font-sans font-medium text-sm rounded hover:border-[rgba(255,255,255,0.35)] hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              See my work
            </button>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={() => scrollTo('about')}
        aria-label="Scroll to about section"
        className={`absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-[#6a6a85] hover:text-accent transition-all duration-700 focus-visible:outline-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDelay: '800ms' }}
      >
        <span className="text-xs font-sans tracking-[0.12em] uppercase">Scroll</span>
        <ArrowDown size={14} className="animate-bounce" />
      </button>
    </section>
  )
}
