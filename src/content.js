// All site copy lives here. Display copy is upper-case because it is set in
// the pixel font; `seo` strings are what search engines and link previews see.
//
// Images: each project has `image: { kind }` (a procedural render: moon,
// terrain, waves, duck, cyber, earth, motorcycle, switchbacks, pose, cubes,
// rings, bars, globe, portrait, orb). To use a real image, drop it in
// /public/images and use `image: { src: '/images/name.jpg' }`.

import { FONT } from './brand.js';

export const site = {
  name: 'JP',
  fullName: 'JP Bothma',
  url: 'https://jpbothma.com',
  role: 'Creative technologist',
  location: 'Leiden, Netherlands',
  tagline: 'Thoughtful software for work that matters.',
  intro:
    "I'm a South African creative technologist living in Leiden. I build interactive worlds, make " +
    'data legible and engineer sustainable systems — lately with AI agents that quietly take care ' +
    'of the repetitive, so people keep the parts that need a human.',
  availability: 'Taking on a small number of projects, retainers and long partnerships',
  // Set an address to show it (with a copy button) on the contact page.
  email: null,
  linkedin: 'https://www.linkedin.com/in/jp-bothma',
  github: 'https://github.com/JP-Alchemy',
  twitter: '@jpbothma',
  // About-page portrait: a photo, cut out from its plain backdrop and halftoned.
  portrait: {
    src: '/images/jp-portrait.jpg',
    alt: 'Portrait of JP Bothma, drawn as a 1-bit dithered pixel image',
    style: 'dither', // 2px ordered dither reads most like a photo
    cell: 2,
    gamma: 1.2,
    cutout: { warm: 0.05 }, // drop the neutral grey wall
    levels: [0.12, 0.8],
    minInk: 0.28,
    darkMaxInk: 0.7,
  },
  googleVerification: 'gV7fZJspVr47lEmPlS5RqDFiHe2BN9ViEN6m61_QGaM',
  now: [
    { when: 'OCT 2026', icon: 'build', text: "Rebuilding this site out of pixels. Every letter is a block that knows where it's going next." },
    { when: 'AUG 2026', icon: 'motion', text: 'Building a free motorcycle-touring framework: book, download the route, go.' },
    { when: 'JUL 2026', icon: 'agent', text: 'Shipping AI agents at Interfood that quietly automate the repetitive parts of sustainability work.' },
  ],
};

export const links = [
  { label: 'LINKEDIN', href: site.linkedin },
  { label: 'GITHUB', href: site.github },
];

