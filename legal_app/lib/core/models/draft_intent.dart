import '../models/matter_intelligence.dart';

class ClarifyingQuestionOption {
  const ClarifyingQuestionOption({
    required this.value,
    required this.label,
    this.hint,
    this.routesTo,
  });

  factory ClarifyingQuestionOption.fromJson(Map<String, dynamic> json) {
    return ClarifyingQuestionOption(
      value: json['value'] as String? ?? '',
      label: json['label'] as String? ?? '',
      hint: json['hint'] as String?,
      routesTo: json['routes_to'] as String?,
    );
  }

  final String value;
  final String label;
  final String? hint;
  final String? routesTo;
}

class ClarifyingQuestion {
  const ClarifyingQuestion({
    required this.id,
    required this.prompt,
    required this.options,
  });

  factory ClarifyingQuestion.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'] as List<dynamic>? ?? [];
    return ClarifyingQuestion(
      id: json['id'] as String? ?? '',
      prompt: json['prompt'] as String? ?? '',
      options: rawOptions
          .whereType<Map<String, dynamic>>()
          .map(ClarifyingQuestionOption.fromJson)
          .toList(),
    );
  }

  final String id;
  final String prompt;
  final List<ClarifyingQuestionOption> options;
}

class DraftContext {
  const DraftContext({
    this.jurisdiction,
    this.statute,
    this.court,
    this.orderType,
    this.documentIntent,
    this.statuteConfidence = 'none',
  });

  factory DraftContext.fromJson(Map<String, dynamic> json) {
    return DraftContext(
      jurisdiction: json['jurisdiction'] as String?,
      statute: json['statute'] as String?,
      court: json['court'] as String?,
      orderType: json['orderType'] as String?,
      documentIntent: json['documentIntent'] as String?,
      statuteConfidence: json['statuteConfidence'] as String? ?? 'none',
    );
  }

  Map<String, dynamic> toJson() => {
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
        if (statute != null) 'statute': statute,
        if (court != null) 'court': court,
        if (orderType != null) 'orderType': orderType,
        if (documentIntent != null) 'documentIntent': documentIntent,
        'statuteConfidence': statuteConfidence,
      };

  final String? jurisdiction;
  final String? statute;
  final String? court;
  final String? orderType;
  final String? documentIntent;
  final String statuteConfidence;
}

class ExtractedMatterFacts {
  const ExtractedMatterFacts({
    this.parties = const {},
    this.proceedingType,
    this.posture,
    this.orderType,
    this.orderAmount,
    this.hasDvCase = false,
    this.hasMaintenanceContext = false,
    this.hasInterimOrder = false,
    this.hasMarriageValidityChallenge = false,
    this.hasEarningCapacityDefence = false,
    this.hasDowryDenial = false,
    this.summaryLines = const [],
  });

