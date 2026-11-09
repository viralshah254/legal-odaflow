import 'package:dio/dio.dart';
import 'api_client.dart';

class FirmKnowledgeItem {
  const FirmKnowledgeItem({
    required this.id,
    required this.tenantId,
    required this.title,
    required this.status,
    required this.revision,
    required this.contentHash,
    required this.createdById,
    required this.lastEditedById,
    required this.sourceId,
    required this.sourceType,
    required this.rightsBasis,
    this.matterId,
    this.documentId,
    this.rightsExpiresAt,
    this.rightsExpired = false,
    this.content = '',
    this.reviews = const [],
  });
  final String id,
      tenantId,
      title,
      status,
      contentHash,
      createdById,
      lastEditedById,
      sourceId,
      sourceType,
      rightsBasis,
      content;
  final int revision;
  final String? matterId, documentId;
  final DateTime? rightsExpiresAt;
  final bool rightsExpired;
  final List<Map<String, dynamic>> reviews;
  factory FirmKnowledgeItem.fromJson(Map<String, dynamic> json) =>
      FirmKnowledgeItem(
        id: json['id'] as String,
        tenantId: json['tenantId'] as String,
        title: json['title'] as String? ?? '',
        status: json['status'] as String? ?? '',
        revision: (json['revision'] as num?)?.toInt() ?? 0,
        contentHash: json['contentHash'] as String? ?? '',
        createdById: json['createdById'] as String? ?? '',
        lastEditedById: json['lastEditedById'] as String? ?? '',
        sourceId: json['sourceId'] as String? ?? '',
        sourceType: json['sourceType'] as String? ?? '',
        rightsBasis: json['rightsBasis'] as String? ?? '',
        matterId: json['matterId'] as String?,
        documentId: json['documentId'] as String?,
        rightsExpiresAt: DateTime.tryParse(
          json['rightsExpiresAt'] as String? ?? '',
        ),
        rightsExpired: json['rightsExpired'] == true,
        content: json['content'] as String? ?? '',
        reviews: (json['reviews'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList(),
      );
  Map<String, dynamic> reviewPayload({
    bool selfReviewConfirmed = false,
    bool firmWideConfirmed = false,
    String? note,
  }) => {
    'expectedRevision': revision,
    'expectedContentHash': contentHash,
    'selfReviewConfirmed': selfReviewConfirmed,
    'firmWideConfirmed': firmWideConfirmed,
    if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
  };
}

class FirmKnowledgeList {
  const FirmKnowledgeList({
    this.items = const [],
    this.count = 0,
    this.limit = 100,
    this.canReview = false,
    this.canSubmit = false,
    this.independentReviewRequired = true,
  });
  final List<FirmKnowledgeItem> items;
  final int count, limit;
  final bool canReview, canSubmit, independentReviewRequired;
  factory FirmKnowledgeList.fromJson(Map<String, dynamic> json) =>
      FirmKnowledgeList(
        items: (json['items'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(FirmKnowledgeItem.fromJson)
            .toList(),
        count: (json['count'] as num?)?.toInt() ?? 0,
        limit: (json['limit'] as num?)?.toInt() ?? 100,
        canReview: json['canReview'] == true,
        canSubmit: json['canSubmit'] == true,
        independentReviewRequired: json['independentReviewRequired'] != false,
      );
}

class FirmKnowledgeApi {
  FirmKnowledgeApi(this._client);
  final ApiClient _client;
  Future<FirmKnowledgeList> list(String tenantId) async =>
      FirmKnowledgeList.fromJson(await _request(tenantId, '/items'));
  Future<FirmKnowledgeItem> get(String tenantId, String id) async =>
      FirmKnowledgeItem.fromJson(
        await _request(tenantId, '/items/${Uri.encodeComponent(id)}'),
      );
  Future<FirmKnowledgeItem> submit(
    String tenantId,
    Map<String, dynamic> body,
  ) async =>
      FirmKnowledgeItem.fromJson(await _request(tenantId, '/ingest', body));
  Future<FirmKnowledgeItem> review(
    String tenantId,
    FirmKnowledgeItem item,
    String decision, {
    bool selfReviewConfirmed = false,
    bool firmWideConfirmed = false,
    String? note,
  }) async {
    if (!['approve', 'reject', 'revoke'].contains(decision)) {
      throw ArgumentError.value(decision);
    }
    return FirmKnowledgeItem.fromJson(
      await _request(
        tenantId,
        '/items/${Uri.encodeComponent(item.id)}/$decision',
        item.reviewPayload(
          selfReviewConfirmed: selfReviewConfirmed,
          firmWideConfirmed: firmWideConfirmed,
          note: note,
        ),
      ),
    );
  }

  Future<Map<String, dynamic>> _request(
    String tenantId,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    try {
      final response = await _client.dio.request<Map<String, dynamic>>(
        '/firm-memory$path',
        data: body,
        options: Options(
          method: body == null ? 'GET' : 'POST',
          headers: {'X-Tenant-Id': tenantId},
          receiveTimeout: const Duration(seconds: 120),
        ),
      );
      return response.data ?? {};
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
