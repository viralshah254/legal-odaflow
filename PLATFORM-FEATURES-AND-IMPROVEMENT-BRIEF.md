# Legal by OdaFlow — Platform Features & Improvement Brief

**Purpose:** Feed this document to ChatGPT (or similar) to get structured suggestions on how to improve the platform. It lists what exists today and what’s missing or placeholder so you can prioritize product, UX, and technical improvements.

---

## 1. Platform Overview

**Legal by OdaFlow** is a **frontend-only** Legal CRM/Practice Management UI built with:

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS v4**
- **shadcn/ui**
- **Zustand** (state)
- **React Hook Form + Zod**
- **TanStack Table**
- **Mock API layer** (in-memory, simulated delays; no real backend)

There is **no backend**; all data is mock and resets on refresh. Auth is simulated.

---

## 2. Complete Feature List

### 2.1 Authentication & Access

| Feature | Route | Status | Notes |
|--------|------|--------|--------|
| Sign in | `/auth/sign-in` | Implemented | Mock auth |
| Sign up | `/auth/sign-up` | Implemented | Mock |
| Forgot password | `/auth/forgot-password` | Implemented | Mock |
| Demo / role switcher | `/auth/demo` | Implemented | Switch user/role for testing |
| Client portal sign-in | `/portal/sign-in` | Exists | Portal entry |
| Super admin | `/superadmin` | Placeholder | Tenants, Billing, Audit Logs cards only |

### 2.2 Main App (Role-Based Sidebar)

Navigation is **role-based**; not all roles see the same items.

| Area | Route | Status | Notes |
|------|--------|--------|--------|
| **Dashboard** | `/app/dashboard` | Implemented | KPIs, alerts strip, tasks, calendar, matters, KYC alerts, assistance requests, finance summary, plan gates |
| **Clients** | `/app/clients` | Implemented | List, create, search |
| **Client detail** | `/app/clients/[clientId]` | Implemented | Overview, KYC & Compliance tab, Matters tab; KYC checklist & upload table |
| **New client** | `/app/clients/new` | Implemented | Create client form |
| **Matters** | `/app/matters` | Implemented | List, filters |
| **Matter detail** | `/app/matters/[matterId]` | Implemented | Overview, timeline, collaborators, transfer case, request assistance, share matter, risk badge |
| **New matter** | `/app/matters/new` | Implemented | Create matter |
| **Template edit** | `/app/templates/[templateId]/edit` | Exists | Edit template |
| **Tasks** | `/app/tasks` | Implemented | Today / Overdue / Next 7 Days / Completed / All; role-filtered; link to new task |
| **New task** | `/app/tasks/new` | Implemented | Create task |
| **Calendar** | `/app/calendar` | Implemented | Calendar view, create event, event detail; role-scoped (partners see all, others see own) |
| **Alerts** | `/app/alerts` | Implemented | All / Critical / High; alert cards with actions (complete, skip, acknowledge, navigate); alert action history |
| **Finance** | `/app/finance` | Implemented | Invoices, collections, aging, fixed costs (CRUD), expenses, claims (create, approve/reject, pay), P&L, balance sheet, currency |
| **Team** | `/app/team` | Implemented | Team list (role-dependent) |
| **Templates** | `/app/templates` | Implemented | General & client templates, create/edit/delete, rich text editor, link to matter/client |
| **Settings** | `/app/settings` | Implemented | Partner Admin only; firm profile, users, roles, templates config, notifications, billing/subscription |
| **Settings – Users** | `/app/settings/users` | Implemented | Manage users |
| **Settings – Permissions** | `/app/settings/permissions` | Implemented | Roles & permissions matrix |
| **Settings – Role preview** | `/app/settings/role-preview` | Implemented | Preview what a role sees |
| **Settings – Templates** | `/app/settings/templates` | Implemented | Matter types, task templates, document folders |
| **Settings – Notifications** | `/app/settings/notifications` | Implemented | Email, SMS, in-app config |
| **Settings – Billing** | `/app/settings/billing` | Implemented | Billing management |

### 2.3 Accounting (Under Finance / Linked)

| Feature | Route | Status | Notes |
|--------|------|--------|--------|
| Invoices | `/app/accounting/invoices` | Implemented | List from mock API, link to new |
| New invoice | `/app/accounting/invoices/new` | Implemented | Create invoice |
| Payments | `/app/accounting/payments` | Placeholder | “Payment records would be displayed here” |
| Statements | `/app/accounting/statements` | Placeholder | Statement generator UI described, not built out |

