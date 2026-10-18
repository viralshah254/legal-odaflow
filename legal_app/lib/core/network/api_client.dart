import 'package:dio/dio.dart';
import 'dart:convert';

import '../config/app_config.dart';
import '../config/locale_config.dart';
import '../storage/token_storage.dart';

class ApiClient {
  ApiClient(this._tokenStorage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final locale = currentAcceptLanguage;
          if (locale.isNotEmpty) {
            options.headers['Accept-Language'] = locale;
          }
          if (options.extra['skipAuth'] == true) {
            handler.next(options);
            return;
          }
          final token = await _tokenStorage.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final statusCode = error.response?.statusCode;
          final alreadyRetried =
              error.requestOptions.extra['authRetry'] == true;
          if (statusCode != 401 || alreadyRetried) {
            handler.next(error);
            return;
          }

          final refreshed = await _refreshAccessToken();
          if (refreshed == null) {
            await _tokenStorage.clearTokens();
            handler.next(error);
            return;
          }

          try {
            final retryOptions = error.requestOptions;
            retryOptions.extra['authRetry'] = true;
            retryOptions.headers['Authorization'] = 'Bearer $refreshed';
            final response = await _dio.fetch<dynamic>(retryOptions);
            handler.resolve(response);
          } on DioException catch (retryError) {
            handler.next(retryError);
          }
        },
      ),
    );
  }

  final TokenStorage _tokenStorage;
  late final Dio _dio;

  Dio get dio => _dio;

  Future<String?> _refreshAccessToken() async {
    final refreshToken = await _tokenStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;

    try {
      final refreshDio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        ),
      );
      final response = await refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data;
      final accessToken = data?['accessToken'] as String?;
      final nextRefreshToken = data?['refreshToken'] as String? ?? refreshToken;
      if (accessToken == null || accessToken.isEmpty) return null;

      final userJson = data?['user'] is Map<String, dynamic>
          ? jsonEncode(data!['user'] as Map<String, dynamic>)
          : null;
      await _tokenStorage.saveTokens(
        accessToken: accessToken,
        refreshToken: nextRefreshToken,
        userJson: userJson,
      );
      return accessToken;
    } catch (_) {
      return null;
    }
  }
}

class ApiException implements Exception {
  ApiException(
    this.message, {
    this.statusCode,
    this.kind = ApiErrorKind.unknown,
    this.code,
    this.retryAfterSeconds,
  });

  factory ApiException.fromDio(DioException error) {
    final response = error.response;
    final data = response?.data;
    final kind = _kindFromDio(error);
    String message = _defaultMessageForKind(kind);
    String? code;
    int? retryAfterSeconds;

    if (data is Map<String, dynamic>) {
      final parsed = _parseApiErrorPayload(data);
      if (parsed.message != null && parsed.message!.trim().isNotEmpty) {
        message = parsed.message!;
      }
      code = parsed.code;
      retryAfterSeconds = parsed.retryAfterSeconds;
    } else if (kind == ApiErrorKind.unknown &&
        error.message != null &&
        !_isTechnicalDioMessage(error.message!)) {
      message = error.message!;
    }

    // Detect AI_BUSY (503) as a special retryable kind
    final resolvedKind =
        (code == 'AI_BUSY' || response?.statusCode == 503) &&
                kind == ApiErrorKind.server
            ? ApiErrorKind.aibusy
            : kind;

    return ApiException(
      message,
      statusCode: response?.statusCode,
      kind: resolvedKind,
      code: code,
      retryAfterSeconds: retryAfterSeconds,
    );
  }

  final String message;
  final int? statusCode;
  final ApiErrorKind kind;
  final String? code;
  final int? retryAfterSeconds;

  bool get isRetryable =>
      kind == ApiErrorKind.timeout ||
      kind == ApiErrorKind.network ||
      kind == ApiErrorKind.connection ||
      kind == ApiErrorKind.aibusy;

