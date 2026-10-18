import '../data/india_draft_formats.dart';
import '../data/us_draft_quick_kinds.dart';
import '../models/draft_intent.dart';

class FormSearchHit {
  const FormSearchHit({
    required this.form,
    required this.score,
  });

  final JurisdictionForm form;
  final double score;
}

const _searchStopwords = {
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'have',
  'has',
  'was',
  'are',
  'you',
  'your',
  'need',
  'want',
  'can',
  'could',
  'should',
  'draft',
  'make',
  'create',
  'write',
  'help',
  'please',
};

List<String> tokenizeSearchQuery(String text) {
  return text
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
      .split(RegExp(r'\s+'))
      .where((t) => t.length > 2 && !_searchStopwords.contains(t))
      .toList();
}

List<String> expandSearchTokens(String query) {
  final tokens = tokenizeSearchQuery(query);
  final lower = query.toLowerCase();
  final extra = <String>[];

  if (RegExp(
    r'domestic violence|protective order|non.?molestation|restraining order|non molestation|abuse|assaulted|attacked|harm and domestic',
  ).hasMatch(lower) ||
      RegExp(r'husband|wife|partner|spouse').hasMatch(lower)) {
    extra.addAll([
      'domestic',
      'violence',
      'harm',
      'family',
      'matrimonial',
      'molestation',
    ]);
  }
  if (RegExp(r'police complaint|\bfir\b|criminal complaint|first information report')
      .hasMatch(lower)) {
    extra.addAll(['police', 'criminal', 'complaint', 'fir']);
  }
  if (RegExp(r'complaint|petition|application|filing|court form').hasMatch(lower)) {
    extra.addAll(['complaint', 'petition', 'application']);
  }
  if (RegExp(r'nda|non.?disclosure|confidentiality agreement').hasMatch(lower)) {
    extra.addAll(['nda', 'confidentiality', 'non-disclosure']);
  }
  if (RegExp(
    r'service agreement|contractor agreement|consulting agreement|master service|msa|scope of work',
  ).hasMatch(lower)) {
    extra.addAll(['service', 'agreement', 'contract']);
  }
  if (RegExp(r'partnership|partner deed|partnership deed').hasMatch(lower)) {
    extra.addAll(['partnership', 'deed']);
  }
  if (RegExp(r'bail|custody release').hasMatch(lower)) {
    extra.add('bail');
  }
  if (RegExp(r'writ petition|habeas|mandamus').hasMatch(lower)) {
    extra.addAll(['writ', 'petition']);
  }
  if (RegExp(r'maintenance|crpc\s*125|bnss\s*144|125 crpc|maintainance').hasMatch(lower)) {
    extra.addAll(['maintenance', 'crpc', 'bnss', 'family', 'divorce']);
  }
  if (RegExp(r'divorce|dissolution|matrimonial').hasMatch(lower)) {
    extra.addAll(['divorce', 'family', 'matrimonial']);
  }
  if (RegExp(r'appeal|revision|writ|slp|special leave').hasMatch(lower)) {
    extra.addAll(['appeal', 'petition', 'court']);
  }
  if (RegExp(r'quashing|bail|cheque bounce|ni act|138').hasMatch(lower)) {
    extra.addAll(['criminal', 'petition']);
  }

  return {...tokens, ...extra}.toList();
}

double scoreTextMatch(String query, String target) {
  final queryTokens = expandSearchTokens(query);
  if (queryTokens.isEmpty) return 0;
  final haystack = target.toLowerCase();
  var hits = 0.0;
  for (final token in queryTokens) {
    if (haystack.contains(token)) {
      hits += 1;
    } else if (token.length >= 5) {
      for (final word in haystack.split(RegExp(r'\s+'))) {
        if (_levenshteinDistance(token, word) <= 2) {
          hits += 0.85;
          break;
        }
      }
    }
  }
  return hits / queryTokens.length;
}

int _levenshteinDistance(String a, String b) {
  if (a == b) return 0;
  if (a.isEmpty) return b.length;
  if (b.isEmpty) return a.length;

  final m = a.length;
  final n = b.length;
  final dp = List<int>.generate(n + 1, (j) => j);

  for (var i = 1; i <= m; i++) {
    var prev = dp[0];
    dp[0] = i;
    for (var j = 1; j <= n; j++) {
      final temp = dp[j];
      final cost = a[i - 1] == b[j - 1] ? 0 : 1;
      dp[j] = [
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost,
      ].reduce((x, y) => x < y ? x : y);
      prev = temp;
    }
  }
  return dp[n];
}

class CuratedFormatHit {
  const CuratedFormatHit({
    required this.id,
    required this.label,
    required this.subtitle,
    required this.category,
    required this.countryCode,
    required this.score,
  });

  final String id;
  final String label;
  final String subtitle;
  final String category;
  final String countryCode;
  final double score;
}

List<CuratedFormatHit> searchCuratedFormats(String query, String countryCode) {
  final trimmed = query.trim();
  if (trimmed.length < 2) return [];

  final cc = countryCode.toUpperCase();
  final hits = <CuratedFormatHit>[];

  if (cc == 'IN' || cc == 'ALL') {
    for (final fmt in indiaDraftFormats) {
      final text = '${fmt.label} ${fmt.subtitle} ${fmt.category} ${fmt.id}';
      final score = scoreTextMatch(trimmed, text);
      if (score >= 0.25) {
        hits.add(
          CuratedFormatHit(
            id: fmt.id,
            label: fmt.label,
            subtitle: fmt.subtitle,
            category: fmt.category,
            countryCode: 'IN',
            score: score,
          ),
        );
      }
    }
  }

  if (cc == 'US' || cc == 'ALL') {
    for (final kind in usDraftQuickKinds) {
      final text = '${kind.label} ${kind.subtitle} ${kind.category} ${kind.id}';
      final score = scoreTextMatch(trimmed, text);
      if (score >= 0.25) {
        hits.add(
          CuratedFormatHit(
            id: kind.id,
            label: kind.label,
            subtitle: kind.subtitle,
            category: kind.category,
            countryCode: 'US',
            score: score,
          ),
        );
      }
    }
  }

  hits.sort((a, b) => b.score.compareTo(a.score));
  return hits.take(12).toList();
}
