import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_providers.dart';
import 'api_client.dart';

const _kPartyRoles = [
  'CLIENT',
  'OPPOSING_PARTY',
  'OPPOSING_COUNSEL',
  'WITNESS',
  'EXPERT',
  'JUDGE',
  'INSURER',
  'GUARANTOR',
  'THIRD_PARTY',
  'OTHER',
];

List<String> get partyRoles => _kPartyRoles;

String partyRoleLabel(String role) {
  const labels = {
    'CLIENT': 'Client',
    'OPPOSING_PARTY': 'Opposing Party',
    'OPPOSING_COUNSEL': 'Opposing Counsel',
    'WITNESS': 'Witness',
    'EXPERT': 'Expert / Consultant',
    'JUDGE': 'Judge / Arbitrator',
    'INSURER': 'Insurer',
    'GUARANTOR': 'Guarantor',
    'THIRD_PARTY': 'Third Party',
    'OTHER': 'Other',
  };
  return labels[role] ?? role;
}

class MatterPartyRecord {
  const MatterPartyRecord({
    required this.id,
    required this.matterId,
    required this.name,
    required this.role,
    this.organization,
    this.email,
    this.phone,
    this.notes,
    required this.createdAt,
  });

  factory MatterPartyRecord.fromJson(Map<String, dynamic> json) {
    return MatterPartyRecord(
      id: json['id'] as String? ?? '',
      matterId: json['matterId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      role: json['role'] as String? ?? 'OTHER',
      organization: json['organization'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      notes: json['notes'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  final String id;
  final String matterId;
  final String name;
  final String role;
  final String? organization;
  final String? email;
  final String? phone;
  final String? notes;
  final String createdAt;
}

class MatterPartiesApi {
  const MatterPartiesApi(this._client);
  final ApiClient _client;

  Options _opts(String tenantId) =>
      Options(headers: {'X-Tenant-Id': tenantId});

  Future<List<MatterPartyRecord>> listParties({
    required String tenantId,
    required String matterId,
  }) async {
    final resp = await _client.dio.get<dynamic>(
      '/matters/$matterId/parties',
      options: _opts(tenantId),
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(MatterPartyRecord.fromJson)
        .toList();
  }

  Future<MatterPartyRecord> createParty({
    required String tenantId,
    required String matterId,
    required String name,
    required String role,
    String? organization,
    String? email,
    String? phone,
    String? notes,
  }) async {
    final resp = await _client.dio.post<dynamic>(
      '/matters/$matterId/parties',
      data: {
        'name': name,
        'role': role,
        if (organization != null && organization.isNotEmpty)
          'organization': organization,
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
      options: _opts(tenantId),
    );
    return MatterPartyRecord.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<MatterPartyRecord> updateParty({
    required String tenantId,
    required String matterId,
    required String partyId,
    String? name,
    String? role,
    String? organization,
    String? email,
    String? phone,
    String? notes,
  }) async {
    final resp = await _client.dio.patch<dynamic>(
      '/matters/$matterId/parties/$partyId',
      data: {
        if (name != null) 'name': name,
        if (role != null) 'role': role,
        if (organization != null) 'organization': organization,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
        if (notes != null) 'notes': notes,
      },
      options: _opts(tenantId),
    );
    return MatterPartyRecord.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> deleteParty({
    required String tenantId,
    required String matterId,
    required String partyId,
  }) async {
    await _client.dio.delete<dynamic>(
      '/matters/$matterId/parties/$partyId',
      options: _opts(tenantId),
    );
  }
}

final matterPartiesApiProvider = Provider<MatterPartiesApi>((ref) {
  return MatterPartiesApi(ref.watch(apiClientProvider));
});
