'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Seal from './Seal'

const LANDMARKS = [
  { label: 'Path', href: '#path' },
  { label: 'Lanterns', href: '#lanterns' },
  { label: 'Pond', href: '#pond' },
  { label: 'Tea House', href: '#teahouse' },
  { label: 'Gate', href: '#gate' },
]

/**
 * A whisper of a nav — invisible at the summit, a translucent strip of
 * paper once you descend. CV stays one click away for the hurried.
 */
export default function ZenNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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

        <div className="flex items-center gap-5">
          <ul className="hidden md:flex items-center gap-5">
            {LANDMARKS.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  className="text-xs tracking-[0.08em] transition-colors hover:opacity-100 opacity-70"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
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
