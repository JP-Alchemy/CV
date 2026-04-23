// Build JP Bothma's CV as a .docx in a style inspired by the /cv web page.
// Output: JP_Bothma_CV.docx

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
  TabStopType, TabStopPosition, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber,
} = require(path.join(process.env.HOME, '.nvm/versions/node/v22.19.0/lib/node_modules/docx'));

// ─── Palette (mirrors the web CV) ───────────────────────────────────────────
const ACCENT = '4ECDC4';       // teal
const INK = '1A1A2E';          // near-black
const MUTED = '6A6A85';        // muted grey
const SUBTLE = 'E5E5EC';       // subtle border
const BG_SOFT = 'F7F8F9';      // surface

// ─── Helpers ────────────────────────────────────────────────────────────────
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: SUBTLE };
const accentBar = { style: BorderStyle.SINGLE, size: 16, color: ACCENT };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function hr(color = SUBTLE, size = 4) {
  return new Paragraph({
    spacing: { before: 0, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } },
    children: [new TextRun({ text: '' })],
  });
}

function sectionHeader(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
    children: [new TextRun({ text: title, bold: true, color: INK, size: 28, font: 'Georgia' })],
  });
}

function smallCaps(text, color = ACCENT) {
  return new TextRun({
    text: text.toUpperCase(),
    bold: true,
    color,
    size: 16,
    characterSpacing: 40,
    font: 'Calibri',
  });
}

function bullet(text, color = INK) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, color, size: 20, font: 'Calibri' })],
  });
}

function pill(text, color) {
  // Word can't render CSS pills; emulate with a narrow table cell.
  return new TableCell({
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color },
      bottom: { style: BorderStyle.SINGLE, size: 4, color },
      left: { style: BorderStyle.SINGLE, size: 4, color },
      right: { style: BorderStyle.SINGLE, size: 4, color },
    },
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, color, size: 16, font: 'Calibri', bold: true })],
    })],
  });
}

// ─── Data (mirrors app/cv/page.tsx) ─────────────────────────────────────────
const STATS = [
  { value: '10+', label: 'Years experience' },
  { value: '3+', label: 'Companies & ventures' },
  { value: '5', label: 'Continents' },
  { value: 'Cum Laude', label: 'BSc Computer Science & Psychology' },
];

