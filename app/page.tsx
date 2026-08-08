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
