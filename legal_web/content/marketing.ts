export type MarketingLink = {
  label: string
  href?: string
  disabled?: boolean
}

export type MarketingNavIcon =
  | "sparkles"
  | "search"
  | "file"
  | "shield"
  | "briefcase"
  | "user"
  | "building"
  | "heart"
  | "users"
  | "book"
  | "layers"
  | "compare"
  | "code"
  | "lock"

export type MarketingNavItem = {
  label: string
  href: string
  description: string
  icon: MarketingNavIcon
}

export type MarketingNavGroup = {
  label: string
  href: string
  description: string
  items: readonly MarketingNavItem[]
}

export type SecurityClaim = {
  title: string
  description: string
  verified: boolean
  todo?: string
}

export type ModuleWorkspace =
  | {
      kind: "intake"
      situation: string
      tags: readonly string[]
      nextStep: string
    }
  | {
      kind: "research"
      query: string
      finding: string
      citations: readonly string[]
      sourceCount: string
    }
  | {
      kind: "draft"
      document: string
      checklist: readonly string[]
      progress: string
    }
  | {
      kind: "review"
      document: string
      flags: readonly { label: string; severity: "high" | "medium" }[]
      reviewed: string
    }
  | {
      kind: "manage"
      matter: string
      tasks: readonly { label: string; due: string; done?: boolean }[]
      progress: string
    }
  | {
      kind: "collaborate"
      people: readonly { initials: string; name: string; color: string }[]
      handoff: string
      status: string
    }

export type MarketingModule = {
  id: "understand" | "research" | "draft" | "review" | "manage" | "collaborate"
  label: string
  eyebrow: string
  title: string
  description: string
  accent: string
  workspace: ModuleWorkspace
}

