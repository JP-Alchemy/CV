// Build JP Bothma's motivational letter for Seequent — Team Lead, Software Engineering
// Output: JP_Bothma_Cover_Letter_Seequent.docx

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
      text: 'Tech Lead & Creative Technologist  ·  Full-Stack  ·  Interactive 3D & Data Visualisation',
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
    children: [new TextRun({ text: 'Seequent', color: INK, size: 22, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: 'Delft, Netherlands', color: MUTED, size: 20, font: 'Calibri' })],
  }),
  new Paragraph({
    spacing: { before: 80, after: 240 },
    children: [new TextRun({ text: 'Re: Team Lead, Software Engineering (req4325)', italics: true, color: MUTED, size: 20, font: 'Calibri' })],
  }),
];

// ─── Letter body ────────────────────────────────────────────────────────────
const letter = [
  body('Hi Seequent team,'),

  body('“Helping organisations understand the underground” might be the most on-brand line I’ve read in a while — I spend my days making complex, invisible systems legible, and you do it for the Earth itself.'),

  bodyMixed([
    new TextRun({ text: 'I’m a tech lead and full-stack engineer with 10+ years shipping products, including several stints leading small engineering teams. The stack lines up almost suspiciously well: TypeScript/Node.js and Python on the backend, React, Angular and Vue on the front, PostgreSQL, cloud, and CI/CD throughout. But the part that genuinely excites me is the 3D. I build real-time 3D and data visualisation for a living — WebGL, Three.js, React-Three-Fiber — turning dense data into something people can actually see and reason about. Seequent turns subsurface data into 3D geological models; that’s the same craft, pointed at a problem I’d love to work on.', color: INK, size: 22, font: 'Calibri' }),
  ]),

  body('On the leadership side, I currently own sustainability technology at Interfood — setting technical direction and delivery across multiple teams. I like the shape of this role: close enough to the code to hold a high bar in reviews, senior enough to grow the people around me.'),

  body('I’m based in Leiden, a short hop from Delft, and would happily come by for a coffee whenever it suits.'),

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
  title: 'JP Bothma — Motivation Letter — Seequent',
  description: 'Motivation letter for Team Lead, Software Engineering at Seequent',
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
  const out = path.join(__dirname, 'JP_Bothma_Cover_Letter_Seequent.docx');
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, '(' + buf.length + ' bytes)');
});
