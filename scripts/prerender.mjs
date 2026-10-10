// Runs after `vite build`: writes one real HTML file per route (own title,
// description, canonical, Open Graph, JSON-LD and a plain-HTML copy of the
// page), plus 404.html, sitemap.xml, robots.txt, a link preview card per page
// and the home-screen icon. (The font and brand kit come from vite.config.js.)
import fs from 'node:fs';
import path from 'node:path';
import { allRoutes, headTags, pageHTML, pageMeta, cardPath } from '../src/seo.js';
import { parseRoute } from '../src/router.js';
import { site } from '../src/content.js';
import { gpxFiles } from '../src/roadbook.js';
import { iconFrames } from '../src/icons.js';
import { Raster, THEMES } from './png.mjs';
import { card } from './cards.mjs';

const dist = path.resolve('dist');
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<!--seo:head-->') || !template.includes('<!--seo:body-->')) {
  throw new Error('dist/index.html is missing the <!--seo:…--> markers');
}

const render = (route) => template
  .replace(/<!--seo:head-->[\s\S]*?<!--\/seo:head-->/, `<!--seo:head-->\n    ${headTags(route)}\n    <!--/seo:head-->`)
  .replace('<!--seo:body-->', pageHTML(route));

const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

const routes = allRoutes();
for (const route of routes) {
  write(path.join(dist, route.path, 'index.html'), render(route));
}
write(path.join(dist, '404.html'), render(parseRoute('/404/')));

const today = new Date().toISOString().slice(0, 10);
const base = site.url.replace(/\/$/, '');
write(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((r) => `  <url><loc>${base}${r.path}</loc><lastmod>${today}</lastmod><priority>${r.path === '/' ? '1.0' : r.name === 'project' ? '0.6' : r.name === 'story' || r.name === 'garden' ? '0.5' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`);
for (const [file, xml] of gpxFiles()) write(path.join(dist, file), xml);

write(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);

// ---------------------------------------------------------------- share images

for (const route of routes) write(path.join(dist, cardPath(route)), card(pageMeta(route).card, route.path));

// Home screen: the mark in paper on ink.
function touchIcon() {
  const { bg, fg } = THEMES.light;
  const r = new Raster(180, 180, fg);
  r.blocks(iconFrames('logo', 20).frames[0], 20, 40, bg, fg);
  return r.png();
}
write(path.join(dist, 'apple-touch-icon.png'), touchIcon());

console.log(`prerendered ${routes.length} pages + 404, ${gpxFiles().length} GPX files, sitemap.xml, robots.txt, ${routes.length} preview cards, apple-touch-icon.png`);
