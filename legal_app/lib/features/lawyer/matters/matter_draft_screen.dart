import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/markdown_section_view.dart';

// ── MatterDraftScreen ─────────────────────────────────────────────────────────

class MatterDraftScreen extends ConsumerStatefulWidget {
  const MatterDraftScreen({super.key, required this.matterId});

  final String matterId;

  @override
  ConsumerState<MatterDraftScreen> createState() => _MatterDraftScreenState();
}

class _MatterDraftScreenState extends ConsumerState<MatterDraftScreen> {
  bool _loadingWorkspace = true;
  bool _generating = false;
  String? _error;

  Map<String, dynamic> _workspace = {};
  String? _draftMarkdown;

  @override
  void initState() {
    super.initState();
    _loadWorkspace();
  }

  Future<void> _loadWorkspace() async {
    setState(() {
      _loadingWorkspace = true;
      _error = null;
    });
    try {
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId ?? '';
      final data = await ref.read(mattersApiProvider).getDraftingWorkspace(
            tenantId: tenantId,
            matterId: widget.matterId,
          );
      if (!mounted) return;
      setState(() {
        _workspace = data;
        _loadingWorkspace = false;
        // If a draft was already generated, show it directly
        final existing = data['draftMarkdown'] as String? ??
            data['draft']?['content'] as String?;
        if (existing != null && existing.isNotEmpty) {
          _draftMarkdown = existing;
        }
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingWorkspace = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load drafting workspace.';
        _loadingWorkspace = false;
      });
    }
  }

