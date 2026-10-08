// Build JP Bothma's motivational letter for Eneco — Principal Full-Stack Data Engineer
// Output: JP_Bothma_Cover_Letter_Eneco.docx

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, TabStopType, TabStopPosition,
  BorderStyle, ExternalHyperlink,
} = require(path.join(process.env.HOME, '.nvm/versions/node/v22.19.0/lib/node_modules/docx'));

// ─── Palette (mirrors the CV) ───────────────────────────────────────────────
const ACCENT = '4ECDC4';
const INK = '1A1A2E';
const MUTED = '6A6A85';
const SUBTLE = 'E5E5EC';

// ─── Helpers ────────────────────────────────────────────────────────────────
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 0, after: 200, line: 320 },
    children: [new TextRun({
      text,
      color: INK, size: 22, font: 'Calibri',
      ...opts,
    })],
  });
}

function bodyMixed(children, spaceAfter = 200) {
  return new Paragraph({
    spacing: { before: 0, after: spaceAfter, line: 320 },
    children,
  });
}

function spacer(after = 200) {
  return new Paragraph({ spacing: { before: 0, after }, children: [new TextRun({ text: '' })] });
}

function smallCaps(text, color = ACCENT) {
  return new TextRun({
    text: text.toUpperCase(),
    bold: true, color, size: 16, characterSpacing: 40, font: 'Calibri',
  });
}

const today = 'June 2026'; // pass via env if needed

// ─── Letterhead ─────────────────────────────────────────────────────────────
const letterhead = [
  // Eyebrow rule
  new Paragraph({
    spacing: { before: 0, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
    children: [smallCaps('Motivation Letter')],
  }),

  // Name
  new Paragraph({
    spacing: { before: 240, after: 40 },
    children: [new TextRun({ text: 'JP Bothma', bold: true, color: INK, size: 44, font: 'Georgia' })],
  }),

  // Tagline
  new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({
      text: 'Creative Technologist  ·  Interactive & 3D  ·  Data  ·  AI Orchestration  ·  Sustainability',
      color: ACCENT, size: 18, font: 'Calibri', bold: true,
    })],
  }),

  // Contact line + date (tab-aligned)
  new Paragraph({
    spacing: { before: 0, after: 60 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: 'Leiden, Netherlands  ·  ', color: MUTED, size: 18, font: 'Calibri' }),
      new ExternalHyperlink({
        link: 'https://www.linkedin.com/in/jp-bothma',
        children: [new TextRun({ text: 'linkedin.com/in/jp-bothma', color: ACCENT, size: 18, font: 'Calibri', underline: {} })],
      }),
      new TextRun({ text: '  ·  ', color: MUTED, size: 18, font: 'Calibri' }),
      new ExternalHyperlink({
        link: 'https://jpbothma.com',
        children: [new TextRun({ text: 'jpbothma.com', color: ACCENT, size: 18, font: 'Calibri', underline: {} })],
      }),
      new TextRun({ text: '\t', font: 'Calibri' }),
      new TextRun({ text: today, color: MUTED, size: 18, font: 'Calibri', italics: true }),
    ],
  }),

  // Subtle bottom rule
  new Paragraph({
    spacing: { before: 0, after: 320 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: SUBTLE, space: 1 } },
    children: [new TextRun({ text: '' })],
  }),
];

// ─── Recipient block ────────────────────────────────────────────────────────
const recipient = [
  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'Data & AI Team', bold: true, color: INK, size: 22, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'Eneco', color: INK, size: 22, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'Rotterdam, Netherlands', color: MUTED, size: 20, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 80, after: 240 },
    children: [new TextRun({ text: 'Re: Principal Full-Stack Data Engineer', italics: true, color: MUTED, size: 20, font: 'Calibri' })],
  }),
];

// ─── Letter body ────────────────────────────────────────────────────────────
const letter = [
  body('Hi Data & AI team,'),

  body('When a job posting puts “energy transition” and “Databricks, Delta Lake, Airflow” in the same paragraph, you have my attention.'),

  bodyMixed([
    new TextRun({ text: 'A bit on me: I lead the technology side of sustainability at Interfood, where I designed and shipped ', color: INK, size: 22, font: 'Calibri' }),
    new TextRun({ text: 'Interfarm', bold: true, color: INK, size: 22, font: 'Calibri' }),
    new TextRun({ text: ' — a live platform where global dairy buyers and their farmer suppliers plan, fund, and track on-farm CO₂-reduction interventions together. Mission-critical, governance-sensitive, and full of exactly the “modernise the legacy, keep the lights on, raise the bar” tension you describe. The stack (Databricks, Delta Lake, Airflow, dbt, Azure) is where I already live — both hands-on and as the person responsible for the data platforms downstream teams depend on. Lately I’ve been layering AI agents and orchestrated workflows on top: hyper-automating the repetitive so engineers stay on the parts that actually need a human.', color: INK, size: 22, font: 'Calibri' }),
  ]),

  body('One relevant aside: before sustainability, I CTO’d a small algorithmic-trading shop in Dubai for five years — commodity markets, hedging strategies, timeseries plumbing. Your “nice to have” line on energy markets and commodity trading conveniently maps to a previous chapter.'),

  bodyMixed([
    new TextRun({ text: 'Why Eneco specifically: I’m less interested in the newest technology and more interested in ', color: INK, size: 22, font: 'Calibri' }),
    new TextRun({ text: 'thoughtful', italics: true, color: INK, size: 22, font: 'Calibri' }),
    new TextRun({ text: ' technology applied to problems that matter. The energy transition is the problem of the decade, and the data layer underneath it is where it quietly lives or dies. Building that layer at Eneco — close to home in the Netherlands, on a team that takes reliability ', color: INK, size: 22, font: 'Calibri' }),
    new TextRun({ text: 'and', italics: true, color: INK, size: 22, font: 'Calibri' }),
    new TextRun({ text: ' craft seriously — sounds like exactly the kind of “design, build, review, decide, and guide” work I want to be doing for the next chunk of my career.', color: INK, size: 22, font: 'Calibri' }),
  ]),

  body('Happy to send the full CV, or come up to Rotterdam for a coffee whenever it suits.'),

  spacer(240),

  body('Best,'),

  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'JP Bothma', bold: true, color: INK, size: 24, font: 'Georgia' })],
  }),
];

// ─── Assemble ───────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'JP Bothma',
  title: 'JP Bothma — Motivation Letter — Eneco',
  description: 'Motivation letter for Principal Full-Stack Data Engineer at Eneco',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: INK } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // US Letter
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1"
      },
    },
    children: [...letterhead, ...recipient, ...letter],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'JP_Bothma-Letter.docx');
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, '(' + buf.length + ' bytes)');
});
