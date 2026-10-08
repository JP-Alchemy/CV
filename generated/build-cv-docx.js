// Build JP Bothma's CV as a recruiter-optimised .docx (A4, ~2 pages).
// Output: JP_Bothma_CV.docx

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, LevelFormat, ExternalHyperlink,
  TabStopType, TabStopPosition, HeadingLevel, BorderStyle,
  PageNumber, Footer,
} = require(path.join(process.env.HOME, '.nvm/versions/node/v22.19.0/lib/node_modules/docx'));

// ─── Palette (mirrors the web CV) ───────────────────────────────────────────
const ACCENT = '4ECDC4';
const INK = '1A1A2E';
const MUTED = '6A6A85';
const SOFT = '4A4A6A';
const SUBTLE = 'E5E5EC';

// ─── Helpers ────────────────────────────────────────────────────────────────
function smallCaps(text, color = ACCENT) {
  return new TextRun({
    text: text.toUpperCase(),
    bold: true, color, size: 15, characterSpacing: 40, font: 'Calibri',
  });
}

function sectionHeader(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 3 } },
    children: [new TextRun({ text: title, bold: true, color: INK, size: 26, font: 'Georgia' })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 20, after: 20 },
    children: [new TextRun({ text, color: INK, size: 20, font: 'Calibri' })],
  });
}

// Role header: bold TITLE — company, dates right-aligned; location/industry line under it
function roleHeader(role, company, period, meta) {
  return [
    new Paragraph({
      spacing: { before: 200, after: 20 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: role, bold: true, color: INK, size: 22, font: 'Calibri' }),
        new TextRun({ text: `  —  ${company}`, color: SOFT, size: 22, font: 'Calibri' }),
        new TextRun({ text: '\t', font: 'Calibri' }),
        new TextRun({ text: period, bold: true, color: MUTED, size: 19, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: meta, color: MUTED, size: 17, font: 'Calibri', italics: true })],
    }),
  ];
}

function stackLine(text) {
  return new Paragraph({
    spacing: { before: 40, after: 60 },
    children: [
      new TextRun({ text: 'Stack:  ', bold: true, color: ACCENT, size: 17, font: 'Calibri' }),
      new TextRun({ text, color: MUTED, size: 17, font: 'Calibri' }),
    ],
  });
}

// ─── Header block ───────────────────────────────────────────────────────────
const header = [
  new Paragraph({
    spacing: { before: 0, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
    children: [smallCaps('Curriculum Vitae')],
  }),
  new Paragraph({
    spacing: { before: 200, after: 40 },
    children: [new TextRun({ text: 'JP Bothma', bold: true, color: INK, size: 60, font: 'Georgia' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({
      text: 'Tech Lead & Creative Technologist  —  AI Agents · Full-Stack · Interactive 3D · Sustainability',
      color: ACCENT, size: 21, font: 'Calibri', bold: true,
    })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: 'Leiden, Netherlands  ·  juan.bothma@gmail.com  ·  ', color: MUTED, size: 19, font: 'Calibri' }),
      new ExternalHyperlink({
        link: 'https://jpbothma.com',
        children: [new TextRun({ text: 'jpbothma.com', color: ACCENT, size: 19, font: 'Calibri', underline: {} })],
      }),
      new TextRun({ text: '\t', font: 'Calibri' }),
      new ExternalHyperlink({
        link: 'https://www.linkedin.com/in/jp-bothma',
        children: [new TextRun({ text: 'linkedin.com/in/jp-bothma', color: ACCENT, size: 19, font: 'Calibri', underline: {} })],
      }),
    ],
  }),
];

// ─── Profile + keywords ─────────────────────────────────────────────────────
const profile = [
  new Paragraph({
    spacing: { before: 160, after: 80 },
    indent: { left: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 10 } },
    children: [
      new TextRun({
        text: 'Hands-on tech lead with 10+ years shipping products across sustainability, AI, FinTech, XR, and IoT. Currently heading sustainability technology at Interfood — where I shipped ',
        color: INK, size: 21, font: 'Calibri',
      }),
      new TextRun({ text: 'Interfarm', bold: true, color: ACCENT, size: 21, font: 'Calibri' }),
      new TextRun({
        text: ', a live CO₂-reduction platform for the global dairy chain — while building AI agents that automate entire workflows end-to-end. I own products from first sketch to production: architecture, code, teams, and delivery.',
        color: INK, size: 21, font: 'Calibri',
      }),
    ],
  }),
  new Paragraph({
    spacing: { before: 80, after: 40 },
    children: [
      new TextRun({ text: 'Core stack:  ', bold: true, color: INK, size: 19, font: 'Calibri' }),
      new TextRun({
        text: 'TypeScript · React · Node.js · Python · C# · Azure · Databricks · Three.js / React-Three-Fiber · LLM Orchestration · CI/CD',
        color: SOFT, size: 19, font: 'Calibri',
      }),
    ],
  }),
  new Paragraph({
    spacing: { before: 40, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: SUBTLE, space: 6 } },
    children: [
      new TextRun({ text: '10+ ', bold: true, color: ACCENT, size: 20, font: 'Calibri' }),
      new TextRun({ text: 'years shipping software     ', color: MUTED, size: 18, font: 'Calibri' }),
      new TextRun({ text: '4× ', bold: true, color: ACCENT, size: 20, font: 'Calibri' }),
      new TextRun({ text: 'CTO & Tech Lead roles     ', color: MUTED, size: 18, font: 'Calibri' }),
      new TextRun({ text: '5 ', bold: true, color: ACCENT, size: 20, font: 'Calibri' }),
      new TextRun({ text: 'continents     ', color: MUTED, size: 18, font: 'Calibri' }),
      new TextRun({ text: 'Cum Laude ', bold: true, color: ACCENT, size: 20, font: 'Calibri' }),
      new TextRun({ text: 'BSc Computer Science', color: MUTED, size: 18, font: 'Calibri' }),
    ],
  }),
];

