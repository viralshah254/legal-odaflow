import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class ConsumersApi {
  ConsumersApi(this._client);

  final ApiClient _client;

  static const _previewReceiveTimeout = Duration(seconds: 120);

  Future<ConsumerCaseCreateResult> createCase({
    required String countryCode,
    required String issueType,
    required String title,
    String? facts,
    String? jurisdiction,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/cases',
        data: {
          'countryCode': countryCode,
          'issueType': issueType,
          'title': title,
          if (facts != null && facts.isNotEmpty) 'facts': facts,
          if (jurisdiction != null && jurisdiction.isNotEmpty)
            'jurisdiction': jurisdiction,
        },
      );
      return ConsumerCaseCreateResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<LeadPlanQuestionsResult> getPlanQuestions({
    required String facts,
    required String countryCode,
    String? issueType,
    String? deviceFingerprint,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/plan-questions',
        data: {
          'facts': facts,
          'countryCode': countryCode,
          'mode': 'SELF',
          if (issueType != null && issueType.isNotEmpty) 'issueType': issueType,
          if (deviceFingerprint != null && deviceFingerprint.isNotEmpty)
            'deviceFingerprint': deviceFingerprint,
        },
        options: Options(extra: {'skipAuth': true}),
      );
      return LeadPlanQuestionsResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<OutcomeOptionsResult> getOutcomeOptions({
    required String facts,
    required String countryCode,
    String? practiceArea,
    String? deviceFingerprint,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/outcome-options',
        data: {
          'facts': facts,
          'countryCode': countryCode,
          if (practiceArea != null && practiceArea.isNotEmpty)
            'practiceArea': practiceArea,
          if (deviceFingerprint != null && deviceFingerprint.isNotEmpty)
            'deviceFingerprint': deviceFingerprint,
        },
        options: Options(extra: {'skipAuth': true}),
      );
      return OutcomeOptionsResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ConsumerCase>> listCases() async {
    try {
      final response = await _client.dio.get<List<dynamic>>('/consumers/cases');
      final data = response.data ?? [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(ConsumerCase.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<ConsumerCaseDetail> getCase(String caseId) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/consumers/cases/$caseId',
      );
      return ConsumerCaseDetail.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<ConsumerLegalReport> generateFullReport(String caseId) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumer-cases/$caseId/reports/full',
      );
      return ConsumerLegalReport.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<IssueCheckerClassifyResult> classifyIssueChecker({
    required String countryCode,
    required String facts,
    String? deviceFingerprint,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/classify',
        data: {
          'countryCode': countryCode,
          'facts': facts,
          if (deviceFingerprint != null && deviceFingerprint.isNotEmpty)
            'deviceFingerprint': deviceFingerprint,
        },
        options: Options(extra: {'skipAuth': true}),
      );
      return IssueCheckerClassifyResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<IssueCheckerClassifyResult> classifyForFirmIntake({
    required String countryCode,
    required String facts,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/classify',
        data: {
          'countryCode': countryCode,
          'facts': facts,
          'mode': 'FIRM_INTAKE',
        },
      );
      return IssueCheckerClassifyResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<LeadPlanQuestionsResult> planQuestionsForIntake({
    required String facts,
    required String countryCode,
    String mode = 'FIRM_INTAKE',
    String? issueType,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/plan-questions',
        data: {
          'facts': facts,
          'countryCode': countryCode,
          'mode': mode,
          if (issueType != null && issueType.isNotEmpty) 'issueType': issueType,
        },
      );
      return LeadPlanQuestionsResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<IssueCheckerPreviewResult> firmIntakePreview({
    required String countryCode,
    required String issueType,
    required String title,
    required String facts,
    Map<String, dynamic> planningAnswers = const {},
    String? clientName,
    String? clientEmail,
    String? clientPhone,
    String clientType = 'INDIVIDUAL',
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/preview',
        data: {
          'countryCode': countryCode,
          'issueType': issueType,
          'title': title,
          'facts': facts,
          'mode': 'FIRM_INTAKE',
          if (planningAnswers.isNotEmpty) 'planningAnswers': planningAnswers,
          if (clientName != null && clientName.isNotEmpty) 'clientName': clientName,
          if (clientEmail != null && clientEmail.isNotEmpty) 'clientEmail': clientEmail,
          if (clientPhone != null && clientPhone.isNotEmpty) 'clientPhone': clientPhone,
          'clientType': clientType,
        },
      );
      return IssueCheckerPreviewResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<IssueCheckerTeaserResult> teaserIssueChecker({
    required String countryCode,
    required String issueType,
    required String title,
    String? jurisdiction,
    String? facts,
    String? desiredOutcome,
    String? parties,
    String? urgencyLevel,
    String? deviceFingerprint,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/teaser',
        data: {
          'countryCode': countryCode,
          'issueType': issueType,
          'title': title,
          if (jurisdiction != null && jurisdiction.isNotEmpty)
            'jurisdiction': jurisdiction,
          if (facts != null && facts.isNotEmpty) 'facts': facts,
          if (desiredOutcome != null && desiredOutcome.isNotEmpty)
            'desiredOutcome': desiredOutcome,
          if (parties != null && parties.isNotEmpty) 'parties': parties,
          if (urgencyLevel != null && urgencyLevel.isNotEmpty)
            'urgencyLevel': urgencyLevel,
          if (deviceFingerprint != null && deviceFingerprint.isNotEmpty)
            'deviceFingerprint': deviceFingerprint,
        },
        options: Options(
          extra: {'skipAuth': true},
          receiveTimeout: _previewReceiveTimeout,
        ),
      );
      return IssueCheckerTeaserResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<IssueCheckerPreviewResult> previewIssueChecker({
    required String countryCode,
    required String issueType,
    required String title,
    String? jurisdiction,
    String? facts,
    String? desiredOutcome,
    String? parties,
    String? urgencyLevel,
    String? consumerCaseId,
    String? anonymousSessionId,
    Map<String, dynamic>? planningAnswers,
    String? deviceFingerprint,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/issue-checker/preview',
        data: {
          'countryCode': countryCode,
          'issueType': issueType,
          'title': title,
          if (jurisdiction != null && jurisdiction.isNotEmpty)
            'jurisdiction': jurisdiction,
          if (facts != null && facts.isNotEmpty) 'facts': facts,
          if (desiredOutcome != null && desiredOutcome.isNotEmpty)
            'desiredOutcome': desiredOutcome,
          if (parties != null && parties.isNotEmpty) 'parties': parties,
          if (urgencyLevel != null && urgencyLevel.isNotEmpty)
            'urgencyLevel': urgencyLevel,
          if (consumerCaseId != null && consumerCaseId.isNotEmpty)
            'consumerCaseId': consumerCaseId,
          if (anonymousSessionId != null && anonymousSessionId.isNotEmpty)
            'anonymousSessionId': anonymousSessionId,
          if (planningAnswers != null && planningAnswers.isNotEmpty)
            'planningAnswers': planningAnswers,
          if (deviceFingerprint != null && deviceFingerprint.isNotEmpty)
            'deviceFingerprint': deviceFingerprint,
        },
        options: Options(receiveTimeout: _previewReceiveTimeout),
      );
      return IssueCheckerPreviewResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> getCredits() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/consumers/me/credits',
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CreditTopupCheckout> createCreditTopupCheckout({
    required String countryCode,
    required String packId,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/consumers/credits/topup/checkout',
        data: {
          'countryCode': countryCode.toUpperCase(),
          'packId': packId,
        },
      );
      return CreditTopupCheckout.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ConsumerCaseDraft>> listCaseDrafts(String caseId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/consumers/cases/$caseId/drafts',
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ConsumerCaseDraft.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ConsumerCaseMessage>> listCaseMessages(String caseId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/consumers/cases/$caseId/messages',
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ConsumerCaseMessage.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ConsumerCasePayment>> listCasePayments(String caseId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/consumers/cases/$caseId/payments',
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ConsumerCasePayment.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
