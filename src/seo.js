// Search engines and link previews can't read the canvas, so every page also
// exists as plain semantic HTML with its own title, description and
// structured data. The build prerenders this into dist/<path>/index.html;
// at runtime it keeps <head> in sync and backs the print view of the CV.

import {
  site, links, projects, services, onRequest, about, principles, stats, cv, experience, education, skills,
} from './content.js';
import { parseRoute } from './router.js';

const BASE = site.url.replace(/\/$/, '');
const OG_IMAGE = `${BASE}/og-image.png`;

const months = (s) => s.replace(/[A-Z]{3,}/g, (w) => w[0] + w.slice(1).toLowerCase()); // MAR 2024 — NOW -> Mar 2024 — Now
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Upper-case display copy -> readable sentence case, keeping acronyms intact.
const KEEP = { '3D': '3D', AI: 'AI', XR: 'XR', ESG: 'ESG', CTO: 'CTO', CV: 'CV', EU: 'EU', NL: 'NL', WEBGL: 'WebGL', BSC: 'BSc', 'OT/ICS': 'OT/ICS' };
const sentence = (s) => s.split(' ').map((w, i) => {
  const k = KEEP[w.replace(/[^\w/]/g, '')];
  if (k) return w.replace(/[\w/]+/, k);
  const low = w.toLowerCase();
  return i === 0 ? low.charAt(0).toUpperCase() + low.slice(1) : low;
}).join(' ');

export const allRoutes = () => [
  parseRoute('/'),
  ...['work', 'services', 'about', 'cv', 'contact'].map((p) => parseRoute(`/${p}/`)),
  ...projects.map((p) => parseRoute(`/work/${p.slug}/`)),
];

// ---------------------------------------------------------------- meta

export function pageMeta(route) {
  const url = `${BASE}${route.path}`;
  const p = route.name === 'project' && projects.find((x) => x.slug === route.slug);
  const base = { url, type: 'website' };
  switch (route.name) {
    case 'home': return {
      ...base,
      title: 'JP Bothma — Creative Technologist in Leiden | 3D, Data & AI',
      description: 'Creative technologist in Leiden, NL. I build interactive 3D experiences, legible data visualisation, AI agents and sustainable software — thoughtfully.',
    };
    case 'work': return {
      ...base,
      title: 'Work — Interactive, Data & Sustainability Projects | JP Bothma',
      description: "Selected projects by JP Bothma: Interfood's Interfarm CO₂-reduction platform, the Where does my food come from? globe, SwarmFort.io, nezen.io and more.",
    };
    case 'services': return {
      ...base,
      title: 'Services & Rates — 3D, Data, AI Agents, Fractional CTO | JP Bothma',
      description: 'Interactive 3D and WebGL, data visualisation, AI agents and workflow automation, sustainability engineering and fractional CTO work. Leiden-based, EU and global.',
    };
    case 'about': return {
      ...base,
      title: 'About JP Bothma — Creative Technologist & Tech Lead',
      description: 'South African creative technologist in Leiden. 10+ years shipping software across sustainability, AI, FinTech, XR and IoT — less newest thing, more right thing.',
    };
    case 'cv': return {
      ...base,
      title: 'CV — Tech Lead & Creative Technologist | JP Bothma',
      description: 'Hands-on tech lead with 10+ years shipping products across sustainability, AI, FinTech, XR and IoT. Currently Tech Lead of Sustainability at Interfood.',
    };
    case 'contact': return {
      ...base,
      title: 'Contact JP Bothma — Projects, Partnerships & Roles',
      description: 'A project, a partnership or a thoughtful question? Say hello. Based in Leiden (CET), working with teams across the EU and beyond.',
    };
    case 'project':
      if (p) return {
        ...base,
        type: 'article',
        title: `${p.name} — ${p.tags.slice(0, 2).map(sentence).join(' & ')} | JP Bothma`,
        description: `${p.summary} ${p.role === 'Maker' ? 'Designed and built by JP Bothma.' : `JP Bothma — ${p.role}.`}`,
      };
    // fall through
    default: return {
      ...base,
      url: `${BASE}/404/`,
      title: 'Page not found | JP Bothma',
      description: 'These blocks did not assemble into anything. Head back to the home page.',
      noindex: true,
    };
  }
}

