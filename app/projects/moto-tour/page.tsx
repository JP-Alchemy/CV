import type { Metadata } from 'next'
import { Zen_Old_Mincho, IBM_Plex_Mono } from 'next/font/google'
import RoadbookShell from './RoadbookShell'

const zenOldMincho = Zen_Old_Mincho({
  variable: '--font-rb-display',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-rb-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Roadbook — Leiden to the Alps, 24 Aug – 4 Sep 2026',
  description:
    'A twelve-day solo motorcycle roadbook: Leiden to the Alps and back. Eleven nights, 3,625 km, every pass, bed, and euro accounted for — with GPX routes to take with you.',
}

export default function MotoTourPage() {
  return <RoadbookShell fontClass={`${zenOldMincho.variable} ${plexMono.variable}`} />
}