  Future<void> _generateDraft() async {
    setState(() {
      _generating = true;
      _error = null;
    });
    try {
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId ?? '';
      final result = await ref.read(mattersApiProvider).generateDraft(
            tenantId: tenantId,
            matterId: widget.matterId,
          );
      if (!mounted) return;
      final markdown = result['draftMarkdown'] as String? ??
          result['content'] as String? ??
          result['draft']?['content'] as String?;
      setState(() {
        _generating = false;
        if (markdown != null && markdown.isNotEmpty) {
          _draftMarkdown = markdown;
        } else {
          _error = 'Draft generated but no content returned. Please retry.';
        }
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _generating = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _generating = false;
        _error = 'Failed to generate draft. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final accent = colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Draft Document'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/lawyer/matters/${widget.matterId}');
            }
          },
        ),
        actions: [
          if (_draftMarkdown != null)
            IconButton(
              icon: const Icon(Icons.copy_outlined),
              tooltip: 'Copy to clipboard',
              onPressed: () {
                Clipboard.setData(ClipboardData(text: _draftMarkdown!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Draft copied to clipboard')),
                );
              },
            ),
        ],
      ),
      body: _loadingWorkspace
          ? const Center(child: CircularProgressIndicator())
          : _buildBody(colorScheme, accent),
    );
  }

  Widget _buildBody(ColorScheme colorScheme, Color accent) {
    if (_error != null && _draftMarkdown == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48,
                  color: colorScheme.error),
              const SizedBox(height: 12),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loadWorkspace,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        // ── Workspace summary card ──
        if (_draftMarkdown == null) _buildWorkspaceSummaryCard(colorScheme, accent),

        // ── Generate button ──
        if (_draftMarkdown == null) ...[
          const SizedBox(height: 16),
          _buildGenerateButton(accent),
        ],

        // ── Error snip (when draft is already showing) ──
        if (_error != null && _draftMarkdown != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(_error!,
                  style: TextStyle(color: colorScheme.onErrorContainer)),
            ),
          ),

        // ── Draft result ──
        if (_draftMarkdown != null) ...[
          _buildDraftResultCard(colorScheme, accent),
          const SizedBox(height: 12),
          // Re-generate button at the bottom
          OutlinedButton.icon(
            onPressed: _generating ? null : _generateDraft,
            icon: _generating
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded, size: 18),
            label: Text(_generating ? 'Regenerating…' : 'Regenerate draft'),
          ),
        ],
      ],
    );
  }

  Widget _buildWorkspaceSummaryCard(ColorScheme colorScheme, Color accent) {
    final documentType = _workspace['documentType'] as String? ?? '';
    final documentTitle = _workspace['documentTitle'] as String? ?? '';
    final clauseOutline =
        (_workspace['clauseOutline'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
    final missingFields =
        (_workspace['missingFields'] as List<dynamic>? ?? [])
            .whereType<String>()
            .toList();
    final jurisdiction = _workspace['jurisdiction'] as String? ??
        _workspace['legalLocation'] as String? ??
        '';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radius),
        side: BorderSide(color: accent.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.edit_document, size: 18, color: accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        documentTitle.isNotEmpty
                            ? documentTitle
                            : 'Contract Draft',
                        style:
                            Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (documentType.isNotEmpty)
                        Text(
                          documentType,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: accent,
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                    ],
                  ),
                ),
              ],
            ),

            if (jurisdiction.isNotEmpty) ...[
              const SizedBox(height: 8),
              Chip(
                avatar: const Icon(Icons.gavel_outlined, size: 13),
                label: Text(jurisdiction,
                    style: const TextStyle(fontSize: 11)),
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 2),
              ),
            ],

            // Clause outline
            if (clauseOutline.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                'Clause Outline (${clauseOutline.length} sections)',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 8),
              ...clauseOutline.asMap().entries.map((e) {
                final i = e.key + 1;
                final clause = e.value;
                final title = clause['title'] as String? ??
                    clause['heading'] as String? ??
                    clause['name'] as String? ??
                    'Section $i';
                final desc = clause['description'] as String? ??
                    clause['purpose'] as String? ??
                    '';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '$i',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: accent,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                            if (desc.isNotEmpty)
                              Text(
                                desc,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: colorScheme.onSurfaceVariant,
                                      height: 1.3,
                                    ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],

            // Missing fields
            if (missingFields.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      size: 14, color: Colors.amber.shade600),
                  const SizedBox(width: 6),
                  Text(
                    'Fields to confirm before generating',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Colors.amber.shade600,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: missingFields.map((f) {
                  return Chip(
                    label: Text(f, style: const TextStyle(fontSize: 11)),
                    backgroundColor:
                        Colors.amber.shade600.withValues(alpha: 0.1),
                    side: BorderSide(
                        color:
                            Colors.amber.shade600.withValues(alpha: 0.3)),
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    visualDensity: VisualDensity.compact,
                  );
                }).toList(),
              ),
              const SizedBox(height: 4),
              Text(
                'Unknown fields will be marked [TO BE CONFIRMED] in the draft.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontStyle: FontStyle.italic,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildGenerateButton(Color accent) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: _generating ? null : _generateDraft,
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        icon: _generating
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.auto_awesome_rounded),
        label: Text(
          _generating ? 'Generating contract…' : 'Generate contract',
          style: const TextStyle(
              fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _buildDraftResultCard(ColorScheme colorScheme, Color accent) {
    final sanitized = sanitizeMarkdown(_draftMarkdown!);
    final sections = splitMarkdownSections(sanitized);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radius),
        side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.description_outlined, size: 16, color: accent),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Generated Contract',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(
                        ClipboardData(text: _draftMarkdown!));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Draft copied to clipboard')),
                    );
                  },
                  icon: const Icon(Icons.copy_outlined, size: 14),
                  label: const Text('Copy',
                      style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Divider(color: colorScheme.outlineVariant.withValues(alpha: 0.4)),
            const SizedBox(height: 4),

            // If multi-section, use collapsible tiles; else plain body
            if (sections.length > 1)
              ...sections
                  .asMap()
                  .entries
                  .where((e) => e.value.body.isNotEmpty)
                  .map(
                    (e) => MarkdownSectionTile(
                      title: e.value.title,
                      body: e.value.body,
                      initiallyExpanded: e.key == 0,
                    ),
                  )
            else
              SelectionArea(
                child: MarkdownBody(
                  data: sections.isNotEmpty ? sections.first.body : sanitized,
                  bulletBuilder: cleanBulletBuilder(
                      Theme.of(context).textTheme.bodySmall),
                  styleSheet:
                      MarkdownStyleSheet.fromTheme(Theme.of(context))
                          .copyWith(
                    p: Theme.of(context).textTheme.bodySmall,
                    h1: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                    h2: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                    h3: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                    h4: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                    strong: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                    em: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(fontStyle: FontStyle.italic),
                    listBullet: Theme.of(context).textTheme.bodySmall,
                    blockSpacing: 8,
                    listIndent: 16,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
