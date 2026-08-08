'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'

/**
 * 四 · The living pond — ink-wash water you can touch.
 *
 * A custom ripple shader carries expanding ink rings; four koi wander
 * with simple steering, leave wakes, and gather toward a held press.
 * Colors are read from the page's CSS custom properties so the pond
 * changes with day and night.
 */

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_RIPPLES = 24
const POND_RX = 4.2 // world half-width of the water ellipse
const POND_RZ = 2.7 // world half-depth
const KOI_RX = 3.3 // swimming bounds
const KOI_RZ = 2.0

// ─── Theme colors from CSS custom properties ───────────────────────────────
interface ZenColors {
  paper: THREE.Color
  pond: THREE.Color
  ink: THREE.Color
  inkSoft: THREE.Color
  vermilion: THREE.Color
  night: number
}

function readZenColors(): ZenColors {
  const cs = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim()
    return new THREE.Color(v || fallback)
  }
  return {
    paper: read('--paper', '#f4efe4'),
    pond: read('--pond', '#d8d2c0'),
    ink: read('--ink', '#211f1b'),
    inkSoft: read('--ink-soft', '#4c473e'),
    vermilion: read('--vermilion', '#c1392b'),
    night: document.documentElement.getAttribute('data-theme') === 'night' ? 1 : 0,
  }
}