export const projects = [
  {
    slug: 'interfarm',
    title: 'INTERFARM',
    name: 'Interfarm',
    when: '2024 — NOW',
    role: 'Tech Lead of Sustainability, Interfood',
    stack: 'Azure · Data platforms · AI workflows',
    tags: ['SUSTAINABILITY', 'DATA PLATFORM', 'AI AGENTS'],
    summary: 'A live platform where dairy customers and suppliers plan, fund and track on-farm CO₂ reduction together.',
    image: { kind: 'terrain' },
    body: [
      'Interfood trades dairy around the world, and many of its customers have climate targets that only become real on the farm. Interfarm is where those targets turn into actual work: customers and dairy suppliers plan on-farm interventions, fund them together and track the CO₂ they take out.',
      'I lead the technology behind it — architecture, delivery across several external engineering teams, and turning regulatory and customer requirements into a product people actually use. Around it I am building AI agents and orchestrated workflows that run sustainability operations end to end, from data intake to customer reporting.',
    ],
  },
  {
    slug: 'where-does-my-food-come-from',
    title: 'WHERE DOES MY FOOD COME FROM?',
    name: 'Where does my food come from?',
    seoTitle: 'Where Does My Food Come From? — Food Supply Chain Globe | JP Bothma',
    when: 'LIVE',
    role: 'Maker',
    stack: 'React 19 · TypeScript · Vite · Zustand · MapLibre GL 6',
    tags: ['DATA VISUALISATION', 'SUSTAINABILITY', 'WEBGL', 'GAME UX'],
    summary: 'An interactive 3D globe that follows fresh food from the farm to your Dutch supermarket shelf, and on to where it ends up if no one buys it.',
    line: 'Fresh food from the farm to a Dutch supermarket shelf, on a 3D globe.',
    url: 'https://wheredoesmyfood.com/',
    image: { kind: 'earth' },
    schema: { '@type': 'WebApplication', applicationCategory: 'EducationalApplication', operatingSystem: 'Any (web browser)' },
    body: [
      'A game-like web app that traces fresh food sold in Dutch supermarkets back to where it was grown. Pick a supermarket, a store and a product, then watch an animated journey by truck, ship and plane. A running tally shows the kilometres, time, CO₂e, fuel, cost and food lost along the way. You can also add products to a weekly basket, compare seasons and see where unsold food goes.',
    ],
    sections: [
      {
        title: 'THE IDEA',
        text: 'Food supply chains are invisible. This app makes them visible and playable, and labels every figure by how sure it is: Verified, Likely or Estimated.',
      },
      {
        title: 'WHAT YOU CAN DO',
        items: [
          { lead: 'Follow a supermarket', text: 'Choose one of five Dutch chains (Albert Heijn, Jumbo, Lidl, ALDI, PLUS) and one of 3,051 real store locations, then pick a product from an aisle laid out like a game hotbar.' },
          { lead: 'Watch the journey', text: 'The camera flies from farm to shelf while vehicles travel each leg and the numbers fly into a live tally. The journey can be scrubbed, paused or replayed. It ends with an A–E CO₂e grade, badges, a passport stamp and a suggested lower-carbon swap.' },
          { lead: 'Follow a product', text: 'See one product’s whole network at once: every origin, port and trader, and 23 grocers in six European countries.' },
          { lead: 'Seasons', text: 'A draggable month timeline shows each product’s footprint and origin month by month, with a “play the year” animation.' },
          { lead: 'Near me', text: 'Find your local stores from your device’s location or a postcode. The lookup happens in the browser and nothing is sent anywhere.' },
          { lead: 'Food waste', text: 'See how much is harvested for every kilo sold, what’s lost at each stage, where it goes (food banks, animal feed, biogas, composting, incineration) and how much of the price pays for it.' },
          { lead: 'After the shelf', text: 'Shelf life, what stores do with unsold food, and its route to real Dutch waste plants, with the diesel used and an electric-truck comparison.' },
          { lead: 'My weekly shop', text: 'A basket priced at your store, with total CO₂e, cost, distance and waste, the same basket across the year, and one-click swaps to lower-footprint origins.' },
        ],
      },
      {
        title: 'TECHNICAL HIGHLIGHTS',
        items: [
          { lead: 'Stack', text: 'React 19, TypeScript, Vite (Rolldown) and Zustand; MapLibre GL 6 in globe projection with satellite imagery.' },
          { lead: 'Custom WebGL cloud layer', text: 'The cloud pattern is generated on the GPU and drawn as two layers that move with parallax, change shape and cast shadows.' },
          { lead: 'Pure-function animation', text: 'The whole journey (camera, vehicles, trails, running totals) is calculated from the time position alone, so it can be scrubbed both ways. Camera flights use the van Wijk–Nuij curve, and globe framing is custom.' },
          { lead: 'Transparent model', text: 'Every figure is computed in code (CO₂e, cost split, fuel, food waste, treatment) from cited sources: DEFRA, GLEC, Poore & Nemecek, FAO and RIVM. A model-check script verifies every product × route × chain combination.' },
          { lead: 'Light on resources', text: 'No backend, store data from OpenStreetMap, location and basket kept on the device, and heavy calculations spread across animation frames so the interface stays smooth.' },
          { lead: 'Deployment', text: 'GitHub Actions to GitHub Pages on a custom domain. MapLibre is split into its own cached file, and link-preview images are included.' },
        ],
      },
    ],
  },
  {
    slug: 'swarmfort',
    title: 'SWARMFORT.IO',
    name: 'SwarmFort.io',
    seoTitle: 'SwarmFort.io — Multiplayer Browser Game Case Study | JP Bothma',
    when: '2026',
    role: 'Product lead · built with Claude Code',
    stack: 'TypeScript · Canvas 2D · Web Audio · Node.js · WebSockets · SQLite',
    tags: ['MULTIPLAYER', 'BROWSER GAME', 'AI-ASSISTED'],
    summary: 'A multiplayer .io game where toys defend forts from a horde, grow swarms of flies, and fire them at each other. Free in the browser, no download.',
    line: 'A multiplayer .io fort battle. Grow a swarm of flies, hold the fort.',
    url: 'https://swarmfort.io/',
    image: { src: '/images/swarmfort-cover.jpg', lumaInk: true, levels: [0.3, 0.9] },
    schema: { '@type': 'VideoGame', gamePlatform: 'Web browser', playMode: 'MultiPlayer', genre: 'io game' },
    body: [
      'Eight players (people, with bots filling empty seats) each start at a fort on one shared map. Your toy fights the dust-bunny horde automatically, so moving is the main control. Kills drop gems and, sometimes, a fly for your swarm. Carry gems home to bank them, then spend them on levels, turrets, walls and a bigger swarm.',
      'Fire the swarm at a rival, their fort or their mine; they can send their own swarm to meet it, and the bigger side wins the clash. Lose your toy or your fort and you’re out. The last one standing wins. An Infinite mode runs a much bigger world that never ends: people come and go, empty forts are captured, and whoever holds the most wears the crown with a bounty on their head.',
    ],
    sections: [
      {
        title: 'IN NUMBERS',
        stats: [
          { value: '9', label: 'DAYS TO BUILD · 39 COMMITS' },
          { value: '~13K', label: 'LINES OF TYPESCRIPT' },
          { value: '72', label: 'AUTOMATED TESTS' },
          { value: '1', label: 'RUNTIME DEPENDENCY (WS)' },
          { value: '~83 KB', label: 'GZIPPED GAME CODE' },
          { value: '150+', label: 'PLAYERS PER CPU CORE IN LOAD TESTS' },
        ],
      },
      {
        title: 'ENGINEERING HIGHLIGHTS',
        items: [
          { lead: 'Deterministic simulation', text: 'A fixed 60 Hz step, seeded randomness and no clock reads, so the same seed and inputs always replay the same match. That one rule powers the tests, a bot-only balance simulator, and the preview-video tool, which replays matches to film their best moments.' },
          { lead: 'Server-authoritative multiplayer', text: 'A Node server with WebSockets runs every room on one 60 Hz loop. Each player gets binary snapshots 20 times a second, trimmed to what’s near their camera: about 1–2 KB each. The client predicts its own movement and reconciles with the server by input sequence numbers.' },
          { lead: 'Bots that play properly', text: 'An autopilot fills empty seats: bots bank and build, claim mines, block incoming swarms and fire their own. Bot-only match simulations tuned the pacing to 7.5–10 minute games, with the first knockout after minute three.' },
          { lead: 'Zero art or audio files', text: 'Characters, monsters, forts, the toy-room floor and about 80 UI icons are drawn in code. Every sound is synthesised with Web Audio, including a soundtrack that builds through the match and a buzzing drone for swarms in flight.' },
          { lead: 'Ready for game portals', text: 'One adapter connects the CrazyGames SDK (ads, rewarded ads, cloud saves, invites, instant multiplayer, mute) and falls back to a plain build anywhere else. A Playwright script plays the game at all ten of the portal’s QA window sizes and fails on overlapping or clipped UI.' },
          { lead: 'Privacy-first analytics', text: 'Anonymous gameplay events (no accounts, no personal data; Do Not Track and GPC respected) go into SQLite on the game server. A private stats page shows players, sessions, games and day-1 / day-7 retention.' },
        ],
      },
      {
        title: 'HOW IT FITS TOGETHER',
        cols: 3,
        items: [
          { lead: 'Browser client', text: 'Canvas 2D renderer, DOM HUD, Web Audio, input prediction, a replica of the world built from snapshots.' },
          { lead: 'Shared simulation', text: 'The same deterministic world code runs on the server and offline in the browser, so the game still works with no server.' },
          { lead: 'Game server', text: 'Node and ws: lobbies, rooms, a 60 Hz loop, interest-managed snapshots, analytics, static hosting.' },
        ],
        note: 'Client to server: movement inputs each frame (binary), commands as small JSON. Server to client: 20 Hz binary snapshots, events and seat info. Hosted on a small VPS behind nginx, with systemd and Let’s Encrypt. GitHub Actions tests every branch and deploys when the production branch moves, with validation and automatic rollback.',
      },
      {
        title: 'FROM FIRST BUILD TO PORTAL-READY',
        steps: [
          'Started as Survivors 99: 99 players each fighting their own horde and sending monsters at each other. A shared-map prototype played better, so it became one map where forts, mines and swarms make other players the real threat.',
          'Playtesting showed nobody could lose in the opening, so protection became shorter, weaker and visible (a shield bubble with a countdown).',
          'Moved the game onto an authoritative multiplayer server, then shipped it on its own domain with automatic deploys.',
          'The first CrazyGames submission was declined on quality. Their QA guidelines became a checklist: a menu that fits every window, a decluttered HUD, instant play, an in-game tutorial, swarms from 0:30 instead of 2:00, and protection for newcomers.',
          'A visual pass replaced emoji with drawn icons, added real game fonts, and turned the flat map into a toy room.',
        ],
      },
      {
        title: 'SCREENS',
        gallery: [
          { src: '/images/swarmfort-menu.jpg', levels: [0.15, 0.75], alt: 'The SwarmFort.io menu: the logo, four toy characters to choose from, PLAY and INFINITE buttons, over a live bot match.', caption: 'The menu, over a live bot match.' },
          { src: '/images/swarmfort-match.jpg', levels: [0.15, 0.75], alt: 'A SwarmFort.io match on the toy-room map: forts on rugs, a crystal mine, players with fly swarms, the minimap and standings.', caption: 'A match: forts on rugs, a mine in a sandbox, swarms buzzing around their players.' },
        ],
      },
      {
        title: 'MY ROLE',
        text: 'I led the product: the concept, the game design calls, playtesting and balance feedback, the name and domain, hosting, and the CrazyGames submission. I built it with Claude Code as an AI pair-programmer, directing the work feature by feature and reviewing the results.',
      },
    ],
  },
  {
    slug: 'nezen',
    title: 'NEZEN.IO',
    name: 'nezen.io',
    when: 'LIVE',
    role: 'Maker',
    stack: 'SvelteKit · TypeScript · PostgreSQL · WhatsApp API',
    tags: ['CALM TECH', 'WEBGL'],
    summary: 'One zen story each morning, by email or WhatsApp. A quiet corner of the internet for slowing down.',
    url: 'https://nezen.io/',
    image: { kind: 'waves' },
    body: [
      'nezen.io sends one short zen story each morning, by email or WhatsApp — whichever you already open first. No feed and no infinite scroll: a story, a moment to sit with it, and then the rest of your day.',
      'It is built with SvelteKit, TypeScript and PostgreSQL, with the WhatsApp API for delivery. There is journalling and streaks for the people who want them, and a WebGL ink canvas for the people who simply like ink.',
    ],
  },
  {
    slug: 'what-the-duck',
    title: 'WHAT THE DUCK',
    name: 'What The Duck',
    when: 'LIVE',
    role: 'Maker',
    stack: 'React-Three-Fiber · Three.js · Cannon physics · Zustand',
    tags: ['BROWSER GAME', '3D WEB'],
    summary: 'A physics-driven 3D browser game. Ducks, levels and a healthy amount of mayhem.',
    url: 'https://wtd.jpbothma.com/',
    image: { kind: 'duck' },
    body: [
      'What The Duck is a physics-driven 3D game that runs straight in the browser — no install and no app store, just ducks, levels and a healthy amount of mayhem.',
      'Built end to end with React-Three-Fiber and Three.js, real-time physics from Cannon and game state in Zustand. A playground for game feel on the web: chunky controls, honest physics and ducks that do not always behave.',
    ],
  },
  {
    slug: 'cyberspace-central',
    title: 'CYBERSPACE CENTRAL',
    name: 'Cyberspace Central',
    when: 'LIVE',
    role: 'Maker',
    stack: 'Three.js · React-Three-Fiber · React Spring',
    tags: ['3D WEB', 'SCROLLYTELLING'],
    summary: 'A scroll-driven, neon-soaked 3D web experience — interdimensional stories told through WebGL.',
    url: 'https://contendo.jpbothma.com/',
    image: { kind: 'cyber' },
    body: [
      'Made for a Three.js challenge: a scroll-driven journey through a neon-soaked cyberspace, where every turn of the mouse wheel moves you through another interdimensional story.',
      'Three.js and React-Three-Fiber build the worlds, React Spring handles the motion, and a lot of tuning went into making scrolling feel like travelling rather than reading.',
    ],
  },
  {
    slug: 'motorcycle-tour',
    title: 'MOTORCYCLE TOUR FRAMEWORK',
    name: 'Motorcycle Tour Framework',
    when: 'IN THE MAKING',
    role: 'Maker',
    stack: 'Leaflet · OpenStreetMap',
    tags: ['TRAVEL', 'MAPS', 'FREE'],
    summary: 'A free, self-guided touring kit. The first roadbook: Leiden to the Alps, every pass, bed and euro accounted for.',
    url: '/projects/moto-tour/',
    cta: 'OPEN THE ROADBOOK',
    image: { kind: 'motorcycle' },
    body: [
      'A free, self-guided touring kit for riders who want the planning done properly: the route, every pass, every bed and every euro, laid out day by day.',
      'The first roadbook runs from Leiden to the Alps and back — eleven nights, 3,615 km and 25 named passes, with the budget, the tolls and the early alarms worked out in advance. The framework around it is still in the making: book, download the route, go.',
    ],
  },
  {
    slug: 'body-tracked-gaming',
    title: 'BODY-TRACKED GAMING',
    name: 'Body-tracked gaming at PWXR',
    when: '2023',
    role: 'Senior Developer & Lead Innovation Specialist, PWXR',
    stack: 'React-Three-Fiber · TensorFlow.js · Unity3D · Unreal Engine',
    tags: ['XR', 'GAMES'],
    summary: 'Full-body gaming in the browser — no installs, no wearables, just a webcam.',
    image: { kind: 'pose' },
    body: [
      'At PWXR I worked on next-generation full-body gaming. The browser version needed nothing but a webcam: TensorFlow.js tracked the player and React-Three-Fiber turned their movement into play — no installs and no wearables.',
      'Alongside it I shipped native titles in Unity3D and Unreal Engine for Windows and mobile VR, built the event and content-management systems behind the product suite, and set up CI/CD pipelines that made cross-platform releases boring in the best way.',
    ],
  },
];

