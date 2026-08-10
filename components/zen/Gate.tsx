'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Github, Linkedin } from 'lucide-react'
import InkScene from './InkScene'
import Seal from './Seal'
import { markKoan } from './koans'

// `||` (not `??`) so an empty CI secret also falls through to the sentinel
const FORMSPREE_ENDPOINT = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || ''

const ENQUIRY_TYPES = [
  { value: '', label: 'What brings you here…' },
  { value: 'interactive', label: 'Interactive / 3D project' },
  { value: 'dataviz', label: 'Data visualisation' },
  { value: 'ai-automation', label: 'AI agents / workflow automation' },
  { value: 'sustainability', label: 'Sustainability engineering' },
  { value: 'fractional', label: 'Fractional CTO' },
  { value: 'employee', label: 'Full-time employment' },
  { value: 'curious', label: 'Just wandering' },
]

type FormState = 'idle' | 'submitting' | 'success' | 'error'

const inputClass =
  'w-full px-4 py-3 rounded-sm text-sm font-light bg-transparent border transition-colors'
const inputStyle = {
  borderColor: 'var(--line)',
  color: 'var(--ink)',
} as React.CSSProperties

/**
 * 六 · The Gate — a torii at the end of the scroll. Pass through, say hello.
 * Beyond it: mist, and a small koan for those who keep walking.
 */
