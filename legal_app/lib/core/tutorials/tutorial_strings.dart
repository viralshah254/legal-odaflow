/// English tutorial copy aligned with shared/i18n/en/tutorials.json.
/// Swap to AppLocalizations when ARB ICU issues are resolved.
class TutorialStrings {
  TutorialStrings._();

  // ── Welcome sheet — generic (dashboard) ──────────────────────────────────

  static const welcomeTitle = 'Welcome to Umbrella';
  static const welcomeBody =
      'Take a quick tour to learn how to navigate your firm workspace.';
  static const welcomeB1 = 'Find clients, matters, and billing in seconds';
  static const welcomeB2 = 'Use AI Copilot for context-aware help';
  static const welcomeB3 = 'Replay tours anytime from the Help icon';
  static const welcomeStart = 'Start tour';
  static const welcomeSkip = 'Skip for now';

  // ── Welcome sheet — per-screen body & bullets ─────────────────────────────

  static const mattersWelcomeBody =
      'See how to manage your cases, apply filters, and create new matters.';
  static const mattersWelcomeBullet1 =
      'Browse and filter all open and closed matters';
  static const mattersWelcomeBullet2 =
      'Tap any matter for details, documents, and AI insights';
  static const mattersWelcomeBullet3 =
      'Create a new matter with the + button';

  static const clientsWelcomeBody =
      'Discover how to find, view, and add clients to your firm.';
  static const clientsWelcomeBullet1 =
      'Search clients by name or email instantly';
  static const clientsWelcomeBullet2 =
      'Tap a card to view their profile and linked matters';
  static const clientsWelcomeBullet3 = 'Add a new client with the + button';

  static const billingWelcomeBody =
      'Get an overview of your invoices, payments, and outstanding amounts.';
  static const billingWelcomeBullet1 =
      'See total invoiced, outstanding, and collected amounts';
  static const billingWelcomeBullet2 =
      'Switch between invoices and recorded payments';
  static const billingWelcomeBullet3 = 'Tap an invoice to view or manage it';

  static const consumerWelcomeBody =
      'Learn how to track your cases and get legal help fast.';
  static const consumerWelcomeBullet1 =
      'View all your active and past legal cases';
  static const consumerWelcomeBullet2 =
      'Use quick actions to get help or check credits';
  static const consumerWelcomeBullet3 =
      'Replay this tour anytime from the Help icon';

  // ── Dashboard ────────────────────────────────────────────────────────────

  static const lawyerSearchTitle = 'Global search';
  static const lawyerSearchBody =
      'Search clients, matters, documents, and tasks from anywhere in the app.';
  static const lawyerStatsTitle = 'Firm snapshot';
  static const lawyerStatsBody =
      'These cards summarize open matters, overdue tasks, leads, and today\'s calendar events.';
  static const lawyerActionsTitle = 'AI tools';
  static const lawyerActionsBody =
      'Run client intake, legal research, document drafting, and review — all powered by AI.';

  // ── Matters ──────────────────────────────────────────────────────────────

  static const lawyerMattersListTitle = 'Your matters';
  static const lawyerMattersListBody =
      'All open and closed cases appear here. Tap a matter to view details, documents, and AI insights.';
  static const lawyerMattersCreateTitle = 'Create a matter';
  static const lawyerMattersCreateBody =
      'Start a new case for a client. You can link clients, set practice area, and add notes immediately.';

  // ── Clients ──────────────────────────────────────────────────────────────

  static const lawyerClientsSearchTitle = 'Search clients';
  static const lawyerClientsSearchBody =
      'Find any client by name or email. All contacts are listed here — tap a card to see their profile and linked matters.';
  static const lawyerClientsCreateTitle = 'Add a client';
  static const lawyerClientsCreateBody =
      'Create a new client profile in seconds. You can add more details and link matters from the client page.';

  // ── Billing ──────────────────────────────────────────────────────────────

  static const lawyerBillingStatsTitle = 'Billing overview';
  static const lawyerBillingStatsBody =
      'See total invoiced, outstanding, and collected amounts across all your matters at a glance.';
  static const lawyerBillingTabsTitle = 'Invoices & Payments';
  static const lawyerBillingTabsBody =
      'Switch between invoices and recorded payments. Tap an invoice to view or manage it.';

  // ── Consumer ─────────────────────────────────────────────────────────────

  static const consumerCasesTitle = 'Your cases';
  static const consumerCasesBody =
      'Active legal matters appear here. Tap a case to view updates and documents.';
  static const consumerActionsTitle = 'Get help fast';
  static const consumerActionsBody =
      'Start a new case, check credits, or contact your legal team from these shortcuts.';
}
