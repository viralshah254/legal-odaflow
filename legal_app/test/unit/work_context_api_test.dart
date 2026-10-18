// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/network/work_context_api.dart';

/// C17 – Flutter work context API behavioral contract tests
///
/// Tests the request/response payload shape and idempotency key generation.
/// These run in the standard Flutter unit test runner without a real device.
/// Device-level integration (create_matter_screen round-trip to the backend)
/// is tracked separately as a device test before release-candidate.
void main() {
  group('StartWorkPayload serialization', () {
    test('new_client mode includes createClient and createMatter', () {
      final payload = StartWorkPayload(
        mode: StartWorkMode.newClient,
        createClient: const CreateClientPayload(name: 'Jane Doe'),
        createMatter: const CreateMatterPayload(
          title: 'Bail Application',
          jurisdiction: 'Nairobi',
          matterType: 'Litigation',
        ),
        countryCode: 'KE',
        operationRequestKey: 'test-key-001',
      );

      final json = payload.toJson();

      expect(json['mode'], 'new_client');
      expect((json['createClient'] as Map)['name'], 'Jane Doe');
      expect((json['createMatter'] as Map)['title'], 'Bail Application');
      expect((json['createMatter'] as Map)['jurisdiction'], 'Nairobi');
      expect(json['countryCode'], 'KE');
      expect(json['operationRequestKey'], 'test-key-001');
    });

    test('existing_client mode omits createClient', () {
      final payload = StartWorkPayload(
        mode: StartWorkMode.existingClient,
        clientId: 'client-001',
        operationRequestKey: 'retry-key',
      );

      final json = payload.toJson();

      expect(json['mode'], 'existing_client');
      expect(json['clientId'], 'client-001');
      expect(json.containsKey('createClient'), isFalse);
    });

    test('unassigned mode serializes correctly', () {
      final payload = StartWorkPayload(
        mode: StartWorkMode.unassigned,
        countryCode: 'IN',
        operationRequestKey: 'unassigned-key',
      );

      final json = payload.toJson();
      expect(json['mode'], 'unassigned');
      expect(json.containsKey('clientId'), isFalse);
      expect(json.containsKey('createClient'), isFalse);
    });

    test('null optional fields are omitted from JSON', () {
      final payload = StartWorkPayload(mode: StartWorkMode.unassigned);
      final json = payload.toJson();

      expect(json.containsKey('clientId'), isFalse);
      expect(json.containsKey('matterId'), isFalse);
      expect(json.containsKey('createClient'), isFalse);
      expect(json.containsKey('createMatter'), isFalse);
      expect(json.containsKey('countryCode'), isFalse);
      expect(json.containsKey('operationRequestKey'), isFalse);
    });

    test('countryCode from jurisdiction picker flows through payload (B05 parity)', () {
      // The country code must come from the user's jurisdiction selection,
      // not a hard-coded default. This mirrors B05 fix on the web.
      const selectedCountry = 'KE';
      final payload = StartWorkPayload(
        mode: StartWorkMode.newClient,
        createClient: const CreateClientPayload(name: 'Test'),
        countryCode: selectedCountry,
        operationRequestKey: 'k1',
      );

      expect(payload.toJson()['countryCode'], 'KE');
      expect(payload.toJson()['countryCode'], isNot('IN'));
    });
  });

  group('StartWorkResult deserialization', () {
    test('fromJson parses scopeKey, standalone, clientId, matterId', () {
      final result = StartWorkResult.fromJson({
        'scopeKey': 'scope-abc-123',
        'standalone': false,
        'clientId': 'client-xyz',
        'matterId': 'matter-uvw',
      });

      expect(result.scopeKey, 'scope-abc-123');
      expect(result.standalone, isFalse);
      expect(result.clientId, 'client-xyz');
      expect(result.matterId, 'matter-uvw');
    });

    test('fromJson handles standalone:true with null clientId', () {
      final result = StartWorkResult.fromJson({
        'scopeKey': 'scope-unassigned',
        'standalone': true,
        'clientId': null,
        'matterId': null,
      });

      expect(result.standalone, isTrue);
      expect(result.clientId, isNull);
      expect(result.matterId, isNull);
    });

    test('fromJson uses safe defaults for missing fields', () {
      final result = StartWorkResult.fromJson({});
      expect(result.scopeKey, isEmpty);
      expect(result.standalone, isFalse);
    });
  });

  group('WorkContextOperation key generation (B05 parity)', () {
    test('newKey() returns a well-formed UUID v4', () {
      final key = WorkContextOperation.newKey();

      // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      final uuidRegex = RegExp(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      );
      expect(uuidRegex.hasMatch(key), isTrue,
          reason: 'UUID v4 format expected, got: $key');
    });

    test('successive keys are unique', () {
      final keys = List.generate(20, (_) => WorkContextOperation.newKey());
      final unique = keys.toSet();
      expect(unique.length, equals(keys.length),
          reason: 'All 20 generated keys must be unique');
    });

    test('key is ASCII-safe for HTTP header transport', () {
      final key = WorkContextOperation.newKey();
      // Must contain only hex digits and hyphens
      expect(key.codeUnits.every((c) =>
          (c >= 48 && c <= 57) || // 0-9
          (c >= 97 && c <= 102) || // a-f
          c == 45 // hyphen
      ), isTrue);
    });
  });

  group('CreateClientPayload', () {
    test('serializes name, email, phone', () {
      const payload = CreateClientPayload(
        name: 'Aarav Kumar',
        email: 'aarav@example.com',
        phone: '+919876543210',
      );

      final json = payload.toJson();
      expect(json['name'], 'Aarav Kumar');
      expect(json['email'], 'aarav@example.com');
      expect(json['phone'], '+919876543210');
    });

    test('omits null email and phone', () {
      const payload = CreateClientPayload(name: 'Anonymous Client');
      final json = payload.toJson();
      expect(json.containsKey('email'), isFalse);
      expect(json.containsKey('phone'), isFalse);
    });
  });

  group('CreateMatterPayload', () {
    test('serializes title, jurisdiction, matterType', () {
      const payload = CreateMatterPayload(
        title: 'Consumer Complaint — Healthcare',
        jurisdiction: 'Karnataka State Consumer Commission',
        matterType: 'Litigation',
      );

      final json = payload.toJson();
      expect(json['title'], 'Consumer Complaint — Healthcare');
      expect(json['jurisdiction'], 'Karnataka State Consumer Commission');
      expect(json['matterType'], 'Litigation');
    });

    test('omits null fields', () {
      const payload = CreateMatterPayload(title: 'Draft Only');
      final json = payload.toJson();
      expect(json.containsKey('jurisdiction'), isFalse);
      expect(json.containsKey('matterType'), isFalse);
    });
  });
}
