import '../../../l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/drafting/prompt_refinement_flow.dart';
import '../../../core/geo/jurisdiction_options.dart';
import '../../../core/models/models.dart';
import '../../consent/ai_inference_consent_dialog.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/research_job_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../widgets/ai_model_picker.dart';
import '../../../widgets/legal_disclaimer.dart';
import '../../../widgets/staged_analysis_progress.dart';
import '../../../widgets/verification/verification_ui.dart';
import 'widgets/similar_cases_panel.dart';

class LegalResearchScreen extends ConsumerStatefulWidget {
  const LegalResearchScreen({super.key});

  @override
  ConsumerState<LegalResearchScreen> createState() =>
      _LegalResearchScreenState();
}

class _LegalResearchScreenState extends ConsumerState<LegalResearchScreen> {
  final _queryController = TextEditingController();
  final _queryFocusNode = FocusNode();
  final _scrollController = ScrollController();
  final _queryFieldKey = GlobalKey();

  late String _countryCode;
  String? _jurisdiction;
  String _researchMode = 'DEEP';
  String _aiModelMode = 'PREMIUM';
  String? _premiumModelId = 'gpt-5.6-sol';
  bool _loading = false;
  bool _refiningPrompt = false;
  String? _error;
  ApiErrorKind? _errorKind;
  LegalResearchResult? _result;

  List<StagedProgressStage> _researchStages(AppLocalizations l10n) {
    return [
      StagedProgressStage(
        id: 'review',
        label: l10n.mattersResearchProgressReviewQuestion,
        icon: Icons.manage_search_outlined,
        duration: const Duration(milliseconds: 2500),
      ),
      StagedProgressStage(
        id: 'authorities',
        label: l10n.mattersResearchProgressSearchAuthorities,
        icon: Icons.balance_outlined,
        duration: const Duration(milliseconds: 4000),
      ),
      StagedProgressStage(
        id: 'context',
        label: l10n.mattersResearchProgressAddContext,
        icon: Icons.public_outlined,
        duration: const Duration(milliseconds: 3500),
      ),
      StagedProgressStage(
        id: 'draft',
        label: l10n.mattersResearchProgressDraftAnswer,
        icon: Icons.auto_awesome_outlined,
        rotatingLabels: [
          l10n.mattersResearchProgressDraftAnswer,
          l10n.mattersResearchProgressTakingLonger,
        ],
      ),
    ];
  }

