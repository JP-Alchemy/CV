'use client'

import { useRef, useState } from 'react'
import HeroPainting from './HeroPainting'
import Headlines from './Headlines'
import { useDayScroll } from './useDayScroll'

/**
 * The scene manager. One painting and the runway that turns its day;
 * the garden and the ink-bloom passage arrive in phase ⑤.
 */
export default function InkWorld() {
  const frameRef = useRef<HTMLDivElement>(null)
  const { t } = useDayScroll(frameRef)
  const [, setScene] = useState<'hero' | 'garden'>('hero')

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
        <HeroPainting />
        <Headlines t={t} onEnterGarden={() => setScene('garden')} />

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
      </div>
    </div>
  )
}
