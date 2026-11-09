import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:umbrella/core/consent/ai_inference_consent_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test('permission is specific to the account and current recipient disclosure', () async {
    await AiInferenceConsentStorage.setGranted(true, scope: 'alice:firm', policyVersion: 'recipients-v1');
    expect(await AiInferenceConsentStorage.hasGranted(scope: 'alice:firm', policyVersion: 'recipients-v1'), isTrue);
    expect(await AiInferenceConsentStorage.hasGranted(scope: 'bob:firm', policyVersion: 'recipients-v1'), isFalse);
    expect(await AiInferenceConsentStorage.hasGranted(scope: 'alice:firm', policyVersion: 'recipients-v2'), isFalse);
  });
  test('old install-wide consent cannot silently authorize new processing', () async {
    SharedPreferences.setMockInitialValues({'ai_inference_consent_granted': true});
    expect(await AiInferenceConsentStorage.hasGranted(scope: 'alice:firm', policyVersion: 'v2'), isFalse);
  });
  test('revocation removes all local scope decisions', () async {
    await AiInferenceConsentStorage.setGranted(true, scope: 'alice:firm', policyVersion: 'v1');
    await AiInferenceConsentStorage.reset();
    expect(await AiInferenceConsentStorage.hasGranted(scope: 'alice:firm', policyVersion: 'v1'), isFalse);
    expect(await AiInferenceConsentStorage.hasAnswered(), isFalse);
  });
}