// ---------------------------------------------------------------- structured data

const person = {
  '@type': 'Person',
  '@id': `${BASE}/#person`,
  name: site.fullName,
  givenName: 'JP',
  familyName: 'Bothma',
  jobTitle: 'Creative Technologist & Tech Lead',
  description: 'Creative technologist building interactive experiences, data visualisation, AI agents and orchestrated workflows, and sustainability-minded software. Based in Leiden, the Netherlands.',
  url: `${BASE}/`,
  image: OG_IMAGE,
  sameAs: [site.linkedin, site.github],
  nationality: 'South African',
  address: { '@type': 'PostalAddress', addressLocality: 'Leiden', addressRegion: 'Zuid-Holland', addressCountry: 'NL' },
  worksFor: { '@type': 'Organization', name: 'Interfood Group' },
  alumniOf: { '@type': 'EducationalOrganization', name: 'Pearson Institute' },
  knowsAbout: [
    'Creative technology', 'Interactive 3D', 'WebGL', 'React-Three-Fiber', 'Unity', 'Unreal Engine', 'Data visualisation',
    'AI agents', 'LLM orchestration', 'Workflow automation', 'Sustainability engineering', 'Digital product passports',
    'Full-stack development', 'Software architecture', 'Fractional CTO', 'OT security',
  ],
};

const website = {
  '@type': 'WebSite',
  '@id': `${BASE}/#website`,
  url: `${BASE}/`,
  name: site.fullName,
  description: 'Portfolio and CV of JP Bothma, creative technologist in Leiden.',
  author: { '@id': `${BASE}/#person` },
  inLanguage: 'en',
};

const offer = (name, text, price) => ({
  '@type': 'Offer',
  itemOffered: { '@type': 'Service', name, description: text },
  priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'EUR', unitCode: 'HUR', unitText: 'hour' },
});

const business = {
  '@type': 'ProfessionalService',
  '@id': `${BASE}/#business`,
  name: 'JP Bothma — creative technology & consulting',
  url: `${BASE}/services/`,
  image: OG_IMAGE,
  founder: { '@id': `${BASE}/#person` },
  address: person.address,
  areaServed: [{ '@type': 'Country', name: 'Netherlands' }, { '@type': 'Place', name: 'European Union' }, { '@type': 'Country', name: 'South Africa' }],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Services',
    itemListElement: [...services.map((s) => offer(s.name, s.text, s.price)), offer(onRequest.name, onRequest.text, onRequest.price)],
  },
};