// ─── Experience ─────────────────────────────────────────────────────────────
const experience = [
  sectionHeader('Experience'),

  ...roleHeader('Tech Lead of Sustainability', 'Interfood Group', 'Mar 2024 – Present', 'Eindhoven, NL · Global dairy trading group · SustainTech'),
  bullet('Shipped Interfarm — a live platform where customers and dairy suppliers plan, fund, and track on-farm CO₂-reduction interventions together'),
  bullet('Building AI agents and orchestrated workflows that automate sustainability operations end-to-end, from data intake to customer reporting'),
  bullet('Set technical direction across R&D, Trade, and Logistics; own architecture and delivery across multiple external engineering teams'),
  bullet('Translate regulatory and customer sustainability requirements into shipped, scalable product'),
  stackLine('Azure · Databricks · Data platforms · AI agents & LLM orchestration · TypeScript'),

  ...roleHeader('Senior Developer & Lead Innovation Specialist', 'PWXR', 'Jan 2023 – Mar 2024', 'Rotterdam & The Hague, NL · XR / Gaming'),
  bullet('Built an in-browser full-body-tracking game with React-Three-Fiber and TensorFlow.js — no installs, no wearables, just a webcam'),
  bullet('Shipped native titles in Unity3D (C#) and Unreal Engine (C++) for Windows and mobile VR'),
  bullet('Introduced custom CI/CD pipelines for reliable, automated cross-platform releases'),
  stackLine('React-Three-Fiber · TensorFlow.js · Unity3D · Unreal Engine · C# · C++'),

  ...roleHeader('Tech Lead — Payment Platform', 'Talk360', 'Oct 2022 – Jan 2023', 'Amsterdam, NL · FinTech'),
  bullet('Led a globally distributed team delivering the Talk360 payment platform for emerging markets'),
  bullet('Designed the Node.js (MarbleJS) API-aggregation layer unifying multiple payment providers; built the Vue.js frontend'),
  stackLine('Node.js · MarbleJS · Vue.js · Payment systems'),

  ...roleHeader('CTO & Co-Founder', 'LIT Trading, WWA Trading & Vaultron.io', 'Feb 2021 – Oct 2022', 'Dubai, UAE · FinTech / Trading / EduTech'),
  bullet('Co-founded and ran the technology side of a trading venture: education products, gamification, and an automated algorithmic hedge fund'),
  bullet('Built quantitative trading systems in PineScript, MQL4/5, C++ and Python, integrating live data from multiple brokers'),
  bullet('Founded Vaultron.io — a white-labelled e-learning platform with studio-grade media encryption and a proprietary anti-piracy layer'),
  stackLine('Python · C++ · PineScript · MQL4/5 · DRM / media encryption · Platform architecture'),

  ...roleHeader('Lead Developer & Co-Founder', 'Deuterium Studios', 'Oct 2019 – Apr 2021', 'Remote · Game Development'),
  bullet('Built voxel technology and procedural world generation for an infinitely scalable ARPG MMO; designed the backend server architecture'),
  bullet('Mentored the engineering team from prototype through playable builds'),
  stackLine('Unity3D · C# · Procedural generation · VFX Graphs · Network architecture'),

  ...roleHeader('Executive Advisor · Solutions Architect', 'Portfolio of startups', 'Mar 2018 – Feb 2021', 'Various · Banking, IoT, health, retail'),
  bullet('Architected technology and business processes for banking, hedge-fund, and financial operations'),
  bullet('Productionised IoT systems and built 3D data visualisation for industrial clients'),
  stackLine('Solutions architecture · IoT · 3D visualisation · Cybersecurity · DevOps'),

  ...roleHeader('Full Stack Engineer & Innovation Specialist', 'IoT.nxt', 'Sep 2016 – Mar 2018', 'Pretoria, South Africa · IoT'),
  bullet("Built Commander Web — the company's primary IoT data-visualisation product — in Angular, C# and .NET Core"),
  bullet('Led the innovation division: AR/VR prototypes on HoloLens and HTC Vive, LiDAR scanning, and robotics'),
  stackLine('Angular · C# · .NET Core · AR/VR · LiDAR · Robotics'),
];