  String _friendlyError(AppLocalizations l10n, ApiException error) {
    switch (error.kind) {
      case ApiErrorKind.timeout:
        return l10n.mattersResearchTimeout;
      case ApiErrorKind.connection:
        return l10n.errorsConnection;
      case ApiErrorKind.network:
        return l10n.errorsNetwork;
      case ApiErrorKind.unauthorized:
        return l10n.errorsUnauthorized;
      case ApiErrorKind.validation:
        return l10n.errorsValidationFailed;
      case ApiErrorKind.aibusy:
        return 'AI is under high demand — retrying automatically. Please wait a moment.';
      case ApiErrorKind.server:
        return 'The AI service is temporarily unavailable. Tap retry to try again.';
      case ApiErrorKind.unknown:
        return l10n.mattersResearchFailed;
    }
  }

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).session?.user;
    _countryCode = user?.countryCode?.toUpperCase() ?? AppConfig.defaultCountry;
    _applyDetectedLocation();
    _queryFocusNode.addListener(_scrollToQuestionWhenFocused);
  }

  void _scrollToQuestionWhenFocused() {
    if (!_queryFocusNode.hasFocus) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final context = _queryFieldKey.currentContext;
      if (context == null || !mounted) return;
      Scrollable.ensureVisible(
        context,
        alignment: 0.25,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  void _applyDetectedLocation() {
    ref.read(detectedLocationProvider.future).then((detected) {
      if (!mounted) return;
      setState(() {
        _countryCode = detected.countryCode;
        if (detected.jurisdiction != null && _jurisdiction == null) {
          _jurisdiction = detected.jurisdiction;
        }
      });
    }).catchError((_) {
      // keep profile-seeded country on detection failure
    });
  }

  @override
  void dispose() {
    _queryFocusNode.removeListener(_scrollToQuestionWhenFocused);
    _queryFocusNode.dispose();
    _scrollController.dispose();
    _queryController.dispose();
    super.dispose();
  }

  List<String>? get _jurisdictions =>
      JurisdictionOptions.forCountry(_countryCode);

  Future<void> _runResearch([String? queryOverride]) async {
    final query = (queryOverride ?? _queryController.text).trim();
    if (query.length < 10) return;

    // Require AI inference consent before sending user data to third-party AI.
    final hasConsent = await requireAiInferenceConsent(context);
    if (!hasConsent || !mounted) return;

    final l10n = AppLocalizations.of(context);
    final session = ref.read(authControllerProvider).session;
    final tenantId = session?.user.tenantId;

    // Hydrate model prefs from wallet when available.
    try {
      final wallet = await ref.read(creditWalletProvider.future);
      final mode = wallet.aiModelMode?.toUpperCase();
      if (mode == 'AUTO' || mode == 'PREMIUM') {
        _aiModelMode = mode!;
      }
      if (wallet.premiumModelId != null && wallet.premiumModelId!.isNotEmpty) {
        _premiumModelId = wallet.premiumModelId;
      }
    } catch (_) {}

    setState(() {
      _loading = true;
      _error = null;
      _errorKind = null;
      _result = null;
    });

    debugPrint(
      '[Research] Starting: query="$query" country=$_countryCode '
      'mode=$_researchMode tenantId=$tenantId',
    );

    try {
      // Tenant path: async job → dedicated poller screen (matches web).
      if (tenantId != null && tenantId.isNotEmpty) {
        final jobId = await ref.read(researchJobProvider.notifier).start(
              query: query,
              countryCode: _countryCode,
              jurisdiction: _jurisdiction,
              tenantId: tenantId,
              researchMode: _researchMode,
              aiModelMode: _aiModelMode,
              premiumModelId:
                  _aiModelMode == 'PREMIUM' ? _premiumModelId : null,
            );
        if (!mounted) return;
        setState(() => _loading = false);
        context.push(
          '/lawyer/research/$jobId'
          '?q=${Uri.encodeComponent(query)}'
          '&country=$_countryCode'
          '&jurisdiction=${Uri.encodeComponent(_jurisdiction ?? '')}',
        );
        return;
      }

      // Consumer / no-tenant fallback: sync research.
      final result = await ref.read(aiApiProvider).runLegalResearch(
            query: query,
            countryCode: _countryCode,
            jurisdiction: _jurisdiction,
            tenantId: tenantId,
            researchMode: _researchMode,
            aiModelMode: _aiModelMode,
            premiumModelId:
                _aiModelMode == 'PREMIUM' ? _premiumModelId : null,
          );
      debugPrint(
        '[Research] Success: mode=${result.researchMode} '
        'verification=${result.verificationStatus}',
      );
      if (!mounted) return;
      setState(() => _result = result);
    } on ApiException catch (e) {
      debugPrint(
        '[Research] ApiException: kind=${e.kind} status=${e.statusCode} '
        'message=${e.message}',
      );
      if (!mounted) return;
      setState(() {
        _error = _friendlyError(l10n, e);
        _errorKind = e.kind;
      });
    } catch (e, stack) {
      debugPrint('[Research] Unknown error: $e\n$stack');
      if (!mounted) return;
      setState(() {
        _error = l10n.mattersResearchFailed;
        _errorKind = ApiErrorKind.unknown;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleResearchClick() async {
    final query = _queryController.text.trim();
    if (query.length < 10 || _loading || _refiningPrompt) return;

    setState(() => _refiningPrompt = true);
    try {
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final accepted = await runPromptRefinementFlow(
        context: context,
        ai: ref.read(aiApiProvider),
        prompt: query,
        purpose: 'research',
        tenantId: tenantId,
        countryCode: _countryCode,
        jurisdiction: _jurisdiction,
      );
      if (accepted == null || !mounted) return;
      _queryController.text = accepted;
      await _runResearch(accepted);
    } finally {
      if (mounted) setState(() => _refiningPrompt = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final colorScheme = Theme.of(context).colorScheme;
    final queryReady = _queryController.text.trim().length >= 10;
    final jurisdictions = _jurisdictions;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: _result != null
          ? null
          : AppBar(
              title: Text(l10n.commonLegalResearch),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () =>
                    context.canPop() ? context.pop() : context.go('/lawyer'),
              ),
            ),
      body: _result != null
          ? _ResultView(
              result: _result!,
              onNewSearch: () => setState(() => _result = null),
            )
          : SingleChildScrollView(
              controller: _scrollController,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                // Header
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.travel_explore,
                        color: colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l10n.commonAiLegalResearch,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          Text(l10n.commonJurisdictionscopedAnswersWithCitations,
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
                const SizedBox(height: 24),

                // Detected location chip
                Consumer(
                  builder: (context, ref, _) {
                    final locationAsync = ref.watch(detectedLocationProvider);
                    return locationAsync.when(
                      data: (loc) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on, size: 14, color: Colors.blueAccent),
                            const SizedBox(width: 4),
                            Text(
                              'Detected: ${loc.countryName}${loc.jurisdiction != null ? ", ${loc.jurisdiction}" : ""}',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.blueAccent),
                            ),
                          ],
                        ),
                      ),
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    );
                  },
                ),

                // Country
                Text(l10n.adminCountry,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 6),
                _ResearchDropdown<String>(
                  value: _countryCode,
                  items: AppConfig.supportedCountryCodes.map((code) {
                    return DropdownMenuItem(
                      value: code,
                      child: Text(
                        AppConfig.countryNames[code] ?? code,
                      ),
                    );
                  }).toList(),
                  onChanged: (v) {
                    if (v != null) {
                      setState(() {
                        _countryCode = v;
                        _jurisdiction = null;
                      });
                    }
                  },
                ),

                // Jurisdiction (conditional)
                if (jurisdictions != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    JurisdictionOptions.dropdownLabel(_countryCode),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 6),
                  _ResearchDropdown<String?>(
                    value: _jurisdiction,
                    items: [
                      DropdownMenuItem(
                        value: null,
                        child: Text(l10n.commonAllJurisdictions),
                      ),
                      ...jurisdictions.map(
                        (j) => DropdownMenuItem(value: j, child: Text(j)),
                      ),
                    ],
                    onChanged: (v) => setState(() => _jurisdiction = v),
                  ),
                ],

                const SizedBox(height: 16),

                // Research depth toggle
                Row(
                  children: [
                    Expanded(
                      child: _ModeButton(
                        label: 'Fast',
                        subtitle: 'Smart auto-escalation',
                        icon: Icons.bolt_outlined,
                        selected: _researchMode == 'FAST',
                        onTap: () => setState(() => _researchMode = 'FAST'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _ModeButton(
                        label: 'Deep',
                        subtitle: 'Full AI + web search',
                        icon: Icons.travel_explore,
                        selected: _researchMode == 'DEEP',
                        onTap: () => setState(() => _researchMode = 'DEEP'),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // AI Model picker
                Text(
                  'AI Model',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 10),
                AiModelPicker(
                  onChanged: (mode, premiumModelId) => setState(() {
                    _aiModelMode = mode;
                    _premiumModelId = premiumModelId;
                  }),
                ),

                const SizedBox(height: 20),

                // Question
                Text(l10n.commonQuestion,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: _queryFieldKey,
                  controller: _queryController,
                  focusNode: _queryFocusNode,
                  maxLines: 5,
                  minLines: 3,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    border: const OutlineInputBorder(),
                    hintText: l10n.commonEgWhatNoticeMustALandlordGiveBeforeTerminatingAMon,
                    hintStyle: TextStyle(
                      color: colorScheme.onSurfaceVariant,
                      fontSize: 13,
                    ),
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _queryController.text.trim().length < 10
                      ? l10n.mattersResearchCharsRemaining(
                          '${10 - _queryController.text.trim().length}',
                        )
                      : l10n.mattersResearchReadyToRun,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                ),

                if (_loading) ...[
                  const SizedBox(height: 16),
                  StagedAnalysisProgress(
                    active: _loading,
                    title: l10n.mattersResearchProgressTitle,
                    stages: _researchStages(l10n),
                  ),
                ],

                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colorScheme.errorContainer.withValues(alpha: 0.4),
                      borderRadius:
                          BorderRadius.circular(AppColors.radius),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _error!,
                          style:
                              TextStyle(color: colorScheme.onErrorContainer),
                        ),
                        if (_errorKind == ApiErrorKind.timeout ||
                            _errorKind == ApiErrorKind.network ||
                            _errorKind == ApiErrorKind.connection ||
                            _errorKind == ApiErrorKind.server ||
                            _errorKind == ApiErrorKind.unknown) ...[
                          const SizedBox(height: 10),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton.icon(
                              onPressed: _loading ? null : _runResearch,
                              icon: const Icon(Icons.refresh, size: 18),
                              label: Text(l10n.mattersRunResearch),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: (!queryReady || _loading || _refiningPrompt) ? null : _handleResearchClick,
                    icon: _loading || _refiningPrompt
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.travel_explore, size: 18),
                    label: Text(
                      _loading
                          ? l10n.mattersResearching
                          : _refiningPrompt
                              ? l10n.promptRefinePreparing
                              : l10n.mattersRunResearch,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const LegalDisclaimer(compact: true),
                ],
              ),
            ),
    );
  }
}

class _ResearchDropdown<T> extends StatelessWidget {
  const _ResearchDropdown({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: const InputDecoration(
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Research mode button
// ---------------------------------------------------------------------------

class _ModeButton extends StatelessWidget {
  const _ModeButton({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? colorScheme.primary.withValues(alpha: 0.12)
              : colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? colorScheme.primary : colorScheme.outlineVariant,
            width: selected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 18,
              color: selected ? colorScheme.primary : colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: selected
                              ? colorScheme.primary
                              : colorScheme.onSurface,
                        ),
                  ),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Results view
// ---------------------------------------------------------------------------

class _ResultView extends StatefulWidget {
  const _ResultView({required this.result, required this.onNewSearch});

  final LegalResearchResult result;
  final VoidCallback onNewSearch;

  @override
  State<_ResultView> createState() => _ResultViewState();
}

class _ResultViewState extends State<_ResultView> {
  bool _citationsExpanded = false;

  void _copyToClipboard(BuildContext context) {
    Clipboard.setData(ClipboardData(text: widget.result.outputMarkdown));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Copied to clipboard'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final result = widget.result;

    final mdStylesheet = MarkdownStyleSheet(
      h1: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, height: 1.3),
      h2: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, height: 1.35),
      h3: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, height: 1.35),
      p: textTheme.bodyMedium?.copyWith(height: 1.6),
      strong: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
      em: textTheme.bodyMedium?.copyWith(fontStyle: FontStyle.italic),
      listBullet: textTheme.bodyMedium?.copyWith(color: colorScheme.primary),
      blockquote: textTheme.bodyMedium?.copyWith(
        color: colorScheme.onSurfaceVariant,
        fontStyle: FontStyle.italic,
        height: 1.6,
      ),
      blockquoteDecoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: colorScheme.primary, width: 3),
        ),
        color: colorScheme.primary.withValues(alpha: 0.06),
        borderRadius: const BorderRadius.only(
          topRight: Radius.circular(6),
          bottomRight: Radius.circular(6),
        ),
      ),
      blockquotePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      horizontalRuleDecoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: colorScheme.outlineVariant, width: 1),
        ),
      ),
      h1Padding: const EdgeInsets.only(top: 20, bottom: 6),
      h2Padding: const EdgeInsets.only(top: 16, bottom: 4),
      h3Padding: const EdgeInsets.only(top: 12, bottom: 2),
      pPadding: const EdgeInsets.only(bottom: 8),
      listIndent: 20,
      blockSpacing: 8,
    );

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: CustomScrollView(
        slivers: [
          // ── Sticky header ──────────────────────────────────────────────
          SliverAppBar(
            pinned: true,
            expandedHeight: 120,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: widget.onNewSearch,
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.copy_outlined, size: 20),
                tooltip: 'Copy answer',
                onPressed: () => _copyToClipboard(context),
              ),
              const SizedBox(width: 4),
            ],
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 56, bottom: 14, right: 56),
              title: Text(
                l10n.commonLegalResearch,
                style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              background: Container(
                padding: const EdgeInsets.fromLTRB(16, 80, 16, 12),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _Chip(
                      icon: Icons.location_on_outlined,
                      label:
                          '${result.countryCode}${result.jurisdiction != null ? ' · ${result.jurisdiction}' : ''}',
                      color: colorScheme.primary,
                    ),
                    if (result.researchMode != null)
                      _Chip(
                        icon: result.researchMode == 'DEEP'
                            ? Icons.travel_explore
                            : Icons.bolt,
                        label: result.researchMode == 'DEEP' ? 'Deep' : 'Fast',
                        color: colorScheme.secondary,
                      ),
                    if (result.verificationStatus != null)
                      _Chip(
                        icon: Icons.verified_outlined,
                        label: result.verificationStatus!,
                        color: Colors.green,
                      ),
                    if (result.requiresLawyerReview == true)
                      _Chip(
                        icon: Icons.warning_amber_rounded,
                        label: 'Lawyer review advised',
                        color: colorScheme.error,
                      ),
                  ],
                ),
              ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),

                  // ── Model + corpus info bar ─────────────────────────────
                  Row(
                    children: [
                      Icon(Icons.auto_awesome_outlined,
                          size: 14, color: colorScheme.onSurfaceVariant),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          [
                            result.modelName,
                            if (result.sourceTierSummary != null)
                              result.sourceTierSummary!,
                            if (result.corpusEdition != null)
                              'corpus ${result.corpusEdition}',
                          ].join(' · '),
                          style: textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),

                  // ── Verification (web parity) ───────────────────────────
                  if (result.publicationState != null ||
                      (result.findings != null && result.findings!.isNotEmpty) ||
                      result.dimensions != null) ...[
                    const SizedBox(height: 14),
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
                  ],

                  if (result.similarCases != null &&
                      result.similarCases!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    SimilarCasesPanel(cases: result.similarCases!),
                  ],

                  // ── Jurisdiction notice ─────────────────────────────────
                  if (result.jurisdictionNotice != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: colorScheme.secondaryContainer.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: colorScheme.secondary.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline,
                              size: 16, color: colorScheme.secondary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              result.jurisdictionNotice!,
                              style: textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),

                  // ── Main answer (markdown) ──────────────────────────────
                  MarkdownBody(
                    data: result.outputMarkdown,
                    styleSheet: mdStylesheet,
                    selectable: true,
                    softLineBreak: false,
                  ),

                  const SizedBox(height: 24),

                  // ── Citations (collapsible) ─────────────────────────────
                  if (result.citations.isNotEmpty) ...[
                    GestureDetector(
                      onTap: () =>
                          setState(() => _citationsExpanded = !_citationsExpanded),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHighest
                              .withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: colorScheme.outlineVariant.withValues(
                                  alpha: 0.6)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.library_books_outlined,
                                size: 16, color: colorScheme.primary),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${result.citations.length} ${l10n.commonSourcesCited}',
                                style: textTheme.labelMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Icon(
                              _citationsExpanded
                                  ? Icons.expand_less
                                  : Icons.expand_more,
                              size: 18,
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (_citationsExpanded) ...[
                      const SizedBox(height: 8),
                      ...result.citations.asMap().entries.map((entry) =>
                        _CitationTile(
                          index: entry.key + 1,
                          citation: entry.value,
                        )),
                    ],
                    const SizedBox(height: 20),
                  ],

                  // ── Disclaimer + new search ─────────────────────────────
                  const LegalDisclaimer(compact: true),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: widget.onNewSearch,
                      icon: const Icon(Icons.search, size: 18),
                      label: Text(l10n.commonNewResearch),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Supporting widgets
// ---------------------------------------------------------------------------

class _Chip extends StatelessWidget {
  const _Chip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class _CitationTile extends StatelessWidget {
  const _CitationTile({required this.index, required this.citation});

  final int index;
  final LegalResearchCitation citation;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final url = citation.sourceUrl;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '$index',
              style: textTheme.labelSmall?.copyWith(
                color: colorScheme.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  citation.citation,
                  style: textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  citation.sourceName +
                      (citation.sourceTier != null
                          ? ' · ${citation.sourceTier}'
                          : ''),
                  style: textTheme.labelSmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                if (url != null && url.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: url));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('URL copied'),
                          duration: Duration(seconds: 2),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                    child: Text(
                      url,
                      style: textTheme.labelSmall?.copyWith(
                        color: colorScheme.primary,
                        decoration: TextDecoration.underline,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
