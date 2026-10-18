import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

/// Checks password against Have I Been Pwned (k-anonymity API).
Future<bool> isPasswordBreached(String password) async {
  if (password.isEmpty) return false;

  final digest = sha1.convert(utf8.encode(password));
  final sha1Hex = digest.toString().toUpperCase();
  final prefix = sha1Hex.substring(0, 5);
  final suffix = sha1Hex.substring(5);

  try {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: const {'Add-Padding': 'true'},
      ),
    );
    final response = await dio.get<String>(
      'https://api.pwnedpasswords.com/range/$prefix',
    );
    final body = response.data ?? '';
    return body.split('\n').any((line) => line.startsWith('$suffix:'));
  } catch (_) {
    // Non-blocking — backend also checks on register.
    return false;
  }
}
