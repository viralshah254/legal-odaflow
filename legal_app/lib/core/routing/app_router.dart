import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../tutorials/tutorial_theme.dart';
import 'lawyer_shell_scope.dart';

import '../../l10n/app_localizations.dart';
import '../providers/app_providers.dart';
import '../../features/auth/auth_screen.dart';
import '../../features/auth/sign_up_screen.dart';
import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/change_password_screen.dart';
import '../../features/auth/welcome_screen.dart';
import '../../features/consumer/account/consumer_account_screen.dart';
import '../../features/consumer/cases/cases_list_screen.dart';
import '../../features/consumer/cases/workspace/case_workspace_shell.dart';
import '../../features/consumer/cases/workspace/tabs/case_consent_tab.dart';
import '../../features/consumer/cases/workspace/tabs/case_lawyer_review_tab.dart';
import '../../features/consumer/cases/workspace/tabs/case_documents_tab.dart';
import '../../features/consumer/cases/workspace/tabs/case_drafts_tab.dart';
import '../../features/consumer/cases/workspace/tabs/case_home_tab.dart';
import '../../features/consumer/cases/workspace/tabs/case_messages_tab.dart';
import '../../features/consumer/cases/workspace/tabs/case_payments_tab.dart';
import '../../features/consumer/cases/workspace/tabs/case_report_tab.dart';
import '../../features/consumer/dashboard/consumer_dashboard_screen.dart';
import '../../features/consumer/document_upload/document_upload_screen.dart';
import '../../features/consumer/issue_checker/issue_checker_screen.dart';
import '../../features/consumer/lawyer_review/lawyer_review_screen.dart';
import '../../features/consumer/portal/consumer_portal_screen.dart';
import '../../features/consumer/reports/reports_screen.dart';
import '../../features/lawyer/alerts/alerts_screen.dart';
import '../../features/lawyer/billing/billing_screen.dart';
import '../../features/lawyer/clients/client_detail_screen.dart';
import '../../features/lawyer/clients/clients_list_screen.dart';
import '../../features/lawyer/dashboard/lawyer_dashboard_screen.dart';
import '../../features/lawyer/leads/lead_detail_screen.dart';
import '../../features/lawyer/leads/leads_inbox_screen.dart';
import '../../features/lawyer/profile/lawyer_profile_screen.dart';
import '../../features/lawyer/matter_ai/matter_ai_screen.dart';
import '../../features/lawyer/matters/create_matter_screen.dart';
import '../../features/lawyer/matters/generate_document_screen.dart';
import '../../features/lawyer/matters/matter_detail_screen.dart';
import '../../features/lawyer/matters/matter_draft_screen.dart';
import '../../features/lawyer/matters/matters_list_screen.dart';
import '../../features/lawyer/notifications/notifications_inbox_screen.dart';
import '../../features/lawyer/tasks/lawyer_tasks_screen.dart';
import '../../features/lawyer/intake/client_intake_screen.dart';
import '../../features/lawyer/research/legal_research_screen.dart';
import '../../features/lawyer/research/research_job_screen.dart';
import '../../features/lawyer/document_review/document_review_screen.dart';
import '../../features/lawyer/section_finder/section_finder_screen.dart';
import '../../features/lawyer/fir_analysis/fir_analysis_screen.dart';
import '../../features/lawyer/docu_draft/docu_draft_hub_screen.dart';
import '../../features/lawyer/docu_draft/docu_draft_workspace_screen.dart';
import '../../features/lawyer/docu_draft/saved_drafts_screen.dart';
import '../../core/models/draft_verification.dart';
import '../../features/lawyer/finance/finance_dashboard_screen.dart';
import '../../features/lawyer/team/team_screen.dart';
import '../../features/lawyer/ai/ai_command_center_screen.dart';
import '../../features/consumer/document_review/consumer_document_review_screen.dart';
import '../../features/consumer/research/consumer_research_screen.dart';
import '../../features/lawyer/time/time_log_screen.dart';
import '../../features/lawyer/trust/trust_screen.dart';
import '../../features/lawyer/calendar/calendar_screen.dart';
import '../../features/lawyer/evidence/evidence_vault_screen.dart';
import '../../features/lawyer/meetings/meeting_detail_screen.dart';
import '../../features/lawyer/meetings/meetings_screen.dart';
import '../../features/lawyer/forms/legal_forms_screen.dart';
import '../../features/lawyer/court/court_screen.dart';
import '../../features/lawyer/monitors/monitors_screen.dart';
import '../../features/lawyer/document_review/tabular_review_screen.dart';
import '../../features/lawyer/matters/matter_parties_screen.dart';
import '../../features/lawyer/matters/matter_diligence_screen.dart';
import '../../features/lawyer/smart_workspace/smart_workspace_screen.dart';
import '../../features/lawyer/documents/document_vault_screen.dart';
import '../../features/lawyer/inbox/inbox_screen.dart';
import '../../features/lawyer/queues/queues_screen.dart';
import '../../features/lawyer/automations/automations_screen.dart';
import '../../features/lawyer/agents/agents_screen.dart';
import '../../features/lawyer/esign/esign_screen.dart';
import '../../features/lawyer/templates/templates_screen.dart';
import '../../features/lawyer/finance/expenses_screen.dart';
import '../../features/lawyer/finance/invoices_screen.dart';
import '../../features/settings/settings_users_screen.dart';
import '../../features/settings/settings_integrations_screen.dart';
import '../../features/onboarding/country_selector_screen.dart';
import '../../features/onboarding/language_selector_screen.dart';
import '../../features/settings/account_settings_screen.dart';
import '../../features/settings/ai_usage_settings_screen.dart';
import '../../features/settings/data_consent_screen.dart';
import '../../features/settings/privacy_security_screen.dart';
import '../../features/settings/delete_account_screen.dart';
import '../../features/consumer/subscription/subscriptions_screen.dart';
import '../routing/page_transitions.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/splash/splash_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  // Read auth/country inside redirect only — watching here recreates GoRouter on
  // every country change and resets navigation to /splash.
  final refreshListenable = _RouterRefreshListenable(ref);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final countryCodeAsync = ref.read(countryCodeProvider);

      final location = state.matchedLocation;
      final isSplash = location == '/splash';
      final isWelcome = location == '/welcome';
      final isOnboarding = location.startsWith('/onboarding/');
      final isAuthRoute =
          location == '/auth' ||
          location.startsWith('/auth/sign-in') ||
          location.startsWith('/auth/sign-up') ||
          location.startsWith('/auth/forgot-password') ||
          location.startsWith('/auth/change-password');
      final isIssueChecker = location == '/consumer/issue-checker';

      if (authState.isBootstrapping) {
        return isSplash ? null : '/splash';
      }

      final session = authState.session;
      if (session != null) {
        // Let the splash screen handle its own navigation after the timer.
        if (isSplash) return null;

        if (session.user.mustChangePassword &&
            !location.startsWith('/auth/change-password')) {
          return '/auth/change-password';
        }

        if (isWelcome || isOnboarding || isAuthRoute) {
          if (location.startsWith('/auth/change-password') &&
              session.user.mustChangePassword) {
            return null;
          }
          return session.user.isLawyer ? '/lawyer' : '/consumer';
        }
        if (session.user.isLawyer && location.startsWith('/consumer')) {
          return '/lawyer';
        }
        if (session.user.isConsumer && location.startsWith('/lawyer')) {
          return '/consumer';
        }
        return null;
      }

      final countryCode = countryCodeAsync.maybeWhen(
        data: (value) => value,
        orElse: () => null,
      );

      if (countryCode == null &&
          !isOnboarding &&
          !isSplash &&
          !isWelcome &&
          !isAuthRoute &&
          !isIssueChecker) {
        return '/onboarding/country';
      }

      if (isSplash) {
        // Let SplashScreen drive its own navigation after the 8s timer.
        return null;
      }

      if (!isWelcome && !isAuthRoute && !isOnboarding && !isIssueChecker) {
        return '/welcome';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/welcome',
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: '/onboarding/country',
        builder: (context, state) => const CountrySelectorScreen(),
      ),
      GoRoute(
        path: '/onboarding/language',
        builder: (context, state) => LanguageSelectorScreen(
          countryCode: state.uri.queryParameters['country'],
        ),
      ),
      GoRoute(
        path: '/auth',
        builder: (context, state) => AuthScreen(
          initialReferralCode: state.uri.queryParameters['ref'],
        ),
      ),
      GoRoute(
        path: '/auth/sign-in',
        redirect: (context, state) => '/auth',
      ),
      GoRoute(
        path: '/auth/sign-up',
        builder: (context, state) => SignUpScreen(
          initialEmail: state.uri.queryParameters['email'],
          initialReferralCode: state.uri.queryParameters['ref'],
        ),
      ),
      GoRoute(
        path: '/auth/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/auth/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      // Consumer shell — persistent bottom nav for 4 tabs
      ShellRoute(
        builder: (context, state, child) => ConsumerShell(child: child),
        routes: [
          GoRoute(
            path: '/consumer',
            builder: (context, state) => const ConsumerDashboardScreen(),
          ),
          GoRoute(
            path: '/consumer/cases',
            builder: (context, state) => const CasesListScreen(),
          ),
          GoRoute(
            path: '/consumer/portal',
            builder: (context, state) => const ConsumerPortalScreen(),
          ),
          GoRoute(
            path: '/consumer/account',
            builder: (context, state) => const ConsumerAccountScreen(),
          ),
        ],
      ),
      // Full-screen consumer routes (no nav bar)
      ShellRoute(
        builder: (context, state, child) {
          final caseId = state.pathParameters['id'];
          if (caseId == null) return child;
          return CaseWorkspaceShell(caseId: caseId, child: child);
        },
        routes: [
          GoRoute(
            path: '/consumer/cases/:id',
            builder: (context, state) =>
                CaseHomeTab(caseId: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'report',
                builder: (context, state) =>
                    CaseReportTab(caseId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'documents',
                builder: (context, state) =>
                    CaseDocumentsTab(caseId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'drafts',
                builder: (context, state) =>
                    CaseDraftsTab(caseId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'messages',
                builder: (context, state) =>
                    CaseMessagesTab(caseId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'payments',
                builder: (context, state) =>
                    CasePaymentsTab(caseId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'consent',
                builder: (context, state) =>
                    CaseConsentTab(caseId: state.pathParameters['id']!),
              ),
              GoRoute(
                path: 'lawyer-review',
                builder: (context, state) => CaseLawyerReviewTab(
                  caseId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/consumer/issue-checker',
        builder: (context, state) => IssueCheckerScreen(
          previewMode: state.uri.queryParameters['preview'] == 'true',
          upgradeMode: state.uri.queryParameters['upgrade'] == '1',
          attachMode: state.uri.queryParameters['attach'] == '1',
        ),
      ),
      GoRoute(
        path: '/consumer/reports',
        pageBuilder: (context, state) => fadeSlidePage<void>(
          key: state.pageKey,
          child: const ReportsScreen(),
        ),
      ),
      GoRoute(
        path: '/consumer/subscription',
        pageBuilder: (context, state) => modalSlidePage<void>(
          key: state.pageKey,
          child: const SubscriptionsScreen(),
        ),
      ),
      GoRoute(
        path: '/consumer/documents',
        builder: (context, state) {
          final caseId = state.uri.queryParameters['caseId'];
          return DocumentUploadScreen(initialCaseId: caseId);
        },
      ),
      GoRoute(
        path: '/consumer/lawyer-review',
        builder: (context, state) => const LawyerReviewScreen(),
      ),
      GoRoute(
        path: '/consumer/document-review',
        pageBuilder: (context, state) => fadeSlidePage<void>(
          key: state.pageKey,
          child: const ConsumerDocumentReviewScreen(),
        ),
      ),
      GoRoute(
        path: '/consumer/research',
        pageBuilder: (context, state) => fadeSlidePage<void>(
          key: state.pageKey,
          child: const ConsumerResearchScreen(),
        ),
      ),
      GoRoute(
        path: '/consumer/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/consumer/settings/ai-usage',
        builder: (context, state) => const AiUsageSettingsScreen(),
      ),
      GoRoute(
        path: '/consumer/settings/account',
        builder: (context, state) => const AccountSettingsScreen(),
      ),
      GoRoute(
        path: '/consumer/settings/data-consent',
        builder: (context, state) => const DataConsentScreen(),
      ),
      GoRoute(
        path: '/consumer/settings/privacy-security',
        builder: (context, state) => const PrivacySecurityScreen(),
      ),
      GoRoute(
        path: '/consumer/settings/delete-account',
        builder: (context, state) => const DeleteAccountScreen(),
      ),
      GoRoute(
        path: '/consumer/settings/language',
        builder: (context, state) => const LanguageSelectorScreen(
          fromSettings: true,
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => LawyerModeShell(child: child),
        routes: [
          GoRoute(
            path: '/lawyer',
            builder: (context, state) => const LawyerDashboardScreen(),
          ),
          GoRoute(
            path: '/lawyer/matters',
            builder: (context, state) => const MattersListScreen(),
          ),
          GoRoute(
            path: '/lawyer/matters/new',
            builder: (context, state) => CreateMatterScreen(
              initialClientId: state.uri.queryParameters['clientId'],
            ),
          ),
          GoRoute(
            path: '/lawyer/matters/:id',
            builder: (context, state) =>
                MatterDetailScreen(matterId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/lawyer/clients',
            builder: (context, state) => const ClientsListScreen(),
          ),
          GoRoute(
            path: '/lawyer/clients/:clientId',
            builder: (context, state) =>
                ClientDetailScreen(clientId: state.pathParameters['clientId']!),
          ),
          GoRoute(
            path: '/lawyer/finance',
            builder: (context, state) => const FinanceDashboardScreen(),
          ),
          GoRoute(
            path: '/lawyer/team',
            builder: (context, state) => const TeamScreen(),
          ),
          GoRoute(
            path: '/lawyer/ai',
            builder: (context, state) => const AiCommandCenterScreen(),
          ),
          GoRoute(
            path: '/lawyer/billing',
            builder: (context, state) => const BillingScreen(),
          ),
          GoRoute(
            path: '/lawyer/trust',
            builder: (context, state) => const TrustScreen(),
          ),
          GoRoute(
            path: '/lawyer/calendar',
            builder: (context, state) => const CalendarScreen(),
          ),
          GoRoute(
            path: '/lawyer/meetings',
            builder: (context, state) => const MeetingsScreen(),
          ),
          GoRoute(
            path: '/lawyer/meetings/:id',
            builder: (context, state) => MeetingDetailScreen(
              meetingId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/lawyer/matters/:id/draft',
            builder: (context, state) =>
                MatterDraftScreen(matterId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/lawyer/matters/:id/evidence',
            builder: (context, state) => EvidenceVaultScreen(
              matterId: state.pathParameters['id']!,
              matterTitle: state.uri.queryParameters['title'] ?? 'Matter',
            ),
          ),
          GoRoute(
            path: '/lawyer/matters/:id/ai',
            builder: (context, state) =>
                MatterAiScreen(matterId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/lawyer/matters/:id/generate-document',
            builder: (context, state) =>
                GenerateDocumentScreen(matterId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/lawyer/matters/:id/parties',
            builder: (context, state) => MatterPartiesScreen(
              matterId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/lawyer/matters/:id/diligence',
            builder: (context, state) => MatterDiligenceScreen(
              matterId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/lawyer/matters/:id/workspace',
            builder: (context, state) => SmartWorkspaceScreen(
              matterId: state.pathParameters['id']!,
              matterTitle: state.uri.queryParameters['title'],
            ),
          ),
          GoRoute(
            path: '/lawyer/vault',
            builder: (context, state) => const DocumentVaultScreen(),
          ),
          GoRoute(
            path: '/lawyer/inbox',
            builder: (context, state) => const InboxScreen(),
          ),
          GoRoute(
            path: '/lawyer/queues',
            builder: (context, state) => const QueuesScreen(),
          ),
          GoRoute(
            path: '/lawyer/automations',
            builder: (context, state) => const AutomationsScreen(),
          ),
          GoRoute(
            path: '/lawyer/agents',
            builder: (context, state) => const AgentsScreen(),
          ),
          GoRoute(
            path: '/lawyer/esign',
            builder: (context, state) => const EsignScreen(),
          ),
          GoRoute(
            path: '/lawyer/templates',
            builder: (context, state) => const TemplatesScreen(),
          ),
          GoRoute(
            path: '/lawyer/expenses',
            builder: (context, state) => const ExpensesScreen(),
          ),
          GoRoute(
            path: '/lawyer/invoices',
            builder: (context, state) => const InvoicesScreen(),
          ),
          GoRoute(
            path: '/lawyer/settings/users',
            builder: (context, state) => const SettingsUsersScreen(),
          ),
          GoRoute(
            path: '/lawyer/settings/integrations',
            builder: (context, state) => const SettingsIntegrationsScreen(),
          ),
          GoRoute(
            path: '/lawyer/settings',
            builder: (context, state) =>
                const SettingsScreen(isLawyerMode: true),
          ),
          GoRoute(
            path: '/lawyer/settings/ai-usage',
            builder: (context, state) =>
                const AiUsageSettingsScreen(isLawyerMode: true),
          ),
          GoRoute(
            path: '/lawyer/settings/account',
            builder: (context, state) =>
                const AccountSettingsScreen(isLawyerMode: true),
          ),
          GoRoute(
            path: '/lawyer/settings/data-consent',
            builder: (context, state) =>
                const DataConsentScreen(isLawyerMode: true),
          ),
          GoRoute(
            path: '/lawyer/settings/privacy-security',
            builder: (context, state) =>
                const PrivacySecurityScreen(isLawyerMode: true),
          ),
          GoRoute(
            path: '/lawyer/settings/delete-account',
            builder: (context, state) =>
                const DeleteAccountScreen(isLawyerMode: true),
          ),
          GoRoute(
            path: '/lawyer/settings/language',
            builder: (context, state) => const LanguageSelectorScreen(
              fromSettings: true,
            ),
          ),
          GoRoute(
            path: '/lawyer/tasks',
            builder: (context, state) => const LawyerTasksScreen(),
          ),
          GoRoute(
            path: '/lawyer/notifications',
            builder: (context, state) => const NotificationsInboxScreen(),
          ),
          GoRoute(
            path: '/lawyer/time',
            builder: (context, state) => const TimeLogScreen(),
          ),
          GoRoute(
            path: '/lawyer/alerts',
            builder: (context, state) => const AlertsScreen(),
          ),
          GoRoute(
            path: '/lawyer/leads',
            builder: (context, state) => const LeadsInboxScreen(),
          ),
          GoRoute(
            path: '/lawyer/leads/:leadId',
            builder: (context, state) => LeadDetailScreen(
              leadId: state.pathParameters['leadId']!,
            ),
          ),
          GoRoute(
            path: '/lawyer/profile',
            builder: (context, state) => const LawyerProfileScreen(),
          ),
          GoRoute(
            path: '/lawyer/research',
            builder: (context, state) => const LegalResearchScreen(),
            routes: [
              GoRoute(
                path: ':jobId',
                builder: (context, state) {
                  final q = state.uri.queryParameters;
                  return ResearchJobScreen(
                    jobId: state.pathParameters['jobId']!,
                    query: q['q'],
                    countryCode: q['country'],
                    jurisdiction: q['jurisdiction'],
                  );
                },
              ),
            ],
          ),
          GoRoute(
            path: '/lawyer/document-review',
            builder: (context, state) => const DocumentReviewScreen(),
          ),
          GoRoute(
            path: '/lawyer/intake',
            builder: (context, state) => const ClientIntakeScreen(),
          ),
          GoRoute(
            path: '/lawyer/forms',
            builder: (context, state) => const LegalFormsScreen(),
          ),
          GoRoute(
            path: '/lawyer/court',
            builder: (context, state) => const CourtScreen(),
          ),
          GoRoute(
            path: '/lawyer/section-finder',
            builder: (context, state) => const SectionFinderScreen(),
          ),
          GoRoute(
            path: '/lawyer/fir-analysis',
            builder: (context, state) => const FirAnalysisScreen(),
          ),
          GoRoute(
            path: '/lawyer/docu-draft',
            builder: (context, state) {
              return DocuDraftHubScreen(
                prefillQuery: state.uri.queryParameters['q'],
                prefillKind: state.uri.queryParameters['kind'],
              );
            },
            routes: [
              GoRoute(
                path: 'draft',
                builder: (context, state) {
                  final q = state.uri.queryParameters;
                  final pinSection = q['pinSection'];
                  final pinned = <PinnedSection>[
                    if (pinSection != null && pinSection.isNotEmpty)
                      PinnedSection(
                        section: pinSection,
                        label: q['pinLabel'] ?? pinSection,
                        textExcerpt: q['pinExcerpt'],
                        source: 'section_finder',
                      ),
                  ];
                  return DocuDraftWorkspaceScreen(
                    kind: q['kind'],
                    label: q['label'],
                    details: q['details'],
                    clientName: q['clientName'],
                    courtName: q['courtName'],
                    opposingParty: q['opposingParty'],
                    countryCode: q['countryCode'] ?? 'IN',
                    autoGenerate: q['autoGenerate'] == '1',
                    draftId: q['draftId'],
                    initialPinnedSections: pinned,
                  );
                },
              ),
              GoRoute(
                path: 'saved',
                builder: (context, state) => const SavedDraftsScreen(),
              ),
            ],
          ),
          GoRoute(
            path: '/lawyer/india-drafting',
            redirect: (context, state) {
              final q = state.uri.query;
              return '/lawyer/docu-draft$q';
            },
          ),
          GoRoute(
            path: '/lawyer/monitors',
            builder: (context, state) => const MonitorsScreen(),
          ),
          GoRoute(
            path: '/lawyer/document-review/tabular',
            builder: (context, state) => const TabularReviewScreen(),
          ),
        ],
      ),
    ],
  );
});

class LawyerModeShell extends ConsumerStatefulWidget {
  const LawyerModeShell({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<LawyerModeShell> createState() => _LawyerModeShellState();
}

class _LawyerModeShellState extends ConsumerState<LawyerModeShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  int _navIndexForLocation(String location) {
    if (location.startsWith('/lawyer/matters')) return 1;
    if (location.startsWith('/lawyer/clients')) return 2;
    if (location.startsWith('/lawyer/calendar')) return 3;
    return 0;
  }

  void _openMenuDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final location = GoRouterState.of(context).matchedLocation;
    final index = _navIndexForLocation(location);

    return UmbrellaShowcaseScope(
      builder: (context) => Scaffold(
        key: _scaffoldKey,
        drawer: _LawyerNavDrawer(
          onNavigate: (route) {
            Navigator.of(context).pop();
            context.go(route);
          },
        ),
        body: LawyerShellScope(
          openMenu: _openMenuDrawer,
          child: widget.child,
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (value) {
            switch (value) {
              case 0:
                context.go('/lawyer');
              case 1:
                if (location == '/lawyer/matters') {
                  ref.read(mattersListRefreshProvider.notifier).state++;
                }
                context.go('/lawyer/matters');
              case 2:
                context.go('/lawyer/clients');
              case 3:
                context.go('/lawyer/calendar');
            }
          },
          destinations: [
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard),
              label: l10n.lawyerNavDashboard,
            ),
            NavigationDestination(
              icon: Icon(Icons.folder_open_outlined),
              selectedIcon: Icon(Icons.folder_open),
              label: l10n.lawyerNavMatters,
            ),
            NavigationDestination(
              icon: Icon(Icons.people_outline),
              selectedIcon: Icon(Icons.people),
              label: l10n.lawyerNavClients,
            ),
            NavigationDestination(
              icon: Icon(Icons.calendar_month_outlined),
              selectedIcon: Icon(Icons.calendar_month),
              label: l10n.lawyerNavCalendar,
            ),
          ],
        ),
      ),
    );
  }
}

class _LawyerNavDrawer extends StatelessWidget {
  const _LawyerNavDrawer({required this.onNavigate});

  final void Function(String route) onNavigate;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDark ? const Color(0xFF0D1931) : Colors.white;
    final borderColor =
        isDark ? const Color(0xFF1A3358) : const Color(0xFFE2E8F0);
    final accent = const Color(0xFF226FEF);
    final mutedFg =
        isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    Widget sectionLabel(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Text(
            text.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: mutedFg,
            ),
          ),
        );

    Widget navTile({
      required IconData icon,
      required String label,
      required String route,
      Color? iconColor,
    }) {
      final color = iconColor ?? accent;
      return InkWell(
        onTap: () => onNavigate(route),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? const Color(0xFFF8FAFC)
                        : const Color(0xFF020E24),
                  ),
                ),
              ),
              Icon(Icons.chevron_right, size: 16, color: mutedFg),
            ],
          ),
        ),
      );
    }

    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Text(
                l10n.lawyerNavMore,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: isDark
                      ? const Color(0xFFF8FAFC)
                      : const Color(0xFF020E24),
                ),
              ),
            ),
            sectionLabel('Work'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.checklist_outlined,
                    label: l10n.lawyerNavTasks,
                    route: '/lawyer/tasks',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.schedule_outlined,
                    label: l10n.lawyerNavTime,
                    route: '/lawyer/time',
                    iconColor: const Color(0xFF10B981),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.mic_outlined,
                    label: l10n.lawyerNavMeetings,
                    route: '/lawyer/meetings',
                    iconColor: const Color(0xFF226FEF),
                  ),
                ],
              ),
            ),
            sectionLabel('Clients & Leads'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.inbox_outlined,
                    label: l10n.lawyerNavLeads,
                    route: '/lawyer/leads',
                    iconColor: const Color(0xFFF59E0B),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.person_add_outlined,
                    label: 'Intake',
                    route: '/lawyer/intake',
                    iconColor: const Color(0xFF10B981),
                  ),
                ],
              ),
            ),
            sectionLabel('Research & Docs'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.search_outlined,
                    label: 'Research',
                    route: '/lawyer/research',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.manage_search_outlined,
                    label: 'Document Review',
                    route: '/lawyer/document-review',
                    iconColor: const Color(0xFF7C3AED),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.folder_copy_outlined,
                    label: 'Document Vault',
                    route: '/lawyer/vault',
                    iconColor: const Color(0xFF7C3AED),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.draw_outlined,
                    label: 'E-Sign',
                    route: '/lawyer/esign',
                    iconColor: const Color(0xFF10B981),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.library_books_outlined,
                    label: 'Templates',
                    route: '/lawyer/templates',
                    iconColor: const Color(0xFF8B5CF6),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.edit_note_outlined,
                    label: 'Saved Drafts',
                    route: '/lawyer/docu-draft/saved',
                    iconColor: const Color(0xFF7C3AED),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.description_outlined,
                    label: 'Legal Forms',
                    route: '/lawyer/forms',
                    iconColor: const Color(0xFF8B5CF6),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.gavel_outlined,
                    label: 'Court',
                    route: '/lawyer/court',
                    iconColor: const Color(0xFFEF4444),
                  ),
                ],
              ),
            ),
            sectionLabel('Finance'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.bar_chart_outlined,
                    label: 'Finance Dashboard',
                    route: '/lawyer/finance',
                    iconColor: const Color(0xFF10B981),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.receipt_long_outlined,
                    label: l10n.lawyerNavBilling,
                    route: '/lawyer/billing',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.money_off_outlined,
                    label: 'Expenses',
                    route: '/lawyer/expenses',
                    iconColor: const Color(0xFFEF4444),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.receipt_outlined,
                    label: 'Invoices',
                    route: '/lawyer/invoices',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.account_balance_wallet_outlined,
                    label: l10n.lawyerNavTrust,
                    route: '/lawyer/trust',
                    iconColor: const Color(0xFF10B981),
                  ),
                ],
              ),
            ),
            sectionLabel('Inbox & Alerts'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.inbox_outlined,
                    label: 'Inbox',
                    route: '/lawyer/inbox',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.notifications_outlined,
                    label: l10n.lawyerNavNotifications,
                    route: '/lawyer/notifications',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.warning_amber_rounded,
                    label: l10n.lawyerNavAlerts,
                    route: '/lawyer/alerts',
                    iconColor: const Color(0xFFF59E0B),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.radar_rounded,
                    label: 'Reg. Monitors',
                    route: '/lawyer/monitors',
                    iconColor: const Color(0xFF226FEF),
                  ),
                ],
              ),
            ),
            sectionLabel('AI & Intelligence'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.auto_awesome_outlined,
                    label: 'AI Command Center',
                    route: '/lawyer/ai',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.smart_toy_outlined,
                    label: 'AI Agents',
                    route: '/lawyer/agents',
                    iconColor: const Color(0xFF7C3AED),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.bolt_outlined,
                    label: 'Automations',
                    route: '/lawyer/automations',
                    iconColor: const Color(0xFFF59E0B),
                  ),
                ],
              ),
            ),
            sectionLabel('Team & Admin'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.group_outlined,
                    label: 'Team',
                    route: '/lawyer/team',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.queue_outlined,
                    label: 'Work Queues',
                    route: '/lawyer/queues',
                    iconColor: const Color(0xFF10B981),
                  ),
                ],
              ),
            ),
            sectionLabel('Account'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  navTile(
                    icon: Icons.account_circle_outlined,
                    label: l10n.lawyerNavMyProfile,
                    route: '/lawyer/profile',
                    iconColor: const Color(0xFF94A3B8),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.settings_outlined,
                    label: l10n.lawyerNavSettings,
                    route: '/lawyer/settings',
                    iconColor: const Color(0xFF94A3B8),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.group_outlined,
                    label: 'Users & Permissions',
                    route: '/lawyer/settings/users',
                    iconColor: const Color(0xFF226FEF),
                  ),
                  const SizedBox(height: 8),
                  navTile(
                    icon: Icons.extension_outlined,
                    label: 'Integrations',
                    route: '/lawyer/settings/integrations',
                    iconColor: const Color(0xFF10B981),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ConsumerShell extends StatelessWidget {
  const ConsumerShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final location = GoRouterState.of(context).matchedLocation;
    final index = location.startsWith('/consumer/cases')
        ? 1
        : location.startsWith('/consumer/portal')
        ? 2
        : location.startsWith('/consumer/account')
        ? 3
        : 0;

    return UmbrellaShowcaseScope(
      builder: (context) => Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) {
          switch (value) {
            case 0:
              context.go('/consumer');
            case 1:
              context.go('/consumer/cases');
            case 2:
              context.go('/consumer/portal');
            case 3:
              context.go('/consumer/account');
          }
        },
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: l10n.consumerNavHome,
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_open_outlined),
            selectedIcon: Icon(Icons.folder_open),
            label: l10n.consumerNavCases,
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: l10n.consumerNavPortal,
          ),
          NavigationDestination(
            icon: Icon(Icons.manage_accounts_outlined),
            selectedIcon: Icon(Icons.manage_accounts),
            label: l10n.consumerNavAccount,
          ),
        ],
      ),
    ),
    );
  }
}

class _RouterRefreshListenable extends ChangeNotifier {
  _RouterRefreshListenable(this.ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
    ref.listen(countryCodeProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
}
