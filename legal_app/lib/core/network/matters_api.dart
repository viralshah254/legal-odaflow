import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class MattersPage {
  const MattersPage({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.hasMore,
  });

  factory MattersPage.fromJson(Map<String, dynamic> j) => MattersPage(
        items: (j['items'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(FirmMatter.fromJson)
            .toList(),
        total: (j['total'] as num?)?.toInt() ?? 0,
        page: (j['page'] as num?)?.toInt() ?? 1,
        limit: (j['limit'] as num?)?.toInt() ?? 20,
        hasMore: j['hasMore'] as bool? ?? false,
      );

  final List<FirmMatter> items;
  final int total;
  final int page;
  final int limit;
  final bool hasMore;
}

class MattersApi {
  MattersApi(this._client);

  final ApiClient _client;

  Future<List<FirmMatter>> listMatters({
    required String tenantId,
    String? status,
  }) async {
    try {
      final response = await _client.dio.get<dynamic>(
        '/matters',
        queryParameters: status != null && status.isNotEmpty
            ? {'status': status}
            : null,
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return MattersPage.fromJson(data).items;
      }
      final list = data as List<dynamic>? ?? [];
      return list
          .whereType<Map<String, dynamic>>()
          .map(FirmMatter.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MattersPage> listMattersPage({
    required String tenantId,
    String? search,
    String? status,
    String? dateFrom,
    String? dateTo,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/matters',
        queryParameters: {
          if (search != null && search.isNotEmpty) 'q': search,
          if (status != null && status.isNotEmpty) 'status': status,
          if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
          if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
          'page': page,
          'limit': limit,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return MattersPage.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MatterDetail> getMatterDetail({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/matters/$matterId',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return MatterDetail.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<FirmMatter> createMatter({
    required String tenantId,
    required String title,
    required String countryCode,
    required String practiceArea,
    required String matterType,
    String? clientId,
    String? jurisdiction,
    String? factsSummary,
    String? desiredOutcome,
    String? opposingParty,
    String? courtName,
    String? courtLevel,
    String? caseNumber,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/matters',
        data: {
          'title': title,
          'countryCode': countryCode,
          'practiceArea': practiceArea,
          'matterType': matterType,
          if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
          if (jurisdiction != null && jurisdiction.isNotEmpty)
            'jurisdiction': jurisdiction,
          if (factsSummary != null && factsSummary.isNotEmpty)
            'factsSummary': factsSummary,
          if (desiredOutcome != null && desiredOutcome.isNotEmpty)
            'desiredOutcome': desiredOutcome,
          if (opposingParty != null && opposingParty.isNotEmpty)
            'opposingParty': opposingParty,
          if (courtName != null && courtName.isNotEmpty) 'courtName': courtName,
          if (courtLevel != null && courtLevel.isNotEmpty)
            'courtLevel': courtLevel,
          if (caseNumber != null && caseNumber.isNotEmpty)
            'caseNumber': caseNumber,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return FirmMatter.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> updateMatter({
    required String tenantId,
    required String matterId,
    String? stage,
    String? status,
    String? factsSummary,
    String? desiredOutcome,
  }) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/matters/$matterId',
        data: {
          if (stage != null) 'stage': stage,
          if (status != null) 'status': status,
          if (factsSummary != null) 'factsSummary': factsSummary,
          if (desiredOutcome != null) 'desiredOutcome': desiredOutcome,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> closeMatter({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      await _client.dio.patch<Map<String, dynamic>>(
        '/matters/$matterId',
        data: {'status': 'CLOSED'},
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> deleteMatter({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      await _client.dio.delete<void>(
        '/matters/$matterId',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<MatterDocument>> listMatterDocuments({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/documents',
        queryParameters: {'matterId': matterId},
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      final data = response.data ?? [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(MatterDocument.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> getPresignedUploadUrl({
    required String tenantId,
    required String fileName,
    String? mimeType,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/documents/upload-url',
        data: {
          'fileName': fileName,
          if (mimeType != null) 'mimeType': mimeType,
          'scope': 'tenant',
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> uploadDocument({
    required String tenantId,
    required String matterId,
    required String fileName,
    required String fileUrl,
    String? mimeType,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/documents/upload',
        data: {
          'fileName': fileName,
          'fileUrl': fileUrl,
          'matterId': matterId,
          if (mimeType != null) 'mimeType': mimeType,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> createTimeEntry({
    required String tenantId,
    required String matterId,
    required int minutes,
    required String narrative,
    bool billable = true,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/time-entries',
        data: {
          'matterId': matterId,
          'minutes': minutes,
          'narrative': narrative,
          'billable': billable,
          'date': DateTime.now().toIso8601String(),
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> createInvoice({
    required String tenantId,
    required String matterId,
    String? clientId,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/invoices',
        data: {
          'matterId': matterId,
          if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> getDraftingWorkspace({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/matters/$matterId/drafting-workspace',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> generateDraft({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/matters/$matterId/drafting-workspace/generate',
        options: Options(
          headers: {'X-Tenant-Id': tenantId},
          receiveTimeout: const Duration(seconds: 120),
        ),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> runKickoffAgent({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/matters/$matterId/kickoff-agent',
        options: Options(
          headers: {'X-Tenant-Id': tenantId},
          receiveTimeout: const Duration(seconds: 90),
        ),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
