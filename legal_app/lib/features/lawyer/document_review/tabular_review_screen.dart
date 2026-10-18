import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';

// ─── Data models ─────────────────────────────────────────────────────────────

class TabularReviewRow {
  final String clauseName;
  final String? docAText;
  final String? docBText;
  final String changeType;
  final String riskLevel;
  final String? riskDetail;
  final String? recommendation;

  const TabularReviewRow({
    required this.clauseName,
    this.docAText,
    this.docBText,
    required this.changeType,
    required this.riskLevel,
    this.riskDetail,
    this.recommendation,
  });

  factory TabularReviewRow.fromJson(Map<String, dynamic> j) => TabularReviewRow(
        clauseName: j['clauseName'] as String? ?? 'Unknown',
        docAText: j['docAText'] as String?,
        docBText: j['docBText'] as String?,
        changeType: j['changeType'] as String? ?? 'MODIFIED',
        riskLevel: j['riskLevel'] as String? ?? 'NONE',
        riskDetail: j['riskDetail'] as String?,
        recommendation: j['recommendation'] as String?,
      );
}

class TabularReviewResult {
  final List<TabularReviewRow> rows;
  final String summary;
  final int changedClauses;
  final int highRiskClauses;

  const TabularReviewResult({
    required this.rows,
    required this.summary,
    required this.changedClauses,
    required this.highRiskClauses,
  });

  factory TabularReviewResult.fromJson(Map<String, dynamic> j) => TabularReviewResult(
        rows: (j['rows'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>()
            .map(TabularReviewRow.fromJson)
            .toList(),
        summary: j['summary'] as String? ?? '',
        changedClauses: j['changedClauses'] as int? ?? 0,
        highRiskClauses: j['highRiskClauses'] as int? ?? 0,
      );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

class TabularReviewScreen extends ConsumerStatefulWidget {
  const TabularReviewScreen({super.key});

  @override
  ConsumerState<TabularReviewScreen> createState() => _TabularReviewScreenState();
}

class _TabularReviewScreenState extends ConsumerState<TabularReviewScreen> {
  final _docAController = TextEditingController();
  final _docBController = TextEditingController();
  String _docAName = 'Document A';
  String _docBName = 'Document B';
  bool _loading = false;
  String? _error;
  TabularReviewResult? _result;

  @override
  void dispose() {
    _docAController.dispose();
    _docBController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_docAController.text.trim().isEmpty ||
        _docBController.text.trim().isEmpty) {
      setState(() => _error = 'Please paste text for both documents.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId ?? '';

      final resp = await api.dio.post<dynamic>(
        '/ai/document-review/tabular',
        data: {
          'docAText': _docAController.text,
          'docBText': _docBController.text,
          'docAName': _docAName,
          'docBName': _docBName,
        },
        options: tenantId.isNotEmpty ? Options(headers: {'X-Tenant-Id': tenantId}) : null,
      );

      final result = TabularReviewResult.fromJson(
          resp.data as Map<String, dynamic>);
      setState(() => _result = result);
    } catch (e) {
      setState(() => _error = 'Comparison failed: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Compare Documents'),
        actions: [
          if (_result != null)
            TextButton(
              onPressed: () => setState(() {
                _result = null;
                _docAController.clear();
                _docBController.clear();
              }),
              child: const Text('Reset'),
            ),
        ],
      ),
      body: _result != null
          ? _ResultView(result: _result!, docAName: _docAName, docBName: _docBName)
          : _InputView(
              docAController: _docAController,
              docBController: _docBController,
              docAName: _docAName,
              docBName: _docBName,
              onDocANameChanged: (v) => setState(() => _docAName = v),
              onDocBNameChanged: (v) => setState(() => _docBName = v),
              loading: _loading,
              error: _error,
              onSubmit: _submit,
            ),
    );
  }
}

// ─── Input view ──────────────────────────────────────────────────────────────

class _InputView extends StatelessWidget {
  final TextEditingController docAController;
  final TextEditingController docBController;
  final String docAName;
  final String docBName;
  final ValueChanged<String> onDocANameChanged;
  final ValueChanged<String> onDocBNameChanged;
  final bool loading;
  final String? error;
  final VoidCallback onSubmit;

  const _InputView({
    required this.docAController,
    required this.docBController,
    required this.docAName,
    required this.docBName,
    required this.onDocANameChanged,
    required this.onDocBNameChanged,
    required this.loading,
    this.error,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Paste the text of two documents to compare them clause-by-clause.',
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: Colors.grey[600]),
          ),
          const SizedBox(height: 20),

          // Document A
          _DocInput(
            label: 'Document A',
            namePlaceholder: docAName,
            controller: docAController,
            onNameChanged: onDocANameChanged,
          ),
          const SizedBox(height: 16),

          // Document B
          _DocInput(
            label: 'Document B',
            namePlaceholder: docBName,
            controller: docBController,
            onNameChanged: onDocBNameChanged,
          ),
          const SizedBox(height: 20),

          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                error!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.error),
              ),
            ),

          SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              onPressed: loading ? null : onSubmit,
              icon: loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.compare_arrows_rounded),
              label: Text(loading ? 'Comparing…' : 'Compare documents'),
            ),
          ),
        ],
      ),
    );
  }
}

