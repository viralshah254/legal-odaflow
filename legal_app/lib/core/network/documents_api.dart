import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class DocumentsApi {
  DocumentsApi(this._client);

  final ApiClient _client;

  Future<ConsumerDocumentUploadResult> uploadConsumerDocument({
    required String consumerCaseId,
    required String fileName,
    required String fileUrl,
    String? mimeType,
    String? documentType,
    int? fileSizeBytes,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/documents/consumer/upload',
        data: {
          'consumerCaseId': consumerCaseId,
          'fileName': fileName,
          'fileUrl': fileUrl,
          if (mimeType != null && mimeType.isNotEmpty) 'mimeType': mimeType,
          if (documentType != null && documentType.isNotEmpty)
            'documentType': documentType,
          if (fileSizeBytes != null) 'fileSizeBytes': fileSizeBytes,
        },
      );
      return ConsumerDocumentUploadResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ConsumerDocument>> listByCase(String consumerCaseId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/documents/consumer/$consumerCaseId',
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ConsumerDocument.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
