import '../../../core/config/app_config.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/ai_tools/ai_tool_widgets.dart';

// ─── Popular query chips loaded from API ───────────────────────────────────────

const _accentColor = Color(0xFFEA580C);

// ─── Screen ────────────────────────────────────────────────────────────────────

class SectionFinderScreen extends ConsumerStatefulWidget {
  const SectionFinderScreen({super.key, this.matterId});
  final String? matterId;

  @override
  ConsumerState<SectionFinderScreen> createState() =>
      _SectionFinderScreenState();
}

class _SectionFinderScreenState extends ConsumerState<SectionFinderScreen> {
  final _queryController = TextEditingController();
  final _scrollController = ScrollController();

  String? _countryCode;
  bool _scopeReady = false;
  static const _supported = ['IN', 'US', 'GB', 'KE'];
  bool _loading = false;
  String? _error;
  SectionFinderResult? _result;
  List<PopularSectionQuery> _popularQueries = [];

  @override
  void initState() {
    super.initState();
    _initializeScope();
  }

  Future<void> _initializeScope() async {
    final user = ref.read(authControllerProvider).session?.user;
    var country = widget.matterId == null
        ? await ref.read(workCountryProvider.future) : user?.countryCode;
    if (widget.matterId != null) {
      try {
        if (user?.tenantId == null) throw ApiException('Firm context is required.');
        final matter = await ref.read(mattersApiProvider).getMatterDetail(tenantId: user!.tenantId!, matterId: widget.matterId!);
        country = matter.countryCode;
      } catch (_) {
        if (mounted) setState(() => _error = 'Matter country is unavailable. Reopen the matter and retry.');
        return;
      }
    }
    if (!mounted) return;
    setState(() {
      _countryCode = country?.toUpperCase();
      _scopeReady = _supported.contains(_countryCode);
    });
    if (_scopeReady) await _loadPopular();
  }

  Future<void> _loadPopular() async {
    if (!_scopeReady || _countryCode == null) return;
    try {
      final country = _countryCode!;
      final popular = await ref.read(aiApiProvider).getPopularSections(countryCode: country);
      if (mounted && country == _countryCode) setState(() => _popularQueries = popular);
    } catch (_) {
      // Popular chips are optional — ignore failures.
    }
  }

