import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_client.dart';

class BillingApi {
  BillingApi(this._client);

  final ApiClient _client;

  Future<List<FirmInvoice>> listInvoices({
    required String tenantId,
    String? status,
    String? matterId,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/billing/invoices',
        queryParameters: status != null && status.isNotEmpty
            ? {'status': status}
            : null,
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      final invoices = (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(FirmInvoice.fromJson)
          .toList();
      if (matterId == null || matterId.isEmpty) return invoices;
      return invoices.where((invoice) => invoice.matterId == matterId).toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<FirmInvoice> createInvoice({
    required String tenantId,
    String? matterId,
    String? clientId,
    String? description,
    required double amount,
    required String currency,
    required String dueDate,
    String billingModel = 'FIXED',
    String status = 'DRAFT',
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/finance/invoices',
        data: {
          'invoiceNumber': 'INV-${DateTime.now().millisecondsSinceEpoch}',
          'amount': amount,
          'currency': currency,
          'dueDate': dueDate,
          'billingModel': billingModel,
          'status': status,
          if (matterId != null && matterId.isNotEmpty) 'matterId': matterId,
          if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
          if (description != null && description.isNotEmpty)
            'description': description,
        },
        options: Options(headers: {'X-Tenant-Id': tenantId}),
      );
      return FirmInvoice.fromJson(response.data ?? {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