  factory ExtractedMatterFacts.fromJson(Map<String, dynamic> json) {
    final partiesRaw = json['parties'] as Map<String, dynamic>? ?? {};
    return ExtractedMatterFacts(
      parties: partiesRaw.map((k, v) => MapEntry(k, v?.toString() ?? '')),
      proceedingType: json['proceedingType'] as String?,
      posture: json['posture'] as String?,
      orderType: json['orderType'] as String?,
      orderAmount: json['orderAmount'] as String?,
      hasDvCase: json['hasDvCase'] as bool? ?? false,
      hasMaintenanceContext: json['hasMaintenanceContext'] as bool? ?? false,
      hasInterimOrder: json['hasInterimOrder'] as bool? ?? false,
      hasMarriageValidityChallenge:
          json['hasMarriageValidityChallenge'] as bool? ?? false,
      hasEarningCapacityDefence:
          json['hasEarningCapacityDefence'] as bool? ?? false,
      hasDowryDenial: json['hasDowryDenial'] as bool? ?? false,
      summaryLines: (json['summaryLines'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
    );
  }

  final Map<String, String> parties;
  final String? proceedingType;
  final String? posture;
  final String? orderType;
  final String? orderAmount;
  final bool hasDvCase;
  final bool hasMaintenanceContext;
  final bool hasInterimOrder;
  final bool hasMarriageValidityChallenge;
  final bool hasEarningCapacityDefence;
  final bool hasDowryDenial;
  final List<String> summaryLines;
}

class DraftAnalyzeResult {
  const DraftAnalyzeResult({
    required this.context,
    required this.questions,
    this.extractedFacts,
    this.matterProfile,
    this.matterGraph,
    this.taskGraph,
    this.recommendedActions,
    this.issues,
    this.recommendationMode,
    this.nextBestAction,
  });

  factory DraftAnalyzeResult.fromJson(Map<String, dynamic> json) {
    return DraftAnalyzeResult(
      context: DraftContext.fromJson(
        json['context'] as Map<String, dynamic>? ?? {},
      ),
      questions: (json['questions'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ClarifyingQuestion.fromJson)
          .toList(),
      extractedFacts: json['extractedFacts'] is Map<String, dynamic>
          ? ExtractedMatterFacts.fromJson(
              json['extractedFacts'] as Map<String, dynamic>,
            )
          : null,
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      taskGraph: json['taskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(json['taskGraph'] as Map<String, dynamic>)
          : null,
      recommendedActions: (json['recommendedActions'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      issues:
          (json['issues'] as List<dynamic>?)?.map((e) => e.toString()).toList(),
      recommendationMode: json['recommendationMode'] as String?,
      nextBestAction: json['nextBestAction'] as String?,
    );
  }

  final DraftContext context;
  final List<ClarifyingQuestion> questions;
  final ExtractedMatterFacts? extractedFacts;
  final MatterProfile? matterProfile;
  final MatterGraph? matterGraph;
  final MatterTaskGraph? taskGraph;
  final List<String>? recommendedActions;
  final List<String>? issues;
  final String? recommendationMode;
  final String? nextBestAction;
}

class MiClarifyingQuestion {
  const MiClarifyingQuestion({
    required this.id,
    required this.text,
    required this.options,
  });

  factory MiClarifyingQuestion.fromJson(Map<String, dynamic> json) {
    return MiClarifyingQuestion(
      id: json['id'] as String? ?? '',
      text: json['text'] as String? ?? '',
      options: (json['options'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
    );
  }

  final String id;
  final String text;
  final List<String> options;
}

class DraftIntentBundleItem {
  const DraftIntentBundleItem({
    required this.kind,
    required this.label,
    required this.documentKind,
    required this.order,
    required this.selectedByDefault,
  });

  factory DraftIntentBundleItem.fromJson(Map<String, dynamic> json) {
    return DraftIntentBundleItem(
      kind: json['kind'] as String? ?? '',
      label: json['label'] as String? ?? '',
      documentKind: json['documentKind'] as String? ?? '',
      order: (json['order'] as num?)?.toInt() ?? 0,
      selectedByDefault: json['selectedByDefault'] as bool? ?? true,
    );
  }

  final String kind;
  final String label;
  final String documentKind;
  final int order;
  final bool selectedByDefault;
}

abstract class DraftIntentMatch {
  const DraftIntentMatch({
    required this.type,
    required this.confidence,
    required this.summary,
  });

  factory DraftIntentMatch.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String? ?? 'generate';
    switch (type) {
      case 'official_form':
        return DraftIntentOfficialFormMatch.fromJson(json);
      case 'curated_draft':
        return DraftIntentCuratedDraftMatch.fromJson(json);
      case 'template':
        return DraftIntentTemplateMatch.fromJson(json);
      case 'import_edit':
        return DraftIntentImportEditMatch.fromJson(json);
      default:
        return DraftIntentGenerateMatch.fromJson(json);
    }
  }

  final String type;
  final double confidence;
  final String summary;
}

class DraftIntentOfficialFormMatch extends DraftIntentMatch {
  DraftIntentOfficialFormMatch({
    required super.confidence,
    required super.summary,
    required this.formId,
    required this.formName,
    this.formNumber,
    required this.countryCode,
    required this.authority,
    required this.draftUrl,
  }) : super(type: 'official_form');

  factory DraftIntentOfficialFormMatch.fromJson(Map<String, dynamic> json) {
    return DraftIntentOfficialFormMatch(
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      summary: json['summary'] as String? ?? '',
      formId: json['formId'] as String? ?? '',
      formName: json['formName'] as String? ?? '',
      formNumber: json['formNumber'] as String?,
      countryCode: json['countryCode'] as String? ?? '',
      authority: json['authority'] as String? ?? '',
      draftUrl: json['draftUrl'] as String? ?? '',
    );
  }

  final String formId;
  final String formName;
  final String? formNumber;
  final String countryCode;
  final String authority;
  final String draftUrl;
}

class DraftIntentCuratedDraftMatch extends DraftIntentMatch {
  DraftIntentCuratedDraftMatch({
    required super.confidence,
    required super.summary,
    required this.kind,
    required this.label,
    required this.countryCode,
    required this.draftUrl,
    this.proceduralNote,
    this.bundleRecommended = false,
    this.bundleOrder,
  }) : super(type: 'curated_draft');

  factory DraftIntentCuratedDraftMatch.fromJson(Map<String, dynamic> json) {
    return DraftIntentCuratedDraftMatch(
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      summary: json['summary'] as String? ?? '',
      kind: json['kind'] as String? ?? '',
      label: json['label'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '',
      draftUrl: json['draftUrl'] as String? ?? '',
      proceduralNote: json['proceduralNote'] as String?,
      bundleRecommended: json['bundleRecommended'] as bool? ?? false,
      bundleOrder: (json['bundleOrder'] as num?)?.toInt(),
    );
  }

  final String kind;
  final String label;
  final String countryCode;
  final String draftUrl;
  final String? proceduralNote;
  final bool bundleRecommended;
  final int? bundleOrder;
}

class DraftIntentTemplateMatch extends DraftIntentMatch {
  DraftIntentTemplateMatch({
    required super.confidence,
    required super.summary,
    required this.templateId,
    required this.name,
    required this.source,
    this.documentKind,
    this.countryCode,
    required this.editUrl,
    required this.useUrl,
  }) : super(type: 'template');

  factory DraftIntentTemplateMatch.fromJson(Map<String, dynamic> json) {
    return DraftIntentTemplateMatch(
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      summary: json['summary'] as String? ?? '',
      templateId: json['templateId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      source: json['source'] as String? ?? 'system',
      documentKind: json['documentKind'] as String?,
      countryCode: json['countryCode'] as String?,
      editUrl: json['editUrl'] as String? ?? '',
      useUrl: json['useUrl'] as String? ?? '',
    );
  }

  final String templateId;
  final String name;
  final String source;
  final String? documentKind;
  final String? countryCode;
  final String editUrl;
  final String useUrl;
}

class DraftIntentGenerateMatch extends DraftIntentMatch {
  DraftIntentGenerateMatch({
    required super.confidence,
    required super.summary,
    required this.suggestedKind,
    required this.countryCode,
    this.documentKind,
    required this.reason,
    required this.draftUrl,
  }) : super(type: 'generate');

  factory DraftIntentGenerateMatch.fromJson(Map<String, dynamic> json) {
    return DraftIntentGenerateMatch(
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      summary: json['summary'] as String? ?? '',
      suggestedKind: json['suggestedKind'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '',
      documentKind: json['documentKind'] as String?,
      reason: json['reason'] as String? ?? '',
      draftUrl: json['draftUrl'] as String? ?? '',
    );
  }

  final String suggestedKind;
  final String countryCode;
  final String? documentKind;
  final String reason;
  final String draftUrl;
}

class DraftIntentImportEditMatch extends DraftIntentMatch {
  DraftIntentImportEditMatch({
    required super.confidence,
    required super.summary,
    required this.documentKind,
    required this.draftUrl,
  }) : super(type: 'import_edit');

  factory DraftIntentImportEditMatch.fromJson(Map<String, dynamic> json) {
    return DraftIntentImportEditMatch(
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      summary: json['summary'] as String? ?? '',
      documentKind: json['documentKind'] as String? ?? '',
      draftUrl: json['draftUrl'] as String? ?? '',
    );
  }

  final String documentKind;
  final String draftUrl;
}

class DraftIntentResolveResult {
  const DraftIntentResolveResult({
    required this.query,
    required this.classification,
    required this.matches,
    this.creditsUsed,
    this.balanceRemaining,
    this.matterProfile,
    this.matterGraph,
    this.taskGraph,
    this.recommendedActions,
    this.issues,
    this.clarifyingQuestions,
    this.recommendationMode,
    this.nextBestAction,
    this.outcomeHint,
    this.documentBundle,
  });

  factory DraftIntentResolveResult.fromJson(Map<String, dynamic> json) {
    final classRaw = json['classification'] as Map<String, dynamic>? ?? {};
    return DraftIntentResolveResult(
      query: json['query'] as String? ?? '',
      classification: classRaw,
      matches: (json['matches'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(DraftIntentMatch.fromJson)
          .toList(),
      creditsUsed: (json['creditsUsed'] as num?)?.toInt(),
      balanceRemaining: (json['balanceRemaining'] as num?)?.toInt(),
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      taskGraph: json['taskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(json['taskGraph'] as Map<String, dynamic>)
          : null,
      recommendedActions: (json['recommendedActions'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      issues:
          (json['issues'] as List<dynamic>?)?.map((e) => e.toString()).toList(),
      clarifyingQuestions: (json['clarifyingQuestions'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(MiClarifyingQuestion.fromJson)
          .toList(),
      recommendationMode: json['recommendationMode'] as String?,
      nextBestAction: json['nextBestAction'] as String?,
      outcomeHint: json['outcomeHint'] as String?,
      documentBundle: (json['documentBundle'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(DraftIntentBundleItem.fromJson)
          .toList(),
    );
  }

  final String query;
  final Map<String, dynamic> classification;
  final List<DraftIntentMatch> matches;
  final int? creditsUsed;
  final int? balanceRemaining;
  final MatterProfile? matterProfile;
  final MatterGraph? matterGraph;
  final MatterTaskGraph? taskGraph;
  final List<String>? recommendedActions;
  final List<String>? issues;
  final List<MiClarifyingQuestion>? clarifyingQuestions;
  final String? recommendationMode;
  final String? nextBestAction;
  final String? outcomeHint;
  final List<DraftIntentBundleItem>? documentBundle;
}

class JurisdictionForm {
  const JurisdictionForm({
    required this.id,
    required this.countryCode,
    this.jurisdiction,
    required this.practiceArea,
    required this.formName,
    this.formNumber,
    required this.authority,
    required this.sourceUrl,
    this.description,
    this.category,
  });

  factory JurisdictionForm.fromJson(Map<String, dynamic> json) {
    return JurisdictionForm(
      id: json['id'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '',
      jurisdiction: json['jurisdiction'] as String?,
      practiceArea: json['practiceArea'] as String? ?? '',
      formName: json['formName'] as String? ?? '',
      formNumber: json['formNumber'] as String?,
      authority: json['authority'] as String? ?? '',
      sourceUrl: json['sourceUrl'] as String? ?? '',
      description: json['description'] as String?,
      category: json['category'] as String?,
    );
  }

  final String id;
  final String countryCode;
  final String? jurisdiction;
  final String practiceArea;
  final String formName;
  final String? formNumber;
  final String authority;
  final String sourceUrl;
  final String? description;
  final String? category;
}

class PaginatedLegalForms {
  const PaginatedLegalForms({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.pages,
  });

  factory PaginatedLegalForms.fromJson(Map<String, dynamic> json) {
    return PaginatedLegalForms(
      items: (json['items'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(JurisdictionForm.fromJson)
          .toList(),
      total: (json['total'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 48,
      pages: (json['pages'] as num?)?.toInt() ?? 1,
    );
  }

  final List<JurisdictionForm> items;
  final int total;
  final int page;
  final int limit;
  final int pages;
}

class DraftHistoryItem {
  const DraftHistoryItem({
    required this.id,
    required this.title,
    required this.preview,
    required this.kind,
    required this.countryCode,
    required this.source,
    required this.creditsUsed,
    required this.createdAt,
    this.label,
    this.category,
  });

  factory DraftHistoryItem.fromJson(Map<String, dynamic> json) {
    return DraftHistoryItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      preview: json['preview'] as String? ?? '',
      kind: json['kind'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? 'IN',
      source: json['source'] as String? ?? '',
      creditsUsed: (json['creditsUsed'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
      label: json['label'] as String?,
      category: json['category'] as String?,
    );
  }

  final String id;
  final String title;
  final String preview;
  final String kind;
  final String countryCode;
  final String source;
  final int creditsUsed;
  final String createdAt;
  final String? label;
  final String? category;
}

class ProceduralDetermination {
  const ProceduralDetermination({
    this.recommendedKind,
    this.kindOverridden = false,
    this.explanation,
  });

  factory ProceduralDetermination.fromJson(Map<String, dynamic> json) {
    return ProceduralDetermination(
      recommendedKind: json['recommendedKind'] as String?,
      kindOverridden: json['kindOverridden'] as bool? ?? false,
      explanation: json['explanation'] as String?,
    );
  }

  final String? recommendedKind;
  final bool kindOverridden;
  final String? explanation;
}
