import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';

class TutorialProgressEntry {
  const TutorialProgressEntry({
    this.completedAt,
    this.dismissedPanel = false,
    this.skipped = false,
  });

  final String? completedAt;
  final bool dismissedPanel;
  final bool skipped;

  Map<String, dynamic> toJson() => {
        if (completedAt != null) 'completedAt': completedAt,
        'dismissedPanel': dismissedPanel,
        if (skipped) 'skipped': skipped,
      };

  factory TutorialProgressEntry.fromJson(Map<String, dynamic> json) {
    return TutorialProgressEntry(
      completedAt: json['completedAt'] as String?,
      dismissedPanel: json['dismissedPanel'] as bool? ?? false,
      skipped: json['skipped'] as bool? ?? false,
    );
  }
}

class TutorialProgressStore {
  TutorialProgressStore(this._client);

  final ApiClient _client;
  static const _cachePrefix = 'tutorial_progress_';

  Future<Map<String, TutorialProgressEntry>> load(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_cachePrefix$userId');
    final local = raw == null
        ? <String, TutorialProgressEntry>{}
        : _decodeMap(raw);

    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/users/me/preferences',
      );
      final remoteRaw = response.data?['tutorialProgress'];
      if (remoteRaw is Map<String, dynamic>) {
        final remote = remoteRaw.map(
          (key, value) => MapEntry(
            key,
            TutorialProgressEntry.fromJson(
              Map<String, dynamic>.from(value as Map),
            ),
          ),
        );
        final merged = {...remote, ...local};
        await _saveLocal(userId, merged);
        return merged;
      }
    } catch (_) {
      // Use local cache when offline.
    }
    return local;
  }

  Future<void> markCompleted(String userId, String tourId) async {
    await _persistEntry(
      userId,
      tourId,
      TutorialProgressEntry(
        completedAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
  }

  Future<void> markSkipped(String userId, String tourId) async {
    await _persistEntry(
      userId,
      tourId,
      TutorialProgressEntry(
        completedAt: DateTime.now().toUtc().toIso8601String(),
        skipped: true,
      ),
    );
  }

  Future<void> _persistEntry(
    String userId,
    String tourId,
    TutorialProgressEntry entry,
  ) async {
    final current = await load(userId);
    final next = {...current, tourId: entry};
    await _saveLocal(userId, next);
    try {
      await _client.dio.patch<Map<String, dynamic>>(
        '/users/me/preferences',
        data: {
          'tutorialProgress': {tourId: entry.toJson()},
        },
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> _saveLocal(
    String userId,
    Map<String, TutorialProgressEntry> progress,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = progress.map(
      (key, value) => MapEntry(key, value.toJson()),
    );
    await prefs.setString('$_cachePrefix$userId', jsonEncode(encoded));
  }

  Map<String, TutorialProgressEntry> _decodeMap(String raw) {
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return decoded.map(
      (key, value) => MapEntry(
        key,
        TutorialProgressEntry.fromJson(
          Map<String, dynamic>.from(value as Map),
        ),
      ),
    );
  }
}
