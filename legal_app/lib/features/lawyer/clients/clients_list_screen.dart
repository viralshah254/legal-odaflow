import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/routing/lawyer_shell_scope.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/tutorials/tutorial_flow.dart';
import '../../../core/tutorials/tutorial_progress_store.dart';
import '../../../core/tutorials/tutorial_strings.dart';
import '../../../core/tutorials/tutorial_theme.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../l10n/app_localizations.dart';
import 'create_client_sheet.dart';

final clientsListProvider = FutureProvider.family<List<FirmClient>, String?>((
  ref,
  search,
) async {
  final tenantId = ref.watch(authControllerProvider).session?.user.tenantId;
  if (tenantId == null || tenantId.isEmpty) {
    throw ApiException('Tenant ID is required.');
  }
  return ref
      .watch(clientsApiProvider)
      .listClients(tenantId: tenantId, search: search);
});

class ClientsListScreen extends ConsumerStatefulWidget {
  const ClientsListScreen({super.key});

  @override
  ConsumerState<ClientsListScreen> createState() => _ClientsListScreenState();
}

class _ClientsListScreenState extends ConsumerState<ClientsListScreen> {
  final _searchController = TextEditingController();
  final _searchKey = GlobalKey();
  final _fabKey = GlobalKey();
  String? _search;
  bool _tourStarted = false;

  Future<void> _maybeStartTour() async {
    if (_tourStarted || !mounted) return;
    final userId = ref.read(authControllerProvider).session?.user.id;
    if (userId == null) return;

    final store = TutorialProgressStore(ref.read(apiClientProvider));
    final progress = await store.load(userId);
    if (progress.containsKey('mobile.lawyer.clients')) return;

    if (!mounted) return;
    _tourStarted = true;

    await runTutorialWithWelcome(
      context: context,
      showcaseKeys: [_searchKey, _fabKey],
      onSkip: () => store.markSkipped(userId, 'mobile.lawyer.clients'),
      onComplete: () => store.markCompleted(userId, 'mobile.lawyer.clients'),
      onDismiss: () => _tourStarted = false,
      welcomeBody: TutorialStrings.clientsWelcomeBody,
      welcomeBullets: const [
        TutorialStrings.clientsWelcomeBullet1,
        TutorialStrings.clientsWelcomeBullet2,
        TutorialStrings.clientsWelcomeBullet3,
      ],
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeStartTour());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _createClient() async {
    final created = await showCreateClientSheet(context, ref);
    if (created != null) ref.invalidate(clientsListProvider(_search));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final clientsAsync = ref.watch(clientsListProvider(_search));

    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: const LawyerMenuButton(),
        title: Text(l10n.clientsTitle),
        actions: [
          IconButton(
            tooltip: 'Help & tour',
            onPressed: () => ShowCaseWidget.of(context)
                .startShowCase([_searchKey, _fabKey]),
            icon: const Icon(Icons.help_outline, size: 20),
          ),
        ],
      ),
      floatingActionButton: UmbrellaShowcase(
        showcaseKey: _fabKey,
        title: TutorialStrings.lawyerClientsCreateTitle,
        description: TutorialStrings.lawyerClientsCreateBody,
        child: FloatingActionButton.extended(
          onPressed: _createClient,
          icon: const Icon(Icons.person_add_alt_1_outlined),
          label: Text(l10n.clientsNewClient),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: UmbrellaShowcase(
              showcaseKey: _searchKey,
              title: TutorialStrings.lawyerClientsSearchTitle,
              description: TutorialStrings.lawyerClientsSearchBody,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  labelText: l10n.clientsSearchClientsLabel,
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _search?.isNotEmpty == true
                      ? IconButton(
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _search = null);
                          },
                          icon: const Icon(Icons.close),
                        )
                      : null,
                ),
                onSubmitted: (value) => setState(() => _search = value.trim()),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async =>
                  ref.invalidate(clientsListProvider(_search)),
              child: clientsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(24),
                  children: [
                    const SizedBox(height: 60),
                    Text(
                      error is ApiException ? error.message : error.toString(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isDark
                            ? AppColors.mutedForegroundDark
                            : AppColors.mutedForegroundLight,
                      ),
                    ),
                  ],
                ),
                data: (clients) {
                  if (clients.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        const SizedBox(height: 80),
                        AppEmptyState(
                          icon: Icons.people_outline,
                          label: l10n.clientsNoClientsHint,
                          sublabel: 'Add your first client using the + button.',
                        ),
                      ],
                    );
                  }

                  final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
                  final border = isDark ? AppColors.borderDark : AppColors.borderLight;
                  final fg = isDark ? AppColors.foregroundDark : AppColors.foregroundLight;
                  final mutedFg = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                    itemCount: clients.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final client = clients[index];
                      final initial = client.name.isNotEmpty
                          ? client.name[0].toUpperCase()
                          : '?';
                      final avatarColor = _clientAvatarColor(client.name);
                      return InkWell(
                        onTap: () =>
                            context.go('/lawyer/clients/${client.id}'),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: avatarColor.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Center(
                                  child: Text(
                                    initial,
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: avatarColor,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      client.name,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: fg,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      [
                                        if (client.clientCode != null)
                                          client.clientCode!,
                                        client.type?.replaceAll('_', ' ') ??
                                            'Client',
                                        if (client.email != null)
                                          client.email!,
                                      ].join(' · '),
                                      style: TextStyle(
                                          fontSize: 11, color: mutedFg),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              Icon(Icons.chevron_right,
                                  size: 18, color: mutedFg),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Color _clientAvatarColor(String name) {
  const colors = [
    Color(0xFF226FEF),
    Color(0xFF10B981),
    Color(0xFF8B5CF6),
    Color(0xFFF59E0B),
    Color(0xFFEF4444),
    Color(0xFF06B6D4),
    Color(0xFFEC4899),
  ];
  final index = name.codeUnits.fold<int>(0, (sum, c) => sum + c) % colors.length;
  return colors[index];
}