export const services = [
  {
    icon: 'cube',
    title: 'INTERACTIVE EXPERIENCES & 3D',
    name: 'Interactive experiences & 3D',
    rate: 'FROM €130/HR',
    price: 130,
    text: 'Real-time 3D, WebGL and immersive interfaces for web and native — React-Three-Fiber, Unity, Unreal. Built to be felt before they are understood.',
  },
  {
    icon: 'data',
    title: 'DATA VISUALISATION & DASHBOARDS',
    name: 'Data visualisation & dashboards',
    rate: 'FROM €120/HR',
    price: 120,
    text: 'Operational dashboards, sustainability reporting and custom visual tools that make complex data legible, useful and quietly beautiful.',
  },
  {
    icon: 'agent',
    title: 'AI AGENTS & WORKFLOW AUTOMATION',
    name: 'AI agents & workflow automation',
    rate: 'FROM €140/HR',
    price: 140,
    text: 'Custom models, orchestrated agents and end-to-end automated workflows that take the repetitive work — leaving people the judgement, the care and the creative leap.',
  },
  {
    icon: 'leaf',
    title: 'SUSTAINABILITY ENGINEERING',
    name: 'Sustainability engineering',
    rate: 'FROM €120/HR',
    price: 120,
    text: 'Software for the circular economy: digital product passports, lifecycle data pipelines and measured-impact tools. ESPR-aligned and built to last.',
  },
  {
    icon: 'compass',
    title: 'FRACTIONAL CTO',
    name: 'Fractional CTO',
    rate: 'FROM €130/HR',
    price: 130,
    text: 'Part-time technical leadership for small teams — strategy, architecture, hiring and honest counsel, without the overhead of a full-time hire.',
  },
];

