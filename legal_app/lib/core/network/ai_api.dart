import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../drafting/form_search.dart';
import '../models/models.dart';
import 'api_client.dart';

class AiApi {
  AiApi(this._client);

  final ApiClient _client;

  static const _researchReceiveTimeout = Duration(seconds: 180);

  /// Max attempts for normal retries (network/timeout).
  static const _maxResearchAttempts = 3;

  /// Max additional attempts specifically for AI_BUSY (provider rate limit).
  static const _maxBusyRetries = 4;

  Future<LegalResearchResult> runLegalResearch({
    required String query,
    required String countryCode,
    String? jurisdiction,
    String? matterId,
    String? practiceArea,
    String? tenantId,
    String researchMode = 'FAST',
    String aiModelMode = 'AUTO',
    String? premiumModelId,
  }) async {
    final options = Options(
      receiveTimeout: _researchReceiveTimeout,
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );

    final body = {
      'query': query,
      'countryCode': countryCode,
      'researchMode': researchMode,
      'aiModelMode': aiModelMode,
      if (jurisdiction != null && jurisdiction.isNotEmpty)
        'jurisdiction': jurisdiction,
      if (matterId != null && matterId.isNotEmpty) 'matterId': matterId,
      if (practiceArea != null && practiceArea.isNotEmpty)
        'practiceArea': practiceArea,
      if (premiumModelId != null && premiumModelId.isNotEmpty)
        'premiumModelId': premiumModelId,
    };

    Object? lastError;
    int busyRetries = 0;
    int attempt = 0;

    while (attempt < _maxResearchAttempts) {
      try {
        debugPrint(
          '[AiApi] POST ${AppConfig.apiBaseUrl}/ai/research '
          'mode=$researchMode attempt=${attempt + 1} busyRetries=$busyRetries',
        );
        final response = await _client.dio.post<Map<String, dynamic>>(
          '/ai/research',
          data: body,
          options: options,
        );
        debugPrint('[AiApi] Response status=${response.statusCode}');
        return LegalResearchResult.fromJson(response.data!);
      } on DioException catch (error) {
        debugPrint(
          '[AiApi] DioException type=${error.type} status=${error.response?.statusCode}',
        );
        final apiError = ApiException.fromDio(error);
        lastError = apiError;

        if (apiError.kind == ApiErrorKind.aibusy &&
            busyRetries < _maxBusyRetries) {
          // Back-off: respect server hint or use exponential delay.
          final waitSeconds = apiError.retryAfterSeconds ?? (2 << busyRetries);
          debugPrint(
            '[AiApi] AI busy — retrying in ${waitSeconds}s (busyRetry ${busyRetries + 1}/$_maxBusyRetries)',
          );
          await Future<void>.delayed(Duration(seconds: waitSeconds));
          busyRetries++;
          continue; // don't increment attempt, just retry
        }

        if (!apiError.isRetryable || attempt >= _maxResearchAttempts - 1) {
          throw apiError;
        }
        attempt++;
      } catch (error) {
        debugPrint('[AiApi] Unexpected error: $error');
        lastError = error;
        rethrow;
      }
    }

    if (lastError is ApiException) throw lastError;
    throw ApiException('Research failed. Please try again.');
  }

