import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

// ── Markdown utilities shared across lead detail and draft screens ─────────────

/// Strips 4+ leading spaces / tabs from lines outside fenced code blocks,
/// preventing flutter_markdown from treating indented text as a code block.
String sanitizeMarkdown(String md) {
  final lines = md.split('\n');
  final out = <String>[];
  var inFence = false;
  for (final line in lines) {
    if (line.trimLeft().startsWith('```')) {
      inFence = !inFence;
      out.add(line);
    } else if (inFence) {
      out.add(line);
    } else {
      out.add(line.replaceFirst(RegExp(r'^(?: {4,}|\t+)'), ''));
    }
  }
  return out.join('\n');
}

/// Splits markdown into (title, body) sections at every `## ` heading.
List<({String title, String body})> splitMarkdownSections(String md) {
  final lines = md.split('\n');
  final sections = <({String title, String body})>[];
  var currentTitle = '';
  final buf = StringBuffer();

  void flush() {
    final body = buf.toString().trim();
    if (body.isNotEmpty || currentTitle.isNotEmpty) {
      sections.add((title: currentTitle, body: body));
    }
    buf.clear();
  }

  for (final line in lines) {
    if (line.startsWith('## ')) {
      flush();
      currentTitle = line.substring(3).trim();
    } else {
      buf.writeln(line);
    }
  }
  flush();
  return sections;
}

/// Returns a bulletBuilder that suppresses bullets for nested list items.
Widget Function(MarkdownBulletParameters) cleanBulletBuilder(
    TextStyle? style) {
  return (MarkdownBulletParameters params) {
    if (params.nestLevel > 0) return const SizedBox.shrink();
    return Text('• ', style: style);
  };
}

// ── Collapsible section tile ──────────────────────────────────────────────────

class MarkdownSectionTile extends StatefulWidget {
  const MarkdownSectionTile({
    super.key,
    required this.title,
    required this.body,
    required this.initiallyExpanded,
  });

  final String title;
  final String body;
  final bool initiallyExpanded;

  @override
  State<MarkdownSectionTile> createState() => _MarkdownSectionTileState();
}

class _MarkdownSectionTileState extends State<MarkdownSectionTile> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
            child: Row(
              children: [
                if (widget.title.isNotEmpty) ...[
                  Expanded(
                    child: Text(
                      widget.title,
                      style: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                    ),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: colorScheme.onSurfaceVariant,
                  ),
                ],
              ],
            ),
          ),
        ),
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 220),
          crossFadeState:
              _expanded ? CrossFadeState.showFirst : CrossFadeState.showSecond,
          firstChild: Padding(
            padding:
                const EdgeInsets.only(bottom: 12, left: 4, right: 4),
            child: SelectionArea(
              child: MarkdownBody(
                data: widget.body,
                bulletBuilder: cleanBulletBuilder(textTheme.bodySmall),
                styleSheet:
                    MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                  p: textTheme.bodySmall,
                  h1: textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                  h2: textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                  h3: textTheme.bodySmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                  h4: textTheme.bodySmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                  strong: textTheme.bodySmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                  em: textTheme.bodySmall
                      ?.copyWith(fontStyle: FontStyle.italic),
                  listBullet: textTheme.bodySmall,
                  blockSpacing: 6,
                  listIndent: 16,
                ),
              ),
            ),
          ),
          secondChild: const SizedBox.shrink(),
        ),
        Divider(
            height: 1,
            color: colorScheme.outlineVariant.withValues(alpha: 0.4)),
      ],
    );
  }
}
