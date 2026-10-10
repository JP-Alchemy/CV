# personal-website-v3

A personal site / CV / portfolio where everything — type, images, buttons, icons — is drawn as a field of black-and-white pixel blocks. Navigating between pages (or opening a CV entry, hovering a card, resizing the window, switching theme) re-arranges those blocks into the new content.

The motion language is borrowed from the Isomorphic Labs animated marks: a coarse grid of squares holds a shape, then the squares detach, tumble and fuse into the next shape.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (vite build + prerender)
npm run preview    # serve dist/ locally
npm run font       # the pixel font as files, in brand/fonts/ (to install on your own machine)
```

Debug: append `?slow=5` to the URL to run every animation 5× slower.

## Make it yours

- **Copy, projects, services, CV, links**: all in [`src/content.js`](src/content.js). Display copy is upper-case (it's set in the pixel font); body copy is normal sentence case.
- **Email**: `site.email` is `null`, so the contact page leads with LinkedIn. Set it to an address to show it with a copy button.
- **Images**: each project has `image: { kind: 'terrain' }` (procedural: `moon`, `terrain`, `waves`, `duck`, `cyber`, `earth`, `motorcycle`, `switchbacks`, `pose`, `cubes`, `rings`, `bars`, `globe`, `portrait`, `orb`). For real images, put files in `public/images/` and use `image: { src: '/images/photo.jpg' }`; they are halftoned into blocks automatically (and re-toned for dark mode).
- **Case studies**: a project can add `sections` under its body. Each section has a `title` and any of `text` (a paragraph), `items` (a grid of `{ lead, text }`; `cols` sets the columns), `stats` (big numbers, `{ value, label }`), `steps` (a numbered story), `gallery` (screenshots, `{ src, alt, caption }`) and `note` (a closing paragraph). Optional `line` (short one-liner for home rows), `seoTitle` and `schema` (extra JSON-LD, e.g. `VideoGame`).
- **Photo treatment**: image specs accept `levels: [black, white]` (contrast), `cutout: { warm }` (drop a neutral grey backdrop, keeping warm skin and clothes, as on the About portrait), `minInk` / `darkMaxInk` (tone limits for the subject), and `lumaInk` (for dark-background images such as game art, so bright subjects become the blocks). Pass `style: 'dither'` and a small `cell` for a 1-bit look.
- **Pages / layout**: [`src/scene.js`](src/scene.js) builds each page from small layout nodes (`text`, `col`, `row`, `grid`, `button`, `image`, `icon` …).
- **Titles, descriptions, structured data**: [`src/seo.js`](src/seo.js).
- **Icons**: the looping pixel icons (including the nav logo) are ASCII frames in [`src/icons.js`](src/icons.js).
- **The brand**: paper and ink for both themes, the seven colours of the light, the dot grid and the font's name are all in [`src/brand.js`](src/brand.js), and everything reads them from there: the CSS variables, theme colour, favicon and `@font-face` (written into every page's `<head>` by [`vite.config.js`](vite.config.js); [`src/favicon.js`](src/favicon.js) then sets the favicon tumbling through the mark's frames, like the nav's logo), the shaders, the link preview cards, the font files and the brand kit scripts. The rules themselves are written up at [`/colophon/`](src/scene.js).

## SEO and deploying

The site uses real paths (`/work/`, `/work/interfarm/`, `/services/`, `/about/`, `/cv/`, `/contact/`, `/colophon/`, `/story/`, `/garden/`). Old `#/…` links redirect to them.

`npm run build` runs [`scripts/prerender.mjs`](scripts/prerender.mjs) after Vite, which writes for every route a real `dist/<path>/index.html` with:

- its own `<title>`, meta description, canonical URL, Open Graph and Twitter tags,
- JSON-LD (`WebSite` + `Person` everywhere; `ProfessionalService` with its services on home/services; `ProfilePage` on about; `CreativeWork` + breadcrumbs on projects),
- a plain semantic-HTML copy of the page, which is what crawlers and link previews read and what no-JS / no-WebGL visitors see. It's set in the site's pixel font (below) at whole-pixel sizes, and it's also what prints, so the CV's "Print / save as PDF" produces a clean document in the same type, with the text still selectable.

