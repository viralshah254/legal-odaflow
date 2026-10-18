import 'package:flutter_test/flutter_test.dart';

import 'package:umbrella/core/legal/report_sections.dart';

void main() {
  test('parseReportSections returns 15 sections for empty markdown', () {
    final sections = parseReportSections('');
    expect(sections.length, 15);
    expect(sections.first.title, 'Executive Summary');
    expect(sections.last.title, 'Disclaimer');
  });

  test('parseReportSections parses markdown headings', () {
    const markdown = '''
## Executive Summary
This is the summary.

## Risks
Some risks here.
''';

    final sections = parseReportSections(markdown);
    expect(sections.first.content, 'This is the summary.');
    expect(sections[6].title, 'Risks');
    expect(sections[6].content, 'Some risks here.');
  });
}
