# personal-website-v3

A personal site / CV / portfolio where everything — type, images, buttons, icons — is drawn as a field of black-and-white pixel blocks. Navigating between pages (or opening a CV entry, hovering a card, resizing the window, switching theme) re-arranges those blocks into the new content.

The motion language is borrowed from the Isomorphic Labs animated marks: a coarse grid of squares holds a shape, then the squares detach, tumble and fuse into the next shape.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

Routes are hash-based (`#/work`, `#/cv`, …), so `dist/` works on any static host (GitHub Pages, Netlify, S3) without rewrite rules.

Debug: append `?slow=5` to the URL to run every animation 5× slower.

## Make it yours

- **Copy, projects, CV, links** — all in [`src/content.js`](src/content.js). Everything there is placeholder.
- **Images** — each project has `image: { kind: 'terrain' }` (procedural: `orb`, `portrait`, `terrain`, `waves`, `cubes`, `rings`, `bars`, `globe`). For real images, put files in `public/images/` and use `image: { src: '/images/photo.jpg' }`; they are halftoned into blocks automatically (and re-toned for dark mode).
- **CV PDF** — the "Download PDF" button links to `/cv.pdf`; drop the file in `public/`.
- **Pages / layout** — [`src/scene.js`](src/scene.js) builds each page from small layout nodes (`text`, `col`, `row`, `grid`, `button`, `image`, `icon` …).
- **Icons** — the looping pixel icons (including the nav logo) are ASCII frames in [`src/icons.js`](src/icons.js).
- **Colors** — `THEMES` in [`src/main.js`](src/main.js) and the matching CSS variables in [`src/style.css`](src/style.css).

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

## Accessibility

- The canvas is `aria-hidden`; the DOM mirror carries the real content in reading order, with real `<a>`/`<button>` elements positioned over their blocks.
- Keyboard focus shows a ring and triggers the same hover morph; after keyboard navigation focus moves to the new page's heading.
- `prefers-reduced-motion` replaces travel with near-instant swaps (blocks blink out and in place; no tumbling or mosaic).
- Without WebGL2 the mirrored content is shown as plain text.
