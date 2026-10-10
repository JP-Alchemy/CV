// Search engines and link previews can't read the canvas, so every page also
// exists as plain semantic HTML with its own title, description and
// structured data. The build prerenders this into dist/<path>/index.html;
// at runtime it keeps <head> in sync and backs the print view of the CV.

import {
  site, links, projects, services, onRequest, about, principles, stats, cv, experience, education, skills, colophon, story, gardenText,
} from './content.js';
import { ICONS } from './icons.js';
import { parseRoute, PAGES } from './router.js';
import { book, tripStats, gpxFile, eur, ROADBOOK_PATH } from './roadbook.js';
import { THEMES, SPECTRUM, COLOURS, FONT } from './brand.js';
import { ADVENTURER, blocks as sprite } from './story/art.js';

const BASE = site.url.replace(/\/$/, '');
const OG_IMAGE = `${BASE}/og-image.png`;

const months = (s) => s.replace(/[A-Z]{3,}/g, (w) => w[0] + w.slice(1).toLowerCase()); // MAR 2024 — NOW -> Mar 2024 — Now
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Upper-case display copy -> readable sentence case, keeping acronyms intact.
const KEEP = { '3D': '3D', AI: 'AI', XR: 'XR', ESG: 'ESG', CTO: 'CTO', CV: 'CV', EU: 'EU', NL: 'NL', WEBGL: 'WebGL', BSC: 'BSc', 'OT/ICS': 'OT/ICS', JP: 'JP', LINKEDIN: 'LinkedIn' };
const sentence = (s) => s.split(' ').map((w, i) => {
  const k = KEEP[w.replace(/[^\w/]/g, '')];
  if (k) return w.replace(/[\w/]+/, k);
  const low = w.toLowerCase();
  return i === 0 ? low.charAt(0).toUpperCase() + low.slice(1) : low;
}).join(' ');

export const allRoutes = () => [
  parseRoute('/'),
  ...PAGES.map((p) => parseRoute(`/${p}/`)),
  ...projects.map((p) => parseRoute(`/work/${p.slug}/`)),
  parseRoute(ROADBOOK_PATH),
];

// ---------------------------------------------------------------- meta

/** Where a page's link preview lives; scripts/cards.mjs draws them at build time. */
export const cardPath = (route) => (route.name === 'home' || route.name === 'notFound'
  ? '/og-image.png'
  : `/og/${route.name === 'project' ? `work-${route.slug}` : route.name}.png`);

/** Title, description and link preview for a route. `card` is what the preview says. */
export function pageMeta(route) {
  return { image: `${BASE}${cardPath(route)}`, imageW: 1200, imageH: 630, ...describe(route) };
}

// The About portrait as an image spec (the photo and its cut-out and levels).
const { alt: _alt, style: _style, cell: _cell, gamma: _gamma, ...PORTRAIT } = site.portrait;

