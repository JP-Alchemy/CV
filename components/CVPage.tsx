'use client'

import Link from 'next/link'
import { useInView } from '@/hooks/useInView'
import Contact from '@/components/Contact'
import {
  ArrowLeft,
  Printer,
  Linkedin,
  MapPin,
  ExternalLink,
  GraduationCap,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface ExperienceItem {
  id: string
  company: string
  role: string
  scope: string | null
  period: string
  location: string
  industry: string
  color: string
  summary: string
  highlights: string[]
  tech: string[]
}

interface SkillGroup {
  category: string
  color: string
  skills: string[]
}

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '10+', label: 'Years shipping software' },
  { value: '4×', label: 'CTO & Tech Lead roles' },
  { value: '5', label: 'Continents worked across' },
  { value: 'Cum Laude', label: 'BSc Computer Science & Psychology' },
]

const EXPERIENCE: ExperienceItem[] = [
  {
    id: 'interfood',
    company: 'Interfood Group',
    role: 'Tech Lead of Sustainability',
    scope: 'Global',
    period: 'Mar 2024 – Present',
    location: 'Eindhoven, Netherlands',
    industry: 'SustainTech',
    color: '#4ecdc4',
    summary:
      'Own sustainability technology for a global dairy trading group — shipping the products and AI automation that turn climate targets into operational reality.',
    highlights: [
      'Shipped Interfarm — a live platform where customers and dairy suppliers plan, fund, and track on-farm CO₂-reduction interventions together',
      'Building AI agents and orchestrated workflows that automate sustainability operations end-to-end, from data intake to customer reporting',
      'Set technical direction across R&D, Trade, and Logistics; own architecture and delivery across multiple external engineering teams',
      'Translate regulatory and customer sustainability requirements into shipped, scalable product',
    ],
    tech: ['Interfarm', 'AI Agents', 'Workflow Automation', 'Azure', 'Data Platforms', 'Team Leadership', 'Product Ownership'],
  },
  {
    id: 'pwxr',
    company: 'PWXR',
    role: 'Senior Developer & Lead Innovation Specialist',
    scope: null,
    period: 'Jan 2023 – Mar 2024',
    location: 'Rotterdam & The Hague',
    industry: 'XR / Gaming',
    color: '#a78bfa',
    summary:
      'Built next-generation full-body gaming technology — pushing the boundaries of immersive, real-time interactive experiences on web and native platforms.',
    highlights: [
      'Built an in-browser full-body-tracking game with React-Three-Fiber and TensorFlow.js — no installs, no wearables, just a webcam',
      'Shipped native titles in Unity3D (C#) and Unreal Engine (C++) for Windows and mobile VR',
      'Delivered the event- and content-management systems powering the product suite',
      'Introduced custom CI/CD pipelines for reliable, automated cross-platform releases',
    ],
    tech: ['React-Three-Fiber', 'TensorFlow.js', 'Unity3D', 'Unreal Engine', 'C#', 'C++', 'CI/CD', 'VR'],
  },
  {
    id: 'talk360',
    company: 'Talk360',
    role: 'Tech Lead — FinTech Payment Platform',
    scope: null,
    period: 'Oct 2022 – Jan 2023',
    location: 'Amsterdam',
    industry: 'FinTech',
    color: '#fbbf24',
    summary:
      'Led an internationally distributed remote team building a pioneering payment platform designed to expand access to global communication.',
    highlights: [
      'Led a globally distributed team delivering the Talk360 payment platform for emerging markets',
      'Designed the backend API-aggregation layer in Node.js (MarbleJS), unifying multiple payment providers behind one interface',
      'Built the Vue.js frontend with a focus on accessible, low-friction payments',
    ],
    tech: ['Node.js', 'MarbleJS', 'Vue.js', 'Remote Leadership', 'Payment Systems', 'FinTech'],
  },
  {
    id: 'lit-wwa',
    company: 'LIT Trading & WWA Trading',
    role: 'CTO',
    scope: 'FinTech Venture — Dubai',
    period: 'Mar 2021 – Oct 2022',
    location: 'Dubai, UAE',
    industry: 'FinTech / Trading',
    color: '#fbbf24',
    summary:
      'Co-founded and led a FinTech venture building trading education, gamification experiences, and an automated algorithmic hedge fund.',
    highlights: [
      'Co-founded and ran the technology side of a trading venture: education products, gamification, and an automated algorithmic hedge fund',
      'Built quantitative trading systems in PineScript, MQL4/5, C++ and Python, integrating live data from multiple brokers and providers',
      'Launched Vaultron.io as a white-labelled education platform for scalable client deployments',
    ],
    tech: ['PineScript', 'MQL4/5', 'C++', 'Python', 'Algorithmic Trading', 'Quantitative Finance', 'Platform Architecture'],
  },
  {
    id: 'vaultron',
    company: 'Vaultron.io',
    role: 'CTO & Founder',
    scope: 'EduTech / Encryption',
    period: 'Feb 2021 – Oct 2022',
    location: 'Dubai, UAE',
    industry: 'EduTech',
    color: '#60a5fa',
    summary:
      'Created a revolutionary e-learning platform combining AAA Hollywood-grade media encryption with a proprietary anti-piracy layer — a first in EduTech.',
    highlights: [
      'Designed and shipped an e-learning platform with studio-grade media encryption plus a proprietary anti-piracy layer',
      'Architected multi-tenant infrastructure serving educational organisations internationally',
      'Led the hands-on engineering team from concept through production',
    ],
    tech: ['Media Encryption', 'DRM', 'Anti-piracy', 'Platform Architecture', 'EduTech', 'SaaS'],
  },
  {
    id: 'deuterium',
    company: 'Deuterium Studios',
    role: 'Lead Developer & Co-Founder',
    scope: null,
    period: 'Oct 2019 – Apr 2021',
    location: 'Remote',
    industry: 'Game Development',
    color: '#a78bfa',
    summary:
      'Co-founded a game studio building an infinite multi-scaled ARPG MMO with custom voxel technology and advanced procedural world generation.',
    highlights: [
      'Built voxel and city-building technology delivering infinitely scalable in-game worlds',
      'Implemented procedural world generation with blend maps and custom shader tooling',
      'Designed the backend server architecture; built VFX with Unity VFX Graphs',
      'Mentored the engineering team from prototype through playable builds',
    ],
    tech: ['Unity3D', 'C#', 'VFX Graphs', 'Procedural Generation', 'Network Architecture', 'ARPG / MMO'],
  },
  {
    id: 'multi-businesses',
    company: 'Multiple Businesses',
    role: 'Executive Advisor · Solutions Architect · Developer',
    scope: null,
    period: 'Mar 2018 – Feb 2021',
    location: 'Various',
    industry: 'Consulting',
    color: '#94a3b8',
    summary:
      'Strategic advisor and hands-on developer across a diverse portfolio of startups — banking, food services, IoT, health, and online retail.',
    highlights: [
      'Architected technology and business processes for banking, hedge-fund, and financial operations',
      'Productionised IoT systems and built 3D data visualisation for industrial clients',
      'Delivered retail automation and algorithmic tooling with security designed in from the start',
    ],
    tech: ['Solutions Architecture', 'IoT', '3D Visualisation', 'Cybersecurity', 'Automation', 'FinTech', 'DevOps'],
  },
  {
    id: 'iot-nxt',
    company: 'IoT.nxt',
    role: 'Full Stack Engineer & Innovation Specialist',
    scope: null,
    period: 'Sep 2016 – Mar 2018',
    location: 'Pretoria, South Africa',
    industry: 'IoT',
    color: '#fb923c',
    summary:
      'Built the company\'s core IoT data visualisation platform and led a skunkworks innovation division pioneering AR/VR and robotics applications.',
    highlights: [
      'Built Commander Web — the company\'s primary IoT data-visualisation product — in Angular, C# and .NET Core',
      'Led the innovation division: AR/VR prototypes on HoloLens and HTC Vive, LiDAR scanning, and robotics',
      'Created live 3D representations of IoT data for the next-generation product interface',
      'Prototyped IoT-driven robotic arms with self-taught inverse kinematics and facial recognition',
    ],
    tech: ['Angular', 'C#', '.Net Core', 'Ubuntu Snaps', 'AR/VR', 'Hololens', 'Unity3D', 'Robotics', 'LiDAR'],
  },
]

