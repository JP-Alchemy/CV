import fs from 'node:fs';
import { defineConfig } from 'vite';
import { THEMES, FONT } from './src/brand.js';
import { markSVG } from './src/icons.js';
import { fontFiles } from './scripts/font.mjs';

// The brand's build-time half (src/brand.js). Every page's <head> gets the
// theme colours, the favicon and the font; the font files, the mark and the
// LinkedIn kit (linked from /colophon/) are served in dev and written into
// the build.
const KIT = ['linkedin-banner-light.png', 'linkedin-banner-dark.png', 'linkedin-profile-side-light.png', 'linkedin-profile-side-dark.png'];
const TYPES = { ttf: 'font/ttf', woff: 'font/woff', svg: 'image/svg+xml', png: 'image/png' };

function files() {
  const out = {};
  for (const [name, buf] of Object.entries(fontFiles())) out[`fonts/${name}`] = buf;
  out['brand/jp-mark.svg'] = Buffer.from(markSVG({ fill: THEMES.light.fg }));
  for (const f of KIT) out[`brand/${f}`] = fs.readFileSync(`brand/${f}`);
  return out;
}

function head() {
  const face = (weight, file) => `@font-face{font-family:'${FONT.family}';font-weight:${weight};font-display:swap;`
    + `src:url(/fonts/${file}.woff) format('woff'),url(/fonts/${file}.ttf) format('truetype')}`;
  const css = [
    `:root{--bg:${THEMES.light.bg};--fg:${THEMES.light.fg};--font:'${FONT.family}'}`,
    `:root[data-theme='dark']{--bg:${THEMES.dark.bg};--fg:${THEMES.dark.fg}}`,
    face(400, FONT.files.regular),
    face(700, FONT.files.bold),
  ].join('\n');
  // Ink on light tabs, paper on dark ones.
  const icon = markSVG({ fill: THEMES.light.fg, dark: THEMES.dark.fg });
  return [
    { tag: 'meta', attrs: { name: 'theme-color', content: THEMES.light.bg }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: `data:image/svg+xml,${encodeURIComponent(icon)}` }, injectTo: 'head' },
    { tag: 'style', children: css, injectTo: 'head' },
  ];
}

function brand() {
  return {
    name: 'brand',
    transformIndexHtml: head,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0]).slice(1);
        if (!/^(fonts|brand)\//.test(name)) return next();
        const buf = files()[name];
        if (!buf) return next();
        res.setHeader('Content-Type', TYPES[name.split('.').pop()] || 'application/octet-stream');
        res.end(buf);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}

export default defineConfig({
  plugins: [brand()],
});
