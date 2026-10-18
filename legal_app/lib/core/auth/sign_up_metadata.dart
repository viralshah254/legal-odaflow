typedef AccountType = String; // 'CONSUMER' | 'LAWYER'
typedef PracticeType = String; // 'SOLO' | 'FIRM'

class SignUpMetadata {
  const SignUpMetadata({
    required this.accountType,
    required this.practiceType,
    required this.countryCode,
    this.firmName,
    this.name,
    this.jurisdiction,
  });

  final AccountType accountType;
  final PracticeType practiceType;
  final String countryCode;
  final String? firmName;
  final String? name;
  final String? jurisdiction;
}

String? resolveFirmName({
  required String accountType,
  required String practiceType,
  String? firmName,
  String? name,
  required String defaultPracticeName,
}) {
  if (accountType != 'LAWYER') return null;
  if (practiceType == 'SOLO') {
    final trimmedFirm = firmName?.trim();
    if (trimmedFirm != null && trimmedFirm.isNotEmpty) return trimmedFirm;
    final trimmedName = name?.trim();
    if (trimmedName != null && trimmedName.isNotEmpty) return trimmedName;
    return defaultPracticeName;
  }
  return firmName?.trim();
}

String? validateSignUpMetadata({
  required String accountType,
  required String practiceType,
  String? firmName,
  required String? countryCode,
  required String confirmCountryMessage,
  required String firmNameRequiredMessage,
}) {
  if (countryCode == null || countryCode.length < 2) {
    return confirmCountryMessage;
  }
  if (accountType == 'LAWYER' &&
      practiceType == 'FIRM' &&
      (firmName == null || firmName.trim().length < 2)) {
    return firmNameRequiredMessage;
  }
  return null;
}