// ─── Selected projects (all live) ───────────────────────────────────────────
function project(name, desc, url) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: name, bold: true, color: INK, size: 20, font: 'Calibri' }),
      new TextRun({ text: `  —  ${desc}`, color: SOFT, size: 20, font: 'Calibri' }),
      ...(url ? [
        new TextRun({ text: '\t', font: 'Calibri' }),
        new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: url.replace('https://', ''), color: ACCENT, size: 18, font: 'Calibri', underline: {} })],
        }),
      ] : []),
    ],
  });
}

const projects = [
  sectionHeader('Selected Projects — all live'),
  project('Interfarm', 'sustainability platform for on-farm CO₂-reduction, used by Interfood customers and dairy suppliers', null),
  project('nezen.io', 'daily zen koans by email & WhatsApp — SvelteKit, PostgreSQL, WebGL ink canvas', 'https://nezen.io'),
  project('What The Duck', 'physics-driven 3D browser game — React-Three-Fiber, cannon physics, zustand', 'https://wtd.jpbothma.com'),
  project('Cyberspace Central', 'scroll-driven 3D web experience for a Three.js challenge — R3F, react-spring', 'https://contendo.jpbothma.com'),
];

// ─── Skills (inline, ATS-friendly) ──────────────────────────────────────────
function skillLine(category, list) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: `${category}:  `, bold: true, color: INK, size: 19, font: 'Calibri' }),
      new TextRun({ text: list, color: SOFT, size: 19, font: 'Calibri' }),
    ],
  });
}

const skills = [
  sectionHeader('Skills'),
  skillLine('AI & Automation', 'AI agents · LLM orchestration · workflow automation · custom models · AI integration'),
  skillLine('Languages & Frameworks', 'TypeScript · React · Angular · Vue.js · Node.js · Python · C# · C++ · .NET Core · SvelteKit'),
  skillLine('Data & Cloud', 'Azure · Databricks · Airflow · dbt · data pipelines · timeseries analytics'),
  skillLine('Interactive & XR', 'WebGL · Three.js · React-Three-Fiber · Unity3D · Unreal Engine · TensorFlow.js · AR/VR · LiDAR'),
  skillLine('Architecture & DevOps', 'solutions architecture · microservices · API design · CI/CD · system design · cloud deployment'),
  skillLine('Leadership', 'tech lead · CTO · remote team management · product strategy · mentorship · startup advisory'),
  skillLine('Domains', 'sustainability & ESG · FinTech & trading · cybersecurity · IoT & embedded · EduTech / DRM'),
];

// ─── Education + availability ───────────────────────────────────────────────
const education = [
  sectionHeader('Education'),
  new Paragraph({
    spacing: { before: 40, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: 'BSc Computer Science', bold: true, color: INK, size: 20, font: 'Calibri' }),
      new TextRun({ text: '  —  Pearson Institute, South Africa  ·  ', color: SOFT, size: 20, font: 'Calibri' }),
      new TextRun({ text: 'Cum Laude', bold: true, color: ACCENT, size: 20, font: 'Calibri' }),
      new TextRun({ text: '\t', font: 'Calibri' }),
      new TextRun({ text: '2014 – 2016', bold: true, color: MUTED, size: 19, font: 'Calibri' }),
    ],
  }),
];

const availability = [
  new Paragraph({
    spacing: { before: 240, after: 0 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 8 },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 8 },
      left: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 8 },
      right: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 8 },
    },
    shading: { fill: 'F4FCFB', type: 'clear', color: 'auto' },
    indent: { left: 120, right: 120 },
    children: [
      new TextRun({ text: 'Currently available  —  ', bold: true, color: INK, size: 20, font: 'Calibri' }),
      new TextRun({
        text: 'open to senior & principal engineering, tech-lead, and fractional CTO roles (AI, full-stack, interactive, sustainability). On-site NL, hybrid, or remote.',
        color: MUTED, size: 19, font: 'Calibri',
      }),
    ],
  }),
];

// ─── Assemble ───────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'JP Bothma',
  title: 'JP Bothma — CV',
  description: 'Tech Lead & Creative Technologist — AI Agents · Full-Stack · Interactive 3D · Sustainability',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21, color: INK } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: INK, font: 'Georgia' },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 },
      },
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 300, hanging: 200 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 900, right: 1000, bottom: 900, left: 1000 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: 'JP Bothma  ·  juan.bothma@gmail.com  ·  jpbothma.com', color: MUTED, size: 15, font: 'Calibri' }),
            new TextRun({ text: '\t', font: 'Calibri' }),
            new TextRun({ text: 'Page ', color: MUTED, size: 15, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 15, font: 'Calibri' }),
            new TextRun({ text: ' / ', color: MUTED, size: 15, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 15, font: 'Calibri' }),
          ],
        })],
      }),
    },
    children: [
      ...header,
      ...profile,
      ...experience,
      ...projects,
      ...skills,
      ...education,
      ...availability,
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'JP Bothma CV.docx');
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, '(' + buf.length + ' bytes)');
});
