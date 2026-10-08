// Runs after `vite build`: writes one real HTML file per route (own title,
// description, canonical, Open Graph, JSON-LD and a plain-HTML copy of the
// page), plus 404.html, sitemap.xml, robots.txt and the share images.
import fs from 'node:fs';
import path from 'node:path';
import { allRoutes, headTags, pageHTML } from '../src/seo.js';
import { parseRoute } from '../src/router.js';
import { site } from '../src/content.js';
import { typeset } from '../src/engine/typeset.js';
import { imageBlocks } from '../src/engine/images.js';
import { iconFrames } from '../src/icons.js';
import { Raster, hex } from './png.mjs';

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
${routes.map((r) => `  <url><loc>${base}${r.path}</loc><lastmod>${today}</lastmod><priority>${r.path === '/' ? '1.0' : r.name === 'project' ? '0.6' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`);
write(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);

// ---------------------------------------------------------------- share images

const PAPER = hex('#f0f0eb');
const INK = hex('#0e0e0e');
const SPECTRUM = ['#ff453a', '#ff9429', '#ffdb33', '#4cdb6b', '#33ccf2', '#406bff', '#9e52ff'].map(hex);

function ogImage() {
  const W = 1200, H = 630, M = 72;
  const r = new Raster(W, H, PAPER);
  const dot = PAPER.map((c, k) => Math.round(c + (INK[k] - c) * 0.09));
  for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) r.rect(x, y, 2, 2, dot);
  const put = (str, size, x, y, width, tone = 1) => {
    const t = typeset(str, { size, width, lh: 10, tone });
    r.blocks(t.blocks, x, y, INK, PAPER);
    return t.height;
  };
  put('■ CREATIVE TECHNOLOGIST · LEIDEN, NL', 3, M, 84, 900);
  put('JP BOTHMA', 14, M, 150, 1000);
  const sub = put('THOUGHTFUL SOFTWARE FOR WORK THAT MATTERS.', 5, M, 300, 640);
  put('INTERACTIVE 3D · DATA · AI AGENTS · SUSTAINABILITY', 3, M, 300 + sub + 36, 660, 0.55);
  put('JPBOTHMA.COM', 3, M, H - M - 21, 600);
  SPECTRUM.forEach((rgb, i) => r.rect(M + 300 + i * 18, H - M - 21, 14, 14, rgb));

  const S = 400, ix = W - M - S, iy = (H - S) / 2;
  r.blocks(imageBlocks({ kind: 'moon' }, S, S, { cell: 8 }), ix, iy, INK, PAPER);
  for (const [cx, cy, dx, dy] of [[ix, iy, 1, 1], [ix + S - 2, iy, -1, 1], [ix, iy + S - 2, 1, -1], [ix + S - 2, iy + S - 2, -1, -1]]) {
    r.rect(Math.min(cx, cx + dx * 14), cy, 16, 2, INK);
    r.rect(cx, Math.min(cy, cy + dy * 14), 2, 16, INK);
  }
  return r.png();
}

function touchIcon() {
  const r = new Raster(180, 180, INK);
  const f = iconFrames('logo', 20).frames[0];
  r.blocks(f, 20, 40, PAPER, INK);
  return r.png();
}

write(path.join(dist, 'og-image.png'), ogImage());
write(path.join(dist, 'apple-touch-icon.png'), touchIcon());

console.log(`prerendered ${routes.length} pages + 404, sitemap.xml, robots.txt, og-image.png, apple-touch-icon.png`);
