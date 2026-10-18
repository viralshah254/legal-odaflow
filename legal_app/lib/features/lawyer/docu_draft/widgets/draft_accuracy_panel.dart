import 'package:flutter/material.dart';

import '../../../../core/models/india_draft.dart';
import '../../../../core/models/verification.dart';
import '../../../../widgets/verification/verification_ui.dart';

/// Mobile DraftAccuracyPanel — mirrors web DraftAccuracyPanel.
class DraftAccuracyPanel extends StatelessWidget {
  const DraftAccuracyPanel({
    super.key,
    this.verification,
    this.accuracyGate,
    this.verificationReport,
    this.confidenceReport,
    this.sections,
    this.onReverify,
    this.onFixBlocker,
    this.busy = false,
  });

  final DraftVerificationAudit? verification;
  final DraftAccuracyGate? accuracyGate;
  final VerificationReport? verificationReport;
  final ConfidenceReport? confidenceReport;
  final List<DraftSectionResult>? sections;
  final VoidCallback? onReverify;
  final void Function(String instruction)? onFixBlocker;
  final bool busy;

  bool get canCertify =>
      accuracyGate?.canCertify == true ||
      verificationReport?.canCertify == true ||
      verification?.canCertify == true;

  List<String> get blockers {
    final out = <String>[];
    for (final f in verification?.findings ?? const <VerificationFinding>[]) {
      if (f.severity == 'BLOCKER' && f.state != 'PASS') {
        out.add(f.explanation);
      }
    }
    out.addAll(verification?.completenessGaps ?? const []);
    out.addAll(verification?.proceduralWarnings ?? const []);
    out.addAll(verificationReport?.overallWarnings ?? const []);
    out.addAll(accuracyGate?.unresolvedFacts ?? const []);
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final label = accuracyGate?.certificationLabel ??
        verificationReport?.certificationLabel ??
        verification?.certificationLabel ??
        'needs_review';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  canCertify ? Icons.verified : Icons.warning_amber_outlined,
                  color: canCertify ? Colors.green : Colors.amber.shade800,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    canCertify
                        ? 'Verified for filing'
                        : 'Accuracy review required',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                Chip(
                  label: Text(label.replaceAll('_', ' '),
                      style: const TextStyle(fontSize: 11)),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 10),
            VerificationStatusBar(
              publicationState: verification?.publicationState ??
                  (canCertify
                      ? 'READY_FOR_LAWYER_REVIEW'
                      : 'VERIFIED_WITH_LIMITATIONS'),
              findings: verification?.findings,
            ),
            if (confidenceReport != null) ...[
              const SizedBox(height: 10),
              Text(
                'Confidence ${(confidenceReport!.overallScore * 100).round()}% · '
                '${confidenceReport!.overallGrade} · '
                '${confidenceReport!.verifiedSections}/${confidenceReport!.totalSections} sections verified',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (verification?.dimensions != null) ...[
              const SizedBox(height: 10),
              VerificationDimensionChips(dimensions: verification!.dimensions),
            ],
            if (blockers.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Blockers', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 6),
              ...blockers.take(8).map(
                    (b) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.error_outline,
                              size: 14, color: Colors.red),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(b, style: const TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
            if (sections != null && sections!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Sections', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 6),
              ...sections!.map(
                (s) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(s.title),
                  subtitle: Text(
                    '${s.verificationStatus}'
                    '${s.confidence != null ? ' · ${(s.confidence!.score * 100).round()}%' : ''}',
                  ),
                  trailing: Icon(
                    s.verificationStatus == 'verified'
                        ? Icons.check_circle
                        : Icons.help_outline,
                    size: 18,
                    color: s.verificationStatus == 'verified'
                        ? Colors.green
                        : Colors.amber.shade800,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                if (onReverify != null)
                  OutlinedButton.icon(
                    onPressed: busy ? null : onReverify,
                    icon: busy
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh, size: 16),
                    label: const Text('Re-verify'),
                  ),
                if (onFixBlocker != null && blockers.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: busy
                        ? null
                        : () => onFixBlocker!('retrieve_authority'),
                    icon: const Icon(Icons.build_outlined, size: 16),
                    label: const Text('Fix blockers'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
