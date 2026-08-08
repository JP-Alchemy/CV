'use client'

import { ReactNode } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * Wraps a block whose SVG strokes should draw themselves in when scrolled
 * into view. Any descendant with class `draw` (on a path carrying
 * pathLength={1}) animates stroke-dashoffset 1 → 0; `fill-in` fades in.
 */
export default function InkScene({
  children,
  className = '',
  threshold = 0.2,
  as: Tag = 'div',
  id,
  ariaLabelledby,
}: {
  children: ReactNode
  className?: string
  threshold?: number
  as?: 'div' | 'section'
  id?: string
  ariaLabelledby?: string
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold })

  return (
    <Tag
      ref={ref as never}
      id={id}
      aria-labelledby={ariaLabelledby}
      className={`ink-scene ${inView ? 'in-view' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}
