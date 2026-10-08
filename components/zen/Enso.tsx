'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The ensō — one imperfect circle, drawn by your descent.
 * It appears once the summit is left behind, completes itself as you
 * reach the gate, and carries you back to the top when pressed.
 */
export default function Enso() {
  const [visible, setVisible] = useState(false)
  const [complete, setComplete] = useState(false)
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    // no rAF gate — scroll events are already frame-coalesced, the work
    // here is one style write, and a missed frame must never wedge us
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0

      setVisible(window.scrollY > 160)
      setComplete(progress > 0.985)

      const path = pathRef.current
      if (path) {
        // dashoffset 1 → 0 draws the circle as the visitor descends
        path.style.strokeDashoffset = String(1 - progress)
      }
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0 })}
      aria-label="Your journey so far — press to return to the summit"
      title="Return to the summit"
      className={`cv-no-print fixed bottom-5 right-5 z-40 rounded-full transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      inert={!visible || undefined}
    >
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        {/* the faint full circle — the idea of the ensō */}
        <circle
          cx="22" cy="22" r="16"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
        />
        {/* the drawn stroke — begins at the top, sweeps clockwise, and
            like a real ensō never quite closes */}
        <path
          ref={pathRef}
          d="M 22.5 5.8 A 16.2 16.2 0 1 1 15.5 7.4"
          pathLength={1}
          fill="none"
          stroke="var(--ink-soft)"
          strokeWidth="2.6"
          strokeLinecap="round"
          style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
        />
        {/* the brush lifts — a vermilion drop marks a finished journey */}
        <circle
          cx="15.5" cy="7.4" r="2"
          fill="var(--vermilion)"
          className="transition-opacity duration-500"
          opacity={complete ? 0.9 : 0}
        />
      </svg>
    </button>
  )
}
