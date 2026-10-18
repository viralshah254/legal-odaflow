import 'draft_intent.dart';
import 'draft_verification.dart';
import 'verification.dart';

export 'draft_verification.dart' show PinnedSection, PinnedCaseLaw, DraftAccuracyGate, DraftVerificationAudit;

/// Expanded India draft types — mirrors `legal_web/lib/api/india-drafting.ts`.

class ConfidenceScore {
  const ConfidenceScore({
    required this.score,
    required this.grade,
    required this.citationVerified,
    required this.groundedSentenceRate,
    required this.ungroundedCount,
    required this.contradictions,
    required this.signals,
  });

  final double score;
  final String grade;
  final bool citationVerified;
  final double groundedSentenceRate;
  final int ungroundedCount;
  final int contradictions;
  final List<String> signals;

  factory ConfidenceScore.fromJson(Map<String, dynamic> json) {
    return ConfidenceScore(
      score: (json['score'] as num?)?.toDouble() ?? 0,
      grade: json['grade'] as String? ?? 'unverified',
      citationVerified: json['citationVerified'] as bool? ?? false,
      groundedSentenceRate:
          (json['groundedSentenceRate'] as num?)?.toDouble() ?? 0,
      ungroundedCount: (json['ungroundedCount'] as num?)?.toInt() ?? 0,
      contradictions: (json['contradictions'] as num?)?.toInt() ?? 0,
      signals: (json['signals'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}

class DraftSectionResult {
  const DraftSectionResult({
    required this.sectionId,
    required this.type,
    required this.title,
    required this.content,
    required this.verificationStatus,
    required this.repairAttempts,
    required this.verificationWarnings,
    required this.citationWarnings,
    required this.modelUsed,
    this.confidence,
    this.isInjectedBoilerplate = false,
  });

  final String sectionId;
  final String type;
  final String title;
  final String content;
  final ConfidenceScore? confidence;
  final String verificationStatus;
  final int repairAttempts;
  final List<String> verificationWarnings;
  final List<String> citationWarnings;
  final String modelUsed;
  final bool isInjectedBoilerplate;

  factory DraftSectionResult.fromJson(Map<String, dynamic> json) {
    final confRaw = json['confidence'];
    return DraftSectionResult(
      sectionId: json['sectionId'] as String? ?? json['sectionKey'] as String? ?? '',
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      confidence: confRaw is Map<String, dynamic>
          ? ConfidenceScore.fromJson(confRaw)
          : null,
      verificationStatus:
          json['verificationStatus'] as String? ?? json['status'] as String? ?? 'needs_review',
      repairAttempts: (json['repairAttempts'] as num?)?.toInt() ?? 0,
      verificationWarnings: (json['verificationWarnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      citationWarnings: (json['citationWarnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      modelUsed: json['modelUsed'] as String? ?? '',
      isInjectedBoilerplate: json['isInjectedBoilerplate'] as bool? ?? false,
    );
  }
}

class ConfidenceReport {
  const ConfidenceReport({
    required this.overallScore,
    required this.overallGrade,
    required this.totalSections,
    required this.verifiedSections,
    required this.needsReviewSections,
    required this.repairTriggered,
    required this.totalRepairs,
    required this.belowThresholdSections,
    this.sectionScores = const [],
  });

  final double overallScore;
  final String overallGrade;
  final List<Map<String, dynamic>> sectionScores;
  final int totalSections;
  final int verifiedSections;
  final int needsReviewSections;
  final bool repairTriggered;
  final int totalRepairs;
  final List<String> belowThresholdSections;

  factory ConfidenceReport.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ConfidenceReport(
        overallScore: 0,
        overallGrade: 'unverified',
        totalSections: 0,
        verifiedSections: 0,
        needsReviewSections: 0,
        repairTriggered: false,
        totalRepairs: 0,
        belowThresholdSections: [],
      );
    }
    return ConfidenceReport(
      overallScore: (json['overallScore'] as num?)?.toDouble() ?? 0,
      overallGrade: json['overallGrade'] as String? ?? 'unverified',
      sectionScores: (json['sectionScores'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      totalSections: (json['totalSections'] as num?)?.toInt() ?? 0,
      verifiedSections: (json['verifiedSections'] as num?)?.toInt() ?? 0,
      needsReviewSections: (json['needsReviewSections'] as num?)?.toInt() ?? 0,
      repairTriggered: json['repairTriggered'] as bool? ?? false,
      totalRepairs: (json['totalRepairs'] as num?)?.toInt() ?? 0,
      belowThresholdSections: (json['belowThresholdSections'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}

class VerificationReport {
  const VerificationReport({
    required this.status,
    required this.canCertify,
    required this.certificationLabel,
    required this.overallWarnings,
    required this.requiresLawyerReview,
    this.sectionStatuses = const [],
  });

  final String status;
  final bool canCertify;
  final String certificationLabel;
  final List<Map<String, dynamic>> sectionStatuses;
  final List<String> overallWarnings;
  final bool requiresLawyerReview;

  factory VerificationReport.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const VerificationReport(
        status: 'needs_review',
        canCertify: false,
        certificationLabel: 'needs_review',
        overallWarnings: [],
        requiresLawyerReview: true,
      );
    }
    return VerificationReport(
      status: json['status'] as String? ?? 'needs_review',
      canCertify: json['canCertify'] as bool? ?? false,
      certificationLabel:
          json['certificationLabel'] as String? ?? 'needs_review',
      sectionStatuses: (json['sectionStatuses'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      overallWarnings: (json['overallWarnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      requiresLawyerReview: json['requiresLawyerReview'] as bool? ?? true,
    );
  }
}

class ResearchPhaseInfo {
  const ResearchPhaseInfo({
    required this.retrievalConfidence,
    required this.usedDeepResearch,
    required this.authorityCount,
  });

  final String retrievalConfidence;
  final bool usedDeepResearch;
  final int authorityCount;

  factory ResearchPhaseInfo.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ResearchPhaseInfo(
        retrievalConfidence: 'low',
        usedDeepResearch: false,
        authorityCount: 0,
      );
    }
    return ResearchPhaseInfo(
      retrievalConfidence: json['retrievalConfidence'] as String? ?? 'low',
      usedDeepResearch: json['usedDeepResearch'] as bool? ?? false,
      authorityCount: (json['authorityCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class IndiaDraftResult {
  const IndiaDraftResult({
    required this.draft,
    this.creditsUsed,
    this.draftId,
    this.modelUsed,
    this.proceduralDetermination,
    this.kindOverridden = false,
    this.recommendedKind,
    this.verification,
    this.researchPhase,
    this.accuracyGate,
    this.sections,
    this.confidenceReport,
    this.verificationReport,
    this.engineVersion,
    this.jobId,
    this.migratedToAsyncEngine = false,
    this.estimatedCredits,
    this.unresolvedItems,
    this.resolvedItems,
    this.counselChecklist,
  });

  final String draft;
  final int? creditsUsed;
  final String? draftId;
  final String? modelUsed;
  final ProceduralDetermination? proceduralDetermination;
  final bool kindOverridden;
  final String? recommendedKind;
  final DraftVerificationAudit? verification;
  final ResearchPhaseInfo? researchPhase;
  final DraftAccuracyGate? accuracyGate;
  final List<DraftSectionResult>? sections;
  final ConfidenceReport? confidenceReport;
  final VerificationReport? verificationReport;
  final String? engineVersion;
  final String? jobId;
  final bool migratedToAsyncEngine;
  final int? estimatedCredits;
  final List<String>? unresolvedItems;
  final List<String>? resolvedItems;
  final String? counselChecklist;

  bool get needsAsyncPolling =>
      migratedToAsyncEngine && jobId != null && jobId!.isNotEmpty;

  bool get canCertify =>
      accuracyGate?.canCertify == true ||
      verificationReport?.canCertify == true ||
      verification?.canCertify == true;

  bool get canExport => accuracyGate?.canExport ?? true;

  String? get publicationState => verification?.publicationState;

  List<VerificationFinding> get findings => verification?.findings ?? const [];

  factory IndiaDraftResult.fromJson(Map<String, dynamic> json) {
    final procRaw = json['proceduralDetermination'] as Map<String, dynamic>?;
    final verificationRaw = json['verification'] as Map<String, dynamic>?;
    final researchRaw = json['researchPhase'] as Map<String, dynamic>?;
    final gateRaw = json['accuracyGate'] as Map<String, dynamic>?;
    final confRaw = json['confidenceReport'] as Map<String, dynamic>?;
    final verReportRaw = json['verificationReport'] as Map<String, dynamic>?;

    return IndiaDraftResult(
      draft: json['draft'] as String? ?? '',
      creditsUsed: (json['creditsUsed'] as num?)?.toInt(),
      draftId: json['draftId'] as String?,
      modelUsed: json['modelUsed'] as String?,
      proceduralDetermination: procRaw != null
          ? ProceduralDetermination.fromJson(procRaw)
          : null,
      kindOverridden: json['kindOverridden'] as bool? ??
          procRaw?['kindOverridden'] as bool? ??
          false,
      recommendedKind: json['recommendedKind'] as String? ??
          procRaw?['recommendedKind'] as String?,
      verification: verificationRaw != null
          ? DraftVerificationAudit.fromJson(verificationRaw)
          : null,
      researchPhase: researchRaw != null
          ? ResearchPhaseInfo.fromJson(researchRaw)
          : null,
      accuracyGate: gateRaw != null ? DraftAccuracyGate.fromJson(gateRaw) : null,
      sections: (json['sections'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(DraftSectionResult.fromJson)
          .toList(),
      confidenceReport:
          confRaw != null ? ConfidenceReport.fromJson(confRaw) : null,
      verificationReport:
          verReportRaw != null ? VerificationReport.fromJson(verReportRaw) : null,
      engineVersion: json['engineVersion'] as String?,
      jobId: json['jobId'] as String?,
      migratedToAsyncEngine: json['migratedToAsyncEngine'] as bool? ?? false,
      estimatedCredits: (json['estimatedCredits'] as num?)?.toInt(),
      unresolvedItems: (json['unresolvedItems'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      resolvedItems: (json['resolvedItems'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      counselChecklist: json['counselChecklist'] as String?,
    );
  }

  /// Maps v3 draft-job result payload into the same shape as sync generate.
  factory IndiaDraftResult.fromDraftJobResult(Map<String, dynamic> raw) {
    final assembled = raw['assembledDraft'] as Map<String, dynamic>?;
    final verReportRaw = raw['verificationReport'] as Map<String, dynamic>?;
    return IndiaDraftResult(
      draft: assembled?['fullText'] as String? ?? '',
      creditsUsed: 0,
      draftId: raw['jobId'] as String?,
      engineVersion: 'v3',
      verificationReport:
          verReportRaw != null ? VerificationReport.fromJson(verReportRaw) : null,
      jobId: raw['jobId'] as String?,
      migratedToAsyncEngine: false,
      accuracyGate: verReportRaw != null
          ? DraftAccuracyGate(
              canCertify: verReportRaw['canCertify'] as bool? ?? false,
              canExport: true,
              certificationLabel:
                  verReportRaw['certificationLabel'] as String? ?? 'needs_review',
            )
          : null,
    );
  }
}

class EnrichCaseLawsResponse {
  const EnrichCaseLawsResponse({
    required this.enrichedDraft,
    required this.creditsCharged,
    required this.providerCostUsd,
    this.citationAppendix = const [],
    this.caseLawAreas = const [],
  });

  final String enrichedDraft;
  final List<Map<String, dynamic>> citationAppendix;
  final List<Map<String, dynamic>> caseLawAreas;
  final int creditsCharged;
  final double providerCostUsd;

  factory EnrichCaseLawsResponse.fromJson(Map<String, dynamic> json) {
    return EnrichCaseLawsResponse(
      enrichedDraft: json['enrichedDraft'] as String? ?? '',
      citationAppendix: (json['citationAppendix'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      caseLawAreas: (json['caseLawAreas'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      creditsCharged: (json['creditsCharged'] as num?)?.toInt() ?? 0,
      providerCostUsd: (json['providerCostUsd'] as num?)?.toDouble() ?? 0,
    );
  }
}

class EditIndiaDraftResponse {
  const EditIndiaDraftResponse({
    required this.revisedText,
    required this.explanation,
    required this.creditsUsed,
    this.verification,
    this.accuracyGate,
  });

  final String revisedText;
  final String explanation;
  final int creditsUsed;
  final DraftVerificationAudit? verification;
  final DraftAccuracyGate? accuracyGate;

  factory EditIndiaDraftResponse.fromJson(Map<String, dynamic> json) {
    return EditIndiaDraftResponse(
      revisedText: json['revisedText'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
      creditsUsed: (json['creditsUsed'] as num?)?.toInt() ?? 0,
      verification: DraftVerificationAudit.fromJson(
        json['verification'] as Map<String, dynamic>?,
      ),
      accuracyGate: DraftAccuracyGate.fromJson(
        json['accuracyGate'] as Map<String, dynamic>?,
      ),
    );
  }
}

class ReverifyIndiaDraftResponse {
  const ReverifyIndiaDraftResponse({
    required this.draft,
    required this.verification,
    required this.accuracyGate,
    required this.creditsUsed,
  });

  final String draft;
  final DraftVerificationAudit verification;
  final DraftAccuracyGate accuracyGate;
  final int creditsUsed;

  factory ReverifyIndiaDraftResponse.fromJson(Map<String, dynamic> json) {
    return ReverifyIndiaDraftResponse(
      draft: json['draft'] as String? ?? '',
      verification: DraftVerificationAudit.fromJson(
        json['verification'] as Map<String, dynamic>?,
      ),
      accuracyGate: DraftAccuracyGate.fromJson(
        json['accuracyGate'] as Map<String, dynamic>?,
      ),
      creditsUsed: (json['creditsUsed'] as num?)?.toInt() ?? 0,
    );
  }
}

class UsDraftResult {
  const UsDraftResult({
    required this.draft,
    this.creditsUsed,
    this.draftId,
    this.verification,
    this.accuracyGate,
  });

  final String draft;
  final int? creditsUsed;
  final String? draftId;
  final DraftVerificationAudit? verification;
  final DraftAccuracyGate? accuracyGate;

  bool get canCertify =>
      accuracyGate?.canCertify == true || verification?.canCertify == true;

  factory UsDraftResult.fromJson(Map<String, dynamic> json) {
    return UsDraftResult(
      draft: json['draft'] as String? ?? '',
      creditsUsed: (json['creditsUsed'] as num?)?.toInt(),
      draftId: json['draftId'] as String?,
      verification: json['verification'] is Map<String, dynamic>
          ? DraftVerificationAudit.fromJson(
              json['verification'] as Map<String, dynamic>,
            )
          : null,
      accuracyGate: json['accuracyGate'] is Map<String, dynamic>
          ? DraftAccuracyGate.fromJson(
              json['accuracyGate'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}
