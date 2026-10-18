import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/legal/report_sections.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../cases/workspace/widgets/report_viewer.dart';

final consumerReportsProvider = FutureProvider<List<ConsumerCaseDetail>>((
  ref,
) async {
  final cases = await ref.watch(consumersApiProvider).listCases();
  final details = <ConsumerCaseDetail>[];
  for (final caseItem in cases) {
    try {
      details.add(await ref.watch(consumersApiProvider).getCase(caseItem.id));
    } catch (_) {
      details.add(
        ConsumerCaseDetail(
          id: caseItem.id,
          title: caseItem.title,
          issueType: caseItem.issueType,
          status: caseItem.status,
          countryCode: caseItem.countryCode,
          jurisdiction: caseItem.jurisdiction,
        ),
      );
    }
  }
  return details;
});

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  String? _generatingCaseId;
  String? _selectedCaseId;

  Future<void> _generateFullReport(String caseId) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _generatingCaseId = caseId);
    try {
      await ref.read(consumersApiProvider).generateFullReport(caseId);
      ref.invalidate(consumerReportsProvider);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.consumerFullReportGenerated2)));
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _generatingCaseId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final reportsAsync = ref.watch(consumerReportsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.consumerNavReports),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/consumer'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(consumerReportsProvider),
        child: reportsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            children: [
              Center(
                child: Text(
                  error is ApiException
                      ? error.message
                      : 'Unable to load reports',
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
          data: (cases) {
            final casesWithReports = cases
                .where((caseItem) => caseItem.reports.isNotEmpty)
                .toList();

            if (casesWithReports.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: [
                  Icon(
                    Icons.description_outlined,
                    size: 56,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(l10n.consumerLegalReportsAppearHereAfterYouRunTheIssueChecker,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => context.go('/consumer/issue-checker'),
                    child: Text(l10n.consumerRunIssueChecker),
                  ),
                ],
              );
            }

            final selectedCase = _selectedCaseId == null
                ? null
                : casesWithReports.cast<ConsumerCaseDetail?>().firstWhere(
                    (c) => c!.id == _selectedCaseId,
                    orElse: () => null,
                  );

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                if (selectedCase == null) ...[
                  Text(l10n.consumerYourLegalReports,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  ...casesWithReports.map((caseItem) {
                    final report = pickFullReport(caseItem.reports);
                    if (report == null) return const SizedBox.shrink();

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Card(
                        child: ListTile(
                          title: Text(
                            report.title,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            '${caseItem.issueType} · ${caseItem.countryCode}'
                            '${report.isPreview ? ' · Preview' : ' · Full report'}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () =>
                              setState(() => _selectedCaseId = caseItem.id),
                        ),
                      ),
                    );
                  }),
                ] else ...[
                  ConsumerReportViewer(
                    caseDetail: selectedCase,
                    isGenerating: _generatingCaseId == selectedCase.id,
                    showBackButton: true,
                    onBack: () => setState(() => _selectedCaseId = null),
                    onGenerate: () => _generateFullReport(selectedCase.id),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