### 2.4 Other App Pages (Not in Sidebar or Nested)

| Feature | Route | Status | Notes |
|--------|------|--------|--------|
| **Documents** | `/app/documents` | Placeholder | Upload button; “Document library table would be displayed here” |
| **Trust** | `/app/trust` | Placeholder | Deposit/Disbursement buttons; balances and pending approvals described, not built |
| **Queues** | `/app/queues` | Placeholder | Intake, KYC, Billing, Trust Approval, Overdue Critical — cards only, no data |
| **Automations** | `/app/automations` | Implemented (thin) | List automation rules, toggle enable/disable via mock API |
| **Expenses** | `/app/expenses` | Implemented | List, create expense, by matter/client, totals; role-gated |
| **Reports** | `/app/reports` | Placeholder | Plan-gated (Professional); export cards for Overdue Tasks, Matter Pipeline, Invoice Aging, Trust — no real export |
| **Profile** | `/app/profile` | Implemented | View/edit name, email, phone, role display |
| **Pricing** | `/pricing` | Implemented | Tiers (Starter, Professional, Enterprise), billing cycle, user count, country/currency, trial signup |

### 2.5 Client Portal

| Feature | Route | Status | Notes |
|--------|------|--------|--------|
| Portal home | `/portal` | Placeholder | Document requests, matter progress, invoices — “would be displayed here” |
| Portal sign-in | `/portal/sign-in` | Exists | Entry point |

### 2.6 Global UX

| Feature | Status | Notes |
|--------|--------|--------|
| Command palette | Implemented | Cmd+K / Ctrl+K; quick nav to Clients, Matters, Tasks, Invoices, Trust, Documents |
| Theme toggle | Implemented | Light/dark |
| Role-based sidebar | Implemented | Different nav per role (Partner Admin, Junior Partner, Associate, Paralegal, Finance, Intake, OPS_HR, Reception, Read-Only) |
| Role gate component | Implemented | Hide/disable by role |
| Plan gate component | Implemented | Gate features by plan (e.g. Reports require Professional) |
| Currency context | Implemented | Multi-currency display (e.g. finance, pricing) |
| Pricing context | Implemented | Country, billing cycle, price per user for pricing page |

---

## 3. Roles & Permissions (Summary)

- **PARTNER_ADMIN:** Full access (dashboard, clients, matters, tasks, calendar, alerts, finance, team, templates, settings).
- **JUNIOR_PARTNER:** Same as above except no Finance, no Settings.
- **ASSOCIATE:** Dashboard, clients, matters, tasks, calendar, alerts, team, templates (no finance, no settings).
- **PARALEGAL:** Dashboard, matters, tasks, calendar, alerts, templates (no clients, no team).
- **FINANCE:** Dashboard, clients, matters, finance, templates.
- **INTAKE:** Dashboard, clients, matters, tasks, alerts, templates.
- **OPS_HR:** Dashboard, team, calendar, templates.
- **RECEPTION:** Dashboard, clients, calendar, templates.
- **READ_ONLY:** Dashboard, clients, matters, tasks, calendar, finance, templates (view-only).

Permissions (from code) include: `canViewAllMatters`, `canViewTeam`, `canViewFinance`, `canCreateMatter`, `canAssignTasks`, `canViewAllTasks`, `canViewAllCalendar`, `canManageSettings`, `canApproveTrust`.

---

## 4. Data Models & Mock Coverage

- **Users** (with role, team)
- **Clients** (type: Individual, Company, NGO, Partnership; KYC status, portal, notifications)
- **Matters** (ref, type, stage, status, owner, risk, parties, key dates)
- **Tasks** (matter/client, due, priority, status, assignee, category)
- **Invoices** (client, status, line items)
- **Documents** (matter/client, versions, approve for portal) — types exist; UI placeholder
- **KYC** (checklist per client type, upload, verify, expire)
- **Calendar events** (attendees, start/end, matter link)
- **Alerts** (severity, type, matter/task/client, assignee, due, acknowledged)
- **Alert actions** (completed, skipped, acknowledged, navigated + history)
- **Assistance requests** (matter, requested by, approval)
- **Matter sharing** (access level: read/write)
- **Timeline** (events per matter)
- **Templates** (general vs client, rich text, category)
- **Expenses** (matter/client, category, amount, date)
- **Fixed costs** (finance; CRUD)
- **Claims** (expense claims; submit, approve finance/admin, reject, mark paid)
- **Firm settings** (name, industry, location, description)
- **Subscription** (plan, billing cycle, user count, trial end, next billing)
- **Notifications** (mock list)
- **Plan features** (Starter / Professional / Enterprise: users, matters, storage, advanced reporting, client portal, API, etc.)

