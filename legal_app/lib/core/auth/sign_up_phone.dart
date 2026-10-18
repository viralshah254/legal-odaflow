import 'phone_countries.dart';

enum SignUpPhoneError { required, invalid }

SignUpPhoneResult resolveSignUpPhone(
  String phoneCountryCode,
  String phoneNational,
) {
  if (PhoneCountries.digitsOnly(phoneNational).isEmpty) {
    return const SignUpPhoneFailure(SignUpPhoneError.required);
  }
  final country = PhoneCountries.forIso2(phoneCountryCode);
  if (!PhoneCountries.validatePhone(country, phoneNational)) {
    return const SignUpPhoneFailure(SignUpPhoneError.invalid);
  }
  final phone = PhoneCountries.normalizePhone(country.dialCode, phoneNational);
  if (phone == null || phone.isEmpty) {
    return const SignUpPhoneFailure(SignUpPhoneError.required);
  }
  return SignUpPhoneSuccess(phone);
}

sealed class SignUpPhoneResult {
  const SignUpPhoneResult();
}

class SignUpPhoneSuccess extends SignUpPhoneResult {
  const SignUpPhoneSuccess(this.phone);

  final String phone;
}

class SignUpPhoneFailure extends SignUpPhoneResult {
  const SignUpPhoneFailure(this.error);

  final SignUpPhoneError error;
}
