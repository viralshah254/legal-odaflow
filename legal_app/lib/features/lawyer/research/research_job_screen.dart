import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/research_job_provider.dart';
import '../../../widgets/verification/verification_ui.dart';
import 'widgets/research_actions_bar.dart';
import 'widgets/research_job_progress.dart';
import 'widgets/similar_cases_panel.dart';

/// Dedicated poller screen for async research jobs (`/lawyer/research/:jobId`).
class ResearchJobScreen extends ConsumerStatefulWidget {
  const ResearchJobScreen({
    super.key,
    required this.jobId,
    this.query,
    this.countryCode,
    this.jurisdiction,
  });

  final String jobId;
  final String? query;
  final String? countryCode;
  final String? jurisdiction;

  @override
  ConsumerState<ResearchJobScreen> createState() => _ResearchJobScreenState();
}

class _ResearchJobScreenState extends ConsumerState<ResearchJobScreen> {
  bool _enriching = false;
  List<ResearchHistoryItem> _history = const [];
  final _contextController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId;
      if (tenantId != null && tenantId.isNotEmpty) {
        ref.read(researchJobProvider.notifier).attachExisting(
              jobId: widget.jobId,
              tenantId: tenantId,
            );
        _loadHistory(tenantId);
      }
    });
  }

  @override
  void dispose() {
    _contextController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory(String tenantId) async {
    try {
      final items = await ref.read(aiApiProvider).getResearchHistory(
            tenantId: tenantId,
          );
      if (mounted) setState(() => _history = items);
    } catch (_) {}
  }

  Future<void> _enrich(String mode) async {
    final job = ref.read(researchJobProvider);
    final result = job.result;
    if (result == null) return;
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId;
    setState(() => _enriching = true);
    try {
      final ai = ref.read(aiApiProvider);
      var outputId = result.aiOutputId;
      if (outputId == null || outputId.isEmpty) {
        outputId = await ai.ensureResearchOutput(
          query: widget.query ?? '',
          answer: result.outputMarkdown,
          countryCode: widget.countryCode ?? result.countryCode,
          jurisdiction: widget.jurisdiction ?? result.jurisdiction,
          aiOutputId: result.aiOutputId,
          tenantId: tenantId,
        );
      }
      final enriched = await ai.enrichLegalResearch(
        outputId: outputId,
        mode: mode,
        query: widget.query,
        countryCode: widget.countryCode ?? result.countryCode,
        jurisdiction: widget.jurisdiction ?? result.jurisdiction,
        tenantId: tenantId,
      );
      final merged = result.copyWith(
        outputMarkdown: enriched.answer.isNotEmpty
            ? enriched.answer
            : result.outputMarkdown,
        similarCases: enriched.similarCases,
        sectionChecks: enriched.sectionChecks,
        findings: enriched.findings,
        propositions: enriched.propositions,
        dimensions: enriched.dimensions,
        publicationState: enriched.publicationState,
        aiOutputId: enriched.aiOutputId,
        outputHash: enriched.outputHash,
        requiresLawyerReview: enriched.requiresLawyerReview,
      );
      ref.read(researchJobProvider.notifier).applyEnrichResult(merged);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              enriched.warning ??
                  'Enriched: +${enriched.casesAdded} cases, ${enriched.sectionsAdded.length} sections',
            ),
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _enriching = false);
    }
  }

  Future<void> _showEnrichSheet() async {
    final mode = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.gavel_outlined),
              title: const Text('Add case laws'),
              onTap: () => Navigator.pop(ctx, 'case_laws'),
            ),
            ListTile(
              leading: const Icon(Icons.menu_book_outlined),
              title: const Text('Add statute sections'),
              onTap: () => Navigator.pop(ctx, 'sections'),
            ),
            ListTile(
              leading: const Icon(Icons.auto_awesome),
              title: const Text('Both'),
              onTap: () => Navigator.pop(ctx, 'both'),
            ),
          ],
        ),
      ),
    );
    if (mode != null) await _enrich(mode);
  }

  Future<void> _showHistory() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (_, controller) {
          if (_history.isEmpty) {
            return const Center(child: Text('No research history yet.'));
          }
          return ListView.builder(
            controller: controller,
            itemCount: _history.length,
            itemBuilder: (_, i) {
              final item = _history[i];
              return ListTile(
                title: Text(
                  item.inputQuery ?? item.preview,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(item.createdAt),
                trailing: item.verified == true
                    ? const Icon(Icons.verified, size: 18, color: Colors.green)
                    : null,
                onTap: () {
                  Navigator.pop(ctx);
                  // Show cached memo inline via a simple dialog
                  showDialog<void>(
                    context: context,
                    builder: (dCtx) => AlertDialog(
                      title: const Text('Past research'),
                      content: SizedBox(
                        width: double.maxFinite,
                        child: SingleChildScrollView(
                          child: MarkdownBody(data: item.outputMarkdown),
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(dCtx),
                          child: const Text('Close'),
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _saveResearch(LegalResearchResult result) async {
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    final clientController = TextEditingController();
    final matterController = TextEditingController();
    final titleController = TextEditingController(
      text: widget.query?.trim().isNotEmpty == true
          ? widget.query!.trim()
          : 'Research ${DateTime.now().toIso8601String().substring(0, 10)}',
    );

    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save to client'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: clientController,
              decoration: const InputDecoration(labelText: 'Client ID'),
            ),
            TextField(
              controller: matterController,
              decoration: const InputDecoration(labelText: 'Matter ID (optional)'),
            ),
            TextField(
              controller: titleController,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (confirmed != true || clientController.text.trim().isEmpty) return;

    try {
      final ai = ref.read(aiApiProvider);
      await ai.saveResearchToClient(
        clientId: clientController.text.trim(),
        title: titleController.text.trim(),
        query: widget.query ?? titleController.text.trim(),
        researchJson: {
          'outputMarkdown': result.outputMarkdown,
          'jobId': widget.jobId,
        },
        matterId: matterController.text.trim().isEmpty ? null : matterController.text.trim(),
        aiOutputId: result.aiOutputId,
        countryCode: widget.countryCode,
        tenantId: tenantId,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Research saved to client')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _addContextFollowUp() async {
    final query = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add context'),
        content: TextField(
          controller: _contextController,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Add facts, procedural posture, or follow-up…',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(ctx, _contextController.text.trim()),
            child: const Text('Run follow-up'),
          ),
        ],
      ),
    );
    if (query == null || query.length < 10 || !mounted) return;

    final prior = ref.read(researchJobProvider).result;
    final tenantId =
        ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null) return;

    try {
      final jobId = await ref.read(researchJobProvider.notifier).start(
            query: query,
            countryCode: widget.countryCode ?? prior?.countryCode ?? 'IN',
            jurisdiction: widget.jurisdiction ?? prior?.jurisdiction,
            tenantId: tenantId,
            researchMode: prior?.researchMode ?? 'DEEP',
            priorContext: prior != null
                ? [
                    {
                      'role': 'assistant',
                      'content': prior.outputMarkdown,
                    },
                    {
                      'role': 'user',
                      'content': widget.query ?? '',
                    },
                  ]
                : null,
          );
      if (mounted) {
        context.go('/lawyer/research/$jobId?q=${Uri.encodeComponent(query)}'
            '&country=${widget.countryCode ?? ''}'
            '&jurisdiction=${Uri.encodeComponent(widget.jurisdiction ?? '')}');
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final job = ref.watch(researchJobProvider);
    final result = job.result;
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Legal research'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop()
              ? context.pop()
              : context.go('/lawyer/research'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: _showHistory,
          ),
        ],
      ),
      body: result != null
          ? ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ResearchVerificationCard(
                  publicationState: result.publicationState,
                  findings: result.findings,
                  dimensions: result.dimensions,
                  propositions: result.propositions,
                  requiresLawyerReview: result.requiresLawyerReview,
                  citationAuditLabel: result.citationAudit != null
                      ? '${result.citationAudit!.verifiedCitationCount} verified citations'
                      : null,
                ),
                const SizedBox(height: 12),
                ResearchActionsBar(
                  markdown: result.outputMarkdown,
                  enrichEnabled: !_enriching,
                  onEnrich: _showEnrichSheet,
                  onHistory: _showHistory,
                  onAddContext: _addContextFollowUp,
                  onSave: () => _saveResearch(result),
                ),
                if (_enriching) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(),
                ],
                const SizedBox(height: 16),
                MarkdownBody(data: result.outputMarkdown),
                const SizedBox(height: 16),
                if (result.similarCases != null)
                  SimilarCasesPanel(cases: result.similarCases!),
                if (result.citations.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Citations (${result.citations.length})',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  ...result.citations.map(
                    (c) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(c.sourceName),
                      subtitle: Text(c.citation),
                    ),
                  ),
                ],
              ],
            )
          : job.error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline,
                            size: 40, color: colorScheme.error),
                        const SizedBox(height: 12),
                        Text(job.error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: () => context.go('/lawyer/research'),
                          child: const Text('New research'),
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: ResearchJobPhaseProgress(
                    phase: job.phase,
                    message: job.progress?.message,
                    partialMarkdown: job.partialMarkdown,
                  ),
                ),
    );
  }
}
