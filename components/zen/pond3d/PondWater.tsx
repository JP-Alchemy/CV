'use client'

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import PondSvg from '../PondSvg'

const PondScene = lazy(() => import('./PondScene'))

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * The living water. Mounts the R3F pond only when the section nears the
 * viewport, WebGL exists, and the visitor hasn't asked for reduced motion —
 * otherwise the still SVG pond remains, and nothing is lost.
 */
export default function PondWater() {
  const holder = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'svg' | 'canvas'>('svg')
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = holder.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!webglAvailable()) return

    // mount when within 1.5 viewports, release when far beyond it
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: '150% 0px 150% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (near) setMode('canvas')
    // deliberately never fall back once mounted — avoids re-init churn
  }, [near])

  return (
    <div ref={holder} className="relative w-full aspect-[420/300]">
      {mode === 'svg' ? (
        <PondSvg />
      ) : (
        <Suspense fallback={<PondSvg />}>
          <PondScene paused={!near} />
          {/* reeds at the near bank, brushed over the water */}
          <svg
            viewBox="0 0 60 90"
            aria-hidden="true"
            className="absolute bottom-[6%] left-[8%] w-[9%] pointer-events-none"
          >
            <path
              d="M22,86 C26,58 22,36 30,10 M34,88 C36,62 32,44 40,20 M12,82 C14,62 10,48 16,30"
              fill="none"
              stroke="var(--ink-soft)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </Suspense>
      )}
    </div>
  )
}
