/**
 * The still pond — SVG fallback shown when WebGL is unavailable
 * or the R3F scene hasn't loaded yet.
 */
export default function PondSvg() {
  return (
    <svg viewBox="0 0 420 300" aria-hidden="true" className="w-full">
      {/* bank */}
      <path
        d="M30,150 C30,95 110,60 210,60 C310,60 390,95 390,150 C390,205 310,240 210,240 C110,240 30,205 30,150 Z"
        pathLength={1}
        className="draw"
        fill="var(--pond)"
        stroke="var(--ink-soft)"
        strokeWidth="2.5"
        style={{ '--delay': '0.2s' } as React.CSSProperties}
      />
      {/* ripples */}
      <g style={{ transformOrigin: '210px 150px' }}>
        <ellipse className="ripple" style={{ '--delay': '0s', transformOrigin: '210px 150px' } as React.CSSProperties}
          cx="210" cy="150" rx="130" ry="62" fill="none" stroke="var(--ink-faint)" strokeWidth="1.2" />
        <ellipse className="ripple" style={{ '--delay': '2.3s', transformOrigin: '210px 150px' } as React.CSSProperties}
          cx="210" cy="150" rx="130" ry="62" fill="none" stroke="var(--ink-faint)" strokeWidth="1.2" />
        <ellipse className="ripple" style={{ '--delay': '4.6s', transformOrigin: '210px 150px' } as React.CSSProperties}
          cx="210" cy="150" rx="130" ry="62" fill="none" stroke="var(--ink-faint)" strokeWidth="1.2" />
      </g>
      {/* koi */}
      <g transform="translate(150,138)">
        <path d="M0,0 C10,-7 24,-6 32,0 C24,6 10,7 0,0 Z" fill="var(--ink)" opacity="0.8" />
        <path d="M30,0 C38,-6 44,-7 50,-3 C46,0 46,0 50,3 C44,7 38,6 30,0 Z" fill="var(--ink)" opacity="0.55" />
      </g>
      <g transform="translate(255,168) rotate(196)">
        <path d="M0,0 C10,-7 24,-6 32,0 C24,6 10,7 0,0 Z" fill="var(--vermilion)" opacity="0.85" />
        <path d="M30,0 C38,-6 44,-7 50,-3 C46,0 46,0 50,3 C44,7 38,6 30,0 Z" fill="var(--vermilion)" opacity="0.6" />
      </g>
      {/* reeds at the near bank */}
      <path
        d="M76,222 C80,200 76,182 82,164 M92,230 C94,210 90,196 96,178 M64,212 C66,196 62,184 66,170"
        pathLength={1}
        className="draw"
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ '--delay': '0.9s' } as React.CSSProperties}
      />
    </svg>
  )
}
