/**
 * The hanko — a vermilion seal stamp, used as logo and signature.
 * Pure SVG, no client JS.
 */
export default function Seal({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={className}
      style={{ transform: 'rotate(-3deg)' }}
    >
      <rect
        x="3" y="3" width="42" height="42" rx="7"
        fill="var(--vermilion)"
        opacity="0.92"
      />
      {/* slightly uneven edge, like a pressed stamp */}
      <rect
        x="3" y="3" width="42" height="42" rx="7"
        fill="none"
        stroke="var(--vermilion)"
        strokeWidth="1.5"
        opacity="0.5"
        transform="rotate(1.2 24 24)"
      />
      <text
        x="24" y="31"
        textAnchor="middle"
        fontFamily="var(--font-zen-serif), Georgia, serif"
        fontWeight="700"
        fontSize="20"
        fill="var(--paper)"
      >
        JP
      </text>
    </svg>
  )
}
