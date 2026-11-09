import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/network/ai_api.dart';
import 'package:umbrella/core/network/api_client.dart';

class _Client extends Fake implements ApiClient {
  _Client(this.dio);
  @override
  final Dio dio;
}

void main() {
  test('all section lookup routes preserve the requested legal country', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (request, handler) {
      requests.add(request);
      handler.resolve(Response<dynamic>(
        requestOptions: request,
        statusCode: 200,
        data: request.path.endsWith('/section-finder')
            ? <String, dynamic>{'query': 'evidence', 'matches': [], 'total': 0}
            : <dynamic>[],
      ));
    }));
    final api = AiApi(_Client(dio));
    await api.runSectionFinder(query: 'evidence', countryCode: 'ke', matterId: 'matter-ke');
    await api.suggestSection('evidence', countryCode: 'us');
    await api.getPopularSections(countryCode: 'gb');
    expect(requests.map((r) => r.queryParameters['countryCode']), ['KE', 'US', 'GB']);
    expect(requests.first.queryParameters['matterId'], 'matter-ke');
  });
}
