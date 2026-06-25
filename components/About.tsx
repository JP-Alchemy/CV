'use client'

import { useInView } from '@/hooks/useInView'

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

      <div className="relative max-w-3xl mx-auto px-6">
        <div className={`animate-on-scroll ${inView ? 'in-view' : ''}`}>
          <p className="text-accent text-sm font-sans font-medium tracking-[0.12em] uppercase mb-4">
            The intersection
          </p>
          <h2
            id="about-heading"
            className="font-serif text-4xl lg:text-5xl text-[#f0f0f5] leading-[1.1] tracking-tight mb-8"
          >
            Where creativity meets impact.
          </h2>

          <div className="space-y-5 text-[#9b9bb8] font-sans text-base lg:text-lg leading-relaxed">
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
            <p>
              Lately a lot of that is building AI agents and orchestrated workflows: small,
              focused systems that quietly take care of the repetitive, so people are left with
              the parts that need a human &mdash; the judgement, the care, the creative leap.
            </p>
            <p className="text-[#f0f0f5] border-l-2 border-accent pl-5 py-1 italic font-light">
              &ldquo;It&rsquo;s not about the best technology. It&rsquo;s about the most thoughtful
              use of it &mdash; in service of work that actually matters.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
