import 'package:dio/dio.dart';

import 'api_client.dart';

class CalendarEventItem {
  const CalendarEventItem({
    required this.id,
    required this.title,
    required this.startAt,
    required this.endAt,
    this.description,
    this.matterId,
    this.matterTitle,
    this.clientId,
    this.taskId,
    this.type,
    this.isTaskDeadline = false,
  });

  final String id;
  final String title;
  final DateTime startAt;
  final DateTime endAt;
  final String? description;
  final String? matterId;
  final String? matterTitle;
  final String? clientId;
  final String? taskId;
  final String? type;
  final bool isTaskDeadline;

  factory CalendarEventItem.fromJson(Map<String, dynamic> json) {
    return CalendarEventItem(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'Event',
      startAt: DateTime.parse(json['startAt'] as String),
      endAt: DateTime.parse(json['endAt'] as String),
      description: json['description'] as String?,
      matterId: json['matterId'] as String?,
      matterTitle: (json['matter'] as Map<String, dynamic>?)?['title'] as String?,
      clientId: json['clientId'] as String?,
      taskId: json['taskId'] as String?,
      type: json['type'] as String?,
    );
  }

  bool get isAllDay =>
      endAt.difference(startAt).inDays >= 1 &&
      startAt.hour == 0 &&
      endAt.hour == 0;

  String get normalizedType {
    final raw = (type ?? 'MEETING').toUpperCase();
    if (raw == 'HEARING' || raw == 'COURT_DATE') return 'COURT_DATE';
    if (raw == 'DEADLINE' || raw == 'TASK_DEADLINE') return 'DEADLINE';
    if (raw == 'APPOINTMENT') return 'APPOINTMENT';
    if (raw == 'MEETING') return 'MEETING';
    return 'OTHER';
  }
}

class CreateCalendarEventInput {
  const CreateCalendarEventInput({
    required this.title,
    required this.startAt,
    required this.endAt,
    this.description,
    this.type,
    this.clientId,
    this.matterId,
  });

  final String title;
  final DateTime startAt;
  final DateTime endAt;
  final String? description;
  final String? type;
  final String? clientId;
  final String? matterId;

  Map<String, dynamic> toJson() => {
        'title': title,
        'startAt': startAt.toIso8601String(),
        'endAt': endAt.toIso8601String(),
        if (description != null && description!.isNotEmpty) 'description': description,
        if (type != null && type!.isNotEmpty) 'type': type,
        if (clientId != null && clientId!.isNotEmpty) 'clientId': clientId,
        if (matterId != null && matterId!.isNotEmpty) 'matterId': matterId,
      };
}

class UpdateCalendarEventInput {
  const UpdateCalendarEventInput({
    this.title,
    this.startAt,
    this.endAt,
    this.description,
    this.type,
    this.clientId,
    this.matterId,
  });

  final String? title;
  final DateTime? startAt;
  final DateTime? endAt;
  final String? description;
  final String? type;
  final String? clientId;
  final String? matterId;

  Map<String, dynamic> toJson() => {
        if (title != null) 'title': title,
        if (startAt != null) 'startAt': startAt!.toIso8601String(),
        if (endAt != null) 'endAt': endAt!.toIso8601String(),
        if (description != null) 'description': description,
        if (type != null) 'type': type,
        if (clientId != null) 'clientId': clientId,
        if (matterId != null) 'matterId': matterId,
      };
}

class CalendarApi {
  CalendarApi(this._client);

  final ApiClient _client;

  Options _headers(String tenantId) =>
      Options(headers: {'X-Tenant-Id': tenantId});

  Future<List<CalendarEventItem>> listEvents({
    required String tenantId,
    DateTime? from,
    DateTime? to,
    String? matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/calendar/events',
        queryParameters: {
          if (from != null) 'from': from.toIso8601String(),
          if (to != null) 'to': to.toIso8601String(),
          if (matterId != null) 'matterId': matterId,
        },
        options: _headers(tenantId),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CalendarEventItem.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CalendarEventItem> createEvent({
    required String tenantId,
    required CreateCalendarEventInput input,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/calendar',
        data: input.toJson(),
        options: _headers(tenantId),
      );
      return CalendarEventItem.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CalendarEventItem> updateEvent({
    required String tenantId,
    required String eventId,
    required UpdateCalendarEventInput input,
  }) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/calendar/$eventId',
        data: input.toJson(),
        options: _headers(tenantId),
      );
      return CalendarEventItem.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> deleteEvent({
    required String tenantId,
    required String eventId,
  }) async {
    try {
      await _client.dio.delete<void>(
        '/calendar/$eventId',
        options: _headers(tenantId),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