export const onRequest = {
  name: 'OT/ICS security assessments',
  rate: 'FROM €150/HR',
  price: 150,
  text: 'Also on request: security assessments of operational technology for energy and industrial clients — wind, solar and industrial control systems.',
};

// The short animated story at /story/ (src/story/), as it's offered on the
// home and about pages.
export const story = {
  title: 'THE ADVENTURER',
  href: '/story/',
  cta: 'WATCH IT',
  home: 'An ink-and-paper world, a d20, a small ship, seven unknown worlds and a lonely dragon, told in the blocks this site is made of. Eighty seconds, with sound.',
  about: 'The short version, in blocks: someone leaves an ink-and-paper world to go looking for colour, and brings it home. Eighty seconds, with sound.',
};

export const about = {
  bio: [
    "I'm a South African creative technologist living in Leiden, working where interactive experiences, data visualisation and sustainability-minded engineering meet.",
    'Over the last ten years that has taken me from IoT dashboards and HoloLens prototypes in Pretoria, through a game studio, FinTech and a start-up in Dubai, to leading sustainability technology for a global dairy group from the Netherlands.',
    'Lately that means AI agents and orchestrated workflows that quietly take care of the repetitive — so people keep the parts that need a human: the judgement, the care, the creative leap.',
  ],
  quote: "IT'S NOT ABOUT THE BEST TECHNOLOGY. IT'S ABOUT THE MOST THOUGHTFUL USE OF IT.",
};

