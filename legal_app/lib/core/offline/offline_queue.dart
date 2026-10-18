import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Persistent offline queue that survives app restarts.
///
/// Items are serialized to JSON and stored in SharedPreferences.
/// Each item has: id, type, payload, status, retryCount, createdAt.
class OfflineQueue {
  OfflineQueue._();
  static const _key = 'offline_work_queue_v1';

  static Future<List<OfflineWorkItem>> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_key) ?? [];
    return raw
        .map((s) {
          try {
            return OfflineWorkItem.fromJson(jsonDecode(s) as Map<String, dynamic>);
          } catch (_) {
            return null;
          }
        })
        .whereType<OfflineWorkItem>()
        .toList();
  }

  static Future<void> saveAll(List<OfflineWorkItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = items.map((i) => jsonEncode(i.toJson())).toList();
    await prefs.setStringList(_key, raw);
  }

  static Future<OfflineWorkItem> enqueue({
    required String type,
    required Map<String, dynamic> payload,
    String priority = 'MEDIUM',
    String? title,
    String? description,
    String? clientName,
    String? assignedTo,
    String? dueDate,
  }) async {
    final items = await loadAll();
    final item = OfflineWorkItem(
      id: '${DateTime.now().millisecondsSinceEpoch}_${type}_${items.length}',
      type: type,
      payload: payload,
      status: OfflineWorkStatus.queued,
      priority: priority,
      title: title ?? type,
      description: description ?? 'Offline task: $type',
      clientName: clientName,
      assignedTo: assignedTo,
      dueDate: dueDate,
      retryCount: 0,
      createdAt: DateTime.now().toIso8601String(),
    );
    items.add(item);
    await saveAll(items);
    return item;
  }

  static Future<void> updateStatus(String id, OfflineWorkStatus status) async {
    final items = await loadAll();
    final idx = items.indexWhere((i) => i.id == id);
    if (idx < 0) return;
    items[idx] = items[idx].copyWith(status: status);
    await saveAll(items);
  }

  static Future<void> incrementRetry(String id) async {
    final items = await loadAll();
    final idx = items.indexWhere((i) => i.id == id);
    if (idx < 0) return;
    items[idx] = items[idx].copyWith(retryCount: items[idx].retryCount + 1);
    await saveAll(items);
  }

  static Future<void> remove(String id) async {
    final items = await loadAll();
    items.removeWhere((i) => i.id == id);
    await saveAll(items);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

enum OfflineWorkStatus { queued, uploading, failed, done }

class OfflineWorkItem {
  const OfflineWorkItem({
    required this.id,
    required this.type,
    required this.payload,
    required this.status,
    required this.priority,
    required this.title,
    required this.description,
    required this.retryCount,
    required this.createdAt,
    this.clientName,
    this.assignedTo,
    this.dueDate,
  });

  final String id;
  final String type;           // evidence_upload | form_submission | draft_request
  final Map<String, dynamic> payload;
  final OfflineWorkStatus status;
  final String priority;
  final String title;
  final String description;
  final String? clientName;
  final String? assignedTo;
  final String? dueDate;
  final int retryCount;
  final String createdAt;

  static const int maxRetries = 3;

  bool get canRetry => retryCount < maxRetries;

  String get queue => switch (type) {
        'evidence_upload' => 'Evidence',
        'form_submission' => 'Forms',
        'draft_request' => 'Drafting',
        _ => 'General',
      };

  factory OfflineWorkItem.fromJson(Map<String, dynamic> j) {
    return OfflineWorkItem(
      id: j['id'] as String,
      type: j['type'] as String,
      payload: Map<String, dynamic>.from(j['payload'] as Map? ?? {}),
      status: OfflineWorkStatus.values.firstWhere(
        (s) => s.name == j['status'],
        orElse: () => OfflineWorkStatus.queued,
      ),
      priority: j['priority'] as String? ?? 'MEDIUM',
      title: j['title'] as String? ?? j['type'] as String,
      description: j['description'] as String? ?? '',
      clientName: j['clientName'] as String?,
      assignedTo: j['assignedTo'] as String?,
      dueDate: j['dueDate'] as String?,
      retryCount: j['retryCount'] as int? ?? 0,
      createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'payload': payload,
        'status': status.name,
        'priority': priority,
        'title': title,
        'description': description,
        'clientName': clientName,
        'assignedTo': assignedTo,
        'dueDate': dueDate,
        'retryCount': retryCount,
        'createdAt': createdAt,
      };

  OfflineWorkItem copyWith({
    OfflineWorkStatus? status,
    int? retryCount,
  }) =>
      OfflineWorkItem(
        id: id,
        type: type,
        payload: payload,
        status: status ?? this.status,
        priority: priority,
        title: title,
        description: description,
        clientName: clientName,
        assignedTo: assignedTo,
        dueDate: dueDate,
        retryCount: retryCount ?? this.retryCount,
        createdAt: createdAt,
      );
}
