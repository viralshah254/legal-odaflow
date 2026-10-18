import type { UserRole } from "@/lib/types/roles"
import type { TourDefinition } from "./types"

/** Match pathname against tour route patterns. `*` = single path segment. Non-wildcard patterns are exact-match only. */
export function matchTourRoute(pathname: string, pattern: string): boolean {
  if (pattern === pathname) return true
  if (!pattern.includes("*")) return false
  const patternParts = pattern.split("/").filter(Boolean)
  const pathParts = pathname.split("/").filter(Boolean)
  if (patternParts.length !== pathParts.length) return false
  return patternParts.every((part, i) => part === "*" || part === pathParts[i])
}

export function tourMatchesPath(tour: TourDefinition, pathname: string): boolean {
  return tour.routes.some((r) => matchTourRoute(pathname, r))
}

export function resolveTourForPath(
  tours: TourDefinition[],
  pathname: string,
  role: UserRole,
): TourDefinition | null {
  const eligible = tours.filter(
    (t) =>
      tourMatchesPath(t, pathname) &&
      (!t.roles || t.roles.includes(role)),
  )
  if (eligible.length === 0) return null
  return eligible.sort((a, b) => {
    const score = (t: TourDefinition) => {
      let best = 0
      for (const r of t.routes) {
        if (r === pathname) best = Math.max(best, 1000 + r.length)
        else if (matchTourRoute(pathname, r)) {
          const wildcards = (r.match(/\*/g) ?? []).length
          best = Math.max(best, r.length * 10 - wildcards * 100)
        }
      }
      return best
    }
    return score(b) - score(a)
  })[0]!
}

const ALL_LAWYER_ROLES: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "PARALEGAL",
  "FINANCE",
  "INTAKE",
  "OPS_HR",
  "RECEPTION",
  "READ_ONLY",
]

const MATTER_ROLES: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "PARALEGAL",
  "FINANCE",
  "INTAKE",
  "READ_ONLY",
]

const CLIENT_ROLES: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "FINANCE",
  "INTAKE",
  "RECEPTION",
  "READ_ONLY",
]

const FINANCE_ROLES: UserRole[] = ["PARTNER_ADMIN", "JUNIOR_PARTNER", "FINANCE"]

const ADMIN_ROLES: UserRole[] = ["PARTNER_ADMIN", "JUNIOR_PARTNER"]

const ALL_OPS: UserRole[] = ["PARTNER_ADMIN", "JUNIOR_PARTNER"]

/** Global shell tour — shown once after first login */
export const SHELL_TOUR: TourDefinition = {
  id: "app.shell",
  routes: ["/app/dashboard"],
  autoStart: true,
  steps: [
    {
      element: "[data-tour=sidebar-nav]",
      titleKey: "shell.sidebar.title",
      bodyKey: "shell.sidebar.body",
      side: "right",
    },
    {
      element: "[data-tour=global-search]",
      titleKey: "shell.search.title",
      bodyKey: "shell.search.body",
      side: "bottom",
    },
    {
      element: "[data-tour=command-palette-hint]",
      titleKey: "shell.commandPalette.title",
      bodyKey: "shell.commandPalette.body",
      side: "bottom",
    },
    {
      element: "[data-tour=copilot-fab]",
      titleKey: "shell.copilot.title",
      bodyKey: "shell.copilot.body",
      side: "left",
    },
    {
      element: "[data-tour=notifications]",
      titleKey: "shell.notifications.title",
      bodyKey: "shell.notifications.body",
      side: "bottom",
    },
    {
      element: "[data-tour=user-menu]",
      titleKey: "shell.profile.title",
      bodyKey: "shell.profile.body",
      side: "bottom",
    },
  ],
  helpPanel: {
    titleKey: "shell.help.title",
    bullets: ["shell.help.b1", "shell.help.b2", "shell.help.b3"],
  },
}

