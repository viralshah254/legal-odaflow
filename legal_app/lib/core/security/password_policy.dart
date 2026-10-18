class PasswordPolicyResult {
  const PasswordPolicyResult({
    required this.valid,
    required this.errors,
    required this.feedback,
  });

  final bool valid;
  final List<String> errors;
  final List<String> feedback;
}

const passwordMinLength = 12;
const passwordMaxLength = 128;

const _commonPasswords = {
  '123456',
  '123456789',
  'password',
  'password123',
  'qwerty',
  'abc123',
  'letmein',
  'welcome123',
  'admin123',
  'football',
  'iloveyou',
  'monkey',
  'dragon',
  'trustno1',
  'passw0rd',
  'Password123!',
  'umbrella123',
  'lawyer123',
};

String _normalize(String value) =>
    value.toLowerCase().replaceAll(RegExp(r'[\s._-]+'), '');

bool _isCommonPassword(String password) {
  final normalized = _normalize(password);
  if (_commonPasswords.contains(normalized)) return true;
  final stripped = normalized.replaceAll(RegExp(r'[!@#\$%^&*(),.?":{}|<>0-9]+$'), '');
  return stripped.length >= 4 && _commonPasswords.contains(stripped);
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

bool _hasRepeatedCharacters(String password) {
  return RegExp(r'(.)\1{3,}').hasMatch(password);
}

bool _containsPersonalInfo(
  String password, {
  String? email,
  String? name,
  String? firmName,
}) {
  final normalizedPassword = _normalize(password);
  final tokens = <String>{};

  final local = email?.split('@').first;
  if (local != null && local.length >= 3) {
    tokens.add(_normalize(local));
  }

  for (final source in [name, firmName]) {
    if (source == null || source.trim().isEmpty) continue;
    for (final token in source.toLowerCase().split(RegExp(r'[\s@._-]+'))) {
      if (token.length >= 3) tokens.add(_normalize(token));
    }
  }

  for (final token in tokens) {
    if (normalizedPassword.contains(token)) return true;
  }
  return false;
}

PasswordPolicyResult validatePasswordPolicy(
  String password, {
  String? email,
  String? name,
  String? firmName,
}) {
  final errors = <String>[];
  final feedback = <String>[];

  if (password.length < passwordMinLength) {
    errors.add('tooShort');
    feedback.add('Use at least 12 characters.');
  }
  if (password.length > passwordMaxLength) {
    errors.add('tooLong');
    feedback.add('Use at most 128 characters.');
  }
  if (_isCommonPassword(password)) {
    errors.add('common');
    feedback.add('This password is too common.');
  }
  if (_hasSequentialDigits(password)) {
    errors.add('sequential');
    feedback.add('Avoid sequential numbers.');
  }
  if (_hasRepeatedCharacters(password)) {
    errors.add('repeated');
    feedback.add('Avoid repeating the same character.');
  }
  if (_containsPersonalInfo(password, email: email, name: name, firmName: firmName)) {
    errors.add('personalInfo');
    feedback.add('Do not use your name, email, or company name.');
  }

  return PasswordPolicyResult(
    valid: errors.isEmpty,
    errors: errors,
    feedback: feedback,
  );
}

String passwordPolicyErrorMessage(PasswordPolicyResult result) {
  switch (result.errors.firstOrNull) {
    case 'tooShort':
      return 'Password must be at least 12 characters.';
    case 'tooLong':
      return 'Password must be at most 128 characters.';
    case 'common':
      return 'This password is too common.';
    case 'sequential':
      return 'Avoid sequential numbers or keyboard patterns.';
    case 'repeated':
      return 'Avoid repeating the same character four or more times.';
    case 'personalInfo':
      return 'Do not use birthdays, names, phone numbers, or common passwords.';
    default:
      return result.feedback.firstOrNull ??
          'Password does not meet security requirements.';
  }
}
