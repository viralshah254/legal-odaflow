import '../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/network/api_client.dart';
import '../../../../../core/providers/app_providers.dart';
import '../case_workspace_providers.dart';
import '../widgets/report_viewer.dart';

class CaseReportTab extends ConsumerStatefulWidget {
  const CaseReportTab({super.key, required this.caseId});

  final String caseId;

  @override
  ConsumerState<CaseReportTab> createState() => _CaseReportTabState();
}

class _CaseReportTabState extends ConsumerState<CaseReportTab> {
  bool _generatingReport = false;

  Future<void> _generateReport() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _generatingReport = true);
    try {
      await ref.read(consumersApiProvider).generateFullReport(widget.caseId);
      ref.invalidate(caseDetailProvider(widget.caseId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.consumerFullReportGenerated2)),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _generatingReport = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final caseAsync = ref.watch(caseDetailProvider(widget.caseId));

    return caseAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const SizedBox.shrink(),
      data: (item) => ConsumerReportViewer(
        caseDetail: item,
        isGenerating: _generatingReport,
        onGenerate: _generateReport,
      ),
    );
  }
}
