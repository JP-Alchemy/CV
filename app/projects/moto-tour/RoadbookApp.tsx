'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './roadbook.css'
import raw from './roadbook-data.json'
import { markKoan } from '@/components/zen/koans'

/**
 * Roadbook — Leiden → the Alps → Leiden.
 * A faithful React port of the standalone roadbook: two Leaflet maps
 * (whole trip + day), twelve day sheets, costs, elevation profiles,
 * and GPX downloads generated in the browser.
 */

// ─── Data ───────────────────────────────────────────────────────────────────
type Via = [number, number, string, number]
type ProfilePt = [number, number, string | null]

interface FootItem { t: string; h: string; d: string }
interface Booked { status: string; price: string; nights: string; links: string[]; note: string }
interface Cost {
  n: number; bed: number; fuel: number; tolls: number; food: number; extras: number
  total: number; cum: number; bed_note: string; toll_note: string; food_note: string
  extras_note: string; fuel_note: string
}
interface Day {
  n: number; kind: 'ride' | 'light' | 'rest'; title: string; frm: string; to: string
  country: string; km: number; hrs: string; roads: string; why: string
  vias: Via[]; profile: ProfilePt[]; foot: FootItem[]; date: string; iso: string
  booked: Booked; cost: Cost
}
interface Hotel {
  days: number[]; name: string; town: string; where: string; lat: number; lon: number
  price: number; nights: number; checkin: string; checkout: string; note: string
  url: string; pid?: number | string; pid_note?: string
}
interface BudgetRow { item: string; amount: number; note: string }
interface Budget {
  subtotal: number; contingency: number; total: number; per_day: number
  rows: BudgetRow[]; before: { item: string; cost: string; note: string }[]; basis: string[]
}
interface Roadbook {
  days: Day[]; budget: Budget; warnings: { h: string; d: string }[]
  practical: { h: string; d: string }[]; costs: Cost[]; hotels: Hotel[]
}

const DATA = raw as unknown as Roadbook
const DAYS = DATA.days
const COSTS = DATA.costs
const HOTELS = DATA.hotels
const B = DATA.budget

const CBY: Record<number, Cost> = {}
COSTS.forEach((c) => (CBY[c.n] = c))
const HBY: Record<number, { h: Hotel; i: number }> = {}
HOTELS.forEach((h, i) => h.days.forEach((n) => (HBY[n] = { h, i })))

const eur = (n: number) => '€' + Math.round(n).toLocaleString('en-GB')
const eur2 = (n: number) => '€' + n.toFixed(2)
const pad = (n: number) => String(n).padStart(2, '0')

// some copy carries deliberate <b>/<br> markup from the source roadbook
function Html({ as: Tag = 'p', className, html }: { as?: 'p' | 'div' | 'span'; className?: string; html: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

// ─── GPX ────────────────────────────────────────────────────────────────────
function gpx(list: Day[], name: string): string {
  const e = (s: string | number) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let s = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Roadbook" xmlns="http://www.topografix.com/GPX/1/1">\n'
  s += '  <metadata><name>' + e(name) + '</name></metadata>\n'
  HOTELS.forEach((h) => {
    if (list.some((d) => h.days.indexOf(d.n) >= 0))
      s += '  <wpt lat="' + h.lat.toFixed(6) + '" lon="' + h.lon.toFixed(6) + '"><name>' + e(h.name) +
        '</name><desc>' + e(h.town) + '</desc><sym>Lodging</sym></wpt>\n'
  })
  list.forEach((d) => {
    if (d.kind === 'rest') return
    s += '  <rte>\n    <name>Day ' + pad(d.n) + ' - ' + e(d.title) + '</name>\n'
    d.vias.forEach((v) => {
      s += '    <rtept lat="' + v[0].toFixed(5) + '" lon="' + v[1].toFixed(5) + '"><name>' + e(v[2]) + '</name></rtept>\n'
    })
    s += '  </rte>\n'
  })
  return s + '</gpx>\n'
}

function save(fn: string, txt: string) {
  try {
    const u = URL.createObjectURL(new Blob([txt], { type: 'application/gpx+xml' }))
    const a = document.createElement('a')
    a.href = u
    a.download = fn
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(u)
      a.remove()
    }, 400)
  } catch {
    alert('Download blocked here — open this page in a full browser tab to save the GPX.')
  }
}

