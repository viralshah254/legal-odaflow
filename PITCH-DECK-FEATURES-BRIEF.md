# Legal by OdaFlow — Full Features Brief for Pitch Deck

**Use this document to build investor or customer pitch slides.** Each section maps to potential slides or talking points. Update as the product evolves.

---

## 1. One-liner & positioning

- **Product:** Legal by OdaFlow — modern practice management and legal CRM for law firms.
- **One-liner:** All-in-one workspace for matters, clients, tasks, billing, and AI-assisted workflows — with role-based access, meeting transcripts, and a built-in Copilot.
- **Audience:** Law firms (solo to mid-size) who want a single platform for matters, clients, finance, and team collaboration without legacy software complexity.

---

## 2. Problem & solution (slide 1–2)

**Problems we address:**
- Fragmented tools: matters in one place, billing in another, no single source of truth.
- Manual updates: status, deadlines, and client communication scattered across email and spreadsheets.
- Limited visibility: partners and finance lack a clear view of pipeline, workload, and risk.
- No AI assist: repetitive research, summarization, and task planning done manually.

**Our solution:**
- One platform: matters, clients, tasks, calendar, meetings, finance, and team in a single app.
- Role-based views: each role sees only what they need (partners, associates, finance, intake, etc.).
- Built-in AI (Copilot): summarize matters/clients, draft emails, suggest tasks, and 30/60/90 kickoff plans.
- Meeting transcripts & recording: record or upload meetings; auto transcripts and notes (Professional plan).
- Transparent pricing: feature-based plans (Starter, Professional, Enterprise) with clear upgrade paths.

---

## 3. Core product features (by area)

### 3.1 Dashboard
- **Role-specific KPIs:** Active matters, overdue critical deadlines, overdue tasks, outstanding invoices (for partners); collections, invoices, overdue (for finance).
- **Urgent alerts strip:** Critical and high-priority alerts with quick actions (complete, skip, acknowledge, navigate).
- **Team workload & monitoring:** Plan-gated (Professional); view team capacity and matter distribution.
- **Finance snapshot:** Top originators, collections this month, invoice aging (Professional for advanced reporting).
- **Urgent watchlist:** Matters at risk (critical/high) with client and risk badge.
- **Tasks, calendar, matters:** Mini-widgets linking to full lists and calendar.
- **Quick actions:** Create matter, add task, create invoice, add client, record meeting (role-gated).

### 3.2 Clients
- **Client list:** Search, filters, link to client detail.
- **New client:** Create client (type: Individual, Company, NGO, Partnership); name, email, phone, address, KYC status, portal and notifications toggles.
- **Client detail:** Overview, KYC & Compliance tab (checklist, upload table, status), Matters tab.
- **KYC & compliance:** Document checklist by client type; upload, verify, expiry; missing/expired alerts.
- **Meetings (on client):** List meetings for client; record new meeting, upload recording, import; link to meeting detail with transcript and notes.
- **Copilot:** Open Copilot from client context for summarization and “what’s missing” in one click.

### 3.3 Matters
- **Matter list:** Filters, search, link to matter detail and new matter.
- **New matter:** Create matter (ref, title, client, type, stage, status, owner, parties, key dates).
- **Matter detail:** Overview, timeline, collaborators, transfer case, request assistance, share matter, risk badge.
- **Timeline:** Events and activity on the matter.
- **Collaborators:** Who works on the matter.
- **Transfer case:** Hand off matter to another user.
- **Request assistance:** Ask for help; partner/admin can approve (alerts).
- **Share matter:** Grant read/write access to other users (matter sharing).
- **Copilot:** Summarize matter, kickoff plan (30/60/90), suggest tasks, draft emails, “what’s missing” from matter or client context.

### 3.4 Tasks
- **Task list:** Today, Overdue, Next 7 days, Completed, All; filters and role-scoped (partners see all, others see assigned).
- **New task:** Create task (title, matter/client, due date, priority, assignee, category).
- **Quick links:** To matter and task detail from list and dashboard.

### 3.5 Calendar
- **Calendar view:** Month/week-style view; create event (title, start/end, attendees, matter link).
- **Event detail:** View and edit; links to client and matter.
- **Role scope:** Partners see all events; others see own (configurable by role).

### 3.6 Meetings & transcripts (Professional plan)
- **Meetings list:** All meetings; search; link to recording, upload, or import.
- **Record meeting:** Start recording; link to client/matter; redirect to meeting detail when done.
- **Upload meeting:** Upload recording; processing status; transcript when ready.
- **Import meeting:** Connect external meeting (e.g. Zoom) — placeholder/settings link.
- **Meeting detail:** Transcript tab (speaker-labeled, timestamps), Notes tab (summary, decisions, action items), Activity/events.
- **Meeting gate:** Permissions (read, record, upload, edit, delete) by role; visible across app (e.g. client page, meetings page).

