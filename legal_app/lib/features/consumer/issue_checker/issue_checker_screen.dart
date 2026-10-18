import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/device/device_id.dart';
import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/utils/credit_errors.dart';
import '../../../features/consent/ai_inference_consent_dialog.dart';
import '../../../features/credits/widgets/credit_usage_meter.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/legal_disclaimer.dart';
import 'issue_checker_constants.dart';
import 'widgets/details_step.dart';
import 'widgets/documents_step.dart';
import 'widgets/full_preview.dart';
import 'widgets/intake_analysis_progress.dart';
import 'widgets/intake_micro_flow.dart';
import 'widgets/teaser_preview.dart';
import 'widgets/wizard_progress.dart';

// Step indices for the authenticated 4-step wizard.
const _kStepIntake = 0;
const _kStepDetails = 1;
const _kStepDocuments = 2;
const _kStepPreview = 3;

class IssueCheckerScreen extends ConsumerStatefulWidget {
  const IssueCheckerScreen({
    super.key,
    this.previewMode = false,
    this.upgradeMode = false,
    this.attachMode = false,
  });

  /// True when arriving from the welcome screen (anonymous free teaser).
  final bool previewMode;

  /// True when returning from auth with a saved anonymous session to upgrade.
  final bool upgradeMode;

  /// True when returning from auth to the documents step.
  final bool attachMode;

  @override
  ConsumerState<IssueCheckerScreen> createState() =>
      _IssueCheckerScreenState();
}

class _IssueCheckerScreenState extends ConsumerState<IssueCheckerScreen> {
  final _pageController = PageController();

  // ── State ─────────────────────────────────────────────────────────────────
  int _step = _kStepIntake;
  IssueCheckerWizardData _data = const IssueCheckerWizardData();
  bool _loading = false;
  String? _error;
  bool _isCreditError = false;

  // Anonymous teaser result
  IssueCheckerTeaserResult? _teaser;

  // Full preview result
  IssueCheckerPreviewResult? _preview;

  // Session
  String? _anonymousSessionId;
  String? _consumerCaseId;

  // Refinement
  List<LeadPlanQuestion> _refinementQuestions = [];
  bool _refinementQuestionsLoading = false;
  bool _isRefining = false;

  // Outcome options for details step
  List<String> _outcomeOptions = [];
  bool _outcomeOptionsLoading = false;

