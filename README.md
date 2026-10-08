# Personal Site

Production-ready personal website for independent consulting & product work.
Built with **Next.js 14 (App Router)**, **TypeScript**, and **Tailwind CSS**.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.local.example .env.local

# 3. Fill in your Formspree endpoint (see below)
# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Personalisation checklist

Search for `── Personalise ──` comments across the codebase — every placeholder is marked there.

### 1. Identity (do first)

| File | Variable | Replace with |
|------|----------|-------------|
| `app/layout.tsx` | `SITE_NAME` | Your full name |
| `app/layout.tsx` | `SITE_TAGLINE` | Your headline tagline |
| `app/layout.tsx` | `SITE_DESCRIPTION` | 1–2 sentence SEO description |
| `app/layout.tsx` | `SITE_URL` | Your live domain e.g. `https://janedoe.com` |
| `components/Nav.tsx` | `SITE_INITIALS` | Your initials (e.g. `JD`) |
| `components/Nav.tsx` | `SITE_NAME` | Your full name |
| `components/Hero.tsx` | `NAME` | Your full name |
| `components/Footer.tsx` | `NAME` | Your full name |
| `components/Footer.tsx` | `KVK_NUMBER` | Your Dutch KVK number |

### 2. Contact & social

| File | Variable | Replace with |
|------|----------|-------------|
| `components/Contact.tsx` | `CONTACT_EMAIL` | Your email address |
| `components/Contact.tsx` | `LINKEDIN_URL` | Your LinkedIn profile URL |
| `components/Footer.tsx` | `LINKEDIN_URL` | Same LinkedIn URL |
| `components/Footer.tsx` | `GITHUB_URL` | Your GitHub profile URL |

### 3. Formspree (contact form)

1. Sign up at [formspree.io](https://formspree.io)
2. Create a new form — copy the form ID (looks like `xpwzabcd`)
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_FORMSPREE_ENDPOINT=xpwzabcd
   ```

### 4. Copy & rates

Review all copy in each component and adjust rates, descriptions, and tone as needed:
- `components/Services.tsx` — service names, descriptions, rates
- `components/Building.tsx` — product descriptions and status
- `components/About.tsx` — bio text
- `components/Hero.tsx` — tagline and sub-tagline

### 5. OG image

Add a `public/og-image.png` (1200×630px) for social sharing previews.
A simple dark-background image with your name and tagline works perfectly.

---

## Project structure

```
my-site/
├── app/
│   ├── layout.tsx          # Root layout, fonts, metadata
│   ├── page.tsx            # Page — wires all sections
│   └── globals.css         # Tailwind base + custom utilities
├── components/
│   ├── Nav.tsx             # Sticky nav with scroll-aware opacity
│   ├── Hero.tsx            # Full-viewport hero section
│   ├── HeroCanvas.tsx      # Canvas energy-grid animation
│   ├── About.tsx           # Bio + skill intersection diagram
│   ├── Services.tsx        # 4 service cards with hover CTAs
│   ├── Building.tsx        # Product tiles (OT Platform + DPP)
│   ├── Credibility.tsx     # Trust signals + How I work
│   ├── Contact.tsx         # Formspree contact form
│   └── Footer.tsx          # Minimal footer
├── hooks/
│   └── useInView.ts        # Intersection Observer hook
├── public/
│   └── og-image.png        # ← add this (1200×630)
├── .env.local.example      # Environment template
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## Deployment (Vercel)

```bash
# Push to GitHub, then connect repo at vercel.com
# Add environment variable in Vercel dashboard:
#   NEXT_PUBLIC_FORMSPREE_ENDPOINT = your_formspree_id
```

No other configuration needed — deploys to Vercel with zero changes beyond the placeholders listed above.

---

## Tech stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS — no component library, fully custom
- **Icons**: Lucide React
- **Fonts**: DM Serif Display (headings) + DM Sans (body) via `next/font/google`
- **Form**: Formspree (no server code needed)
- **Animations**: CSS transitions + Intersection Observer (`useInView` hook) + Canvas API (hero)
- **Hosting**: Vercel (recommended)

---

## Design tokens

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0f` | Base dark |
| Surface | `#111118` | Cards, nav |
| Accent | `#4ecdc4` | Teal — used sparingly |
| Text primary | `#f0f0f5` | Headings, key text |
| Text secondary | `#8888a0` | Body, descriptions |
| Text muted | `#55556a` | Labels, meta |
| Heading font | DM Serif Display | Display, italic for emphasis |
| Body font | DM Sans | All UI text |