// ─── Geometry for the direction arrows ──────────────────────────────────────
function segLen(a: [number, number], b: [number, number]) {
  const k = Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180))
  return Math.hypot(b[0] - a[0], (b[1] - a[1]) * k)
}
function pointAt(pts: [number, number][], frac: number): [number, number, number] | null {
  let tot = 0
  const segs: number[] = []
  for (let i = 1; i < pts.length; i++) {
    const l = segLen(pts[i - 1], pts[i])
    segs.push(l)
    tot += l
  }
  if (tot <= 0) return null
  const target = tot * frac
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target || i === segs.length - 1) {
      const t = segs[i] ? Math.min(Math.max((target - acc) / segs[i], 0), 1) : 0
      const a = pts[i], b = pts[i + 1]
      const lat = a[0] + (b[0] - a[0]) * t
      const lng = a[1] + (b[1] - a[1]) * t
      const k = Math.cos(lat * (Math.PI / 180))
      const brg = (Math.atan2((b[1] - a[1]) * k, b[0] - a[0]) * 180) / Math.PI
      return [lat, lng, brg]
    }
    acc += segs[i]
  }
  return null
}
const endIcon = (cls: string, txt: string) =>
  L.divIcon({ html: '<div class="ep ' + cls + '">' + txt + '</div>', className: '', iconSize: [23, 23], iconAnchor: [11, 11] })
const arrowIcon = (brg: number) =>
  L.divIcon({
    className: '', iconSize: [15, 15], iconAnchor: [7, 7],
    html: '<svg class="arw" width="15" height="15" viewBox="0 0 14 14" style="transform:rotate(' + brg.toFixed(0) +
      'deg)"><path d="M7 0.6 L11.6 12.2 L7 9.5 L2.4 12.2 Z"/></svg>',
  })

