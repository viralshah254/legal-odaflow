import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

/// Action bar for research results — copy, share, enrich, save, history.
class ResearchActionsBar extends StatelessWidget {
  const ResearchActionsBar({
    super.key,
    required this.markdown,
    this.onEnrich,
    this.onSave,
    this.onHistory,
    this.onAddContext,
    this.enrichEnabled = true,
    this.saveEnabled = true,
  });

  final String markdown;
  final VoidCallback? onEnrich;
  final VoidCallback? onSave;
  final VoidCallback? onHistory;
  final VoidCallback? onAddContext;
  final bool enrichEnabled;
  final bool saveEnabled;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        OutlinedButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: markdown));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Copied to clipboard'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          },
          icon: const Icon(Icons.copy_outlined, size: 16),
          label: const Text('Copy'),
        ),
        OutlinedButton.icon(
          onPressed: () => Share.share(markdown, subject: 'Legal research'),
          icon: const Icon(Icons.share_outlined, size: 16),
          label: const Text('Share'),
        ),
        if (onEnrich != null)
          OutlinedButton.icon(
            onPressed: enrichEnabled ? onEnrich : null,
            icon: const Icon(Icons.auto_awesome_outlined, size: 16),
            label: const Text('Enrich'),
          ),
        if (onSave != null)
          OutlinedButton.icon(
            onPressed: saveEnabled ? onSave : null,
            icon: const Icon(Icons.bookmark_add_outlined, size: 16),
            label: const Text('Save'),
          ),
        if (onAddContext != null)
          OutlinedButton.icon(
            onPressed: onAddContext,
            icon: const Icon(Icons.add_comment_outlined, size: 16),
            label: const Text('Add context'),
          ),
        if (onHistory != null)
          OutlinedButton.icon(
            onPressed: onHistory,
            icon: const Icon(Icons.history, size: 16),
            label: const Text('History'),
          ),
      ],
    );
  }
}