const SKILL_GROUPS: SkillGroup[] = [
  {
    category: 'AI & Automation',
    color: '#4ecdc4',
    skills: ['AI Agents', 'LLM Orchestration', 'Workflow Automation', 'Custom Models', 'AI Integration', 'Hyper-Automation'],
  },
  {
    category: 'Software Engineering',
    color: '#60a5fa',
    skills: ['TypeScript', 'React', 'Angular', 'Vue.js', 'Node.js', 'Python', 'C#', 'C++', '.NET Core'],
  },
  {
    category: 'Data & Cloud',
    color: '#fbbf24',
    skills: ['Azure', 'Databricks', 'Airflow', 'dbt', 'Data Pipelines', 'Timeseries Analytics'],
  },
  {
    category: 'Interactive & XR',
    color: '#a78bfa',
    skills: ['WebGL', 'React-Three-Fiber', 'Unity3D', 'Unreal Engine', 'TensorFlow.js', 'AR / VR', 'LiDAR'],
  },
  {
    category: 'Architecture & DevOps',
    color: '#fb923c',
    skills: ['Solutions Architecture', 'Microservices', 'API Design', 'CI/CD Pipelines', 'System Design', 'Cloud Deployment'],
  },
  {
    category: 'Leadership',
    color: '#94a3b8',
    skills: ['Tech Lead', 'CTO', 'Remote Team Management', 'Product Strategy', 'Mentorship', 'Startup Advisory'],
  },
  {
    category: 'Domain Depth',
    color: '#94a3b8',
    skills: ['Sustainability & ESG', 'FinTech & Trading', 'Cybersecurity', 'IoT & Embedded', 'EduTech / DRM'],
  },
]

