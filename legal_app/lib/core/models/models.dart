import '../pricing/local_pricing.dart';
import 'draft_verification.dart';
import 'matter_intelligence.dart';
import 'verification.dart';

export 'agent_job.dart';
export 'draft_job.dart';
export 'draft_intent.dart';
export 'prompt_refinement.dart';
export 'draft_verification.dart';
export 'india_draft.dart';
export 'verification.dart';

DateTime? _parseDateTime(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  return DateTime.tryParse(value.toString());
}

double _parseAmount(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

int _parseInt(dynamic value) {
  if (value == null) return 0;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString()) ?? 0;
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.userType,
    this.name,
    this.countryCode,
    this.tenantId,
    this.tenantRole,
    this.mustChangePassword = false,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      userType: json['userType'] as String,
      countryCode: json['countryCode'] as String?,
      tenantId: json['tenantId'] as String?,
      tenantRole: json['tenantRole'] as String?,
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
    );
  }

  final String id;
  final String email;
  final String? name;
  final String userType;
  final String? countryCode;
  final String? tenantId;
  final String? tenantRole;
  final bool mustChangePassword;

  bool get isConsumer => userType == 'CONSUMER';
  bool get isLawyer => userType == 'LAWYER';

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'userType': userType,
        if (name != null) 'name': name,
        if (countryCode != null) 'countryCode': countryCode,
        if (tenantId != null) 'tenantId': tenantId,
        if (tenantRole != null) 'tenantRole': tenantRole,
        if (mustChangePassword) 'mustChangePassword': mustChangePassword,
      };

  AuthUser copyWith({
    String? id,
    String? email,
    String? name,
    String? userType,
    String? countryCode,
    String? tenantId,
    String? tenantRole,
    bool? mustChangePassword,
  }) {
    return AuthUser(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      userType: userType ?? this.userType,
      countryCode: countryCode ?? this.countryCode,
      tenantId: tenantId ?? this.tenantId,
      tenantRole: tenantRole ?? this.tenantRole,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
    );
  }
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
    );
  }

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
}

class ConsumerCase {
  const ConsumerCase({
    required this.id,
    required this.title,
    required this.issueType,
    required this.status,
    required this.countryCode,
    this.jurisdiction,
    this.facts,
    this.desiredOutcome,
    this.riskScore,
    this.createdAt,
    this.matterProfile,
    this.matterGraph,
    this.matterTaskGraph,
  });

  factory ConsumerCase.fromJson(Map<String, dynamic> json) {
    return ConsumerCase(
      id: json['id'] as String,
      title: json['title'] as String,
      issueType: json['issueType'] as String,
      status: json['status'] as String,
      countryCode: json['countryCode'] as String,
      jurisdiction: json['jurisdiction'] as String?,
      facts: json['facts'] as String?,
      desiredOutcome: json['desiredOutcome'] as String?,
      riskScore: (json['riskScore'] as num?)?.toDouble(),
      createdAt: _parseDateTime(json['createdAt']),
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      matterTaskGraph: json['matterTaskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(json['matterTaskGraph'] as Map<String, dynamic>)
          : null,
    );
  }

  final String id;
  final String title;
  final String issueType;
  final String status;
  final String countryCode;
  final String? jurisdiction;
  final String? facts;
  final String? desiredOutcome;
  final double? riskScore;
  final DateTime? createdAt;
  final MatterProfile? matterProfile;
  final MatterGraph? matterGraph;
  final MatterTaskGraph? matterTaskGraph;
}

class ConsumerLegalReport {
  const ConsumerLegalReport({
    required this.id,
    required this.title,
    required this.isPreview,
    this.contentMarkdown,
    this.riskLevel,
    this.createdAt,
  });

  factory ConsumerLegalReport.fromJson(Map<String, dynamic> json) {
    return ConsumerLegalReport(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Legal Report',
      isPreview: json['isPreview'] as bool? ?? false,
      contentMarkdown: json['contentMarkdown'] as String?,
      riskLevel: json['riskLevel'] as String?,
      createdAt: _parseDateTime(json['createdAt']),
    );
  }

  final String id;
  final String title;
  final bool isPreview;
  final String? contentMarkdown;
  final String? riskLevel;
  final DateTime? createdAt;
}

class ConsumerCaseDetail extends ConsumerCase {
  const ConsumerCaseDetail({
    required super.id,
    required super.title,
    required super.issueType,
    required super.status,
    required super.countryCode,
    super.jurisdiction,
    super.facts,
    super.desiredOutcome,
    super.riskScore,
    super.createdAt,
    super.matterProfile,
    super.matterGraph,
    super.matterTaskGraph,
    this.reports = const [],
  });

  factory ConsumerCaseDetail.fromJson(Map<String, dynamic> json) {
    final reportsRaw = json['reports'] as List<dynamic>? ?? [];
    return ConsumerCaseDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      issueType: json['issueType'] as String,
      status: json['status'] as String,
      countryCode: json['countryCode'] as String,
      jurisdiction: json['jurisdiction'] as String?,
      facts: json['facts'] as String?,
      desiredOutcome: json['desiredOutcome'] as String?,
      riskScore: (json['riskScore'] as num?)?.toDouble(),
      createdAt: _parseDateTime(json['createdAt']),
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      matterTaskGraph: json['matterTaskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(json['matterTaskGraph'] as Map<String, dynamic>)
          : null,
      reports: reportsRaw
          .whereType<Map<String, dynamic>>()
          .map(ConsumerLegalReport.fromJson)
          .toList(),
    );
  }

