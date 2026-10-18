import 'package:dio/dio.dart';
import 'api_client.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class SmartWorkspace {
  final String id;
  final String title;
  final String? matterId;
  final List<WorkspaceDoc> workspaceDocs;

  SmartWorkspace({
    required this.id,
    required this.title,
    this.matterId,
    required this.workspaceDocs,
  });

  factory SmartWorkspace.fromJson(Map<String, dynamic> json) => SmartWorkspace(
        id: json['id'] as String,
        title: json['title'] as String,
        matterId: json['matterId'] as String?,
        workspaceDocs: (json['workspaceDocs'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(WorkspaceDoc.fromJson)
            .toList(),
      );
}

class WorkspaceDoc {
  final String id;
  final String workspaceId;
  final String documentId;
  final int orderIndex;
  final WorkspaceDocFile document;

  WorkspaceDoc({
    required this.id,
    required this.workspaceId,
    required this.documentId,
    required this.orderIndex,
    required this.document,
  });

  factory WorkspaceDoc.fromJson(Map<String, dynamic> json) => WorkspaceDoc(
        id: json['id'] as String,
        workspaceId: json['workspaceId'] as String,
        documentId: json['documentId'] as String,
        orderIndex: (json['orderIndex'] as int?) ?? 0,
        document: WorkspaceDocFile.fromJson(json['document'] as Map<String, dynamic>),
      );
}

class WorkspaceDocFile {
  final String id;
  final String fileName;
  final String? mimeType;
  final String fileUrl;
  final String? extractedText;

  WorkspaceDocFile({
    required this.id,
    required this.fileName,
    this.mimeType,
    required this.fileUrl,
    this.extractedText,
  });

  factory WorkspaceDocFile.fromJson(Map<String, dynamic> json) => WorkspaceDocFile(
        id: json['id'] as String,
        fileName: json['fileName'] as String,
        mimeType: json['mimeType'] as String?,
        fileUrl: json['fileUrl'] as String,
        extractedText: json['extractedText'] as String?,
      );
}

class DocumentAnnotation {
  final String id;
  final String workspaceId;
  final String documentId;
  final String type; // highlight | note | excerpt | ink
  final Map<String, dynamic> anchor;
  final Map<String, dynamic>? content;
  final String color;
  final String? aiMetadata;

  DocumentAnnotation({
    required this.id,
    required this.workspaceId,
    required this.documentId,
    required this.type,
    required this.anchor,
    this.content,
    required this.color,
    this.aiMetadata,
  });

  factory DocumentAnnotation.fromJson(Map<String, dynamic> json) => DocumentAnnotation(
        id: json['id'] as String,
        workspaceId: json['workspaceId'] as String,
        documentId: json['documentId'] as String,
        type: json['type'] as String,
        anchor: json['anchor'] as Map<String, dynamic>? ?? {},
        content: json['content'] as Map<String, dynamic>?,
        color: (json['color'] as String?) ?? '#FDE68A',
        aiMetadata: json['aiMetadata']?.toString(),
      );
}

class CanvasNode {
  final String id;
  final String workspaceId;
  final String type;
  final double positionX;
  final double positionY;
  final double width;
  final double? height;
  final Map<String, dynamic> content;
  final List<String> linkedAnnotationIds;

  CanvasNode({
    required this.id,
    required this.workspaceId,
    required this.type,
    required this.positionX,
    required this.positionY,
    required this.width,
    this.height,
    required this.content,
    required this.linkedAnnotationIds,
  });

  factory CanvasNode.fromJson(Map<String, dynamic> json) => CanvasNode(
        id: json['id'] as String,
        workspaceId: json['workspaceId'] as String,
        type: json['type'] as String,
        positionX: (json['positionX'] as num?)?.toDouble() ?? 0,
        positionY: (json['positionY'] as num?)?.toDouble() ?? 0,
        width: (json['width'] as num?)?.toDouble() ?? 280,
        height: (json['height'] as num?)?.toDouble(),
        content: json['content'] as Map<String, dynamic>? ?? {},
        linkedAnnotationIds: (json['linkedAnnotationIds'] as List<dynamic>?)
                ?.whereType<String>()
                .toList() ??
            [],
      );
}

// ── API client ────────────────────────────────────────────────────────────────

class SmartWorkspaceApi {
  SmartWorkspaceApi(this._client);

  final ApiClient _client;

  Future<SmartWorkspace> getOrCreateForMatter(String matterId) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/matters/$matterId/smart-workspace',
      );
      return SmartWorkspace.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<DocumentAnnotation>> listAnnotations(String workspaceId, {String? documentId}) async {
    try {
      final qs = documentId != null ? '?documentId=$documentId' : '';
      final response = await _client.dio.get<List<dynamic>>(
        '/smart-workspaces/$workspaceId/annotations$qs',
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(DocumentAnnotation.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DocumentAnnotation> createAnnotation(
    String workspaceId, {
    required String documentId,
    required String type,
    required Map<String, dynamic> anchor,
    Map<String, dynamic>? content,
    String? color,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/smart-workspaces/$workspaceId/annotations',
        data: {
          'documentId': documentId,
          'type': type,
          'anchor': anchor,
          if (content != null) 'content': content,
          if (color != null) 'color': color,
        },
      );
      return DocumentAnnotation.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteAnnotation(String workspaceId, String annotationId) async {
    try {
      await _client.dio.delete('/smart-workspaces/$workspaceId/annotations/$annotationId');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<CanvasNode>> listCanvasNodes(String workspaceId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/smart-workspaces/$workspaceId/canvas-nodes',
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CanvasNode.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<CanvasNode> createCanvasNode(
    String workspaceId, {
    required String type,
    required double positionX,
    required double positionY,
    required Map<String, dynamic> content,
    double? width,
    List<String>? linkedAnnotationIds,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/smart-workspaces/$workspaceId/canvas-nodes',
        data: {
          'type': type,
          'positionX': positionX,
          'positionY': positionY,
          'content': content,
          if (width != null) 'width': width,
          if (linkedAnnotationIds != null) 'linkedAnnotationIds': linkedAnnotationIds,
        },
      );
      return CanvasNode.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> extractToCanvas(
    String workspaceId,
    String annotationId, {
    double? positionX,
    double? positionY,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/smart-workspaces/$workspaceId/extract-to-canvas',
        data: {
          'annotationId': annotationId,
          if (positionX != null) 'positionX': positionX,
          if (positionY != null) 'positionY': positionY,
        },
      );
      return response.data!;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteCanvasNode(String workspaceId, String nodeId) async {
    try {
      await _client.dio.delete<void>('/smart-workspaces/$workspaceId/canvas-nodes/$nodeId');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> triggerOcr(String documentId) async {
    try {
      await _client.dio.post<void>('/documents/$documentId/trigger-ocr');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
