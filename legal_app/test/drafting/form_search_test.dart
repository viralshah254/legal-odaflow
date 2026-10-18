import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/drafting/form_search.dart';

void main() {
  group('expandSearchTokens', () {
    test('expands maintenance query tokens', () {
      final tokens = expandSearchTokens('wife maintenance under crpc 125');
      expect(tokens, contains('maintenance'));
      expect(tokens, contains('family'));
    });

    test('expands divorce tokens', () {
      final tokens = expandSearchTokens('mutual consent divorce');
      expect(tokens, contains('divorce'));
    });
  });

  group('searchCuratedFormats', () {
    test('finds divorce-related india formats', () {
      final hits = searchCuratedFormats('divorce petition', 'IN');
      expect(hits, isNotEmpty);
      expect(hits.first.label.toLowerCase(), anyOf(contains('divorce'), contains('mutual')));
    });

    test('typo tolerate maintainance', () {
      final hits = searchCuratedFormats('maintainance petition wife', 'IN');
      expect(hits, isNotEmpty);
    });

    test('returns empty for short query', () {
      expect(searchCuratedFormats('a', 'IN'), isEmpty);
    });

    test('filters by US country', () {
      final hits = searchCuratedFormats('motion dismiss', 'US');
      expect(hits, isNotEmpty);
      expect(hits.first.countryCode, 'US');
    });
  });

  group('scoreTextMatch', () {
    test('scores exact token hits higher than zero', () {
      expect(
        scoreTextMatch('divorce maintenance', 'Divorce Maintenance Petition'),
        greaterThan(0.25),
      );
    });
  });
}
