'use client'

import { lazy, Suspense, useEffect, useState } from 'react'

// Leaflet touches `window` at import time — the app must only ever
// load in the browser
const RoadbookApp = lazy(() => import('./RoadbookApp'))

function Unrolling() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#DFDCD3', color: '#6E6960',
      fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
      fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
    }}>
      unrolling the map…
    </div>
  )
}

export default function RoadbookShell({ fontClass }: { fontClass: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className={fontClass}>
      {mounted ? (
        <Suspense fallback={<Unrolling />}>
          <RoadbookApp />
        </Suspense>
      ) : (
        <Unrolling />
      )}
    </div>
  )
}
