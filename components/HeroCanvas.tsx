'use client'

import { useEffect, useRef } from 'react'

interface GridNode {
  x: number
  y: number
  baseX: number
  baseY: number
  vx: number
  vy: number
}

interface Pulse {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  speed: number
}

interface Particle {
  fromIdx: number
  toIdx: number
  progress: number
  speed: number
}

const ACCENT = { r: 78, g: 205, b: 196 }
const LINE_DIST = 140

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a})`
}

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let nodes: GridNode[] = []
    let pulses: Pulse[] = []
    let particles: Particle[] = []

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      buildNodes()
    }

    function buildNodes() {
      if (!canvas) return
      nodes = []
      const cols = Math.ceil(canvas.width / 90) + 1
      const rows = Math.ceil(canvas.height / 90) + 1
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = c * 90 + (Math.random() - 0.5) * 30
          const by = r * 90 + (Math.random() - 0.5) * 30
          nodes.push({
            x: bx, y: by, baseX: bx, baseY: by,
            vx: (Math.random() - 0.5) * 0.12,
            vy: (Math.random() - 0.5) * 0.12,
          })
        }
      }
      // Seed initial particles
      particles = []
      for (let i = 0; i < 6; i++) spawnParticle()
    }

    function spawnPulse() {
      if (nodes.length === 0) return
      const node = nodes[Math.floor(Math.random() * nodes.length)]
      pulses.push({
        x: node.x, y: node.y,
        radius: 0, maxRadius: 60 + Math.random() * 40,
        alpha: 0.7, speed: 0.6 + Math.random() * 0.4,
      })
    }

    function spawnParticle() {
      if (nodes.length < 2) return
      const fromIdx = Math.floor(Math.random() * nodes.length)
      // Find a nearby connected node
      const from = nodes[fromIdx]
      const candidates = nodes
        .map((n, i) => ({ i, d: Math.hypot(n.x - from.x, n.y - from.y) }))
        .filter(({ i, d }) => i !== fromIdx && d < LINE_DIST)
      if (candidates.length === 0) return
      const toIdx = candidates[Math.floor(Math.random() * candidates.length)].i
      particles.push({ fromIdx, toIdx, progress: 0, speed: 0.004 + Math.random() * 0.006 })
    }

    let lastPulse = 0
    let frame = 0

    function draw(ts: number) {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Drift nodes slowly
      nodes.forEach((n) => {
        n.x += n.vx
        n.y += n.vy
        if (Math.abs(n.x - n.baseX) > 20) n.vx *= -1
        if (Math.abs(n.y - n.baseY) > 20) n.vy *= -1
      })

      // Draw lines between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINE_DIST) {
            const alpha = (1 - dist / LINE_DIST) * 0.38
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = rgba(ACCENT.r, ACCENT.g, ACCENT.b, alpha)
            ctx.lineWidth = 0.9
            ctx.stroke()
          }
        }
      }

      // Draw node dots
      nodes.forEach((n) => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = rgba(ACCENT.r, ACCENT.g, ACCENT.b, 0.65)
        ctx.fill()
      })

      // Draw pulses
      pulses = pulses.filter((p) => p.alpha > 0.01)
      pulses.forEach((p) => {
        p.radius += p.speed
        p.alpha -= p.alpha * 0.035
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(ACCENT.r, ACCENT.g, ACCENT.b, p.alpha)
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // Draw particles
      particles = particles.filter((p) => p.progress < 1)
      particles.forEach((p) => {
        p.progress += p.speed
        const from = nodes[p.fromIdx]
        const to = nodes[p.toIdx]
        if (!from || !to) return
        const x = from.x + (to.x - from.x) * p.progress
        const y = from.y + (to.y - from.y) * p.progress
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 5)
        gradient.addColorStop(0, rgba(ACCENT.r, ACCENT.g, ACCENT.b, 0.9))
        gradient.addColorStop(1, rgba(ACCENT.r, ACCENT.g, ACCENT.b, 0))
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      })

      // Spawn new particles
      if (frame % 60 === 0 && particles.length < 12) spawnParticle()

      // Spawn pulses
      if (ts - lastPulse > 1200) {
        spawnPulse()
        lastPulse = ts
      }

      frame++
      animId = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-90"
      aria-hidden="true"
    />
  )
}
