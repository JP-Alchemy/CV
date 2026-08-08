import ZenNav from '@/components/zen/ZenNav'
import Summit from '@/components/zen/Summit'
import Path from '@/components/zen/Path'
import Lanterns from '@/components/zen/Lanterns'
import Pond from '@/components/zen/Pond'
import TeaHouse from '@/components/zen/TeaHouse'
import Gate from '@/components/zen/Gate'

export default function Page() {
  return (
    <div className="zen-root min-h-screen">
      {/* ink-bleed: a whisper of turbulence that keeps strokes from looking vector-perfect */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
        <filter id="ink-bleed" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <ZenNav />
      <main>
        <Summit />
        <Path />
        <Lanterns />
        <Pond />
        <TeaHouse />
        <Gate />
      </main>
    </div>
  )
}
