import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/ai_tools/ai_tool_widgets.dart';
import '../../../widgets/staged_analysis_progress.dart';

const _accentColor = Color(0xFFE11D48);

const _analysisStages = [
  StagedProgressStage(
    id: 'extract',
    label: 'Extracting FIR text…',
    icon: Icons.text_snippet_outlined,
    duration: Duration(seconds: 4),
  ),
  StagedProgressStage(
    id: 'sections',
    label: 'Identifying sections & accused…',
    icon: Icons.manage_search_outlined,
    duration: Duration(seconds: 4),
  ),
  StagedProgressStage(
    id: 'bail',
    label: 'Assessing bail posture…',
    icon: Icons.balance_outlined,
    duration: Duration(seconds: 3),
  ),
  StagedProgressStage(
    id: 'steps',
    label: 'Generating next steps…',
    icon: Icons.checklist_outlined,
    duration: Duration.zero,
  ),
];

// ─── Screen ────────────────────────────────────────────────────────────────────

class FirAnalysisScreen extends ConsumerStatefulWidget {
  const FirAnalysisScreen({super.key});

  @override
  ConsumerState<FirAnalysisScreen> createState() => _FirAnalysisScreenState();
}

class _FirAnalysisScreenState extends ConsumerState<FirAnalysisScreen> {
  bool _useUpload = false;
  final _textController = TextEditingController();
  PlatformFile? _pickedFile;

  bool _loading = false;
  String? _error;
  FirExtractionResult? _result;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'txt'],
      withData: true,
    );
    if (picked != null && picked.files.isNotEmpty) {
      setState(() => _pickedFile = picked.files.first);
    }
  }

  Future<void> _analyse() async {
    FocusScope.of(context).unfocus();
    if (_useUpload && _pickedFile == null) return;
    if (!_useUpload && _textController.text.trim().length < 20) return;

    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });

    try {
      final ai = ref.read(aiApiProvider);
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId;

      final result = _useUpload
          ? await ai.runFirUpload(
              fileBytes: _pickedFile!.bytes!,
              fileName: _pickedFile!.name,
              tenantId: tenantId,
            )
          : await ai.runFirExtract(
              extractedText: _textController.text.trim(),
              tenantId: tenantId,
            );
      if (mounted) setState(() => _result = result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() =>
            _error = 'Analysis failed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.firAnalysisTitle),
        backgroundColor: isDark ? AppColors.logoBlue : Colors.white,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        actions: _result != null
            ? [
                TextButton.icon(
                  onPressed: () =>
                      setState(() {
                        _result = null;
                        _error = null;
                        _pickedFile = null;
                        _textController.clear();
                      }),
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('New analysis'),
                  style: TextButton.styleFrom(
                    foregroundColor: _accentColor,
                  ),
                ),
                const SizedBox(width: 8),
              ]
            : null,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(
            height: 1,
            color: _accentColor.withValues(alpha: 0.20),
          ),
        ),
      ),
      body: Column(
        children: [
          AiToolFeatureHeader(
            icon: Icons.document_scanner_outlined,
            title: l10n.firAnalysisTitle,
            subtitle: l10n.firAnalysisSubtitle,
            accentColor: _accentColor,
          ),
          Expanded(
            child: AnimatedStateSwitcher(
              child: _loading
                  ? _LoadingView(key: const ValueKey('loading'))
                  : _error != null
                      ? _ErrorView(
                          key: const ValueKey('error'),
                          message: _error!,
                          onRetry: _analyse,
                        )
                      : _result != null
                          ? _ResultView(
                              key: const ValueKey('result'),
                              result: _result!,
                              onResearch: (q) => context.go(
                                '/lawyer/research?q=${Uri.encodeComponent(q)}',
                              ),
                              onDraft: () {
                                final r = _result!;
                                final kind = r.suggestedDraftTypes.isNotEmpty
                                    ? r.suggestedDraftTypes.first
                                    : null;
                                final narrative = r.factsNarrative ?? r.suggestedResearchQuery ?? '';
                                final params = <String, String>{};
                                if (narrative.isNotEmpty) {
                                  params['q'] = narrative;
                                }
                                if (kind != null && kind.isNotEmpty) {
                                  params['kind'] = kind;
                                }
                                final qs = Uri(queryParameters: params).query;
                                context.go(
                                  qs.isEmpty
                                      ? '/lawyer/docu-draft'
                                      : '/lawyer/docu-draft?$qs',
                                );
                              },
                            )
                          : _InputView(
                              key: const ValueKey('input'),
                              useUpload: _useUpload,
                              pickedFile: _pickedFile,
                              textController: _textController,
                              onModeChange: (v) =>
                                  setState(() => _useUpload = v),
                              onPickFile: _pickFile,
                              onAnalyse: _analyse,
                            ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Input view ────────────────────────────────────────────────────────────────

class _InputView extends StatelessWidget {
  const _InputView({
    super.key,
    required this.useUpload,
    required this.pickedFile,
    required this.textController,
    required this.onModeChange,
    required this.onPickFile,
    required this.onAnalyse,
  });

  final bool useUpload;
  final PlatformFile? pickedFile;
  final TextEditingController textController;
  final ValueChanged<bool> onModeChange;
  final VoidCallback onPickFile;
  final VoidCallback onAnalyse;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    final canAnalyse = useUpload
        ? pickedFile != null
        : textController.text.trim().length >= 20;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Mode toggle
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment<bool>(
                value: false,
                icon: Icon(Icons.edit_note_outlined, size: 16),
                label: Text('Paste text'),
              ),
              ButtonSegment<bool>(
                value: true,
                icon: Icon(Icons.upload_file_outlined, size: 16),
                label: Text('Upload FIR'),
              ),
            ],
            selected: {useUpload},
            onSelectionChanged: (s) => onModeChange(s.first),
            style: SegmentedButton.styleFrom(
              selectedBackgroundColor:
                  _accentColor.withValues(alpha: 0.12),
              selectedForegroundColor: _accentColor,
            ),
          ),
          const SizedBox(height: 20),

          // Input panel (animated switch between upload / paste)
          AnimatedStateSwitcher(
            child: useUpload
                ? _UploadZone(
                    key: const ValueKey('upload'),
                    pickedFile: pickedFile,
                    onTap: onPickFile,
                  )
                : _PasteField(
                    key: const ValueKey('paste'),
                    controller: textController,
                  ),
          ),

          const SizedBox(height: 20),

          // Analyse CTA
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: canAnalyse ? () {
                HapticFeedback.mediumImpact();
                onAnalyse();
              } : null,
              style: FilledButton.styleFrom(
                backgroundColor: _accentColor,
                foregroundColor: Colors.white,
                disabledBackgroundColor:
                    _accentColor.withValues(alpha: 0.35),
                disabledForegroundColor:
                    Colors.white.withValues(alpha: 0.50),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              icon: const Icon(Icons.analytics_outlined, size: 18),
              label: const Text(
                'Analyse FIR',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Supported: PDF, image, DOCX, TXT · Max 20 MB',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.45),
                ),
          ),
        ],
      ),
    );
  }
}

