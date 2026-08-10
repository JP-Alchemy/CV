'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A whisper of ink behind the cursor — desktop only, evaporating as it
 * goes. The canvas doesn't exist until the first real mouse movement:
 * crawlers, touch devices, and headless renderers never create it
 * (a viewport-covering canvas can stall software rasterization), and
 * everyone else gets it the instant their hand moves.
 */
export default function InkCursor() {
  const [awake, setAwake] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // wake on the first real mouse move — the only gate is "is this a
  // mouse", checked at that moment, never snapshotted at mount. Touch
  // devices never wake it; system settings don't decide the experience.
  useEffect(() => {
    const wake = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      setAwake(true)
      window.removeEventListener('pointermove', wake)
    }
    window.addEventListener('pointermove', wake, { passive: true })
    return () => window.removeEventListener('pointermove', wake)
  }, [])

  // the ink engine, once awake
  useEffect(() => {
    if (!awake) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let running = false
    let idleFrames = 0
    let last: { x: number; y: number; t: number } | null = null
    let pending: { x: number; y: number } | null = null
    let ink = '#4c473e'

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
    }
    resize()

    const readInk = () => {
      ink = getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim() || ink
    }
    readInk()
    const themeWatch = new MutationObserver(readInk)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const frame = () => {
      // evaporate what's there
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.055)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'

      if (pending) {
        const now = performance.now()
        const { x, y } = pending
        pending = null
        if (last) {
          const dt = Math.max(now - last.t, 1)
          const dist = Math.hypot(x - last.x, y - last.y)
          const speed = dist / dt // px per ms
          // a fast brush leaves a thinner, drier line
          const width = Math.max(1.2, 3.4 - speed * 1.6) * dpr
          ctx.strokeStyle = ink
          ctx.globalAlpha = 0.28
          ctx.lineWidth = width
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(last.x * dpr, last.y * dpr)
          ctx.lineTo(x * dpr, y * dpr)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
        last = { x, y, t: now }
        idleFrames = 0
      } else {
        idleFrames++
      }

      // ~2s of quiet is enough for the ink to be gone — let the loop rest
      if (idleFrames > 120) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        running = false
        last = null
        return
      }
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      // self-heal if we mounted while the window reported zero size
      if (canvas.width === 0 || canvas.height === 0) resize()
      pending = { x: e.clientX, y: e.clientY }
      if (!running) {
        running = true
        idleFrames = 0
        raf = requestAnimationFrame(frame)
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', resize, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', resize)
      themeWatch.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [awake])

  if (!awake) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="cv-no-print fixed inset-0 z-30 pointer-events-none w-full h-full"
    />
  )
}
