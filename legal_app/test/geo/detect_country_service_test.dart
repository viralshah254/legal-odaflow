import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/geo/detect_country_service.dart';
import 'package:umbrella/core/network/api_client.dart';

class _Client extends Fake implements ApiClient {
  _Client(this.dio);
  @override
  final Dio dio;
}

void main() {
  test('client geo preserves countries outside the four detailed legal catalogs', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (request, handler) {
      expect(request.path, '/geo/client');
      handler.resolve(Response(requestOptions: request, statusCode: 200,
        data: <String, dynamic>{'countryCode': 'UG', 'source': 'cf-ipcountry'}));
    }));
    final detected = await DetectCountryService(_Client(dio)).detectFromBackend();
    expect(detected?.countryCode, 'UG');
  });

  test('unknown client location does not invent a US or India default', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (request, handler) {
      handler.resolve(Response(requestOptions: request, statusCode: 200,
        data: <String, dynamic>{'countryCode': 'XX', 'source': 'none'}));
    }));
    expect(await DetectCountryService(_Client(dio)).detectFromBackend(), isNull);
  });
}