---

## 5. What’s Implemented vs Placeholder

**Fully or largely implemented:**  
Auth (sign-in, sign-up, forgot, demo), dashboard, clients (list, create, detail with KYC), matters (list, create, detail with timeline/collaborators/transfer/assistance/share), tasks (list, create, filters), calendar (view, create event), alerts (list, actions), finance (invoices, new invoice, fixed costs, expenses, claims, P&L, balance sheet), team, templates (CRUD, editor), settings (firm, users, permissions, role preview, templates, notifications, billing), accounting invoices + new, expenses page, profile, pricing, command palette, theme, RBAC UI, plan/currency contexts, automations (list + toggle).

**Placeholder or stub:**  
Documents (library/upload), Trust (balances, disbursements, approvals), Queues (all queues), Accounting Payments, Accounting Statements, Reports (export buttons only), Client portal (all sections), Super admin (cards only).

---

## 6. Suggested Questions to Ask ChatGPT (Improvement Ideas)

Copy or adapt these when feeding this brief to ChatGPT:

1. **Product & prioritization**  
   “Given this feature list and the implemented vs placeholder breakdown, what should we prioritize first: filling in placeholders (Documents, Trust, Queues, Payments, Statements, Reports, Client portal) or improving existing flows (e.g. dashboard, matter detail, finance)? Consider a small firm vs mid-size firm.”

2. **UX & workflows**  
   “What UX improvements would you suggest for: (a) the dashboard (information density, alerts, KPIs), (b) matter lifecycle (intake → open → close), (c) billing and trust workflows, (d) client portal so clients actually use it?”

3. **Role design**  
   “Are these roles (Partner Admin, Junior Partner, Associate, Paralegal, Finance, Intake, OPS_HR, Reception, Read-Only) sufficient for a typical law firm? What permissions or role changes would you add or simplify?”

4. **Gaps vs typical practice management**  
   “What important features are missing compared to typical legal practice management software (e.g. time tracking, conflict checks, court deadlines, document assembly, email integration, e-signature)?”

5. **Client portal**  
   “How would you design the client portal (document requests, matter progress, invoices) so it’s useful for clients and reduces back-and-forth with the firm?”

6. **Reports & analytics**  
   “What reports and analytics would be most valuable for partners and finance (e.g. realization, pipeline, matter profitability, trust compliance) and how would you present them?”

7. **Onboarding & adoption**  
   “What onboarding flows or in-app guidance would you add so new firms and new users adopt the platform faster?”

8. **Technical / backend readiness**  
   “If we add a real backend next, which APIs and data models should we implement first, given this feature list and mock data?”

9. **Mobile & responsiveness**  
   “Which pages or flows should we prioritize for mobile or tablet (e.g. calendar, time entry, approvals)?”

10. **Compliance & risk**  
    “What compliance or risk features would you add (e.g. trust accounting safeguards, matter confidentiality, audit trail, data retention)?”

---

## 7. File References (for developers)

- **App routes:** `app/app/**/page.tsx`, `app/auth/**/page.tsx`, `app/portal/**/page.tsx`, `app/superadmin/page.tsx`, `app/pricing/page.tsx`
- **Sidebar (role nav):** `components/app-sidebar.tsx`
- **Roles & permissions:** `lib/types/roles.ts`, `lib/contexts/role-context.tsx`
- **Plan features / pricing:** `lib/types/plan-features.ts`, `lib/types/pricing.ts`, `lib/contexts/pricing-context.tsx`
- **Mock data:** `lib/mock/*.ts`
- **Types:** `lib/types.ts`, `lib/types/*.ts`
- **Role/plan gating:** `components/dashboard/role-gate.tsx`, `components/plan/plan-gate.tsx`

---

*Generated from codebase review. Update this document as the platform evolves so the improvement brief stays accurate.*
