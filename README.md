# personal-website-v3

A personal site / CV / portfolio where everything — type, images, buttons, icons — is drawn as a field of black-and-white pixel blocks. Navigating between pages (or opening a CV entry, hovering a card, resizing the window, switching theme) re-arranges those blocks into the new content.

The motion language is borrowed from the Isomorphic Labs animated marks: a coarse grid of squares holds a shape, then the squares detach, tumble and fuse into the next shape.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (vite build + prerender)
npm run preview    # serve dist/ locally
```

Debug: append `?slow=5` to the URL to run every animation 5× slower.

## Make it yours

- **Copy, projects, services, CV, links**: all in [`src/content.js`](src/content.js). Display copy is upper-case (it's set in the pixel font); body copy is normal sentence case.
- **Email**: `site.email` is `null`, so the contact page leads with LinkedIn. Set it to an address to show it with a copy button.
- **Images**: each project has `image: { kind: 'terrain' }` (procedural: `moon`, `terrain`, `waves`, `duck`, `cyber`, `switchbacks`, `pose`, `cubes`, `rings`, `bars`, `globe`, `portrait`, `orb`). For real images, put files in `public/images/` and use `image: { src: '/images/photo.jpg' }`; they are halftoned into blocks automatically (and re-toned for dark mode).
- **Case studies**: a project can add `sections` under its body. Each section has a `title` and any of `text` (a paragraph), `items` (a grid of `{ lead, text }`; `cols` sets the columns), `stats` (big numbers, `{ value, label }`), `steps` (a numbered story), `gallery` (screenshots, `{ src, alt, caption }`) and `note` (a closing paragraph). Optional `line` (short one-liner for home rows), `seoTitle`, `ogImage` and `schema` (extra JSON-LD, e.g. `VideoGame`).
- **Photo treatment**: image specs accept `levels: [black, white]` (contrast), `cutout: { warm }` (drop a neutral grey backdrop, keeping warm skin and clothes, as on the About portrait), `minInk` / `darkMaxInk` (tone limits for the subject), and `lumaInk` (for dark-background images such as game art, so bright subjects become the blocks). Pass `style: 'dither'` and a small `cell` for a 1-bit look.
- **Pages / layout**: [`src/scene.js`](src/scene.js) builds each page from small layout nodes (`text`, `col`, `row`, `grid`, `button`, `image`, `icon` …).
- **Titles, descriptions, structured data**: [`src/seo.js`](src/seo.js).
- **Icons**: the looping pixel icons (including the nav logo) are ASCII frames in [`src/icons.js`](src/icons.js).
- **Colours**: `THEMES` in [`src/main.js`](src/main.js) and the matching CSS variables in [`src/style.css`](src/style.css).

## SEO and deploying

The site uses real paths (`/work/`, `/work/interfarm/`, `/services/`, `/about/`, `/cv/`, `/contact/`). Old `#/…` links redirect to them.

`npm run build` runs [`scripts/prerender.mjs`](scripts/prerender.mjs) after Vite, which writes for every route a real `dist/<path>/index.html` with:

- its own `<title>`, meta description, canonical URL, Open Graph and Twitter tags,
- JSON-LD (`WebSite` + `Person` everywhere; `ProfessionalService` with rates on home/services; `ProfilePage` on about; `CreativeWork` + breadcrumbs on projects),
- a plain semantic-HTML copy of the page, which is what crawlers and link previews read and what no-JS / no-WebGL visitors see. It's also what prints, so the CV's "Print / save as PDF" produces a clean document.

It also writes `404.html` (noindex), `sitemap.xml`, `robots.txt`, a pixel-style `og-image.png` share card and `apple-touch-icon.png`, all generated from the same font and halftone code. The Google Search Console verification tag from the previous site is kept in `index.html`.

`dist/` works on any static host with no rewrite rules: each route is a real file and unknown paths fall back to `404.html`. This repo deploys to GitHub Pages on every push to `main` ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)), served at **jpbothma.com** (`public/CNAME`).

