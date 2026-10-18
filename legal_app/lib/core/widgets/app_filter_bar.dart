import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Horizontal, horizontally-scrollable filter chip bar — matches the web app's
/// filter row pattern (below the page header, above the list).
///
/// Each option is a [AppFilterOption] with an id, label, and optional count.
/// The currently selected id is highlighted with the primary colour.
class AppFilterOption {
  const AppFilterOption({required this.id, required this.label, this.count});
  final String id;
  final String label;
  final int? count;
}

class AppFilterBar extends StatelessWidget {
  const AppFilterBar({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.padding = const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
    this.scrollController,
  });

  final List<AppFilterOption> options;
  final String selected;
  final ValueChanged<String> onSelected;
  final EdgeInsetsGeometry padding;
  final ScrollController? scrollController;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark ? AppColors.mutedForegroundDark : AppColors.mutedForegroundLight;

    return SizedBox(
      height: 40,
      child: ListView.separated(
        controller: scrollController,
        scrollDirection: Axis.horizontal,
        padding: padding,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: options.length,
        itemBuilder: (context, i) {
          final opt = options[i];
          final isSelected = opt.id == selected;
          return GestureDetector(
            onTap: () => onSelected(opt.id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected
                    ? cs.primary.withValues(alpha: 0.15)
                    : (isDark ? AppColors.logoBlueSurface : Colors.white),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected
                      ? cs.primary.withValues(alpha: 0.50)
                      : (isDark ? AppColors.borderDark : AppColors.borderLight),
                  width: isSelected ? 1.5 : 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    opt.label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected ? cs.primary : muted,
                        ),
                  ),
                  if (opt.count != null && opt.count! > 0) ...[
                    const SizedBox(width: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? cs.primary.withValues(alpha: 0.20)
                            : muted.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${opt.count}',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? cs.primary : muted,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
