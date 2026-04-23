'use client'

import { useState, useRef } from 'react'
import { useInView } from '@/hooks/useInView'
import { Send, CheckCircle, AlertCircle, Linkedin } from 'lucide-react'

// ── Personalise ───────────────────────────────────────────────────────────────
const FORMSPREE_ENDPOINT = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT ?? 'YOUR_FORMSPREE_ID'
const LINKEDIN_URL = 'https://www.linkedin.com/in/jp-bothma/'
// ─────────────────────────────────────────────────────────────────────────────

type FormState = 'idle' | 'submitting' | 'success' | 'error'

const ENQUIRY_TYPES = [
  { value: '', label: 'Type of enquiry…' },
  { value: 'interactive', label: 'Interactive / 3D project' },
  { value: 'dataviz', label: 'Data visualisation' },
  { value: 'sustainability', label: 'Sustainability engineering' },
  { value: 'fractional', label: 'Fractional CTO' },
  { value: 'product', label: 'Product / design partnership' },
  { value: 'employee', label: 'Full-time employment' },
  { value: 'curious', label: 'Just curious' },
]

export default function Contact() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.05 })
  const formRef = useRef<HTMLFormElement>(null)

  const [formState, setFormState] = useState<FormState>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(data: FormData): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!String(data.get('name') ?? '').trim()) errs.name = 'Name is required.'
    const email = String(data.get('email') ?? '').trim()
    if (!email) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email.'
    if (!String(data.get('enquiry') ?? '').trim()) errs.enquiry = 'Please select a type.'
    if (!String(data.get('message') ?? '').trim()) errs.message = 'A message is required.'
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
    setFormState('submitting')

    try {
      const endpoint = `https://formspree.io/f/${FORMSPREE_ENDPOINT}`
      const res = await fetch(endpoint, {
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
    <section
      id="contact"
      ref={ref}
      className="py-28 lg:py-36 relative overflow-hidden"
      aria-labelledby="contact-heading"
    >
      {/* Background glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center bottom, rgba(78,205,196,0.06) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-5 gap-16 lg:gap-24">

          {/* Left — header + meta */}
          <div className={`lg:col-span-2 animate-on-scroll ${inView ? 'in-view' : ''}`}>
            <p className="text-accent text-sm font-sans font-medium tracking-[0.12em] uppercase mb-4">
              Contact
            </p>
            <h2
              id="contact-heading"
              className="font-serif text-4xl lg:text-5xl text-[#f0f0f5] leading-[1.1] tracking-tight mb-6"
            >
              Let&rsquo;s make something that matters.
            </h2>
            <p className="text-[#9b9bb8] font-sans text-base leading-relaxed mb-10">
              A specific project, a slow-burn partnership, or just a thoughtful question &mdash;
              my inbox is genuinely open. No pitch decks required.
            </p>

            {/* Meta */}
            <div className="space-y-5">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                aria-label="LinkedIn profile"
              >
                <div className="w-8 h-8 rounded bg-bg-elevated border border-border-subtle flex items-center justify-center text-[#6a6a85] group-hover:border-accent/30 group-hover:text-accent transition-colors">
                  <Linkedin size={14} />
                </div>
                <span className="font-sans text-sm text-[#9b9bb8] group-hover:text-[#f0f0f5] transition-colors">
                  LinkedIn
                </span>
              </a>
            </div>

            <p className="mt-8 text-xs font-sans text-[#6a6a85] leading-relaxed">
              Based in Leiden (CET) &middot; Usually back within a day &middot; Available for EU &amp; global engagements
            </p>
          </div>

          {/* Right — form */}
          <div
            className={`lg:col-span-3 animate-on-scroll ${inView ? 'in-view' : ''}`}
            style={{ transitionDelay: '150ms' }}
          >
            {formState === 'success' ? (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-10 rounded-xl border border-accent/20 bg-accent/[0.04]">
                <CheckCircle size={32} className="text-accent mb-4" />
                <h3 className="font-serif text-2xl text-[#f0f0f5] mb-2">Message sent.</h3>
                <p className="font-sans text-[#9b9bb8] text-sm max-w-xs">
                  I&rsquo;ll get back to you within 24 hours. If it&rsquo;s urgent, feel free to reach out on LinkedIn directly.
                </p>
              </div>
            ) : (
              <form
                ref={formRef}
                onSubmit={handleSubmit}
                noValidate
                className="space-y-5"
                aria-label="Contact form"
              >
                {formState === 'error' && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-sans"
                  >
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>Something went wrong. Please try again or email me directly.</span>
                  </div>
                )}

                {/* Name + Email row */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="sr-only">Name</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Name"
                      autoComplete="name"
                      className={`w-full px-4 py-3 rounded-lg bg-bg-surface border text-[#f0f0f5] placeholder-[#6a6a85] font-sans text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors ${
                        errors.name ? 'border-red-500/50' : 'border-border-subtle hover:border-[rgba(255,255,255,0.15)]'
                      }`}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                    />
                    {errors.name && (
                      <p id="name-error" role="alert" className="mt-1.5 text-xs text-red-400 font-sans">{errors.name}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="email" className="sr-only">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Email"
                      autoComplete="email"
                      className={`w-full px-4 py-3 rounded-lg bg-bg-surface border text-[#f0f0f5] placeholder-[#6a6a85] font-sans text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors ${
                        errors.email ? 'border-red-500/50' : 'border-border-subtle hover:border-[rgba(255,255,255,0.15)]'
                      }`}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                    />
                    {errors.email && (
                      <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-400 font-sans">{errors.email}</p>
                    )}
                  </div>
                </div>

                {/* Enquiry type */}
                <div>
                  <label htmlFor="enquiry" className="sr-only">Type of enquiry</label>
                  <select
                    id="enquiry"
                    name="enquiry"
                    defaultValue=""
                    className={`w-full px-4 py-3 rounded-lg bg-bg-surface border text-sm font-sans focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors appearance-none cursor-pointer ${
                      errors.enquiry ? 'border-red-500/50 text-[#f0f0f5]' : 'border-border-subtle hover:border-[rgba(255,255,255,0.15)] text-[#f0f0f5]'
                    }`}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2355556a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                    }}
                    aria-describedby={errors.enquiry ? 'enquiry-error' : undefined}
                  >
                    {ENQUIRY_TYPES.map(({ value, label }) => (
                      <option
                        key={value}
                        value={value}
                        disabled={value === ''}
                        className="bg-bg-surface text-[#f0f0f5]"
                      >
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.enquiry && (
                    <p id="enquiry-error" role="alert" className="mt-1.5 text-xs text-red-400 font-sans">{errors.enquiry}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="sr-only">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="Tell me about the project, the problem, or just say hello."
                    className={`w-full px-4 py-3 rounded-lg bg-bg-surface border text-[#f0f0f5] placeholder-[#6a6a85] font-sans text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors resize-none ${
                      errors.message ? 'border-red-500/50' : 'border-border-subtle hover:border-[rgba(255,255,255,0.15)]'
                    }`}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                  />
                  {errors.message && (
                    <p id="message-error" role="alert" className="mt-1.5 text-xs text-red-400 font-sans">{errors.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={formState === 'submitting'}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-accent text-bg font-sans font-semibold text-sm rounded-lg hover:bg-accent-muted disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  {formState === 'submitting' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Send message
                    </>
                  )}
                </button>

                <p className="text-center text-xs font-sans text-[#6a6a85]">
                  No newsletters. No CRM. Just a quiet, real conversation.
                </p>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
