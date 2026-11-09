import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/config/app_config.dart';

void main() {
  test('release-default relative checkout opens the hosted web application', () {
    expect(AppConfig.resolveCheckoutUrl('/app/billing?plan=firm'),
        'https://legal.odaflow.com/app/billing?plan=firm');
  });
  test('provider-issued absolute checkout URLs retain their origin', () {
    expect(AppConfig.resolveCheckoutUrl('https://checkout.stripe.com/session'),
        'https://checkout.stripe.com/session');
  });
}
