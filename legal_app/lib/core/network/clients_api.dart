import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class ClientContactPersonInput {
  const ClientContactPersonInput({
    required this.name,
    this.role,
    this.email,
    this.phone,
  });

  final String name;
  final String? role;
  final String? email;
  final String? phone;

  Map<String, dynamic> toJson() => {
        'name': name,
        if (role != null && role!.isNotEmpty) 'role': role,
        if (email != null && email!.isNotEmpty) 'email': email,
        if (phone != null && phone!.isNotEmpty) 'phone': phone,
      };
}

class ClientsApi {
  ClientsApi(this._client);

  final ApiClient _client;

  Future<List<FirmClient>> listClients({
    required String tenantId,
    String? search,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/clients',
        queryParameters: search != null && search.isNotEmpty
            ? {'search': search}
            : null,
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(FirmClient.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<FirmClientDetail> getClient({
    required String tenantId,
    required String clientId,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/clients/$clientId',
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return FirmClientDetail.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<FirmClient> createClient({
    required String tenantId,
    required String name,
    required String countryCode,
    String? email,
    String? phone,
    String type = 'INDIVIDUAL',
    List<ClientContactPersonInput>? contactPeople,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/clients',
        data: {
          'name': name,
          'countryCode': countryCode,
          'type': type,
          if (email != null && email.isNotEmpty) 'email': email,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          if (contactPeople != null && contactPeople.isNotEmpty)
            'contactPeople': contactPeople.map((c) => c.toJson()).toList(),
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return FirmClient.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<FirmClient> patchClient({
    required String tenantId,
    required String clientId,
    String? email,
    String? phone,
  }) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/clients/$clientId',
        data: {
          if (email != null) 'email': email,
          if (phone != null) 'phone': phone,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return FirmClient.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
