import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../../widgets/ai_tools/ai_tool_widgets.dart';

/// A generic shimmer list placeholder that can be used on any list screen
/// while the first page of data is loading. Each row mimics a real list-tile
/// (icon box, two text lines, optional trailing chip).
///
/// Replaces the bare [CircularProgressIndicator] that most screens currently
/// show during initial load.
class AppListSkeleton extends StatelessWidget {
  const AppListSkeleton({
    super.key,
    this.itemCount = 6,
    this.showLeadingIcon = true,
    this.showTrailing = true,
    this.padding = const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
  });

  final int itemCount;
  final bool showLeadingIcon;
  final bool showTrailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      padding: padding,
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) => _SkeletonRow(
        showLeadingIcon: showLeadingIcon,
        showTrailing: showTrailing,
        // Vary widths so it looks natural.
        titleWidth: 140.0 + (index % 3) * 40,
        subtitleWidth: 90.0 + (index % 2) * 30,
      ),
    );
  }
}

class _SkeletonRow extends StatelessWidget {
  const _SkeletonRow({
    required this.showLeadingIcon,
    required this.showTrailing,
    required this.titleWidth,
    required this.subtitleWidth,
  });

  final bool showLeadingIcon;
  final bool showTrailing;
  final double titleWidth;
  final double subtitleWidth;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.logoBlueSurface : Colors.white;
    final border = isDark ? AppColors.borderDark : AppColors.borderLight;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          if (showLeadingIcon) ...[
            ShimmerBox(width: 36, height: 36, borderRadius: 8),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShimmerBox(width: titleWidth, height: 13),
                const SizedBox(height: 6),
                ShimmerBox(width: subtitleWidth, height: 11),
              ],
            ),
          ),
          if (showTrailing) ...[
            const SizedBox(width: 10),
            ShimmerBox(width: 52, height: 22, borderRadius: 20),
          ],
        ],
      ),
    );
  }
}

/// Single-card skeleton variant (for detail screens or individual widget slots).
class AppCardSkeleton extends StatelessWidget {
  const AppCardSkeleton({super.key, this.height = 80});
  final double height;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.logoBlueSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ShimmerBox(width: 120, height: 13),
          const SizedBox(height: 8),
          ShimmerBox(width: double.infinity, height: 11),
          const SizedBox(height: 4),
          ShimmerBox(width: 160, height: 11),
        ],
      ),
    );
  }
}