const EXPERIENCE = [
  {
    company: 'Interfood Group',
    role: 'Tech Lead of Sustainability',
    scope: 'Global',
    period: 'Mar 2024 – Present',
    location: 'Eindhoven, Netherlands',
    industry: 'SustainTech',
    color: '4ECDC4',
    summary: 'Driving integration of sustainable practices into the global dairy industry through innovative digital solutions — bridging sustainability and technology at scale.',
    highlights: [
      'Lead cross-functional efforts across R&D, Trade and Logistics to solve complex sustainability challenges',
      'Manage multiple outsourced software development teams, consistently delivering cutting-edge solutions',
      'Develop scalable, technology-driven solutions addressing sustainability in global food systems',
      'Design customer-centric products that drive measurable business value and enhance satisfaction',
      'Cultivate a culture of collaboration, creativity and continuous improvement across all departments',
    ],
    tech: ['Digital Sustainability', 'Team Leadership', 'Product Development', 'Cross-functional Delivery', 'Global Ops'],
  },
  {
    company: 'PWXR',
    role: 'Senior Developer & Lead Innovation Specialist',
    scope: null,
    period: 'Jan 2023 – Mar 2024',
    location: 'Rotterdam & The Hague',
    industry: 'XR / Gaming',
    color: 'A78BFA',
    summary: 'Built next-generation full-body gaming technology — pushing the boundaries of immersive, real-time interactive experiences on web and native platforms.',
    highlights: [
      'Created full-body tracking mini-game using React-Three-Fiber and TensorFlow.js running entirely in-browser',
      'Built Event Management Systems and Content Management Systems as part of the product suite',
      'Native app development with Unity3D (C#) and Unreal Engine (C++) for Windows and VR mobile platforms',
      'Implemented custom CI/CD pipelines for automated, reliable cross-platform deployments',
    ],
    tech: ['React-Three-Fiber', 'TensorFlow.js', 'Unity3D', 'Unreal Engine', 'C#', 'C++', 'CI/CD', 'VR'],
  },
  {
    company: 'Talk360',
    role: 'Tech Lead — FinTech Payment Platform',
    scope: null,
    period: 'Oct 2022 – Jan 2023',
    location: 'Amsterdam',
    industry: 'FinTech',
    color: 'FBBF24',
    summary: 'Led an internationally distributed remote team building a pioneering payment platform designed to expand access to global communication.',
    highlights: [
      'Strategically led a globally distributed remote tech team delivering the Talk360 Payment Platform',
      'Designed backend API aggregation using Node.js (MarbleJS) for robust, scalable provider integrations',
      'Built the frontend with Vue.js, crafting intuitive and accessible payment interfaces',
    ],
    tech: ['Node.js', 'MarbleJS', 'Vue.js', 'Remote Leadership', 'Payment Systems', 'FinTech'],
  },
  {
    company: 'LIT Trading & WWA Trading',
    role: 'CTO',
    scope: 'FinTech Venture — Dubai',
    period: 'Mar 2021 – Oct 2022',
    location: 'Dubai, UAE',
    industry: 'FinTech / Trading',
    color: 'FBBF24',
    summary: 'Co-founded and led a FinTech venture building trading education, gamification experiences, and an automated algorithmic hedge fund.',
    highlights: [
      'Developed Trading Education and Gamification platform empowering students in financial markets',
      'Built an Automated Trading Hedge Fund with quantitative and algorithmic trading systems',
      'Launched Vaultron.io white-labeled online education platform for scalable client deployment',
      'Mastered full trading technology stacks: PineScript, MQL4/5, C++ and Python',
      'Integrated intercommunication across diverse data layers from multiple brokers and providers',
    ],
    tech: ['PineScript', 'MQL4/5', 'C++', 'Python', 'Algorithmic Trading', 'Quantitative Finance', 'Platform Architecture'],
  },
  {
    company: 'Vaultron.io',
    role: 'CTO & Founder',
    scope: 'EduTech / Encryption',
    period: 'Feb 2021 – Oct 2022',
    location: 'Dubai, UAE',
    industry: 'EduTech',
    color: '60A5FA',
    summary: 'Created a revolutionary e-learning platform combining AAA Hollywood-grade media encryption with a proprietary anti-piracy layer — a first in EduTech.',
    highlights: [
      'Built e-learning platform with Hollywood-grade media encryption plus a proprietary encryption layer',
      'Developed industry-leading anti-piracy system redefining security standards in online education',
      'Designed scalable platform architecture serving educational organisations worldwide',
      'Led hands-on technical team with a solution-driven, innovation-first culture',
    ],
    tech: ['Media Encryption', 'DRM', 'Anti-piracy', 'Platform Architecture', 'EduTech', 'SaaS'],
  },
  {
    company: 'Deuterium Studios',
    role: 'Lead Developer & Co-Founder',
    scope: null,
    period: 'Oct 2019 – Apr 2021',
    location: 'Remote',
    industry: 'Game Development',
    color: 'A78BFA',
    summary: 'Co-founded a game studio building an infinite multi-scaled ARPG MMO with custom voxel technology and advanced procedural world generation.',
    highlights: [
      'Built city-building and voxel technology delivering dynamic, infinitely scalable in-game environments',
      'Implemented infinite world generation using procedural algorithms, blend maps and custom shader editors',
      'Created special effects with VFX Graphs; designed scalable backend server architecture',
      'Mentored and developed team members, fostering a culture of ambition and technical excellence',
    ],
    tech: ['Unity3D', 'C#', 'VFX Graphs', 'Procedural Generation', 'Network Architecture', 'ARPG / MMO'],
  },
  {
    company: 'Multiple Businesses',
    role: 'Executive Advisor · Solutions Architect · Developer',
    scope: null,
    period: 'Mar 2018 – Feb 2021',
    location: 'Various',
    industry: 'Consulting',
    color: '94A3B8',
    summary: 'Strategic advisor and hands-on developer across a diverse portfolio of startups — banking, food services, IoT, health, and online retail.',
    highlights: [
      'Technology and business process architecture for banking, hedge funds and financial operations',
      'IoT productionisation and 3D data visualisation for complex industrial use cases',
      'Product development and production deployment with cybersecurity embedded at the core',
      'Online retail automation, bot development and algorithmic competitive tooling',
    ],
    tech: ['Solutions Architecture', 'IoT', '3D Visualisation', 'Cybersecurity', 'Automation', 'FinTech', 'DevOps'],
  },
  {
    company: 'IoT.nxt',
    role: 'Full Stack Engineer & Innovation Specialist',
    scope: null,
    period: 'Sep 2016 – Mar 2018',
    location: 'Pretoria, South Africa',
    industry: 'IoT',
    color: 'FB923C',
    summary: "Built the company's core IoT data visualisation platform and led a skunkworks innovation division pioneering AR/VR and robotics applications.",
    highlights: [
      "Developed Commander Web — IoT.nxt's primary data visualisation interface — using Angular, C# and .Net Core",
      'Led innovation division creating AR/VR prototypes with Hololens, HTC Vive, Unity3D, Unreal Engine and LiDAR',
      "Built immersive 3D representations of live IoT data for Commander's next-generation interface",
      'Prototyped IoT-enabled robotic arms with self-taught inverse kinematics and facial recognition',
    ],
    tech: ['Angular', 'C#', '.Net Core', 'Ubuntu Snaps', 'AR/VR', 'Hololens', 'Unity3D', 'Robotics', 'LiDAR'],
  },
];