function describe(route) {
  const url = `${BASE}${route.path}`;
  const p = route.name === 'project' && projects.find((x) => x.slug === route.slug);
  const base = { url, type: 'website' };
  switch (route.name) {
    case 'home': return {
      ...base,
      title: 'JP Bothma — Creative Technologist in Leiden | 3D, Data & AI',
      description: 'Creative technologist in Leiden, NL. I build interactive 3D experiences, legible data visualisation, AI agents and sustainable software — thoughtfully.',
      card: {
        eyebrow: 'CREATIVE TECHNOLOGIST · LEIDEN, NL', title: 'JP BOTHMA', size: 13, text: site.tagline.toUpperCase(), textSize: 5,
        note: 'INTERACTIVE 3D · DATA · AI AGENTS · SUSTAINABILITY', picture: { image: { kind: 'moon' } },
      },
    };
    case 'work': return {
      ...base,
      title: 'Work — Interactive, Data & Sustainability Projects | JP Bothma',
      description: "Selected projects by JP Bothma: Interfood's Interfarm CO₂-reduction platform, the Where does my food come from? globe, SwarmFort.io, nezen.io and more.",
      card: {
        eyebrow: 'WORK', title: 'SELECTED PROJECTS', text: 'Day-job platforms, client work and small gifts hung along the path.',
        picture: { mosaic: projects.slice(0, 4).map((x) => x.image) },
      },
    };
    case 'services': return {
      ...base,
      title: 'Services — 3D, Data, AI Agents, Fractional CTO | JP Bothma',
      description: 'Interactive 3D and WebGL, data visualisation, AI agents and workflow automation, sustainability engineering and fractional CTO work. Leiden-based, EU and global.',
      card: {
        eyebrow: 'SERVICES', title: "COME IN, LET'S TALK WORK.",
        text: 'Interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO work.',
        picture: { icons: [...services.map((x) => x.icon), 'shield'] },
      },
    };
    case 'about': return {
      ...base,
      title: 'About JP Bothma — Creative Technologist & Tech Lead',
      description: 'South African creative technologist in Leiden. 10+ years shipping software across sustainability, AI, FinTech, XR and IoT — less newest thing, more right thing.',
      card: {
        eyebrow: 'ABOUT', title: 'WHERE CREATIVITY MEETS IMPACT.',
        text: 'South African creative technologist in Leiden. Less newest thing, more right thing.',
        picture: { image: PORTRAIT, style: 'dither', gamma: site.portrait.gamma },
      },
    };
    case 'cv': return {
      ...base,
      title: 'CV — Tech Lead & Creative Technologist | JP Bothma',
      description: 'Hands-on tech lead with 10+ years shipping products across sustainability, AI, FinTech, XR and IoT. Currently Tech Lead of Sustainability at Interfood.',
      card: {
        eyebrow: 'CURRICULUM VITAE', title: cv.title.toUpperCase(),
        text: 'Hands-on tech lead with 10+ years shipping products across sustainability, AI, FinTech, XR and IoT.',
        picture: { image: PORTRAIT },
      },
    };
    case 'contact': return {
      ...base,
      title: 'Contact JP Bothma — Projects, Partnerships & Roles',
      description: 'A project, a partnership or a thoughtful question? Say hello. Based in Leiden (CET), working with teams across the EU and beyond.',
      card: {
        eyebrow: 'CONTACT', title: 'PASS THROUGH. SAY HELLO.', text: 'A project, a partnership or a thoughtful question: my inbox is genuinely open.',
        picture: { mark: 4 },
      },
    };
    case 'colophon': return {
      ...base,
      title: 'Colophon — How This Site Is Made, in Pixel Blocks | JP Bothma',
      description: `How jpbothma.com is made: square pixel blocks, one WebGL2 draw call, the ${FONT.family} font and colour only as light. The rules, the parts and the files.`,
      card: {
        eyebrow: 'COLOPHON', title: 'HOW THIS SITE IS MADE.', text: 'One material: square blocks of ink on a dot grid. Colour only shows up as light, when something happens.',
        picture: { mark: 0 },
      },
    };
    case 'garden': return {
      ...base,
      title: 'Garden — Grow the Spectrum, a Falling-Sand Game | JP Bothma',
      description: 'A falling-sand garden in pixel blocks: plant seeds in pots, water them, hang lights over them and grow all seven colours of the spectrum. Free in the browser.',
      card: {
        eyebrow: 'A FALLING-SAND GARDEN', title: gardenText.title, text: 'Plant seeds in pots, water them, hang lights over them, and grow all seven colours.',
        // The nav's sprout, in flower.
        picture: { blocks: ICONS.garden[2].flatMap((r, y) => [...r].flatMap((c, x) => (c === '#' ? [x * 56 + 2, y * 56 + 2, 52, 52, 1] : []))), w: 280, h: 280 },
      },
    };
    case 'story': return {
      ...base,
      title: 'The Adventurer — A Short Story in Pixel Blocks | JP Bothma',
      description: 'An 80-second animated story, drawn and scored in the blocks of jpbothma.com: a d20, a small ship, seven unknown worlds, a dragon, and the colours coming home.',
      card: {
        eyebrow: 'A SHORT STORY IN BLOCKS', title: 'THE ADVENTURER',
        text: 'A d20, a small ship, seven unknown worlds, a dragon, and the colours coming home.',
        // The adventurer, staff raised.
        picture: { blocks: sprite(ADVENTURER.cheer, 18, { star: 6 }), w: 12 * 18, h: 16 * 18 },
      },
    };
    case 'roadbook': {
      const st = tripStats();
      return {
        ...base,
        type: 'article',
        title: 'Roadbook — Leiden to the Alps by Motorcycle, 24 Aug – 4 Sep 2026 | JP Bothma',
        description: `A twelve-day solo motorcycle roadbook: Leiden to the Alps and back. Eleven nights, ${st.km.toLocaleString('en-GB')} km, ${st.passes} passes, every bed and euro accounted for, with GPX routes.`,
        card: {
          eyebrow: 'ROADBOOK · 24 AUG – 4 SEP 2026', title: 'LEIDEN → THE ALPS → LEIDEN',
          text: `Eleven nights, ${st.km.toLocaleString('en-GB')} km and ${st.passes} passes, solo. Every bed and euro accounted for, with GPX routes.`,
          picture: { image: { kind: 'switchbacks' } },
        },
      };
    }
    case 'project':
      if (p) {
        const by = p.role === 'Maker' ? 'Designed and built by JP Bothma.' : `JP Bothma — ${p.role}.`;
        return {
          ...base,
          type: 'article',
          title: p.seoTitle || `${p.name} — ${p.tags.slice(0, 2).map(sentence).join(' & ')} | JP Bothma`,
          description: p.summary.length + by.length < 158 ? `${p.summary} ${by}` : p.summary,
          card: {
            eyebrow: `WORK · ${p.tags[0]}`, title: p.title, text: p.summary,
            picture: { image: p.image, style: p.image.style, gamma: p.image.gamma },
          },
        };
      }
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
  image: `${BASE}${site.portrait.src}`,
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

const offer = (name, text) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name, description: text } });

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
    itemListElement: [...services.map((s) => offer(s.name, s.text)), offer(onRequest.name, onRequest.text)],
  },
};

