import 'package:dio/dio.dart';

import 'api_client.dart';

class MeetingModel {
  final String id;
  final String tenantId;
  final String title;
  final String status;
  final String? clientId;
  final String? matterId;
  final String? confidentiality;
  final String? source;
  final int? durationMs;
  final String? audioStorageKey;
  final String? matterTitle;
  final String createdAt;
  final String updatedAt;

  const MeetingModel({
    required this.id,
    required this.tenantId,
    required this.title,
    required this.status,
    this.clientId,
    this.matterId,
    this.confidentiality,
    this.source,
    this.durationMs,
    this.audioStorageKey,
    this.matterTitle,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get hasRecording =>
      audioStorageKey != null && audioStorageKey!.isNotEmpty;

  factory MeetingModel.fromJson(Map<String, dynamic> j) => MeetingModel(
        id: j['id'] as String,
        tenantId: j['tenantId'] as String? ?? '',
        title: j['title'] as String? ?? 'Meeting',
        status: j['status'] as String? ?? 'draft',
        clientId: j['clientId'] as String?,
        matterId: j['matterId'] as String?,
        confidentiality: j['confidentiality'] as String?,
        source: j['source'] as String?,
        durationMs: j['durationMs'] as int?,
        audioStorageKey: j['audioStorageKey'] as String?,
        matterTitle: (j['matter'] as Map<String, dynamic>?)?['title'] as String?,
        createdAt: j['createdAt'] as String? ?? '',
        updatedAt: j['updatedAt'] as String? ?? '',
      );
}

class MeetingTranscriptModel {
  final String id;
  final String meetingId;
  final String? rawText;
  final String? source;
  final String createdAt;

  const MeetingTranscriptModel({
    required this.id,
    required this.meetingId,
    this.rawText,
    this.source,
    required this.createdAt,
  });

  factory MeetingTranscriptModel.fromJson(Map<String, dynamic> j) =>
      MeetingTranscriptModel(
        id: j['id'] as String,
        meetingId: j['meetingId'] as String,
        rawText: j['rawText'] as String?,
        source: j['source'] as String?,
        createdAt: j['createdAt'] as String? ?? '',
      );
}

class MeetingNoteModel {
  final String id;
  final String meetingId;
  final String content;
  final String createdAt;

  const MeetingNoteModel({
    required this.id,
    required this.meetingId,
    required this.content,
    required this.createdAt,
  });

  factory MeetingNoteModel.fromJson(Map<String, dynamic> j) => MeetingNoteModel(
        id: j['id'] as String,
        meetingId: j['meetingId'] as String,
        content: j['content'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? '',
      );
}

class MeetingRecordingAccess {
  const MeetingRecordingAccess({
    required this.recordingToken,
    this.streamUrl,
    required this.mimeType,
    required this.isVideo,
  });

  factory MeetingRecordingAccess.fromJson(Map<String, dynamic> j) =>
      MeetingRecordingAccess(
        recordingToken: j['recordingToken'] as String? ?? '',
        streamUrl: j['streamUrl'] as String?,
        mimeType: j['mimeType'] as String? ?? 'audio/mp4',
        isVideo: j['isVideo'] as bool? ?? false,
      );

  final String recordingToken;
  final String? streamUrl;
  final String mimeType;
  final bool isVideo;
}

class MeetingsPage {
  const MeetingsPage({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.hasMore,
  });

  factory MeetingsPage.fromJson(Map<String, dynamic> j) => MeetingsPage(
        items: (j['items'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(MeetingModel.fromJson)
            .toList(),
        total: (j['total'] as num?)?.toInt() ?? 0,
        page: (j['page'] as num?)?.toInt() ?? 1,
        limit: (j['limit'] as num?)?.toInt() ?? 20,
        hasMore: j['hasMore'] as bool? ?? false,
      );

  final List<MeetingModel> items;
  final int total;
  final int page;
  final int limit;
  final bool hasMore;
}

class MeetingsApi {
  MeetingsApi(this._client);

  final ApiClient _client;

  Options _headers(String tenantId) =>
      Options(headers: {'X-Tenant-Id': tenantId});

  Future<MeetingModel> createMeeting({
    required String tenantId,
    required String title,
    String? clientId,
    String? matterId,
    String? confidentiality,
    String? scheduledAt,
    String? source,
    String status = 'recording',
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/meetings',
        data: {
          'title': title,
          if (clientId != null) 'clientId': clientId,
          if (matterId != null) 'matterId': matterId,
          'confidentiality': confidentiality ?? 'standard',
          'source': source ?? 'manual_recording',
          'status': status,
          'scheduledAt': scheduledAt ?? DateTime.now().toIso8601String(),
        },
        options: _headers(tenantId),
      );
      return MeetingModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<MeetingModel> getMeeting({
    required String tenantId,
    required String meetingId,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/meetings/$meetingId',
        options: _headers(tenantId),
      );
      return MeetingModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<MeetingModel>> listMeetings({
    required String tenantId,
    String? clientId,
    String? matterId,
  }) async {
    final page = await listMeetingsPage(
      tenantId: tenantId,
      clientId: clientId,
      matterId: matterId,
      page: 1,
      limit: 250,
    );
    return page.items;
  }

  Future<MeetingsPage> listMeetingsPage({
    required String tenantId,
    String? clientId,
    String? matterId,
    String? search,
    String? status,
    String? dateFrom,
    String? dateTo,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/meetings',
        queryParameters: {
          if (clientId != null) 'clientId': clientId,
          if (matterId != null) 'matterId': matterId,
          if (search != null && search.isNotEmpty) 'q': search,
          if (status != null && status.isNotEmpty) 'status': status,
          if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
          if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
          'page': page,
          'limit': limit,
        },
        options: _headers(tenantId),
      );
      return MeetingsPage.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> syncRecordingProgress({
    required String tenantId,
    required String meetingId,
    required int durationMs,
  }) async {
    try {
      await _client.dio.patch<void>(
        '/meetings/$meetingId/recording-progress',
        data: {'durationMs': durationMs},
        options: _headers(tenantId),
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> uploadAudio({
    required String tenantId,
    required String meetingId,
    required String filePath,
    required String mimeType,
    required int durationMs,
    String? draftTranscript,
  }) async {
    try {
      final formData = FormData.fromMap({
        'audio': await MultipartFile.fromFile(
          filePath,
          filename: 'recording.${mimeType.split('/').last.split(';').first}',
          contentType: DioMediaType.parse(mimeType),
        ),
        'durationMs': durationMs.toString(),
        if (draftTranscript != null && draftTranscript.isNotEmpty)
          'draftTranscript': draftTranscript,
      });

      final response = await _client.dio.post<Map<String, dynamic>>(
        '/meetings/$meetingId/process',
        data: formData,
        options: Options(
          headers: {'X-Tenant-Id': tenantId},
          sendTimeout: const Duration(minutes: 10),
          receiveTimeout: const Duration(minutes: 10),
        ),
      );
      return response.data ?? {'status': 'processing'};
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> retryProcessing({
    required String tenantId,
    required String meetingId,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/meetings/$meetingId/process',
        options: _headers(tenantId),
      );
      return response.data ?? {'status': 'processing'};
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<MeetingTranscriptModel?> getTranscript({
    required String tenantId,
    required String meetingId,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/meetings/$meetingId/transcript',
        options: _headers(tenantId),
      );
      if (response.data == null) return null;
      return MeetingTranscriptModel.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw ApiException.fromDio(e);
    }
  }

  Future<List<MeetingNoteModel>> getNotes({
    required String tenantId,
    required String meetingId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/meetings/$meetingId/notes',
        options: _headers(tenantId),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(MeetingNoteModel.fromJson)
          .toList();
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return [];
      throw ApiException.fromDio(e);
    }
  }

  Future<MeetingRecordingAccess> getRecordingAccess({
    required String tenantId,
    required String meetingId,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/meetings/$meetingId/recording-access',
        options: _headers(tenantId),
      );
      return MeetingRecordingAccess.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<MeetingNoteModel> regenerateNotes({
    required String tenantId,
    required String meetingId,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/meetings/$meetingId/summarize',
        options: _headers(tenantId),
      );
      return MeetingNoteModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<MeetingModel> updateMeetingStatus({
    required String tenantId,
    required String meetingId,
    required String status,
  }) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/meetings/$meetingId',
        data: {'status': status},
        options: _headers(tenantId),
      );
      return MeetingModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteMeeting({
    required String tenantId,
    required String meetingId,
  }) async {
    try {
      await _client.dio.delete<void>(
        '/meetings/$meetingId',
        options: _headers(tenantId),
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

String meetingMimeTypeForExtension(String ext) {
  switch (ext.toLowerCase()) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'mp4':
    case 'm4a':
      return 'audio/mp4';
    default:
      return 'audio/mp4';
  }
}