const SKILL_GROUPS = [
  { category: 'Software Engineering', color: '4ECDC4', skills: ['Full-Stack Development', 'Angular', 'React', 'Vue.js', 'Node.js', 'C#', 'C++', 'Python', '.Net Core'] },
  { category: 'Architecture & DevOps', color: '60A5FA', skills: ['Solutions Architecture', 'CI/CD Pipelines', 'Microservices', 'API Design', 'System Design', 'Cloud Deployment'] },
  { category: 'Emerging & XR Tech', color: 'A78BFA', skills: ['Unity3D', 'Unreal Engine', 'AR / VR', 'TensorFlow.js', 'IoT', 'Robotics', 'LiDAR', 'VFX Graphs'] },
  { category: 'FinTech & Trading', color: 'FBBF24', skills: ['Algorithmic Trading', 'PineScript', 'MQL4/5', 'Quantitative Finance', 'Payment Platforms', 'DRM / Encryption'] },
  { category: 'Security & AI', color: 'FB923C', skills: ['Cybersecurity', 'OT / ICS Security', 'Media Encryption', 'Anti-piracy', 'AI Integration', 'Penetration Testing'] },
  { category: 'Leadership', color: '94A3B8', skills: ['CTO', 'Tech Lead', 'Remote Team Management', 'Product Strategy', 'Mentorship', 'Startup Advisory'] },
];

// ─── Build blocks ───────────────────────────────────────────────────────────

// Hero: eyebrow, name, tagline, location + LinkedIn, quote
const hero = [
  new Paragraph({
    spacing: { before: 0, after: 120 },
    children: [smallCaps('Curriculum Vitae')],
  }),
  hr(ACCENT, 6),
  new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: 'JP Bothma', bold: true, color: INK, size: 72, font: 'Georgia' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 120 },
    children: [new TextRun({
      text: 'Tech Lead  ·  OT/ICS Security  ·  GreenTech  ·  Full-Stack',
      color: ACCENT, size: 24, font: 'Calibri', bold: true,
    })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 60 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: 'Leiden, Netherlands  ·  Open to EU & global engagements', color: MUTED, size: 20, font: 'Calibri' }),
      new TextRun({ text: '\t', font: 'Calibri' }),
      new ExternalHyperlink({
        link: 'https://www.linkedin.com/in/jp-bothma',
        children: [new TextRun({ text: 'linkedin.com/in/jp-bothma', color: ACCENT, size: 20, font: 'Calibri', underline: {} })],
      }),
    ],
  }),
  hr(SUBTLE, 4),
  // Quote / summary
  new Paragraph({
    spacing: { before: 240, after: 240 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 12 } },
    children: [new TextRun({
      text: '\u201CCourageously pursuing intellectual and creative freedom in technology — committed to solving challenging, meaningful problems that shape the future in sustainable ways.\u201D',
      italics: true, color: INK, size: 24, font: 'Georgia',
    })],
  }),
];

// Stats row — 4-col table
const statsRow = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [2340, 2340, 2340, 2340],
  rows: [new TableRow({
    children: STATS.map(s => new TableCell({
      borders: {
        top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder,
      },
      width: { size: 2340, type: WidthType.DXA },
      shading: { fill: BG_SOFT, type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 140, bottom: 140, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: s.value, bold: true, color: ACCENT, size: 36, font: 'Georgia' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: s.label, color: MUTED, size: 16, font: 'Calibri' })],
        }),
      ],
    })),
  })],
});

