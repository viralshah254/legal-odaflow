import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class CopilotApi {
  CopilotApi(this._client);

  final ApiClient _client;

  Future<CopilotChatResult> chat({
    required String message,
    required String tenantId,
    String? sessionId,
    Map<String, dynamic>? context,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/ai/copilot/chat',
        data: {
          'message': message,
          if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
          if (context != null && context.isNotEmpty) 'context': context,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return CopilotChatResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
