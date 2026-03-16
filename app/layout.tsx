import type { Metadata } from 'next'
import { DM_Serif_Display, DM_Sans } from 'next/font/google'
import './globals.css'

const dmSerifDisplay = DM_Serif_Display({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})

const dmSans = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

// ── Personalise these ──────────────────────────────────────────────────────────
const SITE_NAME = 'JP Bothma'
const SITE_URL = 'https://jpbothma.com'
// ──────────────────────────────────────────────────────────────────────────────

// Crafted for click-through rate: lead with location + specialty + differentiator
const META_TITLE = 'JP Bothma — OT/ICS Security Consultant & Tech Lead | Amsterdam'
const META_DESCRIPTION =
  'OT/ICS security assessments, fractional CTO, and GreenTech consulting by JP Bothma. NIS2-ready. Based in Amsterdam — serving EU and global clients. SA↔EU bridge.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  title: {
    default: META_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: META_DESCRIPTION,
  // Broad keyword set covering all services and long-tail searches
  keywords: [
    // Core services
    'OT security consultant',
    'ICS security consultant',
    'operational technology security',
    'industrial control systems security',
    'NIS2 compliance consultant',
    'SCADA security',
    'OT penetration testing',
    // Location-specific (high commercial intent)
    'OT security consultant Amsterdam',
    'ICS security Netherlands',
    'cybersecurity consultant Amsterdam',
    'fractional CTO Amsterdam',
    'tech lead Netherlands',
    // GreenTech / IoT
    'GreenTech consultant',
    'IoT security consultant',
    'energy transition technology',
    'smart grid security',
    'digital product passport',
    'circular economy technology',
    // Cross-market
    'SA EU tech bridge',
    'South Africa Netherlands technology',
    // Broader
    'full stack consultant',
    'software architect Netherlands',
    'red team training',
    'security awareness training',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  // Canonical + alternates
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_NL',
    alternateLocale: ['en_ZA', 'en_GB'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: META_TITLE,
    description: META_DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: META_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: META_TITLE,
    description: META_DESCRIPTION,
    creator: '@jpbothma', // update if you have a Twitter/X handle
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  // Verification — add your tokens once the site is live
  verification: {
    google: 'gV7fZJspVr47lEmPlS5RqDFiHe2BN9ViEN6m61_QGaM',
    //   yandex: 'your-yandex-token',
  },
}

// ── JSON-LD Structured Data ───────────────────────────────────────────────────
const jsonLd = [
  // Person schema — enables Google Knowledge Panel
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/#person`,
    name: 'JP Bothma',
    givenName: 'JP',
    familyName: 'Bothma',
    jobTitle: 'OT/ICS Security Consultant & Tech Lead',
    description:
      'Independent technology consultant specialising in OT/ICS cybersecurity, GreenTech engineering, and fractional CTO services. Based in Amsterdam, serving EU and global clients.',
    url: SITE_URL,
    image: `${SITE_URL}/favicon.png`,
    sameAs: [
      'https://www.linkedin.com/in/jp-bothma',
      'https://github.com/jp-bothma',
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Amsterdam',
      addressRegion: 'Noord-Holland',
      addressCountry: 'NL',
    },
    alumniOf: {
      '@type': 'EducationalOrganization',
      name: 'Pearson Institute',
      description: 'BSc Computer Science, Cum Laude',
    },
    knowsAbout: [
      'OT Security',
      'ICS Security',
      'SCADA Security',
      'NIS2 Compliance',
      'Penetration Testing',
      'GreenTech',
      'IoT',
      'Embedded Systems',
      'Full-Stack Development',
      'Software Architecture',
      'AI Integration',
      'Fractional CTO',
      'Digital Product Passport',
      'Circular Economy',
    ],
    nationality: 'South African',
    workLocation: {
      '@type': 'Place',
      name: 'Amsterdam, Netherlands',
    },
  },

  // ProfessionalService — surfaces in local/service searches
  {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${SITE_URL}/#business`,
    name: 'JP Bothma Consulting',
    description:
      'OT/ICS security assessments and penetration testing, fractional CTO services, GreenTech & IoT engineering, and security red team training for energy infrastructure and technology companies across the EU.',
    url: SITE_URL,
    telephone: null,
    founder: { '@id': `${SITE_URL}/#person` },
    areaServed: [
      { '@type': 'Country', name: 'Netherlands' },
      { '@type': 'Place', name: 'European Union' },
      { '@type': 'Country', name: 'South Africa' },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Consulting Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'OT/ICS Security Assessments',
            description:
              'Penetration testing and security audits for operational technology: wind, solar, and industrial control systems. NIS2-ready methodology.',
          },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '150',
            priceCurrency: 'EUR',
            unitText: 'HOUR',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Fractional CTO',
            description:
              'Part-time technical leadership for scale-ups building in AI, hardware, or regulated industries. Strategy, architecture, and team direction.',
          },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '130',
            priceCurrency: 'EUR',
            unitText: 'HOUR',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'GreenTech & IoT Consulting',
            description:
              'Hardware and software solutions for the energy transition. Smart systems, sensor networks, and circular economy infrastructure.',
          },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '110',
            priceCurrency: 'EUR',
            unitText: 'HOUR',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Security Training & Red Team',
            description:
              'Custom red team exercises, developer security training, and incident response preparation for engineering teams.',
          },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '120',
            priceCurrency: 'EUR',
            unitText: 'HOUR',
          },
        },
      ],
    },
  },

  // WebSite — enables Sitelinks search box if Google decides to show it
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description:
      'JP Bothma — OT/ICS security consultant and GreenTech tech lead based in Amsterdam. NIS2-ready assessments, fractional CTO, and SA↔EU technical leadership.',
    author: { '@id': `${SITE_URL}/#person` },
    inLanguage: 'en',
  },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${dmSans.variable}`}
    >
      <body className="bg-bg text-[#f0f0f5] font-sans antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  )
}