class _UploadZone extends StatelessWidget {
  const _UploadZone({super.key, required this.pickedFile, required this.onTap});
  final PlatformFile? pickedFile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorScheme = Theme.of(context).colorScheme;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
        decoration: BoxDecoration(
          color: isDark
              ? AppColors.logoBlueSurface
              : _accentColor.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(AppColors.radius),
          border: Border.all(
            color: pickedFile != null
                ? _accentColor.withValues(alpha: 0.60)
                : _accentColor.withValues(alpha: 0.30),
            width: pickedFile != null ? 1.5 : 1,
            style: pickedFile != null ? BorderStyle.solid : BorderStyle.solid,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              pickedFile != null
                  ? Icons.check_circle_outline
                  : Icons.upload_file_outlined,
              size: 36,
              color: pickedFile != null
                  ? _accentColor
                  : _accentColor.withValues(alpha: 0.55),
            ),
            const SizedBox(height: 10),
            Text(
              pickedFile != null
                  ? pickedFile!.name
                  : 'Tap to select FIR document',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: pickedFile != null
                        ? FontWeight.w600
                        : FontWeight.w400,
                    color: pickedFile != null
                        ? _accentColor
                        : colorScheme.onSurface.withValues(alpha: 0.55),
                  ),
              textAlign: TextAlign.center,
            ),
            if (pickedFile == null) ...[
              const SizedBox(height: 4),
              Text(
                'PDF, image, DOCX, or TXT',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.40),
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PasteField extends StatelessWidget {
  const _PasteField({super.key, required this.controller});
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextField(
      controller: controller,
      maxLines: 8,
      decoration: InputDecoration(
        hintText: 'Paste the FIR text here…',
        hintStyle: TextStyle(
          color: Theme.of(context)
              .colorScheme
              .onSurface
              .withValues(alpha: 0.35),
          fontSize: 14,
        ),
        contentPadding: const EdgeInsets.all(14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _accentColor, width: 1.5),
        ),
        filled: true,
        fillColor: isDark ? AppColors.logoBlueSurface : const Color(0xFFF8FAFC),
      ),
    );
  }
}

