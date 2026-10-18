# Umbrella — Production-Grade Cursor Master Spec

**Project:** Umbrella  
**Target quality:** Series A funding quality, production-level, scalable, secure, multi-country, multi-tenant  
**Repos/Folders:**

- `legal_web` — Next.js web platform for public consumer website, consumer dashboard, lawyer OS, admin console
- `legal_backend` — Node.js/NestJS backend, APIs, AI orchestration, data pipelines, billing, legal research, jobs
- `legal_app` — Flutter mobile app for consumers and lawyers

**Primary markets:** India and United States  
**Secondary expansion:** Kenya and United Kingdom  
**Core thesis:** Build the legal platform for everyone: ordinary people get affordable legal guidance and document help before hiring a lawyer, while lawyers get an AI-native operating system, legal research engine, client intake, CRM, billing, matter management, and lead marketplace.

---

# 1. Product Vision

Umbrella is a dual-sided legal technology platform:

1. **Consumer Legal Guidance Platform**
   - Helps individuals understand legal issues, upload documents, generate plain-English legal risk reports, draft simple letters, know next steps, and escalate to verified lawyers.

2. **AI-Native Lawyer OS**
   - Helps lawyers and law firms run their practice: matters, clients, documents, billing, time tracking, trust/client funds, client portal, research, drafting, AI agents, workflows, leads, analytics.

3. **Lawyer Marketplace Bridge**
   - Converts serious consumer issues into verified lawyer review requests, consultations, and representation leads.

## 1.1 North Star

> Umbrella helps anyone understand their legal situation, know their options, prepare documents, estimate risk, and escalate to a verified lawyer when needed — while giving lawyers the AI-native operating system to run and grow their entire practice.

## 1.2 Positioning

### For Consumers

> Understand your legal problem before you spend thousands on a lawyer.

### For Lawyers

> The AI-native legal operating system for modern law firms.

### For Investors

> A dual-sided legal infrastructure platform combining consumer legal guidance, AI legal research, lawyer workflow automation, and marketplace monetization.

---

# 2. Non-Negotiable Legal Safety Rules

The platform must be useful without creating unauthorized-practice-of-law risk.

## 2.1 Consumer Side Must Not Say

Do not market or generate text saying:

- “AI lawyer”
- “Guaranteed legal advice”
- “Win your case”
- “Replace your lawyer”
- “Court-ready legal advice”
- “This is what the judge will decide”

## 2.2 Consumer Side Must Say

Use safer positioning:

- Legal guidance
- Legal information
- Risk analysis
- Legal issue checker
- Document explanation
- Self-help assistant
- Lawyer-reviewed upgrade
- Pre-lawyer consultation report

## 2.3 Universal Disclaimer

Every consumer legal output must include:

```text
Umbrella provides legal information, document explanation, issue spotting, and risk analysis. It is not a law firm and does not replace a licensed lawyer. For legal advice specific to your situation, consult a qualified lawyer in your jurisdiction.
```

## 2.4 Human Lawyer Approval

Any of the following require lawyer approval before being represented as legal advice:

- Final legal opinion
- Court filing
- Legal notice sent externally
- Lawyer-reviewed report
- Client-specific legal advice
- Strategy memo intended for client reliance
- Any marketplace lawyer review output

## 2.5 AI Citation Rule

The AI must never invent legal citations. Every case/statute/regulation referenced as authority must be retrieved from a stored or connected source and saved as a citation record.

---

# 3. Repo Architecture

## 3.1 `legal_web`

**Framework:** Next.js App Router + TypeScript

Purpose:

- Public website
- Consumer web dashboard
- Lawyer OS dashboard
- Admin console
- Lawyer marketplace
- Pricing pages
- Legal issue checker
- AI report viewer
- Research UI
- Matter management UI

Recommended stack:

- Next.js 15+
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- TanStack Table
- Zustand for lightweight UI state
- React Hook Form
- Zod
- TipTap or Lexical editor
- PDF.js viewer
- Framer Motion for polished UX
- Recharts for dashboards
- Sentry
- PostHog or OpenPanel analytics

## 3.2 `legal_backend`

**Framework:** NestJS + TypeScript

Purpose:

- Authentication and authorization
- Tenant management
- Consumer cases
- Lawyer OS APIs
- AI gateway
- RAG retrieval
- Legal research connectors
- Document processing
- OCR pipelines
- Billing/subscriptions
- Marketplace routing
- Notifications
- Background jobs
- Audit logs
- Admin controls

Recommended stack:

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- BullMQ
- pgvector initially
- OpenSearch later for high-scale legal search
- S3-compatible storage
- CloudFront/CDN
- WebSockets/SSE for job progress — implemented via Socket.IO namespace `/realtime` with tenant rooms (`NEXT_PUBLIC_WS_URL` on web, `REDIS_URL` for multi-instance adapter)
- OpenTelemetry
- Sentry
- Prometheus/Grafana later

## 3.3 `legal_app`

**Framework:** Flutter

Purpose:

- Consumer mobile legal issue checker
- Consumer reports
- Document upload/photo scan
- Lawyer matching
- Lawyer mobile dashboard
- Quick matter notes
- Task alerts
- Time capture
- Push notifications

Recommended stack:

- Flutter latest stable
- Riverpod or Bloc
- Dio
- GoRouter
- Firebase Messaging
- Secure Storage
- image_picker / file_picker
- local_auth for biometric unlock
- Sentry Flutter

---

# 4. High-Level System Architecture

```text
[legal_web]                [legal_app]
    |                          |
    | HTTPS                    | HTTPS
    v                          v
[legal_backend API Gateway / NestJS]
    |
    |-- Auth / RBAC / Tenant Guards
    |-- Consumer Case Service
    |-- Lawyer OS Service
    |-- Marketplace Service
    |-- Billing Service
    |-- AI Gateway
    |-- Document Intelligence Service
    |-- Legal Research Service
    |-- Notification Service
    |-- Audit Service
    |
    |-- PostgreSQL + pgvector
    |-- Redis + BullMQ
    |-- S3 Storage
    |-- OpenSearch later
    |-- External AI Providers
    |-- Payment Providers
    |-- Email/SMS/Push Providers
```

