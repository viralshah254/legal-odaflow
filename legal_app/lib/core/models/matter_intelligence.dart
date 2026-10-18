double _parseDouble(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

List<String> _stringList(dynamic raw) =>
    (raw as List<dynamic>? ?? []).map((e) => e.toString()).toList();

List<T> _mapList<T>(
  dynamic raw,
  T Function(Map<String, dynamic>) fromJson,
) =>
    (raw as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(fromJson)
        .toList();

// ─── Matter Intelligence v2 ───────────────────────────────────────────────────

typedef MatterNature = String;
typedef MatterStage = String;
typedef MatterPosture = String;
typedef RecommendationMode = String;

class MatterFieldConfidence {
  const MatterFieldConfidence({
    required this.practiceArea,
    required this.subPracticeArea,
    required this.nature,
    required this.forum,
  });

  factory MatterFieldConfidence.fromJson(Map<String, dynamic> json) {
    return MatterFieldConfidence(
      practiceArea: _parseDouble(json['practiceArea']),
      subPracticeArea: _parseDouble(json['subPracticeArea']),
      nature: _parseDouble(json['nature']),
      forum: _parseDouble(json['forum']),
    );
  }

  final double practiceArea;
  final double subPracticeArea;
  final double nature;
  final double forum;
}

class MatterProfile {
  const MatterProfile({
    required this.country,
    required this.practiceArea,
    this.subPracticeArea,
    required this.nature,
    this.forum,
    this.stage,
    this.posture,
    this.remedies = const [],
    this.issues = const [],
    this.documentTypes = const [],
    this.documentKind,
    this.curatedKinds = const [],
    required this.confidence,
    this.fieldConfidence,
    this.jurisdiction,
  });

  factory MatterProfile.fromJson(Map<String, dynamic> json) {
    final fieldRaw = json['fieldConfidence'] as Map<String, dynamic>?;
    return MatterProfile(
      country: json['country'] as String? ?? '',
      practiceArea: json['practiceArea'] as String? ?? '',
      subPracticeArea: json['subPracticeArea'] as String?,
      nature: json['nature'] as String? ?? 'unknown',
      forum: json['forum'] as String?,
      stage: json['stage'] as String?,
      posture: json['posture'] as String?,
      remedies: _stringList(json['remedies']),
      issues: _stringList(json['issues']),
      documentTypes: _stringList(json['documentTypes']),
      documentKind: json['documentKind'] as String?,
      curatedKinds: _stringList(json['curatedKinds']),
      confidence: _parseDouble(json['confidence']),
      fieldConfidence:
          fieldRaw != null ? MatterFieldConfidence.fromJson(fieldRaw) : null,
      jurisdiction: json['jurisdiction'] as String?,
    );
  }

  final String country;
  final String practiceArea;
  final String? subPracticeArea;
  final MatterNature nature;
  final String? forum;
  final MatterStage? stage;
  final MatterPosture? posture;
  final List<String> remedies;
  final List<String> issues;
  final List<String> documentTypes;
  final String? documentKind;
  final List<String> curatedKinds;
  final double confidence;
  final MatterFieldConfidence? fieldConfidence;
  final String? jurisdiction;
}

class MatterParty {
  const MatterParty({
    required this.name,
    this.role,
    this.side,
  });

  factory MatterParty.fromJson(Map<String, dynamic> json) {
    return MatterParty(
      name: json['name'] as String? ?? '',
      role: json['role'] as String?,
      side: json['side'] as String?,
    );
  }

  final String name;
  final String? role;
  final String? side;
}

class MatterClaim {
  const MatterClaim({
    required this.summary,
    this.reliefSought,
  });

  factory MatterClaim.fromJson(Map<String, dynamic> json) {
    return MatterClaim(
      summary: json['summary'] as String? ?? '',
      reliefSought: json['reliefSought'] as String?,
    );
  }

  final String summary;
  final String? reliefSought;
}

class MatterDefence {
  const MatterDefence({required this.summary});

  factory MatterDefence.fromJson(Map<String, dynamic> json) {
    return MatterDefence(summary: json['summary'] as String? ?? '');
  }

  final String summary;
}

class StatuteRef {
  const StatuteRef({
    required this.act,
    this.section,
  });

  factory StatuteRef.fromJson(Map<String, dynamic> json) {
    return StatuteRef(
      act: json['act'] as String? ?? '',
      section: json['section'] as String?,
    );
  }

  final String act;
  final String? section;
}

class PrecedentRef {
  const PrecedentRef({
    required this.citation,
    this.title,
  });

  factory PrecedentRef.fromJson(Map<String, dynamic> json) {
    return PrecedentRef(
      citation: json['citation'] as String? ?? '',
      title: json['title'] as String?,
    );
  }

  final String citation;
  final String? title;
}

class EvidenceRef {
  const EvidenceRef({
    this.id,
    required this.description,
    this.sourceType,
    this.sourceDocumentId,
  });

  factory EvidenceRef.fromJson(Map<String, dynamic> json) {
    return EvidenceRef(
      id: json['id'] as String?,
      description: json['description'] as String? ?? '',
      sourceType: json['sourceType'] as String?,
      sourceDocumentId: json['sourceDocumentId'] as String?,
    );
  }

  final String? id;
  final String description;
  final String? sourceType;
  final String? sourceDocumentId;
}

class MatterDocumentRef {
  const MatterDocumentRef({
    this.id,
    required this.title,
    this.documentType,
  });

  factory MatterDocumentRef.fromJson(Map<String, dynamic> json) {
    return MatterDocumentRef(
      id: json['id'] as String?,
      title: json['title'] as String? ?? '',
      documentType: json['documentType'] as String?,
    );
  }

  final String? id;
  final String title;
  final String? documentType;
}

class TimelineEvent {
  const TimelineEvent({
    this.date,
    required this.description,
    this.eventType,
  });

  factory TimelineEvent.fromJson(Map<String, dynamic> json) {
    return TimelineEvent(
      date: json['date'] as String?,
      description: json['description'] as String? ?? '',
      eventType: json['eventType'] as String?,
    );
  }

  final String? date;
  final String description;
  final String? eventType;
}

class MatterGraph {
  const MatterGraph({
    this.matterId,
    this.parties = const [],
    this.claims = const [],
    this.defences = const [],
    this.statutes = const [],
    this.precedents = const [],
    this.evidence = const [],
    this.documents = const [],
    this.timeline = const [],
  });

  factory MatterGraph.fromJson(Map<String, dynamic> json) {
    return MatterGraph(
      matterId: json['matterId'] as String?,
      parties: _mapList(json['parties'], MatterParty.fromJson),
      claims: _mapList(json['claims'], MatterClaim.fromJson),
      defences: _mapList(json['defences'], MatterDefence.fromJson),
      statutes: _mapList(json['statutes'], StatuteRef.fromJson),
      precedents: _mapList(json['precedents'], PrecedentRef.fromJson),
      evidence: _mapList(json['evidence'], EvidenceRef.fromJson),
      documents: _mapList(json['documents'], MatterDocumentRef.fromJson),
      timeline: _mapList(json['timeline'], TimelineEvent.fromJson),
    );
  }

  final String? matterId;
  final List<MatterParty> parties;
  final List<MatterClaim> claims;
  final List<MatterDefence> defences;
  final List<StatuteRef> statutes;
  final List<PrecedentRef> precedents;
  final List<EvidenceRef> evidence;
  final List<MatterDocumentRef> documents;
  final List<TimelineEvent> timeline;
}

class MatterDeadline {
  const MatterDeadline({
    required this.label,
    this.dueDate,
    this.description,
  });

  factory MatterDeadline.fromJson(Map<String, dynamic> json) {
    return MatterDeadline(
      label: json['label'] as String? ?? '',
      dueDate: json['dueDate'] as String?,
      description: json['description'] as String?,
    );
  }

  final String label;
  final String? dueDate;
  final String? description;
}

class MatterTaskGraph {
  const MatterTaskGraph({
    this.recommendedActions = const [],
    this.requiredDocuments = const [],
    this.missingDocuments = const [],
    this.deadlines = const [],
    this.nextBestAction,
  });

  factory MatterTaskGraph.fromJson(Map<String, dynamic> json) {
    return MatterTaskGraph(
      recommendedActions: _stringList(json['recommendedActions']),
      requiredDocuments: _stringList(json['requiredDocuments']),
      missingDocuments: _stringList(json['missingDocuments']),
      deadlines: _mapList(json['deadlines'], MatterDeadline.fromJson),
      nextBestAction: json['nextBestAction'] as String?,
    );
  }

  final List<String> recommendedActions;
  final List<String> requiredDocuments;
  final List<String> missingDocuments;
  final List<MatterDeadline> deadlines;
  final String? nextBestAction;
}

class MatterClarifyingQuestion {
  const MatterClarifyingQuestion({
    required this.id,
    required this.text,
    this.options = const [],
    required this.field,
  });

  factory MatterClarifyingQuestion.fromJson(Map<String, dynamic> json) {
    return MatterClarifyingQuestion(
      id: json['id'] as String? ?? '',
      text: json['text'] as String? ?? '',
      options: _stringList(json['options']),
      field: json['field'] as String? ?? 'nature',
    );
  }

  final String id;
  final String text;
  final List<String> options;
  final String field;
}

class MatterClassificationResult {
  const MatterClassificationResult({
    required this.profile,
    this.graph,
    this.taskGraph,
    this.clarifyingQuestions = const [],
    required this.shouldProceed,
    required this.recommendationMode,
  });

  factory MatterClassificationResult.fromJson(Map<String, dynamic> json) {
    return MatterClassificationResult(
      profile: MatterProfile.fromJson(
        json['profile'] as Map<String, dynamic>? ?? {},
      ),
      graph: json['graph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['graph'] as Map<String, dynamic>)
          : null,
      taskGraph: json['taskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(json['taskGraph'] as Map<String, dynamic>)
          : null,
      clarifyingQuestions: _mapList(
        json['clarifyingQuestions'],
        MatterClarifyingQuestion.fromJson,
      ),
      shouldProceed: json['shouldProceed'] as bool? ?? true,
      recommendationMode:
          json['recommendationMode'] as String? ?? 'matched',
    );
  }

  final MatterProfile profile;
  final MatterGraph? graph;
  final MatterTaskGraph? taskGraph;
  final List<MatterClarifyingQuestion> clarifyingQuestions;
  final bool shouldProceed;
  final RecommendationMode recommendationMode;
}