export const principles = [
  { icon: 'craft', title: 'CREATIVITY IS A TOOL', text: 'Not the goal. I use it to find the simplest thing that will genuinely work — and then to make that thing a pleasure to use.' },
  { icon: 'build', title: 'CRAFT IS A DISCIPLINE', text: 'The unglamorous last ten percent: edge cases, performance, accessibility, the handover. It is where software earns trust.' },
  { icon: 'leaf', title: 'IMPACT IS THE POINT', text: 'I am less interested in building the newest thing than the right thing — for the people using it, and the planet they live on.' },
];

export const stats = [
  { value: '10+', label: 'YEARS SHIPPING SOFTWARE' },
  { value: '4×', label: 'CTO & TECH LEAD ROLES' },
  { value: '5', label: 'CONTINENTS WORKED ACROSS' },
  { value: 'BSc', label: 'COMPUTER SCIENCE, CUM LAUDE' },
];

export const cv = {
  title: 'Tech Lead & Creative Technologist',
  headline: 'Tech lead & creative technologist · AI agents & orchestration · Full-stack · Interactive 3D · Sustainability',
  summary:
    'Hands-on tech lead with 10+ years shipping products across sustainability, AI, FinTech, XR and IoT. I own products from first sketch to production: architecture, code, teams and delivery.',
  available:
    'Open to senior and principal engineering roles, tech-lead positions and fractional CTO engagements — AI, full-stack, interactive or sustainability. On-site in the Netherlands, hybrid or remote.',
};

