import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class MarketplaceApi {
  MarketplaceApi(this._client);

  final ApiClient _client;

  Future<List<MarketplaceLead>> listLeads() async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/marketplace/leads',
      );
      final data = response.data ?? [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(MarketplaceLead.fromJson)
          .toList();
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return [];
      }
      throw ApiException.fromDio(error);
    }
  }

  Future<MarketplaceLead> acceptLead(String leadId) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/marketplace/leads/$leadId/accept',
      );
      return MarketplaceLead.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MarketplaceLead> rejectLead(String leadId, {String? reason}) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/marketplace/leads/$leadId/reject',
        data: reason != null && reason.isNotEmpty ? {'reason': reason} : null,
      );
      return MarketplaceLead.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MarketplaceLead> convertLead(String leadId) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/marketplace/leads/$leadId/convert',
      );
      final data = response.data!;

      // Primary format: backend returns { matter: { id, title, ... }, intakeIntent, openDocumentsTab }
      final matter = data['matter'] as Map<String, dynamic>?;
      if (matter != null && matter.containsKey('id')) {
        return MarketplaceLead(
          id: leadId,
          issueType: matter['title'] as String? ?? 'Converted matter',
          countryCode: matter['countryCode'] as String? ?? '',
          status: 'CONVERTED',
          convertedMatterId: matter['id'] as String?,
        );
      }
      // Legacy: backend returned the lead object directly
      if (data.containsKey('issueType')) {
        return MarketplaceLead.fromJson(data);
      }
      // Legacy: backend returned the matter directly at root level
      if (data.containsKey('id')) {
        return MarketplaceLead(
          id: leadId,
          issueType: data['title'] as String? ?? 'Converted matter',
          countryCode: data['countryCode'] as String? ?? '',
          status: 'CONVERTED',
          convertedMatterId: data['id'] as String?,
        );
      }
      return MarketplaceLead(
        id: leadId,
        issueType: 'Converted',
        countryCode: '',
        status: 'CONVERTED',
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<FirmIntakeLead> getFirmLead(String leadId) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/marketplace/leads/$leadId',
      );
      return FirmIntakeLead.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> updateLeadContext(String leadId, String contextMarkdown) async {
    try {
      await _client.dio.patch<void>(
        '/marketplace/leads/$leadId/context',
        data: {'contextMarkdown': contextMarkdown},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<LeadAnalysisRun> runLeadAnalysis(
    String leadId,
    String analysisType,
  ) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/marketplace/leads/$leadId/analysis/$analysisType',
      );
      return LeadAnalysisRun.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>?> getMyProfile() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/marketplace/my-profile',
      );
      return response.data;
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> upsertMyProfile(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await _client.dio.put<Map<String, dynamic>>(
        '/marketplace/my-profile',
        data: data,
      );
      return response.data!;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<LawyerReviewRequest> createReviewRequest({
    required String consumerCaseId,
    required String countryCode,
    required String issueType,
    required double price,
    required String currency,
    String? consumerReportId,
    String? jurisdiction,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/marketplace/review-requests',
        data: {
          'consumerCaseId': consumerCaseId,
          'countryCode': countryCode,
          'issueType': issueType,
          'price': price,
          'currency': currency,
          if (consumerReportId != null && consumerReportId.isNotEmpty)
            'consumerReportId': consumerReportId,
          if (jurisdiction != null && jurisdiction.isNotEmpty)
            'jurisdiction': jurisdiction,
        },
      );
      return LawyerReviewRequest.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PaymentIntentResult> payForReviewRequest(String reviewRequestId) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/marketplace/review-requests/$reviewRequestId/pay',
        data: const {},
      );
      return PaymentIntentResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
