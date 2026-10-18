# Umbrella Engineering Handbook — Chapter Index

**Version:** 1.0.0
**Owner:** Engineering
**Change Process:** PR against this file + corresponding handbook chapter update required. All changes must be reviewed by a senior engineer before merge.

---

## Overview

The Umbrella Engineering Handbook is the canonical reference for how the Umbrella Legal Operating System is built, operated, and evolved. Every architectural decision, coding standard, AI feature, and operational procedure is governed by one of the 69 chapters below.

When implementing any feature, consult the relevant chapter(s) before writing code. When a decision contradicts the handbook, either update the handbook via PR (preferred) or file an ADR documenting the deviation.

---

## Chapters

### Part I — Platform Foundation

| # | Chapter | Description |
|---|---------|-------------|
| 00 | [Vision](../../Umbrella_Engineering_Handbook/00-vision.md) | Platform north-star, product vision, core design principles |
| 01 | [Platform Architecture](../../Umbrella_Engineering_Handbook/01-platform-architecture.md) | Modular monolith topology, service boundaries, shared kernel |
| 02 | [Legal Intelligence Engine](../../Umbrella_Engineering_Handbook/02-legal-intelligence-engine.md) | Shared intelligence layer, LegalRequestContext, pipeline contracts |
| 03 | [AI Agent Framework](../../Umbrella_Engineering_Handbook/03-ai-agent-framework.md) | Agent loop, tool registry, ReAct pattern, workspace contract |
| 04 | [Matter Intelligence](../../Umbrella_Engineering_Handbook/04-matter-intelligence.md) | Matter brain, issue graph, fact lifecycle, timeline |
| 05 | [Knowledge Graph](../../Umbrella_Engineering_Handbook/05-knowledge-graph.md) | Entity model, relationship types, graph traversal, staleness |

### Part II — Core AI Features

| # | Chapter | Description |
|---|---------|-------------|
| 06 | [Research Engine v3](../../Umbrella_Engineering_Handbook/06-research-engine-v3.md) | Multi-source research pipeline, citation graph, confidence scoring |
| 07 | [Document Drafting v3](../../Umbrella_Engineering_Handbook/07-document-drafting-v3.md) | DraftWorkspace, section-level generation, verification loop |
| 08 | [Issue Checker](../../Umbrella_Engineering_Handbook/08-issue-checker.md) | Issue extraction, classification, severity grading |
| 09 | [Document Review](../../Umbrella_Engineering_Handbook/09-document-review.md) | Clause tagging, risk scoring, redline generation |
| 10 | [Contract Intelligence](../../Umbrella_Engineering_Handbook/10-contract-intelligence.md) | Contract model, obligation extraction, deviation detection |
| 11 | [Legal Memory](../../Umbrella_Engineering_Handbook/11-legal-memory.md) | Firm memory, matter memory, preference learning, recall API |
| 12 | [Verification Engine](../../Umbrella_Engineering_Handbook/12-verification-engine.md) | Citation verification, hallucination detection, confidence calibration |
| 13 | [Cost Optimization](../../Umbrella_Engineering_Handbook/13-cost-optimization.md) | Token budgets, model tiering, caching strategy, cost attribution |
| 14 | [Model Routing](../../Umbrella_Engineering_Handbook/14-model-routing.md) | Dynamic model selection, fallback chains, policy enforcement |

### Part III — Engineering Standards

| # | Chapter | Description |
|---|---------|-------------|
| 15 | [Backend Architecture](../../Umbrella_Engineering_Handbook/15-backend-architecture.md) | NestJS module structure, provider patterns, guards, interceptors |
| 16 | [Web Architecture](../../Umbrella_Engineering_Handbook/16-web-architecture.md) | Next.js App Router, server components, client boundaries, state |
| 17 | [Mobile Architecture](../../Umbrella_Engineering_Handbook/17-mobile-architecture.md) | Flutter architecture, feature structure, offline-first patterns |
| 18 | [API Standards](../../Umbrella_Engineering_Handbook/18-api-standards.md) | REST conventions, versioning, error envelopes, pagination |
| 19 | [Database Design](../../Umbrella_Engineering_Handbook/19-database-design.md) | PostgreSQL + Prisma schema patterns, tenancy, soft delete, audit |
| 20 | [Search and RAG](../../Umbrella_Engineering_Handbook/20-search-and-rag.md) | OpenSearch lexical, pgvector semantic, hybrid ranking, chunking |
| 21 | [Security](../../Umbrella_Engineering_Handbook/21-security.md) | Auth, authz, tenant isolation, secret management, OWASP |
| 22 | [Testing](../../Umbrella_Engineering_Handbook/22-testing.md) | Unit, integration, E2E, AI eval harness, coverage targets |
| 23 | [Deployment](../../Umbrella_Engineering_Handbook/23-deployment.md) | CI/CD pipeline, Docker, Kubernetes, canary releases |
| 24 | [Roadmap](../../Umbrella_Engineering_Handbook/24-roadmap.md) | Phase milestones, feature prioritization, capacity planning |
| 25 | [Cursor Rules](../../Umbrella_Engineering_Handbook/25-cursor-rules.md) | AI coding assistant conventions and guardrails |
| 26 | [Engineering Principles](../../Umbrella_Engineering_Handbook/26-engineering-principles.md) | Core engineering values, decision heuristics, technical debt policy |

