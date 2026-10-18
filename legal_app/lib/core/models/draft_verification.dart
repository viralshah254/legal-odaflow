import 'verification.dart';

/// Draft verification types mirrored from `legal_web/lib/api/draft-verification.ts`.

class SimilarCase {
  const SimilarCase({
    required this.authorityId,
    required this.title,
    required this.sourceName,
    required this.relevantSections,
    required this.confidence,
    required this.verificationStatus,
    this.citation,
    this.court,
    this.year,
    this.sourceUrl,
    this.summary,
    this.relevance,
    this.bindingWeight,
  });

  final String authorityId;
  final String title;
  final String? citation;
  final String? court;
  final String? year;
  final String? sourceUrl;
  final String sourceName;
  final String? summary;
  final List<String> relevantSections;
  final String? relevance;
  final String? bindingWeight;
  final double confidence;
  final String verificationStatus;

  factory SimilarCase.fromJson(Map<String, dynamic> json) {
    return SimilarCase(
      authorityId: json['authorityId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      citation: json['citation'] as String?,
      court: json['court'] as String?,
      year: json['year']?.toString(),
      sourceUrl: json['sourceUrl'] as String?,
      sourceName: json['sourceName'] as String? ?? '',
      summary: json['summary'] as String?,
      relevantSections: (json['relevantSections'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      relevance: json['relevance'] as String?,
      bindingWeight: json['bindingWeight'] as String?,
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      verificationStatus: json['verificationStatus'] as String? ?? 'unknown',
    );
  }
}

class SectionCheckEntry {
  const SectionCheckEntry({
    required this.originalSection,
    required this.caseSuggestedSections,
    required this.confirmedSections,
    required this.warnings,
    required this.corrected,
  });

  final String originalSection;
  final List<String> caseSuggestedSections;
  final List<String> confirmedSections;
  final List<String> warnings;
  final bool corrected;

  factory SectionCheckEntry.fromJson(Map<String, dynamic> json) {
    return SectionCheckEntry(
      originalSection: json['originalSection'] as String? ?? '',
      caseSuggestedSections: (json['caseSuggestedSections'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      confirmedSections: (json['confirmedSections'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      warnings: (json['warnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      corrected: json['corrected'] as bool? ?? false,
    );
  }
}

class SectionChecksAudit {
  const SectionChecksAudit({
    required this.entries,
    required this.anyCorrections,
    required this.anyUnconfirmedMismatches,
  });

  final List<SectionCheckEntry> entries;
  final bool anyCorrections;
  final bool anyUnconfirmedMismatches;

  factory SectionChecksAudit.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const SectionChecksAudit(
        entries: [],
        anyCorrections: false,
        anyUnconfirmedMismatches: false,
      );
    }
    return SectionChecksAudit(
      entries: (json['entries'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(SectionCheckEntry.fromJson)
              .toList() ??
          const [],
      anyCorrections: json['anyCorrections'] as bool? ?? false,
      anyUnconfirmedMismatches:
          json['anyUnconfirmedMismatches'] as bool? ?? false,
    );
  }
}

class StrippedCitation {
  const StrippedCitation({required this.original, required this.reason});

  final String original;
  final String reason;

  factory StrippedCitation.fromJson(Map<String, dynamic> json) {
    return StrippedCitation(
      original: json['original'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
    );
  }
}

class DraftCitationAudit {
  const DraftCitationAudit({
    required this.verified,
    required this.total,
    required this.unverifiable,
  });

  final int verified;
  final int total;
  final List<String> unverifiable;

  factory DraftCitationAudit.fromJson(Map<String, dynamic> json) {
    return DraftCitationAudit(
      verified: (json['verified'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
      unverifiable: (json['unverifiable'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}

class DraftCorrection {
  const DraftCorrection({
    required this.from,
    required this.to,
    required this.reason,
    required this.source,
  });

  final String from;
  final String to;
  final String reason;
  final String source;

  factory DraftCorrection.fromJson(Map<String, dynamic> json) {
    return DraftCorrection(
      from: json['from'] as String? ?? '',
      to: json['to'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      source: json['source'] as String? ?? '',
    );
  }
}

class DraftSentenceAudit {
  const DraftSentenceAudit({
    required this.coverageRate,
    required this.ungroundedCount,
  });

  final double coverageRate;
  final int ungroundedCount;

  factory DraftSentenceAudit.fromJson(Map<String, dynamic> json) {
    return DraftSentenceAudit(
      coverageRate: (json['coverageRate'] as num?)?.toDouble() ?? 0,
      ungroundedCount: (json['ungroundedCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class DraftVerificationAudit {
  const DraftVerificationAudit({
    required this.corrections,
    required this.similarCases,
    required this.sectionChecks,
    required this.citationWarnings,
    required this.strippedCitations,
    required this.proceduralWarnings,
    required this.completenessGaps,
    required this.requiresLawyerReview,
    required this.verificationStatus,
    this.citationAudit,
    this.sentenceAudit,
    this.canCertify,
    this.certificationLabel,
    this.unresolvedFacts,
    this.findings,
    this.propositions,
    this.evidencePackId,
    this.outputHash,
    this.dimensions,
    this.publicationState,
  });

  final List<DraftCorrection> corrections;
  final List<SimilarCase> similarCases;
  final SectionChecksAudit sectionChecks;
  final List<String> citationWarnings;
  final List<StrippedCitation> strippedCitations;
  final DraftCitationAudit? citationAudit;
  final DraftSentenceAudit? sentenceAudit;
  final List<String> proceduralWarnings;
  final List<String> completenessGaps;
  final bool requiresLawyerReview;
  final String verificationStatus; // verified | needs_review | limited_sources
  final bool? canCertify;
  final String? certificationLabel;
  final List<String>? unresolvedFacts;
  final List<VerificationFinding>? findings;
  final List<VerifiedPropositionSummary>? propositions;
  final String? evidencePackId;
  final String? outputHash;
  final VerificationDimensions? dimensions;
  final String? publicationState;

  bool get exportAllowed => canCertify == true;

  factory DraftVerificationAudit.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const DraftVerificationAudit(
        corrections: [],
        similarCases: [],
        sectionChecks: SectionChecksAudit(
          entries: [],
          anyCorrections: false,
          anyUnconfirmedMismatches: false,
        ),
        citationWarnings: [],
        strippedCitations: [],
        proceduralWarnings: [],
        completenessGaps: [],
        requiresLawyerReview: true,
        verificationStatus: 'needs_review',
      );
    }

    final citationAuditRaw = json['citationAudit'];
    final sentenceAuditRaw = json['sentenceAudit'];
    final dimensionsRaw = json['dimensions'];

    return DraftVerificationAudit(
      corrections: (json['corrections'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(DraftCorrection.fromJson)
              .toList() ??
          const [],
      similarCases: (json['similarCases'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(SimilarCase.fromJson)
              .toList() ??
          const [],
      sectionChecks: SectionChecksAudit.fromJson(
        json['sectionChecks'] as Map<String, dynamic>?,
      ),
      citationWarnings: (json['citationWarnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      strippedCitations: (json['strippedCitations'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(StrippedCitation.fromJson)
              .toList() ??
          const [],
      citationAudit: citationAuditRaw is Map<String, dynamic>
          ? DraftCitationAudit.fromJson(citationAuditRaw)
          : null,
      sentenceAudit: sentenceAuditRaw is Map<String, dynamic>
          ? DraftSentenceAudit.fromJson(sentenceAuditRaw)
          : null,
      proceduralWarnings: (json['proceduralWarnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      completenessGaps: (json['completenessGaps'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      requiresLawyerReview: json['requiresLawyerReview'] as bool? ?? true,
      verificationStatus:
          json['verificationStatus'] as String? ?? 'needs_review',
      canCertify: json['canCertify'] as bool?,
      certificationLabel: json['certificationLabel'] as String?,
      unresolvedFacts: (json['unresolvedFacts'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      findings: (json['findings'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(VerificationFinding.fromJson)
          .toList(),
      propositions: (json['propositions'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(VerifiedPropositionSummary.fromJson)
          .toList(),
      evidencePackId: json['evidencePackId'] as String?,
      outputHash: json['outputHash'] as String?,
      dimensions: dimensionsRaw is Map<String, dynamic>
          ? VerificationDimensions.fromJson(dimensionsRaw)
          : null,
      publicationState: json['publicationState'] as String?,
    );
  }
}

class DraftAccuracyGate {
  const DraftAccuracyGate({
    required this.canCertify,
    required this.canExport,
    required this.certificationLabel,
    this.exportWatermark,
    this.unresolvedFacts,
  });

  final bool canCertify;
  final bool canExport;
  final String certificationLabel;
  final String? exportWatermark;
  final List<String>? unresolvedFacts;

  factory DraftAccuracyGate.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const DraftAccuracyGate(
        canCertify: false,
        canExport: true,
        certificationLabel: 'needs_review',
      );
    }
    return DraftAccuracyGate(
      canCertify: json['canCertify'] as bool? ?? false,
      canExport: json['canExport'] as bool? ?? true,
      exportWatermark: json['exportWatermark'] as String?,
      certificationLabel:
          json['certificationLabel'] as String? ?? 'needs_review',
      unresolvedFacts: (json['unresolvedFacts'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
    );
  }
}

class CitationAuditSummary {
  const CitationAuditSummary({
    required this.verifiedCitationCount,
    required this.unsupportedClaims,
    required this.warnings,
    this.totalClaims,
    this.supportedClaims,
    this.totalCitations,
    this.verifiedCitations,
    this.unverifiedCitations,
    this.sourceQuality,
  });

  final int verifiedCitationCount;
  final List<UnsupportedClaim> unsupportedClaims;
  final List<String> warnings;
  final int? totalClaims;
  final int? supportedClaims;
  final int? totalCitations;
  final int? verifiedCitations;
  final List<String>? unverifiedCitations;
  final String? sourceQuality;

  factory CitationAuditSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const CitationAuditSummary(
        verifiedCitationCount: 0,
        unsupportedClaims: [],
        warnings: [],
      );
    }
    return CitationAuditSummary(
      verifiedCitationCount:
          (json['verifiedCitationCount'] as num?)?.toInt() ?? 0,
      unsupportedClaims: (json['unsupportedClaims'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(UnsupportedClaim.fromJson)
              .toList() ??
          const [],
      warnings: (json['warnings'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      totalClaims: (json['totalClaims'] as num?)?.toInt(),
      supportedClaims: (json['supportedClaims'] as num?)?.toInt(),
      totalCitations: (json['totalCitations'] as num?)?.toInt(),
      verifiedCitations: (json['verifiedCitations'] as num?)?.toInt(),
      unverifiedCitations: (json['unverifiedCitations'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      sourceQuality: json['sourceQuality'] as String?,
    );
  }
}

class UnsupportedClaim {
  const UnsupportedClaim({required this.claim, required this.citations});

  final String claim;
  final List<String> citations;

  factory UnsupportedClaim.fromJson(Map<String, dynamic> json) {
    return UnsupportedClaim(
      claim: json['claim'] as String? ?? '',
      citations: (json['citations'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }
}

class PinnedSection {
  const PinnedSection({
    required this.section,
    required this.source,
    this.actId,
    this.label,
    this.authorityId,
    this.textExcerpt,
  });

  final String? actId;
  final String section;
  final String? label;
  final String? authorityId;
  final String? textExcerpt;
  final String source; // section_finder | user_unresolved | resolved_ingest

  Map<String, dynamic> toJson() => {
        if (actId != null) 'actId': actId,
        'section': section,
        if (label != null) 'label': label,
        if (authorityId != null) 'authorityId': authorityId,
        if (textExcerpt != null) 'textExcerpt': textExcerpt,
        'source': source,
      };

  factory PinnedSection.fromJson(Map<String, dynamic> json) {
    return PinnedSection(
      actId: json['actId'] as String?,
      section: json['section'] as String? ?? '',
      label: json['label'] as String?,
      authorityId: json['authorityId'] as String?,
      textExcerpt: json['textExcerpt'] as String?,
      source: json['source'] as String? ?? 'section_finder',
    );
  }
}

class PinnedCaseLaw {
  const PinnedCaseLaw({
    required this.citation,
    required this.source,
    this.caseName,
    this.holding,
    this.authorityId,
  });

  final String citation;
  final String? caseName;
  final String? holding;
  final String? authorityId;
  final String source; // user | research | form_metadata

  Map<String, dynamic> toJson() => {
        'citation': citation,
        if (caseName != null) 'caseName': caseName,
        if (holding != null) 'holding': holding,
        if (authorityId != null) 'authorityId': authorityId,
        'source': source,
      };

  factory PinnedCaseLaw.fromJson(Map<String, dynamic> json) {
    return PinnedCaseLaw(
      citation: json['citation'] as String? ?? '',
      caseName: json['caseName'] as String?,
      holding: json['holding'] as String?,
      authorityId: json['authorityId'] as String?,
      source: json['source'] as String? ?? 'user',
    );
  }
}
