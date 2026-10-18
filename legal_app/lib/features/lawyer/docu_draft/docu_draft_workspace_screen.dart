import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/drafting/draft_navigation.dart';
import '../../../core/models/india_draft.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/draft_job_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/ai_model_picker.dart';
import '../../../widgets/ai_tools/ai_tool_widgets.dart';
import '../../../widgets/staged_analysis_progress.dart';
import '../../../widgets/verification/verification_ui.dart';
import 'widgets/draft_accuracy_panel.dart';
import 'widgets/pinned_authorities_sheet.dart';

const _accentColor = Color(0xFF7C3AED);

const _generateStages = [
  StagedProgressStage(
    id: 'format',
    label: 'Selecting format…',
    icon: Icons.description_outlined,
    duration: Duration(seconds: 2),
  ),
  StagedProgressStage(
    id: 'draft',
    label: 'Drafting court document…',
    icon: Icons.edit_note_outlined,
    duration: Duration(seconds: 5),
  ),
  StagedProgressStage(
    id: 'details',
    label: 'Inserting case details…',
    icon: Icons.person_pin_outlined,
    duration: Duration(seconds: 4),
  ),
  StagedProgressStage(
    id: 'final',
    label: 'Finalising draft…',
    icon: Icons.check_circle_outline,
    duration: Duration.zero,
  ),
];

class DocuDraftWorkspaceScreen extends ConsumerStatefulWidget {
  const DocuDraftWorkspaceScreen({
    super.key,
    this.kind,
    this.label,
    this.details,
    this.clientName,
    this.courtName,
    this.opposingParty,
    this.countryCode = 'IN',
    this.autoGenerate = false,
    this.draftId,
    this.initialPinnedSections = const [],
    this.initialPinnedCaseLaws = const [],
  });

  final String? kind;
  final String? label;
  final String? details;
  final String? clientName;
  final String? courtName;
  final String? opposingParty;
  final String countryCode;
  final bool autoGenerate;
  final String? draftId;
  final List<PinnedSection> initialPinnedSections;
  final List<PinnedCaseLaw> initialPinnedCaseLaws;

  @override
  ConsumerState<DocuDraftWorkspaceScreen> createState() =>
      _DocuDraftWorkspaceScreenState();
}

class _DocuDraftWorkspaceScreenState extends ConsumerState<DocuDraftWorkspaceScreen> {
  late String _kind;
  late String _label;
  late String _countryCode;

  final _caseDetailsController = TextEditingController();
  final _clientNameController = TextEditingController();
  final _courtNameController = TextEditingController();
  final _opposingController = TextEditingController();
  String _language = 'en';
  String? _attachmentContext;
  String _aiModelMode = 'PREMIUM';
  String? _premiumModelId;

  bool _generating = false;
  bool _filling = false;
  bool _verifying = false;
  String? _error;
  String? _draftText;
  int? _creditsUsed;
  String? _draftId;
  String? _proceduralNote;
  String? _asyncJobId;
  DraftSetState? _draftSet;

  DraftVerificationAudit? _verification;
  DraftAccuracyGate? _accuracyGate;
  VerificationReport? _verificationReport;
  ConfidenceReport? _confidenceReport;
  List<DraftSectionResult>? _sections;

  List<PinnedSection> _pinnedSections = [];
  List<PinnedCaseLaw> _pinnedCaseLaws = [];

  final Map<String, TextEditingController> _blankControllers = {};

  bool get _isUs =>
      _countryCode == 'US' || (_kind.startsWith('us_'));

  bool get _canCertify =>
      _accuracyGate?.canCertify == true ||
      _verificationReport?.canCertify == true ||
      _verification?.canCertify == true;