It also writes `404.html` (noindex), `sitemap.xml`, `robots.txt`, `apple-touch-icon.png` and a link preview card for every page: `og-image.png` for home and `og/<page>.png` for the rest (`og/work-<slug>.png` for projects). [`scripts/cards.mjs`](scripts/cards.mjs) draws each from the `card` in its page's entry in [`src/seo.js`](src/seo.js): the eyebrow and title in the pixel font, a line of text, the page's own picture in blocks (photos come from PNG copies in `brand/source/`, since Node can't decode JPEG), the mark, and the click light crossing one corner. The Google Search Console verification tag from the previous site is kept in `index.html`.

### The font

[`scripts/font.mjs`](scripts/font.mjs) turns the bitmap font in [`src/engine/font.js`](src/engine/font.js) into real font files, JP Pixel Regular and Bold, as TrueType and WOFF. Each lit pixel is a 100-unit square, merged into clean outlines, and an em is 10 pixels, so the type is crisp at 10px, 20px, 30px and so on. Spacing is the typesetter's: one pixel after each letter, four between words. Bold is the site's bold (the glyph again, one pixel to the right), except lowercase m and w, which would close up, so they're drawn wider. The build serves them from `/fonts/` (the plain-HTML copy and print use them) and the colophon offers the TTFs for download; `npm run font` writes them to `brand/fonts/` to install locally.

### Colophon

[`/colophon/`](src/scene.js) writes the brand down, drawn by the engine itself: the colours (as real swatches), the type with a specimen and size scale, the logo's five frames and what they stand for, motion and light, how the site is built, and downloads of the font, the mark (`/brand/jp-mark.svg`), the LinkedIn banner and the profile picture. The copy is `colophon` in [`src/content.js`](src/content.js). The footer's block count on every page links to it.

`dist/` works on any static host with no rewrite rules: each route is a real file and unknown paths fall back to `404.html`. This repo deploys to GitHub Pages on every push to `main` ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)), served at **jpbothma.com** (`public/CNAME`).

### The garden

[`/garden/`](src/garden) is a falling-sand garden on a page of its own (press **G**, or the sprout in the nav, to go there and back). Its heading, a strip of ground and a row of pots freeze into terrain, then the pots and ground fill with damp soil. With the seed tool, click to drop a seed: it falls from where you click, and when it lands on soil it digs itself in, two cells deep. Click the soil itself and it goes straight in there. A seed that lands on stone (the heading's letters) waits to be buried with sand. A seed in damp soil sprouts and blooms in one of the seven spectrum colours. Sand piles on the heading, water runs between the letters and soaks in, and standing water slowly dries up. Light comes from lights you hang: each shines a cone downward (soil, stone and machines cast shadows below them, and lit soil dries faster), plus a little daylight where the sky is open, which the heading's letters shade. The goal is to grow all seven:

- **The first lesson.** Until someone has collected a first flower's seeds, `tutorial.js` walks them through it in four steps: drop a seed in a pot, hang a light over it, watch it grow, collect it. Each step says what to do and points at where (on a desktop a box with an arrow and a blinking mark; on a phone in the toolbar's hint, so nothing covers the garden), lights up the tool it needs, and moves on once it's done. A seedling that dies sends it back to the start, saying why. SKIP ends it, and it doesn't come back.
- **Needs.** Each colour wants different water and light, from red (dry, a light right above it) to violet (wet, shade). Each pot keeps its own water, so a dry pot and a wet one can stand side by side. Unhappy plants wilt or rot over tens of seconds, and the hint line says why.
- **Breeding.** Click a flower (with any tool) to collect its seeds. If another colour bloomed nearby, its seeds are a cross, halfway round the spectrum: red + yellow = orange, yellow + blue = green, blue + red = violet, green + blue = cyan. Red, yellow and blue seeds never run out.
- **Automation.** The first bloom unlocks a sprinkler, the first crossed colour a sower (it sows and buries a colour of your choice, from your seeds), and five colours an agent that walks and climbs the garden collecting seeds for you. Together they can run a farm: what the agents collect feeds the sowers. Click a light or machine with its own tool to take it away. START OVER brings fresh soil and empty pots; colours and seeds stay.