export default function Gate() {
  const [formState, setFormState] = useState<FormState>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [enquiryChosen, setEnquiryChosen] = useState(false)
  const koanRef = useRef<HTMLParagraphElement>(null)

  // the first koan is earned by walking past the end of the scroll
  useEffect(() => {
    const el = koanRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markKoan('gate')
          observer.disconnect()
        }
      },
      { threshold: 0.8 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function validate(data: FormData): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!String(data.get('name') ?? '').trim()) errs.name = 'A name, so I know who wandered by.'
    const email = String(data.get('email') ?? '').trim()
    if (!email) errs.email = 'An email, so the reply finds you.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'That email looks unfinished.'
    if (!String(data.get('message') ?? '').trim()) errs.message = 'Even a single line is enough.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const errs = validate(data)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})
    if (!FORMSPREE_ENDPOINT) {
      // endpoint never configured — fail visibly instead of posting into the void
      setFormState('error')
      return
    }
    setFormState('submitting')
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ENDPOINT}`, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        setFormState('success')
        form.reset()
      } else {
        setFormState('error')
      }
    } catch {
      setFormState('error')
    }
  }

  return (
    <InkScene
      as="section"
      id="gate"
      ariaLabelledby="gate-heading"
      className="relative pt-28 md:pt-36 pb-10"
      threshold={0.1}
    >
      <div className="max-w-5xl mx-auto px-6">

        {/* The torii */}
        <svg viewBox="0 0 360 240" aria-hidden="true" className="w-full max-w-[340px] mx-auto mb-4">
          {/* kasagi — top lintel, gently curved */}
          <path
            d="M24,58 C120,38 240,38 336,58"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="5"
            strokeLinecap="round"
            style={{ '--delay': '0.15s' } as React.CSSProperties}
          />
          {/* nuki — second lintel */}
          <path
            d="M52,92 C136,82 224,82 308,92"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{ '--delay': '0.4s' } as React.CSSProperties}
          />
          {/* posts */}
          <path
            d="M88,66 C90,124 88,176 90,224 M272,66 C270,124 272,176 270,224"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="4.5"
            strokeLinecap="round"
            style={{ '--delay': '0.6s' } as React.CSSProperties}
          />
          {/* gakuzuka — centre strut with a small seal */}
          <path
            d="M180,58 L180,92"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="2.5"
            style={{ '--delay': '0.9s' } as React.CSSProperties}
          />
          <rect
            x="171" y="66" width="18" height="18" rx="3"
            className="fill-in"
            fill="var(--vermilion)"
            opacity="0.9"
            style={{ '--delay': '1.15s' } as React.CSSProperties}
          />
          {/* ground */}
          <path
            d="M48,226 C140,220 232,230 316,224"
            pathLength={1}
            className="draw"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{ '--delay': '1s' } as React.CSSProperties}
          />
        </svg>

        <div className="max-w-xl mx-auto text-center mb-12">
          <p
            className="fill-in text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: 'var(--vermilion)', '--delay': '0.2s' } as React.CSSProperties}
          >
            六 · The Gate
          </p>
          <h2
            id="gate-heading"
            className="zen-serif text-4xl md:text-5xl tracking-tight mb-4 fill-in"
            style={{ color: 'var(--ink)', '--delay': '0.3s' } as React.CSSProperties}
          >
            Pass through. Say hello.
          </h2>
          <p
            className="fill-in text-base font-light leading-relaxed"
            style={{ color: 'var(--ink-soft)', '--delay': '0.45s' } as React.CSSProperties}
          >
            A project, a partnership, or a thoughtful question — my inbox is
            genuinely open. No newsletters, no CRM. Just a quiet, real
            conversation.
          </p>
        </div>

        {/* The form */}
        <div className="max-w-xl mx-auto">
          {formState === 'success' ? (
            <div
              className="text-center px-8 py-14 rounded-sm border"
              style={{ borderColor: 'var(--vermilion)', background: 'var(--vermilion-glow)' }}
              role="status"
            >
              {/* the hanko comes down — sealed, sincerely */}
              <div className="stamp-press stamp-bloom inline-block rounded-md mb-5">
                <Seal size={64} />
              </div>
              <p className="zen-serif text-2xl mb-2" style={{ color: 'var(--ink)' }}>
                Sealed. Your message is on its way.
              </p>
              <p className="text-sm font-light" style={{ color: 'var(--ink-soft)' }}>
                I usually reply within a day. Until then — wander well.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-label="Contact form" className="space-y-4">
              {formState === 'error' && (
                <p
                  role="alert"
                  className="text-sm px-4 py-3 rounded-sm border"
                  style={{ color: 'var(--vermilion)', borderColor: 'var(--vermilion)' }}
                >
                  Something slipped. Try again, or find me on LinkedIn below.
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="sr-only">Name</label>
                  <input id="name" name="name" type="text" placeholder="Name"
                    autoComplete="name" className={inputClass} style={inputStyle}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined} />
                  {errors.name && (
                    <p id="name-error" role="alert" className="mt-1.5 text-xs" style={{ color: 'var(--vermilion)' }}>
                      {errors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="sr-only">Email</label>
                  <input id="email" name="email" type="email" placeholder="Email"
                    autoComplete="email" className={inputClass} style={inputStyle}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined} />
                  {errors.email && (
                    <p id="email-error" role="alert" className="mt-1.5 text-xs" style={{ color: 'var(--vermilion)' }}>
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="relative">
                <label htmlFor="enquiry" className="sr-only">Type of enquiry</label>
                <select
                  id="enquiry"
                  name="enquiry"
                  defaultValue=""
                  onChange={(e) => setEnquiryChosen(e.currentTarget.value !== '')}
                  className={`${inputClass} cursor-pointer appearance-none pr-10`}
                  style={{
                    ...inputStyle,
                    color: enquiryChosen ? 'var(--ink)' : 'var(--ink-faint)',
                  }}
                >
                  {ENQUIRY_TYPES.map(({ value, label }) => (
                    <option key={value} value={value} disabled={value === ''}>{label}</option>
                  ))}
                </select>
                {/* a small brushed chevron in place of the native one */}
                <svg
                  viewBox="0 0 12 8"
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-3"
                >
                  <path d="M1,1.5 C3,3.5 4.5,5 6,6.5 C7.5,5 9,3.5 11,1.5" fill="none"
                    stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>

              <div>
                <label htmlFor="message" className="sr-only">Message</label>
                <textarea id="message" name="message" rows={5}
                  placeholder="The project, the problem, or just hello."
                  className={`${inputClass} resize-none`} style={inputStyle}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? 'message-error' : undefined} />
                {errors.message && (
                  <p id="message-error" role="alert" className="mt-1.5 text-xs" style={{ color: 'var(--vermilion)' }}>
                    {errors.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={formState === 'submitting'}
                className="w-full py-3.5 rounded-sm text-sm font-medium tracking-[0.1em] uppercase transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ background: 'var(--vermilion)', color: 'var(--paper)' }}
              >
                {formState === 'submitting' ? 'Sending…' : 'Send it through the gate'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-24 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-5"
          style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-3">
            <Seal size={22} />
            <p className="text-xs font-light" style={{ color: 'var(--ink-faint)' }}>
              JP Bothma · Leiden, Netherlands · © {new Date().getFullYear()}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://www.linkedin.com/in/jp-bothma" target="_blank" rel="noopener noreferrer"
              aria-label="LinkedIn" className="transition-opacity hover:opacity-70"
              style={{ color: 'var(--ink-soft)' }}>
              <Linkedin size={15} />
            </a>
            <a href="https://github.com/JP-Alchemy" target="_blank" rel="noopener noreferrer"
              aria-label="GitHub" className="transition-opacity hover:opacity-70"
              style={{ color: 'var(--ink-soft)' }}>
              <Github size={15} />
            </a>
            <Link href="/cv" className="text-xs zen-link">
              the formal scroll (CV)
            </Link>
          </div>
        </footer>

        {/* Beyond the gate — mist, then a koan for the persistent */}
        <div className="relative h-[38vh] flex items-end justify-center overflow-hidden">
          <div className="mist-band left-[2%] right-[2%] top-6 h-20" style={{ '--mist-dur': '80s' } as React.CSSProperties} aria-hidden="true" />
          <p ref={koanRef} className="pb-8 text-center text-xs font-light italic leading-relaxed max-w-xs" style={{ color: 'var(--ink-faint)' }}>
            A wanderer asked: &ldquo;Where does the path go after the gate?&rdquo;
            <br />
            The master said: &ldquo;It goes where you do.&rdquo;
            <br />
            <a href="#top" className="zen-link not-italic inline-block mt-3">· begin again ·</a>
          </p>
        </div>
      </div>
    </InkScene>
  )
}
