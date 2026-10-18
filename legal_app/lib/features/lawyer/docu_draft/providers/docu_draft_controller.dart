import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/drafting/action_context_prompts.dart';
import '../../../../core/drafting/draft_navigation.dart';
import '../../../../core/geo/detect_country.dart';
import '../../../../core/models/draft_intent.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/ai_api.dart';
import '../../../../core/providers/app_providers.dart';

enum DocuDraftStep { input, contextReview, results }

class DocuDraftState {
  const DocuDraftState({
    this.step = DocuDraftStep.input,
    this.query = '',
    this.countryCode = 'IN',
    this.analyzing = false,
    this.loading = false,
    this.error,
    this.analysisResult,
    this.answers = const {},
    this.actionNotes = const {},
    this.resolveResult,
    this.selectedBundleKinds = const {},
  });

  DocuDraftState copyWith({
    DocuDraftStep? step,
    String? query,
    String? countryCode,
    bool? analyzing,
    bool? loading,
    String? error,
    DraftAnalyzeResult? analysisResult,
    Map<String, String>? answers,
    Map<String, String>? actionNotes,
    DraftIntentResolveResult? resolveResult,
    Set<String>? selectedBundleKinds,
    bool clearError = false,
  }) {
    return DocuDraftState(
      step: step ?? this.step,
      query: query ?? this.query,
      countryCode: countryCode ?? this.countryCode,
      analyzing: analyzing ?? this.analyzing,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      analysisResult: analysisResult ?? this.analysisResult,
      answers: answers ?? this.answers,
      actionNotes: actionNotes ?? this.actionNotes,
      resolveResult: resolveResult ?? this.resolveResult,
      selectedBundleKinds: selectedBundleKinds ?? this.selectedBundleKinds,
    );
  }

  String get supplementalContext => buildSupplementalFromActionNotes(actionNotes);

  final DocuDraftStep step;
  final String query;
  final String countryCode;
  final bool analyzing;
  final bool loading;
  final String? error;
  final DraftAnalyzeResult? analysisResult;
  final Map<String, String> answers;
  final Map<String, String> actionNotes;
  final DraftIntentResolveResult? resolveResult;
  final Set<String> selectedBundleKinds;
}

class DocuDraftController extends StateNotifier<DocuDraftState> {
  DocuDraftController(this._ref) : super(const DocuDraftState());

  final Ref _ref;

  AiApi get _ai => _ref.read(aiApiProvider);

  String? get _tenantId => _ref.read(authControllerProvider).session?.user.tenantId;

  Future<void> initCountry() async {
    final code = await detectSupportedCountryFromRef(_ref);
    state = state.copyWith(countryCode: code);
  }

  void setQuery(String value) => state = state.copyWith(query: value, clearError: true);

  void setCountry(String code) {
    state = state.copyWith(countryCode: code);
    persistLegalFormsCountryFilter(code);
  }

  void setAnswer(String questionId, String value) {
    state = state.copyWith(answers: {...state.answers, questionId: value});
  }

  void setActionNote(String action, String value) {
    state = state.copyWith(actionNotes: {...state.actionNotes, action: value});
  }

  void resetToInput() {
    state = DocuDraftState(countryCode: state.countryCode, query: state.query);
  }

  Future<void> analyze({bool refine = false}) async {
    final trimmed = state.query.trim();
    if (trimmed.length < 3 || _tenantId == null) return;

    state = state.copyWith(analyzing: true, clearError: true);
    try {
      final result = await _ai.analyzeDraftIntent(
        query: trimmed,
        supplementalContext: refine ? state.supplementalContext : null,
        tenantId: _tenantId,
      );

      final preserved = <String, String>{};
      for (final q in result.questions) {
        final prev = state.answers[q.id];
        if (prev != null) preserved[q.id] = prev;
      }

      if (result.questions.isEmpty) {
        state = state.copyWith(
          analyzing: false,
          analysisResult: result,
          answers: preserved,
        );
        await resolve();
        return;
      }

      state = state.copyWith(
        analyzing: false,
        analysisResult: result,
        answers: preserved,
        step: DocuDraftStep.contextReview,
      );
    } on ApiException catch (e) {
      state = state.copyWith(analyzing: false, error: e.message);
      await resolve();
    } catch (_) {
      state = state.copyWith(analyzing: false);
      await resolve();
    }
  }

  Future<void> refineAnalysis() async {
    if (state.supplementalContext.trim().isEmpty) return;
    state = state.copyWith(analyzing: true, clearError: true);
    try {
      final result = await _ai.analyzeDraftIntent(
        query: state.query.trim(),
        supplementalContext: state.supplementalContext,
        tenantId: _tenantId,
      );
      final preserved = <String, String>{};
      for (final q in result.questions) {
        final prev = state.answers[q.id];
        if (prev != null) preserved[q.id] = prev;
      }
      state = state.copyWith(
        analyzing: false,
        analysisResult: result,
        answers: preserved,
        step: result.questions.isEmpty ? DocuDraftStep.results : DocuDraftStep.contextReview,
      );
      if (result.questions.isEmpty) await resolve();
    } on ApiException catch (e) {
      state = state.copyWith(analyzing: false, error: e.message);
    } catch (_) {
      state = state.copyWith(analyzing: false, error: 'Analysis failed. Please try again.');
    }
  }

  Future<void> resolve() async {
    final trimmed = state.query.trim();
    if (trimmed.isEmpty || _tenantId == null) return;

    state = state.copyWith(loading: true, clearError: true);
    try {
      final ctx = state.analysisResult?.context;
      final result = await _ai.resolveDraftIntent(
        query: trimmed,
        countryCode: state.countryCode == 'ALL' ? null : state.countryCode,
        jurisdiction: ctx?.jurisdiction,
        answers: state.answers.isNotEmpty ? state.answers : null,
        context: ctx,
        supplementalContext:
            state.supplementalContext.isNotEmpty ? state.supplementalContext : null,
        tenantId: _tenantId,
      );

      final bundleKinds = result.documentBundle
              ?.where((b) => b.selectedByDefault)
              .map((b) => b.kind)
              .toSet() ??
          {};

      state = state.copyWith(
        loading: false,
        resolveResult: result,
        selectedBundleKinds: bundleKinds,
        step: DocuDraftStep.results,
      );
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    } catch (_) {
      state = state.copyWith(
        loading: false,
        error: 'Search failed. Please try again.',
      );
    }
  }

  void toggleBundleKind(String kind, bool selected) {
    final next = Set<String>.from(state.selectedBundleKinds);
    if (selected) {
      next.add(kind);
    } else {
      next.remove(kind);
    }
    state = state.copyWith(selectedBundleKinds: next);
  }

  List<DraftSetInitItem> selectedBundleItems() {
    final result = state.resolveResult;
    if (result == null) return [];
    return result.matches
        .whereType<DraftIntentCuratedDraftMatch>()
        .where((m) => m.bundleRecommended && state.selectedBundleKinds.contains(m.kind))
        .map(
          (m) => DraftSetInitItem(
            draftUrl: m.draftUrl,
            label: m.label,
            kind: m.kind,
          ),
        )
        .toList();
  }
}

final docuDraftControllerProvider =
    StateNotifierProvider.autoDispose<DocuDraftController, DocuDraftState>(
  DocuDraftController.new,
);
