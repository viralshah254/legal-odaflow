class PromptRefinementHints {
  const PromptRefinementHints({
    this.jurisdiction,
    this.documentKind,
    this.parties = const [],
    this.statutes = const [],
  });

  factory PromptRefinementHints.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PromptRefinementHints();
    return PromptRefinementHints(
      jurisdiction: json['jurisdiction'] as String?,
      documentKind: json['documentKind'] as String?,
      parties: (json['parties'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .where((e) => e.isNotEmpty)
              .toList() ??
          const [],
      statutes: (json['statutes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .where((e) => e.isNotEmpty)
              .toList() ??
          const [],
    );
  }

  final String? jurisdiction;
  final String? documentKind;
  final List<String> parties;
  final List<String> statutes;
}

class RefinePromptResult {
  const RefinePromptResult({
    required this.originalPrompt,
    required this.refinedPrompt,
    required this.skipped,
    this.skipReason,
    this.hints,
  });

  factory RefinePromptResult.fromJson(Map<String, dynamic> json) {
    return RefinePromptResult(
      originalPrompt: json['originalPrompt'] as String? ?? '',
      refinedPrompt: json['refinedPrompt'] as String? ?? '',
      skipped: json['skipped'] as bool? ?? true,
      skipReason: json['skipReason'] as String?,
      hints: PromptRefinementHints.fromJson(
        json['hints'] as Map<String, dynamic>?,
      ),
    );
  }

  final String originalPrompt;
  final String refinedPrompt;
  final bool skipped;
  final String? skipReason;
  final PromptRefinementHints? hints;
}
