import { Github, Linkedin } from 'lucide-react'

// ── Personalise ───────────────────────────────────────────────────────────────
const NAME = 'JP Bothma'
const KVK_NUMBER = ''
const LINKEDIN_URL = 'https://www.linkedin.com/in/jp-bothma'
const GITHUB_URL = 'https://github.com/JP-Alchemy'
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Building', href: '#building' },
  { label: 'Contact', href: '#contact' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

          {/* Left — name + tagline */}
          <div>
            <p className="font-sans font-semibold text-sm text-[#f0f0f5] mb-0.5">{NAME}</p>
            <p className="font-sans text-xs text-[#6a6a85]">
              Made with care, between Leiden and Cape Town
            </p>
          </div>

          {/* Centre — nav links */}
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {NAV_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="font-sans text-xs text-[#6a6a85] hover:text-[#f0f0f5] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right — social + KVK */}
          <div className="flex items-center gap-4">
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-[#6a6a85] hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
            >
              <Linkedin size={16} />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-[#6a6a85] hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
            >
              <Github size={16} />
            </a>
          </div>
        </div>

        <div className="border-t border-border-subtle mt-8 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="font-sans text-xs text-[#6a6a85]">
            &copy; {year} {NAME}. All rights reserved.
          </p>
          <p className="font-sans text-xs text-[#6a6a85]">{KVK_NUMBER}</p>
        </div>
      </div>
    </footer>
  )
}
