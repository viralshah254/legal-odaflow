/** Static sample data for /demo tour only — never used in production app routes */

export const DEMO_DISCLAIMER =
  "Demo mode — sample data only. No information here is legal advice or connected to live systems."

export const DEMO_TOUR_STEPS = [
  {
    id: "consumer",
    title: "Consumer legal guidance",
    description:
      "Individuals explain their issue, get a structured free preview with disclaimer, and can upgrade to a full report or lawyer review.",
    highlight: "Issue checker → risk preview → lawyer upgrade",
  },
  {
    id: "matter",
    title: "Lawyer matter hub",
    description:
      "Every matter is the center of truth: timeline, tasks, documents, billing, and team access in one place.",
    highlight: "Matter ODA-2026-LIT-001 · Acme Corp v. Supplier",
  },
  {
    id: "copilot",
    title: "Matter-aware Copilot",
    description:
      "Copilot knows the matter context and suggests next actions — draft tasks, summarize facts, research with citations.",
    highlight: '"Draft engagement letter" · "Summarize open tasks"',
  },
  {
    id: "document",
    title: "Document governance",
    description:
      "Every document gets an immutable code, client linkage, version history, and role-based access aligned to firm policy.",
    highlight: "DOC-ODA-2026-CL-004821 · Engagement Letter v2",
  },
  {
    id: "billing",
    title: "Billing & trust",
    description:
      "Time entries flow to invoices; trust deposits and disbursements stay compliant with approval workflows.",
    highlight: "Invoice INV-2026-0142 · Trust balance verified",
  },
] as const

export const DEMO_SAMPLE_MATTER = {
  ref: "ODA-2026-LIT-001",
  title: "Acme Corp v. Global Supplier Ltd",
  client: "Acme Corporation",
  stage: "Discovery",
  practiceArea: "Commercial Litigation",
  owner: "Priya Sharma",
}

export const DEMO_SAMPLE_DOCUMENT = {
  code: "DOC-ODA-2026-CL-004821",
  name: "Engagement Letter — Acme Corp",
  version: 2,
  visibility: "Matter team + ethical wall",
}

export const DEMO_SAMPLE_INVOICE = {
  number: "INV-2026-0142",
  amount: "₹1,24,500",
  status: "Sent",
  trustBalance: "₹5,00,000",
}
