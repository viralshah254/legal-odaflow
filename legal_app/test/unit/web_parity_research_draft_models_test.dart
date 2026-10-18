import 'package:flutter_test/flutter_test.dart';
import 'package:umbrella/core/models/models.dart';

void main() {
  group('LegalResearchResult web-parity parsing', () {
    test('fromJson reads verification + similar cases', () {
      final result = LegalResearchResult.fromJson({
        'outputMarkdown': '## Memo\nBody',
        'citations': [
          {'title': 'Case A', 'source': 'SCC', 'url': 'https://example.com'},
          'Bare string cite',
        ],
        'researchMode': 'DEEP',
        'publicationState': 'READY_FOR_LAWYER_REVIEW',
        'aiOutputId': 'out_1',
        'findings': [
          {
            'checkId': 'c1',
            'state': 'PASS',
            'severity': 'LOW',
            'dimension': 'identity',
            'evidenceIds': <String>[],
            'explanation': 'ok',
            'verifierVersion': '1',
          }
        ],
        'similarCases': [
          {
            'authorityId': 'a1',
            'title': 'Similar Case',
            'sourceName': 'SCC',
            'relevantSections': ['420'],
            'confidence': 0.9,
            'verificationStatus': 'verified',
          }
        ],
        'dimensions': {
          'identity': {
            'state': 'PASS',
            'pass': 1,
            'fail': 0,
            'indeterminate': 0,
            'notApplicable': 0,
          },
        },
      });

      expect(result.outputMarkdown, contains('Memo'));
      expect(result.citations.length, 2);
      expect(result.publicationState, 'READY_FOR_LAWYER_REVIEW');
      expect(result.aiOutputId, 'out_1');
      expect(result.findings, isNotNull);
      expect(result.findings!.first.checkId, 'c1');
      expect(result.similarCases!.first.title, 'Similar Case');
      expect(result.dimensions!.identity.state, 'PASS');
    });

    test('fromJobResult prefers draftMarkdown', () {
      final result = LegalResearchResult.fromJobResult({
        'draftMarkdown': 'Partial draft',
        'outputMarkdown': 'Full',
        'researchMode': 'FAST',
      });
      expect(result, isNotNull);
      expect(result!.outputMarkdown, 'Partial draft');
      expect(result.researchMode, 'FAST');
    });
  });

  group('IndiaDraftResult web-parity parsing', () {
    test('detects async v3 migration', () {
      final result = IndiaDraftResult.fromJson({
        'draft': '',
        'migratedToAsyncEngine': true,
        'jobId': 'job_123',
        'engineVersion': 'v3',
        'estimatedCredits': 12,
      });
      expect(result.needsAsyncPolling, isTrue);
      expect(result.jobId, 'job_123');
    });

    test('maps draft-job result payload', () {
      final result = IndiaDraftResult.fromDraftJobResult({
        'jobId': 'job_9',
        'assembledDraft': {
          'fullText': 'IN THE HIGH COURT\n...',
        },
        'verificationReport': {
          'status': 'needs_review',
          'canCertify': false,
          'certificationLabel': 'needs_review',
          'overallWarnings': ['Cite check incomplete'],
          'requiresLawyerReview': true,
        },
      });
      expect(result.draft, contains('HIGH COURT'));
      expect(result.engineVersion, 'v3');
      expect(result.canCertify, isFalse);
      expect(result.accuracyGate?.certificationLabel, 'needs_review');
    });
  });
}