// Experience entry — one per job
function experienceEntry(job) {
  const children = [];

  // Industry tag
  children.push(new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [smallCaps(job.industry, job.color)],
  }));

  // Company + period on one line with tab stop
  children.push(new Paragraph({
    spacing: { before: 0, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: job.company, bold: true, color: INK, size: 26, font: 'Georgia' }),
      new TextRun({ text: '\t', font: 'Calibri' }),
      new TextRun({ text: job.period, color: MUTED, size: 20, font: 'Calibri' }),
    ],
  }));

  // Role + location on one line
  children.push(new Paragraph({
    spacing: { before: 0, after: 120 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: job.role + (job.scope ? `  ·  ${job.scope}` : ''), color: ACCENT, size: 20, font: 'Calibri', bold: true }),
      new TextRun({ text: '\t', font: 'Calibri' }),
      new TextRun({ text: job.location, color: MUTED, size: 18, font: 'Calibri', italics: true }),
    ],
  }));

  // Summary (italic, left-bar accent)
  children.push(new Paragraph({
    spacing: { before: 0, after: 160 },
    indent: { left: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 10, color: job.color, space: 12 } },
    children: [new TextRun({ text: job.summary, italics: true, color: '4A4A6A', size: 20, font: 'Calibri' })],
  }));

  // Highlights bullets
  job.highlights.forEach(h => children.push(bullet(h)));

  // Tech pills as a small table row (wraps across columns)
  const perRow = 6;
  for (let i = 0; i < job.tech.length; i += perRow) {
    const slice = job.tech.slice(i, i + perRow);
    // pad to perRow so the table width stays consistent
    while (slice.length < perRow) slice.push(null);
    const cells = slice.map(t => t === null
      ? new TableCell({
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          width: { size: 1560, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: '', font: 'Calibri' })] })],
        })
      : pill(t, job.color));
    cells.forEach(c => { c.options = c.options || {}; });
    children.push(new Paragraph({ spacing: { before: 80, after: 0 }, children: [new TextRun('')] }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1560, 1560, 1560, 1560, 1560, 1560],
      rows: [new TableRow({ children: cells })],
    }));
  }

  return children;
}

// Education
const educationBlock = [
  new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [new TextRun({ text: 'Pearson Institute', bold: true, color: INK, size: 24, font: 'Georgia' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text: "Bachelor\u2019s Degree, Computer Science  ·  Cum Laude", color: ACCENT, size: 20, font: 'Calibri', bold: true })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: '2014 \u2013 2016  ·  South Africa', color: MUTED, size: 18, font: 'Calibri' })],
  }),
];

// Skills — one group per row with the category label + inline skill list
function skillsBlock() {
  const blocks = [];
  SKILL_GROUPS.forEach(g => {
    blocks.push(new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [smallCaps(g.category, g.color)],
    }));
    blocks.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: g.skills.join('   ·   '), color: INK, size: 20, font: 'Calibri' })],
    }));
  });
  return blocks;
}

// Availability callout
const availability = [
  new Paragraph({
    spacing: { before: 360, after: 60 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 },
      left: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 },
      right: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 },
    },
    shading: { fill: 'F4FCFB', type: ShadingType.CLEAR, color: 'auto' },
    indent: { left: 120, right: 120 },
    children: [new TextRun({ text: 'Currently available', bold: true, color: INK, size: 22, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 },
      left: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 },
      right: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 },
    },
    shading: { fill: 'F4FCFB', type: ShadingType.CLEAR, color: 'auto' },
    indent: { left: 120, right: 120 },
    children: [new TextRun({
      text: 'Open to consulting engagements, fractional CTO roles, and OT security projects across the EU and globally.',
      color: MUTED, size: 18, font: 'Calibri',
    })],
  }),
];

// ─── Assemble document ──────────────────────────────────────────────────────
const children = [
  ...hero,
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun('')] }),
  statsRow,

  sectionHeader('Professional Experience'),
  ...EXPERIENCE.flatMap(experienceEntry),

  sectionHeader('Education'),
  ...educationBlock,

  sectionHeader('Skills'),
  ...skillsBlock(),

  ...availability,
];

const doc = new Document({
  creator: 'JP Bothma',
  title: 'JP Bothma — CV',
  description: 'Tech Lead · OT/ICS Security · GreenTech · Full-Stack',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: INK } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, color: INK, font: 'Georgia' },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
      },
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '\u2022',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 240 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // US Letter
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }, // 0.75"
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: 'JP Bothma  ·  Leiden, Netherlands  ·  jpbothma.com', color: MUTED, size: 16, font: 'Calibri' }),
            new TextRun({ text: '\t', font: 'Calibri' }),
            new TextRun({ text: 'Page ', color: MUTED, size: 16, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16, font: 'Calibri' }),
            new TextRun({ text: ' / ', color: MUTED, size: 16, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 16, font: 'Calibri' }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'JP_Bothma_CV.docx');
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, '(' + buf.length + ' bytes)');
});