export const LAWYER_PAGE_TOURS: TourDefinition[] = [
  {
    id: "app.dashboard",
    routes: ["/app/dashboard"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=dashboard-kpis]",
        titleKey: "dashboard.kpis.title",
        bodyKey: "dashboard.kpis.body",
      },
      {
        element: "[data-tour=dashboard-alerts]",
        titleKey: "dashboard.alerts.title",
        bodyKey: "dashboard.alerts.body",
      },
      {
        element: "[data-tour=dashboard-tasks]",
        titleKey: "dashboard.tasks.title",
        bodyKey: "dashboard.tasks.body",
      },
      {
        element: "[data-tour=dashboard-onboarding]",
        titleKey: "dashboard.onboarding.title",
        bodyKey: "dashboard.onboarding.body",
      },
    ],
    helpPanel: {
      titleKey: "dashboard.help.title",
      bullets: ["dashboard.help.b1", "dashboard.help.b2", "dashboard.help.b3"],
    },
  },
  {
    id: "app.clients",
    routes: ["/app/clients"],
    roles: CLIENT_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=clients-search]",
        titleKey: "clients.search.title",
        bodyKey: "clients.search.body",
      },
      {
        element: "[data-tour=clients-create]",
        titleKey: "clients.create.title",
        bodyKey: "clients.create.body",
      },
      {
        element: "[data-tour=clients-list]",
        titleKey: "clients.list.title",
        bodyKey: "clients.list.body",
      },
    ],
    helpPanel: {
      titleKey: "clients.help.title",
      bullets: ["clients.help.b1", "clients.help.b2", "clients.help.b3"],
    },
  },
  {
    id: "app.clients.new",
    routes: ["/app/clients/new"],
    roles: CLIENT_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=client-form]",
        titleKey: "clientsNew.form.title",
        bodyKey: "clientsNew.form.body",
      },
      {
        element: "[data-tour=client-submit]",
        titleKey: "clientsNew.submit.title",
        bodyKey: "clientsNew.submit.body",
      },
    ],
    helpPanel: {
      titleKey: "clientsNew.help.title",
      bullets: ["clientsNew.help.b1", "clientsNew.help.b2"],
    },
  },
  {
    id: "app.clients.detail",
    routes: ["/app/clients/*"],
    roles: CLIENT_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=client-header]",
        titleKey: "clientsDetail.header.title",
        bodyKey: "clientsDetail.header.body",
      },
      {
        element: "[data-tour=client-matters]",
        titleKey: "clientsDetail.matters.title",
        bodyKey: "clientsDetail.matters.body",
      },
    ],
    helpPanel: {
      titleKey: "clientsDetail.help.title",
      bullets: ["clientsDetail.help.b1", "clientsDetail.help.b2", "clientsDetail.help.b3"],
    },
  },
  {
    id: "app.matters",
    routes: ["/app/matters"],
    roles: MATTER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=matters-create]",
        titleKey: "matters.create.title",
        bodyKey: "matters.create.body",
      },
      {
        element: "[data-tour=matters-filter]",
        titleKey: "matters.filter.title",
        bodyKey: "matters.filter.body",
      },
      {
        element: "[data-tour=matters-list]",
        titleKey: "matters.list.title",
        bodyKey: "matters.list.body",
      },
    ],
    helpPanel: {
      titleKey: "matters.help.title",
      bullets: ["matters.help.b1", "matters.help.b2", "matters.help.b3"],
    },
  },
  {
    id: "app.matters.new",
    routes: ["/app/matters/new"],
    roles: MATTER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=matter-form]",
        titleKey: "mattersNew.form.title",
        bodyKey: "mattersNew.form.body",
      },
      {
        element: "[data-tour=matter-submit]",
        titleKey: "mattersNew.submit.title",
        bodyKey: "mattersNew.submit.body",
      },
    ],
    helpPanel: {
      titleKey: "mattersNew.help.title",
      bullets: ["mattersNew.help.b1", "mattersNew.help.b2"],
    },
  },
  {
    id: "app.matters.detail",
    routes: ["/app/matters/*"],
    roles: MATTER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=matter-header]",
        titleKey: "mattersDetail.header.title",
        bodyKey: "mattersDetail.header.body",
      },
      {
        element: "[data-tour=matter-tabs]",
        titleKey: "mattersDetail.tabs.title",
        bodyKey: "mattersDetail.tabs.body",
      },
      {
        element: "[data-tour=matter-workbench]",
        titleKey: "mattersDetail.workbench.title",
        bodyKey: "mattersDetail.workbench.body",
      },
    ],
    helpPanel: {
      titleKey: "mattersDetail.help.title",
      bullets: ["mattersDetail.help.b1", "mattersDetail.help.b2", "mattersDetail.help.b3"],
    },
  },
  {
    id: "app.tasks",
    routes: ["/app/tasks"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=tasks-create]",
        titleKey: "tasks.create.title",
        bodyKey: "tasks.create.body",
      },
      {
        element: "[data-tour=tasks-list]",
        titleKey: "tasks.list.title",
        bodyKey: "tasks.list.body",
      },
    ],
    helpPanel: {
      titleKey: "tasks.help.title",
      bullets: ["tasks.help.b1", "tasks.help.b2", "tasks.help.b3"],
    },
  },
  {
    id: "app.meetings",
    routes: ["/app/meetings"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=meetings-record]",
        titleKey: "meetings.record.title",
        bodyKey: "meetings.record.body",
      },
      {
        element: "[data-tour=meetings-list]",
        titleKey: "meetings.list.title",
        bodyKey: "meetings.list.body",
      },
    ],
    helpPanel: {
      titleKey: "meetings.help.title",
      bullets: ["meetings.help.b1", "meetings.help.b2", "meetings.help.b3"],
    },
  },
  // Phase 2 — schedule & time
  {
    id: "app.calendar",
    routes: ["/app/calendar"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=calendar-view]",
        titleKey: "calendar.view.title",
        bodyKey: "calendar.view.body",
      },
      {
        element: "[data-tour=calendar-create]",
        titleKey: "calendar.create.title",
        bodyKey: "calendar.create.body",
      },
    ],
    helpPanel: {
      titleKey: "calendar.help.title",
      bullets: ["calendar.help.b1", "calendar.help.b2"],
    },
  },
  {
    id: "app.time",
    routes: ["/app/time"],
    roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=time-log]",
        titleKey: "time.log.title",
        bodyKey: "time.log.body",
      },
      {
        element: "[data-tour=time-list]",
        titleKey: "time.list.title",
        bodyKey: "time.list.body",
      },
    ],
    helpPanel: {
      titleKey: "time.help.title",
      bullets: ["time.help.b1", "time.help.b2"],
    },
  },
  // Files & library
  {
    id: "app.documents",
    routes: ["/app/documents"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=documents-upload]",
        titleKey: "documents.upload.title",
        bodyKey: "documents.upload.body",
      },
      {
        element: "[data-tour=documents-list]",
        titleKey: "documents.list.title",
        bodyKey: "documents.list.body",
      },
    ],
    helpPanel: {
      titleKey: "documents.help.title",
      bullets: ["documents.help.b1", "documents.help.b2"],
    },
  },
  {
    id: "app.law-library",
    routes: ["/app/law-library"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=law-library-search]",
        titleKey: "lawLibrary.search.title",
        bodyKey: "lawLibrary.search.body",
      },
    ],
    helpPanel: {
      titleKey: "lawLibrary.help.title",
      bullets: ["lawLibrary.help.b1", "lawLibrary.help.b2"],
    },
  },
  {
    id: "app.vault",
    routes: ["/app/vault"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=vault-search]",
        titleKey: "vault.search.title",
        bodyKey: "vault.search.body",
      },
    ],
    helpPanel: {
      titleKey: "vault.help.title",
      bullets: ["vault.help.b1", "vault.help.b2"],
    },
  },
  {
    id: "app.esign",
    routes: ["/app/esign"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=esign-create]",
        titleKey: "esign.create.title",
        bodyKey: "esign.create.body",
      },
    ],
    helpPanel: {
      titleKey: "esign.help.title",
      bullets: ["esign.help.b1", "esign.help.b2"],
    },
  },
  // Billing & finance
  {
    id: "app.billing",
    routes: ["/app/billing", "/app/accounting/invoices"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=billing-header]",
        titleKey: "billing.header.title",
        bodyKey: "billing.header.body",
      },
      {
        element: "[data-tour=billing-links]",
        titleKey: "billing.links.title",
        bodyKey: "billing.links.body",
      },
      {
        element: "[data-tour=billing-invoices]",
        titleKey: "billing.invoices.title",
        bodyKey: "billing.invoices.body",
      },
    ],
    helpPanel: {
      titleKey: "billing.help.title",
      bullets: ["billing.help.b1", "billing.help.b2", "billing.help.b3"],
    },
  },
  {
    id: "app.trust",
    routes: ["/app/trust"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=trust-balances]",
        titleKey: "trust.balances.title",
        bodyKey: "trust.balances.body",
      },
    ],
    helpPanel: {
      titleKey: "trust.help.title",
      bullets: ["trust.help.b1", "trust.help.b2"],
    },
  },
  {
    id: "app.finance",
    routes: ["/app/finance"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=finance-dashboard]",
        titleKey: "finance.dashboard.title",
        bodyKey: "finance.dashboard.body",
      },
    ],
    helpPanel: {
      titleKey: "finance.help.title",
      bullets: ["finance.help.b1", "finance.help.b2"],
    },
  },
  {
    id: "app.expenses",
    routes: ["/app/expenses"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=expenses-create]",
        titleKey: "expenses.create.title",
        bodyKey: "expenses.create.body",
      },
    ],
    helpPanel: {
      titleKey: "expenses.help.title",
      bullets: ["expenses.help.b1", "expenses.help.b2"],
    },
  },
  // Pipeline & intake
  {
    id: "app.leads",
    routes: ["/app/leads"],
    roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=leads-inbox]",
        titleKey: "leads.inbox.title",
        bodyKey: "leads.inbox.body",
      },
    ],
    helpPanel: {
      titleKey: "leads.help.title",
      bullets: ["leads.help.b1", "leads.help.b2"],
    },
  },
  {
    id: "app.inbox",
    routes: ["/app/inbox"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=inbox-list]",
        titleKey: "inbox.list.title",
        bodyKey: "inbox.list.body",
      },
    ],
    helpPanel: {
      titleKey: "inbox.help.title",
      bullets: ["inbox.help.b1", "inbox.help.b2"],
    },
  },
  {
    id: "app.alerts",
    routes: ["/app/alerts"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=alerts-list]",
        titleKey: "alerts.list.title",
        bodyKey: "alerts.list.body",
      },
    ],
    helpPanel: {
      titleKey: "alerts.help.title",
      bullets: ["alerts.help.b1", "alerts.help.b2"],
    },
  },
  {
    id: "app.intake",
    routes: ["/app/intake"],
    roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "INTAKE"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=intake-wizard]",
        titleKey: "intake.wizard.title",
        bodyKey: "intake.wizard.body",
        side: "bottom",
      },
      {
        element: "[data-tour=intake-issue-input]",
        titleKey: "intake.issueInput.title",
        bodyKey: "intake.issueInput.body",
        side: "right",
      },
      {
        element: "[data-tour=intake-steps]",
        titleKey: "intake.steps.title",
        bodyKey: "intake.steps.body",
        side: "left",
      },
      {
        element: "[data-tour=intake-ai-model]",
        titleKey: "intake.aiModel.title",
        bodyKey: "intake.aiModel.body",
        side: "left",
      },
      {
        element: "[data-tour=intake-continue]",
        titleKey: "intake.continue.title",
        bodyKey: "intake.continue.body",
        side: "top",
      },
    ],
    helpPanel: {
      titleKey: "intake.help.title",
      bullets: ["intake.help.b1", "intake.help.b2", "intake.help.b3"],
    },
  },
  {
    id: "app.research",
    routes: ["/app/research"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=research-query]",
        titleKey: "research.query.title",
        bodyKey: "research.query.body",
      },
      {
        element: "[data-tour=research-sources]",
        titleKey: "research.sources.title",
        bodyKey: "research.sources.body",
      },
      {
        element: "[data-tour=research-results]",
        titleKey: "research.results.title",
        bodyKey: "research.results.body",
      },
    ],
    helpPanel: {
      titleKey: "research.help.title",
      bullets: ["research.help.b1", "research.help.b2", "research.help.b3"],
    },
  },
  {
    id: "app.monitors",
    routes: ["/app/monitors"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=monitors-create]",
        titleKey: "monitors.create.title",
        bodyKey: "monitors.create.body",
      },
      {
        element: "[data-tour=monitors-list]",
        titleKey: "monitors.list.title",
        bodyKey: "monitors.list.body",
      },
    ],
    helpPanel: {
      titleKey: "monitors.help.title",
      bullets: ["monitors.help.b1", "monitors.help.b2", "monitors.help.b3"],
    },
  },
  // Quick actions & AI tools
  {
    id: "app.home",
    routes: ["/app/home"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=home-header]", titleKey: "home.header.title", bodyKey: "home.header.body" },
      { element: "[data-tour=home-actions]", titleKey: "home.actions.title", bodyKey: "home.actions.body" },
    ],
    helpPanel: { titleKey: "home.help.title", bullets: ["home.help.b1", "home.help.b2", "home.help.b3"] },
  },
  {
    id: "app.evidence",
    routes: ["/app/evidence"],
    roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"],
    autoStart: true,
    steps: [
      { element: "[data-tour=evidence-matter]", titleKey: "evidence.matter.title", bodyKey: "evidence.matter.body" },
      { element: "[data-tour=evidence-list]", titleKey: "evidence.list.title", bodyKey: "evidence.list.body" },
    ],
    helpPanel: { titleKey: "evidence.help.title", bullets: ["evidence.help.b1", "evidence.help.b2", "evidence.help.b3"] },
  },
  {
    id: "app.queues",
    routes: ["/app/queues"],
    roles: ALL_OPS,
    autoStart: true,
    steps: [
      { element: "[data-tour=queues-grid]", titleKey: "queues.grid.title", bodyKey: "queues.grid.body" },
    ],
    helpPanel: { titleKey: "queues.help.title", bullets: ["queues.help.b1", "queues.help.b2"] },
  },
  {
    id: "app.automations",
    routes: ["/app/automations"],
    roles: ALL_OPS,
    autoStart: true,
    steps: [
      { element: "[data-tour=automations-header]", titleKey: "automations.header.title", bodyKey: "automations.header.body" },
      { element: "[data-tour=automations-recipes]", titleKey: "automations.recipes.title", bodyKey: "automations.recipes.body" },
    ],
    helpPanel: { titleKey: "automations.help.title", bullets: ["automations.help.b1", "automations.help.b2", "automations.help.b3"] },
  },
  {
    id: "app.reports",
    routes: ["/app/reports"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=reports-header]", titleKey: "reports.header.title", bodyKey: "reports.header.body" },
      { element: "[data-tour=reports-kpis]", titleKey: "reports.kpis.title", bodyKey: "reports.kpis.body" },
    ],
    helpPanel: { titleKey: "reports.help.title", bullets: ["reports.help.b1", "reports.help.b2", "reports.help.b3"] },
  },
  {
    id: "app.documentReview",
    routes: ["/app/document-review"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=document-review-header]", titleKey: "documentReview.header.title", bodyKey: "documentReview.header.body", side: "bottom" },
      { element: "[data-tour=document-review-mode]", titleKey: "documentReview.mode.title", bodyKey: "documentReview.mode.body", side: "bottom" },
      { element: "[data-tour=document-review-recent]", titleKey: "documentReview.recent.title", bodyKey: "documentReview.recent.body", side: "right" },
      { element: "[data-tour=document-review-input-mode]", titleKey: "documentReview.inputMode.title", bodyKey: "documentReview.inputMode.body", side: "right" },
      { element: "[data-tour=document-review-upload]", titleKey: "documentReview.upload.title", bodyKey: "documentReview.upload.body", side: "right" },
      { element: "[data-tour=document-review-options]", titleKey: "documentReview.options.title", bodyKey: "documentReview.options.body", side: "right" },
      { element: "[data-tour=document-review-ai-model]", titleKey: "documentReview.aiModel.title", bodyKey: "documentReview.aiModel.body", side: "right" },
      { element: "[data-tour=document-review-analyze]", titleKey: "documentReview.analyze.title", bodyKey: "documentReview.analyze.body", side: "top" },
      { element: "[data-tour=document-review-empty]", titleKey: "documentReview.empty.title", bodyKey: "documentReview.empty.body", side: "left" },
    ],
    helpPanel: { titleKey: "documentReview.help.title", bullets: ["documentReview.help.b1", "documentReview.help.b2", "documentReview.help.b3"] },
  },
  {
    id: "app.documentReview.results",
    routes: [],
    roles: ALL_LAWYER_ROLES,
    steps: [
      { element: "[data-tour=document-review-highlights]", titleKey: "documentReview.highlights.title", bodyKey: "documentReview.highlights.body", side: "bottom" },
      { element: "[data-tour=document-review-stats]", titleKey: "documentReview.stats.title", bodyKey: "documentReview.stats.body", side: "left" },
      { element: "[data-tour=document-review-tabs]", titleKey: "documentReview.tabs.title", bodyKey: "documentReview.tabs.body", side: "bottom" },
      { element: "[data-tour=document-review-amendments]", titleKey: "documentReview.amendments.title", bodyKey: "documentReview.amendments.body", side: "bottom" },
      { element: "[data-tour=document-review-save]", titleKey: "documentReview.save.title", bodyKey: "documentReview.save.body", side: "bottom" },
      { element: "[data-tour=document-review-followup]", titleKey: "documentReview.followup.title", bodyKey: "documentReview.followup.body", side: "top" },
    ],
    helpPanel: { titleKey: "documentReview.help.title", bullets: ["documentReview.help.b1", "documentReview.help.b2", "documentReview.help.b3"] },
  },
  {
    id: "app.legalForms",
    routes: ["/app/legal-forms"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=legal-forms-intro]", titleKey: "legalForms.intro.title", bodyKey: "legalForms.intro.body" },
      { element: "[data-tour=legal-forms-workspace]", titleKey: "legalForms.workspace.title", bodyKey: "legalForms.workspace.body" },
    ],
    helpPanel: { titleKey: "legalForms.help.title", bullets: ["legalForms.help.b1", "legalForms.help.b2", "legalForms.help.b3"] },
  },
  {
    id: "app.sectionFinder",
    routes: ["/app/section-finder"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=section-finder-workspace]", titleKey: "sectionFinder.workspace.title", bodyKey: "sectionFinder.workspace.body" },
    ],
    helpPanel: { titleKey: "sectionFinder.help.title", bullets: ["sectionFinder.help.b1", "sectionFinder.help.b2"] },
  },
  {
    id: "app.firAnalysis",
    routes: ["/app/fir-analysis"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=fir-intro]", titleKey: "firAnalysis.intro.title", bodyKey: "firAnalysis.intro.body" },
      { element: "[data-tour=fir-uploader]", titleKey: "firAnalysis.upload.title", bodyKey: "firAnalysis.upload.body" },
    ],
    helpPanel: { titleKey: "firAnalysis.help.title", bullets: ["firAnalysis.help.b1", "firAnalysis.help.b2"] },
  },
  {
    id: "app.indiaDrafting",
    routes: ["/app/india-drafting"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=india-drafting-intro]", titleKey: "indiaDrafting.intro.title", bodyKey: "indiaDrafting.intro.body" },
      { element: "[data-tour=india-drafting-workspace]", titleKey: "indiaDrafting.workspace.title", bodyKey: "indiaDrafting.workspace.body" },
    ],
    helpPanel: { titleKey: "indiaDrafting.help.title", bullets: ["indiaDrafting.help.b1", "indiaDrafting.help.b2"] },
  },
  {
    id: "app.usDrafting",
    routes: ["/app/us-drafting"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=us-drafting-workspace]", titleKey: "usDrafting.workspace.title", bodyKey: "usDrafting.workspace.body" },
    ],
    helpPanel: { titleKey: "usDrafting.help.title", bullets: ["usDrafting.help.b1", "usDrafting.help.b2"] },
  },
  {
    id: "app.contracts",
    routes: ["/app/contracts"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=contracts-dashboard]", titleKey: "contracts.dashboard.title", bodyKey: "contracts.dashboard.body" },
    ],
    helpPanel: { titleKey: "contracts.help.title", bullets: ["contracts.help.b1", "contracts.help.b2"] },
  },
  {
    id: "app.savedDrafts",
    routes: ["/app/saved-drafts"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=saved-drafts-list]", titleKey: "savedDrafts.list.title", bodyKey: "savedDrafts.list.body" },
    ],
    helpPanel: { titleKey: "savedDrafts.help.title", bullets: ["savedDrafts.help.b1", "savedDrafts.help.b2"] },
  },
  {
    id: "app.aiCommandCenter",
    routes: ["/app/ai-command-center"],
    roles: ALL_OPS,
    autoStart: true,
    steps: [
      { element: "[data-tour=command-center-header]", titleKey: "aiCommandCenter.header.title", bodyKey: "aiCommandCenter.header.body" },
      { element: "[data-tour=command-center-cards]", titleKey: "aiCommandCenter.cards.title", bodyKey: "aiCommandCenter.cards.body" },
    ],
    helpPanel: { titleKey: "aiCommandCenter.help.title", bullets: ["aiCommandCenter.help.b1", "aiCommandCenter.help.b2", "aiCommandCenter.help.b3"] },
  },
  {
    id: "app.agents",
    routes: ["/app/agents"],
    roles: ALL_OPS,
    autoStart: true,
    steps: [
      { element: "[data-tour=agents-jobs]", titleKey: "agents.jobs.title", bodyKey: "agents.jobs.body" },
    ],
    helpPanel: { titleKey: "agents.help.title", bullets: ["agents.help.b1", "agents.help.b2"] },
  },
  {
    id: "app.onboarding",
    routes: ["/app/onboarding"],
    roles: ADMIN_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=onboarding-wizard]", titleKey: "onboarding.wizard.title", bodyKey: "onboarding.wizard.body" },
    ],
    helpPanel: { titleKey: "onboarding.help.title", bullets: ["onboarding.help.b1", "onboarding.help.b2"] },
  },
  {
    id: "app.profile",
    routes: ["/app/profile"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=profile-form]", titleKey: "profile.form.title", bodyKey: "profile.form.body" },
    ],
    helpPanel: { titleKey: "profile.help.title", bullets: ["profile.help.b1", "profile.help.b2"] },
  },
  {
    id: "app.referrals",
    routes: ["/app/referrals"],
    roles: ALL_LAWYER_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=referrals-share]", titleKey: "referrals.share.title", bodyKey: "referrals.share.body" },
    ],
    helpPanel: { titleKey: "referrals.help.title", bullets: ["referrals.help.b1", "referrals.help.b2"] },
  },
  {
    id: "app.copilotAudit",
    routes: ["/app/copilot/audit"],
    roles: ADMIN_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=copilot-audit-list]", titleKey: "copilotAudit.list.title", bodyKey: "copilotAudit.list.body" },
    ],
    helpPanel: { titleKey: "copilotAudit.help.title", bullets: ["copilotAudit.help.b1", "copilotAudit.help.b2"] },
  },
  {
    id: "app.accountingPayments",
    routes: ["/app/accounting/payments"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=payments-list]", titleKey: "accountingPayments.list.title", bodyKey: "accountingPayments.list.body" },
    ],
    helpPanel: { titleKey: "accountingPayments.help.title", bullets: ["accountingPayments.help.b1", "accountingPayments.help.b2"] },
  },
  {
    id: "app.accountingStatements",
    routes: ["/app/accounting/statements"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=statements-list]", titleKey: "accountingStatements.list.title", bodyKey: "accountingStatements.list.body" },
    ],
    helpPanel: { titleKey: "accountingStatements.help.title", bullets: ["accountingStatements.help.b1", "accountingStatements.help.b2"] },
  },
  {
    id: "app.preBill",
    routes: ["/app/billing/pre-bill", "/app/accounting/pre-bill"],
    roles: FINANCE_ROLES,
    autoStart: true,
    steps: [
      { element: "[data-tour=prebill-workspace]", titleKey: "preBill.workspace.title", bodyKey: "preBill.workspace.body" },
    ],
    helpPanel: { titleKey: "preBill.help.title", bullets: ["preBill.help.b1", "preBill.help.b2"] },
  },
  // Admin & settings
  {
    id: "app.team",
    routes: ["/app/team"],
    roles: ADMIN_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=team-invite]",
        titleKey: "team.invite.title",
        bodyKey: "team.invite.body",
      },
    ],
    helpPanel: {
      titleKey: "team.help.title",
      bullets: ["team.help.b1", "team.help.b2"],
    },
  },
  {
    id: "app.templates",
    routes: ["/app/templates"],
    roles: ADMIN_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=templates-upload]",
        titleKey: "templates.upload.title",
        bodyKey: "templates.upload.body",
      },
    ],
    helpPanel: {
      titleKey: "templates.help.title",
      bullets: ["templates.help.b1", "templates.help.b2"],
    },
  },
  {
    id: "app.settings",
    routes: ["/app/settings"],
    roles: ADMIN_ROLES,
    autoStart: true,
    steps: [
      {
        element: "[data-tour=settings-hub]",
        titleKey: "settings.hub.title",
        bodyKey: "settings.hub.body",
      },
    ],
    helpPanel: {
      titleKey: "settings.help.title",
      bullets: ["settings.help.b1", "settings.help.b2"],
    },
  },
]