class _DocInput extends StatelessWidget {
  final String label;
  final String namePlaceholder;
  final TextEditingController controller;
  final ValueChanged<String> onNameChanged;

  const _DocInput({
    required this.label,
    required this.namePlaceholder,
    required this.controller,
    required this.onNameChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          decoration: const InputDecoration(
            labelText: 'Document name',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          onChanged: onNameChanged,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: 8,
          decoration: InputDecoration(
            labelText: 'Paste document text here…',
            border: const OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
          style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
        ),
      ],
    );
  }
}

// ─── Result view ─────────────────────────────────────────────────────────────

class _ResultView extends StatefulWidget {
  final TabularReviewResult result;
  final String docAName;
  final String docBName;

  const _ResultView({
    required this.result,
    required this.docAName,
    required this.docBName,
  });

  @override
  State<_ResultView> createState() => _ResultViewState();
}

class _ResultViewState extends State<_ResultView> {
  String _filter = 'ALL';
  final Set<int> _expanded = {};

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final filtered = _filter == 'ALL'
        ? widget.result.rows
        : widget.result.rows.where((r) => r.changeType == _filter).toList();

    return Column(
      children: [
        // Summary strip
        Container(
          color: theme.colorScheme.surfaceContainerHighest,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.result.summary,
                  style: theme.textTheme.bodySmall),
              const SizedBox(height: 8),
              Row(
                children: [
                  _StatChip(
                      label: '${widget.result.rows.length} clauses',
                      color: Colors.blue),
                  const SizedBox(width: 8),
                  _StatChip(
                      label: '${widget.result.changedClauses} changed',
                      color: Colors.orange),
                  const SizedBox(width: 8),
                  _StatChip(
                      label: '${widget.result.highRiskClauses} high risk',
                      color: Colors.red),
                ],
              ),
            ],
          ),
        ),

        // Filter bar
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              for (final f in ['ALL', 'MODIFIED', 'ADDED', 'REMOVED', 'UNCHANGED'])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(f.toLowerCase()),
                    selected: _filter == f,
                    onSelected: (_) => setState(() => _filter = f),
                  ),
                ),
            ],
          ),
        ),

        // Rows
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            itemCount: filtered.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final row = filtered[i];
              final isExpanded = _expanded.contains(i);

              return Card(
                clipBehavior: Clip.antiAlias,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(
                    color: row.riskLevel == 'HIGH'
                        ? Colors.red.withValues(alpha:0.5)
                        : row.riskLevel == 'MEDIUM'
                            ? Colors.orange.withValues(alpha:0.3)
                            : Colors.transparent,
                  ),
                ),
                child: InkWell(
                  onTap: () => setState(() {
                    if (isExpanded) {
                      _expanded.remove(i);
                    } else {
                      _expanded.add(i);
                    }
                  }),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                row.clauseName,
                                style: theme.textTheme.bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            _ChangeChip(changeType: row.changeType),
                            const SizedBox(width: 6),
                            if (row.riskLevel != 'NONE')
                              _RiskChip(riskLevel: row.riskLevel),
                          ],
                        ),

                        if (isExpanded) ...[
                          const Divider(height: 16),
                          if (row.docAText != null) ...[
                            Text(widget.docAName,
                                style: theme.textTheme.labelSmall?.copyWith(
                                    color: Colors.grey,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(row.docAText!,
                                style: theme.textTheme.bodySmall),
                          ],
                          if (row.docBText != null) ...[
                            const SizedBox(height: 8),
                            Text(widget.docBName,
                                style: theme.textTheme.labelSmall?.copyWith(
                                    color: Colors.grey,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(row.docBText!,
                                style: theme.textTheme.bodySmall),
                          ],
                          if (row.riskDetail != null) ...[
                            const SizedBox(height: 8),
                            Text('Risk',
                                style: theme.textTheme.labelSmall?.copyWith(
                                    color: Colors.red,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(row.riskDetail!,
                                style: theme.textTheme.bodySmall),
                          ],
                          if (row.recommendation != null) ...[
                            const SizedBox(height: 8),
                            Text('Recommendation',
                                style: theme.textTheme.labelSmall?.copyWith(
                                    color: Colors.blue,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(row.recommendation!,
                                style: theme.textTheme.bodySmall),
                          ],
                        ],
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final Color color;

  const _StatChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha:0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color)),
    );
  }
}

class _ChangeChip extends StatelessWidget {
  final String changeType;

  const _ChangeChip({required this.changeType});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (changeType) {
      'ADDED' => (Colors.green, 'Added'),
      'REMOVED' => (Colors.red, 'Removed'),
      'MODIFIED' => (Colors.orange, 'Modified'),
      _ => (Colors.grey, 'Unchanged'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha:0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha:0.3)),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class _RiskChip extends StatelessWidget {
  final String riskLevel;

  const _RiskChip({required this.riskLevel});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (riskLevel) {
      'HIGH' => (Colors.red, '⚠ High'),
      'MEDIUM' => (Colors.orange, 'Medium'),
      _ => (Colors.blue, 'Low'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha:0.08),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
    );
  }
}
