import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../models/india_draft.dart';
import '../models/draft_intent.dart';
import '../models/models.dart' show IndiaDraftFillResult;
import 'api_client.dart';

/// India drafting API — mirrors `legal_web/lib/api/india-drafting.ts`.
class IndiaDraftingApi {
  IndiaDraftingApi(this._client);

  final ApiClient _client;

  static const _draftReceiveTimeout = Duration(seconds: 600);

  Options _tenantOptions(String? tenantId, {Duration? receiveTimeout}) =>
      Options(
        receiveTimeout: receiveTimeout ?? _draftReceiveTimeout,
        headers: tenantId != null && tenantId.isNotEmpty
            ? {'X-Tenant-Id': tenantId}
            : null,
      );

  Future<IndiaDraftResult> generateIndiaDraft({
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
    String? practiceArea,
    String? authority,
    String? category,
    bool bundleMode = false,
    int? bundleIndex,
    String modelMode = 'AUTO',
    String? styleId,
    List<PinnedSection>? pinnedSections,
    List<PinnedCaseLaw>? pinnedCaseLaws,
    String? tenantId,
  }) async {
    final body = {
      'kind': kind,
      'caseDetails': caseDetails,
      if (clientName != null && clientName.isNotEmpty) 'clientName': clientName,
      if (courtName != null && courtName.isNotEmpty) 'courtName': courtName,
      if (opposingParty != null && opposingParty.isNotEmpty)
        'opposingParty': opposingParty,
      if (language != null && language.isNotEmpty) 'language': language,
      if (attachmentContext != null && attachmentContext.isNotEmpty)
        'attachmentContext': attachmentContext,
      if (formNumber != null && formNumber.isNotEmpty) 'formNumber': formNumber,
      if (formTitle != null && formTitle.isNotEmpty) 'formTitle': formTitle,
      if (jurisdiction != null && jurisdiction.isNotEmpty)
        'jurisdiction': jurisdiction,
      if (practiceArea != null && practiceArea.isNotEmpty)
        'practiceArea': practiceArea,
      if (authority != null && authority.isNotEmpty) 'authority': authority,
      if (category != null && category.isNotEmpty) 'category': category,
      if (bundleMode) 'bundleMode': true,
      if (bundleIndex != null) 'bundleIndex': bundleIndex,
      'modelMode': modelMode,
      if (styleId != null && styleId.isNotEmpty) 'styleId': styleId,
      if (pinnedSections != null && pinnedSections.isNotEmpty)
        'pinnedSections': pinnedSections.map((e) => e.toJson()).toList(),
      if (pinnedCaseLaws != null && pinnedCaseLaws.isNotEmpty)
        'pinnedCaseLaws': pinnedCaseLaws.map((e) => e.toJson()).toList(),
    };
    debugPrint('[IndiaDraftingApi] POST /ai/india-draft/generate kind=$kind');
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/generate',
      data: body,
      options: _tenantOptions(tenantId),
    );
    return IndiaDraftResult.fromJson(response.data!);
  }

  Future<IndiaDraftFillResult> fillBlanks({
    required String documentKind,
    required Map<String, String> context,
    required List<String> emptyFields,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/fill-blanks',
      data: {
        'documentKind': documentKind,
        'context': context,
        'emptyFields': emptyFields,
      },
      options: _tenantOptions(tenantId, receiveTimeout: const Duration(seconds: 60)),
    );
    return IndiaDraftFillResult.fromJson(response.data!);
  }

  Future<EditIndiaDraftResponse> editIndiaDraft({
    required String documentKind,
    required String selectedText,
    required String instruction,
    String? context,
    String? caseDetails,
    String? jurisdiction,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/edit',
      data: {
        'documentKind': documentKind,
        'selectedText': selectedText,
        'instruction': instruction,
        if (context != null) 'context': context,
        if (caseDetails != null) 'caseDetails': caseDetails,
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
      },
      options: _tenantOptions(tenantId, receiveTimeout: const Duration(seconds: 120)),
    );
    return EditIndiaDraftResponse.fromJson(response.data!);
  }

  Future<ReverifyIndiaDraftResponse> reverifyIndiaDraft({
    required String documentKind,
    required String draft,
    String? caseDetails,
    String? jurisdiction,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/reverify',
      data: {
        'documentKind': documentKind,
        'draft': draft,
        if (caseDetails != null) 'caseDetails': caseDetails,
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
      },
      options: _tenantOptions(tenantId, receiveTimeout: const Duration(seconds: 180)),
    );
    return ReverifyIndiaDraftResponse.fromJson(response.data!);
  }

  Future<ReverifyIndiaDraftResponse> fixIndiaDraftVerification({
    required String documentKind,
    required String draft,
    required String instruction,
    String? caseDetails,
    String? jurisdiction,
    String? selectedText,
    String? findingId,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/fix-verification',
      data: {
        'documentKind': documentKind,
        'draft': draft,
        'instruction': instruction,
        if (caseDetails != null) 'caseDetails': caseDetails,
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
        if (selectedText != null) 'selectedText': selectedText,
        if (findingId != null) 'findingId': findingId,
      },
      options: _tenantOptions(tenantId, receiveTimeout: const Duration(seconds: 180)),
    );
    return ReverifyIndiaDraftResponse.fromJson(response.data!);
  }

  Future<DraftSectionResult> regenerateSection({
    required String sectionId,
    required String kind,
    required String caseDetails,
    String? clientName,
    String? courtName,
    String? opposingParty,
    String? jurisdiction,
    String? practiceArea,
    String? attachmentContext,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/india-draft/regenerate-section',
      data: {
        'sectionId': sectionId,
        'kind': kind,
        'caseDetails': caseDetails,
        if (clientName != null) 'clientName': clientName,
        if (courtName != null) 'courtName': courtName,
        if (opposingParty != null) 'opposingParty': opposingParty,
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
        if (practiceArea != null) 'practiceArea': practiceArea,
        if (attachmentContext != null) 'attachmentContext': attachmentContext,
      },
      options: _tenantOptions(tenantId, receiveTimeout: const Duration(seconds: 180)),
    );
    return DraftSectionResult.fromJson(response.data!);
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
    return response.data?['context'] as String? ??
        response.data?['extractedText'] as String? ??
        '';
  }

  Future<UsDraftResult> generateUsDraft({
    required String kind,
    required String caseDetails,
    String? clientName,
    String? courtName,
    String? opposingParty,
    String? stateCode,
    String modelMode = 'AUTO',
    String? tenantId,
  }) async {
    final body = {
      'kind': kind,
      'caseDetails': caseDetails,
      if (clientName != null && clientName.isNotEmpty) 'clientName': clientName,
      if (courtName != null && courtName.isNotEmpty) 'courtName': courtName,
      if (opposingParty != null && opposingParty.isNotEmpty)
        'opposingParty': opposingParty,
      if (stateCode != null && stateCode.isNotEmpty) 'stateCode': stateCode,
      'modelMode': modelMode,
    };
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/us-draft/generate',
      data: body,
      options: _tenantOptions(tenantId),
    );
    return UsDraftResult.fromJson(response.data!);
  }

  Future<IndiaDraftFillResult> fillUsDraftBlanks({
    required String documentKind,
    required Map<String, String> context,
    required List<String> emptyFields,
    String? stateCode,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/ai/us-draft/fill-blanks',
      data: {
        'documentKind': documentKind,
        'context': context,
        'emptyFields': emptyFields,
        if (stateCode != null && stateCode.isNotEmpty) 'stateCode': stateCode,
      },
      options: _tenantOptions(tenantId, receiveTimeout: const Duration(seconds: 60)),
    );
    return IndiaDraftFillResult.fromJson(response.data!);
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
    final response = await _client.dio.get<List<dynamic>>(
      '/ai/drafts/history',
      queryParameters: params,
      options: _tenantOptions(tenantId, receiveTimeout: const Duration(seconds: 30)),
    );
    return (response.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(DraftHistoryItem.fromJson)
        .toList();
  }
}
