'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Seal from './Seal'
import ThemeToggle from './ThemeToggle'

const LANDMARKS = [
  { label: 'Path', href: '#path' },
  { label: 'Lanterns', href: '#lanterns' },
  { label: 'Pond', href: '#pond' },
  { label: 'Tea House', href: '#teahouse' },
  { label: 'Gate', href: '#gate' },
]

// the two a hurried visitor needs
const MOBILE_LANDMARKS = [
  { label: 'Tea House', href: '#teahouse' },
  { label: 'Gate', href: '#gate' },
]

/**
 * A whisper of a nav — invisible at the summit, a translucent strip of
 * paper once you descend. CV stays one click away for the hurried, and
 * the moon comes along so night is reachable from anywhere.
 */
export default function ZenNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // App-router hydration resets scroll, so #hash deep links never land —
  // walk there once the page is interactive.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const el = document.querySelector(hash)
    if (!el) return
    const t = setTimeout(() => el.scrollIntoView({ behavior: 'instant', block: 'start' }), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <nav
      aria-label="Landmarks"
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b"
      style={{
        // no backdrop-filter — it black-boxes software rasterization
        background: scrolled ? 'color-mix(in srgb, var(--paper) 94%, transparent)' : 'transparent',
        borderColor: scrolled ? 'var(--line)' : 'transparent',
      }}
    >
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 shrink-0" aria-label="Back to the summit">
          <Seal size={26} />
          <span className="zen-serif text-sm tracking-wide" style={{ color: 'var(--ink)' }}>
            JP Bothma
          </span>
        </a>

        <div className="flex items-center gap-4 sm:gap-5">
          <ul className="hidden md:flex items-center gap-5">
            {LANDMARKS.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  className="text-xs tracking-[0.08em] transition-opacity hover:opacity-100 opacity-70"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex md:hidden items-center gap-4">
            {MOBILE_LANDMARKS.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  className="text-xs tracking-[0.08em] opacity-70"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          {/* the moon travels with you once you've left the summit */}
          <div
            className={`transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={!scrolled}
            // keep the hidden toggle out of the tab order entirely
            inert={!scrolled || undefined}
          >
            <ThemeToggle size={30} className="block" />
          </div>

          <Link
            href="/cv"
            className="text-xs font-medium tracking-[0.08em] px-3 py-1.5 rounded-sm border transition-opacity hover:opacity-80"
            style={{ color: 'var(--vermilion)', borderColor: 'var(--vermilion)' }}
          >
            CV
          </Link>
        </div>
      </div>
    </nav>
  )
}
