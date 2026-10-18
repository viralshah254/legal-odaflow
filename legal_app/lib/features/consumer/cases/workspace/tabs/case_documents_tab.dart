import 'dart:async';

import '../../../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/models/models.dart';
import '../../../../../core/network/api_client.dart';
import '../../../../../widgets/legal_disclaimer.dart';
import '../case_workspace_providers.dart';
import '../case_workspace_utils.dart';

class CaseDocumentsTab extends ConsumerStatefulWidget {
  const CaseDocumentsTab({super.key, required this.caseId});

  final String caseId;

  @override
  ConsumerState<CaseDocumentsTab> createState() => _CaseDocumentsTabState();
}

class _CaseDocumentsTabState extends ConsumerState<CaseDocumentsTab> {
  Timer? _pollTimer;

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _schedulePolling(List<ConsumerDocument> documents) {
    final needsPoll = documents.any((doc) => doc.isOcrProcessing);
    if (needsPoll && _pollTimer == null) {
      _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
        ref.invalidate(caseDocumentsProvider(widget.caseId));
      });
    } else if (!needsPoll) {
      _pollTimer?.cancel();
      _pollTimer = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final docsAsync = ref.watch(caseDocumentsProvider(widget.caseId));

    return docsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                error is ApiException
                    ? error.message
                    : 'Unable to load documents',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () =>
                    ref.invalidate(caseDocumentsProvider(widget.caseId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (documents) {
        _schedulePolling(documents);

        return RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(caseDocumentsProvider(widget.caseId)),
          child: ListView(
            padding: const EdgeInsets.all(20),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.consumerUploadedDocuments,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          l10n.consumerOcrStatusAndAiSummariesForCaseDocuments,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  FilledButton.tonal(
                    onPressed: () => context.push(
                      '/consumer/documents?caseId=${widget.caseId}',
                    ),
                    child: Text(l10n.consumerUpload),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (documents.isEmpty)
                _EmptyState(
                  icon: Icons.description_outlined,
                  title: l10n.consumerNoDocumentsYet,
                  description: l10n.consumerEmptyDocumentsDescription,
                  actionLabel: l10n.consumerUploadDocument,
                  onAction: () => context.push(
                    '/consumer/documents?caseId=${widget.caseId}',
                  ),
                )
              else
                ...documents.map(
                  (doc) => _DocumentTile(document: doc),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.document});

  final ConsumerDocument document;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final status = document.ocrStatus ?? 'PENDING';
    final statusColor = ocrStatusColor(status);
    final dateStr = document.createdAt != null
        ? formatCaseDate(document.createdAt!)
        : null;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.insert_drive_file_outlined,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        document.fileName,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      if (dateStr != null)
                        Text(
                          dateStr,
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
            if (document.isOcrProcessing) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'OCR in progress — refreshing automatically',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ),
                ],
              ),
            ],
            if (document.aiSummary != null &&
                document.aiSummary!.isNotEmpty) ...[
              const Divider(height: 24),
              Text(
                l10n.commonAiSummary,
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const SizedBox(height: 6),
              Text(document.aiSummary!),
              const SizedBox(height: 8),
              const LegalDisclaimer(compact: true),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.description,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String description;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(description, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ),
    );
  }
}
