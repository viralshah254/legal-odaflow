class PhoneCountry {
  const PhoneCountry({
    required this.iso2,
    required this.name,
    required this.dialCode,
    required this.pattern,
    required this.example,
  });

  final String iso2;
  final String name;
  final String dialCode;
  final RegExp pattern;
  final String example;
}

class PhoneCountries {
  PhoneCountries._();

  static final List<PhoneCountry> all = [
    PhoneCountry(
      iso2: 'US',
      name: 'United States',
      dialCode: '1',
      pattern: RegExp(r'^\d{10}$'),
      example: '201 555 0123',
    ),
    PhoneCountry(
      iso2: 'CA',
      name: 'Canada',
      dialCode: '1',
      pattern: RegExp(r'^\d{10}$'),
      example: '416 555 0123',
    ),
    PhoneCountry(
      iso2: 'GB',
      name: 'United Kingdom',
      dialCode: '44',
      pattern: RegExp(r'^\d{10,11}$'),
      example: '7911 123456',
    ),
    PhoneCountry(
      iso2: 'IN',
      name: 'India',
      dialCode: '91',
      pattern: RegExp(r'^[6-9]\d{9}$'),
      example: '98765 43210',
    ),
    PhoneCountry(
      iso2: 'KE',
      name: 'Kenya',
      dialCode: '254',
      pattern: RegExp(r'^\d{9}$'),
      example: '712 345678',
    ),
    PhoneCountry(
      iso2: 'TZ',
      name: 'Tanzania',
      dialCode: '255',
      pattern: RegExp(r'^\d{9}$'),
      example: '712 345678',
    ),
    PhoneCountry(
      iso2: 'UG',
      name: 'Uganda',
      dialCode: '256',
      pattern: RegExp(r'^\d{9}$'),
      example: '712 345678',
    ),
    PhoneCountry(
      iso2: 'RW',
      name: 'Rwanda',
      dialCode: '250',
      pattern: RegExp(r'^\d{9}$'),
      example: '781 234567',
    ),
    PhoneCountry(
      iso2: 'NG',
      name: 'Nigeria',
      dialCode: '234',
      pattern: RegExp(r'^\d{10}$'),
      example: '8012 345678',
    ),
    PhoneCountry(
      iso2: 'GH',
      name: 'Ghana',
      dialCode: '233',
      pattern: RegExp(r'^\d{9}$'),
      example: '242 345678',
    ),
    PhoneCountry(
      iso2: 'ZA',
      name: 'South Africa',
      dialCode: '27',
      pattern: RegExp(r'^\d{9}$'),
      example: '82 345 6789',
    ),
    PhoneCountry(
      iso2: 'AU',
      name: 'Australia',
      dialCode: '61',
      pattern: RegExp(r'^\d{9,10}$'),
      example: '412 345 678',
    ),
    PhoneCountry(
      iso2: 'NZ',
      name: 'New Zealand',
      dialCode: '64',
      pattern: RegExp(r'^\d{8,10}$'),
      example: '21 123 4567',
    ),
    PhoneCountry(
      iso2: 'SG',
      name: 'Singapore',
      dialCode: '65',
      pattern: RegExp(r'^\d{8}$'),
      example: '9123 4567',
    ),
    PhoneCountry(
      iso2: 'AE',
      name: 'UAE',
      dialCode: '971',
      pattern: RegExp(r'^\d{9}$'),
      example: '50 123 4567',
    ),
    PhoneCountry(
      iso2: 'PK',
      name: 'Pakistan',
      dialCode: '92',
      pattern: RegExp(r'^\d{10}$'),
      example: '301 2345678',
    ),
    PhoneCountry(
      iso2: 'BD',
      name: 'Bangladesh',
      dialCode: '880',
      pattern: RegExp(r'^\d{10}$'),
      example: '1712 345678',
    ),
    PhoneCountry(
      iso2: 'DE',
      name: 'Germany',
      dialCode: '49',
      pattern: RegExp(r'^\d{10,12}$'),
      example: '1512 3456789',
    ),
    PhoneCountry(
      iso2: 'FR',
      name: 'France',
      dialCode: '33',
      pattern: RegExp(r'^\d{9}$'),
      example: '6 12 34 56 78',
    ),
    PhoneCountry(
      iso2: 'IE',
      name: 'Ireland',
      dialCode: '353',
      pattern: RegExp(r'^\d{9}$'),
      example: '83 123 4567',
    ),
  ];

  static final Map<String, PhoneCountry> _byIso2 = {
    for (final country in all) country.iso2: country,
  };

  static PhoneCountry forIso2(String iso2) {
    return _byIso2[iso2.toUpperCase()] ?? all.first;
  }

  static String digitsOnly(String value) {
    return value.replaceAll(RegExp(r'\D'), '');
  }

  static bool validatePhone(PhoneCountry country, String local) {
    final localDigits = digitsOnly(local);
    return country.pattern.hasMatch(localDigits);
  }

  static String? normalizePhone(String dialCode, String local) {
    final localDigits = digitsOnly(local);
    if (localDigits.isEmpty) return null;
    return '+${digitsOnly(dialCode)}$localDigits';
  }
}