  final List<ConsumerLegalReport> reports;
}

class ConsumerCaseDraft {
  const ConsumerCaseDraft({
    required this.id,
    required this.consumerCaseId,
    required this.title,
    required this.content,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ConsumerCaseDraft.fromJson(Map<String, dynamic> json) {
    return ConsumerCaseDraft(
      id: json['id'] as String,
      consumerCaseId: json['consumerCaseId'] as String? ?? '',
      title: json['title'] as String? ?? 'Draft',
      content: json['content'] as String? ?? '',
      status: json['status'] as String? ?? 'DRAFT',
      createdAt: _parseDateTime(json['createdAt']),
      updatedAt: _parseDateTime(json['updatedAt']),
    );
  }

  final String id;
  final String consumerCaseId;
  final String title;
  final String content;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

class ConsumerCaseMessage {
  const ConsumerCaseMessage({
    required this.id,
    required this.consumerCaseId,
    required this.direction,
    required this.body,
    this.subject,
    required this.createdAt,
  });

  factory ConsumerCaseMessage.fromJson(Map<String, dynamic> json) {
    return ConsumerCaseMessage(
      id: json['id'] as String,
      consumerCaseId: json['consumerCaseId'] as String? ?? '',
      direction: json['direction'] as String? ?? 'INBOUND',
      subject: json['subject'] as String?,
      body: json['body'] as String? ?? '',
      createdAt: _parseDateTime(json['createdAt']),
    );
  }

  final String id;
  final String consumerCaseId;
  final String direction;
  final String? subject;
  final String body;
  final DateTime? createdAt;

  bool get isInbound => direction.toUpperCase() == 'INBOUND';
}

class ConsumerCasePayment {
  const ConsumerCasePayment({
    required this.id,
    required this.consumerCaseId,
    required this.amount,
    required this.currency,
    required this.status,
    this.description,
    required this.createdAt,
  });

  factory ConsumerCasePayment.fromJson(Map<String, dynamic> json) {
    return ConsumerCasePayment(
      id: json['id'] as String,
      consumerCaseId: json['consumerCaseId'] as String? ?? '',
      amount: _parseAmount(json['amount']),
      currency: json['currency'] as String? ?? 'USD',
      status: json['status'] as String? ?? 'PENDING',
      description: json['description'] as String?,
      createdAt: _parseDateTime(json['createdAt']),
    );
  }

  final String id;
  final String consumerCaseId;
  final double amount;
  final String currency;
  final String status;
  final String? description;
  final DateTime? createdAt;
}

class FollowUpQuestion {
  const FollowUpQuestion({
    required this.question,
    required this.answerType,
    this.options = const [],
  });

  factory FollowUpQuestion.fromJson(Map<String, dynamic> json) {
    final optionsRaw = json['options'] as List<dynamic>? ?? [];
    return FollowUpQuestion(
      question: json['question'] as String? ?? '',
      answerType: json['answerType'] as String? ?? 'yes_no',
      options: optionsRaw.map((item) => item.toString()).toList(),
    );
  }

  final String question;
  final String answerType;
  final List<String> options;
}

class IssueCheckerClassifyResult {
  const IssueCheckerClassifyResult({
    required this.issueType,
    required this.suggestedTitle,
    required this.urgencyLevel,
    required this.confidence,
    this.parties,
    this.suggestedClientName,
    this.followUpQuestions = const [],
    this.suggestedOutcomes = const [],
    this.matterProfile,
    this.matterGraph,
    this.matterTaskGraph,
  });

  factory IssueCheckerClassifyResult.fromJson(Map<String, dynamic> json) {
    final followUpRaw = json['followUpQuestions'] as List<dynamic>? ?? [];
    final outcomesRaw = json['suggestedOutcomes'] as List<dynamic>? ?? [];
    return IssueCheckerClassifyResult(
      issueType: json['issueType'] as String? ?? 'Other',
      suggestedTitle: json['suggestedTitle'] as String? ?? '',
      urgencyLevel: json['urgencyLevel'] as String? ?? 'MEDIUM',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      parties: json['parties'] as String?,
      suggestedClientName: json['suggestedClientName'] as String?,
      followUpQuestions: followUpRaw
          .whereType<Map<String, dynamic>>()
          .map(FollowUpQuestion.fromJson)
          .where((item) => item.question.isNotEmpty)
          .toList(),
      suggestedOutcomes: outcomesRaw.map((item) => item.toString()).toList(),
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      matterTaskGraph: json['matterTaskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(json['matterTaskGraph'] as Map<String, dynamic>)
          : null,
    );
  }

  final String issueType;
  final String suggestedTitle;
  final String urgencyLevel;
  final double confidence;
  final String? parties;
  final String? suggestedClientName;
  final List<FollowUpQuestion> followUpQuestions;
  final List<String> suggestedOutcomes;
  final MatterProfile? matterProfile;
  final MatterGraph? matterGraph;
  final MatterTaskGraph? matterTaskGraph;
}

class WinProbability {
  const WinProbability({
    required this.low,
    required this.mid,
    required this.high,
  });

  factory WinProbability.fromJson(Map<String, dynamic> json) {
    return WinProbability(
      low: _parseAmount(json['low']),
      mid: _parseAmount(json['mid']),
      high: _parseAmount(json['high']),
    );
  }

  final double low;
  final double mid;
  final double high;
}

class ConsumerCaseCreateResult {
  const ConsumerCaseCreateResult({
    required this.id,
    required this.issueType,
    required this.title,
    required this.countryCode,
  });

  factory ConsumerCaseCreateResult.fromJson(Map<String, dynamic> json) {
    return ConsumerCaseCreateResult(
      id: json['id'] as String? ?? '',
      issueType: json['issueType'] as String? ?? '',
      title: json['title'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '',
    );
  }

  final String id;
  final String issueType;
  final String title;
  final String countryCode;
}

class OutcomeOptionsResult {
  const OutcomeOptionsResult({required this.options});

  factory OutcomeOptionsResult.fromJson(Map<String, dynamic> json) {
    final raw = json['options'] as List<dynamic>? ?? [];
    return OutcomeOptionsResult(
      options: raw.map((e) => e.toString()).toList(),
    );
  }

  final List<String> options;
}

class IssueCheckerTeaserResult {
  const IssueCheckerTeaserResult({
    required this.anonymousSessionId,
    required this.detectedIssueType,
    required this.suggestedTitle,
    required this.teaserMarkdown,
    required this.keyBullets,
    required this.requiresLawyer,
    required this.disclaimer,
    this.winProbability,
    this.matterProfile,
    this.matterGraph,
    this.matterTaskGraph,
  });

  factory IssueCheckerTeaserResult.fromJson(Map<String, dynamic> json) {
    final bulletsRaw = json['keyBullets'] as List<dynamic>? ?? [];
    final winProbRaw = json['winProbability'] as Map<String, dynamic>?;
    return IssueCheckerTeaserResult(
      anonymousSessionId: json['anonymousSessionId'] as String? ?? '',
      detectedIssueType: json['detectedIssueType'] as String? ?? '',
      suggestedTitle: json['suggestedTitle'] as String? ?? '',
      teaserMarkdown: json['teaserMarkdown'] as String? ?? '',
      keyBullets: bulletsRaw.map((item) => item.toString()).toList(),
      requiresLawyer: json['requiresLawyer'] as bool? ?? false,
      disclaimer: json['disclaimer'] as String? ?? '',
      winProbability:
          winProbRaw != null ? WinProbability.fromJson(winProbRaw) : null,
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      matterTaskGraph: json['matterTaskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(
              json['matterTaskGraph'] as Map<String, dynamic>)
          : null,
    );
  }

  final String anonymousSessionId;
  final String detectedIssueType;
  final String suggestedTitle;
  final String teaserMarkdown;
  final List<String> keyBullets;
  final bool requiresLawyer;
  final String disclaimer;
  final WinProbability? winProbability;
  final MatterProfile? matterProfile;
  final MatterGraph? matterGraph;
  final MatterTaskGraph? matterTaskGraph;

  String get inferredRiskLevel {
    if (requiresLawyer) return 'HIGH';
    if (keyBullets.length > 3) return 'MEDIUM';
    return 'LOW';
  }
}

class IssueCheckerPreviewResult {
  const IssueCheckerPreviewResult({
    required this.caseId,
    required this.outputMarkdown,
    required this.riskLevel,
    required this.disclaimer,
    this.creditsRemaining,
    this.requiresLawyerReview,
    this.leadId,
    this.winProbability,
    this.matterProfile,
    this.matterGraph,
    this.matterTaskGraph,
  });

  factory IssueCheckerPreviewResult.fromJson(Map<String, dynamic> json) {
    final report = json['report'] as Map<String, dynamic>?;
    final lead = json['lead'] as Map<String, dynamic>?;
    final winProbRaw = (json['winProbability'] ?? report?['winProbability'])
        as Map<String, dynamic>?;
    return IssueCheckerPreviewResult(
      caseId: json['caseId'] as String? ?? '',
      outputMarkdown: report?['contentMarkdown'] as String? ??
          json['outputMarkdown'] as String? ??
          '',
      riskLevel: report?['riskLevel'] as String? ??
          json['riskLevel'] as String? ??
          'UNKNOWN',
      disclaimer: json['disclaimer'] as String? ?? '',
      creditsRemaining: _parseInt(json['creditsRemaining']),
      requiresLawyerReview: report?['requiresLawyer'] as bool?,
      leadId: json['leadId'] as String? ?? lead?['id'] as String?,
      winProbability:
          winProbRaw != null ? WinProbability.fromJson(winProbRaw) : null,
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(
              json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      matterTaskGraph: json['matterTaskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(
              json['matterTaskGraph'] as Map<String, dynamic>)
          : null,
    );
  }

  final String caseId;
  final String outputMarkdown;
  final String riskLevel;
  final String disclaimer;
  final int? creditsRemaining;
  final bool? requiresLawyerReview;
  final String? leadId;
  final WinProbability? winProbability;
  final MatterProfile? matterProfile;
  final MatterGraph? matterGraph;
  final MatterTaskGraph? matterTaskGraph;
}

class ConsumerDocument {
  const ConsumerDocument({
    required this.id,
    required this.consumerCaseId,
    required this.fileName,
    required this.fileUrl,
    this.mimeType,
    this.fileSizeBytes,
    this.documentType,
    this.ocrStatus,
    this.aiSummary,
    this.createdAt,
  });

  factory ConsumerDocument.fromJson(Map<String, dynamic> json) {
    return ConsumerDocument(
      id: json['id'] as String,
      consumerCaseId: json['consumerCaseId'] as String? ?? '',
      fileName: json['fileName'] as String,
      fileUrl: json['fileUrl'] as String? ?? '',
      mimeType: json['mimeType'] as String?,
      fileSizeBytes: _parseInt(json['fileSizeBytes']),
      documentType: json['documentType'] as String?,
      ocrStatus: json['ocrStatus'] as String?,
      aiSummary: json['aiSummary'] as String?,
      createdAt: _parseDateTime(json['createdAt']),
    );
  }

  final String id;
  final String consumerCaseId;
  final String fileName;
  final String fileUrl;
  final String? mimeType;
  final int? fileSizeBytes;
  final String? documentType;
  final String? ocrStatus;
  final String? aiSummary;
  final DateTime? createdAt;

  bool get isOcrProcessing {
    final status = ocrStatus?.toUpperCase();
    return status == 'PENDING' || status == 'PROCESSING';
  }
}

class ConsumerDocumentUploadResult {
  const ConsumerDocumentUploadResult({
    required this.document,
    required this.ocrStatus,
  });

  factory ConsumerDocumentUploadResult.fromJson(Map<String, dynamic> json) {
    final ocrJob = json['ocrJob'] as Map<String, dynamic>?;
    return ConsumerDocumentUploadResult(
      document: ConsumerDocument.fromJson(
        json['document'] as Map<String, dynamic>,
      ),
      ocrStatus: ocrJob?['status'] as String? ?? 'QUEUED',
    );
  }

  final ConsumerDocument document;
  final String ocrStatus;
}

class FirmMatter {
  const FirmMatter({
    required this.id,
    required this.title,
    required this.status,
    required this.countryCode,
    required this.practiceArea,
    required this.matterType,
    this.jurisdiction,
    this.clientName,
    this.clientId,
    this.updatedAt,
  });

  factory FirmMatter.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    return FirmMatter(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String,
      countryCode: json['countryCode'] as String? ?? '',
      practiceArea: json['practiceArea'] as String? ?? '',
      matterType: json['matterType'] as String? ?? '',
      jurisdiction: json['jurisdiction'] as String?,
      clientName: client?['name'] as String?,
      clientId: client?['id'] as String? ?? json['clientId'] as String?,
      updatedAt: _parseDateTime(json['updatedAt']),
    );
  }

  final String id;
  final String title;
  final String status;
  final String countryCode;
  final String practiceArea;
  final String matterType;
  final String? jurisdiction;
  final String? clientName;
  final String? clientId;
  final DateTime? updatedAt;
}

class MatterDocument {
  const MatterDocument({
    required this.id,
    required this.fileName,
    this.fileUrl,
    this.createdAt,
  });

  factory MatterDocument.fromJson(Map<String, dynamic> json) {
    return MatterDocument(
      id: json['id'] as String,
      fileName: json['fileName'] as String,
      fileUrl: json['fileUrl'] as String?,
      createdAt: _parseDateTime(json['createdAt']),
    );
  }

  final String id;
  final String fileName;
  final String? fileUrl;
  final DateTime? createdAt;
}

class MatterTimelineEvent {
  const MatterTimelineEvent({
    required this.id,
    required this.title,
    required this.eventType,
    required this.occurredAt,
    this.description,
  });

  factory MatterTimelineEvent.fromJson(Map<String, dynamic> json) {
    return MatterTimelineEvent(
      id: json['id'] as String,
      title: json['title'] as String,
      eventType: json['eventType'] as String? ?? '',
      occurredAt: _parseDateTime(json['occurredAt']) ?? DateTime.now(),
      description: json['description'] as String?,
    );
  }

  final String id;
  final String title;
  final String eventType;
  final DateTime occurredAt;
  final String? description;
}

class MatterDetail {
  const MatterDetail({
    required this.id,
    required this.title,
    required this.status,
    this.documents = const [],
    this.timelineEvents = const [],
    this.countryCode,
    this.jurisdiction,
    this.practiceArea,
    this.stage,
    this.clientId,
    this.clientName,
    this.clientEmail,
    this.clientPhone,
    this.factsSummary,
    this.matterProfile,
    this.matterGraph,
    this.matterTaskGraph,
  });

  factory MatterDetail.fromJson(Map<String, dynamic> json) {
    final documentsRaw = json['documents'] as List<dynamic>? ?? [];
    final timelineRaw = json['timelineEvents'] as List<dynamic>? ?? [];
    final client = json['client'] as Map<String, dynamic>?;
    return MatterDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String,
      documents: documentsRaw
          .whereType<Map<String, dynamic>>()
          .map(MatterDocument.fromJson)
          .toList(),
      timelineEvents: timelineRaw
          .whereType<Map<String, dynamic>>()
          .map(MatterTimelineEvent.fromJson)
          .toList(),
      countryCode: json['countryCode'] as String?,
      jurisdiction: json['jurisdiction'] as String?,
      practiceArea: json['practiceArea'] as String?,
      stage: json['stage'] as String?,
      clientId: json['clientId'] as String?,
      clientName: client?['name'] as String?,
      clientEmail: client?['email'] as String?,
      clientPhone: client?['phone'] as String?,
      factsSummary: json['factsSummary'] as String?,
      matterProfile: json['matterProfile'] is Map<String, dynamic>
          ? MatterProfile.fromJson(json['matterProfile'] as Map<String, dynamic>)
          : null,
      matterGraph: json['matterGraph'] is Map<String, dynamic>
          ? MatterGraph.fromJson(json['matterGraph'] as Map<String, dynamic>)
          : null,
      matterTaskGraph: json['matterTaskGraph'] is Map<String, dynamic>
          ? MatterTaskGraph.fromJson(json['matterTaskGraph'] as Map<String, dynamic>)
          : null,
    );
  }

  final String id;
  final String title;
  final String status;
  final List<MatterDocument> documents;
  final List<MatterTimelineEvent> timelineEvents;
  final String? countryCode;
  final String? jurisdiction;
  final String? practiceArea;
  final String? stage;
  final String? clientId;
  final String? clientName;
  final String? clientEmail;
  final String? clientPhone;
  final String? factsSummary;
  final MatterProfile? matterProfile;
  final MatterGraph? matterGraph;
  final MatterTaskGraph? matterTaskGraph;
}

class ClientContactPerson {
  const ClientContactPerson({
    required this.name,
    this.role,
    this.email,
    this.phone,
  });

  factory ClientContactPerson.fromJson(Map<String, dynamic> json) {
    return ClientContactPerson(
      name: json['name'] as String? ?? '',
      role: json['role'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
    );
  }

  final String name;
  final String? role;
  final String? email;
  final String? phone;
}

class FirmClient {
  const FirmClient({
    required this.id,
    required this.name,
    this.clientCode,
    this.email,
    this.phone,
    this.type,
    this.countryCode,
    this.updatedAt,
  });

  factory FirmClient.fromJson(Map<String, dynamic> json) {
    return FirmClient(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Unnamed client',
      clientCode: json['clientCode'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      type: json['type'] as String?,
      countryCode: json['countryCode'] as String?,
      updatedAt: _parseDateTime(json['updatedAt']),
    );
  }

  final String id;
  final String name;
  final String? clientCode;
  final String? email;
  final String? phone;
  final String? type;
  final String? countryCode;
  final DateTime? updatedAt;
}

class FirmClientDetail extends FirmClient {
  const FirmClientDetail({
    required super.id,
    required super.name,
    super.clientCode,
    super.email,
    super.phone,
    super.type,
    super.countryCode,
    super.updatedAt,
    this.matters = const [],
    this.contactPeople = const [],
  });

  factory FirmClientDetail.fromJson(Map<String, dynamic> json) {
    final mattersRaw = json['matters'] as List<dynamic>? ?? [];
    final contactRaw = json['contactPeople'] as List<dynamic>? ?? [];
    return FirmClientDetail(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Unnamed client',
      clientCode: json['clientCode'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      type: json['type'] as String?,
      countryCode: json['countryCode'] as String?,
      updatedAt: _parseDateTime(json['updatedAt']),
      matters: mattersRaw
          .whereType<Map<String, dynamic>>()
          .map(FirmMatter.fromJson)
          .toList(),
      contactPeople: contactRaw
          .whereType<Map<String, dynamic>>()
          .map(ClientContactPerson.fromJson)
          .toList(),
    );
  }

  final List<FirmMatter> matters;
  final List<ClientContactPerson> contactPeople;
}

class FirmInvoice {
  const FirmInvoice({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    this.invoiceNumber,
    this.clientId,
    this.matterId,
    this.description,
    this.billingModel,
    this.dueDate,
    this.createdAt,
    this.paymentLink,
  });

  factory FirmInvoice.fromJson(Map<String, dynamic> json) {
    final meta = json['metadata'] as Map<String, dynamic>?;
    return FirmInvoice(
      id: json['id'] as String,
      invoiceNumber: json['invoiceNumber'] as String?,
      amount: _parseAmount(json['amount']),
      currency: json['currency'] as String? ?? 'USD',
      status: json['status'] as String? ?? 'PENDING',
      clientId: json['clientId'] as String?,
      matterId: json['matterId'] as String? ?? meta?['matterId'] as String?,
      description: meta?['description'] as String?,
      billingModel: json['billingModel'] as String?,
      dueDate: _parseDateTime(json['dueDate']),
      createdAt: _parseDateTime(json['createdAt']),
      paymentLink: json['paymentLink'] as String?,
    );
  }

  final String id;
  final String? invoiceNumber;
  final double amount;
  final String currency;
  final String status;
  final String? clientId;
  final String? matterId;
  final String? description;
  final String? billingModel;
  final DateTime? dueDate;
  final DateTime? createdAt;
  final String? paymentLink;
}

class MarketplaceLead {
  const MarketplaceLead({
    required this.id,
    required this.issueType,
    required this.countryCode,
    required this.status,
    this.jurisdiction,
    this.description,
    this.urgencyLevel,
    this.createdAt,
    this.convertedMatterId,
  });

  factory MarketplaceLead.fromJson(Map<String, dynamic> json) {
    return MarketplaceLead(
      id: json['id'] as String? ?? json['leadId'] as String? ?? '',
      issueType: json['issueType'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN',
      jurisdiction: json['jurisdiction'] as String?,
      description: json['description'] as String? ?? json['summary'] as String?,
      urgencyLevel: json['urgencyLevel'] as String?,
      createdAt: _parseDateTime(json['createdAt']),
      convertedMatterId: json['convertedMatterId'] as String?,
    );
  }

  final String id;
  final String issueType;
  final String countryCode;
  final String status;
  final String? jurisdiction;
  final String? description;
  final String? urgencyLevel;
  final DateTime? createdAt;
  final String? convertedMatterId;
}

class LawyerReviewRequest {
  const LawyerReviewRequest({
    required this.id,
    required this.status,
    this.consumerCaseId,
  });

  factory LawyerReviewRequest.fromJson(Map<String, dynamic> json) {
    return LawyerReviewRequest(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'PENDING',
      consumerCaseId: json['consumerCaseId'] as String?,
    );
  }

  final String id;
  final String status;
  final String? consumerCaseId;
}

class LawyerTask {
  const LawyerTask({
    required this.id,
    required this.title,
    required this.status,
    required this.priority,
    this.matterId,
    this.dueDate,
  });

  factory LawyerTask.fromJson(Map<String, dynamic> json) {
    return LawyerTask(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String? ?? 'TODO',
      priority: json['priority'] as String? ?? 'MEDIUM',
      matterId: json['matterId'] as String?,
      dueDate: _parseDateTime(json['dueDate']),
    );
  }

  final String id;
  final String title;
  final String status;
  final String priority;
  final String? matterId;
  final DateTime? dueDate;
}

class AppAlert {
  const AppAlert({
    required this.id,
    required this.title,
    required this.status,
    this.message,
    this.severity,
  });

  factory AppAlert.fromJson(Map<String, dynamic> json) {
    return AppAlert(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String,
      message: json['message'] as String?,
      severity: json['severity'] as String?,
    );
  }

  final String id;
  final String title;
  final String status;
  final String? message;
  final String? severity;
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    this.body,
    this.type,
    this.isRead = false,
    this.createdAt,
    this.metadata,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      type: json['type'] as String?,
      isRead: json['isRead'] as bool? ?? false,
      createdAt: _parseDateTime(json['createdAt']),
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  final String id;
  final String title;
  final String? body;
  final String? type;
  final bool isRead;
  final DateTime? createdAt;
  final Map<String, dynamic>? metadata;
}

class AppPayment {
  const AppPayment({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    this.purpose,
  });

  factory AppPayment.fromJson(Map<String, dynamic> json) {
    return AppPayment(
      id: json['id'] as String,
      amount: _parseAmount(json['amount']),
      currency: json['currency'] as String? ?? 'USD',
      status: json['status'] as String? ?? 'PENDING',
      purpose: json['purpose'] as String?,
    );
  }

  final String id;
  final double amount;
  final String currency;
  final String status;
  final String? purpose;
}

class AppTimeEntry {
  const AppTimeEntry({
    required this.id,
    required this.minutes,
    required this.status,
    this.narrative,
  });

  factory AppTimeEntry.fromJson(Map<String, dynamic> json) {
    return AppTimeEntry(
      id: json['id'] as String,
      minutes: _parseInt(json['minutes']),
      status: json['status'] as String? ?? 'PENDING',
      narrative: json['narrative'] as String?,
    );
  }

  final String id;
  final int minutes;
  final String status;
  final String? narrative;
}

class PricingPlan {
  const PricingPlan({
    required this.countryCode,
    required this.userType,
    required this.planId,
    required this.currency,
    required this.amount,
    required this.aiCredits,
    required this.features,
  });

  factory PricingPlan.fromJson(Map<String, dynamic> json) {
    final featuresRaw = json['features'];
    return PricingPlan(
      countryCode: json['countryCode'] as String? ?? 'US',
      userType: json['userType'] as String? ?? 'CONSUMER',
      planId: json['planId'] as String? ?? '',
      currency: json['currency'] as String? ?? 'USD',
      amount: _parseAmount(json['amount']),
      aiCredits: _parseInt(json['aiCredits']),
      features: featuresRaw is Map<String, dynamic>
          ? Map<String, dynamic>.from(featuresRaw)
          : const {},
    );
  }

  final String countryCode;
  final String userType;
  final String planId;
  final String currency;
  final double amount;
  final int aiCredits;
  final Map<String, dynamic> features;

  static List<PricingPlan> fallbackForCountry(String countryCode) {
    return fallbackConsumerPlans(countryCode);
  }
}

class CreditPack {
  const CreditPack({
    required this.packId,
    required this.label,
    required this.description,
    required this.credits,
    required this.countryCode,
    required this.currency,
    required this.amount,
  });

  factory CreditPack.fromJson(Map<String, dynamic> json) {
    return CreditPack(
      packId: json['packId'] as String? ?? '',
      label: json['label'] as String? ?? '',
      description: json['description'] as String? ?? '',
      credits: _parseInt(json['credits']),
      countryCode: json['countryCode'] as String? ?? 'US',
      currency: json['currency'] as String? ?? 'USD',
      amount: _parseAmount(json['amount']),
    );
  }

  final String packId;
  final String label;
  final String description;
  final int credits;
  final String countryCode;
  final String currency;
  final double amount;
}

class CreditTopupCheckout {
  const CreditTopupCheckout({
    required this.paymentId,
    required this.packId,
    required this.credits,
    required this.amount,
    required this.currency,
    required this.checkoutUrl,
    required this.provider,
    required this.status,
    this.clientSecret,
  });

  factory CreditTopupCheckout.fromJson(Map<String, dynamic> json) {
    return CreditTopupCheckout(
      paymentId: json['paymentId'] as String? ?? '',
      packId: json['packId'] as String? ?? '',
      credits: _parseInt(json['credits']),
      amount: _parseAmount(json['amount']),
      currency: json['currency'] as String? ?? 'USD',
      checkoutUrl: json['checkoutUrl'] as String? ?? '',
      provider: json['provider'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      clientSecret: json['clientSecret'] as String?,
    );
  }

  final String paymentId;
  final String packId;
  final int credits;
  final double amount;
  final String currency;
  final String checkoutUrl;
  final String provider;
  final String status;
  final String? clientSecret;
}

class SubscriptionCheckout {
  const SubscriptionCheckout({
    required this.checkoutSessionId,
    required this.checkoutUrl,
    required this.status,
    required this.planId,
    required this.amount,
    required this.currency,
    this.subscriptionId,
    this.provider,
  });

  factory SubscriptionCheckout.fromJson(Map<String, dynamic> json) {
    return SubscriptionCheckout(
      checkoutSessionId: json['checkoutSessionId'] as String? ?? '',
      checkoutUrl: json['checkoutUrl'] as String? ?? '',
      status: json['status'] as String? ?? 'CHECKOUT_PENDING',
      planId: json['planId'] as String? ?? '',
      amount: _parseAmount(json['amount']),
      currency: json['currency'] as String? ?? 'USD',
      subscriptionId: json['subscriptionId'] as String?,
      provider: json['provider'] as String?,
    );
  }

  final String checkoutSessionId;
  final String checkoutUrl;
  final String status;
  final String planId;
  final double amount;
  final String currency;
  final String? subscriptionId;
  final String? provider;
}

class PaymentIntentResult {
  const PaymentIntentResult({
    required this.paymentId,
    required this.status,
    this.checkoutUrl,
    this.clientSecret,
    this.provider,
  });

  factory PaymentIntentResult.fromJson(Map<String, dynamic> json) {
    final payment = json['payment'] as Map<String, dynamic>?;
    final intent = json['intent'] as Map<String, dynamic>?;
    return PaymentIntentResult(
      paymentId: payment?['id'] as String? ?? json['paymentId'] as String? ?? '',
      status: payment?['status'] as String? ??
          intent?['status'] as String? ??
          json['status'] as String? ??
          'PENDING',
      checkoutUrl: json['checkoutUrl'] as String? ?? intent?['checkoutUrl'] as String?,
      clientSecret: intent?['clientSecret'] as String?,
      provider: intent?['provider'] as String? ?? json['provider'] as String?,
    );
  }

  final String paymentId;
  final String status;
  final String? checkoutUrl;
  final String? clientSecret;
  final String? provider;
}

class LawyerReviewPricing {
  const LawyerReviewPricing({
    required this.countryCode,
    required this.price,
    required this.currency,
  });

  factory LawyerReviewPricing.fromPlan(PricingPlan plan, String countryCode) {
    final fallback = LawyerReviewPricing.fallback(countryCode);
    return LawyerReviewPricing(
      countryCode: countryCode.toUpperCase(),
      price: fallback.price,
      currency: plan.currency.isNotEmpty ? plan.currency : fallback.currency,
    );
  }

  factory LawyerReviewPricing.fallback(String countryCode) {
    final code = countryCode.toUpperCase();
    switch (code) {
      case 'IN':
        return LawyerReviewPricing(
          countryCode: code,
          price: 2499,
          currency: 'INR',
        );
      case 'GB':
        return LawyerReviewPricing(
          countryCode: code,
          price: 39,
          currency: 'GBP',
        );
      case 'KE':
        return LawyerReviewPricing(
          countryCode: code,
          price: 4999,
          currency: 'KES',
        );
      default:
        return LawyerReviewPricing(
          countryCode: code,
          price: 49,
          currency: 'USD',
        );
    }
  }

  final String countryCode;
  final double price;
  final String currency;
}

class CopilotChatResult {
  const CopilotChatResult({
    required this.message,
    this.sessionId,
    this.toolName,
  });

  factory CopilotChatResult.fromJson(Map<String, dynamic> json) {
    final assistant = json['assistantMessage'] as Map<String, dynamic>?;
    return CopilotChatResult(
      message: assistant?['content'] as String? ??
          json['message'] as String? ??
          json['output'] as String? ??
          '',
      sessionId: json['sessionId'] as String?,
      toolName: json['toolName'] as String?,
    );
  }

  final String message;
  final String? sessionId;
  final String? toolName;
}

class TrainingConsent {
  const TrainingConsent({
    required this.scope,
    required this.consentStatus,
    required this.jurisdictionCountryCode,
    required this.canUseForPromptImprove,
    required this.canUseForEvaluation,
    required this.canUseForFineTuning,
    this.grantedAt,
    this.withdrawnAt,
  });

  factory TrainingConsent.fromJson(Map<String, dynamic> json) {
    return TrainingConsent(
      scope: json['scope'] as String? ?? 'USER_DOCUMENTS',
      consentStatus: json['consentStatus'] as String? ?? 'DENIED',
      jurisdictionCountryCode:
          json['jurisdictionCountryCode'] as String? ?? 'US',
      canUseForPromptImprove:
          json['canUseForPromptImprove'] as bool? ?? false,
      canUseForEvaluation: json['canUseForEvaluation'] as bool? ?? false,
      canUseForFineTuning: json['canUseForFineTuning'] as bool? ?? false,
      grantedAt: _parseDateTime(json['grantedAt']),
      withdrawnAt: _parseDateTime(json['withdrawnAt']),
    );
  }

  factory TrainingConsent.denied({required String scope}) {
    return TrainingConsent(
      scope: scope,
      consentStatus: 'DENIED',
      jurisdictionCountryCode: 'US',
      canUseForPromptImprove: false,
      canUseForEvaluation: false,
      canUseForFineTuning: false,
    );
  }

  final String scope;
  final String consentStatus;
  final String jurisdictionCountryCode;
  final bool canUseForPromptImprove;
  final bool canUseForEvaluation;
  final bool canUseForFineTuning;
  final DateTime? grantedAt;
  final DateTime? withdrawnAt;

  bool get isGranted => consentStatus == 'GRANTED';
}

class LegalResearchCitation {
  LegalResearchCitation({
    this.authorityId,
    required this.sourceName,
    required this.citation,
    this.sourceUrl,
    this.confidence,
    this.verified,
    this.sourceTier,
  });

  final String? authorityId;
  final String sourceName;
  final String citation;
  final String? sourceUrl;
  final double? confidence;
  final bool? verified;
  final String? sourceTier;

  factory LegalResearchCitation.fromJson(Map<String, dynamic> json) {
    return LegalResearchCitation(
      authorityId: json['authorityId'] as String?,
      sourceName: json['sourceName'] as String? ?? 'Legal authority',
      citation: json['citation'] as String? ?? '',
      sourceUrl: json['sourceUrl'] as String?,
      confidence: (json['confidence'] as num?)?.toDouble(),
      verified: json['verified'] as bool?,
      sourceTier: json['sourceTier'] as String?,
    );
  }
}

class SentenceAuditEntry {
  SentenceAuditEntry({
    required this.sentence,
    required this.status,
    this.authorityTitle,
  });

  final String sentence;
  final String status;
  final String? authorityTitle;

  factory SentenceAuditEntry.fromJson(Map<String, dynamic> json) {
    return SentenceAuditEntry(
      sentence: json['sentence'] as String? ?? '',
      status: json['status'] as String? ?? 'ungrounded',
      authorityTitle: json['authorityTitle'] as String?,
    );
  }
}

class LegalResearchResult {
  LegalResearchResult({
    required this.outputMarkdown,
    required this.citations,
    required this.mode,
    required this.provider,
    required this.modelName,
    required this.countryCode,
    this.jurisdiction,
    this.jurisdictionNotice,
    this.fromCache,
    this.creditsUsed,
    this.verificationStatus,
    this.sourceTierSummary,
    this.corpusEdition,
    this.requiresLawyerReview,
    this.sentenceAudit,
    this.researchMode,
    this.citationAudit,
    this.similarCases,
    this.sectionChecks,
    this.findings,
    this.propositions,
    this.dimensions,
    this.publicationState,
    this.evidencePackId,
    this.outputHash,
    this.aiOutputId,
    this.suggestedFollowUpQuestions,
    this.confidence,
    this.limitations,
    this.sourceTrace,
  });

  final String outputMarkdown;
  final List<LegalResearchCitation> citations;
  final String mode;
  final String provider;
  final String modelName;
  final String countryCode;
  final String? jurisdiction;
  final String? jurisdictionNotice;
  final bool? fromCache;
  final int? creditsUsed;
  final String? verificationStatus;
  final String? sourceTierSummary;
  final String? corpusEdition;
  final bool? requiresLawyerReview;
  final List<SentenceAuditEntry>? sentenceAudit;
  final String? researchMode;
  final CitationAuditSummary? citationAudit;
  final List<SimilarCase>? similarCases;
  final SectionChecksAudit? sectionChecks;
  final List<VerificationFinding>? findings;
  final List<VerifiedPropositionSummary>? propositions;
  final VerificationDimensions? dimensions;
  final String? publicationState;
  final String? evidencePackId;
  final String? outputHash;
  final String? aiOutputId;
  final List<String>? suggestedFollowUpQuestions;
  final String? confidence;
  final List<String>? limitations;
  final List<String>? sourceTrace;

  String get answer => outputMarkdown;

  LegalResearchResult copyWith({
    String? outputMarkdown,
    List<LegalResearchCitation>? citations,
    List<SimilarCase>? similarCases,
    SectionChecksAudit? sectionChecks,
    List<VerificationFinding>? findings,
    List<VerifiedPropositionSummary>? propositions,
    VerificationDimensions? dimensions,
    String? publicationState,
    String? aiOutputId,
    String? outputHash,
    bool? requiresLawyerReview,
  }) {
    return LegalResearchResult(
      outputMarkdown: outputMarkdown ?? this.outputMarkdown,
      citations: citations ?? this.citations,
      mode: mode,
      provider: provider,
      modelName: modelName,
      countryCode: countryCode,
      jurisdiction: jurisdiction,
      jurisdictionNotice: jurisdictionNotice,
      fromCache: fromCache,
      creditsUsed: creditsUsed,
      verificationStatus: verificationStatus,
      sourceTierSummary: sourceTierSummary,
      corpusEdition: corpusEdition,
      requiresLawyerReview: requiresLawyerReview ?? this.requiresLawyerReview,
      sentenceAudit: sentenceAudit,
      researchMode: researchMode,
      citationAudit: citationAudit,
      similarCases: similarCases ?? this.similarCases,
      sectionChecks: sectionChecks ?? this.sectionChecks,
      findings: findings ?? this.findings,
      propositions: propositions ?? this.propositions,
      dimensions: dimensions ?? this.dimensions,
      publicationState: publicationState ?? this.publicationState,
      evidencePackId: evidencePackId,
      outputHash: outputHash ?? this.outputHash,
      aiOutputId: aiOutputId ?? this.aiOutputId,
      suggestedFollowUpQuestions: suggestedFollowUpQuestions,
      confidence: confidence,
      limitations: limitations,
      sourceTrace: sourceTrace,
    );
  }

  factory LegalResearchResult.fromJson(Map<String, dynamic> json) {
    final rawCitations = json['citations'];
    final citations = rawCitations is List
        ? rawCitations.map((c) {
            if (c is String) {
              return LegalResearchCitation(
                sourceName: c,
                citation: c,
              );
            }
            if (c is Map<String, dynamic>) {
              return LegalResearchCitation.fromJson({
                'authorityId': c['authorityId'],
                'sourceName': c['sourceName'] ??
                    c['title'] ??
                    c['citation'] ??
                    c['source'] ??
                    'Legal authority',
                'citation': c['citation'] ?? c['source'] ?? c['title'] ?? '',
                'sourceUrl': c['sourceUrl'] ?? c['url'],
                'confidence': c['confidence'],
                'verified': c['verified'],
                'sourceTier': c['sourceTier'],
              });
            }
            return LegalResearchCitation(sourceName: '$c', citation: '$c');
          }).toList()
        : <LegalResearchCitation>[];

    final auditRaw = json['sentenceAudit'] as List<dynamic>?;
    final sentenceAudit = auditRaw
        ?.whereType<Map<String, dynamic>>()
        .map(SentenceAuditEntry.fromJson)
        .toList();

    final citationAuditRaw = json['citationAudit'];
    final sectionChecksRaw = json['sectionChecks'];
    final dimensionsRaw = json['dimensions'];

    return LegalResearchResult(
      outputMarkdown: json['outputMarkdown'] as String? ??
          json['answer'] as String? ??
          json['draftMarkdown'] as String? ??
          '',
      citations: citations,
      mode: json['mode'] as String? ?? '',
      provider: json['provider'] as String? ?? '',
      modelName: json['modelName'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '',
      jurisdiction: json['jurisdiction'] as String?,
      jurisdictionNotice: json['jurisdictionNotice'] as String?,
      fromCache: json['fromCache'] as bool?,
      creditsUsed: (json['creditsUsed'] as num?)?.toInt(),
      verificationStatus: json['verificationStatus'] as String?,
      sourceTierSummary: json['sourceTierSummary'] as String?,
      corpusEdition: json['corpusEdition'] as String?,
      requiresLawyerReview: json['requiresLawyerReview'] as bool?,
      sentenceAudit: sentenceAudit,
      researchMode: json['researchMode'] as String?,
      citationAudit: citationAuditRaw is Map<String, dynamic>
          ? CitationAuditSummary.fromJson(citationAuditRaw)
          : null,
      similarCases: (json['similarCases'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(SimilarCase.fromJson)
          .toList(),
      sectionChecks: sectionChecksRaw is Map<String, dynamic>
          ? SectionChecksAudit.fromJson(sectionChecksRaw)
          : null,
      findings: (json['findings'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(VerificationFinding.fromJson)
          .toList(),
      propositions: (json['propositions'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(VerifiedPropositionSummary.fromJson)
          .toList(),
      dimensions: dimensionsRaw is Map<String, dynamic>
          ? VerificationDimensions.fromJson(dimensionsRaw)
          : null,
      publicationState: json['publicationState'] as String?,
      evidencePackId: json['evidencePackId'] as String?,
      outputHash: json['outputHash'] as String?,
      aiOutputId: json['aiOutputId'] as String?,
      suggestedFollowUpQuestions:
          (json['suggestedFollowUpQuestions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList(),
      confidence: json['confidence'] as String?,
      limitations: (json['limitations'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      sourceTrace: (json['sourceTrace'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
    );
  }

  /// Parse async research job result payload (same normalizer as web).
  static LegalResearchResult? fromJobResult(Map<String, dynamic>? result) {
    if (result == null) return null;
    final markdown = (result['draftMarkdown'] as String?)?.trim().isNotEmpty == true
            ? result['draftMarkdown'] as String
            : (result['outputMarkdown'] as String?)?.trim().isNotEmpty == true
                ? result['outputMarkdown'] as String
                : (result['answer'] as String?) ?? '';
    if (markdown.trim().isEmpty) return null;
    return LegalResearchResult.fromJson({
      ...result,
      'outputMarkdown': markdown,
    });
  }
}

class ResearchHistoryItem {
  const ResearchHistoryItem({
    required this.id,
    required this.outputMarkdown,
    required this.preview,
    required this.createdAt,
    required this.citationCount,
    this.inputQuery,
    this.verified,
    this.jurisdiction,
    this.legalDomain,
    this.sourceQuality,
    this.citationAudit,
    this.similarCases,
    this.sectionChecks,
  });

  final String id;
  final String? inputQuery;
  final String outputMarkdown;
  final String preview;
  final String createdAt;
  final int citationCount;
  final bool? verified;
  final String? jurisdiction;
  final String? legalDomain;
  final String? sourceQuality;
  final CitationAuditSummary? citationAudit;
  final List<SimilarCase>? similarCases;
  final SectionChecksAudit? sectionChecks;

  factory ResearchHistoryItem.fromJson(Map<String, dynamic> json) {
    return ResearchHistoryItem(
      id: json['id'] as String? ?? '',
      inputQuery: json['inputQuery'] as String?,
      outputMarkdown: json['outputMarkdown'] as String? ?? '',
      preview: json['preview'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      citationCount: (json['citationCount'] as num?)?.toInt() ?? 0,
      verified: json['verified'] as bool?,
      jurisdiction: json['jurisdiction'] as String?,
      legalDomain: json['legalDomain'] as String?,
      sourceQuality: json['sourceQuality'] as String?,
      citationAudit: json['citationAudit'] is Map<String, dynamic>
          ? CitationAuditSummary.fromJson(
              json['citationAudit'] as Map<String, dynamic>,
            )
          : null,
      similarCases: (json['similarCases'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(SimilarCase.fromJson)
          .toList(),
      sectionChecks: json['sectionChecks'] is Map<String, dynamic>
          ? SectionChecksAudit.fromJson(
              json['sectionChecks'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class ResearchEnrichResponse {
  const ResearchEnrichResponse({
    required this.aiOutputId,
    required this.answer,
    required this.similarCases,
    required this.creditsCharged,
    required this.providerCostUsd,
    required this.mode,
    required this.sectionsAdded,
    required this.casesAdded,
    this.sectionChecks,
    this.warning,
    this.citations,
    this.findings,
    this.propositions,
    this.dimensions,
    this.publicationState,
    this.outputHash,
    this.requiresLawyerReview,
  });

  final String aiOutputId;
  final String answer;
  final List<SimilarCase> similarCases;
  final SectionChecksAudit? sectionChecks;
  final int creditsCharged;
  final double providerCostUsd;
  final String mode;
  final List<String> sectionsAdded;
  final int casesAdded;
  final String? warning;
  final List<LegalResearchCitation>? citations;
  final List<VerificationFinding>? findings;
  final List<VerifiedPropositionSummary>? propositions;
  final VerificationDimensions? dimensions;
  final String? publicationState;
  final String? outputHash;
  final bool? requiresLawyerReview;

  factory ResearchEnrichResponse.fromJson(Map<String, dynamic> json) {
    return ResearchEnrichResponse(
      aiOutputId: json['aiOutputId'] as String? ?? '',
      answer: json['answer'] as String? ?? '',
      similarCases: (json['similarCases'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(SimilarCase.fromJson)
              .toList() ??
          const [],
      sectionChecks: json['sectionChecks'] is Map<String, dynamic>
          ? SectionChecksAudit.fromJson(
              json['sectionChecks'] as Map<String, dynamic>,
            )
          : null,
      creditsCharged: (json['creditsCharged'] as num?)?.toInt() ?? 0,
      providerCostUsd: (json['providerCostUsd'] as num?)?.toDouble() ?? 0,
      mode: json['mode'] as String? ?? 'both',
      sectionsAdded: (json['sectionsAdded'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      casesAdded: (json['casesAdded'] as num?)?.toInt() ?? 0,
      warning: json['warning'] as String?,
      citations: (json['citations'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(LegalResearchCitation.fromJson)
          .toList(),
      findings: (json['findings'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(VerificationFinding.fromJson)
          .toList(),
      propositions: (json['propositions'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(VerifiedPropositionSummary.fromJson)
          .toList(),
      dimensions: json['dimensions'] is Map<String, dynamic>
          ? VerificationDimensions.fromJson(
              json['dimensions'] as Map<String, dynamic>,
            )
          : null,
      publicationState: json['publicationState'] as String?,
      outputHash: json['outputHash'] as String?,
      requiresLawyerReview: json['requiresLawyerReview'] as bool?,
    );
  }
}

// ---------------------------------------------------------------------------
// Document Review Models
// ---------------------------------------------------------------------------

class DocumentReviewParty {
  DocumentReviewParty({required this.name, required this.role});
  final String name;
  final String role;

  factory DocumentReviewParty.fromJson(Map<String, dynamic> json) =>
      DocumentReviewParty(
        name: json['name'] as String? ?? '',
        role: json['role'] as String? ?? '',
      );
}

class DocumentReviewKeyDate {
  DocumentReviewKeyDate({required this.date, required this.description});
  final String date;
  final String description;

  factory DocumentReviewKeyDate.fromJson(Map<String, dynamic> json) =>
      DocumentReviewKeyDate(
        date: json['date'] as String? ?? '',
        description: json['description'] as String? ?? '',
      );
}

class DocumentReviewPro {
  DocumentReviewPro({required this.title, required this.detail});
  final String title;
  final String detail;

  factory DocumentReviewPro.fromJson(Map<String, dynamic> json) =>
      DocumentReviewPro(
        title: json['title'] as String? ?? '',
        detail: json['detail'] as String? ?? '',
      );
}

class DocumentReviewCon {
  DocumentReviewCon({required this.title, required this.detail});
  final String title;
  final String detail;

  factory DocumentReviewCon.fromJson(Map<String, dynamic> json) =>
      DocumentReviewCon(
        title: json['title'] as String? ?? '',
        detail: json['detail'] as String? ?? '',
      );
}

class DocumentReviewRisk {
  DocumentReviewRisk({
    required this.severity,
    required this.title,
    required this.detail,
    this.legalBasis,
  });
  final String severity; // HIGH | MEDIUM | LOW
  final String title;
  final String detail;
  final String? legalBasis;

  factory DocumentReviewRisk.fromJson(Map<String, dynamic> json) =>
      DocumentReviewRisk(
        severity: json['severity'] as String? ?? 'LOW',
        title: json['title'] as String? ?? '',
        detail: json['detail'] as String? ?? '',
        legalBasis: json['legalBasis'] as String?,
      );
}

class DocumentReviewClause {
  DocumentReviewClause({
    required this.title,
    required this.originalText,
    required this.analysis,
    required this.flagged,
  });
  final String title;
  final String originalText;
  final String analysis;
  final bool flagged;

  factory DocumentReviewClause.fromJson(Map<String, dynamic> json) =>
      DocumentReviewClause(
        title: json['title'] as String? ?? '',
        originalText: json['originalText'] as String? ?? '',
        analysis: json['analysis'] as String? ?? '',
        flagged: json['flagged'] as bool? ?? false,
      );
}

class DocumentReviewAmendment {
  DocumentReviewAmendment({
    required this.clauseRef,
    required this.issue,
    required this.originalText,
    required this.suggestedText,
    required this.reason,
  });
  final String clauseRef;
  final String issue;
  final String originalText;
  final String suggestedText;
  final String reason;

  factory DocumentReviewAmendment.fromJson(Map<String, dynamic> json) =>
      DocumentReviewAmendment(
        clauseRef: json['clauseRef'] as String? ?? '',
        issue: json['issue'] as String? ?? '',
        originalText: json['originalText'] as String? ?? '',
        suggestedText: json['suggestedText'] as String? ?? '',
        reason: json['reason'] as String? ?? '',
      );
}

class DocumentReviewResult {
  DocumentReviewResult({
    required this.summary,
    required this.documentType,
    required this.parties,
    required this.keyDates,
    required this.pros,
    required this.cons,
    required this.risks,
    required this.keyClauses,
    required this.amendments,
    required this.overallRiskScore,
    required this.riskLabel,
    required this.complianceFlags,
    required this.recommendations,
    this.suggestedFollowUpQuestions,
    this.creditsUsed,
    this.modelName,
    this.extractedText,
    this.publicationState,
    this.findings,
    this.dimensions,
    this.requiresLawyerReview,
    this.outputHash,
  });

  final String summary;
  final String documentType;
  final List<DocumentReviewParty> parties;
  final List<DocumentReviewKeyDate> keyDates;
  final List<DocumentReviewPro> pros;
  final List<DocumentReviewCon> cons;
  final List<DocumentReviewRisk> risks;
  final List<DocumentReviewClause> keyClauses;
  final List<DocumentReviewAmendment> amendments;
  final int overallRiskScore;
  final String riskLabel;
  final List<String> complianceFlags;
  final List<String> recommendations;
  final List<String>? suggestedFollowUpQuestions;
  final int? creditsUsed;
  final String? modelName;
  final String? extractedText;
  final String? publicationState;
  final List<VerificationFinding>? findings;
  final VerificationDimensions? dimensions;
  final bool? requiresLawyerReview;
  final String? outputHash;

  factory DocumentReviewResult.fromJson(Map<String, dynamic> json) {
    List<T> parseList<T>(String key, T Function(Map<String, dynamic>) fromJson) {
      final raw = json[key] as List<dynamic>?;
      return raw?.whereType<Map<String, dynamic>>().map(fromJson).toList() ?? [];
    }

    final dimensionsRaw = json['dimensions'];

    return DocumentReviewResult(
      summary: json['summary'] as String? ?? '',
      documentType: json['documentType'] as String? ?? 'GENERAL',
      parties: parseList('parties', DocumentReviewParty.fromJson),
      keyDates: parseList('keyDates', DocumentReviewKeyDate.fromJson),
      pros: parseList('pros', DocumentReviewPro.fromJson),
      cons: parseList('cons', DocumentReviewCon.fromJson),
      risks: parseList('risks', DocumentReviewRisk.fromJson),
      keyClauses: parseList('keyClauses', DocumentReviewClause.fromJson),
      amendments: parseList('amendments', DocumentReviewAmendment.fromJson),
      overallRiskScore: (json['overallRiskScore'] as num?)?.toInt() ?? 50,
      riskLabel: json['riskLabel'] as String? ?? 'Moderate',
      complianceFlags: (json['complianceFlags'] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      recommendations: (json['recommendations'] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      suggestedFollowUpQuestions:
          (json['suggestedFollowUpQuestions'] as List<dynamic>?)
              ?.whereType<String>()
              .toList(),
      creditsUsed: (json['creditsUsed'] as num?)?.toInt(),
      modelName: json['modelName'] as String?,
      extractedText: json['extractedText'] as String?,
      publicationState: json['publicationState'] as String?,
      findings: (json['findings'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .map(VerificationFinding.fromJson)
          .toList(),
      dimensions: dimensionsRaw is Map<String, dynamic>
          ? VerificationDimensions.fromJson(dimensionsRaw)
          : null,
      requiresLawyerReview: json['requiresLawyerReview'] as bool?,
      outputHash: json['outputHash'] as String?,
    );
  }
}

// ─── Lead Plan Questions (firm intake wizard) ─────────────────────────────────

class LeadPlanQuestion {
  const LeadPlanQuestion({
    required this.key,
    required this.label,
    required this.type,
    this.options = const [],
  });

  factory LeadPlanQuestion.fromJson(Map<String, dynamic> json) {
    final optionsRaw = json['options'] as List<dynamic>? ?? [];
    return LeadPlanQuestion(
      key: json['key'] as String? ?? json['id'] as String? ?? '',
      // Backend may send 'text', 'label', or 'question' — accept all three.
      label: json['label'] as String? ??
          json['text'] as String? ??
          json['question'] as String? ??
          '',
      type: json['type'] as String? ?? 'text',
      options: optionsRaw.map((e) => e.toString()).toList(),
    );
  }

  final String key;
  final String label;
  final String type; // 'single', 'multi', 'text'
  final List<String> options;
}

class LeadPlanQuestionsResult {
  const LeadPlanQuestionsResult({
    this.extractedFields = const {},
    this.questions = const [],
    this.suggestedClientName,
  });

  factory LeadPlanQuestionsResult.fromJson(Map<String, dynamic> json) {
    final questionsRaw = json['questions'] as List<dynamic>? ?? [];
    final fieldsRaw = json['extractedFields'] as Map<String, dynamic>? ?? {};
    return LeadPlanQuestionsResult(
      extractedFields: fieldsRaw,
      questions: questionsRaw
          .whereType<Map<String, dynamic>>()
          .map(LeadPlanQuestion.fromJson)
          .where((q) => q.label.isNotEmpty)
          .toList(),
      suggestedClientName: json['suggestedClientName'] as String?,
    );
  }

  final Map<String, dynamic> extractedFields;
  final List<LeadPlanQuestion> questions;
  final String? suggestedClientName;
}

// ─── Section Finder ───────────────────────────────────────────────────────────

class SectionFinderEntry {
  const SectionFinderEntry({
    this.legacyActShort,
    this.legacySection,
    this.legacyTitle,
    this.newActShort,
    this.newSection,
    this.newTitle,
    this.changeType,
    this.changeSummary,
    this.punishment,
    this.isBailable,
    this.isCognizable,
    this.isCompoundable,
    this.trialCourtLabel,
    this.bailPosture,
    this.practiceNote,
    this.sectionText,
    this.matchSource,
    this.sourceRef,
  });

  factory SectionFinderEntry.fromJson(Map<String, dynamic> json) {
    return SectionFinderEntry(
      legacyActShort: json['legacyActShort'] as String?,
      legacySection: json['legacySection'] as String?,
      legacyTitle: json['legacyTitle'] as String?,
      newActShort: json['newActShort'] as String?,
      newSection: json['newSection'] as String?,
      newTitle: json['newTitle'] as String?,
      changeType: json['changeType'] as String?,
      changeSummary: json['changeSummary'] as String?,
      punishment: json['punishment'] as String?,
      isBailable: json['isBailable'] as bool?,
      isCognizable: json['isCognizable'] as bool?,
      isCompoundable: json['isCompoundable'] as bool?,
      trialCourtLabel: json['trialCourtLabel'] as String?,
      bailPosture: json['bailPosture'] as String?,
      practiceNote: json['practiceNote'] as String?,
      sectionText: json['sectionText'] as String?,
      matchSource: json['matchSource'] as String?,
      sourceRef: json['sourceRef'] as String?,
    );
  }

  final String? legacyActShort;
  final String? legacySection;
  final String? legacyTitle;
  final String? newActShort;
  final String? newSection;
  final String? newTitle;
  final String? changeType;
  final String? changeSummary;
  final String? punishment;
  final bool? isBailable;
  final bool? isCognizable;
  final bool? isCompoundable;
  final String? trialCourtLabel;
  final String? bailPosture;
  final String? practiceNote;
  final String? sectionText;
  final String? matchSource;
  final String? sourceRef;

  String get displayLegacy {
    final act = legacyActShort ?? '';
    final sec = legacySection ?? '';
    return act.isNotEmpty && sec.isNotEmpty ? '$act §$sec' : act + sec;
  }

  String get displayNew {
    final act = newActShort ?? '';
    final sec = newSection ?? '';
    return act.isNotEmpty && sec.isNotEmpty ? '$act §$sec' : act + sec;
  }

  String get displayTitle => legacyTitle ?? newTitle ?? '';
}

class SectionFinderResult {
  const SectionFinderResult({
    required this.query,
    required this.matches,
    required this.total,
    this.disclaimer,
    this.actStructure,
  });

  factory SectionFinderResult.fromJson(Map<String, dynamic> json) {
    final matchesRaw = json['matches'] as List<dynamic>? ?? [];
    final structureRaw = json['actStructure'] as Map<String, dynamic>?;
    return SectionFinderResult(
      query: json['query'] as String? ?? '',
      matches: matchesRaw
          .whereType<Map<String, dynamic>>()
          .map(SectionFinderEntry.fromJson)
          .toList(),
      total: _parseInt(json['total']),
      disclaimer: json['disclaimer'] as String?,
      actStructure: structureRaw != null
          ? SectionFinderActStructure.fromJson(structureRaw)
          : null,
    );
  }

  final String query;
  final List<SectionFinderEntry> matches;
  final int total;
  final String? disclaimer;
  final SectionFinderActStructure? actStructure;
}

class SectionFinderActStructure {
  const SectionFinderActStructure({
    required this.actId,
    required this.sectionCount,
    this.orderCount,
    this.scheduleCount,
    this.structureProfile,
    this.lastSectionId,
  });

  factory SectionFinderActStructure.fromJson(Map<String, dynamic> json) {
    return SectionFinderActStructure(
      actId: json['actId'] as String? ?? '',
      sectionCount: _parseInt(json['sectionCount']),
      orderCount: _parseIntNullable(json['orderCount']),
      scheduleCount: _parseIntNullable(json['scheduleCount']),
      structureProfile: json['structureProfile'] as String?,
      lastSectionId: json['lastSectionId'] as String?,
    );
  }

  final String actId;
  final int sectionCount;
  final int? orderCount;
  final int? scheduleCount;
  final String? structureProfile;
  final String? lastSectionId;

  String get badgeLabel {
    final parts = <String>[];
    if (structureProfile?.contains('article') == true) {
      parts.add('$sectionCount articles');
    } else if (sectionCount > 0) {
      parts.add('$sectionCount sections');
    }
    if ((orderCount ?? 0) > 0) parts.add('$orderCount orders');
    if ((scheduleCount ?? 0) > 0) {
      parts.add('$scheduleCount schedule${scheduleCount == 1 ? '' : 's'}');
    }
    return parts.join(' · ');
  }
}

int? _parseIntNullable(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

class SectionFinderSuggestion {
  const SectionFinderSuggestion({
    required this.displayLabel,
    required this.normalizedQuery,
    this.actId,
    this.sectionNumber,
    this.legalAuthorityId,
    this.title,
    this.legacyActShort,
    this.legacySection,
    this.matchSource,
    this.score,
  });

  factory SectionFinderSuggestion.fromJson(Map<String, dynamic> json) {
    return SectionFinderSuggestion(
      displayLabel: json['displayLabel'] as String? ?? '',
      normalizedQuery: json['normalizedQuery'] as String? ?? '',
      actId: json['actId'] as String?,
      sectionNumber: json['sectionNumber'] as String?,
      legalAuthorityId: json['legalAuthorityId'] as String?,
      title: json['title'] as String?,
      legacyActShort: json['legacyActShort'] as String?,
      legacySection: json['legacySection'] as String?,
      matchSource: json['matchSource'] as String?,
      score: (json['score'] as num?)?.toDouble(),
    );
  }

  final String displayLabel;
  final String normalizedQuery;
  final String? actId;
  final String? sectionNumber;
  final String? legalAuthorityId;
  final String? title;
  final String? legacyActShort;
  final String? legacySection;
  final String? matchSource;
  final double? score;

  bool get isNetworkMatch => matchSource == 'network';
}

class PopularSectionQuery {
  const PopularSectionQuery({
    required this.displayLabel,
    required this.normalizedQuery,
    required this.searchCount,
    this.actId,
    this.sectionNumber,
    this.title,
  });

  factory PopularSectionQuery.fromJson(Map<String, dynamic> json) {
    return PopularSectionQuery(
      displayLabel: json['displayLabel'] as String? ?? '',
      normalizedQuery: json['normalizedQuery'] as String? ?? '',
      searchCount: _parseInt(json['searchCount']),
      actId: json['actId'] as String?,
      sectionNumber: json['sectionNumber'] as String?,
      title: json['title'] as String?,
    );
  }

  final String displayLabel;
  final String normalizedQuery;
  final int searchCount;
  final String? actId;
  final String? sectionNumber;
  final String? title;
}

// ─── FIR Analysis ─────────────────────────────────────────────────────────────

class FirNextStep {
  const FirNextStep({
    required this.step,
    required this.priority,
    required this.category,
    required this.details,
  });

  factory FirNextStep.fromJson(Map<String, dynamic> json) {
    return FirNextStep(
      step: json['step'] as String? ?? '',
      priority: json['priority'] as String? ?? 'medium',
      category: json['category'] as String? ?? 'procedure',
      details: json['details'] as String? ?? '',
    );
  }

  final String step;
  final String priority; // urgent | high | medium | low
  final String category;
  final String details;
}

class FirExtractionResult {
  const FirExtractionResult({
    required this.nextSteps,
    this.firNumber,
    this.policeStation,
    this.district,
    this.state,
    this.dateOfOccurrence,
    this.complainant,
    this.accused = const [],
    this.allegedOffences = const [],
    this.sections = const [],
    this.factsNarrative,
    this.bailPostureSummary,
    this.riskFlags = const [],
    this.suggestedResearchQuery,
    this.suggestedDraftTypes = const [],
    this.disclaimer,
    this.countryCode,
  });

  factory FirExtractionResult.fromJson(Map<String, dynamic> json) {
    final facts = json['extractedFacts'] as Map<String, dynamic>? ?? {};
    dynamic factField(String k) => (facts[k] as Map<String, dynamic>?)?['value'] ?? facts[k];

    List<String> strList(dynamic raw) =>
        (raw as List<dynamic>? ?? []).map((e) => e.toString()).toList();

    final nextRaw = json['nextSteps'] as List<dynamic>? ?? [];

    return FirExtractionResult(
      nextSteps: nextRaw
          .whereType<Map<String, dynamic>>()
          .map(FirNextStep.fromJson)
          .toList(),
      firNumber: factField('firNumber')?.toString(),
      policeStation: factField('policeStation')?.toString(),
      district: factField('district')?.toString(),
      state: factField('state')?.toString(),
      dateOfOccurrence: factField('dateOfOccurrence')?.toString(),
      complainant: factField('complainant')?.toString(),
      accused: strList(factField('accused')),
      allegedOffences: strList(factField('allegedOffences')),
      sections: strList(factField('sections')),
      factsNarrative: factField('factsNarrative')?.toString(),
      bailPostureSummary: json['bailPostureSummary'] as String?,
      riskFlags: strList(json['riskFlags']),
      suggestedResearchQuery: json['suggestedResearchQuery'] as String?,
      suggestedDraftTypes: strList(json['suggestedDraftTypes']),
      disclaimer: json['disclaimer'] as String?,
      countryCode: json['countryCode'] as String?,
    );
  }

  final List<FirNextStep> nextSteps;
  final String? firNumber;
  final String? policeStation;
  final String? district;
  final String? state;
  final String? dateOfOccurrence;
  final String? complainant;
  final List<String> accused;
  final List<String> allegedOffences;
  final List<String> sections;
  final String? factsNarrative;
  final String? bailPostureSummary;
  final List<String> riskFlags;
  final String? suggestedResearchQuery;
  final List<String> suggestedDraftTypes;
  final String? disclaimer;
  final String? countryCode;
}

class IndiaDraftFillResult {
  const IndiaDraftFillResult({
    required this.suggestions,
    this.creditsUsed,
  });

  factory IndiaDraftFillResult.fromJson(Map<String, dynamic> json) {
    final raw = json['suggestions'] as Map<String, dynamic>? ?? {};
    return IndiaDraftFillResult(
      suggestions: raw.map((k, v) => MapEntry(k, v.toString())),
      creditsUsed: (json['creditsUsed'] as num?)?.toInt(),
    );
  }

  final Map<String, String> suggestions;
  final int? creditsUsed;
}

// ─── Firm Intake Lead Detail ──────────────────────────────────────────────────

class LeadAnalysisRun {
  const LeadAnalysisRun({
    required this.id,
    required this.analysisType,
    this.contentMarkdown,
    this.status,
    this.createdAt,
  });

  factory LeadAnalysisRun.fromJson(Map<String, dynamic> json) {
    return LeadAnalysisRun(
      id: json['id'] as String? ?? '',
      analysisType: json['analysisType'] as String? ?? '',
      contentMarkdown: json['contentMarkdown'] as String?,
      status: json['status'] as String?,
      createdAt: _parseDateTime(json['createdAt']),
    );
  }

  final String id;
  final String analysisType;
  final String? contentMarkdown;
  final String? status;
  final DateTime? createdAt;
}

class FirmIntakeLead {
  const FirmIntakeLead({
    required this.id,
    required this.issueType,
    required this.countryCode,
    required this.status,
    this.jurisdiction,
    this.practiceArea,
    this.clientName,
    this.clientId,
    this.convertedMatterId,
    this.previewContentMarkdown,
    this.lawyerContextMarkdown,
    this.analysisRuns = const [],
    this.createdAt,
    this.intakeIntent,
    this.documentType,
    this.documentTitle,
    this.clauseOutline = const [],
    this.missingFields = const [],
    this.smartNextSteps = const [],
  });

  factory FirmIntakeLead.fromJson(Map<String, dynamic> json) {
    final runsRaw = json['analysisRuns'] as List<dynamic>? ?? [];
    final preview = json['previewReport'] as Map<String, dynamic>?;
    final structured =
        preview?['structuredOutput'] as Map<String, dynamic>? ?? {};

    List<String> stringList(dynamic v) => (v as List<dynamic>? ?? [])
        .whereType<String>()
        .toList();

    List<Map<String, dynamic>> mapList(dynamic v) =>
        (v as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();

    return FirmIntakeLead(
      id: json['id'] as String? ?? '',
      issueType: json['issueType'] as String? ?? '',
      countryCode: json['countryCode'] as String? ?? '',
      status: json['status'] as String? ?? 'NEW',
      jurisdiction: json['jurisdiction'] as String?,
      practiceArea: json['practiceArea'] as String?,
      clientName: json['clientName'] as String?,
      clientId: json['clientId'] as String?,
      convertedMatterId: json['convertedMatterId'] as String?,
      previewContentMarkdown: preview?['contentMarkdown'] as String?,
      lawyerContextMarkdown: json['lawyerContextMarkdown'] as String?,
      analysisRuns: runsRaw
          .whereType<Map<String, dynamic>>()
          .map(LeadAnalysisRun.fromJson)
          .toList(),
      createdAt: _parseDateTime(json['createdAt']),
      intakeIntent: json['intakeIntent'] as String?,
      documentType: structured['documentType'] as String?,
      documentTitle: structured['documentTitle'] as String?,
      clauseOutline: mapList(structured['clauseOutline']),
      missingFields: stringList(structured['missingFields']),
      smartNextSteps: stringList(structured['smartNextSteps']),
    );
  }

  final String id;
  final String issueType;
  final String countryCode;
  final String status;
  final String? jurisdiction;
  final String? practiceArea;
  final String? clientName;
  final String? clientId;
  final String? convertedMatterId;
  final String? previewContentMarkdown;
  final String? lawyerContextMarkdown;
  final List<LeadAnalysisRun> analysisRuns;
  final DateTime? createdAt;

  // Drafting workspace fields (populated for TRANSACTIONAL_DRAFT intents)
  final String? intakeIntent;
  final String? documentType;
  final String? documentTitle;
  final List<Map<String, dynamic>> clauseOutline;
  final List<String> missingFields;
  final List<String> smartNextSteps;

  bool get isDraftingLead => intakeIntent == 'TRANSACTIONAL_DRAFT';
}