const PROJECTS = [
  {
    name: 'Interfarm',
    tag: 'Live · Interfood',
    color: '#4ecdc4',
    desc: 'Sustainability platform where customers and dairy suppliers plan, fund, and track on-farm CO₂-reduction interventions together.',
    tech: ['Product Ownership', 'Data Platform', 'AI Workflows'],
    href: null,
  },
  {
    name: 'nezen.io',
    tag: 'Live · Personal',
    color: '#a78bfa',
    desc: 'A daily zen story app — one koan each morning by email or WhatsApp, with journalling, streaks, and a WebGL ink canvas.',
    tech: ['SvelteKit', 'TypeScript', 'PostgreSQL', 'WhatsApp API'],
    href: 'https://nezen.io',
  },
  {
    name: 'What The Duck',
    tag: 'Live · Personal',
    color: '#fbbf24',
    desc: 'A physics-driven 3D browser game — ducks, levels, and mayhem — built end-to-end in the browser with real-time physics.',
    tech: ['React-Three-Fiber', 'Three.js', 'Cannon Physics', 'Zustand'],
    href: 'https://wtd.jpbothma.com',
  },
  {
    name: 'Cyberspace Central',
    tag: 'Live · Three.js Challenge',
    color: '#fb923c',
    desc: 'A scroll-driven, neon-soaked 3D web experience — interdimensional stories told through WebGL, built for a Three.js challenge.',
    tech: ['Three.js', 'React-Three-Fiber', 'React Spring', 'Scroll-driven 3D'],
    href: 'https://contendo.jpbothma.com',
  },
]