### The roadbook

[`/projects/moto-tour/`](src/roadbook.js) keeps the address it had on the old site. It is drawn from [`src/data/roadbook.js`](src/data/roadbook.js): the route map is projected from the days' via points, each day expands to its elevation profile and stay, and the build writes the GPX files (all routes plus one per riding day) to `dist/projects/moto-tour/gpx/`.

## How it works

| File | Role |
| --- | --- |
| `src/engine/font.js` | Proportional 5×7 bitmap font (with lowercase/descenders). Each lit pixel becomes one block. |
| `src/engine/typeset.js` | Word-wraps strings into blocks. |
| `src/engine/layout.js` | Tiny layout system: node tree → elements, each with a stable `key`, a content `sig` and its blocks. |
| `src/engine/images.js` | Procedural images + photo sampling → halftone / ordered-dither blocks. |
| `src/engine/engine.js` | The morph engine (below). |
| `src/engine/renderer.js` | WebGL2: one instanced draw call for every block; all motion is evaluated in the vertex shader. |
| `src/dom.js` | Mirrors the scene as real, positioned HTML (links, buttons, headings) for clicks, focus and screen readers. |
| `src/main.js` | App state, routing, hover/focus, theme, resize, render loop. |

Every re-render produces a full scene, and the engine diffs it against what is on screen by element `key`:

- **same key, same content, same place** → left alone (in-flight motion continues),
- **same key, same content, new place** → blocks slide (layout reflow, expand/collapse, resize),
- **same key, new content** → blocks re-form locally (page titles morph letter-to-letter, images re-sample, button labels invert),
- **everything else** → a *mosaic* morph: old and new blocks are bucketed into 16px grid cells, cells are paired along a Hilbert curve, and each block travels *own spot → its cell square → partner cell square → target*, with shared timing per cell pair. The page pixelates, the squares tumble across as rigid groups, then sharpen into the new page.

Content that is off screen after a page change assembles from grid squares as it scrolls into view.

### Pushing blocks with the cursor

The mouse (or pen) leaves a short trail of impulses — where it was, how far it moved, and when. In the vertex shader every block (and every dot of the background grid, which is drawn as tiny blocks too) sums damped-spring responses to the nearby impulses: blocks are shoved forward and outward, spin a little depending on which side of the path they are on, overshoot, and settle within ~0.6s. Clicking sends a radial burst. Bigger blocks move further than body-text pixels, and slow, aiming movements barely disturb anything, so buttons stay readable.

It is stateless — a pure function of the impulses — so it composes with morphs and re-renders without any bookkeeping. Tuning: `pushR` / `pushGain` in `src/main.js`, the spring constants in `PUSH_GLSL` in `src/engine/renderer.js`. Disabled for touch input and `prefers-reduced-motion`.

### Click light

Each click (or tap) sends a ring of light out from the pointer. Blocks and grid dots inside the ring take one flat colour from a 7-step spectrum — red on the leading edge through to violet on the trailing edge — with brightness quantised and dithered per pixel, so it reads as lit pixels rather than a gradient; lit grid dots swell from 2px up to 8px. The ring fades with distance and time (~1.5s). Up to four pulses overlap. Tuning: `pulseSpeed` / `pulseWidth` in `src/main.js`, the palette and falloff in `LIGHT_GLSL` in `src/engine/renderer.js`.

## Accessibility

- The canvas is `aria-hidden`; the DOM mirror carries the real content in reading order, with real `<a>`/`<button>` elements positioned over their blocks.
- Keyboard focus shows a ring and triggers the same hover morph; after keyboard navigation focus moves to the new page's heading.
- `prefers-reduced-motion` replaces travel with near-instant swaps (blocks blink out and in place; no tumbling or mosaic).
- Without WebGL2 the mirrored content is shown as plain text.
