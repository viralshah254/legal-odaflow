import '../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import 'case_workspace_providers.dart';
import 'case_workspace_utils.dart';

class CaseWorkspaceTab {
  const CaseWorkspaceTab({
    required this.label,
    required this.pathSuffix,
    this.isFocus = false,
  });

  final String label;
  final String pathSuffix;
  final bool isFocus;
}

class CaseWorkspaceShell extends ConsumerWidget {
  const CaseWorkspaceShell({
    super.key,
    required this.caseId,
    required this.child,
  });

  final String caseId;
  final Widget child;

  static const _focusSuffixes = ['/report', '/lawyer-review'];

  bool _isFocusRoute(String location) {
    final base = '/consumer/cases/$caseId';
    return _focusSuffixes.any(
      (suffix) =>
          location == '$base$suffix' ||
          location.startsWith('$base$suffix/'),
    );
  }

  int _tabIndex(String location, List<CaseWorkspaceTab> tabs) {
    final base = '/consumer/cases/$caseId';
    if (location == base || location == '$base/') return 0;
    for (var i = 0; i < tabs.length; i++) {
      final suffix = tabs[i].pathSuffix;
      if (suffix.isEmpty) continue;
      if (location == '$base$suffix' || location.startsWith('$base$suffix/')) {
        return i;
      }
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final location = GoRouterState.of(context).matchedLocation;
    final isFocus = _isFocusRoute(location);

    final tabs = [
      CaseWorkspaceTab(label: l10n.consumerNavHome, pathSuffix: ''),
      CaseWorkspaceTab(
        label: l10n.consumerPreview,
        pathSuffix: '/report',
        isFocus: true,
      ),
      CaseWorkspaceTab(label: l10n.consumerNavDocuments, pathSuffix: '/documents'),
      CaseWorkspaceTab(label: l10n.consumerDrafts, pathSuffix: '/drafts'),
      CaseWorkspaceTab(label: l10n.consumerMessages, pathSuffix: '/messages'),
      CaseWorkspaceTab(label: l10n.consumerPay, pathSuffix: '/payments'),
      CaseWorkspaceTab(label: l10n.consumerDataAiConsent, pathSuffix: '/consent'),
    ];

    final caseAsync = ref.watch(caseDetailProvider(caseId));
    final selectedIndex = _tabIndex(location, tabs);

    return Scaffold(
      appBar: AppBar(
        title: isFocus
            ? Text(l10n.consumerViewCase)
            : Text(l10n.consumerCaseDetails),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (isFocus) {
              context.go('/consumer/cases/$caseId');
            } else if (context.canPop()) {
              context.pop();
            } else {
              context.go('/consumer/cases');
            }
          },
        ),
      ),
      body: caseAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 48,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(height: 12),
                Text(
                  error is ApiException
                      ? error.message
                      : 'Unable to load case',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(caseDetailProvider(caseId)),
                  child: Text(l10n.commonRetry),
                ),
              ],
            ),
          ),
        ),
        data: (item) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (isFocus)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Text(
                    item.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                )
              else ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: caseStatusColor(item.status)
                                  .withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              item.status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: caseStatusColor(item.status),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${item.issueType} · ${item.countryCode}'
                        '${item.createdAt != null ? ' · ${formatCaseDate(item.createdAt!)}' : ''}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      for (var i = 0; i < tabs.length; i++)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text(tabs[i].label),
                            selected: selectedIndex == i,
                            onSelected: (_) {
                              final suffix = tabs[i].pathSuffix;
                              context.go('/consumer/cases/$caseId$suffix');
                            },
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                const Divider(height: 1),
              ],
              Expanded(child: child),
            ],
          );
        },
      ),
    );
  }
}