### Part IV — Operations

| # | Chapter | Description |
|---|---------|-------------|
| 27 | [Observability and Product Analytics](../../Umbrella_Engineering_Handbook/27-observability-and-product-analytics.md) | Logging, metrics, tracing, product events, dashboards |
| 28 | [Legal Update Monitoring](../../Umbrella_Engineering_Handbook/28-legal-update-monitoring.md) | Source crawling, change detection, stale content alerts |
| 29 | [Collaboration and Permissions](../../Umbrella_Engineering_Handbook/29-collaboration-and-permissions.md) | RBAC model, workspace sharing, permission inheritance |
| 30 | [Client Portal](../../Umbrella_Engineering_Handbook/30-client-portal.md) | Portal API, document sharing, client-facing UX contracts |
| 31 | [Billing, Credits and Usage](../../Umbrella_Engineering_Handbook/31-billing-credits-and-usage.md) | AICreditLedger, Stripe integration, subscription tiers |
| 32 | [Administration and Governance](../../Umbrella_Engineering_Handbook/32-administration-and-governance.md) | Admin console, audit trail, compliance controls |
| 33 | [Jurisdiction and Localization](../../Umbrella_Engineering_Handbook/33-jurisdiction-and-localization.md) | Jurisdiction model, locale handling, i18n architecture |
| 34 | [Support and Incident Operations](../../Umbrella_Engineering_Handbook/34-support-and-incident-operations.md) | Incident playbooks, SLA tiers, escalation paths |

### Part V — Product Domains

| # | Chapter | Description |
|---|---------|-------------|
| 35 | [Unified Product and Intelligence Fabric](../../Umbrella_Engineering_Handbook/35-unified-product-and-intelligence-fabric.md) | Cross-feature intelligence sharing, context propagation |
| 36 | [World-Class Web UX](../../Umbrella_Engineering_Handbook/36-world-class-web-ux.md) | Design system, component library, accessibility, performance |
| 37 | [World-Class Mobile UX](../../Umbrella_Engineering_Handbook/37-world-class-mobile-ux.md) | Flutter design tokens, animations, gesture patterns |
| 38 | [Agentic Workspaces and Orchestration](../../Umbrella_Engineering_Handbook/38-agentic-workspaces-and-orchestration.md) | WorkflowRun, step orchestration, human-in-the-loop |
| 39 | [Competitive Completeness and Differentiation](../../Umbrella_Engineering_Handbook/39-competitive-completeness-and-differentiation.md) | Feature parity targets, moat strategy |
| 40 | [Dual-Audience Platform Architecture](../../Umbrella_Engineering_Handbook/40-dual-audience-platform-architecture.md) | Consumer vs professional persona model |
| 41 | [Individual Legal Services Experience](../../Umbrella_Engineering_Handbook/41-individual-legal-services-experience.md) | Consumer flow, guided intake, outcome-first UX |
| 42 | [Lawyer and Firm Operating System](../../Umbrella_Engineering_Handbook/42-lawyer-and-firm-operating-system.md) | Firm workspace, matter management, team features |
| 43 | [Professional Services Marketplace and Handoff](../../Umbrella_Engineering_Handbook/43-professional-services-marketplace-and-handoff.md) | Lawyer matching, handoff protocol, referral tracking |
| 44 | [Consumer Trust, Safety and Regulatory Boundaries](../../Umbrella_Engineering_Handbook/44-consumer-trust-safety-and-regulatory-boundaries.md) | UPL guardrails, disclaimer engine, safe harbor |
| 45 | [Legal Strategy Engine](../../Umbrella_Engineering_Handbook/45-legal-strategy-engine.md) | Strategy recommendation, risk assessment, outcome prediction |
| 46 | [Hearing, Trial and Dispute Preparation](../../Umbrella_Engineering_Handbook/46-hearing-trial-and-dispute-preparation.md) | Hearing bundles, witness prep, timeline builder |
| 47 | [Discovery, Disclosure and Due Diligence](../../Umbrella_Engineering_Handbook/47-discovery-disclosure-and-due-diligence.md) | Document ingestion, privilege log, responsive set |
| 48 | [Communications and Meeting Intelligence](../../Umbrella_Engineering_Handbook/48-communications-and-meeting-intelligence.md) | Meeting transcription, action extraction, follow-up |
| 49 | [Negotiation and Settlement Intelligence](../../Umbrella_Engineering_Handbook/49-negotiation-and-settlement-intelligence.md) | Negotiation playbook, BATNA analysis, settlement range |

