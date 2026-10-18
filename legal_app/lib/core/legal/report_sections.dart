import '../models/models.dart';

/// Fifteen-section consumer legal report structure (Transformation / Production Spec).
const legalReportSections = [
  'Executive Summary',
  'Situation Summary',
  'Legal Issue Classification',
  'Jurisdiction Context',
  'Relevant Legal Principles',
  'Strengths',
  'Risks',
  'Evidence Needed',
  'Options',
  'Suggested Next Steps',
  'Questions to Ask a Lawyer',
  'Draft Letter',
  'Timeline & Deadlines',
  'Sources',
  'Disclaimer',
];

class ParsedReportSection {
  const ParsedReportSection({
    required this.title,
    required this.content,
    required this.index,
  });

  final String title;
  final String content;
  final int index;
}

String _normalizeTitle(String title) {
  return title
      .replaceFirst(RegExp(r'^#+\s*'), '')
      .replaceAll('*', '')
      .trim()
      .toLowerCase();
}

List<ParsedReportSection> parseReportSections(String markdown) {
  if (markdown.trim().isEmpty) {
    return List.generate(
      legalReportSections.length,
      (index) => ParsedReportSection(
        title: legalReportSections[index],
        content: '',
        index: index,
      ),
    );
  }

  final byTitle = <String, String>{};
  final parts = markdown.split(RegExp(r'^##\s+', multiLine: true));

  for (final part in parts) {
    if (part.trim().isEmpty) continue;
    final newline = part.indexOf('\n');
    final rawTitle = newline >= 0 ? part.substring(0, newline) : part;
    final body = newline >= 0 ? part.substring(newline + 1).trim() : '';
    byTitle[_normalizeTitle(rawTitle)] = body;
  }

  return List.generate(legalReportSections.length, (index) {
    final title = legalReportSections[index];
    return ParsedReportSection(
      title: title,
      content: byTitle[_normalizeTitle(title)] ?? '',
      index: index,
    );
  });
}

ConsumerLegalReport? pickFullReport(List<ConsumerLegalReport> reports) {
  if (reports.isEmpty) return null;
  for (final report in reports) {
    if (!report.isPreview) return report;
  }
  return reports.first;
}
