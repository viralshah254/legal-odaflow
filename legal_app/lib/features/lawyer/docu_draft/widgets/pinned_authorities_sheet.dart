import 'package:flutter/material.dart';

import '../../../../core/models/draft_verification.dart';

/// Manage pinned statutes / case laws before generate (web DraftPinnedAuthoritiesEditor).
class PinnedAuthoritiesSheet extends StatefulWidget {
  const PinnedAuthoritiesSheet({
    super.key,
    required this.pinnedSections,
    required this.pinnedCaseLaws,
  });

  final List<PinnedSection> pinnedSections;
  final List<PinnedCaseLaw> pinnedCaseLaws;

  static Future<({List<PinnedSection> sections, List<PinnedCaseLaw> cases})?>
      show(
    BuildContext context, {
    required List<PinnedSection> pinnedSections,
    required List<PinnedCaseLaw> pinnedCaseLaws,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => PinnedAuthoritiesSheet(
        pinnedSections: List.of(pinnedSections),
        pinnedCaseLaws: List.of(pinnedCaseLaws),
      ),
    );
  }

  @override
  State<PinnedAuthoritiesSheet> createState() => _PinnedAuthoritiesSheetState();
}

class _PinnedAuthoritiesSheetState extends State<PinnedAuthoritiesSheet> {
  late List<PinnedSection> _sections;
  late List<PinnedCaseLaw> _cases;
  final _sectionCtrl = TextEditingController();
  final _caseCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _sections = List.of(widget.pinnedSections);
    _cases = List.of(widget.pinnedCaseLaws);
  }

  @override
  void dispose() {
    _sectionCtrl.dispose();
    _caseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Pinned authorities',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _sectionCtrl,
            decoration: InputDecoration(
              labelText: 'Add statute section',
              hintText: 'e.g. CrPC 437',
              suffixIcon: IconButton(
                icon: const Icon(Icons.add),
                onPressed: () {
                  final v = _sectionCtrl.text.trim();
                  if (v.isEmpty) return;
                  setState(() {
                    _sections.add(PinnedSection(
                      section: v,
                      label: v,
                      source: 'user_unresolved',
                    ));
                    _sectionCtrl.clear();
                  });
                },
              ),
            ),
          ),
          ..._sections.asMap().entries.map(
                (e) => ListTile(
                  dense: true,
                  title: Text(e.value.label ?? e.value.section),
                  trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () =>
                        setState(() => _sections.removeAt(e.key)),
                  ),
                ),
              ),
          const SizedBox(height: 8),
          TextField(
            controller: _caseCtrl,
            decoration: InputDecoration(
              labelText: 'Add case citation',
              hintText: 'e.g. (1978) 1 SCC 248',
              suffixIcon: IconButton(
                icon: const Icon(Icons.add),
                onPressed: () {
                  final v = _caseCtrl.text.trim();
                  if (v.isEmpty) return;
                  setState(() {
                    _cases.add(PinnedCaseLaw(citation: v, source: 'user'));
                    _caseCtrl.clear();
                  });
                },
              ),
            ),
          ),
          ..._cases.asMap().entries.map(
                (e) => ListTile(
                  dense: true,
                  title: Text(e.value.citation),
                  trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => setState(() => _cases.removeAt(e.key)),
                  ),
                ),
              ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => Navigator.pop(
              context,
              (sections: _sections, cases: _cases),
            ),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }
}
