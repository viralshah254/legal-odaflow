import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../lawyer/matters/matter_detail_screen.dart';
import '../../../widgets/staged_analysis_progress.dart';

class MatterAiScreen extends ConsumerStatefulWidget {
  const MatterAiScreen({super.key, required this.matterId});

  final String matterId;

  @override
  ConsumerState<MatterAiScreen> createState() => _MatterAiScreenState();
}

class _MatterAiScreenState extends ConsumerState<MatterAiScreen> {
  final _questionController = TextEditingController();
  bool _loading = false;
  String? _result;
  String? _error;
  String? _copilotSessionId;

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  Map<String, dynamic> _matterContext(MatterDetail matter) {
    return {
      'matterId': matter.id,
      'selectedMatterId': matter.id,
      'matterTitle': matter.title,
      'countryCode': matter.countryCode,
      'jurisdiction': matter.jurisdiction,
      'practiceArea': matter.practiceArea,
    };
  }

  Future<void> _runCopilotAction({
    required MatterDetail matter,
    required String message,
  }) async {
    final l10n = AppLocalizations.of(context);
    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) {
      setState(() => _error = l10n.errorsTenantIdRequired);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });

    try {
      final response = await ref
          .read(copilotApiProvider)
          .chat(
            message: message,
            tenantId: tenantId,
            sessionId: _copilotSessionId,
            context: _matterContext(matter),
          );
      if (!mounted) return;
      setState(() {
        _result = response.message;
        _copilotSessionId = response.sessionId ?? _copilotSessionId;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = l10n.mattersCopilotActionFailedRetry);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _runResearch(MatterDetail matter) async {
    final l10n = AppLocalizations.of(context);
    final query = _questionController.text.trim();
    if (query.length < 3) {
      setState(() => _error = l10n.mattersResearchQuestionMinLength);
      return;
    }

    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    if (tenantId == null || tenantId.isEmpty) {
      setState(() => _error = l10n.errorsTenantIdRequired);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });

    try {
      final response = await ref
          .read(aiApiProvider)
          .runLegalResearch(
            query: query,
            countryCode: matter.countryCode ?? 'US',
            jurisdiction: matter.jurisdiction,
            matterId: matter.id,
            practiceArea: matter.practiceArea,
            tenantId: tenantId,
          );
      if (!mounted) return;
      setState(() => _result = response.outputMarkdown);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = l10n.mattersResearchFailed);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final matterAsync = ref.watch(matterDetailProvider(widget.matterId));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.commonMatterAi),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/lawyer/matters/${widget.matterId}'),
        ),
      ),
      body: matterAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(error.toString(), textAlign: TextAlign.center),
          ),
        ),
        data: (matter) {
          final scopeLabel = matter.jurisdiction != null
              ? '${matter.countryCode ?? 'US'} · ${matter.jurisdiction}'
              : matter.countryCode ?? 'US';

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(l10n.commonMatterAiCopilot,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                l10n.mattersResearchScopedTo(scopeLabel, matter.title),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _ActionChip(
                    icon: Icons.auto_awesome,
                    label: l10n.commonMatterSummary,
                    onTap: _loading
                        ? null
                        : () => _runCopilotAction(
                            matter: matter,
                            message:
                                'Generate a matter summary memo for this matter.',
                          ),
                  ),
                  _ActionChip(
                    icon: Icons.fact_check_outlined,
                    label: l10n.commonExtractFacts,
                    onTap: _loading
                        ? null
                        : () => _runCopilotAction(
                            matter: matter,
                            message:
                                'Extract key facts from this matter timeline and documents.',
                          ),
                  ),
                  _ActionChip(
                    icon: Icons.psychology_outlined,
                    label: l10n.commonStrategyMemo,
                    onTap: _loading
                        ? null
                        : () => _runCopilotAction(
                            matter: matter,
                            message:
                                'Draft a strategy memo with options, risks, and next steps for this matter.',
                          ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(l10n.commonLegalResearch,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(l10n.commonAskAResearchQuestionCitationsFromRetrievedAuthorities,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _questionController,
                        minLines: 3,
                        maxLines: 5,
                        decoration: InputDecoration(
                          labelText: l10n.commonResearchQuestion,
                          hintText: l10n.commonWhatIsTheApplicableLawFor,
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loading ? null : () => _runResearch(matter),
                        child: Text(
                          _loading
                              ? l10n.issueCheckerWorking
                              : l10n.mattersRunResearch,
                        ),
                      ),
                      if (_loading) ...[
                        const SizedBox(height: 20),
                        StagedAnalysisProgress(
                          active: _loading,
                          title: 'Research in progress…',
                          stages: const [
                            StagedProgressStage(
                              id: 'connect',
                              label: 'Connecting to legal database',
                              icon: Icons.cloud_outlined,
                              duration: Duration(seconds: 5),
                            ),
                            StagedProgressStage(
                              id: 'retrieve',
                              label: 'Retrieving jurisdiction authorities',
                              icon: Icons.search_outlined,
                              duration: Duration(seconds: 10),
                              rotatingLabels: [
                                'Retrieving jurisdiction authorities',
                                'Scanning case law & statutes',
                              ],
                            ),
                            StagedProgressStage(
                              id: 'analyze',
                              label: 'Analysing case facts',
                              icon: Icons.psychology_outlined,
                              duration: Duration(seconds: 8),
                            ),
                            StagedProgressStage(
                              id: 'draft',
                              label: 'Drafting response',
                              icon: Icons.edit_outlined,
                            ),
                          ],
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .errorContainer
                                .withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.error_outline,
                                  size: 18,
                                  color: Theme.of(context).colorScheme.error),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _error!,
                                      style: TextStyle(
                                        color: Theme.of(context).colorScheme.error,
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    TextButton.icon(
                                      onPressed: () => _runResearch(matter),
                                      icon: const Icon(Icons.refresh, size: 14),
                                      label: const Text('Retry'),
                                      style: TextButton.styleFrom(
                                        padding: EdgeInsets.zero,
                                        minimumSize: const Size(0, 28),
                                        textStyle: const TextStyle(fontSize: 12),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (_result != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest
                                .withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: SelectableText(_result!),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      onPressed: onTap,
    );
  }
}
