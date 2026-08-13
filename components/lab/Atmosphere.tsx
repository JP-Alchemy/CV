'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { DayValues } from './score'

/** with a manual camera, the frustum is ours to set — and to update */
function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  useEffect(() => {
    camera.left = 0
    camera.right = 100
    camera.top = 0
    camera.bottom = 100
    camera.near = -10
    camera.far = 10
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

/**
 * The atmosphere — what SVG does badly, the GPU does gladly:
 * falling petals that catch the wind of your scrolling, the sun's
 * golden-hour glow bleeding into the paper, fireflies after dark.
 * World space: x 0→100 (left→right), y 0→100 (top→bottom), ortho.
 */

const PETAL_COUNT = 170
const FIREFLY_COUNT = 12

function paintPetal(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const x = c.getContext('2d')!
  x.translate(16, 16)
  const g = x.createRadialGradient(0, 0, 1, 0, 0, 14)
  g.addColorStop(0, 'rgba(232, 180, 196, 0.95)')
  g.addColorStop(0.75, 'rgba(223, 168, 182, 0.85)')
  g.addColorStop(1, 'rgba(223, 168, 182, 0)')
  x.fillStyle = g
  // a petal: oval with a nicked tip
  x.beginPath()
  x.ellipse(0, 0, 7.5, 11, 0, 0, Math.PI * 2)
  x.fill()
  x.globalCompositeOperation = 'destination-out'
  x.beginPath()
  x.ellipse(0, -11, 3.2, 4.2, 0, 0, Math.PI * 2)
  x.fill()
  const tex = new THREE.CanvasTexture(c)
  return tex
}

function paintDot(r: number, rgb: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 30)
  g.addColorStop(0, `rgba(${rgb}, ${r})`)
  g.addColorStop(0.5, `rgba(${rgb}, ${r * 0.35})`)
  g.addColorStop(1, `rgba(${rgb}, 0)`)
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

interface PetalState {
  x: number; y: number; vy: number; phase: number; spin: number; size: number
}

function Petals({ values, velocity }: {
  values: React.MutableRefObject<DayValues>
  velocity: React.MutableRefObject<number>
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tex = useMemo(paintPetal, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const petals = useMemo<PetalState[]>(
    () =>
      Array.from({ length: PETAL_COUNT }, (_, i) => ({
        x: (i * 37.7) % 120 - 10,
        y: (i * 53.3) % 130 - 15,
        vy: 2.6 + ((i * 7) % 10) * 0.35,
        phase: i * 1.7,
        spin: ((i % 7) - 3) * 0.6,
        size: 0.75 + ((i * 13) % 10) * 0.075,
      })),
    []
  )

  useFrame(({ clock }, rawDt) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(rawDt, 1 / 20)
    const t = clock.elapsedTime
    const v = values.current
    // the wind: your scrolling, smoothed, plus a slow ambient breath
    const wind = THREE.MathUtils.clamp(velocity.current * 6, -14, 14) + Math.sin(t * 0.23) * 1.1

    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity = 0.28 + 0.62 * v.petals

    for (let i = 0; i < PETAL_COUNT; i++) {
      const p = petals[i]
      p.y += p.vy * dt * (0.7 + 0.5 * v.petals)
      p.x += (Math.sin(t * 0.9 + p.phase) * 1.6 + wind) * dt
      if (p.y > 112) { p.y = -8; p.x = (p.x + 37) % 120 - 10 }
      if (p.x > 112) p.x -= 124
      if (p.x < -12) p.x += 124

      dummy.position.set(p.x, p.y, 0)
      dummy.rotation.z = t * p.spin + p.phase
      const s = p.size
      dummy.scale.set(s, s, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PETAL_COUNT]}>
      <planeGeometry args={[1.6, 2.1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.8} />
    </instancedMesh>
  )
}

function SunGlow({ values }: { values: React.MutableRefObject<DayValues> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => paintDot(0.5, '224, 122, 61'), [])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const v = values.current
    m.position.set(v.sunX, v.sunY, 0)
    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity = v.glow * 0.65
    const s = 34 * v.sunScale
    m.scale.set(s, s, 1)
  })

  return (
    <mesh ref={mesh}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
    </mesh>
  )
}

function Fireflies({ values }: { values: React.MutableRefObject<DayValues> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tex = useMemo(() => paintDot(0.9, '226, 178, 92'), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const t = clock.elapsedTime
    const v = values.current
    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity = v.night * 0.85

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      // wandering under and around the tree (right half, low sky)
      const bx = 52 + (i * 41) % 42
      const by = 38 + (i * 29) % 40
      const x = bx + Math.sin(t * (0.3 + (i % 5) * 0.09) + i * 2.4) * 7
      const y = by + Math.cos(t * (0.23 + (i % 4) * 0.08) + i * 1.9) * 5
      const pulse = 0.55 + 0.45 * Math.sin(t * (1.1 + (i % 3) * 0.4) + i)
      dummy.position.set(x, y, 0)
      const s = 1.6 * pulse * v.night
      dummy.scale.set(Math.max(s, 0.001), Math.max(s, 0.001), 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FIREFLY_COUNT]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
    </instancedMesh>
  )
}

export default function Atmosphere({ values, velocity }: {
  values: React.MutableRefObject<DayValues>
  velocity: React.MutableRefObject<number>
}) {
  const preserve =
    typeof location !== 'undefined' &&
    location.hostname === 'localhost' &&
    location.search.includes('t=')

  return (
    <Canvas
      orthographic
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: preserve }}
      camera={{ left: 0, right: 100, top: 0, bottom: 100, near: -10, far: 10, position: [0, 0, 1], manual: true } as never}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <CameraRig />
      <SunGlow values={values} />
      <Petals values={values} velocity={velocity} />
      <Fireflies values={values} />
    </Canvas>
  )
}
