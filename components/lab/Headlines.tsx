'use client'

import Link from 'next/link'
import Seal from '@/components/zen/Seal'
import { HEADLINE_HOURS } from './score'

/**
 * The brushed headlines — each surfaces at its hour of the day and
 * settles back into the paper as time moves on. All of them are real
 * links in the DOM at every hour (screen readers and keyboards see a
 * plain page); sight follows the sun.
 */

const FADE = 0.05 // how long a headline takes to surface / sink

function hourOpacity(t: number, from: number, to: number): number {
  if (t < from - FADE || t > to + FADE) return 0
  if (t < from) return (t - (from - FADE)) / FADE
  if (t > to) return 1 - (t - to) / FADE
  return 1
}

function headlineStyle(o: number): React.CSSProperties {
  return {
    opacity: o,
    transform: `translateY(${(1 - o) * 14}px)`,
    pointerEvents: o > 0.35 ? 'auto' : 'none',
    transition: 'opacity 320ms ease, transform 320ms ease',
  }
}

export default function Headlines({
  t,
  onEnterGarden,
}: {
  t: number
  onEnterGarden: () => void
}) {
  const H = HEADLINE_HOURS
  const oSig = hourOpacity(t, H.signature.from, H.signature.to)
  const oWork = hourOpacity(t, H.work.from, H.work.to)
  const oTea = hourOpacity(t, H.teahouse.from, H.teahouse.to)
  const oHello = hourOpacity(t, H.hello.from, H.hello.to)

  return (
    <div className="absolute inset-0 select-none" style={{ fontFamily: 'var(--font-zen-serif), Georgia, serif' }}>

      {/* dawn — the artist's mark */}
      <div
        className="absolute left-[7%] bottom-[16%] lab-headline"
        style={headlineStyle(oSig)}
      >
        <div className="flex items-end gap-4">
          <h1 className="text-5xl md:text-6xl tracking-tight leading-none" style={{ color: 'var(--ink)' }}>
            JP Bothma
          </h1>
          <Seal size={34} />
        </div>
        <p
          className="mt-3 text-sm tracking-[0.28em] uppercase"
          style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-zen-sans), system-ui, sans-serif' }}
        >
          creative technologist
        </p>
      </div>

      {/* noon — the passage to the work */}
      <div className="absolute left-[10%] top-[20%] lab-headline" style={headlineStyle(oWork)}>
        <button
          type="button"
          onClick={onEnterGarden}
          className="lab-link text-4xl md:text-5xl tracking-tight"
          style={{ color: 'var(--ink)' }}
          tabIndex={oWork > 0.35 ? 0 : -1}
        >
          the work
        </button>
        <p
          className="mt-2 text-[11px] tracking-[0.24em] uppercase"
          style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-zen-sans), system-ui, sans-serif' }}
        >
          four lanterns in a night garden
        </p>
      </div>

      {/* dusk — the tea house, back on the main scroll */}
      <div className="absolute left-[30%] bottom-[24%] lab-headline" style={headlineStyle(oTea)}>
        <Link
          href="/#teahouse"
          className="lab-link text-3xl md:text-4xl tracking-tight"
          style={{ color: 'var(--ink)' }}
          tabIndex={oTea > 0.35 ? 0 : -1}
        >
          the tea house
        </Link>
      </div>

      {/* night — beside the moon */}
      <div className="absolute left-[33%] top-[24%] lab-headline" style={headlineStyle(oHello)}>
        <Link
          href="/#gate"
          className="lab-link text-3xl md:text-4xl tracking-tight"
          style={{ color: 'var(--ink)' }}
          tabIndex={oHello > 0.35 ? 0 : -1}
        >
          say hello
        </Link>
      </div>
    </div>
  )
}
