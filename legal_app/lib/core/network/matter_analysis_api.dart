import 'package:dio/dio.dart';

import 'api_client.dart';

class MatterAnalysisRun {
  const MatterAnalysisRun({
    required this.id,
    required this.matterId,
    required this.runType,
    this.trigger = 'manual',
    this.title,
    this.contentMarkdown,
    this.status = 'COMPLETED',
    this.createdAt,
  });

  factory MatterAnalysisRun.fromJson(Map<String, dynamic> json) {
    return MatterAnalysisRun(
      id: json['id'] as String,
      matterId: json['matterId'] as String,
      runType: json['runType'] as String? ?? '',
      trigger: json['trigger'] as String? ?? 'manual',
      title: json['title'] as String?,
      contentMarkdown: json['contentMarkdown'] as String?,
      status: json['status'] as String? ?? 'COMPLETED',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  final String id;
  final String matterId;
  final String runType;
  final String trigger;
  final String? title;
  final String? contentMarkdown;
  final String status;
  final DateTime? createdAt;
}

class MatterStrategyMemo {
  const MatterStrategyMemo({
    required this.id,
    required this.matterId,
    required this.title,
    required this.content,
    this.status = 'DRAFT',
    this.createdAt,
    this.updatedAt,
  });

  factory MatterStrategyMemo.fromJson(Map<String, dynamic> json) {
    return MatterStrategyMemo(
      id: json['id'] as String,
      matterId: json['matterId'] as String,
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      status: json['status'] as String? ?? 'DRAFT',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
    );
  }

  final String id;
  final String matterId;
  final String title;
  final String content;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

class MatterAnalysisApi {
  MatterAnalysisApi(this._client);

  final ApiClient _client;

  // Similar Cases

  Future<List<MatterAnalysisRun>> listSimilarCases({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/matters/$matterId/similar-cases',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(MatterAnalysisRun.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MatterAnalysisRun> runSimilarCases({
    required String tenantId,
    required String matterId,
    String? focusPrompt,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/matters/$matterId/similar-cases',
        data: {
          if (focusPrompt != null && focusPrompt.isNotEmpty)
            'focusPrompt': focusPrompt,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return MatterAnalysisRun.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  // Opponent Analysis

  Future<List<MatterAnalysisRun>> listOpponentAnalyses({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/matters/$matterId/opponent-analyses',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(MatterAnalysisRun.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MatterAnalysisRun> runOpponentAnalysis({
    required String tenantId,
    required String matterId,
    String? focusPrompt,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/matters/$matterId/opponent-analyses',
        data: {
          if (focusPrompt != null && focusPrompt.isNotEmpty)
            'focusPrompt': focusPrompt,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return MatterAnalysisRun.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  // Strategy Memos

  Future<List<MatterStrategyMemo>> listStrategyMemos({
    required String tenantId,
    required String matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/matters/$matterId/strategy-memos',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(MatterStrategyMemo.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<MatterStrategyMemo> autoGenerateStrategy({
    required String tenantId,
    required String matterId,
    String? focusPrompt,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/matters/$matterId/strategy-memos/auto-generate',
        data: {
          if (focusPrompt != null && focusPrompt.isNotEmpty)
            'focusPrompt': focusPrompt,
        },
        options: Options(
          headers: {'X-Tenant-Id': tenantId},
          receiveTimeout: const Duration(seconds: 180),
          sendTimeout: const Duration(seconds: 30),
        ),
        cancelToken: cancelToken,
      );
      return MatterStrategyMemo.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
