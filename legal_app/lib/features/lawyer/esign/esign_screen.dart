import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_status_badge.dart';

// ─── Model ───────────────────────────────────────────────────────────────────

class _EsignDoc {
  const _EsignDoc({
    required this.id,
    required this.title,
    required this.status,
    required this.signers,
    required this.sentAt,
    this.completedAt,
    this.clientName,
  });

  final String id;
  final String title;
  final String status;
  final List<String> signers;
  final String sentAt;
  final String? completedAt;
  final String? clientName;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

class EsignScreen extends ConsumerStatefulWidget {
  const EsignScreen({super.key});

  @override
  ConsumerState<EsignScreen> createState() => _EsignScreenState();
}

class _EsignScreenState extends ConsumerState<EsignScreen> {
  String _filter = 'ALL';

  final _docs = const <_EsignDoc>[
    _EsignDoc(
      id: '1',
      title: 'Engagement Letter – Sharma & Associates',
      status: 'PENDING',
      signers: ['Rajiv Sharma', 'Client'],
      sentAt: '2 days ago',
      clientName: 'Rajiv Sharma',
    ),
    _EsignDoc(
      id: '2',
      title: 'NDA – Tech Innovations Ltd',
      status: 'COMPLETED',
      signers: ['CEO', 'Legal Counsel'],
      sentAt: '1 week ago',
      completedAt: '5 days ago',
      clientName: 'Tech Innovations',
    ),
    _EsignDoc(
      id: '3',
      title: 'Settlement Agreement – Case #2024-12',
      status: 'DECLINED',
      signers: ['Opposing Party'],
      sentAt: '3 days ago',
      clientName: 'Kumar Estates',
    ),
    _EsignDoc(
      id: '4',
      title: 'Power of Attorney – Estate Planning',
      status: 'PENDING',
      signers: ['John Doe', 'Jane Doe', 'Notary'],
      sentAt: 'Today',
      clientName: 'Doe Family',
    ),
  ];

  static const _filterOptions = [
    AppFilterOption(id: 'ALL', label: 'All'),
    AppFilterOption(id: 'PENDING', label: 'Pending'),
    AppFilterOption(id: 'COMPLETED', label: 'Completed'),
    AppFilterOption(id: 'DECLINED', label: 'Declined'),
  ];

  List<_EsignDoc> get _filtered => _filter == 'ALL'
      ? _docs
      : _docs.where((d) => d.status == _filter).toList();

  @override
  Widget build(BuildContext context) {
    final pending = _docs.where((d) => d.status == 'PENDING').length;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: AppPageHeader(
              title: 'E-Sign',
              subtitle: '$pending awaiting signature',
              actions: [
                FilledButton.tonal(
                  onPressed: () => _showSendSheet(context),
                  child: const Text('Send'),
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: AppFilterBar(
              options: _filterOptions,
              selected: _filter,
              onSelected: (f) => setState(() => _filter = f),
            ),
          ),
          if (_filtered.isEmpty)
            const SliverToBoxAdapter(
              child: AppEmptyState(
                icon: Icons.draw_outlined,
                label: 'No documents to sign',
                sublabel:
                    'Send documents for e-signature from here.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _EsignCard(doc: _filtered[i]),
                childCount: _filtered.length,
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showSendSheet(context),
        icon: const Icon(Icons.send_outlined),
        label: const Text('Send for Signature'),
      ),
    );
  }

  void _showSendSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          top: 24,
          left: 24,
          right: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Send for Signature',
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Document Title',
                prefixIcon: Icon(Icons.description_outlined),
              ),
            ),
            const SizedBox(height: 12),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Signer Email(s)',
                prefixIcon: Icon(Icons.email_outlined),
                hintText: 'Comma-separated emails',
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Send'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EsignCard extends StatelessWidget {
  const _EsignCard({required this.doc});
  final _EsignDoc doc;

  Color _statusColor(BuildContext context, String status) {
    final cs = Theme.of(context).colorScheme;
    switch (status) {
      case 'COMPLETED':
        return Colors.green;
      case 'DECLINED':
        return cs.error;
      default:
        return cs.primary;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'COMPLETED':
        return Icons.check_circle_outline;
      case 'DECLINED':
        return Icons.cancel_outlined;
      default:
        return Icons.pending_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final statusColor = _statusColor(context, doc.status);

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_statusIcon(doc.status), color: statusColor, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    doc.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                AppStatusBadge(status: doc.status),
              ],
            ),
            const SizedBox(height: 8),
            if (doc.clientName != null)
              Row(
                children: [
                  Icon(Icons.person_outline,
                      size: 14, color: cs.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(
                    doc.clientName!,
                    style: TextStyle(
                        color: cs.onSurfaceVariant, fontSize: 12),
                  ),
                ],
              ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: doc.signers
                  .map(
                    (s) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: cs.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        s,
                        style: TextStyle(
                          fontSize: 11,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.schedule_outlined,
                    size: 13, color: cs.onSurfaceVariant),
                const SizedBox(width: 4),
                Text(
                  'Sent ${doc.sentAt}',
                  style:
                      TextStyle(color: cs.onSurfaceVariant, fontSize: 11),
                ),
                if (doc.completedAt != null) ...[
                  const SizedBox(width: 12),
                  Icon(Icons.check, size: 13, color: Colors.green),
                  const SizedBox(width: 4),
                  Text(
                    'Signed ${doc.completedAt}',
                    style: const TextStyle(
                        color: Colors.green, fontSize: 11),
                  ),
                ],
                const Spacer(),
                if (doc.status == 'PENDING')
                  TextButton(
                    onPressed: () {},
                    child: const Text('Remind'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