// ─── Loading ───────────────────────────────────────────────────────────────────

class _LoadingView extends StatelessWidget {
  const _LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: StagedAnalysisProgress(
          active: true,
          stages: _analysisStages,
          title: 'Analysing FIR…',
        ),
      ),
    );
  }
}

// ─── Error ─────────────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  const _ErrorView({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 40, color: Color(0xFFDC2626)),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            TextButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

// ─── Result view ───────────────────────────────────────────────────────────────

class _ResultView extends StatelessWidget {
  const _ResultView({
    super.key,
    required this.result,
    required this.onResearch,
    required this.onDraft,
  });

  final FirExtractionResult result;
  final ValueChanged<String> onResearch;
  final VoidCallback onDraft;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        // ── Summary hero card ────────────────────────────────────
        StaggeredFadeSlide(
          index: 0,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  _accentColor.withValues(alpha: isDark ? 0.18 : 0.08),
                  isDark
                      ? AppColors.logoBlueSurface
                      : Colors.white,
                ],
              ),
              borderRadius: BorderRadius.circular(AppColors.radius),
              border: Border.all(
                  color: _accentColor.withValues(alpha: 0.30)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: _accentColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.document_scanner_outlined,
                          size: 18, color: _accentColor),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        result.firNumber != null
                            ? 'FIR No. ${result.firNumber}'
                            : 'FIR Analysis',
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                if (result.policeStation != null ||
                    result.district != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    [
                      result.policeStation,
                      result.district,
                      result.state,
                    ].whereType<String>().join(', '),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color:
                              colorScheme.onSurface.withValues(alpha: 0.60),
                        ),
                  ),
                ],
                if (result.sections.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: result.sections
                        .map((s) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: _accentColor.withValues(alpha: 0.10),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                    color:
                                        _accentColor.withValues(alpha: 0.30)),
                              ),
                              child: Text(s,
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: _accentColor)),
                            ))
                        .toList(),
                  ),
                ],
                if (result.bailPostureSummary != null &&
                    result.bailPostureSummary!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 10),
                  Text(
                    'Bail posture',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color:
                              colorScheme.onSurface.withValues(alpha: 0.50),
                          letterSpacing: 0.5,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(result.bailPostureSummary!,
                      style: Theme.of(context).textTheme.bodySmall),
                ],
                if (result.riskFlags.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Risk flags',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color:
                              colorScheme.onSurface.withValues(alpha: 0.50),
                          letterSpacing: 0.5,
                        ),
                  ),
                  const SizedBox(height: 6),
                  ...result.riskFlags.map(
                    (f) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.warning_amber_rounded,
                              size: 14, color: Color(0xFFD97706)),
                          const SizedBox(width: 6),
                          Expanded(
                              child: Text(f,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall)),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),

        // ── Next steps ────────────────────────────────────────────
        if (result.nextSteps.isNotEmpty) ...[
          const SizedBox(height: 16),
          StaggeredFadeSlide(
            index: 1,
            child: Text(
              'Next steps',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          const SizedBox(height: 8),
          ...result.nextSteps.asMap().entries.map(
            (e) => StaggeredFadeSlide(
              index: e.key + 2,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _NextStepCard(step: e.value),
              ),
            ),
          ),
        ],

        // ── Action buttons ────────────────────────────────────────
        const SizedBox(height: 8),
        StaggeredFadeSlide(
          index: result.nextSteps.length + 2,
          child: Column(
            children: [
              if (result.suggestedResearchQuery != null) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      onResearch(result.suggestedResearchQuery!);
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.travel_explore, size: 16),
                    label: const Text('Research suggested query'),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onDraft();
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF7C3AED),
                    side: const BorderSide(
                        color: Color(0xFF7C3AED), width: 1.2),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.edit_document, size: 16),
                  label: const Text('Draft bail application'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NextStepCard extends StatelessWidget {
  const _NextStepCard({required this.step});
  final FirNextStep step;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorScheme = Theme.of(context).colorScheme;

    final priorityColor = switch (step.priority) {
      'urgent' => const Color(0xFFDC2626),
      'high'   => const Color(0xFFD97706),
      'medium' => const Color(0xFF2563EB),
      _        => const Color(0xFF16A34A),
    };

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.logoBlueSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Priority stripe
          Container(
            width: 4,
            height: double.infinity,
            decoration: BoxDecoration(
              color: priorityColor,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                bottomLeft: Radius.circular(12),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          step.step,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 8),
                      PriorityChip(priority: step.priority),
                    ],
                  ),
                  if (step.details.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      step.details,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurface
                                .withValues(alpha: 0.60),
                          ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