---

# 5. Product Modules

## 5.1 Public Consumer Platform

Routes in `legal_web`:

```text
/
/ask
/legal-issue-checker
/upload-document
/pricing
/lawyers
/for-lawyers
/legal-guides
/legal-guides/[country]/[slug]
/report-preview/[previewId]
```

Features:

- Country selector
- Legal issue selector
- Anonymous free preview
- Signup wall
- Payment wall
- Paid report generation
- Upload document for explanation
- Lawyer-reviewed upgrade CTA
- Pricing by country
- SEO legal guides
- Conversion to consumer account

## 5.2 Consumer Dashboard

Routes:

```text
/consumer/dashboard
/consumer/cases
/consumer/cases/[caseId]
/consumer/reports
/consumer/documents
/consumer/lawyer-review
/consumer/subscription
/consumer/settings
```

Features:

- Saved legal cases
- AI reports
- Uploaded documents
- Draft letters
- Follow-up questions
- Lawyer review requests
- Subscription usage
- Payments and invoices
- Report PDF download

## 5.3 Lawyer OS

Routes:

```text
/app/dashboard
/app/matters
/app/matters/[matterId]
/app/matters/[matterId]/ai
/app/matters/[matterId]/strategy
/app/clients
/app/leads
/app/research
/app/documents
/app/time
/app/billing
/app/trust
/app/calendar
/app/tasks
/app/intake
/app/automations
/app/ai-command-center
/app/settings
/app/settings/ai-policy
/app/settings/ai-agents
/app/settings/billing
/app/settings/users
/app/settings/firm
```

Features:

- Firm dashboard
- Matter management
- Client CRM
- Time tracking
- Billing/invoicing
- Document management
- Trust/client funds ledger
- AI research
- AI matter copilot
- Strategy memo generation
- Lead inbox
- Client portal
- Task management
- Calendar/deadlines
- Workflows/automation
- AI usage dashboard
- Firm analytics

## 5.4 Admin Console

Routes:

```text
/admin/dashboard
/admin/users
/admin/tenants
/admin/consumer-cases
/admin/lawyer-verification
/admin/reports
/admin/payments
/admin/legal-sources
/admin/ai-usage
/admin/system-health
/admin/compliance
```

Features:

- Manage users
- Manage law firms
- Verify lawyers
- Monitor consumer reports
- Monitor AI usage and cost
- Manage legal data sources
- Manage pricing by country
- Handle abuse/fraud
- System health
- Payment disputes

---

# 6. User Types

```text
CONSUMER
LAWYER_SOLO
LAW_FIRM_OWNER
LAW_FIRM_USER
LAW_FIRM_ADMIN
EXTERNAL_COUNSEL
CLIENT_PORTAL_USER
PLATFORM_ADMIN
SUPPORT_ADMIN
```

---

# 7. Multi-Tenant Design

The lawyer OS must be multi-tenant from day one.

## 7.1 Tenant Rules

Every firm has a `tenantId`.

Every lawyer OS record must include `tenantId`:

- Users
- Clients
- Matters
- Documents
- Time entries
- Invoices
- Payments
- Trust records
- Tasks
- Notes
- AI outputs
- Audit logs
- Agent jobs

## 7.2 Consumer vs Tenant Isolation

Consumer cases are not tenant records until a lawyer accepts/reviews/converts the case.

Consumer data belongs to the consumer account.

When consumer requests lawyer review:

1. Create `LawyerReviewRequest`
2. Create a limited access package
3. Assign to lawyer/tenant
4. Lawyer can view only the package
5. If consumer signs engagement, convert to `Client` and `Matter`

## 7.3 Ethical Walls

Law firms need ethical walls.

Features:

- Restrict specific matters from specific firm users
- AI retrieval must respect ethical walls
- Document access must respect ethical walls
- Audit every access attempt

---

# 8. Country and Jurisdiction System

## 8.1 Supported at Launch

- India
- United States

## 8.2 Soon After

- Kenya
- United Kingdom

## 8.3 Country Config

Create country configuration files:

`legal_backend/src/config/countries.ts`

```ts
export const COUNTRIES = {
  IN: {
    name: 'India',
    currency: 'INR',
    legalSystem: 'common_law',
    primaryUseCases: ['family', 'property', 'employment', 'cheque_bounce', 'consumer', 'criminal_basic'],
    complianceMode: 'guidance_with_lawyer_review_upgrade',
    paymentProviders: ['razorpay'],
  },
  US: {
    name: 'United States',
    currency: 'USD',
    legalSystem: 'common_law_federal_state',
    primaryUseCases: ['employment', 'landlord_tenant', 'small_claims', 'contracts', 'family_basic'],
    complianceMode: 'strict_consumer_guidance',
    paymentProviders: ['stripe'],
  },
  KE: {
    name: 'Kenya',
    currency: 'KES',
    legalSystem: 'common_law',
    primaryUseCases: ['employment', 'landlord_tenant', 'debt', 'property', 'business_contracts'],
    complianceMode: 'guidance_with_lawyer_review_upgrade',
    paymentProviders: ['mpesa', 'stripe'],
  },
  GB: {
    name: 'United Kingdom',
    currency: 'GBP',
    legalSystem: 'common_law',
    primaryUseCases: ['employment', 'housing', 'consumer', 'contracts'],
    complianceMode: 'strict_consumer_guidance',
    paymentProviders: ['stripe'],
  },
};
```

## 8.4 Jurisdiction Guard

Every AI legal workflow must require:

- Country
- State/province/county where applicable
- Legal issue type
- User type
- AI mode

If missing, ask for it before generating detailed legal guidance.

---

# 9. Consumer Legal Issue Categories

## 9.1 India

- Divorce / separation
- Maintenance / alimony
- Domestic violence legal process
- Property dispute
- Landlord/tenant
- Employment termination
- Salary dispute
- Cheque bounce
- Consumer complaint
- Contract dispute
- Legal notice reply
- Criminal complaint explanation
- Business/commercial dispute

