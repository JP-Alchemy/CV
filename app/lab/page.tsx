import type { Metadata } from 'next'
import InkWorld from '@/components/lab/InkWorld'

export const metadata: Metadata = {
  title: 'The Living Painting — an experiment',
  description: 'A sumi-e painting that keeps time. Scroll turns the day.',
  robots: { index: false, follow: false },
}

export default function LabPage() {
  return <InkWorld />
}
