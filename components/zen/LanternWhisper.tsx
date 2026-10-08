'use client'

import { useState, type ReactNode } from 'react'
import { markKoan } from './koans'

/**
 * The lantern that isn't lit yet holds the third koan. Pressing it
 * swaps the card's story for the whisper; pressing again brings the
 * story back.
 */
export default function LanternWhisper({
  className,
  style,
  lantern,
  title,
  children,
}: {
  className: string
  style: React.CSSProperties
  lantern: ReactNode
  title: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => {
        setOpen((v) => {
          if (!v) markKoan('lantern')
          return !v
        })
      }}
      className={`${className} cursor-pointer w-full`}
      style={style}
    >
      {lantern}
      {title}
      {open ? (
        <>
          <p className="zen-serif text-sm italic leading-relaxed" style={{ color: 'var(--ink)' }}>
            Even an unlit lantern
            <br />
            holds the shape of light.
          </p>
          <p className="mt-3 text-xs tracking-[0.15em] uppercase" style={{ color: 'var(--ink-faint)' }}>
            · a koan, kept warm ·
          </p>
        </>
      ) : (
        children
      )}
    </button>
  )
}
