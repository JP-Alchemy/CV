'use client'

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import HeroPainting from './HeroPainting'
import Headlines from './Headlines'
import NightGarden from './NightGarden'
import { useDayScroll } from './useDayScroll'

// the atmosphere needs WebGL and a browser — load it lazily, lose it gracefully
const Atmosphere = lazy(() => import('./Atmosphere'))

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

type Scene = 'hero' | 'garden'
type Bloom = 'idle' | 'blooming' | 'receding'

/**
 * The scene manager: the hero painting whose day you turn, the night
 * garden where the work hangs, and the ink bloom that carries you
 * between them. The hour is kept while you're away.
 */
export default function InkWorld() {
  const frameRef = useRef<HTMLDivElement>(null)
  const { values, velocity, t } = useDayScroll(frameRef)

  const [scene, setScene] = useState<Scene>('hero')
  const [bloom, setBloom] = useState<Bloom>('idle')
  const [gl, setGl] = useState(false)
  const bloomRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    setGl(webglAvailable())
    // arriving directly at ?scene=garden (refresh, shared link)
    if (new URLSearchParams(location.search).get('scene') === 'garden') {
      setScene('garden')
    }
    return () => timers.current.forEach(clearTimeout)
  }, [])

  // the garden locks the runway; the hero's hour survives the visit
  useEffect(() => {
    document.documentElement.style.overflow = scene === 'garden' ? 'hidden' : ''
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [scene])

  const travel = useCallback((to: Scene, origin?: { x: number; y: number }) => {
    const el = bloomRef.current
    if (el && origin) {
      el.style.setProperty('--bloom-x', `${origin.x}%`)
      el.style.setProperty('--bloom-y', `${origin.y}%`)
    }
    setBloom('blooming')
    timers.current.push(
      window.setTimeout(() => {
        setScene(to)
        const url = to === 'garden' ? '?scene=garden' : location.pathname
        history.pushState({ scene: to }, '', url)
        setBloom('receding')
      }, 520),
      window.setTimeout(() => setBloom('idle'), 1250)
    )
  }, [])

  // back/forward buttons walk between the paintings too
  useEffect(() => {
    const onPop = () => {
      const to: Scene =
        new URLSearchParams(location.search).get('scene') === 'garden' ? 'garden' : 'hero'
      setScene(to)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Escape leaves the garden
  useEffect(() => {
    if (scene !== 'garden') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') travel('hero', { x: 8, y: 8 })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [scene, travel])

  return (
    /* the runway: five viewports of scroll = one day */
    <div className="lab-runway" style={{ height: '500svh' }}>
      <div
        ref={frameRef}
        className="sticky top-0 overflow-hidden"
        style={{
          height: '100svh',
          background: 'var(--paper, #f4efe4)',
        }}
      >
        {scene === 'hero' && (
          <>
            <HeroPainting />
            <Headlines
              t={t}
              onEnterGarden={() => travel('garden', { x: 14, y: 26 })}
            />
            {/* scroll hint — evaporates once the day begins */}
            <p
              className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.3em] uppercase transition-opacity duration-700 select-none"
              style={{
                color: 'var(--ink-soft, #4c473e)',
                opacity: 'calc(1 - min(var(--t, 0) * 14, 1))',
                fontFamily: 'var(--font-zen-sans), system-ui, sans-serif',
              }}
              aria-hidden="true"
            >
              turn the day — scroll
            </p>
          </>
        )}

        {scene === 'garden' && (
          <NightGarden onReturn={() => travel('hero', { x: 8, y: 8 })} />
        )}

        {/* petals fall in both worlds — one continuous atmosphere */}
        {gl && (
          <Suspense fallback={null}>
            <Atmosphere values={values} velocity={velocity} />
          </Suspense>
        )}

        {/* the passage itself */}
        <div
          ref={bloomRef}
          className={`ink-bloom ${bloom === 'blooming' ? 'blooming' : ''} ${bloom === 'receding' ? 'receding' : ''}`}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
