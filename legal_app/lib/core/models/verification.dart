// Verification types mirrored from `legal_web/lib/api/verification.ts`.

typedef CheckState = String; // PASS | FAIL | INDETERMINATE | NOT_APPLICABLE
typedef FindingSeverity = String; // BLOCKER | HIGH | MEDIUM | LOW
typedef PublicationState = String;
// DRAFT_NOT_VERIFIED | RESEARCH_BACKED | VERIFIED_WITH_LIMITATIONS |
// READY_FOR_LAWYER_REVIEW | VERIFICATION_UNAVAILABLE

typedef VerificationDimensionName = String;

class VerificationFinding {
  const VerificationFinding({
    required this.checkId,
    required this.state,
    required this.severity,
    required this.dimension,
    required this.evidenceIds,
    required this.explanation,
    required this.verifierVersion,
    this.propositionId,
    this.authorityId,
    this.repairAction,
  });

  final String checkId;
  final CheckState state;
  final FindingSeverity severity;
  final VerificationDimensionName dimension;
  final String? propositionId;
  final String? authorityId;
  final List<String> evidenceIds;
  final String explanation;
  final String? repairAction;
  final String verifierVersion;

  factory VerificationFinding.fromJson(Map<String, dynamic> json) {
    return VerificationFinding(
      checkId: json['checkId'] as String? ?? '',
      state: json['state'] as String? ?? 'INDETERMINATE',
      severity: json['severity'] as String? ?? 'LOW',
      dimension: json['dimension'] as String? ?? 'system',
      propositionId: json['propositionId'] as String?,
      authorityId: json['authorityId'] as String?,
      evidenceIds: (json['evidenceIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      explanation: json['explanation'] as String? ?? '',
      repairAction: json['repairAction'] as String?,
      verifierVersion: json['verifierVersion'] as String? ?? '',
    );
  }
}

class VerificationDimensionSummary {
  const VerificationDimensionSummary({
    required this.state,
    required this.pass,
    required this.fail,
    required this.indeterminate,
    required this.notApplicable,
  });

  final CheckState state;
  final int pass;
  final int fail;
  final int indeterminate;
  final int notApplicable;

  factory VerificationDimensionSummary.fromJson(Map<String, dynamic> json) {
    return VerificationDimensionSummary(
      state: json['state'] as String? ?? 'NOT_APPLICABLE',
      pass: (json['pass'] as num?)?.toInt() ?? 0,
      fail: (json['fail'] as num?)?.toInt() ?? 0,
      indeterminate: (json['indeterminate'] as num?)?.toInt() ?? 0,
      notApplicable: (json['notApplicable'] as num?)?.toInt() ?? 0,
    );
  }

  factory VerificationDimensionSummary.notApplicable() {
    return const VerificationDimensionSummary(
      state: 'NOT_APPLICABLE',
      pass: 0,
      fail: 0,
      indeterminate: 0,
      notApplicable: 1,
    );
  }
}

class VerificationDimensions {
  const VerificationDimensions({
    required this.identity,
    required this.passage,
    required this.quotation,
    required this.currentLaw,
    required this.treatment,
    required this.hierarchy,
  });

  final VerificationDimensionSummary identity;
  final VerificationDimensionSummary passage;
  final VerificationDimensionSummary quotation;
  final VerificationDimensionSummary currentLaw;
  final VerificationDimensionSummary treatment;
  final VerificationDimensionSummary hierarchy;

  factory VerificationDimensions.fallback() {
    final na = VerificationDimensionSummary.notApplicable();
    return VerificationDimensions(
      identity: na,
      passage: na,
      quotation: na,
      currentLaw: na,
      treatment: na,
      hierarchy: na,
    );
  }

  factory VerificationDimensions.fromJson(Map<String, dynamic>? json) {
    if (json == null) return VerificationDimensions.fallback();
    VerificationDimensionSummary parse(String key) {
      final raw = json[key];
      if (raw is Map<String, dynamic>) {
        return VerificationDimensionSummary.fromJson(raw);
      }
      return VerificationDimensionSummary.notApplicable();
    }

    return VerificationDimensions(
      identity: parse('identity'),
      passage: parse('passage'),
      quotation: parse('quotation'),
      currentLaw: parse('currentLaw'),
      treatment: parse('treatment'),
      hierarchy: parse('hierarchy'),
    );
  }

  Map<String, VerificationDimensionSummary> asMap() => {
        'identity': identity,
        'passage': passage,
        'quotation': quotation,
        'currentLaw': currentLaw,
        'treatment': treatment,
        'hierarchy': hierarchy,
      };
}

class VerifiedPropositionSummary {
  const VerifiedPropositionSummary({
    required this.id,
    required this.text,
    required this.type,
    required this.materiality,
    required this.evidenceIds,
    required this.supportState,
  });

  final String id;
  final String text;
  final String type;
  final String materiality; // MATERIAL | SUPPORTING
  final List<String> evidenceIds;
  final String supportState;

  factory VerifiedPropositionSummary.fromJson(Map<String, dynamic> json) {
    return VerifiedPropositionSummary(
      id: json['id'] as String? ?? '',
      text: json['text'] as String? ?? '',
      type: json['type'] as String? ?? '',
      materiality: json['materiality'] as String? ?? 'SUPPORTING',
      evidenceIds: (json['evidenceIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      supportState: json['supportState'] as String? ?? 'INDETERMINATE',
    );
  }
}

String publicationStateLabel(String? state) {
  switch (state) {
    case 'READY_FOR_LAWYER_REVIEW':
      return 'Ready for lawyer review';
    case 'VERIFIED_WITH_LIMITATIONS':
      return 'Verified with limitations';
    case 'RESEARCH_BACKED':
      return 'Research-backed';
    case 'VERIFICATION_UNAVAILABLE':
      return 'Verification incomplete';
    case 'DRAFT_NOT_VERIFIED':
      return 'Draft — not verified';
    default:
      return 'Limited checks only';
  }
}

String checkStateLabel(String state) {
  switch (state) {
    case 'PASS':
      return 'Pass';
    case 'FAIL':
      return 'Fail';
    case 'INDETERMINATE':
      return 'Incomplete';
    case 'NOT_APPLICABLE':
      return 'N/A';
    default:
      return state;
  }
}

String publicationStateSubtitle(String? state) {
  switch (state) {
    case 'READY_FOR_LAWYER_REVIEW':
      return 'Mandatory Phase 1 checks passed; good-law graph not run.';
    case 'VERIFIED_WITH_LIMITATIONS':
      return 'Some checks need review before filing.';
    case 'VERIFICATION_UNAVAILABLE':
      return 'Verification incomplete. Do not treat as court-ready.';
    case 'DRAFT_NOT_VERIFIED':
      return 'Blockers were found in the retrieved support.';
    case 'RESEARCH_BACKED':
      return 'Research-backed, with advanced checks shown below.';
    default:
      return 'Older result format. Limited checks only.';
  }
}

const dimensionLabels = <String, String>{
  'identity': 'Identity',
  'passage': 'Passage',
  'quotation': 'Quotation',
  'currentLaw': 'Current law',
  'treatment': 'Treatment',
  'hierarchy': 'Hierarchy',
};
