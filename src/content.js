// All site copy lives here. Display copy is upper-case because it is set in
// the pixel font; `seo` strings are what search engines and link previews see.
//
// Images: each project has `image: { kind }` (a procedural render: moon,
// terrain, waves, duck, cyber, switchbacks, pose, cubes, rings, bars, globe,
// portrait, orb). To use a real image, drop it in /public/images and use
// `image: { src: '/images/name.jpg' }`.

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
    url: 'https://jpbothma.com/projects/moto-tour/',
    image: { kind: 'switchbacks' },
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