  @override
  String toString() => message;
}

enum ApiErrorKind {
  network,
  connection,
  timeout,
  server,
  unauthorized,
  validation,
  unknown,
  /// Provider is under high demand — retryable with backoff.
  aibusy,
}

ApiErrorKind _kindFromDio(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return ApiErrorKind.timeout;
    case DioExceptionType.connectionError:
      return ApiErrorKind.connection;
    case DioExceptionType.badResponse:
      final code = error.response?.statusCode;
      if (code == 401 || code == 403) return ApiErrorKind.unauthorized;
      if (code != null && code >= 400 && code < 500) {
        return ApiErrorKind.validation;
      }
      return ApiErrorKind.server;
    case DioExceptionType.cancel:
      return ApiErrorKind.unknown;
    case DioExceptionType.badCertificate:
    case DioExceptionType.unknown:
      return ApiErrorKind.network;
  }
}

String _defaultMessageForKind(ApiErrorKind kind) {
  switch (kind) {
    case ApiErrorKind.timeout:
      return 'The request timed out. Please try again.';
    case ApiErrorKind.connection:
      return 'Could not reach the server. Check your connection and try again.';
    case ApiErrorKind.network:
      return 'Network error. Please try again.';
    case ApiErrorKind.unauthorized:
      return 'You are not authorized to perform this action.';
    case ApiErrorKind.server:
      return 'Something went wrong. Please try again.';
    case ApiErrorKind.validation:
      return 'Please check your input and try again.';
    case ApiErrorKind.unknown:
      return 'Something went wrong';
    case ApiErrorKind.aibusy:
      return 'AI is under high demand. Retrying automatically…';
  }
}

({String? message, String? code, int? retryAfterSeconds}) _parseApiErrorPayload(
  Map<String, dynamic> data,
) {
  final envelopes = <Map<String, dynamic>>[data];
  final nestedError = data['error'];
  if (nestedError is Map<String, dynamic>) {
    envelopes.add(nestedError);
  }

  String? message;
  String? code;
  int? retryAfterSeconds;

  for (final envelope in envelopes) {
    final apiMessage = envelope['message'];
    if (message == null) {
      if (apiMessage is String && apiMessage.trim().isNotEmpty) {
        message = apiMessage;
      } else if (apiMessage is List && apiMessage.isNotEmpty) {
        message = apiMessage.first.toString();
      }
    }

    if (code == null) {
      final envelopeCode = envelope['code'];
      if (envelopeCode is String && envelopeCode.isNotEmpty) {
        code = envelopeCode;
      }
    }

    if (retryAfterSeconds == null) {
      final retry = envelope['retryAfterSeconds'];
      if (retry is int) {
        retryAfterSeconds = retry;
      }
    }

    final details = envelope['details'];
    if (details is Map<String, dynamic>) {
      if (code == null) {
        final detailsCode = details['code'];
        if (detailsCode is String && detailsCode.isNotEmpty) {
          code = detailsCode;
        }
      }
      if (retryAfterSeconds == null) {
        final retry = details['retryAfterSeconds'];
        if (retry is int) {
          retryAfterSeconds = retry;
        }
      }
    }
  }

  if (message == null) {
    final topLevelMessage = data['message'];
    if (topLevelMessage is String && topLevelMessage.trim().isNotEmpty) {
      message = topLevelMessage;
    }
  }

  if (code == null) {
    final topLevelCode = data['code'];
    if (topLevelCode is String && topLevelCode.isNotEmpty) {
      code = topLevelCode;
    }
  }

  return (message: message, code: code, retryAfterSeconds: retryAfterSeconds);
}

bool _isTechnicalDioMessage(String message) {
  final lower = message.toLowerCase();
  return lower.contains('requestoptions') ||
      lower.contains('receive timeout') ||
      lower.contains('connection timeout') ||
      lower.contains('socketexception') ||
      lower.contains('failed host lookup') ||
      lower.contains('handshakeexception');
}
