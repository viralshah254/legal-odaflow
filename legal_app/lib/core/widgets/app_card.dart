import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// A standard surface container used across the app. Matches the dashboard /
/// AI-tool card design (rounded 12px, 1px border, [AppColors.logoBlueSurface]
/// fill in dark mode). Use this instead of hand-rolling `Container` +
/// `BoxDecoration` for every card.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.accentColor,
    this.borderColor,
    this.color,
    this.margin,
    this.gradient = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  /// When provided, tints the border and (if [gradient]) adds a subtle
  /// top-left gradient wash.
  final Color? accentColor;
  final Color? borderColor;
  final Color? color;
  final EdgeInsetsGeometry? margin;
  final bool gradient;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = color ?? (isDark ? AppColors.logoBlueSurface : Colors.white);
    final border = borderColor ??
        (accentColor?.withValues(alpha: 0.30)) ??
        (isDark ? AppColors.borderDark : AppColors.borderLight);

    final decoration = BoxDecoration(
      color: surface,
      borderRadius: BorderRadius.circular(AppColors.radius),
      border: Border.all(color: border),
      gradient: (gradient && accentColor != null)
          ? LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                accentColor!.withValues(alpha: isDark ? 0.12 : 0.06),
                Colors.transparent,
              ],
            )
          : null,
    );

    final content = Padding(padding: padding, child: child);

    return Container(
      margin: margin,
      decoration: decoration,
      clipBehavior: Clip.antiAlias,
      child: onTap == null
          ? content
          : Material(
              color: Colors.transparent,
              child: InkWell(onTap: onTap, child: content),
            ),
    );
  }
}

/// A 36×36 (configurable) rounded, tinted icon container — the ubiquitous
/// "icon in a box" pattern repeated throughout the app.
class AppIconBadge extends StatelessWidget {
  const AppIconBadge({
    super.key,
    required this.icon,
    required this.color,
    this.size = 36,
    this.iconSize = 18,
    this.radius = 8,
  });

  final IconData icon;
  final Color color;
  final double size;
  final double iconSize;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Icon(icon, color: color, size: iconSize),
    );
  }
}
