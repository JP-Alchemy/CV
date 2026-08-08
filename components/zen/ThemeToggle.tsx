'use client'

import { useEffect, useRef, useState } from 'react'

type Theme = 'day' | 'night'

/**
 * The sun/moon hanging in the sky. Toggling sweeps an ink wash across
 * the page while the world changes underneath it. The veil's color is
 * frozen before the flip so the wash itself never flickers.
 */
export default function ThemeToggle({
  className = '',
  size = 54,
}: {
  className?: string
  size?: number
}) {
  const [theme, setTheme] = useState<Theme>('day')
  const sweepRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const read = () => {
      const current = document.documentElement.getAttribute('data-theme')
      if (current === 'night' || current === 'day') setTheme(current)
    }
    read()
    // stay in sync when another toggle instance flips the world
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
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
      // freeze the veil's ink before the world changes beneath it
      sweep.style.background = getComputedStyle(document.documentElement)
        .getPropertyValue('--ink')
        .trim()
      sweep.classList.remove('sweeping')
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
        <svg width={size} height={size} viewBox="0 0 54 54" aria-hidden="true">
          {isDay ? (
            // the sun — a full hinomaru disc
            <circle
              cx="27" cy="27" r="13"
              fill="var(--vermilion)"
              opacity="0.9"
              className="transition-transform duration-500 group-hover:scale-110"
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
