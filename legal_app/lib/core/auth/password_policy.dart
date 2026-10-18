import '../../l10n/app_localizations.dart';

const passwordMinLength = 12;
const passwordMaxLength = 128;

class PasswordPolicyContext {
  const PasswordPolicyContext({
    this.email,
    this.name,
    this.firmName,
    this.phone,
  });

  final String? email;
  final String? name;
  final String? firmName;
  final String? phone;
}

enum PasswordPolicyError {
  tooShort,
  tooLong,
  common,
  sequential,
  repeated,
  personalInfo,
  tooWeak,
}

class PasswordPolicyResult {
  const PasswordPolicyResult({
    required this.valid,
    required this.errors,
  });

  final bool valid;
  final List<PasswordPolicyError> errors;
}

const _commonPasswords = {
  '123456',
  '123456789',
  '12345678',
  'password',
  'password123',
  'qwerty',
  'abc123',
  'letmein',
  'welcome',
  'welcome123',
  'admin',
  'admin123',
  'football',
  'iloveyou',
  'monkey',
  'dragon',
  'master',
  'login',
  'passw0rd',
  'trustno1',
  'sunshine',
  'princess',
  'shadow',
  'superman',
  'baseball',
  'whatever',
  'qazwsx',
  'asdfgh',
  'zxcvbn',
  '1q2w3e4r',
  'password123!',
  'umbrella123',
  'lawyer123',
};

const _keyboardPatterns = [
  'qwerty',
  'asdfgh',
  'zxcvbn',
  'qazwsx',
  'abcdef',
  '1qaz2wsx',
];

String _normalize(String value) =>
    value.toLowerCase().replaceAll(RegExp(r'[\s._-]+'), '');

List<String> _extractTokens(String? value) {
  if (value == null || value.trim().isEmpty) return [];
  return value
      .trim()
      .toLowerCase()
      .split(RegExp(r'[\s@._-]+'))
      .where((token) => token.length >= 3)
      .toList();
}

bool _containsPersonalInfo(String password, PasswordPolicyContext? context) {
  if (context == null) return false;
  final normalizedPassword = _normalize(password);
  final tokens = <String>{};

  final local = context.email?.split('@').first;
  if (local != null && local.length >= 3) {
    tokens.add(_normalize(local));
  }
  for (final token in [
    ..._extractTokens(context.name),
    ..._extractTokens(context.firmName),
  ]) {
    tokens.add(_normalize(token));
  }
  if (context.phone != null) {
    final digits = context.phone!.replaceAll(RegExp(r'\D'), '');
    if (digits.length >= 4) {
      tokens.add(digits);
      tokens.add(digits.substring(digits.length - 4));
    }
  }

  return tokens.any(normalizedPassword.contains);
}

bool _hasSequentialDigits(String password) {
  final digits = password.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 4) return false;
  var ascending = 1;
  var descending = 1;
  for (var i = 1; i < digits.length; i++) {
    final prev = int.parse(digits[i - 1]);
    final curr = int.parse(digits[i]);
    ascending = curr == prev + 1 ? ascending + 1 : 1;
    descending = curr == prev - 1 ? descending + 1 : 1;
    if (ascending >= 4 || descending >= 4) return true;
  }
  return false;
}

bool _hasSequentialLetters(String password) {
  final letters = password.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
  if (letters.length < 4) return false;
  for (var i = 0; i <= letters.length - 4; i++) {
    final slice = letters.substring(i, i + 4);
    if (_keyboardPatterns.any((pattern) => pattern.contains(slice))) {
      return true;
    }
    var ascending = true;
    var descending = true;
    for (var j = 1; j < slice.length; j++) {
      final prev = slice.codeUnitAt(j - 1);
      final curr = slice.codeUnitAt(j);
      if (curr != prev + 1) ascending = false;
      if (curr != prev - 1) descending = false;
    }
    if (ascending || descending) return true;
  }
  return false;
}

bool _isCommonPassword(String password) {
  final normalized = _normalize(password);
  if (_commonPasswords.contains(normalized)) return true;
  final stripped = normalized.replaceAll(RegExp(r'[\W\d]+$'), '');
  return stripped.length >= 4 && _commonPasswords.contains(stripped);
}

bool _isTooWeakHeuristic(String password) {
  if (password.length >= 16) return false;
  final hasUpper = password.contains(RegExp(r'[A-Z]'));
  final hasLower = password.contains(RegExp(r'[a-z]'));
  final hasDigit = password.contains(RegExp(r'[0-9]'));
  final hasSymbol = password.contains(RegExp(r'[^A-Za-z0-9]'));
  final classes = [hasUpper, hasLower, hasDigit, hasSymbol].where((v) => v).length;
  return classes < 2;
}

PasswordPolicyResult validatePasswordPolicy(
  String password, {
  PasswordPolicyContext? context,
}) {
  final errors = <PasswordPolicyError>[];

  if (password.length < passwordMinLength) {
    errors.add(PasswordPolicyError.tooShort);
  }
  if (password.length > passwordMaxLength) {
    errors.add(PasswordPolicyError.tooLong);
  }
  if (_isCommonPassword(password)) {
    errors.add(PasswordPolicyError.common);
  }
  if (_hasSequentialDigits(password) || _hasSequentialLetters(password)) {
    errors.add(PasswordPolicyError.sequential);
  }
  if (RegExp(r'(.)\1{3,}').hasMatch(password)) {
    errors.add(PasswordPolicyError.repeated);
  }
  if (_containsPersonalInfo(password, context)) {
    errors.add(PasswordPolicyError.personalInfo);
  }
  if (errors.isEmpty &&
      password.length >= passwordMinLength &&
      password.length <= passwordMaxLength &&
      _isTooWeakHeuristic(password)) {
    errors.add(PasswordPolicyError.tooWeak);
  }

  return PasswordPolicyResult(valid: errors.isEmpty, errors: errors);
}

String passwordPolicyErrorMessage(
  PasswordPolicyError error,
  AppLocalizations l10n,
) {
  switch (error) {
    case PasswordPolicyError.tooShort:
      return l10n.authPasswordTooShort;
    case PasswordPolicyError.tooLong:
      return l10n.authPasswordTooLong;
    case PasswordPolicyError.common:
      return l10n.authPasswordTooCommon;
    case PasswordPolicyError.sequential:
      return l10n.authPasswordSequential;
    case PasswordPolicyError.repeated:
      return l10n.authPasswordRepeated;
    case PasswordPolicyError.personalInfo:
      return l10n.authPasswordPersonalInfo;
    case PasswordPolicyError.tooWeak:
      return l10n.authPasswordTooWeak;
  }
}

String? firstPasswordPolicyError(
  String password,
  AppLocalizations l10n, {
  PasswordPolicyContext? context,
}) {
  final result = validatePasswordPolicy(password, context: context);
  if (result.valid || result.errors.isEmpty) return null;
  return passwordPolicyErrorMessage(result.errors.first, l10n);
}