export function jsonLd(route) {
  const graph = [website, person];
  const meta = pageMeta(route);
  if (route.name === 'home' || route.name === 'services') graph.push(business);
  if (route.name === 'about') graph.push({ '@type': 'ProfilePage', url: meta.url, mainEntity: { '@id': `${BASE}/#person` } });
  const p = route.name === 'project' && projects.find((x) => x.slug === route.slug);
  if (p) {
    graph.push({
      '@type': 'CreativeWork',
      name: p.name,
      description: p.summary,
      url: meta.url,
      ...(p.url ? { sameAs: p.url } : {}),
      author: { '@id': `${BASE}/#person` },
      keywords: p.tags.map(sentence).join(', '),
    });
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Work', item: `${BASE}/work/` },
        { '@type': 'ListItem', position: 3, name: p.name, item: meta.url },
      ],
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** <head> tags for a prerendered page. */
export function headTags(route) {
  const m = pageMeta(route);
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    m.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${m.url}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:site_name" content="${esc(site.fullName)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${m.url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc(site.fullName)} — creative technologist" />`,
    '<meta property="og:locale" content="en_GB" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:creator" content="${site.twitter}" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd(route)).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.join('\n    ');
}

/** Keep <head> in step with client-side navigation. */
export function applyMeta(route) {
  const m = pageMeta(route);
  document.title = m.title;
  const set = (sel, attr, val) => { const el = document.head.querySelector(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', m.description);
  set('link[rel="canonical"]', 'href', m.url);
  set('meta[property="og:title"]', 'content', m.title);
  set('meta[property="og:description"]', 'content', m.description);
  set('meta[property="og:url"]', 'content', m.url);
  set('meta[name="twitter:title"]', 'content', m.title);
  set('meta[name="twitter:description"]', 'content', m.description);
  const ld = document.head.querySelector('script[type="application/ld+json"]');
  if (ld) ld.textContent = JSON.stringify(jsonLd(route));
}

// ---------------------------------------------------------------- static HTML

const a = (href, label, ext) => `<a href="${esc(href)}"${ext ? ' rel="noopener"' : ''}>${esc(label)}</a>`;

function projectList(list) {
  return `<ul class="list">${list.map((p) => `<li>${a(`/work/${p.slug}/`, p.name)} — ${esc(p.summary)} <span class="muted">${esc(p.when.toLowerCase())}</span></li>`).join('')}</ul>`;
}

const BODIES = {
  home: () => `
    <p class="eyebrow">Creative technologist · Leiden, NL</p>
    <h1>Hi, I'm ${esc(site.fullName)} — a creative technologist in Leiden</h1>
    <p class="lead">${esc(site.tagline)}</p>
    <p>${esc(site.intro)}</p>
    <h2>Selected work</h2>
    ${projectList(projects.slice(0, 4))}
    <p>${a('/work/', 'All projects →')}</p>
    <h2>Currently</h2>
    <ul class="list">${site.now.map((n) => `<li><span class="muted">${esc(n.when.toLowerCase())}</span> — ${esc(n.text)}</li>`).join('')}</ul>
    <h2>Work with me</h2>
    <p>By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements: interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO work. ${a('/services/', 'Services & rates →')}</p>`,

  work: () => `
    <p class="eyebrow">Work</p>
    <h1>Selected projects — interactive 3D, data and sustainability work</h1>
    <p>Day-job platforms, client work and small gifts hung along the path.</p>
    ${projects.map((p) => `
    <article>
      <h2>${a(`/work/${p.slug}/`, p.name)}</h2>
      <p>${esc(p.summary)}</p>
      <p class="muted">${esc(p.when.toLowerCase())} · ${esc(p.tags.map(sentence).join(' · '))}</p>
    </article>`).join('')}`,

  project: (route) => {
    const p = projects.find((x) => x.slug === route.slug);
    return `
    <p>${a('/work/', '← All work')}</p>
    <h1>${esc(p.name)}</h1>
    <p class="lead">${esc(p.summary)}</p>
    <dl>
      <dt>${/\d{4}/.test(p.when) ? 'When' : 'Status'}</dt><dd>${esc(sentence(p.when))}</dd>
      <dt>Role</dt><dd>${esc(p.role)}</dd>
      <dt>Stack</dt><dd>${esc(p.stack)}</dd>
    </dl>
    ${p.body.map((b) => `<p>${esc(b)}</p>`).join('')}
    ${p.url ? `<p>${a(p.url, `Visit ${p.name} ↗`, true)}</p>` : ''}`;
  },

  services: () => `
    <p class="eyebrow">Services &amp; rates</p>
    <h1>Services — interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO</h1>
    <p>By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements — project work, retainers and long partnerships. Leiden-based, working with teams across the EU and further afield.</p>
    ${services.map((s) => `
    <section>
      <h2>${esc(s.name)} <span class="muted">— ${esc(s.rate.toLowerCase())}</span></h2>
      <p>${esc(s.text)}</p>
    </section>`).join('')}
    <p class="muted">${esc(onRequest.text.replace(/\.$/, ''))} — ${esc(onRequest.rate.toLowerCase())}.</p>
    <p>${a('/contact/', 'Get in touch →')}</p>`,

  about: () => `
    <p class="eyebrow">About</p>
    <h1>About ${esc(site.fullName)} — where creativity meets impact</h1>
    ${about.bio.map((b) => `<p>${esc(b)}</p>`).join('')}
    <ul class="stats">${stats.map((s) => `<li><strong>${esc(s.value)}</strong> ${esc(sentence(s.label))}</li>`).join('')}</ul>
    <blockquote>${esc(sentence(about.quote))}</blockquote>
    <h2>Creativity · craft · impact</h2>
    ${principles.map((p) => `<h3>${esc(sentence(p.title))}</h3><p>${esc(p.text)}</p>`).join('')}`,

  cv: () => `
    <header class="cv-head">
      <h1>${esc(site.fullName)}</h1>
      <p class="lead">${esc(cv.headline)}</p>
      <p class="muted">${esc(site.location)} · Open to EU &amp; global engagements · ${a(site.linkedin, 'linkedin.com/in/jp-bothma', true)} · ${a(`${BASE}/`, 'jpbothma.com')}</p>
      <p>${esc(cv.summary)}</p>
    </header>
    <h2>Experience</h2>
    ${experience.map((e) => `
    <article class="job">
      <h3>${esc(e.role)} — ${esc(e.org)}</h3>
      <p class="muted">${esc(months(e.period))} · ${esc(e.place)}</p>
      <p>${esc(e.summary)}</p>
      <ul>${e.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul>
      <p class="muted">${esc(e.tags)}</p>
    </article>`).join('')}
    <h2>Education</h2>
    ${education.map((e) => `<p><strong>${esc(e.title)}</strong> — ${esc(e.org)} <span class="muted">(${esc(e.period)})</span></p>`).join('')}
    <h2>Skills</h2>
    <dl class="skills">${skills.map((g) => `<dt>${esc(sentence(g.group))}</dt><dd>${esc(g.items.join(', '))}</dd>`).join('')}</dl>
    <h2>Currently available</h2>
    <p>${esc(cv.available)}</p>`,

  contact: () => `
    <p class="eyebrow">Contact</p>
    <h1>Contact ${esc(site.fullName)}</h1>
    <p>A project, a partnership or a thoughtful question — my inbox is genuinely open. No newsletters, no CRM. Just a quiet, real conversation.</p>
    ${site.email ? `<p>${a(`mailto:${site.email}`, site.email)}</p>` : ''}
    <ul class="list">${links.map((l) => `<li>${a(l.href, `${sentence(l.label)} ↗`, true)}</li>`).join('')}</ul>
    <p class="muted">Based in Leiden (CET) · usually back within a day · EU &amp; global.</p>`,

  notFound: () => `
    <h1>Page not found</h1>
    <p>These blocks did not assemble into anything. ${a('/', 'Back home →')}</p>`,
};

/** Semantic HTML for a route (nav + page + footer). */
export function pageHTML(route) {
  const body = (BODIES[route.name] || BODIES.notFound)(route);
  const nav = [['/', site.fullName], ['/work/', 'Work'], ['/services/', 'Services'], ['/about/', 'About'], ['/cv/', 'CV'], ['/contact/', 'Contact']]
    .map(([h, l]) => a(h, l)).join(' ');
  return `
  <nav class="static-nav" aria-label="Site">${nav}</nav>
  <main>${body}
  </main>
  <footer><p class="muted">© 2026 ${esc(site.fullName)} · Leiden, Netherlands · ${links.map((l) => a(l.href, sentence(l.label), true)).join(' · ')}</p></footer>`;
}