### 3.7 Alerts
- **Alert list:** All / Critical / High; cards with type, severity, assignee, due, link to matter/task/client.
- **Alert actions:** Complete, Skip, Acknowledge, Navigate; action history for audit.
- **Types:** Task due/overdue, KYC missing/expired, invoice overdue, assistance request (partner approval).

### 3.8 Finance
- **Overview:** Invoices, collections, aging; fixed costs (CRUD); expenses; claims (submit, approve/reject, mark paid); P&L; balance sheet; multi-currency.
- **Invoices:** List (from API), new invoice; link to accounting invoices.
- **Expenses:** Expenses page — list, create, by matter/client, totals; role-gated.
- **Claims:** Create claim; finance/admin approve or reject; mark paid.
- **Plan-gated:** Advanced reporting (e.g. top originators, collections, invoice aging) for Professional.

### 3.9 Accounting (under Finance)
- **Invoices:** List and new invoice (accounting flow).
- **Payments:** Placeholder (payment records).
- **Statements:** Placeholder (statement generator).

### 3.10 Team
- **Team list:** Users by role; role-dependent visibility (partners see full team, others may see subset).
- **Team workload:** Plan-gated (Professional); dashboard widget and team page.

### 3.11 Templates
- **Templates list:** General vs client-specific; by category; create, edit, delete.
- **Template editor:** Rich text; link to matter/client; categories and tags.
- **Settings – templates:** Matter types, task templates, document folders (config).

### 3.12 Copilot (AI assistant — Professional plan)
- **In-app Copilot:** Drawer (Ask, Work, Drafts, Insights, History); context-aware (current matter, client, task).
- **Ask:** Natural language; summarization, “what’s missing,” kickoff plans, task suggestions, email drafts.
- **Capabilities (mock/smart tools):**
  - Summarize matter / summarize client (with citations to matter and client).
  - What’s missing or gaps (KYC, overdue tasks, overdue invoices).
  - Matter kickoff: 30/60/90-day plan, risks, engagement letter outline.
  - Draft email (subject + body) for matter/client.
  - Propose next tasks (suggested tasks with due days and priority).
- **Work:** Action plans and suggested next steps.
- **Drafts / Insights / History:** Placeholder tabs for saved drafts, insights, and history.
- **Audit log:** Copilot audit page — all proposed/approved/executed actions for compliance (Settings → Copilot).
- **Role permissions:** Copilot access and capabilities configurable per role (e.g. view only vs propose actions).

### 3.13 Settings (Partner Admin)
- **Firm profile:** Name, industry, location, description.
- **Users:** Add, edit, delete users; assign role; search.
- **Permissions:** Roles & permissions matrix (view/edit by role).
- **Role preview:** Preview what a role sees (sidebar and access).
- **Templates config:** Matter types, task templates, document folders.
- **Notifications:** Email, SMS, in-app (config pages).
- **Billing & subscription:** Current plan (Starter/Professional/Enterprise), upgrade, plan comparison (feature-based: Copilot, transcripts, advanced reporting, client portal, API, priority support).
- **Copilot:** Link to Copilot audit log.

### 3.14 Profile & global UX
- **Profile:** View/edit name, email, phone; role display.
- **Command palette:** Cmd+K / Ctrl+K — quick nav to Clients, Matters, Tasks, Invoices, Trust, Documents; optional “Search transcripts” (role-gated).
- **Theme:** Light/dark toggle.
- **Notifications dropdown:** In-app notifications; mark read; link to alerts.
- **Role-based sidebar:** Navigation items per role (Partner Admin, Junior Partner, Associate, Paralegal, Finance, Intake, OPS_HR, Reception, Read-Only).
- **Plan gate:** Locked features show compact “Upgrade” placeholder; click opens upgrade modal (no full-page takeover).

---

## 4. Roles & permissions (slide: “Built for how firms work”)

| Role            | Dashboard | Clients | Matters | Tasks | Calendar | Meetings | Alerts | Finance | Team | Templates | Settings |
|-----------------|----------|---------|---------|-------|----------|----------|--------|---------|------|-----------|----------|
| Partner (Admin) | ✓        | ✓       | ✓       | ✓     | ✓        | ✓        | ✓      | ✓       | ✓    | ✓         | ✓        |
| Junior Partner  | ✓        | ✓       | ✓       | ✓     | ✓        | ✓        | ✓      | ✓       | ✓    | ✓         | —        |
| Associate       | ✓        | ✓       | ✓       | ✓     | ✓        | ✓        | ✓      | —       | ✓    | ✓         | —        |
| Paralegal       | ✓        | —       | ✓       | ✓     | ✓        | ✓        | ✓      | —       | —    | ✓         | —        |
| Finance         | ✓        | ✓       | ✓       | —     | —        | ✓        | —      | ✓       | —    | ✓         | —        |
| Intake          | ✓        | ✓       | ✓       | ✓     | —        | ✓        | ✓      | —       | —    | ✓         | —        |
| Ops/HR          | ✓        | —       | —       | —     | ✓        | —        | —      | —       | ✓    | ✓         | —        |
| Reception       | ✓        | ✓       | —       | —     | ✓        | —        | —      | —       | —    | ✓         | —        |
| Read-Only       | ✓        | ✓       | ✓       | ✓     | ✓        | ✓        | ✓      | ✓       | —    | ✓         | —        |

