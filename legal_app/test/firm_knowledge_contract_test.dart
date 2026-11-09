import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/network/firm_knowledge_api.dart';

void main() {
  test(
    'missing capabilities deny submission and independent self approval',
    () {
      final list = FirmKnowledgeList.fromJson({});
      expect(list.canSubmit, isFalse);
      expect(list.canReview, isFalse);
      expect(list.independentReviewRequired, isTrue);
    },
  );
  test('review binds to the exact loaded revision and content', () {
    final item = FirmKnowledgeItem.fromJson({
      'id': 'item',
      'tenantId': 'firm',
      'revision': 7,
      'contentHash': 'sha256',
      'rightsExpired': true,
    });
    expect(item.reviewPayload(note: '  Checked source  '), {
      'expectedRevision': 7,
      'expectedContentHash': 'sha256',
      'selfReviewConfirmed': false,
      'firmWideConfirmed': false,
      'note': 'Checked source',
    });
    expect(item.rightsExpired, isTrue);
  });
}
