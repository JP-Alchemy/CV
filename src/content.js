// All site copy lives here. Everything below is placeholder content —
// replace it with your own details, projects and history.
//
// Images: each project has `image: { kind }` (a procedural render: orb,
// terrain, waves, cubes, rings, bars, globe, portrait). To use a real image,
// drop it in /public/images and use `image: { src: '/images/name.jpg' }`.

export const site = {
  name: 'JP',
  fullName: 'JP Bothma',
  title: 'JP Bothma — Software engineer & creative technologist',
  role: 'Software engineer & creative technologist',
  intro:
    'I design and build software that feels alive: realtime interfaces, ' +
    'data-heavy tools, embedded devices and the occasional game. I care ' +
    'about the last ten percent — motion, feel and the details nobody asks for.',
  location: 'Working remotely, worldwide',
  availability: 'Open to selected freelance and full-time roles',
  email: 'hello@example.com',
  links: [
    { label: 'GITHUB', href: 'https://github.com/' },
    { label: 'LINKEDIN', href: 'https://www.linkedin.com/' },
    { label: 'READ.CV', href: 'https://read.cv/' },
  ],
  now: [
    { icon: 'build', text: 'Building a pixel-morphing engine (you are looking at it).' },
    { icon: 'signal', text: 'Prototyping low-power sensors that talk over BLE.' },
    { icon: 'play', text: 'Making a tiny roguelike in my evenings.' },
  ],
};

export const projects = [
  {
    slug: 'lumen',
    title: 'LUMEN',
    year: '2025',
    role: 'Lead engineer',
    stack: 'TypeScript · WebGL · Rust',
    tags: ['DATA VIZ', 'WEBGL'],
    summary: 'Realtime analytics for regional energy grids.',
    image: { kind: 'terrain' },
    body: [
      'Lumen turns millions of sensor readings per minute into a calm, explorable picture of an energy grid. Operators scrub through time, drill into a single substation and spot anomalies before they become outages.',
      'I led a team of four, designed the rendering pipeline (instanced WebGL with GPU-side aggregation) and built the streaming backend in Rust. Median time-to-insight dropped from minutes to seconds.',
    ],
  },
  {
    slug: 'glyph-engine',
    title: 'GLYPH ENGINE',
    year: '2024',
    role: 'Creator',
    stack: 'JavaScript · WebGL2 · GLSL',
    tags: ['CREATIVE CODE', 'TYPE'],
    summary: 'A procedural pixel typography engine.',
    image: { kind: 'waves' },
    body: [
      'Glyph Engine renders type, images and interface as a single field of blocks that can morph between any two layouts. Every page of this site is drawn by it.',
      'The core is a single instanced draw call: every block knows where it came from and where it is going, and the GPU does the rest.',
    ],
  },
  {
    slug: 'orbit',
    title: 'ORBIT',
    year: '2023',
    role: 'Firmware & app engineer',
    stack: 'C · nRF52 · BLE · React Native',
    tags: ['EMBEDDED', 'MOBILE'],
    summary: 'Firmware and companion app for a connected smart lock.',
    image: { kind: 'orb' },
    body: [
      'Orbit is a retrofit smart lock that runs for a year on two AA batteries. I wrote the firmware, the BLE protocol and the companion app that pairs, shares keys and logs access.',
      'Most of the work was invisible: power budgets, secure pairing and making the motor sound reassuring rather than alarming.',
    ],
  },
  {
    slug: 'tessellate',
    title: 'TESSELLATE',
    year: '2024',
    role: 'Full-stack engineer',
    stack: 'WebCodecs · WASM · Svelte',
    tags: ['VIDEO', 'TOOLS'],
    summary: 'A browser-native video editor.',
    image: { kind: 'cubes' },
    body: [
      'Tessellate edits 4K footage entirely in the browser using WebCodecs and a WASM compositor — no uploads, no waiting.',
      'I built the timeline, the frame-accurate scrubbing and an effects graph that compiles to shaders on the fly.',
    ],
  },
  {
    slug: 'fieldnotes',
    title: 'FIELDNOTES',
    year: '2022',
    role: 'Engineer & designer',
    stack: 'Python · PostGIS · MapLibre',
    tags: ['MAPS', 'CLIMATE'],
    summary: 'Mapping urban CO2 emissions street by street.',
    image: { kind: 'globe' },
    body: [
      'Fieldnotes combines traffic counts, building data and low-cost sensors to estimate emissions for every street in a city, then makes the result legible for residents and councils.',
      'I built the data pipeline and the map, and ran workshops to make sure the numbers changed decisions.',
    ],
  },
  {
    slug: 'low-orbit',
    title: 'LOW ORBIT',
    year: '2023',
    role: 'Solo developer',
    stack: 'Godot · GDScript',
    tags: ['GAMES'],
    summary: 'A small roguelike about salvaging satellites.',
    image: { kind: 'rings' },
    body: [
      'Low Orbit is a bite-sized roguelike: drift between derelict satellites, salvage parts and try to make it home before your oxygen runs out.',
      'Made in Godot over a long winter of evenings, with procedural levels and a soundtrack built from radio static.',
    ],
  },
];

