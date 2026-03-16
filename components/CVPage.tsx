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
  { value: '8+', label: 'Years experience' },
  { value: '10+', label: 'Companies & ventures' },
  { value: '3', label: 'Continents' },
  { value: 'Cum Laude', label: 'BSc Computer Science' },
]

const EXPERIENCE: ExperienceItem[] = [
  {
    id: 'interfood',
    company: 'Interfood Group',
    role: 'Lead Sustainability Developer',
    scope: 'Global',
    period: 'Mar 2024 – Present',
    location: 'Eindhoven, Netherlands',
    industry: 'SustainTech',
    color: '#4ecdc4',
    summary:
      'Driving integration of sustainable practices into the global dairy industry through innovative digital solutions — bridging sustainability and technology at scale.',
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
      'Created full-body tracking mini-game using React-Three-Fiber and TensorFlow.js running entirely in-browser',
      'Built Event Management Systems and Content Management Systems as part of the product suite',
      'Native app development with Unity3D (C#) and Unreal Engine (C++) for Windows and VR mobile platforms',
      'Implemented custom CI/CD pipelines for automated, reliable cross-platform deployments',
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
      'Strategically led a globally distributed remote tech team delivering the Talk360 Payment Platform',
      'Designed backend API aggregation using Node.js (MarbleJS) for robust, scalable provider integrations',
      'Built the frontend with Vue.js, crafting intuitive and accessible payment interfaces',
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
      'Developed Trading Education and Gamification platform empowering students in financial markets',
      'Built an Automated Trading Hedge Fund with quantitative and algorithmic trading systems',
      'Launched Vaultron.io white-labeled online education platform for scalable client deployment',
      'Mastered full trading technology stacks: PineScript, MQL4/5, C++ and Python',
      'Integrated intercommunication across diverse data layers from multiple brokers and providers',
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
      'Built e-learning platform with Hollywood-grade media encryption plus a proprietary encryption layer',
      'Developed industry-leading anti-piracy system redefining security standards in online education',
      'Designed scalable platform architecture serving educational organisations worldwide',
      'Led hands-on technical team with a solution-driven, innovation-first culture',
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
      'Built city-building and voxel technology delivering dynamic, infinitely scalable in-game environments',
      'Implemented infinite world generation using procedural algorithms, blend maps and custom shader editors',
      'Created special effects with VFX Graphs; designed scalable backend server architecture',
      'Mentored and developed team members, fostering a culture of ambition and technical excellence',
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
      'Technology and business process architecture for banking, hedge funds and financial operations',
      'IoT productionisation and 3D data visualisation for complex industrial use cases',
      'Product development and production deployment with cybersecurity embedded at the core',
      'Online retail automation, bot development and algorithmic competitive tooling',
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
      'Developed Commander Web — IoT.nxt\'s primary data visualisation interface — using Angular, C# and .Net Core',
      'Led innovation division creating AR/VR prototypes with Hololens, HTC Vive, Unity3D, Unreal Engine and LiDAR',
      'Built immersive 3D representations of live IoT data for Commander\'s next-generation interface',
      'Prototyped IoT-enabled robotic arms with self-taught inverse kinematics and facial recognition',
    ],
    tech: ['Angular', 'C#', '.Net Core', 'Ubuntu Snaps', 'AR/VR', 'Hololens', 'Unity3D', 'Robotics', 'LiDAR'],
  },
]

const SKILL_GROUPS: SkillGroup[] = [
  {
    category: 'Software Engineering',
    color: '#4ecdc4',
    skills: ['Full-Stack Development', 'Angular', 'React', 'Vue.js', 'Node.js', 'C#', 'C++', 'Python', '.Net Core'],
  },
  {
    category: 'Architecture & DevOps',
    color: '#60a5fa',
    skills: ['Solutions Architecture', 'CI/CD Pipelines', 'Microservices', 'API Design', 'System Design', 'Cloud Deployment'],
  },
  {
    category: 'Emerging & XR Tech',
    color: '#a78bfa',
    skills: ['Unity3D', 'Unreal Engine', 'AR / VR', 'TensorFlow.js', 'IoT', 'Robotics', 'LiDAR', 'VFX Graphs'],
  },
  {
    category: 'FinTech & Trading',
    color: '#fbbf24',
    skills: ['Algorithmic Trading', 'PineScript', 'MQL4/5', 'Quantitative Finance', 'Payment Platforms', 'DRM / Encryption'],
  },
  {
    category: 'Security & AI',
    color: '#fb923c',
    skills: ['Cybersecurity', 'OT / ICS Security', 'Media Encryption', 'Anti-piracy', 'AI Integration', 'Penetration Testing'],
  },
  {
    category: 'Leadership',
    color: '#94a3b8',
    skills: ['CTO', 'Tech Lead', 'Remote Team Management', 'Product Strategy', 'Mentorship', 'Startup Advisory'],
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
                Tech Lead · OT/ICS Security · GreenTech · Full-Stack
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-[#6a6a85] font-sans text-sm">
                <MapPin size={13} />
                <span>Amsterdam, Netherlands</span>
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
            <p className="font-serif text-lg md:text-xl text-[#f0f0f5] leading-relaxed italic">
              &ldquo;Courageously pursuing intellectual and creative freedom in technology — committed to solving
              challenging, meaningful problems that shape the future in sustainable ways.&rdquo;
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
                Open to consulting engagements, fractional CTO roles, and OT security projects across the EU and globally.
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
            JP Bothma · Amsterdam, Netherlands
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
