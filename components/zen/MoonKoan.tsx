'use client'

import { useEffect, useRef } from 'react'
import { markKoan } from './koans'

/**
 * The second koan hides behind the moon — it only exists at night,
 * a few faint lines beneath the toggle in the summit sky.
 */
export default function MoonKoan() {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let inView = false

    const check = () => {
      if (inView && document.documentElement.getAttribute('data-theme') === 'night') {
        markKoan('moon')
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
        check()
      },
      { threshold: 0.9 }
    )
    observer.observe(el)

    const themeWatch = new MutationObserver(check)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
      themeWatch.disconnect()
    }
  }, [])

  return (
    <p
      ref={ref}
      className="moon-koan mt-3 max-w-[180px] text-right text-[11px] italic leading-relaxed select-none"
      style={{ color: 'var(--ink-faint)' }}
    >
      The moon does not try to reflect itself.
      <br />
      The water does not try to hold it.
    </p>
  )
}