export const marketingContent = {
  announcement: {
    text: "Umbrella is now available for legal professionals in India.",
    href: "/in",
    cta: "Explore the platform",
  },
  navigation: {
    groups: [
      {
        label: "Product",
        href: "/legal-ai",
        description: "Explore the connected legal workspace.",
        items: [
          { label: "Legal AI", href: "/legal-ai", description: "See the complete AI-assisted legal workspace.", icon: "sparkles" },
          { label: "Legal research", href: "/solutions/legal-research", description: "Move from question to source-linked authority.", icon: "search" },
          { label: "Legal drafting", href: "/legal-forms", description: "Create structured first drafts from matter context.", icon: "file" },
          { label: "Document review", href: "/upload-document", description: "Surface clauses, risks and next steps.", icon: "shield" },
          { label: "Practice management", href: "/solutions/practice-management", description: "Connect matters, deadlines, clients and billing.", icon: "briefcase" },
        ],
      },
      {
        label: "Solutions",
        href: "/solutions",
        description: "Find the right Umbrella experience for you.",
        items: [
          { label: "For lawyers", href: "/for-lawyers", description: "A calmer workspace for independent practice.", icon: "user" },
          { label: "For law firms", href: "/for-law-firms", description: "Connected operations for modern legal teams.", icon: "building" },
          { label: "For individuals", href: "/legal-issue-checker", description: "Understand an issue and decide what comes next.", icon: "heart" },
          { label: "Find a lawyer", href: "/lawyers", description: "Browse verified professionals accepting clients.", icon: "users" },
        ],
      },
      {
        label: "Resources",
        href: "/legal-guides",
        description: "Guides and tools for better legal decisions.",
        items: [
          { label: "Legal guides", href: "/legal-guides", description: "Plain-language guidance across four countries.", icon: "book" },
          { label: "Solution library", href: "/solutions", description: "Explore workflows and legal use cases.", icon: "layers" },
          { label: "Compare Umbrella", href: "/compare", description: "See how Umbrella differs from other tools.", icon: "compare" },
          { label: "Developers", href: "/developers", description: "Build with Umbrella APIs and integrations.", icon: "code" },
          { label: "Trust centre", href: "/trust", description: "Review security, privacy and governance.", icon: "lock" },
        ],
      },
    ] satisfies readonly MarketingNavGroup[],
    direct: [
      { label: "Security", href: "/trust" },
    ] satisfies readonly MarketingLink[],
    actions: {
      login: { label: "Log in", href: "/auth" },
      demo: { label: "Book a demo", href: "/demo" },
      start: { label: "Start free", href: "/auth" },
    },
  },
  trust: [
    "Built for advocates and legal teams",
    "India-first legal workflows",
    "Source-linked legal research",
    "One connected legal workspace",
  ],
  modules: [
    {
      id: "understand", label: "Understand", eyebrow: "Issue intelligence", title: "Start with the facts that matter.", description: "Bring a legal situation into focus with guided questions, clear context and practical next steps.", accent: "from-sky-400 to-blue-600",
      workspace: { kind: "intake", situation: "Tenant has not received the security deposit after vacating.", tags: ["Rental dispute", "New Delhi", "Response due soon"], nextStep: "Confirm agreement and payment evidence" },
    },
    {
      id: "research", label: "Research", eyebrow: "Source-linked research", title: "See the authority behind the answer.", description: "Move from a plain-language query to structured research, relevant provisions and connected citations.", accent: "from-violet-400 to-indigo-600",
      workspace: { kind: "research", query: "What supports recovery of an unpaid security deposit?", finding: "Relevant authority and statutory remedies are ready to review.", citations: ["Delhi Rent Act", "Section 19", "3 decisions"], sourceCount: "8 linked sources" },
    },
    {
      id: "draft", label: "Draft", eyebrow: "Structured drafting", title: "Turn context into a better first draft.", description: "Build from matter facts, clauses and legal structure—then keep human judgement in control.", accent: "from-emerald-400 to-teal-600",
      workspace: { kind: "draft", document: "Legal notice · Security deposit", checklist: ["Facts and chronology", "Demand for payment", "Relief and deadline"], progress: "642 words · 3 sections" },
    },
    {
      id: "review", label: "Review", eyebrow: "Document intelligence", title: "Make the important clauses visible.", description: "Surface risks, obligations and changes without losing sight of the original document.", accent: "from-amber-400 to-orange-600",
      workspace: { kind: "review", document: "Lease agreement · 14 pages", flags: [{ label: "Security deposit return", severity: "high" }, { label: "Notice period wording", severity: "medium" }], reviewed: "2 clauses need attention" },
    },
    {
      id: "manage", label: "Manage", eyebrow: "Matter workspace", title: "Keep every moving part connected.", description: "Clients, tasks, documents, deadlines and notes stay together around the matter.", accent: "from-rose-400 to-pink-600",
      workspace: { kind: "manage", matter: "Sharma v. Arora · Rental recovery", tasks: [{ label: "Review signed lease", due: "Today", done: true }, { label: "Send legal notice", due: "Tomorrow" }, { label: "Client update", due: "Fri" }], progress: "1 of 3 tasks complete" },
    },
    {
      id: "collaborate", label: "Collaborate", eyebrow: "Connected delivery", title: "Bring the right people into the work.", description: "Move smoothly from individual guidance to lawyer handoff and team delivery.", accent: "from-cyan-400 to-blue-600",
      workspace: { kind: "collaborate", people: [{ initials: "VS", name: "Viral Shah", color: "bg-blue-500" }, { initials: "AK", name: "Ananya Kapoor", color: "bg-cyan-500" }, { initials: "RM", name: "Rohan Mehta", color: "bg-violet-500" }], handoff: "Draft shared with client for approval", status: "Ready for client delivery" },
    },
  ] satisfies readonly MarketingModule[],
  features: [
    { id: "research", eyebrow: "Legal research", title: "Research that shows its work.", description: "Ask naturally, review a structured response, and follow the connected authority back to the source.", cta: "Explore legal research", accent: "from-violet-500 to-indigo-600", icon: "search" },
    { id: "drafting", eyebrow: "Drafting", title: "From facts to a structured first draft.", description: "Matter facts, relevant provisions and an editable outline give your first draft a more useful starting point.", cta: "See drafting tools", accent: "from-emerald-500 to-teal-600", icon: "file" },
    { id: "review", eyebrow: "Document review", title: "Turn long documents into clear decisions.", description: "Focus attention on the clauses, risks and next steps that deserve human judgement.", cta: "Explore document review", accent: "from-amber-500 to-orange-600", icon: "shield" },
    { id: "matters", eyebrow: "Matter management", title: "Keep every client, document and deadline connected.", description: "Organise legal work around a living matter—not a collection of disconnected tools.", cta: "See the workspace", accent: "from-rose-500 to-pink-600", icon: "layers" },
    { id: "issue-checker", eyebrow: "Issue checker", title: "Understand the issue before deciding what comes next.", description: "Clarify a situation, identify relevant information and choose the right next step with confidence.", cta: "Understand an issue", accent: "from-sky-500 to-blue-600", icon: "check" },
  ],
  audiences: [
    { id: "individuals", title: "For individuals", description: "Turn a difficult legal question into a clearer picture of your options.", points: ["Guided issue understanding", "Source-linked legal information", "A path to professional help"], cta: "Start with your situation", href: "/auth" },
    { id: "lawyers", title: "For lawyers", description: "Research, draft and organise matters with more context and less tool-switching.", points: ["Cited research workflows", "Drafting and review support", "Connected matters and clients"], cta: "Explore for lawyers", href: "/for-lawyers" },
    { id: "firms", title: "For law firms", description: "Give your team one calmer, more connected workspace for legal delivery.", points: ["Shared matter context", "Team collaboration", "Client-facing workflow"], cta: "Explore for law firms", href: "/for-law-firms" },
  ],
  workflow: ["Legal question", "Research", "Draft", "Review", "Matter", "Client delivery"],
  outcomes: [
    "Less time spent switching between tools",
    "Faster, more structured first drafts",
    "Better-organised matter context",
    "Research with accessible sources",
    "Easier collaboration and client communication",
  ],
  security: [
    { title: "Professional judgement stays central", description: "Umbrella is designed to organise legal work and make source material easier to inspect.", verified: true },
    { title: "Clear product boundaries", description: "Umbrella provides legal information and workflow tools. It does not replace professional legal advice.", verified: true },
    { title: "Security controls", description: "Security capabilities will be published here after they are verified against the production architecture.", verified: false, todo: "Confirm encryption, access control, retention and audit capabilities before publishing." },
  ] satisfies SecurityClaim[],
  footer: {
    product: [{ label: "Legal Research", href: "/legal-ai" }, { label: "Drafting", href: "/legal-ai" }, { label: "Document Review", href: "/upload-document" }, { label: "Issue Checker", href: "/legal-issue-checker" }, { label: "Find a lawyer", href: "/lawyers" }, { label: "Compare", href: "/compare" }],
    solutions: [{ label: "Individuals", href: "/legal-issue-checker" }, { label: "Lawyers", href: "/for-lawyers" }, { label: "Law Firms", href: "/for-law-firms" }, { label: "Pricing", href: "/pricing" }],
    regions: [{ label: "India", href: "/in" }, { label: "United Kingdom", href: "/gb" }, { label: "United States", href: "/us" }, { label: "Kenya", href: "/ke" }],
    company: [{ label: "About", disabled: true }, { label: "Contact", href: "/demo" }, { label: "Careers", disabled: true }, { label: "Blog", href: "/legal-guides" }],
    legal: [{ label: "Terms", href: "/terms" }, { label: "Privacy", href: "/privacy" }, { label: "Data consent", href: "/data-consent" }, { label: "Disclaimer", href: "/legal-disclaimer" }],
  } satisfies Record<string, readonly MarketingLink[]>,
  video: {
    filmMp4: "/video/umbrella-product-film.mp4",
    poster: "/video/umbrella-film-poster.jpg",
  },
  images: {
    heroCore: "/marketing/umbrella-hero-core.png",
    heroCoreCalm: "/marketing/umbrella-hero-core-calm.png",
    networkBackdrop: "/marketing/umbrella-network-backdrop.png",
  },
} as const
