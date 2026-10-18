import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_page_header.dart';
import '../../../core/widgets/app_status_badge.dart';

class _Template {
  const _Template({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.jurisdiction,
    required this.useCount,
    required this.lastUpdated,
    this.isCustom = false,
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final String jurisdiction;
  final int useCount;
  final String lastUpdated;
  final bool isCustom;
}

class TemplatesScreen extends ConsumerStatefulWidget {
  const TemplatesScreen({super.key});

  @override
  ConsumerState<TemplatesScreen> createState() => _TemplatesScreenState();
}

class _TemplatesScreenState extends ConsumerState<TemplatesScreen> {
  String _filter = 'All';
  String _search = '';
  final _searchCtrl = TextEditingController();

  final _templates = const <_Template>[
    _Template(
      id: '1',
      name: 'Engagement Letter – General',
      description: 'Standard engagement letter for new client matters.',
      category: 'Client',
      jurisdiction: 'IN',
      useCount: 47,
      lastUpdated: '1 month ago',
      isCustom: true,
    ),
    _Template(
      id: '2',
      name: 'Non-Disclosure Agreement',
      description: 'Mutual NDA for business relationships and partnerships.',
      category: 'Contract',
      jurisdiction: 'IN',
      useCount: 123,
      lastUpdated: '2 weeks ago',
    ),
    _Template(
      id: '3',
      name: 'Motion to Dismiss',
      description: 'Standard motion to dismiss for civil litigation matters.',
      category: 'Litigation',
      jurisdiction: 'IN',
      useCount: 34,
      lastUpdated: '3 weeks ago',
    ),
    _Template(
      id: '4',
      name: 'Power of Attorney – General',
      description: 'General power of attorney for estate and personal matters.',
      category: 'Estate',
      jurisdiction: 'IN',
      useCount: 89,
      lastUpdated: '1 week ago',
    ),
    _Template(
      id: '5',
      name: 'Settlement Agreement',
      description: 'Full and final settlement agreement for dispute resolution.',
      category: 'Litigation',
      jurisdiction: 'IN',
      useCount: 28,
      lastUpdated: '5 days ago',
      isCustom: true,
    ),
    _Template(
      id: '6',
      name: 'Services Agreement',
      description: 'Master services agreement for professional service engagements.',
      category: 'Contract',
      jurisdiction: 'IN',
      useCount: 67,
      lastUpdated: '2 days ago',
    ),
    _Template(
      id: '7',
      name: 'Will – Simple',
      description: 'Simple last will and testament template.',
      category: 'Estate',
      jurisdiction: 'IN',
      useCount: 19,
      lastUpdated: '2 months ago',
    ),
  ];

  List<String> get _categories => [
        'All',
        ..._templates.map((t) => t.category).toSet(),
      ];

  List<_Template> get _filtered {
    var result = _templates;
    if (_filter != 'All') {
      result = result.where((t) => t.category == _filter).toList();
    }
    if (_search.isNotEmpty) {
      result = result
          .where((t) =>
              t.name.toLowerCase().contains(_search) ||
              t.description.toLowerCase().contains(_search))
          .toList();
    }
    return result;
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final filtered = _filtered;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: AppPageHeader(
              title: 'Templates',
              subtitle: '${_templates.length} templates available',
              actions: [
                IconButton(
                  icon: const Icon(Icons.add),
                  tooltip: 'New Template',
                  onPressed: () {},
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: TextField(
                controller: _searchCtrl,
                decoration: InputDecoration(
                  hintText: 'Search templates...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _search.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _searchCtrl.clear();
                            setState(() => _search = '');
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: cs.surfaceContainerHighest,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                ),
                onChanged: (v) => setState(() => _search = v.toLowerCase()),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: AppFilterBar(
              options: _categories
                  .map((c) => AppFilterOption(id: c, label: c))
                  .toList(),
              selected: _filter,
              onSelected: (f) => setState(() => _filter = f),
            ),
          ),
          if (filtered.isEmpty)
            const SliverToBoxAdapter(
              child: AppEmptyState(
                icon: Icons.description_outlined,
                label: 'No templates found',
                sublabel: 'Try a different search or category.',
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _TemplateCard(template: filtered[i]),
                childCount: filtered.length,
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }
}

class _TemplateCard extends StatelessWidget {
  const _TemplateCard({required this.template});
  final _Template template;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return AppCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: template.isCustom
                ? cs.tertiaryContainer
                : cs.primaryContainer,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            template.isCustom
                ? Icons.star_outline
                : Icons.description_outlined,
            color: template.isCustom
                ? cs.onTertiaryContainer
                : cs.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                template.name,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (template.isCustom) ...[
              const SizedBox(width: 6),
              AppStatusBadge(status: 'CUSTOM'),
            ],
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              template.description,
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                AppStatusBadge(status: template.category),
                const SizedBox(width: 8),
                Icon(Icons.bolt_outlined,
                    size: 12, color: cs.onSurfaceVariant),
                const SizedBox(width: 2),
                Text(
                  '${template.useCount} uses',
                  style: TextStyle(
                      color: cs.onSurfaceVariant, fontSize: 11),
                ),
              ],
            ),
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (val) {},
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'use', child: Text('Use Template')),
            PopupMenuItem(value: 'edit', child: Text('Edit')),
            PopupMenuItem(value: 'duplicate', child: Text('Duplicate')),
          ],
        ),
        isThreeLine: true,
      ),
    );
  }
}
