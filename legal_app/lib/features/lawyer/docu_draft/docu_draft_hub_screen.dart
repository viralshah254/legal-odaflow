import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/drafting/draft_navigation.dart';
import '../../../core/drafting/prompt_refinement_flow.dart';
import '../../../core/geo/detect_country.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/ai_tools/ai_tool_widgets.dart';
import 'providers/docu_draft_controller.dart';
import 'widgets/country_picker_sheet.dart';
import 'widgets/draft_intent_steps.dart';
import 'widgets/format_catalog_sheet.dart';
import 'widgets/form_search_section.dart';

const _accentColor = Color(0xFF7C3AED);

class DocuDraftHubScreen extends ConsumerStatefulWidget {
  const DocuDraftHubScreen({
    super.key,
    this.prefillQuery,
    this.prefillKind,
  });

  final String? prefillQuery;
  final String? prefillKind;

  @override
  ConsumerState<DocuDraftHubScreen> createState() => _DocuDraftHubScreenState();
}

class _DocuDraftHubScreenState extends ConsumerState<DocuDraftHubScreen> {
  late final TextEditingController _queryController;
  final _intentFocusNode = FocusNode();
  final _scrollController = ScrollController();
  final _intentFieldKey = GlobalKey();
  bool _heroExpanded = true;
  bool _refiningPrompt = false;
  Timer? _heroTimer;