  @override
  void dispose() {
    _queryController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    final q = query.trim();
    if (q.isEmpty || !_scopeReady || _countryCode == null) return;
    _queryController.text = q;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final locale = Localizations.localeOf(context).languageCode;
      final result = await ref.read(aiApiProvider).runSectionFinder(
            query: q,
            countryCode: _countryCode!,
            matterId: widget.matterId,
            locale: locale,
          );
      if (mounted) {
        setState(() => _result = result);
        await _loadPopular();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Something went wrong. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.sectionFinderTitle),
        backgroundColor:
            isDark ? AppColors.logoBlue : Colors.white,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(
            height: 1,
            color: _accentColor.withValues(alpha: 0.20),
          ),
        ),
      ),
      body: Column(
        children: [
          // Feature header
          AiToolFeatureHeader(
            icon: Icons.menu_book_outlined,
            title: l10n.sectionFinderTitle,
            subtitle: _countryCode == 'IN' ? l10n.sectionFinderSubtitle : 'Find statutory provisions for ${_countryCode ?? 'a selected country'}.',
            accentColor: _accentColor,
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: DropdownButtonFormField<String>(
              initialValue: _countryCode,
              key: ValueKey(_countryCode),
              decoration: InputDecoration(labelText: l10n.commonReleaseLegalCountry),
              items: {..._supported, if (_countryCode != null) _countryCode!}.map((code) => DropdownMenuItem(value: code, child: Text(AppConfig.countryNames[code] ?? code))).toList(),
              onChanged: widget.matterId != null || _loading ? null : (country) {
                setState(() { _countryCode = country; _scopeReady = _supported.contains(country); _result = null; _popularQueries = []; });
                _loadPopular();
              },
            ),
          ),
          if (!_scopeReady)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(_countryCode == null ? 'Choose the legal country before looking up a provision.' : 'Section lookup is not yet supported for $_countryCode. Another country will not be substituted.'),
            ),

          // Search bar + always-visible popular chips
          _SearchBar(
            countryCode: _scopeReady ? _countryCode : null,
            controller: _queryController,
            accentColor: _accentColor,
            popularQueries: _popularQueries,
            onSearch: _search,
            onChipTap: _search,
          ),

          // Content
          Expanded(
            child: AnimatedStateSwitcher(
              child: _loading
                  ? const _LoadingView(key: ValueKey('loading'))
                  : _error != null
                      ? _ErrorView(
                          key: const ValueKey('error'),
                          message: _error!,
                          onRetry: () =>
                              _search(_queryController.text),
                        )
                      : _result != null
                          ? _ResultView(
                              key: const ValueKey('result'),
                              result: _result!,
                              accentColor: _accentColor,
                              onResearch: (q) {
                                context.go(
                                    '/lawyer/research?q=${Uri.encodeComponent(q)}${widget.matterId == null ? '' : '&matterId=${Uri.encodeComponent(widget.matterId!)}'}');
                              },
                            )
                          : _EmptyView(
                              key: const ValueKey('empty'),
                              onChipTap: _search,
                            ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Search bar ────────────────────────────────────────────────────────────────

class _SearchBar extends ConsumerStatefulWidget {
  const _SearchBar({
    required this.controller,
    required this.countryCode,
    required this.accentColor,
    required this.onSearch,
    this.popularQueries = const [],
    this.onChipTap,
  });

  final TextEditingController controller;
  final String? countryCode;
  final Color accentColor;
  final List<PopularSectionQuery> popularQueries;
  final ValueChanged<String> onSearch;
  final ValueChanged<String>? onChipTap;

  @override
  ConsumerState<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends ConsumerState<_SearchBar> {
  static const _debounceMs = 350;
  static const _minSuggestChars = 2;

  final _focusNode = FocusNode();
  Timer? _debounceTimer;
  int _requestGeneration = 0;

  List<SectionFinderSuggestion> _suggestions = [];
  bool _loadingSuggestions = false;
  bool _showSuggestions = false;
  int _highlightIndex = 0;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onQueryChanged);
    _focusNode.addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    widget.controller.removeListener(_onQueryChanged);
    _focusNode
      ..removeListener(_onFocusChanged)
      ..dispose();
    super.dispose();
  }

  void _onFocusChanged() {
    if (!_focusNode.hasFocus && mounted) {
      setState(() => _showSuggestions = false);
    }
  }

  void _onQueryChanged() {
    _debounceTimer?.cancel();
    final q = widget.controller.text.trim();

    if (widget.countryCode == null || q.length < _minSuggestChars) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
        _loadingSuggestions = false;
        _highlightIndex = 0;
      });
      return;
    }

    _debounceTimer = Timer(
      const Duration(milliseconds: _debounceMs),
      () => _fetchSuggestions(q),
    );
  }

  @override
  void didUpdateWidget(covariant _SearchBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.countryCode != widget.countryCode) {
      _debounceTimer?.cancel();
      _requestGeneration++;
      _suggestions = [];
      _showSuggestions = false;
      _loadingSuggestions = false;
    }
  }

  Future<void> _fetchSuggestions(String q) async {
    final country = widget.countryCode;
    if (country == null) return;
    final generation = ++_requestGeneration;
    setState(() => _loadingSuggestions = true);

    try {
      final items = await ref.read(aiApiProvider).suggestSection(q, countryCode: country);
      if (!mounted || generation != _requestGeneration) return;
      if (widget.controller.text.trim() != q) return;

      setState(() {
        _suggestions = items;
        _showSuggestions = items.isNotEmpty && _focusNode.hasFocus;
        _highlightIndex = 0;
      });
    } catch (_) {
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
      });
    } finally {
      if (mounted && generation == _requestGeneration) {
        setState(() => _loadingSuggestions = false);
      }
    }
  }

  void _selectSuggestion(SectionFinderSuggestion suggestion) {
    final query = suggestion.normalizedQuery.isNotEmpty
        ? suggestion.normalizedQuery
        : suggestion.displayLabel;

    setState(() {
      _showSuggestions = false;
      _suggestions = [];
    });
    widget.controller.text = suggestion.displayLabel;
    _focusNode.unfocus();
    widget.onSearch(query);
  }

  void _handleSubmit() {
    if (_showSuggestions && _suggestions.isNotEmpty) {
      final index = _highlightIndex.clamp(0, _suggestions.length - 1);
      _selectSuggestion(_suggestions[index]);
      return;
    }
    widget.onSearch(widget.controller.text);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.logoBlueSurface : Colors.white,
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 3),
                ),
              ],
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: widget.controller,
                      focusNode: _focusNode,
                      onSubmitted: (_) => _handleSubmit(),
                      onTap: () {
                        if (_suggestions.isNotEmpty) {
                          setState(() => _showSuggestions = true);
                        }
                      },
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: l10n.sectionFinderTypeaheadPlaceholder,
                        prefixIcon: Icon(
                          Icons.search,
                          size: 20,
                          color: widget.accentColor,
                        ),
                        suffixIcon: _loadingSuggestions
                            ? Padding(
                                padding: const EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: widget.accentColor,
                                  ),
                                ),
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 13,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(28),
                          borderSide: BorderSide(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(28),
                          borderSide: BorderSide(
                            color: isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(28),
                          borderSide: BorderSide(
                            color: widget.accentColor,
                            width: 1.5,
                          ),
                        ),
                        filled: true,
                        fillColor: isDark
                            ? AppColors.logoBlue
                            : const Color(0xFFF8FAFC),
                      ),
                    ),
                    if (_showSuggestions && _suggestions.isNotEmpty)
                      _SuggestionsDropdown(
                        suggestions: _suggestions,
                        highlightIndex: _highlightIndex,
                        accentColor: widget.accentColor,
                        onHighlight: (index) =>
                            setState(() => _highlightIndex = index),
                        onSelect: _selectSuggestion,
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Material(
                color: widget.accentColor,
                borderRadius: BorderRadius.circular(28),
                child: InkWell(
                  onTap: _handleSubmit,
                  borderRadius: BorderRadius.circular(28),
                  child: const Padding(
                    padding: EdgeInsets.all(13),
                    child: Icon(Icons.search, color: Colors.white, size: 20),
                  ),
                ),
              ),
            ],
          ),
          if (widget.onChipTap != null && widget.popularQueries.isNotEmpty) ...[
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: widget.popularQueries
                    .map(
                      (q) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _PopularChip(
                          label: q.displayLabel,
                          onTap: () => widget.onChipTap!(q.displayLabel),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SuggestionsDropdown extends StatelessWidget {
  const _SuggestionsDropdown({
    required this.suggestions,
    required this.highlightIndex,
    required this.accentColor,
    required this.onHighlight,
    required this.onSelect,
  });

  final List<SectionFinderSuggestion> suggestions;
  final int highlightIndex;
  final Color accentColor;
  final ValueChanged<int> onHighlight;
  final ValueChanged<SectionFinderSuggestion> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorScheme = Theme.of(context).colorScheme;

    return Material(
      elevation: 6,
      shadowColor: Colors.black.withValues(alpha: 0.12),
      color: isDark ? AppColors.logoBlue : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(top: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
        ),
        constraints: const BoxConstraints(maxHeight: 240),
        child: ListView.separated(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          itemCount: suggestions.length,
          separatorBuilder: (_, __) => Divider(
            height: 1,
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
          itemBuilder: (context, index) {
            final suggestion = suggestions[index];
            final highlighted = index == highlightIndex;

            return Material(
              color: highlighted
                  ? accentColor.withValues(alpha: isDark ? 0.14 : 0.08)
                  : Colors.transparent,
              child: InkWell(
                onTap: () => onSelect(suggestion),
                onHover: (_) => onHighlight(index),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              suggestion.displayLabel,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                            if (suggestion.title != null &&
                                suggestion.title!.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  suggestion.title!,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(
                                        color: colorScheme.onSurface
                                            .withValues(alpha: 0.55),
                                      ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (suggestion.isNetworkMatch) ...[
                        const SizedBox(width: 8),
                        _NetworkSourceBadge(label: l10n.sectionFinderNetworkBadge),
                      ],
                      Icon(
                        Icons.north_west,
                        size: 14,
                        color: colorScheme.onSurface.withValues(alpha: 0.35),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NetworkSourceBadge extends StatelessWidget {
  const _NetworkSourceBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF0EA5E9).withValues(alpha: 0.15)
            : const Color(0xFFE0F2FE),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF0EA5E9).withValues(alpha: 0.35),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.cloud_download_outlined,
            size: 12,
            color: isDark
                ? const Color(0xFF7DD3FC)
                : const Color(0xFF0284C7),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? const Color(0xFF7DD3FC)
                  : const Color(0xFF0284C7),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Empty / initial state ─────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  const _EmptyView({super.key, required this.onChipTap});

  final ValueChanged<String> onChipTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.manage_search_outlined,
              size: 36,
              color: colorScheme.onSurface.withValues(alpha: 0.20),
            ),
            const SizedBox(height: 10),
            Text(
              'Type a section above to look it up',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.40),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PopularChip extends StatefulWidget {
  const _PopularChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  State<_PopularChip> createState() => _PopularChipState();
}

class _PopularChipState extends State<_PopularChip>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 80),
    );
    _scale =
        Tween<double>(begin: 1.0, end: 0.93).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return AnimatedBuilder(
      animation: _scale,
      builder: (context, child) => Transform.scale(
        scale: _scale.value,
        child: child,
      ),
      child: GestureDetector(
        onTapDown: (_) {
          if (!MediaQuery.disableAnimationsOf(context)) _ctrl.forward();
        },
        onTapUp: (_) async {
          await _ctrl.reverse();
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        onTapCancel: () => _ctrl.reverse(),
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            border: Border.all(
              color: _accentColor.withValues(alpha: 0.40),
            ),
            borderRadius: BorderRadius.circular(20),
            color: isDark
                ? _accentColor.withValues(alpha: 0.10)
                : _accentColor.withValues(alpha: 0.06),
          ),
          child: Text(
            widget.label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _accentColor,
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Loading (shimmer skeletons) ───────────────────────────────────────────────

class _LoadingView extends StatelessWidget {
  const _LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: 3,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, __) => const SectionSkeletonCard(),
    );
  }
}

// ─── Error ─────────────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: Color(0xFFDC2626)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: onRetry,
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Result view ───────────────────────────────────────────────────────────────

class _ResultView extends StatelessWidget {
  const _ResultView({
    super.key,
    required this.result,
    required this.accentColor,
    required this.onResearch,
  });

  final SectionFinderResult result;
  final Color accentColor;
  final ValueChanged<String> onResearch;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    if (result.matches.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.search_off, size: 40,
                  color: colorScheme.onSurface.withValues(alpha: 0.35)),
              const SizedBox(height: 12),
              Text(
                'No sections found for "${result.query}"',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'Try "420 IPC" or "302 IPC"',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.50),
                    ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      itemCount: result.matches.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        if (index == 0) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${result.total} section${result.total == 1 ? '' : 's'} found',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.50),
                      letterSpacing: 0.5,
                    ),
              ),
              if (result.actStructure != null &&
                  result.actStructure!.badgeLabel.isNotEmpty) ...[
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    result.actStructure!.badgeLabel,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: accentColor,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              ],
              const SizedBox(height: 4),
            ],
          );
        }
        final entry = result.matches[index - 1];
        return StaggeredFadeSlide(
          index: index,
          child: _SectionCard(
            entry: entry,
            accentColor: accentColor,
            onResearch: onResearch,
          ),
        );
      },
    );
  }
}

// ─── Section card ──────────────────────────────────────────────────────────────

/// Returns a left-border accent colour based on the section code prefix.
Color _sectionAccentColor(SectionFinderEntry entry) {
  final code = entry.displayLegacy.toUpperCase();
  if (code.contains('BNS') || code.contains('BNSS')) {
    return const Color(0xFF7C3AED); // purple — new BNSS codes
  }
  if (code.contains('CRPC') || code.contains('CrPC')) {
    return const Color(0xFF0EA5E9); // sky blue — CrPC
  }
  if (code.contains('NI ACT') || code.contains('NI')) {
    return const Color(0xFF0D9488); // teal — Negotiable Instruments
  }
  return const Color(0xFFEA580C); // orange — IPC default
}

bool _shouldShowPracticeNote(SectionFinderEntry entry) {
  final note = entry.practiceNote?.trim();
  if (note == null || note.isEmpty) return false;
  if (entry.matchSource == 'curated' || entry.matchSource == 'remap') {
    return true;
  }
  final text = entry.sectionText?.trim();
  if (text == null || text.isEmpty) return true;
  if (text.startsWith(note)) return false;
  if (note.length >= text.length * 0.9) return false;
  return true;
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.entry,
    required this.accentColor,
    required this.onResearch,
  });

  final SectionFinderEntry entry;
  final Color accentColor;
  final ValueChanged<String> onResearch;

  @override
  Widget build(BuildContext context) {
    final cardAccent = _sectionAccentColor(entry);
    final colorScheme = Theme.of(context).colorScheme;
    final hasNewCode = entry.newSection != null && entry.newSection!.isNotEmpty;

    final badges = <({String label, Color bg, Color fg})>[
      if (entry.isCognizable == true)
        (
          label: 'Cognizable',
          bg: const Color(0xFFFFEDED),
          fg: const Color(0xFFDC2626)
        ),
      if (entry.isBailable == true)
        (
          label: 'Bailable',
          bg: const Color(0xFFF0FDF4),
          fg: const Color(0xFF16A34A)
        ),
      if (entry.isBailable == false)
        (
          label: 'Non-bailable',
          bg: const Color(0xFFFFF7E6),
          fg: const Color(0xFFD97706)
        ),
      if (entry.isCompoundable == true)
        (
          label: 'Compoundable',
          bg: const Color(0xFFEFF6FF),
          fg: const Color(0xFF2563EB)
        ),
    ];
    final showNetworkBadge = entry.matchSource == 'network';

    final collapsedContent = Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Legacy → New mapping arrow
          if (hasNewCode) ...[
            Row(
              children: [
                _CodePill(code: entry.displayLegacy, color: cardAccent),
                const SizedBox(width: 6),
                Icon(Icons.arrow_forward, size: 14,
                    color: colorScheme.onSurface.withValues(alpha: 0.40)),
                const SizedBox(width: 6),
                _CodePill(
                    code: entry.displayNew,
                    color: const Color(0xFF7C3AED)),
              ],
            ),
            const SizedBox(height: 8),
          ],
          // Badges
          if (badges.isNotEmpty || showNetworkBadge)
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ...badges
                    .map((b) => _Badge(label: b.label, bg: b.bg, fg: b.fg)),
                if (showNetworkBadge)
                  _NetworkSourceBadge(
                    label: AppLocalizations.of(context).sectionFinderNetworkBadge,
                  ),
              ],
            ),
        ],
      ),
    );

    final expandedContent = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (entry.sectionText != null && entry.sectionText!.isNotEmpty) ...[
          const Divider(height: 16),
          Text(
            'Section text',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface.withValues(alpha: 0.50),
                  letterSpacing: 0.5,
                ),
          ),
          const SizedBox(height: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 320),
            child: SingleChildScrollView(
              child: Text(
                entry.sectionText!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ),
        ],
        if (entry.changeSummary != null &&
            entry.changeSummary!.isNotEmpty) ...[
          const Divider(height: 16),
          Text(
            'Change summary',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface.withValues(alpha: 0.50),
                  letterSpacing: 0.5,
                ),
          ),
          const SizedBox(height: 4),
          Text(entry.changeSummary!,
              style: Theme.of(context).textTheme.bodySmall),
        ],
        if (entry.punishment != null &&
            entry.punishment!.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            'Punishment',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface.withValues(alpha: 0.50),
                  letterSpacing: 0.5,
                ),
          ),
          const SizedBox(height: 4),
          Text(entry.punishment!,
              style: Theme.of(context).textTheme.bodySmall),
        ],
        if (entry.bailPosture != null &&
            entry.bailPosture!.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            'Bail posture',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface.withValues(alpha: 0.50),
                  letterSpacing: 0.5,
                ),
          ),
          const SizedBox(height: 4),
          Text(entry.bailPosture!,
              style: Theme.of(context).textTheme.bodySmall),
        ],
        if (_shouldShowPracticeNote(entry)) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: cardAccent.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: cardAccent.withValues(alpha: 0.20)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.lightbulb_outline,
                    size: 14, color: cardAccent),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(entry.practiceNote!,
                      style:
                          Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.80),
                              )),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        // Research CTA
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              onResearch(
                '${entry.displayLegacy} ${entry.displayTitle}'.trim(),
              );
            },
            icon: const Icon(Icons.travel_explore, size: 15),
            label: const Text('Research this section'),
            style: OutlinedButton.styleFrom(
              foregroundColor: cardAccent,
              side: BorderSide(color: cardAccent.withValues(alpha: 0.50)),
              padding: const EdgeInsets.symmetric(vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              final section = entry.displayNew.isNotEmpty
                  ? entry.displayNew
                  : entry.displayLegacy;
              final label = entry.displayTitle.isNotEmpty
                  ? entry.displayTitle
                  : section;
              final excerpt = entry.sectionText;
              final qs = <String, String>{
                'pinSection': section,
                'pinLabel': label,
                if (excerpt != null && excerpt.isNotEmpty)
                  'pinExcerpt': excerpt.length > 400
                      ? excerpt.substring(0, 400)
                      : excerpt,
              };
              final query = qs.entries
                  .map((e) =>
                      '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
                  .join('&');
              GoRouter.of(context).go(
                '/lawyer/docu-draft/draft?$query',
              );
            },
            icon: const Icon(Icons.push_pin_outlined, size: 15),
            label: const Text('Pin to draft'),
            style: FilledButton.styleFrom(
              backgroundColor: cardAccent,
              padding: const EdgeInsets.symmetric(vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
      ],
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppColors.radius),
      child: Stack(
        children: [
          // Left accent bar
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            child: Container(
              width: 4,
              decoration: BoxDecoration(
                color: cardAccent,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(AppColors.radius),
                  bottomLeft: Radius.circular(AppColors.radius),
                ),
              ),
            ),
          ),
          ExpandableLegalCard(
            title: entry.displayTitle.isNotEmpty
                ? entry.displayTitle
                : entry.displayLegacy,
            subtitle: entry.trialCourtLabel ?? '',
            accentColor: cardAccent,
            collapsedContent: collapsedContent,
            expandedContent: expandedContent,
          ),
        ],
      ),
    );
  }
}

class _CodePill extends StatelessWidget {
  const _CodePill({required this.code, required this.color});
  final String code;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Text(
        code,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(
      {required this.label, required this.bg, required this.fg});
  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark ? fg.withValues(alpha: 0.15) : bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withValues(alpha: 0.30)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: isDark ? fg.withValues(alpha: 0.90) : fg,
        ),
      ),
    );
  }
}
