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

// Crafted for click-through rate: lead with role + specialty + differentiator
const META_TITLE = 'JP Bothma — Creative Technologist | Interactive, Data-Viz & Sustainability'
const META_DESCRIPTION =
  'JP Bothma — creative technologist building interactive experiences, data visualisations, and sustainability-minded software. Based in Leiden — serving EU and global clients. Thoughtful technology for work that matters.'

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
    'creative technologist',
    'interactive developer',
    '3D web developer',
    'WebGL developer',
    'React-Three-Fiber developer',
    'data visualisation developer',
    'data visualisation consultant',
    'information design',
    'UX engineer',
    // Sustainability
    'sustainability engineering',
    'sustainable software',
    'digital product passport',
    'circular economy technology',
    'ESPR compliance',
    'GreenTech consultant',
    // Leadership
    'fractional CTO',
    'fractional CTO Netherlands',
    'tech lead Netherlands',
    'software architect Netherlands',
    // Location
    'creative technologist Leiden',
    'creative technologist Netherlands',
    'interactive developer Amsterdam',
    // Cross-market
    'SA EU tech bridge',
    'South Africa Netherlands technology',
    // Also available
    'OT security consultant',
    'ICS security assessment',
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
    jobTitle: 'Creative Technologist & Tech Lead',
    description:
      'Independent creative technologist specialising in interactive experiences, data visualisation, and sustainability-minded software. Based in Leiden, serving EU and global clients. Also available for fractional CTO engagements and OT security assessments.',
    url: SITE_URL,
    image: `${SITE_URL}/favicon.png`,
    sameAs: [
      'https://www.linkedin.com/in/jp-bothma',
      'https://github.com/jp-bothma',
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Leiden',
      addressRegion: 'Zuid-Holland',
      addressCountry: 'NL',
    },
    alumniOf: {
      '@type': 'EducationalOrganization',
      name: 'Pearson Institute',
      description: 'BSc Computer Science, Cum Laude',
    },
    knowsAbout: [
      'Creative Technology',
      'Interactive Design',
      '3D Web Development',
      'WebGL',
      'React-Three-Fiber',
      'Unity',
      'Unreal Engine',
      'Data Visualisation',
      'Information Design',
      'UX Engineering',
      'Sustainability Engineering',
      'Digital Product Passport',
      'Circular Economy',
      'Full-Stack Development',
      'Software Architecture',
      'Fractional CTO',
      'OT Security',
      'ICS Security',
    ],
    nationality: 'South African',
    workLocation: {
      '@type': 'Place',
      name: 'Leiden, Netherlands',
    },
  },

  // ProfessionalService — surfaces in local/service searches
  {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${SITE_URL}/#business`,
    name: 'JP Bothma Consulting',
    description:
      'Interactive experiences, data visualisation, and sustainability-minded software by JP Bothma — creative technologist and fractional CTO. Also available for OT/ICS security assessments for energy and industrial clients.',
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
            name: 'Interactive Experiences & 3D',
            description:
              'Real-time 3D, WebGL, and immersive interfaces for web and native platforms. React-Three-Fiber, Unity, Unreal. Built to be felt before they are understood.',
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
            name: 'Data Visualisation & Dashboards',
            description:
              'Operational dashboards, sustainability reporting, and custom visual tooling that turns complex data into something legible and useful.',
          },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '120',
            priceCurrency: 'EUR',
            unitText: 'HOUR',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Sustainability Engineering',
            description:
              'Software for the circular economy: digital product passports, lifecycle data pipelines, and measured-impact tooling. ESPR-aligned, built to last.',
          },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '120',
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
              'Part-time technical leadership for small teams. Strategy, architecture, hiring, and honest counsel — without the overhead of a full-time hire.',
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
            name: 'OT/ICS Security Assessments',
            description:
              'Available on request: security assessments for operational technology, wind, solar, and industrial control systems.',
          },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '150',
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
      'JP Bothma — creative technologist based in Leiden. Interactive experiences, data visualisation, and sustainability-minded software. Thoughtful technology for work that matters.',
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