// ─── TimelineItem ─────────────────────────────────────────────────────────────

function TimelineItem({ job, index }: { job: ExperienceItem; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.08 })

  return (
    <div
      ref={ref}
      className={`relative flex gap-5 md:gap-7 mb-8 animate-on-scroll ${inView ? 'in-view' : ''}`}
      style={{ transitionDelay: `${Math.min(index * 40, 160)}ms` }}
    >
      {/* Dot */}
      <div className="shrink-0 flex flex-col items-center pt-1.5" style={{ width: '20px' }}>
        <div
          className="w-3.5 h-3.5 rounded-full ring-4 ring-bg z-10 shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          style={{ background: job.color, boxShadow: `0 0 12px ${job.color}50` }}
          aria-hidden="true"
        />
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-elevated transition-all duration-300 overflow-hidden group"
        style={{ borderLeftColor: job.color, borderLeftWidth: '3px' }}
      >
        <div className="p-5 md:p-7">

          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <span
                className="inline-block text-[10px] font-sans font-semibold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full mb-2"
                style={{
                  color: job.color,
                  background: `${job.color}14`,
                  border: `1px solid ${job.color}28`,
                }}
              >
                {job.industry}
              </span>
              <h3 className="font-serif text-xl md:text-2xl text-[#f0f0f5] leading-tight tracking-tight">
                {job.company}
              </h3>
              <p className="font-sans font-medium text-sm text-accent mt-1">
                {job.role}
              </p>
              {job.scope && (
                <p className="font-sans text-xs text-[#6a6a85] mt-0.5">{job.scope}</p>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="font-sans text-sm font-medium text-[#9b9bb8]">{job.period}</p>
              <p className="font-sans text-xs text-[#6a6a85] mt-1 flex items-center justify-end gap-1">
                <MapPin size={10} />
                {job.location}
              </p>
            </div>
          </div>

          {/* Summary */}
          <p className="text-[#9b9bb8] font-sans text-sm leading-relaxed mb-4 border-l-2 pl-3 py-0.5 italic"
            style={{ borderColor: `${job.color}40` }}>
            {job.summary}
          </p>

          {/* Highlights */}
          <ul className="space-y-2 mb-5">
            {job.highlights.map((h, i) => (
              <li key={i} className="flex gap-2.5 text-sm font-sans text-[#9b9bb8] leading-relaxed">
                <span
                  className="mt-2 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: job.color }}
                  aria-hidden="true"
                />
                {h}
              </li>
            ))}
          </ul>

          {/* Tech pills */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border-subtle">
            {job.tech.map((t) => (
              <span
                key={t}
                className="text-[11px] font-sans px-2.5 py-1 rounded-full border"
                style={{ borderColor: `${job.color}28`, color: `${job.color}cc`, background: `${job.color}08` }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CVPage() {
  const { ref: heroRef, inView: heroInView } = useInView<HTMLElement>({ threshold: 0.05 })
  const { ref: expRef, inView: expInView } = useInView<HTMLElement>({ threshold: 0.03 })
  const { ref: bottomRef, inView: bottomInView } = useInView<HTMLElement>({ threshold: 0.05 })

  return (
    <div className="min-h-screen bg-bg">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-bg/95 backdrop-blur-md border-b border-border-subtle cv-no-print">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#9b9bb8] hover:text-[#f0f0f5] text-sm font-sans transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            <ArrowLeft size={14} />
            Back to site
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-[#6a6a85] text-xs font-sans">JP Bothma — CV</span>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 text-sm font-sans font-medium text-[#9b9bb8] hover:text-accent border border-border-subtle hover:border-accent/30 px-3 py-1.5 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Print or save as PDF"
            >
              <Printer size={13} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-14 md:py-20">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <header
          ref={heroRef}
          className={`mb-16 animate-on-scroll ${heroInView ? 'in-view' : ''}`}
        >
          {/* Accent rule */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-accent via-accent/30 to-transparent" />
            <span className="text-[10px] font-sans font-semibold tracking-[0.2em] uppercase text-accent">
              Curriculum Vitae
            </span>
          </div>

          {/* Name + contact grid */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
            <div>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-[#f0f0f5] tracking-tightest leading-none mb-3">
                JP Bothma
              </h1>
              <p className="font-sans font-medium text-accent text-base md:text-lg tracking-wide">
                Tech Lead & Creative Technologist · AI Agents & Orchestration · Full-Stack · Interactive 3D · Sustainability
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-[#6a6a85] font-sans text-sm">
                <MapPin size={13} />
                <span>Leiden, Netherlands</span>
                <span className="text-[#6a6a85]/40 mx-1">·</span>
                <span>Open to EU &amp; global engagements</span>
              </div>
            </div>

            {/* Contact block */}
            <div className="flex flex-col gap-3 md:items-end shrink-0">
              <a
                href="https://www.linkedin.com/in/jp-bothma"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                <span className="font-sans text-sm text-[#9b9bb8] group-hover:text-[#f0f0f5] transition-colors">
                  linkedin.com/in/jp-bothma
                </span>
                <div className="w-7 h-7 rounded bg-bg-elevated border border-border-subtle flex items-center justify-center text-[#6a6a85] group-hover:text-accent group-hover:border-accent/30 transition-colors">
                  <Linkedin size={13} />
                </div>
              </a>
            </div>
          </div>

          {/* Summary */}
          <blockquote className="border-l-2 border-accent pl-5 py-1 mb-8 max-w-3xl">
            <p className="font-sans text-base md:text-lg text-[#e6e6ef] leading-relaxed">
              Hands-on tech lead with 10+ years shipping products across sustainability, AI, FinTech,
              XR, and IoT. Currently heading sustainability technology at Interfood — where I shipped{' '}
              <strong className="text-accent font-semibold">Interfarm</strong>, a live CO₂-reduction
              platform for the global dairy chain — while building AI agents that automate entire
              workflows end-to-end. I own products from first sketch to production: architecture,
              code, teams, and delivery.
            </p>
          </blockquote>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATS.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 text-center hover:border-accent/20 transition-colors"
              >
                <p className="font-serif text-2xl md:text-3xl text-accent leading-none mb-1">{value}</p>
                <p className="font-sans text-xs text-[#6a6a85] leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </header>

        {/* ── Experience ──────────────────────────────────────────────────── */}
        <section
          ref={expRef}
          className="mb-16"
          aria-labelledby="experience-heading"
        >
          <div className={`flex items-center gap-4 mb-10 animate-on-scroll ${expInView ? 'in-view' : ''}`}>
            <h2
              id="experience-heading"
              className="font-serif text-3xl text-[#f0f0f5] tracking-tight shrink-0"
            >
              Professional Experience
            </h2>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          {/* Timeline container */}
          <div className="relative pl-8 md:pl-10">
            {/* Vertical line */}
            <div
              className="absolute left-[9px] md:left-[9px] top-1 bottom-16 w-px"
              style={{
                background: 'linear-gradient(to bottom, rgba(78,205,196,0.5), rgba(78,205,196,0.2) 60%, transparent)',
              }}
              aria-hidden="true"
            />

            {EXPERIENCE.map((job, i) => (
              <TimelineItem key={job.id} job={job} index={i} />
            ))}
          </div>
        </section>

        {/* ── Selected Projects ───────────────────────────────────────────── */}
        <section className="mb-16" aria-labelledby="projects-heading">
          <div className="flex items-center gap-4 mb-8">
            <h2
              id="projects-heading"
              className="font-serif text-3xl text-[#f0f0f5] tracking-tight shrink-0"
            >
              Selected Projects
            </h2>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {PROJECTS.map((p) => (
              <div
                key={p.name}
                className="rounded-xl border border-border-subtle bg-bg-surface p-6 hover:border-accent/20 transition-colors"
                style={{ borderLeftColor: p.color, borderLeftWidth: '3px' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  {p.href ? (
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif text-xl text-[#f0f0f5] hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    >
                      {p.name}
                    </a>
                  ) : (
                    <span className="font-serif text-xl text-[#f0f0f5]">{p.name}</span>
                  )}
                  <span
                    className="shrink-0 text-[10px] font-sans font-semibold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full"
                    style={{ color: p.color, background: `${p.color}14`, border: `1px solid ${p.color}28` }}
                  >
                    {p.tag}
                  </span>
                </div>
                <p className="font-sans text-sm text-[#9b9bb8] leading-relaxed mb-4">{p.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tech.map((t) => (
                    <span
                      key={t}
                      className="text-[11px] font-sans px-2.5 py-1 rounded-full border"
                      style={{ borderColor: `${p.color}28`, color: `${p.color}cc`, background: `${p.color}08` }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Education + Skills ──────────────────────────────────────────── */}
        <section
          ref={bottomRef}
          className={`grid md:grid-cols-5 gap-8 animate-on-scroll ${bottomInView ? 'in-view' : ''}`}
          aria-labelledby="education-heading"
        >

          {/* Education */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <h2
                id="education-heading"
                className="font-serif text-2xl text-[#f0f0f5] tracking-tight"
              >
                Education
              </h2>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

            <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 hover:border-accent/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                  <GraduationCap size={16} />
                </div>
                <div>
                  <p className="font-sans font-semibold text-[#f0f0f5] text-sm">Pearson Institute</p>
                  <p className="font-sans text-xs text-[#9b9bb8] mt-0.5">
                    Bachelor&rsquo;s Degree, Computer Science
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-sans font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full text-accent bg-accent/10 border border-accent/20">
                    Cum Laude
                  </span>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs font-sans text-[#6a6a85]">2014 – 2016</span>
                    <span className="text-[#6a6a85]/40">·</span>
                    <span className="text-xs font-sans text-[#6a6a85]">South Africa</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Availability callout */}
            <div className="mt-4 rounded-xl border border-dashed border-accent/20 bg-accent/[0.04] p-5">
              <p className="font-sans font-medium text-[#f0f0f5] text-sm mb-1">
                Currently available
              </p>
              <p className="font-sans text-[#6a6a85] text-xs leading-relaxed">
                Open to senior &amp; principal engineering roles, tech-lead positions, and fractional
                CTO engagements &mdash; AI, full-stack, interactive, or sustainability. On-site NL,
                hybrid, or remote.
              </p>
              <a
                href="#contact"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-sans font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
              >
                Get in touch
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Skills */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="font-serif text-2xl text-[#f0f0f5] tracking-tight shrink-0">Skills</h2>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

            <div className="space-y-4">
              {SKILL_GROUPS.map(({ category, color, skills }) => (
                <div key={category}>
                  <p
                    className="font-sans text-xs font-semibold tracking-[0.1em] uppercase mb-2"
                    style={{ color }}
                  >
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs font-sans px-2.5 py-1 rounded-full border"
                        style={{
                          borderColor: `${color}28`,
                          color: `${color}cc`,
                          background: `${color}0a`,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contact ─────────────────────────────────────────────────────── */}
        <Contact />

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="mt-16 pt-8 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="font-sans text-xs text-[#6a6a85]">
            JP Bothma · Leiden, Netherlands
          </p>
          <Link
            href="/"
            className="font-sans text-xs text-[#6a6a85] hover:text-accent transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded cv-no-print"
          >
            <ExternalLink size={11} />
            jpbothma.com
          </Link>
        </div>

      </div>
    </div>
  )
}