## 9.2 United States

- Employment termination
- Wage dispute
- Landlord/tenant
- Small claims
- Debt collection response
- Contract dispute
- Demand letter
- Consumer complaint
- Family law basics
- Business formation basics
- Personal injury guidance

## 9.3 Kenya

- Employment dispute
- Landlord/tenant
- Debt recovery
- Land/property dispute
- Family issue
- Police/court process explanation
- Business contract
- Demand letter

---

# 10. AI Platform Strategy

## 10.1 AI Design Principle

Use multiple AI modes, not one generic chatbot.

```ts
export type AIMode =
  | 'CONSUMER_FREE_PREVIEW'
  | 'CONSUMER_PAID_REPORT'
  | 'CONSUMER_DOCUMENT_EXPLAINER'
  | 'CONSUMER_DRAFT_LETTER'
  | 'LAWYER_MATTER_COPILOT'
  | 'LAWYER_LEGAL_RESEARCH'
  | 'LAWYER_STRATEGY_MEMO'
  | 'LAWYER_DRAFTING'
  | 'LAWYER_DOCUMENT_REVIEW'
  | 'LAWYER_BILLING_ASSISTANT'
  | 'ADMIN_REVIEW';
```

## 10.2 Recommended AI Providers

Use provider abstraction so the app can switch providers.

Initial:

- OpenAI for reasoning, summaries, drafting, legal reports
- OpenAI embeddings or equivalent for semantic search
- Azure Document Intelligence or AWS Textract for OCR
- Whisper/equivalent for transcripts later

Later optional:

- Anthropic
- Google Gemini
- Mistral
- Self-hosted models for classification/extraction

## 10.3 Model Routing

Cheap/fast model:

- Classification
- Issue detection
- Country routing
- Simple summaries
- Lead scoring
- Suggested questions

Premium reasoning model:

- Paid reports
- Legal research
- Strategy memos
- Long document analysis
- Drafting
- Opponent filing analysis

Embedding model:

- Document chunks
- Legal authority chunks
- Matter facts
- Similar case retrieval

## 10.4 AI Gateway Requirements

Create in `legal_backend`:

```text
src/ai/ai-gateway.service.ts
src/ai/ai-policy.service.ts
src/ai/ai-usage.service.ts
src/ai/prompts/*
src/ai/guards/*
src/ai/rag/*
src/ai/agents/*
```

AI gateway must:

- Enforce user permissions
- Enforce tenant isolation
- Enforce consumer vs lawyer mode
- Enforce country compliance policy
- Enforce monthly AI budget
- Track tokens/cost
- Save outputs
- Save citations
- Apply redaction if needed
- Block unsupported legal claims
- Add disclaimers to consumer reports

---

# 11. RAG and Legal Research Architecture

## 11.1 Search Strategy

Do not rely on vector search alone.

Use hybrid retrieval:

1. Keyword search
2. Vector search
3. Citation search
4. Jurisdiction filters
5. Court hierarchy filters
6. Date filters
7. Practice area filters
8. Reranking

## 11.2 Indexes

Initial affordable setup:

- PostgreSQL + pgvector
- PostgreSQL full-text search

Scale setup:

- OpenSearch for full-text/citation/legal authority search
- Dedicated vector DB only if pgvector becomes limiting

## 11.3 Legal Authority Sources

### India

Build connector architecture for:

- Supreme Court judgments
- High Court judgments
- Indian statutes
- Rules/regulations
- eCourts/NJDG metadata where permitted
- Licensed databases later
- Firm-uploaded research

### United States

Build connector architecture for:

- CourtListener
- Caselaw Access Project
- Federal statutes
- State statutes
- Court rules
- Regulations
- RECAP/PACER where permitted
- Licensed databases later
- Firm-uploaded research

## 11.4 No Illegal Scraping

Every source connector must store:

- Source name
- Source URL
- Terms/license status
- Allowed use type
- Last fetched date
- Hash of content
- Retrieval metadata

## 11.5 Citation Record

Every legal source used in AI output must create `AICitation`.

---

# 12. Autonomous Agents

Create AI agents, but keep approval controls.

## 12.1 Consumer Agents

- Issue Classification Agent
- Urgency Detection Agent
- Document Explanation Agent
- Paid Report Agent
- Draft Letter Agent
- Lawyer Matching Agent

## 12.2 Lawyer Agents

- Matter Summarizer Agent
- Fact Extraction Agent
- Legal Research Agent
- Strategy Agent
- Drafting Agent
- Deadline Agent
- Billing Agent
- Evidence Gap Agent
- Opposition Analysis Agent
- Client Update Agent
- Firm Operations Agent

## 12.3 Agent Job System

Use BullMQ queues:

```text
ai.low_priority
ai.high_priority
documents.ocr
documents.embedding
legal_sources.ingestion
billing.webhooks
notifications
reports.pdf
```

Agent jobs must support:

- Queued
- Running
- Needs approval
- Completed
- Failed
- Retried
- Canceled

---

# 13. Data Model Overview

Use Prisma in `legal_backend`.

Core models required:

- User
- Tenant
- TenantUser
- Role
- Permission
- ConsumerProfile
- ConsumerCase
- ConsumerDocument
- ConsumerLegalReport
- LawyerProfile
- LawyerReviewRequest
- LawyerLead
- Client
- Matter
- MatterFact
- MatterIssue
- MatterArgument
- MatterStrategyMemo
- Document
- DocumentVersion
- Folder
- TimeEntry
- TimerSession
- Invoice
- Payment
- Subscription
- TrustAccount
- TrustLedgerEntry
- Task
- CalendarEvent
- LegalAuthority
- CaseLawMetadata
- AICitation
- AIOutput
- AIUsageLog
- AIAgent
- AgentJob
- AuditLog
- Notification
- CountryPricing
- CountryCompliancePolicy

---

# 14. Prisma Schema Foundation