export const experience = [
  {
    id: 'interfood',
    period: 'MAR 2024 — NOW',
    role: 'Tech Lead of Sustainability',
    org: 'Interfood Group',
    place: 'Eindhoven, NL',
    summary: 'I own sustainability technology for a global dairy trading group — shipping the products and AI automation that turn climate targets into day-to-day operations.',
    points: [
      'Shipped Interfarm, a live platform where customers and dairy suppliers plan, fund and track on-farm CO₂-reduction interventions together.',
      'Building AI agents and orchestrated workflows that automate sustainability operations end to end, from data intake to customer reporting.',
      'Set technical direction across R&D, Trade and Logistics; own architecture and delivery across several external engineering teams.',
      'Turn regulatory and customer sustainability requirements into shipped, scalable product.',
    ],
    tags: 'Interfarm · AI agents · Workflow automation · Azure · Data platforms · Team leadership',
  },
  {
    id: 'pwxr',
    period: 'JAN 2023 — MAR 2024',
    role: 'Senior Developer & Lead Innovation Specialist',
    org: 'PWXR',
    place: 'Rotterdam & The Hague, NL',
    summary: 'Next-generation full-body gaming technology: immersive, real-time interactive experiences on web and native platforms.',
    points: [
      'Built an in-browser full-body-tracking game with React-Three-Fiber and TensorFlow.js — no installs, no wearables, just a webcam.',
      'Shipped native titles in Unity3D (C#) and Unreal Engine (C++) for Windows and mobile VR.',
      'Delivered the event- and content-management systems behind the product suite.',
      'Introduced CI/CD pipelines for reliable, automated cross-platform releases.',
    ],
    tags: 'React-Three-Fiber · TensorFlow.js · Unity3D · Unreal Engine · C# · C++ · VR',
  },
  {
    id: 'talk360',
    period: 'OCT 2022 — JAN 2023',
    role: 'Tech Lead — FinTech Payment Platform',
    org: 'Talk360',
    place: 'Amsterdam, NL',
    summary: 'Led an internationally distributed team building a payment platform that widens access to global communication.',
    points: [
      'Led a globally distributed remote team delivering the Talk360 payment platform for emerging markets.',
      'Designed the backend API-aggregation layer in Node.js (MarbleJS), unifying multiple payment providers behind one interface.',
      'Built the Vue.js frontend with a focus on accessible, low-friction payments.',
    ],
    tags: 'Node.js · MarbleJS · Vue.js · Remote leadership · Payment systems',
  },
  {
    id: 'lit',
    period: 'MAR 2021 — OCT 2022',
    role: 'CTO',
    org: 'LIT Trading & WWA Trading',
    place: 'Dubai, UAE',
    summary: 'Co-founded and ran the technology side of a FinTech venture: trading education, gamification and an automated algorithmic hedge fund.',
    points: [
      'Built quantitative trading systems in PineScript, MQL4/5, C++ and Python, integrating live data from multiple brokers and providers.',
      'Launched Vaultron.io as a white-labelled education platform for scalable client deployments.',
    ],
    tags: 'PineScript · MQL4/5 · C++ · Python · Algorithmic trading · Platform architecture',
  },
  {
    id: 'vaultron',
    period: 'FEB 2021 — OCT 2022',
    role: 'CTO & Founder',
    org: 'Vaultron.io',
    place: 'Dubai, UAE',
    summary: 'An e-learning platform with studio-grade media encryption and a proprietary anti-piracy layer.',
    points: [
      'Designed and shipped studio-grade media encryption plus a proprietary anti-piracy layer.',
      'Architected multi-tenant infrastructure serving educational organisations internationally.',
      'Led the hands-on engineering team from concept to production.',
    ],
    tags: 'Media encryption · DRM · Anti-piracy · Platform architecture · SaaS',
  },
  {
    id: 'deuterium',
    period: 'OCT 2019 — APR 2021',
    role: 'Lead Developer & Co-Founder',
    org: 'Deuterium Studios',
    place: 'Remote',
    summary: 'Co-founded a game studio building an infinite, multi-scale ARPG MMO on custom voxel technology and procedural world generation.',
    points: [
      'Built voxel and city-building technology for infinitely scalable in-game worlds.',
      'Implemented procedural world generation with blend maps and custom shader tooling.',
      'Designed the backend server architecture and built VFX with Unity VFX Graph.',
      'Mentored the engineering team from prototype to playable builds.',
    ],
    tags: 'Unity3D · C# · VFX Graph · Procedural generation · Network architecture',
  },
  {
    id: 'consulting',
    period: 'MAR 2018 — FEB 2021',
    role: 'Executive Advisor, Solutions Architect & Developer',
    org: 'Independent consulting',
    place: 'Various',
    summary: 'Strategic advisor and hands-on developer for start-ups in banking, food services, IoT, health and online retail.',
    points: [
      'Architected technology and business processes for banking, hedge-fund and financial operations.',
      'Took IoT systems to production and built 3D data visualisation for industrial clients.',
      'Delivered retail automation and algorithmic tooling with security designed in from the start.',
    ],
    tags: 'Solutions architecture · IoT · 3D visualisation · Cybersecurity · Automation · DevOps',
  },
  {
    id: 'iotnxt',
    period: 'SEP 2016 — MAR 2018',
    role: 'Full-Stack Engineer & Innovation Specialist',
    org: 'IoT.nxt',
    place: 'Pretoria, ZA',
    summary: "Built the company's core IoT data-visualisation platform and led a skunkworks division prototyping AR/VR and robotics.",
    points: [
      "Built Commander Web, the company's main IoT data-visualisation product, in Angular, C# and .NET Core.",
      'Led the innovation division: AR/VR prototypes on HoloLens and HTC Vive, LiDAR scanning and robotics.',
      'Created live 3D representations of IoT data for the next-generation product interface.',
      'Prototyped IoT-driven robotic arms with self-taught inverse kinematics and facial recognition.',
    ],
    tags: 'Angular · C# · .NET Core · AR/VR · HoloLens · Unity3D · LiDAR · Robotics',
  },
];

