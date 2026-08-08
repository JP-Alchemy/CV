'use client'

import { useEffect, useRef, useState } from 'react'

type Theme = 'day' | 'night'

/**
 * The sun/moon hanging in the summit sky. Toggling sweeps an ink wash
 * across the page while the world changes underneath it.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('day')
  const sweepRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    if (current === 'night' || current === 'day') setTheme(current)
  }, [])

  function toggle() {
    const next: Theme = theme === 'day' ? 'night' : 'day'
    const sweep = sweepRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const apply = () => {
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem('zen-theme', next)
      } catch {
        /* private mode — the sun still sets */
      }
      setTheme(next)
    }

    if (sweep && !reduced) {
      sweep.classList.remove('sweeping')
      // restart the animation, flip the world at its darkest moment
      void sweep.offsetWidth
      sweep.classList.add('sweeping')
      setTimeout(apply, 320)
      setTimeout(() => sweep.classList.remove('sweeping'), 750)
    } else {
      apply()
    }
  }

  const isDay = theme === 'day'

  return (
    <>
      <div ref={sweepRef} className="theme-sweep" aria-hidden="true" />
      <button
        type="button"
        onClick={toggle}
        aria-label={isDay ? 'Let night fall' : 'Bring back the day'}
        title={isDay ? 'Let night fall' : 'Bring back the day'}
        className={`group ${className}`}
      >
        <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
          {isDay ? (
            // the sun — a single brushed circle
            <circle
              cx="27" cy="27" r="14"
              fill="none"
              stroke="var(--vermilion)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="80 8"
              className="transition-transform duration-500 group-hover:rotate-90"
              style={{ transformOrigin: 'center' }}
            />
          ) : (
            // the moon — a crescent of pale ink
            <path
              d="M33 13 A15.5 15.5 0 1 0 33 41 A12.5 12.5 0 0 1 33 13 Z"
              fill="var(--ink)"
              opacity="0.9"
              className="transition-transform duration-500 group-hover:-rotate-12"
              style={{ transformOrigin: 'center' }}
            />
          )}
        </svg>
      </button>
    </>
  )
}
