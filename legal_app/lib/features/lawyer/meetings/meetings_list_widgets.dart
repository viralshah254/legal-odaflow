import 'package:flutter/material.dart';

import '../../../widgets/ai_tools/ai_tool_widgets.dart';

class MeetingSkeletonTile extends StatelessWidget {
  const MeetingSkeletonTile({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            ShimmerBox(width: 40, height: 40, borderRadius: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  ShimmerBox(width: double.infinity, height: 14),
                  SizedBox(height: 8),
                  ShimmerBox(width: 160, height: 12),
                  SizedBox(height: 6),
                  ShimmerBox(width: 96, height: 11),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MeetingsListSkeleton extends StatelessWidget {
  const MeetingsListSkeleton({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      itemCount: count,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, __) => const MeetingSkeletonTile(),
    );
  }
}

Future<bool?> confirmDeleteMeeting(BuildContext context) {
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: Icon(Icons.delete_forever_outlined, color: Theme.of(ctx).colorScheme.error),
      title: const Text('Delete meeting?'),
      content: const Text(
        'This will permanently delete the meeting, recording, transcript, and notes. '
        'This action cannot be reversed.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(ctx).colorScheme.error,
          ),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
}