  // Guard to prevent double-upgrade
  bool _upgradeAttempted = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _initSession();
  }

  Future<void> _initSession() async {
    final sessionAsync = await ref.read(issueCheckerSessionStorageProvider.future);
    final saved = sessionAsync.load();

    if (widget.upgradeMode && !_upgradeAttempted) {
      _upgradeAttempted = true;
      if (saved != null) {
        setState(() {
          _data = saved.data;
          _anonymousSessionId = saved.anonymousSessionId;
          _consumerCaseId = saved.consumerCaseId;
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _runFullPreview(saved.anonymousSessionId);
        });
      }
      return;
    }

    if (widget.attachMode && saved != null) {
      setState(() {
        _data = saved.data;
        _anonymousSessionId = saved.anonymousSessionId;
        _consumerCaseId = saved.consumerCaseId;
        _step = _kStepDocuments;
      });
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _pageController.jumpToPage(_kStepDocuments),
      );
      return;
    }

    if (saved != null && !widget.previewMode) {
      setState(() {
        _data = saved.data;
        _anonymousSessionId = saved.anonymousSessionId;
        _consumerCaseId = saved.consumerCaseId;
        _step = saved.step.clamp(0, 3);
      });
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _pageController.jumpToPage(_step),
      );
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  // ── Session persistence ────────────────────────────────────────────────────

  Future<void> _saveSession() async {
    final storage = await ref.read(issueCheckerSessionStorageProvider.future);
    await storage.save(
      IssueCheckerSessionState(
        step: _step,
        data: _data,
        anonymousSessionId: _anonymousSessionId,
        consumerCaseId: _consumerCaseId,
        teaserGenerated: _teaser != null,
        pendingAttach: widget.attachMode,
      ),
    );
  }

  Future<void> _clearSession() async {
    final storage = await ref.read(issueCheckerSessionStorageProvider.future);
    await storage.clear();
    await ref.read(tokenStorageProvider).clearAnonymousSessionId();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  void _goToStep(int step) {
    setState(() {
      _step = step;
      _error = null;
    });
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  // ── Anonymous flow ─────────────────────────────────────────────────────────

  /// Called when IntakeMicroFlow completes for an *anonymous* user.
  Future<void> _runAnonFlow(IssueCheckerWizardData intake) async {
    setState(() {
      _data = intake;
      _loading = true;
      _error = null;
      _teaser = null;
    });
    await _saveSession();

    try {
      final deviceFp = await getDeviceId();

      // Step 1: classify (non-fatal)
      IssueCheckerClassifyResult? classified;
      try {
        classified = await ref.read(consumersApiProvider).classifyIssueChecker(
              countryCode: intake.countryCode,
              facts: intake.facts,
              deviceFingerprint: deviceFp,
            );
      } catch (_) {
        // Classification failure is non-fatal; teaser still runs.
      }

      final payload = IssueCheckerWizardData(
        countryCode: intake.countryCode,
        jurisdiction: intake.jurisdiction,
        issueType: classified?.issueType ?? '',
        title: classified?.suggestedTitle ?? '',
        facts: intake.facts,
        urgencyLevel: classified?.urgencyLevel ?? 'MEDIUM',
        parties: classified?.parties ?? '',
      );

      // Step 2: teaser
      final teaser = await ref.read(consumersApiProvider).teaserIssueChecker(
            countryCode: payload.countryCode,
            issueType: payload.issueType.isNotEmpty ? payload.issueType : 'Other',
            title: payload.title.isNotEmpty
                ? payload.title
                : _deriveTitleFrom(intake.facts),
            jurisdiction: payload.jurisdiction.isNotEmpty
                ? payload.jurisdiction
                : null,
            facts: payload.facts,
            parties: payload.parties.isNotEmpty ? payload.parties : null,
            urgencyLevel: payload.urgencyLevel,
            deviceFingerprint: deviceFp,
          );

      if (!mounted) return;

      setState(() {
        _teaser = teaser;
        _anonymousSessionId = teaser.anonymousSessionId;
        _data = payload;
        _loading = false;
      });

      // Persist session id for upgrade after sign-in.
      await ref
          .read(tokenStorageProvider)
          .saveAnonymousSessionId(teaser.anonymousSessionId);
      await _saveSession();

      // Step 3: refinement questions in background (device fingerprint only)
      _fetchRefinementQuestions(payload, deviceFp: deviceFp);
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _isCreditError = isInsufficientCreditsError(err);
        _error = _isCreditError
            ? getCreditErrorMessage(err)
            : err.toString().replaceAll('Exception: ', '');
      });
    }
  }

  Future<void> _fetchRefinementQuestions(
    IssueCheckerWizardData data, {
    String? deviceFp,
  }) async {
    setState(() => _refinementQuestionsLoading = true);
    try {
      final result =
          await ref.read(consumersApiProvider).getPlanQuestions(
                facts: data.facts,
                countryCode: data.countryCode,
                issueType: data.issueType.isNotEmpty ? data.issueType : null,
                deviceFingerprint: deviceFp,
              );
      if (mounted) setState(() => _refinementQuestions = result.questions);
    } catch (_) {
      if (mounted) setState(() => _refinementQuestions = []);
    } finally {
      if (mounted) setState(() => _refinementQuestionsLoading = false);
    }
  }

  // ── Authenticated flow ─────────────────────────────────────────────────────

  Future<void> _runAuthFlow(IssueCheckerWizardData intake) async {
    final isAuthenticated =
        ref.read(authControllerProvider).session != null;

    if (!isAuthenticated) {
      // Save session and redirect to auth.
      setState(() => _data = intake);
      await _saveSession();
      if (!mounted) return;
      context.push(
        '/auth/sign-up?redirect=/consumer/issue-checker?upgrade=1',
      );
      return;
    }

    setState(() {
      _data = intake;
      _error = null;
    });
    await _saveSession();

    // Fetch outcome options for details step in background.
    _loadOutcomeOptions(intake);

    _goToStep(_kStepDetails);
  }

  Future<void> _loadOutcomeOptions(IssueCheckerWizardData data) async {
    setState(() => _outcomeOptionsLoading = true);
    try {
      final deviceFp = await getDeviceId();
      final result = await ref.read(consumersApiProvider).getOutcomeOptions(
            facts: data.facts,
            countryCode: data.countryCode,
            practiceArea: data.issueType.isNotEmpty ? data.issueType : null,
            deviceFingerprint: deviceFp,
          );
      if (mounted) setState(() => _outcomeOptions = result.options);
    } catch (_) {
      if (mounted) setState(() => _outcomeOptions = []);
    } finally {
      if (mounted) setState(() => _outcomeOptionsLoading = false);
    }
  }

  // ── Full preview ───────────────────────────────────────────────────────────

  Future<void> _runFullPreview(
    String? anonymousSessionId, [
    Map<String, dynamic>? planningAnswers,
  ]) async {
    final l10n = AppLocalizations.of(context);
    final isAuthenticated =
        ref.read(authControllerProvider).session != null;
    if (!isAuthenticated) return;

    // Require AI inference consent before sending data to third-party AI.
    if (!widget.previewMode) {
      final hasConsent = await requireAiInferenceConsent(context);
      if (!hasConsent || !mounted) return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _isCreditError = false;
      _isRefining = planningAnswers != null;
    });

    try {
      final deviceFp = await getDeviceId();
      final result =
          await ref.read(consumersApiProvider).previewIssueChecker(
                countryCode: _data.countryCode,
                issueType: _data.issueType.isNotEmpty
                    ? _data.issueType
                    : 'Other',
                title: _data.title.isNotEmpty
                    ? _data.title
                    : _deriveTitleFrom(_data.facts),
                jurisdiction: _data.jurisdiction.isNotEmpty
                    ? _data.jurisdiction
                    : null,
                facts: _data.facts,
                desiredOutcome: _data.desiredOutcome.isNotEmpty
                    ? _data.desiredOutcome
                    : null,
                parties: _data.parties.isNotEmpty ? _data.parties : null,
                urgencyLevel: _data.urgencyLevel,
                consumerCaseId: _consumerCaseId,
                anonymousSessionId: anonymousSessionId,
                planningAnswers: planningAnswers,
                deviceFingerprint: deviceFp,
              );

      if (!mounted) return;

      // Invalidate credit wallet after consuming credits.
      ref.invalidate(creditWalletProvider);
      await _clearSession();
      if (!mounted) return;

      setState(() {
        _preview = result;
        _loading = false;
        _isRefining = false;
      });

      // Jump to preview page.
      _goToStep(_kStepPreview);
    } on ApiException catch (err) {
      if (!mounted) return;
      final credit = isInsufficientCreditsError(err);
      setState(() {
        _loading = false;
        _isRefining = false;
        _isCreditError = credit;
        _error = credit ? getCreditErrorMessage(err) : _mapApiError(err, l10n);
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _isRefining = false;
        _error = err.toString().replaceAll('Exception: ', '');
      });
    }
  }

  String _mapApiError(ApiException err, AppLocalizations l10n) {
    if (err.kind == ApiErrorKind.timeout || err.kind == ApiErrorKind.aibusy) {
      return l10n.issueCheckerErrorPreviewFailed;
    }
    final msg = err.message.trim();
    if (msg.isNotEmpty && !msg.toLowerCase().contains('port 4000')) return msg;
    return l10n.issueCheckerErrorPreviewFailed;
  }

  String _deriveTitleFrom(String facts) {
    final trimmed = facts.trim();
    if (trimmed.isEmpty) return 'Legal matter';
    final first = trimmed.split(RegExp(r'\r?\n')).first.trim();
    if (first.length <= 120) return first;
    return '${first.substring(0, 117)}...';
  }

  // ── Intake submit dispatcher ───────────────────────────────────────────────

  void _onIntakeComplete(IssueCheckerWizardData data) {
    final isAuthenticated =
        ref.read(authControllerProvider).session != null;

    if (isAuthenticated) {
      // Classify first (non-fatal) then go to details step.
      _classifyAndAdvance(data);
    } else {
      // Anonymous path → teaser flow.
      _runAnonFlow(data);
    }
  }

  Future<void> _classifyAndAdvance(IssueCheckerWizardData data) async {
    setState(() {
      _data = data;
      _loading = true;
      _error = null;
    });

    try {
      final deviceFp = await getDeviceId();
      final classified =
          await ref.read(consumersApiProvider).classifyIssueChecker(
                countryCode: data.countryCode,
                facts: data.facts,
                deviceFingerprint: deviceFp,
              );
      if (!mounted) return;

      final updated = data.copyWith(
        issueType: classified.issueType,
        title: classified.suggestedTitle,
        urgencyLevel: classified.urgencyLevel,
        parties: classified.parties ?? '',
      );

      setState(() {
        _data = updated;
        _loading = false;
      });

      _runAuthFlow(updated);
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      _runAuthFlow(data);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isAuthenticated =
        ref.watch(authControllerProvider).session != null;
    final showProgress = isAuthenticated && _teaser == null && _preview == null;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.previewMode
              ? l10n.issueCheckerFreeLegalPreview
              : l10n.issueCheckerTitle,
        ),
        actions: isAuthenticated
            ? const [
                Padding(
                  padding: EdgeInsets.only(right: 12),
                  child: Center(child: CreditUsageMeter(compact: true)),
                ),
              ]
            : null,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(widget.previewMode ? '/welcome' : '/consumer');
            }
          },
        ),
      ),
      body: Column(
        children: [
          // Progress bar for authenticated 4-step wizard
          if (showProgress && _step < issueCheckerStepCount)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: WizardProgress(
                currentStep: _step,
                totalSteps: issueCheckerStepCount,
              ),
            ),
          Expanded(
            child: _buildBody(l10n, isAuthenticated),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AppLocalizations l10n, bool isAuthenticated) {
    // Loading overlay
    if (_loading && _teaser == null && _preview == null) {
      return const IntakeAnalysisProgress();
    }

    // Teaser result (anonymous)
    if (_teaser != null && _preview == null) {
      return TeaserPreview(
        teaser: _teaser!,
        refinementQuestions: _refinementQuestions,
        refinementQuestionsLoading: _refinementQuestionsLoading,
        isRefining: _isRefining,
        onRefine: (answers) {
          final merged = Map<String, dynamic>.from(_data.planningAnswers ?? {})
            ..addAll(answers);
          setState(() => _data = _data.copyWith(planningAnswers: merged));
          _runFullPreview(_anonymousSessionId, merged);
        },
        onSignInSuccess: () =>
            context.go('/consumer/issue-checker?upgrade=1'),
      );
    }

    // Full preview result
    if (_preview != null) {
      return FullPreview(preview: _preview!);
    }

    // 4-step wizard pages
    return PageView(
      controller: _pageController,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        // Step 0: Intake
        SingleChildScrollView(
          child: IntakeMicroFlow(
            initialData: _data.facts.isNotEmpty ? _data : null,
            onComplete: _onIntakeComplete,
          ),
        ),

        // Step 1: Details (authenticated only)
        SingleChildScrollView(
          child: DetailsStep(
            data: _data,
            outcomeOptions: _outcomeOptions,
            loadingOutcomes: _outcomeOptionsLoading,
            onBack: () => _goToStep(_kStepIntake),
            onComplete: (updated) {
              setState(() => _data = updated);
              _saveSession();
              _goToStep(_kStepDocuments);
            },
          ),
        ),

        // Step 2: Documents
        SingleChildScrollView(
          child: DocumentsStep(
            data: _data,
            isAuthenticated: isAuthenticated,
            initialCaseId: _consumerCaseId,
            onBack: () => _goToStep(_kStepDetails),
            onRequireSignUp: () async {
              await _saveSession();
              if (mounted) {
                context.push(
                  '/auth/sign-up?redirect=/consumer/issue-checker?attach=1',
                );
              }
            },
            onComplete: (caseId) {
              setState(() => _consumerCaseId = caseId);
              _saveSession();
              _goToStep(_kStepPreview);
            },
          ),
        ),

        // Step 3: Review / generate preview
        _ReviewStep(
          data: _data,
          isLoading: _loading,
          error: _error,
          isCreditError: _isCreditError,
          onBack: () => _goToStep(_kStepDocuments),
          onGenerate: () => _runFullPreview(_anonymousSessionId),
        ),
      ],
    );
  }
}

