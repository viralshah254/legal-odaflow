import 'dart:math';

import 'package:dio/dio.dart';

import 'api_client.dart';

/// Mirrors the web `StartWorkPayload` and `StartWorkResult` types from
/// `legal_web/lib/api/work-context.ts`.
///
/// C17: Flutter work context API — used by CreateMatterScreen and any flow that
/// needs to establish an atomic client+matter context before researching or drafting.
class WorkContextApi {
  WorkContextApi(this._client);

  final ApiClient _client;

  Options _tenantOptions(String? tenantId) => Options(
        headers: tenantId != null && tenantId.isNotEmpty
            ? {'X-Tenant-Id': tenantId}
            : null,
      );

  /// Atomically creates or selects a client and matter, returning the resolved
  /// work context. If [operationRequestKey] is provided, the backend treats this
  /// call as idempotent — safe to retry on network failure (B05 fix, C04).
  Future<StartWorkResult> startWork({
    required StartWorkPayload payload,
    String? tenantId,
  }) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/work-context/start',
      data: payload.toJson(),
      options: _tenantOptions(tenantId),
    );
    return StartWorkResult.fromJson(response.data!);
  }
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

enum StartWorkMode {
  /// Create a new client and optionally a new matter
  newClient,
  /// Use an existing client and optionally a new matter
  existingClient,
  /// No client or matter — for quick-unassigned work
  unassigned,
}

/// Mirrors `StartWorkPayload` from the web + backend DTO.
class StartWorkPayload {
  const StartWorkPayload({
    required this.mode,
    this.clientId,
    this.matterId,
    this.createClient,
    this.createMatter,
    this.countryCode,
    this.operationRequestKey,
  });

  final StartWorkMode mode;
  final String? clientId;
  final String? matterId;
  final CreateClientPayload? createClient;
  final CreateMatterPayload? createMatter;
  final String? countryCode;

  /// Per-intent UUID for idempotency — generate via [WorkContextOperation.newKey].
  /// Must remain constant across retries of the same logical intent.
  final String? operationRequestKey;

  Map<String, dynamic> toJson() => {
        'mode': switch (mode) {
          StartWorkMode.newClient => 'new_client',
          StartWorkMode.existingClient => 'existing_client',
          StartWorkMode.unassigned => 'unassigned',
        },
        if (clientId != null) 'clientId': clientId,
        if (matterId != null) 'matterId': matterId,
        if (createClient != null) 'createClient': createClient!.toJson(),
        if (createMatter != null) 'createMatter': createMatter!.toJson(),
        if (countryCode != null) 'countryCode': countryCode,
        if (operationRequestKey != null)
          'operationRequestKey': operationRequestKey,
      };
}

class CreateClientPayload {
  const CreateClientPayload({required this.name, this.email, this.phone});

  final String name;
  final String? email;
  final String? phone;

  Map<String, dynamic> toJson() => {
        'name': name,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      };
}

class CreateMatterPayload {
  const CreateMatterPayload({required this.title, this.jurisdiction, this.matterType});

  final String title;
  final String? jurisdiction;
  final String? matterType;

  Map<String, dynamic> toJson() => {
        'title': title,
        if (jurisdiction != null) 'jurisdiction': jurisdiction,
        if (matterType != null) 'matterType': matterType,
      };
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/// Mirrors `StartWorkResult` from the web.
class StartWorkResult {
  const StartWorkResult({
    required this.scopeKey,
    required this.standalone,
    this.clientId,
    this.matterId,
  });

  /// Opaque key scoping the session — used to route research/draft requests.
  final String scopeKey;

  /// True when working without a client (unassigned mode).
  final bool standalone;

  final String? clientId;
  final String? matterId;

  factory StartWorkResult.fromJson(Map<String, dynamic> json) {
    return StartWorkResult(
      scopeKey: json['scopeKey'] as String? ?? '',
      standalone: (json['standalone'] as bool?) ?? false,
      clientId: json['clientId'] as String?,
      matterId: json['matterId'] as String?,
    );
  }

  @override
  String toString() =>
      'StartWorkResult(scopeKey: $scopeKey, standalone: $standalone, '
      'clientId: $clientId, matterId: $matterId)';
}

// ---------------------------------------------------------------------------
// Operation key generator (UUID v4, no external package)
// ---------------------------------------------------------------------------

/// Generates a pseudo-random UUID v4 suitable for [StartWorkPayload.operationRequestKey].
/// Does not rely on the `uuid` package — uses Dart's built-in math.
///
/// Usage:
/// ```dart
/// final key = WorkContextOperation.newKey();
/// final payload = StartWorkPayload(mode: StartWorkMode.newClient, operationRequestKey: key, ...);
/// ```
class WorkContextOperation {
  WorkContextOperation._();

  static String newKey() {
    final rand = _randomBytes(16);
    // Set version (4) and variant bits
    rand[6] = (rand[6] & 0x0f) | 0x40;
    rand[8] = (rand[8] & 0x3f) | 0x80;
    final hex = rand.map((b) => b.toRadixString(16).padLeft(2, '0')).toList();
    return '${hex.sublist(0, 4).join()}-'
        '${hex.sublist(4, 6).join()}-'
        '${hex.sublist(6, 8).join()}-'
        '${hex.sublist(8, 10).join()}-'
        '${hex.sublist(10, 16).join()}';
  }

  static final Random _random = Random.secure();

  static List<int> _randomBytes(int length) =>
      List<int>.generate(length, (_) => _random.nextInt(256));
}
