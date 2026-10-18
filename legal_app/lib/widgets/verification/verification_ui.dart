import 'package:flutter/material.dart';

import '../../core/models/verification.dart';
import '../../core/theme/app_colors.dart';

Color _stateColor(BuildContext context, String state) {
  switch (state) {
    case 'PASS':
      return const Color(0xFF059669);
    case 'FAIL':
      return Colors.red;
    case 'INDETERMINATE':
      return Colors.amber.shade800;
    default:
      return Theme.of(context).colorScheme.onSurfaceVariant;
  }
}

Color _stateBg(BuildContext context, String state) {
  switch (state) {
    case 'PASS':
      return const Color(0xFFECFDF5);
    case 'FAIL':
      return const Color(0xFFFEF2F2);
    case 'INDETERMINATE':
      return const Color(0xFFFFFBEB);
    default:
      return Theme.of(context).colorScheme.surfaceContainerHighest;
  }
}

IconData _pubIcon(String? state) {
  switch (state) {
    case 'READY_FOR_LAWYER_REVIEW':
      return Icons.check_circle_outline;
    case 'VERIFIED_WITH_LIMITATIONS':
      return Icons.warning_amber_outlined;
    case 'DRAFT_NOT_VERIFIED':
      return Icons.cancel_outlined;
    case 'RESEARCH_BACKED':
      return Icons.manage_search_outlined;
    default:
      return Icons.shield_outlined;
  }
}

String _pubStateForColor(String? state) {
  switch (state) {
    case 'READY_FOR_LAWYER_REVIEW':
    case 'RESEARCH_BACKED':
      return 'PASS';
    case 'DRAFT_NOT_VERIFIED':
      return 'FAIL';
    default:
      return 'INDETERMINATE';
  }
}

class PublicationStateBadge extends StatelessWidget {
  const PublicationStateBadge({super.key, this.publicationState});

  final String? publicationState;

  @override
  Widget build(BuildContext context) {
    final stateKey = _pubStateForColor(publicationState);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _stateBg(context, stateKey),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _stateColor(context, stateKey).withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_pubIcon(publicationState), size: 14, color: _stateColor(context, stateKey)),
          const SizedBox(width: 6),
          Text(
            publicationStateLabel(publicationState),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: _stateColor(context, stateKey),
            ),
          ),
        ],
      ),
    );
  }
}

class VerificationStatusBar extends StatelessWidget {
  const VerificationStatusBar({
    super.key,
    this.publicationState,
    this.findings,
  });

  final String? publicationState;
  final List<VerificationFinding>? findings;

  @override
  Widget build(BuildContext context) {
    final stateKey = _pubStateForColor(publicationState);
    final blockers = (findings ?? [])
        .where((f) => f.severity == 'BLOCKER' && f.state != 'PASS')
        .length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: _stateBg(context, stateKey),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _stateColor(context, stateKey).withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_pubIcon(publicationState), size: 16, color: _stateColor(context, stateKey)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  publicationStateLabel(publicationState),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: _stateColor(context, stateKey),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  publicationStateSubtitle(publicationState),
                  style: TextStyle(
                    fontSize: 11,
                    color: _stateColor(context, stateKey).withValues(alpha: 0.85),
                  ),
                ),
                if (blockers > 0) ...[
                  const SizedBox(height: 4),
                  Text(
                    '$blockers blocker${blockers == 1 ? '' : 's'}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _stateColor(context, 'FAIL'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class VerificationDimensionChips extends StatelessWidget {
  const VerificationDimensionChips({super.key, this.dimensions});

  final VerificationDimensions? dimensions;

  @override
  Widget build(BuildContext context) {
    final dims = dimensions ?? VerificationDimensions.fallback();
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: dims.asMap().entries.map((e) {
        final label = dimensionLabels[e.key] ?? e.key;
        final state = e.value.state;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: _stateBg(context, state),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: _stateColor(context, state).withValues(alpha: 0.25)),
          ),
          child: Text(
            '$label · ${checkStateLabel(state)}',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: _stateColor(context, state),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class PropositionSupportList extends StatelessWidget {
  const PropositionSupportList({super.key, this.propositions});

  final List<VerifiedPropositionSummary>? propositions;

  @override
  Widget build(BuildContext context) {
    final items = propositions ?? const [];
    if (items.isEmpty) {
      return Text(
        'No proposition support details available.',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
      );
    }
    return Column(
      children: items.take(12).map((p) {
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            dense: true,
            title: Text(p.text, maxLines: 3, overflow: TextOverflow.ellipsis),
            subtitle: Text('${p.materiality} · ${p.supportState}'),
            leading: Icon(
              p.supportState == 'PASS' || p.supportState == 'SUPPORTED'
                  ? Icons.check_circle_outline
                  : Icons.help_outline,
              color: p.supportState == 'PASS' || p.supportState == 'SUPPORTED'
                  ? Colors.green
                  : Colors.amber.shade800,
            ),
          ),
        );
      }).toList(),
    );
  }
}

class ExportBlockedDialog extends StatelessWidget {
  const ExportBlockedDialog({
    super.key,
    required this.reasons,
    this.onForceWatermark,
    this.onDismiss,
  });

  final List<String> reasons;
  final VoidCallback? onForceWatermark;
  final VoidCallback? onDismiss;

  static Future<void> show(
    BuildContext context, {
    required List<String> reasons,
    VoidCallback? onForceWatermark,
  }) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => ExportBlockedDialog(
        reasons: reasons,
        onForceWatermark: onForceWatermark,
        onDismiss: () => Navigator.of(ctx).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.block, color: Colors.red),
          SizedBox(width: 8),
          Expanded(child: Text('Export blocked')),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'This draft has verification blockers. Resolve them before filing-grade export.',
          ),
          const SizedBox(height: 12),
          ...reasons.take(6).map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('• '),
                      Expanded(child: Text(r, style: const TextStyle(fontSize: 13))),
                    ],
                  ),
                ),
              ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: onDismiss ?? () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
        if (onForceWatermark != null)
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              onForceWatermark!();
            },
            child: const Text('Export with watermark'),
          ),
      ],
    );
  }
}

/// Convenience wrapper matching web ResearchVerificationCard layout.
class ResearchVerificationCard extends StatelessWidget {
  const ResearchVerificationCard({
    super.key,
    this.publicationState,
    this.findings,
    this.dimensions,
    this.propositions,
    this.citationAuditLabel,
    this.requiresLawyerReview,
  });

  final String? publicationState;
  final List<VerificationFinding>? findings;
  final VerificationDimensions? dimensions;
  final List<VerifiedPropositionSummary>? propositions;
  final String? citationAuditLabel;
  final bool? requiresLawyerReview;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.verified_outlined, size: 18, color: AppColors.logoAccent),
                const SizedBox(width: 8),
                Text(
                  'Verification',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const Spacer(),
                if (requiresLawyerReview == true)
                  const Chip(
                    label: Text('Lawyer review', style: TextStyle(fontSize: 11)),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            VerificationStatusBar(
              publicationState: publicationState,
              findings: findings,
            ),
            if (citationAuditLabel != null) ...[
              const SizedBox(height: 8),
              Text(citationAuditLabel!, style: Theme.of(context).textTheme.bodySmall),
            ],
            if (dimensions != null) ...[
              const SizedBox(height: 10),
              VerificationDimensionChips(dimensions: dimensions),
            ],
            if (propositions != null && propositions!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Propositions',
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 6),
              PropositionSupportList(propositions: propositions),
            ],
          ],
        ),
      ),
    );
  }
}
