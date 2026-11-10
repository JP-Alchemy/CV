# /lab/universe/: an endless universe in blocks

A lab prototype: a seeded, procedurally generated universe you can zoom
through, from a 4 Gpc view of the cosmic web down to the atoms in one grain
of sand on one planet. It is drawn entirely with the site's own WebGL2 cube
(no three.js, no libraries). Lab only: nothing on the live site imports it,
and Powers of Ten is untouched.

**Getting around.** Click something to select it: brackets go round it and
a card at the bottom says what it is and how far away. Double-click, press
Enter (or `G`), or press the card's Go to travel there; Esc clears the
selection. The places you can go next are named on screen (the galaxies
round you on the web, a spread of stars in a galaxy, a system's planets, a
planet's moons); clicking a name selects it too. Hovering shows what a click
would select. The breadcrumbs at the top take you back out.

**Zooming.** The wheel (about 1.8× a notch, eased) and pinch zoom about the
middle of the view, never towards the pointer, so the view doesn't wander;
to go somewhere else, select it and Go. Zooming into empty space never ends
in black: close in, the view drifts to the nearest thing worth seeing
(between galaxies to the nearest galaxy, inside a galaxy below ~300 ly to the
nearest star, in a system back to the star or the nearest planet).

**Smoothness.** Everything the camera does on its own is eased and rate-limited, never snapped:
- tipping towards the horizon as you descend (at most ~0.6 rad a second);
- keeping the eye above the ground (small steps, even when buried);
- climbing back above the horizon (~0.9 rad a second);
- pulling onto the nearest star or world (the zoom waits, so what you're pulled to stays in view);
- settling the target onto the ground.

Pulls pause while you zoom out. A scripted wheel zoom down every route (into a galaxy to a star's surface, orbit to sand, and back out) peaks at 1.7° of turn and 8.5% of the view sideways in a frame (the glide onto a star); the slowest frame is ~45 ms, when the pull towards the nearest star first makes the stars around you.

**Turning and moving.** Drag to turn about what you're looking at (the near
side follows the pointer; a flick coasts). Right-drag, shift-drag or two
fingers move: across the view in space, sliding along the ground on a
surface. Keys (hold): `W` `A` `S` `D` move, the arrows turn, `Q` `E` (or `-`
`+`) zoom; `U` up a level, `H` home, `T` paper or ink, space pauses the
orbits (which are slowed right down, so what you aim at stays put). While
you steer, the camera stops rolling itself level, and for a few seconds after
you tilt by hand it stops tipping towards the horizon as you descend.
`?seed=anything` gives a different universe, and `?theme=light|dark` sets the
theme.

Code lives in `src/lab/universe/`. Run it with the `universe` entry in
`.claude/launch.json` (Vite on port 5184, `--host`), then open `/lab/universe/`.

## Causes, time and search

Three things on top of the generator, each using the fact that every place
is cheap to recompute from its parent.

**Every detail has a cause (`lineage.js`).** Levels aren't independent dice
rolls. A galaxy's type and surroundings set when it formed and how it made
stars (ellipticals early and all at once, spirals steadily, irregulars late).
That sets how many metals its gas has, richer towards the middle and later
on. A star's birth (young ones in the spiral arms) and position set its
metals. Its metals set its planets: more of them, and more gas giants, in
metal-rich systems. A young system's inner worlds are still molten. A
planet's size and age set the heat left inside, so whether its plates move
and its volcanoes erupt, and that sets its sand: quartz and mica where
continents form, olivine where it's erupting, garnet where crust is squeezed
deep, magnetite with the star's iron. Press **Why here?** (or the card's
**Why?**) for the chain, from the grain or world up to the cosmic web.

**Time runs at the speed of what you look at.** The clock does about one
orbit, at the camera's distance round what it's near, every 40 s. A planet
from orbit: minutes to hours a second, so you see its moons go round and its
day and night pass. A system: years a second. A galaxy (and anything larger): up to ~2.5 million
years a second, so its spiral pattern turns in a minute or so. On the ground: a minute a
second. Orbits use real periods (Kepler's law with the star's or planet's
mass). Separately, the **time bar** scrubs the age of the universe from 0.2 to
13.8 billion years: every galaxy, star and dot carries its birth time (in
its glow channel) and the shader leaves out what isn't born yet. Galaxies
appear as they form, arms lose their young blue knots, and a system isn't
there before its star. Keys `[` `]` (shift: a billion years).

**Search instead of wander (`search.js`).** Type "a ringed ocean world with
two moons round a yellow star", "garnet sand", "young blue giant", "volcanoes
metal-rich", "elliptical". The words become tests per level, and the search
walks out from where you are, a few ms a frame, in shells of 50 ly cells.
It prunes as early as it can: galaxies by type, cells by expected star
count, stars by class and history. Only then does it build a star's planets
and test them, nearest first, across the nearest galaxies that fit. Nothing
is cached: the search space is the whole universe. Click a result to warp
there. `/` focuses the box.

Limits: stars that died before now aren't in the catalogue, so scrubbing
back doesn't bring back the giants that have since exploded. Planets don't
change with the epoch (they're drawn as they are now). The galaxy turns as a
rigid pattern (a density wave), not star by star. A planet's day turns its
light rather than its ground. The vocabulary is fixed keywords, not language
understanding.

## Possible worlds, blocks and atoms

**The atlas of possible worlds (`atlas.js`; Atlas, or `A`).** A second space
where position means what a world is, not where it is. One axis is warmth
(how close it orbits, for its star's light), one is size, one is age. Every
point is a world built by the same rules as the real ones (kinds, history,
minerals, terrain), so flying across the atlas morphs one into another: lava
into desert into ocean into ice, rock into ice giant into gas giant. The grid
spacing halves as you zoom in, and the worlds you saw stay put while new
in-between ones appear, down to 1/64 of a unit. It opens centred on the world
you were at, with the axes drawn and labelled. Click a world, then
**Find a real one**: it searches the universe for a world of the same kind and
similar size, warmth and age, and lists the nearest to warp to.

**Leave your block (Block, or `B`; Link, or `L`).** Every place has an address
that regenerates it: a web cell and index, a leaf cell and index, a planet's
number, a 1 m spot, a grain's cell. With the camera that's a link
(`#u=…&at=…`) that lands anyone exactly where you were. Each visitor can leave
one block (a colour and a note) at what they're looking at. It's drawn as a
1 m block, never smaller than a few pixels, so it's a beacon from orbit and
labelled on screen. The link carries it, so whoever opens the link sees it,
and their browser keeps it.

*What it doesn't do yet:* everyone seeing everyone's blocks without a link
needs a shared store. The site is static (GitHub Pages), so blocks live in
each browser (`localStorage`) and travel by link. The store is the few
functions round `MARKS` in `main.js`; swapping them for a small database
(anything with read-all and write-one, keyed by universe) makes it truly
shared. Choosing and running that service is JP's call.

**Infinite in both directions.** Zoom into a single atom (closer than about
0.2 nm, at the bottom of a grain's lattice) and it opens into a whole new
universe, seeded from the atom: its grain, its lattice spot and its place in
the lattice. You arrive at the scale of the cosmic web and can keep going
down: its galaxies, its worlds, its sand, its atoms, and in again. Zoom out
past the top of a universe and you come back out of the atom you entered,
where you were. The breadcrumbs show the nesting ("Our universe › inside an
atom of feldspar › The cosmic web (universe 2)"); click one to climb back
out. Links carry the chain of universe seeds.

Limits: a link into a nested universe knows its seeds but not the atoms you
went through, so backing out of one lands at that universe's home. The atlas
shows each world as a small ball (relief exaggerated six times so it reads
at that size), not the full quadtree.

## Files

| file | what |
| --- | --- |
| `rng.js` | integer hashes, seeded streams, value noise and fBm, made-up names |
| `space.js` | nodes and frames (float64), the camera, the van Wijk–Nuij flight path |
| `gl.js` | the cube renderer: the engine's 8-vertex cube fan, log depth, per-batch frames |
| `cosmos.js` | the two-layer cosmic web, galaxy shapes, the galaxy octree, stars |
| `system.js` | star classes and planetary systems (planets, moons, rings, air) |
| `planet.js` | `Body`: the cube-sphere quadtree shared by planets, moons, stars and grains |
| `micro.js` | sand tiles and atom tiles |
| `world.js` | per-frame level of detail, the mesh store, anchoring, picking, flights, the clock |
| `lineage.js` | histories: galaxy formation, star birth and metals, planet heat and minerals, and why |
| `search.js` | query words to tests; the incremental, pruned search |
| `atlas.js` | the space of possible worlds: properties to worlds, and one-mesh balls |
| `main.js` | the page: input, HUD, timing hooks (`__tick`, `__measure`) |

## Seeding: nothing is stored

Every place is a pure function of its parent's seed and its own integer
address, so it is regenerated identically on every visit:

```
universe seed
└─ web cell (ix, iy, iz)           hash(seed, ix, iy, iz)        knot, links, galaxies
   └─ galaxy                       hash(cell, i)                 type, size, arms, bar, tilt
      └─ octree cell (d, i, j, k)   hash(galaxy, d, i, j, k)      samples or real stars
         └─ star                    hash(cell, n)                 class, planets
            └─ planet / moon        hash(star, i) / hash(planet, m)   kind, radius, rings, moons
               └─ patch (f, L, i, j)   noise(planet seed, position)  terrain columns
                  └─ spot (f, a, b)    hash(planet, face, 1 m square)  sand
                     └─ grain (x, y, layer)  hash(spot, x, y, layer)  mineral, shape
                        └─ lattice tile       hash(grain, face, 20 nm square, tile)  atoms
```

The only caches are LRU caches of generated meshes and small lookups; they
can be dropped at any time. The web is unbounded in every direction; galaxy
octrees and planet quadtrees are bounded by their object but resolved only
where you look.

## The level-of-detail hierarchy

| scale | what's drawn | how it's chosen |
| --- | --- | --- |
| > ~100 Mpc | the coarse web: dots strung along links of ~100 Mpc cells | bricks of 4³ cells within ~4× the camera distance; each brick's instances are shuffled, so drawing the first *n* is a fair sample |
| 1 kpc – 1 Gpc | the fine web: a dot per galaxy (~6.5 Mpc cells) whose knot weights come from the coarse web, so galaxies sit on the threads seen from further out | the same bricks, plus a shared budget split across them |
| near a galaxy | an impostor: up to 3,000 samples of its density | count ∝ its pixel area |
| inside a galaxy | an octree: cell (d, …) holds K0·q^d·(its mass share) samples, about 30k at the root, rising by q (~4–5) a level; at the leaf depth (~50 ly cells) q^d reaches the real star count and each sample *is* a star | refined largest-error-first by size/distance, inside a budget and 400 cells; each sample is drawn with a chance set by how bright the stars it stands for look from here (mass ÷ distance²), so a refined cell sharpens without brightening and the sky is as bright as the stars that way are (towards the centre ~10× brighter than away, as from inside a real disc). Cells near you are kept whichever way you look, a 35% margin round the view is pre-made, a cell only swaps for its children once all of them are made, and the brightness threshold moves in notches (after ~20 frames over or well under budget) and is eased into, so the picture holds still at rest (0 changes in 120 frames) and a full 4 s turn changes its brightness by a median 1.8% a frame, at most ~10% |
| a star system | the star, dotted orbits, and planets and moons as dots, then voxel balls | the system of the star you're at (or nearest the target) |
| a planet | cube-sphere quadtree: 6 faces × patches of 24² columns (16² below level 8), each column stacked down to its lowest neighbour | largest error first (size ÷ distance to the patch's real ground), horizon and frustum culling, an adaptive threshold that coarsens the rings round the eye until the chain under it reaches full depth in budget |
| the ground | continental shelves; mountain belts along winding bands, built from ridged multifractal noise (sharp crests, smooth valleys, taller on smaller worlds); rolling detail elsewhere; boulders (8 m cells) and pebbles (12 cm cells). Each layer of detail is added only once it is a few blocks wide, so slopes stay coherent instead of turning to pillars. Snow above a snow line by altitude and latitude, but not on faces too steep to hold it; bare rock and scree above the tree line; cliffs where steep. Faces are lit by which way they point, so sunlit slopes are bright and the far sides dark, and the camera is kept above the ground | patches go down to 2 mm voxels (level ~26) |
| sand | 0.6 mm grain cells on a 1 m spot; far grains as one cube, near ones as voxel balls | tiles within ~9× the camera distance |
| a grain | the same quadtree as a planet (it's a lumpy little world), down to 3 nm voxels | |
| atoms | a two-atom lattice under the grain's surface, 0.26 nm apart, terraced where the surface steps, jittering with heat; ~1% impurities in spectrum colour | 16² column tiles within a radius set by the budget |

Dots that stand for many stars (web galaxies, galaxy samples, impostors) or
many rocks (rings) are capped at a few pixels in the shader, so one that ends
up next to the camera stays a dot instead of becoming a giant block.

Each level fades in and out by camera distance (cubes dissolve one at a
time, as everywhere else on the site), so neighbouring levels overlap for a
decade or so instead of popping.

## Floating origin

Nothing has a global position. Every node (brick, galaxy, octree cell,
star, planet, patch, spot, grain, lattice) stores a float64 offset in metres
from its parent and its own axes. The camera hangs off one node, its anchor,
with a target, a distance D and a direction, all in that node's frame. Each
frame, for every node drawn:

1. walk both chains (node → common ancestor ← anchor), summing offsets and
   rotations in float64, so precision is that of the nearest shared place
   (a sand grain's atoms are measured from the grain, not from the galaxy);
2. subtract the eye and divide by D, and hand the GPU that origin, the
   node's axes in view space and its unit ÷ D. The GPU only ever sees numbers
   of order 1, so float32 holds at 10^26 m and at 10^-10 m alike;
3. the depth buffer is logarithmic (near 10⁻⁶ D, far 10¹⁰ D).

The anchor moves down the tree as you zoom in towards something (galaxy →
star → planet → a 1 m spot → a grain) and back up as you zoom out, with
hysteresis. Flights use van Wijk & Nuij's smooth zoom-and-pan, rewritten in
forms that stay exact when start and end widths differ by 10^18. They run in
the start's frame for the first half and the destination's frame for the
second, so neither end ever needs a big number.

## Budgets

- About 180k cubes a frame, split across the levels (web 30%, coarse web
  25%, galaxies 50%, systems 70%, sand 35%, atoms 45%, and only the levels in
  view draw). A frame-time governor scales the budget down to 35% if frames
  run long.
- Mesh generation runs on the main thread, nearest first: 7 ms a frame, or
  4 ms during flights. Meshes live on the GPU until it holds ~190 MB, then
  the least recently used go.
- One draw call per mesh (brick, octree cell, patch, tile): 15 to 290 calls a
  frame.

## Numbers

Measured on an Apple M3 Pro (ANGLE / Metal, Chrome-based pane), canvas
1380 × 1134 at dpr 1, after everything in view had been generated (`__measure`:
CPU + GPU per frame, synced with `readPixels`):

| where | D | cubes | draws | ms / frame |
| --- | --- | --- | --- | --- |
| web, 4 Gpc (max zoom out) | 1.2e26 | 21.5k | 62 | 0.4 |
| web, 500 Mpc | 1.2e25 | 53k | 140 | 1.3 |
| web, 10 Mpc | 3e23 | 18k | 28 | 0.5 |
| galaxy, 30 kpc | 9.7e20 | 24k | 100 | 0.8 |
| star system, 1 AU | 4.9e10 | 42k | 98 | 2.5 |
| planet from orbit | 1.2e7 | 92k | 63 | 1.6 |
| ground, 4 km | 4e3 | 137k | 169 | 1.5 |
| ground, 1.5 km (mountains) | 1.3e3 | 142k | 182 | 4.4 |
| ground, 1.5 m | 1.4 | 132k | 190 | 2.7 |
| sand, 6 mm | 5.5e-3 | 114k | 167 | 3.5 |
| a grain, 40 µm | 3.5e-5 | 125k | 144 | 3.1 |
| atoms, 2 nm | 1.8e-9 | 14k–144k | 16–154 | 1.1–2.4 |

While moving, generation is part of the frame. Zooming down steadily from
orbit to atoms averaged 5–12 ms a frame (p95 7–15 ms, worst ~30 ms when a
burst of new patches lands). Flights between levels averaged 1.6–6.7 ms (p95
3–15 ms, worst 33–41 ms on the first frames of a flight into a new galaxy or
system). Getting a new place fully detailed takes 0.1–2 s of that budget.

Gzipped size of the lab's JavaScript: **26.2 KB** (62.7 KB raw) at first; with causes, time and search, **36.4 KB** (88.2 KB raw); with the atlas, blocks and atoms, **42.3 KB** (103.9 KB raw); it imports only
`program()` from the engine and the brand's colours.

## What works

- The whole chain is one continuous zoom, in both directions, with no
  loading screens: web → galaxy → star → planet → ground → sand → grain →
  atoms. Clicking anything flies (or warps) there.
- Determinism: the same seed gives the same web, galaxies, systems, terrain,
  sand and atoms each visit.
- Precision holds at every scale, from 10^26 m down to 10^-10 m.
- The look is the site's: cubes shaded by tone on paper or ink, with the
  spectrum kept for the odd thing (young star knots, an ocean, lava, an
  impurity atom).

## What doesn't (yet)

- **Phones: not measured on a real device.** The layout works at 375 × 812,
  and the governor and budgets are built for it, but every number above is
  from a desktop GPU. A phone at dpr 3 should start at a lower budget.
- **Generation is on the main thread.** Bursts while diving or arriving
  cause the 30–40 ms frames. A worker (the generators are pure functions
  that return typed arrays) is the obvious next step.
- **Seams.** Octree cells at different depths can still show faint box edges
  in a galaxy, and quadtree patches show their level changes as a step in
  block size (no skirts or morphing between levels).
- **Gaps in the chain.** Oceans stop at blocks of water (no sand or
  molecules under the sea), gas giants at their cloud tops (2 km blocks) and
  stars at 30 km granules. Sand only spawns on land. The coarse web and the
  fine web agree in where the threads run, but not galaxy by galaxy.
- **Simplifications.** Orbits are circles, planets don't spin, there is no
  lighting from neighbouring stars, the atmosphere is a shell of dots plus a
  sky tint, and the "crystal" is one generic two-atom lattice.
- Picking is screen-space against what's drawn, so a galaxy sample resolves
  to the nearest real star near it, not to the exact sample.