// ── Review / generate step ─────────────────────────────────────────────────

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.data,
    required this.isLoading,
    required this.error,
    required this.isCreditError,
    required this.onBack,
    required this.onGenerate,
  });

  final IssueCheckerWizardData data;
  final bool isLoading;
  final String? error;
  final bool isCreditError;
  final VoidCallback onBack;
  final VoidCallback onGenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    if (isLoading) return const IntakeAnalysisProgress();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.issueCheckerStepsReady,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),

          _SummaryRow(
            label: l10n.issueCheckerStepCountry,
            value: data.countryCode,
          ),
          if (data.issueType.isNotEmpty)
            _SummaryRow(
              label: l10n.issueCheckerStepIssueType,
              value: data.issueType,
            ),
          if (data.facts.isNotEmpty)
            _SummaryRow(
              label: l10n.issueCheckerFacts,
              value: data.facts.length > 120
                  ? '${data.facts.substring(0, 120)}…'
                  : data.facts,
            ),
          if (data.desiredOutcome.isNotEmpty)
            _SummaryRow(
              label: l10n.issueCheckerDesiredOutcomeOptional,
              value: data.desiredOutcome,
            ),

          const SizedBox(height: 20),

          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                error!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
                textAlign: TextAlign.center,
              ),
            ),

          Text(
            l10n.issueCheckerPreviewUsesCredit,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),

          FilledButton.icon(
            onPressed: onGenerate,
            icon: const Icon(Icons.auto_awesome),
            label: Text(l10n.issueCheckerReviewAndGenerate),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: onBack,
            child: Text(l10n.commonBack),
          ),
          const SizedBox(height: 16),
          const LegalDisclaimer(compact: true),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: theme.textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}