function useZenColors(): ZenColors {
  const [colors, setColors] = useState<ZenColors | null>(null)

  useEffect(() => {
    setColors(readZenColors())
    const observer = new MutationObserver(() => setColors(readZenColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return colors ?? {
    paper: new THREE.Color('#f4efe4'),
    pond: new THREE.Color('#d8d2c0'),
    ink: new THREE.Color('#211f1b'),
    inkSoft: new THREE.Color('#4c473e'),
    vermilion: new THREE.Color('#c1392b'),
    night: 0,
  }
}

// ─── Ripple pool (shared via ref) ───────────────────────────────────────────
interface RipplePool {
  data: Float32Array // vec4 per ripple: x, z, startTime, amplitude
  cursor: number
  add: (x: number, z: number, amp: number, time: number) => void
}

function makeRipplePool(): RipplePool {
  const data = new Float32Array(MAX_RIPPLES * 4)
  data.fill(-1000, 0) // ancient start times → inert
  const pool: RipplePool = {
    data,
    cursor: 0,
    add(x, z, amp, time) {
      const i = pool.cursor * 4
      data[i] = x
      data[i + 1] = z
      data[i + 2] = time
      data[i + 3] = amp
      pool.cursor = (pool.cursor + 1) % MAX_RIPPLES
    },
  }
  return pool
}

// ─── Water ──────────────────────────────────────────────────────────────────
const WATER_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying float vEdge;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vEdge = length(position.xy); // CircleGeometry: local radius 0..1
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPond;
  uniform vec3 uInk;
  uniform vec3 uInkSoft;
  uniform vec3 uPaper;
  uniform float uNight;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  varying vec3 vWorld;
  varying float vEdge;

  void main() {
    float ink = 0.0;

    // expanding ripple rings
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (age > 0.0 && age < 5.0) {
        float radius = age * 1.1;
        float width = 0.03 + age * 0.055;
        float d = distance(vWorld.xz, r.xy);
        float ring = 1.0 - smoothstep(0.0, width, abs(d - radius));
        // trailing echo ring, half strength
        float echo = 1.0 - smoothstep(0.0, width * 0.8, abs(d - radius * 0.62));
        float fade = exp(-age * 1.05) * r.w;
        ink += (ring + echo * 0.35) * fade;
      }
    }

    // quiet breeze shimmer
    float s = sin(vWorld.x * 2.1 + uTime * 0.42) * sin(vWorld.z * 3.4 - uTime * 0.31);
    ink += smoothstep(0.86, 1.0, s) * 0.05;

    // moon's reflection at night — a pale, trembling coin of light
    vec2 moonAt = vec2(2.2, -1.05);
    float md = distance(vWorld.xz, moonAt);
    float wobble = sin(uTime * 0.9 + vWorld.x * 3.0) * 0.04;
    float moon = (1.0 - smoothstep(0.1, 0.55 + wobble, md)) * uNight * 0.5;

    // brushed rim where water meets bank — a thin, confident stroke
    float rim = smoothstep(0.955, 0.985, vEdge) * (1.0 - smoothstep(0.988, 1.0, vEdge));

    vec3 col = uPond;
    col = mix(col, uInk, clamp(ink, 0.0, 0.8) * 0.55);
    col = mix(col, uPaper, moon);
    col = mix(col, uInkSoft, rim * 0.8);

    gl_FragColor = vec4(col, 1.0);
  }
`

function Water({
  colors,
  pool,
  onTouch,
}: {
  colors: ZenColors
  pool: RipplePool
  onTouch: (x: number, z: number, strong: boolean) => void
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const lastWake = useRef(0)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPond: { value: new THREE.Color() },
      uInk: { value: new THREE.Color() },
      uInkSoft: { value: new THREE.Color() },
      uPaper: { value: new THREE.Color() },
      uNight: { value: 0 },
      uRipples: { value: pool.data },
    }),
    [pool]
  )

  useEffect(() => {
    uniforms.uPond.value.copy(colors.pond)
    uniforms.uInk.value.copy(colors.ink)
    uniforms.uInkSoft.value.copy(colors.inkSoft)
    uniforms.uPaper.value.copy(colors.paper)
    uniforms.uNight.value = colors.night
  }, [colors, uniforms])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
  })

  function pointOf(e: ThreeEvent<PointerEvent>) {
    return { x: e.point.x, z: e.point.z }
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[POND_RX, POND_RZ, 1]}
      onPointerMove={(e) => {
        const now = performance.now()
        if (now - lastWake.current < 90) return
        lastWake.current = now
        const { x, z } = pointOf(e)
        onTouch(x, z, false)
      }}
      onPointerDown={(e) => {
        const { x, z } = pointOf(e)
        onTouch(x, z, true)
      }}
    >
      <circleGeometry args={[1, 96]} />
      <shaderMaterial
        ref={material}
        vertexShader={WATER_VERT}
        fragmentShader={WATER_FRAG}
        uniforms={uniforms}
      />
    </mesh>
  )
}

// ─── Koi ────────────────────────────────────────────────────────────────────
function paintKoiBody(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 256, 128)

  // body — a brushed teardrop, head to the right
  ctx.fillStyle = color
  ctx.globalAlpha = 0.92
  ctx.beginPath()
  ctx.moveTo(56, 64)
  ctx.bezierCurveTo(96, 26, 168, 22, 208, 48)
  ctx.bezierCurveTo(228, 58, 228, 70, 208, 80)
  ctx.bezierCurveTo(168, 106, 96, 102, 56, 64)
  ctx.closePath()
  ctx.fill()

  // pectoral fins — tucked against the body
  ctx.globalAlpha = 0.32
  ctx.beginPath()
  ctx.ellipse(148, 38, 17, 7, -0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(148, 90, 17, 7, 0.55, 0, Math.PI * 2)
  ctx.fill()

  // head shade — the faintest ink pooling
  const g = ctx.createRadialGradient(206, 64, 4, 206, 64, 36)
  g.addColorStop(0, 'rgba(0,0,0,0.10)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(202, 64, 36, 30, 0, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 2
  return tex
}

function paintKoiTail(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 96, 128)
  ctx.fillStyle = color

  // flowing twin-lobe tail, attached at the right edge
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(92, 64)
  ctx.bezierCurveTo(56, 40, 26, 18, 8, 30)
  ctx.bezierCurveTo(28, 50, 40, 58, 92, 64)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(92, 64)
  ctx.bezierCurveTo(56, 88, 26, 110, 8, 98)
  ctx.bezierCurveTo(28, 78, 40, 70, 92, 64)
  ctx.closePath()
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 2
  return tex
}

interface KoiState {
  x: number
  z: number
  heading: number
  speed: number
  phase: number
  lastWake: number
}

function Koi({
  colorCss,
  seed,
  pool,
  attract,
}: {
  colorCss: string
  seed: number
  pool: RipplePool
  attract: React.MutableRefObject<{ x: number; z: number; until: number } | null>
}) {
  const group = useRef<THREE.Group>(null)
  const tailPivot = useRef<THREE.Group>(null)
  const state = useRef<KoiState>({
    x: Math.cos(seed * 2.4) * KOI_RX * 0.6,
    z: Math.sin(seed * 3.1) * KOI_RZ * 0.6,
    heading: seed * 2.4,
    speed: 0.5 + (seed % 1) * 0.18,
    phase: seed * 7.3,
    lastWake: 0,
  })

  const bodyTex = useMemo(() => paintKoiBody(colorCss), [colorCss])
  const tailTex = useMemo(() => paintKoiTail(colorCss), [colorCss])
  useEffect(() => () => {
    bodyTex.dispose()
    tailTex.dispose()
  }, [bodyTex, tailTex])

  useFrame(({ clock }, rawDt) => {
    const s = state.current
    const t = clock.elapsedTime
    const dt = Math.min(rawDt, 1 / 30) // no teleporting after tab sleep

    // wander — slow sinuous drift, unique per fish
    let turn = Math.sin(t * 0.37 + s.phase) * 0.45 + Math.sin(t * 0.13 + s.phase * 2.7) * 0.25

    // gather toward a held press
    const target = attract.current
    if (target && t < target.until) {
      const desired = Math.atan2(target.z - s.z, target.x - s.x)
      let diff = desired - s.heading
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      turn += THREE.MathUtils.clamp(diff, -1, 1) * 2.6
    }

    // stay inside the pond — steer home as the bank nears
    const e = (s.x / KOI_RX) ** 2 + (s.z / KOI_RZ) ** 2
    if (e > 0.7) {
      const home = Math.atan2(-s.z, -s.x)
      let diff = home - s.heading
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      turn += THREE.MathUtils.clamp(diff, -1.4, 1.4) * (e - 0.7) * 9
    }

    s.heading += turn * dt
    s.x += Math.cos(s.heading) * s.speed * dt
    s.z += Math.sin(s.heading) * s.speed * dt

    // a quiet wake every second or so
    if (t - s.lastWake > 1.15 + (s.phase % 0.7)) {
      s.lastWake = t
      pool.add(s.x, s.z, 0.07, t)
    }

    const g = group.current
    if (g) {
      g.position.set(s.x, 0.02, s.z)
      // swim wiggle laid over the heading
      g.rotation.y = -s.heading + Math.sin(t * 6 + s.phase) * 0.07
    }
    const tail = tailPivot.current
    if (tail) {
      tail.rotation.y = Math.sin(t * 6 + s.phase + 2.1) * 0.45
    }
  })

  return (
    <group ref={group}>
      {/* body: 1.05 × 0.52 world units, head +x */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.06, 0, 0]}>
        <planeGeometry args={[1.05, 0.52]} />
        <meshBasicMaterial map={bodyTex} transparent depthWrite={false} />
      </mesh>
      {/* tail swings from the body's rear */}
      <group ref={tailPivot} position={[-0.34, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.17, 0, 0]}>
          <planeGeometry args={[0.39, 0.52]} />
          <meshBasicMaterial map={tailTex} transparent depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

// ─── Scene ──────────────────────────────────────────────────────────────────
function Scene({ colors }: { colors: ZenColors }) {
  const pool = useMemo(makeRipplePool, [])
  const attract = useRef<{ x: number; z: number; until: number } | null>(null)
  const clockRef = useRef<THREE.Clock | null>(null)

  useFrame(({ clock }) => {
    clockRef.current = clock
  })

  const inkCss = colors.night ? '#e6e1d3' : '#211f1b'
  const inkSoftCss = colors.night ? '#b3ada0' : '#4c473e'
  const vermCss = colors.night ? '#e05545' : '#c1392b'

  return (
    <>
      <Water
        colors={colors}
        pool={pool}
        onTouch={(x, z, strong) => {
          const t = clockRef.current?.elapsedTime ?? 0
          pool.add(x, z, strong ? 0.9 : 0.22, t)
          if (strong) {
            attract.current = { x, z, until: t + 3 }
          }
        }}
      />
      <Koi colorCss={vermCss} seed={1} pool={pool} attract={attract} />
      <Koi colorCss={inkCss} seed={2} pool={pool} attract={attract} />
      <Koi colorCss={inkSoftCss} seed={3} pool={pool} attract={attract} />
      <Koi colorCss={vermCss} seed={4} pool={pool} attract={attract} />
    </>
  )
}

export default function PondScene({ paused }: { paused: boolean }) {
  const colors = useZenColors()

  return (
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true }}
      camera={{ position: [0, 11.2, 1.6], fov: 30 }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0)
        camera.lookAt(0, 0, 0)
      }}
      style={{ position: 'absolute', inset: 0 }}
      aria-label="An ink-wash pond — move to stir the water, press to call the koi"
      role="img"
    >
      <Scene colors={colors} />
    </Canvas>
  )
}
