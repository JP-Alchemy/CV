import type { Metadata } from 'next'
import CVPage from '@/components/CVPage'

const SITE_URL = 'https://jpbothma.com'

// Sharp, keyword-rich title — will appear as:
// "JP Bothma CV — Tech Lead | OT Security | GreenTech | Amsterdam"
export const metadata: Metadata = {
  title: 'CV — Tech Lead | OT/ICS Security | GreenTech | 8+ Years',
  description:
    'Full career history of JP Bothma: Tech Lead, CTO, OT/ICS Security, GreenTech IoT, FinTech, AR/VR. BSc Computer Science Cum Laude. Amsterdam-based, globally available.',
  alternates: {
    canonical: `${SITE_URL}/cv`,
  },
  openGraph: {
    type: 'profile',
    firstName: 'JP',
    lastName: 'Bothma',
    username: 'jp-bothma',
    gender: 'male',
    url: `${SITE_URL}/cv`,
    title: 'JP Bothma — Full CV & Career History',
    description:
      'Tech Lead with 8+ years across OT/ICS security, GreenTech, FinTech, AR/VR, and full-stack engineering. BSc Computer Science Cum Laude. Based in Amsterdam.',
    images: [{ url: '/cv-og-image.png', width: 1200, height: 630, alt: 'JP Bothma — CV' }],
  },
}

// CV-specific JSON-LD: ProfilePage + detailed work history
const cvJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  '@id': `${SITE_URL}/cv`,
  name: 'JP Bothma — CV',
  url: `${SITE_URL}/cv`,
  dateModified: new Date().toISOString().split('T')[0],
  about: { '@id': `${SITE_URL}/#person` },
  mainEntity: {
    '@type': 'Person',
    '@id': `${SITE_URL}/#person`,
    name: 'JP Bothma',
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name: "Bachelor's Degree, Computer Science",
      recognizedBy: { '@type': 'EducationalOrganization', name: 'Pearson Institute' },
      description: 'Cum Laude, 2014–2016',
    },
    hasOccupation: [
      {
        '@type': 'Role',
        roleName: 'Lead Sustainability Developer',
        startDate: '2024-03',
        worksFor: { '@type': 'Organization', name: 'Interfood Group', address: { '@type': 'PostalAddress', addressLocality: 'Eindhoven', addressCountry: 'NL' } },
      },
      {
        '@type': 'Role',
        roleName: 'Senior Developer & Lead Innovation Specialist',
        startDate: '2023-01',
        endDate: '2024-03',
        worksFor: { '@type': 'Organization', name: 'PWXR', address: { '@type': 'PostalAddress', addressLocality: 'Rotterdam', addressCountry: 'NL' } },
      },
      {
        '@type': 'Role',
        roleName: 'Tech Lead',
        startDate: '2022-10',
        endDate: '2023-01',
        worksFor: { '@type': 'Organization', name: 'Talk360', address: { '@type': 'PostalAddress', addressLocality: 'Amsterdam', addressCountry: 'NL' } },
      },
      {
        '@type': 'Role',
        roleName: 'CTO',
        startDate: '2021-03',
        endDate: '2022-10',
        worksFor: { '@type': 'Organization', name: 'LIT Trading & WWA Trading', address: { '@type': 'PostalAddress', addressLocality: 'Dubai', addressCountry: 'AE' } },
      },
      {
        '@type': 'Role',
        roleName: 'CTO & Founder',
        startDate: '2021-02',
        endDate: '2022-10',
        worksFor: { '@type': 'Organization', name: 'Vaultron.io', address: { '@type': 'PostalAddress', addressLocality: 'Dubai', addressCountry: 'AE' } },
      },
      {
        '@type': 'Role',
        roleName: 'Lead Developer & Co-Founder',
        startDate: '2019-10',
        endDate: '2021-04',
        worksFor: { '@type': 'Organization', name: 'Deuterium Studios' },
      },
      {
        '@type': 'Role',
        roleName: 'Full Stack Engineer & Innovation Specialist',
        startDate: '2016-09',
        endDate: '2018-03',
        worksFor: { '@type': 'Organization', name: 'IoT.nxt', address: { '@type': 'PostalAddress', addressLocality: 'Pretoria', addressCountry: 'ZA' } },
      },
    ],
  },
}

export default function CV() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cvJsonLd) }}
      />
      <CVPage />
    </>
  )
}
