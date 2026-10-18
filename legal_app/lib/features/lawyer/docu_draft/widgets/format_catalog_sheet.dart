import 'package:flutter/material.dart';

import '../../../../core/data/india_draft_formats.dart';
import '../../../../core/data/us_draft_quick_kinds.dart';
import '../../../../core/drafting/draft_navigation.dart';
import '../../../../l10n/app_localizations.dart';

const _accentColor = Color(0xFF7C3AED);

class FormatCatalogSheet extends StatefulWidget {
  const FormatCatalogSheet({
    super.key,
    required this.countryCode,
    required this.onSelectKind,
  });

  final String countryCode;
  final void Function(DocuDraftRouteParams params) onSelectKind;

  @override
  State<FormatCatalogSheet> createState() => _FormatCatalogSheetState();
}

class _FormatCatalogSheetState extends State<FormatCatalogSheet> {
  String _category = 'All';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<String> get _categories {
    if (widget.countryCode == 'US') {
      return ['All', ...usDraftQuickKinds.map((k) => k.category).toSet()];
    }
    return ['All', ...indiaDraftFormats.map((f) => f.category).toSet()];
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isUs = widget.countryCode == 'US';

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Material(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  controller: _search,
                  decoration: InputDecoration(
                    hintText: l10n.docuDraftSearchFormats,
                    prefixIcon: const Icon(Icons.search),
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  children: _categories.map((cat) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(cat),
                        selected: _category == cat,
                        onSelected: (_) => setState(() => _category = cat),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: GridView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.85,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                  itemCount: _filtered(isUs).length,
                  itemBuilder: (context, index) {
                    final item = _filtered(isUs)[index];
                    if (isUs) {
                      final kind = item as UsDraftQuickKind;
                      return _FormatCard(
                        label: kind.label,
                        subtitle: kind.subtitle,
                        category: kind.category,
                        icon: kind.icon,
                        onTap: () {
                          Navigator.pop(context);
                          widget.onSelectKind(
                            DocuDraftRouteParams(
                              kind: kind.id,
                              label: kind.label,
                              countryCode: 'US',
                            ),
                          );
                        },
                      );
                    }
                    final format = item as DraftFormat;
                    return _FormatCard(
                      label: format.label,
                      subtitle: format.subtitle,
                      category: format.category,
                      icon: format.icon,
                      onTap: () {
                        Navigator.pop(context);
                        widget.onSelectKind(
                          DocuDraftRouteParams(
                            kind: format.id,
                            label: format.label,
                            countryCode: 'IN',
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  List<dynamic> _filtered(bool isUs) {
    final q = _search.text.toLowerCase();
    if (isUs) {
      return usDraftQuickKinds.where((k) {
        final catOk = _category == 'All' || k.category == _category;
        final searchOk = q.isEmpty ||
            k.label.toLowerCase().contains(q) ||
            k.subtitle.toLowerCase().contains(q);
        return catOk && searchOk;
      }).toList();
    }
    return indiaDraftFormats.where((f) {
      final catOk = _category == 'All' || f.category == _category;
      final searchOk = q.isEmpty ||
          f.label.toLowerCase().contains(q) ||
          f.subtitle.toLowerCase().contains(q) ||
          f.category.toLowerCase().contains(q);
      return catOk && searchOk;
    }).toList();
  }
}

class _FormatCard extends StatelessWidget {
  const _FormatCard({
    required this.label,
    required this.subtitle,
    required this.category,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final String category;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _accentColor.withValues(alpha: 0.25)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 18, color: _accentColor),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _accentColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(category, style: const TextStyle(fontSize: 10)),
                  ),
                ],
              ),
              const Spacer(),
              Text(label, style: Theme.of(context).textTheme.titleSmall, maxLines: 2),
              const SizedBox(height: 4),
              Text(subtitle, style: Theme.of(context).textTheme.bodySmall, maxLines: 2),
            ],
          ),
        ),
      ),
    );
  }
}
