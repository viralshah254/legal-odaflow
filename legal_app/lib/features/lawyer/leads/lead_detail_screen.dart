import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/markdown_section_view.dart';

// ─── Speed-dial item descriptor ───────────────────────────────────────────────

class _SpeedDialItem {
  const _SpeedDialItem({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

class LeadDetailScreen extends ConsumerStatefulWidget {
  const LeadDetailScreen({super.key, required this.leadId});

  final String leadId;

  @override
  ConsumerState<LeadDetailScreen> createState() => _LeadDetailScreenState();
}

class _LeadDetailScreenState extends ConsumerState<LeadDetailScreen>
    with TickerProviderStateMixin {
  FirmIntakeLead? _lead;
  bool _loading = true;
  String? _error;

  bool _accepting = false;
  bool _savingNotes = false;

  late TextEditingController _notesCtrl;

  final Map<String, bool> _runningAnalysis = {};
  final Map<String, LeadAnalysisRun> _analysisResults = {};

  // Speed-dial animation
  late AnimationController _dialCtrl;
  bool _dialOpen = false;

  @override
  void initState() {
    super.initState();
    _notesCtrl = TextEditingController();
    _dialCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    _loadLead();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    _dialCtrl.dispose();
    super.dispose();
  }

  void _toggleDial() {
    setState(() => _dialOpen = !_dialOpen);
    if (_dialOpen) {
      _dialCtrl.forward();
    } else {
      _dialCtrl.reverse();
    }
  }

  void _closeDial() {
    if (_dialOpen) {
      setState(() => _dialOpen = false);
      _dialCtrl.reverse();
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  Future<void> _loadLead() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final lead =
          await ref.read(marketplaceApiProvider).getFirmLead(widget.leadId);
      if (!mounted) return;
      setState(() {
        _lead = lead;
        _loading = false;
        _notesCtrl.text = lead.lawyerContextMarkdown ?? '';
        _analysisResults.clear();
        for (final run in lead.analysisRuns) {
          if (run.analysisType.isNotEmpty) {
            _analysisResults[run.analysisType] = run;
          }
        }
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load lead.';
        _loading = false;
      });
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  Future<void> _acceptAndOpenMatter() async {
    setState(() => _accepting = true);
    try {
      final result =
          await ref.read(marketplaceApiProvider).convertLead(widget.leadId);
      final matterId = result.convertedMatterId;
      if (matterId != null && mounted) {
        // Drafting leads go straight to the draft workspace
        final isDrafting = _lead?.isDraftingLead ?? false;
        context.go(isDrafting
            ? '/lawyer/matters/$matterId/draft'
            : '/lawyer/matters/$matterId');
      } else if (mounted) {
        await _loadLead();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to accept lead.')),
        );
      }
    } finally {
      if (mounted) setState(() => _accepting = false);
    }
  }

  Future<void> _saveNotes() async {
    setState(() => _savingNotes = true);
    try {
      await ref
          .read(marketplaceApiProvider)
          .updateLeadContext(widget.leadId, _notesCtrl.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Notes saved.')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _savingNotes = false);
    }
  }

  Future<void> _runAnalysis(String type) async {
    setState(() => _runningAnalysis[type] = true);
    try {
      final run = await ref
          .read(marketplaceApiProvider)
          .runLeadAnalysis(widget.leadId, type);
      if (!mounted) return;
      setState(() => _analysisResults[type] = run);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Analysis failed. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _runningAnalysis[type] = false);
    }
  }

  // ── Bottom sheets ────────────────────────────────────────────────────────────

  void _openCounselNotes() {
    _closeDial();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _CounselNotesSheet(
        controller: _notesCtrl,
        isSaving: _savingNotes,
        onSave: _saveNotes,
      ),
    );
  }

  void _openAnalysis(String type, String title, String description) {
    _closeDial();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _AnalysisSheet(
        type: type,
        title: title,
        description: description,
        isRunning: _runningAnalysis[type] ?? false,
        result: _analysisResults[type],
        onRun: () => _runAnalysis(type),
      ),
    );
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_error != null || _lead == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Lead')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error ?? 'Lead not found'),
                const SizedBox(height: 16),
                FilledButton(onPressed: _loadLead, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    final lead = _lead!;

    final dialItems = [
      _SpeedDialItem(
        icon: Icons.lock_outline_rounded,
        label: 'Counsel Notes',
        color: colorScheme.primary,
        onTap: _openCounselNotes,
      ),
      _SpeedDialItem(
        icon: Icons.library_books_outlined,
        label: 'Similar Cases',
        color: const Color(0xFF22C55E), // green-500
        onTap: () => _openAnalysis(
          'similar-cases',
          'Similar cases',
          'Find similar past cases and relevant precedents.',
        ),
      ),
      _SpeedDialItem(
        icon: Icons.track_changes_rounded,
        label: "Opponent's Angles",
        color: const Color(0xFFF97316), // orange-500
        onTap: () => _openAnalysis(
          'opponent-angles',
          "Opponent's angles",
          'Understand potential counterarguments and opponent strategy.',
        ),
      ),
      _SpeedDialItem(
        icon: Icons.route_rounded,
        label: 'Strategy Memo',
        color: const Color(0xFF8B5CF6), // violet-500
        onTap: () => _openAnalysis(
          'strategy-memo',
          'Strategy memo',
          'Generate a strategic overview and recommended approach.',
        ),
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(lead.issueType, overflow: TextOverflow.ellipsis),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/lawyer/leads');
            }
          },
        ),
        actions: [
          if (lead.isDraftingLead)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Chip(
                avatar: Icon(Icons.edit_document,
                    size: 14, color: colorScheme.primary),
                label: Text(
                  'Drafting',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: colorScheme.primary,
                  ),
                ),
                backgroundColor:
                    colorScheme.primary.withValues(alpha: 0.12),
                padding: const EdgeInsets.symmetric(horizontal: 2),
                visualDensity: VisualDensity.compact,
              ),
            ),
          Chip(
            label: Text(
              lead.countryCode.toUpperCase(),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 4),
            visualDensity: VisualDensity.compact,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          // ── Main scrollable content ──
          RefreshIndicator(
            onRefresh: _loadLead,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              children: [
                _buildAcceptSection(lead, colorScheme),
                const SizedBox(height: 16),
                if (lead.isDraftingLead) ...[
                  _buildDraftingWorkspaceCard(lead, colorScheme),
                  const SizedBox(height: 16),
                ],
                _buildAnalysisCard(lead, colorScheme),
              ],
            ),
          ),

          // ── Scrim when dial is open ──
          if (_dialOpen)
            GestureDetector(
              onTap: _closeDial,
              child: AnimatedBuilder(
                animation: _dialCtrl,
                builder: (_, __) => Container(
                  color: Colors.black
                      .withValues(alpha: 0.45 * _dialCtrl.value),
                ),
              ),
            ),

          // ── Speed-dial ──
          Positioned(
            right: 20,
            bottom: 28,
            child: _SpeedDial(
              controller: _dialCtrl,
              isOpen: _dialOpen,
              onToggle: _toggleDial,
              items: dialItems,
            ),
          ),
        ],
      ),
    );
  }

  // ── Sub-builders ─────────────────────────────────────────────────────────────

  Widget _buildAcceptSection(FirmIntakeLead lead, ColorScheme colorScheme) {
    if (lead.convertedMatterId != null) {
      return GestureDetector(
        onTap: () => context.go('/lawyer/matters/${lead.convertedMatterId}'),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.green.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(AppColors.radius),
            border: Border.all(color: Colors.green.withValues(alpha: 0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.check_circle_outline, color: Colors.green),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Converted — Tap to view matter',
                  style: TextStyle(
                      color: Colors.green, fontWeight: FontWeight.w600),
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.green),
            ],
          ),
        ),
      );
    }

    final isDrafting = lead.isDraftingLead;
    return SizedBox(
      width: double.infinity,
      child: FilledButton.tonal(
        onPressed: _accepting ? null : _acceptAndOpenMatter,
        style: isDrafting
            ? FilledButton.styleFrom(
                backgroundColor: colorScheme.primary,
                foregroundColor: colorScheme.onPrimary,
              )
            : null,
        child: _accepting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (isDrafting)
                    const Padding(
                      padding: EdgeInsets.only(right: 8),
                      child: Icon(Icons.edit_document, size: 18),
                    ),
                  Text(isDrafting
                      ? 'Accept & open drafting workspace'
                      : 'Accept & open matter'),
                ],
              ),
      ),
    );
  }

  // ── Drafting workspace preview card ──────────────────────────────────────────

  Widget _buildDraftingWorkspaceCard(
      FirmIntakeLead lead, ColorScheme colorScheme) {
    final accent = colorScheme.primary;
    final hasClauseOutline = lead.clauseOutline.isNotEmpty;
    final hasMissingFields = lead.missingFields.isNotEmpty;
    final hasNextSteps = lead.smartNextSteps.isNotEmpty;

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
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.edit_document, size: 16, color: accent),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Drafting Workspace',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: accent,
                            ),
                      ),
                      if (lead.documentType != null)
                        Text(
                          lead.documentType!,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                        ),
                    ],
                  ),
                ),
              ],
            ),

            // Document title
            if (lead.documentTitle != null && lead.documentTitle!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: accent.withValues(alpha: 0.2)),
                  ),
                  child: Text(
                    lead.documentTitle!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              ),

            // Clause outline
            if (hasClauseOutline) ...[
              const SizedBox(height: 14),
              Text(
                'Clause Outline',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 6),
              ...lead.clauseOutline.asMap().entries.map((e) {
                final i = e.key + 1;
                final clause = e.value;
                final title = clause['title'] as String? ??
                    clause['heading'] as String? ??
                    clause['name'] as String? ??
                    'Clause $i';
                final desc = clause['description'] as String? ??
                    clause['purpose'] as String? ??
                    '';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 22,
                        height: 22,
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
                      const SizedBox(width: 8),
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
            if (hasMissingFields) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      size: 14, color: Colors.amber.shade600),
                  const SizedBox(width: 6),
                  Text(
                    'Missing Information',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: Colors.amber.shade600,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: lead.missingFields.map((field) {
                  return Chip(
                    label: Text(field,
                        style: const TextStyle(fontSize: 11)),
                    backgroundColor:
                        Colors.amber.shade600.withValues(alpha: 0.1),
                    side: BorderSide(
                        color: Colors.amber.shade600.withValues(alpha: 0.3)),
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    visualDensity: VisualDensity.compact,
                  );
                }).toList(),
              ),
            ],

            // Smart next steps
            if (hasNextSteps) ...[
              const SizedBox(height: 14),
              Text(
                'Smart Next Steps',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 6),
              ...lead.smartNextSteps.map(
                (step) => Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.check_circle_outline_rounded,
                          size: 15, color: const Color(0xFF22C55E)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          step,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(height: 1.3),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAnalysisCard(FirmIntakeLead lead, ColorScheme colorScheme) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radius),
        side: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.auto_awesome_outlined,
                    size: 16, color: colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'AI Intake Analysis',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (lead.previewContentMarkdown != null &&
                lead.previewContentMarkdown!.isNotEmpty)
              _buildSectionedMarkdown(
                context,
                lead.previewContentMarkdown!,
              )
            else
              Text(
                'No intake analysis available yet.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionedMarkdown(BuildContext context, String rawMarkdown) {
    final sanitized = sanitizeMarkdown(rawMarkdown);
    final sections = splitMarkdownSections(sanitized);

    if (sections.isEmpty) return const SizedBox.shrink();

    if (sections.length == 1 && sections.first.title.isEmpty) {
      return SelectionArea(
        child: MarkdownBody(
          data: sections.first.body,
          bulletBuilder:
              cleanBulletBuilder(Theme.of(context).textTheme.bodySmall),
          styleSheet:
              MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
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
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < sections.length; i++)
          if (sections[i].body.isNotEmpty)
            MarkdownSectionTile(
              title: sections[i].title,
              body: sections[i].body,
              initiallyExpanded: i == 0,
            ),
      ],
    );
  }
}

// ─── Collapsible markdown section tile ────────────────────────────────────────

// ─── Speed-dial widget ────────────────────────────────────────────────────────

class _SpeedDial extends StatelessWidget {
  const _SpeedDial({
    required this.controller,
    required this.isOpen,
    required this.onToggle,
    required this.items,
  });

  final AnimationController controller;
  final bool isOpen;
  final VoidCallback onToggle;
  final List<_SpeedDialItem> items;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Sub-items (rendered bottom-to-top so first item is closest to FAB)
        ...List.generate(items.length, (i) {
          // Stagger: items animate with 40ms offset, closest (last index) first
          final delay = (items.length - 1 - i) * 0.08;
          final start = delay.clamp(0.0, 0.7);
          final end = (start + 0.45).clamp(0.0, 1.0);

          final slide = Tween<Offset>(
            begin: const Offset(0, 0.6),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: controller,
            curve: Interval(start, end, curve: Curves.easeOutBack),
          ));

          final fade = Tween<double>(begin: 0, end: 1).animate(
            CurvedAnimation(
              parent: controller,
              curve: Interval(start, end, curve: Curves.easeOut),
            ),
          );

          final item = items[i];

          return AnimatedBuilder(
            animation: controller,
            builder: (_, __) => FadeTransition(
              opacity: fade,
              child: SlideTransition(
                position: slide,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Label pill
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: colorScheme.surface,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.18),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Text(
                          item.label,
                          style:
                              Theme.of(context).textTheme.labelMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: colorScheme.onSurface,
                                  ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Mini FAB
                      GestureDetector(
                        onTap: item.onTap,
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: item.color,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: item.color.withValues(alpha: 0.45),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Icon(
                            item.icon,
                            color: Colors.white,
                            size: 22,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),

        // Main FAB
        GestureDetector(
          onTap: onToggle,
          child: AnimatedBuilder(
            animation: controller,
            builder: (_, __) {
              return Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      colorScheme.primary,
                      Color.lerp(colorScheme.primary,
                              colorScheme.tertiary, 0.4) ??
                          colorScheme.primary,
                    ],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: colorScheme.primary.withValues(alpha: 0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Transform.rotate(
                  angle: controller.value * math.pi / 4,
                  child: Icon(
                    isOpen ? Icons.close_rounded : Icons.add_rounded,
                    color: Colors.white,
                    size: 28,
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

// ─── Counsel notes bottom sheet ───────────────────────────────────────────────

class _CounselNotesSheet extends StatelessWidget {
  const _CounselNotesSheet({
    required this.controller,
    required this.isSaving,
    required this.onSave,
  });

  final TextEditingController controller;
  final bool isSaving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: colorScheme.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.lock_outline_rounded,
                      size: 18, color: colorScheme.primary),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Private Counsel Notes',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      'Not shared with client',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                            fontStyle: FontStyle.italic,
                          ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              minLines: 5,
              maxLines: 10,
              autofocus: true,
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                hintText: 'Add your private notes about this lead…',
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: isSaving
                    ? null
                    : () {
                        onSave();
                        Navigator.of(context).pop();
                      },
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: isSaving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Save notes',
                        style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Analysis bottom sheet ────────────────────────────────────────────────────

class _AnalysisSheet extends StatelessWidget {
  const _AnalysisSheet({
    required this.type,
    required this.title,
    required this.description,
    required this.isRunning,
    required this.result,
    required this.onRun,
  });

  final String type;
  final String title;
  final String description;
  final bool isRunning;
  final LeadAnalysisRun? result;
  final VoidCallback onRun;

  Color get _accentColor => switch (type) {
        'similar-cases' => const Color(0xFF22C55E),
        'opponent-angles' => const Color(0xFFF97316),
        'strategy-memo' => const Color(0xFF8B5CF6),
        _ => const Color(0xFF3B82F6),
      };

  IconData get _icon => switch (type) {
        'similar-cases' => Icons.library_books_outlined,
        'opponent-angles' => Icons.track_changes_rounded,
        'strategy-memo' => Icons.route_rounded,
        _ => Icons.analytics_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: result != null ? 0.85 : 0.42,
      minChildSize: 0.3,
      maxChildSize: 0.95,
      expand: false,
      builder: (ctx, scrollCtrl) => Container(
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: ListView(
          controller: scrollCtrl,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            // Handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Header
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: _accentColor.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child:
                      Icon(_icon, size: 20, color: _accentColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        description,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(
                                color: colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Run / Re-run button
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: isRunning ? null : onRun,
                style: FilledButton.styleFrom(
                  backgroundColor: _accentColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                icon: isRunning
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : Icon(result != null
                        ? Icons.refresh_rounded
                        : Icons.play_arrow_rounded),
                label: Text(
                  isRunning
                      ? 'Running analysis…'
                      : result != null
                          ? 'Re-run analysis'
                          : 'Run analysis',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 15),
                ),
              ),
            ),

            // Result
            if (result != null &&
                result!.contentMarkdown != null &&
                result!.contentMarkdown!.isNotEmpty) ...[
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color:
                      colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: _accentColor.withValues(alpha: 0.2)),
                ),
                child: SelectionArea(
                  child: MarkdownBody(
                    data: sanitizeMarkdown(result!.contentMarkdown!),
                    bulletBuilder: cleanBulletBuilder(
                        Theme.of(context).textTheme.bodySmall),
                    styleSheet: MarkdownStyleSheet.fromTheme(
                            Theme.of(context))
                        .copyWith(
                      p: Theme.of(context).textTheme.bodySmall,
                      h1: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                      h2: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                      h3: Theme.of(context)
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
                      blockSpacing: 6,
                      listIndent: 14,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