export const CONSUMER_PAGE_TOURS: TourDefinition[] = [
  {
    id: "consumer.dashboard",
    routes: ["/consumer/dashboard"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-cases]",
        titleKey: "consumerDashboard.cases.title",
        bodyKey: "consumerDashboard.cases.body",
      },
      {
        element: "[data-tour=consumer-actions]",
        titleKey: "consumerDashboard.actions.title",
        bodyKey: "consumerDashboard.actions.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerDashboard.help.title",
      bullets: ["consumerDashboard.help.b1", "consumerDashboard.help.b2"],
    },
  },
  {
    id: "consumer.cases",
    routes: ["/consumer/cases"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-case-list]",
        titleKey: "consumerCases.list.title",
        bodyKey: "consumerCases.list.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerCases.help.title",
      bullets: ["consumerCases.help.b1", "consumerCases.help.b2"],
    },
  },
  {
    id: "consumer.case.detail",
    routes: ["/consumer/cases/*"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-case-tabs]",
        titleKey: "consumerCaseDetail.tabs.title",
        bodyKey: "consumerCaseDetail.tabs.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerCaseDetail.help.title",
      bullets: ["consumerCaseDetail.help.b1", "consumerCaseDetail.help.b2"],
    },
  },
  {
    id: "consumer.subscription",
    routes: ["/consumer/subscription"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-plans]",
        titleKey: "consumerSubscription.plans.title",
        bodyKey: "consumerSubscription.plans.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerSubscription.help.title",
      bullets: ["consumerSubscription.help.b1", "consumerSubscription.help.b2", "consumerSubscription.help.b3"],
    },
  },
  {
    id: "consumer.settings",
    routes: ["/consumer/settings"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-settings-hub]",
        titleKey: "consumerSettings.hub.title",
        bodyKey: "consumerSettings.hub.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerSettings.help.title",
      bullets: ["consumerSettings.help.b1", "consumerSettings.help.b2", "consumerSettings.help.b3"],
    },
  },
  {
    id: "consumer.findLawyer",
    routes: ["/consumer/find-lawyer"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-find-lawyer-search]",
        titleKey: "consumerFindLawyer.search.title",
        bodyKey: "consumerFindLawyer.search.body",
      },
      {
        element: "[data-tour=consumer-find-lawyer-results]",
        titleKey: "consumerFindLawyer.results.title",
        bodyKey: "consumerFindLawyer.results.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerFindLawyer.help.title",
      bullets: ["consumerFindLawyer.help.b1", "consumerFindLawyer.help.b2", "consumerFindLawyer.help.b3"],
    },
  },
  {
    id: "consumer.research",
    routes: ["/consumer/research"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=research-query]",
        titleKey: "consumerResearch.query.title",
        bodyKey: "consumerResearch.query.body",
      },
      {
        element: "[data-tour=research-sources]",
        titleKey: "consumerResearch.sources.title",
        bodyKey: "consumerResearch.sources.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerResearch.help.title",
      bullets: ["consumerResearch.help.b1", "consumerResearch.help.b2", "consumerResearch.help.b3"],
    },
  },
  {
    id: "consumer.documentDrafting",
    routes: ["/consumer/document-drafting"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-drafting-intro]",
        titleKey: "consumerDocumentDrafting.intro.title",
        bodyKey: "consumerDocumentDrafting.intro.body",
      },
      {
        element: "[data-tour=consumer-drafting-workspace]",
        titleKey: "consumerDocumentDrafting.workspace.title",
        bodyKey: "consumerDocumentDrafting.workspace.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerDocumentDrafting.help.title",
      bullets: ["consumerDocumentDrafting.help.b1", "consumerDocumentDrafting.help.b2", "consumerDocumentDrafting.help.b3"],
    },
  },
  {
    id: "consumer.documentReview",
    routes: ["/consumer/document-review"],
    autoStart: true,
    steps: [
      { element: "[data-tour=document-review-header]", titleKey: "consumerDocumentReview.header.title", bodyKey: "consumerDocumentReview.header.body", side: "bottom" },
      { element: "[data-tour=document-review-mode]", titleKey: "consumerDocumentReview.mode.title", bodyKey: "consumerDocumentReview.mode.body", side: "bottom" },
      { element: "[data-tour=document-review-recent]", titleKey: "consumerDocumentReview.recent.title", bodyKey: "consumerDocumentReview.recent.body", side: "right" },
      { element: "[data-tour=document-review-input-mode]", titleKey: "consumerDocumentReview.inputMode.title", bodyKey: "consumerDocumentReview.inputMode.body", side: "right" },
      { element: "[data-tour=document-review-upload]", titleKey: "consumerDocumentReview.upload.title", bodyKey: "consumerDocumentReview.upload.body", side: "right" },
      { element: "[data-tour=document-review-options]", titleKey: "consumerDocumentReview.options.title", bodyKey: "consumerDocumentReview.options.body", side: "right" },
      { element: "[data-tour=document-review-ai-model]", titleKey: "consumerDocumentReview.aiModel.title", bodyKey: "consumerDocumentReview.aiModel.body", side: "right" },
      { element: "[data-tour=document-review-analyze]", titleKey: "consumerDocumentReview.analyze.title", bodyKey: "consumerDocumentReview.analyze.body", side: "top" },
      { element: "[data-tour=document-review-empty]", titleKey: "consumerDocumentReview.empty.title", bodyKey: "consumerDocumentReview.empty.body", side: "left" },
    ],
    helpPanel: {
      titleKey: "consumerDocumentReview.help.title",
      bullets: ["consumerDocumentReview.help.b1", "consumerDocumentReview.help.b2", "consumerDocumentReview.help.b3"],
    },
  },
  {
    id: "consumer.documentReview.results",
    routes: [],
    steps: [
      { element: "[data-tour=document-review-highlights]", titleKey: "consumerDocumentReview.highlights.title", bodyKey: "consumerDocumentReview.highlights.body", side: "bottom" },
      { element: "[data-tour=document-review-stats]", titleKey: "consumerDocumentReview.stats.title", bodyKey: "consumerDocumentReview.stats.body", side: "left" },
      { element: "[data-tour=document-review-tabs]", titleKey: "consumerDocumentReview.tabs.title", bodyKey: "consumerDocumentReview.tabs.body", side: "bottom" },
      { element: "[data-tour=document-review-amendments]", titleKey: "consumerDocumentReview.amendments.title", bodyKey: "consumerDocumentReview.amendments.body", side: "bottom" },
      { element: "[data-tour=document-review-save]", titleKey: "consumerDocumentReview.save.title", bodyKey: "consumerDocumentReview.save.body", side: "bottom" },
      { element: "[data-tour=document-review-followup]", titleKey: "consumerDocumentReview.followup.title", bodyKey: "consumerDocumentReview.followup.body", side: "top" },
    ],
    helpPanel: {
      titleKey: "consumerDocumentReview.help.title",
      bullets: ["consumerDocumentReview.help.b1", "consumerDocumentReview.help.b2", "consumerDocumentReview.help.b3"],
    },
  },
  {
    id: "consumer.planUsage",
    routes: ["/consumer/plan-usage"],
    autoStart: true,
    steps: [
      {
        element: "[data-tour=consumer-plan-usage]",
        titleKey: "consumerPlanUsage.usage.title",
        bodyKey: "consumerPlanUsage.usage.body",
      },
    ],
    helpPanel: {
      titleKey: "consumerPlanUsage.help.title",
      bullets: ["consumerPlanUsage.help.b1", "consumerPlanUsage.help.b2"],
    },
  },
  {
    id: "consumer.reports",
    routes: ["/consumer/reports"],
    autoStart: true,
    steps: [
      { element: "[data-tour=consumer-reports-list]", titleKey: "consumerReports.list.title", bodyKey: "consumerReports.list.body" },
    ],
    helpPanel: { titleKey: "consumerReports.help.title", bullets: ["consumerReports.help.b1", "consumerReports.help.b2"] },
  },
  {
    id: "consumer.lawyerReview",
    routes: ["/consumer/lawyer-review"],
    autoStart: true,
    steps: [
      { element: "[data-tour=consumer-lawyer-review]", titleKey: "consumerLawyerReview.request.title", bodyKey: "consumerLawyerReview.request.body" },
    ],
    helpPanel: { titleKey: "consumerLawyerReview.help.title", bullets: ["consumerLawyerReview.help.b1", "consumerLawyerReview.help.b2", "consumerLawyerReview.help.b3"] },
  },
  {
    id: "consumer.settingsPaymentMethods",
    routes: ["/consumer/settings/payment-methods"],
    autoStart: true,
    steps: [
      { element: "[data-tour=consumer-payment-methods]", titleKey: "consumerSettingsPayment.methods.title", bodyKey: "consumerSettingsPayment.methods.body" },
    ],
    helpPanel: { titleKey: "consumerSettingsPayment.help.title", bullets: ["consumerSettingsPayment.help.b1", "consumerSettingsPayment.help.b2"] },
  },
  {
    id: "consumer.settingsDataConsent",
    routes: ["/consumer/settings/data-consent"],
    autoStart: true,
    steps: [
      { element: "[data-tour=consumer-data-consent]", titleKey: "consumerSettingsConsent.form.title", bodyKey: "consumerSettingsConsent.form.body" },
    ],
    helpPanel: { titleKey: "consumerSettingsConsent.help.title", bullets: ["consumerSettingsConsent.help.b1", "consumerSettingsConsent.help.b2"] },
  },
  {
    id: "consumer.indiaDrafting",
    routes: ["/consumer/india-drafting"],
    autoStart: true,
    steps: [
      { element: "[data-tour=consumer-india-drafting-intro]", titleKey: "consumerIndiaDrafting.intro.title", bodyKey: "consumerIndiaDrafting.intro.body" },
      { element: "[data-tour=consumer-india-drafting-workspace]", titleKey: "consumerIndiaDrafting.workspace.title", bodyKey: "consumerIndiaDrafting.workspace.body" },
    ],
    helpPanel: { titleKey: "consumerIndiaDrafting.help.title", bullets: ["consumerIndiaDrafting.help.b1", "consumerIndiaDrafting.help.b2"] },
  },
  {
    id: "consumer.sectionFinder",
    routes: ["/consumer/section-finder"],
    autoStart: true,
    steps: [
      { element: "[data-tour=section-finder-workspace]", titleKey: "consumerSectionFinder.workspace.title", bodyKey: "consumerSectionFinder.workspace.body" },
    ],
    helpPanel: { titleKey: "consumerSectionFinder.help.title", bullets: ["consumerSectionFinder.help.b1", "consumerSectionFinder.help.b2"] },
  },
  {
    id: "consumer.firAnalysis",
    routes: ["/consumer/fir-analysis"],
    autoStart: true,
    steps: [
      { element: "[data-tour=fir-intro]", titleKey: "consumerFirAnalysis.intro.title", bodyKey: "consumerFirAnalysis.intro.body" },
      { element: "[data-tour=fir-uploader]", titleKey: "consumerFirAnalysis.upload.title", bodyKey: "consumerFirAnalysis.upload.body" },
    ],
    helpPanel: { titleKey: "consumerFirAnalysis.help.title", bullets: ["consumerFirAnalysis.help.b1", "consumerFirAnalysis.help.b2"] },
  },
  {
    id: "consumer.rightsChecker",
    routes: ["/consumer/rights-checker"],
    autoStart: true,
    steps: [
      { element: "[data-tour=rights-scenarios]", titleKey: "consumerRightsChecker.scenarios.title", bodyKey: "consumerRightsChecker.scenarios.body" },
    ],
    helpPanel: { titleKey: "consumerRightsChecker.help.title", bullets: ["consumerRightsChecker.help.b1", "consumerRightsChecker.help.b2"] },
  },
  {
    id: "consumer.marketplace",
    routes: ["/consumer/marketplace"],
    autoStart: true,
    steps: [
      { element: "[data-tour=marketplace-skus]", titleKey: "consumerMarketplace.skus.title", bodyKey: "consumerMarketplace.skus.body" },
    ],
    helpPanel: { titleKey: "consumerMarketplace.help.title", bullets: ["consumerMarketplace.help.b1", "consumerMarketplace.help.b2"] },
  },
]

export function getToursForZone(zone: "lawyer" | "consumer"): TourDefinition[] {
  return zone === "consumer" ? CONSUMER_PAGE_TOURS : LAWYER_PAGE_TOURS
}

/** All tours including shell tour (lawyer only) for progress tracking — excludes programmatic-only tours (empty routes) */
export function getAllToursForZone(zone: "lawyer" | "consumer"): TourDefinition[] {
  const base = zone === "lawyer" ? [SHELL_TOUR, ...LAWYER_PAGE_TOURS] : CONSUMER_PAGE_TOURS
  return base.filter((t) => t.routes.length > 0)
}

export function getTourById(
  zone: "lawyer" | "consumer",
  tourId: string,
): TourDefinition | undefined {
  return getToursForZone(zone).find((t) => t.id === tourId)
}