  @override
  void initState() {
    super.initState();
    _queryController = TextEditingController(text: widget.prefillQuery ?? '');
    _intentFocusNode.addListener(_onIntentFocus);
    _heroTimer = Timer(const Duration(seconds: 4), _collapseHero);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(docuDraftControllerProvider.notifier).initCountry();
      if (widget.prefillQuery != null) {
        ref.read(docuDraftControllerProvider.notifier).setQuery(widget.prefillQuery!);
      }
      if (widget.prefillKind != null && widget.prefillKind!.isNotEmpty) {
        _openWorkspace(
          DocuDraftRouteParams(
            kind: widget.prefillKind,
            countryCode: ref.read(docuDraftControllerProvider).countryCode,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _heroTimer?.cancel();
    _intentFocusNode.removeListener(_onIntentFocus);
    _intentFocusNode.dispose();
    _scrollController.dispose();
    _queryController.dispose();
    super.dispose();
  }

  void _collapseHero() {
    if (mounted && _heroExpanded) setState(() => _heroExpanded = false);
  }

  void _onIntentFocus() {
    if (!_intentFocusNode.hasFocus) return;
    _collapseHero();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final context = _intentFieldKey.currentContext;
      if (context == null || !mounted) return;
      Scrollable.ensureVisible(
        context,
        alignment: 0.2,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  void _openWorkspace(DocuDraftRouteParams params) {
    context.push(buildDocuDraftWorkspacePath(params));
  }

  void _showCatalog() {
    final country = ref.read(docuDraftControllerProvider).countryCode;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FormatCatalogSheet(
        countryCode: country,
        onSelectKind: _openWorkspace,
      ),
    );
  }

  void _showCountryPicker() {
    final state = ref.read(docuDraftControllerProvider);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CountryPickerSheet(
        selectedCode: state.countryCode,
        onSelected: ref.read(docuDraftControllerProvider.notifier).setCountry,
      ),
    );
  }

  int _stepIndex(DocuDraftStep step) {
    switch (step) {
      case DocuDraftStep.input:
        return 0;
      case DocuDraftStep.contextReview:
        return 1;
      case DocuDraftStep.results:
        return 2;
    }
  }

  Future<void> _handleFindAndDraft() async {
    final query = _queryController.text.trim();
    if (query.length < 3 || _refiningPrompt) return;

    final draftState = ref.read(docuDraftControllerProvider);
    if (draftState.analyzing || draftState.loading) return;

    setState(() => _refiningPrompt = true);
    try {
      final tenantId = ref.read(authControllerProvider).session?.user.tenantId;
      final accepted = await runPromptRefinementFlow(
        context: context,
        ai: ref.read(aiApiProvider),
        prompt: query,
        purpose: 'drafting',
        tenantId: tenantId,
        countryCode: draftState.countryCode,
      );
      if (accepted == null || !mounted) return;
      _queryController.text = accepted;
      ref.read(docuDraftControllerProvider.notifier).setQuery(accepted);
      await ref.read(docuDraftControllerProvider.notifier).analyze();
    } finally {
      if (mounted) setState(() => _refiningPrompt = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(docuDraftControllerProvider);
    final controller = ref.read(docuDraftControllerProvider.notifier);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isInputStep = state.step == DocuDraftStep.input;
    final viewInsets = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
          title: Text(l10n.docuDraftTitle),
          backgroundColor: isDark ? AppColors.logoBlue : Colors.white,
          elevation: 0,
          leading: !isInputStep
              ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: controller.resetToInput,
                )
              : null,
          actions: [
            if (isInputStep)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ActionChip(
                  avatar: Text(countryFlagEmoji(state.countryCode)),
                  label: Text('${countryDisplayName(state.countryCode)} ▾'),
                  onPressed: _showCountryPicker,
                ),
              ),
            if (isInputStep && !_heroExpanded)
              IconButton(
                icon: const Icon(Icons.info_outline),
                tooltip: 'About Docu Draft',
                onPressed: () => setState(() => _heroExpanded = true),
              ),
          ],
        ),
        body: CustomScrollView(
          controller: _scrollController,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          slivers: [
            if (isInputStep)
              SliverToBoxAdapter(
                child: AnimatedSize(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeInOut,
                  child: _heroExpanded
                      ? AiToolFeatureHeader(
                          icon: Icons.edit_document,
                          title: l10n.docuDraftTitle,
                          subtitle: l10n.docuDraftSubtitle,
                          accentColor: _accentColor,
                        )
                      : const SizedBox.shrink(),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, isInputStep ? 8 : 16, 16, 8),
                child: DraftStepIndicator(
                  currentStep: _stepIndex(state.step),
                  steps: [
                    l10n.docuDraftStepDescribe,
                    l10n.docuDraftStepUnderstand,
                    l10n.docuDraftStepMatch,
                  ],
                  accentColor: _accentColor,
                  compact: isInputStep && !_heroExpanded,
                ),
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, viewInsets + 16),
              sliver: SliverToBoxAdapter(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  child: switch (state.step) {
                    DocuDraftStep.input => Column(
                        key: const ValueKey('input'),
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          DraftIntentInputStep(
                            fieldKey: _intentFieldKey,
                            queryController: _queryController,
                            intentFocusNode: _intentFocusNode,
                            heroCollapsed: !_heroExpanded,
                          ),
                          const SizedBox(height: 16),
                          FormSearchSection(
                            countryCode: state.countryCode,
                            onSearchFocus: _collapseHero,
                            onCuratedTap: (hit) => openCuratedFormat(context, hit, _openWorkspace),
                            onFormTap: (form) {
                              _queryController.text =
                                  '${form.formName} ${form.description ?? ''}'.trim();
                              controller.setQuery(_queryController.text);
                            },
                          ),
                        ],
                      ),
                    DocuDraftStep.contextReview => DraftContextReviewStep(
                        key: const ValueKey('review'),
                      ),
                    DocuDraftStep.results => DraftResultsStep(
                        key: const ValueKey('results'),
                        onOpenWorkspace: _openWorkspace,
                      ),
                  },
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: isInputStep
            ? SafeArea(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, viewInsets > 0 ? 8 : 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: _accentColor,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          onPressed: state.analyzing ||
                                  state.loading ||
                                  _refiningPrompt ||
                                  _queryController.text.trim().length < 3
                              ? null
                              : _handleFindAndDraft,
                          icon: state.analyzing || state.loading || _refiningPrompt
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.auto_awesome),
                          label: Text(l10n.docuDraftFindAndDraft),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: _showCatalog,
                        child: Text(l10n.docuDraftBrowseFormats),
                      ),
                    ],
                  ),
                ),
              )
            : null,
    );
  }
}
