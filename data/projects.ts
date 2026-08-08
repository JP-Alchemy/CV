// ─── The lantern registry ────────────────────────────────────────────────────
// One entry per gift. Adding a project = one entry here + your custom page
// (internal under app/projects/<id>/ or an external link).
//
// state:
//   'lit'      — live, out in the world (lantern glows)
//   'kindling' — being built right now (small flame, not yet steady)
//   'ember'    — resting / archived (unlit ink sketch)

export type LanternState = 'lit' | 'kindling' | 'ember'

export interface Project {
  id: string
  name: string
  story: string // one line, told like a gift, not a spec
  state: LanternState
  href: string | null // external URL or internal route; null = no page yet
  external?: boolean
}

export const PROJECTS: Project[] = [
  {
    id: 'nezen',
    name: 'nezen.io',
    story: 'One zen story each morning, by email or WhatsApp. A quiet corner of the internet for slowing down.',
    state: 'lit',
    href: 'https://nezen.io',
    external: true,
  },
  {
    id: 'moto-tour',
    name: 'Motorcycle Tour Framework',
    story: 'A free, self-guided touring kit — click, book, download the route, and ride your own adventure.',
    state: 'kindling',
    href: null,
  },
  {
    id: 'what-the-duck',
    name: 'What The Duck',
    story: 'A physics-driven 3D browser game. Ducks, levels, and a healthy amount of mayhem.',
    state: 'lit',
    href: 'https://wtd.jpbothma.com',
    external: true,
  },
  {
    id: 'cyberspace-central',
    name: 'Cyberspace Central',
    story: 'A scroll-driven, neon-soaked 3D web experience — interdimensional stories told through WebGL.',
    state: 'lit',
    href: 'https://contendo.jpbothma.com',
    external: true,
  },
]
