'use client'

import { useEffect, useRef, useState } from 'react'
import { scoreAt, type DayValues } from './score'

/**
 * The time engine. Scroll position on the runway becomes T ∈ [0,1];
 * every scored value is written as a CSS variable on the painting root
 * (for SVG/DOM consumers) and kept in a ref (for the WebGL loop).
 * Arrow keys nudge the hour; ?t= jumps straight to one on localhost.
 */
export function useDayScroll(rootRef: React.RefObject<HTMLElement | null>) {
  const values = useRef<DayValues>(scoreAt(0))
  const velocity = useRef(0) // scroll px/ms, smoothed — the wind
  const [tState, setTState] = useState(0) // coarse T for React consumers
  const lastY = useRef(0)
  const lastTime = useRef(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const apply = (v: DayValues) => {
      const s = root.style
      s.setProperty('--t', String(v.t))
      s.setProperty('--sky', v.sky)
      s.setProperty('--paper', v.paper)
      s.setProperty('--ink', v.ink)
      s.setProperty('--ink-soft', v.inkSoft)
      s.setProperty('--sun-x', `${v.sunX}%`)
      s.setProperty('--sun-y', `${v.sunY}%`)
      s.setProperty('--sun-scale', String(v.sunScale))
      s.setProperty('--sun-o', String(v.sunOpacity))
      s.setProperty('--sun-c', v.sunColor)
      s.setProperty('--moon-o', String(v.moonOpacity))
      s.setProperty('--moon-x', `${v.moonX}%`)
      s.setProperty('--moon-y', `${v.moonY}%`)
      s.setProperty('--wash-o', String(v.washOpacity))
      s.setProperty('--cloud-x', `${v.cloudX}%`)
      s.setProperty('--cloud-o', String(v.cloudOpacity))
      s.setProperty('--bloom', String(v.bloom))
      s.setProperty('--grass', String(v.grass))
      s.setProperty('--night', String(v.night))
      s.setProperty('--glow', String(v.glow))
    }

    const runway = () => document.documentElement.scrollHeight - window.innerHeight

    // ?t= pins the hour directly (headless captures can't scroll) — localhost only
    let forcedT: number | null = null
    if (location.hostname === 'localhost') {
      const q = parseFloat(new URLSearchParams(location.search).get('t') ?? '')
      if (!isNaN(q) && q >= 0 && q <= 1) forcedT = q
    }

    const update = () => {
      const max = runway()
      const y = window.scrollY
      const t = forcedT ?? (max > 0 ? Math.min(1, Math.max(0, y / max)) : 0)

      // smoothed scroll velocity → the atmosphere's wind
      const now = performance.now()
      if (lastTime.current) {
        const dt = Math.max(now - lastTime.current, 1)
        const raw = (y - lastY.current) / dt
        velocity.current = velocity.current * 0.8 + raw * 0.2
      }
      lastY.current = y
      lastTime.current = now

      const v = scoreAt(t)
      values.current = v
      apply(v)
      // coarse-grained state: only re-render React when T moves visibly
      setTState((prev) => (Math.abs(prev - t) > 0.004 ? t : prev))
    }

    // keyboard scrubbing: the day is turnable without a wheel
    const onKey = (e: KeyboardEvent) => {
      const max = runway()
      if (max <= 0) return
      const nudge = (dt: number) => {
        e.preventDefault()
        const t = Math.min(1, Math.max(0, values.current.t + dt))
        window.scrollTo({ top: t * max })
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nudge(0.012)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nudge(-0.012)
      if (e.key === 'PageDown') nudge(0.2)
      if (e.key === 'PageUp') nudge(-0.2)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('keydown', onKey)
    }
  }, [rootRef])

  return { values, velocity, t: tState }
}