export const education = [
  { period: '2014 — 2016', title: 'BSc Computer Science, cum laude', org: 'Pearson Institute, South Africa' },
];

export const skills = [
  { group: 'AI & AUTOMATION', items: ['AI agents', 'LLM orchestration', 'Workflow automation', 'Custom models', 'AI integration'] },
  { group: 'ENGINEERING', items: ['TypeScript', 'React', 'Angular', 'Vue.js', 'Node.js', 'Python', 'C# / .NET', 'C++'] },
  { group: 'DATA & CLOUD', items: ['Azure', 'Databricks', 'Airflow', 'dbt', 'Data pipelines', 'Time-series analytics'] },
  { group: 'INTERACTIVE & XR', items: ['WebGL', 'React-Three-Fiber', 'Unity3D', 'Unreal Engine', 'TensorFlow.js', 'AR / VR'] },
  { group: 'ARCHITECTURE', items: ['Solutions architecture', 'Microservices', 'API design', 'CI/CD', 'Cloud deployment'] },
  { group: 'LEADERSHIP', items: ['Tech lead', 'CTO', 'Remote teams', 'Product strategy', 'Mentoring', 'Start-up advisory'] },
  { group: 'DOMAINS', items: ['Sustainability & ESG', 'FinTech & trading', 'Cybersecurity', 'IoT & embedded', 'EdTech & DRM'] },
];

