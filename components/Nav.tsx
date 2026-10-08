'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Building', href: '#building' },
]

const SECTIONS = ['hero', 'about', 'services', 'building', 'credibility', 'contact']

// ── Personalise ───────────────────────────────────────────────────────────────
const SITE_INITIALS = 'JP' // Your initials
const SITE_NAME = 'JP Bothma' // Your full name
// ─────────────────────────────────────────────────────────────────────────────

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 48)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    SECTIONS.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id)
        },
        { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  const scrollTo = useCallback((href: string) => {
    const id = href.replace('#', '')
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMobileOpen(false)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-bg/95 backdrop-blur-md border-b border-border-subtle shadow-[0_1px_0_rgba(78,205,196,0.06)]'
          : 'bg-transparent'
      }`}
    >
      <nav
        className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"
        aria-label="Primary navigation"
      >
        {/* Logo */}
        <button
          onClick={() => scrollTo('#hero')}
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          aria-label="Back to top"
        >
          <span className="w-8 h-8 rounded bg-accent/10 border border-accent/30 flex items-center justify-center text-accent text-xs font-semibold tracking-wider font-sans group-hover:bg-accent/20 transition-colors">
            {SITE_INITIALS}
          </span>
          <span className="text-[#f0f0f5] font-sans font-medium text-sm hidden sm:block tracking-wide">
            {SITE_NAME}
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => {
            const id = href.replace('#', '')
            const isActive = activeSection === id
            return (
              <button
                key={href}
                onClick={() => scrollTo(href)}
                className={`px-4 py-2 text-sm font-sans font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? 'text-accent'
                    : 'text-[#9b9bb8] hover:text-[#f0f0f5]'
                }`}
              >
                {label}
              </button>
            )
          })}
          <Link
            href="/cv"
            className="px-4 py-2 text-sm font-sans font-medium rounded transition-colors text-[#9b9bb8] hover:text-[#f0f0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            CV
          </Link>
          <button
            onClick={() => scrollTo('#contact')}
            className="ml-1 px-4 py-2 text-sm font-sans font-semibold rounded border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent/70 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Contact
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-[#9b9bb8] hover:text-[#f0f0f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? 'max-h-64 border-b border-border-subtle' : 'max-h-0'
        } bg-bg/98 backdrop-blur-md`}
      >
        <div className="px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={href}
              onClick={() => scrollTo(href)}
              className="text-left px-3 py-2.5 text-sm font-sans font-medium text-[#9b9bb8] hover:text-[#f0f0f5] rounded transition-colors"
            >
              {label}
            </button>
          ))}
          <Link
            href="/cv"
            onClick={() => setMobileOpen(false)}
            className="px-3 py-2.5 text-sm font-sans font-medium text-[#9b9bb8] hover:text-[#f0f0f5] rounded transition-colors"
          >
            CV
          </Link>
          <button
            onClick={() => scrollTo('#contact')}
            className="mt-1 px-3 py-2.5 text-sm font-sans font-semibold text-accent border border-accent/40 rounded hover:bg-accent/10 transition-all text-left"
          >
            Contact
          </button>
        </div>
      </div>
    </header>
  )
}
