import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/drafting/draft_navigation.dart';
import '../../../../core/drafting/form_search.dart';
import '../../../../core/models/draft_intent.dart';
import '../../../../core/providers/app_providers.dart';
import '../../../../l10n/app_localizations.dart';

const _accentColor = Color(0xFF7C3AED);

class FormSearchSection extends ConsumerStatefulWidget {
  const FormSearchSection({
    super.key,
    required this.countryCode,
    required this.onCuratedTap,
    required this.onFormTap,
    this.onSearchFocus,
  });

  final String countryCode;
  final void Function(CuratedFormatHit hit) onCuratedTap;
  final void Function(JurisdictionForm form) onFormTap;
  final VoidCallback? onSearchFocus;

  @override
  ConsumerState<FormSearchSection> createState() => _FormSearchSectionState();
}

class _FormSearchSectionState extends ConsumerState<FormSearchSection> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;
  List<CuratedFormatHit> _curated = [];
  List<FormSearchHit> _official = [];
  bool _loading = false;
  bool _expanded = false;
  String? _error;
  String _lastQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onQueryChanged);
    _focusNode.addListener(() {
      if (_focusNode.hasFocus) widget.onSearchFocus?.call();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onQueryChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _runSearch(_searchController.text.trim());
    });
  }

  Future<void> _runSearch(String query) async {
    if (query.length < 2) {
      if (mounted) {
        setState(() {
          _lastQuery = query;
          _curated = [];
          _official = [];
          _loading = false;
          _error = null;
        });
      }
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _lastQuery = query;
      _curated = searchCuratedFormats(query, widget.countryCode);
    });

    try {
      final ai = ref.read(aiApiProvider);
      final hits = await ai.searchLegalFormsByIntent(
        query: query,
        countryCode: widget.countryCode == 'ALL' ? null : widget.countryCode,
        limit: 20,
      );
      if (mounted && _lastQuery == query) {
        setState(() {
          _official = hits;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted && _lastQuery == query) {
        setState(() {
          _loading = false;
          _error = 'Could not search official forms';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final query = _searchController.text.trim();
    final hasResults = _curated.isNotEmpty || _official.isNotEmpty;

    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: ExpansionTile(
        initiallyExpanded: _expanded,
        onExpansionChanged: (v) => setState(() => _expanded = v),
        title: Text(l10n.docuDraftOfficialForms, style: theme.textTheme.titleSmall),
        subtitle: Text(
          'Search by name, topic, or statute (e.g. divorce, maintenance, bail)',
          style: theme.textTheme.bodySmall,
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _searchController,
                  focusNode: _focusNode,
                  keyboardType: TextInputType.text,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: l10n.docuDraftSearchFormats,
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                if (_loading) const LinearProgressIndicator(),
                if (_error != null)
                  Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                if (query.length < 2 && !hasResults)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'Type at least 2 characters to search forms.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                if (query.length >= 2 && !_loading && !hasResults && _error == null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'No matches — try Find & Draft for AI routing.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                if (_curated.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('AI draft formats', style: theme.textTheme.labelLarge),
                  const SizedBox(height: 4),
                  ..._curated.map(
                    (hit) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: _accentColor.withValues(alpha: 0.12),
                        child: Icon(Icons.auto_awesome, color: _accentColor, size: 18),
                      ),
                      title: Text(hit.label),
                      subtitle: Text('${hit.category} · ${(hit.score * 100).round()}% match'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => widget.onCuratedTap(hit),
                    ),
                  ),
                ],
                if (_official.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(l10n.docuDraftOfficialForms, style: theme.textTheme.labelLarge),
                  const SizedBox(height: 4),
                  ..._official.map(
                    (hit) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(hit.form.formName),
                      subtitle: Text(
                        '${hit.form.authority}${hit.form.formNumber != null ? ' · ${hit.form.formNumber}' : ''} · ${(hit.score * 100).round()}% match',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => widget.onFormTap(hit.form),
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

void openCuratedFormat(
  BuildContext context,
  CuratedFormatHit hit,
  void Function(DocuDraftRouteParams params) onOpen,
) {
  onOpen(
    DocuDraftRouteParams(
      kind: hit.id,
      countryCode: hit.countryCode,
      label: hit.label,
    ),
  );
}