// The colophon (/colophon/): how the site is made, and the rules it keeps.
export const colophon = {
  intro: 'Everything here is made of one material: square blocks of ink on a dot grid. Colour only shows up as light, when something happens. These are the rules I keep, and the parts, in case you want to borrow any.',
  colour: "Ink and paper do the work, and swap places in the dark. The seven colours only ever arrive as light: the ring that runs out from a click, a flower in the garden, the light crossing my profile picture. Outside this page, if something is coloured and nothing happened, it's a bug.",
  type: `${FONT.family}: five blocks by seven, with lowercase, descenders and a bold that is the same letter again, one pixel to the right. Capitals for headings, sentence case for reading. Set it in whole pixels, 20px for text and 40px and up for headings, and it stays sharp. It's a real font file as well now, so print, slides and email can use it.`,
  specimen: ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789 .,:;!?&@#%€ ← → ↑ ↓ ✓ ©'],
  mark: "JP, seven blocks by five. In the nav and in your browser tab it keeps changing its mind, and the frames are the job, more or less. At rest it's always JP: that's the file below.",
  frames: [
    { label: 'JP', text: 'Me.' },
    { label: 'PROMPT', text: 'Build it.' },
    { label: 'TARGET', text: 'Aim at the right thing, not the newest one.' },
    { label: 'HEART', text: "Care how it's made." },
    { label: 'SMILE', text: 'For people.' },
  ],
  motion: 'Nothing loads. When you change page, the blocks on both pages travel to their new places and the rest dissolve or arrive. Icons tumble between shapes and the pointer pushes text out of its way. Click anywhere and a ring of light runs out from it, red at the front and violet at the back. If your system asks for less motion, the blocks snap into place, the icons hold still and the light stays off.',
  build: [
    'One WebGL2 draw call. Every block on the page is an instance, and the GPU works out all the motion; the CPU only rewrites buffers when the page changes.',
    'Real HTML under the canvas, positioned over each block, so links, keyboards and screen readers work.',
    `Every page is also prerendered as plain HTML, set in ${FONT.family}, for search engines, link previews and print. Turn WebGL off and that's what you get.`,
    'The letters are bitmaps in a JavaScript file. The same file builds the font, and the same parts draw the link previews, the LinkedIn banner and the profile pictures.',
    'Press G for the garden: a falling-sand simulation that steps 60 times a second and draws as one texture. A wrong address gets you a word puzzle.',
    'Vite and plain JavaScript, no framework. Hosted on GitHub Pages.',
    'The same parts tell a story, too: The Adventurer, eighty seconds with sound, drawn and voiced in blocks.',
  ],
  downloads: [
    { label: `${FONT.family.toUpperCase()} REGULAR`, kind: 'TTF', href: `/fonts/${FONT.files.regular}.ttf` },
    { label: `${FONT.family.toUpperCase()} BOLD`, kind: 'TTF', href: `/fonts/${FONT.files.bold}.ttf` },
    { label: 'THE MARK', kind: 'SVG', href: '/brand/jp-mark.svg' },
    { label: 'LINKEDIN BANNER, LIGHT', kind: 'PNG · 1584×396', href: '/brand/linkedin-banner-light.png' },
    { label: 'LINKEDIN BANNER, DARK', kind: 'PNG · 1584×396', href: '/brand/linkedin-banner-dark.png' },
    { label: 'PROFILE PICTURE, LIGHT', kind: 'PNG · 1200×1200', href: '/brand/linkedin-profile-side-light.png' },
    { label: 'PROFILE PICTURE, DARK', kind: 'PNG · 1200×1200', href: '/brand/linkedin-profile-side-dark.png' },
  ],
};