`tutorial.js` is the first lesson; `bed.js` lays out the ground and pots on the garden's 4 px grid (the page draws their walls, and they're exactly the walls the sand meets); `sim.js` is the world as plain logic (grid, plants, machines); `mode.js` handles starting and leaving, filling the beds, tools, hints and saved progress (localStorage). The garden starts once the page has arrived, and the renderer draws the whole grid in one pass from a small texture, so the theme dissolve and the click light reach it too. When you leave, every grain flies into the next page. Blocks with a tone of 2 to 8 render as spectrum colours anywhere on the site (the toolbar's swatches use them).

### The 404 puzzle

Unknown addresses land on a small puzzle after *Baba Is You* ([`src/puzzle.js`](src/puzzle.js)). Every word on the board is a block you can push, and a line reading NOUN IS PROPERTY, across or down, is a rule (JP IS YOU, WALL IS STOP, PAGE IS LOST). You start walled in. Break the wall rule, then make any rule end in HOME and the page morphs home. Arrow keys or WASD move, Z undoes, R restarts; on touch, swipe the board. The level is the `LEVEL` grid at the top of the file: capitalised words are text, `j`, `p` and `#` are JP, the page and walls.

### The Adventurer (/story/)

An 80-second animated story told with the site's own renderer and morph engine ([`src/story/`](src/story)): an ink-and-paper world, a d20, a small ship, seven unknown worlds (each gives up a colour), a dragon, and the colours coming home at dawn. Scene cuts are the site's page morph, captions morph letter by letter, and colour only shows up as light, as everywhere else. `story.js` is the script: timed cues that each rebuild the scene, with sprites as ASCII in `art.js`. `player.js` runs it on an engine of its own, on the story's clock, so it can pause and open at any moment (`/story/?t=42`). The sound (`sound.js`) is synthesised in the browser with Web Audio, no files: clicks as blocks land, a dice rattle, a transporter shimmer, a warp, and the seven colours as a pentatonic scale, red to violet, so the light and the gems play their colour's note. The captions speak, too: every letter blips as it forms, left to right (the engine's opt-in `sweep`), like dialogue in old games. Each letter always gets the same note, and each line has a voice (`VOICES`): a narrator, a brighter adventurer, a low dice master, a drooping natural 1, a slow rumbling dragon. The worlds' lines are spoken in their colour's key.

It's a page of the site like any other, played under the nav. `player.js` is loaded the first time it's needed and draws on a second layer of blocks in the same canvas (`renderer.layer()`), with its own clock. Arriving from another page, that page morphs into the story's first picture and then the story takes over; leaving (or opening the menu), it hands its picture back (`engine.place()`), which morphs into the next page. While it shows, the story sets the colours, nav and all, from day into night and back. The garden and theme buttons are left out there.

Every screen shape works because each scene is laid out twice: in a wide 1280 × 720 frame (a landscape screen) and in the 720 × 720 square in its middle, which is what landscape and portrait screens have in common. Every piece has a place in both, and slides between them with how wide the stage is (`view.k`): on a laptop it's the wide frame, on a phone held upright the action closes into the square and fills the width. Resize the window and the blocks shift to their new places. Around the action the stars, the ground and the flowers carry on to the edges. Height to spare works the same way (`view.up`, `view.down`): the sky reaches up to the top of the screen, taking the planet and the row of colours with it, and the ground settles down to just above the controls, with everyone standing on it; what's in between (the ship, the worlds, the title) stays in the middle. So a phone held upright is filled top to bottom, stars and all. The sky also holds the Plough, seven faint stars (one for each colour) that light up in their colours as the colours are found, the last when the dragon gives it; three shooting stars cross it now and then, each with a falling note. Seeds wait in the soil at home all night; when the adventurer comes home they glow in their colours, and at dawn each one grows into its flower (the seeds and flowers share their keys, so the engine morphs one into the other). On a tall screen the words sit under the picture, bigger, wrapping like subtitles and forming line by line (`order`, alongside `sweep`).

It opens on the title card with a PLAY button under it (in blocks, like the home page's buttons). Pressing it sets off the title's light, the spectrum running outward with its chime, and the story plays on from there; the button breaks up into blocks as it goes. Clicking the picture sends out the site's light, as anywhere else; it doesn't play or pause (a double click goes full screen, which also hides the nav). The scrubber marks the chapters and can be dragged; the controls fade while it plays. The buttons are icons in the site's blocks, drawn by `pixels.js` (the site's engine works out where every block is, and a small 2D canvas each paints them): play tumbles into pause (and into back-to-the-start at the end), the speaker into a speaker with a cross when it's muted, and they fill in on hover like the home page's nav. Otherwise they hold still. Keys: space or K plays and pauses, ←/→ jump 5 seconds (J/L 10), Shift+←/→ or Page Up/Down go by chapter, 0–9 jump to that tenth, F is full screen (not on iPhones, which only allow it for video), M is sound, R starts again. The lines are also put in a live region for screen readers.

### LinkedIn banner and profile picture

`npm run banner` draws `brand/linkedin-banner-light.png` and `-dark.png` (1584 × 396, LinkedIn's size) from the site's own parts: the pixel font, the logo's five states, the halftone moon and the click light, set off by a pixel cursor that pushes the moon's blocks aside. The lower left stays clear for the profile photo. `node scripts/banner.mjs --preview <dir>` also writes copies with the photo drawn where LinkedIn puts it, on desktop and in the app.

`npm run profile` draws the matching profile pictures (1200 × 1200, light and dark), one pair per photo in `PHOTOS` in [`scripts/profile.mjs`](scripts/profile.mjs): the face sharp in a 1-bit dither, the edges still assembling in coarser halftone blocks, and the click light crossing them. Every block is a multiple of 3px, so LinkedIn's 400px copy matches the site pixel for pixel.

- `portrait` → `brand/linkedin-profile-light.png` / `-dark.png`, from `brand/source/jp-portrait.png` (a lossless copy of the About photo), cut out by warmth with the About page's settings.
- `side` → `brand/linkedin-profile-side-light.png` / `-dark.png`, from `brand/source/jp-side.png`. Its background is as warm as the coat, so it's cut out with `brand/source/jp-side-mask.png`, made by macOS's subject lifting: `swift scripts/mask.swift <photo> <mask>`. Ellipses in `add` patch in anything the mask missed (here, the top knot).

`node scripts/profile.mjs side` draws just one; `--preview <dir>` also writes circle-cropped copies.

### The roadbook

[`/projects/moto-tour/`](src/roadbook.js) keeps the address it had on the old site. It is drawn from [`src/data/roadbook.js`](src/data/roadbook.js): the route map is projected from the days' via points, each day expands to its elevation profile and stay, and the build writes the GPX files (all routes plus one per riding day) to `dist/projects/moto-tour/gpx/`.

## How it works

| File | Role |
| --- | --- |
| `src/brand.js` | The brand's colours, grid and font name, in one place. |
| `src/engine/font.js` | Proportional 5×7 bitmap font (with lowercase/descenders). Each lit pixel becomes one block; `scripts/font.mjs` makes it a font file. |
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

Each click (or tap) sends a ring of light out from the pointer. Blocks and grid dots inside the ring take one flat colour from a 7-step spectrum — red on the leading edge through to violet on the trailing edge — with brightness quantised and dithered per pixel, so it reads as lit pixels rather than a gradient; lit grid dots swell from 2px up to 8px. The ring fades with distance and time (~1.5s). Up to four pulses overlap. Tuning: `pulseSpeed` / `pulseWidth` in `src/main.js`, the palette in `src/brand.js`, the falloff in `LIGHT_GLSL` in `src/engine/renderer.js`.

## Accessibility

- The canvas is `aria-hidden`; the DOM mirror carries the real content in reading order, with real `<a>`/`<button>` elements positioned over their blocks.
- Keyboard focus shows a ring and triggers the same hover morph; after keyboard navigation focus moves to the new page's heading.
- `prefers-reduced-motion` replaces travel with near-instant swaps (blocks blink out and in place; no tumbling or mosaic).
- Without WebGL2 the mirrored content is shown as plain text.