- **Permissions (examples):** View all matters, view team, view finance, create matter, assign tasks, view all tasks, view all calendar, manage settings, approve trust.
- **Meeting permissions:** Read, record, upload, edit, delete — configurable per role.
- **Copilot permissions:** Per-role (e.g. who can propose vs only view).

---

## 5. Plans & pricing (slide: “Simple, feature-based plans”)

**Starter**
- Unlimited clients & matters, tasks, calendar, matters.
- Basic reporting, email support.
- *No Copilot, no meeting transcripts.*

**Professional**
- Everything in Starter.
- **Copilot (AI assistant).**
- **Meeting transcripts & recording.**
- Advanced reporting, client portal, API access, priority support.
- *Pricing example: $25/seat/month (USD).*

**Enterprise**
- Everything in Professional.
- Custom integrations, dedicated support, SLA guarantee, on-premise option.

- **Billing:** Per-seat, monthly or annual; location-based pricing (currency); upgrade/downgrade from Settings → Billing.
- **Public pricing page:** Tiers, billing cycle, seat count, country/currency, start trial.

---

## 6. Client portal & other areas (roadmap / “Coming soon”)

- **Client portal:** Sign-in exists; portal home (document requests, matter progress, invoices) — placeholder.
- **Documents:** Document library and upload — placeholder.
- **Trust:** Trust balances, deposits, disbursements, approvals — placeholder.
- **Queues:** Intake, KYC, Billing, Trust approval, Overdue critical — placeholder cards.
- **Reports:** Export cards (Overdue Tasks, Matter Pipeline, Invoice Aging, Trust) — plan-gated; no real export yet.
- **Super admin:** Multi-tenant / platform admin — placeholder (tenants, billing, audit logs).
- **Accounting:** Payments and Statements — placeholders.

Use these for “What’s next” or “Roadmap” in the pitch.

---

## 7. Technical differentiators (optional slide)

- **Modern stack:** Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Zustand, React Hook Form + Zod, TanStack Table.
- **Role & plan gating:** UI and features driven by role and subscription (no “user limit” messaging; feature-based plans).
- **Multi-currency & location pricing:** Currency and pricing by country; professional price (e.g. $25 USD) configurable.
- **Audit & compliance:** Alert action history; Copilot audit log for proposed/approved/executed actions.
- **Desktop (Electron):** Optional desktop build for installable app.

---

## 8. Suggested pitch deck flow

1. **Title:** Legal by OdaFlow — Practice management that fits how you work.
2. **Problem:** Fragmented tools, manual updates, no AI, limited visibility.
3. **Solution:** One platform, roles, Copilot, transcripts, feature-based plans.
4. **Product:** Dashboard → Clients → Matters → Tasks → Calendar → Meetings (transcripts) → Alerts → Finance.
5. **Copilot:** Summarize, “what’s missing,” kickoff plans, task suggestions, email drafts; audit log.
6. **Roles:** Table or visual of who sees what (slide 4 above).
7. **Plans & pricing:** Starter / Professional / Enterprise; highlight Pro ($25/seat) and Copilot + transcripts.
8. **Roadmap:** Client portal, documents, trust, queues, reports, super admin.
9. **Team / Ask:** Founding team, traction, or “We’re building this — join the waitlist / book a demo.”

---

## 9. File references (for demos and screenshots)

- **App:** `app/app/**/page.tsx`
- **Auth:** `app/auth/sign-in`, `sign-up`, `forgot-password`, `demo`
- **Pricing:** `app/pricing/page.tsx`
- **Portal:** `app/portal`, `app/portal/sign-in`
- **Sidebar (nav):** `components/app-sidebar.tsx`
- **Roles:** `lib/types/roles.ts`, `lib/contexts/role-context.tsx`
- **Plans/pricing:** `lib/types/plan-features.ts`, `lib/types/pricing.ts`, `lib/contexts/pricing-context.tsx`
- **Copilot:** `lib/mock/copilot.ts`, `components/copilot/*`, `app/app/copilot/audit`
- **Meetings:** `app/app/meetings`, `app/app/meetings/[meetingId]`, `components/meetings/*`

---

*Use this brief to create your pitch deck. Update the doc as you ship new features or change positioning.*