  /// Start async legal research job (tenant path). Mirrors web `startLegalResearchJob`.
  Future<String> startLegalResearchJob({
    required String query,
    required String countryCode,
    String? jurisdiction,
    String? matterId,
    String? practiceArea,
    String? tenantId,
    String researchMode = 'FAST',
    String aiModelMode = 'AUTO',
    String? premiumModelId,
    List<Map<String, dynamic>>? priorContext,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 60),
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final body = {
      'query': query,
      'countryCode': countryCode,
      'researchMode': researchMode,
      'aiModelMode': aiModelMode,
      if (jurisdiction != null && jurisdiction.isNotEmpty)
        'jurisdiction': jurisdiction,
      if (matterId != null && matterId.isNotEmpty) 'matterId': matterId,
      if (practiceArea != null && practiceArea.isNotEmpty)
        'practiceArea': practiceArea,
      if (premiumModelId != null && premiumModelId.isNotEmpty)
        'premiumModelId': premiumModelId,
      if (priorContext != null && priorContext.isNotEmpty)
        'priorContext': priorContext,
    };
    debugPrint('[AiApi] POST /ai/research/async mode=$researchMode');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/research/async',
      data: body,
      options: options,
    );
    final jobId = response.data?['jobId'] as String?;
    if (jobId == null || jobId.isEmpty) {
      throw ApiException('Research job did not return a jobId.');
    }
    return jobId;
  }

  Future<List<ResearchHistoryItem>> getResearchHistory({
    String? tenantId,
  }) async {
    final options = Options(
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.get<List<dynamic>>(
      '/ai/research/history',
      options: options,
    );
    return (response.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ResearchHistoryItem.fromJson)
        .toList();
  }

  Future<String> ensureResearchOutput({
    required String query,
    required String answer,
    String? countryCode,
    String? jurisdiction,
    String? aiOutputId,
    String? tenantId,
  }) async {
    final options = Options(
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/research/ensure-output',
      data: {
        'query': query,
        'answer': answer,
        if (countryCode != null) 'countryCode': countryCode,
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
        if (aiOutputId != null) 'aiOutputId': aiOutputId,
      },
      options: options,
    );
    return response.data?['aiOutputId'] as String? ?? '';
  }

  Future<ResearchEnrichResponse> enrichLegalResearch({
    required String outputId,
    required String mode, // case_laws | sections | both
    String? query,
    String? countryCode,
    String? jurisdiction,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 180),
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/research/$outputId/enrich',
      data: {
        'mode': mode,
        if (query != null) 'query': query,
        if (countryCode != null) 'countryCode': countryCode,
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
      },
      options: options,
    );
    return ResearchEnrichResponse.fromJson(response.data!);
  }

  Future<Map<String, dynamic>> saveResearchToClient({
    required String clientId,
    required String title,
    required String query,
    required Map<String, dynamic> researchJson,
    String? matterId,
    String? aiOutputId,
    String? countryCode,
    String? tenantId,
  }) async {
    final options = Options(
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/research/saved',
      data: {
        'clientId': clientId,
        'title': title,
        'query': query,
        'researchJson': researchJson,
        if (matterId != null) 'matterId': matterId,
        if (aiOutputId != null) 'aiOutputId': aiOutputId,
        if (countryCode != null) 'countryCode': countryCode,
      },
      options: options,
    );
    return response.data ?? {};
  }

  // ---------------------------------------------------------------------------
  // Document Review
  // ---------------------------------------------------------------------------

  static const _reviewReceiveTimeout = Duration(seconds: 240);
  static const _maxReviewAttempts = 3;
  static const _maxReviewBusyRetries = 4;

  Future<DocumentReviewResult> runDocumentReview({
    required String extractedText,
    String? documentType,
    String? countryCode,
    String? jurisdiction,
    String? matterId,
    String? tenantId,
    String aiModelMode = 'AUTO',
    String? premiumModelId,
  }) async {
    final options = Options(
      receiveTimeout: _reviewReceiveTimeout,
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );

    final body = {
      'extractedText': extractedText,
      'aiModelMode': aiModelMode,
      if (documentType != null && documentType.isNotEmpty) 'documentType': documentType,
      if (countryCode != null && countryCode.isNotEmpty) 'countryCode': countryCode,
      if (jurisdiction != null && jurisdiction.isNotEmpty) 'jurisdiction': jurisdiction,
      if (matterId != null && matterId.isNotEmpty) 'matterId': matterId,
      if (premiumModelId != null && premiumModelId.isNotEmpty) 'premiumModelId': premiumModelId,
    };

    return _postDocumentReview('/ai/document-review', body, options);
  }

  Future<DocumentReviewResult> runDocumentReviewFile({
    required List<int> fileBytes,
    required String fileName,
    String? documentType,
    String? countryCode,
    String? jurisdiction,
    String? matterId,
    String? tenantId,
    String aiModelMode = 'AUTO',
    String? premiumModelId,
  }) async {
    final options = Options(
      receiveTimeout: _reviewReceiveTimeout,
      headers: {
        'Content-Type': 'multipart/form-data',
        if (tenantId != null && tenantId.isNotEmpty) 'X-Tenant-Id': tenantId,
      },
    );

    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(fileBytes, filename: fileName),
      'aiModelMode': aiModelMode,
      if (documentType != null) 'documentType': documentType,
      if (countryCode != null) 'countryCode': countryCode,
      if (jurisdiction != null) 'jurisdiction': jurisdiction,
      if (matterId != null) 'matterId': matterId,
      if (premiumModelId != null) 'premiumModelId': premiumModelId,
    });

    return _postDocumentReview('/ai/document-review/upload', formData, options);
  }

  // ---------------------------------------------------------------------------
  // Section Finder
  // ---------------------------------------------------------------------------

  Future<SectionFinderResult> runSectionFinder({
    required String query,
    String? locale,
  }) async {
    debugPrint('[AiApi] GET /legal-sources/section-finder q=$query');
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/legal-sources/section-finder',
      queryParameters: {
        'q': query,
        'countryCode': 'IN',
        if (locale != null && locale.isNotEmpty && locale != 'en') 'locale': locale,
      },
    );
    return SectionFinderResult.fromJson(response.data!);
  }

  Future<List<SectionFinderSuggestion>> suggestSection(
    String q, {
    int limit = 10,
  }) async {
    debugPrint('[AiApi] GET /legal-sources/section-finder/suggest q=$q');
    final response = await _client.dio.get<List<dynamic>>(
      '/legal-sources/section-finder/suggest',
      queryParameters: {
        'q': q,
        'countryCode': 'IN',
        'limit': limit,
      },
    );
    final data = response.data ?? [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(SectionFinderSuggestion.fromJson)
        .toList();
  }

  Future<List<PopularSectionQuery>> getPopularSections({int limit = 10}) async {
    debugPrint('[AiApi] GET /legal-sources/section-finder/popular');
    final response = await _client.dio.get<List<dynamic>>(
      '/legal-sources/section-finder/popular',
      queryParameters: {'countryCode': 'IN', 'limit': limit},
    );
    final data = response.data ?? [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(PopularSectionQuery.fromJson)
        .toList();
  }

  Future<List<Map<String, dynamic>>> getActStructures({String countryCode = 'IN'}) async {
    debugPrint('[AiApi] GET /legal-sources/section-finder/acts');
    final response = await _client.dio.get<List<dynamic>>(
      '/legal-sources/section-finder/acts',
      queryParameters: {'countryCode': countryCode},
    );
    return (response.data ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  // ---------------------------------------------------------------------------
  // FIR Analysis
  // ---------------------------------------------------------------------------

  static const _firReceiveTimeout = Duration(seconds: 120);

  Future<FirExtractionResult> runFirExtract({
    required String extractedText,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: _firReceiveTimeout,
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    debugPrint('[AiApi] POST /ai/fir/extract');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/fir/extract',
      data: {'extractedText': extractedText, 'countryCode': 'IN'},
      options: options,
    );
    return FirExtractionResult.fromJson(response.data!);
  }

  Future<FirExtractionResult> runFirUpload({
    required List<int> fileBytes,
    required String fileName,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: _firReceiveTimeout,
      headers: {
        'Content-Type': 'multipart/form-data',
        if (tenantId != null && tenantId.isNotEmpty) 'X-Tenant-Id': tenantId,
      },
    );
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(fileBytes, filename: fileName),
      'countryCode': 'IN',
    });
    debugPrint('[AiApi] POST /ai/fir/upload');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/fir/upload',
      data: formData,
      options: options,
    );
    return FirExtractionResult.fromJson(response.data!);
  }

  // ---------------------------------------------------------------------------
  // India Drafting
  // ---------------------------------------------------------------------------

  static const _draftReceiveTimeout = Duration(seconds: 180);

  Future<IndiaDraftResult> runIndiaDraft({
    required String kind,
    required String caseDetails,
    String? clientName,
    String? courtName,
    String? opposingParty,
    String? language,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: _draftReceiveTimeout,
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final body = {
      'kind': kind,
      'caseDetails': caseDetails,
      if (clientName != null && clientName.isNotEmpty) 'clientName': clientName,
      if (courtName != null && courtName.isNotEmpty) 'courtName': courtName,
      if (opposingParty != null && opposingParty.isNotEmpty) 'opposingParty': opposingParty,
      if (language != null && language.isNotEmpty) 'language': language,
    };
    debugPrint('[AiApi] POST /ai/india-draft/generate kind=$kind');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/generate',
      data: body,
      options: options,
    );
    return IndiaDraftResult.fromJson(response.data!);
  }

  Future<IndiaDraftFillResult> runIndiaDraftFillBlanks({
    required String documentKind,
    required Map<String, String> context,
    required List<String> emptyFields,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 60),
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    debugPrint('[AiApi] POST /ai/india-draft/fill-blanks');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/fill-blanks',
      data: {'documentKind': documentKind, 'context': context, 'emptyFields': emptyFields},
      options: options,
    );
    return IndiaDraftFillResult.fromJson(response.data!);
  }

  Future<IndiaDraftResult> runIndiaDraftExtended({
    required String kind,
    required String caseDetails,
    String? clientName,
    String? courtName,
    String? opposingParty,
    String? language,
    String? attachmentContext,
    String? formNumber,
    String? formTitle,
    String? jurisdiction,
    bool bundleMode = false,
    int? bundleIndex,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: _draftReceiveTimeout,
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final body = {
      'kind': kind,
      'caseDetails': caseDetails,
      if (clientName != null && clientName.isNotEmpty) 'clientName': clientName,
      if (courtName != null && courtName.isNotEmpty) 'courtName': courtName,
      if (opposingParty != null && opposingParty.isNotEmpty) 'opposingParty': opposingParty,
      if (language != null && language.isNotEmpty) 'language': language,
      if (attachmentContext != null && attachmentContext.isNotEmpty)
        'attachmentContext': attachmentContext,
      if (formNumber != null && formNumber.isNotEmpty) 'formNumber': formNumber,
      if (formTitle != null && formTitle.isNotEmpty) 'formTitle': formTitle,
      if (jurisdiction != null && jurisdiction.isNotEmpty) 'jurisdiction': jurisdiction,
      if (bundleMode) 'bundleMode': true,
      if (bundleIndex != null) 'bundleIndex': bundleIndex,
    };
    debugPrint('[AiApi] POST /ai/india-draft/generate kind=$kind bundle=$bundleMode');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/generate',
      data: body,
      options: options,
    );
    return IndiaDraftResult.fromJson(response.data!);
  }

  Future<String> extractDraftContext({
    required List<int> fileBytes,
    required String fileName,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 120),
      headers: {
        'Content-Type': 'multipart/form-data',
        if (tenantId != null && tenantId.isNotEmpty) 'X-Tenant-Id': tenantId,
      },
    );
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(fileBytes, filename: fileName),
    });
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/extract-context',
      data: formData,
      options: options,
    );
    return response.data?['context'] as String? ?? '';
  }

  Future<UsDraftResult> runUsDraft({
    required String kind,
    required String caseDetails,
    String? clientName,
    String? courtName,
    String? opposingParty,
    String? stateCode,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: _draftReceiveTimeout,
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final body = {
      'kind': kind,
      'caseDetails': caseDetails,
      if (clientName != null && clientName.isNotEmpty) 'clientName': clientName,
      if (courtName != null && courtName.isNotEmpty) 'courtName': courtName,
      if (opposingParty != null && opposingParty.isNotEmpty) 'opposingParty': opposingParty,
      if (stateCode != null && stateCode.isNotEmpty) 'stateCode': stateCode,
    };
    debugPrint('[AiApi] POST /ai/us-draft/generate kind=$kind');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/us-draft/generate',
      data: body,
      options: options,
    );
    return UsDraftResult.fromJson(response.data!);
  }

  Future<IndiaDraftFillResult> runUsDraftFillBlanks({
    required String documentKind,
    required Map<String, String> context,
    required List<String> emptyFields,
    String? stateCode,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 60),
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/us-draft/fill-blanks',
      data: {
        'documentKind': documentKind,
        'context': context,
        'emptyFields': emptyFields,
        if (stateCode != null && stateCode.isNotEmpty) 'stateCode': stateCode,
      },
      options: options,
    );
    return IndiaDraftFillResult.fromJson(response.data!);
  }

  // ---------------------------------------------------------------------------
  // Prompt refinement
  // ---------------------------------------------------------------------------

  Future<RefinePromptResult> refinePrompt({
    required String prompt,
    required String purpose,
    String? countryCode,
    String? jurisdiction,
    String? practiceArea,
    String? outputLanguage,
    List<String>? knowledgeSources,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 30),
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/prompt/refine',
      data: {
        'prompt': prompt,
        'purpose': purpose,
        if (countryCode != null && countryCode.isNotEmpty) 'countryCode': countryCode,
        if (jurisdiction != null && jurisdiction.isNotEmpty) 'jurisdiction': jurisdiction,
        if (practiceArea != null && practiceArea.isNotEmpty) 'practiceArea': practiceArea,
        if (outputLanguage != null && outputLanguage.isNotEmpty) 'outputLanguage': outputLanguage,
        if (knowledgeSources != null && knowledgeSources.isNotEmpty)
          'knowledgeSources': knowledgeSources,
      },
      options: options,
    );
    return RefinePromptResult.fromJson(response.data!);
  }

  // ---------------------------------------------------------------------------
  // Draft Intent
  // ---------------------------------------------------------------------------

  Future<DraftAnalyzeResult> analyzeDraftIntent({
    required String query,
    String? supplementalContext,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 90),
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/draft-intent/analyze',
      data: {
        'query': query,
        if (supplementalContext != null && supplementalContext.isNotEmpty)
          'supplementalContext': supplementalContext,
      },
      options: options,
    );
    return DraftAnalyzeResult.fromJson(response.data!);
  }

  Future<DraftIntentResolveResult> resolveDraftIntent({
    required String query,
    String? countryCode,
    String? jurisdiction,
    Map<String, String>? answers,
    DraftContext? context,
    String? supplementalContext,
    String? tenantId,
  }) async {
    final options = Options(
      receiveTimeout: const Duration(seconds: 90),
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/draft-intent/resolve',
      data: {
        'query': query,
        if (countryCode != null && countryCode.isNotEmpty) 'countryCode': countryCode,
        if (jurisdiction != null && jurisdiction.isNotEmpty) 'jurisdiction': jurisdiction,
        if (answers != null && answers.isNotEmpty) 'answers': answers,
        if (context != null) 'context': context.toJson(),
        if (supplementalContext != null && supplementalContext.isNotEmpty)
          'supplementalContext': supplementalContext,
      },
      options: options,
    );
    return DraftIntentResolveResult.fromJson(response.data!);
  }

  Future<PaginatedLegalForms> fetchLegalFormsPaginated({
    String? countryCode,
    String? search,
    int page = 1,
    int limit = 24,
  }) async {
    final params = <String, String>{
      'page': '$page',
      'limit': '$limit',
    };
    if (countryCode != null && countryCode.isNotEmpty && countryCode != 'ALL') {
      params['countryCode'] = countryCode;
    }
    if (search != null && search.isNotEmpty) params['search'] = search;
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/legal-forms',
      queryParameters: params,
    );
    return PaginatedLegalForms.fromJson(response.data!);
  }

  Future<List<FormSearchHit>> searchLegalFormsByIntent({
    required String query,
    String? countryCode,
    int limit = 20,
  }) async {
    final params = <String, String>{
      'query': query,
      'limit': '$limit',
    };
    if (countryCode != null && countryCode.isNotEmpty && countryCode != 'ALL') {
      params['countryCode'] = countryCode;
    }
    final response = await _client.dio.get<Map<String, dynamic>>(
      '/legal-forms/intent-search',
      queryParameters: params,
    );
    final data = response.data ?? {};
    final items = (data['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(JurisdictionForm.fromJson)
        .toList();
    final scores = (data['scores'] as List<dynamic>? ?? [])
        .map((s) => (s as num?)?.toDouble() ?? 0)
        .toList();
    return [
      for (var i = 0; i < items.length; i++)
        FormSearchHit(
          form: items[i],
          score: i < scores.length ? scores[i] : 0,
        ),
    ];
  }

  Future<List<DraftHistoryItem>> getDraftHistory({
    String? countryCode,
    int limit = 20,
    String? tenantId,
  }) async {
    final params = <String, String>{'limit': '$limit'};
    if (countryCode != null && countryCode.isNotEmpty) {
      params['countryCode'] = countryCode;
    }
    final options = Options(
      headers: tenantId != null && tenantId.isNotEmpty
          ? {'X-Tenant-Id': tenantId}
          : null,
    );
    final response = await _client.dio.get<List<dynamic>>(
      '/ai/drafts/history',
      queryParameters: params,
      options: options,
    );
    return (response.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(DraftHistoryItem.fromJson)
        .toList();
  }

  Future<DocumentReviewResult> _postDocumentReview(
    String path,
    dynamic body,
    Options options,
  ) async {
    Object? lastError;
    int busyRetries = 0;
    int attempt = 0;

    while (attempt < _maxReviewAttempts) {
      try {
        debugPrint('[AiApi] POST ${AppConfig.apiBaseUrl}$path attempt=${attempt + 1} busyRetries=$busyRetries');
        final response = await _client.dio.post<Map<String, dynamic>>(
          path,
          data: body,
          options: options,
        );
        debugPrint('[AiApi] DocumentReview status=${response.statusCode}');
        return DocumentReviewResult.fromJson(response.data!);
      } on DioException catch (error) {
        debugPrint('[AiApi] DioException type=${error.type} status=${error.response?.statusCode}');
        final apiError = ApiException.fromDio(error);
        lastError = apiError;

        if (apiError.kind == ApiErrorKind.aibusy && busyRetries < _maxReviewBusyRetries) {
          final waitSeconds = apiError.retryAfterSeconds ?? (2 << busyRetries);
          debugPrint('[AiApi] AI busy — retrying in ${waitSeconds}s');
          await Future<void>.delayed(Duration(seconds: waitSeconds));
          busyRetries++;
          continue;
        }

        if (!apiError.isRetryable || attempt >= _maxReviewAttempts - 1) {
          throw apiError;
        }
        attempt++;
      } catch (error) {
        debugPrint('[AiApi] Unexpected error: $error');
        lastError = error;
        rethrow;
      }
    }

    if (lastError is ApiException) throw lastError;
    throw ApiException('Document review failed. Please try again.');
  }

}
