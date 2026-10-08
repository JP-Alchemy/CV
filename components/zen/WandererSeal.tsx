'use client'

import { useEffect, useState } from 'react'
import { allKoansFound, onKoanFound } from './koans'

/**
 * The wanderer's seal — a second, smaller hanko that appears beside
 * the name only for those who found all three hidden koans.
 * Nothing announces it. It is simply there, from then on.
 */
export default function WandererSeal() {
  const [earned, setEarned] = useState(false)
  const [justNow, setJustNow] = useState(false)

  useEffect(() => {
    setEarned(allKoansFound())
    return onKoanFound(() => {
      if (allKoansFound()) {
        setEarned(true)
        setJustNow(true)
      }
    })
  }, [])

  if (!earned) return null

  return (
    <span
      className={`inline-block ${justNow ? 'stamp-press stamp-bloom rounded-md' : ''}`}
      title="The wanderer's seal — you found all three koans"
      aria-label="The wanderer's seal — you found all three hidden koans"
      role="img"
    >
      <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" style={{ transform: 'rotate(4deg)' }}>
        <rect x="3" y="3" width="42" height="42" rx="21" fill="var(--vermilion)" opacity="0.85" />
        {/* a tiny ensō pressed in paper-white */}
        <path
          d="M 33 14 A 12.5 12.5 0 1 1 30 34"
          fill="none"
          stroke="var(--paper)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