Cursor should add/merge these models into the existing schema rather than blindly replacing existing models.

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  phone           String?
  name            String?
  userType        String   @default("CONSUMER")
  countryCode     String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Tenant {
  id              String   @id @default(cuid())
  name            String
  type            String   @default("LAW_FIRM")
  primaryCountry  String
  defaultCurrency String
  billingPlan     String?
  dataRegion      String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model TenantUser {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  role      String
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())

  @@unique([tenantId, userId])
  @@index([tenantId])
  @@index([userId])
}

model ConsumerProfile {
  id                 String   @id @default(cuid())
  userId             String   @unique
  countryCode         String
  stateOrCounty       String?
  preferredLanguage   String   @default("en")
  subscriptionStatus  String   @default("FREE")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model ConsumerCase {
  id              String   @id @default(cuid())
  userId          String
  countryCode     String
  jurisdiction    String?
  issueType       String
  title           String
  facts           String?
  desiredOutcome  String?
  urgencyLevel    String   @default("LOW")
  riskScore       Float?
  status          String   @default("DRAFT")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([countryCode, issueType])
}

model ConsumerDocument {
  id              String   @id @default(cuid())
  userId          String
  consumerCaseId  String
  fileName        String
  fileUrl         String
  mimeType        String?
  fileSizeBytes   Int?
  documentType    String?
  extractedText   String?
  aiSummary       String?
  ocrStatus       String   @default("PENDING")
  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([consumerCaseId])
}

model ConsumerLegalReport {
  id                  String   @id @default(cuid())
  userId              String
  consumerCaseId       String
  countryCode          String
  reportType           String
  title                String
  contentMarkdown      String
  citations            Json?
  riskLevel            String?
  requiresLawyer       Boolean @default(false)
  lawyerReviewStatus   String   @default("NOT_REQUESTED")
  reviewedByLawyerId   String?
  createdAt            DateTime @default(now())

  @@index([userId])
  @@index([consumerCaseId])
}

model LawyerProfile {
  id               String   @id @default(cuid())
  userId           String   @unique
  tenantId         String?
  countryCode      String
  barNumber        String?
  verified         Boolean  @default(false)
  verificationStatus String @default("PENDING")
  practiceAreas    Json
  jurisdictions    Json
  languages        Json
  consultationFee  Decimal? @db.Decimal(10,2)
  currency         String
  acceptsLeads     Boolean @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model LawyerReviewRequest {
  id                  String   @id @default(cuid())
  consumerCaseId       String
  consumerReportId     String?
  userId              String
  countryCode          String
  jurisdiction         String?
  issueType            String
  status               String   @default("OPEN")
  assignedLawyerId     String?
  assignedTenantId     String?
  price                Decimal  @db.Decimal(10,2)
  currency             String
  createdAt            DateTime @default(now())
  completedAt          DateTime?

  @@index([countryCode, issueType, status])
}

model Matter {
  id               String   @id @default(cuid())
  tenantId          String
  clientId          String?
  title             String
  countryCode       String
  jurisdiction      String?
  courtName         String?
  courtLevel        String?
  caseNumber        String?
  practiceArea      String
  matterType        String
  status            String   @default("OPEN")
  stage             String?
  factsSummary      String?
  legalIssues       Json?
  desiredOutcome    String?
  opposingParty     String?
  riskScore         Float?
  aiConfidenceScore Float?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([countryCode, practiceArea])
}

model MatterFact {
  id                String   @id @default(cuid())
  tenantId           String
  matterId           String
  factText           String
  sourceType         String
  sourceId           String?
  confidence         Float    @default(0.5)
  isDisputed          Boolean  @default(false)
  approvedByLawyer   Boolean  @default(false)
  createdAt          DateTime @default(now())

  @@index([tenantId, matterId])
}

model AIOutput {
  id                    String   @id @default(cuid())
  userId                String?
  tenantId              String?
  consumerCaseId         String?
  matterId              String?
  mode                  String
  taskType              String
  promptHash            String?
  outputMarkdown        String
  citations             Json?
  confidenceScore       Float?
  riskLevel             String?
  requiresLawyerReview  Boolean  @default(false)
  approvedByLawyerId    String?
  createdAt             DateTime @default(now())

  @@index([tenantId])
  @@index([userId])
  @@index([consumerCaseId])
  @@index([matterId])
}

model AIUsageLog {
  id              String   @id @default(cuid())
  userId          String?
  tenantId        String?
  consumerCaseId  String?
  matterId        String?
  taskType        String
  mode            String
  modelProvider   String
  modelName       String
  inputTokens     Int      @default(0)
  outputTokens    Int      @default(0)
  costUsd         Decimal? @db.Decimal(10,4)
  latencyMs       Int?
  status          String
  error           String?
  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([userId])
  @@index([createdAt])
}

model LegalAuthority {
  id              String   @id @default(cuid())
  countryCode     String
  jurisdiction    String?
  authorityType   String
  title           String
  citation        String?
  court           String?
  courtLevel      String?
  decisionDate    DateTime?
  sourceUrl       String?
  sourceName      String
  sourceLicense   String?
  fullText        String?
  summary         String?
  holding         String?
  topics          Json
  practiceAreas   Json
  embeddingStatus String   @default("PENDING")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([countryCode, jurisdiction])
  @@index([authorityType])
  @@index([citation])
}

model AICitation {
  id              String   @id @default(cuid())
  userId          String?
  tenantId        String?
  consumerCaseId  String?
  matterId        String?
  aiOutputId      String
  authorityId     String?
  documentId      String?
  sourceUrl       String?
  quotedText      String?
  paragraphRef    String?
  confidence      Float    @default(0.5)
  createdAt       DateTime @default(now())

  @@index([aiOutputId])
  @@index([authorityId])
}

model EmbeddingChunk {
  id              String   @id @default(cuid())
  tenantId        String?
  userId          String?
  consumerCaseId  String?
  matterId        String?
  documentId      String?
  authorityId     String?
  countryCode     String?
  jurisdiction    String?
  practiceArea    String?
  chunkText       String
  chunkType       String
  sourceTitle     String
  sourceUrl       String?
  paragraphRef    String?
  pageNumber      Int?
  embedding       Unsupported("vector")?
  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([userId])
  @@index([authorityId])
  @@index([countryCode, jurisdiction])
}

model Subscription {
  id                      String   @id @default(cuid())
  userId                  String?
  tenantId                String?
  userType                String
  countryCode             String
  currency                String
  planId                  String
  status                  String
  currentPeriodStart      DateTime?
  currentPeriodEnd        DateTime?
  cancelAtPeriodEnd       Boolean  @default(false)
  paymentProvider         String
  providerCustomerId      String?
  providerSubscriptionId  String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@index([userId])
  @@index([tenantId])
}

model Payment {
  id                  String   @id @default(cuid())
  userId              String?
  tenantId            String?
  countryCode          String
  currency             String
  amount               Decimal @db.Decimal(10,2)
  paymentProvider      String
  providerPaymentId    String?
  status               String
  purpose              String
  metadata             Json?
  createdAt            DateTime @default(now())

  @@index([userId])
  @@index([tenantId])
  @@index([status])
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  tenantId    String?
  action      String
  entityType  String
  entityId    String?
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([tenantId])
  @@index([userId])
  @@index([createdAt])
}
```

---

# 15. Pricing Strategy

## 15.1 Pricing Regions

Use local currency and purchasing power.

### US Pricing

Consumer:

- Free preview: 3 previews/month
- Basic: $9.99/month
- Plus: $19.99/month
- Pro: $49/month
- Pay-per-report: $19 to $99
- Lawyer-reviewed report: $99 to $499

Lawyer:

- Solo: $99/month
- Small Firm: $299/month
- Growth Firm: $999/month
- Enterprise: custom

### India Pricing

Consumer:

- Free preview: 3 previews/month
- Basic: ₹299/month
- Plus: ₹799/month
- Pro: ₹1,999/month
- Pay-per-report: ₹199 to ₹1,999
- Lawyer-reviewed report: ₹1,999 to ₹19,999

Lawyer:

- Solo: ₹2,999/month
- Small Firm: ₹14,999/month
- Growth Firm: ₹49,999/month
- Enterprise: custom

### Kenya Pricing

Consumer:

- Free preview: 3 previews/month
- Basic: KES 299/month
- Plus: KES 799/month
- Pro: KES 1,999/month
- Pay-per-report: KES 500 to KES 5,000
- Lawyer-reviewed report: KES 5,000 to KES 50,000

Lawyer:

- Solo: KES 4,999/month
- Small Firm: KES 19,999/month
- Growth Firm: KES 79,999/month
- Enterprise: custom

## 15.2 Lawyer Trial

Lawyers get a 14-day free trial but must add payment info.

Trial includes:

- 3 users
- 5 matters
- 10 documents
- 3 research memos
- 3 strategy memos
- Limited AI credits
- Billing after trial unless canceled

## 15.3 AI Credits

AI credits make the system profitable.

Suggested credit usage:

- Consumer preview: 1 credit
- Consumer full report: 20 credits
- Document analysis: 15 credits
- Draft letter: 10 credits
- Lawyer research memo: 30 credits
- Lawyer strategy memo: 40 credits
- Opponent filing analysis: 40 credits
- Bulk document review: 100+ credits

---

# 16. Payment Providers

## 16.1 US/UK

- Stripe

## 16.2 India

- Razorpay
- UPI
- Cards
- Net banking

## 16.3 Kenya

- M-Pesa STK Push
- Cards via Stripe or local PSP

## 16.4 Payment Abstraction

In `legal_backend`:

```text
src/payments/payment-gateway.interface.ts
src/payments/stripe.service.ts
src/payments/razorpay.service.ts
src/payments/mpesa.service.ts
src/payments/payment-webhook.controller.ts
```

---

# 17. Environment Variables

## 17.1 `legal_web/.env.example`

```env
NEXT_PUBLIC_APP_NAME="Umbrella"
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_DEFAULT_COUNTRY=IN
NEXT_PUBLIC_ENABLE_CONSUMER_APP=true
NEXT_PUBLIC_ENABLE_LAWYER_OS=true
NEXT_PUBLIC_ENABLE_MARKETPLACE=true
NEXT_PUBLIC_ENABLE_LEGAL_RESEARCH=true
NEXT_PUBLIC_ENABLE_PAYMENTS=true
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

## 17.2 `legal_backend/.env.example`

```env
NODE_ENV=development
PORT=4000
APP_NAME="Umbrella"
APP_URL=http://localhost:3000
API_URL=http://localhost:4000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_odaflow
DIRECT_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_odaflow
REDIS_URL=redis://localhost:6379

JWT_SECRET=change_me
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=change_me
REFRESH_TOKEN_EXPIRES_IN=30d
SESSION_COOKIE_SECRET=change_me

CORS_ORIGINS=http://localhost:3000,http://localhost:8080

AI_PROVIDER=openai
OPENAI_API_KEY=
AI_FAST_MODEL=gpt-4.1-mini
AI_REASONING_MODEL=gpt-4.1
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_MAX_MONTHLY_TENANT_COST_USD=500
AI_MAX_MONTHLY_CONSUMER_COST_USD=25
AI_REQUIRE_CITATIONS=true
AI_REQUIRE_APPROVAL_FOR_LEGAL_DRAFTS=true
AI_REQUIRE_APPROVAL_FOR_CLIENT_MESSAGES=true
AI_CONSUMER_DISCLAIMER_REQUIRED=true

VECTOR_PROVIDER=pgvector
ENABLE_OPENSEARCH=false
OPENSEARCH_URL=
OPENSEARCH_USERNAME=
OPENSEARCH_PASSWORD=

S3_PROVIDER=aws
S3_BUCKET=legal-odaflow-dev
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_CDN_URL=

OCR_PROVIDER=azure
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=
AZURE_DOCUMENT_INTELLIGENCE_KEY=
AWS_TEXTRACT_REGION=
AWS_TEXTRACT_ACCESS_KEY_ID=
AWS_TEXTRACT_SECRET_ACCESS_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_ENV=sandbox

EMAIL_PROVIDER=resend
RESEND_API_KEY=
SENDGRID_API_KEY=
EMAIL_FROM=no-reply@legalbyodaflow.com

SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

SENTRY_DSN=
LOG_LEVEL=debug
ENABLE_AUDIT_LOGS=true
ENABLE_RATE_LIMITING=true
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=120

ENABLE_CONSUMER_APP=true
ENABLE_LAWYER_OS=true
ENABLE_LAWYER_MARKETPLACE=true
ENABLE_LEGAL_RESEARCH=true
ENABLE_AI_AGENTS=true
ENABLE_DOCUMENT_OCR=true
ENABLE_PDF_EXPORT=true
REQUIRE_PAYMENT_METHOD_FOR_LAWYER_TRIAL=true
DEFAULT_CONSUMER_FREE_PREVIEWS=3
```

## 17.3 `legal_app/.env.example`

```env
APP_NAME=Umbrella
API_URL=http://localhost:4000
DEFAULT_COUNTRY=IN
ENABLE_CONSUMER_APP=true
ENABLE_LAWYER_MODE=true
ENABLE_DOCUMENT_UPLOAD=true
ENABLE_PUSH_NOTIFICATIONS=true
SENTRY_DSN=
FIREBASE_PROJECT_ID=
STRIPE_PUBLISHABLE_KEY=
RAZORPAY_KEY_ID=
```

---

# 18. Backend Module Structure

In `legal_backend`, create:

```text
src/
  main.ts
  app.module.ts
  config/
  common/
    guards/
    decorators/
    filters/
    interceptors/
    utils/
  auth/
  users/
  tenants/
  permissions/
  consumers/
  lawyers/
  marketplace/
  matters/
  clients/
  documents/
  research/
  ai/
    ai-gateway.service.ts
    ai-policy.service.ts
    ai-usage.service.ts
    prompts/
    guards/
    rag/
    agents/
  billing/
  payments/
  subscriptions/
  reports/
  notifications/
  audit/
  admin/
  jobs/
  health/
```

---

# 19. Web Module Structure

In `legal_web`, create:

```text
app/
  page.tsx
  ask/page.tsx
  legal-issue-checker/page.tsx
  upload-document/page.tsx
  pricing/page.tsx
  lawyers/page.tsx
  for-lawyers/page.tsx
  legal-guides/[country]/[slug]/page.tsx
  consumer/
  app/
  admin/
components/
  ui/
  marketing/
  consumer/
  lawyer/
  admin/
  reports/
  research/
  payments/
lib/
  api/
  auth/
  pricing/
  legal/
  validations/
  utils/
  analytics/
```

---

# 20. Flutter App Structure

In `legal_app`, create:

```text
lib/
  main.dart
  app.dart
  core/
    config/
    network/
    auth/
    storage/
    theme/
    routing/
    errors/
  features/
    onboarding/
    auth/
    consumer_dashboard/
    legal_issue_checker/
    consumer_cases/
    reports/
    document_upload/
    lawyer_review/
    lawyer_dashboard/
    matters/
    tasks/
    notifications/
    subscription/
```

---

# 21. Consumer UX Requirements

## 21.1 Public Homepage

Sections:

1. Hero
2. Country selector
3. “What legal problem are you facing?”
4. Free legal issue checker
5. How it works
6. Example report preview
7. Upload a document demo
8. Lawyer-reviewed upgrade
9. Pricing
10. For lawyers CTA
11. Trust and safety
12. FAQ

## 21.2 Hero Copy

Headline:

```text
Understand your legal problem before you spend thousands on a lawyer.
```

Subheadline:

```text
Get country-specific legal guidance, document explanations, risk analysis, draft letters, and lawyer-reviewed options when you need them.
```

CTA:

```text
Check My Legal Issue
```

Secondary CTA:

```text
For Lawyers
```

## 21.3 Legal Issue Checker

Must be structured, not a generic chat.

Flow:

1. Select country
2. Select legal issue type
3. Explain what happened
4. Select date/urgency
5. Add parties involved
6. Add desired outcome
7. Upload document optional
8. Generate free preview
9. Signup/paywall for full report

## 21.4 Free Preview Output

Show only:

- What this may involve
- Important questions
- Documents needed
- Urgency level
- Whether lawyer review may be needed
- Upgrade CTA

Do not show:

- Full legal strategy
- Detailed case law
- Full citations
- Downloadable PDF
- Full draft letters

## 21.5 Paid Report UI

Report sections:

- Situation summary
- Legal issue classification
- Jurisdiction context
- Relevant legal principles
- Strengths
- Risks
- Evidence needed
- Options
- Suggested next steps
- Questions to ask a lawyer
- Draft letter if included
- Sources
- Disclaimer

Always show CTA:

```text
Get this reviewed by a lawyer
```

---

# 22. Lawyer OS UX Requirements

## 22.1 Lawyer Dashboard

Cards:

- Active matters
- Deadlines this week
- New leads
- AI drafts pending review
- Unbilled time
- Overdue invoices
- High-risk matters
- Recent documents
- AI usage/cost

## 22.2 Matter Detail

Tabs:

- Overview
- Timeline
- Facts
- Issues
- Documents
- Tasks
- Calendar
- Billing
- AI Copilot
- Strategy
- Research
- Client portal
- Audit

## 22.3 AI Matter Tab

Actions:

- Generate matter summary
- Extract facts
- Identify legal issues
- Find missing evidence
- Research similar cases
- Generate strategy memo
- Draft client update
- Draft filing
- Analyze opponent filing
- Suggest time entries

## 22.4 Lead Inbox

Lawyer sees:

- Consumer issue type
- Country/jurisdiction
- Urgency
- AI summary
- Documents uploaded
- Budget range
- Report preview
- Accept lead
- Decline lead
- Request more info
- Convert to client/matter

---

# 23. AI Prompt Templates

## 23.1 Consumer Free Preview Prompt

```text
You are a legal information assistant for ordinary people.

User type: Consumer
Country: {{country}}
Jurisdiction: {{jurisdiction}}
Issue type: {{issueType}}
Facts: {{facts}}

Rules:
- Do not claim to be a lawyer.
- Do not provide final legal advice.
- Do not guarantee outcomes.
- Do not invent laws or cases.
- Use plain language.
- Identify missing information.
- Identify urgency.
- Recommend lawyer review for high-risk matters.
- Keep output limited because this is a free preview.

Return JSON:
{
  "possibleIssue": "",
  "plainEnglishSummary": "",
  "importantQuestions": [],
  "documentsNeeded": [],
  "urgencyLevel": "LOW|MEDIUM|HIGH|URGENT",
  "lawyerReviewRecommended": true,
  "upgradeReason": "",
  "disclaimer": ""
}
```

## 23.2 Consumer Paid Report Prompt

```text
You are a legal guidance assistant.

User type: Consumer
Country: {{country}}
Jurisdiction: {{jurisdiction}}
Issue type: {{issueType}}
Facts: {{facts}}
Retrieved sources: {{sources}}
Uploaded document summaries: {{documents}}

Rules:
- Provide legal information and risk analysis, not final legal advice.
- Use only retrieved legal sources when referring to law/cases.
- Do not invent citations.
- Explain uncertainty.
- Highlight deadlines.
- Recommend lawyer review if high-risk.
- Use plain language.
- Include disclaimer.

Return markdown with:
# Legal Guidance Report
## Situation Summary
## Legal Issue Classification
## Jurisdiction Context
## Relevant Legal Principles
## Strengths
## Risks
## Evidence Needed
## Options
## Suggested Next Steps
## Questions to Ask a Lawyer
## Sources
## Disclaimer
```

## 23.3 Lawyer Research Prompt

```text
You are a legal research assistant for a licensed lawyer.

Country: {{country}}
Jurisdiction: {{jurisdiction}}
Court level: {{courtLevel}}
Matter type: {{matterType}}
Research question: {{question}}
Matter facts: {{facts}}
Retrieved authorities: {{authorities}}

Rules:
- Use only retrieved authorities.
- Do not invent citations.
- Separate binding authority from persuasive authority.
- Explain why each case applies or is distinguishable.
- Mention uncertainty.
- Provide strategy options, not guaranteed outcomes.

Return:
1. Short answer
2. Applicable law
3. Strong authorities
4. Weak/distinguishable authorities
5. Application to matter facts
6. Strategy options
7. Risks
8. Missing information
9. Citations
```

---

# 24. Security Requirements

## 24.1 Authentication

Support:

- Email/password
- Magic link optional
- Phone OTP optional
- Google OAuth optional
- MFA for lawyers/admins
- Refresh tokens
- Device/session management

## 24.2 Authorization

Implement:

- RBAC
- Tenant guards
- Matter guards
- Document guards
- Ethical walls
- Admin permission scopes

## 24.3 Data Security

Required:

- Encryption in transit
- Encryption at rest
- Signed S3 URLs
- Private buckets
- Audit logs
- Rate limiting
- IP/device logs
- Secure password hashing
- Secrets through env only
- No secrets in frontend

## 24.4 AI Security

- No cross-tenant retrieval
- No consumer-to-lawyer data sharing without consent
- No AI training on user data by default
- AI output logs stored
- Citations stored
- Cost tracking
- Prompt injection checks for uploaded documents

---

# 25. Scalability Strategy

## 25.1 Affordable Initial Scale

Use:

- Vercel for `legal_web`
- Railway/Fly.io/Render/AWS ECS for `legal_backend`
- Managed Postgres
- Redis managed instance
- S3 storage
- pgvector in Postgres
- Background workers with BullMQ

Avoid initially:

- Kubernetes
- Dedicated vector DB unless needed
- Over-complicated microservices
- Expensive always-on GPU hosting

## 25.2 Scale Milestones

### 0 to 10k users

- Single backend app + worker
- Managed Postgres
- Redis
- pgvector
- S3

### 10k to 100k users

- Separate API and worker services
- Read replicas
- Queue prioritization
- CDN aggressively
- Cache legal guides and public content
- Rate-limit AI previews
- Batch embeddings

### 100k to 1M users

- Split services:
  - Auth/user service
  - Consumer case service
  - Lawyer OS service
  - AI orchestration service
  - Research ingestion service
  - Billing service
- OpenSearch for legal research
- Separate analytics warehouse
- Dedicated job workers
- Multi-region CDN

### 1M+ users

- Regional data residency
- Sharded queues
- Tenant partitioning
- Separate legal authority search cluster
- AI provider cost optimization
- High-volume caching
- Enterprise private deployments

## 25.3 Cost Optimization

- Free previews use cheap model
- Paid reports use premium model
- Cache common legal guidance by country/issue
- Cache legal source retrieval
- Pre-embed legal authorities
- Use async document processing
- Compress uploaded files
- Limit free document upload
- AI credit system
- Rate limits by plan
- Queue low-priority jobs
- Use pgvector before paid vector DB
- Store extracted text separately to avoid repeated OCR

---

# 26. Observability

Implement from day one:

- Sentry errors
- Request logs
- AI usage logs
- Payment webhook logs
- Audit logs
- Job queue dashboard
- Health endpoints
- Admin system health page

Health routes:

```text
GET /health
GET /health/db
GET /health/redis
GET /health/storage
GET /health/ai
```

---

# 27. Build Order for Cursor

## Phase 1 — Foundation

Build:

1. Repo setup for `legal_web`, `legal_backend`, `legal_app`
2. Env examples
3. Docker compose for local Postgres + Redis
4. Prisma schema foundation
5. Auth
6. User types
7. Tenant model
8. RBAC/guards
9. Audit logs
10. Country config
11. Pricing config

## Phase 2 — Consumer Wedge

Build:

1. Public homepage
2. Country selector
3. Legal issue checker
4. Free preview AI route
5. Consumer signup
6. Consumer dashboard
7. Consumer case creation
8. Paid report generation
9. Report viewer
10. PDF export
11. Payment provider abstraction
12. Stripe/Razorpay/M-Pesa placeholders

## Phase 3 — Document Intelligence

Build:

1. Document upload
2. Secure S3 storage
3. OCR job queue
4. Extracted text storage
5. Document summary
6. Document issue detection
7. Document-based paid report

## Phase 4 — Lawyer OS Core

Build:

1. Lawyer onboarding
2. Payment method required trial
3. Firm dashboard
4. Matter management
5. Client CRM
6. Documents
7. Tasks
8. Calendar
9. Time tracking
10. Billing/invoices
11. Client portal stub

## Phase 5 — AI Lawyer OS

Build:

1. AI gateway
2. AI usage logging
3. Matter AI tab
4. Matter summary agent
5. Fact extraction agent
6. Legal research page
7. Legal authority model
8. Research memo generator
9. Strategy memo generator
10. Citation guardrails

## Phase 6 — Marketplace

Build:

1. Lawyer profiles
2. Lawyer verification
3. Lawyer review requests
4. Lead inbox
5. Lead routing
6. Convert consumer case to lawyer matter
7. Lawyer-reviewed report workflow
8. Marketplace payments

## Phase 7 — Production Hardening

Build:

1. Rate limiting
2. Abuse detection
3. AI cost limits
4. Admin console
5. Payment webhooks
6. Email notifications
7. Push notifications
8. Sentry
9. Health checks
10. Backup/export flows
11. Security review checklist

---

# 28. Cursor Rules

Cursor must follow these rules:

1. Do not remove existing working code without asking.
2. Prefer incremental implementation.
3. Every new API must validate input with DTO/Zod/class-validator.
4. Every tenant API must enforce tenant guard.
5. Every AI output must be logged.
6. Every paid feature must check subscription/credits.
7. Every legal output must include jurisdiction.
8. Consumer legal outputs must include disclaimer.
9. No frontend secrets.
10. All env variables must be added to `.env.example`.
11. Build reusable components.
12. Use mobile-responsive UI.
13. Keep public pages SEO-friendly.
14. Use background jobs for OCR, embeddings, reports, and long AI tasks.
15. Keep AI provider abstracted.

---

# 29. Cursor Master Prompt

Use this prompt inside Cursor at the root containing `legal_web`, `legal_backend`, and `legal_app`:

```text
You are building Umbrella as a production-grade, Series A-quality, dual-sided AI legal platform.

Folders:
- legal_web = Next.js web platform
- legal_backend = NestJS backend
- legal_app = Flutter mobile app

Read this entire spec before coding.

Main goal:
Build a scalable, affordable, secure legal platform for:
1. Consumers who need legal guidance, document explanations, paid legal reports, and lawyer-reviewed upgrades.
2. Lawyers and law firms who need an AI-native legal OS with matters, clients, documents, billing, time tracking, legal research, drafting, strategy, AI agents, and lead marketplace.

Primary launch markets:
- India
- United States

Secondary:
- Kenya
- United Kingdom

Implementation rules:
- Build production architecture, not MVP shortcuts.
- Use modular code.
- Do not hardcode secrets.
- Add every env variable to .env.example.
- Enforce tenant isolation.
- Enforce user permissions.
- Log every AI call.
- Track AI usage and cost.
- Consumer legal outputs must include disclaimer.
- AI must never invent legal citations.
- Lawyer legal research must cite retrieved authorities only.
- Payment methods must be abstracted by country.
- Use background jobs for long tasks.
- Build mobile-responsive web UI.
- Build Flutter app using clean architecture.
- Keep scale affordable: Postgres + pgvector first, Redis queues, S3 storage, OpenSearch later.

Start with Phase 1 foundation, then Phase 2 consumer wedge, then Phase 3 document intelligence, then Phase 4 lawyer OS, then Phase 5 AI lawyer OS, then Phase 6 marketplace, then Phase 7 hardening.

Before coding each phase:
1. Inspect existing files.
2. Create a small implementation plan.
3. Implement files carefully.
4. Add types and validation.
5. Add tests or testable service methods where practical.
6. Update env examples.
7. Summarize what changed.
```

---

# 30. Series A Quality Checklist

Before calling this production-ready, ensure:

## Product

- Consumer free preview works
- Paid report works
- Document upload works
- Lawyer-reviewed report flow works
- Lawyer OS trial works
- Matter management works
- AI research works
- Strategy memo works
- Billing/subscription works
- Admin console works

## AI

- AI gateway works
- AI usage logged
- AI cost tracked
- Citations stored
- Consumer disclaimer enforced
- Jurisdiction required
- No uncited legal claims in research mode
- RAG retrieval permissioned

## Security

- Auth secure
- RBAC working
- Tenant isolation tested
- Ethical walls tested
- Signed URLs
- Audit logs
- Rate limiting
- Payment webhook signature verification

## Scale

- Background jobs
- Redis queues
- DB indexes
- Pagination everywhere
- File upload limits
- AI credit limits
- Caching
- CDN-ready storage

## Business

- Country pricing
- Subscriptions
- AI credits
- Lawyer trials with payment method
- Pay-per-report
- Lawyer-reviewed upgrades
- Lead marketplace

## Investor Readiness

- Clear consumer wedge
- Clear lawyer SaaS monetization
- Marketplace network effect
- AI moat through matter memory + legal authority retrieval
- Country expansion architecture
- Usage/cost metrics
- Conversion analytics
- Retention analytics

---

# 31. Final Product Promise

Umbrella becomes:

> The legal platform for everyone — affordable legal guidance for ordinary people, and an AI-native operating system for lawyers and law firms.

The first viral wedge:

> Upload a legal notice or explain your issue. Get a plain-English legal risk report in minutes.

The high-margin lawyer wedge:

> Turn every matter into structured facts, legal issues, cited research, strategy memos, drafts, deadlines, and billable work — automatically.