// ─── SVG charts ─────────────────────────────────────────────────────────────
function SpendChart({ cur, active }: { cur: number; active: boolean }) {
  const W = 740, H = 250, x0 = 44, x1 = 724, base = 196, top = 26
  const maxDay = Math.max(...COSTS.map((c) => c.total))
  const maxCum = COSTS[COSTS.length - 1].cum
  const bw = (x1 - x0) / COSTS.length
  const Yd = (v: number) => base - (v / maxDay) * (base - top)
  const Yc = (v: number) => base - (v / maxCum) * (base - top)
  let dd = ''
  let dot: React.ReactNode = null
  COSTS.forEach((c, i) => {
    const cx = x0 + i * bw + bw / 2
    const cy = Yc(c.cum)
    dd += (i ? ' L' : 'M') + cx.toFixed(1) + ' ' + cy.toFixed(1)
    if (i === COSTS.length - 1) dot = <circle className="cdot" cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="3.2" />
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cost per day and running total">
      {[0.5, 1].map((f) => {
        const y = Yd(maxDay * f)
        return (
          <g key={f}>
            <line className="cgrid" x1={x0} y1={y.toFixed(1)} x2={x1} y2={y.toFixed(1)} />
            <text className="clab" x={x0 - 7} y={(y + 3).toFixed(1)} textAnchor="end">{eur(maxDay * f)}</text>
          </g>
        )
      })}
      {COSTS.map((c, i) => {
        const x = x0 + i * bw
        return (
          <rect
            key={c.n}
            className={'cbar' + (active && c.n === cur ? ' on' : '')}
            x={(x + 2.5).toFixed(1)}
            y={Yd(c.total).toFixed(1)}
            width={(bw - 5).toFixed(1)}
            height={Math.max(base - Yd(c.total), 1).toFixed(1)}
          >
            <title>{`Day ${c.n} · ${eur(c.total)}`}</title>
          </rect>
        )
      })}
      <line className="cbase" x1={x0} y1={base} x2={x1} y2={base} />
      <path className="cline" d={dd} />
      {dot}
      <text className="clabr" x={x1 + 4} y={(Yc(maxCum) + 3).toFixed(1)}>{eur(maxCum)}</text>
      {COSTS.map((c, i) => (
        <text key={c.n} className="clab" x={(x0 + i * bw + bw / 2).toFixed(1)} y={base + 13} textAnchor="middle">{c.n}</text>
      ))}
    </svg>
  )
}

function ProfileSvg({ d }: { d: Day }) {
  if (!d.profile.length)
    return (
      <svg viewBox="0 0 800 110" role="img" aria-label="No riding today">
        <line className="pbase" x1="30" y1="66" x2="770" y2="66" />
        <text className="flatlab" x="400" y="52" textAnchor="middle">on foot — nothing to climb</text>
      </svg>
    )
  const P = d.profile, x0 = 32, x1 = 768, base = 200, top = 78
  const maxKm = P[P.length - 1][0] || 1
  const scale = Math.max(...P.map((p) => p[1]), 400)
  const X = (k: number) => x0 + (k / maxKm) * (x1 - x0)
  const Y = (m: number) => base - (m / scale) * (base - top)
  let dd = ''
  P.forEach((p, i) => (dd += (i ? ' L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)))
  let hi = P[0]
  P.forEach((p) => { if (p[1] > hi[1]) hi = p })
  return (
    <svg viewBox="0 0 800 215" role="img" aria-label="Elevation profile">
      <line className="pbase" x1={x0} y1={base} x2={x1} y2={base} />
      <path className="pfill" d={`${dd} L${X(maxKm).toFixed(1)} ${base} L${x0} ${base} Z`} />
      <path className="pline" d={dd} />
      {P.filter((p) => p[2]).map((p, idx) => {
        const px = X(p[0]), py = Y(p[1]), is = p === hi
        return (
          <g key={idx}>
            <line className="ptick" x1={px.toFixed(1)} y1={(py - 3).toFixed(1)} x2={px.toFixed(1)} y2={(py - 11).toFixed(1)} />
            <text
              className={is ? 'phighlab' : 'plabel'}
              x={px.toFixed(1)} y={(py - 15).toFixed(1)}
              transform={`rotate(-55 ${px.toFixed(1)} ${(py - 15).toFixed(1)})`}
            >
              {p[2]}{is ? `  ${p[1]} m` : ''}
            </text>
          </g>
        )
      })}
      <circle className="phigh" cx={X(hi[0]).toFixed(1)} cy={Y(hi[1]).toFixed(1)} r="3.4" />
    </svg>
  )
}

// ─── Day detail ─────────────────────────────────────────────────────────────
function DayDetail({ n }: { n: number }) {
  const d = DAYS.find((x) => x.n === n)!
  const c = CBY[n]
  const hs = HBY[n]
  let maxM = 0
  d.profile.forEach((p) => { if (p[1] > maxM) maxM = p[1] })
  const figs: [string | number, string][] = [
    [d.km ? d.km + ' km' : '—', 'distance'],
    [d.hrs, 'in the saddle'],
    [d.vias.filter((v) => v[3]).length || '—', 'named passes'],
    [maxM ? maxM.toLocaleString('en-GB') + ' m' : '—', 'highest point'],
    [eur(c.total), 'cost today'],
    [eur(c.cum), 'spent by tonight'],
  ]
  const second = hs && hs.h.days.length > 1 && hs.h.days[1] === n
  const costRow = (l: string, a: number, nt?: string) => (
    <tr>
      <td>{l}{nt ? <span className="sub">{nt}</span> : null}</td>
      <td>{a === 0 ? '—' : eur2(a)}</td>
    </tr>
  )
  return (
    <>
      <div className="dhead">
        <div className="no">Day {pad(d.n)}{d.kind === 'rest' ? ' · rest' : d.kind === 'light' ? ' · easy' : ''}</div>
        <h2>{d.title}</h2>
        <div className="leg">{d.date} &nbsp;·&nbsp; {d.frm}{d.frm === d.to ? '' : ' → ' + d.to} &nbsp;·&nbsp; {d.country}</div>
      </div>
      <p className="why">{d.why}</p>
      <div className="figs">
        {figs.map((f, i) => (
          <div className="fig" key={i}><b>{f[0]}</b><span>{f[1]}</span></div>
        ))}
      </div>
      <div className="profile">
        <ProfileSvg d={d} />
        <div className="cap">{d.profile.length ? 'Approximate elevation profile' : 'No riding today'}</div>
      </div>
      <h3 className="lbl">The road</h3>
      <Html className="roads" html={d.roads} />
      {d.foot && d.foot.length > 0 && (
        <>
          <h3 className="lbl">{d.kind === 'rest' ? 'What to do with the day' : 'What to do with the time off'}</h3>
          <ul className="foot">
            {d.foot.map((f, i) => (
              <li key={i}>
                <div className="when">{f.t}</div>
                <div><h4>{f.h}</h4><p>{f.d}</p></div>
              </li>
            ))}
          </ul>
        </>
      )}
      {hs && (
        <>
          <h3 className="lbl">Where you sleep</h3>
          <div className="stay">
            <div className="st">{second ? 'Booked · second night' : 'Booked'}</div>
            <h4>{hs.h.name}</h4>
            <div className="m">
              {hs.h.town} · {hs.h.where} · {second ? `second night of ${hs.h.nights}` : `${eur2(hs.h.price)} · ${hs.h.nights} night${hs.h.nights > 1 ? 's' : ''}`}
            </div>
            <Html html={hs.h.note} />
            <div className="links">
              <a href={hs.h.url} target="_blank" rel="noopener noreferrer">Open on Booking ↗</a>
              {hs.h.pid ? <span className="pid">property ID {hs.h.pid}{hs.h.pid_note ? ' — ' + hs.h.pid_note : ''}</span> : null}
            </div>
          </div>
        </>
      )}
      <h3 className="lbl">What today costs</h3>
      <div className="daycost">
        <table>
          <tbody>
            {costRow('Bed', c.bed, c.bed_note)}
            {costRow('Fuel', c.fuel, c.fuel_note)}
            {c.tolls ? costRow('Tolls', c.tolls, c.toll_note) : null}
            {costRow('Food & drink', c.food, c.food_note)}
            {costRow('Parking, lifts, incidentals', c.extras, c.extras_note)}
            <tr className="sum"><td>Day {pad(d.n)}</td><td>{eur2(c.total)}</td></tr>
            <tr className="run"><td>Running total</td><td>{eur2(c.cum)} of {eur(B.total)}</td></tr>
          </tbody>
        </table>
      </div>
      {d.kind !== 'rest' && (
        <>
          <h3 className="lbl">Take it with you</h3>
          <button className="act" onClick={() => save('day-' + pad(n) + '.gpx', gpx([d], 'Day ' + n))}>
            Download day {pad(n)} (GPX)
          </button>
        </>
      )}
    </>
  )
}

// ─── The app ────────────────────────────────────────────────────────────────
export default function RoadbookApp() {
  // ?day=N deep-links straight into a day sheet (shareable, bookmarkable)
  const initial = (() => {
    if (typeof location === 'undefined') return { view: 'O' as const, cur: 1 }
    const n = parseInt(new URLSearchParams(location.search).get('day') ?? '')
    if (!isNaN(n) && n >= 1 && n <= DAYS.length) return { view: 'D' as const, cur: n }
    return { view: 'O' as const, cur: 1 }
  })()
  const [view, setView] = useState<'O' | 'D'>(initial.view)
  const [cur, setCur] = useState(initial.cur)

  const omapRef = useRef<L.Map | null>(null)
  const dmapRef = useRef<L.Map | null>(null)
  const dLinesRef = useRef<Record<number, L.Polyline>>({})
  const oLinesRef = useRef<L.Polyline[]>([])
  const oPinsRef = useRef<Record<number, L.Marker>>({})
  const dirLayerRef = useRef<L.LayerGroup | null>(null)
  const goDayRef = useRef<(n: number) => void>(() => {})
  const rootRef = useRef<HTMLDivElement>(null)
  // bumps when the site's day/night theme flips, so map ink follows
  const [themeTick, setThemeTick] = useState(0)

  const inkColors = () => {
    const el = rootRef.current
    const cs = el ? getComputedStyle(el) : null
    return {
      sumi: cs?.getPropertyValue('--sumi').trim() || '#171412',
      mist: cs?.getPropertyValue('--mist').trim() || '#9C968C',
    }
  }

  const goDay = useCallback((n: number) => {
    setCur(n)
    setView('D')
  }, [])
  goDayRef.current = goDay

  // the third koan lives inside this lantern — entering it counts
  useEffect(() => {
    markKoan('lantern')
  }, [])

  // follow the site's day/night theme
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // restyle the overview routes whenever the ink changes
  useEffect(() => {
    const { mist } = inkColors()
    oLinesRef.current.forEach((l) => l.setStyle({ color: mist }))
  }, [themeTick])

  // build both maps once
  useEffect(() => {
    const mk = (id: string) => {
      const m = L.map(id, { scrollWheelZoom: false, attributionControl: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 17, attribution: '© OpenStreetMap', opacity: 0.55,
      }).addTo(m)
      m.setView([47.2, 9.5], 6)
      return m
    }
    const omap = mk('omap')
    const dmap = mk('dmap')
    omapRef.current = omap
    dmapRef.current = dmap
    dirLayerRef.current = L.layerGroup().addTo(dmap)

    const boot = inkColors()
    const allPts: [number, number][] = []
    DAYS.forEach((d) => {
      const pts = d.vias.map((v) => [v[0], v[1]] as [number, number])
      pts.forEach((p) => allPts.push(p))
      if (pts.length > 1) {
        oLinesRef.current.push(
          L.polyline(pts, { color: boot.mist, weight: 2, opacity: 0.7 }).addTo(omap)
        )
        dLinesRef.current[d.n] = L.polyline(pts, { color: boot.mist, weight: 2, opacity: 0.45 }).addTo(dmap)
      }
    })

    HOTELS.forEach((h, i) => {
      const label = h.days.length > 1 ? h.days[0] + '·' + h.days[1] : String(h.days[0])
      const icon = L.divIcon({
        html: '<div class="pin" data-hi="' + i + '">' + label + '</div>',
        className: '', iconSize: [26, 26], iconAnchor: [13, 13],
      })
      const m = L.marker([h.lat, h.lon], { icon }).addTo(omap)
      const pop = document.createElement('div')
      pop.className = 'pop'
      pop.innerHTML =
        '<b>' + h.name + '</b><div class="m">' + h.town + ' · ' + h.checkin +
        (h.nights > 1 ? ' → ' + h.checkout : '') + ' · ' + eur2(h.price) + '</div>'
      const btn = document.createElement('button')
      btn.textContent = 'Open day ' + h.days[0]
      btn.addEventListener('click', () => goDayRef.current(h.days[0]))
      pop.appendChild(btn)
      pop.appendChild(document.createTextNode(' '))
      const book = document.createElement('a')
      book.className = 'popbook'
      book.href = h.url
      book.target = '_blank'
      book.rel = 'noopener noreferrer'
      book.textContent = 'Book ↗'
      pop.appendChild(book)
      m.bindPopup(pop)
      oPinsRef.current[i] = m
      allPts.push([h.lat, h.lon])
    })
    try {
      omap.fitBounds(L.latLngBounds(allPts).pad(0.05))
    } catch { /* empty bounds — impossible with real data */ }
    setTimeout(() => omap.invalidateSize(), 300)

    return () => {
      omap.remove()
      dmap.remove()
      omapRef.current = null
      dmapRef.current = null
      dLinesRef.current = {}
      oPinsRef.current = {}
      dirLayerRef.current = null
    }
  }, [])

  // view switches: both maps need fresh dimensions once visible
  useEffect(() => {
    omapRef.current?.invalidateSize()
    dmapRef.current?.invalidateSize()
    const t = setTimeout(() => {
      omapRef.current?.invalidateSize()
      dmapRef.current?.invalidateSize()
    }, 120)
    return () => clearTimeout(t)
  }, [view])

  // day view: highlight the day's line, draw direction, frame it
  useEffect(() => {
    if (view !== 'D') return
    const dmap = dmapRef.current
    const dirLayer = dirLayerRef.current
    if (!dmap || !dirLayer) return
    const day = DAYS.find((x) => x.n === cur)!
    const dLines = dLinesRef.current

    dmap.invalidateSize()
    const ink = inkColors()
    Object.keys(dLines).forEach((k) => {
      dLines[+k].setStyle(
        +k === cur
          ? { color: ink.sumi, weight: 3.2, opacity: 1 }
          : { color: ink.mist, weight: 2, opacity: 0.35 }
      )
    })

    // direction of travel
    dirLayer.clearLayers()
    const pts = day.vias.map((x) => [x[0], x[1]] as [number, number])
    if (pts.length > 1) {
      ;[0.18, 0.38, 0.58, 0.78].forEach((f) => {
        const p = pointAt(pts, f)
        if (p) L.marker([p[0], p[1]], { icon: arrowIcon(p[2]), interactive: false }).addTo(dirLayer)
      })
    }
    const s0 = pts[0]
    const e0 = pts[pts.length - 1]
    const loop = Math.abs(s0[0] - e0[0]) < 2e-4 && Math.abs(s0[1] - e0[1]) < 2e-4
    if (day.km === 0 || pts.length === 1) {
      L.marker(s0, { icon: endIcon('loop', '◎'), zIndexOffset: 900 }).addTo(dirLayer)
        .bindTooltip('Based at ' + day.frm, { permanent: true, direction: 'top', className: 'ept', offset: [0, -13] })
    } else if (loop) {
      L.marker(s0, { icon: endIcon('loop', 'S/E'), zIndexOffset: 900 }).addTo(dirLayer)
        .bindTooltip('Start & finish · ' + day.frm, { permanent: true, direction: 'top', className: 'ept', offset: [0, -13] })
    } else {
      L.marker(s0, { icon: endIcon('start', 'S'), zIndexOffset: 900 }).addTo(dirLayer)
        .bindTooltip('Start · ' + day.frm, { permanent: true, direction: 'top', className: 'ept', offset: [0, -13] })
      L.marker(e0, { icon: endIcon('end', 'E'), zIndexOffset: 901 }).addTo(dirLayer)
        .bindTooltip('End · ' + day.to, { permanent: true, direction: 'top', className: 'ept', offset: [0, -13] })
    }

    const line = dLines[cur]
    if (line) {
      try { line.bringToFront() } catch { /* renderer warming up */ }
      try { dmap.fitBounds(line.getBounds().pad(0.16)) }
      catch { dmap.setView([day.vias[0][0], day.vias[0][1]], 11) }
    } else {
      dmap.setView([day.vias[0][0], day.vias[0][1]], 12)
    }

    // pin highlight on the overview map
    document.querySelectorAll('.rb .pin').forEach((p) => p.classList.remove('on'))
    const hs = HBY[cur]
    if (hs) document.querySelector('.rb .pin[data-hi="' + hs.i + '"]')?.classList.add('on')

    // keep the active pill in view
    document.querySelector('.rb .pill[data-n="' + cur + '"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })

    const t = setTimeout(() => dmap.invalidateSize(), 120)
    return () => clearTimeout(t)
  }, [view, cur, themeTick])

  // arrow keys move between days
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'D') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goDay(Math.min(DAYS.length, cur + 1))
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goDay(Math.max(1, cur - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, cur, goDay])

  const km = DAYS.reduce((a, d) => a + d.km, 0)
  const passes = new Set<string>()
  DAYS.forEach((d) => d.vias.forEach((v) => { if (v[3]) passes.add(v[2]) }))
  let hi = 0
  DAYS.forEach((d) => d.profile.forEach((p) => { if (p[1] > hi) hi = p[1] }))
  const bignums: [boolean, string, string][] = [
    [true, eur(B.total), 'total, solo'],
    [false, eur(B.per_day), 'per day'],
    [false, km.toLocaleString('en-GB') + ' km', 'distance'],
    [false, '11', 'nights'],
    [false, String(passes.size), 'named passes'],
    [false, hi.toLocaleString('en-GB') + ' m', 'highest point'],
  ]

  return (
    <div className="rb" ref={rootRef}>
      <div className="topbar"><div className="inner">
        <Link href="/#lanterns" className="backlink" aria-label="Back to jpbothma.com">←</Link>
        <div className="brand">Leiden → the Alps → Leiden<small>24 Aug – 4 Sep 2026 · solo</small></div>
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={view === 'O'} onClick={() => { setView('O'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Overview</button>
          <button role="tab" aria-selected={view === 'D'} onClick={() => goDay(cur)}>Day by day</button>
        </div>
        <div className="chip"><b>{eur(B.total)}</b> &nbsp;·&nbsp; {eur(B.per_day)}/day</div>
      </div></div>

      <div className="strip" style={{ display: view === 'D' ? 'block' : 'none' }}>
        <div className="inner">
          {DAYS.map((d) => (
            <button
              key={d.n}
              className={'pill' + (d.kind !== 'ride' ? ' rest' : '')}
              data-n={d.n}
              aria-current={view === 'D' && cur === d.n}
              onClick={() => goDay(d.n)}
            >
              <b>{pad(d.n)}</b><span>{d.date.replace(/^\w+ /, '')}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wrap">
        {/* ── Overview ── */}
        <div className={'view' + (view === 'O' ? ' on' : '')}>
          <section className="blk">
            <h2 className="sec">The whole trip</h2>
            <p className="lede">
              Eleven nights, {km.toLocaleString('en-GB')} km. Back roads throughout, bar the transit across Germany. Every marker is a place you
              sleep — click one to open that day.
            </p>
            <div className="mapbox"><div id="omap" /></div>
            <div className="maphint">Numbered markers are stays · grey lines are the daily routes</div>
          </section>

          <section className="blk">
            <div className="bignums">
              {bignums.map(([hero, b, s], i) => (
                <div className={'bignum' + (hero ? ' hero' : '')} key={i}><b>{b}</b><span>{s}</span></div>
              ))}
            </div>
          </section>

          <section className="blk">
            <h3 className="lbl">Where you sleep</h3>
            <div className="stays">
              {HOTELS.map((h, i) => (
                <div className="stayrow" key={i}>
                  <button className="staymain" onClick={() => goDay(h.days[0])}>
                    <span className="no">{h.days.length > 1 ? `${h.days[0]}·${h.days[1]}` : h.days[0]}</span>
                    <span>
                      <span className="nm">{h.name}</span>
                      <span className="tw">
                        {h.town} · {h.where} · {h.checkin}{h.nights > 1 ? ' → ' + h.checkout : ''}{h.pid ? ` · ID ${h.pid}${h.pid_note ? ' (?)' : ''}` : ''}
                      </span>
                    </span>
                    <span className="pr">{eur2(h.price)}<small>{(h.nights > 1 ? h.nights + ' nights' : '1 night') + ' · booked'}</small></span>
                  </button>
                  <a className="staylink" href={h.url} target="_blank" rel="noopener noreferrer">Book ↗</a>
                </div>
              ))}
            </div>
          </section>

          <section className="blk">
            <h3 className="lbl">What it costs</h3>
            <div className="two">
              <div className="chartwrap">
                <SpendChart cur={cur} active={view === 'D'} />
                <div className="cap">Bars: spend per day · Line: running total</div>
              </div>
              <div>
                <table className="t">
                  <thead><tr><th>Where it goes</th><th>Amount</th></tr></thead>
                  <tbody>
                    {B.rows.map((r, i) => (
                      <tr key={i}><td>{r.item}<span className="sub">{r.note}</span></td><td>{eur(r.amount)}</td></tr>
                    ))}
                    <tr><td>Contingency at 10%<span className="sub">There are no spare days in this schedule.</span></td><td>{eur(B.contingency)}</td></tr>
                    <tr className="total"><td>Total</td><td>{eur(B.total)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <ul className="basis">{B.basis.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </section>

          <section className="blk">
            <h3 className="lbl">Worth knowing</h3>
            <div className="cards">
              {DATA.warnings.map((w, i) => (
                <div key={i}><h4>{w.h}</h4><p>{w.d}</p></div>
              ))}
            </div>
          </section>

          <section className="blk">
            <h3 className="lbl">Before you go</h3>
            <div className="cards">
              {DATA.practical.map((p, i) => (
                <div key={i}><h4>{p.h}</h4><p>{p.d}</p></div>
              ))}
            </div>
          </section>

          <section className="blk">
            <h3 className="lbl">Before you leave — not trip spending, but spend it anyway</h3>
            <table className="t">
              <tbody>
                {B.before.map((b, i) => (
                  <tr key={i}><td>{b.item}<span className="sub">{b.note}</span></td><td>{b.cost}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="blk">
            <button className="act" onClick={() => save('leiden-alps-leiden.gpx', gpx(DAYS, 'Leiden - Alps - Leiden'))}>
              Download all routes (GPX)
            </button>
          </section>
        </div>

        {/* ── Day by day ── */}
        <div className={'view' + (view === 'D' ? ' on' : '')}>
          <section className="blk">
            <div className="mapbox"><div id="dmap" /></div>
            <div className="maphint">
              This day in ink · <b style={{ color: 'var(--moss)' }}>S</b> start · <b style={{ color: 'var(--shu)' }}>E</b> end · arrows show direction of travel
            </div>
          </section>
          <div><DayDetail n={cur} /></div>
          <div className="nav">
            <button className="act" onClick={() => goDay(Math.max(1, cur - 1))}>← Previous</button>
            <button className="act" onClick={() => goDay(Math.min(DAYS.length, cur + 1))}>Next →</button>
          </div>
        </div>

        <footer>
          <p><strong>GPX.</strong> Via-point routes, not recorded tracks — your nav app calculates the roads
            between the points, which keeps live closures and your own preferences in play. Set it to avoid
            motorways on every day except 1 and 12.</p>
          <p><strong>Numbers.</strong> Distances, riding times and elevations are close estimates. All accommodation
            is booked; the prices shown are what was paid.</p>
          <p className="koan">Even an unlit lantern holds the shape of light.</p>
        </footer>
      </div>
    </div>
  )
}