  @override
  void initState() {
    super.initState();
    _kind = widget.kind ?? '';
    _label = widget.label ?? widget.kind ?? 'Draft';
    _countryCode = widget.countryCode;
    _draftId = widget.draftId;
    _pinnedSections = List.of(widget.initialPinnedSections);
    _pinnedCaseLaws = List.of(widget.initialPinnedCaseLaws);

    if (widget.details != null) {
      _caseDetailsController.text = widget.details!;
      final hints = extractDraftFieldHints(widget.details!);
      _clientNameController.text = widget.clientName ?? hints['clientName'] ?? '';
      _courtNameController.text = widget.courtName ?? hints['courtName'] ?? '';
      _opposingController.text = widget.opposingParty ?? hints['opposingParty'] ?? '';
    } else {
      _clientNameController.text = widget.clientName ?? '';
      _courtNameController.text = widget.courtName ?? '';
      _opposingController.text = widget.opposingParty ?? '';
    }

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _draftSet = await getDraftSet();
      try {
        final wallet = await ref.read(creditWalletProvider.future);
        final mode = wallet.aiModelMode?.toUpperCase();
        if (mode == 'AUTO' || mode == 'PREMIUM') _aiModelMode = mode!;
        _premiumModelId = wallet.premiumModelId;
      } catch (_) {}
      if (widget.autoGenerate && _caseDetailsController.text.trim().length >= 10) {
        await _generate();
      }
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _caseDetailsController.dispose();
    _clientNameController.dispose();
    _courtNameController.dispose();
    _opposingController.dispose();
    for (final c in _blankControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  List<String> _extractBlanks(String text) {
    return RegExp(r'\[([^\]]+)\]')
        .allMatches(text)
        .map((m) => m.group(1)!)
        .toSet()
        .toList();
  }

  Future<void> _pickAttachment() async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.bytes == null) return;
    try {
      final api = ref.read(indiaDraftingApiProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final attachmentText = await api.extractDraftContext(
        fileBytes: file.bytes!,
        fileName: file.name,
        tenantId: tenantId,
      );
      if (mounted) {
        setState(() => _attachmentContext = attachmentText);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Attached: ${file.name}')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  void _applyIndiaResult(IndiaDraftResult result) {
    if (result.kindOverridden && result.recommendedKind != null) {
      _kind = result.recommendedKind!;
    }
    _proceduralNote = result.proceduralDetermination?.explanation;
    _verification = result.verification;
    _accuracyGate = result.accuracyGate;
    _verificationReport = result.verificationReport;
    _confidenceReport = result.confidenceReport;
    _sections = result.sections;
    _asyncJobId = result.jobId ?? _asyncJobId;
    _applyDraft(result.draft, result.creditsUsed, result.draftId ?? result.jobId);
  }

  Future<void> _generate() async {
    if (_caseDetailsController.text.trim().length < 10 || _kind.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _generating = true;
      _error = null;
      _draftText = null;
      _verification = null;
      _accuracyGate = null;
      _verificationReport = null;
      _confidenceReport = null;
      _sections = null;
      for (final c in _blankControllers.values) {
        c.dispose();
      }
      _blankControllers.clear();
    });
    ref.read(draftJobProvider.notifier).reset();

    final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
    final set = _draftSet;
    final bundleIndex = set?.items.indexWhere((i) => i.kind == _kind) ?? -1;

    try {
      final api = ref.read(indiaDraftingApiProvider);
      if (_isUs) {
        final result = await api.generateUsDraft(
          kind: _kind,
          caseDetails: _caseDetailsController.text.trim(),
          clientName: _clientNameController.text.trim().isNotEmpty
              ? _clientNameController.text.trim()
              : null,
          courtName: _courtNameController.text.trim().isNotEmpty
              ? _courtNameController.text.trim()
              : null,
          opposingParty: _opposingController.text.trim().isNotEmpty
              ? _opposingController.text.trim()
              : null,
          modelMode: _aiModelMode,
          tenantId: tenantId,
        );
        _verification = result.verification;
        _accuracyGate = result.accuracyGate;
        _applyDraft(result.draft, result.creditsUsed, result.draftId);
      } else {
        final result = await api.generateIndiaDraft(
          kind: _kind,
          caseDetails: _caseDetailsController.text.trim(),
          clientName: _clientNameController.text.trim().isNotEmpty
              ? _clientNameController.text.trim()
              : null,
          courtName: _courtNameController.text.trim().isNotEmpty
              ? _courtNameController.text.trim()
              : null,
          opposingParty: _opposingController.text.trim().isNotEmpty
              ? _opposingController.text.trim()
              : null,
          language: _language,
          attachmentContext: _attachmentContext,
          bundleMode: set != null && set.items.length > 1,
          bundleIndex: bundleIndex >= 0 ? bundleIndex : null,
          modelMode: _aiModelMode,
          pinnedSections: _pinnedSections.isEmpty ? null : _pinnedSections,
          pinnedCaseLaws: _pinnedCaseLaws.isEmpty ? null : _pinnedCaseLaws,
          tenantId: tenantId,
        );

        if (result.needsAsyncPolling) {
          _asyncJobId = result.jobId;
          ref.read(draftJobProvider.notifier).startPolling(
                jobId: result.jobId!,
                tenantId: tenantId,
              );
          return;
        }

        _applyIndiaResult(result);
      }

      if (set != null && bundleIndex >= 0) {
        await updateDraftSetItem(
          bundleIndex,
          status: DraftSetItemStatus.done,
          draftId: _draftId,
        );
        _draftSet = await getDraftSet();
      }
      if (mounted) setState(() => _generating = false);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _generating = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = AppLocalizations.of(context).docuDraftGenerationFailed;
          _generating = false;
        });
      }
    }
  }

  void _applyDraft(String draft, int? credits, String? draftId) {
    final blanks = _extractBlanks(draft);
    for (final b in blanks) {
      _blankControllers.putIfAbsent(b, TextEditingController.new);
    }
    setState(() {
      _draftText = draft;
      _creditsUsed = credits;
      _draftId = draftId;
      _generating = false;
    });
  }

  Future<void> _reverify() async {
    if (_draftText == null || _isUs) return;
    setState(() => _verifying = true);
    try {
      final api = ref.read(indiaDraftingApiProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final result = await api.reverifyIndiaDraft(
        documentKind: _kind,
        draft: _buildFinalDraft(),
        caseDetails: _caseDetailsController.text.trim(),
        tenantId: tenantId,
      );
      setState(() {
        _draftText = result.draft;
        _verification = result.verification;
        _accuracyGate = result.accuracyGate;
        _creditsUsed = (_creditsUsed ?? 0) + result.creditsUsed;
      });
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _fixBlockers(String instruction) async {
    if (_draftText == null || _isUs) return;
    setState(() => _verifying = true);
    try {
      final api = ref.read(indiaDraftingApiProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final result = await api.fixIndiaDraftVerification(
        documentKind: _kind,
        draft: _buildFinalDraft(),
        instruction: instruction,
        caseDetails: _caseDetailsController.text.trim(),
        tenantId: tenantId,
      );
      setState(() {
        _draftText = result.draft;
        _verification = result.verification;
        _accuracyGate = result.accuracyGate;
        _creditsUsed = (_creditsUsed ?? 0) + result.creditsUsed;
      });
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _autoFill() async {
    if (_draftText == null) return;
    final blanks = _extractBlanks(_draftText!);
    final empty = blanks.where((b) => (_blankControllers[b]?.text ?? '').isEmpty).toList();
    if (empty.isEmpty) return;
    setState(() => _filling = true);
    try {
      final api = ref.read(indiaDraftingApiProvider);
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final contextMap = <String, String>{
        'caseDetails': _caseDetailsController.text.trim(),
        for (final b in blanks)
          if ((_blankControllers[b]?.text ?? '').isNotEmpty) b: _blankControllers[b]!.text,
      };
      final result = _isUs
          ? await api.fillUsDraftBlanks(
              documentKind: _kind,
              context: contextMap,
              emptyFields: empty,
              tenantId: tenantId,
            )
          : await api.fillBlanks(
              documentKind: _kind,
              context: contextMap,
              emptyFields: empty,
              tenantId: tenantId,
            );
      for (final e in result.suggestions.entries) {
        _blankControllers[e.key]?.text = e.value;
      }
      if (mounted) setState(() {});
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _filling = false);
    }
  }

  String _buildFinalDraft() {
    var text = _draftText ?? '';
    for (final e in _blankControllers.entries) {
      if (e.value.text.isNotEmpty) {
        text = text.replaceAll('[${e.key}]', e.value.text);
      }
    }
    return text;
  }

  Future<void> _exportOrShare({required bool share}) async {
    final text = _buildFinalDraft();
    if (!_canCertify && (_accuracyGate != null || _verification != null || _verificationReport != null)) {
      final reasons = <String>[
        ...?_accuracyGate?.unresolvedFacts,
        ...?_verification?.completenessGaps,
        ...?_verificationReport?.overallWarnings,
      ];
      if (reasons.isEmpty) {
        reasons.add('Verification blockers remain. Re-verify or fix blockers first.');
      }
      await ExportBlockedDialog.show(
        context,
        reasons: reasons,
        onForceWatermark: () {
          final watermarked =
              'DRAFT — NOT FOR FILING\n\n$text\n\n— Watermarked export —';
          if (share) {
            Share.share(watermarked, subject: _label);
          } else {
            Clipboard.setData(ClipboardData(text: watermarked));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Copied watermarked draft')),
            );
          }
        },
      );
      return;
    }
    if (share) {
      await Share.share(text, subject: _label);
    } else {
      await Clipboard.setData(ClipboardData(text: text));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).docuDraftCopied)),
        );
      }
    }
  }

  Future<void> _editPins() async {
    final result = await PinnedAuthoritiesSheet.show(
      context,
      pinnedSections: _pinnedSections,
      pinnedCaseLaws: _pinnedCaseLaws,
    );
    if (result != null && mounted) {
      setState(() {
        _pinnedSections = result.sections;
        _pinnedCaseLaws = result.cases;
      });
    }
  }

  Future<void> _navigateSetItem(int index) async {
    final set = _draftSet;
    if (set == null || index < 0 || index >= set.items.length) return;
    await setDraftSetCurrentIndex(index);
    final item = set.items[index];
    final params = parseDraftUrl(item.draftUrl).copyWith(
      details: _caseDetailsController.text.trim(),
      clientName: _clientNameController.text.trim(),
      courtName: _courtNameController.text.trim(),
      opposingParty: _opposingController.text.trim(),
      autoGenerate: item.status != DraftSetItemStatus.done,
      draftId: item.draftId,
    );
    if (mounted) context.replace(buildDocuDraftWorkspacePath(params));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final set = _draftSet;
    final setIndex = set?.currentIndex ?? 0;

    ref.listen<DraftJobState>(draftJobProvider, (prev, next) {
      if (next.result != null && prev?.result != next.result) {
        _applyIndiaResult(next.result!);
      } else if (next.error != null && next.error != prev?.error) {
        setState(() {
          _error = next.error;
          _generating = false;
        });
      }
    });

    final jobState = ref.watch(draftJobProvider);
    final showJobProgress = _generating && jobState.jobId != null && jobState.result == null;

    return Scaffold(
      appBar: AppBar(
        title: Text(_label),
        backgroundColor: isDark ? AppColors.logoBlue : Colors.white,
        elevation: 0,
        actions: [
          if (showJobProgress)
            TextButton(
              onPressed: () => ref.read(draftJobProvider.notifier).cancelJob(),
              child: const Text('Cancel'),
            ),
        ],
      ),
      body: Column(
        children: [
          if (set != null && set.items.length > 1)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  IconButton(
                    onPressed: setIndex > 0 ? () => _navigateSetItem(setIndex - 1) : null,
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Expanded(
                    child: Text(
                      'Filing set ${setIndex + 1}/${set.items.length}: ${set.items[setIndex].label}',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  IconButton(
                    onPressed: setIndex < set.items.length - 1
                        ? () => _navigateSetItem(setIndex + 1)
                        : null,
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: DraftStepIndicator(
              currentStep: _draftText != null ? 1 : 0,
              accentColor: _accentColor,
              steps: [l10n.docuDraftStepMatch, l10n.docuDraftStepDraft],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: showJobProgress
                  ? _buildJobProgress(jobState)
                  : _generating
                      ? Center(
                          child: StagedAnalysisProgress(
                            active: true,
                            stages: _generateStages,
                            title: l10n.docuDraftGenerateDraft,
                          ),
                        )
                      : _draftText != null
                          ? _buildEditor(l10n)
                          : _buildForm(l10n),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJobProgress(DraftJobState job) {
    final p = job.progress;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              p?.message ?? 'Generating draft…',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(value: job.percent > 0 ? job.percent : null),
            const SizedBox(height: 8),
            Text(
              [
                if (p != null && p.stage.isNotEmpty) p.stage,
                if (p != null) '${p.percent}%',
                if (p?.completedSections != null && p?.totalSections != null)
                  '${p!.completedSections}/${p.totalSections} sections',
              ].join(' · '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_proceduralNote != null)
          Card(
            color: Colors.amber.withValues(alpha: 0.12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text('${l10n.docuDraftProceduralNote}: $_proceduralNote'),
            ),
          ),
        AiModelPicker(
          compact: true,
          initialMode: _aiModelMode,
          initialPremiumModelId: _premiumModelId,
          onChanged: (mode, modelId) {
            setState(() {
              _aiModelMode = mode;
              _premiumModelId = modelId;
            });
          },
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _caseDetailsController,
          maxLines: 5,
          decoration: InputDecoration(
            labelText: l10n.docuDraftCaseDetails,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _clientNameController,
          decoration: const InputDecoration(labelText: 'Client name', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _courtNameController,
          decoration: const InputDecoration(labelText: 'Court', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _opposingController,
          decoration: const InputDecoration(labelText: 'Opposing party', border: OutlineInputBorder()),
        ),
        if (!_isUs) ...[
          const SizedBox(height: 8),
          InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Language',
              border: OutlineInputBorder(),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _language,
                items: const [
                  DropdownMenuItem(value: 'en', child: Text('English')),
                  DropdownMenuItem(value: 'hi', child: Text('Hindi')),
                  DropdownMenuItem(value: 'hinglish', child: Text('Hinglish')),
                ],
                onChanged: (v) {
                  if (v != null) setState(() => _language = v);
                },
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _pickAttachment,
          icon: const Icon(Icons.attach_file),
          label: Text(
            _attachmentContext != null ? 'Attachment ready' : 'Attach document',
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _editPins,
          icon: const Icon(Icons.push_pin_outlined),
          label: Text(
            'Pinned authorities (${_pinnedSections.length + _pinnedCaseLaws.length})',
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 16),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: _accentColor,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onPressed: _generate,
          icon: const Icon(Icons.auto_awesome),
          label: Text(l10n.docuDraftGenerateDraft),
        ),
      ],
    );
  }

  Widget _buildEditor(AppLocalizations l10n) {
    final blanks = _extractBlanks(_draftText!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_proceduralNote != null)
          Card(
            color: Colors.amber.withValues(alpha: 0.12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text('${l10n.docuDraftProceduralNote}: $_proceduralNote'),
            ),
          ),
        DraftAccuracyPanel(
          verification: _verification,
          accuracyGate: _accuracyGate,
          verificationReport: _verificationReport,
          confidenceReport: _confidenceReport,
          sections: _sections,
          busy: _verifying,
          onReverify: _isUs ? null : _reverify,
          onFixBlocker: _isUs ? null : _fixBlockers,
        ),
        const SizedBox(height: 12),
        ...blanks.map(
          (b) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: TextField(
              controller: _blankControllers[b],
              decoration: InputDecoration(
                labelText: b,
                border: const OutlineInputBorder(),
              ),
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: Theme.of(context).dividerColor),
            borderRadius: BorderRadius.circular(8),
          ),
          child: SelectableText(_buildFinalDraft()),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: _filling ? null : _autoFill,
              icon: _filling
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_fix_high),
              label: Text(l10n.docuDraftAutoFill),
            ),
            FilledButton.icon(
              onPressed: () => _exportOrShare(share: false),
              icon: const Icon(Icons.copy),
              label: Text(l10n.docuDraftCopyDraft),
            ),
            OutlinedButton.icon(
              onPressed: () => _exportOrShare(share: true),
              icon: const Icon(Icons.share_outlined),
              label: const Text('Share / export'),
            ),
          ],
        ),
        if (_creditsUsed != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Credits used: $_creditsUsed',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        TextButton(
          onPressed: () => setState(() => _draftText = null),
          child: Text(l10n.docuDraftRedo),
        ),
      ],
    );
  }
}