export const principles = [
  { icon: 'craft', title: 'CRAFT', text: 'Details are the product. I sweat the last ten percent so the first ninety feels effortless.' },
  { icon: 'systems', title: 'SYSTEMS', text: 'I like building the engine, not just the car — tools and foundations other people can build on.' },
  { icon: 'motion', title: 'MOTION', text: 'Interfaces should feel physical. Good motion explains where things came from and where they went.' },
];

export const experience = [
  {
    id: 'northwind',
    period: '2023 — NOW',
    role: 'Senior Software Engineer',
    org: 'Northwind Studio',
    summary: 'Realtime data products for energy and mobility clients.',
    points: [
      'Lead engineer on Lumen, a WebGL analytics platform.',
      'Introduced a shared rendering toolkit used by five teams.',
      'Mentor for three engineers; run the studio’s tech talks.',
    ],
  },
  {
    id: 'parallel',
    period: '2020 — 2023',
    role: 'Full-stack Engineer',
    org: 'Parallel Labs',
    summary: 'Hardware startup building connected home devices.',
    points: [
      'Wrote firmware and BLE stack for the Orbit smart lock.',
      'Built the React Native companion app and its OTA updater.',
      'Cut cloud costs by 60% by moving telemetry to edge batching.',
    ],
  },
  {
    id: 'bright',
    period: '2018 — 2020',
    role: 'Software Developer',
    org: 'Bright Agency',
    summary: 'Interactive campaigns and sites for cultural clients.',
    points: [
      'Shipped 20+ interactive sites, three of them award-winning.',
      'Built the agency’s first WebGL and generative-art pipeline.',
    ],
  },
  {
    id: 'freelance',
    period: '2016 — 2018',
    role: 'Freelance Developer',
    org: 'Independent',
    summary: 'Websites, prototypes and small tools for local businesses.',
    points: [
      'Delivered 30+ projects end-to-end, from brief to launch.',
    ],
  },
];

export const education = [
  { period: '2012 — 2016', title: 'BSc Computer Science', org: 'University of Somewhere' },
];

export const skills = [
  { group: 'LANGUAGES', items: ['TypeScript', 'JavaScript', 'Python', 'Rust', 'C / C++', 'GDScript', 'SQL'] },
  { group: 'WEB', items: ['React', 'Svelte', 'Node', 'WebGL', 'Three.js', 'WebCodecs', 'Vite'] },
  { group: 'SYSTEMS', items: ['Embedded (nRF, ESP32)', 'BLE', 'Linux', 'Docker', 'PostGIS'] },
  { group: 'DESIGN', items: ['Figma', 'Prototyping', 'Motion', 'Type'] },
];