export function jsonLd(route) {
  const graph = [website, person];
  const meta = pageMeta(route);
  if (route.name === 'home' || route.name === 'services') graph.push(business);
  if (route.name === 'about') graph.push({ '@type': 'ProfilePage', url: meta.url, mainEntity: { '@id': `${BASE}/#person` } });
  if (route.name === 'roadbook') {
    graph.push({
      '@type': 'TouristTrip',
      name: 'Leiden to the Alps and back by motorcycle',
      description: meta.description,
      url: meta.url,
      author: { '@id': `${BASE}/#person` },
      itinerary: {
        '@type': 'ItemList',
        itemListElement: book.hotels.map((h, i) => ({
          '@type': 'ListItem', position: i + 1,
          item: { '@type': 'Place', name: `${h.name}, ${h.town}`, geo: { '@type': 'GeoCoordinates', latitude: h.lat, longitude: h.lon } },
        })),
      },
    });
  }
  const p = route.name === 'project' && projects.find((x) => x.slug === route.slug);
  if (p) {
    graph.push({
      '@type': 'CreativeWork',
      name: p.name,
      description: p.summary,
      url: meta.url,
      ...(p.url ? { sameAs: p.url } : {}),
      ...(p.image?.src ? { image: `${BASE}${p.image.src}` } : {}),
      author: { '@id': `${BASE}/#person` },
      keywords: p.tags.map(sentence).join(', '),
      ...(p.schema || {}),
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
  const img = m.image || OG_IMAGE;
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    m.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${m.url}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:site_name" content="${esc(site.fullName)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${m.url}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:width" content="${m.imageW || 1200}" />`,
    `<meta property="og:image:height" content="${m.imageH || 630}" />`,
    `<meta property="og:image:alt" content="${esc(m.title)}" />`,
    '<meta property="og:locale" content="en_GB" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:creator" content="${site.twitter}" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
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
  set('meta[property="og:image"]', 'content', m.image || OG_IMAGE);
  set('meta[name="twitter:image"]', 'content', m.image || OG_IMAGE);
  const ld = document.head.querySelector('script[type="application/ld+json"]');
  if (ld) ld.textContent = JSON.stringify(jsonLd(route));
}

// ---------------------------------------------------------------- static HTML

const a = (href, label, ext) => `<a href="${esc(href)}"${ext ? ' rel="noopener"' : ''}>${esc(label)}</a>`;

function projectList(list) {
  return `<ul class="list">${list.map((p) => `<li>${a(`/work/${p.slug}/`, p.name)} — ${esc(p.summary)} <span class="muted">${esc(p.when.toLowerCase())}</span></li>`).join('')}</ul>`;
}

function sectionHTML(sec) {
  return `
    <h2>${esc(sentence(sec.title))}</h2>
    ${sec.text ? `<p>${esc(sec.text)}</p>` : ''}
    ${sec.items ? `<ul>${sec.items.map((it) => `<li><strong>${esc(it.lead)}.</strong> ${esc(it.text)}</li>`).join('')}</ul>` : ''}
    ${sec.stats ? `<ul class="stats">${sec.stats.map((st) => `<li><strong>${esc(st.value)}</strong> ${esc(sentence(st.label))}</li>`).join('')}</ul>` : ''}
    ${sec.steps ? `<ol>${sec.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>` : ''}
    ${sec.gallery ? sec.gallery.map((g) => `<figure><img src="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy" width="1200" height="675" />${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('') : ''}
    ${sec.note ? `<p>${esc(sec.note)}</p>` : ''}`;
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
    <h2>My story</h2>
    <p>${esc(story.home)} ${a(story.href, 'Watch The Adventurer →')}</p>
    <h2>Work with me</h2>
    <p>By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements: interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO work. ${a('/services/', 'Services →')}</p>`,

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
    ${p.image?.src ? `<img src="${esc(p.image.src)}" alt="${esc(p.name)} — cover image" width="1200" height="675" />` : ''}
    ${p.body.map((b) => `<p>${esc(b)}</p>`).join('')}
    ${(p.sections || []).map(sectionHTML).join('')}
    ${p.url ? `<p>${p.url.startsWith('/') ? a(p.url, `${sentence(p.cta || 'Open')} →`) : a(p.url, `Visit ${p.name} ↗`, true)}</p>` : ''}`;
  },

  roadbook: () => {
    const st = tripStats();
    const b = book.budget;
    return `
    <p>${a('/work/motorcycle-tour/', '← Motorcycle tour framework')}</p>
    <p class="eyebrow">Roadbook · 24 Aug – 4 Sep 2026 · solo</p>
    <h1>Leiden → the Alps → Leiden</h1>
    <p class="lead">Eleven nights, ${st.km.toLocaleString('en-GB')} km. Back roads throughout, bar the transit across Germany.</p>
    <ul class="stats">
      <li><strong>${eur(st.total)}</strong> total, solo</li><li><strong>${eur(st.perDay)}</strong> per day</li>
      <li><strong>${st.km.toLocaleString('en-GB')} km</strong> distance</li><li><strong>${st.nights}</strong> nights</li>
      <li><strong>${st.passes}</strong> named passes</li><li><strong>${st.top.alt.toLocaleString('en-GB')} m</strong> highest point</li>
    </ul>
    <p>${a(gpxFile(0), 'Download all routes (GPX)')}</p>
    <h2>Day by day</h2>
    ${book.days.map((d) => `
    <section>
      <h3>Day ${d.n} · ${esc(d.date)} — ${esc(d.title)}</h3>
      <p class="muted">${esc(d.frm)} → ${esc(d.to)}${d.km ? ` · ${d.km} km · ${esc(d.hrs)}` : ' · rest day'}</p>
      <p>${esc(d.roads)}</p>
      ${d.why ? `<p class="muted">${esc(d.why)}</p>` : ''}
      ${(d.foot || []).map((f) => `<p><strong>${esc(f.t)} ${esc(f.h)}.</strong> ${esc(f.d)}</p>`).join('')}
      ${d.kind !== 'rest' ? `<p>${a(gpxFile(d.n), `Day ${d.n} route (GPX)`)}</p>` : ''}
    </section>`).join('')}
    <h2>Where you sleep</h2>
    <ul class="list">${book.hotels.map((h) => `<li>Night ${esc(h.days.join(' & '))}: ${a(h.url, h.name, true)}, ${esc(h.town)} — ${esc(h.checkin)} to ${esc(h.checkout)}, ${eur(h.price, 2)}</li>`).join('')}</ul>
    <h2>What it costs</h2>
    <dl>${b.rows.map((r) => `<dt>${esc(r.item)} — ${eur(r.amount)}</dt><dd>${esc(r.note)}</dd>`).join('')}
      <dt>Subtotal — ${eur(b.subtotal)}</dt><dd></dd><dt>Contingency at 10% — ${eur(b.contingency)}</dt><dd></dd><dt>Total — ${eur(b.total)}</dt><dd>${eur(b.per_day)} a day.</dd></dl>
    <ul>${b.basis.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <h2>Worth knowing</h2>
    ${book.warnings.map((x) => `<h3>${esc(x.h)}</h3><p>${esc(x.d)}</p>`).join('')}
    <h2>Before you go</h2>
    ${book.practical.map((x) => `<h3>${esc(x.h)}</h3><p>${esc(x.d)}</p>`).join('')}`;
  },

  services: () => `
    <p class="eyebrow">Services</p>
    <h1>Services — interactive 3D, data visualisation, AI agents, sustainability engineering and fractional CTO</h1>
    <p>By day I lead sustainability technology at Interfood. Around that, I take on a small number of engagements — project work, retainers and long partnerships. Leiden-based, working with teams across the EU and further afield. For rates, get in touch and I'll give you a straight answer.</p>
    ${services.map((s) => `
    <section>
      <h2>${esc(s.name)}</h2>
      <p>${esc(s.text)}</p>
    </section>`).join('')}
    <p class="muted">${esc(onRequest.text)}</p>
    <p>${a('/contact/', 'Get in touch →')}</p>`,

  about: () => `
    <p class="eyebrow">About</p>
    <h1>About ${esc(site.fullName)} — where creativity meets impact</h1>
    <img src="${esc(site.portrait.src)}" alt="Portrait of ${esc(site.fullName)}" width="550" height="720" />
    ${about.bio.map((b) => `<p>${esc(b)}</p>`).join('')}
    <ul class="stats">${stats.map((s) => `<li><strong>${esc(s.value)}</strong> ${esc(sentence(s.label))}</li>`).join('')}</ul>
    <blockquote>${esc(sentence(about.quote))}</blockquote>
    <h2>Creativity · craft · impact</h2>
    ${principles.map((p) => `<h3>${esc(sentence(p.title))}</h3><p>${esc(p.text)}</p>`).join('')}
    <h2>My story</h2>
    <p>${esc(story.about)} ${a(story.href, 'Watch The Adventurer →')}</p>`,

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
    <h2>Open to collaboration</h2>
    <p>${esc(cv.available)}</p>`,

  contact: () => `
    <p class="eyebrow">Contact</p>
    <h1>Contact ${esc(site.fullName)}</h1>
    <p>A project, a partnership or a thoughtful question — my inbox is genuinely open. No newsletters, no CRM. Just a quiet, real conversation.</p>
    ${site.email ? `<p>${a(`mailto:${site.email}`, site.email)}</p>` : ''}
    <ul class="list">${links.map((l) => `<li>${a(l.href, `${sentence(l.label)} ↗`, true)}</li>`).join('')}</ul>
    <p class="muted">Based in Leiden (CET) · usually back within a day · EU &amp; global.</p>`,

  colophon: () => `
    <p class="eyebrow">Colophon</p>
    <h1>How this site is made</h1>
    <p class="lead">${esc(colophon.intro)}</p>
    <h2>Colour</h2>
    <p>${esc(colophon.colour)}</p>
    <ul class="list">
      <li>Paper ${THEMES.light.bg} <span class="muted">· ${THEMES.dark.bg} in the dark</span></li>
      <li>Ink ${THEMES.light.fg} <span class="muted">· ${THEMES.dark.fg} in the dark</span></li>
      ${SPECTRUM.map((h, k) => `<li>${sentence(COLOURS[k])} ${h}</li>`).join('')}
    </ul>
    <h2>Type</h2>
    <p>${esc(colophon.type)}</p>
    ${colophon.specimen.map((l) => `<p>${esc(l)}</p>`).join('')}
    <h2>The mark</h2>
    <p>${esc(colophon.mark)}</p>
    <ul>${colophon.frames.map((f) => `<li><strong>${esc(sentence(f.label))}.</strong> ${esc(f.text)}</li>`).join('')}</ul>
    <h2>Motion and light</h2>
    <p>${esc(colophon.motion)}</p>
    <h2>How it's built</h2>
    <ul>${colophon.build.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    <p>${a(story.href, 'Watch The Adventurer →')}</p>
    <h2>Downloads</h2>
    <ul class="list">${colophon.downloads.map((d) => `<li><a href="${esc(d.href)}" download>${esc(sentence(d.label))}</a> <span class="muted">${esc(d.kind)}</span></li>`).join('')}</ul>`,

  story: () => `
    <p class="eyebrow">A short story in blocks</p>
    <h1>The Adventurer</h1>
    <p class="lead">An 80-second animated story, drawn and scored in the blocks this site is made of: a d20, a small ship, seven unknown worlds, a dragon, and the colours coming home. Sound on.</p>
    <p>It plays with JavaScript and WebGL2. ${a('/', 'Back home →')}</p>`,

  garden: () => `
    <p class="eyebrow">${esc(sentence(gardenText.eyebrow))}</p>
    <h1>Grow the spectrum</h1>
    <p class="lead">${esc(gardenText.intro)}</p>
    <p>A falling-sand garden: sand piles, water soaks in, and each of the seven colours wants its own water and light. It plays with JavaScript and WebGL2. ${a('/', 'Back home →')}</p>`,

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
  <footer><p class="muted">© 2026 ${esc(site.fullName)} · Leiden, Netherlands · ${links.map((l) => a(l.href, sentence(l.label), true)).join(' · ')} · ${a('/colophon/', 'How this site is made')}</p></footer>`;
}
