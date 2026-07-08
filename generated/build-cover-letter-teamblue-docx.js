// Build JP Bothma's motivational letter for team.blue — Head of SaaS AI
// Output: JP_Bothma_Cover_Letter_TeamBlue.docx

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  TabStopType, TabStopPosition, BorderStyle, ExternalHyperlink,
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
    children: [new TextRun({ text, color: INK, size: 22, font: 'Calibri', ...opts })],
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

const today = 'July 2026';

// ─── Letterhead ─────────────────────────────────────────────────────────────
const letterhead = [
  new Paragraph({
    spacing: { before: 0, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
    children: [smallCaps('Motivation Letter')],
  }),
  new Paragraph({
    spacing: { before: 240, after: 40 },
    children: [new TextRun({ text: 'JP Bothma', bold: true, color: INK, size: 44, font: 'Georgia' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({
      text: 'Tech Lead & Creative Technologist  ·  AI Product  ·  AI Agents & Orchestration',
      color: ACCENT, size: 18, font: 'Calibri', bold: true,
    })],
  }),
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
    children: [new TextRun({ text: 'Hiring Team', bold: true, color: INK, size: 22, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'team.blue', color: INK, size: 22, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'Europe', color: MUTED, size: 20, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 80, after: 240 },
    children: [new TextRun({ text: 'Re: Head of SaaS AI', italics: true, color: MUTED, size: 20, font: 'Calibri' })],
  }),
];

// ─── Letter body ────────────────────────────────────────────────────────────
const letter = [
  body('Hi team.blue,'),

  body('A role that’s equal parts AI, product strategy, and enabling brilliant people across many brands? That’s a fun kind of hard — and exactly the kind I enjoy.'),

  body('I currently own sustainability technology at Interfood, where I ship AI products end-to-end: building AI agents and orchestrated workflows that automate real operations and put genuine value in the hands of real users. Before that, a decade as a tech lead and CTO across SaaS, FinTech, and EduTech ventures. So I’ve lived both sides of this role — close enough to the models to judge what’s actually feasible and defensible, and senior enough to translate that into roadmaps, business cases, and honest conversations with executives.'),

  body('What draws me to Head of SaaS AI is the shape of it: the liaison in the middle, zooming from solution architecture to strategy and back, aligning autonomous brands without flattening what makes each one good. I like matrixed, multi-brand environments — respecting local autonomy while pulling in one direction is a craft, not a compromise.'),

  body('Your ESG commitment is a quiet bonus. I’ve spent the last few years building technology in service of sustainability, and I’d be glad to keep doing work that matters.'),

  body('Happy to talk whenever it suits.'),

  spacer(240),

  body('Warm regards,'),

  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'JP Bothma', bold: true, color: INK, size: 24, font: 'Georgia' })],
  }),
];

// ─── Assemble ───────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'JP Bothma',
  title: 'JP Bothma — Motivation Letter — team.blue',
  description: 'Motivation letter for Head of SaaS AI at team.blue',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: INK } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children: [...letterhead, ...recipient, ...letter],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'JP_Bothma_Cover_Letter_TeamBlue.docx');
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, '(' + buf.length + ' bytes)');
});