### Part VI — Advanced Platform

| # | Chapter | Description |
|---|---------|-------------|
| 50 | *(reserved)* | — |
| 51 | [Ethics, Conflicts and Professional Responsibility](../../Umbrella_Engineering_Handbook/51-ethics-conflicts-and-professional-responsibility.md) | Conflict check, ethics rules, responsibility attribution |
| 52 | [Integrations and Connector Platform](../../Umbrella_Engineering_Handbook/52-integrations-and-connector-platform.md) | Third-party connectors, webhook system, OAuth flows |
| 53 | [Import, Migration and Enterprise Onboarding](../../Umbrella_Engineering_Handbook/53-import-migration-and-enterprise-onboarding.md) | Data migration pipelines, onboarding wizard, bulk import |
| 54 | [Deadlines, Calendar and Critical Event Engine](../../Umbrella_Engineering_Handbook/54-deadlines-calendar-and-critical-event-engine.md) | Deadline calculation, calendar sync, critical alert logic |
| 55 | [Fraud, Abuse and Platform Integrity](../../Umbrella_Engineering_Handbook/55-fraud-abuse-and-platform-integrity.md) | Abuse detection, rate limiting, fraud signals |
| 56 | [Platform SDK and Ecosystem](../../Umbrella_Engineering_Handbook/56-platform-sdk-and-ecosystem.md) | Public SDK, webhook contracts, developer portal |
| 57 | [Product Governance and Release Readiness](../../Umbrella_Engineering_Handbook/57-product-governance-and-release-readiness.md) | Feature flags, release gates, definition of done |
| 58 | [Native Word, Outlook and Office Experience](../../Umbrella_Engineering_Handbook/58-native-word-outlook-and-office-experience.md) | Office Add-in architecture, sidecar pattern |
| 59 | [Transactions, Deals and Closing Management](../../Umbrella_Engineering_Handbook/59-transactions-deals-and-closing-management.md) | Deal room, closing checklist, signing flow |
| 60 | [Regulatory Compliance and Policy Management](../../Umbrella_Engineering_Handbook/60-regulatory-compliance-and-policy-management.md) | Regulatory change tracking, policy matrix, compliance posture |
| 61 | [Legal Content Licensing and Source Operations](../../Umbrella_Engineering_Handbook/61-legal-content-licensing-and-source-operations.md) | Source licensing, crawl SLAs, content refresh |
| 62 | [Records, Information and Knowledge Lifecycle](../../Umbrella_Engineering_Handbook/62-records-information-and-knowledge-lifecycle.md) | Retention policy, archival, knowledge expiry |
| 63 | [Adoption, Training and Change Management](../../Umbrella_Engineering_Handbook/63-adoption-training-and-change-management.md) | Onboarding flows, in-product guidance, change rollouts |
| 64 | [Customer Implementation and Success](../../Umbrella_Engineering_Handbook/64-customer-implementation-and-success.md) | Enterprise deployment playbook, CSM handoff |
| 65 | [Personal Legal Vault and Life Management](../../Umbrella_Engineering_Handbook/65-personal-legal-vault-and-life-management.md) | Personal document vault, life event triggers |
| 66 | [Small Business Legal Workspace](../../Umbrella_Engineering_Handbook/66-small-business-legal-workspace.md) | SMB workspace, simplified matter model, templates |
| 67 | [Forms, Questionnaires and Document Automation](../../Umbrella_Engineering_Handbook/67-forms-questionnaires-and-document-automation.md) | Form catalog, conditional logic, auto-population |
| 68 | [Legal Operations and Outside Counsel Management](../../Umbrella_Engineering_Handbook/68-legal-operations-and-outside-counsel-management.md) | Outside counsel portal, budget tracking, invoice review |
| 69 | [AI Safety, Red-Teaming and Model Governance](../../Umbrella_Engineering_Handbook/69-ai-safety-red-teaming-and-model-governance.md) | Red-team schedule, model risk tiers, governance committee |

---

## How to Use This Handbook

1. **Before implementing a feature** — find the relevant chapter and read the target state thoroughly.
2. **When the code contradicts the chapter** — either align the code with the chapter or file an ADR explaining the deviation.
3. **When a chapter is missing guidance** — open a PR to add the guidance before implementing the feature.
4. **When a chapter is wrong** — open a PR with your proposed change, tag the chapter owner, and describe the rationale.

## Change Process

All changes to any handbook chapter or to this index require:

1. A PR with the chapter change and a summary of what changed and why.
2. Review by at least one senior engineer.
3. If the change affects a live feature: an ADR filed under `docs/adr/` documenting the before/after state.
4. Update `version` in this file if any chapter adds or removes a major section.

## Versioning

| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-06-26 | Initial chapter index — all 69 chapters catalogued |
