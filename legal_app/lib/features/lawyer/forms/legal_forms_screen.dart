import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_view.dart';
import '../../../core/widgets/app_filter_bar.dart';
import '../../../core/widgets/app_list_skeleton.dart';
import '../../../core/widgets/app_page_header.dart';

class LegalFormItem {
  final String id;
  final String formName;
  final String countryCode;
  final String? category;
  final String? description;
  final String? formNumber;
  final String? court;

  LegalFormItem({
    required this.id,
    required this.formName,
    required this.countryCode,
    this.category,
    this.description,
    this.formNumber,
    this.court,
  });

  factory LegalFormItem.fromJson(Map<String, dynamic> j) => LegalFormItem(
        id: j['id'] as String,
        formName: j['formName'] as String? ?? 'Form',
        countryCode: j['countryCode'] as String? ?? 'IN',
        category: j['category'] as String?,
        description: j['description'] as String?,
        formNumber: j['formNumber'] as String?,
        court: j['court'] as String?,
      );
}

class LegalFormsScreen extends ConsumerStatefulWidget {
  const LegalFormsScreen({super.key});

  @override
  ConsumerState<LegalFormsScreen> createState() => _LegalFormsScreenState();
}

class _LegalFormsScreenState extends ConsumerState<LegalFormsScreen> {
  List<LegalFormItem> _forms = [];
  bool _loading = true;
  String? _error;
  String _countryCode = 'IN';
  String _selectedCategory = 'all';
  String _searchQuery = '';
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).session?.user;
    _countryCode = user?.countryCode?.toUpperCase() ?? 'IN';
    _initializeCountry();
  }

  Future<void> _initializeCountry() async {
    final country = await ref.read(workCountryProvider.future);
    if (!mounted) return;
    setState(() => _countryCode = country);
    await _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final tenantId =
          ref.read(authControllerProvider).session?.user.tenantId;
      final resp = await api.dio.get<dynamic>(
        '/legal-forms',
        queryParameters: {'countryCode': _countryCode},
        options: tenantId != null
            ? Options(headers: {'X-Tenant-Id': tenantId})
            : null,
      );
      final list = (resp.data as List<dynamic>? ?? [])
          .map((e) => LegalFormItem.fromJson(e as Map<String, dynamic>))
          .toList();
      if (!mounted) return;
      setState(() => _forms = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<LegalFormItem> get _filtered {
    var result = _forms;
    if (_selectedCategory != 'all') {
      result = result
          .where((f) =>
              (f.category ?? '').toLowerCase() ==
              _selectedCategory.toLowerCase())
          .toList();
    }
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result
          .where((f) =>
              f.formName.toLowerCase().contains(q) ||
              (f.category?.toLowerCase().contains(q) ?? false) ||
              (f.formNumber?.toLowerCase().contains(q) ?? false))
          .toList();
    }
    return result;
  }

  List<AppFilterOption> get _categoryOptions {
    final cats = _forms
        .map((f) => f.category)
        .where((c) => c != null && c.isNotEmpty)
        .toSet()
        .cast<String>()
        .toList()
      ..sort();
    return [
      const AppFilterOption(id: 'all', label: 'All'),
      ...cats.map((c) => AppFilterOption(id: c, label: c)),
    ];
  }

  void _showFormDetail(LegalFormItem form) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tt = Theme.of(context).textTheme;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.5,
        maxChildSize: 0.85,
        builder: (ctx, scroll) => SingleChildScrollView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: muted.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              // Form icon + title
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.description_outlined,
                        color: Color(0xFF8B5CF6), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(form.formName,
                            style: tt.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700)),
                        if (form.formNumber != null) ...[
                          const SizedBox(height: 2),
                          Text('Form No. ${form.formNumber}',
                              style: tt.bodySmall?.copyWith(color: muted)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (form.description != null && form.description!.isNotEmpty) ...[
                Text(form.description!,
                    style: tt.bodyMedium?.copyWith(color: muted)),
                const SizedBox(height: 16),
              ],
              // Meta row
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _MetaChip(label: form.countryCode, icon: Icons.public),
                  if (form.category != null)
                    _MetaChip(label: form.category!, icon: Icons.category_outlined),
                  if (form.court != null)
                    _MetaChip(label: form.court!, icon: Icons.gavel_outlined),
                ],
              ),
              const SizedBox(height: 28),
              // Primary CTA — open in DocuDraft
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    context.go('/lawyer/docu-draft',
                        extra: {'formId': form.id, 'formName': form.formName});
                  },
                  icon: const Icon(Icons.edit_note_outlined, size: 18),
                  label: const Text('Draft with AI'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close, size: 16),
                  label: const Text('Close'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: isDark ? AppColors.logoBlue : null,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Legal Forms'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: AppListSkeleton(itemCount: 8),
            )
          : _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : Column(
                  children: [
                    // Page header with count
                    AppPageHeader(
                      title: 'Legal Forms',
                      subtitle: 'Official court and government forms',
                      count: _forms.length,
                      padding: const EdgeInsets.fromLTRB(20, 4, 16, 0),
                    ),
                    // Search bar
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                      child: SearchBar(
                        controller: _searchCtrl,
                        hintText: 'Search forms…',
                        leading: Icon(Icons.search, color: muted),
                        trailing: _searchQuery.isNotEmpty
                            ? [
                                IconButton(
                                  icon: const Icon(Icons.close, size: 18),
                                  onPressed: () => setState(() {
                                    _searchCtrl.clear();
                                    _searchQuery = '';
                                  }),
                                )
                              ]
                            : null,
                        onChanged: (v) =>
                            setState(() => _searchQuery = v),
                        elevation: const WidgetStatePropertyAll(0),
                        backgroundColor: WidgetStatePropertyAll(surface),
                        shape: WidgetStatePropertyAll(RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppColors.radius),
                          side: BorderSide(color: border),
                        )),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Category filter chips
                    if (_categoryOptions.length > 1)
                      AppFilterBar(
                        options: _categoryOptions,
                        selected: _selectedCategory,
                        onSelected: (id) =>
                            setState(() => _selectedCategory = id),
                      ),
                    const SizedBox(height: 4),
                    // Results list
                    Expanded(
                      child: filtered.isEmpty
                          ? AppEmptyState(
                              icon: Icons.description_outlined,
                              label: _searchQuery.isNotEmpty
                                  ? 'No forms match "$_searchQuery"'
                                  : 'No legal forms available',
                              sublabel: _searchQuery.isNotEmpty
                                  ? null
                                  : 'Official forms for $_countryCode will appear here once published.',
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              child: ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                    20, 8, 20, 96),
                                itemCount: filtered.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (context, index) {
                                  final form = filtered[index];
                                  final subtitle = [
                                    form.category,
                                    form.court,
                                    form.description,
                                  ]
                                      .where((s) =>
                                          s != null && s.isNotEmpty)
                                      .take(2)
                                      .join(' · ');
                                  return InkWell(
                                    onTap: () => _showFormDetail(form),
                                    borderRadius: BorderRadius.circular(
                                        AppColors.radius),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 14, vertical: 13),
                                      decoration: BoxDecoration(
                                        color: surface,
                                        borderRadius: BorderRadius.circular(
                                            AppColors.radius),
                                        border: Border.all(color: border),
                                      ),
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 40,
                                            height: 40,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF8B5CF6)
                                                  .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: const Icon(
                                              Icons.description_outlined,
                                              color: Color(0xFF8B5CF6),
                                              size: 18,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  form.formName,
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                                if (subtitle.isNotEmpty) ...[
                                                  const SizedBox(height: 3),
                                                  Text(
                                                    subtitle,
                                                    style: TextStyle(
                                                        fontSize: 11,
                                                        color: muted),
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        horizontal: 7,
                                                        vertical: 3),
                                                decoration: BoxDecoration(
                                                  color: muted
                                                      .withValues(alpha: 0.1),
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                          20),
                                                ),
                                                child: Text(
                                                  form.countryCode,
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w700,
                                                    color: muted,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              Icon(Icons.chevron_right,
                                                  color: muted, size: 18),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted =
        isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: muted.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: muted.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: muted),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(
                  fontSize: 11, color: muted, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
